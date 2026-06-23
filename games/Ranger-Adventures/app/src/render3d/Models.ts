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

const draco = new DRACOLoader().setDecoderPath('/draco/');
const loader = new GLTFLoader().setDRACOLoader(draco);

export interface ModelEntry { file: string; category: string; bytes?: number; tris?: number; animated?: boolean }

/** A loaded model plus any baked animation clips (empty array = static mesh). */
export interface LoadedRig { group: THREE.Group; clips: THREE.AnimationClip[] }

let manifest: Record<string, ModelEntry> | null = null;
const cache = new Map<string, GLTF>();

export async function loadManifest(): Promise<Record<string, ModelEntry>> {
  if (manifest) return manifest;
  try {
    const res = await fetch('/models/manifest.json');
    manifest = res.ok ? await res.json() : {};
  } catch {
    manifest = {};
  }
  return manifest!;
}

export function hasModel(id: string): boolean {
  return !!manifest && !!manifest[id];
}

/** Load (and cache) the full GLTF for an id. null if absent or it fails to parse. */
async function loadGLTF(id: string): Promise<GLTF | null> {
  const m = await loadManifest();
  const e = m[id];
  if (!e) return null;
  if (!cache.has(id)) {
    try {
      cache.set(id, await loader.loadAsync(`/models/${e.file}`));
    } catch {
      return null;
    }
  }
  return cache.get(id)!;
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
 * Normalize a loaded group: scale so its tallest dimension ≈ targetHeight, and
 * drop it so its feet sit at y=0, centered on x/z. Returns the wrapper to place.
 */
export function prepModel(group: THREE.Group, targetHeight: number): THREE.Group {
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const tallest = Math.max(size.y, 0.0001);
  const scale = targetHeight / tallest;
  group.scale.setScalar(scale);

  // recompute after scaling, then recenter feet-on-ground
  const box2 = new THREE.Box3().setFromObject(group);
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
