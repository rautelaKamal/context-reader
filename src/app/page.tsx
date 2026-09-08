import Link from 'next/link';

const REPO = 'https://github.com/rautelaKamal/context-reader';

/** The lenses, in the order the extension offers them. */
const LENSES = [
  ['Plain meaning', 'The same thing said in ordinary English.'],
  ["What's the point?", "The writer's position, what they are arguing against, and their tone — including irony, which is easy to read straight."],
  ['Line by line', 'Verse worked through one line at a time, each line quoted as it stands.'],
  ['How it works', 'Word choice, sound, where the line breaks, and words doing two jobs at once.'],
  ['The jargon', 'Technical terms defined in the sense this particular text is using them.'],
];

export default function Home() {
  return (
    <>
      <header className="bar">
        <span className="wordmark">ContextReader</span>
        <a href={REPO} target="_blank" rel="noopener noreferrer">Source</a>
        <a href="/api/extension" download>Download</a>
      </header>

      <main className="page">
        <h1 className="lede">Some sentences stop you even though you know every word.</h1>
        <p className="standfirst">
          An editorial whose argument you cannot quite pin down. A line of Shakespeare. A paragraph
          in a paper outside your field. Select it, and ContextReader tells you what the writer is
          actually saying.
        </p>

        <div className="demo">
          <div className="passage">
            <p>
              If the recent acrimony over devolution is any indication,{' '}
              <mark>
                the Centre would do well to disabuse itself of the notion that federal comity is a
                favour it bestows
              </mark>{' '}
              upon the States rather than an obligation the Constitution imposes.
            </p>
            <p className="source">A newspaper editorial, selected mid-sentence.</p>
          </div>

          <aside className="note">
            <h2>Their position</h2>
            <p>
              The central government must stop treating cooperation with the states as a gift it
              chooses to give, and recognise it as a constitutional duty.
            </p>
            <h2>Responding to</h2>
            <p>
              Southern states are disputing how tax revenue is shared, arguing they are penalised
              for having controlled their populations.
            </p>
            <h2>Tone</h2>
            <p className="field">
              Stern and corrective. &ldquo;Would do well to disabuse itself&rdquo; is a warning
              dressed as advice.
            </p>
          </aside>
        </div>

        <div className="actions">
          <a className="install" href="/api/extension" download>Add to Chrome</a>
          <span className="terms">Free. 30 explanations a day, resetting at midnight.</span>
        </div>

        <section className="section">
          <h2 className="section-lede">
            A sonnet and a transformer paper need different things said about them.
          </h2>
          <dl className="lenses section-body">
            {LENSES.map(([name, what]) => (
              <div className="lens" key={name}>
                <dt>{name}</dt>
                <dd>{what}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="section">
          <h2 className="section-lede">It reads the paragraph, not just the words you picked.</h2>
          <div className="section-body">
            <p className="section-note">
              You cannot say what a line of verse means from the line alone, and you cannot explain
              what an editorial argues against without the sentences that set it up. So the passage
              arrives with its surroundings, and the part you chose marked inside them.
            </p>
            <p className="context">
            <span className="dim">The decision to defer the census has been defended on
            administrative grounds.</span>{' '}
            <span className="guillemet">«</span>But the argument wears thin in its fourth
            year.<span className="guillemet">»</span>{' '}
            <span className="dim">Every month of delay compounds an already serious
              deficit.</span>
            </p>
          </div>
        </section>

        <footer className="foot">
          <span>Built by Kamal Singh Rautela</span>
          <a href={REPO} target="_blank" rel="noopener noreferrer">Source on GitHub</a>
          <Link href="/test">Passages to try it on</Link>
        </footer>
      </main>
    </>
  );
}
