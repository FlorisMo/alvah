/**
 * wisselen.test.ts — the words of the day/night sort (child:B3): the rule after a
 * flip is stated outright, and every animal carries its cue (icon + word). Run 7 fix: the
 * round is fair whatever the seed draws (a child who clicks one place never grows).
 *   node --experimental-strip-types --test src/engines/wisselen.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { placeNames, regelAndersom, dagOfNacht, buildWisselTrial, turnPlans, WisselRun, type WisselBin, type WisselTrial } from './wisselen.ts';
import { knobsFor, judgeBeat } from '../core/skill.ts';
import { newPlay } from '../core/play.ts';
import { AREA_VELUWE } from '../content/veluwe.ts';
import type { Skin } from '../content/types.ts';
import { forSpeech } from '../core/narrator.ts';

test('the two places come from the mission rule', () => {
  assert.deepEqual(placeNames('Dag-dier → open plek. Nacht-dier → het hol.'), { open: 'open plek', hol: 'het hol' });
  assert.deepEqual(placeNames('Dag-dier → open zand. Nacht-dier → het hol.'), { open: 'open zand', hol: 'het hol' });
  assert.deepEqual(placeNames('iets anders'), { open: 'open plek', hol: 'het hol' });
});

test('after a flip the rule says the new mapping, not only "andersom"', () => {
  assert.equal(regelAndersom('Dag-dier → open plek. Nacht-dier → het hol.'), 'Dag-dier → het hol. Nacht-dier → open plek.');
});

test('every animal carries an icon and a word for day or night', () => {
  assert.deepEqual(dagOfNacht(true), { icoon: '☀️', woord: 'Dag-dier' });
  assert.deepEqual(dagOfNacht(false), { icoon: '🌙', woord: 'Nacht-dier' });
});

test('a rule is spoken with "naar", never "pijl"', () => {
  assert.equal(forSpeech('Dag-dier → open plek. Nacht-dier → het hol.'), 'Dag-dier naar open plek. Nacht-dier naar het hol.');
});

test('a count is said as "van" and an icon is never said (V1 minor: "📓Open je sporenboek 0/3")', () => {
  assert.equal(forSpeech('📓Open je sporenboek 0/3'), 'Open je sporenboek 0 van 3');
  assert.equal(forSpeech('🐦‍⬛ Bezoek de raaf'), 'Bezoek de raaf');
  assert.equal(forSpeech('☀️ Dag-dier'), 'Dag-dier');
});

// ── fair variety (run 7 fix, decision 1): the seed changes the round, never how hard it is ──


/** The three wissel rounds the game plays: the wildcamera's aim, the nachtronde's sort and
 *  the drift sand's guard. */
const SKINS: [string, Skin][] = ['wildcamera', 'nachtronde', 'stuifzand'].map((id) => [
  id, AREA_VELUWE.missies.find((m) => m.id === id)!.stappen.find((s) => s.ef === 'wisselen')!.skin as Skin,
]);

/** The round a play of `id` draws (the 2D floor, the stage and the world all take this fork). */
const roundOf = (id: string, skin: Skin, seed: number, band: number): WisselTrial =>
  buildWisselTrial(skin, knobsFor('wisselen', band), newPlay(id, seed, 1).fork('wisselen').rng);

/** A child who clicks `place` every time, and the other place only after a miss. */
function oneClicker(trial: WisselTrial, place: WisselBin): ReturnType<WisselRun['summary']> {
  const run = new WisselRun(trial);
  const other: WisselBin = place === 'open' ? 'hol' : 'open';
  while (!run.finished) if (run.choose(place) === 'retry') run.choose(other);
  return run.summary();
}

test('4000 seeds × bands 1-6 × three rounds: one place every time never grows, a perfect player does', () => {
  for (const [id, skin] of SKINS) {
    for (let band = 1; band <= 6; band++) {
      for (let seed = 1; seed <= 4000; seed++) {
        const trial = roundOf(id, skin, seed, band);
        for (const place of ['open', 'hol'] as const) {
          const j = judgeBeat('wisselen', oneClicker(trial, place));
          assert.ok(j === 'steady' || j === 'hard', `${id} band ${band} seed ${seed}: always "${place}" is judged ${j}`);
        }
        const perfect = new WisselRun(trial);
        while (!perfect.finished) perfect.choose(perfect.correctBin());
        assert.equal(judgeBeat('wisselen', perfect.summary()), 'easy', `${id} band ${band} seed ${seed}: perfect`);
      }
    }
  }
});

test('every stretch between two turns has a day and a night animal, however the second turn falls', () => {
  for (const [id, skin] of SKINS) {
    for (let band = 1; band <= 6; band++) {
      for (let seed = 1; seed <= 500; seed++) {
        const t = roundOf(id, skin, seed, band);
        const n = t.queue.length;
        for (const at of turnPlans(n, t.flipEvery, t.flips ?? 1)) {
          const cuts = [0, ...at, n];
          for (let j = 0; j + 1 < cuts.length; j++) {
            const part = t.queue.slice(cuts[j], cuts[j + 1]);
            assert.ok(part.some((q) => q.dag) && part.some((q) => !q.dag), `${id} band ${band} seed ${seed}: turns at ${at}, stretch ${cuts[j]}-${cuts[j + 1]}`);
          }
        }
      }
    }
  }
});

test('the turn plans are the ones WisselRun plays (a second turn one later after a switch error)', () => {
  assert.deepEqual(turnPlans(6, 4, 1), [[4]]);
  assert.deepEqual(turnPlans(8, 3, 2), [[3, 6], [3]], 'band 4: after a switch error no room for the second turn');
  assert.deepEqual(turnPlans(10, 3, 2), [[3, 6], [3, 7]]);
  assert.deepEqual(turnPlans(10, 2, 2), [[2, 4], [2, 5]]);
  // the run itself, driven both ways, turns where a plan says
  const queue = Array.from({ length: 10 }, (_, i) => ({ id: i % 2 ? 'das' : 'ree', dag: i % 2 === 0 }));
  for (const err of [false, true]) {
    const run = new WisselRun({ queue, flipEvery: 3, flips: 2 });
    const at: number[] = [];
    let missed = false;
    while (!run.finished) {
      if (err && !missed && at.length === 1) { missed = true; run.choose(run.correctBin() === 'open' ? 'hol' : 'open'); }
      if (run.choose(run.correctBin()) === 'flip') at.push(run.index);
    }
    assert.deepEqual(at, err ? [3, 7] : [3, 6]);
  }
});

test('half day, half night; each animal of a kind once before any comes again; never one twice in a row', () => {
  for (const [id, skin] of SKINS) {
    for (let band = 1; band <= 6; band++) {
      for (let seed = 1; seed <= 500; seed++) {
        const { queue } = roundOf(id, skin, seed, band);
        assert.equal(queue.filter((q) => q.dag).length, Math.ceil(queue.length / 2));
        for (let i = 1; i < queue.length; i++) assert.notEqual(queue[i].id, queue[i - 1].id, `${id} band ${band} seed ${seed}`);
        for (const [dag, ids] of [[true, skin.dagDieren!], [false, skin.nachtDieren!]] as const) {
          const seq = queue.filter((q) => q.dag === dag).map((q) => q.id);
          for (let from = 0; from < seq.length; from += ids.length) {
            const set = seq.slice(from, from + ids.length);
            assert.equal(new Set(set).size, set.length, `${id} band ${band} seed ${seed}: a ${dag ? 'day' : 'night'} animal again before the others`);
            for (const a of set) assert.ok(ids.includes(a));
          }
        }
      }
    }
  }
});

test('the same seed is the same round; the seed still varies it (order and animals)', () => {
  for (const [id, skin] of SKINS) {
    for (const band of [1, 4, 6]) {
      assert.deepEqual(roundOf(id, skin, 77, band), roundOf(id, skin, 77, band));
      const orders = new Set<string>(), casts = new Set<string>();
      for (let seed = 1; seed <= 200; seed++) {
        const q = roundOf(id, skin, seed, band).queue;
        orders.add(q.map((x) => (x.dag ? 'D' : 'N')).join(''));
        casts.add(q.map((x) => x.id).join());
      }
      assert.ok(orders.size >= 10, `${id} band ${band}: ${orders.size} orders of day and night`);
      assert.ok(casts.size >= 100, `${id} band ${band}: ${casts.size} rounds of 200`);
    }
  }
});
