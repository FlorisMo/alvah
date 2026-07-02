import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SKY_STOPS,
  cloudOffset,
  windSway,
  flyoverAt,
  FLYOVER_PERIOD,
  FLYOVER_VISIBLE,
} from './Atmosphere.ts';

// W4.6 — the pure "Lucht + adem" math. Everything here is SECONDARY motion, so
// the contract the world leans on is: advance the atmosphere clock and things
// move; freeze the clock (reduced-motion) and everything stills. Plus sane
// ranges + the ~12 s flyover period. No browser needed.

test('SKY_STOPS is a richer, monotonic top→bottom gradient', () => {
  assert.ok(SKY_STOPS.length >= 5, `${SKY_STOPS.length} stops (richer than 3)`);
  assert.equal(SKY_STOPS[0][0], 0, 'starts at the zenith');
  assert.equal(SKY_STOPS[SKY_STOPS.length - 1][0], 1, 'ends at the horizon');
  for (let i = 1; i < SKY_STOPS.length; i++) {
    assert.ok(SKY_STOPS[i][0] > SKY_STOPS[i - 1][0], 'positions strictly increase');
    assert.match(SKY_STOPS[i][1], /^#[0-9a-f]{6}$/i, 'valid css hex colour');
  }
});

test('cloudOffset drifts over time and wraps into [0,1)', () => {
  const a = cloudOffset(0);
  const b = cloudOffset(10);
  assert.notDeepEqual(a, b, 'a moving clock drifts the clouds');
  for (const t of [0, 3.3, 250, 1e4, 99999]) {
    const o = cloudOffset(t);
    assert.ok(o.x >= 0 && o.x < 1, `x ${o.x} in [0,1)`);
    assert.ok(o.y >= 0 && o.y < 1, `y ${o.y} in [0,1)`);
  }
});

test('cloudOffset freezes for a frozen clock (reduced-motion)', () => {
  assert.deepEqual(cloudOffset(42), cloudOffset(42), 'same t → same offset');
});

test('windSway is bounded, gentle, and desyncs by phase', () => {
  let max = 0;
  for (let t = 0; t < 40; t += 0.13) {
    for (const phase of [0, 1.1, 2.7, 4.9]) {
      max = Math.max(max, Math.abs(windSway(t, phase)));
    }
  }
  assert.ok(max <= 0.13, `peak sway ${max.toFixed(3)} rad stays gentle`);
  assert.ok(max > 0.05, 'but the wind is actually felt');
  // two different phases at the same instant generally differ (a field waves,
  // not in lockstep)
  assert.notEqual(windSway(3, 0), windSway(3, 2.0));
});

test('windSway freezes for a frozen clock (reduced-motion)', () => {
  assert.equal(windSway(7.5, 1.3), windSway(7.5, 1.3), 'same t,phase → same angle');
});

test('flyoverAt crosses west→east on the ~12 s period, then pauses', () => {
  assert.equal(FLYOVER_PERIOD, 12);
  const start = flyoverAt(0.01);
  const mid = flyoverAt(FLYOVER_PERIOD * FLYOVER_VISIBLE * 0.5);
  assert.ok(start.visible && mid.visible, 'on-arc early + mid-cross');
  assert.ok(mid.x > start.x, 'moves toward +x (west → east)');
  assert.ok(mid.y >= start.y, 'rises a touch mid-cross');
  // during the calm gap after the crossing the bird is parked off-view
  const gap = flyoverAt(FLYOVER_PERIOD * (FLYOVER_VISIBLE + 1) * 0.5);
  assert.equal(gap.visible, false, 'a calm pause between passes');
  // the cycle repeats every period
  assert.deepEqual(flyoverAt(3), flyoverAt(3 + FLYOVER_PERIOD), 'periodic');
});

test('flyoverAt stays high above the play area', () => {
  for (let t = 0; t < FLYOVER_PERIOD; t += 0.2) {
    const f = flyoverAt(t);
    assert.ok(f.y >= 28, `y ${f.y} stays high (never dives at the player)`);
  }
});

test('flyoverAt freezes for a frozen clock (reduced-motion)', () => {
  assert.deepEqual(flyoverAt(5.2), flyoverAt(5.2), 'same t → same pose');
});
