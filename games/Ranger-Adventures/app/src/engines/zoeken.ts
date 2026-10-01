/**
 * zoeken.ts — EF engine "zoeken" (sustained attention + visual search),
 * the render-agnostic task logic ported from prototype/step-spot.jsx.
 * Given a research-true skin + resolved difficulty, it produces a trial
 * (target + trimmed decoys). The render layer handles interaction and
 * reports the BeatSummary back to the skill system. Distractors are real
 * Veluwe heath fauna; the target "drukt zich" — lies dead-still.
 */

import type { Skin, Distractor } from '../content/types';
import type { BeatSummary, ZoekKnobs } from '../core/skill';
import { hash32 } from '../core/play.ts';

export interface ZoekenTrial {
  target: { x: number; y: number };
  decoys: Distractor[];
  /** how much of the animal shows through its cover (0..1, the level's `glimpse`) */
  glimpse: number;
  /** the search haze over the animal = 1 − glimpse (the 2D field's grass over it, the
   *  classic lens edge); `lensSterkte` is the same number for an older reader */
  haze: number;
  lensSterkte: number;
  /** seconds before the first hint (or two misses) */
  hintAfterS: number;
}

/** The older difficulty fields an earlier reader passes instead of the knobs. */
type OldZoekDiff = { afleiders?: number; lensSterkte?: number };

/** The knobs from either form (run 7 readers pass `ZoekKnobs`; an older one its settings). */
function zoekKnobsOf(k: ZoekKnobs | OldZoekDiff): Pick<ZoekKnobs, 'lookAlikes' | 'glimpse' | 'hintAfterS'> {
  if ('lookAlikes' in k && typeof k.lookAlikes === 'number') return k as ZoekKnobs;
  const old = k as OldZoekDiff;
  return { lookAlikes: (old.afleiders ?? 4) + 2, glimpse: Math.max(0.1, Math.min(0.6, 1 - (old.lensSterkte ?? 0.6))), hintAfterS: 14 };
}

/**
 * Build one zoeken trial (run 7 `adaptive`, design §5.3): the level's knobs say HOW MANY
 * look-alikes come (`lookAlikes`, capped by the skin's list), how much of the animal shows
 * (`glimpse`) and when the first hint comes (`hintAfterS`). With the play's `rng` it also
 * draws WHICH look-alikes come (one of each kind first, so every play's set is as mixed) and,
 * for the 2D field, WHERE everything lies (`zoekLayout`: the animal never in the middle; with
 * `area` (`zoekArea(play.missionId, play.n)`) in another part of the field every play).
 * Without an `rng` (a seed-less caller) the skin's authored set and places, as before.
 * Variety never changes a knob: only the level does.
 */
export function buildZoekenTrial(skin: Skin, knobs: ZoekKnobs | OldZoekDiff, rng?: () => number, area?: number): ZoekenTrial {
  const k = zoekKnobsOf(knobs);
  const all: Distractor[] = skin.distractors ?? [{ id: 'd1', x: 24, y: 44, k: 'bush', animal: 'struik' }];
  const count = Math.max(Math.min(3, all.length), Math.min(Math.round(k.lookAlikes), all.length));
  const glimpse = Math.max(0.05, Math.min(0.95, k.glimpse));
  const haze = Math.round((1 - glimpse) * 100) / 100;
  if (!rng) {
    return { target: skin.doel ?? { x: 52, y: 58 }, decoys: all.slice(0, count), glimpse, haze, lensSterkte: haze, hintAfterS: k.hintAfterS };
  }
  const picked = pickDecoys(all, count, rng);
  const lay = zoekLayout(picked.length, rng, area);
  return {
    target: lay.target,
    decoys: picked.map((d, i) => ({ ...d, x: lay.spots[i].x, y: lay.spots[i].y })),
    glimpse, haze, lensSterkte: haze, hintAfterS: k.hintAfterS,
  };
}

/** `count` look-alikes from `all`, seeded: first one of each kind (a dead frond, a bird, a
 *  butterfly …: every play's set as mixed as the list allows), then the rest at random.
 *  Returned in the list's own order. */
export function pickDecoys(all: readonly Distractor[], count: number, rng: () => number): Distractor[] {
  const pick = <T>(xs: T[]): T => xs.splice(Math.floor(rng() * xs.length), 1)[0];
  const left = [...all];
  const kinds = [...new Set(all.map((d) => d.k))];
  const chosen = new Set<Distractor>();
  while (kinds.length && chosen.size < count) {
    const kind = pick(kinds);
    const of = left.filter((d) => d.k === kind);
    const d = of[Math.floor(rng() * of.length)];
    chosen.add(d);
    left.splice(left.indexOf(d), 1);
  }
  while (left.length && chosen.size < count) chosen.add(pick(left));
  return all.filter((d) => chosen.has(d));
}

/** The 2D field's room (% of the field): clear of its rounded edges. */
export const FIELD = { x0: 12, x1: 88, y0: 20, y1: 84 } as const;
/** The animal never lies within this distance of the field's middle (% units). */
export const OFF_CENTRE = 15;
/** No two things lie closer than this (% units). */
export const SPACING = 12;

/** The 2D field's six AREAS round its middle (60° each, clockwise from the right). */
export const AREAS = 6;
/** The order a mission's plays visit the areas: two plays in a row never lie in the same
 *  area or a neighbouring one (each step is at least two areas round). */
const AREA_ORDER = [0, 2, 4, 1, 5, 3] as const;
/** Degrees kept free at each side of an area, so two areas' spots never touch. */
const AREA_MARGIN = 8;

/** Where play `n` of `missionId` hides the animal on the 2D field (pure): its area. The
 *  plays of a mission walk `AREA_ORDER` from a start of their own, so the animal lies
 *  somewhere else every play — the spot inside the area is the play's seed. */
export function zoekArea(missionId: string, n: number): number {
  const i = (((Math.floor(n) - 1) % AREAS) + AREAS) % AREAS;
  return (AREA_ORDER[i] + hash32(0, `area:${missionId}`)) % AREAS;
}

/** A seeded spot in `area`: off the middle (≥ OFF_CENTRE + 2), inside `FIELD`. */
function spotIn(area: number, rng: () => number): { x: number; y: number } {
  const deg = area * 60 + AREA_MARGIN + rng() * (60 - 2 * AREA_MARGIN);
  const dx = Math.cos((deg * Math.PI) / 180), dy = Math.sin((deg * Math.PI) / 180);
  // as far as the field reaches that way (a ray from the middle to the FIELD box)
  const reach = (d: number, lo: number, hi: number): number => (d > 1e-6 ? (hi - 50) / d : d < -1e-6 ? (lo - 50) / d : Infinity);
  const far = Math.min(reach(dx, FIELD.x0, FIELD.x1), reach(dy, FIELD.y0, FIELD.y1)) - 1;
  const near = OFF_CENTRE + 2;
  const r = near + rng() * Math.max(0, far - near);
  return { x: Math.round(50 + dx * r), y: Math.round(50 + dy * r) };
}

/**
 * A seeded layout of the 2D field (pure): the animal's spot at least `OFF_CENTRE` from the
 * middle (in `area` when given: `zoekArea`), `n` look-alike spots, everything at least
 * `SPACING` apart, all inside `FIELD`.
 */
export function zoekLayout(n: number, rng: () => number, area?: number): { target: { x: number; y: number }; spots: { x: number; y: number }[] } {
  const at = (): { x: number; y: number } => ({
    x: Math.round(FIELD.x0 + rng() * (FIELD.x1 - FIELD.x0)),
    y: Math.round(FIELD.y0 + rng() * (FIELD.y1 - FIELD.y0)),
  });
  const placed: { x: number; y: number }[] = [];
  const free = (p: { x: number; y: number }, gap: number): boolean => placed.every((q) => Math.hypot(p.x - q.x, p.y - q.y) >= gap);
  let target = area != null ? spotIn(((Math.floor(area) % AREAS) + AREAS) % AREAS, rng) : at();
  for (let i = 0; i < 400 && Math.hypot(target.x - 50, target.y - 50) < OFF_CENTRE; i++) target = at();
  placed.push(target);
  const spots: { x: number; y: number }[] = [];
  for (let j = 0; j < n; j++) {
    let p = at();
    // (a crowded field relaxes the spacing a little rather than stacking two things)
    for (let i = 0, gap = SPACING; !free(p, gap); i++) {
      p = at();
      if (i % 200 === 199) gap -= 1;
    }
    placed.push(p);
    spots.push(p);
  }
  return { target, spots };
}

/** What a search was (design §5.3): one find; a miss is a wrong tap on a look-alike; the
 *  seconds to the find; whether a hint was needed. The same in 2D and in the world. */
export function zoekSummary(o: { misses: number; seconds: number; hinted: boolean }): BeatSummary {
  return { trials: 1, correct: scoreZoeken(o.misses), misses: o.misses, seconds: Math.round(o.seconds * 10) / 10, hinted: o.hinted };
}

/** The tracking leg (3D enrichment, §3d): a spoor of clue legs leading to the hide
 *  zone that holds the *unchanged* search trial. A SEPARATE difficulty axis from
 *  the search — it sets the region/approach only and NEVER touches the decoy set,
 *  so tuning the trail can't make the discrimination easier or harder. */
export interface Spoor {
  legs: number;        // how many clue markers along the trail (≥2; sustained-attention-over-distance)
  helderheid: number;  // 0..1 trail clarity (1 = crisp tracks, lower = fainter → harder to follow)
}

/** Build the tracking-leg spec from the SEPARATE spoor axes (the level's `trailLegs` and
 *  `trailClarity`; an older reader passes its spoorLengte / spoorHelderheid). Clamped to a
 *  calm, child-sized range (2..5 legs) so the trail reads as tracking, not tedium. */
export function buildSpoor(k: Pick<ZoekKnobs, 'trailLegs' | 'trailClarity'> | { spoorLengte?: number; spoorHelderheid?: number }): Spoor {
  const legs = 'trailLegs' in k ? k.trailLegs : k.spoorLengte;
  const helder = 'trailClarity' in k ? k.trailClarity : k.spoorHelderheid;
  return {
    legs: Math.max(2, Math.min(5, Math.round(legs ?? 3))),
    helderheid: Math.max(0.25, Math.min(1, helder ?? 0.7)),
  };
}

/** The frozen zoeken scoring rule, shared by BOTH the 2D `ZoekenView` and the 3D
 *  `zoeken3d` views so they can never silently diverge: a clean find (no wrong
 *  taps) scores 1, any miss scores 0. The search is **never game-over** — a miss
 *  only costs the perfect score; the child still finds the target and continues. */
export function scoreZoeken(misses: number): 0 | 1 {
  return misses === 0 ? 1 : 0;
}
