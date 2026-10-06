/**
 * cover.ts — true-scale cover an animal really hides in (design §3.7): stands and loose
 * clumps of bracken (adelaarsvaren, fronds 0.9-1.2 m), pijpenstrootje tussocks
 * (0.5-0.9 m) and a little heather, INSTANCED — the whole field of cover of a mission's
 * home is three draw calls, however many clumps it has.
 *
 * Alive where it matters: a clump RUSTLES (its stems sway for a moment: a click, a hint,
 * something moving in it), PARTS (its stems lean away from a point and slowly come back:
 * a miss shows there is nothing under it, a found animal is uncovered), and an animal
 * walking through it pushes the stems it passes aside. Otherwise it stands in a very
 * light breeze (still under reduced motion).
 *
 * The maths of what a lens sees through it (a glimpse of a back between the stems) is
 * pure: cover-math.ts.
 */

import * as THREE from 'three';
import { heatherGeometry, plantMaterial } from '../world/Plants';
import { stream } from './places';
import { growStems, resetStems, type Clump, type Stem, type PlantKind } from './cover-math';

/* --------------------------------------------------------------- geometry ---- */

const _c = new THREE.Color();

/**
 * One bracken frond, 1 m tall before scaling, facing +z: a slim stalk rising to ~0.78 m,
 * then the blade, a near-horizontal triangle of paired leaflets reaching 0.55 m out and
 * drooping at its tip — the "little table" a stand of bracken is made of. Vertex-
 * coloured (a brown-green stalk, fresh green leaflets yellowing to their tips).
 */
export function frondGeometry(seed = 1, far = false): THREE.BufferGeometry {
  const rnd = stream(seed * 977 + 13);
  const P: number[] = [], N: number[] = [], C: number[] = [], I: number[] = [];
  const push = (x: number, y: number, z: number, c: THREE.Color, ny = 0.9): number => {
    P.push(x, y, z);
    const l = Math.hypot(x * 0.4, ny, z * 0.2) || 1;
    N.push((x * 0.4) / l, ny / l, (z * 0.2) / l);
    C.push(c.r, c.g, c.b);
    return P.length / 3 - 1;
  };
  const stalk0 = new THREE.Color('#6f5a2e'), stalk1 = new THREE.Color('#5d7430');
  const leaf0 = new THREE.Color('#48762a'), leaf1 = new THREE.Color('#93b04a');
  // the stalk: a thin strip rising to the blade
  const top = { x: 0, y: 0.74, z: 0.05 };
  const w = 0.011;
  for (let k = 0; k < 2; k++) {
    const t0 = k / 2, t1 = (k + 1) / 2;
    const a = push(-w, top.y * t0, top.z * t0 * t0, _c.copy(stalk0).lerp(stalk1, t0), 0.3);
    const b = push(w, top.y * t0, top.z * t0 * t0, _c.copy(stalk0).lerp(stalk1, t0), 0.3);
    const c = push(-w * 0.8, top.y * t1, top.z * t1 * t1, _c.copy(stalk0).lerp(stalk1, t1), 0.3);
    const d = push(w * 0.8, top.y * t1, top.z * t1 * t1, _c.copy(stalk0).lerp(stalk1, t1), 0.3);
    I.push(a, b, c, b, d, c);
  }
  // the blade: a broad triangle held nearly flat, arching and drooping at its tip
  const R = (t: number): { x: number; y: number; z: number } => ({
    x: 0, y: top.y + 0.24 * t - 0.26 * t * t, z: top.z + 0.58 * t,
  });
  // (run 7 fix, `far`: the copy drawn from afar — fewer pinnae, a lobe or two each, as
  // broad, the same colours: ~1/12 of the triangles, the same frond 12 m off)
  const N_PAIRS = far ? 6 : 9;
  for (let i = 0; i < N_PAIRS; i++) {
    const t = 0.05 + 0.9 * (i / (N_PAIRS - 1));
    const p0 = R(t);
    const len = 0.34 * Math.pow(1 - 0.85 * t, 0.85) + 0.03; // the pinnae shorten toward the tip
    const tint = 0.88 + rnd() * 0.24;
    for (const side of [-1, 1]) {
      // each pinna reaches out to the side and forward, drooping along its length
      let dx = side * 0.86, dy = -0.1 - 0.12 * t, dz = 0.45;
      const dl = Math.hypot(dx, dy, dz); dx /= dl; dy /= dl; dz /= dl;
      // its little leaflets (pinnules) along it, pairs of soft lobes: bracken's lace
      const lobes = far ? (t < 0.5 ? 2 : 1) : Math.max(2, Math.round(5 * (1 - t * 0.6)));
      for (let j = 0; j < lobes; j++) {
        const f0 = j / lobes, f1 = (j + 1) / lobes;
        const q0 = { x: p0.x + dx * len * f0, y: p0.y + dy * len * f0 - 0.02 * f0 * f0, z: p0.z + dz * len * f0 };
        const q1 = { x: p0.x + dx * len * f1, y: p0.y + dy * len * f1 - 0.02 * f1 * f1, z: p0.z + dz * len * f1 };
        const lw = 0.03 * (1 - f0 * 0.7) * (1 - t * 0.5) * (far ? 1.9 : 1);
        const mid = { x: (q0.x + q1.x) / 2, y: (q0.y + q1.y) / 2, z: (q0.z + q1.z) / 2 };
        const col = _c.copy(leaf0).lerp(leaf1, Math.min(1, f0 * 0.8 + t * 0.4)).multiplyScalar(tint).clone();
        // a lobe on either side of the pinna's midrib (the width runs along the rachis)
        const a0 = push(q0.x, q0.y, q0.z, col);
        const l1 = push(mid.x - dz * lw * side * 0.2, mid.y - 0.004, mid.z + lw, col);
        const r1 = push(mid.x + dz * lw * side * 0.2, mid.y - 0.004, mid.z - lw, col);
        const b1 = push(q1.x, q1.y, q1.z, col);
        I.push(a0, l1, b1, a0, b1, r1);
      }
    }
  }
  // the rachis itself: a thin strip, so the pinnae hang off something
  const RACHIS = far ? 2 : 5;
  for (let k = 0; k < RACHIS; k++) {
    const t0 = k / RACHIS, t1 = (k + 1) / RACHIS;
    const q0 = R(t0), q1 = R(t1), rw = 0.006 * (1 - t0 * 0.6);
    const a = push(q0.x - rw, q0.y, q0.z, stalk1), b = push(q0.x + rw, q0.y, q0.z, stalk1);
    const c = push(q1.x - rw, q1.y, q1.z, leaf0), d = push(q1.x + rw, q1.y, q1.z, leaf0);
    I.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setIndex(I);
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

/**
 * A pijpenstrootje tussock, 1 m tall before scaling: a dense fountain of long arching
 * leaves (green at the root, straw at the tip) with a few taller flower stalks whose
 * heads are a dusky purple-brown (it is purple moor-grass).
 */
export function moorGrassGeometry(seed = 1, blades = 52, widen = 1): THREE.BufferGeometry {
  const rnd = stream(seed * 131 + 7);
  const root = new THREE.Color('#4e5c2a'), mid = new THREE.Color('#7f8a40'), tip = new THREE.Color('#d1bf82');
  const stalk = new THREE.Color('#9a8a5a'), head = new THREE.Color('#6e4a5c');
  const P: number[] = [], C: number[] = [], N: number[] = [], I: number[] = [];
  const push = (x: number, y: number, z: number, c: THREE.Color): void => {
    P.push(x, y, z);
    const nx = x * 1.2, ny = 0.8, nz = z * 1.2, l = Math.hypot(nx, ny, nz) || 1;
    N.push(nx / l, ny / l, nz / l);
    C.push(c.r, c.g, c.b);
  };
  const blade = (a: number, r0: number, h: number, lean: number, w: number, c0: THREE.Color, c1: THREE.Color, c2: THREE.Color): void => {
    const cx = Math.cos(a), cz = Math.sin(a), px = -cz, pz = cx;
    const pts = [0, 0.4, 0.75, 1].map((t) => {
      const out = r0 + lean * t * t;              // arches out toward the tip
      const y = h * (t < 1 ? t * (1.05 - 0.05 * t) : 0.93); // the tip droops a little
      return { x: cx * out, y, z: cz * out, w: w * (1 - t * 0.85) };
    });
    const base = P.length / 3;
    pts.forEach((p, k) => {
      const col = k === 0 ? c0 : k === 3 ? c2 : _c.copy(c0).lerp(c1, k / 2);
      push(p.x - px * p.w, p.y, p.z - pz * p.w, col);
      push(p.x + px * p.w, p.y, p.z + pz * p.w, col);
    });
    for (let k = 0; k < 3; k++) {
      const a0 = base + k * 2;
      I.push(a0, a0 + 1, a0 + 3, a0, a0 + 3, a0 + 2);
    }
  };
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2 + rnd() * 0.7;
    blade(a, 0.02 + rnd() * 0.08, 0.6 + rnd() * 0.4, 0.22 + rnd() * 0.32, (0.018 + rnd() * 0.01) * widen, root, mid, tip);
  }
  // the flower stalks: fewer, taller, nearly upright, a dark head
  const stalks = 4 + Math.floor(rnd() * 3);
  for (let i = 0; i < stalks; i++) {
    const a = rnd() * Math.PI * 2;
    blade(a, 0.03 + rnd() * 0.05, 1.0 + rnd() * 0.18, 0.08 + rnd() * 0.1, 0.012, stalk, stalk, head);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setIndex(I);
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

/* ------------------------------------------------------------ the field ---- */

/** The instanced plant meshes a field of cover draws with (three draw calls). */
interface Kind { mesh: THREE.InstancedMesh; stems: number[] }

/** Per-stem motion: a sway (rustle) and a lean (part / pushed aside). */
interface Motion {
  sway: number;        // current sway amplitude (rad), decays
  swayT: number;       // its clock
  lean: number;        // current lean (rad)
  leanTo: number;      // the lean it eases toward
  hold: number;        // seconds the part holds before it eases back
  ax: number; az: number; // lean direction (unit, world): the stem tips this way
}

const WIND = 0.022;      // the breeze (rad), a slow breathing sway
const PUSH_R = 0.42;     // an animal pushes stems within this far aside (m)

/** Run 7 fix (triangle budget): a field the lens is further than `far` m from (from the
 *  nearest edge of its ground) draws its simpler copy — the same plants with fewer leaflets
 *  and blades, the same colours and places — and its own again within `near` m. Every
 *  search, hold and close picture stands far inside `near`; from another home 25-45 m off a
 *  field of 200 plants cost ~150k triangles at full detail (playtest 2026-10-05: up to
 *  1.13M in free roam at the ven's marker, the budget 1M). */
export const COVER_DETAIL = { near: 10, far: 12 } as const;

/** The switch between a field's own plants and its simpler copy: the renderer calls
 *  `update(camera)` on every LOD it draws, each frame, before its children. */
class CoverLod extends THREE.LOD {
  far = false;
  private readonly at = new THREE.Vector3();
  private readonly centre: THREE.Vector3;
  private readonly radius: number;
  private readonly nearSet: THREE.Object3D;
  private readonly farSet: THREE.Object3D;
  constructor(centre: THREE.Vector3, radius: number, nearSet: THREE.Object3D, farSet: THREE.Object3D) {
    super();
    this.centre = centre; this.radius = radius; this.nearSet = nearSet; this.farSet = farSet;
    this.name = 'cover-lod';
    this.add(nearSet, farSet);
    farSet.visible = false;
  }
  update(camera: THREE.Camera): void {
    const d = Math.max(0, camera.getWorldPosition(this.at).distanceTo(this.centre) - this.radius);
    const far = this.far ? d > COVER_DETAIL.near : d > COVER_DETAIL.far;
    if (far === this.far) return;
    this.far = far;
    this.nearSet.visible = !far;
    this.farSet.visible = far;
  }
}

export interface CoverFieldOpts {
  parent: THREE.Object3D;
  groundY(x: number, z: number): number;
  clumps: readonly Clump[];
  seed: number;
}

export class CoverField {
  readonly group = new THREE.Group();
  readonly clumps: readonly Clump[];
  /** every plant (the maths' view: the search computes glimpses on these) */
  readonly stems: Stem[] = [];
  private readonly kinds = new Map<PlantKind, Kind>();
  private readonly where: { kind: PlantKind; i: number; s: number; sy: number; pitch: number }[] = [];
  private readonly motion: Motion[] = [];
  private readonly byClump: number[][] = [];
  private readonly phase: number[] = [];
  private readonly hidden = new Set<number>();
  private readonly geos: THREE.BufferGeometry[] = [];
  /** the stems as grown (a glimpse window opened for one spot is closed again: `reset`) */
  private readonly built: readonly Stem[];
  /** run 7 fix: the simpler copies drawn from afar, and the switch (`COVER_DETAIL`) */
  private readonly farMeshes: THREE.InstancedMesh[] = [];
  private readonly lod!: CoverLod;
  private dirty = true;
  private idleFor = 0;
  private readonly _m = new THREE.Matrix4();
  private readonly _q = new THREE.Quaternion();
  private readonly _q2 = new THREE.Quaternion();
  private readonly _p = new THREE.Vector3();
  private readonly _s = new THREE.Vector3();
  private readonly _ax = new THREE.Vector3();
  private readonly UP = new THREE.Vector3(0, 1, 0);

  constructor(o: CoverFieldOpts) {
    this.clumps = o.clumps;
    this.group.name = 'cover-field';
    // the plants, grown the one pure way (cover-math growStems: a places test measures the
    // glimpse of this very stand)
    const grown = growStems(o.clumps, o.seed, o.groundY);
    this.built = grown.stems.map((s) => ({ ...s }));
    grown.stems.forEach((stem, idx) => {
      const look = grown.looks[idx];
      this.stems.push(stem);
      this.where.push({ kind: stem.kind, i: -1, s: look.s, sy: look.sy, pitch: look.pitch });
      this.motion.push({ sway: 0, swayT: 0, lean: 0, leanTo: 0, hold: 0, ax: 0, az: 0 });
      this.phase.push(look.phase);
      (this.byClump[stem.clump] ??= []).push(idx);
      if (look.tint) (this.where[idx] as { tint?: THREE.Color }).tint = new THREE.Color().setRGB(look.tint[0], look.tint[1], look.tint[2]);
    });
    // the meshes: one per kind of plant, every stem one instance; and their simpler copy
    // from afar (run 7 fix: `COVER_DETAIL`), drawn from the very same instances
    const geoOf: Record<PlantKind, () => THREE.BufferGeometry> = {
      frond: () => frondGeometry(o.seed),
      tussock: () => moorGrassGeometry(o.seed),
      heath: () => heatherGeometry(o.seed, 110),
    };
    const farOf: Record<PlantKind, () => THREE.BufferGeometry> = {
      frond: () => frondGeometry(o.seed, true),
      tussock: () => moorGrassGeometry(o.seed, 10, 2.2),
      heath: () => heatherGeometry(o.seed, 36),
    };
    const nearSet = new THREE.Group(), farSet = new THREE.Group();
    nearSet.name = 'cover-near'; farSet.name = 'cover-far';
    for (const kind of ['frond', 'tussock', 'heath'] as PlantKind[]) {
      const list = this.stems.map((s, i) => (s.kind === kind ? i : -1)).filter((i) => i >= 0);
      if (!list.length) continue;
      const geo = geoOf[kind]();
      this.geos.push(geo);
      const mesh = new THREE.InstancedMesh(geo, plantMaterial(), list.length);
      mesh.name = `cover-${kind}`;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      list.forEach((si, k) => {
        this.where[si].i = k;
        const tint = (this.where[si] as { tint?: THREE.Color }).tint;
        mesh.setColorAt(k, tint ?? _c.setRGB(1, 1, 1));
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.kinds.set(kind, { mesh, stems: list });
      nearSet.add(mesh);
      // the copy from afar: its own simpler plant, the near mesh's instances and colours (one
      // buffer: every rustle and part moves both), never hit by a ray (the near one is)
      const fg = farOf[kind]();
      this.geos.push(fg);
      const far = new THREE.InstancedMesh(fg, mesh.material, list.length);
      far.name = `cover-${kind}-far`;
      far.instanceMatrix = mesh.instanceMatrix;
      if (mesh.instanceColor) far.instanceColor = mesh.instanceColor;
      far.castShadow = false;
      far.receiveShadow = false;
      far.raycast = () => {};
      this.farMeshes.push(far);
      farSet.add(far);
    }
    this.writeAll(0);
    for (const k of this.kinds.values()) { k.mesh.computeBoundingSphere(); k.mesh.computeBoundingBox(); }
    for (const f of this.farMeshes) { f.computeBoundingSphere(); f.computeBoundingBox(); }
    // (the field's ground: the middle of its stems, out to the furthest plus a frond's reach)
    const centre = new THREE.Vector3();
    for (const st of this.stems) centre.add(this._p.set(st.x, st.y, st.z));
    if (this.stems.length) centre.multiplyScalar(1 / this.stems.length);
    const radius = this.stems.reduce((r, st) => Math.max(r, Math.hypot(st.x - centre.x, st.z - centre.z)), 0) + 1;
    this.lod = new CoverLod(centre, radius, nearSet, farSet);
    this.group.add(this.lod);
    o.parent.add(this.group);
  }

  /** The stems of a clump (indices into `stems`). */
  stemsOf(clump: number): readonly number[] { return this.byClump[clump] ?? []; }

  /** The clump nearest (x, z) (optionally only among `pick`), with its distance. */
  nearestClump(x: number, z: number, pick?: (c: Clump, i: number) => boolean): { i: number; d: number } | null {
    let best: { i: number; d: number } | null = null;
    this.clumps.forEach((c, i) => {
      if (pick && !pick(c, i)) return;
      const d = Math.hypot(c.x - x, c.z - z);
      if (!best || d < best.d) best = { i, d };
    });
    return best;
  }

  /** A clump's stems sway for a moment (something moved in it). */
  rustle(clump: number, amp = 0.12): void {
    for (const si of this.stemsOf(clump)) {
      const m = this.motion[si];
      m.sway = Math.max(m.sway, amp * (0.8 + 0.4 * Math.sin(si * 3.1)));
      m.swayT = 0;
    }
    this.dirty = true;
  }

  /** A clump's stems lean away from (x, z) by `amt` rad, hold `hold` s, then ease back. */
  part(clump: number, from: { x: number; z: number }, amt = 0.5, hold = 1.6): void {
    for (const si of this.stemsOf(clump)) this.leanAway(si, from, amt, hold);
    this.dirty = true;
  }

  /** Every stem within `r` m of (x, z) leans away from it (an animal uncovered). */
  partAt(x: number, z: number, r: number, amt = 0.45, hold = 2): void {
    this.stems.forEach((s, si) => {
      const d = Math.hypot(s.x - x, s.z - z);
      if (d < r) this.leanAway(si, { x, z }, amt * (1 - (d / r) * 0.5), hold);
    });
    this.dirty = true;
  }

  private leanAway(si: number, from: { x: number; z: number }, amt: number, hold: number): void {
    const s = this.stems[si], m = this.motion[si];
    let dx = s.x - from.x, dz = s.z - from.z;
    const l = Math.hypot(dx, dz);
    if (l < 1e-3) { dx = Math.sin(s.yaw); dz = Math.cos(s.yaw); } else { dx /= l; dz /= l; }
    m.ax = dx; m.az = dz;
    m.leanTo = Math.max(m.leanTo, amt);
    m.hold = Math.max(m.hold, hold);
  }

  /** Show or take away a whole clump (a trial's decoy that is not in this trial). */
  showClump(clump: number, on: boolean): void {
    for (const si of this.stemsOf(clump)) { if (on) this.hidden.delete(si); else this.hidden.add(si); }
    this.dirty = true;
  }

  /** Stems edited by the maths (a glimpse window) are drawn as edited. */
  refresh(): void { this.dirty = true; }

  /** Run 7: every stem back to its built height (a window opened for one hiding spot is
   *  closed before another's opens), drawn at once; returns the stems it changed. */
  reset(): number[] {
    const changed = resetStems(this.stems, this.built);
    for (const i of changed) { this.growing.delete(i); this.drawnH.delete(i); }
    this.dirty = true;
    return changed;
  }

  /** Stems the maths made smaller since they were drawn grow down to it calmly over
   *  `secs` (a window opened for a lens that differs a little from the one planned). */
  settle(indices: readonly number[], secs: number, drawnBefore: readonly number[]): void {
    for (const i of indices) {
      const s = this.stems[i];
      this.growing.set(i, { from: this.drawnH.get(i) ?? drawnBefore[i] ?? s.h, to: s.h, t: 0, secs });
    }
    this.dirty = true;
  }
  private readonly growing = new Map<number, { from: number; to: number; t: number; secs: number }>();
  private readonly drawnH = new Map<number, number>();

  /** Pick the clump under a camera ray, or null. */
  pick(ray: THREE.Raycaster): number | null {
    const meshes = [...this.kinds.values()].map((k) => k.mesh);
    const hit = ray.intersectObjects(meshes, false)[0];
    if (!hit || hit.instanceId === undefined) return null;
    const kind = [...this.kinds.entries()].find(([, k]) => k.mesh === hit.object);
    const si = kind ? kind[1].stems[hit.instanceId] : undefined;
    return si === undefined ? null : this.stems[si].clump;
  }

  /** The instanced meshes (for a caller that raycasts them itself). */
  get meshes(): THREE.InstancedMesh[] { return [...this.kinds.values()].map((k) => k.mesh); }

  /**
   * Per frame (when the lens is near): the breeze, the rustles and parts easing, and the
   * stems an animal walks through pushed aside. `movers` are the animals in it now.
   */
  update(dt: number, t: number, reduced: boolean, movers: readonly { x: number; z: number; moving: boolean }[] = []): void {
    let active = false;
    for (const mv of movers) {
      if (!mv.moving) continue;
      this.stems.forEach((s, si) => {
        const d = Math.hypot(s.x - mv.x, s.z - mv.z);
        if (d < PUSH_R) { this.leanAway(si, mv, 0.42 * (1 - d / PUSH_R), 0.25); if (!reduced) this.motion[si].sway = Math.max(this.motion[si].sway, 0.05); }
      });
    }
    for (const m of this.motion) {
      if (m.sway > 0.002) { m.swayT += dt; m.sway *= Math.exp(-dt * 2.2); active = true; } else m.sway = 0;
      if (m.hold > 0) { m.hold -= dt; active = true; } else if (m.leanTo > 0) { m.leanTo = Math.max(0, m.leanTo - dt * 0.5); active = true; }
      const k = reduced ? 1 : Math.min(1, dt * (m.lean < m.leanTo ? 6 : 2.5));
      const nl = m.lean + (m.leanTo - m.lean) * k;
      if (Math.abs(nl - m.lean) > 1e-4) active = true;
      m.lean = nl;
    }
    for (const [i, g] of this.growing) {
      g.t = Math.min(1, g.t + (reduced ? 1 : dt / g.secs));
      this.drawnH.set(i, g.from + (g.to - g.from) * (g.t * g.t * (3 - 2 * g.t)));
      if (g.t >= 1) { this.growing.delete(i); this.drawnH.delete(i); }
      active = true;
    }
    // the breeze: a slow redraw a few times a second is enough for a stand at rest
    this.idleFor += dt;
    if (active || this.dirty || (!reduced && this.idleFor > 0.1)) {
      this.idleFor = 0;
      this.writeAll(reduced ? 0 : t);
      this.dirty = false;
    }
  }

  /** Write every instance's matrix: its place, turn, size, droop, lean and sway. */
  private writeAll(t: number): void {
    const up = this.UP;
    this.stems.forEach((s, si) => {
      const w = this.where[si], m = this.motion[si];
      const k = this.kinds.get(s.kind);
      if (!k || w.i < 0) return;
      const breeze = t ? WIND * Math.sin(t * 1.1 + this.phase[si]) : 0;
      const sway = m.sway * Math.sin(m.swayT * 11 + this.phase[si]);
      // lean (part) about the horizontal axis across its lean direction, then its own turn
      const lean = m.lean + sway;
      this._ax.set(m.az || Math.cos(this.phase[si]), 0, -(m.ax || Math.sin(this.phase[si]))).normalize();
      this._q.setFromAxisAngle(this._ax, lean + breeze);
      this._q2.setFromAxisAngle(up, s.yaw);
      this._q.multiply(this._q2);
      if (w.pitch) this._q.multiply(this._q2.setFromAxisAngle(this._ax.set(1, 0, 0), w.pitch));
      const h = this.drawnH.get(si) ?? s.h;
      const hs = s.h0 ? h / s.h0 : 1;
      if (this.hidden.has(si)) this._s.setScalar(0);
      else if (s.kind === 'heath') this._s.set(w.s, w.sy * hs, w.s);
      else if (s.kind === 'tussock') this._s.set(w.s * 1.05 * Math.sqrt(hs), h, w.s * 1.05 * Math.sqrt(hs));
      else this._s.setScalar(h); // a frond scales whole
      this._m.compose(this._p.set(s.x, s.y, s.z), this._q, this._s);
      k.mesh.setMatrixAt(w.i, this._m);
    });
    for (const k of this.kinds.values()) k.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Run 7 fix: is the field drawn as its simpler copy now (the lens far from it)? */
  get far(): boolean { return this.lod.far; }

  dispose(): void {
    this.group.removeFromParent();
    for (const k of this.kinds.values()) k.mesh.dispose();
    for (const f of this.farMeshes) f.dispose();
    for (const g of this.geos) g.dispose();
  }
}
