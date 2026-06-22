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

const draco = new DRACOLoader().setDecoderPath('/draco/');
const loader = new GLTFLoader().setDRACOLoader(draco);

export interface ModelEntry { file: string; category: string; bytes?: number; tris?: number }

let manifest: Record<string, ModelEntry> | null = null;
const cache = new Map<string, THREE.Group>();

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

/** Load (and cache) a model by id, returning a fresh clone. null if absent. */
export async function loadModel(id: string): Promise<THREE.Group | null> {
  const m = await loadManifest();
  const e = m[id];
  if (!e) return null;
  if (!cache.has(id)) {
    try {
      const gltf = await loader.loadAsync(`/models/${e.file}`);
      cache.set(id, gltf.scene);
    } catch {
      return null;
    }
  }
  return cache.get(id)!.clone(true);
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
