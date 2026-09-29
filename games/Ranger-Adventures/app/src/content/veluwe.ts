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
      'Biggetjes dragen een gestreepte pyjama. Zo zie je ze haast niet.',
      'Een zwijn kan goed zwemmen.',
      'Een zwijn ruikt heel goed. Maar het ziet slecht.',
    ],
    veiligheid: ['Niet voeren. Een zwijn zoekt zelf eten.'],
  },
  ree: {
    id: 'ree', naam: 'ree', simpelWoord: 'reekalf',
    vaktermen: { groep: 'sprong', jong: 'reekalf', man: 'bok', vrouw: 'reegeit' },
    geluid: 'blaft kort', toonVeilig: true,
    feiten: [
      'Een reekalf ligt stil in het gras. Het "drukt zich".',
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
    feiten: ['De das woont in een burcht. Dat is een hol onder de grond.'],
  },
  vos: {
    id: 'vos', naam: 'vos', simpelWoord: 'vos',
    vaktermen: { jong: 'welp', man: 'rekel', vrouw: 'moervos', huis: 'hol' },
    geluid: 'keft', toonVeilig: true,
    feiten: [
      'De vos heeft een grote pluimstaart. Die gebruikt hij als een warme sjaal.',
      'Een vos hoort heel goed. Hij hoort een muis onder het gras.',
      'Welpen spelen samen in de zon.',
    ],
  },
  edelhert: {
    id: 'edelhert', naam: 'edelhert', simpelWoord: 'hert',
    vaktermen: { groep: 'roedel', jong: 'kalf', man: 'hert', vrouw: 'hinde' },
    geluid: 'burlt', toonVeilig: true,
    feiten: ['Het gewei valt elk jaar af. En groeit dan weer aan.',
      'In de herfst burlt het hert hard. Zo roept hij andere herten.'],
  },
  raaf: {
    id: 'raaf', naam: 'raaf', simpelWoord: 'raaf',
    vaktermen: { jong: 'jong' }, geluid: 'roept kroa-kroa', toonVeilig: true,
    feiten: ['De raaf is heel slim. Hij roept “kroa-kroa”.',
      'Raven blijven hun hele leven samen.'],
  },
  /* Step-1 distractor fauna (real Veluwe heath species) */
  heideblauwtje: { id: 'heideblauwtje', naam: 'heideblauwtje', simpelWoord: 'vlinder', toonVeilig: true,
    feiten: ['Een klein blauw vlindertje van de heide.'] },
  roodborsttapuit: { id: 'roodborsttapuit', naam: 'roodborsttapuit', simpelWoord: 'vogeltje', toonVeilig: true,
    feiten: ['Een klein vogeltje van de heide.'] },
  nachtzwaluw: { id: 'nachtzwaluw', naam: 'nachtzwaluw', simpelWoord: 'nachtvogel', geluid: 'ratelt', toonVeilig: true,
    feiten: ['Deze vogel slaapt overdag op de grond. Hij is heel goed verstopt.',
      'In het donker maakt hij een ratelgeluid.'] },
  /* Step-3 hazard, kept kind (research: schuw, niet "giftig = dodelijk") */
  adder: { id: 'adder', naam: 'adder', simpelWoord: 'slang', toonVeilig: true,
    feiten: ['De adder is heel schuw. Hij glijdt vanzelf weg.'],
    veiligheid: ['Een slang? Niet aanraken. Hou rustig afstand.'] },
  heikikker: { id: 'heikikker', naam: 'heikikker', simpelWoord: 'kikker', geluid: 'blubbert zacht', toonVeilig: true,
    feiten: ['In het voorjaar wordt het mannetje blauw.',
      'De heikikker houdt van natte heide.'] },
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
      'Een kleine big is zijn groep kwijt.',
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
  reunion: { tekst: 'De moeder knort blij. Haar big is terug.' },
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
        feit: 'Biggetjes dragen een gestreepte pyjama. Zo zie je ze haast niet.',
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
        feit: 'Een zwijn ruikt heel goed. Zo vindt het zelf de weg terug.',
        feitDier: 'wildzwijn',
      },
      moeilijkheid: { lengte: 'settings' },
    },
    {
      ef: 'dagnacht',
      skin: {
        copy: { instructie: 'Blijf rustig. Maak de goede keuze.' },
        /* Rustkracht on the way home with the frisling: every round is about the
           piglet and its family (the rotte). The impulse is always tempting (aai,
           draag, voer, loop erheen); the ranger keeps the rule. 'flip' = the
           encounter where the safe action is to GO: the path to the rotte is free. */
        regels: ['Niet aanraken', 'Niet voeren'],
        encounters: [
          { id: 'aaien', subject: 'frisling', dier: 'wildzwijn', pose: 'ligt',
            vraag: 'De big piept zacht in het gras.',
            vraagKnap: 'De frisling piept zacht in het gras.',
            opties: [{ label: 'Aai hem', goed: false }, { label: 'Laat hem liggen', goed: true }],
            uitleg: 'Goed. Hij moet naar zijn moeder ruiken.',
            gevolg: 'Hij schrikt en rent weg.',
            reactie: 'flee', eikelKost: 2, terug: 0.5 },
          { id: 'zeug', subject: 'wildzwijn', dier: 'wildzwijn',
            vraag: 'De moeder staat bij haar biggen.',
            vraagKnap: 'De zeug staat bij haar biggen.',
            opties: [{ label: 'Loop naar de biggen', goed: false }, { label: 'Hou afstand', goed: true }],
            uitleg: 'Goed. Een moeder past goed op.',
            gevolg: 'De moeder knort hard. Ze wil rust.',
            gevolgKnap: 'De zeug knort hard. Ze wil rust.',
            reactie: 'rear', eikelKost: 2, terug: 0.4 },
          { id: 'voeren', subject: 'zwijn-honger', dier: 'wildzwijn',
            vraag: 'Een hongerig zwijn snuffelt aan je tas.',
            opties: [{ label: 'Geef een koekje', goed: false }, { label: 'Niet voeren', goed: true }],
            uitleg: 'Goed. Een zwijn zoekt zelf eten.',
            gevolg: 'Nu wil hij steeds meer. Dat is niet goed.',
            reactie: 'swarm', eikelKost: 3, terug: 0.6 },
          { id: 'dragen', subject: 'frisling', dier: 'wildzwijn',
            vraag: 'De big is moe. Hij loopt langzaam.',
            vraagKnap: 'De frisling is moe. Hij loopt langzaam.',
            opties: [{ label: 'Draag hem', goed: false }, { label: 'Loop rustig mee', goed: true }],
            uitleg: 'Goed. Hij loopt zelf. Jij wijst de weg.',
            gevolg: 'Hij schrikt en loopt weg. Hij loopt liever zelf.',
            reactie: 'flee', eikelKost: 1, terug: 0.7 },
          { id: 'pad', subject: 'rotte', dier: 'wildzwijn', flip: true,
            vraag: 'Daar is de groep! Het pad is vrij.',
            vraagKnap: 'Daar is de rotte! Het pad is vrij.',
            opties: [{ label: 'Blijf staan', goed: false }, { label: 'Loop rustig door', goed: true }],
            uitleg: 'Precies. De big is weer bij de groep.',
            uitlegKnap: 'Precies. De frisling is weer bij de rotte.',
            gevolg: 'Je wacht te lang. De groep loopt verder.',
            gevolgKnap: 'Je wacht te lang. De rotte loopt verder.',
            reactie: 'recede', eikelKost: 0, terug: 0.8 },
        ],
        feit: 'Een groep zwijnen heet een rotte. Biggen blijven dicht bij mama.',
        feitDier: 'wildzwijn',
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
      'De reegeit is vlakbij. Dat is de moeder.',
      'Kijk goed. Niet aanraken.',
      'Zoek het kalf eerst in het gras.',
    ],
  },
  beloning: {
    badgeId: 'reekalf-wachter', badgeNaam: 'Reekalf-wachter',
    vaktermBadge: { id: 'knap-reegeit', naam: 'Knap woord: reegeit' },
  },
  reunion: { sprite: 'ree', tekst: 'De moeder is terug bij haar kalf.' },
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
          { id: 'aai', subject: 'reekalf', dier: 'ree', pose: 'ligt',
            vraag: 'Het reekalf ligt vlak bij je voet.',
            opties: [{ label: 'Aai het', goed: false }, { label: 'Laat het liggen', goed: true }],
            uitleg: 'Goed zo. De moeder haalt het straks.',
            gevolg: 'Het kalf springt op en rent weg.',
            reactie: 'flee', eikelKost: 2, terug: 0.5 },
          { id: 'oppakken', subject: 'reekalf', dier: 'ree', pose: 'ligt',
            vraag: 'Het kalf piept zacht. Lijkt het verdwaald?',
            opties: [{ label: 'Pak het op', goed: false }, { label: 'Stil weglopen', goed: true }],
            uitleg: 'Niet verdwaald. Het wacht op de moeder.',
            gevolg: 'Het kalf schrikt en rent weg. Het wachtte op zijn moeder.',
            gevolgKnap: 'Het kalf schrikt en rent weg. Het wachtte op de reegeit.',
            reactie: 'flee', eikelKost: 2, terug: 0.5 },
          { id: 'geur', subject: 'reekalf', dier: 'ree', pose: 'ligt',
            vraag: 'Mag het kalf aan je hand ruiken?',
            opties: [{ label: 'Hand bij de neus', goed: false }, { label: 'Handen thuis', goed: true }],
            uitleg: 'Goed. Jouw geur blijft anders hangen.',
            gevolg: 'Nu ruikt het kalf naar jou. Dan durft de moeder niet te komen.',
            gevolgKnap: 'Nu ruikt het kalf naar jou. Dan durft de reegeit niet te komen.',
            reactie: 'rear', eikelKost: 2, terug: 0.5 },
          { id: 'modder', subject: 'modderpoel',
            vraag: 'Op je pad ligt een natte poel.',
            opties: [{ label: 'Recht erdoor', goed: false }, { label: 'Loop eromheen', goed: true }],
            uitleg: 'Rustig eromheen. Zo blijft het kalf rustig.',
            gevolg: 'Plons! Dat maakt veel lawaai.',
            reactie: 'mud', eikelKost: 1, terug: 0.7 },
          { id: 'moeder', subject: 'pad-veilig', flip: true,
            vraag: 'De moeder komt eraan. Het pad is vrij.',
            vraagKnap: 'De reegeit komt eraan. Het pad is vrij.',
            opties: [{ label: 'Blijf staan', goed: false }, { label: 'Loop rustig weg', goed: true }],
            uitleg: 'Precies. Geef ze samen de ruimte.',
            gevolg: 'Je staat te dichtbij. De moeder loopt weg.',
            gevolgKnap: 'Je staat te dichtbij. De reegeit loopt weg.',
            reactie: 'recede', eikelKost: 0, terug: 0.8 },
        ],
        feit: 'De moeder laat haar kalf even alleen. Zo blijft het kalf veilig.',
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
  kort: 'Het wordt avond. Luister naar de dieren. Breng ze op hun plek.',
  // Bram's field note (run 6): what he saw and what he asks, no "Hoi ranger!" (the voice
  // already says "Ranger Alvah." before the title)
  briefing: {
    simpel: [
      'Het wordt avond op de Veluwe.',
      'De dieren roepen in het donker.',
      'Luister goed en doe ze na.',
      'Wie hoort bij de dag? Wie bij de nacht?',
      'Begin met luisteren.',
    ],
    knap: [
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
  reunion: { sprite: 'edelhert', tekst: 'Het wordt licht. Alle dieren zijn veilig.' },
  stappen: [
    {
      ef: 'simon',
      skin: {
        dier: 'edelhert',
        dieren: ['edelhert', 'ree', 'wildzwijn', 'raaf'],
        copy: {
          instructie: 'Antwoord de dieren.',
          luister: 'Luister naar de dieren…',
          echo: 'Doe ze na. Tik op de dieren.',
          goed: 'Knap onthouden!',
        },
        feit: 'In de herfst burlt het edelhert hard. Zo roept hij andere herten.',
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
  kort: 'Hang de wildcamera op. Wie loopt ’s nachts door het bos?',
  briefing: {
    simpel: [
      'Hoi ranger!',
      'We hangen een camera in het bos.',
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
          echo: 'Doe ze na. Tik op de dieren.',
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
      'Een ecoduct is een brug voor dieren.',
      'Zo steken ze veilig over de weg.',
      'Gaat dat goed? Kijk jij even?',
      'Onthoud de weg die ze lopen.',
      'Wijs daarna de weg terug.',
    ],
    knap: [
      'Een ecoduct is een brug voor dieren.',
      'Zo steken ze veilig over de snelweg.',
      'Kijk in welke volgorde ze oversteken.',
      'Wijs daarna de weg terug.',
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
        feit: 'Soms steken hier duizenden dieren over.',
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
            gevolg: 'Je wacht te lang. De dieren lopen terug.',
            reactie: 'recede', eikelKost: 0, terug: 0.6 },
          { id: 'slang', subject: 'adder', dier: 'adder',
            vraag: 'Een slang zont midden op het ecoduct.',
            opties: [{ label: 'Pak hem weg', goed: false }, { label: 'Hou afstand', goed: true }],
            uitleg: 'Goed. Hij glijdt zo vanzelf de struiken in.',
            gevolg: 'De slang schrikt. Wacht tot hij zelf gaat.',
            reactie: 'rear', eikelKost: 1, terug: 0.5 },
          { id: 'modder', subject: 'modderpoel',
            vraag: 'Er ligt een plas op het ecoduct.',
            opties: [{ label: 'Recht erdoor', goed: false }, { label: 'Loop eromheen', goed: true }],
            uitleg: 'Goed. Rustig eromheen, dan schrik je niemand op.',
            gevolg: 'Plons! Dat maakt veel lawaai.',
            reactie: 'mud', eikelKost: 1, terug: 0.7 },
        ],
        feit: 'Ook slangen en eekhoorns gebruiken het ecoduct.',
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
          echo: 'Doe ze na. Tik op de dieren.',
          goed: 'Knap onthouden!',
        },
        feit: 'De eekhoorn slaapt niet de hele winter. Soms wordt hij wakker om te eten.',
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
   resolves hopefully (you tell Bram, the BOA → restoration). Kid-safe: every
   tense beat is one short sentence, off-screen, non-graphic, never sad.
   ============================================================ */
const VERHAALBOOG_VELUWE = {
  antagonist: { kind: 'stroper', naam: 'de stroper' },
  // each clue: one short, hopeful, non-graphic sentence; advances the season
  clues: {
    spoor:  { id: 'spoor',  soort: 'spoor',  hoofdstuk: 1, seizoen: 'lente',
              titel: 'Vreemde sporen', tekst: 'Iemand knipte het hek stuk. In het zand staan grote voetstappen.',
              seizoenNa: 'zomer', hoofdstukNa: 2 },
    camera: { id: 'camera', soort: 'camera', hoofdstuk: 2, seizoen: 'zomer',
              titel: 'Op de foto', tekst: 'Er staat een man op. Hij zet een val. De val is nog leeg.',
              seizoenNa: 'herfst', hoofdstukNa: 3 },
    band:   { id: 'band',   soort: 'band',   hoofdstuk: 3, seizoen: 'herfst',
              titel: 'Autosporen', tekst: 'Een auto reed weg bij het ven.',
              seizoenNa: 'herfst', hoofdstukNa: 3 },
  },
  // hoofdstukken (content gate; season tint per chapter)
  hoofdstukken: [
    { n: 1, seizoen: 'lente',  naam: 'Kraamtijd', clue: 'spoor',  missies: ['frisling', 'ree-niet-aanraken'] },
    { n: 2, seizoen: 'zomer',  naam: 'Zomer',     clue: 'camera', missies: ['wildcamera', 'ven', 'eekhoorn'] },
    { n: 3, seizoen: 'herfst', naam: 'Bronst',    clue: 'band',   missies: ['ecoduct', 'stuifzand', 'nachtronde'] },
    { n: 4, seizoen: 'winter', naam: 'Herstel',   clue: null,     missies: ['herstel'] },
  ],
  // hopeful resolution once all three clues are found (diegetic, on the case-board)
  ontknoping: [
    { id: 'volg',    tekst: 'Je legt de foto’s naast de sporen.' },
    { id: 'meld',    tekst: 'Je vertelt het aan Bram.' },
    { id: 'herstel', tekst: 'De stroper stopt. De heide en het ven groeien terug.' },
  ],
  // the season ends when every mission is done: one calm card, then free play in a
  // world where every family is home (the ontknoping plays first if not yet reported)
  finale: {
    kicker: 'Seizoen klaar · Veluwe',
    titel: 'Het is weer veilig op de Veluwe.',
    regels: [
      'Alle dieren zijn weer thuis.',
      'De heide en het ven groeien terug.',
      'Jij hebt goed op ze gepast.',
      'Loop maar rustig rond.',
    ],
  },
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
  kort: 'Een vos keft bij zijn hol. Luister naar de dieren. Doe ze na.',
  briefing: {
    simpel: [
      'Bij het hol woont een vos.',
      'Hij keft naar de andere dieren.',
      'Ze roepen allemaal terug.',
      'Luister goed en doe ze na.',
      'Begin met luisteren.',
    ],
    knap: [
      'Bij het hol woont een vos.',
      'Hij keft naar zijn buren.',
      'Ree, raaf en das roepen terug.',
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
          echo: 'Doe ze na. Tik op de dieren.',
          goed: 'Knap onthouden!',
        },
        feit: 'De vos heeft een grote pluimstaart. Die gebruikt hij als een warme sjaal.',
        feitDier: 'vos',
      },
      moeilijkheid: { lengte: 'settings', tempo: 'settings' },
    },
  ],
};

/* ============================================================
   MISSIE VEN — De kikker in het ven  (ven · heikikker)
   Engines: zoeken (vind de kikker tussen het riet) → dagnacht (blijf
   rustig bij de adder aan de waterkant). Vult het VEN-landschap.
   ============================================================ */
const MISSIE_VEN = {
  id: 'ven',
  titel: 'De kikker in het ven',
  landschap: 'ven',
  dier: 'heikikker',
  status: 'actief',
  kort: 'Een heikikker zit verstopt bij het ven. Vind hem en blijf rustig.',
  briefing: {
    simpel: [
      'Bij het ven zit een kleine kikker.',
      'Hij is goed verstopt in het riet.',
      'Kun jij hem vinden?',
      'Blijf rustig bij het water.',
    ],
    knap: [
      'In het ven zit een heikikker.',
      'Hij verstopt zich tussen het riet.',
      'Zoek hem en blijf rustig.',
      'Soms ligt een adder in de zon.',
    ],
  },
  beloning: {
    badgeId: 'ven-wachter', badgeNaam: 'Ven-wachter',
    vaktermBadge: { id: 'knap-ven', naam: 'Knap woord: ven' },
  },
  reunion: { sprite: 'heikikker', tekst: 'De kikker plonst terug het ven in.' },
  stappen: [
    {
      ef: 'zoeken',
      skin: {
        dier: 'heikikker',
        copy: {
          instructie: 'Zoek de kikker bij het water.',
          goed: 'Daar is hij! Hij zit doodstil.',
        },
        doel: { x: 48, y: 60 },
        distractors: [
          { id: 'r1', x: 22, y: 46, k: 'bush', animal: 'riet' },
          { id: 'r2', x: 74, y: 42, k: 'bush', animal: 'riet' },
          { id: 'r3', x: 38, y: 72, k: 'bush', animal: 'riet' },
          { id: 'v1', x: 30, y: 32, k: 'butterfly', animal: 'heideblauwtje' },
          { id: 'b1', x: 70, y: 64, k: 'bird', animal: 'roodborsttapuit' },
          { id: 'r4', x: 84, y: 60, k: 'bush', animal: 'riet' },
          { id: 'r5', x: 60, y: 34, k: 'bush', animal: 'riet' },
        ],
        feit: 'De heikikker zit stil bij het water. Zo zien roofvogels hem niet.',
        feitDier: 'heikikker',
      },
      moeilijkheid: { afleiders: 'settings', lens: 'settings' },
    },
    {
      ef: 'dagnacht',
      skin: {
        copy: { instructie: 'Blijf rustig bij het ven.' },
        regels: ['Slang? Hou afstand.', 'Water? Loop er omheen.'],
        metgezel: 'geen',
        encounters: [
          { id: 'adder-ven', subject: 'adder', dier: 'adder', vraag: 'Een adder ligt in de zon.',
            opties: [{ label: 'Aaien', goed: false }, { label: 'Hou afstand', goed: true }],
            uitleg: 'Rustig zo. Je laat hem met rust.', gevolg: 'De adder schrikt. Hou afstand.', reactie: 'rear' },
          { id: 'modder-ven', subject: 'modderpoel', vraag: 'De rand van het ven is zacht.',
            opties: [{ label: 'Erdoor', goed: false }, { label: 'Eromheen', goed: true }],
            uitleg: 'Goed. Je loopt om het natte stuk heen.', gevolg: 'Je zakt weg in de modder. Loop eromheen.', reactie: 'mud' },
          { id: 'pad-ven', subject: 'pad-veilig', flip: true, vraag: 'Het droge pad is vrij.',
            opties: [{ label: 'Wachten', goed: false }, { label: 'Loop door', goed: true }],
            uitleg: 'Precies. Hier mag je gewoon doorlopen.', gevolg: 'Dit pad is veilig. Loop maar door.', reactie: 'recede' },
        ],
        feit: 'Een ven is een ondiepe heideplas. Heel veel kleine dieren wonen erbij.',
        feitDier: 'heikikker',
      },
      moeilijkheid: { slowmo: 'settings' },
    },
  ],
};

/* ============================================================
   MISSIE STUIFZAND — Het zandhol  (stuifzand · nachtzwaluw)
   Engines: zoeken (spot de gecamoufleerde nachtzwaluw op het zand)
   → wisselen (sorteer dag- en nachtdieren). Vult het STUIFZAND-landschap.
   ============================================================ */
const MISSIE_STUIFZAND = {
  id: 'stuifzand',
  titel: 'Het stille zand',
  landschap: 'stuifzand',
  dier: 'nachtzwaluw',
  status: 'actief',
  verhaalHaak: 'band',     // tyre tracks lead out of the drifting sand
  kort: 'Een nachtzwaluw broedt op het kale zand. Vind hem en sorteer de dieren.',
  briefing: {
    simpel: [
      'Op het kale zand zit een vogel.',
      'Hij lijkt precies op het zand.',
      'Zoek hem heel goed.',
      'Daarna sorteer je de dieren.',
    ],
    knap: [
      'Op het stuifzand broedt een nachtzwaluw.',
      'Hij is bijna niet te zien.',
      'Zoek hem en sorteer dan de dieren.',
      'Welk dier hoort bij dag of nacht?',
    ],
  },
  beloning: {
    badgeId: 'zand-speurder', badgeNaam: 'Zand-speurder',
    vaktermBadge: { id: 'knap-stuifzand', naam: 'Knap woord: stuifzand' },
  },
  reunion: { sprite: 'nachtzwaluw', tekst: 'De nachtzwaluw blijft rustig op het nest.' },
  stappen: [
    {
      ef: 'zoeken',
      skin: {
        dier: 'nachtzwaluw',
        copy: {
          instructie: 'Zoek de vogel op het zand.',
          goed: 'Knap! Hij was bijna onzichtbaar.',
        },
        doel: { x: 56, y: 54 },
        distractors: [
          { id: 's1', x: 22, y: 44, k: 'bush', animal: 'pol gras' },
          { id: 's2', x: 76, y: 40, k: 'bush', animal: 'pol gras' },
          { id: 's3', x: 40, y: 70, k: 'bush', animal: 'pol gras' },
          { id: 's4', x: 60, y: 34, k: 'bush', animal: 'pol gras' },
          { id: 'v1', x: 30, y: 30, k: 'butterfly', animal: 'heideblauwtje' },
          { id: 'b1', x: 16, y: 64, k: 'bird', animal: 'roodborsttapuit' },
          { id: 's5', x: 86, y: 62, k: 'bush', animal: 'pol gras' },
        ],
        feit: 'De nachtzwaluw legt eieren op het zand. Haar veren lijken op dorre blaadjes.',
        feitDier: 'nachtzwaluw',
      },
      moeilijkheid: { afleiders: 'settings', lens: 'settings' },
    },
    {
      ef: 'wisselen',
      skin: {
        dier: 'nachtzwaluw',
        dagDieren: ['ree', 'eekhoorn'],
        nachtDieren: ['nachtzwaluw', 'das', 'wildzwijn'],
        trials: 8,
        copy: {
          instructie: 'Breng elk dier naar de goede plek.',
          regel: 'Dag-dier → open zand. Nacht-dier → het hol.',
          regelOm: 'Nu andersom! Volg het bordje.',
          goed: 'Alle dieren op de goede plek!',
        },
        feit: 'Overdag leven hier andere dieren. ’s Nachts weer andere.',
        feitDier: 'nachtzwaluw',
      },
      moeilijkheid: { wissel: 'settings', trials: 8 },
    },
  ],
};

/* ============================================================
   MISSIE HERSTEL — De winterronde  (winter · heide · edelhert)
   Engines: corsi (leid de kudde langs de veilige winterroute) →
   dagnacht (de "niet voeren"-regel; seed #19). De seizoensfinale:
   de stroper is gemeld, de heide en het ven groeien terug.
   ============================================================ */
const MISSIE_HERSTEL = {
  id: 'herstel',
  titel: 'De winterronde',
  landschap: 'heide',
  dier: 'edelhert',
  status: 'actief',
  payoff: 'De heide en het ven groeien terug. De dieren zijn veilig.',
  kort: 'Het is winter. Leid de kudde veilig. Hou je aan de regels.',
  briefing: {
    simpel: [
      'Het is koud op de heide.',
      'De stroper is gemeld bij Bram.',
      'Nu mag alles weer rustig groeien.',
      'Leid de kudde langs de veilige weg.',
    ],
    knap: [
      'Het is winter op de Veluwe.',
      'De stroper is gemeld bij Bram.',
      'De heide en het ven herstellen zich.',
      'Leid de kudde langs de veilige route.',
    ],
  },
  beloning: {
    badgeId: 'winter-ranger', badgeNaam: 'Winter-ranger',
    vaktermBadge: { id: 'knap-herstel', naam: 'Knap woord: herstel' },
  },
  reunion: { sprite: 'edelhert', tekst: 'De kudde trekt rustig verder. Het is weer veilig op de Veluwe.' },
  stappen: [
    {
      ef: 'corsi',
      skin: {
        copy: {
          instructie: 'Onthoud de veilige winterweg.',
          toon: 'Kijk goed welke weg veilig is…',
          terug: 'Wijs de weg terug.',
          goed: 'Precies! De kudde loopt veilig.',
        },
        feit: 'In de winter eten herten samen. Ze blijven dicht bij elkaar voor warmte.',
        feitDier: 'edelhert',
      },
      moeilijkheid: { lengte: 'settings' },
    },
    {
      ef: 'dagnacht',
      skin: {
        copy: { instructie: 'Blijf rustig. Hou je aan de regels.' },
        regels: ['Niet voeren.', 'Hou afstand.'],
        metgezel: 'geen',
        encounters: [
          { id: 'voer-winter', subject: 'zwijn-honger', dier: 'wildzwijn', vraag: 'De dieren hebben honger in de winter.',
            opties: [{ label: 'Brood geven', goed: false }, { label: 'Niet voeren', goed: true }],
            uitleg: 'Goed. Wilde dieren zoeken zelf hun eten.', gevolg: 'Nu willen ze steeds meer. Niet voeren.', reactie: 'swarm', eikelKost: 2 },
          { id: 'hert-winter', subject: 'reekalf', dier: 'edelhert', vraag: 'Een hert kijkt je rustig aan.',
            opties: [{ label: 'Aaien', goed: false }, { label: 'Rustig kijken', goed: true }],
            uitleg: 'Mooi rustig. Je laat hem met rust.', gevolg: 'Het hert schrikt en draaft weg. Blijf rustig.', reactie: 'flee' },
          { id: 'pad-winter', subject: 'pad-veilig', flip: true, vraag: 'De kudde mag verder.',
            opties: [{ label: 'Wachten', goed: false }, { label: 'Loop door', goed: true }],
            uitleg: 'Precies. Nu mag de kudde rustig verder.', gevolg: 'De weg is vrij. Loop maar door.', reactie: 'recede' },
        ],
        feit: 'Wilde dieren voeren is niet goed. Ze worden ziek van ons eten.',
        feitDier: 'edelhert',
      },
      moeilijkheid: { slowmo: 'settings' },
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
  missies: [
    MISSIE_FRISLING, MISSIE_REE, MISSIE_WILDCAMERA, MISSIE_VEN, MISSIE_ECODUCT,
    MISSIE_STUIFZAND, MISSIE_NACHTRONDE, MISSIE_EEKHOORN, MISSIE_VOS, MISSIE_HERSTEL,
  ],
};

export {
  ANIMALS, AREA_VELUWE, VERHAALBOOG_VELUWE,
  MISSIE_FRISLING, MISSIE_REE, MISSIE_NACHTRONDE,
  MISSIE_WILDCAMERA, MISSIE_ECODUCT, MISSIE_EEKHOORN, MISSIE_VOS,
  MISSIE_VEN, MISSIE_STUIFZAND, MISSIE_HERSTEL,
};
