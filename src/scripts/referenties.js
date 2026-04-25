// Referentie-banden voor admin-lenzen. Optioneel zichtbaar via toggle in
// data.preferences.toonReferenties. Default uit.
//
// Belangrijk: deze bands zijn benaderingen uit de literatuur voor leeftijd
// 7. Onze paradigma-parameters wijken af van de originele studies, dus de
// bands zijn richt-gevend, niet diagnostisch. School kijkt vaak naar zulke
// gemiddelden — vandaar dat we ze tonen — maar nooit gebruiken als oordeel
// over Alvah of als basis voor beslissingen.

export const REFERENTIE_BANDS = {
  // Lens 1 stabiliteit
  corsi: {
    metric: 'maxSpan',
    band: { min: 4, max: 5 },
    bron: 'Kessels e.a. + ontwikkelings-replicaties',
    label: 'Corsi-span ≈ leeftijd 7',
  },

  // Lens 2 IIV-CV (per spel; range geldt voor alle vijf — losse copy maakt het
  // duidelijker per sparkline)
  iivCV: {
    metric: 'iivCV',
    band: { min: 0.20, max: 0.35 },
    bron: 'Kofler 2013 e.a., attention-research 6–9j',
    label: 'IIV-CV ≈ leeftijd 7',
  },

  // Lens 3 inhibition (Day-Night incongruent-accuracy)
  'day-night-incongruent': {
    metric: 'accuracy',
    band: { min: 0.80, max: 0.90 },
    bron: 'Gerstadt 1994 + replicaties leeftijd 7',
    label: 'Incongruent-accuracy ≈ leeftijd 7',
  },

  // Lens 3 flexibility (Wisselen switch-cost in ms — lager is beter)
  'wisselen-switchcost': {
    metric: 'switchCost',
    band: { min: 200, max: 400 },
    bron: 'Cepeda e.a. 2001 + vergelijkbare leeftijd 7–8',
    label: 'Switch-cost ≈ leeftijd 7',
  },
};

export const DISCLAIMER =
  'Onze parameters wijken af van origineel onderzoek. Bedoeld als ruwe context, nooit als diagnose.';

// Helper: geef de band-config voor een specifieke (spelId, lens)-combinatie,
// of null als er geen defensibele band bestaat.
export function getBand(key) {
  return REFERENTIE_BANDS[key] || null;
}
