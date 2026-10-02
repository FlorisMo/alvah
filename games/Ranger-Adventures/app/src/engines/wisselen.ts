/**
 * wisselen.ts — EF engine "wisselen" (cognitive flexibility / set-shifting),
 * the render-agnostic task logic ported from prototype/step-wissel.jsx. Day
 * animals go to the open clearing, night animals to the den — but the signpost
 * flips now and then ("Nu andersom!") and the child must switch the rule.
 * The render layer runs the sort loop and reports a beat.
 *
 * Run 7 (`adaptive`, design §5.5): the level's knobs say how many animals come (`sorts`, a
 * skin's `trials` caps them for its story), after how many right sorts the rule turns
 * (`flipEvery`) and how often (`flips`: a second turn, back again, from band 4). The gap
 * before a second turn adapts: one longer after a switch error (≤ 5). Never two turns in a
 * row; the last turn leaves at least two animals. The summary says what was played: sorts,
 * right first time, turns, switch errors.
 */

import type { Skin } from '../content/types';
import type { BeatSummary, WisselKnobs } from '../core/skill';
import { looseRng } from '../core/play.ts';

export interface WisselItem {
  id: string;     // animal id
  dag: boolean;   // true = day animal (natural bin = open clearing)
}

export interface WisselTrial {
  queue: WisselItem[];
  flipEvery: number;   // the rule turns after this many right sorts
  /** how many turns the round may have (default 1) */
  flips?: number;
}

/** The older difficulty field an earlier reader passes instead of the knobs. */
type OldWisselDiff = { wisselFreq?: number };

function wisselKnobsOf(k: WisselKnobs | OldWisselDiff): WisselKnobs {
  if ('sorts' in k && typeof k.sorts === 'number') return k as WisselKnobs;
  const freq = (k as OldWisselDiff).wisselFreq ?? 0.4;
  return { sorts: 8, flipEvery: Math.max(2, Math.round(2 + (1 - freq) * 4)), flips: 1 };
}

/** Build a shuffled day/night queue + resolve the turns. Half day, half night animals; of
 *  each kind every animal comes once before any comes again (a set of six shows every night
 *  animal), and never the same animal twice in a row (a queue that repeats itself is a flat
 *  round). `knobs` (run 7: the level's): how many animals (a skin's `trials` caps them),
 *  when the rule turns and how often. */
export function buildWisselTrial(skin: Skin, knobs: WisselKnobs | OldWisselDiff, rng: () => number = looseRng('wisselen')): WisselTrial {
  const k = wisselKnobsOf(knobs);
  const dag = skin.dagDieren?.length ? skin.dagDieren : ['edelhert', 'ree'];
  const nacht = skin.nachtDieren?.length ? skin.nachtDieren : ['das', 'nachtzwaluw', 'wildzwijn'];
  const totaal = Math.max(4, Math.min(Math.round(k.sorts), skin.trials ?? Infinity));

  const nextDag = deck(dag, rng);
  const nextNacht = deck(nacht, rng);
  const pool: WisselItem[] = [];
  for (let i = 0; i < totaal; i++) {
    const fromDag = i % 2 === 0;
    pool.push({ id: fromDag ? nextDag() : nextNacht(), dag: fromDag });
  }

  // at least a third of the round comes after the first turn (a short round of six turns
  // after the fourth at the latest: the switch is a real part of it, never its last animal)
  const flipEvery = Math.min(Math.max(2, Math.round(k.flipEvery)), Math.max(2, totaal - Math.ceil(totaal / 3)));

  return { queue: spread(pool, rng), flipEvery, flips: Math.max(1, Math.round(k.flips)) };
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
 * WisselRun — the pure set-shift sequencing + turns + scoring core shared by the 2D floor
 * (`render2d/WisselView`), the classic 3D stage (`render3d/engines/wisselen3d`) and the
 * world's aim (`adventure/beats/aim`, through `AimRun`), so all emit an IDENTICAL
 * `BeatSummary` for the same queue + the same sort taps (construct parity). It walks the
 * queue in order; each animal's NATURAL bin is open (day) / hol (night), but the rule turns
 * after `flipEvery` right sorts, so the child must switch. A correct sort advances (and may
 * turn the rule for the next animal); a wrong sort is RECOVERABLE — the same animal stays up
 * for another try (never a game-over).
 *
 * Run 7: up to `flips` turns. A second turn comes `gap` right sorts after the first; the gap
 * starts at `flipEvery` and grows by one (≤ 5) when the first sort after a turn was wrong (a
 * switch error). Never two turns in a row; no turn that would leave fewer than two animals.
 * The summary: `trials` = sorts, `correct` = sorted right first time, `switches` = turns
 * played, `switchErrors` = turns whose first sort was wrong. No THREE, no DOM, no timing.
 */
export class WisselRun {
  private readonly queue: readonly WisselItem[];
  private readonly flipEvery: number;
  private readonly flips: number;
  private gap: number;
  private idx = 0;
  private sinceFlip = 0;
  private turns = 0;
  private invert = false;
  private wrongs = 0;
  private readonly missed = new Set<number>();
  private switchErrs = 0;
  /** the queue index of the first animal after the last turn (-1: none yet) */
  private afterTurn = -1;
  private done = false;

  constructor(trial: WisselTrial) {
    this.queue = trial.queue;
    this.flipEvery = Math.max(2, trial.flipEvery);
    this.flips = Math.max(1, trial.flips ?? 1);
    this.gap = this.flipEvery;
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

  /** wrong sorts so far */
  get wrongCount(): number { return this.wrongs; }

  /** turns played so far */
  get switches(): number { return this.turns; }

  /** the bin the current animal belongs in, honouring the live (maybe flipped) rule */
  correctBin(): WisselBin {
    const cur = this.queue[this.idx];
    const natural: WisselBin = cur?.dag ? 'open' : 'hol';
    return this.invert ? (natural === 'open' ? 'hol' : 'open') : natural;
  }

  /**
   * Sort the current animal into `bin`. The right bin advances to the next animal
   * (`'advance'`), and if the turn is due it turns the rule for the next animal (`'flip'`)
   * or, on the last animal, COMPLETES the task (`'complete'`). The wrong bin is a
   * recoverable miss: counted, the SAME animal stays up (`'retry'`) — never a game-over.
   */
  choose(bin: WisselBin): WisselResult {
    if (this.done) return 'complete';
    if (bin !== this.correctBin()) {
      this.wrongs += 1;
      if (!this.missed.has(this.idx)) {
        this.missed.add(this.idx);
        if (this.idx === this.afterTurn) {
          // the first sort after a turn was wrong: a switch error, and the next turn waits longer
          this.switchErrs += 1;
          this.gap = Math.min(5, this.gap + 1);
        }
      }
      return 'retry';
    }
    this.idx += 1;
    if (this.idx >= this.queue.length) { this.done = true; return 'complete'; }
    this.sinceFlip += 1;
    const left = this.queue.length - this.idx;
    if (this.turns < this.flips && this.sinceFlip >= (this.turns === 0 ? this.flipEvery : this.gap) && left >= 2) {
      this.invert = !this.invert;
      this.sinceFlip = 0;
      this.turns += 1;
      this.afterTurn = this.idx;
      return 'flip';
    }
    return 'advance';
  }

  /** sorts, right first time, turns played, switch errors. */
  summary(): BeatSummary {
    return {
      trials: this.queue.length,
      correct: this.queue.length - this.missed.size,
      switches: this.turns,
      switchErrors: this.switchErrs,
    };
  }
}
