/**
 * patrol.ts — pure selectors for continuous in-world patrol (BUILD-PLAN §8d 2b,
 * "continuous in-world patrol"). After a mission is finished IN the world the
 * ranger does not return to the lodge; the wayfinding cue re-points to the next
 * thing to do so patrol flows on. This module holds the (THREE-free, DOM-free,
 * deterministic) "what next?" rule so the flow layer stays thin and testable.
 */

/** Minimal shape the selector needs — the live `Mission` satisfies it. */
export interface PatrolStop {
  id: string;
}

/** Minimal shape for the clue gate — a mission may carry a story hook. */
export interface ClueStop {
  /** The case-board clue id this mission pins when completed (the data gate). */
  verhaalHaak?: string | null;
}

/**
 * The clue a just-finished mission pins onto the case-board via the diegetic
 * "vastgelegd op de wildcamera → prikbord" beat — or `null` for no beat. The beat
 * fires only when the mission (a) carries a `verhaalHaak` story hook, (b) was
 * played IN the world (`fromWorld` — a lodge-launched mission returns to the hut
 * where the prikbord is already one tap away, so no in-flow interruption there),
 * and (c) the hook is **newly** appearing on the board — `alreadyFound` is the set
 * of clue ids found BEFORE this mission was marked done, so a replay (this mission
 * already pinned it) AND a second mission sharing the same hook (e.g. two "band"
 * missions) both correctly skip the beat. Pure + deterministic; mirrors the
 * `Content.cluesFound` data gate (a hook + a done flag = a found clue).
 */
export function capturedClue(
  mission: ClueStop,
  fromWorld: boolean,
  alreadyFound: ReadonlySet<string>,
): string | null {
  if (!fromWorld) return null;
  const hook = mission.verhaalHaak ?? null;
  if (!hook || alreadyFound.has(hook)) return null;
  return hook;
}

/**
 * The next mission the wayfinding cue should point at during patrol: the first
 * mission still to do, in the authored season order. `voltooid` is the store's
 * completion map (`markMissionDone` has already run for a just-finished mission,
 * so it is naturally skipped). Returns `null` when everything is done — patrol
 * then shows no heading (the case-board ontknoping is the climax, not a marker),
 * and the child can still walk up to any marker to replay it (never-game-over).
 */
export function nextPatrolTarget(
  missions: readonly PatrolStop[],
  voltooid: Readonly<Record<string, boolean>>,
): string | null {
  return missions.find((m) => !voltooid[m.id])?.id ?? null;
}
