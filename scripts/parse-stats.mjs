/**
 * How production replies parsed, per day: as sent, after mending stray quotes,
 * or not at all. Reads the counters the API keeps (numbers only, no text).
 *
 *   UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=... node scripts/parse-stats.mjs [days]
 */
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token) { console.error('Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (the production values).'); process.exit(1); }

const days = Number(process.argv[2] ?? 7);
const offset = Number(process.env.QUOTA_DAY_OFFSET_MINUTES ?? 330);
const today = Math.floor((Date.now() + offset * 60_000) / 86_400_000);
const outcomes = ['clean', 'repaired', 'failed'];
const keys = [];
for (let d = today - days + 1; d <= today; d++) for (const o of outcomes) keys.push(`parse:${d}:${o}`);

const res = await fetch(`${url}/pipeline`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(keys.map((k) => ['GET', k])),
});
const values = (await res.json()).map((r) => Number(r.result ?? 0));
for (let i = 0; i < keys.length; i += 3) {
  const day = new Date(Number(keys[i].split(':')[1]) * 86_400_000).toISOString().slice(0, 10);
  const [clean, repaired, failed] = values.slice(i, i + 3);
  const total = clean + repaired + failed;
  console.log(`${day}  ${total ? `${repaired + failed} of ${total} needed help (${repaired} mended, ${failed} unreadable)` : 'no requests'}`);
}
