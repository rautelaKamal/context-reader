/**
 * Accuracy probe.
 *
 * Each case is a passage with a known right reading and a known way to get it
 * wrong. `expect` must appear in the answer, `reject` must not. Keyword
 * matching is a crude proxy for understanding, so the full output is printed
 * too - the checks catch regressions, the text is what you actually judge.
 *
 *   npm run eval            # all cases
 *   npm run eval -- irony   # cases whose name contains "irony"
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

for (const file of ['.env.local', '.env']) {
  const path = join(root, file);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const BASE = process.env.PROVIDER_BASE_URL;
const KEY = process.env.PROVIDER_API_KEY ?? process.env.HUGGING_FACE_API_KEY;
const MODEL = process.env.EXPLAIN_MODEL;
if (!KEY) { console.error('No key. Set PROVIDER_API_KEY.'); process.exit(1); }

const out = join(root, '.test-build');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
execFileSync('npx', ['tsc', 'src/lib/modes.ts', 'src/lib/prompts.ts', 'src/lib/context.ts',
  '--outDir', out, '--module', 'commonjs', '--target', 'es2022', '--skipLibCheck'],
  { cwd: root, stdio: 'inherit' });
writeFileSync(join(out, 'package.json'), JSON.stringify({ type: 'commonjs' }));

const require = createRequire(import.meta.url);
const { detectMode } = require(join(out, 'modes.js'));
const { buildMessages, parseExplanation } = require(join(out, 'prompts.js'));

const CASES = [
  {
    name: 'archaic-protest',
    why: '"protest" here means to vow or declare, not to object. The modern reading inverts it.',
    context: {
      selection: 'The lady doth protest too much, methinks.',
      markedParagraph: 'QUEEN GERTRUDE: «The lady doth protest too much, methinks.»',
      precedingParagraph: 'PLAYER QUEEN: Both here and hence pursue me lasting strife, if once a widow, ever I be wife!',
      title: 'Hamlet, Act III Scene II',
    },
    expect: [/vow|promis|declar|swear|affirm|insist|profess/i],
    reject: [/object(s|ing|ion)?\b|complain/i],
  },
  {
    name: 'archaic-want',
    why: '"want" means lack, not desire.',
    context: {
      selection: 'The Lord is my shepherd; I shall not want.',
      markedParagraph: '«The Lord is my shepherd; I shall not want.» He maketh me to lie down in green pastures.',
      title: 'Psalm 23',
    },
    expect: [/lack|need|go without|be in need|short of|deprived/i],
  },
  {
    name: 'irony-swift',
    why: 'Sustained irony. Reading it at face value is the classic failure.',
    mode: 'point',
    context: {
      selection: 'A young healthy child well nursed is at a year old a most delicious, nourishing, and wholesome food.',
      markedParagraph: 'I have been assured by a very knowing American of my acquaintance in London, that «a young healthy child well nursed is at a year old a most delicious, nourishing, and wholesome food», whether stewed, roasted, baked, or boiled.',
      precedingParagraph: 'It is a melancholy object to those who walk through this great town, to see the streets crowded with beggars of the female sex, followed by three, four, or six children, all in rags.',
      title: 'A Modest Proposal',
      site: 'gutenberg.org',
    },
    expect: [/iron(y|ic)|satir|sarcas|not (meant|literal)|mock/i],
    reject: [/genuinely (recommend|propos)|sincere proposal|actually advocat/i],
  },
  {
    name: 'metaphor-not-literal',
    why: 'The "lease" is a metaphor for summer\'s duration, not property law.',
    context: {
      selection: "And summer's lease hath all too short a date;",
      markedParagraph: "Rough winds do shake the darling buds of May, «And summer's lease hath all too short a date;»",
      title: 'Sonnet 18',
    },
    expect: [/short|brief|does ?n.t last|too soon|fleeting|temporar/i],
    // No reject list: explaining the metaphor by analogy to renting is the
    // correct reading, so banning that vocabulary would fail right answers.
    
  },
  {
    name: 'context-referent',
    why: 'The selection says "this policy" with no antecedent. Only the preceding paragraph identifies it.',
    mode: 'plain',
    context: {
      selection: 'This policy has failed on its own terms.',
      markedParagraph: '«This policy has failed on its own terms.» The numbers have not moved in either direction.',
      precedingParagraph: 'In 2019 the state introduced a blanket ban on the sale of loose cigarettes, arguing it would cut tobacco use among the young.',
      title: 'Smoke and mirrors',
      site: 'thehindu.com',
      url: 'https://www.thehindu.com/opinion/editorial/smoke-and-mirrors/article1.ece',
    },
    expect: [/cigarette|tobacco|smoking|loose/i],
  },
  {
    name: 'context-ablation-WITH',
    why: 'Same selection as the next case, but with the preceding paragraph. Should name the defence.',
    mode: 'point',
    context: {
      selection: 'But the argument wears thin in its fourth year.',
      markedParagraph: '«But the argument wears thin in its fourth year.» Every month of delay compounds an already serious deficit.',
      precedingParagraph: 'The decision to defer the census has been defended on administrative grounds, and there is no doubt that a headcount of this scale is a formidable undertaking.',
      title: 'The cost of counting late',
      site: 'thehindu.com',
    },
    expect: [/administrat|logistic|formidable|scale|difficult/i],
  },
  {
    name: 'context-ablation-WITHOUT',
    why: 'Identical, minus the preceding paragraph. It should NOT be able to name the defence - inventing one is a hallucination.',
    mode: 'point',
    context: {
      selection: 'But the argument wears thin in its fourth year.',
      markedParagraph: '«But the argument wears thin in its fourth year.» Every month of delay compounds an already serious deficit.',
      title: 'The cost of counting late',
      site: 'thehindu.com',
    },
    // Testing for a phrasing ("not stated") proved brittle - the model varies
    // how it hedges. What actually matters is whether it injects facts from
    // memory. None of these appear anywhere in what it was given; inferring
    // "a census" from the title is fair, dating it to 2021 is not.
    reject: [/\b2021\b|\b2011\b|decennial|1\.4 ?billion|Registrar General|Census Act/i],
  },
  {
    name: 'hindu-register',
    why: 'Dense Indian-English editorial register. Should extract a clear position, not paraphrase the vocabulary.',
    mode: 'point',
    context: {
      selection: 'the Centre would do well to disabuse itself of the notion that federal comity is a favour it bestows',
      markedParagraph: 'If the recent acrimony over devolution is any indication, «the Centre would do well to disabuse itself of the notion that federal comity is a favour it bestows» upon the States rather than an obligation the Constitution imposes.',
      precedingParagraph: 'Several southern States have protested the terms of the latest Finance Commission award, arguing that they are penalised for having controlled their populations.',
      title: 'A question of balance',
      site: 'thehindu.com',
      url: 'https://www.thehindu.com/opinion/editorial/a-question-of-balance/article1.ece',
    },
    expect: [/oblig|constitution|duty|required|not a favour|entitle/i],
  },
  {
    name: 'jargon-accuracy',
    why: 'Terms must be defined correctly, not plausibly. Attention is not "focus on important words" hand-waving.',
    mode: 'jargon',
    context: {
      selection: 'we compute scaled dot-product attention over the key-value pairs, masking future positions',
      markedParagraph: 'In each decoder layer «we compute scaled dot-product attention over the key-value pairs, masking future positions» so that predictions depend only on known outputs.',
      title: 'Attention Is All You Need',
      site: 'arxiv.org',
      url: 'https://arxiv.org/abs/1706.03762',
    },
    expect: [/(scal|divid|sqrt|square root|dimension).{0,80}(dot|product|magnitud|variance|gradient)|prevent.{0,40}(look|see|future|ahead)/i],
  },
  {
    name: 'hindi-doha',
    why: 'Devanagari input, figurative meaning. Should read the metaphor, not transliterate.',
    context: {
      selection: 'बड़ा हुआ तो क्या हुआ, जैसे पेड़ खजूर।\nपंथी को छाया नहीं, फल लागे अति दूर।',
      markedParagraph: '«बड़ा हुआ तो क्या हुआ, जैसे पेड़ खजूर।\nपंथी को छाया नहीं, फल लागे अति दूर।»',
      title: 'Kabir ke Dohe',
    },
    expect: [/shade|shadow|traveller|traveler|useless|no use|benefit|serve/i],
  },
  {
    name: 'steelman-attribution',
    why: 'The selection is an opposing view the writer quotes in order to demolish it. Attributing it to the writer inverts the editorial.',
    mode: 'point',
    context: {
      selection: 'The fee hike, it is said, merely corrects years of artificial under-pricing.',
      markedParagraph: '«The fee hike, it is said, merely corrects years of artificial under-pricing.» That would be easier to accept had the same institutions not reported record surpluses in each of the last three years.',
      precedingParagraph: 'Students across four campuses have been on strike since Monday over a near-doubling of tuition.',
      title: 'Who pays for the shortfall',
      site: 'thehindu.com',
      url: 'https://www.thehindu.com/opinion/editorial/who-pays/article1.ece',
    },
    expect: [/report(ing|s|ed)? (an|a|the)? ?(other|opposing|counter)|not the writer|writer (rejects|disputes|disagrees|does not)|attribut|others (say|argue|claim)|being (quoted|cited)|reject|dispute|undercut|rebut|disagree/i],
  },
  {
    name: 'enjambment-autumn',
    why: 'Verse whose clauses run across line breaks, and which never names its subject. Naming the season proves it read the whole passage, not four isolated lines.',
    context: {
      selection: 'Season of mists and mellow fruitfulness,\nClose bosom-friend of the maturing sun;\nConspiring with him how to load and bless\nWith fruit the vines that round the thatch-eves run;',
      markedParagraph: '«Season of mists and mellow fruitfulness,\nClose bosom-friend of the maturing sun;\nConspiring with him how to load and bless\nWith fruit the vines that round the thatch-eves run;»',
      title: 'To Autumn',
    },
    expect: [/autumn|fall\b/i],
  },
  {
    name: 'litotes-negation',
    why: 'Double negative. "Not unreasonable to suppose" means it IS likely - reading the surface negation inverts the accusation.',
    mode: 'plain',
    context: {
      selection: 'It is not unreasonable to suppose that the Board was aware of the discrepancy well before it was reported.',
      markedParagraph: '«It is not unreasonable to suppose that the Board was aware of the discrepancy well before it was reported.» The internal audit trail suggests as much.',
      title: 'What the audit shows',
      site: 'thehindu.com',
    },
    expect: [/reasonable|likely|probabl|plausib|certain|no doubt|makes (total |perfect )?sense|fair to (assume|suppose)|good reason|knew|aware/i],
    reject: [/unlikely|improbable|no reason to (think|believe|suppose)|unreasonable to (suppose|assume|think)/i],
  },
  {
    name: 'legal-prefer',
    why: 'In Indian legal English "prefer an appeal" means to file one, not to favour it.',
    mode: 'jargon',
    context: {
      selection: 'the aggrieved party may prefer an appeal within thirty days of the order',
      markedParagraph: 'Section 14 provides that «the aggrieved party may prefer an appeal within thirty days of the order», failing which the decision attains finality.',
      title: 'Tribunal procedure',
    },
    expect: [/file|lodge|submit|bring|institut|initiat|present an appeal|make an appeal/i],
    reject: [/prefers? (it|one|this|that|an appeal) (over|to|rather)|would rather|favour(s|ed)? an appeal|choose an appeal/i],
  },
  {
    name: 'short-selection',
    why: 'Two words. Everything that makes them meaningful is in the surrounding sentences.',
    mode: 'plain',
    context: {
      selection: 'He knew.',
      markedParagraph: 'The minister was briefed on the revenue shortfall in March. «He knew.» The denial issued in June is therefore not merely mistaken but dishonest.',
      precedingParagraph: 'The Ministry has insisted throughout that the scale of the gap only became apparent this autumn.',
      title: 'A question of candour',
      site: 'thehindu.com',
    },
    expect: [/minister/i, /brief|told|informed|knew|aware|March|shortfall|revenue|missing money|gap/i],
  },
  {
    name: 'statistical-significant',
    why: '"Significant" here is the statistical term, not the everyday one. Glossing it as "important" is the standard error.',
    mode: 'jargon',
    context: {
      selection: 'the difference was significant (p < 0.01) but small in absolute terms',
      markedParagraph: 'Across the full cohort «the difference was significant (p < 0.01) but small in absolute terms», amounting to under two percentage points.',
      title: 'Trial results',
      site: 'nature.com',
      url: 'https://www.nature.com/articles/s41586-024-00001',
    },
    expect: [/statistic|chance|random|coincidence|p-?value|probabilit/i],
  },
  {
    name: 'sarcasm-letter',
    why: 'A letter to the editor whose gratitude is sarcastic. Reading it as praise inverts the complaint.',
    mode: 'point',
    context: {
      selection: 'One is grateful to the Corporation for finally repairing the road, a mere three monsoons after it dissolved.',
      markedParagraph: 'Sir — «One is grateful to the Corporation for finally repairing the road, a mere three monsoons after it dissolved.» Residents await news of the drains with similar optimism.',
      title: 'Letters to the Editor',
      site: 'thehindu.com',
      url: 'https://www.thehindu.com/opinion/letters/june-04/article9.ece',
    },
    expect: [/sarcas|iron|not (really |actually )?grateful|mock|criticis|criticiz|complain|rebuk|scath|bitter/i],
    reject: [/genuine(ly)? (grateful|thankful|praise|pleased)|sincere(ly)? (grateful|thanks|praise)|expressing (real|honest) (thanks|gratitude)/i],
  },
  {
    name: 'craft-pun',
    why: 'The "sun of York" pun on son. A reading that misses it misses the line.',
    mode: 'craft',
    context: {
      selection: 'Now is the winter of our discontent\nMade glorious summer by this sun of York;',
      markedParagraph: '\u00abNow is the winter of our discontent\nMade glorious summer by this sun of York;\u00bb\nAnd all the clouds that lour\u2019d upon our house\nIn the deep bosom of the ocean buried.',
      title: 'Richard III, Act I Scene I',
    },
    expect: [/\bson\b|pun|wordplay|double meaning|two meanings|homophone/i],
  },
  {
    name: 'craft-enjambment',
    why: 'The verb phrase "load and bless" is split across the line break. The fast model consistently misses this; it is what the deep pass exists for.',
    mode: 'craft',
    depth: 'deep',
    context: {
      selection: 'Conspiring with him how to load and bless\nWith fruit the vines that round the thatch-eves run;',
      markedParagraph: 'Season of mists and mellow fruitfulness,\nClose bosom-friend of the maturing sun;\n\u00abConspiring with him how to load and bless\nWith fruit the vines that round the thatch-eves run;\u00bb',
      title: 'To Autumn',
    },
    expect: [/line break|enjamb|next line|carries over|runs on|spills|continues (into|onto)|across the line|end of (the |a )?line|hang|suspend|holds? .{0,20}(back|over)/i],
  },
];

const argv = process.argv.slice(2);
const repeatFlag = argv.indexOf('--repeat');
const REPEAT = repeatFlag === -1 ? 1 : Number(argv[repeatFlag + 1] ?? 3);
// Skip the flag and its value, or "--repeat 3" leaves "3" looking like a filter.
const skip = repeatFlag === -1 ? -1 : repeatFlag + 1;
const positional = argv.filter((a, i) => !a.startsWith('--') && i !== skip);
const filter = positional[0];
const cases = filter ? CASES.filter((c) => c.name.includes(filter)) : CASES;
/** name -> how many of the REPEAT runs passed. Flakiness is the real signal. */
const tally = new Map();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0, failed = 0;
const failures = [];

console.log(`\nmodel: ${MODEL}   cases: ${cases.length}\n`);

const schedule = [];
for (let run = 0; run < REPEAT; run++) for (const c of cases) schedule.push(c);

for (const [i, testCase] of schedule.entries()) {
    const mode = testCase.mode ?? detectMode({
    selection: testCase.context.selection,
    url: testCase.context.url,
  });

  let raw = '';
  let lastError = null;
  // The free tier throws transient 503s. Those are not model failures, so
  // retry a couple of times before scoring one as a miss.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${BASE}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
        body: JSON.stringify({
          model: testCase.depth === 'deep'
            ? (process.env.DEEP_MODEL ?? 'gemini-3.6-flash')
            : MODEL,
          messages: buildMessages(mode, testCase.context),
          max_tokens: (mode === 'lines' ? 1400 : 1100) * (testCase.depth === 'deep' ? 4 : 1),
          temperature: 0.1,

        }),
      });
      if (res.status === 503 || res.status === 429) {
        lastError = new Error(`HTTP ${res.status}`);
        await sleep(6000 * (attempt + 1));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      raw = (await res.json()).choices?.[0]?.message?.content ?? '';
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      await sleep(3000);
    }
  }
  if (lastError) {
    console.log(`✗ ${testCase.name} [${mode}] - request failed: ${lastError.message}\n`);
    failed++; failures.push(testCase.name);
    continue;
  }

  const parsed = parseExplanation(raw);
  const text = parsed
    ? [parsed.summary, ...parsed.sections.map((s) => `${s.label}: ${s.body}`)].join('\n')
    : raw;

  const missing = (testCase.expect ?? []).filter((re) => !re.test(text));
  // Reject patterns describe misreadings the answer must not assert. Since the
  // prompt now requires quoting the passage as evidence, an answer explaining
  // "not unreasonable to suppose" necessarily contains that phrase - so strip
  // quoted spans before checking, or correct readings fail for citing the text.
  const asserted = text
    .replace(/"[^"]*"/g, ' ')
    .replace(/\u201c[^\u201d]*\u201d/g, ' ')
    .replace(/\u00ab[^\u00bb]*\u00bb/g, ' ')
    .replace(/'[^']{3,}'/g, ' ');
  const forbidden = (testCase.reject ?? []).filter((re) => re.test(asserted));
  const ok = parsed && missing.length === 0 && forbidden.length === 0;

  ok ? passed++ : (failed++, failures.push(testCase.name));
  const t = tally.get(testCase.name) ?? { pass: 0, total: 0 };
  t.pass += ok ? 1 : 0; t.total += 1;
  tally.set(testCase.name, t);

  console.log(`${ok ? '✓' : '✗'} ${testCase.name} [${mode}${testCase.depth === 'deep' ? ', deep' : ''}]`);
  console.log(`  ${testCase.why}`);
  if (!parsed) console.log('  !! output did not parse as JSON');
  if (missing.length) console.log(`  !! missing: ${missing.join(' , ')}`);
  if (forbidden.length) console.log(`  !! contained: ${forbidden.join(' , ')}`);
  console.log(`  ${text.replace(/\n/g, '\n  ').slice(0, 700)}\n`);

  if (i < schedule.length - 1) await sleep(4500); // stay inside the free-tier RPM
}

console.log(`${'='.repeat(70)}\n${passed} passed, ${failed} failed` +
  (failures.length ? `  (${[...new Set(failures)].join(', ')})` : ''));

if (REPEAT > 1) {
  const unstable = [...tally.entries()].filter(([, t]) => t.pass > 0 && t.pass < t.total);
  const always = [...tally.values()].filter((t) => t.pass === t.total).length;
  console.log(`\nstability over ${REPEAT} runs: ${always}/${tally.size} cases passed every time`);
  for (const [name, t] of unstable) console.log(`  flaky  ${name}: ${t.pass}/${t.total}`);
  const never = [...tally.entries()].filter(([, t]) => t.pass === 0);
  for (const [name] of never) console.log(`  never  ${name}`);
}
console.log();
