/**
 * adventure/registry.ts — the missions that are played as an ADVENTURE in the world
 * (design §3.1), and what the world and the flow need of each: its home (places,
 * residents, dressing), the ground it keeps bare, and its script. A mission not listed
 * here plays the classic path (a briefing, its games on a patch, the reward).
 */

import type { Mission } from '../../content/types';
import type { DressingBuilder, ResidentBody, Residents } from '../world/Residents';
import type { AdventureKit } from './kit';
import type { HomeSpec } from './types';
import { frislingAdventure } from './missions/frisling';
import { eekhoornAdventure } from './missions/eekhoorn';

export interface Adventure {
  /** the mission id */
  id: string;
  home: HomeSpec;
  /** ground the world's heath scatter leaves bare (mud, turned earth) */
  clearings?: readonly { x: number; z: number; r: number }[];
  /** the home's own trees (the forest draws them), and ground its scattered trees keep clear of */
  trees?: readonly { x: number; z: number; species: 'prop-oak-tree' | 'prop-pine-scots' | 'prop-birch-tree'; h: number; rotY: number }[];
  treeClear?: readonly { x: number; z: number; r: number }[];
  /** the home's THREE side, built with the world */
  dressing?: DressingBuilder;
  /** a resident's own body (a squirrel that climbs), instead of a walking animal's */
  actor?: ResidentBody;
  /** the mission's content, handed over before the world is built (its decoys ...) */
  bind?(mission: Mission): void;
  /** under the briefing card: get the world ready for this play (a trial's decoys) */
  prepare?(world: { residents: Residents }, mission: Mission): void;
  /** the briefing was left without playing: undo `prepare` (still under the card) */
  unprepare?(world: { residents: Residents }, mission: Mission): void;
  /** the script: the beats, in the world */
  play(k: AdventureKit): Promise<void>;
}

const ADVENTURES: Readonly<Record<string, Adventure>> = {
  frisling: frislingAdventure,
  eekhoorn: eekhoornAdventure,
};

/** The adventure a mission is played as, or null (the classic path). */
export function adventureFor(missionId: string): Adventure | null {
  return ADVENTURES[missionId] ?? null;
}

/** Every adventure (the world builds their homes). */
export function allAdventures(): readonly Adventure[] {
  return Object.values(ADVENTURES);
}
