/**
 * wisselen3d.parity.test.ts — construct parity for Wisselkracht (run 7 `adaptive`, design
 * §5.5, §5.7): the 2D floor (`render2d/WisselView`), the classic 3D stage
 * (`render3d/engines/wisselen3d`) and the world's aim (`adventure/beats/aim`, through
 * `AimRun`) build the round the same way — `buildWisselTrial(skin, knobs,
 * play.fork('wisselen').rng)` — and score it with the same `WisselRun`: the same seed gives
 * the same queue and the same turns, the same sorts give the same summary
 * `{ trials: sorts, correct: right first time, switches, switchErrors }`. Pinned: (1) each
 * view's source builds it so, never `Math.random`; (2) for seeds 1..20 × bands and scripted
 * players (perfect, one wrong, a switch error after each turn, two wrongs on one animal) a
 * 2D-built and a world-built round agree; (3) both match an INDEPENDENT reference of the
 * turn rules (a second turn waits one longer after a switch error, never two in a row, the
 * last leaves at least two animals).
 *   node --experimental-strip-types --test src/render3d/engines/wisselen3d.parity.test.ts
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildWisselTrial, WisselRun, type WisselBin, type WisselItem, type WisselTrial } from '../../engines/wisselen.ts';
import { AimRun } from '../adventure/beats/aim-math.ts';
import { knobsFor, judgeBeat, type BeatSummary } from '../../core/skill.ts';
import { newPlay } from '../../core/play.ts';
import type { Skin } from '../../content/types.ts';
import { AREA_VELUWE } from '../../content/veluwe.ts';

const WC = AREA_VELUWE.missies.find((m) => m.id === 'wildcamera')!.stappen.find((s) => s.ef === 'wisselen')!.skin as Skin;
const REGEL = WC.copy!.regel!;

function build(seed: number, band: number, skin: Skin = WC): WisselTrial {
  return buildWisselTrial(skin, knobsFor('wisselen', band), newPlay('wildcamera', seed, 1).fork('wisselen').rng);
}

const flipBin = (b: WisselBin): WisselBin => (b === 'open' ? 'hol' : 'open');

/** A scripted player over a live run: `wrongAt(i, afterTurn)` says how many wrong sorts to
 *  make on the i-th animal before the right one (`afterTurn`: it is the first after a turn). */
type Script = (i: number, afterTurn: boolean) => number;
function drive(sort: (b: WisselBin) => void, run: { current: WisselItem | undefined; correctBin(): WisselBin; inverted: boolean }, script: Script): void {
  let lastInv = run.inverted;
  let i = 0;
  while (run.current) {
    const afterTurn = run.inverted !== lastInv;
    lastInv = run.inverted;
    for (let w = 0; w < script(i, afterTurn); w++) sort(flipBin(run.correctBin()));
    sort(run.correctBin());
    i += 1;
  }
}

/** INDEPENDENT reference of the turn rules and the summary (design §5.5). */
function reference(trial: WisselTrial, script: Script): BeatSummary & { turnsAt: number[] } {
  const n = trial.queue.length;
  const every = Math.max(2, trial.flipEvery), flips = Math.max(1, trial.flips ?? 1);
  let gap = every, since = 0, turns = 0, correct = 0, errs = 0, after = -1;
  const turnsAt: number[] = [];
  for (let i = 0; i < n; i++) {
    const w = script(i, i === after);
    if (w === 0) correct += 1;
    else if (i === after) { errs += 1; gap = Math.min(5, gap + 1); }
    if (i === n - 1) break;
    since += 1;
    if (turns < flips && since >= (turns === 0 ? every : gap) && n - (i + 1) >= 2) {
      turns += 1; since = 0; after = i + 1; turnsAt.push(i + 1);
    }
  }
  return { trials: n, correct, switches: turns, switchErrors: errs, turnsAt };
}

const SCRIPTS: Record<string, Script> = {
  perfect: () => 0,
  'one wrong': (i) => (i === 1 ? 1 : 0),
  'a switch error after each turn': (_i, after) => (after ? 1 : 0),
  'two wrongs on one animal': (i) => (i === 0 ? 2 : 0),
};

test('each view builds the round from the knobs and the play (never Math.random)', () => {
  const src = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');
  for (const [name, s] of [
    ['2D WisselView', src('../../render2d/WisselView.ts')],
    ['3D wisselen3d', src('./wisselen3d.ts')],
    ['world aim', src('../adventure/beats/aim.ts')],
  ] as const) {
    assert.match(s, /buildWisselTrial\([^;]*knobs\('wisselen'\)[^;]*fork\('wisselen'\)\.rng/s, `${name}: the trial from the knobs and the play's fork`);
    assert.doesNotMatch(s, /Math\.random/, `${name}: no Math.random`);
  }
});

test('seeds 1..20 × bands × scripts: the 2D-built round and the world\'s aim agree, and match the reference', () => {
  for (let band = 1; band <= 6; band++) {
    for (let seed = 1; seed <= 20; seed++) {
      const t2d = build(seed, band), tWorld = build(seed, band);
      assert.deepEqual(t2d, tWorld, `band ${band} seed ${seed}: the same queue`);
      for (const [name, script] of Object.entries(SCRIPTS)) {
        const run = new WisselRun(t2d);
        const turnsAt: number[] = [];
        drive((b) => { if (run.choose(b) === 'flip') turnsAt.push(run.index); }, run, script);
        const aim = new AimRun(tWorld, REGEL);
        drive((b) => { aim.pick(b); }, aim.run, script);
        assert.deepEqual(aim.summary(), run.summary(), `band ${band} seed ${seed} ${name}: 2D vs world`);
        const { turnsAt: want, ...ref } = reference(t2d, script);
        assert.deepEqual(run.summary(), ref, `band ${band} seed ${seed} ${name}: reference`);
        assert.deepEqual(turnsAt, want, `band ${band} seed ${seed} ${name}: the turns`);
      }
    }
  }
});

test('the wildcamera grows: 6 animals and one turn at first, 8 and two turns (night and back to day) at band 4, 10 at band 5', () => {
  const t1 = build(3, 1), t4 = build(3, 4.2), t5 = build(3, 5);
  assert.equal(t1.queue.length, 6);
  assert.equal(t4.queue.length, 8);
  assert.equal(t5.queue.length, 10);
  const turns = (t: WisselTrial): string[] => {
    const aim = new AimRun(t, REGEL);
    const out: string[] = [];
    while (aim.current) { const s = aim.pick(aim.right); if (s.turn) out.push(s.turn); if (s.done) break; }
    return out;
  };
  assert.deepEqual(turns(t1), ['night']);
  assert.deepEqual(turns(t4), ['night', 'day']);
  // a story may cap the round (the nachtronde keeps its 8)
  const nacht = AREA_VELUWE.missies.find((m) => m.id === 'nachtronde')!.stappen.find((s) => s.ef === 'wisselen')!.skin as Skin;
  assert.equal(build(3, 6, nacht).queue.length, 8);
});

test('a second turn waits one longer after a switch error; never two turns in a row', () => {
  const queue: WisselItem[] = Array.from({ length: 10 }, (_, i) => ({ id: i % 2 ? 'das' : 'ree', dag: i % 2 === 0 }));
  const run = new WisselRun({ queue, flipEvery: 2, flips: 2 });
  const at: number[] = [];
  let first = true;
  while (!run.finished) {
    if (run.index === 2 && first) { first = false; assert.equal(run.choose(flipBin(run.correctBin())), 'retry'); }
    if (run.choose(run.correctBin()) === 'flip') at.push(run.index);
  }
  assert.deepEqual(at, [2, 5], 'the switch error after the first turn: the next comes 3 later, not 2');
  assert.deepEqual(run.summary(), { trials: 10, correct: 9, switches: 2, switchErrors: 1 });
});

test('the judgement reads the summary: easy, fine, hard', () => {
  const t = build(5, 4);
  const perfect = new WisselRun(t);
  drive((b) => { perfect.choose(b); }, perfect, () => 0);
  assert.equal(judgeBeat('wisselen', perfect.summary()), 'easy');
  // band 4 (8 animals, the turn after 3): a switch error makes the second turn wait one
  // longer, and then there is no room left for it: one turn, one switch error → fine
  const one = new WisselRun(t);
  drive((b) => { one.choose(b); }, one, (_i, after) => (after ? 1 : 0));
  assert.deepEqual([one.summary().switches, one.summary().switchErrors], [1, 1]);
  assert.equal(judgeBeat('wisselen', one.summary()), 'fine');
  // band 6 (10 animals, the turn after 2): two turns, a switch error after each → hard
  const t6 = build(5, 6);
  const two = new WisselRun(t6);
  drive((b) => { two.choose(b); }, two, (_i, after) => (after ? 1 : 0));
  assert.equal(two.summary().switchErrors, 2);
  assert.equal(judgeBeat('wisselen', two.summary()), 'hard', 'two switch errors');
});
