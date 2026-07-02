import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fresnelFactor,
  rippleAmp,
  FRESNEL_POWER,
  RIPPLE_AMP,
} from './Water.ts';

// W4.8 — the pure ven-water maths. The shader mirrors these, so the two
// invariants that keep the disc reading as calm WATER (fresnel edge-glow,
// waveless under reduced-motion) are pinned here, no browser needed.

test('fresnelFactor: head-on is deep (0), grazing is sky-glow (1)', () => {
  assert.equal(fresnelFactor(1), 0, 'looking straight down → 0 (deep tint)');
  assert.equal(fresnelFactor(0), 1, 'grazing → 1 (sky-glow tint)');
});

test('fresnelFactor is monotonically decreasing in viewY and in [0,1]', () => {
  let prev = Infinity;
  for (let i = 0; i <= 10; i++) {
    const f = fresnelFactor(i / 10);
    assert.ok(f >= 0 && f <= 1, `factor ${f} in [0,1]`);
    assert.ok(f <= prev, 'decreasing as the view straightens');
    prev = f;
  }
});

test('fresnelFactor clamps out-of-range viewY', () => {
  assert.equal(fresnelFactor(-0.5), 1, 'below 0 clamps to grazing');
  assert.equal(fresnelFactor(1.5), 0, 'above 1 clamps to head-on');
});

test('fresnelFactor honours the exponent (default matches FRESNEL_POWER)', () => {
  assert.equal(fresnelFactor(0.5), fresnelFactor(0.5, FRESNEL_POWER));
  // a higher power hugs the edge harder → a smaller mid-angle value
  assert.ok(fresnelFactor(0.5, 5) < fresnelFactor(0.5, 2));
});

test('rippleAmp is exactly 0 under reduced-motion (waveless default)', () => {
  assert.equal(rippleAmp(true), 0, 'reduced-motion → dead still');
  assert.equal(rippleAmp(false), RIPPLE_AMP, 'motion on → subtle shimmer');
  assert.ok(RIPPLE_AMP > 0, 'the shimmer is a real, small amplitude');
});
