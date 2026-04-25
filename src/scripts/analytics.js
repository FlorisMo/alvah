// Analytics-laag voor admin. Pure module, geen DOM.
// Vier lenzen op basis van EF-research:
//  Lens 1 — stabiliteit: rolling-mean per spel (Alvah-vs-Alvah trend).
//  Lens 2 — aandacht-consistency: IIV-CV trend (Kofler 2013 e.a.).
//  Lens 3 — EF-componenten apart (Diamond 2013): inhibition + flexibility.
//  Lens 4 — engagement-context: frequentie, tijd-van-dag, te-moeilijk-teller.
//
// Belangrijk: geen samengestelde EF-score. Far-transfer naar school is niet
// bewezen (Melby-Lervåg 2016, Sala & Gobet 2020), dus we claimen geen
// composiet-getal en geen leeftijd-norm-vergelijking. Referentie-banden zijn
// optioneel en zitten in referenties.js.

import { isReliableSession } from './progressie.js';

const DAG_MS = 24 * 60 * 60 * 1000;

function reliableSessions(sessions, spelId) {
  if (!Array.isArray(sessions)) return [];
  return sessions.filter((s) =>
    isReliableSession(s.summary, s.summary?.trialsN, false, spelId),
  );
}

// --- Lens 1 — Stabiliteit ---

// Rolling-mean over de laatste `windowDays` dagen, geretourneerd per sessie
// in chronologische volgorde. Gebruikt een sliding window per sessie zodat
// elke sparkline-punt de "30d-band" is rondom dat moment, niet één globale.
export function rollingMean(sessions, metric, windowDays = 30) {
  if (!Array.isArray(sessions) || !sessions.length) return [];
  const out = [];
  for (let i = 0; i < sessions.length; i++) {
    const cur = sessions[i];
    const tCur = cur.date ? new Date(cur.date).getTime() : NaN;
    if (!Number.isFinite(tCur)) {
      out.push(null);
      continue;
    }
    const cutoff = tCur - windowDays * DAG_MS;
    let sum = 0;
    let n = 0;
    for (let j = 0; j <= i; j++) {
      const s = sessions[j];
      const t = s.date ? new Date(s.date).getTime() : NaN;
      if (!Number.isFinite(t) || t < cutoff) continue;
      const v = s.summary && Number(s.summary[metric]);
      if (Number.isFinite(v)) {
        sum += v;
        n += 1;
      }
    }
    out.push(n > 0 ? sum / n : null);
  }
  return out;
}

// Statusvergelijking: laatste sessie t.o.v. zijn rolling-band.
// Retourneert 'op' | 'boven' | 'onder' | null (te weinig data).
export function huidigStatus(sessions, metric, windowDays = 30, marge = 0.05) {
  if (!Array.isArray(sessions) || sessions.length < 3) return null;
  const reeks = rollingMean(sessions, metric, windowDays);
  const laatste = sessions[sessions.length - 1];
  const v = laatste.summary && Number(laatste.summary[metric]);
  const band = reeks[reeks.length - 1];
  if (!Number.isFinite(v) || !Number.isFinite(band) || band === 0) return null;
  const verschil = (v - band) / band;
  if (verschil > marge) return 'boven';
  if (verschil < -marge) return 'onder';
  return 'op';
}

// --- Lens 2 — IIV-CV ---

export function iivTrend(sessions, spelId) {
  const reliable = reliableSessions(sessions, spelId);
  return reliable.map((s) => ({
    date: s.date,
    iivCV: Number(s.summary && s.summary.iivCV) || null,
  })).filter((p) => p.iivCV !== null);
}

// --- Lens 3 — EF-componenten ---

// Day-Night: accuracy specifiek op incongruent-trials.
// Wij loggen per trial in `trials[]` met `mode: 'mixed' | 'incongruent'`.
// Recente sessies hebben `trials`-array (auto-prune behoudt laatste 10).
// Oudere sessies hebben alleen summary; daar gebruiken we de algemene accuracy
// als ruwe proxy met een vlag dat het ge-truncate is.
export function incongruentAccuracyTrend(sessions) {
  if (!Array.isArray(sessions)) return [];
  return sessions.map((s) => {
    if (Array.isArray(s.trials) && s.trials.length) {
      const inc = s.trials.filter((t) => t.mode === 'incongruent');
      if (inc.length === 0) return { date: s.date, accuracy: null, exact: true };
      const correct = inc.filter((t) => t.correct).length;
      return { date: s.date, accuracy: correct / inc.length, exact: true };
    }
    const acc = Number(s.summary && s.summary.accuracy);
    return {
      date: s.date,
      accuracy: Number.isFinite(acc) ? acc : null,
      exact: false,
    };
  }).filter((p) => p.accuracy !== null);
}

// Zoeken: false-alarm-rate per sessie. summary.falseAlarmsTotal / trialsN.
export function falseAlarmRate(sessions) {
  if (!Array.isArray(sessions)) return [];
  return sessions.map((s) => {
    const fa = Number(s.summary && s.summary.falseAlarmsTotal);
    const n = Number(s.summary && s.summary.trialsN);
    if (!Number.isFinite(fa) || !Number.isFinite(n) || n === 0) {
      return { date: s.date, rate: null };
    }
    return { date: s.date, rate: fa / n };
  }).filter((p) => p.rate !== null);
}

// Wisselen: switch-cost trend. summary.switchCost is in ms.
export function switchCostTrend(sessions) {
  if (!Array.isArray(sessions)) return [];
  return sessions.map((s) => {
    const sc = Number(s.summary && s.summary.switchCost);
    return {
      date: s.date,
      switchCost: Number.isFinite(sc) && sc > 0 ? sc : null,
    };
  }).filter((p) => p.switchCost !== null);
}

// --- Lens 4 — Engagement-context ---

// Sessies-per-week voor laatste N weken. Retourneert array [{ weekStart, count }].
export function weekFrequency(allSessions, weken = 8, nu = Date.now()) {
  const result = [];
  for (let i = weken - 1; i >= 0; i--) {
    const weekEnd = nu - i * 7 * DAG_MS;
    const weekStart = weekEnd - 7 * DAG_MS;
    let count = 0;
    for (const s of allSessions) {
      if (!s.date) continue;
      const t = new Date(s.date).getTime();
      if (Number.isFinite(t) && t >= weekStart && t < weekEnd) count += 1;
    }
    result.push({ weekStart: new Date(weekStart).toISOString(), count });
  }
  return result;
}

// Tijd-van-dag-heatmap. Retourneert object: { spelId: number[24] } met sessie-aantallen per uur.
export function timeOfDayHeatmap(exercises) {
  const out = {};
  for (const spelId of Object.keys(exercises || {})) {
    const buckets = new Array(24).fill(0);
    const sessions = (exercises[spelId] && exercises[spelId].sessions) || [];
    for (const s of sessions) {
      if (!s.date) continue;
      const d = new Date(s.date);
      const h = d.getHours();
      if (Number.isFinite(h) && h >= 0 && h < 24) buckets[h] += 1;
    }
    out[spelId] = buckets;
  }
  return out;
}

// Tellen hoe vaak "te moeilijk"-events of auto-lower-events optreden per week.
// We loggen dit niet expliciet, dus we leiden af: een sessie waar de span
// daalt over trials heen is een proxy. Voor nu: tellen sessies met
// `summary.autoLowerN` als dat veld bestaat (toekomstige uitbreiding); anders 0.
export function teMoeilijkPerWeek(allSessions, weken = 8, nu = Date.now()) {
  const result = [];
  for (let i = weken - 1; i >= 0; i--) {
    const weekEnd = nu - i * 7 * DAG_MS;
    const weekStart = weekEnd - 7 * DAG_MS;
    let count = 0;
    for (const s of allSessions) {
      if (!s.date) continue;
      const t = new Date(s.date).getTime();
      if (!Number.isFinite(t) || t < weekStart || t >= weekEnd) continue;
      const n = Number(s.summary && s.summary.autoLowerN);
      if (Number.isFinite(n) && n > 0) count += n;
    }
    result.push({ weekStart: new Date(weekStart).toISOString(), count });
  }
  return result;
}

// Helper: alle sessies van alle spellen plat, met `spelId` toegevoegd, sorted op date.
export function platteSessies(exercises) {
  const flat = [];
  for (const spelId of Object.keys(exercises || {})) {
    const arr = (exercises[spelId] && exercises[spelId].sessions) || [];
    for (const s of arr) flat.push({ ...s, spelId });
  }
  flat.sort((a, b) => {
    const ta = a.date ? new Date(a.date).getTime() : 0;
    const tb = b.date ? new Date(b.date).getTime() : 0;
    return ta - tb;
  });
  return flat;
}
