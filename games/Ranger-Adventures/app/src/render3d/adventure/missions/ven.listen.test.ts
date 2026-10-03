/**
 * ven.listen.test.ts — the frogs' chorus he follows by ear (ven.listen.ts): it calls by
 * itself, a run hushes it until he has stood still a moment, a held chorus never calls,
 * and how clear it is follows the level's trail knobs (clear on a fresh save, fainter with
 * practice), never anything else. Run: `npm test`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { knobsFor } from '../../../core/skill.ts';
import { ListenCore, StillFor, STILL_S, chorusCalls, chorusEvery, listensOf, ringSize } from './ven.listen.ts';

const steady = (seed: number): (() => number) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };
const DT = 1 / 30;

/** Run the core for `s` seconds of `me`, collecting what it did. */
function run(core: ListenCore, s: number, me: { running: boolean; speed: number }): string[] {
  const out: string[] = [];
  for (let t = 0; t < s; t += DT) { const e = core.tick(DT, me); if (e) out.push(e); }
  return out;
}

test('walking calmly, the chorus calls now and then, the first soon', () => {
  const core = new ListenCore(0.95, steady(3));
  const first = run(core, 2, { running: false, speed: 1.6 });
  assert.deepEqual(first, ['call'], 'the first burst within two seconds');
  const more = run(core, 30, { running: false, speed: 1.6 });
  const n = more.filter((e) => e === 'call').length;
  assert.ok(n >= 5 && n <= 10, `a burst every few seconds (${n} in 30 s)`);
  assert.ok(more.every((e) => e === 'call'), 'nothing but calls while he walks calmly');
});

test('a run hushes it once; it comes back only once he has stood still', () => {
  const core = new ListenCore(0.95, steady(5));
  run(core, 2, { running: false, speed: 1.6 });
  assert.deepEqual(run(core, 3, { running: true, speed: 4 }), ['hush'], 'one hush a run, however long');
  assert.equal(core.hushed, true);
  assert.deepEqual(run(core, 10, { running: false, speed: 1.6 }), [], 'walking on: still quiet');
  const back = run(core, STILL_S + 0.2, { running: false, speed: 0 });
  assert.deepEqual(back, ['back'], 'standing still brings it back');
  assert.equal(core.hushes, 1);
  assert.deepEqual(run(core, 1, { running: true, speed: 4 }), ['hush'], 'a second run hushes it again');
  assert.equal(core.hushes, 2);
});

test('held (a listening stop, a moment on the way) it neither calls nor hushes', () => {
  const core = new ListenCore(0.95, steady(7));
  core.pause();
  assert.deepEqual(run(core, 20, { running: true, speed: 4 }), []);
  core.resume(0.5);
  assert.deepEqual(run(core, 0.7, { running: false, speed: 1 }), ['call'], 'resumed, it calls soon');
});

test('how clear the chorus is follows the level\'s trail: clear and often fresh, faint and seldom practised', () => {
  const k1 = knobsFor('zoeken', 1), k6 = knobsFor('zoeken', 6);
  assert.ok(chorusEvery(k1.trailClarity) < chorusEvery(k6.trailClarity), 'it calls more often on a fresh save');
  assert.equal(chorusCalls(k1.trailClarity), 3, 'three calls a burst when clear');
  assert.equal(chorusCalls(k6.trailClarity), 1, 'one call when faint');
  assert.ok(ringSize(k1.trailClarity) > ringSize(k6.trailClarity), 'bigger rings when clear');
  for (let b = 1; b < 6; b++) {
    const a = knobsFor('zoeken', b), c = knobsFor('zoeken', b + 1);
    assert.ok(chorusEvery(a.trailClarity) <= chorusEvery(c.trailClarity), 'never more often with practice');
    assert.ok(listensOf(a.trailLegs) <= listensOf(c.trailLegs), 'never fewer listening stops with practice');
  }
  assert.equal(listensOf(k1.trailLegs), 1, 'a fresh ranger stops once on the way (and once at the cove: twice)');
  assert.ok(listensOf(k6.trailLegs) >= 3);
});

test('standing still: a moment of it, reset by a step', () => {
  const s = new StillFor(1.2);
  let done = false;
  for (let t = 0; t < 1.0; t += DT) done = s.tick(DT, 0);
  assert.equal(done, false);
  s.tick(DT, 1.5);
  for (let t = 0; t < 1.0; t += DT) done = s.tick(DT, 0);
  assert.equal(done, false, 'a step starts it over');
  for (let t = 0; t < 0.4; t += DT) done = s.tick(DT, 0.1);
  assert.equal(done, true, 'a shuffle slower than a step is still');
});
