/**
 * Models.ts — load the optimized, DRACO-compressed GLBs (staged into
 * /models/ by scripts/gltf-optimize.mjs) into the 3D world. Meshy meshes arrive
 * in arbitrary scale/orientation, so prepModel() normalizes each to a target
 * height with its feet on the ground. Everything is cached + cloned, and every
 * call is best-effort: a missing model returns null so the world falls back to a
 * procedural stand-in (the game is always playable, even with zero assets).
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { assetUrl } from '../core/assets.ts';

const draco = new DRACOLoader().setDecoderPath(assetUrl('/draco/'));
const loader = new GLTFLoader().setDRACOLoader(draco);

export interface ModelEntry { file: string; category: string; bytes?: number; tris?: number; animated?: boolean }

/** A loaded model plus any baked animation clips (empty array = static mesh). */
export interface LoadedRig { group: THREE.Group; clips: THREE.AnimationClip[] }

let manifest: Record<string, ModelEntry> | null = null;
let manifestLoad: Promise<Record<string, ModelEntry>> | null = null;
const cache = new Map<string, GLTF>();
const loading = new Map<string, Promise<GLTF | null>>();

// How many fetches (the manifest, a GLB and its decode) are still on their way. The
// boot veil waits for this to reach zero (World.ready), so the first frame a player
// sees is never a stand-in waiting for its model.
let inFlight = 0;
export const loadsInFlight = (): number => inFlight;
async function counted<T>(work: () => Promise<T>): Promise<T> {
  inFlight++;
  try { return await work(); } finally { inFlight--; }
}
/** Count work that turns loaded models into the world (the forest's tree levels) as a
 *  load too: the world is not ready while it runs. */
export function whileLoading<T>(work: Promise<T>): Promise<T> {
  return counted(() => work);
}

export function loadManifest(): Promise<Record<string, ModelEntry>> {
  if (manifest) return Promise.resolve(manifest);
  if (!manifestLoad) draco.preload(); // the decoder downloads alongside the list, not after the first model
  manifestLoad ??= counted(async () => {
    try {
      const res = await fetch(assetUrl('/models/manifest.json'));
      manifest = res.ok ? await res.json() : {};
    } catch {
      manifest = {};
    }
    return manifest!;
  });
  return manifestLoad;
}

export function hasModel(id: string): boolean {
  return !!manifest && !!manifest[id];
}

/** Load (and cache) the full GLTF for an id: one fetch + decode per id, however many
 *  ask for it at once. null if absent or it fails to parse. */
async function loadGLTF(id: string): Promise<GLTF | null> {
  const hit = cache.get(id);
  if (hit) return hit;
  let pending = loading.get(id);
  if (!pending) {
    pending = counted(async () => {
      // with the manifest in hand (main.ts fetches it at boot) the fetch starts NOW, not
      // after the synchronous world build the loads are asked for in
      const e = (manifest ?? await loadManifest())[id];
      if (!e) return null;
      try {
        const gltf = await loader.loadAsync(assetUrl(`/models/${e.file}`));
        cache.set(id, gltf);
        return gltf;
      } catch {
        return null;
      } finally {
        loading.delete(id);
      }
    });
    loading.set(id, pending);
  }
  return pending;
}

/** Load (and cache) a model by id, returning a fresh clone. null if absent. */
export async function loadModel(id: string): Promise<THREE.Group | null> {
  const gltf = await loadGLTF(id);
  return gltf ? (cloneSkinned(gltf.scene) as THREE.Group) : null;
}

/**
 * Load a model with its animation clips — the "prefer animated GLB over
 * procedural" hook (BUILD-PLAN §8c #2). When an Anything World rig has been
 * staged for this id the GLB carries baked clips, and the caller drives an
 * AnimationMixer; otherwise `clips` is empty and the caller falls back to the
 * always-on ProceduralMotion. Uses SkeletonUtils.clone so skinned meshes keep a
 * working skeleton in the clone. null if the model is absent.
 */
export async function loadRig(id: string): Promise<LoadedRig | null> {
  const gltf = await loadGLTF(id);
  if (!gltf) return null;
  return { group: cloneSkinned(gltf.scene) as THREE.Group, clips: gltf.animations ?? [] };
}

/**
 * F-07: the world-space extent of a rig's SKELETON — the size that actually
 * renders. A skinned mesh is drawn by its bones, and on the ranger GLB the bones
 * are ~94× the mesh's own geometry units (mesh geometry ≈ 0.9, skeleton ≈ 85 in
 * armature-local space). `Box3.setFromObject` measures the bind-pose GEOMETRY
 * box, so it read 1.7 m for a skeleton that drove a ~170 m rendered giant — the
 * F-07 murk that filled the follow lens and was mis-graded "fixed" six times
 * (`avatar.height` = 1.7 was an F-18-class telemetry lie). Bone world positions
 * are pose-independent (they carry the scale, not the animation), so this reveals
 * the true render size at bind pose, on a detached clone, or live. Returns null
 * when `root` has no skinned mesh, so static props fall back to the geometry box.
 */
export function skinnedRenderBox(root: THREE.Object3D): THREE.Box3 | null {
  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  let found = false;
  root.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh || !mesh.skeleton) return;
    for (const bone of mesh.skeleton.bones) {
      box.expandByPoint(bone.getWorldPosition(v));
      found = true;
    }
  });
  return found && !box.isEmpty() ? box : null;
}

/**
 * Normalize a loaded group: scale so its tallest dimension ≈ targetHeight, and
 * drop it so its feet sit at y=0, centered on x/z. Returns the wrapper to place.
 */
export function prepModel(group: THREE.Group, targetHeight: number): THREE.Group {
  // F-07: a RIGGED GLB renders at the extent of its SKELETON, not its mesh
  // geometry — so measure the bones (`skinnedRenderBox`), never the bind-pose
  // `Box3.setFromObject` box, which read 1.7 m for a bone-driven ~170 m giant.
  // Static props have no skeleton → null → the plain geometry box (correct AND
  // pose-independent for them) keeps every non-rigged call site byte-identical.
  group.updateWorldMatrix(true, true);
  const skel = skinnedRenderBox(group);
  const box = skel ?? new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const tallest = Math.max(size.y, 0.0001);
  const scale = targetHeight / tallest;
  group.scale.setScalar(scale);

  // recompute after scaling (skeleton for a rig, geometry for a prop), then drop
  // the feet to y=0 and centre x/z off the SAME measure.
  group.updateWorldMatrix(true, true);
  const box2 = (skel && skinnedRenderBox(group)) || new THREE.Box3().setFromObject(group);
  const center = box2.getCenter(new THREE.Vector3());
  group.position.x -= center.x;
  group.position.z -= center.z;
  group.position.y -= box2.min.y;

  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) { mesh.castShadow = false; mesh.receiveShadow = false; }
  });

  const wrapper = new THREE.Group();
  wrapper.add(group);
  return wrapper;
}
