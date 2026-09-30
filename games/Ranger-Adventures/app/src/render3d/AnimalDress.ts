/**
 * AnimalDress.ts — the THREE-touching half of the coat/posture recipe (the pure
 * table lives in Coat.ts, like Eyes.ts ↔ EyeMaterial.ts). Both calls are
 * best-effort: a model with no tintable body material or no children is left
 * untouched and never throws — the game stays playable.
 */

import * as THREE from 'three';
import { coatTintFor, postureFor, patternFor, coatCoords, type CoatPattern } from './Coat';

const EYE_NAME = /eye|oog|iris|cornea|pupil/i; // never retint the eyes (they own their material)

/**
 * Lerp a loaded model's body material colours toward its dossier coat tint. Skips
 * eye meshes and any material without a `.color`. Returns the count of materials
 * retinted (0 when the species has no correction — the common case). Idempotent-ish:
 * cloning the material per call keeps a re-dress from compounding the lerp.
 */
export function applyCoat(root: THREE.Object3D, id: string | null): number {
  const tint = coatTintFor(id);
  if (!tint) return 0;
  const target = new THREE.Color(tint.color);
  let n = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (EYE_NAME.test(mesh.name)) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mesh.material = mats.map((m) => {
      const src = m as THREE.Material & { color?: THREE.Color; name?: string };
      if (!src.color || EYE_NAME.test(src.name ?? '')) return m;
      const clone = src.clone() as THREE.Material & { color: THREE.Color };
      clone.color.copy(src.color).lerp(target, tint.strength);
      n++;
      return clone;
    }) as THREE.Material[] | THREE.Material;
    // unwrap a single-element array back to a lone material (three prefers this)
    if (Array.isArray(mesh.material) && mesh.material.length === 1) mesh.material = mesh.material[0];
  });
  return n;
}

const _box = new THREE.Box3();
const _at = new THREE.Vector3();

/**
 * Bias a head-low / snuffling species into a subtle nose-down stance. `wrapper` is
 * the group `prepModel` returns (feet at y=0, so pitching its child about X pivots
 * near the feet — nose dips, back lifts a hair). A no-op for upright species.
 * One-time transform (not motion), so reduced-motion does not apply.
 *
 * Tipped forward, the snout dips below the hooves prepModel stood on the ground, so
 * the posture stands the animal on its lowest point again (the posture species are
 * static meshes: the geometry, vertex by vertex, is what draws).
 */
export function applyPosture(wrapper: THREE.Object3D, id: string | null): void {
  const { pitch } = postureFor(id);
  if (pitch <= 0) return;
  const inner = wrapper.children[0];
  if (!inner) return;
  inner.rotation.x += pitch;
  wrapper.updateWorldMatrix(true, true);
  const low = _box.setFromObject(wrapper, true).min.y - wrapper.getWorldPosition(_at).y;
  if (Number.isFinite(low)) inner.position.y -= low;
}

/**
 * Run 6: paint a model's coat PATTERN (Coat.ts `patternFor`: the frisling's golden
 * lengthwise stripes) over its own texture. Each vertex carries its place on the body
 * (along it, up it, round it: a `coatUV` attribute, written once on the shared GLB
 * geometry, so a piglet laid down by play/pose.lieDown keeps its stripes where they
 * were), and the fragment shader draws the stripes crisply from it. The head keeps its
 * texture's own light and dark (the eyes, the ears), tinted brown. One extra shader
 * program for every striped piglet. A model without a pattern is left untouched.
 */
export function applyPattern(root: THREE.Object3D, id: string | null): number {
  const p = patternFor(id);
  if (!p) return 0;
  let n = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || EYE_NAME.test(mesh.name)) return;
    const geo = mesh.geometry;
    if (!geo.getAttribute('coatUV')) {
      geo.computeBoundingBox();
      const box = geo.boundingBox!;
      const pos = geo.getAttribute('position') as THREE.BufferAttribute;
      const uv = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const c = coatCoords(p, pos.getX(i), pos.getY(i), pos.getZ(i), box);
        uv[i * 3] = c.u; uv[i * 3 + 1] = c.vy; uv[i * 3 + 2] = c.a;
      }
      geo.setAttribute('coatUV', new THREE.BufferAttribute(uv, 3));
    }
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const mat = m as THREE.MeshStandardMaterial;
      if (!mat.isMeshStandardMaterial || mat.userData.coat) continue;
      mat.userData.coat = true;
      patternShader(mat, p);
      n++;
    }
  });
  return n;
}

function patternShader(mat: THREE.MeshStandardMaterial, p: CoatPattern): void {
  const col = (hex: string): THREE.Vector3 => { const c = new THREE.Color(hex); return new THREE.Vector3(c.r, c.g, c.b); };
  const uniforms = {
    coatBase: { value: col(p.base) }, coatStripe: { value: col(p.stripe) }, coatDark: { value: col(p.dark) },
    coatBelly: { value: col(p.belly) }, coatHead: { value: col(p.head) },
    coatShape: { value: new THREE.Vector4(p.perSide, p.duty, p.from, p.to) }, coatLegs: { value: p.legs },
  };
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 coatUV;\nvarying vec3 vCoat;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCoat = coatUV;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vCoat;
uniform vec3 coatBase; uniform vec3 coatStripe; uniform vec3 coatDark; uniform vec3 coatBelly; uniform vec3 coatHead;
uniform vec4 coatShape; uniform float coatLegs;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
{
  float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
  float u = vCoat.x, vy = vCoat.y, a = vCoat.z;
  float band = a / 2.25 * (coatShape.x + 0.5);
  float k = floor(band + 0.5);
  float d = abs(band - k);
  float aa = max(fwidth(band) * 0.8, 0.02);
  float stripe = (1.0 - smoothstep(coatShape.y * 0.5 - aa, coatShape.y * 0.5 + aa, d)) * step(0.5, k) * step(k, coatShape.x + 0.1);
  float body = smoothstep(coatShape.z - 0.03, coatShape.z + 0.03, u) * (1.0 - smoothstep(coatShape.w - 0.03, coatShape.w + 0.03, u));
  vec3 c = mix(coatBase, coatStripe, stripe * body);
  c = mix(c, coatBelly, smoothstep(2.15, 2.4, a));
  c *= 0.9 + 0.16 * lum;
  c = mix(c, coatHead * (0.35 + 0.95 * lum), smoothstep(coatShape.w + 0.01, coatShape.w + 0.07, u));
  c = mix(c, coatDark, 1.0 - smoothstep(coatLegs - 0.03, coatLegs + 0.03, vy));
  c = mix(c, coatDark, smoothstep(0.92, 0.95, u));
  diffuseColor.rgb = c;
}`);
  };
  mat.customProgramCacheKey = () => `coat-${p.kind}-${p.perSide}`;
  mat.needsUpdate = true;
}
