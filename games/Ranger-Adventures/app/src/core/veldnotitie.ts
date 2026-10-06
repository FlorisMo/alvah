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

/* ---- run 7 (words-ree): a small pool of facts per step, drawn unread-first ---- */

/** One "Wist je dat" fact: its veldnotitie id and its words. */
export interface Feit { id: string; tekst: string }

/**
 * A step's facts (run 7, words-ree): its `feit` first (id `<missionId>:<step>`, as it always
 * was, so an old save keeps its board), then its `meerFeiten` (ids `<missionId>:<step>.1`,
 * `.2` …: new ids, additive). Empty when the step has no fact.
 */
export function factPool(missionId: string, step: number, skin: { feit?: unknown; meerFeiten?: readonly string[] }): Feit[] {
  if (!skin.feit) return [];
  const base = `${missionId}:${step}`;
  return [
    { id: base, tekst: String(skin.feit) },
    ...(skin.meerFeiten ?? []).filter(Boolean).map((tekst, j) => ({ id: `${base}.${j + 1}`, tekst })),
  ];
}

/**
 * The fact a step shows THIS play (run 7, words-ree): one he has not read yet, drawn with
 * the play's own stream (`rng`, the play's `feit` fork); null once he has read them all —
 * a fact he read never comes back as a card. Pure.
 */
export function pickFact(pool: readonly Feit[], read: VeldnotitieSet, rng: () => number): Feit | null {
  const fresh = pool.filter((f) => !read[f.id]);
  if (!fresh.length) return null;
  return fresh[Math.min(fresh.length - 1, Math.floor(rng() * fresh.length))];
}

/**
 * The facts THIS play shows, step by step (run 7, words-ree): step index → its fact, only
 * for steps with one still unread. `m` of the "Wist je dat? · n/m" kicker is its size.
 * One stream for the whole play, drawn in step order (a replay of the seed shows the same).
 */
export function planFacts(missionId: string, steps: readonly { skin: { feit?: unknown; meerFeiten?: readonly string[] } }[],
  read: VeldnotitieSet, rng: () => number): Map<number, Feit> {
  const plan = new Map<number, Feit>();
  steps.forEach((st, i) => {
    const f = pickFact(factPool(missionId, i, st.skin), read, rng);
    if (f) plan.set(i, f);
  });
  return plan;
}
