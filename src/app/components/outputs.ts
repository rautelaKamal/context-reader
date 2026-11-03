import saved from '../../../content/demo-outputs.json';

/**
 * The real answers the film uses, read straight from the saved file. Nothing on
 * the page may present text as ContextReader's answer unless it comes from here.
 */
export type Section = { label: string; body: string };
export type Output = {
  id: string;
  request: { precedingParagraph?: string; markedParagraph: string; title: string; mode: string };
  response: { mode: string; summary: string; sections: Section[] };
};

const OUTPUTS = saved.outputs as unknown as Output[];

export function output(id: string): Output {
  const found = OUTPUTS.find((o) => o.id === id);
  if (!found) throw new Error(`No saved output "${id}" in content/demo-outputs.json`);
  return found;
}

/** Returns `text` only if it appears word for word in that saved answer, so a paraphrase fails the build. */
export function said(id: string, text: string): string {
  const { response } = output(id);
  const answer = [response.summary, ...response.sections.flatMap((s) => [s.label, s.body])].join('\n');
  if (!answer.includes(text)) throw new Error(`Not in the saved "${id}" answer, word for word: ${text}`);
  return text;
}
