/**
 * The payload the extension sends. Explaining a passage requires the passage's
 * surroundings: you cannot say what a line of verse means, or what an
 * editorial is arguing against, from the selected string alone.
 */

export interface PassageContext {
  /** Exactly what the reader selected. Line breaks are meaningful - keep them. */
  selection: string;
  /** The enclosing paragraph with the selection wrapped in « ». */
  markedParagraph?: string;
  /** The paragraph before it, where one exists. */
  precedingParagraph?: string;
  title?: string;
  site?: string;
  url?: string;
}

export const LIMITS = {
  selection: 2000,
  paragraph: 4000,
  title: 300,
} as const;

export class ValidationError extends Error {}

function str(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  // Collapse runs of spaces and tabs but never newlines: in verse the line
  // break carries the meaning that punctuation would carry in prose.
  const cleaned = value.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (!cleaned) return undefined;
  return cleaned.slice(0, max);
}

function siteFrom(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

export function parseContext(body: unknown): PassageContext {
  if (typeof body !== 'object' || body === null) {
    throw new ValidationError('Expected a JSON object');
  }
  const raw = body as Record<string, unknown>;

  // `text` is the field the old extension sent; accept it so an extension
  // that has not updated yet keeps working.
  const selection = str(raw.selection ?? raw.text, LIMITS.selection);
  if (!selection) {
    throw new ValidationError('No text was selected');
  }

  const url = str(raw.url, 500);

  return {
    selection,
    markedParagraph: str(raw.markedParagraph, LIMITS.paragraph),
    precedingParagraph: str(raw.precedingParagraph, LIMITS.paragraph),
    title: str(raw.title, LIMITS.title),
    site: str(raw.site, LIMITS.title) ?? siteFrom(url),
    url,
  };
}
