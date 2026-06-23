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
import type { BeatSummary } from '../core/skill';

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

/**
 * DagnachtRun — the pure sequencing + scoring core shared by BOTH the 2D
 * (`render2d/DangerView`) and the diegetic 3D (`render3d/engines/dagnacht3d`)
 * views, so the two emit an IDENTICAL `BeatSummary` for the same trial + the same
 * choice sequence (construct parity, BUILD-PLAN §1f). It models exactly the frozen
 * inhibition task: walk the encounters in order; a correct choice advances to the
 * next encounter; a wrong choice is RECOVERABLE — it marks the encounter and
 * re-presents it (never a game-over). The score is the count of encounters that
 * were never answered wrong; `trials` is always the encounter total. No THREE, no
 * DOM, no timing — pure, so the seeded parity test runs under `node --test`.
 */
export class DagnachtRun {
  private idx = 0;
  private readonly wrong = new Set<number>();
  private readonly total: number;

  constructor(total: number) { this.total = total; }

  /** the encounter currently being presented (0..total) */
  get index(): number { return this.idx; }

  /** every encounter has been passed */
  get finished(): boolean { return this.idx >= this.total; }

  /**
   * Record a choice on the current encounter. A good choice advances to the next
   * encounter (`'advance'`); a wrong choice marks this encounter once and keeps it
   * up for another try (`'retry'`) — recoverable, never game-over.
   */
  choose(goed: boolean): 'advance' | 'retry' {
    if (this.finished) return 'advance';
    if (goed) { this.idx += 1; return 'advance'; }
    this.wrong.add(this.idx);
    return 'retry';
  }

  /** the parity-frozen summary: trials = total, correct = encounters never-wronged. */
  summary(): BeatSummary {
    return { trials: this.total, correct: Math.max(0, this.total - this.wrong.size) };
  }
}
