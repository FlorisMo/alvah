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

/** Build a shuffled day/night queue + resolve the flip cadence. Half day, half night
 *  animals; of each kind every animal comes once before any comes again (a set of six
 *  shows every night animal), and never the same animal twice in a row (a queue that
 *  repeats itself is a flat round). */
export function buildWisselTrial(skin: Skin, diff: Settings, rng: () => number = Math.random): WisselTrial {
  const dag = skin.dagDieren?.length ? skin.dagDieren : ['edelhert', 'ree'];
  const nacht = skin.nachtDieren?.length ? skin.nachtDieren : ['das', 'nachtzwaluw', 'wildzwijn'];
  const totaal = Math.max(4, skin.trials ?? 8);

  const nextDag = deck(dag, rng);
  const nextNacht = deck(nacht, rng);
  const pool: WisselItem[] = [];
  for (let i = 0; i < totaal; i++) {
    const fromDag = i % 2 === 0;
    pool.push({ id: fromDag ? nextDag() : nextNacht(), dag: fromDag });
  }

  // higher wisselFreq → flips more often (every 2); lower → calmer (every 6)
  const freq = diff.wisselFreq ?? 0.4;
  const flipEvery = Math.max(2, Math.round(2 + (1 - freq) * 4));

  return { queue: spread(pool, rng), flipEvery };
}

/** Draw animals from `ids` like cards from a shuffled deck: each once before any comes
 *  again (the deck is shuffled anew when it runs out). */
function deck(ids: readonly string[], rng: () => number): () => string {
  let bag: string[] = [];
  return () => {
    if (!bag.length) {
      bag = [...ids];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag.pop()!;
  };
}

/** The items in a random order with never the same animal twice in a row (whenever the
 *  mix allows it: no animal fills more than half the queue). Each next item is drawn at
 *  random from the ones that keep the rest placeable. */
function spread(items: readonly WisselItem[], rng: () => number): WisselItem[] {
  const left = [...items];
  const out: WisselItem[] = [];
  /** can `rest` still be laid out with no two alike in a row, after one `last`? */
  const placeable = (rest: readonly WisselItem[], last: string | undefined): boolean => {
    const n = rest.length;
    const count = new Map<string, number>();
    for (const it of rest) count.set(it.id, (count.get(it.id) ?? 0) + 1);
    for (const [id, c] of count) if (c > (id === last ? Math.floor(n / 2) : Math.ceil(n / 2))) return false;
    return true;
  };
  while (left.length) {
    const last = out[out.length - 1]?.id;
    const ok = left.map((_, i) => i).filter((i) => left[i].id !== last && placeable(left.filter((_, j) => j !== i), left[i].id));
    const from = ok.length ? ok : left.map((_, i) => i); // (a mix that cannot be spread: as it comes)
    const i = from[Math.floor(rng() * from.length)];
    out.push(left.splice(i, 1)[0]);
  }
  return out;
}

/** The two place names in a rule line "Dag-dier → X. Nacht-dier → Y." */
export function placeNames(regel: string): { open: string; hol: string } {
  const m = /→\s*([^.]+)\.\s*[^→]*→\s*([^.]+)/.exec(regel);
  return m ? { open: m[1].trim(), hol: m[2].trim() } : { open: 'open plek', hol: 'het hol' };
}

/** The rule after a flip, said outright (not only "andersom"): the places swap. */
export function regelAndersom(regel: string): string {
  const naam = placeNames(regel);
  return `Dag-dier → ${naam.hol}. Nacht-dier → ${naam.open}.`;
}

/** The cue every animal carries while it waits to be sorted: an icon + a word, the
 *  same in 2D and 3D (child:B3 — a child should never have to guess). */
export function dagOfNacht(dag: boolean): { icoon: string; woord: string } {
  return dag ? { icoon: '☀️', woord: 'Dag-dier' } : { icoon: '🌙', woord: 'Nacht-dier' };
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
