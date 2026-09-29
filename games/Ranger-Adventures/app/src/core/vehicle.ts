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
 * is the single place that lives. F-32 adds two more comfort shapers, applied to the
 * JEEP ONLY (the heli reuses the raw `driveStep`): `rampSpeed` eases the speed toward
 * the throttle over ~1 s instead of snapping to the cap on frame one, and
 * `comfortSteer` scales the steer by how fast the jeep is actually moving so it can
 * never pivot in place (the audit's spin-top / doughnut), and saturates it at half
 * the turn rate: the reachable yaw rate is ~0.6 rad/s whatever steers (the player,
 * a keep-out bend, the forest edge), WITHOUT touching the frozen caps the `vehicle`
 * E2E pins (turnRate 1.2 / maxSpeed 6, halved under reduced-motion).
 *
 * Run 6 (Floris: "the car seems to slow down sometimes; it is bumped to the side by
 * animals"): full gas is full speed, steering keeps the gas (`driveIntent` reads the
 * keys as tank axes), no animal ever pushes the jeep (animals are not solids: the jeep
 * brakes for one in its path, `yieldBrake`), and the forest edge bends it along the
 * tree line (`rimSteer`, `rimFree`). `jeepStep` is the whole frame, pure, so the unit
 * tests drive the same code the World does.
 *
 * Run 6 review, round 2 (a child's joyride locked it by the ecoduct and crashed it into the
 * ven): a held or pivoting jeep answers only to its turn key (`bendGain`) and the bends
 * never swap sides frame to frame (`combineBends`, a fading `clipSteer`); buildings are
 * their real footprints (`Solid.box`); every brake looks along the arc the body really
 * sweeps (`eachTouch`) and never takes the speed away in one frame (`brakeCap`); the ven's
 * shore bends it along and stops it softly like the forest edge (`waterSteer`,
 * `wetAhead`); a dead end stops it with room to swing round (`deadEndCap`); a pivot turns
 * about whichever end keeps the body clear, and a wedged body keeps its turn
 * (`resolveBody`).
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

/** Driver intent this frame: `throttle` forward (+) / reverse (−), `steer`
 *  right (+) / left (−), each in [−1, 1] (`driveIntent` reads them off the keys and
 *  the stick). */
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
 * The steer authority never exceeds this share of the turn rate: the calm yaw cap.
 * At full caps the jeep then turns at most 0.6 rad/s (≈ 34°/s: the F-32 comfort band
 * for a motion-sensitive child; the chase camera turns with it), and 0.3 rad/s under
 * reduced motion. Until run 6 the unit-magnitude screen vector held this cap by
 * accident (Up+Right = 0.71 throttle × 0.71 steer), which is why steering cut the gas.
 */
export const STEER_AUTHORITY_MAX = 0.5;

/**
 * F-32 speed-scaled steering (JEEP only; applied before `driveStep`). Scale the raw
 * steer by how fast the jeep is ACTUALLY moving (`speed / maxSpeed`) so it can never
 * pivot in place — the spin-top / doughnut the audit caught, where a held turn key spun
 * the nose while the jeep went nowhere — and saturate it at `STEER_AUTHORITY_MAX`. The
 * turn circle is then a tight ~5 m (`maxSpeed / turnRate`) at a crawl and widens to a
 * calm ~10 m at full speed, and the yaw rate never passes `turnRate / 2` (≈ 0.6 rad/s)
 * whatever steers: full gas and full steer together stay in the F-32 comfort band.
 *
 * The SIGN follows the speed, like a real car: reversing with the wheel turned right
 * swings the tail to the right (so the nose goes left). `floor` (0..1) is the least
 * steer authority kept whatever the speed: `jeepStep` passes a small one only while the
 * jeep is pressed against something, so a child can always turn away. Pure.
 */
export function comfortSteer(steer: number, speed: number, caps: DriveCaps, floor = 0): number {
  const frac = Math.max(-1, Math.min(1, speed / caps.maxSpeed));
  let auth = Math.sign(frac) * Math.min(Math.abs(frac), STEER_AUTHORITY_MAX);
  if (Math.abs(auth) < floor) auth = frac < 0 ? -floor : floor;
  return clampUnit(steer) * auth;
}

/* ------------------------------------------------------------ drive intent -- */

/** Pushed only sideways, the jeep still rolls forward at this fraction of its top
 *  speed while it turns (audit veh-05: a stick pushed right used to STOP the jeep). */
export const STEER_CREEP = 0.35;

/** Reverse is slower than forward: a calm back-up, never a backwards dash. */
export const REVERSE_FRACTION = 0.5;

/** The stick pushed within this angle of straight up (rad, 50°) still gives full gas
 *  at its rim, so "up and a bit right" keeps the jeep at full speed while it turns. */
export const STICK_FULL_GAS = (50 * Math.PI) / 180;

/**
 * The held keys (tank axes: `fwd` Up + / Down −, `turn` Right + / Left −) and the
 * touch stick (`x` right, `y` forward, |v| ≤ 1; null when untouched) → the jeep's
 * throttle + steer. Held keys win over the stick, as on foot.
 *  - Keys are two separate axes (run 6: the fused, unit-clamped screen vector made
 *    Up + Right a 0.71 throttle, so steering with the keys cut the gas to 4.2 m/s):
 *    Up = full gas, Down = reverse (the ramp brakes first, then backs up, slower),
 *    Left / Right = full steer, and a lone turn key creeps forward while it turns
 *    (`STEER_CREEP`, audit veh-05: it used to stop the jeep).
 *  - The stick is "push where you want to go": up = gas, sideways = steer + creep,
 *    down = reverse; within `STICK_FULL_GAS` of straight up its rim keeps full gas.
 * The calm turn is `comfortSteer`'s job, not the intent's. Pure.
 */
export function driveIntent(
  keys: { turn: number; fwd: number } | null,
  stick: { x: number; y: number } | null,
): DriveInput {
  if (keys && (keys.turn !== 0 || keys.fwd !== 0)) {
    const throttle = keys.fwd > 0 ? 1 : keys.fwd < 0 ? -REVERSE_FRACTION : STEER_CREEP;
    return { throttle, steer: clampUnit(keys.turn) };
  }
  if (!stick) return { throttle: 0, steer: 0 };
  const m = Math.min(1, Math.hypot(stick.x, stick.y));
  if (m < 1e-6) return { throttle: 0, steer: 0 };
  const along = stick.y / m;               // cos of the angle from "up"
  const steer = clampUnit(stick.x / m);    // sin of it: fully sideways = full steer
  const throttle = along >= -0.2
    ? m * Math.min(1, Math.max(STEER_CREEP, along / Math.cos(STICK_FULL_GAS))) // forward half (and sideways): gas
    : -m * REVERSE_FRACTION * Math.max(STEER_CREEP, -along);                      // backward half: reverse
  return { throttle, steer };
}

/* -------------------------------------------------------------- frame time -- */

/** The longest frame a vehicle integrates (s). A stall (a tab in the background, a
 *  first-time shader compile) must never teleport a jeep or a helicopter. */
export const MAX_VEHICLE_DT = 0.1;

/** Clamp a raw frame dt into [0, MAX_VEHICLE_DT]. Pure. */
export function vehicleDt(dt: number): number {
  return dt > 0 ? Math.min(dt, MAX_VEHICLE_DT) : 0;
}

/* ------------------------------------------------------------ body contact -- */

/** A footprint that is not round (a building, a landmark): half-extents `hx`/`hz` along
 *  its own x/z, turned `rot` about +y (three's rotation.y), grown by `pad` with rounded
 *  corners — the same shape the walker keeps out of (`Obstacle.box`). */
export interface SolidBox {
  readonly hx: number;
  readonly hz: number;
  readonly rot: number;
  readonly pad: number;
}

/** A solid on the ground plane: a circle (a trunk, a bush, a person), or a building's
 *  real footprint (`box`), for which `r` is only the circle round all of it. */
export interface Solid {
  x: number;
  z: number;
  r: number;
  readonly box?: SolidBox;
  /** an invisible keep-out zone (round a mission marker, a helipad), not a thing: the body
   *  is kept out of it and eased back out, but it never blocks a turn on the spot */
  soft?: boolean;
}

/** The unit ground direction straight out of the solid at the point `solidGap` last
 *  measured (module scratch: no garbage per call). */
let gapNx = 0, gapNz = 0;

/**
 * Signed distance (m) from (px, pz) to a solid's edge (< 0 inside it), leaving the
 * direction straight out of it there in `gapNx`/`gapNz`. A building is its real
 * footprint, not the circle round it (run 6 review: the ecoduct's 11.3 m circle stood
 * 3.5 m out from its walls, an invisible wall the jeep crashed into and was pinned by).
 * Pure apart from that scratch.
 */
function solidGap(o: Solid, px: number, pz: number): number {
  const dx = px - o.x, dz = pz - o.z;
  const b = o.box;
  if (!b) {
    const d = Math.hypot(dx, dz);
    if (d > 1e-9) { gapNx = dx / d; gapNz = dz / d; } else { gapNx = 0; gapNz = 1; }
    return d - o.r;
  }
  const c = Math.cos(b.rot), s = Math.sin(b.rot);
  const lx = dx * c - dz * s, lz = dx * s + dz * c;          // its own x/z
  const qx = Math.abs(lx) - b.hx, qz = Math.abs(lz) - b.hz;
  let nx: number, nz: number, gap: number;
  if (qx > 0 || qz > 0) {                                     // outside the bare walls
    const ox = Math.max(qx, 0), oz = Math.max(qz, 0), l = Math.hypot(ox, oz);
    nx = (ox / l) * Math.sign(lx); nz = (oz / l) * Math.sign(lz);
    gap = l - b.pad;
  } else if (qx > qz) { nx = Math.sign(lx) || 1; nz = 0; gap = qx - b.pad; }
  else { nx = 0; nz = Math.sign(lz) || 1; gap = qz - b.pad; }
  gapNx = nx * c + nz * s; gapNz = -nx * s + nz * c;         // back to the world
  return gap;
}

/** One circle of a vehicle's footprint: its centre sits `along` metres up the
 *  vehicle's forward axis (+ = nose), radius `r`. */
export interface BodyCircle {
  along: number;
  r: number;
}

/** The jeep's footprint: three circles along its 3.6 × 1.9 m body (nose, middle,
 *  tail). Circles, because every solid in the world is a circle too. */
export const JEEP_BODY: readonly BodyCircle[] = [
  { along: 1.0, r: 0.9 },
  { along: 0, r: 0.95 },
  { along: -1.0, r: 0.9 },
];

/** The world limits a vehicle respects (the shape of CharacterController's MoveLimits). */
export interface BodyLimits {
  bound: number;
  blocked?: (x: number, z: number) => boolean;
  /** Whether any `blocked` ground lies within `r` of (x, z); without it, it may anywhere. */
  wetWithin?: (x: number, z: number, r: number) => boolean;
}

/** How deep (m) the body at pose (x, z, heading) sinks into the deepest solid. */
export function bodyOverlap(x: number, z: number, heading: number, body: readonly BodyCircle[], solids: readonly Solid[]): number {
  const fx = Math.sin(heading), fz = Math.cos(heading);
  let worst = 0;
  for (const c of body) {
    const cx = x + fx * c.along, cz = z + fz * c.along;
    for (const o of solids) {
      const R = o.r + c.r;
      const dx = cx - o.x, dz = cz - o.z;
      const d2 = dx * dx + dz * dz;
      if (d2 >= R * R) continue;
      const pen = o.box ? c.r - solidGap(o, cx, cz) : R - Math.sqrt(d2);
      if (pen > worst) worst = pen;
    }
  }
  return worst;
}

/** The furthest any body circle reaches from the vehicle's centre. */
export function bodyReach(body: readonly BodyCircle[]): number {
  let r = 0;
  for (const c of body) r = Math.max(r, Math.abs(c.along) + c.r);
  return r;
}

/** How deep (m) the body at pose (x, z, heading) sinks into every solid it touches,
 *  added up: squeezed between two trunks counts both (`hardOnly`: the keep-out zones left
 *  out). */
export function bodyDepth(
  x: number, z: number, heading: number, body: readonly BodyCircle[], solids: readonly Solid[], hardOnly = false,
): number {
  const fx = Math.sin(heading), fz = Math.cos(heading);
  let sum = 0;
  for (const c of body) {
    const cx = x + fx * c.along, cz = z + fz * c.along;
    for (const o of solids) {
      if (hardOnly && o.soft) continue;
      const R = o.r + c.r;
      const dx = cx - o.x, dz = cz - o.z;
      const d2 = dx * dx + dz * dz;
      if (d2 >= R * R) continue;
      const pen = o.box ? c.r - solidGap(o, cx, cz) : R - Math.sqrt(d2);
      if (pen > 0) sum += pen;
    }
  }
  return sum;
}

/** Whether any of the body's probe points (its two bumpers and every circle's centre, as
 *  `resolveBody` keeps out of the water) is `blocked`. */
export function bodyWet(x: number, z: number, heading: number, body: readonly BodyCircle[], blocked: (x: number, z: number) => boolean): boolean {
  const ax = Math.sin(heading), az = Math.cos(heading);
  let nose = 0, tail = 0;
  for (const c of body) {
    if (blocked(x + ax * c.along, z + az * c.along)) return true;
    nose = Math.max(nose, c.along + c.r); tail = Math.min(tail, c.along - c.r);
  }
  return blocked(x + ax * nose, z + az * nose) || blocked(x + ax * tail, z + az * tail);
}

/** Wedged, a turn is tried on the spot and eased this far (m) back along the body and
 *  aside, the smallest shift first. */
const WEDGE_EASE: readonly (readonly [number, number])[] = [
  [0, 0], [0.01, 0], [0, 0.02], [0, -0.02], [0.02, 0], [0.02, 0.02], [0.02, -0.02], [0, 0.04], [0, -0.04], [0.04, 0],
];

/** A keep-out zone eases a body back out of it by at least this much (m) a frame. */
const SOFT_EASE = 0.03;

/** Closer than this (m) to a solid's edge is resting against it, not pressing into it. */
const TOUCH_EPS = 1e-4;

/** Where `pushOut` left the body (module scratch). */
let pushX = 0, pushZ = 0;

/** Push the body at (x, z, heading) straight out of every solid it overlaps, a few
 *  passes (from (fromX, fromZ): the way back out of a dead-centre hit); leaves the result
 *  in `pushX`/`pushZ` and returns whether anything pushed it. */
function pushOut(
  x: number, z: number, heading: number, fromX: number, fromZ: number,
  body: readonly BodyCircle[], solids: readonly Solid[],
): boolean {
  let contact = false;
  const sx = Math.sin(heading), sz = Math.cos(heading);
  // a keep-out zone eases the body back out a little a frame (as far as it stepped in, or
  // SOFT_EASE): a jeep turned on the spot with its nose in one is never shoved out of it
  const soft = Math.max(SOFT_EASE, Math.hypot(x - fromX, z - fromZ));
  for (let pass = 0; pass < 4; pass++) {
    let pushed = false;
    for (const c of body) {
      const cx = x + sx * c.along, cz = z + sz * c.along;
      for (const o of solids) {
        const R = o.r + c.r;
        const dx = cx - o.x, dz = cz - o.z;
        const d2 = dx * dx + dz * dz;
        if (d2 >= R * R) continue;
        if (o.soft) {
          const d = Math.sqrt(d2), pen = Math.min(R - d, soft);
          if (pen <= TOUCH_EPS || d < 1e-6) continue;
          x += (dx / d) * pen; z += (dz / d) * pen;
          pushed = true;
          continue;
        }
        if (o.box) {                             // a building: out through its nearest wall
          const pen = c.r - solidGap(o, cx, cz);
          if (pen <= TOUCH_EPS) continue;
          x += gapNx * pen; z += gapNz * pen;
          pushed = true;
          continue;
        }
        const d = Math.sqrt(d2);
        if (R - d <= TOUCH_EPS) continue;        // resting against it (a float's width): no push
        let nx: number, nz: number;
        if (d > 1e-6) { nx = dx / d; nz = dz / d; }
        else { // dead centre: back out the way it came
          const mx = fromX - x, mz = fromZ - z, ml = Math.hypot(mx, mz) || 1;
          nx = mx / ml; nz = mz / ml;
        }
        x += nx * (R - d); z += nz * (R - d);
        pushed = true;
      }
    }
    if (!pushed) break;
    contact = true;
  }
  pushX = x; pushZ = z;
  return contact;
}

/**
 * Resolve one vehicle step for its whole BODY, not a point (audit veh-06: the jeep
 * was a point, so its 3.7 m body drove through trunks, the cabin and the warden).
 * From pose (fx, fz, fh) the controller wants (tx, tz, th). Every body circle is
 * pushed straight out of every solid it overlaps, so the residual motion is
 * TANGENTIAL: the jeep slides along a trunk or a wall instead of stopping dead, and
 * it never bounces. If the body is still wedged after the passes it never ends up
 * deeper in than it was (every side it touches counted): the turn alone is kept when it
 * can be, else the old pose wins. The world rim keeps the whole body inside. The
 * ven's water is a wall of its own: a step that would wet the body is pushed straight
 * back out along the shore's normal, keeping its turn and its move along the shore, so
 * a jeep nosed into the water always steers free (a narrow inlet with no clear way out
 * keeps the last dry pose). `contact` is true when a solid or the shore stopped the
 * body this step. Pure + deterministic.
 */
export function resolveBody(
  fx: number, fz: number, fh: number,
  tx: number, tz: number, th: number,
  body: readonly BodyCircle[],
  solids: readonly Solid[],
  limits: BodyLimits,
): { x: number; z: number; heading: number; contact: boolean } {
  // a turn on the spot (a held jeep pivoting on its key): about whichever point keeps the
  // body clear — its middle, else its nose or its tail staying put while the other end
  // swings — before anything has to push it (a pivot beside a trunk or the water used to
  // shove the body sideways off it frame after frame); an invisible keep-out zone never
  // blocks it (run 6 review: nosed against the fox marker's zone with a trunk behind, W+D
  // held it 2.8 s)
  if (tx === fx && tz === fz && th !== fh) {
    const lim = limits.bound - bodyReach(body);
    const before = bodyDepth(fx, fz, fh, body, solids, true);
    let nose = 0, tail = 0;
    for (const c of body) { nose = Math.max(nose, c.along + c.r); tail = Math.min(tail, c.along - c.r); }
    let bx = 0, bz = 0, best = Infinity;
    for (const end of [0, nose, tail]) {
      const cx = fx + (Math.sin(fh) - Math.sin(th)) * end, cz = fz + (Math.cos(fh) - Math.cos(th)) * end;
      if (Math.hypot(cx, cz) > lim || (limits.blocked && bodyWet(cx, cz, th, body, limits.blocked))) continue;
      const d = bodyDepth(cx, cz, th, body, solids, true);           // a keep-out zone never blocks it
      if (d < best - 1e-9) { best = d; bx = cx; bz = cz; }
      if (d === 0) break;
    }
    // clear of everything, or resting against something but swinging off it, never deeper
    if (best === 0 || best <= before) return { x: bx, z: bz, heading: th, contact: best > 0 };
  }
  let contact = pushOut(tx, tz, th, fx, fz, body, solids);
  let x = pushX, z = pushZ, h = th;
  // still wedged (squeezed between two trunks, a trunk and a zone): never deeper in than
  // it already was, counting every side it touches; if the turn alone can be kept (the
  // turn on the spot, pushed out), it is, so a turn key still swings it free (run 6
  // review: wedged in the watchtower grove, every turn was undone and W+D held it 8 s)
  if (contact) {
    const before = Math.max(0.02, bodyDepth(fx, fz, fh, body, solids));
    if (bodyDepth(x, z, h, body, solids) > before) {
      let kept = false;
      if (th !== fh) {
        // the turn on the spot, or eased back or aside a hair (out of the squeeze it nosed
        // into, off the trunk its nose and the wall its tail both touch), whichever keeps
        // the turn without sinking deeper
        const ahead = (tx - fx) * Math.sin(fh) + (tz - fz) * Math.cos(fh) >= 0 ? 1 : -1;
        const bx = -Math.sin(fh) * ahead, bz = -Math.cos(fh) * ahead, lx = -bz * ahead, lz = bx * ahead;
        for (const [back, side] of WEDGE_EASE) {
          pushOut(fx + bx * back + lx * side, fz + bz * back + lz * side, th, fx, fz, body, solids);
          if (bodyDepth(pushX, pushZ, th, body, solids) <= before) { x = pushX; z = pushZ; kept = true; break; }
        }
      }
      if (!kept) { x = fx; z = fz; h = fh; }
    }
  }
  // the world rim: the whole body stays inside
  const reach = bodyReach(body);
  const lim = limits.bound - reach;
  const rr = Math.hypot(x, z);
  if (rr > lim) { x = (x / rr) * lim; z = (z / rr) * lim; }
  // the ven: the body never enters the water; the shore is a wall it slides along
  const blocked = limits.blocked;
  if (blocked) {
    let nose = 0, tail = 0; // the bumpers: the furthest body points fore and aft
    for (const c of body) { nose = Math.max(nose, c.along + c.r); tail = Math.min(tail, c.along - c.r); }
    // the body's probe points at a pose: the two bumpers and every circle's centre
    const probes = (px: number, pz: number, ph: number, visit: (qx: number, qz: number) => boolean): boolean => {
      const ax = Math.sin(ph), az = Math.cos(ph);
      if (visit(px + ax * nose, pz + az * nose) || visit(px + ax * tail, pz + az * tail)) return true;
      for (const c of body) if (visit(px + ax * c.along, pz + az * c.along)) return true;
      return false;
    };
    const wet = (px: number, pz: number, ph: number): boolean => probes(px, pz, ph, blocked);
    if (wet(x, z, h)) {
      // Pushed straight back out of the water along the shore's normal, like a body out of a
      // trunk: the turn is kept and so is the part of the move along the shore, so a jeep
      // nosed into the water swings free with a turn key and slides along the bank (parent
      // B5 / breaker B2: the whole step used to roll back to the last dry pose, heading and
      // all, so no key but reverse ever freed it).
      const deeper = (px: number, pz: number, ph: number): boolean => solids.length > 0
        && bodyOverlap(px, pz, ph, body, solids) > Math.max(0.02, bodyOverlap(fx, fz, fh, body, solids));
      const n = shoreNormal(x, z, h, probes, blocked);
      let out = -1;
      if (n) {
        const maxPush = Math.hypot(x - fx, z - fz) + 0.3; // never further than the step came in
        let lo = 0;
        for (let d = 0.04; d <= maxPush + 1e-9; d += 0.04) {
          if (!wet(x - n.x * d, z - n.z * d, h)) { out = d; break; }
          lo = d;
        }
        if (out > 0) {
          for (let i = 0; i < 6; i++) { const m = (lo + out) / 2; if (wet(x - n.x * m, z - n.z * m, h)) lo = m; else out = m; }
          out += 0.01; // a hair of room, so the next small turn has some
          const ox = x - n.x * out, oz = z - n.z * out;
          if (wet(ox, oz, h) || deeper(ox, oz, h) || Math.hypot(ox, oz) > lim + 1e-6) out = -1; // never out past the rim
        }
      }
      if (n && out > 0) { x -= n.x * out; z -= n.z * out; }
      else {
        // no clear way out (a narrow inlet): the last dry pose along the step
        let sx2 = fx, sz2 = fz, sh = fh;
        const STEPS = 6;
        for (let i = 1; i <= STEPS; i++) {
          const f = i / STEPS;
          const px = fx + (x - fx) * f, pz = fz + (z - fz) * f, ph = fh + wrap(h - fh) * f;
          if (wet(px, pz, ph)) break;
          sx2 = px; sz2 = pz; sh = ph;
        }
        x = sx2; z = sz2; h = sh;
      }
      contact = true;
    }
  }
  return { x, z, heading: h, contact };
}

/** The unit ground-plane direction INTO the water at a body pose (the shore's normal),
 *  from a ring of samples round every wet probe point; null when it cannot tell. */
function shoreNormal(
  px: number, pz: number, ph: number,
  probes: (px: number, pz: number, ph: number, visit: (qx: number, qz: number) => boolean) => boolean,
  blocked: (x: number, z: number) => boolean,
): { x: number; z: number } | null {
  const RING = 16, RHO = 0.8;
  let sx = 0, sz = 0;
  probes(px, pz, ph, (qx, qz) => {
    if (!blocked(qx, qz)) return false;
    for (let k = 0; k < RING; k++) {
      const a = (k / RING) * Math.PI * 2, ux = Math.cos(a), uz = Math.sin(a);
      if (blocked(qx + ux * RHO, qz + uz * RHO)) { sx += ux; sz += uz; }
    }
    return false;
  });
  const l = Math.hypot(sx, sz);
  return l > 1e-6 ? { x: sx / l, z: sz / l } : null;
}

/**
 * Where the point (qx, qz) lies relative to a path that starts at (px, pz) moving along
 * the unit (ux, uz) and curving with `k` (1/m, + = to the left of the way it moves, 0 =
 * straight, as `pathCurvature` gives it): `s`, how far along the path its nearest point
 * lies (m; ≤ 0 = beside or behind the start), and `lat`, how far from the path it lies
 * (m, + = on its left). Pure.
 */
export function pathFrame(
  px: number, pz: number, ux: number, uz: number, k: number, qx: number, qz: number,
): { s: number; lat: number } {
  frameOf(px, pz, ux, uz, k, qx, qz);
  return { s: frameS, lat: frameLat };
}

/** `pathFrame` without the garbage: the answer lands in `frameS`/`frameLat`. */
let frameS = 0, frameLat = 0;
function frameOf(px: number, pz: number, ux: number, uz: number, k: number, qx: number, qz: number): void {
  const dx = qx - px, dz = qz - pz;
  const a = dx * ux + dz * uz;                  // ahead
  const b = dx * uz - dz * ux;                  // left of the way it moves
  if (Math.abs(k) < 1e-4) { frameS = a; frameLat = b; return; }
  const R = 1 / Math.abs(k);
  const bb = k > 0 ? b : -b;                    // mirror a right-hand curve onto the left
  const lat = R - Math.hypot(a, R - bb);        // + = inside the curve
  frameS = Math.atan2(a, R - bb) * R;
  frameLat = k > 0 ? lat : -lat;
}

/** Where a vehicle is after rolling `t` metres along a path from centre (x0, z0), moving
 *  along the unit (ux, uz) and curving with `k` (as `pathFrame`): its centre `rollX`,
 *  `rollZ` and the unit way it then moves `rollMx`, `rollMz` (module scratch). The body
 *  turns with the path, so a body point `a` metres ahead of the centre (along the way it
 *  moves) sits at roll + m·a. */
let rollX = 0, rollZ = 0, rollMx = 0, rollMz = 0;
function rollAlong(x0: number, z0: number, ux: number, uz: number, k: number, t: number): void {
  if (k === 0) { rollX = x0 + ux * t; rollZ = z0 + uz * t; rollMx = ux; rollMz = uz; return; }
  const c = Math.cos(k * t), sn = Math.sin(k * t);
  const a = sn / k, b = (1 - c) / k, lx = uz, lz = -ux;   // left of the way it moves
  rollX = x0 + ux * a + lx * b; rollZ = z0 + uz * a + lz * b;
  rollMx = ux * c + lx * sn; rollMz = uz * c + lz * sn;
}

/**
 * Every place along the vehicle's path (`dir` +1 forward, −1 reverse; the arc with
 * curvature `curvature` as `pathCurvature` gives it, 0 = straight along its heading) where
 * a circle of its body first touches a solid within `max` metres: `visit(t, into)` with
 * the metres rolled `t` and `into`, the share of that circle's motion that runs INTO the
 * solid there (1 = dead centre, → 0 = a brush). A circle already touching a solid it
 * slides along or leaves is a touch with `into` 0 (never a stop by itself); one that only
 * meets a solid moving along or away from it further on is none. Every body circle rides the real path (the body swings
 * round the turn: its middle cuts inside the line its nose takes), and every solid is met
 * as its real shape: the path is marched in steps never longer than the gap to it. Pure.
 */
function eachTouch(
  x: number, z: number, heading: number, dir: 1 | -1, curvature: number,
  body: readonly BodyCircle[], solids: readonly Solid[], max: number,
  visit: (t: number, into: number, nx: number, nz: number) => void,
): void {
  const ux = Math.sin(heading) * dir, uz = Math.cos(heading) * dir;
  const k = Math.abs(curvature) < 1e-4 ? 0 : curvature;
  let half = 0, reach = 0;
  for (const c of body) { half = Math.max(half, c.r); reach = Math.max(reach, Math.abs(c.along) + c.r); }
  const band = half + reach * reach * Math.abs(k) * 0.5 + 0.05; // the nose and tail swing a little wide
  for (const o of solids) {
    const far = max + reach + o.r, ox = o.x - x, oz = o.z - z;
    if (ox * ox + oz * oz > far * far) continue;         // out of reach of the whole look
    frameOf(x, z, ux, uz, k, o.x, o.z);
    if (Math.abs(frameLat) >= o.r + band || frameS <= -(o.r + reach) || frameS >= max + o.r + reach) continue;
    for (const c of body) {
      const a = c.along * dir;                          // this circle's place ahead of the centre
      let t = 0;
      for (let i = 0; i < 40 && t <= max; i++) {
        rollAlong(x, z, ux, uz, k, t);
        const g = solidGap(o, rollX + rollMx * a, rollZ + rollMz * a) - c.r;
        if (g <= 0.003) {
          // the way this circle moves there: along the path, plus its swing round the turn
          const vx = rollMx + a * k * rollMz, vz = rollMz - a * k * rollMx;
          const into = -(gapNx * vx + gapNz * vz) / Math.hypot(vx, vz);
          // pressing in: a touch; already touching and sliding along it: a touch it will
          // not stop for (into 0), but one a squeeze can be made of
          if (into > 0 || t === 0) visit(t, Math.min(1, Math.max(0, into)), gapNx, gapNz);
          break;
        }
        t += Math.max(g * 0.95, 0.005);
      }
    }
  }
}

/**
 * How far (m) the vehicle can roll along its path (as `eachTouch`) before its body first
 * touches a solid (`free`; `max` when nothing is in the way), and how squarely it would
 * meet it there (`headOn`: 1 = dead centre, → 0 = a brush along its side). Pure.
 */
export function impactAhead(
  x: number, z: number, heading: number, dir: 1 | -1,
  body: readonly BodyCircle[], solids: readonly Solid[], max: number, curvature = 0,
): { free: number; headOn: number } {
  let best = max, headOn = 0;
  eachTouch(x, z, heading, dir, curvature, body, solids, max, (t, into) => {
    if (into > 0 && (t < best || (t === best && into > headOn))) { best = t; headOn = into; }
  });
  return { free: Math.max(0, best), headOn };
}

/** How far (m) the vehicle can travel straight along its heading before its leading
 *  body circle touches a solid; `max` when nothing is in the way (`impactAhead`). Pure. */
export function freeDistance(
  x: number, z: number, heading: number, dir: 1 | -1,
  body: readonly BodyCircle[], solids: readonly Solid[], max: number,
): number {
  return impactAhead(x, z, heading, dir, body, solids, max).free;
}

/** The slowest the jeep rolls while it is pressed against something (m/s): enough
 *  to slide along a trunk, far too slow to feel like a crash. */
export const CONTACT_CREEP = 0.8;

/** Met more squarely than this (`impactAhead`'s `headOn`) a solid is driven AT, not
 *  brushed: the jeep comes to rest in front of it instead of sliding along it. */
export const SQUARE_HIT = 0.85;

/** The firmest a brake eases the jeep down (m/s²) when something comes into view too
 *  close for its gentle stop; closer still, it brakes only as hard as it must. */
export const FIRM_DECEL = 8;

/**
 * The speed (m/s) a brake allows this frame with `free` metres to what it stops for,
 * rolling at `now` m/s over the frame `dt`: the gentle stop `gap` metres short at `decel`
 * m/s² (√(2·decel·(free − gap))), or — with an `end` speed it may still have when it gets
 * there (a trunk it only brushes) — the gentle slow-down to that speed. Already faster
 * than that (the thing came into view close: an animal stepping out, a trunk the turn
 * swings toward), it does not drop to that speed in one frame: it brakes steadily, as
 * gently as still gets it there, at most `FIRM_DECEL`; closer still, exactly as hard as
 * gets it there `hardGap` short. No brake ever takes its speed away in a single frame
 * unless it is about to touch. Without `now`/`dt`, the gentle profile alone. Pure.
 */
export function brakeCap(free: number, gap: number, decel: number, now = 0, dt = 0, hardGap = gap, end = 0): number {
  const room = free - gap;
  const e2 = end * end;
  const gentle = Math.sqrt(e2 + 2 * decel * Math.max(0, room));
  const v = Math.abs(now);
  if (v <= gentle || !(dt > 0)) return gentle;
  let a = room > 1e-6 ? (v * v - e2) / (2 * room) : Infinity;   // steady, arriving right at the gap
  // a real brush (arriving at `end` or a little faster only brushes a little harder):
  // braked as the room needs, but never harder than firmly
  if (end >= CONTACT_CREEP) return Math.max(gentle, v - Math.min(Math.max(decel, a), FIRM_DECEL) * dt);
  if (a > FIRM_DECEL) {                                           // too close for a firm brake there
    const hard = free - hardGap;
    a = hard > 1e-6 ? Math.max(FIRM_DECEL, (v * v - e2) / (2 * hard)) : Infinity;
  }
  return Math.max(gentle, v - a * dt);
}

/**
 * The speed (m/s) the jeep may still have with `free` metres to the nearest solid
 * ahead, met `headOn` squarely (`impactAhead`; 1 = dead centre): braking at `decel`
 * m/s² it comes to rest right at the solid (v = √(2·a·d)), but it may still brush it
 * gently — the part of its speed that runs into the solid stays at the creep
 * (`CONTACT_CREEP / headOn²`: it slows only to that) — so a clipped trunk costs almost
 * nothing (run 6: every brush braked it to a 0.8 m/s crawl, then ground it along the
 * bark). Met squarely (fading in from `SQUARE_HIT`) there is nothing to slide along: it
 * simply stops in front of it, without the last creep into the bark. From `now` over
 * `dt` it never drops in one frame (`brakeCap`). Pure.
 */
export function contactSpeedCap(free: number, decel: number, headOn = 1, now = 0, dt = 0): number {
  const brush = Math.max(0, Math.min(1, (1 - headOn) / (1 - SQUARE_HIT)));
  const end = headOn > 1e-6 ? (CONTACT_CREEP / (headOn * headOn)) * brush : Infinity;
  if (!Number.isFinite(end)) return Infinity;
  return brakeCap(free, 0.1, decel, now, dt, 0.02, end);
}

/**
 * The jeep's brake for solids (trunks, buildings, props, people): of every touch ahead on
 * the path it is about to drive (`eachTouch`), the one that needs the lowest speed now
 * (`contactSpeedCap`: a soft stop in front of one it meets squarely, a gentle brush past
 * one it clips), rolling at `now` over `dt`, braking at `decel`: `cap` (Infinity when
 * nothing binds) with that touch's `free` and `headOn`. Not simply the first touch: its
 * nose may only graze a trunk that its middle, swinging round the turn, then meets
 * squarely (run 6 review: the brake let it on at full speed and it crashed from 3.8 m/s).
 * It looks as far as a stop from its top speed `vmax` needs. Pure.
 */
export function solidBrake(
  x: number, z: number, heading: number, dir: 1 | -1, curvature: number,
  body: readonly BodyCircle[], solids: readonly Solid[], decel: number, vmax: number, now = 0, dt = 0,
): { cap: number; free: number; headOn: number } {
  const look = (Math.max(vmax, Math.abs(now)) ** 2) / (2 * decel) + 1;
  const touches = touchBuf;
  touches.length = 0;
  eachTouch(x, z, heading, dir, curvature, body, solids, look, (t, into, nx, nz) => {
    if (touches.length < 24) touches.push(t, into, nx, nz);
  });
  let cap = Infinity, free = look, headOn = 0;
  for (let i = 0; i < touches.length; i += 4) {
    const t = touches[i], into = touches[i + 1];
    let c = contactSpeedCap(t, decel, into, now, dt);
    // pushed off this one straight into another on its other side: a gap too narrow for
    // it (two trunks, a trunk and a zone) — it stops well short of the squeeze, never
    // wedges itself in (its path along the first is only roughly the arc it looked along)
    for (let j = 0; j < touches.length; j += 4) {
      if (touches[i + 2] * touches[j + 2] + touches[i + 3] * touches[j + 3] < -SQUEEZE_DOT) {
        c = Math.min(c, brakeCap(Math.max(t, touches[j]), SQUEEZE_GAP, decel, now, dt, 0.1));
      }
    }
    if (c < cap) { cap = c; free = t; headOn = into; }
  }
  return { cap, free, headOn };
}
/** Two touches whose walls face each other more than this (−cos of the angle between
 *  their normals) squeeze the jeep between them… */
const SQUEEZE_DOT = 0.3;
/** …and it stops this far (m) short of where the second would squeeze it. */
const SQUEEZE_GAP = 0.8;
const touchBuf: number[] = [];

/** A solid it would only clip (met less squarely than `SQUARE_HIT`), the jeep steers
 *  round: from `CLIP_LOOK_S` before it gets there, aiming to pass `CLIP_MARGIN` (m) off
 *  it with its widest body circle. */
export const CLIP_LOOK_S = 2;
export const CLIP_MARGIN = 0.3;
/** The bend fades in over this many metres of offset beside the line where a solid is met
 *  squarely, and over the last quarter of its look ahead: never an on/off switch. */
export const CLIP_FADE = 0.3;
/** However close the solid, the bend is worked out as if it were this far ahead (m): a
 *  bend that is already too late only brushes it, it never wrenches the wheel. */
export const CLIP_NEAR = 1;

/**
 * Brushing a bush or a trunk with its corner, the jeep would be pushed sideways along it
 * (run 6: the juniper beside the helipad nudged it 1-2 m/s sideways for a moment). A
 * driver moves over a little instead: for each small round solid ahead on the path it
 * drives (the arc with curvature `curvature`, as `pathFrame`) that its body would clip
 * or pass closer than `CLIP_MARGIN` (driving forward), the steer (right +) of the gentle,
 * steady turn that shifts its line clear by the time it is alongside, as a share of the
 * turn it can make at this speed; the strongest each way, summed (a gap between two
 * trunks: it drives through the middle). A solid it would meet squarely gets no bend: it
 * brakes to a soft stop in front of it instead (`contactSpeedCap`). A building or a
 * landmark (`Solid.box`) is no trunk to ease past: its circle is only an outer bound.
 * Every edge fades (`CLIP_FADE`), so the bend never switches on and off frame by frame
 * (run 6 review: at its hard edges it flipped between 0.2 and 1 and pinned the jeep).
 * Pure.
 */
export function clipSteer(
  x: number, z: number, heading: number, speed: number,
  solids: readonly Solid[], body: readonly BodyCircle[], caps: DriveCaps, curvature = 0,
): number {
  const v = Math.max(1, Math.abs(speed));
  const look = CLIP_LOOK_S * v;
  const can = Math.min(v / caps.maxSpeed, STEER_AUTHORITY_MAX) * caps.turnRate;
  let lead = body[0], half = 0;
  for (const c of body) { if (c.along > lead.along) lead = c; half = Math.max(half, c.r); }
  const fx = Math.sin(heading), fz = Math.cos(heading);
  const square = Math.sqrt(1 - SQUARE_HIT * SQUARE_HIT);   // within this share of the reach: met squarely
  let right = 0, left = 0;
  const far0 = lead.along + look + half + CLIP_MARGIN;
  for (const o of solids) {
    const far = far0 + 2 * o.r, ox = o.x - x, oz = o.z - z;
    if (ox * ox + oz * oz > far * far) continue;           // out of reach of the look
    if (o.box) {
      const u = wallClip(x, z, fx, fz, curvature, o, lead.along, half, v, look, can);
      if (u > 0) right = Math.max(right, u); else left = Math.max(left, -u);
      continue;
    }
    frameOf(x, z, fx, fz, curvature, o.x, o.z);            // off the line its centre drives
    const s = frameS - lead.along;                         // ahead of its nose circle
    if (s <= 0) continue;
    const reach = o.r + half;                              // its side touches the solid at this offset
    const off = Math.abs(frameLat);
    const need = reach + CLIP_MARGIN - off;                // how far its line must move over
    const d = s - reach;                                   // metres until it is alongside
    if (need <= 0 || d >= look) continue;
    const dd = Math.max(CLIP_NEAR, d);
    const yaw = (2 * need * v) / (dd * dd);                // the steady turn that clears it
    const u = Math.min(1, yaw / can)
      * Math.min(1, Math.max(0, (off - (o.r + lead.r) * square) / CLIP_FADE)) // met squarely: none
      * Math.min(1, (look - d) / (0.25 * look))                              // far ahead: fading in
      * Math.min(1, s / reach);                                               // alongside: done
    if (frameLat >= 0) right = Math.max(right, u);        // it stands to the left: steer right (+)
    else left = Math.max(left, u);
  }
  return right - left;
}

/**
 * `clipSteer` for a building's wall (a `Solid.box`, its real footprint): along the path
 * its centre drives (from (x, z) along (fx, fz), curving `k`), where does its widest side
 * pass the wall closest, and how far ahead of its nose (`lead`) is that? Closer than
 * `CLIP_MARGIN`, the steady turn away from the wall that moves its line clear by then, as
 * a share of the turn it can make (`can` at speed `v`), fading in over the look ahead; a
 * wall it would drive at squarely (fading out from `SQUARE_HIT`) gets none, it brakes to
 * a soft stop instead. Running along a wall too close, it eases off it. Signed: right +.
 */
function wallClip(
  x: number, z: number, fx: number, fz: number, k: number, o: Solid,
  lead: number, half: number, v: number, look: number, can: number,
): number {
  let best = Infinity, at = 0, side = 0, into = 0;
  for (let t = 0; t <= lead + look + 1e-9; t += 0.5) {
    rollAlong(x, z, fx, fz, k, t);
    const g = solidGap(o, rollX, rollZ) - half;
    if (g < best) {
      best = g; at = t;
      side = gapNx * rollMz - gapNz * rollMx > 0 ? -1 : 1; // the wall on its right: steer left (−)
      into = -(gapNx * rollMx + gapNz * rollMz);           // how squarely it drives at the wall there
    }
    if (g < -0.5) break;                                   // it drives into the wall: that is the place
  }
  const need = CLIP_MARGIN - best;
  if (need <= 0) return 0;
  const d = Math.max(0, at - lead);                        // metres ahead of its nose
  const dd = Math.max(CLIP_NEAR, d);
  const u = Math.min(1, (2 * Math.min(need, 1) * v) / (dd * dd) / can)
    * Math.min(1, Math.max(0, (SQUARE_HIT - into) / 0.15))  // met squarely: no bend, a soft stop
    * Math.min(1, Math.max(0, (look - d) / (0.25 * look))); // far ahead: fading in
  return side * u;
}

/* ---------------------------------------------------------- keep-out zones -- */

/** From this long before its nose would reach a keep-out zone in its path (s) the jeep
 *  starts to bend round it, and from `KEEP_OUT_FULL_S` on the bend is a full turn of
 *  the wheel: 9 m and 4 m at top speed, which with the speed-scaled steer (a ~5 m
 *  turning circle) clears a zone met head-on. Timed, not measured: a jeep creeping at
 *  a child's sideways push is not steered off a zone still seconds away. */
export const KEEP_OUT_LOOK_S = 2;
export const KEEP_OUT_FULL_S = 1.3;
/** A path this far (rad) or more inside a zone's edge gets the full bend; less, less. */
export const KEEP_OUT_TURN = 0.2;
/** The bend aims to pass this far (m) outside a zone's edge, so the whole body (not
 *  only the nose's line) stays off it while the jeep turns. */
export const KEEP_OUT_MARGIN = 0.5;

/**
 * A keep-out zone (the ground round a mission marker, a helipad) is not a wall: it is
 * an empty patch of ground a child cannot see, so the jeep must never stop dead at its
 * edge (verifier V2: steered at a ree behind the stuifzand marker it sat pressed
 * against the invisible zone for 30 s). Instead the jeep bends round it, like a driver
 * keeping off a lawn: when zones lie in its path within `KEEP_OUT_LOOK_S` of its
 * `speed` (m/s), this returns the steer (right +, in [−1, 1]) that turns it away,
 * growing to a full turn by `KEEP_OUT_FULL_S` (and with how far the path points inside
 * the zone's edge: `KEEP_OUT_TURN`); 0 when the path is clear.
 *
 * Seen from the nose each zone blocks a sector of directions. The sectors that overlap
 * the heading are merged — two markers close together block as ONE patch, so the jeep
 * never swings from one into the notch between them and pins itself there — and it
 * turns toward the nearer edge of that patch (met dead centre: the way the player
 * steers, right by default). Forward driving only (the World brakes for a zone behind
 * a reversing jeep). `caps` = the caps in force (reduced motion looks further). Pure.
 */
export function keepOutSteer(
  x: number, z: number, heading: number, speed: number,
  zones: readonly Solid[], body: readonly BodyCircle[], bias = 0, caps: DriveCaps = JEEP_CAPS,
): number {
  // timed at the full caps' pace: under reduced motion the jeep turns half as fast at
  // half the speed (the same wide circle), so it must start its bend as far out
  const v = Math.max(1, Math.abs(speed)) * (JEEP_CAPS.turnRate / caps.turnRate);
  const look = KEEP_OUT_LOOK_S * v, full = KEEP_OUT_FULL_S * v;
  let lead = body[0], half = 0;
  for (const c of body) { if (c.along > lead.along) lead = c; half = Math.max(half, c.r); }
  const fx = Math.sin(heading), fz = Math.cos(heading);
  const lx = fz, lz = -fx;                              // left-of-forward
  const nx = x + fx * lead.along, nz = z + fz * lead.along;
  const sectors: { lo: number; hi: number; u: number }[] = [];
  for (const o of zones) {
    const dx = o.x - nx, dz = o.z - nz;
    const dist = Math.hypot(dx, dz), R = o.r + half + KEEP_OUT_MARGIN;
    const u = Math.max(0, Math.min(1, (look - (dist - R)) / (look - full)));
    if (u <= 0) continue;
    const rel = Math.atan2(dx * lx + dz * lz, dx * fx + dz * fz); // its bearing, left +
    const spread = dist > R ? Math.asin(R / dist) : Math.PI / 2;  // touching: a whole half-plane
    sectors.push({ lo: rel - spread, hi: rel + spread, u });
  }
  // grow the blocked patch from the heading outward through every overlapping sector
  let lo = 0, hi = 0, u = 0, grew = true;
  while (grew) {
    grew = false;
    for (const s of sectors) {
      if (s.u < 0 || s.lo > hi || s.hi < lo) continue;
      if (s.lo < lo) lo = s.lo;
      if (s.hi > hi) hi = s.hi;
      u = Math.max(u, s.u);
      s.u = -1;                                         // merged
      grew = true;
    }
  }
  if (u <= 0) return 0;
  const toLeft = hi, toRight = -lo;                     // how far to turn to either edge
  const side = Math.abs(toLeft - toRight) > 0.05 ? (toLeft < toRight ? -1 : 1) : (bias < 0 ? -1 : 1);
  // as strong as the turn it takes: a path that only grazes a zone gets a nudge, not a
  // full lock (a slow jeep turning at a child's push kept its turn)
  const need = Math.min(1, Math.min(toLeft, toRight) / KEEP_OUT_TURN);
  return side * u * need;                               // left edge nearer → steer left (−)
}

/** The player's steer with the keep-out bend folded in: a steer the same way as the
 *  bend adds to it; one into the zone gives way as the zone nears (at a full bend
 *  the zone wins). No bend → the player's steer untouched. Pure. */
export function guidedSteer(player: number, avoid: number): number {
  if (avoid === 0) return clampUnit(player);
  if (Math.sign(player) === Math.sign(avoid)) return Math.sign(avoid) * Math.max(Math.abs(player), Math.abs(avoid));
  return clampUnit(avoid + player * (1 - Math.abs(avoid)));
}

/**
 * Several bends at once (a keep-out zone, the forest edge, the shore, a clipped trunk):
 * the strongest each way, summed. Bends that agree never add up past the strongest; two
 * that disagree meet in the middle, so the player's own steer (`guidedSteer`) decides
 * between them. Continuous in every bend: the steer never swaps sides from one frame to
 * the next (run 6 review: "the strongest wins" swapped between the forest edge and the
 * ecoduct every frame and held the jeep for 27 s). Pure.
 */
export function combineBends(a: number, b = 0, c = 0, d = 0): number {
  const right = Math.max(0, a, b, c, d), left = Math.min(0, a, b, c, d);
  return clampUnit(right + left);
}

/**
 * How much the bends steer (0..1): only a jeep that really rolls forward is bent. They
 * fade in from a sixth of its top speed (1 m/s at full caps) and act fully from a third
 * (2 m/s). Held by a brake, pivoting on a turn key or creeping, the player's key alone
 * turns it: a bend acting on a standing jeep can only fight the key (run 6 review: at the
 * forest edge by the ecoduct W, W+A and W+D all left it locked). Pure.
 */
export function bendGain(speed: number, caps: DriveCaps): number {
  const f = Math.abs(speed) / caps.maxSpeed;
  return Math.max(0, Math.min(1, (f - 1 / 6) * 6));
}

/* ------------------------------------------------------ animals: give way -- */

/** A roaming animal as the jeep sees it: never a solid it pushes or is pushed by
 *  (run 6: an animal walking into the jeep's side shoved the whole jeep sideways),
 *  only something it gives way to. `r` = the radius of its footprint (m). */
export interface YieldAnimal {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly r: number;
}

/** How gently the jeep brakes for an animal in its path (m/s²): 6 → 0 m/s in 2 s. */
export const YIELD_DECEL = 3;
/** It stops this far (m) short of an animal that stays in its path. */
export const YIELD_GAP = 1;
/** An animal this close (m) beside the jeep's swept body counts as in its path. */
export const YIELD_MARGIN = 0.4;
/** How far ahead (m, along its path) the jeep looks for animals. */
export const YIELD_LOOK = 30;
/** An animal that steps into the path close ahead: the jeep still stops this far (m)
 *  short of it, braking steadily (`brakeCap`), never in one frame. */
export const YIELD_HARD_GAP = 0.8;

/**
 * The speed (m/s) the jeep may have this frame with `free` metres to the animal in its
 * path, rolling at `now` m/s over the frame `dt`: the gentle stop `YIELD_GAP` short of it
 * at `YIELD_DECEL` (√(2·a·(free − gap))); if the animal steps into the path closer than
 * that stop needs, a steady firmer brake (`brakeCap`: at most `FIRM_DECEL`, or as hard as
 * still stops it `YIELD_HARD_GAP` short), so a deer stepping out close ahead never makes
 * the jeep drop its speed in a single frame (run 6 review: an absolute cap took 6.00 →
 * 4.81 m/s in 16 ms), and it never touches it. Pure.
 */
export function yieldSpeed(free: number, now = 0, dt = 0): number {
  return brakeCap(free, YIELD_GAP, YIELD_DECEL, now, dt, YIELD_HARD_GAP);
}

/**
 * The curvature (1/m, + = curving to the left of the way it moves) of the path the
 * jeep drives with this steer at this speed (the same `comfortSteer` authority, with the
 * same `floor`), so the brakes look along the arc the jeep will really take. `dir` = the
 * way it moves (+1 forward, −1 reverse), used when it stands still. Pure.
 */
export function pathCurvature(steer: number, speed: number, dir: 1 | -1, caps: DriveCaps, floor = 0): number {
  const v = Math.max(Math.abs(speed), 1e-3);
  const auth = Math.max(Math.min(v / caps.maxSpeed, STEER_AUTHORITY_MAX), floor);
  return (-clampUnit(steer) * dir * auth * caps.turnRate) / v;
}

/**
 * Give way to animals (run 6). Looks along the jeep's swept path — the arc its lead
 * body circle drives with curvature `curvature` (`pathCurvature`), in the direction it
 * moves (`dir`) — for animals whose footprint comes within `YIELD_MARGIN` of the body
 * (half-width = the widest body circle + the animal's radius + the margin), and
 * returns the first one's `id`, the `free` distance (m) the jeep can still roll before
 * its body would touch it, and the speed `cap` (m/s) that brakes it to a soft stop
 * `YIELD_GAP` short of it (`yieldSpeed`, from the speed `now` over the frame `dt`),
 * `Infinity` when the path is clear. An animal beside the path, or behind the way it
 * moves, changes nothing; the ramp resumes the moment the path clears. Pure.
 */
export function yieldBrake(
  x: number, z: number, heading: number, dir: 1 | -1, curvature: number,
  body: readonly BodyCircle[], animals: readonly YieldAnimal[], now = 0, dt = 0,
): { id: string | null; free: number; cap: number } {
  let lead = body[0], half = 0;
  for (const c of body) { if (c.along * dir > lead.along * dir) lead = c; half = Math.max(half, c.r); }
  const ux = Math.sin(heading) * dir, uz = Math.cos(heading) * dir; // the way it moves
  let free = Infinity, id: string | null = null;
  for (const an of animals) {
    frameOf(x, z, ux, uz, curvature, an.x, an.z);                   // off the line its centre drives
    const s = frameS - lead.along * dir, lat = Math.abs(frameLat);  // ahead of its lead circle
    if (s <= 0 || s > YIELD_LOOK || lat >= half + an.r + YIELD_MARGIN) continue;
    const touch = lead.r + an.r;
    const d = s - (lat < touch ? Math.sqrt(touch * touch - lat * lat) : 0);
    if (d < free) { free = d; id = an.id; }
  }
  const cap = id === null ? Infinity : yieldSpeed(free, now, dt);
  return { id, free: Math.max(0, free), cap };
}

/* ------------------------------------------------------- the forest edge -- */

/** The jeep brakes for the forest edge ahead as gently as for an animal (m/s²)… */
export const RIM_DECEL = 3;
/** …and stops this far (m) short of it, head-on: never pressed against it. */
export const RIM_GAP = 0.5;
/** Within this distance (m) of the edge, heading outward, the jeep bends along it… */
export const RIM_BAND = 10;
/** …and from this distance (m) on, the bend is a full turn of the wheel. */
export const RIM_FULL = 5;
/** A heading this far (rad) or more out of line with the edge gets the full bend. */
export const RIM_TURN = 0.35;
/** Closer than this (m) the bend also keeps a heading along the edge turning a little
 *  inward (`RIM_KEEP_TILT` rad per metre), so it rolls along the tree line, never on it. */
export const RIM_KEEP = 2;
export const RIM_KEEP_TILT = 0.15;
/** Driven at the edge nearly head-on (more than `RIM_HEAD_ON_FROM` rad out of line,
 *  fading to nothing at `RIM_HEAD_ON_TO`) it does not bend but stops. */
export const RIM_HEAD_ON_FROM = (60 * Math.PI) / 180;
export const RIM_HEAD_ON_TO = (75 * Math.PI) / 180;

/**
 * How far (m) the jeep's centre can travel straight along its heading (`dir` +1
 * forward, −1 reverse) before it reaches `lim`, the radius its centre may not pass
 * (the move bound less the body's reach): the chord to the forest edge. 0 when it
 * already presses on the edge, `Infinity` when it points inward from there. Pure.
 */
export function rimFree(x: number, z: number, heading: number, dir: 1 | -1, lim: number): number {
  const ux = Math.sin(heading) * dir, uz = Math.cos(heading) * dir;
  const pu = x * ux + z * uz;
  const c = x * x + z * z - lim * lim;
  if (c >= 0) return pu > 0 ? 0 : Infinity;
  return -pu + Math.sqrt(pu * pu - c);
}

/** Met too close for the gentle stop, the jeep still stops this far (m) short of the
 *  forest edge or the water (`brakeCap`). */
export const EDGE_HARD_GAP = 0.1;

/** The speed (m/s) that stops the jeep `RIM_GAP` short of the forest edge `free` metres
 *  ahead (`rimFree`), braking at `RIM_DECEL` (from `now` over `dt`: never in one frame,
 *  `brakeCap`): no crawl, no grind. Pure. */
export function rimSpeedCap(free: number, now = 0, dt = 0): number {
  return brakeCap(free, RIM_GAP, RIM_DECEL, now, dt, EDGE_HARD_GAP);
}

/**
 * The forest edge is not a wall to grind along (run 6: pressed against the world rim
 * the jeep skated sideways along it, then ground on at 0.1 m/s). Like a keep-out zone
 * it bends the jeep: heading outward within `RIM_BAND` of `lim` (see `rimFree`), this
 * returns the steer (right +) that turns it along the tree line, the nearer way (met
 * dead on: the way the player steers, right by default), growing to a full turn at
 * `RIM_FULL` and with how far out of line it heads (`RIM_TURN`). Met nearly head-on
 * it does not bend (`RIM_HEAD_ON_FROM`/`_TO`): `rimSpeedCap` brings it to a clean stop
 * there and the player turns away. Forward driving only. Pure.
 */
export function rimSteer(x: number, z: number, heading: number, lim: number, bias = 0): number {
  const r = Math.hypot(x, z);
  const d = lim - r;
  if (r < 1e-6 || d >= RIM_BAND) return 0;
  const ox = x / r, oz = z / r;                          // straight out
  const fx = Math.sin(heading), fz = Math.cos(heading);
  const theta = Math.asin(Math.max(-1, Math.min(1, fx * ox + fz * oz))); // out of line with the edge (+ = outward)
  const want = theta + Math.max(0, RIM_KEEP - d) * RIM_KEEP_TILT;
  if (want <= 0) return 0;
  const headOn = Math.max(0, Math.min(1, (RIM_HEAD_ON_TO - theta) / (RIM_HEAD_ON_TO - RIM_HEAD_ON_FROM)));
  if (headOn <= 0) return 0;
  const u = Math.max(0, Math.min(1, (RIM_BAND - d) / (RIM_BAND - RIM_FULL)));
  const outLeft = fz * ox - fx * oz;                     // > 0: straight out lies to its left
  const side = Math.abs(outLeft) > 0.02 ? (outLeft > 0 ? 1 : -1) : (bias < 0 ? -1 : 1);
  return side * u * headOn * Math.min(1, want / RIM_TURN);
}

/* ---------------------------------------------------------------- the ven -- */

/** The jeep brakes for the ven's water ahead as gently as for the forest edge (`RIM_DECEL`)
 *  and stops this far (m) short of it with its bumper… */
export const WATER_GAP = 0.5;
/** …looking this far (m) ahead along its path, in steps of `WATER_STEP` (m). */
export const WATER_LOOK = 16;
export const WATER_STEP = 0.5;
/** What the jeep sees of the water ahead: `free`, how far (m) its leading bumper can roll
 *  along its path before it would wet (`WATER_LOOK` or more: dry that far), the shore's
 *  normal there (`nx`, `nz`: the unit ground direction INTO the water; 0, 0 when dry) and
 *  the way the path runs when it gets there (`mx`, `mz`). */
export interface ShoreAhead {
  free: number;
  nx: number;
  nz: number;
  mx: number;
  mz: number;
}

/**
 * How far the vehicle's leading bumper (the body's furthest point the way it moves, `dir`)
 * can travel along its path (the arc with curvature `curvature`, 0 = straight) before it
 * reaches the water (`blocked`, the same test `resolveBody` keeps the body out of), and
 * the shore's normal there (with a `margin`, water that close beside the bumper counts
 * too, growing to the full margin over the first 2 m). Marches the path `WATER_STEP` at a time up to `max`, then pins the shore to about a
 * centimetre; far from the ven `blocked` answers at once, so it is
 * cheap. Pure.
 */
export function wetAhead(
  x: number, z: number, heading: number, dir: 1 | -1, curvature: number,
  body: readonly BodyCircle[], blocked: (x: number, z: number) => boolean, max = WATER_LOOK, margin = 0,
): ShoreAhead {
  let tip = 0;                                             // its bumper, ahead of the centre
  for (const c of body) tip = Math.max(tip, c.along * dir + c.r);
  const ux = Math.sin(heading) * dir, uz = Math.cos(heading) * dir; // the way it moves
  const k = Math.abs(curvature) < 1e-4 ? 0 : curvature;
  let qx = 0, qz = 0;                                      // the bumper after t metres of path
  const wetAt = (t: number): boolean => {
    rollAlong(x, z, ux, uz, k, t);
    qx = rollX + rollMx * tip; qz = rollZ + rollMz * tip;
    if (blocked(qx, qz)) return true;
    const m = margin * Math.min(1, t / 2);                 // where it is now counts as dry
    return m > 0 && (blocked(qx + rollMz * m, qz - rollMx * m) || blocked(qx - rollMz * m, qz + rollMx * m));
  };
  let lo = -1, hi = -1;
  if (wetAt(0)) { lo = 0; hi = 0; }
  else {
    for (let t = WATER_STEP; t <= max + 1e-9; t += WATER_STEP) {
      if (wetAt(t)) { lo = t - WATER_STEP; hi = t; break; }
    }
    if (hi < 0) return { free: max, nx: 0, nz: 0, mx: ux, mz: uz };
    for (let i = 0; i < 6; i++) { const m = (lo + hi) / 2; if (wetAt(m)) hi = m; else lo = m; }
  }
  // the shore's normal: the wet side of a ring round the first wet point
  wetAt(hi);
  const mx = rollMx, mz = rollMz;
  const RING = 16, RHO = 0.8;
  let sx = 0, sz = 0;
  for (let i = 0; i < RING; i++) {
    const a = (i / RING) * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a);
    if (blocked(qx + cx * RHO, qz + cz * RHO)) { sx += cx; sz += cz; }
  }
  const l = Math.hypot(sx, sz);
  return l > 1e-6 ? { free: lo, nx: sx / l, nz: sz / l, mx, mz } : { free: lo, nx: mx, nz: mz, mx, mz };
}

/** The bend keeps the path the player's key asks for dry this far (m) past the room the
 *  jeep needs to stop in… */
export const WATER_CLEAR = 0.5;
/** …and this far (m) from the water beside its bumper, so it never skims the shore. */
export const WATER_SIDE = 0.4;

/**
 * The ven's shore bends the jeep along it like the forest edge (run 6 review: nosed at the
 * pond it stopped dead from 6 m/s in one frame, then ground along the bank; turned toward
 * it at speed it crashed). When the path the steer `from` would drive (`wetAhead` along its
 * arc) reaches the water sooner than the jeep can stop (`RIM_DECEL`, `WATER_GAP`,
 * `WATER_CLEAR`, `WATER_SIDE`; the arc as `pathCurvature` with `floor`), this returns the gentlest steer — the least change from `from`, turning
 * away from the water — that keeps the path dry that long; otherwise `from` itself. So a
 * key held toward the pond at speed rolls it along the bank instead, and a jeep running
 * along the shore is never braked for it. The water is the one bend that is a limit, not a
 * preference: it is applied last, to the steer the player's key and the other bends already
 * made. Met nearly head-on on its heading (`RIM_HEAD_ON_FROM`/`_TO`, measured on the
 * shore's normal) it does not bend: the water brake stops it `WATER_GAP` short and the
 * player's turn key takes it away. Forward driving only. Pure.
 */
export function waterSteer(
  x: number, z: number, heading: number, speed: number, from: number,
  body: readonly BodyCircle[], blocked: (x: number, z: number) => boolean, caps: DriveCaps, floor = 0,
): number {
  const v = Math.max(1, Math.abs(speed));
  const need = (v * v) / (2 * RIM_DECEL) + WATER_GAP + WATER_CLEAR;
  const look = Math.min(WATER_LOOK, need + 1);
  const dry = (steer: number): number =>
    wetAhead(x, z, heading, 1, pathCurvature(steer, speed, 1, caps, floor), body, blocked, look, WATER_SIDE).free;
  const p = clampUnit(from);
  if (dry(p) >= need) return p;                                // its own path stays dry
  // met square on its heading: no bend, the brake stops it
  const ahead = wetAhead(x, z, heading, 1, 0, body, blocked, look);
  let fade = 1;
  if (ahead.free < look) {
    const into = Math.sin(heading) * ahead.nx + Math.cos(heading) * ahead.nz;
    const theta = Math.asin(Math.max(-1, Math.min(1, into)));
    fade = Math.max(0, Math.min(1, (RIM_HEAD_ON_TO - theta) / (RIM_HEAD_ON_TO - RIM_HEAD_ON_FROM)));
    if (fade <= 0) return p;
  }
  // away from the water: the side whose full turn runs further dry (a tie: away from the
  // shore straight ahead, or the way it already steers)
  const left = dry(-1), right = dry(1);
  let side = right > left + 0.05 ? 1 : left > right + 0.05 ? -1 : 0;
  if (side === 0 && ahead.free < look) {
    const inLeft = Math.cos(heading) * ahead.nx - Math.sin(heading) * ahead.nz; // > 0: the water to its left
    side = Math.abs(inLeft) > 0.05 ? (inLeft > 0 ? 1 : -1) : 0;
  }
  if (side === 0) side = p < 0 ? -1 : 1;
  let hi = side;
  if ((side > 0 ? right : left) >= need) {
    // the gentlest steer between `from` and the full turn that still keeps it dry long enough
    let lo = p;
    for (let i = 0; i < 6; i++) { const mid = (lo + hi) / 2; if (dry(mid) >= need) hi = mid; else lo = mid; }
  }
  return p + fade * (hi - p);
}

/* ------------------------------------------------------------ dead ends -- */

/** The jeep stops this far (m) short of the end of its best way forward when every way
 *  forward (straight on, a fan of turns either way) ends soon: room left to
 *  swing round, never driven deep into a dead end. */
export const TRAP_ROOM = 2.5;
/** The ways forward it tries (steers): straight on first, then full turns, then between. */
const TRAP_WAYS = [0, -1, 1, -0.5, 0.5, -0.25, 0.25];
/** The dev hook names the dead end as the brake only when it holds the jeep below this
 *  share of what the nearest single thing ahead would allow. */
const DEAD_END_NAMED = 0.85;
/** A touch at least this square (`headOn`) ends a way forward; a brush does not. */
const TRAP_BLOCK = 0.5;

/**
 * How far (m, up to `max`) the jeep can roll forward along the arc with curvature `k`
 * before its body meets something it would have to stop at: a solid or a keep-out zone
 * met more squarely than a brush (`walls`), the water (`blocked`), or — straight on only
 * — the forest edge (`lim`, as `rimFree`). A way already shorter than `beat` is not looked
 * along any further. Pure.
 */
export function wayFree(
  x: number, z: number, heading: number, k: number, body: readonly BodyCircle[],
  walls: readonly Solid[], lim: number, blocked: ((x: number, z: number) => boolean) | undefined, max: number,
  beat = 0,
): number {
  let free = max;
  if (Math.abs(k) < 1e-4) free = Math.min(free, rimFree(x, z, heading, 1, lim));
  eachTouch(x, z, heading, 1, k, body, walls, free, (t, into) => { if (into >= TRAP_BLOCK && t < free) free = t; });
  // the water only where it could still matter (shorter than `beat` it cannot win anyway)
  if (blocked && free > beat) free = Math.min(free, wetAhead(x, z, heading, 1, k, body, blocked, Math.min(free, WATER_LOOK)).free);
  return free;
}

/**
 * A dead end ahead (run 6 review: seed 11 drove into the pocket between the ven, the
 * bird-hide and the ven marker's keep-out zone and ground about in it for 12 s): the
 * speed (m/s) that stops the jeep `TRAP_ROOM` short of the end of its BEST way forward —
 * straight on or any of a fan of turns up to a full turn either way at this `speed`,
 * whichever runs furthest (`wayFree`) — braking at `RIM_DECEL` (from `now` over `dt`: never harder).
 * Infinity while any way forward stays open. Where one way is open it never brakes; where
 * none is, it comes to rest with room to swing round on a turn key. Pure.
 */
export function deadEndCap(
  x: number, z: number, heading: number, speed: number, caps: DriveCaps, body: readonly BodyCircle[],
  walls: readonly Solid[], lim: number, blocked: ((x: number, z: number) => boolean) | undefined, now = 0, dt = 0,
): number {
  const v = Math.max(Math.abs(speed), Math.abs(now), 1);
  const max = (v * v) / (2 * RIM_DECEL) + TRAP_ROOM + 1;       // beyond this no brake could bind
  let best = 0;
  for (const steer of TRAP_WAYS) {
    best = Math.max(best, wayFree(x, z, heading, pathCurvature(steer, v, 1, caps), body, walls, lim, blocked, max, best));
    if (best >= max) break;
  }
  if (best >= max) return Infinity;
  // a preference, not a wall (the solids, the water and the edge each keep their own
  // stop): noticed late, it still eases down no harder than its gentle rate
  const gentle = brakeCap(best, TRAP_ROOM, RIM_DECEL);
  return dt > 0 ? Math.max(gentle, Math.abs(now) - RIM_DECEL * dt) : gentle;
}

/* ------------------------------------------------------ one jeep frame -- */

/** While pressed against something (or held back by a brake with the gas on) the jeep
 *  keeps this much steer (0..1), so a child holding a turn key always swings free: the
 *  most it ever has, a calm 0.6 rad/s pivot (`STEER_AUTHORITY_MAX`). */
export const CONTACT_STEER = STEER_AUTHORITY_MAX;
/** A standing jeep sets off only when what lies ahead (a solid, a keep-out zone, the forest
 *  edge, the water, an animal) lets it roll at least this fast (m/s): room for a real
 *  start, never an inch-by-inch crawl into a tight spot. Until then a turn key pivots it. */
export const MOVE_OFF = 2;

/** The jeep between frames. */
export interface JeepState {
  x: number;
  z: number;
  heading: number;
  /** the carried signed drive speed (m/s) */
  speed: number;
  /** its body touched a solid or a zone last frame */
  contact: boolean;
  /** last frame a brake held it back (slowed it, or held it still) while the player
   *  pushed on: it keeps the pressed-against-something steer */
  braked: boolean;
}

/** What the jeep meets, rebuilt by the World each frame. */
export interface JeepWorld {
  /** trunks, buildings, props, the people, the other parked vehicle: it brakes for them */
  readonly solids: readonly Solid[];
  /** keep-out patches (mission markers, helipads): it bends round them */
  readonly zones: readonly Solid[];
  /** `solids` then `zones` in one list: what the body can never enter */
  readonly walls: readonly Solid[];
  /** the roaming animals: it gives way to them, never pushes or is pushed by them */
  readonly animals: readonly YieldAnimal[];
  readonly limits: BodyLimits;
}

/** One frame's result: the next state, what it really moved along its heading (m/s),
 *  the animal it is braking for (null when none), and which brake held its speed back
 *  this frame (null: none, it rolls as the gas asks). */
export interface JeepFrame extends JeepState {
  moved: number;
  yieldFor: string | null;
  brake: 'solid' | 'edge' | 'water' | 'dead-end' | 'animal' | null;
}

/** No look of a jeep frame reaches further than this (m) from its body. */
const NEAR_LOOK = 16;
const nearWallBuf: Solid[] = [], nearSolidBuf: Solid[] = [];
/** The solids of `list` whose edge lies within `r` of (x, z), into the reused `out`. */
function within(list: readonly Solid[], x: number, z: number, r: number, out: Solid[]): Solid[] {
  out.length = 0;
  for (const o of list) {
    const R = r + o.r, dx = o.x - x, dz = o.z - z;
    if (dx * dx + dz * dz <= R * R) out.push(o);
  }
  return out;
}

/**
 * One frame of the jeep (the World's `driveJeep` feeds it the keys and the world).
 * (1) the speed ramps toward the throttle (~1 s); (2) the player's steer, bent round a
 * keep-out zone, along the forest edge and the ven's shore, and round a trunk it would
 * only clip (`combineBends`) — only while it really rolls forward (`bendGain`): held,
 * pivoting or creeping, the turn key alone turns it; (3) the brakes, looking along the
 * arc it is about to drive: a soft stop at the solid ahead (backing up: at a zone behind
 * too), at the forest edge, at the water, and for an animal in its path — the lowest
 * wins, and none drops the speed in one frame (`brakeCap`); (4) the speed-scaled,
 * yaw-capped steer (a little authority kept while pressed or held still, so a turn key
 * always swings it free); (5) the arcade step; (6) the whole body against every solid
 * and zone: pushed out, sliding along. Pressed against something, the carried speed
 * drops to what really happened (no pent-up surge when it slides free), never below the
 * creep. Pure.
 */
export function jeepStep(
  s: JeepState, want: DriveInput, dt: number, caps: DriveCaps, w: JeepWorld,
  body: readonly BodyCircle[] = JEEP_BODY,
): JeepFrame {
  if (!(dt > 0)) return { ...s, moved: 0, yieldFor: null, brake: null };
  const ramped = rampSpeed(s.speed, want.throttle, dt, caps);
  let speed = ramped;
  const dir: 1 | -1 | 0 = speed > 0 ? 1 : speed < 0 ? -1 : want.throttle > 0 ? 1 : want.throttle < 0 ? -1 : 0;
  const lim = w.limits.bound - bodyReach(body);
  // only what lies within any look of this frame (the world's hundreds of trunks, once)
  const reachOut = NEAR_LOOK + bodyReach(body);
  const wetNear = w.limits.wetWithin;
  const blocked = w.limits.blocked && (!wetNear || wetNear(s.x, s.z, reachOut)) ? w.limits.blocked : undefined;
  const nearWalls = within(w.walls, s.x, s.z, reachOut, nearWallBuf);
  const nearSolids = within(w.solids, s.x, s.z, reachOut, nearSolidBuf);
  // pressed against something or held back by a brake with the gas on, a turn key keeps
  // some authority (`CONTACT_STEER`), so it turns away instead of creeping on; every look
  // along the path it will drive turns as tightly as that
  const pressed = (s.contact || s.braked) && want.throttle !== 0;
  const floorNow = pressed ? CONTACT_STEER : 0;
  // (2) the steer: bent round what lies ahead (forward only; backing up it brakes)
  let steerWant = clampUnit(want.steer);
  const gain = dir > 0 ? bendGain(speed, caps) : 0;
  if (gain > 0) {
    const zone = keepOutSteer(s.x, s.z, s.heading, speed, w.zones, body, want.steer, caps);
    const rim = rimSteer(s.x, s.z, s.heading, lim, want.steer);
    // a trunk it would clip, on the arc those bends and the player's key drive it along
    const base = guidedSteer(want.steer, gain * combineBends(zone, rim));
    const clip = clipSteer(s.x, s.z, s.heading, speed, nearSolids, body, caps, pathCurvature(base, speed, 1, caps, floorNow));
    steerWant = guidedSteer(want.steer, gain * combineBends(zone, rim, clip));
    // the ven last: the one limit among them, the least change that keeps the path dry
    if (blocked) steerWant += gain * (waterSteer(s.x, s.z, s.heading, speed, steerWant, body, blocked, caps, floorNow) - steerWant);
  }
  // (3) the brakes
  let yieldFor: string | null = null, braked = false;
  let brake: JeepFrame['brake'] = null;
  if (dir !== 0) {
    const k = pathCurvature(steerWant, speed, dir, caps, floorNow);
    // slowing down, the same steer turns it tighter (its yaw is capped, not its curve): the
    // solids and the water are also looked for along the tightest arc it curls into
    const kSlow = pathCurvature(steerWant, Math.min(Math.abs(speed), caps.maxSpeed * STEER_AUTHORITY_MAX), dir, caps, floorNow);
    const curls = Math.abs(kSlow - k) > 0.01;
    // animals: along the arc it is about to drive, and straight ahead too: a steer that
    // flickers between keys (or lets go) must never hide an animal in front of its nose
    const arc = yieldBrake(s.x, s.z, s.heading, dir, k, body, w.animals, s.speed, dt);
    const line = yieldBrake(s.x, s.z, s.heading, dir, 0, body, w.animals, s.speed, dt);
    const give = line.cap < arc.cap ? line : arc;
    const edge = rimSpeedCap(rimFree(s.x, s.z, s.heading, dir, lim), s.speed, dt);
    const wetFree = !blocked ? Infinity : Math.min(wetAhead(s.x, s.z, s.heading, dir, k, body, blocked).free,
      curls ? wetAhead(s.x, s.z, s.heading, dir, kSlow, body, blocked).free : Infinity);
    const wet = blocked ? brakeCap(wetFree, WATER_GAP, RIM_DECEL, s.speed, dt, EDGE_HARD_GAP) : Infinity;
    // solids, and a keep-out zone too: the bend keeps it off one, but squeezed between a
    // zone and the water it must come to a soft stop, never run into the invisible edge
    const decel = caps.maxSpeed / JEEP_RAMP_TIME;
    const solid = Math.min(solidBrake(s.x, s.z, s.heading, dir, k, body, nearWalls, decel, caps.maxSpeed, s.speed, dt).cap,
      curls ? solidBrake(s.x, s.z, s.heading, dir, kSlow, body, nearWalls, decel, caps.maxSpeed, s.speed, dt).cap : Infinity);
    // a dead end ahead (every way forward ends soon): stop with room to swing round
    const trap = dir > 0 ? deadEndCap(s.x, s.z, s.heading, speed, caps, body, nearWalls, lim, blocked, s.speed, dt) : Infinity;
    let cap = Math.min(solid, edge, wet, give.cap, trap);
    // standing still, it sets off only when what lies ahead leaves it room to roll (no
    // 0.1 m/s inching into a tight spot): until then a turn key pivots it
    if (Math.abs(s.speed) < 0.05 && cap < MOVE_OFF) cap = 0;
    if (cap < Math.abs(ramped)) {
      // named after what holds it: a dead end only where nothing single ahead would have
      // stopped it about as soon (straight at the pond, the water itself is what it sees)
      const low = Math.min(solid, edge, wet, give.cap);
      brake = trap < low * DEAD_END_NAMED ? 'dead-end'
        : give.cap === low ? 'animal' : solid === low ? 'solid' : wet === low ? 'water' : 'edge';
    }
    if (brake === 'animal') yieldFor = give.id;                  // braking (or held) for it
    braked = cap < Math.abs(ramped) && want.throttle * dir > 0;
    if (Math.abs(speed) > cap) speed = dir * cap;
  }
  // (4)-(5) the calm steer and the step: held back by a brake or pressed against
  // something, a turn key keeps some authority, so it turns away instead of creeping on
  const floor = pressed || (braked && want.throttle !== 0) ? CONTACT_STEER : 0;
  const steer = comfortSteer(steerWant, speed, caps, floor);
  const st = driveStep(s.heading, { throttle: speed / caps.maxSpeed, steer }, dt, caps);
  // (6) the body against every solid and zone
  const n = resolveBody(s.x, s.z, s.heading, s.x + st.dx, s.z + st.dz, st.heading, body, nearWalls, w.limits);
  const moved = ((n.x - s.x) * Math.sin(s.heading) + (n.z - s.z) * Math.cos(s.heading)) / dt;
  // pressed against something, the carried speed stays within the creep of what really
  // happened: pressed head-on it drops to the creep (no pent-up surge when it slides
  // free), sliding along a trunk it keeps what the slide keeps (it never ratchets down
  // frame after frame)
  if (n.contact) {
    const real = Math.max(0, moved * Math.sign(speed));
    speed = Math.sign(speed) * Math.min(Math.abs(speed), real + CONTACT_CREEP);
  }
  return { x: n.x, z: n.z, heading: n.heading, speed, contact: n.contact, braked, moved, yieldFor, brake };
}

/* ----------------------------------------------------------- ground contact -- */

/** The jeep's wheel contact points (m): half the wheelbase and half the track. */
export const JEEP_WHEELBASE_HALF = 1.15;
export const JEEP_TRACK_HALF = 0.72;

/**
 * Seat a four-wheeled body on the ground: sample the ground under the four wheels
 * and return the body height (their mean) plus the pitch (nose up = +) and roll
 * (left side up = +) that rest all four on it. `ground(x, z)` is the drawn ground
 * (terrain.y). Only the MODEL tilts with the slope; the camera never rolls. Pure.
 */
export function wheelContact(
  x: number, z: number, heading: number,
  ground: (x: number, z: number) => number,
  halfBase = JEEP_WHEELBASE_HALF, halfTrack = JEEP_TRACK_HALF,
): { y: number; pitch: number; roll: number } {
  const fx = Math.sin(heading), fz = Math.cos(heading); // forward
  const lx = fz, lz = -fx;                               // left-of-forward
  const at = (a: number, l: number): number => ground(x + fx * a + lx * l, z + fz * a + lz * l);
  const fl = at(halfBase, halfTrack), fr = at(halfBase, -halfTrack);
  const rl = at(-halfBase, halfTrack), rr = at(-halfBase, -halfTrack);
  const front = (fl + fr) / 2, rear = (rl + rr) / 2, left = (fl + rl) / 2, right = (fr + rr) / 2;
  return {
    y: (fl + fr + rl + rr) / 4,
    pitch: Math.atan2(front - rear, 2 * halfBase),
    roll: Math.atan2(left - right, 2 * halfTrack),
  };
}
