/**
 * Lod.test.ts — a home's or the world's prop drawn as its simpler copy from afar (run 7 fix,
 * the triangle budget: `withFarCopy`): the copy is a fraction of the model's triangles, sits
 * where the model sits whatever the wrapper does, is never hit by a ray, and the switch
 * follows the lens with a little give, so it never flickers on its edge. A light prop keeps
 * no copy. Run: `npm test`.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { withFarCopy, PROP_DETAIL } from './Lod.ts';

/** A prop as `prepModel` hands it out: a wrapper round the model (a dense sphere, 1.2 m). */
function prop(segs: number): THREE.Group {
  const model = new THREE.Group();
  model.add(new THREE.Mesh(new THREE.SphereGeometry(0.6, segs, segs).translate(0, 0.6, 0), new THREE.MeshStandardMaterial()));
  const wrapper = new THREE.Group();
  wrapper.add(model);
  return wrapper;
}
const tris = (o: THREE.Object3D): number => {
  let n = 0;
  o.traverse((m) => { const g = (m as THREE.Mesh).isMesh ? (m as THREE.Mesh).geometry : null; if (g) n += (g.index ? g.index.count : g.attributes.position.count) / 3; });
  return n;
};
const camAt = (x: number, z: number): THREE.PerspectiveCamera => {
  const c = new THREE.PerspectiveCamera(55, 1.6, 0.1, 400);
  c.position.set(x, 1.5, z);
  c.updateMatrixWorld(true);
  return c;
};

test('a heavy prop gets a far copy of a fraction of its triangles; a light one none', () => {
  const heavy = prop(80); // ~12.6k triangles, like a stump GLB
  const before = tris(heavy);
  withFarCopy(heavy, 'test-heavy@1.2');
  const lod = heavy.children[0] as THREE.LOD;
  assert.equal(lod.name, 'prop-lod');
  const [real, copy] = lod.children;
  assert.equal(tris(real), before, 'the model itself unchanged');
  assert.ok(tris(copy) <= PROP_DETAIL.tris * 1.1 && tris(copy) < before / 8, `the copy is ${tris(copy)} triangles of ${before}`);
  const light = prop(12);
  withFarCopy(light, 'test-light@1.2');
  assert.notEqual(light.children[0].name, 'prop-lod', 'a light prop keeps no copy');
});

test('the switch follows the lens: the model near, the copy far, a little give on the edge', () => {
  const p = prop(80);
  withFarCopy(p, 'test-switch@1.2');
  p.position.set(10, 0, 10);
  p.updateMatrixWorld(true);
  const lod = p.children[0] as THREE.LOD;
  const [real, copy] = lod.children;
  const at = (d: number): [boolean, boolean] => { lod.update(camAt(10, 10 + d)); return [real.visible, copy.visible]; };
  assert.deepEqual(at(5), [true, false]);
  assert.deepEqual(at(PROP_DETAIL.far + 1), [false, true]);
  assert.deepEqual(at((PROP_DETAIL.near + PROP_DETAIL.far) / 2), [false, true], 'in between it keeps what it was');
  assert.deepEqual(at(PROP_DETAIL.near - 1), [true, false]);
  assert.deepEqual(at((PROP_DETAIL.near + PROP_DETAIL.far) / 2), [true, false]);
});

test('the copy sits where the model sits, and a ray hits the model only', () => {
  const p = prop(80);
  withFarCopy(p, 'test-ray@1.2');
  p.position.set(3, 0, -4);
  p.rotation.y = 1.1;
  p.updateMatrixWorld(true);
  const lod = p.children[0] as THREE.LOD;
  const [real, copy] = lod.children;
  const box = (o: THREE.Object3D): THREE.Box3 => new THREE.Box3().setFromObject(o);
  const a = box(real), b = box(copy);
  for (const k of ['x', 'y', 'z'] as const) {
    assert.ok(Math.abs(a.min[k] - b.min[k]) < 0.08 && Math.abs(a.max[k] - b.max[k]) < 0.08, `${k}: the copy ${b.min[k].toFixed(2)}..${b.max[k].toFixed(2)}, the model ${a.min[k].toFixed(2)}..${a.max[k].toFixed(2)}`);
  }
  const ray = new THREE.Raycaster(new THREE.Vector3(3, 0.6, 5), new THREE.Vector3(0, 0, -1));
  const hits = ray.intersectObject(p, true);
  assert.ok(hits.length > 0 && hits.every((h) => h.object.name !== 'prop-far'), 'only the model is hit');
});
