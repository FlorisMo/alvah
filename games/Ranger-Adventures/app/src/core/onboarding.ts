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

/** The SECOND onboarding hint (RUN-3 P3.3 · F-06): a short "tap an animal" tip,
 *  shown as a brief transient only AFTER the ranger has learned to walk — so the
 *  first world frame carries ONE hint (the control line), never a stack of three.
 *  Replaces the old 16-word toast; stays inside the M3/E3 ≤7-word norm. */
export const ONBOARD_TAP = 'Tik op een dier om te spelen.';

/** The calm world-boundary cue (F-11): shown through this SAME one-tip channel
 *  when the ranger heads past the last content. The visible rim + gentle stop that
 *  trigger it land in P4.6; the copy + read-aloud join the hint system here. */
export const ONBOARD_BOUNDARY = 'Hier stopt het bos.';

/** Every transient onboarding tip, for the reading-norm test (≤7 words each). */
export const ONBOARD_TIPS = [ONBOARD_TAP, ONBOARD_BOUNDARY] as const;
