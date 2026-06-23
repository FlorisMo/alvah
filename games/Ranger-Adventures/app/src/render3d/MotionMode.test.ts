/**
 * MotionMode.test.ts — seeded unit test for the §1e reduced-motion render policy.
 * Run: `node --test --experimental-strip-types src/render3d/MotionMode.test.ts`
 *
 * Pins the "Full 3D reduced-motion mode (per-view cuts-not-moves)" contract:
 * reduced ⇒ camera CUTS + secondary motion OFF; the three KEEP channels
 * (locomotion / expression / gaze) are NEVER disabled in either mode; and the
 * live policy follows the in-game toggle with no restart (no window in node →
 * defaults to the OS path = off, override flips it).
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { motionPolicy, livePolicy, liveReducedMotion } from './MotionMode.ts';
import { setReducedMotionOverride } from '../core/reduced-motion.ts';

test('reduced mode: camera cuts, secondary motion off', () => {
  const p = motionPolicy(true);
  assert.equal(p.reduced, true);
  assert.equal(p.cameraTransition, 'cut');
  assert.equal(p.secondaryMotion, false);
});

test('full motion: camera damps, secondary motion on', () => {
  const p = motionPolicy(false);
  assert.equal(p.reduced, false);
  assert.equal(p.cameraTransition, 'damp');
  assert.equal(p.secondaryMotion, true);
});

test('the three KEEP channels are invariants — never disabled in EITHER mode', () => {
  for (const reduced of [true, false]) {
    const p = motionPolicy(reduced);
    assert.equal(p.keepLocomotion, true, 'walking must never stop');
    assert.equal(p.keepExpression, true, 'blink + emotion fade must never stop');
    assert.equal(p.keepGaze, true, 'gaze direction must never drop');
  }
});

test('deterministic — same input, same policy', () => {
  assert.deepEqual(motionPolicy(true), motionPolicy(true));
  assert.deepEqual(motionPolicy(false), motionPolicy(false));
});

test('live policy follows the in-game toggle with no restart', () => {
  // node has no window → OS path resolves to "not reduced"
  setReducedMotionOverride(null);
  assert.equal(liveReducedMotion(), false);
  assert.equal(livePolicy().reduced, false);
  assert.equal(livePolicy().cameraTransition, 'damp');

  // flip the in-game override → the SAME accessor reports reduced immediately
  setReducedMotionOverride(true);
  assert.equal(liveReducedMotion(), true);
  assert.equal(livePolicy().reduced, true);
  assert.equal(livePolicy().secondaryMotion, false);
  assert.equal(livePolicy().cameraTransition, 'cut');

  // and back off, no restart
  setReducedMotionOverride(false);
  assert.equal(livePolicy().reduced, false);

  setReducedMotionOverride(null); // leave the module as we found it
});
