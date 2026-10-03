/**
 * ree.finds.ts — something to notice at the reekalf's home (run 7, package ree-discover,
 * design `state/ree/design.md` §6.8): the THREE half of this home's discoveries.
 *
 * Each play holds one or two small things of the heath (ree.variety.ts `reeSurprises`,
 * drawn from the play's seed; the ones he has not found yet first): a woodlark that sings
 * up out of the heather ahead of him on one of his walks, rises, hangs singing as it
 * drifts on and drops back in; a buzzard that comes down to circle low over the heath
 * beyond his hide while he walks there, mewing; a cuckoo the mother turns her head to in
 * the watch (ree.ts: one listening pause's cue); a young birch a roebuck rubbed pale beside
 * his path (ree.home.ts lays it). Sometimes a little extra with no row: a stonechat ticking
 * on a heather stalk beside his way to the hide, or a heath blue crossing it.
 *
 * A discovery is WHAT HE SAW, HEARD OR WALKED UP TO (`Sightings`): in his picture, not
 * behind the ground, near enough and long enough — then `k.discover` records it, and its
 * calm reveal waits for a quiet beat. Nothing here ever happens during the search, a hold
 * or a listening pause that is not its own: the birds fly only on the walks.
 */

import * as THREE from 'three';
import type { AdventureKit } from '../kit';
import type { Spot } from '../types';
import type { Spawned } from '../../play/types';
import { groundHides } from '../../world/surprises-math';
import { listenerOf } from '../../world/Residents';
import { Sound } from '../../../core/sound';
import { store } from '../../../core/state';
import { dist, headingTo, toLocal } from '../places';
import { BIRCH_NEAR, BUZZARD, LARK, heathFor, larkFlight, larkRoom, larkWays, type PoolSpot, type ReeLayout } from './ree.places';
import type { ReeSurprises } from './ree.variety';

const MISSION = 'ree-niet-aanraken';
/** The veldgids's id of a thing of this home. */
export const findId = (thing: string): string => `${MISSION}.${thing}`;

/* ------------------------------------------------------------- seeing ---- */

/** Something he discovers by seeing it: in his picture (on screen, not behind the ground),
 *  at least `px` big, within `within` m of him, for `secs` on end. */
interface Watch {
  id: string;
  object: () => THREE.Object3D | null;
  within: number;
  secs: number;
  px: number;
  /** may it count now? */
  when?: () => boolean;
  /** recorded without its reveal (he will meet it again: the reveal waits for a quieter one) */
  quiet?: boolean;
  /** called once he saw it */
  then?: () => void;
}

const BOX = new THREE.Box3();
const LOOK = new THREE.Vector3();
const C = new THREE.Vector3();
const P = new THREE.Vector3();

/** How big (px, the larger side of its box) an object is in the picture, and whether it is
 *  on screen (centre inside the picture, in front of the lens). */
export function inPicture(cam: THREE.PerspectiveCamera, o: THREE.Object3D, w: number, h: number): { px: number; on: boolean; centre: THREE.Vector3 } {
  o.updateWorldMatrix(true, true);
  BOX.setFromObject(o);
  if (BOX.isEmpty()) return { px: 0, on: false, centre: C.set(0, 0, 0) };
  BOX.getCenter(C);
  P.copy(C).project(cam);
  const on = P.z > -1 && P.z < 1 && Math.abs(P.x) <= 0.97 && Math.abs(P.y) <= 0.97;
  if (!on) return { px: 0, on, centre: C };
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    P.set(i & 1 ? BOX.max.x : BOX.min.x, i & 2 ? BOX.max.y : BOX.min.y, i & 4 ? BOX.max.z : BOX.min.z).project(cam);
    x0 = Math.min(x0, P.x); x1 = Math.max(x1, P.x); y0 = Math.min(y0, P.y); y1 = Math.max(y1, P.y);
  }
  return { px: Math.max(((x1 - x0) / 2) * w, ((y1 - y0) / 2) * h), on, centre: C };
}

/** Watches this home's things each frame; records one once he really saw it. */
export class Sightings {
  private readonly list: { w: Watch; run: number; done: boolean; px: number }[] = [];
  private readonly k: AdventureKit;

  constructor(k: AdventureKit) {
    this.k = k;
    k.onTick((dt) => this.update(dt));
  }

  watch(w: Watch): void { this.list.push({ w, run: 0, done: false, px: 0 }); }

  private update(dt: number): void {
    const k = this.k;
    const cam = k.world.camera;
    const w = k.ctx.canvas.clientWidth || 1280, h = k.ctx.canvas.clientHeight || 800;
    const me = k.ranger();
    for (const s of this.list) {
      if (s.done) continue;
      const o = s.w.object();
      if (!o || !o.visible || (s.w.when && !s.w.when())) { s.run = 0; continue; }
      const pic = inPicture(cam, o, w, h);
      s.px = pic.px;
      const ok = pic.on && pic.px >= s.w.px && dist(me, { x: pic.centre.x, z: pic.centre.z }) <= s.w.within
        && !groundHides(cam.position, pic.centre, k.ctx.groundY);
      s.run = ok ? s.run + dt : 0;
      // (the dev read: how big it showed at most while it counted)
      if (ok) { const key = `px_${s.w.id.slice(s.w.id.indexOf('.') + 1)}`; k.stats[key] = Math.max(k.stats[key] ?? 0, Math.round(pic.px)); }
      if (s.run >= s.w.secs) {
        s.done = true;
        k.discover(s.w.id, { quiet: s.w.quiet });
        s.w.then?.();
      }
    }
  }

  /** The dev read: how big (px) each thing still watched shows now. */
  read(): Record<string, number> {
    return Object.fromEntries(this.list.filter((s) => !s.done).map((s) => [s.w.id, Math.round(s.px)]));
  }
}

/* ----------------------------------------------------------- the birds ---- */

/** A bird of this play: its model, hidden until it flies, freed at the end. */
interface Bird { sp: Spawned; root: THREE.Object3D }

/** How big (m, its standing height) the birds are drawn: the woodlark a little bigger than
 *  life (it is a small brown bird far off in the picture: at life size a speck), the
 *  stonechat as the stand's look-alike. */
const LARK_H = 0.3;
const TAPUIT_H = 0.17;
/** The stonechat perches this high (m) over the ground: on a dry stalk over the heather. */
const TAPUIT_UP = 0.42;

/** The woodlark is seen within this far (m) of him, at least this big (px), this long (s). */
const LARK_SEEN = { within: 26, px: 9, secs: 1.5 } as const;
/** …the buzzard. */
const BUZZARD_SEEN = { within: 36, px: 18, secs: 1.5 } as const;

/**
 * This play's small things in the world (the woodlark, the buzzard, the rubbed birch's
 * discovery, the little extra); ree.ts calls the walk hooks. Everything it spawned goes at
 * the end (`dispose`), a stop included.
 */
export class ReeFinds {
  readonly seen: Sightings;
  private readonly k: AdventureKit;
  private readonly l: ReeLayout;
  private readonly s: ReeSurprises;
  /** this play's small things (ree.variety.ts `reeSurprises`) */
  get surprises(): ReeSurprises { return this.s; }
  private readonly pool: PoolSpot | null;
  private readonly birds: Bird[] = [];
  private lark: Bird | null = null;
  private larkState: 'waiting' | 'flying' | 'done' = 'waiting';
  private larkStep: ((dt: number) => boolean) | null = null;
  private buzz: Bird | null = null;
  private buzzStep: ((dt: number) => void) | null = null;
  private buzzLeaving = false;
  private tapuit: Bird | null = null;
  private butterfly: Bird | null = null;
  private walkFrom: Spot | null = null;
  private retryAt = 0;
  private readonly offs: (() => void)[] = [];
  private disposed = false;

  constructor(k: AdventureKit, l: ReeLayout, s: ReeSurprises, pool: PoolSpot | null) {
    this.k = k; this.l = l; this.s = s; this.pool = pool;
    this.seen = new Sightings(k);
    // the birds are loaded at the start, hidden (never a hitch when one flies up)
    if (s.leeuwerik) void this.spawn('bird-boomleeuwerik', LARK_H).then((b) => { this.lark = b; });
    if (s.small.includes('buizerd')) void this.spawn('bird-buizerd').then((b) => { this.buzz = b; });
    if (s.extra === 'tapuit') void this.spawn('bird-roodborsttapuit', TAPUIT_H).then((b) => { this.tapuit = b; });
    if (s.extra === 'vlinder') void this.spawn('heideblauwtje').then((b) => { this.butterfly = b; });
    // (each bird counts only on the walk it flies on, so its calm reveal comes on that walk:
    // never held back by the reveal queue to land on the story's climax)
    this.seen.watch({ id: findId('leeuwerik'), object: () => this.lark?.root ?? null, when: () => this.larkState === 'flying' && k.beat === `walk:${s.leeuwerik}`, ...LARK_SEEN });
    this.seen.watch({ id: findId('buizerd'), object: () => this.buzz?.root ?? null, when: () => !!this.buzzStep && !this.buzzLeaving && k.beat === 'walk:hide', ...BUZZARD_SEEN });
    this.offs.push(k.onTick((dt) => { if (this.larkStep && this.larkStep(dt)) this.larkStep = null; this.buzzStep?.(dt); }));
  }

  private async spawn(model: string, height?: number): Promise<Bird | null> {
    const sp = await this.k.ctx.spawnModel(model, { ...(height !== undefined ? { height } : {}), idle: false });
    if (!sp) return null;
    if (this.disposed) { sp.dispose(); return null; }
    const root = sp.root as THREE.Object3D;
    root.visible = false;
    root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; } });
    (this.k.ctx.scene as THREE.Scene).add(root);
    const b = { sp, root };
    this.birds.push(b);
    return b;
  }

  /* ---------------------------------------------------------------- walks ---- */

  /** He turns away from the calf to leave the grass (calf:leave): the buzzard begins to come
   *  down now, so it hunts low over the heath ahead of him from the first steps of his walk
   *  to the hide — seen there, its card comes on that walk (review r1: it came down late in
   *  the walk, and its card waited for the reunion). */
  leaving(): void {
    if (this.s.small.includes('buizerd')) this.buzzardCome();
  }

  /** A walk begins (`name`: 'meadow' to the grass, 'hide' to the hide; `route`: the way a
   *  perfect player walks it, its goal last: the little extras sit along it). */
  walkStart(name: 'meadow' | 'hide', route: readonly Spot[] = []): void {
    this.walkFrom = { ...this.k.ranger() };
    this.route = [...route];
    if (name === 'hide' && this.s.small.includes('buizerd')) this.buzzardCome();
    if (name === 'hide' && this.s.extra === 'tapuit') this.tapuitPerch();
    if (name === 'hide' && this.s.extra === 'vlinder') this.butterflyCross();
  }

  /** Each frame of a walk: the woodlark may fly up (on its walk, once he is well under way
   *  and walking the way the flight has room for, and once the walk's own moment is done:
   *  `ready`, e.g. on the walk to the grass her slip into her cover), the rubbed birch is
   *  seen once he walks up to it. */
  walkTick(name: 'meadow' | 'hide', ready = true): void {
    const k = this.k;
    const me = k.ranger();
    const birch = this.birchAt();
    if (birch && dist(me, birch) <= BIRCH_NEAR) k.discover(findId('veegsporen'));
    if (this.s.leeuwerik !== name || this.larkState !== 'waiting' || !this.lark || k.reduced || !ready) return;
    if (!this.walkFrom || dist(me, this.walkFrom) < 3 || me.speed < 0.6 || k.now < this.retryAt) return;
    // (along the way the walk's lens looks, once it looks the way he walks: it flies up in
    // his picture, never off to the side of it while the lens still swings round)
    const look = k.world.camera.getWorldDirection(LOOK);
    const lens = Math.atan2(look.x, look.z);
    if (Math.abs(Math.atan2(Math.sin(lens - me.heading), Math.cos(lens - me.heading))) > 0.4) { this.retryAt = k.now + 0.25; return; }
    const side = k.play.fork('ree-leeuwerik-kant').pick([1, -1] as const);
    for (const w of larkWays(side)) {
      const h = lens + w.side * w.turn;
      if (!larkRoom(me, h, w.side, this.pool)) continue;
      this.fly(me, h, w.side);
      return;
    }
    this.retryAt = k.now + 0.5;
  }

  /** A walk ends: the woodlark drops into the heather (never over the search or the
   *  watch), the buzzard climbs away and the stonechat flits off. */
  walkEnd(name: 'meadow' | 'hide'): void {
    if (this.larkState === 'flying') this.larkDown = true;
    if (name !== 'hide') return;
    this.buzzardGo();
    this.tapuitGo?.();
  }

  /** The walk ended while the woodlark flew: it drops into the heather now. */
  private larkDown = false;


  /** The stonechat flits off (set while it perches). */
  private tapuitGo: (() => void) | null = null;

  /** The rubbed birch of this play (ree.home.ts lays it), or null. */
  birchAt: () => Spot | null = () => null;

  /* ---------------------------------------------------------- the woodlark ---- */

  /** (the dev read: where a bird is now, for a test that looks for it in the picture) */
  private readonly at = (name: string, p: THREE.Vector3): void => {
    const st = this.k.stats;
    st[`${name}_x`] = Math.round(p.x * 10) / 10; st[`${name}_y`] = Math.round(p.y * 10) / 10; st[`${name}_z`] = Math.round(p.z * 10) / 10;
  };

  /** Up out of the heather, singing, and back down. */
  private fly(at: Spot, heading: number, side: 1 | -1): void {
    const b = this.lark!;
    const k = this.k;
    const g = k.ctx.groundY;
    const f = larkFlight(at, heading, side);
    this.larkState = 'flying';
    k.stats.leeuwerik = 1;
    const sing = (): void => {
      if (!store.get().settings.geluid) return;
      const p = b.root.position;
      Sound.callAt('boomleeuwerik', p.x, p.z, listenerOf(k.world.camera), 34);
    };
    // (it faces the way it flies: across the picture, side-on to the lens)
    const along = (a: Spot, c: Spot): number => headingTo(a, c);
    const yaw = along(f.top, f.drift);
    let t = 0, sang = 0;
    const T1 = LARK.riseS, T2 = T1 + LARK.hangS, T3 = T2 + LARK.dropS;
    b.root.visible = true;
    if (store.get().settings.geluid) Sound.rustle(); // (a flutter in the heather)
    let down: { t: number; x: number; y: number; z: number } | null = null;
    this.larkStep = (dt: number): boolean => {
      t += dt;
      let x: number, z: number, y: number, pitch: number;
      // (the walk ended: it drops straight into the heather where it is, in a moment)
      if (this.larkDown && !down && t < T2) { const p = b.root.position; down = { t, x: p.x, y: p.y, z: p.z }; }
      if (down) {
        const u = Math.min(1, (t - down.t) / 0.9);
        const fx = Math.sin(yaw) * 1.2 * u, fz = Math.cos(yaw) * 1.2 * u;
        b.root.position.set(down.x + fx, g(down.x + fx, down.z + fz) + 0.05 + (down.y - g(down.x, down.z) - 0.05) * (1 - u * u), down.z + fz);
        b.root.rotation.set(0.35, yaw, 0, 'YXZ');
        if (u < 1) return false;
        b.root.visible = false;
        this.larkState = 'done';
        return true;
      }
      if (t < T1) {
        // up out of the heather on its way: quick at first, slowing toward its top
        const e = 1 - (1 - t / T1) ** 2;
        x = f.rise.x + (f.top.x - f.rise.x) * e; z = f.rise.z + (f.top.z - f.rise.z) * e;
        y = g(x, z) + 0.05 + (f.top.y - 0.05) * e;
        pitch = -0.35 * (1 - e) - 0.08;
      } else if (t < T2) {
        // it hangs singing, drifting on, rising and falling a little as it flutters
        const u = (t - T1) / LARK.hangS;
        x = f.top.x + (f.drift.x - f.top.x) * u; z = f.top.z + (f.drift.z - f.top.z) * u;
        y = g(x, z) + f.top.y + (f.drift.y - f.top.y) * u + Math.sin(u * Math.PI * 5) * 0.12;
        pitch = -0.08;
        if (sang === 0 || (sang === 1 && u > 0.45)) { sang += 1; sing(); }
      } else if (t < T3) {
        // and drops back into the heather further on, steep at the end
        const u = (t - T2) / LARK.dropS, e = u * u;
        x = f.drift.x + (f.land.x - f.drift.x) * u; z = f.drift.z + (f.land.z - f.drift.z) * u;
        y = g(x, z) + 0.05 + (f.drift.y - 0.05) * (1 - e);
        pitch = 0.35 * u;
      } else {
        b.root.visible = false;
        this.larkState = 'done';
        return true;
      }
      b.root.position.set(x, y, z);
      b.root.rotation.set(pitch, t < T1 ? along(f.rise, f.top) : t < T2 ? yaw : along(f.drift, f.land), 0, 'YXZ');
      this.at('leeuwerik', b.root.position);
      return false;
    };
  }

  /* ----------------------------------------------------------- the buzzard ---- */

  /** It comes down in a slow spiral from high over the heath to circle low beyond his hide. */
  private buzzardCome(): void {
    const b = this.buzz;
    if (!b || this.k.reduced || this.buzzStep) return;
    const k = this.k;
    const c = this.l.buzzard;
    const g = k.ctx.groundY;
    const mew = k.play.fork('ree-buizerd');
    let ang = mew.between(0, Math.PI * 2);
    let w = 0, nextMew = mew.between(2.5, 4);
    let t = 0;
    k.stats.buizerd = 1;
    b.root.visible = true;
    const away = { x: c.x - k.ranger().x, z: c.z - k.ranger().z };
    const al = Math.hypot(away.x, away.z) || 1;
    this.buzzStep = (dt: number): void => {
      t += dt;
      // down (w → 1) while it comes, up and away (w → 0) once he is at the hide
      w = this.buzzLeaving ? Math.max(0, w - dt / BUZZARD.goS) : Math.min(1, w + dt / BUZZARD.comeS);
      const e = w * w * (3 - 2 * w);
      ang += ((Math.PI * 2) / BUZZARD.period) * dt;
      const r = BUZZARD.r * (1.6 - 0.6 * e);
      // (leaving, its circle drifts on away from him as it climbs)
      const drift = this.buzzLeaving ? (1 - e) * 14 : 0;
      const cx = c.x + (away.x / al) * drift, cz = c.z + (away.z / al) * drift;
      const x = cx + Math.cos(ang) * r, z = cz + Math.sin(ang) * r;
      const y = g(c.x, c.z) + BUZZARD.high + (BUZZARD.y - BUZZARD.high) * e + Math.sin(ang * 2) * 0.3;
      b.root.position.set(x, y, z);
      this.at('buizerd', b.root.position);
      // it faces the way it flies (round its circle), banked a little into the turn
      b.root.rotation.set(0, Math.atan2(-Math.sin(ang), Math.cos(ang)), 0.18, 'YXZ');
      if (t > nextMew) {
        nextMew = t + mew.between(6, 9);
        if (store.get().settings.geluid && e > 0.3) Sound.callAt('buizerd', x, z, listenerOf(k.world.camera), 40);
      }
      if (this.buzzLeaving && w <= 0) { b.root.visible = false; this.buzzStep = null; }
    };
  }

  private buzzardGo(): void {
    if (this.buzzStep) this.buzzLeaving = true;
  }

  /* ------------------------------------------------------ the little extras ---- */

  /** A stonechat on a heather stalk beside his way to the hide, a little ahead: it ticks,
   *  and flits off low over the heather once he comes near. */
  private tapuitPerch(): void {
    const b = this.tapuit;
    if (!b) return;
    const k = this.k;
    const spot = this.besideWay(5.5, 2.2);
    if (!spot) return;
    const g = k.ctx.groundY;
    // (it sits on a dry stalk sticking out of the heather, as the stand's own does)
    const stalk = k.own(new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.009, TAPUIT_UP, 5), new THREE.MeshStandardMaterial({ color: '#c9b07a', roughness: 1 })));
    stalk.position.set(spot.x, g(spot.x, spot.z) + TAPUIT_UP / 2, spot.z);
    b.root.position.set(spot.x, g(spot.x, spot.z) + TAPUIT_UP, spot.z);
    b.root.rotation.set(0, headingTo(spot, k.ranger()) + 0.9, 0);
    b.root.visible = true;
    k.stats.tapuit = 1;
    let t = 0, tick = 1.2, flown = -1;
    this.tapuitGo = () => { if (flown < 0) flown = t; };
    const from = { ...spot };
    const off = k.onTick((dt) => {
      t += dt;
      const me = k.ranger();
      if (flown < 0 && t > tick) {
        tick = t + 2.6;
        if (store.get().settings.geluid && dist(me, spot) < 16) Sound.callAt('roodborsttapuit', spot.x, spot.z, listenerOf(k.world.camera), 18);
      }
      if (flown < 0 && dist(me, spot) < 3.2) flown = t;
      if (flown >= 0) {
        // low over the heather, away from him, and down out of sight
        const u = Math.min(1, (t - flown) / 1.6);
        const a = headingTo(me, from);
        const x = from.x + Math.sin(a) * 6 * u, z = from.z + Math.cos(a) * 6 * u;
        b.root.position.set(x, g(x, z) + TAPUIT_UP + Math.sin(u * Math.PI) * 0.7 - TAPUIT_UP * u, z);
        b.root.rotation.set(0, a, 0);
        if (u >= 1) { b.root.visible = false; off(); this.tapuitGo = null; }
      }
    });
    this.offs.push(off);
  }

  /** A heath blue flutters across his way a few metres ahead, low over the heather. */
  private butterflyCross(): void {
    const b = this.butterfly;
    if (!b) return;
    const k = this.k;
    const mid = this.besideWay(6, 0);
    if (!mid) return;
    const me = k.ranger();
    const h = headingTo(me, mid);
    const across = { x: -Math.cos(h), z: Math.sin(h) };
    const from = { x: mid.x - across.x * 3, z: mid.z - across.z * 3 };
    const g = k.ctx.groundY;
    let t = 0;
    const T = 5.5;
    b.root.visible = true;
    k.stats.vlinder = 1;
    const off = k.onTick((dt) => {
      t += dt;
      const u = Math.min(1, t / T);
      const x = from.x + across.x * 6 * u + Math.sin(u * 13) * 0.18, z = from.z + across.z * 6 * u;
      b.root.position.set(x, g(x, z) + 0.45 + Math.abs(Math.sin(u * 21)) * 0.25, z);
      b.root.rotation.set(0, Math.atan2(across.x, across.z), 0);
      if (u >= 1) { b.root.visible = false; off(); }
    });
    this.offs.push(off);
  }

  /** The walk's way (from where he is: its points, its goal last). */
  private route: Spot[] = [];

  /** A spot `ahead` m along the walk's way from where he is (round the grass, by the pool:
   *  where he will walk, so it is in his picture as he comes), `aside` m to its side, on open
   *  heath (or null). */
  private besideWay(ahead: number, aside: number): Spot | null {
    const me = this.k.ranger();
    const way = [{ x: me.x, z: me.z }, ...(this.route.length ? this.route : [this.l.hide])];
    let left = ahead;
    for (let i = 1; i < way.length; i++) {
      const a = way[i - 1], b = way[i], L = dist(a, b);
      if (L < left && i < way.length - 1) { left -= L; continue; }
      const at = { x: a.x + ((b.x - a.x) / (L || 1)) * Math.min(left, L), z: a.z + ((b.z - a.z) / (L || 1)) * Math.min(left, L) };
      const h = headingTo(a, b);
      for (const s of [1, -1]) {
        const p = { x: at.x - Math.cos(h) * aside * s, z: at.z + Math.sin(h) * aside * s };
        if (dist(p, this.l.hide) > 2.5 && heathFor(p, this.pool) && toLocal({ ...me, heading: headingTo(me, at) }, p).v > 2) return p;
      }
      return null;
    }
    return null;
  }

  /** Everything this play spawned goes (the end, a stop included). */
  dispose(): void {
    this.disposed = true;
    for (const off of this.offs) off();
    this.larkStep = null;
    this.buzzStep = null;
    for (const b of this.birds) { b.root.removeFromParent(); b.sp.dispose(); }
    this.birds.length = 0;
  }
}
