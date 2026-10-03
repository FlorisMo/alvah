/**
 * wildcamera.cubs.ts — the fox's two cubs on a rare night of "De wildcamera" (run 7,
 * wc-album; design state/wildcamera §5 beat 7b). Spawned for that play only (the world's
 * own fox model at a cub's size, `vos-welp`), disposed after.
 *
 * They follow their mother along her way (the very line she trots: `familyPath`), each a
 * little behind her (`CUB_LAG`), side-on to the lens like her: they bound (a small hop with
 * every stride, the body tipping with it), weave a hand's width either side of her line,
 * and each one tumbles once — it rolls over in the grass and scrambles on — at a moment the
 * play's seed picks. Under reduced motion they simply walk behind her (no hop, no tumble).
 * Before she has gone their lag, they wait out of view behind her on her way in.
 *
 * The pure part (where a cub is on the line, how high it hops) is `cubPose`, unit-tested.
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

/* ------------------------------------------------------------ the cubs ---- */

/** What the cubs need from the world. */
export interface CubsEnv {
  parent: THREE.Object3D;
  groundY(x: number, z: number): number;
  spawnModel(id: string, opts?: SpawnOpts): Promise<Spawned | null>;
}

export class FoxCubs {
  readonly group = new THREE.Group();
  private readonly cubs: { holder: THREE.Group; body: THREE.Group; s: Spawned | null }[] = [];
  private line: Line | null = null;
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

  /** Follow her along `path` from now on; each cub tumbles once at `tumbleAt[k]` m along it. */
  start(path: readonly Spot[], tumbleAt: [number, number]): void {
    this.line = lineOf(path);
    this.progress = 0;
    this.tumbles = tumbleAt;
    this.group.visible = true;
  }

  /** Every frame: where she is now (her progress along the line only grows) and whether
   *  she walks. */
  update(dt: number, mother: Spot & { speed: number }, reduced: boolean): void {
    if (this.disposed || !this.line) return;
    this.clock += dt;
    this.progress = Math.max(this.progress, progressOf(this.line, mother));
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
