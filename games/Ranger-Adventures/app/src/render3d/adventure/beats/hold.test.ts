/**
 * hold.test.ts — a rustkracht moment played with the body (beats/hold-math.ts): reaches
 * and time become exactly the `DagnachtRun` choices a card would have made, so the
 * logged summary is the one the 2D floor logs for the same answers (construct parity,
 * design run6-missions §6). Run: `npm test`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { HoldCore, HOLD_S, HOLD_SILENT_S, RustTempo, readSeconds } from './hold-math.ts';
import { knobsFor } from '../../../core/skill.ts';
import { newPlay } from '../../../core/play.ts';
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
  assert.deepEqual(run.summary(), { trials: 5, correct: 4, impulses: 2 }, 'run 7: both reaches are impulses');
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
  assert.deepEqual(run.summary(), { trials: 5, correct: 4, impulses: 1 });
});

test('the times: a hold of ~4 s after the voice, ~3.5 s after a silent read of 280 ms a word', () => {
  assert.ok(HOLD_S >= 3.5 && HOLD_S <= 5);
  assert.ok(HOLD_SILENT_S >= 3 && HOLD_SILENT_S <= HOLD_S);
  assert.equal(readSeconds('Hij is bang. Raak hem niet aan.'), 7 * 0.28);
  assert.equal(readSeconds('  '), 0);
});

test('run 7: the hold starts at the band\'s, eases half a second after a reach (≥ 2.5 s), grows after two clean holds (≤ band + 1)', () => {
  const rng = newPlay('t', 1, 1).fork('rust').rng;
  const t = new RustTempo(knobsFor('dagnacht', 1), false, rng);
  assert.equal(t.seconds, 3);
  t.reached();
  assert.equal(t.seconds, 2.5);
  t.reached();
  assert.equal(t.seconds, 2.5, 'never under 2.5 s');
  t.held(2.5, false);
  t.held(2.5, true);
  assert.equal(t.seconds, 2.5, 'one clean hold: not yet');
  t.held(2.5, true);
  assert.equal(t.seconds, 3, 'two clean holds in a row: half a second more');
  for (let i = 0; i < 10; i++) t.held(t.seconds, true);
  assert.equal(t.seconds, 4, 'at most the band\'s + 1');
  assert.equal(t.longest, 4);
  const silent = new RustTempo(knobsFor('dagnacht', 4), true, rng);
  assert.equal(silent.seconds, 4, 'read silently: half a second less (4.5 → 4)');
});

test('run 7: temptations come at seeded moments, never in the first 1.1 s, one per share of the hold', () => {
  for (let seed = 1; seed <= 50; seed++) {
    for (const band of [1, 3, 5, 6]) {
      const k = knobsFor('dagnacht', band);
      const t = new RustTempo(k, false, newPlay('t', seed, 1).fork('rust').rng);
      const at = t.temptsFor(t.seconds);
      assert.equal(at.length, k.tempts);
      assert.ok(at.every((x) => x >= 1.1 && x <= t.seconds - 0.5 + 1e-9), `band ${band} seed ${seed}: ${at}`);
      for (let i = 1; i < at.length; i++) assert.ok(at[i] > at[i - 1], 'in order');
    }
  }
  const a = new RustTempo(knobsFor('dagnacht', 5), false, newPlay('t', 9, 1).fork('rust').rng).temptsFor(5);
  const b = new RustTempo(knobsFor('dagnacht', 5), false, newPlay('t', 9, 1).fork('rust').rng).temptsFor(5);
  assert.deepEqual(a, b, 'a replayed play: the same moments');
});
