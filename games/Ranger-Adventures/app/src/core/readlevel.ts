/**
 * readlevel.ts — M3/E3 leesniveau-lint (BUILD-PLAN §3 / Phase 6 / §6 copy pass).
 *
 * Alvah leest op AVI M3/E3 (≈ groep 4) en is dyslectisch, dus de research-regel
 * is keihard: KORTE zinnen, één idee per regel, kernwoorden herhalen. Dit is de
 * PURE, deterministische leslint die dat afdwingbaar maakt — geen THREE, geen DOM,
 * geen wall-clock. Hij telt woorden per zin en markeert zinnen die te lang zijn
 * (de echte leesdrempel voor M3/E3); de unit-test draait hem over de live missie-
 * en UI-copy zodat een te lange zin de build niet binnenglipt.
 *
 * "Één idee per regel": copy staat al grotendeels als regel-arrays in de content,
 * dus een nieuwe regel telt óók als zinsgrens — een opsomming op één regel zou
 * anders ten onrechte als één lange zin tellen.
 *
 * Een korte uitroep ("Hoi ranger!", "Top!") is GEEN fout — die houden de toon
 * warm en nuchter (§3). De lint markeert daarom alleen overschrijding van het
 * maximum, niet de ondergrens; `MIN_WORDS_PER_SENTENCE` is puur informatief.
 */

/** M3/E3-doel: 3–7 woorden per zin. Het maximum is de harde leesdrempel. */
export const MAX_WORDS_PER_SENTENCE = 7;
/** Informatieve ondergrens — korte uitroepen blijven toegestaan (zie kop). */
export const MIN_WORDS_PER_SENTENCE = 3;

export interface ReadLevelIssue {
  /** De zin (getrimd) die het maximum overschrijdt. */
  sentence: string;
  /** Aantal getelde woorden. */
  words: number;
  /** Het toegepaste maximum, voor een duidelijke faalboodschap. */
  max: number;
}

// Zinseindes: . ! ? … (één of meer). Een dubbele punt is een clause-break, geen
// zinseinde, dus die laten we staan binnen de zin.
const SENTENCE_BREAK = /[.!?…]+/;
// Een "woord"-token moet minstens één letter of cijfer bevatten; pure leestekens
// (—, », „) tellen niet mee.
const HAS_ALNUM = /[\p{L}\p{N}]/u;

/**
 * Splits `text` in zinnen: op zinseinde-leestekens ÉN op regeleindes (één idee
 * per regel). Lege fragmenten vallen weg. Leestekens worden niet bewaard — we
 * tellen alleen woorden.
 */
export function splitSentences(text: string): string[] {
  return (text ?? '')
    .split(/\r?\n/) // één idee per regel
    .flatMap((line) => line.split(SENTENCE_BREAK))
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && HAS_ALNUM.test(s));
}

/** Aantal woorden in een zin (whitespace-tokens met minstens één letter/cijfer). */
export function countWords(sentence: string): number {
  return (sentence ?? '')
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0 && HAS_ALNUM.test(t)).length;
}

/** Woordlengte per zin, in leesvolgorde. */
export function sentenceLengths(text: string): number[] {
  return splitSentences(text).map(countWords);
}

/**
 * Markeer elke zin in `text` die langer is dan `max` woorden. Een tekst die
 * helemaal binnen de norm valt levert een lege lijst op (de groene staat).
 */
export function lintText(text: string, max: number = MAX_WORDS_PER_SENTENCE): ReadLevelIssue[] {
  const issues: ReadLevelIssue[] = [];
  for (const sentence of splitSentences(text)) {
    const words = countWords(sentence);
    if (words > max) issues.push({ sentence, words, max });
  }
  return issues;
}

export interface LabeledText {
  /** Waar de tekst vandaan komt (missie-id + veld), voor een leesbare faalmelding. */
  label: string;
  text: string;
}

export interface LabeledIssue extends ReadLevelIssue {
  label: string;
}

/**
 * Lint een hele corpus van gelabelde teksten in één keer — gebruikt door de
 * unit-test om alle live missie-/UI-copy af te lopen en exact te wijzen welke
 * regel te lang is.
 */
export function lintCorpus(
  entries: LabeledText[],
  max: number = MAX_WORDS_PER_SENTENCE,
): LabeledIssue[] {
  const out: LabeledIssue[] = [];
  for (const { label, text } of entries) {
    for (const issue of lintText(text, max)) out.push({ label, ...issue });
  }
  return out;
}
