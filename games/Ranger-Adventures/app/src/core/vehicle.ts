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
 * Scale the raw steer by how fast the jeep is ACTUALLY moving (`speed / maxSpeed`)
 * so it can never pivot in place — the spin-top / doughnut the audit caught, where a
 * held turn key spun the nose while the jeep went nowhere. Fed to `driveStep` as its
 * `steer`, the reachable yaw rate then peaks at `turnRate / 2` (≈ 0.6 rad/s at full
 * caps — the shared unit-magnitude stick cannot hold full steer AND full throttle at
 * once), which lands inside the F-32 comfort band, and the turn radius
 * `maxSpeed / turnRate` stays roughly constant across speeds (one calm arc).
 *
 * The SIGN follows the speed, like a real car: reversing with the wheel turned right
 * swings the tail to the right (so the nose goes left). `floor` (0..1) is the least
 * steer authority kept whatever the speed — the World passes a small one only while
 * the jeep is pressed against something, so a child can always turn away. Pure.
 */
export function comfortSteer(steer: number, speed: number, caps: DriveCaps, floor = 0): number {
  const frac = Math.max(-1, Math.min(1, speed / caps.maxSpeed));
  const auth = Math.abs(frac) >= floor ? frac : (frac < 0 ? -floor : floor);
  return clampUnit(steer) * auth;
}

/* ------------------------------------------------------------ drive intent -- */

/** Pushed only sideways, the jeep still rolls forward at this fraction of its top
 *  speed while it turns (audit veh-05: a stick pushed right used to STOP the jeep). */
export const STEER_CREEP = 0.35;

/** Reverse is slower than forward: a calm back-up, never a backwards dash. */
export const REVERSE_FRACTION = 0.5;

/**
 * Turn the fused screen intent (held keys + stick: `x` right, `y` forward, |v| ≤ 1)
 * into the jeep's throttle + steer. "Push where you want to go":
 *  - Up = gas, Down = brake then reverse (the ramp brakes first, then backs up),
 *  - Left / Right = steer; pushed ONLY sideways the jeep creeps forward while it
 *    turns (`STEER_CREEP`), so a sideways stick or a lone arrow key never stops it,
 *  - a diagonal gives both, at the stick's magnitude.
 * Keys and the touch joystick share this one mapping. Pure.
 */
export function driveIntent(screen: { x: number; y: number }): DriveInput {
  const m = Math.min(1, Math.hypot(screen.x, screen.y));
  if (m < 1e-6) return { throttle: 0, steer: 0 };
  const along = screen.y / m;               // cos of the angle from "up"
  const steer = clampUnit(screen.x / m);    // sin of it: fully sideways = full steer
  const throttle = along >= -0.2
    ? m * Math.max(STEER_CREEP, along)       // forward half (and sideways): gas
    : -m * REVERSE_FRACTION * Math.max(STEER_CREEP, -along); // backward half: reverse
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
 * ven's water is a wall of its own: a step that would wet the body keeps its turn
 * (taken on the spot), as much of its move as stays dry, and slides the rest along
 * the shore, so a jeep nosed into the water always steers free. `contact` is true when
 * a solid or the shore stopped the body this step. Pure + deterministic.
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
        const reach = Math.hypot(x - fx, z - fz) + 0.3; // never further than the step came in
        let lo = 0;
        for (let d = 0.04; d <= reach + 1e-9; d += 0.04) {
          if (!wet(x - n.x * d, z - n.z * d, h)) { out = d; break; }
          lo = d;
        }
        if (out > 0) {
          for (let i = 0; i < 6; i++) { const m = (lo + out) / 2; if (wet(x - n.x * m, z - n.z * m, h)) lo = m; else out = m; }
          out += 0.01; // a hair of room, so the next small turn has some
          if (wet(x - n.x * out, z - n.z * out, h) || deeper(x - n.x * out, z - n.z * out, h)) out = -1;
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
 * −1 reverse) before its leading body circle touches a solid; `max` when nothing is
 * in the way. The World brakes the jeep smoothly on this distance, so it rolls to a
 * soft stop at a tree instead of hitting it at full speed. Pure.
 */
export function freeDistance(
  x: number, z: number, heading: number, dir: 1 | -1,
  body: readonly BodyCircle[], solids: readonly Solid[], max: number,
): number {
  let lead = body[0];
  for (const c of body) if (c.along * dir > lead.along * dir) lead = c;
  const fx = Math.sin(heading), fz = Math.cos(heading);
  const cx = x + fx * lead.along, cz = z + fz * lead.along;
  const ux = fx * dir, uz = fz * dir;
  let best = max;
  for (const o of solids) {
    const R = o.r + lead.r;
    const ox = cx - o.x, oz = cz - o.z;
    const b = ox * ux + oz * uz;                 // > 0: moving away from its centre
    const c = ox * ox + oz * oz - R * R;
    if (c <= 0) { if (b < 0) best = 0; continue; } // already touching, and pressing in
    if (b >= 0) continue;
    const disc = b * b - c;
    if (disc < 0) continue;
    const t = -b - Math.sqrt(disc);
    if (t < best) best = t;
  }
  return Math.max(0, best);
}

/** The slowest the jeep rolls while it is pressed against something (m/s): enough
 *  to slide along a trunk, far too slow to feel like a crash. */
export const CONTACT_CREEP = 0.8;

/**
 * The speed (m/s) the jeep may still have with `free` metres to the nearest solid
 * ahead: braking at `decel` m/s² it comes to rest right at the solid (v = √(2·a·d)),
 * never below the contact creep. A soft stop, never a crash. Pure.
 */
export function contactSpeedCap(free: number, decel: number): number {
  return Math.max(CONTACT_CREEP, Math.sqrt(2 * decel * Math.max(0, free - 0.1)));
}

/* ---------------------------------------------------------- keep-out zones -- */

/** From this long before its nose would reach a keep-out zone in its path (s) the jeep
 *  starts to bend round it, and from `KEEP_OUT_FULL_S` on the bend is a full turn of
 *  the wheel: 9 m and 4 m at top speed, which with the speed-scaled steer (a ~5 m
 *  turning circle) clears a zone met head-on. Timed, not measured: a jeep creeping at
 *  a child's sideways push is not steered off a zone still seconds away. */
export const KEEP_OUT_LOOK_S = 1.5;
export const KEEP_OUT_FULL_S = 0.67;
/** A path this far (rad) or more inside a zone's edge gets the full bend; less, less. */
export const KEEP_OUT_TURN = 0.35;

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
    const dist = Math.hypot(dx, dz), R = o.r + half;
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
