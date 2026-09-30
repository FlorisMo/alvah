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
  GRAZE_FRAC, clearLoop, glideAt, loopPeriod, wanderAt, type GlideConfig, type WanderConfig,
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

test('wanderAt turns calmly toward the next waypoint while it grazes: its facing never snaps', () => {
  const cfg: WanderConfig = { ...WANDER, period: loopPeriod(WANDER.radius, 0.95) };
  let prev = wanderAt(cfg, 0).facing;
  let most = 0;
  for (let i = 1; i < 4000; i++) {
    const f = wanderAt(cfg, (i * cfg.period) / 4000).facing;
    const d = Math.abs(Math.atan2(Math.sin(f - prev), Math.cos(f - prev)));
    most = Math.max(most, d / (cfg.period / 4000));
    prev = f;
  }
  assert.ok(most < 1.2, `it turns at most ${most.toFixed(2)} rad/s (was a 90° snap at each waypoint)`);
});

test('loopPeriod: a leg is strode at the walk asked for at most (its clip never skates)', () => {
  for (const peak of [0.7, 0.95]) {
    const cfg: WanderConfig = { ...WANDER, period: loopPeriod(WANDER.radius, peak) };
    let top = 0;
    let prev = wanderAt(cfg, 0);
    for (let i = 1; i < 6000; i++) {
      const t = (i * cfg.period) / 6000;
      const cur = wanderAt(cfg, t);
      top = Math.max(top, Math.hypot(cur.x - prev.x, cur.z - prev.z) / (cfg.period / 6000));
      prev = cur;
    }
    assert.ok(top <= peak * 1.02 && top >= peak * 0.9, `peak ${peak}: strides at most ${top.toFixed(3)} m/s`);
  }
});

test('clearLoop: a clear loop stays; one across a rock turns, then moves its home, never onto the rock', () => {
  const free = () => true;
  assert.deepEqual(clearLoop(WANDER, free), WANDER, 'nothing in the way: the loop is kept');
  // a rock 4 m from home, on the loop's first leg
  const rock = { x: WANDER.homeX + 4.2, z: WANDER.homeZ + 1.5, r: 1.6 };
  const ok = (x: number, z: number) => Math.hypot(x - rock.x, z - rock.z) > rock.r;
  const moved = clearLoop(WANDER, ok);
  for (let i = 0; i <= 400; i++) {
    const s = wanderAt(moved, (i * moved.period) / 400);
    assert.ok(ok(s.x, s.z), `the moved loop stays off the rock (t ${i})`);
  }
  // hemmed in on every side: a smaller loop at its own home
  const tight = clearLoop(WANDER, (x, z) => Math.hypot(x - 100, z) > 1);
  assert.ok(tight.radius <= WANDER.radius);
});
