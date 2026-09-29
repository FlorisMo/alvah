/**
 * onboarding.ts — the device-aware wording rule (`forPointer`): one rule for the whole
 * game, so a laptop never tells the player to tap. Pure and framework-free. The words
 * themselves live in the content layer: the first minute's lessons in content/mentor.ts,
 * the world's tips (the rim, driving) in content/copy.ts (run 6).
 */

/**
 * Device-aware wording: every hint is written for touch ("Tik op een dier"); on a
 * mouse device the same line says "Klik op een dier". Only the verb before
 * op/de/het/een changes (never the "tik tik" of a bird call), and the word count stays
 * the same.
 */
export function forPointer(text: string, mouse: boolean): string {
  if (!mouse) return text;
  return text.replace(/\b([Tt])ik(?= (?:op|de|het|een|aan)\b)/g, (_m, t: string) => (t === 'T' ? 'Klik' : 'klik'));
}
