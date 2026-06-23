/**
 * ProceduralMotion.ts — the always-on "charming, never-scary" motion fallback for
 * every generated animal/bird (BUILD-PLAN §8a Ceiling-1, §8c #2, §8d.1). Meshy
 * meshes arrive STATIC; an Anything World rig is an optional enhancement (the
 * loader prefers a real animated GLB when one is staged). With no rig, this drives
 * gentle whole-body motion from a per-species recipe so the cast is never frozen.
 *
 * Frozen-research gate (research/3d-expression-eyes-motion-comfort.md §B AVOID
 * lists + §C motion-comfort):
 *  - never-scary: loose, slow, SMALL. No adder S-coil rear-up (slither stays
 *    flat — lateral weave only, zero vertical, no pitch). No rapid squirrel
 *    tail-flick (breathing is slow). No frozen mid-leap frog (every hop completes
 *    its arc, lands at rest, then pauses). No stiff threat stance.
 *  - motion-comfort (§C.2 BAN list is for the *camera*; the same restraint applies
 *    here): every amplitude + frequency is clamped by calmGate(). This is
 *    SECONDARY motion, so reduced-motion turns it OFF (returns the rest pose) —
 *    "reduce ≠ none" keeps walk cycles, but idle ambiance is non-essential.
 *
 * Pure + deterministic: motionAt(recipe, t, phase) → a transform delta, with no
 * Three.js / DOM dependency, so it is unit-testable in isolation. World.ts owns
 * applying the delta (and skipping it under reduced-motion) each frame.
 */

export type Gait = 'breathe' | 'hop' | 'slither' | 'flutter' | 'paddle' | 'still';

/** A clamped, calm motion recipe. Build via gaitFor()/calmGate() — never raw. */
export interface MotionRecipe {
  gait: Gait;
  bobAmp: number;   // vertical bob, metres (also the hop apex height)
  swayAmp: number;  // lateral travel, metres
  rotAmp: number;   // yaw/roll waggle, radians
  breathAmp: number;// breathing scale, fraction of rest height (e.g. 0.02 = ±2%)
  hz: number;       // cycles per second (slow = calm)
}

/** A per-frame transform offset relative to the model's rest pose. */
export interface MotionDelta {
  dy: number;       // metres, never negative (we never sink the model below ground)
  dx: number;       // metres, lateral
  rotY: number;     // radians, yaw
  rotZ: number;     // radians, roll/bank
  scaleY: number;   // multiplier on rest height (~1)
}

export const REST: MotionDelta = { dy: 0, dx: 0, rotY: 0, rotZ: 0, scaleY: 1 };

/**
 * Never-scary / motion-comfort ceilings. Anything above these reads as agitated
 * or nausea-inducing for a motion-sensitive child, so calmGate() clamps to them.
 */
export const CALM = {
  maxBob: 0.06,      // ≤6 cm of vertical idle motion
  maxHopBob: 0.16,   // a frog hop may rise more, but still small + gentle
  maxSway: 0.10,     // ≤10 cm lateral
  maxRot: 0.12,      // ≤~7° waggle
  maxBreath: 0.035,  // ≤3.5% breathing scale
  maxHz: 0.9,        // nothing faster than ~0.9 Hz (flutter is the busiest, still capped)
} as const;

/** Fraction of a hop cycle spent airborne; the rest is calm ground-rest. */
const HOP_AIRBORNE = 0.34;

/** Clamp any recipe into the calm envelope. Idempotent. */
export function calmGate(r: MotionRecipe): MotionRecipe {
  const bobCeil = r.gait === 'hop' ? CALM.maxHopBob : CALM.maxBob;
  return {
    gait: r.gait,
    bobAmp: clamp(r.bobAmp, 0, bobCeil),
    swayAmp: clamp(r.swayAmp, 0, CALM.maxSway),
    rotAmp: clamp(r.rotAmp, 0, CALM.maxRot),
    breathAmp: clamp(r.breathAmp, 0, CALM.maxBreath),
    hz: clamp(r.hz, 0, CALM.maxHz),
  };
}

/** Base recipes per gait (pre-clamp; calmGate finalizes them). */
const GAITS: Record<Gait, MotionRecipe> = {
  // quadrupeds + calm perched birds: slow breathing + a hair of bob
  breathe: { gait: 'breathe', bobAmp: 0.015, swayAmp: 0, rotAmp: 0.01, breathAmp: 0.02, hz: 0.35 },
  // frog: a single gentle arc, then rests (never frozen mid-leap)
  hop: { gait: 'hop', bobAmp: 0.16, swayAmp: 0, rotAmp: 0, breathAmp: 0.015, hz: 0.3 },
  // adder: flat lateral weave, zero vertical, no pitch (no S-coil rear-up)
  slither: { gait: 'slither', bobAmp: 0, swayAmp: 0.08, rotAmp: 0.1, breathAmp: 0, hz: 0.45 },
  // butterfly: lightest, slightly busier but tiny
  flutter: { gait: 'flutter', bobAmp: 0.05, swayAmp: 0.05, rotAmp: 0.08, breathAmp: 0, hz: 0.9 },
  // duck on water: gentle float bob + a small rock
  paddle: { gait: 'paddle', bobAmp: 0.03, swayAmp: 0, rotAmp: 0.05, breathAmp: 0.01, hz: 0.4 },
  // props / reduced-motion: dead still
  still: { gait: 'still', bobAmp: 0, swayAmp: 0, rotAmp: 0, breathAmp: 0, hz: 0 },
};

/**
 * Species → gait. Only animals that AW could rig get a non-breathe special-case;
 * everything else (quadrupeds, perched birds) breathes calmly. Snake + frog stay
 * procedural forever (AW can't rig them — §8c #2), so their gaits live here.
 */
const SPECIES_GAIT: Record<string, Gait> = {
  'animal-adder-snake': 'slither',
  'animal-heikikker-frog': 'hop',
  'animal-heideblauwtje-butterfly': 'flutter',
  'bird-wilde-eend': 'paddle',
};

/** Resolve a clamped recipe for a model id. Unknown animals/birds breathe; non-cast → still. */
export function gaitFor(id: string | null | undefined): MotionRecipe {
  if (!id) return GAITS.still;
  const explicit = SPECIES_GAIT[id];
  if (explicit) return calmGate(GAITS[explicit]);
  if (id.startsWith('animal-') || id.startsWith('bird-')) return calmGate(GAITS.breathe);
  return GAITS.still;
}

/**
 * The pure motion function: a delta for `recipe` at time `t` (seconds) with a
 * per-instance `phase` (radians) so a herd doesn't pulse in lock-step.
 * Deterministic — no globals, no randomness.
 */
export function motionAt(recipe: MotionRecipe, t: number, phase: number): MotionDelta {
  const w = 2 * Math.PI * recipe.hz;
  const a = w * t + phase;
  switch (recipe.gait) {
    case 'still':
      return REST;
    case 'breathe':
      return {
        dy: recipe.bobAmp * 0.5 * (Math.sin(a) + 1) * 0.5, // 0..bobAmp, never negative
        dx: 0,
        rotY: recipe.rotAmp * Math.sin(a * 0.5),
        rotZ: 0,
        scaleY: 1 + recipe.breathAmp * Math.sin(a),
      };
    case 'hop': {
      // one arc over HOP_AIRBORNE of the cycle, flat rest for the remainder
      const p = frac(recipe.hz * t + phase / (2 * Math.PI));
      const dy = p < HOP_AIRBORNE ? recipe.bobAmp * Math.sin((Math.PI * p) / HOP_AIRBORNE) : 0;
      return { dy, dx: 0, rotY: 0, rotZ: 0, scaleY: 1 + recipe.breathAmp * Math.sin(a) };
    }
    case 'slither':
      return {
        dy: 0, // flat — never a vertical S-coil rear-up
        dx: recipe.swayAmp * Math.sin(a),
        rotY: recipe.rotAmp * Math.sin(a + Math.PI / 2),
        rotZ: 0,
        scaleY: 1,
      };
    case 'flutter':
      return {
        dy: Math.max(0, recipe.bobAmp * Math.sin(a)),
        dx: recipe.swayAmp * Math.sin(a * 0.7 + phase),
        rotY: 0,
        rotZ: recipe.rotAmp * 0.5 * Math.sin(a),
        scaleY: 1,
      };
    case 'paddle':
      return {
        dy: Math.max(0, recipe.bobAmp * Math.sin(a)),
        dx: 0,
        rotY: 0,
        rotZ: recipe.rotAmp * 0.6 * Math.sin(a),
        scaleY: 1 + recipe.breathAmp * Math.sin(a),
      };
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Positive fractional part, so phase wraps cleanly for the hop cycle. */
function frac(x: number): number {
  return x - Math.floor(x);
}
