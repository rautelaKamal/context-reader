/**
 * The API is called from the extension's content script, which sends the page's
 * origin - so the previous `*` meant any website could spend the project's
 * inference budget. Allow extension origins and our own site, and let the rate
 * limiter handle what is left.
 */

const ALLOWED_SUFFIXES = ['.vercel.app'];

function isAllowed(origin: string): boolean {
  if (origin.startsWith('chrome-extension://')) return true;
  if (origin.startsWith('moz-extension://')) return true;
  if (origin.startsWith('safari-web-extension://')) return true;

  try {
    const { hostname, protocol } = new URL(origin);
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    if (protocol !== 'https:') return false;
    if (hostname === 'context-reader.vercel.app') return true;
    return ALLOWED_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
  } catch {
    return false;
  }
}

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin');

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };

  if (origin && isAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}
