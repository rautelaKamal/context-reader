/**
 * Where the answer card goes, as plain arithmetic: viewport height and the
 * selection's top and bottom in, side, top and maximum height out.
 *
 * The card is never taller than the room it's given, so it never runs off the
 * screen and the reader never has to scroll the page to see it. Its body
 * scrolls inside it instead. `top` is relative to the viewport.
 *
 * Plain script, no modules: the extension loads it as a content script ahead
 * of content.js, and Node loads it into a VM for the tests.
 */
(function (root) {
  const GAP = 10; // Between the selection and the card.
  const EDGE = 8; // Between the card and the edge of the viewport.
  const MIN_SIDE = 260; // A side with less room than this is too small to read in.
  const PIN_CAP = 400; // A pinned card overlaps the selection, so it stays modest.

  const tallestCard = (viewportHeight) => Math.min(viewportHeight * 0.7, 700);

  function placeCard({ viewportHeight, rectTop, rectBottom }) {
    const tallest = tallestCard(viewportHeight);
    // A selection can reach past the screen; only the part on screen takes up room.
    const top = Math.min(Math.max(rectTop, 0), viewportHeight);
    const bottom = Math.min(Math.max(rectBottom, 0), viewportHeight);
    const below = viewportHeight - bottom - GAP - EDGE;
    const above = top - GAP - EDGE;

    const placeBelow = (maxHeight) => ({ side: 'below', top: bottom + GAP, maxHeight });
    const placeAbove = (maxHeight) => ({ side: 'above', top: top - GAP - maxHeight, maxHeight });

    if (below >= tallest) return placeBelow(tallest);
    if (above >= tallest) return placeAbove(tallest);
    if (Math.max(below, above) >= MIN_SIDE) return below >= above ? placeBelow(below) : placeAbove(above);

    const maxHeight = Math.min(Math.max(Math.min(PIN_CAP, viewportHeight * 0.7), MIN_SIDE), viewportHeight - 2 * EDGE);
    return { side: 'pinned', top: viewportHeight - EDGE - maxHeight, maxHeight };
  }

  root.ContextReaderPlacement = { GAP, EDGE, MIN_SIDE, PIN_CAP, tallestCard, placeCard };
})(globalThis);
