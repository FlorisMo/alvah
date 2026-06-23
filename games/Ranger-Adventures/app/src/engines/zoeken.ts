/**
 * zoeken.ts — EF engine "zoeken" (sustained attention + visual search),
 * the render-agnostic task logic ported from prototype/step-spot.jsx.
 * Given a research-true skin + resolved difficulty, it produces a trial
 * (target + trimmed decoys). The render layer handles interaction and
 * reports the BeatSummary back to the skill system. Distractors are real
 * Veluwe heath fauna; the target "drukt zich" — lies dead-still.
 */

import type { Skin, Distractor } from '../content/types';
import type { Settings } from '../core/state';

export interface ZoekenTrial {
  target: { x: number; y: number };
  decoys: Distractor[];
  lensSterkte: number;   // 0..1 search-haze strength (higher = harder to see)
}

/** Build one zoeken trial: difficulty trims how many of the skin's decoys appear. */
export function buildZoekenTrial(skin: Skin, diff: Settings): ZoekenTrial {
  const all: Distractor[] = skin.distractors ?? [{ id: 'd1', x: 24, y: 44, k: 'bush', animal: 'struik' }];
  const want = (diff.afleiders ?? 4) + 2;
  const count = Math.max(3, Math.min(want, all.length));
  return {
    target: skin.doel ?? { x: 52, y: 58 },
    decoys: all.slice(0, count),
    lensSterkte: diff.lensSterkte ?? 0.6,
  };
}

/** The tracking leg (3D enrichment, §3d): a spoor of clue legs leading to the hide
 *  zone that holds the *unchanged* search trial. A SEPARATE difficulty axis from
 *  the search — it sets the region/approach only and NEVER touches the decoy set,
 *  so tuning the trail can't make the discrimination easier or harder. */
export interface Spoor {
  legs: number;        // how many clue markers along the trail (≥2; sustained-attention-over-distance)
  helderheid: number;  // 0..1 trail clarity (1 = crisp tracks, lower = fainter → harder to follow)
}

/** Build the tracking-leg spec from the SEPARATE spoor axes. Clamped to a calm,
 *  child-sized range (2..5 legs) so the trail reads as tracking, not tedium. */
export function buildSpoor(diff: Settings): Spoor {
  return {
    legs: Math.max(2, Math.min(5, Math.round(diff.spoorLengte ?? 3))),
    helderheid: Math.max(0.25, Math.min(1, diff.spoorHelderheid ?? 0.7)),
  };
}

/** The frozen zoeken scoring rule, shared by BOTH the 2D `ZoekenView` and the 3D
 *  `zoeken3d` views so they can never silently diverge: a clean find (no wrong
 *  taps) scores 1, any miss scores 0. The search is **never game-over** — a miss
 *  only costs the perfect score; the child still finds the target and continues. */
export function scoreZoeken(misses: number): 0 | 1 {
  return misses === 0 ? 1 : 0;
}
