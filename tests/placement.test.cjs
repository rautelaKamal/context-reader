/**
 * The card placement arithmetic. Loaded the way the extension loads it, as a
 * plain script, so these test the file that ships.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const sandbox = {};
vm.runInNewContext(readFileSync(join(__dirname, '..', 'src', 'extension', 'placement.js'), 'utf8'), { globalThis: sandbox });
const { placeCard, EDGE, GAP } = sandbox.ContextReaderPlacement;
const place = (viewportHeight, rectTop, rectBottom) => placeCard({ viewportHeight, rectTop, rectBottom });

const onScreen = (viewportHeight, p) => {
  assert.ok(p.top >= EDGE - 0.001, `top ${p.top} is off the screen`);
  assert.ok(p.top + p.maxHeight <= viewportHeight - EDGE + 0.001, `bottom ${p.top + p.maxHeight} is off the screen`);
};

test('the tallest card goes below when it fits there', () => {
  assert.deepEqual({ ...place(1000, 40, 100) }, { side: 'below', top: 100 + GAP, maxHeight: 700 });
});

test('a selection at the very top goes below', () => {
  const p = place(800, 0, 40);
  assert.equal(p.side, 'below');
  assert.equal(p.maxHeight, 560);
  onScreen(800, p);
});

test('a selection at the very bottom goes above, ending just over the selection', () => {
  const p = place(800, 700, 790);
  assert.equal(p.side, 'above');
  assert.equal(p.maxHeight, 560);
  assert.equal(p.top + p.maxHeight, 700 - GAP);
  onScreen(800, p);
});

test('when neither side fits the tallest card, the larger side wins and caps the card', () => {
  const below = place(800, 200, 300);
  assert.equal(below.side, 'below');
  assert.equal(below.maxHeight, 800 - 300 - GAP - EDGE);
  onScreen(800, below);

  const above = place(800, 500, 600);
  assert.equal(above.side, 'above');
  assert.equal(above.maxHeight, 500 - GAP - EDGE);
  onScreen(800, above);
});

test('equal room on both sides goes below', () => {
  assert.equal(place(800, 300, 500).side, 'below');
});

test('exactly the minimum room is enough; just under it pins', () => {
  assert.equal(place(800, 0, 800 - 260 - GAP - EDGE).side, 'below');
  assert.equal(place(800, 200, 800 - 259 - GAP - EDGE).side, 'pinned');
});

test('a big selection in the middle pins to the bottom, capped at 400px', () => {
  const p = place(800, 200, 600);
  assert.equal(p.side, 'pinned');
  assert.equal(p.maxHeight, 400);
  assert.equal(p.top + p.maxHeight, 800 - EDGE);
});

test('a pinned card is 70% of a window where that is under 400px', () => {
  assert.equal(place(500, 150, 350).maxHeight, 350);
});

test('a pinned card never goes under 260px while the window has room', () => {
  const p = place(320, 100, 220);
  assert.equal(p.side, 'pinned');
  assert.equal(p.maxHeight, 260);
  onScreen(320, p);
});

test('a window shorter than the minimum gets all the height it has', () => {
  const p = place(200, 60, 140);
  assert.equal(p.side, 'pinned');
  assert.equal(p.maxHeight, 200 - 2 * EDGE);
  onScreen(200, p);
});

test('on a short window the tallest card can still fit a side under 260px', () => {
  const p = place(300, 10, 40);
  assert.equal(p.side, 'below');
  assert.equal(p.maxHeight, 210);
  onScreen(300, p);
});

test('a selection larger than the screen pins', () => {
  assert.equal(place(800, -300, 1500).side, 'pinned');
});

test('a selection scrolled off the screen still lands on it', () => {
  onScreen(800, place(800, -500, -300));
  onScreen(800, place(800, 1200, 1400));
});

test('the tallest card stops at 700px on a very tall window', () => {
  assert.equal(place(2000, 10, 50).maxHeight, 700);
});

test('every position in a sweep stays on the screen', () => {
  for (const vh of [200, 320, 420, 600, 800, 1080, 1440]) {
    for (let top = -200; top < vh + 100; top += 37) {
      for (const size of [20, 90, 250, 500, 1200]) onScreen(vh, place(vh, top, top + size));
    }
  }
});
