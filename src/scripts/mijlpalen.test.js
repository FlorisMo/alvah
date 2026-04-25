import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MIJLPALEN,
  isMilestoneReached,
  computeMilestones,
  evalueerNieuwBereikt,
} from './mijlpalen.js';

// Helpers — bouw een geldige sessie die isReliableSession passeert.
// Span-spellen (simon/corsi/zoeken) vereisen trialsN >= 6.
// Bivalent (day-night/wisselen) vereisen trialsN >= 24.
function spanSessie({ maxSpan = 3, accuracy = 0.9, level = null, trialsN = 12 } = {}) {
  return {
    date: new Date().toISOString(),
    level: level == null ? maxSpan : level,
    summary: { maxSpan, accuracy, trialsN, iivCV: 0.2, meanRT: 800 },
  };
}
function setSizeSessie({ maxSetSize = 8, accuracy = 0.9, trialsN = 12 } = {}) {
  return {
    date: new Date().toISOString(),
    level: maxSetSize,
    summary: { maxSetSize, accuracy, trialsN, iivCV: 0.2, meanRT: 1000 },
  };
}
function dnSessie({ accuracy = 0.85, level = 1, trialsN = 32 } = {}) {
  return {
    date: new Date().toISOString(),
    level,
    summary: { accuracy, trialsN, iivCV: 0.25, meanRT: 700 },
  };
}
function wisSessie({ accuracy = 0.85, level = 1, trialsN = 24, switchCost = null } = {}) {
  const summary = { accuracy, trialsN, iivCV: 0.25, meanRT: 900 };
  if (switchCost !== null) summary.switchCost = switchCost;
  return { date: new Date().toISOString(), level, summary };
}

// --- Schema-checks ---

test('MIJLPALEN: 5 spellen × 4 mijlpalen = 20 totaal', () => {
  const ids = Object.keys(MIJLPALEN);
  assert.deepEqual(ids.sort(), ['corsi', 'day-night', 'simon', 'wisselen', 'zoeken']);
  for (const id of ids) {
    assert.equal(MIJLPALEN[id].length, 4, `${id} heeft 4 mijlpalen`);
  }
});

test('MIJLPALEN: alle ids uniek', () => {
  const all = Object.values(MIJLPALEN).flat().map((m) => m.id);
  assert.equal(new Set(all).size, all.length);
});

// --- isMilestoneReached: span-spellen ---

test('Simon: 2 van laatste 3 sessies met span ≥ 3 → mijlpaal-1 bereikt', () => {
  const ex = { sessions: [spanSessie({ maxSpan: 2 }), spanSessie({ maxSpan: 3 }), spanSessie({ maxSpan: 4 })] };
  const m1 = MIJLPALEN.simon[0];
  assert.equal(isMilestoneReached(m1, ex, 'simon'), true);
});

test('Simon: 1 van laatste 3 met span ≥ 5 → mijlpaal-2 nog niet', () => {
  const ex = { sessions: [spanSessie({ maxSpan: 5 }), spanSessie({ maxSpan: 4 }), spanSessie({ maxSpan: 4 })] };
  const m2 = MIJLPALEN.simon[1];
  assert.equal(isMilestoneReached(m2, ex, 'simon'), false);
});

test('Corsi: lege sessions → niets bereikt', () => {
  const ex = { sessions: [] };
  for (const m of MIJLPALEN.corsi) {
    assert.equal(isMilestoneReached(m, ex, 'corsi'), false);
  }
});

test('Zoeken: 2 van laatste 3 met setSize 12 → mijlpaal-1 én -2 bereikt, niet -3', () => {
  const ex = { sessions: [
    setSizeSessie({ maxSetSize: 8 }),
    setSizeSessie({ maxSetSize: 12 }),
    setSizeSessie({ maxSetSize: 12 }),
  ] };
  assert.equal(isMilestoneReached(MIJLPALEN.zoeken[0], ex, 'zoeken'), true);
  assert.equal(isMilestoneReached(MIJLPALEN.zoeken[1], ex, 'zoeken'), true);
  assert.equal(isMilestoneReached(MIJLPALEN.zoeken[2], ex, 'zoeken'), false);
});

// --- isMilestoneReached: day-night accuracy ---

test('Day-Night: 2 van laatste 3 sessies met 80% → mijlpaal-1 (egel) bereikt', () => {
  const ex = { sessions: [dnSessie({ accuracy: 0.7 }), dnSessie({ accuracy: 0.85 }), dnSessie({ accuracy: 0.82 })] };
  assert.equal(isMilestoneReached(MIJLPALEN['day-night'][0], ex, 'day-night'), true);
});

test('Day-Night: accuracy-at-level vereist juist level + accuracy', () => {
  // 85% accuracy maar op level 1 → mijlpaal-2 niet bereikt
  const ex1 = { sessions: [dnSessie({ accuracy: 0.9, level: 1 }), dnSessie({ accuracy: 0.9, level: 1 })] };
  assert.equal(isMilestoneReached(MIJLPALEN['day-night'][1], ex1, 'day-night'), false);
  // 85% op level 2, twee keer → wel
  const ex2 = { sessions: [dnSessie({ accuracy: 0.7, level: 2 }), dnSessie({ accuracy: 0.86, level: 2 }), dnSessie({ accuracy: 0.88, level: 2 })] };
  assert.equal(isMilestoneReached(MIJLPALEN['day-night'][1], ex2, 'day-night'), true);
});

// --- isMilestoneReached: wisselen ---

test('Wisselen: currentLevel 3 → eerste 3 mijlpalen bereikt, switchCost-mijlpaal niet zonder data', () => {
  const ex = { currentLevel: 3, sessions: [] };
  assert.equal(isMilestoneReached(MIJLPALEN.wisselen[0], ex, 'wisselen'), true);
  assert.equal(isMilestoneReached(MIJLPALEN.wisselen[1], ex, 'wisselen'), true);
  assert.equal(isMilestoneReached(MIJLPALEN.wisselen[2], ex, 'wisselen'), true);
  assert.equal(isMilestoneReached(MIJLPALEN.wisselen[3], ex, 'wisselen'), false);
});

test('Wisselen: laatste sessie switchCost 180 → olifant-mijlpaal bereikt', () => {
  const ex = { currentLevel: 3, sessions: [
    wisSessie({ switchCost: 320 }),
    wisSessie({ switchCost: 180 }),
  ] };
  assert.equal(isMilestoneReached(MIJLPALEN.wisselen[3], ex, 'wisselen'), true);
});

test('Wisselen: laatste sessie switchCost 250 → olifant nog niet', () => {
  const ex = { currentLevel: 3, sessions: [
    wisSessie({ switchCost: 180 }),
    wisSessie({ switchCost: 250 }),
  ] };
  assert.equal(isMilestoneReached(MIJLPALEN.wisselen[3], ex, 'wisselen'), false);
});

// --- computeMilestones ---

test('computeMilestones: lege data → 0 bereikt, perSpel-lijsten compleet', () => {
  const r = computeMilestones({ exercises: {} });
  assert.equal(r.bereikt.length, 0);
  assert.equal(r.perSpel.simon.length, 4);
  assert.equal(r.volgende.length, 5); // één per spel
});

test('computeMilestones: gemengde data → bereikt + volgende klopt', () => {
  const data = {
    exercises: {
      simon:       { sessions: [spanSessie({ maxSpan: 3 }), spanSessie({ maxSpan: 4 }), spanSessie({ maxSpan: 3 })] },
      corsi:       { sessions: [] },
      'day-night': { sessions: [] },
      zoeken:      { sessions: [] },
      wisselen:    { currentLevel: 1, sessions: [] },
    },
  };
  const r = computeMilestones(data);
  const ids = r.bereikt.map((m) => m.id).sort();
  assert.deepEqual(ids, ['simon-1', 'wisselen-1']);
  // Volgende voor simon = simon-2, voor wisselen = wisselen-2.
  const nextSimon = r.volgende.find((m) => m.spelId === 'simon');
  assert.equal(nextSimon.id, 'simon-2');
});

// --- evalueerNieuwBereikt ---

test('evalueerNieuwBereikt: nieuw bereikt vs reeds opgeslagen', () => {
  const data = {
    exercises: {
      simon: { sessions: [spanSessie({ maxSpan: 3 }), spanSessie({ maxSpan: 4 })] },
      corsi: { sessions: [] },
      'day-night': { sessions: [] },
      zoeken: { sessions: [] },
      wisselen: { currentLevel: 1, sessions: [] },
    },
    mijlpalen: { bereikt: ['wisselen-1'], cadeaus: [] },
  };
  const r = evalueerNieuwBereikt(data, 'simon');
  assert.equal(r.nieuw.length, 1);
  assert.equal(r.nieuw[0].id, 'simon-1');
  assert.equal(r.nuBereikt.length, 1);
  assert.deepEqual(r.alleBereiktIds.sort(), ['simon-1', 'wisselen-1']);
});

test('evalueerNieuwBereikt: alles al opgeslagen → geen nieuwe', () => {
  const data = {
    exercises: {
      simon: { sessions: [spanSessie({ maxSpan: 3 }), spanSessie({ maxSpan: 4 })] },
      corsi: { sessions: [] },
      'day-night': { sessions: [] },
      zoeken: { sessions: [] },
      wisselen: { sessions: [] },
    },
    mijlpalen: { bereikt: ['simon-1'], cadeaus: [] },
  };
  const r = evalueerNieuwBereikt(data, 'simon');
  assert.equal(r.nieuw.length, 0);
});
