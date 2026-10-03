/**
 * beats/walk-math.ts — the pure cores of two rustkracht moments played by WALKING (run 7,
 * frisling package 'body', design frisling §5.6): no card, no buttons; what his feet do
 * is the answer. THREE-free and DOM-free, so they carry a node unit test (walk-math.test.ts).
 *
 * Like `HoldCore` (hold-math.ts) they drive the SAME pure `DagnachtRun` as the card does
 * (construct parity): the first impulse in a moment is `choose(false)` (the run marks the
 * encounter once, however often; each counted impulse is one of the summary's
 * `impulses`), the moment comes back until it is done, and done is `choose(true)`, once.
 * The 2D floor still asks the same encounter as a card.
 *
 *   PACE  ('dragen': "Hij is moe. Loop rustig mee.") — he walks a stretch with a tired
 *         animal at his side, at its pace. A RUN (Shift, the stick at its rim) is the
 *         impulse: the animal dives into cover, and once he walked calmly back to it the
 *         stretch starts again from there. Walked to its end calmly: done.
 *   WALK ON ('pad', the flip: "Het pad is vrij. Loop maar.") — the stay-habit built by
 *         the other moments must now give way: walking on along the way `WALK_ON_M` within
 *         the level's `goWaitS` (counted from the end of the line's read) is right, and so
 *         is having SET OFF along it when the window closes (the habit kept too long is
 *         STANDING, not a short distance); still standing at the window's end is the habit
 *         kept too long (the group shuffles on, "Je wacht te lang."), and the moment comes
 *         back.
 *
 * (The ree lane's `GoCore`, hold-math.ts on its own branch, is another rule: walking AWAY
 * from the animals, where coming closer is wrong. Walking ON along a way past them is this
 * one: no direction is wrong, only waiting too long.)
 */

import type { RustKnobs } from '../../../core/skill.ts';

/* ---------------------------------------------------------------- pace ---- */

/** A tired piglet's pace (m/s): his walk is capped at it while he walks with it. */
export const TIRED_PACE = 1.1;
/** A pace stretch is never shorter than this (m), unless the way itself is. */
export const PACE_MIN_M = 8;
/** The first temptation never comes sooner than this far into a stretch (m)… */
export const PACE_TEMPT_FROM_M = 1.5;
/** …and the last at least this far before its end (m). */
export const PACE_TEMPT_END_M = 1.5;

/**
 * How long (m) a pace stretch is: as long as the level's hold, walked twice over at the
 * tired pace (`holdS` × 2 s × `TIRED_PACE`), at least `PACE_MIN_M` — or `rest`, the way
 * left, if that is shorter.
 */
export function paceStretch(holdS: number, rest: number): number {
  return Math.max(0, Math.min(rest, Math.max(PACE_MIN_M, holdS * 2 * TIRED_PACE)));
}

/**
 * Where along a stretch of `len` m the walk tempts him to hurry (the family grunts ahead,
 * a sibling squeaks): `tempts` marks (m from the start), seeded, each in its own share of
 * the stretch, never in its first `PACE_TEMPT_FROM_M` nor its last `PACE_TEMPT_END_M`
 * (a stretch too short for them: all in its middle).
 */
export function paceTempts(len: number, knobs: Pick<RustKnobs, 'tempts'>, rng: () => number): number[] {
  const n = Math.max(1, Math.round(knobs.tempts));
  const from = Math.min(PACE_TEMPT_FROM_M, len / 2);
  const to = Math.max(from, len - PACE_TEMPT_END_M);
  const span = (to - from) / n;
  return Array.from({ length: n }, (_, i) => Math.round((from + span * (i + 0.15 + rng() * 0.7)) * 100) / 100);
}

export type PacePhase = 'walk' | 'react' | 'done';

/**
 * PaceCore — walk a stretch with a tired animal (the PACE moment). Pure.
 *
 *   'walk'  he walks the stretch with it (its line said; walking while it is read counts)
 *   'react' he ran: it dived into cover; he walks calmly back to it (`again` once it is out)
 *   'done'  he walked the stretch to its end calmly: `choose(true)` was called, once
 */
export class PaceCore {
  phase: PacePhase = 'walk';
  /** runs counted (each answered by the animal diving into cover) */
  impulses = 0;
  /** how many times the stretch began (1 + the runs it came back after) */
  stretches = 1;
  private readonly choose: (goed: boolean) => void;

  constructor(choose: (goed: boolean) => void) { this.choose = choose; }

  /** He ran. True when it counts (`choose(false)`): the animal must now dive. While it
   *  hides, another run is the same one; once the stretch is done a run does nothing. */
  run(): boolean {
    if (this.phase !== 'walk') return false;
    this.impulses += 1;
    this.phase = 'react';
    this.choose(false);
    return true;
  }

  /** The animal came out to him again: the stretch again, from here (its line first). */
  again(): void {
    if (this.phase !== 'react') return;
    this.phase = 'walk';
    this.stretches += 1;
  }

  /** He came to the stretch's end with it at his side. True once it is done (`choose(true)`
   *  called once); while it hides (he ran on to the end) it is not. */
  arrived(): boolean {
    if (this.phase === 'done') return true;
    if (this.phase !== 'walk') return false;
    this.phase = 'done';
    this.choose(true);
    return true;
  }
}

/* ------------------------------------------------------------- walk on ---- */

/** How far (m) he walks on along the way: then he went. */
export const WALK_ON_M = 1.5;
/** He is walking on (set off) when, over the last `ONSET_S` s… */
export const ONSET_S = 0.5;
/** …he came at least this much (m) further along the way (0.2 m/s: the first step of a walk
 *  from standing, about 0.15 s in; never a turn on the spot). */
export const ONSET_M = 0.1;

export type WalkOnPhase = 'read' | 'wait' | 'react' | 'went';

/**
 * WalkOnCore — the flip played with the feet (the WALK ON moment): the mirror of `HoldCore`.
 * Pure. `progress` is how far (m) he has come along the way since the moment began (the
 * home measures it: nearer the spot he walks on to); it is never reset, so steps taken
 * before a wait still count after it.
 *
 *   'read'  the line is up and being read: walking on counts already, the window has not begun
 *   'wait'  the window runs: `waitS` s to walk on
 *   'react' he was still STANDING when the window closed: the group shuffles on, the words
 *           for it (`again` after). A child who set off along the way in its last moments
 *           (he is walking on when it closes, `walking`) is never late: he went.
 *   'went'  he walked on: `choose(true)` was called, once
 */
export class WalkOnCore {
  phase: WalkOnPhase = 'read';
  /** waits past the window counted (each answered by the group shuffling on) */
  impulses = 0;
  /** seconds he may wait once the line was read (the level's `goWaitS`) */
  readonly waitS: number;
  /** metres along the way that are going on */
  readonly needM: number;
  private since = 0;
  /** his progress over the last moments (mission time, m): is he walking on now? */
  private trail: { t: number; m: number }[] = [];
  private readonly choose: (goed: boolean) => void;

  constructor(waitS: number, choose: (goed: boolean) => void, needM = WALK_ON_M) {
    this.waitS = waitS;
    this.needM = needM;
    this.choose = choose;
  }

  /** The line has been read (mission time, s): the window opens now. */
  begin(now: number): void {
    if (this.phase !== 'read') return;
    this.phase = 'wait';
    this.since = now;
  }

  /** Per frame (mission time, s; `progress` m along the way): 'went' once he walked on
   *  (`choose(true)`, once) — `needM` along the way, or set off along it when the window
   *  closes; 'late' the frame the window closed on him STANDING (`choose(false)`; the home
   *  plays the group's reaction, then `again`), else null. While the group reacts, nothing
   *  is judged: a step then counts once the line is back. */
  tick(now: number, progress: number): 'went' | 'late' | null {
    if (this.phase === 'went') return 'went';
    if (this.phase === 'react') { this.trail = []; return null; }
    this.trail.push({ t: now, m: progress });
    // (keep one sample at or before ONSET_S ago, and the ones since)
    while (this.trail.length > 2 && this.trail[1].t <= now - ONSET_S) this.trail.shift();
    if (progress >= this.needM) return this.went();
    if (this.phase === 'wait' && now - this.since >= this.waitS) {
      // he set off in the window's last moments: he is walking on, never late
      if (this.walking(now)) return this.went();
      this.phase = 'react';
      this.impulses += 1;
      this.choose(false);
      return 'late';
    }
    return null;
  }

  /** Is he walking on along the way now: `ONSET_M` further along it than `ONSET_S` s ago
   *  (the oldest sample when the trail is younger)? */
  walking(now: number): boolean {
    const tr = this.trail;
    if (tr.length < 2) return false;
    const last = tr[tr.length - 1];
    let from = tr[0];
    for (const s of tr) { if (s.t <= now - ONSET_S) from = s; else break; }
    return last.m - from.m >= ONSET_M;
  }

  private went(): 'went' {
    this.phase = 'went';
    this.choose(true);
    return 'went';
  }

  /** The group has shuffled on and the line said so: the same moment again (its line
   *  first, then a whole window). */
  again(): void {
    if (this.phase === 'react') this.phase = 'read';
  }

  /** Seconds of the window still open (the whole window while the line is read). */
  left(now: number): number {
    if (this.phase === 'went') return 0;
    if (this.phase !== 'wait') return this.waitS;
    return Math.max(0, this.waitS - (now - this.since));
  }
}
