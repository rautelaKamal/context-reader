import type { Section } from './outputs';

/**
 * HTML copies of the extension's pill and card, laid out as content.js lays
 * them out, in the film's colours. Purely presentational, so they render on
 * the server.
 */
const LENSES: [string, string][] = [
  ['plain', 'Plain meaning'], ['point', "What's the point?"], ['lines', 'Line by line'],
  ['craft', 'How it works'], ['jargon', 'The jargon'],
];

export function Pill() {
  return (
    <span className="cr-pill">
      Explain <kbd>Ctrl⇧E</kbd>
    </span>
  );
}

export function Card({ mode, summary, sections = [], verse = false, note, scroll = false }: {
  mode: string; summary: string; sections?: Section[]; verse?: boolean; note?: string; scroll?: boolean;
}) {
  // content.js hides The jargon for verse.
  const lenses = LENSES.filter(([id]) => !(verse && id === 'jargon'));
  return (
    <div className="cr-card">
      <div className="cr-chips" aria-label="Lenses">
        {lenses.map(([id, label]) => (
          <span key={id} className={id === mode ? 'cr-chip on' : 'cr-chip'}>{label}</span>
        ))}
      </div>
      <div className="cr-body" {...(scroll ? { tabIndex: 0, role: 'region', 'aria-label': 'Explanation' } : {})}>
        <p className="cr-summary">{summary}</p>
        {sections.map((s) => (
          <div key={s.label} className="cr-section">
            <p className={verse ? 'cr-label verse' : 'cr-label'}>{s.label}</p>
            <p className="cr-text">{s.body}</p>
          </div>
        ))}
        {note && <p className="cr-note">{note}</p>}
      </div>
      <div className="cr-foot">
        <span>29 left today</span>
        <span className="cr-links"><span>Go deeper</span><span>Close</span></span>
      </div>
    </div>
  );
}

/** The passage as the extension saw it: the paragraph before, dimmed, and the selection marked. */
export function Passage({ before, marked, verse = false }: { before?: string; marked: string; verse?: boolean }) {
  const [head, rest = ''] = marked.split('«');
  const [selected, tail = ''] = rest.split('»');
  return (
    <div className={verse ? 'passage verse' : 'passage'}>
      {before && <p className="dim">{before}</p>}
      <p>{head}<mark>{selected}</mark>{tail}</p>
    </div>
  );
}
