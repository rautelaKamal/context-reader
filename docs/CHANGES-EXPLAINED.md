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
