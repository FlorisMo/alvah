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
  CALF_MOMENTS, CALF_SPOTS, REE_LAYOUT_IDS, PRINT_GAP_M, WATCH_LINES, drawReePlay, lastReeVariants, parseReeVariant, printRuns, reeGrowth, reeOrder,
  reeVariant, watchScript, type ReePlay, type WatchEvent,
} from './ree.variety.ts';
import { knobsFor } from '../../../core/skill.ts';
import { AREA_VELUWE } from '../../../content/veluwe.ts';
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

/* ------------------------------------------------------- run 7: growth ---- */

test('growth: the level\'s knobs, mapped onto the ree (fresh level 1, practised ~4.5, the top)', () => {
  const at = (lv: number) => reeGrowth(knobsFor('zoeken', lv), knobsFor('dagnacht', lv));
  assert.deepEqual(at(1), { gaps: 0, prints: 0.97, wobble: 1, pauses: 1, stillS: 2.2 }, 'a fresh save: unbroken dark prints, one wobbly step, one pause');
  assert.deepEqual(at(4.5), { gaps: 2, prints: 0.76, wobble: 2, pauses: 2, stillS: 2.85 });
  assert.deepEqual(at(6), { gaps: 3, prints: 0.64, wobble: 3, pauses: 3, stillS: 3.5 });
  // never easier with a higher level
  for (let lv = 1; lv < 6; lv += 0.5) {
    const a = at(lv), b = at(lv + 0.5);
    assert.ok(b.gaps >= a.gaps && b.prints <= a.prints && b.wobble >= a.wobble && b.pauses >= a.pauses && b.stillS >= a.stillS, `level ${lv} → ${lv + 0.5}`);
  }
});

test('growth: her prints break into runs — no gap near the ring, a bend or the grass; the gaps are the level\'s', () => {
  for (const legs of [[10.2, 9.8], [7.1, 16.3], [3.2, 14.0], [12, 4]]) {
    assert.deepEqual(printRuns(legs, 0), legs.map((_, leg) => ({ leg, a: 0, b: 1 })), 'level 1: one unbroken run a leg');
    for (const gaps of [1, 2, 3]) {
      const runs = printRuns(legs, gaps);
      const holes: { leg: number; from: number; to: number }[] = [];
      legs.forEach((len, leg) => {
        const rs = runs.filter((r) => r.leg === leg).sort((p, q) => p.a - q.a);
        assert.ok(rs.length >= 1, 'every leg keeps prints');
        assert.equal(rs[0].a, 0, 'a leg starts with prints (the ring, the bend)');
        assert.equal(rs[rs.length - 1].b, 1, 'and ends with them (the bend, the grass)');
        for (let i = 1; i < rs.length; i++) holes.push({ leg, from: rs[i - 1].b * len, to: rs[i].a * len });
      });
      assert.ok(holes.length <= gaps && holes.length >= Math.min(gaps, 1), `${legs}: ${holes.length} gaps for ${gaps}`);
      for (const h of holes) {
        assert.ok(Math.abs(h.to - h.from - PRINT_GAP_M) < 1e-6, 'a gap is ~1.2 m');
        assert.ok(h.from >= (h.leg === 0 ? 2.5 : 1.5) - 1e-9 && h.to <= legs[h.leg] - 1.5 + 1e-9, `${legs} leg ${h.leg}: a gap at ${h.from.toFixed(1)}-${h.to.toFixed(1)} m`);
      }
    }
  }
});

/* ------------------------------------------------------- run 7: the watch ---- */

const REE = AREA_VELUWE.missies.find((m) => m.id === MISSION)!;
const COPY = { ...REE.avontuur!.simpel };
/** A watch's timeline (s) with her walks as they take in the world: out of her bed ~2.5 s,
 *  each walk ~2.5 s, the calf's rising and coming ~3 s. */
function timeline(w: readonly WatchEvent[]): { end: number; lines: { t: number; key: string }[] } {
  let t = 0;
  const lines: { t: number; key: string }[] = [];
  for (const e of w) {
    if (e.line) lines.push({ t, key: e.line });
    t += e.act === 'out' || e.act === 'walk' ? 2.5 : e.act === 'calf' ? 3 : e.s;
  }
  return { end: t, lines };
}

test('the watch: always her way out, the call and the calf; the level\'s pauses; 1-2 bites; a look at the hide', () => {
  for (let seed = 1; seed <= 300; seed++) for (const pauses of [1, 2, 3]) for (const way of [1, 2] as const) {
    const w = watchScript(play(seed), { pauses, way });
    const acts = w.map((e) => e.act);
    const tag = `seed ${seed} pauses ${pauses} way ${way}: ${acts.join(' ')}`;
    assert.deepEqual(acts.slice(0, 3), ['rustle', 'out', 'listen'], `${tag}: the bracken stirs, she steps out and tests the air`);
    assert.deepEqual(acts.slice(-3), ['call', 'calf', 'sniff'], `${tag}: her call, the calf, her nose`);
    assert.equal(acts.filter((a) => a === 'listen').length, pauses, `${tag}: the level's pauses`);
    const bites = acts.filter((a) => a === 'bite').length;
    assert.ok(bites >= 1 && bites <= 2, `${tag}: 1-2 bites`);
    assert.equal(w.filter((e) => e.cue === 'hut').length, 1, `${tag}: one look at the hide`);
    assert.equal(w.filter((e) => e.cue === 'gras').length, 1, `${tag}: she calls toward the grass`);
    const walks = w.filter((e) => e.act === 'walk').map((e) => e.to);
    assert.deepEqual(walks, way === 2 ? [1, 2] : [2], `${tag}: her way`);
    // the meeting place: the call comes after she got there and looked at the grass
    const at2 = acts.indexOf('walk', acts.lastIndexOf('walk'));
    assert.ok(w.findIndex((e) => e.cue === 'gras') > at2 && w.findIndex((e) => e.cue === 'hut') > at2, `${tag}: the hide and her call from the meeting place`);
    // every line is the content's, ≤ 7 words a sentence (readlevel lints them too)
    for (const e of w) if (e.line) assert.ok(COPY[e.line], `${tag}: line "${e.line}" is in the copy`);
    for (const e of w) if (e.act === 'listen' || e.cue === 'hut') assert.ok(e.line, `${tag}: a pause and a look at the hide always say so (stil!)`);
    // ~25-30 s with her walks at the nominal 2.5 s (22-35; in the world her walks take a
    // little longer: ~30 s); a new line every ~3.5-4 s, never one held ~8.5 s or more
    const tl = timeline(w);
    assert.ok(tl.end >= 22 && tl.end <= 35, `${tag}: ${tl.end.toFixed(1)} s`);
    const gaps = tl.lines.slice(1).map((l, i) => l.t - tl.lines[i].t);
    gaps.push(tl.end - tl.lines[tl.lines.length - 1].t);
    assert.ok(Math.max(...gaps) <= 8.6, `${tag}: a line held ${Math.max(...gaps).toFixed(1)} s`);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    assert.ok(mean >= 3.0 && mean <= 5.0, `${tag}: a line every ${mean.toFixed(1)} s`);
    assert.deepEqual(watchScript(play(seed), { pauses, way }), w, `${tag}: a replay is the same watch`);
  }
});

test('the watch: the seed draws the order, the lines and the timing; the level only the pauses', () => {
  const orders = new Set<string>(), lineSets = new Set<string>(), lengths = new Set<number>();
  for (let seed = 1; seed <= 60; seed++) {
    const w = watchScript(play(seed), { pauses: 2, way: 2 });
    orders.add(w.map((e) => `${e.act}${e.cue ?? ''}`).join(' '));
    lineSets.add(w.map((e) => e.line ?? '').join(' '));
    lengths.add(Math.round(timeline(w).end));
  }
  assert.ok(orders.size >= 4, `${orders.size} orders of her acts`);
  assert.ok(lineSets.size >= 10, `${lineSets.size} sets of lines`);
  assert.ok(lengths.size >= 3, 'the timing varies');
  // the pools: every key is a line of the content
  for (const pool of Object.values(WATCH_LINES)) for (const key of pool) assert.ok(COPY[key], `${key} is in the copy`);
});
