const test = require('node:test');
const assert = require('node:assert/strict');

const { detectMode } = require('../.test-build/modes');
const { parseExplanation } = require('../.test-build/prompts');
const { parseContext } = require('../.test-build/context');
const { checkRateLimit } = require('../.test-build/ratelimit');

test('mode detection', async (t) => {
  await t.test('reads a Shakespeare sonnet as verse', () => {
    // The first two lines end in "?" and ":" - the case that made an earlier
    // version of this heuristic classify the sonnet as prose.
    assert.equal(detectMode({ selection: [
      "Shall I compare thee to a summer's day?",
      'Thou art more lovely and more temperate:',
      'Rough winds do shake the darling buds of May,',
      "And summer's lease hath all too short a date",
    ].join('\n') }), 'lines');
  });

  await t.test('reads free verse as verse', () => {
    assert.equal(detectMode({ selection:
      'The apparition of these faces in the crowd;\nPetals on a wet, black bough' }), 'lines');
  });

  await t.test('reads an editorial as argument', () => {
    assert.equal(detectMode({
      selection: 'The government would do well to reconsider its position.',
      url: 'https://www.thehindu.com/opinion/lead/federal-balance/article1.ece',
    }), 'point');
  });

  await t.test('reads a letters page as argument', () => {
    assert.equal(detectMode({
      selection: 'Sir, the editorial of June 3 was wide of the mark.',
      url: 'https://www.thehindu.com/opinion/letters/june-04-2026/article9.ece',
    }), 'point');
  });

  await t.test('reads a paper as jargon', () => {
    assert.equal(detectMode({
      selection: 'We introduce a sparse mixture-of-experts layer with top-k routing.',
      url: 'https://arxiv.org/abs/2401.00001',
    }), 'jargon');
  });

  await t.test('falls back to plain meaning', () => {
    assert.equal(detectMode({
      selection: 'The committee met on Tuesday and postponed the decision.',
      url: 'https://example.com/news/story',
    }), 'plain');
  });

  await t.test('does not mistake hard-wrapped prose for verse', () => {
    assert.equal(detectMode({ selection:
      'The first consideration is cost, which remains prohibitive for most institutions.\n' +
      'The second is capacity, which has not kept pace with demand over the decade.' }), 'plain');
  });

  await t.test('does not mistake a bulleted list for verse', () => {
    assert.equal(detectMode({ selection:
      '- capital adequacy\n- asset quality\n- management soundness\n- earnings' }), 'plain');
  });
});

test('model output parsing', async (t) => {
  await t.test('unwraps a fenced block', () => {
    assert.deepEqual(
      parseExplanation('```json\n{"summary":"a","sections":[{"label":"L","body":"B"}]}\n```'),
      { summary: 'a', sections: [{ label: 'L', body: 'B' }] });
  });

  await t.test('ignores chatter after the object', () => {
    assert.deepEqual(parseExplanation('{"summary":"a","sections":[]}\nHope this helps!'),
      { summary: 'a', sections: [] });
  });

  await t.test('handles braces inside strings', () => {
    assert.deepEqual(parseExplanation('{"summary":"use {x} notation","sections":[]}'),
      { summary: 'use {x} notation', sections: [] });
  });

  await t.test('handles escaped quotes', () => {
    assert.deepEqual(parseExplanation('{"summary":"he said \\"no\\"","sections":[]}'),
      { summary: 'he said "no"', sections: [] });
  });

  await t.test('returns null for prose', () => {
    assert.equal(parseExplanation('This passage means the writer is unhappy.'), null);
  });

  await t.test('salvages a reply truncated mid-string', () => {
    // What a real article produced when it ran past the token ceiling.
    const truncated = '{\n "summary": "India will struggle to attract investment.",\n' +
      ' "sections": [\n  {\n   "label": "Their position",\n' +
      '   "body": "Because Western governments are paying high interest rates to';
    const result = parseExplanation(truncated);
    assert.equal(result.summary, 'India will struggle to attract investment.');
    assert.equal(result.sections.length, 0); // the incomplete one is dropped
  });

  await t.test('keeps whole sections from a truncated reply', () => {
    const truncated = '{"summary":"S","sections":[{"label":"A","body":"one"},' +
      '{"label":"B","body":"two"},{"label":"C","body":"thr';
    const result = parseExplanation(truncated);
    assert.equal(result.summary, 'S');
    assert.deepEqual(result.sections, [{ label: 'A', body: 'one' }, { label: 'B', body: 'two' }]);
  });

  await t.test('unescapes correctly when salvaging', () => {
    const truncated = '{"summary":"he said \\"no\\" and left","sections":[{"label":"A","body":"x';
    assert.equal(parseExplanation(truncated).summary, 'he said "no" and left');
  });

  await t.test('drops sections missing a body', () => {
    assert.deepEqual(
      parseExplanation('{"summary":"a","sections":[{"label":"L"},{"label":"M","body":"B"}]}'),
      { summary: 'a', sections: [{ label: 'M', body: 'B' }] });
  });
});

test('request parsing', async (t) => {
  await t.test('preserves verse line breaks', () => {
    assert.equal(parseContext({ selection: 'line one\nline two\nline three' }).selection,
      'line one\nline two\nline three');
  });

  await t.test('accepts the legacy text field', () => {
    assert.equal(parseContext({ text: 'hello there' }).selection, 'hello there');
  });

  await t.test('derives the site from the url', () => {
    assert.equal(parseContext({ selection: 'x', url: 'https://www.thehindu.com/opinion/a' }).site,
      'thehindu.com');
  });

  await t.test('collapses runs of spaces', () => {
    assert.equal(parseContext({ selection: 'too    many     spaces' }).selection, 'too many spaces');
  });

  await t.test('rejects an empty selection', () => {
    assert.throws(() => parseContext({ selection: '   ' }));
  });

  await t.test('truncates an oversized selection', () => {
    assert.equal(parseContext({ selection: 'x'.repeat(5000) }).selection.length, 2000);
  });
});

test('rate limiting', async (t) => {
  const now = Date.now();

  await t.test('blocks past the window allowance', () => {
    let last;
    for (let i = 0; i < 21; i++) last = checkRateLimit('1.2.3.4', now);
    assert.equal(last.ok, false);
  });

  await t.test('tracks clients separately', () => {
    assert.equal(checkRateLimit('5.6.7.8', now).ok, true);
  });

  await t.test('resets after the window', () => {
    assert.equal(checkRateLimit('1.2.3.4', now + 61_000).ok, true);
  });
});
