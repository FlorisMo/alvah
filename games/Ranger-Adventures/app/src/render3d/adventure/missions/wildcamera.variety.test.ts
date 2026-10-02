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
 * (pinned below by SEED_TABLE: which animals come in the evening is the wissel core's,
 * pinned there; here how they come and who calls at night.)
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { newPlay, compactVariant } from '../../../core/play.ts';
import { knobsFor } from '../../../core/skill.ts';
import { buildWisselTrial, WisselRun } from '../../../engines/wisselen.ts';
import { buildSimonTrial, simonCast } from '../../../engines/simon.ts';
import { AREA_VELUWE } from '../../../content/veluwe.ts';
import type { Skin } from '../../../content/types.ts';
import { CALLER_SLOTS, SIDE_OF, SLOT_CLASH, STOPS, STOPS_OF } from './wildcamera.places.ts';
import {
  CameraClock, drawWildcameraPlay, hhmm, lastNights, legalLayouts, parseVariant, variantOf, type WildcameraPlay,
} from './wildcamera.variety.ts';

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
