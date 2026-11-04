/**
 * Service worker.
 *
 * All network calls go through here rather than the content script: the page's
 * Content-Security-Policy does not apply, and requests carry the extension's
 * own origin instead of whatever site the reader happens to be on.
 */

const DEFAULT_API = 'https://context-reader.vercel.app';

/**
 * A daily allowance, counted on this device.
 *
 * The hosted key is on a free tier, which means the quota is shared by
 * everyone using the extension and refuses politely once it is spent. The cap
 * is not here to protect a bill - there is no bill - but to stop one heavy
 * session exhausting the shared quota and making the extension look broken for
 * everyone else. It is client-side and therefore trusting rather than
 * enforced, which is the right trade for a free tool.
 */
const DAILY_LIMIT = 30;
// The deep pass runs a much larger model, so it draws more of the allowance.
const COST = { fast: 1, deep: 3 };

function today() {
  // Local date, so the reset happens at the reader's midnight, not UTC's.
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

async function readUsage() {
  try {
    const { usage } = await chrome.storage.local.get('usage');
    if (usage?.date === today()) return usage;
  } catch {
    // storage unavailable - treat as a fresh day rather than blocking the read
  }
  return { date: today(), used: 0 };
}

async function remainingToday() {
  const usage = await readUsage();
  return Math.max(0, DAILY_LIMIT - usage.used);
}

/** A retry of the same request within this window isn't charged again, here or on the server. */
const REPEAT_WINDOW_MS = 120_000;

async function alreadyCharged(requestId) {
  if (!requestId) return false;
  try {
    const { charged = {} } = await chrome.storage.local.get('charged');
    const now = Date.now();
    const recent = Object.fromEntries(Object.entries(charged).filter(([, at]) => now - at < REPEAT_WINDOW_MS));
    const seen = requestId in recent;
    if (!seen) recent[requestId] = now;
    await chrome.storage.local.set({ charged: recent });
    return seen;
  } catch {
    return false;
  }
}

async function spend(depth, requestId) {
  const cost = COST[depth] ?? COST.fast;
  const usage = await readUsage();
  if (await alreadyCharged(requestId)) {
    return { ok: true, remaining: Math.max(0, DAILY_LIMIT - usage.used) };
  }

  if (usage.used + cost > DAILY_LIMIT) {
    return { ok: false, remaining: Math.max(0, DAILY_LIMIT - usage.used) };
  }

  const next = { date: usage.date, used: usage.used + cost };
  try {
    await chrome.storage.local.set({ usage: next });
  } catch {
    // If it cannot be recorded, let the request through rather than deny it.
  }
  return { ok: true, remaining: DAILY_LIMIT - next.used };
}

/**
 * A random id for this browser profile, made once and kept. It identifies the
 * install to the server's quota and nothing else: it is not tied to a person,
 * carries no personal detail, and is hashed before the server stores it.
 */
async function installId() {
  try {
    const stored = await chrome.storage.local.get('installId');
    if (stored?.installId) return stored.installId;
    const fresh = crypto.randomUUID();
    await chrome.storage.local.set({ installId: fresh });
    return fresh;
  } catch {
    // Without storage the server falls back to limiting by address.
    return null;
  }
}

async function apiBase() {
  try {
    const stored = await chrome.storage.local.get('apiBase');
    if (stored?.apiBase) return stored.apiBase;
  } catch {
    // storage unavailable - fall through to the default
  }
  return DEFAULT_API;
}

const FRIENDLY_STATUS = {
  429: 'Busy right now - a lot of people are reading. Try again in a minute.',
  500: 'The server hit a problem. Try again.',
  502: 'Could not reach the model. Try again.',
  503: 'The service is unavailable right now.',
};

// A single transient 5xx is common enough - the provider stalls, a dev server
// reloads mid-request - that retrying once quietly is better than showing the
// reader an error they would only dismiss and repeat themselves.
const RETRY_ONCE = new Set([500, 502, 503, 504]);

// Answers normally land in about two seconds, but the provider occasionally
// stalls for tens of seconds. Without a ceiling the card just spins forever.
const TIMEOUT_MS = { fast: 45_000, deep: 150_000 };

/** Origin and path only. See the note in content.js. */
function cleanUrl(href) {
  try {
    const { origin, pathname } = new URL(href);
    return origin + pathname;
  } catch {
    return undefined;
  }
}

async function call(endpoint, payload) {
  const base = await apiBase();
  const budget = TIMEOUT_MS[payload?.depth === 'deep' ? 'deep' : 'fast'];
  const id = await installId();

  // Stripped again here rather than trusting the caller. This is the single
  // place anything leaves the browser, so it is the place the guarantee is
  // worth making.
  const body = payload?.url ? { ...payload, url: cleanUrl(payload.url) } : payload;

  let response;
  try {
    response = await fetch(`${base}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(id ? { 'X-Install-Id': id } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(budget),
    });
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new Error(`Took longer than ${Math.round(budget / 1000)}s. Try again.`);
    }
    throw error;
  }

  if (!response.ok && RETRY_ONCE.has(response.status) && !payload.__retried) {
    await new Promise((resolve) => setTimeout(resolve, 900));
    return call(endpoint, { ...payload, __retried: true });
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    // Prefer the API's own message; it knows more than the status code does.
    const error = new Error(
      data?.error || FRIENDLY_STATUS[response.status] || `Request failed (${response.status}).`,
    );
    // The allowance is spent, so offering to try again would only waste a tap.
    if (response.status === 429) error.overLimit = true;
    throw error;
  }

  return response.json();
}

/** The name of the manifest command; Chrome binds the suggested shortcut to it. */
const COMMAND = 'explain-selection';

/**
 * The shortcut Chrome actually assigned, as it displays it ("⇧⌘E",
 * "Ctrl+Shift+E"), or '' when it isn't assigned: another extension may hold
 * the same keys, or the reader may have cleared it in chrome://extensions/shortcuts.
 */
async function assignedShortcut() {
  try {
    const commands = await chrome.commands.getAll();
    return commands.find((c) => c.name === COMMAND)?.shortcut ?? '';
  } catch {
    return '';
  }
}

// Chrome handles the shortcut itself, before the page sees the keys, so sites
// that capture keystrokes (mail, editors) can't swallow it. Every frame in the
// tab gets the message; the one holding the selection opens the card.
chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== COMMAND || !tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { type: COMMAND }).catch(() => {
    // Restricted pages (the Web Store, chrome://) have no content script.
  });
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request?.type === 'shortcut') {
    assignedShortcut().then((shortcut) => sendResponse({ shortcut }));
    return true;
  }

  if (request?.type === 'usage') {
    remainingToday().then((remaining) =>
      sendResponse({ success: true, remaining, limit: DAILY_LIMIT }));
    return true;
  }

  if (request?.type !== 'explain') return false;

  const depth = request.payload?.depth === 'deep' ? 'deep' : 'fast';

  spend(depth)
    .then((allowance) => {
      if (!allowance.ok) {
        const err = new Error(
          depth === 'deep'
            ? `Not enough left today for a deep read (it uses ${COST.deep}). ${allowance.remaining} remaining, resets at midnight.`
            : `That is your ${DAILY_LIMIT} explanations for today. Resets at midnight.`,
        );
        err.overLimit = true;
        throw err;
      }
      return call('/api/explain', request.payload).then((data) =>
        sendResponse({ success: true, data, remaining: allowance.remaining }));
    })
    .catch((error) => {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      sendResponse({
        success: false,
        error: offline ? 'No internet connection.' : error.message,
        overLimit: Boolean(error.overLimit),
      });
    });

  return true; // keep the message channel open for the async reply
});

// Chrome does not inject content scripts into tabs that were already open when
// the extension was installed, and on an update it tears the chrome.* APIs out
// of the scripts already running there. Either way the person selects a
// passage, nothing happens, and they have no way to know a refresh would fix
// it. Re-inject on both events so the extension works in the tab they are
// already reading.
/**
 * Streaming answers, over a long-lived port.
 *
 * The card opens a port named "explain" and posts one request. This reads the
 * server's NDJSON stream and posts each event back as it arrives. Each message
 * on the port counts as extension activity, which keeps this service worker
 * alive while an answer is streaming. If the card closes, the port disconnects
 * and the request is aborted, so nothing keeps downloading for a card that's
 * gone.
 */
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'explain') return;
  const controller = new AbortController();
  let open = true;
  port.onDisconnect.addListener(() => { open = false; controller.abort(); });
  const post = (event) => { if (open) port.postMessage(event); };

  port.onMessage.addListener(async (message) => {
    if (message?.type !== 'explain') return;
    const { payload, requestId } = message;
    const depth = payload?.depth === 'deep' ? 'deep' : 'fast';
    try {
      const allowance = await spend(depth, requestId);
      if (!allowance.ok) {
        post({
          type: 'error', overLimit: true,
          message: depth === 'deep'
            ? `Not enough left today for a deep read (it uses ${COST.deep}). ${allowance.remaining} remaining, resets at midnight.`
            : `That is your ${DAILY_LIMIT} explanations for today. Resets at midnight.`,
        });
        return;
      }
      await stream(payload, requestId, controller.signal, (event) => {
        post(event.type === 'start' ? { ...event, remaining: allowance.remaining } : event);
      });
    } catch (error) {
      if (!open) return;
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      post({ type: 'error', partial: Boolean(error.partial), overLimit: Boolean(error.overLimit),
        message: offline ? 'No internet connection.' : error.message });
    }
  });
});

/** Reads the server's NDJSON events and hands each to `onEvent`. */
async function stream(payload, requestId, signal, onEvent, retried = false) {
  const base = await apiBase();
  const id = await installId();
  const body = { ...(payload?.url ? { ...payload, url: cleanUrl(payload.url) } : payload), stream: true };
  const budget = TIMEOUT_MS[payload?.depth === 'deep' ? 'deep' : 'fast'];
  let started = false;

  let response;
  try {
    response = await fetch(`${base}/api/explain`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(id ? { 'X-Install-Id': id } : {}),
        ...(requestId ? { 'X-Request-Id': requestId } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.any ? AbortSignal.any([signal, AbortSignal.timeout(budget)]) : signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error(error.name === 'TimeoutError' ? `Took longer than ${Math.round(budget / 1000)}s. Try again.` : 'Could not reach ContextReader. Check your connection and try again.');
  }

  if (!response.ok) {
    // Same request id, so the server doesn't charge the retry.
    if (RETRY_ONCE.has(response.status) && !retried) {
      await new Promise((resolve) => setTimeout(resolve, 900));
      return stream(payload, requestId, signal, onEvent, true);
    }
    const data = await response.json().catch(() => null);
    const error = new Error(data?.error || FRIENDLY_STATUS[response.status] || `Request failed (${response.status}).`);
    if (response.status === 429) error.overLimit = true;
    throw error;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        const event = JSON.parse(line);
        if (event.type === 'summary' || event.type === 'delta') started = true;
        onEvent(event);
        if (event.type === 'done' || event.type === 'error') return;
      }
    }
  } catch (error) {
    if (signal.aborted) throw error;
    const cut = new Error(started ? 'Answer cut off. Try again.' : 'Could not get an explanation. Try again.');
    cut.partial = started;
    throw cut;
  }
  // The stream ended without a done event: the connection dropped.
  const cut = new Error(started ? 'Answer cut off. Try again.' : 'Could not get an explanation. Try again.');
  cut.partial = started;
  throw cut;
}

chrome.runtime.onInstalled.addListener(async () => {
  const { js } = chrome.runtime.getManifest().content_scripts[0];
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  for (const tab of tabs) {
    // Restricted pages (the Web Store, chrome://, other extensions) refuse, and
    // that is fine. There is nothing to read there.
    chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: js }).catch(() => {});
  }
});
