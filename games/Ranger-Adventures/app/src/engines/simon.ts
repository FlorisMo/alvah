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
import type { BeatSummary } from '../core/skill';

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

/**
 * SimonRun — the pure sequencing + scoring core shared by BOTH the 2D
 * (`render2d/SimonView`) and the diegetic 3D (`render3d/engines/simon3d`) views,
 * so the two emit an IDENTICAL `BeatSummary` for the same growing sequence + the
 * same echo taps (construct parity, BUILD-PLAN §1f). It models exactly the frozen
 * audio-visual working-memory task: the sequence starts at length 2 and grows by
 * one caller each time the child echoes it back in full, until it reaches
 * `target`. A tap on the expected caller advances the echo; the last one either
 * GROWS the sequence (and the views re-listen) or COMPLETES it (target reached). A
 * wrong tap is RECOVERABLE — it's counted once and the echo restarts so the SAME
 * sequence is replayed (never a game-over). The score is binary, exactly as the 2D
 * twin has always scored it: `correct` = 1 only when the whole task was echoed with
 * NO wrong tap; `trials` is always 1. New callers come from an injected supplier
 * (`randomCaller` in play, a seeded one in the test) so the core is deterministic
 * and carries no THREE/DOM/timing — the seeded parity test runs under `node --test`.
 */
export class SimonRun {
  private readonly target: number;
  private readonly nextCaller: () => string;
  private seq: string[] = [];
  private pos = 0;
  private wrongs = 0;
  private done = false;

  constructor(target: number, nextCaller: () => string) {
    this.target = Math.max(2, target);
    this.nextCaller = nextCaller;
  }

  /** the current sequence to listen to / echo (length 2..target) */
  get sequence(): readonly string[] { return this.seq; }

  /** how many callers have been echoed correctly in the current pass (0..length) */
  get echoIndex(): number { return this.pos; }

  /** the caller id the player must tap next */
  get expected(): string { return this.seq[this.pos]; }

  /** the whole task has been echoed to the target length */
  get finished(): boolean { return this.done; }

  /** total wrong taps so far (drives the binary score) */
  get wrongCount(): number { return this.wrongs; }

  /** Seed the opening length-2 sequence; resets the echo. Returns it for the view to play. */
  begin(): readonly string[] {
    this.seq = [this.nextCaller(), this.nextCaller()];
    this.pos = 0;
    this.wrongs = 0;
    this.done = false;
    return this.seq;
  }

  /**
   * Tap a caller id during the echo. The expected caller advances the echo
   * (`'advance'`); the last one either GROWS the sequence by one caller and
   * resets the echo (`'grow'` — the views re-listen) or COMPLETES the task when
   * the target length was reached (`'complete'`). Any other caller is a wrong tap:
   * counted once, the echo restarts so the SAME sequence is replayed (`'replay'`)
   * — recoverable, never game-over.
   */
  tap(id: string): 'advance' | 'grow' | 'complete' | 'replay' {
    if (this.done) return 'complete';
    if (id === this.seq[this.pos]) {
      this.pos += 1;
      if (this.pos < this.seq.length) return 'advance';
      // whole sequence echoed
      if (this.seq.length >= this.target) { this.done = true; return 'complete'; }
      this.seq = [...this.seq, this.nextCaller()]; // grow, then re-listen
      this.pos = 0;
      return 'grow';
    }
    this.wrongs += 1;
    this.pos = 0; // echo restarts after the sequence is replayed
    return 'replay';
  }

  /** the parity-frozen summary: trials = 1, correct = 1 iff echoed with no wrong tap. */
  summary(): BeatSummary {
    return { trials: 1, correct: this.wrongs === 0 ? 1 : 0 };
  }
}
