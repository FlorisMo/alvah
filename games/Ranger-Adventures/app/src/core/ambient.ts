/**
 * ambient.ts — pure biome/season-aware ambience-bed selection (BUILD-PLAN §6 102c).
 *
 * The audio pipeline stages a small set of looping beds (today `ambient-bos` +
 * `ambient-heide`; a season-specific bed like `ambient-heide-winter` may be
 * staged later). `pickAmbientBed` maps the biome the ranger is standing in (and,
 * when present, the current season) to the best AVAILABLE bed, degrading
 * gracefully so the game always has *some* calm bed when any is staged and falls
 * silently back to none when the manifest is empty.
 *
 * THREE-free / DOM-free / deterministic so it carries a seeded unit test; the
 * only side-effecting consumer is `calls.applyAmbient`.
 */

export type AmbientBiome = 'heide' | 'bos' | 'stuifzand' | 'ven';

/**
 * Acoustic fallback per biome, in preference order. Each entry names the biome
 * whose bed best stands in for this one when no exact bed is staged:
 *   - stuifzand (open, windy sand) reads closest to the heath wind bed,
 *   - ven (reed water near the wood edge) reads closest to the forest bed.
 * The biome's OWN bed always leads; the chain only matters when it is absent.
 */
const FALLBACK_CHAIN: Record<AmbientBiome, readonly AmbientBiome[]> = {
  heide: ['heide', 'stuifzand', 'bos', 'ven'],
  bos: ['bos', 'ven', 'heide', 'stuifzand'],
  stuifzand: ['stuifzand', 'heide', 'bos', 'ven'],
  ven: ['ven', 'bos', 'heide', 'stuifzand'],
};

/**
 * Pick the best available bed id for `biome` (and optional `season`).
 *
 * Priority, first present in `available` wins:
 *   1. `ambient-<biome>-<season>`   — a season-specific bed (forward-compatible)
 *   2. `ambient-<biome>`            — the biome's own bed
 *   3. `ambient-<fallback>` along the acoustic chain (season-suffixed, then plain)
 *   4. the first available bed (any) — better a calm bed than silence
 *   5. null                         — nothing staged
 *
 * @param available bed ids present in the manifest (e.g. `['ambient-bos','ambient-heide']`)
 */
export function pickAmbientBed(
  biome: AmbientBiome,
  available: readonly string[],
  season?: string,
): string | null {
  if (available.length === 0) return null;
  const has = (id: string) => (available.includes(id) ? id : null);
  const s = season?.trim().toLowerCase();

  for (const b of FALLBACK_CHAIN[biome]) {
    if (s) {
      const seasonal = has(`ambient-${b}-${s}`);
      if (seasonal) return seasonal;
    }
    const plain = has(`ambient-${b}`);
    if (plain) return plain;
  }

  return available[0] ?? null;
}
