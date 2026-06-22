/**
 * dagnacht.ts — EF engine "dagnacht" (inhibition / impulse control, Stroop-like),
 * the render-agnostic task logic ported from prototype/step-danger.jsx. Each
 * encounter tempts an impulse (aai / pak / voer / recht-erdoor) the child must
 * inhibit in favour of the ranger rule; one encounter FLIPS so it stays a real
 * inhibition task, not "always say no". A wrong choice has a recoverable
 * consequence (the animal reacts, ground + a few eikels are lost) — never a
 * game-over. Difficulty knob: slowmo (a calmer choosing window while learning).
 */

import type { Skin } from '../content/types';
import type { Settings } from '../core/state';

export interface EncounterOption {
  label: string;
  goed: boolean;
}

export interface Encounter {
  id: string;
  subject: string;                 // 'adder' | 'reekalf' | 'zwijn-honger' | 'modderpoel' | 'pad-veilig'
  vraag: string;
  opties: EncounterOption[];
  uitleg?: string;
  gevolg?: string;
  reactie?: string;                // 'flee' | 'rear' | 'swarm' | 'mud' | 'recede'
  flip?: boolean;
  terug?: number;                  // lost ground on a wrong choice (encounter units)
  eikelKost?: number;              // eikels spilled on a wrong choice
}

const FALLBACK: Encounter[] = [
  { id: 'x', subject: 'adder', vraag: 'Pas op. Blijf uit de buurt.',
    opties: [{ label: 'Nader', goed: false }, { label: 'Hou afstand', goed: true }],
    uitleg: 'Goed zo.', gevolg: 'De adder schrikt. Hou afstand.', reactie: 'rear' },
];

export interface DagnachtTrial {
  encounters: Encounter[];
  regels: string[];
  metgezel: string;
  slowmo: boolean;                 // calmer choosing window (support while learning)
}

/** Resolve the encounter list + the slow-mo support window. */
export function buildDagnachtTrial(skin: Skin, diff: Settings): DagnachtTrial {
  const encounters = (skin.encounters as Encounter[] | undefined)?.length
    ? (skin.encounters as Encounter[])
    : FALLBACK;
  return {
    encounters,
    regels: skin.regels ?? [],
    metgezel: skin.metgezel ?? 'frisling',
    slowmo: (diff.slowmo ?? false) && !diff.reducedMotion,
  };
}
