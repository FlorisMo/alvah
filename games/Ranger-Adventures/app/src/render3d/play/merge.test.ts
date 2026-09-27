/**
 * merge.test.ts — a rigged animal split into flat-colour primitives becomes ONE
 * draw call that looks the same; the eyes and anything unusual stay apart.
 * Run: `node --experimental-strip-types --test src/render3d/play/merge.test.ts`
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { mergeColourSplits } from './merge.ts';

/** A GLTFLoader-shaped rig: one mesh node split into skinned primitives (one per
 *  colour) under a group, sharing its bones, plus an eye primitive with its own hook. */
function rig(colours: string[], opts: { roughness?: number[]; eye?: boolean; vc?: number } = {}) {
  const root = new THREE.Group();
  const hip = new THREE.Bone(); hip.name = 'hip';
  const head = new THREE.Bone(); head.name = 'head'; head.position.y = 1;
  hip.add(head);
  root.add(hip);
  const node = new THREE.Group(); node.name = 'Stag';
  root.add(node);
  const parts: THREE.SkinnedMesh[] = [];
  colours.forEach((c, i) => {
    const g = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    g.clearGroups(); // a glTF primitive: one material, no groups
    g.translate(i, 0.5, 0);
    const n = g.attributes.position.count;
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(n * 4).fill(0).map((_, k) => (k % 4 === 0 ? i % 2 : 0)), 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Array(n * 4).fill(0).map((_, k) => (k % 4 === 0 ? 1 : 0)), 4));
    // the roe deer's primitives carry a COLOR_0 (rgba) their material multiplies in
    if (opts.vc !== undefined) g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(n).fill(0).flatMap(() => [opts.vc!, opts.vc!, opts.vc!, 1]), 4));
    const m = new THREE.SkinnedMesh(g, new THREE.MeshStandardMaterial({ color: c, roughness: opts.roughness?.[i] ?? 0.4, metalness: 0.4, vertexColors: opts.vc !== undefined }));
    m.name = `Stag_${i}`;
    m.bind(new THREE.Skeleton([hip, head]));
    node.add(m);
    parts.push(m);
  });
  let eye: THREE.Mesh | null = null;
  if (opts.eye) {
    eye = new THREE.Mesh(new THREE.SphereGeometry(0.05), new THREE.MeshStandardMaterial({ map: new THREE.Texture() }));
    eye.name = 'Eye_White';
    eye.onBeforeRender = () => {};
    node.add(eye);
  }
  return { root, node, parts, hip, head, eye };
}

const meshes = (o: THREE.Object3D): THREE.Mesh[] => {
  const out: THREE.Mesh[] = [];
  o.traverse((x) => { if ((x as THREE.Mesh).isMesh) out.push(x as THREE.Mesh); });
  return out;
};

test('a stag split into five colours becomes one skinned mesh with its colours per vertex', () => {
  const colours = ['#614f3a', '#301c0d', '#110a05', '#07040a', '#020202'];
  const r = rig(colours, { eye: true });
  const verts = r.parts.reduce((n, p) => n + p.geometry.attributes.position.count, 0);
  const saved = mergeColourSplits(r.root);
  assert.equal(saved, 4);
  const ms = meshes(r.root);
  assert.equal(ms.length, 2, 'the body and the eye');
  const body = ms.find((m) => m !== r.eye) as THREE.SkinnedMesh;
  assert.ok(body.isSkinnedMesh);
  assert.deepEqual(body.skeleton.bones, [r.hip, r.head], 'driven by the same bones (the animation clips still move it)');
  const mat = body.material as THREE.MeshStandardMaterial;
  assert.ok(mat.vertexColors && mat.color.getHex() === 0xffffff && mat.roughness === 0.4 && mat.metalness === 0.4);
  const g = body.geometry;
  assert.equal(g.attributes.position.count, verts);
  assert.ok(g.attributes.skinIndex && g.attributes.skinWeight && g.attributes.normal);
  // every source vertex keeps its colour (the material colour, linear)
  let v = 0;
  r.parts.forEach((p) => {
    const c = (p.material as THREE.MeshStandardMaterial).color;
    for (let i = 0; i < p.geometry.attributes.position.count; i++, v++) {
      assert.ok(Math.abs(g.attributes.color.getX(v) - c.r) < 1e-6 && Math.abs(g.attributes.color.getZ(v) - c.b) < 1e-6);
      assert.ok(Math.abs(g.attributes.position.getX(v) - p.geometry.attributes.position.getX(i)) < 1e-6);
      assert.equal(g.attributes.skinIndex.getX(v), p.geometry.attributes.skinIndex.getX(i));
    }
  });
  assert.ok(ms.includes(r.eye!), 'the eye keeps its own shader');
});

test('a clone of the same model shares the merged geometry; a different coat does not', () => {
  const colours = ['#614f3a', '#301c0d', '#110a05'];
  const a = rig(colours), b = rig(colours);
  // b's parts share a's geometry, like SkeletonUtils clones of one cached GLB do
  b.parts.forEach((p, i) => { p.geometry = a.parts[i].geometry; });
  const c = rig(colours);
  c.parts.forEach((p, i) => { p.geometry = a.parts[i].geometry; });
  (c.parts[0].material as THREE.MeshStandardMaterial).color.set('#8a5a2a'); // a coat tint
  mergeColourSplits(a.root); mergeColourSplits(b.root); mergeColourSplits(c.root);
  const ga = meshes(a.root)[0].geometry, gb = meshes(b.root)[0].geometry, gc = meshes(c.root)[0].geometry;
  assert.equal(ga, gb);
  assert.notEqual(ga, gc);
});

test('parts that differ in more than colour stay apart; a lone part is untouched', () => {
  const r = rig(['#614f3a', '#301c0d', '#110a05'], { roughness: [0.4, 0.4, 0.9] });
  assert.equal(mergeColourSplits(r.root), 1);
  assert.equal(meshes(r.root).length, 2);
  const one = rig(['#614f3a']);
  const before = meshes(one.root)[0];
  assert.equal(mergeColourSplits(one.root), 0);
  assert.equal(meshes(one.root)[0], before);
});

test('a primitive with vertex colours of its own keeps them, times its material colour', () => {
  const r = rig(['#614f3a', '#301c0d'], { vc: 0.5 });
  const c0 = (r.parts[0].material as THREE.MeshStandardMaterial).color.clone();
  assert.equal(mergeColourSplits(r.root), 1);
  const g = meshes(r.root)[0].geometry;
  assert.equal(g.attributes.color.itemSize, 4);
  assert.ok(Math.abs(g.attributes.color.getX(0) - c0.r * 0.5) < 1e-6 && g.attributes.color.getW(0) === 1);
});
