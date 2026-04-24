// localStorage-wrapper voor het speelvlak.
// Één sleutel, één JSON-object. Zie docs/practice-games-schema.md.
// Alles client-side; verlaat nooit de browser.
//
// Progressie-regels (zie progressie.js + plan §6 Fase 6.5):
//  - A2 "alleen omhoog": currentLevel daalt nooit automatisch.
//  - D1 "hard": alleen geldige sessies updaten currentLevel/highestLevel.

import { isReliableSession } from './progressie.js';

const KEY = 'alvah-ef-v1';
const SCHEMA_VERSION = 1;
const MAX_SESSIONS_PER_EXERCISE = 20;
const FULL_TRIALS_LAST_N = 10;

const EXERCISE_IDS = ['simon', 'zoeken', 'corsi', 'day-night', 'wisselen'];

function emptyData() {
  const exercises = {};
  for (const id of EXERCISE_IDS) {
    exercises[id] = { currentLevel: 1, highestLevel: 1, sessions: [] };
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    preferences: {
      sound: true,
      reducedMotion: false,
      textSize: 'large',
      sparklineInEinde: true,
    },
    exercises,
    mijlpalen: { bereikt: [], cadeaus: [] },
  };
}

function hasLocalStorage() {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch (_) {
    return false;
  }
}

export function load() {
  if (!hasLocalStorage()) return emptyData();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw);
    return migrate(parsed);
  } catch (_) {
    return emptyData();
  }
}

export function save(data) {
  if (!hasLocalStorage()) return false;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (_) {
    return false;
  }
}

export function migrate(data) {
  if (!data || typeof data !== 'object') return emptyData();
  if (!data.schemaVersion) data.schemaVersion = SCHEMA_VERSION;
  if (!data.exercises) data.exercises = {};
  for (const id of EXERCISE_IDS) {
    if (!data.exercises[id]) {
      data.exercises[id] = { currentLevel: 1, highestLevel: 1, sessions: [] };
    }
  }
  if (!data.preferences) {
    data.preferences = { sound: true, reducedMotion: false, textSize: 'large', sparklineInEinde: true };
  }
  if (!data.mijlpalen) data.mijlpalen = { bereikt: [], cadeaus: [] };
  return data;
}

export function saveSession(exerciseId, session) {
  if (!EXERCISE_IDS.includes(exerciseId)) return false;
  const data = load();
  const ex = data.exercises[exerciseId];
  const isFirstEver = !Array.isArray(ex.sessions) || ex.sessions.length === 0;
  ex.sessions.push(session);

  const reliable = isReliableSession(
    session.summary,
    session.summary?.trialsN,
    isFirstEver,
    exerciseId,
  );
  if (reliable && typeof session.level === 'number') {
    // A2: alleen omhoog. Slechte dag verlaagt niet.
    if (session.level > (ex.currentLevel || 0)) ex.currentLevel = session.level;
    if (session.level > (ex.highestLevel || 0)) ex.highestLevel = session.level;
  }

  prune(ex);
  return save(data);
}

function prune(ex) {
  if (ex.sessions.length > MAX_SESSIONS_PER_EXERCISE) {
    ex.sessions = ex.sessions.slice(-MAX_SESSIONS_PER_EXERCISE);
  }
  const cutoff = ex.sessions.length - FULL_TRIALS_LAST_N;
  if (cutoff > 0) {
    for (let i = 0; i < cutoff; i++) {
      if (ex.sessions[i] && ex.sessions[i].trials) {
        delete ex.sessions[i].trials;
      }
    }
  }
}

export function getPreferences() {
  return load().preferences;
}

export function setPreference(key, value) {
  const data = load();
  data.preferences[key] = value;
  return save(data);
}

export function clearAll() {
  if (!hasLocalStorage()) return false;
  try {
    window.localStorage.removeItem(KEY);
    return true;
  } catch (_) {
    return false;
  }
}

export function exportJSON() {
  return JSON.stringify(load(), null, 2);
}

export function importJSON(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    return save(migrate(parsed));
  } catch (_) {
    return false;
  }
}

export { EXERCISE_IDS, KEY, SCHEMA_VERSION };
