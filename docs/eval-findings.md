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
