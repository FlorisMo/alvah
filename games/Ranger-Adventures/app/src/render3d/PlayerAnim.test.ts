import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  stepWalkWeight, dominantGait, WALK_ENTER_SPEED, BLEND_TAU,
} from './PlayerAnim.ts';

/**
 * W3.2 player-animation state machine (pure). Pins the crossfade maths without a
 * browser: speed drives the target, the ease is frame-rate-independent and
 * clamped, and the dominant gait reports correctly for the dev hook.
 */

test('at rest the weight eases toward idle (0)', () => {
  let w = 1; // start fully walking
  for (let i = 0; i < 200; i++) w = stepWalkWeight(w, 0, 1 / 60);
  assert.ok(w < 0.01, `standing still should settle to idle, got ${w}`);
  assert.equal(dominantGait(w), 'idle');
});

test('while moving the weight eases toward walk (1)', () => {
  let w = 0; // start idle
  for (let i = 0; i < 200; i++) w = stepWalkWeight(w, 2.4, 1 / 60);
  assert.ok(w > 0.99, `sustained walking should settle to walk, got ${w}`);
  assert.equal(dominantGait(w), 'walk');
});

test('a held key crosses into the walk gait quickly (< 0.2 s)', () => {
  let w = 0;
  let t = 0;
  const dt = 1 / 60;
  while (dominantGait(w) !== 'walk' && t < 1) { w = stepWalkWeight(w, 2.4, dt); t += dt; }
  assert.equal(dominantGait(w), 'walk');
  assert.ok(t < 0.2, `should read walk within ~0.2 s of moving, took ${t.toFixed(3)} s`);
});

test('speed just under the enter threshold stays idle', () => {
  let w = 0;
  for (let i = 0; i < 200; i++) w = stepWalkWeight(w, WALK_ENTER_SPEED - 0.01, 1 / 60);
  assert.ok(w < 0.01, `sub-threshold drift must not trigger a walk, got ${w}`);
});

test('dt-independence: 30/60/120 fps land on the same weight for the same elapsed time', () => {
  const T = 0.5; // seconds of walking from idle
  const run = (dt: number): number => {
    let w = 0;
    for (let t = 0; t < T - 1e-9; t += dt) w = stepWalkWeight(w, 2.4, dt);
    return w;
  };
  const a = run(1 / 30), b = run(1 / 60), c = run(1 / 120);
  assert.ok(Math.abs(a - b) < 1e-3, `30 vs 60 fps diverge: ${a} vs ${b}`);
  assert.ok(Math.abs(b - c) < 1e-3, `60 vs 120 fps diverge: ${b} vs ${c}`);
});

test('the weight never leaves [0,1] even on a huge dt spike', () => {
  const hi = stepWalkWeight(1, 2.4, 100, BLEND_TAU);
  const lo = stepWalkWeight(0, 0, 100, BLEND_TAU);
  assert.ok(hi <= 1 && hi >= 0, `clamped high, got ${hi}`);
  assert.ok(lo <= 1 && lo >= 0, `clamped low, got ${lo}`);
});
