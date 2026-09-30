/**
 * wildlife.test.ts — the roaming animals see the jeep and the ranger coming (run 6, FEEL).
 *
 * The strongest checks drive the REAL jeep (`vehicle.jeepStep`, its own give-way brake
 * included) at an animal moved by `wildStep`, frame by frame at 60 Hz, in a small open
 * world: the animal must be off the jeep's path before the brake ever needs to act (the
 * jeep keeps its 6 m/s, `yieldFor` stays null), never come within 0.8 m of the body, and be
 * back on its loop within ~15 s. Where it cannot get away, it stands and the brake stops the
 * jeep short of it. On foot: a calm walker gets close, a runner sends it off early, nobody
 * ever gets within 1.5 m. And the manners: it only ever moves along its facing, never toward
 * what it leaves, and never twitches between two modes.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  JEEP_CAPS, jeepStep, JEEP_BODY, type JeepState, type JeepWorld, type YieldAnimal,
} from './vehicle.ts';
import {
  TEMPERAMENT, temperamentFor, newWildState, wildStep, readRanger, readJeep, planAway, predictJeep,
  strideBody, gaitOf, jeepCorridor, PATH_N, PATH_STRIDE,
  type WildState, type WildWorld, type Threats, type LoopPoint, type JeepRead, type RangerRead,
} from './wildlife.ts';

const REE = TEMPERAMENT['animal-ree-roedeer'];
const REE_R = 0.56;
const DT = 1 / 60;

/** An open world: every point free unless `blocked` says so; steps go straight; the loop
 *  is one grazing spot (the animal's home). */
function openWorld(home: LoopPoint, blocked: (x: number, z: number) => boolean = () => false): WildWorld {
  return {
    free: (x, z) => !blocked(x, z),
    move: (_fx, _fz, tx, tz, out) => { out.x = tx; out.z = tz; },
    loop: () => home,
    loopLeg: 10,
  };
}

const emptyJeepWorld = (animals: YieldAnimal[]): JeepWorld => ({ solids: [], zones: [], walls: [], animals, limits: { bound: 500 } });

/** Body-to-body gap between the jeep and an animal footprint. */
function bodyGap(j: JeepState, x: number, z: number, r: number): number {
  const fx = Math.sin(j.heading), fz = Math.cos(j.heading);
  let g = Infinity;
  for (const c of JEEP_BODY) g = Math.min(g, Math.hypot(j.x + fx * c.along - x, j.z + fz * c.along - z) - c.r - r);
  return g;
}

interface Run {
  noticedAt: number;      // jeep body gap when it first left roam
  minGap: number;
  minSpeedAtFull: number; // lowest jeep speed once it first reached full speed, until it passed
  yielded: boolean;       // the jeep's brake named the animal at least once
  backInRoam: number;     // seconds after the jeep passed until it roamed again (Infinity: never)
  modes: Set<string>;
  sideways: number;       // frames it moved more than 25° off its facing
  toward: number;         // frames it moved toward the jeep while making way
  stuck: number;          // longest stretch (s) it stood still while making way
  state: WildState;
}

/**
 * Drive the real jeep straight (full gas, no steer) from (0, 0) along +z at an animal
 * standing at (ax, az), grazing (its loop is its spot). The animal's world can block
 * ground. The jeep's path prediction is the real `predictJeep`, in a world without
 * animals, refreshed every 0.1 s as the World does.
 */
function driveAt(ax: number, az: number, opts: { blocked?: (x: number, z: number) => boolean; tm?: typeof REE; r?: number; secs?: number; faceTo?: number; speed0?: number; steer?: number } = {}): Run {
  const tm = opts.tm ?? REE, r = opts.r ?? REE_R;
  const home: LoopPoint = { x: ax, z: az, facing: opts.faceTo ?? Math.PI / 2, moving: false };
  const s = newWildState(home, 0);
  const world = openWorld(home, opts.blocked);
  let j: JeepState = { x: 0, z: 0, heading: 0, speed: opts.speed0 ?? 6, contact: false, braked: false };
  const animal: YieldAnimal & { x: number; z: number } = { id: 'ree', x: ax, z: az, r };
  const path = new Float64Array(PATH_N * PATH_STRIDE);
  let pathN = 0, predictIn = 0;
  const run: Run = { noticedAt: Infinity, minGap: Infinity, minSpeedAtFull: Infinity, yielded: false, backInRoam: Infinity, modes: new Set(), sideways: 0, toward: 0, stuck: 0, state: s };
  let stillYield = 0;
  let full = j.speed >= 5.99, passedAt = -1;
  const secs = opts.secs ?? 25;
  for (let t = 0; t < secs; t += DT) {
    const passed = opts.steer ? false : j.z > az + 4;
    const want = { throttle: passed ? 0 : 1, steer: opts.steer ?? 0 };
    animal.x = s.x; animal.z = s.z;
    const f = jeepStep(j, want, DT, JEEP_CAPS, emptyJeepWorld([animal]));
    j = f;
    if (f.yieldFor) run.yielded = true;
    if (f.speed >= 5.99) full = true;
    if (full && !passed) run.minSpeedAtFull = Math.min(run.minSpeedAtFull, f.speed);
    if ((predictIn -= DT) <= 0) { predictIn = 0.1; pathN = predictJeep(j, want, JEEP_CAPS, emptyJeepWorld([]), path); }
    const jr: JeepRead = { x: j.x, z: j.z, heading: j.heading, speed: f.moved, yawRate: 0, path, pathN };
    const th: Threats = { ranger: null, jeep: Math.abs(j.speed) < 0.01 && passed ? null : jr };
    const x0 = s.x, z0 = s.z;
    wildStep(s, tm, r, th, world, DT);
    const mx = s.x - x0, mz = s.z - z0, m = Math.hypot(mx, mz);
    if (m > 1e-3) {
      const off = Math.acos(Math.max(-1, Math.min(1, (mx * Math.sin(s.facing) + mz * Math.cos(s.facing)) / m)));
      if (off > (25 * Math.PI) / 180) run.sideways++;
      if ((s.mode === 'yield' || s.mode === 'away')) {
        const tx = j.x - s.x, tz = j.z - s.z, tl = Math.hypot(tx, tz);
        if ((mx * tx + mz * tz) / (m * tl) > 0.3) run.toward++;
      }
    }
    run.modes.add(s.mode);
    stillYield = s.mode === 'yield' && s.moved < 0.05 ? stillYield + DT : 0;
    run.stuck = Math.max(run.stuck, stillYield);
    const gap = bodyGap(j, s.x, s.z, r);
    run.minGap = Math.min(run.minGap, gap);
    if (s.mode !== 'roam' && run.noticedAt === Infinity) run.noticedAt = gap;
    if (passed && passedAt < 0) passedAt = t;
    if (passedAt >= 0 && s.mode === 'roam' && run.backInRoam === Infinity && t > passedAt + 0.5) run.backInRoam = t - passedAt;
  }
  return run;
}

test('every roamer: a calm walker gets closer than a runner, and none can be caught (its top speed beats his run)', () => {
  for (const [id, tm] of Object.entries(TEMPERAMENT)) {
    assert.ok(tm.near < tm.flight && tm.flight < tm.alert, `${id}: near < flight < alert`);
    assert.ok(tm.flight < tm.runFlight && tm.alert < tm.runAlert, `${id}: a runner is seen further off`);
    assert.ok(tm.walk < tm.step && tm.step < tm.trot && tm.trot < tm.top, `${id}: walk < step < trot < top`);
    assert.ok(tm.top > 4.2, `${id}: faster than the running ranger (4.2 m/s)`);
    assert.ok(tm.turn <= tm.turnQuick && tm.turnQuick <= 4.5, `${id}: a calm turn, never a spin`);
  }
  assert.equal(temperamentFor('nobody'), REE, 'an unknown creature reacts like a roe deer');
});

test('readRanger: standing still or walking past is no reason to look up; coming at it is; close is always', () => {
  const at = (x: number, z: number, heading: number, speed: number, running = false): RangerRead => ({ x, z, heading, speed, running });
  assert.equal(readRanger(0, 0, REE, at(0, -5, 0, 0), false).look, false, 'standing 5 m off: it grazes on');
  assert.equal(readRanger(0, 0, REE, at(-5, 0, 0, 2.2), false).look, false, 'walking past 5 m to the side');
  assert.equal(readRanger(0, 0, REE, at(0, -5.5, 0, 2.2), false).look, true, 'walking at it from 5.5 m: it looks up');
  assert.equal(readRanger(0, 0, REE, at(0, -5.5, 0, 2.2), false).flee, false, '…but stays');
  assert.equal(readRanger(0, 0, REE, at(0, -3.2, 0, 0), false).flee, true, 'standing 3.2 m off: it steps away');
  const run = readRanger(0, 0, REE, at(0, -8.2, 0, 4.2, true), false);
  assert.ok(run.flee && run.closing > 4, 'running at it from 8.2 m: it moves off');
  assert.equal(readRanger(0, 0, REE, at(0, -8.2, Math.PI, 4.2, true), false).look, false, 'running away from it');
});

test('readJeep: its path ahead is the path; beside it is only worth a look; a standing jeep only when close', () => {
  const j = (x: number, z: number, speed: number): JeepRead => ({ x, z, heading: 0, speed, yawRate: 0, path: null, pathN: 0 });
  const ahead = readJeep(0, 18, REE_R, j(0, 0, 6));
  assert.equal(ahead.kind, 'path');
  assert.ok(ahead.tti > 0.9 && ahead.tti < 1.6, `its brake would look at it in ${ahead.tti.toFixed(2)} s`);
  assert.equal(readJeep(9, 18, REE_R, j(0, 0, 6)).kind, 'watch', '9 m off its line: it watches');
  assert.equal(readJeep(0, -6, REE_R, j(0, 0, 6)).kind, 'none', 'behind it: nothing');
  assert.equal(readJeep(0, 50, REE_R, j(0, 0, 6)).kind, 'none', 'far beyond its horizon');
  assert.equal(readJeep(2.4, 1, REE_R, j(0, 0, 0)).kind, 'near', 'a standing jeep right beside it');
  assert.equal(readJeep(6, 1, REE_R, j(0, 0, 0)).kind, 'none', 'a standing jeep 6 m off is just a thing');
  // the corridor the brake watches is inside the one the animal keeps out of
  assert.ok(jeepCorridor(REE_R) < jeepCorridor(REE_R) + 0.5);
});

test('driven straight at a grazing ree at 6 m/s: it leaves the track early, the jeep never brakes for it, and it goes back to grazing', () => {
  for (const [ax, face] of [[0, Math.PI / 2], [0.3, -Math.PI / 2], [-1.2, 0], [1.5, Math.PI], [0, Math.PI]] as const) {
    const run = driveAt(ax, 30, { faceTo: face });
    assert.ok(run.noticedAt >= 10, `ax ${ax}: it looked up while the jeep was still ${run.noticedAt.toFixed(1)} m off (≥ 10)`);
    assert.ok(run.modes.has('yield'), `ax ${ax}: it made way`);
    assert.equal(run.yielded, false, `ax ${ax}: the jeep never had to brake for it`);
    assert.ok(run.minSpeedAtFull >= 5.99, `ax ${ax}: the jeep kept its speed (${run.minSpeedAtFull.toFixed(2)} m/s)`);
    assert.ok(run.minGap >= 0.8, `ax ${ax}: never within 0.8 m of the body (${run.minGap.toFixed(2)})`);
    assert.ok(run.backInRoam <= 15, `ax ${ax}: back to grazing ${run.backInRoam.toFixed(1)} s after it passed`);
    assert.equal(run.sideways, 0, `ax ${ax}: it only moved along its facing`);
    assert.equal(run.toward, 0, `ax ${ax}: it never moved toward the jeep`);
  }
});

test('the boar, the fox and the squirrel make way too, each at its own pace', () => {
  for (const [id, r] of [['animal-wildzwijn-boar', 0.735], ['animal-vos-fox', 0.54], ['animal-eekhoorn-squirrel', 0.2]] as const) {
    const run = driveAt(0.2, 30, { tm: TEMPERAMENT[id], r });
    assert.equal(run.yielded, false, `${id}: the jeep never had to brake`);
    assert.ok(run.minSpeedAtFull >= 5.99, `${id}: the jeep kept its speed (${run.minSpeedAtFull.toFixed(2)})`);
    assert.ok(run.minGap >= 0.8, `${id}: never within 0.8 m (${run.minGap.toFixed(2)})`);
    assert.ok(run.backInRoam <= 15, `${id}: back to grazing after ${run.backInRoam.toFixed(1)} s`);
    assert.equal(run.sideways, 0, `${id}: along its facing`);
  }
});

test('an animal with nowhere to go on its side stands still, and the jeep stops softly in front of it', () => {
  // a wall of bushes on both sides of the track beyond 1.5 m: no way out
  const run = driveAt(0.8, 30, { blocked: (x) => Math.abs(x) > 1.5 });
  assert.ok(!run.modes.has('yield'), 'it did not run along the track');
  assert.equal(run.yielded, true, 'the jeep braked for it');
  assert.ok(run.minGap >= 0.6, `and stopped short of it (gap ${run.minGap.toFixed(2)} m)`);
  assert.equal(run.toward, 0);
});

test('it never crosses the jeep\'s path to get away: off-centre, it goes out on its own side', () => {
  const run = driveAt(1.0, 30, { faceTo: -Math.PI / 2 }); // on the jeep's right... facing across it (−x)
  assert.ok(run.state.x > 1.0, `it ended on its own side (x ${run.state.x.toFixed(2)})`);
  const left = driveAt(-1.0, 30, { faceTo: Math.PI / 2 });
  assert.ok(left.state.x < -1.0, `and on the left, left (x ${left.state.x.toFixed(2)})`);
});

/** Walk (or run) the ranger straight at a grazing animal from `from` m, as a player holding a
 *  key, and read the distances at which it looks up, moves off, and the closest he got. */
function walkAt(from: number, speed: number, running: boolean, secs = 12): { lookAt: number; awayAt: number; min: number; modes: string[]; toward: number; farthest: number } {
  const home: LoopPoint = { x: 0, z: 0, facing: Math.PI / 2, moving: false };
  const s = newWildState(home, 0);
  const world = openWorld(home);
  const rg: RangerRead = { x: 0, z: -from, heading: 0, speed, running };
  let lookAt = -1, awayAt = -1, min = Infinity, toward = 0, farthest = 0;
  const modes: string[] = [];
  for (let t = 0; t < secs; t += DT) {
    // he walks at where it is now (a child following it), stopping when he bumps into it
    const dx = s.x - rg.x, dz = s.z - rg.z, d = Math.hypot(dx, dz);
    rg.heading = Math.atan2(dx, dz);
    const step = Math.min(speed * DT, Math.max(0, d - (REE_R + 0.3)));
    rg.x += Math.sin(rg.heading) * step; rg.z += Math.cos(rg.heading) * step;
    rg.speed = step / DT;
    const x0 = s.x, z0 = s.z;
    wildStep(s, REE, REE_R, { ranger: rg, jeep: null }, world, DT);
    const d2 = Math.hypot(s.x - rg.x, s.z - rg.z);
    min = Math.min(min, d2);
    farthest = Math.max(farthest, Math.hypot(s.x, s.z));
    if (s.mode !== 'roam' && lookAt < 0) lookAt = d2;
    if (s.mode === 'away' && awayAt < 0) awayAt = d2;
    if (modes[modes.length - 1] !== s.mode) modes.push(s.mode);
    const mx = s.x - x0, mz = s.z - z0, m = Math.hypot(mx, mz);
    if (m > 1e-3 && (mx * (rg.x - s.x) + mz * (rg.z - s.z)) / (m * d2) > 0.3) toward++;
  }
  return { lookAt, awayAt, min, modes, toward, farthest };
}

test('on foot: walking calmly at the ree it looks up at 5-6 m, steps away at 3-4 m and never lets him within 1.5 m', () => {
  const w = walkAt(12, 2.2, false);
  assert.ok(w.lookAt <= 6.1 && w.lookAt >= 5, `looked up at ${w.lookAt.toFixed(2)} m`);
  assert.ok(w.awayAt <= 4 && w.awayAt >= 3, `stepped away at ${w.awayAt.toFixed(2)} m`);
  assert.ok(w.min >= 1.5, `never closer than 1.5 m (closest ${w.min.toFixed(2)})`);
  assert.equal(w.toward, 0, 'never moved toward him');
});

test('on foot: running at the ree it moves off from about 8 m, and he never catches it', () => {
  const r = walkAt(16, 4.2, true);
  assert.ok(r.awayAt >= 7 && r.awayAt <= 9, `it moved off at ${r.awayAt.toFixed(2)} m`);
  assert.ok(r.min >= 1.5, `he never caught up (closest ${r.min.toFixed(2)} m)`);
  assert.equal(r.toward, 0);
});

test('a ranger standing still near its edge: it looks up once and settles, never twitching between modes', () => {
  for (const d of [3.5, 3.7, 5.9, 6.1]) {
    const home: LoopPoint = { x: 0, z: 0, facing: 0, moving: false };
    const s = newWildState(home, 0);
    const rg: RangerRead = { x: 0, z: -d, heading: 0, speed: 0, running: false };
    let changes = 0, last = s.mode;
    for (let t = 0; t < 20; t += DT) {
      // he shuffles a hair back and forth on the spot
      rg.z = -d + 0.05 * Math.sin(t * 3);
      rg.speed = Math.abs(0.15 * Math.cos(t * 3));
      rg.heading = Math.cos(t * 3) > 0 ? 0 : Math.PI;
      wildStep(s, REE, REE_R, { ranger: rg, jeep: null }, openWorld(home), DT);
      if (s.mode !== last) { changes++; last = s.mode; }
    }
    assert.ok(changes <= 4, `at ${d} m: ${changes} mode changes in 20 s`);
  }
});

test('its roam clock stands still while it is off its loop, so it resumes where it left off', () => {
  const home: LoopPoint = { x: 0, z: 0, facing: 0, moving: false };
  const s = newWildState(home, 5);
  const rg: RangerRead = { x: 0, z: -3, heading: 0, speed: 1.5, running: false };
  for (let t = 0; t < 1; t += DT) wildStep(s, REE, REE_R, { ranger: rg, jeep: null }, openWorld(home), DT);
  assert.notEqual(s.mode, 'roam');
  assert.equal(s.loopT, 5, 'the loop clock paused');
});

test('planAway: away from the ranger on open ground, never past him; cornered it finds nothing', () => {
  const out = { x: 0, z: 0 };
  assert.equal(planAway(0, 0, 0, REE_R, 0, -3, 6, openWorld({ x: 0, z: 0, facing: 0, moving: false }), out), true);
  assert.ok(out.z > 1, `it steps away from him (to z ${out.z.toFixed(2)})`);
  const boxed = openWorld({ x: 0, z: 0, facing: 0, moving: false }, (x, z) => Math.hypot(x, z) > 0.6);
  assert.equal(planAway(0, 0, 0, REE_R, 0, -3, 6, boxed, out), false);
});

test('the gait follows the speed; a bound is a low arc that lands on its hooves and never sinks', () => {
  assert.equal(gaitOf(0, REE), 'still');
  assert.equal(gaitOf(0.9, REE), 'walk');
  assert.equal(gaitOf(2.6, REE), 'trot');
  assert.equal(gaitOf(3.6, REE), 'bound');
  assert.equal(gaitOf(3.6, TEMPERAMENT['animal-vos-fox']), 'trot', 'only the ree bounds');
  for (const kind of ['bound', 'hop', 'trot', 'walk'] as const) {
    let top = 0, ground = 0;
    // the ree's hooves stand 0.4 m fore and aft of its middle, a squirrel's 0.1 m
    const reach = kind === 'bound' ? 0.4 : kind === 'hop' ? 0.1 : 0;
    for (let c = 0; c < 3; c += 0.01) {
      const b = strideBody(kind, c, kind === 'bound' ? 4.6 : kind === 'hop' ? 0.5 : 2.5);
      assert.ok(b.lift >= 0, `${kind}: never below the ground`);
      assert.ok(b.lift - Math.abs(b.pitch) * reach >= -1e-9, `${kind}: its pitch never dips a hoof into the ground (at ${c.toFixed(2)})`);
      assert.ok(Math.abs(b.pitch) <= 0.13, `${kind}: a calm pitch`);
      top = Math.max(top, b.lift);
      if (b.lift < 1e-6) ground++;
    }
    assert.ok(top <= (kind === 'bound' ? 0.34 : 0.08), `${kind}: low (${top.toFixed(3)} m)`);
    if (kind === 'bound' || kind === 'hop') assert.ok(ground > 30, `${kind}: it lands every stride`);
  }
});

test('predictJeep: the path the jeep will drive, from now, a pose every 0.1 s', () => {
  const out = new Float64Array(PATH_N * PATH_STRIDE);
  const n = predictJeep({ x: 0, z: 0, heading: 0, speed: 6, contact: false, braked: false }, { throttle: 1, steer: 0 }, JEEP_CAPS, emptyJeepWorld([]), out);
  assert.equal(n, PATH_N);
  assert.ok(Math.abs(out[(n - 1) * PATH_STRIDE + 1] - 6 * 0.1 * (n - 1)) < 0.2, 'at 6 m/s straight on');
  const turning = predictJeep({ x: 0, z: 0, heading: 0, speed: 6, contact: false, braked: false }, { throttle: 1, steer: 1 }, JEEP_CAPS, emptyJeepWorld([]), out);
  assert.ok(out[(turning - 1) * PATH_STRIDE] < -2, 'a right turn key curves it to the right (−x at heading 0)');
});

test('a jeep circling with the wheel held: the animal on its arc sees the curve coming, never stands stuck, and the jeep never brakes', () => {
  for (const th of [150, 180, 215]) {
    const a = (th * Math.PI) / 180;
    // held right at 6 m/s the jeep circles about (−10, 0) (radius ~10 m): the animal stands on
    // that circle 26-38 m of arc ahead (it comes into the jeep's horizon as the jeep comes round)
    const run = driveAt(-10 + 10 * Math.cos(a), 10 * Math.sin(a), { steer: 1, secs: 20, faceTo: (th * 7) % 6 });
    assert.equal(run.yielded, false, `${th}°: the jeep never had to brake for it`);
    assert.ok(run.minGap >= 0.8, `${th}°: never within 0.8 m (${run.minGap.toFixed(2)})`);
    assert.ok(run.stuck <= 1.2, `${th}°: making way it never stood stuck (${run.stuck.toFixed(2)} s)`);
    assert.equal(run.sideways, 0, `${th}°: along its facing`);
  }
});

test('a boy who stands still near it: it watches him a moment, then grazes on, and its loop never walks it up to him', () => {
  // its loop leads straight toward where he stands
  const loop = (t: number): LoopPoint => ({ x: 0, z: Math.min(4, t * 0.5), facing: 0, moving: t < 8 });
  const world: WildWorld = { free: () => true, move: (_a, _b, tx, tz, o) => { o.x = tx; o.z = tz; }, loop, loopLeg: 8 };
  const s = newWildState(loop(0), 0);
  const rg: RangerRead = { x: 0, z: 8.6, heading: Math.PI, speed: 0, running: false };
  let alertS = 0, closest = Infinity;
  for (let t = 0; t < 20; t += DT) {
    wildStep(s, REE, REE_R, { ranger: rg, jeep: null }, world, DT);
    if (s.mode === 'alert') alertS += DT;
    closest = Math.min(closest, Math.hypot(s.x - rg.x, s.z - rg.z));
  }
  assert.equal(s.mode, 'roam', 'it grazes on');
  assert.ok(alertS < REE.watch + 1.5, `it watched him ${alertS.toFixed(1)} s`);
  assert.ok(closest >= REE.flight + 1, `its loop never brought it within ${closest.toFixed(2)} m of him`);
});

test('chased hard for half a minute, it circles its home ground instead of being carried off across the world', () => {
  const r = walkAt(16, 4.2, true, 30);
  assert.ok(r.min >= 1.5, `he never got within 1.5 m, even as it turned back round (closest ${r.min.toFixed(2)} m)`);
  assert.ok(r.farthest <= 26, `it stayed within ${r.farthest.toFixed(1)} m of its home`);
  assert.equal(r.toward, 0);
});

test('walking back to its loop past a boy who stands on the way, it goes round him at a distance, never up to him and off again', () => {
  // its loop point lies 12 m on, straight through where he stands
  const home: LoopPoint = { x: 0, z: 12, facing: 0, moving: false };
  const world: WildWorld = { free: () => true, move: (_a, _b, tx, tz, o) => { o.x = tx; o.z = tz; }, loop: () => home, loopLeg: 10 };
  const s = newWildState({ x: 0, z: 0, facing: 0, moving: false }, 0);
  s.mode = 'return'; s.gx = 0; s.gz = 12;
  const rg: RangerRead = { x: 0.3, z: 6, heading: 0, speed: 0, running: false };
  let closest = Infinity, flees = 0, last = s.mode;
  for (let t = 0; t < 30; t += DT) {
    wildStep(s, REE, REE_R, { ranger: rg, jeep: null }, world, DT);
    closest = Math.min(closest, Math.hypot(s.x - rg.x, s.z - rg.z));
    if (s.mode === 'away' && last !== 'away') flees++;
    last = s.mode;
  }
  assert.equal(flees, 0, 'it never had to step away from him');
  assert.ok(closest >= REE.flight, `it kept ${closest.toFixed(2)} m from him`);
  assert.equal(s.mode, 'roam', 'and it is back on its loop, grazing');
});
