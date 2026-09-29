/**
 * beats/callers-math.ts — the pure part of the CALLERS beat (simon in the world): when
 * each animal of the sequence calls and lights up. THREE-free, unit-tested.
 */

/** One call of the listening: the animal, how long it calls (and glows), the quiet after. */
export interface CallBeat { id: string; on: number; gap: number }

/** The listening, call by call: each lights up for as long as its call rings (at least
 *  0.65 s: a short call still reads), a calm gap between two (a little longer under
 *  reduced motion, where nothing else moves to follow). */
export function listenPlan(sequence: readonly string[], dur: (id: string) => number, reduced = false): CallBeat[] {
  const gap = reduced ? 0.42 : 0.32;
  return sequence.map((id) => ({ id, on: Math.max(0.65, dur(id)), gap }));
}
