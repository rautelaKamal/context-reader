# Eval findings

Real outputs that broke a rule the prompt sets, kept as evidence for the
grounding work in Phase B. Each entry is quoted from a saved output and is
never edited.

---

## Outside knowledge stated without the required marker

**Found:** 2026-11-03, while generating passages for the product film.
**Output:** `content/demo-outputs.json`, id `legal`, lens *Plain meaning*,
fetched from the live API.
**Passage:** *Marbury v. Madison*, 5 U.S. 137 (1803):

> So if a law be in opposition to the constitution: if both the law and the
> constitution apply to a particular case, so that the court must either decide
> that case conformably to the law, disregarding the constitution; or
> conformably to the constitution, disregarding the law: the court must
> determine which of these conflicting rules governs the case.

**What the answer said** (section *In other words* and *Why it matters here*):

> Chief Justice Marshall sets up an unavoidable clash...

> This is the foundational pivot of the entire argument for judicial review.

**The rule it broke.** `src/lib/prompts.ts` requires anything known from
outside the passage to be introduced with "Elsewhere in the work", "In the
wider text" or "Outside this passage", and never stated as though read there.
Neither *Chief Justice Marshall* nor *judicial review* appears in the passage
or its surrounding text. Both are correct, which is what makes this dangerous:
a reader cannot tell recall from reading, and the next time the recall may be
wrong.

**Why the quote checker passed it.** All five quoted spans in this answer are
genuine and verified. The checker looks at text inside quotation marks; this
problem lives in plain, unquoted sentences. Verifying quotes alone does not
catch unmarked outside knowledge, so Phase B needs a second check.

**Used in the film?** Only the summary, which contains no outside knowledge:
"When an ordinary law and the constitution both apply to a court case but
contradict each other, judges are forced to choose which rule wins."

---

## A check that failed a correct answer: irony-swift

**Found:** 2026-11-04, in the eval run after the 0.3.0 card changes.
**Case:** `irony-swift`, lens *What's the point?*, on *A Modest Proposal*:
"a young healthy child well nursed is at a year old a most delicious,
nourishing, and wholesome food".

**What the answer said** (section *Their position*, quoted from the run):

> The literal statement that a child is "delicious, nourishing, and
> wholesome food" is entirely satirical; the writer does not actually
> advocate cannibalism, but rather uses this monstrous proposal to expose the
> callousness of society and the British ruling class toward the starving
> poor of Ireland.

**Why it was marked wrong.** The case rejects answers that take the proposal
at face value, using the pattern `/genuinely (recommend|propos)|sincere
proposal|actually advocat/i`. The answer reads the irony correctly and says
so in the negative, "does **not actually advocat**e", which the pattern
matched. Answers that get irony right often say what the writer does *not*
mean, so this pattern punished the right reading.

**The fix.** The pattern now ignores a match when a negation (`not`,
`never`, `nor`, `no`, `n't`) appears within the three words before it. The
case also carries examples the eval checks before making any request:

* allowed: "does not actually advocate", "doesn't actually advocate", "not a
  sincere proposal"
* still caught: "actually advocates eating children", "genuinely
  recommends", "a sincere proposal"

This repairs a broken check rather than loosening it: every misreading the
old pattern caught, the new one still catches.
