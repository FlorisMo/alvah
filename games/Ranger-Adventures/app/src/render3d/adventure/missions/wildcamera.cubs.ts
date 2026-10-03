/**
 * wildcamera.cubs.ts — the fox's two cubs on a rare night of "De wildcamera" (run 7,
 * wc-album; design state/wildcamera §5 beat 7b). Spawned for that play only (the world's
 * own fox model at a cub's size, `vos-welp`), disposed after.
 *
 * They follow their mother along her way — the very ground she trotted (her own track, laid
 * as she goes: never a line she cut a corner of) — each a
 * little behind her (`CUB_LAG`), side-on to the lens like her: they bound (a small hop with
 * every stride, the body tipping with it), weave a hand's width either side of her line,
 * and each one tumbles once — it rolls over in the grass and scrambles on — at a moment the
 * play's seed picks. Under reduced motion they simply walk behind her (no hop, no tumble).
 * Before she has gone their lag, they wait out of view behind her on her way in.
 *
 * The pure part (where a cub is on the line, how high it hops) is `cubPose`, unit-tested;
 * so is the family's photo (`familyPhoto`: the camera on the pine frames all three whole).
 */

import * as THREE from 'three';
import type { Spawned, SpawnOpts } from '../../play/types.ts';
import type { Spot } from '../types.ts';
import { CUB_LAG } from './wildcamera.places.ts';

/* ------------------------------------------------------------ pure ---- */

/** A polyline with its running length (m). */
export interface Line { pts: readonly Spot[]; cum: readonly number[] }
export function lineOf(pts: readonly Spot[]): Line {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  return { pts, cum };
}

/** Her track as she walks it (r2): a line that grows at its end — a point each time she has
 *  gone `step` m on from the last — starting `back` m behind where she sets off, along her
 *  way's first leg (where a cub waits, out of the picture, until she has gone its lag). */
export class Track implements Line {
  readonly pts: Spot[];
  readonly cum: number[];
  private readonly step: number;
  constructor(start: Spot, toward: Spot, back = 3, step = 0.03) {
    this.step = step;
    const dx = toward.x - start.x, dz = toward.z - start.z, l = Math.hypot(dx, dz) || 1;
    this.pts = [{ x: start.x - (dx / l) * back, z: start.z - (dz / l) * back }, { x: start.x, z: start.z }];
    this.cum = [0, back];
  }
  /** how far along it she is now (m) */
  get length(): number { return this.cum[this.cum.length - 1]; }
  /** she is at `p` now: the track follows her (a point once she has gone `step` on) */
  add(p: Spot): void {
    const last = this.pts[this.pts.length - 1];
    const d = Math.hypot(p.x - last.x, p.z - last.z);
    if (d < this.step) return;
    this.pts.push({ x: p.x, z: p.z });
    this.cum.push(this.length + d);
  }
}

/** The point `s` m along the line (before its start: on, back along its first leg), and
 *  the way it runs there (rad, rotation.y: along (sin, cos)). */
export function pointAt(l: Line, s: number): Spot & { yaw: number } {
  const n = l.pts.length;
  let i = 1;
  while (i < n - 1 && l.cum[i] < s) i++;
  const a = l.pts[i - 1], b = l.pts[i];
  const len = l.cum[i] - l.cum[i - 1] || 1;
  const t = (s - l.cum[i - 1]) / len;
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, yaw: Math.atan2(b.x - a.x, b.z - a.z) };
}

/** How far along the line `p` is (m): the nearest point of the line to it. */
export function progressOf(l: Line, p: Spot): number {
  let best = Infinity, at = 0;
  for (let i = 1; i < l.pts.length; i++) {
    const a = l.pts[i - 1], b = l.pts[i];
    const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / L2));
    const d = Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z);
    if (d < best) { best = d; at = l.cum[i - 1] + t * Math.sqrt(L2); }
  }
  return at;
}

/** A cub's pose: where on its mother's line it is, how far it weaves off it (m, + to its
 *  left), how high it hops (m), how far its body tips (rad, nose up +) and rolls (rad: a
 *  tumble is one whole roll). `s` her progress (m), `k` which cub, `t` the clock (s),
 *  `moving` she is on her way, `tumbleAt` where along the line this cub rolls over. */
export function cubPose(l: Line, s: number, k: 0 | 1, t: number, moving: boolean, tumbleAt: number, reduced: boolean): {
  x: number; z: number; yaw: number; lift: number; tip: number; roll: number; behind: number;
} {
  // (in a tumble it drops back a little behind its place, and scrambles after her again)
  const along = s - CUB_LAG[k];
  const into = along - tumbleAt;
  const tumbling = !reduced && into > 0 && into < TUMBLE_M;
  const lagExtra = tumbling ? Math.sin((into / TUMBLE_M) * Math.PI) * 0.22 : 0;
  const p = pointAt(l, along - lagExtra);
  const weave = reduced ? 0 : Math.sin(t * 1.7 + k * 2.1) * 0.08 + (k ? -0.06 : 0.06);
  const left = { x: Math.cos(p.yaw), z: -Math.sin(p.yaw) };
  const phase = t * Math.PI * 2 * 2.6 + k * 1.3;
  const hop = !reduced && moving && !tumbling ? Math.abs(Math.sin(phase)) * 0.055 : 0;
  const tip = !reduced && moving && !tumbling ? Math.cos(phase) * 0.13 : 0;
  const e = into / TUMBLE_M;
  const roll = tumbling ? e * e * (3 - 2 * e) * Math.PI * 2 : 0;
  return { x: p.x + left.x * weave, z: p.z + left.z * weave, yaw: p.yaw, lift: hop, tip, roll, behind: lagExtra };
}
/** A tumble lasts this far of her way (m): about a third of a second at her trot. */
export const TUMBLE_M = 0.75;

/**
 * The family's photo (r2): the camera at `lens` frames all of `pts` — the corners of the
 * three bodies as they really stand at the click (world points) — looking at their middle
 * as the lens sees it (left-right and up-down), with a field of view (deg, vertical, for a
 * photo `aspect` wide) that holds every one of them with `margin` (a share of the half
 * width) to spare at the edges. So all three are in it whole, nose to tail, wherever the
 * click caught them.
 */
export function familyPhoto(lens: THREE.Vector3, pts: readonly THREE.Vector3[], aspect = 1.6, margin = 0.1): { look: THREE.Vector3; fov: number } {
  const cam = new THREE.PerspectiveCamera(50, aspect, 0.05, 80);
  cam.position.copy(lens);
  const mid = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / Math.max(1, pts.length));
  const far = Math.max(0.5, lens.distanceTo(mid));
  let look = mid.clone();
  for (let i = 0; ; i++) {
    cam.lookAt(look);
    cam.updateMatrixWorld(true);
    // (each point as the lens sees it: its tangent off the look, across and up)
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of pts) {
      const q = p.clone().applyMatrix4(cam.matrixWorldInverse);
      const d = Math.max(0.05, -q.z);
      x0 = Math.min(x0, q.x / d); x1 = Math.max(x1, q.x / d);
      y0 = Math.min(y0, q.y / d); y1 = Math.max(y1, q.y / d);
    }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    if (i === 4 || (Math.abs(cx) < 1e-4 && Math.abs(cy) < 1e-4)) {
      const half = Math.max(Math.max(-x0, x1) / aspect, Math.max(-y0, y1)) * (1 + margin);
      return { look, fov: (2 * Math.atan(half) * 180) / Math.PI };
    }
    // (turn to the middle of what it sees, and look again)
    const dir = new THREE.Vector3(cx, cy, -1).transformDirection(cam.matrixWorld);
    look = lens.clone().addScaledVector(dir, far);
  }
}

/** The corners of what is drawn of `o` (its visible meshes' boxes, world): what a photo of it
 *  must hold. */
export function drawnCorners(o: THREE.Object3D): THREE.Vector3[] {
  const box = new THREE.Box3(), b = new THREE.Box3();
  o.updateWorldMatrix(true, true);
  o.traverseVisible((x) => {
    const m = x as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    box.union(b.copy(m.geometry.boundingBox!).applyMatrix4(m.matrixWorld));
  });
  if (box.isEmpty()) return [];
  const out: THREE.Vector3[] = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) out.push(new THREE.Vector3(x, y, z));
  return out;
}

/* ------------------------------------------------------------ the cubs ---- */

/** How far behind where she sets off her track begins (m): a cub waits there, out of the
 *  picture, until she has gone its lag. */
const TRACK_BACK = 3;

/** What the cubs need from the world. */
export interface CubsEnv {
  parent: THREE.Object3D;
  groundY(x: number, z: number): number;
  spawnModel(id: string, opts?: SpawnOpts): Promise<Spawned | null>;
}

export class FoxCubs {
  readonly group = new THREE.Group();
  private readonly cubs: { holder: THREE.Group; body: THREE.Group; s: Spawned | null }[] = [];
  private line: Track | null = null;
  private progress = -Infinity;
  private moving = false;
  private tumbles: [number, number] = [Infinity, Infinity];
  private clock = 0;
  private disposed = false;
  /** loaded (both cubs stand in the world, hidden) */
  readonly ready: Promise<void>;

  private readonly env: CubsEnv;

  constructor(env: CubsEnv, height = 0.3) {
    this.env = env;
    this.group.name = 'fox-cubs';
    this.group.visible = false;
    env.parent.add(this.group);
    this.ready = Promise.all([0, 1].map(async (k) => {
      const holder = new THREE.Group();
      const body = new THREE.Group();
      holder.name = `fox-cub-${k}`;
      holder.add(body);
      this.group.add(holder);
      const s = await env.spawnModel('vos-welp', { height, idle: true });
      if (this.disposed) { s?.dispose(); return; }
      if (s) {
        const root = s.root as THREE.Object3D;
        // (its middle at the body's pivot, so a tumble rolls it about its own back)
        body.position.y = height * 0.45;
        root.position.y = -height * 0.45;
        root.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = false; });
        body.add(root);
      }
      this.cubs.push({ holder, body, s });
    })).then(() => {});
  }

  /** Follow her from the start of `path` (where she sets off) on, along the ground she
   *  really walks; each cub tumbles once at `tumbleAt[k]` m along her way. */
  start(path: readonly Spot[], tumbleAt: [number, number]): void {
    this.line = new Track(path[0], path[1], TRACK_BACK);
    this.progress = this.line.length;
    this.tumbles = [tumbleAt[0] + TRACK_BACK, tumbleAt[1] + TRACK_BACK];
    this.group.visible = true;
  }

  /** Every frame: where she is now (her track grows behind her) and whether she walks. */
  update(dt: number, mother: Spot & { speed: number }, reduced: boolean): void {
    if (this.disposed || !this.line) return;
    this.clock += dt;
    this.line.add(mother);
    this.progress = this.line.length;
    this.moving = mother.speed > 0.15;
    this.cubs.forEach((c, k) => {
      const p = cubPose(this.line!, this.progress, k as 0 | 1, this.clock, this.moving, this.tumbles[k], reduced);
      c.holder.position.set(p.x, this.env.groundY(p.x, p.z) + p.lift, p.z);
      c.holder.rotation.set(0, p.yaw, 0);
      c.body.rotation.set(-p.tip, 0, p.roll);
      if (c.s?.rigged) {
        c.s.clip?.(this.moving ? 'walk' : 'idle');
        c.s.rate?.(this.moving ? 2.1 : 1);
      }
      c.s?.update(dt);
    });
  }

  /** How many draw calls they add (the dev read). */
  get meshes(): number {
    let n = 0;
    this.group.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.visible) n++; });
    return n;
  }

  hide(): void { this.group.visible = false; this.line = null; }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const c of this.cubs) c.s?.dispose();
    this.group.removeFromParent();
  }
}
