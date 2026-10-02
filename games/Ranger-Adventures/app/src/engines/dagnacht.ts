/**
 * dagnacht.ts — EF engine "dagnacht" (Rustkracht: inhibition / impulse control,
 * Stroop-like), the render-agnostic task logic ported from prototype/step-danger.jsx. Each
 * encounter tempts an impulse (aai / pak / voer / recht-erdoor) the child must
 * inhibit in favour of the ranger rule; one encounter FLIPS so it stays a real
 * inhibition task, not "always say no". A wrong choice has a recoverable
 * consequence (the animal reacts, ground + a few eikels are lost) — never a
 * game-over. Difficulty knob: slowmo (a calmer choosing window while learning).
 *
 * Run 7 (`adaptive`, design §5.4): content can vary WHICH calm moments come and in which
 * ORDER: an encounter may name its `slot` (a station of the story), a skin its `rustPlan`
 * (the slots in story order; per slot how many to draw, shuffled or not). The trial's
 * order is drawn from the play's fork: a flip ("now it is allowed") never comes first,
 * the trial keeps one when the pool has one, two only from band 4 (`knobs.flips`). No
 * plan (or no rng): content order, as always. The 2D floor plays the same order.
 */

import type { Skin } from '../content/types';
import type { BeatSummary, RustKnobs } from '../core/skill';

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
  /** run 7: the story's station this moment belongs to (a skin's `rustPlan` orders the
   *  slots and draws within each) */
  slot?: string;
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

/** One slot of a skin's rust plan: the story's station, how many of its encounters come
 *  (default all), whether their order is shuffled (default true). */
export interface RustPlanSlot { slot: string; pick?: number; shuffle?: boolean }

/** What the trial reads besides the skin: the reading words (knappe woorden), the calmer
 *  window and how many flips may come (the level's knobs), reduced motion. The manual
 *  Settings fit it too (an older reader). */
export type DagnachtDiff = { jargon?: boolean; reducedMotion?: boolean } & Partial<Pick<RustKnobs, 'slowmo' | 'flips'>>;

/**
 * Resolve the encounters (in this play's order) + the slow-mo support window. With the
 * skin's `rustPlan` and a seeded `rng` (the play's `fork('dagnacht')`) the order is drawn
 * (`rustOrder`); else content order. The 2D floor, the classic stage and the world's
 * choices all build it here from the same fork, so the same seed gives the same order.
 */
export function buildDagnachtTrial(skin: Skin, diff: DagnachtDiff, rng?: () => number): DagnachtTrial {
  const authored = (skin.encounters as Encounter[] | undefined)?.length
    ? (skin.encounters as Encounter[])
    : FALLBACK;
  const plan = skin.rustPlan;
  const ordered = plan?.length && rng ? rustOrder(authored, plan, rng, diff.flips ?? 1) : authored;
  // "knappe woorden" on: the lines with the real terms; off (default): the plain lines
  const encounters = diff.jargon
    ? ordered.map((e) => ({ ...e, vraag: e.vraagKnap ?? e.vraag, uitleg: e.uitlegKnap ?? e.uitleg, gevolg: e.gevolgKnap ?? e.gevolg }))
    : [...ordered];
  return {
    encounters,
    regels: skin.regels ?? [],
    metgezel: skin.metgezel ?? 'frisling',
    slowmo: (diff.slowmo ?? false) && !diff.reducedMotion,
  };
}

/** A calm-moment order as the history keeps it (the play's note 'rust'): one letter per
 *  encounter, in order ('advzp'). */
export const rustCode = (ids: readonly string[]): string => ids.map((id) => id.charAt(0)).join('');

/** The calm-moment orders of his last `n` OTHER plays of a mission (newest first), as their
 *  beats noted them in the history (`BeatLog.va` 'rust:advzp'; one per play, by its seed). */
export function recentRust(history: readonly { m: string; sd?: number; va?: string }[], missionId: string, seed: number, n = 2): string[] {
  const out: string[] = [];
  const seen = new Set<number>();
  for (let i = history.length - 1; i >= 0 && out.length < n; i--) {
    const h = history[i];
    if (h.m !== missionId || !h.va || h.sd === seed || (h.sd !== undefined && seen.has(h.sd))) continue;
    const m = /(?:^|,)rust:([a-z]+)/.exec(h.va);
    if (!m) continue;
    if (h.sd !== undefined) seen.add(h.sd);
    out.push(m[1]);
  }
  return out;
}

/** What a play needs to draw its trial (core/play's Play). */
interface PlayLike { readonly missionId: string; readonly seed: number; fork(label: string): { rng(): number }; note(key: string, value: string | number): void }

/**
 * Run 7 (frisling ways): the trial THIS PLAY plays, a thin wrapper over
 * `buildDagnachtTrial` that every path builds through (the world's ChoiceRun, the 2D
 * floor, the classic stage): a skin with a `rustPlan` draws its order from the play's
 * 'dagnacht' fork, and while that order is one of his last two plays' of this mission (the
 * history) it is drawn again from the same stream — three plays in a row, three orders;
 * the same seed and the same history give the same order on every path. The order is noted
 * on the play ('rust'), so the history says what he played and the next play can tell. No
 * play: drawn from `loose` (a stream of no play, `looseRng`), or the content order.
 */
export function playDagnachtTrial(skin: Skin, diff: DagnachtDiff, play: PlayLike | null | undefined, history: readonly { m: string; sd?: number; va?: string }[], loose?: () => number): DagnachtTrial {
  if (!play) return buildDagnachtTrial(skin, diff, loose);
  const fork = play.fork('dagnacht');
  const rng = (): number => fork.rng();
  let trial = buildDagnachtTrial(skin, diff, rng);
  if (!skin.rustPlan?.length) return trial;
  const avoid = recentRust(history, play.missionId, play.seed);
  const code = (t: DagnachtTrial): string => rustCode(t.encounters.map((e) => e.id));
  for (let t = 0; t < 24 && avoid.includes(code(trial)); t++) trial = buildDagnachtTrial(skin, diff, rng);
  play.note('rust', code(trial));
  return trial;
}

/**
 * The calm moments of one play, in order (pure, seeded; design §5.4): the plan's slots in
 * story order, each slot's encounters drawn (`pick`, default all) and shuffled (default) by
 * `rng`. Rules: a flip is never the first moment (the "no" habit is built first: a flip
 * that would open the trial swaps with the first calm moment of its slot); the trial keeps
 * a flip when the pool has one; at most `maxFlips` flips (two from band 4, when content
 * offers two). Encounters in no slot of the plan come last, in content order. (A flip moves
 * only inside its own slot, so a home's `nextIn(slot)` stays true: give the plan's first
 * slot a calm moment, or its flip opens the trial.)
 */
export function rustOrder(all: readonly Encounter[], plan: readonly RustPlanSlot[], rng: () => number, maxFlips = 1): Encounter[] {
  const shuffle = <T>(xs: T[]): T[] => {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [xs[i], xs[j]] = [xs[j], xs[i]];
    }
    return xs;
  };
  const named = new Set(plan.map((p) => p.slot));
  const pools = plan.map((p) => all.filter((e) => e.slot === p.slot));
  const slots: Encounter[][] = plan.map((p, i) => {
    const pool = pools[i];
    return shuffle([...pool]).slice(0, Math.max(0, Math.min(pool.length, p.pick ?? pool.length)));
  });
  // the trial keeps a flip when the pool has one: the first slot that left its flip out
  // takes it in place of its last drawn moment
  if (!slots.some((xs) => xs.some((e) => e.flip))) {
    const i = pools.findIndex((pool, j) => slots[j].length > 0 && pool.some((e) => e.flip));
    if (i >= 0) slots[i][slots[i].length - 1] = pools[i].find((e) => e.flip)!;
  }
  // a slot that keeps content order: its drawn moments as content has them
  plan.forEach((p, i) => { if (p.shuffle === false) slots[i] = pools[i].filter((e) => slots[i].includes(e)); });
  slots.push(all.filter((e) => !e.slot || !named.has(e.slot)));
  // at most `maxFlips` flips (two only from band 4): the later ones go
  let flips = 0;
  const kept = slots.map((xs) => xs.filter((e) => !e.flip || ++flips <= Math.max(1, maxFlips)));
  // never a flip first: it swaps with the first calm moment of its slot
  const first = kept.find((xs) => xs.length);
  if (first && first[0].flip) {
    const j = first.findIndex((e) => !e.flip);
    if (j > 0) [first[0], first[j]] = [first[j], first[0]];
  }
  return kept.flat();
}

/**
 * DagnachtRun — the pure sequencing + scoring core shared by the 2D floor
 * (`render2d/DangerView`), the classic 3D stage (`render3d/engines/dagnacht3d`) and the
 * world's choices (`adventure/beats/choice`), so all emit an IDENTICAL `BeatSummary` for the
 * same trial + the same choices (construct parity). It walks the trial's encounters in
 * order; a correct choice advances; a wrong choice is RECOVERABLE — it marks the encounter
 * and re-presents it (never a game-over). `trials` = the encounters, `correct` = those
 * never answered wrong, `impulses` = every wrong choice however often (a wrong card, a hand
 * reaching in a body moment). No THREE, no DOM, no timing.
 */
export class DagnachtRun {
  private idx = 0;
  private readonly wrong = new Set<number>();
  private readonly total: number;
  private reaches = 0;

  constructor(total: number) { this.total = total; }

  /** the encounter currently being presented (0..total) */
  get index(): number { return this.idx; }

  /** every encounter has been passed */
  get finished(): boolean { return this.idx >= this.total; }

  /** wrong choices so far, however often on one encounter */
  get impulses(): number { return this.reaches; }

  /**
   * Record a choice on the current encounter. A good choice advances to the next
   * encounter (`'advance'`); a wrong choice marks this encounter once and keeps it
   * up for another try (`'retry'`) — recoverable, never game-over.
   */
  choose(goed: boolean): 'advance' | 'retry' {
    if (this.finished) return 'advance';
    if (goed) { this.idx += 1; return 'advance'; }
    this.wrong.add(this.idx);
    this.reaches += 1;
    return 'retry';
  }

  /** trials = the encounters, correct = encounters never answered wrong, impulses = wrong choices. */
  summary(): BeatSummary {
    return { trials: this.total, correct: Math.max(0, this.total - this.wrong.size), impulses: this.reaches };
  }
}
