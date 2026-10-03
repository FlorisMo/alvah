/**
 * ven.listen.ts — the frogs' chorus he follows by ear (run 7, design
 * `state/adventures/design.md` §3.2 beats 2 and 6, §3.5). Pure: no THREE, no DOM, no clock
 * of its own (ven.listen.test.ts).
 *
 * On the way to the cove the heikikkers call from its water now and then — a burst of soft
 * "woog" calls and rings spreading where they sit. RUNNING silences them ("Sst. Nu zijn ze
 * stil."): they call again only once he has stood still a moment. At a few listening stops
 * along his way they fall silent by themselves ("Sta stil. Luister.") and answer once he
 * stands still (ven.places `wayOf` says where). How clear the chorus is and how often he
 * must stop to listen are the level's (`k.knobs('zoeken')`: `trailClarity`, `trailLegs` —
 * the zoeken trail's own axis, never the search's look-alikes): a fresh ranger hears three
 * calls every few seconds and big rings, and stops twice (the last stop at the cove); a
 * practised one hears a single call now and then with small rings, and stops up to five
 * times.
 */

/** He has stood still this long (s) and the frogs call again. */
export const STILL_S = 1.2;
/** Slower than this (m/s) is standing still. */
export const STILL_V = 0.25;

/** Seconds between two bursts of the chorus at a trail clarity (0.4 … 0.95). */
export function chorusEvery(clarity: number): number {
  const c = Math.max(0, Math.min(1, clarity));
  return Math.round((3.4 + (1 - c) * 6) * 10) / 10;
}
/** How many calls a burst has (3 when clear, 1 when faint). */
export function chorusCalls(clarity: number): number {
  return clarity >= 0.8 ? 3 : clarity >= 0.55 ? 2 : 1;
}
/** How far (m) the rings spread on the water where they call (big when clear). */
export function ringSize(clarity: number): number {
  return Math.round((0.35 + 0.6 * Math.max(0, Math.min(1, clarity))) * 100) / 100;
}
/** How many listening stops on his way before the cove's own (`trailLegs` − 1, at least 1). */
export function listensOf(trailLegs: number): number {
  return Math.max(1, Math.round(trailLegs) - 1);
}

export type ListenEvent = 'call' | 'hush' | 'back';

/**
 * The chorus while he follows: it calls every `chorusEvery(clarity)` s (the first soon);
 * running hushes it (once a run: 'hush'), and it comes back ('back', with a call) once he
 * has stood still `STILL_S`. `pause`/`resume` hold it (a listening stop, a moment on the
 * way: the frogs are quiet then, the script calls them itself).
 */
export class ListenCore {
  readonly every: number;
  hushed = false;
  /** runs that hushed it */
  hushes = 0;
  private still = 0;
  private next: number;
  private paused = false;
  private readonly rng: () => number;

  constructor(clarity: number, rng: () => number) {
    this.every = chorusEvery(clarity);
    this.rng = rng;
    this.next = 0.8 + rng() * 0.8;
  }

  /** Hold the chorus (it neither calls nor hushes). */
  pause(): void { this.paused = true; }
  /** Let it call again, its next burst in `soon` s (it is not hushed any more). */
  resume(soon = 1.2): void { this.paused = false; this.hushed = false; this.still = 0; this.next = soon; }

  /** Per frame: how he moves; returns what the chorus does now, if anything. */
  tick(dt: number, me: { running: boolean; speed: number }): ListenEvent | null {
    if (this.paused) return null;
    if (me.running) {
      this.still = 0;
      if (!this.hushed) { this.hushed = true; this.hushes += 1; return 'hush'; }
      return null;
    }
    if (this.hushed) {
      this.still = me.speed < STILL_V ? this.still + dt : 0;
      if (this.still < STILL_S) return null;
      this.hushed = false;
      this.next = this.every * (0.8 + this.rng() * 0.4);
      return 'back';
    }
    this.next -= dt;
    if (this.next > 0) return null;
    this.next = this.every * (0.8 + this.rng() * 0.4);
    return 'call';
  }
}

/** Has he stood still long enough (a listening stop, the singing)? Feed it every frame. */
export class StillFor {
  private t = 0;
  readonly seconds: number;
  constructor(seconds = STILL_S) { this.seconds = seconds; }
  tick(dt: number, speed: number): boolean {
    this.t = speed < STILL_V ? this.t + dt : 0;
    return this.t >= this.seconds;
  }
  reset(): void { this.t = 0; }
}
