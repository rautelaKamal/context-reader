# Changes explained

One entry per commit, written for someone new to the codebase. Newest last.

---

## List the test files instead of pointing at the folder

**What changed.** `scripts/test.mjs` ran `node --test tests/`. It now reads the
`tests` folder itself, collects every `*.test.cjs` file, and passes that list
to the runner. It also fails on purpose if the list comes back empty.

**Why.** Node's built in test runner takes a list of test files, and the two
Node versions we support disagree about what a folder name means:

* On Node 20, `tests/` is understood as a directory to look inside. Glob
  patterns are not supported.
* On Node 22, arguments are matched as glob patterns, so the plain word
  `tests/` is treated as the name of one file. No such file exists, so nothing
  runs.

Swapping one for the other just moves the breakage between versions, which is
exactly what happened on the first attempt at this fix. Building the list in
JavaScript sidesteps the disagreement: both versions receive real filenames and
neither has to interpret anything.

**What breaks without it.** On Node 22 the test command finds no tests. The
dangerous part is that this looks like success rather than failure, so a broken
change could pass through CI unnoticed. The empty list check exists for the
same reason.

**Interview questions**

*Q: Why not pin the project to Node 20 and avoid the problem?*
A: Pinning freezes you on a version that eventually stops receiving security
patches, and it hides the problem rather than fixing it. Listing the files is
correct on every version, so nothing has to be frozen. CI now runs 20 and 22
together, so a difference between them shows up as a failure instead of a
surprise months later.

*Q: A command that finds zero tests usually exits 0, which looks identical to
everything passing. How do you protect against that?*
A: Make "nothing ran" an explicit failure, which is what the empty list check
does here. The wider principle is that silence from a checking tool must never
be read as a pass. A check that is switched off and a check that is succeeding
produce the same green tick, so the check has to prove it did some work.

---

## Teach the test stub about `onInstalled`

**What changed.** `tests/background.test.cjs` builds a fake `chrome` object so
the extension's service worker can run inside a test. That fake knew about
`chrome.runtime.onMessage` but not `chrome.runtime.onInstalled`. It does now.

**Why.** The worker is plain JavaScript that runs top to bottom when it loads.
Near the end it calls `chrome.runtime.onInstalled.addListener(...)`, so that the
extension can inject itself into tabs that were already open when it was
installed. In the test there is no real browser, only our fake, and the fake had
no `onInstalled`. Reading `.addListener` off `undefined` throws, the worker
never finishes loading, and every test that needed it failed. Nine failures,
one root cause.

The fix belongs in the fake rather than in the worker. The worker is correct:
registering that listener is exactly what a real extension should do. It was the
stand in that was incomplete, and changing shipped code to suit a test would be
making the product worse to make the test pass.

**What breaks without it.** Nine of thirty nine tests fail, including every test
covering the daily quota. The quota is what stops one person draining the shared
free tier, so this is the area you least want untested.

**Interview questions**

*Q: The test failed after a change to the worker. How did you decide whether the
bug was in the test or in the code it tests?*
A: By asking which one is describing reality. A real Chrome always provides
`chrome.runtime.onInstalled`, so a worker that uses it is behaving correctly, and
a fake that omits it is an inaccurate model of the world. The test was failing
because it was wrong about Chrome, not because the worker was wrong about
anything. The useful habit is to treat a failing test as a question rather than
an instruction: it tells you two descriptions disagree, not which one to edit.

*Q: Why fake the browser at all instead of running a real one?*
A: Speed and focus. These tests cover counting logic, for example that a deep
read costs three and that the count resets at midnight, and that logic has
nothing to do with rendering a page. A fake runs in milliseconds with no browser
to install, which means it can run on every commit in CI. The trade is real: a
fake can drift from the thing it imitates, which is precisely the bug fixed
here. So fakes are right for logic, and a genuine browser is still needed to
test that the extension works in a browser.

---

## Run the checks automatically on every push

**What changed.** A new file, `.github/workflows/ci.yml`. On every push to
`main` and on every pull request, GitHub installs the dependencies and runs the
tests, the typecheck and the production build. It does all of that twice, once
on Node 20 and once on Node 22.

**Why.** Checks only help if they actually run. Until now they ran when someone
remembered, on one machine, with whatever Node version happened to be
installed. The first fix in this batch exists because the test command behaved
differently on two Node versions, which is exactly the class of problem a
single machine cannot catch.

Three details worth knowing:

* `npm ci` rather than `npm install`. It installs precisely what the lockfile
  pins and refuses to run if the lockfile and `package.json` disagree, so CI
  tests the same dependency versions every time.
* `fail-fast: false`. By default GitHub cancels the other jobs as soon as one
  fails. Turning that off means that when something breaks you can see whether
  it broke on both versions or only one, which is usually the first clue.
* The build runs with no `.env` file, because CI has no secrets. That is worth
  knowing deliberately: it proves the app can be built without an API key, and
  it would catch any code that reads a secret at build time instead of when a
  request arrives.

**What breaks without it.** Nothing immediately, which is the point. The cost
is paid later, when a change that works on your laptop fails for everyone else
and nobody finds out until it is deployed.

**Interview questions**

*Q: What is the difference between `npm install` and `npm ci`, and why does CI
prefer `ci`?*
A: `npm install` can update the lockfile to satisfy the ranges in
`package.json`, so two runs a week apart can install different versions.
`npm ci` deletes `node_modules`, installs exactly what the lockfile pins, and
errors if the lockfile is out of step with `package.json`. CI wants to be
repeatable: a build that passes today should pass identically tomorrow, and a
failure should point at your change rather than at a dependency that moved
underneath you.

*Q: Why test more than one Node version when production only runs one?*
A: Because "production" is more than one thing. Vercel's build image, this
project's contributors and CI can all be on different versions, and a developer
upgrading their laptop should not quietly change what the code does. The
specific bug in this batch only appeared on Node 22, so a single version matrix
would have shipped it. The general rule is to test the range you claim to
support, and if you only want to support one version, say so and enforce it
with the `engines` field rather than by hoping.

---

## Take local machine detail out of the repo

**What changed.** Two unrelated pieces of one computer's setup that had been
committed by accident.

1. A local editor settings folder is no longer tracked. It is now ignored
   through `.git/info/exclude` rather than `.gitignore`. The folder stays on
   disk, so nothing changes about working locally.
2. In `scripts/corpus-sources.json`, one source pointed at
   `/private/tmp/.../scratchpad/corpus/hindu-nepal.json`. That now reads
   `corpus-local/hindu-nepal.json`, and `corpus-local/` is ignored.

**Why.** Both were paths that only ever existed on one machine.

The choice of ignore file is deliberate and looks inconsistent on purpose.
`.gitignore` is itself committed and published, so naming a folder there
publishes that name. When the reason for ignoring something is that you do not
want it mentioned publicly, writing it into a published file defeats the
exercise. `.git/info/exclude` does the same job for the same clone and is never
committed. The rule of thumb: `.gitignore` is for what *everyone* on the
project should ignore, `.git/info/exclude` is for what only *your* setup
produces.

The corpus path was fixed rather than deleted. The entry is the only source
from the publication this tool is most aimed at, so dropping it would cost real
coverage. It pointed into a temporary folder that has since been cleared, so
the source was already being skipped silently on every run, and it could never
have worked on anyone else's machine or in CI. The captured article is not
committed because it is copyrighted news text, and `corpus.mjs` already skips a
source whose file is missing, so the entry costs nothing when the capture is
absent and starts working the moment you make one.

**What breaks without it.** Nothing technically. What you get is a public
repository carrying details of one contributor's machine, and a corpus source
that looks configured while quietly never running.

**Interview questions**

*Q: When would you use `.git/info/exclude` instead of `.gitignore`?*
A: When the thing being ignored is yours rather than the project's. Editor
folders, local scratch directories and personal tool settings are noise for
everyone else, and a shared `.gitignore` both collects clutter and tells the
world which tools you use. `.gitignore` belongs to the project and is
published; `.git/info/exclude` belongs to your clone and never leaves it.

*Q: You found a config entry pointing at a path that no longer exists, and the
code skipped it without complaining. Is silent skipping the right behaviour?*
A: It depends on whether absence is expected. Here it is: the capture is
deliberately not committed, so most clones will not have it, and refusing to
run the rest of the corpus over one missing optional source would be worse.
What was actually wrong is that the skip was invisible, so a source could be
broken for months unnoticed. The better shape is to tolerate the absence but
report it, which is what the script does when it prints that it is skipping a
source. Fail loudly on what must be there, report quietly on what may not be.

---

## Only let the real extension call the API

**What changed.** `src/lib/cors.ts` used to accept any origin beginning
`chrome-extension://`, any host ending `.vercel.app`, and localhost at all
times. It now accepts one exact extension id, plus any ids listed in the
`ALLOWED_EXTENSION_IDS` environment variable, plus localhost only when
`NODE_ENV` is `development`. New tests in `tests/cors.test.cjs` cover each
rule.

**Why.** CORS is the browser asking a server "this page wants to call you, is
that allowed?" The server answers with an `Access-Control-Allow-Origin` header,
and the browser blocks the reply if the answer does not match.

The old answer was close to "anyone". Extension ids are not secret, they are
visible in the store URL, and anybody can publish an extension or deploy a site
to `vercel.app`. So the check excluded almost nothing.

The published id is a constant in the file rather than only an environment
value. That is deliberate: if it lived solely in the environment and that
variable went missing, every real user would be blocked at once. Hard coding
the known good id means a configuration mistake cannot take the product down,
and the variable is there to add a development id alongside it.

**What breaks without it.** Nothing visible, which is the trap. Any website in
the world could have called the API from a visitor's browser and spent the
shared free tier.

**The important limitation.** CORS does not stop anybody. It is enforced by
browsers, voluntarily, to protect their own users. `curl`, a script, or any
server ignores it completely and will get a perfectly normal reply. So this
narrows accidental and casual abuse from web pages, and it is not the thing
protecting the budget. The per install and global quotas are, because those are
enforced on the server where nobody can opt out.

**Interview questions**

*Q: If CORS can be bypassed with curl, why bother?*
A: Because it defends a specific attack it is good at: a web page running in
someone else's browser quietly using your API, with their IP and their session.
That is the case the browser can police and you cannot detect easily. It does
nothing against a determined caller, which is why it is paired with server side
quotas. Layers answer different threats, and the mistake is assuming the
browser side layer is a security boundary rather than a courtesy one.

*Q: Why hard code the extension id instead of putting it entirely in config?*
A: Blast radius. Config can be missing, misspelled or lost in a migration, and
here the failure mode would be a total outage for every user at once, with a
symptom (requests blocked by the browser) that looks nothing like its cause. A
constant makes the working state the default and leaves config for additions.
The general rule: let configuration extend safe defaults rather than being
required to produce them.

---

## Remove the translation endpoint and the branch that called it

**What changed.** Deleted `src/app/api/translate/`, and removed the
`type === 'translate'` branch from the extension's service worker. The worker
now has one endpoint to call rather than choosing between two.

**Why.** Nothing sent that message. The user interface has no translate
control, so the only path to that endpoint was a branch no code took. Deleting
the route alone would have left the worker still able to ask for a URL that no
longer exists, so both halves go together: a caller and a thing to call are one
unit, and removing either on its own leaves a trap.

Dead code is not free. It has to be read by everyone who passes through, it
shows up in searches, it gets updated during refactors, and it quietly suggests
a feature exists. An endpoint is worse than most dead code because it is a door
into the system: it accepted requests, spent model budget, and had to be kept
secure and rate limited like any other, all to serve nobody.

**What breaks without it.** Nothing, which is the point. What you carry instead
is a second public endpoint that must be maintained and defended for no
benefit.

**Still dead, left alone on purpose.** `translate()` in `src/lib/ai.ts` is now
unreferenced. It is listed rather than deleted, because removing code is easier
to agree to than to undo and the owner should choose.

**Interview questions**

*Q: How did you convince yourself the endpoint was genuinely unused before
deleting it?*
A: I searched for every reference to the name across the whole repository, not
just the obvious files, and traced what reached it. The one caller was a branch
in the worker guarded by a message type nothing ever sent. For a public HTTP
endpoint, reading the code is only half the answer, because anyone on the
internet can call a URL regardless of what your code does. The complete answer
checks request logs or analytics for real traffic before removing it, and for a
widely used API you deprecate and watch before you delete.

*Q: Why delete it rather than leave it in case translation comes back?*
A: Version control already keeps it, so "in case we need it" is not a reason to
keep code in the working tree: it is one `git log` away if it ever returns. The
live cost of keeping it is ongoing, and for an endpoint it includes a security
and billing surface. The decision changes if something outside the repository
depends on it, which for a public URL is worth checking before assuming.

---

## Count the daily allowance on the server, not on the reader's machine

**What changed.** The allowance used to be counted only in the extension, in
`chrome.storage`. It is now also counted on the server in Upstash Redis, which
is the count that decides. `src/lib/ratelimit.ts` is gone and
`src/lib/quota.ts` replaces it. The extension makes a random install id once,
keeps it, and sends it as an `X-Install-Id` header.

**Why the old one did not work.** Two separate reasons.

*It was on the wrong machine.* `chrome.storage` belongs to the reader. Clearing
it resets the allowance, and anyone can clear it. A limit the person being
limited can erase is a suggestion.

*The replacement it had on the server did not survive the architecture.* The
old `ratelimit.ts` kept counts in a JavaScript `Map`, in memory. The API runs
on edge functions, which means many short lived copies around the world, each
with its own memory, each starting empty. Ten requests could hit ten copies and
every one would see a count of zero. It worked perfectly on one laptop and did
essentially nothing in production. That is the general shape of the bug: state
in memory is per process, and serverless means you do not know or control how
many processes there are.

**The three counters.**

| Counter | Default | What it is for |
|---|---|---|
| per install | 30 | Normal fairness between readers |
| per address | 90 | Someone minting fresh install ids from one machine |
| global | 2000 | A hard ceiling on the whole service |

The second exists because the first is easy to defeat: the install id comes
from the client, so a determined caller can simply send a new one each time.
The address counter catches that. The global cap exists because the address
counter can also be defeated, with enough addresses, and the thing that must
never happen is an unbounded bill. Each layer assumes the one before it failed.

**Atomic counting.** Each counter is a single Redis `INCRBY`, which returns the
new total. Incrementing and reading in one operation matters: if the code read
the count, decided, then wrote it back, two requests arriving together would
both read the same old number and both be allowed. Redis runs commands one at
a time, so `INCRBY` cannot interleave. Every key also gets an `EXPIRE`, so the
store does not grow forever.

The check happens *after* the increment, which means a refused request still
counts. That is on purpose: it costs one round trip instead of two, and a
client that keeps hammering pushes itself further away rather than retrying
free.

**What happens when Redis is down or not configured.** The request is allowed,
and the decision says `enforced: false`. This is a deliberate trade. Failing
closed would mean a Redis outage takes the whole product down for everyone,
which is a worse day than a few hours of uncounted usage. The cost of this
choice is real: while the store is unreachable there is no ceiling, so the
outage matters and should not be ignored.

**Privacy.** Install ids and addresses are hashed before they become keys, so
the store holds no raw address and nothing linking back to a person. A test
asserts this, because it is the sort of thing that quietly regresses.

**Old extensions keep working.** Readers who have not updated send no install
id. Rather than refuse them, the server falls back to counting them by address
alone. Breaking existing users to enforce a new header would be a worse
outcome than counting them slightly more loosely for a few days.

**What breaks without it.** Anyone can clear their browser storage and have an
unlimited allowance, and there is no ceiling on the bill at all.

**Interview questions**

*Q: Why can a limit not be enforced in the client?*
A: Because the client runs on hardware the other person controls, so anything
it enforces, they can change: clear storage, edit the extension, or skip it and
call the API directly with curl. Client side limits are a user interface
feature, useful for showing someone where they stand and avoiding a pointless
request, and they are not security. The rule is that any check that must hold
has to happen somewhere the person being checked cannot reach.

*Q: Why keep an in memory counter at all if it did not work, and what is the
general lesson?*
A: It was written when the shape of the deployment was not thought through, and
it looked correct in local testing because one laptop runs one process. The
lesson is that correctness depends on the execution model, not just the code:
the same `Map` is a perfect cache in a single long lived server and useless
across ephemeral edge functions. Whenever state has to be shared, the question
to ask early is "shared between what, exactly", and if the answer is "processes
I do not control the number of", it has to live outside the process.

---

## Bump the extension to 0.2.2

**What changed.** `src/extension/manifest.json` goes from `0.2.1` to `0.2.2`.

**Why.** This phase changed the extension: it now creates an install id and
sends it with every request. Chrome will not accept an upload whose version is
not higher than the published one, so the number has to move before anything
can ship. One bump at the end of the phase rather than one per commit, because
the version describes what users receive, and users receive the whole phase at
once.

Nothing is published by this commit. Uploading stays a manual step.

**What breaks without it.** The store rejects the upload, and the work sits
finished but undeliverable.

**Interview questions**

*Q: Your server now expects a header that older installed copies do not send.
How do you roll that out without breaking people?*
A: By making the new header optional and designing a sensible fallback, which
here means counting those requests by network address instead. Extension
updates roll out over days and some people disable updates entirely, so for a
while both versions are live at once and the server has to serve both. The
general rule for any client and server that ship separately: the server
tolerates the old client first, the client starts sending the new thing second,
and only once almost nobody is on the old version can you consider requiring
it.

*Q: Why not bump the version on every commit?*
A: The version is a fact about what a user has installed, not about your
history, and users never receive an individual commit. Bumping per commit
produces numbers that mean nothing to anyone outside the repository and churns
the manifest in every diff. Git already records the commits; the version
records the releases.

---

## Warn whenever the quota is skipped, and put midnight in India

**What changed.** Two small decisions made explicit.

1. When a request is allowed because the Redis store was unreachable or
   unconfigured, the server now writes a warning. Every time, not once.
2. `QUOTA_DAY_OFFSET_MINUTES` now defaults to `330` instead of `0`, so the
   counters roll over at midnight India time.

**Why warn every time.** Allowing the request is the right call, since an
outage in the counter should not stop people reading. The danger is that the
right call is also silent: the product looks completely healthy while nothing
at all is limiting spending. Logging once per process would be quieter and
misleading, because these run as many short lived functions and "once" would
mean once per cold start. Logging every occurrence makes the volume of lines
equal to the size of the problem, which is the signal you actually want at
three in the morning.

**Why 330.** Days have to start somewhere, and computers default to UTC. The
extension tells people their allowance "resets at midnight", and for a reader
in India UTC midnight is 05:30 the next morning, so the promise was wrong by
five and a half hours in the direction that annoys people: still blocked at
breakfast. 330 minutes is UTC+5:30. The default is now the audience rather than
the machine, and `0` still gets you UTC.

A test pins this down with times two minutes apart: 23:59 and 00:01 India time
land on different quota days, and the same two timestamps land on the *same*
day when the offset is zero, which is exactly the bug being fixed.

**What breaks without it.** Silence during an outage that removes the spending
ceiling, and an allowance that reappears at 05:30 for people told it returns at
midnight.

**Interview questions**

*Q: You log on every failed attempt rather than once. Is that not just noise?*
A: It is only noise if the lines carry no information, and here each one marks
a request that was charged to nobody. The count is the measurement: ten lines
is a blip, ten thousand is an incident. Deduplicating would make a serious
problem and a trivial one look identical, which is the opposite of what
monitoring is for. The honest way to reduce volume is to alert on a rate rather
than to print less.

*Q: Why not store the user's own timezone and reset per person?*
A: You could, and for a worldwide product you probably would. It costs you
something though: the reset time becomes client supplied, so it can be lied
about by resetting your clock, and you have to keep a timezone per install and
reason about people who travel. One fixed boundary chosen to match where the
readers actually are gets almost all of the benefit for none of that. If the
audience spreads out, the right next step is a per install offset recorded at
install time rather than trusting the clock on every request.

---

## Make the store build safe by construction instead of by flag

**What changed.** The `--store` flag and the `package-extension:store` script
are gone. In their place, `npm run package-extension` writes the zip only when
`API_BASE` is unset. A local build still produces `dist-extension/` for loading
unpacked, but no zip.

**Why.** The flag's only job was removing a `localhost` entry from the
manifest's host permissions, and there is no longer such an entry to remove:
the manifest now asks for `<all_urls>` so that it can re-inject into tabs that
were already open. So the flag did nothing, while still looking like it did
something important, which is worse than not existing.

It did carry one real protection, a refusal to make a store build with
`API_BASE` set, and that protection is worth keeping. It is now expressed
differently. Rather than "pass this flag to get a safe build", the rule is "the
zip is the thing you upload, so the zip is only ever a default build". The
unsafe artifact is not produced at all, instead of being produced unless you
remember a flag.

This is a real failure that happened while making this change: a local build
with `API_BASE=http://localhost:3000` silently overwrote `public/extension.zip`
with a copy pointing at a laptop. Uploading that would have broken the
extension for every user, and nothing about the zip would have looked wrong.

**What breaks without it.** A flag that implies a safety step it no longer
performs, and an upload artifact that any local build can quietly poison.

**Interview questions**

*Q: What is wrong with a flag that no longer does anything, if it is harmless?*
A: It is not harmless, because it still communicates. Anyone reading
`package-extension:store` reasonably concludes there is a meaningful difference
between a store build and a normal one, and may rely on a protection that is no
longer there. Code that lies about what it does is worse than code that does
nothing, because it is trusted. When behaviour disappears, the name for it
should go too.

*Q: You replaced a flag with a structural rule. When is that the better move?*
A: When the failure mode is forgetting. A flag puts the safety in the hands of
whoever types the command, at the moment they are least likely to be careful.
Making the dangerous artifact impossible to produce removes the chance to get
it wrong, which is the same reason a type is better than a comment saying "do
not pass null here". The limit is that structure is less flexible, so it suits
rules that should always hold, and a flag still suits a genuine choice.

---

## Cut the query string and fragment off the page address

**What changed.** The extension used to send the whole page address. It now
sends only the site and the path, so
`https://mail.example.com/thread/42?token=abc123&q=divorce#msg-7` leaves as
`https://mail.example.com/thread/42`. This happens in three places: where the
address is collected, again in the service worker before the request goes out,
and once more on the server for older installed copies that still send the
whole thing.

**Why.** Everything after a `?` or a `#` is the part of a URL most likely to
contain something private. Session tokens, password reset links, invitation
links, search terms, document ids and order numbers all live there, and none of
it is anything this tool needs. The address is used for one job, recognising
what kind of page you are on, which reads the host and the path and nothing
else.

This is data minimisation: do not collect what you do not need. It is cheaper
than protecting it. Data you never received cannot leak, cannot be subpoenaed,
cannot be in a backup you forgot about, and does not have to be explained in a
privacy policy.

**Why three times.** They are not redundant, they cover different situations.
Stripping where it is collected means the browser never holds a full address in
a variable headed for the network. Stripping in the service worker covers
everything that calls out, including anything added later, which is the one
choke point where the promise can actually be guaranteed. Stripping on the
server covers the people who have not updated yet, who will keep sending the
full address for days or weeks.

**What breaks without it.** Reading a passage on a page whose address contains
your session token sends that token to a server and then to Google. Nothing
would misbehave, and nobody would notice.

**A test caught something while being written.** The first version of the test
failed, and the reason was not the code: the fake browser used in the tests had
no `URL` object, so `new URL(...)` threw, the worker's own `try/catch` caught
it, and the address came back as nothing. That is the dangerous shape of error,
because "nothing" looked like a pass for two of the four assertions. The stub
now provides `URL`, which is the second time an incomplete stand-in has
produced a convincing wrong answer.

**Interview questions**

*Q: Why strip it in the client at all, when the server throws it away too?*
A: Because the guarantee is different. Stripping on the server means the data
was transmitted, reached a machine you operate, probably appeared in a load
balancer log, and was discarded after arrival. Stripping in the client means it
never left the device at all. If you want to be able to say "your session
tokens are never sent to us", only the client side version makes that true. The
server side strip is a safety net for old clients, not the main protection.

*Q: What is the general principle, and where does it stop?*
A: Collect the minimum that makes the feature work, and prefer not having data
to securing it. It stops where the feature stops working: here the path is kept
because the product genuinely uses it to tell an editorial from a research
paper. The question to ask of every field is "what breaks if this is absent",
and if the answer is nothing, it should not be sent.

---

## Make the privacy policy match what the code actually does

**What changed.** Three corrections to `/privacy`.

1. The Google disclosure is now stated plainly, in bold, with a link to the
   Gemini API terms: the passage is sent to Google, and on the free tier
   Google may use it to improve its products.
2. "What is kept" was wrong. It said the extension stores one thing locally
   and the server stores nothing. The extension now stores two things, and the
   server keeps hashed counters it did not have before.
3. The address is described as what it now is: site and path, with a worked
   example showing a token being removed.

**Why.** A privacy policy is a promise, and these had drifted from the code
during the last two changes. An out of date policy is worse than a vague one,
because it is specific and wrong, and people are entitled to rely on it. The
Chrome Web Store also asks you to certify that your disclosures are accurate,
so this is a statement you are signing.

The Google paragraph deliberately does not soften. The free tier is the
cheapest option and it is paid for with data, which is a real trade and the
reader is the one making it, so they have to be able to see it. Burying that
in careful phrasing would be choosing the product's comfort over theirs. It
also names it as Google's published policy with a link, so it does not read as
our speculation and can be checked.

**What breaks without it.** Nothing technical. You publish a document that
tells people something untrue about where their reading goes, and certify it
to a store review team.

**Interview questions**

*Q: Who should be responsible for keeping a privacy policy accurate?*
A: Whoever changes the data flow, at the moment they change it. Treating the
policy as a legal document that someone reviews annually guarantees drift,
because the facts it describes live in code that changes weekly. The practical
version is to treat it as part of the definition of done for any change that
touches what is collected, sent or stored, the same way you would update an API
doc. Here it drifted twice in one session, which is the normal rate.

*Q: Is there a downside to disclosing the free tier data use so bluntly?*
A: Some people will decide not to use it, and that is the system working
rather than failing. The alternative is that they use it believing something
untrue, find out later, and are right to be angry. Trust is the main asset of a
tool that reads over your shoulder, and it is lost in exactly one event. If the
disclosure costs too many users, the honest fix is to change the thing being
disclosed by moving to a paid tier, not to describe it more gently.

---

## Remove three dependencies nothing uses

**What changed.** `@huggingface/inference`, `pdf-lib` and `react-pdf` are gone
from `package.json` and the lockfile.

**Why they were there.** Each is left over from an earlier version of the
project. The Hugging Face SDK was the original model client before the
provider was rewritten to use plain `fetch`. The two PDF libraries belonged to
a PDF reading feature that was never built.

**How we know they are unused.** "I could not find it" is not evidence, so the
search was deliberately broad. For each package:

* static `import ... from` and `require(...)`: none
* dynamic `import(...)`: none
* config files (`next.config.js`, `eslint.config.mjs`, `postcss.config.mjs`,
  `tsconfig.json`, `vercel.json`): none
* anything in `scripts/`: none
* any other installed package declaring it as a dependency: none

Every package appeared in exactly one tracked file, on its own line in
`package.json`. After removal the tests, typecheck and production build all
still pass, which is the check that actually settles it.

**What it cost to keep them.** More than you would guess from three lines.

| | Before | After |
|---|---|---|
| `node_modules` | 484 MB | 395 MB |
| installed packages | 501 | 455 |
| `package-lock.json` | 250.7 KB | 230.9 KB |
| audit findings | 17 | 16 |

One high severity vulnerability disappeared with them, in a package called
`tar-fs`. Nothing in this project ever called `tar-fs`. It arrived through a
chain: `react-pdf` needs `pdfjs-dist`, which can use `canvas`, which installs
through `prebuild-install`, which uses `tar-fs`. That is the real cost of an
unused dependency: you inherit everything it depends on, including its
security problems, for a feature you are not using.

**What breaks without it.** Nothing. Every `npm install`, every CI run on two
Node versions and every Vercel build was downloading and unpacking 89 MB of
code that never ran.

**Interview questions**

*Q: How do you prove a dependency is unused, rather than just failing to find
it?*
A: Search every way code can reach a package, not just the obvious one: static
imports, `require`, dynamic `import()` with a string, configuration files that
load plugins by name, build and script files, and whether another package
needs it. Then make the decisive test: remove it and run the full build and
test suite. Searching tells you where to look; the build is what proves it.
There are still blind spots worth naming, such as a package loaded by a name
built at runtime, which is why removal belongs in its own commit that is easy
to revert.

*Q: The vulnerable package was four levels deep and never called. Was it
actually a risk?*
A: Possibly less than the label suggests, because many vulnerabilities only
matter when the vulnerable function is reached. But "it is probably not
exploitable here" is a judgement you then have to make, document and revisit
for every advisory, forever. Removing the dependency replaces an ongoing
judgement with a fact. The cheapest vulnerability to manage is the one in
code you do not install.

---

## Delete the translation function

**What changed.** `translate()` and its result type `TranslationResult` are
removed from `src/lib/ai.ts`, which drops from 93 lines to 47.

**Why.** Phase A2 removed the only route that called it, and the extension
branch that called that route. It was left in place then and reported rather
than deleted, so this commit is the follow-through. Nothing referenced it: the
only mention anywhere in the repository was the note in this document saying it
was dead.

The check for "anything only it used" mattered more than the function itself.
Its prompt was written inline inside the function rather than in
`prompts.ts`, and its result type was declared next to it, so both went with
it. What it shared with `explain()`, the provider and the `PassageContext`
type, stays, because `explain()` still needs them. Deleting a function is easy;
the skill is deleting exactly the code that existed only for it.

**What breaks without it.** Nothing. You keep 46 lines that compile, get read,
and suggest the product translates when it does not.

**Interview questions**

*Q: When you delete a function, how do you decide what else to delete with
it?*
A: Walk its dependencies and ask, for each one, "does anything else use this?"
Things only it used, here a type and an inline prompt, go with it, because
they are now dead too and would otherwise be found and wondered about later.
Things it shares with live code stay. The mistake in one direction is leaving
orphans; in the other it is removing something shared and breaking a caller,
which is why the build and tests run afterwards.

*Q: The function was already known to be dead. Why was it not deleted in the
same change that killed its caller?*
A: Because "do not delete without listing it first" was the rule for that
phase, and the owner should decide. There is also a practical reason to
separate them: removing a public endpoint and removing internal code are
different kinds of change with different risks. Keeping them in separate
commits means either can be reverted without the other, and the history
explains each decision on its own terms.

---

## Delete the unused database schema

**What changed.** `prisma/schema.prisma` is deleted, along with the two
`.gitignore` patterns for its database files and a README sentence that said
the schema existed.

**Why.** Prisma is a tool for describing a database and generating code to
talk to it. This schema described a `User` and an `Annotation` table for a
reading history feature that was never built. Nothing used it: the Prisma
packages themselves were already removed months ago, because an unused import
of the Prisma client was failing the production build. The schema was kept then
on the grounds that the design might be wanted later.

It is cheaper to delete it now. Version control keeps it, so the design is one
`git log` away, and a schema file in a repository is a claim that the project
has a database. Anyone reading the code would reasonably go looking for
where it is used.

The two related edits are part of the same change. The `.gitignore` lines
ignored database files inside a folder that no longer exists. The README
sentence would have become untrue the moment this commit landed. Deleting a
file and leaving behind the text that describes it just moves the confusion
somewhere else.

**What breaks without it.** Nothing. A newcomer spends ten minutes looking for
a database that is not there.

**Interview questions**

*Q: The schema was a real design someone might want later. Is deleting it not
throwing work away?*
A: No, because git keeps it: `git log --all -- prisma/schema.prisma` finds it,
and `git show` restores it. What deletion removes is the claim, made by its
presence, that it is in use. If you genuinely want to preserve an unbuilt
design, an issue or a design document is a better home than a source file,
because those are explicitly about the future and a source file is about the
present.

*Q: Why also edit `.gitignore` and the README in a commit about deleting a
file?*
A: Because they are part of the same fact. The commit's purpose is "the
project has no database schema", and two other files still said it did. A
change should leave the repository consistent with itself, so that nobody
reading any one file is misled. Splitting them would create a moment in the
history where the README describes something absent.

---

## Delete an unused stylesheet

**What changed.** `styles/Home.module.css`, 138 lines, is deleted. It was the
only file in `styles/`, so the folder goes too.

**Why.** It is a leftover from the Next.js starter template that the project
began from. The `.module.css` suffix means it is a CSS Module: styles that only
apply when a component imports the file and uses its class names. Nothing
imported it. The site's real styles live in `src/app/globals.css`, which
replaced the starter's when the homepage was redesigned.

A CSS Module that nothing imports is completely inert. It is never sent to a
browser and never applied to anything. Unlike an unused global stylesheet it
cannot even cause an accidental style clash, so the only thing it does is sit
in the tree looking like it matters.

**What breaks without it.** Nothing. Someone editing the homepage might find a
`.container` class here, change it, and wonder why nothing on screen moved.

**Interview questions**

*Q: How is a CSS Module different from a normal stylesheet, and why does that
make this easy to prove unused?*
A: A normal global stylesheet applies to the whole page once it is loaded, so
proving it unused means checking that none of its selectors match anything,
which is genuinely hard. A CSS Module is scoped: its class names are rewritten
to be unique, and they only exist if a component imports the file and refers to
them. So "unused" reduces to "nothing imports it", which a single search
answers. Scoping makes code easier to delete as well as safer to write.

*Q: Starter templates leave files like this behind. How do you stop them
accumulating?*
A: Delete template files at the moment you replace what they did, not later,
because later never comes and the knowledge of what was template fades. A
cheap automated guard also helps: tools such as `knip` or `ts-prune` report
unimported files and exports, and can run in CI so new dead files show up in
review rather than years afterwards.

---

## Upgrade Next.js from 15.2.6 to 15.5.28

**What changed.** `next` and `eslint-config-next` move from 15.2.6 to 15.5.28,
the newest release in the 15 line. Major version 16 was deliberately not
taken.

**Why.** `npm audit` reported one critical, but the summary hides how much was
underneath: that one line was the `next` package, and inside it were **35
separate advisories, three of them critical**. All three criticals were remote
code execution, which means an attacker running their own code on the server.
Two were in the image optimisation feature and were fixed in 15.5.24. The
third, triggered by SVG files, affected every version up to and including
15.5.27. So 15.5.28 is not just "the newest". It is the first version that
clears all of them, and nothing older would have been enough.

Staying on 15 rather than jumping to 16 is about risk per change. A move
within a major version is supposed to be backwards compatible, so the work is
small and the security gain is large. A major version is where breaking
changes are allowed, and mixing "patch three critical vulnerabilities" with
"adapt to a new framework version" in one change means that if something
breaks, you cannot tell which half caused it.

**Before and after.**

| | Before | After |
|---|---|---|
| audit total | 16 | 15 |
| critical | 1 (3 advisories) | **0** |
| advisories on `next` itself | 35 | **0** |

`sharp`, the image processing library Next uses, also dropped off the list.

**What is left, and why most of it does not matter here.** Of the remaining 15
findings, 11 are in the linting toolchain, which is a development dependency:
it runs on a developer's machine and in CI, and is never installed in
production. The other 4 are one chain around `postcss`, a CSS processor. `next`
still appears in the report only because it bundles its own pinned copy of
`postcss`, and it has no advisories of its own. `postcss` runs once, during the
build, over this project's own stylesheet. Its advisories involve
attacker-controlled CSS, and there is no attacker-controlled CSS in a build of
our own code.

**What breaks without it.** Three known ways for a stranger to run code on the
server stay open on a site that is live.

**Interview questions**

*Q: The audit said "1 critical". Why did you look further than that?*
A: Because `npm audit` counts vulnerable packages, not vulnerabilities. One
package can carry dozens of advisories, and the severity shown is only the
worst of them. Reading the per advisory detail turned "one critical" into
"three separate remote code execution bugs", and it also showed which exact
version fixed the last one. Without that you can easily upgrade to a version
that looks newer but still sits inside the affected range.

*Q: Fifteen findings remain. How do you decide whether that is acceptable?*
A: By asking, for each one, whether the vulnerable code can be reached by an
attacker in this deployment. Dependencies used only for development never
reach production. A build time tool processing only your own files has no
attacker input. That leaves nothing on the request path, so the remainder is a
maintenance item rather than an incident. The risk in this reasoning is that it
has to be redone whenever the code changes, for example if the app ever
started processing CSS that users upload.

---

## Delete the starter template images

**What changed.** Five SVG files in `public/` are deleted: `file.svg`,
`globe.svg`, `next.svg`, `vercel.svg` and `window.svg`.

**Why.** They are the icons from the Next.js starter page, the one that says
"Get started by editing page.tsx". This project replaced that page long ago,
and nothing has referred to them since. Searching every tracked file for each
name, and for any path into `public/` that could load them, found nothing.

Files in `public/` have one property that makes them worth removing rather
than ignoring: they are served. Every file in that folder is reachable at a
URL on the live site, so `context-reader.vercel.app/vercel.svg` was a real
address returning a Vercel logo. Unused source code just sits there, but
unused public files are part of what the site publishes.

**What breaks without it.** Nothing breaks. The site keeps serving five
template logos that announce which starter it was built from.

**Interview questions**

*Q: Why is an unused file in `public/` different from an unused source file?*
A: Because `public/` is served directly: everything in it gets a URL whether or
not any page links to it. An unused component never reaches a browser, but an
unused public file is downloadable by anyone who guesses the path. That makes
`public/` worth keeping deliberately small, and it is also the folder where you
should be most careful about what gets committed, since anything placed there
is published.

*Q: Could deleting a file in `public/` break something your search would not
find?*
A: Yes, an external link: another site, an old email, or a bookmark pointing
at the URL, none of which appears in this repository. For template icons that
risk is negligible. For anything a user might have shared, such as a
downloadable file or an image in a social preview, you would check request logs
for traffic to that path before deleting it, or redirect it.

---

## Correct the README's description of rate limiting

**What changed.** The "Notes and limitations" section of the README said rate
limiting used an in-memory map in `src/lib/ratelimit.ts` that only limited per
serverless instance. It now describes the Redis quota that replaced it: the
three daily limits and their values, the India midnight rollover, hashed keys
with a 48 hour expiry, and three honest caveats.

**Why.** Phase A2 deleted `ratelimit.ts`, so the README pointed at a file that
no longer exists and described a weakness the project no longer has. Out of
date documentation usually errs by overstating what software does. This one
understated it, which is unusual but still wrong: a reader assessing whether
the API can be abused would have concluded the protection was nearly useless.

The caveats are kept deliberately prominent, because a limitations section
that lists only strengths is not one:

* **It fails open.** If Redis is down, requests are allowed rather than
  refused, so an outage removes the spending ceiling. Each one logs a warning.
* **The address limit is shared.** Everyone behind one network, such as a
  school or office, draws on the same 90.
* **The install id is client generated.** It identifies a browser, not a
  person, which is why the other two limits exist at all.

**What breaks without it.** A newcomer reads the README, believes the API has
almost no abuse protection, and either worries needlessly or, worse, goes
looking for `ratelimit.ts` to fix and finds it missing.

**Interview questions**

*Q: Documentation that understates a system seems harmless. Why fix it?*
A: Because documentation is how people decide what to trust and what to change.
Understating a protection leads to wasted work rebuilding something that
exists, or to wrong decisions made on a false premise, such as rejecting the
tool on security grounds. Wrong in either direction is still wrong, and the
specific symptom here, a pointer to a deleted file, makes every other claim in
the document less believable.

*Q: Why spell out the weaknesses in a README rather than just the features?*
A: Because whoever reads that section is trying to judge risk, and the
weaknesses are exactly what they need. Saying plainly that the quota fails open
lets an operator decide whether to monitor Redis, and saying the install id is
client generated stops someone treating it as a user identity. Stating limits
openly also tends to build more trust than hiding them, since they will be
found eventually.

---

## Save real API answers for the product film

**What changed.** `content/demo-outputs.json` holds four answers from the live
API: an editorial paragraph we wrote, Shakespeare's Sonnet 73, a paragraph of
Darwin, and a passage from *Marbury v. Madison*. Each entry keeps the exact
request, the response, the HTTP status, the time it took and when it was
fetched. A small script, `video/scripts/generate-outputs.mjs`, made the file
and refuses to overwrite it unless told to with `--force`.

**Why.** The film shows ContextReader explaining things, so the explanations
on screen have to be ones the product actually gave. Saving them once, with
everything needed to reproduce the request, means the film renders from real
output instead of text someone typed to look good. The script also checks that
every phrase the answer quotes really appears in the passage, and records the
result.

**What breaks without it.** The film would need hand-written explanations,
which are easy to make better than the product really is. That's a quiet way
to mislead the people the film is meant to convince.

**Interview questions**

*Q: Why save the request alongside the answer, not just the answer?*
A: Because an answer on its own can't be checked. With the exact request, the
time and the endpoint, anyone can send the same thing again and compare. It
turns "trust me, it said this" into something you can verify, which matters
when the output is used publicly.

*Q: Why make the script refuse to overwrite the file by default?*
A: The saved answers are evidence, and regenerating them silently would swap
in different, possibly better-looking ones. Requiring `--force` makes
replacing them a deliberate act that shows up as a change in git, instead of
something that happens by accident when someone reruns a script.

---

## Log an answer that used outside knowledge without saying so

**What changed.** `docs/eval-findings.md` is a new log of real outputs that
broke one of the prompt's rules. Its first entry is the *Marbury v. Madison*
answer, which named "Chief Justice Marshall" and "judicial review" although
neither appears in the passage. The prompt says anything known from outside
the passage must be introduced as such ("Outside this passage..."), never
stated as if it were read there.

**Why.** Both facts are correct, which is exactly the danger: a reader can't
tell what the tool read from what it remembered, and next time the memory may
be wrong. The entry also records why the existing quote checker missed it. The
checker only looks at text inside quotation marks, and this problem was in
plain sentences. That gives Phase B, the grounding work, a concrete case to
test against.

**What breaks without it.** The finding would live only in a chat message and
be forgotten, and Phase B would start from a guess instead of a real example.

**Interview questions**

*Q: If the facts were correct, why count this as a failure?*
A: Because the product's promise is to explain what the page says. Mixing in
unmarked outside knowledge breaks that promise even when it happens to be
right, and the reader has no way to tell the difference. Rules like this are
judged by the process, not by whether the output got lucky.

*Q: Why keep a log of failures rather than just fixing the prompt?*
A: A fix needs a test, and a test needs a real example of the failure. The log
gives you inputs you know go wrong, so you can confirm a fix works and catch
the problem if it comes back. Without it you're tuning against memory.

---

## Record the icon research and keep the current icon

**What changed.** `docs/icon-research.md` records research into a new icon:
Chrome's official icon rules, Apple's and Google's advice on legible icons, a
comparison of 15 similar extensions, and three concepts. It opens with the
decision to keep the existing icon. The concept files and the comparison
images live in `design-private/`, which `.gitignore` now keeps out of the
repository.

**Why.** The research turned up useful facts, such as the toolbar icon being
16 device pixels and the store icon needing 16 pixels of transparent padding.
Writing them down means nobody has to look them up again. The decision itself
is worth recording too: the current icon's highlighted middle line already
carries the highlight idea, it's more polished than the concepts, and users
already recognise it. The comparison images contain other companies' icons, so
they stay on this machine and are never published.

**What breaks without it.** Someone proposes a redesign next year and redoes
the same research, or commits other brands' icons to a public repository.

**Interview questions**

*Q: Why write up research that ended in "change nothing"?*
A: Because "we looked and decided not to" is a decision, and decisions without
reasons get reopened. The record shows what was considered, which rules apply,
and why the current icon won, so the next discussion can start from there
instead of from scratch.

*Q: Why keep the competitor images out of git instead of just not linking
them?*
A: Anything committed to a public repository is published and stays in its
history even if deleted later. Ignoring the folder means the images can't be
committed by accident in a later `git add .`, which is safer than relying on
everyone remembering not to.

---

## Add the product film source in `video/`

**What changed.** A new `video/` folder holds a short product film built with
Remotion, a tool that turns React components into video frames. It has its
own `package.json`, so it doesn't touch the app, the API or the extension. It
makes a 35 second 16:9 film, a 20 second vertical cut for phones, a Hinglish
16:9 version, a 6 second loop, five store screenshots, two promo tiles and
thumbnails. `npm run music` fetches and prepares the soundtrack, and
`npm run render` builds everything into `video/out/`. `CREDITS.md` lists every
source and licence. The root `tsconfig.json` now excludes `video/`, because
the folder is type-checked by its own config with its own dependencies.

**Why.** Recreating the real pill and card in code, instead of filming the
screen, keeps every frame sharp and lets the film be re-rendered whenever the
copy changes. Three honesty rules are built into the code rather than left to
memory:

* Every explanation is read from `content/demo-outputs.json`, never typed in.
* The pill and card copy the measurements in `src/extension/content.js`, and
  only the colours change.
* The music file is never committed. Pixabay's licence forbids redistributing
  it on its own, so a script downloads it instead.

All rendered media is gitignored, because large binary files bloat a
repository forever and can be rebuilt from source.

**What breaks without it.** Without the root `tsconfig.json` exclusion, CI's
typecheck would try to compile the film's files without Remotion installed and
fail on every push.

**Interview questions**

*Q: Why build a product video in code instead of a video editor?*
A: Code makes it repeatable and reviewable. Changing a caption or a timing is a
small diff that anyone can read, and the whole film re-renders the same way
every time. In an editor the same change is manual work that leaves no record.
It also lets the film read real data, so the explanations shown can't drift
from what the product actually said.

*Q: The repository has two `package.json` files now. Why not one?*
A: The film needs Remotion and a different React version, which the website
doesn't. Keeping them separate means installing the website never pulls in
video tools, and a change to the film can't break the site's build. The cost
is two installs, which is fine for a folder that's rarely touched.

---

## Add store, hero and share-image compositions to the film source

**What changed.** The film source in `video/` gained four new outputs:

* **`StoreShot`:** five store screenshots drawn directly at 1280x800. Each
  has one plain caption and the real page, pill and card filling the frame.
* **`HeroLoop`:** a six second loop for the website: select, the Explain
  pill, the card opening. It has no captions, so it can sit beside the
  page's own headline.
* **`OgImage`:** the 1200x630 picture shown when the site is shared on
  social media, in the film's end-card style.
* **Promo tiles:** the quote fragment is replaced with a plain benefit line.

To build these, the page component can now scroll partway towards the
selected paragraph, and the card can stop cleanly between two sections
(`fitBlocks`) instead of cutting a sentence in half.

**Why.** The first store screenshots were frames of the film, so they carried
the film's headlines and its pacing: one was caught mid-scroll, others had
empty space where a montage caption had been. A screenshot has a different
job, which is to show one thing clearly at the size the store displays it,
so it gets its own layout. The website hero has the same problem with the
film's captions, which would sit next to the page's headline.

**What breaks without it.** The store listing shows half-scrolled cards and
leftover captions. The website's hero shows two competing headlines.

**Interview questions**

*Q: Why not just crop frames from the finished film for the screenshots?*
A: Because a film frame is designed to be seen for a moment while moving, at
full screen. A screenshot is studied while still, at about half size, next to
competitors. Things that work in motion, like a card mid-scroll or a caption
that builds up over a montage, look like mistakes in a still. Reusing the same
components keeps them accurate to the product; giving them their own layout
makes them work as stills.

*Q: What does "stop between two sections" buy you over a fixed height?*
A: A fixed height cuts wherever it lands, often mid-sentence, which looks
broken. Measuring where each section starts and clipping exactly there shows
whole blocks, the way the real card looks when you've scrolled to a section
boundary. It's honest to the product and reads cleanly.

---

## Add the landing page's media

**What changed.** `public/media/` now holds:

* the 35 second film (4.3 MB)
* the hero loop, as WebM (541 KB) and MP4 (273 KB)
* a poster image for each

`public/og.png` is the social share image and `public/icon-128.png` is the
current store icon. All of them were rendered from the film source in
`video/`.

**Why.** The page plays its own copy of the film instead of embedding
YouTube. A YouTube embed sets tracking cookies, and the privacy policy says
the site has no tracking, so embedding it would make the policy false. Files
in `public/` are served straight from the site with nothing else attached.
The loop comes in two formats because browsers differ: WebM is smaller where
it's supported, and MP4 plays everywhere else.

**What breaks without it.** The page has nothing to play. Embedding YouTube
instead would quietly break a promise the privacy page makes.

**Interview questions**

*Q: Why self-host a video instead of using YouTube, which is free and fast?*
A: Because of what comes with it. A YouTube embed loads Google's scripts and
cookies for every visitor, whether or not they press play. For a site whose
privacy page says "no tracking", that would make the page untrue. Self-hosting
costs some bandwidth, but nothing is loaded until someone clicks play.

*Q: Why give a `<video>` element several sources?*
A: The browser picks the first format it can play. Listing WebM first lets
browsers that support it download the smaller file, and MP4 second covers
the rest, so everyone gets the loop without anyone downloading both.

---

## Redesign the landing page in the film's identity

**What changed.** The front page is rebuilt around the product film's look:

* paper background, navy ink, yellow only where meaning is highlighted, blue
  for links and trust lines
* Inter for headings and interface text, Source Serif 4 for passages

It now has a hero with a short loop, the film, three steps, a tab demo of real
answers, who it's for, the five lenses, what makes it different, privacy in
plain words, and honest questions and answers. `/privacy` and `/test` keep
their content and pick up the new styling.

**Why.** The old page spoke to a reader who already knew what the tool was.
The new one is written at about a Class 8 reading level for the people who
need it most: exam takers, students, professionals and non-native readers.
A few rules are built into the code rather than left to memory:

* **Real answers only.** Every phrase shown as ContextReader's answer passes
  through `said()`, which stops the build unless the text appears word for
  word in `content/demo-outputs.json`. A paraphrase can't slip in.
* **The legal demo shows only its summary,** with a note saying so, because
  the full answer added background that isn't in the passage.
* **The privacy section lists the same four things as `/privacy`,** and
  promises nothing more.
* **No analytics and no third-party scripts.** The hero loop waits until the
  page is idle, never plays for readers who ask for less motion, and swaps
  in without a crossfade. The film loads only when someone presses play.
* **On phones, where the add-on can't run,** "Add to Chrome" becomes a button
  that copies the link.

**What breaks without it.** Visitors who don't already know the product
can't tell what it does or whether they can trust it. And without `said()`,
a well-meant tidy-up of a quote could put words in the product's mouth.

**Interview questions**

*Q: Why make the build fail on a misquote instead of just being careful?*
A: Because care fades and checks don't. The page makes a specific promise:
these are real answers, unchanged. If someone later "improves" a quote's
wording, the promise breaks silently. Checking each quote against the saved
file at build time turns the promise into something the code enforces, at no
cost to visitors since it runs before deployment.

*Q: The hero is a video. Why does the page show an image first?*
A: Speed and respect. The first thing a visitor sees should appear fast, and
an image paints sooner than a video starts. The video is added only after the
page has loaded and the browser is idle, starting at the same frame as the
image so the switch can't be seen. If the visitor has asked their system for
reduced motion, the video never loads at all.

---

## Play the film in a pop-up instead of its own section

**What changed.** The "See it in 35 seconds" section is gone. Under the hero
button there's now a text button, "Watch the 35-second film", that opens the
film in a modal window. The modal uses the browser's own `<dialog>` element:

* While it's open, keyboard focus can't leave it.
* Esc or the Close button shuts it, and so does a click outside the film.
* Closing pauses the film and puts focus back on the button.
* The film still downloads only when someone asks to watch it.

The film's poster image is deleted, since nothing uses it now.

**Why.** The same editorial passage and card appeared four times down the
page: in the hero loop, the film poster, the how-it-works card and the first
demo tab. The film poster looked like a second copy of the hero. Making the
film something you choose to open removes the repeat and leaves the page
shorter, while keeping the film one click from the top.

**What breaks without it.** Visitors scroll past what looks like the same
picture twice and wonder whether the page is broken or padded.

**Interview questions**

*Q: Why use `<dialog>` and `showModal()` instead of a styled `<div>`?*
A: Because the browser then does the hard accessibility work. `showModal()`
makes everything outside the dialog inert, so the keyboard and screen readers
can't wander behind it. It also closes on Esc and is announced as a dialog.
A `<div>` needs all of that built and tested by hand, and it's easy to miss
one part, like stopping focus escaping to the page underneath.

*Q: Why move focus back to the button after closing?*
A: Keyboard and screen-reader users rely on focus to know where they are.
If focus vanished to the top of the page when the modal closed, they'd lose
their place and have to find their way back. Returning it to the button that
opened the modal puts them exactly where they left off.

---

## Fix CI: type image imports without relying on a build file

**What changed.** A new file, `src/types/images.d.ts`, tells TypeScript that
importing an image (`import icon from '../../public/icon-128.png'`) is valid.
It does this by pointing at the image types that ship with Next.js.

**Why.** The redesigned page imports two images directly, so Next can work out
their sizes. Those imports only typecheck if TypeScript knows what an imported
`.png` or `.jpg` is. Normally `next-env.d.ts` tells it, but that file is
gitignored and is only written by `next build`. On a developer's machine it's
always there from an earlier build, so the typecheck passed locally. CI starts
from a clean checkout and typechecks before it builds, so the file didn't
exist yet and both Node versions failed with "Cannot find module". The fix was
confirmed by moving `next-env.d.ts` away and seeing the same two errors, then
adding this file and seeing them go.

**What breaks without it.** Every push fails CI, even though the site itself
builds and deploys. A red CI that people learn to ignore stops catching real
problems.

**Interview questions**

*Q: Why did this pass on your machine but fail in CI?*
A: My machine had a leftover file that CI didn't. `next-env.d.ts` is created by
`next build` and gitignored, and my earlier builds had left it in place. CI
checks out only what's committed and runs the typecheck first, so it saw the
project as a fresh clone would. The general lesson: when something passes
locally and fails in CI, look for state the local machine has that the
repository doesn't, such as generated files, caches or environment variables.

*Q: How do you reproduce a CI failure like this before pushing a fix?*
A: Remove the local state CI doesn't have and run the same command in the
same order. Here that meant moving `next-env.d.ts` aside, deleting
`.next/types` and running `tsc`. That produced CI's exact errors, which proves
the diagnosis, and then the fix can be checked the same way before anyone
waits on another CI run.

---

## Add a 4:5 hero loop for small screens to the film source

**What changed.** A new composition, `HeroLoopTall`, renders the hero loop as
a 4:5 portrait crop. It has the same timeline as the square loop, framed
closer, with the card showing just the summary. It renders to a 312 KB MP4
and a 500 KB WebM.

**Why.** On a phone the square loop shrinks to about 330px wide, which makes
the card text around 9px tall. A portrait crop fills more of a phone's width
and height, so the highlight and the answer are large enough to read without
zooming. Keeping the same timeline means the website can start either loop
from the same frame as its poster.

**What breaks without it.** Phone visitors, most of the traffic, see a
picture of the product too small to read.

**Interview questions**

*Q: Why render a separate crop instead of scaling the square video with CSS?*
A: Scaling only shrinks or grows the whole frame, so the text stays the same
fraction of the picture. A dedicated crop changes what's in the frame: less
empty page and bigger type relative to the screen. It's the same idea as art
direction for images, a different picture for a different shape.

*Q: Why keep both loops on the same timeline?*
A: The page shows a still poster first and swaps in the video at the
poster's exact moment, so the swap is invisible. That only works if every
version of the loop has that moment at the same time, five seconds in.

---

## Make the landing page work properly on phones

**What changed.** Six fixes for phones, which bring most of the traffic:

* **Hero loop sources.** The MP4 (H.264) source now comes before the WebM,
  because iOS Safari can answer "maybe" for WebM and then fail without
  trying the next source. The `muted` attribute is now written to the
  element, not just set as a property, and the loop plays inline.
* **Visible loop, poster on top.** The loop is never made transparent, since
  Safari won't autoplay a video it considers invisible. The poster now covers
  it and hides once playback starts. If the browser refuses to play (iOS Low
  Power Mode, for example), the poster stays.
* **Small screens get the 4:5 loop and poster,** chosen with `media` on the
  video sources and a `<picture>` for the poster.
* **Order on phones:** headline, subline, picture, button, trust strip, film
  link, so the product is on the first screen. Phones held sideways get text
  and picture side by side.
* **The film on a phone held upright is the vertical cut,** loaded only when
  someone asks for it.
* **"Send to my laptop" replaces "Works on desktop Chrome. Copy link".** It
  opens the phone's share sheet (WhatsApp, email, notes) where there is one,
  and otherwise copies the link and says "Link copied".

Which button shows is now decided by input type, `(hover: none) and
(pointer: coarse)`, not by screen width, so a narrow desktop window still
offers "Add to Chrome".

**Why.** The page was built desktop-first, and phones got a squeezed version:
the product picture below the first screen, a button that asked the reader to
copy a link by hand, and a loop that might not play on iPhones at all.

**What breaks without it.** A phone visitor scrolls before seeing what the
product does, may see a still image where a moving demo should be, and has no
easy way to get the page onto the computer where the add-on actually runs.

**Interview questions**

*Q: Why decide the button by input type instead of screen width?*
A: Because the question is "can this device install a Chrome extension", not
"how wide is the window". A desktop user with a narrow window can install it,
and a large tablet can't. `hover: none` together with `pointer: coarse`
describes a touch-first device far better than a width does.

*Q: How did you test iPhone behaviour without an iPhone?*
A: With Playwright's WebKit browser and touch emulation, which shares Safari's
engine. It confirmed the layout, the share sheet path and the vertical film.
It also showed its limit: that WebKit build refuses even a plain `muted
autoplay playsinline` video unless the user has interacted, which real iOS
Safari allows. So it could prove the fallback (the poster stays) but not that
the loop autoplays on a real iPhone. That still needs checking on a device.

---

## Stop showing readers raw JSON when the model forgets to escape a quote

**What changed.** When the model's reply doesn't parse as JSON, the server
now repairs stray quotation marks and tries again before giving up. A
quotation mark inside a string is escaped unless what follows it is
structure: a colon, a closing bracket, the end of the text, or a comma
leading into the next key. If the reply still doesn't parse and looks like
JSON, the server returns "The answer came back garbled. Try again." instead
of showing it.

**Why.** The prompt tells the model to quote the passage as evidence, and it
often writes those quotation marks inside a JSON string without the
backslash JSON needs, as in `"body": "it calls the plan "an apology" here"`.
One unescaped mark makes the whole reply invalid. The server then fell back
to showing the reply as plain text, so readers saw braces, `"label":` keys
and all. In testing, two of three real requests hit this, and three of the
nineteen eval cases failed for this reason alone.

**What breaks without it.** A good answer is thrown away and the reader sees
something that looks broken, on exactly the passages where quoting matters
most.

**Interview questions**

*Q: Why repair the JSON instead of asking the model to get it right?*
A: You do both, but you can't rely on the request alone. A language model
produces text that usually follows the format, not text that is guaranteed
to. The stronger fix is a response mode where the provider enforces the
schema, and that comes next. Even then, a cheap, conservative repair as a
fallback means one stray character doesn't cost the reader the whole answer.

*Q: How do you stop a repair like this from damaging replies that were fine?*
A: It only runs when the original fails to parse, so valid JSON is never
touched. There's a test that valid JSON passes through unchanged. And the
rule is conservative: a quotation mark only counts as the end of a string
when what follows is clearly JSON structure.

---

## Share one quote checker between the card and the eval

**What changed.** `src/extension/quotes.js` is a small plain-script module
that finds the double-quoted spans in an answer and checks each against the
text that was actually sent: the selection and its surrounding paragraphs.
A quote counts only if it has at least three words. It is verified only if
those words appear in the sent text in the same order; case, curly versus
straight quotation marks and extra spaces are ignored. Punctuation at either
end is trimmed, so only the words would be highlighted. `npm run eval` now
uses the same file to report how many counted quotes were verified.

**Why.** The card is about to highlight quotes as evidence, and a highlight
is a claim: "these exact words are on the page". That claim needs one
definition used everywhere. If the eval measured grounding one way and the
card highlighted another way, the number would say nothing about what
readers see. The three-word floor exists because one or two words
("strategy", "in turn") appear in almost any passage, so finding them proves
nothing.

**What breaks without it.** The card could highlight a misquote as if it were
on the page, and the eval's grounding number would describe a different rule
from the one readers see.

**Interview questions**

*Q: Why load the same file in the extension and in Node, instead of writing
the logic twice?*
A: Two copies drift. Someone fixes an edge case in one, and the test keeps
passing on the other. Writing it as a plain script that attaches itself to
the global object lets the browser load it as a content script and Node load
it in a VM, so the tests and the eval exercise the exact code that ships.

*Q: Why ignore case and quotation-mark style but not a changed word?*
A: Those differences don't change what was said: "Unfair" at the start of a
quote, or a curly apostrophe in the page against a straight one in the
answer. A changed word does change what was said, and a misquote presented
as evidence is worse than no quote at all.

---

## Let Chrome deliver the keyboard shortcut

**What changed.** The service worker now listens for a manifest command,
`explain-selection`, and passes it to every frame of the active tab. It can
also tell the content script which shortcut Chrome actually assigned, read
from `chrome.commands.getAll()`, or an empty string if none is. The command
itself is declared in the manifest in the next change.

**Why.** Until now the shortcut was a `keydown` listener inside the page. A
page handles its own keys first, and mail apps and editors routinely stop
the ones they use, so on those sites ⌘⇧E never reached the extension. In a
reproduction, a page that captured keys and text inside an iframe both
failed. A manifest command is handled by Chrome before the page sees the
key, so a page can't swallow it.

**What breaks without it.** The shortcut works on simple articles and
silently does nothing on the sites where people read most: mail, documents
and anything embedded.

**Interview questions**

*Q: Why ask Chrome which shortcut was assigned instead of showing the one in
the manifest?*
A: The manifest only suggests keys. Chrome won't assign them if another
extension already holds them, and the user can change them at
chrome://extensions/shortcuts. A hint advertising keys that don't work is
worse than no hint, so the pill shows what Chrome reports, or nothing.

*Q: Why send the command to every frame rather than just the top one?*
A: The selection can be inside an iframe, and only the frame that holds it
can read it. Each frame checks whether it has focus and a selection; the one
that does opens the card, and the rest ignore the message.

---

## Redesign the explanation card, and run in every frame without slowing pages

**What changed.** The card now matches the product film and the store
listing:

* **Lens.** The current lens is one button that opens a "Change lens" menu,
  instead of five wrapping chips. The menu works from the keyboard: arrows,
  Home, End and Escape.
* **Hierarchy.** The summary is 16px. Below it, each section is a heading
  you tap to open, and only the first starts open. Which sections are open is
  remembered per lens while the page stays open.
* **Evidence.** Quotes are highlighted in yellow only when the shared checker
  verifies them: three or more words, found word for word in what was sent.
  Anything else stays plain.
* **Close and footer.** A ✕ in the corner and Escape both close the card. The
  footer reads "N left today · Go deeper", with room kept for 👍/👎 later.
* **Loading and errors.** Loading is a short skeleton instead of a spinner.
  Errors are a plain heading and sentence with "Try again".
* **Height.** The card grows to about 70% of the window, then scrolls, and
  the visible area always ends between sections, never through a heading.
* **Focus.** Focus moves into the card when it opens and returns when you
  close it.
* **Dark mode** follows the page behind the selection, falling back to the
  system setting.

The content script now runs in every frame, and the manifest declares the
`explain-selection` command. Text inside iframes and in text fields can be
explained. Each frame does no DOM work until it actually has a selection.

**Why.** Five chips and an all-open list put the reader's eyes on navigation
before the answer. Running in every frame fixes iframes, but done naively it
costs every page with embeds. Measured on a page with 60 iframes, it added
240 elements up front. Creating nothing until a selection appears keeps that
at zero.

**What breaks without it.** The card looks unlike the product in the film and
the store. Quotes can't be trusted at a glance, and text in embedded frames
can't be explained at all.

**Interview questions**

*Q: Why highlight only verified quotes, and leave the rest plain instead of
marking them as wrong?*
A: A highlight is a promise that the words are on the page, so it's given
only when that's checked. Marking unverified quotes red would claim they're
false, when many are just paraphrase in quotation marks or too short to
check. Plain text makes no claim either way.

*Q: Running a script in every iframe sounds expensive. How do you keep it
cheap?*
A: Do nothing until needed. Each frame registers three listeners and stops.
The shadow root, the styles and the reader object are only created when that
frame has a real selection or is asked to explain one. Chrome still gives
each frame its own script environment, which costs memory even for an empty
script, but the page's own DOM is left untouched.

---

## Version 0.3.0

**What changed.** `manifest.json` goes from 0.2.2 to 0.3.0.

**Why.** This release changes what readers see and use: a new card, a
shortcut handled by Chrome, and support for iframes and text fields. Chrome
Web Store updates are keyed on the version number, and a minor bump
signals new behaviour rather than a fix.

**What breaks without it.** The store rejects an upload whose version isn't
higher than the published one, and anyone reporting a bug can't say which
card they saw.

**Interview questions**

*Q: Why a separate commit just for the version number?*
A: So the history shows exactly when the release was cut, and the version
can be moved or reverted without touching any of the code. It also keeps
"what changed" and "this is now 0.3.0" as two separate decisions.

*Q: Why 0.3.0 and not 0.2.3?*
A: The last number is for fixes that don't change behaviour. This release
adds features and changes the interface, which is what the middle number is
for. Before 1.0, that's the usual way to signal "noticeably new" without
promising long-term stability.

---

## Ask the model for schema-shaped JSON, and count how replies parse

**What changed.** Every request to the model now carries a JSON Schema for
the answer, `summary` then `sections` of `label` and `body`. It's sent as an
OpenAI-style `response_format` of type `json_schema`. Gemini's
OpenAI-compatible endpoint supports this ([OpenAI compatibility, structured
output](https://ai.google.dev/gemini-api/docs/openai)) and turns it into
constrained decoding: the model can only produce text that is valid JSON of
that shape ([Structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)).
If a provider rejects the schema with a 400, the request is sent once more
without it.

The stray-quote repair stays as a fallback. The server now records how each
reply parsed (as sent, after mending stray quotes, or not at all) as a daily
counter in Redis. It's a number only, never text, and expires after 30 days.
`node scripts/parse-stats.mjs` prints the counts.

**Why.** The repair fixes the symptom after the fact. The schema stops the
broken JSON being written at all. Measured on 20 real requests each, with the
product's own prompts:

| | Parsed as sent | Needed quotes mended | Unreadable |
| --- | --- | --- | --- |
| Without the schema | 18 | 2 | 0 |
| With the schema | 20 | 0 | 0 |

The counter is how we'll know the rate in production instead of guessing.

**What breaks without it.** About one reply in ten depends on a repair
heuristic. And nothing would tell us if a model update made it worse.

**Interview questions**

*Q: If the schema guarantees valid JSON, why keep the repair?*
A: Because the guarantee depends on the provider and the model. A fallback
path without the schema, a different model behind the same setting, or a
future API change could bring the old failure back. The repair is cheap,
only runs when parsing fails, and now its use is counted, so if it starts
firing again we'll see the number move.

*Q: Why count parse outcomes rather than log the failing replies?*
A: The replies contain what people were reading, and the privacy policy
promises that's never stored. A count answers the question that matters, how
often parsing goes wrong, without keeping anything a reader selected.

---

## Fix the irony-swift check, and report evidence as counts

**What changed.** Three changes to `scripts/eval.mjs`:

* **irony-swift.** The check no longer fails an answer that says the writer
  "does not actually advocate" the proposal. A negation in the three words
  before the phrase means it isn't the misreading. Each case can now carry
  examples its check must allow and must catch, and the eval verifies them
  before making any request.
* **Counts, not percentages.** Verified quotes are reported as "25 of 26".
* **Same request as the product.** The eval sends the same response schema
  the server does, and reports how replies parsed. `--no-schema` sends the
  old request, for comparison.

**Why.** The old irony check marked a correct answer wrong. Correct readings
of irony often say what the writer does *not* mean, so the check punished
exactly the answer it should reward. The full record is in
`docs/eval-findings.md`. Percentages on two dozen quotes suggest a precision
the sample doesn't have: one quote moves the number by four points. And an
eval that doesn't send what the product sends measures something else.

**What breaks without it.** A false failure trains everyone to ignore the
eval. A percentage invites reading noise as a trend.

**Interview questions**

*Q: How is this different from loosening a test to make it pass?*
A: Loosening would let real misreadings through. This keeps every
misreading the old pattern caught, and the eval now proves it on every run
with examples that must still be caught, while no longer catching the
negated phrasing of a correct answer. The test was wrong, not the model.

*Q: Why test the test?*
A: A check written as a regular expression is code too, and it can be wrong
in either direction without anyone noticing. A few labelled examples, run
before the expensive part, make a broken check fail loudly and immediately,
instead of quietly producing a wrong score.

---

## Stream answers from the server as structured events

**What changed.** When a request includes `"stream": true`, `/api/explain`
answers with newline-delimited JSON events instead of one JSON reply:

* `start`: the lens, depth and allowance, sent at once
* `summary`: summary text, in pieces as the model writes it
* `section`: a new section begins, with its label
* `delta`: that section's body, in pieces
* `done`: the whole answer, parsed properly
* `error`: what went wrong, and whether some text had already arrived
* `wait`: every ten seconds while nothing else is being sent

Underneath, the server asks the model to stream (`stream: true`, still with
the response schema). `src/lib/stream.ts` reads the model's server-sent
events and, as the JSON arrives, works out whether each piece of text
belongs to the summary, a label or a body. Requests without `"stream"` get
the old single reply, so 0.2.2 and the eval keep working.

Two safety rules come with it:

* **Stalls.** If the model sends no text for 12 seconds (45 seconds before
  the first words in deep mode, because a reasoning model writes nothing
  while it thinks), the request is aborted. If nothing had reached the
  reader yet, it's retried once, invisibly. If words had already been shown,
  it ends with "Answer cut off. Try again." instead, because a retry would
  replace them.
* **Charged once.** The allowance is charged before the stream starts,
  exactly as before, so streaming can't bypass it. The client also sends a
  request id. A retry with the same id within two minutes isn't charged
  again, on the server or in the extension.

**Why.** A fast answer takes about two seconds, and a deep one ten or more.
Showing the first words as soon as they exist makes the wait feel shorter
and shows the reader that something is happening.

**SSE versus WebSockets.** Streaming here goes one way, server to reader,
for a few seconds, once per question. A normal HTTP response whose body
arrives in pieces does exactly that. It works through the same `fetch`, the
same CORS rules, the same quota check and the same Vercel edge function. A
WebSocket is a two-way connection that stays open. That's useful for chat
or live collaboration, but here it would mean a separate protocol, a
connection to manage and nothing gained, since the reader never needs to
send anything mid-answer. The model's own stream uses server-sent events
(`data:` lines). Ours uses one JSON object per line, the same idea in an
even simpler format.

**Why structured events instead of passing on partial JSON.** The model's
reply is one JSON document, and a half-finished JSON document can't be
parsed. Forwarding raw fragments would make every client rebuild a JSON
parser that tolerates incomplete input, and get escapes split across chunks
right. The server does that once, in one tested place, and sends events the
card can apply directly: add this text to the summary, start a section with
this label. The `done` event still carries the properly parsed answer, so
the streamed text is a preview and the final version is authoritative.

**What breaks without it.** Readers stare at a skeleton for the whole answer.
A provider stall leaves the card waiting until a 45-second timeout. And a
reader who taps Try again after a failure pays twice.

**Interview questions**

*Q: How do you stop a retry after a failure from being charged twice?*
A: The client makes a random id for each request and sends it with any
retry of that request. The server remembers the id for two minutes with a
Redis `SET NX`, which only succeeds the first time. If it's already there,
the request is let through at a cost of zero. The id is scoped to the
install, so it can't be used to dodge someone else's limit.

*Q: Why retry a stall only if nothing has been shown yet?*
A: A retry starts the answer from scratch, and the model may well say it
differently the second time. If the reader has already seen half of the
first version, silently swapping in a different one would be confusing. So
the system is honest instead: it keeps what arrived, says it was cut off,
and offers a free retry.

---

## Stream answers into the card over a port

**What changed.** The card now opens a long-lived connection to the service
worker, `chrome.runtime.connect({ name: 'explain' })`, and sends one request.
The worker reads the server's event stream and posts each event back as it
arrives. The card shows the skeleton until the first words, then fills the
summary in word by word, then each section. When a section is complete, its
verified quotes are highlighted. When `done` arrives, the card redraws once
from the final answer, in the same task, so nothing flickers. Closing the
card disconnects the port, and the worker aborts the download.

The card never jumps. Its position is decided once, for the tallest it can
get (about 70% of the window). Below the selection, it simply grows
downward. Above, the full height is reserved up front, because a card that
grew upward would push the words already on screen. While text is arriving,
the visible area doesn't snap to section boundaries; it does that once, at
the end. On a real article, the card's top, the summary and the first heading
moved zero times during streaming.

If the answer is cut off, what arrived stays on screen with "Answer cut off.
Try again." The retry reuses the request id, so it's free.

**The MV3 service worker and port lifetime.** An extension's background
script is a service worker, and Chrome stops one after 30 seconds without
activity. In Chrome's words, "receiving an event or calling an extension API
resets this timer", and "sending a message with long-lived messaging keeps
the service worker alive", though "opening a port no longer resets the
timers" ([The extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)).
So an open port alone isn't enough; messages have to flow. While an answer
streams, every event posted to the port counts. Before the first word, a deep
read can think for longer than 30 seconds, which is why the server sends a
`wait` event every ten seconds and the worker forwards it.

**What breaks without it.** Streaming would only reach the worker, not the
card. And without the keep-alive, Chrome could stop the worker in the middle
of a slow deep answer, leaving the card waiting for words that never come.

**Interview questions**

*Q: Why a port instead of `sendMessage` for this?*
A: `sendMessage` gets exactly one reply, and an answer that streams is many
messages over several seconds. A port is a two-way channel that stays open
until either side disconnects. That also gives cancellation for free: closing
the card disconnects the port, and the worker aborts the request instead of
downloading an answer nobody will see.

*Q: How do you make text appear word by word without the layout jumping?*
A: Decide where the card goes once, using the biggest size it can reach, so
growth never forces it to move. Grow only downward, and reserve the full
height when the card has to sit above the selection. Append text instead of
re-rendering. When the final answer arrives, swap it in within a single task,
so the browser never paints the halfway state. Then measure it: sample the
positions of what's already on screen while text streams, and check that
none of them changes.

---

## Cap deep reads per day, and never charge for a request the provider refuses

**What changed.** Three things on the server:

* **A daily cap on deep reads, across everyone.** It's set by
  `DEEP_DAILY_CAP` and defaults to 15. Each deep request takes a slot from a
  Redis counter before the reader is charged anything. When the slots are
  gone, the API answers `503` with `code: "deep_resting"` and the time it
  resets, and the reader's allowance is untouched. A reader refused for their
  own limit gives their slot back.
* **The provider's own refusals are free.** If the model provider answers
  `429`, the reader's charge is refunded: install, address and global
  counters, and the request id is forgotten. The reply says so plainly. A
  per-day quota error (Gemini names it `…PerDay…`) is told apart from a
  momentary rate limit. For the deep model, a per-day error closes deep reads
  for the rest of the day, in case the cap was set too high.
* **Charges are recorded.** `spend` now reports what a request actually
  cost, so a refund gives back exactly that: nothing for a repeat that was
  already free.

**Why.** The deep model's free tier allows about 20 requests a day for the
whole Google project. Each reader's allowance allows up to 10 deep reads, so
a handful of readers can use up the deep model for everyone. Without a cap,
the provider simply starts failing. And until now a reader was charged even
when the provider refused, for an answer they never got.

**What breaks without it.** Go deeper fails unpredictably for everyone once
the provider's quota is gone, and readers lose allowance to those failures.

**Interview questions**

*Q: Why check the cap before charging the reader, rather than after?*
A: Because a refusal must cost nothing, and the cheapest refund is the one
you never have to make. Taking a slot first and charging second means a
refused deep read touches only the deep counter. In the rarer case where the
slot is taken and the reader is then refused for their own limit, the slot
is given back, so the counter stays equal to deep reads actually served.

*Q: Why distinguish a per-day quota error from a per-minute one?*
A: They need opposite advice. A per-minute limit clears in seconds, so the
honest message is "try again in a minute". A per-day limit won't clear until
tomorrow, so telling people to retry would only frustrate them. It's also
the signal to stop sending deep requests to the provider at all for the rest
of the day.

---

## Show "Go deeper is resting until tomorrow", and refund it locally

**What changed.** When a deep read is refused, the card goes back to the
answer the reader already had. Its Go deeper button is disabled and reads
"Go deeper is resting until tomorrow". The service worker gives back the
three explanations it had counted on this device, and tells the card the
corrected number so the footer never shows the charge. It also remembers the
resting state until the reset time, so the next deep read is answered at
once, without a request or a charge. Refusals the server explains are never
retried, and other refusals the provider makes (busy, or out for the day)
are refunded the same way.

**Why.** A refusal that silently costs three explanations, or replaces a
good answer with an error, punishes the reader for a limit they didn't
choose. Keeping their answer and saying plainly what's unavailable is both
kinder and more honest.

**What breaks without it.** Tapping Go deeper on a busy day would erase the
answer on screen, show an error and spend three of the reader's daily
explanations for nothing.

**Interview questions**

*Q: The server already refunds. Why does the extension refund too?*
A: There are two counters. The server's is the one that's enforced. The
extension keeps its own on the device, so it can show "29 left today"
without asking the server. Both were charged, so both have to be given back,
or the footer would show three fewer than the reader really has.

*Q: Why remember the resting state on the device instead of asking each
time?*
A: Once the server has said deep reads are closed until a given time,
asking again before then can only get the same answer. Answering locally is
instant, doesn't spend a request on either side, and the stored time means
it reopens by itself after the reset.

---

## Keep test runs off the production key

**What changed.** `scripts/key-guard.mjs` compares the key a script is about
to use with `PROD_KEY_HASH`, the SHA-256 of the production key, and prints a
loud warning if they match. Only the hash is ever configured; the key itself
is never printed or stored. The eval uses it, and now skips the deep cases
unless `--include-deep` is passed. `scripts/timing.mjs`, which measures time
to first words and total time, streaming and not, also checks the key the
local server will use, and runs deep timings only with `--include-deep`.

**Why.** One afternoon of evals and timing runs used up the deep model's
whole daily quota for the project. When that project's key is also the
production key, every reader's Go deeper stops working. Testing now uses a
separate Google AI Studio project, and this makes it hard to get wrong
silently.

**What breaks without it.** A routine test run takes Go deeper away from
real readers for the rest of the day, and nothing says why.

**Interview questions**

*Q: Why compare a hash instead of the key itself?*
A: So the production key never has to be on the developer's machine at all.
A hash can sit in a local config file safely: it can't be turned back into
the key, but it's enough to recognise the key if someone pastes it in by
mistake.

*Q: Why make deep cases opt-in rather than just warning?*
A: Because the cost is shared and scarce. A fast case is cheap, so the
default run covers everything fast. A deep case spends one of about twenty
daily requests for the whole project. Making it opt-in means spending that
quota is always a deliberate choice, not a side effect of running the
default command.

---

## Count the deep cap on Google's day, and show the reset in the reader's time

**What changed.** The deep cap now counts days the way Google does: from
midnight Pacific time. Its Redis key is the Pacific date, for example
`cr:deep:2026-11-05`. The reset time comes from `America/Los_Angeles`
through `Intl`, so winter (PST, UTC−8) and summer (PDT, UTC−7) are both
right, including the nights the clocks change. The reader's own allowance
stays on its own day.

Every deep refusal now carries the reset time. The card turns it into the
reader's local time: "Go deeper is resting until 1:30 PM", "until tomorrow,
1:30 PM", or a weekday if further off.

**Why.** Gemini's per-day quotas reset at midnight Pacific. A cap counted on
any other day would be out of step with the provider for part of every day:
it would open fresh slots while Google still counted the old day as spent, or
stay closed after Google had reset. "Until tomorrow" was also wrong for most
readers: for someone in India the reset is early afternoon on the same day.

**What breaks without it.** For part of each day Go deeper would say it's
available and then fail, or say it's resting when it isn't. And readers
would be told to wait until tomorrow for something back at lunchtime.

**Interview questions**

*Q: Why not just add eight hours to UTC to get Pacific time?*
A: Because Pacific time is UTC−8 only in winter. From March to November it's
UTC−7, and the switch happens at 2am on dates that move each year. Hard-coding
an offset is wrong for half the year. Asking `Intl` for the time in
`America/Los_Angeles` uses the time-zone database, which knows when the
clocks change. The tests check midnight on both sides in both seasons, and
on both nights the clocks change.

*Q: Why do the deep cap and the reader's allowance use different days?*
A: They limit different things. The deep cap mirrors the provider's quota,
so it has to reset when the provider does. The reader's allowance is a
promise to the reader ("resets at midnight"), so it follows their day. Using
one clock for both would make one of them wrong.

---

## Call it Go deeper everywhere, and say when it's back

**What changed.** After a deep answer, the button used to change its label
to "Read closely". It now stays "Go deeper", disabled, with a tooltip saying
the answer already used it. The extension's messages, the README and the
store description say "Go deeper" instead of "a deep read" or "the deep
pass". When Go deeper is resting, the card shows the reset time in the
reader's local time. The README and the store text now say plainly that Go
deeper doesn't always catch subtle effects, and that it can be resting on
busy days.

**Why.** One feature with three names (Go deeper, Read closely, deep read)
makes people wonder whether those are three different things. The button is
what people see first, so its name is the one everything else uses. The
honesty changes keep the description in line with the eval: on the
line-break case, Go deeper succeeds about one time in three.

**What breaks without it.** A reader sees "Read closely" and looks for a new
feature. And the store promises catches Go deeper makes only sometimes.

**Interview questions**

*Q: Is renaming one label worth a commit?*
A: Consistency in names is part of the interface. When the same action is
called different things in different places, people assume they're
different actions and lose trust when they turn out to be the same. It costs
a few lines to fix and saves confusion for everyone who reads the store
page, the card and the help text.

*Q: Why keep the button visible but disabled, rather than hiding it?*
A: Hiding it would make it look like the feature vanished. A disabled button
with its usual name, and a tooltip saying why, tells the reader what exists,
that they've already used it, or when it's back, without making them hunt.

---

## A script to check the live API after a deploy

**What changed.** `node scripts/verify-live.mjs [base-url]` runs five checks
against the live API, as a fresh `test-` install, and prints pass or fail for
each:

* **(a)** the single-reply request that 0.2.2 sends still works
* **(b)** streaming sends `start`, summary text, sections and `done`, and
  charges once
* **(c)** a deep request costs the reader three and takes a deep-cap slot. It
  prints the Redis key to look for in Upstash, `cr:deep:<Pacific date>`, and
  reads it before and after if the Upstash variables are set
* **(d)** refused requests cost nothing
* **(e)** CORS turns away a foreign origin and allows the extension

It sends 3 fast requests, 1 deep, 1 malformed and 2 preflights, and exits
non-zero if anything fails.

**Why.** The new behaviour (streaming, the deep cap, refunds) only fully
works with production's Redis and keys, so it can't be fully proven before
the deploy. A short, repeatable check right after the deploy catches a
broken release before readers do, without spending more than one deep
request.

**What breaks without it.** A deploy that breaks 0.2.2 users, or charges for
refusals, would be noticed only when readers complain.

**Interview questions**

*Q: Why verify through the public API instead of reading the database?*
A: Because what matters is what clients experience. The API's own replies
report the remaining allowance, so the script can see exactly what a reader
was charged without any special access. Reading Redis is an optional extra,
read-only, for the one thing the API doesn't expose, the deep cap counter.

*Q: How do you keep a production check from doing harm?*
A: Use a throwaway identity, so it only ever spends its own allowance.
Send the fewest requests that prove each point. Never write to production
state; the Redis access is read-only. And skip with an explanation, rather
than force, anything that can't be shown safely, like a deep refusal when
the cap isn't full.

---

## Show when the allowance really resets, instead of "midnight"

**What changed.** Every answer from the server says when its day ends
(`quota.resetAt`, also sent as `X-Quota-Reset`). The extension now keeps
its own count on that same window, and shows the time in the reader's local
time:

* **Card footer:** "29 left today · resets at 18:30", or "resets tomorrow
  at 0:00"
* **Popup:** "29 of 30 explanations left today, resets at 18:30"
* **Over-limit messages:** "Resets at 18:30."

Until the first answer arrives there's no time to show, so nothing claims
one. When Go deeper is resting too, its note moves to its own line under the
count, so the footer doesn't wrap into a jumble.

**Why.** The server counts the allowance on one fixed day, India's midnight
by default, but the extension said "resets at midnight", meaning the
reader's own. For anyone outside India that was wrong by hours. Showing the
real time, in their clock, is honest now, and a per-reader midnight can come
later (planned for 0.4).

**What breaks without it.** A reader in London is told the allowance resets
at midnight, finds it's still empty at 00:05, and reasonably thinks the
extension is broken.

**Interview questions**

*Q: Why move the device's count onto the server's window instead of keeping
it on the local date?*
A: Two counters with different days drift apart. The device would show 30
left at local midnight while the server still refused until India's
midnight. Following the time the server reports keeps the number on screen
and the number enforced in step.

*Q: Why not just convert "midnight in India" to local time in the
extension?*
A: That would bake the server's setting into the client. The server's day
is configurable (`QUOTA_DAY_OFFSET_MINUTES`) and may change, for example to
per-reader days in 0.4. Using the reset time the server actually sends means
the extension is right whatever the server decides.

---

## Rename the store listing to say what it does

**What changed.** The extension's `name` in `manifest.json` is now
"ContextReader: Explain Hard Sentences & Editorials", and its `description`
is "Select a hard sentence on any page and see what the writer actually
means, in plain English, with the words it relies on quoted." (128
characters).

**Why.** The Chrome Web Store builds the listing's title and short summary
from these two fields. "ContextReader" on its own tells a searcher nothing
about the job it does, and people search for what they need ("explain",
"hard sentence", "editorial"), not for a product name they haven't heard
of. The description now says, in plain words, what happens and what makes
it trustworthy.

**What breaks without it.** The listing stays hard to find and doesn't say
what it's for until someone opens it.

**Interview questions**

*Q: Why change these in the code rather than in the store dashboard?*
A: For an extension the manifest is the source of truth. The store reads the
title and summary from the uploaded package, and Chrome shows the same name
on the extensions page and in menus. Keeping it in the code means the name
is reviewed like any other change, and every place shows the same thing.

*Q: Is a long, descriptive name a good idea?*
A: Within limits. The name has to fit the store's space and still read as a
name, so it leads with the brand and adds the job after a colon. It's 50
characters, well inside the limit, and the description stays under the 132
the store allows.

---

## Say that text in text boxes and frames can be sent, and only when asked

**What changed.** `/privacy` and the privacy section on the front page each
gain one plain sentence. Since 0.3.0, text inside a text box or an embedded
frame, like an email or chat message being read or written, can be
explained, and that text is sent only when the reader selects it and clicks
Explain or presses the shortcut. The policy's "last updated" date moves to
5 November 2026.

**Why.** 0.3.0 reads selections in iframes and text fields, which reach
places 0.2.2 didn't, such as a message someone is still drafting. The
promise ("nothing is sent until you ask") hasn't changed, but a reader
deciding whether to trust the extension in their inbox deserves to see it
spelled out for exactly that case. The store's Privacy tab gets the same
update, with "Personal communications" ticked.

**What breaks without it.** The policy would describe less than the
extension can do, which is the kind of gap that loses trust when someone
finds it.

**Interview questions**

*Q: The behaviour on asking hasn't changed. Why update the policy?*
A: Because the reach has. A privacy policy should describe what can leave
the browser, and drafts and messages are more sensitive than a news article.
Saying so plainly, with the condition that protects them, lets readers make
an informed choice instead of discovering it.

*Q: Why also tick "Personal communications" in the store, if it's only sent
when asked?*
A: The store's categories are about what data can be handled, not how often.
An email selected and explained is a personal communication leaving the
browser, even if it only happens on request. Declaring it is accurate, and
under-declaring is the riskier mistake for both readers and review.

---

## Stop the card scrolling its own summary out of view

**What changed.** The card's body no longer uses CSS scroll snapping
(`scroll-snap-type: y proximity` on the body, `scroll-snap-align: start` on
each section).

**Why.** Snapping was meant to make scrolling land neatly on section
headings. But a browser re-applies snapping whenever the content changes
size. When a streamed answer finished and the card redrew, it snapped to the
nearest heading, the first section, and the summary at the top scrolled out
of view. The reader opened a card and saw the middle of it. This showed up
while taking the store screenshots, where the summary was hidden in two of
four cards. Keeping headings uncut at the bottom edge is already handled by
sizing the visible area to end between sections.

**What breaks without it.** The most important line of the answer, the
summary, is hidden as soon as it appears.

**Interview questions**

*Q: How can a CSS property that only affects scrolling move content the user
didn't scroll?*
A: Scroll snapping isn't only applied when the user scrolls. Browsers also
re-snap after layout changes, so a container stays aligned to a snap point.
In a container whose content is being replaced or growing, that means the
browser picks a snap point for you, here the first section heading, and
scrolls there on its own.

*Q: How did you find it?*
A: By capturing the real extension in a controlled setup and looking at the
result instead of assuming. The store screenshots showed cards opening
scrolled past the summary, which pointed at something scrolling the body
after render. Removing the snapping and recapturing confirmed it.
