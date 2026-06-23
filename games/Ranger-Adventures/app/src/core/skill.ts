/**
 * skill.ts — difficulty & skill tracking (ported from prototype/skill.jsx;
 * HANDOFF §6.1 / plan §12.4). Pure, telemetry-free logic: each EF engine
 * scales BOTH over time (lifetime trials lift the start-floor) AND with
 * demonstrated skill (a reversal staircase toward ~70–80% success).
 *
 * This is render-agnostic and framework-free. The React hook from the
 * prototype (`useEngineDifficulty`) becomes a plain resolver in state.ts.
 *
 * Rules baked in:
 *  - scale DOWN silently; scale UP may be visible / opt-in.
 *  - the floor never lets a practised player restart at baby-level.
 *  - `best` is the high-water mark (badges never show a drop).
 */

export type Engine = 'zoeken' | 'corsi' | 'simon' | 'dagnacht' | 'wisselen';

export const EF_ENGINES: readonly Engine[] = ['zoeken', 'corsi', 'simon', 'dagnacht', 'wisselen'];

export interface SkillMeta {
  badgeId: string;
  naam: string;
  taak: string;
  kleur: string;
}

/** Per-engine identity for the 5 breinkracht badges (data, not hardcoded UI). */
export const SKILL_META: Record<Engine, SkillMeta> = {
  zoeken:   { badgeId: 'brein-zoeken',   naam: 'Speurkracht',    taak: 'Speuren',         kleur: '#5e8c3a' },
  corsi:    { badgeId: 'brein-corsi',    naam: 'Geheugenkracht', taak: 'Route onthouden', kleur: '#2f6fb0' },
  simon:    { badgeId: 'brein-simon',    naam: 'Echokracht',     taak: 'Naroepen',        kleur: '#bb6a2c' },
  dagnacht: { badgeId: 'brein-dagnacht', naam: 'Rustkracht',     taak: 'Rustig blijven',  kleur: '#7a52b3' },
  wisselen: { badgeId: 'brein-wisselen', naam: 'Wisselkracht',   taak: 'Omschakelen',     kleur: '#c1467e' },
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
  trials: number;       // lifetime trials on this engine (drives "over time" growth)
}

export type SkillSet = Record<Engine, SkillRecord>;

export function blankSkill(): SkillRecord {
  return { level: 1, best: 1, reversals: [], recent: [], trials: 0 };
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

/** (a) OVER TIME: lifetime trials slowly lift the floor a new mission starts at. Capped (+2). */
export function floorLevel(trials: number): number {
  return 1 + Math.min(2, Math.log2(1 + (trials || 0) / 5));
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
}

/**
 * (b) WITH SKILL: update one engine's record from a finished beat.
 * A reversal staircase nudges `level` up after a strong beat, down after a
 * weak one; the floor lifts the minimum so practice sticks.
 */
export function updateSkill(prev: SkillRecord | undefined, summary: BeatSummary): SkillRecord {
  const rec: SkillRecord = prev ? { ...prev } : blankSkill();
  const trials = Math.max(1, summary.trials ?? 1);
  const correct = summary.correct != null ? summary.correct : (summary.success ? trials : 0);
  const acc = trials > 0 ? correct / trials : 1;

  const newTrials = (rec.trials || 0) + trials;
  const fl = floorLevel(newTrials);

  let level = rec.level || 1;
  const reversals: Reversal[] = [...(rec.reversals || [])];
  let dir = 0;
  if (acc >= 0.8) dir = 1;          // strong → harder
  else if (acc < 0.5) dir = -1;     // weak  → easier (silent)
  if (dir !== 0) {
    const last = reversals.length ? reversals[reversals.length - 1].dir : 0;
    if (last !== dir) reversals.push({ dir, at: newTrials });
    level += dir * SKILL_STEP;
  }
  level = clamp(level, fl, SKILL_MAX);            // floor lifts the minimum
  const best = Math.max(rec.best || 1, level);    // high-water mark

  const recent: boolean[] = [...(rec.recent || [])];
  for (let i = 0; i < trials; i++) recent.push(i < correct);

  return {
    level: Math.round(level * 1000) / 1000,
    best: Math.round(best * 1000) / 1000,
    reversals: reversals.slice(-12),
    recent: recent.slice(-8),
    trials: newTrials,
  };
}

/** Difficulty knobs an engine reads — the SAME knobs the prototype drove from settings. */
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

/** Map an effective difficulty (≈ level) onto each engine's knobs. */
export function knobsForLevel(engine: Engine, level: number): DifficultyKnobs {
  const d = clamp(level, SKILL_MIN, SKILL_MAX);
  switch (engine) {
    case 'zoeken':
      // search leg (afleiders + lensSterkte) and tracking leg (spoor*) scale off the
      // same zoeken level but stay SEPARATE knobs — the trail never trims the decoys.
      return {
        afleiders: clampInt(2 + d, 2, 8),
        lensSterkte: clamp(0.95 - d * 0.16, 0, 0.95),
        spoorLengte: clampInt(2 + d * 0.6, 2, 5),
        spoorHelderheid: clamp(0.95 - d * 0.14, 0.25, 0.95),
      };
    case 'corsi':
      return { routeLengte: clampInt(2 + d, 3, 6) };
    case 'simon':
      return { simonLengte: clampInt(1 + d, 2, 6) };
    case 'dagnacht':
      return { slowmo: d < 3 };           // slow-mo support while still learning
    case 'wisselen':
      return { wisselFreq: clamp(0.12 + d * 0.13, 0.1, 0.9) };
    default:
      return {};
  }
}

/** Deep-merge a persisted skill set onto a fresh one (migration-safe). */
export function mergeSkill(saved: unknown): SkillSet {
  const base = blankSkillSet();
  if (saved && typeof saved === 'object') {
    const s = saved as Partial<Record<Engine, Partial<SkillRecord>>>;
    for (const e of EF_ENGINES) {
      const v = s[e];
      if (v) base[e] = { ...base[e], ...v };
    }
  }
  return base;
}
