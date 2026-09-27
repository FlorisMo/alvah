/**
 * Water.ts — W4.8 "Ven-water", pure & THREE-free.
 *
 * The ven (SW basin) gets a fresnel-tinted disc: darker forest-teal seen
 * head-on, a lighter warm sky-glow at grazing angles (the Schlick view-angle
 * mix that makes still water read as WATER, not a flat painted circle). The
 * surface is WAVELESS by default — under reduced-motion the ripple amplitude is
 * exactly zero, so the disc is a dead-still mirror (no frozen mid-wave, no
 * silhouette change — the ripple is a gentle fragment-tint shimmer, never a
 * geometry displacement, so it can never break the motion-comfort law §C).
 *
 * The maths that the shader needs to agree with lives here as pure functions so
 * the fresnel monotonicity + endpoints and the reduced-motion amplitude gate are
 * pinned by a unit test with no browser. Deterministic — no Math.random / Date.
 */

/** Deep tint seen head-on (looking down into it): the dark, peaty teal of a Veluwe ven.
 *  2026-09-27: darker than the D3.2 lake blue, because under the brighter golden-hour sky
 *  the old mix read as pale sand; still water reads as WATER when it is darker than the
 *  bank and only the far part carries the sky. */
export const WATER_DEEP = '#243d44';
/** The golden-hour sky the still water mirrors where the view looks down into it
 *  steeply enough to see the sky's reflection (Atmosphere.SKY_STOPS' cream band). */
export const WATER_SHALLOW = '#d8ccb0';
/** What the FAR water mirrors at a grazing angle: the tree-line on the far bank, so the
 *  far water is a dark band under the trees (the cue that says "still water"). */
export const WATER_TREES = '#343a26';
/** Disc opacity — opaque enough that the dark basin bed never muddies the surface tint. */
export const WATER_OPACITY = 0.94;
/** Schlick fresnel exponent (5 is the physical one): the sky only takes over toward the
 *  far, grazing water; the near water stays dark. */
export const FRESNEL_POWER = 5;
/** Water's reflectance looking straight down (Schlick F0): even head-on a little sky. */
export const WATER_F0 = 0.04;
/** Peak ripple-shimmer amplitude (fraction of the tint mix) when motion is on. */
export const RIPPLE_AMP = 0.12;

/**
 * Fresnel factor for a flat, up-facing water plane, given the vertical component
 * of the (normalized) view direction `viewY` = dot(viewDir, up). Looking straight
 * down (`viewY` = 1) → 0 (deep tint); grazing (`viewY` → 0) → 1 (sky-glow tint).
 * Schlick approximation `(1 - viewY)^power`, clamped to [0,1]. Monotonically
 * DECREASING in `viewY`. Pure — the fragment shader computes the same value.
 */
export function fresnelFactor(viewY: number, power = FRESNEL_POWER): number {
  const c = viewY < 0 ? 0 : viewY > 1 ? 1 : viewY;
  return Math.pow(1 - c, power);
}

/**
 * Ripple-shimmer amplitude for the current motion policy: exactly 0 under
 * reduced-motion (WAVELESS default — the disc holds dead still), else `RIPPLE_AMP`.
 * The World sets the shader's `uAmp` from this every frame.
 */
export function rippleAmp(reduced: boolean): number {
  return reduced ? 0 : RIPPLE_AMP;
}
