/**
 * Time to first words and total time, streaming and not, fast and deep.
 *
 *   node scripts/timing.mjs [base-url] [requests-each] [--include-deep]
 *
 * Point it at a local server (npm run build && npx next start) running with a
 * test key. Not streaming, the reader sees nothing until the whole answer has
 * arrived, so first words equal total time. Streaming, first words are the
 * first summary event and total time is the done event.
 *
 *   node scripts/timing.mjs <base-url> [fast-runs] --events [--include-deep]
 *
 * --events prints what one reply looks like on the wire, to tell a buffered
 * stream from one that arrives in big chunks: time to first byte and first
 * text, chunks and events, gaps between text, total time. With --include-deep
 * it adds one deep run. It asks for the encodings Chrome asks for, since
 * compression is a common cause of buffering.
 */
import { readFileSync } from 'node:fs';
import { warnIfProductionKey } from './key-guard.mjs';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const BASE = args[0] ?? 'http://localhost:3000';
const N = Number(args[1] ?? 10);
const INCLUDE_DEEP = process.argv.includes('--include-deep');
const EVENTS = process.argv.includes('--events');
const LOCAL = /\/\/(localhost|127\.0\.0\.1)\b/.test(BASE);
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
if (LOCAL) warnIfProductionKey(process.env.PROVIDER_API_KEY ?? process.env.HUGGING_FACE_API_KEY);
else console.warn(`Measuring ${BASE}: these requests spend that server's quota.`);
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

async function wire(payload) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept-Encoding': 'gzip, deflate, br, zstd', 'X-Install-Id': `test-timing-${t0}`, 'X-Request-Id': `test-${t0}-${Math.random().toString(36).slice(2, 10)}` },
    body: JSON.stringify({ ...payload, stream: true }),
  });
  const r = { status: res.status, ttfb: Date.now() - t0, encoding: res.headers.get('content-encoding') ?? 'none', chunks: 0, events: {}, text: [], total: null };
  if (!res.ok) return r;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const at = Date.now() - t0;
    r.chunks += 1;
    buf += dec.decode(value, { stream: true });
    let chars = 0, nl;
    while ((nl = buf.indexOf('\n')) !== -1) {
      const e = JSON.parse(buf.slice(0, nl)); buf = buf.slice(nl + 1);
      r.events[e.type] = (r.events[e.type] ?? 0) + 1;
      if (e.type === 'summary' || e.type === 'delta') chars += e.text.length;
      if (e.type === 'done') r.total = at;
      if (e.type === 'error') r.error = e.message;
    }
    if (chars) r.text.push({ at, chars });
  }
  return r;
}

function report(label, r) {
  if (r.status !== 200) return console.log(`${label}  HTTP ${r.status}`);
  const gaps = r.text.slice(1).map((x, i) => x.at - r.text[i].at);
  const chars = r.text.reduce((n, x) => n + x.chars, 0);
  const biggest = Math.max(0, ...r.text.map((x) => x.chars));
  console.log(`${label}  first byte ${r.ttfb}ms  first text ${r.text[0]?.at ?? '-'}ms  total ${r.total ?? '-'}ms  encoding ${r.encoding}${r.error ? `  ERROR ${r.error}` : ''}`);
  console.log(`  ${r.chunks} chunks, events ${JSON.stringify(r.events)}`);
  console.log(`  ${r.text.length} chunks with text, ${chars} chars, biggest ${biggest} (${chars ? Math.round(biggest / chars * 100) : 0}%), gap median ${gaps.length ? pct(gaps, 0.5) : '-'}ms max ${gaps.length ? Math.max(...gaps) : '-'}ms, last text to done ${r.total && r.text.length ? r.total - r.text.at(-1).at : '-'}ms`);
  console.log(`  timeline ms:chars ${r.text.map((x) => `${x.at}:${x.chars}`).join(' ')}`);
}

if (EVENTS) {
  for (let i = 0; i < N; i++) {
    report(`fast ${i + 1}`, await wire(passages[i % passages.length]));
    await sleep(4500);
  }
  if (INCLUDE_DEEP) report('deep 1', await wire({ ...passages[0], depth: 'deep' }));
  process.exit(0);
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
