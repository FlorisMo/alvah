/**
 * patches.test.ts — a field of look-alike spots (patches.ts). Run 7: a field may rest as ONE
 * instanced draw (`instancedRest`): its mounds draw themselves only while a beat has woken
 * it (a pick, a glow, a play hint) and go back to the one draw once every spot is calm.
 * Run: `npm test`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { PatchField } from './patches.ts';

const spots = Array.from({ length: 7 }, (_, i) => ({ id: i, x: (i % 3) * 1.6, z: Math.floor(i / 3) * 1.6 }));
const make = (instancedRest?: boolean): { f: PatchField; parent: THREE.Group } => {
  const parent = new THREE.Group();
  return { f: new PatchField({ parent, groundY: () => 0, spots, size: 0.95, heading: 0, seed: 23, instancedRest }), parent };
};
const drawn = (f: PatchField): { mounds: number; rest: boolean } => ({
  mounds: f.mounds.filter((m) => m.visible).length,
  rest: f.group.children.some((c) => c.name === 'patch-rest' && c.visible),
});

test('a field at rest is one instanced draw, its mounds where each spot is', () => {
  const { f } = make(true);
  assert.deepEqual(drawn(f), { mounds: 0, rest: true });
  const rest = f.group.children.find((c) => c.name === 'patch-rest') as THREE.InstancedMesh;
  assert.equal(rest.count, spots.length);
  const m = new THREE.Matrix4();
  f.mounds.forEach((mound, i) => {
    rest.getMatrixAt(i, m); // (stored as 32-bit floats)
    assert.ok(m.elements.every((v, k) => Math.abs(v - mound.matrix.elements[k]) < 1e-5), `spot ${i} rests where its mound stands`);
  });
});

test('a beat wakes it (each mound its own mesh), and it rests again once every spot is calm', () => {
  const { f } = make(true);
  f.wake(true);
  assert.deepEqual(drawn(f), { mounds: 7, rest: false });
  f.show(2, true);
  f.update(0.1, false);
  f.wake(false);
  f.update(0.1, false);
  assert.deepEqual(drawn(f), { mounds: 7, rest: false }, 'a spot still glows: awake');
  f.clear();
  for (let i = 0; i < 40; i++) f.update(0.1, false);
  assert.deepEqual(drawn(f), { mounds: 0, rest: true }, 'calm again: one draw');
  // a spot lit without a wake (a careless beat) never lights the resting draw
  f.show(4, true);
  assert.deepEqual(drawn(f), { mounds: 7, rest: false });
});

test('without the option a field draws as before: every mound its own mesh, no resting draw', () => {
  const { f } = make();
  assert.deepEqual(drawn(f), { mounds: 7, rest: false });
  f.wake(false);
  for (let i = 0; i < 10; i++) f.update(0.1, false);
  assert.deepEqual(drawn(f), { mounds: 7, rest: false });
});
