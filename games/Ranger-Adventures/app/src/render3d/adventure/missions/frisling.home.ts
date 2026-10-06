/**
 * frisling.home.ts — the rotte's home in the world, built with the world (the THREE
 * half of frisling.places.ts): the muddy WALLOW with its fallen log and bracken rim,
 * THREE STANDS of bracken and pijpenstrootje the lost piglet may lie in (run 7: one per
 * way, each with its look-alike things a searching child may take for him: rust-brown dead
 * fronds, a butterfly on a foxglove, a stonechat on a seed head, a nightjar at the edge),
 * loose clumps along each way home, the two ROOTING FIELDS' seven patches of turned earth,
 * and a few small trotter prints in the empty marker ring.
 *
 * It stands before the mission and after it (a place, not a prop that vanishes); only
 * the ring's little prints go once he is home. Each play is laid in under the briefing
 * card (`lay`): the piglet's nook gets a small window in the stems over his back for the
 * search's lens (frisling.window `fitGlimpse`, the knobs' glimpse fitted both ways: his
 * stripes glimpsed between the stems, as much in every nook and every way he lies), the
 * trial's look-alikes go to this play's spots, the ring's prints point the way.
 * `layDefault` puts back free roam's home (run 6's stand).
 */

import * as THREE from 'three';
import type { Distractor } from '../../../content/types';
import type { DressingEnv, HomeDressing } from '../../world/Residents';
import type { HomeState } from '../types';
import { CoverField } from '../cover';
import { visibleShare, type Clump, type V3 } from '../cover-math';
import { PatchField } from '../patches';
import { StandDecoys, type Decoy } from '../decoys';
import { groundDecal } from '../decal';
import { atLocal, headingTo, stream } from '../places';
import { CutFence } from './frisling.clue';
import { fitGlimpse, lensAxis, pigletBack, refitGlimpse, shareFor } from './frisling.window';
import { SIZE } from '../../AnimalScale';
import {
  FRISLING_PLACES, WALLOW, WALLOW_FRAME, WALLOW_LOG, MARKER, WAYS, WAY_IDS, DEFAULT_WAY, NEST_R,
  fieldFrame, fieldSpotsOf, wallowClumps, wallowLog, standCover, standSeed, spotTag, nookAt, decoyAt,
  type FieldId, type WayId,
} from './frisling.places';
import { assignSpots, type DecoyKind } from './frisling.vary';

export type { Decoy } from '../decoys';

/** How far a stand of bracken is drawn from its own spot (m): it fades in calmly (0.9 s)
 *  once the lens is within 30 m and rests beyond 36 m — never a pop, and never ~40 000
 *  triangles for a stand nobody looks at (three stands lie 33-40 m from the wallow and the
 *  marker, where the world's triangles are tightest). */
const STAND_REACH = { near: 30, far: 36, own: true } as const;

/** One way's stand: its own cover (three draw calls), its look-alikes, resting by its own
 *  distance (and, while a play goes another way, by that distance still). */
class Stand {
  readonly group: THREE.Object3D;
  readonly cover: CoverField;
  readonly decoys: StandDecoys;
  /** a look-alike spot's dead-bracken clump (its index in the cover) */
  readonly spotClump: number[];
  /** run 7 (body): the nest of bitten fronds at its edge (a find for the veldgids) */
  readonly nest: THREE.Mesh;
  private readonly env: DressingEnv;
  readonly id: WayId;
  /** the stems as grown (a window is fitted from these) */
  private readonly built: readonly { h: number; lx: number; lz: number; r: number }[];
  /** the nook, pose and glimpse the window was last fitted for */
  private laid: { nook: number; pose: 0 | 1 | 2; glimpse: number } = { nook: 0, pose: 0, glimpse: 0.3 };

  constructor(env: DressingEnv, id: WayId, distractors: readonly Distractor[]) {
    this.env = env;
    this.id = id;
    const w = WAYS[id];
    this.group = env.detail(w.stand, STAND_REACH);
    const clumps: Clump[] = standCover(id);
    this.cover = new CoverField({ parent: this.group, groundY: env.groundY, clumps, seed: standSeed(id) });
    this.built = this.cover.stems.map((s) => ({ h: s.h, lx: s.lx, lz: s.lz, r: s.r }));
    this.spotClump = w.decoySpots.map((_, i) => clumps.findIndex((c) => c.decoy === spotTag(i)));
    // the look-alikes, first on their default spots (free roam's stand shows them there)
    const spots = assignSpots(w.decoySpots.map((_, i) => i), w.decoySpots, distractors.map(kindOf));
    const at = distractors.map((d, i) => ({ d, ...decoyAt(id, spots[i]) }));
    const tagged = clumps.map((c) => {
      const i = distractors.findIndex((d, k) => d.k === 'bush' && c.decoy === spotTag(spots[k]));
      return i >= 0 ? { ...c, decoy: distractors[i].id } : c;
    });
    this.decoys = new StandDecoys(env, this.group, at, this.cover, tagged, w.coverApproach, { perch: 'frond' });
    // run 7 (body): a sow's nest of bitten fronds at the stand's edge (a find, never a look-alike)
    this.nest = nestMesh(env.groundY, w.nest, w.cover.seed + 3);
    this.group.add(this.nest);
    // no look-alike stands in a stand until a play (or free roam's default) lays them
    for (const ci of this.spotClump) this.cover.showClump(ci, false);
    this.decoys.useDecoys([]);
  }

  /** The trial's look-alikes on their spots (decoy i of `trial` on `spots[i]`); the rest go. */
  layDecoys(trial: readonly Distractor[], spots: readonly number[]): void {
    for (const ci of this.spotClump) this.cover.showClump(ci, false);
    this.decoys.relay(trial.map((d, i) => ({ id: d.id, ...decoyAt(this.id, spots[i]), clump: this.spotClump[spots[i]] })), WAYS[this.id].coverApproach);
    this.decoys.useDecoys(trial.map((d) => d.id));
  }

  /** Run 7 (body): is the sow's nest at this stand this play? */
  showNest(on: boolean): void { this.nest.visible = on; }

  /** No look-alikes, no window: the stand as it grows. */
  clear(): void {
    for (const ci of this.spotClump) this.cover.showClump(ci, false);
    this.decoys.useDecoys([]);
    this.cover.reset();
  }

  /** Close any old window and fit one over him lying in `nook` (as `pose`), for the
   *  search's lens: the level's `glimpse` of his back shows (frisling.window `shareFor`:
   *  as big in the picture in every nook), the stand opened or closed to it. */
  openFor(nook: number, pose: 0 | 1 | 2, glimpse: number): { share: number; changed: number; eye: V3 } {
    const w = WAYS[this.id];
    this.cover.reset();
    this.laid = { nook, pose, glimpse };
    const eye = this.env.lensFor(w.searchView).cam;
    const { back, at, want } = this.backFor(eye);
    const changed = fitGlimpse(this.cover.stems, this.built, eye, back, want, at);
    this.cover.refresh();
    return { share: visibleShare(back, eye, this.cover.stems), changed: changed.length, eye };
  }

  /** The search's own check for the lens it really stands at (`searchBeat`'s `fit`): off
   *  the band, the window is fitted again for it; returns the stems that grow to it. */
  refitFor(eye: V3, glimpse = this.laid.glimpse): number[] {
    this.laid = { ...this.laid, glimpse };
    const { back, at, want } = this.backFor(eye);
    const changed = refitGlimpse(this.cover.stems, this.built, eye, back, want, at);
    this.shown = visibleShare(back, eye, this.cover.stems);
    return changed;
  }
  /** the share of his back the search's lens saw (frisling.window's fine grid), as fitted */
  shown = 0;

  /** His back lying as laid, where he lies, and the share of it to show from `eye`. */
  private backFor(eye: V3): { back: V3[]; at: V3; want: number } {
    const p = nookAt(this.id, this.laid.nook, this.laid.pose);
    const y = this.env.groundY(p.x, p.z);
    const back = pigletBack(p, y);
    const v = WAYS[this.id].searchView;
    return { back, at: { x: p.x, y, z: p.z }, want: shareFor(this.laid.glimpse, back, p.yaw, eye, lensAxis(v.heading, v.pitchDeg)) };
  }

  update(dt: number, t: number, reduced: boolean, movers: readonly { x: number; z: number; moving: boolean }[]): void {
    if (!this.group.visible) return;
    this.cover.update(dt, t, reduced, movers);
    this.decoys.update(dt, reduced);
  }

  dispose(): void {
    this.cover.dispose();
    this.decoys.dispose();
    this.nest.geometry.dispose();
    (this.nest.material as THREE.Material).dispose();
  }
}

/**
 * A sow's nest (a 'worpketel'): a low, soft bed of bitten bracken fronds she dragged into a
 * heap and lay on, about 0.9 m across — fronds pressed flat every which way, overlapping
 * (most in the middle, where she lay), their leaflets and ragged tips making the edge: no
 * ring, no rim, nothing raised more than a few centimetres. Muted dry-bracken browns and a
 * faded green, lit evenly (every normal up: matte, no facets), so it sits quietly in the
 * heather and never pulls the eye in a held picture. One mesh, vertex-coloured, built in
 * world coordinates on the ground at `at`. Plain dressing: never a look-alike, never clicked.
 */
function nestMesh(g: (x: number, z: number) => number, at: { x: number; z: number }, seed: number): THREE.Mesh {
  const pos: number[] = [];
  const col: number[] = [];
  const rnd = stream(seed);
  // dry, bitten bracken, muted: soft browns and a faded green, never dark, never bright
  const tones = ['#8a7759', '#7e6e52', '#91805f', '#776a50', '#857a5a', '#7b7c58'].map((c) => new THREE.Color(c));
  const put = (x: number, y: number, z: number, c: THREE.Color): void => {
    pos.push(at.x + x, g(at.x + x, at.z + z) + y, at.z + z);
    col.push(c.r, c.g, c.b);
  };
  const tri = (a: number[], b: number[], c: number[], k: THREE.Color): void => {
    put(a[0], a[1], a[2], k); put(b[0], b[1], b[2], k); put(c[0], c[1], c[2], k);
  };
  const FRONDS = 26;
  for (let i = 0; i < FRONDS; i++) {
    // where it lies: more of them towards the middle (where she lay), any way round
    const ra = rnd() * Math.PI * 2, rr = NEST_R * Math.sqrt(rnd()) * 0.75;
    const bx = Math.cos(ra) * rr, bz = Math.sin(ra) * rr;
    const dir = rnd() * Math.PI * 2;
    // its length, cut short where its tip would reach past the bed (a ragged edge, no ring)
    let len = 0.26 + rnd() * 0.22;
    const reach = NEST_R * (1.05 + rnd() * 0.2);
    while (len > 0.12 && Math.hypot(bx + Math.cos(dir) * len, bz + Math.sin(dir) * len) > reach) len -= 0.03;
    const w = 0.035 + rnd() * 0.015;
    const lift = 0.006 + (i / FRONDS) * 0.022; // (laid one over another: later ones on top)
    const c = tones[Math.floor(rnd() * tones.length)].clone().multiplyScalar(0.94 + rnd() * 0.1);
    const ux = Math.cos(dir), uz = Math.sin(dir), vx = -uz, vz = ux; // along it, across it
    const at2 = (t: number, side: number, y: number): number[] => [bx + ux * len * t + vx * side, y, bz + uz * len * t + vz * side];
    // its stalk-and-blade: a tapering strip, pressed flat
    const STEPS = 3;
    for (let k = 0; k < STEPS; k++) {
      const t0 = k / STEPS, t1 = (k + 1) / STEPS;
      const w0 = w * (1 - t0 * 0.7), w1 = w * (1 - t1 * 0.7);
      const y0 = lift + 0.004 * Math.sin(Math.PI * t0), y1 = lift + 0.004 * Math.sin(Math.PI * t1);
      const a = at2(t0, -w0, y0), b = at2(t0, w0, y0), d = at2(t1, w1, y1), e = at2(t1, -w1, y1);
      tri(a, b, d, c); tri(a, d, e, c);
    }
    // its leaflets: small ragged points off both sides (the fern's outline, bitten short)
    for (const t of [0.3, 0.55, 0.8]) {
      for (const side of [-1, 1]) {
        if (rnd() < 0.25) continue; // (bitten off)
        const lw = w * (1.1 - t * 0.6), ll = 0.05 + rnd() * 0.04;
        const base0 = at2(t - 0.07, side * lw * 0.5, lift + 0.002), base1 = at2(t + 0.07, side * lw * 0.5, lift + 0.002);
        const tip = at2(t + 0.12, side * (lw * 0.5 + ll), lift + 0.001);
        tri(base0, side > 0 ? tip : base1, side > 0 ? base1 : tip, c);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  // (every normal straight up: the bed takes the light as the ground round it does, soft and
  // even, never the hard facets a ring of raised strips showed)
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length / 3).fill([0, 1, 0]).flat(), 3));
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
  m.name = 'frisling-nest';
  m.castShadow = false;
  m.receiveShadow = false;
  return m;
}

/**
 * The pigs' rubbing log (a 'malboom'): mud smeared along the side of the fallen log that
 * faces the wallow, at a pig's flank height, and a few dark bristles caught in it — one
 * mesh (the bristles thin blades in it), world coordinates, laid on the log at `at`
 * turned `rot` (the log's own turn).
 */
function rubMarks(g: (x: number, z: number) => number, at: { x: number; z: number }, rot: number, side: number): THREE.Mesh {
  const pos: number[] = [];
  const col: number[] = [];
  const c = Math.cos(rot), s = Math.sin(rot);
  const R = 0.215, CY = 0.2; // (the lying log's radius and the height of its middle, m)
  const base = g(at.x, at.z) - 0.04;
  /** a point on the log's round surface, `lift` m out: along it (lx), round it (θ from the
   *  top, toward the wallow's side) */
  const on = (lx: number, th: number, lift: number): [number, number, number] => {
    const lz = side * Math.sin(th) * (R + lift), ly = CY + Math.cos(th) * (R + lift);
    return [at.x + lx * c + lz * s, base + ly, at.z - lx * s + lz * c];
  };
  const muds = ['#7a5838', '#6a4a2e', '#8a6644'].map((h) => new THREE.Color(h));
  const rnd = stream(41);
  // the smears: dried mud rubbed onto the top and the wallow's side of the log, where a
  // pig's flank and back go along it
  for (let k = 0; k < 4; k++) {
    const cx = -0.55 + k * 0.36 + rnd() * 0.08, len = 0.17 + rnd() * 0.07;
    const th0 = 0.25 + rnd() * 0.2, th1 = 1.15 + rnd() * 0.3;
    const cm = muds[k % muds.length];
    const NU = 5, NV = 4;
    for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
      const u0 = -1 + (2 * i) / NU, u1 = -1 + (2 * (i + 1)) / NU;
      const v0 = j / NV, v1 = (j + 1) / NV;
      // (an oval: narrower at its ends round the log)
      const half = (v: number): number => len * Math.sqrt(Math.max(0.05, 1 - (2 * v - 1) ** 2));
      const P = (u: number, v: number): [number, number, number] => on(cx + u * half(v), th0 + (th1 - th0) * v, 0.008);
      const q = [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)];
      for (const v of [q[0], q[1], q[2], q[0], q[2], q[3]]) { pos.push(...v); col.push(cm.r, cm.g, cm.b); }
    }
  }
  // a few dark bristles caught in the mud, sticking out a little
  const bristle = new THREE.Color('#2a2018');
  for (let i = 0; i < 16; i++) {
    const lx = -0.6 + rnd() * 1.2, th = 0.3 + rnd() * 1.0, len = 0.035 + rnd() * 0.035;
    const a = on(lx, th, 0.01), b = on(lx + 0.006, th, 0.01), t = on(lx + (rnd() - 0.5) * 0.04, th + 0.05, 0.01 + len);
    for (const v of [a, b, t]) { pos.push(...v); col.push(bristle.r, bristle.g, bristle.b); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.name = 'frisling-rub';
  m.castShadow = false;
  return m;
}

/** A content distractor as the variant reads it. */
const kindOf = (d: Distractor): DecoyKind => ({ k: d.k, animal: d.animal });

/** The frisling home, as the adventure uses it. */
export class FrislingHome implements HomeDressing {
  readonly group = new THREE.Group();
  /** the wallow's own cover: its rim and the clumps between the north field and it */
  readonly wallowCover: CoverField;
  readonly stands: Readonly<Record<WayId, Stand>>;
  readonly fields: Readonly<Record<FieldId, PatchField>>;
  /** the way laid in now (this play's, or free roam's default) */
  way: WayId = DEFAULT_WAY;
  /** the stems a lens at the search's eye sees the piglet's back past (stats) */
  glimpse: { share: number; changed: number } = { share: 0, changed: 0 };
  /** the eye the stand's window was opened for */
  searchEye: V3 = { x: 0, y: 0, z: 0 };
  private readonly ringPrints: THREE.InstancedMesh;
  /** the season's first clue (after): the cut fence past the wallow, boot prints through it */
  readonly clue: CutFence;
  /** while the adventure plays, the clue waits for its moment (`revealClue`), never
   *  appearing in the reunion's view */
  holdClue = false;
  /** run 7 (body): the mud and bristles on the rubbing log (a find for the veldgids) */
  readonly rub!: THREE.Mesh;
  private readonly spawned: { dispose(): void }[] = [];
  private readonly distractors: readonly Distractor[];
  private readonly env: DressingEnv;

  constructor(env: DressingEnv, distractors: readonly Distractor[]) {
    this.env = env;
    this.distractors = distractors;
    this.group.name = 'frisling-home';
    env.parent.add(this.group);
    const g = env.groundY;

    /* -- the wallow: mud in a shallow dip, a wetter core, churned earth round it -- */
    const W = FRISLING_PLACES.wallow;
    const yaw = WALLOW_FRAME.heading;
    this.group.add(groundDecal(g, W.x, W.z, WALLOW.halfW + 0.7, WALLOW.halfD + 0.6, yaw, '#5b4430', { layer: 1, wobble: 0.16, seed: 3, feather: true }));
    this.group.add(groundDecal(g, W.x, W.z, WALLOW.halfW, WALLOW.halfD, yaw, '#3e2c1d', { layer: 2, wobble: 0.14, seed: 5, roughness: 0.55 }));
    const wet = atLocal(WALLOW_FRAME, -0.3, 0.2);
    this.group.add(groundDecal(g, wet.x, wet.z, WALLOW.halfW * 0.55, WALLOW.halfD * 0.5, yaw + 0.4, '#2a1d14', { layer: 3, wobble: 0.2, seed: 9, roughness: 0.12, metalness: 0.05 }));
    // the fallen log they scratch on
    const logAt = atLocal(WALLOW_FRAME, WALLOW_LOG.u, WALLOW_LOG.v);
    void env.spawnPlant('prop-fallen-log', SIZE.boomstam.h * 0.8).then((s) => {
      if (!s) return;
      const r = s.root as THREE.Object3D;
      r.position.set(logAt.x, g(logAt.x, logAt.z) - 0.04, logAt.z);
      r.rotation.y = yaw + WALLOW_LOG.turn;
      this.group.add(r);
      this.spawned.push(s);
    });
    env.obstacles.push(wallowLog());
    // run 7 (body): the log is the pigs' rubbing post — mud and bristles on its wallow side
    {
      const rot = yaw + WALLOW_LOG.turn;
      const c = Math.cos(rot), s = Math.sin(rot);
      const dx = W.x - logAt.x, dz = W.z - logAt.z;
      const side = Math.sign(dx * s + dz * c) || 1; // (the wallow's side of the log, in its own z)
      this.rub = rubMarks(g, logAt, rot, side);
      env.detail(logAt).add(this.rub);
    }

    /* -- the wallow's cover: its rim and the clumps between the north field and it -- */
    this.wallowCover = new CoverField({
      parent: this.group, groundY: g, seed: 17,
      clumps: wallowClumps().map((h) => ({ x: h.x, z: h.z, kind: h.size >= 1 ? 'bracken' as const : 'mix' as const, size: h.size })),
    });

    /* -- the three stands (each with its look-alikes and the clumps beside its way home) -- */
    this.stands = { wei: new Stand(env, 'wei', distractors), steen: new Stand(env, 'steen', distractors), berk: new Stand(env, 'berk', distractors) };

    /* -- the rooting fields: seven look-alike patches of turned earth each (small things) -- */
    const field = (f: FieldId, seed: number): PatchField => {
      const fr = fieldFrame(f);
      // (at rest the seven mounds are one draw: both fields are often in view at once)
      return new PatchField({ parent: env.detail(fr), groundY: g, spots: fieldSpotsOf(f), size: 0.95, heading: fr.heading + Math.PI, seed, instancedRest: true });
    };
    this.fields = { N: field('N', 23), S: field('S', 29) };

    /* -- a few small trotter prints in the empty marker ring, toward the way -- */
    this.ringPrints = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.05, 0.065).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#2c1f15', roughness: 1, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 8);
    this.ringPrints.name = 'ring-prints';
    this.ringPrints.renderOrder = 2;
    env.detail(MARKER).add(this.ringPrints);

    /* -- the clue (after): a cut fence past the wallow -- */
    this.clue = new CutFence(this.group, g, env.obstacles);

    this.layDefault();
  }

  /** This play's stand, its field, its look-alikes (what the script works with). */
  get stand(): Stand { return this.stands[this.way]; }
  get cover(): CoverField { return this.stands[this.way].cover; }

  /** The search's check for the lens it really stands at (`searchBeat`'s `fit`): this
   *  play's stand fitted again for it when its share is off the level's (frisling.window). */
  refitSearch(eye: V3, glimpse: number): number[] { return this.stands[this.way].refitFor(eye, glimpse); }
  /** The share of his back the search showed, on frisling.window's fine grid (the measure
   *  the window is fitted to; the search's own fifteen points read it in fifteenths). */
  get searchShown(): number { return this.stands[this.way].shown; }
  get field(): PatchField { return this.fields[WAYS[this.way].field]; }
  get decoys(): readonly Decoy[] { return this.stands[this.way].decoys.decoys; }
  /** run 7 (body): this play's stand's nest of bitten fronds */
  get nest(): THREE.Mesh { return this.stands[this.way].nest; }

  /**
   * Lay a play in (under the briefing card): the stand of its way gets the trial's
   * look-alikes on this play's spots and a window over the nook he lies in; the other
   * stands stand empty; the ring's prints point the way.
   */
  lay(way: WayId, o: { nook: number; pose: 0 | 1 | 2; trial: readonly Distractor[]; spots: readonly number[]; glimpse: number; nest?: boolean }): void {
    this.way = way;
    // (the sow's nest: at this play's stand when the play has one, never at the others —
    // one draw call, not three, when the lens looks out over the far stands; free roam
    // shows the default stand's)
    for (const id of WAY_IDS) this.stands[id].showNest(id === way && (o.nest ?? true));
    for (const id of WAY_IDS) if (id !== way) this.stands[id].clear();
    const st = this.stands[way];
    st.layDecoys(o.trial, o.spots);
    const win = st.openFor(o.nook, o.pose, o.glimpse);
    this.glimpse = { share: win.share, changed: win.changed };
    this.searchEye = win.eye;
    this.pointRing(way);
  }

  /** Free roam's home: run 6's stand with the content's look-alikes, the piglet in its
   *  first nook (his squeak comes from there), the ring's prints pointing north. */
  layDefault(glimpse = 0.3): void {
    const w = WAYS[DEFAULT_WAY];
    this.lay(DEFAULT_WAY, {
      nook: 0, pose: 0, trial: this.distractors, glimpse,
      spots: assignSpots(w.decoySpots.map((_, i) => i), w.decoySpots, this.distractors.map(kindOf), w.nearNook?.[0]),
    });
  }

  /** The ring's few little prints, pointing along the way the follow goes. */
  private pointRing(way: WayId): void {
    const g = this.env.groundY;
    const h = headingTo(MARKER, WAYS[way].follow[1] ?? WAYS[way].stand);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), h);
    for (let i = 0; i < 4; i++) {
      for (const side of [-1, 1]) {
        const p = atLocal({ x: MARKER.x, z: MARKER.z, heading: h }, side * 0.035 + (i % 2 ? 0.05 : -0.05), -0.6 + i * 0.4);
        m.compose(new THREE.Vector3(p.x, g(p.x, p.z) + 0.03, p.z), q, new THREE.Vector3(1, 1, 1));
        this.ringPrints.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), m);
      }
    }
    this.ringPrints.instanceMatrix.needsUpdate = true;
  }

  /** A clump the piglet dived into rustles (whichever cover it is in). */
  rustleNear(x: number, z: number, amp: number): void {
    for (const c of [this.wallowCover, this.cover]) {
      const cl = c.nearestClump(x, z);
      if (cl && cl.d < 1.2) { c.rustle(cl.i, amp); return; }
    }
  }

  /** The clumps a frightened piglet may dive into on this play's way (its stand, the
   *  clumps beside the way home, the wallow's). */
  hideSpots(): { x: number; z: number }[] {
    return [...this.cover.clumps.filter((q) => q.kind !== 'dead'), ...this.wallowCover.clumps].map((q) => ({ x: q.x, z: q.z }));
  }

  /** The clue drops: the cut fence fades in (under the raaf's card). */
  revealClue(secs = 1.2): void {
    this.holdClue = false; // (the mission is done: a borrowed home gets its state on release)
    this.clue.show(true, secs);
  }

  /** A decoy clicked: it does what it would (the dead fronds rustle and part, the bird flits). */
  poke(d: Decoy, from: { x: number; z: number }): void { this.stand.decoys.poke(d, from); }

  setState(state: HomeState): void {
    this.ringPrints.visible = state === 'before';
    this.clue.show(state === 'after' && !this.holdClue);
  }

  update(dt: number, t: number, reduced: boolean, movers: readonly { x: number; z: number; moving: boolean }[]): void {
    this.wallowCover.update(dt, t, reduced, movers);
    for (const id of WAY_IDS) this.stands[id].update(dt, t, reduced, movers);
    this.fields.N.update(dt, reduced);
    this.fields.S.update(dt, reduced);
    this.clue.update(dt);
  }

  dispose(): void {
    this.wallowCover.dispose();
    for (const id of WAY_IDS) this.stands[id].dispose();
    this.fields.N.dispose();
    this.fields.S.dispose();
    this.clue.dispose();
    this.rub.geometry.dispose();
    (this.rub.material as THREE.Material).dispose();
    this.rub.removeFromParent();
    for (const s of this.spawned) s.dispose();
    this.ringPrints.geometry.dispose();
    (this.ringPrints.material as THREE.Material).dispose();
    this.ringPrints.removeFromParent();
    this.group.removeFromParent();
  }
}

