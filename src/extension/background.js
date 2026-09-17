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

async function spend(depth) {
  const cost = COST[depth] ?? COST.fast;
  const usage = await readUsage();

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
const TIMEOUT_MS = { fast: 30_000, deep: 120_000 };

async function call(endpoint, payload) {
  const base = await apiBase();
  const budget = TIMEOUT_MS[payload?.depth === 'deep' ? 'deep' : 'fast'];

  let response;
  try {
    response = await fetch(`${base}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
    throw new Error(
      data?.error || FRIENDLY_STATUS[response.status] || `Request failed (${response.status}).`,
    );
  }

  return response.json();
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request?.type === 'usage') {
    remainingToday().then((remaining) =>
      sendResponse({ success: true, remaining, limit: DAILY_LIMIT }));
    return true;
  }

  if (request?.type !== 'explain' && request?.type !== 'translate') return false;

  const endpoint = request.type === 'translate' ? '/api/translate' : '/api/explain';
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
      return call(endpoint, request.payload).then((data) =>
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
chrome.runtime.onInstalled.addListener(async () => {
  const { js } = chrome.runtime.getManifest().content_scripts[0];
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  for (const tab of tabs) {
    // Restricted pages (the Web Store, chrome://, other extensions) refuse, and
    // that is fine. There is nothing to read there.
    chrome.scripting.executeScript({ target: { tabId: tab.id }, files: js }).catch(() => {});
  }
});
