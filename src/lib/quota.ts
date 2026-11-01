/**
 * Server enforced daily quota.
 *
 * The extension also counts usage in chrome.storage, but that lives on the
 * reader's machine and clearing it resets the allowance, so it is a courtesy
 * rather than a limit. This counts on the server, where nobody can reach it.
 *
 * Three counters per day:
 *   install  one browser profile, the normal fairness limit
 *   ip       catches someone minting fresh install ids from one machine
 *   global   a hard ceiling on the whole service, so the bill cannot run away
 *            even if the first two are defeated
 */

export type Depth = 'fast' | 'deep';

export const COST: Record<Depth, number> = { fast: 1, deep: 3 };

export interface Limits {
  perInstall: number;
  perIp: number;
  global: number;
  /** Minutes to shift the day boundary by, for matching the audience's midnight. */
  dayOffsetMinutes: number;
}

export interface QuotaDecision {
  ok: boolean;
  /** Of this install's daily allowance. */
  remaining: number;
  /** Epoch seconds when the counters roll over. */
  resetAt: number;
  /** Which counter refused. Absent when allowed. */
  reason?: 'install' | 'ip' | 'global';
  /** False when the store was unreachable and the request was let through. */
  enforced: boolean;
}

/** One round trip of Redis commands. Injected so tests need no Redis. */
export type Pipeline = (commands: (string | number)[][]) => Promise<unknown[]>;

export function limitsFromEnv(): Limits {
  const num = (name: string, fallback: number) => {
    const parsed = Number(process.env[name]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  return {
    perInstall: num('DAILY_PER_INSTALL', 30),
    perIp: num('DAILY_PER_IP', 90),
    global: num('DAILY_GLOBAL_BUDGET', 2000),
    // India by default, because that is where the readers are and because
    // the extension tells them the allowance resets at midnight. On UTC that
    // sentence is wrong by five and a half hours.
    dayOffsetMinutes: Number(process.env.QUOTA_DAY_OFFSET_MINUTES ?? 330),
  };
}

/** The day key and when it rolls over, both shifted by the configured offset. */
export function dayWindow(offsetMinutes: number, now = Date.now()) {
  const shifted = now + offsetMinutes * 60_000;
  const dayNumber = Math.floor(shifted / 86_400_000);
  return {
    key: String(dayNumber),
    resetAt: Math.floor(((dayNumber + 1) * 86_400_000 - offsetMinutes * 60_000) / 1000),
  };
}

/** Hashed so raw addresses are never written to the store. */
async function hashed(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(`context-reader:${value}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

export async function spend(
  pipeline: Pipeline | null,
  { installId, ip, cost, limits, now, log = console.warn }:
  {
    installId: string | null; ip: string; cost: number; limits: Limits;
    now?: number; log?: (message: string) => void;
  },
): Promise<QuotaDecision> {
  const { key: day, resetAt } = dayWindow(limits.dayOffsetMinutes, now);

  // No store configured or reachable: let the reader through rather than
  // break a working product over infrastructure. The global cap is the thing
  // this gives up, so an outage is worth knowing about.
  if (!pipeline) {
    log('quota: no store configured, request allowed without being counted. '
      + 'Nothing is enforcing the daily or global limits.');
    return { ok: true, remaining: limits.perInstall, resetAt, enforced: false };
  }

  // Two days, so a counter written just before the rollover still expires.
  const ttl = 172_800;
  // An install id only arrives from an updated extension. Older ones are held
  // to the address limit alone rather than refused.
  const installKey = installId ? `cr:i:${await hashed(installId)}:${day}` : null;
  const ipKey = `cr:p:${await hashed(ip)}:${day}`;
  const globalKey = `cr:g:${day}`;

  const keys = [installKey, ipKey, globalKey].filter((k): k is string => k !== null);
  const commands = keys.flatMap((k) => [['INCRBY', k, cost], ['EXPIRE', k, ttl]]);

  let totals: number[];
  try {
    const replies = await pipeline(commands);
    // Every other reply is the INCRBY result; the EXPIREs are housekeeping.
    totals = keys.map((_, i) => Number(replies[i * 2]));
    if (totals.some((n) => !Number.isFinite(n))) throw new Error('unexpected reply');
  } catch (error) {
    // Every occurrence, not once: while this is happening there is no ceiling
    // on spending, so the volume of these lines is the size of the problem.
    log(`quota: store unreachable, request allowed without being counted. `
      + `${error instanceof Error ? error.message : String(error)}`);
    return { ok: true, remaining: limits.perInstall, resetAt, enforced: false };
  }

  const used = Object.fromEntries(keys.map((k, i) => [k, totals[i]]));
  const installUsed = installKey ? used[installKey] : 0;
  const remaining = Math.max(0, limits.perInstall - installUsed);

  // Checked after incrementing, so a refused request still counts. That is
  // deliberate: it costs one round trip instead of two, and it pushes a
  // client that keeps hammering further away rather than letting it retry
  // for free.
  let reason: QuotaDecision['reason'];
  if (used[globalKey] > limits.global) reason = 'global';
  else if (installKey && installUsed > limits.perInstall) reason = 'install';
  else if (used[ipKey] > limits.perIp) reason = 'ip';

  return { ok: !reason, remaining, resetAt, reason, enforced: true };
}

/** The live Upstash pipeline, or null when the store is not configured. */
export function upstashPipeline(): Pipeline | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  return async (commands) => {
    const response = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) throw new Error(`redis ${response.status}`);
    // Upstash replies [{ result }, ...], one entry per command, in order.
    return (await response.json() as { result: unknown }[]).map((r) => r.result);
  };
}

export function quotaHeaders(decision: QuotaDecision): Record<string, string> {
  return {
    'X-Quota-Remaining': String(decision.remaining),
    'X-Quota-Reset': String(decision.resetAt),
  };
}

export function refusalMessage(decision: QuotaDecision): string {
  const minutes = Math.max(1, Math.round((decision.resetAt * 1000 - Date.now()) / 60_000));
  const when = minutes < 90 ? `in ${minutes} minutes` : `in ${Math.round(minutes / 60)} hours`;
  if (decision.reason === 'global') {
    return `ContextReader has hit its limit for today across everyone using it. It comes back ${when}.`;
  }
  if (decision.reason === 'ip') {
    return `This network has used today's explanations. They come back ${when}.`;
  }
  return `That is your explanations for today. They come back ${when}.`;
}
