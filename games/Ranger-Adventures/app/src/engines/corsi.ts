/**
 * corsi.ts — EF engine "corsi" (visuospatial sequence memory), the
 * render-agnostic task logic ported from prototype/step-route.jsx. A sequence
 * of footprint spots lights up; the child taps them back in order. Difficulty
 * (routeLengte) sets the sequence length. The render layer runs the
 * show→recall state machine and reports the BeatSummary.
 */

import type { Settings } from '../core/state';

export interface CorsiSpot {
  id: number;
  x: number;
  y: number;
}

/** Fixed footprint layout (the "route" the herd walked). */
export const PRINT_SPOTS: readonly CorsiSpot[] = [
  { id: 0, x: 18, y: 72 }, { id: 1, x: 34, y: 46 }, { id: 2, x: 50, y: 66 },
  { id: 3, x: 60, y: 36 }, { id: 4, x: 74, y: 58 }, { id: 5, x: 86, y: 34 },
  { id: 6, x: 44, y: 24 },
];

export interface CorsiTrial {
  spots: readonly CorsiSpot[];
  sequence: number[]; // ordered spot ids to show then recall
}

/** Pick a shuffled sub-sequence; length grows with difficulty (3..6). */
export function buildCorsiTrial(diff: Settings, rng: () => number = Math.random): CorsiTrial {
  const n = Math.max(3, Math.min(diff.routeLengte ?? 4, 6));
  const ids = PRINT_SPOTS.map((s) => s.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return { spots: PRINT_SPOTS, sequence: ids.slice(0, n) };
}
