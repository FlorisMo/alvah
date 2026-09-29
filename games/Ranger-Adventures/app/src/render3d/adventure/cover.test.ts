/**
 * cover.test.ts — the maths of true-scale cover (cover-math.ts): a line of sight is
 * blocked by the leafy part of a plant, a stand hides an animal, and the glimpse window
 * opened for the search's lens leaves it PARTLY visible — never fully covered, never
 * fully open (design §3.7). With the frisling's own stand, as the world builds it.
 * Run: `npm test`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { segSegDist, blocks, visibleShare, backPoints, openWindow, standClumps, type Stem } from './cover-math.ts';
import { atLocal, toLocal } from './places.ts';
import { STAND, STAND_FRAME, LOST_SPOT } from './missions/frisling.places.ts';

const tussock = (x: number, z: number, h = 0.7): Stem => ({ kind: 'tussock', x, y: 0, z, h, lx: 0, lz: 0, r: 0.3 * h, clump: 0, yaw: 0 });

test('segment distance', () => {
  assert.ok(Math.abs(segSegDist({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0.5, y: 1, z: -1 }, { x: 0.5, y: 1, z: 1 }) - 1) < 1e-9);
  assert.ok(segSegDist({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0.5, y: -1, z: 0 }, { x: 0.5, y: 1, z: 0 }) < 1e-9, 'crossing');
  assert.ok(Math.abs(segSegDist({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 3, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }) - 2) < 1e-9, 'end to end');
});

test('a tussock between the lens and the animal hides it; one beside it does not', () => {
  const eye = { x: 0, y: 3, z: -5 };
  const p = { x: 0, y: 0.15, z: 0 };
  assert.equal(blocks(tussock(0, -0.5), eye, p), true);
  assert.equal(blocks(tussock(2, -0.5), eye, p), false);
  assert.equal(visibleShare([p], eye, [tussock(0, -0.5)]), 0);
});

test('the frisling stand: dense enough that the piglet is hidden, the window leaves a glimpse of his back', () => {
  const clumps = standClumps(STAND_FRAME, STAND.halfW + 0.45, STAND.halfD + 0.4, 0.6, 71,
    (u, v) => Math.hypot(atLocal(STAND_FRAME, u, v).x - LOST_SPOT.x, atLocal(STAND_FRAME, u, v).z - LOST_SPOT.z) > 0.36);
  assert.ok(clumps.length > 25, `a stand, not a few bushes (${clumps.length} clumps)`);
  // its plants, roughly as the cover field grows them: a tussock and two fronds a clump
  const stems: Stem[] = [];
  clumps.forEach((c, i) => {
    stems.push({ kind: 'tussock', x: c.x, y: 0, z: c.z, h: 0.72 * c.size, lx: 0, lz: 0, r: 0.22, clump: i, yaw: 0 });
    for (const a of [0.5, 2.9]) {
      const h = 1.0 * c.size;
      stems.push({ kind: 'frond', x: c.x + Math.cos(a) * 0.15, y: 0, z: c.z + Math.sin(a) * 0.15, h, lx: Math.sin(a) * 0.55 * h, lz: Math.cos(a) * 0.55 * h, r: 0.2 * h, clump: i, yaw: a });
    }
  });
  // the search lens: behind the ranger arriving from the marker, high enough to look in
  const eye = { ...atLocal(STAND_FRAME, 0.8, -5.2), y: 3.6 };
  const back = backPoints(LOST_SPOT.x, 0, LOST_SPOT.z, LOST_SPOT.yaw, 0.52, 0.19);
  const before = visibleShare(back, eye, stems);
  assert.ok(before < 0.3, `before the window he is (nearly) hidden: ${before.toFixed(2)}`);
  const changed = openWindow(stems, eye, back, 0.3);
  const after = visibleShare(back, eye, stems);
  assert.ok(after >= 0.3 && after < 0.8, `a glimpse, never all of him: ${after.toFixed(2)}`);
  assert.ok(changed.length > 0 && changed.length < 12, `a few plants made smaller (${changed.length})`);
  for (const i of changed) assert.ok(stems[i].h >= (stems[i].h0 ?? 0) * 0.2, 'shrunk, never removed');
  // and from the side (a lens that is not the search's) he stays hidden
  const side = { ...atLocal(STAND_FRAME, 5, 0.5), y: 1.2 };
  assert.ok(visibleShare(back, side, stems) < 0.35, 'from low at the side the stand still hides him');
  void toLocal;
});
