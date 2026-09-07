/**
 * Explanation modes.
 *
 * A sonnet and a transformer paper both need "explaining", but they need
 * completely different things said about them. Each mode is a lens with its
 * own prompt and its own output shape.
 */

export type ModeId = 'plain' | 'point' | 'lines' | 'jargon';

export interface ModeDef {
  id: ModeId;
  label: string;
  /** Shown on the mode chip in the extension popup. */
  hint: string;
}

export const MODES: Record<ModeId, ModeDef> = {
  plain: {
    id: 'plain',
    label: 'Plain meaning',
    hint: 'Say it in ordinary English',
  },
  point: {
    id: 'point',
    label: "What's the point?",
    hint: "The writer's position, and what they're responding to",
  },
  lines: {
    id: 'lines',
    label: 'Line by line',
    hint: 'Walk through verse one line at a time',
  },
  jargon: {
    id: 'jargon',
    label: 'The jargon',
    hint: 'Define the technical terms in place',
  },
};

export const MODE_IDS = Object.keys(MODES) as ModeId[];

export function isModeId(value: unknown): value is ModeId {
  return typeof value === 'string' && value in MODES;
}

/** Signals the client scrapes off the page to help pick a default mode. */
export interface DetectionInput {
  /** The selected passage, with line breaks preserved. */
  selection: string;
  /** Page URL, if the client sent one. */
  url?: string;
}

const OPINION_PATH = /\/(opinion|editorial|editorials|letters|comment|column|columns|perspective|op-ed)\b/i;
const SCHOLARLY_HOST = /(^|\.)(arxiv\.org|acm\.org|ieee\.org|nature\.com|science\.org|springer\.com|sciencedirect\.com|jstor\.org|pubmed\.ncbi\.nlm\.nih\.gov)$/i;

/**
 * Verse detection, without a model call.
 *
 * Verse gives itself away structurally: several short lines, few of which end
 * in a full stop, because the line break is doing the work the punctuation
 * would do in prose. Note that only the period counts as a prose signal -
 * verse lines end in "?", ":" and ";" constantly (the first two lines of
 * Sonnet 18 do exactly that), so counting those misreads poetry as prose.
 */
const BULLET = /^\s*([-*\u2022\u2013]|\d+[.)])\s+/;

function looksLikeVerse(selection: string): boolean {
  const lines = selection
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return false;

  // Lists are short-lined too, but they are not verse.
  const bulleted = lines.filter((l) => BULLET.test(l)).length;
  if (bulleted / lines.length >= 0.5) return false;

  const lengths = [...lines.map((l) => l.length)].sort((a, b) => a - b);
  const median = lengths[Math.floor(lengths.length / 2)];
  if (median > 70) return false;

  const stopped = lines.filter((l) => /\.["\u2019')\]]?$/.test(l)).length;
  return stopped / lines.length < 0.5;
}

function hostOf(url?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function pathOf(url?: string): string {
  if (!url) return '';
  try {
    return new URL(url).pathname;
  } catch {
    return '';
  }
}

/**
 * Pick the mode to open with. The user can always override with one tap, so
 * this only needs to be right often enough to save a click.
 */
export function detectMode({ selection, url }: DetectionInput): ModeId {
  if (looksLikeVerse(selection)) return 'lines';

  const host = hostOf(url);
  if (host && SCHOLARLY_HOST.test(host)) return 'jargon';
  if (OPINION_PATH.test(pathOf(url))) return 'point';

  return 'plain';
}
