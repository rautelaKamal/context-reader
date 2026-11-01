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
          <li>the page address, without its query string or fragment</li>
        </ul>
        <p>
          The surrounding paragraphs are the point of the tool rather than an extra: a line of
          verse cannot be read without the lines around it. Nothing is sent unless you ask for an
          explanation. Selecting text on its own sends nothing.
        </p>
        <p>
          The address is cut back to the site and the path before it is sent, so
          <code>example.com/thread/42?token=abc#msg-7</code> leaves as{' '}
          <code>example.com/thread/42</code>. Everything after the <code>?</code> or the{' '}
          <code>#</code> is removed inside your browser and never transmitted. Those parts
          routinely carry sign-in tokens, password reset links and search terms, and the only
          thing this tool needs the address for is recognising what kind of page you are on.
        </p>

        <h2>Where it goes</h2>
        <p>
          The passage goes to this site&rsquo;s explanation service, which passes it to
          Google&rsquo;s Gemini API. Google generates the explanation and returns it. Your reading
          therefore passes through Google, and is subject to Google&rsquo;s terms for that service.
        </p>
        <p>
          Read this part before you use it. The passage you select and the paragraphs around it
          are sent to Google&rsquo;s Gemini API, because that is what writes the explanation.
          This service runs on the free tier of that API, and{' '}
          <strong>Google may use data sent to the free tier to improve its products</strong>.
          That is Google&rsquo;s stated policy, not a possibility we are guessing at: see the{' '}
          <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer">
            Gemini API terms
          </a>. If what you are reading should not be used that way, do not use this extension
          on it.
        </p>

        <h2>What is kept</h2>
        <p>
          No passage, page title or address is stored. The explanation service keeps no record of
          what anyone has looked up and writes no selected text to its logs. Errors are recorded
          without the text that caused them. There are no accounts, so there is nothing to attach
          a history to.
        </p>
        <p>
          To apply the daily allowance it keeps three counters, each of them a number: one for
          your install, one for your network address, and one for the service as a whole. Your
          install identifier and your address are hashed before they are used as keys, so neither
          is stored in a readable form, and the counters are deleted automatically after 48 hours.
        </p>
        <p>
          On your own device the extension stores two things: a randomly generated install
          identifier, which is not derived from anything about you and exists only so the
          allowance can be counted, and a count of today&rsquo;s usage. Clearing your browser data
          removes both.
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
