/**
 * play.test.ts — the run-7 play: one seed, every choice of a play drawn from it.
 * Run: `node --experimental-strip-types --test src/core/play.test.ts`
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { newPlay, hash32, compactVariant, parseSeedParam } from './play.ts';

const draws = (p: { rng(): number }, n = 8): number[] => Array.from({ length: n }, () => p.rng());

test('the same seed gives the same draws; another seed others', () => {
  assert.deepEqual(draws(newPlay('frisling', 4242, 1)), draws(newPlay('frisling', 4242, 1)));
  assert.notDeepEqual(draws(newPlay('frisling', 4242, 1)), draws(newPlay('frisling', 4243, 1)));
  for (const x of draws(newPlay('x', 7, 1), 500)) assert.ok(x >= 0 && x < 1, `rng in [0, 1): ${x}`);
});

test('a fork is its own stream: draws on the parent or another fork never move it', () => {
  const quiet = newPlay('frisling', 99, 1).fork('hide');
  const want = draws(quiet);
  const p = newPlay('frisling', 99, 1);
  draws(p, 13);                 // the parent drew first
  draws(p.fork('order'), 5);    // and another decision
  assert.deepEqual(draws(p.fork('hide')), want, 'the same label: the same stream, from its start');
  assert.notDeepEqual(draws(p.fork('order')), want, 'another label: another stream');
  assert.notDeepEqual(draws(newPlay('frisling', 100, 1).fork('hide')), want, 'another seed: another stream');
  assert.notEqual(hash32(1, 'a'), hash32(1, 'b'));
  assert.notEqual(hash32(1, 'a'), hash32(2, 'a'));
});

test('shuffle is a permutation and leaves the list as it was', () => {
  const list = Object.freeze(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  for (let s = 1; s <= 30; s++) {
    const out = newPlay('m', s, 1).shuffle(list);
    assert.deepEqual([...out].sort(), [...list]);
  }
  // over many seeds every item comes first now and then
  const firsts = new Set(Array.from({ length: 60 }, (_, s) => newPlay('m', s, 1).shuffle(list)[0]));
  assert.equal(firsts.size, list.length);
});

test('pick, chance, int and between stay in range', () => {
  const p = newPlay('m', 12345, 3);
  const seen = new Set<number>();
  for (let i = 0; i < 400; i++) {
    const v = p.int(2, 5);
    assert.ok(Number.isInteger(v) && v >= 2 && v <= 5, `int ${v}`);
    seen.add(v);
    const f = p.between(1.5, 2.5);
    assert.ok(f >= 1.5 && f < 2.5, `between ${f}`);
    assert.ok(['x', 'y'].includes(p.pick(['x', 'y'])));
  }
  assert.deepEqual([...seen].sort(), [2, 3, 4, 5], 'both ends of int are reached');
  assert.equal(p.chance(0), false);
  assert.equal(p.chance(1), true);
  const hits = Array.from({ length: 2000 }, () => p.chance(0.3)).filter(Boolean).length;
  assert.ok(hits > 500 && hits < 700, `chance(0.3) ≈ 30%: ${hits}/2000`);
  assert.throws(() => p.pick([]));
});

test('rng and friends work unbound (a builder takes play.fork(x).rng)', () => {
  const { rng, pick } = newPlay('m', 5, 1);
  assert.equal(typeof rng(), 'number');
  assert.equal(pick([7]), 7);
});

test('note records into the play\'s variant, from the play and its forks', () => {
  const p = newPlay('frisling', 1, 2);
  assert.equal(p.n, 2);
  assert.equal(p.missionId, 'frisling');
  p.note('hide', 'b');
  p.fork('order').note('order', 2);
  assert.deepEqual({ ...p.variant }, { hide: 'b', order: 2 });
  assert.equal(compactVariant(p.variant), 'hide:b,order:2');
});

test('the compact variant keeps whole pairs within 60 characters', () => {
  assert.equal(compactVariant({}), undefined);
  assert.equal(compactVariant({ a: 'x,y', 'b:c': 1 }), 'a:x.y,b.c:1');
  const long: Record<string, string> = {};
  for (let i = 0; i < 20; i++) long[`key${i}`] = 'value';
  const v = compactVariant(long)!;
  assert.ok(v.length <= 60, `${v.length}`);
  assert.ok(v.split(',').every((pair) => /^key\d+:value$/.test(pair)), v);
});

test('the dev seed param: ?seed=N, else none', () => {
  assert.equal(parseSeedParam('?dev=1&seed=4242'), 4242);
  assert.equal(parseSeedParam('?seed=0'), 0);
  assert.equal(parseSeedParam('?seed=-1'), 4294967295);
  assert.equal(parseSeedParam('?dev=1'), null);
  assert.equal(parseSeedParam('?seed='), null);
  assert.equal(parseSeedParam('?seed=abc'), null);
});

test('one play, one trial: every view that draws from the same fork builds the same route, callers and queue', async () => {
  const { buildCorsiTrial, CorsiRun } = await import('../engines/corsi.ts');
  const { randomCaller } = await import('../engines/simon.ts');
  const { buildWisselTrial } = await import('../engines/wisselen.ts');
  const { knobsFor } = await import('./skill.ts');
  const diff = { routeLengte: 5, wisselFreq: 0.4 } as never;
  const skin = { dagDieren: ['edelhert', 'ree'], nachtDieren: ['das', 'nachtzwaluw', 'wildzwijn'], trials: 6 } as never;
  const views = (seed: number) => {
    const play = newPlay('wildcamera', seed, 1); // (the 2D floor, the classic stage and the world's beat each take play.fork(engine))
    const rng = play.fork('simon').rng;
    return {
      route: [...new CorsiRun(buildCorsiTrial(skin, knobsFor('corsi', 5)), play.fork('corsi').rng).begin()],
      callers: Array.from({ length: 6 }, () => randomCaller(['ree', 'das', 'wildzwijn', 'nachtzwaluw'], rng)),
      queue: buildWisselTrial(skin, diff, play.fork('wisselen').rng).queue.map((q) => q.id),
    };
  };
  assert.deepEqual(views(4242), views(4242), 'a replayed play: the same trials');
  const differ = [1, 2, 3, 4, 5].filter((s) => JSON.stringify(views(s)) !== JSON.stringify(views(4242))).length;
  assert.equal(differ, 5, 'another play: other trials');
});
