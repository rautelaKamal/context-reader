/**
 * Quote checking, shared by the card, the eval and the film's saved answers.
 *
 * A quote is a span the answer puts in double quotation marks. It counts only
 * if it has at least three words: one or two words ("strategy", "load and")
 * appear in almost any passage, so finding them proves nothing. A counted
 * quote is verified when the same words appear, in order, in the text that was
 * actually sent: the selection and its surrounding paragraphs. Case, curly
 * versus straight quotation marks and runs of spaces are ignored; anything
 * else, including a single changed word, makes it unverified.
 *
 * Plain script, no modules: the extension loads it as a content script ahead
 * of content.js, and Node loads it into a VM for the tests and the eval.
 */
(function (root) {
  const MIN_WORDS = 3;

  // Apostrophes are dropped rather than unified, so "ruin'd" and "ruin’d" match.
  const norm = (t) => t.toLowerCase().replace(/[‘’“”"'«»]/g, '').replace(/\s+/g, ' ').trim();

  // Punctuation and spaces at the edge of a quote belong to the answer's
  // sentence, not to the passage, and are never highlighted.
  const EDGE = /^[\s.,;:!?…—–-]+|[\s.,;:!?…—–-]+$/g;
  const trimEdge = (t) => t.replace(EDGE, '');
  const wordCount = (t) => trimEdge(t).split(/\s+/).filter(Boolean).length;

  /**
   * Every double-quoted span in `text`, as the trimmed words plus their
   * position, so a caller can highlight exactly those characters.
   */
  function findQuotes(text) {
    const found = [];
    for (const m of String(text).matchAll(/["“]([^"“”]{2,300})["”]/g)) {
      const inner = m[1];
      const lead = inner.length - inner.replace(/^[\s.,;:!?…—–-]+/, '').length;
      const words = trimEdge(inner);
      if (!words) continue;
      const start = m.index + 1 + lead;
      found.push({ text: words, start, end: start + words.length });
    }
    return found;
  }

  /** The text the answer may quote from, joined the way it was sent. */
  function sentText(context) {
    if (!context) return '';
    return [context.precedingParagraph, context.markedParagraph, context.selection]
      .filter(Boolean).join(' ');
  }

  /** Each quote in `text`, with whether it counts (3+ words) and whether it is verified. */
  function checkQuotes(text, sent) {
    const source = norm(sent);
    return findQuotes(text).map((q) => {
      const counts = wordCount(q.text) >= MIN_WORDS;
      return { ...q, counts, verified: counts && source.includes(norm(q.text)) };
    });
  }

  /** Counted and verified quotes across a whole answer: the summary and every section body. */
  function answerStats(answer, sent) {
    const parts = [answer?.summary, ...(answer?.sections ?? []).map((s) => s.body)].filter(Boolean);
    let counted = 0, verified = 0;
    for (const part of parts) {
      for (const q of checkQuotes(part, sent)) {
        if (!q.counts) continue;
        counted += 1;
        if (q.verified) verified += 1;
      }
    }
    return { counted, verified };
  }

  root.ContextReaderQuotes = { MIN_WORDS, norm, trimEdge, wordCount, findQuotes, sentText, checkQuotes, answerStats };
})(globalThis);
