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
 *
 * Run 7 (`adaptive`, design §5.4): how long a hold wants and how often the animal tempts
 * him come from the level's knobs (`holdS`, `tempts`), and inside one beat the pure
 * `RustTempo` adapts them: after a reach the next hold wants 0.5 s less (silently, never
 * under 2.5 s); after two clean holds in a row 0.5 s more (at most the band's + 1).
 * Temptations come at seeded moments of the hold, never in its first 1.1 s.
 *
 * Run 7 (ree-growth): `GoCore` is the same for a moment answered by WALKING AWAY (the
 * flip "Nu mag het wél": the mother is back, he walks off himself): his feet, not a card.
 */

import type { RustKnobs } from '../../../core/skill.ts';

export type HoldPhase = 'read' | 'hold' | 'react' | 'held';

/** How long (s) he keeps still once the line has been read aloud (a home without knobs). */
export const HOLD_S = 4;
/** …and once it has been read silently (voorlezen off: the read itself takes a while). */
export const HOLD_SILENT_S = 3.5;
/** Read silently, a hold wants this much less (the read itself took a while). */
export const SILENT_LESS_S = 0.5;
/** No hold is ever shorter than this (an eased one included). */
export const HOLD_MIN_S = 2.5;
/** The first temptation never comes sooner than this into a hold. */
export const TEMPT_AFTER_S = 1.1;
/** A calm read of a line (s): 280 ms a word (the choice card's own measure). */
export function readSeconds(line: string): number {
  return line.trim().split(/\s+/).filter(Boolean).length * 0.28;
}

export class HoldCore {
  phase: HoldPhase = 'read';
  /** reaches counted (each one answered by the animal) */
  impulses = 0;
  /** seconds of stillness a hold wants (run 7: set anew at each `begin` by the tempo) */
  seconds: number;
  private since = 0;
  private readonly choose: (goed: boolean) => void;

  /** `choose` is the run's own (`DagnachtRun.choose`). */
  constructor(seconds: number, choose: (goed: boolean) => void) {
    this.seconds = seconds;
    this.choose = choose;
  }

  /** The line has been read: the hold starts now (mission time, s), `seconds` long (default:
   *  as before). */
  begin(now: number, seconds = this.seconds): void {
    if (this.phase !== 'read') return;
    this.phase = 'hold';
    this.since = now;
    this.seconds = seconds;
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

/**
 * RustTempo — the holds of ONE rustkracht beat (run 7, design §5.4): it starts at the
 * band's `holdS` (0.5 s less when the line was read silently), eases half a second after a
 * reach (silently, ≥ 2.5 s) and grows half a second after two clean holds in a row (≤ the
 * band's + 1), and says when the animal tempts him (`tempts` per hold, seeded). Pure.
 */
export class RustTempo {
  private readonly base: number;
  private readonly most: number;
  private cur: number;
  private streak = 0;
  private readonly rng: () => number;
  readonly tempts: number;
  /** the longest moment he held (s): the beat's `holdS` */
  longest = 0;

  constructor(knobs: Pick<RustKnobs, 'holdS' | 'tempts'>, silent: boolean, rng: () => number) {
    this.base = Math.max(HOLD_MIN_S, knobs.holdS - (silent ? SILENT_LESS_S : 0));
    this.most = this.base + 1;
    this.cur = this.base;
    this.tempts = Math.max(1, Math.round(knobs.tempts));
    this.rng = rng;
  }

  /** seconds the next hold wants */
  get seconds(): number { return this.cur; }

  /** He reached: the next hold wants half a second less (never said, never under 2.5 s). */
  reached(): void {
    this.cur = Math.max(HOLD_MIN_S, this.cur - 0.5);
    this.streak = 0;
  }

  /** A moment was held for `seconds`; `clean`: without a reach. Two clean in a row: the next
   *  wants half a second more (at most the band's + 1). */
  held(seconds: number, clean: boolean): void {
    this.longest = Math.max(this.longest, seconds);
    if (!clean) { this.streak = 0; return; }
    this.streak += 1;
    if (this.streak >= 2) {
      this.cur = Math.min(this.most, this.cur + 0.5);
      this.streak = 0;
    }
  }

  /** When the animal tempts him in a hold of `seconds` (s after the hold began): `tempts`
   *  moments, seeded, the first never before 1.1 s, each in its own share of the hold, the
   *  last at least half a second before it ends. */
  temptsFor(seconds: number): number[] {
    const from = TEMPT_AFTER_S;
    const to = Math.max(from, seconds - 0.5);
    const span = (to - from) / this.tempts;
    return Array.from({ length: this.tempts }, (_, i) => Math.round((from + span * (i + 0.15 + this.rng() * 0.7)) * 100) / 100);
  }
}

/* ------------------------------------------------------------------ go ---- */

/** A spot on the ground (world x, z). */
export interface GoSpot { x: number; z: number }

/** How a "go" moment reads his feet (run 7, `GoCore`). */
export interface GoRule {
  /** he has walked this far (m) from where he stood when the line came: gone (default 4) */
  away: number;
  /** standing still this long (s) after the line was read is the old habit: "Blijf staan"
   *  (the level's `goWaitS`) */
  waitS: number;
  /** this much (m) closer to the animals than he was is walking up to them (default 2.5:
   *  a child turning round with ↑ held curves a metre or two their way first) */
  closer: number;
  /** within this (m) of where he stood counts as standing there, shuffling (default 1) */
  stay: number;
  /** gone means at least this much (m) farther from the animals than he stood (default
   *  0.5: round them on a circle is not away) */
  farther: number;
}

export const GO_AWAY_M = 4;
export const GO_CLOSER_M = 2.5;
export const GO_STAY_M = 1;
export const GO_FARTHER_M = 0.5;
/** Slower than this (m/s) is standing still (unless he is turning round). */
export const GO_STILL_V = 0.3;

export type GoPhase = 'read' | 'go' | 'react' | 'done';

/**
 * GoCore — the pure core of a rustkracht moment answered by WALKING AWAY (run 7, the
 * flip: "Mama is terug. Loop stil weg."): THREE-free, DOM-free, the mirror of `HoldCore`.
 * After the line is read the clock runs. Walking `away` m from where he stood when the
 * line came, farther from the animals than he was, at a walk, is `choose(true)` (once).
 * (`farther`: at least half a metre; round them on a circle is not away.)
 * Standing (within `stay` m of his spot, or slower than a walk, but not turning round) for
 * `waitS` s in all, or
 * coming `closer` m (2.5) nearer the animals, is the old rule kept too long: `choose(false)`
 * (the run marks the encounter once, however often), the animals react, and the same
 * moment comes back from where he is then. Running counts as neither (the home says
 * "Sst"): no step of it is judged, and no time of it is standing.
 *
 *   'read'  the line is up and being read: nothing is judged yet
 *   'go'    the clock runs
 *   'react' it went wrong: the animals react, the line follows (`again`)
 *   'done'  he walked away: `choose(true)` was called, once
 */
export class GoCore {
  phase: GoPhase = 'read';
  /** times it went wrong (each answered by the animals) */
  wrongs = 0;
  /** seconds he has stood since this round's line was read */
  idle = 0;
  /** why it last went wrong: he stood too long, or he came closer */
  why: 'stay' | 'closer' | null = null;
  readonly rule: GoRule;
  private from: GoSpot = { x: 0, z: 0 };
  private near0 = 0;
  private last = 0;
  private readonly choose: (goed: boolean) => void;

  constructor(rule: Partial<GoRule> & { waitS: number }, choose: (goed: boolean) => void) {
    this.rule = { away: GO_AWAY_M, closer: GO_CLOSER_M, stay: GO_STAY_M, farther: GO_FARTHER_M, ...rule };
    this.choose = choose;
  }

  /** The line has been read (mission time `now`): the clock runs. `at`: where he stood
   *  when the line came (a step taken while it was read counts toward going away), or,
   *  when the moment comes back, where he is now; `family`: where the animals are. "Away"
   *  is always counted from where he stood the first time (the hide: a walk up to them and
   *  back is no walk away), "closer" from the nearest he has stood to them since. */
  begin(now: number, at: GoSpot, family: GoSpot): void {
    if (this.phase !== 'read') return;
    const near = Math.hypot(at.x - family.x, at.z - family.z);
    if (!this.begun) { this.from = { x: at.x, z: at.z }; this.near0 = near; this.begun = true; }
    else this.near0 = Math.min(this.near0, near);
    this.phase = 'go';
    this.idle = 0;
    this.last = now;
  }
  private begun = false;

  /** Per frame: where he is and how he moves, where the animals are. 'right' once he has
   *  walked away (`choose(true)`), 'wrong' when he stood too long or came closer
   *  (`choose(false)`; the home plays the animals' reaction, then `again`), else null. */
  tick(now: number, me: GoSpot & { speed: number; running: boolean; turning?: boolean; trying?: boolean }, family: GoSpot): 'right' | 'wrong' | null {
    if (this.phase !== 'go') return null;
    const dt = Math.max(0, Math.min(0.5, now - this.last));
    this.last = now;
    if (me.running) return null; // (neither: "Sst. Loop stil.")
    const near = Math.hypot(me.x - family.x, me.z - family.z);
    if (near <= this.near0 - this.rule.closer) return this.wrong('closer');
    const moved = Math.hypot(me.x - this.from.x, me.z - this.from.z);
    if (moved >= this.rule.away && near >= this.near0 + this.rule.farther) {
      this.phase = 'done';
      this.choose(true);
      return 'right';
    }
    // (turning round on the spot is no standing: he is about to walk away; nor is pushing
    // on against a bush or a trunk in his way: `trying`, a walk key or the stick held)
    if ((moved < this.rule.stay || me.speed < GO_STILL_V) && !me.turning && !me.trying) {
      this.idle += dt;
      if (this.idle >= this.rule.waitS) return this.wrong('stay');
    }
    return null;
  }

  /** The animals have reacted and the line said so: the same moment again (its line first). */
  again(): void {
    if (this.phase === 'react') this.phase = 'read';
  }

  private wrong(why: 'stay' | 'closer'): 'wrong' {
    this.wrongs += 1;
    this.why = why;
    this.phase = 'react';
    this.choose(false);
    return 'wrong';
  }
}
