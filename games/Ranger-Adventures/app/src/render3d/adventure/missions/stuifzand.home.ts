/**
 * stuifzand.home.ts — the drift sand's home in the world, built with the world (the THREE half
 * of stuifzand.places.ts): wind ripples over the pale sand, dead pine twigs, cones and bark
 * pieces lying about, buntgras tufts at three scrapes where nightjars may breed, the car's
 * tyre tracks up the sand path and off its end over the sand (this play's route, with gaps
 * where the wind blew sand over them), a juniper with a rabbit's burrow under its skirt facing
 * a bright stretch of open sand (the guard place), an anthill at the sand's edge, and the
 * nightjars themselves (`Nightjar`: a bird that presses flat on its eggs, flutters up, drags a
 * wing along the sand to lead a boy away, flies, and — at dusk, now and then — claps its wings).
 *
 * It stands before the mission and after it (a place, not a prop that vanishes): the tracks of
 * the last play stay (the season's clue), the pair breeds at the last play's scrape. A play
 * is laid under the briefing card (`lay`): its route and where the wind covered it, how dark
 * the ruts are (the level's), the trial's look-alikes on this scrape's slots, the tufts round
 * her spot fitted to the level's glimpse for the search's lens, her eggs under her.
 *
 * Draw calls when near: the ground (ripples, the open sand, the burrow's fan) 1, the tracks 1,
 * the lying things (twigs, cones, bark, the dead branches, the burrow's mound) 1, the tufts 1,
 * the look-alikes 3 (+ a butterfly and a stonechat when a play lays them), the juniper, the
 * anthill, the eggs; the names over the places only while he guards.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { DressingEnv, HomeDressing } from '../../world/Residents';
import type { HomeState, ResidentSpec, Spot } from '../types';
import { Actor, type ActorEnv } from '../actors';
import { CoverField } from '../cover';
import { backPoints, type V3 } from '../cover-math';
import { fitWindow, refitWindow, type Built } from './ree.window';
import { groundDecal, groundStrip } from '../decal';
import { heatherGeometry, plantMaterial } from '../../world/Plants';
import { calmGate } from '../../ProceduralMotion';
import { SIZE } from '../../AnimalScale';
import { Seen, boxOf } from './ven.finds';
import {
  ANTHILL, BURROW, GAPS_FROM, HOL_JUNIPER, MISSION, NESTS, NEST_IDS, OPEN, PASSES, PRESSED_H, SETTLE, STOP, TAG_AT, ZONES, ZWALUW_H, ZWALUW_LEN,
  allClumps, approachOf, COVER_SEED, dist, gapsTo, headingTo, lineOf, nestNowOf, pointAt, routeOf, RUT, RUT_W, rutAlpha, slotsOf,
  type Line, type NestId, type Pass, type ViewSpec, type ZandLaid,
} from './stuifzand.places';

/* ------------------------------------------------------------ a play ---- */

/** What a play lays in the home (stuifzand.ts `prepare`). */
export interface ZandPlay {
  laid: ZandLaid;
  /** the zoeken trial's look-alikes on this scrape's slots (content id, kind, where) */
  decoys: readonly { id: string; k: string; x: number; z: number }[];
  /** the level's share of her that shows (the trial's glimpse) */
  glimpse: number;
  /** where the wind blew sand over the tracks (m along the route) */
  gaps: readonly { s: number; len: number }[];
  /** the level's trail clarity (how dark the ruts are) */
  clarity: number;
}

/** A look-alike of the play's scrape, as the search takes it. */
export interface ZandDecoy { id: string; k: string; object: THREE.Object3D; x: number; z: number; poke: () => void }

/** The look-alike a 'bush' decoy of the content is on the sand: a lump of bark, a dead branch
 *  stub, a cluster of cones — each about her size and her colours. */
type LookKind = 'schors' | 'stomp' | 'kegels';
const LOOK_OF: readonly LookKind[] = ['schors', 'stomp', 'kegels'];
/** The 'bush' decoy ids in content order → their look (s1 bark, s2 a stub, s3 cones …). */
function lookOf(id: string): LookKind {
  const n = Number.parseInt(id.replace(/\D/g, ''), 10);
  return LOOK_OF[((Number.isFinite(n) ? n : 1) - 1) % LOOK_OF.length];
}
/** In free roam a few look-alikes lie at each scrape (slot index, look): just sand things. */
const FREE: readonly [number, LookKind][] = [[0, 'schors'], [3, 'stomp'], [5, 'kegels'], [7, 'schors']];

/* ------------------------------------------------------------ colours ---- */

const SAND = { crest: '#f1e7c9', trough: '#bba97f', open: '#f2dca6', openMid: '#f5e3b5' } as const;
/** Her mottled grey-brown (the model's own) — the look-alikes are made of the same browns. */
const LOOK = { bark: ['#7d6a52', '#4f3f30', '#a8916f'], wood: ['#8a7d68', '#5b5040', '#b3a588'], cone: ['#6f5238', '#4a3626', '#937155'] } as const;

/* ------------------------------------------------------- small geometry ---- */

const _c = new THREE.Color();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** A small deterministic stream. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Paint a geometry's vertices from a few colours, mottled (vertex colours, RGB). */
function paint(geo: THREE.BufferGeometry, cols: readonly string[], seed: number, mottle = 0.5): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const n = g.attributes.position.count;
  const r = rng(seed);
  const out = new Float32Array(n * 3);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < n; i++) {
    // (a blotch pattern by position: neighbouring vertices share it, so it reads as mottling)
    const k = Math.abs(Math.sin(pos.getX(i) * 37 + pos.getY(i) * 53 + pos.getZ(i) * 29 + seed)) * cols.length;
    _c.set(cols[Math.min(cols.length - 1, Math.floor(k))]);
    const v = 1 + (r() - 0.5) * mottle * 0.4;
    out[i * 3] = _c.r * v; out[i * 3 + 1] = _c.g * v; out[i * 3 + 2] = _c.b * v;
  }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  g.computeVertexNormals();
  return g;
}

/** A crooked dead stick `len` m long (a few tapered segments, a side twig), lying along +x. */
function stickGeometry(len: number, thick: number, seed: number): THREE.BufferGeometry {
  const r = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  let x = -len / 2, y = thick * 0.6, a = (r() - 0.5) * 0.3;
  const n = 3;
  for (let i = 0; i < n; i++) {
    const l = len / n;
    const t0 = thick * (1 - i * 0.18), t1 = thick * (1 - (i + 1) * 0.18);
    const seg = new THREE.CylinderGeometry(t1, t0, l, 5, 1).rotateZ(-Math.PI / 2 + a).translate(x + (Math.cos(a) * l) / 2, y + (Math.sin(a) * l) / 2, 0);
    parts.push(seg);
    x += Math.cos(a) * l; y += Math.sin(a) * l; a += (r() - 0.5) * 0.5;
    y = Math.max(thick * 0.5, Math.min(thick * 1.6, y));
    if (i === 1) {
      const sl = len * 0.28, sa = 0.7 * (r() < 0.5 ? 1 : -1);
      parts.push(new THREE.CylinderGeometry(thick * 0.35, thick * 0.5, sl, 4, 1).rotateZ(-Math.PI / 2).rotateY(sa).translate(x + Math.cos(sa) * sl * 0.45, y, -Math.sin(sa) * sl * 0.45));
    }
  }
  const g = mergeGeometries(parts.map((p) => p.toNonIndexed()))!;
  parts.forEach((p) => p.dispose());
  return g;
}

/** A pine cone `len` m long lying on its side along +x (an ellipsoid with scale ridges). */
function coneGeometry(len: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(0.5, 8, 6);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ridge = 1 + 0.12 * Math.sin(y * 18);
    pos.setXYZ(i, y * len, x * len * 0.62 * ridge + len * 0.31, z * len * 0.62 * ridge);
  }
  return g;
}

/** A curled piece of pine bark `len` × `wid` m (a bent, thick plate), lying flat. */
function barkGeometry(len: number, wid: number, seed: number): THREE.BufferGeometry {
  const r = rng(seed);
  const g = new THREE.BoxGeometry(len, wid * 0.32, wid, 5, 1, 3);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const curl = (z / (wid / 2)) ** 2 * wid * 0.22;
    const rough = Math.sin(x * 41 + seed) * 0.006 + (r() - 0.5) * 0.004;
    pos.setXYZ(i, x * (1 - 0.18 * Math.abs(z / wid)), y + curl + rough + wid * 0.16, z);
  }
  return g;
}

/** The look-alike shapes (her size: ~0.3 m long, ~0.1 m high). */
function lookGeometry(kind: LookKind): THREE.BufferGeometry {
  if (kind === 'schors') {
    const a = barkGeometry(0.3, 0.16, 3), b = barkGeometry(0.16, 0.1, 5).rotateY(0.7).translate(0.07, 0.03, 0.04);
    const g = mergeGeometries([a.toNonIndexed(), b.toNonIndexed()])!;
    return paint(g, LOOK.bark, 11, 0.8);
  }
  if (kind === 'stomp') {
    const a = stickGeometry(0.32, 0.045, 7), b = stickGeometry(0.18, 0.028, 9).rotateY(0.9).translate(0.04, 0.02, 0.05);
    const g = mergeGeometries([a, b])!;
    return paint(g, LOOK.wood, 13, 0.7);
  }
  const c1 = coneGeometry(0.11).rotateY(0.4).translate(-0.06, 0, 0.02);
  const c2 = coneGeometry(0.1).rotateY(-0.9).translate(0.05, 0, -0.03);
  const c3 = coneGeometry(0.09).rotateY(2.1).translate(0.02, 0, 0.07);
  const g = mergeGeometries([c1.toNonIndexed(), c2.toNonIndexed(), c3.toNonIndexed()])!;
  return paint(g, LOOK.cone, 17, 0.6);
}

/* --------------------------------------------------------------- tracks ---- */

/** How long one tread pattern repeats along a rut (m). */
const TREAD_M = 0.32;
let treadTex: THREE.CanvasTexture | null = null;
/** A tyre's tread pressed into sand: chevrons of darker lugs on a pressed, darker band. */
function treadTexture(): THREE.CanvasTexture | null {
  if (treadTex) return treadTex;
  if (typeof document === 'undefined') return null;
  const S = 64;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const c = cv.getContext('2d');
  if (!c) return null;
  c.fillStyle = '#a99472';
  c.fillRect(0, 0, S, S);
  c.strokeStyle = '#7f6c4e';
  c.lineWidth = 7;
  c.lineCap = 'round';
  for (const y0 of [8, 40]) {
    c.beginPath(); c.moveTo(6, y0 + 14); c.lineTo(S / 2, y0); c.lineTo(S - 6, y0 + 14); c.stroke();
  }
  // a little grain
  const r = rng(5);
  for (let i = 0; i < 120; i++) { c.fillStyle = r() < 0.5 ? 'rgba(80,66,46,0.18)' : 'rgba(225,210,175,0.16)'; c.fillRect(r() * S, r() * S, 2, 2); }
  treadTex = new THREE.CanvasTexture(cv);
  treadTex.colorSpace = THREE.SRGBColorSpace;
  treadTex.wrapS = treadTex.wrapT = THREE.RepeatWrapping;
  treadTex.anisotropy = 4;
  return treadTex;
}

/** One route's two ruts: a strip each side of the car's line, its tread along it (uv), its
 *  alpha per row (`rowS`: m along the line of each row: the gaps fade it there). */
interface Ruts { mesh: THREE.Mesh; rowS: number[]; ends: number[]; line: Line }
function rutsOf(g: (x: number, z: number) => number, line: Line): Omit<Ruts, 'mesh'> & { geo: THREE.BufferGeometry } {
  const STEP = 0.12;
  const rows = Math.ceil(line.length / STEP);
  const pos: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = [];
  const rowS: number[] = [], ends: number[] = [];
  const ACROSS = [-1, -0.4, 0.4, 1];
  for (const side of [-1, 1]) {
    const base = pos.length / 3;
    for (let r = 0; r <= rows; r++) {
      const s = Math.min(line.length, r * STEP);
      const a = pointAt(line, s - 0.3), b = pointAt(line, s + 0.3), p = pointAt(line, s);
      const L = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const nx = -(b.z - a.z) / L, nz = (b.x - a.x) / L; // the line's left
      // (the ruts fade in where the car came onto the path, and out at the rim)
      const end = Math.min(1, s / 1.6, (line.length - s) / 2.4);
      for (const k of ACROSS) {
        const off = side * RUT + k * (RUT_W / 2) * (1 + 0.08 * Math.sin(s * 5.1 + side));
        const x = p.x + nx * off, z = p.z + nz * off;
        pos.push(x, g(x, z) + 0.035, z);
        uv.push((k + 1) / 2, s / TREAD_M);
        col.push(1, 1, 1, Math.max(0, end) * (Math.abs(k) > 0.9 ? 0.45 : 1));
        rowS.push(s);
        ends.push(Math.max(0, end) * (Math.abs(k) > 0.9 ? 0.45 : 1));
      }
    }
    const C = ACROSS.length;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < C - 1; c++) {
        const i0 = base + r * C + c, i1 = base + (r + 1) * C + c;
        idx.push(i0, i1, i0 + 1, i0 + 1, i1, i1 + 1);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  if ((geo.attributes.normal as THREE.BufferAttribute).getY(1) < 0) { geo.setIndex(idx.slice().reverse()); geo.computeVertexNormals(); }
  return { geo, rowS, ends, line };
}

/* ------------------------------------------------------------ the tags ---- */

/** A place's name over the world with its day/night mark in front (the wildcamera's tags:
 *  a sun on the open sand, a moon on the burrow — what the place IS, never which animals go
 *  there now). Drawn into a canvas once. */
function markTag(text: string, dag: boolean, width: number): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const g = canvas.getContext('2d')!;
  g.font = '600 64px Inter, system-ui, sans-serif';
  g.textBaseline = 'middle';
  const badge = 84;
  const tw = g.measureText(text).width;
  const w = Math.min(500, tw + 56 + badge);
  const x = (512 - w) / 2, y = 20, h = 88, r = 26;
  g.fillStyle = 'rgba(28,24,18,0.78)';
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r);
  g.closePath(); g.fill();
  const cx = x + 54, cy = 64;
  g.fillStyle = dag ? '#f6d77a' : '#3f4f86';
  g.beginPath(); g.arc(cx, cy, 33, 0, Math.PI * 2); g.fill();
  g.lineCap = 'round';
  if (dag) {
    g.fillStyle = g.strokeStyle = '#3b2a0c';
    g.lineWidth = 5;
    g.beginPath(); g.arc(cx, cy, 11, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * 17, cy + Math.sin(a) * 17); g.lineTo(cx + Math.cos(a) * 24, cy + Math.sin(a) * 24); g.stroke();
    }
  } else {
    g.fillStyle = '#f3f1ff';
    g.beginPath(); g.arc(cx - 2, cy, 19, 0, Math.PI * 2); g.arc(cx + 8, cy - 7, 16, 0, Math.PI * 2, true); g.fill('evenodd');
  }
  g.fillStyle = '#fff';
  g.textAlign = 'left';
  g.fillText(text, x + 28 + badge - 6, 66);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, depthTest: false, transparent: true }));
  sprite.scale.set(width, width / 4, 1);
  sprite.renderOrder = 5;
  return sprite;
}

/* ------------------------------------------------------------ the home ---- */

/** Beyond this far (m) from the scrapes' middle the look-alikes and the tufts rest. */
const SCRAPES_NEAR = 26;
const SCRAPES_FAR = 32;

export class ZandHome implements HomeDressing {
  readonly group = new THREE.Group();
  /** every scrape's buntgras, one field (its stems are what the search's glimpse is measured on) */
  readonly cover: CoverField;
  /** the play laid now (null: free roam) */
  laid: ZandPlay | null = null;
  /** the route the tracks show now (the last play's; free roam on a fresh save: `l`) */
  route: Pass = 'l';
  private readonly built: Built[];
  private readonly env: DressingEnv;
  private readonly g: (x: number, z: number) => number;
  private readonly ruts: Record<Pass, Ruts>;
  private readonly looks: Record<LookKind, { mesh: THREE.InstancedMesh; at: THREE.Matrix4[]; wobble: number[] }>;
  /** one anchor per look-alike slot (what a click on it finds, a hint's point) */
  private readonly anchors: THREE.Object3D[] = [];
  private readonly butterfly = new THREE.Group();
  private readonly bird = new THREE.Group();
  private readonly flit: { o: THREE.Object3D | null; base: number; t: number }[] = [{ o: null, base: 0, t: 0 }, { o: null, base: 0, t: 0 }];
  private away = -1;
  private awayDir: Spot = { x: 0, z: 1 };
  /** the eggs (under her, shown when she shifts) */
  readonly eggs: THREE.Mesh;
  /** the places' names (only while he guards), their zones (what a click on a place finds)
   *  and what a perfect player clicks there */
  readonly tags: Record<'open' | 'hol', THREE.Sprite | null> = { open: null, hol: null };
  readonly zones: Record<'open' | 'hol', THREE.Mesh>;
  readonly hints: Record<'open' | 'hol', THREE.Object3D>;
  /** the animal standing at the stop while he decides (a click on it is no choice) */
  readonly visitor: THREE.Mesh;
  /** the juniper of the burrow, the anthill (for what he saw of them) */
  private juniper: THREE.Object3D | null = null;
  private anthill: THREE.Object3D | null = null;
  readonly burrowMouth: THREE.Mesh;
  /** a woodlark's body (spawned once; a play may fly it) */
  lark: THREE.Object3D | null = null;
  private larkFlight: { from: THREE.Vector3; t: number; secs: number; done: () => void; up: number; turn: number } | null = null;
  private readonly made: { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[] }[] = [];
  private readonly spawned: { dispose(): void }[] = [];
  private disposed = false;
  private clock = 0;
  /** in free roam: what he saw of the home (the anthill) */
  private readonly seen: Seen | null;

  constructor(env: DressingEnv) {
    this.group.name = 'stuifzand-home';
    env.parent.add(this.group);
    this.env = env;
    const g = env.groundY;
    this.g = g;
    const keep = <T extends THREE.Mesh | THREE.InstancedMesh | THREE.Sprite>(m: T, parent: THREE.Object3D = this.group): T => {
      parent.add(m);
      this.made.push(m as unknown as { geometry: THREE.BufferGeometry; material: THREE.Material });
      return m;
    };

    /* -- the ground: wind ripples over the sand (at the scrapes, the guard place and along
       the corridor), the bright open sand, the fan of dug-out sand before the burrow: ONE
       mesh, laid in the order they stack -- */
    const ground: THREE.BufferGeometry[] = [];
    const lay = (m: THREE.Mesh, alpha = 1): void => {
      const col = m.geometry.attributes.color as THREE.BufferAttribute | undefined;
      if (col && col.itemSize === 4 && alpha !== 1) for (let i = 0; i < col.count; i++) col.setW(i, col.getW(i) * alpha);
      ground.push(m.geometry);
      (m.material as THREE.Material).dispose();
    };
    const ripples = (c: Spot, rad: number, n: number, seed: number, wind = 0.35): void => {
      // crests across the wind (from the west-south-west): wavy lines ~0.4 m apart
      const rr = rng(seed);
      const across = { x: Math.cos(wind), z: -Math.sin(wind) }; // (along a crest)
      const down = { x: Math.sin(wind), z: Math.cos(wind) };    // (from crest to crest)
      for (let i = 0; i < n; i++) {
        // (each crest a short wavy line, broken off here and there: wind ripples, never a rake)
        const off = (i - n / 2) * 0.46 + (rr() - 0.5) * 0.16;
        const shift = (rr() - 0.5) * rad * 0.6;
        const len = rad * (0.6 + rr() * 0.5) * Math.sqrt(Math.max(0.15, 1 - (off / rad) ** 2));
        const pts: Spot[] = [];
        for (let k = 0; k <= 8; k++) {
          const t = (k / 8 - 0.5) * len + shift;
          const wob = Math.sin(t * 2.3 + i * 0.9 + seed) * 0.07 + Math.sin(t * 5.1 + seed) * 0.025;
          pts.push({ x: c.x + across.x * t + down.x * (off + wob), z: c.z + across.z * t + down.z * (off + wob) });
        }
        lay(groundStrip(g, pts, 0.032, SAND.trough, { layer: 1, wobble: 0.4, seed: seed + i, ends: len * 0.35 }), 0.5);
        lay(groundStrip(g, pts.map((p) => ({ x: p.x - down.x * 0.05, z: p.z - down.z * 0.05 })), 0.026, SAND.crest, { layer: 1, wobble: 0.45, seed: seed + i + 50, ends: len * 0.35 }), 0.55);
      }
    };
    NEST_IDS.forEach((n, i) => ripples(NESTS[n].c, 2.6, 11, 10 + i * 20));
    ripples(OPEN, 2.0, 8, 81);
    ripples(STOP, 1.6, 5, 91, 0.3);
    for (let s = 3; s < 26; s += 5.5) ripples(pointAt(lineOf([{ x: 19.6, z: 23.5 }, { x: 45, z: 31 }]), s), 1.7, 5, 120 + s);
    // the open sand: a bright, wind-swept patch (the sun's place)
    lay(groundDecal(g, OPEN.x, OPEN.z, OPEN.r + 0.3, OPEN.r * 0.85, 0.4, SAND.open, { layer: 2, wobble: 0.25, seed: 5, feather: true }));
    // the fan of sand a rabbit dug out before its burrow
    lay(groundDecal(g, BURROW.x - Math.sin(BURROW.yaw) * -0.35, BURROW.z - Math.cos(BURROW.yaw) * -0.35, 0.55, 0.42, BURROW.yaw, '#e2d2a7', { layer: 2, wobble: 0.3, seed: 9, feather: true }));
    const groundGeo = mergeGeometries(ground);
    for (const q of ground) q.dispose();
    if (groundGeo) {
      const m = keep(new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({
        vertexColors: true, transparent: true, depthWrite: false, roughness: 1,
        polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
      })));
      m.name = 'stuifzand-ground';
      m.renderOrder = 1;
      m.receiveShadow = true;
      m.raycast = () => {};
    }

    /* -- the car's tracks: each route's two ruts (one shows: the last play's) -- */
    const tread = treadTexture();
    this.ruts = {} as Record<Pass, Ruts>;
    for (const side of PASSES) {
      const built = rutsOf(g, routeOf(side));
      const mesh = keep(new THREE.Mesh(built.geo, new THREE.MeshStandardMaterial({
        map: tread, vertexColors: true, transparent: true, depthWrite: false, roughness: 1, opacity: rutAlpha(0.95),
        polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6,
      })));
      mesh.name = `stuifzand-tracks-${side}`;
      mesh.renderOrder = 2;
      mesh.receiveShadow = true;
      mesh.raycast = () => {};
      mesh.visible = side === this.route;
      this.ruts[side] = { mesh, rowS: built.rowS, ends: built.ends, line: built.line };
    }

    /* -- what lies about on the sand: dead twigs, single cones, bark flakes (thicker by the
       scrapes and the juniper), a dead branch by each scrape (where a parent rests), the
       burrow's mound: ONE static mesh -- */
    const lying: THREE.BufferGeometry[] = [];
    const put = (geo: THREE.BufferGeometry, p: Spot, yaw: number, s = 1, sink = 0.01): void => {
      const q = geo.clone();
      q.applyMatrix4(_m.compose(_p.set(p.x, g(p.x, p.z) - sink, p.z), _q.setFromAxisAngle(UP, yaw), _s.set(s, s, s)));
      lying.push(q.index ? q.toNonIndexed() : q);
    };
    const twig = paint(stickGeometry(0.34, 0.012, 21), ['#8a7b64', '#6c5f4c', '#a89a80'], 23, 0.5);
    const cone = paint(coneGeometry(0.07), LOOK.cone, 29, 0.5);
    const flake = paint(barkGeometry(0.13, 0.07, 31), LOOK.bark, 37, 0.6);
    const keepClear = (p: Spot): boolean => {
      for (const n of NEST_IDS) {
        if (NESTS[n].spots.some((s) => dist(s, p) < 0.38) || slotsOf(n).some((s) => dist(s, p) < 0.3)) return false;
        for (const side of PASSES) if (dist(NESTS[n].stands[side], p) < 0.5) return false;
      }
      return dist(p, STOP) > 1.1 && dist(p, BURROW) > 0.5;
    };
    const scatter = (c: Spot, rad: number, n: number, seed: number): void => {
      const rr = rng(seed);
      for (let i = 0; i < n; i++) {
        const a = rr() * Math.PI * 2, d = Math.sqrt(rr()) * rad;
        const p = { x: c.x + Math.cos(a) * d, z: c.z + Math.sin(a) * d };
        if (!keepClear(p)) continue;
        const k = rr();
        if (k < 0.55) put(twig, p, rr() * 6.28, 0.6 + rr() * 0.8);
        else if (k < 0.82) put(cone, p, rr() * 6.28, 0.8 + rr() * 0.4, 0);
        else put(flake, p, rr() * 6.28, 0.8 + rr() * 0.6);
      }
    };
    NEST_IDS.forEach((n, i) => scatter(NESTS[n].c, 2.4, 34, 300 + i));
    scatter({ x: HOL_JUNIPER.x, z: HOL_JUNIPER.z }, 2.6, 26, 330);
    scatter(OPEN, 2.0, 8, 331);
    for (let s = 2; s < 26; s += 3.2) scatter(pointAt(lineOf([{ x: 19.6, z: 23.5 }, { x: 45, z: 31 }]), s), 2.6, 7, 340 + s);
    for (const n of NEST_IDS) {
      const b = NESTS[n].branch;
      put(paint(stickGeometry(b.len, 0.035, 41 + n), LOOK.wood, 43 + n, 0.6), b, b.yaw);
    }
    const lyingGeo = mergeGeometries(lying);
    for (const q of lying) q.dispose();
    [twig, cone, flake].forEach((q) => q.dispose());
    if (lyingGeo) {
      const m = keep(new THREE.Mesh(lyingGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })));
      m.name = 'stuifzand-lying';
      m.castShadow = false;
      m.receiveShadow = true;
    }
    // the burrow: a low mound of dug sand under the juniper's skirt with a dark hole in its
    // face toward him (one mesh: what a click on the burrow finds first)
    {
      const mound = new THREE.SphereGeometry(1, 16, 7, 0, Math.PI * 2, 0, Math.PI / 2);
      mound.scale(0.6, 0.24, 0.5);
      const mpos = mound.attributes.position as THREE.BufferAttribute;
      const col = new Float32Array(mpos.count * 3);
      for (let i = 0; i < mpos.count; i++) {
        const x = mpos.getX(i), y = mpos.getY(i), z = mpos.getZ(i);
        mpos.setY(i, y * (0.8 + 0.2 * Math.sin(x * 9 + z * 7)));
        // (its front, facing +z: the hole, dark and round, low in the mound's face)
        const hole = Math.hypot(x / 0.24, (y - 0.07) / 0.1) < 1 && z > 0.18;
        _c.set(hole ? '#241a11' : Math.sin(x * 23 + z * 17) > 0.4 ? '#cdb98d' : '#dcc9a0');
        col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
      }
      mound.setAttribute('color', new THREE.BufferAttribute(col, 3));
      mound.computeVertexNormals();
      this.burrowMouth = keep(new THREE.Mesh(mound, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));
      this.burrowMouth.name = 'stuifzand-burrow';
      this.burrowMouth.position.set(BURROW.x, Math.min(g(BURROW.x, BURROW.z), ...[[-0.6, 0], [0.6, 0], [0, -0.5], [0, 0.5]].map(([dx, dz]) => g(BURROW.x + dx, BURROW.z + dz))) + 0.005, BURROW.z);
      this.burrowMouth.rotation.y = BURROW.yaw;
      // the hole itself: a dark disc sunk into the mound's face
      const mouth = keep(new THREE.Mesh(new THREE.CircleGeometry(0.17, 18).scale(1, 0.62, 1), new THREE.MeshStandardMaterial({ color: '#1e150d', roughness: 1 })), this.burrowMouth);
      mouth.position.set(0, 0.075, 0.43);
      mouth.rotation.x = -0.25;
    }

    /* -- the scrapes' small things rest together from the middle scrape when the lens is far
       (their tufts, the look-alikes) -- */
    const scrapes = env.detail(NESTS[2].c, { near: SCRAPES_NEAR, far: SCRAPES_FAR });

    /* -- the buntgras at the scrapes: one field over all three (the same clumps and seed the
       places test measures) -- */
    this.cover = new CoverField({ parent: scrapes, groundY: g, clumps: allClumps(), seed: COVER_SEED });
    this.built = this.cover.stems.map((s) => ({ h: s.h, lx: s.lx, lz: s.lz, r: s.r }));

    /* -- the look-alikes: per kind one instanced mesh with an instance on every slot of every
       scrape (only this play's show, or a few in free roam) -- */
    const lookMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
    this.made.push({ geometry: new THREE.BufferGeometry(), material: lookMat });
    const slots = NEST_IDS.flatMap((n) => slotsOf(n));
    this.looks = {} as ZandHome['looks'];
    for (const kind of LOOK_OF) {
      const geo = lookGeometry(kind);
      const mesh = new THREE.InstancedMesh(geo, lookMat, slots.length);
      mesh.name = `stuifzand-look-${kind}`;
      mesh.castShadow = false;
      this.made.push({ geometry: geo, material: [] });
      scrapes.add(mesh);
      const at = slots.map((p, i) => new THREE.Matrix4().compose(new THREE.Vector3(p.x, g(p.x, p.z) - 0.01, p.z), new THREE.Quaternion().setFromAxisAngle(UP, i * 2.3 + 0.4), new THREE.Vector3(1, 1, 1)));
      this.looks[kind] = { mesh, at, wobble: slots.map(() => 0) };
    }
    slots.forEach((p, i) => {
      const a = new THREE.Object3D();
      a.name = `stuifzand-look-${i}`;
      a.position.set(p.x, g(p.x, p.z) + 0.06, p.z);
      scrapes.add(a);
      this.anchors.push(a);
    });
    // the heath blue on a heather sprig, the stonechat on a dry stalk (a play lays them)
    this.butterfly.name = 'stuifzand-butterfly';
    this.butterfly.visible = false;
    scrapes.add(this.butterfly);
    const sprig = keep(new THREE.Mesh(heatherGeometry(29, 60), plantMaterial()), this.butterfly);
    sprig.scale.set(0.42, 0.34, 0.42);
    void env.spawnModel('heideblauwtje', { idle: false }).then((sp) => {
      if (!sp || this.disposed) { sp?.dispose(); return; }
      const o = sp.root as THREE.Object3D;
      o.position.set(0, 0.17, 0);
      this.butterfly.add(o);
      this.spawned.push(sp);
      this.flit[0] = { o, base: o.position.y, t: 0 };
    });
    this.bird.name = 'stuifzand-stonechat';
    this.bird.visible = false;
    scrapes.add(this.bird);
    const stalkH = 0.42;
    const stalk = keep(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.011, stalkH, 5).translate(0, stalkH / 2, 0), new THREE.MeshStandardMaterial({ color: '#9a8a66', roughness: 1 })), this.bird);
    stalk.rotation.z = 0.08;
    void env.spawnModel('roodborsttapuit', { idle: false }).then((sp) => {
      if (!sp || this.disposed) { sp?.dispose(); return; }
      const o = sp.root as THREE.Object3D;
      o.position.set(0.02, stalkH - 0.012, 0);
      this.bird.add(o);
      this.spawned.push(sp);
      this.flit[1] = { o, base: o.position.y, t: 0 };
    });

    /* -- her eggs (two, speckled; shown when she shifts on them) -- */
    const egg = (dx: number, rot: number): THREE.BufferGeometry => {
      const e = new THREE.SphereGeometry(0.5, 10, 8);
      e.scale(0.075, 0.054, 0.054).rotateY(rot).translate(dx, 0.048, 0);
      return e.toNonIndexed();
    };
    const eggGeo = paint(mergeGeometries([egg(-0.055, 1.8), egg(0.055, 1.4)])!, ["#f3ecdc", "#e6dbc3", "#f3ecdc", "#f3ecdc", "#7a6a56"], 61, 0.4);
    this.eggs = keep(new THREE.Mesh(eggGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 })), scrapes);
    this.eggs.name = 'stuifzand-eggs';
    this.eggs.visible = false;

    /* -- the guard place: the juniper (solid), the anthill, the places' zones and names -- */
    void env.spawnPlant('prop-juniper-bush', HOL_JUNIPER.h).then((sp) => {
      if (!sp || this.disposed) { sp?.dispose(); return; }
      const o = sp.root as THREE.Object3D;
      o.position.set(HOL_JUNIPER.x, g(HOL_JUNIPER.x, HOL_JUNIPER.z) - 0.04, HOL_JUNIPER.z);
      o.rotation.y = HOL_JUNIPER.yaw;
      o.name = 'stuifzand-juniper';
      this.group.add(o);
      this.spawned.push(sp);
      this.juniper = o;
    });
    env.obstacles.push({ x: HOL_JUNIPER.x, z: HOL_JUNIPER.z, r: HOL_JUNIPER.r });
    void env.spawnPlant('prop-anthill', ANTHILL.h).then((sp) => {
      if (!sp || this.disposed) { sp?.dispose(); return; }
      const o = sp.root as THREE.Object3D;
      // (a wood ants' heap of brown pine needles: the model's own dark red toned to it)
      o.traverse((m) => {
        const mesh = m as THREE.Mesh;
        if (!mesh.isMesh) return;
        // (its texture is a dark red: a heap of needles is warm grey-brown, its own shape shading it)
        const mats = [mesh.material].flat().map((mat) => {
          const c2 = (mat as THREE.MeshStandardMaterial).clone();
          c2.map = null;
          c2.color?.set('#8a6c4c');
          c2.roughness = 1;
          return c2;
        });
        mesh.material = Array.isArray(mesh.material) ? mats : mats[0];
        for (const mm of mats) this.made.push({ geometry: new THREE.BufferGeometry(), material: mm });
      });
      o.position.set(ANTHILL.x, g(ANTHILL.x, ANTHILL.z) - 0.05, ANTHILL.z);
      o.rotation.y = 0.8;
      o.name = 'stuifzand-anthill';
      this.group.add(o);
      this.spawned.push(sp);
      this.anthill = o;
    });
    env.obstacles.push({ x: ANTHILL.x, z: ANTHILL.z, r: 0.45 });
    const zone = (z: Spot & { r: number; h: number }, name: string): THREE.Mesh => {
      const m = keep(new THREE.Mesh(new THREE.CylinderGeometry(z.r, z.r, z.h, 20, 1).translate(0, z.h / 2 - 0.05, 0), new THREE.MeshBasicMaterial({ visible: false })));
      m.name = name;
      m.position.set(z.x, g(z.x, z.z), z.z);
      return m;
    };
    this.zones = { open: zone(ZONES.open, 'stuifzand-open-zone'), hol: zone(ZONES.hol, 'stuifzand-hol-zone') };
    // what a perfect player clicks: the open sand's bright middle, the burrow's mouth
    const openMid = keep(groundDecal(g, OPEN.x + 0.15, OPEN.z - 0.1, 0.62, 0.5, 0.4, SAND.openMid, { layer: 3, wobble: 0.2, seed: 7 }));
    openMid.name = 'stuifzand-open-mid';
    this.hints = { open: openMid, hol: this.burrowMouth };
    // the animal at the stop (an invisible box round it: never in a picture)
    this.visitor = keep(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ visible: false })));
    this.visitor.name = 'stuifzand-visitor';
    this.visitor.visible = false;
    if (typeof document !== 'undefined') {
      for (const [k, dag, text] of [['open', true, 'open zand'], ['hol', false, 'het hol']] as const) {
        const t = keep(markTag(text, dag, 1.55));
        const at = TAG_AT[k];
        t.position.set(at.x, g(at.x, at.z) + at.y, at.z);
        t.visible = false;
        this.tags[k] = t;
      }
    }

    /* -- a woodlark (a play may make it rise and sing over the sand) -- */
    void env.spawnModel('bird-boomleeuwerik', { height: SIZE.koolmees.h * 1.2, idle: false }).then((sp) => {
      if (!sp || this.disposed) { sp?.dispose(); return; }
      const o = sp.root as THREE.Object3D;
      o.visible = false;
      o.name = 'stuifzand-lark';
      this.group.add(o);
      this.spawned.push(sp);
      this.lark = o;
    });

    /* -- in free roam, what he saw of the home goes in his veldgids (the anthill) -- */
    this.seen = env.discover && env.view ? new Seen(
      () => ({ cam: env.view!() ?? new THREE.PerspectiveCamera(), w: 1280, h: 800, me: this.me }),
      (id) => { env.discover?.(id); },
    ) : null;
    this.seen?.watch({ id: 'stuifzand.mierenhoop', box: () => (this.anthill ? boxOf(this.anthill) : null), px: 40, secs: 1, within: 9, when: () => !this.playing });

    this.layLooks(null);
    this.setState('before');
  }

  /** where the ranger is (free roam: the movers' ranger) */
  private me: Spot = { x: 0, z: 0 };
  /** a play is laid and not yet over (the mission sees for itself what he found) */
  private playing = false;

  /* ------------------------------------------------------------- a play ---- */

  /**
   * Lay a play (under the briefing card): its route's tracks with this play's gaps, as dark
   * as the level's clarity; the tufts as grown, then the window over her spot fitted to the
   * level's glimpse for the search's lens; the trial's look-alikes on the scrape's slots;
   * her eggs under her. `null`: free roam (the last play's tracks stay).
   */
  lay(p: ZandPlay | null): void {
    this.laid = p;
    this.playing = !!p;
    // the tufts as grown, everywhere (a window opened for another play closes)
    this.cover.stems.forEach((s, i) => {
      const b = this.built[i];
      s.h = b.h; s.lx = b.lx; s.lz = b.lz; s.r = b.r;
      delete s.h0;
    });
    if (p) {
      const n = NESTS[p.laid.nest];
      const spot = n.spots[p.laid.spot];
      const lens = this.env.lensFor(asTheKitFrames(n.views[p.laid.side]));
      const gy = this.g(spot.x, spot.z);
      fitWindow(this.cover.stems, this.built, lens.cam, backPoints(spot.x, gy, spot.z, spot.yaw, ZWALUW_LEN, PRESSED_H), p.glimpse, { x: spot.x, y: gy, z: spot.z });
      this.cover.stems.forEach((s, i) => { if (Math.abs(s.h - this.built[i].h) > 1e-6) s.h0 = this.built[i].h; });
      this.route = p.laid.side;
      this.layTracks(p.laid.side, p.gaps, p.clarity);
      // (just under her breast: she steps back off them and they show in front of her)
      this.eggs.position.set(spot.x + Math.sin(spot.yaw) * 0.09, this.g(spot.x, spot.z), spot.z + Math.cos(spot.yaw) * 0.09);
      this.eggs.rotation.y = spot.yaw;
    }
    this.cover.refresh();
    this.eggs.visible = false;
    this.layLooks(p);
  }

  /** The search's own fit for the lens it really stands at (searchBeat's `fit`). */
  fitGlimpse(eye: V3, back: readonly V3[], share: number): number[] {
    const p = this.laid;
    if (!p) return [];
    const spot = NESTS[p.laid.nest].spots[p.laid.spot];
    const changed = refitWindow(this.cover.stems, this.built, eye, back, share, { x: spot.x, y: this.g(spot.x, spot.z), z: spot.z });
    this.cover.stems.forEach((s, i) => { if (Math.abs(s.h - this.built[i].h) > 1e-6) s.h0 = this.built[i].h; });
    return changed;
  }

  /** The tracks of a route, faded where the wind blew sand over them (`gaps`), as dark as
   *  `clarity` says; the other route's hidden. */
  layTracks(side: Pass, gaps: readonly { s: number; len: number }[], clarity: number): void {
    for (const k of PASSES) this.ruts[k].mesh.visible = k === side;
    const R = this.ruts[side];
    const col = R.mesh.geometry.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < R.rowS.length; i++) {
      const s = R.rowS[i];
      let a = R.ends[i];
      for (const gp of gaps) {
        // (sand blown over it: gone in the middle, a soft 0.4 m at each end)
        const into = Math.min(s - gp.s, gp.s + gp.len - s);
        if (into > -0.4) a *= Math.max(0, Math.min(1, -into / 0.4));
      }
      col.setW(i, a);
    }
    col.needsUpdate = true;
    (R.mesh.material as THREE.MeshStandardMaterial).opacity = rutAlpha(clarity);
  }

  /** How visible the tracks are at a point of the route (0 in a gap, the dev read). */
  trackAt(s: number): number {
    const R = this.ruts[this.route];
    let best = 0, bd = Infinity;
    for (let i = 0; i < R.rowS.length; i += 4) { const d = Math.abs(R.rowS[i] - s); if (d < bd) { bd = d; best = (R.mesh.geometry.attributes.color as THREE.BufferAttribute).getW(i + 1); } }
    return best;
  }

  /** The look-alikes of the play's scrape (as the search takes them). */
  get decoys(): ZandDecoy[] {
    const p = this.laid;
    if (!p) return [];
    return p.decoys.map((d) => {
      if (d.k === 'butterfly' || d.k === 'bird') {
        const o = d.k === 'butterfly' ? this.butterfly : this.bird;
        const i = d.k === 'butterfly' ? 0 : 1;
        return { id: d.id, k: d.k, object: o, x: d.x, z: d.z, poke: () => { this.flit[i].t = 1.1; } };
      }
      const slot = this.slotIndex(p.laid.nest, d);
      const kind = lookOf(d.id);
      return { id: d.id, k: d.k, object: this.anchors[slot], x: d.x, z: d.z, poke: () => { this.looks[kind].wobble[slot] = 0.9; } };
    });
  }

  /** The slot (over all scrapes) a decoy was laid on. */
  private slotIndex(n: NestId, d: Spot): number {
    const base = NEST_IDS.indexOf(n) * 8;
    let best = 0, bd = Infinity;
    slotsOf(n).forEach((q, i) => { const e = dist(q, d); if (e < bd) { bd = e; best = i; } });
    return base + best;
  }

  /** The look-alikes of a play (or free roam: a few at each scrape), the butterfly and the
   *  stonechat where the play has them. */
  private layLooks(p: ZandPlay | null): void {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    const on = new Map<number, LookKind>();
    if (p) {
      for (const d of p.decoys) if (d.k !== 'butterfly' && d.k !== 'bird') on.set(this.slotIndex(p.laid.nest, d), lookOf(d.id));
      // (the other scrapes keep their few free ones: sand things)
      NEST_IDS.forEach((n, ni) => { if (n !== p.laid.nest) for (const [i, k] of FREE) on.set(ni * 8 + i, k); });
    } else {
      NEST_IDS.forEach((_, ni) => { for (const [i, k] of FREE) on.set(ni * 8 + i, k); });
    }
    for (const kind of LOOK_OF) {
      const L = this.looks[kind];
      L.at.forEach((m, i) => L.mesh.setMatrixAt(i, on.get(i) === kind ? m : zero));
      L.mesh.instanceMatrix.needsUpdate = true;
      L.mesh.computeBoundingSphere();
      L.wobble.fill(0);
    }
    this.anchors.forEach((a, i) => { a.visible = on.has(i); });
    this.away = -1;
    this.flit.forEach((f, i) => { if (f.o) { f.o.visible = true; f.o.position.set(i ? 0.02 : 0, f.base, 0); } });
    const n = p ? NESTS[p.laid.nest] : null;
    for (const [k, grp] of [['butterfly', this.butterfly], ['bird', this.bird]] as const) {
      const d = p?.decoys.find((q) => q.k === k);
      grp.visible = !!d;
      if (d && n) {
        grp.position.set(d.x, this.g(d.x, d.z), d.z);
        grp.rotation.y = headingTo(d, n.stands[p!.laid.side]) + 0.9;
      }
    }
  }

  /** She is found: the heath blue flutters up and away, the stonechat flies off its stalk
   *  (calmly, up and out, away from the lens). */
  flyOff(): void {
    const p = this.laid;
    if (!p || this.away !== -1) return;
    this.away = 0;
    const h = NESTS[p.laid.nest].views[p.laid.side].heading;
    this.awayDir = { x: Math.sin(h), z: Math.cos(h) };
  }

  /** Her eggs show (she shifted off them) or not. */
  showEggs(on: boolean): void { this.eggs.visible = on; }

  /** The places' names (while he guards). */
  showTags(on: boolean): void {
    for (const t of Object.values(this.tags)) if (t) t.visible = on;
  }

  /** The invisible box round the animal standing at the stop (a click on it is no choice). */
  showVisitor(at: Spot | null, len = 0.6, h = 0.6, yaw = 0): void {
    this.visitor.visible = !!at;
    if (!at) return;
    this.visitor.position.set(at.x, this.g(at.x, at.z), at.z);
    this.visitor.rotation.y = yaw;
    this.visitor.scale.set(Math.max(0.5, len * 0.6), Math.max(0.5, h * 1.1), Math.max(0.6, len * 1.1));
  }

  /** The juniper and the burrow's mouth as he sees them (a box for "seen"). */
  burrowBox(): THREE.Box3 | null { return boxOf(this.burrowMouth); }
  juniperObject(): THREE.Object3D | null { return this.juniper; }

  /** A woodlark rises from the sand at `at` and sings up into the sky (song flight), then
   *  drifts off high; resolves once it is up and away. At once under reduced motion. */
  larkUp(at: Spot, reduced: boolean, secs = 7): Promise<void> {
    const o = this.lark;
    if (!o) return Promise.resolve();
    o.visible = true;
    o.position.set(at.x, this.g(at.x, at.z) + 0.05, at.z);
    this.larkFlight?.done();
    return new Promise((done) => {
      this.larkFlight = { from: o.position.clone(), t: reduced ? secs : 0, secs, done, up: 11, turn: 0 };
    });
  }

  /* ----------------------------------------------------------- the frame ---- */

  setState(state: HomeState, fresh = false): void {
    // (given back after a play, in front of him: free roam again)
    if (fresh) this.playing = false;
    void state;
    this.showTags(false);
    this.showVisitor(null);
    this.eggs.visible = false;
    if (this.lark) this.lark.visible = false;
    this.larkFlight?.done();
    this.larkFlight = null;
  }

  update(dt: number, t: number, reduced: boolean, movers: readonly { x: number; z: number; moving: boolean; ranger?: boolean }[]): void {
    if (this.disposed) return;
    this.clock += dt;
    const ranger = movers.find((m) => m.ranger);
    if (ranger) this.me = { x: ranger.x, z: ranger.z };
    this.cover.update(dt, t, reduced, movers);
    // a clicked look-alike wobbles (nothing under it)
    for (const kind of LOOK_OF) {
      const L = this.looks[kind];
      let any = false;
      L.wobble.forEach((w, i) => {
        if (w <= 0) return;
        any = true;
        const nw = Math.max(0, w - dt);
        L.wobble[i] = nw;
        const k = reduced ? 0 : Math.sin(nw * 22) * nw * 0.12;
        _m.copy(L.at[i]).multiply(new THREE.Matrix4().makeRotationZ(k));
        L.mesh.setMatrixAt(i, _m);
      });
      if (any) L.mesh.instanceMatrix.needsUpdate = true;
    }
    // a poked butterfly / stonechat lifts and settles; found, they leave
    this.flit.forEach((f, i) => {
      if (!f.o) return;
      if (this.away >= 0) {
        this.away = Math.min(3, this.away + dt);
        const k = this.away / 3;
        f.o.position.set((i ? 0.02 : 0) + this.awayDir.x * k * 4, f.base + k * 2.2, this.awayDir.z * k * 4);
        if (k >= 1) f.o.visible = false;
        return;
      }
      if (f.t > 0) {
        f.t = Math.max(0, f.t - dt);
        f.o.position.y = f.base + (reduced ? 0 : Math.sin((1.1 - f.t) * Math.PI / 1.1) * 0.25);
      }
    });
    // the woodlark's song flight: up in wide slow circles, singing, then drifting off
    const L = this.larkFlight, o = this.lark;
    if (L && o) {
      L.t = Math.min(L.secs, L.t + dt);
      const k = L.t / L.secs;
      const ang = k * Math.PI * 2.2;
      o.position.set(L.from.x + Math.sin(ang) * 2.2 * k + k * 9, L.from.y + Math.sin(Math.min(1, k * 1.4) * Math.PI / 2) * L.up, L.from.z + (1 - Math.cos(ang)) * 2.2 * k + k * 6);
      o.rotation.y = ang + Math.PI / 2;
      if (k >= 1) { o.visible = false; const d = L.done; this.larkFlight = null; d(); }
    }
    this.seen?.tick(dt);
  }

  dispose(): void {
    this.disposed = true;
    this.larkFlight?.done();
    this.cover.dispose();
    for (const m of this.made) {
      m.geometry?.dispose();
      for (const mat of [m.material].flat()) {
        const mm = mat as THREE.Material & { map?: THREE.Texture | null };
        if (mm.map && mm.map !== treadTex) mm.map.dispose();
        mm.dispose?.();
      }
    }
    for (const s of this.spawned) s.dispose();
    this.group.removeFromParent();
  }
}

/** A view as the kit fits it (a spot to include with a width `r` is two spots, `r` m either
 *  side of it): what the home's `lensFor` takes. */
export function asTheKitFrames(v: ViewSpec): ViewSpec {
  const right = { x: -Math.cos(v.heading), z: Math.sin(v.heading) };
  const include = (v.include ?? []).flatMap((q) => ((q.r ?? 0) > 0 ? [-q.r!, q.r!].map((u) => ({ x: q.x + right.x * u, z: q.z + right.z * u, h: q.h })) : [{ x: q.x, z: q.z, h: q.h }]));
  return { ...v, include };
}

/* ------------------------------------------------------------ the birds ---- */

/** A nightjar's long pointed wing (one side, root at the shoulder, along +x), mottled grey-
 *  brown; the male's with a white patch near its tip. */
function wingGeometry(male: boolean): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.05);
  shape.bezierCurveTo(0.12, 0.07, 0.26, 0.05, 0.36, -0.02);
  shape.bezierCurveTo(0.3, -0.06, 0.18, -0.08, 0, -0.06);
  shape.lineTo(0, 0.05);
  const geo = new THREE.ShapeGeometry(shape, 6).rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const blot = Math.abs(Math.sin(x * 61 + z * 43)) > 0.6 ? 0.78 : 1;
    _c.set(male && x > 0.24 && x < 0.31 ? '#f2eee4' : x < 0.12 ? '#8d7a60' : '#6f5d48');
    col[i * 3] = _c.r * blot; col[i * 3 + 1] = _c.g * blot; col[i * 3 + 2] = _c.b * blot;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

/** How a nightjar sits: dead still, a soft breath. */
const NIGHTJAR_SITS = calmGate({ gait: 'breathe', bobAmp: 0, swayAmp: 0, rotAmp: 0, breathAmp: 0.012, hz: 0.3 });

type Flight = { from: THREE.Vector3; to: THREE.Vector3; t: number; secs: number; arc: number; yaw: number | null; done: (ok: boolean) => void; flap: number; low: boolean };

/**
 * A nightjar of the drift sand: it sits dead still or presses flat on its eggs; it flies (a
 * low flutter or a glide, its long wings beating), it drags itself over the sand with a wing
 * spread as if hurt (the broken-wing show: a parent leading a boy away from the eggs), it
 * shifts on its eggs (they show), and at dusk it may rise and clap its wings (the male's
 * display flight). Its wings are its own: shown only while it flies or shows.
 */
export class Nightjar extends Actor {
  /** metres over the sand (a flight) */
  lift = 0;
  /** a male (white wing patches) */
  readonly male: boolean;
  private readonly posed = new THREE.Group();
  private readonly wings = new THREE.Group();
  private readonly wingL: THREE.Mesh;
  private readonly wingR: THREE.Mesh;
  private flight: Flight | null = null;
  private flop: { t: number; secs: number; from: Spot; to: Spot; side: number; done: ((ok: boolean) => void) | null } | null = null;
  private hold: { t: number; done: () => void } | null = null;
  private press = 0;
  private pressTo = 0;
  private shiftK = 0;
  private shiftTo = 0;
  private flapT = 0;
  private clapping: { t: number; claps: number; done: () => void } | null = null;
  private readonly wingGeos: THREE.BufferGeometry[] = [];
  private readonly wingMat: THREE.MeshStandardMaterial;
  /** called on each wing clap (the script plays its sound) */
  onClap: (() => void) | null = null;

  constructor(key: string, env: ActorEnv, height: number, male: boolean) {
    const self: { bird: Nightjar | null } = { bird: null };
    super(key, 'nachtzwaluw', { ...env, groundY: (x, z) => env.groundY(x, z) + (self.bird?.lift ?? 0) }, { height, recipe: NIGHTJAR_SITS });
    self.bird = this;
    this.male = male;
    this.wingMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 });
    const geo = wingGeometry(male);
    this.wingGeos.push(geo);
    const s = height / ZWALUW_H;
    this.wingR = new THREE.Mesh(geo, this.wingMat);
    this.wingL = new THREE.Mesh(geo, this.wingMat);
    this.wingL.scale.set(-1, 1, 1);
    this.wingR.name = 'nightjar-wing'; this.wingL.name = 'nightjar-wing';
    this.wings.add(this.wingR, this.wingL);
    this.wings.scale.setScalar(s);
    this.wings.position.set(0, height * 0.62, ZWALUW_LEN * 0.08 * s);
    this.wings.visible = false;
    this.gaitNode.add(this.posed);
    this.gaitNode.add(this.wings);
    void this.ready.then(() => { const b = this.body; if (b) this.posed.add(b); });
  }

  /** Is it on the sand (not flying)? */
  get grounded(): boolean { return !this.flight && this.lift < 0.02; }

  /** It presses flat on its eggs (or sits up again). */
  pressFlat(on: boolean): void { this.pressTo = on ? 1 : 0; }

  /** Rest still for `secs` (a pose held: nothing else moves it meanwhile). */
  still(secs: number): Promise<void> {
    return new Promise((done) => { this.hold?.done(); this.hold = { t: secs, done }; });
  }

  /**
   * Fly to `to` (its feet; `lift` m over the sand there: a branch), `secs` long, along a curve
   * `arc` m high in its middle (`low`: a fluttering low flight, quick wing beats), facing the
   * way it flies, and `yaw` once there. At once under reduced motion. Resolves true once there.
   */
  fly(to: Spot & { lift?: number }, opts: { secs: number; arc?: number; yaw?: number; low?: boolean }): Promise<boolean> {
    this.idle();
    this.flop?.done?.(false); this.flop = null;
    this.posed.rotation.set(0, 0, 0);
    this.pressTo = 0; // (it flies sitting up, its body its own size)
    const from = new THREE.Vector3(this.x, this.lift, this.z);
    const end = new THREE.Vector3(to.x, to.lift ?? 0, to.z);
    return new Promise((done) => {
      this.flight?.done(false);
      this.flight = { from, to: end, t: 0, secs: Math.max(0.05, opts.secs), arc: opts.arc ?? 0.6, yaw: opts.yaw ?? null, done, flap: 0, low: !!opts.low };
      this.wings.visible = true;
      if (this.env.reduced()) this.stepFlight(this.flight.secs);
    });
  }

  /**
   * The broken-wing show: on the sand it flops and drags itself toward `to` over `secs`,
   * leaning onto one side (`side` +1: its right), that wing spread flat on the sand and
   * trembling, the other half raised — as if hurt, slowly away (a parent leading a boy off
   * from its eggs). Its face toward `to`. Resolves once there.
   */
  flopTo(to: Spot, secs: number, side: 1 | -1): Promise<boolean> {
    this.idle();
    return new Promise((done) => {
      this.flop?.done?.(false);
      this.flop = { t: 0, secs, from: { x: this.x, z: this.z }, to, side, done };
      this.wings.visible = true;
      super.place(this.x, this.z, headingTo({ x: this.x, z: this.z }, to));
    });
  }

  /** It shifts on its eggs: rises a little and steps back off them (`off`), or settles on
   *  them again. */
  shift(off: boolean): void { this.shiftTo = off ? 1 : 0; }

  /** The male's display at dusk: up from where he sits in a slow arc to `at`, `up` m over the
   *  sand, three wing claps there (`onClap` each), a glide back down to his spot. */
  async display(at: Spot, up: number, reduced: boolean): Promise<void> {
    const home = { x: this.x, z: this.z };
    const yaw = this.yaw;
    if (!(await this.fly({ ...at, lift: up }, { secs: 1.6, arc: 0.5 }))) return;
    if (!reduced) await new Promise<void>((done) => { this.clapping?.done(); this.clapping = { t: 0, claps: 0, done }; });
    if (await this.fly({ ...home, lift: 0 }, { secs: 1.9, arc: 0.4, yaw })) this.pressFlat(true);
  }

  /** It lies down? (A nightjar presses flat instead.) */
  override async lie(on: boolean): Promise<void> { this.pressFlat(on); }
  override get lies(): boolean { return this.pressTo > 0.5; }

  /** Laid at a spot (its home laid out again): it sits there, on the sand; a flight or a show
   *  it was in is over. */
  override place(x: number, z: number, yaw = this.yaw): void {
    this.flight?.done(false); this.flight = null;
    this.flop?.done?.(false); this.flop = null;
    this.lift = 0;
    this.wings.visible = false;
    this.posed.rotation.set(0, 0, 0);
    super.place(x, z, yaw);
  }

  override update(dt: number, t: number): void {
    const reduced = this.env.reduced();
    if (this.hold) { this.hold.t -= dt; if (this.hold.t <= 0) { const d = this.hold.done; this.hold = null; d(); } }
    if (this.flight) this.stepFlight(dt);
    else if (this.flop) this.stepFlop(dt, reduced);
    super.update(dt, t);
    // pressed flat: lower and a touch wider; shifted off the eggs: up and back a little
    this.press += (this.pressTo - this.press) * Math.min(1, reduced ? 1 : dt * 4);
    this.shiftK += (this.shiftTo - this.shiftK) * Math.min(1, reduced ? 1 : dt * 3);
    const lowK = this.press * (1 - this.shiftK * 0.8);
    this.posed.scale.set(1 + lowK * 0.08, 1 - lowK * 0.3, 1);
    this.posed.position.set(0, this.shiftK * 0.03, -this.shiftK * 0.22 * (this.height / ZWALUW_H));
    // the wings: beating in flight (quick and shallow low down, slower and deeper up high),
    // a clap's high snap, folded away once it sits on the sand
    const f = this.flight;
    if (this.clapping) {
      const C = this.clapping;
      this.wings.visible = true;
      C.t += dt;
      const ph = (C.t % 0.55) / 0.55;
      const up = ph < 0.35 ? ph / 0.35 : Math.max(0, 1 - (ph - 0.35) / 0.65);
      this.setWings(-0.2 + up * 1.65, 0);
      if (C.claps < 3 && C.t >= C.claps * 0.55 + 0.2) { C.claps += 1; this.onClap?.(); }
      if (C.t >= 3 * 0.55 + 0.2) { this.clapping = null; C.done(); }
    } else if (f) {
      this.wings.visible = true;
      this.flapT += dt * (f.low ? 11 : 6.5);
      const glide = !f.low && f.t / f.secs > 0.7;
      this.setWings(glide ? 0.1 : Math.sin(this.flapT) * (f.low ? 0.75 : 0.95), 0);
    } else if (this.lift > 0.02) {
      // (held in the air between two flights: a slow hover)
      this.wings.visible = true;
      this.flapT += dt * 5;
      this.setWings(Math.sin(this.flapT) * 0.8, 0);
    } else if (!this.flop) this.wings.visible = false;
  }

  /** Both wings at an angle up (+) or down (−) from level; `spread` (the show): one wing flat
   *  out on the sand, the other raised. */
  private setWings(up: number, spread: number): void {
    this.wingR.rotation.z = up + spread;
    this.wingL.rotation.z = -up + spread;
  }

  private stepFlight(dt: number): void {
    const f = this.flight!;
    f.t = Math.min(f.secs, f.t + dt);
    const k = f.t / f.secs;
    const e = k * k * (3 - 2 * k);
    const x = f.from.x + (f.to.x - f.from.x) * e, z = f.from.z + (f.to.z - f.from.z) * e;
    this.lift = f.from.y + (f.to.y - f.from.y) * e + Math.sin(Math.PI * k) * f.arc;
    const yaw = k < 0.9 || f.yaw === null ? headingTo({ x: f.from.x, z: f.from.z }, { x: f.to.x, z: f.to.z }) : f.yaw;
    super.place(x, z, Math.abs(f.to.x - f.from.x) + Math.abs(f.to.z - f.from.z) < 0.05 ? (f.yaw ?? this.yaw) : yaw);
    // (a slight bank into its turn, never a roll of the lens: the bird's own body)
    this.posed.rotation.z = Math.sin(Math.PI * k) * 0.12;
    if (k >= 1) {
      this.flight = null;
      this.lift = f.to.y;
      this.posed.rotation.z = 0;
      if (f.to.y < 0.02) this.wings.visible = false;
      f.done(true);
    }
  }

  private stepFlop(dt: number, reduced: boolean): void {
    const F = this.flop!;
    F.t += dt;
    const k = Math.min(1, F.t / F.secs);
    // it drags itself in little lurches, never smoothly
    const lurch = reduced ? k : Math.min(1, k + Math.sin(k * Math.PI * 9) * 0.02);
    super.place(F.from.x + (F.to.x - F.from.x) * lurch, F.from.z + (F.to.z - F.from.z) * lurch, headingTo(F.from, F.to));
    const tremble = reduced ? 0 : Math.sin(this.flapT += dt * 26) * 0.12;
    this.posed.rotation.z = F.side * 0.42 + tremble * 0.2;
    this.posed.rotation.x = 0.12;
    // (its wing on the low side flat on the sand, quivering; the other raised and shaking)
    this.wingR.rotation.z = F.side > 0 ? -0.15 + tremble : 1.05 + tremble * 1.4;
    this.wingL.rotation.z = F.side > 0 ? -1.05 - tremble * 1.4 : 0.15 - tremble;
    // (there it goes on trembling with its wing spread until it sits up or flies)
    if (k >= 1 && F.done) { const d = F.done; F.done = null; d(true); }
  }

  /** Back to sitting (after the show). */
  sitUp(): void {
    this.flop?.done?.(false);
    this.flop = null;
    this.posed.rotation.set(0, 0, 0);
    this.wings.visible = false;
  }

  override dispose(): void {
    this.flight?.done(false);
    this.flop?.done?.(false);
    this.hold?.done();
    this.clapping?.done();
    for (const g of this.wingGeos) g.dispose();
    this.wingMat.dispose();
    super.dispose();
  }
}

/**
 * An animal that can go a little under the ground or up off it (`lift`, m): the badger into
 * its burrow, the squirrel up into the juniper's skirt. Otherwise a plain Actor.
 */
export class Lifted extends Actor {
  lift = 0;
  constructor(key: string, animal: string, env: ActorEnv, height: number) {
    const self: { a: Lifted | null } = { a: null };
    super(key, animal, { ...env, groundY: (x, z) => env.groundY(x, z) + (self.a?.lift ?? 0) }, { height });
    self.a = this;
  }
  override place(x: number, z: number, yaw = this.yaw): void {
    this.lift = 0;
    super.place(x, z, yaw);
  }
}

/** The adventure's `actor` hook: the nightjars are Nightjars (the pair's male: `man`), the
 *  badger and the squirrel can go into the burrow and the juniper. */
export function zandBody(spec: ResidentSpec, env: ActorEnv, height: number): Actor | null {
  if (spec.animal === 'nachtzwaluw') return new Nightjar(spec.key, env, height, spec.key === 'man');
  if (spec.animal === 'das' || spec.animal === 'eekhoorn') return new Lifted(spec.key, spec.animal, env, height);
  return null;
}

/** The home's mission id (for the registry's dressing lookup). */
export const ZAND_MISSION = MISSION;
/** (the places' own, for the script) */
export { approachOf, gapsTo, GAPS_FROM, nestNowOf, SETTLE };
