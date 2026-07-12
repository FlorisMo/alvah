/**
 * AnimalScale.ts — the PURE canonical stand-height table (W3.7a).
 *
 * `research/animal-visual-accuracy.md` (W3.4a) sourced a shoulder height /
 * body size for every staged animal. This module turns those sourced numbers
 * into ONE canonical "stand height" per model id — the target bounding-box
 * height that `prepModel(group, h)` normalizes each GLB to, so every creature
 * finally reads at its true size relative to the ranger and to each other
 * (until W3.7a they were placement-site ballparks; the showroom auto-scaled
 * everything to 1.7, hiding all relative scale — see the W3.5 §10 note).
 *
 * THREE-free + deterministic so it unit-tests in isolation (like Eyes.ts), and
 * both the live world (`World.placeAmbientLife`) and the showroom true-scale
 * mode (`?scale=true`) read the SAME table — one source of truth for size.
 *
 * DERIVATION (documented, deliberately approximate): `prepModel` scales a GLB
 * so its TALLEST dimension ≈ the target, i.e. the target is the model's
 * standing height (top of head/back in its pose), NOT the sourced shoulder
 * height. Quadrupeds carry their head above the withers, so:
 *     standHeight ≈ sourced shoulder height × posture factor
 * The posture factor is larger for long-necked alert browsers (ree/edelhert),
 * ~1.15 for canids, and ~1.05 for the head-low boar. Small mammals with no
 * shoulder figure use their sourced upright body size directly; snake/frog/
 * butterfly are length/wingspan creatures with only a nominal height. The unit
 * test pins the ORDERING and the ranger ratio, which are robust to the exact
 * factor — the numbers are honest estimates, not a false precision claim.
 *
 * Reference: the dossier's schaal-referentie uses an adult human, and the
 * animals' TRUE biological heights are sized against it (`ratioToRanger`), so
 * every creature reads correctly next to a grown-up. The in-world PLAYER,
 * however, is Alvah — a CHILD of ≈8 (≈1.2 m, direction doc §2.4, Floris
 * 2026-07-05) — so his own stand-height (`RANGER_STAND_HEIGHT`) is decoupled
 * from the adult reference (`ADULT_REFERENCE_HEIGHT`): the animal ratios anchor
 * on the grown-up, the player rig preps to the child height, and he reads a
 * clear head-and-shoulders shorter than the mature warden NPC (P1.6a).
 */

/**
 * Adult-human reference height (m) — the dossier's schaal-referentie anchor.
 * The denominator every animal is sized against (`ratioToRanger`) AND the
 * mature-human NPC (warden / poacher) stand-height. NOT the player's height —
 * Alvah is a child (see `RANGER_STAND_HEIGHT`). Keeping this at the adult scale
 * is what stops the P1.6a child rescale from inflating every animal ~42%.
 */
export const ADULT_REFERENCE_HEIGHT = 1.8;

/**
 * The PLAYER ranger Alvah's stand height (m) — a CHILD of ≈8, ≈1.2 m, a clear
 * head shorter than a ~1.8 m adult (direction doc §2.4). World + Stage prep his
 * GLB to this; the animals do NOT (their absolute `STAND_HEIGHT` values below
 * are unchanged, anchored on `ADULT_REFERENCE_HEIGHT`).
 */
export const RANGER_STAND_HEIGHT = 1.2;

/**
 * Canonical stand height (m) per manifest id. Sourced shoulder heights + the
 * documented posture factor above; see `research/animal-visual-accuracy.md`
 * for every underlying claim + source URL.
 */
export const STAND_HEIGHT: Record<string, number> = {
  // ── the player (a CHILD, not the reference) ──────────────────────────────
  'ranger-alvah': RANGER_STAND_HEIGHT,      // Alvah = child ≈1.2 m (P1.6a)
  // ── large mammals ────────────────────────────────────────────────────────
  'animal-edelhert-reddeer': 1.5,   // shoulder ~1.2 m × ~1.25 (head/neck up)
  'animal-ree-roedeer': 0.95,       // shoulder ~0.67 m × ~1.4 (long alert neck)
  'animal-wolf': 0.9,               // shoulder ~0.8 m × ~1.15
  'animal-wildzwijn-boar': 0.88,    // shoulder ~0.85 m × ~1.05 (head carried low)
  // ── medium/small mammals ─────────────────────────────────────────────────
  'animal-vos-fox': 0.48,           // shoulder ~0.38 m × ~1.25
  'animal-das-badger': 0.32,        // shoulder ~0.28 m × ~1.15 (low, waddling)
  'animal-frisling-piglet': 0.28,   // small juvenile boar (no sourced shoulder)
  'animal-eekhoorn-squirrel': 0.25, // upright body ~0.22 m + tail/ears
  // ── reptile · amphibian · insect (length/wingspan creatures) ─────────────
  'animal-adder-snake': 0.15,       // ~0.55 m long; nominal coiled/raised height
  'animal-heikikker-frog': 0.07,    // body ~0.06 m
  'animal-heideblauwtje-butterfly': 0.05, // wingspan ~0.03 m; kept barely visible
};

/**
 * Canonical stand height (m) for a model id, or null when the id has no dossier
 * size (props/vehicles/birds — callers fall back to their own normalization).
 * Pure + deterministic.
 */
export function standHeightFor(id: string | null | undefined): number | null {
  if (!id) return null;
  return id in STAND_HEIGHT ? STAND_HEIGHT[id] : null;
}

/** A model's canonical height as a fraction of the adult-human reference (NOT
 *  the child player — animals are sized against a grown-up). Pure. */
export function ratioToRanger(id: string | null | undefined): number | null {
  const h = standHeightFor(id);
  return h === null ? null : h / ADULT_REFERENCE_HEIGHT;
}
