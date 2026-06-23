/**
 * persist.ts — the localStorage namespacing + legacy migration for the Ranger
 * save (RUN-LEDGER Phase 8: "migrate `ranger-mvp-state` → `alvah-ef-v1`").
 *
 * WHY a namespace, not a rename. `alvah-ef-v1` is NOT free — the existing
 * `/spelen` practice games already own that key (one unified JSON blob:
 * `schemaVersion`/`preferences`/`exercises`/`mijlpalen`, see
 * `src/scripts/storage.js` + `docs/practice-games-schema.md`). Blindly writing
 * the Ranger `GameState` to that key would clobber Alvah's `/spelen` progress
 * (and `/spelen`'s `migrate()` would re-stub the wiped exercises). So the run's
 * §9g "migrate to `alvah-ef-v1`" is honoured by **co-tenanting**: the whole
 * Ranger state lives under a single `ranger` property INSIDE the shared blob,
 * read-modify-written so every other namespace is preserved untouched. This is
 * exactly the spirit of "reuse `src/scripts/` where it fits" — the two games
 * can't share the storage *wrapper* (different schemas, different module
 * systems: ESM-bundled Vite app vs. the site's plain `src/scripts/*.js`), but
 * they DO share the one key, coexisting instead of fighting over it.
 *
 * These helpers are pure (raw strings in, raw string/partial out) so the
 * migration is unit-testable without a DOM/localStorage. `state.ts` wires them
 * to the real `localStorage`.
 */

/** The shared site-wide EF key (also used by `/spelen`). */
export const STORAGE_KEY = 'alvah-ef-v1';
/** The Ranger state's property within the shared blob. */
export const RANGER_NS = 'ranger';
/** The pre-migration standalone key (one-time read-then-drop). */
export const LEGACY_KEY = 'ranger-mvp-state';

type Dict = Record<string, unknown>;

/** Parse the unified root blob, tolerant: non-object/garbage → `{}`. */
function parseRoot(raw: string | null): Dict {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw);
    return o && typeof o === 'object' && !Array.isArray(o) ? (o as Dict) : {};
  } catch {
    return {};
  }
}

function asObject(v: unknown): Dict | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Dict) : null;
}

/**
 * Resolve the persisted Ranger state partial. Preference order:
 *   1. the `ranger` namespace inside the shared `alvah-ef-v1` blob (current), then
 *   2. the legacy standalone `ranger-mvp-state` key (one-time migration source).
 * Returns `null` when nothing is persisted (→ caller builds a fresh state).
 * Never throws; bad JSON in either source is treated as absent.
 */
export function readRangerPartial(
  rootRaw: string | null,
  legacyRaw: string | null,
): Dict | null {
  const ns = asObject(parseRoot(rootRaw)[RANGER_NS]);
  if (ns) return ns;
  if (legacyRaw) {
    try {
      const legacy = asObject(JSON.parse(legacyRaw));
      if (legacy) return legacy;
    } catch {
      /* legacy blob corrupt → treat as absent */
    }
  }
  return null;
}

/**
 * Merge the Ranger `state` into the shared blob under the `ranger` namespace
 * WITHOUT touching any other property (the `/spelen`
 * `exercises`/`mijlpalen`/`preferences`/`schemaVersion` survive verbatim).
 * Returns the serialized string to write back to {@link STORAGE_KEY}.
 */
export function writeRangerRoot(rootRaw: string | null, state: unknown): string {
  const root = parseRoot(rootRaw);
  root[RANGER_NS] = state;
  return JSON.stringify(root);
}
