# ContextReader

A browser extension for the moment when you understand every word in a sentence
and still have no idea what the writer means.

Select the passage that lost you. ContextReader reads it **in context** — the
surrounding paragraph, not just the words you highlighted — and tells you what
is actually being said.

```
"Shall I compare thee to a summer's day?          →   LINE BY LINE
 Thou art more lovely and more temperate:"             "Shall I compare thee..."
                                                        Should I liken you to a
                                                        summer day? He asks, then
                                                        immediately says no...
```

## Why not just a dictionary

Because vocabulary is rarely the problem. The passages that stop people are
usually ones where every word is familiar:

| What you are reading | What you actually need |
|---|---|
| A poem, or Shakespeare | A line-by-line reading — the image, the device, the meaning |
| A newspaper editorial | The writer's *position*, what they are arguing against, their tone |
| A dense technical paper | The claim, with the terminology defined in place |
| Anything else | The same thing said plainly |

Those are four different questions, so ContextReader has four lenses. It picks
one based on the shape of the text and the page it came from; you can switch
with a single tap.

## How it works

The extension collects the selection **plus** the paragraph containing it, the
paragraph before, and the page title, then sends that to a small API that asks
an instruction-tuned model for a structured answer.

Sending the surrounding text matters more than it sounds. You cannot say what a
line of verse means from the line alone, and you cannot explain what an
editorial is arguing against without the sentences that set it up.

Line breaks are preserved throughout: in verse, the line break carries meaning
that punctuation carries in prose.

## Install

```bash
npm install
npm run dev                 # API on http://localhost:3000
API_BASE=http://localhost:3000 npm run package-extension
```

Then load it in Chrome:

1. Open `chrome://extensions/`
2. Turn on **Developer mode**
3. **Load unpacked** → select `dist-extension/`

Visit <http://localhost:3000/test> for passages to try it on.

## Configuration

Copy `.env.example` to `.env.local` and set:

| Variable | Purpose |
|---|---|
| `PROVIDER_API_KEY` | Key for the model provider |
| `PROVIDER_BASE_URL` | Any OpenAI-compatible endpoint, including a local one |
| `EXPLAIN_MODEL` | Model id (default: `gemini-3.5-flash-lite`) |

Get a free Google key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) —
no credit card. [Groq](https://console.groq.com/keys) also works; so does anything
else speaking the OpenAI chat-completions API, including a model on your own
machine. The provider lives behind one interface in
[`src/lib/provider.ts`](src/lib/provider.ts), so switching is config, not code.

**Pick a fast model, not a smart one.** Measured on the same sonnet:

| Model | Time | Verdict |
|---|---|---|
| `gemini-3.5-flash-lite` | **1.8 s** | what we ship |
| `gemini-3.6-flash` (thinking on) | 32 s | unusable |
| `gemini-3.6-flash` (`reasoning_effort: minimal`) | 14 s | still too slow |

The thinking models are not meaningfully better at this task, and this is a tool
you reach for mid-sentence. Anything over a few seconds breaks the reading it is
supposed to protect.

> One gotcha: if `.env.local` contains an empty `PROVIDER_API_KEY=`, it
> **overrides** a real value in `.env`, because `.env.local` wins. Set the key in
> one file only.

## Layout

```
src/extension/     the extension - the only copy; everything else is generated
src/lib/           modes, prompts, provider, request parsing, rate limiting
src/app/api/       explain + translate endpoints
tests/             run with `npm test`
scripts/           builds dist-extension/ and public/extension.zip
```

## Development

```bash
npm test            # unit tests, no framework dependency
npm run typecheck   # tsc --noEmit
npm run build       # production build
npm run try sonnet  # run a passage against the live model
npm run harness     # then open http://localhost:3000/_dev/index.html
```

`npm run eval` runs 17 passages with a known right reading against the live
model — archaic false friends (*protest*, *want*), sustained irony, metaphor,
a referent that only the preceding paragraph supplies, dense editorial
register, technical terms, a Devanagari couplet, and an ablation pair that
runs the same selection with and without context to check the model neither
loses the answer nor invents one. Keyword checks catch regressions; the
printed output is what you actually judge. It also covers irony, litotes,
an opposing view quoted in order to be rejected, and legal and statistical
false friends.

`npm run eval -- --repeat 3` runs every case three times and reports which ones
passed every time. Run-to-run variance is the metric that matters here: an
answer that is right two thirds of the time is not a feature you can ship.

`npm run corpus` runs the same pipeline over 21 passages from 16 real sources
across genres — editorials, arXiv abstracts, comedy (Jerome, Wodehouse,
Carroll), novels (Melville, Dickens, Kafka, Austen), poetry (Blake, Whitman)
and drama (Ibsen). There is no ground truth on unlabelled prose, so it scores
two things that need none: how much of the summary is just the passage's own
words, and whether names or dates appear in the answer that appear nowhere in
the input.

Current: 21/21 parsed, median 1.7s, mean restatement 15%.


`npm run harness` runs the real content script in an ordinary page with a
stand-in for the extension APIs, so selection handling, positioning, the card
and mode switching can be exercised against the real API without loading
anything into Chrome. It opens the shadow root in that copy so the DOM is
inspectable.

## Notes and limitations

- **Rate limiting is per-instance.** `src/lib/ratelimit.ts` uses an in-process
  map, which on serverless limits per instance rather than globally. A real
  ceiling needs a shared store (Vercel KV, Upstash).
- **No mobile.** Chrome does not support extensions on Android. The natural
  mobile form is an Android share-sheet target, which does not exist yet.
- **No history.** Explanations are not stored; the Prisma schema for that
  exists but is not wired up.

## License

MIT — see [LICENSE](LICENSE).
