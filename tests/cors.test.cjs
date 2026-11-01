const test = require('node:test');
const assert = require('node:assert/strict');

const { corsHeaders } = require('../.test-build/cors');

const STORE_ID = 'jncoindjikmapfahhnljenbplfboglhf';
const ask = (origin) =>
  corsHeaders(new Request('https://x.test/api/explain', origin ? { headers: { origin } } : {}));
const allowed = (origin) => ask(origin)['Access-Control-Allow-Origin'];

function withEnv(patch, run) {
  const before = { ...process.env };
  Object.assign(process.env, patch);
  try { run(); } finally {
    for (const k of Object.keys(patch)) delete process.env[k];
    Object.assign(process.env, before);
  }
}

test('cors allowlist', async (t) => {
  await t.test('allows the published extension', () => {
    assert.equal(allowed(`chrome-extension://${STORE_ID}`), `chrome-extension://${STORE_ID}`);
  });

  await t.test('refuses a different extension id', () => {
    // Extension ids are public, so trusting the scheme alone trusts everyone.
    assert.equal(allowed('chrome-extension://aaaabbbbccccddddeeeeffffgggghhhh'), undefined);
  });

  await t.test('refuses any website, including vercel.app', () => {
    assert.equal(allowed('https://context-reader.vercel.app'), undefined);
    assert.equal(allowed('https://someone-else.vercel.app'), undefined);
    assert.equal(allowed('https://evil.example.com'), undefined);
  });

  await t.test('allows extra ids named in the environment', () => {
    withEnv({ ALLOWED_EXTENSION_IDS: 'devdevdevdevdevdevdevdevdevdevde' }, () => {
      assert.equal(
        allowed('chrome-extension://devdevdevdevdevdevdevdevdevdevde'),
        'chrome-extension://devdevdevdevdevdevdevdevdevdevde',
      );
      assert.equal(allowed(`chrome-extension://${STORE_ID}`), `chrome-extension://${STORE_ID}`,
        'the store id stays allowed when the env adds more');
    });
  });

  await t.test('allows localhost only in development', () => {
    withEnv({ NODE_ENV: 'development' }, () => {
      assert.equal(allowed('http://localhost:3000'), 'http://localhost:3000');
    });
    withEnv({ NODE_ENV: 'production' }, () => {
      assert.equal(allowed('http://localhost:3000'), undefined);
    });
  });

  await t.test('sends no allow-origin when there is no origin header', () => {
    assert.equal(allowed(undefined), undefined);
  });

  await t.test('always varies on origin, so a reply is not cached for everyone', () => {
    assert.equal(ask('https://evil.example.com').Vary, 'Origin');
  });
});
