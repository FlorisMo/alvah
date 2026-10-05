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
export const SEARCH = { halfW: 1.1, halfD: 0.82, tall: 0.45, pitchDeg: 38, insetTop: 112, insetBottom: 24, r: 0.22 } as const;
/** Where he stands to search: back from the scrape's middle (m) and aside, on the side the
 *  car passed it (`l`: north, the frame's +u). */
const STAND_UV = { u: 1.3, v: -0.95 } as const;
/** Her two spots in the frame (`u` across, `v` along: never its middle), the way she faces
 *  (rad off the frame's heading), and the look-alikes' eight slots (each by a tuft). */
const SPOTS_UV: readonly { u: number; v: number; turn: number }[] = [{ u: -0.52, v: 0.12, turn: 1.15 }, { u: 0.5, v: -0.05, turn: -2.0 }];
const SLOTS_UV: readonly { u: number; v: number }[] = [
  { u: -0.88, v: 0.52 }, { u: -0.2, v: 0.56 }, { u: 0.42, v: 0.6 }, { u: 0.92, v: 0.36 },
  { u: -0.92, v: -0.36 }, { u: -0.12, v: -0.32 }, { u: 0.1, v: 0.18 }, { u: 0.95, v: -0.42 },
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
    roost: { ...atLocal(frame, 0.65, 1.65), yaw: frame.heading + 2.4 },
    branch: { ...atLocal(frame, 1.08, 1.5), yaw: frame.heading + 1.45, len: 0.85 },
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
  const s = Math.max(OFF_PATH_S + 0.5, pass.s - FLUSH_BEFORE);
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
  const size = 0.55;
  N.spots.forEach((s, j) => {
    for (let i = 0; i < 6; i++) {
      const a = s.yaw + (i / 6) * Math.PI * 2 + j * 0.4;
      out.push({ x: s.x + Math.sin(a) * 0.27, z: s.z + Math.cos(a) * 0.27, kind: 'grass', size: size * (0.92 + (i % 3) * 0.06) });
    }
  });
  slotsOf(n).forEach((p, i) => {
    const a = i * 2.1 + n;
    out.push({ x: p.x + Math.sin(a) * 0.28, z: p.z + Math.cos(a) * 0.28, kind: 'grass', size: size * 0.95 });
  });
  for (let i = 0; i < 6; i++) {
    const a = n * 1.7 + i * 1.05;
    const r = 1.45 + (i % 2) * 0.3;
    out.push({ x: N.c.x + Math.cos(a) * r, z: N.c.z + Math.sin(a) * r, kind: 'grass', size: size * 1.05 });
  }
  return out;
}

/* ----------------------------------------------------------- the flush ---- */

/**
 * Where the flushed parent flutters to and drags himself along the sand (the broken-wing
 * show), for a nest and the side of his way it flutters to (`l`: his left as he stands at
 * the approach facing the nest, `r` his right): out from the roost, sideways from him and
 * a little ahead, never toward him (nor toward the lens behind him). `land`: where it comes
 * down; `drag`: where it flops on to; `away`: where it flies off to at last (out of his
 * picture, far over the sand).
 */
export interface Flush { land: Spot; drag: Spot; away: Spot; view: ViewSpec; side: Pass }
/** Is a spot open sand the flushed parent may come down on (clear of the solids, the path,
 *  the helipad, the scrapes)? */
export function openSand(p: Spot): boolean {
  return clearOfSolids(p, 1.0) && offPath(p) >= 0.8 && dist(p, PAD) >= PAD.r + 3.2 && Math.hypot(p.x, p.z) < 62;
}
export function flushOf(n: NestId, side: Pass, flutter: Pass): Flush {
  const a = approachOf(n, side);
  const h = a.approach.heading!;
  const right = { x: -Math.cos(h), z: Math.sin(h) };
  const fwd = { x: Math.sin(h), z: Math.cos(h) };
  const from = a.approach;
  const of = (fl: Pass): Flush => {
    const sg = fl === 'r' ? 1 : -1;
    // (it lands ~4.8 m from him: beside his way and a little ahead, flops on 1.2 m further out)
    const land = { x: from.x + right.x * sg * 3.6 + fwd.x * 3.2, z: from.z + right.z * sg * 3.6 + fwd.z * 3.2 };
    const drag = { x: land.x + right.x * sg * 1.0 + fwd.x * 0.6, z: land.z + right.z * sg * 1.0 + fwd.z * 0.6 };
    const away = { x: land.x + right.x * sg * 14 + fwd.x * 8, z: land.z + right.z * sg * 14 + fwd.z * 8 };
    // the held picture: him and where it shows, side by side, the lens a little behind him
    const mid = { x: (from.x + land.x) / 2, z: (from.z + land.z) / 2 };
    const view: ViewSpec = {
      at: mid, heading: h + sg * 0.32, halfW: 2.9, halfD: 1.6, tall: 1.2, pitchDeg: 24, insetTop: 110, insetBottom: 18,
      include: [{ x: from.x, z: from.z, h: RANGER_STAND_HEIGHT, r: 0.3 }, { x: drag.x, z: drag.z, h: 0.3 }],
    };
    return { land, drag, away, view, side: fl };
  };
  // (toward the side drawn; where that is no open sand — the boulder, the helipad — the other)
  const want = of(flutter);
  if (openSand(want.land) && openSand(want.drag)) return want;
  return of(flutter === 'l' ? 'r' : 'l');
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
/** Where an animal stops while he decides (a few steps in front of him, between the two). */
export const STOP: Spot = { x: 32.0, z: 40.0 };
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
  L: [{ x: 41.2, z: 41.8 }, { x: 37.8, z: 40.6 }, STOP],
  R: [{ x: 22.6, z: 42.6 }, { x: 26.4, z: 41.6 }, STOP],
};
/** Where one leaves a place by: out past the picture's edge on that place's side, behind it. */
export const LEAVE: Readonly<Record<'open' | 'hol', readonly Spot[]>> = {
  open: [{ x: 26.8, z: 41.6 }, { x: 24.4, z: 38.6 }],
  hol: [{ x: 37.4, z: 43.4 }, { x: 41.6, z: 43.4 }],
};
/** The guard's held view: both places, the stop and him at the bottom of the picture. */
export const GUARD_VIEW: ViewSpec = {
  at: { x: 31.9, z: 40.3 }, heading: 0, halfW: 3.9, halfD: 1.5, tall: 1.9, pitchDeg: 30, insetTop: 110, insetBottom: 18,
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

/** The anthill at the edge of the sand between the nests and the guard place (a find). */
export const ANTHILL: Spot & { h: number } = { x: 28.0, z: 33.6, h: 0.5 };
/** Where a woodlark may rise from the sand and sing (by the path's end and further on): a
 *  play draws one, or none. */
export const LARK_SPOTS: readonly Spot[] = [{ x: 23.8, z: 31.4 }, { x: 36.6, z: 24.6 }, { x: 41.5, z: 35.8 }];

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
  /** where a woodlark rises (index into LARK_SPOTS), or none */
  lark: number | null;
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
  const sf = play.fork('sz-route');
  const before = prev.filter((p) => p.nest === nest).pop();
  const side: Pass = before ? (before.side === 'l' ? 'r' : 'l') : sf.pick(PASSES);
  const flutter: Pass = play.fork('sz-flush').pick(PASSES);
  const lf = play.fork('sz-leeuwerik');
  const lark = lf.chance(0.6) ? lf.int(0, LARK_SPOTS.length - 1) : null;
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
 *  until a play brings them (`before`/`after` null). */
export const GUESTS: Readonly<Record<string, string>> = {
  ree: 'ree', eekhoorn: 'eekhoorn', das: 'das', wildzwijn: 'zwijn', nachtzwaluw: 'gast',
};

const nobody = (key: string, animal: string): ResidentSpec => ({ key, animal, before: null, after: null, reach: 0.5 });

/**
 * The pair: she presses on her eggs in a scrape, he rests on the sand beside it by a dead
 * branch (in free roam, on a fresh save, at HOME_NEST; a play lays them at its nest under the
 * briefing card, and they stay there after). Drawn ×1.3 (ZWALUW_SCALE). The guard place's
 * visitors come only in a play.
 */
export const ZAND_RESIDENTS: readonly ResidentSpec[] = [
  { key: 'zwaluw', animal: 'nachtzwaluw', height: ZWALUW_H, reach: 0.3,
    before: { ...femaleAt(HOME_NEST, 0), idle: 'stand', roam: 0 }, after: { ...femaleAt(HOME_NEST, 0), idle: 'stand', roam: 0 } },
  { key: 'man', animal: 'nachtzwaluw', height: ZWALUW_H, reach: 0.3,
    before: { ...maleAt(HOME_NEST), idle: 'stand', roam: 0 }, after: { ...maleAt(HOME_NEST), idle: 'stand', roam: 0 } },
  nobody('ree', 'ree'),
  nobody('eekhoorn', 'eekhoorn'),
  nobody('das', 'das'),
  nobody('zwijn', 'wildzwijn'),
  nobody('gast', 'nachtzwaluw'),
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
