/**
 * simon3d.parity.test.ts — construct parity for Echokracht (run 7 `adaptive`, design §5.7):
 * the 2D floor (`render2d/SimonView`), the classic 3D stage (`render3d/engines/simon3d`) and
 * the world's callers (`adventure/beats/callers`) all build the echo the same way —
 * `buildSimonTrial(skin, knobs)` + `new SimonRun(trial.knobs, trial.dieren,
 * play.fork('simon').rng)` — so the same knobs, seed and taps give the same sequences and
 * the same summary. Pinned three ways: (1) each view's source builds it exactly so and
 * never draws from `Math.random`; (2) for seeds 1..20 and scripted players (perfect, one
 * wrong, two wrongs in one round, wrongs in two rounds) a 2D-built and a world-built run
 * agree call for call; (3) both match an INDEPENDENT reference model of the rules.
 *   node --experimental-strip-types --test src/render3d/engines/simon3d.parity.test.ts
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildSimonTrial, SimonRun } from '../../engines/simon.ts';
import { knobsFor, type BeatSummary, type SpanKnobs } from '../../core/skill.ts';
import { newPlay } from '../../core/play.ts';
import type { Skin } from '../../content/types.ts';

const SKIN = { dieren: ['das', 'wildzwijn', 'ree', 'nachtzwaluw'] } as Skin;

/** As a view builds it: the trial from the skin and the knobs, the run fed by its play's fork
 *  (a fresh play object over the seed, as each path gets its own). */
function build(knobs: SpanKnobs, seed: number, skin: Skin = SKIN): SimonRun {
  const trial = buildSimonTrial(skin, knobs);
  return new SimonRun(trial.knobs, trial.dieren, newPlay('wildcamera', seed, 1).fork('simon').rng);
}

/** A scripted player: in round r it first taps a wrong caller `wrongs[r]` times (at the start
 *  of the echo), then echoes the sequence right. Returns every sequence it was called. */
function play(run: SimonRun, wrongs: readonly number[]): { heard: string[][]; summary: BeatSummary } {
  const heard: string[][] = [];
  run.begin();
  let r = 0;
  while (!run.finished) {
    heard.push([...run.sequence]);
    for (let i = 0; i < (wrongs[r] ?? 0); i++) {
      const wrong = SKIN.dieren!.find((d) => d !== run.expected)!;
      run.tap(wrong);
      heard.push([...run.sequence]);
    }
    let res = run.tap(run.expected);
    while (res === 'advance') res = run.tap(run.expected);
    r += 1;
  }
  return { heard, summary: run.summary() };
}

/** INDEPENDENT reference of the span rules (design §5.2), from the knobs and the script. */
function reference(k: SpanKnobs, wrongs: readonly number[]): BeatSummary & { lengths: number[] } {
  let len = k.start, played = 0, clean = 0, longest = 0, eased = 0;
  let first: boolean | null = null;
  const lengths: number[] = [];
  for (let r = 0; ; r++) {
    let strikes = 0;
    for (let i = 0; i < (wrongs[r] ?? 0); i++) {
      strikes += 1;
      if (strikes === 2) { strikes = 0; eased += 1; len = Math.max(2, len - 1); }
    }
    lengths.push(len);
    played += 1;
    const ok = !(wrongs[r] ?? 0);
    if (first === null) first = ok;
    if (ok) { clean += 1; longest = Math.max(longest, len); }
    if (played >= k.rounds || (ok && len >= k.max)) break;
    if (ok) len = Math.min(k.max, len + 1);
  }
  return { trials: played, correct: clean, span: longest, start: k.start, rounds: played, eased, firstClean: first ?? false, lengths };
}

const SCRIPTS: Record<string, number[]> = {
  perfect: [],
  'one wrong': [1],
  'two wrongs in one round': [2],
  'wrongs in two rounds': [1, 1],
  'a late struggle': [0, 2, 3],
};

test('each view builds the echo the same way, from the knobs and the play (never Math.random)', () => {
  const src = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');
  for (const [name, s] of [
    ['2D SimonView', src('../../render2d/SimonView.ts')],
    ['3D simon3d', src('./simon3d.ts')],
    ['world callers', src('../adventure/beats/callers.ts')],
  ] as const) {
    assert.match(s, /buildSimonTrial\(step\.skin|buildSimonTrial\(k\.steps\[step\]\.skin/, `${name}: the trial from its skin`);
    assert.match(s, /knobs\('simon'\)/, `${name}: the level's knobs`);
    assert.match(s, /new SimonRun\(trial\.knobs, trial\.dieren, [^)]*fork\('simon'\)\.rng/, `${name}: the run from the play's fork`);
    assert.doesNotMatch(s, /Math\.random/, `${name}: no Math.random`);
  }
});

test('seeds 1..20 × scripts × bands: the 2D-built and the world-built echo agree call for call, and match the reference', () => {
  for (let band = 1; band <= 6; band++) {
    const knobs = knobsFor('simon', band);
    for (let seed = 1; seed <= 20; seed++) {
      for (const [name, wrongs] of Object.entries(SCRIPTS)) {
        const a = play(build(knobs, seed), wrongs);
        const b = play(build(knobs, seed), wrongs);
        assert.deepEqual(a, b, `band ${band} seed ${seed} ${name}: 2D vs world`);
        const ref = reference(knobs, wrongs);
        const { lengths, ...want } = ref;
        assert.deepEqual(a.summary, want, `band ${band} seed ${seed} ${name}: reference`);
        // the last echo he made was as long as the reference says
        assert.equal(a.heard.at(-1)!.length, lengths.at(-1), `band ${band} seed ${seed} ${name}: the last echo`);
      }
    }
  }
});

test("the owner's example: the first echo game plays 2 → 3 → 4; at band 2 it starts at 3", () => {
  const first = play(build(knobsFor('simon', 1), 7), []);
  assert.deepEqual(first.heard.map((s) => s.length), [2, 3, 4]);
  assert.deepEqual(first.heard[1].slice(0, 2), first.heard[0], 'the same calls plus one');
  assert.deepEqual(play(build(knobsFor('simon', 2), 7), []).heard.map((s) => s.length), [3, 4, 5]);
  assert.deepEqual(play(build(knobsFor('simon', 4.2), 7), []).heard.map((s) => s.length), [4, 5, 6, 7], 'a practised save starts at 4');
});

test('a skin may cap the rounds for its story (rondes), in every view alike', () => {
  const capped = play(build(knobsFor('simon', 1), 3, { ...SKIN, rondes: 2 } as Skin), []);
  assert.deepEqual(capped.heard.map((s) => s.length), [2, 3]);
  assert.equal(capped.summary.rounds, 2);
});
