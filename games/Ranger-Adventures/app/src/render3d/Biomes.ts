/**
 * Biomes.ts — the pure biome field for the explorable Veluwe (BUILD-PLAN §4, §8d.2).
 *
 * The four real Veluwe landschappen — heide / bos / stuifzand / ven — radiate as
 * noise-warped sectors out of the central lodge clearing, so the world reads as one
 * continuous heath that fades into forest, drift-sand and a wet fen rather than four
 * pasted-on tiles. Two pure functions drive everything the render layer needs:
 *
 *   • `biomeAt(x,z)`  → which landschap a point belongs to (for colour + vegetation).
 *   • `heightAt(x,z)` → the ground relief. It is a sum of smooth global sinusoids plus
 *     a smooth Gaussian basin under the ven, so it is C∞-continuous EVERYWHERE — there
 *     are deliberately NO per-biome height branches, hence no cliffs at sector seams
 *     (a hard step would read as a wall and break the calm, never-scary feel).
 *
 * Deterministic (no Math.random / Date.now) so the world is identical every load and
 * the seeded unit test can pin the invariants. Render-agnostic: no THREE import.
 */

export type Biome = 'heide' | 'bos' | 'stuifzand' | 'ven';

/** Compass order of the sectors, starting just below the +x axis and going CCW. */
export const BIOME_ORDER: readonly Biome[] = ['heide', 'bos', 'stuifzand', 'ven'] as const;

export type Vegetation = 'heather' | 'pine' | 'marram' | 'reed';

export interface BiomePalette {
  /** ground tint blended into the terrain vertex colours */
  ground: string;
  /** accent used for that biome's scattered vegetation / props */
  accent: string;
  /** which instanced vegetation kind dresses this biome */
  vegetation: Vegetation;
}

export const BIOME_PALETTE: Record<Biome, BiomePalette> = {
  heide:     { ground: '#8a9a55', accent: '#9a6aa8', vegetation: 'heather' },
  bos:       { ground: '#5d7340', accent: '#5b4327', vegetation: 'pine' },
  stuifzand: { ground: '#d8c79a', accent: '#b9a878', vegetation: 'marram' },
  ven:       { ground: '#6f7d52', accent: '#4a6b78', vegetation: 'reed' },
};

/** Radius of the flat-ish lodge clearing at world centre; always heide. */
export const CLEARING_R = 7;

/** Centre of the ven basin (in the heart of the ven sector) + its smooth dip. */
export const VEN_CENTER = { x: 46, z: -19 };
const BASIN_DEPTH = 3.4; // deeper than the global relief (±2.2) so the ven is the lowest ground
const BASIN_SIGMA = 14;

/** Still-water surface height for the ven plane (sits inside the basin dip). */
export const WATER_LEVEL = -1.4;

const TWO_PI = Math.PI * 2;

/**
 * Continuous ground relief. Smooth everywhere — gentle global rolling plus a single
 * Gaussian basin under the ven. No biome branching ⇒ no discontinuities at seams.
 */
export function heightAt(x: number, z: number): number {
  const base =
    Math.sin(x * 0.06) * Math.cos(z * 0.05) * 0.8 +
    Math.sin(x * 0.013 + z * 0.02) * 1.4;
  const dx = x - VEN_CENTER.x, dz = z - VEN_CENTER.z;
  const d2 = dx * dx + dz * dz;
  const basin = -BASIN_DEPTH * Math.exp(-d2 / (2 * BASIN_SIGMA * BASIN_SIGMA));
  return base + basin;
}

/**
 * Which landschap a point belongs to. Sectors of the compass, but the dividing
 * angle is warped by a low-frequency field so the borders wander naturally instead
 * of cutting a clean pie. The warp is bounded (≈±0.6 rad < a quarter turn) so every
 * one of the four sectors always keeps a solid core — no biome can be erased.
 * The central clearing is forced to heide (the lodge sits on the heath).
 */
export function biomeAt(x: number, z: number): Biome {
  if (x * x + z * z < CLEARING_R * CLEARING_R) return 'heide';
  const warp = 0.6 * Math.sin(x * 0.02) * Math.cos(z * 0.018);
  let u = Math.atan2(z, x) + Math.PI + warp; // → roughly [0, 2π)
  u = ((u % TWO_PI) + TWO_PI) % TWO_PI;      // wrap into [0, 2π)
  const sector = Math.min(BIOME_ORDER.length - 1, Math.floor(u / (Math.PI / 2)));
  return BIOME_ORDER[sector];
}

/**
 * A comfortable anchor point inside a given biome at a chosen radius — used to drop
 * a mission marker in the heart of its own landschap. Walks the warped field a few
 * steps to land safely inside the target sector rather than on a wandering seam.
 */
export function anchorInBiome(biome: Biome, radius = 26): { x: number; z: number } {
  const sector = BIOME_ORDER.indexOf(biome);
  // centre angle of the unwarped sector
  const u = (sector + 0.5) * (Math.PI / 2);
  let a = u - Math.PI;
  for (let i = 0; i < 6; i++) {
    const x = Math.cos(a) * radius, z = Math.sin(a) * radius;
    if (biomeAt(x, z) === biome) return { x, z };
    a += 0.12; // nudge along the arc until we're clear of a seam
  }
  return { x: Math.cos(a) * radius, z: Math.sin(a) * radius };
}
