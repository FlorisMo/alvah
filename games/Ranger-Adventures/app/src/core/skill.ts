/**
 * skill.ts — difficulty that grows with him, per breinkracht (run 7 `adaptive`, design
 * `state/foundation/design.md` §5; first ported from prototype/skill.jsx). Pure,
 * telemetry-free logic:
 *
 *  - each breinkracht has a LEVEL (1..6): where its next beat starts. A finished beat is
 *    judged by its own engine (`judgeBeat`): won EASILY (+1.0, a whole step he will feel),
 *    FINE (+0.34), STEADY (no change) or HARD (−0.5, silent). A summary without the
 *    engine's own fields (the hut's care game) falls back to the old accuracy staircase.
 *  - the FLOOR is one step under his best (`max(1, best − 1)`): never back to baby level.
 *  - the KNOBS a beat and its 2D floor read come from the level's BAND (`floor(level)`),
 *    from one table per breinkracht (`knobsFor`); inside a beat the pure cores grow while
 *    he succeeds and ease silently when he struggles (engines/span.ts, …).
 *  - down is never shown or said; `best` is the high-water mark (badges never drop).
 *
 * Render-agnostic and framework-free; state.ts holds the records and resolves the knobs.
 */

export type Engine = 'zoeken' | 'corsi' | 'simon' | 'dagnacht' | 'wisselen';

export const EF_ENGINES: readonly Engine[] = ['zoeken', 'corsi', 'simon', 'dagnacht', 'wisselen'];

/** The drawn line icon of each breinkracht (ui/icons.ts draws them). */
export type SkillIcon = 'magnifier' | 'route' | 'ear' | 'hand' | 'swap';

export interface SkillMeta {
  badgeId: string;
  naam: string;
  taak: string;
  kleur: string;
  /** the badge picture: what the ranger DOES with this breinkracht (a child reads
   *  the picture, not a letter) — a drawn icon, never an emoji (run 6) */
  icon: SkillIcon;
}

/** Per-engine identity for the 5 breinkracht badges (data, not hardcoded UI). */
export const SKILL_META: Record<Engine, SkillMeta> = {
  zoeken:   { badgeId: 'brein-zoeken',   naam: 'Speurkracht',    taak: 'Speuren',         kleur: '#5e8c3a', icon: 'magnifier' },
  corsi:    { badgeId: 'brein-corsi',    naam: 'Geheugenkracht', taak: 'Route onthouden', kleur: '#2f6fb0', icon: 'route' },
  simon:    { badgeId: 'brein-simon',    naam: 'Echokracht',     taak: 'Naroepen',        kleur: '#bb6a2c', icon: 'ear' },
  dagnacht: { badgeId: 'brein-dagnacht', naam: 'Rustkracht',     taak: 'Rustig blijven',  kleur: '#7a52b3', icon: 'hand' },
  wisselen: { badgeId: 'brein-wisselen', naam: 'Wisselkracht',   taak: 'Omschakelen',     kleur: '#c1467e', icon: 'swap' },
};

export const SKILL_MIN = 1;
export const SKILL_MAX = 6;
const SKILL_STEP = 0.34;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const clampInt = (v: number, lo: number, hi: number): number => Math.round(clamp(v, lo, hi));

export interface Reversal {
  dir: number;
  at: number;
}

export interface SkillRecord {
  level: number;        // live difficulty; the START point for new missions
  best: number;         // highest reached (never shown as a "drop")
  reversals: Reversal[]; // recent up/down steps, for the staircase
  recent: boolean[];    // last N successes (rolling window)
  trials: number;       // lifetime trials on this engine (rounds, sorts, encounters: a count, never a floor)
  beats: number;        // beats played on this engine (run 7: an old save gets min(trials, 50))
}

export type SkillSet = Record<Engine, SkillRecord>;

export function blankSkill(): SkillRecord {
  return { level: 1, best: 1, reversals: [], recent: [], trials: 0, beats: 0 };
}

export function blankSkillSet(): SkillSet {
  return {
    zoeken: blankSkill(),
    corsi: blankSkill(),
    simon: blankSkill(),
    dagnacht: blankSkill(),
    wisselen: blankSkill(),
  };
}

/** The floor under a breinkracht: one step under his best, never below 1 (design §5.1). A
 *  struggling beat eases him at most down to here, so practice sticks without a lift he
 *  did not earn (the old trial-count floor lifted a struggling child and jumped rustkracht
 *  a whole level per mission: retired in run 7). */
export function skillFloor(best: number): number {
  return Math.max(SKILL_MIN, (best || 1) - 1);
}

/** The band a level plays at (the row of the knob tables): 1..6. */
export function bandOf(level: number): number {
  return Math.max(SKILL_MIN, Math.min(SKILL_MAX, Math.floor(level + 1e-9)));
}

export interface Tier {
  id: string;
  naam: string;
  kleur: string;
  ring: string;
  glow: string;
}

/** Tier from the high-water mark (never shows a drop). */
export function tierFor(best: number): Tier {
  if (best >= 4)   return { id: 'goud',   naam: 'Goud',   kleur: '#e0a92e', ring: '#f4d987', glow: 'rgba(224,169,46,.45)' };
  if (best >= 2.5) return { id: 'zilver', naam: 'Zilver', kleur: '#aab4bf', ring: '#dde3ea', glow: 'rgba(170,180,191,.4)' };
  return                  { id: 'brons',  naam: 'Brons',  kleur: '#c08a52', ring: '#dcb487', glow: 'rgba(192,138,82,.4)' };
}

/** Progress 0..1 toward the next tier (for the badge ring). */
export function badgeProgress(best: number): number {
  if (best >= 4)   return 1;
  if (best >= 2.5) return clamp((best - 2.5) / (4 - 2.5), 0, 1);
  return clamp((best - 1) / (2.5 - 1), 0, 1);
}

export interface BeatSummary {
  trials?: number;
  correct?: number;
  success?: boolean;
  /* run 7 (additive): what was played, for the history (BeatLog) and the adaptive judgement */
  /** corsi, simon: the longest sequence echoed cleanly; its first length; sequences played;
   *  how often a round was eased (silently); whether the FIRST round was echoed clean */
  span?: number;
  start?: number;
  rounds?: number;
  eased?: number;
  firstClean?: boolean;
  /** zoeken: wrong taps, seconds to the find, a hint was given */
  misses?: number;
  seconds?: number;
  hinted?: boolean;
  /** dagnacht: wrong choices however often (a reach in a body moment, a wrong card), the
   *  longest hold (s, only where there is a hold) */
  impulses?: number;
  holdS?: number;
  /** wisselen: rule turns played, wrong sorts right after a turn */
  switches?: number;
  switchErrors?: number;
}

/** How a finished beat went, judged by its own breinkracht (design §5.2-5.5). */
export type Judgement = 'easy' | 'fine' | 'steady' | 'hard';

/** The level change per judgement: a whole step for an easy win (one he will feel), a third
 *  for a fine one, none for a steady one, half a step down (silently) for a hard one. */
export const STEP_OF: Readonly<Record<Judgement, number>> = { easy: 1.0, fine: 0.34, steady: 0, hard: -0.5 };

/**
 * Judge a beat by its own engine's rules, or null when the summary lacks that engine's own
 * fields (the hut's care game, an old caller: the accuracy staircase decides there).
 *  - simon, corsi: easy = round 1 clean AND a clean echo past the start; fine = round 1
 *    clean; hard = round 1 not clean.
 *  - zoeken: easy = clean, no hint, ≤ 8 s; fine = clean; hard = ≥ 2 misses or a hint.
 *  - dagnacht: easy = every encounter right first time and ≤ 1 impulse; fine = ≥ 80 %
 *    right; hard = < 50 % right.
 *  - wisselen: easy = no switch error and ≤ 1 wrong; fine = ≥ 80 % right; hard = ≥ 2
 *    switch errors or < 60 % right.
 */
export function judgeBeat(engine: Engine, s: BeatSummary): Judgement | null {
  const trials = Math.max(1, s.trials ?? 1);
  const correct = s.correct ?? (s.success ? trials : 0);
  const acc = correct / trials;
  switch (engine) {
    case 'simon':
    case 'corsi':
      if (s.span == null || s.start == null || s.firstClean == null) return null;
      if (!s.firstClean) return 'hard';
      return s.span >= s.start + 1 ? 'easy' : 'fine';
    case 'zoeken': {
      if (s.seconds == null || s.misses == null) return null;
      if (s.misses >= 2 || s.hinted) return 'hard';
      if (s.misses === 0) return s.seconds <= ZOEK_EASY_S ? 'easy' : 'fine';
      return 'steady';
    }
    case 'dagnacht':
      if (s.impulses == null) return null;
      if (correct >= trials && s.impulses <= 1) return 'easy';
      if (acc >= 0.8) return 'fine';
      if (acc < 0.5) return 'hard';
      return 'steady';
    case 'wisselen': {
      if (s.switches == null || s.switchErrors == null) return null;
      const wrong = trials - correct;
      if (s.switchErrors >= 2 || acc < 0.6) return 'hard';
      if (s.switchErrors === 0 && wrong <= 1) return 'easy';
      if (acc >= 0.8) return 'fine';
      return 'steady';
    }
    default:
      return null;
  }
}

/** A find within this many seconds, clean and without a hint, is an easy one. */
export const ZOEK_EASY_S = 8;

/**
 * Update one breinkracht's record from a finished beat (design §5.1): judged by its engine
 * (`judgeBeat`), else by the old accuracy staircase (±0.34). Clamped to [floor, 6] where
 * floor = best − 1 (never below 1), at most a whole step up per beat; `best` is raised.
 * `engine` may be left out (an old caller): then only the staircase decides.
 */
export function updateSkill(prev: SkillRecord | undefined, summary: BeatSummary, engine?: Engine): SkillRecord {
  const rec: SkillRecord = prev ? { ...blankSkill(), ...prev } : blankSkill();
  const trials = Math.max(1, summary.trials ?? 1);
  const correct = Math.min(trials, summary.correct != null ? summary.correct : (summary.success ? trials : 0));
  const acc = trials > 0 ? correct / trials : 1;
  const newTrials = (rec.trials || 0) + trials;

  const judged = engine ? judgeBeat(engine, summary) : null;
  // the old staircase for a summary without the engine's own fields (the hut's care game)
  const delta = judged ? STEP_OF[judged] : acc >= 0.8 ? SKILL_STEP : acc < 0.5 ? -SKILL_STEP : 0;
  const was = rec.level || 1;
  const reversals: Reversal[] = [...(rec.reversals || [])];
  const dir = Math.sign(delta);
  if (dir !== 0) {
    const last = reversals.length ? reversals[reversals.length - 1].dir : 0;
    if (last !== dir) reversals.push({ dir, at: newTrials });
  }
  const floor = skillFloor(rec.best || 1);
  const level = clamp(was + Math.min(1, delta), floor, SKILL_MAX);
  const best = Math.max(rec.best || 1, level);

  const recent: boolean[] = [...(rec.recent || [])];
  for (let i = 0; i < trials; i++) recent.push(i < correct);

  return {
    level: Math.round(level * 1000) / 1000,
    best: Math.round(best * 1000) / 1000,
    reversals: reversals.slice(-12),
    recent: recent.slice(-8),
    trials: newTrials,
    beats: (rec.beats || 0) + 1,
  };
}

/** The level crossed a whole number upward: a step he will feel (the reward card's calm
 *  "groeit" mark, design §5.8). */
export function grewBand(before: number, after: number): boolean {
  return bandOf(after) > bandOf(before);
}

/** Difficulty fields the older code reads (`store.difficulty`, the manual Tweak sliders).
 *  Run 7: every view reads `EngineKnobs` instead; at a level these are DERIVED from the
 *  same tables (`knobsForLevel`), so an older reader sees the same numbers. */
export interface DifficultyKnobs {
  afleiders?: number;
  lensSterkte?: number;
  spoorLengte?: number;
  spoorHelderheid?: number;
  routeLengte?: number;
  simonLengte?: number;
  slowmo?: boolean;
  wisselFreq?: number;
}

/* ------------------------------------------------- run 7: the knobs (§4.2, §5) ---- */

/** Speurkracht: how many look-alikes come with the animal, how much of it shows through its
 *  cover from the framed view (0..1), seconds before the first diegetic hint, and the
 *  tracking leg (prints to follow, how clear they are 0..1). */
export interface ZoekKnobs { lookAlikes: number; glimpse: number; hintAfterS: number; trailLegs: number; trailClarity: number }
/** Geheugenkracht and Echokracht: the first sequence's length, the longest a beat may grow
 *  to, how many sequences a beat plays. */
export interface SpanKnobs { start: number; max: number; rounds: number }
/** Rustkracht: seconds of stillness a body moment wants after its line, temptations during
 *  one hold, how long he may wait at a go-moment, the calmer choosing window, and how many
 *  "now it is allowed" moments may come in one beat (two only from band 4, when content
 *  offers two). */
export interface RustKnobs { holdS: number; tempts: number; goWaitS: number; slowmo: boolean; flips: number }
/** Wisselkracht: the aim round's length, right sorts before the rule turns, how many turns. */
export interface WisselKnobs { sorts: number; flipEvery: number; flips: number }
export interface EngineKnobs { zoeken: ZoekKnobs; corsi: SpanKnobs; simon: SpanKnobs; dagnacht: RustKnobs; wisselen: WisselKnobs }

/** The knob tables, one row per band 1..6 (design §5.2-5.5). Variety never touches these:
 *  only the level moves them. */
export const KNOB_TABLES = {
  zoeken: {
    lookAlikes: [4, 5, 5, 6, 7, 8],
    glimpse: [0.38, 0.32, 0.27, 0.23, 0.20, 0.16],
    hintAfterS: [10, 12, 14, 16, 18, 20],
    trailLegs: [2, 3, 3, 4, 4, 5],
    trailClarity: [0.95, 0.85, 0.72, 0.60, 0.50, 0.40],
  },
  simon: { start: [2, 3, 3, 4, 4, 5], rounds: [3, 3, 4, 4, 4, 4], max: 7 },
  corsi: { start: [3, 3, 4, 4, 5, 5], rounds: [2, 2, 2, 3, 3, 3], max: 6 },
  dagnacht: { holdS: [3, 3.5, 4, 4.5, 5, 6], tempts: [1, 1, 2, 2, 3, 3], goWaitS: [9, 8, 7, 6, 5, 5], flips: [1, 1, 1, 2, 2, 2] },
  wisselen: { sorts: [6, 6, 8, 8, 10, 10], flipEvery: [4, 4, 3, 3, 3, 2], flips: [1, 1, 1, 2, 2, 2] },
} as const;

/** The knobs of a breinkracht at a level (1..6): its band's row. The same knobs the 2D floor,
 *  the classic stage and the world's beat read (design §4.2); a game maps them onto its
 *  world and never invents its own number. */
export function knobsFor<E extends Engine>(engine: E, level: number): EngineKnobs[E] {
  const i = bandOf(level) - 1;
  const T = KNOB_TABLES;
  const k = ((): EngineKnobs[Engine] => {
    switch (engine) {
      case 'zoeken':
        return {
          lookAlikes: T.zoeken.lookAlikes[i], glimpse: T.zoeken.glimpse[i], hintAfterS: T.zoeken.hintAfterS[i],
          trailLegs: T.zoeken.trailLegs[i], trailClarity: T.zoeken.trailClarity[i],
        };
      case 'corsi':
        return { start: T.corsi.start[i], max: T.corsi.max, rounds: T.corsi.rounds[i] };
      case 'simon':
        return { start: T.simon.start[i], max: T.simon.max, rounds: T.simon.rounds[i] };
      case 'dagnacht':
        return { holdS: T.dagnacht.holdS[i], tempts: T.dagnacht.tempts[i], goWaitS: T.dagnacht.goWaitS[i], slowmo: i + 1 < 3, flips: T.dagnacht.flips[i] };
      case 'wisselen':
        return { sorts: T.wisselen.sorts[i], flipEvery: T.wisselen.flipEvery[i], flips: T.wisselen.flips[i] };
      default:
        throw new Error(`[skill] no knobs for ${String(engine)}`);
    }
  })();
  return k as EngineKnobs[E];
}

/** The older difficulty fields at a level, DERIVED from the knob tables (`store.difficulty`
 *  for a reader that has not moved to `knobs` yet: the same look-alike count, trail, route
 *  and echo start). */
export function knobsForLevel(engine: Engine, level: number): DifficultyKnobs {
  switch (engine) {
    case 'zoeken': {
      const k = knobsFor('zoeken', level);
      return { afleiders: k.lookAlikes - 2, lensSterkte: 1 - k.glimpse, spoorLengte: k.trailLegs, spoorHelderheid: k.trailClarity };
    }
    case 'corsi':
      return { routeLengte: knobsFor('corsi', level).start };
    case 'simon':
      return { simonLengte: knobsFor('simon', level).start };
    case 'dagnacht':
      return { slowmo: knobsFor('dagnacht', level).slowmo };
    case 'wisselen':
      return { wisselFreq: 1 - (knobsFor('wisselen', level).flipEvery - 2) / 4 };
    default:
      return {};
  }
}

/**
 * The knobs from the manual settings ("Passend moeilijk" off: the grown-ups' sliders).
 * No growth inside a beat there (max = start), a fixed number of rounds.
 */
export function knobsFromDifficulty<E extends Engine>(engine: E, diff: DifficultyKnobs): EngineKnobs[E] {
  const k = ((): EngineKnobs[Engine] => {
    switch (engine) {
      case 'zoeken':
        return {
          lookAlikes: Math.max(2, Math.round(diff.afleiders ?? 4) + 2),
          glimpse: clamp(1 - (diff.lensSterkte ?? 0.6), 0.1, 0.6),
          hintAfterS: 14,
          trailLegs: Math.max(2, Math.min(5, Math.round(diff.spoorLengte ?? 3))),
          trailClarity: Math.max(0.25, Math.min(1, diff.spoorHelderheid ?? 0.7)),
        };
      case 'corsi': {
        const n = clampInt(diff.routeLengte ?? 4, 3, KNOB_TABLES.corsi.max);
        return { start: n, max: n, rounds: 2 };
      }
      case 'simon': {
        const n = clampInt(diff.simonLengte ?? 3, 2, KNOB_TABLES.simon.max);
        return { start: n, max: n, rounds: 3 };
      }
      case 'dagnacht':
        return { holdS: 4, tempts: 1, goWaitS: 8, slowmo: !!diff.slowmo, flips: 1 };
      case 'wisselen': {
        const freq = diff.wisselFreq ?? 0.4;
        return { sorts: 8, flipEvery: Math.max(2, Math.round(2 + (1 - freq) * 4)), flips: 1 };
      }
      default:
        throw new Error(`[skill] no knobs for ${String(engine)}`);
    }
  })();
  return k as EngineKnobs[E];
}

/** Deep-merge a persisted skill set onto a fresh one (migration-safe): an older record gets
 *  `beats` from its trial count (capped at 50). */
export function mergeSkill(saved: unknown): SkillSet {
  const base = blankSkillSet();
  if (saved && typeof saved === 'object') {
    const s = saved as Partial<Record<Engine, Partial<SkillRecord>>>;
    for (const e of EF_ENGINES) {
      const v = s[e];
      if (!v) continue;
      const beats = typeof v.beats === 'number' ? v.beats : Math.min(Math.max(0, Math.floor(v.trials ?? 0)), 50);
      base[e] = { ...base[e], ...v, beats };
    }
  }
  return base;
}
