// Mijlpalen-evaluatie. Stub voor fase 0 — volledige drempels komen in fase 7.
// Pure functie: kijkt naar data, geeft lijst terug van bereikt/volgende.
//
// Uitgangspunten:
//  - Vaste schedule, mastery-anchored, previewable.
//  - Geen variabele beloning, geen loss-aversion.
//  - Drempels per spel staan in MIJLPALEN; eenmaal bereikt blijven ze bereikt.

export const MIJLPALEN = {
  simon: [],
  corsi: [],
  'day-night': [],
  zoeken: [],
  wisselen: [],
};

export function computeMilestones(data) {
  const bereikt = (data && data.mijlpalen && Array.isArray(data.mijlpalen.bereikt))
    ? data.mijlpalen.bereikt.slice()
    : [];
  return { bereikt, volgende: [] };
}
