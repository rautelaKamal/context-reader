/**
 * Best-effort rate limiting.
 *
 * This is in-process, so on serverless it limits per instance rather than
 * globally - a real ceiling needs a shared store (Upstash, Vercel KV). It is
 * still worth having: it stops a single client hammering one instance, and it
 * keeps the limit logic in one place for when that store is added.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const MAX_TRACKED = 5000;

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  return ip;
}

export function checkRateLimit(key: string, now = Date.now()): RateLimitResult {
  if (buckets.size > MAX_TRACKED) {
    for (const [k, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(k);
    }
  }

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, remaining: MAX_PER_WINDOW - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= MAX_PER_WINDOW) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return {
    ok: true,
    remaining: MAX_PER_WINDOW - existing.count,
    retryAfterSeconds: 0,
  };
}
