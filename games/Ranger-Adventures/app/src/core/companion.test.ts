/**
 * companion.test.ts — seeded unit test for the pure companion/rehab model.
 * Run: `node --experimental-strip-types src/core/companion.test.ts`
 * (node strips the types; `import type` from skill.ts is erased, no runtime dep).
 *
 * Covers the invariants the care loop relies on: bond→fase monotonicity (never a
 * drop), the friend joining once strong, cumulative kunstjes, clean-vs-slipped
 * bond deltas, rehab release counting, and merge tolerating junk saves.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  blankCompanion, blankRehab, faseVoorBond, kunstjesVoorFase, careBondDelta,
  applyRescue, applyBond, applyStartRehab, applyReleaseRehab, mergeCompanion, mergeRehab,
  OPVANG_GASTEN, FASE_META,
} from './companion.ts';

test('faseVoorBond crosses thresholds at 40 and 75', () => {
  assert.equal(faseVoorBond(0), 'baby');
  assert.equal(faseVoorBond(39), 'baby');
  assert.equal(faseVoorBond(40), 'jong');
  assert.equal(faseVoorBond(74), 'jong');
  assert.equal(faseVoorBond(75), 'zelfstandig');
  assert.equal(faseVoorBond(100), 'zelfstandig');
});

test('thresholds match FASE_META declarations', () => {
  assert.equal(FASE_META.jong.drempel, 40);
  assert.equal(FASE_META.zelfstandig.drempel, 75);
});

test('rescue starts a named baby with a scout-less kit', () => {
  const c = applyRescue(undefined, 'Kroa');
  assert.equal(c.rescued, true);
  assert.equal(c.fase, 'baby');
  assert.equal(c.bond, 12);
  assert.equal(c.naam, 'Kroa');
  assert.deepEqual(c.kunstjes, []); // baby has no kunstje yet
  assert.equal(c.meeOpMissie, false);
});

test('bond growth promotes fase, unlocks scout at jong, and the friend joins', () => {
  const c = applyRescue(undefined, 'Veer'); // bond 12, baby
  const step1 = applyBond(c, 30); // 12 -> 42 -> jong
  assert.equal(step1.grew, true);
  assert.equal(step1.companion.fase, 'jong');
  assert.deepEqual(step1.companion.kunstjes, ['scout']);
  assert.equal(step1.companion.meeOpMissie, true, 'friend joins once past baby');
});

test('fase never regresses even if bond is lowered', () => {
  const grown = applyBond(applyRescue(undefined), 70).companion; // -> zelfstandig (82)
  assert.equal(grown.fase, 'zelfstandig');
  const lowered = applyBond(grown, -90).companion; // bond floored to 0...
  assert.equal(lowered.bond, 0);
  assert.equal(lowered.fase, 'zelfstandig', 'fase is monotone — practice sticks');
  assert.deepEqual(lowered.kunstjes, ['scout', 'gids']);
});

test('bond clamps to [0,100]', () => {
  const hi = applyBond(applyRescue(undefined), 999).companion;
  assert.equal(hi.bond, 100);
  const lo = applyBond(applyRescue(undefined), -999).companion;
  assert.equal(lo.bond, 0);
});

test('kunstjesVoorFase is cumulative', () => {
  assert.deepEqual(kunstjesVoorFase('raaf', 'baby'), []);
  assert.deepEqual(kunstjesVoorFase('raaf', 'jong'), ['scout']);
  assert.deepEqual(kunstjesVoorFase('raaf', 'zelfstandig'), ['scout', 'gids']);
  assert.deepEqual(kunstjesVoorFase('onbekend', 'jong'), ['scout'], 'unknown soort falls back to raaf');
});

test('careBondDelta: clean round = 12, any slip = 8', () => {
  assert.equal(careBondDelta(0, 0), 12);
  assert.equal(careBondDelta(1, 0), 8);
  assert.equal(careBondDelta(0, 1), 8);
  assert.equal(careBondDelta(2, 3), 8);
});

test('rehab: start then release counts and clears', () => {
  const started = applyStartRehab(undefined, OPVANG_GASTEN[0]);
  assert.equal(started.active, true);
  assert.equal(started.dier, OPVANG_GASTEN[0].dier);
  const released = applyReleaseRehab(started);
  assert.equal(released.active, false);
  assert.equal(released.dier, null);
  assert.equal(released.releasedCount, 1);
  assert.equal(applyReleaseRehab(released).releasedCount, 2);
});

test('merge tolerates junk and re-derives invariants', () => {
  const c = mergeCompanion({ soort: 'raaf', fase: 'jong', bond: 999, kunstjes: ['bogus'] });
  assert.equal(c.bond, 100, 'bond re-clamped');
  assert.deepEqual(c.kunstjes, ['scout'], 'kunstjes re-derived from fase, junk dropped');
  const bad = mergeCompanion({ fase: 'nonsense' });
  assert.equal(bad.fase, 'baby', 'invalid fase falls back');
  assert.deepEqual(mergeCompanion(null), blankCompanion());
  assert.deepEqual(mergeRehab(undefined), blankRehab());
  assert.equal(mergeRehab({ releasedCount: -5 }).releasedCount, 0);
});
