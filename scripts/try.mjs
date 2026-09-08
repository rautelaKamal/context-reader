/**
 * Exercise the real explain/translate path against a live model.
 *
 *   node scripts/try.mjs --list-models
 *   node scripts/try.mjs sonnet
 *   node scripts/try.mjs editorial --mode point
 *   node scripts/try.mjs --text "your passage here" --mode plain
 *
 * Reads .env.local, so no keys are passed on the command line.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

for (const file of ['.env.local', '.env']) {
  const path = join(root, file);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}

const BASE = process.env.PROVIDER_BASE_URL ?? 'https://router.huggingface.co/v1';
const KEY = process.env.PROVIDER_API_KEY ?? process.env.HUGGING_FACE_API_KEY;
const MODEL = process.env.EXPLAIN_MODEL ?? 'Qwen/Qwen2.5-72B-Instruct';

if (!KEY) {
  console.error('No key found. Put PROVIDER_API_KEY=... in .env.local first.');
  process.exit(1);
}

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};

if (args.includes('--list-models')) {
  const res = await fetch(`${BASE}/models`, { headers: { Authorization: `Bearer ${KEY}` } });
  const body = await res.json();
  const ids = (body.data ?? []).map((m) => m.id).sort();
  console.log(`${ids.length} models available at ${BASE}:\n`);
  for (const id of ids) console.log(`  ${id}`);
  process.exit(0);
}

const SAMPLES = {
  sonnet: {
    selection: [
      "Shall I compare thee to a summer's day?",
      'Thou art more lovely and more temperate:',
      'Rough winds do shake the darling buds of May,',
      "And summer's lease hath all too short a date;",
    ].join('\n'),
    markedParagraph: [
      "«Shall I compare thee to a summer's day?",
      'Thou art more lovely and more temperate:',
      'Rough winds do shake the darling buds of May,',
      "And summer's lease hath all too short a date;»",
      'Sometime too hot the eye of heaven shines,',
      "And often is his gold complexion dimm'd;",
    ].join('\n'),
    title: 'Sonnet 18',
    site: 'poetryfoundation.org',
  },
  editorial: {
    selection: 'Every month of delay compounds an already serious deficit',
    markedParagraph:
      'But the argument wears thin in its fourth year. «Every month of delay compounds an ' +
      'already serious deficit»: welfare entitlements are still being apportioned on the basis ' +
      'of a population that no longer exists, and the schemes that depend on them are quietly ' +
      'shrinking in real terms.',
    precedingParagraph:
      'The decision to defer the census once more has been defended on administrative grounds, ' +
      'and there is no doubt that a headcount of this scale is a formidable undertaking.',
    title: 'The cost of counting late',
    site: 'thehindu.com',
    url: 'https://www.thehindu.com/opinion/editorial/the-cost-of-counting-late/article1.ece',
  },
  paper: {
    selection:
      'We replace the dense feed-forward block with a sparse mixture-of-experts layer using ' +
      'top-k routing, and add an auxiliary load-balancing loss.',
    markedParagraph:
      '«We replace the dense feed-forward block with a sparse mixture-of-experts layer using ' +
      'top-k routing, and add an auxiliary load-balancing loss.» This keeps expert utilisation ' +
      'from collapsing onto a small subset of capacity.',
    title: 'Scaling sparse models',
    site: 'arxiv.org',
    url: 'https://arxiv.org/abs/2401.00001',
  },
};

const out = join(root, '.test-build');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
execFileSync('npx', ['tsc', 'src/lib/modes.ts', 'src/lib/prompts.ts', 'src/lib/context.ts',
  '--outDir', out, '--module', 'commonjs', '--target', 'es2022', '--skipLibCheck'],
  { cwd: root, stdio: 'inherit' });
writeFileSync(join(out, 'package.json'), JSON.stringify({ type: 'commonjs' }));

const { createRequire } = await import('node:module');
const require = createRequire(import.meta.url);
const { detectMode } = require(join(out, 'modes.js'));
const { buildMessages, parseExplanation } = require(join(out, 'prompts.js'));

const name = args.find((a) => !a.startsWith('--')) ?? 'sonnet';
const text = flag('text');
const context = text ? { selection: text } : SAMPLES[name];

if (!context) {
  console.error(`Unknown sample "${name}". Try: ${Object.keys(SAMPLES).join(', ')}`);
  process.exit(1);
}

const mode = flag('mode') ?? detectMode({ selection: context.selection, url: context.url });
const messages = buildMessages(mode, context);

console.log(`model:  ${MODEL}`);
console.log(`base:   ${BASE}`);
console.log(`sample: ${text ? '(inline)' : name}`);
console.log(`mode:   ${mode}${flag('mode') ? '' : ' (auto-detected)'}\n`);

const started = Date.now();
const res = await fetch(`${BASE}/chat/completions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
  body: JSON.stringify({
    model: MODEL,
    messages,
    max_tokens: mode === 'lines' ? 1200 : 700,
    temperature: 0.1,
    ...(process.env.EFFORT ? { reasoning_effort: process.env.EFFORT } : {}),
  }),
});
const elapsed = Date.now() - started;

if (!res.ok) {
  console.error(`HTTP ${res.status}\n${(await res.text()).slice(0, 800)}`);
  process.exit(1);
}

const payload = await res.json();
const raw = payload.choices?.[0]?.message?.content ?? '';
const parsed = parseExplanation(raw);

console.log(`${elapsed} ms · ${payload.usage?.total_tokens ?? '?'} tokens · ` +
  `JSON ${parsed ? 'parsed OK' : 'FAILED TO PARSE'}\n`);
console.log('─'.repeat(72));

if (!parsed) {
  console.log(raw);
} else {
  if (parsed.summary) console.log(`\n${parsed.summary}\n`);
  for (const s of parsed.sections) {
    console.log(`  ${s.label.toUpperCase()}`);
    console.log(`  ${s.body.replace(/\n/g, '\n  ')}\n`);
  }
}
console.log('─'.repeat(72));
