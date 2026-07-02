import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  wrapAngle, shortestAngleDelta, dampedYaw, FOLLOW_MAX_RATE, FOLLOW_TAU,
} from './FollowCam.ts';

const TWO_PI = Math.PI * 2;

test('wrapAngle normalizes to (−π, π] and is periodic', () => {
  assert.ok(Math.abs(wrapAngle(0)) < 1e-12);
  assert.ok(Math.abs(wrapAngle(Math.PI) - Math.PI) < 1e-12);          // π stays π
  assert.ok(Math.abs(wrapAngle(-Math.PI) - Math.PI) < 1e-12);         // −π maps to +π
  assert.ok(Math.abs(wrapAngle(TWO_PI)) < 1e-12);                     // full turn ≡ 0
  assert.ok(Math.abs(wrapAngle(3 * Math.PI) - Math.PI) < 1e-12);
  // periodic: yaw and yaw ± 2π are the same normalized angle
  for (const a of [0.3, -1.1, 2.9, -3.0]) {
    assert.ok(Math.abs(wrapAngle(a) - wrapAngle(a + TWO_PI)) < 1e-12);
  }
});

test('shortestAngleDelta always takes the short way across ±π', () => {
  // from just below π to just above −π → tiny positive step, NOT a −2π sweep
  const d = shortestAngleDelta(Math.PI - 0.1, -Math.PI + 0.1);
  assert.ok(d > 0 && d < 0.3, `expected a small positive delta, got ${d}`);
  // symmetric case the other way
  const d2 = shortestAngleDelta(-Math.PI + 0.1, Math.PI - 0.1);
  assert.ok(d2 < 0 && d2 > -0.3, `expected a small negative delta, got ${d2}`);
  // plain interior case is the raw difference
  assert.ok(Math.abs(shortestAngleDelta(0.2, 0.5) - 0.3) < 1e-12);
});

test('dampedYaw eases toward the target and settles there', () => {
  let y = 0;
  const target = 1.0;
  for (let i = 0; i < 2000; i++) y = dampedYaw(y, target, 1 / 60);
  assert.ok(Math.abs(y - target) < 1e-6, `should converge to target, got ${y}`);
});

test('dampedYaw wraps the short way toward a target across ±π', () => {
  // current just below +π, target just above −π: it should INCREASE through π
  // (wrapping to the negative side), not sweep all the way back down.
  let y = Math.PI - 0.05;
  const target = -Math.PI + 0.05; // ≈ +0.1 away the short way
  const next = dampedYaw(y, target, 1 / 60);
  // one small step: the shortest arc is ~+0.1, so the step is a small positive
  // fraction of it — the result crosses π and wraps to a value near −π.
  const stepped = shortestAngleDelta(y, next);
  assert.ok(stepped > 0, `should step the short (positive) way, got ${stepped}`);
  // and it never overshoots the target
  assert.ok(Math.abs(shortestAngleDelta(next, target)) <= Math.abs(shortestAngleDelta(y, target)) + 1e-12);
});

test('dampedYaw is frame-rate independent in the unclamped regime', () => {
  // A small target (well within the rate clamp) stepped to the SAME total time
  // T at 30/60/120 fps must land on the same yaw (§3.2 dt-independence). The
  // clamp never binds here because the whole move is < maxRate·T.
  const target = 0.25; // rad; maxRate·T over T=0.5 s is ~1.05 rad ≫ 0.25 → unclamped
  const T = 0.5;
  const run = (fps: number): number => {
    let y = 0;
    const dt = 1 / fps;
    for (let t = 0; t < T - 1e-9; t += dt) y = dampedYaw(y, target, dt);
    return y;
  };
  const a = run(30), b = run(60), c = run(120);
  assert.ok(Math.abs(a - b) < 1e-9, `30 vs 60 fps: ${a} vs ${b}`);
  assert.ok(Math.abs(b - c) < 1e-9, `60 vs 120 fps: ${b} vs ${c}`);
  // sanity: it actually moved toward the target (not a frozen 0)
  assert.ok(b > 0.15 && b < target);
});

test('dampedYaw never turns faster than the rate clamp', () => {
  // a 180° about-face: without the clamp the exp-damp would jump a big fraction
  // of π in one frame; the clamp holds every step to ≤ maxRate·dt.
  const dt = 1 / 60;
  const maxStep = FOLLOW_MAX_RATE * dt;
  let y = 0;
  const target = Math.PI; // the worst case — a full about-face
  for (let i = 0; i < 5; i++) {
    const next = dampedYaw(y, target, dt);
    const step = Math.abs(shortestAngleDelta(y, next));
    assert.ok(step <= maxStep + 1e-12, `frame ${i}: step ${step} exceeded clamp ${maxStep}`);
    y = next;
  }
});

test('dampedYaw honours a paused frame (dt ≤ 0 is a no-op)', () => {
  assert.ok(Math.abs(dampedYaw(0.4, 1.0, 0) - 0.4) < 1e-12);
  assert.ok(Math.abs(dampedYaw(0.4, 1.0, -0.016) - 0.4) < 1e-12);
});

test('follow constants stay within the §3.2 comfort envelope', () => {
  assert.ok(FOLLOW_TAU >= 0.2 && FOLLOW_TAU <= 0.3, 'smooth-time ~0.2–0.3 s');
  // ~120°/s
  assert.ok(Math.abs(FOLLOW_MAX_RATE - (120 * Math.PI) / 180) < 1e-12);
});
