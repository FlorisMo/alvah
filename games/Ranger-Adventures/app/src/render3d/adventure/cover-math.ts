/**
 * cover-math.ts — the pure half of the true-scale cover an animal hides in (THREE-free,
 * unit-tested in cover.test.ts): the clumps of a stand laid out on the ground, and how
 * much of an animal lying in it a lens can see.
 *
 * A plant is modelled as a leaning capsule from its root to its tip (its leaves spread
 * `r` round that line): a bracken frond, a pijpenstrootje tussock, a heather cushion.
 * A line of sight is blocked where it passes within `r` of a plant's line. The search
 * beat's bar (design §3.7): the animal is PARTLY visible from the framed view (its back
 * glimpsed between the stems), never fully covered, never fully open.
 */

import { stream, type Frame, atLocal } from './places.ts';
import type { Spot } from './types.ts';

export type PlantKind = 'frond' | 'tussock' | 'heath';

/** One plant of a cover stand, as the maths sees it. */
export interface Stem {
  kind: PlantKind;
  /** root on the ground (world) */
  x: number; y: number; z: number;
  /** height (m) and the horizontal offset of its tip from its root (lean) */
  h: number; lx: number; lz: number;
  /** how far its leaves reach round its line (m) */
  r: number;
  /** the clump it belongs to */
  clump: number;
  /** heading (rad) the plant is turned to (a frond's blade points this way) */
  yaw: number;
  /** its height as built (a thinned stem is shortened; `h` then is the new one) */
  h0?: number;
}

export interface V3 { x: number; y: number; z: number }

/** Closest distance between segment p0→p1 and segment q0→q1 (3D). */
export function segSegDist(p0: V3, p1: V3, q0: V3, q1: V3): number {
  const ux = p1.x - p0.x, uy = p1.y - p0.y, uz = p1.z - p0.z;
  const vx = q1.x - q0.x, vy = q1.y - q0.y, vz = q1.z - q0.z;
  const wx = p0.x - q0.x, wy = p0.y - q0.y, wz = p0.z - q0.z;
  const a = ux * ux + uy * uy + uz * uz, b = ux * vx + uy * vy + uz * vz, c = vx * vx + vy * vy + vz * vz;
  const d = ux * wx + uy * wy + uz * wz, e = vx * wx + vy * wy + vz * wz;
  const D = a * c - b * b;
  let sN: number, sD = D, tN: number, tD = D;
  if (D < 1e-9) { sN = 0; sD = 1; tN = e; tD = c; } else {
    sN = b * e - c * d; tN = a * e - b * d;
    if (sN < 0) { sN = 0; tN = e; tD = c; } else if (sN > sD) { sN = sD; tN = e + b; tD = c; }
  }
  if (tN < 0) { tN = 0; if (-d < 0) sN = 0; else if (-d > a) sN = sD; else { sN = -d; sD = a; } }
  else if (tN > tD) { tN = tD; if (-d + b < 0) sN = 0; else if (-d + b > a) sN = sD; else { sN = -d + b; sD = a; } }
  const sc = Math.abs(sN) < 1e-9 ? 0 : sN / sD, tc = Math.abs(tN) < 1e-9 ? 0 : tN / tD;
  const dx = wx + sc * ux - tc * vx, dy = wy + sc * uy - tc * vy, dz = wz + sc * uz - tc * vz;
  return Math.hypot(dx, dy, dz);
}

/** The part of a plant that hides things: its leafy upper stretch (a frond's blade, a
 *  tussock's arching leaves), as a segment. The bare lower stalk hides little. */
export function leafy(s: Stem): { a: V3; b: V3 } {
  const from = s.kind === 'frond' ? 0.45 : 0.15;
  return {
    a: { x: s.x + s.lx * from, y: s.y + s.h * from, z: s.z + s.lz * from },
    b: { x: s.x + s.lx, y: s.y + s.h, z: s.z + s.lz },
  };
}

/** Does plant `s` block the line from `eye` to `p`? */
export function blocks(s: Stem, eye: V3, p: V3): boolean {
  const { a, b } = leafy(s);
  return segSegDist(eye, p, a, b) < s.r;
}

/** The share (0..1) of `pts` (points on an animal's body) a lens at `eye` sees past the plants. */
export function visibleShare(pts: readonly V3[], eye: V3, stems: readonly Stem[]): number {
  if (!pts.length) return 0;
  let seen = 0;
  for (const p of pts) if (!stems.some((s) => blocks(s, eye, p))) seen += 1;
  return seen / pts.length;
}

/** The plants that block the line from `eye` to `p`. */
export function blockersOf(eye: V3, p: V3, stems: readonly Stem[]): number[] {
  const out: number[] = [];
  stems.forEach((s, i) => { if (blocks(s, eye, p)) out.push(i); });
  return out;
}

/**
 * Points on the back of an animal lying at (x, y, z), `len` long, facing `yaw`, whose
 * back is `top` m above the ground: a 3 × 5 grid over the upper body, where a searching
 * child sees its stripes or spots.
 */
export function backPoints(x: number, y: number, z: number, yaw: number, len: number, top: number): V3[] {
  const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -fz, rz = fx;
  const out: V3[] = [];
  for (const a of [-0.36, -0.18, 0, 0.18, 0.36]) {
    for (const s of [-0.16, 0, 0.16]) {
      const along = a * len, across = s * len * 0.55;
      out.push({ x: x + fx * along + rx * across, y: y + top * (s === 0 ? 0.96 : 0.8), z: z + fz * along + rz * across });
    }
  }
  return out;
}

/**
 * Thin the plants between a lens and an animal until `min` of its back shows (a
 * glimpse), keeping it mostly hidden: the nearest blocker of the middle of its back is
 * made SMALLER (a young frond, a stooping tussock; never removed: the stand keeps its
 * look), again and again until enough shows. Returns the indices it changed. Pure: the
 * stems are edited in place (`h` shrinks, `h0` keeps the built height).
 *
 * Run 7: `max` (default: no limit, as before) is the share it must not pass — a step that
 * would uncover more is taken gentler, or on another plant, so every hiding spot shows
 * the same glimpse for the same knob (the search's difficulty never depends on where he
 * lies). When no step lands under `max` it takes the first one, as before.
 */
export function openWindow(stems: Stem[], eye: V3, pts: readonly V3[], min = 0.3, max = Infinity): number[] {
  const changed = new Set<number>();
  const centre = pts[Math.floor(pts.length / 2)];
  // a frond shrinks whole (a young frond: its blade blocks at any height); a tussock
  // stoops (lower, as wide): the line to the back rises over it
  const shrink = (i: number, k: number): void => {
    const s = stems[i];
    s.h0 ??= s.h;
    s.h *= k;
    if (s.kind === 'frond') { s.lx *= k; s.lz *= k; s.r *= k; } else s.r *= k === 0.74 ? 0.92 : 1 - (1 - k) * 0.31;
    changed.add(i);
  };
  for (let guard = 0; guard < 60 && visibleShare(pts, eye, stems) < min; guard++) {
    // the points nearest the middle of the back first: a window over the animal
    const order = [...pts].sort((p, q) => Math.hypot(p.x - centre.x, p.z - centre.z) - Math.hypot(q.x - centre.x, q.z - centre.z));
    let first: number | null = null;
    let took = false;
    for (const p of order) {
      const bl = blockersOf(eye, p, stems);
      if (!bl.length) continue;
      bl.sort((i, j) => Math.hypot(stems[i].x - p.x, stems[i].z - p.z) - Math.hypot(stems[j].x - p.x, stems[j].z - p.z));
      if (max === Infinity) { shrink(bl[0], 0.74); took = true; break; }
      first ??= bl[0];
      // (run 7: a gentler step on this plant, or the next plant, when a full one shows too much)
      for (const i of bl) {
        const s = stems[i];
        const was = { h: s.h, lx: s.lx, lz: s.lz, r: s.r, h0: s.h0, had: changed.has(i) };
        for (const k of [0.74, 0.86, 0.93, 0.965]) {
          shrink(i, k);
          if (visibleShare(pts, eye, stems) <= max) { took = true; break; }
          s.h = was.h; s.lx = was.lx; s.lz = was.lz; s.r = was.r;
          if (was.h0 === undefined) delete s.h0; else s.h0 = was.h0;
          if (!was.had) changed.delete(i);
        }
        if (took) break;
      }
      if (took) break;
    }
    if (!took) {
      if (first === null) break;
      shrink(first, 0.74); // (no step stays under max: the first one, as before)
    }
  }
  return [...changed];
}

/* ---------------------------------------------------------------- layout ---- */

/** A clump of plants in a stand: its centre and what it is made of. */
export interface Clump extends Spot {
  /** 'mix' = a tussock with fronds, 'bracken' = fronds, 'grass' = a tussock, 'dead' =
   *  a low clump of rust-brown dead bracken (a decoy a child may take for the animal) */
  kind: 'mix' | 'bracken' | 'grass' | 'dead';
  /** scale of the clump (1 = the table's middle size) */
  size: number;
  /** the zoeken decoy it stands for (content id), if any */
  decoy?: string;
}

/**
 * The clumps of a stand of cover over an ellipse of half-axes (a, b) in `frame`: a
 * jittered grid about `spacing` apart, a little thinner toward the rim so it reads as
 * a stand, not a box. Deterministic. `keep` may refuse a spot (a decoy's own spot, the
 * animal's).
 */
export function standClumps(frame: Frame, a: number, b: number, spacing: number, seed: number,
  keep: (u: number, v: number) => boolean = () => true): Clump[] {
  const rnd = stream(seed);
  const out: Clump[] = [];
  const rows = Math.ceil((b * 2) / (spacing * 0.87));
  for (let j = 0; j <= rows; j++) {
    const v = -b + (j * b * 2) / rows;
    const off = j % 2 ? spacing / 2 : 0;
    for (let u0 = -a; u0 <= a + 1e-6; u0 += spacing) {
      const u = u0 + off + (rnd() - 0.5) * spacing * 0.45;
      const vv = v + (rnd() - 0.5) * spacing * 0.4;
      const e = (u * u) / (a * a) + (vv * vv) / (b * b);
      if (e > 1.08) continue;
      if (e > 0.75 && rnd() < 0.35) continue; // a ragged rim
      if (!keep(u, vv)) continue;
      const r = rnd();
      const kind: Clump['kind'] = r < 0.55 ? 'mix' : r < 0.8 ? 'grass' : 'bracken';
      out.push({ ...atLocal(frame, u, vv), kind, size: 0.85 + rnd() * 0.3 });
    }
  }
  return out;
}

/* ------------------------------------------------------------ the plants ---- */

/** How a grown plant is drawn beyond the maths' stem (cover.ts reads it). */
export interface StemLook {
  /** its width scale (a tussock's, a heather cushion's; a frond scales whole by `h`) */
  s: number;
  /** its height as built (the draw's y scale) */
  sy: number;
  /** a droop toward the ground (a dead frond), rad */
  pitch: number;
  /** its colour tint (r, g, b), or none */
  tint: readonly [number, number, number] | null;
  /** its breeze phase (rad) */
  phase: number;
}

/**
 * The plants of a field of cover, grown from its clumps the one way the world grows them
 * (cover.ts builds its instances from exactly these): per clump a tussock and fronds, a
 * low mound of dead rust-brown fronds for a 'dead' clump, now and then a heather cushion.
 * Deterministic from `seed`; pure, so a places test measures the glimpse of the stand the
 * world will draw (run 7: moved here from CoverField's constructor, unchanged).
 */
export function growStems(clumps: readonly Clump[], seed: number, groundY: (x: number, z: number) => number): { stems: Stem[]; looks: StemLook[] } {
  const rnd = stream(seed);
  const stems: Stem[] = [];
  const looks: StemLook[] = [];
  const add = (kind: PlantKind, clump: number, x: number, z: number, h: number, yaw: number, extra: { s?: number; pitch?: number; tint?: readonly [number, number, number] } = {}): void => {
    const y = groundY(x, z) - 0.02;
    const reach = kind === 'frond' ? 0.55 * h : 0;
    stems.push({
      kind, x, y, z, h, clump, yaw,
      lx: Math.sin(yaw) * reach, lz: Math.cos(yaw) * reach,
      r: kind === 'frond' ? 0.2 * h : kind === 'tussock' ? 0.3 * h : 0.38 * (extra.s ?? 1),
    });
    looks.push({ s: extra.s ?? h, sy: h, pitch: extra.pitch ?? 0, tint: extra.tint ?? null, phase: rnd() * Math.PI * 2 });
  };
  clumps.forEach((c, ci) => {
    const s = c.size;
    const turn = rnd() * Math.PI * 2;
    if (c.kind === 'dead') {
      // a low mound of rust-brown dead fronds, drooping
      for (let k = 0; k < 4; k++) {
        const a = turn + k * 1.7;
        const h = (0.55 + rnd() * 0.12) * s;
        const pitch = 0.28 + rnd() * 0.12;
        const m = 0.9 + rnd() * 0.2;
        add('frond', ci, c.x + Math.cos(a) * 0.08, c.z + Math.sin(a) * 0.08, h, a + 0.4, { pitch, tint: [1.75 * m, 0.72 * m, 0.5 * m] });
      }
      return;
    }
    if (c.kind === 'mix' || c.kind === 'grass') {
      const h = (0.58 + rnd() * 0.26) * s;
      add('tussock', ci, c.x, c.z, h, turn, { s: (0.62 + rnd() * 0.22) * s });
      if (c.kind === 'grass' && rnd() < 0.5) {
        const a = turn + 2.2;
        add('tussock', ci, c.x + Math.cos(a) * 0.3 * s, c.z + Math.sin(a) * 0.3 * s, (0.5 + rnd() * 0.2) * s, a, { s: 0.55 * s });
      }
    }
    if (c.kind === 'mix' || c.kind === 'bracken') {
      const n = c.kind === 'bracken' ? 5 : 3;
      for (let k = 0; k < n; k++) {
        const a = turn + (k / n) * Math.PI * 2 + rnd() * 0.6;
        const off = 0.1 + rnd() * 0.14;
        const h = (0.88 + rnd() * 0.3) * s;
        const yaw = a + (rnd() - 0.5) * 0.8;
        const tint: [number, number, number] = [0.92 + rnd() * 0.16, 0.92 + rnd() * 0.16, 0.9 + rnd() * 0.1];
        add('frond', ci, c.x + Math.cos(a) * off, c.z + Math.sin(a) * off, h, yaw, { tint });
      }
    }
    if (rnd() < 0.12) add('heath', ci, c.x + 0.3, c.z - 0.2, 0.4 * s, turn, { s: 0.8 * s });
  });
  return { stems, looks };
}

/** Every stem back to its built height (a window opened for another spot is closed):
 *  `built` holds the stems as `growStems` grew them. Pure: edits `stems` in place;
 *  returns the indices it changed. */
export function resetStems(stems: Stem[], built: readonly Stem[]): number[] {
  const out: number[] = [];
  stems.forEach((s, i) => {
    const b = built[i];
    if (s.h0 === undefined && s.h === b.h && s.r === b.r) return;
    s.h = b.h; s.lx = b.lx; s.lz = b.lz; s.r = b.r;
    delete s.h0;
    out.push(i);
  });
  return out;
}
