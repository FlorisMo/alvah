/**
 * beats/hold-math.ts — the pure core of a rustkracht moment played with the BODY (run 6
 * polish): no card, no buttons; the animal is right in front of him, tempting him, and
 * he keeps his hands (or his feet) still until it calms. THREE-free and DOM-free, so it
 * carries a node unit test (beats.test.ts).
 *
 * It drives the SAME pure `DagnachtRun` as the card (construct parity, design §6): an
 * impulse — a hand reaching for the piglet, a step toward the sow's piglets — is
 * `choose(false)` (the run marks the encounter once, however often he reaches), and a
 * full hold is `choose(true)`. Never a fail: after an impulse the animal reacts calmly,
 * a short line says what happened, and the same hold comes back.
 *
 *   'read'  the line is up and being read: the hold has not begun (a reach still counts)
 *   'hold'  the clock runs; `seconds` of stillness and it is held
 *   'react' he reached: the animal reacts, the line follows (reaches are not counted)
 *   'held'  done: `choose(true)` was called, once
 */

export type HoldPhase = 'read' | 'hold' | 'react' | 'held';

/** How long (s) he keeps still once the line has been read aloud. */
export const HOLD_S = 4;
/** …and once it has been read silently (voorlezen off: the read itself takes a while). */
export const HOLD_SILENT_S = 3.5;
/** A calm read of a line (s): 280 ms a word (the choice card's own measure). */
export function readSeconds(line: string): number {
  return line.trim().split(/\s+/).filter(Boolean).length * 0.28;
}

export class HoldCore {
  phase: HoldPhase = 'read';
  /** reaches counted (each one answered by the animal) */
  impulses = 0;
  /** seconds of stillness a hold wants */
  readonly seconds: number;
  private since = 0;
  private readonly choose: (goed: boolean) => void;

  /** `choose` is the run's own (`DagnachtRun.choose`). */
  constructor(seconds: number, choose: (goed: boolean) => void) {
    this.seconds = seconds;
    this.choose = choose;
  }

  /** The line has been read: the hold starts now (mission time, s). */
  begin(now: number): void {
    if (this.phase !== 'read') return;
    this.phase = 'hold';
    this.since = now;
  }

  /** A reach (a hand at the piglet, a step toward the sow). True when it counts: the run
   *  was told (`choose(false)`) and the animal must now react. While it reacts, or once
   *  the moment is held, a reach does nothing. */
  impulse(): boolean {
    if (this.phase !== 'read' && this.phase !== 'hold') return false;
    this.impulses += 1;
    this.phase = 'react';
    this.choose(false);
    return true;
  }

  /** The animal has reacted and the line said so: the same moment again (its line first). */
  again(): void {
    if (this.phase === 'react') this.phase = 'read';
  }

  /** Per frame (mission time, s): true once the hold is complete (`choose(true)` called once). */
  tick(now: number): boolean {
    if (this.phase === 'held') return true;
    if (this.phase !== 'hold' || now - this.since < this.seconds) return false;
    this.phase = 'held';
    this.choose(true);
    return true;
  }

  /** Seconds of stillness still wanted (the whole hold while it has not begun). */
  left(now: number): number {
    if (this.phase === 'held') return 0;
    if (this.phase !== 'hold') return this.seconds;
    return Math.max(0, this.seconds - (now - this.since));
  }
}
