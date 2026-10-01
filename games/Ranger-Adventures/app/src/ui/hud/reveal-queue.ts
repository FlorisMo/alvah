/**
 * reveal-queue.ts — when a new discovery's reveal may show (run 7, design §4.4 and §7.3).
 * Pure: the clock and the "is this a quiet moment?" gate are injected, so the rules are
 * unit-tested without a DOM (ui/hud/Reveal.ts draws the card).
 *
 * The rules: one at a time, in the order they were found; a reveal waits for a QUIET
 * moment (the gate: no card or menu, nobody speaking, no held beat) that has lasted
 * `settleMs` (a breath between two lines is not a moment); it stays `showMs`; a short gap
 * before the next; and when the moment stops being quiet while one shows (a held beat
 * begins, a card comes up) it goes at once. A discovery is recorded at once elsewhere:
 * only its reveal waits here.
 */

export interface RevealQueueOptions {
  /** ms (performance.now in the game) */
  now(): number;
  /** may a reveal show now? */
  quiet(): boolean;
  /** how long one stays up (ms) */
  showMs?: number;
  /** how long the moment must have been quiet before one shows (ms) */
  settleMs?: number;
  /** the rest between two reveals (ms) */
  gapMs?: number;
}

export type RevealStep<T> = { kind: 'show'; item: T } | { kind: 'hide'; item: T } | null;

export const REVEAL_SHOW_MS = 4200;
export const REVEAL_SETTLE_MS = 700;
export const REVEAL_GAP_MS = 1400;

export class RevealQueue<T extends { id: string }> {
  private readonly q: T[] = [];
  private cur: T | null = null;
  private shownAt = 0;
  private quietSince: number | null = null;
  private hiddenAt = -Infinity;
  private readonly o: Required<RevealQueueOptions>;

  constructor(o: RevealQueueOptions) {
    this.o = { showMs: REVEAL_SHOW_MS, settleMs: REVEAL_SETTLE_MS, gapMs: REVEAL_GAP_MS, ...o };
  }

  /** A new discovery to reveal (one already waiting or showing is not queued twice). */
  push(item: T): void {
    if (this.cur?.id === item.id || this.q.some((x) => x.id === item.id)) return;
    this.q.push(item);
  }

  /** Call often (every frame or so): what to show or take away now, if anything. */
  tick(): RevealStep<T> {
    const t = this.o.now();
    const calm = this.o.quiet();
    if (this.cur) {
      if (calm && t - this.shownAt < this.o.showMs) return null;
      const item = this.cur;
      this.cur = null;
      this.hiddenAt = t;
      this.quietSince = calm ? t : null;
      return { kind: 'hide', item };
    }
    if (!calm) { this.quietSince = null; return null; }
    this.quietSince ??= t;
    if (!this.q.length || t - this.quietSince < this.o.settleMs || t - this.hiddenAt < this.o.gapMs) return null;
    this.cur = this.q.shift()!;
    this.shownAt = t;
    return { kind: 'show', item: this.cur };
  }

  /** The reveal on screen now, or null. */
  get current(): T | null { return this.cur; }

  /** How many wait. */
  get waiting(): number { return this.q.length; }

  /** Forget everything (a reset save, back to the title). */
  clear(): void {
    this.q.length = 0;
    this.cur = null;
    this.quietSince = null;
  }
}
