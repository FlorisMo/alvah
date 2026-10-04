/**
 * ven.places.ts — where "De kikker in het ven" happens (run 7, design
 * `state/adventures/design.md` §3, §6.3-6.4): the NORTH BANK of the ven, chosen by looking
 * at the world and pinned by ven.places.test.ts. Pure (THREE-free): the tests, the home
 * (ven.home.ts) and the script (ven.ts) read the same tables.
 *
 * The north bank faces south over the water: open, sunny, a broad bank sloping ~0.17 m a
 * metre from the heath down to the water line 12-15 m from the ven's centre. Along its top
 * runs a trodden SHORE PATH (r ≈ 19.5 m), round the bird hide's land side from the sand
 * trail (the trail node by the hide), heather on its land side. Down the slope lie three
 * small COVES (bays A, B, C) where the world's cattails give way to sedge tussocks,
 * cotton-grass and cushions of veenmos: the heikikkers live there. On his way to this
 * play's cove two STATIONS on the path hold its calm moments (an adder basking on the warm
 * sand, a carpet of soft wet moss across the path and down to the water); the dry path
 * (the flip) comes right after one of them. Each cove has its own two stations: a play's
 * cove is never the last play's, so two plays in a row meet the adder and the moss at
 * other places.
 *
 * Angles: θ (degrees) round the ven's centre (46, -19), x = cx + r cos θ, z = cz + r sin θ;
 * θ 90 is the middle of the north bank, larger θ toward the bird hide (west), smaller
 * toward the east. He walks the path from the hide eastward (θ falling).
 *
 * Every play draws from its forks (decision 1; `venLayout`): the cove the frogs call from,
 * which of its six nooks the frog sits in (each cove its own, spread over the search's
 * picture, never its middle; never where the frog sat in the last play's picture) and so
 * the side he searches it from, the order of the three moments (the dagnacht trial's own
 * seeded order: the same as the 2D floor's) and so which station holds the adder and which
 * the moss, the adder's exact spot on the path and her turn. None of it changes a knob:
 * every cove is the same size, seen from the same distance and angle, every nook fitted to
 * the level's glimpse; difficulty is the level's.
 */

import { anchorInBiome, heightAt, VEN_CENTER, WATER_LEVEL } from '../../Biomes.ts';
import { RANGER_STAND_HEIGHT, SIZE } from '../../AnimalScale.ts';
import { atLocal, dist, headingTo, segDist, stream, toLocal, type Frame } from '../places.ts';
import { backPoints, openWindow, visibleShare, type Clump, type Stem, type V3 } from '../cover-math.ts';
import { FIT_BAND, closeWindow, fitWindow, type Built } from './ree.window.ts';
import type { HomeSpec, Place, ResidentSpec, Spot } from '../types.ts';
import type { Play } from '../../../core/play.ts';
import type { Skin } from '../../../content/types.ts';
import type { RustKnobs } from '../../../core/skill.ts';
import { playDagnachtTrial } from '../../../engines/dagnacht.ts';

export const MISSION = 'ven';
const RAD = Math.PI / 180;
const C = VEN_CENTER;

/* ------------------------------------------------------------- the bank ---- */

/** A point on the bank: θ degrees round the ven's centre, r m out. */
export function polar(th: number, r: number): Spot {
  return { x: C.x + Math.cos(th * RAD) * r, z: C.z + Math.sin(th * RAD) * r };
}
/** A spot's θ (degrees) and r round the ven's centre. */
export function polarOf(p: Spot): { th: number; r: number } {
  return { th: Math.atan2(p.z - C.z, p.x - C.x) / RAD, r: Math.hypot(p.x - C.x, p.z - C.z) };
}
/** How far (m) the ground at `p` stands above the water (negative: under it). */
export function above(p: Spot): number {
  return heightAt(p.x, p.z) - WATER_LEVEL;
}
/** How far out (m) along θ the bank stands `h` m above the water (it rises outward). */
export function shoreR(th: number, h: number): number {
  let lo = 6, hi = 26;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (above(polar(th, mid)) < h) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
/** Ground the world will not let him onto: the ven's water (World `limits.blocked`). */
export function blocked(p: Spot): boolean {
  return Math.hypot(p.x - C.x, p.z - C.z) < 20 && above(p) < 0.15;
}

/** The mission marker: where the world puts the ven's (its landschap's bank spot, the west
 *  bank south of the bird hide). Its ring stays empty: the frogs are heard, not seen. */
export const MARKER: Spot = anchorInBiome('ven', 22);

/** The bird hide (a solid landmark, its footprint ~2.7 m round) and the "Ken je roep"
 *  bench beside it. */
export const HIDE: Spot = { x: 26, z: -11 };
export const HIDE_R = 2.7;
export const BENCH: Spot = { x: 22, z: -6.5 };

/* --------------------------------------------------------- a polyline ---- */

/** A line on the ground, measured (`s`: metres along it). */
export interface Line { pts: readonly Spot[]; acc: readonly number[]; length: number }

export function measure(pts: readonly Spot[]): Line {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + dist(pts[i - 1], pts[i]));
  return { pts, acc, length: acc[acc.length - 1] };
}
/** The point `s` m along a line (clamped to its ends). */
export function pointAt(l: Line, s: number): Spot {
  const t = Math.max(0, Math.min(l.length, s));
  let i = 1;
  while (i < l.pts.length - 1 && l.acc[i] < t) i++;
  const a = l.pts[i - 1], b = l.pts[i];
  const seg = l.acc[i] - l.acc[i - 1] || 1;
  const k = (t - l.acc[i - 1]) / seg;
  return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k };
}
/** Where a spot lies along a line: `s` of its nearest point and how far off it is. */
export function project(l: Line, p: Spot): { s: number; d: number } {
  let best = { s: 0, d: Infinity };
  for (let i = 1; i < l.pts.length; i++) {
    const a = l.pts[i - 1], b = l.pts[i];
    const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / L2));
    const q = { x: a.x + dx * t, z: a.z + dz * t };
    const d = dist(p, q);
    if (d < best.d) best = { s: l.acc[i - 1] + t * Math.sqrt(L2), d };
  }
  return best;
}
/** The line's heading at `s` (the way he walks along it). */
export function headingAt(l: Line, s: number): number {
  return headingTo(pointAt(l, Math.max(0, s - 0.5)), pointAt(l, Math.min(l.length, s + 0.5)));
}
/** The points of a line strictly between `s0` and `s1` (a walk's way, golden's `via`). */
export function between(l: Line, s0: number, s1: number): Spot[] {
  return l.pts.filter((_, i) => l.acc[i] > s0 + 0.6 && l.acc[i] < s1 - 0.6).map((p) => ({ x: p.x, z: p.z }));
}

/* ------------------------------------------------------ the shore path ---- */

/** The shore path's r on the open bank (its land side heather, its water side the slope). */
export const PATH_R = 19.5;
/** Half its trodden width (m). */
export const PATH_HALF = 0.42;
/** The path's r at θ: on the open bank `PATH_R`; round the hide's north side it swings out. */
export function pathR(th: number): number {
  return th >= 128 ? PATH_R + ((th - 128) / 14) * 2 : PATH_R;
}

/**
 * The shore path: from the sand trail's node by the bird hide, north round the hide's
 * land side (west of it: between the hide and the water the reed belt stands thick), past
 * the "Ken je roep" bench, then east along the top of the north bank to past bay C.
 */
export const PATH: Line = measure([
  { x: 22.5, z: -10.5 },                 // the trail node in front of the hide (Paths.ts 'birdhide')
  { x: 22.9, z: -8.2 },
  { x: 24.9, z: -6.2 },                  // between the bench and the hide
  { x: 28.0, z: -5.7 },
  ...Array.from({ length: 52 }, (_, i) => polar(142 - i * 2, pathR(142 - i * 2))), // 142° → 40°
]);

/** Where the path's open stretch along the north bank begins (s): from here east the way
 *  is the bank's own (the stations, the coves). */
export const PATH_BANK_S = project(PATH, polar(140, pathR(140))).s;

/** His way from the marker to the path: up past the hide's land side (golden's `via`). */
export const APPROACH: readonly Spot[] = [{ x: 22.2, z: -14.0 }];

/* ------------------------------------------------------------ the coves ---- */

export type BayId = 'A' | 'B' | 'C';
export const BAY_IDS: readonly BayId[] = ['A', 'B', 'C'];
/** The side of a cove he searches it from (+1: he stands at its right, in the lower right
 *  of the search's picture; −1: the left). */
export type Side = 1 | -1;
export const SIDES: readonly Side[] = [1, -1];

/** A framed view as `k.frame` takes it. */
export interface ViewSpec {
  at: Spot; heading: number; halfW: number; halfD: number; tall: number; pitchDeg: number;
  insetTop: number; insetBottom: number; include?: readonly { x: number; z: number; h: number; r?: number }[];
  seconds?: number;
  /** (kit FrameSpec, run 7 additive) how near the lens may come, how low over the ground */
  near?: number; lensUp?: number;
}

/** The search lens over a cove: looking down on it from the bank (its water line across
 *  the picture), from over his shoulder — he stands at the cove's side (`side` m along the
 *  bank, `back` m up from its middle), in a lower corner of the picture, never between the
 *  lens and a frog — turned across the cove from his side, so the water line runs aslant:
 *  from his right `turn` (rad) off the cove's middle line, from his left the mirror of that
 *  about the cove's own water line (each cove's water line lies a little askew to its middle
 *  line: from either side the lens looks across it at the same angle, and the water's edge,
 *  where the frog sits, runs corner to corner through the picture). The lens is the same at
 *  every cove and either side (decision 1: the frog reads at 50-65 px wherever it sits);
 *  WHICH side is the nook's. */
export const COVE_LENS = { halfW: 0.95, halfD: 0.55, tall: 0.4, pitchDeg: 56, insetTop: 112, insetBottom: 28, r: 0.22, side: 1.4, back: 0.7, turn: 0.3 } as const;

/** A spot in a cove's frame: `u` across (+: his right as he faces the water), `v` toward
 *  the water from the cove's middle. */
export interface UV { u: number; v: number }

/**
 * A nook the frog may sit in: at the water's edge, among the sedge and the veenmos (cove
 * frame), never more than a long step up from it — a heikikker calls from the water, and his
 * late hint (`hintRingOf`) rings on the water just in front of him, at the same distance at
 * every nook — the side he searches it from (so the picture's framing changes with the nook:
 * the boy in the lower left or the lower right, the water's edge running corner to corner the
 * one way or the other), how the frog sits there (`turn` rad off the lens's line of sight to
 * it: a three-quarter back view, its brown back and a flank, the same at every nook), and
 * where it lands in the search's 1280×800 picture (`px`: its middle, pinned by
 * ven.places.test.ts against the very lens the kit fits — a play's frog keeps well away from
 * where it sat in the last play's picture, `venLayout`).
 */
export interface Nook extends UV { side: Side; turn: number; px: readonly [number, number] }

/** What lies in one cove: its own nooks (six: three searched from either side, spread over
 *  the picture along the water's edge), its own look-alike slots (frog-sized moss clods up the
 *  bank, a heath blue on a cotton-grass head, a stonechat on a dry stalk). A nook the frog does
 *  not use this play may hold a clod too: every nook has the same sedge round it, and an empty
 *  one is never a giveaway. */
export interface CoveSpec { nooks: readonly Nook[]; clods: readonly UV[]; butterflies: readonly UV[]; birds: readonly UV[] }

/** The three coves' own nooks and slots (chosen over the search's picture: along each cove's
 *  water's edge, which runs corner to corner through the picture the one way from his right
 *  and the other from his left, the eighteen nooks fall at many places over it, never its
 *  middle, never at the boy; each cove's six spread so that whatever the plays before, the
 *  next one has a nook far from them). */
export const COVES: Readonly<Record<BayId, CoveSpec>> = {
  A: {
    nooks: [
      { u: -1.85, v: 0.83, side: 1, turn: -0.9, px: [360, 221] }, { u: -1.25, v: 0.57, side: 1, turn: 0.9, px: [438, 276] },
      { u: 0.6, v: 0.21, side: 1, turn: -0.9, px: [777, 421] }, { u: -0.65, v: 0.53, side: -1, turn: 0.9, px: [464, 420] },
      { u: 1.2, v: 0.24, side: -1, turn: -0.9, px: [804, 277] }, { u: 1.8, v: 0.19, side: -1, turn: 0.9, px: [890, 234] },
    ],
    clods: [{ u: 0.8, v: -0.2 }, { u: 0.3, v: 0.75 }, { u: -0.6, v: -0.7 }, { u: 0.6, v: -0.7 }, { u: -0.4, v: 0.1 }],
    butterflies: [{ u: -1.2, v: 0.0 }, { u: 0.25, v: -0.3 }],
    birds: [{ u: 0.0, v: -0.7 }, { u: 0.0, v: 0.4 }],
  },
  B: {
    nooks: [
      { u: -1.6, v: 0.93, side: 1, turn: -0.9, px: [410, 219] }, { u: -0.95, v: 0.62, side: 1, turn: 0.9, px: [496, 283] },
      { u: 0.75, v: 0.31, side: 1, turn: 0.9, px: [813, 415] }, { u: -0.4, v: 0.56, side: -1, turn: 0.9, px: [491, 355] },
      { u: 0.2, v: 0.42, side: -1, turn: -0.9, px: [617, 301] }, { u: 1.25, v: 0.36, side: -1, turn: 0.9, px: [782, 202] },
    ],
    clods: [{ u: -0.6, v: -0.7 }, { u: -0.4, v: 0.1 }, { u: 0.5, v: -0.7 }, { u: -0.3, v: -0.4 }, { u: 0.5, v: -0.1 }],
    butterflies: [{ u: -0.8, v: -0.2 }, { u: 0.8, v: -0.3 }],
    birds: [{ u: 0.0, v: -0.7 }, { u: 1.25, v: -0.2 }],
  },
  C: {
    nooks: [
      { u: -1.6, v: 1.06, side: 1, turn: -0.9, px: [420, 205] }, { u: -1.0, v: 0.76, side: 1, turn: 0.9, px: [498, 263] },
      { u: 0.65, v: 0.34, side: 1, turn: 0.9, px: [793, 403] }, { u: -0.4, v: 0.68, side: -1, turn: -0.9, px: [474, 341] },
      { u: 0.15, v: 0.55, side: -1, turn: 0.9, px: [589, 292] }, { u: 1.2, v: 0.36, side: -1, turn: -0.9, px: [774, 203] },
    ],
    clods: [{ u: -1.2, v: 0.4 }, { u: -0.4, v: 0.2 }, { u: -0.6, v: -0.7 }, { u: 0.5, v: -0.7 }, { u: -0.3, v: -0.4 }],
    butterflies: [{ u: 1.1, v: 0.0 }, { u: 0.2, v: -0.15 }],
    birds: [{ u: 0.0, v: -0.7 }, { u: -0.8, v: -0.2 }],
  },
};

/** How far (px) a play's frog sits at least from where it sat in the last play's search
 *  picture (and, while enough nooks are left, the play before that): a child who
 *  remembers the place finds an empty one, and searches. */
export const NOOK_GAP_PX = 160;
/** From the plays before the last one the frog keeps as far as it can, up to this (px):
 *  beyond it every nook is far enough and the pick is the seed's. */
const SPREAD_ENOUGH_PX = 240;

/** Each cove's moss cushion: a round of bright veenmos in its middle, just up from the
 *  water (frame-local u, v). After the mission a frog sits on bay B's, calling. */
export const CUSHION = { u: 0.04, v: -0.06, r: 0.3 } as const;

/** A frog's spot in a cove (world), the way it sits there and the nook it is. */
export type FrogSpot = Spot & { yaw: number; side: Side; nook: number };

export interface Bay {
  id: BayId;
  th: number;
  /** the cove's frame: its middle just up from the water line, `v` toward the water */
  frame: Frame;
  /** the frog's nooks (world), each with the way it sits and the side he searches from */
  nooks: readonly FrogSpot[];
  /** where he stands to search it from either side: up the bank, to that side */
  stands: Readonly<Record<Side, Place>>;
  /** the path point above each stand (he leaves the path there) */
  offs: Readonly<Record<Side, Spot>>;
  /** where the cove's calling frog floats, out on the water to one side */
  chorus: Spot;
  views: { search: Readonly<Record<Side, ViewSpec>> };
  /** how far (rad) the search's lens is turned off the cove's middle line from either side
   *  (from his left: the mirror of his right about the cove's own water line) */
  turns: Readonly<Record<Side, number>>;
  /** the cove's own look-alike slots (world) */
  slots: { clods: readonly Spot[]; butterflies: readonly Spot[]; birds: readonly Spot[] };
}

/**
 * The frog's rings in front of him (the search's late hint, his song): on open water —
 * where it is `depth` deep, past the sedge (it grows to 4 cm deep) — straight out from him
 * toward the ven, at least `near` m from him. Every nook lies so that this water is `near`
 * to `far` m in front of it (ven.places.test pins all eighteen), and every hint ring spreads
 * to `size` m: at whichever nook he sits, a struggling or muted child sees the same rings at
 * the same distance from him (decision 1).
 */
export const HINT_RING = { depth: -0.05, near: 0.9, far: 1.0, size: 0.6 } as const;

/** The coves' angles: A nearest the hide, C furthest east. */
const BAY_TH: Readonly<Record<BayId, number>> = { A: 84, B: 68, C: 46 };
/** Where each cove's calling frog floats (θ): beside its cove, never in another's. */
const CHORUS_TH: Readonly<Record<BayId, number>> = { A: 100, B: 59, C: 36 };

function bay(id: BayId): Bay {
  const th = BAY_TH[id], spec = COVES[id];
  const rw = shoreR(th, 0.1);
  const mid = polar(th, rw + 0.42);
  const frame: Frame = { ...mid, heading: headingTo(mid, C) };
  // (the cove's water line lies askew to its middle line by `skew`: from his left the lens
  // turns the mirror of his right's turn about it, so both pictures look across the water's
  // edge at the same angle)
  const skew = Math.atan2(waterV(frame, 1) - waterV(frame, -1), 2);
  const turns = { 1: COVE_LENS.turn, [-1]: 2 * skew - COVE_LENS.turn } as Record<Side, number>;
  // (the frog sits turned `turn` off the search lens's line of sight to him: the same
  // three-quarter back view at every nook, whichever side the lens looks from)
  const lensNear = (side: Side): Spot => searchLensNear(frame, turns[side]);
  const nooks = spec.nooks.map((n, i): FrogSpot => {
    const p = atLocal(frame, n.u, n.v);
    return { ...p, yaw: headingTo(lensNear(n.side), p) + n.turn, side: n.side, nook: i };
  });
  const standOf = (side: Side): Place => {
    const p = atLocal(frame, side * COVE_LENS.side, -COVE_LENS.back);
    return { ...p, r: 0.7, heading: headingTo(p, atLocal(frame, -side * 0.3, 0.25)) };
  };
  const stands = { 1: standOf(1), [-1]: standOf(-1) } as Record<Side, Place>;
  const offs = { 1: pointAt(PATH, project(PATH, stands[1]).s), [-1]: pointAt(PATH, project(PATH, stands[-1]).s) } as Record<Side, Spot>;
  // (on the water ~2.5 m along the bank from the cove, where it is a hand deep: floating)
  const cth = CHORUS_TH[id];
  const chorus = polar(cth, shoreR(cth, -0.07));
  const searchOf = (side: Side): ViewSpec => ({
    at: atLocal(frame, 0, 0.06), heading: frame.heading + turns[side],
    halfW: COVE_LENS.halfW, halfD: COVE_LENS.halfD, tall: COVE_LENS.tall, pitchDeg: COVE_LENS.pitchDeg,
    insetTop: COVE_LENS.insetTop, insetBottom: COVE_LENS.insetBottom,
    include: [{ x: stands[side].x, z: stands[side].z, h: RANGER_STAND_HEIGHT, r: COVE_LENS.r }],
  });
  const world = (q: readonly UV[]): Spot[] => q.map((x) => atLocal(frame, x.u, x.v));
  return {
    id, th, frame, nooks, stands, offs, chorus, turns,
    views: { search: { 1: searchOf(1), [-1]: searchOf(-1) } as Record<Side, ViewSpec> },
    slots: { clods: world(spec.clods), butterflies: world(spec.butterflies), birds: world(spec.birds) },
  };
}

/** About where the search's lens stands over a cove, turned `turn` off its middle line (its
 *  ground spot: ~1.9 m back from the view's middle along its heading; the fit puts it within
 *  a few cm). */
function searchLensNear(frame: Frame, turn: number): Spot {
  return atLocal({ ...atLocal(frame, 0, 0.06), heading: frame.heading + turn }, 0, -1.9);
}

/** How far out (v, in a cove's frame) at `u` across it the water is `HINT_RING.depth` deep. */
function waterV(frame: Frame, u: number): number {
  let v = -1;
  while (v < 4 && above(atLocal(frame, u, v)) > HINT_RING.depth) v += 0.01;
  return v;
}

/** The frog's rings in front of him (`HINT_RING`): see there. */
export function hintRingOf(b: Bay, at: Spot, near: number = HINT_RING.near, depth: number = HINT_RING.depth): Spot {
  const p = toLocal(b.frame, at);
  let d = near;
  while (d < 4 && above(atLocal(b.frame, p.u, p.v + d)) > depth) d += 0.01;
  return atLocal(b.frame, p.u, p.v + d);
}

export const BAYS: Readonly<Record<BayId, Bay>> = { A: bay('A'), B: bay('B'), C: bay('C') };

/** Is `q` hidden behind the boy in the search's picture from `side` (seen from above his big
 *  hair shades the ground beyond him, away from the lens)? A look-alike is never laid there.
 *  `up` (run 7 ven-life): a look-alike that stands up — the stonechat at the top of its
 *  0.62 m stalk, the heath blue on its cotton-grass head — counts by its top: seen down the
 *  steep lens it sits further from the lens than its foot, and beside his big hair (wider than
 *  his shoulders) it reads as perched on him. */
export function underBoy(b: Bay, side: Side, q: Spot, up = 0): boolean {
  const L = searchLensNear(b.frame, b.turns[side]), B = b.stands[side];
  const ex = B.x - L.x, ez = B.z - L.z, e2 = ex * ex + ez * ez || 1;
  const dx = q.x - L.x, dz = q.z - L.z;
  const t0 = (dx * ex + dz * ez) / e2;
  // (a top `up` m over its foot lands ~0.7·up further on down the lens's 56° view)
  const t = t0 + (up * 0.7) / Math.sqrt(e2);
  if (t < 0.8 || t > 2.3 + (up > 0 ? 0.4 : 0)) return false;
  const lateral = Math.abs(dx * ez - dz * ex) / Math.sqrt(e2);
  return lateral < 0.42 + 0.15 * (t - 1) + (up > 0 ? 0.3 : 0);
}

/** How tall (m) each kind of look-alike stands (its top, for `underBoy`). */
export const LOOK_UP: Readonly<Record<string, number>> = { bird: 0.62, butterfly: 0.36 };

/** A spot in a cove's frame (world). */
export function inCove(b: Bay, u: number, v: number): Spot { return atLocal(b.frame, u, v); }

/** How far (m) the song's lens stands out over the water from the frog (the fit may stand
 *  it a little further, so the boy is whole): near enough that the frog reads ~90-110 px. */
export const SING_NEAR = 1.4;

/** How high (m) over the water the bank is where the found frog sings: its very edge. */
export const EDGE_H = 0.035;
/** Where the found frog sings: at the water's very edge, straight down the bank from his
 *  nook (a hop or two: every nook lies within a long step of it) and a little away from the
 *  boy's side; a frog already at the edge sings where he sits. */
export function edgeOf(b: Bay, frog: FrogSpot): FrogSpot {
  const fl = toLocal(b.frame, frog);
  const u = fl.u - frog.side * 0.15;
  let v = fl.v;
  while (v < fl.v + 1.5 && above(atLocal(b.frame, u, v)) > EDGE_H) v += 0.01;
  if (v - fl.v < 0.1) return frog;
  return { ...atLocal(b.frame, u, v), yaw: frog.yaw, side: frog.side, nook: frog.nook };
}

/**
 * The song (after the find): he stays where he searched; the frog sings at the water's edge
 * (`edgeOf`); the lens looks back from just over the water — the frog big in front,
 * singing three-quarters toward it (his throat on its side), the boy behind him on the
 * bank, whole and to one side (one soft dip-cut: a turn that big is never a swing). The
 * heading is the bank's straight back from the water, turned the least that sets the boy
 * 16-28° off the frog (as the lens sees them), with the lens over the water. `yaw`: the way
 * the frog faces while he sings (his nose turned 0.6 rad from the lens toward the boy's
 * side of the picture: three-quarters to the lens, his face and throat in it, singing for
 * the boy behind him).
 */
export function singOf(b: Bay, sat: FrogSpot): { stand: Place; view: ViewSpec; yaw: number; at: FrogSpot } {
  const frog = edgeOf(b, sat);
  const stand = b.stands[frog.side];
  const out = b.frame.heading + Math.PI;
  let heading = out, best = -Infinity, boySide = 1;
  for (let k = 0; k <= 20; k++) {
    const dl = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.1;
    const h = out + dl;
    const fx = Math.sin(h), fz = Math.cos(h);
    const lens = { x: frog.x - fx * 1.8, z: frog.z - fz * 1.8 };
    const bx = stand.x - lens.x, bz = stand.z - lens.z;
    const ang = Math.atan2(fx * bz - fz * bx, fx * bx + fz * bz) / RAD;
    // (over the water, the boy 16-28° to one side as the lens sees him, the least turn)
    const score = (above(lens) < -0.05 ? 10 : above(lens) < 0.05 ? 4 : 0) + (Math.abs(ang) >= 16 && Math.abs(ang) <= 28 ? 6 : -Math.abs(Math.abs(ang) - 22) / 10) - Math.abs(dl);
    if (score > best) { best = score; heading = h; boySide = ang >= 0 ? 1 : -1; }
  }
  const view: ViewSpec = {
    at: { x: frog.x, z: frog.z }, heading, halfW: 0.2, halfD: 0.1, tall: 0.12, pitchDeg: 10,
    insetTop: 110, insetBottom: 110, seconds: 1.6, near: SING_NEAR, lensUp: 0.3,
    include: [{ x: stand.x, z: stand.z, h: RANGER_STAND_HEIGHT, r: 0.16 }],
  };
  // (toward the lens is heading + π; his nose turns toward the boy's side of the picture)
  const yaw = heading + Math.PI + boySide * 0.6;
  return { stand, view, yaw, at: frog };
}

/** The other coves answer him: the nearest first (its frog comes up and calls, rings
 *  round it), then the far one. */
export function answerOrder(id: BayId): BayId[] {
  const at = (x: BayId): Spot => BAYS[x].chorus;
  return BAY_IDS.filter((x) => x !== id).sort((p, q) => dist(at(p), BAYS[id].frame) - dist(at(q), BAYS[id].frame));
}

/**
 * The answer: once he has sung, the lens draws calmly back over the water until the
 * nearest answering cove's water is in the picture with him — the singing frog at the
 * water's edge, the boy on the bank behind, the rings where the other frog answers. One
 * eased pull-back; the plop that follows is seen in it too. `answer` (run 7 ven-life): the
 * frog that answers first sits there instead (the rare blue frog on the moss beside him):
 * the picture draws back just far enough for it.
 */
export function answerView(b: Bay, sat: FrogSpot, answer?: Spot): ViewSpec {
  const frog = edgeOf(b, sat);
  const other = answer ?? BAYS[answerOrder(b.id)[0]].chorus;
  const stand = b.stands[frog.side];
  const mid = { x: (frog.x + other.x) / 2, z: (frog.z + other.z) / 2 };
  const half = dist(frog, other) / 2;
  return {
    at: mid, heading: headingTo(C, mid), halfW: half + 0.9, halfD: 0.9, tall: 0.3, pitchDeg: 24,
    insetTop: 120, insetBottom: 40, seconds: 2.2,
    include: [{ x: stand.x, z: stand.z, h: RANGER_STAND_HEIGHT, r: 0.2 }, { x: frog.x, z: frog.z, h: 0.15 }],
  };
}

/** Where the frog plops into the ven from where he sang (`edgeOf`): out into the water
 *  and along the edge, away from the boy (sideways in the pictures, never toward a lens). */
export function plopOf(b: Bay, sat: FrogSpot): Spot {
  const fl = toLocal(b.frame, edgeOf(b, sat));
  // (out to where the water is a few centimetres deep: the bank's slope is each cove's own)
  let v = Math.max(1.1, fl.v + 0.5);
  while (v < 3 && above(atLocal(b.frame, fl.u - sat.side * 0.6, v)) > -0.03) v += 0.05;
  return atLocal(b.frame, fl.u - sat.side * 0.6, v);
}

/* ---------------------------------------------------------- the route ---- */

/** His whole way to a cove (golden's): the marker, up past the hide, along the path to
 *  above the side of the cove he searches it from, down the bank to where he stands. */
export function routeOf(b: Bay, side: Side): Line {
  const off = b.offs[side], stand = b.stands[side];
  const end = project(PATH, off).s;
  return measure([MARKER, ...APPROACH, ...PATH.pts.filter((_, i) => PATH.acc[i] < end - 0.3), off, { x: stand.x, z: stand.z }]);
}
const ROUTES = new Map<string, Line>();
for (const id of BAY_IDS) for (const side of SIDES) ROUTES.set(`${id}${side}`, routeOf(BAYS[id], side));
/** A cove's route to the side he searches it from (made once). */
export function route(id: BayId, side: Side): Line { return ROUTES.get(`${id}${side}`)!; }

/* -------------------------------------------------------- the stations ---- */

/**
 * Each cove's two stations on the path (θ): the first on the bank's first stretch past the
 * hide, the second far enough on that every order fits between them (the moss, the dry
 * path's few metres, then the adder's approach: ≥ 13 m of path) and close enough before
 * the cove that the last moment and its dry path fit before it. Each cove's own: three
 * plays in a row, three places.
 */
export const STATION_TH: Readonly<Record<BayId, readonly [number, number]>> = { A: [136, 96], B: [130, 86], C: [124, 74] };
export type StationIndex = 0 | 1;

export interface Station {
  i: StationIndex;
  th: number;
  /** its spot on the path, and where it lies along the cove's route (m) */
  at: Spot;
  s: number;
}
/** A cove's two stations (`s` along his way to the side he searches it from). */
export function stationsOf(id: BayId, side: Side): readonly [Station, Station] {
  const l = route(id, side);
  return STATION_TH[id].map((th, i) => {
    const at = polar(th, pathR(th));
    return { i: i as StationIndex, th, at, s: project(l, at).s };
  }) as unknown as [Station, Station];
}

/** How far before her (m along the route) his walk to the adder ends. */
export const ADDER_BEFORE = 3.8;
/** The adder's spot may lie this far (m) either way along the path from her station. */
export const ADDER_SHIFT = 1.0;
/** Within this (m) of her he has come too close: she lifts her head and hisses (the reach);
 *  within `ADDER_WARN` she only notices him (a cue, nothing more). */
export const ADDER_NEAR = 2.3;
export const ADDER_WARN = 3.3;

/** The adder at a station: on the path, coiled, turned `turn` off its line; `s` along the
 *  cove's route. */
export function adderAt(id: BayId, side: Side, st: Station, shift: number, turn: number): Spot & { yaw: number; s: number } {
  const l = route(id, side);
  const s = st.s + shift;
  return { ...pointAt(l, s), yaw: headingAt(l, s) + Math.PI / 2 + turn, s };
}
/** Where his walk up to her ends (`ADDER_BEFORE` m before her on his way). */
export function adderApproach(id: BayId, side: Side, adderS: number): Place {
  const l = route(id, side);
  const s = adderS - ADDER_BEFORE;
  return { ...pointAt(l, s), r: 0.9, heading: headingAt(l, s) };
}
/** Where she slides off to: up the bank into the heather. */
export function adderHeather(a: Spot): Spot {
  const p = polarOf(a);
  return polar(p.th + 1.5, p.r + 2.6);
}
/** The one calm shot while her words are read, and held while he keeps his distance (his
 *  feet free): from the heather side, square across the path toward the water — him on
 *  one side, her coiled on the warm sand on the other, both whole (never at the lens: the
 *  lens is up the bank, she lies on the path). */
export function adderView(a: Spot, me: Spot): ViewSpec {
  const d = Math.max(0.1, dist(a, me));
  const mid = { x: (a.x + me.x) / 2, z: (a.z + me.z) / 2 };
  return {
    at: mid, heading: headingTo(mid, C), halfW: d / 2 + 0.8, halfD: 0.6,
    tall: 0.5, pitchDeg: 28, insetTop: 120, insetBottom: 40, seconds: 1.5,
    include: [{ x: me.x, z: me.z, h: RANGER_STAND_HEIGHT, r: 0.25 }],
  };
}

/** How far (rad) he stands turned off her in her hold, toward the water (`adderHoldHeading`). */
export const ADDER_ASIDE = 0.32;
/** His heading in her hold. The hold's lens is his walk lens behind him (so his turn keys
 *  turn him: review r3 of ven-world), and straight behind him his body hid her coiled on the
 *  path ahead (ven-life: she showed only as a head beside his shoulder as she reared). Turned
 *  `ADDER_ASIDE` toward the water, in that picture she lies beside him on the heather side,
 *  where she slides off, away from him; walking on as he faces still brings him into her
 *  reach. */
export function adderHoldHeading(me: Spot, a: Spot): number {
  const h = headingTo(me, a);
  const heath = adderHeather(a);
  // (the picture's right of a lens looking along h: (−cos h, sin h); a larger heading turns
  // him to the left, so she moves to the right of his body)
  const onRight = (heath.x - a.x) * -Math.cos(h) + (heath.z - a.z) * Math.sin(h) > 0;
  return h + (onRight ? ADDER_ASIDE : -ADDER_ASIDE);
}

/** The soft moss across the path and down to the water at a station: a strip `2a` wide from
 *  `top` (above the path, on the heather side) down to `low` (the water's edge); its frame
 *  (`u` along the path, `v` down the bank toward the water) at its middle, `b` half long. */
export interface Carpet extends Frame { a: number; b: number; th: number; top: Spot; low: Spot }
/** Its half-width along the path (m); it runs from `CARPET_TOP` m above the path's line
 *  down to the water. */
export const CARPET_A = 0.95;
export const CARPET_TOP = 1.2;
/** He comes this close (m along his way to its near rim) before it is named. */
export const CARPET_SEEN = 5;
/** His walk past it ends this far (m) beyond its far rim. */
export const CARPET_PAST = 1.8;

export function carpetAt(st: Station): Carpet {
  const top = pathR(st.th) + CARPET_TOP, low = shoreR(st.th, 0.02);
  const mid = polar(st.th, (top + low) / 2);
  return { ...mid, heading: headingTo(mid, C), a: CARPET_A, b: (top - low) / 2, th: st.th, top: polar(st.th, top), low: polar(st.th, low) };
}
/** How deep in the carpet a spot is (< 1 inside its rim): its distance from the strip's
 *  middle line, over its half-width, squared; beyond its top end (up the bank, where the
 *  strip fades out) it is dry at once — a square end, as drawn. */
export function inCarpet(c: Carpet, p: Spot): number {
  const dx = c.low.x - c.top.x, dz = c.low.z - c.top.z;
  const L2 = dx * dx + dz * dz || 1;
  const t = ((p.x - c.top.x) * dx + (p.z - c.top.z) * dz) / L2;
  if (t < 0) return 9; // (above its top, on the heather side: dry)
  return (segDist(p, c.top, c.low) / c.a) ** 2;
}
/** A boot in it: well inside its rim (its feathered edge is the dry bank's). */
export const CARPET_WET = 0.8;
/** The dry way round it on the heather side (golden's `via`): up above its top, across,
 *  and back down to the path beyond it. */
export function carpetRound(c: Carpet): Spot[] {
  const r0 = pathR(c.th);
  const dth = (CARPET_A + 1.1) / (r0 * RAD);
  return [polar(c.th + dth, r0 + 1.1), polar(c.th + dth * 0.45, r0 + CARPET_TOP + 1.1), polar(c.th - dth * 0.45, r0 + CARPET_TOP + 1.1), polar(c.th - dth, r0 + 1.1)];
}
/** Where his walk past the carpet ends (beyond it on his way). */
export function carpetPast(id: BayId, side: Side, st: Station): Place {
  const l = route(id, side);
  const s = st.s + CARPET_A + CARPET_PAST;
  return { ...pointAt(l, s), r: 0.9, heading: headingAt(l, s) };
}

/** "Het droge pad is vrij": he walks on at least this far (m), within the level's wait. */
export const GO_AWAY = 3;
/** …and golden walks this far on, along his way. */
export const GO_ON = 4.2;
/** The goal of the walk on lies at least this far (m) from where he stands. */
export const GO_CLEAR = GO_AWAY + 0.6;

/** The shore path on east past bay C (its last few metres of open bank): where the walk on
 *  goes when his way to the cove has no room left ahead of him. */
const PATH_ON: Line = measure([...PATH.pts, ...[38, 36, 34, 32, 30, 28, 26, 24, 22].map((th) => polar(th, PATH_R))]);

/**
 * The dry path's walk on, set when the moment starts, from where he really stands (he may
 * have ended the moment before it further on: walked at the adder as she slid off, or round
 * her and on): `GO_ON` along his way beyond the further of the moment's planned start `s0`
 * and his own place on it, and at least `GO_CLEAR` from his feet — where his way down to
 * the cove has no room left, on along the shore path. `from`: his way behind him (the
 * moment's 'animals': walking on is walking away from it). Pure.
 */
export function padGoal(id: BayId, side: Side, s0: number, me: Spot): { to: Place; from: Spot; s: number } {
  const l = route(id, side);
  const s = Math.max(s0, project(l, me).s);
  const from = pointAt(l, s - 6);
  // (far enough from his feet, and further from his way behind him than he is: where his
  // way turns back down to the cove's near side, that is not walking on)
  const away = dist(me, from) + 1;
  const ahead = (line: Line, s1: number): Place | null => {
    for (let q = Math.min(line.length, s1); ; q = Math.min(line.length, q + 0.25)) {
      const p = pointAt(line, q);
      if (dist(p, me) >= GO_CLEAR && dist(p, from) >= away) return { ...p, r: 0.7, heading: headingAt(line, q) };
      if (q >= line.length) return null;
    }
  };
  const to = ahead(l, s + GO_ON)
    ?? ahead(PATH_ON, Math.max(project(PATH_ON, pointAt(l, s)).s, project(PATH_ON, me).s) + GO_ON)
    ?? { ...pointAt(PATH_ON, PATH_ON.length), r: 0.7, heading: headingAt(PATH_ON, PATH_ON.length) };
  return { to, from, s };
}

/* ------------------------------------------------------------ the way ---- */

/** One step of his way to the frogs, in the order he meets them (`s`: m along the route). */
export type WayStep =
  /** the frogs fall silent: he stops and listens (a walk to `at` first) */
  | { kind: 'listen'; s: number; at: Spot }
  /** the adder on the path at a station: his walk ends `ADDER_BEFORE` m before her */
  | { kind: 'adder'; s: number; station: StationIndex; adder: Spot & { yaw: number; s: number }; approach: Place }
  /** the soft moss across the path at a station: his walk goes on past it */
  | { kind: 'modder'; s: number; station: StationIndex; carpet: Carpet; past: Place; round: Spot[] }
  /** the dry path, right after the moment before it: he walks on from `s` to `to`, away
   *  from `from` (his way behind him) */
  | { kind: 'pad'; s: number; to: Place; from: Spot }
  /** at the cove: down the bank to where he searches */
  | { kind: 'bay'; s: number };

/** The stretch of his way (m along the route) a step takes: listening stops keep off it. */
export function spanOf(st: WayStep): readonly [number, number] {
  switch (st.kind) {
    case 'adder': return [st.s - 0.25, st.adder.s + 1.2];
    case 'modder': return [st.s, st.s + CARPET_SEEN + 2 * CARPET_A + CARPET_PAST];
    case 'pad': return [st.s, st.s + GO_ON];
    default: return [st.s, st.s];
  }
}

/**
 * His way to this play's cove, step by step (pure; the script walks it): the two dangers at
 * their stations in the trial's order, the dry path right after the one it follows, and
 * `listens` listening stops spread over the free stretches of the way (the cove's own
 * listening stop comes on top: a fresh ranger, `trailLegs` 2, stops twice). `s` is metres
 * along `route(bay)`.
 */
export function wayOf(laid: Pick<VenLaid, 'bay' | 'side' | 'order' | 'stations' | 'adderShift' | 'adderTurn'>, listens: number): WayStep[] {
  const id = laid.bay, side = laid.side;
  const l = route(id, side);
  const sts = stationsOf(id, side);
  const steps: WayStep[] = [];
  let lastEnd = 0;
  for (const enc of laid.order) {
    if (enc === 'adder-ven') {
      const st = sts[laid.stations['adder-ven']];
      const adder = adderAt(id, side, st, laid.adderShift, laid.adderTurn);
      const approach = adderApproach(id, side, adder.s);
      steps.push({ kind: 'adder', s: adder.s - ADDER_BEFORE, station: st.i, adder, approach });
      lastEnd = adder.s - ADDER_BEFORE;
    } else if (enc === 'modder-ven') {
      const st = sts[laid.stations['modder-ven']];
      const carpet = carpetAt(st);
      const past = carpetPast(id, side, st);
      steps.push({ kind: 'modder', s: st.s - CARPET_A - CARPET_SEEN, station: st.i, carpet, past, round: carpetRound(carpet) });
      lastEnd = st.s + CARPET_A + CARPET_PAST;
    } else if (enc === 'pad-ven') {
      // (he walks on along his way, away from where he came from: as planned from where the
      // moment before it ends; the script sets it again from where he really stands)
      const g = padGoal(id, side, lastEnd, pointAt(l, lastEnd));
      steps.push({ kind: 'pad', s: lastEnd, to: g.to, from: g.from });
    }
  }
  const busy = steps.map(spanOf);
  const sOff = project(l, BAYS[id].offs[side]).s;
  for (const s of listenStops(Math.max(0, Math.round(listens)), 0, sOff, busy)) steps.push({ kind: 'listen', s, at: pointAt(l, s) });
  steps.push({ kind: 'bay', s: l.length });
  // (in order along the way; the dry path straight after the moment it follows)
  return steps.map((x, i) => ({ x, i })).sort((p, q) => (p.x.s - q.x.s) || (p.i - q.i)).map((p) => p.x);
}

/**
 * Where on his way the frogs fall silent by themselves (the listening stops before the
 * cove): `n` spots spread evenly between `from` and `to` (m along the route), never within
 * `keep` m of a moment's stretch (`busy`) nor within 5 m of each other, never in the first
 * 6 or the last 4 m. Fewer when the way is short.
 */
export function listenStops(n: number, from: number, to: number, busy: readonly (readonly [number, number])[], keep = 2.5): number[] {
  if (n <= 0) return [];
  const ok = (s: number): boolean => s > from + 6 && s < to - 4 && !busy.some(([a, b]) => s > a - keep && s < b + keep);
  const out: number[] = [];
  for (let i = 1; i <= n; i++) {
    const want = from + ((to - from) * i) / (n + 1);
    // the nearest free spot to its even share, either way, in half-metre steps
    let got: number | null = null;
    for (let d = 0; d < (to - from) && got === null; d += 0.5) {
      for (const s of [want + d, want - d]) if (ok(s) && out.every((o) => Math.abs(o - s) > 5)) { got = s; break; }
    }
    if (got !== null) out.push(got);
  }
  return out.sort((a, b) => a - b);
}

/* ------------------------------------------------------------- the cover ---- */

/** The sedge tussocks close round every nook (u, v off it, size): every nook gets the same
 *  ring (the frog's, an empty one, one with a moss clod in it), so the cover never marks
 *  the real one. */
const RING: readonly (readonly [number, number, number])[] = [[-0.28, -0.1, 0.8], [0.3, -0.07, 0.84], [0.04, -0.33, 0.88], [-0.22, 0.24, 0.72], [0.25, 0.22, 0.74], [-0.12, -0.24, 0.66], [0.17, -0.22, 0.68]];

/**
 * A cove's sedge (the CoverField's clumps: 'grass' tussocks), the same way for the home
 * and the tests: a ring round each of its nooks, and a scatter over the cove that keeps the
 * look-alikes' slots, the moss cushion and where he stands (either side) open.
 * Deterministic.
 */
export function coveClumps(b: Bay): Clump[] {
  const rnd = stream(101 + BAY_IDS.indexOf(b.id) * 17);
  const out: Clump[] = [];
  const frogs: readonly Spot[] = b.nooks;
  const slots = [...b.slots.clods, ...b.slots.butterflies, ...b.slots.birds];
  const cushion = atLocal(b.frame, CUSHION.u, CUSHION.v);
  for (const f of frogs) {
    const fl = toLocal(b.frame, f);
    for (const [u, v, k] of RING) out.push({ ...atLocal(b.frame, fl.u + u, fl.v + v), kind: 'grass', size: k });
  }
  const A = 1.7, B = 1.1, V0 = -0.3, SP = 0.4;
  for (let v = -B; v <= B + 1e-6; v += SP * 0.87) {
    for (let u = -A; u <= A + 1e-6; u += SP) {
      const uu = u + (rnd() - 0.5) * SP * 0.5 + (Math.round(v / SP) % 2 ? SP / 2 : 0), vv = v + (rnd() - 0.5) * SP * 0.4;
      const e = (uu / A) ** 2 + (vv / B) ** 2;
      if (e > 1.05 || (e > 0.7 && rnd() < 0.35)) continue;
      const p = atLocal(b.frame, uu, vv + V0);
      if (frogs.some((f) => dist(p, f) < 0.4)) continue;
      if (slots.some((s) => dist(p, s) < 0.26)) continue;
      if (dist(p, cushion) < CUSHION.r + 0.1) continue; // (the moss cushion lies open)
      if (SIDES.some((sd) => dist(p, b.stands[sd]) < 0.65)) continue; // (where he stands, either side)
      if (above(p) < -0.04) continue; // (out on open water nothing grows this thick)
      out.push({ ...p, kind: 'grass', size: 0.62 + rnd() * 0.3 });
    }
  }
  return out;
}

/* -------------------------------------------------------------- a play ---- */

/** What this play lays out (`venLayout`). */
export interface VenLaid {
  bay: BayId;
  /** which of the cove's nooks the frog sits in, and the side he searches it from */
  nook: number;
  side: Side;
  /** the three moments' encounter ids in this play's order (the trial's) */
  order: readonly string[];
  /** the station each danger is met at */
  stations: { 'adder-ven': StationIndex; 'modder-ven': StationIndex };
  /** the adder's spot along the path from her station (m) and her turn off its line (rad) */
  adderShift: number;
  adderTurn: number;
  /** compact, logged with every beat (`B4-amp+0.6`: cove, nook, the moments' order, the
   *  adder's shift) */
  variant: string;
}

/** The history's key for this mission's variant (the play notes it as `ven`). */
export const VARIANT_KEY = 'ven';

/** The ven's last variants (oldest first), one per play, from the beat history. */
export function lastVenVariants(history: readonly { m: string; sd?: number; va?: string }[], missionId = MISSION): string[] {
  const out: { sd: number | undefined; v: string }[] = [];
  for (const b of history) {
    if (b.m !== missionId || !b.va) continue;
    const pair = b.va.split(',').find((p) => p.startsWith(`${VARIANT_KEY}:`));
    if (!pair) continue;
    if (out.length && out[out.length - 1].sd === b.sd) continue;
    out.push({ sd: b.sd, v: pair.slice(VARIANT_KEY.length + 1) });
  }
  return out.map((o) => o.v);
}

/** A logged variant read back: its cove and nook (null: not a ven variant). */
export function readVariant(v: string): { bay: BayId; nook: number } | null {
  const bay = v.charAt(0) as BayId;
  const nook = Number.parseInt(v.slice(1), 10);
  if (!(BAY_IDS as readonly string[]).includes(bay) || !Number.isFinite(nook) || !COVES[bay].nooks[nook]) return null;
  return { bay, nook };
}

/** Where a logged play's frog sat in its search picture (px), or null. */
function pxOf(p: { bay: BayId; nook: number } | null | undefined): readonly [number, number] | null {
  return p ? COVES[p.bay].nooks[p.nook].px : null;
}

/**
 * This play's north bank, drawn from its forks (one per decision: a later draw never
 * reshuffles another). The cove: never the last play's (a seeded pick of the other two).
 * The nook in it: never within `NOOK_GAP_PX` of where the frog sat in the last play's
 * search picture, and as far as it can from where it sat in the plays before that (up to
 * four more back): six plays in a row put it at five or six places in the picture, and the
 * place he remembers is an empty one. The nook brings the side he searches from.
 * The adder's spot and turn.
 * `order` is the dagnacht trial's order for this play (`playDagnachtTrial`: the same the
 * 2D floor plays): the first danger in it is met at the cove's first station, the second
 * at its second.
 */
export function venLayout(play: Pick<Play, 'fork'>, order: readonly string[], last: readonly string[] = []): VenLaid {
  const prev = last.map(readVariant);
  const lastBay = prev[prev.length - 1]?.bay;
  const bayId = play.fork('ven-baai').pick(lastBay ? BAY_IDS.filter((x) => x !== lastBay) : BAY_IDS);
  const all = COVES[bayId].nooks.map((n, i) => ({ n, i }));
  const back = (k: number): readonly [number, number] | null => pxOf(prev[prev.length - k]);
  const far = (n: Nook, p: readonly [number, number] | null): boolean => !p || Math.hypot(n.px[0] - p[0], n.px[1] - p[1]) >= NOOK_GAP_PX;
  // never near the last play's place; then the ones that keep furthest from the places of
  // the plays before (up to four more back, an older one counting a little less), a
  // seeded pick among those nearly as far as the furthest
  let pool = all.filter((x) => far(x.n, back(1)));
  if (!pool.length) pool = all;
  const spread = (n: Nook): number => {
    let m = Infinity;
    for (let k = 2; k <= 5; k++) {
      const p = back(k);
      if (p) m = Math.min(m, Math.hypot(n.px[0] - p[0], n.px[1] - p[1]) + 20 * (k - 2));
    }
    return Math.min(m, SPREAD_ENOUGH_PX);
  };
  const best = Math.max(...pool.map((x) => spread(x.n)));
  pool = pool.filter((x) => spread(x.n) >= best - 25);
  const nook = play.fork('ven-plek').pick(pool).i;
  const side = COVES[bayId].nooks[nook].side;
  const dangers = order.filter((id) => id === 'adder-ven' || id === 'modder-ven');
  const stations = {
    'adder-ven': (Math.max(0, dangers.indexOf('adder-ven')) as StationIndex),
    'modder-ven': (Math.max(0, dangers.indexOf('modder-ven')) as StationIndex),
  };
  const a = play.fork('ven-adder');
  const adderShift = Math.round(a.between(-ADDER_SHIFT, ADDER_SHIFT) * 10) / 10;
  const adderTurn = Math.round(a.between(-0.7, 0.7) * 100) / 100;
  const code = order.map((d) => d.charAt(0)).join('');
  const variant = `${bayId}${nook}-${code}${adderShift >= 0 ? '+' : ''}${adderShift}`;
  return { bay: bayId, nook, side, order: [...order], stations, adderShift, adderTurn, variant };
}

/**
 * The three moments' order THIS play (ids), drawn by the very builder and fork the
 * world's `ChoiceRun` and the 2D floor draw it with (`playDagnachtTrial`: the play's
 * 'dagnacht' fork, never his last two plays' order): `prepare` lays the stations from it
 * under the briefing card, and the run plays them in it.
 */
export function venOrder(skin: Skin, knobs: RustKnobs, play: Play, history: readonly { m: string; sd?: number; va?: string }[], jargon = false, reduced = false): string[] {
  return playDagnachtTrial(skin, { jargon, reducedMotion: reduced, ...knobs }, play, history).encounters.map((e) => e.id);
}

/** The frog's spot this play (world, the way it sits, its nook and side). */
export function frogOf(l: Pick<VenLaid, 'bay' | 'nook'>): FrogSpot {
  return BAYS[l.bay].nooks[l.nook];
}

/**
 * The look-alikes of this play's trial laid in its cove (seeded): the moss clods ('bush'
 * decoys) on the cove's clod slots and in its nooks the frog does not use this play (an
 * empty nook's sedge ring with a clod in it is the frog's double), the butterfly and the
 * bird on theirs — never one the boy would stand in front of in this play's picture.
 */
export function decoySlots(b: Bay, nook: number, decoys: readonly { id: string; k: string }[], rng: () => number): { id: string; k: string; x: number; z: number }[] {
  const shuffled = <T>(xs: readonly T[]): T[] => {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  // (never a look-alike behind the boy in this play's picture: from his side)
  const side = b.nooks[nook].side;
  const seen = (up: number) => (q: Spot): boolean => !underBoy(b, side, q, up);
  const pools: Record<string, Spot[]> = {
    bush: shuffled([...b.slots.clods, ...b.nooks.filter((n) => n.nook !== nook).map((n) => ({ x: n.x, z: n.z }))].filter(seen(0))),
    butterfly: shuffled(b.slots.butterflies.filter(seen(LOOK_UP.butterfly))), bird: shuffled(b.slots.birds.filter(seen(LOOK_UP.bird))),
  };
  const out: { id: string; k: string; x: number; z: number }[] = [];
  for (const d of decoys) {
    const q = (pools[d.k] ?? pools.bush).shift();
    if (!q) continue;
    out.push({ id: d.id, k: d.k, x: q.x, z: q.z });
  }
  return out;
}

/** A moss clod's size (m): as long and as high as it lies (ven.home clodGeometry). */
export const CLOD_LEN = 0.22;
export const CLOD_H = 0.12;

/** The play's moss clods (its trial's 'bush' look-alikes), wherever they lie. */
export function clodsOf(decoys: readonly { k: string; x: number; z: number }[]): Spot[] {
  return decoys.filter((d) => d.k === 'bush').map((d) => ({ x: d.x, z: d.z }));
}

/**
 * The search's windows in a cove for the lens at `eye` (the home lays them; the places
 * test measures them): each moss clod first gets a window fitted to the level's glimpse —
 * one in an empty nook's sedge ring or one on the open moss, it is seen at least about as
 * much as the frog (a clod the sedge hid wholly is no look-alike) — then the frog's own
 * window last, so his share is exactly the level's whatever a clod's window did to a stem
 * they share; a clod his fit hid again opens once more. Pure; changes `stems`.
 */
export function fitCove(stems: Stem[], built: readonly Built[], eye: V3, frog: Spot & { yaw: number }, clods: readonly Spot[], glimpse: number,
  groundY: (x: number, z: number) => number): void {
  const pts = clods.map((d) => backPoints(d.x, groundY(d.x, d.z), d.z, headingTo({ x: eye.x, z: eye.z }, d) + 0.9, CLOD_LEN, CLOD_H));
  const mine = backPoints(frog.x, groundY(frog.x, frog.z), frog.z, frog.yaw, FROG_LEN, FROG_H);
  const at = { x: frog.x, y: 0, z: frog.z };
  clods.forEach((d, i) => fitWindow(stems, built, eye, pts[i], glimpse, { x: d.x, y: 0, z: d.z }));
  fitWindow(stems, built, eye, mine, glimpse, at);
  // (a clod's window the frog's fit closed again opens once more, only opening; if that
  // showed more of the frog, his own ring closes it again, never a stem a clod needs)
  pts.forEach((q) => { if (visibleShare(q, eye, stems) < glimpse) openWindow(stems, eye, q, glimpse); });
  if (visibleShare(mine, eye, stems) > glimpse + FIT_BAND + 1e-9) {
    const keep = new Set<number>();
    stems.forEach((s, i) => { if (s.h < built[i].h - 1e-6) keep.add(i); });
    closeWindow(stems, built, eye, mine, glimpse + FIT_BAND, glimpse, at, 0.45, keep);
  }
}

/** Every spot of a cove a moss clod may lie on: its clod slots, then its nooks. */
export function clodSpots(b: Bay): Spot[] {
  return [...b.slots.clods, ...b.nooks.map((n) => ({ x: n.x, z: n.z }))];
}

/* ------------------------------------------------------- who lives here ---- */

/** The frog after the mission: in plain view on bay B's moss cushion, facing the bank. */
export const AFTER_FROG: Spot & { yaw: number } = (() => {
  const b = BAYS.B;
  return { ...atLocal(b.frame, CUSHION.u, CUSHION.v), yaw: b.frame.heading + Math.PI - 0.5 };
})();

/** The calling frogs' keys (one floating in each cove's water). */
export const CHORUS_KEYS: Readonly<Record<BayId, string>> = { A: 'koorA', B: 'koorB', C: 'koorC' };

/** How deep (m) a floating frog sits in the water: its back and head above it. */
export const FLOAT_SINK = 0.06;

/**
 * The heikikkers. Before the mission one sits hidden in a cove (`kikker`: a play lays it
 * in its own cove and nook under the briefing card; in free roam bay B's first nook), and
 * one floats in each cove's water calling now and then (`koorA..C`), so the chorus is
 * heard from the bank within ~20 m and rings spread where one calls (ven.home.ts). After
 * it the frog he found has plonsed back into the ven; one frog sits on bay B's moss
 * cushion and calls (`koorB` climbed out there in the reunion), the other two are under
 * the water. The adder is the home's own, laid on the path only for a play (never in free
 * roam): no resident.
 */
export const VEN_RESIDENTS: readonly ResidentSpec[] = [
  { key: 'kikker', animal: 'heikikker', reach: 0.5,
    before: { x: BAYS.B.nooks[0].x, z: BAYS.B.nooks[0].z, yaw: BAYS.B.nooks[0].yaw, idle: 'stand', roam: 0 },
    after: null },
  ...BAY_IDS.map((id, i): ResidentSpec => ({
    key: CHORUS_KEYS[id], animal: 'heikikker', reach: 7,
    before: { ...BAYS[id].chorus, yaw: BAYS[id].frame.heading + Math.PI + (i - 1) * 0.6, idle: 'stand', roam: 0 },
    after: id === 'B' ? { ...AFTER_FROG, idle: 'stand', roam: 0 } : null,
    voice: id === 'B'
      ? { call: 'heikikker', every: [6, 11], within: 20 }
      // (the nearest cove's frog is heard faintly from the marker, 22 m off)
      : { call: 'heikikker', every: [5 + i * 1.5, 9 + i * 1.5], within: id === 'A' ? 24 : 20, state: 'before' },
  })),
];

/** The places table (`__ranger.missionPlaces('ven')`): the marker, the home, every cove
 *  and its two stands (`R`: his right, `L`), every cove's stations. */
export const VEN_PLACES: Readonly<Record<string, Place>> = (() => {
  const t: Record<string, Place> = { marker: { ...MARKER, r: 2.4 }, home: { x: AFTER_FROG.x, z: AFTER_FROG.z } };
  for (const id of BAY_IDS) {
    const b = BAYS[id];
    t[`${id}.cove`] = { x: b.frame.x, z: b.frame.z, heading: b.frame.heading };
    t[`${id}.standR`] = b.stands[1];
    t[`${id}.standL`] = b.stands[-1];
    stationsOf(id, 1).forEach((s) => { t[`${id}.S${s.i + 1}`] = { ...s.at }; });
  }
  return t;
})();

/** Every station of every cove (the home lays a carpet's moss there when a play wants it;
 *  `s` along his way to the cove's right side: the same as to its left, the two ways part
 *  only above the cove). */
export function allStations(): { bay: BayId; st: Station }[] {
  return BAY_IDS.flatMap((bay) => stationsOf(bay, 1).map((st) => ({ bay, st })));
}

/** The ground the world's scatter (heath plants, the reed belt) leaves to the home: the
 *  coves, the stands and the way down to them, the path, the stations' moss. */
export function venClearings(): { x: number; z: number; r: number }[] {
  const out: { x: number; z: number; r: number }[] = [];
  for (const id of BAY_IDS) {
    const b = BAYS[id];
    out.push({ x: b.frame.x, z: b.frame.z, r: 2.0 });
    for (const u of [-1.3, 1.3]) out.push({ ...atLocal(b.frame, u, 0.1), r: 1.1 });
    for (const side of SIDES) {
      const st = b.stands[side], off = b.offs[side];
      out.push({ x: st.x, z: st.z, r: 1.5 });
      // the way down from the path, and what the lens sees over his shoulder
      for (let k = 0.25; k < 1; k += 0.25) out.push({ x: off.x + (st.x - off.x) * k, z: off.z + (st.z - off.z) * k, r: 1.4 });
    }
    out.push({ ...atLocal(b.frame, 0, -4.0), r: 1.5 });
  }
  for (let s = PATH_BANK_S - 4; s < PATH.length; s += 1.4) out.push({ ...pointAt(PATH, s), r: 1.25 });
  for (const { st } of allStations()) {
    const c = carpetAt(st);
    for (let v = -c.b; v <= c.b + 1e-6; v += 1.2) out.push({ ...atLocal(c, 0, v), r: 1.7 });
  }
  return out;
}

/** The ven's home in the world. */
export const VEN_HOME: HomeSpec = {
  missionId: MISSION,
  places: VEN_PLACES,
  residents: VEN_RESIDENTS,
  marker: { look: 'none' },
  // the coves and the stations lie along 30 m of bank: it stays drawn near any of them
  spread: [...BAY_IDS.map((id) => ({ x: BAYS[id].frame.x, z: BAYS[id].frame.z })), ...allStations().map((q) => q.st.at)],
};

/** Is `p` within `r` m of the shore path? */
export function nearPath(p: Spot, r: number): boolean {
  for (let i = 1; i < PATH.pts.length; i++) if (segDist(p, PATH.pts[i - 1], PATH.pts[i]) < r) return true;
  return false;
}

/** The frog's size (m): its stand height and length (the scale table's). */
export const FROG_H = SIZE.heikikker.h;
export const FROG_LEN = SIZE.heikikker.len;
