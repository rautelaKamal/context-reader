/**
 * Service worker.
 *
 * All network calls go through here rather than the content script: the page's
 * Content-Security-Policy does not apply, and requests carry the extension's
 * own origin instead of whatever site the reader happens to be on.
 */

const DEFAULT_API = 'https://context-reader.vercel.app';

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
  429: 'Too many requests just now. Give it a moment.',
  503: 'The service is not configured yet.',
};

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

  if (!response.ok) {
    let message = FRIENDLY_STATUS[response.status];
    if (!message) {
      const data = await response.json().catch(() => null);
      message = data?.error || `Request failed (${response.status}).`;
    }
    throw new Error(message);
  }

  return response.json();
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request?.type !== 'explain' && request?.type !== 'translate') return false;

  const endpoint = request.type === 'translate' ? '/api/translate' : '/api/explain';

  call(endpoint, request.payload)
    .then((data) => sendResponse({ success: true, data }))
    .catch((error) => {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      sendResponse({
        success: false,
        error: offline ? 'No internet connection.' : error.message,
      });
    });

  return true; // keep the message channel open for the async reply
});
