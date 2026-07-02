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
};

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
  return { color: t.color, strength: clamp(t.strength, 0, 1) };
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
