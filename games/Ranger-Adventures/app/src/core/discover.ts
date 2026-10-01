/**
 * discover.ts — the rare roll (run 7, design `state/foundation/design.md` §4.4). Pure: the
 * table, the save's counts and the play come in, a row (or null) goes out.
 *
 * Each home has at least one rare visitor. When a play of a home is drawn (at the
 * briefing), it gets a rare one with a seeded chance (p 0.34 while the home still has a
 * rare he has not found, else 0.2), and surely once two won plays of that home went by
 * without one (the pity rule: `counts[home]` is the number of won plays since its last
 * rare). So a rare comes within about three plays, by luck or by the rule, never as a
 * prize and never as pressure. The pick prefers a rare he has not found yet, and only
 * one that suits the play's mood (`stemming`).
 */

import type { Play } from './play';
import type { Ontdekking } from '../content/ontdekkingen';
import type { MoodId } from '../render3d/Moods';

/** The chance of a rare visitor while the home still has one he has not found. */
export const RARE_P = 0.34;
/** … and once he found them all (they still come, now and then). */
export const RARE_P_FOUND = 0.2;
/** Won plays of a home without a rare after which the next play surely gets one. */
export const RARE_PITY = 2;

export interface RareRoll {
  home: string;
  play: Play;
  table: readonly Ontdekking[];
  /** the save's discoveries (`GameState.ontdekt`): found when the id is there */
  found: Readonly<Record<string, unknown>>;
  /** the save's `zeldzaam`: per home, won plays since its last rare */
  counts: Readonly<Record<string, number>>;
  mood: MoodId;
}

/** This play's rare visitor for its home, or null. Deterministic per seed (it draws from
 *  the play's own fork 'rare', so it never moves another decision). */
export function rollRare(o: RareRoll): Ontdekking | null {
  const ofHome = o.table.filter((r) => r.home === o.home && r.soort === 'zeldzaam');
  if (!ofHome.length) return null;
  const missing = ofHome.some((r) => !o.found[r.id]);
  const fits = ofHome.filter((r) => !r.stemming?.length || r.stemming.includes(o.mood));
  const fork = o.play.fork('rare');
  const lucky = fork.chance(missing ? RARE_P : RARE_P_FOUND); // (always drawn: the stream stays put)
  const pity = missing && (o.counts[o.home] ?? 0) >= RARE_PITY;
  if (!fits.length || (!lucky && !pity)) return null;
  const fresh = fits.filter((r) => !o.found[r.id]);
  return fork.pick(fresh.length ? fresh : fits);
}

/** The home's counter after a play: back to 0 when he discovered a rare of that home in
 *  it, one more after a WON play without one, else (a stopped play) as it was. */
export function nextRareCount(count: number, play: { won: boolean; gotRare: boolean }): number {
  if (play.gotRare) return 0;
  return play.won ? count + 1 : count;
}
