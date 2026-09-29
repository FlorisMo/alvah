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

/**
 * World centre of the ven basin: the Gaussian dip `heightAt` digs here is where the
 * water disc, the reed belt, the no-wade zone and the forced 'ven' shore all sit (SE,
 * below the vogelkijkhut). A world point like every other coordinate in this file.
 */
export const VEN_CENTER = { x: 46, z: -19 };
const BASIN_DEPTH = 3.4; // deeper than the global relief (±2.2) so the ven is the lowest ground
const BASIN_SIGMA = 14;

/** Still-water surface height for the ven plane (sits inside the basin dip). */
export const WATER_LEVEL = -1.4;

/** Radius (m from VEN_CENTER) of the drawn water disc; where the ground inside it lies
 *  under the surface is water nobody walks or drives into (World's `limits.blocked`). */
export const VEN_WATER_R = 20;

/**
 * How far the wet ven reaches out from `VEN_CENTER`: the water disc (radius 20) plus
 * a moss/reed shore ring. `biomeAt` forces `'ven'` inside this radius so the ground
 * tone, the reed belt (`scatterReeds`) and the footstep
 * surface all AGREE with the water that physically sits here. Without it the compass
 * warp lands the basin in the stuifzand sector, so the fen renders as pale drift sand
 * with its reeds scattered off in the dry western ven sector — no frame reads as a
 * real ven (P1.2 / RUN-C-DIRECTION §2.2: "dark still water, moss-soft banks, reed
 * clusters"). Kept just past the 20 m water disc so a moss bank rings the water.
 */
export const VEN_SHORE_R = 26;

/** Outer radius (m from VEN_CENTER) of the reed belt that rings the water. */
export const VEN_REED_OUT = 20;

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
  // The wet ven is wherever the water basin actually is (VEN_CENTER), not merely where
  // the compass sector would warp it — force 'ven' over the basin + its shore so the
  // ground tone, reeds and footstep surface cohere with the water (P1.2, VEN_SHORE_R).
  const vdx = x - VEN_CENTER.x, vdz = z - VEN_CENTER.z;
  if (vdx * vdx + vdz * vdz < VEN_SHORE_R * VEN_SHORE_R) return 'ven';
  const warp = 0.6 * Math.sin(x * 0.02) * Math.cos(z * 0.018);
  let u = Math.atan2(z, x) + Math.PI + warp; // → roughly [0, 2π)
  u = ((u % TWO_PI) + TWO_PI) % TWO_PI;      // wrap into [0, 2π)
  const sector = Math.min(BIOME_ORDER.length - 1, Math.floor(u / (Math.PI / 2)));
  return BIOME_ORDER[sector];
}

/**
 * A comfortable anchor point inside a given biome at a chosen radius — used to drop
 * a mission marker in the heart of its own landschap. Starts on the sector's centre
 * line and, if that spot is off-biome (a wandering seam, or the forced ven shore that
 * sits inside the bos sector), searches the arc on BOTH sides, nearest first, so a
 * marker never ends up in another landschap (or in the ven water).
 *
 * The heart of the ven is its water, so a ven mission stands on the fen's bank instead
 * (`venBankSpot`) — the frog hides in the reeds by the water, not on a dry compass sector.
 */
export function anchorInBiome(biome: Biome, radius = 26): { x: number; z: number } {
  if (biome === 'ven') {
    const bank = venBankSpot(Math.max(0, Math.round((radius - 22) / 9)));
    if (bank) return bank;
  }
  const sector = BIOME_ORDER.indexOf(biome);
  const a0 = (sector + 0.5) * (Math.PI / 2) - Math.PI; // centre angle of the unwarped sector
  const STEP = 0.12;
  for (let k = 0; k <= 12; k++) {
    const a = a0 + (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2) * STEP; // 0, +δ, −δ, +2δ, …
    const x = Math.cos(a) * radius, z = Math.sin(a) * radius;
    if (biomeAt(x, z) === biome) return { x, z };
  }
  return { x: Math.cos(a0) * radius, z: Math.sin(a0) * radius };
}

/** Direction (from VEN_CENTER) of the bank the first ven mission stands on: the west
 *  bank, facing the clearing, just south of the vogelkijkhut. */
const VEN_BANK_ANGLE = Math.PI;

/**
 * The n-th ven mission's spot on the fen's bank: along a ray out of VEN_CENTER (the
 * first due west, later ones fanned south), the first point just behind the reed belt
 * whose ground stands a step above the water — dry moss bank, with the reeds and the
 * water right in front. Null when that ray finds no dry bank inside the ven shore.
 */
function venBankSpot(n: number): { x: number; z: number } | null {
  const a = VEN_BANK_ANGLE + n * 0.3;
  for (let r = VEN_REED_OUT + 1.5; r < VEN_SHORE_R - 1; r += 0.5) {
    const x = VEN_CENTER.x + Math.cos(a) * r, z = VEN_CENTER.z + Math.sin(a) * r;
    if (heightAt(x, z) >= WATER_LEVEL + 0.3) return { x, z };
  }
  return null;
}
