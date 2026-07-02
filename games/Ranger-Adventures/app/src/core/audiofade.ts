/**
 * audiofade.ts — pure equal-power crossfade curves for the ambience bed (W4.7a).
 *
 * Crossing a biome used to HARD-CUT the looping bed (stop old, start new in the
 * same instant → an audible blip, flagged in `calls.applyAmbient`). These curves
 * feed Web Audio `GainNode.setValueCurveAtTime`, so the outgoing bed fades out
 * while the incoming fades in over the same window with CONSTANT perceived
 * loudness (equal-power: outᵢ² + inᵢ² is constant, no dip in the middle).
 *
 * THREE-free / DOM-free / deterministic so it carries a seeded unit test; the
 * only side-effecting consumer is `Sound.startAmbient`. `Float32Array` is the
 * exact type `setValueCurveAtTime` wants.
 */

/** Clamp to a sane minimum so a curve always has a start and an end sample. */
function clampSteps(steps: number): number {
  return Math.max(2, Math.floor(steps));
}

/**
 * Fade-IN curve: rises from ~0 to `gain` shaped by sin(¼τ·x), so paired with
 * `fadeOutCurve` it forms a constant-power crossfade. First sample is a tiny
 * positive (never exactly 0 — an exponential-safe floor is not needed for a
 * value curve, but a hard 0 start reads as a click on some engines).
 */
export function fadeInCurve(gain: number, steps: number): Float32Array {
  const n = clampSteps(steps);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1); // 0 → 1
    out[i] = gain * Math.sin((Math.PI / 2) * x);
  }
  return out;
}

/**
 * Fade-OUT curve: falls from `gain` to 0 shaped by cos(¼τ·x). Ends exactly at 0
 * so the outgoing source can be stopped cleanly once the window elapses.
 */
export function fadeOutCurve(gain: number, steps: number): Float32Array {
  const n = clampSteps(steps);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1); // 0 → 1
    out[i] = gain * Math.cos((Math.PI / 2) * x);
  }
  return out;
}
