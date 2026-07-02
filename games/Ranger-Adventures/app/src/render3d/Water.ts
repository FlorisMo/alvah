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

/** Deep tint seen head-on (looking straight down): forest-teal, calm. */
export const WATER_DEEP = '#3f5f6b';
/** Grazing / edge tint: a lighter warm sky-glow (golden-hour reflection). */
export const WATER_SHALLOW = '#9fc4c2';
/** Disc opacity — translucent enough to hint at the submerged basin. */
export const WATER_OPACITY = 0.85;
/** Schlick-ish fresnel exponent: higher → the sky-glow hugs the grazing edge. */
export const FRESNEL_POWER = 3.0;
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
