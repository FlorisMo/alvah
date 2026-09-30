/**
 * patches.ts — a field of LOOK-ALIKE spots on the ground a route is remembered over
 * (the corsi engine in the world, design §6): the frisling's patches of turned earth
 * where the group rooted, the squirrel's caching spots. They must look alike (nothing
 * nameable: the task stays visuospatial), all stand in one view, and each can light up
 * on its own for the show — a warm glow and fresh prints — and keep a calm mark after
 * the recall reached it.
 *
 * Each spot is its own small mesh (it is what a child clicks, and what the play hint
 * points at), all sharing one geometry; every print is one instance of one mesh. Every
 * spot is seated on the rendered ground and tilted to its slope.
 */

import * as THREE from 'three';
import { stream } from './places';
import type { Spot } from './types';

/** How a spot looks now. */
export type PatchState = 'rest' | 'show' | 'ok' | 'wrong';

const REST = new THREE.Color(1, 1, 1);
const SHOW = new THREE.Color(2.1, 1.6, 0.85);   // a warm lift: "here they rooted"
const OK = new THREE.Color(0.92, 1.18, 0.9);     // a calm green: the recall reached it
const WRONG = new THREE.Color(1.3, 1.02, 0.92);  // soft warm, never an alarm red

/** One mound of turned earth, 1 m across before scaling: a low, lumpy disc of dark soil
 *  with clods, its rim feathered into the ground (vertex colours). */
function moundGeometry(seed: number): THREE.BufferGeometry {
  const rnd = stream(seed);
  const RINGS = 7, SEG = 26;
  const P: number[] = [], C: number[] = [], I: number[] = [];
  // rooted earth: a shallow hollow of dark, moist soil, the soil thrown up round it in
  // lumps and crumbs, a few pale sandy bits — never a smooth disc
  const moist = new THREE.Color('#3a2b20'), soil = new THREE.Color('#5a4431'), crumb = new THREE.Color('#7d6448'), sand = new THREE.Color('#a08a64');
  P.push(0, 0.004, 0); C.push(moist.r, moist.g, moist.b);
  // the outline and the crumbs follow slow waves round the patch (never a star of spikes)
  const ph = [rnd() * 6.3, rnd() * 6.3, rnd() * 6.3, rnd() * 6.3];
  const wave = (a: number, k: number): number => Math.sin(a * 2 + ph[0] + k) * 0.55 + Math.sin(a * 3 + ph[1] - k * 2) * 0.3 + Math.sin(a * 5 + ph[2]) * 0.15;
  for (let r = 1; r <= RINGS; r++) {
    const k = r / RINGS;
    for (let i = 0; i < SEG; i++) {
      const a = (i / SEG) * Math.PI * 2;
      const rr = 0.5 * k * (1 + wave(a, 0) * 0.2 * k + (rnd() - 0.5) * 0.05);
      // low in the middle, the thrown-up rim highest, the outer edge settling into the ground
      const rim = Math.exp(-((k - 0.72) ** 2) / 0.03) * (0.022 + 0.022 * (wave(a, 1.3) + 1) / 2);
      const h = 0.004 * (1 - k) + rim + (k < 1 ? rnd() * 0.012 : -0.006);
      P.push(Math.cos(a) * rr, h, Math.sin(a) * rr);
      const n = (wave(a * 1.3, k * 3 + ph[3]) + 1) / 2; // 0..1, slow round the patch
      const c = k >= 1 ? soil
        : k > 0.6 ? new THREE.Color().copy(soil).lerp(n > 0.72 ? sand : crumb, n > 0.72 ? 0.45 : n * 0.6)
          : new THREE.Color().copy(moist).lerp(soil, k * 0.8 + n * 0.12);
      C.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < SEG; i++) I.push(0, 1 + ((i + 1) % SEG), 1 + i);
  for (let r = 1; r < RINGS; r++) {
    const a0 = 1 + (r - 1) * SEG, b0 = 1 + r * SEG;
    for (let i = 0; i < SEG; i++) {
      const i1 = (i + 1) % SEG;
      I.push(a0 + i, a0 + i1, b0 + i, a0 + i1, b0 + i1, b0 + i);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setIndex(I);
  g.computeVertexNormals();
  return g;
}

/** A small cloven print (a pig's trotter), flat, facing +z; 1 m before scaling. */
function printGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const P: number[] = [];
  const toe = (cx: number): void => {
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      P.push(cx, 0, 0, cx + Math.cos(a1) * 0.2, 0, Math.sin(a1) * 0.42, cx + Math.cos(a0) * 0.2, 0, Math.sin(a0) * 0.42);
    }
  };
  toe(-0.24); toe(0.24);
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.computeVertexNormals();
  return g;
}

/** One mossy cushion on the forest floor, 1 m across before scaling (the squirrel's
 *  caching spots): a low, soft dome of moss greens with a feathered rim, a few straw and
 *  brown flecks of old leaves in it — look-alikes, nothing nameable. */
function mossGeometry(seed: number): THREE.BufferGeometry {
  const rnd = stream(seed);
  const RINGS = 7, SEG = 30;
  const P: number[] = [], C: number[] = [], I: number[] = [];
  const deep = new THREE.Color('#34501f'), moss = new THREE.Color('#5c7d2c'), tip = new THREE.Color('#a3b852'), litter = new THREE.Color('#7a5a34');
  P.push(0, 0.05, 0); C.push(moss.r, moss.g, moss.b);
  const ph = [rnd() * 6.3, rnd() * 6.3, rnd() * 6.3];
  const wave = (a: number): number => Math.sin(a * 2 + ph[0]) * 0.5 + Math.sin(a * 3 + ph[1]) * 0.3 + Math.sin(a * 5 + ph[2]) * 0.2;
  for (let r = 1; r <= RINGS; r++) {
    const k = r / RINGS;
    for (let i = 0; i < SEG; i++) {
      const a = (i / SEG) * Math.PI * 2;
      const rr = 0.5 * k * (1 + wave(a) * 0.22 * k + (rnd() - 0.5) * 0.06);
      // a soft, lumpy cushion (little tufts of moss), the rim sunk into the litter
      const tuft = Math.max(0, Math.sin(a * 7 + ph[2] + k * 9) * Math.sin(a * 4 - ph[0] + k * 5));
      const h = 0.06 * Math.cos(Math.min(1, k) * Math.PI / 2) ** 1.2 + (k < 1 ? rnd() * 0.012 + tuft * 0.012 : -0.008);
      P.push(Math.cos(a) * rr, h, Math.sin(a) * rr);
      const n = rnd();
      const c = k >= 1 ? litter
        : new THREE.Color().copy(deep).lerp(moss, 0.3 + 0.5 * (1 - k) + tuft * 0.3).lerp(n > 0.88 ? litter : tip, n > 0.88 ? 0.55 : n * 0.5 + tuft * 0.25);
      C.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < SEG; i++) I.push(0, 1 + ((i + 1) % SEG), 1 + i);
  for (let r = 1; r < RINGS; r++) {
    const a0 = 1 + (r - 1) * SEG, b0 = 1 + r * SEG;
    for (let i = 0; i < SEG; i++) {
      const i1 = (i + 1) % SEG;
      I.push(a0 + i, a0 + i1, b0 + i, a0 + i1, b0 + i1, b0 + i);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setIndex(I);
  g.computeVertexNormals();
  return g;
}

/** An oak leaf lying on the ground (a flat, lobed oval), 1 m long before scaling. */
function leafGeometry(): THREE.BufferGeometry {
  const P: number[] = [];
  const N = 12;
  const at = (i: number): [number, number] => {
    const a = (i / N) * Math.PI * 2;
    const lobe = 1 + 0.18 * Math.cos(a * 5);
    return [Math.sin(a) * 0.22 * lobe, Math.cos(a) * 0.5];
  };
  for (let i = 0; i < N; i++) {
    const [x0, z0] = at(i), [x1, z1] = at(i + 1);
    P.push(0, 0.01, 0, x1, 0, z1, x0, 0, z0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.computeVertexNormals();
  return g;
}

/** A fleck of freshly scratched soil (where a squirrel just dug), flat, 1 m before scaling. */
function fleckGeometry(): THREE.BufferGeometry {
  const P: number[] = [];
  const N = 9;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
    const r0 = 0.5 * (0.8 + 0.2 * Math.sin(i * 2.7)), r1 = 0.5 * (0.8 + 0.2 * Math.sin((i + 1) * 2.7));
    P.push(0, 0, 0, Math.cos(a1) * r1, 0, Math.sin(a1) * r1, Math.cos(a0) * r0, 0, Math.sin(a0) * r0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.computeVertexNormals();
  return g;
}

/** How the spots look: turned earth with trotter prints (the frisling's rooting field),
 *  or mossy cushions in leaf litter where fresh soil shows once dug (the squirrel's glade). */
export type PatchLook = 'earth' | 'moss';

export interface PatchFieldOpts {
  parent: THREE.Object3D;
  groundY(x: number, z: number): number;
  spots: readonly (Spot & { id: number })[];
  /** each spot's size (m across) */
  size: number;
  /** which way the prints walk over each spot (a heading) */
  heading: number;
  seed: number;
  /** how they look (default 'earth') */
  look?: PatchLook;
}

export class PatchField {
  readonly group = new THREE.Group();
  readonly spots: readonly (Spot & { id: number; y: number })[];
  /** each spot's mound: what a child clicks and the play hint points at */
  readonly mounds: THREE.Mesh[] = [];
  private readonly prints: THREE.InstancedMesh;
  /** the clods and torn-up sods thrown round every patch (one draw call) */
  private readonly clods: THREE.InstancedMesh;
  private readonly state: PatchState[];
  private readonly printOn: number[];   // 0..1 each spot's fresh prints (eased)
  private readonly printWant: number[];
  private readonly glow: number[];
  private readonly glowWant: number[];
  private readonly colorDirty: boolean[];
  private readonly printBase: THREE.Matrix4[] = [];
  private readonly per = 6;             // prints per spot
  private readonly geos: THREE.BufferGeometry[] = [];
  private readonly mats: THREE.Material[] = [];

  constructor(o: PatchFieldOpts) {
    this.group.name = 'patch-field';
    const n = o.spots.length;
    this.spots = o.spots.map((s) => ({ ...s, y: o.groundY(s.x, s.z) }));
    this.state = Array(n).fill('rest');
    this.printOn = Array(n).fill(0); this.printWant = Array(n).fill(0);
    this.glow = Array(n).fill(0); this.glowWant = Array(n).fill(0);
    this.colorDirty = Array(n).fill(false);
    const moss = o.look === 'moss';
    const moundGeo = moss ? mossGeometry(o.seed) : moundGeometry(o.seed);
    const printGeo = moss ? fleckGeometry() : printGeometry();
    const printMat = new THREE.MeshStandardMaterial({ color: moss ? '#2e1f14' : '#241710', roughness: 1, transparent: true, opacity: moss ? 0.95 : 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    this.prints = new THREE.InstancedMesh(printGeo, printMat, n * this.per);
    this.prints.name = 'patch-prints';
    this.prints.renderOrder = 2;
    this.geos.push(moundGeo, printGeo);
    this.mats.push(printMat);
    const rnd = stream(o.seed + 5);
    const q = new THREE.Quaternion(), e = new THREE.Euler();
    const CLODS = moss ? 9 : 11;
    const clodGeo = moss ? leafGeometry() : new THREE.DodecahedronGeometry(1, 0);
    const clodMat = new THREE.MeshStandardMaterial({ roughness: 1, flatShading: !moss, side: moss ? THREE.DoubleSide : THREE.FrontSide });
    this.clods = new THREE.InstancedMesh(clodGeo, clodMat, n * CLODS);
    this.clods.name = 'patch-clods';
    this.clods.receiveShadow = true;
    this.geos.push(clodGeo);
    this.mats.push(clodMat);
    const earth = [new THREE.Color('#4a3727'), new THREE.Color('#5e4632'), new THREE.Color('#3b2c20')];
    const sod = new THREE.Color('#5b5a31');
    const cm = new THREE.Matrix4(), cq = new THREE.Quaternion(), ce = new THREE.Euler(), cv = new THREE.Vector3(), cs = new THREE.Vector3();
    this.spots.forEach((s, i) => {
      // tilt to the slope under it
      const r = o.size * 0.5;
      const sx = (o.groundY(s.x + r, s.z) - o.groundY(s.x - r, s.z)) / (2 * r);
      const sz = (o.groundY(s.x, s.z + r) - o.groundY(s.x, s.z - r)) / (2 * r);
      e.set(Math.atan(sz), rnd() * Math.PI * 2, -Math.atan(sx), 'XYZ');
      q.setFromEuler(e);
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
      this.mats.push(mat);
      const mound = new THREE.Mesh(moundGeo, mat);
      mound.name = `patch-${s.id}`;
      mound.position.set(s.x, s.y + 0.004, s.z);
      mound.quaternion.copy(q);
      mound.scale.set(o.size * (0.95 + rnd() * 0.1), 1, o.size * (0.85 + rnd() * 0.2));
      mound.receiveShadow = true;
      this.mounds.push(mound);
      this.group.add(mound);
      // (moss) old oak leaves lying round the cushion, brown to ochre
      if (moss) {
        const leafCol = [new THREE.Color('#8a5a2b'), new THREE.Color('#a4733a'), new THREE.Color('#6e4a26'), new THREE.Color('#9c8a4a')];
        for (let k = 0; k < CLODS; k++) {
          const a = rnd() * Math.PI * 2;
          const rr = o.size * (0.42 + rnd() * 0.38);
          const cx = s.x + Math.cos(a) * rr, cz = s.z + Math.sin(a) * rr;
          const size = o.size * (0.12 + rnd() * 0.08);
          ce.set((rnd() - 0.5) * 0.25, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.25);
          cq.setFromEuler(ce);
          cs.set(size, 1, size);
          cv.set(cx, o.groundY(cx, cz) + 0.012, cz);
          cm.compose(cv, cq, cs);
          this.clods.setMatrixAt(i * CLODS + k, cm);
          this.clods.setColorAt(i * CLODS + k, leafCol[Math.floor(rnd() * leafCol.length)]);
        }
      }
      // clods thrown out round the rim, and a few torn-up sods (grass side up)
      for (let k = 0; k < (moss ? 0 : CLODS); k++) {
        const a = rnd() * Math.PI * 2;
        const turf = k < 3;
        const rr = o.size * (0.36 + rnd() * 0.3);
        const cx = s.x + Math.cos(a) * rr, cz = s.z + Math.sin(a) * rr;
        const size = o.size * (turf ? 0.07 + rnd() * 0.04 : 0.028 + rnd() * 0.04);
        const flat = turf ? 0.32 : 0.55 + rnd() * 0.25;
        ce.set((rnd() - 0.5) * 0.5, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.5);
        cq.setFromEuler(ce);
        cs.set(size * (turf ? 1.4 : 1), size * flat, size);
        cv.set(cx, o.groundY(cx, cz) + size * flat * 0.62, cz); // resting on the heath, never floating
        cm.compose(cv, cq, cs);
        this.clods.setMatrixAt(i * CLODS + k, cm);
        this.clods.setColorAt(i * CLODS + k, turf ? sod : earth[Math.floor(rnd() * earth.length)]);
      }
      // its prints: a few trotter marks walking over it (moss: flecks of fresh soil where
      // it was dug, scattered in its middle)
      for (let k = 0; k < this.per; k++) {
        const t = (k / (this.per - 1) - 0.5) * o.size * 0.8;
        const side = k % 2 ? 0.07 : -0.07;
        const fx = Math.sin(o.heading), fz = Math.cos(o.heading);
        const fa = k * 2.4 + i, fr = moss ? o.size * (k ? 0.1 + 0.05 * (k % 3) : 0) : 0;
        const px = moss ? s.x + Math.cos(fa) * fr : s.x + fx * t - fz * side;
        const pz = moss ? s.z + Math.sin(fa) * fr : s.z + fz * t + fx * side;
        const fs = moss ? o.size * (k ? 0.12 : 0.34) : 0.1;
        const pm = new THREE.Matrix4().compose(
          new THREE.Vector3(px, o.groundY(px, pz) + (moss ? 0.058 : 0.045), pz),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), moss ? fa : o.heading),
          new THREE.Vector3(fs, 1, fs),
        );
        this.printBase.push(pm);
        this.prints.setMatrixAt(i * this.per + k, new THREE.Matrix4().makeScale(0, 0, 0));
      }
    });
    this.clods.instanceMatrix.needsUpdate = true;
    if (this.clods.instanceColor) this.clods.instanceColor.needsUpdate = true;
    this.clods.computeBoundingSphere();
    this.group.add(this.clods);
    this.prints.instanceMatrix.needsUpdate = true;
    this.prints.computeBoundingSphere();
    this.prints.frustumCulled = false; // (its instances start at scale 0: no honest sphere)
    this.prints.visible = false;       // (drawn only while a spot shows its prints: an empty draw costs a call too)
    this.group.add(this.prints);
    o.parent.add(this.group);
  }

  /** The spot a mound mesh is (for a pick), or null. */
  indexOf(o: THREE.Object3D): number | null {
    const i = this.mounds.indexOf(o as THREE.Mesh);
    return i >= 0 ? i : null;
  }

  /** Light a spot for the show (a warm glow + fresh prints), or put it back. */
  show(i: number, on: boolean): void {
    this.state[i] = on ? 'show' : 'rest';
    this.colorDirty[i] = true;
    this.glowWant[i] = on ? 1 : 0;
    this.printWant[i] = on ? 1 : 0;
  }

  /** Every spot back at rest. */
  clear(): void {
    for (let i = 0; i < this.spots.length; i++) { this.state[i] = 'rest'; this.glowWant[i] = 0; this.printWant[i] = 0; this.colorDirty[i] = true; }
  }

  /** A calm mark on a spot the recall reached ('ok'), or a soft one for a wrong one. */
  mark(i: number, s: 'ok' | 'wrong' | 'rest'): void {
    this.state[i] = s;
    this.colorDirty[i] = true;
    this.glowWant[i] = s === 'rest' ? 0 : 1;
    this.printWant[i] = s === 'ok' ? 0.6 : 0;
  }

  /** The spot whose middle is nearest (x, z), if within `r` m. */
  nearest(x: number, z: number, r: number): number | null {
    let best: number | null = null, bd = r;
    this.spots.forEach((s, i) => { const d = Math.hypot(s.x - x, s.z - z); if (d < bd) { bd = d; best = i; } });
    return best;
  }

  /** Per frame: the glows and the prints ease in and out (a cut under reduced motion). */
  update(dt: number, reduced: boolean): void {
    let prints = false;
    const m = new THREE.Matrix4();
    for (let i = 0; i < this.spots.length; i++) {
      const k = reduced ? 1 : Math.min(1, dt * 7);
      const g = this.glow[i] + (this.glowWant[i] - this.glow[i]) * k;
      if (Math.abs(g - this.glow[i]) > 1e-4 || this.colorDirty[i]) {
        this.glow[i] = g;
        this.colorDirty[i] = false;
        const to = this.state[i] === 'ok' ? OK : this.state[i] === 'wrong' ? WRONG : SHOW;
        (this.mounds[i].material as THREE.MeshStandardMaterial).color.copy(REST).lerp(to, g);
      }
      const p = this.printOn[i] + (this.printWant[i] - this.printOn[i]) * k;
      if (Math.abs(p - this.printOn[i]) > 1e-4) {
        this.printOn[i] = p;
        for (let j = 0; j < this.per; j++) {
          // the prints appear one after another, as if walked there just now
          const t = Math.max(0, Math.min(1, p * this.per - j * 0.6));
          const base = this.printBase[i * this.per + j];
          m.copy(base).multiply(new THREE.Matrix4().makeScale(t, 1, t));
          this.prints.setMatrixAt(i * this.per + j, t > 0 ? m : new THREE.Matrix4().makeScale(0, 0, 0));
        }
        prints = true;
      }
    }
    if (prints) {
      this.prints.instanceMatrix.needsUpdate = true;
      this.prints.visible = this.printOn.some((p) => p > 1e-3);
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    this.prints.dispose();
    this.clods.dispose();
    for (const g of this.geos) g.dispose();
    for (const mm of this.mats) mm.dispose();
  }
}
