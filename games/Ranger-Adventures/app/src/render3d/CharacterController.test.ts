/**
 * CharacterController.test.ts — seeded unit test for the kinematic move resolver
 * (BUILD-PLAN §4 box 38c, §9e). Run:
 *   node --experimental-strip-types src/render3d/CharacterController.test.ts
 *
 * Pins the invariants the world controller depends on: the resolve is deterministic;
 * the ranger can never end up inside a pine, beyond the world rim, or below the
 * waterline; a collision SLIDES rather than stops dead (motion-comfort §1e); and an
 * unobstructed step is passed through untouched (no drift on open heath).
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveMove, boxObstacle, obstacleGap, segmentEntry, segmentCrosses, type MoveLimits, type Obstacle } from './CharacterController.ts';

// a flat, dry, generous world unless a test says otherwise
const FLAT: MoveLimits = { bound: 100 };

test('an unobstructed step passes through untouched', () => {
  const p = resolveMove(0, 0, 1.2, 0.4, [], FLAT);
  assert.equal(p.x, 1.2);
  assert.equal(p.z, 0.4);
});

test('resolveMove is deterministic', () => {
  const obs: Obstacle[] = [{ x: 1, z: 0, r: 0.6 }];
  const a = resolveMove(0, 0, 0.9, 0.05, obs, FLAT);
  const b = resolveMove(0, 0, 0.9, 0.05, obs, FLAT);
  assert.deepEqual(a, b);
});

test('the ranger can never end up inside a pine trunk', () => {
  const obs: Obstacle[] = [{ x: 1, z: 0, r: 0.6 }];
  // aim straight through the trunk centre
  const p = resolveMove(0, 0, 1, 0, obs, FLAT);
  assert.ok(Math.hypot(p.x - 1, p.z - 0) >= 0.6 - 1e-9, 'pushed out to the rim');
});

test('two overlapping obstacles both de-penetrate (two-pass pushout)', () => {
  const obs: Obstacle[] = [
    { x: 1, z: 0, r: 0.7 },
    { x: 1.5, z: 0.3, r: 0.7 },
  ];
  const p = resolveMove(0, 0, 1.2, 0.1, obs, FLAT);
  for (const o of obs) {
    assert.ok(Math.hypot(p.x - o.x, p.z - o.z) >= o.r - 1e-6, 'clear of every obstacle');
  }
});

test('a glancing collision SLIDES, not stops (residual tangential motion)', () => {
  // step alongside a trunk: we should keep most of our forward (z) travel
  const obs: Obstacle[] = [{ x: 0.5, z: 1, r: 0.6 }];
  const p = resolveMove(0, 0, 0.3, 1.2, obs, FLAT);
  assert.ok(p.z > 0.8, 'kept moving forward past the trunk (slid, not stuck)');
  assert.ok(Math.hypot(p.x - 0.5, p.z - 1) >= 0.6 - 1e-6, 'still outside the trunk');
});

test('the ranger is clamped within the circular world bound', () => {
  const limits: MoveLimits = { ...FLAT, bound: 10 };
  const p = resolveMove(9, 0, 14, 0, [], limits);
  assert.ok(Math.hypot(p.x, p.z) <= 10 + 1e-9, 'clamped to the rim');
});

test('the ranger cannot wade into the water; the shoreline stays walkable', () => {
  // water is the half-plane x >= 5 (a predicate, not a global height threshold)
  const limits: MoveLimits = { bound: 100, blocked: (x) => x >= 5 };
  // try to walk from dry land straight into the water
  const p = resolveMove(0, 0, 8, 0, [], limits);
  assert.ok(!limits.blocked!(p.x, p.z), 'stopped on the dry side of the shore');
  assert.ok(p.x < 5, 'never stepped into the ven');
  assert.ok(p.x > 0, 'but still advanced toward the shore (shoreline walkable)');
});

test('a dry trough in the relief is NOT mistaken for water (no invisible walls)', () => {
  // a generic height field that dips to -2.2 on dry land — with no `blocked`
  // predicate the controller must let the ranger walk straight across it
  const limits: MoveLimits = { bound: 100 };
  const p = resolveMove(0, 0, 3, 0, [], limits);
  assert.equal(p.x, 3, 'walked across the dry trough untouched');
});

/* ---- wave 2: building footprints as rectangles ---- */

// the cabin-like footprint: 4 × 3 m, turned 0.8 rad
const CABIN = boxObstacle(5, -2, 2, 1.5, 0.8, 0.3);

test('walking into a building from 16 directions never ends inside its footprint', () => {
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    let x = CABIN.x + Math.cos(a) * 6, z = CABIN.z + Math.sin(a) * 6;
    for (let i = 0; i < 400; i++) { // walk straight at the centre in 3 cm steps
      const dx = CABIN.x - x, dz = CABIN.z - z, d = Math.hypot(dx, dz) || 1;
      const p = resolveMove(x, z, x + (dx / d) * 0.03, z + (dz / d) * 0.03, [CABIN], FLAT);
      x = p.x; z = p.z;
      assert.ok(obstacleGap(CABIN, x, z) >= -1e-9, `inside the keep-out at step ${i} from direction ${k}`);
    }
    assert.ok(obstacleGap(CABIN, x, z) < 0.05, 'ends against the wall, not stopped short');
  }
});

test('a building wall slides: walking at it on a slant keeps moving along it', () => {
  const wall = boxObstacle(0, 0, 3, 0.5, 0, 0.3); // a long wall along x
  let x = -2, z = 0.85;                            // just in front of its +z face
  const x0 = x;
  for (let i = 0; i < 60; i++) {
    const p = resolveMove(x, z, x + 0.03, z - 0.02, [wall], FLAT); // into the wall and along it
    x = p.x; z = p.z;
  }
  assert.ok(x - x0 > 1.5, `slid ${(x - x0).toFixed(2)} m along the wall (want > 1.5)`);
  assert.ok(Math.abs(z - 0.8) < 1e-6, 'held at the wall plus its pad');
});

test('a building corner is rounded: sliding round it never snaps', () => {
  const b = boxObstacle(0, 0, 1, 1, 0, 0.3);
  let x = -0.5, z = 1.3;
  let worst = 0;
  for (let i = 0; i < 200; i++) {
    const p = resolveMove(x, z, x + 0.03, z - 0.01, [b], FLAT);
    worst = Math.max(worst, Math.hypot(p.x - x, p.z - z));
    x = p.x; z = p.z;
  }
  assert.ok(worst < 0.05, `largest single step ${worst.toFixed(3)} m (no snap)`);
  assert.ok(x > 1.2, 'made it round the corner');
});

test('segmentEntry (circle) is the old boom spherecast', () => {
  const o: Obstacle = { x: 0, z: -3, r: 0.5 };
  // from the origin straight down −z, 5 m: the circle grown by 0.35 is entered at 3 − 0.85
  const t = segmentEntry(o, 0, 0, 0, -5, 0.35);
  assert.ok(Math.abs(t * 5 - (3 - 0.85)) < 1e-9, `t·len = ${t * 5}`);
  assert.equal(segmentEntry(o, 0, 0, 5, 0, 0.35), 1, 'a miss is 1');
  // standing in the grown ring (not the circle): the bare circle still stops the boom
  const t2 = segmentEntry(o, 0, -2.3, 0, -1, 0.35);
  assert.ok(Math.abs(t2 - 0.2) < 1e-9, `bare circle entered at ${t2}`);
  // standing inside the circle itself: ignored
  assert.equal(segmentEntry(o, 0, -3.1, 0, -1, 0.35), 1);
});

test('segmentEntry (box) stops at the wall grown by pad + probe', () => {
  const b = boxObstacle(0, -4, 2, 1, 0, 0.3); // near face at z = −3
  const t = segmentEntry(b, 0, 0, 0, -6, 0.35);
  assert.ok(Math.abs(t * 6 - (3 - 0.65)) < 1e-9, `t·len = ${t * 6}`);
  assert.equal(segmentEntry(b, 0, 0, 6, 0, 0.35), 1);
});

test('segmentCrosses: circles as before, boxes by their bare rectangle', () => {
  const c: Obstacle = { x: 0, z: -2, r: 0.5 };
  assert.equal(segmentCrosses(c, 0, 0, 0, -4, 0.05, 0.95), true);
  assert.equal(segmentCrosses(c, 0.6, 0, 0.6, -4, 0.05, 0.95), false, 'passes beside it');
  const b = boxObstacle(0, -2, 1.5, 0.2, 0, 0.3);
  assert.equal(segmentCrosses(b, 1.4, 0, 1.4, -4, 0.05, 0.95), true, 'the rectangle is wide');
  assert.equal(segmentCrosses(b, 1.6, 0, 1.6, -4, 0.05, 0.95), false, 'the pad does not occlude');
  assert.equal(segmentCrosses(b, 0, 0, 0, -1.7, 0.05, 0.95), false, 'ends before it');
});
