/**
 * stuifzand.places.ts — where "Het stille zand" happens (run 7, the adventures lane, package
 * stille-zand, design `state/adventures/design.md` §5): the open DRIFT SAND north-east of the
 * spawn clearing, chosen by looking at the world and pinned by stuifzand.places.test.ts. Pure
 * (THREE-free): the test, the home (stuifzand.home.ts) and the script (stuifzand.ts) read the
 * same tables.
 *
 * The drift sand is a wide, pale, nearly flat plain (~40 × 30 m) with two junipers, a boulder,
 * the helipad with the parked helicopter at its south-east and the roaming boar's loop at its
 * north-west. The sand path from the spawn ends in its middle (20, 24). A CAR came up that path
 * and drove on over the sand, where nobody may drive: its tyre tracks leave the path's end and
 * cross the sand to the east rim. Three nightjar NESTS lie out on the sand east of the path's
 * end, each a scrape among buntgras tufts, dead pine twigs, cones and bark: a nightjar pair
 * breeds at one of them. North of them a juniper with a rabbit's burrow under its skirt (HET
 * HOL) faces a bright stretch of OPEN SAND across a little dip: the GUARD place, where he
 * watches who comes by at dusk.
 *
 * One play: from the marker he looks at the tracks on the path, follows them (the knobs thin
 * them: gaps where the wind blew sand over them, fainter ruts), and near this play's nest a
 * nightjar flushes from the sand and flutters off dragging a wing (a parent leading him away);
 * he stands still and searches the scrape for its mate pressed flat on the sand; then he walks
 * to the juniper and guards the place as the evening falls (wisselen); then back to the nest,
 * where she settles on her eggs.
 *
 * Every play draws from its forks (decision 1; `zandLayout`): which nest (never the last
 * play's), which of its two spots she presses on, which side the car passed it on (the route:
 * two per nest, so the tracks and the walk differ), which way the flushed bird flutters, where
 * the wind blew sand over the tracks, whether a woodlark sings over the sand. None of it
 * changes a knob: every scrape is seen from the same distance and angle, every spot fitted to
 * the level's glimpse; how many look-alikes lie there, how much of her shows, how many gaps the
 * tracks have and how faint they are, how many animals come to the guard place and when the
 * rule turns are the level's.
 */

import { heightAt } from '../../Biomes.ts';
import { RANGER_STAND_HEIGHT, SIZE } from '../../AnimalScale.ts';
import { distanceToNetwork, LANE_HALF } from '../../Paths.ts';
import { atLocal, dist, headingTo, segDist, toLocal, type Frame } from '../places.ts';
import type { Clump } from '../cover-math.ts';
import type { HomeSpec, Place, ResidentSpec, Spot } from '../types.ts';
import type { Play } from '../../../core/play.ts';

export const MISSION = 'stuifzand';

/* ------------------------------------------------------- the world's things ---- */

/** The mission marker: where the world has always put it (the drift sand's anchor, at its
 *  west edge by the heath). Its ring stays empty: the nightjar is hidden out on the sand. */
export const MARKER: Spot = { x: 8.27, z: 20.39 };

/** The world's solids on the drift sand (world/Dressing PLACES; world/Vehicles: the
 *  helicopter parked on pad A, its footprint circles), and the sand path's end (Paths). */
export const JUNIPERS: readonly (Spot & { r: number })[] = [{ x: 24, z: 20, r: 1 }, { x: 16, z: 30, r: 1 }];
export const BOULDER: Spot & { r: number } = { x: 30, z: 26, r: 0.9 };
export const PAD: Spot & { r: number } = { x: 32, z: 18, r: 3.2 };
export const HELI: readonly (Spot & { r: number })[] = [
  { x: 30.61, z: 17.22, r: 1.25 }, { x: 31.52, z: 17.73, r: 1.4 }, { x: 32.31, z: 18.17, r: 1.3 }, { x: 33.31, z: 18.74, r: 0.8 }, { x: 33.92, z: 19.08, r: 0.9 },
];
export const PATH_END: Spot = { x: 20, z: 24 };
/** The roaming animals' loops nearby (world/Fauna): the boar north-west, the roe east. */
export const BOAR_LOOP = { x: 10, z: 36, r: 6 } as const;
export const ROE_LOOP = { x: 44, z: 12, r: 6 } as const;
/** Every solid on the sand (a place keeps clear of them). */
export const SOLIDS: readonly (Spot & { r: number })[] = [...JUNIPERS, BOULDER, ...HELI];

/* ------------------------------------------------------------ the tracks ---- */

/** Half the car's wheel track (m): a rut each side of its line. */
export const RUT = 0.74;
/** A rut's width (m). */
export const RUT_W = 0.2;

/** The car's way up the sand path to its end (both routes): the middle of the path. */
export const ON_PATH: readonly Spot[] = [{ x: 12.0, z: 14.4 }, { x: 15.9, z: 19.1 }, { x: 19.55, z: 23.45 }];

/** A smooth line through `pts` (Catmull-Rom, `n` points a stretch), ends kept. */
export function smooth(pts: readonly Spot[], n = 6): Spot[] {
  const out: Spot[] = [];
  const P = [pts[0], ...pts, pts[pts.length - 1]];
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number): number => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), z: f(p0.z, p1.z, p2.z, p3.z) });
    }
  }
  out.push({ ...pts[pts.length - 1] });
  return out;
}

/** A polyline measured: its points and the distance (m) along it to each. */
export interface Line { pts: Spot[]; acc: number[]; length: number }
export function lineOf(pts: readonly Spot[]): Line {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + dist(pts[i - 1], pts[i]));
  return { pts: [...pts], acc, length: acc[acc.length - 1] };
}
/** The point `s` m along a line (clamped to its ends). */
export function pointAt(l: Line, s: number): Spot {
  const t = Math.max(0, Math.min(l.length, s));
  let i = 1;
  while (i < l.pts.length - 1 && l.acc[i] < t) i++;
  const a = l.pts[i - 1], b = l.pts[i], seg = l.acc[i] - l.acc[i - 1] || 1;
  const k = (t - l.acc[i - 1]) / seg;
  return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k };
}
/** How far along a line (m) the point nearest `p` lies, and how far `p` is from it. */
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
/** The way a line runs at `s` m along it (a heading). */
export function headingAt(l: Line, s: number): number {
  const a = pointAt(l, s - 0.4), b = pointAt(l, s + 0.4);
  return headingTo(a, b);
}

/* ------------------------------------------------------------- the nests ---- */

export type NestId = 1 | 2 | 3;
export const NEST_IDS: readonly NestId[] = [1, 2, 3];
/** Which side of the nest the car passed (as he comes along its tracks: its left, its right). */
export type Pass = 'l' | 'r';
export const PASSES: readonly Pass[] = ['l', 'r'];

/** How the nightjars are drawn: ×1.3 their table size (a 26-28 cm bird; the table's 17 cm
 *  stand height reads small on sand) — the same for every spot, every play. */
export const ZWALUW_SCALE = 1.3;
export const ZWALUW_H = SIZE.nachtzwaluw.h * ZWALUW_SCALE;
export const ZWALUW_LEN = SIZE.nachtzwaluw.len * ZWALUW_SCALE;
/** Her back's top over the sand while she presses flat on her eggs (m). */
export const PRESSED_H = ZWALUW_H * 0.62;

/** A framed view as the kit's `frame` takes it (FrameSpec, THREE-free). */
export interface ViewSpec {
  at: Spot;
  heading: number;
  halfW: number;
  halfD: number;
  tall?: number;
  pitchDeg?: number;
  insetTop?: number;
  insetBottom?: number;
  include?: readonly { x: number; z: number; h: number; r?: number }[];
  near?: number;
  lensUp?: number;
}

/** One scrape on the sand where the pair may breed. */
export interface Nest {
  id: NestId;
  /** its middle */
  c: Spot;
  /** the search's frame: its middle, looking the way the corridor runs (he searches it from
   *  the path's side: the same picture whichever way the car passed) */
  frame: Frame;
  /** her two spots in it (where she presses, the way she faces): a play draws one */
  spots: readonly (Spot & { yaw: number })[];
  /** where the other parent rests on the sand beyond it (he flushes from here), facing */
  roost: Spot & { yaw: number };
  /** the dead pine branch lying by the roost */
  branch: Spot & { yaw: number; len: number };
  /** where he stands to search it, on the side the car passed it (the search's lens behind
   *  him; the same picture of the scrape from either side, him at its left or right edge) */
  stands: Readonly<Record<Pass, Place>>;
  /** the search's held view, for each side he stands on */
  views: Readonly<Record<Pass, ViewSpec>>;
}

/**
 * The sand east of the path's end, as the car crossed it: a CORRIDOR from the path's end to
 * the east rim, `s` m along it and `t` m across (+ north, his left as he follows the tracks).
 * The boulder lies on its line ~10.7 m along; the first juniper south of it; the helipad well
 * south; the guard place well north.
 */
export const CORRIDOR = { o: { x: 19.6, z: 23.5 }, d: { x: 0.958, z: 0.283 }, length: 26.5 } as const;
/** A corridor spot in the world. */
export function onCorridor(s: number, t: number): Spot {
  const { o, d } = CORRIDOR;
  return { x: o.x + d.x * s - d.z * t, z: o.z + d.z * s + d.x * t };
}

/** The search's frame round a scrape (m): half its width and depth, its tilt — a close, steep
 *  look down on the sand, him at its bottom edge (`r`: his shoulders both in it). */
export const SEARCH = { halfW: 0.95, halfD: 0.66, tall: 0.4, pitchDeg: 44, insetTop: 112, insetBottom: 24, r: 0.22 } as const;
/** Where he stands to search: back from the scrape's middle (m) and aside, on the side the
 *  car passed it (`l`: north, the frame's +u). */
const STAND_UV = { u: 1.15, v: -0.65 } as const;
/** Her two spots in the frame (`u` across, `v` along: never its middle), the way she faces
 *  (rad off the frame's heading), and the look-alikes' eight slots (each by a tuft). */
const SPOTS_UV: readonly { u: number; v: number; turn: number }[] = [{ u: -0.55, v: 0.26, turn: 1.15 }, { u: 0.5, v: -0.24, turn: -2.0 }];
const SLOTS_UV: readonly { u: number; v: number }[] = [
  { u: -0.88, v: 0.6 }, { u: -0.12, v: 0.5 }, { u: 0.42, v: 0.46 }, { u: 0.84, v: 0.24 },
  { u: -0.84, v: -0.34 }, { u: -0.06, v: -0.4 }, { u: 0.0, v: 0.08 }, { u: 0.9, v: -0.5 },
];

/** The three scrapes along the corridor, ~6.5 m apart, each ≥ 8 m beyond the path's end (his
 *  walk always leaves the path), north of the boulder's line or just south of it; each turned
 *  a little its own way (`turn`: the search's picture differs a little from scrape to scrape). */
export const NESTS: Readonly<Record<NestId, Nest>> = {
  1: nest(1, onCorridor(8.0, 0.8), 0.12),
  2: nest(2, onCorridor(14.5, 1.6), -0.14),
  3: nest(3, onCorridor(21.0, -0.6), 0.08),
};
function nest(id: NestId, c: Spot, turn: number): Nest {
  const frame: Frame = { x: c.x, z: c.z, heading: Math.atan2(CORRIDOR.d.x, CORRIDOR.d.z) + turn };
  const spots = SPOTS_UV.map((q) => ({ ...atLocal(frame, q.u, q.v), yaw: frame.heading + q.turn }));
  const standOf = (side: Pass): Place => {
    const st = atLocal(frame, (side === 'l' ? 1 : -1) * STAND_UV.u, STAND_UV.v);
    return { ...st, r: 0.5, heading: headingTo(st, c) };
  };
  const stands = { l: standOf('l'), r: standOf('r') };
  const viewOf = (side: Pass): ViewSpec => ({
    at: atLocal(frame, 0, 0.05), heading: frame.heading, halfW: SEARCH.halfW, halfD: SEARCH.halfD, tall: SEARCH.tall,
    pitchDeg: SEARCH.pitchDeg, insetTop: SEARCH.insetTop, insetBottom: SEARCH.insetBottom,
    include: [{ x: stands[side].x, z: stands[side].z, h: RANGER_STAND_HEIGHT, r: SEARCH.r }],
  });
  // the other parent rests beyond the scrape, a little to the side, by a dead branch
  return {
    id, c, frame, spots,
    roost: { ...atLocal(frame, 0.6, 1.85), yaw: frame.heading + 2.4 },
    branch: { ...atLocal(frame, 1.02, 1.72), yaw: frame.heading + 1.45, len: 0.85 },
    stands, views: { l: viewOf('l'), r: viewOf('r') },
  };
}

/** The car's two lines over the corridor (`s`, `t` control points, before smoothing): the
 *  north one passes every scrape on its north side, the south one on its south side (round
 *  the first juniper and the boulder) — each 2.2-3.2 m from a scrape's middle. */
const ROUTE_ST: Readonly<Record<Pass, readonly [number, number][]>> = {
  l: [[0.4, 0.2], [3, 1.6], [8, 3.0], [10.7, 3.4], [14.5, 4.2], [18, 3.4], [21, 1.8], [24, 0.9], [27.5, 0.3]],
  r: [[0.4, -0.2], [3.2, -1.5], [6, -1.6], [8, -1.6], [10.7, -3.0], [14.5, -1.0], [18, -2.2], [21, -3.0], [24, -1.8], [27.5, -0.3]],
};
const ROUTE_PTS: Readonly<Record<Pass, readonly Spot[]>> = {
  l: ROUTE_ST.l.map(([s, t]) => onCorridor(s, t)),
  r: ROUTE_ST.r.map(([s, t]) => onCorridor(s, t)),
};

/** The car's whole line on one side: up the path, off its end, past the three scrapes. */
export function routeOf(side: Pass): Line {
  return lineOf(smooth([...ON_PATH, ...ROUTE_PTS[side]], 6));
}
/** Where the path's stretch of a route ends (m along it): the car leaves the path there. */
export const OFF_PATH_S = lineOf(ON_PATH).length;

/** Where his walk along the tracks ends for a nest (m before the point the car passed it):
 *  the nightjar resting beyond the scrape flushes as he comes. */
export const FLUSH_BEFORE = 3.2;

/** What a nest and a side make of the play's walk: where the walk along the tracks ends
 *  (`approach`, on the tracks, facing the scrape: the resting parent flushes there). He then
 *  steps to the scrape's own stand to search it. */
export interface Approach {
  route: Line;
  /** m along the route where the car passed the nest closest */
  passS: number;
  approach: Place;
}

export function approachOf(n: NestId, side: Pass): Approach {
  const nest = NESTS[n];
  const route = routeOf(side);
  const pass = project(route, nest.c);
  // (where the tracks come nearest the spot he searches from, a step before it, and never
  // nearer the scrape than FLUSH_BEFORE along them)
  const near = project(route, nest.stands[side]).s - 0.6;
  const s = Math.max(OFF_PATH_S + 0.5, Math.min(pass.s - 1.4, near));
  const ap = pointAt(route, s);
  const approach: Place = { ...ap, r: 1.0, heading: headingTo(ap, nest.c) };
  return { route, passS: pass.s, approach };
}

/** The look-alikes' slots of a nest (world spots): eight over the scrape, each by a tuft,
 *  apart from her spots and from each other, all inside the search's picture. */
export function slotsOf(n: NestId): Spot[] {
  return SLOTS_UV.map((q) => atLocal(NESTS[n].frame, q.u, q.v));
}

/**
 * The buntgras tufts of a nest (cover clumps, 'grass': a low tussock or two): a ring round
 * each of her spots (the window the level's glimpse opens is the ones between the lens and
 * her back shrinking), one by each slot (a look-alike is half in the grass as she is), and a
 * few loose ones over the scrape's rim.
 */
export function nestClumps(n: NestId): Clump[] {
  const N = NESTS[n];
  const out: Clump[] = [];
  const size = 0.6;
  // (round each of her spots: two between the lens and her — the search looks the scrape's
  // way, so these are what hide her — and three round her other sides)
  const RING: readonly [number, number][] = [[-0.13, -0.21], [0.15, -0.2], [-0.31, 0.03], [0.3, 0.02], [0.02, 0.27]];
  const F = N.frame;
  const local = (p: Spot): { u: number; v: number } => toLocal(F, p);
  N.spots.forEach((s, j) => {
    const q = local(s);
    RING.forEach(([du, dv], i) => {
      out.push({ ...atLocal(F, q.u + du, q.v + dv), kind: 'grass', size: size * (0.92 + ((i + j) % 3) * 0.06) });
    });
  });
  // (a look-alike half in the grass as she is: one tuft between it and the lens, one beside)
  slotsOf(n).forEach((p, i) => {
    const q = local(p);
    out.push({ ...atLocal(F, q.u + (i % 2 ? 0.12 : -0.12), q.v - 0.2), kind: 'grass', size: size * 0.9 });
  });
  for (let i = 0; i < 6; i++) {
    const a = n * 1.7 + i * 1.05;
    const r = 1.45 + (i % 2) * 0.3;
    out.push({ x: N.c.x + Math.cos(a) * r, z: N.c.z + Math.sin(a) * r, kind: 'grass', size: size * 1.05 });
  }
  return out;
}

/** At dusk, back at the scrape: he steps back and aside (`endSpot`: behind the spot he searched
 *  from, on its side of the scrape) and gives her room, and the lens comes close to her from
 *  the path's side — her big in the picture, his whole body out of it (pinned: feet to head,
 *  for every nest, spot and side). */
export const STEP_BACK = { u: 1.7, v: -1.5 } as const;
export function endSpot(n: NestId, side: Pass): Place {
  const N = NESTS[n];
  const p = atLocal(N.frame, (side === 'l' ? 1 : -1) * STEP_BACK.u, STEP_BACK.v);
  return { ...p, r: 0.4, heading: headingTo(p, N.c) };
}
export function closeViewOf(n: NestId, spot: 0 | 1): ViewSpec {
  const N = NESTS[n], s = N.spots[spot];
  return {
    at: { x: s.x + Math.sin(s.yaw) * 0.1, z: s.z + Math.cos(s.yaw) * 0.1 }, heading: N.frame.heading,
    halfW: 0.55, halfD: 0.42, tall: 0.35, pitchDeg: 38, insetTop: 112, insetBottom: 24, near: 1.4,
  };
}
/** Where the male claps his wings at dusk (the rare): he rises from his branch to a point
 *  over the sand just beyond her (`DISPLAY`: m along the scrape's frame), `DISPLAY_UP` m up,
 *  facing back the way the lens looks (his wings open across its picture). */
export const DISPLAY = { u: 0, v: 1.0 } as const;
export const DISPLAY_UP = 1.6;
export function displayOf(n: NestId): Spot {
  return atLocal(NESTS[n].frame, DISPLAY.u, DISPLAY.v);
}
/** The dusk picture the rare is seen in, and the reunion after it (one calm move from the
 *  close look, then held): low over the sand from the path's side — her on her nest at the
 *  bottom, his branch beyond her, and the air where he claps at the height of the far trees,
 *  near enough that he shows big with his wings open, his shadow on the sand below him. */
export function endViewOf(n: NestId, spot: 0 | 1): ViewSpec {
  const N = NESTS[n], s = N.spots[spot];
  const d = displayOf(n);
  return {
    at: { x: (s.x + d.x) / 2, z: (s.z + d.z) / 2 }, heading: N.frame.heading, halfW: 0.45, halfD: 0.5, tall: 0.3, pitchDeg: 10,
    insetTop: 130, insetBottom: 30, near: 1.8,
    include: [{ x: d.x, z: d.z, h: DISPLAY_UP + 0.3, r: 0.45 }, { x: s.x, z: s.z, h: 0.2 }],
  };
}

/** The tufts of all three scrapes, in the order the home grows them (one CoverField), and
 *  its seed: the places test measures the glimpse of this very field. */
export const COVER_SEED = 71;
export function allClumps(): Clump[] {
  return NEST_IDS.flatMap((n) => nestClumps(n));
}

/* ----------------------------------------------------------- the flush ---- */

/**
 * Where the flushed parent flutters to and drags itself along the sand (the broken-wing
 * show), as he stands at the walk's end facing the scrape: always AWAY from the scrape (it
 * leads him off from the eggs), sideways from him and ahead, never toward him nor toward the
 * lens behind him. `shape` (a play's fork) draws how: `l` further ahead, `r` more to the side.
 * `land`: where it comes down; `drag`: where it flops on to; `away`: where it flies off to at
 * last (far over the sand, out of his picture); `side`: his side it is on (r: his right).
 */
export interface Flush { land: Spot; drag: Spot; away: Spot; view: ViewSpec; side: Pass; shape: Pass }
/** Is a spot open sand the flushed parent may come down on (clear of the solids, the path,
 *  the helipad, the scrapes)? */
export function openSand(p: Spot): boolean {
  return clearOfSolids(p, 1.0) && offPath(p) >= 0.8 && dist(p, PAD) >= PAD.r + 1.2 && Math.hypot(p.x, p.z) < 62
    && dist(p, ROE_LOOP) - ROE_LOOP.r >= 5.5 && dist(p, BOAR_LOOP) - BOAR_LOOP.r >= 5.5;
}
export function flushOf(n: NestId, side: Pass, shape: Pass): Flush {
  const a = approachOf(n, side);
  // (the way he walks along the tracks there: the scrape lies to one side of it)
  const h = headingAt(a.route, project(a.route, a.approach).s);
  const right = { x: -Math.cos(h), z: Math.sin(h) };
  const fwd = { x: Math.sin(h), z: Math.cos(h) };
  const from = a.approach;
  // (the scrape lies to his right or left: it flutters to the other side)
  const c = NESTS[n].c;
  const away = (c.x - from.x) * right.x + (c.z - from.z) * right.z > 0 ? -1 : 1;
  const of = (sh: Pass, sg: number, near = false): Flush => {
    const [ahead, out] = near ? (sh === 'l' ? [3.0, 1.8] : [1.9, 2.0]) : sh === 'l' ? [2.5, 2.5] : [1.1, 3.3];
    const land = { x: from.x + right.x * sg * out + fwd.x * ahead, z: from.z + right.z * sg * out + fwd.z * ahead };
    const drag = { x: land.x + right.x * sg * 0.9 + fwd.x * 0.3, z: land.z + right.z * sg * 0.9 + fwd.z * 0.3 };
    const away = { x: land.x + right.x * sg * 14 + fwd.x * 8, z: land.z + right.z * sg * 14 + fwd.z * 8 };
    // the held picture: him and it side by side, the lens behind him turned a little to it
    const at = { x: (from.x + land.x) / 2 + fwd.x * 0.3, z: (from.z + land.z) / 2 + fwd.z * 0.3 };
    const view: ViewSpec = {
      at, heading: h + sg * 0.3, halfW: 1.8, halfD: 0.9, tall: 0.7, pitchDeg: 24, insetTop: 110, insetBottom: 18,
      include: [{ x: from.x, z: from.z, h: RANGER_STAND_HEIGHT, r: 0.3 }, { x: drag.x, z: drag.z, h: 0.3 }],
    };
    return { land, drag, away, view, side: sg > 0 ? 'r' : 'l', shape: sh };
  };
  // (the shape drawn on the side away from the scrape; where that is no open sand — the
  // boulder, the helipad — the other shape; where neither, the other side, past the scrape)
  const other: Pass = shape === 'l' ? 'r' : 'l';
  const tries = [of(shape, away), of(other, away), of(shape, away, true), of(other, away, true), of(shape, -away), of(other, -away)];
  const spots = NESTS[n].spots;
  return tries.find((f) => openSand(f.land) && openSand(f.drag) && spots.every((q) => dist(q, f.land) >= 2.6 && dist(q, f.drag) >= 2.6)) ?? tries[0];
}

/* ------------------------------------------------------------ the guard ---- */

/** The guard place, north of the nests: he stands at `STAND` facing north; on his left a
 *  juniper with a rabbit's burrow under its skirt (HET HOL), on his right a bright bare
 *  stretch of OPEN SAND; between them, a few steps in front of him, the spot where each
 *  animal that comes by stops (`STOP`) while he decides where it goes. */
export const GUARD_STAND: Place = { x: 32.0, z: 36.0, r: 0.8, heading: 0 };
/** The juniper of the burrow (the home plants it: solid), and the burrow's mouth at its
 *  south-west foot, facing him. */
export const HOL_JUNIPER: Spot & { r: number; h: number; yaw: number } = { x: 35.5, z: 41.5, r: 1.0, h: 1.9, yaw: 0.6 };
export const BURROW: Spot & { yaw: number } = { x: 34.55, z: 40.35, yaw: headingTo({ x: 34.55, z: 40.35 }, { x: 32.0, z: 36.0 }) };
/** The open sand: its middle and how far it reaches (a bright patch, ripples). */
export const OPEN: Spot & { r: number } = { x: 28.7, z: 40.6, r: 1.5 };
/** Where an animal stops while he decides (a few steps in front of him, between the two, a
 *  step nearer him than the places: near enough the lens that the smallest visitor shows
 *  ≥ 50 px — pinned). */
export const STOP: Spot = { x: 32.0, z: 39.2 };
/** Where an animal that goes to a place settles there (its middle; the burrow's mouth for
 *  the hol: one lies at the juniper's foot beside it). */
export const SETTLE: Readonly<Record<'open' | 'hol', Spot>> = {
  open: { x: OPEN.x + 0.2, z: OPEN.z - 0.2 },
  hol: { x: BURROW.x - 0.35, z: BURROW.z - 0.45 },
};
/** Where the visitors come from: off the picture's left (east) or right (west) edge, beyond
 *  its far half; each walks in to the stop. Pinned out of the guard's picture. */
export type Edge = 'L' | 'R';
export const ARRIVE: Readonly<Record<Edge, readonly Spot[]>> = {
  L: [{ x: 41.0, z: 40.8 }, { x: 37.4, z: 40.5 }, STOP],
  R: [{ x: 23.1, z: 41.3 }, { x: 26.6, z: 41.1 }, STOP],
};
/** Where one leaves a place by: out past the picture's edge on that place's side, behind it. */
export const LEAVE: Readonly<Record<'open' | 'hol', readonly Spot[]>> = {
  open: [{ x: 26.8, z: 41.6 }, { x: 24.4, z: 38.6 }],
  hol: [{ x: 37.6, z: 43.0 }, { x: 42.8, z: 42.4 }],
};
/** The guard's held view: both places, the stop and him at the bottom of the picture. */
export const GUARD_VIEW: ViewSpec = {
  at: { x: 31.9, z: 40.3 }, heading: 0, halfW: 3.9, halfD: 1.5, tall: 1.9, pitchDeg: 30, insetTop: 110, insetBottom: 150,
  include: [{ x: GUARD_STAND.x, z: GUARD_STAND.z, h: RANGER_STAND_HEIGHT, r: 0.3 }],
};
/** Where the places' names hang over them (m over the ground). */
export const TAG_AT: Readonly<Record<'open' | 'hol', Spot & { y: number }>> = {
  open: { x: OPEN.x, z: OPEN.z + 0.4, y: 1.25 },
  hol: { x: BURROW.x + 0.15, z: BURROW.z + 0.05, y: 1.5 },
};
/** What a click finds as each place (an invisible zone round it: the whole place). */
export const ZONES: Readonly<Record<'open' | 'hol', Spot & { r: number; h: number }>> = {
  open: { x: OPEN.x, z: OPEN.z, r: OPEN.r + 0.25, h: 1.2 },
  hol: { x: (BURROW.x + HOL_JUNIPER.x) / 2, z: (BURROW.z + HOL_JUNIPER.z) / 2, r: 1.55, h: 2.0 },
};

/* ------------------------------------------------------------ small things ---- */

/** The anthill at the edge of the sand between the scrapes and the guard place (a find),
 *  out of every search's, flush's and guard's picture (pinned). */
export const ANTHILL: Spot & { h: number } = { x: 38.0, z: 35.2, h: 0.5 };
/** Where a woodlark rises from the sand and sings, as he walks (`me`, facing `heading`): ~7 m
 *  ahead of him and ~4 m to the side a play drew (`side`; the other where that is no open
 *  sand), or null where neither is. */
export function larkFrom(me: Spot, heading: number, side: Pass): Spot | null {
  const fwd = { x: Math.sin(heading), z: Math.cos(heading) }, right = { x: -Math.cos(heading), z: Math.sin(heading) };
  for (const s of [side, side === 'l' ? 'r' : 'l'] as Pass[]) {
    const sg = s === 'r' ? 1 : -1;
    const p = { x: me.x + fwd.x * 7 + right.x * sg * 4, z: me.z + fwd.z * 7 + right.z * sg * 4 };
    if (clearOfSolids(p, 1) && offPath(p) > 0.5 && dist(p, PAD) > PAD.r + 2 && Math.hypot(p.x, p.z) < 62 && dist(p, BOAR_LOOP) - BOAR_LOOP.r > 4) return p;
  }
  return null;
}

/* ----------------------------------------------------------- the knobs ---- */

/**
 * Where the wind blew sand over the tracks on his walk: `legs - 1` stretches (the level's
 * `trailLegs`), each 1.1-2.4 m long, between `from` and `to` (m along the route: the ruts'
 * first metres and the last 1.4 m before the flush point always show), ≥ 0.5 m apart; `rng`
 * draws where each lies (variety), never how many.
 */
export function gapsOf(legs: number, from: number, to: number, rng: () => number): { s: number; len: number }[] {
  const n = Math.max(0, Math.round(legs) - 1);
  const span = to - from;
  if (n <= 0 || span < 2) return [];
  const slot = span / n;
  const len = Math.max(1.1, Math.min(2.4, slot - 0.7));
  const out: { s: number; len: number }[] = [];
  for (let i = 0; i < n; i++) {
    const lo = from + i * slot;
    const room = Math.max(0, slot - len - 0.5);
    out.push({ s: lo + rng() * room, len: Math.min(len, slot - 0.5) });
  }
  return out;
}
/** Where the gaps may lie on a route (m along it): from a few metres up the path (he always
 *  sees where the ruts start) to 1.4 m before where his walk ends. */
export const GAPS_FROM = 3;
export function gapsTo(passS: number): number { return passS - FLUSH_BEFORE - 1.4; }
/** How dark the ruts are drawn (their opacity) from the level's `trailClarity`: clear and
 *  dark at band 1, faint at band 6 — never invisible. */
export function rutAlpha(clarity: number): number {
  return Math.max(0.3, Math.min(0.95, 0.18 + clarity * 0.8));
}

/* ------------------------------------------------------------ a play ---- */

/** The history's key for this mission's variant (the play notes it as `sz`). */
export const VARIANT_KEY = 'sz';

/** This play's drift sand. */
export interface ZandLaid {
  nest: NestId;
  /** which of her two spots */
  spot: 0 | 1;
  /** which side the car passed the nest on (the route) */
  side: Pass;
  /** which way the flushed parent flutters (his left or right) */
  flutter: Pass;
  /** whether a woodlark rises and sings as he walks, and on which side of his way */
  lark: Pass | null;
  /** compact: `2b-l-r` (nest, spot a/b, route side, flutter) */
  variant: string;
}

/** This mission's last variants (oldest first), one per play, from the beat history. */
export function lastVariants(history: readonly { m: string; sd?: number; va?: string }[]): string[] {
  const out: { sd: number | undefined; v: string }[] = [];
  for (const b of history) {
    if (b.m !== MISSION || !b.va) continue;
    const pair = b.va.split(',').find((p) => p.startsWith(`${VARIANT_KEY}:`));
    if (!pair) continue;
    if (out.length && out[out.length - 1].sd === b.sd) continue;
    out.push({ sd: b.sd, v: pair.slice(VARIANT_KEY.length + 1) });
  }
  return out.map((o) => o.v);
}
/** A logged variant read back (null: not this mission's). */
export function readVariant(v: string): { nest: NestId; spot: 0 | 1; side: Pass } | null {
  const m = /^([123])([ab])-([lr])/.exec(v);
  if (!m) return null;
  return { nest: Number(m[1]) as NestId, spot: m[2] === 'a' ? 0 : 1, side: m[3] as Pass };
}

/**
 * This play's drift sand, drawn from its forks (one per decision): the nest (never his last
 * play's; and when he played twice, never either of his last two, so three plays in a row meet
 * all three), her spot in it, the side the car passed it on (never his last play's route with
 * the same nest), which way the flushed parent flutters, whether and where a woodlark sings.
 */
export function zandLayout(play: Pick<Play, 'fork'>, last: readonly string[] = []): ZandLaid {
  const prev = last.map((v) => readVariant(v)).filter((v): v is NonNullable<typeof v> => !!v);
  const recent = prev.slice(-2).map((p) => p.nest);
  const nf = play.fork('sz-nest');
  let nests = NEST_IDS.filter((n) => !recent.includes(n));
  if (!nests.length) nests = NEST_IDS.filter((n) => n !== prev[prev.length - 1]?.nest);
  const nest = nf.pick(nests);
  const spot = (nf.int(0, 1)) as 0 | 1;
  // (the car's route: never his last play's — the tracks and his walk are another way each time)
  const sf = play.fork('sz-route');
  const lastSide = prev[prev.length - 1]?.side;
  const side: Pass = lastSide ? (lastSide === 'l' ? 'r' : 'l') : sf.pick(PASSES);
  const flutter: Pass = play.fork('sz-flush').pick(PASSES);
  const lf = play.fork('sz-leeuwerik');
  const lark: Pass | null = lf.chance(0.6) ? lf.pick(PASSES) : null;
  const variant = `${nest}${spot ? 'b' : 'a'}-${side}-${flutter}`;
  return { nest, spot, side, flutter, lark, variant };
}

/* ------------------------------------------------------- who lives here ---- */

/** The nest the pair lives at in free roam on a fresh save (and after a reload). */
export const HOME_NEST: NestId = 2;
/** The pair's nest now: the last play's this session, else HOME_NEST (the places table's
 *  `home` follows it: where the family lives after a play is the nest it was found at). */
let nestNow: { nest: NestId; spot: 0 | 1 } = { nest: HOME_NEST, spot: 0 };
export function setNestNow(n: NestId, spot: 0 | 1): void { nestNow = { nest: n, spot }; }
export function nestNowOf(): { nest: NestId; spot: 0 | 1 } { return nestNow; }

/** Her pose on a nest (pressed on her eggs) and his beside it (resting by the branch). */
export function femaleAt(n: NestId, spot: 0 | 1): Spot & { yaw: number } { return NESTS[n].spots[spot]; }
export function maleAt(n: NestId): Spot & { yaw: number } { return NESTS[n].roost; }

/** The guard place's visitors (resident keys) per animal of the wisselen queue: out of sight
 *  until a play brings them (`before`/`after` null). The two small ones are drawn bigger than
 *  their table size there (`GUARD_SCALE`, × the table's height), so he decides by watching the
 *  animal at the stop, not by its card: each visitor shows ≥ 50 px long there (pinned). */
export const GUESTS: Readonly<Record<string, string>> = {
  ree: 'ree', eekhoorn: 'eekhoorn', das: 'das', wildzwijn: 'zwijn', nachtzwaluw: 'gast',
};
export const GUARD_SCALE: Readonly<Record<'eekhoorn' | 'gast', number>> = { eekhoorn: 1.9, gast: 2.1 };

const nobody = (key: string, animal: string): ResidentSpec => ({ key, animal, before: null, after: null, reach: 0.5 });

/**
 * The pair: she presses on her eggs in a scrape, he rests on the sand beside it by a dead
 * branch (in free roam, on a fresh save, at HOME_NEST; a play lays them at its nest under the
 * briefing card, and they stay there after). Drawn ×1.3 (ZWALUW_SCALE). The guard place's
 * visitors come only in a play.
 */
export const ZAND_RESIDENTS: readonly ResidentSpec[] = [
  { key: 'zwaluw', animal: 'nachtzwaluw', height: ZWALUW_H, reach: 0.3,
    before: { ...femaleAt(HOME_NEST, 0), idle: 'lie', roam: 0 }, after: { ...femaleAt(HOME_NEST, 0), idle: 'lie', roam: 0 } },
  { key: 'man', animal: 'nachtzwaluw', height: ZWALUW_H, reach: 0.3,
    before: { ...maleAt(HOME_NEST), idle: 'lie', roam: 0 }, after: { ...maleAt(HOME_NEST), idle: 'lie', roam: 0 } },
  nobody('ree', 'ree'),
  // (the squirrel and the visiting nightjar drawn bigger: they must read at the stop)
  { ...nobody('eekhoorn', 'eekhoorn'), height: SIZE.eekhoorn.h * GUARD_SCALE.eekhoorn },
  nobody('das', 'das'),
  nobody('zwijn', 'wildzwijn'),
  { ...nobody('gast', 'nachtzwaluw'), height: SIZE.nachtzwaluw.h * GUARD_SCALE.gast },
];

/** The places table (`__ranger.missionPlaces('stuifzand')`): the marker, the pair's home (the
 *  nest they live at now), the guard place, every nest's middle. */
export const ZAND_PLACES: Readonly<Record<string, Place>> = Object.defineProperties({
  marker: { ...MARKER, r: 2.4 },
  guard: GUARD_STAND,
  open: { x: OPEN.x, z: OPEN.z },
  hol: { x: BURROW.x, z: BURROW.z },
  stop: { ...STOP },
  nest1: { ...NESTS[1].c },
  nest2: { ...NESTS[2].c },
  nest3: { ...NESTS[3].c },
} as Record<string, Place>, {
  home: { enumerable: true, get: (): Place => { const n = NESTS[nestNow.nest]; return { x: n.c.x, z: n.c.z }; } },
});

/** The ground the world's scatter (the marram tufts) leaves to the home: the scrapes and
 *  where he stands to search them, the guard place (the stop, the open sand, the burrow, the
 *  ways in and out). */
export function zandClearings(): { x: number; z: number; r: number }[] {
  const out: { x: number; z: number; r: number }[] = [];
  for (const n of NEST_IDS) {
    const N = NESTS[n];
    out.push({ ...N.c, r: 1.9 }, { x: N.roost.x, z: N.roost.z, r: 0.8 });
    for (const side of PASSES) out.push({ x: N.stands[side].x, z: N.stands[side].z, r: 0.8 });
  }
  out.push({ x: GUARD_STAND.x, z: GUARD_STAND.z, r: 1.2 }, { x: STOP.x, z: STOP.z, r: 1.4 }, { x: OPEN.x, z: OPEN.z, r: OPEN.r + 0.4 },
    { x: BURROW.x, z: BURROW.z, r: 1.0 }, { x: (GUARD_STAND.x + STOP.x) / 2, z: (GUARD_STAND.z + STOP.z) / 2, r: 1.2 });
  for (const e of ['L', 'R'] as Edge[]) for (const p of ARRIVE[e].slice(0, 2)) out.push({ x: p.x, z: p.z, r: 1.0 });
  out.push({ x: ANTHILL.x, z: ANTHILL.z, r: 0.8 });
  return out;
}

/** The drift sand's home in the world. */
export const ZAND_HOME: HomeSpec = {
  missionId: MISSION,
  places: ZAND_PLACES,
  residents: ZAND_RESIDENTS,
  marker: { at: MARKER, look: 'none' },
  // (the scrapes, the guard place and the tracks lie over ~25 m of sand: it stays drawn near
  // any of them)
  spread: [...NEST_IDS.map((n) => NESTS[n].c), STOP, PATH_END, ANTHILL],
};

/* -------------------------------------------------------------- checks ---- */

/** Is `p` clear of every solid on the sand by `m` m? */
export function clearOfSolids(p: Spot, m: number): boolean {
  return SOLIDS.every((s) => dist(p, s) > s.r + m) && dist(p, HOL_JUNIPER) > HOL_JUNIPER.r + m;
}
/** How far (m) `p` lies off the sand path's ribbon (negative: on it). */
export function offPath(p: Spot): number {
  return distanceToNetwork(p.x, p.z) - LANE_HALF;
}
/** The distance (m) from `p` to a polyline. */
export function lineDist(p: Spot, line: readonly Spot[]): number {
  let d = Infinity;
  for (let i = 1; i < line.length; i++) d = Math.min(d, segDist(p, line[i - 1], line[i]));
  return d;
}
/** The ground's height there (the one truth: Biomes.heightAt). */
export function groundAt(p: Spot): number { return heightAt(p.x, p.z); }

export { atLocal, dist, headingTo, toLocal, type Frame };
