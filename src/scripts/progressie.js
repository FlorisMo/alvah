// Progressie-regels voor /spelen. Pure module, geen DOM-koppeling.
// Zie docs/practice-games-plan.md §6 Fase 6.5 voor ontwerp-beslissingen.
//
// Kernbeslissingen (antwoord-template uit plan):
//  A1 = currentLevel - 1 (warm-up)
//  A2 = alleen omhoog (currentLevel daalt nooit automatisch)
//  B1 = min 3 reversals voor geldige session-level
//  C1 = 3 fouten op rij (2 in eerste 2 minuten van sessie)
//  C2 = alleen span-spellen (Simon/Corsi/Zoeken)
//  D1 = hard (sessie telt of telt niet)
//  D2 = 2 van laatste 3 geldige sessies
//  E1 = 14 dagen + 3 sessies
//  F1 = level-schema nu vastgelegd
//  F2 = 80% accuracy + trialsN >= 24
//  F3 = geen mid-sessie demotie voor DN/Wisselen

const DAG_MS = 24 * 60 * 60 * 1000;

// Minimale level per spel (MIN in staircase-zin).
const MIN_LEVEL = {
  simon: 2,
  corsi: 2,
  zoeken: 4,
  'day-night': 1,
  wisselen: 1,
};

// Default-start zonder data.
const DEFAULT_START = {
  simon: 2,
  corsi: 2,
  zoeken: 6,
  'day-night': 1,
  wisselen: 1,
};

const SPAN_SPELLEN = new Set(['simon', 'corsi', 'zoeken']);

// A. Seed: start één stap onder currentLevel, clamped op MIN.
// Als ex null/leeg → default-start.
export function seedLevel(ex, spelId) {
  const def = DEFAULT_START[spelId] ?? 2;
  const min = MIN_LEVEL[spelId] ?? 1;
  if (!ex || typeof ex.currentLevel !== 'number' || ex.currentLevel <= 0) return def;
  return Math.max(min, ex.currentLevel - 1);
}

export function minLevel(spelId) {
  return MIN_LEVEL[spelId] ?? 1;
}

export function isSpanSpel(spelId) {
  return SPAN_SPELLEN.has(spelId);
}

// B. Session-level uit reversals (mediaan van laatste 3).
// Retourneert null als <3 reversals — sessie telt als "verkennend".
export function computeSessionLevel(reversals, minReversals = 3) {
  if (!Array.isArray(reversals) || reversals.length < minReversals) return null;
  const last = reversals.slice(-minReversals).map((r) =>
    typeof r === 'number' ? r : (r && typeof r.level === 'number' ? r.level : 0),
  );
  const sorted = last.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// C. Auto-lower trigger: fouten op rij triggeren zacht-dalen.
// recentResults = array van booleans (true = correct, false = fout), nieuwste laatst.
// sessieMs = tijd sinds sessie-start (ms).
// In eerste 2 minuten: drempel 2 (warm-up). Daarna: drempel 3 (echte uitputting).
export function shouldAutoLower(recentResults, sessieMs) {
  const threshold = sessieMs < 2 * 60 * 1000 ? 2 : 3;
  if (!Array.isArray(recentResults) || recentResults.length < threshold) return false;
  const tail = recentResults.slice(-threshold);
  return tail.every((c) => c === false);
}

// D. Betrouwbare sessie: updatet currentLevel/highestLevel + telt voor mijlpalen.
// Eerste sessie ooit telt nooit (kalibratie-vrije zone).
export function isReliableSession(summary, trialsN, isFirstEver, spelId) {
  if (isFirstEver) return false;
  const n = typeof trialsN === 'number' ? trialsN : (summary && summary.trialsN) || 0;
  const minTrials = isSpanSpel(spelId) ? 6 : 24;
  if (n < minTrials) return false;
  if (!summary) return false;
  if (typeof summary.iivCV === 'number' && summary.iivCV > 0.6) return false;
  return true;
}

// E. Plateau-detectie: highestLevel X dagen niet gestegen bij ≥N sessies.
// Retourneert {level, days, sessions} of null.
export function detectPlateau(sessions, days = 14, minSessions = 3, nu = Date.now()) {
  if (!Array.isArray(sessions) || sessions.length < minSessions) return null;
  const cutoff = nu - days * DAG_MS;

  const maxEver = sessions.reduce(
    (m, s) => Math.max(m, Number(s.level) || 0),
    0,
  );
  if (maxEver === 0) return null;

  // Wanneer is maxEver voor het eerst behaald?
  const first = sessions.find((s) => (Number(s.level) || 0) >= maxEver);
  if (!first || !first.date) return null;
  const reachedAt = new Date(first.date).getTime();
  if (!Number.isFinite(reachedAt)) return null;
  if (nu - reachedAt < days * DAG_MS) return null;

  // Sinds reached: geen sessie die maxEver overstijgt (per definitie niet, want
  // maxEver is het maximum). Check alleen dat er ≥minSessions sessies zijn ná
  // reachedAt binnen het venster (= bewijs dat hij actief is geweest).
  const recentN = sessions.filter((s) => {
    if (!s.date) return false;
    const t = new Date(s.date).getTime();
    return Number.isFinite(t) && t >= cutoff;
  }).length;
  if (recentN < minSessions) return null;

  return {
    level: maxEver,
    days: Math.round((nu - reachedAt) / DAG_MS),
    sessions: recentN,
  };
}

// F. Level-schema Day-Night (4 levels).
// Level 1: 2 blokken mixed.
// Level 2: 3 blokken (2 mixed + 1 incongruent) — equivalent aan huidige vaste config.
// Level 3: 3 blokken (1 mixed + 2 incongruent).
// Level 4: gereserveerd voor afleider-stimuli; fase 7 activeert. Tot die tijd
//          capt nextLevelDayNight op 3.
export function dnConfig(level) {
  switch (level) {
    case 1:
      return { blokken: ['mixed', 'mixed'], trialsPerBlok: 16, afleider: false };
    case 2:
      return { blokken: ['mixed', 'mixed', 'incongruent'], trialsPerBlok: 16, afleider: false };
    case 3:
      return { blokken: ['mixed', 'incongruent', 'incongruent'], trialsPerBlok: 16, afleider: false };
    case 4:
      return { blokken: ['mixed', 'incongruent', 'incongruent'], trialsPerBlok: 16, afleider: true };
    default:
      return { blokken: ['mixed', 'mixed'], trialsPerBlok: 16, afleider: false };
  }
}

// Bepaal huidig level op basis van geldige sessies. Promotie: 2 van laatste 3
// geldige sessies op huidige level met accuracy ≥ 80% én trialsN ≥ 24. Cap
// voorlopig op 3 (level 4 afleider nog niet geïmplementeerd).
export function nextLevelDayNight(sessions) {
  return nextLevelBivalent(sessions, 'day-night', 3);
}

// Level-schema Wisselen (4 levels). Zie plan §6 Fase 6.5 F.
// L1: 1 blok pure-kleur (of pure-vorm).
// L2: pure-kleur + pure-vorm (geen switch).
// L3: pure-kleur + pure-vorm + switch-AABB (huidige vaste config).
// L4: pure-kleur + pure-vorm + switch-ABAB (elke trial wisselt).
export function wisConfig(level) {
  switch (level) {
    case 1:
      return { blokken: ['pure-kleur'], trialsPerBlok: 12, switchPatroon: 'aabb' };
    case 2:
      return { blokken: ['pure-kleur', 'pure-vorm'], trialsPerBlok: 12, switchPatroon: 'aabb' };
    case 3:
      return { blokken: ['pure-kleur', 'pure-vorm', 'switch'], trialsPerBlok: 12, switchPatroon: 'aabb' };
    case 4:
      return { blokken: ['pure-kleur', 'pure-vorm', 'switch'], trialsPerBlok: 12, switchPatroon: 'abab' };
    default:
      return { blokken: ['pure-kleur'], trialsPerBlok: 12, switchPatroon: 'aabb' };
  }
}

export function nextLevelWisselen(sessions) {
  return nextLevelBivalent(sessions, 'wisselen', 4);
}

// Gedeelde promotie-logica voor DN + Wisselen.
// Start op level 1. Elke keer dat hij 2 geldige sessies op rij maakt op huidig
// level met accuracy ≥ 80% en trialsN ≥ 24 promoveer naar volgend level. Geen
// automatische demotie (F3).
function nextLevelBivalent(sessions, spelId, maxLevel) {
  let level = 1;
  let okCount = 0;
  if (!Array.isArray(sessions) || sessions.length === 0) return level;

  for (const s of sessions) {
    if (!s.summary) continue;
    const trialsN = s.summary.trialsN || 0;
    const acc = s.summary.accuracy || 0;
    const sLevel = typeof s.level === 'number' ? s.level : 0;
    const reliable = isReliableSession(s.summary, trialsN, false, spelId);

    if (!reliable) {
      okCount = 0;
      continue;
    }
    if (sLevel === level && acc >= 0.80 && trialsN >= 24) {
      okCount += 1;
      if (okCount >= 2 && level < maxLevel) {
        level += 1;
        okCount = 0;
      }
    } else {
      okCount = 0;
    }
  }
  return level;
}

// Tellen hoe vaak Alvah een bepaalde drempel heeft gehaald in laatste N geldige
// sessies. Bouwsteen voor Fase 7 mijlpaal-drempels (D2: "2 van laatste 3
// geldige sessies").
export function countRecentAtOrAbove(sessions, threshold, metric, lastN, spelId) {
  if (!Array.isArray(sessions)) return 0;
  const relevant = sessions.filter((s) =>
    isReliableSession(s.summary, s.summary?.trialsN, false, spelId),
  );
  const tail = relevant.slice(-lastN);
  return tail.filter((s) => (s.summary && s.summary[metric] >= threshold) ? 1 : 0).length;
}
