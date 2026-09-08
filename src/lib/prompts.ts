import type { ModeId } from './modes';
import type { PassageContext } from './context';

/**
 * The shape every mode returns. One envelope means the extension has a single
 * renderer, and the mode's prompt decides what the section labels say.
 */
export interface Explanation {
  summary: string;
  sections: { label: string; body: string }[];
}

const SHARED_RULES = `
You are helping someone who is in the middle of reading. They understand
English; what they are stuck on is what the writer means, not what the words
mean. Assume intelligence and assume no background knowledge of this topic.

Rules:
- Explain the MARKED passage. The surrounding text is there for context, not
  to be summarised.
- Never pad. No preamble, no "this passage discusses", no restating the task.
- Prefer concrete language over abstract paraphrase. If the writer is making
  a claim, say what the claim is.
- Do not present outside knowledge as though it came from the text. When the
  passage and its surroundings do not say what is being responded to, say that
  plainly. You may add background you know independently, but label it as
  background rather than reporting it as what the writer said.
- The marked sentence may be a view the writer is reporting in order to reject
  it - "it is argued that", "critics say", a claim quoted before being
  answered. Say whose view it is and what the writer does with it. Never
  present a reported view as the writer's own position.
- If the writer does not mean what they literally say - irony, satire, sarcasm,
  a position stated only to demolish it - say so in the summary and in their
  position, not only in the tone. Never restate an ironic proposal as if it
  were sincerely meant; a reader who did not already know would be misled by it.
- If something is genuinely ambiguous, say so rather than inventing certainty.
- Reply with JSON only. No markdown fence, no commentary outside the JSON.
`.trim();

const MODE_RULES: Record<ModeId, string> = {
  plain: `
Mode: PLAIN MEANING.

Say what the marked passage means in ordinary English, as if explaining to a
sharp friend who missed the paragraph.

JSON shape:
{
  "summary": "one or two sentences, the whole meaning in plain words",
  "sections": [
    { "label": "In other words", "body": "a fuller restatement, still plain" },
    { "label": "Why it matters here", "body": "what this passage is doing in the wider text" }
  ]
}`.trim(),

  point: `
Mode: WHAT'S THE POINT.

This is opinion, argument or commentary. The reader wants the writer's actual
position, not a neutral summary. Tone matters: irony, resignation and sarcasm
are frequently the whole message in this register, and are easy to miss.

JSON shape:
{
  "summary": "one sentence: what the writer is actually arguing",
  "sections": [
    { "label": "Their position", "body": "the claim, stated plainly and without hedging" },
    { "label": "Responding to", "body": "the situation, event or opposing view they assume you already know - taken from the surrounding text; if it does not say, state that it is not given rather than supplying one from memory" },
    { "label": "Tone", "body": "e.g. critical, sardonic, resigned, approving - and the words that carry it" }
  ]
}`.trim(),

  lines: `
Mode: LINE BY LINE.

This is verse. Preserve the reading order and work through it. One section per
line, or per couplet where lines only make sense in pairs. The label is the
original line, quoted exactly. The body is what that line is saying, in
modern English, including any image or device that carries the meaning.

JSON shape:
{
  "summary": "one or two sentences: what the whole passage is saying, and the feeling of it",
  "sections": [
    { "label": "<the original line, verbatim>", "body": "what this line means" }
  ]
}`.trim(),

  jargon: `
Mode: THE JARGON.

The reader can follow the sentence structure but is blocked by terminology.
Pull out each technical term, name or piece of notation in the marked passage
and define it in place, in the sense this specific text is using it.

JSON shape:
{
  "summary": "one or two sentences: the claim the passage is making, jargon stripped out",
  "sections": [
    { "label": "<the term>", "body": "what it means here, in one or two sentences" }
  ]
}`.trim(),
};

export function buildMessages(mode: ModeId, context: PassageContext) {
  const system = `${SHARED_RULES}\n\n${MODE_RULES[mode]}`;

  const where = [
    context.title && `Page: ${context.title}`,
    context.site && `Site: ${context.site}`,
  ]
    .filter(Boolean)
    .join('\n');

  const before = context.precedingParagraph
    ? `Previous paragraph:\n${context.precedingParagraph}\n\n`
    : '';

  // The selection is marked inside its own paragraph rather than sent alone,
  // so the model can read it in context and still know exactly what to explain.
  const passage = context.markedParagraph ?? `«${context.selection}»`;

  const user = `${where ? where + '\n\n' : ''}${before}Passage (the part to explain is marked with « »):
${passage}

The marked text, on its own:
${context.selection}`;

  return [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: user },
  ];
}

/**
 * Models still occasionally wrap JSON in a fence or add a stray sentence, so
 * pull out the first balanced object rather than trusting the whole string.
 */
export function parseExplanation(raw: string): Explanation | null {
  const text = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();

  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      escaped = false;
    } else if (ch === '\\') {
      escaped = true;
    } else if (ch === '"') {
      inString = !inString;
    } else if (!inString && ch === '{') {
      depth++;
    } else if (!inString && ch === '}') {
      depth--;
      if (depth === 0) {
        return coerce(text.slice(start, i + 1));
      }
    }
  }

  // Never closed - almost always a reply truncated at the token ceiling.
  return salvage(text);
}

/**
 * Recover what we can from a reply that was cut off mid-JSON.
 *
 * Long dense paragraphs can run past the token ceiling, leaving an object that
 * never closes. The summary and the earlier sections are usually complete and
 * perfectly useful; showing those beats showing the reader raw JSON.
 */
function salvage(text: string): Explanation | null {
  const summaryMatch = /"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(text);
  const summary = summaryMatch ? unescapeJson(summaryMatch[1]) : '';

  const sections: { label: string; body: string }[] = [];
  const pair = /"label"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"body"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  for (const match of text.matchAll(pair)) {
    sections.push({ label: unescapeJson(match[1]), body: unescapeJson(match[2]) });
  }

  if (!summary && sections.length === 0) return null;
  return { summary, sections };
}

function unescapeJson(value: string): string {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
  }
}

function coerce(candidate: string): Explanation | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;

  const summary = typeof obj.summary === 'string' ? obj.summary.trim() : '';
  const sections = Array.isArray(obj.sections)
    ? obj.sections
        .map((s) => {
          if (typeof s !== 'object' || s === null) return null;
          const row = s as Record<string, unknown>;
          const label = typeof row.label === 'string' ? row.label.trim() : '';
          const body = typeof row.body === 'string' ? row.body.trim() : '';
          return label && body ? { label, body } : null;
        })
        .filter((s): s is { label: string; body: string } => s !== null)
    : [];

  if (!summary && sections.length === 0) return null;
  return { summary, sections };
}
