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
