/**
 * roep.parity.test.ts — de seeded construct-pariteit + staircase-unit test voor de
 * perceptie-slice "Ken je roep" (W6.4a). Run:
 *   node --experimental-strip-types --test src/engines/roep.parity.test.ts
 *
 * Pariteit is BY CONSTRUCTION: zowel `render2d/RoepView` (2D) als de latere
 * diegetische 3D-twin (W6.4b) draaien exact dezelfde pure `RoepRun` + `buildRoepTrial`.
 * Deze test pint de bevroren scoreregel — de contractregel die beide views moeten
 * respecteren — zodat de views nooit stil uit elkaar lopen in WÁT ze scoren:
 *   trials  = het aantal ronden (elke ronde telt precies één keer),
 *   correct = het aantal ronden waarin de juiste vogel is gekozen.
 * De staircase over het afleider-aantal (goed → +1, mis → −1, geklemd op [1, pool-1])
 * is deterministisch onder een seeded rng, dus de kern + een onafhankelijke referentie
 * verbruiken dezelfde rondes en moeten dezelfde samenvatting geven.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRoepTrial, RoepRun, ROEP_VOGELS, ROEP_COPY, type RoepTrial,
} from './roep.ts';

/** Seeded deterministische rng (mulberry32), net als de andere engine-tests. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Strategy = (round: { target: string; opties: string[] }) => string;
const ALWAYS_RIGHT: Strategy = (r) => r.target;
const ALWAYS_WRONG: Strategy = (r) => r.opties.find((o) => o !== r.target) ?? r.target;

/** Drive de GEDEELDE kern zoals beide views: next() → strategy kiest → answer(). */
function drive(trial: RoepTrial, seed: number, strat: Strategy): {
  summary: { trials?: number; correct?: number };
  rounds: { target: string; chosen: string }[];
} {
  const run = new RoepRun(trial, rng(seed));
  const rounds: { target: string; chosen: string }[] = [];
  for (let r = run.next(); r !== null; r = run.next()) {
    const chosen = strat(r);
    rounds.push({ target: r.target, chosen });
    run.answer(chosen);
  }
  return { summary: run.summary(), rounds };
}

/** Onafhankelijke referentie-scorer voor de bevroren regel (geen RoepRun-interne kennis). */
function reference(rounds: { target: string; chosen: string }[], ronden: number): { trials: number; correct: number } {
  let correct = 0;
  for (const { target, chosen } of rounds) if (target === chosen) correct += 1;
  return { trials: ronden, correct };
}

test('perfect spel → correct == ronden, en matcht de referentie', () => {
  const trial = buildRoepTrial({ ronden: 6 });
  const { summary, rounds } = drive(trial, 123, ALWAYS_RIGHT);
  assert.equal(summary.trials, 6);
  assert.equal(summary.correct, 6);
  assert.equal(rounds.length, 6);
  assert.deepEqual(summary, reference(rounds, 6));
});

test('alles mis → correct 0 (nooit game-over, beat loopt uit), matcht de referentie', () => {
  const trial = buildRoepTrial({ ronden: 5 });
  const { summary, rounds } = drive(trial, 77, ALWAYS_WRONG);
  assert.equal(summary.trials, 5);
  assert.equal(summary.correct, 0);
  assert.equal(rounds.length, 5, 'alle ronden gespeeld, geen vroegtijdig einde');
  assert.deepEqual(summary, reference(rounds, 5));
});

test('gemengd spel → correct telt exact de juiste ronden, matcht de referentie', () => {
  const trial = buildRoepTrial({ ronden: 6 });
  // om-en-om goed/fout, deterministisch onder de seed
  let i = 0;
  const mixed: Strategy = (r) => (i++ % 2 === 0 ? r.target : (r.opties.find((o) => o !== r.target) ?? r.target));
  const run = new RoepRun(trial, rng(9));
  const rounds: { target: string; chosen: string }[] = [];
  for (let r = run.next(); r !== null; r = run.next()) {
    const chosen = mixed(r);
    rounds.push({ target: r.target, chosen });
    run.answer(chosen);
  }
  assert.deepEqual(run.summary(), reference(rounds, 6));
  assert.equal(run.summary().correct, 3);
});

test('deterministisch — zelfde seed + strategie geeft dezelfde samenvatting én rondes', () => {
  const trial = buildRoepTrial({ ronden: 5 });
  const a = drive(trial, 42, ALWAYS_RIGHT);
  const b = drive(trial, 42, ALWAYS_RIGHT);
  assert.deepEqual(a.summary, b.summary);
  assert.deepEqual(a.rounds, b.rounds);
});

test('elke rij bevat het doel + het juiste aantal afleiders, allemaal uniek en uit de pool', () => {
  const trial = buildRoepTrial({ ronden: 8, afleiders: 1 });
  const run = new RoepRun(trial, rng(5));
  const poolIds = new Set(ROEP_VOGELS.map((v) => v.id));
  let r = run.next();
  let ronde = 0;
  while (r !== null) {
    assert.ok(r.opties.includes(r.target), 'doel zit in de rij');
    assert.equal(new Set(r.opties).size, r.opties.length, 'geen dubbele opties');
    for (const o of r.opties) assert.ok(poolIds.has(o), `optie ${o} komt uit de pool`);
    assert.ok(r.opties.length >= 2 && r.opties.length <= ROEP_VOGELS.length);
    run.answer(r.target); // altijd goed → afleiders lopen op
    ronde += 1;
    r = run.next();
  }
  assert.equal(ronde, 8);
});

test('staircase: goed maakt moeilijker (+1 afleider), mis makkelijker (−1), geklemd', () => {
  const r2 = new RoepRun(buildRoepTrial({ ronden: 8, afleiders: 1 }), rng(1));
  assert.equal(r2.afleiders, 1, 'start op 1');
  const round1 = r2.next()!;
  r2.answer(round1.target);            // goed → +1
  assert.equal(r2.afleiders, 2);
  const round2 = r2.next()!;
  r2.answer(round2.opties.find((o) => o !== round2.target)!); // mis → −1
  assert.equal(r2.afleiders, 1);
  const round3 = r2.next()!;
  r2.answer(round3.opties.find((o) => o !== round3.target)!); // mis → klem op 1
  assert.equal(r2.afleiders, 1, 'nooit onder 1 afleider');
});

test('staircase klemt bovenaan op pool-1 en telt reversals', () => {
  const trial = buildRoepTrial({ ronden: 8, afleiders: 1 });
  const run = new RoepRun(trial, rng(3));
  // vier keer goed achter elkaar: 1→2→3→4→5, en dan klem op 5 (pool 6 → max 5)
  for (let k = 0; k < 6; k++) { const r = run.next(); if (!r) break; run.answer(r.target); }
  assert.equal(run.afleiders, ROEP_VOGELS.length - 1, 'klem op pool-1');
  assert.equal(run.reversals, 0, 'alleen omhoog → geen omkering');
});

test('buildRoepTrial klemt ronden 3..8 en afleiders 1..pool-1', () => {
  assert.equal(buildRoepTrial({ ronden: 1 }).ronden, 3, 'ondergrens 3 ronden');
  assert.equal(buildRoepTrial({ ronden: 99 }).ronden, 8, 'bovengrens 8 ronden');
  assert.equal(buildRoepTrial({ afleiders: 0 }).startAfleiders, 1, 'minstens 1 afleider');
  assert.equal(buildRoepTrial({ afleiders: 99 }).startAfleiders, ROEP_VOGELS.length - 1, 'max pool-1');
  assert.ok(buildRoepTrial().vogels.length >= 4, 'pool is minstens 4 vogels');
});

test('finished pas na alle ronden; summary blijft stabiel', () => {
  const trial = buildRoepTrial({ ronden: 4 });
  const run = new RoepRun(trial, rng(8));
  assert.equal(run.finished, false);
  for (let r = run.next(); r !== null; r = run.next()) run.answer(r.target);
  assert.equal(run.finished, true);
  assert.deepEqual(run.summary(), run.summary());
  assert.equal(run.next(), null, 'geen ronde meer na afloop');
});

test('pool + copy zijn niet-leeg en kindvriendelijk kort (sanity)', () => {
  assert.ok(ROEP_VOGELS.length >= 4);
  for (const v of ROEP_VOGELS) { assert.ok(v.naam.length > 0); assert.ok(v.roep.length > 0); }
  assert.ok(ROEP_COPY.instructie.length > 0);
});
