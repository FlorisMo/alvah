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
 * It stands 12-30 m off inside his picture, never on the line he walks along, never in a
 * mission's home, and it never comes toward the lens. He meets it when he SEES it (on
 * screen, ≥ SEEN_PX, within SEEN_M, for SEEN_S on end) or HEARS its call (within 25 m:
 * Sound.callAt's reach). Pure: no THREE, no DOM; the seed and the world come in.
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
  /** its moods: its row's in content/ontdekkingen.ts (the one table says it) */
  stemming?: readonly MoodId[];
}

type Base = Omit<SurpriseSpec, 'rare' | 'stemming'>;
const BASE: readonly Base[] = [
  { id: 'buizerd', plek: 'lucht', dist: [17, 21], call: { id: 'buizerd', every: [6, 9] }, stayS: 34, moves: true, model: null },
  { id: 'specht', plek: 'stam', dist: [11, 22], call: { id: 'specht', every: [4.5, 7] }, stayS: 40, model: 'bird-grote-bonte-specht' },
  { id: 'koekoek', plek: 'kroon', dist: [12, 22], call: { id: 'koekoek', every: [5, 8] }, stayS: 40, model: 'bird-koekoek' },
  { id: 'winterkoning', plek: 'voet', dist: [9, 17], call: { id: 'winterkoning', every: [6, 9] }, stayS: 36, model: 'bird-winterkoning' },
  { id: 'roodborst', plek: 'mee', dist: [5, 7], call: { id: 'roodborst', every: [6, 10] }, stayS: 30, onFoot: true, moves: true, model: 'bird-roodborst' },
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

/** A visit tries this many times (RETRY_S apart) for one it has not shown yet before it
 *  shows one again. */
export const FRESH_TRIES = 3;

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
  return d * Math.sin(b) >= OFF_PATH_M; // (beside the line he walks along, never on it)
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

/** The trees (or other perches) a surprise may use: inside the cone, `dist` m off, those
 *  in the picture first, each group in a seeded order. */
export function treeChoices<T extends { x: number; z: number }>(v: Viewer, trees: readonly T[], dist: readonly [number, number], fork: Play, cone = CONE): T[] {
  const ok = trees.filter((t) => {
    const d = Math.hypot(t.x - v.x, t.z - v.z);
    return d >= dist[0] && d <= dist[1] && inCone(v, t.x, t.z, cone);
  });
  const inPicture = ok.filter((t) => inCone(v, t.x, t.z));
  return [...fork.shuffle(inPicture), ...fork.shuffle(ok.filter((t) => !inPicture.includes(t)))];
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
  buizerd: 0, specht: 6, koekoek: 6, winterkoning: 4, roodborst: 2.6, edelhert: 14, das: 4,
};

/** Should it go now? (up too long, he is far off, or he came too near) */
export function shouldGo(s: SurpriseSpec, age: number, dist: number): boolean {
  if (age >= Math.min(s.stayS, MAX_STAY_S)) return true;
  if (dist > LEAVE_FAR_M) return true;
  return SHY_M[s.id] > 0 && dist < SHY_M[s.id];
}

/** The robin's next hop target: toward him while he is more than `far` away, stopping
 *  `keep` m short of him; never nearer than `keep` (null: it stays where it is). */
export function robinHop(robin: { x: number; z: number }, ranger: { x: number; z: number }, keep = 3.4, far = 5.5, hop = 0.7): { x: number; z: number } | null {
  const dx = ranger.x - robin.x, dz = ranger.z - robin.z;
  const d = Math.hypot(dx, dz);
  if (d <= far) return null;
  const step = Math.min(hop, d - keep);
  if (step <= 0.05) return null;
  return { x: robin.x + (dx / d) * step, z: robin.z + (dz / d) * step };
}
