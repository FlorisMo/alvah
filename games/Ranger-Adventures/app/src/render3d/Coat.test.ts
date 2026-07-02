/**
 * Coat.test.ts — seeded unit test for the pure coat-tint + posture recipe (W3.7b).
 * Run: `node --experimental-strip-types src/render3d/Coat.test.ts`
 *
 * Pins the honest-scope invariants:
 *  - the coat-tint map is SPARSE: only confirmed dossier contradictions (the CC0
 *    vos) get a tint; everyone else is left alone (no speculative repaint),
 *  - the vos tint aims at a rufous/orange hue and keeps strength < 1 (shading survives),
 *  - head-low species (wild zwijn / frisling / das) get a small forward pitch,
 *    alert/level species (ree/edelhert/eekhoorn/vos/wolf) keep pitch 0,
 *  - every posture pitch stays within the POSTURE_MAX_PITCH ceiling,
 *  - both functions are pure (same input → same output). Deterministic.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { coatTintFor, postureFor, POSTURE_MAX_PITCH } from './Coat.ts';

const ALL = [
  'animal-vos-fox', 'animal-edelhert-reddeer', 'animal-ree-roedeer', 'animal-das-badger',
  'animal-eekhoorn-squirrel', 'animal-wildzwijn-boar', 'animal-frisling-piglet',
  'animal-wolf', 'animal-adder-snake', 'animal-heikikker-frog', 'bird-merel',
];

function rgb(hex: string): { r: number; g: number; b: number } {
  return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) };
}

test('coat tint is sparse: only the confirmed vos contradiction is corrected', () => {
  const tinted = ALL.filter((id) => coatTintFor(id) !== null);
  assert.deepEqual(tinted, ['animal-vos-fox'], 'no speculative retints beyond the vos');
  assert.equal(coatTintFor(null), null);
  assert.equal(coatTintFor('animal-ree-roedeer'), null, 'the dossier-matching cast is untouched');
});

test('the vos tint is rufous/orange and keeps its shading (strength < 1)', () => {
  const t = coatTintFor('animal-vos-fox')!;
  const c = rgb(t.color);
  assert.ok(c.r > c.g && c.g > c.b, `vos tint ${t.color} must read rufous (r>g>b)`);
  assert.ok(t.strength > 0 && t.strength < 1, 'a partial lerp keeps the pack shading');
});

test('posture: head-low species pitch forward, alert/level species stay upright', () => {
  for (const id of ['animal-wildzwijn-boar', 'animal-frisling-piglet', 'animal-das-badger']) {
    const p = postureFor(id);
    assert.ok(p.pitch > 0 && p.headLow, `${id} should be nose-down`);
  }
  for (const id of ['animal-ree-roedeer', 'animal-edelhert-reddeer', 'animal-eekhoorn-squirrel',
    'animal-vos-fox', 'animal-wolf']) {
    const p = postureFor(id);
    assert.equal(p.pitch, 0, `${id} keeps its upright/level stance`);
    assert.equal(p.headLow, false);
  }
  assert.deepEqual(postureFor(null), { pitch: 0, headLow: false });
});

test('every posture pitch is a subtle stance, never a topple (≤ POSTURE_MAX_PITCH)', () => {
  for (const id of ALL) {
    const { pitch } = postureFor(id);
    assert.ok(pitch >= 0 && pitch <= POSTURE_MAX_PITCH, `${id}: pitch ${pitch} out of the calm band`);
  }
});

test('determinism: coatTintFor + postureFor are pure', () => {
  for (const id of ALL) {
    assert.deepEqual(coatTintFor(id), coatTintFor(id));
    assert.deepEqual(postureFor(id), postureFor(id));
  }
});
