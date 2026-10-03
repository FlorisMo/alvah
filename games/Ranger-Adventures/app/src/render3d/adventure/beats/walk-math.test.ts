/**
 * walk-math.test.ts — the two walking rustkracht moments (beats/walk-math.ts): a run on a
 * pace stretch and a wait past the window are exactly the `DagnachtRun` choices a card
 * would have made, so the logged summary is the one the 2D floor logs for the same
 * answers (construct parity). Run: `npm test`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PaceCore, WalkOnCore, paceStretch, paceTempts, TIRED_PACE, PACE_MIN_M, WALK_ON_M,
  PACE_TEMPT_FROM_M, PACE_TEMPT_END_M,
} from './walk-math.ts';
import { HoldCore, HOLD_S } from './hold-math.ts';
import { knobsFor } from '../../../core/skill.ts';
import { newPlay } from '../../../core/play.ts';
import { DagnachtRun } from '../../../engines/dagnacht.ts';

test('pace: a stretch is the level\'s hold walked twice at the tired pace, at least 8 m, or the way left', () => {
  assert.equal(paceStretch(3, 30), PACE_MIN_M, 'band 1: 3 s × 2 × 1.1 = 6.6 m → the 8 m floor');
  assert.equal(paceStretch(6, 30), 6 * 2 * TIRED_PACE, 'band 6: 13.2 m');
  assert.equal(paceStretch(4.5, 6.1), 6.1, 'a short way: the rest of it');
  assert.equal(paceStretch(4, -1), 0);
  for (const band of [1, 2, 3, 4, 5, 6]) {
    const k = knobsFor('dagnacht', band);
    assert.ok(paceStretch(k.holdS, 99) >= paceStretch(knobsFor('dagnacht', Math.max(1, band - 1)).holdS, 99), 'never shorter at a higher level');
  }
});

test('pace: walked calmly to its end is choose(true), once; nothing else happened', () => {
  const run = new DagnachtRun(5);
  const calls: boolean[] = [];
  const core = new PaceCore((g) => { calls.push(g); run.choose(g); });
  assert.equal(core.arrived(), true);
  assert.equal(core.arrived(), true, 'done stays done');
  assert.equal(core.run(), false, 'a run after the stretch is done does nothing');
  assert.deepEqual(calls, [true]);
  assert.equal(run.index, 1);
});

test('pace: a run is the impulse — marked once, the animal hides, the stretch again from where it comes out', () => {
  const run = new DagnachtRun(5);
  const calls: boolean[] = [];
  const core = new PaceCore((g) => { calls.push(g); run.choose(g); });
  assert.equal(core.run(), true);
  assert.equal(core.phase, 'react');
  assert.equal(core.run(), false, 'running on while it hides is the same run');
  assert.equal(core.arrived(), false, 'running on to the end while it hides is not done');
  core.again();
  assert.equal(core.phase, 'walk');
  assert.equal(core.stretches, 2, 'the stretch starts again');
  assert.equal(core.run(), true, 'a second run, after it came out, counts');
  core.again();
  assert.equal(core.arrived(), true);
  assert.deepEqual(calls, [false, false, true]);
  assert.equal(core.impulses, 2);
  while (!run.finished) run.choose(true);
  assert.deepEqual(run.summary(), { trials: 5, correct: 4, impulses: 2 }, 'one encounter marked, two impulses');
});

test('pace: temptations along the stretch, seeded, never in its first or last 1.5 m, in order', () => {
  for (let seed = 1; seed <= 40; seed++) {
    for (const band of [1, 3, 5, 6]) {
      const k = knobsFor('dagnacht', band);
      const len = paceStretch(k.holdS, 40);
      const at = paceTempts(len, k, newPlay('t', seed, 1).fork('pace').rng);
      assert.equal(at.length, k.tempts);
      assert.ok(at.every((m) => m >= PACE_TEMPT_FROM_M && m <= len - PACE_TEMPT_END_M + 1e-9), `band ${band} seed ${seed}: ${at}`);
      for (let i = 1; i < at.length; i++) assert.ok(at[i] > at[i - 1]);
    }
  }
  const short = paceTempts(2, { tempts: 2 }, newPlay('t', 3, 1).fork('pace').rng);
  assert.ok(short.every((m) => m >= 0 && m <= 2), `a 2 m stretch keeps them on it (${short})`);
  const a = paceTempts(9, { tempts: 3 }, newPlay('t', 9, 1).fork('pace').rng);
  const b = paceTempts(9, { tempts: 3 }, newPlay('t', 9, 1).fork('pace').rng);
  assert.deepEqual(a, b, 'a replayed play: the same marks');
});

test('walk on: walking on while the line is read, or within the window, is choose(true), once', () => {
  const calls: boolean[] = [];
  const core = new WalkOnCore(9, (g) => calls.push(g));
  assert.equal(core.tick(0.5, 0.4), null, 'a step is not yet walking on');
  assert.equal(core.tick(1.0, WALK_ON_M), 'went', 'walking on during the read counts');
  assert.equal(core.tick(50, 0), 'went', 'went stays went');
  assert.deepEqual(calls, [true]);
  const late = new WalkOnCore(5, () => {});
  late.begin(2);
  assert.equal(late.tick(6.9, 1.4), null);
  assert.equal(late.left(4), 3);
  assert.equal(late.tick(6.95, 1.5), 'went', 'just in the window');
});

test('walk on: waiting past the window is the habit kept too long — marked, the group shuffles, the window again', () => {
  const run = new DagnachtRun(5);
  const calls: boolean[] = [];
  const core = new WalkOnCore(6, (g) => { calls.push(g); run.choose(g); });
  assert.equal(core.tick(100, 0), null, 'no window while the line is read');
  core.begin(10);
  assert.equal(core.tick(15.9, 0.6), null);
  assert.equal(core.tick(16, 0.6), 'late');
  assert.equal(core.phase, 'react');
  assert.equal(core.tick(17, 3), null, 'nothing is judged while the group reacts');
  core.again();
  assert.equal(core.tick(18, 1.0), null, 'back to the line: 1 m on is not yet on');
  core.begin(20);
  assert.equal(core.tick(25.9, 1.0), null);
  assert.equal(core.tick(26, 1.0), 'late', 'a second wait: a second impulse');
  core.again();
  core.begin(30);
  assert.equal(core.tick(31, WALK_ON_M), 'went', 'his steps before the waits still count');
  assert.deepEqual(calls, [false, false, true]);
  assert.equal(core.impulses, 2);
  while (!run.finished) run.choose(true);
  assert.deepEqual(run.summary(), { trials: 5, correct: 4, impulses: 2 });
});

test('the go window shrinks as he grows: goWaitS from the knobs, never under 5 s', () => {
  let last = Infinity;
  for (const band of [1, 2, 3, 4, 5, 6]) {
    const w = knobsFor('dagnacht', band).goWaitS;
    assert.ok(w <= last && w >= 5, `band ${band}: ${w} s`);
    last = w;
  }
});

/**
 * The frisling's five calm moments, every one played with the body (aaien: hands still,
 * dragen: pace, voeren: hands still, zeug: feet still, pad: walk on), with a child's
 * mistake at each — map onto the DagnachtRun EXACTLY as five cards answered with one wrong
 * each would: 5 trials, 0 never-wronged, 5 impulses. And with mistakes at two of them,
 * exactly as cards: 5 trials, 3 right.
 */
test('body answers map onto DagnachtRun exactly like cards (5 trials, correct = never-wronged)', () => {
  const play = (mistakes: ReadonlySet<string>): DagnachtRun => {
    const run = new DagnachtRun(5);
    const choose = (g: boolean): void => { run.choose(g); };
    for (const id of ['aaien', 'dragen', 'voeren', 'zeug', 'pad']) {
      const wrong = mistakes.has(id);
      if (id === 'dragen') {
        const p = new PaceCore(choose);
        if (wrong) { p.run(); p.again(); }
        p.arrived();
      } else if (id === 'pad') {
        const w = new WalkOnCore(9, choose);
        w.begin(0);
        if (wrong) { w.tick(9, 0); w.again(); w.begin(12); }
        w.tick(13, WALK_ON_M);
      } else {
        const h = new HoldCore(HOLD_S, choose);
        if (wrong) { h.impulse(); h.again(); }
        h.begin(0);
        h.tick(HOLD_S);
      }
    }
    return run;
  };
  const cards = (wrongs: number[]): DagnachtRun => {
    const run = new DagnachtRun(5);
    for (let i = 0; i < 5; i++) { if (wrongs.includes(i)) run.choose(false); run.choose(true); }
    return run;
  };
  const all = play(new Set(['aaien', 'dragen', 'voeren', 'zeug', 'pad']));
  assert.ok(all.finished);
  assert.deepEqual(all.summary(), cards([0, 1, 2, 3, 4]).summary());
  assert.deepEqual(all.summary(), { trials: 5, correct: 0, impulses: 5 });
  assert.deepEqual(play(new Set(['dragen', 'pad'])).summary(), cards([1, 4]).summary());
  assert.deepEqual(play(new Set(['dragen', 'pad'])).summary(), { trials: 5, correct: 3, impulses: 2 });
  assert.deepEqual(play(new Set()).summary(), { trials: 5, correct: 5, impulses: 0 });
});
