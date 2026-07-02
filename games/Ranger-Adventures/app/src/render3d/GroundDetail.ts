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
 */

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
