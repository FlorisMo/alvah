/**
 * hold.test.ts — a rustkracht moment played with the body (beats/hold-math.ts): reaches
 * and time become exactly the `DagnachtRun` choices a card would have made, so the
 * logged summary is the one the 2D floor logs for the same answers (construct parity,
 * design run6-missions §6). Run: `npm test`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { HoldCore, HOLD_S, HOLD_SILENT_S, readSeconds } from './hold-math.ts';
import { DagnachtRun } from '../../../engines/dagnacht.ts';

/** A hold over a real run, with every `choose` call recorded. */
function rig(seconds = HOLD_S): { core: HoldCore; run: DagnachtRun; calls: boolean[] } {
  const run = new DagnachtRun(5);
  const calls: boolean[] = [];
  const core = new HoldCore(seconds, (goed) => { calls.push(goed); run.choose(goed); });
  return { core, run, calls };
}

test('kept still: nothing happens until the line is read, then one full hold is choose(true), once', () => {
  const { core, run, calls } = rig();
  assert.equal(core.tick(10), false, 'the clock does not run while the line is read');
  core.begin(2);
  assert.equal(core.tick(2 + HOLD_S - 0.1), false);
  assert.equal(core.left(2 + 1), HOLD_S - 1);
  assert.equal(core.tick(2 + HOLD_S), true);
  assert.equal(core.tick(99), true, 'held stays held');
  assert.deepEqual(calls, [true], 'one choice: the right one');
  assert.equal(core.impulse(), false, 'a reach after the moment was held does nothing');
  assert.equal(run.index, 1, 'the run moved on to the next encounter');
});

test('a reach during the hold: choose(false), the animal reacts, the same hold again from the start', () => {
  const { core, run, calls } = rig();
  core.begin(0);
  assert.equal(core.tick(3), false);
  assert.equal(core.impulse(), true);
  assert.equal(core.phase, 'react');
  assert.equal(core.impulse(), false, 'while it reacts, another reach is not counted');
  assert.equal(core.tick(100), false, 'no hold while it reacts');
  core.again();
  assert.equal(core.phase, 'read');
  core.begin(10);
  assert.equal(core.tick(10 + HOLD_S - 0.5), false, 'the 3 s before the reach do not count');
  assert.equal(core.tick(10 + HOLD_S), true);
  assert.deepEqual(calls, [false, true]);
  assert.equal(core.impulses, 1);
  assert.equal(run.index, 1);
});

test('a reach while the line is still read counts too; many reaches mark the encounter once', () => {
  const { core, run, calls } = rig();
  assert.equal(core.impulse(), true, 'a hand at the piglet before the hold began is still a reach');
  core.again();
  core.begin(1);
  assert.equal(core.impulse(), true);
  core.again();
  core.begin(5);
  core.tick(5 + HOLD_S);
  assert.deepEqual(calls, [false, false, true]);
  assert.equal(core.impulses, 2);
  // the rest of the run answered right on the cards: 5 trials, 4 correct
  while (!run.finished) run.choose(true);
  assert.deepEqual(run.summary(), { trials: 5, correct: 4 });
});

test('two body moments in a run of five: the summary is the one the cards would log', () => {
  // aaien (a reach, then still), dragen (card, right), voeren (card, right), zeug (still at
  // once), pad (card, right): 5 trials, 4 correct — and the same as five cards answered so
  const run = new DagnachtRun(5);
  const aaien = new HoldCore(HOLD_S, (g) => run.choose(g));
  aaien.impulse(); aaien.again(); aaien.begin(0); aaien.tick(HOLD_S);
  run.choose(true); run.choose(true);
  const zeug = new HoldCore(HOLD_S, (g) => run.choose(g));
  zeug.begin(0); zeug.tick(HOLD_S);
  run.choose(true);
  const cards = new DagnachtRun(5);
  for (const g of [false, true, true, true, true, true]) cards.choose(g);
  assert.deepEqual(run.summary(), cards.summary());
  assert.deepEqual(run.summary(), { trials: 5, correct: 4 });
});

test('the times: a hold of ~4 s after the voice, ~3.5 s after a silent read of 280 ms a word', () => {
  assert.ok(HOLD_S >= 3.5 && HOLD_S <= 5);
  assert.ok(HOLD_SILENT_S >= 3 && HOLD_SILENT_S <= HOLD_S);
  assert.equal(readSeconds('Hij is bang. Raak hem niet aan.'), 7 * 0.28);
  assert.equal(readSeconds('  '), 0);
});
