/**
 * veldnotitie.ts — pure collection model for the W6.3b collectible veldnotities
 * (the "Wist je dat" facts pinned to the case-board). Render-agnostic and
 * telemetry-free, so state.ts wraps it and the unit test verifies it (same shape
 * as companion.ts). The collected-set is a plain id→true map, persisted inside
 * the shared `alvah-ef-v1` ranger namespace — no new localStorage key.
 *
 * Ids are content-derived in the registry (`<missionId>:<step>`), so a stale or
 * hand-edited save never desyncs from the content: an unknown id is just an
 * orphan flag the board ignores (it only renders ids the content still emits).
 */

export type VeldnotitieSet = Record<string, boolean>;

/**
 * Pin a veldnotitie id. Idempotent and empty-id-safe: returns the SAME reference
 * when nothing changes (already collected, or a blank id), so the caller can skip
 * a no-op commit and keep the board quiet on a replay.
 */
export function addVeldnotitie(set: VeldnotitieSet, id: string): VeldnotitieSet {
  if (!id || set[id]) return set;
  return { ...set, [id]: true };
}

/** How many of the given content-derived ids have been collected. */
export function collectedCount(set: VeldnotitieSet, allIds: readonly string[]): number {
  return allIds.reduce((n, id) => (set[id] ? n + 1 : n), 0);
}
