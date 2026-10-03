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
 * cove is never one of his last two plays', so three plays in a row meet the adder and
 * the moss at three other places.
 *
 * Angles: θ (degrees) round the ven's centre (46, -19), x = cx + r cos θ, z = cz + r sin θ;
 * θ 90 is the middle of the north bank, larger θ toward the bird hide (west), smaller
 * toward the east. He walks the path from the hide eastward (θ falling).
 *
 * Every play draws from its forks (decision 1; `venLayout`): the cove the frogs call from,
 * where in it the frog sits (two spots a cove, never the middle of the picture), the order
 * of the three moments (the dagnacht trial's own seeded order: the same as the 2D floor's)
 * and so which station holds the adder and which the moss, the adder's exact spot on the
 * path and her turn. None of it changes a knob: every cove is the same size, seen from the
 * same distance and angle, every frog spot fitted to the level's glimpse; difficulty is the
 * level's.
 */

import { anchorInBiome, heightAt, VEN_CENTER, WATER_LEVEL } from '../../Biomes.ts';
import { RANGER_STAND_HEIGHT, SIZE } from '../../AnimalScale.ts';
import { atLocal, dist, headingTo, segDist, stream, toLocal, type Frame } from '../places.ts';
import type { Clump } from '../cover-math.ts';
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

/** A framed view as `k.frame` takes it. */
export interface ViewSpec {
  at: Spot; heading: number; halfW: number; halfD: number; tall: number; pitchDeg: number;
  insetTop: number; insetBottom: number; include?: readonly { x: number; z: number; h: number; r?: number }[];
  seconds?: number;
}

/** The search lens over a cove: the same in every cove (decision 1), looking down on the
 *  cove from the bank (its water line across the picture). He stands at the cove's side
 *  (`side` m along the bank, `back` m up from its middle), in a lower corner of the
 *  picture, never between the lens and a frog; the lens close enough that a frog reads at
 *  ~55 px (≈ 0.23 m seen from ~3.8 m). */
export const COVE_LENS = { halfW: 0.95, halfD: 0.55, tall: 0.4, pitchDeg: 56, insetTop: 112, insetBottom: 28, r: 0.22, side: 1.4, back: 0.7 } as const;

/** The frog's spots in a cove's frame (u across, v toward the water from the cove's middle):
 *  two a cove, at the water line among the sedge, never in the middle of the picture. */
export const FROG_SPOTS: readonly { u: number; v: number }[] = [{ u: -0.62, v: 0.3 }, { u: 0.63, v: 0.25 }];

/** The look-alikes' slots in a cove (its frame): frog-sized moss clods on the wet moss at
 *  the water line and among the sedge, a heath blue on a cotton-grass head, a stonechat on
 *  a dry stalk. A play lays the zoeken trial's own set of them (`decoySlots`). */
export const CLOD_SLOTS: readonly { u: number; v: number }[] = [
  { u: -0.95, v: 0.12 }, { u: -0.2, v: 0.36 }, { u: 0.22, v: 0.2 }, { u: 0.98, v: 0.42 },
  { u: -0.6, v: -0.12 }, { u: 0.62, v: -0.16 }, { u: -0.25, v: -0.3 }, { u: 0.25, v: -0.32 },
];
export const BUTTERFLY_SLOTS: readonly { u: number; v: number }[] = [{ u: 0.0, v: -0.5 }, { u: 0.55, v: -0.5 }];
export const BIRD_SLOTS: readonly { u: number; v: number }[] = [{ u: -0.85, v: -0.42 }, { u: 0.88, v: -0.45 }];

/** Each cove's moss cushion: a round of bright veenmos in its middle, just up from the
 *  water (frame-local u, v). After the mission a frog sits on bay B's, calling. */
export const CUSHION = { u: 0.04, v: -0.06, r: 0.3 } as const;

export interface Bay {
  id: BayId;
  th: number;
  /** the cove's frame: its middle just up from the water line, `v` toward the water */
  frame: Frame;
  /** the frog's two spots (world), each with the way it sits (a three-quarter back view) */
  frogs: readonly (Spot & { yaw: number })[];
  /** where he stands to search it: up the bank, to one side */
  stand: Place;
  /** the path point above the stand (he leaves the path there) */
  off: Spot;
  /** where the cove's calling frog floats, out on the water to one side */
  chorus: Spot;
  /** the side of the picture he stands in (+1: lower right) */
  side: 1 | -1;
  views: { search: ViewSpec };
}

/** The coves' angles: A nearest the hide, C furthest east. */
const BAY_TH: Readonly<Record<BayId, number>> = { A: 90, B: 68, C: 46 };
/** Where each cove's calling frog floats (θ): beside its cove, never in another's. */
const CHORUS_TH: Readonly<Record<BayId, number>> = { A: 101, B: 78, C: 36 };
/** The side of the picture he stands in (+1: lower right). */
const BAY_SIDE: Readonly<Record<BayId, 1 | -1>> = { A: 1, B: -1, C: -1 };

function bay(id: BayId): Bay {
  const th = BAY_TH[id], side = BAY_SIDE[id];
  const rw = shoreR(th, 0.1);
  const mid = polar(th, rw + 0.42);
  const frame: Frame = { ...mid, heading: headingTo(mid, C) };
  const frogs = FROG_SPOTS.map((f, i) => ({ ...atLocal(frame, f.u, f.v), yaw: frame.heading + (i ? -0.75 : 0.75) }));
  const stand0 = atLocal(frame, side * COVE_LENS.side, -COVE_LENS.back);
  const stand: Place = { ...stand0, r: 0.7, heading: headingTo(stand0, atLocal(frame, -side * 0.3, 0.25)) };
  const off = pointAt(PATH, project(PATH, stand).s);
  // (on the water ~2.5 m along the bank from the cove, where it is a hand deep: floating)
  const cth = CHORUS_TH[id];
  const chorus = polar(cth, shoreR(cth, -0.07));
  const search: ViewSpec = {
    at: atLocal(frame, 0, 0.06), heading: frame.heading,
    halfW: COVE_LENS.halfW, halfD: COVE_LENS.halfD, tall: COVE_LENS.tall, pitchDeg: COVE_LENS.pitchDeg,
    insetTop: COVE_LENS.insetTop, insetBottom: COVE_LENS.insetBottom,
    include: [{ x: stand.x, z: stand.z, h: RANGER_STAND_HEIGHT, r: COVE_LENS.r }],
  };
  return { id, th, frame, frogs, stand, off, chorus, side, views: { search } };
}

export const BAYS: Readonly<Record<BayId, Bay>> = { A: bay('A'), B: bay('B'), C: bay('C') };

/** A spot in a cove's frame (world). */
export function inCove(b: Bay, u: number, v: number): Spot { return atLocal(b.frame, u, v); }

/** The song (after the find): he stays where he searched; the lens turns round to look
 *  back from over the water — the frog big on the moss in front, singing toward him, the
 *  boy behind it on the bank (one soft dip-cut: a turn that big is never a swing). */
export function singOf(b: Bay, frog: Spot): { stand: Place; view: ViewSpec } {
  const fl = toLocal(b.frame, frog);
  const view: ViewSpec = {
    at: atLocal(b.frame, fl.u, fl.v + 0.0), heading: b.frame.heading + Math.PI, halfW: 0.6, halfD: 0.4, tall: 0.25, pitchDeg: 26,
    insetTop: 120, insetBottom: 60, seconds: 1.6,
    include: [{ x: b.stand.x, z: b.stand.z, h: RANGER_STAND_HEIGHT, r: 0.1 }],
  };
  return { stand: b.stand, view };
}

/** Where the frog plops into the ven: along the water's edge and out into it, away from
 *  the boy (sideways in the song's picture, never toward the lens). */
export function plopOf(b: Bay, frog: Spot): Spot {
  const fl = toLocal(b.frame, frog);
  return atLocal(b.frame, fl.u - b.side * 0.9, fl.v + 1.25);
}

/* ---------------------------------------------------------- the route ---- */

/** His whole way to a cove (golden's): the marker, up past the hide, along the path to
 *  above the cove, down the bank to where he searches. */
export function routeOf(b: Bay): Line {
  const end = project(PATH, b.off).s;
  return measure([MARKER, ...APPROACH, ...PATH.pts.filter((_, i) => PATH.acc[i] < end - 0.3), b.off, { x: b.stand.x, z: b.stand.z }]);
}
const ROUTES: Readonly<Record<BayId, Line>> = { A: routeOf(BAYS.A), B: routeOf(BAYS.B), C: routeOf(BAYS.C) };
/** A cove's route (made once). */
export function route(id: BayId): Line { return ROUTES[id]; }

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
/** A cove's two stations. */
export function stationsOf(id: BayId): readonly [Station, Station] {
  const l = route(id);
  return STATION_TH[id].map((th, i) => {
    const at = polar(th, pathR(th));
    return { i: i as StationIndex, th, at, s: project(l, at).s };
  }) as unknown as [Station, Station];
}

/** How far before her (m along the route) his walk to the adder ends. */
export const ADDER_BEFORE = 4.2;
/** The adder's spot may lie this far (m) either way along the path from her station. */
export const ADDER_SHIFT = 1.0;
/** Within this (m) of her he has come too close: she lifts her head and hisses (the reach);
 *  within `ADDER_WARN` she only notices him (a cue, nothing more). */
export const ADDER_NEAR = 2.4;
export const ADDER_WARN = 3.5;

/** The adder at a station: on the path, coiled, turned `turn` off its line; `s` along the
 *  cove's route. */
export function adderAt(id: BayId, st: Station, shift: number, turn: number): Spot & { yaw: number; s: number } {
  const l = route(id);
  const s = st.s + shift;
  return { ...pointAt(l, s), yaw: headingAt(l, s) + Math.PI / 2 + turn, s };
}
/** Where his walk up to her ends (`ADDER_BEFORE` m before her on his way). */
export function adderApproach(id: BayId, adderS: number): Place {
  const l = route(id);
  const s = adderS - ADDER_BEFORE;
  return { ...pointAt(l, s), r: 0.9, heading: headingAt(l, s) };
}
/** Where she slides off to: up the bank into the heather. */
export function adderHeather(a: Spot): Spot {
  const p = polarOf(a);
  return polar(p.th + 1.5, p.r + 2.6);
}
/** The one calm shot while her words are read, and held while he keeps his distance (his
 *  feet free): from the heather side behind him, looking across the path toward the water —
 *  him in one corner, her coiled on the warm sand ahead in the other, both whole (never at
 *  the lens: she lies beyond him). */
export function adderView(a: Spot, me: Spot): ViewSpec {
  const d = Math.max(0.1, dist(a, me));
  const t = { x: (a.x - me.x) / d, z: (a.z - me.z) / d };
  const mid = { x: me.x + (a.x - me.x) * 0.55, z: me.z + (a.z - me.z) * 0.55 };
  const pm = polarOf(mid);
  const out = { x: Math.cos(pm.th * RAD), z: Math.sin(pm.th * RAD) }; // (away from the water)
  const look = { x: t.x * 0.62 - out.x * 0.78, z: t.z * 0.62 - out.z * 0.78 };
  return {
    at: mid, heading: Math.atan2(look.x, look.z), halfW: d * 0.4 + 0.45, halfD: 0.7,
    tall: 0.5, pitchDeg: 30, insetTop: 120, insetBottom: 40, seconds: 1.5,
    include: [{ x: me.x, z: me.z, h: RANGER_STAND_HEIGHT, r: 0.25 }, { x: a.x, z: a.z, h: 0.25 }],
  };
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
 *  middle line, over its half-width, squared. */
export function inCarpet(c: Carpet, p: Spot): number {
  return (segDist(p, c.top, c.low) / c.a) ** 2;
}
/** A boot in it: well inside its rim (its feathered edge is the dry bank's). */
export const CARPET_WET = 0.8;
/** The dry way round it on the heather side (golden's `via`): up above its top, across,
 *  and back down to the path beyond it. */
export function carpetRound(c: Carpet): Spot[] {
  const r0 = pathR(c.th);
  const dth = (CARPET_A + 0.9) / (r0 * RAD);
  return [polar(c.th + dth, r0 + 1.3), polar(c.th, r0 + CARPET_TOP + 1.15), polar(c.th - dth, r0 + 1.3)];
}
/** Where his walk past the carpet ends (beyond it on his way). */
export function carpetPast(id: BayId, st: Station): Place {
  const l = route(id);
  const s = st.s + CARPET_A + CARPET_PAST;
  return { ...pointAt(l, s), r: 0.9, heading: headingAt(l, s) };
}

/** "Het droge pad is vrij": he walks on at least this far (m), within the level's wait. */
export const GO_AWAY = 3;
/** …and golden walks this far on, along his way. */
export const GO_ON = 4.2;

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
export function wayOf(laid: Pick<VenLaid, 'bay' | 'order' | 'stations' | 'adderShift' | 'adderTurn'>, listens: number): WayStep[] {
  const id = laid.bay;
  const l = route(id);
  const sts = stationsOf(id);
  const steps: WayStep[] = [];
  let lastEnd = 0;
  for (const enc of laid.order) {
    if (enc === 'adder-ven') {
      const st = sts[laid.stations['adder-ven']];
      const adder = adderAt(id, st, laid.adderShift, laid.adderTurn);
      const approach = adderApproach(id, adder.s);
      steps.push({ kind: 'adder', s: adder.s - ADDER_BEFORE, station: st.i, adder, approach });
      lastEnd = adder.s - ADDER_BEFORE;
    } else if (enc === 'modder-ven') {
      const st = sts[laid.stations['modder-ven']];
      const carpet = carpetAt(st);
      const past = carpetPast(id, st);
      steps.push({ kind: 'modder', s: st.s - CARPET_A - CARPET_SEEN, station: st.i, carpet, past, round: carpetRound(carpet) });
      lastEnd = st.s + CARPET_A + CARPET_PAST;
    } else if (enc === 'pad-ven') {
      // (he walks on along his way: away from where he came from, past where she lay; where
      // his way turns down to the cove, a little further, so the walk is really GO_ON long)
      const from = pointAt(l, lastEnd);
      let s1 = Math.min(l.length, lastEnd + GO_ON);
      while (s1 < l.length && dist(pointAt(l, s1), from) < GO_AWAY + 0.6) s1 = Math.min(l.length, s1 + 0.25);
      steps.push({ kind: 'pad', s: lastEnd, to: { ...pointAt(l, s1), r: 0.7, heading: headingAt(l, s1) }, from: pointAt(l, lastEnd - 6) });
    }
  }
  const busy = steps.map(spanOf);
  const sOff = project(l, BAYS[id].off).s;
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

/** The sedge tussocks close round every frog spot (u, v off the spot, size): every spot gets
 *  the same ring, so the cover never marks the real one. */
const RING: readonly (readonly [number, number, number])[] = [[-0.28, -0.1, 0.8], [0.3, -0.07, 0.84], [0.04, -0.33, 0.88], [-0.22, 0.24, 0.72], [0.25, 0.22, 0.74], [-0.12, -0.24, 0.66], [0.17, -0.22, 0.68]];

/**
 * A cove's sedge (the CoverField's clumps: 'grass' tussocks), the same way for the home
 * and the tests: a ring round each frog spot, and a scatter over the cove that keeps the
 * look-alikes' slots, the moss cushion and where he stands open. Deterministic.
 */
export function coveClumps(b: Bay): Clump[] {
  const rnd = stream(101 + BAY_IDS.indexOf(b.id) * 17);
  const out: Clump[] = [];
  const frogs = FROG_SPOTS.map((f) => atLocal(b.frame, f.u, f.v));
  const slots = [...CLOD_SLOTS, ...BUTTERFLY_SLOTS, ...BIRD_SLOTS].map((q) => atLocal(b.frame, q.u, q.v));
  const cushion = atLocal(b.frame, CUSHION.u, CUSHION.v);
  for (const f of frogs) {
    const fl = toLocal(b.frame, f);
    for (const [u, v, k] of RING) out.push({ ...atLocal(b.frame, fl.u + u, fl.v + v), kind: 'grass', size: k });
  }
  const A = 1.6, B = 0.95, V0 = -0.15, SP = 0.4;
  for (let v = -B; v <= B + 1e-6; v += SP * 0.87) {
    for (let u = -A; u <= A + 1e-6; u += SP) {
      const uu = u + (rnd() - 0.5) * SP * 0.5 + (Math.round(v / SP) % 2 ? SP / 2 : 0), vv = v + (rnd() - 0.5) * SP * 0.4;
      const e = (uu / A) ** 2 + (vv / B) ** 2;
      if (e > 1.05 || (e > 0.7 && rnd() < 0.35)) continue;
      const p = atLocal(b.frame, uu, vv + V0);
      if (frogs.some((f) => dist(p, f) < 0.4)) continue;
      if (slots.some((s) => dist(p, s) < 0.26)) continue;
      if (dist(p, cushion) < CUSHION.r + 0.1) continue; // (the moss cushion lies open)
      if (dist(p, b.stand) < 1.0) continue;
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
  /** which of the cove's two frog spots */
  spot: 0 | 1;
  /** the three moments' encounter ids in this play's order (the trial's) */
  order: readonly string[];
  /** the station each danger is met at */
  stations: { 'adder-ven': StationIndex; 'modder-ven': StationIndex };
  /** the adder's spot along the path from her station (m) and her turn off its line (rad) */
  adderShift: number;
  adderTurn: number;
  /** compact, logged with every beat (`B1-am+0.6`) */
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

/**
 * This play's north bank, drawn from its forks (one per decision: a later draw never
 * reshuffles another): the cove leaves out the last two plays' (three plays in a row are
 * three coves), the frog's spot in it, the adder's spot and turn. `order` is the dagnacht
 * trial's order for this play (`playDagnachtTrial`: the same the 2D floor plays): the
 * first danger in it is met at the cove's first station, the second at its second.
 */
export function venLayout(play: Pick<Play, 'fork'>, order: readonly string[], last: readonly string[] = []): VenLaid {
  const recent = last.slice(-2).map((v) => v.charAt(0)).filter((x): x is BayId => (BAY_IDS as readonly string[]).includes(x));
  const left = BAY_IDS.filter((b) => !recent.includes(b));
  const bayId = play.fork('ven-baai').pick(left.length ? left : BAY_IDS);
  const spot = play.fork('ven-plek').pick([0, 1] as const);
  const dangers = order.filter((id) => id === 'adder-ven' || id === 'modder-ven');
  const stations = {
    'adder-ven': (Math.max(0, dangers.indexOf('adder-ven')) as StationIndex),
    'modder-ven': (Math.max(0, dangers.indexOf('modder-ven')) as StationIndex),
  };
  const a = play.fork('ven-adder');
  const adderShift = Math.round(a.between(-ADDER_SHIFT, ADDER_SHIFT) * 10) / 10;
  const adderTurn = Math.round(a.between(-0.7, 0.7) * 100) / 100;
  const code = order.map((d) => d.charAt(0)).join('');
  const variant = `${bayId}${spot}-${code}${adderShift >= 0 ? '+' : ''}${adderShift}`;
  return { bay: bayId, spot, order: [...order], stations, adderShift, adderTurn, variant };
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

/** The frog's spot this play (world, the way it sits). */
export function frogOf(l: Pick<VenLaid, 'bay' | 'spot'>): Spot & { yaw: number } {
  return BAYS[l.bay].frogs[l.spot];
}

/**
 * The look-alikes of this play's trial laid on the cove's slots (seeded): the moss clods
 * ('bush' decoys) on clod slots, the butterfly and the bird on theirs.
 */
export function decoySlots(b: Bay, decoys: readonly { id: string; k: string }[], rng: () => number): { id: string; k: string; x: number; z: number }[] {
  const shuffled = <T>(xs: readonly T[]): T[] => {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const pools: Record<string, { u: number; v: number }[]> = { bush: shuffled(CLOD_SLOTS), butterfly: shuffled(BUTTERFLY_SLOTS), bird: shuffled(BIRD_SLOTS) };
  const out: { id: string; k: string; x: number; z: number }[] = [];
  for (const d of decoys) {
    const q = (pools[d.k] ?? pools.bush).shift();
    if (!q) continue;
    out.push({ id: d.id, k: d.k, ...atLocal(b.frame, q.u, q.v) });
  }
  return out;
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
 * in its own cove and spot under the briefing card; in free roam bay B's first spot), and
 * one floats in each cove's water calling now and then (`koorA..C`), so the chorus is
 * heard from the bank within ~20 m and rings spread where one calls (ven.home.ts). After
 * it the frog he found has plonsed back into the ven; one frog sits on bay B's moss
 * cushion and calls (`koorB` climbed out there in the reunion), the other two are under
 * the water. The adder is the home's own, laid on the path only for a play (never in free
 * roam): no resident.
 */
export const VEN_RESIDENTS: readonly ResidentSpec[] = [
  { key: 'kikker', animal: 'heikikker', reach: 0.5,
    before: { ...BAYS.B.frogs[0], idle: 'stand', roam: 0 },
    after: null },
  ...BAY_IDS.map((id, i): ResidentSpec => ({
    key: CHORUS_KEYS[id], animal: 'heikikker', reach: 7,
    before: { ...BAYS[id].chorus, yaw: BAYS[id].frame.heading + Math.PI + (i - 1) * 0.6, idle: 'stand', roam: 0 },
    after: id === 'B' ? { ...AFTER_FROG, idle: 'stand', roam: 0 } : null,
    voice: id === 'B'
      ? { call: 'heikikker', every: [6, 11], within: 20 }
      : { call: 'heikikker', every: [5 + i * 1.5, 9 + i * 1.5], within: 20, state: 'before' },
  })),
];

/** The places table (`__ranger.missionPlaces('ven')`): the marker, the home, every cove
 *  and its stand, every cove's stations. */
export const VEN_PLACES: Readonly<Record<string, Place>> = (() => {
  const t: Record<string, Place> = { marker: { ...MARKER, r: 2.4 }, home: { x: AFTER_FROG.x, z: AFTER_FROG.z } };
  for (const id of BAY_IDS) {
    const b = BAYS[id];
    t[`${id}.cove`] = { x: b.frame.x, z: b.frame.z, heading: b.frame.heading };
    t[`${id}.stand`] = b.stand;
    stationsOf(id).forEach((s) => { t[`${id}.S${s.i + 1}`] = { ...s.at }; });
  }
  return t;
})();

/** Every station of every cove (the home lays a carpet's moss there when a play wants it). */
export function allStations(): { bay: BayId; st: Station }[] {
  return BAY_IDS.flatMap((bay) => stationsOf(bay).map((st) => ({ bay, st })));
}

/** The ground the world's scatter (heath plants, the reed belt) leaves to the home: the
 *  coves, the stands and the way down to them, the path, the stations' moss. */
export function venClearings(): { x: number; z: number; r: number }[] {
  const out: { x: number; z: number; r: number }[] = [];
  for (const id of BAY_IDS) {
    const b = BAYS[id];
    out.push({ x: b.frame.x, z: b.frame.z, r: 2.0 });
    for (const u of [-1.3, 1.3]) out.push({ ...atLocal(b.frame, u, 0.1), r: 1.1 });
    out.push({ x: b.stand.x, z: b.stand.z, r: 1.5 });
    // the way down from the path, and what the lens sees over his shoulder
    for (let k = 0.25; k < 1; k += 0.25) out.push({ x: b.off.x + (b.stand.x - b.off.x) * k, z: b.off.z + (b.stand.z - b.off.z) * k, r: 1.4 });
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
