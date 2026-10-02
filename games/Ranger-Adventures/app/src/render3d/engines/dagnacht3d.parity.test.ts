/**
 * dagnacht3d.parity.test.ts — construct parity for Rustkracht (run 7 `adaptive`, design
 * §5.4, §5.7): the 2D floor (`render2d/DangerView`), the classic 3D stage
 * (`render3d/engines/dagnacht3d`) and the world's choices (`adventure/beats/choice`) build
 * the trial the same way — `buildDagnachtTrial(skin, { jargon, reducedMotion, ...knobs },
 * play.fork('dagnacht').rng)` — and score it with the same `DagnachtRun`: the same seed gives
 * the same ORDER of the calm moments, and the same answers give the same summary
 * `{ trials: encounters, correct: never-wronged, impulses: wrong choices }` (a card in 2D, a
 * card or a body moment in the world: the trial and its scoring are one). Pinned: (1) each
 * view's source builds it so, never from `Math.random`; (2) for seeds 1..20 and scripted
 * players (perfect, one wrong, two wrongs on one moment, wrongs on two) a 2D-built and a
 * world-built run agree; (3) both match an INDEPENDENT reference; (4) the plan's rules (a
 * flip never first, kept when the pool has one, two only from band 4).
 *   node --experimental-strip-types --test src/render3d/engines/dagnacht3d.parity.test.ts
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildDagnachtTrial, DagnachtRun, rustOrder, type Encounter, type RustPlanSlot } from '../../engines/dagnacht.ts';
import { knobsFor, type BeatSummary } from '../../core/skill.ts';
import { newPlay } from '../../core/play.ts';
import type { Skin } from '../../content/types.ts';
import { AREA_VELUWE } from '../../content/veluwe.ts';

const opt = (goedFirst: boolean): Encounter['opties'] =>
  goedFirst ? [{ label: 'goed', goed: true }, { label: 'fout', goed: false }] : [{ label: 'fout', goed: false }, { label: 'goed', goed: true }];
/** A frisling-like skin with slots (as the frisling lane plans it): big · weg ×2 · thuis ×2 (one a flip). */
const ENCS: Encounter[] = [
  { id: 'aaien', subject: 'frisling', vraag: 'a', opties: opt(false), slot: 'big' },
  { id: 'dragen', subject: 'frisling', vraag: 'b', opties: opt(true), slot: 'weg' },
  { id: 'voeren', subject: 'zwijn-honger', vraag: 'c', opties: opt(false), slot: 'weg' },
  { id: 'zeug', subject: 'wildzwijn', vraag: 'd', opties: opt(true), slot: 'thuis' },
  { id: 'pad', subject: 'rotte', vraag: 'e', opties: opt(false), slot: 'thuis', flip: true },
];
const PLAN: RustPlanSlot[] = [{ slot: 'big' }, { slot: 'weg' }, { slot: 'thuis' }];
const SKIN = { encounters: ENCS, rustPlan: PLAN, regels: ['Niet voeren'] } as unknown as Skin;

/** As a view builds it: its own play over the seed, the level's knobs. */
function build(seed: number, band = 1, skin: Skin = SKIN): Encounter[] {
  return buildDagnachtTrial(skin, { jargon: false, reducedMotion: false, ...knobsFor('dagnacht', band) }, newPlay('frisling', seed, 1).fork('dagnacht').rng).encounters;
}

/** A scripted player: `wrongs[i]` wrong choices on the i-th moment, then the right one. */
function drive(n: number, wrongs: readonly number[]): BeatSummary {
  const run = new DagnachtRun(n);
  while (!run.finished) {
    for (let w = 0; w < (wrongs[run.index] ?? 0); w++) run.choose(false);
    run.choose(true);
  }
  return run.summary();
}

/** INDEPENDENT reference: trials = moments, correct = moments never wronged, impulses = wrongs. */
function reference(n: number, wrongs: readonly number[]): BeatSummary {
  const ws = Array.from({ length: n }, (_, i) => wrongs[i] ?? 0);
  return { trials: n, correct: ws.filter((w) => w === 0).length, impulses: ws.reduce((a, b) => a + b, 0) };
}

const SCRIPTS: Record<string, number[]> = {
  perfect: [],
  'one wrong': [0, 1],
  'two wrongs on one moment': [2],
  'wrongs on two moments': [1, 0, 0, 1],
};

test('each view builds the order from the knobs and the play, and seats the answers by the play (never Math.random)', () => {
  const src = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');
  for (const [name, s] of [
    ['2D DangerView', src('../../render2d/DangerView.ts')],
    ['3D dagnacht3d', src('./dagnacht3d.ts')],
    ['world choice', src('../adventure/beats/choice.ts')],
  ] as const) {
    assert.match(s, /knobs\('dagnacht'\)/, `${name}: the level's knobs`);
    assert.match(s, /buildDagnachtTrial\([^;]*fork\('dagnacht'\)\.rng/s, `${name}: the trial from the play's fork`);
    assert.match(s, /fork\('knoppen'\)/, `${name}: the answers' sides from the play`);
    assert.doesNotMatch(s, /Math\.random/, `${name}: no Math.random`);
  }
});

test('seeds 1..20 × scripts: the 2D-built and the world-built trial play the same order and score the same', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const a = build(seed), b = build(seed);
    assert.deepEqual(a.map((e) => e.id), b.map((e) => e.id), `seed ${seed}: the same order`);
    for (const [name, wrongs] of Object.entries(SCRIPTS)) {
      const s = drive(a.length, wrongs);
      assert.deepEqual(s, drive(b.length, wrongs), `seed ${seed} ${name}: 2D vs world`);
      assert.deepEqual(s, reference(a.length, wrongs), `seed ${seed} ${name}: reference`);
    }
  }
});

test('the plan: slots in story order, shuffled inside, a flip never first; several orders come', () => {
  const orders = new Set<string>();
  for (let seed = 1; seed <= 60; seed++) {
    const ids = build(seed).map((e) => e.id);
    orders.add(ids.join(','));
    assert.equal(ids[0], 'aaien', 'the big first (its own slot)');
    assert.deepEqual(ids.slice(1, 3).sort(), ['dragen', 'voeren']);
    assert.deepEqual(ids.slice(3).sort(), ['pad', 'zeug']);
  }
  assert.equal(orders.size, 4, `all four orders come (${[...orders].join(' | ')})`);
});

test('a flip is never first, even when its slot opens the story', () => {
  const skin = { encounters: ENCS, rustPlan: [{ slot: 'thuis' }, { slot: 'big' }, { slot: 'weg' }] } as unknown as Skin;
  for (let seed = 1; seed <= 40; seed++) assert.notEqual(build(seed, 1, skin)[0].id, 'pad', `seed ${seed}`);
});

test('a slot that draws fewer keeps the flip when the pool has one; two flips only from band 4', () => {
  const rng = (): number => 0.99; // a draw that leaves the flip last (dropped by pick)
  const one = rustOrder(ENCS, [{ slot: 'big' }, { slot: 'thuis', pick: 1 }], rng);
  assert.ok(one.some((e) => e.flip), 'the trial keeps its flip');
  const two: Encounter[] = [...ENCS, { id: 'pad2', subject: 'rotte', vraag: 'f', opties: opt(true), slot: 'weg', flip: true }];
  const plan = [{ slot: 'big' }, { slot: 'weg' }, { slot: 'thuis' }];
  for (let seed = 1; seed <= 20; seed++) {
    const r = newPlay('t', seed, 1).fork('dagnacht').rng;
    assert.equal(rustOrder(two, plan, r, knobsFor('dagnacht', 1).flips).filter((e) => e.flip).length, 1, 'band 1: one flip');
    const r4 = newPlay('t', seed, 1).fork('dagnacht').rng;
    assert.equal(rustOrder(two, plan, r4, knobsFor('dagnacht', 4).flips).filter((e) => e.flip).length, 2, 'band 4: both');
  }
});

test('no plan, or no seed: content order, exactly as before (the six classic missions)', () => {
  const plain = { encounters: ENCS } as unknown as Skin;
  assert.deepEqual(build(5, 1, plain).map((e) => e.id), ENCS.map((e) => e.id));
  assert.deepEqual(buildDagnachtTrial(SKIN, { jargon: false }).encounters.map((e) => e.id), ENCS.map((e) => e.id));
});

test('content: every rustkracht skin with a plan opens on a calm moment (never a flip-only first slot)', () => {
  for (const m of AREA_VELUWE.missies) {
    for (const st of m.stappen) {
      const skin = st.skin as Skin;
      if (st.ef !== 'dagnacht' || !skin.rustPlan?.length) continue;
      const encs = skin.encounters as Encounter[];
      const first = encs.filter((e) => e.slot === skin.rustPlan![0].slot);
      assert.ok(first.some((e) => !e.flip), `${m.id}: the first slot has a calm moment`);
      for (const e of encs) assert.ok(!e.slot || skin.rustPlan!.some((p) => p.slot === e.slot), `${m.id}: ${e.id}'s slot is in the plan`);
    }
  }
});

test('the knappe woorden and slow-mo as before', () => {
  assert.equal(buildDagnachtTrial(SKIN, { slowmo: true, reducedMotion: true }).slowmo, false);
  assert.equal(buildDagnachtTrial(SKIN, { slowmo: true, reducedMotion: false }).slowmo, true);
  const knap = { encounters: [{ ...ENCS[0], vraagKnap: 'knap' }] } as unknown as Skin;
  assert.equal(buildDagnachtTrial(knap, { jargon: true }).encounters[0].vraag, 'knap');
});
