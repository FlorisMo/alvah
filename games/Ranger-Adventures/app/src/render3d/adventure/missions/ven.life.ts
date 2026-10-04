/**
 * ven.life.ts — the ven alive (run 7, package ven-life, design `state/adventures/design.md`
 * §3.4-3.6): WHERE the life of the north bank is and WHAT a play brings of it. Pure (no
 * THREE): ven.finds.ts draws it, ven.ts plays it, ven.life.test.ts pins every spot.
 *
 * Always there, before and after the mission: a wilde eend with her ducklings paddling a slow
 * loop on the open water north of the ven's middle (from the bank you see them; the count and
 * which loop are a play's). A play may bring more, each from its own fork of the play, none
 * of it ever touching a knob (decision 1: where and what it looks like, never how hard):
 * dragonflies over the water's edge (in the warm moods, about half the plays), one of which
 * comes up the bank to hover in front of him on his way; a heideblauwtje on the heather by the
 * path (in the sunny moods, about half the plays) that flutters up ahead of him; a duck's
 * blue feather on the bank by the path (about two plays in five); a frog or two that plop
 * into the water from the edge as he passes; and, when the rare roll says so (core/discover:
 * a seeded chance and the pity rule), a sky-blue frog that answers his singing frog from a
 * moss cushion beside it.
 *
 * θ (degrees) round the ven's centre as in ven.places.ts: 90 the middle of the north bank,
 * larger toward the bird hide (west).
 */

import { WATER_LEVEL } from '../../Biomes.ts';
import { atLocal, dist, headingTo, toLocal } from '../places.ts';
import type { Spot } from '../types.ts';
import type { Play } from '../../../core/play.ts';
import type { MoodId } from '../../Moods.ts';
import {
  BAYS, BAY_IDS, CARPET_A, PATH, above, allStations, answerOrder, edgeOf, pathR, polar, polarOf, project, route, shoreR,
  type Bay, type BayId, type FrogSpot, type Side,
} from './ven.places.ts';

/* ------------------------------------------------------------- the ducks ---- */

/**
 * A loop the duck family paddles on the open water (a circle: its middle, its radius), a
 * slow round of ~50 s. Each lies where the ven is deep (≥ 0.3 m under the surface all
 * round, ducklings trailing behind her included), well out from the north bank's coves (no
 * duck ever paddles into a search's picture or past the song's low lens), and in view from
 * the shore path a dozen metres up the bank.
 */
export interface DuckLoop { id: string; c: Spot; r: number }
export const DUCK_LOOPS: readonly DuckLoop[] = [
  { id: 'noord', c: polar(80, 5.4), r: 1.9 },
  { id: 'oost', c: polar(50, 5.6), r: 1.8 },
  { id: 'west', c: polar(114, 5.4), r: 1.8 },
];
/** Her paddling speed (m/s) round the loop; ducklings keep `DUCKLING_GAP` m apart behind. */
export const DUCK_SPEED = 0.26;
export const DUCKLING_GAP = 0.34;
/** The first duckling swims this far (m) behind her. */
export const DUCKLING_LEAD = 0.42;
/** How many ducklings a play may bring (a fork's pick), and in free roam before any play. */
export const DUCKLINGS: readonly [number, number] = [3, 7];
export const DUCKLINGS_FREE = 4;
/** How far behind her (m along the loop) the last duckling may trail at most. */
export function trailLength(count: number): number { return DUCKLING_LEAD + (count - 1) * DUCKLING_GAP + DUCKLING_STRAY; }
/** A straying duckling falls this much further behind before it hurries back (m). */
export const DUCKLING_STRAY = 0.7;

/** A point `s` m along a loop (counter-clockwise from its east), and the way it paddles there. */
export function onLoop(l: DuckLoop, s: number): Spot & { yaw: number } {
  const a = s / l.r;
  const x = l.c.x + Math.cos(a) * l.r, z = l.c.z + Math.sin(a) * l.r;
  // (counter-clockwise in x/z: its way is the tangent)
  return { x, z, yaw: Math.atan2(-Math.sin(a), Math.cos(a)) };
}

/* ------------------------------------------------------ the dragonflies ---- */

/**
 * Where a dragonfly patrols: a spot just out over the water's edge (θ), darting within
 * `DRAGONFLY_RANGE` m of it and hovering between darts. Four along the north bank, between
 * and beside the coves; a play's dragonflies keep to the ones away from its own cove (never
 * in the search's picture or the song's).
 */
export const DRAGONFLY_TH: readonly number[] = [103, 77, 57, 35];
export const DRAGONFLY_RANGE = 1.3;
/** Their height over the water (m): low over it, a hand over the sedge tops. */
export const DRAGONFLY_Y: readonly [number, number] = [0.45, 1.15];
export function dragonflyHome(i: number): Spot {
  const th = DRAGONFLY_TH[i];
  return polar(th, shoreR(th, 0) - 0.5);
}
/** A dragonfly home is this far (m) at least from a play's cove (its frame's middle). */
export const DRAGONFLY_KEEP = 3.4;
/** The moods dragonflies fly in: warm and light (not the cold misty morning, not dusk). */
export const DRAGONFLY_MOODS: readonly MoodId[] = ['zonnig', 'gouden-uur', 'bewolkt'];
/** The homes a play's dragonflies may use (away from its cove). */
export function dragonflyHomesFor(bay: BayId): number[] {
  return DRAGONFLY_TH.map((_, i) => i).filter((i) => dist(dragonflyHome(i), BAYS[bay].frame) >= DRAGONFLY_KEEP + DRAGONFLY_RANGE);
}

/* ------------------------------------------- the butterfly, the feather ---- */

/** Where the heideblauwtje may sit: on a heather tip beside the path, on its land side, on
 *  the stretch every way to a cove walks (between the stations' moments, never on one). */
export const BUTTERFLY_TH: readonly number[] = [115, 109, 103.8];
export function butterflySpot(i: number): Spot { const th = BUTTERFLY_TH[i]; return polar(th, pathR(th) + 1.15); }
/** The sunny moods it flies in. */
export const BUTTERFLY_MOODS: readonly MoodId[] = ['zonnig', 'gouden-uur'];

/** Where a duck's blue feather may lie: on the bank just down from the path, on the same
 *  stretch (he walks past it whichever cove he goes to). */
export const FEATHER_TH: readonly number[] = [116, 110, 104];
export function featherSpot(i: number): Spot & { yaw: number } {
  const th = FEATHER_TH[i];
  const p = polar(th, pathR(th) - 1.05);
  return { ...p, yaw: (th * 37) % 6.28 };
}

/* ------------------------------------------------------ the plopping frogs ---- */

/**
 * A frog that sits at the water's edge and plops in as he passes: two at each cove's sides
 * (outside its sedge, where the reed belt begins), at the very edge. His own cove's plops as
 * he comes down to it; a cove he walks past on the path plops as he passes above it.
 */
export function plopSpot(b: Bay, i: 0 | 1): Spot & { yaw: number } {
  const u = i === 0 ? -2.8 : 2.8;
  let v = -1.5;
  while (v < 3 && above(atLocal(b.frame, u, v)) > 0.05) v += 0.02;
  const p = atLocal(b.frame, u, v);
  // (it sits facing the water, a little turned)
  return { ...p, yaw: b.frame.heading + (i === 0 ? 0.5 : -0.5) };
}
/** He comes this near (m) and it plops in: his own cove's, and one he passes on the path. */
export const PLOP_NEAR = 4.2;
export const PLOP_PASS = 8;

/* ---------------------------------------------------------- the blue frog ---- */

/** The blue frog sits this far (m) along the water's edge from where his frog sings. */
export const BLUE_AWAY = 2.5;
/**
 * Where a play's blue frog (the rare) comes up out of the water and sits on the moss to
 * answer: `BLUE_AWAY` m along the water's edge from where the found frog sings (`edgeOf`),
 * toward the cove that answers first (so it stands in the answer's picture), at the very
 * edge, turned to face the singer.
 */
export function blueOf(b: Bay, sat: FrogSpot): Spot & { yaw: number; up: Spot } {
  const sing = edgeOf(b, sat);
  const other = BAYS[answerOrder(b.id)[0]].chorus;
  const sl = toLocal(b.frame, sing), ol = toLocal(b.frame, other);
  const dir = ol.u >= sl.u ? 1 : -1;
  const u = sl.u + dir * BLUE_AWAY;
  let v = sl.v - 1;
  while (v < sl.v + 2.5 && above(atLocal(b.frame, u, v)) > 0.04) v += 0.01;
  const at = atLocal(b.frame, u, v);
  // (it comes up a short way out in the water and climbs onto the edge)
  const up = atLocal(b.frame, u, v + 0.45);
  return { ...at, yaw: headingTo(at, sing), up };
}

/* ---------------------------------------------------------------- a play ---- */

export interface VenLife {
  /** the duck family: its loop, how many ducklings, where on the loop she starts (m) */
  ducks: { loop: number; count: number; start: number };
  /** dragonflies this play: which homes (none: an empty list) */
  libellen: number[];
  /** the heideblauwtje's spot (index), or null */
  vlinder: number | null;
  /** the feather's spot (index), or null */
  veer: number | null;
  /** the frogs that plop in as he passes: cove and side */
  plops: { bay: BayId; i: 0 | 1; near: number }[];
  /** compact, noted with the play ('e5n·l·v1·f2·p2') */
  variant: string;
}

/** The ducks in free roam, before any play (and after a reload). */
export const FREE_DUCKS: VenLife['ducks'] = { loop: 0, count: DUCKLINGS_FREE, start: 0 };

/**
 * What lives on the bank this play: each decision from its own fork of the play (a later
 * draw never moves another). The duck family's loop (never the last play's) and its count;
 * dragonflies in the warm moods (about half the plays; two, away from his cove); the
 * butterfly in the sunny moods (about half); the feather (two in five); one frog plopping at
 * his own cove, and now and then one at a cove he walks past. Never a knob.
 */
export function venLife(play: Pick<Play, 'fork'>, mood: MoodId, laid: { bay: BayId; side: Side }, last: { loop: number; count: number } | null = null): VenLife {
  const e = play.fork('ven-eend');
  const loops = DUCK_LOOPS.map((_, i) => i).filter((i) => i !== last?.loop);
  const loop = e.pick(loops);
  // (never as many ducklings as last play: he sees the family has changed)
  const counts: number[] = [];
  for (let n = DUCKLINGS[0]; n <= DUCKLINGS[1]; n++) if (n !== last?.count) counts.push(n);
  const count = e.pick(counts);
  const start = Math.round(e.between(0, 2 * Math.PI * DUCK_LOOPS[loop].r) * 10) / 10;
  const l = play.fork('ven-libel');
  const flies = l.chance(0.5) && DRAGONFLY_MOODS.includes(mood);
  const libellen = flies ? l.shuffle(dragonflyHomesFor(laid.bay)).slice(0, 2).sort((a, b) => a - b) : [];
  const v = play.fork('ven-vlinder');
  const vlinder = v.chance(0.5) && BUTTERFLY_MOODS.includes(mood) ? v.int(0, BUTTERFLY_TH.length - 1) : null;
  const f = play.fork('ven-veer');
  const veer = f.chance(0.4) ? f.int(0, FEATHER_TH.length - 1) : null;
  const p = play.fork('ven-plons');
  // (his own cove's frog sits on the side he comes down to: it plops as he arrives; a frog
  // left sitting there would be a frog in the search's picture)
  const plops: VenLife['plops'] = [{ bay: laid.bay, i: laid.side > 0 ? 1 : 0, near: PLOP_NEAR }];
  p.chance(0.5); // (the stream as before: the second frog's draws stay put)
  const passed = BAY_IDS.filter((x) => BAYS[x].th > BAYS[laid.bay].th);
  if (passed.length && p.chance(0.5)) plops.push({ bay: p.pick(passed), i: p.chance(0.5) ? 0 : 1, near: PLOP_PASS });
  const variant = `e${count}${DUCK_LOOPS[loop].id.charAt(0)}${libellen.length ? 'l' : ''}${vlinder !== null ? `v${vlinder}` : ''}${veer !== null ? `f${veer}` : ''}p${plops.length}`;
  return { ducks: { loop, count, start }, libellen, vlinder, veer, plops, variant };
}

/** The history's key for the life a play brought (noted with the play; the history keeps
 *  it while the variant has room). */
export const LIFE_KEY = 'l';

/** The duck family as the play's own variant carries it (`ven:B1-amp+0.2/e5n`: five
 *  ducklings on the north loop), so the next play reads it back whatever else was noted. */
export function duckTag(d: VenLife['ducks']): string { return `e${d.count}${DUCK_LOOPS[d.loop].id.charAt(0)}`; }

/** The duck family of a play from its ven variant (`…/e5n`), or null. */
export function ducksOf(venVariant: string | undefined): { loop: number; count: number } | null {
  const m = venVariant ? /\/e(\d)([a-z])/.exec(venVariant) : null;
  if (!m) return null;
  const loop = DUCK_LOOPS.findIndex((d) => d.id.charAt(0) === m[2]);
  return loop >= 0 ? { loop, count: Number(m[1]) } : null;
}

/* --------------------------------------------------------- what is seen ---- */

/** Seen: in his picture at least this big (px, its box's larger side), this long (s). The
 *  small things of the bank are small at play distance: a butterfly or a dragonfly counts
 *  from a smaller size than the duck family (each drawn bigger than life, AnimalScale). */
export const SEEN = {
  eend: { px: 24, secs: 1, within: 35 },
  libel: { px: 16, secs: 0.8, within: 14 },
  vlinder: { px: 16, secs: 0.8, within: 12 },
  veer: { px: 14, secs: 0.5, within: 3 },
  adder: { px: 40, secs: 1, within: 12 },
  blauw: { px: 36, secs: 1, within: 20 },
} as const;

/** Is (x, z) on the stretch of shore path every way to a cove walks, clear of every
 *  station's moment (its carpet and its adder, a few metres either way)? */
export function clearOfStations(p: Spot): boolean {
  const th = polarOf(p).th;
  return allStations().every(({ st }) => Math.abs(st.th - th) * (Math.PI / 180) * 19.5 > CARPET_A + 1.6);
}

/** How far (m) along the shore path a spot lies (its nearest point). */
export function alongPath(p: Spot): number { return project(PATH, p).s; }

/** Every way to a cove passes `p`'s stretch of the path before it turns down to the cove. */
export function onEveryWay(p: Spot): boolean {
  const s = alongPath(p);
  return BAY_IDS.every((id) => ([1, -1] as const).every((side) => {
    const l = route(id, side);
    // (the route's own path part: up to where it leaves the path for the cove)
    return project(l, p).d < 1.6 && s < project(PATH, BAYS[id].offs[side]).s - 1;
  }));
}

/** The water's surface height (the ducks float on it). */
export const SURFACE = WATER_LEVEL;
