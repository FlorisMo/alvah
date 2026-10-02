/**
 * surprises-math.ts — the open world's small surprises, the pure half (run 7, design
 * `state/foundation/design.md` §7.2): which surprise comes next, when, where it may stand,
 * and when he has really met it. world/Surprises.ts brings them to life.
 *
 * A calm director: only in free roam (on foot or in the jeep), one at a time, the first
 * after a short while of walking, the next at least APART_S after the last one began and
 * REST_S after it went. Which one comes is drawn from the session's seed: the ones he has
 * not met yet first (so a new player meets new things), never the same twice in a row, a
 * rare one now and then (a seeded chance, and surely after RARE_PITY_W surprises without
 * one) but only in its own light (the stag in the mist or at dusk, the badger at dusk).
 * One he has not met yet comes before any he knows: the director waits for a place for it
 * (FRESH_WAIT_S at most), so a return visit meets something new. It stands inside his
 * picture (a bird met by its call may sit anywhere within hearing: its call turns him),
 * never on the line he walks along, never in a mission's home, and it never comes toward
 * the lens; the robin hops along beside him. He meets it when he SEES it (on screen,
 * ≥ SEEN_PX, within SEEN_M, for SEEN_S on end) or HEARS its call (within 25 m:
 * Sound.callAt's reach; never the robin, who is there to be seen). Pure: no THREE, no DOM;
 * the seed and the world come in.
 */

import type { Play } from '../../core/play';
import type { MoodId } from '../Moods';
import { ontdekking } from '../../content/ontdekkingen.ts';

/** The seven surprises (content/ontdekkingen.ts: `wereld.<id>`). */
export type SurpriseId = 'buizerd' | 'specht' | 'koekoek' | 'winterkoning' | 'roodborst' | 'edelhert' | 'das';

/** Where it is: over open ground (the buzzard's low circle), on a trunk, in a crown, at a
 *  tree's foot, on open ground, or a few hops beside him (the robin). */
export type SurprisePlek = 'lucht' | 'stam' | 'kroon' | 'voet' | 'grond' | 'mee';

export interface SurpriseSpec {
  id: SurpriseId;
  rare: boolean;
  plek: SurprisePlek;
  /** how far from the ranger it is staged (m) */
  dist: readonly [number, number];
  /** its call (Sound's id) and how often (s), or null (it is only seen) */
  call: { id: string; every: readonly [number, number] } | null;
  /** at most this long (s) before it goes on its way */
  stayS: number;
  /** only when he is on foot (a robin never follows a jeep) */
  onFoot?: boolean;
  /** it moves (a glide, hops, a walk): not under reduced motion, where only the still ones come */
  moves?: boolean;
  /** a model (GLB id) of its own; the buzzard is the world's own glider (world/Fauna.ts) */
  model: string | null;
  /** met only by SEEING it: its call alone is no meeting (the robin: its hint promises a
   *  bird that hops along with him, so a song with nothing to see would break it) */
  seenOnly?: boolean;
  /** its moods: its row's in content/ontdekkingen.ts (the one table says it) */
  stemming?: readonly MoodId[];
}

/** The robin keeps beside the line he walks along: this far (m) to his side… */
export const ROBIN_SIDE: readonly [number, number] = [1.9, 2.4];
/** …about level with him, a little ahead (m along where the lens looks: + ahead of him),
 *  where the walk lens (4.6 m behind him, 2.4 m up) sees it big enough: in the picture's
 *  lower half, ≥ SEEN_PX, never under his feet and never coming toward the lens; a robin
 *  that fell a hop or two behind is still in the picture. */
export const ROBIN_ALONG: readonly [number, number] = [0.2, 0.9];
/** It never lands nearer him than this (m); when he comes nearer, it hops aside to its
 *  spot beside his line at once… */
export const ROBIN_SHY_M = 1.5;
/** …and only when he walks right onto it (this near, m) does it fly off. */
export const ROBIN_GO_M = 1.0;
/** One hop (m) and one flutter (m: when it fell behind, a low flight to catch up). */
export const ROBIN_HOP_M = 0.6;
export const ROBIN_FLUTTER_M = 2.2;

type Base = Omit<SurpriseSpec, 'rare' | 'stemming'>;
const BASE: readonly Base[] = [
  { id: 'buizerd', plek: 'lucht', dist: [17, 21], call: { id: 'buizerd', every: [6, 9] }, stayS: 34, moves: true, model: null },
  { id: 'specht', plek: 'stam', dist: [11, 22], call: { id: 'specht', every: [4.5, 7] }, stayS: 40, model: 'bird-grote-bonte-specht' },
  { id: 'koekoek', plek: 'kroon', dist: [12, 22], call: { id: 'koekoek', every: [5, 8] }, stayS: 40, model: 'bird-koekoek' },
  { id: 'winterkoning', plek: 'voet', dist: [9, 17], call: { id: 'winterkoning', every: [6, 9] }, stayS: 36, model: 'bird-winterkoning' },
  { id: 'roodborst', plek: 'mee', dist: [ROBIN_SIDE[0], 2.6], call: { id: 'roodborst', every: [6, 10] }, stayS: 32, onFoot: true, moves: true, seenOnly: true, model: 'bird-roodborst' },
  { id: 'edelhert', plek: 'grond', dist: [22, 30], call: null, stayS: 30, model: 'animal-edelhert-reddeer' },
  { id: 'das', plek: 'grond', dist: [6.5, 8.5], call: null, stayS: 28, model: 'animal-das-badger' },
];

/** The surprises, each with its row's kind (rare) and light from the one table. */
export const SURPRISES: readonly SurpriseSpec[] = BASE.map((b) => {
  const row = ontdekking(`wereld.${b.id}`);
  return { ...b, rare: row?.soort === 'zeldzaam', stemming: row?.stemming };
});

/* ------------------------------------------------------------- the clock ---- */

/** Seconds of free roam before the first surprise of a visit (a seeded moment in here). */
export const FIRST_AFTER: readonly [number, number] = [22, 36];
/** One begins at least this long (s) after the last one began… */
export const APART_S = 45;
/** …and at least this long (s) after it went; plus a seeded breath of up to EXTRA_S. */
export const REST_S = 12;
export const EXTRA_S = 18;
/** A surprise that could not be placed tries again after this long (s). */
export const RETRY_S = 5;
/** The longest any surprise stays (s). */
export const MAX_STAY_S = 60;

/** When (free-roam seconds) the next one may begin, after one that began at `start` and
 *  went at `end`. */
export function nextAfter(start: number, end: number, fork: Play): number {
  return Math.max(start + APART_S, end + REST_S) + fork.between(0, EXTRA_S);
}

/** When the first one of a visit may begin. */
export function firstAt(fork: Play): number {
  return fork.between(FIRST_AFTER[0], FIRST_AFTER[1]);
}

/* ------------------------------------------------------------ which one ---- */

/** Surprises met without a rare one, after which the next that fits the light is rare. */
export const RARE_PITY_W = 3;
/** The chance a rare one comes first otherwise (when one fits the light). */
export const RARE_P_W = 0.25;

export interface Choice {
  mood: MoodId;
  /** his discoveries (content ids, `wereld.<id>`) */
  found: Readonly<Record<string, unknown>>;
  /** surprises met since the last rare one (`zeldzaam.wereld`) */
  sinceRare: number;
  /** the last surprise (never twice in a row) */
  last: SurpriseId | null;
  /** the ones already out there this visit (they come last: a visit meets new things first) */
  shown?: readonly SurpriseId[];
  onFoot: boolean;
  reduced: boolean;
}

/** May this one come now (its light, on foot, reduced motion)? */
export function fits(s: SurpriseSpec, c: Pick<Choice, 'mood' | 'onFoot' | 'reduced'>): boolean {
  if (s.stemming?.length && !s.stemming.includes(c.mood)) return false;
  if (s.onFoot && !c.onFoot) return false;
  if (s.moves && c.reduced) return false;
  return true;
}

/**
 * The order to try them in for the next surprise (the first that can be placed comes):
 * a rare one first when one fits and the pity rule or the seeded chance says so; then the
 * ones he has not met yet, shuffled; then the rest, shuffled; the ones already out there
 * this visit last; never the last one. The rare ones never come otherwise. Deterministic
 * per fork.
 */
export function surpriseOrder(c: Choice, fork: Play, specs: readonly SurpriseSpec[] = SURPRISES): SurpriseSpec[] {
  const ok = specs.filter((s) => s.id !== c.last && fits(s, c));
  const rares = ok.filter((s) => s.rare);
  const lucky = fork.chance(RARE_P_W); // (always drawn: the stream stays put)
  const rareFirst = rares.length > 0 && (c.sinceRare >= RARE_PITY_W || lucky);
  const commons = ok.filter((s) => !s.rare);
  const met = (s: SurpriseSpec): boolean => !!c.found[`wereld.${s.id}`];
  const fresh = fork.shuffle(commons.filter((s) => !met(s)));
  const known = fork.shuffle(commons.filter(met));
  const rare = rareFirst ? fork.shuffle([...rares.filter((s) => !met(s)), ...rares.filter(met)]) : [];
  const out = [...rare, ...fresh, ...known];
  const shown = c.shown ?? [];
  return [...out.filter((s) => !shown.includes(s.id)), ...out.filter((s) => shown.includes(s.id))];
}

/** A surprise he has NOT met yet (and that fits the light) comes before any he knows: when
 *  it has no place where he is now, the director waits for it, trying again RETRY_S apart
 *  as he walks, at most this long (s) past the moment the next one was due. Then one he
 *  knows may come, so a walk never goes empty for long (a return visit meets new things). */
export const FRESH_WAIT_S = 60;
/** One already out there this visit comes again only after this long (s) without a place
 *  for another (a visit shows new things first). */
export const AGAIN_WAIT_S = 15;

/**
 * Which of `order` (surpriseOrder's) may be tried now, `waited` s after the next one was
 * due: the ones he has not met that are not out there yet this visit, alone, while the
 * director still waits for them (< FRESH_WAIT_S); else the ones not out there yet this
 * visit (< AGAIN_WAIT_S); else all, in order.
 */
export function tryNow(order: readonly SurpriseSpec[], c: { found: Readonly<Record<string, unknown>>; shown: readonly SurpriseId[]; waited: number }): SurpriseSpec[] {
  const shown = (s: SurpriseSpec): boolean => c.shown.includes(s.id);
  const fresh = order.filter((s) => !c.found[`wereld.${s.id}`] && !shown(s));
  if (fresh.length > 0 && c.waited < FRESH_WAIT_S) return fresh;
  const unshown = order.filter((s) => !shown(s));
  if (unshown.length > 0 && c.waited < AGAIN_WAIT_S) return unshown;
  return [...order];
}

/* ------------------------------------------------------------ where ---- */

/** A spot is never closer than this (m) to the line he walks along, ahead of him. */
export const OFF_PATH_M = 3;
/** The picture's half-width the director stages inside (rad): well inside the lens's
 *  ~41° (FOV 55°, 1280×800), never dead centre either. */
export const CONE = (32 * Math.PI) / 180;
/** A bird met by its call may sit wider, up to the picture's edge and a little past it:
 *  its call (panned from where it is) makes him turn and look. */
export const CONE_WIDE = (58 * Math.PI) / 180;
const CONE_MIN = (9 * Math.PI) / 180;

export interface Viewer { x: number; z: number; /** where the lens looks (rad, atan2(dx, dz)) */ yaw: number }

/** The bearing (rad, -π..π) of (x, z) from the viewer, relative to where the lens looks. */
export function bearing(v: Viewer, x: number, z: number): number {
  const a = Math.atan2(x - v.x, z - v.z) - v.yaw;
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/** Is (x, z) inside the picture's cone, off its dead centre, and off the line ahead of him? */
export function inCone(v: Viewer, x: number, z: number, cone = CONE): boolean {
  const b = Math.abs(bearing(v, x, z));
  if (b > cone || b < CONE_MIN) return false;
  const d = Math.hypot(x - v.x, z - v.z);
  // (beside the line he walks along, never on it; behind him there is no line to keep off)
  return b >= Math.PI / 2 || d * Math.sin(b) >= OFF_PATH_M;
}

/** Seeded candidate spots for an open-ground surprise: inside the cone, `dist` m off. */
export function groundSpots(v: Viewer, dist: readonly [number, number], fork: Play, n = 24): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  for (let i = 0; i < n; i++) {
    const side = fork.chance(0.5) ? 1 : -1;
    const a = v.yaw + side * fork.between(CONE_MIN + 0.08, CONE - 0.02);
    const d = fork.between(dist[0], dist[1]);
    const x = v.x + Math.sin(a) * d, z = v.z + Math.cos(a) * d;
    if (inCone(v, x, z)) out.push({ x, z });
  }
  return out;
}

/** A bird met by its call may sit at any bearing within hearing (its call, panned from
 *  where it is, makes him turn and look): ALL_ROUND as the cone. */
export const ALL_ROUND = Math.PI;

/** The trees (or other perches) a surprise may use: inside the cone, `dist` m off; those
 *  in the picture first, then those at its edge (CONE_WIDE), then the rest; each group in
 *  a seeded order. */
export function treeChoices<T extends { x: number; z: number }>(v: Viewer, trees: readonly T[], dist: readonly [number, number], fork: Play, cone = CONE): T[] {
  const ok = trees.filter((t) => {
    const d = Math.hypot(t.x - v.x, t.z - v.z);
    return d >= dist[0] && d <= dist[1] && inCone(v, t.x, t.z, cone);
  });
  const inPicture = ok.filter((t) => inCone(v, t.x, t.z));
  const atEdge = ok.filter((t) => !inPicture.includes(t) && inCone(v, t.x, t.z, CONE_WIDE));
  const rest = ok.filter((t) => !inPicture.includes(t) && !atEdge.includes(t));
  return [...fork.shuffle(inPicture), ...fork.shuffle(atEdge), ...fork.shuffle(rest)];
}

/**
 * The way an animal on the ground leaves: away from him, a little to one side (never
 * toward the lens): a unit direction whose dot with "from him to it" is ≥ cos 45°.
 */
export function awayFrom(v: { x: number; z: number }, at: { x: number; z: number }, side: number): { x: number; z: number } {
  const a = Math.atan2(at.x - v.x, at.z - v.z) + side * 0.5;
  return { x: Math.sin(a), z: Math.cos(a) };
}

/** A badger's way: across his picture, side-on to him, a touch away (84° from straight
 *  away: never toward him). */
export function acrossFrom(v: { x: number; z: number }, at: { x: number; z: number }, side: number): { x: number; z: number } {
  const a = Math.atan2(at.x - v.x, at.z - v.z) + side * 1.47;
  return { x: Math.sin(a), z: Math.cos(a) };
}

/* ------------------------------------------------------- met: seen, heard ---- */

/** Seen: on screen at least this big (px, the larger side of its box)… */
export const SEEN_PX = 40;
/** …within this far of him (m)… */
export const SEEN_M = 35;
/** …for this long on end (s). */
export const SEEN_S = 1;
/** Heard: its call played within this far (m) of the lens (Sound.callAt's reach). */
export const HEARD_M = 25;

/** Counts how long it has been in his picture, big enough and near enough, on end. */
export class SeenMeter {
  private run = 0;
  seen = false;
  /** One frame: was it visible this frame (on screen, unhidden), how big (px), how far (m)? */
  step(dt: number, visible: boolean, px: number, dist: number): boolean {
    if (visible && px >= SEEN_PX && dist <= SEEN_M) this.run += dt;
    else this.run = 0;
    if (this.run >= SEEN_S) this.seen = true;
    return this.seen;
  }
}

/** Does the ground hide the segment from `a` to `b` (sampled every metre)? */
export function groundHides(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, groundY: (x: number, z: number) => number, margin = 0.15): boolean {
  const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  const n = Math.max(2, Math.ceil(d));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, z = a.z + (b.z - a.z) * t;
    if (y < groundY(x, z) - margin) return true;
  }
  return false;
}

/* ------------------------------------------------------------ going ---- */

/** He walked this far off (m): it goes. */
export const LEAVE_FAR_M = 45;

/** How near (m) he may come before it goes on its way (calmly: it never flees in a hurry). */
export const SHY_M: Record<SurpriseId, number> = {
  buizerd: 0, specht: 6, koekoek: 6, winterkoning: 4, roodborst: ROBIN_GO_M, edelhert: 14, das: 4,
};

/** Should it go now? (up too long, he is far off, or he came too near) */
export function shouldGo(s: SurpriseSpec, age: number, dist: number): boolean {
  if (age >= Math.min(s.stayS, MAX_STAY_S)) return true;
  if (dist > LEAVE_FAR_M) return true;
  return SHY_M[s.id] > 0 && dist < SHY_M[s.id];
}

/* ------------------------------------------------------------ the robin ---- */

/** Close enough to its spot (m): it stays, turns to look at him. */
const ROBIN_NEAR_M = 0.45;

/** Where the robin would like to be: beside him at `side` (−1 left, +1 right of the lens's
 *  view), `lat` m off his line, `along` m along the view. */
export function robinSpot(ranger: { x: number; z: number }, yaw: number, side: number, lat: number, along: number): { x: number; z: number } {
  const fx = Math.sin(yaw), fz = Math.cos(yaw); // where the lens looks
  const rx = -fz, rz = fx;                       // its right (y up: forward × up)
  return { x: ranger.x + rx * side * lat + fx * along, z: ranger.z + rz * side * lat + fz * along };
}

/**
 * The robin's next hop toward its spot: a hop of ≤ ROBIN_HOP_M, a flutter of ≤ ROBIN_FLUTTER_M
 * when it is far behind, or null (near enough: it stays). Its spot on his other side: it
 * goes round him, never landing nearer him than ROBIN_SHY_M.
 */
export function robinHop(robin: { x: number; z: number }, spot: { x: number; z: number }, ranger: { x: number; z: number }): { x: number; z: number; flutter: boolean } | null {
  const dx = spot.x - robin.x, dz = spot.z - robin.z;
  const d = Math.hypot(dx, dz);
  if (d <= ROBIN_NEAR_M) return null;
  const flutter = d > ROBIN_HOP_M * 2;
  const step = Math.min(d, flutter ? ROBIN_FLUTTER_M : ROBIN_HOP_M);
  const to = { x: robin.x + (dx / d) * step, z: robin.z + (dz / d) * step, flutter };
  // round him: a hop that would land too near him goes along a circle round him instead
  const keep = ROBIN_SHY_M + 0.25;
  if (Math.hypot(to.x - ranger.x, to.z - ranger.z) < keep) {
    const r0 = Math.max(keep, Math.hypot(robin.x - ranger.x, robin.z - ranger.z));
    const a0 = Math.atan2(robin.x - ranger.x, robin.z - ranger.z);
    const as = Math.atan2(spot.x - ranger.x, spot.z - ranger.z);
    const da = Math.atan2(Math.sin(as - a0), Math.cos(as - a0));
    const turn = Math.sign(da || 1) * Math.min(Math.abs(da), step / r0);
    to.x = ranger.x + Math.sin(a0 + turn) * r0;
    to.z = ranger.z + Math.cos(a0 + turn) * r0;
  }
  return Math.hypot(to.x - robin.x, to.z - robin.z) > 0.05 ? to : null;
}

/** How big (px, its larger side) a thing `size` m long stands `d` m from a lens of vertical
 *  field `fovDeg` in a picture `h` px high. */
export function pxAt(size: number, d: number, fovDeg: number, h: number): number {
  return (size / (2 * d * Math.tan((fovDeg * Math.PI) / 360))) * h;
}
