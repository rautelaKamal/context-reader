/**
 * Exercises the real service worker by running it in a VM with stand-ins for
 * the extension APIs, rather than testing a copy of the logic.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const SOURCE = readFileSync(join(__dirname, '..', 'src', 'extension', 'background.js'), 'utf8');

function bootWorker({ store = {}, respondWith = { ok: true, body: { summary: 'ok' } } } = {}) {
  let listener = null;
  const calls = [];

  const context = {
    console,
    setTimeout,
    AbortSignal: { timeout: () => undefined },
    navigator: { onLine: true },
    fetch: async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return {
        ok: respondWith.ok,
        status: respondWith.status ?? 200,
        json: async () => respondWith.body,
        text: async () => JSON.stringify(respondWith.body),
      };
    },
    chrome: {
      runtime: { onMessage: { addListener: (fn) => { listener = fn; } } },
      storage: {
        local: {
          get: async (key) => (key in store ? { [key]: store[key] } : {}),
          set: async (patch) => { Object.assign(store, patch); },
        },
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(SOURCE, context);

  const send = (message) =>
    new Promise((resolve) => { listener(message, null, resolve); });

  return { send, store, calls };
}

const explain = (depth) => ({
  type: 'explain',
  payload: { selection: 'a passage', ...(depth ? { depth } : {}) },
});

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

test('daily allowance', async (t) => {
  await t.test('reports the full allowance before anything is used', async () => {
    const { send } = bootWorker();
    const res = await send({ type: 'usage' });
    assert.equal(res.success, true);
    assert.equal(res.remaining, res.limit);
  });

  await t.test('a fast explanation spends one', async () => {
    const { send } = bootWorker();
    const before = (await send({ type: 'usage' })).limit;
    const res = await send(explain());
    assert.equal(res.success, true);
    assert.equal(res.remaining, before - 1);
  });

  await t.test('a deep read spends three', async () => {
    const { send } = bootWorker();
    const limit = (await send({ type: 'usage' })).limit;
    const res = await send(explain('deep'));
    assert.equal(res.remaining, limit - 3);
  });

  await t.test('refuses once the allowance is spent, without calling the API', async () => {
    const { send, calls } = bootWorker({ store: { usage: { date: todayKey(), used: 30 } } });
    const res = await send(explain());
    assert.equal(res.success, false);
    assert.equal(res.overLimit, true);
    assert.match(res.error, /today/i);
    assert.equal(calls.length, 0, 'must not spend quota on a refused request');
  });

  await t.test('refuses a deep read that does not fit, but says so distinctly', async () => {
    const { send } = bootWorker({ store: { usage: { date: todayKey(), used: 28 } } });
    const res = await send(explain('deep'));
    assert.equal(res.success, false);
    assert.match(res.error, /deep/i);
  });

  await t.test('still allows a fast one when only a deep one would not fit', async () => {
    const { send } = bootWorker({ store: { usage: { date: todayKey(), used: 28 } } });
    const res = await send(explain());
    assert.equal(res.success, true);
  });

  await t.test('resets when the date rolls over', async () => {
    const { send } = bootWorker({ store: { usage: { date: '2020-1-1', used: 30 } } });
    const res = await send({ type: 'usage' });
    assert.equal(res.remaining, res.limit);
  });

  await t.test('a failed request still reports its error rather than hanging', async () => {
    const { send } = bootWorker({
      respondWith: { ok: false, status: 400, body: { error: 'No text was selected' } },
    });
    const res = await send(explain());
    assert.equal(res.success, false);
    assert.equal(res.error, 'No text was selected');
  });
});
