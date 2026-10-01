/**
 * frisling.vary.test.ts — what changes every play of the frisling is drawn from the play's
 * seed alone (design frisling §5.1): the same seed gives the same play; every way, nook,
 * pose, family layout and look-alike spot can come; the same way never comes twice in a
 * row; and the seed table a reviewer replays (`?dev=1&seed=N` on a fresh save) gives the
 * three ways. Run: `npm test`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { newPlay } from '../../../core/play.ts';
import { frislingVariant, lastWayOf, recentFams, recentWays, wantsEdge, type DecoyKind } from './frisling.vary.ts';
import { FAMILY_LAYOUTS, WAYS, WAY_IDS, type WayId } from './frisling.places.ts';
import { AREA_VELUWE } from '../../../content/veluwe.ts';
import { buildDagnachtTrial, playDagnachtTrial, recentRust, rustCode } from '../../../engines/dagnacht.ts';
import type { Skin } from '../../../content/types.ts';

const MISSION = AREA_VELUWE.missies.find((m) => m.id === 'frisling')!;
/** The trial's look-alikes as the world lays them (every one the content has: the most). */
const DECOYS: DecoyKind[] = (MISSION.stappen[0].skin.distractors ?? []).map((d) => ({ k: d.k, animal: d.animal }));

/** The seed table: on a fresh save (`?dev=1&seed=N`, the frisling's first play) these
 *  seeds draw these ways. Listed in every builder's report. */
export const SEED_TABLE: Readonly<Record<WayId, number>> = { wei: 1, steen: 2, berk: 4 };

const variant = (seed: number, last: WayId | null = null, n = 1) => frislingVariant(newPlay('frisling', seed, n), last, DECOYS);

test('the same seed gives the same play; its choices are noted on the play', () => {
  for (let seed = 0; seed < 40; seed++) {
    assert.deepEqual(variant(seed), variant(seed));
    const play = newPlay('frisling', seed, 1);
    const v = frislingVariant(play, null, DECOYS);
    assert.equal(play.variant.way, v.way);
    assert.equal(play.variant.nook, `${v.nook}/${v.pose}`);
    assert.equal(play.variant.fam, FAMILY_LAYOUTS[v.family].id);
  }
});

test('every way, nook, pose, family layout and look-alike spot can come', () => {
  const seen = { way: new Set<string>(), nook: new Map<WayId, Set<number>>(), pose: new Set<number>(), family: new Set<number>(), spot: new Map<WayId, Set<number>>(), leeuwerik: new Set<string>() };
  for (let seed = 0; seed < 600; seed++) {
    const v = variant(seed);
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

test('the look-alikes each get their own spot; the nightjar lies at the stand\'s edge', () => {
  for (let seed = 0; seed < 200; seed++) {
    const v = variant(seed);
    assert.equal(v.decoySpots.length, DECOYS.length);
    assert.equal(new Set(v.decoySpots).size, DECOYS.length, 'one spot each');
    DECOYS.forEach((d, i) => { if (wantsEdge(d)) assert.ok(WAYS[v.way].decoySpots[v.decoySpots[i]].edge, 'the nightjar at an edge spot'); });
  }
  // fewer look-alikes (a lower level): the same rule, the first spots of the same order
  const few = frislingVariant(newPlay('frisling', 9, 1), null, DECOYS.slice(0, 4));
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
    const a = frislingVariant(newPlay('frisling', seed, 1), null, DECOYS);
    const b = frislingVariant(newPlay('frisling', seed + 1, 2), [a.way], DECOYS, [FAMILY_LAYOUTS[a.family].id]);
    const c = frislingVariant(newPlay('frisling', seed + 2, 3), [b.way, a.way], DECOYS, [FAMILY_LAYOUTS[b.family].id, FAMILY_LAYOUTS[a.family].id]);
    assert.equal(new Set([a.family, b.family, c.family]).size, 3, `seeds ${seed}..${seed + 2}: families`);
    assert.equal(new Set([a.way, b.way, c.way]).size, 3, `seeds ${seed}..${seed + 2}: ways`);
  }
  // after only one play, both others can come
  const after = new Set(Array.from({ length: 60 }, (_, s) => frislingVariant(newPlay('frisling', s, 2), null, DECOYS, ['rand']).family));
  assert.deepEqual([...after].sort(), [0, 2]);
});

test('the recent ways: this session\'s plays first, then the history\'s, one per play', () => {
  const h = [
    { m: 'frisling', sd: 5, va: 'way:wei,nook:1/0,fam:rand' },
    { m: 'frisling', sd: 7, va: 'rare:ekster,way:berk,nook:0/2,fam:modder' },
    { m: 'frisling', sd: 7, va: 'rare:ekster,way:berk,nook:0/2,fam:modder' },
  ];
  assert.deepEqual(recentWays(h), ['berk', 'wei']);
  assert.deepEqual(recentWays(h, [{ sd: 8, way: 'steen' }]), ['steen', 'berk', 'wei']);
});

test('the recent family layouts: this session\'s plays first, then the history\'s, one per play', () => {
  assert.deepEqual(recentFams([]), []);
  const h = [
    { m: 'frisling', sd: 5, va: 'way:wei,nook:1/0,fam:rand' },
    { m: 'frisling', sd: 5, va: 'way:wei,nook:1/0,fam:rand' },
    { m: 'ree-niet-aanraken', sd: 6, va: 'fam:boom' },
    { m: 'frisling', sd: 7, va: 'rare:ekster,way:berk,nook:0/2,fam:modder' },
  ];
  assert.deepEqual(recentFams(h), ['modder', 'rand']);
  // a play stopped early (no beat logged) still counts, newest first
  assert.deepEqual(recentFams(h, [{ sd: 7, fam: 'modder' }, { sd: 8, fam: 'boom' }]), ['boom', 'modder', 'rand']);
});

test('the last way is read from the history: the newest frisling beat\'s variant', () => {
  assert.equal(lastWayOf([]), null);
  assert.equal(lastWayOf([{ m: 'ree-niet-aanraken', va: 'way:steen' }]), null);
  assert.equal(lastWayOf([
    { m: 'frisling', va: 'rare:ekster,way:steen,nook:2' },
    { m: 'frisling', va: 'way:berk,nook:0,pose:1,fam:rand,mood:gouden-uur' },
    { m: 'wildcamera', va: 'way:wei' },
  ]), 'berk');
  assert.equal(lastWayOf([{ m: 'frisling' }, { m: 'frisling', va: 'nook:1' }]), null);
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
    frislingVariant(play, null, DECOYS);
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
