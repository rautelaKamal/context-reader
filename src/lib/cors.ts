/**
 * Who is allowed to call the API.
 *
 * The browser sends the caller's origin, and this decides whether to echo it
 * back. Only the published extension and any ids named in the environment get
 * through. Previously any chrome-extension:// origin and any *.vercel.app host
 * were accepted, which is close to no restriction at all: extension ids are
 * public, and anyone can deploy to vercel.app.
 *
 * This is a seatbelt, not a lock. Browsers enforce it; curl and server side
 * scripts ignore it entirely. The per install and global quotas are what
 * actually bound the cost.
 */

/** The published extension. A constant so production cannot break if the env is unset. */
const STORE_EXTENSION_ID = 'jncoindjikmapfahhnljenbplfboglhf';

function allowedOrigins(): Set<string> {
  const extra = (process.env.ALLOWED_EXTENSION_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  const origins = [STORE_EXTENSION_ID, ...extra].map((id) => `chrome-extension://${id}`);

  // Only while developing. A production deployment never trusts localhost.
  if (process.env.NODE_ENV === 'development') {
    origins.push('http://localhost:3000', 'http://127.0.0.1:3000');
  }
  return new Set(origins);
}

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin');

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };

  if (origin && allowedOrigins().has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}
