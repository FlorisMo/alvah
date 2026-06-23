/**
 * wisselen.ts — EF engine "wisselen" (cognitive flexibility / set-shifting),
 * the render-agnostic task logic ported from prototype/step-wissel.jsx. Day
 * animals go to the open clearing, night animals to the den — but the signpost
 * flips now and then ("Nu andersom!") and the child must switch the rule.
 * Difficulty knob (wisselFreq) drives how often the rule flips; skin.trials sets
 * the length. The render layer runs the sort loop and reports a beat.
 */

import type { Skin } from '../content/types';
import type { Settings } from '../core/state';
import type { BeatSummary } from '../core/skill';

export interface WisselItem {
  id: string;     // animal id
  dag: boolean;   // true = day animal (natural bin = open clearing)
}

export interface WisselTrial {
  queue: WisselItem[];
  flipEvery: number;   // flip the rule every N correct sorts
}

/** Build a shuffled day/night queue + resolve the flip cadence. */
export function buildWisselTrial(skin: Skin, diff: Settings, rng: () => number = Math.random): WisselTrial {
  const dag = skin.dagDieren?.length ? skin.dagDieren : ['edelhert', 'ree'];
  const nacht = skin.nachtDieren?.length ? skin.nachtDieren : ['das', 'nachtzwaluw', 'wildzwijn'];
  const totaal = Math.max(4, skin.trials ?? 8);

  const pool: WisselItem[] = [];
  for (let i = 0; i < totaal; i++) {
    const fromDag = i % 2 === 0;
    const arr = fromDag ? dag : nacht;
    pool.push({ id: arr[Math.floor(rng() * arr.length)], dag: fromDag });
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // higher wisselFreq → flips more often (every 2); lower → calmer (every 6)
  const freq = diff.wisselFreq ?? 0.4;
  const flipEvery = Math.max(2, Math.round(2 + (1 - freq) * 4));

  return { queue: pool, flipEvery };
}

/** One of the two destinations a sorted animal goes to. */
export type WisselBin = 'open' | 'hol';

/** A choice outcome the render layer reacts to (advance / advance-with-flip /
 *  complete / recoverable retry). `'flip'` means the rule just turned for the
 *  NEXT animal (the view shows the signpost turning) — dual-channel cue. */
export type WisselResult = 'advance' | 'flip' | 'complete' | 'retry';

/**
 * WisselRun — the pure set-shift sequencing + flip cadence + scoring core shared
 * by BOTH the 2D (`render2d/WisselView`) and the diegetic 3D
 * (`render3d/engines/wisselen3d`) views, so the two emit an IDENTICAL
 * `BeatSummary` for the same queue + the same sort taps (construct parity,
 * BUILD-PLAN §1f). It models exactly the frozen cognitive-flexibility task: walk
 * the queue in order; each animal's NATURAL bin is open (day) / hol (night), but
 * the signpost flips the rule every `flipEvery` correct sorts, so the child must
 * switch. A correct sort advances (and may flip the rule for the next animal); a
 * wrong sort is RECOVERABLE — counted once, the same animal stays up for another
 * try (never a game-over). The score is binary, exactly as the 2D twin has always
 * scored it: `correct` = 1 only when the whole queue was sorted with NO wrong tap;
 * `trials` is always 1. No THREE, no DOM, no timing — pure, so the seeded parity
 * test runs under `node --test`.
 */
export class WisselRun {
  private readonly queue: readonly WisselItem[];
  private readonly flipEvery: number;
  private idx = 0;
  private sinceFlip = 0;
  private invert = false;
  private wrongs = 0;
  private done = false;

  constructor(trial: WisselTrial) {
    this.queue = trial.queue;
    this.flipEvery = Math.max(2, trial.flipEvery);
  }

  /** the animal currently waiting to be sorted (undefined once finished) */
  get current(): WisselItem | undefined { return this.queue[this.idx]; }

  /** position in the queue (0..length) */
  get index(): number { return this.idx; }

  /** total animals to sort */
  get total(): number { return this.queue.length; }

  /** the rule is currently inverted ("Nu andersom!") */
  get inverted(): boolean { return this.invert; }

  /** the whole queue has been sorted */
  get finished(): boolean { return this.done; }

  /** wrong sorts so far (drives the binary score) */
  get wrongCount(): number { return this.wrongs; }

  /** the bin the current animal belongs in, honouring the live (maybe flipped) rule */
  correctBin(): WisselBin {
    const cur = this.queue[this.idx];
    const natural: WisselBin = cur?.dag ? 'open' : 'hol';
    return this.invert ? (natural === 'open' ? 'hol' : 'open') : natural;
  }

  /**
   * Sort the current animal into `bin`. The right bin advances to the next animal
   * (`'advance'`), and if that crosses the `flipEvery` cadence it flips the rule
   * for the next animal (`'flip'`) or, on the last animal, COMPLETES the task
   * (`'complete'`). The wrong bin is a recoverable miss: counted once, the SAME
   * animal stays up (`'retry'`) — never a game-over.
   */
  choose(bin: WisselBin): WisselResult {
    if (this.done) return 'complete';
    if (bin !== this.correctBin()) { this.wrongs += 1; return 'retry'; }
    this.idx += 1;
    if (this.idx >= this.queue.length) { this.done = true; return 'complete'; }
    this.sinceFlip += 1;
    if (this.sinceFlip >= this.flipEvery) {
      this.invert = !this.invert;
      this.sinceFlip = 0;
      return 'flip';
    }
    return 'advance';
  }

  /** the parity-frozen summary: trials = 1, correct = 1 iff sorted with no wrong tap. */
  summary(): BeatSummary {
    return { trials: 1, correct: this.wrongs === 0 ? 1 : 0 };
  }
}
