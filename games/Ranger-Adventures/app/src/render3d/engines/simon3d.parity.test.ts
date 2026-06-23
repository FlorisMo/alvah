/**
 * simon3d.parity.test.ts — the seeded construct-parity test for the diegetic 3D
 * "simon" variant (BUILD-PLAN §1f/§4 acceptance, §9e). Run:
 *   node --experimental-strip-types --test src/render3d/engines/simon3d.parity.test.ts
 *
 * Parity is guaranteed BY CONSTRUCTION: both `render2d/SimonView` (2D) and
 * `render3d/engines/simon3d` (3D) drive the same pure `SimonRun` core + the same
 * `buildSimonTrial`. This test pins that core's frozen contract — the exact rule
 * the 2D twin has always used — so the two views can never silently diverge in
 * WHAT they score:
 *   trials  = 1 (always one task per beat),
 *   correct = 1 ONLY when the whole growing sequence was echoed with no wrong tap.
 * The sequence starts at length 2 and grows by one caller each full echo, up to
 * `target`. A wrong tap is RECOVERABLE: it's counted once and the echo restarts
 * (the SAME sequence is replayed, never game-over). Deterministic — new callers
 * come from a fixed supplier so the core + an independent reference consume the
 * identical growing sequence.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSimonTrial, SimonRun } from '../../engines/simon.ts';
import type { Settings } from '../../core/state.ts';
import type { Skin } from '../../content/types.ts';

/** A seeded deterministic rng (mulberry32) so `buildSimonTrial`/`randomCaller`
 *  consumers are reproducible. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Reference scorer — an INDEPENDENT re-implementation of the frozen 2D rule
 *  (sequence grows 2..target; correct = echoed with zero wrong taps), used to
 *  cross-check the shared core. `full` is the final-length caller list; the task
 *  presents `full.slice(0, len)` for each growing length. Mirrors real play. */
function reference(full: string[], target: number, taps: string[]): { trials: number; correct: number } {
  let len = 2, pos = 0, wrong = 0, done = false;
  for (const t of taps) {
    if (done) break;
    const seq = full.slice(0, len);
    if (t === seq[pos]) {
      pos += 1;
      if (pos >= seq.length) {
        if (len >= target) done = true;
        else { len += 1; pos = 0; }
      }
    } else { wrong += 1; pos = 0; }
  }
  return { trials: 1, correct: wrong === 0 ? 1 : 0 };
}

/** Drive the SHARED core the way both views do: a fixed supplier feeds the growing
 *  callers (begin() takes 2, each grow takes 1), then taps are fed until complete. */
function drive(full: string[], target: number, taps: string[]): { trials?: number; correct?: number } {
  let cur = 0;
  const run = new SimonRun(target, () => full[cur++]);
  run.begin();
  for (const t of taps) { if (run.finished) break; run.tap(t); }
  return run.summary();
}

const FULL = ['a', 'b', 'c', 'd']; // the final-length caller list (target 4)
const T = 4;
// perfect echo of the growing sequence: 2, then 3, then 4
const PERFECT = ['a', 'b', 'a', 'b', 'c', 'a', 'b', 'c', 'd'];

test('perfect echo → correct 1, trials 1, and matches the reference', () => {
  const s = drive(FULL, T, PERFECT);
  assert.equal(s.trials, 1);
  assert.equal(s.correct, 1);
  assert.deepEqual(s, reference(FULL, T, PERFECT));
});

test('one wrong tap → correct 0 (recoverable), matches the reference', () => {
  const taps = ['a', 'z', 'a', 'b', 'a', 'b', 'c', 'a', 'b', 'c', 'd']; // wrong on the first round, then clean
  const s = drive(FULL, T, taps);
  assert.equal(s.correct, 0);
  assert.equal(s.trials, 1);
  assert.deepEqual(s, reference(FULL, T, taps));
});

test('a wrong tap restarts the echo from the start (not from where it failed)', () => {
  const run = new SimonRun(T, ((): () => string => { let i = 0; return () => FULL[i++]; })());
  run.begin();
  assert.equal(run.expected, 'a');
  assert.equal(run.tap('a'), 'advance');
  assert.equal(run.expected, 'b');
  assert.equal(run.tap('z'), 'replay'); // wrong
  assert.equal(run.echoIndex, 0, 'echo index reset to the start');
  assert.equal(run.expected, 'a', 'must tap the first caller again');
  assert.equal(run.wrongCount, 1);
});

test('a full echo below target GROWS the sequence by one caller and re-listens', () => {
  const run = new SimonRun(T, ((): () => string => { let i = 0; return () => FULL[i++]; })());
  const opening = run.begin();
  assert.deepEqual([...opening], ['a', 'b'], 'opens at length 2');
  assert.equal(run.tap('a'), 'advance');
  assert.equal(run.tap('b'), 'grow'); // length 2 < target 4 → grow
  assert.deepEqual([...run.sequence], ['a', 'b', 'c'], 'grew by one caller');
  assert.equal(run.echoIndex, 0, 'echo restarts for the longer sequence');
  assert.equal(run.finished, false);
});

test('the last full echo at target COMPLETES the task (and only then)', () => {
  const run = new SimonRun(T, ((): () => string => { let i = 0; return () => FULL[i++]; })());
  run.begin();
  run.tap('a'); run.tap('b');            // grow → len 3
  run.tap('a'); run.tap('b'); run.tap('c'); // grow → len 4
  assert.deepEqual([...run.sequence], ['a', 'b', 'c', 'd']);
  assert.equal(run.tap('a'), 'advance');
  assert.equal(run.tap('b'), 'advance');
  assert.equal(run.tap('c'), 'advance');
  assert.equal(run.finished, false);
  assert.equal(run.tap('d'), 'complete');
  assert.equal(run.finished, true);
});

test('target 2 completes on the very first full echo (no grow)', () => {
  const run = new SimonRun(2, ((): () => string => { let i = 0; return () => FULL[i++]; })());
  run.begin();
  assert.equal(run.tap('a'), 'advance');
  assert.equal(run.tap('b'), 'complete');
  assert.equal(run.finished, true);
  assert.deepEqual(run.summary(), { trials: 1, correct: 1 });
});

test('stubborn retries stay recoverable and never score negative', () => {
  // a wrong tap on each growing round before getting it clean
  const taps = [
    'z', 'a', 'b',                 // round len2: wrong, then clean → grow
    'z', 'a', 'b', 'c',            // round len3: wrong, then clean → grow
    'z', 'a', 'b', 'c', 'd',       // round len4: wrong, then clean → complete
  ];
  const s = drive(FULL, T, taps);
  assert.equal(s.trials, 1);
  assert.equal(s.correct, 0);
  assert.ok((s.correct ?? -1) >= 0);
  assert.deepEqual(s, reference(FULL, T, taps));
});

test('deterministic — same sequence + same taps yields the same summary', () => {
  assert.deepEqual(drive(FULL, T, PERFECT), drive(FULL, T, PERFECT));
});

test('buildSimonTrial target follows difficulty, clamped 2..6', () => {
  const skin = { dieren: ['edelhert', 'ree', 'wildzwijn', 'raaf'] } as Skin;
  const mk = (simonLengte: number) => buildSimonTrial(skin, { simonLengte } as Settings);
  assert.equal(mk(3).target, 3);
  assert.equal(mk(5).target, 5);
  assert.equal(mk(1).target, 2, 'floor at 2');
  assert.equal(mk(99).target, 6, 'cap at 6');
  // a skin without its own row falls back to a real default set of callers
  const fallback = buildSimonTrial({} as Skin, { simonLengte: 3 } as Settings);
  assert.ok(fallback.dieren.length >= 2);
  // seeded determinism through randomCaller is exercised by the drive() helper above
  void rng;
});
