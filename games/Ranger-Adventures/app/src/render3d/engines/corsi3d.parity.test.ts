/**
 * corsi3d.parity.test.ts — the seeded construct-parity test for the diegetic 3D
 * "corsi" variant (BUILD-PLAN §1f/§4 acceptance, §9e). Run:
 *   node --experimental-strip-types --test src/render3d/engines/corsi3d.parity.test.ts
 *
 * Parity is guaranteed BY CONSTRUCTION: both `render2d/RouteView` (2D) and
 * `render3d/engines/corsi3d` (3D) drive the same pure `CorsiRun` core + the same
 * `buildCorsiTrial`. This test pins that core's frozen contract — the exact rule
 * the 2D twin has always used — so the two views can never silently diverge in
 * WHAT they score:
 *   trials  = 1 (always one route per beat),
 *   correct = 1 ONLY when the route was recalled with no wrong tap.
 * A wrong tap is RECOVERABLE: it's counted once and recall restarts from the start
 * (the route is re-shown, never game-over). Deterministic.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCorsiTrial, CorsiRun } from '../../engines/corsi.ts';
import type { Settings } from '../../core/state.ts';

/** A seeded deterministic rng (mulberry32) so `buildCorsiTrial` is reproducible. */
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
 *  (correct = recalled with zero wrong taps), used to cross-check the shared core.
 *  Mirrors real play: feed taps until the route is fully recalled. */
function reference(sequence: number[], taps: number[]): { trials: number; correct: number } {
  let idx = 0, wrong = 0;
  for (const t of taps) {
    if (idx >= sequence.length) break;
    if (t === sequence[idx]) idx += 1;
    else { wrong += 1; idx = 0; }
  }
  return { trials: 1, correct: wrong === 0 ? 1 : 0 };
}

/** Drive the SHARED core the way both views do (tap by spot id until complete). */
function drive(sequence: number[], taps: number[]): { trials?: number; correct?: number } {
  const run = new CorsiRun(sequence);
  for (const t of taps) {
    if (run.finished) break;
    run.tap(t);
  }
  return run.summary();
}

const SEQ = [3, 1, 4, 2]; // a fixed route fixture (4 spots)

test('perfect recall → correct 1, trials 1, and matches the reference', () => {
  const taps = [...SEQ];
  const s = drive(SEQ, taps);
  assert.equal(s.trials, 1);
  assert.equal(s.correct, 1);
  assert.deepEqual(s, reference(SEQ, taps));
});

test('one wrong tap → correct 0 (recoverable), matches the reference', () => {
  // tap wrong first, then recall the whole route correctly
  const taps = [9, ...SEQ];
  const s = drive(SEQ, taps);
  assert.equal(s.correct, 0);
  assert.equal(s.trials, 1);
  assert.deepEqual(s, reference(SEQ, taps));
});

test('a wrong tap restarts recall from the beginning (not from where it failed)', () => {
  const run = new CorsiRun(SEQ);
  assert.equal(run.expected, 3);
  assert.equal(run.tap(3), 'advance');
  assert.equal(run.expected, 1);
  assert.equal(run.tap(7), 'reshow'); // wrong
  assert.equal(run.recallIndex, 0, 'recall index reset to the start');
  assert.equal(run.expected, 3, 'must tap the first spot again');
  assert.equal(run.wrongCount, 1);
});

test('the last correct tap completes the route (and only then)', () => {
  const run = new CorsiRun(SEQ);
  assert.equal(run.tap(3), 'advance');
  assert.equal(run.tap(1), 'advance');
  assert.equal(run.tap(4), 'advance');
  assert.equal(run.finished, false);
  assert.equal(run.tap(2), 'complete');
  assert.equal(run.finished, true);
});

test('stubborn retries stay recoverable and never score negative', () => {
  // wrong on every spot once before getting the route clean
  const taps = [9, 3, 9, 3, 1, 9, 3, 1, 4, 9, 3, 1, 4, 2];
  const s = drive(SEQ, taps);
  assert.equal(s.trials, 1);
  assert.equal(s.correct, 0);
  assert.ok((s.correct ?? -1) >= 0);
  assert.deepEqual(s, reference(SEQ, taps));
});

test('deterministic — same route + same taps yields the same summary', () => {
  const taps = [3, 9, 3, 1, 4, 2];
  assert.deepEqual(drive(SEQ, taps), drive(SEQ, taps));
});

test('buildCorsiTrial route length follows difficulty, clamped 3..6, seeded-stable', () => {
  const mk = (routeLengte: number, seed: number) =>
    buildCorsiTrial({ routeLengte } as Settings, rng(seed));
  assert.equal(mk(3, 1).sequence.length, 3);
  assert.equal(mk(5, 1).sequence.length, 5);
  assert.equal(mk(1, 1).sequence.length, 3, 'floor at 3');
  assert.equal(mk(99, 1).sequence.length, 6, 'cap at 6');
  // every id is a real, distinct spot from the layout
  const t = mk(6, 42);
  assert.equal(new Set(t.sequence).size, t.sequence.length);
  for (const id of t.sequence) assert.ok(t.spots.some((sp) => sp.id === id));
  // seeded determinism
  assert.deepEqual(mk(5, 7).sequence, mk(5, 7).sequence);
});
