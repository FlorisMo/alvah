/**
 * Wayfinding.ts — the pure direction/distance cue to the active mission
 * (BUILD-PLAN §4 box 38d, §8d.2). NO minimap, NO chrome: a calm veldnotitie-style
 * cue ("naar links · 40 m") the diegetic HUD renders. Dual-channel by construction —
 * a direction GLYPH (shape) plus the words (text); the HUD adds the marker colour as
 * the third channel. Reduced-motion-safe: it is data only, the HUD just swaps text.
 *
 * Pure + render-agnostic (no THREE) so it carries a seeded unit test like every other
 * render3d construct (§9e). The bearing is taken relative to the ranger's facing so
 * the cue reads "turn left / ahead / right", never an absolute compass the child must
 * mentally rotate.
 */

export interface WayCue {
  /** signed bearing relative to facing, radians: + = right, − = left, 0 = ahead */
  angle: number;
  /** ground distance in metres */
  distance: number;
  /** a single arrow glyph (the shape channel) */
  glyph: string;
  /** plain M3/E3 words (the text channel) */
  richting: string;
  /** human distance string ("40 m" / "je bent er") */
  afstand: string;
  /** within the play-proximity radius → the "speel mee" beat takes over */
  arrived: boolean;
}

/** Ground (XZ) distance between two points. */
export function distanceTo(px: number, pz: number, tx: number, tz: number): number {
  return Math.hypot(tx - px, tz - pz);
}

/**
 * Signed bearing from the ranger's facing to the target, around +y.
 * Convention (matches World's `rotation.y = atan2(moveX, moveZ)`): facing θ is the
 * direction (sin θ, cos θ). Returns + for a target on the right, − on the left, 0
 * dead ahead, ±π straight behind.
 */
export function bearing(px: number, pz: number, facingY: number, tx: number, tz: number): number {
  const dirX = tx - px;
  const dirZ = tz - pz;
  const fx = Math.sin(facingY);
  const fz = Math.cos(facingY);
  const cross = fz * dirX - fx * dirZ; // right-positive
  const dot = fx * dirX + fz * dirZ;   // ahead-positive
  return Math.atan2(cross, dot);
}

/** within this radius the marker offers "speel mee" (matches World's proximity). */
export const ARRIVE_RADIUS = 2.4;

/**
 * Turn an (angle, distance) into the calm cue the HUD shows. Buckets the bearing into
 * ahead / slight-left / left / slight-right / right / behind, each with its own glyph
 * and M3/E3 phrase.
 */
export function cue(angle: number, distance: number): WayCue {
  if (distance < ARRIVE_RADIUS) {
    return { angle, distance, glyph: '◎', richting: 'je bent er', afstand: 'je bent er', arrived: true };
  }
  const a = angle;
  let glyph: string;
  let richting: string;
  if (Math.abs(a) < 0.6) {
    glyph = '↑'; richting = 'recht vooruit';
  } else if (Math.abs(a) >= 2.4) {
    glyph = '↓'; richting = 'achter je';
  } else if (a > 0) {
    glyph = a < 1.5 ? '↗' : '→'; richting = 'naar rechts';
  } else {
    glyph = a > -1.5 ? '↖' : '←'; richting = 'naar links';
  }
  const afstand = `${Math.round(distance)} m`;
  return { angle, distance, glyph, richting, afstand, arrived: false };
}

/** One-shot helper: ranger pose + target → the ready-to-render cue. */
export function wayfind(px: number, pz: number, facingY: number, tx: number, tz: number): WayCue {
  return cue(bearing(px, pz, facingY, tx, tz), distanceTo(px, pz, tx, tz));
}
