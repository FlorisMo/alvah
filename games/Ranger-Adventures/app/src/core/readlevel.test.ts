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
 *     feiten, clues, ontknoping, animal facts), the front door (content/screens.ts), Benjamin
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
  splitSentences, countWords, sentenceLengths, lintText, lintCorpus, zinnen, regels,
  MAX_WORDS_PER_SENTENCE,
} from './readlevel.ts';
import { ANIMALS } from '../content/veluwe.ts';
import { MENTOR_NAAM } from '../content/mentor.ts';
import * as COPY from '../content/copy.ts';
import { NAAM_SUGGESTIES } from './avatar.ts';
import { ONTDEKKINGEN } from '../content/ontdekkingen.ts';
import { readingCorpus, MISSIONS } from './readingcorpus.ts';

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
/** A family name after a first name ("Benjamin Visser", "Alvah van Dijk"), or a Dutch
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
  assert.ok(surnameIssue('Ik ben Benjamin Visser.'));
  assert.ok(surnameIssue('Hoi Alvah van Dijk!'));
  assert.ok(surnameIssue('Meneer de Vries is er.'));
  assert.equal(surnameIssue('Ranger van de Veluwe'), null);
  assert.equal(surnameIssue('Veldnotitie van Benjamin · Heide'), null);
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

test('regels: a strip or a toast breaks at sentence ends, never more than 7 words a line', () => {
  // whole sentences share a line while they fit
  assert.deepEqual(regels('Goed. Hij loopt zelf.'), ['Goed. Hij loopt zelf.']);
  assert.deepEqual(regels('Goed zo. Geef de big de ruimte.'), ['Goed zo. Geef de big de ruimte.']);
  // the playtest's lines: eight and nine words side by side became two lines
  assert.deepEqual(regels('Goed. Hij loopt zelf. Jij wijst de weg.'), ['Goed. Hij loopt zelf.', 'Jij wijst de weg.']);
  assert.deepEqual(regels('Hij schrikt en loopt weg. Hij loopt liever zelf.'), ['Hij schrikt en loopt weg.', 'Hij loopt liever zelf.']);
  // a line a mission composes at runtime (the ven: the question, then what to do)
  assert.deepEqual(regels('Een slang ligt in de zon. Hou afstand.'), ['Een slang ligt in de zon.', 'Hou afstand.']);
  // one sentence too long on its own: near-equal parts, none over 7
  assert.deepEqual(regels('een twee drie vier vijf zes zeven acht negen.'), ['een twee drie vier vijf', 'zes zeven acht negen.']);
  const long = Array.from({ length: 16 }, (_, i) => `w${i}`).join(' ') + '.';
  for (const l of regels(long)) assert.ok(countWords(l) <= 7, l);
  // punctuation alone is no word: a dash stays with its words
  assert.deepEqual(regels('Stil — kijk daar.'), ['Stil — kijk daar.']);
  // empty, a custom max, and every line of any text within the max
  assert.deepEqual(regels(''), []);
  assert.deepEqual(regels('Ja. Nee. Ja.', 2), ['Ja. Nee.', 'Ja.']);
  for (const t of ['Kijk, de groep! Het pad is vrij.', 'Te lang gewacht. De groep loopt verder. Loop maar door.']) {
    for (const l of regels(t)) assert.ok(countWords(l) <= MAX_WORDS_PER_SENTENCE, `${t} → ${l}`);
    assert.equal(regels(t).join(' '), t, 'nothing lost, nothing added');
  }
});

// ---- 2. live-corpus gate: the whole reading surface is M3/E3 -------------


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

test('one cast: the warden is Benjamin everywhere, never "de BOA" or the police', () => {
  const bad = readingCorpus().filter((e) => /\bBOA\b|politie/i.test(e.text)).map((e) => `\n  ${e.label}: "${e.text}"`);
  assert.equal(bad.length, 0, `the warden has one name, Benjamin:${bad.join('')}`);
  // and a raaf is never named like a ranger (the player could be called that)
  for (const n of COPY.RAAF_NAMEN) assert.ok(!NAAM_SUGGESTIES.includes(n), `${n} is a raaf name and a ranger name`);
});

test('run 7: a discovery\'s plain name carries no knap woord (those live in naamKnap)', () => {
  // the knappe woorden of the game: every mission's knap-woord badge and the animals' vaktermen
  // (minus the words an animal's plain name already uses: 'reekalf' is the ree's simpelWoord)
  const animals = Object.values(ANIMALS as Record<string, { naam: string; simpelWoord?: string; vaktermen?: Record<string, string> }>);
  const plain = new Set(animals.flatMap((a) => [a.simpelWoord ?? '', ...a.naam.split(/\s+/)].map((w) => w.toLowerCase())));
  const knap = new Set<string>([
    ...MISSIONS.map((m) => String(m.beloning?.vaktermBadge?.naam ?? '').replace(/^Knap woord:\s*/i, '').toLowerCase()).filter(Boolean),
    ...animals.flatMap((a) => Object.values(a.vaktermen ?? {}).map((w) => w.toLowerCase())),
  ].filter((w) => !plain.has(w)));
  assert.ok(knap.has('frisling'), 'the list knows the knappe woorden');
  const bad = ONTDEKKINGEN.filter((o) => o.naam.toLowerCase().split(/\s+/).some((w) => knap.has(w))).map((o) => `\n  ${o.id}: "${o.naam}"`);
  assert.equal(bad.length, 0, `a knap woord in a plain name:${bad.join('')}`);
});
