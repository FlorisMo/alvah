/**
 * veluwe.test.ts — the words the child reads DURING a mission (the rustkracht rounds,
 * the reunion line, the season finale) stay at AVI M3/E3: at most 7 words per
 * sentence, short choice buttons. core/readlevel.test.ts lints the briefings, facts
 * and clues; this adds what a round and the ending put on screen.
 * Run: `node --experimental-strip-types --test src/content/veluwe.test.ts`
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { AREA_VELUWE, VERHAALBOOG_VELUWE } from './veluwe.ts';
import { lintText } from '../core/readlevel.ts';

type Enc = { id: string; vraag: string; uitleg?: string; gevolg?: string; opties: { label: string; goed: boolean }[] };

test('every rustkracht round reads at M3/E3 (≤7 words a sentence, choices of ≤4 words)', () => {
  const long: string[] = [];
  for (const m of AREA_VELUWE.missies) {
    for (const st of m.stappen) {
      const skin = st.skin as { encounters?: Enc[]; regels?: string[] };
      for (const e of skin.encounters ?? []) {
        for (const k of ['vraag', 'uitleg', 'gevolg'] as const) {
          for (const i of lintText(e[k] ?? '')) long.push(`${m.id}.${e.id}.${k}: "${i.sentence}" [${i.words}]`);
        }
        for (const o of e.opties) if (o.label.trim().split(/\s+/).length > 4) long.push(`${m.id}.${e.id} choice "${o.label}"`);
        assert.equal(e.opties.filter((o) => o.goed).length, 1, `${m.id}.${e.id}: exactly one right choice`);
      }
      for (const r of skin.regels ?? []) for (const i of lintText(r)) long.push(`${m.id} rule "${i.sentence}"`);
    }
  }
  assert.deepEqual(long, []);
});

test('every mission ends in a reunion line, and the season in a finale, both at M3/E3', () => {
  for (const m of AREA_VELUWE.missies) {
    const t = (m as { reunion?: { tekst?: string } }).reunion?.tekst ?? '';
    assert.ok(t.length > 0, `${m.id} has a reunion line (the world shows the ending)`);
    assert.deepEqual(lintText(t), [], `${m.id} reunion`);
  }
  const f = VERHAALBOOG_VELUWE.finale;
  assert.ok(f.regels.length >= 2);
  for (const l of [f.titel, f.kicker, ...f.regels]) assert.deepEqual(lintText(l), [], l);
});

/* ---- child:B9 / B13 — short, plain words that match the picture ---- */

type EncFull = Enc & { subject: string; dier?: string; pose?: string; reactie?: string; vraagKnap?: string; uitlegKnap?: string; gevolgKnap?: string };
const encountersOf = (): { m: string; e: EncFull; skinDier?: string }[] =>
  AREA_VELUWE.missies.flatMap((m) => m.stappen.flatMap((st) =>
    (((st.skin as { encounters?: EncFull[] }).encounters) ?? []).map((e) => ({ m: m.id, e, skinDier: st.skin.dier }))));

/** The "knappe woorden": fine when that setting is on, never in the plain lines. */
const JARGON = ['frisling', 'rotte', 'zeug', 'keiler', 'overloper', 'geit', 'reegeit', 'bok', 'hinde', 'roedel', 'rekel', 'moervos', 'welp', 'sprong'];
const jargonIn = (t: string): string[] => JARGON.filter((w) => new RegExp(`\\b${w}\\b`, 'i').test(t));

test('a wrong answer says what happens in one or two short sentences', () => {
  const bad: string[] = [];
  for (const { m, e } of encountersOf()) {
    for (const t of [e.gevolg, e.gevolgKnap]) {
      if (!t) continue;
      const zinnen = t.split(/[.!?]+/).map((z) => z.trim()).filter(Boolean);
      if (zinnen.length > 2) bad.push(`${m}.${e.id}: "${t}" (${zinnen.length} sentences)`);
      for (const i of lintText(t)) bad.push(`${m}.${e.id}: "${i.sentence}" [${i.words}]`);
    }
    for (const t of [e.vraagKnap, e.uitlegKnap]) for (const i of lintText(t ?? '')) bad.push(`${m}.${e.id} knap: "${i.sentence}"`);
  }
  assert.deepEqual(bad, []);
});

test('the plain lines (knappe woorden off) use no jargon: big, moeder, groep', () => {
  const bad: string[] = [];
  for (const m of AREA_VELUWE.missies) {
    const mm = m as { kort?: string; reunion?: { tekst?: string }; briefing: { simpel: string[] } };
    for (const [k, t] of [['kort', mm.kort], ['reunion', mm.reunion?.tekst], ...mm.briefing.simpel.map((l, i) => [`brief.simpel[${i}]`, l])]) {
      for (const w of jargonIn(t ?? '')) bad.push(`${m.id}.${k}: ${w}`);
    }
    for (const st of m.stappen) {
      const c = (st.skin.copy ?? {}) as Record<string, string | undefined>;
      for (const k of ['instructie', 'goed', 'toon', 'terug', 'luister', 'echo', 'regel', 'regelOm']) {
        for (const w of jargonIn(c[k] ?? '')) bad.push(`${m.id}.${st.ef}.${k}: ${w}`);
      }
    }
  }
  for (const { m, e } of encountersOf()) {
    for (const k of ['vraag', 'uitleg', 'gevolg'] as const) for (const w of jargonIn(e[k] ?? '')) bad.push(`${m}.${e.id}.${k}: ${w}`);
    for (const o of e.opties) for (const w of jargonIn(o.label)) bad.push(`${m}.${e.id} choice: ${w}`);
  }
  assert.deepEqual(bad, []);
});

test('the words match the picture: a lying animal is posed lying, a fleeing one runs off', () => {
  const bad: string[] = [];
  // a snake always lies; a mud pool or an empty path is no animal
  const stands = (s: string): boolean => !['modderpoel', 'pad-veilig', 'adder'].includes(s);
  for (const { m, e, skinDier } of encountersOf()) {
    const words = [e.vraag, ...e.opties.map((o) => o.label)].join(' ');
    if (stands(e.subject) && /\blig(t|gen)\b/i.test(words) && e.pose !== 'ligt') bad.push(`${m}.${e.id}: says it lies, but stands`);
    if (/\b(rent|loopt|draaft|glijdt|schiet) weg\b|\bspringt op\b/i.test(e.gevolg ?? '') && !['flee', 'recede'].includes(e.reactie ?? ''))
      bad.push(`${m}.${e.id}: says it runs off, but it stays (${e.reactie})`);
    const shown = e.subject !== 'pad-veilig' || !!(e.dier ?? skinDier); // an empty path shows no animal to move
    if (shown && ['flee', 'recede'].includes(e.reactie ?? '') && !/\bweg\b|\bverder\b|\bterug\b|\bspringt op\b/i.test(e.gevolg ?? ''))
      bad.push(`${m}.${e.id}: it runs off (${e.reactie}), but the words do not say so`);
  }
  assert.deepEqual(bad, []);
});
