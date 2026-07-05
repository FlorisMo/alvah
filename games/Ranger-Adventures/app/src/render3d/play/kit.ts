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
import { dampFactor, highlightPulse, tapHitRadius, trailPoints } from './kit-math';

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
  el.className = 'ra-overlay';
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
