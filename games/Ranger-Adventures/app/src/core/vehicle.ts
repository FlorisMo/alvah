/**
 * vehicle.ts — the pure arcade-vehicle drive core (WORLD-PLAN §3.2 / W5.1).
 *
 * One job: turn the raw driver intent (throttle + steer, each in [−1, 1]) and the
 * jeep's current heading into the next heading and a ground-plane move delta,
 * bounded by the active caps. It is ARCADE-KINEMATIC — no physics engine (§3.3):
 * the jeep steers about its own heading and drives along it, exactly the feel a
 * bespoke `resolveMove` already gives the walker, just faster and car-like.
 *
 * THREE-free, DOM-free, deterministic — the DOM/collision plumbing lives in
 * `World` (which feeds the returned delta straight into `resolveMove` for the
 * SAME collision/rim/water/terrain-stick the walker gets). This module stays in
 * the pure-core unit-test spine.
 *
 * Coordinate conventions (shared with `input.ts` + `World`, verified not assumed):
 * - A heading yaw θ points forward along `(sin θ, cos θ)` in `(x, z)` — the same
 *   `ranger.rotation.y = atan2(moveX, moveZ)` convention the walker uses, so the
 *   jeep's `rotation.y = heading` and the follow-cam behind it line up for free.
 * - STEER sign: `steer > 0` = the driver pressed RIGHT and wants the nose to
 *   swing to their right. With forward `(sin θ, cos θ)`, increasing θ turns the
 *   nose toward `(cos θ, −sin θ)` — the driver's LEFT (at θ = π, facing −z into
 *   the screen, that is −x = screen-left). So a right-steer DECREASES the yaw:
 *   `heading -= steer · turnRate · dt`. This holds for every heading, so "press
 *   right → curve right" is universal.
 *
 * The comfort clause (§3.2 / research C.3): reduced-motion caps top speed ~3 m/s
 * and HALVES the turn-rate, so the whole drive stays gentle — `driveCaps(reduced)`
 * is the single place that lives. F-32 adds two more comfort shapers, applied by
 * the World to the JEEP ONLY (the heli reuses the raw `driveStep`): `rampSpeed`
 * eases the speed toward the throttle over ~1 s instead of snapping to the cap on
 * frame one, and `comfortSteer` scales the steer by how fast the jeep is actually
 * moving so it can never pivot in place (the audit's spin-top / doughnut). The two
 * keep the reachable turn rate ~0.6 rad/s WITHOUT touching the frozen caps the
 * `vehicle` E2E pins (turnRate 1.2 / maxSpeed 6, halved under reduced-motion).
 */

/** The active arcade caps: top speed (m/s) and the yaw rate-clamp (rad/s). */
export interface DriveCaps {
  maxSpeed: number;
  turnRate: number;
}

/** Full-motion jeep caps (§5 W5.1: speed ≈ 6 m/s, turn-rate clamp ≈ 1.2 rad/s). */
export const JEEP_CAPS: DriveCaps = { maxSpeed: 6, turnRate: 1.2 };

/**
 * Reduced-motion jeep caps (§3.2 vehicle comfort clause): top speed halved to
 * ~3 m/s and the turn-rate halved, so the ride is calm on a motion-sensitive
 * device. Exactly half of `JEEP_CAPS`, kept explicit so the intent reads plainly.
 */
export const JEEP_CAPS_REDUCED: DriveCaps = { maxSpeed: 3, turnRate: 0.6 };

/** The caps in force for the current motion mode. Pure + deterministic. */
export function driveCaps(reduced: boolean): DriveCaps {
  return reduced ? JEEP_CAPS_REDUCED : JEEP_CAPS;
}

/**
 * W5.2 calm rule: the jeep auto-slows near wildlife so animals never panic-flee
 * (§5 W5.2, frozen never-scary contract §3.4). Within `ANIMAL_SLOW_RADIUS` of the
 * nearest animal the top speed is held to `ANIMAL_SLOW_SPEED` — gentle enough to
 * drift past a grazing ree. Below the cap the drive is untouched.
 */
export const ANIMAL_SLOW_SPEED = 2; // m/s — the crawl the jeep keeps near animals
export const ANIMAL_SLOW_RADIUS = 8; // m — how close counts as "near an animal"

/**
 * Cap a signed drive speed to the near-animal crawl when the nearest animal sits
 * within `ANIMAL_SLOW_RADIUS`. Preserves the sign (reverse still reverses) and
 * only ever slows — a speed already under the crawl passes through untouched.
 * Pure + deterministic (the World feeds it the live nearest-animal distance).
 */
export function calmSpeed(speed: number, distToNearestAnimal: number): number {
  if (distToNearestAnimal <= ANIMAL_SLOW_RADIUS && Math.abs(speed) > ANIMAL_SLOW_SPEED) {
    return Math.sign(speed) * ANIMAL_SLOW_SPEED;
  }
  return speed;
}

/** Driver intent this frame: `throttle` forward (+) / reverse (−), `steer`
 *  right (+) / left (−). Both are read from the SAME `screenVector` the walker
 *  uses (y → throttle, x → steer), so keys and the joystick agree. */
export interface DriveInput {
  throttle: number;
  steer: number;
}

/** The controller's per-frame output: the new heading (rad) + the world-space
 *  ground delta to feed `resolveMove`, plus the signed speed (m/s) it implies. */
export interface DriveStep {
  heading: number;
  dx: number;
  dz: number;
  speed: number;
}

function clampUnit(v: number): number {
  return v < -1 ? -1 : v > 1 ? 1 : v;
}

/** Wrap an angle to (−π, π]. Local (keeps this core self-contained + pure). */
function wrap(a: number): number {
  const twoPi = Math.PI * 2;
  const r = ((a % twoPi) + twoPi) % twoPi;
  return r > Math.PI ? r - twoPi : r;
}

/**
 * Advance the arcade jeep one frame. Steer rotates the heading (rate-clamped by
 * `caps.turnRate`, right-steer decreases yaw — see the module header), then the
 * jeep drives along the NEW heading at `throttle · caps.maxSpeed`. Turning is
 * allowed at any throttle (a kid can point the nose before setting off — the
 * most forgiving arcade feel, and the follow-cam's own 120°/s clamp keeps even a
 * spin comfortable). Pure: never mutates its inputs.
 *
 * Straight-line driving (`steer === 0`) is frame-rate independent — the
 * displacement is `speed · dt` regardless of how the frame is subdivided (the
 * unit test pins this). A steered arc is not (the heading moves between
 * substeps), which is expected and fine for arcade motion.
 */
export function driveStep(
  heading: number,
  input: DriveInput,
  dt: number,
  caps: DriveCaps,
): DriveStep {
  const throttle = clampUnit(input.throttle);
  const steer = clampUnit(input.steer);
  const nextHeading = wrap(heading - steer * caps.turnRate * dt);
  const speed = throttle * caps.maxSpeed;
  const dist = speed * dt;
  return {
    heading: nextHeading,
    dx: Math.sin(nextHeading) * dist,
    dz: Math.cos(nextHeading) * dist,
    speed,
  };
}

/**
 * F-32 comfort — seconds for the jeep to build from rest to its top speed (and the
 * same to brake to a stop or reverse). ~1 s is a calm arcade ramp for a young
 * driver; the reduced-motion cap reaches its lower top in the same time, so a
 * gentler build-up falls out for free.
 */
export const JEEP_RAMP_TIME = 1;

/**
 * F-32 acceleration ramp (JEEP only; applied by the World before `driveStep`). Move
 * the live drive speed toward the throttle's target `throttle · maxSpeed` at a
 * bounded rate `maxSpeed / JEEP_RAMP_TIME`, instead of snapping to full speed on the
 * first frame — the audit measured max speed (√18) from drive-sample one, no ramp.
 * The clamp is symmetric, so lifting off or reversing eases down at the same rate.
 * Pure + deterministic (the World threads the live speed across frames).
 */
export function rampSpeed(current: number, throttle: number, dt: number, caps: DriveCaps): number {
  const target = clampUnit(throttle) * caps.maxSpeed;
  const maxDv = (caps.maxSpeed / JEEP_RAMP_TIME) * dt;
  const dv = target - current;
  return Math.abs(dv) <= maxDv ? target : current + Math.sign(dv) * maxDv;
}

/**
 * F-32 speed-scaled steering (JEEP only; applied by the World before `driveStep`).
 * Scale the raw steer by how fast the jeep is ACTUALLY moving (`|speed| / maxSpeed`)
 * so it can never pivot in place — the spin-top / doughnut the audit caught, where a
 * held turn key spun the nose while the jeep went nowhere. Fed to `driveStep` as its
 * `steer`, the reachable yaw rate then peaks at `turnRate / 2` (≈ 0.6 rad/s at full
 * caps — the shared unit-magnitude stick cannot hold full steer AND full throttle at
 * once), which lands inside the F-32 comfort band, and the turn radius
 * `maxSpeed / turnRate` stays roughly constant across speeds (one calm arc). Pure.
 */
export function comfortSteer(steer: number, speed: number, caps: DriveCaps): number {
  const speedFrac = Math.min(1, Math.abs(speed) / caps.maxSpeed);
  return clampUnit(steer) * speedFrac;
}
