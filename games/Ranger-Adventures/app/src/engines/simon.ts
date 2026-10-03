/**
 * simon.ts — EF engine "simon" (Echokracht: audio-visual working memory), the
 * render-agnostic task logic. The animals call a sequence; the child calls them back by
 * tapping them in order. The light-up carries the sequence too, so it plays with sound
 * muted. The render layer runs the listen → echo loop and plays the calls.
 *
 * Run 7 (`adaptive`, design §5.2): the beat is a few ROUNDS on the shared span core
 * (engines/span.ts): it starts where he is (`knobs.start`: 2 the first time, 3 once 2 came
 * easily …), grows by one caller after every clean echo (the same calls plus one: classic
 * Simon), keeps the length after a rescued one, eases silently after two wrong taps, and
 * always ends on an echo he made. A first echo game plays 2 → 3 → 4: never "two calls and
 * done".
 */

import type { Skin } from '../content/types';
import type { SpanKnobs } from '../core/skill';
import { looseRng } from '../core/play.ts';
import { SpanRun, type SpanSupplier } from './span.ts';

export type { SpanResult } from './span.ts';

export interface SimonTrial {
  /** the animals on the row (the "buttons") */
  dieren: string[];
  /** run 7 (additive; a story's `roepAllen`): every animal of the row is heard once before
   *  any calls again (the squirrel's neighbours all chase the jay) — the length, and so the
   *  span, as without */
  spread?: boolean;
  /** the beat's span knobs, with the story's own cap on rounds (`skin.rondes`) */
  knobs: SpanKnobs;
}

/** The animals that call, and the knobs this beat plays (a skin's `rondes` caps the rounds
 *  for its story; the 2D floor reads the same skin, so parity holds). Run 7 (additive): with
 *  `rng` (the play's `simon-cast` fork) a skin with a `roepPool` draws its row from it
 *  (`simonCast`); without, the row is `dieren` as it stands. */
export function buildSimonTrial(skin: Skin, knobs: SpanKnobs, rng?: () => number): SimonTrial {
  const dieren = rng && skin.roepPool?.length ? simonCast(skin, rng) : skin.dieren?.length ? [...skin.dieren] : ['edelhert', 'ree', 'wildzwijn', 'raaf'];
  const rondes = typeof skin.rondes === 'number' && skin.rondes >= 1 ? Math.floor(skin.rondes) : Infinity;
  return { dieren, knobs: { ...knobs, rounds: Math.max(1, Math.min(knobs.rounds, rondes)) }, ...(skin.roepAllen ? { spread: true } : {}) };
}

/**
 * Run 7: the row of callers for this play (pure, seeded): as many animals as the skin's
 * `dieren` lists (the 2D floor's buttons: the same COUNT every play, so the echo is as hard
 * whoever calls), the skin's own `dier` always among them (the wildcamera's badger by its
 * sett), the others drawn from `roepPool`. Kept in the pool's order. No pool: `dieren`.
 */
export function simonCast(skin: Skin, rng: () => number): string[] {
  const base = skin.dieren?.length ? skin.dieren : ['edelhert', 'ree', 'wildzwijn', 'raaf'];
  const pool = skin.roepPool?.length ? skin.roepPool : null;
  if (!pool) return [...base];
  const vast = skin.dier && pool.includes(skin.dier) ? [skin.dier] : [];
  const rest = pool.filter((d) => !vast.includes(d));
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  const chosen = new Set([...vast, ...rest.slice(0, Math.max(0, Math.min(base.length, pool.length) - vast.length))]);
  return pool.filter((d) => chosen.has(d));
}

/** One caller of the row, drawn from `rng`. */
export function randomCaller(dieren: readonly string[], rng: () => number = looseRng('simon')): string {
  return dieren[Math.floor(rng() * dieren.length)];
}

/**
 * The callers' supplier (pure, seeded): a round that GREW appends one new caller to the
 * last sequence (the same calls plus one); any other round is a fresh sequence, never the
 * same as the last. A caller never calls twice in a row while the sequence is short (≤ 3:
 * "nachtzwaluw, nachtzwaluw" is no echo to a beginner), and never three times in a row.
 */
export function simonNext(dieren: readonly string[], rng: () => number, spread = false): SpanSupplier<string> {
  const add = (seq: string[]): void => {
    const n = seq.length;
    const avoid = n >= 1 && (n < 3 || seq[n - 1] === seq[n - 2]) ? seq[n - 1] : null;
    const pool = dieren.filter((d) => d !== avoid);
    // (run 7, `spread`: one not heard yet in this sequence, while there is one)
    const unheard = spread ? pool.filter((d) => !seq.includes(d)) : [];
    seq.push(randomCaller(unheard.length ? unheard : pool.length ? pool : dieren, rng));
  };
  return (len, prev) => {
    if (prev && len === prev.length + 1) {
      const seq = [...prev];
      add(seq);
      return seq;
    }
    let seq: string[] = [];
    for (let tries = 0; tries < 6; tries++) {
      seq = [];
      while (seq.length < len) add(seq);
      if (!prev || seq.join() !== prev.join()) break; // (a fresh round is a new sequence)
    }
    return seq;
  };
}

/**
 * SimonRun — the echo's core, shared by the 2D floor (`render2d/SimonView`), the classic 3D
 * stage (`render3d/engines/simon3d`) and the world's callers (`adventure/beats/callers`):
 * the span core over the trial's animals, fed by the play's fork. Same knobs + seed + taps
 * → the same summary everywhere (`{ trials: rounds, correct: clean rounds, span, start,
 * rounds, eased, firstClean }`).
 */
export class SimonRun extends SpanRun<string> {
  constructor(knobs: SpanKnobs, dieren: readonly string[], rng: () => number, spread = false) {
    super(knobs, simonNext(dieren, rng, spread));
  }
}
