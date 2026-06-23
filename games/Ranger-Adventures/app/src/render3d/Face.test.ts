/**
 * Face.test.ts — seeded unit test for the pure ARKit-subset face system (BUILD-PLAN §9e).
 * Run: `node --experimental-strip-types src/render3d/Face.test.ts`
 *
 * Pins the frozen §A invariants the uncanny-valley gate relies on:
 *  - the subset is the §A.1 named set and the EXCLUDED shapes never leak,
 *  - every emotion recipe stays inside its caps (general ≤0.7, eyeWide ≤0.35,
 *    browDown ≤0.2) and is non-negative,
 *  - a smile carries the Duchenne cheekSquint marker; surprise is not fear,
 *  - L/R paired shapes always move symmetrically,
 *  - the blink envelope is eased + bounded + closed between blinks,
 *  - fadeWeights endpoints + bounds + determinism,
 *  - nextBlinkDelay is deterministic, positive, child-rate < adult-rate.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ARKIT_SUBSET, ARKIT_EXCLUDED, EMOTIONS, FACE_CAP, FACE_TIMING,
  expressionWeights, clampRecipe, fadeWeights, blinkEnvelope, blinkWeightAt,
  nextBlinkDelay, microsaccadeAt, type ArkitShape,
} from './Face.ts';

const PAIRS: [ArkitShape, ArkitShape][] = [
  ['browDownLeft', 'browDownRight'],
  ['browOuterUpLeft', 'browOuterUpRight'],
  ['eyeBlinkLeft', 'eyeBlinkRight'],
  ['eyeWideLeft', 'eyeWideRight'],
  ['eyeSquintLeft', 'eyeSquintRight'],
  ['cheekSquintLeft', 'cheekSquintRight'],
  ['mouthSmileLeft', 'mouthSmileRight'],
  ['mouthFrownLeft', 'mouthFrownRight'],
];

test('the subset is the §A.1 named set; excluded shapes are absent', () => {
  // the readable-emotion core is present
  for (const s of ['browInnerUp', 'eyeWideLeft', 'cheekSquintRight', 'mouthSmileLeft', 'jawOpen']) {
    assert.ok((ARKIT_SUBSET as readonly string[]).includes(s), `missing ${s}`);
  }
  // the deliberately-excluded shapes never appear in the subset
  const set = new Set<string>(ARKIT_SUBSET as readonly string[]);
  for (const x of ARKIT_EXCLUDED) assert.ok(!set.has(x), `excluded ${x} leaked into subset`);
});

test('every emotion stays inside the never-uncanny caps and is non-negative', () => {
  for (const emo of EMOTIONS) {
    const w = expressionWeights(emo);
    for (const name of ARKIT_SUBSET) {
      const v = w[name];
      assert.ok(v >= 0, `${emo}.${name} negative`);
      assert.ok(v <= FACE_CAP.general + 1e-9, `${emo}.${name} over general cap`);
    }
    assert.ok(w.eyeWideLeft <= FACE_CAP.eyeWide + 1e-9, `${emo} eyeWide over cap`);
    assert.ok(w.browDownLeft <= FACE_CAP.browDown + 1e-9, `${emo} browDown over cap`);
  }
});

test('expressionWeights only ever emits subset keys (no excluded leak)', () => {
  const allow = new Set<string>(ARKIT_SUBSET as readonly string[]);
  for (const emo of EMOTIONS) {
    for (const k of Object.keys(expressionWeights(emo))) {
      assert.ok(allow.has(k), `${emo} emitted non-subset key ${k}`);
    }
  }
});

test('a smile carries the Duchenne cheekSquint marker (else it reads fake)', () => {
  const happy = expressionWeights('happy');
  assert.ok(happy.mouthSmileLeft > 0, 'happy has no smile');
  assert.ok(happy.cheekSquintLeft > 0, 'happy missing Duchenne cheekSquint');
  const proud = expressionWeights('proud');
  assert.ok(proud.mouthSmileLeft > 0 && proud.cheekSquintLeft > 0, 'proud smile not Duchenne');
});

test('gentle surprise is NOT fear (eyeWide held ≤0.35)', () => {
  const s = expressionWeights('surprised');
  assert.ok(s.eyeWideLeft > 0 && s.eyeWideLeft <= 0.35 + 1e-9, 'surprise eyeWide out of band');
  assert.ok(s.browInnerUp > 0, 'surprise has no brow lift');
});

test('focus never reads angry (browDown held ≤0.2)', () => {
  const f = expressionWeights('focused');
  assert.ok(f.browDownLeft > 0 && f.browDownLeft <= 0.2 + 1e-9, 'focus browDown out of band');
});

test('paired L/R shapes always move symmetrically', () => {
  for (const emo of EMOTIONS) {
    const w = expressionWeights(emo);
    for (const [l, r] of PAIRS) assert.equal(w[l], w[r], `${emo} ${l}!=${r}`);
  }
});

test('clampRecipe forces a hand-edit back under the ceilings', () => {
  const wild = clampRecipe({ eyeWide: 0.9, browDown: 0.9, mouthSmile: 0.95 });
  assert.equal(wild.eyeWide, FACE_CAP.eyeWide);
  assert.equal(wild.browDown, FACE_CAP.browDown);
  assert.equal(wild.mouthSmile, FACE_CAP.general);
  // negative weights floor at 0
  assert.equal(clampRecipe({ mouthSmile: -1 }).mouthSmile, 0);
});

test('blink envelope is eased, bounded, peaks shut mid-blink, closed at the ends', () => {
  assert.equal(blinkEnvelope(0), 0);
  assert.equal(blinkEnvelope(1), 0);
  assert.equal(blinkEnvelope(-0.2), 0);
  assert.equal(blinkEnvelope(1.5), 0);
  assert.ok(Math.abs(blinkEnvelope(0.5) - 1) < 1e-9, 'mid-blink not fully shut');
  for (let p = 0; p <= 1; p += 0.05) {
    const v = blinkEnvelope(p);
    assert.ok(v >= 0 && v <= 1, `envelope out of [0,1] at ${p}`);
  }
  // closed between scheduled blinks, eased open during one
  assert.equal(blinkWeightAt(10, 5, FACE_TIMING.blinkDurationSec), 0);
  assert.ok(blinkWeightAt(5 + FACE_TIMING.blinkDurationSec / 2, 5, FACE_TIMING.blinkDurationSec) > 0.9);
});

test('fadeWeights: endpoints, bounds, determinism', () => {
  const a = expressionWeights('neutral');
  const b = expressionWeights('happy');
  const at0 = fadeWeights(a, b, 0);
  const at1 = fadeWeights(a, b, 1);
  for (const k of Object.keys(b)) {
    assert.ok(Math.abs((at0[k] ?? 0) - (a[k] ?? 0)) < 1e-9, `k=0 not from at ${k}`);
    assert.ok(Math.abs((at1[k] ?? 0) - (b[k] ?? 0)) < 1e-9, `k=1 not to at ${k}`);
  }
  // mid is between the two and bounded
  const mid = fadeWeights(a, b, 0.5);
  for (const k of Object.keys(b)) {
    const lo = Math.min(a[k] ?? 0, b[k] ?? 0), hi = Math.max(a[k] ?? 0, b[k] ?? 0);
    assert.ok((mid[k] ?? 0) >= lo - 1e-9 && (mid[k] ?? 0) <= hi + 1e-9, `mid out of range ${k}`);
  }
  assert.deepEqual(fadeWeights(a, b, 0.42), fadeWeights(a, b, 0.42));
});

test('nextBlinkDelay: deterministic, positive, child rate < adult rate', () => {
  for (let i = 0; i < 8; i++) {
    const d = nextBlinkDelay(i, 8);
    assert.ok(d > 0 && Number.isFinite(d), `delay ${i} not positive-finite`);
    assert.equal(nextBlinkDelay(i, 8), d); // deterministic
  }
  // average child interval (slower blinking) is LONGER than average adult interval
  let child = 0, adult = 0;
  for (let i = 0; i < 200; i++) { child += nextBlinkDelay(i, 8); adult += nextBlinkDelay(i, 17); }
  assert.ok(child > adult, 'child should blink less often (longer interval) than adult');
});

test('microsaccade stays sub-degree and is deterministic', () => {
  for (let t = 0; t < 5; t += 0.3) {
    const m = microsaccadeAt(t);
    assert.ok(Math.abs(m.yawDeg) <= FACE_TIMING.microsaccadeMaxDeg + 1e-9, 'yaw too big');
    assert.ok(Math.abs(m.pitchDeg) <= FACE_TIMING.microsaccadeMaxDeg + 1e-9, 'pitch too big');
    assert.deepEqual(microsaccadeAt(t), m);
  }
});
