/**
 * wildcamera.variety.test.ts — every play of "De wildcamera" is a different evening and a
 * different night, drawn from its seed (run 7, design `state/wildcamera/design.md` §4,
 * §6.1), and none of it says where an animal must go. Run: `npm test`.
 *
 * Seeds a reviewer can type (`/?dev=1&seed=N`: the session's first play is seed N; a fresh
 * save is level 1, six photos, one turn, an echo from two):
 *
 *   seed 101 → the night: the badger, the boar, the fox, the roe
 *   seed 102 → the night: the badger, the nightjar, the boar, the fox
 *   seed 103 → the night: the badger, the nightjar, the roe, the fox
 *
 * The snare (wc-hands), on a save's first play: seed 101 → S2 (the birch and the stone),
 * 102 → S1 (the juniper and the foxglove), 104 → S3 (the fallen log and the fern).
 *
 * (pinned below by SEED_TABLE: which animals come in the evening is the wissel core's,
 * pinned there; here how they come and who calls at night.)
 *
 * The album (wc-album), on a save's first play (the visit's light the golden hour): seed 21
 * → a misty evening, the fox with her cubs, a badger's nose at the lens, a golden sunrise;
 * seed 16 → the golden hour, the white roe, a roe's nose at first light, a clear morning;
 * seed 4 → no rare, a boar's snout, a misty morning; seed 33 → a fox's nose; seed 1 → a
 * misty evening and nothing more (with two won plays without a rare behind it: the white
 * roe, the pity rule).
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { newPlay, compactVariant } from '../../../core/play.ts';
import { knobsFor } from '../../../core/skill.ts';
import { buildWisselTrial, WisselRun } from '../../../engines/wisselen.ts';
import { buildSimonTrial, simonCast } from '../../../engines/simon.ts';
import { AREA_VELUWE } from '../../../content/veluwe.ts';
import type { Skin } from '../../../content/types.ts';
import { CALLER_SLOTS, SIDE_OF, SLOT_CLASH, STOPS, STOPS_OF, type SlotId } from './wildcamera.places.ts';
import {
  CameraClock, drawCallers, drawSnare, drawWildcameraPlay, hhmm, lastNights, lastSnare, legalLayouts, parseVariant, sameSpots, variantOf, type WildcameraPlay,
  DAWNS, EVENINGS, NEUS_IDS, NEUS_P, NEUS_PITY, WILDCAMERA_MOODS, drawDawn, drawNeus, lastDawn, neusDrought, type Dawn,
} from './wildcamera.variety.ts';
import { playMood, type MoodId } from '../../Moods.ts';
import { ONTDEKKINGEN } from '../../../content/ontdekkingen.ts';
import { nextRareCount, rollRare } from '../../../core/discover.ts';
import { SNARE_IDS, type SnareId } from './wildcamera.places.ts';

const MISSION = 'wildcamera';
const m = AREA_VELUWE.missies.find((x) => x.id === MISSION)!;
const aimSkin = m.stappen[0].skin as Skin;
const callSkin = m.stappen[1].skin as Skin;

/** A play as wildcamera.ts draws it, at `level` (wisselen and simon alike), after the
 *  nights `recent` (their `wn` notes). */
function draw(seed: number, level = 1, recent: string[] = []): { p: WildcameraPlay; queue: { id: string; dag: boolean }[]; cast: string[]; trial: ReturnType<typeof buildWisselTrial> } {
  const play = newPlay(MISSION, seed, 1);
  const trial = buildWisselTrial(aimSkin, knobsFor('wisselen', level), play.fork('wisselen').rng);
  const cast = simonCast(callSkin, play.fork('simon-cast').rng);
  return { p: drawWildcameraPlay(play, { queueLength: trial.queue.length, cast, recent }), queue: trial.queue, cast, trial };
}
/** A session of `n` plays from `base`, each drawn after the ones before (as the save's
 *  history hands them over). */
function session(base: number, n: number, level = 1): ReturnType<typeof draw>[] {
  const out: ReturnType<typeof draw>[] = [];
  const recent: string[] = [];
  for (let k = 0; k < n; k++) {
    const d = draw(base + k, level, [...recent]);
    out.push(d);
    recent.push(variantOf(d.p).wn);
  }
  return out;
}

const clash = (a: string, b: string): boolean => SLOT_CLASH.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

function valid(p: WildcameraPlay, queueLength: number, cast: readonly string[]): void {
  assert.equal(p.arrivals.length, queueLength);
  p.arrivals.forEach((a, i) => {
    assert.ok(a.side === 'left' || a.side === 'right');
    assert.ok(STOPS_OF[a.side].includes(a.stop), `stop ${a.stop} on the ${a.side}`);
    assert.equal(STOPS[a.stop].side, a.side);
    if (i > 0) assert.notEqual(a.stop, p.arrivals[i - 1].stop, 'never two in a row at one stop');
  });
  assert.deepEqual(p.callers.map((c) => c.id).sort(), [...cast].sort(), 'the night is the cast');
  const slots = p.callers.map((c) => c.slot);
  assert.equal(new Set(slots).size, slots.length, 'one caller a spot');
  for (const c of p.callers) assert.ok(CALLER_SLOTS[c.slot].animals.includes(c.id), `${c.id} may call from ${c.slot}`);
  for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++) assert.ok(!clash(slots[i], slots[j]), `${slots[i]} and ${slots[j]} never together`);
  assert.equal(p.callers[0].delay, 0);
  for (let i = 1; i < p.callers.length; i++) {
    const gap = p.callers[i].delay - p.callers[i - 1].delay;
    assert.ok(gap >= 0.49 && gap <= 1.21, `a calm stagger (${gap.toFixed(2)} s)`);
  }
  assert.ok(p.clockStart >= 17 * 60 + 20 && p.clockStart <= 18 * 60 + 10, `the evening's first photo at ${hhmm(p.clockStart)}`);
}

test('seeds 1..500: every play is a valid evening and night, at every level', () => {
  for (let seed = 1; seed <= 500; seed++) {
    for (const level of [1, 3.6, 5]) {
      const { p, queue, cast } = draw(seed, level);
      valid(p, queue.length, cast);
    }
  }
});

test('the same seed is the same play; neighbouring seeds differ', () => {
  for (const seed of [1, 7, 101, 4242]) assert.deepEqual(draw(seed).p, draw(seed).p);
  const vs = new Set<string>();
  for (let seed = 1; seed <= 30; seed++) { const v = variantOf(draw(seed).p); vs.add(`${v.wa}-${v.wn}`); }
  assert.ok(vs.size >= 28, `${vs.size} different plays of 30`);
});

test('where an animal comes from never says where it goes (1000 seeds: half and half)', () => {
  for (const level of [1, 4]) {
    let same = 0, n = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      const { p, trial } = draw(seed, level);
      // a perfect player: each animal's right place in turn, the rule turning as the core says
      const run = new WisselRun(trial);
      trial.queue.forEach((_, i) => {
        const bin = run.correctBin();
        if (p.arrivals[i].side === SIDE_OF[bin]) same++;
        n++;
        run.choose(bin);
      });
    }
    const share = same / n;
    assert.ok(share >= 0.45 && share <= 0.55, `level ${level}: ${(share * 100).toFixed(1)} % came from the side they went to`);
  }
});

test('three plays in a row are three different evenings and nights', () => {
  for (let base = 1; base <= 300; base += 3) {
    const plays = session(base, 3);
    const cast = (q: { id: string }[]): string => [...new Set(q.map((x) => x.id))].sort().join();
    const nights = new Set(plays.map((x) => x.p.callers.map((c) => `${c.id}@${c.slot}`).sort().join()));
    assert.equal(nights.size, 3, `seeds ${base}..${base + 2}: three different nights`);
    const ways = new Set(plays.map((x) => x.p.arrivals.map((a) => a.stop).join()));
    assert.equal(ways.size, 3, 'three different ways in');
    // the evening's cast (the core's) differs in at least one of the three
    assert.ok(new Set(plays.map((x) => cast(x.queue))).size >= 2, `seeds ${base}..: the evening brings other animals`);
    // both sides, more than two stops in one play
    for (const x of plays) {
      assert.ok(new Set(x.p.arrivals.map((a) => a.side)).size === 2 || x.p.arrivals.length < 4, 'from both sides');
    }
  }
});

test('the night\'s cast: the badger and three of the others, the same as the 2D floor\'s row', () => {
  const seen = new Set<string>();
  for (let seed = 1; seed <= 300; seed++) {
    const { cast } = draw(seed);
    assert.equal(cast.length, 4, 'four callers, as the 2D floor has four buttons');
    assert.ok(cast.includes('das'), 'the badger by its sett always');
    for (const id of cast) assert.ok(callSkin.roepPool!.includes(id));
    seen.add(cast.join());
    // the 2D floor builds the same row from the same fork
    const play = newPlay(MISSION, seed, 1);
    assert.deepEqual(buildSimonTrial(callSkin, knobsFor('simon', 1), play.fork('simon-cast').rng).dieren, cast);
  }
  assert.equal(seen.size, 4, 'each of the four others sits a night out sometimes');
  // without a play's fork the row is the content's own (old callers, the hut)
  assert.deepEqual(buildSimonTrial(callSkin, knobsFor('simon', 1)).dieren, callSkin.dieren);
  // every cast has several nights
  for (const leave of ['wildzwijn', 'ree', 'nachtzwaluw', 'vos']) {
    const cast = ['das', ...['wildzwijn', 'ree', 'nachtzwaluw', 'vos'].filter((x) => x !== leave)];
    assert.ok(legalLayouts(cast).length >= 4, `${cast.join()} has ${legalLayouts(cast).length} nights`);
  }
});

test('the evening\'s visitors come from the content\'s pools: three of four of each at six photos', () => {
  const ids = new Set<string>();
  for (let seed = 1; seed <= 200; seed++) {
    const { queue } = draw(seed, 1);
    assert.equal(queue.length, 6);
    const day = queue.filter((q) => q.dag).map((q) => q.id), night = queue.filter((q) => !q.dag).map((q) => q.id);
    assert.equal(new Set(day).size, 3);
    assert.equal(new Set(night).size, 3);
    for (const q of queue) ids.add(q.id);
  }
  for (const id of ['edelhert', 'hinde', 'ree', 'gaai', 'das', 'nachtzwaluw', 'wildzwijn', 'vos']) assert.ok(ids.has(id), `${id} comes some evenings`);
  // a practised save (3.6): eight photos, the rule turns after three; band 4: a turn back
  assert.equal(draw(1, 3.6).queue.length, 8);
  assert.equal(draw(1, 3.6).trial.flipEvery, 3);
  assert.equal(draw(1, 4.2).trial.flips, 2);
});

test('the variant: two short notes the history keeps beside any mood and rare, read back', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const { p } = draw(seed, 5);
    const v = variantOf(p);
    assert.ok(/^[a-d]+$/.test(v.wa) && /^(?:[a-z][a-h])+$/.test(v.wn));
    const back = parseVariant(v)!;
    assert.deepEqual(back.stops, p.arrivals.map((a) => a.stop));
    assert.deepEqual(back.night, p.callers.map((c) => ({ animal: c.id, slot: c.slot })));
    // the longest mood and rare in front of it: both notes still kept
    const kept = compactVariant({ mood: 'ochtendnevel', rare: 'witte-ree', wn: v.wn, wa: v.wa })!;
    assert.ok(kept.includes(`wn:${v.wn}`) && kept.includes(`wa:${v.wa}`), kept);
  }
  assert.equal(parseVariant({ wa: 'xyz', wn: 'da' }), null);
});

test('the camera\'s clock runs on, turns to the night and to first light', () => {
  const c = new CameraClock(17 * 60 + 40, () => 0.5);
  const a = c.photo(), b = c.photo();
  assert.equal(a, '17:40');
  assert.ok(b > a, `${b} after ${a}`);
  c.turn('night');
  const n = c.photo();
  assert.ok(n >= '22:00' && n <= '22:30', `the night's first photo at ${n}`);
  c.photo(); c.photo(); c.photo(); c.photo(); c.photo(); c.photo();
  c.turn('day');
  const d = c.photo();
  assert.ok(d >= '05:10' && d <= '05:45', `first light at ${d}`);
  assert.equal(hhmm(24 * 60 + 5), '00:05');
  // never backwards
  const c2 = new CameraClock(18 * 60, () => 0.99);
  let last = c2.minutes;
  for (let i = 0; i < 10; i++) { c2.photo(); if (i === 4) c2.turn('night'); if (i === 8) c2.turn('day'); assert.ok(c2.minutes > last); last = c2.minutes; }
});

test('the history hands the last nights over: one per play, newest last', () => {
  const h = [
    { m: 'wildcamera', sd: 5, va: 'mood:gouden-uur,wn:daweva,wa:abcd' },
    { m: 'wildcamera', sd: 5, va: 'mood:gouden-uur,wn:daweva,wa:abcd' },
    { m: 'frisling', sd: 6, va: 'mood:zonnig' },
    { m: 'wildcamera', sd: 7, va: 'mood:schemer,rare:vosjes,wn:dbrega,wa:cdab' },
    { m: 'wildcamera', sd: 8 },
  ];
  assert.deepEqual(lastNights(h), ['daweva', 'dbrega']);
  // a night after those two never stands as either did
  for (let seed = 1; seed <= 200; seed++) {
    const a = draw(seed), b = draw(seed + 1000, 1, [variantOf(a.p).wn]);
    const key = (p: WildcameraPlay): string => p.callers.map((c) => `${c.id}@${c.slot}`).sort().join();
    assert.notEqual(key(b.p), key(a.p), `seed ${seed}: the next night stands differently`);
  }
});

test('two nights in a row never look alike: at most one animal on its spot of last night (1000 seed triples)', () => {
  const spots = (p: WildcameraPlay): Record<string, string> => Object.fromEntries(p.callers.map((c) => [c.id, c.slot]));
  const shared = { 0: 0, 1: 0 } as Record<number, number>;
  for (let t = 0; t < 1000; t++) {
    // the save's history as the beat log writes it (two beats a play, the play's variant on
    // each), handed on through lastNights the way wildcamera.ts does
    const history: { m: string; sd: number; va?: string }[] = [];
    let prev: Record<string, string> | null = null;
    for (let k = 0; k < 3; k++) {
      const seed = 1 + t * 3 + k;
      const { p } = draw(seed, 1 + k, lastNights(history));
      const v = variantOf(p);
      const va = compactVariant({ mood: 'gouden-uur', wn: v.wn, wa: v.wa });
      history.push({ m: MISSION, sd: seed, va }, { m: MISSION, sd: seed, va });
      const now = spots(p);
      if (prev) {
        const same = Object.keys(now).filter((id) => prev![id] === now[id]);
        assert.ok(same.length <= 1, `seeds ${seed - 1} → ${seed}: ${same.join(', ')} on last night's spot`);
        shared[same.length]++;
        assert.notEqual(Object.values(now).sort().join(), Object.values(prev).sort().join(), `seed ${seed}: not the same four spots with the animals shuffled`);
      }
      prev = now;
    }
  }
  // most nights share none (the badger keeps its side only when the night has no room for it on the other)
  assert.ok(shared[0] > shared[1], `none ${shared[0]}, one ${shared[1]}`);
});

test('whatever the last two nights were, the next one keeps at most one animal on its spot', () => {
  const others = ['wildzwijn', 'ree', 'nachtzwaluw', 'vos'];
  const casts = others.map((leave) => ['das', ...others.filter((o) => o !== leave)]);
  const wn = (lay: Record<string, SlotId>): string =>
    variantOf({ seed: 0, arrivals: [], clockStart: 0, callers: Object.entries(lay).map(([id, slot]) => ({ id, slot, delay: 0 })) }).wn;
  let n = 0;
  for (const c0 of casts) for (const before of legalLayouts(c0)) for (const c1 of casts) for (const last of legalLayouts(c1)) for (const cast of casts) {
    const night = drawCallers(newPlay(MISSION, ++n, 1), cast, [wn(before), wn(last)]);
    const lay = Object.fromEntries(night.map((c) => [c.id, c.slot]));
    assert.ok(sameSpots(lay, last) <= 1, `after ${wn(before)}, ${wn(last)}: ${night.map((c) => `${c.id}@${c.slot}`).join(', ')}`);
    assert.notEqual(Object.values(lay).sort().join(), Object.values(last).sort().join(), 'not last night\'s four spots');
    assert.ok(![wn(before), wn(last)].map((w) => parseVariant({ wa: 'a', wn: w })!.night.map((x) => `${x.animal}@${x.slot}`).sort().join()).includes(night.map((c) => `${c.id}@${c.slot}`).sort().join()), 'never one of the last two nights');
  }
  assert.ok(n > 10000, `${n} pairs of nights`);
  // the first night (no history) is drawn from every layout, as before
  const first = new Set<string>();
  for (let seed = 1; seed <= 400; seed++) first.add(drawCallers(newPlay(MISSION, seed, 1), casts[0]).map((c) => c.slot).join());
  assert.ok(first.size >= legalLayouts(casts[0]).length * 0.8, `${first.size} first nights`);
});

/* ---------------------------------------------------- wc-hands: the snare ---- */

test('the snare: a save\'s first plays (the seeds a reviewer types)', () => {
  const first = (seed: number): SnareId => drawSnare(newPlay(MISSION, seed, 1));
  assert.deepEqual([first(101), first(102), first(104)], ['S2', 'S1', 'S3']);
});

test('the snare\'s spot: each of the three as often, never the spot of the play before', () => {
  const count: Record<SnareId, number> = { S1: 0, S2: 0, S3: 0 };
  for (let seed = 1; seed <= 3000; seed++) count[drawSnare(newPlay(MISSION, seed, 1))]++;
  for (const id of SNARE_IDS) assert.ok(count[id] > 850 && count[id] < 1150, `${id}: ${count[id]} of 3000 first plays`);
  for (const last of SNARE_IDS) {
    const after: Record<SnareId, number> = { S1: 0, S2: 0, S3: 0 };
    for (let seed = 1; seed <= 2000; seed++) after[drawSnare(newPlay(MISSION, seed, 1), last)]++;
    assert.equal(after[last], 0, `never ${last} twice in a row`);
    for (const id of SNARE_IDS.filter((x) => x !== last)) assert.ok(after[id] > 850, `after ${last}: ${id} ${after[id]} of 2000`);
  }
});

test('the snare\'s spot travels in the play\'s variant and the next play reads it back from the history', () => {
  const play = newPlay(MISSION, 4242, 3);
  const cast = simonCast(callSkin, play.fork('simon-cast').rng);
  const p = drawWildcameraPlay(play, { queueLength: 6, cast, lastSnare: 'S2' });
  assert.notEqual(p.snare, 'S2');
  const v = variantOf(p);
  assert.equal(`S${v.ws}`, p.snare);
  // as wildcamera.ts notes it (the flow's mood and rare first), the history keeps it
  play.note('mood', 'ochtendnevel');
  play.note('rare', 'witte-ree');
  play.note('ws', v.ws);
  play.note('wn', v.wn);
  play.note('wa', 'abcdabcdab');
  const va = compactVariant(play.variant)!;
  assert.ok(va.includes(`ws:${v.ws}`) && va.includes(`wn:${v.wn}`), `kept in the 60 characters: ${va}`);
  const history = [
    { m: 'ree-niet-aanraken', sd: 1, va: 'mood:zonnig,ws:9' },
    { m: MISSION, sd: 7, va: 'mood:gouden-uur,ws:3,wn:dancvgrf,wa:dcbabc' },
    { m: MISSION, sd: 8, va: va },
    { m: 'frisling', sd: 9, va: 'mood:zonnig' },
  ];
  assert.equal(lastSnare(history), p.snare);
  assert.equal(lastSnare(history.slice(0, 2)), 'S3');
  assert.equal(lastSnare([]), null);
  assert.equal(lastSnare([{ m: MISSION, va: 'mood:x,wn:dancvgrf' }]), null, 'a play logged before wc-hands');
  // a play's own draw never changes with the snare (its fork is its own)
  const again = drawWildcameraPlay(newPlay(MISSION, 4242, 3), { queueLength: 6, cast, lastSnare: null });
  assert.deepEqual(again.callers, p.callers);
  assert.deepEqual(again.arrivals, p.arrivals);
});

/* ------------------------------------------- wc-album: the light, the nose, the rare ---- */

test('the night\'s close-up: about one play in three, every animal of the four, and surely by the third play', () => {
  let got = 0;
  const who = new Set<string>();
  for (let seed = 1; seed <= 3000; seed++) {
    const n = drawNeus(newPlay(MISSION, seed, 1), 0);
    if (n) { got++; who.add(n); }
    assert.equal(drawNeus(newPlay(MISSION, seed, 1), 0), n, 'the same seed, the same nose');
    // after two plays without one, the next surely has one (the same animal its draw picks)
    const sure = drawNeus(newPlay(MISSION, seed, 1), NEUS_PITY);
    assert.ok(sure && NEUS_IDS.includes(sure));
    if (n) assert.equal(sure, n);
  }
  assert.ok(got / 3000 > NEUS_P - 0.04 && got / 3000 < NEUS_P + 0.04, `${((got / 3000) * 100).toFixed(1)} % of plays`);
  assert.deepEqual([...who].sort(), [...NEUS_IDS].sort());
});

test('the close-up travels in the variant (`wx`) and the history counts the plays without one', () => {
  const play = (sd: number, wx: string): { m: string; sd: number; va: string } => ({ m: MISSION, sd, va: `mood:bewolkt,ws:1,wx:${wx},wn:dancvgrf` });
  assert.equal(neusDrought([]), 0);
  assert.equal(neusDrought([play(1, '0'), play(1, '0')]), 1, 'one play logs two beats');
  assert.equal(neusDrought([play(1, '0'), play(2, '0'), play(2, '0')]), 2);
  assert.equal(neusDrought([play(1, '0'), play(2, 'w'), play(3, '0')]), 1, 'counted back to the last nose');
  assert.equal(neusDrought([{ m: MISSION, sd: 1, va: 'mood:x,ws:2,wn:dancvgrf' }, play(2, '0')]), 1, 'a play from before the album ends the count');
  assert.equal(neusDrought([play(1, '0'), { m: 'frisling', sd: 9, va: 'mood:zonnig' }, play(2, '0')]), 2, 'other homes do not count');
  for (let seed = 1; seed <= 300; seed++) {
    const d = draw(seed);
    const v = variantOf(d.p);
    assert.equal(v.wx, d.p.neus ? v.wx : '0');
    assert.ok(/^[0wdvr]$/.test(v.wx));
  }
  // as wildcamera.ts notes it, behind the longest mood and rare: the snare, the nose and the
  // night still fit the history's 60 characters (the visitors' stops may fall off)
  for (let seed = 1; seed <= 200; seed++) {
    const d = draw(seed, 5);
    const v = variantOf(d.p);
    const va = compactVariant({ mood: 'ochtendnevel', rare: 'witte-ree', ws: v.ws, wx: v.wx, wn: v.wn, wd: v.wd, wa: v.wa })!;
    assert.ok(va.includes(`ws:${v.ws}`) && va.includes(`wx:${v.wx}`) && va.includes(`wn:${v.wn}`), va);
    // (the morning too, behind any mood and rare, with four callers)
    const four = variantOf(draw(seed, 1).p);
    const va4 = compactVariant({ mood: 'ochtendnevel', rare: 'witte-ree', ws: four.ws, wx: four.wx, wn: four.wn, wd: four.wd, wa: four.wa })!;
    assert.ok(va4.includes(`wd:${four.wd}`), va4);
  }
});

test('three plays in a row: never three without a nose, as the history hands it over (1000 sessions)', () => {
  let withNose = 0, plays = 0;
  for (let t = 0; t < 1000; t++) {
    const history: { m: string; sd: number; va?: string }[] = [];
    let dry = 0;
    for (let k = 0; k < 6; k++) {
      const seed = 1 + t * 6 + k;
      const play = newPlay(MISSION, seed, k + 1);
      const p = drawWildcameraPlay(play, { queueLength: 6, cast: ['das', 'ree', 'vos', 'wildzwijn'], neusDrought: neusDrought(history) });
      const v = variantOf(p);
      const va = compactVariant({ mood: 'gouden-uur', ws: v.ws, wx: v.wx, wn: v.wn, wa: v.wa });
      history.push({ m: MISSION, sd: seed, va }, { m: MISSION, sd: seed, va });
      dry = p.neus ? 0 : dry + 1;
      assert.ok(dry <= NEUS_PITY, `session ${t}: ${dry} plays in a row without a nose`);
      if (p.neus) withNose++;
      plays++;
    }
  }
  assert.ok(withNose / plays > 0.4 && withNose / plays < 0.6, `${((withNose / plays) * 100).toFixed(0)} % of plays have one`);
});

test('the light: the evening is one of three (never dusk, never the bright day), the morning misty, clear or golden, never the evening\'s nor the last play\'s', () => {
  assert.deepEqual([...EVENINGS], ['gouden-uur', 'bewolkt', 'ochtendnevel']);
  // the home's rule: a new evening every play, never the last one's (render3d/Moods playMood)
  const seen = new Set<string>();
  for (let seed = 1; seed <= 300; seed++) {
    let last: MoodId | null = null;
    for (let k = 0; k < 3; k++) {
      const m = playMood('gouden-uur', WILDCAMERA_MOODS, newPlay(MISSION, seed * 3 + k, k + 1), last);
      assert.ok((EVENINGS as readonly string[]).includes(m), m);
      assert.notEqual(m, last, 'never the last play\'s evening');
      seen.add(m);
      last = m;
    }
  }
  assert.equal(seen.size, 3);
  assert.deepEqual([...DAWNS], ['ochtendnevel', 'zonnig', 'gouden-uur']);
  const dawns = { ochtendnevel: 0, zonnig: 0, 'gouden-uur': 0 } as Record<Dawn, number>;
  for (let seed = 1; seed <= 1500; seed++) dawns[drawDawn(newPlay(MISSION, seed, 1))]++;
  for (const d of DAWNS) assert.ok(dawns[d] > 400, `${d}: ${dawns[d]} of 1500 mornings`);
  // never the evening's light, never the last play's morning (both read back from the history)
  for (let seed = 1; seed <= 600; seed++) {
    for (const evening of EVENINGS) {
      for (const last of [null, ...DAWNS]) {
        const d = drawDawn(newPlay(MISSION, seed, 2), { evening, last });
        assert.notEqual(d, evening, `seed ${seed}: the morning stands in the evening's light`);
        assert.notEqual(d, last, `seed ${seed}: the morning of the play before`);
      }
    }
  }
  // three plays in a row, as the history hands them over: three evenings, and no morning
  // twice in a row
  for (let t = 0; t < 300; t++) {
    const history: { m: string; sd: number; va?: string }[] = [];
    let lastMood: MoodId | null = null;
    let prevDawn: Dawn | null = null;
    for (let k = 0; k < 3; k++) {
      const seed = 5 + t * 3 + k;
      const play = newPlay(MISSION, seed, k + 1);
      const evening = playMood('gouden-uur', WILDCAMERA_MOODS, play, lastMood);
      const p = drawWildcameraPlay(play, { queueLength: 6, cast: ['das', 'ree', 'vos', 'wildzwijn'], evening, lastDawn: lastDawn(history) });
      assert.notEqual(p.dawn, evening);
      assert.notEqual(p.dawn, prevDawn, `session ${t}: the same morning twice in a row`);
      const v = variantOf(p);
      const va = compactVariant({ mood: evening, ws: v.ws, wx: v.wx, wn: v.wn, wd: v.wd, wa: v.wa });
      history.push({ m: MISSION, sd: seed, va }, { m: MISSION, sd: seed, va });
      lastMood = evening;
      prevDawn = p.dawn;
    }
  }
  assert.equal(lastDawn([{ m: MISSION, va: 'mood:bewolkt,ws:1,wx:0,wn:dancvgrf,wd:g' }, { m: 'frisling', va: 'wd:n' }]), 'gouden-uur');
  assert.equal(lastDawn([{ m: MISSION, va: 'mood:bewolkt,ws:1,wx:0,wn:dancvgrf' }]), null, 'a play from before the album');
});

test('the rare ones of the crossing: the fox family and the white roe, by luck or surely by the third won play', () => {
  const rares = ONTDEKKINGEN.filter((o) => o.home === MISSION && o.soort === 'zeldzaam').map((o) => o.id);
  assert.deepEqual(rares.sort(), ['wildcamera.vosjes', 'wildcamera.witte-ree']);
  const rows = ONTDEKKINGEN.filter((o) => o.home === MISSION);
  assert.ok(rows.length >= 6, 'the badger, the fox, his own photo, the nose and two rare ones');
  for (const o of rows) assert.ok(!/wolf/i.test(`${o.id} ${o.naam} ${o.naamKnap ?? ''} ${o.hint} ${o.model ?? ''}`), `${o.id}: no wolf`);
  // a save's plays: won, the pity counter as the flow keeps it (core/discover nextRareCount)
  for (let t = 0; t < 500; t++) {
    let count = 0, dry = 0;
    const found: Record<string, unknown> = {};
    const kinds = new Set<string>();
    for (let k = 0; k < 9; k++) {
      const play = newPlay(MISSION, 7 + t * 9 + k, k + 1);
      const r = rollRare({ home: MISSION, play, table: ONTDEKKINGEN, found, counts: { [MISSION]: count }, mood: 'bewolkt' });
      if (r) { found[r.id] = {}; kinds.add(r.id); }
      count = nextRareCount(count, { won: true, gotRare: !!r });
      dry = r ? 0 : dry + 1;
      if (Object.keys(found).length < 2) assert.ok(dry <= 2, `save ${t}: ${dry} won plays in a row without a rare`);
    }
    assert.equal(kinds.size, 2, `save ${t}: both rare ones within nine plays`);
  }
});
