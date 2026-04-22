// Centrale NL-strings voor /spelen. Toon: direct, feit-taal, geen hype.
// Zie docs/tone-of-voice-alvah-site-nl.md — één niveau warmer dan dossier,
// maar zonder "kanjer/held/ons mannetje"-stem.

export const NL = {
  // Algemeen
  start: 'Start',
  pauze: 'Pauze',
  doorgaan: 'Doorgaan',
  stop: 'Stop',
  klaar: 'Klaar',
  volgende: 'Volgende',
  opnieuw: 'Nog een keer',
  teMoeilijk: 'Dit is te moeilijk',
  nietTeMoeilijk: 'Laat maar',
  uitleg: 'Uitleg',
  voorbeeld: 'Voorbeeld',
  luisteren: 'Voorlezen',
  geluidAan: 'Geluid aan',
  geluidUit: 'Geluid uit',

  // Feedback (geen uitroeptekens, feit-taal)
  goedBezig: 'Goed bezig',
  probeerMaar: 'Probeer maar',
  nogEenKeer: 'Nog een keer',
  jeHadXvanY: (x, y) => `Je had ${x} van de ${y} goed`,
  jouwHoogsteRij: (n) => `Jouw hoogste rij was ${n}`,
  ditIsJeNiveau: (n) => `Dit niveau beheers je nu: ${n}`,

  // Landing
  spelen: {
    titel: 'Spelen',
    lede: 'Kies een spel, of speel het spel dat vandaag wordt aangeraden.',
    vandaag: 'Vandaag',
    andere: 'Andere spellen',
    nogNietBeschikbaar: 'Nog niet beschikbaar',
    binnenkort: 'Binnenkort',
  },

  // Spel-titels en korte beschrijvingen
  spel: {
    simon: {
      titel: 'Simon',
      kort: 'Onthoud de volgorde van kleuren en klanken.',
      uitleg: 'Kijk en luister goed naar de kleuren. Tik ze daarna in dezelfde volgorde aan.',
      kijkGoed: 'Kijk goed',
      jouwBeurt: 'Jouw beurt',
      goed: 'Juist',
      ietsKorter: 'Oké, iets korter',
      hoogsteRij: 'Hoogste rij',
      eindeCap: 'Je hebt de hoogste rij gehaald',
    },
    zoeken:    { titel: 'Zoeken',    kort: 'Zoek de rode kikker tussen de groene.' },
    corsi:     { titel: 'Corsi',     kort: 'Onthoud welke sterren oplichtten en in welke volgorde.' },
    'day-night': { titel: 'Dag & Nacht', kort: 'Zeg het omgekeerde van wat je ziet.' },
    wisselen:  { titel: 'Wisselen',  kort: 'Soms kijk je naar de kleur, soms naar de vorm.' },
  },

  // Navigatie
  terug: 'Terug',
  terugNaarSpelen: 'Terug naar spelen',
  jouwReis: 'Jouw reis',
};
