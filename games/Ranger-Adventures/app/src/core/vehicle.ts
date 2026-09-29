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

/** A solid circle on the ground plane (a trunk, the cabin, a person, an animal). */
export interface Solid {
  x: number;
  z: number;
  r: number;
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
      const pen = R - Math.sqrt(d2);
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

/**
 * Resolve one vehicle step for its whole BODY, not a point (audit veh-06: the jeep
 * was a point, so its 3.7 m body drove through trunks, the cabin and the warden).
 * From pose (fx, fz, fh) the controller wants (tx, tz, th). Every body circle is
 * pushed straight out of every solid it overlaps, so the residual motion is
 * TANGENTIAL: the jeep slides along a trunk or a wall instead of stopping dead, and
 * it never bounces. If the body is still wedged after the passes, the old pose wins
 * (it never ends up inside a solid). The world rim keeps the whole body inside. The
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
  let x = tx, z = tz;
  let contact = false;
  const sx = Math.sin(th), sz = Math.cos(th);
  for (let pass = 0; pass < 4; pass++) {
    let pushed = false;
    for (const c of body) {
      const cx = x + sx * c.along, cz = z + sz * c.along;
      for (const o of solids) {
        const R = o.r + c.r;
        const dx = cx - o.x, dz = cz - o.z;
        const d2 = dx * dx + dz * dz;
        if (d2 >= R * R) continue;
        const d = Math.sqrt(d2);
        let nx: number, nz: number;
        if (d > 1e-6) { nx = dx / d; nz = dz / d; }
        else { // dead centre: back out the way it came
          const mx = fx - tx, mz = fz - tz, ml = Math.hypot(mx, mz) || 1;
          nx = mx / ml; nz = mz / ml;
        }
        x += nx * (R - d); z += nz * (R - d);
        pushed = true;
      }
    }
    if (!pushed) break;
    contact = true;
  }
  let h = th;
  // still wedged (between two trunks): keep whichever pose sinks in less — never deeper
  if (contact && bodyOverlap(x, z, h, body, solids) > 0.02
    && bodyOverlap(fx, fz, fh, body, solids) <= bodyOverlap(x, z, h, body, solids)) {
    x = fx; z = fz; h = fh;
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
 * How far (m) the vehicle can travel straight along its heading (`dir` +1 forward,
 * −1 reverse) before its leading body circle touches a solid (`free`; `max` when
 * nothing is in the way), and how squarely it would meet it (`headOn`: the share of
 * its motion that runs INTO the solid at that touch, 1 = dead centre, → 0 = a brush
 * along its side). The jeep brakes smoothly on these, so it rolls to a soft stop at a
 * tree it drives straight at and brushes past one it only clips. Pure.
 */
export function impactAhead(
  x: number, z: number, heading: number, dir: 1 | -1,
  body: readonly BodyCircle[], solids: readonly Solid[], max: number,
): { free: number; headOn: number } {
  let lead = body[0];
  for (const c of body) if (c.along * dir > lead.along * dir) lead = c;
  const fx = Math.sin(heading), fz = Math.cos(heading);
  const cx = x + fx * lead.along, cz = z + fz * lead.along;
  const ux = fx * dir, uz = fz * dir;
  let best = max, headOn = 0;
  for (const o of solids) {
    const R = o.r + lead.r;
    const ox = cx - o.x, oz = cz - o.z;
    const b = ox * ux + oz * uz;                 // > 0: moving away from its centre
    const d2 = ox * ox + oz * oz;
    const c = d2 - R * R;
    if (c <= 0) {                                // already touching, and pressing in
      if (b < 0 && (best > 0 || -b / Math.sqrt(d2) > headOn)) { best = 0; headOn = -b / Math.sqrt(d2); }
      continue;
    }
    if (b >= 0) continue;
    const disc = b * b - c;
    if (disc < 0) continue;
    const t = -b - Math.sqrt(disc);
    if (t < best) { best = t; headOn = Math.sqrt(Math.max(0, 1 - (d2 - b * b) / (R * R))); }
  }
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

/**
 * The speed (m/s) the jeep may still have with `free` metres to the nearest solid
 * ahead, met `headOn` squarely (`impactAhead`; 1 = dead centre): braking at `decel`
 * m/s² it comes to rest right at the solid (v = √(2·a·d)), but never below the speed at
 * which it can brush it gently — the part of its speed that runs into the solid stays
 * at the creep (`CONTACT_CREEP / headOn²`) — so a clipped trunk costs almost nothing
 * (run 6: every brush braked it to a 0.8 m/s crawl, then ground it along the bark). Met
 * squarely (fading in from `SQUARE_HIT`) there is nothing to slide along: it simply
 * stops in front of it, without the last creep into the bark. Pure.
 */
export function contactSpeedCap(free: number, decel: number, headOn = 1): number {
  const brush = Math.max(0, Math.min(1, (1 - headOn) / (1 - SQUARE_HIT)));
  const gentle = headOn > 1e-6 ? (CONTACT_CREEP / (headOn * headOn)) * brush : Infinity;
  return Math.max(gentle, Math.sqrt(2 * decel * Math.max(0, free - 0.1)));
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
 * a reversing jeep). Pure.
 */
export function keepOutSteer(
  x: number, z: number, heading: number, speed: number,
  zones: readonly Solid[], body: readonly BodyCircle[], bias = 0,
): number {
  const v = Math.max(1, Math.abs(speed));
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
/** An animal that steps into the path close ahead: the jeep brakes harder (m/s²), over
 *  a moment instead of in one frame, and still stops `YIELD_HARD_GAP` (m) short. */
export const YIELD_HARD_DECEL = 8;
export const YIELD_HARD_GAP = 0.8;

/**
 * The speed (m/s) the jeep may have this frame with `free` metres to the animal in its
 * path, rolling at `now` m/s: the gentle stop `YIELD_GAP` short of it at `YIELD_DECEL`
 * (√(2·a·(free − gap))); if the animal is closer than that stop needs, a harder but
 * still smooth brake (at most `YIELD_HARD_DECEL` per second, never past the stop
 * `YIELD_HARD_GAP` short), so a deer stepping out close ahead never makes the jeep
 * drop speed in a single frame. Pure.
 */
export function yieldSpeed(free: number, now = 0, dt = 0): number {
  const gentle = Math.sqrt(2 * YIELD_DECEL * Math.max(0, free - YIELD_GAP));
  const hard = Math.sqrt(2 * YIELD_HARD_DECEL * Math.max(0, free - YIELD_HARD_GAP));
  return Math.min(hard, Math.max(gentle, Math.abs(now) - YIELD_HARD_DECEL * dt));
}

/**
 * The curvature (1/m, + = curving to the left of the way it moves) of the path the
 * jeep drives with this steer at this speed (the same `comfortSteer` authority), so
 * the give-way brake looks along the arc the jeep will really take. `dir` = the way it
 * moves (+1 forward, −1 reverse), used when it stands still. Pure.
 */
export function pathCurvature(steer: number, speed: number, dir: 1 | -1, caps: DriveCaps): number {
  const v = Math.max(Math.abs(speed), 1e-3);
  const auth = Math.min(v / caps.maxSpeed, STEER_AUTHORITY_MAX);
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
  const lx = uz, lz = -ux;                                          // left of that
  const px = x + Math.sin(heading) * lead.along, pz = z + Math.cos(heading) * lead.along;
  const turning = Math.abs(curvature) > 1e-4;
  const R = turning ? 1 / Math.abs(curvature) : 0;
  let free = Infinity, id: string | null = null;
  for (const an of animals) {
    const dx = an.x - px, dz = an.z - pz;
    const a = dx * ux + dz * uz;
    let b = dx * lx + dz * lz;
    let s: number, lat: number;
    if (!turning) { s = a; lat = Math.abs(b); }
    else {
      if (curvature < 0) b = -b;                  // mirror a right-hand curve onto the left
      const phi = Math.atan2(a, R - b);           // how far round the turn it lies
      if (phi <= 0) continue;
      s = phi * R;
      lat = Math.abs(Math.hypot(a, b - R) - R);
    }
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

/** The speed (m/s) that stops the jeep `RIM_GAP` short of the forest edge `free` metres
 *  ahead (`rimFree`), braking at `RIM_DECEL`: no crawl, no grind. Pure. */
export function rimSpeedCap(free: number): number {
  return Math.sqrt(2 * RIM_DECEL * Math.max(0, free - RIM_GAP));
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

/* ------------------------------------------------------ one jeep frame -- */

/** While pressed against something (or held back by a brake with the gas on) the jeep
 *  keeps this much steer (0..1), so a child holding a turn key always swings free. */
export const CONTACT_STEER = 0.45;
/** A standing jeep sets off only when the forest edge or an animal ahead lets it roll
 *  at least this fast (m/s): room for a real start, never an inch-by-inch crawl. */
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
  brake: 'solid' | 'edge' | 'animal' | null;
}

/**
 * One frame of the jeep (the World's `driveJeep` feeds it the keys and the world).
 * (1) the speed ramps toward the throttle (~1 s); (2) the player's steer, bent round a
 * keep-out zone or along the forest edge ahead; (3) the brakes: a soft stop at the
 * solid ahead (backing up: at a zone behind too), at the forest edge, and for an
 * animal in its path — the lowest wins; (4) the speed-scaled, yaw-capped steer (a
 * little authority kept while pressed or held still, so a turn key always swings it
 * free); (5) the arcade step; (6) the whole body against every solid and zone: pushed
 * out, sliding along. Pressed against something, the carried speed drops to what
 * really happened (no pent-up surge when it slides free), never below the creep. Pure.
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
  // (2) the steer: bent round what lies ahead (forward only; backing up it brakes)
  let avoid = 0;
  if (dir > 0) {
    const zone = keepOutSteer(s.x, s.z, s.heading, speed, w.zones, body, want.steer);
    const rim = rimSteer(s.x, s.z, s.heading, lim, want.steer);
    avoid = Math.abs(rim) > Math.abs(zone) ? rim : zone;
  }
  const steerWant = guidedSteer(want.steer, avoid);
  // (3) the brakes
  let yieldFor: string | null = null, braked = false;
  let brake: JeepFrame['brake'] = null;
  if (dir !== 0) {
    const give = yieldBrake(s.x, s.z, s.heading, dir, pathCurvature(steerWant, speed, dir, caps), body, w.animals, s.speed, dt);
    const edge = rimSpeedCap(rimFree(s.x, s.z, s.heading, dir, lim));
    let stop = Math.min(edge, give.cap);
    // standing still, it sets off only when the forest edge or the animal ahead leaves
    // it room to roll (no 0.1 m/s inching): until then a turn key turns it (the floor)
    if (Math.abs(s.speed) < 0.05 && stop < MOVE_OFF) stop = 0;
    const hit = impactAhead(s.x, s.z, s.heading, dir, body, dir > 0 ? w.solids : w.walls, 40);
    const solid = contactSpeedCap(hit.free, caps.maxSpeed / JEEP_RAMP_TIME, hit.headOn);
    const cap = Math.min(solid, stop);
    if (cap < Math.abs(ramped)) brake = cap === solid ? 'solid' : give.cap <= edge ? 'animal' : 'edge';
    if (brake === 'animal') yieldFor = give.id;                  // braking (or held) for it
    braked = cap < Math.abs(ramped) && want.throttle * dir > 0;
    if (Math.abs(speed) > cap) speed = dir * cap;
  }
  // (4)-(5) the calm steer and the step: held back by a brake or pressed against
  // something, a turn key keeps some authority, so it turns away instead of creeping on
  const floor = (s.contact || s.braked || braked) && want.throttle !== 0 ? CONTACT_STEER : 0;
  const steer = comfortSteer(steerWant, speed, caps, floor);
  const st = driveStep(s.heading, { throttle: speed / caps.maxSpeed, steer }, dt, caps);
  // (6) the body against every solid and zone
  const n = resolveBody(s.x, s.z, s.heading, s.x + st.dx, s.z + st.dz, st.heading, body, w.walls, w.limits);
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
