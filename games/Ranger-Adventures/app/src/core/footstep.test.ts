/**
 * footstep.test.ts — pins the W4.7b footstep cadence core.
 * Run: `node --experimental-strip-types src/core/footstep.test.ts`
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  footSurface,
  stepFrame,
  newFootAccum,
  STRIDE_M,
  MIN_STEP_SPEED,
  plantsBetween,
} from './footstep.ts';

test('surface: only drift-sand reads as zand, the rest as gras', () => {
  assert.equal(footSurface('stuifzand'), 'zand');
  assert.equal(footSurface('heide'), 'gras');
  assert.equal(footSurface('bos'), 'gras');
  assert.equal(footSurface('ven'), 'gras');
});

test('standing (speed below threshold) never fires and re-arms a full stride', () => {
  const r = stepFrame({ dist: 0.2 }, MIN_STEP_SPEED - 0.01, 0.5);
  assert.equal(r.steps, 0);
  assert.equal(r.accum.dist, STRIDE_M, 'carry re-arms so a stop-then-go re-plants a foot');
});

test('a fresh accumulator plants a foot on the first moving frame', () => {
  const r = stepFrame(newFootAccum(), 2.4, 0.04);
  assert.equal(r.steps, 1, 'starting to walk plants a foot at once, not after a silent stride');
});

test('a footstep fires roughly every stride of ground', () => {
  let acc = { dist: 0 };
  let total = 0;
  // walk 10 m in 4 cm frames at a walking speed
  for (let i = 0; i < 250; i++) {
    const r = stepFrame(acc, 2.4, 0.04);
    acc = r.accum;
    total += r.steps;
  }
  assert.equal(total, Math.floor(10 / STRIDE_M), '10 m ≈ ⌊10/stride⌋ steps');
});

test('cadence is frame-rate independent (same total over the same ground)', () => {
  // cover the same 12 m of ground, chunked `frames` ways (30/60/120 fps)
  const walk = (frames: number) => {
    let acc = newFootAccum();
    let total = 0;
    const per = 12 / frames;
    for (let i = 0; i < frames; i++) {
      const r = stepFrame(acc, 2.4, per);
      acc = r.accum;
      total += r.steps;
    }
    return total;
  };
  assert.equal(walk(30), walk(60), '30 vs 60 fps give the same step count over 12 m');
  assert.equal(walk(60), walk(120), '60 vs 120 fps give the same step count over 12 m');
});

test('a faster walk fires more steps in the same number of frames', () => {
  const run = (speed: number, distPerFrame: number) => {
    let acc = newFootAccum();
    let total = 0;
    for (let i = 0; i < 60; i++) {
      const r = stepFrame(acc, speed, distPerFrame);
      acc = r.accum;
      total += r.steps;
    }
    return total;
  };
  const slow = run(1.0, 1.0 / 60);
  const fast = run(3.0, 3.0 / 60);
  assert.ok(fast > slow, `fast (${fast}) covers more ground → more steps than slow (${slow})`);
});

test('plantsBetween: a foot goes down each time the cycle crosses its plant', () => {
  const P = [0, 0.5];
  assert.equal(plantsBetween(0.4, 0.45, P), 0);
  assert.equal(plantsBetween(0.45, 0.55, P), 1, 'the right foot');
  assert.equal(plantsBetween(0.95, 0.05, P), 1, 'the left foot, across the wrap');
  assert.equal(plantsBetween(0.3, 0.3, P), 0, 'standing still');
  assert.equal(plantsBetween(0.55, 0.45, P, true), 1, 'backing up crosses it backwards');
  assert.equal(plantsBetween(0.05, 0.95, P, true), 1, 'backwards across the wrap');
  assert.equal(plantsBetween(0.49, 0.5, P), 1, 'landing exactly on it counts once');
  assert.equal(plantsBetween(0.5, 0.51, P), 0, '…and not again');
});
