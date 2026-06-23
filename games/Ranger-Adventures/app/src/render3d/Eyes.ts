/**
 * Eyes.ts — the PURE per-species eye spec + maths (BUILD-PLAN Phase 5,
 * research/3d-expression-eyes-motion-comfort.md §1e "Eyes shader: build before any
 * animal modeling"). THREE-free + deterministic so it unit-tests in isolation, the
 * kit-math.ts/kit.ts split. The material + canvas + wiring live in EyeMaterial.ts.
 *
 * Frozen §1e spec realised across the two files:
 *  - one upper-quadrant catchlight on both eyes (the "alive" spark),
 *  - a clearcoat cornea (spec high, roughness ~0.05–0.15) so eyes read wet,
 *  - one-mesh iris parallax (a tiny camera-driven uv shift fakes iris depth),
 *  - per-species pupil shape (round / vertical-slit / horizontal-bar),
 *  - dusk eyeshine ON for fox/deer/roe/badger/nightjar/frog, OFF for
 *    squirrel/adder/lizard (the tapetum-lucidum list).
 *
 * NEVER-SCARY GATE (§B AVOID lists): eyeshine is a horror cliché if it glows. So it
 * is (a) gated OFF unless the scene is genuinely dusk/night, (b) warm-amber — never
 * the cold green of a predator-in-the-dark, (c) tiny in intensity. The golden-hour
 * world passes dusk=false → eyes are bright + alive, not glowing. Parallax is a
 * micro-motion → it freezes (depth 0) under reduced-motion (motion-comfort §C).
 */

export type PupilShape = 'round' | 'vertical-slit' | 'horizontal-bar';

export interface EyeSpec {
  irisColor: string;          // hex — biologically warm browns/ambers
  pupilShape: PupilShape;
  eyeshine: boolean;          // tapetum lucidum present → eyeshine at dusk
  eyeshineColor: string;      // warm, calm — NEVER cold green (never-scary)
  clearcoatRoughness: number; // wet-cornea spec, clamped to [0.05, 0.15]
  catchlight: { u: number; v: number; size: number }; // v>0.5 ⇒ upper quadrant
  parallaxDepth: number;      // iris parallax strength (uv units, small)
}

/** §1e ceilings — past these the eye stops reading calm/wet and starts to glow. */
export const EYE = {
  corneaRoughMin: 0.05,
  corneaRoughMax: 0.15,
  maxEyeshine: 0.45,    // emissive intensity ceiling — a spark, never a lamp
  maxParallax: 0.03,    // uv shift ceiling — a hint of depth, never a wobble
} as const;

const DEFAULT_CATCHLIGHT = { u: 0.34, v: 0.72, size: 0.14 } as const; // upper-left quadrant

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Ids that are not vertebrate-eyed in the usual mammal/bird way. */
const NON_TAPETUM_DEFAULT = new Set(['animal-adder-snake', 'animal-heideblauwtje-butterfly']);

/** Per-species pupil shape (biology, kept defensible — default round). */
const PUPIL: Record<string, PupilShape> = {
  'animal-vos-fox': 'vertical-slit',      // foxes: vertical-slit, crepuscular
  'animal-adder-snake': 'vertical-slit',  // viper: vertical-slit
  'animal-ree-roedeer': 'horizontal-bar', // ungulate prey: horizontal pupil
  'animal-edelhert-reddeer': 'horizontal-bar',
  'animal-wildzwijn-boar': 'horizontal-bar',
  'animal-frisling-piglet': 'horizontal-bar',
};

/** Explicit dusk-eyeshine list from §1e (overrides the mammal/bird default). */
const EYESHINE_ON = new Set([
  'animal-vos-fox', 'animal-edelhert-reddeer', 'animal-ree-roedeer',
  'animal-das-badger', 'animal-nachtzwaluw-nightjar', 'animal-heikikker-frog',
]);
const EYESHINE_OFF = new Set([
  'animal-eekhoorn-squirrel', 'animal-adder-snake', // squirrel/adder/lizard
]);

/** Per-species iris colour (warm, research-true). Default = warm brown. */
const IRIS: Record<string, string> = {
  'animal-vos-fox': '#b8862f',          // amber
  'animal-edelhert-reddeer': '#4a2f17', // deep brown
  'animal-ree-roedeer': '#3f2a16',
  'animal-das-badger': '#2a1d12',       // near-black, small eye
  'animal-eekhoorn-squirrel': '#1f150d',
  'animal-heikikker-frog': '#9a7321',   // copper-gold
  'animal-nachtzwaluw-nightjar': '#241a12',
  'animal-adder-snake': '#7a5a1e',      // coppery with the slit
};

/**
 * Does this id carry a tapetum by default? Mammals do; birds/insects don't; the
 * explicit lists win. (Frog is on the explicit ON list; snake/butterfly off.)
 */
export function defaultEyeshine(id: string): boolean {
  if (EYESHINE_ON.has(id)) return true;
  if (EYESHINE_OFF.has(id)) return false;
  if (NON_TAPETUM_DEFAULT.has(id)) return false;
  return id.startsWith('animal-'); // unlisted mammals on; birds (bird-*) off
}

/** Resolve the full, clamped eye spec for a model id. Pure + deterministic. */
export function eyeSpecFor(id: string | null | undefined): EyeSpec {
  const key = id ?? '';
  return {
    irisColor: IRIS[key] ?? '#5a3a22',
    pupilShape: PUPIL[key] ?? 'round',
    eyeshine: defaultEyeshine(key),
    eyeshineColor: '#caa45a', // one warm amber for the whole cast (never green)
    clearcoatRoughness: clamp(0.1, EYE.corneaRoughMin, EYE.corneaRoughMax),
    catchlight: { ...DEFAULT_CATCHLIGHT },
    parallaxDepth: clamp(0.02, 0, EYE.maxParallax),
  };
}

/**
 * Eyeshine emissive intensity for a spec in a given light. Zero unless the species
 * has a tapetum AND the scene is dusk/night; clamped to EYE.maxEyeshine. Pure.
 */
export function eyeshineAt(spec: EyeSpec, dusk: boolean): number {
  if (!dusk || !spec.eyeshine) return 0;
  return clamp(0.3, 0, EYE.maxEyeshine);
}

/**
 * One-mesh iris parallax: the uv offset to apply to the iris texture for a camera
 * view direction in the eye's local frame. The iris shifts OPPOSITE the view to
 * fake depth, is zero head-on, and is clamped to ±depth (never a wobble). The
 * caller passes depth 0 under reduced-motion → a frozen, flat iris. Pure.
 */
export function irisParallax(
  view: { x: number; y: number },
  depth: number,
): { u: number; v: number } {
  const d = clamp(depth, 0, EYE.maxParallax);
  return {
    u: (-clamp(view.x, -1, 1) * d) || 0, // `|| 0` normalises -0 → 0
    v: (-clamp(view.y, -1, 1) * d) || 0,
  };
}

/** Pupil ellipse radii for a shape, around a base radius. Pure. */
export function pupilRadii(shape: PupilShape, base: number): { rx: number; ry: number } {
  switch (shape) {
    case 'vertical-slit': return { rx: base * 0.32, ry: base * 1.05 };
    case 'horizontal-bar': return { rx: base * 1.15, ry: base * 0.42 };
    case 'round': default: return { rx: base, ry: base };
  }
}
