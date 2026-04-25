import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rollingMean,
  huidigStatus,
  iivTrend,
  incongruentAccuracyTrend,
  falseAlarmRate,
  switchCostTrend,
  weekFrequency,
  timeOfDayHeatmap,
  platteSessies,
} from './analytics.js';

const DAG_MS = 24 * 60 * 60 * 1000;

function isoMinus(days, nu = Date.now()) {
  return new Date(nu - days * DAG_MS).toISOString();
}

function spanSessie({ datum, maxSpan = 4, accuracy = 0.9, iivCV = 0.25, trialsN = 12 } = {}) {
  return {
    date: datum,
    level: maxSpan,
    summary: { maxSpan, accuracy, iivCV, trialsN, meanRT: 800, sdRT: 200 },
  };
}

// --- rollingMean ---

test('rollingMean: lege input → []', () => {
  assert.deepEqual(rollingMean([], 'maxSpan', 30), []);
});

test('rollingMean: 30d-window neemt alle recente sessies mee', () => {
  const sessions = [
    spanSessie({ datum: isoMinus(20), maxSpan: 3 }),
    spanSessie({ datum: isoMinus(10), maxSpan: 5 }),
    spanSessie({ datum: isoMinus(0),  maxSpan: 4 }),
  ];
  const m = rollingMean(sessions, 'maxSpan', 30);
  assert.equal(m.length, 3);
  assert.equal(m[0], 3);
  assert.equal(m[1], 4);
  assert.equal(m[2], 4);
});

test('rollingMean: oudere sessies vallen buiten 7d-window', () => {
  const sessions = [
    spanSessie({ datum: isoMinus(40), maxSpan: 8 }),
    spanSessie({ datum: isoMinus(2),  maxSpan: 3 }),
  ];
  const m = rollingMean(sessions, 'maxSpan', 7);
  assert.equal(m[0], 8); // window omvat sessie 0
  assert.equal(m[1], 3); // alleen sessie 1 valt binnen window vanaf moment 1
});

// --- huidigStatus ---

test('huidigStatus: laatste sessie boven band → "boven"', () => {
  const sessions = [
    spanSessie({ datum: isoMinus(20), maxSpan: 3 }),
    spanSessie({ datum: isoMinus(10), maxSpan: 3 }),
    spanSessie({ datum: isoMinus(0),  maxSpan: 5 }),
  ];
  assert.equal(huidigStatus(sessions, 'maxSpan'), 'boven');
});

test('huidigStatus: laatste sessie op band → "op"', () => {
  const sessions = [
    spanSessie({ datum: isoMinus(15), maxSpan: 4 }),
    spanSessie({ datum: isoMinus(7),  maxSpan: 4 }),
    spanSessie({ datum: isoMinus(0),  maxSpan: 4 }),
  ];
  assert.equal(huidigStatus(sessions, 'maxSpan'), 'op');
});

test('huidigStatus: <3 sessies → null', () => {
  assert.equal(huidigStatus([spanSessie({ datum: isoMinus(0) })], 'maxSpan'), null);
});

// --- iivTrend ---

test('iivTrend: filtert op geldige sessies en geeft iivCV per sessie', () => {
  const sessions = [
    spanSessie({ datum: isoMinus(5), iivCV: 0.30 }),
    spanSessie({ datum: isoMinus(2), iivCV: 0.25 }),
  ];
  const trend = iivTrend(sessions, 'simon');
  // Eerste sessie ooit telt niet (isReliableSession isFirstEver=false in onze
  // analytics-call, maar progressie.js heeft die check; we vertrouwen op die filter).
  // In analytics gebruiken we isReliableSession met isFirstEver=false, dus alle
  // tellen mee mits trialsN >= 6.
  assert.equal(trend.length, 2);
  assert.equal(trend[0].iivCV, 0.30);
  assert.equal(trend[1].iivCV, 0.25);
});

test('iivTrend: hoge iivCV (>0.6) wordt uitgefilterd via isReliableSession', () => {
  const sessions = [
    spanSessie({ datum: isoMinus(5), iivCV: 0.30 }),
    spanSessie({ datum: isoMinus(2), iivCV: 0.80 }), // verkennend
  ];
  const trend = iivTrend(sessions, 'simon');
  assert.equal(trend.length, 1);
  assert.equal(trend[0].iivCV, 0.30);
});

// --- incongruentAccuracyTrend ---

test('incongruentAccuracyTrend: gebruikt trials[] om incongruent accuracy te bepalen', () => {
  const sessions = [
    {
      date: isoMinus(0),
      summary: { accuracy: 0.75, trialsN: 32 },
      trials: [
        { i: 1, mode: 'mixed',        correct: true },
        { i: 2, mode: 'mixed',        correct: true },
        { i: 3, mode: 'incongruent',  correct: false },
        { i: 4, mode: 'incongruent',  correct: true },
      ],
    },
  ];
  const t = incongruentAccuracyTrend(sessions);
  assert.equal(t.length, 1);
  assert.equal(t[0].accuracy, 0.5);
  assert.equal(t[0].exact, true);
});

test('incongruentAccuracyTrend: zonder trials[] valt terug op summary.accuracy met exact=false', () => {
  const sessions = [
    { date: isoMinus(0), summary: { accuracy: 0.85, trialsN: 32 } },
  ];
  const t = incongruentAccuracyTrend(sessions);
  assert.equal(t.length, 1);
  assert.equal(t[0].accuracy, 0.85);
  assert.equal(t[0].exact, false);
});

// --- falseAlarmRate ---

test('falseAlarmRate: berekent rate uit summary', () => {
  const sessions = [
    { date: isoMinus(2), summary: { falseAlarmsTotal: 4, trialsN: 16 } },
    { date: isoMinus(0), summary: { falseAlarmsTotal: 2, trialsN: 16 } },
  ];
  const t = falseAlarmRate(sessions);
  assert.equal(t.length, 2);
  assert.equal(t[0].rate, 0.25);
  assert.equal(t[1].rate, 0.125);
});

// --- switchCostTrend ---

test('switchCostTrend: filtert sessies zonder switchCost', () => {
  const sessions = [
    { date: isoMinus(2), summary: { switchCost: 320 } },
    { date: isoMinus(1), summary: { switchCost: 0 } },     // geen switch-blok
    { date: isoMinus(0), summary: { switchCost: 240 } },
  ];
  const t = switchCostTrend(sessions);
  assert.equal(t.length, 2);
  assert.equal(t[0].switchCost, 320);
  assert.equal(t[1].switchCost, 240);
});

// --- weekFrequency ---

test('weekFrequency: telt sessies per week voor laatste N weken', () => {
  const nu = Date.now();
  const sessions = [
    { date: isoMinus(40, nu) },
    { date: isoMinus(8, nu) },
    { date: isoMinus(2, nu) },
    { date: isoMinus(1, nu) },
  ];
  const wf = weekFrequency(sessions, 4, nu);
  assert.equal(wf.length, 4);
  // wf[3] = laatste week = 0..-7d → bevat sessies op -2 en -1 (2 stuks)
  assert.equal(wf[3].count, 2);
  // wf[2] = -7 .. -14 → bevat -8 (1 stuk)
  assert.equal(wf[2].count, 1);
});

// --- timeOfDayHeatmap ---

test('timeOfDayHeatmap: bucket per uur per spel', () => {
  const exercises = {
    simon: { sessions: [
      { date: '2026-04-25T08:30:00Z' },
      { date: '2026-04-25T09:15:00Z' },
    ] },
    corsi: { sessions: [
      { date: '2026-04-25T16:00:00Z' },
    ] },
  };
  const heat = timeOfDayHeatmap(exercises);
  assert.equal(heat.simon.length, 24);
  // Twee sessies in lokale tijdzone — exacte uur hangt van timezone af, maar
  // som over alle uren = aantal sessies.
  assert.equal(heat.simon.reduce((a, b) => a + b, 0), 2);
  assert.equal(heat.corsi.reduce((a, b) => a + b, 0), 1);
});

// --- platteSessies ---

test('platteSessies: voegt spelId toe en sorteert chronologisch', () => {
  const ex = {
    simon: { sessions: [{ date: isoMinus(5), id: 'a' }, { date: isoMinus(1), id: 'b' }] },
    corsi: { sessions: [{ date: isoMinus(3), id: 'c' }] },
  };
  const flat = platteSessies(ex);
  assert.equal(flat.length, 3);
  assert.equal(flat[0].id, 'a');
  assert.equal(flat[1].id, 'c');
  assert.equal(flat[2].id, 'b');
  assert.equal(flat[0].spelId, 'simon');
  assert.equal(flat[1].spelId, 'corsi');
});
