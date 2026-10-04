/**
 * eekhoorn.home.ts — the squirrel's home in the world, built with the world (the THREE
 * half of eekhoorn.places.ts): its GLADE — seven look-alike mossy cushions in the oak leaves
 * where it buries acorns (laid anew each play, in that play's mirror-image of the pattern,
 * each cushion its own look), a stump with its store of acorns, a dead snag — and its
 * neighbours: one bird per perch round the stump (the store pine's dead stub, its bark, the
 * snag's top), drawn per play (run 7, `setNeighbours`), and the jay, the nut thief, waiting
 * on the glade oak's low stub (it glides down to the acorns, backs off a step at every echo
 * he gets right, and flies off). The trees themselves are forest trees (the world draws
 * them), and so are the dead branch stubs it sits on: each is part of its tree
 * (eekhoorn.places `branchStub`), so it fades with it when the lens looks through the tree,
 * never hanging solid in the air (review, 2026-09-29). Plus the acorn being buried or dug
 * up, and the little puffs of earth the squirrel throws as it digs.
 *
 * It stands before the mission and after it. After, the store is a bigger heap, the jay
 * has flown, and on a later visit a tiny oak seedling stands where an acorn was forgotten.
 * Nothing here draws from the page's own random: a play hands its own stream (`layPlay`).
 */

import * as THREE from 'three';
import type { DressingEnv, HomeDressing } from '../../world/Residents';
import type { HomeState, Spot } from '../types';
import { PatchField } from '../patches';
import { boxObstacle } from '../../CharacterController';
import { lineClear, trunkUpright, type Trunk, type Upright } from '../squirrel-math';
import { Squirrel, type SquirrelTree } from '../squirrel';
import type { ActorEnv } from '../actors';
import { SIZE } from '../../AnimalScale';
import {
  GLADE_FRAME, HEAP, HEAP_SPOTS, HOME_TREES, JAY_GROUND, JAY_WAIT, NEIGHBOURS, PERCH, ROUTES, SEEDLING_AT, SLOTS, SNAG, SPOT_SIZE, STUMP, WOODPECKER,
  EEKHOORN_PLACES, FIRST_TRIO, gladeSpots, type EekhoornPlay, type FieldSym, type HomeTree, type Slot, type Trio,
  NEST, DINING, STRONK, STAM, SeenClock, diningById, nestOf, nestSolid, type DiningId, type DiningSpot, type NestSpot,
} from './eekhoorn.places';
import { headingTo, stream } from '../places';
import { acornGeometry, acornMaterial } from '../acorn';

/** The squirrel's view of a home tree: its trunk and its branch. */
export function squirrelTree(t: HomeTree): SquirrelTree {
  const trunk: Trunk = { x: t.x, z: t.z, H: t.h, species: t.species };
  const b = t.branch ?? { ang: 0, h: 1.6, out: 0.28 };
  return { trunk, branch: { tree: trunk, ang: b.ang, h: b.h, out: b.out } };
}

/** A bird round the stump: the thing a child clicks in the call-back game. */
export interface Neighbour {
  /** the content animal id ('koolmees', 'groene-specht', 'gaai' …) */
  id: string;
  /** its perch round the stump (the jay: 'gaai') */
  slot: Slot | 'gaai';
  /** what a player clicks (the bird's holder) */
  object: THREE.Group;
  /** the bird itself (its own materials: it lights up), once loaded */
  body: THREE.Object3D | null;
  /** it calls: a hop and a flick of its tail (the beat lights it) */
  call(): void;
  /** where it sits (world) */
  at: THREE.Vector3;
}

/**
 * How each bird sits on its perch (measured on its GLB, 2026-10-03, by looking at it on
 * the perch): `clipBelow` cuts the modeller's perch block under its feet (in the model's
 * own units: a twig, a lump); `down` turns it head-down, belly to the bark (a nuthatch
 * walking down a trunk); `turn` a little more round on its perch (rad); `sink` how far the
 * cut-away block lowers it (m).
 */
interface BirdPose { clipBelow?: number; down?: boolean; turn?: number; sink?: number; feet?: number }
const BIRD_POSE: Readonly<Record<string, BirdPose>> = {
  // a yellow lump under its feet; it clings to the bark (as run 6 had it)
  'groene-specht': { clipBelow: -0.43, sink: 0.02 },
  // the great tit stands on a twig of its own, its feet a third up the model
  koolmees: { clipBelow: -0.22, feet: 0.37 },
  // the nuthatch stands on a branch end; on the bark it walks down head-first
  boomklever: { clipBelow: -0.26, feet: 0.29, down: true },
  // the cuckoo holds a twig that runs down to the ground
  koekoek: { clipBelow: -0.33, feet: 0.34 },
};

/** A neighbour bird as the home moves it: where it sits now (`base`), where it sits
 *  before the mission (`home`), a hop when it calls, a glide down, a flight away. */
interface Bird {
  o: THREE.Group;
  base: THREE.Vector3;
  baseYaw: number;
  home: THREE.Vector3;
  homeYaw: number;
  kind: string;
  hop: number;
  seed: number;
  /** its flight away (s into it; −1 = not flying, 99 = gone) */
  fly: number;
  /** a glide from one perch to another (the jay coming down to the store, or a hop back) */
  glide: { from: THREE.Vector3; to: THREE.Vector3; yaw0: number; yaw1: number; t: number; dur: number; arc: number } | null;
  n: Neighbour;
  spawned: { dispose(): void } | null;
  /** disposed while its model was still loading */
  gone: boolean;
  /** resting: he is far off (it is a speck there, and it costs the picture ~10k triangles) */
  rest: boolean;
  /** how much of it shows (0 resting … 1 there): it fades in and out */
  show: number;
}

/** How far (m) the ranger must have been from the glade before the seedling grows (out
 *  of sight behind the trees: back at the squirrel's first pine is far enough). */
const AWAY_M = 16;
/** The free world's moss before any play: the pattern as drawn, its first look. */
const FIRST_FIELD: { sym: FieldSym; seed: number } = { sym: 'recht', seed: 41 };
/** A bird round the stump rests (fades out, then is not drawn) while he is further than
 *  this from it (m; it fades back in a little nearer): from there, through the follow lens
 *  behind him, a great tit is ~8 px and the raven ~19 px — and each bird costs the picture
 *  10-15k triangles, which the view over the squirrel's wood toward the tower cannot spare
 *  (it draws ~0.98M of the 1M before the home adds a pine; measured 2026-10-03). */
const BIRD_REST_M = 13;
const BIRD_WAKE_M = 12;
/** How long a bird takes to fade in or out (s): a calm appearing, never a pop. */
const BIRD_FADE_S = 0.6;
/** The oak seedling a forgotten acorn grew into: how tall it stands (m) — a young oak a
 *  child spots from the glade's edge (≈ 40 px through the follow lens from 6 m) — and when
 *  he has SEEN it in free roam (run 7: within `SEEDLING_SEE.within` m, `px` tall in his
 *  picture, for `secs`), it goes into his veldgids. */
const SEEDLING_H = 0.52;
const SEEDLING_SEE = { within: 6, px: 30, secs: 1 } as const;
/** How fast the nest fades when the lens comes by it (s), like a crown. */
const NEST_FADE_S = 0.25;

/**
 * Which of its trees the forest draws as the real tree (run 7, `homeTreeNear`): the
 * squirrel's pines stand close round the marker and along its ways, and turning round at
 * the ring or at a wait the lens looks through half a dozen of them over the wood toward
 * the tower, which already draws ~0.95M of the 1M triangles there (measured 2026-10-03:
 * each real pine is 12k, its simple copy 3k; see-through, the real one cost 12k wherever
 * it stood). So only the trees it plays round now keep the forest's full detail: the tree
 * it sits on, the one it just left and the next one of its way (that one before he gets
 * there: it never changes as he walks up to it), its den before a play, and the store pine
 * and the glade oak (the neighbours' perches) from its last pine on. Every other one is
 * the forest's simple copy (the darker, plainer pine of the wood further off), also while
 * the lens looks through it.
 */
const FOCUS = new Set<string>(['den']);
/** A home tree's full-detail range (world/Forest `near`): the forest's own for a tree the
 *  squirrel plays round now, none for the rest. */
export function homeTreeNear(id: string): number { return FOCUS.has(id) ? Infinity : 0; }

export class EekhoornHome implements HomeDressing {
  readonly group = new THREE.Group();
  private fieldNow: PatchField;
  private fieldKey = '';
  readonly trees = HOME_TREES.map(squirrelTree);
  /** the squirrel that lives here (set by the adventure's actor factory) */
  squirrel: Squirrel | null = null;
  /** the acorn store by the stump (it grows when the squirrel piles its acorns there) */
  private readonly heap: (THREE.Object3D | undefined)[] = [];
  private heapShown = 1;
  private readonly heapK: number[] = HEAP_SPOTS.map((_, i) => (i === 0 ? 1 : 0));
  private readonly puffs: THREE.InstancedMesh;
  private readonly puff: { x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number; s: number }[] = [];
  private readonly seedling: THREE.Mesh;
  /** one acorn on the moss: the one being buried (it sinks in) or dug up (it comes out) */
  private readonly nut: THREE.Mesh;
  private nutMove: { x: number; z: number; y0: number; y1: number; t: number; dur: number } | null = null;
  private readonly spawned: { dispose(): void }[] = [];
  private readonly birds: Bird[] = [];
  private readonly env: DressingEnv;
  private readonly small: THREE.Object3D;
  private state: HomeState = 'before';
  /** the adventure finished just now: the seedling waits for a later visit */
  seedlingWaits = false;
  private away = 0;
  private clock = 0;
  /** the small things' own stream (a nut's spin, the crumbs of a puff): a play's fork */
  private cos: () => number = stream(0x5eed41);
  /** the snag's top (once the snag is in): where the `top` bird sits */
  private snagTop: THREE.Vector3 | null = null;
  private trio: Trio = FIRST_TRIO;
  /** this play's way, its den first (`focus`); the den alone before any play */
  private way: string[] = ['den'];
  /** the tree of its way it sat on last */
  private wayAt = 0;
  /** run 7 (its finds): the squirrel's nest on a tree of this play's way (a play lays it;
   *  none before the first), how solid it stands now (it fades when the lens comes by) */
  private readonly nest: THREE.Mesh;
  private nestAt: NestSpot | null = null;
  private nestShow = 1;
  /** its dining stumps and logs by the ways, and this play's gnawed cones at one of them:
   *  one mesh */
  private readonly dining: THREE.Mesh;
  private kegelsAt: DiningSpot | null = null;
  /** the seedling: seen in free roam (its veldgids row), once a page */
  private readonly eikje = new SeenClock(SEEDLING_SEE.secs);
  /** set by the adventure's actor factory: the env its squirrel was made with (a visitor
   *  of a play is made the same way) */
  actorEnv: ActorEnv | null = null;
  /** this play's rare visitor (a dark-brown squirrel, a young one), while it is here */
  private guest: Squirrel | null = null;

  constructor(env: DressingEnv) {
    this.env = env;
    FOCUS.clear();
    FOCUS.add('den'); // (a new world: the squirrel at home in its den, no play yet)
    this.group.name = 'eekhoorn-home';
    env.parent.add(this.group);
    const g = env.groundY;

    /* -- the glade: seven look-alike mossy cushions in the oak leaves -- */
    // (the cushions, the acorn, the puffs and the seedling are small things: they rest
    // sooner than the home, Residents `detail`)
    this.small = env.detail(EEKHOORN_PLACES.glade);
    this.fieldNow = this.makeField(FIRST_FIELD.sym, FIRST_FIELD.seed);

    /* -- the stump with the store, the dead snag -- */
    void env.spawnPlant('prop-tree-stump', STUMP.h).then((s) => {
      if (!s) return;
      const r = s.root as THREE.Object3D;
      r.position.set(STUMP.x, g(STUMP.x, STUMP.z) - 0.03, STUMP.z);
      r.rotation.y = 1.1;
      this.group.add(r);
      this.spawned.push(s);
    });
    env.obstacles.push({ x: STUMP.x, z: STUMP.z, r: STUMP.r });
    // the store: a cluster of acorns by the stump's foot, more once he piles them there
    HEAP_SPOTS.forEach((at, i) => {
      void env.spawnPlant('prop-acorn-cluster', HEAP.h * (i ? 0.85 : 1)).then((sp) => {
        if (!sp) return;
        const r = sp.root as THREE.Object3D;
        r.position.set(at.x, g(at.x, at.z) - 0.01, at.z);
        r.rotation.y = headingTo(at, EEKHOORN_PLACES.stand) + 0.6 + i * 1.7;
        r.userData.base = r.scale.x;
        this.group.add(r);
        this.heap[i] = r;
        this.spawned.push(sp);
        this.showHeap(true);
      });
    });
    void env.spawnPlant('prop-dead-snag', SNAG.h).then((s) => {
      if (!s) return;
      const r = s.root as THREE.Object3D;
      r.position.set(SNAG.x, g(SNAG.x, SNAG.z) - 0.05, SNAG.z);
      r.rotation.y = SNAG.rotY;
      this.group.add(r);
      this.spawned.push(s);
      // a bird sits on its top
      const box = new THREE.Box3().setFromObject(r);
      this.snagTop = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y - 0.12, (box.min.z + box.max.z) / 2);
      this.setNeighbours(this.trio);
    });
    env.obstacles.push({ x: SNAG.x, z: SNAG.z, r: 0.35 });

    /* -- the jay on the glade oak's low stub, and the free world's neighbours -- */
    const jayAt = new THREE.Vector3(JAY_WAIT.x, g(JAY_WAIT.x, JAY_WAIT.z) + JAY_WAIT.y, JAY_WAIT.z);
    this.bird('gaai', 'gaai', SIZE.gaai.h, jayAt, headingTo(JAY_WAIT, HEAP));
    this.setNeighbours(FIRST_TRIO);

    /* -- little puffs of earth when the squirrel digs (one mesh) -- */
    this.puffs = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#4a3525', roughness: 1, flatShading: true }), 18);
    this.puffs.name = 'dig-puffs';
    this.puffs.frustumCulled = false;
    this.puffs.visible = false; // (drawn only while earth flies: an empty draw costs a call too)
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < 18; i++) this.puffs.setMatrixAt(i, zero);
    this.small.add(this.puffs);

    /* -- the acorn being buried or dug up (one at a time) -- */
    this.nut = new THREE.Mesh(acornGeometry(), acornMaterial());
    this.nut.name = 'acorn-in-the-moss';
    this.nut.visible = false;
    this.small.add(this.nut);

    /* -- the seedling a forgotten acorn grows into (after, on a later visit) -- */
    const sp = SEEDLING_AT;
    this.seedling = new THREE.Mesh(seedlingGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }));
    this.seedling.name = 'oak-seedling';
    this.seedling.position.set(sp.x, g(sp.x, sp.z) + 0.01, sp.z);
    this.seedling.scale.setScalar(SEEDLING_H / SEEDLING_GEO_H); // (a young oak a child spots from the glade's edge)
    this.seedling.visible = false;
    this.small.add(this.seedling);

    /* -- run 7: its nest (on a tree of a play's way) and its dining stumps and logs -- */
    this.nest = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
    this.nest.name = 'eekhoorn-nest';
    this.nest.visible = false;
    this.group.add(this.nest);
    this.dining = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
    this.dining.name = 'eekhoorn-eettafels';
    this.group.add(this.dining);
    this.layDining(null, 0);
    for (const d of DINING) {
      // (a stump and a log a child walks round, never through)
      env.obstacles.push(d.kind === 'stam'
        ? boxObstacle(d.x, d.z, STAM.len / 2, STAM.r, d.turn, 0.25)
        : { x: d.x, z: d.z, r: STRONK.r + 0.08, h: STRONK.h });
    }
  }

  /** The glade's caching spots now (this play's pattern). */
  get field(): PatchField { return this.fieldNow; }

  private makeField(sym: FieldSym, seed: number): PatchField {
    this.fieldKey = `${sym}:${seed}`;
    return new PatchField({ parent: this.small, groundY: this.env.groundY, spots: gladeSpots(sym), size: SPOT_SIZE, heading: GLADE_FRAME.heading, seed, look: 'moss' });
  }

  /**
   * Run 7: lay this play in the home, under the briefing card (design §6.1): the caching
   * pattern and its cushions' look, the three neighbours on their perches, the small
   * things' stream; the squirrel's own day (`reseed`).
   */
  layPlay(p: EekhoornPlay, streams: { cosmetic: () => number; squirrel: number }): void {
    if (this.fieldKey !== `${p.veld}:${p.veldSeed}`) {
      this.fieldNow.dispose();
      this.fieldNow = this.makeField(p.veld, p.veldSeed);
    }
    this.setNeighbours(p.buren);
    this.cos = streams.cosmetic;
    this.squirrel?.reseed(streams.squirrel);
    // run 7 (its finds): its nest on this play's tree, its gnawed cones at this play's
    // dining spot (both stay after the play: another visit, another of its nests)
    this.layNest(nestOf(ROUTES[p.route], p.nest), p.nestSeed);
    this.layDining(p.kegels, p.kegelSeed);
    this.dropVisitor();
    // (under the briefing card: the den and its first pine turn real before he sees them)
    this.way = ['den', ...ROUTES[p.route].hops.map((h) => h.tree.id)];
    this.wayAt = 0;
    this.focus();
  }

  /* --------------------------------------------- run 7: what he can find ---- */

  /** Its nest on `at` (a play's tree), its look from `seed`; null: none (before any play). */
  private layNest(at: NestSpot | null, seed: number): void {
    this.nestAt = at;
    this.nest.visible = !!at;
    if (!at) return;
    this.nest.geometry.dispose();
    this.nest.geometry = dreyGeometry(seed);
    this.nest.position.set(at.x, this.env.groundY(at.x, at.z) + at.y, at.z);
    this.nest.rotation.set(0, at.ang, 0);
    this.nest.updateMatrixWorld(true);
    // (it sits up its tree: how high its underside is held above the ground, for the world's
    // seating probe — a nest is not a thing floating off the ground)
    this.nest.geometry.computeBoundingBox();
    const box = this.nest.geometry.boundingBox!.clone().applyMatrix4(this.nest.matrixWorld);
    this.nest.userData.perch = box.min.y - this.env.groundY((box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2);
  }

  /** Where its nest is now (world; its middle), or null. */
  get nestNow(): (NestSpot & { world: THREE.Vector3 }) | null {
    return this.nestAt ? { ...this.nestAt, world: this.nest.position.clone() } : null;
  }

  /** The nest's box and a few points on it (what he sees of it) — only while it stands
   *  solid: faded near the lens (nestSolid) there is nothing to see (played 2026-10-04,
   *  seed 3: the lens trailing him past it had it faded out, 125 px "in view", and it
   *  peeked out of a nest that was not there). */
  nestSight(): { box: THREE.Box3; pts: THREE.Vector3[] } | null {
    if (!this.nestAt || !this.nest.visible || this.nestShow < 0.95) return null;
    const c = this.nest.position, r = NEST.r;
    const box = new THREE.Box3(c.clone().subScalar(r), c.clone().addScalar(r));
    const pts = [[0, 0, 0], [0, 0.6, 0], [0.6, 0.1, 0], [-0.6, 0.1, 0], [0, 0.1, 0.6], [0, 0.1, -0.6], [0, -0.5, 0]]
      .map(([x, y, z]) => new THREE.Vector3(c.x + x * r, c.y + y * r, c.z + z * r));
    return { box, pts };
  }

  /** Its dining stumps and logs (always), and this play's gnawed cones at `kegels`. */
  private layDining(kegels: DiningId | null, seed: number): void {
    const g = this.env.groundY;
    const parts: THREE.BufferGeometry[] = [];
    DINING.forEach((d, i) => parts.push(...(d.kind === 'stam' ? logGeometry(d, g, stream(0x10c + i * 977)) : stumpGeometry(d, g, stream(0x57b + i * 613)))));
    this.kegelsAt = kegels ? diningById(kegels) : null;
    if (this.kegelsAt) parts.push(...conesGeometry(this.kegelsAt, g, stream(seed >>> 0)));
    this.dining.geometry.dispose();
    this.dining.geometry = mergeFlat(parts);
    this.dining.geometry.computeBoundingSphere();
  }

  /** The gnawed cones' spot now: its box and a few points on it (what he sees of it). */
  kegelsSight(): { at: DiningSpot; box: THREE.Box3; pts: THREE.Vector3[] } | null {
    const d = this.kegelsAt;
    if (!d) return null;
    const g = this.env.groundY(d.x, d.z);
    const half = d.kind === 'stam' ? STAM.len / 2 : STRONK.r + 0.35; // (the scales round its foot)
    const top = d.kind === 'stam' ? STAM.r * 2 : STRONK.h;
    const box = new THREE.Box3(new THREE.Vector3(d.x - half, g, d.z - half), new THREE.Vector3(d.x + half, g + top, d.z + half));
    const along = { x: Math.cos(d.turn), z: -Math.sin(d.turn) }; // (three's rotation.y: its local +x)
    const pts = [[0, 1], [0.6, 0.5], [-0.6, 0.5], [0, 0.2]].map(([u, k]) => new THREE.Vector3(d.x + along.x * u * half, g + top * k, d.z + along.z * u * half));
    return { at: d, box, pts };
  }

  /** Run 7: this play's rare visitor — a second squirrel, made as the home's own (laid out
   *  of his sight by the script, then shown), here for this play only. */
  visitor(kind: 'donker' | 'jong', height: number, seed: number): Squirrel | null {
    this.dropVisitor();
    if (!this.actorEnv) return null;
    const sq = new Squirrel(`bezoeker-${kind}`, this.actorEnv, {
      height, trees: this.trees, seed,
      // (the dark one's coat is the world's dressing, Coat.ts; little of the low sun's warm
      // light in it, so it reads brown beside ours, never orange)
      animal: kind === 'donker' ? 'eekhoorn-donker' : 'eekhoorn', warmth: kind === 'donker' ? 0.04 : undefined,
    });
    sq.group.visible = false;
    this.guest = sq;
    return sq;
  }

  /** The visitor goes (out of his sight by then). */
  dropVisitor(): void {
    this.guest?.dispose();
    this.guest = null;
  }

  /** Which home trees are drawn real now (`homeTreeNear`): see FOCUS. */
  private focus(): void {
    const on = this.squirrel?.onTree;
    const k = on ? this.way.indexOf(HOME_TREES[this.trees.indexOf(on)]?.id ?? '') : -1;
    if (k >= 0) this.wayAt = k;
    FOCUS.clear();
    for (let j = Math.max(0, this.wayAt - 1); j <= Math.min(this.way.length - 1, this.wayAt + 1); j++) FOCUS.add(this.way[j]);
    if (this.state === 'after' || (this.way.length > 1 && this.wayAt >= this.way.length - 1)) {
      FOCUS.add('storePine');
      FOCUS.add('gladeOak');
    }
  }

  /** The three neighbours round the stump, slot by slot (tak, stam, top) — once loaded. */
  get neighbours(): Neighbour[] {
    return SLOTS.map((s) => this.birds.find((b) => b.n.slot === s && !b.gone)?.n).filter((n): n is Neighbour => !!n);
  }
  /** The jay, the nut thief. */
  get jay(): Neighbour | null { return this.birds.find((b) => b.kind === 'gaai')?.n ?? null; }

  /** Run 7: these three on their perches (design §6.5); the others leave. At most the
   *  three and the jay are alive at once. A play's trio stays after it. */
  setNeighbours(trio: Trio): void {
    this.trio = trio;
    const g = this.env.groundY;
    for (const slot of SLOTS) {
      const want = trio[slot];
      const have = this.birds.find((b) => b.n.slot === slot && !b.gone);
      if (have && have.kind === want) continue;
      if (have) this.dropBird(have);
      const row = NEIGHBOURS.find((n) => n.id === want);
      if (!row) continue;
      if (slot === 'top') {
        if (!this.snagTop) continue; // (the snag is still loading: it lays its bird)
        this.bird(want, slot, row.h, this.snagTop.clone(), headingTo(SNAG, EEKHOORN_PLACES.callers) + 0.9);
      } else if (slot === 'tak') {
        const p = PERCH.tak;
        this.bird(want, slot, row.h, new THREE.Vector3(p.x, g(p.x, p.z) + p.y, p.z), headingTo(p, EEKHOORN_PLACES.callers) - 0.9);
      } else {
        // it clings round the side of the trunk (belly to the bark), so from the stand it is
        // seen side-on against the wood behind: the woodpecker's red cap and green back, the
        // nuthatch walking down head-first
        const p = PERCH.stam;
        this.bird(want, slot, row.h, new THREE.Vector3(p.x, g(p.x, p.z) + p.y, p.z), WOODPECKER.ang + Math.PI);
      }
    }
  }

  private dropBird(b: Bird): void {
    b.gone = true;
    b.spawned?.dispose();
    b.o.removeFromParent();
    this.birds.splice(this.birds.indexOf(b), 1);
  }

  /** A bird on its perch (it looks round now and then; the call-back game picks and
   *  lights it). */
  private bird(id: string, slot: Neighbour['slot'], h: number, at: THREE.Vector3, yaw: number): void {
    const pose = BIRD_POSE[id] ?? {};
    const holder = new THREE.Group();
    holder.name = `neighbour-${id}`;
    holder.position.copy(at);
    holder.rotation.y = yaw + (pose.turn ?? 0);
    this.group.add(holder);
    const n: Neighbour = {
      id, slot, object: holder, body: null, at: at.clone(),
      call: () => { entry.hop = 0.001; },
    };
    const entry: Bird = { o: holder, base: at.clone(), baseYaw: holder.rotation.y, home: at.clone(), homeYaw: holder.rotation.y, kind: id, hop: 0, seed: this.birds.length * 2.1 + 0.4, fly: -1, glide: null, n, spawned: null, gone: false, rest: false, show: 1 };
    this.birds.push(entry);
    void this.env.spawnModel(id, { height: h, idle: false }).then((s) => {
      if (!s) return;
      if (entry.gone) { s.dispose(); return; }
      const r = s.root as THREE.Object3D;
      // (its colours and its light are the world's: dressAnimal, as every animal's)
      if (pose.clipBelow !== undefined) r.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        for (const mat of [m.material].flat() as THREE.MeshStandardMaterial[]) clipBelow(mat, pose.clipBelow!);
      });
      const feet = (pose.feet ?? 0) * h;
      if (pose.down) {
        // head-down on the bark: its feet to the trunk (the holder looks at it), its head
        // down — a quarter turn about its side axis, then a half turn about the way to the
        // trunk; its feet (what is left once the branch is cut) on the bark
        const pivot = new THREE.Group();
        pivot.rotation.set(-Math.PI / 2, 0, Math.PI, 'ZYX');
        // (its belly against the bark, measured on the GLB by looking at it on a trunk)
        pivot.position.set(0, h * 0.35, feet + 0.08);
        pivot.add(r);
        holder.add(pivot);
      } else {
        holder.add(r);
        r.position.y -= pose.sink ?? feet;
      }
      n.body = r;
      entry.spawned = s;
      this.perchOf(entry);
    });
  }

  /** How high above the ground its perch holds a bird (a stub, the snag's top, the bark,
   *  a twig in the litter): the play-hint probe checks it sits on that. */
  private perchOf(b: Bird): void {
    const r = b.n.body;
    if (!r) return;
    r.updateWorldMatrix(true, true);
    r.userData.perch = new THREE.Box3().setFromObject(r).min.y - this.env.groundY(b.base.x, b.base.z);
  }

  /** The jay comes for the acorns: off the glade oak's stub, a long low glide in from the
   *  side to a twig in the leaf litter right by the store (`secs` long; at once under
   *  reduced motion). */
  jayDown(secs = 1.6): void {
    const b = this.birds.find((q) => q.kind === 'gaai');
    if (!b || b.fly >= 0) return;
    const g = this.env.groundY(JAY_GROUND.x, JAY_GROUND.z);
    const to = new THREE.Vector3(JAY_GROUND.x, g - 0.01, JAY_GROUND.z);
    // it lands side-on to the ranger, its beak toward the acorns
    const yaw1 = headingTo(JAY_GROUND, HEAP) - Math.PI / 2 + 0.35;
    b.glide = { from: b.o.position.clone(), to, yaw0: b.o.rotation.y, yaw1, t: 0, dur: secs, arc: 0.25 };
  }

  /** The jay backs off a step (after an echo he got right): a short hop back over the
   *  leaf litter to `to`, still side-on, its eye on the acorns. */
  jayBack(to: Spot, secs = 0.7): void {
    const b = this.birds.find((q) => q.kind === 'gaai');
    if (!b || b.fly >= 0) return;
    const g = this.env.groundY(to.x, to.z);
    const at = new THREE.Vector3(to.x, g - 0.01, to.z);
    const yaw1 = headingTo(to, HEAP) - Math.PI / 2 + 0.35;
    b.glide = { from: b.o.position.clone(), to: at, yaw0: b.o.rotation.y, yaw1, t: 0, dur: secs, arc: 0.08 };
  }

  /** Where the jay is now (its call comes from there). */
  jayAt(): Spot { const b = this.birds.find((q) => q.kind === 'gaai'); return b ? { x: b.o.position.x, z: b.o.position.z } : JAY_GROUND; }

  /** An acorn laid at (x, z) sinks into the moss over `secs` (the squirrel buries it). */
  buryAcorn(x: number, z: number, secs: number): void { this.moveNut(x, z, 0.075, 0.01, secs); }
  /** An acorn comes up out of the moss at (x, z) over `secs` (the squirrel digs it up). */
  unearthAcorn(x: number, z: number, secs: number): void { this.moveNut(x, z, 0.01, 0.085, secs); }

  private moveNut(x: number, z: number, y0: number, y1: number, secs: number): void {
    this.nutMove = { x, z, y0, y1, t: 0, dur: Math.max(0.1, secs) };
    this.nut.rotation.set(0.25, this.cos() * Math.PI * 2, 0);
    this.nut.visible = true;
  }

  /** A puff of earth at (x, z): a few crumbs thrown up and out, falling back. */
  puffAt(x: number, z: number, reduced: boolean): void {
    if (reduced) return;
    const y = this.env.groundY(x, z) + 0.03;
    const r = this.cos;
    for (let k = 0; k < 4; k++) {
      const a = r() * Math.PI * 2;
      const slot = this.puff.length < 18 ? this.puff.length : this.puff.findIndex((p) => p.t <= 0);
      const p = { x, y, z, vx: Math.cos(a) * (0.25 + r() * 0.35), vy: 0.7 + r() * 0.5, vz: Math.sin(a) * (0.25 + r() * 0.35), t: 0.55, s: 0.008 + r() * 0.01 };
      if (slot < 0) return;
      this.puff[slot] = p;
    }
  }

  /** The store grows: the acorns he dug up are piled by the stump (`n` more clusters). */
  growHeap(n: number): void { this.heapShown = Math.min(HEAP_SPOTS.length, this.heapShown + n); }

  /** Show the store as it is (at once: a reload, a replay under the card). */
  private showHeap(now: boolean): void {
    HEAP_SPOTS.forEach((_, i) => {
      const want = i < this.heapShown ? 1 : 0;
      if (now) this.heapK[i] = want;
      const r = this.heap[i];
      if (r) { r.visible = this.heapK[i] > 0.01; r.scale.setScalar((r.userData.base as number) * Math.max(0.01, this.heapK[i])); }
    });
  }

  /** The jay flies off (after the call-back game): up and away over the trees. */
  jayFlies(): void {
    const b = this.birds.find((q) => q.kind === 'gaai');
    if (b && b.fly < 0) { b.glide = null; b.base.copy(b.o.position); b.fly = 0; }
  }

  setState(state: HomeState, fresh = false): void {
    this.state = state;
    this.dropVisitor(); // (a play's visitor goes with the play: a stop, a finish)
    // after: the bigger store, the jay gone; before: the small store, the jay on its stub.
    // In front of him (a stop, a finish) nothing pops: the jay flies back up to its stub,
    // the store keeps what the squirrel piled (it grows to full once it is done); a
    // replay (under the briefing card) and a reload set it at once.
    if (!fresh || state === 'after') this.heapShown = state === 'after' ? HEAP_SPOTS.length : 1;
    if (!fresh) this.showHeap(true);
    for (const b of this.birds) {
      if (b.kind !== 'gaai') continue;
      if (fresh && state === 'before') {
        // back to its stub, if it left it: up from the ground by the store, or back in
        // from its flight away (mid-flight, or from over the trees once it had gone)
        if (b.fly >= 0) {
          if (b.fly >= 99) b.o.position.copy(this.flightAt(b, 1));
          b.fly = -1;
          b.o.visible = true;
        }
        if (b.base.distanceTo(b.home) > 0.05 || b.glide || b.o.position.distanceTo(b.home) > 0.05) {
          const from = b.o.position.clone();
          const dur = Math.max(1.2, from.distanceTo(b.home) / 5); // (a jay glides ~5 m/s)
          b.glide = { from, to: b.home.clone(), yaw0: b.o.rotation.y, yaw1: b.homeYaw, t: 0, dur, arc: 0.25 };
        }
        continue;
      }
      if (fresh && state === 'after') { if (b.fly < 0) this.jayFlies(); continue; } // (it flies off, if it has not yet)
      b.fly = state === 'after' ? 99 : -1;
      b.glide = null;
      b.o.visible = state !== 'after';
      b.base.copy(b.home);
      b.baseYaw = b.homeYaw;
      b.n.at.copy(b.home);
      b.o.position.copy(b.base);
      b.o.rotation.set(0, b.baseYaw, 0);
      this.perchOf(b);
    }
    this.seedling.visible = state === 'after' && !this.seedlingWaits;
    this.nutMove = null;
    this.nut.visible = false;
    this.fieldNow.clear();
  }

  update(dt: number, t: number, reduced: boolean, movers: readonly { x: number; z: number; moving: boolean; ranger?: boolean }[]): void {
    this.clock += dt;
    this.focus();
    if (this.guest) this.guest.update(dt, t);
    const cam = this.env.view?.() ?? null;
    const me = movers.find((q) => q.ranger);
    // the nest never fills the lens nor stands between it and him: it fades, like a crown
    if (this.nestAt && cam && me) {
      const want = nestSolid(cam.position, this.nest.position, { x: me.x, y: this.env.groundY(me.x, me.z), z: me.z });
      if (want !== this.nestShow) {
        this.nestShow = reduced ? want : Math.max(0, Math.min(1, this.nestShow + Math.sign(want - this.nestShow) * (dt / NEST_FADE_S)));
        fadeBird(this.nest, this.nestShow);
        this.nest.visible = this.nestShow > 0.01;
      }
    }
    // the oak seedling, on a later visit: once he has seen it, it is in his veldgids
    if (this.seedling.visible && !this.eikje.seen && this.state === 'after' && cam && me && this.env.discover) {
      const sp = this.seedling.position;
      let ok = false;
      if (Math.hypot(me.x - sp.x, me.z - sp.z) <= SEEDLING_SEE.within) {
        const box = new THREE.Box3(new THREE.Vector3(sp.x - 0.12, sp.y, sp.z - 0.12), new THREE.Vector3(sp.x + 0.12, sp.y + SEEDLING_H, sp.z + 0.12));
        const pts = [0.3, 0.6, 0.9].map((k) => new THREE.Vector3(sp.x, sp.y + SEEDLING_H * k, sp.z));
        const pic = pictureOf(cam, viewH(), viewW(), box, pts, this.trunks(cam.position, me));
        ok = pic.inside && pic.px >= SEEDLING_SEE.px && pic.clear >= 0.5;
      }
      if (this.eikje.step(dt, ok)) this.env.discover('eekhoorn.eikje');
    }
    this.fieldNow.update(dt, reduced);
    // the store grows: each new cluster pops up in turn (a cut under reduced motion)
    let grew = false;
    for (let i = 0; i < HEAP_SPOTS.length; i++) {
      const want = i < this.heapShown ? 1 : 0;
      if (Math.abs(this.heapK[i] - want) < 1e-3) continue;
      if (i > 0 && want > 0 && this.heapK[i - 1] < 0.6) break; // one after another
      this.heapK[i] = reduced ? want : Math.max(0, Math.min(1, this.heapK[i] + Math.sign(want - this.heapK[i]) * dt * 3.2));
      grew = true;
    }
    if (grew) this.showHeap(false);
    // the birds: a small look round now and then, a hop and a flick when they call; far
    // from him they rest (a speck there)
    const ranger = movers.find((q) => q.ranger);
    for (const b of this.birds) {
      if (b.fly >= 0 && b.fly < 99) { this.flyAway(b, dt, reduced); continue; }
      if (b.fly >= 99) continue; // (flown off)
      if (ranger) {
        const d = Math.hypot(ranger.x - b.o.position.x, ranger.z - b.o.position.z);
        b.rest = d > (b.rest ? BIRD_WAKE_M : BIRD_REST_M);
      }
      const want = b.rest ? 0 : 1;
      if (b.show !== want) {
        b.show = reduced ? want : Math.max(0, Math.min(1, b.show + Math.sign(want - b.show) * (dt / BIRD_FADE_S)));
        fadeBird(b.n.body, b.show);
      }
      b.o.visible = b.show > 0;
      if (!b.o.visible) continue;
      if (b.glide) { this.glideOn(b, dt, reduced); continue; }
      const look = reduced ? 0 : 0.35 * Math.sin(t * 0.45 + b.seed) * (Math.sin(t * 0.23 + b.seed * 3) > 0.2 ? 1 : 0.2);
      let lift = 0, tilt = 0;
      if (b.hop > 0) {
        b.hop += dt;
        const u = b.hop / 0.42;
        if (u >= 1) b.hop = 0;
        else if (!reduced) { lift = Math.sin(u * Math.PI) * 0.045; tilt = Math.sin(u * Math.PI) * 0.28; }
      }
      b.o.position.set(b.base.x, b.base.y + lift, b.base.z);
      b.o.rotation.set(-tilt, b.baseYaw + (b.n.slot === 'stam' ? look * 0.25 : look), 0, 'YXZ');
    }
    // the acorn being buried or dug up
    if (this.nutMove) {
      const n = this.nutMove;
      n.t += dt;
      const u = reduced ? 1 : Math.min(1, n.t / n.dur);
      this.nut.position.set(n.x, this.env.groundY(n.x, n.z) + n.y0 + (n.y1 - n.y0) * u, n.z);
      if (u >= 1) { this.nutMove = null; this.nut.visible = false; }
    }
    // the puffs of earth
    if (this.puff.length) {
      const m = new THREE.Matrix4();
      let live = false;
      for (let i = 0; i < this.puff.length; i++) {
        const p = this.puff[i];
        if (p.t <= 0) { this.puffs.setMatrixAt(i, m.makeScale(0, 0, 0)); continue; }
        live = true;
        p.t -= dt;
        p.vy -= 3.2 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        const floor = this.env.groundY(p.x, p.z) + 0.01;
        if (p.y < floor) { p.y = floor; p.vx *= 0.3; p.vz *= 0.3; p.vy = 0; }
        const s = p.s * Math.min(1, p.t * 4);
        this.puffs.setMatrixAt(i, m.compose(new THREE.Vector3(p.x, p.y, p.z), new THREE.Quaternion(), new THREE.Vector3(s, s, s)));
      }
      this.puffs.instanceMatrix.needsUpdate = true;
      this.puffs.visible = live;
    }
    // the seedling grows while the ranger is away (a later visit finds it)
    if (this.state === 'after' && this.seedlingWaits) {
      const me = movers.find((q) => q.ranger);
      const far = me ? Math.hypot(me.x - EEKHOORN_PLACES.glade.x, me.z - EEKHOORN_PLACES.glade.z) > AWAY_M : false;
      this.away = far ? this.away + dt : 0;
      if (this.away > 2) { this.seedlingWaits = false; this.seedling.visible = true; }
    }
  }

  /** A glide to another perch: off the stub, a low swoop (or a short hop over the
   *  litter), a flutter to land. */
  private glideOn(b: Bird, dt: number, reduced: boolean): void {
    const gl = b.glide!;
    gl.t += dt;
    const u = reduced ? 1 : Math.min(1, gl.t / gl.dur);
    const e = u * u * (3 - 2 * u);
    const sag = Math.sin(u * Math.PI) * gl.arc; // a swoop: a little lower than the straight line, then up to land
    b.o.position.set(gl.from.x + (gl.to.x - gl.from.x) * e, gl.from.y + (gl.to.y - gl.from.y) * e - sag * (1 - u) + Math.sin(u * Math.PI) * gl.arc * 0.5, gl.from.z + (gl.to.z - gl.from.z) * e);
    const toward = Math.atan2(gl.to.x - gl.from.x, gl.to.z - gl.from.z);
    // it flies facing the way it goes, and turns to its landing pose as it lands
    const yaw = u < 0.75 ? gl.yaw0 + wrapA(toward - gl.yaw0) * Math.min(1, u * 5) : toward + wrapA(gl.yaw1 - toward) * ((u - 0.75) / 0.25);
    b.o.rotation.set(u < 0.85 ? 0.3 : 0.3 * (1 - (u - 0.85) / 0.15), yaw, reduced ? 0 : 0.18 * Math.sin(gl.t * 26) * (1 - u), 'YXZ');
    if (u >= 1) {
      b.glide = null;
      b.base.copy(gl.to);
      b.baseYaw = gl.yaw1;
      b.n.at.copy(gl.to);
      b.hop = 0.001; // (a little hop as it lands)
      this.perchOf(b);
    }
  }

  /** The jay's flight: a hop off its perch, then a rising curve away over the trees. */
  private flyAway(b: Bird, dt: number, reduced: boolean): void {
    b.fly += dt;
    const T = 2.6;
    if (reduced || b.fly >= T) { b.o.visible = false; b.fly = 99; return; }
    b.o.position.copy(this.flightAt(b, b.fly / T));
    b.o.rotation.set(-0.35, this.flightHeading(b), 0.12 * Math.sin(b.fly * 9), 'YXZ');
  }

  /** Which way the jay flies off: away from the stand, over the canopy (never toward the lens). */
  private flightHeading(b: Bird): number {
    return headingTo(EEKHOORN_PLACES.callers, { x: b.base.x, z: b.base.z }) - 0.5;
  }

  /** Where the jay is `u` (0..1) of the way through its flight away: a hop off its
   *  perch, then a rising curve up and away over the trees. */
  private flightAt(b: Bird, u: number): THREE.Vector3 {
    const away = this.flightHeading(b);
    const d = 14 * u * u + 1.2 * u;
    return new THREE.Vector3(b.base.x + Math.sin(away) * d, b.base.y + 0.25 * Math.sin(Math.min(1, u * 5) * Math.PI / 2) + 7 * u * u, b.base.z + Math.cos(away) * d);
  }

  /** The home's trunks that can hide something from the lens at `eye` (the ones between
   *  the lens and him are faded by the follow camera: those hide nothing). */
  trunks(eye: { x: number; y: number; z: number }, me: { x: number; z: number }): Upright[] {
    const g = this.env.groundY;
    const head = { x: me.x, y: g(me.x, me.z) + 1.25, z: me.z };
    return this.trees.filter((t) => lineClear(eye, head, [trunkUpright(t.trunk, g(t.trunk.x, t.trunk.z))])).map((t) => trunkUpright(t.trunk, g(t.trunk.x, t.trunk.z)));
  }

  dispose(): void {
    this.dropVisitor();
    this.nest.geometry.dispose();
    (this.nest.material as THREE.Material).dispose();
    this.dining.geometry.dispose();
    (this.dining.material as THREE.Material).dispose();
    this.fieldNow.dispose();
    for (const s of this.spawned) s.dispose();
    for (const b of [...this.birds]) this.dropBird(b);
    this.puffs.dispose();
    this.puffs.geometry.dispose();
    (this.puffs.material as THREE.Material).dispose();
    this.seedling.geometry.dispose();
    (this.seedling.material as THREE.Material).dispose();
    this.nut.geometry.dispose();
    (this.nut.material as THREE.Material).dispose();
    for (const o of [this.puffs, this.nut, this.seedling]) o.removeFromParent();
    this.group.removeFromParent();
  }
}

/** Wrap an angle to (−π, π]. */
function wrapA(a: number): number { return Math.atan2(Math.sin(a), Math.cos(a)); }

/** A bird part-way in (0..1): see-through while it fades, solid again once it is there. */
function fadeBird(body: THREE.Object3D | null, k: number): void {
  body?.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (const mat of [m.material].flat() as THREE.Material[]) {
      const fading = k < 0.999;
      if (mat.transparent !== fading) { mat.transparent = fading; mat.depthWrite = !fading; mat.needsUpdate = true; }
      mat.opacity = k;
    }
  });
}

/** Don't draw what of a model lies below `y` in its own (model) space. */
function clipBelow(mat: THREE.MeshStandardMaterial, y: number): void {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    shader.uniforms.uClipY = { value: y };
    shader.vertexShader = 'varying float vModelY;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvModelY = position.y;');
    shader.fragmentShader = 'varying float vModelY;\nuniform float uClipY;\n' + shader.fragmentShader.replace('void main() {', 'void main() {\n  if (vModelY < uClipY) discard;');
  };
  const key = mat.customProgramCacheKey?.bind(mat);
  mat.customProgramCacheKey = () => `${key ? key() : ''}|clip-below-${y}`;
  mat.needsUpdate = true;
}

/* ------------------------------------------- run 7: what he can find, drawn ---- */

/** The picture's size (px) a lens draws into (the game's canvas fills the window). */
const viewH = (): number => (typeof window !== 'undefined' ? window.innerHeight : 800) || 800;
const viewW = (): number => (typeof window !== 'undefined' ? window.innerWidth : 1280) || 1280;

/** What a camera sees of a thing (run 7, its finds; design §4.4): how tall and how wide it
 *  stands in the picture (px), whether it is in the picture (its middle in front of the
 *  lens, inside the picture's width and under the line card at the top), and the share of
 *  its points no trunk of the home hides (`trunks`). */
export interface Picture { px: number; across: number; inside: boolean; clear: number;
  /** its middle across the picture (−1 the left edge … 1 the right), and down it (px) */ cx: number; cy: number }
const CORNER = new THREE.Vector3();
export function pictureOf(cam: THREE.Camera, h: number, w: number, box: THREE.Box3, pts: readonly THREE.Vector3[], trunks: readonly Upright[]): Picture {
  cam.updateMatrixWorld();
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, behind = false;
  for (let i = 0; i < 8; i++) {
    CORNER.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
    if (CORNER.clone().applyMatrix4(cam.matrixWorldInverse).z > -0.2) { behind = true; break; }
    CORNER.project(cam);
    minX = Math.min(minX, CORNER.x); maxX = Math.max(maxX, CORNER.x); minY = Math.min(minY, CORNER.y); maxY = Math.max(maxY, CORNER.y);
  }
  if (behind) return { px: 0, across: 0, inside: false, clear: 0, cx: 9, cy: -1 };
  const cx = (minX + maxX) / 2, cy = (1 - (minY + maxY) / 2) * 0.5 * h;
  const inside = Math.abs(cx) <= 0.92 && cy >= 96 && cy <= h - 8;
  const clear = pts.length ? pts.filter((p) => lineClear(cam.position, p, trunks)).length / pts.length : 0;
  return { px: (maxY - minY) * 0.5 * h, across: (maxX - minX) * 0.5 * w, inside, clear, cx, cy };
}

/** A colour with a little of the stream's own variety (every twig, every flake its own). */
function jitter(hex: string, rnd: () => number, k = 0.12): THREE.Color {
  const c = new THREE.Color(hex);
  const f = 1 + (rnd() - 0.5) * 2 * k;
  return c.multiplyScalar(f);
}
/** Paint every triangle of a non-indexed geometry its own shade of `hex`. */
function paintFaces(geo: THREE.BufferGeometry, hex: string | ((i: number) => string), rnd: () => number, k = 0.12): THREE.BufferGeometry {
  const n = geo.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let t = 0; t < n / 3; t++) {
    const col = jitter(typeof hex === 'string' ? hex : hex(t), rnd, k);
    for (let v = 0; v < 3; v++) { const i = (t * 3 + v) * 3; c[i] = col.r; c[i + 1] = col.g; c[i + 2] = col.b; }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}
/** A geometry made non-indexed, normals of its own faces. */
function flat(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

/**
 * The squirrel's nest (a drey, design §6.7): a rough ball of twigs and dry leaves ≈ 0.45 m
 * across, a little flattened, one side against the bark (it sits in the trunk there), with
 * twigs sticking out of it and a few dry oak leaves woven in — one mesh, ≤ 800 triangles,
 * its look from `seed` (every nest its own). Local space: its middle at 0, the bark at −z.
 */
function dreyGeometry(seed: number): THREE.BufferGeometry {
  const rnd = stream(0xd7e1 + (seed >>> 0));
  const r = NEST.r;
  const parts: THREE.BufferGeometry[] = [];
  // the ball: lumpy, squashed a little, the side against the trunk pressed flat
  const ball = flat(new THREE.IcosahedronGeometry(1, 2));
  const pos = ball.attributes.position as THREE.BufferAttribute;
  const bump = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    let b = bump.get(key);
    if (b === undefined) { b = 0.86 + rnd() * 0.24; bump.set(key, b); }
    pos.setXYZ(i, x * r * b, y * r * b * 0.86, Math.max(z, -0.55) * r * b);
  }
  ball.computeVertexNormals();
  paintFaces(ball, (t) => (t % 5 === 0 ? '#8c6b42' : t % 3 === 0 ? '#6a4f34' : '#54402c'), rnd, 0.16);
  parts.push(ball);
  // twigs sticking out (thin three-sided sticks)
  for (let i = 0; i < 16; i++) {
    const len = 0.1 + rnd() * 0.16, rad = 0.007 + rnd() * 0.005;
    const twig = flat(new THREE.CylinderGeometry(rad * 0.6, rad, len, 3, 1, true));
    const a = rnd() * Math.PI * 2, e = (rnd() - 0.35) * 1.2;
    const dir = new THREE.Vector3(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a));
    if (dir.z < -0.3) dir.z = -dir.z; // (not into the bark)
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    twig.translate(0, len / 2, 0).applyQuaternion(q).translate(dir.x * r * 0.7, dir.y * r * 0.6, dir.z * r * 0.7);
    paintFaces(twig, '#4a3828', rnd, 0.15);
    parts.push(twig);
  }
  // dry leaves woven in (small flat pieces on its skin)
  for (let i = 0; i < 26; i++) {
    const leaf = flat(new THREE.PlaneGeometry(0.06 + rnd() * 0.04, 0.035 + rnd() * 0.02));
    const a = rnd() * Math.PI * 2, e = (rnd() - 0.3) * 1.3;
    const dir = new THREE.Vector3(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a));
    if (dir.z < -0.2) dir.z = -dir.z;
    dir.normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    leaf.rotateZ(rnd() * Math.PI).applyQuaternion(q).translate(dir.x * r * 0.97, dir.y * r * 0.84, dir.z * r * 0.97);
    paintFaces(leaf, rnd() < 0.5 ? '#9c7748' : '#a8844f', rnd, 0.12);
    parts.push(leaf);
  }
  return mergeFlat(parts);
}

/** A low cut stump at a dining spot (its cut top lighter, a ring in it, roots reaching
 *  into the needles), in world space. */
function stumpGeometry(d: DiningSpot, g: (x: number, z: number) => number, rnd: () => number): THREE.BufferGeometry[] {
  const y0 = g(d.x, d.z) - 0.04;
  const h = STRONK.h + (rnd() - 0.5) * 0.06, r = STRONK.r;
  const out: THREE.BufferGeometry[] = [];
  const at = (geo: THREE.BufferGeometry): THREE.BufferGeometry => geo.rotateY(d.turn).translate(d.x, y0, d.z);
  out.push(at(paintFaces(flat(new THREE.CylinderGeometry(r * 0.9, r, h, 9, 1, true).translate(0, h / 2, 0)), '#5b4636', rnd, 0.14)));
  // the cut: pale wood, a darker heart, the top a little tilted
  const tilt = (rnd() - 0.5) * 0.08;
  out.push(at(paintFaces(flat(new THREE.CircleGeometry(r * 0.9, 9).rotateX(-Math.PI / 2).rotateZ(tilt).translate(0, h + 0.002, 0)), '#a98457', rnd, 0.06)));
  out.push(at(paintFaces(flat(new THREE.CircleGeometry(r * 0.42, 7).rotateX(-Math.PI / 2).rotateZ(tilt).translate(0, h + 0.006, 0)), '#8a6845', rnd, 0.05)));
  // roots
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rnd() * 0.6;
    const root = flat(new THREE.ConeGeometry(0.07, 0.34, 4, 1, true)).rotateZ(-Math.PI / 2 + 0.35).translate(r * 0.95 + 0.12, 0.05, 0).rotateY(a);
    out.push(at(paintFaces(root, '#4f3c2e', rnd, 0.12)));
  }
  return out;
}

/** The end of a fallen trunk at a dining spot (its sawn ends pale, moss on its back), in
 *  world space: it lies along `turn`. */
function logGeometry(d: DiningSpot, g: (x: number, z: number) => number, rnd: () => number): THREE.BufferGeometry[] {
  const r = STAM.r, len = STAM.len;
  const y = g(d.x, d.z) + r * 0.82;
  const out: THREE.BufferGeometry[] = [];
  const at = (geo: THREE.BufferGeometry): THREE.BufferGeometry => geo.rotateY(d.turn).translate(d.x, y, d.z);
  const side = flat(new THREE.CylinderGeometry(r, r * 1.06, len, 9, 2, true)).rotateZ(Math.PI / 2);
  paintFaces(side, (t) => (t % 7 === 0 ? '#5d6b3a' : '#56432f'), rnd, 0.14);
  out.push(at(side));
  for (const s of [-1, 1]) {
    out.push(at(paintFaces(flat(new THREE.CircleGeometry(r * (s > 0 ? 1.06 : 1), 9).rotateY(s * Math.PI / 2).translate(s * len / 2, 0, 0)), '#a07d52', rnd, 0.06)));
  }
  return out;
}

/**
 * The gnawed cones at a dining spot (design §6.7): what is left when a squirrel strips a
 * pine cone for its seeds — bare cores with a little tuft at the tip, and a litter of
 * stripped scales round where it sat (on the stump's top and round its foot; along the
 * log's back and round its end). 6-10 cores, the scales a reddish-brown speckle on the
 * needles a child can spot from a few metres. World space; its look from `rnd`.
 */
function conesGeometry(d: DiningSpot, g: (x: number, z: number) => number, rnd: () => number): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const along = { x: Math.cos(d.turn), z: -Math.sin(d.turn) }; // (three's rotation.y: its local +x)
  // where it sat: the stump's top, or the log's back near its end
  const seat = d.kind === 'stam' ? { x: d.x + along.x * STAM.len * 0.32, z: d.z + along.z * STAM.len * 0.32 } : { x: d.x, z: d.z };
  const seatY = d.kind === 'stam' ? g(d.x, d.z) + STAM.r * 1.8 : g(d.x, d.z) - 0.04 + STRONK.h + 0.01;
  const bodyR = d.kind === 'stam' ? STAM.r : STRONK.r;
  // (a core a child reads from a few metres off: a little stouter than life, its tuft of
  // scales at the top; `half`: a cone it left half eaten — the scales still on its lower
  // half, the bare core above: plainly a pine cone somebody ate)
  const core = (x: number, y: number, z: number, yaw: number, lying: boolean, half = false): void => {
    const len = 0.08 + rnd() * 0.03;
    const parts = [
      paintFaces(flat(new THREE.ConeGeometry(0.021, len * 0.55, 5, 1, true).translate(0, len * 0.275, 0)), '#b47c45', rnd, 0.1),
      paintFaces(flat(new THREE.ConeGeometry(0.021, len * 0.45, 5, 1, true).rotateX(Math.PI).translate(0, -len * 0.225, 0)), '#a8723e', rnd, 0.1),
      paintFaces(flat(new THREE.ConeGeometry(0.032, 0.035, 5, 1, true).translate(0, len * 0.55, 0)), '#6b472a', rnd, 0.1),
    ];
    if (half) parts.push(paintFaces(flat(new THREE.SphereGeometry(0.034, 7, 5).scale(1, 1.35, 1).translate(0, -len * 0.28, 0)), '#73462a', rnd, 0.14));
    const r = half ? 0.034 : 0.021;
    for (const p of parts) {
      if (lying) p.rotateZ(Math.PI / 2 - 0.15);
      p.rotateY(yaw).translate(x, y + (lying ? r : len * 0.45 + (half ? 0.02 : 0)), z);
      out.push(p);
    }
  };
  const n = 6 + Math.floor(rnd() * 5);
  for (let i = 0; i < n; i++) {
    if (i < 2) {
      // one or two on its seat
      core(seat.x + (rnd() - 0.5) * bodyR * 0.8, seatY, seat.z + (rnd() - 0.5) * bodyR * 0.8, rnd() * Math.PI * 2, rnd() < 0.7, i === 0);
    } else {
      const a = rnd() * Math.PI * 2, rr = bodyR + 0.08 + rnd() * 0.45;
      const x = seat.x + Math.sin(a) * rr, z = seat.z + Math.cos(a) * rr;
      core(x, g(x, z), z, rnd() * Math.PI * 2, true);
    }
  }
  // the stripped scales: a litter round its seat (most near it), a few on the seat
  for (let i = 0; i < 90; i++) {
    const on = i < 10;
    const a = rnd() * Math.PI * 2, rr = on ? rnd() * bodyR * 0.8 : bodyR + 0.03 + Math.pow(rnd(), 1.6) * 0.6;
    const x = seat.x + Math.sin(a) * rr, z = seat.z + Math.cos(a) * rr;
    const y = on ? seatY + 0.003 : g(x, z) + 0.006;
    const sz = 0.03 + rnd() * 0.025;
    const flake = flat(new THREE.CircleGeometry(sz, 3).scale(1, 0.62, 1).rotateX(-Math.PI / 2 + (rnd() - 0.5) * 0.5).rotateY(rnd() * Math.PI * 2).translate(x, y, z));
    out.push(paintFaces(flake, rnd() < 0.5 ? '#8f5a33' : rnd() < 0.5 ? '#a4683a' : '#7a4a2c', rnd, 0.1));
  }
  return out;
}

/** The oak seedling's own height (m) before it is scaled to SEEDLING_H. */
const SEEDLING_GEO_H = 0.2;

/** A young oak seedling: a thin stem and lobed leaves (green), SEEDLING_GEO_H tall. */
function seedlingGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const stem = new THREE.CylinderGeometry(0.004, 0.006, 0.18, 5, 1).translate(0, 0.09, 0);
  paint(stem, '#6b5a3a');
  parts.push(stem.toNonIndexed());
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI;
    const lobe = 1 + 0.2 * Math.cos(i * Math.PI * 0.9);
    leafShape.lineTo(Math.sin(a) * 0.025 * lobe, (1 - Math.cos(a)) * 0.035);
  }
  for (let i = 10; i >= 0; i--) {
    const a = (i / 10) * Math.PI;
    const lobe = 1 + 0.2 * Math.cos(i * Math.PI * 0.9);
    leafShape.lineTo(-Math.sin(a) * 0.025 * lobe, (1 - Math.cos(a)) * 0.035);
  }
  [[0.07, 3.4, 1.0], [0.1, 0.4, 0.9], [0.12, 5.4, 0.85], [0.13, 2.4, 0.8], [0.15, 1.6, 0.75], [0.16, 4.3, 0.9], [0.18, 1.2, 0.5], [0.19, 3.8, 0.4]].forEach(([y, a, tilt]) => {
    const leaf = new THREE.ShapeGeometry(leafShape).rotateX(-tilt).rotateY(a).translate(0, y, 0);
    paint(leaf, '#6f9a3a');
    parts.push(leaf.toNonIndexed());
    leaf.dispose();
  });
  stem.dispose();
  return mergeFlat(parts);
}

function paint(geo: THREE.BufferGeometry, hex: string): void {
  const col = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
}

/** Merge non-indexed geometries with position, normal and colour into one. */
function mergeFlat(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [], col: number[] = [];
  for (const p of parts) {
    if (!p.attributes.normal) p.computeVertexNormals();
    pos.push(...(p.attributes.position.array as Float32Array));
    nor.push(...(p.attributes.normal.array as Float32Array));
    col.push(...(p.attributes.color.array as Float32Array));
    p.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
