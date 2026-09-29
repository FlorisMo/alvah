/**
 * readlevel.test.ts — seeded unit test for the pure M3/E3 leesniveau-lint
 * AND a live-corpus gate over the authored missie-/UI-copy (BUILD-PLAN §3 / §6).
 * Run: `node --experimental-strip-types --test src/core/readlevel.test.ts`
 *
 * Two layers:
 *  1. The pure lint maths — sentence splitting (incl. one-idea-per-line), word
 *     counting that ignores bare punctuation, and the ≤7-word flag — are
 *     deterministic and correct; the other checks below flag what they must.
 *  2. The whole reading surface is INSIDE the norm: the missions (briefings, step copy,
 *     feiten, clues, ontknoping, animal facts), the front door (content/screens.ts), Bram
 *     and the lessons (content/mentor.ts), and the copy deck of every shared screen
 *     (content/copy.ts: the HUD, the mission cards, Onderweg, Pauze, the missiebord, the
 *     sporenboek, the badges, the hut, Instellingen), plus the words core modules show
 *     (the maker's choices, the breinkracht badges, the raaf, Onderweg). Run 6 adds:
 *       - every string SHOWN as one line (a button, a chip, a tag, a strip line, a line
 *         on a card) is ≤ 7 words as a whole, templates filled with the longest title;
 *       - no em dash (or en dash) anywhere;
 *       - no "held" or "kanjer" hype;
 *       - no surname: a first name of the cast is never followed by a family name.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  splitSentences, countWords, sentenceLengths, lintText, lintCorpus, zinnen,
  MAX_WORDS_PER_SENTENCE, type LabeledText,
} from './readlevel.ts';
import { AREA_VELUWE, ANIMALS } from '../content/veluwe.ts';
import { ROEP_COPY, ROEP_VOGELS } from '../engines/roep.ts';
import { SAY, TITLE, MAKER } from '../content/screens.ts';
import { BRAM, LES, BESTURING, MENTOR_NAAM, metNaam } from '../content/mentor.ts';
import * as COPY from '../content/copy.ts';
import { AVATAR_KENMERKEN, KENMERK_LABEL, NAAM_SUGGESTIES } from './avatar.ts';
import { SKILL_META, tierFor } from './skill.ts';
import { FASE_META, KUNSTJE_META, ZORG_STAPPEN, OPVANG_GASTEN, COMPANION_SOORTEN } from './companion.ts';
import { pickWorldBeat, withAnimal } from './worldbeat.ts';

// ---- 1. pure lint maths --------------------------------------------------

test('splitSentences breaks on sentence punctuation AND on line ends', () => {
  assert.deepEqual(
    splitSentences('Hoi ranger. Zoek de big!'),
    ['Hoi ranger', 'Zoek de big'],
  );
  // one idea per line: a newline is its own boundary even without punctuation
  assert.deepEqual(
    splitSentences('Hoi ranger\nZoek de big'),
    ['Hoi ranger', 'Zoek de big'],
  );
  // ellipsis + multiple terminators collapse; empty fragments drop
  assert.deepEqual(splitSentences('Kijk… daar!  '), ['Kijk', 'daar']);
});

test('countWords ignores bare-punctuation tokens, keeps inner punctuation', () => {
  assert.equal(countWords('Hij roept “kroa-kroa”.'), 3); // kroa-kroa = one word
  assert.equal(countWords('Stil — kijk'), 2); // the lone dash is not a word
  assert.equal(countWords('   '), 0);
  assert.equal(countWords("Het 'drukt zich'"), 3);
});

test('a short exclamation is never flagged (min is informational only)', () => {
  assert.deepEqual(lintText('Hoi ranger! Top!'), []);
  assert.deepEqual(lintText('Ja.'), []);
});

test('lintText flags only sentences over the max, with the true word count', () => {
  const long = 'woord een twee drie vier vijf zes zeven acht.'; // 9 words
  const issues = lintText(long);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].words, 9);
  assert.equal(issues[0].max, MAX_WORDS_PER_SENTENCE);
  // exactly at the boundary (7) is allowed; 8 is not
  assert.deepEqual(lintText('een twee drie vier vijf zes zeven'), []);
  assert.equal(lintText('een twee drie vier vijf zes zeven acht').length, 1);
});

test('sentenceLengths reports per-sentence counts in reading order', () => {
  assert.deepEqual(sentenceLengths('Hoi ranger. Zoek de kleine big nu.'), [2, 5]);
});

test('a custom max is honoured', () => {
  assert.equal(lintText('een twee drie vier vijf', 3).length, 1);
  assert.deepEqual(lintText('een twee drie', 3), []);
});

test('deterministic + pure — repeated calls match, input untouched', () => {
  const text = 'Een zin met meerdere woorden hierin. En nog een korte.';
  assert.deepEqual(lintText(text), lintText(text));
  const frozen = 'Hoi ranger. Zoek de big.';
  const before = frozen;
  splitSentences(frozen);
  assert.equal(frozen, before);
});

// ---- 1b. the run-6 checks flag what they must ------------------------------

/** A line shown on screen: at most 7 words, all of it (two sentences on one line count
 *  together). */
function lineIssue(line: string): string | null {
  const n = countWords(line);
  return n > MAX_WORDS_PER_SENTENCE ? `${n} words on one line` : null;
}
/** No em dash or en dash: a dash between two thoughts is two lines (the site's rule). */
const DASH = /[—–]/;
/** Hype the voice never uses: praise is calm ("Knap gedaan"). */
const HYPE = /\b(held|helden|heldin|superheld|kanjer|kanjers)\b/i;
/** Every first name in the game: the cast and the names a player can pick. */
const FIRST_NAMES = [MENTOR_NAAM, ...NAAM_SUGGESTIES, ...COPY.RAAF_NAMEN];
/** A family name after a first name ("Bram Visser", "Alvah van Dijk"), or a Dutch
 *  tussenvoegsel before a capital ("de Vries", "van der Berg"), apart from places. */
const PLACES = new Set(['Veluwe']);
function surnameIssue(text: string): string | null {
  for (const n of FIRST_NAMES) {
    const m = new RegExp(`\\b${n}\\s+(?:(?:van|de|der|den|ter|ten|het)\\s+)*([A-Z][a-z]+)`).exec(text);
    if (m && !PLACES.has(m[1])) return `"${m[0]}" looks like a surname`;
  }
  const t = /\b(?:van der|van den|van de|ter|ten|de)\s+([A-Z][a-z]+)/.exec(text);
  if (t && !PLACES.has(t[1]) && !/^(Begin|Enter|Esc|Shift|Pauze|Instellingen)$/.test(t[1])) return `"${t[0]}" looks like a surname`;
  return null;
}

test('the line check flags an 8-word button, and passes 7', () => {
  assert.equal(lineIssue('Bekijk nu heel snel het grote missiebord hier'), '8 words on one line');
  assert.equal(lineIssue('Hou Shift vast. Dan ren je.'), null);
  assert.equal(lineIssue('Speel nog eens: Het reekalf in het gras'), '8 words on one line');
});

test('the dash, hype and surname checks flag what they must', () => {
  assert.ok(DASH.test('Bijna! Blijf rustig — probeer nog eens.'));
  assert.ok(DASH.test('Loop – of ren'));
  assert.ok(!DASH.test('Dag-dier → open plek.'), 'a hyphen in a word is fine');
  assert.ok(HYPE.test('Jij bent een held!'));
  assert.ok(HYPE.test('Wat een kanjer.'));
  assert.ok(!HYPE.test('Knap gedaan, Alvah!'));
  assert.ok(surnameIssue('Ik ben Bram Visser.'));
  assert.ok(surnameIssue('Hoi Alvah van Dijk!'));
  assert.ok(surnameIssue('Meneer de Vries is er.'));
  assert.equal(surnameIssue('Ranger van de Veluwe'), null);
  assert.equal(surnameIssue('Veldnotitie van Bram · Heide'), null);
  assert.equal(surnameIssue('Hoi, ranger Alvah!'), null);
  assert.equal(surnameIssue('Kroa vertelt · 1/3'), null);
});

test('zinnen: a text is shown one sentence a line, with its punctuation', () => {
  assert.deepEqual(zinnen('De moeder knort blij. Haar big is terug.'), ['De moeder knort blij.', 'Haar big is terug.']);
  assert.deepEqual(zinnen('Is het verdwaald? Dat denkt hij.'), ['Is het verdwaald?', 'Dat denkt hij.']);
  assert.deepEqual(zinnen('Hij roept “kroa-kroa”. Hoor maar!'), ['Hij roept “kroa-kroa”.', 'Hoor maar!']);
  assert.deepEqual(zinnen('Kijk goed welke weg de groep liep…'), ['Kijk goed welke weg de groep liep…']);
  assert.deepEqual(zinnen('Zonder punt'), ['Zonder punt']);
  assert.deepEqual(zinnen(''), []);
});

// ---- 2. live-corpus gate: the whole reading surface is M3/E3 -------------

const MISSIONS = (AREA_VELUWE as any).missies as any[];
/** The longest mission title, the longest names: a template is judged at its longest. */
const LONGEST = (xs: string[]): string => xs.reduce((a, b) => (countWords(b) > countWords(a) ? b : a), '');
const SAMPLE: Record<string, string | number> = {
  naam: 'Alvah', bram: MENTOR_NAAM, raaf: LONGEST([...COPY.RAAF_NAMEN]), wie: 'de nachtzwaluw',
  titel: LONGEST(MISSIONS.map((m) => m.titel)), landschap: 'Stuifzand', gebied: 'Veluwe',
  hoofdstuk: 'Kraamtijd', telling: '1/3', n: 10, m: 12, woord: 'wintervoorraad', stap: 'wisselen',
  richting: 'achter je', dier: 'wild zwijn', gast: 'nachtzwaluw', reden: LONGEST(OPVANG_GASTEN.map((g) => g.reden)),
  fase: LONGEST(Object.values(FASE_META).map((f) => f.label)), kunstje: 'Scout', stop: 'stop met luisteren', aantal: 'negen',
};

interface Entry extends LabeledText { shown: boolean }

/** Every string in a group of the copy deck, deep, with its templates filled in. A key
 *  starting with `zeg` (or the SAY group) is only spoken: only the sentence rule. */
function deck(label: string, v: unknown, spoken: boolean, out: Entry[]): void {
  if (typeof v === 'string') {
    out.push({ label, text: COPY.vul(metNaam(v, 'Alvah'), SAMPLE), shown: !spoken });
  } else if (typeof v === 'function') {
    out.push({ label, text: String((v as (n: string) => string)('Alvah')), shown: !spoken });
  } else if (Array.isArray(v)) {
    v.forEach((x, i) => deck(`${label}[${i}]`, x, spoken, out));
  } else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) deck(`${label}.${k}`, x, spoken || /^zeg/.test(k), out);
  }
}

/** Collect every child-facing string the game shows or reads aloud. `shown`: it is drawn
 *  as ONE line (the line check applies). */
function readingCorpus(): Entry[] {
  const E: Entry[] = [];
  const push = (label: string, t: unknown, shown = false) => {
    if (typeof t === 'string' && t.trim().length > 0) E.push({ label, text: t, shown });
  };
  const a = AREA_VELUWE as any;
  push('area.kort', a.kort);
  for (const m of a.missies ?? []) {
    // a title shows on one line: in a tag, the chip, "Speel mee: …" (filled in below)
    push(`${m.id}.titel`, m.titel, true);
    push(`${m.id}.kort`, m.kort);
    push(`${m.id}.payoff`, m.payoff);
    // briefing lines, the reunion, facts and clues are drawn one sentence a line (zinnen)
    (m.briefing?.simpel ?? []).forEach((s: string, i: number) => push(`${m.id}.brief.simpel[${i}]`, s));
    (m.briefing?.knap ?? []).forEach((s: string, i: number) => push(`${m.id}.brief.knap[${i}]`, s));
    push(`${m.id}.beloning.badgeNaam`, m.beloning?.badgeNaam, true);
    push(`${m.id}.beloning.vakterm`, m.beloning?.vaktermBadge?.naam, true);
    push(`${m.id}.reunion`, m.reunion?.tekst);
    (m.stappen ?? []).forEach((st: any, si: number) => {
      const c = st.skin?.copy ?? {};
      for (const k of Object.keys(c)) push(`${m.id}.step${si}.${k}`, c[k]);
      push(`${m.id}.step${si}.feit`, st.skin?.feit);
      // a choice is a button: one line
      (st.skin?.encounters ?? []).forEach((e: any) => (e.opties ?? []).forEach((o: any, oi: number) => push(`${m.id}.step${si}.${e.id}.optie[${oi}]`, o.label, true)));
    });
    // the adventure's lines (MISSIONS lane): one objective line, chip or prompt each
    for (const tier of ['simpel', 'knap']) {
      for (const [k, t] of Object.entries(m.avontuur?.[tier] ?? {})) push(`${m.id}.avontuur.${tier}.${k}`, t, true);
    }
  }
  const vb = a.verhaalboog;
  if (vb) {
    for (const k of Object.keys(vb.clues ?? {})) {
      push(`clue.${k}.titel`, vb.clues[k].titel, true);
      push(`clue.${k}.tekst`, vb.clues[k].tekst);
    }
    (vb.ontknoping ?? []).forEach((o: any, i: number) => push(`ontknoping[${i}]`, o.tekst));
    for (const h of vb.hoofdstukken ?? []) push(`hoofdstuk.${h.n}`, h.naam, true);
    push('finale.kicker', vb.finale?.kicker, true);
    push('finale.titel', vb.finale?.titel, true);
    (vb.finale?.regels ?? []).forEach((r: string, i: number) => push(`finale.regel[${i}]`, r, true));
  }
  for (const id of Object.keys(ANIMALS as any)) {
    const an = (ANIMALS as any)[id];
    push(`animal.${id}.naam`, an.naam, true);
    (an.feiten ?? []).forEach((f: string, i: number) => push(`animal.${id}.feit[${i}]`, f));
    (an.veiligheid ?? []).forEach((f: string, i: number) => push(`animal.${id}.veilig[${i}]`, f));
  }
  // W6.4a "Ken je roep" — UI-copy + de roep-omschrijvingen van elke vogel.
  for (const k of Object.keys(ROEP_COPY)) push(`roep.${k}`, (ROEP_COPY as any)[k]);
  for (const v of ROEP_VOGELS) { push(`roep.vogel.${v.id}.naam`, v.naam); push(`roep.vogel.${v.id}.roep`, v.roep); }
  // the front door (screens.ts): the title, the maker; SAY is only spoken
  deck('title', TITLE, false, E);
  deck('maker', MAKER, false, E);
  deck('say', SAY, true, E);
  // Bram, the lessons, the "Zo speel je" card (mentor.ts)
  deck('bram', BRAM, false, E);
  deck('les', LES, false, E);
  deck('besturing', BESTURING, false, E);
  // the copy deck of every shared screen (copy.ts)
  for (const [group, v] of Object.entries(COPY)) if (typeof v !== 'function') deck(`copy.${group}`, v, false, E);
  // what core modules show: the maker's choices, the breinkracht badges and their steps,
  // the raaf (its stages, tricks, care steps), the opvang's guests, Onderweg's beats
  for (const [k, label] of Object.entries(KENMERK_LABEL)) push(`avatar.${k}`, label, true);
  for (const [k, opts] of Object.entries(AVATAR_KENMERKEN)) (opts as { label: string }[]).forEach((o, i) => push(`avatar.${k}[${i}]`, o.label, true));
  NAAM_SUGGESTIES.forEach((n, i) => push(`avatar.naam[${i}]`, n, true));
  for (const [e, meta] of Object.entries(SKILL_META)) { push(`skill.${e}.naam`, meta.naam, true); push(`skill.${e}.taak`, meta.taak, true); }
  for (const best of [1, 3, 5]) push(`skill.tier.${best}`, tierFor(best).naam, true);
  for (const [f, meta] of Object.entries(FASE_META)) { push(`raaf.fase.${f}`, meta.label, true); push(`raaf.fase.${f}.kort`, meta.kort, true); }
  for (const [k, meta] of Object.entries(KUNSTJE_META)) push(`raaf.kunstje.${k}`, COPY.vul(meta.uitleg, SAMPLE), true);
  for (const [f, stappen] of Object.entries(ZORG_STAPPEN)) stappen.forEach((st) => { push(`zorg.${f}.${st.id}`, st.label, true); push(`zorg.${f}.${st.id}.zin`, st.zin, true); });
  COMPANION_SOORTEN.raaf.namen.forEach((n, i) => push(`raaf.naam[${i}]`, n, true));
  for (const tick of [3, 6]) {
    const b = pickWorldBeat({ patrolTick: tick, heading: 'links' });
    if (!b) continue;
    // the prompt is drawn one sentence a line (zinnen), its options are buttons
    zinnen(withAnimal(b, SAMPLE.dier as string).prompt).forEach((z, i) => push(`onderweg.${tick}.prompt[${i}]`, z, true));
    b.options.forEach((o, i) => push(`onderweg.${tick}.optie[${i}]`, o.label, true));
  }
  return E;
}

test('the corpus is non-trivial (guards against an empty/false-green sweep)', () => {
  const c = readingCorpus();
  assert.ok(c.length > 400, `expected the full reading surface, got ${c.length}`);
  assert.ok(c.filter((e) => e.shown).length > 250, 'expected the shown lines too');
});

test('all live copy is within the M3/E3 norm (≤7 words a sentence)', () => {
  const issues = lintCorpus(readingCorpus());
  const report = issues.map((i) => `\n  [${i.words}w] ${i.label}: "${i.sentence}"`).join('');
  assert.equal(issues.length, 0, `M3/E3 sentence-length offenders:${report}`);
});

test('every line shown on screen (button, chip, tag, strip, card line) is ≤ 7 words', () => {
  const issues = readingCorpus().filter((e) => e.shown).flatMap((e) => {
    const why = lineIssue(e.text);
    return why ? [`\n  ${e.label}: "${e.text}" (${why})`] : [];
  });
  assert.equal(issues.length, 0, `one-line strings over 7 words:${issues.join('')}`);
});

test('every template is filled in: no {naam} or {titel} left on screen', () => {
  const left = readingCorpus().filter((e) => /\{\w+\}/.test(e.text)).map((e) => `\n  ${e.label}: "${e.text}"`);
  assert.equal(left.length, 0, `unfilled templates:${left.join('')}`);
});

test('no em dash, no "held" or "kanjer", no surname anywhere', () => {
  const bad = readingCorpus().flatMap((e) => {
    const why = DASH.test(e.text) ? 'a dash' : HYPE.test(e.text) ? 'hype' : surnameIssue(e.text);
    return why ? [`\n  ${e.label}: "${e.text}" (${why})`] : [];
  });
  assert.equal(bad.length, 0, `copy that breaks the voice:${bad.join('')}`);
});

test('one cast: the warden is Bram everywhere, never "de BOA" or the police', () => {
  const bad = readingCorpus().filter((e) => /\bBOA\b|politie/i.test(e.text)).map((e) => `\n  ${e.label}: "${e.text}"`);
  assert.equal(bad.length, 0, `the warden has one name, Bram:${bad.join('')}`);
  // and a raaf is never named like a ranger (the player could be called that)
  for (const n of COPY.RAAF_NAMEN) assert.ok(!NAAM_SUGGESTIES.includes(n), `${n} is a raaf name and a ranger name`);
});
