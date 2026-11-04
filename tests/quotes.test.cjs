/**
 * The quote rules the card and the eval share. Loaded the way the extension
 * loads it, as a plain script, so these test the file that ships.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const sandbox = {};
vm.runInNewContext(readFileSync(join(__dirname, '..', 'src', 'extension', 'quotes.js'), 'utf8'), { globalThis: sandbox });
const Q = sandbox.ContextReaderQuotes;
// Values made inside the VM carry its own prototypes, so compare plain copies.
const plain = (x) => JSON.parse(JSON.stringify(x));

const SENT = 'The new heat action plan is, on paper, admirable. It would not be unfair to say that a plan announced in June, for a heatwave that began in April, is less a strategy than an apology written in advance.';

test('a quote of three or more words that appears in the passage is verified', () => {
  const [q] = Q.checkQuotes('calling it "an apology written in advance" instead', SENT);
  assert.equal(q.counts, true);
  assert.equal(q.verified, true);
});

test('one- and two-word quotes never count, even when they appear in the passage', () => {
  const quotes = Q.checkQuotes('rather than a "strategy", or "on paper"', SENT);
  assert.deepEqual(plain(quotes.map((q) => [q.text, q.counts, q.verified])), [['strategy', false, false], ['on paper', false, false]]);
});

test('exactly three words is the threshold', () => {
  assert.equal(Q.checkQuotes('"less a strategy"', SENT)[0].counts, true);
  assert.equal(Q.checkQuotes('"a strategy"', SENT)[0].counts, false);
});

test('a changed word makes a quote unverified', () => {
  const [q] = Q.checkQuotes('it is "an apology written in arrears"', SENT);
  assert.equal(q.counts, true);
  assert.equal(q.verified, false);
});

test('case, curly quotation marks and spacing are ignored', () => {
  assert.equal(Q.checkQuotes('“It  would not be UNFAIR to say”', SENT)[0].verified, true);
});

test('apostrophes match whether straight or curly', () => {
  const verse = 'Bare ruin’d choirs, where late the sweet birds sang.';
  assert.equal(Q.checkQuotes('"Bare ruin\'d choirs, where late"', verse)[0].verified, true);
});

test('leading and trailing punctuation and spaces are trimmed from the highlighted span', () => {
  const text = 'was "announced in June, for a heatwave that began in April." and so';
  const [q] = Q.findQuotes(text);
  assert.equal(q.text, 'announced in June, for a heatwave that began in April');
  assert.equal(text.slice(q.start, q.end), q.text);
  assert.equal(Q.checkQuotes(text, SENT)[0].verified, true);
});

test('leading punctuation is trimmed too, and positions still line up', () => {
  const text = 'it says " ... would not be unfair to say," here';
  const [q] = Q.findQuotes(text);
  assert.equal(text.slice(q.start, q.end), 'would not be unfair to say');
});

test('a quote that is only punctuation is ignored', () => {
  assert.deepEqual(plain(Q.findQuotes('a "..." b')), []);
});

test('answer stats count only 3+ word quotes, in the summary and every section', () => {
  const answer = {
    summary: 'A "useless cover-up" that is "less a strategy than an apology".',
    sections: [
      { label: 'Tone', body: 'Dry: "would not be unfair to say" and "a strategy".' },
      { label: 'Made up', body: 'It calls the plan "a work of genius".' },
    ],
  };
  // "useless cover-up" and "a strategy" are too short to count.
  assert.deepEqual(plain(Q.answerStats(answer, SENT)), { counted: 3, verified: 2 });
});

test('the sent text joins the paragraphs the extension sends', () => {
  const sent = Q.sentText({ precedingParagraph: 'Before.', markedParagraph: 'Here «it is».', selection: 'it is' });
  assert.equal(Q.checkQuotes('"Before. Here it"', sent)[0].verified, true);
});
