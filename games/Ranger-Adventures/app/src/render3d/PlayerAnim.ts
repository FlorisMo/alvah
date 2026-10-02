/**
 * PlayerAnim.ts — the pure gait maths behind the ranger's legs (WORLD-PLAN §5 / W3.2,
 * run 6). The ranger GLB carries three baked clips: `idle` (one still pose), `walk` and
 * `run`. This module decides, from his post-collision ground speed, how much of each
 * to blend, how fast the one shared locomotion cycle turns, and how much wider than the
 * clips his legs swing, so his feet stay planted at a brisk walk and a real run without
 * his legs blurring. `PlayerRig` measures the clips and applies it to the mixer.
 *
 * THREE-free, DOM-free, deterministic (unit-tested). Every ease is the SAME
 * frame-rate-independent `dampFactor` the camera uses, so 30/60/120 fps agree.
 * Locomotion is EXEMPT from the reduced-motion freeze (§3.4): a walking ranger
 * animates in both motion modes, so nothing here takes a reduced flag.
 *
 * What the clips need (run 6, measured at his game size through the game's prepModel):
 *   - Their feet are slow for his speeds. The walk covers ~0.7 m of ground per cycle
 *     (two 0.35 m steps); played at 2.2 m/s by cadence alone that is 6 steps a second, a
 *     scurry. So the legs (and arms) swing wider about the clip's mean pose: the STRIDE
 *     GAIN. Walking ~1.65× gives long ~0.65 m steps at ~3.3 steps/s; running ~1.3× gives
 *     ~4.5 steps/s.
 *   - A planted foot does not slide back at an even pace in the authored clips (the run's
 *     starts slow and ends fast), so a cadence that is right on average still skates. A
 *     GAIT CLOCK re-times each clip so the planted foot slides back evenly: the shared
 *     phase maps to clip time so that the stance foot's travel is linear in phase.
 *   - The clock also lines the two clips up: phase 0 is the left foot going down and 0.5
 *     the right, in both, so walk and run blend without the feet double-stepping.
 *   - The run clip's feet only skim the ground between steps; its flights get a small
 *     lift so both feet leave the ground.
 * The clips are measured when the rig loads (`gaitClock`, `stanceTravel`), not pinned,
 * so a new ranger model keeps its feet planted.
 */

import { dampFactor } from './play/kit-math.ts';
import { WALK_SPEED, RUN_SPEED } from '../core/input.ts';

/** Ground speed (m/s) above which the ranger is moving — below it he idles.
 *  Just under the tap-to-walk stop threshold so a real step always crosses it. */
export const WALK_ENTER_SPEED = 0.2;

/** Smooth-time of the idle↔moving crossfade (~0.12 s: quick but never a pop). */
export const BLEND_TAU = 0.12;

/** Smooth-time of the walk↔run crossfade. The ground speed already ramps over ~0.3 s
 *  (core/input SPEED_TAU); this only smooths collision jitter out of the blend. */
export const RUN_BLEND_TAU = 0.08;

/** Weight is the moving share in [0,1]; idle share is `1 − walk`. */
export type WalkWeight = number;

/** The run clip takes over across this band of ground speed (m/s): pure walk at the
 *  walking speed, pure run well before the running speed. */
export const RUN_BLEND_FROM = WALK_SPEED + 0.35;
export const RUN_BLEND_TO = RUN_SPEED - 0.6;

/** Stride gain at the walking speed: the legs swing this much wider than the clip. */
export const WALK_GAIN = 1.85;
/** The walk's stride gain never drops under this, even creeping: the authored walk
 *  shuffles (its swinging foot brushes the ground); a little more swing lifts it. */
export const WALK_GAIN_MIN = 1.3;
/** Stride gain of the run. */
export const RUN_GAIN = 1.3;

/** The shared cycle: the left foot goes down at phase 0, the right at 0.5. */
export const FOOT_PLANTS: readonly number[] = [0, 0.5];

/** Share of each half-cycle a foot is planted: walking always (the switch is the other
 *  foot's touchdown), running 60 %, then a flight. */
export const STANCE_SHARE = { walk: 1, run: 0.6 } as const;

/** How high the soles clear the ground at mid-flight in a full run (m). */
export const RUN_FLIGHT_HEIGHT = 0.05;

/** A turn on the spot steps the feet at this slow walk (m/s equivalent). */
export const TURN_STEP_SPEED = 0.7;

/** Phase steps in a gait clock's table. */
export const CLOCK_STEPS = 128;

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/* ------------------------------------------------------------ blending -- */

/**
 * Ease the moving weight toward its speed-driven target (1 when moving, 0 when
 * still) with frame-rate-independent exponential damping. Clamped to [0,1].
 */
export function stepWalkWeight(
  cur: WalkWeight,
  speed: number,
  dt: number,
  tau: number = BLEND_TAU,
  enter: number = WALK_ENTER_SPEED,
): WalkWeight {
  const target = speed > enter ? 1 : 0;
  const w = cur + (target - cur) * dampFactor(dt, tau);
  return w < 0 ? 0 : w > 1 ? 1 : w;
}

/** The run clip's share for a ground speed: 0 walking, 1 running, smooth between. */
export function runTarget(speed: number): number {
  const t = clamp01((speed - RUN_BLEND_FROM) / (RUN_BLEND_TO - RUN_BLEND_FROM));
  return t * t * (3 - 2 * t);
}

/** Ease the run weight toward `runTarget(speed)` (frame-rate independent, [0,1]). */
export function stepRunWeight(cur: number, speed: number, dt: number, tau: number = RUN_BLEND_TAU): number {
  return clamp01(cur + (runTarget(speed) - cur) * dampFactor(dt, tau));
}

/** The gait the dev hook reports: the dominant one of idle / walk / run. */
export type Gait = 'idle' | 'walk' | 'run';

/**
 * The dominant gait, for the dev-hook `clip()` report and `rangerMotion().running`.
 * At exactly 0.5 the moving weight reports as moving, so the E2E sees `walk` the
 * moment a held key has him actually moving.
 */
export function dominantGait(walkWeight: WalkWeight, runWeight = 0): Gait {
  if (walkWeight < 0.5) return 'idle';
  return runWeight >= 0.5 ? 'run' : 'walk';
}

/* ---------------------------------------------------------- gait clock -- */

/** One sampled pose of a clip: its time and how far forward (model +z, m) the ball of
 *  each foot is. */
export interface FootSample { t: number; zL: number; zR: number }

/** A clip, measured: how the shared phase maps to its time, and the ground it covers. */
export interface GaitClock {
  /** The clip's seamless loop [start, end) in clip seconds (the authored clips hold
   *  their first pose for a frame before the first key; that hold is left out). */
  loop: readonly [number, number];
  /** Clip time at phase k / CLOCK_STEPS, k = 0..CLOCK_STEPS (unwrapped, ascending). */
  times: readonly number[];
  /** Share of each half-cycle a foot is planted. */
  stance: number;
  /** Ground one cycle covers (m) with the planted foot still, per stride gain:
   *  [gain, metres], ascending. */
  strides: ReadonlyArray<readonly [number, number]>;
}

/** A foot's forward position at clip time `t` (wrapped into the loop), from samples
 *  spaced evenly over the loop. */
function zAt(samples: readonly FootSample[], loop: readonly [number, number], foot: 'zL' | 'zR', t: number): number {
  const L = loop[1] - loop[0];
  const n = samples.length;
  let u = ((t - loop[0]) / L) % 1;
  if (u < 0) u += 1;
  const x = u * n;
  const i = Math.floor(x) % n;
  const f = x - Math.floor(x);
  return samples[i][foot] + (samples[(i + 1) % n][foot] - samples[i][foot]) * f;
}

/** When each foot goes down: the clip time its ball is furthest forward (it starts
 *  sliding back under him), the right one after the left within one loop. */
export function touchdowns(samples: readonly FootSample[], loop: readonly [number, number]): { l: number; r: number } {
  let l = samples[0], r = samples[0];
  for (const s of samples) { if (s.zL > l.zL) l = s; if (s.zR > r.zR) r = s; }
  const L = loop[1] - loop[0];
  return { l: l.t, r: r.t <= l.t ? r.t + L : r.t };
}

/** The stance slice of a half cycle starting at `ta` and ending at `tb` (clip time). */
const stanceEnd = (ta: number, tb: number, stance: number): number => ta + stance * (tb - ta);

/**
 * The phase → clip-time table of a clip's gait clock. The first half cycle is the left
 * foot's (from its touchdown to the right's), the second the right's. Within a half, the
 * planted slice (`stance` of it) is re-timed so the planted foot's ball slides back
 * EVENLY with phase (the clip's own pace is uneven); a run's flight after it plays at an
 * even pace. Unwrapped: entries ascend from the left touchdown over one loop.
 */
export function gaitClockTimes(
  samples: readonly FootSample[],
  loop: readonly [number, number],
  stance: number,
  steps: number = CLOCK_STEPS,
): number[] {
  const L = loop[1] - loop[0];
  const td = touchdowns(samples, loop);
  const halves: [number, number, 'zL' | 'zR'][] = [[td.l, td.r, 'zL'], [td.r, td.l + L, 'zR']];
  const dt = L / (samples.length * 4); // search step: a quarter sample
  const out: number[] = [];
  for (let k = 0; k <= steps; k++) {
    const phase = k / steps;
    const h = phase < 0.5 ? 0 : 1;
    const [ta, tb, foot] = halves[h];
    const u = phase - h * 0.5; // position within the half, [0, 0.5]
    const te = stanceEnd(ta, tb, stance);
    const planted = stance * 0.5;
    if (u >= planted) {
      // a flight (or the very end of the half): even pace from the lift to the next touchdown
      out.push(planted >= 0.5 ? tb : te + ((u - planted) / (0.5 - planted)) * (tb - te));
      continue;
    }
    // planted: find when the ball has slid back its even share of the stance travel
    const za = zAt(samples, loop, foot, ta), ze = zAt(samples, loop, foot, te);
    const want = za + (u / planted) * (ze - za);
    let t = ta, low = za, prevT = ta, prevLow = za;
    while (t < te && low > want) {
      prevT = t; prevLow = low;
      t = Math.min(te, t + dt);
      low = Math.min(low, zAt(samples, loop, foot, t)); // the running low: never back up
    }
    out.push(low <= want && prevLow > low ? prevT + ((prevLow - want) / (prevLow - low)) * (t - prevT) : t);
  }
  return out;
}

/** The ground one cycle covers (m) when the planted foot never slips: the backward
 *  travel of each planted foot over its stance slice, over the share of the cycle
 *  those slices take. */
export function stanceTravel(samples: readonly FootSample[], loop: readonly [number, number], stance: number): number {
  const L = loop[1] - loop[0];
  const td = touchdowns(samples, loop);
  const a = zAt(samples, loop, 'zL', td.l) - zAt(samples, loop, 'zL', stanceEnd(td.l, td.r, stance));
  const b = zAt(samples, loop, 'zR', td.r) - zAt(samples, loop, 'zR', stanceEnd(td.r, td.l + L, stance));
  return Math.max(0, (a + b) / stance);
}

/** Clip time for a phase in [0,1) on a gait clock (wrapped into its loop). */
export function clockTime(clock: GaitClock, phase: number): number {
  const p = phase - Math.floor(phase);
  const x = p * (clock.times.length - 1);
  const i = Math.min(clock.times.length - 2, Math.floor(x));
  const t = clock.times[i] + (clock.times[i + 1] - clock.times[i]) * (x - i);
  const [t0, t1] = clock.loop;
  const L = t1 - t0;
  let w = (t - t0) % L;
  if (w < 0) w += L;
  return t0 + w;
}

/** Ground one cycle of a clip covers (m) at stride gain `gain`: its measured table,
 *  linearly interpolated, held flat past its ends. */
export function clipStride(clock: GaitClock, gain: number): number {
  const t = clock.strides;
  if (gain <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) {
    const [g1, s1] = t[i];
    if (gain <= g1) {
      const [g0, s0] = t[i - 1];
      return s0 + ((s1 - s0) * (gain - g0)) / (g1 - g0);
    }
  }
  return t[t.length - 1][1];
}

/* ------------------------------------------------------ stride + cycle -- */

/**
 * How much wider than the clip the legs swing, for this speed and run share. The walk's
 * gain grows with speed (a slow walk takes short steps, a brisk one long ones); the
 * run's is fixed.
 */
export function strideGain(speed: number, runWeight: number): number {
  const walk = WALK_GAIN_MIN + (WALK_GAIN - WALK_GAIN_MIN) * clamp01(Math.abs(speed) / WALK_SPEED);
  return walk + (RUN_GAIN - walk) * clamp01(runWeight);
}

/**
 * The shared cycle's rate (cycles per second) that keeps the planted foot still on the
 * ground: ground speed ÷ the ground one cycle of the blended pose covers at this frame's
 * stride gain. Never negative; 0 when standing. Without a run clock the walk covers all.
 */
export function cycleRate(speed: number, runWeight: number, walk: GaitClock, run: GaitClock | null): number {
  const v = Math.abs(speed);
  if (!(v > 0)) return 0;
  const r = run ? clamp01(runWeight) : 0;
  const g = strideGain(v, r);
  const sw = clipStride(walk, g);
  const stride = run ? sw + (clipStride(run, g) - sw) * r : sw;
  return stride > 1e-6 ? v / stride : 0;
}

/** Footfalls per second (two per cycle): what the ear and eye count. */
export function cadence(rate: number): number {
  return 2 * rate;
}

/** Advance the normalized cycle phase (wrapped to [0,1)); backwards when backing up. */
export function stepPhase(phase: number, rate: number, dt: number, backward = false): number {
  const p = phase + (backward ? -1 : 1) * rate * Math.max(0, dt);
  return p - Math.floor(p);
}

/** How high the lowest sole floats at this point of the cycle (m): the run's flight
 *  arc (after each foot's planted share of its half), scaled by the run share; 0
 *  (planted) otherwise. */
export function flightLift(phase: number, runWeight: number, stance: number = STANCE_SHARE.run): number {
  const r = clamp01(runWeight);
  if (r === 0 || stance >= 1) return 0;
  const u = (phase - Math.floor(phase)) % 0.5; // within the half
  const a = stance * 0.5;
  if (u <= a) return 0;
  return RUN_FLIGHT_HEIGHT * r * Math.sin((Math.PI * (u - a)) / (0.5 - a));
}

/* ------------------------------------------------------- the run's look -- */

/**
 * Run 7 (feel): what makes a run read as a run at the follow distance, laid on top of the
 * run clip by its share (the walk is untouched). From 5 m behind him the authored run looked
 * like the walk: upright, and its arms held out sideways with the forearms folded in (a
 * flap, not a pump), so from behind nothing swung. A child running leans into it and pumps
 * his arms: elbows bent about square, swinging forward and back with the opposite leg, the
 * elbow coming out past his back on each back swing. Angles in radians, at a full run.
 */
export const RUN_FEEL = {
  /** the body leans forward from the hips… */
  lean: 0.16,
  /** …and the neck takes this share of it back, so he still looks where he runs */
  headBack: 0.6,
  /** the upper arms hang this far out from his sides (seen past his back) */
  armOut: 0.45,
  /** how far each upper arm swings forward and back of its centre with the stride */
  armSwing: 0.8,
  /** the centre of that swing, a little forward of hanging straight down */
  armBias: 0.05,
  /** the elbow bend: the forearm this far up from the line of the upper arm… */
  elbow: 1.4,
  /** …but never higher than this from straight down (a hand thrown up beside his head read
   *  as a wave, not a run) */
  foreMax: 1.75,
  /** the hands come in toward his middle by this much (of the forearm's length) */
  handIn: 0.42,
} as const;

/** A direction in HIS frame: +x his left, +y up, +z forward. */
export type Dir3 = readonly [number, number, number];

/** The run's look for one frame (see RUN_FEEL): the lean and the neck's share back (rad),
 *  where each upper arm and forearm points, and how much of the clip's arm that replaces. */
export interface RunLook {
  lean: number; neck: number;
  /** 0..1: how far the arms are turned to the pumping pose (the run's share) */
  arms: number;
  upperL: Dir3; foreL: Dir3; upperR: Dir3; foreR: Dir3;
}

const unit = (x: number, y: number, z: number): Dir3 => {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
};

/** One arm of the pump (`side` +1 his left, −1 his right) at swing angle `a` (rad, +
 *  forward): the upper arm hangs RUN_FEEL.armOut out from his side, swung about the axis
 *  across him; the forearm bends forward and up from it by RUN_FEEL.elbow in the same plane,
 *  the hand in toward his middle. */
export function pumpArm(side: 1 | -1, a: number): { upper: Dir3; fore: Dir3 } {
  const o = RUN_FEEL.armOut;
  const upper = unit(side * Math.sin(o), -Math.cos(o) * Math.cos(a), Math.cos(o) * Math.sin(a));
  const e = Math.min(a + RUN_FEEL.elbow, RUN_FEEL.foreMax); // the forearm, bent on forward from the upper arm's swing
  const fore = unit(side * (Math.sin(o) - RUN_FEEL.handIn), -Math.cos(o) * Math.cos(e), Math.cos(o) * Math.sin(e));
  return { upper, fore };
}

/** The run's look at this point of the cycle for a run share `run` (0..1: the moving weight
 *  times the run weight). The arms swing with the opposite leg: at 0 the left foot goes
 *  down (the left leg forward), so the right arm is forward and the left one back; at 0.5
 *  the other way round. Everything grows with the share, so the walk ↔ run blend stays
 *  smooth and a walk is exactly the clip. */
export function runLook(phase: number, run: number): RunLook {
  const r = clamp01(run);
  const c = Math.cos(2 * Math.PI * phase);
  const L = pumpArm(1, RUN_FEEL.armBias - RUN_FEEL.armSwing * c);
  const R = pumpArm(-1, RUN_FEEL.armBias + RUN_FEEL.armSwing * c);
  return {
    lean: RUN_FEEL.lean * r,
    neck: RUN_FEEL.lean * RUN_FEEL.headBack * r,
    arms: r,
    upperL: L.upper, foreL: L.fore, upperR: R.upper, foreR: R.fore,
  };
}
