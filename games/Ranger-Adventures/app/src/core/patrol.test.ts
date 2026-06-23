/**
 * patrol.test.ts — seeded unit test for the pure patrol selector.
 * Run: `node --experimental-strip-types src/core/patrol.test.ts`
 *
 * Covers the invariants the continuous-patrol flow relies on: the cue points at
 * the first not-yet-done mission in authored order, a just-finished mission is
 * skipped (its `voltooid` flag is already set), all-done yields no heading, and
 * the selector is deterministic + pure (no mutation of its inputs).
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { nextPatrolTarget, capturedClue } from './patrol.ts';

const MISSIONS = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

test('points at the first not-yet-done mission in authored order', () => {
  assert.equal(nextPatrolTarget(MISSIONS, {}), 'a');
  assert.equal(nextPatrolTarget(MISSIONS, { a: true }), 'b');
  assert.equal(nextPatrolTarget(MISSIONS, { a: true, b: true }), 'c');
});

test('a just-finished mission (flag already set) is skipped, even mid-list', () => {
  // b finished first, then a — next heading is the first still-open one, c.
  assert.equal(nextPatrolTarget(MISSIONS, { b: true, a: true }), 'c');
  // only a middle one done → still points at the earliest open (a)
  assert.equal(nextPatrolTarget(MISSIONS, { c: true }), 'a');
});

test('all done → null (no heading; the case-board is the climax)', () => {
  assert.equal(nextPatrolTarget(MISSIONS, { a: true, b: true, c: true, d: true }), null);
});

test('empty mission list → null', () => {
  assert.equal(nextPatrolTarget([], {}), null);
});

test('deterministic + pure — repeated calls match, inputs untouched', () => {
  const voltooid = { a: true };
  const before = JSON.stringify(voltooid);
  assert.equal(nextPatrolTarget(MISSIONS, voltooid), nextPatrolTarget(MISSIONS, voltooid));
  assert.equal(JSON.stringify(voltooid), before);
});

/* ---- capturedClue: the diegetic wildcamera → prikbord gate ---- */
const NONE: ReadonlySet<string> = new Set();

test('an in-world verhaalHaak mission, newly found, pins its clue', () => {
  assert.equal(capturedClue({ verhaalHaak: 'camera' }, true, NONE), 'camera');
  assert.equal(capturedClue({ verhaalHaak: 'spoor' }, true, new Set(['camera'])), 'spoor');
});

test('a mission without a story hook never pins a clue (no beat)', () => {
  assert.equal(capturedClue({}, true, NONE), null);
  assert.equal(capturedClue({ verhaalHaak: null }, true, NONE), null);
});

test('lodge-launched (not fromWorld) never fires the in-flow beat', () => {
  // the prikbord is one tap from the hut, so no diegetic interruption there
  assert.equal(capturedClue({ verhaalHaak: 'camera' }, false, NONE), null);
});

test('a clue already on the board never re-announces (replay OR shared hook)', () => {
  // replay: this mission's hook is already in the found-set
  assert.equal(capturedClue({ verhaalHaak: 'camera' }, true, new Set(['camera'])), null);
  // two "band" missions: the second finds 'band' already pinned by the first
  assert.equal(capturedClue({ verhaalHaak: 'band' }, true, new Set(['band'])), null);
});

test('capturedClue is deterministic + pure — inputs untouched', () => {
  const m = { verhaalHaak: 'band' };
  const found = new Set(['spoor']);
  const beforeM = JSON.stringify(m);
  const beforeF = [...found].join(',');
  assert.equal(capturedClue(m, true, found), capturedClue(m, true, found));
  assert.equal(JSON.stringify(m), beforeM);
  assert.equal([...found].join(','), beforeF);
});
