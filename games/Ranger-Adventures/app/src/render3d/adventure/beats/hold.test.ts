/**
 * hold.test.ts — a rustkracht moment played with the body (beats/hold-math.ts): reaches
 * and time become exactly the `DagnachtRun` choices a card would have made, so the
 * logged summary is the one the 2D floor logs for the same answers (construct parity,
 * design run6-missions §6). Run: `npm test`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { GoCore, GO_AWAY_M, HoldCore, HOLD_S, HOLD_SILENT_S, RustTempo, readSeconds } from './hold-math.ts';
import { knobsFor } from '../../../core/skill.ts';
import { newPlay } from '../../../core/play.ts';
import { DagnachtRun } from '../../../engines/dagnacht.ts';

/** A hold over a real run, with every `choose` call recorded. */
function rig(seconds = HOLD_S): { core: HoldCore; run: DagnachtRun; calls: boolean[] } {
  const run = new DagnachtRun(5);
  const calls: boolean[] = [];
  const core = new HoldCore(seconds, (goed) => { calls.push(goed); run.choose(goed); });
  return { core, run, calls };
}

test('kept still: nothing happens until the line is read, then one full hold is choose(true), once', () => {
  const { core, run, calls } = rig();
  assert.equal(core.tick(10), false, 'the clock does not run while the line is read');
  core.begin(2);
  assert.equal(core.tick(2 + HOLD_S - 0.1), false);
  assert.equal(core.left(2 + 1), HOLD_S - 1);
  assert.equal(core.tick(2 + HOLD_S), true);
  assert.equal(core.tick(99), true, 'held stays held');
  assert.deepEqual(calls, [true], 'one choice: the right one');
  assert.equal(core.impulse(), false, 'a reach after the moment was held does nothing');
  assert.equal(run.index, 1, 'the run moved on to the next encounter');
});

test('a reach during the hold: choose(false), the animal reacts, the same hold again from the start', () => {
  const { core, run, calls } = rig();
  core.begin(0);
  assert.equal(core.tick(3), false);
  assert.equal(core.impulse(), true);
  assert.equal(core.phase, 'react');
  assert.equal(core.impulse(), false, 'while it reacts, another reach is not counted');
  assert.equal(core.tick(100), false, 'no hold while it reacts');
  core.again();
  assert.equal(core.phase, 'read');
  core.begin(10);
  assert.equal(core.tick(10 + HOLD_S - 0.5), false, 'the 3 s before the reach do not count');
  assert.equal(core.tick(10 + HOLD_S), true);
  assert.deepEqual(calls, [false, true]);
  assert.equal(core.impulses, 1);
  assert.equal(run.index, 1);
});

test('a reach while the line is still read counts too; many reaches mark the encounter once', () => {
  const { core, run, calls } = rig();
  assert.equal(core.impulse(), true, 'a hand at the piglet before the hold began is still a reach');
  core.again();
  core.begin(1);
  assert.equal(core.impulse(), true);
  core.again();
  core.begin(5);
  core.tick(5 + HOLD_S);
  assert.deepEqual(calls, [false, false, true]);
  assert.equal(core.impulses, 2);
  // the rest of the run answered right on the cards: 5 trials, 4 correct
  while (!run.finished) run.choose(true);
  assert.deepEqual(run.summary(), { trials: 5, correct: 4, impulses: 2 }, 'run 7: both reaches are impulses');
});

test('two body moments in a run of five: the summary is the one the cards would log', () => {
  // aaien (a reach, then still), dragen (card, right), voeren (card, right), zeug (still at
  // once), pad (card, right): 5 trials, 4 correct — and the same as five cards answered so
  const run = new DagnachtRun(5);
  const aaien = new HoldCore(HOLD_S, (g) => run.choose(g));
  aaien.impulse(); aaien.again(); aaien.begin(0); aaien.tick(HOLD_S);
  run.choose(true); run.choose(true);
  const zeug = new HoldCore(HOLD_S, (g) => run.choose(g));
  zeug.begin(0); zeug.tick(HOLD_S);
  run.choose(true);
  const cards = new DagnachtRun(5);
  for (const g of [false, true, true, true, true, true]) cards.choose(g);
  assert.deepEqual(run.summary(), cards.summary());
  assert.deepEqual(run.summary(), { trials: 5, correct: 4, impulses: 1 });
});

test('the times: a hold of ~4 s after the voice, ~3.5 s after a silent read of 280 ms a word', () => {
  assert.ok(HOLD_S >= 3.5 && HOLD_S <= 5);
  assert.ok(HOLD_SILENT_S >= 3 && HOLD_SILENT_S <= HOLD_S);
  assert.equal(readSeconds('Hij is bang. Raak hem niet aan.'), 7 * 0.28);
  assert.equal(readSeconds('  '), 0);
});

test('run 7: the hold starts at the band\'s, eases half a second after a reach (≥ 2.5 s), grows after two clean holds (≤ band + 1)', () => {
  const rng = newPlay('t', 1, 1).fork('rust').rng;
  const t = new RustTempo(knobsFor('dagnacht', 1), false, rng);
  assert.equal(t.seconds, 3);
  t.reached();
  assert.equal(t.seconds, 2.5);
  t.reached();
  assert.equal(t.seconds, 2.5, 'never under 2.5 s');
  t.held(2.5, false);
  t.held(2.5, true);
  assert.equal(t.seconds, 2.5, 'one clean hold: not yet');
  t.held(2.5, true);
  assert.equal(t.seconds, 3, 'two clean holds in a row: half a second more');
  for (let i = 0; i < 10; i++) t.held(t.seconds, true);
  assert.equal(t.seconds, 4, 'at most the band\'s + 1');
  assert.equal(t.longest, 4);
  const silent = new RustTempo(knobsFor('dagnacht', 4), true, rng);
  assert.equal(silent.seconds, 4, 'read silently: half a second less (4.5 → 4)');
});

test('run 7: temptations come at seeded moments, never in the first 1.1 s, one per share of the hold', () => {
  for (let seed = 1; seed <= 50; seed++) {
    for (const band of [1, 3, 5, 6]) {
      const k = knobsFor('dagnacht', band);
      const t = new RustTempo(k, false, newPlay('t', seed, 1).fork('rust').rng);
      const at = t.temptsFor(t.seconds);
      assert.equal(at.length, k.tempts);
      assert.ok(at.every((x) => x >= 1.1 && x <= t.seconds - 0.5 + 1e-9), `band ${band} seed ${seed}: ${at}`);
      for (let i = 1; i < at.length; i++) assert.ok(at[i] > at[i - 1], 'in order');
    }
  }
  const a = new RustTempo(knobsFor('dagnacht', 5), false, newPlay('t', 9, 1).fork('rust').rng).temptsFor(5);
  const b = new RustTempo(knobsFor('dagnacht', 5), false, newPlay('t', 9, 1).fork('rust').rng).temptsFor(5);
  assert.deepEqual(a, b, 'a replayed play: the same moments');
});

/* ---------------------------------------------------------- run 7: go ---- */

/** A go moment over a real run (the flip is the last of five): the four before it right. */
function goRig(waitS = 9): { core: GoCore; run: DagnachtRun; calls: boolean[] } {
  const run = new DagnachtRun(5);
  for (let i = 0; i < 4; i++) run.choose(true);
  const calls: boolean[] = [];
  const core = new GoCore({ waitS }, (goed) => { calls.push(goed); run.choose(goed); });
  return { core, run, calls };
}
/** He walks from (0, 0) along +x at `v` m/s for `s` seconds from `t0` (60 frames a second);
 *  the animals stand 8 m off on −x. Returns the first verdict and when. */
function walk(core: GoCore, t0: number, s: number, v: number, dir = 1, running = false, from = 0): { verdict: string | null; at: number; x: number } {
  const fam = { x: -8, z: 0 };
  let x = from;
  for (let i = 1; i <= Math.round(s * 60); i++) {
    x += (dir * v) / 60;
    const r = core.tick(t0 + i / 60, { x, z: 0, speed: v, running }, fam);
    if (r) return { verdict: r, at: t0 + i / 60, x };
  }
  return { verdict: null, at: t0 + s, x };
}

test('go: nothing is judged while the line is read; walking 4 m away at a walk is choose(true), once', () => {
  const { core, run, calls } = goRig();
  assert.equal(core.tick(1, { x: 9, z: 0, speed: 1, running: false }, { x: -8, z: 0 }), null, 'the line is still read');
  core.begin(2, { x: 0, z: 0 }, { x: -8, z: 0 });
  const w = walk(core, 2, 6, 1.6);
  assert.equal(w.verdict, 'right');
  assert.ok(Math.abs(w.x - GO_AWAY_M) < 0.05, `right as he is 4 m away (${w.x.toFixed(2)})`);
  assert.equal(core.tick(99, { x: 0, z: 0, speed: 0, running: false }, { x: -8, z: 0 }), null, 'done stays done');
  assert.deepEqual(calls, [true]);
  assert.ok(run.finished);
  assert.deepEqual(run.summary(), { trials: 5, correct: 5, impulses: 0 });
});

test('go: standing still for the wait is the old rule ("Blijf staan"): choose(false), the moment comes back', () => {
  const { core, run, calls } = goRig(6);
  core.begin(0, { x: 0, z: 0 }, { x: -8, z: 0 });
  let t = 0, r: string | null = null;
  while (!r && t < 20) { t += 1 / 60; r = core.tick(t, { x: 0, z: 0, speed: 0, running: false }, { x: -8, z: 0 }); }
  assert.equal(r, 'wrong');
  assert.ok(Math.abs(t - 6) < 0.05, `after the level's wait (${t.toFixed(2)} s)`);
  assert.equal(core.phase, 'react');
  assert.equal(core.tick(t + 1, { x: 30, z: 0, speed: 1, running: false }, { x: -8, z: 0 }), null, 'nothing while the animals react');
  core.again();
  core.begin(t + 2, { x: 0, z: 0 }, { x: -8, z: 0 });
  assert.equal(walk(core, t + 2, 5, 1.4).verdict, 'right', 'then he walks away');
  assert.deepEqual(calls, [false, true]);
  assert.deepEqual(run.summary(), { trials: 5, correct: 4, impulses: 1 }, 'marked once: the encounter is not never-wronged');
});

test('go: shuffling on the spot counts as standing, turning round does not; a walk that stops halfway runs the clock on', () => {
  const { core } = goRig(5);
  core.begin(0, { x: 0, z: 0 }, { x: -8, z: 0 });
  // 3 s shuffling within his spot at a walking pace, then 2 m away, then he stops
  let t = 0;
  for (; t < 3; t += 1 / 60) assert.equal(core.tick(t, { x: 0.5 * Math.sin(t * 4), z: 0, speed: 1, running: false }, { x: -8, z: 0 }), null);
  const w = walk(core, t, 1.3, 1.5, 1, false, 0);
  assert.equal(w.verdict, null, 'walking: no verdict yet');
  let r: string | null = null, s = w.at;
  while (!r && s < w.at + 10) { s += 1 / 60; r = core.tick(s, { x: w.x, z: 0, speed: 0, running: false }, { x: -8, z: 0 }); }
  assert.equal(r, 'wrong');
  // (3 s on the spot and the first metre of his walk, ~0.7 s, were standing: 5 − 3.7 s)
  assert.ok(s - w.at < 1.6 && s - w.at > 1.1, `the 3 s on the spot counted: wrong ~1.3 s after he stopped (${(s - w.at).toFixed(2)})`);
});

test('go: walking 2.5 m toward the animals is wrong at once; sideways is neither', () => {
  const a = goRig();
  a.core.begin(0, { x: 0, z: 0 }, { x: -8, z: 0 });
  const w = walk(a.core, 0, 3, 1.4, -1);
  assert.equal(w.verdict, 'wrong');
  assert.ok(Math.abs(w.x + 2.5) < 0.05, `2.5 m closer (${w.x.toFixed(2)})`);
  const b = goRig(30);
  b.core.begin(0, { x: 0, z: 0 }, { x: -8, z: 0 });
  let r: string | null = null;
  for (let i = 1; i <= 180 && !r; i++) r = b.core.tick(i / 60, { x: 0, z: (i / 60) * 1.2, speed: 1.2, running: false }, { x: -8, z: 0 });
  assert.equal(r, null, '3.6 m sideways: not yet 4 m, never closer');
});

test('go: running counts as neither — no step of it is judged, no second of it is standing', () => {
  const { core, calls } = goRig(2);
  core.begin(0, { x: 0, z: 0 }, { x: -8, z: 0 });
  assert.equal(walk(core, 0, 4, 3.5, 1, true).verdict, null, 'running 14 m away: nothing yet');
  assert.equal(walk(core, 4, 4, 3.5, -1, true, 14).verdict, null, 'running right back at them: nothing either');
  // he slows to a walk where he is (back at the start: not away) and then stands: the 8 s of running were no standing
  let r: string | null = null, t = 8;
  while (!r && t < 14) { t += 1 / 60; r = core.tick(t, { x: 0, z: 0, speed: 0, running: false }, { x: -8, z: 0 }); }
  assert.equal(r, 'wrong');
  assert.ok(t - 8 > 1.9, `only the standing counted (${(t - 8).toFixed(2)} s)`);
  assert.deepEqual(calls, [false]);
});

test('go: away but closer is not away — he must end farther from the animals than he stood', () => {
  const { core } = goRig(30);
  core.begin(0, { x: 0, z: 0 }, { x: -8, z: 0 });
  // 4.5 m round them on a circle of radius 8: the same distance, never farther
  let r: string | null = null;
  for (let i = 1; i <= 240 && !r; i++) {
    const a = (i / 240) * 0.6;
    r = core.tick(i / 60, { x: -8 + 8 * Math.cos(a), z: 8 * Math.sin(a), speed: 1, running: false }, { x: -8, z: 0 });
  }
  assert.equal(r, null);
});

test('go: a card and the feet log the same summary for the same answers', () => {
  const { core, run } = goRig(4);
  core.begin(0, { x: 0, z: 0 }, { x: -8, z: 0 });
  let t = 0, r: string | null = null;
  while (!r) { t += 1 / 60; r = core.tick(t, { x: 0, z: 0, speed: 0, running: false }, { x: -8, z: 0 }); }
  core.again();
  core.begin(t, { x: 0, z: 0 }, { x: -8, z: 0 });
  walk(core, t, 5, 1.4);
  const cards = new DagnachtRun(5);
  for (const g of [true, true, true, true, false, true]) cards.choose(g);
  assert.deepEqual(run.summary(), cards.summary());
});

test('go: away is counted from where he first stood — after walking up to them, the way back to there is not yet away', () => {
  const { core, calls } = goRig(30);
  core.begin(0, { x: 0, z: 0 }, { x: -8, z: 0 });
  const w = walk(core, 0, 3, 1.4, -1);
  assert.equal(w.verdict, 'wrong', 'he walked 2.5 m up to them');
  core.again();
  core.begin(w.at + 3, { x: w.x, z: 0 }, { x: -8, z: 0 });
  assert.equal(core.tick(w.at + 3.1, { x: w.x, z: 0, speed: 0, running: false }, { x: -8, z: 0 }), null, 'no second wrong at once where he stands');
  const back = walk(core, w.at + 3.1, 8, 1.4, 1, false, w.x);
  assert.equal(back.verdict, 'right');
  assert.ok(Math.abs(back.x - GO_AWAY_M) < 0.05, `right 4 m from the hide, not 4 m from where he turned (${back.x.toFixed(2)})`);
  assert.deepEqual(calls, [false, true]);
});

test('go: turning round on the spot (to walk away) is no standing — however long it takes him', () => {
  const { core } = goRig(5);
  core.begin(0, { x: 0, z: 0 }, { x: -8, z: 0 });
  for (let t = 1 / 60; t < 9; t += 1 / 60) assert.equal(core.tick(t, { x: 0, z: 0, speed: 0, running: false, turning: true }, { x: -8, z: 0 }), null);
  assert.equal(core.idle, 0);
  assert.equal(walk(core, 9, 4, 1.4).verdict, 'right');
});

test('go: pushing on against a bush (a walk key held, going nowhere) is no standing either', () => {
  const { core } = goRig(5);
  core.begin(0, { x: 0, z: 0 }, { x: -8, z: 0 });
  for (let t = 1 / 60; t < 9; t += 1 / 60) assert.equal(core.tick(t, { x: 2, z: 0, speed: 0, running: false, trying: true }, { x: -8, z: 0 }), null);
  let r: string | null = null, t = 9;
  while (!r && t < 20) { t += 1 / 60; r = core.tick(t, { x: 2, z: 0, speed: 0, running: false }, { x: -8, z: 0 }); }
  assert.equal(r, 'wrong', 'let go and stood: the wait counts again');
  assert.ok(t - 9 > 4.9, `only the standing counted (${(t - 9).toFixed(2)} s)`);
});

test('go (run 7, the ecoduct): with `off` — he stands ON their way — going is a step off it, never a walk along it; standing is still the old rule', () => {
  // their way runs along the z axis through where he stands (0, 0); the animals wait 6 m up it
  const way = [{ x: 0, z: -10 }, { x: 0, z: 10 }];
  const fam = { x: 0, z: 6 };
  const mk = (): { core: GoCore; calls: boolean[] } => {
    const calls: boolean[] = [];
    return { core: new GoCore({ waitS: 30, off: way }, (goed) => { calls.push(goed); }), calls };
  };
  // along their way, away from them (−z): 5 m, still on it — no answer
  const a = mk();
  a.core.begin(0, { x: 0, z: 0 }, fam);
  let r: string | null = null;
  for (let i = 1; i <= 300 && !r; i++) r = a.core.tick(i / 60, { x: 0, z: -i / 60, speed: 1, running: false }, fam);
  assert.equal(r, null, 'walking on along their way is not stepping aside');
  // aside (+x): right once he is 4 m from where he stood and off their way
  const b = mk();
  b.core.begin(0, { x: 0, z: 0 }, fam);
  let at = 0;
  for (let i = 1; i <= 300 && !r; i++) { r = b.core.tick(i / 60, { x: i / 60, z: 0, speed: 1, running: false }, fam); at = i / 60; }
  assert.equal(r, 'right');
  assert.ok(Math.abs(at - GO_AWAY_M) < 0.05, `right at ${at.toFixed(2)} m aside`);
  assert.deepEqual(b.calls, [true]);
  // he walked aside before the line was read (begin comes late): still counted from where he
  // stood the first time — off their way measured from there, not from where he is now
  const c = mk();
  c.core.begin(0, { x: 0, z: 0 }, fam);
  assert.equal(c.core.tick(0.1, { x: 4.6, z: 0.5, speed: 0, running: false }, fam), 'right');
  // standing still on their way: the old rule, as before
  const d = new GoCore({ waitS: 5, off: way }, () => {});
  d.begin(0, { x: 0, z: 0 }, fam);
  let v: string | null = null;
  for (let i = 1; i <= 400 && !v; i++) v = d.tick(i / 60, { x: 0, z: 0, speed: 0, running: false }, fam);
  assert.equal(v, 'wrong');
  assert.equal(d.why, 'stay');
});
