/**
 * eekhoorn.home.ts — the squirrel's home in the world, built with the world (the THREE
 * half of eekhoorn.places.ts): the dead branch stubs it sits on (on its oak, on the
 * pines of its way), its GLADE — seven look-alike mossy cushions in the oak leaves where
 * it buries acorns, a stump with its store of acorns, a dead snag — and its neighbours:
 * the jay on a stub of its pine, the green woodpecker clinging to the next pine, the
 * raven on top of the snag. The trees themselves are forest trees (the world draws them).
 *
 * It stands before the mission and after it. After, the store is a bigger heap, the jay
 * has flown, and on a later visit a tiny oak seedling stands at one forgotten spot.
 */

import * as THREE from 'three';
import type { DressingEnv, HomeDressing } from '../../world/Residents';
import type { HomeState } from '../types';
import { PatchField } from '../patches';
import { boxObstacle } from '../../CharacterController';
import { barkRadius, type Trunk } from '../squirrel-math';
import type { SquirrelTree } from '../squirrel';
import { SIZE } from '../../AnimalScale';
import {
  GLADE_FRAME, HEAP, HEAP_SPOTS, HOME_TREES, SEEDLING_SPOT, SNAG, SPOT_SIZE, STUMP, TREE, WOODPECKER, EEKHOORN_PLACES,
  gladeSpots, type HomeTree,
} from './eekhoorn.places';
import { headingTo } from '../places';

/** The squirrel's view of a home tree: its trunk and its branch. */
export function squirrelTree(t: HomeTree): SquirrelTree {
  const trunk: Trunk = { x: t.x, z: t.z, H: t.h, species: t.species };
  const b = t.branch ?? { ang: 0, h: 1.6, out: 0.28 };
  return { trunk, branch: { tree: trunk, ang: b.ang, h: b.h, out: b.out } };
}

/** A neighbour on its perch: the thing a child clicks in the call-back game. */
export interface Neighbour {
  id: 'gaai' | 'groene-specht' | 'raaf';
  /** what a player sees and clicks (the bird's holder) */
  object: THREE.Group;
  /** it calls: a hop and a flick of its tail (the beat lights it) */
  call(): void;
  /** where it sits (world) */
  at: THREE.Vector3;
}

/** How far (m) the ranger must have been from the glade before the seedling grows. */
const AWAY_M = 26;

export class EekhoornHome implements HomeDressing {
  readonly group = new THREE.Group();
  readonly field: PatchField;
  readonly neighbours: Neighbour[] = [];
  readonly trees = HOME_TREES.map(squirrelTree);
  /** the acorn store by the stump (it grows when the squirrel piles its acorns there) */
  private readonly heap: (THREE.Object3D | undefined)[] = [];
  private heapShown = 1;
  private readonly heapK: number[] = HEAP_SPOTS.map((_, i) => (i === 0 ? 1 : 0));
  private readonly stubs: THREE.Mesh;
  private readonly puffs: THREE.InstancedMesh;
  private readonly puff: { x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number; s: number }[] = [];
  private readonly seedling: THREE.Mesh;
  private readonly spawned: { dispose(): void }[] = [];
  private readonly birds: { o: THREE.Group; base: THREE.Vector3; baseYaw: number; kind: string; hop: number; seed: number; fly: number }[] = [];
  private readonly env: DressingEnv;
  private state: HomeState = 'before';
  /** the adventure finished just now: the seedling waits for a later visit */
  seedlingWaits = false;
  private away = 0;
  private clock = 0;

  constructor(env: DressingEnv) {
    this.env = env;
    this.group.name = 'eekhoorn-home';
    env.parent.add(this.group);
    const g = env.groundY;

    /* -- the branch stubs: short dead limbs sticking out of the bark (one mesh) -- */
    this.stubs = new THREE.Mesh(stubGeometry(HOME_TREES, g), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    this.stubs.name = 'branch-stubs';
    this.group.add(this.stubs);

    /* -- the glade: seven look-alike mossy cushions in the oak leaves -- */
    this.field = new PatchField({ parent: this.group, groundY: g, spots: gladeSpots(), size: SPOT_SIZE, heading: GLADE_FRAME.heading, seed: 41, look: 'moss' });

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
      // the raven sits on its top
      const box = new THREE.Box3().setFromObject(r);
      const top = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y - 0.12, (box.min.z + box.max.z) / 2);
      this.bird('raaf', SIZE.raaf.h, top, headingTo(SNAG, EEKHOORN_PLACES.callers) + 0.9);
    });
    env.obstacles.push({ x: SNAG.x, z: SNAG.z, r: 0.35 });
    // (a stump and a log a child walks round, never through)
    void boxObstacle;

    /* -- the neighbours: the jay on its stub, the woodpecker on its pine -- */
    const jay = TREE.jayPine.branch!;
    const jr = barkRadius(squirrelTree(TREE.jayPine).trunk, jay.h) + jay.out * 0.75;
    const jayAt = new THREE.Vector3(TREE.jayPine.x + Math.sin(jay.ang) * jr, g(TREE.jayPine.x, TREE.jayPine.z) + jay.h - 0.1, TREE.jayPine.z + Math.cos(jay.ang) * jr);
    this.bird('gaai', 0.3, jayAt, headingTo({ x: jayAt.x, z: jayAt.z }, EEKHOORN_PLACES.callers) - 0.9);
    const wp = WOODPECKER.tree;
    // it clings round the side of the trunk (belly to the bark), so from the stand it is
    // seen side-on: its red cap, its green back, its tail braced on the bark
    const wAng = headingTo(wp, EEKHOORN_PLACES.callers) + 1.25;
    const wr = barkRadius(squirrelTree(wp).trunk, WOODPECKER.h) + 0.07;
    const wpAt = new THREE.Vector3(wp.x + Math.sin(wAng) * wr, g(wp.x, wp.z) + WOODPECKER.h, wp.z + Math.cos(wAng) * wr);
    this.bird('groene-specht', 0.42, wpAt, wAng + Math.PI, { clipBelow: -0.43 });

    /* -- little puffs of earth when the squirrel digs (one mesh) -- */
    this.puffs = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#4a3525', roughness: 1, flatShading: true }), 18);
    this.puffs.name = 'dig-puffs';
    this.puffs.frustumCulled = false;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < 18; i++) this.puffs.setMatrixAt(i, zero);
    this.group.add(this.puffs);

    /* -- the seedling that grows at a forgotten spot (after, on a later visit) -- */
    const sp = gladeSpots()[SEEDLING_SPOT];
    this.seedling = new THREE.Mesh(seedlingGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }));
    this.seedling.name = 'oak-seedling';
    this.seedling.position.set(sp.x + 0.05, g(sp.x, sp.z) + 0.03, sp.z - 0.04);
    this.seedling.visible = false;
    this.group.add(this.seedling);
  }

  /** A neighbour bird on its perch (it looks round now and then; the call-back game
   *  picks and lights it). `clipBelow`: the part of its model under its feet (a
   *  modeller's perch block) is not drawn. */
  private bird(id: Neighbour['id'], h: number, at: THREE.Vector3, yaw: number, opts: { clipBelow?: number } = {}): void {
    const holder = new THREE.Group();
    holder.name = `neighbour-${id}`;
    holder.position.copy(at);
    holder.rotation.y = yaw;
    this.group.add(holder);
    const entry = { o: holder, base: at.clone(), baseYaw: yaw, kind: id, hop: 0, seed: this.birds.length * 2.1 + 0.4, fly: -1 };
    this.birds.push(entry);
    this.neighbours.push({
      id, object: holder, at: at.clone(),
      call: () => { entry.hop = 0.001; },
    });
    void this.env.spawnModel(id, { height: h, idle: false }).then((s) => {
      if (!s) return;
      const r = s.root as THREE.Object3D;
      r.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        for (const mat of [m.material].flat() as THREE.MeshStandardMaterial[]) {
          // a raven is black: the model's pale body is darkened to a raven's gloss
          if (id === 'raaf') { mat.color.set('#35343a'); mat.roughness = 0.55; }
          if (opts.clipBelow !== undefined) clipBelow(mat, opts.clipBelow);
        }
      });
      if (opts.clipBelow !== undefined) {
        // stand it on what is left of it (its feet), not on the cut-away block
        r.updateWorldMatrix(true, true);
        r.position.y -= 0.02;
      }
      holder.add(r);
      this.spawned.push(s);
    });
  }

  /** A puff of earth at (x, z): a few crumbs thrown up and out, falling back. */
  puffAt(x: number, z: number, reduced: boolean): void {
    if (reduced) return;
    const y = this.env.groundY(x, z) + 0.03;
    for (let k = 0; k < 4; k++) {
      const a = Math.random() * Math.PI * 2;
      const slot = this.puff.length < 18 ? this.puff.length : this.puff.findIndex((p) => p.t <= 0);
      const p = { x, y, z, vx: Math.cos(a) * (0.25 + Math.random() * 0.35), vy: 0.7 + Math.random() * 0.5, vz: Math.sin(a) * (0.25 + Math.random() * 0.35), t: 0.55, s: 0.008 + Math.random() * 0.01 };
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
    if (b && b.fly < 0) b.fly = 0;
  }

  setState(state: HomeState): void {
    this.state = state;
    // after: the bigger store, the jay gone; before: the small store, the jay on its stub
    this.heapShown = state === 'after' ? HEAP_SPOTS.length : 1;
    this.showHeap(true);
    for (const b of this.birds) {
      if (b.kind !== 'gaai') continue;
      b.fly = state === 'after' ? 99 : -1;
      b.o.visible = state !== 'after';
      b.o.position.copy(b.base);
      b.o.rotation.set(0, b.baseYaw, 0);
    }
    this.seedling.visible = state === 'after' && !this.seedlingWaits;
    this.field.clear();
  }

  update(dt: number, t: number, reduced: boolean, movers: readonly { x: number; z: number; moving: boolean }[]): void {
    this.clock += dt;
    this.field.update(dt, reduced);
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
    // the birds: a small look round now and then, a hop and a flick when they call
    for (const b of this.birds) {
      if (b.fly >= 0 && b.fly < 99) { this.flyAway(b, dt, reduced); continue; }
      if (!b.o.visible) continue;
      const look = reduced ? 0 : 0.35 * Math.sin(t * 0.45 + b.seed) * (Math.sin(t * 0.23 + b.seed * 3) > 0.2 ? 1 : 0.2);
      let lift = 0, tilt = 0;
      if (b.hop > 0) {
        b.hop += dt;
        const u = b.hop / 0.42;
        if (u >= 1) b.hop = 0;
        else if (!reduced) { lift = Math.sin(u * Math.PI) * 0.045; tilt = Math.sin(u * Math.PI) * 0.28; }
      }
      b.o.position.set(b.base.x, b.base.y + lift, b.base.z);
      b.o.rotation.set(-tilt, b.baseYaw + look, 0, 'YXZ');
    }
    // the puffs of earth
    if (this.puff.length) {
      const m = new THREE.Matrix4();
      for (let i = 0; i < this.puff.length; i++) {
        const p = this.puff[i];
        if (p.t <= 0) { this.puffs.setMatrixAt(i, m.makeScale(0, 0, 0)); continue; }
        p.t -= dt;
        p.vy -= 3.2 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        const floor = this.env.groundY(p.x, p.z) + 0.01;
        if (p.y < floor) { p.y = floor; p.vx *= 0.3; p.vz *= 0.3; p.vy = 0; }
        const s = p.s * Math.min(1, p.t * 4);
        this.puffs.setMatrixAt(i, m.compose(new THREE.Vector3(p.x, p.y, p.z), new THREE.Quaternion(), new THREE.Vector3(s, s, s)));
      }
      this.puffs.instanceMatrix.needsUpdate = true;
    }
    // the seedling grows while the ranger is away (a later visit finds it)
    if (this.state === 'after' && this.seedlingWaits) {
      const me = movers[movers.length - 1]; // (the ranger is the last mover a home is told)
      const far = me ? Math.hypot(me.x - EEKHOORN_PLACES.glade.x, me.z - EEKHOORN_PLACES.glade.z) > AWAY_M : false;
      this.away = far ? this.away + dt : 0;
      if (this.away > 2) { this.seedlingWaits = false; this.seedling.visible = true; }
    }
  }

  /** The jay's flight: a hop off the stub, then a rising curve away over the trees. */
  private flyAway(b: { o: THREE.Group; base: THREE.Vector3; baseYaw: number; fly: number }, dt: number, reduced: boolean): void {
    b.fly += dt;
    const T = 2.6;
    if (reduced || b.fly >= T) { b.o.visible = false; b.fly = 99; return; }
    const u = b.fly / T;
    // away from the stand, up over the canopy (never toward the lens)
    const away = headingTo(EEKHOORN_PLACES.callers, { x: b.base.x, z: b.base.z }) - 0.5;
    const d = 14 * u * u + 1.2 * u;
    b.o.position.set(b.base.x + Math.sin(away) * d, b.base.y + 0.25 * Math.sin(Math.min(1, u * 5) * Math.PI / 2) + 7 * u * u, b.base.z + Math.cos(away) * d);
    b.o.rotation.set(-0.35, away, 0.12 * Math.sin(b.fly * 9), 'YXZ');
  }

  dispose(): void {
    this.field.dispose();
    for (const s of this.spawned) s.dispose();
    this.stubs.geometry.dispose();
    (this.stubs.material as THREE.Material).dispose();
    this.puffs.dispose();
    this.puffs.geometry.dispose();
    (this.puffs.material as THREE.Material).dispose();
    this.seedling.geometry.dispose();
    (this.seedling.material as THREE.Material).dispose();
    this.group.removeFromParent();
  }
}

/** Don't draw what of a model lies below `y` in its own (model) space. */
function clipBelow(mat: THREE.MeshStandardMaterial, y: number): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uClipY = { value: y };
    shader.vertexShader = 'varying float vModelY;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvModelY = position.y;');
    shader.fragmentShader = 'varying float vModelY;\nuniform float uClipY;\n' + shader.fragmentShader.replace('void main() {', 'void main() {\n  if (vModelY < uClipY) discard;');
  };
  mat.customProgramCacheKey = () => `clip-below-${y}`;
  mat.needsUpdate = true;
}

/** The dead branch stubs of the home trees: short, tapered limbs out of the bark, a
 *  little upward, the colour of their tree's bark. One geometry. */
function stubGeometry(trees: readonly HomeTree[], g: (x: number, z: number) => number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const t of trees) {
    if (!t.branch) continue;
    const b = t.branch;
    const trunk: Trunk = { x: t.x, z: t.z, H: t.h, species: t.species };
    const r0 = barkRadius(trunk, b.h);
    const len = b.out + 0.12 + r0 * 0.3;
    const oak = t.species === 'prop-oak-tree';
    const cyl = new THREE.CylinderGeometry(oak ? 0.045 : 0.03, oak ? 0.07 : 0.05, len, 7, 1);
    cyl.translate(0, len / 2, 0);
    cyl.rotateX(Math.PI / 2 - 0.12); // lying out along +z, tipped a little up
    cyl.rotateY(b.ang);
    const start = r0 * 0.7; // rooted inside the bark
    cyl.translate(t.x + Math.sin(b.ang) * start, g(t.x, t.z) + b.h - (oak ? 0.06 : 0.045), t.z + Math.cos(b.ang) * start);
    const col = new THREE.Color(oak ? '#5d5448' : '#6a4632');
    const n = cyl.attributes.position.count;
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
    cyl.setAttribute('color', new THREE.BufferAttribute(c, 3));
    parts.push(cyl.toNonIndexed());
    cyl.dispose();
  }
  return mergeFlat(parts);
}

/** A tiny oak seedling: a thin stem and a few lobed leaves (green), ~0.2 m. */
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
  [[0.1, 0.4, 0.9], [0.13, 2.4, 0.8], [0.16, 4.3, 0.9], [0.18, 1.2, 0.5]].forEach(([y, a, tilt]) => {
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
