/**
 * Sandbox.ts — the pure layout core for the compact Demo Sandbox (DEMO-SANDBOX.md
 * Tier 2; BUILD-PLAN §5 / §8d.7). NOT the full Veluwe: one small "ranger-station
 * showroom" clearing that holds EVERY character (calm-posed) and ONE trigger for each
 * interaction, all reachable in a few seconds, with an instant jump-menu.
 *
 * This module owns only the *geometry of placement* — where each cast member and each
 * interaction trigger sits, and the flat jump-menu target list. It is deliberately
 * THREE-free and deterministic (no Math.random / Date.now) so the scene is identical
 * every load and the seeded unit test can pin the invariants the showroom relies on:
 *
 *   • every cast member and every interaction is placed (nothing dropped),
 *   • no two placements overlap (≥ MIN_SPACING apart — calm, readable, never a pile-up),
 *   • everything sits inside a COMPACT radius, well within the World bound (116 m), so
 *     the whole demo is walkable in seconds,
 *   • interaction triggers ring the centre CLOSER than the cast, so "do something" is
 *     always a step or two away while the animals frame the clearing,
 *   • the jump-menu covers every target exactly once (the §9g demo-skip entry point).
 *
 * The render layer (75b) consumes this to build the actual scene; the live engines and
 * meta screens are reused unchanged, so the sandbox reflects later Phase 5/6 polish.
 */

/** What kind of jump-menu / trigger entry a placement is. */
export type SandboxKind = 'ranger' | 'ef' | 'meta' | 'cast';

/** An interaction the sandbox exposes a single in-world trigger for. */
export interface SandboxInteraction {
  /** stable id, e.g. an engine id ('zoeken') or a meta beat id ('companion'). */
  id: string;
  /** 'ef' = one of the five mini-games · 'meta' = companion/case-board/avatar/… */
  kind: 'ef' | 'meta';
  /** short M3/E3 label for the trigger + jump-menu (Dutch, kid-readable). */
  label: string;
}

/** A resolved position in the clearing (world XZ; y comes from the terrain at render). */
export interface SandboxPlacement {
  id: string;
  kind: SandboxKind;
  label: string;
  x: number;
  z: number;
  /** facing angle (radians) — everything faces the central station so the demo reads inward. */
  facing: number;
  /** which ring it sits on: 0 = centre, 1 = inner (interactions), 2+ = cast rings. */
  ring: number;
}

export interface SandboxLayout {
  placements: SandboxPlacement[];
  /** flat jump-menu (the demo-skip target list) — one entry per placement. */
  jumpTargets: { id: string; kind: SandboxKind; label: string; x: number; z: number }[];
  /** the compact radius every placement fits inside (for the camera framing + bound check). */
  radius: number;
}

// --- tuning (calm, compact, readable) ---
/** clearing stays tiny vs the World bound (116 m) so it's walkable in seconds. */
export const COMPACT_RADIUS = 22;
/** the interaction triggers ring this close to the central station. */
export const INNER_RING = 6.5;
/** the first cast ring; further rings step out by this much. */
export const CAST_RING_0 = 12;
export const CAST_RING_STEP = 4.5;
/** no two placements ever sit closer than this (no overlap / pile-up). */
export const MIN_SPACING = 3;
/** target chord spacing used to size cast rings — a touch above MIN_SPACING for calm
 *  reading, so rings pack full but never crowd to the hard floor. */
const CAST_ARC_SPACING = 4;

/** Place N items evenly around a ring of radius r, all facing the centre. */
function ring(
  items: { id: string; kind: SandboxKind; label: string }[],
  r: number,
  ringIndex: number,
  /** rotate the whole ring so successive rings interleave (no radial lineups). */
  offset: number,
): SandboxPlacement[] {
  const n = items.length;
  return items.map((it, i) => {
    const a = offset + (i / n) * Math.PI * 2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    return {
      id: it.id, kind: it.kind, label: it.label,
      x, z,
      facing: Math.atan2(-z, -x), // look back toward the origin station
      ring: ringIndex,
    };
  });
}

/**
 * Lay out the compact showroom: ranger at the centre, the interaction triggers on the
 * inner ring, all cast on concentric outer rings sized so spacing always holds.
 * Pure + deterministic; the order of `cast` / `interactions` fully determines the result.
 */
/**
 * The call key (for `Sound.call`) for a cast model id. The audio layer + the synth
 * `CALLS` table are keyed by the Dutch species token (wildzwijn / ree / raaf / …),
 * so we drop the leading category segment (animal/bird/figure/ranger/human/…) and
 * take the next segment as the species. Pure + deterministic so the 75b cast wiring
 * has a stable, unit-pinned mapping (a key with no real/synth entry just falls back
 * to the default motif — never throws). e.g. 'animal-wildzwijn-boar' → 'wildzwijn',
 * 'bird-merel' → 'merel', 'animal-raaf-fledgling' → 'raaf', 'figure-poacher' → 'poacher'.
 */
export function castCallKey(modelId: string): string {
  const parts = modelId.split('-').filter(Boolean);
  // a single-segment id (no category prefix) is its own key.
  return parts.length <= 1 ? (parts[0] ?? modelId) : parts[1];
}

export function sandboxLayout(input: {
  /** the ranger / player avatar id, parked at the central station. */
  ranger: string;
  /** every other character to show (animals, birds, other humanoids). */
  cast: string[];
  /** one trigger per interaction (the 5 EF + the meta beats). */
  interactions: SandboxInteraction[];
}): SandboxLayout {
  const placements: SandboxPlacement[] = [];

  // centre: the ranger station / player avatar.
  placements.push({
    id: input.ranger, kind: 'ranger', label: 'Jij (ranger)',
    x: 0, z: 0, facing: 0, ring: 0,
  });

  // inner ring: the interaction triggers, a step or two from the centre.
  placements.push(...ring(
    input.interactions.map((it) => ({ id: it.id, kind: it.kind as SandboxKind, label: it.label })),
    INNER_RING, 1, 0,
  ));

  // outer rings: the cast, fanned so a ring never crowds below MIN_SPACING. A ring of
  // radius r fits about ⌊2πr / MIN_SPACING⌋ items; we also cap per ring for calm reading.
  let ringIndex = 2;
  let placed = 0;
  while (placed < input.cast.length) {
    const r = CAST_RING_0 + (ringIndex - 2) * CAST_RING_STEP;
    // max items whose CHORD spacing (2r·sin(π/n)) clears CAST_ARC_SPACING — exact, not
    // the looser arc-length estimate, so the ≥ MIN_SPACING no-overlap invariant always
    // holds with margin and rings still pack full (the whole cast fits in a few rings).
    const cap = Math.max(1, Math.floor(Math.PI / Math.asin(Math.min(1, CAST_ARC_SPACING / (2 * r)))));
    const slice = input.cast.slice(placed, placed + cap);
    // half-step offset per ring so cast don't line up radially with the ring inside.
    placements.push(...ring(
      slice.map((id) => ({ id, kind: 'cast' as SandboxKind, label: id })),
      r, ringIndex, (ringIndex % 2) * (Math.PI / Math.max(slice.length, 1)),
    ));
    placed += slice.length;
    ringIndex++;
  }

  const radius = placements.reduce((m, p) => Math.max(m, Math.hypot(p.x, p.z)), 0);

  return {
    placements,
    jumpTargets: placements.map((p) => ({ id: p.id, kind: p.kind, label: p.label, x: p.x, z: p.z })),
    radius,
  };
}
