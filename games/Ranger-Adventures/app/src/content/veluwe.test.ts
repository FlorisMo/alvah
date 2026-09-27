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
