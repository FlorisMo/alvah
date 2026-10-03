/**
 * Coat.ts — the PURE per-species coat tint + posture recipe (W3.7b). Sibling of
 * Eyes.ts: the numbers/flags live here (THREE-free, unit-tested in isolation), the
 * material + transform application lives in AnimalDress.ts.
 *
 * Grounded entirely in `research/animal-visual-accuracy.md` (W3.4a). Two concerns:
 *
 *  1. COAT TINT — a target coat colour + a lerp strength, applied over a model's
 *     body materials (never the eyes). It is a CORRECTION path, not a repaint of
 *     the whole cast: only species whose staged model demonstrably contradicts the
 *     dossier get an entry. The one confirmed contradiction is the CC0 vos, which
 *     reads dark-brown where the dossier says oranjebruin/rood/rufous (recorded in
 *     the W3.5 §10 note). Everything else is left untinted — inventing "fixes" for
 *     coats nobody observed as wrong would violate the no-unsourced-claims rule.
 *     `strength` stays < 1 so the model keeps its own shading/variation (a full
 *     replace flattens the flat-shaded storybook look).
 *
 *  2. POSTURE FLAG — a small, clamped forward pitch (radians) for the head-low,
 *     ground-snuffling species (wild zwijn "kop laag, wroet met de snuit"; frisling
 *     as the adult; das "laag bij de grond, waggelend"). Alert upright browsers
 *     (ree/edelhert/eekhoorn) and the level-backed canids (vos/wolf) keep pitch 0 —
 *     their models already stand right, and tipping them would read worse. The
 *     ceiling POSTURE_MAX_PITCH keeps every tilt a subtle stance cue, never a topple
 *     (same restraint the CALM motion ceilings use).
 */

export interface CoatTint {
  color: string;    // target coat hex (dossier-true)
  strength: number; // 0..1 lerp of the body material colour toward `color`
  /** only the model's materials with these names (its coat), when its other parts (antlers,
   *  a pale rump) are already true; unset: every material but the eyes */
  only?: readonly string[];
  /** run 7 (wc-album, additive): a PALE coat — the model's own texture bleached to its light
   *  and dark (its coat goes `color`, the eyes, the nose and the hooves stay dark), on the
   *  spawn's own copy. For a rare animal staged on a model's own species (a CONTENT id: the
   *  white roe, 'witte-ree'), never a GLB's tint; `strength` is then ignored. */
  pale?: boolean;
}

/** Posture stance cue for a species: a forward (nose-down) pitch in radians. */
export interface Posture {
  pitch: number;    // ≥0 → head/nose lowered; 0 → the model's own stance
  headLow: boolean; // the dossier "kop laag / laag bij de grond" flag
}

/** Ceiling for a posture pitch — past this it stops reading as a stance and topples. */
export const POSTURE_MAX_PITCH = 0.11; // ~6.3°

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Coat-tint corrections. ONLY confirmed dossier contradictions live here (see the
 * file header) — the map is deliberately sparse.
 */
const COAT_TINT: Record<string, CoatTint> = {
  // CC0 fox reads dark-brown; dossier: "oranjebruin, rood tot bruingrijs" (rufous).
  // Lerp 60% toward rufous — corrects the hue but keeps the pack's shading.
  'animal-vos-fox': { color: '#c0561f', strength: 0.6 },
  // run 6: a yearling wild boar (overloper) staged on the boar's model — a CONTENT id,
  // not a GLB: the young lose their stripes and turn "roodbruin" before going dark
  // (3d-animal-animation-research §B2b), so last year's young reads reddish beside the sow.
  overloper: { color: '#8a4f2a', strength: 0.5 },
  // run 7 (moods): the CC0 red deer's coat ('Material', its body) is an olive taupe that
  // reads grey-brown in the world's light; dossier: "zomer roestig/roodbruin"
  // (research/animal-visual-accuracy.md, Edelhert). Its near-black antlers ('Material.001')
  // and its pale neck and rump stay its own.
  'animal-edelhert-reddeer': { color: '#8a4b2c', strength: 0.55, only: ['Material'] },
  // run 7 (wc-album): the wildcamera's rare white roe — a CONTENT id on the roe's model
  // (play/spawn), a leucistic roe: creamy white, its eyes, nose and hooves still dark
  // (a real, if rare, Veluwe sight; spawned for one play, its own materials)
  'witte-ree': { color: '#f1ece2', strength: 1, pale: true },
  // run 7 (the squirrel's neighbours): the raven GLB is a pale grey bird with black wings
  // (it read as a white crow on the snag once its home's own darkening went, one root);
  // dossier: "geheel zwart, met een blauwige glans" — a soft near-black, not a hole: the
  // world's animal fill still lights its shaded side
  'animal-raaf-raven': { color: '#2e2d34', strength: 0.82 },
};

/**
 * Run 6: a procedural coat PATTERN laid over a model's own texture, for an animal whose
 * model contradicts the dossier in its markings, not its hue. The one today: the
 * frisling GLB reads as a white domestic piglet with brown blotches, while a wild-boar
 * piglet wears its "pyjama" — "okerkleurig/zwartbruin met overlangse goudgele strepen
 * (van voor naar achter over de rug)" (research/3d-animal-animation-research.md §B2b).
 * The search beat depends on it: a child glimpses stripes between the stems.
 *
 * Coordinates are the model's own (its geometry box): `u` 0 at the tail → 1 at the
 * snout, `vy` 0 at the hooves → 1 at the top of the back, `theta` the angle round the
 * body's long axis (0 = the spine, ±π/2 the flanks, ±π the belly).
 */
export interface CoatPattern {
  kind: 'stripes';
  /** the dark ochre-brown between the stripes, the golden stripes, the dark legs and snout, the paler belly */
  base: string; stripe: string; dark: string; belly: string;
  /** the head: its texture's light and dark kept (eyes, ears), tinted this brown */
  head: string;
  /** light stripes per flank, from the spine down to the belly */
  perSide: number;
  /** share of each band that is the light stripe */
  duty: number;
  /** the striped stretch of the body (u: from the rump to the neck) */
  from: number; to: number;
  /** where the body's long axis runs, as a share of the height (vy) */
  axis: number;
  /** below this height (vy) are the legs */
  legs: number;
  /** +1: the snout is at +z of the model (the world's convention); −1 at −z */
  headAt: 1 | -1;
}

const PATTERN: Record<string, CoatPattern> = {
  'animal-frisling-piglet': {
    kind: 'stripes', base: '#6b4629', stripe: '#d8b872', dark: '#3a271a', belly: '#9c7b58', head: '#7a5433',
    perSide: 4, duty: 0.4, from: 0.14, to: 0.74, axis: 0.64, legs: 0.36, headAt: 1,
  },
};

/** The coat pattern for a model id, or null (the model's own markings stand). Pure. */
export function patternFor(id: string | null | undefined): CoatPattern | null {
  return id ? PATTERN[id] ?? null : null;
}

/** Which part of a pattern a point of the coat is. Pure — the shader draws the same. */
export function patternAt(p: CoatPattern, u: number, vy: number, theta: number): 'stripe' | 'base' | 'belly' | 'dark' | 'head' {
  if (vy < p.legs) return 'dark';
  if (u > 0.93) return 'dark';                       // the snout's disc
  if (u > p.to + 0.04) return 'head';
  const a = Math.abs(theta);
  if (a > 2.25) return 'belly';
  if (u < p.from || u > p.to) return 'base';
  // bands round the body: the spine (band 0) dark, light stripes at bands 1..perSide
  const band = (a / 2.25) * (p.perSide + 0.5);
  const k = Math.round(band);
  return k >= 1 && k <= p.perSide && Math.abs(band - k) < p.duty / 2 ? 'stripe' : 'base';
}

/** A model-space point's pattern coordinates (see CoatPattern): `u` along the body
 *  (tail 0 → snout 1), `vy` up (hooves 0 → back 1), `a` = |theta| round the long axis. */
export function coatCoords(p: CoatPattern, x: number, y: number, z: number,
  box: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }): { u: number; vy: number; a: number } {
  const lz = box.max.z - box.min.z || 1, ly = box.max.y - box.min.y || 1;
  const u = p.headAt === 1 ? (z - box.min.z) / lz : (box.max.z - z) / lz;
  const vy = (y - box.min.y) / ly;
  const yc = box.min.y + p.axis * ly;
  const xc = (box.min.x + box.max.x) / 2;
  return { u, vy, a: Math.abs(Math.atan2(x - xc, y - yc)) };
}

/**
 * Posture flags. Head-low / snuffling species get a subtle forward pitch; alert
 * or level-backed species keep pitch 0 (their staged stance already matches).
 */
const POSTURE: Record<string, Posture> = {
  'animal-wildzwijn-boar': { pitch: 0.10, headLow: true }, // voorzwaar, kop laag, wroet
  'animal-frisling-piglet': { pitch: 0.09, headLow: true }, // as the adult
  'animal-das-badger': { pitch: 0.07, headLow: true },      // laag bij de grond, waggelend
};

/** Coat tint for a model id, or null when the staged model matches the dossier. Pure. */
export function coatTintFor(id: string | null | undefined): CoatTint | null {
  if (!id) return null;
  const t = COAT_TINT[id];
  if (!t) return null;
  return { color: t.color, strength: clamp(t.strength, 0, 1), ...(t.only ? { only: [...t.only] } : {}), ...(t.pale ? { pale: true } : {}) };
}

/**
 * Posture stance for a model id. Unknown/alert/level species → a neutral upright
 * stance (pitch 0, headLow false); head-low species → a clamped forward pitch. Pure.
 */
export function postureFor(id: string | null | undefined): Posture {
  const p = id ? POSTURE[id] : undefined;
  if (!p) return { pitch: 0, headLow: false };
  return { pitch: clamp(p.pitch, 0, POSTURE_MAX_PITCH), headLow: p.headLow };
}

/* ------------------------------------------------- run 7: how an animal is lit ---- */

/**
 * Run 7 (moods, the named fix "distant animals render almost black"): every animal is
 * drawn MATTE. The CC0 quadrupeds (red deer, roe, fox, wolf) came with metalness 0.4 and
 * roughness 0.41 and the world has no environment map, so 40 % of their colour was thrown
 * away for a reflection of nothing; fur is never glossy. Roughness at least this, metalness 0.
 */
export const MATTE_ROUGHNESS = 0.75;

/** An animal's roughness: its own, but never glossier than fur (≤ 1). Pure. */
export function matteRoughness(r: number): number {
  return clamp(Number.isFinite(r) ? r : 1, MATTE_ROUGHNESS, 1);
}

/** The ceiling of an albedo lift: past this a dark animal stops reading as itself. */
export const ALBEDO_LIFT_MAX = 2.2;

/**
 * Albedo lifts: species whose own colour is so dark that its side away from the low sun
 * reads as a black cut-out in the world's light (measured, moods.spec). The boar's texture
 * averages sRGB 66/53/48 (≈ 0.05 linear); the dossier's "donkere borstelige vacht, van
 * bijna zwart tot bruin" stays: lifted it reads dark grey-brown, still brown, never grey (a
 * multiply keeps the hue). Sparse like the tints: only what the measurement shows.
 */
const ALBEDO_LIFT: Record<string, number> = {
  'animal-wildzwijn-boar': 2.2,
};

/** How much an animal's colour is lifted (1 = its own). Pure. */
export function albedoLiftFor(id: string | null | undefined): number {
  const k = id ? ALBEDO_LIFT[id] : undefined;
  return k ? clamp(k, 1, ALBEDO_LIFT_MAX) : 1;
}

/** Is this a model the animal light dresses (an animal or a bird; never a person)? */
export function isAnimalModel(id: string | null | undefined): boolean {
  return !!id && /^(animal|bird)-/.test(id);
}
