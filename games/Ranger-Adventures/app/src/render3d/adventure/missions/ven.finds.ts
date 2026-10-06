/**
 * ven.finds.ts — the ven alive (run 7, package ven-life): the THREE half of ven.life.ts.
 * The home (ven.home.ts `VenHome`) owns one `VenLife3d`; ven.ts plays it and records what
 * he really saw (`Seen`).
 *
 * - The DUCK FAMILY: a mother (the mallard's model in a duck's browns, Coat 'eend-moeder')
 *   paddling a slow loop on the open water with 3-7 ducklings in a line behind her (one
 *   instanced mesh: the same model small, a duckling's dark back and yellow face, Coat
 *   'eendje'); they bob on the water, now and then she up-ends to feed (tail up, head
 *   under) and they bunch up; now and then one duckling dawdles and then hurries after her.
 *   Always there (before and after the mission); a play draws its loop and its count.
 * - DRAGONFLIES (a play's, in the warm moods): one instanced mesh of thin blue bodies and
 *   glassy wings, darting and hovering low over the water's edge away from his cove; one may
 *   come up the bank to hover in front of him on his way (`visit`), one may settle on a
 *   heather tip beside the adder (`settleBy`: a temptation in her hold).
 * - The HEATH BLUE (a play's, in the sunny moods) sits on a heather tip by the path and
 *   flutters up ahead of him as he comes near, settles again, and at the second time flies
 *   off over the heather.
 * - A duck's blue FEATHER (a play's) lies on the bank just down from the path.
 * - PLOPPING FROGS (a play's): one sits at the very edge by his cove (and sometimes one by a
 *   cove he walks past) and plops into the water as he comes near — only while he walks.
 * - The BLUE FROG (the rare): it comes up out of the water beside his singing frog, climbs
 *   onto the moss and answers him, and plops back in at the end.
 * Nothing here is ever a knob; nothing moves toward a lens; all of it rests when far.
 */

import * as THREE from 'three';
import type { DressingEnv } from '../../world/Residents';
import { listenerOf } from '../../world/Residents';
import type { Spawned } from '../../play/types';
import type { ActorEnv } from '../actors';
import type { Spot } from '../types';
import { Sound } from '../../../core/sound';
import { store } from '../../../core/state';
import { dist, headingTo, stream } from '../places';
import { WATER_LEVEL } from '../../Biomes';
import { SIZE } from '../../AnimalScale';
import { lodGeometries, lodMaterial } from '../../Lod';
import { BAYS, FROG_H, type BayId, type FrogSpot } from './ven.places';
import {
  DRAGONFLY_RANGE, DRAGONFLY_Y, DUCK_LOOPS, DUCK_SPEED, DUCKLING_GAP, DUCKLING_LEAD, DUCKLING_STRAY, DUCKLINGS, FREE_DUCKS, seenStep,
  blueOf, butterflySpot, dragonflyHome, featherSpot, onLoop, plopSpot, type VenLife,
} from './ven.life';
import type { Frog, VenHome } from './ven.home';

/** How big (m) the ducks are drawn: a mallard and her ducklings of a few weeks, ≈ 1.4× (AnimalScale). */
const MOTHER_H = SIZE['eend-moeder'].h;
const DUCKLING_H = SIZE.eendje.h;
/** A floating duck sits this share of her height under the surface (her feet and belly). */
const MOTHER_SINK = 0.36;
const DUCKLING_SINK = 0.32;
/** The ducks rest beyond this far from their loop (m): from the marker (~24 m) they show. */
const DUCKS_NEAR = 36;
const DUCKS_FAR = 42;
/** Beyond this far (m) from the lens the ducklings are drawn as a simpler copy (its
 *  triangles): ~3 px each there, 8k triangles each as near. */
const DUCKLING_FAR = 16;
const DUCKLING_FAR_TRIS = 400;
/** A dragonfly's dart (m/s) and how long it hovers between darts (s). */
const DART_V = 3.2;
const HOVER_S: readonly [number, number] = [0.8, 2.4];
/** The feather's length as it lies (m): a duck's wing feather, drawn ~3× so it is seen. */
const FEATHER_LEN = 0.3;
/** The heath blue sits on a heather tip this high (m); it flutters up when he is this near. */
const BLUE_PERCH = 0.24;
/** The heath blue on the path is drawn half again the look-alike's size (wings ~0.24 m
 *  open, ~8× life): it flutters a few metres in front of him, 7 m from the lens. */
const BUTTERFLY_H = 0.042;
const BUTTERFLY_NEAR = 2.6;

/** What a play's life is laid with (ven.ts `prepare`). */
export interface LifeLay {
  life: VenLife;
  /** the cove and the frog's spot (the blue frog's place) */
  bay: BayId;
  sat: FrogSpot;
  /** this play's rare is the blue frog */
  blue: boolean;
}

interface Dragonfly {
  home: Spot;
  pos: THREE.Vector3;
  from: THREE.Vector3;
  to: THREE.Vector3;
  yaw: number;
  mode: 'hover' | 'dart' | 'visit' | 'settled' | 'gone';
  t: number;
  secs: number;
  wait: number;
  /** a visit's or a settle's hold (s left), then home */
  hold: number;
  /** a visit: where in front of him it hovers now (read every frame) */
  ahead?: () => THREE.Vector3;
  rnd: () => number;
}

export class VenLife3d {
  private readonly env: DressingEnv;
  private readonly made: { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[] }[] = [];
  private readonly spawned: Spawned[] = [];
  private disposed = false;
  private clock = 0;
  /** the play laid now, or null (free roam) */
  laid: LifeLay | null = null;

  /* the ducks */
  private readonly duckGroup: THREE.Object3D;
  private mother: THREE.Object3D | null = null;
  private ducklings: THREE.InstancedMesh | null = null;
  private duckMesh: THREE.Matrix4 = new THREE.Matrix4();
  /** run 7 fix (the triangle budget): the ducklings as drawn near and their simpler copy from
   *  afar (8k triangles each as near; a few pixels each from beyond `DUCKLING_FAR`) */
  private duckNear: { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[] } | null = null;
  private duckFar: { geometry: THREE.BufferGeometry; material: THREE.Material } | null = null;
  private duckIsFar = false;
  private ducks: VenLife['ducks'] = { ...FREE_DUCKS };
  /** where she is along her loop (m) */
  private s = 0;
  private upend = { t: -1, next: 9 };
  private stray = { i: -1, t: 0, lag: 0, next: 7 };
  private readonly duckRnd = stream(911);
  private quackIn = 4;
  /** the family's box now (for seeing it) */
  readonly familyBox = new THREE.Box3();

  /* the dragonflies */
  private flies: THREE.InstancedMesh | null = null;
  private readonly fly: Dragonfly[] = [];
  private flyGroup: THREE.Object3D | null = null;
  private readonly flyBox = new THREE.Box3();

  /* the heath blue, the feather */
  private butterfly: THREE.Object3D | null = null;
  private bf = { mode: 'off' as 'off' | 'sit' | 'fly' | 'gone', from: new THREE.Vector3(), to: new THREE.Vector3(), t: 0, secs: 1, hops: 0, yaw: 0 };
  private feather: THREE.Object3D | null = null;

  /* the frogs */
  private readonly plops: { frog: Frog; at: Spot & { yaw: number }; near: number; done: boolean }[] = [];
  private readonly frogPool: Frog[] = [];
  blueFrog: Frog | null = null;
  /** may a small surprise happen now (a frog plops, the heath blue flutters up)? ven.ts says
   *  so on his walks only (never in a search, a hold or a listening stop) */
  surprisesOn = false;
  private readonly actorEnv: ActorEnv;
  private readonly makeFrog: (key: string, animal: string) => Frog;

  constructor(env: DressingEnv, home: VenHome, makeFrog: (key: string, animal: string, env: ActorEnv) => Frog) {
    this.env = env;
    this.actorEnv = { parent: home.group, groundY: env.groundY, spawnModel: env.spawnModel, obstacles: [], limits: { bound: 1e6 }, reduced: () => false };
    this.makeFrog = (key, animal) => makeFrog(key, animal, this.actorEnv);
    // the ducks: in a group that rests by its own distance (from the marker they show)
    const c = DUCK_LOOPS[0].c;
    this.duckGroup = env.detail({ x: c.x, z: c.z }, { near: DUCKS_NEAR, far: DUCKS_FAR, own: true });
    this.duckGroup.name = 'ven-ducks';
    void env.spawnModel('eend-moeder', { height: MOTHER_H, idle: false }).then((sp) => {
      if (!sp || this.disposed) { sp?.dispose(); return; }
      this.spawned.push(sp);
      const r = sp.root as THREE.Object3D;
      r.name = 'ven-eend';
      this.duckGroup.add(r);
      this.mother = r;
    });
    void env.spawnModel('eendje', { height: DUCKLING_H, idle: false }).then((sp) => {
      if (!sp || this.disposed) { sp?.dispose(); return; }
      this.spawned.push(sp);
      const r = sp.root as THREE.Object3D;
      r.updateMatrixWorld(true);
      let mesh: THREE.Mesh | null = null;
      r.traverse((o) => { if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh; });
      if (!mesh) return;
      const m = mesh as THREE.Mesh;
      // (one draw call for all of them: the duckling's own mesh, its place in the model kept)
      this.duckMesh = new THREE.Matrix4().copy(r.matrixWorld).invert().multiply(m.matrixWorld);
      const inst = new THREE.InstancedMesh(m.geometry, m.material, DUCKLINGS[1]);
      inst.name = 'ven-eendjes';
      inst.castShadow = false;
      // (culled by a sphere round the family that follows them each frame: behind the lens
      // they cost no draw call)
      inst.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);
      this.duckGroup.add(inst);
      this.ducklings = inst;
      // (its simpler copy from afar: the duckling baked and simplified in its model's frame,
      // put in the mesh's frame the instances place, coloured from its own texture)
      const [lod] = lodGeometries(`eendje@${DUCKLING_H}`, r, [DUCKLING_FAR_TRIS]);
      if (lod) {
        const geo = lod.clone().applyMatrix4(this.duckMesh.clone().invert());
        this.duckNear = { geometry: m.geometry, material: m.material };
        this.duckFar = { geometry: geo, material: lodMaterial().clone() };
        this.made.push(this.duckFar);
      }
    });
    // the dragonflies: one instanced mesh (a play shows them)
    const geo = dragonflyGeometry();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0, side: THREE.DoubleSide, emissive: '#1d2a33' });
    this.made.push({ geometry: geo, material: mat });
    const flies = new THREE.InstancedMesh(geo, mat, 3);
    flies.name = 'ven-libellen';
    flies.castShadow = false;
    // (culled by a sphere round the dragonflies that follows them each frame)
    flies.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);
    flies.count = 0;
    this.flies = flies;
    this.flyGroup = env.detail(BAYS.B.frame, { near: 30, far: 36, own: true });
    this.flyGroup.add(flies);
    // the heath blue and the feather (laid for a play)
    void env.spawnModel('heideblauwtje', { height: BUTTERFLY_H, idle: false }).then((sp) => {
      if (!sp || this.disposed) { sp?.dispose(); return; }
      this.spawned.push(sp);
      const r = sp.root as THREE.Object3D;
      r.name = 'ven-vlinder';
      r.visible = false;
      home.group.add(r);
      this.butterfly = r;
      if (this.laid) this.layButterfly();
    });
    void env.spawnModel('prop-feather', { idle: false }).then((sp) => {
      if (!sp || this.disposed) { sp?.dispose(); return; }
      this.spawned.push(sp);
      const r = sp.root as THREE.Object3D;
      r.name = 'ven-veer';
      // (laid flat on the ground, FEATHER_LEN long, whichever way the model stands)
      const box = new THREE.Box3().setFromObject(r);
      const size = box.getSize(new THREE.Vector3());
      const inner = new THREE.Group();
      while (r.children.length) inner.add(r.children[0]);
      r.add(inner);
      if (size.y > Math.max(size.x, size.z)) inner.rotation.x = -Math.PI / 2;
      inner.scale.setScalar(FEATHER_LEN / Math.max(size.x, size.y, size.z, 1e-3));
      inner.updateMatrixWorld(true);
      const b2 = new THREE.Box3().setFromObject(inner);
      inner.position.y -= b2.min.y;
      inner.position.x -= (b2.min.x + b2.max.x) / 2;
      inner.position.z -= (b2.min.z + b2.max.z) / 2;
      r.visible = false;
      home.group.add(r);
      this.feather = r;
      if (this.laid) this.layFeather();
    });
    this.layDucks(FREE_DUCKS);
  }

  /* ---------------------------------------------------------------- a play ---- */

  /** Lay a play's life (under the briefing card), or free roam (`null`: the ducks only, as
   *  many as the last play had; the play's other things go). */
  lay(p: LifeLay | null): void {
    this.laid = p;
    if (p) this.layDucks(p.life.ducks);
    // dragonflies
    this.fly.length = 0;
    if (p) {
      const r0 = stream(4049 + p.life.ducks.count * 7 + p.life.ducks.loop);
      for (const h of p.life.libellen) {
        const home = dragonflyHome(h);
        const y = WATER_LEVEL + DRAGONFLY_Y[0] + r0() * (DRAGONFLY_Y[1] - DRAGONFLY_Y[0]);
        const pos = new THREE.Vector3(home.x, y, home.z);
        this.fly.push({ home, pos, from: pos.clone(), to: pos.clone(), yaw: r0() * 6.28, mode: 'hover', t: 0, secs: 1, wait: 0.5 + r0() * 1.5, hold: 0, rnd: stream(Math.floor(r0() * 1e9)) });
      }
    }
    if (this.flies) this.flies.count = this.fly.length;
    this.layButterfly();
    this.layFeather();
    // the plopping frogs (made once, reused)
    for (const q of this.plops) { q.frog.group.visible = false; q.done = true; }
    this.plops.length = 0;
    if (p) {
      p.life.plops.forEach((q, i) => {
        const frog = this.frogPool[i] ?? (this.frogPool[i] = this.makeFrog(`ven-plons-${i}`, 'heikikker'));
        const at = plopSpot(BAYS[q.bay], q.i);
        frog.place(at.x, at.z, at.yaw);
        frog.group.visible = true;
        frog.idle();
        this.plops.push({ frog, at, near: q.near, done: false });
      });
    }
    // the blue frog: hidden until it comes up to answer
    if (p?.blue) this.blueFrog ??= this.makeFrog('ven-blauw', 'heikikker-blauw');
    if (this.blueFrog) this.blueFrog.group.visible = false;
    this.surprisesOn = false;
  }

  private layDucks(d: VenLife['ducks']): void {
    this.ducks = { ...d };
    this.s = d.start;
    this.upend = { t: -1, next: 8 + this.duckRnd() * 8 };
    this.stray = { i: -1, t: 0, lag: 0, next: 5 + this.duckRnd() * 6 };
    if (this.ducklings) this.ducklings.count = d.count;
  }

  private layButterfly(): void {
    const b = this.butterfly;
    if (!b) return;
    const i = this.laid?.life.vlinder ?? null;
    if (i === null) { b.visible = false; this.bf.mode = 'off'; return; }
    const at = butterflySpot(i);
    b.position.set(at.x, this.env.groundY(at.x, at.z) + BLUE_PERCH, at.z);
    b.rotation.set(0, (i * 1.7) % 6.28, 0);
    b.scale.set(1, 1, 1);
    b.visible = true;
    this.bf = { mode: 'sit', from: b.position.clone(), to: b.position.clone(), t: 0, secs: 1, hops: 0, yaw: b.rotation.y };
  }

  private layFeather(): void {
    const f = this.feather;
    if (!f) return;
    const i = this.laid?.life.veer ?? null;
    if (i === null) { f.visible = false; return; }
    const at = featherSpot(i);
    f.position.set(at.x, this.env.groundY(at.x, at.z) + 0.004, at.z);
    f.rotation.set(0, at.yaw, 0);
    f.visible = true;
  }

  /* ------------------------------------------------------------- the reads ---- */

  /** The mother duck (for seeing the family), or null before she loaded. */
  get motherObject(): THREE.Object3D | null { return this.mother; }
  /** The feather as it lies (null: not this play). */
  get featherObject(): THREE.Object3D | null { return this.feather?.visible ? this.feather : null; }
  /** The heath blue while it shows (null: not this play, or gone). */
  get butterflyObject(): THREE.Object3D | null { return this.butterfly?.visible ? this.butterfly : null; }
  /** Is the heath blue in the air now? */
  get butterflyFlying(): boolean { return this.bf.mode === 'fly'; }
  /** The dragonflies' places now (for seeing one), and which is visiting him. */
  dragonflies(): { pos: THREE.Vector3; visiting: boolean; settled: boolean }[] {
    return this.fly.filter((f) => f.mode !== 'gone').map((f) => ({ pos: f.pos, visiting: f.mode === 'visit', settled: f.mode === 'settled' }));
  }
  /** Has this play dragonflies? */
  get hasDragonflies(): boolean { return this.fly.length > 0; }

  /* ------------------------------------------------------ what the script does ---- */

  /** A dragonfly comes up the bank to hover in front of him a moment (once a play): the
   *  nearest one within `reach` m. `ahead()` says where in front of him it hovers, read every
   *  frame (he walks on: it keeps ahead of him, never drifting back toward the lens).
   *  Returns whether one came. */
  visit(me: Spot, ahead: () => THREE.Vector3, reach = 14): boolean {
    let best: Dragonfly | null = null, bd = reach;
    for (const f of this.fly) {
      if (f.mode !== 'hover' && f.mode !== 'dart') continue;
      const d = Math.hypot(f.pos.x - me.x, f.pos.z - me.z);
      if (d < bd) { bd = d; best = f; }
    }
    if (!best) return false;
    best.ahead = ahead;
    this.dartTo(best, ahead(), 'visit');
    best.hold = 4;
    return true;
  }

  /** A dragonfly settles on a heather tip at `at` (beside the adder): a temptation. */
  settleBy(at: Spot): boolean {
    const f = this.fly.find((q) => q.mode === 'hover' || q.mode === 'dart') ?? null;
    if (!f) return false;
    this.dartTo(f, new THREE.Vector3(at.x, this.env.groundY(at.x, at.z) + 0.3, at.z), 'settled');
    f.hold = 1e9;
    return true;
  }
  /** Every settled dragonfly darts home again. */
  release(): void {
    for (const f of this.fly) if (f.mode === 'settled') { f.hold = 0; this.dartTo(f, this.homePoint(f), 'dart'); }
  }

  /** He has come to his cove: a frog still sitting at its edge slips quietly into the water
   *  (never a sitting frog in the search's picture or the song's). */
  slipIn(bay: BayId): void {
    for (const q of this.plops) {
      if (q.done || dist(q.at, BAYS[bay].frame) > 6) continue;
      q.done = true;
      void q.frog.dive(false, 0.8);
    }
  }

  /** This play's rare is the blue frog (known once the play starts: `k.rare()`): it is
   *  made now, hidden, so it is there when its moment comes. */
  setBlue(on: boolean): void {
    if (!this.laid) return;
    this.laid.blue = on;
    if (on) this.blueFrog ??= this.makeFrog('ven-blauw', 'heikikker-blauw');
    if (this.blueFrog) this.blueFrog.group.visible = false;
  }

  /** The blue frog plops back into the water (the end of its play). */
  async blueGo(): Promise<void> {
    const f = this.blueFrog;
    const p = this.laid;
    if (!f?.group.visible || !p) return;
    const b = blueOf(BAYS[p.bay], p.sat);
    await f.leap(b.up, 0.6);
  }

  /** The blue frog comes up out of the water beside the cove and climbs onto the moss;
   *  resolves once it sits there. */
  async blueRise(): Promise<Frog | null> {
    const p = this.laid;
    const f = this.blueFrog;
    if (!p?.blue || !f) return null;
    const b = blueOf(BAYS[p.bay], p.sat);
    f.place(b.up.x, b.up.z, headingTo(b.up, b));
    f.group.visible = true;
    await f.dive(true, 0.7);
    await f.hop(b, 0.5);
    f.place(b.x, b.z, b.yaw);
    f.idle();
    return f;
  }

  /* ----------------------------------------------------------------- frames ---- */

  update(dt: number, reduced: boolean, me: { x: number; z: number } | null, cam: THREE.Camera | null): void {
    this.clock += dt;
    this.updateDucks(dt, reduced);
    // (from afar the ducklings are drawn as their simpler copy)
    const d = this.ducklings;
    if (d && cam && this.duckNear && this.duckFar && d.boundingSphere) {
      const away = cam.position.distanceTo(d.boundingSphere.center);
      const far = this.duckIsFar ? away > DUCKLING_FAR - 2 : away > DUCKLING_FAR;
      if (far !== this.duckIsFar) {
        this.duckIsFar = far;
        const use = far ? this.duckFar : this.duckNear;
        d.geometry = use.geometry;
        d.material = use.material;
      }
    }
    // in free roam she chats to her ducklings now and then: a soft "kwak kwak", heard within
    // ~20 m (in a play the frogs' chorus is the sound he follows: she keeps quiet then)
    this.quackIn -= dt;
    if (this.quackIn <= 0) {
      this.quackIn = 7 + this.duckRnd() * 9;
      const m = this.mother;
      if (!this.laid && m && cam && store.get().settings.geluid && !(typeof window !== 'undefined' && window.speechSynthesis?.speaking)) {
        Sound.callAt('eend', m.position.x, m.position.z, listenerOf(cam), 22);
      }
    }
    this.updateFlies(dt, reduced);
    this.updateButterfly(dt, reduced, me);
    // the plopping frogs: he comes near on a walk and one plops in
    // (a frog leaping or diving goes on moving after it was set off: every shown one is updated)
    for (const f of this.frogPool) if (f.group.visible) f.update(dt, this.clock);
    for (const q of this.plops) {
      if (q.done) continue;
      if (!me || !this.surprisesOn || dist(me, q.at) > q.near) continue;
      q.done = true;
      const b = BAYS[this.laid!.bay];
      // (out into the water, a long leap: away from the bank and from him)
      const out = { x: q.at.x + Math.sin(b.frame.heading) * 0.75, z: q.at.z + Math.cos(b.frame.heading) * 0.75 };
      void q.frog.leap(out, 0.6).then(() => {
        if (this.disposed) return;
        if (store.get().settings.geluid && cam && dist(me, q.at) < 14) Sound.plop();
      });
    }
    if (this.blueFrog?.group.visible) this.blueFrog.update(dt, this.clock);
    // (a frog's contact shadow and its body by the lens's distance, as the home's own)
    if (cam) for (const f of [...this.frogPool, ...(this.blueFrog ? [this.blueFrog] : [])]) if (f.group.visible) f.shadowFor(cam.position.distanceTo(f.group.position));
  }

  private updateDucks(dt: number, reduced: boolean): void {
    const loop = DUCK_LOOPS[this.ducks.loop];
    const R = this.upend;
    // she up-ends now and then (tail up, head under, ~2.4 s), paddling on otherwise
    if (R.t >= 0) {
      R.t += dt;
      if (R.t > 2.6) { R.t = -1; R.next = 9 + this.duckRnd() * 10; }
    } else {
      R.next -= dt;
      if (R.next <= 0 && !reduced) R.t = 0;
    }
    const tipping = R.t >= 0 ? Math.sin(Math.min(1, R.t / 2.6) * Math.PI) : 0;
    const v = DUCK_SPEED * (1 - 0.85 * tipping);
    this.s += v * dt;
    const m = this.mother;
    const bob = reduced ? 0 : Math.sin(this.clock * 2.1) * 0.006;
    const box = this.familyBox;
    box.makeEmpty();
    if (m) {
      const p = onLoop(loop, this.s);
      m.position.set(p.x, WATER_LEVEL - MOTHER_H * MOTHER_SINK + bob - tipping * 0.02, p.z);
      // (up-ending: she tips forward, her head under, her tail to the sky — not so far that
      // her whole body shows pale through the water: at 83° it read as a ghost under her)
      m.rotation.set(0, 0, 0);
      m.rotateY(p.yaw);
      m.rotateX(tipping * 1.0);
      box.expandByPoint(new THREE.Vector3(p.x, WATER_LEVEL + MOTHER_H * 0.7, p.z));
      box.expandByPoint(new THREE.Vector3(p.x, WATER_LEVEL, p.z));
    }
    // the ducklings in a line behind her; one dawdles now and then and hurries back
    const S = this.stray;
    if (S.i < 0) {
      S.next -= dt;
      if (S.next <= 0 && this.ducks.count > 1) { S.i = Math.floor(this.duckRnd() * this.ducks.count); S.t = 0; }
    } else {
      S.t += dt;
      // (it falls behind for ~3 s, then hurries back in ~2 s)
      S.lag = S.t < 3 ? (S.t / 3) * DUCKLING_STRAY : Math.max(0, DUCKLING_STRAY * (1 - (S.t - 3) / 2));
      if (S.t > 5) { S.i = -1; S.lag = 0; S.next = 8 + this.duckRnd() * 9; }
    }
    const d = this.ducklings;
    if (d) {
      const mat = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
      // (bunching up close behind her while she feeds)
      const gap = DUCKLING_GAP * (1 - 0.45 * tipping);
      for (let i = 0; i < this.ducks.count; i++) {
        const lag = i === S.i ? S.lag : 0;
        const along = this.s - (DUCKLING_LEAD + i * gap) - lag;
        const p = onLoop(loop, along);
        const side = reduced ? 0 : Math.sin(this.clock * 1.3 + i * 1.9) * 0.05 * (i % 2 ? 1 : -1);
        const wob = reduced ? 0 : Math.sin(this.clock * 3.4 + i) * 0.004;
        pos.set(p.x + Math.cos(p.yaw) * side, WATER_LEVEL - DUCKLING_H * DUCKLING_SINK + wob, p.z - Math.sin(p.yaw) * side);
        // (a hurrying duckling paddles a little nose-down)
        const hurry = i === S.i && S.t > 3 ? 0.12 : 0;
        q.setFromEuler(new THREE.Euler(hurry, p.yaw, 0, 'YXZ'));
        mat.compose(pos, q, one).multiply(this.duckMesh);
        d.setMatrixAt(i, mat);
        box.expandByPoint(pos);
      }
      d.instanceMatrix.needsUpdate = true;
      // (its group stands at the world's origin: the family's box is its own frame)
      if (!box.isEmpty()) box.getBoundingSphere(d.boundingSphere!).radius += DUCKLING_H;
    }
  }

  private homePoint(f: Dragonfly): THREE.Vector3 {
    const a = f.rnd() * Math.PI * 2, r = f.rnd() * DRAGONFLY_RANGE;
    const y = WATER_LEVEL + DRAGONFLY_Y[0] + f.rnd() * (DRAGONFLY_Y[1] - DRAGONFLY_Y[0]);
    return new THREE.Vector3(f.home.x + Math.cos(a) * r, y, f.home.z + Math.sin(a) * r);
  }

  private dartTo(f: Dragonfly, to: THREE.Vector3, mode: Dragonfly['mode']): void {
    f.from.copy(f.pos);
    f.to.copy(to);
    f.t = 0;
    f.secs = Math.max(0.25, f.from.distanceTo(f.to) / DART_V);
    f.mode = mode;
    const dx = to.x - f.pos.x, dz = to.z - f.pos.z;
    if (Math.hypot(dx, dz) > 0.05) f.yaw = Math.atan2(dx, dz);
  }

  private updateFlies(dt: number, reduced: boolean): void {
    const inst = this.flies;
    if (!inst || !this.fly.length) return;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    const around = this.flyBox.makeEmpty();
    this.fly.forEach((f, i) => {
      // (a visit keeps in front of him as he walks on: its goal moves with him)
      if (f.mode === 'visit' && f.ahead) {
        const want = f.ahead();
        if (f.t < f.secs) f.to.copy(want);
        else f.pos.lerp(want, Math.min(1, dt * 2.6));
      }
      const moving = f.t < f.secs;
      if (moving) {
        f.t = Math.min(f.secs, f.t + (reduced ? f.secs : dt));
        const k = f.t / f.secs;
        const e = k * k * (3 - 2 * k);
        f.pos.lerpVectors(f.from, f.to, e);
        // (a dart lifts a little in its middle)
        f.pos.y += Math.sin(Math.PI * k) * 0.08;
      } else if (f.mode === 'visit' || f.mode === 'settled') {
        f.hold -= dt;
        if (f.hold <= 0) { f.ahead = undefined; this.dartTo(f, this.homePoint(f), 'dart'); }
      } else {
        f.wait -= dt;
        if (f.wait <= 0) {
          this.dartTo(f, this.homePoint(f), 'dart');
          f.wait = HOVER_S[0] + f.rnd() * (HOVER_S[1] - HOVER_S[0]);
        }
      }
      if (!moving && f.mode === 'dart') f.mode = 'hover';
      // hovering: a tiny shiver in place (wings a blur); settled: still
      const shiver = reduced || f.mode === 'settled' ? 0 : 0.012;
      p.set(f.pos.x + Math.sin(this.clock * 23 + i) * shiver, f.pos.y + Math.sin(this.clock * 17 + i * 2) * shiver, f.pos.z + Math.cos(this.clock * 19 + i) * shiver);
      q.setFromEuler(new THREE.Euler(0, f.yaw, 0));
      m.compose(p, q, s);
      inst.setMatrixAt(i, m);
      around.expandByPoint(p);
    });
    inst.instanceMatrix.needsUpdate = true;
    around.getBoundingSphere(inst.boundingSphere!).radius += 0.12;
  }

  private updateButterfly(dt: number, reduced: boolean, me: { x: number; z: number } | null): void {
    const b = this.butterfly;
    const B = this.bf;
    if (!b || B.mode === 'off' || B.mode === 'gone') return;
    if (B.mode === 'sit') {
      // (its wings slowly open and close as it suns itself)
      b.scale.set(reduced ? 1 : 0.75 + 0.25 * Math.abs(Math.sin(this.clock * 1.4)), 1, 1);
      if (me && this.surprisesOn && dist(me, b.position) < BUTTERFLY_NEAR) {
        // it flutters up ahead of him along the path (the first time), then away over the heather
        B.hops += 1;
        const ahead = { x: b.position.x - me.x, z: b.position.z - me.z };
        const len = Math.hypot(ahead.x, ahead.z) || 1;
        const off = B.hops === 1 ? 3.4 : 5.5;
        const sideX = -ahead.z / len, sideZ = ahead.x / len;
        // (the second flight goes off sideways, up the bank into the heather, and on)
        const tx = b.position.x + (ahead.x / len) * off * (B.hops === 1 ? 1 : 0.4) + (B.hops === 1 ? 0 : sideX * 2.5);
        const tz = b.position.z + (ahead.z / len) * off * (B.hops === 1 ? 1 : 0.4) + (B.hops === 1 ? 0 : sideZ * 2.5);
        B.from.copy(b.position);
        B.to.set(tx, this.env.groundY(tx, tz) + (B.hops === 1 ? BLUE_PERCH : 1.6), tz);
        B.t = 0; B.secs = B.hops === 1 ? 2.3 : 3.2; B.mode = 'fly';
        B.yaw = Math.atan2(tx - b.position.x, tz - b.position.z);
      }
      return;
    }
    // flying: a bobbing arc, its wings beating
    B.t = Math.min(B.secs, B.t + (reduced ? B.secs : dt));
    const k = B.t / B.secs;
    const pos = new THREE.Vector3().lerpVectors(B.from, B.to, k);
    pos.y += Math.sin(Math.PI * k) * 0.7 + (reduced ? 0 : Math.sin(this.clock * 9) * 0.05);
    b.position.copy(pos);
    b.rotation.set(0, B.yaw + (reduced ? 0 : Math.sin(this.clock * 3) * 0.3), 0);
    b.scale.set(reduced ? 1 : 0.25 + 0.75 * Math.abs(Math.sin(this.clock * 14)), 1, 1);
    if (k >= 1) {
      if (B.hops >= 2) { B.mode = 'gone'; b.visible = false; } else { B.mode = 'sit'; b.scale.set(1, 1, 1); }
    }
  }

  dispose(): void {
    this.disposed = true;
    for (const s of this.spawned) s.dispose();
    for (const m of this.made) { m.geometry.dispose(); for (const mat of [m.material].flat()) mat.dispose(); }
    this.ducklings?.dispose();
    this.flies?.dispose();
    this.duckGroup.removeFromParent();
    this.flyGroup?.removeFromParent();
    for (const f of this.frogPool) f.dispose();
    this.blueFrog?.dispose();
  }
}

/** One dragonfly, drawn ~3× its size (a 5 cm oeverlibel is a speck at play distance): a
 *  long thin sky-blue body with a dark tip, an olive thorax, big eyes, two pairs of glassy
 *  wings spread flat. Vertex colours; its nose along +z. */
function dragonflyGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const paint = (g: THREE.BufferGeometry, c: string): THREE.BufferGeometry => {
    const col = new THREE.Color(c);
    const n = g.attributes.position.count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    if (g.getAttribute('uv')) g.deleteAttribute('uv');
    return g.index ? g.toNonIndexed() : g;
  };
  // the abdomen (behind, along −z), its tip darker
  parts.push(paint(new THREE.CylinderGeometry(0.0075, 0.0055, 0.1, 6).rotateX(Math.PI / 2).translate(0, 0, -0.052), '#4f93d6'));
  parts.push(paint(new THREE.CylinderGeometry(0.0055, 0.004, 0.024, 6).rotateX(Math.PI / 2).translate(0, 0, -0.114), '#1f2b38'));
  // the thorax, the head with its big eyes
  parts.push(paint(new THREE.SphereGeometry(0.012, 8, 6).scale(1, 0.9, 1.3).translate(0, 0, 0.008), '#5b6a3c'));
  parts.push(paint(new THREE.SphereGeometry(0.0105, 8, 6).scale(1.25, 0.9, 0.8).translate(0, 0.002, 0.026), '#2d3f55'));
  // the wings: four thin glassy blades, the front pair a little forward
  for (const [z, len] of [[0.012, 0.078], [-0.004, 0.072]] as const) {
    for (const s of [1, -1]) {
      const w = new THREE.PlaneGeometry(len, 0.019).rotateX(-Math.PI / 2).translate(s * (len / 2 + 0.006), 0.004, z);
      parts.push(paint(w, '#dbe8ef'));
    }
  }
  const out = mergeAll(parts);
  out.computeVertexNormals();
  for (const p of parts) p.dispose();
  return out;
}

function mergeAll(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let n = 0;
  for (const p of parts) n += p.attributes.position.count;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const p of parts) {
    pos.set(p.attributes.position.array as Float32Array, o * 3);
    col.set(p.attributes.color.array as Float32Array, o * 3);
    o += p.attributes.position.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/* ------------------------------------------------------------- seeing ---- */

const BOX = new THREE.Box3();
const V = new THREE.Vector3();

/** How big (px: its box's larger side) a box is in the picture, whether its middle is on
 *  screen in front of the lens, and where (`sx`, `sy`, px). */
export function boxInPicture(cam: THREE.Camera, box: THREE.Box3, w: number, h: number): { px: number; on: boolean; centre: THREE.Vector3; sx: number; sy: number } {
  const centre = box.getCenter(new THREE.Vector3());
  if (box.isEmpty()) return { px: 0, on: false, centre, sx: 0, sy: 0 };
  V.copy(centre).project(cam);
  const on = V.z > -1 && V.z < 1 && Math.abs(V.x) <= 0.97 && Math.abs(V.y) <= 0.97;
  const sx = ((V.x + 1) / 2) * w, sy = ((1 - V.y) / 2) * h;
  if (!on) return { px: 0, on, centre, sx, sy };
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    V.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(cam);
    x0 = Math.min(x0, V.x); x1 = Math.max(x1, V.x); y0 = Math.min(y0, V.y); y1 = Math.max(y1, V.y);
  }
  return { px: Math.max(((x1 - x0) / 2) * w, ((y1 - y0) / 2) * h), on, centre, sx, sy };
}


/** An object's box (world). */
export function boxOf(o: THREE.Object3D): THREE.Box3 {
  o.updateWorldMatrix(true, true);
  return BOX.setFromObject(o).clone();
}

/** Something he discovers by seeing it: in his picture, at least `px` big, within `within`
 *  m of him, for `secs` on end (`when`: only while it may count). */
export interface Watch {
  id: string;
  box: () => THREE.Box3 | null;
  px: number;
  secs: number;
  within: number;
  when?: () => boolean;
  then?: () => void;
}

/** (the seeing rule, pure: ven.life `seenStep`; ven.home's free roam uses it too) */
export { seenStep };

/** Watches the ven's things each frame and calls `found(id)` once he really saw one. */
export class Seen {
  private readonly list: { w: Watch; run: number; done: boolean; last: { x: number; y: number } | null }[] = [];
  private readonly view: () => { cam: THREE.Camera; w: number; h: number; me: Spot };
  private readonly found: (id: string) => void;
  constructor(view: () => { cam: THREE.Camera; w: number; h: number; me: Spot }, found: (id: string) => void) {
    this.view = view;
    this.found = found;
  }
  watch(w: Watch): void { this.list.push({ w, run: 0, done: false, last: null }); }
  /** the biggest each still-watched thing showed (px), for the dev read */
  readonly most: Record<string, number> = {};
  tick(dt: number): void {
    const v = this.view();
    for (const s of this.list) {
      if (s.done) continue;
      const box = s.w.when && !s.w.when() ? null : s.w.box();
      if (!box || box.isEmpty()) { s.run = 0; s.last = null; continue; }
      const pic = boxInPicture(v.cam, box, v.w, v.h);
      if (pic.on) this.most[s.w.id] = Math.max(this.most[s.w.id] ?? 0, Math.round(pic.px));
      ({ run: s.run, last: s.last } = seenStep(s.run, s.last, pic, v.me, s.w, dt));
      if (s.run >= s.w.secs) { s.done = true; this.found(s.w.id); s.w.then?.(); }
    }
  }
}

/** The frog's height (m) as the home draws it (the blue frog the same). */
export const BLUE_H = FROG_H;
