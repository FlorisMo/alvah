/**
 * corsi3d.parity.test.ts — construct parity for Geheugenkracht (run 7 `adaptive`, design
 * §5.7): the 2D floor (`render2d/RouteView`), the classic 3D stage (`render3d/engines/corsi3d`)
 * and the world's route beat (`adventure/beats/route`) all build the route the same way —
 * `buildCorsiTrial(skin, knobs)` + `new CorsiRun(trial, play.fork('corsi').rng)` over the
 * seven PRINT_SPOTS — so the same knobs, seed and taps give the same routes and the same
 * summary. Pinned three ways: (1) each view's source builds it exactly so and never draws
 * from `Math.random`; (2) for seeds 1..20 and scripted players (perfect, one wrong, two
 * wrongs in one round, wrongs in two rounds) a 2D-built and a world-built run agree spot for
 * spot; (3) both match an INDEPENDENT reference model of the rules.
 *   node --experimental-strip-types --test src/render3d/engines/corsi3d.parity.test.ts
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildCorsiTrial, CorsiRun, PRINT_SPOTS } from '../../engines/corsi.ts';
import { knobsFor, type BeatSummary, type SpanKnobs } from '../../core/skill.ts';
import { newPlay } from '../../core/play.ts';
import type { Skin } from '../../content/types.ts';

const SKIN = {} as Skin;

function build(knobs: SpanKnobs, seed: number, skin: Skin = SKIN): CorsiRun {
  return new CorsiRun(buildCorsiTrial(skin, knobs), newPlay('frisling', seed, 1).fork('corsi').rng);
}

/** A scripted player: in round r it first taps a wrong spot `wrongs[r]` times, then walks the
 *  route back right. Returns every route it was shown. */
function play(run: CorsiRun, wrongs: readonly number[]): { shown: number[][]; summary: BeatSummary } {
  const shown: number[][] = [];
  run.begin();
  let r = 0;
  while (!run.finished) {
    shown.push([...run.sequence]);
    for (let i = 0; i < (wrongs[r] ?? 0); i++) {
      run.tap(PRINT_SPOTS.find((s) => s.id !== run.expected)!.id);
      shown.push([...run.sequence]);
    }
    let res = run.tap(run.expected);
    while (res === 'advance') res = run.tap(run.expected);
    r += 1;
  }
  return { shown, summary: run.summary() };
}

/** INDEPENDENT reference of the span rules (design §5.2). */
function reference(k: SpanKnobs, wrongs: readonly number[]): BeatSummary {
  let len = k.start, played = 0, clean = 0, longest = 0, eased = 0;
  let first: boolean | null = null;
  for (let r = 0; ; r++) {
    let strikes = 0;
    for (let i = 0; i < (wrongs[r] ?? 0); i++) {
      strikes += 1;
      if (strikes === 2) { strikes = 0; eased += 1; len = Math.max(2, len - 1); }
    }
    played += 1;
    const ok = !(wrongs[r] ?? 0);
    if (first === null) first = ok;
    if (ok) { clean += 1; longest = Math.max(longest, len); }
    if (played >= k.rounds || (ok && len >= k.max)) break;
    if (ok) len = Math.min(k.max, len + 1);
  }
  return { trials: played, correct: clean, span: longest, start: k.start, rounds: played, eased, firstClean: first ?? false };
}

const SCRIPTS: Record<string, number[]> = {
  perfect: [],
  'one wrong': [1],
  'two wrongs in one round': [2],
  'wrongs in two rounds': [1, 1],
  'a late struggle': [0, 2, 3],
};

test('each view builds the route the same way, from the knobs and the play (never Math.random)', () => {
  const src = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');
  for (const [name, s] of [
    ['2D RouteView', src('../../render2d/RouteView.ts')],
    ['3D corsi3d', src('./corsi3d.ts')],
    ['world route', src('../adventure/beats/route.ts')],
  ] as const) {
    assert.match(s, /buildCorsiTrial\(step\.skin|buildCorsiTrial\(k\.steps\[step\]\.skin/, `${name}: the trial from its skin`);
    assert.match(s, /knobs\('corsi'\)/, `${name}: the level's knobs`);
    assert.match(s, /new CorsiRun\(trial, [^)]*fork\('corsi'\)\.rng/, `${name}: the run from the play's fork`);
    assert.doesNotMatch(s, /Math\.random/, `${name}: no Math.random`);
  }
});

test('seeds 1..20 × scripts × bands: the 2D-built and the world-built route agree spot for spot, and match the reference', () => {
  for (let band = 1; band <= 6; band++) {
    const knobs = knobsFor('corsi', band);
    for (let seed = 1; seed <= 20; seed++) {
      for (const [name, wrongs] of Object.entries(SCRIPTS)) {
        const a = play(build(knobs, seed), wrongs);
        const b = play(build(knobs, seed), wrongs);
        assert.deepEqual(a, b, `band ${band} seed ${seed} ${name}: 2D vs world`);
        assert.deepEqual(a.summary, reference(knobs, wrongs), `band ${band} seed ${seed} ${name}: reference`);
        for (const route of a.shown) assert.equal(new Set(route).size, route.length, 'no spot twice in a route');
      }
    }
  }
});

test('a fresh save walks a route of 3, then a new one of 4; a practised save starts at 4 with 3 rounds', () => {
  const fresh = play(build(knobsFor('corsi', 1), 11), []);
  assert.deepEqual(fresh.shown.map((s) => s.length), [3, 4]);
  assert.notDeepEqual(fresh.shown[1].slice(0, 3), fresh.shown[0], 'each round a new route (not the old one plus a spot)');
  assert.deepEqual(play(build(knobsFor('corsi', 4.2), 11), []).shown.map((s) => s.length), [4, 5, 6]);
});

test('a skin may cap the rounds for its story (rondes)', () => {
  const capped = play(build(knobsFor('corsi', 5), 3, { rondes: 2 } as Skin), []);
  assert.deepEqual(capped.shown.map((s) => s.length), [5, 6]);
});
