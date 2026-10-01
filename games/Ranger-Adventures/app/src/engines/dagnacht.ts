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
  subject: string;                 // 'adder' | 'reekalf' | 'zwijn-honger' | 'modderpoel' | 'pad-veilig' | 'frisling' | 'wildzwijn' (sow + piglets) | 'rotte'
  dier?: string;                   // the animal met (content id) — the 3D view stages its model
  pose?: 'ligt';                   // the animal lies still in the grass (the words say so)
  vraag: string;
  opties: EncounterOption[];
  uitleg?: string;
  gevolg?: string;
  /** the same lines with the "knappe woorden" (frisling, rotte, reegeit), used only when
   *  that setting is on; the plain lines above are the default (child:B9) */
  vraagKnap?: string;
  uitlegKnap?: string;
  gevolgKnap?: string;
  reactie?: string;                // 'flee' | 'rear' | 'swarm' | 'mud' | 'recede'
  flip?: boolean;
  terug?: number;                  // lost ground on a wrong choice (encounter units)
  eikelKost?: number;              // eikels spilled on a wrong choice
  /** run 7 (design foundation §5.4): the story slot it belongs to ('big', 'weg', 'thuis'):
   *  a skin's `rustPlan` orders the slots, and the encounters inside one slot are drawn
   *  in a seeded order */
  slot?: string;
}

/** Run 7 (design foundation §5.4): one slot of a skin's calm-moment plan, in story order:
 *  `pick` how many of its encounters come (default all), `shuffle` their order (default
 *  true). */
export interface RustPlanSlot { slot: string; pick?: number; shuffle?: boolean }

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

/**
 * The order the calm moments come in (run 7, design foundation §5.4). No `rustPlan` on the
 * skin, or no `rng`: the content order (the classic missions, a seed-less call). With a
 * plan: its slots in plan order, each slot's encounters drawn (`pick`) and shuffled by the
 * seed; encounters of no planned slot follow in content order. A flip is never the first
 * (the "no" habit is built first), and a pool with a flip keeps one. Pure: the 2D floor,
 * the classic stage and the world call it with the same play's fork ('dagnacht'), so they
 * play the same order.
 */
export function rustOrder(authored: readonly Encounter[], plan: readonly RustPlanSlot[] | undefined, rng?: () => number): Encounter[] {
  if (!plan?.length || !rng) return [...authored];
  const out: Encounter[] = [];
  const planned = new Set(plan.map((p) => p.slot));
  for (const p of plan) {
    let pool = authored.filter((e) => e.slot === p.slot);
    if (p.shuffle !== false || (p.pick ?? pool.length) < pool.length) {
      pool = [...pool];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
    }
    const n = Math.max(0, Math.min(pool.length, p.pick ?? pool.length));
    let take = pool.slice(0, n);
    // a pool with a flip keeps one (the flip is what makes it an inhibition task)
    const flip = pool.find((e) => e.flip);
    if (flip && n > 0 && !take.some((e) => e.flip)) take = [...take.slice(0, n - 1), flip];
    // a drawn subset keeps the order it was shuffled into; an unshuffled slot its content order
    if (p.shuffle === false) take.sort((a, b) => authored.indexOf(a) - authored.indexOf(b));
    out.push(...take);
  }
  out.push(...authored.filter((e) => !e.slot || !planned.has(e.slot)));
  // never a flip first
  if (out[0]?.flip) {
    const i = out.findIndex((e) => !e.flip);
    if (i > 0) out.unshift(...out.splice(i, 1));
  }
  return out;
}

/** Resolve the encounter list + the slow-mo support window. Run 7: `rng` (the play's
 *  'dagnacht' fork) draws the order of a skin with a `rustPlan` (`rustOrder`). */
export function buildDagnachtTrial(skin: Skin, diff: Settings, rng?: () => number): DagnachtTrial {
  const authored = rustOrder((skin.encounters as Encounter[] | undefined)?.length
    ? (skin.encounters as Encounter[])
    : FALLBACK, skin.rustPlan as readonly RustPlanSlot[] | undefined, rng);
  // "knappe woorden" on: the lines with the real terms; off (default): the plain lines
  const encounters = diff.jargon
    ? authored.map((e) => ({ ...e, vraag: e.vraagKnap ?? e.vraag, uitleg: e.uitlegKnap ?? e.uitleg, gevolg: e.gevolgKnap ?? e.gevolg }))
    : authored;
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
