import Link from 'next/link';

/**
 * Passages for exercising the extension against the markup shapes that matter:
 * verse split by <br>, verse with one element per line, and dense prose where
 * the surrounding paragraph carries the argument.
 */
export const metadata = {
  title: 'Passages to try — ContextReader',
};

const TRY = 'Select a passage, then press ⌘⇧E or click Explain.';

export default function TestPage() {
  return (
    <main className="page reader">
      <h1 className="lede" style={{ maxWidth: '16ch' }}>
        Passages to try it on.
      </h1>
      <p className="standfirst">{TRY}</p>

      <section className="specimen">
        <h2>Verse, line breaks inside one paragraph</h2>
        <p id="sonnet">
          Shall I compare thee to a summer&rsquo;s day?<br />
          Thou art more lovely and more temperate:<br />
          Rough winds do shake the darling buds of May,<br />
          And summer&rsquo;s lease hath all too short a date;
        </p>
      </section>

      <section className="specimen">
        <h2>Verse, one element per line</h2>
        <div id="metro">
          <p>The apparition of these faces in the crowd;</p>
          <p>Petals on a wet, black bough.</p>
        </div>
      </section>

      <section className="specimen">
        <h2>Editorial prose</h2>
        <article>
          <p id="prev">
            The decision to defer the census once more has been defended on administrative grounds,
            and there is no doubt that a headcount of this scale is a formidable undertaking.
          </p>
          <p id="edit">
            But the argument wears thin in its fourth year. Every month of delay compounds an
            already serious deficit: welfare entitlements are still being apportioned on the basis
            of a population that no longer exists, and the schemes that depend on them are quietly
            shrinking in real terms.
          </p>
        </article>
      </section>

      <section className="specimen">
        <h2>Technical prose</h2>
        <p id="tech">
          We replace the dense feed-forward block with a sparse mixture-of-experts layer using
          top-k routing, and add an auxiliary load-balancing loss to keep expert utilisation from
          collapsing onto a small subset of the available capacity.
        </p>
      </section>

      <footer className="foot">
        <Link href="/">Back to the front</Link>
      </footer>
    </main>
  );
}
