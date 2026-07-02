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
 * waypoint (moving=false) already turned toward the next; then it eases across to
 * the next waypoint (moving=true).
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
    return { x: a.x, z: a.z, facing, moving: false };
  }
  const g = smooth((f - GRAZE_FRAC) / (1 - GRAZE_FRAC));
  return {
    x: a.x + (b.x - a.x) * g,
    z: a.z + (b.z - a.z) * g,
    facing,
    moving: true,
  };
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
