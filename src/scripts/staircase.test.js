import { test } from 'node:test';
import assert from 'node:assert/strict';
import { create, onTrial } from './staircase.js';

test('create — default en clamping', () => {
  const s = create();
  assert.equal(s.level, 2);
  assert.equal(s.min, 1);
  assert.equal(s.max, 9);
  assert.equal(s.consecCorrect, 0);

  const clampHigh = create({ level: 99, max: 9 });
  assert.equal(clampHigh.level, 9);
  const clampLow = create({ level: -5, min: 1 });
  assert.equal(clampLow.level, 1);
});

test('2-down/1-up — 2 correct op rij → level omhoog', () => {
  let s = create({ level: 3 });
  s = onTrial(s, true);
  assert.equal(s.level, 3);
  assert.equal(s.consecCorrect, 1);
  s = onTrial(s, true);
  assert.equal(s.level, 4);
  assert.equal(s.consecCorrect, 0);
});

test('2-down/1-up — 1 fout → level omlaag, reset tellers', () => {
  let s = create({ level: 4 });
  s = onTrial(s, true);
  s = onTrial(s, false);
  assert.equal(s.level, 3);
  assert.equal(s.consecCorrect, 0);
  assert.equal(s.consecWrong, 0);
});

test('clamp boven — geen level++ bij max', () => {
  let s = create({ level: 9, max: 9 });
  s = onTrial(s, true);
  s = onTrial(s, true);
  assert.equal(s.level, 9);
});

test('clamp onder — geen level-- bij min', () => {
  let s = create({ level: 1, min: 1 });
  s = onTrial(s, false);
  assert.equal(s.level, 1);
  assert.equal(s.consecWrong, 1);
});

test('fout onderbreekt correct-reeks', () => {
  let s = create({ level: 3 });
  s = onTrial(s, true);      // +1 correct
  s = onTrial(s, false);     // terug, reset
  assert.equal(s.level, 2);
  s = onTrial(s, true);      // +1 correct
  assert.equal(s.consecCorrect, 1);
  assert.equal(s.level, 2);
});
