import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  seedLevel,
  computeSessionLevel,
  shouldAutoLower,
  isReliableSession,
  detectPlateau,
  dnConfig,
  wisConfig,
  nextLevelDayNight,
  nextLevelWisselen,
  countRecentAtOrAbove,
} from './progressie.js';

// --- A. seedLevel ---

test('seedLevel: geen data → default-start per spel', () => {
  assert.equal(seedLevel(null, 'simon'), 2);
  assert.equal(seedLevel({}, 'simon'), 2);
  assert.equal(seedLevel({}, 'corsi'), 2);
  assert.equal(seedLevel({}, 'zoeken'), 6);
});

test('seedLevel: currentLevel 5 → seed 4 (warm-up)', () => {
  assert.equal(seedLevel({ currentLevel: 5 }, 'simon'), 4);
  assert.equal(seedLevel({ currentLevel: 5 }, 'corsi'), 4);
  assert.equal(seedLevel({ currentLevel: 10 }, 'zoeken'), 9);
});

test('seedLevel: clamp op MIN per spel', () => {
  assert.equal(seedLevel({ currentLevel: 2 }, 'simon'), 2);
  assert.equal(seedLevel({ currentLevel: 1 }, 'simon'), 2);
  assert.equal(seedLevel({ currentLevel: 4 }, 'zoeken'), 4);
  assert.equal(seedLevel({ currentLevel: 3 }, 'zoeken'), 4);
});

// --- B. computeSessionLevel ---

test('computeSessionLevel: <3 reversals → null (verkennend)', () => {
  assert.equal(computeSessionLevel([]), null);
  assert.equal(computeSessionLevel([2, 3]), null);
  assert.equal(computeSessionLevel(null), null);
});

test('computeSessionLevel: mediaan van laatste 3 reversals', () => {
  assert.equal(computeSessionLevel([2, 3, 4, 5, 4]), 4);
  assert.equal(computeSessionLevel([2, 2, 3, 3, 3]), 3);
  // Met objecten met .level:
  assert.equal(
    computeSessionLevel([{ level: 3 }, { level: 4 }, { level: 5 }]),
    4,
  );
});

// --- C. shouldAutoLower ---

test('shouldAutoLower: drempel 2 in eerste 2 min', () => {
  const sessieMs = 60 * 1000; // 1 min
  assert.equal(shouldAutoLower([true, false], sessieMs), false);
  assert.equal(shouldAutoLower([false, false], sessieMs), true);
  assert.equal(shouldAutoLower([true, false, false], sessieMs), true);
});

test('shouldAutoLower: drempel 3 ná 2 min', () => {
  const sessieMs = 3 * 60 * 1000; // 3 min
  assert.equal(shouldAutoLower([false, false], sessieMs), false);
  assert.equal(shouldAutoLower([false, false, false], sessieMs), true);
  assert.equal(shouldAutoLower([true, false, false, false], sessieMs), true);
  assert.equal(shouldAutoLower([false, true, false, false], sessieMs), false);
});

// --- D. isReliableSession ---

test('isReliableSession: isFirstEver → false', () => {
  const summary = { trialsN: 10, iivCV: 0.2, accuracy: 0.9 };
  assert.equal(isReliableSession(summary, 10, true, 'simon'), false);
});

test('isReliableSession: span-spel min 6 trials', () => {
  const ok = { trialsN: 6, iivCV: 0.2, accuracy: 0.9 };
  const tooFew = { trialsN: 5, iivCV: 0.2, accuracy: 0.9 };
  assert.equal(isReliableSession(ok, 6, false, 'simon'), true);
  assert.equal(isReliableSession(tooFew, 5, false, 'corsi'), false);
});

test('isReliableSession: bivalent-spel min 24 trials', () => {
  const ok = { trialsN: 24, iivCV: 0.2, accuracy: 0.9 };
  const tooFew = { trialsN: 20, iivCV: 0.2, accuracy: 0.9 };
  assert.equal(isReliableSession(ok, 24, false, 'day-night'), true);
  assert.equal(isReliableSession(tooFew, 20, false, 'wisselen'), false);
});

test('isReliableSession: iivCV > 0.6 → onbetrouwbaar', () => {
  const gokker = { trialsN: 10, iivCV: 0.8, accuracy: 0.5 };
  assert.equal(isReliableSession(gokker, 10, false, 'simon'), false);
});

// --- E. detectPlateau ---

test('detectPlateau: <minSessions → null', () => {
  assert.equal(detectPlateau([], 14, 3), null);
  assert.equal(detectPlateau([{ level: 3, date: new Date().toISOString() }], 14, 3), null);
});

test('detectPlateau: highestLevel gehaald <14d geleden → null', () => {
  const nu = Date.now();
  const sessions = [
    { level: 3, date: new Date(nu - 5 * 24 * 60 * 60 * 1000).toISOString() },
    { level: 4, date: new Date(nu - 3 * 24 * 60 * 60 * 1000).toISOString() },
    { level: 4, date: new Date(nu - 1 * 24 * 60 * 60 * 1000).toISOString() },
  ];
  assert.equal(detectPlateau(sessions, 14, 3, nu), null);
});

test('detectPlateau: plateau 14d+ met ≥3 recent → object', () => {
  const nu = Date.now();
  const sessions = [
    { level: 4, date: new Date(nu - 20 * 24 * 60 * 60 * 1000).toISOString() },
    { level: 3, date: new Date(nu - 10 * 24 * 60 * 60 * 1000).toISOString() },
    { level: 4, date: new Date(nu - 5 * 24 * 60 * 60 * 1000).toISOString() },
    { level: 3, date: new Date(nu - 1 * 24 * 60 * 60 * 1000).toISOString() },
  ];
  const res = detectPlateau(sessions, 14, 3, nu);
  assert.ok(res);
  assert.equal(res.level, 4);
  assert.ok(res.days >= 14);
  assert.ok(res.sessions >= 3);
});

// --- F. dnConfig / wisConfig + nextLevel* ---

test('dnConfig: level 1 = 2 mixed, level 2 = 3 blokken met incongruent', () => {
  assert.deepEqual(dnConfig(1).blokken, ['mixed', 'mixed']);
  assert.deepEqual(dnConfig(2).blokken, ['mixed', 'mixed', 'incongruent']);
  assert.deepEqual(dnConfig(3).blokken, ['mixed', 'incongruent', 'incongruent']);
  assert.equal(dnConfig(4).afleider, true);
});

test('wisConfig: level 1 = 1 blok, level 4 = ABAB-switch', () => {
  assert.equal(wisConfig(1).blokken.length, 1);
  assert.equal(wisConfig(2).blokken.length, 2);
  assert.equal(wisConfig(3).blokken.length, 3);
  assert.equal(wisConfig(4).switchPatroon, 'abab');
});

test('nextLevelDayNight: geen data → level 1', () => {
  assert.equal(nextLevelDayNight([]), 1);
});

test('nextLevelDayNight: 2 geldige sessies 80%+ op level 1 → level 2', () => {
  const s = (acc, level) => ({
    level,
    date: new Date().toISOString(),
    summary: { accuracy: acc, trialsN: 32, iivCV: 0.2 },
  });
  const sessions = [s(0.9, 1), s(0.85, 1)];
  assert.equal(nextLevelDayNight(sessions), 2);
});

test('nextLevelDayNight: cap op 3 (level 4 gereserveerd)', () => {
  const s = (acc, level) => ({
    level,
    date: new Date().toISOString(),
    summary: { accuracy: acc, trialsN: 32, iivCV: 0.2 },
  });
  // Hou sessies tot je 'cap' zou raken.
  const sessions = [
    s(0.9, 1), s(0.9, 1), // → level 2
    s(0.9, 2), s(0.9, 2), // → level 3
    s(0.9, 3), s(0.9, 3), // zou 4 worden zonder cap
  ];
  assert.equal(nextLevelDayNight(sessions), 3);
});

test('nextLevelWisselen: promotie respecteert trialsN >= 24', () => {
  const s = (acc, level, n) => ({
    level,
    date: new Date().toISOString(),
    summary: { accuracy: acc, trialsN: n, iivCV: 0.2 },
  });
  // Te weinig trials → geen promotie
  assert.equal(nextLevelWisselen([s(0.9, 1, 12), s(0.9, 1, 12)]), 1);
  // Genoeg trials → promotie
  assert.equal(nextLevelWisselen([s(0.9, 1, 24), s(0.9, 1, 24)]), 2);
});

test('nextLevelWisselen: slechte sessie tussen goede reset okCount', () => {
  const s = (acc, level) => ({
    level,
    date: new Date().toISOString(),
    summary: { accuracy: acc, trialsN: 24, iivCV: 0.2 },
  });
  const sessions = [s(0.9, 1), s(0.5, 1), s(0.9, 1)];
  // Alleen 1 aaneengesloten goede telt → nog geen promotie
  assert.equal(nextLevelWisselen(sessions), 1);
});

// --- countRecentAtOrAbove (mijlpaal-bouwsteen) ---

test('countRecentAtOrAbove: 2 van laatste 3 telt correct', () => {
  const s = (maxSpan) => ({
    level: maxSpan,
    date: new Date().toISOString(),
    summary: { maxSpan, trialsN: 8, iivCV: 0.2, accuracy: 0.9 },
  });
  const sessions = [s(3), s(4), s(5), s(4), s(5)];
  assert.equal(countRecentAtOrAbove(sessions, 5, 'maxSpan', 3, 'corsi'), 2);
  assert.equal(countRecentAtOrAbove(sessions, 4, 'maxSpan', 3, 'corsi'), 3);
});
