/**
 * Eyes.test.ts — seeded unit test for the pure eye spec + maths (BUILD-PLAN §9e).
 * Run: `node --experimental-strip-types src/render3d/Eyes.test.ts`
 *
 * Pins the frozen §1e invariants the never-scary gate relies on:
 *  - the dusk-eyeshine list is EXACTLY fox/deer/roe/badger/nightjar/frog ON and
 *    squirrel/adder OFF (and birds default OFF, unlisted mammals ON),
 *  - eyeshine is zero in daylight and clamped + warm at dusk (no horror-glow),
 *  - the catchlight sits in the UPPER quadrant (v>0.5) on every species,
 *  - the cornea roughness stays inside the §1e wet-spec band [0.05, 0.15],
 *  - per-species pupil shape is correct (fox/adder slit, deer bar, default round),
 *  - iris parallax is bounded, zero head-on, opposite the view, frozen at depth 0
 *    (the reduced-motion path). Deterministic.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EYE, eyeSpecFor, eyeshineAt, defaultEyeshine, irisParallax, pupilRadii,
} from './Eyes.ts';

const ALL = [
  'animal-vos-fox', 'animal-edelhert-reddeer', 'animal-ree-roedeer', 'animal-das-badger',
  'animal-nachtzwaluw-nightjar', 'animal-heikikker-frog', 'animal-eekhoorn-squirrel',
  'animal-adder-snake', 'animal-wildzwijn-boar', 'animal-frisling-piglet', 'animal-wolf',
  'animal-heideblauwtje-butterfly', 'bird-merel', 'bird-buizerd', 'bird-wilde-eend',
];

test('the dusk-eyeshine list is EXACTLY the §1e tapetum species', () => {
  // ON
  for (const id of ['animal-vos-fox', 'animal-edelhert-reddeer', 'animal-ree-roedeer',
    'animal-das-badger', 'animal-nachtzwaluw-nightjar', 'animal-heikikker-frog']) {
    assert.equal(defaultEyeshine(id), true, `${id} should have eyeshine`);
  }
  // OFF — squirrel/adder explicitly, butterfly (no vertebrate eye)
  for (const id of ['animal-eekhoorn-squirrel', 'animal-adder-snake', 'animal-heideblauwtje-butterfly']) {
    assert.equal(defaultEyeshine(id), false, `${id} should NOT have eyeshine`);
  }
  // birds default OFF (no tapetum), unlisted mammals default ON
  assert.equal(defaultEyeshine('bird-merel'), false);
  assert.equal(defaultEyeshine('bird-buizerd'), false);
  assert.equal(defaultEyeshine('animal-wolf'), true, 'unlisted mammal defaults to eyeshine');
  assert.equal(defaultEyeshine('animal-wildzwijn-boar'), true);
});

test('eyeshine is OFF in daylight and warm+clamped at dusk (never a horror-glow)', () => {
  for (const id of ALL) {
    const spec = eyeSpecFor(id);
    assert.equal(eyeshineAt(spec, false), 0, `${id}: no eyeshine in daylight`);
    const dusk = eyeshineAt(spec, true);
    assert.ok(dusk >= 0 && dusk <= EYE.maxEyeshine, `${id}: dusk eyeshine within [0, ${EYE.maxEyeshine}]`);
    if (spec.eyeshine) assert.ok(dusk > 0, `${id}: a tapetum species lights up at dusk`);
    else assert.equal(dusk, 0, `${id}: a non-tapetum species never lights up`);
    // warm amber, never cold green: red channel must dominate green, green over blue
    assert.equal(spec.eyeshineColor.toLowerCase(), '#caa45a');
  }
});

test('the catchlight sits in the UPPER quadrant on every species', () => {
  for (const id of ALL) {
    const spec = eyeSpecFor(id);
    assert.ok(spec.catchlight.v > 0.5, `${id}: catchlight v=${spec.catchlight.v} must be upper (>0.5)`);
    assert.ok(spec.catchlight.size > 0 && spec.catchlight.size < 0.3, `${id}: catchlight a spark, not a flare`);
  }
});

test('cornea roughness stays in the §1e wet band [0.05, 0.15]', () => {
  for (const id of ALL) {
    const r = eyeSpecFor(id).clearcoatRoughness;
    assert.ok(r >= EYE.corneaRoughMin && r <= EYE.corneaRoughMax, `${id}: clearcoatRoughness ${r} out of band`);
  }
});

test('per-species pupil shape: fox/adder slit, deer bar, default round', () => {
  assert.equal(eyeSpecFor('animal-vos-fox').pupilShape, 'vertical-slit');
  assert.equal(eyeSpecFor('animal-adder-snake').pupilShape, 'vertical-slit');
  assert.equal(eyeSpecFor('animal-ree-roedeer').pupilShape, 'horizontal-bar');
  assert.equal(eyeSpecFor('animal-edelhert-reddeer').pupilShape, 'horizontal-bar');
  assert.equal(eyeSpecFor('animal-das-badger').pupilShape, 'round');
  assert.equal(eyeSpecFor('bird-merel').pupilShape, 'round');
  assert.equal(eyeSpecFor(null).pupilShape, 'round', 'a null id is harmless (procedural totem)');
});

test('pupilRadii reshapes the ellipse by shape (slit tall+thin, bar wide+short)', () => {
  const base = 10;
  const slit = pupilRadii('vertical-slit', base);
  assert.ok(slit.ry > slit.rx, 'slit is taller than wide');
  const bar = pupilRadii('horizontal-bar', base);
  assert.ok(bar.rx > bar.ry, 'bar is wider than tall');
  const round = pupilRadii('round', base);
  assert.equal(round.rx, round.ry, 'round is symmetric');
});

test('iris parallax: bounded, zero head-on, opposite the view, frozen at depth 0', () => {
  const depth = 0.02;
  // head-on → no shift
  assert.deepEqual(irisParallax({ x: 0, y: 0 }, depth), { u: 0, v: 0 });
  // looking right (view.x>0) → iris shifts left (u<0), and vice versa
  assert.ok(irisParallax({ x: 1, y: 0 }, depth).u < 0);
  assert.ok(irisParallax({ x: -1, y: 0 }, depth).u > 0);
  // reduced-motion path: depth 0 → frozen flat for any view
  for (const v of [{ x: 1, y: 1 }, { x: -1, y: 0.5 }, { x: 0.3, y: -0.8 }]) {
    assert.deepEqual(irisParallax(v, 0), { u: 0, v: 0 });
  }
  // bounded: never exceeds ±maxParallax even with an out-of-range view + depth
  const wild = irisParallax({ x: 99, y: -99 }, 99);
  assert.ok(Math.abs(wild.u) <= EYE.maxParallax && Math.abs(wild.v) <= EYE.maxParallax);
});

test('determinism: eyeSpecFor + irisParallax are pure (same input → same output)', () => {
  for (const id of ALL) {
    assert.deepEqual(eyeSpecFor(id), eyeSpecFor(id));
  }
  assert.deepEqual(irisParallax({ x: 0.4, y: -0.2 }, 0.02), irisParallax({ x: 0.4, y: -0.2 }, 0.02));
});
