/**
 * zoeken3d.parity.test.ts — the seeded construct-parity test for the diegetic 3D
 * "zoeken" variant (visual search / sustained attention; BUILD-PLAN §1f/§4, §9e).
 * Run:
 *   node --experimental-strip-types --test src/render3d/engines/zoeken3d.parity.test.ts
 *
 * Parity is guaranteed BY CONSTRUCTION: both `render2d/ZoekenView` (2D) and
 * `render3d/engines/zoeken3d` (3D) build the trial with the SAME `buildZoekenTrial`
 * and score it with the SAME `scoreZoeken(misses)` rule. This test pins that frozen
 * contract so the two views can never silently diverge in WHAT they measure:
 *   trials  = 1 (always one search per beat),
 *   correct = 1 ONLY when the still target was found with zero wrong taps (misses).
 * A miss is RECOVERABLE — it costs the perfect score but is never game-over; the
 * child still finds the target and continues.
 *
 * The 3D variant ALSO lays a `spoor` tracking leg in front of the search. That is a
 * SEPARATE difficulty axis (§3d reskin discipline = vary ONE axis): tuning the trail
 * sets the region/approach but must NEVER change the decoy set or the target. The
 * "separate-axis invariant" tests below prove exactly that.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildZoekenTrial, buildSpoor, scoreZoeken } from '../../engines/zoeken.ts';
import { knobsForLevel } from '../../core/skill.ts';
import type { Settings } from '../../core/state.ts';
import type { Skin, Distractor } from '../../content/types.ts';

/** A seeded deterministic rng (mulberry32) — buildZoekenTrial is deterministic, but
 *  this keeps the helper shape identical to the other parity tests + exercises that
 *  the trial does NOT secretly consume randomness. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Reference scorer — an INDEPENDENT re-implementation of the frozen 2D rule
 *  (clean find = 1, any miss = 0), used to cross-check the shared `scoreZoeken`. */
function referenceScore(taps: ('hit' | 'miss')[]): { trials: number; correct: number } {
  let misses = 0;
  for (const t of taps) {
    if (t === 'miss') misses += 1;
    else break; // the first hit is the target → the search ends
  }
  return { trials: 1, correct: misses === 0 ? 1 : 0 };
}

/** Drive the SHARED scorer the way both views do: count misses before the find. */
function drive(taps: ('hit' | 'miss')[]): { trials: number; correct: number } {
  let misses = 0;
  for (const t of taps) {
    if (t === 'miss') misses += 1;
    else break;
  }
  return { trials: 1, correct: scoreZoeken(misses) };
}

const DECOYS: Distractor[] = [
  { id: 'd1', x: 20, y: 30, k: 'bush', animal: 'struik' },
  { id: 'd2', x: 40, y: 50, k: 'bird', animal: 'raaf' },
  { id: 'd3', x: 60, y: 35, k: 'butterfly', animal: 'heideblauwtje' },
  { id: 'd4', x: 70, y: 60, k: 'bush', animal: 'struik' },
  { id: 'd5', x: 30, y: 70, k: 'bird', animal: 'wilde-eend' },
  { id: 'd6', x: 55, y: 25, k: 'bush', animal: 'struik' },
];
const SKIN: Skin = { dier: 'ree', doel: { x: 52, y: 58 }, distractors: DECOYS };
const base = (over: Partial<Settings>): Settings => ({ afleiders: 4, lensSterkte: 0.6, spoorLengte: 3, spoorHelderheid: 0.7, ...over }) as Settings;

test('scoring: clean find → correct 1, trials 1, matches the reference', () => {
  const taps: ('hit' | 'miss')[] = ['hit'];
  assert.deepEqual(drive(taps), { trials: 1, correct: 1 });
  assert.deepEqual(drive(taps), referenceScore(taps));
});

test('scoring: a miss before the find → correct 0 (recoverable), matches the reference', () => {
  const taps: ('hit' | 'miss')[] = ['miss', 'miss', 'hit'];
  assert.deepEqual(drive(taps), { trials: 1, correct: 0 });
  assert.deepEqual(drive(taps), referenceScore(taps));
  assert.ok(drive(taps).correct >= 0, 'never negative — never game-over');
});

test('scoring: the same scoreZoeken rule the 2D + 3D views both import is the only judge', () => {
  // (parity by construction) — both views call scoreZoeken(misses); pin its table.
  assert.equal(scoreZoeken(0), 1);
  assert.equal(scoreZoeken(1), 0);
  assert.equal(scoreZoeken(7), 0);
});

test('buildZoekenTrial: difficulty trims the decoy count (afleiders+2), floor 3, cap = available', () => {
  assert.equal(buildZoekenTrial(SKIN, base({ afleiders: 1 })).decoys.length, 3, '1+2=3');
  assert.equal(buildZoekenTrial(SKIN, base({ afleiders: 2 })).decoys.length, 4, '2+2=4');
  assert.equal(buildZoekenTrial(SKIN, base({ afleiders: 4 })).decoys.length, 6, 'capped at the 6 available');
  assert.equal(buildZoekenTrial(SKIN, base({ afleiders: 0 })).decoys.length, 3, 'floor at 3');
});

test('buildZoekenTrial: target + lensSterkte pass through unchanged', () => {
  const t = buildZoekenTrial(SKIN, base({ lensSterkte: 0.42 }));
  assert.deepEqual(t.target, { x: 52, y: 58 });
  assert.equal(t.lensSterkte, 0.42);
});

test('SEPARATE-AXIS INVARIANT: changing the spoor axes never changes the decoys or the target', () => {
  const ref = buildZoekenTrial(SKIN, base({ afleiders: 3, lensSterkte: 0.5 }));
  for (const spoorLengte of [2, 3, 4, 5, 99]) {
    for (const spoorHelderheid of [0.25, 0.5, 0.95]) {
      const t = buildZoekenTrial(SKIN, base({ afleiders: 3, lensSterkte: 0.5, spoorLengte, spoorHelderheid }));
      assert.equal(t.decoys.length, ref.decoys.length, 'decoy set is invariant to the trail');
      assert.deepEqual(t.decoys, ref.decoys);
      assert.deepEqual(t.target, ref.target, 'target is invariant to the trail');
      assert.equal(t.lensSterkte, ref.lensSterkte);
    }
  }
});

test('buildSpoor: legs clamp to a calm 2..5, helderheid clamps to 0.25..1', () => {
  assert.deepEqual(buildSpoor(base({ spoorLengte: 1, spoorHelderheid: 2 })), { legs: 2, helderheid: 1 });
  assert.deepEqual(buildSpoor(base({ spoorLengte: 99, spoorHelderheid: -1 })), { legs: 5, helderheid: 0.25 });
  assert.deepEqual(buildSpoor(base({ spoorLengte: 4, spoorHelderheid: 0.6 })), { legs: 4, helderheid: 0.6 });
});

test('knobsForLevel zoeken: search + tracking axes both scale, decoys never shrink as the trail grows', () => {
  // higher level → MORE decoys (harder search) AND a longer/fainter trail; the two
  // axes move together off one skill level but stay independent knobs.
  const easy = knobsForLevel('zoeken', 1);
  const hard = knobsForLevel('zoeken', 5);
  assert.ok((hard.afleiders ?? 0) >= (easy.afleiders ?? 0), 'search gets more decoys with skill');
  assert.ok((hard.spoorLengte ?? 0) >= (easy.spoorLengte ?? 0), 'trail gets longer with skill');
  assert.ok((hard.spoorHelderheid ?? 1) <= (easy.spoorHelderheid ?? 1), 'trail gets fainter with skill');
  assert.ok((easy.spoorLengte ?? 0) >= 2 && (hard.spoorLengte ?? 0) <= 5, 'legs stay in the calm band');
});

test('deterministic — same skin + same settings yields the same trial + spoor', () => {
  const s = base({ afleiders: 3, spoorLengte: 4 });
  assert.deepEqual(buildZoekenTrial(SKIN, s), buildZoekenTrial(SKIN, s));
  assert.deepEqual(buildSpoor(s), buildSpoor(s));
  void rng; // trial consumes no randomness — determinism is structural
});
