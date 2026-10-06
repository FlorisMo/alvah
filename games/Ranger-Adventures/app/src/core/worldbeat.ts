/**
 * worldbeat.ts — light world-EF seasoning during free-roam patrol (BUILD-PLAN
 * §8b "EF-integration principle" + 3D-IMMERSION-PLAN §1.5). The five named
 * mini-games stay the explicit, countable core; this dusts the open world with
 * an occasional, *calm, skippable* executive-function micro-beat between
 * missions — never framed as brain-training, never-scary, never game-over.
 *
 * Two flavours:
 *  - **blijf-op-pad** (inhibition): a curious animal hops off the path; the
 *    prepotent impulse is to chase it, the ranger rule is to stay on the path.
 *  - **welke-kant** (spatial working memory): recall which way the next mission
 *    lies — only when there *is* a next heading to recall.
 *
 * This module is the pure, THREE-free / DOM-free / deterministic decision: WHEN
 * a beat fires (cadence), WHICH flavour, and WHICH option is the calm-correct
 * one. The flow layer renders it (≥56px, dual-channel colour+glyph, read-aloud)
 * and keeps it skippable. Mirrors the render-agnostic spine: logic here, screen
 * in `ui/`.
 */

import { ONDERWEG, vul } from '../content/copy.ts';

/** Light cadence: at most one beat every Nth *completed-mission* patrol return. */
export const WORLDBEAT_EVERY = 3;

/** Coarse heading to the next mission (the live wayfinding cue, bucketed). */
export type CoarseHeading = 'links' | 'rechtdoor' | 'rechts';
export type WorldBeatKind = 'blijf-op-pad' | 'welke-kant';

/** The drawn icon of an option (ui/icons.ts draws it; never an emoji). */
export type WorldBeatIcon = 'boot' | 'paw' | 'arrow';

export interface WorldBeatOption {
  label: string;
  /** Dual-channel **shape** cue (paired with a colour in the DOM layer) so the
   *  feedback never rides on colour alone: a drawn icon, turned by `turn` degrees. */
  icon: WorldBeatIcon;
  turn?: number;
  /** The arrow key that picks it on a keyboard (the direction beat's ←, ↑, →). */
  key?: 'ArrowLeft' | 'ArrowUp' | 'ArrowRight';
  correct: boolean;
}

export interface WorldBeat {
  kind: WorldBeatKind;
  /** The calm M3/E3 prompt line (read-aloud-ready). */
  prompt: string;
  /** Canonical option order. The flow may shuffle the two-option impulse beat;
   *  the three-direction beat keeps its fixed links→rechtdoor→rechts order (a
   *  stable compass row whose *correct* slot rotates, so order never cues). */
  options: WorldBeatOption[];
}

export interface WorldBeatInput {
  /** Monotonic count of in-world mission completions this session (starts at 0;
   *  back-outs and lodge launches do NOT advance it — only real patrol progress). */
  patrolTick: number;
  /** The next mission's coarse direction, or `null` when everything is done (no
   *  heading to recall ⇒ the welke-kant flavour is suppressed). */
  heading: CoarseHeading | null;
}

// Short lines (≤ 7 words, child B14; the words are in content/copy.ts): the impulse beat
// names the animal he can SEE (withAnimal), it never asks about one that is not there.
const IMPULSE: WorldBeat = {
  kind: 'blijf-op-pad',
  prompt: ONDERWEG.iemandWeg.join(' '),
  options: [
    { label: ONDERWEG.blijf, icon: 'boot', correct: true },
    { label: ONDERWEG.ren, icon: 'paw', correct: false },
  ],
};

/** The impulse beat about the animal in view: "Een vos loopt weg. Wat doe jij?". */
export function withAnimal(beat: WorldBeat, naam: string): WorldBeat {
  return beat.kind === 'blijf-op-pad' ? { ...beat, prompt: vul(ONDERWEG.dierWeg.join(' '), { dier: naam }) } : beat;
}

/** A beat never lands on the reward cards (child B14): it waits until the ranger has
 *  walked this far (m) on foot in free roam since the mission ended … */
export const WORLDBEAT_WALK_M = 15;
/** … and the impulse beat until a roaming animal is this close (m) and clearly in view
 *  (run 7, words-ree: 12 m, was 18 — a roe 24 m off at the picture's top edge, in the
 *  morning mist, was named while it could not be seen). */
export const WORLDBEAT_ANIMAL_M = 12;

/** May the armed beat come now? After WORLDBEAT_WALK_M of walking; the impulse beat
 *  also needs its animal in view (else it waits). */
export function beatReady(beat: WorldBeat, walked: number, animalInView: boolean): boolean {
  if (walked < WORLDBEAT_WALK_M) return false;
  return beat.kind === 'welke-kant' || animalInView;
}

function wayfindBeat(heading: CoarseHeading): WorldBeat {
  return {
    kind: 'welke-kant',
    prompt: ONDERWEG.welkeKant,
    options: [
      { label: ONDERWEG.links, icon: 'arrow', turn: -90, key: 'ArrowLeft', correct: heading === 'links' },
      { label: ONDERWEG.rechtdoor, icon: 'arrow', turn: 0, key: 'ArrowUp', correct: heading === 'rechtdoor' },
      { label: ONDERWEG.rechts, icon: 'arrow', turn: 90, key: 'ArrowRight', correct: heading === 'rechts' },
    ],
  };
}

/**
 * The micro-beat to offer on this patrol return, or `null` for "just resume".
 * Light by construction: fires only on the Nth completed-mission return
 * (`patrolTick > 0 && patrolTick % WORLDBEAT_EVERY === 0`). Flavours alternate —
 * impulse-resist first, then wayfinding-recall — and the wayfinding flavour
 * needs a live heading, so it falls back to the impulse beat when everything is
 * done (`heading === null`). Pure + deterministic: same input ⇒ same beat.
 */
export function pickWorldBeat(input: WorldBeatInput): WorldBeat | null {
  const { patrolTick, heading } = input;
  if (patrolTick <= 0 || patrolTick % WORLDBEAT_EVERY !== 0) return null;
  const occurrence = patrolTick / WORLDBEAT_EVERY; // 1, 2, 3, …
  const wantWayfind = heading !== null && occurrence % 2 === 0;
  return wantWayfind ? wayfindBeat(heading) : IMPULSE;
}

/** Did the chosen option satisfy the calm rule? Out-of-range ⇒ false (the flow
 *  re-presents the SAME beat — recoverable, never game-over). */
export function optionCorrect(beat: WorldBeat, index: number): boolean {
  return beat.options[index]?.correct ?? false;
}

/** Map the live wayfinding `richting` phrase onto the coarse heading the beat
 *  needs, or `null` when the heading isn't a clean left/ahead/right to recall
 *  ("achter je" / "je bent er" ⇒ no wayfinding beat this return). */
export function coarseHeading(richting: string | null | undefined): CoarseHeading | null {
  switch (richting) {
    case 'naar links': return 'links';
    case 'recht vooruit': return 'rechtdoor';
    case 'naar rechts': return 'rechts';
    default: return null;
  }
}
