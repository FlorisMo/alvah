/**
 * ProceduralMotion.test.ts — seeded unit test for the pure animal-motion fallback.
 * Run: `node --experimental-strip-types src/render3d/ProceduralMotion.test.ts`
 *
 * Guards the frozen-research invariants the never-scary / motion-comfort gate
 * relies on: every delta stays inside the calm envelope, the adder never rears
 * (slither is flat), the frog hop always completes + rests (never frozen mid-leap,
 * never sinks), and 'still' is identity (the reduced-motion / prop path).
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CALM, REST, calmGate, gaitFor, motionAt, type MotionRecipe,
} from './ProceduralMotion.ts';

/** Deterministic time samples across several cycles. */
const TS = Array.from({ length: 400 }, (_, i) => i * 0.05); // 0..20s @ 20 Hz
const PHASES = [0, 1.3, 2.7, 4.1, 5.9];

test('gaitFor maps the four special species + breathes for the rest', () => {
  assert.equal(gaitFor('animal-adder-snake').gait, 'slither');
  assert.equal(gaitFor('animal-heikikker-frog').gait, 'hop');
  assert.equal(gaitFor('animal-heideblauwtje-butterfly').gait, 'flutter');
  assert.equal(gaitFor('bird-wilde-eend').gait, 'paddle');
  assert.equal(gaitFor('animal-vos-fox').gait, 'breathe');
  assert.equal(gaitFor('bird-buizerd').gait, 'breathe', 'a raptor still just breathes calmly');
  assert.equal(gaitFor('animal-raaf-raven').gait, 'breathe');
});

test('gaitFor returns a still recipe for non-cast ids and nullish input', () => {
  assert.equal(gaitFor('prop-pine-scots').gait, 'still');
  assert.equal(gaitFor('ranger-alvah').gait, 'still', 'humanoids rig via Meshy, not this');
  assert.equal(gaitFor(null).gait, 'still');
  assert.equal(gaitFor(undefined).gait, 'still');
});

test('calmGate clamps a wild recipe into the calm envelope and is idempotent', () => {
  const wild: MotionRecipe = { gait: 'breathe', bobAmp: 9, swayAmp: 9, rotAmp: 9, breathAmp: 9, hz: 99 };
  const c = calmGate(wild);
  assert.ok(c.bobAmp <= CALM.maxBob);
  assert.ok(c.swayAmp <= CALM.maxSway);
  assert.ok(c.rotAmp <= CALM.maxRot);
  assert.ok(c.breathAmp <= CALM.maxBreath);
  assert.ok(c.hz <= CALM.maxHz);
  assert.deepEqual(calmGate(c), c, 'idempotent');
  // a hop is allowed a slightly higher apex, still bounded
  const hop = calmGate({ gait: 'hop', bobAmp: 9, swayAmp: 0, rotAmp: 0, breathAmp: 0, hz: 99 });
  assert.ok(hop.bobAmp <= CALM.maxHopBob && hop.bobAmp > CALM.maxBob);
});

test('every gait stays inside the calm envelope across time + phase', () => {
  for (const id of ['animal-vos-fox', 'animal-adder-snake', 'animal-heikikker-frog',
    'animal-heideblauwtje-butterfly', 'bird-wilde-eend']) {
    const r = gaitFor(id);
    const bobCeil = r.gait === 'hop' ? CALM.maxHopBob : CALM.maxBob;
    for (const ph of PHASES) for (const t of TS) {
      const d = motionAt(r, t, ph);
      assert.ok(Math.abs(d.dy) <= bobCeil + 1e-9, `${id} dy in range`);
      assert.ok(Math.abs(d.dx) <= CALM.maxSway + 1e-9, `${id} dx in range`);
      assert.ok(Math.abs(d.rotY) <= CALM.maxRot + 1e-9, `${id} rotY in range`);
      assert.ok(Math.abs(d.rotZ) <= CALM.maxRot + 1e-9, `${id} rotZ in range`);
      assert.ok(Math.abs(d.scaleY - 1) <= CALM.maxBreath + 1e-9, `${id} scaleY in range`);
    }
  }
});

test('no gait ever sinks the model below its rest pose (dy >= 0)', () => {
  for (const id of ['animal-vos-fox', 'animal-heikikker-frog', 'animal-heideblauwtje-butterfly',
    'bird-wilde-eend']) {
    const r = gaitFor(id);
    for (const ph of PHASES) for (const t of TS) {
      assert.ok(motionAt(r, t, ph).dy >= 0, `${id} never sinks`);
    }
  }
});

test('adder slither is flat — never a vertical S-coil rear-up', () => {
  const r = gaitFor('animal-adder-snake');
  for (const ph of PHASES) for (const t of TS) {
    const d = motionAt(r, t, ph);
    assert.equal(d.dy, 0, 'no vertical');
    assert.equal(d.rotZ, 0, 'no pitch/roll rear');
    assert.equal(d.scaleY, 1, 'no rising puff');
  }
  // it does actually weave laterally
  const peak = Math.max(...TS.map((t) => Math.abs(motionAt(r, t, 0).dx)));
  assert.ok(peak > 0.04, 'slither has real lateral travel');
});

test('frog hop completes its arc, rests, and is never frozen mid-leap', () => {
  const r = gaitFor('animal-heikikker-frog');
  const ys = TS.map((t) => motionAt(r, t, 0).dy);
  const apex = Math.max(...ys);
  assert.ok(apex > 0.1, 'the frog actually leaves the ground');
  // within any single cycle there is a grounded rest (dy === 0)
  const cycle = 1 / r.hz; // seconds
  const inOneCycle = TS.filter((t) => t < cycle).map((t) => motionAt(r, t, 0).dy);
  assert.ok(inOneCycle.some((y) => y === 0), 'the frog rests on the ground each cycle');
  // the airborne arc is a minority of the cycle (mostly resting = calm, not hyper)
  const airborneFrac = ys.filter((y) => y > 0).length / ys.length;
  assert.ok(airborneFrac < 0.5, `mostly at rest (airborne ${airborneFrac.toFixed(2)})`);
});

test("'still' is exactly the rest pose (reduced-motion / prop path)", () => {
  const r = gaitFor('prop-boulder');
  for (const t of TS) assert.deepEqual(motionAt(r, t, 0), REST);
});

test('motionAt is deterministic', () => {
  const r = gaitFor('animal-vos-fox');
  assert.deepEqual(motionAt(r, 3.21, 1.1), motionAt(r, 3.21, 1.1));
});
