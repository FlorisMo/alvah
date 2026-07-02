/**
 * audiofade.test.ts — seeded unit test for the equal-power crossfade curves.
 * Run: `node --experimental-strip-types src/core/audiofade.test.ts`
 *
 * Covers: endpoints (in starts ~0 ends at gain; out starts at gain ends ~0);
 * monotonic in the intended direction; equal-power invariant (out² + in² is
 * constant across the whole window → no loudness dip mid-crossfade); a
 * degenerate step count still yields a usable 2-sample curve.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { fadeInCurve, fadeOutCurve } from './audiofade.ts';

test('fade-in rises from ~0 to the target gain', () => {
  const c = fadeInCurve(0.22, 32);
  assert.equal(c.length, 32);
  assert.ok(c[0] < 1e-6, 'starts at ~0');
  assert.ok(Math.abs(c[c.length - 1] - 0.22) < 1e-6, 'ends at gain');
});

test('fade-out falls from the gain to ~0', () => {
  const c = fadeOutCurve(0.22, 32);
  assert.ok(Math.abs(c[0] - 0.22) < 1e-6, 'starts at gain');
  assert.ok(c[c.length - 1] < 1e-6, 'ends at ~0');
});

test('both curves are monotonic in their intended direction', () => {
  const inC = fadeInCurve(0.3, 40);
  const outC = fadeOutCurve(0.3, 40);
  for (let i = 1; i < inC.length; i++) {
    assert.ok(inC[i] >= inC[i - 1] - 1e-9, 'fade-in never dips');
    assert.ok(outC[i] <= outC[i - 1] + 1e-9, 'fade-out never rises');
  }
});

test('equal-power: out² + in² is constant across the window (no mid dip)', () => {
  const g = 0.25;
  const inC = fadeInCurve(g, 33);
  const outC = fadeOutCurve(g, 33);
  const target = g * g; // cos²+sin² = 1, scaled by g²
  for (let i = 0; i < inC.length; i++) {
    const power = inC[i] * inC[i] + outC[i] * outC[i];
    assert.ok(Math.abs(power - target) < 1e-6, `constant power at ${i}`);
  }
});

test('a degenerate step count still yields a 2-sample curve', () => {
  assert.equal(fadeInCurve(0.2, 1).length, 2);
  assert.equal(fadeOutCurve(0.2, 0).length, 2);
});
