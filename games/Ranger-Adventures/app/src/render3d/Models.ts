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
 * F-07: the world-space extent of a rig's SKELETON (its bone joints). Cheap (a few
 * dozen bones), so the per-frame reads use it for WHERE a rig is: the camera's
 * ranger centre, the pick hit-spheres. It is NOT how tall a rig is: the head above
 * the top joint and the soles under the lowest one are left out (every rig drew
 * 6-8 % taller than this box, run 6); `renderedBox` measures that. Returns null when
 * `root` has no skinned mesh.
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

const _v = new THREE.Vector3();

/**
 * The world-space box of what `root` DRAWS: every visible mesh, vertex by vertex, a
 * skinned mesh with its bones applied (three's `getVertexPosition` skins each vertex,
 * r184), a static mesh through its own transform. This is the size a screenshot shows,
 * head, hooves, ears, tail and antlers included; hidden parts (a hind's antlers) are
 * left out. Pose-dependent for a rig: measured on a fresh clone it is the bind pose
 * (the stag's idle clip lowers his head 20 %, so a clip pose is no stable size).
 * A few ms for a 22k-vertex rig, so it is for sizing and "how tall is it" reads, not
 * for every frame. Empty when nothing visible is drawn.
 */
export function renderedBox(root: THREE.Object3D, target = new THREE.Box3()): THREE.Box3 {
  // updateMatrixWorld, not updateWorldMatrix: only the former refreshes a skinned mesh's
  // bindMatrixInverse, and a stale one scales every skinned vertex by the old transform
  root.parent?.updateWorldMatrix(true, false);
  root.updateMatrixWorld(true);
  target.makeEmpty();
  root.traverseVisible((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || (mesh as unknown as THREE.InstancedMesh).isInstancedMesh) return;
    const pos = mesh.geometry?.getAttribute('position');
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) {
      mesh.getVertexPosition(i, _v).applyMatrix4(mesh.matrixWorld);
      target.expandByPoint(_v);
    }
  });
  return target;
}

/** A model's rendered height (m) as it stands now (`renderedBox`), or null when it
 *  draws nothing. The one "how tall is it" read: the dev hook's avatar() and actors(),
 *  the camera rails' head height, the title ranger. */
export function renderedHeight(root: THREE.Object3D): number | null {
  const h = renderedBox(root).getSize(_v).y;
  return Number.isFinite(h) && h > 0 ? h : null;
}

/**
 * Normalize a loaded group to `targetHeight` m of RENDERED height (`renderedBox`, so a
 * rig's head and soles count: sized by its bones it drew 6-8 % taller than asked and
 * stood 1.5-4 cm in the ground, run 6), its soles at y=0 and centred on x/z off the
 * same box. Height is the y extent: a tail, ears or antlers count when they rise above
 * the back. Returns the wrapper to place.
 */
export function prepModel(group: THREE.Group, targetHeight: number): THREE.Group {
  const box = renderedBox(group);
  const tall = box.max.y - box.min.y;
  if (tall > 1e-6) group.scale.multiplyScalar(targetHeight / tall);

  // measure again after scaling (exact whatever a rig's bind mode), then stand it on
  // its soles and centre x/z off the SAME measure
  const box2 = renderedBox(group);
  if (!box2.isEmpty()) {
    const center = box2.getCenter(new THREE.Vector3());
    group.position.x -= center.x;
    group.position.z -= center.z;
    group.position.y -= box2.min.y;
  }

  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) { mesh.castShadow = false; mesh.receiveShadow = false; }
  });

  const wrapper = new THREE.Group();
  wrapper.add(group);
  return wrapper;
}
