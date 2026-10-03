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
  reeVariant, reeSurprises, watchScript, REE_SMALL, WATCH_OUT_S, WATCH_WALK_S, type ReePlay, type ReeSmall, type WatchEvent,
} from './ree.variety.ts';
import { rollRare, nextRareCount } from '../../../core/discover.ts';
import { ONTDEKKINGEN, ontdekkingenVan } from '../../../content/ontdekkingen.ts';
import { compactVariant } from '../../../core/play.ts';
import { knobsFor } from '../../../core/skill.ts';
import { AREA_VELUWE } from '../../../content/veluwe.ts';
import { LAYOUTS, REE_LAYOUTS, birchWalk, poolSides } from './ree.places.ts';

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
/** A watch's timeline (s) with her walks as they take in the world: out of her gap into the
 *  open ~2 s (her walk out of her bed, unseen, is the rustle's), each walk ~2.5 s, the
 *  calf's rising and coming ~3 s. */
function timeline(w: readonly WatchEvent[]): { end: number; lines: { t: number; key: string }[] } {
  let t = 0;
  const lines: { t: number; key: string }[] = [];
  for (const e of w) {
    if (e.line) lines.push({ t, key: e.line });
    t += e.act === 'out' ? WATCH_OUT_S : e.act === 'walk' ? WATCH_WALK_S : e.act === 'calf' ? 3 : e.s;
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
    const walks = w.filter((e) => e.act === 'walk' || e.act === 'out').map((e) => e.to);
    assert.deepEqual(walks, way === 2 ? [1, 2] : [undefined, 2], `${tag}: her way: out (to the point of her way), on to the meeting place`);
    // the meeting place: her call comes once she got there
    const at2 = acts.lastIndexOf('walk');
    assert.ok(w.findIndex((e) => e.cue === 'gras') > at2, `${tag}: her call from the meeting place`);
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
    assert.ok(mean >= 2.8 && mean <= 5.0, `${tag}: a line every ${mean.toFixed(1)} s`);
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

/* ------------------------------------------------- ree-discover: something to notice ---- */

const none = (): boolean => false;

/** The small things' options for a morning, as ree.ts draws them (its layout, its pool's side). */
const optsOf = (p: Pick<ReePlay, 'layout' | 'pool'>) => {
  const l = REE_LAYOUTS[p.layout];
  return { birches: l.birches.length, larkOn: l.larkOn[p.pool], birchOn: l.birches.map((_, i) => birchWalk(l, i)), hideFree: p.pool === 'in' };
};
/** Every morning kind: each layout with each side its pool may lie on. */
const MORNINGS = LAYOUTS.flatMap((l) => poolSides(l).map((pool) => ({ layout: l.id, pool })));

test('ree-discover: each play holds one or two of the four small things, drawn from its seed', () => {
  const seen = new Map<string, number>();
  let two = 0, n = 0;
  for (const m of MORNINGS) {
    const o = optsOf(m);
    for (let seed = 1; seed <= 400; seed++) {
      const a = reeSurprises(play(seed), none, o);
      const b = reeSurprises(play(seed), none, o);
      assert.deepEqual(a, b, `seed ${seed}: the same seed, the same things`);
      assert.ok(a.small.length === 1 || a.small.length === 2, `seed ${seed}: ${a.small.length} small things`);
      assert.equal(new Set(a.small).size, a.small.length);
      for (const s2 of a.small) { assert.ok(REE_SMALL.includes(s2)); seen.set(s2, (seen.get(s2) ?? 0) + 1); }
      if (a.small.length === 2) two += 1;
      n += 1;
      // where each happens: the woodlark on a walk with room for it this morning (none: no
      // woodlark), the rubbed birch among the layout's
      assert.equal(a.leeuwerik !== null, a.small.includes('leeuwerik'));
      if (a.leeuwerik) assert.ok(o.larkOn.includes(a.leeuwerik), `${m.layout}-${m.pool} seed ${seed}: the woodlark on ${a.leeuwerik}`);
      if (!o.larkOn.length) assert.ok(!a.small.includes('leeuwerik'), `${m.layout}-${m.pool}: no woodlark where no walk has room`);
      assert.equal(a.boompje !== null, a.small.includes('veegsporen'));
      if (a.boompje !== null) assert.ok(a.boompje >= 0 && a.boompje < o.birches);
      assert.ok(a.extra === null || a.extra === 'tapuit' || a.extra === 'vlinder');
      // its note is short and never read as the morning's (`ree:`)
      assert.ok(a.code.length <= 6 && !a.code.startsWith('ree'), a.code);
    }
  }
  for (const s2 of REE_SMALL) assert.ok((seen.get(s2) ?? 0) > n / 8, `${s2} comes (${seen.get(s2)} of ${n})`);
  assert.ok(two > n * 0.3 && two < n * 0.7, `two small things in ${two} of ${n} plays`);
});

test('ree-discover: the ones he has not found come first; once he found them all, any of them', () => {
  for (let seed = 1; seed <= 200; seed++) {
    for (const got of [['leeuwerik'], ['leeuwerik', 'buizerd'], ['leeuwerik', 'buizerd', 'koekoek']] as ReeSmall[][]) {
      const s2 = reeSurprises(play(seed), (id) => got.includes(id), { birches: 2 });
      const fresh = REE_SMALL.filter((x) => !got.includes(x));
      assert.ok(fresh.includes(s2.small[0]), `seed ${seed}: one he has not found first (${s2.small})`);
      if (s2.small.length === 2 && fresh.length >= 2) assert.ok(fresh.includes(s2.small[1]), `seed ${seed}: both new while two are left`);
    }
    const all = reeSurprises(play(seed), () => true, { birches: 2 });
    assert.ok(all.small.length >= 1);
  }
  // a fresh save meets every one of the four within its first four plays when it finds what it meets
  for (let base = 1; base <= 200; base++) {
    const found = new Set<ReeSmall>();
    for (let n = 0; n < 4; n++) for (const s2 of reeSurprises(play(base + n), (id) => found.has(id), { birches: 2 }).small) found.add(s2);
    assert.equal(found.size, 4, `seed ${base}: four plays meet all four (${[...found]})`);
  }
});

test('ree-discover: one thing at a time on the walks — the woodlark never on one walk with the buzzard or the rubbed birch, the buzzard never with a birch by the walk to the hide, no buzzard or extra beside the pool, no extra beside two things or a woodlark', () => {
  let meadowLark = 0, hideLark = 0, extras = 0, n = 0, bothHide = 0, buzzBirch = 0;
  for (const m of MORNINGS) {
    const o = optsOf(m);
    for (let seed = 1; seed <= 400; seed++) {
      for (const got of [[], ['koekoek'], ['leeuwerik'], ['koekoek', 'veegsporen']] as ReeSmall[][]) {
        const s2 = reeSurprises(play(seed), (id) => got.includes(id), o);
        const birch = s2.boompje !== null ? o.birchOn[s2.boompje] : null;
        const tag = `${m.layout}-${m.pool} seed ${seed} (${s2.code})`;
        n += 1;
        // the buzzard is always on his way to the hide: a woodlark with it is on the walk to the grass
        if (s2.small.includes('buizerd') && s2.leeuwerik) assert.equal(s2.leeuwerik, 'meadow', `${tag}: the woodlark and the buzzard on one walk`);
        // the rubbed birch beside one walk: the woodlark on the other
        if (birch && s2.leeuwerik) assert.notEqual(s2.leeuwerik, birch, `${tag}: the woodlark and the birch on one walk`);
        // …and never beside the walk to the hide with the buzzard (review r2, seed 22's third
        // play: the buzzard's card, behind the birch's, came only at the reunion)
        if (birch === 'hide') assert.ok(!s2.small.includes('buizerd'), `${tag}: the buzzard and the birch on the walk to the hide`);
        if (birch === 'hide' && s2.small.includes('buizerd')) bothHide += 1;
        // the walk to the hide never holds three things; beside two, or a woodlark, no little extra
        const hide = (s2.small.includes('buizerd') ? 1 : 0) + (s2.leeuwerik === 'hide' ? 1 : 0) + (birch === 'hide' ? 1 : 0);
        assert.ok(hide + (s2.extra ? 1 : 0) <= 2, `${tag}: ${hide} thing(s) and ${s2.extra ?? 'no'} extra on the walk to the hide`);
        if (s2.leeuwerik === 'hide') assert.equal(s2.extra, null, `${tag}: an extra beside the woodlark`);
        // the pool on his way to the hide is that walk's moment: no buzzard, no extra there
        if (m.pool === 'out') assert.ok(!s2.small.includes('buizerd') && !s2.extra, `${tag}: the buzzard or an extra beside the pool`);
        if (s2.small.includes('buizerd') && birch === 'meadow') buzzBirch += 1;
        if (s2.leeuwerik === 'meadow') meadowLark += 1;
        if (s2.leeuwerik === 'hide') hideLark += 1;
        if (s2.extra) extras += 1;
      }
    }
  }
  // (the woodlark still comes on both walks, and the little extra still comes often)
  assert.ok(meadowLark > n / 20 && hideLark > n / 20, `the woodlark on the walk to the grass ${meadowLark}×, to the hide ${hideLark}× (of ${n})`);
  assert.ok(extras > n / 8, `a little extra in ${extras} of ${n} plays`);
  // (the buzzard and a rubbed birch still come in one play, the birch by the walk to the grass)
  assert.equal(bothHide, 0);
  assert.ok(buzzBirch > 0, `the buzzard with a birch by the walk to the grass ${buzzBirch}×`);
});

test('ree-discover: a fresh save meets all four small things as the mornings come: within four plays nearly always, five at most (the woodlark and the buzzard first where they have room)', () => {
  let inFour = 0;
  const N = 400;
  for (let base = 1; base <= N; base++) {
    const found = new Set<ReeSmall>();
    const last: string[] = [];
    let at = 0;
    for (let n = 0; n < 5 && !at; n++) {
      const p = draw(base * 10 + n, last);
      last.push(p.variant);
      for (const s2 of reeSurprises(play(base * 10 + n), (id) => found.has(id), optsOf(p)).small) found.add(s2);
      if (found.size === 4) at = n + 1;
    }
    assert.ok(at > 0, `seed ${base}: five plays meet all four (${[...found]})`);
    if (at <= 4) inFour += 1;
  }
  assert.ok(inFour >= N * 0.95, `all four within four plays in ${inFour} of ${N} fresh saves`);
});

test('ree-discover: the morning stays the same with its small things drawn (each from its own fork)', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const before = draw(seed);
    reeSurprises(play(seed), none, { birches: 2 });
    assert.deepEqual(draw(seed), before);
    // a variant with the mood, the rare and the morning keeps the morning and the small things
    const pl = play(seed);
    pl.note('mood', 'ochtendnevel'); pl.note('rare', 'tweeling'); pl.note('ree', before.variant);
    pl.note('vr', reeSurprises(pl, none, { birches: 2 }).code);
    const va = compactVariant(pl.variant)!;
    assert.ok(va.includes(`ree:${before.variant}`) && va.includes(',vr:'), va);
  }
});

test('ree-discover: a cuckoo calls in one of her listening pauses, never the one at the hide; the rest of the watch is the same', () => {
  let n = 0;
  for (let seed = 1; seed <= 200; seed++) {
    for (const pauses of [1, 2, 3]) {
      const plain = watchScript(play(seed), { pauses, way: 2 });
      const bird = watchScript(play(seed), { pauses, way: 2, koekoek: true });
      assert.equal(bird.length, plain.length);
      const k = bird.filter((e) => e.cue === 'koekoek');
      assert.equal(k.length, 1, `seed ${seed}, ${pauses} pauses: one cuckoo`);
      assert.equal(k[0].act, 'listen');
      assert.equal(k[0].line, 'koekoek');
      bird.forEach((e, i) => {
        if (e.cue === 'koekoek') { assert.ok(plain[i].act === 'listen' && plain[i].cue !== 'hut', 'it takes a rustle\'s pause'); n += 1; return; }
        assert.deepEqual(e, plain[i], `seed ${seed}: the watch is the same round it`);
      });
    }
  }
  assert.ok(n > 0);
  for (const id of ['koekoek', 'tweeling']) assert.ok(id in COPY, `${id} is in the copy`);
});

test('ree-discover: the home\'s veldgids rows — the mother, four small things, the twins (rare); found by doing', () => {
  const rows = ontdekkingenVan(MISSION);
  const ids = rows.map((o) => o.id.split('.')[1]);
  for (const id of ['reekalf', 'moeder', ...REE_SMALL, 'tweeling']) assert.ok(ids.includes(id), id);
  assert.equal(rows.filter((o) => o.soort === 'zeldzaam').length, 1);
  assert.equal(rows.find((o) => o.id.endsWith('.tweeling'))?.soort, 'zeldzaam');
  assert.equal(rows.find((o) => o.id.endsWith('.veegsporen'))?.soort, 'spoor');
  for (const o of rows) assert.ok(o.hint.split(/\s+/).length <= 7, `${o.id}: its hint is ≤ 7 words`);
});

test('ree-discover: the twins come within three won plays of a fresh save (the pity rule), by its seed', () => {
  const twins = ONTDEKKINGEN.find((o) => o.id === `${MISSION}.tweeling`)!;
  let lucky = 0;
  for (let base = 1; base <= 300; base++) {
    // a fresh save: plays base, base+1, base+2, each won, nothing rare found before
    let count = 0, got = -1;
    for (let n = 0; n < 3 && got < 0; n++) {
      const pl = newPlay(MISSION, base + n, n + 1);
      const r = rollRare({ home: MISSION, play: pl, table: ONTDEKKINGEN, found: {}, counts: { [MISSION]: count }, mood: 'ochtendnevel' });
      if (r) { assert.equal(r.id, twins.id, 'the home\'s rare is the twins'); got = n; }
      count = nextRareCount(count, { won: true, gotRare: !!r });
    }
    assert.ok(got >= 0, `seed ${base}: no twins in three plays`);
    if (got === 0) lucky += 1;
    // in every mood the ree plays in
    for (const mood of ['ochtendnevel', 'zonnig', 'bewolkt', 'gouden-uur'] as const) {
      assert.ok(rollRare({ home: MISSION, play: newPlay(MISSION, base, 3), table: ONTDEKKINGEN, found: {}, counts: { [MISSION]: 2 }, mood }), mood);
    }
  }
  assert.ok(lucky > 60 && lucky < 160, `the twins came on the first play by luck ${lucky} of 300 times`);
});

test('ree-discover: her listening pauses never say the same line twice in one watch', () => {
  for (let seed = 1; seed <= 300; seed++) {
    for (const koekoek of [false, true]) {
      const lines = watchScript(play(seed), { pauses: 3, way: 2, koekoek }).filter((e) => e.act === 'listen').map((e) => e.line);
      assert.equal(new Set(lines).size, lines.length, `seed ${seed}: ${lines.join(', ')}`);
    }
  }
});
