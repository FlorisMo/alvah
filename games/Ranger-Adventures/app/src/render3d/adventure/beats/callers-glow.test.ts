/**
 * callers-glow.test.ts — a calling animal's light (beats/callers-glow.ts). The rule a stop
 * once broke (2026-10-01, a stop in the eekhoorn callers): a material carries the rim's
 * shader ONCE, however many glows reach it — a glow that was never cleared (its beat
 * stopped mid-call) and a new one on the same animal must not wrap it twice, or the
 * shader declares the rim twice, fails to compile, and the animal is not drawn at all.
 * Run: `npm test`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { CALL_GLOW, WarmGlow, wearsRim } from './callers-glow.ts';

const FRAG = 'void main() {\n#include <emissivemap_fragment>\n}';

/** Build the material's shader the way the renderer does: its onBeforeCompile on a fresh
 *  shader, and its program key. */
function compile(mat: THREE.Material): { frag: string; key: string; uniforms: Record<string, { value: unknown }> } {
  const shader = { uniforms: {} as Record<string, { value: unknown }>, fragmentShader: FRAG, vertexShader: 'void main() {}' };
  mat.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
  return { frag: shader.fragmentShader, key: mat.customProgramCacheKey(), uniforms: shader.uniforms };
}
const count = (s: string, part: string): number => s.split(part).length - 1;

function animal(color: THREE.ColorRepresentation = 0xffffff): { root: THREE.Group; mat: THREE.MeshStandardMaterial } {
  const mat = new THREE.MeshStandardMaterial({ color });
  const root = new THREE.Group();
  root.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), mat));
  return { root, mat };
}

test('a glow on an animal a stopped beat left lit puts no second rim on it (the shader declares it once)', () => {
  const { root, mat } = animal();
  const ownCompile = mat.onBeforeCompile, ownKey = mat.customProgramCacheKey;
  const restKey = ownKey.call(mat);
  const first = new WarmGlow(root);
  first.set(CALL_GLOW); // (it calls — and the beat is stopped right there: never cleared)
  const second = new WarmGlow(root); // the next play's beat, on the same animal
  const s = compile(mat);
  assert.equal(count(s.frag, 'uniform float uCallRim;'), 1);
  assert.equal(count(s.frag, 'uniform vec3 uCallRimColor;'), 1);
  assert.equal(count(s.key, '|call-rim'), 1);
  // it begins dark under the new glow (the old call's light is gone), and lights as before
  assert.equal(mat.emissiveIntensity, 1);
  assert.equal(mat.emissive.getHex(), 0);
  assert.equal(s.uniforms.uCallRim.value, 0);
  second.set(CALL_GLOW);
  assert.equal(s.uniforms.uCallRim.value, CALL_GLOW);
  assert.equal(mat.emissiveIntensity, CALL_GLOW);
  // the old glow can no longer touch it (its late clear or light changes nothing)
  first.set(0);
  assert.equal(mat.emissiveIntensity, CALL_GLOW);
  first.clear();
  assert.ok(wearsRim(mat));
  // and the new one hands it back exactly as it was before any glow
  second.clear();
  assert.ok(!wearsRim(mat));
  assert.equal(mat.onBeforeCompile, ownCompile);
  assert.equal(mat.customProgramCacheKey, ownKey);
  assert.equal(mat.customProgramCacheKey(), restKey);
  assert.equal(mat.emissive.getHex(), 0);
  assert.equal(mat.emissiveIntensity, 1);
});

test('a glow over a material that two animals share wraps it once', () => {
  const mat = new THREE.MeshStandardMaterial();
  const root = new THREE.Group();
  root.add(new THREE.Mesh(new THREE.BoxGeometry(), mat), new THREE.Mesh(new THREE.BoxGeometry(), [mat, mat]));
  const g = new WarmGlow(root);
  assert.equal(count(compile(mat).frag, 'uniform float uCallRim;'), 1);
  g.clear();
  assert.ok(!wearsRim(mat));
});

test('lit, a black bird stays black (its rim does the work) and a light one keeps its warm light', () => {
  const raven = animal('#35343a'); // (the raven as the eekhoorn home darkens it)
  const jay = animal(0xffffff);
  const grey = animal(new THREE.Color().setRGB(0.5, 0.5, 0.5));
  for (const a of [raven, jay, grey]) new WarmGlow(a.root).set(1);
  const warm = new THREE.Color('#ffd98a');
  // (its own near-black in the warm light, lifted by a hair: a flat lift made it 0.15, a grey)
  const own = new THREE.Color('#35343a');
  assert.ok(raven.mat.emissive.r < own.r * warm.r + 0.006 && raven.mat.emissive.r < 0.05, `raven ${raven.mat.emissive.getHexString()}`);
  assert.ok(Math.abs(jay.mat.emissive.r - warm.r) < 1e-6 && Math.abs(jay.mat.emissive.b - warm.b) < 1e-6);
  // (a mid grey lifts half the touch: 0.5 → 0.53)
  assert.ok(Math.abs(grey.mat.emissive.r - 0.53 * warm.r) < 1e-6, `grey ${grey.mat.emissive.r / warm.r}`);
});
