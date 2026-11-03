import demo from '../../content/demo-outputs.json';

/**
 * The only source of explanation text in the film. Nothing here is typed by
 * hand: each answer is a saved response from the live API.
 */
type Section = { label: string; body: string };
export type Output = {
  id: string;
  request: { selection: string; markedParagraph?: string; precedingParagraph?: string };
  response: { mode: string; summary: string; sections: Section[] };
};

export const out = (id: string): Output => {
  const o = (demo.outputs as Output[]).find((x) => x.id === id);
  if (!o) throw new Error(`no saved output for ${id}`);
  return o;
};

/** The real section, found by its heading, so a reorder can never mislabel one. */
export const section = (id: string, label: string): Section => {
  const s = out(id).response.sections.find((x) => x.label === label);
  if (!s) throw new Error(`${id} has no section "${label}"`);
  return s;
};
