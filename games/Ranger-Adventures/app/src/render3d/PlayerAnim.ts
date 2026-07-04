/**
 * PlayerAnim.ts — the pure state machine for the ranger's locomotion animation
 * (WORLD-PLAN §5 / W3.2). The ranger GLB carries baked `idle` + `walk` clips
 * (staged by W3.1); this module decides how much of each to blend from the
 * player's ground speed, with a frame-rate-independent crossfade so 30/60/120
 * fps land on the same weight for the same elapsed time.
 *
 * THREE-free, DOM-free, deterministic — it sits in the pure-core unit-test spine
 * (like `FollowCam.ts`). The mixer/action wiring lives in `PlayerRig.ts`; this
 * module holds only the scalar blend maths so the crossfade is pinned without a
 * browser. The exp-damping factor is the SAME `dampFactor` the §1e camera and
 * position follow use, so the whole feel shares one smoothing guarantee.
 *
 * Locomotion is EXEMPT from the reduced-motion freeze (§3.4: "locomotion itself
 * always allowed") — a walking ranger animates in both motion modes. Only the
 * SECONDARY animal/ambient motion freezes. So this module never takes a reduced
 * flag: it maps speed → blend the same way always.
 */

import { dampFactor } from './play/kit-math.ts';

/** Ground speed (m/s) above which the ranger is "walking" — below it he idles.
 *  Just under the tap-to-walk stop threshold so a real step always crosses it. */
export const WALK_ENTER_SPEED = 0.2;

/** Smooth-time of the idle↔walk crossfade (~0.12 s: quick but never a pop). */
export const BLEND_TAU = 0.12;

/** Weight is the walk share in [0,1]; idle share is `1 − walk`. */
export type WalkWeight = number;

/** Ground speed (m/s) at which the walk clip plays at its natural authored rate
 *  (timeScale 1): its baked stride covers one authored step-length of ground per
 *  loop at this speed, so the feet plant with zero slip. Pinned near a human-walk
 *  cadence (~1.5 m/s) — just under the retuned foot speed (World `speed` ≈ 1.8),
 *  so a normal stride runs a touch above the authored rate rather than dragging
 *  the feet behind the ground (F-08). */
export const STRIDE_MATCH_SPEED = 1.5;

/** Clamp band for the stride playback rate: never freeze/reverse the feet at a
 *  near-stop slide, never smear them on a transient over-speed (F-08 comfort). */
export const STRIDE_RATE_MIN = 0.4;
export const STRIDE_RATE_MAX = 2.0;

/**
 * The walk clip's playback rate (AnimationAction.timeScale) for a given ground
 * speed — TIED to the real post-collision speed so distance-per-stride-cycle
 * stays ≈ the clip's authored stride at ANY speed. This kills the foot-slip F-08
 * measured (the ranger covered ≈3 m per ≈1.1 s cycle, sliding the feet ~2.5×):
 * rate = speed / STRIDE_MATCH_SPEED, so a slide-around-a-pine slowdown eases the
 * cadence in lockstep and a full-speed stride cycles a touch faster. Clamped to a
 * comfortable band. Pure + deterministic, so it joins this module's unit spine.
 */
export function strideRate(
  speed: number,
  ref: number = STRIDE_MATCH_SPEED,
): number {
  const r = speed / ref;
  return r < STRIDE_RATE_MIN ? STRIDE_RATE_MIN : r > STRIDE_RATE_MAX ? STRIDE_RATE_MAX : r;
}

/**
 * Ease the walk weight toward its speed-driven target (1 when moving, 0 when
 * still) with frame-rate-independent exponential damping. Clamped to [0,1].
 *
 * dt-independence (pinned by the unit test): stepping to a fixed total time in
 * N steps lands on the same weight for any N, because lerping by
 * `1 − exp(−dt/τ)` leaves the remaining error at `exp(−ΣΔt/τ)` regardless of how
 * ΣΔt is split.
 */
export function stepWalkWeight(
  cur: WalkWeight,
  speed: number,
  dt: number,
  tau: number = BLEND_TAU,
  enter: number = WALK_ENTER_SPEED,
): WalkWeight {
  const target = speed > enter ? 1 : 0;
  const w = cur + (target - cur) * dampFactor(dt, tau);
  return w < 0 ? 0 : w > 1 ? 1 : w;
}

/**
 * The dominant gait, for the dev-hook `clip()` report (and to pick which action's
 * time to expose). At exactly 0.5 the ranger is mid-crossfade — reported as walk
 * so the E2E sees `walk` the moment a held key has him actually moving.
 */
export function dominantGait(walkWeight: WalkWeight): 'idle' | 'walk' {
  return walkWeight >= 0.5 ? 'walk' : 'idle';
}
