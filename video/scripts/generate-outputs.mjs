/**
 * Fetches real explanations for the film's passages from the live API, the
 * same endpoint and request shape the extension uses, and saves them to
 * content/demo-outputs.json. The film renders from that file only.
 *
 * Outputs are never edited. One attempt per passage, recorded, so a weak
 * result is replaced by changing the passage, not by re-rolling until lucky.
 * Refuses to overwrite existing results without --force.
 *
 *   node video/scripts/generate-outputs.mjs [--force]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'content', 'demo-outputs.json');
const API = 'https://context-reader.vercel.app/api/explain';

const PASSAGES = [
  {
    id: 'editorial', scene: 'hook, struggle, aha, answer', lens: 'point',
    source: 'Original editorial-style paragraph written for this film.',
    licence: 'Ours.',
    payload: {
      precedingParagraph: 'For three summers running, the city has promised cooler streets and delivered press releases instead.',
      selection: 'It would not be unfair to say that a plan announced in June, for a heatwave that began in April, is less a strategy than an apology written in advance.',
      markedParagraph: 'The new heat action plan is, on paper, admirable. «It would not be unfair to say that a plan announced in June, for a heatwave that began in April, is less a strategy than an apology written in advance.» The question is whether anyone will still be reading it by next summer.',
      title: 'A plan for last summer',
      url: 'https://example.org/opinion/editorial/a-plan-for-last-summer',
    },
  },
  {
    id: 'poem', scene: 'any hard reading', lens: 'lines',
    source: 'William Shakespeare, Sonnet 73 (1609). Verified against Project Gutenberg #1041.',
    licence: 'Public domain.',
    payload: {
      selection: "That time of year thou mayst in me behold\nWhen yellow leaves, or none, or few, do hang\nUpon those boughs which shake against the cold,\nBare ruin'd choirs, where late the sweet birds sang.",
      markedParagraph: "«That time of year thou mayst in me behold\nWhen yellow leaves, or none, or few, do hang\nUpon those boughs which shake against the cold,\nBare ruin'd choirs, where late the sweet birds sang.»",
      title: 'Sonnet 73', url: 'https://example.org/poems/sonnet-73',
    },
  },
  {
    id: 'research', scene: 'any hard reading', lens: 'jargon',
    source: 'Charles Darwin, On the Origin of Species (1859), ch. IV. Verified against Project Gutenberg #1228.',
    licence: 'Public domain.',
    payload: {
      selection: 'It may be said that natural selection is daily and hourly scrutinising, throughout the world, every variation, even the slightest; rejecting that which is bad, preserving and adding up all that is good; silently and insensibly working, whenever and wherever opportunity offers, at the improvement of each organic being in relation to its organic and inorganic conditions of life.',
      markedParagraph: '«It may be said that natural selection is daily and hourly scrutinising, throughout the world, every variation, even the slightest; rejecting that which is bad, preserving and adding up all that is good; silently and insensibly working, whenever and wherever opportunity offers, at the improvement of each organic being in relation to its organic and inorganic conditions of life.»',
      title: 'On the Origin of Species', url: 'https://example.org/books/origin-of-species',
    },
  },
  {
    id: 'legal', scene: 'any hard reading', lens: 'plain',
    source: 'Marbury v. Madison, 5 U.S. 137 (1803). Verified against Cornell LII.',
    licence: 'Public domain: a US government work.',
    payload: {
      selection: 'So if a law be in opposition to the constitution: if both the law and the constitution apply to a particular case, so that the court must either decide that case conformably to the law, disregarding the constitution; or conformably to the constitution, disregarding the law: the court must determine which of these conflicting rules governs the case.',
      markedParagraph: '«So if a law be in opposition to the constitution: if both the law and the constitution apply to a particular case, so that the court must either decide that case conformably to the law, disregarding the constitution; or conformably to the constitution, disregarding the law: the court must determine which of these conflicting rules governs the case.» This is of the very essence of judicial duty.',
      title: 'Marbury v. Madison', url: 'https://example.org/judgments/marbury-v-madison',
    },
  },
];

const norm = (t) => t.toLowerCase().replace(/[‘’“”"'«»]/g, '').replace(/\s+/g, ' ').trim();

// Punctuation at the edge of a quote is the writer's, not the passage's:
// "disregarding the law." quotes a phrase that ends in a colon in the source.
const trimEdge = (t) => t.replace(/^[\s.,;:!?]+|[\s.,;:!?]+$/g, '');

/**
 * Every piece of evidence in the answer, and whether it really appears in the
 * passage: spans in quotation marks, plus section headings for the lenses
 * whose headings are the quoted line or term (line by line, how it works,
 * the jargon).
 */
function checkQuotes(response, payload) {
  const source = norm([payload.precedingParagraph, payload.markedParagraph, payload.selection].filter(Boolean).join(' '));
  const text = [response.summary, ...(response.sections ?? []).map((s) => s.body)].join('\n');
  const quoted = [...text.matchAll(/["“]([^"”]{2,200})["”]/g)].map((m) => ({ quote: m[1], kind: 'quoted' }));
  const headed = ['lines', 'craft', 'jargon'].includes(response.mode)
    ? (response.sections ?? []).map((s) => ({ quote: s.label, kind: 'heading' })) : [];
  return [...quoted, ...headed].map((q) => ({ ...q, inPassage: source.includes(norm(trimEdge(q.quote))) }));
}

// --recheck recomputes the evidence check from the saved answers. It never
// calls the API, so the answers themselves cannot change.
if (process.argv.includes('--recheck')) {
  const saved = JSON.parse(readFileSync(OUT, 'utf8'));
  for (const o of saved.outputs) o.quotes = checkQuotes(o.response, PASSAGES.find((x) => x.id === o.id).payload);
  writeFileSync(OUT, `${JSON.stringify(saved, null, 2)}\n`);
  console.log('rechecked evidence; answers unchanged');
  process.exit(0);
}

if (existsSync(OUT) && !process.argv.includes('--force')) {
  console.error(`${OUT} exists. Outputs are not regenerated silently; pass --force to replace them.`);
  process.exit(1);
}

const installId = `film-generator-${Date.now()}`;
const results = [];
for (const p of PASSAGES) {
  const requestBody = { ...p.payload, mode: p.lens };
  const started = Date.now();
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Install-Id': installId },
    body: JSON.stringify(requestBody),
  });
  const response = await res.json();
  results.push({
    id: p.id, scene: p.scene, source: p.source, licence: p.licence,
    attempt: 1, fetchedAt: new Date().toISOString(), endpoint: API,
    httpStatus: res.status, latencyMs: Date.now() - started,
    request: requestBody, response,
    quotes: checkQuotes(response, p.payload),
  });
  console.log(`${p.id}: HTTP ${res.status} in ${Date.now() - started}ms, mode ${response.mode}`);
}

writeFileSync(OUT, `${JSON.stringify({
  note: 'Real outputs from the live ContextReader API. Never edit by hand; regenerate with video/scripts/generate-outputs.mjs.',
  generatedAt: new Date().toISOString(),
  outputs: results,
}, null, 2)}\n`);
console.log(`wrote ${OUT}`);
