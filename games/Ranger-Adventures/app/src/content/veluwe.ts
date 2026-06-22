/* ============================================================
   veluwe.ts — verified content for area "Veluwe" (DATA, not engine).
   Ported verbatim from prototype/content-veluwe.jsx; only the window
   shim became ES exports. Consumed + typed via content/registry.ts.
   ============================================================ */

/* ============================================================
   content-veluwe.jsx — verified content for the area "Veluwe"
   Distilled from veluwe-research.md. This is DATA, not engine:
   every mission is a sequence of the 5 EF-engines wearing a
   research-true skin. Adding an area = a new file like this.
   Tone rules (research Deel 6): positive/caring only; vakterms
   are optional "knappe woorden"; never hardcode population numbers.
   ============================================================ */

/* ---- Animal registry (verified terms + kid-safe facts) ----
   simpelWoord = AVI M3/E3 default; vaktermen = optional bonus words.
   toonVeilig = research Deel-6 flag (theme is gentle/safe to show). */
const ANIMALS = {
  wildzwijn: {
    id: 'wildzwijn', naam: 'wild zwijn', simpelWoord: 'big',
    vaktermen: { groep: 'rotte', jong: 'frisling', man: 'keiler', vrouw: 'zeug', eenjarig: 'overloper' },
    geluid: 'knort', toonVeilig: true,
    feiten: [
      'Biggetjes dragen een gestreepte pyjama. Zo zie je ze bijna niet in het gras.',
      'Een zwijn kan goed zwemmen.',
      'Een zwijn ruikt heel goed. Maar het ziet slecht.',
    ],
    veiligheid: ['Niet voeren. Een zwijn zoekt zelf eten.'],
  },
  ree: {
    id: 'ree', naam: 'ree', simpelWoord: 'reekalf',
    vaktermen: { groep: 'sprong', jong: 'reekalf', man: 'bok', vrouw: 'geit' },
    geluid: 'blaft kort', toonVeilig: true,
    feiten: [
      'Een reekalf ligt heel stil in het gras. Het "drukt zich".',
      'Het ruikt bijna nergens naar. Zo blijft het veilig.',
      'De moeder is dichtbij. Ze komt het kalf zogen.',
    ],
    veiligheid: ['Een reekalf alleen? Niet aanraken. De moeder is vlakbij.'],
  },
  eekhoorn: {
    id: 'eekhoorn', naam: 'eekhoorn', simpelWoord: 'eekhoorn',
    vaktermen: { jong: 'jong', nest: 'nest' },
    geluid: 'tjikt', toonVeilig: true,
    feiten: ['De eekhoorn verstopt nootjes. Soms vergeet hij er een. Daar groeit een boom uit.'],
  },
  das: {
    id: 'das', naam: 'das', simpelWoord: 'das',
    vaktermen: { huis: 'burcht' }, geluid: 'snuift', toonVeilig: true,
    feiten: ['De das woont in een burcht. Dat is een huis onder de grond met veel gangen.'],
  },
  vos: {
    id: 'vos', naam: 'vos', simpelWoord: 'vos',
    vaktermen: { jong: 'welp', man: 'rekel', vrouw: 'moervos', huis: 'hol' },
    geluid: 'keft', toonVeilig: true,
    feiten: [
      'De vos heeft een grote pluimstaart. Die gebruikt hij als een warme sjaal.',
      'Een vos hoort heel goed. Hij hoort een muis lopen onder het gras.',
      'Welpen spelen samen voor het hol in de zon.',
    ],
  },
  edelhert: {
    id: 'edelhert', naam: 'edelhert', simpelWoord: 'hert',
    vaktermen: { groep: 'roedel', jong: 'kalf', man: 'hert', vrouw: 'hinde' },
    geluid: 'burlt', toonVeilig: true,
    feiten: ['Het gewei van een hert valt elk jaar af. En groeit dan weer aan.',
      'In de herfst burlt het hert heel hard. Zo roept hij andere herten.'],
  },
  raaf: {
    id: 'raaf', naam: 'raaf', simpelWoord: 'raaf',
    vaktermen: { jong: 'jong' }, geluid: 'roept kroa-kroa', toonVeilig: true,
    feiten: ['De raaf is heel slim. Hij roept “kroa-kroa”.',
      'Raven blijven hun hele leven bij dezelfde partner.'],
  },
  /* Step-1 distractor fauna (real Veluwe heath species) */
  heideblauwtje: { id: 'heideblauwtje', naam: 'heideblauwtje', simpelWoord: 'vlinder', toonVeilig: true,
    feiten: ['Een klein blauw vlindertje van de natte heide.'] },
  roodborsttapuit: { id: 'roodborsttapuit', naam: 'roodborsttapuit', simpelWoord: 'vogeltje', toonVeilig: true,
    feiten: ['Een klein vogeltje dat graag op de heide zit.'] },
  nachtzwaluw: { id: 'nachtzwaluw', naam: 'nachtzwaluw', simpelWoord: 'nachtvogel', geluid: 'ratelt', toonVeilig: true,
    feiten: ['Deze vogel slaapt overdag op de grond. Hij is heel goed verstopt.',
      'In het donker maakt hij een lang ratel-geluid.'] },
  /* Step-3 hazard, kept kind (research: schuw, niet "giftig = dodelijk") */
  adder: { id: 'adder', naam: 'adder', simpelWoord: 'slang', toonVeilig: true,
    feiten: ['De adder is heel schuw. Hij glijdt vanzelf weg.'],
    veiligheid: ['Een slang? Niet aanraken. Hou rustig afstand.'] },
};

/* ============================================================
   MISSIE 1 — De verdwaalde frisling  (heide · wild zwijn)
   Engines: zoeken → corsi → dagnacht
   ============================================================ */
const MISSIE_FRISLING = {
  id: 'frisling',
  titel: 'De verdwaalde frisling',
  landschap: 'heide',
  dier: 'wildzwijn',
  status: 'actief',
  verhaalHaak: 'spoor',     // §6.4: bringing the frisling home, you spot a cut fence + odd tracks
  kort: 'Een klein zwijntje is zijn groep kwijt. Breng hem veilig terug.',
  briefing: {
    simpel: [
      'Hoi ranger!',
      'Een klein big is zijn groep kwijt.',
      'Hij is nog maar net geboren.',
      'Hij is bang en alleen.',
      'Kun jij hem terugbrengen?',
      'Zoek hem eerst in het gras.',
    ],
    knap: [
      'Hoi ranger!',
      'Een frisling is zijn rotte kwijt.',
      'Dat is een jong wild zwijn.',
      'Hij is bang en alleen.',
      'Breng hem terug naar de groep.',
      'Zoek hem eerst in het gras.',
    ],
  },
  beloning: {
    badgeId: 'frisling-redder', badgeNaam: 'Frisling-redder',
    vaktermBadge: { id: 'knap-frisling', naam: 'Knap woord: frisling' },
  },
  stappen: [
    {
      ef: 'zoeken',
      skin: {
        dier: 'wildzwijn',
        copy: {
          instructie: 'Zoek de big in het gras.',
          instructieKnap: 'Zoek de frisling in het gras.',
          goed: 'Daar is hij! Hij drukt zich plat.',
        },
        doel: { x: 52, y: 58 },
        distractors: [
          { id: 'd1', x: 24, y: 44, k: 'bush', animal: 'struik' },
          { id: 'd2', x: 78, y: 40, k: 'bush', animal: 'struik' },
          { id: 'd3', x: 40, y: 70, k: 'bush', animal: 'struik' },
          { id: 'd4', x: 60, y: 34, k: 'bush', animal: 'struik' },
          { id: 'v1', x: 30, y: 30, k: 'butterfly', animal: 'heideblauwtje' },
          { id: 'b1', x: 70, y: 64, k: 'bird', animal: 'roodborsttapuit' },
          { id: 'b2', x: 16, y: 66, k: 'bird', animal: 'nachtzwaluw' },
          { id: 'd5', x: 86, y: 62, k: 'bush', animal: 'struik' },
        ],
        feit: 'Biggetjes dragen een gestreepte pyjama. Zo zie je ze bijna niet in het hoge gras.',
        feitDier: 'wildzwijn',
      },
      moeilijkheid: { afleiders: 'settings', lens: 'settings' },
    },
    {
      ef: 'corsi',
      skin: {
        copy: {
          instructie: 'Onthoud de weg van de groep.',
          instructieKnap: 'Onthoud de weg van de rotte.',
          toon: 'Kijk goed welke weg de groep liep…',
          terug: 'Wijs de weg terug.',
          goed: 'Precies de goede weg!',
        },
        feit: 'Een zwijn ruikt heel goed. Zo onthoudt het zelf ook de weg naar huis.',
        feitDier: 'wildzwijn',
      },
      moeilijkheid: { lengte: 'settings' },
    },
    {
      ef: 'dagnacht',
      skin: {
        copy: { instructie: 'Blijf rustig. Maak de goede keuze.' },
        /* flagship ranger rules (research Deel 3): the impulse is always
           tempting; the ranger remembers the rule. 'flip' = the encounter
           where the safe action is to GO (keeps the inhibition load real). */
        regels: ['Niet voeren', 'Reekalf niet aanraken'],
        encounters: [
          { id: 'reekalf', subject: 'reekalf', dier: 'ree',
            vraag: 'Een reekalf ligt heel stil in het gras. Het "drukt zich".',
            opties: [{ label: 'Aai het', goed: false }, { label: 'Laat het liggen', goed: true }],
            uitleg: 'Goed. De moeder is dichtbij. Ze komt het straks zogen.',
            gevolg: 'Het kalf schrikt en rent weg! Nu hangt jouw geur eraan. De moeder durft niet snel terug.',
            reactie: 'flee', eikelKost: 2, terug: 0.5 },
          { id: 'adder', subject: 'adder', dier: 'adder',
            vraag: 'Een adder zont op het warme zandpad.',
            opties: [{ label: 'Pak hem op', goed: false }, { label: 'Hou afstand', goed: true }],
            uitleg: 'Goed. De adder is schuw. Hij glijdt vanzelf weg.',
            gevolg: 'De adder sist en schiet vooruit! Net op tijd je hand weg. Het is de enige gifslang van Nederland.',
            reactie: 'rear', eikelKost: 2, terug: 0.4 },
          { id: 'voeren', subject: 'zwijn-honger', dier: 'wildzwijn',
            vraag: 'Een hongerig zwijn snuffelt aan je rugzak vol eikels.',
            opties: [{ label: 'Geef een koekje', goed: false }, { label: 'Niet voeren', goed: true }],
            uitleg: 'Goed. Een zwijn zoekt zelf eikels en wortels in de grond.',
            gevolg: 'Nu rent de hele rotte op je tas af en grist je eikels mee! Voeren mag niet — dieren mogen niet aan mensen wennen.',
            reactie: 'swarm', eikelKost: 3, terug: 0.6 },
          { id: 'modder', subject: 'modderpoel',
            vraag: 'Een diepe modderpoel ligt dwars over het pad.',
            opties: [{ label: 'Recht erdoor', goed: false }, { label: 'Loop eromheen', goed: true }],
            uitleg: 'Goed. Rustig eromheen. Zo blijf je droog en stevig.',
            gevolg: 'Je zakt weg in de blubber! Met natte laarzen glij je een stuk terug.',
            reactie: 'mud', eikelKost: 1, terug: 0.7 },
          { id: 'pad', subject: 'pad-veilig', flip: true,
            vraag: 'Het pad naar de rotte is nu vrij.',
            opties: [{ label: 'Blijf staan', goed: false }, { label: 'Loop rustig door', goed: true }],
            uitleg: 'Precies. De groep is vlakbij.',
            gevolg: 'Je blijft te lang staan. De rotte loopt verder de heide op!',
            reactie: 'recede', eikelKost: 0, terug: 0.8 },
        ],
      },
      moeilijkheid: { slowmo: 'settings', wissel: 'settings' },
    },
  ],
};

/* ============================================================
   MISSIE 2 — Het reekalf in het gras  (heide · ree)  [SEED]
   Status 'binnenkort' — data-only, proves Area holds many missions
   and reuses the SAME engines (zoeken + dagnacht) with a new skin.
   The research calls this the strongest second mission.
   ============================================================ */
const MISSIE_REE = {
  id: 'ree-niet-aanraken',
  titel: 'Het reekalf in het gras',
  landschap: 'heide',
  dier: 'ree',
  status: 'actief',
  payoff: 'moeder-keert-terug',         // inverted: you LEAVE the kalf; the mother returns
  kort: 'Een reekalf ligt alleen. Leer waarom je het met rust laat.',
  briefing: {
    simpel: [
      'Hoi ranger!',
      'Er ligt een reekalf in het gras.',
      'Het is helemaal alleen.',
      'Maar de moeder is dichtbij.',
      'Kijk goed. Niet aanraken.',
      'Zoek het kalf eerst in het gras.',
    ],
    knap: [
      'Hoi ranger!',
      'Een reekalf ligt in het gras.',
      'Het "drukt zich" heel stil.',
      'De geit is vlakbij. Dat is de moeder.',
      'Kijk goed. Niet aanraken.',
      'Zoek het kalf eerst in het gras.',
    ],
  },
  beloning: {
    badgeId: 'reekalf-wachter', badgeNaam: 'Reekalf-wachter',
    vaktermBadge: { id: 'knap-reegeit', naam: 'Knap woord: geit' },
  },
  stappen: [
    {
      ef: 'zoeken',
      skin: {
        dier: 'ree',
        copy: {
          instructie: 'Zoek het reekalf in het gras.',
          goed: 'Daar ligt het. Heel stil.',
        },
        doel: { x: 48, y: 60 },
        distractors: [
          { id: 'd1', x: 22, y: 42, k: 'bush', animal: 'struik' },
          { id: 'd2', x: 76, y: 38, k: 'bush', animal: 'struik' },
          { id: 'd3', x: 38, y: 72, k: 'bush', animal: 'struik' },
          { id: 'v1', x: 30, y: 30, k: 'butterfly', animal: 'heideblauwtje' },
          { id: 'b1', x: 70, y: 64, k: 'bird', animal: 'roodborsttapuit' },
          { id: 'b2', x: 18, y: 64, k: 'bird', animal: 'nachtzwaluw' },
          { id: 'd4', x: 84, y: 60, k: 'bush', animal: 'struik' },
          { id: 'd5', x: 60, y: 32, k: 'bush', animal: 'struik' },
        ],
        feit: 'Een reekalf ruikt bijna nergens naar. Zo blijft het veilig verstopt.',
        feitDier: 'ree',
      },
      moeilijkheid: { afleiders: 'settings', lens: 'settings' },
    },
    {
      ef: 'dagnacht',
      skin: {
        dier: 'ree',
        metgezel: 'geen',                 // the kalf stays put; the ranger patrols alone
        copy: { instructie: 'Niet aanraken. Blijf rustig op afstand.' },
        /* the impulse is always to help/touch; the ranger rule is to keep
           distance and trust the mother. One encounter FLIPS (the safe
           action is to quietly GO), keeping the inhibition load real. */
        regels: ['Niet aanraken', 'Hou afstand'],
        encounters: [
          { id: 'aai', subject: 'reekalf', dier: 'ree',
            vraag: 'Het reekalf ligt vlak bij je voet.',
            opties: [{ label: 'Aai het', goed: false }, { label: 'Laat het liggen', goed: true }],
            uitleg: 'Goed zo. De moeder haalt het straks zelf.',
            gevolg: 'Het kalf springt op en vlucht het struikgewas in! Jouw geur blijft achter. De geit wacht nu langer.',
            reactie: 'flee', eikelKost: 2, terug: 0.5 },
          { id: 'oppakken', subject: 'reekalf', dier: 'ree',
            vraag: 'Het kalf piept zacht. Lijkt het verdwaald?',
            opties: [{ label: 'Pak het op', goed: false }, { label: 'Stil weglopen', goed: true }],
            uitleg: 'Niet verdwaald. Het wacht gewoon op de moeder.',
            gevolg: 'Je tilt het bijna op — het spartelt en rent weg! Het was niet verdwaald, het wachtte op de geit.',
            reactie: 'flee', eikelKost: 2, terug: 0.5 },
          { id: 'geur', subject: 'reekalf', dier: 'ree',
            vraag: 'Je wilt het kalf aan je hand laten ruiken.',
            opties: [{ label: 'Hand bij de neus', goed: false }, { label: 'Handen thuis', goed: true }],
            uitleg: 'Jouw geur blijft hangen. Beter van niet.',
            gevolg: 'Nu ruikt het kalf naar mensen. Daardoor durft de geit minder snel terug te komen.',
            reactie: 'flee', eikelKost: 2, terug: 0.5 },
          { id: 'modder', subject: 'modderpoel',
            vraag: 'Een natte poel ligt op je weg terug.',
            opties: [{ label: 'Recht erdoor', goed: false }, { label: 'Loop eromheen', goed: true }],
            uitleg: 'Rustig eromheen. Zo schrik je het kalf niet op.',
            gevolg: 'Plons! Je zakt in de poel en het gespetter schrikt het kalf op.',
            reactie: 'mud', eikelKost: 1, terug: 0.7 },
          { id: 'moeder', subject: 'pad-veilig', flip: true,
            vraag: 'De geit komt eraan. Het pad is nu vrij.',
            opties: [{ label: 'Blijf staan', goed: false }, { label: 'Loop rustig weg', goed: true }],
            uitleg: 'Precies. Geef ze samen de ruimte.',
            gevolg: 'Je blijft te dichtbij staan. De geit schrikt en draait om!',
            reactie: 'recede', eikelKost: 0, terug: 0.8 },
        ],
        feit: 'De moeder laat haar kalf alleen. Zo trekt haar geur geen gevaar naar het kalf.',
        feitDier: 'ree',
      },
      moeilijkheid: { slowmo: 'settings', wissel: 'settings' },
    },
  ],
};

/* ============================================================
   MISSIE 3 — De nachtronde  (bos/heide · schemer)
   Engines: simon (geluid-echo) → wisselen (dag/nacht sorteren)
   Proves the two NEW engines in a short, in-context mission and
   hooks the difficulty knobs (simonLengte, wisselFreq). No rescue:
   the payoff is a calm dawn — the night was kept safe.
   ============================================================ */
const MISSIE_NACHTRONDE = {
  id: 'nachtronde',
  titel: 'De nachtronde',
  landschap: 'bos',
  dier: 'edelhert',
  status: 'actief',
  payoff: 'nachtronde',
  kort: 'Het wordt avond. Luister naar de dieren en breng ze op hun plek.',
  briefing: {
    simpel: [
      'Hoi ranger!',
      'Het wordt avond op de Veluwe.',
      'De dieren roepen in het donker.',
      'Luister goed en doe ze na.',
      'Wie hoort bij de dag? Wie bij de nacht?',
      'Begin met luisteren.',
    ],
    knap: [
      'Hoi ranger!',
      'Het schemert op de Veluwe.',
      'Het edelhert burlt. De raaf roept kroa.',
      'Luister goed en doe ze na.',
      'Sorteer dan dag-dieren en nacht-dieren.',
      'Begin met luisteren.',
    ],
  },
  beloning: {
    badgeId: 'nachtwacht', badgeNaam: 'Nachtwacht',
    vaktermBadge: { id: 'knap-burlen', naam: 'Knap woord: burlen' },
  },
  reunion: { sprite: 'edelhert', tekst: 'De nachtronde is klaar.' },
  stappen: [
    {
      ef: 'simon',
      skin: {
        dier: 'edelhert',
        dieren: ['edelhert', 'ree', 'wildzwijn', 'raaf'],
        copy: {
          instructie: 'Antwoord de dieren.',
          luister: 'Luister naar de dieren…',
          echo: 'Doe ze na. Tik de dieren.',
          goed: 'Knap onthouden!',
        },
        feit: 'In de herfst burlt het edelhert heel hard. Zo roept hij andere herten.',
        feitDier: 'edelhert',
      },
      // §6.1 simon knobs: sequence length + tempo
      moeilijkheid: { lengte: 'settings', tempo: 'settings' },
    },
    {
      ef: 'wisselen',
      skin: {
        dier: 'das',
        dagDieren: ['edelhert', 'ree'],
        nachtDieren: ['das', 'nachtzwaluw', 'wildzwijn'],
        trials: 8,
        copy: {
          instructie: 'Breng elk dier naar de goede plek.',
          regel: 'Dag-dier → open plek. Nacht-dier → het hol.',
          regelOm: 'Nu andersom! Volg het bordje.',
          goed: 'Alle dieren op de goede plek!',
        },
        feit: 'De das slaapt overdag in zijn burcht. ’s Nachts gaat hij op pad.',
        feitDier: 'das',
      },
      // §6.1 wisselen knobs: rule-flip frequency + trial count
      moeilijkheid: { wissel: 'settings', trials: 8 },
    },
  ],
};

/* ============================================================
   MISSIE 4 — De wildcamera  (bos · schemer · monitoring/Snapshot)
   Engines: simon (geluid-echo) → wisselen (dag/nacht sorteren)
   verhaalHaak 'camera': the camera also catches a shadowy figure +
   an empty snare (non-graphic) → drops the season's second clue.
   ============================================================ */
const MISSIE_WILDCAMERA = {
  id: 'wildcamera',
  titel: 'De wildcamera',
  landschap: 'bos',
  dier: 'das',
  status: 'actief',
  verhaalHaak: 'camera',
  kort: 'Hang de wildcamera op. Wie loopt er ’s nachts door het bos?',
  briefing: {
    simpel: [
      'Hoi ranger!',
      'We hangen een camera op in het bos.',
      'Die maakt vanzelf foto’s van dieren.',
      'Luister eerst wie er roept.',
      'Sorteer dan dag-dieren en nacht-dieren.',
      'Begin met luisteren.',
    ],
    knap: [
      'Hoi ranger!',
      'We plaatsen een wildcamera in het bos.',
      'Zo zien we welke dieren hier leven.',
      'Luister eerst goed wie er roept.',
      'Sorteer dan dag-dieren en nacht-dieren.',
      'Begin met luisteren.',
    ],
  },
  beloning: {
    badgeId: 'camera-wachter', badgeNaam: 'Camera-wachter',
    vaktermBadge: { id: 'knap-wildcamera', naam: 'Knap woord: wildcamera' },
  },
  reunion: { sprite: 'das', tekst: 'De camera bewaakt het bos.' },
  stappen: [
    {
      ef: 'simon',
      skin: {
        dier: 'das',
        dieren: ['das', 'wildzwijn', 'ree', 'raaf'],
        copy: {
          instructie: 'Antwoord de dieren.',
          luister: 'Luister wie er roept…',
          echo: 'Doe ze na. Tik de dieren.',
          goed: 'Knap onthouden!',
        },
        feit: 'Een wildcamera maakt heel veel foto’s. Zo weet de ranger wie er leeft.',
        feitDier: 'das',
      },
      moeilijkheid: { lengte: 'settings', tempo: 'settings' },
    },
    {
      ef: 'wisselen',
      skin: {
        dier: 'das',
        dagDieren: ['edelhert', 'ree'],
        nachtDieren: ['das', 'nachtzwaluw', 'wildzwijn'],
        trials: 8,
        copy: {
          instructie: 'Breng elk dier naar de goede plek.',
          regel: 'Dag-dier → open plek. Nacht-dier → het hol.',
          regelOm: 'Nu andersom! Volg het bordje.',
          goed: 'Alle dieren op de goede plek!',
        },
        feit: 'De das slaapt overdag in zijn burcht. ’s Nachts gaat hij op pad.',
        feitDier: 'das',
      },
      moeilijkheid: { wissel: 'settings', trials: 8 },
    },
  ],
};

/* ============================================================
   MISSIE 5 — De oversteek  (bos · ecoduct)
   Engines: corsi (volgorde van overstekers) → dagnacht (veilig oversteken)
   verhaalHaak 'band': tyre tracks lead away from the ven (clue 3).
   Reuses existing dagnacht Subject kinds — zero engine change.
   ============================================================ */
const MISSIE_ECODUCT = {
  id: 'ecoduct',
  titel: 'De oversteek',
  landschap: 'bos',
  dier: 'edelhert',
  status: 'actief',
  verhaalHaak: 'band',
  kort: 'Controleer het ecoduct. Steken de dieren veilig over?',
  briefing: {
    simpel: [
      'Hoi ranger!',
      'Een ecoduct is een brug voor dieren.',
      'Zo steken ze veilig over de weg.',
      'Kijk goed wie er oversteekt.',
      'Onthoud de weg die ze liepen.',
      'Laat de weg zien.',
    ],
    knap: [
      'Hoi ranger!',
      'Een ecoduct is een brug voor dieren.',
      'Zo steken ze veilig over de snelweg.',
      'Kijk in welke volgorde ze oversteken.',
      'Wijs daarna de weg terug.',
      'Laat de weg zien.',
    ],
  },
  beloning: {
    badgeId: 'ecoduct-wachter', badgeNaam: 'Ecoduct-wachter',
    vaktermBadge: { id: 'knap-ecoduct', naam: 'Knap woord: ecoduct' },
  },
  reunion: { sprite: 'edelhert', tekst: 'De dieren staken veilig over.' },
  stappen: [
    {
      ef: 'corsi',
      skin: {
        copy: {
          instructie: 'Onthoud de weg over het ecoduct.',
          toon: 'Kijk welke weg de dieren liepen…',
          terug: 'Wijs de weg terug.',
          goed: 'Precies de goede weg!',
        },
        feit: 'Soms steken wel duizenden dieren per jaar over een ecoduct.',
        feitDier: 'edelhert',
      },
      moeilijkheid: { lengte: 'settings' },
    },
    {
      ef: 'dagnacht',
      skin: {
        dier: 'edelhert',
        metgezel: 'geen',
        copy: { instructie: 'Blijf rustig. Houd de oversteek veilig.' },
        regels: ['Hou afstand', 'Loop rustig'],
        encounters: [
          { id: 'pad', subject: 'pad-veilig', flip: true,
            vraag: 'Het ecoduct is vrij. De dieren wachten op jou.',
            opties: [{ label: 'Blijf staan', goed: false }, { label: 'Wuif ze door', goed: true }],
            uitleg: 'Precies. Nu steken ze rustig over.',
            gevolg: 'Je twijfelt te lang. De dieren keren om en gaan terug.',
            reactie: 'recede', eikelKost: 0, terug: 0.6 },
          { id: 'slang', subject: 'adder', dier: 'adder',
            vraag: 'Een slang zont midden op het ecoduct.',
            opties: [{ label: 'Pak hem weg', goed: false }, { label: 'Hou afstand', goed: true }],
            uitleg: 'Goed. Hij glijdt zo vanzelf de struiken in.',
            gevolg: 'De slang schrikt en schiet weg! Beter rustig wachten tot hij zelf gaat.',
            reactie: 'rear', eikelKost: 1, terug: 0.5 },
          { id: 'modder', subject: 'modderpoel',
            vraag: 'Na de regen ligt er een plas op het ecoduct.',
            opties: [{ label: 'Recht erdoor', goed: false }, { label: 'Loop eromheen', goed: true }],
            uitleg: 'Goed. Rustig eromheen, dan schrik je niemand op.',
            gevolg: 'Je plonst erdoorheen. Het gespetter jaagt de dieren weg!',
            reactie: 'mud', eikelKost: 1, terug: 0.7 },
        ],
        feit: 'Ook slangen, marters en eekhoorns gebruiken het ecoduct.',
        feitDier: 'edelhert',
      },
      moeilijkheid: { slowmo: 'settings', wissel: 'settings' },
    },
  ],
};

/* ============================================================
   MISSIE 6 — De verstopte nootjes  (bos · eekhoorn)
   Engines: corsi (waar verstopte de eekhoorn de nootjes?) →
   simon (de eekhoorn tjikt een reeks — doe ze na). Pure fun, no
   story hook. Needs the new Eekhoorn sprite (additive, no engine change).
   ============================================================ */
const MISSIE_EEKHOORN = {
  id: 'eekhoorn',
  titel: 'De verstopte nootjes',
  landschap: 'bos',
  dier: 'eekhoorn',
  status: 'actief',
  kort: 'De eekhoorn verstopt nootjes. Help hem ze terug te vinden.',
  briefing: {
    simpel: [
      'Hoi ranger!',
      'De eekhoorn verstopt nootjes.',
      'Straks vergeet hij waar ze liggen.',
      'Kijk goed waar hij ze stopt.',
      'Wijs daarna de plekjes terug.',
      'Laat de weg zien.',
    ],
    knap: [
      'Hoi ranger!',
      'De eekhoorn legt een wintervoorraad aan.',
      'Hij verstopt nootjes door het hele bos.',
      'Onthoud de volgorde van de plekjes.',
      'Wijs ze daarna in volgorde terug.',
      'Laat de weg zien.',
    ],
  },
  beloning: {
    badgeId: 'nootjes-vinder', badgeNaam: 'Nootjes-vinder',
    vaktermBadge: { id: 'knap-wintervoorraad', naam: 'Knap woord: wintervoorraad' },
  },
  reunion: { sprite: 'eekhoorn', tekst: 'Alle nootjes terug. Knap gedaan.' },
  stappen: [
    {
      ef: 'corsi',
      skin: {
        copy: {
          instructie: 'Onthoud waar de nootjes liggen.',
          toon: 'Kijk waar de eekhoorn ze verstopt…',
          terug: 'Wijs de plekjes terug.',
          goed: 'Alle nootjes gevonden!',
        },
        feit: 'De eekhoorn vergeet soms een nootje. Daar groeit dan een boom uit.',
        feitDier: 'eekhoorn',
      },
      moeilijkheid: { lengte: 'settings' },
    },
    {
      ef: 'simon',
      skin: {
        dier: 'eekhoorn',
        dieren: ['eekhoorn', 'raaf', 'ree', 'das'],
        copy: {
          instructie: 'Antwoord de dieren in het bos.',
          luister: 'Luister wie er roept…',
          echo: 'Doe ze na. Tik de dieren.',
          goed: 'Knap onthouden!',
        },
        feit: 'De eekhoorn slaapt niet de hele winter. Hij wordt af en toe wakker om te eten.',
        feitDier: 'eekhoorn',
      },
      moeilijkheid: { lengte: 'settings', tempo: 'settings' },
    },
  ],
};

/* ============================================================
   VERHAALBOOG — one season on the Veluwe (HANDOFF §6.4 / §7.3 / plan §13.4)
   Data-driven: missions tagged verhaalHaak drop a clue; the case-board
   in the cabin renders them; finding them moves the season forward and
   resolves hopefully (report to the BOA → restoration). Kid-safe: every
   tense beat is one short sentence, off-screen, non-graphic, never sad.
   ============================================================ */
const VERHAALBOOG_VELUWE = {
  antagonist: { kind: 'stroper', naam: 'de stroper' },
  // each clue: one short, hopeful, non-graphic sentence; advances the season
  clues: {
    spoor:  { id: 'spoor',  soort: 'spoor',  hoofdstuk: 1, seizoen: 'lente',
              titel: 'Vreemde sporen', tekst: 'Bij een doorgeknipt hek staan vreemde laarssporen.',
              seizoenNa: 'zomer', hoofdstukNa: 2 },
    camera: { id: 'camera', soort: 'camera', hoofdstuk: 2, seizoen: 'zomer',
              titel: 'Op de foto', tekst: 'De wildcamera ziet een schimmige figuur. En een lege strik.',
              seizoenNa: 'herfst', hoofdstukNa: 3 },
    band:   { id: 'band',   soort: 'band',   hoofdstuk: 3, seizoen: 'herfst',
              titel: 'Bandensporen', tekst: 'Bandensporen leiden van het ven het bos uit.',
              seizoenNa: 'herfst', hoofdstukNa: 3 },
  },
  // hoofdstukken (content gate; season tint per chapter)
  hoofdstukken: [
    { n: 1, seizoen: 'lente',  naam: 'Kraamtijd', clue: 'spoor',  missies: ['frisling', 'ree-niet-aanraken'] },
    { n: 2, seizoen: 'zomer',  naam: 'Zomer',     clue: 'camera', missies: ['wildcamera', 'eekhoorn'] },
    { n: 3, seizoen: 'herfst', naam: 'Bronst',    clue: 'band',   missies: ['ecoduct', 'nachtronde'] },
    { n: 4, seizoen: 'winter', naam: 'Herstel',   clue: null,     missies: [] },
  ],
  // hopeful resolution once all three clues are found (diegetic, on the case-board)
  ontknoping: [
    { id: 'volg',    tekst: 'Je legt de foto’s en sporen naast elkaar.' },
    { id: 'meld',    tekst: 'Je meldt alles bij de BOA-boswachter.' },
    { id: 'herstel', tekst: 'De stroper stopt. De heide en het ven groeien terug.' },
  ],
};

/* ============================================================
   MISSIE VOS — De vos en zijn buren  (bos · vos)
   Proves the <Dier>-abstraction with a SECOND living 3D species
   (besides Alvah) wandering its own home zone in the world. The
   mini-game stays data: one `simon` (geluid-echo) step — the fox
   and its forest neighbours call a growing sequence, the child
   answers them back. Zero engine change; just a new skin + animal.
   ============================================================ */
const MISSIE_VOS = {
  id: 'vos',
  titel: 'De vos en zijn buren',
  landschap: 'bos',
  dier: 'vos',
  status: 'actief',
  kort: 'Een vos kift bij zijn hol. Luister naar de dieren en doe ze na.',
  briefing: {
    simpel: [
      'Hoi ranger!',
      'Bij het hol woont een vos.',
      'Hij roept naar de andere dieren.',
      'Luister goed en doe ze na.',
      'Begin met luisteren.',
    ],
    knap: [
      'Hoi ranger!',
      'Een vos kift bij zijn hol.',
      'De ree, de raaf en de das roepen terug.',
      'Luister goed en doe ze na.',
      'Begin met luisteren.',
    ],
  },
  beloning: {
    badgeId: 'vossen-spotter', badgeNaam: 'Vossen-spotter',
    vaktermBadge: { id: 'knap-welp', naam: 'Knap woord: welp' },
  },
  reunion: { sprite: 'vos', tekst: 'De vos is gerust. Hij draaft terug naar zijn hol.' },
  stappen: [
    {
      ef: 'simon',
      skin: {
        dier: 'vos',
        dieren: ['vos', 'ree', 'raaf', 'das'],
        copy: {
          instructie: 'Antwoord de vos en zijn buren.',
          luister: 'Luister wie er roept…',
          echo: 'Doe ze na. Tik de dieren.',
          goed: 'Knap onthouden!',
        },
        feit: 'De vos heeft een grote pluimstaart. Die gebruikt hij als een warme sjaal.',
        feitDier: 'vos',
      },
      moeilijkheid: { lengte: 'settings', tempo: 'settings' },
    },
  ],
};

/* ---- The Area record (art direction + missions live here) ---- */
const AREA_VELUWE = {
  id: 'veluwe',
  naam: 'Veluwe',
  status: 'actief',
  mapPin: { x: 52, y: 54 },
  tijdVanDag: 'ochtend',              // golden hour drives the warm palette
  palette: { accent: '#f5c23b', land: '#8b9249' },
  landschappen: ['heide', 'bos', 'stuifzand', 'ven'],
  vlaggenschipDieren: ['wildzwijn', 'ree', 'edelhert', 'eekhoorn', 'das'],
  verhaalboog: VERHAALBOOG_VELUWE,
  missies: [MISSIE_FRISLING, MISSIE_REE, MISSIE_WILDCAMERA, MISSIE_ECODUCT, MISSIE_EEKHOORN, MISSIE_NACHTRONDE, MISSIE_VOS],
};

export {
  ANIMALS, AREA_VELUWE, VERHAALBOOG_VELUWE,
  MISSIE_FRISLING, MISSIE_REE, MISSIE_NACHTRONDE,
  MISSIE_WILDCAMERA, MISSIE_ECODUCT, MISSIE_EEKHOORN, MISSIE_VOS,
};
