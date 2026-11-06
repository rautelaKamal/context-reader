/**
 * The reveal's timing, on a fake clock. Loaded the way the extension loads it,
 * as a plain script, so these test the file that ships.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const sandbox = {};
vm.runInNewContext(readFileSync(join(__dirname, '..', 'src', 'extension', 'pacer.js'), 'utf8'), { globalThis: sandbox });
const { RATE, CAP, SKIP_EVENTS, createPacer, skipOnTouch, wantsPacing } = sandbox.ContextReaderPacer;

/** A clock that only moves when told, and timers that can run late. */
function fakeClock() {
  let t = 0, timers = [], id = 0;
  const clock = {
    now: () => t,
    later: (fn, ms = 0) => { timers.push({ id: ++id, at: t + ms, fn }); return id; },
    stop: (i) => { timers = timers.filter((x) => x.id !== i); },
    pending: () => timers.length,
    advance(ms, lateBy = 0) {
      const end = t + ms;
      for (;;) {
        const next = timers.filter((x) => x.at + lateBy <= end).sort((a, b) => a.at - b.at)[0];
        if (!next) break;
        timers = timers.filter((x) => x !== next);
        t = Math.max(t, next.at + lateBy);
        next.fn();
      }
      t = end;
    },
  };
  return clock;
}

/** A pacer on a fake clock, recording what was shown and when. */
function setup(options = {}) {
  const clock = fakeClock();
  const shown = [];
  const pacer = createPacer({
    now: clock.now, later: clock.later, stop: clock.stop,
    show: (op, text) => shown.push({ at: clock.now(), kind: op.kind, text }),
    ...options,
  });
  const text = () => shown.map((s) => s.text).join('');
  return { clock, shown, pacer, text };
}
const piece = (text, paced = true) => ({ kind: 'text', text, paced });
const letters = (n) => 'x'.repeat(n);

test('text is revealed at about 500 characters a second', () => {
  const { clock, pacer, text } = setup();
  pacer.push(piece(letters(5000)));
  clock.advance(1000);
  assert.ok(Math.abs(text().length - RATE) <= 30, `${text().length} characters after one second`);
  clock.advance(1000);
  assert.ok(Math.abs(text().length - 2 * RATE) <= 30, `${text().length} characters after two seconds`);
});

test('the first text appears at once, with no added wait', () => {
  const { pacer, shown } = setup();
  pacer.push(piece(letters(1000)));
  assert.equal(shown.length, 1);
  assert.ok(shown[0].text.length > 0);
});

test('everything received is shown, unchanged and in order', () => {
  const { clock, pacer, shown } = setup();
  pacer.push({ kind: 'summary', text: 'The summary. ', paced: true });
  pacer.push({ kind: 'section', text: '', paced: false });
  pacer.push({ kind: 'delta', text: 'First section. ', paced: true });
  pacer.push({ kind: 'section', text: '', paced: false });
  pacer.push({ kind: 'delta', text: 'Second section.', paced: true });
  clock.advance(5000);
  assert.deepEqual(shown.map((s) => s.kind).filter((k, i, all) => k !== all[i - 1]), ['summary', 'section', 'delta', 'section', 'delta']);
  assert.equal(shown.map((s) => s.text).join(''), 'The summary. First section. Second section.');
});

test('text going into a collapsed section takes no time', () => {
  const { clock, pacer, text } = setup();
  pacer.push(piece('open'));
  pacer.push(piece(letters(2000), false));
  pacer.push(piece('next'));
  clock.advance(100);
  assert.equal(text(), `open${letters(2000)}next`);
});

test('an emoji is never split in two', () => {
  const { clock, pacer, shown } = setup();
  pacer.push(piece('🙂'.repeat(400)));
  clock.advance(5000);
  assert.equal(shown.map((s) => s.text).join(''), '🙂'.repeat(400));
  for (const { text } of shown) assert.equal(text.length % 2, 0, 'a piece ended between the halves of an emoji');
});

test('after a stall, new text starts at once and at the same pace, with no saved-up burst', () => {
  const { clock, pacer, shown, text } = setup();
  pacer.push(piece(letters(50)));
  clock.advance(1700);
  assert.equal(text().length, 50);
  const before = shown.length;
  pacer.push(piece(letters(1000)));
  assert.equal(shown.length, before + 1, 'nothing appeared when the text arrived');
  assert.ok(shown[before].text.length <= 20, `a burst of ${shown[before].text.length}`);
  clock.advance(1000);
  assert.ok(Math.abs(text().length - 50 - RATE) <= 30, `${text().length - 50} characters in the second after the stall`);
});

test('the finish cap: never more than 800ms after done, however much is behind', () => {
  for (const size of [1, 10, 100, 300, 399, 400, 401, 600, 1000, 3000, 20000, 200000]) {
    const { clock, pacer, shown, text } = setup();
    let finished = null;
    pacer.push(piece(letters(size)));
    clock.advance(50);
    const doneAt = clock.now();
    pacer.end(() => { finished = clock.now(); });
    clock.advance(CAP);
    assert.equal(text().length, size, `size ${size}: text left over at the cap`);
    assert.ok(finished !== null && finished <= doneAt + CAP, `size ${size}: finished at +${finished - doneAt}ms`);
    assert.ok(shown.at(-1).at <= doneAt + CAP, `size ${size}: text shown after the cap`);
  }
});

test('the finish cap holds when the browser runs the timers late', () => {
  const { clock, pacer, text } = setup();
  let finished = null;
  pacer.push(piece(letters(5000)));
  const doneAt = clock.now();
  pacer.end(() => { finished = clock.now(); });
  // A hidden tab: timers run a second late, and the first one after the cap shows the rest.
  clock.advance(1100, 1000);
  assert.equal(text().length, 5000);
  assert.ok(finished <= doneAt + 1033 + 1000);
});

test('catching up is steady, with no jump at the very end', () => {
  const { clock, pacer, shown } = setup();
  pacer.push(piece(letters(1600)));
  pacer.end(() => {});
  clock.advance(CAP);
  const fair = 1600 / (CAP / 33);
  for (const { text } of shown) assert.ok(text.length <= 2 * fair, `a piece of ${text.length}, against a fair share of ${fair}`);
});

test('a short answer keeps 500 a second after done, with no rush', () => {
  const { clock, pacer, text } = setup();
  let finished = null;
  pacer.push(piece(letters(200)));
  pacer.end(() => { finished = clock.now(); });
  clock.advance(200);
  assert.ok(text().length <= 200 - 50 + 33, `${text().length} shown after 200ms`);
  assert.equal(finished, null);
  clock.advance(CAP);
  assert.ok(finished >= 300 && finished <= 420, `finished at ${finished}ms`);
});

test('the footer and yellow line wait for the reveal, not for done', () => {
  const { clock, pacer, text } = setup();
  let finished = 0;
  pacer.push(piece(letters(300)));
  pacer.end(() => { finished += 1; });
  assert.equal(finished, 0, 'ran when done arrived');
  clock.advance(100);
  assert.equal(finished, 0, 'ran with text still to show');
  clock.advance(CAP);
  assert.equal(text().length, 300);
  assert.equal(finished, 1);
});

test('done with nothing left to show runs straight away', () => {
  const { pacer } = setup();
  let finished = 0;
  pacer.end(() => { finished += 1; });
  assert.equal(finished, 1);
});

test('nothing stays scheduled once the reveal has finished', () => {
  const { clock, pacer } = setup();
  pacer.push(piece(letters(300)));
  pacer.end(() => {});
  clock.advance(CAP);
  assert.equal(clock.pending(), 0);
});

test('skip after done shows everything and finishes at once, only once', () => {
  const { clock, pacer, text } = setup();
  let finished = 0;
  pacer.push(piece(letters(3000)));
  pacer.end(() => { finished += 1; });
  clock.advance(100);
  pacer.skip();
  assert.equal(text().length, 3000);
  assert.equal(finished, 1);
  pacer.skip();
  clock.advance(5000);
  assert.equal(finished, 1);
  assert.equal(clock.pending(), 0);
});

test('skip before done shows what has arrived, and later text straight away', () => {
  const { clock, pacer, text } = setup();
  let finished = 0;
  pacer.push(piece(letters(3000)));
  pacer.skip();
  assert.equal(text().length, 3000);
  pacer.push(piece('more'));
  assert.equal(text().length, 3004);
  assert.equal(finished, 0);
  pacer.end(() => { finished += 1; });
  assert.equal(finished, 1);
  assert.equal(clock.pending(), 0);
});

for (const type of SKIP_EVENTS) {
  test(`a ${type} inside the card shows everything, just after the event`, () => {
    const { clock, pacer, text } = setup();
    const card = new EventTarget();
    skipOnTouch(card, () => pacer, clock.later);
    pacer.push(piece(letters(3000)));
    const before = text().length;
    card.dispatchEvent(new Event(type));
    assert.equal(text().length, before, 'skipped during the event, before its own handler ran');
    clock.advance(0);
    assert.equal(text().length, 3000);
  });
}

test('skipOnTouch watches clicks, keys and each way of scrolling', () => {
  assert.deepEqual([...SKIP_EVENTS].sort(), ['click', 'keydown', 'scroll', 'touchmove', 'wheel']);
});

test('a click that asks for a new answer leaves the new answer paced', () => {
  const first = setup();
  const second = setup();
  let current = first.pacer;
  const card = new EventTarget();
  skipOnTouch(card, () => current, first.clock.later);
  // The button's own handler, as Go deeper's: it starts the next answer.
  card.addEventListener('click', () => { first.pacer.cancel(); current = second.pacer; });
  card.dispatchEvent(new Event('click'));
  second.pacer.push(piece(letters(3000)));
  first.clock.advance(0);
  assert.ok(second.text().length < 100, `${second.text().length} characters shown at once`);
});

test('reduced motion: no pacing at all', () => {
  const { pacer, text, clock } = setup({ paced: false });
  let finished = 0;
  pacer.push(piece(letters(5000)));
  assert.equal(text().length, 5000);
  pacer.push(piece('more'));
  assert.equal(text().length, 5004);
  pacer.end(() => { finished += 1; });
  assert.equal(finished, 1);
  assert.equal(clock.pending(), 0);
});

test('wantsPacing follows the reader\'s reduced motion setting', () => {
  const windowWith = (reduce) => ({
    matchMedia: (query) => {
      assert.equal(query, '(prefers-reduced-motion: reduce)');
      return { matches: reduce };
    },
  });
  assert.equal(wantsPacing(windowWith(true)), false);
  assert.equal(wantsPacing(windowWith(false)), true);
});

test('cancel stops everything: no more text, and done never runs', () => {
  const { clock, pacer, shown } = setup();
  let finished = 0;
  pacer.push(piece(letters(3000)));
  pacer.end(() => { finished += 1; });
  const before = shown.length;
  pacer.cancel();
  pacer.push(piece('late'));
  pacer.skip();
  clock.advance(5000);
  assert.equal(shown.length, before);
  assert.equal(finished, 0);
  assert.equal(clock.pending(), 0);
});
