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

/** Deep tint seen head-on (looking straight down): a clear dark lake blue-teal so the
 *  water body reads as WATER, distinct from the olive moss-bank ground it sits over
 *  (D3.2 — the old forest-teal #3f5f6b muddied into the dark bank and read as ground). */
export const WATER_DEEP = '#35627c';
/** Grazing / edge tint: the GOLDEN-HOUR SKY reflected in the still water (D3.2 —
 *  the ven must read a warm golden reflection, not a pale cyan rim). A bright version of
 *  the §2.1 key (#FFCF8F→#FFB870): the far/grazing water glows warm gold while the near
 *  water stays dark blue-teal — the dark-blue→bright-gold gradient IS the "reflective
 *  still water" cue that separates a water surface from dark ground. */
export const WATER_SHALLOW = '#eecf95';
/** Disc opacity — opaque enough that the dark basin bed never muddies the surface tint. */
export const WATER_OPACITY = 0.92;
/** Schlick-ish fresnel exponent: higher → the golden sky-glow hugs the far grazing edge and
 *  the bulk of the disc holds the dark blue-teal water body ("dark still water + a golden
 *  reflection", not a uniform gold pool that reads as sand). Tuned against the follow cam's
 *  shallow downward pitch so the near/mid water reads dark and only the far shore glows gold. */
export const FRESNEL_POWER = 3.6;
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
