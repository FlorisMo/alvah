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
  /* run 6: the squirrel's tree neighbours (De verstopte nootjes) */
  gaai: {
    id: 'gaai', naam: 'gaai', simpelWoord: 'gaai', geluid: 'krijst', toonVeilig: true,
    feiten: ['De gaai verstopt ook eikels. Soms pikt hij er een.'],
  },
  'groene-specht': {
    id: 'groene-specht', naam: 'groene specht', simpelWoord: 'specht', geluid: 'lacht', toonVeilig: true,
    feiten: ['De groene specht lacht hard. Hij eet graag mieren.'],
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
  /* run 7: the red deer's hind (the wildcamera's evening visitors): no antlers */
  hinde: {
    id: 'hinde', naam: 'hinde', simpelWoord: 'hert', geluid: 'blaft zacht', toonVeilig: true,
    feiten: ['Een hinde heeft geen gewei.'],
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
    // (no "Hoi ranger!": the voice already says "Ranger <naam>." before the title)
    // run 6: the briefing names what the child can already hear and see in the world:
    // the squeak, and the group rooting at the mud
    simpel: [
      'Hoor je dat? Er piept iets.',
      'Een kleine big is zijn groep kwijt.',
      'Hij is bang en alleen.',
      'Zijn groep is bij de modderpoel.',
      'Kun jij hem terugbrengen?',
    ],
    knap: [
      'Hoor je dat? Er piept iets.',
      'Een frisling is zijn rotte kwijt.',
      'Dat is een jong wild zwijn.',
      'De rotte is bij de modderpoel.',
      'Breng hem terug naar de groep.',
    ],
  },
  beloning: {
    badgeId: 'frisling-redder', badgeNaam: 'Frisling-redder',
    vaktermBadge: { id: 'knap-frisling', naam: 'Knap woord: frisling' },
  },
  reunion: { tekst: 'De moeder knort blij. Haar big is terug.' },
  /* run 6: De verdwaalde frisling as an adventure in the world (render3d/adventure/
     missions/frisling.ts): follow the squeak, find him in the bracken, lead him home
     along the group's route, keep calm with the family. One line per beat. */
  avontuur: {
    simpel: {
      kijk: 'Daar is zijn groep.',
      volg: 'Volg het gepiep.',
      chipPiep: 'Het gepiep',
      luister: 'luister goed',
      zoek: 'Waar is de big? Tik op hem.',
      mis: 'Hier niet. Zoek verder.',
      hint: 'Hoor je hem piepen?',
      // run 6 polish: two rustkracht moments played with the body (no card): hands still
      // while the piglet squeaks right in front of him, feet still while the sow looks up
      raakNiet: 'Hij is bang. Raak hem niet aan.',
      schrok: 'Hij schrok van je hand.',
      leid: 'Loop rustig. Hij loopt mee.',
      chipWroet: 'De wroetplek',
      nietRennen: 'Niet rennen. Dan schrikt hij.',
      terugKomen: 'Rustig maar. Daar komt hij.',
      wacht: 'De big wacht op je.',
      chipBig: 'De big',
      routeKijk: 'Kijk goed welke weg de groep liep.',
      routeWijs: 'Wijs de weg. Tik op de plekken.',
      routeMis: 'Hier niet. Kijk nog een keer.',
      breng: 'Breng hem naar de modderpoel.',
      chipModder: 'De modderpoel',
      komt: 'Er komt een jong zwijn.',
      staStil: 'De moeder kijkt. Sta heel stil.',
      hek: 'Kijk. Het hek is stuk.',
      // run 7: the way south passes the family (unmeasured: never logged)
      boog: 'Loop met een boog om de groep.',
      teDichtbij: 'Niet zo dichtbij. De moeder kijkt.',
      // run 7 (package body): the last three cards are played with the body. The tired
      // piglet: walk slowly with him (a run: he hides); the hungry one at his bag: hands
      // still; the free path at the mud: walk on (waiting too long: the group goes on)
      moe: 'Hij is moe. Loop rustig mee.',
      nietRennenMoe: 'Niet rennen. Hij is moe.',
      eten: 'Hij wil eten. Hou je handen stil.',
      padVrij: 'Het pad is vrij. Loop maar.',
      teLang: 'Je wacht te lang.',
      chipPad: 'Het pad',
    },
    knap: {
      kijk: 'Daar is zijn rotte.',
      zoek: 'Waar is de frisling? Tik op hem.',
      hint: 'Hoor je de frisling piepen?',
      wacht: 'De frisling wacht op je.',
      chipBig: 'De frisling',
      routeKijk: 'Kijk goed welke weg de rotte liep.',
      breng: 'Breng hem naar de zoel.',
      chipModder: 'De zoel',
      komt: 'Daar komt een overloper.',
      staStil: 'De zeug kijkt. Sta heel stil.',
      boog: 'Loop met een boog om de rotte.',
      teDichtbij: 'Niet zo dichtbij. De zeug kijkt.',
      moe: 'De frisling is moe. Loop rustig mee.',
    },
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
        /* run 7: the calm moments come in a drawn order each play (the 2D floor plays the
           same order from the same seed): first the lying piglet (big), then on the way
           home the tired piglet and the hungry one in either order (weg), then at the
           mud the sow's stare and the free path in either order (thuis; the flip is
           never first) */
        rustPlan: [{ slot: 'big' }, { slot: 'weg' }, { slot: 'thuis' }],
        encounters: [
          { id: 'aaien', slot: 'big', subject: 'frisling', dier: 'wildzwijn', pose: 'ligt',
            vraag: 'De big piept zacht in het gras.',
            vraagKnap: 'De frisling piept zacht in het gras.',
            opties: [{ label: 'Aai hem', goed: false }, { label: 'Laat hem liggen', goed: true }],
            uitleg: 'Goed. Hij moet naar zijn moeder ruiken.',
            gevolg: 'Hij schrikt en rent weg.',
            reactie: 'flee', eikelKost: 2, terug: 0.5 },
          { id: 'dragen', slot: 'weg', subject: 'frisling', dier: 'wildzwijn',
            vraag: 'De big is moe. Hij loopt langzaam.',
            vraagKnap: 'De frisling is moe. Hij loopt langzaam.',
            opties: [{ label: 'Draag hem', goed: false }, { label: 'Loop rustig mee', goed: true }],
            uitleg: 'Goed. Hij loopt zelf. Jij wijst de weg.',
            gevolg: 'Hij schrikt en loopt weg. Hij loopt liever zelf.',
            reactie: 'flee', eikelKost: 1, terug: 0.7 },
          // run 6: at the wallow it is the family's yearling (last year's young) that
          // comes to sniff the ranger's bag
          { id: 'voeren', slot: 'weg', subject: 'zwijn-honger', dier: 'overloper',
            vraag: 'Een jong zwijn snuffelt aan je tas.',
            vraagKnap: 'De overloper snuffelt aan je tas.',
            // (the right answer is what he DOES, never the rule chip's own words: a child
            // keeps the rule, he does not match the card's text to it)
            opties: [{ label: 'Geef een koekje', goed: false }, { label: 'Hou je tas dicht', goed: true }],
            uitleg: 'Goed. Een zwijn zoekt zelf eten.',
            gevolg: 'Nu wil hij steeds meer. Dat is niet goed.',
            reactie: 'swarm', eikelKost: 3, terug: 0.6 },
          { id: 'zeug', slot: 'thuis', subject: 'wildzwijn', dier: 'wildzwijn',
            vraag: 'De moeder staat bij haar biggen.',
            vraagKnap: 'De zeug staat bij haar biggen.',
            opties: [{ label: 'Loop naar de biggen', goed: false }, { label: 'Hou afstand', goed: true }],
            uitleg: 'Goed. Een moeder past goed op.',
            gevolg: 'De moeder knort hard. Ze wil rust.',
            gevolgKnap: 'De zeug knort hard. Ze wil rust.',
            reactie: 'rear', eikelKost: 2, terug: 0.4 },
          { id: 'pad', slot: 'thuis', subject: 'rotte', dier: 'wildzwijn', flip: true,
            vraag: 'Kijk, de groep! Het pad is vrij.',
            vraagKnap: 'Kijk, de rotte! Het pad is vrij.',
            opties: [{ label: 'Blijf staan', goed: false }, { label: 'Loop rustig door', goed: true }],
            uitleg: 'Goed zo. Geef de big de ruimte.',
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
    // (no "Hoi ranger!": the voice already says "Ranger <naam>." before the title)
    // run 6: the briefing names what the child can already see in the world: the
    // mother grazing by the copse (so the calf is not lost at all)
    simpel: [
      'Een wandelaar belde ons op.',
      'Hij zag een reekalf, helemaal alleen.',
      'Is het verdwaald? Dat denkt hij.',
      'Maar kijk: de moeder eet vlakbij.',
      'Zoek het kalf. Niet aanraken!',
    ],
    knap: [
      'Een wandelaar belde ons op.',
      'Hij zag een reekalf, helemaal alleen.',
      'Is het verdwaald? Dat denkt hij.',
      'De reegeit graast vlakbij. Dat is mama.',
      'Zoek het kalf. Niet aanraken!',
    ],
  },
  beloning: {
    badgeId: 'reekalf-wachter', badgeNaam: 'Reekalf-wachter',
    vaktermBadge: { id: 'knap-reegeit', naam: 'Knap woord: reegeit' },
  },
  reunion: { sprite: 'ree', tekst: 'De moeder is terug bij haar kalf.' },
  /* run 6: Het reekalf in het gras as an adventure in the world (render3d/adventure/
     missions/ree.ts): the mother seen at the copse, her prints to the tall grass, the
     calf found and left alone, a quiet walk to the hide, and the mother coming back.
     One line per beat. */
  avontuur: {
    simpel: {
      kijk: 'Kijk. Daar eet de moeder.',
      kijkLoopt: 'Kijk. Daar loopt de moeder.',
      volg: 'Volg de sporen naar het gras.',
      chipGras: 'Het hoge gras',
      sporen: 'kijk naar de sporen',
      weg: 'Ze loopt de struiken in.',
      zoek: 'Waar ligt het kalf? Tik op hem.',
      mis: 'Hier niet. Zoek verder.',
      hint: 'Het kalf piept zacht. Zie je het?',
      stil: 'Loop stil naar de schuilplek.',
      chipHut: 'De schuilplek',
      zacht: 'loop, niet rennen',
      sst: 'Sst. Loop stil.',
      verstop: 'Verstop je bij de struik.',
      raakNiet: 'Raak het kalf niet aan.',
      snuffelt: 'Het kalf snuffelt. Hou je handen thuis.',
      opstaan: 'Het kalf staat op. Handen thuis.',
      eromheen: 'Loop om de poel heen.',
      chipRond: 'Om de poel',
      wacht: 'Wacht stil. Kijk naar de struiken.',
      staStil: 'Sta stil. Anders schrikt ze.',
      daar: 'Daar is de moeder!',
      ruikt: 'Ze ruikt aan haar kalf.',
      // run 7 (ree-growth): the watch, a line every few seconds from small pools
      // (missions/ree.variety.ts WATCH_LINES), each read aloud once
      hoor: 'Hoor je dat?',
      ritselt: 'Er ritselt iets.',
      luistert: 'Ze luistert. Sta heel stil.',
      hoortIets: 'Ze hoort iets. Sta stil.',
      stilLuister: 'Stil. Ze luistert goed.',
      hapje: 'Ze eet een hapje gras.',
      knabbelt: 'Ze knabbelt aan het gras.',
      omZich: 'Ze kijkt om zich heen.',
      hierheen: 'Ze kijkt hierheen. Sta stil.',
      roept: 'Ze roept zacht.',
      kalfKomt: 'Daar komt het kalf!',
      // run 7 (ree-discover): a cuckoo calls in one of her listening pauses (after its
      // call); a second calf comes out to her at the reunion (the rare twins)
      koekoek: 'Hoor je de koekoek?',
      tweeling: 'Kijk! Een tweeling!',
      // the flip played with his feet: he walks away himself
      loopWeg: 'Mama is terug. Loop stil weg.',
      chipWeg: 'Een eindje weg',
    },
    knap: {
      kijk: 'Kijk. Daar graast de reegeit.',
      kijkLoopt: 'Kijk. Daar loopt de reegeit.',
      volg: 'Volg haar prenten naar het gras.',
      sporen: 'kijk naar de prenten',
      weg: 'De reegeit loopt de struiken in.',
      daar: 'Daar is de reegeit!',
      loopWeg: 'De reegeit is terug. Loop stil weg.',
    },
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
        /* run 7: the calf lies in one of four spots of the tall grass, never in the
           middle (drawn from the play's seed: render3d/adventure/missions/ree.variety.ts);
           `doel` is the first, for anything that reads one. The look-alikes stand clear
           of every spot (≥ 0.6 m in the grass), so the cover never marks the real one. */
        doel: { x: 10, y: 26 },
        doelen: [{ x: 10, y: 26 }, { x: 90, y: 26 }, { x: 10, y: 72 }, { x: 90, y: 72 }],
        distractors: [
          { id: 'd1', x: 46, y: 45, k: 'bush', animal: 'struik' },
          { id: 'd2', x: 90, y: 50, k: 'bush', animal: 'struik' },
          { id: 'd3', x: 10, y: 52, k: 'bush', animal: 'struik' },
          { id: 'v1', x: 52, y: 18, k: 'butterfly', animal: 'heideblauwtje' },
          { id: 'b1', x: 54, y: 80, k: 'bird', animal: 'roodborsttapuit' },
          { id: 'b2', x: 30, y: 12, k: 'bird', animal: 'nachtzwaluw' },
          { id: 'd4', x: 68, y: 88, k: 'bush', animal: 'struik' },
          { id: 'd5', x: 69, y: 13, k: 'bush', animal: 'struik' },
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
          { id: 'geur', subject: 'reekalf', dier: 'ree', pose: 'ligt',
            vraag: 'Mag het kalf aan je hand ruiken?',
            opties: [{ label: 'Hand bij de neus', goed: false }, { label: 'Handen thuis', goed: true }],
            uitleg: 'Goed. Jouw geur blijft anders hangen.',
            gevolg: 'De moeder ruikt jou. Ze blijft weg.',
            gevolgKnap: 'De reegeit ruikt jou. Ze blijft weg.',
            reactie: 'rear', eikelKost: 2, terug: 0.5 },
          { id: 'oppakken', subject: 'reekalf', dier: 'ree', pose: 'ligt',
            vraag: 'Het kalf piept zacht. Lijkt het verdwaald?',
            opties: [{ label: 'Pak het op', goed: false }, { label: 'Stil weglopen', goed: true }],
            uitleg: 'Niet verdwaald. Het wacht op de moeder.',
            gevolg: 'Het kalf schrikt en rent weg.',
            reactie: 'flee', eikelKost: 2, terug: 0.5 },
          { id: 'modder', subject: 'modderpoel',
            vraag: 'Op je pad ligt een natte poel.',
            opties: [{ label: 'Recht erdoor', goed: false }, { label: 'Loop eromheen', goed: true }],
            uitleg: 'Rustig eromheen. Zo blijft het kalf rustig.',
            gevolg: 'Plons! Dat maakt veel lawaai.',
            reactie: 'mud', eikelKost: 1, terug: 0.7 },
          { id: 'moeder', subject: 'pad-veilig', flip: true,
            vraag: 'Mama is terug. Het pad is vrij.',
            vraagKnap: 'De reegeit is terug. Pad vrij!',
            opties: [{ label: 'Blijf staan', goed: false }, { label: 'Loop rustig weg', goed: true }],
            uitleg: 'Precies. Geef ze samen de ruimte.',
            gevolg: 'Te dichtbij. De moeder loopt weg.',
            gevolgKnap: 'Te dichtbij. De reegeit loopt weg.',
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
   MISSIE 4 — De wildcamera  (bos · een wildwissel · dag en nacht)
   Engines: wisselen (de camera richten, dag ↔ nacht) → simon (de nachtroepers)
   verhaalHaak 'camera': the morning photo shows a calm grey man setting an
   empty snare (non-graphic) → drops the season's second clue.
   Run 6: an adventure in the world (render3d/adventure/missions/wildcamera.ts):
   follow a game trail, strap the camera to a pine, aim it for each animal as
   day turns into night, echo the night callers, find the snare in the photos.
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
    // (no "Hoi ranger!": the voice already says "Ranger <naam>." before the title)
    simpel: [
      'Hier ligt een camera voor dieren.',
      'Die maakt vanzelf foto’s.',
      'Wie komt er ’s nachts langs?',
      'Volg het paadje van de dieren.',
      'Hang de camera aan een boom.',
    ],
    knap: [
      'Hier ligt een wildcamera.',
      'Die maakt vanzelf foto’s van dieren.',
      'Wie komt er ’s nachts langs?',
      'Volg de wildwissel van de dieren.',
      'Hang de camera bij de kruising.',
    ],
  },
  beloning: {
    badgeId: 'camera-wachter', badgeNaam: 'Camera-wachter',
    vaktermBadge: { id: 'knap-wildcamera', naam: 'Knap woord: wildcamera' },
  },
  reunion: { sprite: 'das', tekst: 'De camera bewaakt het bos.' },
  /* run 6: the adventure's words, one short line per beat (read aloud once) */
  avontuur: {
    simpel: {
      pak: 'Hier ligt de camera.',
      // run 7 (wc-hands): no buttons; he does it himself ("Tik" becomes "Klik" with a mouse)
      pakKlik: 'Tik op de camera.',
      kijkPad: 'Kijk. Daar gaat het paadje.',
      vosSporen: 'Verse sporen! Wie liep hier?', // (run 7, wc-album: the fox's prints)
      volg: 'Volg het paadje van de dieren.',
      chipPad: 'Het dierenpaadje',
      sporen: 'kijk naar de sporen',
      hang: 'Hier kruisen twee paadjes.',
      hangBoom: 'Hang de camera aan de dikke boom.',
      hangt: 'Het rode lampje knippert.',
      test: 'Loop eens langs de camera.',
      chipTest: 'Voor de camera',
      cueTest: 'loop door het licht',
      selfie: 'Klik! Daar sta jij.',
      vraag: 'Waar kijkt de camera?',
      // run 7: the animal steps onto the crossing first; the card names what he SEES
      kijk_edelhert: 'Kijk, een hert.',
      kijk_hinde: 'Kijk, een hert.',
      kijk_ree: 'Kijk, een ree.',
      kijk_gaai: 'Kijk, een gaai.',
      kijk_das: 'Kijk, een das.',
      kijk_nachtzwaluw: 'Kijk, een nachtzwaluw.',
      kijk_wildzwijn: 'Kijk, een wild zwijn.',
      kijk_vos: 'Kijk, een vos.',
      foto: 'Klik! Een mooie foto.',
      leeg: 'Leeg. Het dier is daar nu niet.',
      nacht: 'Het wordt nacht.',
      dag: 'Het wordt dag.',
      andersom: 'Nu is het andersom!',
      donker: 'Het wordt donker in het bos.',
      nachtKomt: 'Het is nacht. Wie komt er?',
      groei: 'Goed zo! Nu komt er een bij.',
      opnieuw: 'Luister nog een keer.',
      slapen: 'De dieren gaan weer weg.',
      ochtend: 'De volgende ochtend…',
      fotos: 'Wat zag de camera?',
      fotoTitel: 'De foto’s van de camera',
      // run 7: each photo's own line as he flips to it
      fotoJij: 'Jij!',
      foto_edelhert: 'Een hert.',
      foto_hinde: 'Een hert.',
      foto_ree: 'Een ree.',
      foto_gaai: 'Een gaai.',
      foto_das: 'Een das.',
      foto_nachtzwaluw: 'Een nachtzwaluw.',
      foto_wildzwijn: 'Een wild zwijn.',
      foto_vos: 'Een vos.',
      // run 7 (wc-album): the night's surprises and the rare ones
      foto_neus: 'Wie is dat? Een neus!',
      foto_vosjes: 'Een vos met jongen.',
      vosjes: 'Kijk! Een vos met jongen.',
      witteRee: 'Een witte ree! Heel bijzonder.',
      man: 'Kijk! Een man zet een val.',
      waar: 'Waar is dit?',
      zoekVal: 'Zoek de val bij het paadje.',
      chipVal: 'De val',
      bijPad: 'bij het paadje',
      zieVal: 'Zie je de val?',
      valWeg: 'Goed zo. De val is weg.',
      terug: 'Loop terug naar je camera.',
      chipCamera: 'Je camera',
      bijBoom: 'bij de grote boom',
    },
    knap: {
      pak: 'Hier ligt de wildcamera.',
      kijkPad: 'Kijk. Daar gaat de wildwissel.',
      vosSporen: 'Verse prenten! Wie liep hier?',
      volg: 'Volg de wildwissel.',
      chipPad: 'De wildwissel',
      hang: 'Hier kruisen twee wildwissels.',
      kijk_edelhert: 'Kijk, een edelhert.',
      kijk_hinde: 'Kijk, een hinde.',
      pakKlik: 'Tik op de wildcamera.',
      hangBoom: 'Hang de wildcamera aan de dikke boom.',
      test: 'Loop eens langs de wildcamera.',
      foto_edelhert: 'Een edelhert.',
      foto_hinde: 'Een hinde.',
      foto_neus: 'Wie is dat? Een snuit!',
      foto_vosjes: 'Een vos met welpen.',
      vosjes: 'Kijk! Een vos met welpen.',
      man: 'Kijk! Een stroper zet een strik.',
      zoekVal: 'Zoek de strik bij de wildwissel.',
      chipVal: 'De strik',
      zieVal: 'Zie je de strik?',
      valWeg: 'Goed zo. De strik is weg.',
      terug: 'Loop terug naar de wildcamera.',
      chipCamera: 'De wildcamera',
    },
  },
  stappen: [
    {
      ef: 'wisselen',
      skin: {
        dier: 'das',
        // run 7: who may come this evening (the pure core draws the round from them with the
        // play's seed: three of four of each at six photos, every one at eight)
        dagDieren: ['edelhert', 'hinde', 'ree', 'gaai'],
        nachtDieren: ['das', 'nachtzwaluw', 'wildzwijn', 'vos'],
        // run 6 polish: six photos (each night animal once, never one twice in a row):
        // a short, lively round with the flip to night as its peak. Run 7: the most a round
        // may have; the level's knobs say how many (6 at first, 8 from band 3 with a turn
        // back to day from band 4, 10 from band 5)
        trials: 10,
        copy: {
          instructie: 'Richt de camera op elk dier.',
          regel: 'Dag-dier → open plek. Nacht-dier → het bosje.',
          regelOm: 'Nu is het andersom!',
          goed: 'Alle dieren staan op de foto!',
        },
        feit: 'De das slaapt overdag in zijn burcht. ’s Nachts gaat hij op pad.',
        feitDier: 'das',
      },
      // §6.1 wisselen knobs: rule-flip frequency + trial count
      moeilijkheid: { wissel: 'settings', trials: 10 },
    },
    {
      ef: 'simon',
      skin: {
        dier: 'das',
        // run 6: the night callers round the crossing
        dieren: ['das', 'wildzwijn', 'ree', 'nachtzwaluw'],
        // run 7: who may call (engines/simon simonCast): the badger always, three of the
        // others with the play's seed (four callers every night, on the 2D floor as well)
        roepPool: ['das', 'wildzwijn', 'ree', 'nachtzwaluw', 'vos'],
        copy: {
          instructie: 'Luister wie er roept.',
          luister: 'Luister wie er roept…',
          echo: 'Doe ze na. Tik op de dieren.',
          goed: 'Knap onthouden!',
        },
        feit: 'Een wildcamera maakt heel veel foto’s. Zo weet jij wie er leeft.',
        feitDier: 'das',
      },
      moeilijkheid: { lengte: 'settings', tempo: 'settings' },
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
    // run 7: at the real ecoduct — he watches from behind a screen who comes over the
    // bridge, reads their way over the sand bed, and keeps out of their way
    simpel: [
      'Een ecoduct is een brug voor dieren.',
      'Welke dieren steken er over?',
      'Kijk stil achter het scherm.',
      'Onthoud welke weg ze lopen.',
    ],
    knap: [
      'Een ecoduct is een brug voor dieren.',
      'Wie steekt er over de snelweg?',
      'Kijk stil achter het kijkscherm.',
      'Onthoud hun wissel door het zand.',
    ],
  },
  beloning: {
    badgeId: 'ecoduct-wachter', badgeNaam: 'Ecoduct-wachter',
    vaktermBadge: { id: 'knap-ecoduct', naam: 'Knap woord: ecoduct' },
  },
  reunion: { sprite: 'edelhert', tekst: 'De dieren staken veilig over.' },
  /* run 7: De oversteek as an adventure at the real ecoduct (render3d/adventure/missions/
     ecoduct.ts): one look at the bridge, a quiet walk to the screen, groups that come round
     its ends and cross the raked sand bed (their way over it is the route he points back),
     and the three calm moments with his body: feet still as they come, hands still when
     one looks at him, step aside when they want over. One line per beat. */
  avontuur: {
    simpel: {
      kijk: 'Kijk. Een brug voor dieren.',
      naarScherm: 'Loop stil naar het scherm.',
      chipScherm: 'Het scherm',
      sst: 'Sst. Loop stil.',
      wacht: 'Wacht stil. Wie steekt er over?',
      // the first moment (feet still) as a group comes: the encounter's words follow
      komt: 'Er komt iets aan. Sta stil.',
      // the route over the sand (corsi)
      routeKijk: 'Kijk welke weg ze lopen.',
      routeWijs: 'Welke weg liepen ze? Tik de plekken.',
      routeMis: 'Kijk nog een keer.',
      nogMeer: 'Sst. Daar komen er nog meer.',
      nogEenWeg: 'Kijk, weer een andere weg.',
      // a young one looks at him (hands still): its name, then this
      kijktJe: 'kijkt naar je. Niet roepen.',
      kalfje: 'Het kalfje',
      biggetje: 'Het biggetje',
      vos: 'De vos',
      // they want over and he stands in their way (the flip)
      opzij: 'Ze willen over. Ga maar opzij.',
      chipOpzij: 'Opzij',
      nietNaar: 'Niet naar ze toe. Ga opzij.',
      // the bed up close, back behind the screen
      sporen: 'Kijk de sporen eens van dichtbij.',
      chipZand: 'Het zand',
      zoveel: 'Kijk. Allemaal sporen in het zand.',
      terug: 'Ga weer achter het scherm.',
      // the rare one
      das: 'Kijk! Een das!',
    },
    knap: {
      chipScherm: 'Het kijkscherm',
      routeKijk: 'Kijk welke wissel ze lopen.',
      kalfje: 'Het hertenkalf',
      biggetje: 'De frisling',
      chipZand: 'Het sporenbed',
      zoveel: 'Kijk. Een sporenbed vol prenten.',
    },
  },
  stappen: [
    {
      ef: 'corsi',
      skin: {
        copy: {
          instructie: 'Onthoud de weg over het zand.',
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
        regels: ['Dieren komen? Sta stil.', 'Niet roepen.'],
        /* run 7: the three moments come in a drawn order each play (the 2D floor asks them
           as cards in the same order, from the same seed); stepping aside (the flip) is
           never the first */
        rustPlan: [{ slot: 'ecoduct' }],
        encounters: [
          { id: 'stil', slot: 'ecoduct', subject: 'edelhert', dier: 'hinde', vraag: 'Er komen herten aan.',
            opties: [{ label: 'Naar ze toe', goed: false }, { label: 'Sta stil', goed: true }],
            uitleg: 'Goed zo. Nu komen ze rustig dichterbij.', gevolg: 'Ze schrikken. Ze blijven staan.', reactie: 'rear' },
          { id: 'roep', slot: 'ecoduct', subject: 'reekalf', dier: 'ree', vraag: 'Een kalfje kijkt naar je.',
            opties: [{ label: 'Roep hem', goed: false }, { label: 'Stil blijven', goed: true }],
            uitleg: 'Mooi. Je laat hem gewoon gaan.', gevolg: 'Hij schrikt. Hij rent een stukje weg.', reactie: 'flee',
            vraagKnap: 'Een reekalf kijkt naar je.' },
          { id: 'opzij', slot: 'ecoduct', subject: 'edelhert', dier: 'hinde', flip: true, vraag: 'Je staat in hun weg.',
            opties: [{ label: 'Blijf staan', goed: false }, { label: 'Ga opzij', goed: true }],
            uitleg: 'Precies. Nu kunnen ze veilig over.', gevolg: 'Je wacht te lang. Ze lopen terug.', reactie: 'recede' },
        ],
        feit: 'Ook dassen en vossen gebruiken het ecoduct.',
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
    // (no "Hoi ranger!": the voice already says "Ranger <naam>." before the title)
    // run 6: the briefing names what the child sees at the marker: the squirrel on its
    // oak, and where it goes (its hiding place in the wood)
    simpel: [
      'Zie je de eekhoorn in de boom?',
      'Hij gaat nootjes verstoppen.',
      'Volg hem naar zijn plekje.',
      'Kijk goed waar hij ze stopt.',
      'Straks vergeet hij het. Help hem dan.',
    ],
    knap: [
      'Zie je de eekhoorn in de boom?',
      'Hij legt een wintervoorraad aan.',
      'Volg hem naar zijn plekje.',
      'Onthoud de volgorde van de plekjes.',
      'Straks vergeet hij het. Help hem dan.',
    ],
  },
  beloning: {
    badgeId: 'nootjes-vinder', badgeNaam: 'Nootjes-vinder',
    vaktermBadge: { id: 'knap-wintervoorraad', naam: 'Knap woord: wintervoorraad' },
  },
  // (run 7, ek-day: the squirrel ends its day three ways — eats an acorn on its stump,
  // buries one last one by it, or grooms there — so the line says what is true of all three)
  reunion: { sprite: 'eekhoorn', tekst: 'Alle nootjes terug. De eekhoorn is blij.' },
  /* run 6: De verstopte nootjes as an adventure in the world (render3d/adventure/
     missions/eekhoorn.ts): follow the squirrel tree to tree, watch where it buries its
     acorns and point them out when it forgets, call back its noisy neighbours. */
  avontuur: {
    simpel: {
      daar: 'Kijk, daar zit de eekhoorn!',
      volg: 'Volg de eekhoorn.',
      chipEekhoorn: 'De eekhoorn',
      luister: 'luister goed',
      wacht: 'Hij wacht op jou.',
      weer: 'Daar gaat hij weer!',
      waarIsHij: 'Waar is hij? Loop om de boom.',
      gevonden: 'Gevonden! Hij speelt verstoppertje.',
      plekje: 'Hier is zijn plekje.',
      routeKijk: 'Kijk waar hij de nootjes stopt.',
      vergeten: 'Oei, hij weet het niet meer!',
      routeWijs: 'Tik de plekjes op volgorde.',
      routeMis: 'Hier niet. Kijk nog een keer.',
      // run 7: its second mouthful (a new round of the route)
      nogMeer: 'Hij verstopt er nog meer.',
      stapel: 'Hij brengt ze naar zijn stronk.',
      wieWonen: 'Wie woont hier? Tik op elk dier.',
      isGaai: 'Dat is de gaai.',
      isSpecht: 'Dat is de groene specht.',
      isRaaf: 'Dat is de raaf.',
      // run 7: the neighbours of the day (one per perch, drawn per play)
      isKoolmees: 'Dat is de koolmees.',
      isMerel: 'Dat is de merel.',
      isRoodborst: 'Dat is de roodborst.',
      isBonteSpecht: 'Dat is de bonte specht.',
      isBoomklever: 'Dat is de boomklever.',
      isKoekoek: 'Dat is de koekoek.',
      gaaiKomt: 'Kijk, de gaai wil de nootjes!',
      roepMee: 'Roep mee, dan gaat hij weg.',
      luisterBuren: 'Luister wie er roept.',
      naroepen: 'Roep ze na. Tik op de dieren.',
      groei: 'Goed zo! Nu nog een.',
      opnieuw: 'Luister nog een keer.',
      goedBuren: 'Knap onthouden!',
      gaai: 'De gaai vliegt weg.',
      // run 7: what he finds on the way (its nest), and its two rare visitors
      nestKijk: 'Kijk, zijn nest!',
      nogEen: 'Kijk, nog een eekhoorn!',
      gevondenJong: 'Gevonden! En nog een kleintje!',
      // run 7 (ek-day): it hides a second time, round a close pine; the jay buries its own
      nogEenKeer: 'Nog een keer!',
      weerGevonden: 'Weer gevonden!',
      gaaiVerstopt: 'De gaai verstopt ook nootjes!',
      // run 7 (ek-day, review r1): a pine cone drops in front of him as he walks up
      plof: 'Plof! Een dennenappel.',
    },
    knap: {
      routeKijk: 'Kijk waar hij zijn voorraad verstopt.',
      stapel: 'Hij brengt ze naar zijn wintervoorraad.',
      isBonteSpecht: 'Dat is de grote bonte specht.',
      nestKijk: 'Kijk, zijn kobel!',
    },
  },
  stappen: [
    {
      ef: 'corsi',
      skin: {
        // run 7: two mouthfuls of acorns (the story's length; the 2D floor reads the same)
        rondes: 2,
        copy: {
          // (the adventure frames it as the squirrel forgetting where it buried them)
          instructie: 'Onthoud waar de nootjes liggen.',
          toon: 'Kijk waar de eekhoorn ze verstopt…',
          terug: 'Hij vergeet het. Wijs de plekjes aan.',
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
        // run 6: the squirrel's noisy tree neighbours (the jay is the nut thief)
        dieren: ['eekhoorn', 'gaai', 'groene-specht', 'raaf'],
        // run 7: they all chase the jay: each is heard before any calls twice
        roepAllen: true,
        copy: {
          instructie: 'Antwoord de buren van de eekhoorn.',
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
    // run 7: the briefing names what he already hears from the north bank: the frogs
    simpel: [
      'Bij het ven roepen de kikkers.',
      'Eén zit verstopt bij het water.',
      'Kun jij hem vinden?',
      'Kijk goed waar je loopt.',
    ],
    knap: [
      'Bij het ven roepen de heikikkers.',
      'Eén zit verstopt tussen het veenmos.',
      'Kun jij hem vinden?',
      'Soms ligt een adder in de zon.',
    ],
  },
  beloning: {
    badgeId: 'ven-wachter', badgeNaam: 'Ven-wachter',
    vaktermBadge: { id: 'knap-ven', naam: 'Knap woord: ven' },
  },
  reunion: { sprite: 'heikikker', tekst: 'De kikker plonst terug het ven in.' },
  /* run 7: De kikker in het ven as an adventure on the north bank (render3d/adventure/
     missions/ven.ts): the frogs heard from the far bank, followed by ear along the shore
     path, the three calm moments with his feet on the way, the frog found at the water,
     his song, the plons. One line per beat. */
  avontuur: {
    simpel: {
      kijk: 'Hoor je de kikkers?',
      volg: 'Loop naar de kikkers.',
      chipKikkers: 'De kikkers',
      luister: 'luister goed',
      sst: 'Sst. Nu zijn ze stil.',
      staStil: 'Sta stil. Luister.',
      weer: 'Hoor je? Daar roepen ze weer.',
      // the adder on the path (her own words are the encounter's): what to do with his feet
      afstand: 'Hou afstand. Wacht even.',
      // the soft moss: after the second boot in it the chip shows the way round
      chipRond: 'Om het mos heen',
      eromheen: 'Loop over de hei eromheen.',
      // the dry path (the flip): the encounter's words, then go
      loopDoor: 'Loop maar door.',
      chipPad: 'Verder over het pad',
      chipWater: 'Naar het water',
      zoek: 'Waar zit de kikker? Tik op hem.',
      mis: 'Hier niet. Zoek verder.',
      hint: 'Luister. Hij roept.',
      zingen: 'Sta stil. Hij gaat zingen.',
      wacht: 'Sst. Hij wacht even.',
      terug: 'Hoor je? Ze roepen terug.',
      // run 7 (ven-life): the rare answers him from the moss beside his frog
      blauw: 'Kijk! Een blauwe kikker!',
    },
    knap: {
      kijk: 'Hoor je de heikikkers?',
      volg: 'Loop naar de heikikkers.',
      chipKikkers: 'De heikikkers',
      chipRond: 'Om het veenmos heen',
      zoek: 'Waar zit de heikikker? Tik op hem.',
    },
  },
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
        /* run 7: the three moments come in a drawn order each play, on the shore path to
           the frogs (the 2D floor asks them as cards in the same order, from the same
           seed); the dry path (the flip) is never the first */
        rustPlan: [{ slot: 'ven' }],
        encounters: [
          { id: 'adder-ven', slot: 'ven', subject: 'adder', dier: 'adder', vraag: 'Een adder ligt in de zon.',
            opties: [{ label: 'Aaien', goed: false }, { label: 'Hou afstand', goed: true }],
            uitleg: 'Rustig zo. Je laat hem met rust.', gevolg: 'De adder schrikt. Hou afstand.', reactie: 'rear' },
          { id: 'modder-ven', slot: 'ven', subject: 'modderpoel', vraag: 'De rand van het ven is zacht.',
            opties: [{ label: 'Erdoor', goed: false }, { label: 'Eromheen', goed: true }],
            uitleg: 'Goed. Je loopt om het natte stuk heen.', gevolg: 'Je zakt weg in de modder. Loop eromheen.', reactie: 'mud' },
          { id: 'pad-ven', slot: 'ven', subject: 'pad-veilig', flip: true, vraag: 'Het droge pad is vrij.',
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
  kort: 'Een nachtzwaluw broedt op het kale zand. Vind hem en pas op het nest.',
  briefing: {
    // run 7: a car drove over the drift sand where the nightjars breed: he follows its tracks
    simpel: [
      'Er reed een auto over het zand.',
      'Daar broedt een vogel.',
      'Hij lijkt precies op het zand.',
      'Zoek hem, maar loop voorzichtig.',
    ],
    knap: [
      'Er reed een auto over het stuifzand.',
      'Daar broedt een nachtzwaluw.',
      'Hij lijkt precies op het zand.',
      'Zoek hem, maar loop voorzichtig.',
    ],
  },
  beloning: {
    badgeId: 'zand-speurder', badgeNaam: 'Zand-speurder',
    vaktermBadge: { id: 'knap-stuifzand', naam: 'Knap woord: stuifzand' },
  },
  reunion: { sprite: 'nachtzwaluw', tekst: 'De nachtzwaluw blijft rustig op het nest.' },
  /* run 7: Het stille zand as an adventure on the drift sand (render3d/adventure/missions/
     stuifzand.ts): one look at the car's tracks on the path, a careful walk along them (a run
     says why to walk calmly), a nightjar that flutters up and drags a wing to lead him away,
     the search for its mate pressed flat on the sand, the guard by the juniper as the evening
     falls (each animal that comes by goes to its place: wisselen), and back to the nest. One
     line per beat. */
  avontuur: {
    simpel: {
      kijk: 'Kijk. Sporen van een auto.',
      volg: 'Volg de sporen. Loop voorzichtig.',
      chipSporen: 'De sporen',
      cueSporen: 'kijk naar het zand',
      rustig: 'Rustig. Hier broeden vogels.',
      gat: 'Waar gaan de sporen verder?',
      vliegt: 'Kijk! Daar vliegt een vogel op.',
      gewond: 'Hij doet alsof hij gewond is.',
      lokt: 'Hij lokt je weg van het nest.',
      nogEen: 'Sta stil. Er zit er nog een.',
      zoek: 'Waar zit de vogel? Tik op hem.',
      mis: 'Hier niet. Zoek verder.',
      hint: 'Kijk goed bij het gras.',
      naarStruik: 'Loop naar de grote struik.',
      chipStruik: 'De grote struik',
      wacht: 'Wie komt er langs?',
      vraag: 'Waar hoort hij nu?',
      kijk_ree: 'Kijk, een ree.',
      kijk_eekhoorn: 'Kijk, een eekhoorn.',
      kijk_das: 'Kijk, een das.',
      kijk_wildzwijn: 'Kijk, een wild zwijn.',
      kijk_nachtzwaluw: 'Kijk, een nachtzwaluw.',
      goed: 'Goed zo. Daar hoort hij.',
      leeg: 'Daar hoort hij nu niet.',
      avond: 'Het wordt avond.',
      dag: 'Het wordt weer dag.',
      andersom: 'Nu is het andersom!',
      naarNest: 'Kijk nog even bij het nest.',
      chipNest: 'Het nest',
      eitjes: 'Kijk! Twee eitjes.',
      vlucht: 'Kijk! Hij klapt met zijn vleugels.',
    },
    knap: {
      volg: 'Volg de bandensporen. Loop voorzichtig.',
      chipSporen: 'De bandensporen',
      gewond: 'Hij doet alsof zijn vleugel breekt.',
      zoek: 'Waar zit de nachtzwaluw? Tik op hem.',
      naarStruik: 'Loop naar de jeneverbes.',
      chipStruik: 'De jeneverbes',
    },
  },
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
