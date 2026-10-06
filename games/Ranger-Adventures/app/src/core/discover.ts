/**
 * discover.ts — the rare roll (run 7, design `state/foundation/design.md` §4.4). Pure: the
 * table, the save's counts and the play come in, a row (or null) goes out.
 *
 * Each home has at least one rare visitor, spread over a few sessions of now-and-then play
 * (owner, 2026-10-05: "a little more" spread, no grind). A home's first play never has
 * one, nor the play right after one of its rares (`counts[home]`, the won plays since its
 * last rare, is 0 then): something special stays special. After that a play of the home
 * gets one with a low seeded chance that grows a little with every won play without one
 * (RARE_P, then RARE_STEP more each), and surely once RARE_PITY won plays of that home went
 * by without one (the pity rule). So a home's first rare comes on its 2nd to 6th play,
 * about its 5th as a rule, by luck or by the rule — never as a prize and never as
 * pressure. Once he found them all they still come now and then (RARE_P_FOUND), with the
 * same spacing and no pity. The pick prefers a rare he has not found yet, and only one that
 * suits the play's mood (`stemming`).
 */

import type { Play } from './play';
import type { Ontdekking } from '../content/ontdekkingen';
import type { MoodId } from '../render3d/Moods';

/** The chance of a rare visitor on the first play that may have one, while the home still
 *  has a rare he has not found… */
export const RARE_P = 0.12;
/** …and how much more with every further won play of the home without one. */
export const RARE_STEP = 0.08;
/** Won plays of a home without a rare after which the next play surely gets one (its 6th
 *  play at the latest, when he wins them all). */
export const RARE_PITY = 5;
/** Once he found them all: they still come, now and then (never two plays in a row). */
export const RARE_P_FOUND = 0.1;

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

/** The chance (0-1) that a play of a home brings a rare visitor, from the won plays since
 *  its last rare (`count`) and whether one is still to be found (`missing`). */
export function rareChance(count: number, missing: boolean): number {
  if (count < 1) return 0; // (the home's first play, or the one right after a rare)
  if (!missing) return RARE_P_FOUND;
  if (count >= RARE_PITY) return 1;
  return Math.min(1, RARE_P + RARE_STEP * (count - 1));
}

/** This play's rare visitor for its home, or null. Deterministic per seed (it draws from
 *  the play's own fork 'rare', so it never moves another decision). */
export function rollRare(o: RareRoll): Ontdekking | null {
  const ofHome = o.table.filter((r) => r.home === o.home && r.soort === 'zeldzaam');
  if (!ofHome.length) return null;
  const missing = ofHome.some((r) => !o.found[r.id]);
  const fits = ofHome.filter((r) => !r.stemming?.length || r.stemming.includes(o.mood));
  const fork = o.play.fork('rare');
  const roll = fork.rng(); // (always drawn: the stream stays put)
  const count = o.play.n <= 1 ? 0 : (o.counts[o.home] ?? 0);
  if (!fits.length || roll >= rareChance(count, missing)) return null;
  const fresh = fits.filter((r) => !o.found[r.id]);
  return fork.pick(fresh.length ? fresh : fits);
}

/** The home's counter after a play: back to 0 when he discovered a rare of that home in
 *  it, one more after a WON play without one, else (a stopped play) as it was. */
export function nextRareCount(count: number, play: { won: boolean; gotRare: boolean }): number {
  if (play.gotRare) return 0;
  return play.won ? count + 1 : count;
}
