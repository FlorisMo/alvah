/**
 * simon.spread.test.ts — run 7 (the squirrel's neighbours): a story's `roepAllen` makes every
 * animal of the row heard once before any calls again (`spread`), the length — and so the
 * span — as without; the 2D floor and the world read the same skin, so they build the same
 * echo. Without it, the echo is drawn as before. Run: `npm test`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSimonTrial, simonNext, SimonRun } from './simon.ts';
import { knobsFor } from '../core/skill.ts';
import { newPlay } from '../core/play.ts';
import type { Skin } from '../content/types.ts';

const ROW = ['eekhoorn', 'gaai', 'groene-specht', 'raaf'];

test('spread: a sequence as long as the row calls every animal once, growing or fresh', () => {
  for (let s = 1; s <= 200; s++) {
    const next = simonNext(ROW, newPlay('eekhoorn', s, 1).fork('simon').rng, true);
    let seq = next(2, null);
    assert.equal(new Set(seq).size, 2, `seed ${s}: two different first`);
    seq = next(3, seq); // (grown: the same calls plus one)
    seq = next(4, seq);
    assert.equal(new Set(seq).size, 4, `seed ${s}: a 4-long echo calls all four (${seq.join(' ')})`);
    const fresh = next(4, seq);
    assert.equal(new Set(fresh).size, 4, `seed ${s}: a fresh 4-long one too`);
    const five = next(5, fresh);
    assert.equal(five.length, 5, 'longer than the row: it goes on as before');
    for (let i = 2; i < five.length; i++) assert.ok(!(five[i] === five[i - 1] && five[i] === five[i - 2]), 'never three times in a row there');
  }
});

test('without roepAllen the draw is as it was; with it, the trial carries it and the run keeps the span rules', () => {
  const plain: Skin = { dieren: ROW } as Skin;
  const allen: Skin = { dieren: ROW, roepAllen: true } as Skin;
  assert.equal(buildSimonTrial(plain, knobsFor('simon', 1)).spread, undefined);
  assert.equal(buildSimonTrial(allen, knobsFor('simon', 1)).spread, true);
  for (let s = 1; s <= 20; s++) {
    const a = simonNext(ROW, newPlay('m', s, 1).fork('simon').rng);
    const b = simonNext(ROW, newPlay('m', s, 1).fork('simon').rng, false);
    let x = a(2, null), y = b(2, null);
    assert.deepEqual(x, y);
    x = a(3, x); y = b(3, y);
    assert.deepEqual(x, y, 'spread off: the same draws as before');
  }
  // the same knobs, seed and taps give the same summary in every view (one run class)
  const trial = buildSimonTrial(allen, knobsFor('simon', 1));
  const play = (): unknown => {
    const run = new SimonRun(trial.knobs, trial.dieren, newPlay('eekhoorn', 9, 1).fork('simon').rng, trial.spread);
    run.begin();
    while (!run.finished) for (const id of [...run.sequence]) run.tap(id);
    return run.summary();
  };
  assert.deepEqual(play(), play());
  assert.equal((play() as { span: number }).span, 4, 'a first echo game: 2 → 3 → 4');
});
