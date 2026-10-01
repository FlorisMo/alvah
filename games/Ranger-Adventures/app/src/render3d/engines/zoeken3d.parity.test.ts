/**
 * zoeken3d.parity.test.ts — construct parity for Speurkracht (run 7 `adaptive`, design
 * §5.3, §5.7): the 2D field (`render2d/ZoekenView`), the classic 3D stage
 * (`render3d/engines/zoeken3d`) and the world's search (`adventure/beats/search`) read the
 * same knobs — how many look-alikes, how much of the animal shows (glimpse = 1 − haze), when
 * the hint comes — and score a find the same way (`zoekSummary`: one find, a miss is a tap
 * on a look-alike, the seconds, whether a hint was needed). The 2D field and the classic
 * stage build the SAME trial from the same play fork (which look-alikes, where). Pinned:
 * (1) each view's source reads them so, never `Math.random`; (2) seeds 1..20 × bands: the
 * same trial twice, the count the knob's, the layout's rules; (3) the summary matches an
 * INDEPENDENT reference and the judgement.
 *   node --experimental-strip-types --test src/render3d/engines/zoeken3d.parity.test.ts
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildZoekenTrial, buildSpoor, zoekSummary, pickDecoys, OFF_CENTRE, SPACING, FIELD } from '../../engines/zoeken.ts';
import { knobsFor, knobsForLevel, judgeBeat } from '../../core/skill.ts';
import { newPlay } from '../../core/play.ts';
import type { Skin, Distractor } from '../../content/types.ts';
import { AREA_VELUWE } from '../../content/veluwe.ts';

const FRISLING = AREA_VELUWE.missies.find((m) => m.id === 'frisling')!.stappen[0].skin as Skin;

function build(seed: number, band: number, skin: Skin = FRISLING) {
  return buildZoekenTrial(skin, knobsFor('zoeken', band), newPlay('frisling', seed, 1).fork('zoeken').rng);
}

test('each view reads the knobs and the play, scores with the shared summary (never Math.random)', () => {
  const src = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');
  for (const [name, s] of [['2D ZoekenView', src('../../render2d/ZoekenView.ts')], ['3D zoeken3d', src('./zoeken3d.ts')]] as const) {
    assert.match(s, /buildZoekenTrial\(skin, (store\.knobs\('zoeken'\)|knobs), [^)]*fork\('zoeken'\)\.rng/, `${name}: the trial from the knobs and the play's fork`);
    assert.match(s, /zoekSummary\(/, `${name}: the shared summary`);
    assert.doesNotMatch(s, /Math\.random/, `${name}: no Math.random`);
  }
  const world = src('../adventure/beats/search.ts');
  assert.match(world, /k\.knobs\('zoeken'\)/, 'world search: the knobs');
  assert.match(world, /zoekSummary\(/, 'world search: the shared summary');
  assert.doesNotMatch(world, /Math\.random/);
});

test('seeds 1..20 × bands: the same trial for the same play; the knob says how many look-alikes, how much shows, when the hint comes', () => {
  for (let band = 1; band <= 6; band++) {
    const k = knobsFor('zoeken', band);
    for (let seed = 1; seed <= 20; seed++) {
      const a = build(seed, band), b = build(seed, band);
      assert.deepEqual(a, b, `band ${band} seed ${seed}: 2D vs the classic stage`);
      assert.equal(a.decoys.length, Math.min(k.lookAlikes, FRISLING.distractors!.length), 'the count is the knob\'s');
      assert.equal(a.glimpse, k.glimpse);
      assert.ok(Math.abs(a.haze - (1 - k.glimpse)) < 1e-9, 'haze = 1 − glimpse');
      assert.equal(a.hintAfterS, k.hintAfterS);
    }
  }
});

test('the 2D layout: the animal never in the middle, nothing on top of another, all inside the field', () => {
  const targets = new Set<string>();
  for (let seed = 1; seed <= 300; seed++) {
    const t = build(seed, 1 + (seed % 6));
    targets.add(`${t.target.x},${t.target.y}`);
    assert.ok(Math.hypot(t.target.x - 50, t.target.y - 50) >= OFF_CENTRE, `seed ${seed}: the animal at ${t.target.x},${t.target.y}`);
    const all = [t.target, ...t.decoys];
    for (const p of all) assert.ok(p.x >= FIELD.x0 && p.x <= FIELD.x1 && p.y >= FIELD.y0 && p.y <= FIELD.y1, `seed ${seed}: inside`);
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      assert.ok(Math.hypot(all[i].x - all[j].x, all[i].y - all[j].y) >= SPACING - 2, `seed ${seed}: two things ${Math.hypot(all[i].x - all[j].x, all[i].y - all[j].y).toFixed(1)} apart`);
    }
  }
  assert.ok(targets.size > 250, 'the animal lies somewhere else almost every play');
});

test('which look-alikes: one of each kind first (every play as mixed), varied over plays', () => {
  const sets = new Set<string>();
  for (let seed = 1; seed <= 60; seed++) {
    const ds = build(seed, 1).decoys;
    sets.add(ds.map((d) => d.id).join());
    assert.deepEqual([...new Set(ds.map((d) => d.k))].sort(), ['bird', 'bush', 'butterfly'], `seed ${seed}: a bush, a bird and the butterfly`);
  }
  assert.ok(sets.size >= 8, `${sets.size} different sets`);
  const one: Distractor[] = [{ id: 'a', x: 1, y: 1, k: 'bush' }];
  assert.deepEqual(pickDecoys(one, 4, () => 0.5).map((d) => d.id), ['a'], 'capped by the list');
});

test('a seed-less caller gets the skin\'s authored set and places (an older reader), from either knob form', () => {
  const t = buildZoekenTrial(FRISLING, knobsFor('zoeken', 1));
  assert.deepEqual(t.target, FRISLING.doel);
  assert.deepEqual(t.decoys, FRISLING.distractors!.slice(0, 4));
  const old = buildZoekenTrial(FRISLING, { ...knobsForLevel('zoeken', 3) });
  assert.equal(old.decoys.length, knobsFor('zoeken', 3).lookAlikes, 'the older fields read the same table');
  assert.ok(Math.abs(old.glimpse - knobsFor('zoeken', 3).glimpse) < 1e-9);
});

/** INDEPENDENT reference of the find's summary (design §5.3). */
function reference(misses: number, seconds: number, hinted: boolean) {
  return { trials: 1, correct: misses === 0 ? 1 : 0, misses, seconds, hinted };
}

test('the summary: one find, a miss is a tap on a look-alike; judged easy, fine, steady or hard', () => {
  for (const [m, s, h, judged] of [
    [0, 3, false, 'easy'], [0, 8, false, 'easy'], [0, 12.4, false, 'fine'], [1, 5, false, 'steady'], [2, 9, true, 'hard'], [0, 20, true, 'hard'],
  ] as const) {
    const got = zoekSummary({ misses: m, seconds: s, hinted: h });
    assert.deepEqual(got, reference(m, s, h));
    assert.equal(judgeBeat('zoeken', got), judged, `${m} misses, ${s} s, hint ${h}`);
  }
  assert.equal(zoekSummary({ misses: 0, seconds: 3.04, hinted: false }).seconds, 3, 'tenths of a second');
});

test('the trail: legs and clarity from the knobs (or the older fields), a calm 2..5', () => {
  for (let b = 1; b <= 6; b++) {
    const k = knobsFor('zoeken', b);
    assert.deepEqual(buildSpoor(k), { legs: k.trailLegs, helderheid: k.trailClarity });
    assert.deepEqual(buildSpoor(knobsForLevel('zoeken', b)), { legs: k.trailLegs, helderheid: k.trailClarity });
  }
  assert.deepEqual(buildSpoor({ spoorLengte: 9, spoorHelderheid: 0 }), { legs: 5, helderheid: 0.25 });
});
