import Link from 'next/link';

export const metadata = {
  title: 'Privacy — ContextReader',
  description: 'What ContextReader sends, where it goes, and what is kept.',
};

const UPDATED = '9 September 2026';

export default function Privacy() {
  return (
    <main className="page reader">
      <h1 className="lede" style={{ maxWidth: '14ch' }}>What this sends, and where it goes.</h1>
      <p className="standfirst">
        ContextReader explains passages you select. Doing that means sending them somewhere. This
        page says exactly what leaves your browser, what happens to it, and what is kept.
      </p>

      <div className="policy">
        <h2>What is sent</h2>
        <p>When you ask for an explanation — by clicking Explain or pressing the keyboard
        shortcut — the extension sends four things:</p>
        <ul>
          <li>the passage you selected</li>
          <li>the paragraph containing it, and the paragraph before it</li>
          <li>the page title</li>
          <li>the page address</li>
        </ul>
        <p>
          The surrounding paragraphs are the point of the tool rather than an extra: a line of
          verse cannot be read without the lines around it. Nothing is sent unless you ask for an
          explanation. Selecting text on its own sends nothing.
        </p>

        <h2>Where it goes</h2>
        <p>
          The passage goes to this site&rsquo;s explanation service, which passes it to
          Google&rsquo;s Gemini API. Google generates the explanation and returns it. Your reading
          therefore passes through Google, and is subject to Google&rsquo;s terms for that service.
        </p>
        <p>
          One thing worth knowing: this service runs on Google&rsquo;s free tier, and Google may
          use data sent to its free tier to improve its products. If that matters for what you are
          reading, do not use the extension on it.
        </p>

        <h2>What is kept</h2>
        <p>
          Nothing. The explanation service stores no passages, keeps no database of what anyone has
          looked up, and writes no selected text to its logs. Errors are recorded without the text
          that caused them. There are no accounts, so there is nothing to attach a history to.
        </p>
        <p>
          The extension stores one thing on your own device: a count of how many explanations you
          have used today, so the daily allowance can reset at midnight. It is a number and a date.
          It never leaves your computer, and clearing your browser data removes it.
        </p>

        <h2>What is not done</h2>
        <p>
          No analytics, no tracking pixels, no advertising, no third-party scripts on this site.
          Nothing is sold or shared with anyone beyond the explanation service and Google, which
          are required to produce the explanation itself.
        </p>

        <h2>Permissions</h2>
        <p>
          The extension asks to run on all sites because it is a reading aid and people read
          everywhere; it cannot know in advance which page will need it. It asks for storage only
          to hold the daily count described above.
        </p>

        <h2>Questions</h2>
        <p>
          The extension and this service are open source, so the claims here can be checked against
          the code rather than taken on trust. Raise anything at{' '}
          <a href="https://github.com/rautelaKamal/context-reader/issues" target="_blank" rel="noopener noreferrer">
            the issue tracker
          </a>.
        </p>

        <p className="updated">Last updated {UPDATED}.</p>
      </div>

      <footer className="foot">
        <Link href="/">Back to the front</Link>
        <a href="https://github.com/rautelaKamal/context-reader" target="_blank" rel="noopener noreferrer">
          Source on GitHub
        </a>
      </footer>
    </main>
  );
}
