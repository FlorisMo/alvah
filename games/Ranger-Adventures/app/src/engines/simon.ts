/**
 * simon.ts — EF engine "simon" (audio-visual working memory), the
 * render-agnostic task logic ported from prototype/step-simon.jsx. The animals
 * call a growing sequence in the dusk; the child answers by tapping them back in
 * order. The light-up carries the sequence too, so it plays with sound muted.
 * Difficulty (simonLengte) sets the target length. The render layer runs the
 * listen→echo loop, plays per-animal calls (core/sound.ts), and reports a beat.
 */

import type { Skin } from '../content/types';
import type { Settings } from '../core/state';

export interface SimonTrial {
  dieren: string[];   // the animals on the row (the "buttons")
  target: number;     // sequence length to reach
}

/** Resolve which animals call and how long the target sequence is. */
export function buildSimonTrial(skin: Skin, diff: Settings): SimonTrial {
  const dieren = skin.dieren?.length ? skin.dieren : ['edelhert', 'ree', 'wildzwijn', 'raaf'];
  const target = Math.max(2, Math.min(diff.simonLengte ?? 3, 6));
  return { dieren, target };
}

/** Pick a random animal id from the row (for growing the sequence). */
export function randomCaller(dieren: string[], rng: () => number = Math.random): string {
  return dieren[Math.floor(rng() * dieren.length)];
}
