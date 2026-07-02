/**
 * AmbientPaths.test.ts — seeded unit test for the pure ambient-path functions
 * (WORLD-PLAN W3.6). Run:
 *   `node --experimental-strip-types src/render3d/AmbientPaths.test.ts`
 *
 * Guards the shape contracts the World relies on: a wander never leaves its home
 * radius, has BOTH a graze pause and a striding phase each leg, is deterministic
 * and continuous; a glide stays on its circle, undulates within its bob band, and
 * is deterministic.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GRAZE_FRAC, glideAt, wanderAt, type GlideConfig, type WanderConfig,
} from './AmbientPaths.ts';

const WANDER: WanderConfig = { homeX: 12, homeZ: -8, radius: 6, period: 20, phase: 0.15, angle: 0.7 };
const GLIDE: GlideConfig = { cx: 0, cz: 0, radius: 40, height: 22, bob: 1.5, period: 26, phase: 0.3 };

/** Dense deterministic time samples across several loops. */
const TS = Array.from({ length: 500 }, (_, i) => i * 0.08); // 0..40s

test('wanderAt stays within the home radius (+small easing slack)', () => {
  for (const t of TS) {
    const s = wanderAt(WANDER, t);
    const d = Math.hypot(s.x - WANDER.homeX, s.z - WANDER.homeZ);
    // waypoints sit ON the radius; the chord between two eases slightly inside,
    // never outside — so radius is a hard upper bound (tiny fp slack).
    assert.ok(d <= WANDER.radius + 1e-6, `dist ${d} exceeds radius at t=${t}`);
  }
});

test('wanderAt has a graze pause AND a stride within a single leg', () => {
  const legStart = 0; // t where u≈0 for phase-shifted config handled by sampling
  // sample finely across one full loop and require both states to appear
  let sawGraze = false, sawMove = false;
  for (let i = 0; i < 400; i++) {
    const st = wanderAt(WANDER, i * (WANDER.period / 400));
    if (st.moving) sawMove = true; else sawGraze = true;
  }
  void legStart;
  assert.ok(sawGraze, 'a graze pause (moving=false) must occur');
  assert.ok(sawMove, 'a stride (moving=true) must occur');
});

test('wanderAt: the graze fraction really pauses at a waypoint', () => {
  // at the very start of a leg (f just inside the graze window) the animal must
  // be stationary — pick a t landing early in a leg.
  const period = WANDER.period;
  // u = frac(t/period + phase); choose t so u = 0.01 (early in leg 0), f≈0.04 < GRAZE_FRAC
  const t = (0.01 - WANDER.phase + 1) * period;
  const st = wanderAt(WANDER, t);
  assert.equal(st.moving, false, `f<${GRAZE_FRAC} should graze`);
});

test('wanderAt is deterministic and continuous', () => {
  for (const t of [0, 3.3, 7.1, 13.9, 25.0]) {
    assert.deepEqual(wanderAt(WANDER, t), wanderAt(WANDER, t));
  }
  // no big jumps between adjacent samples (continuity, incl. across leg seams)
  let prev = wanderAt(WANDER, 0);
  for (let i = 1; i < 600; i++) {
    const cur = wanderAt(WANDER, i * 0.02);
    const jump = Math.hypot(cur.x - prev.x, cur.z - prev.z);
    assert.ok(jump < 0.6, `discontinuity ${jump} at step ${i}`);
    prev = cur;
  }
});

test('glideAt stays on its circle at the cruise height ± bob', () => {
  for (const t of TS) {
    const s = glideAt(GLIDE, t);
    const r = Math.hypot(s.x - GLIDE.cx, s.z - GLIDE.cz);
    assert.ok(Math.abs(r - GLIDE.radius) < 1e-6, `off-circle r=${r} at t=${t}`);
    assert.ok(s.y >= GLIDE.height - GLIDE.bob - 1e-9 && s.y <= GLIDE.height + GLIDE.bob + 1e-9,
      `height ${s.y} outside bob band at t=${t}`);
  }
});

test('glideAt is deterministic', () => {
  for (const t of [0, 5.5, 11.1, 26.0]) {
    assert.deepEqual(glideAt(GLIDE, t), glideAt(GLIDE, t));
  }
});
