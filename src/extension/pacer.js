/**
 * Reveals an answer at a readable pace. The model writes far faster than anyone
 * reads, so a fast answer lands in half a second and looks pasted, not written.
 * This holds what has arrived and shows it at RATE characters a second: only
 * real received text, in order. Once the answer is complete it speeds up as
 * needed, so the reveal ends at most CAP after that.
 *
 * Plain script, no modules: the extension loads it as a content script ahead
 * of content.js, and Node loads it into a VM with a fake clock for the tests.
 */
(function (root) {
  const RATE = 500, CAP = 800, TICK = 33;
  const SKIP_EVENTS = ['click', 'keydown', 'wheel', 'touchmove', 'scroll'];

  /**
   * `show(op, text)` draws an op, or its next piece. An op with `paced: false`
   * costs no time: a heading has no characters to read, and text going into a
   * collapsed section can't be seen arriving.
   */
  function createPacer({ show, paced = true, now = Date.now, later = setTimeout, stop = clearTimeout }) {
    const queue = [];
    let timer = null, last = 0, credit = 0, deadline = null, whenDone = null, live = true;

    const behind = () => queue.reduce((n, op) => n + (op.paced ? op.text.length : 0), 0);

    function showUpTo(count) {
      while (queue.length) {
        const op = queue[0];
        if (!op.paced) { queue.shift(); show(op, op.text); continue; }
        if (count < 1) return;
        let n = Math.min(count, op.text.length);
        // Never between the two halves of an emoji.
        const code = op.text.charCodeAt(n - 1);
        if (code >= 0xd800 && code <= 0xdbff) n += 1;
        show(op, op.text.slice(0, n));
        count -= n;
        op.text = op.text.slice(n);
        if (!op.text) queue.shift();
      }
    }

    function tick() {
      timer = null;
      const t = now();
      let count = Infinity;
      if (paced && (deadline === null || t < deadline)) {
        // Once complete: whatever speed lands the last character on the deadline, if that beats RATE.
        const rate = deadline === null ? RATE : Math.max(RATE, behind() * 1000 / (deadline - t));
        credit += (t - last) * rate / 1000;
        count = Math.floor(credit);
        credit -= count;
      }
      last = t;
      showUpTo(count);
      if (queue.length) timer = later(tick, deadline === null ? TICK : Math.min(TICK, deadline - t));
      else if (whenDone) { const done = whenDone; whenDone = null; live = false; done(); }
    }

    /** Waiting for text until now: start at once with one tick's worth, not the time spent idle. */
    function wake() {
      if (timer !== null || !live) return;
      last = now() - TICK;
      credit = 0;
      tick();
    }

    return {
      push(op) { if (live) { queue.push({ ...op }); wake(); } },
      /** The answer is complete; `done` runs when the last of it is on screen. */
      end(done) { whenDone = done; deadline = now() + CAP; wake(); },
      /** Everything now, and from now on. */
      skip() {
        paced = false;
        if (timer !== null) { stop(timer); timer = null; }
        if (live) tick();
      },
      /** This answer no longer matters. */
      cancel() {
        live = false;
        whenDone = null;
        queue.length = 0;
        if (timer !== null) { stop(timer); timer = null; }
      },
    };
  }

  /**
   * Touching the card shows everything at once. The pacer is read during the
   * event and skipped just after it: a heading's own click lands first, so it
   * isn't lost when the final text is drawn, and a new answer that the click
   * just asked for keeps its own pacing.
   */
  function skipOnTouch(card, current, later = setTimeout) {
    for (const type of SKIP_EVENTS) {
      card.addEventListener(type, () => { const pacer = current(); later(() => pacer?.skip()); }, { capture: true, passive: true });
    }
  }

  const wantsPacing = (win) => !win.matchMedia('(prefers-reduced-motion: reduce)').matches;

  root.ContextReaderPacer = { RATE, CAP, TICK, SKIP_EVENTS, createPacer, skipOnTouch, wantsPacing };
})(globalThis);
