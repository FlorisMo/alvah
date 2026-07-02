/**
 * AnimalDress.ts — the THREE-touching half of the coat/posture recipe (the pure
 * table lives in Coat.ts, like Eyes.ts ↔ EyeMaterial.ts). Both calls are
 * best-effort: a model with no tintable body material or no children is left
 * untouched and never throws — the game stays playable.
 */

import * as THREE from 'three';
import { coatTintFor, postureFor } from './Coat';

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

/**
 * Bias a head-low / snuffling species into a subtle nose-down stance. `wrapper` is
 * the group `prepModel` returns (feet at y=0, so pitching its child about X pivots
 * near the feet — nose dips, back lifts a hair). A no-op for upright species.
 * One-time transform (not motion), so reduced-motion does not apply.
 */
export function applyPosture(wrapper: THREE.Object3D, id: string | null): void {
  const { pitch } = postureFor(id);
  if (pitch <= 0) return;
  const inner = wrapper.children[0];
  if (inner) inner.rotation.x += pitch;
}
