/**
 * footstep.ts — pure surface-aware footstep cadence (W4.7b).
 *
 * Soft footsteps are locomotion FEEDBACK, not camera motion, so they play in
 * both motion modes (§3.4 exempts locomotion) but are gated on THREE things:
 *   • the sound setting (`geluid`) — the World checks it before playing,
 *   • the ranger's ground speed — below `MIN_STEP_SPEED` he is "not walking",
 *   • the biome underfoot — which decides the surface timbre (sand vs grass).
 *
 * The cadence is DISTANCE-based, not time-based: a footstep fires every
 * `STRIDE_M` metres of ground actually covered, so a faster walk steps quicker
 * and a slide-around-a-pine (slower ground speed) steps slower — both fall out
 * for free, and the total number of steps over a stretch of ground is
 * frame-rate INDEPENDENT (the accumulator carries its remainder).
 *
 * THREE-free / DOM-free / deterministic so it carries a unit test; the only
 * side-effecting consumer is `World.update` (→ `Sound.footstep`).
 */

import type { AmbientBiome } from './ambient';

export type FootSurface = 'zand' | 'gras';

/**
 * Map the biome underfoot to a footstep surface. Only the open drift-sand reads
 * as sand; heather, forest floor and reed-fringe all read as soft "grass"
 * ground (the plan scopes footsteps to two timbres, zand/gras).
 */
export function footSurface(biome: AmbientBiome): FootSurface {
  return biome === 'stuifzand' ? 'zand' : 'gras';
}

/** Metres of ground covered per footstep at a natural walking cadence. */
export const STRIDE_M = 0.85;

/** Below this ground speed (m/s) the ranger is standing/idling — no steps. */
export const MIN_STEP_SPEED = 0.6;

/**
 * The carry accumulator: metres walked toward the next footstep. Seeded at a
 * full stride so the first moving frame plants a foot at once (a step on
 * starting to walk), rather than after a silent stride.
 */
export interface FootAccum {
  dist: number;
}

export function newFootAccum(stride: number = STRIDE_M): FootAccum {
  return { dist: stride };
}

/**
 * Advance the cadence by the ground distance walked this frame. Returns the new
 * accumulator and how many footsteps crossed a stride boundary this frame
 * (normally 0 or 1; >1 only under a very large dt — the World plays one sound
 * but can still count them). Standing (speed below `minSpeed`) resets the carry
 * to a full stride so a stop-then-go re-plants a foot and never fires while
 * still.
 *
 * @param accum  previous carry state (not mutated)
 * @param speed  the ranger's post-collision ground speed (m/s)
 * @param dist   ground distance covered this frame (m), clamped ≥ 0
 */
export function stepFrame(
  accum: FootAccum,
  speed: number,
  dist: number,
  stride: number = STRIDE_M,
  minSpeed: number = MIN_STEP_SPEED,
): { accum: FootAccum; steps: number } {
  if (speed < minSpeed) return { accum: { dist: stride }, steps: 0 };
  let d = accum.dist + Math.max(dist, 0);
  let steps = 0;
  while (d >= stride) {
    d -= stride;
    steps++;
  }
  return { accum: { dist: d }, steps };
}
