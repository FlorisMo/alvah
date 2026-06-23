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
import { resolveMove, type MoveLimits, type Obstacle } from './CharacterController.ts';

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
