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

function bootWorker({ store = {}, respondWith = { ok: true, body: { summary: 'ok' } }, breakStorage = false, shortcut = '⇧⌘E', streamLines = null } = {}) {
  let listener = null;
  let onCommand = null;
  let onConnect = null;
  const calls = [];
  const tabMessages = [];

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
    TextDecoder: globalThis.TextDecoder,
    AbortController: globalThis.AbortController,
    fetch: async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body), headers: init.headers });
      if (streamLines) {
        const chunks = streamLines.map((l) => new TextEncoder().encode(typeof l === 'string' ? l : `${JSON.stringify(l)}\n`));
        return { ok: true, status: 200, body: { getReader: () => ({ read: async () => (chunks.length ? { value: chunks.shift(), done: false } : { done: true }) }) } };
      }
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
        onConnect: { addListener: (fn) => { onConnect = fn; } },
        // The worker registers an onInstalled handler at load time to
        // re-inject into already open tabs. These tests only exercise the
        // quota path, so the handler is accepted and never invoked.
        onInstalled: { addListener: () => {} },
      },
      commands: {
        onCommand: { addListener: (fn) => { onCommand = fn; } },
        getAll: async () => [{ name: 'explain-selection', shortcut }, { name: '_execute_action', shortcut: '' }],
      },
      tabs: {
        sendMessage: async (tabId, message) => { tabMessages.push({ tabId, message }); },
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

  /** Opens a fake port the way the card does, posts a request, and collects what comes back. */
  const connect = (message) => new Promise((resolve) => {
    const received = [];
    let onPortMessage = null;
    const port = {
      name: 'explain',
      postMessage: (e) => { received.push(e); if (e.type === 'done' || e.type === 'error') resolve(received); },
      onMessage: { addListener: (fn) => { onPortMessage = fn; } },
      onDisconnect: { addListener: () => {} },
    };
    onConnect(port);
    onPortMessage(message);
  });

  return { send, store, calls, tabMessages, connect, command: (name, tab) => onCommand(name, tab) };
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

test('keyboard shortcut', async (t) => {
  await t.test('the command is forwarded to the tab, where the frame holding the selection opens the card', async () => {
    const { command, tabMessages } = bootWorker();
    command('explain-selection', { id: 7 });
    assert.deepEqual(JSON.parse(JSON.stringify(tabMessages)), [{ tabId: 7, message: { type: 'explain-selection' } }]);
  });

  await t.test('other commands and tab-less events are ignored', async () => {
    const { command, tabMessages } = bootWorker();
    command('something-else', { id: 7 });
    command('explain-selection', undefined);
    assert.equal(tabMessages.length, 0);
  });

  await t.test('the pill is told the shortcut Chrome actually assigned', async () => {
    const { send } = bootWorker({ shortcut: 'Ctrl+Shift+E' });
    assert.equal((await send({ type: 'shortcut' })).shortcut, 'Ctrl+Shift+E');
  });

  await t.test('an unassigned shortcut comes back empty, so the pill hides it', async () => {
    const { send } = bootWorker({ shortcut: '' });
    assert.equal((await send({ type: 'shortcut' })).shortcut, '');
  });
});

test('streaming over a port', async (t) => {
  const lines = [
    { type: 'start', mode: 'plain', depth: 'fast', modes: [] },
    { type: 'summary', text: 'The gist' },
    { type: 'section', label: 'In other words' },
    { type: 'delta', text: 'More.' },
    { type: 'done', result: { summary: 'The gist', sections: [{ label: 'In other words', body: 'More.' }] } },
  ];
  const request = (id) => ({ type: 'explain', requestId: id, payload: { selection: 'a passage', url: 'https://x.test/a?token=1' } });

  await t.test('events arrive in order, and the start carries the allowance', async () => {
    const { connect } = bootWorker({ streamLines: lines });
    const got = JSON.parse(JSON.stringify(await connect(request('req-0001'))));
    assert.deepEqual(got.map((e) => e.type), ['start', 'summary', 'section', 'delta', 'done']);
    assert.equal(got[0].remaining, 29);
  });

  await t.test('the request asks for a stream, carries its id, and still strips the address', async () => {
    const { connect, calls } = bootWorker({ streamLines: lines });
    await connect(request('req-0002'));
    assert.equal(calls[0].body.stream, true);
    assert.equal(calls[0].headers['X-Request-Id'], 'req-0002');
    assert.equal(calls[0].body.url, 'https://x.test/a');
  });

  await t.test('an event split across network chunks is still read whole', async () => {
    const whole = lines.map((l) => `${JSON.stringify(l)}\n`).join('');
    const { connect } = bootWorker({ streamLines: [whole.slice(0, 37), whole.slice(37, 90), whole.slice(90)] });
    const got = await connect(request('req-0003'));
    assert.equal(got.at(-1).type, 'done');
  });

  await t.test('a stream that drops after words arrived is reported as cut off', async () => {
    const { connect } = bootWorker({ streamLines: lines.slice(0, 2) });
    const got = await connect(request('req-0004'));
    assert.equal(got.at(-1).type, 'error');
    assert.equal(got.at(-1).partial, true);
    assert.match(got.at(-1).message, /cut off/);
  });

  await t.test('retrying the same request id is charged once', async () => {
    const store = {};
    const first = bootWorker({ store, streamLines: lines });
    await first.connect(request('req-0005'));
    const second = bootWorker({ store, streamLines: lines });
    const got = await second.connect(request('req-0005'));
    assert.equal(got[0].remaining, 29, 'still one used');
    const third = bootWorker({ store, streamLines: lines });
    assert.equal((await third.connect(request('req-0006')))[0].remaining, 28, 'a new id is charged');
  });
});

test('deep reads that are refused', async (t) => {
  const deep = (id) => ({ type: 'explain', requestId: id, payload: { selection: 'a passage', depth: 'deep' } });
  const resting = { ok: false, status: 503, body: { code: 'deep_resting', refunded: true, error: 'Go deeper is resting until tomorrow.', resetAt: Math.floor(Date.now() / 1000) + 3600 } };

  await t.test('a deep read refused by the server costs the reader nothing and is not retried', async () => {
    const store = {};
    const { connect, calls, send } = bootWorker({ store, respondWith: resting });
    const got = await connect(deep('req-deep-1'));
    assert.equal(got.at(-1).code, 'deep_resting');
    assert.equal(calls.length, 1, 'no retry of a refusal');
    assert.equal((await send({ type: 'usage' })).remaining, 30, 'allowance untouched');
  });

  await t.test('once resting, the next deep read is refused without a request', async () => {
    const store = {};
    await bootWorker({ store, respondWith: resting }).connect(deep('req-deep-2'));
    const again = bootWorker({ store, respondWith: resting });
    const got = await again.connect(deep('req-deep-3'));
    assert.equal(got.at(-1).code, 'deep_resting');
    assert.equal(again.calls.length, 0);
  });

  await t.test('a provider refusal mid-stream is refunded too', async () => {
    const store = {};
    const lines = [{ type: 'start', mode: 'plain', depth: 'fast', modes: [] }, { type: 'error', code: 'busy', refunded: true, message: 'The model is busy.' }];
    const { connect, send } = bootWorker({ store, streamLines: lines });
    const got = await connect({ type: 'explain', requestId: 'req-busy-1', payload: { selection: 'x' } });
    assert.equal(got.at(-1).code, 'busy');
    assert.equal(got.at(-1).remaining, 30, 'the card is told the refunded count');
    assert.equal((await send({ type: 'usage' })).remaining, 30);
  });
});
