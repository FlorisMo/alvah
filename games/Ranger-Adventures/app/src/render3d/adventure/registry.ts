/**
 * adventure/registry.ts — the missions that are played as an ADVENTURE in the world
 * (design §3.1), and what the world and the flow need of each: its home (places,
 * residents, dressing), the ground it keeps bare, and its script. A mission not listed
 * here plays the classic path (a briefing, its games on a patch, the reward).
 */

import type { Mission } from '../../content/types';
import type { DressingBuilder, ResidentBody, Residents } from '../world/Residents';
import type { HomeTree } from '../World';
import type { AdventureKit } from './kit';
import type { HomeSpec } from './types';
import type { Play } from '../../core/play';
import type { MoodId } from '../Moods';
import { frislingAdventure } from './missions/frisling';
import { reeAdventure } from './missions/ree';
import { wildcameraAdventure } from './missions/wildcamera';
import { eekhoornAdventure } from './missions/eekhoorn';
import { venAdventure } from './missions/ven';
import { ecoductAdventure } from './missions/ecoduct';
import { stuifzandAdventure } from './missions/stuifzand';

export interface Adventure {
  /** the mission id */
  id: string;
  home: HomeSpec;
  /** ground the world's heath scatter leaves bare (mud, turned earth) */
  clearings?: readonly { x: number; z: number; r: number }[];
  /** ground the forest's scattered trees keep clear of (a glade, a game trail) */
  treeClearings?: readonly { x: number; z: number; r: number }[];
  /** trees the home plants itself, as real forest trees (a camera pine) */
  trees?: readonly HomeTree[];
  /** the home's THREE side, built with the world */
  dressing?: DressingBuilder;
  /** a resident's own body (a squirrel that climbs), instead of a walking animal's */
  actor?: ResidentBody;
  /** the mission's content, handed over before the world is built (its decoys ...) */
  bind?(mission: Mission): void;
  /** under the briefing card: get the world ready for this play (a trial's decoys). Run 7:
   *  `play` is THIS play's variety (drawn at the briefing, design §4.1): lay this play's
   *  hiding spot, route, order … from its forks here */
  prepare?(world: { residents: Residents }, mission: Mission, play: Play): void;
  /** the briefing was left without playing: undo `prepare` (still under the card) */
  unprepare?(world: { residents: Residents }, mission: Mission): void;
  /** the script: the beats, in the world */
  play(k: AdventureKit): Promise<void>;
  /** run 7 (design §4.5): the light this home plays in — only these moods (`allow`; the
   *  session's mood when it is one of them, else one drawn from them), and/or a new one
   *  each play (`perPlay`; run 7, additive: a number = never one of the home's last that
   *  many plays' moods). Default: the session's mood. */
  moods?: { allow?: readonly MoodId[]; perPlay?: boolean | number };
}

const ADVENTURES: Readonly<Record<string, Adventure>> = {
  frisling: frislingAdventure,
  'ree-niet-aanraken': reeAdventure,
  wildcamera: wildcameraAdventure,
  eekhoorn: eekhoornAdventure,
  // run 7 (the adventures lane): the ven after the four met first — the story order
  // follows this registry's order (WorldSession.storyOrder)
  ven: venAdventure,
  // run 7 (the adventures lane, package oversteek): De oversteek at the real ecoduct, after
  // the ven (the story order offers it next)
  ecoduct: ecoductAdventure,
  // run 7 (the adventures lane, package stille-zand): Het stille zand on the drift sand, after
  // the ecoduct (the story order offers it next)
  stuifzand: stuifzandAdventure,
};

/** The adventure a mission is played as, or null (the classic path). */
export function adventureFor(missionId: string): Adventure | null {
  return ADVENTURES[missionId] ?? null;
}

/** Every adventure (the world builds their homes). */
export function allAdventures(): readonly Adventure[] {
  return Object.values(ADVENTURES);
}
