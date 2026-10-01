/**
 * wisselen3d.parity.test.ts — the seeded construct-parity test for the diegetic 3D
 * "wisselen" variant (BUILD-PLAN §1f/§4 acceptance, §9e). Run:
 *   node --experimental-strip-types --test src/render3d/engines/wisselen3d.parity.test.ts
 *
 * Parity is guaranteed BY CONSTRUCTION: both `render2d/WisselView` (2D) and
 * `render3d/engines/wisselen3d` (3D) drive the same pure `WisselRun` core + the
 * same `buildWisselTrial`. This test pins that core's frozen contract — the exact
 * cognitive-flexibility rule the 2D twin has always used — so the two views can
 * never silently diverge in WHAT they score:
 *   trials  = 1 (always one sort task per beat),
 *   correct = 1 ONLY when the whole queue was sorted with no wrong tap.
 * Each animal's natural bin is open (day) / hol (night); the signpost flips the
 * rule every `flipEvery` correct sorts so it stays a real set-shift, not "always
 * the natural bin". A wrong sort is RECOVERABLE: counted once, the SAME animal
 * stays up (never game-over). Deterministic — same queue + same bin taps → same
 * summary.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWisselTrial, WisselRun } from '../../engines/wisselen.ts';
import type { WisselBin, WisselItem, WisselTrial } from '../../engines/wisselen.ts';
import type { Settings } from '../../core/state.ts';
import type { Skin } from '../../content/types.ts';

/** A seeded deterministic rng (mulberry32) so `buildWisselTrial` is reproducible. */
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
 *  (natural bin = open(day)/hol(night); flip the rule every `flipEvery` correct
 *  sorts; correct = sorted with zero wrong taps), used to cross-check the shared
 *  core. `bins` is the sequence of destination taps the player makes. */
function reference(queue: WisselItem[], flipEvery: number, bins: WisselBin[]): { trials: number; correct: number } {
  const every = Math.max(2, flipEvery);
  let idx = 0, sinceFlip = 0, wrong = 0;
  let invert = false, done = false;
  for (const bin of bins) {
    if (done) break;
    const cur = queue[idx];
    const natural: WisselBin = cur.dag ? 'open' : 'hol';
    const want: WisselBin = invert ? (natural === 'open' ? 'hol' : 'open') : natural;
    if (bin !== want) { wrong += 1; continue; }
    idx += 1;
    if (idx >= queue.length) { done = true; break; }
    sinceFlip += 1;
    if (sinceFlip >= every) { invert = !invert; sinceFlip = 0; }
  }
  return { trials: 1, correct: wrong === 0 ? 1 : 0 };
}

/** Drive the SHARED core the way both views do: build a run, feed bin taps until done. */
function drive(trial: WisselTrial, bins: WisselBin[]): { trials?: number; correct?: number } {
  const run = new WisselRun(trial);
  for (const bin of bins) { if (run.finished) break; run.choose(bin); }
  return run.summary();
}

/** A fixed queue + cadence so the script of bins is reproducible (flipEvery 2). */
const QUEUE: WisselItem[] = [
  { id: 'edelhert', dag: true },   // natural open
  { id: 'ree', dag: true },        // natural open
  { id: 'das', dag: false },       // natural hol
  { id: 'nachtzwaluw', dag: false },// natural hol
  { id: 'wildzwijn', dag: false }, // natural hol
];
const TRIAL: WisselTrial = { queue: QUEUE, flipEvery: 2 };

/** The PERFECT bin sequence honouring the flip cadence (flip after every 2 correct):
 *  sorts 0,1 natural → flip → sorts 2,3 inverted → flip → sort 4 natural. */
function perfectBins(queue: WisselItem[], flipEvery: number): WisselBin[] {
  const run = new WisselRun({ queue, flipEvery });
  const bins: WisselBin[] = [];
  while (!run.finished) { const b = run.correctBin(); bins.push(b); run.choose(b); }
  return bins;
}

test('perfect sort → correct 1, trials 1, and matches the reference', () => {
  const bins = perfectBins(QUEUE, 2);
  const s = drive(TRIAL, bins);
  assert.equal(s.trials, 1);
  assert.equal(s.correct, 1);
  assert.deepEqual(s, reference(QUEUE, 2, bins));
});

test('one wrong sort → correct 0 (recoverable), matches the reference', () => {
  // wrong on the very first animal (open-animal dropped in hol), then perfect
  const perfect = perfectBins(QUEUE, 2);
  const bins: WisselBin[] = ['hol', ...perfect]; // first is wrong, the same animal stays up
  const s = drive(TRIAL, bins);
  assert.equal(s.correct, 0);
  assert.equal(s.trials, 1);
  assert.deepEqual(s, reference(QUEUE, 2, bins));
});

test('a wrong sort keeps the SAME animal up (no advance, recoverable)', () => {
  const run = new WisselRun(TRIAL);
  assert.equal(run.current?.id, 'edelhert');
  assert.equal(run.correctBin(), 'open');     // day animal, rule not inverted
  assert.equal(run.choose('hol'), 'retry');   // wrong bin
  assert.equal(run.index, 0, 'did not advance');
  assert.equal(run.current?.id, 'edelhert', 'same animal still up');
  assert.equal(run.wrongCount, 1);
  assert.equal(run.choose('open'), 'advance'); // recover
  assert.equal(run.index, 1);
});

test('the rule flips every flipEvery correct sorts (set-shift, not always-natural)', () => {
  const run = new WisselRun(TRIAL); // flipEvery 2
  assert.equal(run.inverted, false);
  assert.equal(run.choose('open'), 'advance'); // sort 0 (edelhert, day→open)
  assert.equal(run.choose('open'), 'flip');    // sort 1 (ree, day→open) → cadence hit, flips
  assert.equal(run.inverted, true, 'rule inverted for the next animal');
  // das is a night animal: natural hol, but inverted → correct bin is open
  assert.equal(run.current?.id, 'das');
  assert.equal(run.correctBin(), 'open');
});

test('the last correct sort COMPLETES (and only then)', () => {
  const run = new WisselRun(TRIAL);
  const bins = perfectBins(QUEUE, 2);
  for (let i = 0; i < bins.length - 1; i++) {
    assert.notEqual(run.choose(bins[i]), 'complete');
  }
  assert.equal(run.choose(bins[bins.length - 1]), 'complete');
  assert.equal(run.finished, true);
  assert.deepEqual(run.summary(), { trials: 1, correct: 1 });
});

test('stubborn retries stay recoverable and never score negative', () => {
  // a wrong tap before each correct sort
  const perfect = perfectBins(QUEUE, 2);
  const bins: WisselBin[] = [];
  for (const b of perfect) {
    bins.push(b === 'open' ? 'hol' : 'open'); // wrong first
    bins.push(b);                              // then right
  }
  const s = drive(TRIAL, bins);
  assert.equal(s.trials, 1);
  assert.equal(s.correct, 0);
  assert.ok((s.correct ?? -1) >= 0);
  assert.deepEqual(s, reference(QUEUE, 2, bins));
});

test('deterministic — same queue + same bins yields the same summary', () => {
  const bins = perfectBins(QUEUE, 2);
  assert.deepEqual(drive(TRIAL, bins), drive(TRIAL, bins));
});

test('buildWisselTrial: flipEvery follows wisselFreq (more freq → flips sooner), trimmed to ≥2', () => {
  const skin = { dagDieren: ['edelhert', 'ree'], nachtDieren: ['das', 'wildzwijn'], trials: 8 } as Skin;
  const hi = buildWisselTrial(skin, { wisselFreq: 1 } as Settings, rng(1));   // flips often
  const lo = buildWisselTrial(skin, { wisselFreq: 0 } as Settings, rng(1));   // calmer
  assert.ok(hi.flipEvery >= 2, 'never flips more often than every 2');
  assert.ok(hi.flipEvery < lo.flipEvery, 'higher wisselFreq flips sooner');
  assert.equal(hi.queue.length, 8, 'queue length follows skin.trials');
  // a queue built with a seeded rng is reproducible
  const a = buildWisselTrial(skin, { wisselFreq: 0.4 } as Settings, rng(7));
  const b = buildWisselTrial(skin, { wisselFreq: 0.4 } as Settings, rng(7));
  assert.deepEqual(a.queue, b.queue);
});

test('buildWisselTrial: a lively queue — every night animal in a set, never the same animal twice in a row', () => {
  // the wildcamera's six (3 day, 3 night): each night animal exactly once, both day animals
  const six = { dagDieren: ['edelhert', 'ree'], nachtDieren: ['das', 'nachtzwaluw', 'wildzwijn'], trials: 6 } as Skin;
  // the classic eight (4 day, 4 night) of the other missions: every animal at least once
  const eight = { dagDieren: ['ree', 'eekhoorn'], nachtDieren: ['nachtzwaluw', 'das', 'wildzwijn'], trials: 8 } as Skin;
  for (let seed = 1; seed <= 400; seed++) {
    for (const skin of [six, eight]) {
      const { queue } = buildWisselTrial(skin, { wisselFreq: 0.4 } as Settings, rng(seed));
      const ids = queue.map((q) => q.id);
      assert.equal(queue.length, skin.trials, 'the length follows skin.trials');
      assert.equal(queue.filter((q) => q.dag).length, skin.trials! / 2, 'half day, half night animals');
      for (const q of queue) assert.equal(q.dag, skin.dagDieren!.includes(q.id), `${q.id} is sorted by its own kind`);
      for (let i = 1; i < ids.length; i++) assert.notEqual(ids[i], ids[i - 1], `seed ${seed}: ${ids.join(' ')} repeats at ${i}`);
      for (const id of [...skin.dagDieren!, ...skin.nachtDieren!]) assert.ok(ids.includes(id), `seed ${seed}: ${id} comes by`);
      if (skin === six) for (const id of skin.nachtDieren!) assert.equal(ids.filter((x) => x === id).length, 1, `seed ${seed}: ${id} once`);
    }
  }
});

test('buildWisselTrial: a short round flips early enough that a third of it comes after the flip', () => {
  const six = { dagDieren: ['edelhert', 'ree'], nachtDieren: ['das', 'nachtzwaluw', 'wildzwijn'], trials: 6 } as Skin;
  const eight = { ...six, trials: 8 } as Skin;
  // a first-level child (wisselFreq 0.25) and the default slider (0.4): the six flip after the 4th
  for (const f of [0.1, 0.25, 0.4]) assert.equal(buildWisselTrial(six, { wisselFreq: f } as Settings, rng(3)).flipEvery, 4);
  assert.equal(buildWisselTrial(six, { wisselFreq: 1 } as Settings, rng(3)).flipEvery, 2, 'a quick switcher still flips every 2');
  // the eight keep their cadence (5 at the first level, 4 at the default)
  assert.equal(buildWisselTrial(eight, { wisselFreq: 0.25 } as Settings, rng(3)).flipEvery, 5);
  assert.equal(buildWisselTrial(eight, { wisselFreq: 0.4 } as Settings, rng(3)).flipEvery, 4);
});
