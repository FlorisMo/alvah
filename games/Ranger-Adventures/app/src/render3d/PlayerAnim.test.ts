import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  stepWalkWeight, dominantGait, WALK_ENTER_SPEED, BLEND_TAU,
  runTarget, stepRunWeight, strideGain, cycleRate, cadence, stepPhase, flightLift,
  touchdowns, gaitClockTimes, stanceTravel, clockTime, clipStride,
  WALK_GAIN, WALK_GAIN_MIN, RUN_GAIN, STANCE_SHARE, RUN_FLIGHT_HEIGHT, CLOCK_STEPS, FOOT_PLANTS,
  type FootSample, type GaitClock,
} from './PlayerAnim.ts';
import { WALK_SPEED, RUN_SPEED } from '../core/input.ts';

/**
 * The ranger's gait maths (pure; run 6). Pins: the idle/move and walk/run blends
 * (frame-rate independent), the stride gain, the gait clock that re-times a clip so the
 * planted foot slides back evenly, the cycle rate that keeps it still on the ground,
 * the run's flight lift, and — with the ranger's own measured clips — that the brisk
 * walk and the run step at a child's pace, not a scurry.
 */

// ── blending ──────────────────────────────────────────────────────────────────

test('at rest the weight eases toward idle (0)', () => {
  let w = 1;
  for (let i = 0; i < 200; i++) w = stepWalkWeight(w, 0, 1 / 60);
  assert.ok(w < 0.01, `standing still should settle to idle, got ${w}`);
  assert.equal(dominantGait(w), 'idle');
});

test('while moving the weight eases toward walk (1)', () => {
  let w = 0;
  for (let i = 0; i < 200; i++) w = stepWalkWeight(w, WALK_SPEED, 1 / 60);
  assert.ok(w > 0.99, `sustained walking should settle to walk, got ${w}`);
  assert.equal(dominantGait(w), 'walk');
});

test('a held key crosses into the walk gait quickly (< 0.2 s)', () => {
  let w = 0, t = 0;
  const dt = 1 / 60;
  while (dominantGait(w) !== 'walk' && t < 1) { w = stepWalkWeight(w, WALK_SPEED, dt); t += dt; }
  assert.equal(dominantGait(w), 'walk');
  assert.ok(t < 0.2, `should read walk within ~0.2 s of moving, took ${t.toFixed(3)} s`);
});

test('speed just under the enter threshold stays idle', () => {
  let w = 0;
  for (let i = 0; i < 200; i++) w = stepWalkWeight(w, WALK_ENTER_SPEED - 0.01, 1 / 60);
  assert.ok(w < 0.01, `sub-threshold drift must not trigger a walk, got ${w}`);
});

test('dt-independence: 30/60/120 fps land on the same weights for the same elapsed time', () => {
  const run = (dt: number): [number, number] => {
    let w = 0, r = 0;
    for (let t = 0; t < 0.5 - 1e-9; t += dt) { w = stepWalkWeight(w, RUN_SPEED, dt); r = stepRunWeight(r, RUN_SPEED, dt); }
    return [w, r];
  };
  const a = run(1 / 30), b = run(1 / 60), c = run(1 / 120);
  for (const i of [0, 1]) {
    assert.ok(Math.abs(a[i] - b[i]) < 1e-3, `30 vs 60 fps diverge: ${a[i]} vs ${b[i]}`);
    assert.ok(Math.abs(b[i] - c[i]) < 1e-3, `60 vs 120 fps diverge: ${b[i]} vs ${c[i]}`);
  }
});

test('the weights never leave [0,1] even on a huge dt spike', () => {
  for (const v of [stepWalkWeight(1, WALK_SPEED, 100, BLEND_TAU), stepWalkWeight(0, 0, 100), stepRunWeight(0, 9, 100), stepRunWeight(1, 0, 100)]) {
    assert.ok(v >= 0 && v <= 1, `clamped, got ${v}`);
  }
});

test('walking is all walk clip, running all run clip, the switch smooth between', () => {
  assert.equal(runTarget(WALK_SPEED), 0);
  assert.equal(runTarget(0), 0);
  assert.equal(runTarget(RUN_SPEED), 1);
  let prev = 0;
  for (let v = WALK_SPEED; v <= RUN_SPEED; v += 0.05) {
    const t = runTarget(v);
    assert.ok(t >= prev - 1e-12 && t - prev < 0.12, `monotone and gentle at ${v.toFixed(2)}: ${prev} → ${t}`);
    prev = t;
  }
});

test('the dominant gait reads idle / walk / run', () => {
  assert.equal(dominantGait(0.2, 1), 'idle');
  assert.equal(dominantGait(1, 0.3), 'walk');
  assert.equal(dominantGait(1, 0.5), 'run');
});

// ── stride gain ───────────────────────────────────────────────────────────────

test('the stride gain: long strides at a brisk walk, shorter creeping, the run its own', () => {
  assert.ok(Math.abs(strideGain(WALK_SPEED, 0) - WALK_GAIN) < 1e-9);
  assert.ok(Math.abs(strideGain(0.3, 0) - (WALK_GAIN_MIN + (WALK_GAIN - WALK_GAIN_MIN) * 0.3 / WALK_SPEED)) < 1e-9);
  assert.ok(strideGain(0, 0) >= WALK_GAIN_MIN, 'the swinging foot always clears the ground');
  assert.ok(Math.abs(strideGain(RUN_SPEED, 1) - RUN_GAIN) < 1e-9);
  assert.ok(strideGain(-WALK_SPEED, 0) === strideGain(WALK_SPEED, 0), 'backing up swings like walking');
});

// ── gait clock ────────────────────────────────────────────────────────────────

/** A synthetic clip: loop [0.2, 1.2), feet swinging as cosines half a cycle apart, the
 *  left furthest forward at t = 0.45. A cosine is NOT even in time: a planted foot on it
 *  slides back slowly at first and fast in the middle. */
const LOOP: [number, number] = [0.2, 1.2];
const A = 0.3;
const TD_L = 0.45;
function synth(n = 96): FootSample[] {
  const out: FootSample[] = [];
  for (let i = 0; i < n; i++) {
    const t = LOOP[0] + (i / n);
    const a = 2 * Math.PI * (t - TD_L);
    out.push({ t, zL: A * Math.cos(a), zR: -A * Math.cos(a) });
  }
  return out;
}
const zOf = (foot: 'L' | 'R', t: number): number => (foot === 'L' ? 1 : -1) * A * Math.cos(2 * Math.PI * (t - TD_L));

test('touchdowns: each foot goes down where its ball is furthest forward, right after left', () => {
  const td = touchdowns(synth(), LOOP);
  assert.ok(Math.abs(td.l - TD_L) < 0.011, `left at ${td.l}`);
  assert.ok(Math.abs(td.r - (TD_L + 0.5)) < 0.011, `right half a cycle later, at ${td.r}`);
});

test('the gait clock: phase 0 is the left touchdown, 0.5 the right, and the planted foot slides back EVENLY', () => {
  const times = gaitClockTimes(synth(), LOOP, 1);
  assert.equal(times.length, CLOCK_STEPS + 1);
  for (let k = 1; k < times.length; k++) assert.ok(times[k] >= times[k - 1] - 1e-9, 'time only runs forward');
  const clock: GaitClock = { loop: LOOP, times, stance: 1, strides: [[1, 1]] };
  assert.ok(Math.abs(clockTime(clock, 0) - TD_L) < 0.011);
  assert.ok(Math.abs(clockTime(clock, 0.5) - (TD_L + 0.5)) < 0.011);
  // the left foot, planted over the first half: its travel is linear in phase
  const z0 = zOf('L', clockTime(clock, 0)), z1 = zOf('L', clockTime(clock, 0.5));
  for (const p of [0.1, 0.2, 0.25, 0.3, 0.4]) {
    const want = z0 + (p / 0.5) * (z1 - z0);
    const got = zOf('L', clockTime(clock, p));
    assert.ok(Math.abs(got - want) < 0.01, `phase ${p}: ball at ${got.toFixed(3)}, even share ${want.toFixed(3)}`);
  }
  // …and so is the right foot over the second half
  for (const p of [0.6, 0.75, 0.9]) {
    const want = zOf('R', clockTime(clock, 0.5)) + ((p - 0.5) / 0.5) * (zOf('R', clockTime(clock, 0.999)) - zOf('R', clockTime(clock, 0.5)));
    assert.ok(Math.abs(zOf('R', clockTime(clock, p)) - want) < 0.012, `phase ${p}`);
  }
});

test('the gait clock of a run: planted 60 % of each half, then an even-paced flight', () => {
  const s = STANCE_SHARE.run;
  const times = gaitClockTimes(synth(), LOOP, s);
  const clock: GaitClock = { loop: LOOP, times, stance: s, strides: [[1, 1]] };
  // the lift-off: 60 % of the half in clip time comes at 60 % of the half in phase
  const tLift = TD_L + s * 0.5;
  assert.ok(Math.abs(clockTime(clock, s * 0.5) - tLift) < 0.012, `lift-off at ${clockTime(clock, s * 0.5)}`);
  // the flight is even in time
  const mid = (s * 0.5 + 0.5) / 2;
  assert.ok(Math.abs(clockTime(clock, mid) - (tLift + (TD_L + 0.5 - tLift) / 2)) < 0.012);
});

test('clockTime wraps into the clip loop', () => {
  const clock: GaitClock = { loop: LOOP, times: gaitClockTimes(synth(), LOOP, 1), stance: 1, strides: [[1, 1]] };
  for (const p of [0, 0.3, 0.7, 0.99, 1.3, -0.2]) {
    const t = clockTime(clock, p);
    assert.ok(t >= LOOP[0] - 1e-9 && t < LOOP[1] + 1e-9, `phase ${p} → ${t}`);
  }
});

test('stanceTravel: the ground a cycle covers with the planted feet still', () => {
  // walking: each foot slides back 2A over its half, two halves over the whole cycle
  assert.ok(Math.abs(stanceTravel(synth(), LOOP, 1) - 4 * A) < 0.01);
  // running: each foot slides back A(1 − cos 0.6π) over 60 % of its half
  const s = STANCE_SHARE.run;
  const per = A * (1 - Math.cos(Math.PI * s));
  assert.ok(Math.abs(stanceTravel(synth(), LOOP, s) - (2 * per) / s) < 0.02);
});

// ── cycle rate ────────────────────────────────────────────────────────────────

const clockWith = (strides: [number, number][], stance = 1): GaitClock => ({ loop: LOOP, times: gaitClockTimes(synth(), LOOP, stance), stance, strides });

test('clipStride interpolates the measured table and holds flat past its ends', () => {
  const c = clockWith([[1, 0.8], [1.5, 1.1], [2, 1.2]]);
  assert.equal(clipStride(c, 0.5), 0.8);
  assert.ok(Math.abs(clipStride(c, 1.25) - 0.95) < 1e-9);
  assert.equal(clipStride(c, 3), 1.2);
});

test('the cycle turns so the planted foot is still: ground speed ÷ ground per cycle', () => {
  const walk = clockWith([[1, 1], [2, 2]]);
  const run = clockWith([[1, 2], [2, 3]], STANCE_SHARE.run);
  const g = strideGain(WALK_SPEED, 0);
  assert.ok(Math.abs(cycleRate(WALK_SPEED, 0, walk, run) - WALK_SPEED / g) < 1e-9);
  const gr = strideGain(RUN_SPEED, 1);
  assert.ok(Math.abs(cycleRate(RUN_SPEED, 1, walk, run) - RUN_SPEED / (1 + gr)) < 1e-9);
  assert.equal(cycleRate(0, 0, walk, run), 0);
  assert.ok(cycleRate(-1.3, 0, walk, run) > 0, 'backing up turns the cycle too (backwards, by stepPhase)');
  assert.ok(Math.abs(cycleRate(RUN_SPEED, 1, walk, null) - RUN_SPEED / clipStride(walk, strideGain(RUN_SPEED, 0))) < 1e-9, 'no run clip: the walk covers it');
});

test("with the ranger's own clips a brisk walk and a run step at a child's pace, not a scurry", () => {
  // his clips as the rig measures them at 1.32 m (run 6, the planted ball of the foot)
  const walk = clockWith([[1, 0.748], [1.3, 0.936], [1.6, 1.128], [1.9, 1.232]]);
  const run = clockWith([[1, 1.533], [1.3, 1.906], [1.6, 2.179], [1.9, 2.23]], STANCE_SHARE.run);
  const walkSteps = cadence(cycleRate(WALK_SPEED, 0, walk, run));
  const runSteps = cadence(cycleRate(RUN_SPEED, 1, walk, run));
  assert.ok(walkSteps >= 2.8 && walkSteps <= 3.7, `walk at ${walkSteps.toFixed(2)} steps/s`);
  assert.ok(runSteps >= 3.8 && runSteps <= 4.6, `run at ${runSteps.toFixed(2)} steps/s`);
  assert.ok(runSteps > walkSteps, 'running steps come quicker than walking ones');
});

test('stepPhase wraps both ways', () => {
  assert.ok(Math.abs(stepPhase(0.9, 2, 0.1) - 0.1) < 1e-9);
  assert.ok(Math.abs(stepPhase(0.1, 2, 0.1, true) - 0.9) < 1e-9);
  assert.equal(stepPhase(0.4, 2, -1), 0.4);
});

test('the feet go down at 0 and 0.5 of the shared cycle', () => {
  assert.deepEqual([...FOOT_PLANTS], [0, 0.5]);
});

// ── flight ────────────────────────────────────────────────────────────────────

test('flightLift: planted in the stance, an arc in the flight, nothing walking', () => {
  const a = STANCE_SHARE.run * 0.5;
  assert.equal(flightLift(0.1, 1), 0);
  assert.equal(flightLift(a, 1), 0);
  const mid = (a + 0.5) / 2;
  assert.ok(Math.abs(flightLift(mid, 1) - RUN_FLIGHT_HEIGHT) < 1e-9, 'peaks at mid-flight');
  assert.ok(Math.abs(flightLift(mid + 0.5, 1) - RUN_FLIGHT_HEIGHT) < 1e-9, 'both flights');
  assert.ok(Math.abs(flightLift(mid, 0.5) - RUN_FLIGHT_HEIGHT / 2) < 1e-9, 'scaled by the run share');
  assert.equal(flightLift(mid, 0), 0, 'a walk never leaves the ground');
  assert.equal(flightLift(mid, 1, 1), 0, 'a clip planted all the time never flies');
});
