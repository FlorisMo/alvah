// Welk spel vandaag? Pure functie, geen DOM, geen localStorage-lees.
// Krijgt het data-object uit storage mee, plus de huidige tijd.
//
// Regels, in volgorde van prioriteit:
//  1. Speel Simon als er nog geen data is, of alles recent laag scoort.
//  2. Niet-herhalen: sla het spel over dat als laatste is gespeeld.
//  3. Afwisseling: een spel dat >7 dagen niet is gespeeld krijgt voorrang.
//  4. Succes-bias: prefereer spellen met accuracy ≥ 0.7 in de laatste 3 sessies.
//  5. Fallback: default-volgorde.

export const DEFAULT_ORDER = ['simon', 'zoeken', 'corsi', 'day-night', 'wisselen'];

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_AFTER_DAYS = 7;
const SUCCESS_THRESHOLD = 0.7;
const SUCCESS_WINDOW = 3;

export function pickNext(data, nowMs = Date.now()) {
  const exercises = (data && data.exercises) || {};
  const allEmpty = DEFAULT_ORDER.every((id) => !hasSessions(exercises[id]));
  if (allEmpty) return 'simon';

  const lastPlayedId = findLastPlayedId(exercises);
  const candidates = DEFAULT_ORDER.filter((id) => id !== lastPlayedId);

  const stale = candidates.filter((id) => isStale(exercises[id], nowMs));
  if (stale.length > 0) return stale[0];

  const successful = candidates.filter((id) => recentSuccess(exercises[id]));
  if (successful.length > 0) return successful[0];

  if (allRecentLow(exercises)) return 'simon';
  return candidates[0] || 'simon';
}

function hasSessions(ex) {
  return !!(ex && Array.isArray(ex.sessions) && ex.sessions.length > 0);
}

function findLastPlayedId(exercises) {
  let last = null;
  let lastTs = 0;
  for (const id of DEFAULT_ORDER) {
    const ex = exercises[id];
    if (!hasSessions(ex)) continue;
    const latest = ex.sessions[ex.sessions.length - 1];
    const ts = latest && latest.date ? Date.parse(latest.date) : 0;
    if (ts > lastTs) {
      lastTs = ts;
      last = id;
    }
  }
  return last;
}

function isStale(ex, nowMs) {
  if (!hasSessions(ex)) return true;
  const latest = ex.sessions[ex.sessions.length - 1];
  const ts = latest && latest.date ? Date.parse(latest.date) : 0;
  if (!ts) return true;
  return nowMs - ts > STALE_AFTER_DAYS * DAY_MS;
}

function recentSuccess(ex) {
  if (!hasSessions(ex)) return false;
  const last = ex.sessions.slice(-SUCCESS_WINDOW);
  const accs = last
    .map((s) => (s.summary && typeof s.summary.accuracy === 'number' ? s.summary.accuracy : null))
    .filter((a) => a !== null);
  if (accs.length === 0) return false;
  const m = accs.reduce((x, y) => x + y, 0) / accs.length;
  return m >= SUCCESS_THRESHOLD;
}

function allRecentLow(exercises) {
  for (const id of DEFAULT_ORDER) {
    if (recentSuccess(exercises[id])) return false;
  }
  return true;
}
