/**
 * The streaming reader must produce the same text however the model's reply
 * is cut into chunks, including cuts in the middle of an escape sequence.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { ExplanationStreamer, SseTextReader } = require('../.test-build/stream');

const answer = {
  summary: 'The writer calls the plan "an apology written in advance".',
  sections: [
    { label: 'Their position', body: 'It is useless.\nIt came late, \\ and é too.' },
    { label: 'Tone', body: 'Sardonic: "would not be unfair to say".' },
  ],
};
const raw = JSON.stringify(answer, null, 2);

/** Replays events into the structure a card would build. */
function rebuild(events) {
  const out = { summary: '', sections: [] };
  for (const e of events) {
    if (e.type === 'summary') out.summary += e.text;
    else if (e.type === 'section') out.sections.push({ label: e.label, body: '' });
    else if (e.type === 'delta') out.sections[out.sections.length - 1].body += e.text;
  }
  return out;
}
const plain = (x) => JSON.parse(JSON.stringify(x));

test('the streamed text matches the full reply, whatever the chunk size', () => {
  for (const size of [1, 2, 3, 5, 7, 13, 64, raw.length]) {
    const s = new ExplanationStreamer();
    const events = [];
    for (let i = 0; i < raw.length; i += size) events.push(...s.push(raw.slice(i, i + size)));
    assert.deepEqual(plain(rebuild(events)), answer, `chunk size ${size}`);
  }
});

test('the summary streams before any section, and labels arrive whole', () => {
  const s = new ExplanationStreamer();
  const events = [];
  for (const ch of raw) events.push(...s.push(ch));
  const firstSection = events.findIndex((e) => e.type === 'section');
  assert.ok(events.slice(0, firstSection).every((e) => e.type === 'summary'));
  assert.deepEqual(events.filter((e) => e.type === 'section').map((e) => e.label), ['Their position', 'Tone']);
});

test('a \\u escape split across chunks decodes once', () => {
  const s = new ExplanationStreamer();
  const events = [...s.push('{"summary": "caf\\u00'), ...s.push('e9"}')];
  assert.equal(events.map((e) => e.text).join(''), 'café');
});

test('keys that are not summary, label or body are not streamed', () => {
  const s = new ExplanationStreamer();
  const events = s.push('{"note": "ignore me", "summary": "keep", "sections": []}');
  assert.deepEqual(plain(events), [{ type: 'summary', text: 'keep' }]);
});

test('the SSE reader pulls deltas out of data lines, across partial lines', () => {
  const r = new SseTextReader();
  const line = (t) => `data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`;
  const stream = line('{"summ') + line('ary": "hi"}') + 'data: [DONE]\n\n';
  let text = '';
  for (let i = 0; i < stream.length; i += 9) text += r.push(stream.slice(i, i + 9));
  assert.equal(text, '{"summary": "hi"}');
  assert.equal(r.done, true);
});

test('stalls', async (t) => {
  process.env.PROVIDER_API_KEY ??= 'test-key';
  const { createOpenAICompatibleProvider } = require('../.test-build/provider');
  const sse = (text) => new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`);
  /** A response whose body yields the given chunks, then hangs forever. */
  const hanging = (chunks) => ({
    ok: true, status: 200,
    body: { getReader: () => ({ read: () => (chunks.length ? Promise.resolve({ value: chunks.shift(), done: false }) : new Promise(() => {})) }) },
  });
  const finished = (chunks) => ({
    ok: true, status: 200,
    body: { getReader: () => ({ read: async () => (chunks.length ? { value: chunks.shift(), done: false } : { done: true }) }) },
  });
  // A real stall leaves read() pending; the abort is what ends it, so the fake listens for it.
  const withAbort = (make) => async (_url, init) => {
    const res = make();
    const reader = res.body.getReader();
    return { ...res, body: { getReader: () => ({ read: () => Promise.race([reader.read(), new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))))]) }) } };
  };
  const fast = { stallMs: 30, firstTextMs: { fast: 30, deep: 30 } };

  await t.test('a stall before any text is retried once, quietly', async () => {
    let calls = 0;
    const provider = createOpenAICompatibleProvider({ ...fast, fetchImpl: withAbort(() => (++calls === 1 ? hanging([]) : finished([sse('{"summary":"ok","sections":[]}')]))) });
    const seen = [];
    const raw = await provider.chatStream([], {}, (t) => seen.push(t));
    assert.equal(calls, 2);
    assert.equal(raw, '{"summary":"ok","sections":[]}');
  });

  await t.test('a stall after text has arrived is not retried, and is marked partial', async () => {
    let calls = 0;
    const provider = createOpenAICompatibleProvider({ ...fast, fetchImpl: withAbort(() => { calls++; return hanging([sse('{"summary":"half')]); }) });
    await assert.rejects(provider.chatStream([], {}, () => {}), (e) => e.partial === true && e.status === 504);
    assert.equal(calls, 1);
  });

  await t.test('two stalls in a row give up after the one retry', async () => {
    let calls = 0;
    const provider = createOpenAICompatibleProvider({ ...fast, fetchImpl: withAbort(() => { calls++; return hanging([]); }) });
    await assert.rejects(provider.chatStream([], {}, () => {}), (e) => e.partial === false && e.status === 504);
    assert.equal(calls, 2);
  });
});
