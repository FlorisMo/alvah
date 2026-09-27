/**
 * fade.test.ts — a far piece fades calmly out and rests, never fading another clone
 * of the same GLB. Run: `node --experimental-strip-types --test src/render3d/play/fade.test.ts`
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FarRest, FAR_FADE_S, restFar } from './fade.ts';

test('fading one marker animal never fades another clone that shares its material', () => {
  const shared = new THREE.MeshStandardMaterial();
  const a = new THREE.Group(); a.add(new THREE.Mesh(new THREE.BoxGeometry(), shared));
  const b = new THREE.Group(); b.add(new THREE.Mesh(new THREE.BoxGeometry(), shared));
  restFar(a, 0.5);
  const ma = (a.children[0] as THREE.Mesh).material as THREE.Material;
  assert.notEqual(ma, shared, 'a took its own copy');
  assert.equal(ma.opacity, 0.5);
  assert.ok(ma.transparent);
  assert.equal(shared.opacity, 1);
  assert.equal(shared.transparent, false);
  restFar(a, 0);
  assert.equal(a.visible, false, 'resting: not drawn');
  restFar(a, 1);
  assert.ok(a.visible && ma.opacity === 1 && !ma.transparent && ma.depthWrite, 'back exactly as it was');
});

test('FarRest: out beyond far, back within near, a calm fade between, a cut under reduced motion', () => {
  const r = new FarRest(50, 56);
  assert.equal(r.step(60, 0.016, false), 0, 'the first step is a cut (a piece loads far off: it simply rests)');
  assert.equal(r.step(53, 1, false), 0, 'between the edges it keeps resting');
  const half = r.step(40, FAR_FADE_S / 2, false);
  assert.ok(half > 0.4 && half < 0.6, 'fading in, not popping');
  assert.equal(r.step(40, FAR_FADE_S, false), 1);
  assert.equal(r.step(53, 5, false), 1, 'between the edges it stays drawn');
  assert.equal(r.step(70, 0.016, true), 0, 'reduced motion: a cut');
});
