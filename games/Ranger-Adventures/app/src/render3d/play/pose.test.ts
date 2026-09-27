/**
 * pose.test.ts — the lying pose (child:B13, breaker:B7): the legs fold under the body,
 * the soles stay on the ground, the back drops by exactly the folded length; the fawn's
 * spots are an even, calm scatter.
 *   node --experimental-strip-types --test src/render3d/play/pose.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { lieY, lieDown, isSpot, backTop, LEG_SHARE } from './pose.ts';

test('the soles stay on the ground; the legs fold; the back drops by the fold', () => {
  const legTop = 0.3, keep = 0.16;
  assert.equal(lieY(0, legTop, keep), 0, 'soles on the ground');
  assert.ok(Math.abs(lieY(legTop, legTop, keep) - legTop * keep) < 1e-9, 'the belly line comes down to the folded legs');
  assert.ok(Math.abs(lieY(1, legTop, keep) - (1 - legTop * (1 - keep))) < 1e-9, 'the back drops by the fold');
  for (let y = 0; y < 1; y += 0.01) assert.ok(lieY(y + 0.01, legTop, keep) >= lieY(y, legTop, keep), 'never turns inside out');
});

test('lieDown lays a model down on its own copy, soles still at the ground', () => {
  // a 1 m "animal": a box standing on its soles at y = 0
  const geo = new THREE.BoxGeometry(0.4, 1, 1).translate(0, 0.5, 0);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
  const root = new THREE.Group();
  root.add(mesh);
  root.rotation.y = 0.7;
  const free = lieDown(root, LEG_SHARE.reekalf);
  const box = new THREE.Box3().setFromObject(root);
  assert.ok(Math.abs(box.min.y) < 1e-6, `soles on the ground (${box.min.y})`);
  assert.ok(Math.abs(box.max.y - (1 - LEG_SHARE.reekalf * (1 - 0.16))) < 1e-6, `lies lower (${box.max.y})`);
  assert.notEqual(mesh.geometry, geo, 'the shared geometry is never edited');
  geo.computeBoundingBox();
  assert.ok(Math.abs(geo.boundingBox!.max.y - 1) < 1e-9, 'the shared geometry still stands 1 m tall');
  assert.ok(root.userData.lying);
  free();
});

test('the fawn has spots, but not everywhere', () => {
  let n = 0;
  for (let x = 0; x < 20; x++) for (let z = 0; z < 20; z++) if (isSpot(x, z)) n++;
  assert.ok(n > 60 && n < 180, `${n}/400 cells are spots`);
});

test('the back, not the raised head: where a player finds a lying fawn', () => {
  // a body 1 m long, 0.3 m high, and a head block 0.6 m high at its front (+z) end
  const root = new THREE.Group();
  root.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 1, 2, 2, 6).translate(0, 0.15, 0)));
  root.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2).translate(0, 0.3, 0.45)));
  const p = backTop(root);
  assert.ok(p.y < 0.3 && p.y > 0.27, `on the back (${p.y}), never the head`);
  assert.ok(Math.abs(p.z) < 0.2, 'in the middle of the body');
});
