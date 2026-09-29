/**
 * onboarding.ts — the world's transient tips (the rim cue, the drive line) and the
 * device-aware wording rule (`forPointer`). Pure and framework-free so the explore HUD
 * and the readlevel corpus test share ONE source of truth for the strings. The first
 * minute's lessons (walk, run, look round) moved to content/mentor.ts (run 6).
 */

/** The calm world-boundary cue (F-11): shown through this SAME one-tip channel
 *  when the ranger heads past the last content. The visible rim + gentle stop that
 *  trigger it land in P4.6; the copy + read-aloud join the hint system here. */
export const ONBOARD_BOUNDARY = 'Hier stopt het bos.';

/** The drive hint, shown when the ranger first gets into the jeep this session
 *  (players did not know how to drive). Device-aware like the walk hint. */
export const ONBOARD_DRIVE = {
  stick: 'Sleep de stick om te rijden.',
  keys: 'Rijd met de pijltjes.',
} as const;

/** Every transient onboarding tip, for the reading-norm test (≤7 words each). */
export const ONBOARD_TIPS = [ONBOARD_BOUNDARY, ONBOARD_DRIVE.stick, ONBOARD_DRIVE.keys] as const;

/**
 * Device-aware wording: every hint is written for touch ("Tik op een dier"); on a
 * mouse device the same line says "Klik op een dier". ONE rule for the whole game,
 * so the laptop never tells the player to tap. Only the verb before op/de/het/een
 * changes (never the "tik tik" of a bird call), and the word count stays the same.
 */
export function forPointer(text: string, mouse: boolean): string {
  if (!mouse) return text;
  return text.replace(/\b([Tt])ik(?= (?:op|de|het|een|aan)\b)/g, (_m, t: string) => (t === 'T' ? 'Klik' : 'klik'));
}
