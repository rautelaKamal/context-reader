import Image from 'next/image';
import Link from 'next/link';
import icon from '../../public/icon-128.png';
import { DemoTabs } from './components/DemoTabs';
import { WatchFilm } from './components/WatchFilm';
import { HeroLoop } from './components/HeroLoop';
import { Install, STORE } from './components/Install';
import { Card, Passage, Pill } from './components/Product';
import { output, said } from './components/outputs';

const REPO = 'https://github.com/rautelaKamal/context-reader';

/** Plain lines about the lenses, in the order the extension offers them. */
const LENSES: [string, string][] = [
  ['Plain meaning', 'The same idea in everyday English.'],
  ["What's the point?", "What the writer is arguing, who they're answering, and their tone."],
  ['Line by line', 'A poem explained one line at a time.'],
  ['How it works', 'How the writing gets its effect, through word choice, sound and rhythm.'],
  ['The jargon', 'Technical words explained the way this text uses them.'],
];

const FAQ: [string, React.ReactNode][] = [
  ['Does it work on PDFs?', "Not in Chrome's built-in PDF viewer yet. It works on normal web pages."],
  ['Does it work on my phone?', 'Not yet. It works in Chrome on a desktop or laptop.'],
  ['Can it explain in other languages?', "Explanations are in English for now. Hindi is planned, but there's no date yet."],
  ['Is it free?', 'Yes. No account, no card, no ads.'],
  ["What's the daily limit?", <>30 explanations a day per browser, reset at midnight India time. &ldquo;Go deeper&rdquo; uses 3 of them. People on the same network, like a school or office, also share a limit of 90 a day. On a very busy day the whole service can reach its own limit.</>],
  ['Is what I read stored?', <>No. Nothing you select is saved. See <a href="#privacy">Privacy</a> above.</>],
  ['Can I check how it works?', <>Yes. The code is open source <a href={REPO}>on GitHub</a>.</>],
];

function Logo({ size }: { size: number }) {
  return <Image src={icon} alt="" width={size} height={size} className="logo" />;
}

export default function Home() {
  const ed = output('editorial');
  const tabs = [
    { id: 'editorial', label: 'Editorial', verse: false },
    { id: 'poem', label: 'Poem', verse: true },
    { id: 'research', label: 'Research', verse: false },
    { id: 'legal', label: 'Legal', verse: false },
  ].map(({ id, label, verse }) => {
    const o = output(id);
    // The full legal answer added background that isn't in the passage, so only its summary is shown (docs/eval-findings.md).
    const legal = id === 'legal';
    return {
      id, label,
      panel: (
        <div className="demo-grid">
          <div>
            <p className="source">{o.request.title}</p>
            <Passage before={o.request.precedingParagraph} marked={o.request.markedParagraph} verse={verse} />
          </div>
          <Card mode={o.response.mode} summary={o.response.summary} verse={verse} scroll
            sections={legal ? [] : o.response.sections}
            note={legal ? "Summary only. The full answer added background that isn't in the passage." : undefined} />
        </div>
      ),
    };
  });

  return (
    <>
      <header className="bar wrap">
        <Link href="/" className="brand"><Logo size={32} /><span>ContextReader</span></Link>
        <a className="button small desktop-only" href={STORE}>Add to Chrome</a>
      </header>

      <main>
        <section className="hero wrap">
          {/* On phones the order is text, picture, actions, so the product shows on the first screen. */}
          <div className="hero-text">
            <h1>Understand any hard sentence you read online.</h1>
            <p className="sub">
              You know every word. So why is it so hard? Select it, and ContextReader tells you what
              the writer actually means.
            </p>
          </div>
          <HeroLoop />
          <div className="hero-actions">
            <Install />
            <ul className="trust" aria-label="At a glance">
              <li>Free</li><li>No sign-up</li><li>30 explanations a day</li><li>Open source</li>
            </ul>
            <WatchFilm />
          </div>
        </section>

        <section className="wrap section" aria-labelledby="how">
          <h2 id="how">Three steps. No account.</h2>
          <ol className="steps">
            <li>
              <h3>Install</h3>
              <p>Add ContextReader to Chrome from the Chrome Web Store.</p>
            </li>
            <li>
              <h3>Select any text</h3>
              <p>Highlight the sentence that lost you. An Explain button appears. Click it, or press Ctrl+Shift+E (⌘⇧E on a Mac).</p>
              <div className="step-visual" aria-hidden="true">
                <p className="mini-passage">The new heat action plan is, on paper, admirable. <mark>It would not be unfair to say&hellip;</mark></p>
                <Pill />
              </div>
            </li>
            <li>
              <h3>Read the explanation</h3>
              <p>A card opens right under the text. Answers usually arrive in a few seconds.</p>
              <div className="step-visual" aria-hidden="true">
                <Card mode={ed.response.mode} summary={ed.response.summary} />
              </div>
            </li>
          </ol>
        </section>

        <section className="wrap section" aria-labelledby="try">
          <h2 id="try">Try it on these.</h2>
          <p className="intro">These are real answers from ContextReader. We saved them once and show them here unchanged.</p>
          <DemoTabs tabs={tabs} />
        </section>

        <section className="wrap section" aria-labelledby="for">
          <h2 id="for">Made for anyone who reads hard English.</h2>
          <div className="cards">
            <article>
              <h3>Exam prep</h3>
              <p className="who">UPSC, CAT VARC, CLAT, GRE, GMAT, IELTS</p>
              <p>Reading passages ask for the writer&rsquo;s view and tone. Is &ldquo;less a strategy than an apology written in advance&rdquo; praise or mockery? ContextReader&rsquo;s answer begins:</p>
              <blockquote>&ldquo;{said('editorial', "The writer argues that the city's belated heat action plan is a useless cover-up rather than a genuine strategy.")}&rdquo;</blockquote>
            </article>
            <article>
              <h3>Students and researchers</h3>
              <p>A paper outside your field. For &ldquo;natural selection&rdquo; in Darwin, The jargon gives the meaning that page uses:</p>
              <blockquote>&ldquo;{said('research', 'The mechanism where organisms with traits better suited to their environment tend to survive and reproduce more than those with less suited traits.')}&rdquo;</blockquote>
            </article>
            <article>
              <h3>Professionals</h3>
              <p>Court judgments, contracts and policy papers. Asked about a passage from Marbury v. Madison, ContextReader answered, word for word:</p>
              <blockquote>&ldquo;{said('legal', 'When an ordinary law and the constitution both apply to a court case but contradict each other, judges are forced to choose which rule wins.')}&rdquo;</blockquote>
            </article>
            <article>
              <h3>Non-native readers</h3>
              <p>Politeness that hides criticism is easy to miss. &ldquo;It would not be unfair to say&rdquo; sounds gentle. ContextReader calls the tone:</p>
              <blockquote>&ldquo;{said('editorial', 'Sardonic and dismissive, driven by the dry understatement')}&hellip;&rdquo;</blockquote>
            </article>
          </div>
        </section>

        <section className="wrap section" aria-labelledby="lenses">
          <h2 id="lenses">Five ways to look at the same sentence.</h2>
          <dl className="lenses">
            {LENSES.map(([name, what]) => (
              <div key={name}><dt>{name}</dt><dd>{what}</dd></div>
            ))}
          </dl>
        </section>

        <section className="wrap section" aria-labelledby="different">
          <h2 id="different">It reads like a careful reader.</h2>
          <div className="points">
            <div>
              <h3>It reads the whole paragraph.</h3>
              <p>Your selection is sent with the paragraph around it and the one before, because meaning often depends on what came first.</p>
            </div>
            <div>
              <h3>It quotes its evidence.</h3>
              <p>When it relies on certain words, it quotes them exactly, so you can check them on the page.</p>
            </div>
            <div>
              <h3>It catches irony and tone.</h3>
              <p>It tells you when a writer is being sarcastic, dry, or polite but angry.</p>
            </div>
          </div>
        </section>

        <section className="wrap section privacy" id="privacy" aria-labelledby="privacy-h">
          <h2 id="privacy-h">We never keep what you read.</h2>
          <div>
          <ul>
            <li>Nothing is sent until you click Explain or press the shortcut.</li>
            <li>Then it sends four things: the text you selected, the paragraph it&rsquo;s in and the one before, the page title, and the page address with everything after <strong>?</strong> or <strong>#</strong> removed.</li>
            <li>Our server passes the text to Google&rsquo;s Gemini, which writes the explanation. Google may use text sent to its free service to improve its products, so don&rsquo;t use ContextReader on anything private.</li>
            <li>We store none of it. To count the daily limit we keep three numbers. Your install ID and network address are scrambled (hashed) before we use them, and the numbers are deleted after 48 hours.</li>
            <li>No accounts, no ads, no tracking.</li>
          </ul>
          <p><Link href="/privacy">Read the full privacy policy</Link></p>
          </div>
        </section>

        <section className="wrap section" aria-labelledby="faq">
          <h2 id="faq">Questions.</h2>
          <div className="faq">
            {FAQ.map(([q, a]) => (
              <details key={q}><summary>{q}</summary><p>{a}</p></details>
            ))}
          </div>
        </section>

        <section className="wrap section final" aria-labelledby="final">
          <h2 id="final">Next time a sentence stops you, select it.</h2>
          <Install />
        </section>
      </main>

      <footer className="wrap site-foot">
        <span className="brand"><Logo size={28} /><span>Built by Kamal Singh Rautela</span></span>
        <nav aria-label="Footer">
          <a href={REPO}>GitHub</a>
          <Link href="/test">Passages to try it on</Link>
          <Link href="/privacy">Privacy</Link>
        </nav>
      </footer>
    </>
  );
}
