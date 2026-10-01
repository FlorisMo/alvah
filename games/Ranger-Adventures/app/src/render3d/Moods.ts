/**
 * Moods.ts — the calm times of day and weather the world can stand in (run 7, design
 * `state/foundation/design.md` §4.5 and §6.2). Pure: no THREE, no DOM.
 *
 * Run 7 `contracts`: only the ids and the rule that picks a play's mood live here, and only
 * the golden hour is on screen (`World.setMood` records the id). The `moods` package adds
 * the light sets (key, fill, fog, sky, the animal fill) and the crossfade, and draws the
 * session's mood; the names stay.
 */

import type { Play } from '../core/play';

/** The golden hour (today's look), a misty morning, a bright day, an overcast afternoon, a
 *  soft dusk. Never dark, stormy or scary. */
export type MoodId = 'gouden-uur' | 'ochtendnevel' | 'zonnig' | 'bewolkt' | 'schemer';

export const MOOD_IDS: readonly MoodId[] = ['gouden-uur', 'ochtendnevel', 'zonnig', 'bewolkt', 'schemer'];

/** The mood a fresh save (and every session in `contracts`) stands in. */
export const DEFAULT_MOOD: MoodId = 'gouden-uur';

/** Is this a mood id (a save or a URL may carry anything)? */
export function isMood(x: unknown): x is MoodId {
  return typeof x === 'string' && (MOOD_IDS as readonly string[]).includes(x);
}

/** What a home asks of the light (Adventure.moods): only these moods, and/or a new one
 *  each play. */
export interface MoodRule { allow?: readonly MoodId[]; perPlay?: boolean }

/**
 * This play's mood: the session's, unless the home restricts it (`allow` without the
 * session's mood: drawn from `allow`) or asks a new one each play (`perPlay`: drawn from
 * `allow`, else every mood). Drawn from the play's own fork ('mood'), so it never moves
 * another decision. (The `moods` package adds "never the home's last".)
 */
export function playMood(session: MoodId, rule: MoodRule | undefined, play: Play): MoodId {
  const allow = rule?.allow?.length ? rule.allow : null;
  if (rule?.perPlay) return play.fork('mood').pick(allow ?? MOOD_IDS);
  if (allow && !allow.includes(session)) return play.fork('mood').pick(allow);
  return session;
}
