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
 *  - **highlight3d** is dual-channel (emissive COLOUR + SCALE pulse) and freezes
 *    to a steady still glow under reduced-motion (motion-comfort §1e).
 *  - **anchoredPrompt** keeps ALL words/choices/read-aloud in the existing
 *    accessible DOM card — 3D supplies the scene, the DOM supplies the text, so
 *    the text-only path stays fully playable.
 *  - **reframe** is a §1e exp-damped camera move, or a hard cut under reduced-motion.
 */

import * as THREE from 'three';
import { dampFactor, highlightPulse, safeCamHeight, tapHitRadius, trailPoints } from './kit-math';
import { provideGoldenProbes, renderView, type PlayHintProbe, type SeatProbe } from '../../core/devhook';

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
  /** The object a player sees and clicks. */
  target: THREE.Object3D;
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
function visibleBox(root: THREE.Object3D, out: THREE.Box3): THREE.Box3 {
  out.makeEmpty();
  const part = new THREE.Box3();
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.userData.hitSphere || !shownInTree(m)) return;
    const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.Material | undefined;
    if (!mat || !mat.visible) return;
    const sk = m as THREE.SkinnedMesh;
    if (sk.isSkinnedMesh || (m as THREE.InstancedMesh).isInstancedMesh) {
      (m as THREE.SkinnedMesh).computeBoundingBox();
      part.copy((m as THREE.SkinnedMesh).boundingBox!);
    } else {
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      part.copy(m.geometry.boundingBox!);
    }
    out.union(part.applyMatrix4(m.matrixWorld));
  });
  return out;
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
  const at = `(${r2(top.position.x)}, ${r2(top.position.y)}, ${r2(top.position.z)})`;
  return top === o ? `${self}@${at}` : `${self} in ${top.name || top.type}@${at}`;
}

function describeElement(el: Element): string {
  const cls = typeof el.className === 'string' && el.className ? `.${el.className.trim().split(/\s+/).join('.')}` : '';
  const text = (el as HTMLElement).innerText?.trim().slice(0, 40);
  return `${el.tagName.toLowerCase()}${cls}${text ? ` "${text}"` : ''}`;
}

function probePlayHint(): PlayHintProbe | null {
  const hint = currentPlayHint();
  if (!hint) return null;
  const v = liveView();
  let root = hint.target;
  while (root.parent) root = root.parent;
  if (v && root !== v.scene) return null; // not in the rendered scene (a finished step's stale hint): nothing to click
  const box = visibleBox(hint.target, new THREE.Box3());
  if (!v || box.isEmpty()) {
    return { id: hint.id, x: -1, y: -1, onScreen: false, firstHit: false, aboveGround: false,
      firstHitBy: v ? 'target has no visible mesh' : 'no live world view', bottomGap: null, reachesCanvas: false, blocker: null };
  }
  const c = box.getCenter(new THREE.Vector3());
  const s = toScreen(v, c);
  probeRay.setFromCamera(new THREE.Vector2(s.ndc.x, s.ndc.y), v.camera);
  probeRay.far = Infinity;
  probeRay.layers.mask = v.camera.layers.mask;
  const first = probeRay.intersectObject(v.scene, true).find(occludes);
  let firstHit = false;
  for (let p: THREE.Object3D | null = first?.object ?? null; p; p = p.parent) if (p === hint.target) { firstHit = true; break; }
  const g = groundUnder(v.scene, c.x, c.z);
  const el = s.onScreen ? document.elementFromPoint(s.x, s.y) : null;
  return {
    id: hint.id, x: r2(s.x), y: r2(s.y), onScreen: s.onScreen, firstHit,
    aboveGround: g !== null && box.max.y > g + 0.01,
    firstHitBy: first ? (firstHit ? hint.id : describeObject(first.object, v.scene)) : 'nothing',
    bottomGap: g === null ? null : r2(box.min.y - g),
    reachesCanvas: el === v.canvas,
    blocker: el && el !== v.canvas ? describeElement(el) : null,
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

type Placed = { o: THREE.Object3D; box: THREE.Box3 };

/** Every placed thing whose footprint centre lies within r of (x,z): models, props and
 *  staged pieces (a container at the origin is looked through), plus instanced copies
 *  (reported one by one through `onInstance`). Hidden things and the terrain are skipped. */
function placedThings(v: LiveView, x: number, z: number, r: number,
  onInstance?: (label: string, i: number, at: THREE.Vector3) => void): Placed[] {
  const out: Placed[] = [];
  const terrain = terrainMeshes(v.scene);
  const c = new THREE.Vector3();
  const m4 = new THREE.Matrix4();
  const visit = (o: THREE.Object3D): void => {
    if (!o.visible || o.userData.hitSphere || terrain.includes(o)) return;
    if ((o as THREE.Light).isLight || (o as THREE.Camera).isCamera || (o as THREE.Points).isPoints
      || (o as THREE.Line).isLine || (o as THREE.Sprite).isSprite) return;
    if (o === v.scene) { o.children.forEach(visit); return; }
    const inst = o as THREE.InstancedMesh;
    if (inst.isInstancedMesh) {
      if (!onInstance) return;
      for (let i = 0; i < inst.count; i++) {
        inst.getMatrixAt(i, m4);
        c.setFromMatrixPosition(m4.premultiply(inst.matrixWorld));
        if (Math.hypot(c.x - x, c.z - z) <= r) onInstance(o.name || inst.geometry.type, i, c.clone());
      }
      return;
    }
    // a pure container (at the origin, unrotated): what it holds is what is placed
    if (o.children.length && !(o as THREE.Mesh).isMesh && o.position.lengthSq() < 1e-6 && o.quaternion.w > 0.99999) {
      o.children.forEach(visit);
      return;
    }
    const box = visibleBox(o, new THREE.Box3());
    if (box.isEmpty()) return;
    box.getCenter(c);
    const size = box.getSize(new THREE.Vector3());
    if (size.x > 12 || size.z > 12 || Math.hypot(c.x - x, c.z - z) > r) return;
    out.push({ o, box });
  };
  visit(v.scene);
  return out;
}

function probeSeating(x: number, z: number, r: number): SeatProbe[] | null {
  const v = liveView();
  if (!v) return null;
  const out: SeatProbe[] = [];
  const onInstance = (label: string, i: number, at: THREE.Vector3): void => {
    const g = groundUnder(v.scene, at.x, at.z);
    if (g === null || at.y - g > 3) return;
    out.push({ id: `${label}#${i}`, x: r2(at.x), y: r2(at.y), z: r2(at.z), gap: r2(at.y - g), sig: `${label}#${i}` });
  };
  const c = new THREE.Vector3();
  for (const { o, box } of placedThings(v, x, z, r, onInstance)) {
    box.getCenter(c);
    const g = groundUnder(v.scene, c.x, c.z);
    if (g === null || box.min.y - g > 3) continue; // flying (a bird, a cloud): not a prop
    out.push({ id: describeObject(o, v.scene), x: r2(c.x), y: r2(box.min.y), z: r2(c.z), gap: r2(box.min.y - g), sig: lookSig(o) });
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
  let best: Placed | null = null; let bestArea = 0;
  for (const p of placedThings(v, x, z, 2.5)) {
    const area = (p.box.max.x - p.box.min.x) * (p.box.max.z - p.box.min.z);
    if (area > bestArea) { bestArea = area; best = p; }
  }
  if (!best) return null;
  let a0 = Infinity; let a1 = -Infinity; let c0 = Infinity; let c1 = -Infinity;
  const p = new THREE.Vector3();
  best.o.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.userData.hitSphere || !shownInTree(m) || (m as THREE.InstancedMesh).isInstancedMesh) return;
    const pos = m.geometry.attributes.position;
    if (!pos) return;
    const stride = Math.max(1, Math.floor(pos.count / 4000));
    for (let i = 0; i < pos.count; i += stride) {
      p.fromBufferAttribute(pos, i);
      if ((m as THREE.SkinnedMesh).isSkinnedMesh) (m as THREE.SkinnedMesh).applyBoneTransform(i, p);
      p.applyMatrix4(m.matrixWorld);
      const a = p.x * ux + p.z * uz; const c = -p.x * uz + p.z * ux;
      a0 = Math.min(a0, a); a1 = Math.max(a1, a); c0 = Math.min(c0, c); c1 = Math.max(c1, c);
    }
  });
  if (!Number.isFinite(a0)) return null;
  return { id: describeObject(best.o, v.scene), along: r2(a1 - a0), across: r2(c1 - c0) };
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
 * missie"). The mission runner opens a fresh scope before each step; `pick3d`
 * binds its canvas listener to the scope's signal and every engine frame loop
 * early-returns once it aborts — so a mid-mission "Stop" tears the running step
 * down with no leaked pointer handler and no orphaned `requestAnimationFrame`,
 * and the world is then rebuilt clean (Missions.ts). The controller is NOT
 * nulled on abort: the already-scheduled loop frame must still read `aborted`
 * and return instead of rescheduling. A fresh `beginActivityScope()` replaces it
 * for the next step.
 */
let activityAbort: AbortController | null = null;

/** Open a fresh abort scope for the next activity step; returns its signal. */
export function beginActivityScope(): AbortSignal {
  activityAbort = new AbortController();
  return activityAbort.signal;
}

/** Fire the current activity's abort (the "Stop de missie" action). Idempotent. */
export function abortActivityScope(): void {
  activityAbort?.abort();
}

/** The live activity-abort signal (engine loops read `?.aborted`); null when idle. */
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
}

/**
 * A generous invisible raycast target ≥56px-projected, parented to `object` at
 * its origin. `visible:false` keeps it off-screen but still raycastable. Returns
 * the sphere so the caller can dispose it.
 */
export function addHitSphere(
  object: THREE.Object3D,
  camera: THREE.PerspectiveCamera,
  viewportH: number,
): THREE.Mesh {
  const here = new THREE.Vector3();
  object.getWorldPosition(here);
  const dist = camera.position.distanceTo(here);
  const r = tapHitRadius(dist, (camera.fov * Math.PI) / 180, viewportH);
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(r, 8, 6),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  sphere.userData.hitSphere = true;
  object.add(sphere);
  return sphere;
}

/**
 * Raycast picking with ≥56px hit-spheres. On pointerdown the first target whose
 * subtree (incl. its hit-sphere) is hit fires `onPick(id)`. Returns a teardown
 * that removes the listener + disposes the hit-spheres.
 */
export function pick3d(opts: Pick3dOptions): () => void {
  const { canvas, camera, raycaster, targets, onPick } = opts;
  const viewportH = canvas.getBoundingClientRect().height || 800;
  const spheres = targets.map((t) => addHitSphere(t.object, camera, viewportH));

  const onDown = (e: PointerEvent): void => {
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    for (const t of targets) {
      if (raycaster.intersectObject(t.object, true).length) { onPick(t.id); return; }
    }
  };
  // F-26: bind to the live activity-abort scope so "Stop de missie" removes this
  // canvas listener even when the engine's own teardown never runs (aborted
  // mid-step). The explicit removeEventListener below stays correct on the normal
  // (non-aborted) path — removing twice is a no-op.
  const abortSig = activityScopeSignal();
  canvas.addEventListener('pointerdown', onDown, abortSig ? { signal: abortSig } : undefined);

  return () => {
    canvas.removeEventListener('pointerdown', onDown);
    for (const s of spheres) {
      s.removeFromParent();
      s.geometry.dispose();
      (s.material as THREE.Material).dispose();
    }
  };
}

/* ------------------------------------------------------------- highlight3d ---- */

/**
 * Dual-channel highlight on a target: an emissive COLOUR glow on every standard
 * material in its subtree + a SCALE pulse on the group. `update(t, reduced)` is
 * called per frame (reduced-motion → a steady still glow, no scale oscillation).
 * `clear()` restores the originals.
 */
export class Highlight3d {
  private readonly target: THREE.Object3D;
  private readonly mats: { mat: THREE.MeshStandardMaterial; emissive: THREE.Color; intensity: number }[] = [];
  private readonly baseScale: THREE.Vector3;
  private readonly glow = new THREE.Color();

  constructor(target: THREE.Object3D, color: string) {
    this.target = target;
    this.baseScale = target.scale.clone();
    this.glow.set(color);
    target.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (mat && mat.isMeshStandardMaterial) {
        this.mats.push({ mat, emissive: mat.emissive.clone(), intensity: mat.emissiveIntensity });
        mat.emissive = this.glow.clone();
      }
    });
  }

  update(t: number, reduced: boolean): void {
    const p = highlightPulse(t, reduced);
    for (const m of this.mats) m.mat.emissiveIntensity = p.emissive;
    this.target.scale.set(this.baseScale.x * p.scale, this.baseScale.y * p.scale, this.baseScale.z * p.scale);
  }

  clear(): void {
    for (const m of this.mats) { m.mat.emissive.copy(m.emissive); m.mat.emissiveIntensity = m.intensity; }
    this.target.scale.copy(this.baseScale);
  }
}

/* ---------------------------------------------------------- anchoredPrompt ---- */

/**
 * The accessible DOM card the 3D view writes its words/choices/read-aloud into —
 * the same `.ra-overlay` system the 2D views + Missions use, so the text-only
 * path stays fully playable. Returns the element (caller fills + wires it).
 */
export function anchoredPrompt(host: HTMLElement, html: string): HTMLDivElement {
  host.querySelectorAll('.ra-overlay').forEach((n) => n.remove());
  const el = document.createElement('div');
  // `ra-play`: the full-screen wrapper must let clicks through to the 3D canvas
  // (pick3d) — only its card/buttons take pointer events (see missions.css).
  el.className = 'ra-overlay ra-play';
  el.innerHTML = html;
  host.appendChild(el);
  return el;
}

/* -------------------------------------------------------------- spoorTrail ---- */

/**
 * Instanced clue footprints laid along the ground path from (ax,az) to (bx,bz),
 * fading fainter toward the start (the `u` channel). One draw call. `groundY`
 * sets each clue on the terrain. Returns the group (add to the scene) + dispose.
 */
export function spoorTrail(
  ax: number, az: number, bx: number, bz: number, n: number,
  groundY: (x: number, z: number) => number,
  color = '#cdb892',
): { group: THREE.Group; dispose: () => void } {
  const pts = trailPoints(ax, az, bx, bz, n);
  const geo = new THREE.CircleGeometry(0.22, 12);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 1, transparent: true });
  const marks = new THREE.InstancedMesh(geo, mat, pts.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  const scale = new THREE.Vector3(1, 1, 1);
  const pos = new THREE.Vector3();
  pts.forEach((p, i) => {
    pos.set(p.x, groundY(p.x, p.z) + 0.02, p.z);
    m.compose(pos, q, scale);
    marks.setMatrixAt(i, m);
  });
  marks.instanceMatrix.needsUpdate = true;
  const group = new THREE.Group();
  group.add(marks);
  return {
    group,
    dispose: () => { geo.dispose(); mat.dispose(); group.removeFromParent(); },
  };
}

/* ----------------------------------------------------------------- reframe ---- */

/**
 * D1.3: lift a reframe camera target above the RENDERED terrain under the lens.
 * Mutates `to.y` up to `groundY(to.x, to.z) + clearance` where the ground rises under
 * the camera's own XZ, and leaves flat-ground looks unchanged. A §1e mission reframe
 * then never lands below the visual surface — the mirrored analytic marker Y once
 * buried the mission camera (fresh simon-3D shot from `cam.y` −1.29, an up-tilt
 * through the terrain; direction §2.2 one-ground-truth / §2.5 never-under-terrain).
 * Call it on the `to` vector immediately before `makeReframe`, passing `ctx.groundY`
 * (the raycast ground-snap, which matches the pixels).
 */
export function liftReframeAboveGround(
  to: THREE.Vector3,
  groundY: (x: number, z: number) => number,
): void {
  to.y = safeCamHeight(to.y, groundY(to.x, to.z));
}

/**
 * A §1e camera reframe: exp-damped move of the camera to `to` while looking at
 * `lookAt`. Under reduced-motion it CUTS (snaps) on the first update. `update(dt)`
 * returns true once settled. The caller drives it from the world's frame loop and
 * stops calling World's own follow while a reframe is active.
 */
export function makeReframe(
  camera: THREE.PerspectiveCamera,
  to: THREE.Vector3,
  lookAt: THREE.Vector3,
  reduced: boolean,
  tau = 0.35,
): { update: (dt: number) => boolean } {
  return {
    update(dt: number): boolean {
      if (reduced) {
        camera.position.copy(to);
        camera.up.set(0, 1, 0);
        camera.lookAt(lookAt);
        return true;
      }
      const a = dampFactor(dt, tau);
      camera.position.lerp(to, a);
      camera.up.set(0, 1, 0); // roll = 0 always
      camera.lookAt(lookAt);
      return camera.position.distanceToSquared(to) < 1e-4;
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
