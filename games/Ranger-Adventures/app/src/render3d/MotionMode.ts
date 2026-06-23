/**
 * MotionMode — the single source of truth for the §1e reduced-motion RENDER policy.
 *
 * "Full 3D reduced-motion mode (per-view cuts-not-moves)" (BUILD-PLAN §1e, Phase 5):
 * one place that states what EVERY 3D view does when motion is reduced, so the
 * behaviour is a coherent MODE rather than a scatter of per-view booleans. Pure +
 * THREE-free + deterministic (unit-tested). The live flag comes from
 * core/reduced-motion (OS `prefers-reduced-motion` ∪ the in-game toggle) and is read
 * PER-FRAME by every consumer, so flipping the toggle takes effect with **no restart**.
 *
 * The §1e contract, encoded exactly once:
 *  - camera MOVES become CUTS — reframes/transitions snap, the damped follow stops
 *    lagging (a per-frame snap to a smoothly-moving target reads as a steady follow,
 *    never a swoop).
 *  - SECONDARY motion is OFF — procedural animal gaits, idle camera sway/breathing,
 *    one-mesh iris parallax, gaze microsaccade, and scale/zoom pulses all freeze to
 *    their rest pose.
 *  - KEEP (never disabled) — locomotion (the ranger still walks; walking is the task,
 *    not decoration), expression PRESENCE (blink + the eased emotion fade keep faces
 *    alive), and gaze DIRECTION (the eyes still point, just snapped instead of jittered).
 *
 * Disabling any of the three KEEP channels would make the world feel dead, not calm —
 * so they are invariants the unit test pins, not tunables.
 */

import { prefersReducedMotion } from '../core/reduced-motion.ts';

export interface MotionPolicy {
  /** Whether motion is currently reduced (OS query ∪ in-game toggle). */
  reduced: boolean;
  /** How a deliberate camera move resolves: a hard `cut` (reduced) or `damp`ed glide. */
  cameraTransition: 'cut' | 'damp';
  /** Run secondary motion (gaits, sway, parallax, microsaccade, pulses)? Off when reduced. */
  secondaryMotion: boolean;
  /** Always true — the ranger keeps walking (locomotion is the activity, never "secondary"). */
  keepLocomotion: boolean;
  /** Always true — blink + the eased emotion fade keep faces present. */
  keepExpression: boolean;
  /** Always true — gaze still points at its target (snapped, not micro-jittered). */
  keepGaze: boolean;
}

/** The canonical §1e policy for a given reduced flag. Pure + deterministic. */
export function motionPolicy(reduced: boolean): MotionPolicy {
  return {
    reduced,
    cameraTransition: reduced ? 'cut' : 'damp',
    secondaryMotion: !reduced,
    keepLocomotion: true,
    keepExpression: true,
    keepGaze: true,
  };
}

/**
 * The LIVE policy (OS query ∪ in-game toggle), recomputed on every call so a runtime
 * toggle needs no restart. Per-frame consumers (camera follow, procedural gaits, iris
 * parallax, microsaccade) call this each frame; nothing captures the flag at construction.
 */
export function livePolicy(): MotionPolicy {
  return motionPolicy(prefersReducedMotion());
}

/** The live reduced flag, read through the policy authority (no second source of truth). */
export function liveReducedMotion(): boolean {
  return prefersReducedMotion();
}
