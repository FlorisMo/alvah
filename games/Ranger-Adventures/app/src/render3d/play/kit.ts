/**
 * kit.ts — the shared 3D interaction kit every diegetic engine view reuses
 * (3D-IMMERSION-PLAN §2). Built once here so the five variants don't each
 * re-solve picking / highlighting / prompts / trails / camera reframes. The
 * pure maths lives in `kit-math.ts` (unit-tested, THREE-free); this module wraps
 * it with the live THREE objects + the accessible DOM overlay.
 *
 * Frozen guarantees:
 *  - **pick3d** raycasts against generous invisible hit-spheres sized so every
 *    target projects to ≥56px (a11y floor) regardless of distance.
 *  - **Glow** lights a model (its own materials) in a warm emissive colour; the
 *    games pair it with a small lift/scale so feedback is dual-channel, and hold it
 *    steady under reduced-motion (motion-comfort §1e).
 *  - **anchoredPrompt** keeps ALL words/choices/read-aloud in the existing
 *    accessible DOM card — 3D supplies the scene, the DOM supplies the text, so
 *    the text-only path stays fully playable.
 *  - **reframe** is one eased camera move (position + aim on one curve), or a hard
 *    cut under reduced-motion.
 */

import * as THREE from 'three';
import { aimDir, easeInOut, lerpAngle, reframeSeconds, tapHitRadius, trailPoints, yawPitch } from './kit-math';
import { skinnedRenderBox } from '../Models';
import { icon } from '../../ui/icons';
import { ALGEMEEN } from '../../content/copy';

/* ------------------------------------------------------ test win channel ---- */

/**
 * A dev-only "win the current step" channel (W2.3). The mission-chain E2E can't
 * pixel-accurately raycast the 3D pick surfaces in headless SwiftShader (that
 * correctness is covered by the per-engine parity tests), so each running 3D
 * variant registers a `win` closure that drives its OWN genuine success path —
 * real scoring, real `BeatSummary`, real teardown, real persistence. The devhook
 * exposes it as `__ranger.winStep()`; nothing in production reads it (the hook
 * object only exists under DEV / `?dev=1`). Registration is a single closure
 * assignment, so it costs nothing when unused; `Missions` clears it after every
 * step so no closure outlives its activity.
 */
let activeWin: (() => void) | null = null;

/** A running 3D variant registers its genuine success path. Returns an unregister. */
export function registerActivityWin(fn: () => void): () => void {
  activeWin = fn;
  return () => { if (activeWin === fn) activeWin = null; };
}

/** Drop any registered win (called by the mission runner after each step). */
export function clearActivityWin(): void {
  activeWin = null;
}

/** Fire the registered win, if any. Returns whether one was pending. */
export function triggerActivityWin(): boolean {
  const fn = activeWin;
  if (!fn) return false;
  activeWin = null; // one-shot: the step resolves and the next activity re-registers
  fn();
  return true;
}

/* ------------------------------------------------------- test play hint ---- */

/**
 * Where a perfect player would click NEXT (golden-path E2E, 2026-09-26). Unlike
 * the win channel above, a hint resolves nothing: the test still has to press the
 * real mouse on that spot, so picking, occlusion and the staged scene are proven
 * along with the step. A running 3D variant registers a closure that returns the
 * object a player should click now (its visible mesh or group), or null while it
 * takes no input (e.g. a sequence is still being shown). Games answered with DOM
 * buttons return null; the test clicks the button by its text. Dev-only: read via
 * `__ranger.playHint()`, which projects `target` to screen coordinates.
 */
export interface PlayHint {
  /** Stable id of the thing to click (e.g. the animal or stone id). */
  id: string;
  /** The object a player sees and clicks. (Run 6: `target.userData.perch` = how high, m,
   *  above the ground its perch holds it — a squirrel on its stump, a jay on its branch;
   *  the probe checks it sits on that.) */
  target?: THREE.Object3D;
  /** Run 6 (the adventures): a perfect player WALKS there now, with the arrow keys or
   *  the stick, until he is within `r` m (world x/z). No `target`: nothing to click.
   *  Run 7 (words-ree, additive) `back`: a small step BACK, facing what he steps away
   *  from (the calf tottering toward him): a player holds ↓ and backs up there. */
  walk?: { x: number; z: number; r: number; back?: boolean };
}

let activeHint: (() => PlayHint | null) | null = null;

/** A running 3D variant registers its "click here next" closure. Returns an unregister. */
export function registerPlayHint(fn: () => PlayHint | null): () => void {
  activeHint = fn;
  return () => { if (activeHint === fn) activeHint = null; };
}

/** Drop any registered hint (the mission runner clears it after each step). */
export function clearPlayHint(): void {
  activeHint = null;
}

/** The current hint, if a variant registered one and is taking input. */
export function currentPlayHint(): PlayHint | null {
  return activeHint ? activeHint() : null;
}

/*
 * The golden-path probes behind `__ranger.playHint()/groundAt()/screenOf()/seating()`
 * (devhook.ts documents each). They measure what the player SEES: the scene + camera
 * the Stage rendered this frame (main.ts registers that view), the terrain mesh a
 * down-ray meets, and the first opaque surface on a camera ray. Read-only; registered
 * once below, only ever called by a test through the dev hook.
 */

// (imported here, not at the top, so this test section stays one self-contained block)
import { provideGoldenProbes, renderView, selfMovers, type PlayHintProbe, type SeatProbe } from '../../core/devhook';

type LiveView = { scene: THREE.Scene; camera: THREE.PerspectiveCamera; canvas: HTMLCanvasElement };

function liveView(): LiveView | null {
  const v = renderView() as { scene?: THREE.Scene; camera?: THREE.PerspectiveCamera } | null;
  const canvas = document.getElementById('scene') as HTMLCanvasElement | null;
  if (!v || !v.scene?.isScene || !v.camera || !canvas) return null;
  return { scene: v.scene, camera: v.camera, canvas };
}

function shownInTree(o: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

/** Would this ray hit hide what lies behind it from the player? Pick hit-spheres,
 *  hidden objects, invisible / colour-less materials and non-depth-writing (or
 *  nearly clear) transparent overlays such as the cloud shade or contact shadows
 *  do not. */
function occludes(hit: THREE.Intersection): boolean {
  const o = hit.object as THREE.Mesh;
  if (!o.isMesh || o.userData.hitSphere || !shownInTree(o)) return false;
  const mat = (Array.isArray(o.material) ? o.material[hit.face?.materialIndex ?? 0] : o.material) as THREE.Material | undefined;
  if (!mat || !mat.visible || mat.colorWrite === false) return false;
  return !(mat.transparent && (!mat.depthWrite || mat.opacity < 0.35));
}

const probeRay = new THREE.Raycaster();
const probeBox = new THREE.Box3();
const DOWN = new THREE.Vector3(0, -1, 0);
let terrainCache: { scene: THREE.Scene; n: number; meshes: THREE.Object3D[] } | null = null;

/** The meshes that ARE the ground: wide (≥ 40 m both ways), with relief, not instanced. */
function terrainMeshes(scene: THREE.Scene): THREE.Object3D[] {
  if (terrainCache && terrainCache.scene === scene && terrainCache.n === scene.children.length) return terrainCache.meshes;
  const meshes: THREE.Object3D[] = [];
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh || (m as THREE.SkinnedMesh).isSkinnedMesh) return;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    const b = probeBox.copy(m.geometry.boundingBox!).applyMatrix4(m.matrixWorld);
    if (b.max.x - b.min.x >= 40 && b.max.z - b.min.z >= 40 && b.max.y - b.min.y > 0.05) meshes.push(m);
  });
  terrainCache = { scene, n: scene.children.length, meshes };
  return meshes;
}

function groundUnder(scene: THREE.Scene, x: number, z: number): number | null {
  probeRay.set(new THREE.Vector3(x, 200, z), DOWN);
  probeRay.far = 400;
  const hit = probeRay.intersectObjects(terrainMeshes(scene), false).find(occludes);
  return hit ? hit.point.y : null;
}

/** World box of the VISIBLE meshes under `root` (hit-spheres and hidden parts left out). */
function seenBox(root: THREE.Object3D, out: THREE.Box3): THREE.Box3 {
  out.makeEmpty();
  const part = new THREE.Box3();
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.userData.hitSphere || !shownInTree(m)) return;
    const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.Material | undefined;
    if (!mat || !mat.visible) return;
    // a see-through overlay that writes no depth (a halo ring or a blob / contact
    // shadow draped over the ground) is not a thing that STANDS there: on a slope its
    // downhill rim lies below the ground at its centre by construction
    if (mat.transparent && !mat.depthWrite) return;
    const sk = m as THREE.SkinnedMesh;
    if (sk.isSkinnedMesh || (m as THREE.InstancedMesh).isInstancedMesh) {
      (m as THREE.SkinnedMesh).computeBoundingBox();
      part.copy((m as THREE.SkinnedMesh).boundingBox!);
    } else if (tipped(m)) {
      // a part tipped over (a sow rooting nose-down): its box, tipped with it, reaches
      // below the ground at a corner no vertex is near, so its own vertices are measured
      const pos = m.geometry.attributes.position;
      part.makeEmpty();
      for (let i = 0; i < pos.count; i++) part.expandByPoint(seenV.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld));
      out.union(part);
      return;
    } else {
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      part.copy(m.geometry.boundingBox!);
    }
    out.union(part.applyMatrix4(m.matrixWorld));
  });
  return out;
}
const seenV = new THREE.Vector3();

/** Its up axis leans off the world's up (more than ~0.5°): tipped, not only turned. */
function tipped(m: THREE.Object3D): boolean {
  const e = m.matrixWorld.elements;
  return e[5] / Math.hypot(e[4], e[5], e[6]) < 0.99996;
}

function toScreen(v: LiveView, p: THREE.Vector3): { x: number; y: number; onScreen: boolean; ndc: THREE.Vector3 } {
  const ndc = p.clone().project(v.camera);
  const r = v.canvas.getBoundingClientRect();
  return {
    x: r.left + ((ndc.x + 1) / 2) * r.width,
    y: r.top + ((1 - ndc.y) / 2) * r.height,
    onScreen: Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && ndc.z > -1 && ndc.z < 1,
    ndc,
  };
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

/** A readable name for a scene object: its own/ancestor name or geometry, plus where it stands. */
function describeObject(o: THREE.Object3D, scene: THREE.Scene): string {
  if (terrainMeshes(scene).includes(o)) return 'terrain';
  let top = o;
  while (top.parent && top.parent !== scene) top = top.parent;
  const self = o.name || (o as THREE.Mesh).geometry?.type || o.type;
  const w = o.getWorldPosition(new THREE.Vector3());
  const at = `(${r2(w.x)}, ${r2(w.y)}, ${r2(w.z)})`;
  return top === o ? `${self}@${at}` : `${self}@${at} in ${top.name || top.type}`;
}

function describeElement(el: Element): string {
  const cls = typeof el.className === 'string' && el.className ? `.${el.className.trim().split(/\s+/).join('.')}` : '';
  const text = (el as HTMLElement).innerText?.trim().slice(0, 40);
  return `${el.tagName.toLowerCase()}${cls}${text ? ` "${text}"` : ''}`;
}

/** The geometry types the visible meshes under `root` are drawn with (unique, sorted). */
function drawnWith(root: THREE.Object3D): string[] {
  const types = new Set<string>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.userData.hitSphere || !shownInTree(m)) return;
    const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.Material | undefined;
    if (mat?.visible) types.add(m.geometry.type);
  });
  return [...types].sort();
}

function probePlayHint(): PlayHintProbe | null {
  const hint = currentPlayHint();
  if (!hint) return null;
  if (hint.walk || !hint.target) {
    // a walk hint: nothing to click, a place to walk to (golden walks it with the keys)
    return { id: hint.id, x: -1, y: -1, onScreen: false, firstHit: false, aboveGround: false,
      firstHitBy: null, bottomGap: null, reachesCanvas: false, blocker: null, parts: [], walk: hint.walk ?? null };
  }
  const v = liveView();
  let root = hint.target;
  while (root.parent) root = root.parent;
  if (v && root !== v.scene) return null; // not in the rendered scene (a finished step's stale hint): nothing to click
  // The target is the visible thing itself (click its box centre), or an invisible anchor
  // parked on it (a hintAnchor-style marker: click the anchor, judge the thing it sits on).
  let body: THREE.Object3D | null = hint.target;
  const box = seenBox(hint.target, new THREE.Box3());
  const at = new THREE.Vector3();
  if (box.isEmpty()) {
    body = hint.target.parent;
    if (body && body !== v?.scene) seenBox(body, box);
    hint.target.getWorldPosition(at);
  } else box.getCenter(at);
  if (!v || !body || box.isEmpty()) {
    return { id: hint.id, x: -1, y: -1, onScreen: false, firstHit: false, aboveGround: false,
      firstHitBy: v ? 'target has no visible mesh' : 'no live world view', bottomGap: null, reachesCanvas: false, blocker: null, parts: [] };
  }
  const s = toScreen(v, at);
  probeRay.setFromCamera(new THREE.Vector2(s.ndc.x, s.ndc.y), v.camera);
  probeRay.far = Infinity;
  probeRay.layers.mask = v.camera.layers.mask;
  const first = probeRay.intersectObject(v.scene, true).find(occludes);
  let firstHit = false;
  for (let p: THREE.Object3D | null = first?.object ?? null; p; p = p.parent) if (p === body) { firstHit = true; break; }
  const c = box.getCenter(new THREE.Vector3());
  const g = groundUnder(v.scene, c.x, c.z);
  const el = s.onScreen ? document.elementFromPoint(s.x, s.y) : null;
  // (run 6) an animal on a perch (a squirrel on its stump, a jay on its branch) says how
  // high above the ground its perch holds it: it must sit ON that, not float or sink
  const perch = (hint.target.userData.perch as number | undefined) ?? 0;
  return {
    id: hint.id, x: r2(s.x), y: r2(s.y), onScreen: s.onScreen, firstHit,
    aboveGround: g !== null && box.max.y > g + 0.01,
    firstHitBy: first ? (firstHit ? hint.id : describeObject(first.object, v.scene)) : 'nothing',
    bottomGap: g === null ? null : r2(box.min.y - g - perch),
    reachesCanvas: el === v.canvas,
    blocker: el && el !== v.canvas ? describeElement(el) : null,
    parts: drawnWith(body),
  };
}

/** A short "what it looks like" signature, so a before/after compare sees a change. */
function lookSig(root: THREE.Object3D): string {
  const parts: string[] = [];
  root.traverse((o) => {
    if (!shownInTree(o) || o.userData.hitSphere) return;
    const m = o as THREE.Mesh;
    if (!m.isMesh && !(o as THREE.Sprite).isSprite) return;
    const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial | undefined;
    const img = mat?.map?.image as { width?: number; src?: string } | undefined;
    parts.push(`${m.geometry?.type ?? o.type}:${m.geometry?.attributes?.position?.count ?? 0}:${mat?.color?.getHexString() ?? ''}:${img?.src?.slice(-24) ?? img?.width ?? ''}`);
  });
  return parts.sort().join('|');
}

type Placed = { o: THREE.Object3D; box: THREE.Box3; moves?: 'player' | 'ambient' };

/** Every placed thing whose footprint centre lies within r of (x,z): models, props and
 *  staged pieces (a container at the origin is looked through), plus instanced copies
 *  (reported one by one through `onInstance`, with the world box of that copy). Hidden
 *  things and the terrain are skipped. A thing that moves by itself is tagged `moves`:
 *  the group standing EXACTLY where the world reports the walking player ('player')
 *  or an ambient creature ('ambient') — devhook `selfMovers()`. */
function placedThings(v: LiveView, x: number, z: number, r: number,
  onInstance?: (label: string, i: number, box: THREE.Box3) => void): Placed[] {
  const out: Placed[] = [];
  const terrain = terrainMeshes(v.scene);
  const c = new THREE.Vector3();
  const m4 = new THREE.Matrix4();
  const movers = selfMovers();
  const wp = new THREE.Vector3();
  const moverOf = (o: THREE.Object3D): Placed['moves'] => {
    if (!(o as THREE.Group).isGroup || !o.children.length) return undefined;
    o.updateWorldMatrix(true, false);
    o.getWorldPosition(wp);
    const here = (p: { x: number; z: number }): boolean => p.x === wp.x && p.z === wp.z;
    if (movers.player && here(movers.player)) return 'player';
    return movers.ambient.some(here) ? 'ambient' : undefined;
  };
  const visit = (o: THREE.Object3D): void => {
    if (!o.visible || o.userData.hitSphere || terrain.includes(o)) return;
    if ((o as THREE.Light).isLight || (o as THREE.Camera).isCamera || (o as THREE.Points).isPoints
      || (o as THREE.Line).isLine || (o as THREE.Sprite).isSprite) return;
    if (o === v.scene) { o.children.forEach(visit); return; }
    const inst = o as THREE.InstancedMesh;
    if (inst.isInstancedMesh) {
      if (!onInstance) return;
      if (!inst.geometry.boundingBox) inst.geometry.computeBoundingBox();
      // (run 7, additive: a plant the breeze sways says where it is planted — its seat is
      // that, not this frame's lean; without the hook, the instance as drawn, as before)
      const rest = inst.userData.restMatrixAt as ((i: number, out: THREE.Matrix4) => THREE.Matrix4) | undefined;
      for (let i = 0; i < inst.count; i++) {
        if (rest) rest(i, m4); else inst.getMatrixAt(i, m4);
        m4.premultiply(inst.matrixWorld);
        c.setFromMatrixPosition(m4);
        if (Math.hypot(c.x - x, c.z - z) <= r) onInstance(o.name || inst.geometry.type, i, inst.geometry.boundingBox!.clone().applyMatrix4(m4));
      }
      return;
    }
    // a pure container (at the origin, unrotated): what it holds is what is placed
    if (o.children.length && !(o as THREE.Mesh).isMesh && o.position.lengthSq() < 1e-6 && o.quaternion.w > 0.99999) {
      o.children.forEach(visit);
      return;
    }
    const moves = moverOf(o);
    const box = seenBox(o, new THREE.Box3());
    if (box.isEmpty()) return;
    box.getCenter(c);
    const size = box.getSize(new THREE.Vector3());
    if (size.x > 12 || size.z > 12 || Math.hypot(c.x - x, c.z - z) > r) return;
    out.push(moves ? { o, box, moves } : { o, box });
  };
  visit(v.scene);
  return out;
}

function probeSeating(x: number, z: number, r: number): SeatProbe[] | null {
  const v = liveView();
  if (!v) return null;
  const out: SeatProbe[] = [];
  const at = new THREE.Vector3();
  const onInstance = (label: string, i: number, box: THREE.Box3): void => {
    box.getCenter(at);
    const g = groundUnder(v.scene, at.x, at.z);
    if (g === null || box.min.y - g > 3) return;
    out.push({ id: `${label}#${i}`, x: r2(at.x), y: r2(box.min.y), z: r2(at.z), gap: r2(box.min.y - g), sig: `${label}#${i}` });
  };
  const c = new THREE.Vector3();
  for (const { o, box, moves } of placedThings(v, x, z, r, onInstance)) {
    box.getCenter(c);
    const g = groundUnder(v.scene, c.x, c.z);
    if (g === null || box.min.y - g > 3) continue; // flying (a bird, a cloud): not a prop
    // (run 7, additive: a thing up a tree — a squirrel's nest — says how high above the
    // ground its tree holds it, `userData.perch`, as a hint's target does: it must sit on that)
    const perch = (o.userData.perch as number | undefined) ?? 0;
    const seat: SeatProbe = { id: describeObject(o, v.scene), x: r2(c.x), y: r2(box.min.y), z: r2(c.z), gap: r2(box.min.y - g - perch), sig: lookSig(o) };
    out.push(moves ? { ...seat, moves } : seat);
  }
  return out.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
}

/** The biggest placed thing within 2.5 m of (x,z), measured along a world direction and
 *  across it (from its vertices): a jeep that drives along (dx,dz) is long `along`. */
function probeShapeAt(x: number, z: number, dx: number, dz: number): { id: string; along: number; across: number } | null {
  const v = liveView();
  const len = Math.hypot(dx, dz);
  if (!v || len < 1e-6) return null;
  const ux = dx / len; const uz = dz / len;
  // biggest first; a thing drawn only as instances (a wheel-track trail, a plant patch)
  // has no single shape to measure, so the next biggest is the one (run 6: it made the
  // jeep's shape read null wherever the drive ended beside one)
  const things = placedThings(v, x, z, 2.5).filter((p) => p.moves !== 'player') // the ranger standing by it is not the thing
    .map((p) => ({ p, area: (p.box.max.x - p.box.min.x) * (p.box.max.z - p.box.min.z) }))
    .sort((a, b) => b.area - a.area);
  const at = new THREE.Vector3();
  for (const { p: best } of things) {
    let a0 = Infinity; let a1 = -Infinity; let c0 = Infinity; let c1 = -Infinity;
    best.o.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || m.userData.hitSphere || !shownInTree(m) || (m as THREE.InstancedMesh).isInstancedMesh) return;
      const pos = m.geometry.attributes.position;
      if (!pos) return;
      const stride = Math.max(1, Math.floor(pos.count / 4000));
      for (let i = 0; i < pos.count; i += stride) {
        at.fromBufferAttribute(pos, i);
        if ((m as THREE.SkinnedMesh).isSkinnedMesh) (m as THREE.SkinnedMesh).applyBoneTransform(i, at);
        at.applyMatrix4(m.matrixWorld);
        const a = at.x * ux + at.z * uz; const c = -at.x * uz + at.z * ux;
        a0 = Math.min(a0, a); a1 = Math.max(a1, a); c0 = Math.min(c0, c); c1 = Math.max(c1, c);
      }
    });
    if (Number.isFinite(a0)) return { id: describeObject(best.o, v.scene), along: r2(a1 - a0), across: r2(c1 - c0) };
  }
  return null;
}

provideGoldenProbes({
  playHint: probePlayHint,
  groundAt: (x, z) => { const v = liveView(); return v ? groundUnder(v.scene, x, z) : null; },
  screenOf: (x, y, z) => {
    const v = liveView();
    if (!v) return null;
    const s = toScreen(v, new THREE.Vector3(x, y, z));
    return { x: r2(s.x), y: r2(s.y), onScreen: s.onScreen };
  },
  seating: probeSeating,
  shapeAt: probeShapeAt,
});

/* --------------------------------------------------- activity abort scope ---- */

/**
 * Cancellation for one in-flight mission step (RUN-3 P3.2 · F-26 "Stop de
 * missie"). The mission runner opens a fresh scope before each step. A running
 * game reads the signal ONCE when it starts (`Stage.signal`) and binds everything
 * to that one: `pick3d`'s canvas listener, `anchoredPrompt`, its frame loop and
 * its late timers — so a mid-mission "Stop" tears the running step down with no
 * leaked pointer handler, no orphaned `requestAnimationFrame` and no card coming
 * back. The abort then RETIRES the scope (2026-09-26): a later activity that opens
 * none of its own (the roep bench) starts un-aborted instead of inheriting the
 * stopped mission's scope and freezing before its first frame.
 */
let activityAbort: AbortController | null = null;

/** Open a fresh abort scope for the next activity step; returns its signal. */
export function beginActivityScope(): AbortSignal {
  activityAbort = new AbortController();
  return activityAbort.signal;
}

/** Fire the current activity's abort (the "Stop de missie" action) and retire the
 *  scope. Idempotent. Games hold their own copy of the signal, so they still see it. */
export function abortActivityScope(): void {
  activityAbort?.abort();
  activityAbort = null;
}

/** The live activity-abort signal (a game captures it once, at its start); null when idle. */
export function activityScopeSignal(): AbortSignal | null {
  return activityAbort?.signal ?? null;
}

/* ----------------------------------------------------------------- pick3d ---- */

export interface Pick3dTarget {
  id: string;
  object: THREE.Object3D;
}

export interface Pick3dOptions {
  canvas: HTMLCanvasElement;
  camera: THREE.PerspectiveCamera;
  raycaster: THREE.Raycaster;
  targets: Pick3dTarget[];
  onPick: (id: string) => void;
  /** a press on the canvas that hits none of the targets (optional: the wildcamera's
   *  camera shakes a calm "no"); never called for a pick */
  onMiss?: () => void;
  /** the game's own abort signal (`Stage.signal`): a stop removes the listener */
  signal: AbortSignal | null;
}

/** The world-space box a player actually sees for `object` — a rigged GLB renders at
 *  its SKELETON's extent (Models.skinnedRenderBox, F-07), everything else at its
 *  geometry box. The pick hit-spheres centre on it. */
export function visibleBox(object: THREE.Object3D): THREE.Box3 {
  object.updateWorldMatrix(true, true);
  return skinnedRenderBox(object) ?? new THREE.Box3().setFromObject(object);
}

/**
 * A generous invisible raycast target ≥56px-projected, parented to `object` at the
 * centre of what the player sees (not its feet). `visible:false` keeps it off-screen
 * but still raycastable. Returns the sphere so the caller can dispose it.
 */
export function addHitSphere(
  object: THREE.Object3D,
  camera: THREE.PerspectiveCamera,
  viewportH: number,
): THREE.Mesh {
  const box = visibleBox(object);
  const here = box.isEmpty() ? object.getWorldPosition(new THREE.Vector3()) : box.getCenter(new THREE.Vector3());
  const dist = camera.position.distanceTo(here);
  const r = tapHitRadius(dist, (camera.fov * Math.PI) / 180, viewportH, 0.2);
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(r, 8, 6),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  sphere.userData.hitSphere = true;
  sphere.userData.radius = r;
  object.add(sphere);
  // world centre → the object's local space (undo its scale so the radius stays true)
  object.updateWorldMatrix(true, false);
  sphere.position.copy(object.worldToLocal(here.clone()));
  const ws = object.getWorldScale(new THREE.Vector3());
  sphere.scale.set(1 / (ws.x || 1), 1 / (ws.y || 1), 1 / (ws.z || 1));
  return sphere;
}

/**
 * Raycast picking. On pointerdown the NEAREST visible part of any target wins (so a
 * bush in front of the piglet is the bush); when the pointer hits no visible mesh, the
 * generous ≥56px hit-sphere whose centre lies closest to the ray does (a near-miss on
 * a small animal still counts). Returns a teardown that removes the listener +
 * disposes the hit-spheres.
 */
export function pick3d(opts: Pick3dOptions): () => void {
  const { canvas, camera, raycaster, targets, onPick, onMiss, signal } = opts;
  if (signal?.aborted) return () => {}; // a stopped game takes no more picks
  const viewportH = canvas.getBoundingClientRect().height || 800;
  const spheres = targets.map((t) => addHitSphere(t.object, camera, viewportH));
  const c = new THREE.Vector3();
  const ws = new THREE.Vector3();

  const onDown = (e: PointerEvent): void => {
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    let best: { id: string; d: number } | null = null;
    for (const t of targets) {
      if (!t.object.visible) continue;
      for (const h of raycaster.intersectObject(t.object, true)) {
        if (h.object.userData.hitSphere || !h.object.visible) continue;
        if (!best || h.distance < best.d) best = { id: t.id, d: h.distance };
        break; // hits come sorted near → far
      }
    }
    if (!best) {
      targets.forEach((t, i) => {
        const s = spheres[i];
        if (!t.object.visible) return;
        s.getWorldPosition(c);
        const r = (s.userData.radius as number) * s.getWorldScale(ws).x;
        const d = raycaster.ray.distanceToPoint(c);
        if (d <= r && (!best || d < best.d)) best = { id: t.id, d };
      });
    }
    if (best) onPick((best as { id: string }).id);
    else onMiss?.();
  };
  // F-26: bind to the game's abort scope so "Stop de missie" removes this canvas
  // listener even when the engine's own teardown never runs (aborted mid-step).
  // The explicit removeEventListener below stays correct on the normal
  // (non-aborted) path — removing twice is a no-op.
  canvas.addEventListener('pointerdown', onDown, signal ? { signal } : undefined);

  return () => {
    canvas.removeEventListener('pointerdown', onDown);
    for (const s of spheres) {
      s.removeFromParent();
      s.geometry.dispose();
      (s.material as THREE.Material).dispose();
    }
  };
}

/* -------------------------------------------------------------------- glow ---- */

/** A 1×1 white texture: stands in for a model's own emissive map while it glows —
 *  the world's Meshy GLBs carry a (dark) emissive map that would multiply any glow
 *  colour back to black. Swapping one texture for another needs no shader recompile. */
let _white: THREE.Texture | null = null;
function whiteTex(): THREE.Texture {
  if (_white) return _white;
  const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  t.needsUpdate = true;
  _white = t;
  return t;
}

/**
 * A warm emissive glow over every standard material in `root` (the COLOUR channel of
 * a highlight). `set(0)` shows the model exactly as authored; `set(i)` lights it at
 * intensity `i` in `color`. `clear()` restores the originals. Only use it on a model
 * that owns its materials (every `spawnModel`/`spawnPlant` does), never a shared GLB.
 */
export class Glow {
  private readonly mats: { mat: THREE.MeshStandardMaterial; emissive: THREE.Color; intensity: number; map: THREE.Texture | null }[] = [];
  private readonly color = new THREE.Color();
  private on = false;

  constructor(root: THREE.Object3D, color: THREE.ColorRepresentation = '#ffe6a8') {
    this.color.set(color);
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || mesh.userData.hitSphere || mesh.userData.hintAnchor) return;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const mat = m as THREE.MeshStandardMaterial;
        if (!mat.isMeshStandardMaterial || this.mats.some((e) => e.mat === mat)) continue;
        this.mats.push({ mat, emissive: mat.emissive.clone(), intensity: mat.emissiveIntensity, map: mat.emissiveMap });
      }
    });
  }

  set(intensity: number, color?: THREE.ColorRepresentation): void {
    if (color !== undefined) this.color.set(color);
    if (intensity <= 0.001) { if (this.on) this.clear(); return; }
    this.on = true;
    for (const e of this.mats) {
      e.mat.emissive.copy(this.color);
      e.mat.emissiveIntensity = intensity;
      if (e.map) e.mat.emissiveMap = whiteTex();
    }
  }

  clear(): void {
    this.on = false;
    for (const e of this.mats) {
      e.mat.emissive.copy(e.emissive);
      e.mat.emissiveIntensity = e.intensity;
      e.mat.emissiveMap = e.map;
    }
  }
}

/* ---------------------------------------------------------- anchoredPrompt ---- */

/**
 * The accessible DOM card the 3D view writes its words/choices/read-aloud into —
 * the same `.ra-overlay` system the 2D views + Missions use, so the text-only
 * path stays fully playable. Returns the element (caller fills + wires it).
 * `signal` is the game's own abort signal (`Stage.signal`).
 */
export function anchoredPrompt(host: HTMLElement, html: string, signal: AbortSignal | null): HTMLDivElement {
  const el = document.createElement('div');
  // `ra-play`: the full-screen wrapper must let clicks through to the 3D canvas
  // (pick3d) — only its card/buttons take pointer events (see missions.css).
  el.className = 'ra-overlay ra-play';
  el.innerHTML = html;
  // a late timer of a stopped step ("Stop de missie") must never put a card back over
  // the world: after an abort the card is built but never mounted
  if (signal?.aborted) return el;
  host.querySelectorAll('.ra-overlay').forEach((n) => n.remove());
  host.appendChild(el);
  return el;
}

/* -------------------------------------------------------------- spoorTrail ---- */

/** One cloven hoof print (two soft teardrops, warm sand with a darker rim) — baked
 *  once, shared by every trail (a permanent 64² texture is a trivial cost). */
let _hoofTex: THREE.Texture | null = null;
function hoofTexture(): THREE.Texture {
  if (_hoofTex) return _hoofTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const toe = (x: number): void => {
    g.beginPath();
    g.ellipse(x, 30, 9, 21, 0, 0, Math.PI * 2);
    g.fillStyle = 'rgba(236,216,168,0.95)';
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = 'rgba(92,66,38,0.95)';
    g.stroke();
  };
  toe(21); toe(43);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  _hoofTex = tex;
  return tex;
}

/** A roe's slot pressed into trodden sand: two narrow cleaves, pointed toward the way
 *  she walked, dark where the hoof went in, a thin pale rim of pushed-up sand round
 *  them (a trail that must read from a few metres off on a light path: dark on light).
 *  Baked once, like the hoof print. */
let _slotTex: THREE.Texture | null = null;
function slotTexture(): THREE.Texture {
  if (_slotTex) return _slotTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const W = 12; // a cleave's half width (px): a slot is a broad heart, not two slivers
  const cleave = (x: number, lean: number): void => {
    g.beginPath();
    g.moveTo(x + lean, 6);                                        // the pointed toe (the canvas top: the way she went)
    g.bezierCurveTo(x + lean + W * 0.9, 14, x + W, 36, x + W * 0.7, 52);
    g.bezierCurveTo(x + W * 0.4, 60, x - W * 0.4, 60, x - W * 0.7, 52); // the round heel
    g.bezierCurveTo(x - W, 36, x + lean - W * 0.9, 14, x + lean, 6);
    g.closePath();
  };
  for (const [x, lean] of [[20, 5], [44, -5]] as const) {
    cleave(x, lean);
    g.lineWidth = 7;
    g.strokeStyle = 'rgba(226,204,160,0.55)';
    g.stroke();
    g.fillStyle = 'rgba(52,34,20,0.96)';
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  _slotTex = tex;
  return tex;
}

/** How a trail's prints look (all optional: the default is the boar family's light
 *  hoof print, smallest at the start). */
export interface SpoorLook {
  /** a roe's dark slot pressed into sand instead of the light hoof print */
  slot?: boolean;
  /** the first print's size next to the last (0..1, default 0.55: fainter toward the start) */
  fadeFrom?: number;
}

/**
 * The "Volg het spoor" trail: hoof prints walking along the ground from (ax,az) to
 * (bx,bz), `legs` stretches of three steps each (the zoeken spoor difficulty axis),
 * left/right alternating, every print seated on `groundY` (the RENDERED ground) and
 * tilted to its slope so none sinks or floats. Fainter toward the start, `opacity`
 * overall. One instanced draw call. Returns the group (add to the scene) + dispose.
 */
export function spoorTrail(
  ax: number, az: number, bx: number, bz: number, legs: number,
  groundY: (x: number, z: number) => number,
  opacity = 1,
  size = 1, // run 6: a piglet's trotters are smaller than a grown boar's hooves
  perLeg = 3,
  look: SpoorLook = {},
): { group: THREE.Group; dispose: () => void } {
  const n = Math.max(6, Math.round(legs) * perLeg);
  const pts = trailPoints(ax, az, bx, bz, n);
  const len = Math.hypot(bx - ax, bz - az) || 1;
  const dx = (bx - ax) / len, dz = (bz - az) / len;
  const geo = new THREE.PlaneGeometry(0.17 * size, 0.2 * size);
  geo.rotateX(-Math.PI / 2); // lie flat, the print's toes pointing along −z
  const mat = new THREE.MeshStandardMaterial({
    map: look.slot ? slotTexture() : hoofTexture(), transparent: true, opacity, depthWrite: false, roughness: 1,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const marks = new THREE.InstancedMesh(geo, mat, pts.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  const heading = Math.atan2(-dx, -dz); // yaw that points the print's −z along the walk
  pts.forEach((p, i) => {
    const side = i % 2 === 0 ? 1 : -1;
    const x = p.x + -dz * 0.1 * size * side, z = p.z + dx * 0.1 * size * side;
    const ahead = groundY(x + dx * 0.12, z + dz * 0.12);
    const behind = groundY(x - dx * 0.12, z - dz * 0.12);
    const pitch = Math.atan2(ahead - behind, 0.24);
    e.set(pitch, heading, 0, 'YXZ');
    q.setFromEuler(e);
    pos.set(x, groundY(x, z) + 0.035, z);
    const f0 = look.fadeFrom ?? 0.55;
    const fade = f0 + (1 - f0) * p.u;
    m.compose(pos, q, new THREE.Vector3(fade, 1, fade));
    marks.setMatrixAt(i, m);
  });
  marks.instanceMatrix.needsUpdate = true;
  marks.renderOrder = 2;
  const group = new THREE.Group();
  group.add(marks);
  return {
    group,
    dispose: () => { geo.dispose(); mat.dispose(); group.removeFromParent(); },
  };
}

/**
 * Run 7: a trail of the same prints along a WAY (a polyline round what lies between), a
 * pair every `spacing` m, from `points[0]` to the last point. The first `crisp` prints are
 * crisp (full opacity, 1.45× size: where the trail starts reads at once), the rest at
 * `opacity` (the tracking knob's clarity), growing a little toward the end. Two draw calls.
 */
export function spoorPath(
  points: readonly { x: number; z: number }[], groundY: (x: number, z: number) => number,
  o: { opacity: number; size?: number; spacing?: number; crisp?: number },
): { group: THREE.Group; count: number; dispose: () => void } {
  const size = o.size ?? 1;
  const spacing = Math.max(0.4, o.spacing ?? 1.1);
  // the prints along the polyline, every `spacing` m (left, right, left …)
  const at: { x: number; z: number; dx: number; dz: number; u: number }[] = [];
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z));
  const total = cum[cum.length - 1];
  for (let d = 0, i = 1; total > 0 && d <= total + 1e-6; d += spacing) {
    while (i < points.length - 1 && cum[i] < d) i += 1;
    const a = points[i - 1], b = points[i];
    const len = cum[i] - cum[i - 1] || 1;
    const k = Math.min(1, Math.max(0, (d - cum[i - 1]) / len));
    const dx = (b.x - a.x) / len, dz = (b.z - a.z) / len;
    at.push({ x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, dx, dz, u: d / total });
  }
  const crisp = Math.min(at.length, o.crisp ?? 0);
  const geo = new THREE.PlaneGeometry(0.17 * size, 0.2 * size);
  geo.rotateX(-Math.PI / 2);
  const make = (opacity: number): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({
    map: hoofTexture(), transparent: true, opacity, depthWrite: false, roughness: 1,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const mats = [make(1), make(o.opacity)];
  const meshes = [new THREE.InstancedMesh(geo, mats[0], Math.max(1, crisp)), new THREE.InstancedMesh(geo, mats[1], Math.max(1, at.length - crisp))];
  meshes[0].count = crisp;
  meshes[1].count = at.length - crisp;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  at.forEach((p, i) => {
    const side = i % 2 === 0 ? 1 : -1;
    const x = p.x + -p.dz * 0.1 * size * side, z = p.z + p.dx * 0.1 * size * side;
    const ahead = groundY(x + p.dx * 0.12, z + p.dz * 0.12);
    const behind = groundY(x - p.dx * 0.12, z - p.dz * 0.12);
    e.set(Math.atan2(ahead - behind, 0.24), Math.atan2(-p.dx, -p.dz), 0, 'YXZ');
    q.setFromEuler(e);
    pos.set(x, groundY(x, z) + 0.035, z);
    const s = i < crisp ? 1.45 : 0.85 + 0.15 * p.u;
    m.compose(pos, q, new THREE.Vector3(s, 1, s));
    if (i < crisp) meshes[0].setMatrixAt(i, m); else meshes[1].setMatrixAt(i - crisp, m);
  });
  const group = new THREE.Group();
  for (const mesh of meshes) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.renderOrder = 2;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  return {
    group, count: at.length,
    dispose: () => { geo.dispose(); for (const mat of mats) mat.dispose(); group.removeFromParent(); },
  };
}

/* ----------------------------------------------------------------- reframe ---- */

/**
 * A §1e camera reframe (2026-09-26: one calm eased move). The lens glides from where
 * it is to `to`, and its aim turns from where it looks now to `lookAt` on the SAME
 * smoothstep curve — yaw the short way round and pitch together, so nothing snaps on
 * the first frame, the turn is spread evenly over the move and roll stays 0 (fixed
 * FOV throughout). The move takes `seconds`, or longer for a big turn
 * (`reframeSeconds`: the view never turns faster than ~90°/s). `arc` lifts the lens
 * mid-move (so a glide over the ranger clears his head). Under reduced-motion it CUTS
 * on the first update. `update(dt)` returns true once settled and keeps holding the
 * pose after that (nothing else drives the camera meanwhile).
 */
export function makeReframe(
  camera: THREE.PerspectiveCamera,
  to: THREE.Vector3,
  lookAt: THREE.Vector3,
  reduced: boolean,
  seconds = 1.3,
  arc = 0,
): { update: (dt: number) => boolean } {
  let from: THREE.Vector3 | null = null;
  let aim0 = { yaw: 0, pitch: 0 };
  let aim1 = { yaw: 0, pitch: 0 };
  let dur = seconds;
  const aim = new THREE.Vector3();
  let t = 0;
  const hold = (): void => {
    camera.position.copy(to);
    camera.up.set(0, 1, 0);
    camera.lookAt(lookAt);
  };
  return {
    update(dt: number): boolean {
      if (reduced || seconds <= 0) { hold(); return true; }
      if (!from) {
        from = camera.position.clone();
        const d0 = camera.getWorldDirection(new THREE.Vector3());
        const d1 = lookAt.clone().sub(to);
        aim0 = yawPitch(d0.x, d0.y, d0.z);
        aim1 = yawPitch(d1.x, d1.y, d1.z);
        dur = reframeSeconds(seconds, (d0.angleTo(d1) * 180) / Math.PI);
      }
      // (a long frame — a hitch at a home's edge, a photo's render — moves it at most one
      // calm 20 fps frame's worth: the lens never jumps ahead, as CameraRig.place clamps)
      t = Math.min(1, t + Math.min(dt, 0.05) / dur);
      if (t >= 1) { hold(); return true; }
      const e = easeInOut(t);
      camera.position.lerpVectors(from, to, e);
      camera.position.y += Math.sin(Math.PI * e) * arc;
      const d = aimDir(lerpAngle(aim0.yaw, aim1.yaw, e), aim0.pitch + (aim1.pitch - aim0.pitch) * e);
      camera.up.set(0, 1, 0); // roll = 0 always
      camera.lookAt(aim.copy(camera.position).add(new THREE.Vector3(d.x, d.y, d.z)));
      return false;
    },
  };
}

/* ------------------------------------------------------- contact shadow ---- */

/** The soft radial-alpha blob every contact shadow shares — built once, kept warm
 *  across activities (a 64² canvas texture is a trivial permanent cost, and one
 *  shared texture means N shadows add N cheap transparent draw calls but only ONE
 *  texture upload). Warm-umber tint from the §2.1 ground-bounce family so the pool
 *  reads as a golden-hour shadow, not a flat grey decal. */
let _shadowTex: THREE.Texture | null = null;
function shadowTexture(): THREE.Texture {
  if (_shadowTex) return _shadowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  grad.addColorStop(0, 'rgba(28,20,10,0.5)');
  grad.addColorStop(0.55, 'rgba(28,20,10,0.26)');
  grad.addColorStop(1, 'rgba(28,20,10,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  _shadowTex = tex;
  return tex;
}

/**
 * A soft round contact shadow that grounds a staged 3D form (RUN-C-DIRECTION §2.2:
 * "een zachte slagschaduw 'grondt' het dier — cruciaal ... om te voorkomen dat het
 * lijkt te zweven"). A single flat ground disc with the shared cached radial-alpha
 * texture; `MeshBasicMaterial` so it takes no light and adds no shadow pass — free
 * under the golden key and fully static (reduced-motion-safe). The caller sits it a
 * hair above the ground at the form's rest spot and disposes its geometry+material on
 * teardown (the shared texture is a module singleton, never disposed). Returns the
 * mesh; `radius` ≈ the form's ground footprint.
 */
export function contactShadow(radius: number): THREE.Mesh {
  const geo = new THREE.CircleGeometry(radius, 20);
  const mat = new THREE.MeshBasicMaterial({
    map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0.9,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2; // lie flat on the ground, facing up
  mesh.renderOrder = 2;           // over the terrain, under the forms
  return mesh;
}

/** The 🔊 "Lees voor" button on a mini-game's or an adventure's card: the drawn speaker
 *  of the game's one icon set (ui/icons.ts), as on every other screen. An emoji draws
 *  differently on every system (a grey blob on some) and a speech engine may read it. */
export const SPEAK_BTN = `<button class="p3-speak" type="button" aria-label="${ALGEMEEN.leesVoor}">${icon('speaker')}</button>`;
