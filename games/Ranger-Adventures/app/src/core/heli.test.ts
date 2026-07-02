import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  climbStep, flyStep, heliVignette, heliAvailable,
  HELI_CRUISE_HEIGHT, HELI_PAD_HEIGHT, HELI_MAX_CLIMB_RATE, HELI_CAPS,
  HELI_ROLL, HELI_VIGNETTE_MAX, HELI_HOVER_EPS,
} from './heli.ts';

const near = (a: number, b: number, eps = 1e-9): boolean => Math.abs(a - b) < eps;

test('heli: the horizon is a hard level (roll 0) — a compile-time invariant', () => {
  assert.equal(HELI_ROLL, 0);
});

test('climbStep: vertical speed is clamped to ≤ 2 m/s even far from target (LOCKED clause)', () => {
  const dt = 1 / 60;
  // ground → cruise is a 25 m jump; the raw ease would overshoot the clamp.
  const s = climbStep(HELI_PAD_HEIGHT, HELI_CRUISE_HEIGHT, dt);
  assert.ok(Math.abs(s.climbRate) <= HELI_MAX_CLIMB_RATE + 1e-9, 'climb rate within the 2 m/s cap');
  assert.ok(near(Math.abs(s.climbRate), HELI_MAX_CLIMB_RATE), 'a big gap climbs at exactly the cap');
  assert.ok(near(s.altitude, HELI_PAD_HEIGHT + HELI_MAX_CLIMB_RATE * dt), 'moved one clamped step up');
});

test('climbStep: descent is symmetric and also rate-clamped', () => {
  const dt = 1 / 30;
  const s = climbStep(HELI_CRUISE_HEIGHT, HELI_PAD_HEIGHT, dt);
  assert.ok(s.climbRate < 0, 'descending → negative rate');
  assert.ok(Math.abs(s.climbRate) <= HELI_MAX_CLIMB_RATE + 1e-9, 'descent within the cap');
  assert.ok(near(Math.abs(s.climbRate), HELI_MAX_CLIMB_RATE), 'a big drop descends at exactly the cap');
});

test('climbStep: eases to rest AT the target (converges, no overshoot, no jitter)', () => {
  let alt = HELI_PAD_HEIGHT;
  for (let i = 0; i < 2000; i++) alt = climbStep(alt, HELI_CRUISE_HEIGHT, 1 / 60).altitude;
  assert.ok(near(alt, HELI_CRUISE_HEIGHT, 1e-3), 'settles onto cruise height');
  const settled = climbStep(alt, HELI_CRUISE_HEIGHT, 1 / 60);
  assert.ok(Math.abs(settled.climbRate) < 1e-3, 'no residual vertical motion at rest → no jitter');
});

test('climbStep: near the target the ease (not the clamp) governs — a soft touchdown', () => {
  const dt = 1 / 60;
  // 0.1 m from cruise, the exp ease moves far less than the 2 m/s clamp would allow.
  const s = climbStep(HELI_CRUISE_HEIGHT - 0.1, HELI_CRUISE_HEIGHT, dt);
  assert.ok(Math.abs(s.climbRate) < HELI_MAX_CLIMB_RATE, 'close in, it glides slower than the cap');
  assert.ok(s.altitude > HELI_CRUISE_HEIGHT - 0.1 && s.altitude < HELI_CRUISE_HEIGHT, 'moved toward, no overshoot');
});

test('climbStep: dt ≤ 0 is a no-op (a paused frame never climbs)', () => {
  const s = climbStep(10, 25, 0);
  assert.ok(near(s.altitude, 10) && near(s.climbRate, 0));
  const neg = climbStep(10, 25, -0.5);
  assert.ok(near(neg.altitude, 10) && near(neg.climbRate, 0));
});

test('flyStep: composes the jeep horizontal drive with the clamped vertical ease', () => {
  const s = flyStep({ heading: 0, altitude: HELI_PAD_HEIGHT }, { throttle: 1, steer: 0 }, HELI_CRUISE_HEIGHT, 0.5);
  // horizontal: forward at cruise along +z (heading 0 → (sin,cos) = (0,1))
  assert.ok(near(s.speed, HELI_CAPS.maxSpeed), 'cruises at the horizontal cap');
  assert.ok(near(s.dz, HELI_CAPS.maxSpeed * 0.5) && near(s.dx, 0), 'forward drive along the heading');
  // vertical: climbing toward cruise, dy = altitude change, rate clamped
  assert.ok(s.dy > 0 && near(s.dy, s.altitude - HELI_PAD_HEIGHT), 'dy is the altitude change');
  assert.ok(Math.abs(s.climbRate) <= HELI_MAX_CLIMB_RATE + 1e-9, 'climb still capped inside flyStep');
});

test('flyStep: the two axes are independent — hover flat while climbing', () => {
  const s = flyStep({ heading: 0.5, altitude: 5 }, { throttle: 0, steer: 0 }, HELI_CRUISE_HEIGHT, 1 / 60);
  assert.ok(near(s.speed, 0) && near(s.dx, 0) && near(s.dz, 0), 'no throttle → no horizontal motion');
  assert.ok(s.climbRate > 0 && s.dy > 0, 'still climbing toward cruise while hovering horizontally');
  assert.ok(near(s.heading, 0.5), 'no steer → heading held');
});

test('heliVignette: OFF at hover, ramps gently with motion, capped at the max', () => {
  assert.equal(heliVignette(0, 0), 0, 'dead hover → no vignette');
  assert.equal(heliVignette(HELI_HOVER_EPS / 2, 0), 0, 'below the hover epsilon still counts as hover');
  const slow = heliVignette(2, 0);
  assert.ok(slow > 0 && slow < HELI_VIGNETTE_MAX, 'a slow drift fades in a partial vignette');
  assert.ok(near(heliVignette(HELI_CAPS.maxSpeed, 0), HELI_VIGNETTE_MAX), 'full cruise → the peak (gentle) frame');
  assert.ok(heliVignette(999, 999) <= HELI_VIGNETTE_MAX + 1e-9, 'never exceeds the cap, however fast');
});

test('heliVignette: a pure climb (no horizontal motion) still shows the frame', () => {
  const v = heliVignette(0, HELI_MAX_CLIMB_RATE);
  assert.ok(v > 0, 'lifting off vertically is translation too → vignette on');
});

test('heliAvailable: opt-in AND not reduced-motion — flight is withheld, not merely calmed', () => {
  assert.equal(heliAvailable(true, false), true, 'opted in, full motion → available');
  assert.equal(heliAvailable(false, false), false, 'default UIT → unavailable');
  assert.equal(heliAvailable(true, true), false, 'reduced-motion withholds flight entirely');
  assert.equal(heliAvailable(false, true), false, 'off and reduced → unavailable');
});
