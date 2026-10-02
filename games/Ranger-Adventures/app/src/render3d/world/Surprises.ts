/**
 * world/Surprises.ts — the open world's small surprises (run 7, design
 * `state/foundation/design.md` §7.2): now and then, while he walks or drives on his own, a
 * little of the Veluwe happens near him. A buzzard comes down to circle low over the heath
 * and mews; a woodpecker drums on a trunk; a cuckoo calls from a crown in the morning; a
 * wren sings at a tree's foot; a robin hops after him a little way; and, rarely and only in
 * their own light, a stag stands at the forest edge in the mist or at dusk, or a badger
 * waddles past at dusk. No wolf, no adder: nothing that could scare.
 *
 * The director's rules are pure (surprises-math.ts): only in free roam (WorldSession says
 * when: no mission, no briefing, no first-minute lesson, no menu, not in the helicopter),
 * one at a time, ≥ 45 s apart, drawn from the visit's seed (`?seed=N` replays a visit), the
 * ones he has not met first. It stages its animal 12-30 m off inside his picture, never on
 * the line he walks along, never in a mission's home, never coming toward the lens; it
 * fades in and out (a cut under reduced motion, where only the still ones come). He meets
 * it when he SEES it (on screen ≥ 40 px within 35 m for a second) or HEARS its call
 * (within 25 m): WorldSession records `wereld.<id>` and its reveal waits for a quiet
 * moment. It goes when he walks 45 m off, comes too near, or after its time (≤ 60 s),
 * and never blocks a walk: nothing it stages is solid, and a jeep gives way to the two
 * that walk. ≤ 2 draw calls each.
 */

import * as THREE from 'three';
import { spawnModel } from '../play/spawn';
import { loadModel, prepModel, renderedBox } from '../Models';
import { restFar } from '../play/fade';
import { Sound } from '../../core/sound';
import { newPlay, hash32, sessionSeed, type Play } from '../../core/play';
import { TREE_BASE_H, type TreePlacement } from './Forest';
import { crownOf, blocksLine, type Crown } from './Crowns';
import { listenerOf } from './Residents';
import { sizeRow } from '../AnimalScale';
import type { Spawned } from '../play/types';
import type { Terrain } from './Terrain';
import type { Fauna } from './Fauna';
import type { MoodId } from '../Moods';
import {
  surpriseOrder, tryNow, firstAt, nextAfter, RETRY_S, groundSpots, treeChoices, awayFrom, acrossFrom, CONE, ALL_ROUND,
  SeenMeter, groundHides, shouldGo, robinSpot, robinHop, bearing, HEARD_M, ROBIN_SIDE, ROBIN_ALONG,
  type SurpriseId, type SurpriseSpec, type Viewer,
} from './surprises-math';

/** What the director needs from the world (World.ts builds it). */
export interface SurprisesEnv {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  terrain: Terrain;
  /** every forest tree (the scatter, the rim, the groves): perches and feet */
  trees: () => readonly TreePlacement[];
  /** the world's gliding buzzard */
  fauna: Fauna;
  /** free open ground for an animal of radius r: dry, clear of solids, no mission's home, no marker */
  ground: (x: number, z: number, r: number) => boolean;
  /** a mission's home ground or a marker lies within r of (x, z) */
  homeNear: (x: number, z: number, r: number) => boolean;
  /** the small solid things a bird may sit on or by: a boulder, a juniper, a stump, a snag
   *  (centre, footprint radius, height) */
  perches: () => readonly { x: number; z: number; r: number; h: number }[];
  /** the picture's height in px (for "big enough") */
  viewH: () => number;
}

/** What it reads each frame. */
export interface SurpriseFrame {
  /** free roam now (on foot or in the jeep; no mission, briefing, lesson, helicopter) */
  free: boolean;
  /** a menu card is up: nothing moves on, nothing new comes */
  paused: boolean;
  ranger: { x: number; z: number; running: boolean };
  onFoot: boolean;
  reduced: boolean;
}

/** What it tells the game (WorldSession wires it to the save and the reveal). */
export interface SurpriseHooks {
  /** he saw or heard it (once per surprise) */
  met(id: SurpriseId, how: 'seen' | 'heard'): void;
  /** it went (`met`: he met it while it was there) */
  done(id: SurpriseId, met: boolean): void;
  /** his discoveries (content ids) */
  found(): Readonly<Record<string, unknown>>;
  /** surprises met since the last rare one */
  sinceRare(): number;
  mood(): MoodId;
  /** sound on (a call he cannot hear is no meeting) */
  sound(): boolean;
}

/** The dev read (`__ranger.surprise()`). */
export interface SurpriseReadout {
  clock: number;
  next: number;
  /** how long (s) the next one has been due (it waits for a place for a new one: ≤ FRESH_WAIT_S), or -1 */
  waited: number;
  count: number;
  active: null | { id: SurpriseId; x: number; y: number; z: number; age: number; state: string; met: string | null; px: number; dist: number; onScreen: boolean;
    /** the draw calls it adds while drawn (its meshes; the buzzard is the world's own glider: 0) */
    calls: number };
  log: { id: SurpriseId; at: number; met: string | null }[];
}

/** How far (m from the lens) a surprise's call carries. */
const CALL_REACH = 32;
/** How long (s) a surprise fades in or out. */
const FADE_S = 1.2;
/** A stag stands this long (s) before he walks on (or once seen, a little while after). */
const STAG_STAND_S = 9;
const STAG_WALK = 1.05;   // m/s
const BADGER_WALK = 0.5;  // m/s
/** The buzzard's low circle: its radius (m), its height over the ground (m), one turn (s).
 *  Low over the heath and a little way ahead, where the walk lens sees it (a circle right
 *  over him would be above the picture). */
const LOW_R = 7;
const LOW_Y = 4.6;
const LOW_PERIOD = 15;

interface Active {
  spec: SurpriseSpec;
  /** its own model (null for the buzzard, the world's glider) */
  sp: Spawned | null;
  group: THREE.Group | null;
  /** its size in the picture: the larger of its height and length (m) */
  size: number;
  age: number;
  fade: number;
  leaving: boolean;
  /** begun at (free-roam clock) */
  start: number;
  meter: SeenMeter;
  met: 'seen' | 'heard' | null;
  callIn: number;
  fork: Play;
  /** where it walks to (a unit direction), or hops */
  dir: { x: number; z: number } | null;
  /** the stag's or the badger's time standing still */
  stand: number;
  /** where it was staged (the buzzard: its low circle's centre) */
  home: { x: number; z: number };
  /** a hop (or the robin's flutter, its glide in) under way: from, to, how far along (0-1),
   *  how long (s), its arc's height (m) and the height it began at over the ground (m) */
  hop: { fx: number; fz: number; tx: number; tz: number; t: number; dur?: number; lift?: number; from?: number } | null;
  /** a perch up a tree (its world height) */
  perchY: number;
  px: number;
  dist: number;
  onScreen: boolean;
  occludedAt: number;
  occluded: boolean;
  /** the tree it is on or at (its own crown never hides it) */
  tree: TreePlacement | null;
  /** the robin: its side of him (±1), how far off his line and along it it likes to be */
  beside: { side: number; lat: number; along: number } | null;
  /** its model's own box (in its group's space): how big it stands in the picture */
  box: THREE.Box3 | null;
  state: string;
}

export class Surprises {
  private readonly env: SurprisesEnv;
  private hooks: SurpriseHooks | null = null;
  private readonly root: Play;
  private clock = 0;
  private next = Number.NaN;
  private k = 0;
  private last: SurpriseId | null = null;
  private active: Active | null = null;
  private staging = false;
  /** free roam on the last frame (a surprise staged after a mission began is let go) */
  private free = false;
  private readonly log: SurpriseReadout['log'] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly treeModels = new Map<string, THREE.Group>();
  private readonly v = new THREE.Vector3();
  private blobTex: THREE.Texture | null = null;
  private lastRanger = { x: 0, z: 0 };
  /** when (free-roam clock) the next one became due: the director may wait a while for a
   *  place for one he has not met (surprises-math tryNow); NaN while none is due */
  private dueAt = Number.NaN;

  constructor(env: SurprisesEnv, seed = hash32(sessionSeed(), 'surprises')) {
    this.env = env;
    this.root = newPlay('wereld', seed, 0);
  }

  setHooks(h: SurpriseHooks | null): void {
    this.hooks = h;
  }

  /** The two that walk (the stag, the badger), for the jeep to give way to. */
  movers(visit: (id: string, x: number, z: number) => void): void {
    const a = this.active;
    if (a?.group && a.spec.plek === 'grond' && a.group.visible) visit(a.spec.model ?? a.spec.id, a.group.position.x, a.group.position.z);
  }

  state(): SurpriseReadout {
    const a = this.active;
    const p = a ? this.where(a) : null;
    return {
      clock: Math.round(this.clock * 10) / 10,
      next: Number.isNaN(this.next) ? -1 : Math.round(this.next * 10) / 10,
      waited: Number.isNaN(this.dueAt) ? -1 : Math.round((this.clock - this.dueAt) * 10) / 10,
      count: this.log.length,
      active: a && p ? { id: a.spec.id, x: p.x, y: p.y, z: p.z, age: Math.round(a.age * 10) / 10, state: a.state, met: a.met, px: Math.round(a.px), dist: Math.round(a.dist * 10) / 10, onScreen: a.onScreen, calls: drawCallsOf(a.group) } : null,
      log: this.log.map((l) => ({ ...l })),
    };
  }

  /** Per frame (World.update). */
  update(dt: number, f: SurpriseFrame): void {
    this.free = f.free && !f.paused;
    if (!this.hooks || f.paused) return;
    const a = this.active;
    if (!f.free) {
      // a mission, a briefing, a lesson: whatever is out there goes at once (never into a game)
      if (a && !a.leaving) this.leave(a, true);
      if (a) this.step(a, dt, f);
      return;
    }
    this.clock += dt;
    if (Number.isNaN(this.next)) this.next = firstAt(this.root.fork('first'));
    if (a) { this.step(a, dt, f); return; }
    if (!this.staging && this.clock >= this.next) void this.begin(f);
  }

  /* ------------------------------------------------------------ begin ---- */

  private viewer(f: SurpriseFrame): Viewer {
    return { x: f.ranger.x, z: f.ranger.z, yaw: listenerOf(this.env.camera).yaw };
  }

  /** Choose the next one and stage it (or try again in a little while, as he walks on). */
  private async begin(f: SurpriseFrame): Promise<void> {
    const h = this.hooks!;
    const n = this.k++;
    const fork = this.root.fork(`s${n}`);
    const shown = this.log.map((l) => l.id);
    const found = h.found();
    if (Number.isNaN(this.dueAt)) this.dueAt = this.clock;
    const order = surpriseOrder({ mood: h.mood(), found, sinceRare: h.sinceRare(), last: this.last, onFoot: f.onFoot, reduced: f.reduced, shown }, fork.fork('order'));
    // one he has not met comes before any he knows: while there is no place for it where he
    // is, the director waits for it (≤ FRESH_WAIT_S), then a known one may come
    const now = tryNow(order, { found, shown, waited: this.clock - this.dueAt });
    const v = this.viewer(f);
    this.staging = true;
    let staged = false;
    try {
      for (const spec of now) {
        const placed = await this.place(spec, v, fork.fork(`place:${spec.id}`));
        if (!this.free) break; // (a mission began meanwhile)
        if (placed && await this.stage(spec, placed, fork, f)) { staged = true; this.dueAt = Number.NaN; break; }
      }
    } finally {
      this.staging = false;
    }
    if (!staged) this.next = this.clock + RETRY_S;
  }

  /** Where this one may come now, or null. */
  private async place(spec: SurpriseSpec, v: Viewer, fork: Play): Promise<Placed | null> {
    const { terrain, ground, homeNear } = this.env;
    switch (spec.plek) {
      case 'lucht': {
        // the buzzard's low circle: over open ground ahead (not the forest), never a home's
        for (const p of groundSpots(v, spec.dist, fork)) {
          if (terrain.biome(p.x, p.z) === 'bos') continue;
          const y = terrain.y(p.x, p.z) + LOW_Y;
          if (this.hidden(p.x, y, p.z, null)) continue; // (not behind the crowns: where he sees it)
          return { x: p.x, z: p.z, y, facing: 0 };
        }
        return null;
      }
      case 'stam':
      case 'kroon':
      case 'voet': {
        // a forest tree that can carry it, anywhere within hearing (met by its call: the call,
        // panned from where it is, turns him to look), the ones in his picture first
        const trees = treeChoices(v, this.env.trees(), spec.dist, fork, ALL_ROUND).filter((t) => !homeNear(t.x, t.z, 4));
        for (const t of trees.slice(0, 14)) {
          const p = await this.onTree(spec.plek, t, v, fork);
          // where he can see it once he looks that way (a bird on a trunk hidden by another
          // tree's leaves would be a sound with nothing to find)
          if (p && (spec.plek === 'voet' || !this.hidden(p.x, p.y + 0.15, p.z, t, this.lensToward(v, p)))) return p;
        }
        if (spec.plek === 'stam') return null;
        // else on (the cuckoo) or by (the wren) a juniper, a boulder, a stump
        const perches = treeChoices(v, this.env.perches().filter((o) => o.h >= (spec.plek === 'kroon' ? 1.0 : 0.3) && !homeNear(o.x, o.z, 3)), spec.dist, fork, ALL_ROUND);
        for (const o of perches.slice(0, 8)) {
          if (spec.plek === 'kroon') {
            const y = terrain.y(o.x, o.z) + o.h - 0.04;
            if (!this.hidden(o.x, y + 0.15, o.z, null, this.lensToward(v, o))) return { x: o.x, z: o.z, y, facing: Math.atan2(v.x - o.x, v.z - o.z) + (fork.chance(0.5) ? 0.9 : -0.9) };
          } else {
            const a = Math.atan2(v.x - o.x, v.z - o.z) + fork.between(-1, 1);
            const x = o.x + Math.sin(a) * (o.r + 0.25), z = o.z + Math.cos(a) * (o.r + 0.25);
            return { x, z, y: terrain.y(x, z), facing: a + Math.PI / 2 };
          }
        }
        // the wren: in the heather anywhere near, singing (heard far more than seen)
        if (spec.plek === 'voet') {
          for (const p of groundSpots(v, spec.dist, fork)) if (ground(p.x, p.z, 0.3)) return { x: p.x, z: p.z, y: terrain.y(p.x, p.z), facing: fork.between(0, 6.28) };
        }
        return null;
      }
      case 'mee': {
        // the robin comes down beside him, about level with him, where the lens sees it big
        // enough: on open ground (never in his way), the seed's side first
        const first = fork.chance(0.5) ? 1 : -1;
        const lat = fork.between(ROBIN_SIDE[0], ROBIN_SIDE[1]);
        const along = fork.between(ROBIN_ALONG[0], ROBIN_ALONG[1]);
        for (const side of [first, -first]) {
          for (const k of [0, 0.4, -0.3]) {
            const p = robinSpot(v, v.yaw, side, lat + k * 0.5, Math.min(ROBIN_ALONG[1], along + k));
            if (!ground(p.x, p.z, 0.25) || homeNear(p.x, p.z, 2)) continue;
            if (this.hidden(p.x, terrain.y(p.x, p.z) + 0.15, p.z, null)) continue;
            return { x: p.x, z: p.z, y: terrain.y(p.x, p.z), facing: Math.atan2(v.x - p.x, v.z - p.z), beside: { side, lat, along } };
          }
        }
        return null;
      }
      case 'grond': {
        const stag = spec.id === 'edelhert';
        // the stag where the forest begins when there is such a spot in the picture, else
        // out on the open heath (a red deer crosses the Veluwe's heath at dawn and dusk)
        const spots = groundSpots(v, spec.dist, fork);
        const edge = (p: { x: number; z: number }): boolean => this.env.trees().some((t) => Math.hypot(t.x - p.x, t.z - p.z) < 9);
        if (stag) spots.sort((a, b) => Number(edge(b)) - Number(edge(a)));
        for (const p of spots) {
          if (!ground(p.x, p.z, stag ? 1.4 : 0.6)) continue;

          if (this.hidden(p.x, terrain.y(p.x, p.z) + (stag ? 1.2 : 0.25), p.z, null)) continue; // (in his picture)
          const side = fork.chance(0.5) ? 1 : -1;
          const dir = stag ? awayFrom(v, p, side) : acrossFrom(v, p, side);
          // a stag stands side-on to him (the shape he knows a stag by), turned the way he
          // will go; a badger is on its way already
          const sight = Math.atan2(p.x - v.x, p.z - v.z);
          const facing = stag ? sight + side * Math.PI / 2 : Math.atan2(dir.x, dir.z);
          return { x: p.x, z: p.z, y: terrain.y(p.x, p.z), facing, dir };
        }
        return null;
      }
    }
  }

  /** Every forest tree as the camera's occluder model (world/Crowns.ts): trunk and leaves. */
  private crowns(): readonly Crown[] {
    const trees = this.env.trees();
    if (this.crownList.length !== trees.length || this.crownsOf !== trees) {
      this.crownsOf = trees;
      this.crownList = trees.map((t, i) => crownOf(t.species, TREE_BASE_H[t.species] * t.s, t.x, t.y, t.z, i)).filter((k): k is Crown => !!k);
    }
    return this.crownList;
  }
  private crownList: Crown[] = [];
  private crownsOf: readonly TreePlacement[] | null = null;

  /** Do the ground, a trunk or leaves stand between the lens (or `from`) and (x, y, z)?
   *  Its own tree (`own`) never counts. */
  private hidden(x: number, y: number, z: number, own: TreePlacement | null, from: { x: number; y: number; z: number } = this.env.camera.position): boolean {
    const c = from;
    if (groundHides(c, { x, y, z }, (gx, gz) => this.env.terrain.y(gx, gz))) return true;
    const trees = this.env.trees();
    const mx = (c.x + x) / 2, mz = (c.z + z) / 2, half = Math.hypot(x - c.x, z - c.z) / 2 + 8;
    for (const k of this.crowns()) {
      if (Math.abs(k.x - mx) > half || Math.abs(k.z - mz) > half) continue;
      if (own && trees[k.tree] === own) continue;
      if (blocksLine(k, c.x, c.y, c.z, x, y, z, 0.02, 0.97)) return true;
    }
    return false;
  }

  /** Where the walk lens will be once he turns to look at (x, z): as far behind him and
   *  as high as it is now, on the far side of him from it. In his picture already: the lens
   *  itself. */
  private lensToward(v: Viewer, p: { x: number; z: number }): { x: number; y: number; z: number } {
    const c = this.env.camera.position;
    if (Math.abs(bearing(v, p.x, p.z)) <= CONE) return c;
    const boom = Math.hypot(c.x - v.x, c.z - v.z);
    const a = Math.atan2(p.x - v.x, p.z - v.z);
    return { x: v.x - Math.sin(a) * boom, y: c.y, z: v.z - Math.cos(a) * boom };
  }

  /** The bark, a crown's edge or a tree's foot on the side he can see. */
  private async onTree(plek: 'stam' | 'kroon' | 'voet', t: TreePlacement, v: Viewer, fork: Play): Promise<Placed | null> {
    const toMe = Math.atan2(v.x - t.x, v.z - t.z);
    const side = fork.chance(0.5) ? 1 : -1;
    const H = TREE_BASE_H[t.species] * t.s;
    const ground = this.env.terrain.y(t.x, t.z);
    if (plek === 'voet') {
      // on the ground by its foot, a little to his side of it
      const a = toMe + side * fork.between(0.5, 1.0);
      const d = 0.7 + 0.3 * t.s + fork.between(0, 0.5);
      const x = t.x + Math.sin(a) * d, z = t.z + Math.cos(a) * d;
      if (this.env.homeNear(x, z, 3)) return null;
      return { x, z, y: this.env.terrain.y(x, z), facing: a + side * Math.PI / 2, tree: t };
    }
    const model = await this.treeModel(t);
    if (!model) return null;
    if (plek === 'stam') {
      // clinging to the bark at 2.2-3.0 m, round the side he sees (in profile)
      const a = toMe + side * fork.between(0.75, 1.15);
      const hy = ground + fork.between(2.2, 3.0);
      const hit = this.hit(model, t.x + Math.sin(a) * 4, hy, t.z + Math.cos(a) * 4, -Math.sin(a), 0, -Math.cos(a));
      if (!hit || Math.hypot(hit.x - t.x, hit.z - t.z) > 0.9) return null;
      // it faces the bark (its beak to the trunk), its back to the open
      return { x: hit.x + Math.sin(a) * 0.03, z: hit.z + Math.cos(a) * 0.03, y: hy - 0.12, facing: a + Math.PI, tree: t };
    }
    // a crown's edge: where the low leaves begin, on his side, a little round
    const a = toMe + side * fork.between(0.2, 0.6);
    const hy = ground + H * fork.between(0.5, 0.6);
    const hit = this.hit(model, t.x + Math.sin(a) * 8, hy, t.z + Math.cos(a) * 8, -Math.sin(a), 0, -Math.cos(a));
    if (!hit) return null;
    return { x: hit.x, z: hit.z, y: hy - 0.05, facing: toMe + side * 0.9, tree: t };
  }

  /** The tree's own model (for one raycast), placed and sized like the forest's. */
  private async treeModel(t: TreePlacement): Promise<THREE.Group | null> {
    let base = this.treeModels.get(t.species);
    if (!base) {
      const m = await loadModel(t.species);
      if (!m) return null;
      base = prepModel(m, TREE_BASE_H[t.species]);
      this.treeModels.set(t.species, base);
    }
    const wrap = new THREE.Group();
    wrap.position.set(t.x, t.y, t.z);
    wrap.rotation.y = t.rotY;
    wrap.scale.setScalar(t.s);
    wrap.add(base);
    wrap.updateMatrixWorld(true);
    return wrap;
  }

  private hit(model: THREE.Object3D, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number): THREE.Vector3 | null {
    this.raycaster.set(new THREE.Vector3(ox, oy, oz), new THREE.Vector3(dx, dy, dz).normalize());
    this.raycaster.far = 12;
    const hits = this.raycaster.intersectObject(model, true);
    model.removeFromParent();
    return hits[0]?.point.clone() ?? null;
  }

  /** Bring it in (the buzzard: the world's glider comes down). */
  private async stage(spec: SurpriseSpec, p: Placed, fork: Play, f: SurpriseFrame): Promise<boolean> {
    let sp: Spawned | null = null;
    let group: THREE.Group | null = null;
    let box: THREE.Box3 | null = null;
    const row = sizeRow(spec.model);
    let size = Math.max(row?.h ?? 0.3, row?.len ?? 0.3);
    if (spec.plek === 'lucht') {
      if (!this.env.fauna.glider('bird-buizerd')) return false;
      this.env.fauna.swoop('bird-buizerd', { cx: p.x, cz: p.z, y: p.y, r: LOW_R, period: LOW_PERIOD });
      size = 1.26; // its wingspan (AnimalScale: buizerd len)
    } else {
      sp = spec.model ? await spawnModel(spec.model) : null;
      if (!sp) return false;
      if (!this.hooks || this.active || !this.free) { sp.dispose(); return false; }
      box = renderedBox(sp.root as THREE.Object3D, new THREE.Box3()); // (before it has a parent: its group's space; a rig as posed)
      group = new THREE.Group();
      group.add(sp.root as THREE.Object3D);
      group.position.set(p.x, p.y, p.z);
      group.rotation.y = p.facing;
      // a soft shadow under the badger (≤ 2 draw calls each: the stag's model is two already,
      // and far off in the mist or the dusk light a shadow under him does not read)
      if (spec.id === 'das') this.addBlob(group, 0.4);
      group.userData.surprise = spec.id;
      this.env.scene.add(group);
      restFar(group, f.reduced ? 1 : 0.0001);
    }
    this.active = {
      spec, sp, group, size, age: 0, fade: f.reduced ? 1 : 0, leaving: false, start: this.clock,
      meter: new SeenMeter(), met: null, callIn: spec.call ? fork.between(1.2, 2.6) : Infinity, fork,
      dir: p.dir ?? null, stand: 0, home: { x: p.x, z: p.z }, hop: null, perchY: p.y, px: 0, dist: 0, onScreen: false,
      occludedAt: -1, occluded: false, state: 'in', tree: p.tree ?? null, box, beside: p.beside ?? null,
    };
    // the robin flies in: a short low glide down to its spot from his side, outward
    if (group && p.beside && !f.reduced) {
      const v = this.viewer(f);
      const out = robinSpot(v, v.yaw, p.beside.side, p.beside.lat + 1.6, p.beside.along + 0.6);
      this.active.hop = { fx: out.x, fz: out.z, tx: p.x, tz: p.z, t: 0, dur: 0.75, lift: 0.9, from: 0.9 };
      group.position.set(out.x, this.env.terrain.y(out.x, out.z) + 0.9, out.z);
      group.rotation.y = Math.atan2(p.x - out.x, p.z - out.z);
    }
    this.last = spec.id;
    this.log.push({ id: spec.id, at: Math.round(this.clock), met: null });
    return true;
  }

  /* ------------------------------------------------------------ a frame ---- */

  private where(a: Active): THREE.Vector3 {
    if (a.spec.plek === 'lucht') {
      const g = this.env.fauna.glider('bird-buizerd');
      return g ? this.v.copy(g.position) : this.v.set(0, -100, 0);
    }
    return this.v.copy(a.group!.position);
  }

  private step(a: Active, dt: number, f: SurpriseFrame): void {
    a.age += dt;
    this.lastRanger = f.ranger;
    const me = f.ranger;
    // its life: in, there (moving its own way), out
    if (!a.leaving) {
      this.live(a, dt, f);
      const at = this.where(a);
      a.dist = Math.hypot(at.x - me.x, at.z - me.z);
      // (the buzzard: how far he is from its low circle)
      const off = a.spec.plek === 'lucht' ? Math.hypot(a.home.x - me.x, a.home.z - me.z) : a.dist;
      const goNow = shouldGo(a.spec, a.age, off) || (a.spec.id === 'roodborst' && (!f.onFoot || me.running));
      if (goNow) this.leave(a, false);
    }
    // a bird going flies off: up and away while it fades
    if (a.leaving && a.group && !f.reduced && a.spec.plek !== 'grond') {
      a.group.position.y += dt * 0.9;
      a.group.position.x += Math.sin(a.group.rotation.y) * dt * 0.6;
      a.group.position.z += Math.cos(a.group.rotation.y) * dt * 0.6;
    }
    // the fade (the buzzard's: how far down it has come)
    if (!a.group) a.fade = this.env.fauna.swoopShare('bird-buizerd');
    if (a.group) {
      const want = a.leaving ? 0 : 1;
      a.fade = f.reduced ? want : a.fade + Math.sign(want - a.fade) * Math.min(Math.abs(want - a.fade), dt / FADE_S);
      restFar(a.group, Math.max(a.fade, a.leaving ? 0 : 0.0001));
      a.sp?.update(dt);
    }
    this.look(a, dt, f);
    // gone: out of the picture for good
    const gone = a.leaving && (a.group ? a.fade <= 0 : this.env.fauna.swoopShare('bird-buizerd') <= 0.02);
    if (gone) this.end(a);
  }

  /** What it does while it is there. */
  private live(a: Active, dt: number, f: SurpriseFrame): void {
    const { terrain, ground } = this.env;
    const g = a.group;
    a.state = a.fade < 1 && g ? 'in' : 'there';
    switch (a.spec.id) {
      case 'buizerd': {
        a.state = this.env.fauna.swoopShare('bird-buizerd') < 0.98 ? 'down' : 'low';
        break;
      }
      case 'edelhert': {
        if (!g || f.reduced) break;
        a.stand += dt;
        const walk = a.stand > STAG_STAND_S || (a.met === 'seen' && a.stand > 4) || a.dist < 18;
        if (walk && a.dir) {
          a.state = 'walks';
          if (!g.userData.walking) { a.sp?.clip?.('walk'); g.userData.walking = true; }
          this.walk(g, a.dir, STAG_WALK * dt, 1.2, dt, () => this.leave(a, false));
        } else if (!g.userData.grazing) { a.sp?.clip?.('graze'); g.userData.grazing = true; }
        break;
      }
      case 'das': {
        if (!g || f.reduced || !a.dir) break;
        a.state = 'walks';
        this.walk(g, a.dir, BADGER_WALK * dt, 0.5, dt, () => this.leave(a, false));
        // a calm waddle: a little roll and bob with each step (static mesh)
        const body = a.sp?.root as THREE.Object3D | undefined;
        if (body) { const ph = a.age * 6.5; body.rotation.z = Math.sin(ph) * 0.05; body.position.y = Math.abs(Math.sin(ph)) * 0.012; }
        break;
      }
      case 'roodborst': {
        if (!g) break;
        if (a.hop) {
          // a hop (a flutter, its glide in): along a low arc, landing on the ground
          const hp = a.hop;
          hp.t = Math.min(1, hp.t + dt / (hp.dur ?? 0.2));
          const u = hp.t;
          const x = hp.fx + (hp.tx - hp.fx) * u, z = hp.fz + (hp.tz - hp.fz) * u;
          const y0 = (hp.from ?? 0) * (1 - u) * (1 - u);
          g.position.set(x, terrain.y(x, z) + y0 + Math.sin(Math.PI * u) * (hp.lift ?? 0.07), z);
          a.state = hp.dur && hp.dur > 0.3 ? 'flies' : 'hops';
          if (u >= 1) { a.hop = null; a.stand = 0; }
        } else if (!f.reduced && a.fade >= 0.5 && a.beside) {
          // it keeps beside him: a hop toward its spot when he walked on (a short flutter
          // when it fell behind), a little rest between hops; else it stands and looks at him
          a.stand += dt;
          const v = this.viewer(f);
          const spot = robinSpot(v, v.yaw, a.beside.side, a.beside.lat, a.beside.along);
          const next = a.stand > 0.08 ? robinHop(g.position, spot, f.ranger) : null;
          if (next && ground(next.x, next.z, 0.15) && !this.env.homeNear(next.x, next.z, 1.5)) {
            const d = Math.hypot(next.x - g.position.x, next.z - g.position.z);
            a.hop = { fx: g.position.x, fz: g.position.z, tx: next.x, tz: next.z, t: 0, dur: next.flutter ? 0.32 + d * 0.06 : 0.2, lift: next.flutter ? 0.32 : 0.07 };
            g.rotation.y = Math.atan2(next.x - g.position.x, next.z - g.position.z);
            const body = a.sp?.root as THREE.Object3D | undefined;
            if (body) body.rotation.x = 0;
          } else {
            a.state = 'there';
            g.rotation.y = turnTo(g.rotation.y, Math.atan2(f.ranger.x - g.position.x, f.ranger.z - g.position.z) + a.beside.side * 0.5, dt * 3);
            // a robin's bob: a little dip now and then while it stands
            const body = a.sp?.root as THREE.Object3D | undefined;
            if (body) body.rotation.x = Math.max(0, Math.sin(a.age * 2.3)) ** 8 * 0.35;
          }
        }
        break;
      }
      case 'winterkoning': {
        if (!g || f.reduced || a.hop || a.fade < 1) {
          if (g && a.hop) {
            a.hop.t = Math.min(1, a.hop.t + dt / 0.18);
            const u = a.hop.t;
            const x = a.hop.fx + (a.hop.tx - a.hop.fx) * u, z = a.hop.fz + (a.hop.tz - a.hop.fz) * u;
            g.position.set(x, terrain.y(x, z) + Math.sin(Math.PI * u) * 0.06, z);
            if (u >= 1) a.hop = null;
          }
          break;
        }
        // now and then a hop or two round the spot it came to
        if (a.fork.chance(dt * 0.7)) {
          const home = g.userData.home as { x: number; z: number } | undefined ?? { x: g.position.x, z: g.position.z };
          g.userData.home = home;
          const ang = a.fork.between(0, Math.PI * 2);
          const tx = home.x + Math.sin(ang) * 0.35, tz = home.z + Math.cos(ang) * 0.35;
          a.hop = { fx: g.position.x, fz: g.position.z, tx, tz, t: 0 };
          g.rotation.y = Math.atan2(tx - g.position.x, tz - g.position.z);
        }
        break;
      }
      // (the woodpecker clings still and drums: its roll is heard, never a quick shake on screen)
      default: break;
    }
    // its call, now and then (never over a spoken line), panned from where it is
    a.callIn -= dt;
    if (a.spec.call && a.callIn <= 0 && a.fade >= 0.5) this.call(a);
  }

  /** It walks `step` m along `dir`, on the ground; a blocked way ends its visit. */
  private walk(g: THREE.Group, dir: { x: number; z: number }, step: number, r: number, dt: number, blocked: () => void): void {
    // it turns its calm way first (a stag standing side-on turns away), then walks on
    const want = Math.atan2(dir.x, dir.z);
    g.rotation.y = turnTo(g.rotation.y, want, dt * 0.9);
    const off = Math.abs(Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y)));
    const k = off > 0.6 ? 0.35 : 1;
    const nx = g.position.x + Math.sin(g.rotation.y) * step * k, nz = g.position.z + Math.cos(g.rotation.y) * step * k;
    if (!this.env.ground(nx, nz, r)) { blocked(); return; }
    g.position.set(nx, this.env.terrain.y(nx, nz), nz);
  }

  private call(a: Active): void {
    const spec = a.spec;
    const every = spec.call!.every;
    a.callIn = a.fork.between(every[0], every[1]);
    const h = this.hooks!;
    const speaking = typeof window !== 'undefined' && !!window.speechSynthesis?.speaking;
    if (!h.sound() || speaking) { a.callIn = 1.2; return; }
    const at = this.where(a);
    // (a drumming or a cuckoo carries: it may sound a little past HEARD_M, softly; it counts
    // as heard only within HEARD_M of him)
    const dur = Sound.callAt(spec.call!.id, at.x, at.z, listenerOf(this.env.camera), CALL_REACH);
    // heard: its call reached him (Sound.callAt plays it only within reach of the lens); the
    // robin is there to be SEEN (its song alone is no meeting)
    if (dur > 0 && a.dist <= HEARD_M && !spec.seenOnly) this.meet(a, 'heard');
  }

  /** Is it in his picture, big enough, near enough, for a second on end? */
  private look(a: Active, dt: number, f: SurpriseFrame): void {
    const cam = this.env.camera;
    const at = this.where(a).clone();
    at.y += a.spec.plek === 'lucht' ? 0 : a.size * 0.4;
    const ndc = at.clone().project(cam);
    a.px = this.pxOf(a, at);
    const inFront = ndc.z > -1 && ndc.z < 1;
    const onScreen = inFront && Math.abs(ndc.x) <= 0.96 && Math.abs(ndc.y) <= 0.96;
    // hidden by the ground or a trunk (looked at a few times a second)
    if (onScreen && a.age - a.occludedAt > 0.2) {
      a.occludedAt = a.age;
      a.occluded = this.hidden(at.x, at.y, at.z, a.tree);
    }
    a.onScreen = onScreen && !a.occluded && (a.group ? a.fade > 0.6 : true);
    const visible = a.onScreen && !a.leaving;
    if (a.meter.step(dt, visible, a.px, Math.hypot(at.x - f.ranger.x, at.z - f.ranger.z))) this.meet(a, 'seen');
  }

  /** How big (px, the larger side) it stands in the picture: its own box's eight corners
   *  through the lens (a badger walking away is smaller than one walking across); the
   *  buzzard, its wingspan at its distance. */
  private pxOf(a: Active, at: THREE.Vector3): number {
    const cam = this.env.camera;
    const H = this.env.viewH(), W = H * cam.aspect;
    if (!a.group) {
      const fov = THREE.MathUtils.degToRad(cam.fov);
      return (a.size / (2 * cam.position.distanceTo(at) * Math.tan(fov / 2))) * H;
    }
    const box = a.box;
    if (!box || box.isEmpty()) return 0;
    a.group.updateMatrixWorld();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      this.corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z)
        .applyMatrix4(a.group.matrixWorld).project(cam);
      x0 = Math.min(x0, this.corner.x); x1 = Math.max(x1, this.corner.x); y0 = Math.min(y0, this.corner.y); y1 = Math.max(y1, this.corner.y);
    }
    return Math.max(((x1 - x0) / 2) * W, ((y1 - y0) / 2) * H);
  }
  private readonly corner = new THREE.Vector3();

  private meet(a: Active, how: 'seen' | 'heard'): void {
    if (a.met) return;
    a.met = how;
    const l = this.log[this.log.length - 1];
    if (l) l.met = how;
    this.hooks?.met(a.spec.id, how);
  }

  /** It goes on its way: a glider climbs back, the rest fade (a robin flies off). */
  private leave(a: Active, now: boolean): void {
    a.leaving = true;
    a.state = 'out';
    // a bird flies off away from him (never toward the lens)
    const me = this.lastRanger;
    if (a.group && a.spec.plek !== 'grond') {
      const gp = a.group.position;
      a.group.rotation.y = Math.atan2(gp.x - me.x, gp.z - me.z);
    }
    if (a.spec.plek === 'lucht') {
      // it climbs back up and away from him (never over his head)
      const d = Math.hypot(a.home.x - me.x, a.home.z - me.z) || 1;
      this.env.fauna.swoop('bird-buizerd', null, { x: (a.home.x - me.x) / d, z: (a.home.z - me.z) / d });
    }
    if (now && a.group) a.fade = Math.min(a.fade, 0.35);
  }

  private end(a: Active): void {
    if (a.group) {
      a.group.removeFromParent();
      a.group.traverse((o) => { const m = o as THREE.Mesh; if (m.userData.blob) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
    }
    a.sp?.dispose();
    this.active = null;
    this.next = nextAfter(a.start, this.clock, a.fork.fork('gap'));
    this.hooks?.done(a.spec.id, !!a.met);
  }

  /** A soft round shadow under a walking animal (one draw call). */
  private addBlob(group: THREE.Group, radius: number): void {
    if (!this.blobTex) {
      const N = 64;
      const cv = document.createElement('canvas');
      cv.width = cv.height = N;
      const ctx = cv.getContext('2d')!;
      const gr = ctx.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
      gr.addColorStop(0, 'rgba(30,24,12,0.5)');
      gr.addColorStop(0.6, 'rgba(30,24,12,0.25)');
      gr.addColorStop(1, 'rgba(30,24,12,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, N, N);
      this.blobTex = new THREE.CanvasTexture(cv);
      this.blobTex.colorSpace = THREE.SRGBColorSpace;
    }
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), new THREE.MeshBasicMaterial({ map: this.blobTex, transparent: true, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.03;
    disc.renderOrder = 1;
    disc.userData.blob = true;
    group.add(disc);
  }
}

interface Placed { x: number; z: number; y: number; facing: number; dir?: { x: number; z: number }; tree?: TreePlacement;
  beside?: { side: number; lat: number; along: number } }

/** How many draw calls a group adds (each visible mesh, each of its materials). */
function drawCallsOf(g: THREE.Object3D | null): number {
  let n = 0;
  g?.traverseVisible((o) => { const m = o as THREE.Mesh; if (m.isMesh) n += Array.isArray(m.material) ? m.material.length : 1; });
  return n;
}

/** `from` turned toward `to` by at most `max` rad. */
function turnTo(from: number, to: number, max: number): number {
  const d = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + Math.sign(d) * Math.min(Math.abs(d), max);
}

