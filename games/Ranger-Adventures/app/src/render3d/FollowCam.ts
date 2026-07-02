/**
 * FollowCam.ts — the pure yaw maths for the rotating follow-camera (WORLD-PLAN
 * §3.2 / W1.5). The camera eases behind the ranger as he turns: a follow-bearing
 * `yaw` chases the ranger's facing with frame-rate-independent exponential
 * damping AND a yaw-rate clamp, so a tap-to-walk 180° about-face can never
 * whip-pan the child's view.
 *
 * THREE-free, DOM-free, deterministic — the geometry (offset rotation, lookAt)
 * lives in `World.placeCamera`; this module holds only the angle update so it
 * sits in the pure-core unit-test spine (like `MotionMode.ts`). The exp-damping
 * factor is the SAME `dampFactor` the §1e position follow uses, so the whole
 * camera shares one frame-rate-independence guarantee.
 *
 * Two guarantees the unit test pins:
 *  - dt-independence: for a fixed target, stepping to the same total time in
 *    N steps lands on the same yaw for any N (30/60/120 fps identical), because
 *    lerping by `1 − exp(−dt/τ)` each step leaves the remaining error at
 *    `exp(−ΣΔt/τ) = exp(−T/τ)` regardless of how ΣΔt is split.
 *  - rate clamp: a single frame's step never exceeds `maxRate·dt`, so a big
 *    angular gap (a 180° turn) turns at a bounded ~120°/s, never a snap.
 */

import { dampFactor } from './play/kit-math.ts';

/** Smooth-time of the follow-bearing ease (§3.2: ~0.2–0.3 s). */
export const FOLLOW_TAU = 0.25;

/** Yaw-rate clamp: ~120°/s so a 180° about-face pans smoothly, never whips. */
export const FOLLOW_MAX_RATE = (120 * Math.PI) / 180;

/**
 * The fixed follow-bearing used when the camera does NOT rotate — reduced-motion
 * or the "Camera draait mee" toggle off. `π` reproduces the pre-W1.5 diorama
 * offset (straight behind on +z): `-(sin π, cos π)·dist = (0, +dist)`.
 */
export const FIXED_FOLLOW_YAW = Math.PI;

/** Normalize an angle to (−π, π]. Periodic, so wrap-around never accumulates. */
export function wrapAngle(a: number): number {
  const twoPi = Math.PI * 2;
  const r = ((a % twoPi) + twoPi) % twoPi; // [0, 2π)
  return r > Math.PI ? r - twoPi : r;      // (−π, π]
}

/** Shortest signed rotation from `from` to `to`, in (−π, π] — always the short way. */
export function shortestAngleDelta(from: number, to: number): number {
  return wrapAngle(to - from);
}

/**
 * One frame of the damped, rate-clamped follow-yaw update. Eases `current`
 * toward `target` along the SHORTEST arc (so ±π wraps take the short way), by
 * the frame-rate-independent factor `1 − exp(−dt/τ)`, then clamps the resulting
 * step to `±maxRate·dt` before wrapping. `dt ≤ 0` is a no-op (returns the
 * wrapped current — a paused frame never rotates).
 */
export function dampedYaw(
  current: number,
  target: number,
  dt: number,
  tau = FOLLOW_TAU,
  maxRate = FOLLOW_MAX_RATE,
): number {
  if (!(dt > 0)) return wrapAngle(current);
  const delta = shortestAngleDelta(current, target);
  let step = delta * dampFactor(dt, tau);
  const maxStep = maxRate * dt;
  if (step > maxStep) step = maxStep;
  else if (step < -maxStep) step = -maxStep;
  return wrapAngle(current + step);
}
