/**
 * heli.ts — the pure helicopter flight core (WORLD-PLAN §5 W5.3 + the LOCKED §1e
 * helicopter comfort clause, BUILD-PLAN:77).
 *
 * The helicopter is arcade-kinematic like the jeep (§3.3, NO physics engine) but
 * adds a THIRD axis — altitude — and a stricter comfort law for a motion-sensitive
 * child flying above the world:
 *  - CLIMB/DESCENT is exp-damped and RATE-CLAMPED to ≤ 2 m/s toward a fixed cruise
 *    height (`climbStep`), so it never lurches vertically — the single most
 *    nausea-prone motion in flight.
 *  - The HORIZONTAL move reuses the jeep's `driveStep` (rate-clamped yaw about the
 *    heading, forward along `(sin h, cos h)`), so heading + collision + the
 *    follow-cam all line up with the walker/jeep for free — and yaw is the ONLY
 *    rotation (no pitch, no roll).
 *  - HORIZON IS ALWAYS LEVEL: roll is a hard 0 (`HELI_ROLL`); World pins it by
 *    building the camera basis on world-up, never from the flight state.
 *  - A gentle motion VIGNETTE fades in only while translating and is OFF at hover
 *    (`heliVignette`), a fixed-frame comfort cue rather than a moving one.
 *  - The helicopter is OPT-IN and UNAVAILABLE under reduced-motion (`heliAvailable`)
 *    — flight is the one mode we withhold entirely rather than merely calming.
 *
 * THREE-free, DOM-free, deterministic — it sits in the pure-core unit-test spine
 * next to `vehicle.ts`. The DOM/collision/camera plumbing lives in `World`, which
 * feeds `flyStep`'s ground delta straight into the SAME `resolveMove` the walker
 * and jeep use. Self-contained (its own `dampFactor`) so the core layer never
 * imports render3d.
 */

import { driveStep, type DriveInput, type DriveCaps } from './vehicle.ts';

/** Fixed cruise height (m) the helicopter eases to once airborne (§5 W5.3 ~25 m). */
export const HELI_CRUISE_HEIGHT = 25;

/** The ground altitude — the target while landing at a pad; hover-on-deck. */
export const HELI_PAD_HEIGHT = 0;

/** Vertical rate clamp: the LOCKED ≤ 2 m/s climb/descent comfort cap (§1e). */
export const HELI_MAX_CLIMB_RATE = 2;

/** Smooth-time of the vertical ease (~1.2 s → calm, well within the 2 m/s clamp). */
export const HELI_CLIMB_TAU = 1.2;

/** Horizontal caps: a gentle cruise (m/s) + a damped yaw rate (rad/s). Reused via
 *  `driveStep`. No reduced-motion twin — the helicopter is withheld entirely under
 *  reduced-motion (`heliAvailable`), so it only ever flies at these calm caps. */
export const HELI_CAPS: DriveCaps = { maxSpeed: 8, turnRate: 1.0 };

/** The horizon is ALWAYS level: roll is a hard zero, never derived from motion. */
export const HELI_ROLL = 0;

/** Peak motion-vignette opacity (0..1) — a gentle frame, never a blackout. */
export const HELI_VIGNETTE_MAX = 0.35;

/** Motion under this magnitude (m/s) counts as hover → the vignette is fully off. */
export const HELI_HOVER_EPS = 0.05;

/**
 * Frame-rate-independent exponential damping factor for a `tau`-second response
 * (the SAME `1 − exp(−dt/τ)` the camera follow uses; inlined so this core stays
 * self-contained and never reaches into render3d).
 */
function dampFactor(dt: number, tau: number): number {
  if (tau <= 0) return 1;
  return 1 - Math.exp(-dt / tau);
}

/** The vertical step: the new altitude + the signed climb rate it implies (m/s). */
export interface ClimbStep {
  altitude: number;
  climbRate: number;
}

/**
 * Ease `altitude` toward `target` with exp damping, then CLAMP the per-frame step
 * to `±maxRate·dt` so the vertical SPEED never exceeds `maxRate` (the LOCKED
 * ≤ 2 m/s clause). `dt ≤ 0` is a no-op (a paused frame never climbs). Pure: never
 * mutates its inputs.
 *
 * The clamp is what makes this frame-rate SAFE rather than merely frame-rate
 * independent: near the target the ease alone would move a tiny amount, but far
 * from it (entering flight, target jumps 0 → 25 m) the raw ease step would be
 * large — the clamp holds the climb to a gentle glide the whole way up.
 */
export function climbStep(
  altitude: number,
  target: number,
  dt: number,
  tau = HELI_CLIMB_TAU,
  maxRate = HELI_MAX_CLIMB_RATE,
): ClimbStep {
  if (!(dt > 0)) return { altitude, climbRate: 0 };
  const delta = target - altitude;
  let step = delta * dampFactor(dt, tau);
  const maxStep = maxRate * dt;
  if (step > maxStep) step = maxStep;
  else if (step < -maxStep) step = -maxStep;
  return { altitude: altitude + step, climbRate: step / dt };
}

/** The helicopter's live flight pose the core advances. */
export interface FlyState {
  heading: number;   // yaw (rad), the only rotation
  altitude: number;  // metres above the ground plane
}

/** One frame of flight: the new pose + the world-space deltas to apply. */
export interface FlyStep {
  heading: number;
  dx: number;        // horizontal ground delta x (feed resolveMove)
  dz: number;        // horizontal ground delta z (feed resolveMove)
  dy: number;        // vertical delta this frame (altitude change)
  altitude: number;  // resulting altitude
  speed: number;     // signed horizontal speed (m/s)
  climbRate: number; // signed vertical speed (m/s), |·| ≤ HELI_MAX_CLIMB_RATE
}

/**
 * Advance the helicopter one frame. Horizontal motion is the jeep's `driveStep`
 * (rate-clamped yaw, forward along the new heading); vertical motion eases toward
 * `targetAltitude` under the ≤ 2 m/s `climbStep` clamp. The two axes are
 * independent — you can climb while hovering horizontally, or cruise flat at
 * height — exactly the forgiving arcade feel. Pure.
 */
export function flyStep(
  state: FlyState,
  input: DriveInput,
  targetAltitude: number,
  dt: number,
  caps: DriveCaps = HELI_CAPS,
): FlyStep {
  const horiz = driveStep(state.heading, input, dt, caps);
  const vert = climbStep(state.altitude, targetAltitude, dt);
  return {
    heading: horiz.heading,
    dx: horiz.dx,
    dz: horiz.dz,
    dy: vert.altitude - state.altitude,
    altitude: vert.altitude,
    speed: horiz.speed,
    climbRate: vert.climbRate,
  };
}

/**
 * Motion-vignette opacity (0..1) for the current flight motion. OFF (0) at hover
 * — below `HELI_HOVER_EPS` combined speed — and fades in GENTLY with the total
 * translation magnitude, capped at `HELI_VIGNETTE_MAX`. A steady frame cue: it
 * tracks speed, it never pulses. Pure.
 */
export function heliVignette(speed: number, climbRate: number): number {
  const motion = Math.hypot(speed, climbRate);
  if (motion < HELI_HOVER_EPS) return 0;
  const ramp = (motion / HELI_CAPS.maxSpeed) * HELI_VIGNETTE_MAX;
  return ramp < HELI_VIGNETTE_MAX ? ramp : HELI_VIGNETTE_MAX;
}

/**
 * Whether the helicopter may be entered at all. It is OPT-IN (Instellingen, default
 * UIT) AND withheld entirely under reduced-motion — flight is the one mode too
 * motion-heavy to merely calm, so reduced-motion gets a gentle unavailable message
 * (World) instead. Pure predicate; the single source of truth for both.
 */
export function heliAvailable(optIn: boolean, reduced: boolean): boolean {
  return optIn && !reduced;
}
