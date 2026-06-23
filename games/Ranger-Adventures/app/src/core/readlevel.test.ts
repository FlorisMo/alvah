/**
 * readlevel.test.ts — seeded unit test for the pure M3/E3 leesniveau-lint
 * AND a live-corpus gate over the authored missie-/UI-copy (BUILD-PLAN §3 / §6).
 * Run: `node --experimental-strip-types --test src/core/readlevel.test.ts`
 *
 * Two layers:
 *  1. The pure lint maths — sentence splitting (incl. one-idea-per-line), word
 *     counting that ignores bare punctuation, and the ≤7-word flag — are
 *     deterministic and correct.
 *  2. The whole authored reading surface (mission briefings, step copy, feiten,
 *     clues, ontknoping, animal facts) is INSIDE the M3/E3 norm — so a too-long
 *     sentence can never slip back into the live copy unnoticed.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  splitSentences, countWords, sentenceLengths, lintText, lintCorpus,
  MAX_WORDS_PER_SENTENCE, type LabeledText,
} from './readlevel.ts';
import { AREA_VELUWE, ANIMALS } from '../content/veluwe.ts';

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

// ---- 2. live-corpus gate: the whole reading surface is M3/E3 -------------

/** Collect every child-facing string the game reads aloud / shows as prose. */
function readingCorpus(): LabeledText[] {
  const E: LabeledText[] = [];
  const push = (label: string, t: unknown) => {
    if (typeof t === 'string' && t.trim().length > 0) E.push({ label, text: t });
  };
  const a = AREA_VELUWE as any;
  push('area.kort', a.kort);
  for (const m of a.missies ?? []) {
    push(`${m.id}.titel`, m.titel);
    push(`${m.id}.kort`, m.kort);
    push(`${m.id}.payoff`, m.payoff);
    (m.briefing?.simpel ?? []).forEach((s: string, i: number) => push(`${m.id}.brief.simpel[${i}]`, s));
    (m.briefing?.knap ?? []).forEach((s: string, i: number) => push(`${m.id}.brief.knap[${i}]`, s));
    push(`${m.id}.beloning.badgeNaam`, m.beloning?.badgeNaam);
    push(`${m.id}.beloning.vakterm`, m.beloning?.vaktermBadge?.naam);
    push(`${m.id}.reunion`, m.reunion?.tekst);
    (m.stappen ?? []).forEach((st: any, si: number) => {
      const c = st.skin?.copy ?? {};
      for (const k of Object.keys(c)) push(`${m.id}.step${si}.${k}`, c[k]);
      push(`${m.id}.step${si}.feit`, st.skin?.feit);
    });
  }
  const vb = a.verhaalboog;
  if (vb) {
    for (const k of Object.keys(vb.clues ?? {})) {
      push(`clue.${k}.titel`, vb.clues[k].titel);
      push(`clue.${k}.tekst`, vb.clues[k].tekst);
    }
    (vb.ontknoping ?? []).forEach((o: any, i: number) => push(`ontknoping[${i}]`, o.tekst));
  }
  for (const id of Object.keys(ANIMALS as any)) {
    const an = (ANIMALS as any)[id];
    (an.feiten ?? []).forEach((f: string, i: number) => push(`animal.${id}.feit[${i}]`, f));
    (an.veiligheid ?? []).forEach((f: string, i: number) => push(`animal.${id}.veilig[${i}]`, f));
  }
  return E;
}

test('the corpus is non-trivial (guards against an empty/false-green sweep)', () => {
  assert.ok(readingCorpus().length > 100, 'expected the full authored copy surface');
});

test('all live mission/animal/arc copy is within the M3/E3 norm (≤7 words/sentence)', () => {
  const issues = lintCorpus(readingCorpus());
  const report = issues.map((i) => `\n  [${i.words}w] ${i.label}: "${i.sentence}"`).join('');
  assert.equal(issues.length, 0, `M3/E3 sentence-length offenders:${report}`);
});
