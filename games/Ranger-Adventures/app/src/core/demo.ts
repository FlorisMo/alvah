/**
 * demo.ts — pure demo-skip core (BUILD-PLAN §9g "demo-skip options").
 *
 * The §9g definition-of-done asks for demo controls so Floris + Alvah can test
 * any part of the game without grinding: jump to any area / mission / engine,
 * skip briefings, fast-forward the season/poacher arc. This module owns the
 * (THREE-free, DOM-free, deterministic) data those controls need — what's
 * jumpable, what's locked, which completion map resolves the whole arc — so the
 * `ui/DemoSkip.ts` flow layer stays thin and the logic is unit-testable.
 *
 * Minimal input shapes (like patrol.ts) keep it decoupled from the registry;
 * the live `Area`/`Mission` satisfy them structurally.
 */

import { SKILL_META, EF_ENGINES, type Engine } from './skill.ts';

/** Minimal mission shape the demo selectors read. */
export interface DemoMissionLike {
  id: string;
  titel: string;
  landschap: string;
  verhaalHaak?: string | null;
  stappen: readonly { ef: string }[];
}

/** Minimal area shape: a status (`actief` = jumpable) + its missions. */
export interface DemoAreaLike {
  id: string;
  naam: string;
  status?: string;
  missies: readonly DemoMissionLike[];
}

export interface DemoAreaTarget {
  id: string;
  naam: string;
  enabled: boolean;   // false for locked "binnenkort" areas — can't be jumped to
  status: string;
}

export interface DemoMissionTarget {
  id: string;
  titel: string;
  landschap: string;
  engine: Engine | null;   // the mission's lead engine (first step)
  engineLabel: string;     // its human breinkracht label (e.g. "Speurkracht")
  done: boolean;
  verhaalHaak: string | null;
}

export interface DemoEngineTarget {
  engine: Engine;
  label: string;   // SKILL_META naam
  taak: string;
}

const isEngine = (ef: string): ef is Engine =>
  (EF_ENGINES as readonly string[]).includes(ef);

/** The lead engine of a mission = the first step's ef (null if none / unknown). */
export function leadEngine(mission: DemoMissionLike): Engine | null {
  const ef = mission.stappen[0]?.ef;
  return ef && isEngine(ef) ? ef : null;
}

/** Every area as a jump target; `enabled` only for the active area (others are
 *  "binnenkort" — no content to jump into). Deterministic, input order preserved. */
export function demoAreaTargets(areas: readonly DemoAreaLike[]): DemoAreaTarget[] {
  return areas.map((a) => ({
    id: a.id,
    naam: a.naam,
    status: a.status ?? 'binnenkort',
    enabled: (a.status ?? 'binnenkort') === 'actief',
  }));
}

/** Every mission in the area as a jump target, with its lead-engine label + done
 *  flag (from the store's `voltooid` map). Authored order preserved. */
export function demoMissionTargets(
  area: DemoAreaLike,
  voltooid: Readonly<Record<string, boolean>>,
): DemoMissionTarget[] {
  return area.missies.map((m) => {
    const engine = leadEngine(m);
    return {
      id: m.id,
      titel: m.titel,
      landschap: m.landschap,
      engine,
      engineLabel: engine ? SKILL_META[engine].naam : m.stappen[0]?.ef ?? '—',
      done: !!voltooid[m.id],
      verhaalHaak: m.verhaalHaak ?? null,
    };
  });
}

/** The 5 EF engines as jump targets (the diegetic in-world activities). */
export function engineTargets(): DemoEngineTarget[] {
  return EF_ENGINES.map((e) => ({ engine: e, label: SKILL_META[e].naam, taak: SKILL_META[e].taak }));
}

/** A completion map marking EVERY mission in the area done — the "markeer alle
 *  missies klaar" fast-forward (surfaces all clues + badge progress at once). */
export function voltooidAll(area: DemoAreaLike): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const m of area.missies) map[m.id] = true;
  return map;
}

/** The verhaalHaak mission ids — completing these surfaces every case-board clue,
 *  so "los de verhaallijn op" marks exactly these done before reporting the arc.
 *  Deduped + authored order (two missions can share one hook). */
export function arcMissionIds(area: DemoAreaLike): string[] {
  const ids: string[] = [];
  for (const m of area.missies) if (m.verhaalHaak) ids.push(m.id);
  return ids;
}

/** A completion map that marks the arc-relevant (verhaalHaak) missions done,
 *  merged onto the current map — for "los de verhaallijn op" without clobbering
 *  unrelated progress. */
export function voltooidArc(
  area: DemoAreaLike,
  current: Readonly<Record<string, boolean>>,
): Record<string, boolean> {
  const map: Record<string, boolean> = { ...current };
  for (const id of arcMissionIds(area)) map[id] = true;
  return map;
}
