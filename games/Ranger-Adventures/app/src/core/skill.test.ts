/**
 * skill.test.ts — run 7 `adaptive` (design `state/foundation/design.md` §5): the knob tables
 * every view reads, the judgement of a beat per breinkracht, the level's steps and its
 * floor. The expected numbers are written out by hand from the design's tables (an
 * independent model, not a call to the same code).
 *   node --experimental-strip-types --test src/core/skill.test.ts
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  knobsFor, knobsForLevel, knobsFromDifficulty, judgeBeat, updateSkill, mergeSkill, skillFloor, bandOf, grewBand,
  blankSkill, EF_ENGINES, type BeatSummary, type SkillRecord,
} from './skill.ts';

test('the band is the whole number of the level, 1..6', () => {
  assert.deepEqual([0, 1, 1.99, 2, 3.5, 4.2, 6, 9].map(bandOf), [1, 1, 1, 2, 3, 4, 6, 6]);
});

test('zoeken: look-alikes, glimpse, hint delay and the trail per band (design §5.3)', () => {
  const want = [
    [4, 0.38, 10, 2, 0.95], [5, 0.32, 12, 3, 0.85], [5, 0.27, 14, 3, 0.72],
    [6, 0.23, 16, 4, 0.60], [7, 0.20, 18, 4, 0.50], [8, 0.16, 20, 5, 0.40],
  ];
  for (let b = 1; b <= 6; b++) {
    const [lookAlikes, glimpse, hintAfterS, trailLegs, trailClarity] = want[b - 1];
    assert.deepEqual(knobsFor('zoeken', b + 0.5), { lookAlikes, glimpse, hintAfterS, trailLegs, trailClarity }, `band ${b}`);
  }
});

test('simon: the echo starts at 2, then 3 once 2 came easily; never two calls and done (design §5.2)', () => {
  const start = [2, 3, 3, 4, 4, 5], rounds = [3, 3, 4, 4, 4, 4];
  for (let b = 1; b <= 6; b++) assert.deepEqual(knobsFor('simon', b), { start: start[b - 1], max: 7, rounds: rounds[b - 1] }, `band ${b}`);
  // a first echo game plays 2 → 3 → 4 when he succeeds: three rounds from a start of 2
  assert.ok(knobsFor('simon', 1).rounds >= 3);
});

test('corsi: the route starts at 3 and grows to 5; two rounds, three from band 4', () => {
  const start = [3, 3, 4, 4, 5, 5], rounds = [2, 2, 2, 3, 3, 3];
  for (let b = 1; b <= 6; b++) assert.deepEqual(knobsFor('corsi', b), { start: start[b - 1], max: 6, rounds: rounds[b - 1] }, `band ${b}`);
  // (no jump of three spots between two bands: the old table went 3 → 6)
  for (let b = 2; b <= 6; b++) assert.ok(knobsFor('corsi', b).start - knobsFor('corsi', b - 1).start <= 1);
});

test('dagnacht: longer holds, more temptation, a shorter wait at a go-moment; slow-mo below band 3; two flips from band 4', () => {
  const holdS = [3, 3.5, 4, 4.5, 5, 6], tempts = [1, 1, 2, 2, 3, 3], goWaitS = [9, 8, 7, 6, 5, 5], flips = [1, 1, 1, 2, 2, 2];
  for (let b = 1; b <= 6; b++) {
    assert.deepEqual(knobsFor('dagnacht', b), { holdS: holdS[b - 1], tempts: tempts[b - 1], goWaitS: goWaitS[b - 1], slowmo: b < 3, flips: flips[b - 1] }, `band ${b}`);
  }
});

test('wisselen: more sorts, the turn sooner, two turns from band 4', () => {
  const sorts = [6, 6, 8, 8, 10, 10], flipEvery = [4, 4, 3, 3, 3, 2], flips = [1, 1, 1, 2, 2, 2];
  for (let b = 1; b <= 6; b++) {
    assert.deepEqual(knobsFor('wisselen', b), { sorts: sorts[b - 1], flipEvery: flipEvery[b - 1], flips: flips[b - 1] }, `band ${b}`);
  }
});

test('the older difficulty fields are derived from the same tables', () => {
  assert.deepEqual(knobsForLevel('zoeken', 1), { afleiders: 2, lensSterkte: 1 - 0.38, spoorLengte: 2, spoorHelderheid: 0.95 });
  assert.deepEqual(knobsForLevel('corsi', 4.2), { routeLengte: 4 });
  assert.deepEqual(knobsForLevel('simon', 2), { simonLengte: 3 });
  assert.deepEqual(knobsForLevel('dagnacht', 3), { slowmo: false });
  // and back: the look-alikes an older reader gets are the table's
  for (let b = 1; b <= 6; b++) assert.equal(knobsFromDifficulty('zoeken', knobsForLevel('zoeken', b)).lookAlikes, knobsFor('zoeken', b).lookAlikes);
});

test('the manual settings (automatisch off): no growth inside a beat, fixed rounds', () => {
  const manual = { afleiders: 4, lensSterkte: 0.6, spoorLengte: 3, spoorHelderheid: 0.7, routeLengte: 4, simonLengte: 3, slowmo: true, wisselFreq: 0.4 };
  const z = knobsFromDifficulty('zoeken', manual);
  assert.equal(z.lookAlikes, 6);
  assert.ok(Math.abs(z.glimpse - 0.4) < 1e-9, 'glimpse = 1 − haze');
  assert.deepEqual(knobsFromDifficulty('corsi', manual), { start: 4, max: 4, rounds: 2 });
  assert.deepEqual(knobsFromDifficulty('simon', manual), { start: 3, max: 3, rounds: 3 });
  assert.deepEqual(knobsFromDifficulty('dagnacht', manual), { holdS: 4, tempts: 1, goWaitS: 8, slowmo: true, flips: 1 });
  assert.deepEqual(knobsFromDifficulty('wisselen', manual), { sorts: 8, flipEvery: 4, flips: 1 });
});

test('judgement: the span engines (easy = round 1 clean and grew past the start)', () => {
  const span = (o: Partial<BeatSummary>): BeatSummary => ({ trials: 3, correct: 3, span: 4, start: 2, rounds: 3, eased: 0, firstClean: true, ...o });
  assert.equal(judgeBeat('simon', span({})), 'easy');
  assert.equal(judgeBeat('simon', span({ span: 2, correct: 1 })), 'fine', 'round 1 clean, never past the start');
  assert.equal(judgeBeat('corsi', span({ firstClean: false, span: 4 })), 'hard', 'round 1 not clean');
  assert.equal(judgeBeat('simon', { trials: 1, correct: 1 }), null, 'no span fields: the care game');
});

test('judgement: zoeken (easy = clean, no hint, within 8 s)', () => {
  assert.equal(judgeBeat('zoeken', { trials: 1, correct: 1, misses: 0, seconds: 3, hinted: false }), 'easy');
  assert.equal(judgeBeat('zoeken', { trials: 1, correct: 1, misses: 0, seconds: 12, hinted: false }), 'fine');
  assert.equal(judgeBeat('zoeken', { trials: 1, correct: 0, misses: 1, seconds: 6, hinted: false }), 'steady');
  assert.equal(judgeBeat('zoeken', { trials: 1, correct: 0, misses: 2, seconds: 6, hinted: false }), 'hard');
  assert.equal(judgeBeat('zoeken', { trials: 1, correct: 1, misses: 0, seconds: 20, hinted: true }), 'hard', 'a hint was needed');
});

test('judgement: dagnacht and wisselen', () => {
  assert.equal(judgeBeat('dagnacht', { trials: 5, correct: 5, impulses: 0 }), 'easy');
  assert.equal(judgeBeat('dagnacht', { trials: 5, correct: 4, impulses: 1 }), 'fine');
  assert.equal(judgeBeat('dagnacht', { trials: 5, correct: 3, impulses: 2 }), 'steady');
  assert.equal(judgeBeat('dagnacht', { trials: 5, correct: 2, impulses: 4 }), 'hard');
  assert.equal(judgeBeat('dagnacht', { trials: 1, correct: 1 }), null, 'the care game');
  assert.equal(judgeBeat('wisselen', { trials: 6, correct: 6, switches: 1, switchErrors: 0 }), 'easy');
  assert.equal(judgeBeat('wisselen', { trials: 6, correct: 5, switches: 1, switchErrors: 1 }), 'fine');
  assert.equal(judgeBeat('wisselen', { trials: 8, correct: 6, switches: 2, switchErrors: 2 }), 'hard');
  assert.equal(judgeBeat('wisselen', { trials: 6, correct: 3, switches: 1, switchErrors: 0 }), 'hard');
});

test('a level steps: easy +1, fine +0.34, hard −0.5, never under best − 1, never above 6', () => {
  const rec = (level: number, best = level): SkillRecord => ({ ...blankSkill(), level, best });
  const easy: BeatSummary = { trials: 3, correct: 3, span: 4, start: 2, rounds: 3, eased: 0, firstClean: true };
  const fine: BeatSummary = { ...easy, span: 2 };
  const hard: BeatSummary = { ...easy, firstClean: false };
  assert.equal(updateSkill(rec(1), easy, 'simon').level, 2);
  assert.equal(updateSkill(rec(1), fine, 'simon').level, 1.34);
  assert.equal(updateSkill(rec(3), hard, 'simon').level, 2.5);
  assert.equal(updateSkill(rec(2.2, 2.4), hard, 'simon').level, 1.7);
  assert.equal(updateSkill(rec(1.5, 2.4), hard, 'simon').level, 1.4, 'the floor: one step under his best');
  assert.equal(updateSkill(rec(5.6), easy, 'simon').level, 6);
  const up = updateSkill(rec(1), easy, 'simon');
  assert.equal(up.best, 2);
  assert.equal(up.beats, 1);
  assert.equal(up.trials, 3);
  // no engine given (an old caller): the old ±0.34 staircase
  assert.equal(updateSkill(rec(1), { trials: 1, correct: 1 }).level, 1.34);
  assert.equal(updateSkill(rec(2), { trials: 1, correct: 0 }, 'corsi').level, 1.66, 'care game: no span fields');
});

test('a whole step crossed marks growth; down never does', () => {
  assert.equal(grewBand(1, 2), true);
  assert.equal(grewBand(1.68, 2.02), true);
  assert.equal(grewBand(1, 1.34), false);
  assert.equal(grewBand(2.5, 2), false);
});

test('the floor is one step under the best, never below 1', () => {
  assert.deepEqual([1, 1.5, 2, 3.8, 6].map(skillFloor), [1, 1, 1, 2.8, 5]);
});

test('an old save: beats from its trials (capped), its level kept', () => {
  const old = { simon: { level: 3.5, best: 3.8, reversals: [], recent: [true], trials: 30 }, corsi: { level: 2, best: 2, trials: 400 } };
  const m = mergeSkill(old);
  assert.equal(m.simon.beats, 30);
  assert.equal(m.corsi.beats, 50);
  assert.equal(m.simon.level, 3.5);
  assert.equal(m.zoeken.beats, 0);
  for (const e of EF_ENGINES) assert.ok(m[e].level >= 1);
  // a practised old save starts higher on the new tables: level 3.5 → band 3
  assert.equal(knobsFor('simon', m.simon.level).start, 3);
});
