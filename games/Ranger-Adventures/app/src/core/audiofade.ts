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

/* ------------------------------------------------------------ call snippets ---- */

/**
 * The recorded animal calls are field recordings of 12–17 s (a red deer bellowing
 * three times, a raven's whole conversation). A call in a game is ONE short, calm
 * snippet: `callWindow` finds it (child:B1). It slides a `maxDur` window over the
 * clip's 50 ms loudness frames, keeps the loudest stretch (the call itself, not the
 * wind between calls), then walks its start back to the quiet just before the call
 * so it never starts mid-sound. `callGain` levels every snippet to the same calm
 * loudness, so no animal is startling next to another.
 */

/** Seconds per loudness frame. */
const FRAME_S = 0.05;
/** How far (s) the start may walk back to find the quiet before the call. */
const LEAD_BACK_S = 0.4;
/** A frame this far below the loudest one (−20 dB) counts as quiet. */
const QUIET = 0.1;

export interface CallWindow {
  /** Start of the snippet in the clip (s). */
  offset: number;
  /** Length of the snippet (s), ≤ maxDur. */
  dur: number;
  /** Loudest 50 ms RMS inside the snippet (linear, 0..1). */
  loud: number;
  /** Largest absolute sample inside the snippet (linear, 0..1). */
  peak: number;
}

/** 50 ms RMS frames of a mono signal. */
export function loudnessFrames(samples: Float32Array, sampleRate: number): number[] {
  const win = Math.max(1, Math.round(sampleRate * FRAME_S));
  const out: number[] = [];
  for (let i = 0; i < samples.length; i += win) {
    const end = Math.min(samples.length, i + win);
    let acc = 0;
    for (let j = i; j < end; j++) acc += samples[j] * samples[j];
    out.push(Math.sqrt(acc / Math.max(1, end - i)));
  }
  return out;
}

/** The calm snippet of a recorded call: see the section note above. */
export function callWindow(samples: Float32Array, sampleRate: number, maxDur: number): CallWindow {
  const total = samples.length / sampleRate;
  const frames = loudnessFrames(samples, sampleRate);
  const n = Math.max(1, Math.min(frames.length, Math.round(maxDur / FRAME_S)));
  // the loudest stretch: the window with the most energy
  let best = 0;
  let acc = 0;
  for (let i = 0; i < n; i++) acc += frames[i] ** 2;
  let bestAcc = acc;
  for (let i = 1; i + n <= frames.length; i++) {
    acc += frames[i + n - 1] ** 2 - frames[i - 1] ** 2;
    if (acc > bestAcc + 1e-12) { bestAcc = acc; best = i; }
  }
  // walk the start back to the quiet just before the call (never mid-sound)
  const top = Math.max(1e-9, ...frames.slice(best, best + n));
  let start = best;
  const limit = Math.max(0, best - Math.round(LEAD_BACK_S / FRAME_S));
  while (start > limit && frames[start - 1] > top * QUIET) start--;
  if (start > 0) start--; // a breath of quiet before the sound
  const offset = total <= maxDur ? 0 : Math.min(start * FRAME_S, Math.max(0, total - maxDur));
  const dur = Math.min(maxDur, total - offset);
  // loudness + peak inside the chosen snippet
  const f0 = Math.floor(offset / FRAME_S);
  const f1 = Math.min(frames.length, Math.ceil((offset + dur) / FRAME_S));
  const loud = Math.max(0, ...frames.slice(f0, f1));
  let peak = 0;
  const s0 = Math.floor(offset * sampleRate);
  const s1 = Math.min(samples.length, Math.ceil((offset + dur) * sampleRate));
  for (let i = s0; i < s1; i++) peak = Math.max(peak, Math.abs(samples[i]));
  return { offset, dur, loud, peak };
}

/** The calm level every call snippet is brought to: its loudest 50 ms at −18 dBFS. */
export const CALL_TARGET_DB = -18;

/**
 * The gain that brings a snippet's loudest 50 ms to `targetDb`, never boosting more
 * than `maxGain` (a faint recording stays faint rather than hissing) and never
 * letting a peak pass `ceiling` (no clipping).
 */
export function callGain(w: Pick<CallWindow, 'loud' | 'peak'>, targetDb = CALL_TARGET_DB, maxGain = 3, ceiling = 0.8): number {
  if (w.loud <= 1e-6) return 0;
  const want = 10 ** (targetDb / 20) / w.loud;
  const safe = w.peak > 1e-6 ? ceiling / w.peak : maxGain;
  return Math.max(0, Math.min(want, maxGain, safe));
}
