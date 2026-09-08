/**
 * Runs the explainer over paragraphs pulled from real articles.
 *
 * The hand-written eval in eval.mjs checks known-answer cases. This checks
 * behaviour on prose nobody curated: real length, real syntax, real markup.
 * There is no ground truth here, so it scores two things that can be measured
 * without it:
 *
 *   restatement  - how much of the summary is just the selection's own words.
 *                  A high score means it paraphrased instead of explaining.
 *   unsupported  - proper nouns and numbers in the answer that appear nowhere
 *                  in the input. A hallucination proxy, not a proof.
 *
 *   npm run corpus
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const file of ['.env.local', '.env']) {
  const p = join(root, file);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const BASE = process.env.PROVIDER_BASE_URL;
const KEY = process.env.PROVIDER_API_KEY ?? process.env.HUGGING_FACE_API_KEY;
const MODEL = process.env.EXPLAIN_MODEL;
if (!KEY) { console.error('No key.'); process.exit(1); }

const out = join(root, '.test-build');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
execFileSync('npx', ['tsc', 'src/lib/modes.ts', 'src/lib/prompts.ts', 'src/lib/context.ts',
  '--outDir', out, '--module', 'commonjs', '--target', 'es2022', '--skipLibCheck'],
  { cwd: root, stdio: 'inherit' });
writeFileSync(join(out, 'package.json'), JSON.stringify({ type: 'commonjs' }));
const require = createRequire(import.meta.url);
const { detectMode } = require(join(out, 'modes.js'));
const { buildMessages, parseExplanation } = require(join(out, 'prompts.js'));

const ALL = JSON.parse(readFileSync(join(root, 'scripts', 'corpus-sources.json'), 'utf8'));
const only = process.argv.slice(2).find((a) => !a.startsWith('--'));
const SOURCES = only
  ? ALL.filter((s) => s.name.toLowerCase().includes(only.toLowerCase()))
  : ALL;

const ua = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' };

function decode(html) {
  return html
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&rsquo;|&#8217;/g, "'")
    .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/g, '"').replace(/&mdash;|&#8212;/g, '—')
    .replace(/&[a-z]+;/gi, ' ');
}

async function paragraphsFrom(source) {
  // Some publications render the article body in JavaScript, so a plain fetch
  // returns subscription furniture instead of prose. Those are captured from a
  // real browser into a local file and read from here.
  if (source.localFile) {
    if (!existsSync(source.localFile)) return [];
    return JSON.parse(readFileSync(source.localFile, 'utf8')).paragraphs;
  }

  // Gutenberg texts run to megabytes and the connection sometimes drops.
  let body = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(source.url, { headers: ua, signal: AbortSignal.timeout(45000) });
      body = await res.text();
      break;
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  if (source.plainText) {
    const start = body.indexOf(source.startAt);
    const slice = body.slice(start === -1 ? 0 : start, (start === -1 ? 0 : start) + 60000);
    const min = source.minLength ?? 260;
    const max = source.maxLength ?? 1400;
    return slice.split(/\n\s*\n/)
      // Verse depends on its line breaks; prose does not and reads better joined.
      .map((p) => (source.verse ? p.replace(/[ \t]+/g, ' ').trim() : p.replace(/\s*\n\s*/g, ' ').trim()))
      .filter((p) => p.length > min && p.length < max && !/^[A-Z\s.]+$/.test(p))
      .filter((p) => !source.verse || p.includes('\n'));
  }

  const stripped = body
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  const tags = source.tags ?? ['p'];
  const blocks = tags.flatMap((tag) =>
    [...stripped.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi'))]);

  return blocks
    .map((m) => decode(m[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > (source.minLength ?? 220) && p.length < (source.maxLength ?? 1400))
    .filter((p) => !/subscribe|newsletter|cookie|sign ?in|copyright|all rights reserved|click here|follow us|registered user|logged in|engage with our articles|your (subscription|account)/i.test(p))
    // Tag lists masquerade as paragraphs: many slashes, almost no sentences.
    .filter((p) => (p.match(/\//g) ?? []).length < 5);
}

/** Pick a clause a reader would plausibly highlight: the longest sentence. */
function pickSelection(paragraph) {
  const sentences = paragraph.match(/[^.!?]+[.!?]+/g) ?? [paragraph];
  return sentences.map((s) => s.trim()).sort((a, b) => b.length - a.length)[0].slice(0, 600);
}

const STOP = new Set(('the a an and or but of to in for on with that this it is are was were be been as at by from ' +
  'not no so if then than which who whom whose what when where how they them their there here have has had do does ' +
  'did will would can could should may might must its it s his her he she we you i our your').split(' '));

const words = (t) => (t.toLowerCase().match(/[a-z']{4,}/g) ?? []).filter((w) => !STOP.has(w));

function restatement(summary, selection) {
  const src = new Set(words(selection));
  const sum = words(summary);
  if (!sum.length) return 1;
  return sum.filter((w) => src.has(w)).length / sum.length;
}

/**
 * Names and dates in the answer that appear nowhere in the input.
 *
 * Two refinements over the obvious version, both learned from false results:
 * single proper nouns have to count (the run that invented a character called
 * Krogstad slipped through a multi-word-only pattern), and words that merely
 * start a sentence have to not count, or every "While" and "The" is a finding.
 */
const SENTENCE_START = /(^|[.!?:;]\s+|\n\s*|["'(\[]\s*)$/;

function unsupported(answer, inputText) {
  const haystack = inputText.toLowerCase();
  const found = new Set();

  for (const m of answer.match(/\b(1[6-9]\d{2}|20\d{2})\b/g) ?? []) {
    if (!haystack.includes(m)) found.add(m);
  }

  const name = /\b[A-Z][a-z]{2,}(?:\s+(?:of|the|de|van|von)?\s*[A-Z][a-z]{2,})*/g;
  for (const match of answer.matchAll(name)) {
    const term = match[0];
    if (SENTENCE_START.test(answer.slice(0, match.index))) continue;
    // A multi-word name counts as supported if every word of it appears.
    const parts = term.split(/\s+/).filter((w) => /^[A-Z]/.test(w));
    // Tolerate morphology: "Lucases" from "Lucas", "American" from "America"
    // are the answer inflecting a name the passage already contains.
    const present = (w) => {
      const lower = w.toLowerCase();
      return [lower, lower.replace(/(es|s|n|an|ian)$/, ''), lower.replace(/s$/, '')]
        .some((form) => form.length > 2 && haystack.includes(form));
    };
    if (parts.every(present)) continue;
    found.add(term);
  }
  return [...found];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = [];

for (const source of SOURCES) {
  let paras;
  try {
    paras = await paragraphsFrom(source);
  } catch (e) {
    console.log(`!! ${source.name}: fetch failed - ${e.message}\n`);
    continue;
  }
  if (paras.length < 1) {
    console.log(`!! ${source.name}: no usable paragraphs, skipping\n`);
    continue;
  }

  const solo = paras.length === 1;
  const take = solo ? 1 : Math.min(source.take ?? 2, paras.length - 1);
  console.log(`\n${'█'.repeat(72)}\n${source.name}  (${paras.length} paragraphs found)\n${source.url}\n`);

  for (let step = 0; step < take; step++) {
    const i = solo ? 0 : step + 1;
    const paragraph = paras[i];
    const selection = source.verse ? paragraph : pickSelection(paragraph);
    const context = {
      selection,
      markedParagraph: source.verse ? `«${paragraph}»` : paragraph.replace(selection, `«${selection}»`),
      precedingParagraph: i > 0 ? paras[i - 1] : undefined,
      title: source.title,
      site: source.site,
      url: source.url,
    };
    const mode = source.mode ?? detectMode({ selection, url: source.url });

    const started = Date.now();
    let raw = '';
    try {
      const res = await fetch(`${BASE}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
        body: JSON.stringify({ model: MODEL, messages: buildMessages(mode, context),
          max_tokens: mode === 'lines' ? 1400 : 1100, temperature: 0.1 }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
      raw = (await res.json()).choices?.[0]?.message?.content ?? '';
    } catch (e) {
      console.log(`  ✗ request failed: ${e.message}\n`);
      rows.push({ source: source.name, ok: false });
      continue;
    }
    const ms = Date.now() - started;

    const parsed = parseExplanation(raw);
    const answer = parsed
      ? [parsed.summary, ...parsed.sections.map((s) => `${s.label}: ${s.body}`)].join('\n')
      : raw;
    const inputText = [selection, context.markedParagraph, context.precedingParagraph, source.title].join(' ');

    const r = parsed ? restatement(parsed.summary, selection) : 1;
    const u = unsupported(answer, inputText);

    rows.push({ source: source.name, mode, ms, parsed: !!parsed, restatement: r, unsupported: u.length,
      sections: parsed?.sections.length ?? 0 });

    console.log(`  [${mode}] ${ms}ms  json:${parsed ? 'ok' : 'FAIL'}  restatement:${(r * 100).toFixed(0)}%  unsupported:${u.length ? u.join(', ') : 'none'}`);
    console.log(`  SELECTED  ${selection.slice(0, 150)}${selection.length > 150 ? '…' : ''}`);
    if (parsed) {
      console.log(`  SUMMARY   ${parsed.summary}`);
      for (const s of parsed.sections) console.log(`  · ${s.label}: ${s.body.slice(0, 260)}`);
    } else {
      console.log(`  RAW  ${raw.slice(0, 300)}`);
    }
    console.log();
    await sleep(4500);
  }
}

const ok = rows.filter((r) => r.parsed);
console.log(`${'='.repeat(72)}`);
console.log(`passages: ${rows.length}   json parsed: ${ok.length}/${rows.length}`);
if (ok.length) {
  const avg = (f) => (ok.reduce((a, r) => a + f(r), 0) / ok.length);
  console.log(`median latency: ${ok.map((r) => r.ms).sort((a, b) => a - b)[Math.floor(ok.length / 2)]}ms`);
  console.log(`mean restatement: ${(avg((r) => r.restatement) * 100).toFixed(0)}%  (lower is better - high means it echoed the passage)`);
  console.log(`passages with unsupported specifics: ${ok.filter((r) => r.unsupported > 0).length}/${ok.length}`);
  console.log(`mean sections: ${avg((r) => r.sections).toFixed(1)}`);
}
