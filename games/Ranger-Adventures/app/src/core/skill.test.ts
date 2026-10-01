/**
 * skill.test.ts — run 7 `contracts`: the knobs every view reads (design §4.2) equal TODAY's
 * behaviour at every level, so landing them changes nothing a player feels. The expected
 * numbers are written out by hand from what the builders do today (an independent model,
 * not a call to the same code). Run: `node --experimental-strip-types --test src/core/skill.test.ts`
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { knobsFor, knobsForLevel, knobsFromDifficulty, EF_ENGINES } from './skill.ts';

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

test('zoeken: look-alikes = afleiders + 2, the trail as buildSpoor, glimpse and hint as the search beat', () => {
  // afleiders = clampInt(2 + d, 2, 8): 3..8; spoorLengte = clampInt(2 + 0.6 d, 2, 5); spoorHelderheid = clamp(0.95 - 0.14 d, 0.25, 0.95)
  const want = [
    { lookAlikes: 5, trailLegs: 3, trailClarity: 0.81 },
    { lookAlikes: 6, trailLegs: 3, trailClarity: 0.67 },
    { lookAlikes: 7, trailLegs: 4, trailClarity: 0.53 },
    { lookAlikes: 8, trailLegs: 4, trailClarity: 0.39 },
    { lookAlikes: 9, trailLegs: 5, trailClarity: 0.25 },
    { lookAlikes: 10, trailLegs: 5, trailClarity: 0.25 },
  ];
  for (let d = 1; d <= 6; d++) {
    const k = knobsFor('zoeken', d);
    assert.equal(k.lookAlikes, want[d - 1].lookAlikes, `level ${d} look-alikes`);
    assert.equal(k.trailLegs, want[d - 1].trailLegs, `level ${d} trail legs`);
    assert.ok(Math.abs(k.trailClarity - want[d - 1].trailClarity) < 1e-9, `level ${d} trail clarity ${k.trailClarity}`);
    assert.equal(k.glimpse, 0.3);
    assert.equal(k.hintAfterS, 14);
  }
});

test('corsi: one route of clampInt(2 + d, 3, 6), as buildCorsiTrial lays it', () => {
  const lengths = [3, 4, 5, 6, 6, 6];
  for (let d = 1; d <= 6; d++) assert.deepEqual(knobsFor('corsi', d), { start: lengths[d - 1], max: lengths[d - 1], rounds: 1 }, `level ${d}`);
});

test('simon: from 2 calls up to clampInt(1 + d, 2, 6), one echo per length (the echo after two calls at level 1)', () => {
  const targets = [2, 3, 4, 5, 6, 6];
  for (let d = 1; d <= 6; d++) {
    const t = targets[d - 1];
    assert.deepEqual(knobsFor('simon', d), { start: 2, max: t, rounds: t - 1 }, `level ${d}`);
  }
});

test('dagnacht: a 4 s hold, one temptation, slow-mo while learning (below level 3)', () => {
  for (let d = 1; d <= 6; d++) assert.deepEqual(knobsFor('dagnacht', d), { holdS: 4, tempts: 1, goWaitS: 8, slowmo: d < 3 }, `level ${d}`);
});

test('wisselen: eight sorts, the turn after round(2 + (1 - freq) · 4), one turn', () => {
  for (let d = 1; d <= 6; d++) {
    const freq = clamp(0.12 + d * 0.13, 0.1, 0.9);
    assert.deepEqual(knobsFor('wisselen', d), { sorts: 8, flipEvery: Math.max(2, Math.round(2 + (1 - freq) * 4)), flips: 1 }, `level ${d}`);
  }
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((d) => knobsFor('wisselen', d).flipEvery), [5, 4, 4, 3, 3, 2]);
});

test('levels outside 1..6 clamp; fractional levels read the same formulas', () => {
  for (const e of EF_ENGINES) {
    assert.deepEqual(knobsFor(e, 0), knobsFor(e, 1), `${e} below 1`);
    assert.deepEqual(knobsFor(e, 9), knobsFor(e, 6), `${e} above 6`);
  }
  assert.deepEqual(knobsFor('corsi', 1.34), knobsFromDifficulty('corsi', knobsForLevel('corsi', 1.34)));
});

test('the manual settings (automatisch off) map onto the same knobs', () => {
  // Settings' defaults: afleiders 4, spoorLengte 3, spoorHelderheid 0.7, routeLengte 4, simonLengte 3, slowmo true, wisselFreq 0.4
  const manual = { afleiders: 4, spoorLengte: 3, spoorHelderheid: 0.7, routeLengte: 4, simonLengte: 3, slowmo: true, wisselFreq: 0.4 };
  assert.deepEqual(knobsFromDifficulty('zoeken', manual), { lookAlikes: 6, glimpse: 0.3, hintAfterS: 14, trailLegs: 3, trailClarity: 0.7 });
  assert.deepEqual(knobsFromDifficulty('corsi', manual), { start: 4, max: 4, rounds: 1 });
  assert.deepEqual(knobsFromDifficulty('simon', manual), { start: 2, max: 3, rounds: 2 });
  assert.deepEqual(knobsFromDifficulty('dagnacht', manual), { holdS: 4, tempts: 1, goWaitS: 8, slowmo: true });
  assert.deepEqual(knobsFromDifficulty('wisselen', manual), { sorts: 8, flipEvery: 4, flips: 1 });
});
