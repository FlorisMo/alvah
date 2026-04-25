// Skin-systeem: spel-uiterlijk verandert mee met mijlpaal-progressie. Pure
// module, geen DOM. Trigger = mastery (mijlpaal-bereikt of cross-session
// level), niet kalender. Paradigma-parameters blijven identiek.
//
// Twee primitives:
//   - skinNiveau(spelId, data): 0-4 = aantal bereikte mijlpalen voor dat spel
//   - bereikteDieren(spelId, data): list of {id, dier, drempel} van MIJLPALEN
//
// Spel-bestand zet `data-skin="N"` op root + rendert trofeeën-strip.

import { MIJLPALEN } from './mijlpalen.js';

export function skinNiveau(spelId, data) {
  const dieren = bereikteDieren(spelId, data);
  return dieren.length;
}

export function bereikteDieren(spelId, data) {
  if (!data || !data.mijlpalen || !Array.isArray(data.mijlpalen.bereikt)) return [];
  const lijst = MIJLPALEN[spelId] || [];
  const bereiktSet = new Set(data.mijlpalen.bereikt);
  return lijst.filter((m) => bereiktSet.has(m.id));
}

// Helper voor unit-test zekerheid.
export function alleSpelIds() {
  return Object.keys(MIJLPALEN);
}
