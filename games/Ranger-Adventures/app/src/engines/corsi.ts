/**
 * corsi.ts — EF engine "corsi" (visuospatial sequence memory), the
 * render-agnostic task logic ported from prototype/step-route.jsx. A sequence
 * of footprint spots lights up; the child taps them back in order. Difficulty
 * (routeLengte) sets the sequence length. The render layer runs the
 * show→recall state machine and reports the BeatSummary.
 */

import type { Settings } from '../core/state';
import type { BeatSummary } from '../core/skill';

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

/**
 * CorsiRun — the pure recall + scoring core shared by BOTH the 2D
 * (`render2d/RouteView`) and the diegetic 3D (`render3d/engines/corsi3d`) views,
 * so the two emit an IDENTICAL `BeatSummary` for the same trial + the same tap
 * sequence (construct parity, BUILD-PLAN §1f). It models exactly the frozen
 * visuospatial task: after the route is shown, the child taps the spots back in
 * order. A tap on the expected spot advances; the last one completes the route. A
 * wrong tap is RECOVERABLE — it's counted once, the route is re-shown and recall
 * restarts from the beginning (never a game-over). The score is binary, exactly as
 * the 2D twin has always scored it: `correct` = 1 only when the route was recalled
 * with NO wrong tap; `trials` is always 1. No THREE, no DOM, no timing — pure, so
 * the seeded parity test runs under `node --test`.
 */
export class CorsiRun {
  private readonly sequence: number[];
  private idx = 0;
  private wrongs = 0;
  private done = false;

  constructor(sequence: number[]) { this.sequence = sequence.slice(); }

  /** how many spots have been recalled correctly in the current pass (0..length) */
  get recallIndex(): number { return this.idx; }

  /** the spot id the player must tap next */
  get expected(): number { return this.sequence[this.idx]; }

  /** the whole route has been recalled */
  get finished(): boolean { return this.done; }

  /** total wrong taps so far (drives the binary score) */
  get wrongCount(): number { return this.wrongs; }

  /**
   * Tap a spot id. The expected spot advances recall (`'advance'`), or finishes
   * the route when it was the last (`'complete'`). Any other spot is a wrong tap:
   * counted once, recall restarts from the start so the route is re-shown
   * (`'reshow'`) — recoverable, never game-over.
   */
  tap(id: number): 'advance' | 'complete' | 'reshow' {
    if (this.done) return 'complete';
    if (id === this.sequence[this.idx]) {
      this.idx += 1;
      if (this.idx >= this.sequence.length) { this.done = true; return 'complete'; }
      return 'advance';
    }
    this.wrongs += 1;
    this.idx = 0; // recall restarts after the route is re-shown
    return 'reshow';
  }

  /** the parity-frozen summary: trials = 1, correct = 1 iff recalled with no wrong tap. */
  summary(): BeatSummary {
    return { trials: 1, correct: this.wrongs === 0 ? 1 : 0 };
  }
}
