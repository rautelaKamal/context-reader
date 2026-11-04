/**
 * Time to first words and total time, streaming and not, fast and deep.
 *
 *   node scripts/timing.mjs [base-url] [requests-each] [--include-deep]
 *
 * Point it at a local server (npm run build && npx next start) running with a
 * test key. Not streaming, the reader sees nothing until the whole answer has
 * arrived, so first words equal total time. Streaming, first words are the
 * first summary event and total time is the done event.
 */
import { readFileSync } from 'node:fs';
import { warnIfProductionKey } from './key-guard.mjs';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const BASE = args[0] ?? 'http://localhost:3000';
const N = Number(args[1] ?? 10);
const INCLUDE_DEEP = process.argv.includes('--include-deep');
const passages = JSON.parse(readFileSync(new URL('./timing-passages.json', import.meta.url), 'utf8'));

// The local server spends the key in .env; check it before sending anything.
for (const file of ['.env', '.env.local']) {
  try {
    for (const line of readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').split('\n')) {
      const m = /^\s*(PROVIDER_API_KEY|HUGGING_FACE_API_KEY|PROD_KEY_HASH)\s*=\s*(.*)\s*$/.exec(line);
      if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* no such file */ }
}
warnIfProductionKey(process.env.PROVIDER_API_KEY ?? process.env.HUGGING_FACE_API_KEY);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)]; };
const fmt = (ms) => `${(ms / 1000).toFixed(1)}s`;

async function once(payload, stream) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Install-Id': `test-timing-${t0}`, 'X-Request-Id': `test-${t0}-${Math.random().toString(36).slice(2, 10)}` },
    body: JSON.stringify({ ...payload, ...(stream ? { stream: true } : {}) }),
  });
  if (!stream) {
    const body = await res.json().catch(() => ({}));
    const total = Date.now() - t0;
    return res.ok && body.summary ? { first: total, total } : { error: `HTTP ${res.status}` };
  }
  if (!res.ok) return { error: `HTTP ${res.status}` };
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '', first = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) !== -1) {
      const e = JSON.parse(buf.slice(0, nl)); buf = buf.slice(nl + 1);
      if (e.type === 'summary' && first === null) first = Date.now() - t0;
      if (e.type === 'done') return { first, total: Date.now() - t0 };
      if (e.type === 'error') return { error: e.message };
    }
  }
  return { error: 'ended without done' };
}

for (const depth of INCLUDE_DEEP ? ['fast', 'deep'] : ['fast']) {
  for (const stream of [false, true]) {
    const firsts = [], totals = [], errors = [];
    for (let i = 0; i < N; i++) {
      const p = { ...passages[i % passages.length], ...(depth === 'deep' ? { depth: 'deep' } : {}) };
      const r = await once(p, stream);
      if (r.error) errors.push(r.error); else { firsts.push(r.first); totals.push(r.total); }
      await sleep(depth === 'deep' ? 6000 : 4500);
    }
    const ok = firsts.length;
    console.log(`${depth} ${stream ? 'streaming    ' : 'not streaming'}  ${ok}/${N} ok   first words p50 ${ok ? fmt(pct(firsts, 0.5)) : '-'} p95 ${ok ? fmt(pct(firsts, 0.95)) : '-'}   total p50 ${ok ? fmt(pct(totals, 0.5)) : '-'} p95 ${ok ? fmt(pct(totals, 0.95)) : '-'}${errors.length ? `   errors: ${[...new Set(errors)].join('; ')}` : ''}`);
  }
}
