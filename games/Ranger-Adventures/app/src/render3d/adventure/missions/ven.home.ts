/**
 * ven.home.ts — the ven's home in the world, built with the world (the THREE half of
 * ven.places.ts): the NORTH BANK as a wet-heath shore — a trodden shore path along its
 * top, heather on its land side, the bank's green between path and water, and three small
 * COVES where the world's cattails give way to sedge tussocks, white cotton-grass, cushions
 * of veenmos (bright green, ochre, a little red), frog-sized moss clods and a few cattails
 * at the water line. The heikikkers live there (the residents are Frogs: a throat that
 * swells when one calls, rings on the water where one calls from it, a leap and a plop).
 *
 * It stands before the mission and after it (a place, not a prop that vanishes). A play
 * lays its own bank under the briefing card (`lay`): the frog in its cove and spot (the
 * window over his back fitted to the level's glimpse for the search's lens), the trial's
 * look-alikes on the cove's slots, the adder coiled on the path at her station, the soft
 * moss across the path at its station. `setState` (a stop, a win, a reload) takes the
 * play's things away again: no adder and no soft moss in free roam.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { DressingEnv, HomeDressing } from '../../world/Residents';
import type { HomeState, ResidentSpec, Spot } from '../types';
import { Actor, type ActorEnv } from '../actors';
import { CoverField } from '../cover';
import { backPoints, type Clump, type V3 } from '../cover-math';
import { fitWindow, refitWindow, type Built } from './ree.window';
import { groundDecal, groundStrip } from '../decal';
import { atLocal, dist, headingTo, stream } from '../places';
import { heatherGeometry, plantMaterial } from '../../world/Plants';
import { loadModel, prepModel } from '../../Models';
import { lodGeometries, lodMaterial } from '../../Lod';
import { WATER_LEVEL } from '../../Biomes';
import { SIZE } from '../../AnimalScale';
import {
  BAYS, BAY_IDS, BUTTERFLY_SLOTS, CLOD_SLOTS, CUSHION, FLOAT_SINK, FROG_H, FROG_LEN, PATH, PATH_HALF, HIDE, BENCH, MARKER,
  allStations, carpetAt, coveClumps, inCarpet, pathR, polar, type BayId, type Carpet, type VenLaid, type ViewSpec,
} from './ven.places';

/** A look-alike laid in the play's cove, as the search takes it. */
export interface VenDecoy {
  id: string;
  k: string;
  object: THREE.Object3D;
  x: number; z: number;
  poke(from: Spot): void;
}

/** What a play lays (ven.ts `prepare`). */
export interface VenPlay {
  laid: VenLaid;
  /** the frog's spot this play (world, the way it sits) */
  frog: Spot & { yaw: number };
  /** the trial's look-alikes on the cove's slots */
  decoys: readonly { id: string; k: string; x: number; z: number }[];
  /** how much of the frog's back the search's lens glimpses (the level's) */
  glimpse: number;
  /** the adder this play (none when the trial has no adder moment) */
  adder: (Spot & { yaw: number }) | null;
  /** the soft moss this play */
  carpet: Carpet | null;
}

/** The search's lens as the kit frames it (kit.ts `lensFor`: a spot to include with a width
 *  `r` is two spots, `r` m either side of it across the view). */
export function asTheKitFrames(v: ViewSpec): ViewSpec {
  const right = { x: -Math.cos(v.heading), z: Math.sin(v.heading) };
  return {
    ...v,
    include: v.include?.flatMap((q) => {
      const r = q.r ?? 0;
      return r > 0 ? [-r, r].map((u) => ({ x: q.x + right.x * u, z: q.z + right.z * u, h: q.h })) : [{ x: q.x, z: q.z, h: q.h }];
    }),
  };
}

/* ------------------------------------------------------------- the frogs ---- */

/**
 * A heikikker: the frog model brought to life a little — its throat swells as it calls
 * (and, in the water, rings spread round it), it leaps into the water and plops, it dives
 * and comes up. A frog floats in the water where the ground is under it (its back and head
 * above the surface); it swims there (it is never kept out of the ven).
 */
export class Frog extends Actor {
  /** metres it is lifted (a leap) or sunk (a dive) from where it sits */
  lift = 0;
  private readonly home: VenHome | null;
  private readonly throat: THREE.Mesh;
  private pulse = 0;
  private pulses = 0;
  private leaping: { from: Spot; to: Spot; t: number; secs: number; done: (ok: boolean) => void } | null = null;
  private diving: { t: number; to: number; done: () => void } | null = null;

  constructor(key: string, env: ActorEnv, height: number, home: VenHome | null) {
    const self: { frog: Frog | null } = { frog: null };
    super(key, 'heikikker', {
      ...env,
      // (in the ven it floats, its back above the water; it swims there: no shore holds it)
      groundY: (x, z) => Math.max(env.groundY(x, z), WATER_LEVEL - FLOAT_SINK) + (self.frog?.lift ?? 0),
      limits: { ...env.limits, blocked: undefined },
    }, { height });
    self.frog = this;
    this.home = home;
    // its throat: a pale round swelling under its chin, there only while it calls
    this.throat = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), new THREE.MeshStandardMaterial({ color: '#f1e8c8', roughness: 0.5, emissive: '#3a3628' }));
    this.throat.position.set(0, height * 0.3, FROG_LEN * 0.28);
    this.throat.scale.setScalar(0.001);
    this.throat.visible = false;
    this.gaitNode.add(this.throat);
  }

  /** Is it in the water (floating)? */
  get inWater(): boolean { return this.env.groundY(this.x, this.z) - this.lift <= WATER_LEVEL - FLOAT_SINK + 1e-3; }

  /** It calls: its throat swells (three times), rings spread where it floats. */
  override called(): void { this.sing(1); }

  /** Its throat swells `n` times (a call each); in the water rings spread round it. */
  sing(n = 1): void {
    this.pulses = Math.max(this.pulses, n);
    if (this.inWater) this.home?.ring(this.x, this.z, 0.75);
  }

  /** It leaps to (x, z) — into the water: an arc, a plop, rings — and is under (hidden). */
  leap(to: Spot, secs = 0.7): Promise<boolean> {
    this.idle();
    return new Promise((done) => {
      this.leaping?.done(false);
      this.leaping = { from: { x: this.x, z: this.z }, to, t: 0, secs, done };
    });
  }

  /** It sinks under the water (hidden there), or comes up again (`up`). */
  dive(up = false, secs = 0.8): Promise<void> {
    return new Promise((done) => {
      this.diving?.done();
      if (up) { this.group.visible = true; this.lift = -0.14; }
      this.diving = { t: 0, to: up ? 0 : -0.16, done };
      this.diving.t = secs; // (seconds left)
    });
  }

  override update(dt: number, t: number): void {
    super.update(dt, t);
    const reduced = this.env.reduced();
    // the leap: an arc over the water's edge, a plop and rings where it goes in
    const L = this.leaping;
    if (L) {
      L.t = Math.min(L.secs, L.t + (reduced ? L.secs : dt));
      const k = L.t / L.secs;
      super.place(L.from.x + (L.to.x - L.from.x) * k, L.from.z + (L.to.z - L.from.z) * k, headingTo(L.from, L.to));
      this.lift = Math.sin(Math.PI * k) * 0.28 - (k > 0.85 ? (k - 0.85) * 0.9 : 0);
      if (k >= 1) {
        this.leaping = null;
        this.home?.ring(L.to.x, L.to.z, 0.95);
        this.home?.plop(L.to.x, L.to.z);
        this.lift = -0.2;
        this.group.visible = false;
        L.done(true);
      }
    }
    const D = this.diving;
    if (D) {
      const step = reduced ? 1 : Math.min(1, dt / Math.max(0.05, D.t));
      this.lift += (D.to - this.lift) * step;
      D.t -= dt;
      if (D.t <= 0 || reduced) {
        this.lift = D.to;
        if (D.to < -0.1) this.group.visible = false;
        this.diving = null;
        D.done();
      }
    }
    // (laid out again after a dive or a leap — a stop, a replay — it comes up to the surface)
    if (!L && !D && this.group.visible && this.lift !== 0) {
      this.lift += (0 - this.lift) * Math.min(1, reduced ? 1 : dt * 2.5);
      if (Math.abs(this.lift) < 0.002) this.lift = 0;
    }
    // the throat: n swells, ~0.32 s each
    if (this.pulses > 0 || this.pulse > 0) {
      this.pulse += dt / 0.32;
      if (this.pulse >= 1) { this.pulse = 0; this.pulses -= 1; }
      const s = this.pulses > 0 || this.pulse > 0 ? Math.sin(Math.PI * this.pulse) : 0;
      this.throat.visible = s > 0.02;
      this.throat.scale.set(1.15 * s + 0.001, 0.8 * s + 0.001, 0.9 * s + 0.001);
    }
  }

  /** Laid at a spot (its home laid out again): it sits there, on the ground or afloat. */
  override place(x: number, z: number, yaw = this.yaw): void {
    if (!this.leaping) this.lift = 0;
    super.place(x, z, yaw);
  }

  override dispose(): void {
    this.leaping?.done(false);
    this.diving?.done();
    this.throat.geometry.dispose();
    (this.throat.material as THREE.Material).dispose();
    super.dispose();
  }
}

/** The adventure's `actor` hook: every heikikker of the home is a Frog. */
export function venBody(spec: ResidentSpec, env: ActorEnv, height: number, dressing: HomeDressing | null): Actor | null {
  if (spec.animal !== 'heikikker') return null;
  return new Frog(spec.key, env, height, dressing instanceof VenHome ? dressing : null);
}

/* ------------------------------------------------------------- the home ---- */

/** A ring spreading on the water (a frog called, a frog went in). */
interface Ring { mesh: THREE.Mesh; t: number; delay: number; max: number }

/** One cove's small things (they rest from their own spot, Residents `detail`). */
interface CoveBits {
  id: BayId;
  clods: THREE.InstancedMesh;
  /** each clod slot's matrix as laid, and whether it shows */
  clodAt: THREE.Matrix4[];
  wobble: number[];
  anchors: THREE.Object3D[];
  butterfly: THREE.Group;
  bird: THREE.Group;
  /** a poked butterfly or bird flits up (s left) */
  flit: { o: THREE.Object3D | null; base: number; t: number }[];
}

/** The adder on the path (a play's): coiled, her head lifted when he comes near, sliding off. */
interface AdderBody {
  root: THREE.Object3D | null;
  at: Spot & { yaw: number };
  shown: boolean;
  /** 0..1 her head lifted (a cue: he came near; a hiss: too near) */
  lift: number;
  liftTo: number;
  /** the slide into the heather: progress, from, to */
  slide: { t: number; from: Spot; to: Spot; done: () => void } | null;
}

/** The look of the soft moss. */
const MOSS = { green: '#8fbf47', sheen: '#bfe07a', wet: '#55613a', mud: '#4a3b26' } as const;

/** The adder is drawn this much over the scale table's coil (0.15 m high, 0.47 m long →
 *  0.2 m, 0.6 m: a big adder, still a real one): a child sees her on the path. */
const ADDER_SCALE = 1.3;

/** The default look-alikes in a cove not played (or in free roam): a few moss clods. */
const FREE_CLODS = [0, 3, 5];

export class VenHome implements HomeDressing {
  readonly group = new THREE.Group();
  /** every cove's sedge, one field (its stems are what the search's glimpse is measured on) */
  readonly cover: CoverField;
  /** the play laid now (null: free roam) */
  laid: VenPlay | null = null;
  /** the stems as built (a window opened for one play's frog is closed again) */
  private readonly built: Built[];
  private readonly env: DressingEnv;
  private readonly g: (x: number, z: number) => number;
  private readonly coves = new Map<BayId, CoveBits>();
  private readonly rings: Ring[] = [];
  private readonly carpets = new Map<string, { carpet: Carpet; moss: THREE.Mesh; sheen: THREE.Mesh }>();
  private carpetOn: { carpet: Carpet; moss: THREE.Mesh; sheen: THREE.Mesh } | null = null;
  private quake = 0;
  private quiver = 0;
  private readonly well: THREE.Mesh;
  private wellT = -1;
  private readonly adder: AdderBody;
  private readonly made: { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[] }[] = [];
  private readonly spawned: { dispose(): void }[] = [];
  private disposed = false;
  private clock = 0;

  constructor(env: DressingEnv) {
    this.group.name = 'ven-home';
    env.parent.add(this.group);
    this.env = env;
    const g = env.groundY;
    this.g = g;
    const rnd = stream(73);
    const keep = <T extends THREE.Mesh | THREE.InstancedMesh>(m: T, parent: THREE.Object3D = this.group): T => {
      parent.add(m);
      this.made.push(m);
      return m;
    };

    /* -- the bank: its green between the path and the water, the heath ground above -- */
    const arc = (r: (th: number) => number, th0: number, th1: number): Spot[] => {
      const out: Spot[] = [];
      for (let th = th0; th >= th1 - 1e-6; th -= 2) out.push(polar(th, r(th)));
      return out;
    };
    keep(groundStrip(g, arc(() => 16.2, 146, 34), 3.3, '#6f7a3e', { layer: 1, wobble: 0.3, seed: 2, ends: 3 }));
    keep(groundStrip(g, arc((th) => pathR(th) + 2.6, 144, 36), 2.1, '#5c5136', { layer: 1, wobble: 0.35, seed: 4, ends: 3 }));
    // the shore path: pale trodden sand along the bank's top, round the hide from the trail
    const pathPts = PATH.pts.filter((_, i) => PATH.acc[i] > 1.2);
    keep(groundStrip(g, pathPts, PATH_HALF, '#c2ad84', { layer: 2, wobble: 0.28, seed: 7, ends: 1.2 }));

    /* -- heather on the land side of the path (low cushions he walks through) -- */
    const heathSpots: { x: number; z: number; s: number; rot: number }[] = [];
    for (let i = 0; i < 260 && heathSpots.length < 120; i++) {
      const th = 146 - rnd() * 110;
      const r = pathR(th) + 0.95 + rnd() * 4.6;
      const p = polar(th, r);
      if (dist(p, HIDE) < 3.8 || dist(p, BENCH) < 1.8 || dist(p, MARKER) < 4) continue;
      if (heathSpots.some((q) => dist(q, p) < 0.62)) continue;
      heathSpots.push({ ...p, s: 0.5 + rnd() * 0.4, rot: rnd() * Math.PI * 2 });
    }
    const heather = keep(new THREE.InstancedMesh(heatherGeometry(23, 140), plantMaterial(), heathSpots.length));
    heather.name = 'ven-heather';
    const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
    heathSpots.forEach((h, i) => heather.setMatrixAt(i, m4.compose(p3.set(h.x, g(h.x, h.z) - 0.02, h.z), q4.setFromAxisAngle(UP, h.rot), s3.set(h.s, h.s * 0.9, h.s))));
    heather.instanceMatrix.needsUpdate = true;
    heather.computeBoundingSphere();
    heather.castShadow = false;

    /* -- the coves: sedge tussocks (one field over all three) -- */
    const clumps: Clump[] = BAY_IDS.flatMap((id) => coveClumps(BAYS[id]));
    this.cover = new CoverField({ parent: this.group, groundY: g, clumps, seed: 61 });
    this.built = this.cover.stems.map((s) => ({ h: s.h, lx: s.lx, lz: s.lz, r: s.r }));

    /* -- veenmos: each cove's cushion and patches, the dark wet band at the water line -- */
    const decals: THREE.BufferGeometry[] = [];
    const patch = (p: Spot, rx: number, rz: number, yaw: number, color: string, layer: number, seed: number): void => {
      const m = groundDecal(g, p.x, p.z, rx, rz, yaw, color, { layer, wobble: 0.22, seed, feather: true });
      decals.push(m.geometry);
      (m.material as THREE.Material).dispose();
    };
    BAY_IDS.forEach((id, bi) => {
      const b = BAYS[id];
      const f = b.frame;
      patch(atLocal(f, 0, -0.1), 0.85, 1.55, f.heading, '#56672f', 2, 5 + bi);                         // the cove's moss
      patch(atLocal(f, CUSHION.u, CUSHION.v), CUSHION.r + 0.06, CUSHION.r, f.heading, '#6c8338', 3, 7 + bi); // the cushion
      patch(atLocal(f, -0.95, -0.35), 0.26, 0.2, f.heading + 0.6, '#6f6d3c', 3, 9 + bi);               // a tuft of older, yellower moss
      patch(atLocal(f, 0.45, 0.32), 0.26, 0.18, f.heading + 0.2, '#617a35', 3, 13 + bi);
    });
    const mossGeo = mergeGeometries(decals);
    for (const d of decals) d.dispose();
    if (mossGeo) mottle(mossGeo, 0.24, 31);
    if (mossGeo) {
      const moss = keep(new THREE.Mesh(mossGeo, new THREE.MeshStandardMaterial({
        vertexColors: true, transparent: true, depthWrite: false, roughness: 0.95,
        polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6,
      })));
      moss.name = 'ven-moss';
      moss.renderOrder = 3;
      moss.receiveShadow = true;
    }

    /* -- cotton-grass: white puffs on thin stems, at the coves' backs and sides -- */
    const cotton: { x: number; z: number; s: number; rot: number }[] = [];
    BAY_IDS.forEach((id) => {
      const b = BAYS[id];
      const spots = [[-1.35, -0.55], [-1.15, -0.8], [1.3, -0.62], [1.12, -0.85], [-1.45, 0.2], [1.45, 0.15], [-0.55, -0.75], [0.15, -0.82], ...BUTTERFLY_SLOTS.map((q) => [q.u, q.v])];
      for (const [u, v] of spots) cotton.push({ ...atLocal(b.frame, u, v), s: 0.85 + rnd() * 0.35, rot: rnd() * 6.28 });
    });
    const cottonMesh = keep(new THREE.InstancedMesh(cottonGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, emissive: '#3c3b35' }), cotton.length));
    cottonMesh.name = 'ven-cotton-grass';
    cotton.forEach((c, i) => cottonMesh.setMatrixAt(i, m4.compose(p3.set(c.x, g(c.x, c.z) - 0.01, c.z), q4.setFromAxisAngle(UP, c.rot), s3.set(c.s, c.s, c.s))));
    cottonMesh.instanceMatrix.needsUpdate = true;
    cottonMesh.computeBoundingSphere();

    /* -- a few cattails at each cove's water line, at its far ends (never in the lens's
       way to a frog) -- */
    const reedSpots: { x: number; z: number; s: number; rot: number }[] = [];
    BAY_IDS.forEach((id) => {
      for (const [u, v] of [[-1.95, 0.8], [-1.75, 1.0], [1.85, 0.9], [2.05, 0.7]]) reedSpots.push({ ...atLocal(BAYS[id].frame, u, v), s: 0.85 + rnd() * 0.3, rot: rnd() * 6.28 });
    });
    void loadModel('prop-reeds').then((m) => {
      if (!m || this.disposed) return;
      const [geo] = lodGeometries('prop-reeds@1', prepModel(m, 1), [650]);
      if (!geo) return;
      const reeds = keep(new THREE.InstancedMesh(geo, lodMaterial(), reedSpots.length));
      reeds.name = 'ven-cattails';
      reedSpots.forEach((r, i) => reeds.setMatrixAt(i, m4.compose(p3.set(r.x, g(r.x, r.z) - 0.03, r.z), q4.setFromAxisAngle(UP, r.rot), s3.set(r.s, r.s * SIZE.lisdodde.h, r.s))));
      reeds.instanceMatrix.needsUpdate = true;
      reeds.computeBoundingSphere();
    });

    /* -- each cove's small things: its moss clods, a heath blue on cotton-grass, a
       stonechat on a dry stalk (the look-alikes a play lays) -- */
    const clodGeo = clodGeometry();
    const clodMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
    this.made.push({ geometry: clodGeo, material: clodMat });
    for (const id of BAY_IDS) {
      const b = BAYS[id];
      const detail = env.detail(b.frame);
      const clods = new THREE.InstancedMesh(clodGeo, clodMat, CLOD_SLOTS.length);
      clods.name = `ven-clods-${id}`;
      clods.castShadow = false;
      detail.add(clods);
      const clodAt: THREE.Matrix4[] = [];
      const anchors: THREE.Object3D[] = [];
      CLOD_SLOTS.forEach((q, i) => {
        const p = atLocal(b.frame, q.u, q.v);
        const s = 0.9 + ((i * 7) % 5) * 0.06;
        clodAt.push(new THREE.Matrix4().compose(new THREE.Vector3(p.x, g(p.x, p.z) - 0.015, p.z), new THREE.Quaternion().setFromAxisAngle(UP, i * 1.9 + 0.4), new THREE.Vector3(s, s, s)));
        const a = new THREE.Object3D();
        a.name = `ven-clod-${id}-${i}`;
        a.position.set(p.x, g(p.x, p.z) + 0.06, p.z);
        detail.add(a);
        anchors.push(a);
      });
      const butterfly = new THREE.Group();
      butterfly.name = `ven-butterfly-${id}`;
      butterfly.visible = false;
      detail.add(butterfly);
      const bird = new THREE.Group();
      bird.name = `ven-bird-${id}`;
      bird.visible = false;
      detail.add(bird);
      const bits: CoveBits = { id, clods, clodAt, wobble: CLOD_SLOTS.map(() => 0), anchors, butterfly, bird, flit: [{ o: null, base: 0, t: 0 }, { o: null, base: 0, t: 0 }] };
      this.coves.set(id, bits);
      // the butterfly sits on a cotton-grass head (0.33 m), the stonechat on a dry stalk
      void env.spawnModel('heideblauwtje', { idle: false }).then((s) => {
        if (!s || this.disposed) { s?.dispose(); return; }
        const r = s.root as THREE.Object3D;
        r.position.set(0, 0.34, 0);
        butterfly.add(r);
        this.spawned.push(s);
        bits.flit[0] = { o: r, base: r.position.y, t: 0 };
      });
      const stalkH = 0.62;
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.011, stalkH, 5).translate(0, stalkH / 2, 0), new THREE.MeshStandardMaterial({ color: '#b39c66', roughness: 1 }));
      stalk.rotation.z = 0.07;
      bird.add(stalk);
      this.made.push(stalk);
      void env.spawnModel('roodborsttapuit', { idle: false }).then((s) => {
        if (!s || this.disposed) { s?.dispose(); return; }
        const r = s.root as THREE.Object3D;
        r.position.set(-Math.sin(0.07) * stalkH, stalkH - 0.012, 0);
        bird.add(r);
        this.spawned.push(s);
        bits.flit[1] = { o: r, base: r.position.y, t: 0 };
      });
    }

    /* -- the soft moss at every station (one shows: this play's) -- */
    for (const { bay, st } of allStations()) {
      const c = carpetAt(st);
      // (drawn from a little above its wet top, so its feathered end lies on dry heather)
      const len = Math.hypot(c.low.x - c.top.x, c.low.z - c.top.z) || 1;
      const up = { x: c.top.x - ((c.low.x - c.top.x) / len) * 0.35, z: c.top.z - ((c.low.z - c.top.z) / len) * 0.35 };
      const line: Spot[] = [];
      for (let k = 0; k <= 12; k++) line.push({ x: up.x + (c.low.x - up.x) * (k / 12), z: up.z + (c.low.z - up.z) * (k / 12) });
      const moss = groundStrip(g, line, c.a * 1.08, MOSS.green, { layer: 4, wobble: 0.22, seed: 17 + st.i, ends: 0.7, roughness: 0.9 });
      mottle(moss.geometry, 0.3, 41 + st.i);
      moss.name = `ven-soft-moss-${bay}${st.i}`;
      // its wet sheen: a lighter, glossy skin over its middle that quakes under a boot
      const sheen = groundStrip(g, line.slice(1, -1), c.a * 0.7, MOSS.sheen, { layer: 5, wobble: 0.3, seed: 23 + st.i, ends: 0.9, roughness: 0.32 });
      mottle(sheen.geometry, 0.2, 47 + st.i);
      // (it quakes about its own middle: the mesh sits there, its points round it)
      sheen.geometry.translate(-c.x, 0, -c.z);
      sheen.position.set(c.x, 0, c.z);
      (sheen.material as THREE.MeshStandardMaterial).opacity = 0.62;
      sheen.name = `ven-soft-moss-sheen-${bay}${st.i}`;
      for (const m of [moss, sheen]) { m.visible = false; keep(m); }
      this.carpets.set(`${bay}.${st.i}`, { carpet: c, moss, sheen });
    }
    // brown water welling up round a boot in it
    this.well = keep(groundDecal(g, 0, 0, 0.42, 0.36, 0, MOSS.mud, { layer: 6, wobble: 0.25, seed: 29, feather: true, roughness: 0.25 }));
    this.well.visible = false;
    this.well.name = 'ven-soft-moss-well';

    /* -- rings on the water: a few, spreading one after another -- */
    const ringMat = new THREE.MeshBasicMaterial({ color: '#eef3ee', transparent: true, opacity: 0, depthWrite: false });
    for (let i = 0; i < 6; i++) {
      const mesh = keep(new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40).rotateX(-Math.PI / 2), ringMat.clone()));
      mesh.visible = false;
      mesh.renderOrder = 5;
      mesh.name = 'ven-ring';
      this.rings.push({ mesh, t: -1, delay: 0, max: 0.8 });
    }
    ringMat.dispose();

    /* -- the adder: laid on the path for a play only -- */
    this.adder = { root: null, at: { x: 0, z: 0, yaw: 0 }, shown: false, lift: 0, liftTo: 0, slide: null };
    void env.spawnModel('adder', { idle: false }).then((s) => {
      if (!s || this.disposed) { s?.dispose(); return; }
      const r = s.root as THREE.Object3D;
      r.visible = this.adder.shown;
      r.name = 'ven-adder';
      this.group.add(r);
      this.spawned.push(s);
      this.adder.root = r;
      this.placeAdder();
    });

    this.layClods(null);
  }

  /* ------------------------------------------------------------- a play ---- */

  /**
   * Lay a play (under the briefing card): the cover as built, the window over this play's
   * frog fitted to the level's glimpse for the search's lens, the trial's look-alikes in its
   * cove (a few clods in the others), the adder on the path, the soft moss at its station.
   * `null`: free roam (nothing of a play: no adder, no soft moss).
   */
  lay(p: VenPlay | null): void {
    this.laid = p;
    // the sedge as built, everywhere (a window opened for another play closes)
    this.cover.stems.forEach((s, i) => {
      const b = this.built[i];
      s.h = b.h; s.lx = b.lx; s.lz = b.lz; s.r = b.r;
      delete s.h0;
    });
    if (p) {
      const view = BAYS[p.laid.bay].views.search;
      const lens = this.env.lensFor(asTheKitFrames(view));
      const back = backPoints(p.frog.x, this.g(p.frog.x, p.frog.z), p.frog.z, p.frog.yaw, FROG_LEN, FROG_H);
      fitWindow(this.cover.stems, this.built, lens.cam, back, p.glimpse, { x: p.frog.x, y: 0, z: p.frog.z });
      // (a stem changed by the fit keeps its built height as h0: drawn as wide as it was)
      this.cover.stems.forEach((s, i) => { if (Math.abs(s.h - this.built[i].h) > 1e-6) s.h0 = this.built[i].h; });
    }
    this.cover.refresh();
    this.layClods(p);
    // the adder (when this play has her) coiled on the warm sand of the path
    this.adder.slide = null;
    this.adder.lift = 0; this.adder.liftTo = 0;
    this.adder.shown = !!p?.adder;
    if (p?.adder) this.adder.at = { ...p.adder };
    this.placeAdder();
    // the soft moss (when this play has it) across the path
    this.carpetOn = null;
    for (const [key, c] of this.carpets) {
      const on = !!p?.carpet && key === `${p.laid.bay}.${p.laid.stations['modder-ven']}`;
      c.moss.visible = c.sheen.visible = on;
      if (on) this.carpetOn = c;
    }
    this.well.visible = false;
    this.wellT = -1;
  }

  /** The search's own fit for the lens it really stands at (searchBeat's `fit`). */
  fitGlimpse(eye: V3, back: readonly V3[], share: number): number[] {
    const f = this.laid?.frog;
    const changed = refitWindow(this.cover.stems, this.built, eye, back, share, { x: f?.x ?? 0, y: 0, z: f?.z ?? 0 });
    return changed;
  }

  /** The look-alikes of the play's cove (as the search takes them). */
  get decoys(): VenDecoy[] {
    const p = this.laid;
    if (!p) return [];
    const bits = this.coves.get(p.laid.bay)!;
    return p.decoys.map((d) => {
      if (d.k === 'butterfly' || d.k === 'bird') {
        const o = d.k === 'butterfly' ? bits.butterfly : bits.bird;
        return { id: d.id, k: d.k, object: o, x: d.x, z: d.z, poke: () => this.flit(bits, d.k === 'butterfly' ? 0 : 1) };
      }
      const i = this.slotOf(p.laid.bay, d);
      return { id: d.id, k: d.k, object: bits.anchors[i], x: d.x, z: d.z, poke: () => this.wobble(bits, i) };
    });
  }

  /** The clod slot a decoy was laid on. */
  private slotOf(bay: BayId, d: Spot): number {
    const b = BAYS[bay];
    let best = 0, bd = Infinity;
    CLOD_SLOTS.forEach((q, i) => { const p = atLocal(b.frame, q.u, q.v); const e = dist(p, d); if (e < bd) { bd = e; best = i; } });
    return best;
  }

  /** The clods, the butterfly and the bird of every cove for a play (or free roam). */
  private layClods(p: VenPlay | null): void {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const [id, bits] of this.coves) {
      const mine = p && p.laid.bay === id;
      const on = new Set<number>(mine ? p!.decoys.filter((d) => d.k === 'bush').map((d) => this.slotOf(id, d)) : FREE_CLODS);
      bits.clodAt.forEach((m, i) => bits.clods.setMatrixAt(i, on.has(i) ? m : zero));
      bits.clods.instanceMatrix.needsUpdate = true;
      bits.clods.computeBoundingSphere();
      bits.anchors.forEach((a, i) => { a.visible = on.has(i); });
      const b = BAYS[id];
      for (const [k, grp] of [['butterfly', bits.butterfly], ['bird', bits.bird]] as const) {
        const d = mine ? p!.decoys.find((q) => q.k === k) : undefined;
        grp.visible = !!d;
        if (d) {
          grp.position.set(d.x, this.g(d.x, d.z), d.z);
          grp.rotation.y = headingTo(d, b.stand) + 0.9;
        }
      }
    }
  }

  private wobble(bits: CoveBits, i: number): void { bits.wobble[i] = 0.9; }
  private flit(bits: CoveBits, k: 0 | 1): void { bits.flit[k].t = 1.1; }

  /* ----------------------------------------------------------- the adder ---- */

  private placeAdder(): void {
    const r = this.adder.root;
    if (!r) return;
    r.visible = this.adder.shown;
    const a = this.adder.at;
    r.position.set(a.x, this.g(a.x, a.z) - 0.01, a.z);
    r.rotation.set(0, a.yaw, 0);
    r.scale.setScalar(ADDER_SCALE);
  }

  /** Where she is (null: not laid this play, or slid away). */
  adderSpot(): Spot | null {
    return this.adder.shown ? { x: this.adder.root?.position.x ?? this.adder.at.x, z: this.adder.root?.position.z ?? this.adder.at.z } : null;
  }
  /** The adder's body (a framed shot includes it; she is seen). */
  get adderBody(): THREE.Object3D | null { return this.adder.shown ? this.adder.root : null; }

  /** She lifts her head (`k` 0..1: 0.5 a look, 1 with a soft hiss) or lowers it again. */
  adderLift(k: number): void { this.adder.liftTo = Math.max(0, Math.min(1, k)); }

  /** Held: she slides off the path into the heather (to `to`) and is gone there. */
  adderSlide(to: Spot, secs = 1.6): Promise<void> {
    if (!this.adder.shown) return Promise.resolve();
    const r = this.adder.root;
    return new Promise((done) => {
      this.adder.slide = { t: 0, from: { x: r?.position.x ?? this.adder.at.x, z: r?.position.z ?? this.adder.at.z }, to, done: () => { done(); } };
      void secs;
    });
  }

  /* ------------------------------------------------------------- the moss ---- */

  /** Is (x, z) a boot in this play's soft moss? */
  inMoss(x: number, z: number, wet: number): boolean {
    const c = this.carpetOn;
    return !!c && inCarpet(c.carpet, { x, z }) < wet;
  }
  /** A boot went in: brown water wells up round it, the moss quakes. */
  sinkAt(x: number, z: number): void {
    // (draped where the boot went in: the ground there, vertex by vertex)
    const d = groundDecal(this.g, x, z, 0.42, 0.36, 0, MOSS.mud, { layer: 6, wobble: 0.25, seed: 29, feather: true, roughness: 0.25 });
    this.well.geometry.dispose();
    this.well.geometry = d.geometry;
    (d.material as THREE.Material).dispose();
    this.well.position.set(x, 0, z);
    this.well.geometry.translate(-x, 0, -z);
    this.well.visible = true;
    this.wellT = 0;
    this.quake = 1;
  }

  /* --------------------------------------------------------- water, sound ---- */

  /** Rings spreading on the water at (x, z), up to `max` m (two, one after the other). */
  ring(x: number, z: number, max = 0.8): void {
    let n = 0;
    for (const r of this.rings) {
      if (r.t >= 0) continue;
      r.mesh.position.set(x, WATER_LEVEL + 0.012, z);
      r.t = 0; r.delay = n * 0.38; r.max = max * (1 - n * 0.25);
      r.mesh.scale.setScalar(0.05);
      if (++n >= 2) break;
    }
  }
  /** A frog went in (the sound is the script's: it knows the listener). */
  plop(x: number, z: number): void { this.ring(x, z, 0.6); }

  /* ------------------------------------------------------------ the frame ---- */

  update(dt: number, t: number, reduced: boolean, movers: readonly { x: number; z: number; moving: boolean; ranger?: boolean }[]): void {
    this.clock += dt;
    this.cover.update(dt, t, reduced, movers);
    // the rings spread and fade
    for (const r of this.rings) {
      if (r.t < 0) { r.mesh.visible = false; continue; }
      r.t += dt;
      const k = (r.t - r.delay) / 1.7;
      if (k < 0) { r.mesh.visible = false; continue; }
      if (k >= 1) { r.t = -1; r.mesh.visible = false; continue; }
      r.mesh.visible = true;
      const s = reduced ? r.max * 0.6 : 0.05 + (r.max - 0.05) * (1 - (1 - k) * (1 - k));
      r.mesh.scale.setScalar(s);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (reduced ? 0.45 : 0.6) * (1 - k);
    }
    // the soft moss quivers when he is close (it is soft), quakes under a boot
    const c = this.carpetOn;
    if (c) {
      const me = movers.find((m) => m.ranger);
      const near = me ? inCarpet(c.carpet, me) : 9;
      const want = near < 2.4 ? 1 : 0;
      this.quiver += (want - this.quiver) * Math.min(1, dt * 3);
      this.quake = Math.max(0, this.quake - dt * 0.7);
      const amp = reduced ? 0 : 0.012 * this.quiver + 0.035 * this.quake;
      const w = 1 + amp * Math.sin(this.clock * 7.5);
      c.sheen.scale.set(w, 1, 2 - w);
      (c.sheen.material as THREE.MeshStandardMaterial).opacity = 0.55 + 0.2 * this.quiver * (0.5 + 0.5 * Math.sin(this.clock * 3.1)) + 0.15 * this.quake;
    }
    if (this.wellT >= 0) {
      this.wellT += dt;
      const k = Math.min(1, this.wellT / 0.6);
      this.well.scale.set(0.4 + 0.6 * k, 1, 0.4 + 0.6 * k);
      (this.well.material as THREE.MeshStandardMaterial).opacity = this.wellT < 2.6 ? 0.9 : Math.max(0, 0.9 - (this.wellT - 2.6));
      if (this.wellT > 3.6) { this.wellT = -1; this.well.visible = false; }
    }
    // the adder: her head up (or down), her slide into the heather
    const a = this.adder;
    if (a.root && a.shown) {
      a.lift += (a.liftTo - a.lift) * Math.min(1, dt * (reduced ? 30 : 5));
      const r = a.root;
      r.scale.set(ADDER_SCALE, ADDER_SCALE * (1 + 0.22 * a.lift), ADDER_SCALE);
      r.rotation.x = -0.12 * a.lift;
      const S = a.slide;
      if (S) {
        S.t = Math.min(1, S.t + (reduced ? 1 : dt / 1.6));
        const e = S.t * S.t * (3 - 2 * S.t);
        const x = S.from.x + (S.to.x - S.from.x) * e, z = S.from.z + (S.to.z - S.from.z) * e;
        r.position.set(x, this.g(x, z) - 0.01 - 0.12 * Math.max(0, (e - 0.7) / 0.3), z);
        r.rotation.y = headingTo(S.from, S.to) + Math.sin(this.clock * 9) * 0.12 * (reduced ? 0 : 1);
        r.scale.set(ADDER_SCALE, ADDER_SCALE, ADDER_SCALE * (1 + 0.25 * Math.sin(Math.PI * e)));
        if (S.t >= 1) { a.slide = null; a.shown = false; r.visible = false; S.done(); }
      }
    }
    // the clods wobble when poked, the butterfly and the bird flit up and settle
    for (const bits of this.coves.values()) {
      let dirty = false;
      bits.wobble.forEach((w, i) => {
        if (w <= 0) return;
        bits.wobble[i] = Math.max(0, w - dt);
        const m = bits.clodAt[i].clone();
        const s = reduced ? 1 : 1 + 0.12 * Math.sin((0.9 - bits.wobble[i]) * 18) * (bits.wobble[i] / 0.9);
        m.multiply(new THREE.Matrix4().makeScale(s, 2 - s, s));
        bits.clods.setMatrixAt(i, m);
        dirty = true;
      });
      if (dirty) bits.clods.instanceMatrix.needsUpdate = true;
      for (const f of bits.flit) {
        if (!f.o || f.t <= 0) continue;
        f.t = Math.max(0, f.t - dt);
        const k = reduced ? 0 : Math.sin((1 - f.t / 1.1) * Math.PI);
        f.o.position.y = f.base + k * 0.18;
      }
    }
  }

  /** A stop, a win, a reload: the play's things go (no adder, no soft moss in free roam);
   *  the frog's cove keeps its sedge as built. */
  setState(_state: HomeState): void {
    this.lay(null);
  }

  dispose(): void {
    this.disposed = true;
    this.cover.dispose();
    for (const s of this.spawned) s.dispose();
    for (const m of this.made) {
      m.geometry.dispose();
      for (const mat of [m.material].flat()) mat.dispose();
    }
    this.group.removeFromParent();
  }
}

/** Mottle a decal's vertex colours (moss: lighter and darker cushions in one carpet). */
function mottle(geo: THREE.BufferGeometry, amt: number, seed: number): void {
  const col = geo.getAttribute('color') as THREE.BufferAttribute | undefined;
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  if (!col) return;
  for (let i = 0; i < col.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const n = Math.sin(x * 7.3 + seed) * Math.cos(z * 6.1 - seed * 0.7) + 0.5 * Math.sin(x * 17.9 - z * 13.3 + seed * 2.3);
    const k = 1 + amt * n;
    const yel = Math.max(0, n) * amt * 0.5; // (the lighter cushions a little yellower)
    col.setXYZ(i, col.getX(i) * k + yel * 0.4, col.getY(i) * k + yel * 0.25, col.getZ(i) * (1 + amt * n * 0.6));
  }
  col.needsUpdate = true;
}

/** One cotton-grass plant (1 m before scaling: ~0.33 m tall): a thin green stem and a white
 *  nodding tuft. Vertex colours. */
function cottonGeometry(): THREE.BufferGeometry {
  const stem = new THREE.CylinderGeometry(0.0035, 0.005, 0.3, 4).translate(0, 0.15, 0).toNonIndexed();
  // (a fluffy tuft: three soft puffs, nodding a little)
  const head = mergeGeometries([
    new THREE.IcosahedronGeometry(0.03, 1).scale(1, 1.3, 1).translate(0.014, 0.335, 0),
    new THREE.IcosahedronGeometry(0.024, 1).translate(0.032, 0.318, 0.012),
    new THREE.IcosahedronGeometry(0.022, 1).translate(-0.004, 0.318, -0.014),
  ].map((q) => { q.deleteAttribute('uv'); return q; })) ?? new THREE.IcosahedronGeometry(0.03, 1);
  const paint = (geo: THREE.BufferGeometry, c: THREE.Color): void => {
    const n = geo.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.deleteAttribute('uv');
  };
  paint(stem, new THREE.Color('#6f7f3a'));
  paint(head, new THREE.Color('#fbf9f1'));
  const out = mergeGeometries([stem, head]) ?? head;
  out.computeVertexNormals();
  stem.dispose();
  if (out !== head) head.dispose();
  return out;
}

/** A frog-sized moss clod (1 = ~0.22 × 0.1 m): a low lumpy mound of peat and moss, brown
 *  below, mossy and a little red-brown on top — the frog's own colours. Vertex colours. */
function clodGeometry(): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const low = new THREE.Color('#4e3a28'), mid = new THREE.Color('#8a5a3a'), top = new THREE.Color('#6f7a3a');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const lump = 1 + 0.16 * Math.sin(x * 5.1 + z * 3.3) * Math.cos(y * 4.2 - x * 2.1);
    pos.setXYZ(i, x * 0.11 * lump, Math.max(-0.2, y) * 0.065 * lump + 0.012, z * 0.09 * lump);
    const k = (y + 1) / 2;
    c.copy(low).lerp(mid, Math.min(1, k * 1.6));
    if (k > 0.72) c.lerp(top, ((k - 0.72) / 0.28) * (0.5 + 0.5 * Math.sin(x * 9 + z * 7)));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.deleteAttribute('uv');
  geo.computeVertexNormals();
  return geo;
}
