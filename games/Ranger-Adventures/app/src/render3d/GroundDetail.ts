/**
 * GroundDetail.ts — W4.4 procedural ground albedo (pure, THREE-free).
 *
 * The world floor was a flat per-vertex biome slab (one solid colour per biome),
 * so heide/bos/stuifzand/ven each read as a single poster-paint fill. W4.4 gives
 * the ground a gouache feel WITHOUT any external texture and WITHOUT extra draw
 * calls, by combining two deterministic procedural layers, both defined here as
 * pure functions so the unit test can pin them:
 *
 *   1. `mottleRGB(u,v)` — a fine, SEAMLESSLY-TILEABLE painterly grain baked into
 *      ONE small canvas texture (`map`) that repeats over the whole terrain. It is
 *      near-white with soft darker pools (brush-shadow) and a faint golden warmth
 *      in the highlights, so multiplied against the biome vertex colour it reads
 *      as hand-brushed tonal variation, never a flat fill.
 *   2. `vertexTint(x,z)` — a low-frequency world-space brightness drift added to
 *      each ground vertex, so the macro surface has large soft light/dark
 *      blotches (a wash) on top of the fine grain.
 *
 * The canvas `map` darkens on average, so `GROUND_BRIGHTEN` lifts the biome
 * vertex colour to keep the overall daylight brightness at parity with the old
 * flat ground (golden-hour feel preserved) — the detail is added tone, not a
 * dimmer world.
 *
 * Everything is deterministic (no Math.random / Date.now): the world paints
 * identically every load and the seeded test pins tileability + range + mean.
 *
 * P1.2 extends this with `BIOME_GROUND_TONES` + `groundPatch(x,z)`: a per-biome
 * TWO-TONE ground so heide/bos/stuifzand/ven each read as real Veluwe ground
 * rather than one hue merely brightened by the wash above. Still THREE-free and
 * pure (type-only import of `Biome`), so the same unit test pins it.
 */

import type { Biome } from './Biomes';

/** Edge length in px of the repeating albedo tile the World bakes on a canvas. */
export const GROUND_TILE_PX = 256;
/** How many times the tile repeats across the 240 m ground (≈20 m per tile). */
export const GROUND_TILE_REPEAT = 12;
/** Compensates the average darkening of the mottle map so brightness stays put. */
export const GROUND_BRIGHTEN = 1.12;

const MOTTLE_MEAN = 0.9;   // average grey of the map (near-white, gentle shade)
const MOTTLE_AMP = 0.22;   // half-range of the tonal pools
const MOTTLE_WARM = 0.05;  // golden warmth in highlights / cool in the pools

/** 32-bit integer hash → a stable pseudo-random value in [0,1). */
function hash(ix: number, iy: number, seed: number): number {
  let h = (Math.imul(ix | 0, 374761393) + Math.imul(iy | 0, 668265263) + Math.imul(seed | 0, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smoothstep easing for value-noise interpolation. */
function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Value noise on an integer lattice. When `period > 0` the lattice wraps at that
 * period, so sampling coordinates over [0,period) tiles seamlessly (used for the
 * repeating canvas). `period = 0` means no wrap (used for the open world drift).
 */
function vnoise(x: number, y: number, seed: number, period: number): number {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = smooth(x - x0), fy = smooth(y - y0);
  const w = (i: number): number => (period > 0 ? ((i % period) + period) % period : i);
  const x0w = w(x0), x1w = w(x0 + 1), y0w = w(y0), y1w = w(y0 + 1);
  const a = hash(x0w, y0w, seed), b = hash(x1w, y0w, seed);
  const c = hash(x0w, y1w, seed), d = hash(x1w, y1w, seed);
  const top = a + (b - a) * fx;
  const bot = c + (d - c) * fx;
  return top + (bot - top) * fy;
}

/**
 * Fractal (multi-octave) tileable noise in [0,1] for the unit square (u,v) ∈
 * [0,1). Each octave uses an integer lattice frequency, so it tiles seamlessly:
 * the sample at u=1 lands on the SAME lattice node as u=0.
 */
function fbmTile(u: number, v: number, seed: number): number {
  const freqs = [3, 6, 12, 24];
  let sum = 0, amp = 0.5, norm = 0;
  for (let o = 0; o < freqs.length; o++) {
    const f = freqs[o];
    sum += amp * vnoise(u * f, v * f, seed + o * 101, f);
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm;
}

/**
 * The fine albedo grain for a canvas pixel at (u,v) ∈ [0,1). Returns an RGB
 * triple in [0,1], near-white with soft darker pools and a faint golden warmth in
 * the highlights. Seamlessly tileable in both axes.
 */
export function mottleRGB(u: number, v: number): [number, number, number] {
  const n = fbmTile(u, v, 1337);           // [0,1]
  const g = MOTTLE_MEAN + (n - 0.5) * 2 * MOTTLE_AMP;
  const warm = (n - 0.5) * 2 * MOTTLE_WARM; // + in highlights, − in pools
  const r = Math.min(1, Math.max(0, g * (1 + warm)));
  const gg = Math.min(1, Math.max(0, g));
  const b = Math.min(1, Math.max(0, g * (1 - warm)));
  return [r, gg, b];
}

/**
 * Low-frequency world-space brightness drift for a ground vertex at (x,z). A
 * two-octave open (non-tiled) value noise mapped to ~[0.92,1.08], so the macro
 * surface gains large soft wash blotches. Mean ≈ 1, so it neither brightens nor
 * darkens the world on average.
 */
export function vertexTint(x: number, z: number): number {
  const n =
    0.65 * vnoise(x * 0.03, z * 0.03, 71, 0) +
    0.35 * vnoise(x * 0.09 + 5, z * 0.09 + 5, 313, 0);
  return 0.92 + n * 0.16; // n∈[0,1] → [0.92,1.08]
}

/**
 * P1.2 — per-biome TWO-TONE ground so each landschap reads as real Veluwe ground
 * instead of one poster-paint fill (RUN-C-DIRECTION §2.2, grounded in
 * veluwe-research Deel 1). Each biome carries two characteristic ground tones
 * `[toneA, toneB]`; the render layer mixes them per vertex by `groundPatch(x,z)`
 * so the floor breaks into calm clumps of each tone — never a flat slab, never a
 * busy speckle. This adds NO draw call: it is still the single vertex-coloured
 * ground mesh; THREE decodes each hex to its working colour space and lerps.
 *
 *   • heide     — warm sandy soil ↔ dusty heather bloom (the famous paarse heide,
 *                 bare sand between the struikhei mats). The bloom tone carries a
 *                 clear (still calm) purple so the hub reads as flowering heath, not
 *                 a flat warm-brown slab — the muted grey-mauve it replaced washed to
 *                 brown under the golden key (P1.2 grade, 2026-07-05).
 *   • bos       — needle/leaf-litter brown ↔ soft forest moss (not flat green).
 *   • stuifzand — pale drift sand ↔ slightly darker rippled / grass-tuft sand.
 *   • ven       — mossy fen bank ↔ dark wet peat near the waterline.
 */
export const BIOME_GROUND_TONES: Record<Biome, readonly [string, string]> = {
  heide:     ['#c2a878', '#93608f'],
  bos:       ['#6a5636', '#4e5a35'],
  stuifzand: ['#ddcaa1', '#c6b485'],
  ven:       ['#5e6d45', '#46503a'],
};

/**
 * A soft, calm patch field in [0,1] for a ground vertex at (x,z), used to mix a
 * biome's two ground tones. Two octaves of open (non-tiled) value noise — a broad
 * ~70 m zone octave plus a ~23 m clump octave — pushed through a smoothstep so the
 * hue reads as broad clumps of one tone or the other rather than an even gradient.
 * Independent seeds/frequencies from `vertexTint`, so the hue patches and the
 * brightness wash never line up into visible banding. Deterministic (no
 * Math.random / Date.now) — the world paints identically every load.
 */
export function groundPatch(x: number, z: number): number {
  const n =
    0.7 * vnoise(x * 0.09 + 17, z * 0.09 - 9, 907, 0) +
    0.3 * vnoise(x * 0.27 - 3, z * 0.27 + 21, 4177, 0);
  return smooth(Math.min(1, Math.max(0, n)));
}
