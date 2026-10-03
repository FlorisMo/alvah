/**
 * frisling.vary.test.ts — what changes every play of the frisling is drawn from the play's
 * seed alone (design frisling §5.1): the same seed gives the same play; every way, nook,
 * pose, family layout and look-alike spot can come; the same way never comes twice in a
 * row; and the seed table a reviewer replays (`?dev=1&seed=N` on a fresh save) gives the
 * three ways. Run: `npm test`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { compactVariant, newPlay } from '../../../core/play.ts';
import { drawFrisling, frislingVariant, recentFams, recentPlays, recentWays, wantsEdge, type DecoyKind, type PastPlay } from './frisling.vary.ts';
import { FAMILY_LAYOUTS, WAYS, WAY_IDS, type WayId } from './frisling.places.ts';
import { AREA_VELUWE } from '../../../content/veluwe.ts';
import { buildDagnachtTrial, playDagnachtTrial, recentRust, rustCode } from '../../../engines/dagnacht.ts';
import type { Skin } from '../../../content/types.ts';
import { ONTDEKKINGEN } from '../../../content/ontdekkingen.ts';
import { MOOD_IDS } from '../../Moods.ts';

const MISSION = AREA_VELUWE.missies.find((m) => m.id === 'frisling')!;
/** The trial's look-alikes as the world lays them (every one the content has: the most). */
const DECOYS: DecoyKind[] = (MISSION.stappen[0].skin.distractors ?? []).map((d) => ({ k: d.k, animal: d.animal }));

/** The seed table: on a fresh save (`?dev=1&seed=N`, the frisling's first play) these
 *  seeds draw these ways. Listed in every builder's report. */
export const SEED_TABLE: Readonly<Record<WayId, number>> = { wei: 1, steen: 2, berk: 4 };

const variant = (seed: number, last: WayId | null = null, n = 1) => frislingVariant(newPlay('frisling', seed, n), last ? [{ way: last }] : [], DECOYS);
/** Earlier plays, newest first, as `recentPlays` gives them. */
const past = (...plays: { way: string; family?: number; nook?: number }[]): PastPlay[] =>
  plays.map((p) => ({ way: p.way, ...(p.family !== undefined ? { fam: FAMILY_LAYOUTS[p.family].id } : {}), ...(p.nook !== undefined ? { nook: p.nook } : {}) }));

test('the same seed gives the same play; its choices are noted on the play', () => {
  for (let seed = 0; seed < 40; seed++) {
    assert.deepEqual(variant(seed), variant(seed));
    const play = newPlay('frisling', seed, 1);
    const v = frislingVariant(play, [], DECOYS);
    assert.equal(play.variant.way, `${v.way}/${FAMILY_LAYOUTS[v.family].id}`, 'the way and the family, one note');
    assert.equal(play.variant.nook, `${v.nook}/${v.pose}`);
    assert.deepEqual(Object.keys(play.variant), ['way', 'nook'], 'the nook noted last');
  }
});

test('every way, nook, pose, family layout and look-alike spot can come', () => {
  const seen = { way: new Set<string>(), nook: new Map<WayId, Set<number>>(), pose: new Set<number>(), family: new Set<number>(), spot: new Map<WayId, Set<number>>(), leeuwerik: new Set<string>() };
  for (let seed = 0; seed < 600; seed++) {
    const v = variant(seed, null, 2); // (a second play: the woodlark may come)
    seen.way.add(v.way);
    (seen.nook.get(v.way) ?? seen.nook.set(v.way, new Set()).get(v.way)!).add(v.nook);
    seen.pose.add(v.pose);
    seen.family.add(v.family);
    for (const s of v.decoySpots) (seen.spot.get(v.way) ?? seen.spot.set(v.way, new Set()).get(v.way)!).add(s);
    seen.leeuwerik.add(String(v.leeuwerik));
  }
  assert.equal(seen.way.size, 3);
  for (const id of WAY_IDS) {
    assert.equal(seen.nook.get(id)!.size, WAYS[id].nooks.length, `every ${id} nook comes`);
    assert.equal(seen.spot.get(id)!.size, WAYS[id].decoySpots.length, `every ${id} look-alike spot is used`);
  }
  assert.equal(seen.pose.size, 3);
  assert.equal(seen.family.size, FAMILY_LAYOUTS.length);
  assert.ok(seen.leeuwerik.has('null') && seen.leeuwerik.size >= 3, 'a woodlark sometimes, from either spot');
});

test('his first play here is the adventure itself; from the second on, a woodlark and the sow\'s nest each come in about half the plays', () => {
  for (let seed = 0; seed < 200; seed++) {
    const first = variant(seed, null, 1);
    assert.equal(first.leeuwerik, null, `seed ${seed}: no woodlark on his first play`);
    assert.equal(first.nest, false, `seed ${seed}: no nest on his first play`);
  }
  let lark = 0, nest = 0;
  for (let seed = 0; seed < 400; seed++) {
    const v = variant(seed, null, 2);
    if (v.leeuwerik !== null) lark++;
    if (v.nest) nest++;
  }
  assert.ok(lark > 160 && lark < 240, `a woodlark in about half the later plays (${lark}/400)`);
  assert.ok(nest > 160 && nest < 240, `a nest in about half the later plays (${nest}/400)`);
  // (the rest of the play is the same either way: the extras have their own forks)
  for (let seed = 0; seed < 40; seed++) {
    const a = variant(seed, null, 1), b = variant(seed, null, 2);
    assert.deepEqual({ ...a, leeuwerik: 0, nest: 0 }, { ...b, leeuwerik: 0, nest: 0 });
  }
});

test('the look-alikes each get their own spot; the nightjar lies at the stand\'s edge', () => {
  for (let seed = 0; seed < 200; seed++) {
    const v = variant(seed);
    assert.equal(v.decoySpots.length, DECOYS.length);
    assert.equal(new Set(v.decoySpots).size, DECOYS.length, 'one spot each');
    DECOYS.forEach((d, i) => { if (wantsEdge(d)) assert.ok(WAYS[v.way].decoySpots[v.decoySpots[i]].edge, 'the nightjar at an edge spot'); });
  }
  // fewer look-alikes (a lower level): the same rule, the first spots of the same order
  const few = frislingVariant(newPlay('frisling', 9, 1), [], DECOYS.slice(0, 4));
  assert.equal(few.decoySpots.length, 4);
});

test('never the same way twice in a row', () => {
  for (const last of WAY_IDS) {
    for (let seed = 0; seed < 200; seed++) assert.notEqual(variant(seed, last).way, last);
    const both = new Set(Array.from({ length: 60 }, (_, s) => variant(s, last).way));
    assert.equal(both.size, 2, `after ${last} both other ways come`);
  }
});

test('three plays in a row: three ways and three family layouts (never one of his last two plays\')', () => {
  for (let seed = 0; seed < 200; seed++) {
    const a = frislingVariant(newPlay('frisling', seed, 1), [], DECOYS);
    const b = frislingVariant(newPlay('frisling', seed + 1, 2), past(a), DECOYS);
    const c = frislingVariant(newPlay('frisling', seed + 2, 3), past(b, a), DECOYS);
    assert.equal(new Set([a.family, b.family, c.family]).size, 3, `seeds ${seed}..${seed + 2}: families`);
    assert.equal(new Set([a.way, b.way, c.way]).size, 3, `seeds ${seed}..${seed + 2}: ways`);
  }
  // after only one play, both others can come
  const after = new Set(Array.from({ length: 60 }, (_, s) => frislingVariant(newPlay('frisling', s, 2), past({ way: 'wei', family: 1 }), DECOYS).family));
  assert.deepEqual([...after].sort(), [0, 2]);
});

test('the recent ways: this session\'s plays first, then the history\'s, one per play', () => {
  const h = [
    { m: 'frisling', sd: 5, va: 'mood:zonnig,rust:advzp,way:wei/rand,nook:1/0' },
    { m: 'frisling', sd: 7, va: 'mood:schemer,rare:ekster,rust:avdpz,way:berk/modder,nook:0/2' },
    { m: 'frisling', sd: 7, va: 'mood:schemer,rare:ekster,rust:avdpz,way:berk/modder,nook:0/2' },
  ];
  assert.deepEqual(recentWays(h), ['berk', 'wei']);
  assert.deepEqual(recentWays(h, [{ sd: 8, way: 'steen' }]), ['steen', 'berk', 'wei']);
});

test('the recent family layouts: this session\'s plays first, then the history\'s, one per play', () => {
  assert.deepEqual(recentFams([]), []);
  const h = [
    { m: 'frisling', sd: 5, va: 'rust:advzp,way:wei/rand,nook:1/0' },
    { m: 'frisling', sd: 5, va: 'rust:advzp,way:wei/rand,nook:1/0' },
    { m: 'ree-niet-aanraken', sd: 6, va: 'way:wei/boom' },
    { m: 'frisling', sd: 7, va: 'rare:ekster,rust:avdpz,way:berk/modder,nook:0/2' },
  ];
  assert.deepEqual(recentFams(h), ['modder', 'rand']);
  // a play stopped early (no beat logged) still counts, newest first
  assert.deepEqual(recentFams(h, [{ sd: 7, fam: 'modder' }, { sd: 8, fam: 'boom' }]), ['boom', 'modder', 'rand']);
});

test('his earlier plays are read back from the history: way, family and nook, whatever the history kept', () => {
  assert.deepEqual(recentPlays([]), []);
  assert.deepEqual(recentPlays([{ m: 'ree-niet-aanraken', va: 'way:steen' }]), []);
  assert.deepEqual(recentPlays([
    { m: 'frisling', sd: 1, va: 'rare:ekster,way:steen/boom,nook:2/0' },
    { m: 'frisling', sd: 2, va: 'mood:ochtendnevel,rare:ekster,rust:advzp,way:berk/rand' }, // (the nook cut)
    { m: 'wildcamera', sd: 3, va: 'way:wei' },
    { m: 'frisling', sd: 4 }, { m: 'frisling', sd: 5, va: 'nook:1' },
  ]), [{ sd: 2, way: 'berk', fam: 'rand' }, { sd: 1, way: 'steen', fam: 'boom', nook: 2 }]);
});

test('a way that comes again hides him in another nook than the last time that way came', () => {
  for (const id of WAY_IDS) {
    for (let n = 0; n < WAYS[id].nooks.length; n++) {
      const seen = new Set<number>();
      for (let seed = 0; seed < 120; seed++) {
        // the way two plays ago was this one, with this nook: the last play went another way
        const other = WAY_IDS.find((w) => w !== id)!;
        const v = frislingVariant(newPlay('frisling', seed, 5), past({ way: other, family: 0, nook: 0 }, { way: id, family: 1, nook: n }, { way: other, family: 2 }), DECOYS);
        if (v.way !== id) continue;
        assert.notEqual(v.nook, n, `${id}: nook ${n} twice in a row on this way (seed ${seed})`);
        seen.add(v.nook);
      }
      assert.equal(seen.size, WAYS[id].nooks.length - 1, `${id} after nook ${n}: every other nook comes`);
    }
  }
});

test('the seed table: a fresh save\'s first play draws each way', () => {
  for (const id of WAY_IDS) assert.equal(variant(SEED_TABLE[id]).way, id, `seed ${SEED_TABLE[id]} draws ${id}`);
});

test('the calm moments: one seeded order for the world and the 2D floor, the lying piglet first, the flip never first', () => {
  const skin = MISSION.stappen[2].skin as Skin;
  const diff = { slowmo: false } as never;
  const orders = new Set<string>();
  for (let seed = 0; seed < 200; seed++) {
    // the world (ChoiceRun) and the 2D floor (DangerView) and the classic stage each build
    // the trial from the play's 'dagnacht' fork: the same seed, the same order
    const world = buildDagnachtTrial(skin, diff, newPlay('frisling', seed, 1).fork('dagnacht').rng).encounters.map((e) => e.id);
    const floor = buildDagnachtTrial(skin, diff, newPlay('frisling', seed, 1).fork('dagnacht').rng).encounters.map((e) => e.id);
    assert.deepEqual(world, floor);
    assert.equal(world.length, 5);
    assert.equal(world[0], 'aaien');
    assert.deepEqual([...world.slice(1, 3)].sort(), ['dragen', 'voeren']);
    assert.deepEqual([...world.slice(3)].sort(), ['pad', 'zeug']);
    orders.add(world.join(','));
    // drawing the variant first never moves the order (its own forks)
    const play = newPlay('frisling', seed, 1);
    frislingVariant(play, [], DECOYS);
    assert.deepEqual(buildDagnachtTrial(skin, diff, play.fork('dagnacht').rng).encounters.map((e) => e.id), world);
  }
  assert.equal(orders.size, 4, `all four orders come (${[...orders].join(' | ')})`);
  // no seed: the content order, as the classic missions always played
  assert.deepEqual(buildDagnachtTrial(skin, diff).encounters.map((e) => e.id), ['aaien', 'dragen', 'voeren', 'zeug', 'pad']);
});

test('the calm moments never come in the order of his last two plays: the world and the 2D floor still play the same', () => {
  const skin = MISSION.stappen[2].skin as Skin;
  const diff = { slowmo: false } as never;
  for (let start = 0; start < 60; start++) {
    // a save's history, play after play (every beat carries its play's variant)
    const history: { m: string; sd: number; va?: string }[] = [];
    const orders: string[] = [];
    for (let i = 0; i < 4; i++) {
      const seed = start * 7 + i;
      // the world (ChoiceRun, and the home's prepare before it) and the 2D floor each build it
      const world = newPlay('frisling', seed, i + 1);
      const floor = newPlay('frisling', seed, i + 1);
      const w = playDagnachtTrial(skin, diff, world, history).encounters.map((e) => e.id);
      const f = playDagnachtTrial(skin, diff, floor, history).encounters.map((e) => e.id);
      assert.deepEqual(w, f, 'the same play, the same history: the same order in both paths');
      assert.equal(world.variant.rust, rustCode(w), 'the order is noted on the play');
      // (the play's own beats, logged before its dagnacht step, never count against it)
      history.push({ m: 'frisling', sd: seed, va: `way:wei,rust:${world.variant.rust}` });
      assert.deepEqual(playDagnachtTrial(skin, diff, newPlay('frisling', seed, i + 1), history).encounters.map((e) => e.id), w);
      orders.push(rustCode(w));
    }
    assert.equal(new Set(orders.slice(0, 3)).size, 3, `three plays in a row, three orders (${orders.join(' ')})`);
    assert.equal(new Set(orders.slice(1, 4)).size, 3);
    for (const o of orders) assert.match(o, /^a[dv]{2}[zp]{2}$/);
  }
  // no play (an old caller): the content order, nothing noted
  assert.deepEqual(playDagnachtTrial(skin, diff, null, []).encounters.map((e) => e.id), ['aaien', 'dragen', 'voeren', 'zeug', 'pad']);
});

test('the orders of his last plays are read from the history, one per play, never this play\'s own', () => {
  const h = [
    { m: 'frisling', sd: 1, va: 'way:wei,rust:advzp' },
    { m: 'frisling', sd: 1, va: 'way:wei,rust:advzp' },
    { m: 'ree-niet-aanraken', sd: 2, va: 'rust:abc' },
    { m: 'frisling', sd: 3, va: 'way:berk' },
    { m: 'frisling', sd: 4, va: 'way:steen,rust:avdpz' },
  ];
  assert.deepEqual(recentRust(h, 'frisling', 9), ['avdpz', 'advzp']);
  assert.deepEqual(recentRust(h, 'frisling', 4), ['advzp']);
  assert.deepEqual(recentRust([], 'frisling', 1), []);
});

/** One play as the game plays it, into a save's history: the briefing notes the light (and
 *  a rare visitor), the home notes the calm order, then the way and the family, the nook
 *  last; every beat of the play carries the variant compacted to the history's 60 chars. */
function playInto(history: { m: string; sd: number; va?: string }[], seed: number, n: number, o: { mood?: string; rare?: string } = {}): { way: string; fam: string; nook: number; rust: string; va: string } {
  const play = newPlay('frisling', seed, n);
  play.note('mood', o.mood ?? MOOD_IDS[seed % MOOD_IDS.length]);
  if (o.rare) play.note('rare', o.rare);
  const skin = MISSION.stappen[2].skin as Skin;
  const v = drawFrisling(play, history, [], { skin, diff: { slowmo: false } as never }, DECOYS); // (the home's prepare)
  // the script's own trial later in the play: the same order, its note unmoved
  const trial = playDagnachtTrial(skin, { slowmo: false } as never, play, history);
  const va = compactVariant(play.variant)!;
  for (let b = 0; b < 3; b++) history.push({ m: 'frisling', sd: play.seed, va }); // (zoeken, corsi, dagnacht)
  return { way: v.way, fam: FAMILY_LAYOUTS[v.family].id, nook: v.nook, rust: rustCode(trial.encounters.map((e) => e.id)), va };
}

test('thirty plays in a row: never the same way twice, no fixed cycle, every way meets every family (review r1: a save locked into one three-play cycle)', () => {
  for (const start of [7301, 1, 51, 9000, 424242]) {
    const history: { m: string; sd: number; va?: string }[] = [];
    const plays = Array.from({ length: 30 }, (_, i) => playInto(history, start + i, i + 1, { rare: i % 4 === 2 ? 'ekster' : undefined }));
    const ways = plays.map((p) => p.way);
    const label = `seed ${start}: ${plays.map((p) => `${p.way}/${p.fam}`).join(' ')}`;
    assert.equal(new Set(ways.slice(0, 3)).size, 3, `a fresh save's first three plays are three ways (${label})`);
    assert.equal(new Set(plays.slice(0, 3).map((p) => p.fam)).size, 3, `and three mornings at the mud (${label})`);
    for (let i = 1; i < plays.length; i++) {
      assert.notEqual(ways[i], ways[i - 1], `never the same way twice in a row (${label})`);
      assert.notEqual(plays[i].fam, plays[i - 1].fam, `never the same family layout twice in a row (${label})`);
      assert.ok(!recentRust(history.slice(0, i * 3), 'frisling', start + i).includes(plays[i].rust), `never the calm order of his last two plays (${label})`);
      // a way that comes again: another nook than the last time (when the history kept it)
      const prev = plays.slice(0, i).reverse().find((p) => p.way === ways[i]);
      if (prev && prev.va.includes(',nook:')) assert.notEqual(plays[i].nook, prev.nook, `${ways[i]} again, the same nook (${label})`);
      if (prev) assert.notEqual(plays[i].fam, prev.fam, `${ways[i]} again, the family lies as it did then (${label})`);
    }
    // from the fourth play on, the ways are no fixed three-play cycle (nor is the family)
    assert.ok(ways.slice(3).some((w, i) => w !== ways[i]), `the ways are not period 3 from play 4 (${label})`);
    const fams = plays.map((p) => p.fam);
    assert.ok(fams.slice(3).some((f, i) => f !== fams[i]), `the families are not period 3 from play 4 (${label})`);
    const pairs = new Set(plays.map((p) => `${p.way}/${p.fam}`));
    assert.equal(pairs.size, WAY_IDS.length * FAMILY_LAYOUTS.length, `every way with every family (${[...pairs].join(' ')})`);
    // the way he has not had for longest comes more often than the other open way
    let longest = 0, other = 0;
    for (let i = 3; i < plays.length; i++) {
      const before = ways.slice(0, i).reverse();
      const open = WAY_IDS.filter((w) => w !== before[0]);
      const age = (w: string): number => { const k = before.indexOf(w); return k < 0 ? Infinity : k; };
      const old = age(open[0]) >= age(open[1]) ? open[0] : open[1];
      if (ways[i] === old) longest++; else other++;
    }
    assert.ok(longest > other && other > 0, `the longest-unseen way is likelier, never forced (${longest} : ${other}, ${label})`);
  }
});

test('the history keeps what the next play reads: the light, a rare visitor, the calm order, the way and the family fit in 60 characters', () => {
  // the longest light and this home's longest rare visitor (the design's magpie, or a
  // longer one the table adds): the worst a play's variant can start with
  const longestMood = [...MOOD_IDS].sort((a, b) => b.length - a.length)[0];
  const rares = ONTDEKKINGEN.filter((o) => o.home === 'frisling' && o.soort === 'zeldzaam').map((o) => o.id.slice(o.id.indexOf('.') + 1));
  const rare = [...rares, 'ekster'].sort((a, b) => b.length - a.length)[0];
  for (let seed = 0; seed < 300; seed++) {
    const history: { m: string; sd: number; va?: string }[] = [];
    const p = playInto(history, seed, 1, { mood: longestMood, rare });
    assert.ok(p.va.length <= 60, p.va);
    assert.match(p.va, new RegExp(`^mood:${longestMood},rare:${rare},rust:[a-z]{5},way:[a-z]+/[a-z]+`), p.va);
    assert.deepEqual(recentWays(history), [p.way], p.va);
    assert.deepEqual(recentFams(history), [p.fam], p.va);
    assert.deepEqual(recentRust(history, 'frisling', seed + 1), [p.rust], p.va);
  }
  // the worst case the review named, laid by hand: it fits whole but for the nook
  const play = newPlay('frisling', 7, 1);
  play.note('mood', 'ochtendnevel');
  play.note('rare', rare);
  play.note('rust', 'advzp');
  play.note('way', 'steen/modder');
  play.note('nook', '3/1');
  const va = compactVariant(play.variant)!;
  const h = [{ m: 'frisling', sd: 7, va }];
  assert.deepEqual([recentWays(h), recentFams(h), recentRust(h, 'frisling', 8)], [['steen'], ['modder'], ['advzp']], va);
});
