/**
 * onboarding.ts — first-world-entry hint copy (WORLD-PLAN W1.6). Pure and
 * framework-free so the explore HUD (Missions.ts) and the readlevel corpus test
 * share ONE source of truth for the strings. Device-aware: when the on-screen
 * joystick is shown the player is told to drag the stick, otherwise to use the
 * arrow keys. Both lines stay inside the M3/E3 reading norm (≤7 words).
 */

/** The two hint lines, keyed by the input affordance that is actually present. */
export const ONBOARD_HINT = {
  stick: 'Sleep de stick om te lopen.',
  keys: 'Loop met de pijltjes.',
} as const;

/** Pick the hint for the active input: the joystick line when the on-screen
 *  stick is shown, else the arrow-keys line. */
export function onboardHint(stickShown: boolean): string {
  return stickShown ? ONBOARD_HINT.stick : ONBOARD_HINT.keys;
}
