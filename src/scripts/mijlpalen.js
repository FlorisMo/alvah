// Mijlpalen-evaluatie. Pure module, geen DOM-koppeling.
// Zie docs/practice-games-plan.md §6 Fase 7.
//
// Vier mijlpalen per spel, vast en mastery-anchored. Geen variabele beloning,
// geen loss-aversion. Eenmaal bereikt blijven ze bereikt.
//
// D2 (uit Fase 6.5): "2 van laatste 3 geldige sessies" als drempel-bewijs voor
// metric-gedreven mijlpalen (span/setSize/accuracy). Levels en switchCost zijn
// staat-gedreven en kijken naar currentLevel of laatste sessie.

import { isReliableSession } from './progressie.js';

export const MIJLPALEN = {
  simon: [
    { id: 'simon-1', dier: 'trom-aap',         drempel: 'Rij van 3', metric: 'maxSpan', threshold: 3 },
    { id: 'simon-2', dier: 'gitaar-flamingo',  drempel: 'Rij van 5', metric: 'maxSpan', threshold: 5 },
    { id: 'simon-3', dier: 'zang-vos',         drempel: 'Rij van 7', metric: 'maxSpan', threshold: 7 },
    { id: 'simon-4', dier: 'piano-uil',        drempel: 'Rij van 9', metric: 'maxSpan', threshold: 9 },
  ],
  corsi: [
    { id: 'corsi-1', dier: 'vuurvliegjes', drempel: 'Rij van 4', metric: 'maxSpan', threshold: 4 },
    { id: 'corsi-2', dier: 'uil',          drempel: 'Rij van 5', metric: 'maxSpan', threshold: 5 },
    { id: 'corsi-3', dier: 'vos',          drempel: 'Rij van 6', metric: 'maxSpan', threshold: 6 },
    { id: 'corsi-4', dier: 'sterren-pad',  drempel: 'Rij van 7', metric: 'maxSpan', threshold: 7 },
  ],
  'day-night': [
    { id: 'day-night-1', dier: 'egel',      drempel: '80% goed',               metric: 'accuracy',          threshold: 0.80 },
    { id: 'day-night-2', dier: 'vos',       drempel: '85% goed op niveau 2+',  metric: 'accuracy-at-level', threshold: 0.85, level: 2 },
    { id: 'day-night-3', dier: 'uil',       drempel: '90% goed op niveau 3',   metric: 'accuracy-at-level', threshold: 0.90, level: 3 },
    { id: 'day-night-4', dier: 'vleermuis', drempel: 'Niveau 4 met afleiders', metric: 'level-min',         threshold: 4 },
  ],
  zoeken: [
    { id: 'zoeken-1', dier: 'libel',    drempel: '8 kikkers tegelijk',  metric: 'maxSetSize', threshold: 8 },
    { id: 'zoeken-2', dier: 'reiger',   drempel: '12 kikkers tegelijk', metric: 'maxSetSize', threshold: 12 },
    { id: 'zoeken-3', dier: 'ijsvogel', drempel: '16 kikkers tegelijk', metric: 'maxSetSize', threshold: 16 },
    { id: 'zoeken-4', dier: 'otter',    drempel: 'Combineer-zoeken',    metric: 'level-min',  threshold: 3 },
  ],
  wisselen: [
    { id: 'wisselen-1', dier: 'papegaai', drempel: 'Alleen kleur',         metric: 'level-min',      threshold: 1 },
    { id: 'wisselen-2', dier: 'giraffe',  drempel: 'Alleen vorm erbij',    metric: 'level-min',      threshold: 2 },
    { id: 'wisselen-3', dier: 'leeuw',    drempel: 'Afwisselen',           metric: 'level-min',      threshold: 3 },
    { id: 'wisselen-4', dier: 'olifant',  drempel: 'Snelle wissel < 200ms', metric: 'switchCost-max', threshold: 200 },
  ],
};

const SPEL_IDS = ['simon', 'corsi', 'day-night', 'zoeken', 'wisselen'];

function reliableSessions(ex, spelId) {
  const sessions = (ex && Array.isArray(ex.sessions)) ? ex.sessions : [];
  return sessions.filter((s) =>
    isReliableSession(s.summary, s.summary?.trialsN, false, spelId),
  );
}

function tailHits(reliable, metric, threshold, lastN, hitsNeeded) {
  const tail = reliable.slice(-lastN);
  if (tail.length < hitsNeeded) return false;
  const hits = tail.filter(
    (s) => s.summary && (Number(s.summary[metric]) || 0) >= threshold,
  ).length;
  return hits >= hitsNeeded;
}

export function isMilestoneReached(milestone, ex, spelId) {
  if (!milestone) return false;
  const reliable = reliableSessions(ex, spelId);
  switch (milestone.metric) {
    case 'maxSpan':
    case 'maxSetSize':
    case 'accuracy':
      return tailHits(reliable, milestone.metric, milestone.threshold, 3, 2);
    case 'accuracy-at-level': {
      const onLevel = reliable.filter(
        (s) => (Number(s.level) || 0) >= (milestone.level || 1),
      );
      return tailHits(onLevel, 'accuracy', milestone.threshold, 3, 2);
    }
    case 'level-min':
      return (ex && Number(ex.currentLevel) || 0) >= milestone.threshold;
    case 'switchCost-max': {
      const withSC = reliable.filter(
        (s) => s.summary && typeof s.summary.switchCost === 'number',
      );
      const last = withSC[withSC.length - 1];
      return !!last && last.summary.switchCost <= milestone.threshold;
    }
    default:
      return false;
  }
}

export function computeMilestones(data) {
  const perSpel = {};
  const flat = [];
  for (const spelId of SPEL_IDS) {
    const ex = data && data.exercises && data.exercises[spelId];
    const lijst = (MIJLPALEN[spelId] || []).map((m) => ({
      ...m,
      spelId,
      bereikt: isMilestoneReached(m, ex, spelId),
    }));
    perSpel[spelId] = lijst;
    for (const m of lijst) flat.push(m);
  }
  const bereikt = flat.filter((m) => m.bereikt);
  const volgende = SPEL_IDS
    .map((spelId) => perSpel[spelId].find((m) => !m.bereikt) || null)
    .filter(Boolean);
  return { perSpel, bereikt, volgende };
}

// Vergelijk computed-bereikt met opgeslagen-bereikt voor één spel.
// Caller is verantwoordelijk voor data.mijlpalen.bereikt updaten + saven.
export function evalueerNieuwBereikt(data, spelId) {
  const result = computeMilestones(data);
  const opgeslagen = (data && data.mijlpalen && Array.isArray(data.mijlpalen.bereikt))
    ? data.mijlpalen.bereikt
    : [];
  const lijst = result.perSpel[spelId] || [];
  const nuBereikt = lijst.filter((m) => m.bereikt);
  const nieuw = nuBereikt.filter((m) => !opgeslagen.includes(m.id));
  return { nieuw, nuBereikt, alleBereiktIds: result.bereikt.map((m) => m.id) };
}
