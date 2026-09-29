/**
 * Forest.test.ts — a scene ray hits the trees the forest draws NOW.
 * Run: `node --experimental-strip-types --test src/render3d/world/Forest.test.ts`
 *
 * Pins the fix for a stale raycast sphere (2026-09-27): the level meshes are refilled
 * with different trees as the camera moves, and three caches an InstancedMesh's
 * bounding sphere from the instances it held the first time it was asked. A ray that
 * misses the cached sphere tests no tree, so golden's occluder probe walked straight
 * through drawn trees in the bos (28 of 60 camera rays).
 *
 * And where a tree's branch stub stands (2026-09-29): the forest draws it as part of its
 * tree (so it fades with it), from one unit stub placed per tree by `stubMatrix`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { fillLevel, stubGeometry, stubMatrix, STUB_TAPER, STUB_TILT, type TreeStub } from './Forest.ts';

/** Two trees 50 m apart, each a 1 × 4 × 1 m trunk-and-crown box standing on y = 0. */
function forestOfTwo(): { inst: THREE.InstancedMesh; world: Float32Array; tint: Float32Array } {
  const geo = new THREE.BoxGeometry(1, 4, 1).translate(0, 2, 0);
  const inst = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial(), 2);
  inst.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(6), 3);
  inst.count = 0;
  const world = new Float32Array(32);
  new THREE.Matrix4().makeTranslation(0, 0, 0).toArray(world, 0);
  new THREE.Matrix4().makeTranslation(50, 0, 0).toArray(world, 16);
  const tint = new Float32Array([0.9, 0.9, 0.9, 1.1, 1.0, 0.95]);
  inst.updateMatrixWorld(true);
  return { inst, world, tint };
}

/** A horizontal ray at 2 m height, from 10 m in front of x toward the tree line. */
function rayAt(inst: THREE.InstancedMesh, x: number): THREE.Intersection[] {
  const rc = new THREE.Raycaster(new THREE.Vector3(x, 2, 10), new THREE.Vector3(0, 0, -1));
  return rc.intersectObject(inst, false);
}

test('after a refill, a ray hits the tree drawn now, not the one drawn before', () => {
  const { inst, world, tint } = forestOfTwo();
  fillLevel(inst, [0], world, tint, null);
  assert.equal(rayAt(inst, 0).length > 0, true, 'the first tree is hit');
  assert.ok(inst.boundingSphere, 'the raycast cached a bounding sphere (around the first tree)');

  fillLevel(inst, [1], world, tint, null); // the camera moved: the second tree is drawn now
  const hits = rayAt(inst, 50);
  assert.ok(hits.length > 0, 'the tree drawn now is hit (a stale sphere around the first tree would miss it)');
  assert.ok(Math.abs(hits[0].point.x - 50) < 0.6, `hit at x ${hits[0].point.x}`);
  assert.equal(hits[0].instanceId, 0);
  assert.equal(rayAt(inst, 0).length, 0, 'the tree no longer drawn is not hit');
});

test('a refill writes placement × the GLB part matrix and the tree\'s tint', () => {
  const { inst, world, tint } = forestOfTwo();
  const local = new THREE.Matrix4().makeTranslation(0, 1, 0);
  fillLevel(inst, [1, 0], world, tint, local);
  assert.equal(inst.count, 2);
  const m = new THREE.Matrix4();
  inst.getMatrixAt(0, m);
  const p = new THREE.Vector3().setFromMatrixPosition(m);
  assert.deepEqual([p.x, p.y, p.z], [50, 1, 0]);
  const c = new THREE.Color();
  inst.getColorAt(0, c);
  assert.ok(Math.abs(c.r - 1.1) < 1e-6 && Math.abs(c.b - 0.95) < 1e-6, 'the second tree\'s tint');
  fillLevel(inst, [], world, tint, local);
  assert.equal(inst.count, 0, 'an empty level draws nothing');
  assert.equal(rayAt(inst, 50).length, 0);
});

test('a branch stub stands out of its trunk along its heading, a little upward, at its size', () => {
  const stub: TreeStub = { ang: 0.8, y: 1.4, start: 0.1, len: 0.5, r: 0.05, color: '#6a4632' };
  const foot = { x: 10, y: 2, z: -5 };
  const m = stubMatrix(foot, stub);
  const root = new THREE.Vector3(0, 0, 0).applyMatrix4(m);
  const tip = new THREE.Vector3(0, 1, 0).applyMatrix4(m);
  const near = (a: number, b: number, msg: string): void => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} vs ${b}`);
  // its root: `start` out from the trunk's axis along its heading, at its height above the foot
  near(root.x, 10 + Math.sin(0.8) * 0.1, 'root x');
  near(root.y, 3.4, 'root y');
  near(root.z, -5 + Math.cos(0.8) * 0.1, 'root z');
  // its tip: `len` on, out along the same heading, rising STUB_TILT above level
  near(Math.atan2(tip.x - root.x, tip.z - root.z), 0.8, 'heading');
  near(Math.hypot(tip.x - root.x, tip.z - root.z), 0.5 * Math.cos(STUB_TILT), 'reach');
  near(tip.y - root.y, 0.5 * Math.sin(STUB_TILT), 'rise');
  // its thickness: radius r at the root, STUB_TAPER of it at the tip
  const g = stubGeometry();
  g.computeBoundingBox();
  near(g.boundingBox!.min.y, 0, 'the unit stub starts at its root');
  near(g.boundingBox!.max.y, 1, 'and is 1 m long');
  const pos = g.attributes.position;
  let rootR = 0, tipR = 0;
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const w = p.clone().applyMatrix4(m);
    const axis = p.y < 0.5 ? root : tip;
    const d = w.distanceTo(axis);
    if (p.y < 0.5) rootR = Math.max(rootR, d); else tipR = Math.max(tipR, d);
  }
  near(rootR, 0.05, 'root radius');
  near(tipR, 0.05 * STUB_TAPER, 'tip radius');
});
