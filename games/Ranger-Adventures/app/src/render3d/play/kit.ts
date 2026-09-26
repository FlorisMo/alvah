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
import { easeInOut, tapHitRadius, trailPoints } from './kit-math';
import { skinnedRenderBox } from '../Models';

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

/** The world-space box a player actually sees for `object` — a rigged GLB renders at
 *  its SKELETON's extent (Models.skinnedRenderBox, F-07), everything else at its
 *  geometry box. Hit-spheres, hint anchors and framing all measure through this. */
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
  const { canvas, camera, raycaster, targets, onPick } = opts;
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
 */
export function anchoredPrompt(host: HTMLElement, html: string): HTMLDivElement {
  const el = document.createElement('div');
  // `ra-play`: the full-screen wrapper must let clicks through to the 3D canvas
  // (pick3d) — only its card/buttons take pointer events (see missions.css).
  el.className = 'ra-overlay ra-play';
  el.innerHTML = html;
  // a late timer of a stopped step ("Stop de missie") must never put a card back over
  // the world: after an abort the card is built but never mounted
  if (activityScopeSignal()?.aborted) return el;
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
): { group: THREE.Group; dispose: () => void } {
  const n = Math.max(6, Math.round(legs) * 3);
  const pts = trailPoints(ax, az, bx, bz, n);
  const len = Math.hypot(bx - ax, bz - az) || 1;
  const dx = (bx - ax) / len, dz = (bz - az) / len;
  const geo = new THREE.PlaneGeometry(0.17, 0.2);
  geo.rotateX(-Math.PI / 2); // lie flat, the print's toes pointing along −z
  const mat = new THREE.MeshStandardMaterial({
    map: hoofTexture(), transparent: true, opacity, depthWrite: false, roughness: 1,
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
    const x = p.x + -dz * 0.1 * side, z = p.z + dx * 0.1 * side;
    const ahead = groundY(x + dx * 0.12, z + dz * 0.12);
    const behind = groundY(x - dx * 0.12, z - dz * 0.12);
    const pitch = Math.atan2(ahead - behind, 0.24);
    e.set(pitch, heading, 0, 'YXZ');
    q.setFromEuler(e);
    pos.set(x, groundY(x, z) + 0.035, z);
    const fade = 0.55 + 0.45 * p.u;
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

/* ----------------------------------------------------------------- reframe ---- */

/**
 * A §1e camera reframe (2026-09-26: one calm eased move). The lens glides from where
 * it is to `to` over `seconds`, and its aim glides from where it looks now to
 * `lookAt` on the SAME curve — so nothing snaps on the first frame, the view never
 * swings faster than the move, and roll stays 0 (fixed FOV throughout). Under
 * reduced-motion it CUTS on the first update. `update(dt)` returns true once settled
 * and keeps holding the pose after that (nothing else drives the camera meanwhile).
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
  let fromLook: THREE.Vector3 | null = null;
  const look = new THREE.Vector3();
  let t = 0;
  return {
    update(dt: number): boolean {
      if (reduced || seconds <= 0) {
        camera.position.copy(to);
        camera.up.set(0, 1, 0);
        camera.lookAt(lookAt);
        return true;
      }
      if (!from || !fromLook) {
        from = camera.position.clone();
        const dir = camera.getWorldDirection(new THREE.Vector3());
        fromLook = from.clone().addScaledVector(dir, Math.max(1, to.distanceTo(lookAt)));
      }
      t = Math.min(1, t + dt / seconds);
      const e = easeInOut(t);
      camera.position.lerpVectors(from, to, e);
      // a soft rise mid-move, so a glide that passes over the ranger clears his head
      camera.position.y += Math.sin(Math.PI * e) * arc;
      look.lerpVectors(fromLook, lookAt, e);
      camera.up.set(0, 1, 0); // roll = 0 always
      camera.lookAt(look);
      return t >= 1;
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
