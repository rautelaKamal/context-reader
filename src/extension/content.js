/**
 * ContextReader content script.
 *
 * Two rules shape this file:
 *   1. Never interrupt. Selecting text is something people do while reading;
 *      it is not a request. We show a small affordance and wait to be asked.
 *   2. Never explain a passage without its surroundings. The selection alone
 *      is not enough to say what a line of verse means or what an editorial
 *      is arguing against, so we send the enclosing paragraph too.
 */

(() => {
  if (window.__contextReaderLoaded) return;
  window.__contextReaderLoaded = true;

  const MAX_SELECTION = 2000;
  const BLOCK_TAGS = new Set([
    'P', 'LI', 'BLOCKQUOTE', 'PRE', 'TD', 'DD', 'DT', 'FIGCAPTION',
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'ARTICLE', 'SECTION', 'DIV',
  ]);

  const STYLES = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .trigger {
      position: absolute; z-index: 2147483647;
      display: flex; align-items: center; gap: 6px;
      padding: 6px 10px; border: none; border-radius: 999px;
      font: 500 12px/1 ui-sans-serif, system-ui, -apple-system, sans-serif;
      color: #fff; background: #1c1917;
      box-shadow: 0 2px 12px rgba(0,0,0,.28);
      cursor: pointer; opacity: 0; transform: translateY(4px);
      transition: opacity .12s ease, transform .12s ease;
    }
    .trigger.show { opacity: 1; transform: translateY(0); }
    .trigger:hover { background: #292524; }
    .trigger kbd {
      font: 500 10px/1 ui-monospace, monospace; opacity: .6;
      border: 1px solid rgba(255,255,255,.3); border-radius: 3px; padding: 2px 4px;
    }
    .card {
      position: absolute; z-index: 2147483647;
      width: min(420px, calc(100vw - 32px));
      max-height: min(60vh, 520px); overflow-y: auto;
      background: #fffdf9; color: #1c1917;
      border: 1px solid #e7e5e4; border-radius: 12px;
      box-shadow: 0 8px 40px rgba(0,0,0,.18);
      font: 14px/1.55 ui-sans-serif, system-ui, -apple-system, sans-serif;
    }
    .modes {
      display: flex; gap: 6px; flex-wrap: wrap;
      padding: 10px 12px; border-bottom: 1px solid #e7e5e4;
      position: sticky; top: 0; background: inherit;
    }
    .chip {
      font: 500 11.5px/1 inherit; padding: 5px 9px; cursor: pointer;
      border: 1px solid #e7e5e4; border-radius: 999px;
      background: #f5f5f4; color: #57534e;
    }
    .chip[aria-pressed="true"] { background: #1c1917; color: #fff; border-color: #1c1917; }
    /* The mode is decided from the passage server-side, so for the first second
       none of the chips is the active one. Dim the row rather than let it read
       as "nothing is selected". */
    .modes.pending .chip { opacity: .45; }
    .body { padding: 12px 14px 4px; }
    .summary { margin: 0 0 12px; font-size: 14.5px; }
    .section { margin: 0 0 12px; }
    .label {
      margin: 0 0 3px; font-size: 11px; font-weight: 600;
      letter-spacing: .04em; text-transform: uppercase; color: #78716c;
    }
    .line { font-style: italic; text-transform: none; letter-spacing: 0; font-size: 12.5px; }
    .text { margin: 0; white-space: pre-wrap; }
    /* The summary carries both classes, and .text is defined after .summary,
       so its margin has to be restored at a specificity that wins. */
    .summary.text { margin-bottom: 14px; }
    .foot {
      display: flex; justify-content: space-between; align-items: center;
      padding: 8px 14px; border-top: 1px solid #e7e5e4;
      font-size: 11.5px; color: #78716c;
    }
    .foot button {
      font: inherit; color: inherit; background: none;
      border: none; cursor: pointer; text-decoration: underline;
    }
    .foot button[disabled] { opacity: .4; cursor: default; text-decoration: none; }
    .foot .spacer { flex: 1; }
    .deep { margin-right: 12px; }
    .spinner {
      width: 14px; height: 14px; border-radius: 50%;
      border: 2px solid currentColor; border-right-color: transparent;
      animation: spin .6s linear infinite; opacity: .5;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .status { display: flex; align-items: center; gap: 8px; padding: 16px 14px; color: #78716c; }
    .error { padding: 14px; color: #b91c1c; }
    .retry {
      font: inherit; color: inherit; background: none; border: none;
      cursor: pointer; text-decoration: underline; padding: 0;
    }

    /* Must come after every base rule: these override at equal specificity,
       so declaration order is what decides. Sitting above them meant the
       inactive chips took the light styling and the active one vanished. */
    @media (prefers-color-scheme: dark) {
      .card { background: #1c1917; color: #f5f5f4; border-color: #44403c; }
      .modes { border-color: #44403c; }
      .chip { background: #292524; color: #d6d3d1; border-color: #44403c; }
      .chip[aria-pressed="true"] { background: #f5f5f4; color: #1c1917; }
      .label { color: #a8a29e; }
      .foot { border-color: #44403c; color: #a8a29e; }
    }
  `;

  /** Text content with line structure preserved - verse depends on it. */
  function textWithBreaks(node) {
    let out = '';
    const walk = (n) => {
      if (n.nodeType === Node.TEXT_NODE) {
        out += n.nodeValue.replace(/[ \t]+/g, ' ');
        return;
      }
      // Range.cloneContents() hands back a DocumentFragment, so containers
      // that are not elements still need their children walked - otherwise
      // every extracted paragraph comes back empty.
      if (n.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
        n.childNodes.forEach(walk);
        return;
      }
      if (n.nodeType !== Node.ELEMENT_NODE) return;
      const tag = n.tagName;
      if (tag === 'BR') { out += '\n'; return; }
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return;

      const isBlock = BLOCK_TAGS.has(tag);
      if (isBlock && out && !out.endsWith('\n')) out += '\n';
      n.childNodes.forEach(walk);
      if (isBlock && out && !out.endsWith('\n')) out += '\n';
    };
    walk(node);
    return out.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').trim();
  }

  function blockAncestor(node) {
    let el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    let best = null;
    while (el && el !== document.body) {
      if (BLOCK_TAGS.has(el.tagName)) {
        best = el;
        // A paragraph-level block is the right unit; stop climbing at one
        // unless it is a bare DIV, which is usually just a wrapper.
        if (el.tagName !== 'DIV' && el.tagName !== 'SECTION' && el.tagName !== 'ARTICLE') break;
        if (textWithBreaks(el).length > 40) break;
      }
      el = el.parentElement;
    }
    return best;
  }

  function previousBlockText(block) {
    let el = block?.previousElementSibling;
    while (el) {
      if (!['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) {
        const text = textWithBreaks(el);
        if (text.length > 20) return text.slice(0, 4000);
      }
      el = el.previousElementSibling;
    }
    return undefined;
  }

  /**
   * Rebuild the paragraph with the selection marked, using range boundaries
   * rather than string matching so repeated phrases mark the right one.
   */
  function markedParagraph(range, block) {
    if (!block || !block.contains(range.commonAncestorContainer)) return undefined;
    try {
      const scope = document.createRange();
      scope.selectNodeContents(block);

      const before = scope.cloneRange();
      before.setEnd(range.startContainer, range.startOffset);

      const after = scope.cloneRange();
      after.setStart(range.endContainer, range.endOffset);

      const head = textWithBreaks(before.cloneContents());
      const tail = textWithBreaks(after.cloneContents());
      const middle = textWithBreaks(range.cloneContents());

      // Only pad the seams where a space belongs: a tail starting with
      // punctuation should stay glued to the marked text.
      const lead = head ? (/[\s]$/.test(head) ? '' : ' ') : '';
      const trail = tail && !/^[\s,.;:!?)\]»'"]/.test(tail) ? ' ' : '';
      return `${head}${lead}«${middle}»${trail}${tail}`.slice(0, 4000);
    } catch {
      return undefined;
    }
  }

  function collectContext(range, selection) {
    const block = blockAncestor(range.commonAncestorContainer);
    return {
      selection,
      markedParagraph: markedParagraph(range, block),
      precedingParagraph: previousBlockText(block),
      title: document.title || undefined,
      url: location.href,
    };
  }

  class ContextReader {
    constructor() {
      this.host = document.createElement('div');
      this.host.style.cssText = 'all:initial;position:absolute;top:0;left:0;width:0;height:0;';
      this.root = this.host.attachShadow({ mode: 'closed' });

      const style = document.createElement('style');
      style.textContent = STYLES;
      this.root.appendChild(style);

      this.trigger = null;
      this.card = null;
      this.context = null;
      this.mode = null;
      this.depth = 'fast';
      // Replaced by the list the API returns, which omits lenses that make no
      // sense for the passage - glossing jargon in a poem, for instance.
      this.modes = [
        { id: 'plain', label: 'Plain meaning' },
        { id: 'point', label: "What's the point?" },
        { id: 'lines', label: 'Line by line' },
        { id: 'craft', label: 'How it works' },
        { id: 'jargon', label: 'The jargon' },
      ];
      this.anchor = null;

      document.addEventListener('selectionchange', () => this.onSelectionChange());
      document.addEventListener('mousedown', (e) => this.onOutsideInteraction(e), true);
      document.addEventListener('keydown', (e) => this.onKeyDown(e), true);
      window.addEventListener('scroll', () => this.dismissTrigger(), { passive: true });
    }

    attach() {
      if (!this.host.isConnected) document.documentElement.appendChild(this.host);
    }

    currentSelection() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
      const text = sel.toString().trim();
      if (text.length < 2 || text.length > MAX_SELECTION) return null;
      return { range: sel.getRangeAt(0), text };
    }

    onSelectionChange() {
      // Debounced to the end of the drag: firing mid-selection is what made
      // the previous version feel like it was fighting the reader.
      clearTimeout(this._debounce);
      this._debounce = setTimeout(() => {
        const current = this.currentSelection();
        if (!current) return this.dismissTrigger();
        if (this.card) return;
        this.showTrigger(current);
      }, 220);
    }

    onKeyDown(event) {
      if (event.key === 'Escape') {
        this.dismissTrigger();
        this.closeCard();
        return;
      }
      // Keyboard path, for people who never want to reach for the mouse.
      const accel = event.metaKey || event.ctrlKey;
      if (accel && event.shiftKey && (event.key === 'E' || event.key === 'e')) {
        const current = this.currentSelection();
        if (current) {
          event.preventDefault();
          this.open(current);
        }
      }
    }

    onOutsideInteraction(event) {
      if (event.composedPath().includes(this.host)) return;
      this.closeCard();
    }

    showTrigger(current) {
      this.attach();
      this.dismissTrigger();

      const rect = current.range.getBoundingClientRect();
      const button = document.createElement('button');
      button.className = 'trigger';
      button.append('Explain');
      const kbd = document.createElement('kbd');
      kbd.textContent = navigator.platform.includes('Mac') ? '⌘⇧E' : 'Ctrl⇧E';
      button.appendChild(kbd);

      button.addEventListener('mousedown', (e) => e.preventDefault());
      button.addEventListener('click', () => this.open(current));

      this.root.appendChild(button);
      this.trigger = button;

      const below = window.innerHeight - rect.bottom > 44;
      const top = below
        ? window.scrollY + rect.bottom + 8
        : window.scrollY + rect.top - 36;
      const left = window.scrollX + rect.left;
      button.style.top = `${Math.max(window.scrollY + 4, top)}px`;
      button.style.left = `${Math.max(8, left)}px`;
      // Flush layout so the transition has a starting value, then reveal in the
      // same task. requestAnimationFrame would be tidier, but it is throttled
      // in background and inactive tabs, which leaves the pill stuck at zero
      // opacity until the tab renders again.
      void button.offsetWidth;
      button.classList.add('show');
    }

    dismissTrigger() {
      this.trigger?.remove();
      this.trigger = null;
    }

    open(current) {
      this.dismissTrigger();
      this.context = collectContext(current.range, current.text);
      this.mode = null;
      this.depth = 'fast';
      this.renderCard(current.range.getBoundingClientRect());
      this.request();
    }

    renderCard(rect) {
      this.closeCard();
      this.attach();

      const card = document.createElement('div');
      card.className = 'card';

      const modes = document.createElement('div');
      modes.className = 'modes';
      card.appendChild(modes);

      const body = document.createElement('div');
      body.className = 'body';
      card.appendChild(body);

      const foot = document.createElement('div');
      foot.className = 'foot';
      const label = document.createElement('span');
      label.textContent = 'ContextReader';
      const spacer = document.createElement('span');
      spacer.className = 'spacer';
      const deeper = document.createElement('button');
      deeper.className = 'deep';
      deeper.textContent = 'Go deeper';
      deeper.title = 'Ask a slower, more careful model to read it again';
      deeper.addEventListener('click', () => {
        if (this.depth === 'deep') return;
        this.depth = 'deep';
        this.request();
      });
      const close = document.createElement('button');
      close.textContent = 'Close';
      close.addEventListener('click', () => this.closeCard());
      foot.append(label, spacer, deeper, close);
      card.appendChild(foot);

      this.root.appendChild(card);
      this.card = { el: card, modes, body, deeper };

      this.anchor = rect;
      this.positionCard();

      this.renderModes();
      this.setStatus('Reading the passage…');
    }

    /**
     * Place the card below the selection, flipping above when there is not
     * room. This has to run again after the content lands: while the spinner
     * is showing the card is a couple of lines tall, and deciding from that
     * height puts a full-size result off the bottom of the screen.
     */
    positionCard() {
      if (!this.card || !this.anchor) return;

      const el = this.card.el;
      const rect = this.anchor;
      const gap = 10;

      const width = Math.min(420, window.innerWidth - 32);
      let left = window.scrollX + rect.left;
      left = Math.min(left, window.scrollX + window.innerWidth - width - 16);
      el.style.left = `${Math.max(window.scrollX + 16, left)}px`;

      const height = el.offsetHeight;
      const fitsBelow = window.innerHeight - rect.bottom >= height + gap;
      const fitsAbove = rect.top >= height + gap;

      const top = fitsBelow || !fitsAbove
        ? window.scrollY + rect.bottom + gap
        : window.scrollY + rect.top - height - gap;

      el.style.top = `${Math.max(window.scrollY + 8, top)}px`;
    }

    renderModes() {
      if (!this.card) return;
      this.card.modes.textContent = '';
      for (const { id, label } of this.modes) {
        const chip = document.createElement('button');
        chip.className = 'chip';
        chip.textContent = label;
        chip.setAttribute('aria-pressed', String(this.mode === id));
        chip.addEventListener('click', () => {
          if (this.mode === id) return;
          this.mode = id;
          // A new lens starts fast again; deep is something you ask for.
          this.depth = 'fast';
          this.renderModes();
          this.request();
        });
        this.card.modes.appendChild(chip);
      }
    }

    setStatus(message) {
      if (!this.card) return;
      this.card.modes.classList.toggle('pending', !this.mode);
      this.card.body.textContent = '';
      const status = document.createElement('div');
      status.className = 'status';
      const spinner = document.createElement('div');
      spinner.className = 'spinner';
      const text = document.createElement('span');
      text.textContent = message;
      status.append(spinner, text);
      this.card.body.appendChild(status);

      this.positionCard();
    }

    setError(message) {
      if (!this.card) return;
      this.card.modes.classList.remove('pending');
      this.card.deeper.disabled = false;
      this.card.body.textContent = '';
      const error = document.createElement('div');
      error.className = 'error';
      error.textContent = message;

      const retry = document.createElement('button');
      retry.className = 'retry';
      retry.textContent = 'Try again';
      retry.addEventListener('click', () => this.request());
      error.append(' ', retry);

      this.card.body.appendChild(error);

      this.positionCard();
    }

    request() {
      if (!this.context) return;
      this.setStatus(
        this.depth === 'deep'
          ? 'Reading it again, slowly. This takes up to half a minute…'
          : 'Reading the passage…',
      );
      if (this.card) this.card.deeper.disabled = true;

      const payload = { ...this.context };
      if (this.mode) payload.mode = this.mode;
      if (this.depth === 'deep') payload.depth = 'deep';

      chrome.runtime.sendMessage({ type: 'explain', payload }, (response) => {
        if (chrome.runtime.lastError) {
          this.setError('Extension was reloaded. Refresh the page and try again.');
          return;
        }
        if (!response?.success) {
          this.setError(response?.error || 'Could not get an explanation.');
          return;
        }
        this.renderResult(response.data);
      });
    }

    renderResult(data) {
      if (!this.card) return;

      if (Array.isArray(data.modes) && data.modes.length) {
        this.modes = data.modes.map((m) => ({ id: m.id, label: m.label }));
      }
      if (data.mode) this.mode = data.mode;
      this.renderModes();

      this.card.deeper.disabled = data.depth === 'deep';
      this.card.deeper.textContent = data.depth === 'deep' ? 'Read closely' : 'Go deeper';

      this.card.modes.classList.remove('pending');
      this.card.body.textContent = '';

      if (data.summary) {
        const summary = document.createElement('p');
        summary.className = 'summary text';
        // textContent, never innerHTML: model output is never treated as markup.
        summary.textContent = data.summary;
        this.card.body.appendChild(summary);
      }

      for (const section of data.sections ?? []) {
        const wrap = document.createElement('div');
        wrap.className = 'section';

        const label = document.createElement('p');
        label.className = this.mode === 'lines' ? 'label line' : 'label';
        label.textContent = section.label;

        const text = document.createElement('p');
        text.className = 'text';
        text.textContent = section.body;

        wrap.append(label, text);
        this.card.body.appendChild(wrap);
      }

      this.positionCard();
    }

    closeCard() {
      this.card?.el.remove();
      this.card = null;
      this.anchor = null;
    }
  }

  new ContextReader();
})();
