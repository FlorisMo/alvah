/**
 * beats.test.ts — the aim (wisselen) and callers (simon) beats' pure mapping: what the
 * world does for each pick, and when each caller calls (design run6-missions §6). The
 * cores are the SAME pure runs as the 2D floor and the 3D stage; the beat's own reading
 * of them never changes what they score. Run: `npm test`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { AimRun, ruleChips } from './aim-math.ts';
import { listenPlan } from './callers-math.ts';
import { WisselRun, placeNames, regelAndersom, type WisselBin, type WisselItem, type WisselTrial } from '../../../engines/wisselen.ts';
import { SimonRun } from '../../../engines/simon.ts';
import { knobsFor } from '../../../core/skill.ts';
import { newPlay } from '../../../core/play.ts';
import { AREA_VELUWE } from '../../../content/veluwe.ts';

const WC = AREA_VELUWE.missies.find((m) => m.id === 'wildcamera')!;
const REGEL = WC.stappen.find((s) => s.ef === 'wisselen')!.skin.copy!.regel!;

const QUEUE: WisselItem[] = [
  { id: 'edelhert', dag: true }, { id: 'das', dag: false }, { id: 'ree', dag: true },
  { id: 'nachtzwaluw', dag: false }, { id: 'wildzwijn', dag: false }, { id: 'ree', dag: true },
];
const TRIAL: WisselTrial = { queue: QUEUE, flipEvery: 2 };

test('the wildcamera\'s places are "open plek" and "het bosje", said by its rule', () => {
  assert.deepEqual(placeNames(REGEL), { open: 'open plek', hol: 'het bosje' });
  const aim = new AimRun(TRIAL, REGEL);
  assert.deepEqual(aim.names, { open: 'open plek', hol: 'het bosje' });
  assert.deepEqual(ruleChips(REGEL), ['☀️ Dag-dier → open plek', '🌙 Nacht-dier → het bosje']);
  assert.deepEqual(ruleChips(regelAndersom(REGEL)), ['☀️ Dag-dier → het bosje', '🌙 Nacht-dier → open plek']);
});

test('a pick: the camera looks where he clicked; right = the animal\'s photo, wrong = an empty photo and the same animal', () => {
  const aim = new AimRun(TRIAL, REGEL);
  assert.equal(aim.current?.id, 'edelhert');
  assert.equal(aim.right, 'open');
  assert.deepEqual(aim.pick('hol'), { look: 'hol', shot: 'empty', turn: null, done: false });
  assert.equal(aim.current?.id, 'edelhert', 'the same animal again');
  assert.deepEqual(aim.pick('open'), { look: 'open', shot: 'photo', turn: null, done: false });
  assert.equal(aim.current?.id, 'das');
});

test('the rule flips with the light: night is exactly the flipped rule, and back', () => {
  const aim = new AimRun(TRIAL, REGEL);
  const turns: (string | null)[] = [];
  const nights: boolean[] = [];
  while (aim.current) {
    const s = aim.pick(aim.right);
    turns.push(s.turn);
    nights.push(aim.night);
    if (s.done) break;
  }
  // flipEvery 2: day, day → night, night → day, day (the last one completes)
  assert.deepEqual(turns, [null, 'night', null, 'day', null, null]);
  assert.deepEqual(nights, [false, true, true, false, false, false]);
  assert.equal(aim.rule, REGEL, 'back in the day, the rule as it was');
});

test('the aim scores exactly what the shared core scores, for any taps', () => {
  const scripts: WisselBin[][] = [
    [], ['open', 'hol', 'hol', 'open', 'open', 'open'],
    ['hol', 'open', 'hol', 'hol', 'open', 'open', 'hol', 'open'],
  ];
  // a perfect player, and one who misses once in the night
  const perfect = (): WisselBin[] => { const r = new WisselRun(TRIAL); const out: WisselBin[] = []; while (!r.finished) { const b = r.correctBin(); out.push(b); r.choose(b); } return out; };
  const p = perfect();
  scripts.push(p, [...p.slice(0, 3), p[3] === 'open' ? 'hol' : 'open', ...p.slice(3)]);
  for (const bins of scripts) {
    const aim = new AimRun(TRIAL, REGEL);
    const core = new WisselRun(TRIAL);
    for (const b of bins) { if (core.finished) break; aim.pick(b); core.choose(b); }
    assert.deepEqual(aim.summary(), core.summary());
  }
  const aim = new AimRun(TRIAL, REGEL);
  for (const b of p) aim.pick(b);
  assert.deepEqual(aim.summary(), { trials: 1, correct: 1 });
});

test('the callers call in the sequence\'s order, each at least 0.65 s, calm gaps; the core scores as ever', () => {
  const plan = listenPlan(['das', 'ree', 'das'], (id) => (id === 'ree' ? 0.4 : 1.1));
  assert.deepEqual(plan.map((b) => b.id), ['das', 'ree', 'das']);
  assert.deepEqual(plan.map((b) => b.on), [1.1, 0.65, 1.1]);
  assert.ok(plan.every((b) => b.gap >= 0.3));
  assert.ok(listenPlan(['das'], () => 1, true)[0].gap > plan[0].gap, 'a little longer under reduced motion');
  const dieren = WC.stappen.find((s) => s.ef === 'simon')!.skin.dieren!;
  assert.deepEqual([...dieren], ['das', 'wildzwijn', 'ree', 'nachtzwaluw'], 'the night callers');
  // run 7: the echo plays rounds from the knobs (a first game: 2 → 3 → 4), all clean
  const run = new SimonRun(knobsFor('simon', 1), dieren, newPlay('wildcamera', 5, 1).fork('simon').rng);
  run.begin();
  while (!run.finished) for (const id of [...run.sequence]) run.tap(id);
  assert.deepEqual(run.summary(), { trials: 3, correct: 3, span: 4, start: 2, rounds: 3, eased: 0, firstClean: true });
});
