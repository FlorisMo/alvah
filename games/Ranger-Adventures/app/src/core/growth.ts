/**
 * growth.ts — how each breinkracht grows over weeks, for the grown-ups (run 7 `adaptive`,
 * design §5.9): from the save's beat history (`geschiedenis`) and the skill records, per
 * breinkracht the level now, the best, the beats this week, and what was played at its
 * best — the longest clean echo or route (simon, corsi), the median seconds to a find over
 * the last ten searches (zoeken), the longest hold (dagnacht), the most turns in a round
 * (wisselen). Pure; read by the "Groei" panel at the bottom of Instellingen and never shown
 * to the child anywhere else.
 */

import { EF_ENGINES, type Engine, type SkillSet } from './skill.ts';
import type { BeatLog } from './state.ts';

export interface GrowthRow {
  engine: Engine;
  /** the level now (where the next beat starts) and the best, 2 decimals */
  level: number;
  best: number;
  /** beats in the last seven days, and ever */
  week: number;
  beats: number;
  /** simon, corsi: the longest sequence echoed cleanly */
  span?: number;
  /** zoeken: the median seconds to a find over the last ten searches */
  findS?: number;
  /** dagnacht: the longest hold (s) */
  holdS?: number;
}

const WEEK_MS = 7 * 24 * 3600 * 1000;
const r2 = (v: number): number => Math.round(v * 100) / 100;

function median(xs: readonly number[]): number | undefined {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** One row per breinkracht, in the badges' order. */
export function growthSummary(history: readonly BeatLog[], skill: SkillSet, now: number): GrowthRow[] {
  return EF_ENGINES.map((engine) => {
    const mine = history.filter((b) => b.e === engine);
    const rec = skill[engine];
    const row: GrowthRow = {
      engine,
      level: r2(rec?.level ?? 1),
      best: r2(rec?.best ?? 1),
      week: mine.filter((b) => now - b.t < WEEK_MS).length,
      beats: Math.max(rec?.beats ?? 0, mine.length),
    };
    const spans = mine.map((b) => b.sp).filter((v): v is number => typeof v === 'number' && v > 0);
    if ((engine === 'simon' || engine === 'corsi') && spans.length) row.span = Math.max(...spans);
    const finds = mine.map((b) => b.s).filter((v): v is number => typeof v === 'number').slice(-10);
    if (engine === 'zoeken' && finds.length) row.findS = Math.round(median(finds)! * 10) / 10;
    const holds = mine.map((b) => b.h).filter((v): v is number => typeof v === 'number');
    if (engine === 'dagnacht' && holds.length) row.holdS = Math.max(...holds);
    return row;
  });
}
