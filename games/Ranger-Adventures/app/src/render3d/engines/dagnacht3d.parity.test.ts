/**
 * dagnacht3d.parity.test.ts — the seeded construct-parity test for the diegetic
 * 3D "dagnacht" variant (BUILD-PLAN §1f/§4 acceptance, §9e). Run:
 *   node --experimental-strip-types --test src/render3d/engines/dagnacht3d.parity.test.ts
 *
 * Parity is guaranteed BY CONSTRUCTION: both `render2d/DangerView` (2D) and
 * `render3d/engines/dagnacht3d` (3D) drive the same pure `DagnachtRun` core +
 * the same `buildDagnachtTrial`. This test pins that core's frozen contract — the
 * exact rule the 2D twin has always used — so the two views can never silently
 * diverge in WHAT they score:
 *   trials  = encounter total (never shrinks, even with retries),
 *   correct = encounters that were NEVER answered wrong.
 * A wrong choice is RECOVERABLE (re-presents the same encounter, never game-over);
 * the good answer is read from `opt.goed`, never the on-screen slot (so the
 * shuffle + the flip encounter can't change the score). Deterministic.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDagnachtTrial, DagnachtRun } from '../../engines/dagnacht.ts';
import type { Encounter } from '../../engines/dagnacht.ts';

/** A seeded fixture skin: 4 encounters, the good slot deliberately alternates
 *  (slot 1, 0, 1, 0) and the last one FLIPS — so a position-based scorer would
 *  fail but the goed-based core must not. */
const ENCOUNTERS: Encounter[] = [
  { id: 'reekalf', subject: 'reekalf', vraag: 'Het kalf drukt zich.',
    opties: [{ label: 'Aai het', goed: false }, { label: 'Laat het liggen', goed: true }] },
  { id: 'adder', subject: 'adder', vraag: 'Een adder zont.',
    opties: [{ label: 'Hou afstand', goed: true }, { label: 'Pak hem op', goed: false }] },
  { id: 'voeren', subject: 'zwijn-honger', vraag: 'Een hongerig zwijn snuffelt.',
    opties: [{ label: 'Geef een koekje', goed: false }, { label: 'Niet voeren', goed: true }] },
  { id: 'pad', subject: 'pad-veilig', flip: true, vraag: 'Het pad is vrij.',
    opties: [{ label: 'Loop rustig door', goed: true }, { label: 'Blijf staan', goed: false }] },
];

const skin = { encounters: ENCOUNTERS, regels: ['Niet voeren'], metgezel: 'geen' } as never;
const baseDiff = { slowmo: false, reducedMotion: false } as never;

/** A per-encounter choice script: each entry is the option slots a player taps,
 *  in order, until the good one lands (mirrors retry-until-correct in both views). */
type Script = number[][];

/** Reference scorer — an INDEPENDENT re-implementation of the frozen 2D rule
 *  (correct = encounters never-wronged), used to cross-check the shared core. */
function reference(encs: Encounter[], script: Script): { trials: number; correct: number } {
  const wrong = new Set<number>();
  let idx = 0;
  while (idx < encs.length) {
    for (const slot of script[idx]) {
      if (encs[idx].opties[slot].goed) { idx += 1; break; }
      wrong.add(idx);
    }
  }
  return { trials: encs.length, correct: encs.length - wrong.size };
}

/** Drive the SHARED core the way both views do (choose by `opt.goed`). */
function drive(encs: Encounter[], script: Script): { trials?: number; correct?: number } {
  const run = new DagnachtRun(encs.length);
  while (!run.finished) {
    for (const slot of script[run.index]) {
      if (run.choose(encs[run.index].opties[slot].goed) === 'advance') break;
    }
  }
  return run.summary();
}

test('perfect run → correct equals trials equals total', () => {
  const trial = buildDagnachtTrial(skin, baseDiff);
  // tap the good slot first try on every encounter
  const perfect: Script = trial.encounters.map((e) => [e.opties.findIndex((o) => o.goed)]);
  const s = drive(trial.encounters, perfect);
  assert.equal(s.trials, trial.encounters.length);
  assert.equal(s.correct, trial.encounters.length);
  assert.deepEqual(s, reference(trial.encounters, perfect));
});

test('the shared core matches the independent 2D reference for a mixed script', () => {
  const trial = buildDagnachtTrial(skin, baseDiff);
  // encounters 0 + 2 are answered wrong once (then right); 1 + 3 are clean
  const mixed: Script = [
    [0, 1], // reekalf: wrong slot 0, then good slot 1
    [0],    // adder: good slot 0 first try
    [0, 1], // voeren: wrong slot 0, then good slot 1
    [0],    // pad (flip): good slot 0 first try
  ];
  const got = drive(trial.encounters, mixed);
  assert.deepEqual(got, reference(trial.encounters, mixed));
  // two encounters were wronged → correct = 4 - 2 = 2; trials never shrinks
  assert.equal(got.trials, 4);
  assert.equal(got.correct, 2);
});

test('wrong is recoverable — many retries still complete + never go negative', () => {
  const trial = buildDagnachtTrial(skin, baseDiff);
  // tap every wrong slot repeatedly before the good one on each encounter
  const stubborn: Script = trial.encounters.map((e) => {
    const good = e.opties.findIndex((o) => o.goed);
    return [...e.opties.map((_, i) => i).filter((i) => i !== good), good, good, good].concat([good]);
  });
  const s = drive(trial.encounters, stubborn);
  assert.equal(s.trials, 4);
  assert.equal(s.correct, 0); // every encounter was wronged at least once
  assert.ok((s.correct ?? -1) >= 0);
});

test('the flip encounter scores by opt.goed, not by slot position', () => {
  const trial = buildDagnachtTrial(skin, baseDiff);
  const flipIdx = trial.encounters.findIndex((e) => e.flip);
  assert.ok(flipIdx >= 0, 'fixture has a flip encounter');
  // choosing the goed:true option (whatever slot) must advance + count correct
  const goodSlot = trial.encounters[flipIdx].opties.findIndex((o) => o.goed);
  const run = new DagnachtRun(trial.encounters.length);
  // fast-forward to the flip encounter cleanly
  for (let i = 0; i < flipIdx; i++) {
    run.choose(true);
  }
  assert.equal(run.index, flipIdx);
  assert.equal(run.choose(trial.encounters[flipIdx].opties[goodSlot].goed), 'advance');
});

test('deterministic — same trial + same script yields the same summary', () => {
  const trial = buildDagnachtTrial(skin, baseDiff);
  const script: Script = [[1], [0, 1], [1], [0]];
  assert.deepEqual(drive(trial.encounters, script), drive(trial.encounters, script));
});

test('slowmo support is gated off under reduced-motion', () => {
  assert.equal(buildDagnachtTrial(skin, { slowmo: true, reducedMotion: true } as never).slowmo, false);
  assert.equal(buildDagnachtTrial(skin, { slowmo: true, reducedMotion: false } as never).slowmo, true);
});
