const test = require('node:test');
const assert = require('node:assert/strict');

const { spend, dayWindow, COST, limitsFromEnv } = require('../.test-build/quota');

const LIMITS = { perInstall: 30, perIp: 90, global: 2000, dayOffsetMinutes: 0 };

/**
 * A stand-in Redis holding counters in a plain object, so these tests need no
 * server. It understands only the two commands the quota uses.
 */
function fakeRedis(seed = {}) {
  const store = { ...seed };
  const seen = [];
  const pipeline = async (commands) => {
    seen.push(...commands);
    return commands.map(([verb, key, arg]) => {
      if (verb === 'INCRBY') return (store[key] = (store[key] ?? 0) + Number(arg));
      if (verb === 'EXPIRE') return 1;
      throw new Error(`unexpected command ${verb}`);
    });
  };
  return { pipeline, store, seen };
}

const keysOf = (store) => Object.keys(store);
const valueOfKind = (store, kind) => {
  const key = keysOf(store).find((k) => k.startsWith(`cr:${kind}:`));
  return key ? store[key] : undefined;
};

test('daily quota', async (t) => {
  await t.test('allows a request under the limit and counts its cost', async () => {
    const r = fakeRedis();
    const d = await spend(r.pipeline, { installId: 'a', ip: '1.1.1.1', cost: COST.fast, limits: LIMITS });
    assert.equal(d.ok, true);
    assert.equal(d.enforced, true);
    assert.equal(d.remaining, 29);
    assert.equal(valueOfKind(r.store, 'i'), 1);
  });

  await t.test('a deep read costs three', async () => {
    const r = fakeRedis();
    const d = await spend(r.pipeline, { installId: 'a', ip: '1.1.1.1', cost: COST.deep, limits: LIMITS });
    assert.equal(d.remaining, 27);
    assert.equal(valueOfKind(r.store, 'i'), 3);
  });

  await t.test('allows the request that exactly reaches the limit', async () => {
    const r = fakeRedis();
    let last;
    for (let i = 0; i < 30; i++) {
      last = await spend(r.pipeline, { installId: 'a', ip: '1.1.1.1', cost: 1, limits: LIMITS });
    }
    assert.equal(last.ok, true, 'the 30th of 30 is still allowed');
    assert.equal(last.remaining, 0);
  });

  await t.test('refuses the one after, naming the install', async () => {
    const r = fakeRedis();
    for (let i = 0; i < 30; i++) {
      await spend(r.pipeline, { installId: 'a', ip: '1.1.1.1', cost: 1, limits: LIMITS });
    }
    const d = await spend(r.pipeline, { installId: 'a', ip: '1.1.1.1', cost: 1, limits: LIMITS });
    assert.equal(d.ok, false);
    assert.equal(d.reason, 'install');
    assert.equal(d.remaining, 0);
  });

  await t.test('refuses a deep read that would cross the limit', async () => {
    const r = fakeRedis();
    for (let i = 0; i < 28; i++) {
      await spend(r.pipeline, { installId: 'a', ip: '1.1.1.1', cost: 1, limits: LIMITS });
    }
    const d = await spend(r.pipeline, { installId: 'a', ip: '1.1.1.1', cost: COST.deep, limits: LIMITS });
    assert.equal(d.ok, false, '28 used plus 3 is over 30');
  });

  await t.test('a fresh install id does not escape the address limit', async () => {
    const r = fakeRedis();
    let last;
    // A new install id every time, which is exactly the way round the
    // per install counter. The address counter is what catches it.
    for (let i = 0; i < 91; i++) {
      last = await spend(r.pipeline, { installId: `install-${i}`, ip: '1.1.1.1', cost: 1, limits: LIMITS });
    }
    assert.equal(last.ok, false);
    assert.equal(last.reason, 'ip');
  });

  await t.test('the global cap refuses even a first time install', async () => {
    const limits = { ...LIMITS, global: 5 };
    const r = fakeRedis();
    for (let i = 0; i < 5; i++) {
      await spend(r.pipeline, { installId: `x${i}`, ip: `10.0.0.${i}`, cost: 1, limits });
    }
    const d = await spend(r.pipeline, { installId: 'brand-new', ip: '10.0.0.99', cost: 1, limits });
    assert.equal(d.ok, false);
    assert.equal(d.reason, 'global', 'the whole service is out, not this person');
  });

  await t.test('counters start again on the next day', async () => {
    const r = fakeRedis();
    const day1 = Date.UTC(2026, 0, 1, 12);
    for (let i = 0; i < 30; i++) {
      await spend(r.pipeline, { installId: 'a', ip: '1.1.1.1', cost: 1, limits: LIMITS, now: day1 });
    }
    const blocked = await spend(r.pipeline, { installId: 'a', ip: '1.1.1.1', cost: 1, limits: LIMITS, now: day1 });
    assert.equal(blocked.ok, false);

    const day2 = day1 + 86_400_000;
    const fresh = await spend(r.pipeline, { installId: 'a', ip: '1.1.1.1', cost: 1, limits: LIMITS, now: day2 });
    assert.equal(fresh.ok, true, 'a new day writes to a new key');
    assert.equal(fresh.remaining, 29);
  });

  await t.test('an old extension sending no install id is held to the address limit', async () => {
    const r = fakeRedis();
    const d = await spend(r.pipeline, { installId: null, ip: '1.1.1.1', cost: 1, limits: LIMITS });
    assert.equal(d.ok, true, 'it must keep working rather than be refused');
    assert.equal(valueOfKind(r.store, 'i'), undefined, 'no install counter without an id');
    assert.equal(valueOfKind(r.store, 'p'), 1, 'the address is still counted');
  });

  await t.test('lets the request through when there is no store, and says so', async () => {
    const warnings = [];
    const d = await spend(null, {
      installId: 'a', ip: '1.1.1.1', cost: 1, limits: LIMITS, log: (m) => warnings.push(m),
    });
    assert.equal(d.ok, true);
    assert.equal(d.enforced, false, 'callers can tell this was not actually checked');
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /not? store configured|no store configured/i);
  });

  await t.test('lets the request through when the store errors, and warns every time', async () => {
    const failing = async () => { throw new Error('connection refused'); };
    const warnings = [];
    const log = (m) => warnings.push(m);
    for (let i = 0; i < 3; i++) {
      const d = await spend(failing, { installId: 'a', ip: '1.1.1.1', cost: 1, limits: LIMITS, log });
      assert.equal(d.ok, true, 'a Redis outage must not stop people reading');
      assert.equal(d.enforced, false);
    }
    // Not once per process: while this is happening nothing caps spending, so
    // the number of these lines is the size of the problem.
    assert.equal(warnings.length, 3);
    assert.match(warnings[0], /connection refused/, 'the cause is in the message');
  });

  await t.test('never writes a raw address or install id into a key', async () => {
    const r = fakeRedis();
    await spend(r.pipeline, { installId: 'secret-install', ip: '203.0.113.7', cost: 1, limits: LIMITS });
    const keys = keysOf(r.store).join(' ');
    assert.ok(!keys.includes('203.0.113.7'), 'addresses are hashed');
    assert.ok(!keys.includes('secret-install'), 'install ids are hashed');
  });

  await t.test('every counter gets an expiry, so the store cannot grow forever', async () => {
    const r = fakeRedis();
    await spend(r.pipeline, { installId: 'a', ip: '1.1.1.1', cost: 1, limits: LIMITS });
    const incrs = r.seen.filter(([v]) => v === 'INCRBY').length;
    const expires = r.seen.filter(([v]) => v === 'EXPIRE').length;
    assert.equal(incrs, 3, 'install, address, global');
    assert.equal(expires, incrs);
  });
});

test('limits from the environment', async (t) => {
  await t.test('the day boundary defaults to India, matching what the extension promises', () => {
    const before = process.env.QUOTA_DAY_OFFSET_MINUTES;
    delete process.env.QUOTA_DAY_OFFSET_MINUTES;
    try {
      assert.equal(limitsFromEnv().dayOffsetMinutes, 330);
    } finally {
      if (before !== undefined) process.env.QUOTA_DAY_OFFSET_MINUTES = before;
    }
  });

  await t.test('an explicit zero still means UTC', () => {
    const before = process.env.QUOTA_DAY_OFFSET_MINUTES;
    process.env.QUOTA_DAY_OFFSET_MINUTES = '0';
    try {
      assert.equal(limitsFromEnv().dayOffsetMinutes, 0);
    } finally {
      if (before === undefined) delete process.env.QUOTA_DAY_OFFSET_MINUTES;
      else process.env.QUOTA_DAY_OFFSET_MINUTES = before;
    }
  });
});

test('day window', async (t) => {
  await t.test('23:59 and 00:01 in India fall on different quota days', () => {
    // India is UTC+5:30, so its midnight is 18:30 the previous day in UTC.
    const lateTonight = Date.UTC(2026, 0, 1, 18, 29);   // 23:59 IST, 1 Jan
    const justAfterMidnight = Date.UTC(2026, 0, 1, 18, 31); // 00:01 IST, 2 Jan

    assert.notEqual(
      dayWindow(330, lateTonight).key,
      dayWindow(330, justAfterMidnight).key,
      'two minutes apart, but a new allowance',
    );
    assert.equal(
      dayWindow(0, lateTonight).key,
      dayWindow(0, justAfterMidnight).key,
      'on UTC both are still 1 January, which is the bug the offset fixes',
    );
  });

  await t.test('the reset time it reports is that Indian midnight', () => {
    const lateTonight = Date.UTC(2026, 0, 1, 18, 29);
    assert.equal(dayWindow(330, lateTonight).resetAt, Date.UTC(2026, 0, 1, 18, 30) / 1000);
  });

  await t.test('reset time is the next boundary', () => {
    const now = Date.UTC(2026, 0, 1, 12);
    const { resetAt } = dayWindow(0, now);
    assert.equal(resetAt, Date.UTC(2026, 0, 2) / 1000);
  });

  await t.test('an offset moves the boundary for a different midnight', () => {
    // 330 minutes shifts the day to Indian local time.
    const beforeLocalMidnight = Date.UTC(2026, 0, 1, 18, 0);
    const afterLocalMidnight = Date.UTC(2026, 0, 1, 19, 0);
    assert.notEqual(
      dayWindow(330, beforeLocalMidnight).key,
      dayWindow(330, afterLocalMidnight).key,
      '18:30 UTC is the day boundary at +5:30',
    );
    assert.equal(
      dayWindow(0, beforeLocalMidnight).key,
      dayWindow(0, afterLocalMidnight).key,
      'with no offset both are the same UTC day',
    );
  });
});

test('parse outcome counter', async (t) => {
  const { countParse } = require('../.test-build/quota');
  const day = 20_000 * 86_400_000;

  await t.test('counts each outcome per day, as a number only', async () => {
    const seen = [];
    const pipeline = async (commands) => { seen.push(...commands); return commands.map(() => 1); };
    await countParse(pipeline, 'repaired', 0, day);
    assert.deepEqual(seen, [['INCR', 'parse:20000:repaired'], ['EXPIRE', 'parse:20000:repaired', 2592000]]);
  });

  await t.test('does nothing without a store, and never throws when the store fails', async () => {
    await countParse(null, 'failed', 0, day);
    await countParse(async () => { throw new Error('down'); }, 'failed', 0, day);
  });
});
