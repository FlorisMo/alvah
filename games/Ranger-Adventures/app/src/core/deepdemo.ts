/**
 * deepdemo.ts — pure Deep Demo guided-tour script (BUILD-PLAN §5 / Capstone 132a).
 *
 * The Deep Demo is the autonomous review surface: a single narrated walk that
 * hits every capability of the finished game in the §132 order —
 *   boot → avatar → free-roam → meet the cast + hear their voice →
 *   play each of the 5 EF engines in-world → arc → companion → badges.
 *
 * This module owns ONLY the ordered beat list + a pure cursor (THREE-free,
 * DOM-free, deterministic). The `ui/DeepDemo.ts` runner reads a beat, opens the
 * matching LIVE screen, and steps the cursor — so the sequence is unit-testable
 * and the runner stays a thin reuse layer. Copy is authored to the M3/E3 norm
 * (`core/readlevel.ts`) so the tour narration passes the same tone gate as the
 * rest of the reading surface.
 */

import { EF_ENGINES, SKILL_META, type Engine } from './skill.ts';

/** What kind of live surface a beat opens. One per §132 checklist capability. */
export type DeepDemoKind =
  | 'boot'        // the title card / welcome
  | 'avatar'      // the avatar creator (make your ranger)
  | 'freeroam'    // the 3D world, free patrol
  | 'cast'        // the compact sandbox — meet every animal + hear its call
  | 'engine'      // play one EF engine in-world (carries `engine`)
  | 'arc'         // the case-board / poacher storyline resolve
  | 'companion'   // the cabin — care for the rescued raven
  | 'badges';     // the breinkracht badge wall

export interface DeepDemoBeat {
  /** Stable id (unique across the script). */
  id: string;
  kind: DeepDemoKind;
  /** Short serif heading for the narration card. */
  titel: string;
  /** One calm M3/E3 line (≤7 words/sentence) read aloud as the beat opens. */
  toelichting: string;
  /** Set only on `kind:'engine'` — which of the 5 EF activities this beat plays. */
  engine?: Engine;
}

/**
 * The ordered guided-tour beats. Deterministic: no clock, no randomness, the
 * engine beats follow `EF_ENGINES` order. Boot is always first; arc → companion
 * → badges always close. Each engine beat names its breinkracht so the tour
 * doubles as a tour of the five skills.
 */
export function deepDemoScript(): DeepDemoBeat[] {
  const engineBeatsList: DeepDemoBeat[] = EF_ENGINES.map((e) => ({
    id: `engine-${e}`,
    kind: 'engine' as const,
    titel: SKILL_META[e].naam,
    // ≤7 words/sentence; names the in-world task so each skill is introduced.
    toelichting: `Speel in het veld. ${SKILL_META[e].taak}.`,
    engine: e,
  }));

  return [
    {
      id: 'boot',
      kind: 'boot',
      titel: 'Word boswachter',
      toelichting: 'Welkom op de Veluwe. We kijken rond.',
    },
    {
      id: 'avatar',
      kind: 'avatar',
      titel: 'Maak je ranger',
      toelichting: 'Kies je eigen boswachter. Maak hem af.',
    },
    {
      id: 'freeroam',
      kind: 'freeroam',
      titel: 'Verken de Veluwe',
      toelichting: 'Loop vrij rond in 3D. Volg het pad.',
    },
    {
      id: 'cast',
      kind: 'cast',
      titel: 'Ontmoet de dieren',
      toelichting: 'Bekijk elk dier. Hoor zijn geluid.',
    },
    ...engineBeatsList,
    {
      id: 'arc',
      kind: 'arc',
      titel: 'Volg het spoor',
      toelichting: 'Zoek de stroper. Los het verhaal op.',
    },
    {
      id: 'companion',
      kind: 'companion',
      titel: 'Verzorg je raaf',
      toelichting: 'Een raaf raakte gewond. Zorg goed voor hem.',
    },
    {
      id: 'badges',
      kind: 'badges',
      titel: 'Je breinkracht',
      toelichting: 'Bekijk je badges. Zie hoe sterk je werd.',
    },
  ];
}

/** The engine beats only, in EF_ENGINES order. */
export function engineBeats(script: readonly DeepDemoBeat[]): DeepDemoBeat[] {
  return script.filter((b): b is DeepDemoBeat & { engine: Engine } => b.kind === 'engine');
}

/** The beat at `idx`, or null when out of range (the runner uses this to render). */
export function beatAt(script: readonly DeepDemoBeat[], idx: number): DeepDemoBeat | null {
  return script[idx] ?? null;
}

/** Next index, clamped to the last beat (the tour never overruns its end). */
export function nextBeat(script: readonly DeepDemoBeat[], idx: number): number {
  if (script.length === 0) return 0;
  return Math.min(idx + 1, script.length - 1);
}

/** Previous index, clamped to the first beat (never goes negative). */
export function prevBeat(idx: number): number {
  return Math.max(idx - 1, 0);
}

/** True when `idx` is the final beat (the runner shows "Klaar" instead of "Volgende"). */
export function isLastBeat(script: readonly DeepDemoBeat[], idx: number): boolean {
  return script.length > 0 && idx >= script.length - 1;
}
