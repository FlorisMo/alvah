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
  // right of facing (sin θ, cos θ) is (−cos θ, sin θ) in three.js (y up, a camera
  // looking down −z has +x on its right) — the old `fz·dx − fx·dz` was mirrored and
  // sent the player to the wrong side (audit B4).
  const cross = fx * dirZ - fz * dirX; // right-positive
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

/** The direction buckets of `cue`, in order round the ranger: each with its glyph and
 *  words and the bearing range (rad) it covers. */
type Bucket = 'ahead' | 'slightRight' | 'right' | 'behind' | 'left' | 'slightLeft';
const BUCKETS: Record<Bucket, { glyph: string; richting: string; lo: number; hi: number }> = {
  ahead: { glyph: '↑', richting: 'recht vooruit', lo: -0.6, hi: 0.6 },
  slightRight: { glyph: '↗', richting: 'naar rechts', lo: 0.6, hi: 1.5 },
  right: { glyph: '→', richting: 'naar rechts', lo: 1.5, hi: 2.4 },
  behind: { glyph: '↓', richting: 'achter je', lo: 2.4, hi: 2 * Math.PI - 2.4 }, // wraps round ±π
  left: { glyph: '←', richting: 'naar links', lo: -2.4, hi: -1.5 },
  slightLeft: { glyph: '↖', richting: 'naar links', lo: -1.5, hi: -0.6 },
};

function bucketOf(a: number): Bucket {
  if (Math.abs(a) < 0.6) return 'ahead';
  if (Math.abs(a) >= 2.4) return 'behind';
  if (a > 0) return a < 1.5 ? 'slightRight' : 'right';
  return a > -1.5 ? 'slightLeft' : 'left';
}

/** Is bearing `a` inside the bucket's range grown by `grow` rad on each side? */
function inBucket(b: Bucket, a: number, grow: number): boolean {
  const { lo, hi } = BUCKETS[b];
  const x = b === 'behind' && a < 0 ? a + 2 * Math.PI : a;
  return x >= lo - grow && x <= hi + grow;
}

/** How far (rad, ~8°) the bearing must pass a bucket edge before the cue changes. */
export const CUE_HYSTERESIS = 0.14;
/** The words on the chip stay at least this long (ms) before they change again. */
export const CUE_HOLD_MS = 1000;

/**
 * The chip's cue over time, for a dyslexic reader: the words never flicker (child
 * B10). A bearing near a bucket edge keeps the words it has until it is CUE_HYSTERESIS
 * past the edge, and once changed the words stay CUE_HOLD_MS before they change again.
 * Arriving ("je bent er") is never held back. Pure: the caller passes the clock.
 */
export class SteadyCue {
  private shown: Bucket | null = null;
  private since = 0;

  /** Forget the words shown (a new goal): the next cue shows at once. */
  reset(): void {
    this.shown = null;
  }

  update(angle: number, distance: number, nowMs: number): WayCue {
    const raw = cue(angle, distance);
    if (raw.arrived) { this.shown = null; return raw; }
    let b = this.shown;
    if (b === null) {
      b = bucketOf(angle);
      this.since = nowMs;
    } else if (!inBucket(b, angle, CUE_HYSTERESIS) && nowMs - this.since >= CUE_HOLD_MS) {
      b = bucketOf(angle);
      this.since = nowMs;
    }
    this.shown = b;
    return { ...raw, glyph: BUCKETS[b].glyph, richting: BUCKETS[b].richting };
  }
}

/** One-shot helper: ranger pose + target → the ready-to-render cue. */
export function wayfind(px: number, pz: number, facingY: number, tx: number, tz: number): WayCue {
  return cue(bearing(px, pz, facingY, tx, tz), distanceTo(px, pz, tx, tz));
}
