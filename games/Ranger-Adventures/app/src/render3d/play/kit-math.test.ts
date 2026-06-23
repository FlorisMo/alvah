/**
 * kit-math.test.ts — seeded unit test for the pure 3D-play maths
 * (3D-IMMERSION-PLAN §2, BUILD-PLAN §9e). Run:
 *   node --experimental-strip-types --test src/render3d/play/kit-math.test.ts
 *
 * Pins: the hit-sphere maths actually delivers ≥56px (a11y floor); the trail
 * samples endpoints + monotone progress; the highlight is dual-channel and
 * FREEZES under reduced-motion (motion-comfort); damping is bounded. Deterministic.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MIN_TAP_PX, worldRadiusForPx, tapHitRadius, trailPoints, highlightPulse, dampFactor,
} from './kit-math.ts';

const FOV = (55 * Math.PI) / 180; // World's camera FOV
const VH = 800;                   // a viewport height in px

test('worldRadiusForPx inverts the perspective projection (round-trips to ≥56px)', () => {
  const d = 6;
  const r = worldRadiusForPx(MIN_TAP_PX, d, FOV, VH);
  // re-project a sphere of diameter 2r at distance d → must read back ~56px
  const px = (2 * r) / (2 * d * Math.tan(FOV / 2)) * VH;
  assert.ok(Math.abs(px - MIN_TAP_PX) < 1e-6, `projected ${px}px`);
});

test('worldRadiusForPx grows with distance (farther objects need a bigger sphere)', () => {
  const near = worldRadiusForPx(MIN_TAP_PX, 3, FOV, VH);
  const far = worldRadiusForPx(MIN_TAP_PX, 12, FOV, VH);
  assert.ok(far > near);
});

test('tapHitRadius never drops below the floor', () => {
  // a very close target would project huge → maths radius tiny → floor wins
  assert.equal(tapHitRadius(0.1, FOV, VH, 0.4), 0.4);
  // a far target → maths radius exceeds the floor
  assert.ok(tapHitRadius(20, FOV, VH, 0.4) > 0.4);
});

test('worldRadiusForPx is safe when viewport height is unknown', () => {
  assert.equal(worldRadiusForPx(MIN_TAP_PX, 6, FOV, 0), 0);
});

test('trailPoints includes both ends and steps monotonically', () => {
  const pts = trailPoints(0, 0, 10, 0, 5);
  assert.equal(pts.length, 5);
  assert.deepEqual({ x: pts[0].x, z: pts[0].z, u: pts[0].u }, { x: 0, z: 0, u: 0 });
  assert.deepEqual({ x: pts[4].x, z: pts[4].z, u: pts[4].u }, { x: 10, z: 0, u: 1 });
  for (let i = 1; i < pts.length; i++) assert.ok(pts[i].u > pts[i - 1].u && pts[i].x > pts[i - 1].x);
});

test('trailPoints clamps to at least 2 points (the two ends)', () => {
  assert.equal(trailPoints(0, 0, 1, 1, 1).length, 2);
  assert.equal(trailPoints(0, 0, 1, 1, 0).length, 2);
});

test('highlightPulse is dual-channel and bounded while moving', () => {
  for (const t of [0, 0.5, 1, 2.7, 5.1]) {
    const p = highlightPulse(t, false);
    assert.ok(p.scale >= 1 && p.scale <= 1.08 + 1e-9, `scale ${p.scale}`);
    assert.ok(p.emissive >= 0.35 - 1e-9 && p.emissive <= 0.7 + 1e-9, `emissive ${p.emissive}`);
  }
});

test('highlightPulse FREEZES to a steady glow under reduced-motion', () => {
  const a = highlightPulse(0, true);
  const b = highlightPulse(3.3, true);
  assert.deepEqual(a, b);                  // identical at any time → no motion
  assert.ok(a.emissive > 0 && a.scale > 1); // still visibly marked (colour + lift)
});

test('dampFactor is in [0,1] and rises with dt; tau<=0 → instant cut', () => {
  assert.equal(dampFactor(0.016, 0), 1);
  const small = dampFactor(0.016, 0.3);
  const big = dampFactor(0.2, 0.3);
  assert.ok(small > 0 && small < 1 && big > small && big < 1);
});
