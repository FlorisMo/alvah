/**
 * callers-glow.test.ts — a calling animal's light (beats/callers-glow.ts). Two ways a
 * replay once broke it (2026-10-01): a beat stopped mid-call left its rim on, the next
 * glow wrapped the material again, the shader declared the rim twice and the animal was
 * not drawn at all; and a glow that unwrapped the material when it ended let the next
 * one wrap it anew under the same program key — the renderer reuses the program it
 * compiled for that material and key without running the new wrapper, so the next glow's
 * rim never reached the shader (on a replay the roe lit up as a flat cream cut-out). So:
 * a material carries the rim's shader once, for good, and every glow drives the uniforms
 * its first compile bound. Run: `npm test`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { CALL_GLOW, WarmGlow, wearsRim } from './callers-glow.ts';

const FRAG = 'void main() {\n#include <emissivemap_fragment>\n}';

/** Build the material's shader the way the renderer does the first time it draws it: its
 *  onBeforeCompile on a fresh shader, and its program key. */
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
  const first = new WarmGlow(root);
  const drawn = compile(mat); // (the renderer's first compile: its uniforms are the ones it reads)
  first.set(CALL_GLOW); // (it calls — and the beat is stopped right there: never cleared)
  const wrapper = mat.onBeforeCompile;
  const second = new WarmGlow(root); // the next play's beat, on the same animal
  assert.equal(mat.onBeforeCompile, wrapper, 'not wrapped again');
  const s = compile(mat);
  assert.equal(count(s.frag, 'uniform float uCallRim;'), 1);
  assert.equal(count(s.frag, 'uniform vec3 uCallRimColor;'), 1);
  assert.equal(count(s.key, '|call-rim'), 1);
  // it begins at rest under the new glow (the old call's light is gone), and lights as before
  assert.equal(mat.emissiveIntensity, 1);
  assert.equal(mat.emissive.getHex(), 0);
  assert.equal(drawn.uniforms.uCallRim.value, 0);
  second.set(CALL_GLOW);
  assert.equal(drawn.uniforms.uCallRim.value, CALL_GLOW);
  assert.equal(mat.emissiveIntensity, CALL_GLOW);
  // the old glow can no longer touch it (its late light or clear changes nothing)
  first.set(0);
  first.clear();
  assert.equal(mat.emissiveIntensity, CALL_GLOW);
  assert.equal(drawn.uniforms.uCallRim.value, CALL_GLOW);
  // and the new one gives it its look at rest back
  second.clear();
  assert.equal(mat.emissive.getHex(), 0);
  assert.equal(mat.emissiveIntensity, 1);
  assert.equal(drawn.uniforms.uCallRim.value, 0);
});

test('a replay: after a glow ends, the next one lights the rim through the program the renderer already compiled', () => {
  const { root, mat } = animal();
  const meet = new WarmGlow(root); // (the neighbours' beat)
  const drawn = compile(mat);
  const key = drawn.key;
  meet.set(CALL_GLOW);
  meet.clear();
  assert.ok(wearsRim(mat), 'the rim stays in its shader, idle');
  assert.equal(drawn.uniforms.uCallRim.value, 0);
  const calls = new WarmGlow(root); // (the callers' beat, or the next play)
  // the renderer finds the same key, so it reuses its program and runs no wrapper: the
  // light must reach the uniforms that program was built with
  assert.equal(mat.customProgramCacheKey(), key);
  calls.set(CALL_GLOW, '#8fd6a0');
  assert.equal(drawn.uniforms.uCallRim.value, CALL_GLOW);
  assert.equal((drawn.uniforms.uCallRimColor.value as THREE.Color).getHexString(), new THREE.Color('#8fd6a0').getHexString());
  calls.clear();
  assert.equal(drawn.uniforms.uCallRim.value, 0);
});

test('a glow over a material that two meshes share wraps it once', () => {
  const mat = new THREE.MeshStandardMaterial();
  const root = new THREE.Group();
  root.add(new THREE.Mesh(new THREE.BoxGeometry(), mat), new THREE.Mesh(new THREE.BoxGeometry(), [mat, mat]));
  new WarmGlow(root).clear();
  assert.equal(count(compile(mat).frag, 'uniform float uCallRim;'), 1);
});

test('a textured part with no emissive of its own glows in its own colours, and looks as it did at rest', () => {
  const coat = new THREE.Texture();
  const mat = new THREE.MeshStandardMaterial({ map: coat, emissive: 0xcaa45a, emissiveIntensity: 0 });
  const root = new THREE.Group();
  root.add(new THREE.Mesh(new THREE.BoxGeometry(), mat));
  const g = new WarmGlow(root);
  g.set(CALL_GLOW);
  assert.equal(mat.emissiveMap, coat, 'lit: its coat, not one flat colour');
  g.clear();
  assert.equal(mat.emissiveIntensity, 0, 'at rest its emissive shows nothing');
  assert.equal(mat.emissive.getHex(), 0xcaa45a);
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
