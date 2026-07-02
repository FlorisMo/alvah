import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  driveStep, driveCaps, calmSpeed, JEEP_CAPS, JEEP_CAPS_REDUCED,
  ANIMAL_SLOW_SPEED, ANIMAL_SLOW_RADIUS,
} from './vehicle.ts';

const near = (a: number, b: number, eps = 1e-9): boolean => Math.abs(a - b) < eps;

test('driveCaps: reduced-motion halves speed AND turn-rate (comfort clause)', () => {
  assert.deepEqual(driveCaps(false), JEEP_CAPS);
  assert.deepEqual(driveCaps(true), JEEP_CAPS_REDUCED);
  assert.ok(near(JEEP_CAPS_REDUCED.maxSpeed, JEEP_CAPS.maxSpeed / 2));
  assert.ok(near(JEEP_CAPS_REDUCED.turnRate, JEEP_CAPS.turnRate / 2));
  // the §5 W5.1 numbers
  assert.ok(near(JEEP_CAPS.maxSpeed, 6) && near(JEEP_CAPS.turnRate, 1.2));
  assert.ok(near(JEEP_CAPS_REDUCED.maxSpeed, 3) && near(JEEP_CAPS_REDUCED.turnRate, 0.6));
});

test('driveStep: forward at heading 0 drives +z (into (sin,cos) forward), no turn', () => {
  const s = driveStep(0, { throttle: 1, steer: 0 }, 0.5, JEEP_CAPS);
  assert.ok(near(s.heading, 0), 'heading unchanged with no steer');
  assert.ok(near(s.speed, 6), 'speed = throttle · maxSpeed');
  assert.ok(near(s.dz, 3), 'dz = speed · dt = 6 · 0.5');
  assert.ok(near(s.dx, 0), 'no lateral drift straight ahead');
});

test('driveStep: reverse throttle drives backward', () => {
  const s = driveStep(0, { throttle: -1, steer: 0 }, 1, JEEP_CAPS);
  assert.ok(s.speed < 0 && near(s.speed, -6));
  assert.ok(s.dz < 0, 'reverse moves along −forward');
});

test('driveStep: right-steer (+) decreases yaw, left-steer (−) increases it', () => {
  const right = driveStep(0, { throttle: 0, steer: 1 }, 1, JEEP_CAPS);
  assert.ok(right.heading < 0, 'press right → yaw decreases (nose swings to driver-right)');
  const left = driveStep(0, { throttle: 0, steer: -1 }, 1, JEEP_CAPS);
  assert.ok(left.heading > 0, 'press left → yaw increases');
});

test('driveStep: the yaw change is rate-clamped to turnRate · dt', () => {
  const dt = 1 / 60;
  for (const caps of [JEEP_CAPS, JEEP_CAPS_REDUCED]) {
    // steer saturated past ±1 still only turns at the cap (clampUnit)
    const s = driveStep(0.7, { throttle: 1, steer: 5 }, dt, caps);
    const delta = Math.abs(s.heading - 0.7);
    assert.ok(delta <= caps.turnRate * dt + 1e-9, `|Δyaw| ≤ turnRate·dt for ${caps.turnRate}`);
    assert.ok(near(delta, caps.turnRate * dt), 'full steer turns at exactly the cap');
  }
});

test('driveStep: throttle is clamped so speed never exceeds maxSpeed', () => {
  const s = driveStep(0, { throttle: 9, steer: 0 }, 1, JEEP_CAPS);
  assert.ok(near(s.speed, JEEP_CAPS.maxSpeed), 'saturated throttle caps at maxSpeed');
  assert.ok(Math.abs(s.speed) <= JEEP_CAPS.maxSpeed + 1e-9);
});

test('driveStep: straight-line driving is frame-rate independent', () => {
  // one big step vs many small steps, steer 0 → identical displacement.
  const oneBig = driveStep(1.3, { throttle: 1, steer: 0 }, 1, JEEP_CAPS);
  let x = 0, z = 0, h = 1.3;
  const N = 120;
  for (let i = 0; i < N; i++) {
    const s = driveStep(h, { throttle: 1, steer: 0 }, 1 / N, JEEP_CAPS);
    h = s.heading; x += s.dx; z += s.dz;
  }
  assert.ok(near(x, oneBig.dx, 1e-9) && near(z, oneBig.dz, 1e-9),
    'summed sub-steps equal the single step (30/60/120 fps parity)');
});

test('calmSpeed: caps to the crawl within the slow radius, untouched beyond it (W5.2)', () => {
  // full-speed jeep close to an animal → held to the 2 m/s crawl
  assert.ok(near(calmSpeed(6, ANIMAL_SLOW_RADIUS - 0.1), ANIMAL_SLOW_SPEED), 'inside radius caps to crawl');
  assert.ok(near(calmSpeed(6, ANIMAL_SLOW_RADIUS), ANIMAL_SLOW_SPEED), 'exactly at the radius still slows');
  // far away → the drive is untouched
  assert.ok(near(calmSpeed(6, ANIMAL_SLOW_RADIUS + 0.1), 6), 'beyond the radius is untouched');
  assert.ok(near(calmSpeed(6, Infinity), 6), 'no animal in range → full speed');
});

test('calmSpeed: preserves sign (reverse still reverses) and never speeds up', () => {
  assert.ok(near(calmSpeed(-6, 2), -ANIMAL_SLOW_SPEED), 'reverse near an animal crawls backward');
  // already gentle → passes straight through, even close
  assert.ok(near(calmSpeed(1.5, 0), 1.5), 'a speed under the crawl is not raised to the crawl');
  assert.ok(near(calmSpeed(-1, 0), -1), 'gentle reverse untouched');
});

test('driveStep: is pure — heading arg is never mutated, output wraps to (−π, π]', () => {
  const start = Math.PI - 0.05;
  const s = driveStep(start, { throttle: 0, steer: -1 }, 1, JEEP_CAPS); // left-steer pushes past π
  assert.ok(s.heading <= Math.PI + 1e-12 && s.heading > -Math.PI - 1e-12, 'wrapped into range');
  assert.ok(s.heading < 0, 'crossing +π wraps to the negative side, not a runaway value');
});
