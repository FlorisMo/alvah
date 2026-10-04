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

test('the story order: the adventures in the order the game meets them, then the rest in the area\'s order (run 7)', async () => {
  const { storyOrderOf } = await import('./patrol.ts');
  const { AREA_VELUWE } = await import('../content/veluwe.ts');
  const order = storyOrderOf(AREA_VELUWE.missies, ['frisling', 'ree-niet-aanraken', 'wildcamera', 'eekhoorn', 'ven']).map((m) => m.id);
  console.log(`  story order: ${order.join(', ')}`);
  assert.deepEqual(order, ['frisling', 'ree-niet-aanraken', 'wildcamera', 'eekhoorn', 'ven', 'ecoduct', 'stuifzand', 'nachtronde', 'vos', 'herstel']);
  // (the four met first keep their order whatever comes after them)
  assert.deepEqual(storyOrderOf(AREA_VELUWE.missies, ['frisling', 'ree-niet-aanraken', 'wildcamera', 'eekhoorn']).map((m) => m.id).slice(0, 5),
    ['frisling', 'ree-niet-aanraken', 'wildcamera', 'eekhoorn', 'ven']);
  // with three of them done the next is the squirrel, then the frogs
  const done: Record<string, boolean> = { frisling: true, 'ree-niet-aanraken': true, wildcamera: true };
  const ids = storyOrderOf(AREA_VELUWE.missies, ['frisling', 'ree-niet-aanraken', 'wildcamera', 'eekhoorn', 'ven']);
  assert.equal(nextPatrolTarget(ids, done), 'eekhoorn');
  assert.equal(nextPatrolTarget(ids, { ...done, eekhoorn: true }), 'ven');
  // an id the area does not have is left out; nothing is lost or doubled
  assert.equal(storyOrderOf(AREA_VELUWE.missies, ['nope', 'ven', 'ven']).length, AREA_VELUWE.missies.length);
});
