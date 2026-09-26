/**
 * spawn.ts — the mini-games' access to the world's OWN cast and vegetation
 * (2026-09-26). A 3D mini-game stages the same GLB animals the world uses, dressed
 * the same way (`World.placeMarkers` / `placeAmbientLife`: eyes, coat tint, posture,
 * calm pose) at their canonical size (`AnimalScale`), instead of capsule stand-ins.
 *
 * Every spawn owns its materials (cloned from the cached GLB), so a game can glow a
 * stone or an animal without lighting the world's copies of the same model, and its
 * `dispose()` frees exactly what it created — the GLB itself stays cached in Models.
 * Best-effort like the rest of the asset layer: a missing model resolves null.
 */

import * as THREE from 'three';
import { loadModel, loadRig, prepModel } from '../Models';
import { standHeightFor } from '../AnimalScale';
import { applyEyes } from '../EyeMaterial';
import { applyCoat, applyPosture } from '../AnimalDress';
import { applyCalmPose } from '../CalmPoseRig';
import { livePolicy } from '../MotionMode';
import type { SpawnOpts, Spawned } from './types';

/** content animal id → the world's GLB manifest id: the ONE cast table (the mission
 *  markers, their finished tableaus and the mini-games all read it; birds follow the
 *  `bird-<id>` manifest convention). */
const ANIMAL_MODEL: Record<string, string> = {
  wildzwijn: 'animal-wildzwijn-boar',
  frisling: 'animal-frisling-piglet',
  big: 'animal-frisling-piglet',
  das: 'animal-das-badger',
  eekhoorn: 'animal-eekhoorn-squirrel',
  raaf: 'animal-raaf-raven',
  nachtzwaluw: 'animal-nachtzwaluw-nightjar',
  adder: 'animal-adder-snake',
  heikikker: 'animal-heikikker-frog',
  ree: 'animal-ree-roedeer',
  reekalf: 'animal-ree-roedeer',
  edelhert: 'animal-edelhert-reddeer',
  vos: 'animal-vos-fox',
  wolf: 'animal-wolf',
  heideblauwtje: 'animal-heideblauwtje-butterfly',
};

/** Stand heights (m) for what `AnimalScale` has no dossier size for: the young
 *  animals a mission is about, and the birds (standing height, beak to toe). The two
 *  length/wingspan creatures a child must still be able to SEE in a search game get a
 *  small floor (a 7 cm frog is ~10 px from the lens). */
const PLAY_HEIGHT: Record<string, number> = {
  reekalf: 0.62,
  'animal-raaf-raven': 0.4,
  'bird-koekoek': 0.24,
  'bird-merel': 0.2,
  'bird-roodborsttapuit': 0.15,
  'bird-groene-specht': 0.26,
  'bird-koolmees': 0.14,
  'bird-wilde-eend': 0.36,
  'animal-nachtzwaluw-nightjar': 0.17,
  'animal-heikikker-frog': 0.12,
  'animal-heideblauwtje-butterfly': 0.028,
};

/** The GLB id for a content animal id (or a manifest id passed straight through). */
export function modelFor(id: string): string {
  if (ANIMAL_MODEL[id]) return ANIMAL_MODEL[id];
  if (/^(animal|bird|prop|figure|ranger)-/.test(id)) return id;
  return `bird-${id}`;
}

/** The size (m) a game stages a content animal at: a young-animal/bird table first,
 *  then the world's canonical `AnimalScale` stand height, else a calm 0.5 m. */
export function heightFor(id: string): number {
  const glb = modelFor(id);
  return PLAY_HEIGHT[id] ?? PLAY_HEIGHT[glb] ?? standHeightFor(glb) ?? 0.5;
}

/** Give every mesh in `root` its own clone of its material(s); returns the clones. */
function ownMaterials(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((m) => m.clone())
      : mesh.material.clone();
  });
}

/** Every material in `root` (for dispose + glow). */
export function materialsOf(root: THREE.Object3D): THREE.Material[] {
  const out = new Set<THREE.Material>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) out.add(m);
  });
  return [...out];
}

function disposer(root: THREE.Object3D, extra: THREE.BufferGeometry[] = []): () => void {
  return () => {
    root.removeFromParent();
    for (const m of materialsOf(root)) {
      // applyEyes bakes a per-eye iris canvas texture — ours to free; GLB textures are shared
      const map = (m as THREE.MeshStandardMaterial).map as THREE.Texture | null | undefined;
      if (map && (map as THREE.CanvasTexture).isCanvasTexture) map.dispose();
      m.dispose();
    }
    for (const g of extra) g.dispose();
  };
}

/**
 * prepModel puts a RIGGED model's lowest BONE at y=0 (its size is read from the
 * skeleton, F-07), but hooves and paws reach a few cm below their last joint, so a
 * staged deer sank ~5 cm into the ground. Measure the posed skinned mesh itself and
 * lift the model onto its soles. The mission markers' animals (world/Markers.ts) stand
 * the same way.
 */
export function standOnSoles(wrapper: THREE.Group): void {
  wrapper.updateMatrixWorld(true);
  let minY = Infinity;
  let skinned = false;
  const box = new THREE.Box3();
  wrapper.traverse((o) => {
    const sk = o as THREE.SkinnedMesh;
    if (!sk.isSkinnedMesh) return;
    skinned = true;
    sk.computeBoundingBox();
    if (sk.boundingBox) minY = Math.min(minY, box.copy(sk.boundingBox).applyMatrix4(sk.matrixWorld).min.y);
  });
  // a static mesh: the calm posture (head low, AnimalDress) can tip its snout below
  // the hooves prepModel stood on the ground — stand it on its lowest point again
  if (!skinned) minY = box.setFromObject(wrapper).min.y;
  const inner = wrapper.children[0];
  if (inner && Number.isFinite(minY) && Math.abs(minY) < 0.3) inner.position.y -= minY;
}

/**
 * Load one of the world's animals, dressed exactly as the world dresses it, at its
 * canonical size (or `opts.height`). Animated rigs play their calm idle clip (frozen
 * on its first frame under reduced-motion). Resolves null when the model is absent.
 */
export async function spawnModel(id: string, opts: SpawnOpts = {}): Promise<Spawned | null> {
  const glb = modelFor(id);
  const rig = await loadRig(glb);
  if (!rig) return null;
  ownMaterials(rig.group);
  const prepped = prepModel(rig.group, opts.height ?? heightFor(id));
  applyEyes(prepped, glb, { dusk: false });
  applyCoat(prepped, glb);
  applyPosture(prepped, glb);
  applyCalmPose(prepped, glb);
  let mixer: THREE.AnimationMixer | null = null;
  let current: THREE.AnimationAction | null = null;
  const CLIP: Record<string, RegExp> = { idle: /idle|rest|stand|breath/i, walk: /walk/i, graze: /graze|eat/i };
  const play = (name: string): void => {
    if (!rig.clips.length) return;
    const clip = rig.clips.find((c) => CLIP[name]?.test(c.name)) ?? (name === 'idle' ? rig.clips[0] : null);
    if (!clip) return;
    mixer ??= new THREE.AnimationMixer(prepped);
    const next = mixer.clipAction(clip);
    if (next === current) return;
    next.reset().play();
    if (current) next.crossFadeFrom(current, 0.35, false);
    current = next;
  };
  if (opts.idle !== false && rig.clips.length) {
    play('idle');
    (mixer as THREE.AnimationMixer | null)?.update(0);
  }
  standOnSoles(prepped);
  return {
    root: prepped,
    update: (dt) => { if (mixer && !livePolicy().reduced) mixer.update(dt); },
    dispose: disposer(prepped),
    rigged: rig.clips.length > 0,
    clip: play,
  };
}

/* ---------------------------------------------------------------- plants ---- */

/** A soft grass tuft: `blades` thin tapered blades fanned around the centre, dark
 *  green at the root to straw at the tip (vertex colours), both faces lit. Built once
 *  per call; shared by instancing in `grassField`. Height 1 m (scale to taste). */
export function grassTuftGeometry(blades = 16, seed = 1): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const root = new THREE.Color('#4f6a2c');
  const tip = new THREE.Color('#c9b46a');
  let s = seed >>> 0;
  const rnd = (): number => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2 + rnd() * 0.6;
    const r0 = 0.05 + rnd() * 0.06;                // root offset from the tuft centre
    const h = 0.65 + rnd() * 0.35;                  // blade height (of 1 m)
    const lean = 0.18 + rnd() * 0.3;                // outward lean at the tip
    const w = 0.035 + rnd() * 0.02;                 // half-width at the root
    const cx = Math.cos(a), cz = Math.sin(a);
    const px = -cz, pz = cx;                        // across the blade
    const bx = cx * r0, bz = cz * r0;
    const tx = cx * (r0 + lean), tz = cz * (r0 + lean);
    // two triangles: root-left, root-right, tip (+ a mid pair for a gentle bend)
    const mx = cx * (r0 + lean * 0.35), mz = cz * (r0 + lean * 0.35);
    const quad = [
      [bx - px * w, 0, bz - pz * w], [bx + px * w, 0, bz + pz * w], [mx + px * w * 0.7, h * 0.5, mz + pz * w * 0.7],
      [bx - px * w, 0, bz - pz * w], [mx + px * w * 0.7, h * 0.5, mz + pz * w * 0.7], [mx - px * w * 0.7, h * 0.5, mz - pz * w * 0.7],
      [mx - px * w * 0.7, h * 0.5, mz - pz * w * 0.7], [mx + px * w * 0.7, h * 0.5, mz + pz * w * 0.7], [tx, h, tz],
    ];
    const ys = [0, 0, 0.5, 0, 0.5, 0.5, 0.5, 0.5, 1];
    quad.forEach((v, k) => {
      pos.push(v[0], v[1], v[2]);
      const c = root.clone().lerp(tip, ys[k]);
      col.push(c.r, c.g, c.b);
    });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/** The warm, matte, double-sided material every grass tuft shares. */
export function grassMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide });
}

/**
 * Load a vegetation piece at `height` m: a world GLB prop (`prop-bramble`,
 * `prop-fern`, `prop-juniper-bush`, `prop-heather-winter`, `prop-foxglove`,
 * `prop-reeds` …) or `gras` for one procedural grass tuft. Null when missing.
 */
export async function spawnPlant(id: string, height: number): Promise<Spawned | null> {
  if (id === 'gras') {
    const geo = grassTuftGeometry(16, Math.floor(height * 1000));
    const mesh = new THREE.Mesh(geo, grassMaterial());
    mesh.scale.setScalar(height);
    const root = new THREE.Group();
    root.add(mesh);
    return { root, update: () => {}, dispose: disposer(root, [geo]) };
  }
  const m = await loadModel(id);
  if (!m) return null;
  ownMaterials(m);
  const prepped = prepModel(m, height);
  return { root: prepped, update: () => {}, dispose: disposer(prepped), rigged: false };
}
