/**
 * frisling.finds.ts — what he can discover at the wallow's home and the small surprises on
 * the way (run 7 package body, design frisling §4, §5.9): the family (the sow, the yearling),
 * a woodlark that flies up singing from the heather where he walks, the pigs' rubbing log,
 * a nest of bitten bracken at a stand's edge, and — rarely — a magpie riding on the sow's
 * back (FOUNDATION's rare roll with its pity rule: within about three plays of this home).
 *
 * A discovery is WHAT HE SAW: `Sightings` records one (`k.discover`) only once the thing
 * was really in his picture — on screen, at least `SEEN_PX` big, not hidden behind the
 * ground or the bracken, for `SEEN_S` on end, near enough (FOUNDATION's `SeenMeter`) — or
 * he walked right up to it. Its calm reveal waits for a quiet beat (a walk, a look, the
 * reunion): never during the search, the route, a hold or a card.
 *
 * The surprises have no row: they are there to be met, drawn from the play's own forks.
 * Nothing here ever sits inside a measured beat (the search, the route, a hold).
 */

import * as THREE from 'three';
import type { AdventureKit } from '../kit';
import type { Spot } from '../types';
import type { Spawned } from '../../play/types';
import { SeenMeter, groundHides } from '../../world/surprises-math';
import { dist, headingTo } from '../places';

/* ------------------------------------------------------------- seeing ---- */

/** Something he may discover by seeing it. */
export interface Watch {
  id: string;
  /** what is measured in his picture (its box), now; null: not there now */
  object: () => THREE.Object3D | null;
  /** he must be within this (m) of it (default 35) */
  within?: number;
  /** may it count now? (the sow scratching at the log, a framed view at the stand) */
  when?: () => boolean;
  /** hidden from the lens at `eye` (the bracken over a nest) */
  hidden?: (eye: THREE.Vector3) => boolean;
  /** or he walked right up to it: within `r` of (x, z) */
  near?: Spot & { r: number };
  /** recorded quietly (the hero, at the win) */
  quiet?: boolean;
}

const _box = new THREE.Box3();
const _c = new THREE.Vector3();
const _p = new THREE.Vector3();

/** Watches the home's discoverable things each frame and records one once he saw it. */
export class Sightings {
  private readonly watches: { w: Watch; meter: SeenMeter; done: boolean; px: number }[] = [];
  private readonly k: AdventureKit;
  /** what he discovered in this play (new or not), in the order he met it */
  readonly met: string[] = [];

  constructor(k: AdventureKit) {
    this.k = k;
    k.onTick((dt) => this.update(dt));
  }

  watch(w: Watch): void {
    this.watches.push({ w, meter: new SeenMeter(), done: false, px: 0 });
  }

  /** The px size of an object in the picture (the larger side of its box), or 0 off it. */
  static px(cam: THREE.PerspectiveCamera, o: THREE.Object3D, viewH: number): { px: number; centre: THREE.Vector3; on: boolean } {
    o.updateWorldMatrix(true, true);
    _box.setFromObject(o);
    if (_box.isEmpty()) return { px: 0, centre: _c.set(0, 0, 0), on: false };
    _box.getCenter(_c);
    _p.copy(_c).project(cam);
    const on = _p.z > -1 && _p.z < 1 && Math.abs(_p.x) <= 0.96 && Math.abs(_p.y) <= 0.96;
    if (!on) return { px: 0, centre: _c, on };
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      _p.set(i & 1 ? _box.max.x : _box.min.x, i & 2 ? _box.max.y : _box.min.y, i & 4 ? _box.max.z : _box.min.z).project(cam);
      x0 = Math.min(x0, _p.x); x1 = Math.max(x1, _p.x); y0 = Math.min(y0, _p.y); y1 = Math.max(y1, _p.y);
    }
    const W = viewH * cam.aspect;
    return { px: Math.max(((x1 - x0) / 2) * W, ((y1 - y0) / 2) * viewH), centre: _c, on };
  }

  private update(dt: number): void {
    const k = this.k;
    const cam = k.world.camera;
    const viewH = k.ctx.canvas.clientHeight || 800;
    const me = k.ranger();
    for (const s of this.watches) {
      if (s.done) continue;
      const w = s.w;
      if (w.near && dist(me, w.near) <= w.near.r) { this.seen(s); continue; }
      const o = w.object();
      if (!o || !o.visible || (w.when && !w.when())) { s.meter.step(dt, false, 0, Infinity); continue; }
      const { px, centre, on } = Sightings.px(cam, o, viewH);
      s.px = px;
      let visible = on;
      if (visible && groundHides(cam.position, centre, k.ctx.groundY)) visible = false;
      if (visible && w.hidden?.(cam.position)) visible = false;
      if (s.meter.step(dt, visible, px, w.within !== undefined ? (dist(me, { x: centre.x, z: centre.z }) <= w.within ? 0 : Infinity) : dist(me, { x: centre.x, z: centre.z }))) this.seen(s);
    }
  }

  private seen(s: { w: Watch; done: boolean }): void {
    s.done = true;
    this.met.push(s.w.id);
    this.k.discover(s.w.id, { quiet: s.w.quiet });
  }

  /** The dev read: px of each thing still watched. */
  read(): Record<string, number> {
    return Object.fromEntries(this.watches.filter((s) => !s.done).map((s) => [s.w.id, Math.round(s.px)]));
  }
}

/* ----------------------------------------------------------- the birds ---- */

/** A small bird the home places in the world for one play (a woodlark, a magpie): its
 *  model, removed and freed at the end. */
export interface Bird {
  root: THREE.Object3D;
  dispose(): void;
}

/** Spawn a bird model at `height` m (feet at y 0), hidden until placed. */
export async function spawnBird(k: AdventureKit, model: string, height: number): Promise<(Bird & { sp: Spawned }) | null> {
  const sp = await k.ctx.spawnModel(model, { height, idle: false });
  if (!sp) return null;
  const root = sp.root as THREE.Object3D;
  root.visible = false;
  root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; } });
  return { sp, root, dispose: () => sp.dispose() };
}

/**
 * A low flight from `a` to `b` (world spots, heights above the ground at each end) over
 * `secs`: the bird rises on a gentle arc (`up` m over the straight line at its middle),
 * facing the way it flies, wings level (no roll). Returns a stepper: call each frame with
 * dt; true once it has landed. Under reduced motion it is simply there.
 */
export function flight(k: AdventureKit, root: THREE.Object3D, a: Spot & { y: number }, b: Spot & { y: number }, secs: number, up: number): (dt: number) => boolean {
  let t = 0;
  const g = k.ctx.groundY;
  const yaw = headingTo(a, b);
  return (dt: number): boolean => {
    t = k.reduced ? 1 : Math.min(1, t + dt / secs);
    const e = t * t * (3 - 2 * t);
    const x = a.x + (b.x - a.x) * e, z = a.z + (b.z - a.z) * e;
    const y0 = g(a.x, a.z) + a.y, y1 = g(b.x, b.z) + b.y;
    const y = y0 + (y1 - y0) * e + up * Math.sin(Math.PI * e);
    root.position.set(x, Math.max(y, g(x, z) + 0.02), z);
    root.rotation.set(0, yaw, 0);
    return t >= 1;
  };
}
