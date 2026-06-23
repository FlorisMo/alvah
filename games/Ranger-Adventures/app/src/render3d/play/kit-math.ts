/**
 * kit-math.ts — the pure geometry/animation maths behind the 3D play kit
 * (3D-IMMERSION-PLAN §2). NO THREE, NO DOM, so it carries a seeded unit test
 * like every render3d construct (§9e); `kit.ts` wraps these with the THREE
 * objects + DOM. Everything here is deterministic.
 *
 * The two guarantees these helpers enforce for the harness:
 *  - **≥56px tap targets** even for raycast picks — an invisible hit-sphere is
 *    sized in WORLD units so it always projects to at least 56 CSS px.
 *  - **dual-channel, motion-comfort-safe highlight** — a SCALE pulse + a COLOUR
 *    (emissive) glow that freezes to a steady still glow under reduced-motion.
 */

/** Minimum projected tap-target diameter in CSS px (BUILD-PLAN a11y floor). */
export const MIN_TAP_PX = 56;

/**
 * World-space radius an invisible hit-sphere needs so it projects to at least
 * `pxDiameter` pixels at `distance` from a perspective camera (vertical
 * `fovRad`, viewport `viewportH` px). Derivation: a world height `H` at distance
 * `d` projects to `viewportH · H / (2 d tan(fov/2))` px; invert for `H`, halve
 * for the radius.
 */
export function worldRadiusForPx(
  pxDiameter: number,
  distance: number,
  fovRad: number,
  viewportH: number,
): number {
  if (viewportH <= 0) return 0;
  const worldDiameter = (pxDiameter / viewportH) * 2 * distance * Math.tan(fovRad / 2);
  return worldDiameter / 2;
}

/**
 * The hit-sphere radius that guarantees a ≥56px raycast target at `distance`,
 * never below `floor` (so a very close object still has a comfortable sphere).
 */
export function tapHitRadius(
  distance: number,
  fovRad: number,
  viewportH: number,
  floor = 0.4,
): number {
  return Math.max(floor, worldRadiusForPx(MIN_TAP_PX, distance, fovRad, viewportH));
}

export interface TrailPoint { x: number; z: number; u: number }

/**
 * `n` points evenly along the straight ground path from (ax,az) to (bx,bz),
 * inclusive of both ends (clamped to ≥2). The spoorTrail clue legs lay on these.
 * `u` is the 0..1 progress so the caller can fade fainter clues toward the start.
 */
export function trailPoints(
  ax: number, az: number, bx: number, bz: number, n: number,
): TrailPoint[] {
  const N = Math.max(2, Math.floor(n));
  const pts: TrailPoint[] = [];
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);
    pts.push({ x: ax + (bx - ax) * u, z: az + (bz - az) * u, u });
  }
  return pts;
}

export interface PulseState { scale: number; emissive: number }

/**
 * Dual-channel highlight state at time `t`. `scale` is the SCALE channel, a calm
 * ~0.35 Hz breath; `emissive` is the COLOUR channel. Under reduced-motion the
 * pulse FREEZES to a steady lifted glow (no oscillation) — the colour channel
 * alone still marks the target, and nothing moves (motion-comfort §1e).
 */
export function highlightPulse(t: number, reducedMotion: boolean): PulseState {
  if (reducedMotion) return { scale: 1.06, emissive: 0.5 };
  const s = (Math.sin(t * 2.2) + 1) / 2; // 0..1, calm
  return { scale: 1 + 0.08 * s, emissive: 0.35 + 0.35 * s };
}

/**
 * Frame-rate-independent exponential damping factor for a `tau`-second response
 * (matches World.placeCamera's §1e follow). Used by the camera reframe tween.
 */
export function dampFactor(dt: number, tau: number): number {
  if (tau <= 0) return 1;
  return 1 - Math.exp(-dt / tau);
}
