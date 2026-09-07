/**
 * A page for exercising the extension against the markup shapes that matter:
 * verse split by <br>, verse with one element per line, and dense prose where
 * the surrounding paragraph carries the argument.
 */
export const metadata = {
  title: 'ContextReader — test passages',
};

export default function TestPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-stone-900">
      <h1 className="mb-2 text-2xl font-semibold">Test passages</h1>
      <p className="mb-10 text-stone-600">
        Select any passage below and press <kbd>⌘⇧E</kbd>, or click the Explain pill.
      </p>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Verse, line breaks inside one paragraph
        </h2>
        <p id="sonnet" className="leading-relaxed">
          Shall I compare thee to a summer&apos;s day?<br />
          Thou art more lovely and more temperate:<br />
          Rough winds do shake the darling buds of May,<br />
          And summer&apos;s lease hath all too short a date;
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Verse, one element per line
        </h2>
        <div id="metro" className="leading-relaxed">
          <p>The apparition of these faces in the crowd;</p>
          <p>Petals on a wet, black bough.</p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Editorial prose
        </h2>
        <article className="space-y-4 leading-relaxed">
          <p id="prev">
            The decision to defer the census once more has been defended on administrative
            grounds, and there is no doubt that a headcount of this scale is a formidable
            undertaking.
          </p>
          <p id="edit">
            But the argument wears thin in its fourth year. Every month of delay compounds an
            already serious deficit: welfare entitlements are still being apportioned on the
            basis of a population that no longer exists, and the schemes that depend on them
            are quietly shrinking in real terms.
          </p>
        </article>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Technical prose
        </h2>
        <p id="tech" className="leading-relaxed">
          We replace the dense feed-forward block with a sparse mixture-of-experts layer using
          top-k routing, and add an auxiliary load-balancing loss to keep expert utilisation
          from collapsing onto a small subset of the available capacity.
        </p>
      </section>
    </main>
  );
}
