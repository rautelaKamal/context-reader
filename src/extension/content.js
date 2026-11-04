/**
 * ContextReader content script.
 *
 * Two rules shape this file:
 *   1. Never interrupt. Selecting text is something people do while reading;
 *      it is not a request. We show a small affordance and wait to be asked.
 *   2. Never explain a passage without its surroundings. The selection alone
 *      is not enough to say what a line of verse means or what an editorial
 *      is arguing against, so we send the enclosing paragraph too.
 *
 * It runs in every frame, so text inside an iframe can be explained too. Until
 * a frame actually has a selection it does no DOM work at all: no host
 * element, no shadow root, no styles. Pages full of embeds pay almost nothing.
 */

(() => {
  // Already here. This matters on an update, when the service worker
  // re-injects us into tabs that are still running an older copy.
  if (window.__contextReaderLoaded) return;
  window.__contextReaderLoaded = true;

  const ORPHANED = 'ContextReader was just installed or updated. Refresh this page to use it.';
  const COMMAND = 'explain-selection';
  const Quotes = globalThis.ContextReaderQuotes;

  const MAX_SELECTION = 2000;
  const BLOCK_TAGS = new Set([
    'P', 'LI', 'BLOCKQUOTE', 'PRE', 'TD', 'DD', 'DT', 'FIGCAPTION',
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'ARTICLE', 'SECTION', 'DIV',
  ]);

  /*
   * The film's identity: paper and ink, highlighter yellow with a gold edge
   * only on verified quotes, trust blue for the lens and labels. Text pairs
   * meet WCAG AA in both themes (lowest: white on the dark lens button, 4.9:1).
   * The dark set is chosen from the page behind the selection, not the OS.
   */
  const STYLES = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .trigger, .card {
      --card: #FFFFFF; --ink: #14213D; --soft: #4A5468; --rule: #E4E1D8; --chip: #F2F0E9;
      --blue: #2559C9; --lens: #2559C9; --yellow: #FFD84D; --gold: #A67E00; --skel: #ECE9E1;
      --pill: #14213D; --pill-ink: #FFFFFF;
      --shadow: 0 18px 50px rgba(20,33,61,.18), 0 3px 10px rgba(20,33,61,.08);
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    }
    .dark {
      --card: #1A2033; --ink: #EEEDE8; --soft: #A9B1C4; --rule: #323B57; --chip: #242C44;
      --blue: #8DB0FF; --lens: #3A6BDB; --skel: #2A3250; --pill: #EEEDE8; --pill-ink: #14213D;
      --shadow: 0 18px 50px rgba(0,0,0,.5), 0 3px 10px rgba(0,0,0,.3);
    }
    button { font: inherit; color: inherit; }
    :focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; border-radius: 6px; }

    .trigger {
      position: absolute; z-index: 2147483647;
      display: flex; align-items: center; gap: 8px;
      padding: 7px 12px; border: none; border-radius: 999px;
      font-size: 13px; font-weight: 600; line-height: 1;
      color: var(--pill-ink); background: var(--pill);
      box-shadow: 0 3px 14px rgba(20,33,61,.28);
      cursor: pointer; opacity: 0; transform: translateY(4px);
      transition: opacity .12s ease, transform .12s ease;
    }
    .trigger.show { opacity: 1; transform: translateY(0); }
    .trigger kbd {
      font: inherit; font-size: 11.5px; font-weight: 500; line-height: 1;
      padding: 3px 5px; border-radius: 4px; border: 1px solid currentColor; opacity: .75;
    }

    .card {
      position: absolute; z-index: 2147483647;
      width: min(420px, calc(100vw - 32px));
      display: flex; flex-direction: column;
      background: var(--card); color: var(--ink);
      border: 1px solid var(--rule); border-radius: 14px; box-shadow: var(--shadow);
      font-size: 14px; line-height: 1.55; outline: none;
    }
    .spacer { flex: 1; }

    /* One line: the current lens, which opens the lens menu, and close. */
    .head {
      position: relative; display: flex; align-items: center; gap: 8px;
      padding: 10px 10px 10px 14px; border-bottom: 1px solid var(--rule);
    }
    .lens {
      display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px 0 13px;
      border: 0; border-radius: 999px; background: var(--lens); color: #FFFFFF;
      font-size: 13.5px; font-weight: 600; cursor: pointer;
    }
    .lens svg { flex: none; }
    .close {
      display: inline-grid; place-items: center; width: 32px; height: 32px;
      border: 0; border-radius: 8px; background: none; color: var(--soft); cursor: pointer;
    }
    .close:hover { background: var(--chip); }
    .menu {
      position: absolute; left: 10px; top: calc(100% + 4px); z-index: 2; width: 300px; padding: 6px;
      background: var(--card); border: 1px solid var(--rule); border-radius: 12px; box-shadow: var(--shadow);
    }
    .menu[hidden] { display: none; }
    .menu-title { margin: 4px 10px 6px; font-size: 12px; font-weight: 600; color: var(--soft); }
    .item {
      position: relative; display: grid; width: 100%; padding: 8px 10px 8px 30px;
      border: 0; border-radius: 8px; background: none; text-align: left; cursor: pointer;
    }
    .item:hover, .item:focus-visible { background: var(--chip); }
    .item[aria-checked="true"]::before { content: '✓'; position: absolute; left: 10px; top: 8px; color: var(--blue); font-weight: 700; }
    .item-name { font-weight: 600; font-size: 14px; }
    .item-hint { font-size: 12.5px; color: var(--soft); }

    .body { flex: 1 1 auto; min-height: 0; padding: 14px 16px 4px; overflow-y: auto; overscroll-behavior: contain; scroll-snap-type: y proximity; }
    .summary { margin: 0 0 12px; font-size: 16px; line-height: 1.5; white-space: pre-wrap; }

    /* Sections: the first open, the rest a tap away. */
    .section { border-top: 1px solid var(--rule); scroll-snap-align: start; }
    .sec-head {
      display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%;
      min-height: 40px; padding: 8px 0; border: 0; background: none; text-align: left; cursor: pointer;
    }
    .sec-head svg { color: var(--soft); transform: rotate(-90deg); transition: transform .15s ease; flex: none; }
    .sec-head[aria-expanded="true"] svg { transform: none; }
    .label { font-size: 11.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--blue); }
    .label.line { font: italic 14.5px/1.4 Georgia, "Iowan Old Style", "Times New Roman", serif; letter-spacing: 0; text-transform: none; }
    .sec-text { margin: 0 0 12px; font-size: 14px; white-space: pre-wrap; }
    .sec-text[hidden] { display: none; }

    /* Only quotes of three or more words, found word for word in what was sent. */
    mark {
      color: #14213D; background: linear-gradient(transparent calc(100% - 2px), var(--gold) 0), var(--yellow);
      border-radius: 3px; padding: 0 2px; -webkit-box-decoration-break: clone; box-decoration-break: clone;
    }

    .foot {
      display: flex; align-items: center; gap: 6px; padding: 9px 16px; border-top: 1px solid var(--rule);
      font-size: 12.5px; color: var(--soft); font-variant-numeric: tabular-nums;
    }
    .deep {
      padding: 0; border: 0; background: none; color: var(--soft);
      text-decoration: underline; text-underline-offset: 3px; cursor: pointer;
    }
    .deep[disabled] { text-decoration: none; cursor: default; }
    /* Resting reads as a plain sentence, not a dimmed link. */
    .deep[disabled]:not(:empty) { color: var(--soft); }
    .dot[hidden], .deep[hidden] { display: none; }
    /* Kept free for a thumbs up and down later. */
    .reserved { width: 64px; }

    /* Loading: a short skeleton, not a spinner. */
    .skel { display: block; height: 12px; margin: 0 0 12px; border-radius: 6px; background: var(--skel); }
    .skel.short { width: 46%; margin-bottom: 18px; }
    .skel-lens { display: inline-block; width: 140px; height: 32px; margin: 0; border-radius: 999px; }
    @media (prefers-reduced-motion: no-preference) {
      .skel { animation: pulse 1.2s ease-in-out infinite; }
      @keyframes pulse { 50% { opacity: .55; } }
    }
    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    .note { margin: 0 0 14px; color: var(--soft); }

    .error-title { margin: 0 0 4px; font-size: 16px; font-weight: 600; }
    .error-text { margin: 0 0 12px; color: var(--soft); }
    .cutoff { border-top: 1px solid var(--rule); padding-top: 12px; }
    .retry {
      margin-bottom: 14px; padding: 7px 14px; border: 1px solid var(--rule); border-radius: 999px;
      background: var(--chip); font-weight: 600; cursor: pointer;
    }
  `;

  const SVG = 'http://www.w3.org/2000/svg';
  function icon(path, size) {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('width', size); svg.setAttribute('height', size);
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`); svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', path); p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '1.7'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(p);
    return svg;
  }
  const chevron = () => icon('M3 4.5 6 7.5 9 4.5', 12);
  const cross = () => icon('M3.5 3.5l7 7M10.5 3.5l-7 7', 14);

  /**
   * When Go deeper is back, in the reader's own time: "1:30 PM", "tomorrow,
   * 1:30 PM", or a weekday beyond that. Without a time, just "tomorrow".
   */
  function restingUntil(resetAt, now = new Date()) {
    if (!resetAt) return 'tomorrow';
    const at = new Date(resetAt * 1000);
    const time = at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const day = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const days = Math.round((day(at) - day(now)) / 86_400_000);
    if (days <= 0) return time;
    if (days === 1) return `tomorrow, ${time}`;
    return `${at.toLocaleDateString([], { weekday: 'long' })}, ${time}`;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

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

  /**
   * Origin and path only. A query string or fragment can carry a session
   * token, a password reset link, a document id or a search term, and none of
   * that is needed: mode detection looks at the host and the path.
   * Duplicated in background.js because these are separate plain scripts with
   * no module system between them.
   */
  function cleanUrl(href) {
    try {
      const { origin, pathname } = new URL(href);
      return origin + pathname;
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
      url: cleanUrl(location.href),
    };
  }

  /**
   * Text fields keep their selection outside the page selection, so they are
   * read separately. Only the paragraph of the field around the selection is
   * sent, with the one before it, never the whole field: it may be a draft.
   */
  const FIELD_TYPES = new Set(['text', 'search', 'url', 'email', '']);
  function fieldSelection() {
    const field = document.activeElement;
    if (!field) return null;
    const isField = field.tagName === 'TEXTAREA'
      || (field.tagName === 'INPUT' && FIELD_TYPES.has((field.getAttribute('type') || '').toLowerCase()));
    if (!isField) return null;
    const { selectionStart: a, selectionEnd: b, value } = field;
    if (a == null || b == null || b <= a) return null;
    const text = value.slice(a, b).trim();
    if (text.length < 2 || text.length > MAX_SELECTION) return null;
    const start = value.lastIndexOf('\n\n', a - 1) + 1;
    const endAt = value.indexOf('\n\n', b);
    const end = endAt === -1 ? value.length : endAt;
    const before = value.slice(0, Math.max(0, start - 2));
    const prevStart = before.lastIndexOf('\n\n') + 1;
    return {
      text,
      node: field,
      rect: () => field.getBoundingClientRect(),
      context: () => ({
        selection: text,
        markedParagraph: `${value.slice(start, a)}«${value.slice(a, b)}»${value.slice(b, end)}`.slice(0, 4000),
        precedingParagraph: before.slice(prevStart).trim().slice(0, 4000) || undefined,
        title: document.title || undefined,
        url: cleanUrl(location.href),
      }),
    };
  }

  function currentSelection() {
    const field = fieldSelection();
    if (field) return field;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
    const text = sel.toString().trim();
    if (text.length < 2 || text.length > MAX_SELECTION) return null;
    const range = sel.getRangeAt(0);
    return {
      text,
      node: range.commonAncestorContainer,
      rect: () => range.getBoundingClientRect(),
      context: () => collectContext(range, text),
    };
  }

  /**
   * Dark card on a dark page: the first background behind the selection that
   * is mostly opaque decides. A page that paints no background at all leaves
   * it to the OS setting.
   */
  function pageIsDark(node) {
    let at = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    while (at) {
      const m = /rgba?\(([^)]+)\)/.exec(getComputedStyle(at).backgroundColor);
      if (m) {
        const [r, g, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
        if (a >= 0.5) {
          const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
          return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) < 0.2;
        }
      }
      at = at.parentElement;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  const LENS_FALLBACK = [
    { id: 'plain', label: 'Plain meaning', hint: 'Say it in ordinary English' },
    { id: 'point', label: "What's the point?", hint: "The writer's position, and what they're responding to" },
    { id: 'lines', label: 'Line by line', hint: 'Walk through verse one line at a time' },
    { id: 'craft', label: 'How it works', hint: 'Word choice, sound, line breaks, double meanings' },
    { id: 'jargon', label: 'The jargon', hint: 'Technical terms, in the sense this text uses them' },
  ];

  class ContextReader {
    constructor() {
      // Nothing touches the page until there is something to show.
      this.host = null;
      this.root = null;
      this.trigger = null;
      this.card = null;
      this.context = null;
      this.mode = null;
      this.depth = 'fast';
      this.remaining = null;
      // Replaced by the list the API returns, which omits lenses that make no
      // sense for the passage - glossing jargon in a poem, for instance.
      this.modes = LENS_FALLBACK;
      // Which sections are open, per lens, for as long as the page is open.
      this.openSections = new Map();
      this.shortcut = undefined;
      this.lastOpen = { text: '', at: 0 };

      document.addEventListener('mousedown', (e) => this.onOutsideInteraction(e), true);
      window.addEventListener('scroll', () => this.dismissTrigger(), { passive: true });
      this.loadShortcut();
    }

    attach() {
      if (!this.host) {
        this.host = document.createElement('div');
        this.host.style.cssText = 'all:initial;position:absolute;top:0;left:0;width:0;height:0;';
        this.root = this.host.attachShadow({ mode: 'closed' });
        const style = document.createElement('style');
        style.textContent = STYLES;
        this.root.appendChild(style);
      }
      if (!this.host.isConnected) document.documentElement.appendChild(this.host);
    }

    /** The shortcut Chrome really assigned, so the pill never advertises keys that don't work. */
    loadShortcut() {
      if (!chrome.runtime?.id) return;
      try {
        chrome.runtime.sendMessage({ type: 'shortcut' }, (response) => {
          if (chrome.runtime.lastError) return;
          this.shortcut = typeof response?.shortcut === 'string' ? response.shortcut : undefined;
        });
      } catch {
        // Orphaned script; the pill simply shows no hint.
      }
    }

    onSelectionChange() {
      // Debounced to the end of the drag: firing mid-selection is what made
      // the previous version feel like it was fighting the reader.
      clearTimeout(this._debounce);
      this._debounce = setTimeout(() => {
        const current = currentSelection();
        if (!current) return this.dismissTrigger();
        if (this.card) return;
        this.showTrigger(current);
      }, 220);
    }

    onEscape() {
      if (this.card?.menu && !this.card.menu.hidden) return this.closeMenu(true);
      this.dismissTrigger();
      if (this.card) this.closeCard({ restoreFocus: true });
    }

    onOutsideInteraction(event) {
      if (this.host && event.composedPath().includes(this.host)) return;
      this.closeCard();
    }

    showTrigger(current) {
      this.attach();
      this.dismissTrigger();

      const rect = current.rect();
      const button = el('button', `trigger${pageIsDark(current.node) ? ' dark' : ''}`, 'Explain');
      // Until the worker answers, assume the suggested keys; hide them if Chrome didn't assign any.
      const keys = this.shortcut ?? (navigator.platform.includes('Mac') ? '⌘⇧E' : 'Ctrl+Shift+E');
      if (keys) button.appendChild(el('kbd', null, keys));

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
      // The manifest shortcut and the in-page fallback can both fire for one
      // key press; one request is enough.
      const now = Date.now();
      if (this.card && this.lastOpen.text === current.text && now - this.lastOpen.at < 800) return;
      this.lastOpen = { text: current.text, at: now };

      this.dismissTrigger();
      this.returnFocus = document.activeElement;
      this.context = current.context();
      this.mode = null;
      this.depth = 'fast';
      this.renderCard(current.rect(), pageIsDark(current.node));
      this.request();
    }

    renderCard(rect, dark) {
      this.closeCard();
      this.attach();

      const card = el('div', `card${dark ? ' dark' : ''}`);
      card.setAttribute('role', 'dialog');
      card.setAttribute('aria-label', 'ContextReader explanation');
      card.tabIndex = -1;

      const head = el('div', 'head');
      const lensSlot = el('span');
      const close = el('button', 'close');
      close.setAttribute('aria-label', 'Close');
      close.appendChild(cross());
      close.addEventListener('click', () => this.closeCard({ restoreFocus: true }));
      const menu = el('div', 'menu');
      menu.setAttribute('role', 'menu');
      menu.setAttribute('aria-label', 'Change lens');
      menu.hidden = true;
      menu.addEventListener('keydown', (e) => this.onMenuKey(e));
      head.append(lensSlot, el('span', 'spacer'), close, menu);

      const body = el('div', 'body');

      const foot = el('div', 'foot');
      const left = el('span', 'left');
      const dot = el('span', 'dot', '·');
      dot.setAttribute('aria-hidden', 'true');
      const deeper = el('button', 'deep', 'Go deeper');
      deeper.title = 'Ask a slower, more careful model to read it again';
      deeper.addEventListener('click', () => {
        if (this.depth === 'deep') return;
        this.depth = 'deep';
        this.request();
      });
      const reserved = el('span', 'reserved');
      reserved.setAttribute('aria-hidden', 'true');
      foot.append(left, dot, deeper, el('span', 'spacer'), reserved);

      card.append(head, body, foot);
      this.root.appendChild(card);
      this.card = { el: card, head, lensSlot, menu, body, foot, left, dot, deeper };

      this.anchor = rect;
      this.renderLens();
      this.setLoading();
      // Into the card, so the keyboard can reach the lens, the sections and close.
      card.focus({ preventScroll: true });
    }

    modeLabel(id) {
      return (this.modes.find((m) => m.id === id) ?? LENS_FALLBACK.find((m) => m.id === id))?.label;
    }

    /** The lens control: the current lens as a button, or a placeholder while the server picks one. */
    renderLens() {
      if (!this.card) return;
      const { lensSlot } = this.card;
      lensSlot.textContent = '';
      if (!this.mode) {
        const skel = el('span', 'skel skel-lens');
        skel.setAttribute('aria-hidden', 'true');
        lensSlot.appendChild(skel);
        return;
      }
      const label = this.modeLabel(this.mode);
      const button = el('button', 'lens', label);
      button.appendChild(chevron());
      button.setAttribute('aria-haspopup', 'menu');
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-label', `Lens: ${label}. Change lens`);
      button.addEventListener('click', () => (this.card.menu.hidden ? this.openMenu() : this.closeMenu(true)));
      button.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); this.openMenu(); }
      });
      lensSlot.appendChild(button);
      this.card.lens = button;
    }

    openMenu() {
      const { menu } = this.card;
      menu.textContent = '';
      menu.appendChild(el('p', 'menu-title', 'Change lens'));
      for (const { id, label, hint } of this.modes) {
        const item = el('button', 'item');
        item.setAttribute('role', 'menuitemradio');
        item.setAttribute('aria-checked', String(id === this.mode));
        item.tabIndex = -1;
        item.append(el('span', 'item-name', label));
        if (hint) item.append(el('span', 'item-hint', hint));
        item.addEventListener('click', () => this.chooseLens(id));
        menu.appendChild(item);
      }
      menu.hidden = false;
      this.card.lens?.setAttribute('aria-expanded', 'true');
      const items = [...menu.querySelectorAll('.item')];
      (items.find((i) => i.getAttribute('aria-checked') === 'true') ?? items[0])?.focus();
    }

    closeMenu(refocus) {
      if (!this.card || this.card.menu.hidden) return;
      this.card.menu.hidden = true;
      this.card.lens?.setAttribute('aria-expanded', 'false');
      if (refocus) this.card.lens?.focus();
    }

    onMenuKey(e) {
      const items = [...this.card.menu.querySelectorAll('.item')];
      const at = items.indexOf(this.root.activeElement);
      const go = (i) => items[(i + items.length) % items.length]?.focus();
      if (e.key === 'ArrowDown') { e.preventDefault(); go(at + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); go(at - 1); }
      else if (e.key === 'Home') { e.preventDefault(); go(0); }
      else if (e.key === 'End') { e.preventDefault(); go(items.length - 1); }
      else if (e.key === 'Tab') this.closeMenu(false);
    }

    chooseLens(id) {
      this.closeMenu(true);
      if (this.mode === id) return;
      this.mode = id;
      // A new lens starts fast again; deep is something you ask for.
      this.depth = 'fast';
      this.renderLens();
      this.card.lens?.focus();
      this.request();
    }

    /** The Go deeper button: done, available, or resting for today. */
    setDeeper(depth) {
      const { deeper } = this.card;
      if (this.deepResting && depth !== 'deep') {
        if (this.deepResetAt && this.deepResetAt * 1000 <= Date.now()) this.deepResting = false;
      }
      if (this.deepResting && depth !== 'deep') {
        deeper.disabled = true;
        deeper.textContent = `Go deeper is resting until ${restingUntil(this.deepResetAt)}`;
        deeper.title = 'Go deeper runs on a small daily quota shared by everyone, and it is used up for now.';
        return;
      }
      // One name everywhere: after a deep read the button still says Go deeper, done.
      deeper.disabled = depth === 'deep';
      deeper.textContent = 'Go deeper';
      deeper.title = depth === 'deep'
        ? 'This answer already used Go deeper'
        : 'Go deeper: a slower, more careful model reads it again';
    }

    setFoot({ loading = false } = {}) {
      const { left, dot, deeper } = this.card;
      if (loading) {
        left.textContent = this.depth === 'deep' ? 'Reading it again, slowly…' : 'Reading the passage…';
        dot.hidden = true;
        deeper.hidden = true;
        return;
      }
      const known = typeof this.remaining === 'number';
      left.textContent = known ? (this.remaining === 0 ? 'None left today' : `${this.remaining} left today`) : '';
      left.title = known ? 'Daily allowance, resets at midnight' : '';
      dot.hidden = !known;
      deeper.hidden = false;
    }

    /** A short skeleton while the answer is on its way. */
    setLoading() {
      if (!this.card) return;
      const { body } = this.card;
      body.textContent = '';
      body.style.maxHeight = '';
      body.setAttribute('aria-busy', 'true');
      const status = el('span', 'sr', this.depth === 'deep' ? 'Reading it again, slowly' : 'Reading the passage');
      status.setAttribute('role', 'status');
      body.appendChild(status);
      for (const width of ['94%', '82%', '88%']) {
        const bar = el('span', 'skel');
        bar.style.width = width;
        bar.setAttribute('aria-hidden', 'true');
        body.appendChild(bar);
      }
      const last = el('span', 'skel short');
      last.setAttribute('aria-hidden', 'true');
      body.appendChild(last);
      if (this.depth === 'deep') body.appendChild(el('p', 'note', 'This can take up to half a minute.'));
      this.setFoot({ loading: true });
      this.card.deeper.disabled = true;
      this.positionCard();
    }

    setError(message, { retryable = true, title = "Couldn't get an explanation." } = {}) {
      if (!this.card) return;
      const { body } = this.card;
      body.textContent = '';
      body.removeAttribute('aria-busy');
      const titleEl = el('p', 'error-title', title);
      titleEl.setAttribute('role', 'alert');
      body.append(titleEl, el('p', 'error-text', message));
      if (retryable) {
        const retry = el('button', 'retry', 'Try again');
        // Same request id: a retry after a failure isn't charged again.
        retry.addEventListener('click', () => this.request({ retry: true }));
        body.appendChild(retry);
      }
      // No lens chosen yet (the first request failed): drop the loading placeholder.
      if (!this.mode) this.card.lensSlot.textContent = '';
      this.setFoot();
      this.setDeeper(this.depth);
      this.positionCard();
    }

    /**
     * Ask for an explanation over a port and render it as it streams in. The
     * skeleton stays until the first words arrive. `retry` reuses the last
     * request id, so trying again after a cut-off answer isn't charged twice.
     */
    request({ retry = false } = {}) {
      if (!this.context) return;
      this.port?.disconnect();
      this.port = null;
      this.setLoading();

      const payload = { ...this.context };
      if (this.mode) payload.mode = this.mode;
      if (this.depth === 'deep') payload.depth = 'deep';
      if (!retry || !this.requestId) this.requestId = crypto.randomUUID();

      // A content script outlives the extension that injected it. Reload,
      // update or re-enable ContextReader and every chrome.* API in an
      // already-open tab is torn down, so this would throw and the card would
      // load forever. The page has to be refreshed to get a live script.
      if (!chrome.runtime?.id) {
        this.setError(ORPHANED, { retryable: false, title: 'Refresh this page' });
        return;
      }

      let port;
      try {
        port = chrome.runtime.connect({ name: 'explain' });
      } catch {
        this.setError(ORPHANED, { retryable: false, title: 'Refresh this page' });
        return;
      }
      this.port = port;
      this.stream = null;

      // The worker can be stopped mid-answer, and then nothing more arrives.
      let watchdog;
      const arm = () => {
        clearTimeout(watchdog);
        watchdog = setTimeout(() => this.onStreamEvent(port, { type: 'error', partial: Boolean(this.stream?.words), message: this.stream?.words ? 'Answer cut off. Try again.' : 'No answer came back. Try again.' }), this.depth === 'deep' ? 150000 : 45000);
      };
      arm();
      port.onMessage.addListener((event) => {
        if (this.port !== port) return;
        arm();
        this.onStreamEvent(port, event);
        if (event.type === 'done' || event.type === 'error') clearTimeout(watchdog);
      });
      port.onDisconnect.addListener(() => {
        clearTimeout(watchdog);
        if (this.port !== port) return;
        this.port = null;
        // Disconnected before finishing: the worker went away.
        if (this.card && !this.stream?.finished) {
          this.onStreamEvent(port, { type: 'error', partial: Boolean(this.stream?.words), message: this.stream?.words ? 'Answer cut off. Try again.' : ORPHANED });
        }
      });
      port.postMessage({ type: 'explain', payload, requestId: this.requestId });
    }

    onStreamEvent(port, event) {
      if (!this.card || this.port !== port) return;
      const st = this.stream ??= { words: false, finished: false, summary: null, summaryText: '', sections: [], current: null };
      switch (event.type) {
        case 'start': {
          if (typeof event.remaining === 'number') this.remaining = event.remaining;
          if (Array.isArray(event.modes) && event.modes.length) {
            this.modes = event.modes.map((m) => ({ id: m.id, label: m.label, hint: m.hint }));
          }
          if (event.mode && event.mode !== this.mode) {
            this.mode = event.mode;
            this.renderLens();
          }
          break;
        }
        case 'summary': {
          if (!st.summary) this.beginStream(st);
          st.summaryText += event.text;
          st.summary.append(event.text);
          break;
        }
        case 'section': {
          if (!st.summary) this.beginStream(st);
          this.finishPart(st);
          const part = this.makeSection(st.sections.length, event.label);
          part.raw = '';
          st.sections.push(part);
          st.current = part;
          this.card.body.appendChild(part.wrap);
          break;
        }
        case 'delta': {
          if (!st.current) this.onStreamEvent(port, { type: 'section', label: '' });
          st.current.raw += event.text;
          st.current.text.append(event.text);
          break;
        }
        case 'done': {
          st.finished = true;
          this.port = null;
          port.disconnect();
          // The full reply, parsed properly on the server, is what the card keeps.
          this.renderResult(event.result, { keepPlace: true });
          break;
        }
        case 'error': {
          st.finished = true;
          // A refused request was refunded; this is the corrected count.
          if (typeof event.remaining === 'number') this.remaining = event.remaining;
          this.port = null;
          try { port.disconnect(); } catch { /* already gone */ }
          if (event.code === 'deep_resting') {
            // Back to the answer the reader already had, with Go deeper switched off until the reset.
            this.deepResting = true;
            this.deepResetAt = event.resetAt;
            this.depth = 'fast';
            if (this.lastResult) this.renderResult(this.lastResult, { keepPlace: true });
            else this.setError(`Go deeper is resting until ${restingUntil(event.resetAt)}. Your allowance was not charged.`, { retryable: false, title: 'Go deeper is resting' });
            this.card.deeper.focus();
          } else if (event.partial && st.words) this.showCutOff(st, event.message);
          else {
            this.setError(event.message || 'Something went wrong on our side. Try again.', {
              retryable: !event.overLimit,
              title: event.overLimit ? "That's today's explanations" : "Couldn't get an explanation.",
            });
          }
          break;
        }
        default:
      }
      if (event.type === 'summary' || event.type === 'section' || event.type === 'delta') this.fitBody({ streaming: true });
    }

    /** First words: the skeleton goes, and the summary starts filling in its place. */
    beginStream(st) {
      st.words = true;
      const { body } = this.card;
      // Hold the skeleton's height until the text is taller, so nothing jumps.
      body.style.minHeight = `${body.offsetHeight}px`;
      body.textContent = '';
      body.removeAttribute('aria-busy');
      st.summary = el('p', 'summary');
      body.appendChild(st.summary);
    }

    /** A part is complete: redraw its text with verified quotes marked. */
    finishPart(st) {
      if (st.current) {
        st.current.text.textContent = '';
        this.fillText(st.current.text, st.current.raw);
        st.current = null;
      } else if (st.summary && !st.summaryDone) {
        st.summary.textContent = '';
        this.fillText(st.summary, st.summaryText);
        st.summaryDone = true;
      }
    }

    /** Keep what arrived, say plainly it was cut off, and offer a free retry. */
    showCutOff(st, message) {
      this.finishPart(st);
      const note = el('div', 'cutoff');
      note.append(el('p', 'error-text', message || 'Answer cut off. Try again.'));
      const retry = el('button', 'retry', 'Try again');
      retry.addEventListener('click', () => this.request({ retry: true }));
      note.appendChild(retry);
      this.card.body.appendChild(note);
      this.card.body.style.minHeight = '';
      this.setFoot();
      this.setDeeper(this.depth);
      this.fitBody();
    }

    /** Text with verified quotes (3+ words, word for word in what was sent) marked; nothing else. */
    fillText(node, text) {
      const sent = Quotes.sentText(this.context);
      let at = 0;
      for (const q of Quotes.checkQuotes(text, sent)) {
        if (!q.verified) continue;
        node.append(text.slice(at, q.start), el('mark', null, text.slice(q.start, q.end)));
        at = q.end;
      }
      node.append(text.slice(at));
    }

    /** One section: a heading that opens and closes it, and its text. Open state is kept per lens. */
    makeSection(i, label) {
      const open = this.openSections.get(this.mode) ?? new Set([0]);
      this.openSections.set(this.mode, open);
      const wrap = el('div', 'section');
      const id = `cr-sec-${i}`;
      const headBtn = el('button', 'sec-head');
      headBtn.setAttribute('aria-expanded', String(open.has(i)));
      headBtn.setAttribute('aria-controls', id);
      headBtn.append(el('span', this.mode === 'lines' ? 'label line' : 'label', label), chevron());
      const text = el('p', 'sec-text');
      text.id = id;
      text.hidden = !open.has(i);
      headBtn.addEventListener('click', () => {
        const now = !open.has(i);
        if (now) open.add(i); else open.delete(i);
        headBtn.setAttribute('aria-expanded', String(now));
        text.hidden = !now;
        this.fitBody();
        if (now) wrap.scrollIntoView({ block: 'nearest' });
      });
      wrap.append(headBtn, text);
      return { wrap, text };
    }

    renderResult(data, { keepPlace = false } = {}) {
      if (!this.card) return;

      if (Array.isArray(data.modes) && data.modes.length) {
        this.modes = data.modes.map((m) => ({ id: m.id, label: m.label, hint: m.hint }));
      }
      if (data.mode && data.mode !== this.mode) {
        this.mode = data.mode;
        this.renderLens();
      }

      this.lastResult = data;
      this.setFoot();
      this.setDeeper(data.depth);

      const { body } = this.card;
      // Replacing the streamed text with the final version happens in one
      // task, so nothing paints in between; keep the reader's scroll position.
      const scrolled = body.scrollTop;
      body.textContent = '';
      body.removeAttribute('aria-busy');

      if (data.summary) {
        // Text nodes and marks only, never innerHTML: model output is never markup.
        const summary = el('p', 'summary');
        this.fillText(summary, data.summary);
        body.appendChild(summary);
      }

      (data.sections ?? []).forEach((section, i) => {
        const part = this.makeSection(i, section.label);
        this.fillText(part.text, section.body);
        body.appendChild(part.wrap);
      });
      body.style.minHeight = '';

      if (keepPlace) this.fitBody(); else this.positionCard();
      body.scrollTop = scrolled;
    }

    /**
     * Grow up to about 70% of the window, then scroll. When it has to scroll,
     * the visible area ends on a section boundary, so a heading is never shown
     * cut in half at the bottom edge.
     */
    fitBody({ streaming = false } = {}) {
      if (!this.card) return;
      const { el: card, head, foot, body } = this.card;
      const room = Math.min(window.innerHeight * 0.7, 700) - head.offsetHeight - foot.offsetHeight;
      // While words are arriving the edge stays put; it snaps to a section
      // boundary once, when the answer is complete.
      if (streaming) { body.style.maxHeight = `${room}px`; return; }
      body.style.maxHeight = '';
      if (body.scrollHeight <= room) return;
      const top = body.getBoundingClientRect().top;
      let cut = room;
      for (const sec of body.querySelectorAll('.section')) {
        const heading = sec.firstElementChild.getBoundingClientRect();
        const from = heading.top - top, to = heading.bottom - top;
        // A heading straddling the edge: end just above it instead.
        if (from < room && to > room) { cut = from; break; }
      }
      // Never collapse to a sliver; the summary alone may be taller than the cut.
      body.style.maxHeight = `${Math.max(cut, Math.min(room, 160))}px`;
      void card.offsetHeight;
    }

    /**
     * Place the card below the selection, flipping above when there is not
     * room. This has to run again after the content lands: while loading the
     * card is a few lines tall, and deciding from that height puts a full-size
     * result off the bottom of the screen.
     */
    positionCard() {
      if (!this.card || !this.anchor) return;
      this.fitBody();

      const card = this.card.el;
      const rect = this.anchor;
      const gap = 10;

      const width = Math.min(420, window.innerWidth - 32);
      let left = window.scrollX + rect.left;
      left = Math.min(left, window.scrollX + window.innerWidth - width - 16);
      card.style.left = `${Math.max(window.scrollX + 16, left)}px`;

      // Decided once per card, for the tallest the card can get, so a growing
      // answer never makes it flip sides or slide. Above the selection, the
      // full height is reserved up front, because a card that grew upward
      // would push the words already shown.
      if (!this.card.placement) {
        const tallest = Math.min(window.innerHeight * 0.7, 700);
        const below = window.innerHeight - rect.bottom >= tallest + gap || rect.top < tallest + gap;
        this.card.placement = below ? 'below' : 'above';
        if (!below) {
          card.style.minHeight = `${tallest}px`;
          card.style.top = `${Math.max(window.scrollY + 8, window.scrollY + rect.top - tallest - gap)}px`;
        } else {
          card.style.top = `${window.scrollY + rect.bottom + gap}px`;
        }
      }
    }

    closeCard({ restoreFocus = false } = {}) {
      if (!this.card) return;
      // Closing mid-answer stops the download too.
      this.port?.disconnect();
      this.port = null;
      this.card.el.remove();
      this.card = null;
      this.anchor = null;
      this.pending = null;
      // Back to where the reader was, but only when they closed it themselves.
      const back = this.returnFocus;
      this.returnFocus = null;
      if (restoreFocus && back?.isConnected && typeof back.focus === 'function') back.focus({ preventScroll: true });
    }
  }

  /*
   * Start-up costs three listeners and nothing else. The reader object, and
   * with it any DOM, appears only once this frame has a selection or is asked
   * to explain one.
   */
  let app = null;
  const boot = () => (app ??= new ContextReader());
  const hasSelection = () => {
    const sel = window.getSelection();
    return Boolean((sel && !sel.isCollapsed && sel.toString().trim().length > 1) || fieldSelection());
  };

  document.addEventListener('selectionchange', () => {
    if (app) app.onSelectionChange();
    else if (hasSelection()) boot().onSelectionChange();
  });

  // The in-page shortcut stays as a fallback, for when Chrome couldn't assign
  // the manifest one. Pages that capture keys can still swallow this one.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { app?.onEscape(); return; }
    const accel = event.metaKey || event.ctrlKey;
    if (accel && event.shiftKey && (event.key === 'E' || event.key === 'e')) {
      const current = currentSelection();
      if (current) {
        event.preventDefault();
        boot().open(current);
      }
    }
  }, true);

  // The manifest shortcut. Chrome sends it to every frame in the tab; the
  // focused frame with a selection answers. The top frame defers to an iframe
  // that has focus, or both would open a card for the same key press.
  try {
    chrome.runtime.onMessage.addListener((message) => {
      if (message?.type !== COMMAND || !document.hasFocus()) return;
      const focus = document.activeElement?.tagName;
      if (focus === 'IFRAME' || focus === 'FRAME') return;
      const current = currentSelection();
      if (current) boot().open(current);
    });
  } catch {
    // Orphaned script: the extension was reloaded under this page.
  }
})();
