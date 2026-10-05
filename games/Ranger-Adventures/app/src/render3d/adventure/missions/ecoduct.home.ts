/**
 * ecoduct.home.ts — the ecoduct's home in the world, built with the world (the THREE half of
 * ecoduct.places.ts): a raked SAND BED in front of the ecoduct's mouth (pale sand, the rake's
 * furrows across it, seven look-alike trodden patches in it: the corsi spots), a low wooden
 * WILDLIFE SCREEN five metres east of it (planks on two posts, a slit at a child's eye), the
 * trodden TRAILS that come round the ecoduct's two ends down to the bed and the first
 * stretch of the ways out, and the TRACKS the crossings leave in the sand.
 *
 * It stands before the mission and after it (a place, not a prop that vanishes): before, the
 * bed lies raked smooth with a few old slots from last night; after a play it keeps the
 * tracks that play's groups left (a finish or a stop in front of him changes nothing in the
 * sand); a reload (or a home laid while he is away) shows a fixed after set — a deer family,
 * a sow with her piglets, a fox. A play rakes it smooth under the briefing card (`rake`) and
 * treads it as the groups cross (`tread`) — never along a route he must still point back
 * (the script treads a route's crossings once the route is done).
 *
 * Draw calls: the sand, the screen, the trails, the tracks (two kinds) and the patches (one
 * at rest): ~6 when near. The patches rest by their own spot (`env.detail`).
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { DressingEnv, HomeDressing } from '../../world/Residents';
import type { HomeState, Spot } from '../types';
import { PatchField } from '../patches';
import { groundStrip } from '../decal';
import { atLocal, dist, stream, toLocal } from '../places';
import {
  BED, BED_HALF, EXITS, PATCH_SIZE, SCREEN, SIDES, TRAILS, bedSpots, crossingLine, onBed, screenObstacle, type Kind, type Side,
} from './ecoduct.places';

/** How far (m) over the ground the raked sand lies, and the patches over it. */
const SAND_UP = 0.008;
const PATCH_UP = 0.02;
/** The sand's soft rim (m): it fades into the heath. */
const FEATHER = 0.4;
/** One rake furrow every (m), across the bed. */
const FURROW = 0.125;

/** The raked sand: pale, a little grey-yellow sand with the rake's fine furrows (soft, never
 *  ruled lines: each wanders, fades and breaks off), grains, a few darker damp patches (a
 *  texture drawn once). */
function rakeTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const c = cv.getContext('2d');
  if (!c) return null;
  const rnd = stream(41);
  c.fillStyle = '#c2b08b';
  c.fillRect(0, 0, S, S);
  // soft damp and dry patches (big, faint)
  for (let i = 0; i < 14; i++) {
    const x = rnd() * S, y = rnd() * S, r = 30 + rnd() * 60;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    const dark = rnd() < 0.55;
    g.addColorStop(0, dark ? 'rgba(140,122,92,0.16)' : 'rgba(232,220,190,0.14)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { c.save(); c.translate(dx, dy); c.fillRect(x - r, y - r, 2 * r, 2 * r); c.restore(); }
  }
  // the furrows: a faint shadowed groove and a lit ridge beside it, wandering, fading in and
  // out along their length (a hand rake pulled across)
  const n = Math.round(1 / FURROW); // per tile (1 m)
  for (let k = 0; k < n; k++) {
    const y0 = ((k + 0.5) / n) * S + (rnd() - 0.5) * 6;
    const ph = rnd() * 6.3;
    for (const [dy, rgb, w, a0] of [[0, '110,92,62', 2.4, 0.22], [2.6, '246,236,212', 1.6, 0.2]] as const) {
      c.lineWidth = w;
      let px = 0, py = y0 + dy;
      for (let x = 6; x <= S; x += 6) {
        const y = y0 + dy + Math.sin((x / S) * Math.PI * 2 + ph) * 2.2 + Math.sin((x / S) * Math.PI * 6 + ph * 2) * 0.8;
        const a = a0 * (0.35 + 0.65 * Math.max(0, Math.sin((x / S) * Math.PI * 2 * 1 + ph * 3 + k)));
        c.strokeStyle = `rgba(${rgb},${a.toFixed(3)})`;
        c.beginPath(); c.moveTo(px, py); c.lineTo(x, y); c.stroke();
        px = x; py = y;
      }
    }
  }
  // grain: fine lighter and darker flecks
  for (let i = 0; i < 1400; i++) {
    const x = rnd() * S, y = rnd() * S, r = 0.5 + rnd() * 1.1;
    c.fillStyle = rnd() < 0.5 ? 'rgba(120,104,78,0.25)' : 'rgba(244,234,210,0.3)';
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** The bed's raked sand: a grid draped over the ground, its rim fading into the heath. */
function sandMesh(g: (x: number, z: number) => number): THREE.Mesh {
  const hu = BED_HALF.u + FEATHER, hv = BED_HALF.v + FEATHER;
  const NU = 26, NV = 20;
  const pos: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = [];
  for (let j = 0; j <= NV; j++) {
    for (let i = 0; i <= NU; i++) {
      const u = -hu + (2 * hu * i) / NU, v = -hv + (2 * hv * j) / NV;
      const p = atLocal(BED, u, v);
      pos.push(p.x, g(p.x, p.z) + SAND_UP, p.z);
      // furrows run across the bed (along u): the texture's x along u, y along v
      uv.push(u, v / (FURROW * Math.round(1 / FURROW)));
      // the rim fades out over FEATHER (a slightly wavy edge, never a ruled rectangle)
      const wob = 0.12 * Math.sin(u * 2.3 + v * 1.1) + 0.08 * Math.cos(v * 3.1 - u);
      const eu = (hu - Math.abs(u)) / FEATHER, ev = (hv - Math.abs(v)) / FEATHER;
      const a = Math.max(0, Math.min(1, Math.min(eu, ev) + wob));
      const shade = 1 - 0.05 * Math.sin(u * 1.3) * Math.cos(v * 1.7);
      col.push(shade, shade, shade, a * a * (3 - 2 * a));
    }
  }
  for (let j = 0; j < NV; j++) {
    for (let i = 0; i < NU; i++) {
      const a = j * (NU + 1) + i, b = a + NU + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  if ((geo.attributes.normal as THREE.BufferAttribute).getY(0) < 0) { geo.setIndex(idx.slice().reverse()); geo.computeVertexNormals(); }
  const map = rakeTexture();
  const mat = new THREE.MeshStandardMaterial({
    color: map ? '#ffffff' : '#cbb68e', map, vertexColors: true, transparent: true, depthWrite: false, roughness: 1,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const m = new THREE.Mesh(geo, mat);
  m.name = 'ecoduct-sand';
  m.renderOrder = 2;
  m.receiveShadow = true;
  return m;
}

/** A box (w across, h high, d deep) at local (x, y, z), its own colour, into `out`. */
function plank(out: THREE.BufferGeometry[], w: number, h: number, d: number, x: number, y: number, z: number, color: THREE.Color, tilt = 0): void {
  const b = new THREE.BoxGeometry(w, h, d);
  if (tilt) b.rotateZ(tilt);
  b.translate(x, y, z);
  const n = b.attributes.position.count;
  const c: number[] = [];
  for (let i = 0; i < n; i++) {
    // a little grain along the plank (its vertices' x), never a flat colour
    const k = 0.93 + 0.07 * Math.sin((b.attributes.position.getX(i) + y * 7) * 3.1);
    c.push(color.r * k, color.g * k, color.b * k);
  }
  b.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  out.push(b.index ? b.toNonIndexed() : b);
  b.dispose();
}

/** The wildlife screen: a low wall of upright boards between two posts, a slit across it at
 *  a child's eye height (the boards above and below it), a rail along its top; a little
 *  weathered (one geometry, one draw call). Local: x across, +z toward the bed. */
function screenMesh(g: (x: number, z: number) => number): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = [];
  const rnd = stream(17);
  const wood = ['#8b6b48', '#7d5f3f', '#94744f', '#86683f', '#7a5c3c'].map((c) => new THREE.Color(c));
  const [s0, s1] = SCREEN.slit;
  const top = SCREEN.h;
  // the posts (into the ground a little)
  for (const sx of [-1, 1]) plank(parts, 0.1, top + 0.32, 0.1, sx * (SCREEN.halfW - 0.05), (top + 0.32) / 2 - 0.12, -0.02, new THREE.Color('#6a4f34'));
  // two rails behind the boards (they hold them), one under the slit, one under the top
  for (const y of [0.32, s0 - 0.06, s1 + 0.07]) plank(parts, SCREEN.halfW * 2 - 0.1, 0.07, 0.045, 0, y, -0.035, new THREE.Color('#6e5236'));
  // the upright boards: below the slit and above it, each its own width and shade
  const BW = 0.135;
  for (let x = -SCREEN.halfW + 0.1 + BW / 2; x < SCREEN.halfW - 0.1; x += BW + 0.012) {
    const col = wood[Math.floor(rnd() * wood.length)];
    const lo = s0 - 0.04 + (rnd() - 0.5) * 0.03;
    plank(parts, BW, lo, 0.026, x, lo / 2 + 0.02, 0.015, col, (rnd() - 0.5) * 0.01);
    const hi = top - s1;
    plank(parts, BW, hi, 0.026, x, s1 + hi / 2, 0.015, col);
  }
  // a cap along the top (rain runs off it)
  plank(parts, SCREEN.halfW * 2 + 0.06, 0.035, 0.09, 0, top + 0.018, 0.0, new THREE.Color('#634a31'));
  const geo = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }));
  m.name = 'ecoduct-screen';
  m.position.set(SCREEN.x, g(SCREEN.x, SCREEN.z) - 0.04, SCREEN.z);
  // its boards run across his view (local x along the bed's u), its face toward the bed (+z)
  m.rotation.y = SCREEN.heading;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** A hoof's slot in the sand (two half-moons, a deer's, a boar's or a roe's), flat, +z ahead,
 *  1 m before scaling. */
function slotGeometry(): THREE.BufferGeometry {
  const P: number[] = [];
  const toe = (cx: number): void => {
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      const r = (a: number): [number, number] => [cx + Math.cos(a) * 0.19, Math.sin(a) * 0.46 + (Math.sin(a) > 0 ? 0.04 : 0)];
      const [x0, z0] = r(a0), [x1, z1] = r(a1);
      P.push(cx, 0, 0.02, x1, 0, z1, x0, 0, z0);
    }
  };
  toe(-0.22); toe(0.22);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.computeVertexNormals();
  return g;
}
/** A paw (a fox's, a badger's): a pad and four toes, flat, +z ahead, 1 m before scaling. */
function pawGeometry(): THREE.BufferGeometry {
  const P: number[] = [];
  const blob = (cx: number, cz: number, rx: number, rz: number): void => {
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      P.push(cx, 0, cz, cx + Math.cos(a1) * rx, 0, cz + Math.sin(a1) * rz, cx + Math.cos(a0) * rx, 0, cz + Math.sin(a0) * rz);
    }
  };
  blob(0, -0.12, 0.28, 0.24);
  for (const [x, z] of [[-0.3, 0.2], [-0.11, 0.38], [0.11, 0.38], [0.3, 0.2]]) blob(x, z, 0.1, 0.12);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.computeVertexNormals();
  return g;
}

/** How big each kind's prints are (m), how far apart its steps (m), how wide its two lines. */
const PRINT: Readonly<Record<Kind | 'das', { s: number; step: number; gauge: number; paw: boolean }>> = {
  hert: { s: 0.11, step: 0.62, gauge: 0.13, paw: false },
  zwijn: { s: 0.085, step: 0.4, gauge: 0.12, paw: false },
  ree: { s: 0.075, step: 0.48, gauge: 0.1, paw: false },
  vos: { s: 0.065, step: 0.36, gauge: 0.05, paw: true },
  das: { s: 0.07, step: 0.3, gauge: 0.12, paw: true },
};
/** Room for this many lasting prints of each shape. */
const PRINTS_MAX = 900;

/** One kind of lasting prints in the sand (one instanced mesh), filled as groups cross. */
class Prints {
  readonly mesh: THREE.InstancedMesh;
  count = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly UP = new THREE.Vector3(0, 1, 0);
  constructor(geo: THREE.BufferGeometry, color: string, name: string) {
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({
      color, roughness: 1, transparent: true, opacity: 0.72, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    }), PRINTS_MAX);
    this.mesh.name = name;
    this.mesh.count = 0;
    this.mesh.renderOrder = 3;
    this.mesh.frustumCulled = false; // (its instances come and go: the bed is small and near)
  }
  add(x: number, y: number, z: number, yaw: number, s: number): void {
    if (this.count >= PRINTS_MAX) return;
    this.m.compose(new THREE.Vector3(x, y, z), this.q.setFromAxisAngle(this.UP, yaw), new THREE.Vector3(s, 1, s));
    this.mesh.setMatrixAt(this.count++, this.m);
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.visible = this.count > 0;
  }
  clear(): void { this.count = 0; this.mesh.count = 0; this.mesh.visible = false; }
}

/** The tracks the after state shows (a reload too): a deer family and a sow with her piglets
 *  over the bed, a fox along its edge. */
const AFTER_TRACKS: readonly { kind: Kind; from: Side; out: Side; n: number }[] = [
  { kind: 'hert', from: 'N', out: 'S', n: 2 }, { kind: 'zwijn', from: 'S', out: 'N', n: 3 }, { kind: 'vos', from: 'N', out: 'N', n: 1 },
];
/** …and before: a few old slots from last night, at the bed's far edge. */
const BEFORE_TRACKS: readonly { kind: Kind; from: Side; out: Side; n: number }[] = [{ kind: 'ree', from: 'S', out: 'S', n: 1 }];

export class EcoductHome implements HomeDressing {
  readonly group = new THREE.Group();
  /** the bed's seven patches (the route's spots) */
  readonly field: PatchField;
  private readonly g: (x: number, z: number) => number;
  private readonly slots: Prints;
  private readonly paws: Prints;
  private readonly made: { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[] }[] = [];
  /** a play raked the bed (under its briefing card) */
  private laid = false;
  /** …and its groups left tracks in it since */
  private trodden = false;

  constructor(env: DressingEnv) {
    this.group.name = 'ecoduct-home';
    env.parent.add(this.group);
    const g = env.groundY;
    this.g = g;
    const keep = <T extends THREE.Mesh | THREE.InstancedMesh>(m: T, parent: THREE.Object3D = this.group): T => {
      parent.add(m);
      this.made.push(m);
      return m;
    };
    /* -- the trodden trails round the ecoduct's ends and the first stretch of the ways out
       (one mesh, its sides and ends fading into the heath) -- */
    const strips: THREE.BufferGeometry[] = [];
    SIDES.forEach((s, i) => {
      for (const [line, half, seed] of [[TRAILS[s], 0.42, 3 + i], [EXITS[s].slice(0, 3), 0.36, 7 + i]] as const) {
        const m = groundStrip(g, line, half, '#a08b66', { layer: 1, wobble: 0.3, seed, ends: 1.6 });
        strips.push(m.geometry);
        (m.material as THREE.Material).dispose();
      }
    });
    const trailGeo = mergeGeometries(strips);
    for (const q of strips) q.dispose();
    if (trailGeo) {
      const trails = keep(new THREE.Mesh(trailGeo, new THREE.MeshStandardMaterial({
        vertexColors: true, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      })));
      trails.name = 'ecoduct-trails';
      trails.renderOrder = 1;
      trails.receiveShadow = true;
    }
    /* -- the raked sand bed -- */
    keep(sandMesh(g));
    /* -- the screen (solid: the ranger and the animals go round it) -- */
    keep(screenMesh(g));
    env.obstacles.push(screenObstacle());
    /* -- the seven patches (they rest by their own spot: specks from further off) -- */
    const small = env.detail({ x: BED.x, z: BED.z });
    this.field = new PatchField({
      parent: small, groundY: (x, z) => g(x, z) + PATCH_UP, spots: bedSpots(), size: PATCH_SIZE,
      heading: BED.heading + Math.PI / 2, seed: 29, look: 'sand', instancedRest: true,
    });
    /* -- the lasting tracks (two shapes) -- */
    this.slots = new Prints(slotGeometry(), '#6a573c', 'ecoduct-slots');
    this.paws = new Prints(pawGeometry(), '#6a573c', 'ecoduct-paws');
    small.add(this.slots.mesh, this.paws.mesh);
    this.made.push(this.slots.mesh, this.paws.mesh);
    this.layTracks(BEFORE_TRACKS);
  }

  /** A new play: the bed raked smooth (no tracks), under the briefing card. */
  rake(): void {
    this.slots.clear();
    this.paws.clear();
    this.field.clear();
    this.laid = true;
    this.trodden = false;
  }

  /** A group crossed along `line` (its trail, its way over the bed, its way out): the tracks
   *  it leaves in the sand (and the trodden trail's soft ground), `n` animals of `kind`. */
  tread(line: readonly Spot[], kind: Kind | 'das', n = 1, seed = 1): void {
    const pr = PRINT[kind];
    const into = pr.paw ? this.paws : this.slots;
    if (this.laid) this.trodden = true;
    const rnd = stream(seed * 131 + n * 7);
    for (let a = 0; a < n; a++) {
      // each animal a little to the side of the one before (a family walks in file, loosely)
      const off = (a - (n - 1) / 2) * 0.32 + (rnd() - 0.5) * 0.1;
      const sc = pr.s * (a === 0 ? 1 : kind === 'zwijn' ? 0.55 : kind === 'hert' || kind === 'ree' ? 0.75 : 1);
      let side = 1;
      for (let i = 1; i < line.length; i++) {
        const p = line[i - 1], q = line[i];
        const L = dist(p, q);
        if (L < 1e-3) continue;
        const fx = (q.x - p.x) / L, fz = (q.z - p.z) / L, yaw = Math.atan2(fx, fz);
        for (let t = rnd() * pr.step; t < L; t += pr.step * (0.92 + rnd() * 0.16)) {
          side = -side;
          const w = off + side * pr.gauge * 0.5;
          const x = p.x + fx * t - fz * w, z = p.z + fz * t + fx * w;
          // prints show in the bed's sand and a little way onto the trails, not out on the heath
          if (!onBed({ x, z }, 0.25)) continue;
          into.add(x, this.g(x, z) + PATCH_UP + 0.004, z, yaw + (rnd() - 0.5) * 0.25, sc * (0.92 + rnd() * 0.16));
        }
      }
    }
  }

  /** A state's own tracks (before: a few old ones; after: the crossing's). */
  private layTracks(list: readonly { kind: Kind; from: Side; out: Side; n: number }[]): void {
    this.slots.clear();
    this.paws.clear();
    list.forEach((c, i) => this.tread(crossingLine(c.from, c.out), c.kind, c.n, 50 + i));
  }

  /** The home's state: a finish or a stop in front of him (`fresh`) after a play whose groups
   *  trod the bed keeps the tracks they left — nothing in the sand changes while he stands
   *  by it; a reload, a cut, or a play left before anything crossed lays the state's set. */
  setState(state: HomeState, fresh = false): void {
    const keep = fresh && this.laid && this.trodden;
    this.laid = false;
    this.trodden = false;
    this.field.clear();
    if (!keep) this.layTracks(state === 'after' ? AFTER_TRACKS : BEFORE_TRACKS);
  }

  update(dt: number, _t: number, reduced: boolean): void {
    this.field.update(dt, reduced);
  }

  dispose(): void {
    this.field.dispose();
    for (const m of this.made) {
      (m as unknown as THREE.Object3D).removeFromParent();
      m.geometry.dispose();
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mt of mats) { (mt as THREE.MeshStandardMaterial).map?.dispose(); mt.dispose(); }
    }
    this.group.removeFromParent();
  }
}

/** (where the bed's frame puts a spot: for the script's views) */
export { atLocal, toLocal };
