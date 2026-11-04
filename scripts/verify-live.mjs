/**
 * Post-deploy check of the live API. Run it once Vercel has deployed main:
 *
 *   node scripts/verify-live.mjs [base-url]
 *
 * Uses a fresh test- install id, so it starts from a full allowance and
 * touches nobody's quota but its own. It sends 3 fast requests, 1 deep
 * request, 1 malformed request and 2 CORS preflights. Optional: with the
 * production UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN set, it also
 * reads the deep cap counter before and after (read-only, it never writes).
 *
 * Prints pass/fail per check and exits non-zero if any check fails.
 */
const BASE = (process.argv[2] ?? 'https://context-reader.vercel.app').replace(/\/$/, '');
const STORE_ORIGIN = 'chrome-extension://jncoindjikmapfahhnljenbplfboglhf';
const INSTALL = `test-verify-${Date.now()}`;
const rid = () => `test-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const PASSAGE = {
  selection: 'It would not be unfair to say that a plan announced in June, for a heatwave that began in April, is less a strategy than an apology written in advance.',
  markedParagraph: 'The new heat action plan is, on paper, admirable. «It would not be unfair to say that a plan announced in June, for a heatwave that began in April, is less a strategy than an apology written in advance.» The question is whether anyone will still be reading it by next summer.',
  precedingParagraph: 'For three summers running, the city has promised cooler streets and delivered press releases instead.',
  title: 'A plan for last summer',
  url: 'https://example.org/opinion/editorial/a-plan-for-last-summer',
};

const results = [];
const check = (name, ok, detail) => {
  results.push(ok);
  console.log(`${ok === null ? 'SKIP' : ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`);
};
const post = (body, { stream = false, requestId = rid(), raw } = {}) => fetch(`${BASE}/api/explain`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Origin: STORE_ORIGIN,
    'X-Install-Id': INSTALL,
    ...(requestId ? { 'X-Request-Id': requestId } : {}),
  },
  body: raw ?? JSON.stringify(stream ? { ...body, stream: true } : body),
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The deep cap's key: the Pacific calendar date, as the server counts it. */
function deepKey(now = Date.now()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(now).map((x) => [x.type, x.value]));
  return `cr:deep:${p.year}-${p.month}-${p.day}`;
}
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? async (key) => {
    const r = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` } });
    return Number((await r.json()).result ?? 0);
  }
  : null;

console.log(`Checking ${BASE} as install ${INSTALL}\n`);

// (a) The request 0.2.2 sends: no stream, no request id.
let remaining;
{
  const res = await post(PASSAGE, { requestId: null });
  const body = await res.json().catch(() => null);
  remaining = body?.quota?.remaining;
  check('(a) 0.2.2 request shape still answers with one JSON reply',
    res.status === 200 && typeof body?.summary === 'string' && body.summary.length > 0 && Array.isArray(body.sections) && typeof remaining === 'number',
    `status ${res.status}, ${body?.sections?.length ?? 0} sections, remaining ${remaining}, allowed origin echoed: ${res.headers.get('access-control-allow-origin') === STORE_ORIGIN}`);
  // A fresh install starts at 30; a counted first request leaves 29.
  if (remaining === 30) console.log('      note: this server did not count that request (no Redis configured?), so (b) and (d) cannot pass here');
}
await sleep(4500);

// (b) Streaming: events in order, ending with done.
{
  const res = await post(PASSAGE, { stream: true });
  const types = [];
  let start, done, firstWordsMs;
  const t0 = Date.now();
  if (res.ok) {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done: end } = await reader.read();
      if (end) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const e = JSON.parse(buf.slice(0, nl)); buf = buf.slice(nl + 1);
        types.push(e.type);
        if (e.type === 'start') start = e;
        if (e.type === 'summary' && firstWordsMs === undefined) firstWordsMs = Date.now() - t0;
        if (e.type === 'done') done = e;
      }
    }
  }
  const ordered = types[0] === 'start' && types.at(-1) === 'done' && types.includes('summary');
  const charged = typeof remaining === 'number' && start?.quota?.remaining === remaining - 1;
  check('(b) streaming answers with start, summary text, sections and done',
    res.ok && /ndjson/.test(res.headers.get('content-type') ?? '') && ordered && typeof done?.result?.summary === 'string' && charged,
    `status ${res.status}, events ${[...new Set(types)].join(' > ')}, first words ${firstWordsMs ?? '-'} ms, charged once: ${charged}`);
  remaining = start?.quota?.remaining ?? remaining;
}
await sleep(4500);

// (c) A deep request takes a slot from the deep cap.
let deepRefused = false;
{
  const key = deepKey();
  const before = redis ? await redis(key) : null;
  const res = await post({ ...PASSAGE, depth: 'deep' });
  const body = await res.json().catch(() => null);
  const after = redis ? await redis(key) : null;
  deepRefused = res.status === 503 && body?.code === 'deep_resting';
  if (deepRefused) {
    check('(c) deep request takes a deep cap slot', null,
      `the cap is already full today (deep_resting), so no slot could be taken. Key: ${key}`);
  } else {
    const slotTaken = redis ? after === before + 1 : null;
    const costThree = typeof remaining === 'number' && body?.quota?.remaining === remaining - 3;
    check('(c) deep request takes a deep cap slot and costs the reader three',
      res.status === 200 && costThree && slotTaken !== false,
      `status ${res.status}, reader remaining ${remaining} -> ${body?.quota?.remaining}. In Upstash, look for ${key}` +
      (redis ? `: ${before} -> ${after}` : ' (set UPSTASH_REDIS_REST_URL and _TOKEN to have this script read it)'));
    remaining = body?.quota?.remaining ?? remaining;
  }
}
await sleep(4500);

// (d) Refused requests don't change the reader's counter.
{
  const bad = await post(null, { raw: '{not json' });
  const res = await post(PASSAGE);
  const body = await res.json().catch(() => null);
  const unchanged = typeof remaining === 'number' && body?.quota?.remaining === remaining - 1;
  check(`(d) refused requests cost nothing: a malformed request${deepRefused ? ' and the deep refusal' : ''}`,
    bad.status === 400 && res.status === 200 && unchanged,
    `malformed -> ${bad.status}; next answer took remaining ${remaining} -> ${body?.quota?.remaining} (expected ${typeof remaining === 'number' ? remaining - 1 : '?'})` +
    (deepRefused ? '' : '. A live deep refusal was not exercised, because the cap was not full; unit tests cover it.'));
}

// (e) CORS: a foreign origin is not allowed; the extension is.
{
  const preflight = (origin) => fetch(`${BASE}/api/explain`, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' } });
  const foreign = await preflight('https://evil.example');
  const ours = await preflight(STORE_ORIGIN);
  const blocked = !foreign.headers.get('access-control-allow-origin');
  const allowed = ours.headers.get('access-control-allow-origin') === STORE_ORIGIN;
  check('(e) CORS blocks a foreign origin and allows the extension',
    blocked && allowed,
    `https://evil.example -> ${foreign.headers.get('access-control-allow-origin') ?? 'no Access-Control-Allow-Origin'}; extension -> ${ours.headers.get('access-control-allow-origin')}`);
}

const failed = results.filter((r) => r === false).length;
console.log(`\n${failed ? `${failed} check(s) failed` : 'all checks passed'}${results.includes(null) ? ' (some skipped, see above)' : ''}`);
process.exit(failed ? 1 : 0);
