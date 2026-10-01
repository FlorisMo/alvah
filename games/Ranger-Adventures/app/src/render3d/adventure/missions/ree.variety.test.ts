/**
 * ree.variety.test.ts — every play of "Het reekalf in het gras" is a different morning,
 * drawn from its seed (design `state/ree/design.md` §6.1). Run: `npm test`.
 *
 * Seeds a reviewer can type (`/?dev=1&seed=N`: the session's first play is seed N, and
 * with an empty history it is this play):
 *
 *   seed  9 → A, pool in      (A's way to the hide has no room for it: always in)
 *   seed  3 → B, pool in      seed  1 → B, pool out
 *   seed  4 → C, pool in      seed  2 → C, pool out
 *
 * (pinned below by `SEED_TABLE`; "Speel nog eens" plays seed N+1, N+2 … with the history
 * of the plays before it, so a session's three plays are three layouts.)
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { newPlay } from '../../../core/play.ts';
import {
  CALF_MOMENTS, CALF_SPOTS, REE_LAYOUT_IDS, drawReePlay, lastReeVariants, parseReeVariant, reeOrder, reeVariant, type ReePlay,
} from './ree.variety.ts';
import { REE_LAYOUTS, poolSides } from './ree.places.ts';

const MISSION = 'ree-niet-aanraken';
const play = (seed: number) => newPlay(MISSION, seed, 1);
/** The sides a layout's pool may lie on (ree.ts draws with them: A's way to the hide has
 *  no room for it, so A's pool is always on her path). */
const sides = (id: ReePlay['layout']) => poolSides(REE_LAYOUTS[id]);
/** A play as ree.ts draws it. */
const draw = (seed: number, history: readonly string[] = [], spot?: number): ReePlay => drawReePlay(play(seed), history, spot, sides);

/** A valid play: five encounters, each once, the flip last, the calf's three together,
 *  the pool first or fourth; the variant says it all back. */
function valid(p: ReePlay): void {
  assert.ok(REE_LAYOUT_IDS.includes(p.layout));
  assert.ok(Number.isInteger(p.spot) && p.spot >= 0 && p.spot < CALF_SPOTS);
  assert.ok(p.graze === 0 || p.graze === 1);
  assert.equal(p.order.length, 5);
  assert.equal(new Set(p.order).size, 5);
  assert.deepEqual([...p.order].sort(), ['aai', 'geur', 'modder', 'moeder', 'oppakken']);
  assert.equal(p.order[4], 'moeder', 'the flip comes last');
  assert.equal(p.order.indexOf('modder'), p.pool === 'in' ? 0 : 3, 'the pool on her path is the first, on his way the fourth');
  const at = p.order.indexOf(p.calf[0]);
  assert.deepEqual(p.order.slice(at, at + 3), [...p.calf], 'the three by the calf come together');
  assert.deepEqual([...p.calf].sort(), [...CALF_MOMENTS].sort());
  assert.deepEqual(parseReeVariant(p.variant), { layout: p.layout, spot: p.spot, graze: p.graze, pool: p.pool, calf: p.calf });
}

/** A session of plays as "Speel nog eens" plays them: each sees the plays before it. */
function session(seed: number, n: number): ReePlay[] {
  const out: ReePlay[] = [];
  for (let i = 0; i < n; i++) out.push(draw(seed + i, out.map((p) => p.variant)));
  return out;
}

test('every seed gives a valid play, and the same seed and history give the same play', () => {
  for (let s = 0; s < 500; s++) {
    const p = draw(s);
    valid(p);
    assert.deepEqual(draw(s), p);
    assert.ok(sides(p.layout).includes(p.pool), `seed ${s}: the pool lies where ${p.layout} has room for it`);
    const h = ['A01-in-ago', 'B30-out-goa'];
    assert.deepEqual(draw(s, h), draw(s, h));
  }
});

test('three plays in a row are three layouts, three spots and three orders of the calm moments', () => {
  for (let s = 0; s < 300; s++) {
    const [a, b, c] = session(s * 7 + 1, 3);
    assert.equal(new Set([a.layout, b.layout, c.layout]).size, 3, `seed ${s * 7 + 1}: layouts ${a.layout}${b.layout}${c.layout}`);
    assert.equal(new Set([a.spot, b.spot, c.spot]).size, 3, 'three spots');
    assert.equal(new Set([a.calf.join(), b.calf.join(), c.calf.join()]).size, 3, 'three orders by the calf');
  }
  // a long session never plays a layout one of the last two plays had, nor the pool three
  // times the same in a row
  const long = session(99, 30);
  for (let i = 2; i < long.length; i++) {
    assert.ok(long[i].layout !== long[i - 1].layout && long[i].layout !== long[i - 2].layout);
    assert.ok(!(long[i].pool === long[i - 1].pool && long[i].pool === long[i - 2].pool));
  }
});

test('over 300 seeds every layout, spot, graze spot, pool side and order comes', () => {
  const seen = { layout: new Set<string>(), spot: new Set<number>(), graze: new Set<number>(), pool: new Set<string>(), order: new Set<string>() };
  for (let s = 0; s < 300; s++) {
    const p = draw(s);
    seen.layout.add(p.layout); seen.spot.add(p.spot); seen.graze.add(p.graze); seen.pool.add(p.pool); seen.order.add(p.order.join());
  }
  assert.equal(seen.layout.size, 3);
  assert.equal(seen.spot.size, CALF_SPOTS);
  assert.equal(seen.graze.size, 2);
  assert.equal(seen.pool.size, 2);
  assert.equal(seen.order.size, 12, 'six orders by the calf × the pool first or fourth');
});

test('a spot the trial drew is the spot; the order puts the pool first or fourth', () => {
  for (let s = 0; s < 40; s++) for (let k = 0; k < CALF_SPOTS; k++) assert.equal(draw(s, [], k).spot, k);
  assert.deepEqual(reeOrder('in', ['geur', 'aai', 'oppakken']), ['modder', 'geur', 'aai', 'oppakken', 'moeder']);
  assert.deepEqual(reeOrder('out', ['geur', 'aai', 'oppakken']), ['geur', 'aai', 'oppakken', 'modder', 'moeder']);
  assert.equal(reeVariant({ layout: 'B', spot: 2, graze: 1, pool: 'in', calf: ['geur', 'aai', 'oppakken'] }), 'B21-in-gao');
  assert.equal(parseReeVariant('X21-in-gao'), null);
  assert.equal(parseReeVariant('B21-in-ggo'), null);
});

test('the last variants come from the beat history: one per play, oldest first, only this mission', () => {
  const h = [
    { m: MISSION, sd: 10, va: 'ree:A01-in-ago,mood:gouden-uur' },
    { m: MISSION, sd: 10, va: 'ree:A01-in-ago,mood:gouden-uur' },  // (its second beat)
    { m: 'frisling', sd: 11, va: 'hide:b' },
    { m: MISSION, sd: 12, va: 'rare:tweeling,ree:C30-out-goa,mood:zonnig' },
    { m: MISSION, sd: 13 },                                          // (an old save's beat: no variant)
    { m: MISSION, sd: 14, va: 'ree:B21-in-gao' },
  ];
  assert.deepEqual(lastReeVariants(h, MISSION), ['A01-in-ago', 'C30-out-goa', 'B21-in-gao']);
  // with that history the next play is never C or B
  for (let s = 0; s < 50; s++) assert.equal(draw(s, lastReeVariants(h, MISSION)).layout, 'A');
});

/** The seeds in this file's header: what `/?dev=1&seed=N` plays first (empty history). */
const SEED_TABLE: readonly { seed: number; layout: string; pool: 'in' | 'out' }[] = [
  { seed: 9, layout: 'A', pool: 'in' },
  { seed: 3, layout: 'B', pool: 'in' }, { seed: 1, layout: 'B', pool: 'out' },
  { seed: 4, layout: 'C', pool: 'in' }, { seed: 2, layout: 'C', pool: 'out' },
];

test('the pinned seeds reach every layout × pool side it has room for', () => {
  const cells = new Set<string>();
  for (const r of SEED_TABLE) {
    const p = draw(r.seed);
    assert.equal(p.layout, r.layout, `seed ${r.seed}`);
    assert.equal(p.pool, r.pool, `seed ${r.seed}`);
    cells.add(`${p.layout}-${p.pool}`);
  }
  assert.equal(cells.size, Object.values(REE_LAYOUTS).reduce((n, l) => n + poolSides(l).length, 0));
});
