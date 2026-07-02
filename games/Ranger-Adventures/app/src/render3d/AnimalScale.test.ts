/**
 * AnimalScale.test.ts — seeded unit test for the pure canonical stand-height
 * table (W3.7a). Run: `node --experimental-strip-types src/render3d/AnimalScale.test.ts`
 *
 * Pins the dossier-derived scale invariants (robust to the exact posture
 * factor — the numbers are estimates, the ORDERING is the contract):
 *  - the ranger (adult reference) is taller than every animal,
 *  - the strict size ordering edelhert > ree > wolf > wildzwijn > vos > das >
 *    frisling > eekhoorn > adder > heikikker > heideblauwtje,
 *  - ranger-relative ratios are biologically sane (edelhert ~0.8–0.95 of an
 *    adult, a fox roughly a quarter, an eekhoorn under a fifth),
 *  - every staged `animal-*` manifest id resolves (no silent gap),
 *  - unknown / non-animal ids return null (props/vehicles fall back).
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RANGER_STAND_HEIGHT, STAND_HEIGHT, standHeightFor, ratioToRanger,
} from './AnimalScale.ts';

// The 11 staged `animal`-category manifest ids (public/models/manifest.json).
const ANIMALS = [
  'animal-edelhert-reddeer', 'animal-ree-roedeer', 'animal-wolf',
  'animal-wildzwijn-boar', 'animal-vos-fox', 'animal-das-badger',
  'animal-frisling-piglet', 'animal-eekhoorn-squirrel', 'animal-adder-snake',
  'animal-heikikker-frog', 'animal-heideblauwtje-butterfly',
];

test('every staged animal id has a canonical stand height', () => {
  for (const id of ANIMALS) {
    const h = standHeightFor(id);
    assert.ok(h !== null && h > 0, `${id} must resolve to a positive height`);
  }
});

test('the ranger reference is taller than every animal', () => {
  assert.equal(standHeightFor('ranger-alvah'), RANGER_STAND_HEIGHT);
  for (const id of ANIMALS) {
    assert.ok(
      (standHeightFor(id) as number) < RANGER_STAND_HEIGHT,
      `${id} must be shorter than the adult reference`,
    );
  }
});

test('strict biological size ordering holds', () => {
  const ordered = [
    'animal-edelhert-reddeer', 'animal-ree-roedeer', 'animal-wolf',
    'animal-wildzwijn-boar', 'animal-vos-fox', 'animal-das-badger',
    'animal-frisling-piglet', 'animal-eekhoorn-squirrel', 'animal-adder-snake',
    'animal-heikikker-frog', 'animal-heideblauwtje-butterfly',
  ];
  for (let i = 1; i < ordered.length; i++) {
    const hi = standHeightFor(ordered[i - 1]) as number;
    const lo = standHeightFor(ordered[i]) as number;
    assert.ok(hi > lo, `${ordered[i - 1]} (${hi}) must be taller than ${ordered[i]} (${lo})`);
  }
});

test('ranger-relative ratios are biologically sane', () => {
  const edelhert = ratioToRanger('animal-edelhert-reddeer') as number;
  assert.ok(edelhert > 0.8 && edelhert < 0.95, `edelhert ${edelhert} of a human`);
  const vos = ratioToRanger('animal-vos-fox') as number;
  assert.ok(vos > 0.2 && vos < 0.35, `vos ${vos} of a human`);
  const eekhoorn = ratioToRanger('animal-eekhoorn-squirrel') as number;
  assert.ok(eekhoorn < 0.2, `eekhoorn ${eekhoorn} of a human`);
});

test('unknown / non-animal ids return null (no false size)', () => {
  assert.equal(standHeightFor('prop-pine-scots'), null);
  assert.equal(standHeightFor('bird-buizerd'), null);
  assert.equal(standHeightFor('vehicle-ranger-jeep'), null);
  assert.equal(standHeightFor(null), null);
  assert.equal(standHeightFor(undefined), null);
  assert.equal(ratioToRanger('prop-pine-scots'), null);
});

test('the table has no stray ids beyond ranger + the 11 animals', () => {
  const keys = Object.keys(STAND_HEIGHT).sort();
  const expected = ['ranger-alvah', ...ANIMALS].sort();
  assert.deepEqual(keys, expected);
});
