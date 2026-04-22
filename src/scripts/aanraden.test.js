import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickNext, DEFAULT_ORDER } from './aanraden.js';

const NOW = Date.parse('2026-04-22T18:00:00Z');
const daysAgo = (n) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

function emptyExercises() {
  const ex = {};
  for (const id of DEFAULT_ORDER) ex[id] = { currentLevel: 1, highestLevel: 1, sessions: [] };
  return ex;
}

function sess(dateISO, accuracy) {
  return { date: dateISO, summary: { accuracy } };
}

test('geen data → Simon', () => {
  assert.equal(pickNext({ exercises: emptyExercises() }, NOW), 'simon');
  assert.equal(pickNext({}, NOW), 'simon');
  assert.equal(pickNext(null, NOW), 'simon');
});

test('niet-herhalen: laatst gespeeld wordt overgeslagen', () => {
  const ex = emptyExercises();
  ex.simon.sessions = [sess(daysAgo(0), 0.9)];
  const pick = pickNext({ exercises: ex }, NOW);
  assert.notEqual(pick, 'simon');
});

test('staleness heeft voorrang: een spel dat >7 dagen niet gespeeld is komt boven favoriet', () => {
  const ex = emptyExercises();
  // simon recent, zoeken >7 dagen geleden, corsi recent met hoge accuracy
  ex.simon.sessions = [sess(daysAgo(0), 0.9)];
  ex.corsi.sessions = [sess(daysAgo(1), 0.95), sess(daysAgo(2), 0.95), sess(daysAgo(3), 0.95)];
  ex.zoeken.sessions = [sess(daysAgo(10), 0.4)];
  // niet simon (laatst gespeeld); zoeken is stale → voorrang boven corsi
  assert.equal(pickNext({ exercises: ex }, NOW), 'zoeken');
});

test('succes-bias zonder stale kandidaten', () => {
  const ex = emptyExercises();
  // alles recent, alleen day-night heeft hoge accuracy
  ex.simon.sessions = [sess(daysAgo(0), 0.5)];
  ex.zoeken.sessions = [sess(daysAgo(1), 0.4)];
  ex.corsi.sessions = [sess(daysAgo(2), 0.5)];
  ex['day-night'].sessions = [sess(daysAgo(3), 0.9), sess(daysAgo(4), 0.8), sess(daysAgo(5), 0.85)];
  ex.wisselen.sessions = [sess(daysAgo(6), 0.3)];
  // simon laatst gespeeld → overslaan; day-night is eerste met succes
  assert.equal(pickNext({ exercises: ex }, NOW), 'day-night');
});

test('alle accuracy laag én geen stale → fallback Simon', () => {
  const ex = emptyExercises();
  // geen stale: alles in laatste dag. Geen succes: alles <0.7.
  // laatst gespeeld moet iets anders zijn dan simon anders pakt simon sowieso.
  ex.simon.sessions     = [sess(daysAgo(2), 0.4)];
  ex.zoeken.sessions    = [sess(daysAgo(3), 0.4)];
  ex.corsi.sessions     = [sess(daysAgo(4), 0.3)];
  ex['day-night'].sessions = [sess(daysAgo(5), 0.5)];
  ex.wisselen.sessions  = [sess(daysAgo(0), 0.5)]; // laatst gespeeld
  const pick = pickNext({ exercises: ex }, NOW);
  assert.equal(pick, 'simon');
});
