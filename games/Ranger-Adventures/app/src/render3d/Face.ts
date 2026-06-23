/**
 * Face.ts — the PURE ARKit-subset face system (BUILD-PLAN Phase 5,
 * research/3d-expression-eyes-motion-comfort.md §A "Humanoid faces"). THREE-free +
 * deterministic so it unit-tests in isolation (the kit-math / Eyes split). The
 * morph-target driver + blink/saccade animation live in FaceRig.ts.
 *
 * Frozen §A spec realised here:
 *  - §A.1 the ~16-shape ARKit subset (symmetric L/R pairs), with noseSneer /
 *    mouthPress / jawForward DELIBERATELY EXCLUDED (they read disgust/anger/no warm
 *    use),
 *  - §A.2 the per-emotion recipe table as DATA (artists tune weights, not code),
 *  - §A.4 blink / microsaccade / transition timing.
 *
 * UNCANNY-VALLEY GATE (§A.2): the eyes are the #1 eeriness driver, so every recipe
 * is clamped — general weight ≤0.7, `eyeWide` ≤0.35 (above that a gentle surprise
 * reads as fear), `browDown` ≤0.2 (above that focus reads as anger), and a smile
 * MUST carry the Duchenne `cheekSquint` marker or it reads fake. The upper face is
 * never frozen: the static recipe is only the pose — FaceRig keeps blink +
 * microsaccade alive on top (a frozen upper face is the "dead doll" tell).
 */

/** §A.1 the chosen subset, by canonical ARKit blendshape name. */
export const ARKIT_SUBSET = [
  // brows (the emotional core, with eyes)
  'browInnerUp',
  'browDownLeft', 'browDownRight',
  'browOuterUpLeft', 'browOuterUpRight',
  // eyes
  'eyeBlinkLeft', 'eyeBlinkRight',
  'eyeWideLeft', 'eyeWideRight',
  'eyeSquintLeft', 'eyeSquintRight',
  // cheeks (the Duchenne "real smile" marker)
  'cheekSquintLeft', 'cheekSquintRight',
  // mouth / jaw (kept simple)
  'mouthSmileLeft', 'mouthSmileRight',
  'mouthFrownLeft', 'mouthFrownRight',
  'jawOpen', 'mouthPucker', 'mouthShrugUpper',
] as const;

export type ArkitShape = (typeof ARKIT_SUBSET)[number];

/** §A.1 deliberately excluded — never authored into a warm expression. */
export const ARKIT_EXCLUDED = [
  'noseSneerLeft', 'noseSneerRight', // read disgust / anger
  'mouthPress', 'jawForward',        // no reliable warm use
] as const;

export type Emotion =
  | 'neutral' | 'happy' | 'surprised' | 'curious' | 'sad-gentle' | 'proud' | 'focused';

export const EMOTIONS: Emotion[] = [
  'neutral', 'happy', 'surprised', 'curious', 'sad-gentle', 'proud', 'focused',
];

/**
 * §A.2 uncanny-valley ceilings. Past these the face stops reading warm/childish and
 * starts to read fearful (eyeWide) / angry (browDown) / waxy (overdriven weights).
 */
export const FACE_CAP = {
  general: 0.7,    // §A.1 "cap weights ~0.5–0.7"
  eyeWide: 0.35,   // §A.2 eyeWide >0.4 reads fear/uncanny
  browDown: 0.2,   // §A.2 keep browDown low so focus never reads angry
} as const;

/** §A.4 blink / saccade / transition timing (seconds + per-minute rates). */
export const FACE_TIMING = {
  blinkDurationSec: 0.13,             // 100–150 ms, eased (not linear)
  childBlinkPerMin: { attentive: [6, 10], idle: [10, 14] }, // child < adult (correction §A.4)
  adultBlinkPerMin: { attentive: [15, 20], idle: [15, 20] },
  expressionFadeSec: 0.35,           // §A.2 ~0.3–0.4 s eased fade between expressions
  microsaccadePerSec: 1,             // ~1/s, <0.5°, prevents the dead-doll stare
  microsaccadeMaxDeg: 0.5,
  gazeSmoothSec: { child: 0.14, adult: 0.24 }, // eyes lead, head follows ~80–150 ms later
  eyeYawBeforeHeadDeg: 10,           // people turn the head past ~15–20°
  blinkJitterFrac: 0.25,             // ±25% so blinks never feel metronomic
} as const;

/**
 * Logical (symmetric) recipe keys. A pair key expands to its Left/Right shapes so an
 * author writes one weight and both sides move identically (asymmetry reads uncanny).
 */
type RecipeKey =
  | 'browInnerUp' | 'browDown' | 'browOuterUp'
  | 'eyeWide' | 'eyeSquint'
  | 'cheekSquint'
  | 'mouthSmile' | 'mouthFrown'
  | 'jawOpen' | 'mouthPucker' | 'mouthShrugUpper';

const PAIR_EXPANSION: Record<RecipeKey, ArkitShape[]> = {
  browInnerUp: ['browInnerUp'],
  browDown: ['browDownLeft', 'browDownRight'],
  browOuterUp: ['browOuterUpLeft', 'browOuterUpRight'],
  eyeWide: ['eyeWideLeft', 'eyeWideRight'],
  eyeSquint: ['eyeSquintLeft', 'eyeSquintRight'],
  cheekSquint: ['cheekSquintLeft', 'cheekSquintRight'],
  mouthSmile: ['mouthSmileLeft', 'mouthSmileRight'],
  mouthFrown: ['mouthFrownLeft', 'mouthFrownRight'],
  jawOpen: ['jawOpen'],
  mouthPucker: ['mouthPucker'],
  mouthShrugUpper: ['mouthShrugUpper'],
};

/** Per-key ceiling: the special caps win, else the general one. */
function capFor(key: RecipeKey): number {
  if (key === 'eyeWide') return FACE_CAP.eyeWide;
  if (key === 'browDown') return FACE_CAP.browDown;
  return FACE_CAP.general;
}

/**
 * §A.2 the per-emotion recipe table, as DATA (logical weights 0–1, pre-clamp). Tuned
 * inside the §A.2 ranges; clampRecipe() finalises them so no hand-edit can exceed a
 * never-uncanny ceiling.
 */
const RECIPES: Record<Emotion, Partial<Record<RecipeKey, number>>> = {
  // all ~0; a hint of a smile so the rest face is friendly, not flat (blink keeps it alive)
  neutral: { mouthSmile: 0.05 },
  // smile MUST carry the Duchenne cheekSquint or it reads fake
  happy: { mouthSmile: 0.6, cheekSquint: 0.35, eyeSquint: 0.15, browInnerUp: 0.1 },
  // gentle surprise, NOT fear — eyeWide held ≤0.35
  surprised: { browInnerUp: 0.5, browOuterUp: 0.4, eyeWide: 0.35, jawOpen: 0.2 },
  curious: { browOuterUp: 0.25, browInnerUp: 0.2, eyeWide: 0.15, mouthSmile: 0.1 },
  // inner-brow-up = sadness; keep subtle, never a full frown
  'sad-gentle': { browInnerUp: 0.5, mouthFrown: 0.25, eyeSquint: 0.1 },
  proud: { mouthSmile: 0.4, cheekSquint: 0.25, browOuterUp: 0.15 },
  // browDown held ≤0.2 so focus never reads angry
  focused: { browDown: 0.2, eyeSquint: 0.25, mouthPucker: 0.1 },
};

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Clamp a logical recipe into the never-uncanny envelope. Idempotent + pure. */
export function clampRecipe(
  recipe: Partial<Record<RecipeKey, number>>,
): Partial<Record<RecipeKey, number>> {
  const out: Partial<Record<RecipeKey, number>> = {};
  for (const k of Object.keys(recipe) as RecipeKey[]) {
    out[k] = clamp(recipe[k] ?? 0, 0, capFor(k));
  }
  return out;
}

/**
 * Resolve an emotion to a clamped, L/R-expanded ARKit weight map. Only emits names
 * from ARKIT_SUBSET (an excluded shape can never leak). Pure + deterministic.
 */
export function expressionWeights(emotion: Emotion): Record<ArkitShape, number> {
  const out = {} as Record<ArkitShape, number>;
  for (const name of ARKIT_SUBSET) out[name] = 0;
  const clamped = clampRecipe(RECIPES[emotion] ?? {});
  for (const key of Object.keys(clamped) as RecipeKey[]) {
    const w = clamped[key] ?? 0;
    for (const shape of PAIR_EXPANSION[key]) out[shape] = w;
  }
  return out;
}

/**
 * §A.2 eased fade between two weight maps. k in [0,1] (0 → from, 1 → to), smoothstep
 * eased so the transition has no hard start/stop. Pure. Covers the union of keys.
 */
export function fadeWeights(
  from: Record<string, number>,
  to: Record<string, number>,
  k: number,
): Record<string, number> {
  const s = smoothstep(clamp(k, 0, 1));
  const out: Record<string, number> = {};
  const keys = new Set([...Object.keys(from), ...Object.keys(to)]);
  for (const key of keys) {
    const a = from[key] ?? 0;
    const b = to[key] ?? 0;
    out[key] = a + (b - a) * s;
  }
  return out;
}

function smoothstep(k: number): number {
  return k * k * (3 - 2 * k);
}

/**
 * §A.4 blink envelope: an eased lid-down→up pulse over a normalised blink phase
 * [0,1] (0 = eyes open, 0.5 = fully shut, 1 = open again). Bounded [0,1], 0 outside
 * the window. Half-sine = eased, never linear. Pure.
 */
export function blinkEnvelope(phase: number): number {
  if (phase <= 0 || phase >= 1) return 0;
  return Math.sin(Math.PI * phase);
}

/**
 * The eyeBlink weight at absolute time t given the most recent blink's start. Pure —
 * the caller owns the schedule (driven by nextBlinkDelay). Closed (0) between blinks.
 */
export function blinkWeightAt(t: number, lastBlinkStart: number, durationSec: number): number {
  if (durationSec <= 0) return 0;
  return blinkEnvelope((t - lastBlinkStart) / durationSec);
}

/** Deterministic, seedless [0,1) hash for jitter (no Math.random — resume-safe). */
function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * §A.4 the delay (seconds) until the next blink for blink index i at a per-minute
 * rate, jittered ±FACE_TIMING.blinkJitterFrac so blinks never feel metronomic.
 * Deterministic in i (resume-safe). Pure.
 */
export function nextBlinkDelay(index: number, perMin: number): number {
  const base = 60 / Math.max(0.001, perMin);
  const j = (hash01(index) * 2 - 1) * FACE_TIMING.blinkJitterFrac;
  return Math.max(0.05, base * (1 + j));
}

/**
 * §A.4 microsaccade gaze jitter: a tiny deterministic eye offset (degrees, ≤0.5°)
 * at time t, so a fixating eye never goes "dead doll" still. Pure.
 */
export function microsaccadeAt(t: number): { yawDeg: number; pitchDeg: number } {
  const a = FACE_TIMING.microsaccadeMaxDeg;
  // two incommensurate slow waves → a non-repeating, sub-degree wander
  return {
    yawDeg: clamp(a * 0.6 * Math.sin(t * 6.1 + 0.7) + a * 0.4 * Math.sin(t * 11.3), -a, a),
    pitchDeg: clamp(a * 0.5 * Math.sin(t * 7.7 + 1.9) + a * 0.5 * Math.sin(t * 9.2), -a, a),
  };
}
