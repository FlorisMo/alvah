import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mean, sd, iivCV, summarize } from './scoring.js';

test('mean — leeg en basis', () => {
  assert.equal(mean([]), 0);
  assert.equal(mean([5]), 5);
  assert.equal(mean([1, 2, 3, 4]), 2.5);
});

test('sd — steekproef-standaarddeviatie (n-1)', () => {
  assert.equal(sd([]), 0);
  assert.equal(sd([7]), 0);
  // [2,4,4,4,5,5,7,9] heeft sample-sd = 2 (klassiek voorbeeld)
  assert.equal(Math.round(sd([2, 4, 4, 4, 5, 5, 7, 9]) * 1000) / 1000, 2.138);
});

test('iivCV — nul bij mean 0, anders sd/mean', () => {
  assert.equal(iivCV([]), 0);
  assert.equal(iivCV([0, 0, 0]), 0);
  const arr = [100, 120, 110, 130, 90];
  const expected = sd(arr) / mean(arr);
  assert.equal(iivCV(arr), expected);
});

test('summarize — correcte accuracy, RT alleen over correcte trials', () => {
  const trials = [
    { i: 1, correct: true, rt: 1000 },
    { i: 2, correct: true, rt: 1200 },
    { i: 3, correct: false, rt: 999999 }, // moet NIET in RT-stats zitten
    { i: 4, correct: true, rt: 1100 },
  ];
  const s = summarize(trials);
  assert.equal(s.trialsN, 4);
  assert.equal(s.accuracy, 0.75);
  assert.equal(s.meanRT, 1100);
  // sdRT over [1000,1200,1100] sample-sd = 100
  assert.equal(s.sdRT, 100);
  // iivCV = 100/1100 ≈ 0.091
  assert.equal(s.iivCV, 0.091);
});

test('summarize — lege trials', () => {
  const s = summarize([]);
  assert.equal(s.trialsN, 0);
  assert.equal(s.accuracy, 0);
  assert.equal(s.meanRT, 0);
  assert.equal(s.sdRT, 0);
  assert.equal(s.iivCV, 0);
});
