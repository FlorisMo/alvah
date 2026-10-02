/**
 * span.ts — ONE pure core for the two span breinkrachten (run 7 `adaptive`, design
 * `state/foundation/design.md` §5.2): Geheugenkracht (corsi: a route over look-alike spots)
 * and Echokracht (simon: animals that call). The 2D floors, the classic 3D stages and the
 * world's beats all drive it, so the same knobs, seed and taps give the same summary
 * (construct parity). No THREE, no DOM, no timing.
 *
 * A beat is a few ROUNDS; a round is one sequence shown (or called), then echoed back.
 *  - the right item advances (`'advance'`); the last one ends the round.
 *  - a CLEAN round (no wrong tap in it): the next round is one longer (≤ max) and `grew`
 *    is set (`'next'`); a clean round at max ends the beat at once (`'complete'`).
 *  - a RESCUED round (a wrong tap happened): the next round keeps its length, a fresh
 *    sequence (`'next'`, `grew` false).
 *  - the first wrong tap in a round: the SAME sequence again (`'replay'`, as always).
 *  - a second wrong tap: the round goes on with a fresh sequence one shorter (≥ 2),
 *    silently (`'ease'`: the views say the same "nog een keer" line as a replay).
 *  - after `rounds` rounds the beat is `'complete'`. It always ends on an echo he made.
 *
 * New sequences come from an injected supplier `next(len, prev)` (the play's fork in play,
 * a fixed one in a test): simon appends one caller when the round grew (classic Simon),
 * corsi draws a fresh route.
 */

import type { BeatSummary, SpanKnobs } from '../core/skill';

export type SpanResult = 'advance' | 'next' | 'replay' | 'ease' | 'complete';

/** The shortest sequence a round may have. */
export const SPAN_MIN = 2;

/** Supplies a round's sequence: `len` long; `prev` is the last round's (null for the first). */
export type SpanSupplier<T> = (len: number, prev: readonly T[] | null) => T[];

export class SpanRun<T> {
  /** the first round's length, the longest a round may grow to, rounds a beat plays */
  readonly start: number;
  readonly max: number;
  readonly rounds: number;
  private readonly supply: SpanSupplier<T>;
  private seq: T[] = [];
  private pos = 0;
  private roundNo = 0;
  /** wrong taps in this round (0 = still clean) */
  private wrongsInRound = 0;
  /** wrong taps since the last fresh sequence of this round (1 → replay, 2 → ease) */
  private strikes = 0;
  private wrongs = 0;
  private played = 0;
  private cleanRounds = 0;
  private longest = 0;
  private easedN = 0;
  private firstWasClean: boolean | null = null;
  private grewLast = false;
  private done = false;

  constructor(k: SpanKnobs, next: SpanSupplier<T>) {
    this.max = Math.max(SPAN_MIN, Math.round(k.max));
    this.start = Math.max(SPAN_MIN, Math.min(this.max, Math.round(k.start)));
    this.rounds = Math.max(1, Math.round(k.rounds));
    this.supply = next;
  }

  /** the sequence of this round (to show / call, then to echo) */
  get sequence(): readonly T[] { return this.seq; }
  /** the item he must tap next */
  get expected(): T { return this.seq[this.pos]; }
  /** how many items of this round's sequence he echoed right in this pass */
  get echoIndex(): number { return this.pos; }
  /** this round (1-based once begun) */
  get round(): number { return this.roundNo; }
  /** the beat is over */
  get finished(): boolean { return this.done; }
  /** the last `'next'` made the sequence one longer (the views say the grow line) */
  get grew(): boolean { return this.grewLast; }
  /** wrong taps in the whole beat */
  get wrongCount(): number { return this.wrongs; }

  /** Round 1: a sequence of `start`. Returns it for the view to show. */
  begin(): readonly T[] {
    this.roundNo = 1;
    this.pos = 0;
    this.wrongsInRound = 0;
    this.strikes = 0;
    this.wrongs = 0;
    this.played = 0;
    this.cleanRounds = 0;
    this.longest = 0;
    this.easedN = 0;
    this.firstWasClean = null;
    this.grewLast = false;
    this.done = false;
    this.seq = this.draw(this.start, null);
    return this.seq;
  }

  /** He tapped `id` while echoing. */
  tap(id: T): SpanResult {
    if (this.done) return 'complete';
    if (id === this.seq[this.pos]) {
      this.pos += 1;
      if (this.pos < this.seq.length) return 'advance';
      return this.endRound();
    }
    // a wrong tap: recoverable, never a game-over
    this.wrongs += 1;
    this.wrongsInRound += 1;
    this.strikes += 1;
    this.pos = 0;
    if (this.strikes < 2) return 'replay';
    // the second in a row of this sequence: a fresh one, one shorter (silently)
    this.strikes = 0;
    this.easedN += 1;
    this.seq = this.draw(Math.max(SPAN_MIN, this.seq.length - 1), this.seq);
    return 'ease';
  }

  /** What was played (design §4.3): rounds, clean rounds, the longest clean echo, … */
  summary(): BeatSummary {
    return {
      trials: this.played,
      correct: this.cleanRounds,
      span: this.longest,
      start: this.start,
      rounds: this.played,
      eased: this.easedN,
      firstClean: this.firstWasClean ?? false,
    };
  }

  private endRound(): SpanResult {
    const len = this.seq.length;
    const clean = this.wrongsInRound === 0;
    this.played += 1;
    if (this.firstWasClean === null) this.firstWasClean = clean;
    if (clean) {
      this.cleanRounds += 1;
      this.longest = Math.max(this.longest, len);
    }
    if (this.roundNo >= this.rounds || (clean && len >= this.max)) {
      this.done = true;
      this.grewLast = false;
      return 'complete';
    }
    const nextLen = clean ? Math.min(this.max, len + 1) : len;
    this.grewLast = nextLen > len;
    this.seq = this.draw(nextLen, this.seq);
    this.roundNo += 1;
    this.pos = 0;
    this.wrongsInRound = 0;
    this.strikes = 0;
    return 'next';
  }

  private draw(len: number, prev: readonly T[] | null): T[] {
    const s = this.supply(len, prev);
    if (s.length !== len) throw new Error(`[span] the supplier gave ${s.length} items for a round of ${len}`);
    return s.slice();
  }
}
