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
