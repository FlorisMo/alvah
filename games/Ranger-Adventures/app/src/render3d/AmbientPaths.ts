/**
 * AmbientPaths.ts — pure, deterministic, THREE-free path functions for the
 * ambient wildlife (WORLD-PLAN W3.6). Two shapes:
 *
 *  - wanderAt(): a ground animal traces a gentle 4-leg loop around a home point
 *    with a PAUSE-AND-GRAZE beat at each waypoint (walk a leg → stop → graze →
 *    walk the next). The `moving` flag drives the baked walk↔graze crossfade (or
 *    the procedural bob) in World.ts, and `facing` turns the model along travel.
 *  - glideAt(): a bird sails a slow horizontal circle overhead with a tiny
 *    vertical undulation, always moving, facing its tangent.
 *
 * Both are functions of ABSOLUTE time `t` (seconds) plus a per-instance phase, so
 * a herd desyncs without any per-frame state. No randomness, no globals → fully
 * unit-testable. The never-scary gate lives upstream (calm speeds, small radii,
 * scary clips already stripped in W3.5); these functions only shape the path.
 *
 * Facing uses the World's convention `atan2(dx, dz)` (same as the ranger's
 * `rotation.y = atan2(moveX, moveZ)`), so the value can be written straight onto
 * a group's `rotation.y` (plus a per-model forward offset if the GLB faces
 * elsewhere — tuned in W3.7).
 */

export interface WanderConfig {
  homeX: number; homeZ: number;
  radius: number;   // metres — loop radius around the home point
  period: number;   // seconds for one full 4-leg loop
  phase: number;    // 0..1 cycle offset, to desync a herd
  angle: number;    // radians — rotates the whole loop around home
}

export interface WanderState {
  x: number; z: number;
  facing: number;   // radians, atan2(dx, dz) toward the next waypoint
  moving: boolean;  // false during the graze pause, true while striding a leg
}

export interface GlideConfig {
  cx: number; cz: number;
  radius: number;   // metres — horizontal orbit radius
  height: number;   // metres — cruise height above ground
  bob: number;      // metres — gentle vertical undulation amplitude
  period: number;   // seconds per orbit
  phase: number;    // 0..1 cycle offset
}

export interface GlideState {
  x: number; y: number; z: number;
  facing: number;   // radians, atan2(dx, dz) along the orbit tangent
}

const LEGS = 4;
/** Fraction of each leg spent paused at the waypoint grazing (the rest strides). */
export const GRAZE_FRAC = 0.42;
/** The last part of that pause (a fraction of the leg) in which it turns, calmly, toward the
 *  next waypoint: it never snaps round (run 6: the facing jumped 90° at every waypoint). */
export const TURN_FRAC = 0.14;
/** smoothstep's top speed is this many times its average: a leg's peak speed. */
const PEAK_OVER_MEAN = 1.5;

/**
 * The loop period (s) at which an animal strides its legs at `peak` m/s at most (run 6: the
 * old 22-34 s loops strode 2.6-4 m/s under a walk clip that covers ~0.6 m/s, so the feet
 * skated; a real deer walks ~1 m/s and grazes between).
 */
export function loopPeriod(radius: number, peak: number): number {
  const leg = radius * Math.SQRT2;                  // the chord between two waypoints 90° apart
  const striding = leg / (peak / PEAK_OVER_MEAN);   // seconds on the move per leg
  return (LEGS * striding) / (1 - GRAZE_FRAC);
}

/** Positive fractional part (so a negative phase still wraps cleanly). */
function frac(x: number): number {
  return x - Math.floor(x);
}

/** Smoothstep ease so a leg accelerates out of and decelerates into a graze. */
function smooth(u: number): number {
  return u * u * (3 - 2 * u);
}

/** The i-th waypoint on the loop around home. */
function waypoint(cfg: WanderConfig, i: number): { x: number; z: number } {
  const a = cfg.angle + (i / LEGS) * Math.PI * 2;
  return { x: cfg.homeX + Math.cos(a) * cfg.radius, z: cfg.homeZ + Math.sin(a) * cfg.radius };
}

/**
 * Ground-animal wander: which leg we are on, how far along, and whether we are
 * striding or grazing. During the graze window the animal sits AT the current
 * waypoint (moving=false), still facing the way it came, and over the window's last
 * `TURN_FRAC` it turns calmly toward the next waypoint; then it eases across to the
 * next waypoint (moving=true).
 */
export function wanderAt(cfg: WanderConfig, t: number): WanderState {
  const u = frac(t / cfg.period + cfg.phase); // 0..1 around the whole loop
  const s = u * LEGS;
  const leg = Math.floor(s) % LEGS;
  const f = s - Math.floor(s);                // 0..1 within this leg
  const a = waypoint(cfg, leg);
  const b = waypoint(cfg, (leg + 1) % LEGS);
  const facing = Math.atan2(b.x - a.x, b.z - a.z); // toward the next waypoint
  if (f < GRAZE_FRAC) {
    const p = waypoint(cfg, (leg + LEGS - 1) % LEGS);
    const came = Math.atan2(a.x - p.x, a.z - p.z);  // the way it arrived
    const w = smooth(Math.min(1, Math.max(0, (f - (GRAZE_FRAC - TURN_FRAC)) / TURN_FRAC)));
    return { x: a.x, z: a.z, facing: came + wrap(facing - came) * w, moving: false };
  }
  const g = smooth((f - GRAZE_FRAC) / (1 - GRAZE_FRAC));
  return {
    x: a.x + (b.x - a.x) * g,
    z: a.z + (b.z - a.z) * g,
    facing,
    moving: true,
  };
}

/**
 * The loop moved clear of what it must not cross (run 6 audit): `ok(x, z)` says whether a
 * point of the loop is open ground for the animal (no trunk, bush, rock, wall, water, marker
 * ground, helipad, rim). Every leg is walked every 0.4 m. Tried in this order, the first
 * that keeps every leg on open ground wins: the loop turned about its home (in sixteenths
 * of a turn), then its home moved a few metres (rings of 2-7 m, eight ways), then a smaller
 * loop. The original loop comes back when it was clear. If nothing fits, the smallest loop
 * tried at its own home is returned (a sliding step still keeps it off every solid).
 */
export function clearLoop(cfg: WanderConfig, ok: (x: number, z: number) => boolean): WanderConfig {
  for (const k of [1, 0.85, 0.7, 0.55]) {
    for (const shift of [0, 2, 3.5, 5, 7]) {
      for (let d = 0; d < (shift ? 8 : 1); d++) {
        const hx = cfg.homeX + Math.sin((d * Math.PI) / 4) * shift, hz = cfg.homeZ + Math.cos((d * Math.PI) / 4) * shift;
        for (let i = 0; i < 16; i++) {
          const turn = ((i % 2 ? -1 : 1) * Math.ceil(i / 2) * Math.PI) / 8; // 0, +⅛, −⅛, +¼ …
          const c: WanderConfig = { ...cfg, homeX: hx, homeZ: hz, radius: cfg.radius * k, angle: cfg.angle + turn };
          if (loopClear(c, ok)) return c;
        }
      }
    }
  }
  return { ...cfg, radius: cfg.radius * 0.55 };
}

function loopClear(cfg: WanderConfig, ok: (x: number, z: number) => boolean): boolean {
  for (let i = 0; i < LEGS; i++) {
    const a = waypoint(cfg, i), b = waypoint(cfg, (i + 1) % LEGS);
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.4));
    for (let j = 0; j < n; j++) if (!ok(a.x + ((b.x - a.x) * j) / n, a.z + ((b.z - a.z) * j) / n)) return false;
  }
  return true;
}

/** Wrap an angle to (−π, π]. */
function wrap(a: number): number {
  const t = Math.PI * 2;
  const r = ((a % t) + t) % t;
  return r > Math.PI ? r - t : r;
}

/** Bird glide: a slow horizontal circle with a gentle vertical undulation. */
export function glideAt(cfg: GlideConfig, t: number): GlideState {
  const u = frac(t / cfg.period + cfg.phase);
  const a = u * Math.PI * 2;
  const dx = -Math.sin(a); // tangent of (cos a, sin a)
  const dz = Math.cos(a);
  return {
    x: cfg.cx + Math.cos(a) * cfg.radius,
    y: cfg.height + Math.sin(a * 2) * cfg.bob,
    z: cfg.cz + Math.sin(a) * cfg.radius,
    facing: Math.atan2(dx, dz),
  };
}
