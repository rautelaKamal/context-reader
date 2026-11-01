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

function bootWorker({ store = {}, respondWith = { ok: true, body: { summary: 'ok' } }, breakStorage = false } = {}) {
  let listener = null;
  const calls = [];

  const context = {
    console,
    setTimeout,
    AbortSignal: { timeout: () => undefined },
    navigator: { onLine: true },
    crypto: globalThis.crypto,
    // A real service worker has these as globals. Without them the worker's
    // own try/catch swallows a ReferenceError and the test sees a plausible
    // wrong answer rather than a crash.
    URL: globalThis.URL,
    JSON: globalThis.JSON,
    fetch: async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body), headers: init.headers });
      return {
        ok: respondWith.ok,
        status: respondWith.status ?? 200,
        json: async () => respondWith.body,
        text: async () => JSON.stringify(respondWith.body),
      };
    },
    chrome: {
      runtime: {
        onMessage: { addListener: (fn) => { listener = fn; } },
        // The worker registers an onInstalled handler at load time to
        // re-inject into already open tabs. These tests only exercise the
        // quota path, so the handler is accepted and never invoked.
        onInstalled: { addListener: () => {} },
      },
      storage: {
        local: {
          get: async (key) => {
            if (breakStorage) throw new Error('storage unavailable');
            return key in store ? { [key]: store[key] } : {};
          },
          set: async (patch) => {
            if (breakStorage) throw new Error('storage unavailable');
            Object.assign(store, patch);
          },
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

test('what actually leaves the browser', async (t) => {
  const SECRET = 'eyJhbGciOiJIUzI1NiJ9-session-token';

  await t.test('a query string and fragment are stripped from the page address', async () => {
    const { send, calls } = bootWorker();
    await send({
      type: 'explain',
      payload: {
        selection: 'a passage',
        url: `https://mail.example.com/thread/42?token=${SECRET}&q=divorce#msg-7`,
      },
    });
    assert.equal(calls[0].body.url, 'https://mail.example.com/thread/42');
  });

  await t.test('neither the token nor the fragment appears anywhere in the request', async () => {
    const { send, calls } = bootWorker();
    await send({
      type: 'explain',
      payload: {
        selection: 'a passage',
        url: `https://mail.example.com/thread/42?token=${SECRET}&q=divorce#msg-7`,
      },
    });
    // The whole serialised body, not just the url field, in case some other
    // field ever starts carrying the address.
    const sent = JSON.stringify(calls[0].body);
    assert.ok(!sent.includes(SECRET), 'the token never leaves');
    assert.ok(!sent.includes('q=divorce'), 'the search terms never leave');
    assert.ok(!sent.includes('msg-7'), 'the fragment never leaves');
  });

  await t.test('the origin and path survive, because mode detection needs them', async () => {
    const { send, calls } = bootWorker();
    await send({
      type: 'explain',
      payload: { selection: 'x', url: 'https://www.thehindu.com/opinion/editorial/a/article1.ece?utm_source=x' },
    });
    assert.equal(calls[0].body.url, 'https://www.thehindu.com/opinion/editorial/a/article1.ece');
  });

  await t.test('a malformed address is dropped rather than passed through', async () => {
    const { send, calls } = bootWorker();
    await send({ type: 'explain', payload: { selection: 'x', url: 'not a url at all' } });
    assert.equal(calls[0].body.url, undefined);
  });
});

test('install id', async (t) => {
  await t.test('is sent with the request, so the server can count this install', async () => {
    const { send, calls } = bootWorker();
    await send(explain());
    const id = calls[0].headers['X-Install-Id'];
    assert.ok(id, 'header is present');
    assert.match(id, /^[0-9a-f-]{36}$/, 'a random uuid, not anything about the person');
  });

  await t.test('is made once and reused, so one profile stays one install', async () => {
    const store = {};
    const first = bootWorker({ store });
    await first.send(explain());
    const second = bootWorker({ store });
    await second.send(explain());
    assert.equal(
      first.calls[0].headers['X-Install-Id'],
      second.calls[0].headers['X-Install-Id'],
    );
  });

  await t.test('is left out when storage refuses, rather than failing the request', async () => {
    const { send, calls } = bootWorker({ breakStorage: true });
    const res = await send(explain());
    assert.equal(res.success, true, 'the reader still gets an answer');
    assert.equal(calls[0].headers['X-Install-Id'], undefined);
  });
});

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
