/**
 * copy.ts — the copy deck: every word a child reads or hears on the shared screens, in one
 * place (run 6, FLOW lane P4). The HUD over the world, the cards between the world and a
 * mission (briefing, fact, reward, clue, finale), the in-mission Pauze, Onderweg, the
 * Pauze hub, the missiebord, the sporenboek, the badges, the raaf's hut and Instellingen.
 * The front door lives in content/screens.ts, Bram and the lessons in content/mentor.ts,
 * the missions in content/veluwe.ts.
 *
 * The rules, linted by core/readlevel.test.ts over every string here:
 *   - AVI M3/E3: at most 7 words a sentence;
 *   - every string SHOWN on screen is ONE line of at most 7 words (a button, a chip, a tag,
 *     a strip line, a line on a card); a longer text is a list of lines, one idea each;
 *   - a string only SPOKEN (never shown) starts its key with `zeg`: only the sentence rule;
 *   - no em dash, no "held" or "kanjer", no surname: first names only (Bram, the raaf's name,
 *     the ranger's name);
 *   - `{naam}`, `{titel}` … are filled in with `vul`.
 *
 * One cast: Bram (the boswachter, the player's mentor by the missiebord), the ranger (the
 * player, named in the maker), the raaf (rescued at the hut, then named), de stroper.
 * One set of place names: de open plek (the clearing by the hut), de hut, het missiebord
 * (the board in the world), het sporenboek (the book in Pauze).
 *
 * Pure data, no imports (the node tests read it directly).
 */

/** Fill in `{naam}`, `{titel}` … Unknown keys stay as they are. */
export function vul(line: string, v: Readonly<Record<string, string | number>>): string {
  return line.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m));
}

/* ------------------------------------------------ the HUD over the world ---- */
export const HUD = {
  pauze: 'Pauze',
  /** The wayfinding chip before its first cue, at the marker, and with every mission done. */
  chipZoek: 'zoek het spoor…',
  chipEr: 'je bent er',
  allesKlaar: 'Alle missies klaar',
  allesKlaarCue: 'loop rustig rond',
  /** The proximity prompts: the one button bottom centre. */
  speelMee: 'Speel mee: {titel}',
  volgende: 'Volgende: {titel}',
  /** "Speel nog eens" and the title on a line of its own (a long title fits). */
  nogEens: 'Speel nog eens:',
  missiebord: 'Bekijk het missiebord',
  hut: 'Kijk in de hut',
  jeepIn: 'Stap in de jeep',
  uit: 'Stap uit',
  heliIn: 'Stap in de helikopter',
  landHier: 'Land hier',
  landPad: 'Land op de helipad',
  /** The jeep: what the key caps do, then how to get out. */
  rijden: {
    gas: 'gas', rem: 'rem', sturen: 'sturen',
    keys: 'Rijd met de pijltjes.',
    stick: 'Sleep de stick om te rijden.',
    uit: 'Stap uit met Enter.',
    /** Why the jeep stands while he holds the gas (run 6 polish): animals in its way,
     *  or something it cannot drive through (the forest edge says HUD.rand). */
    dieren: 'Daar zijn dieren. Rij eromheen.',
    vast: 'Hier kan de jeep niet door.',
  },
  vliegen: { keys: 'Vlieg met de pijltjes.', stick: 'Sleep de stick om te vliegen.' },
  landt: 'De helikopter landt.',
  heliRust: 'De helikopter blijft nu aan de grond.',
  heliUit: 'Zet de helikopter aan bij Instellingen.',
  /** The pad line in flight (shown), and how it sounds. */
  helipad: 'Helipad {richting} · {m} m',
  zegHelipad: 'Helipad {richting}, {m} meter.',
  zegLandHier: 'Land hier.',
  /** The calm rim of the world. */
  rand: 'Hier stopt het bos.',
  /** The joystick, for a screen reader. */
  stick: 'Loopstick: sleep om te lopen',
} as const;

/** The name-tags over places in the world (a mission's tag is its title). */
export const TAG = {
  missiebord: 'Missiebord',
  /** Over the hut's porch ring before the raaf is rescued (then its name). */
  hut: 'Jonge raaf',
} as const;

/** Every transient tip the HUD shows (the rim, driving): one line each. */
export const HUD_TIPS = [HUD.rand, HUD.rijden.keys, HUD.rijden.stick, HUD.rijden.uit] as const;

/* ------------------------------------------- a mission, start to finish ---- */
export const MISSIE = {
  /** Bram's field note: the kicker, and what the voice says before the title. */
  veldnotitie: 'Veldnotitie van {bram} · {landschap}',
  zegAan: 'Ranger {naam}.',
  gaOpPad: 'Ga op pad',
  rondkijken: 'Nog even rondkijken',
  /** The Pauze card over a running mission (or the bird bench). */
  pauze: 'Pauze',
  pauzeVraag: 'Wat wil je doen?',
  gaVerder: 'Ga verder',
  stop: 'Stop de missie',
  stopLuisteren: 'Stop met luisteren',
  /** The fact between two steps: "Wist je dat?" until the raaf is rescued, then the raaf. */
  feit: 'Wist je dat? · {n}/{m}',
  feitRaaf: '{raaf} vertelt · {n}/{m}',
  verder: 'Verder',
  /** The reunion line and the reward. */
  klaar: 'Missie klaar · {titel}',
  zegKlaar: 'Missie klaar!',
  lof: 'Knap gedaan, {naam}!',
  knapWoord: 'Knap woord',
  zegKnapWoord: 'Knap woord: {woord}.',
  stapKomt: 'De stap “{stap}” komt eraan.',
  kijkWatJeVond: 'Kijk wat je vond',
  verderPatrouille: 'Verder op patrouille',
  /** The clue card: how it was caught, what it is, where it went. */
  clueCamera: 'Vastgelegd op de wildcamera.',
  clueFoto: 'Je maakt er een foto van.',
  clueTitel: 'Een nieuwe aanwijzing',
  clueBoek: 'Hij zit nu in je sporenboek.',
  /** Only on the first clue: where the sporenboek is. */
  clueWaar: 'Je vindt het bij Pauze.',
  bekijkBoek: 'Bekijk je sporenboek',
  /** The season finale's fallbacks (the words live in the story arc). */
  seizoenKlaar: 'Seizoen klaar',
  veilig: 'Het is weer veilig.',
} as const;

/* ------------------------------------------------ Onderweg (world-EF beat) ---- */
export const ONDERWEG = {
  kicker: 'Onderweg',
  /** The impulse beat: an animal he can see runs off the path (two lines). */
  dierWeg: ['Een {dier} loopt weg.', 'Wat doe jij?'],
  iemandWeg: ['Een dier loopt weg.', 'Wat doe jij?'],
  blijf: 'Blijf op het pad',
  ren: 'Ren erachteraan',
  /** The direction beat: which way is the next mission? */
  welkeKant: 'Welke kant is je volgende missie?',
  links: 'Naar links',
  rechtdoor: 'Rechtdoor',
  rechts: 'Naar rechts',
  goedRustig: 'Knap, je blijft rustig.',
  goedOnthouden: 'Goed onthouden, ranger!',
  bijna: 'Bijna! Probeer nog eens.',
  verder: 'Even verder lopen',
} as const;

/* ---------------------------------------------------- Pauze and the hub ---- */
export const HUB = {
  pauze: 'Pauze',
  vraag: 'Wat wil je doen?',
  boek: 'Open je sporenboek',
  raafHelp: 'Help de jonge raaf',
  raafZorg: 'Verzorg {raaf}',
  jeRaaf: 'je raaf',
  badges: 'Bekijk je breinkracht-badges',
  instellingen: 'Instellingen',
  terug: 'Terug naar de open plek',
  hoofdmenu: 'Naar het hoofdmenu',
  /** The missiebord. */
  bord: 'Het missiebord · {gebied}',
  kies: 'Kies een missie',
  nuDoen: 'Nu doen',
  voltooid: 'voltooid',
  /** The sporenboek. */
  boekKicker: 'Je sporenboek · {hoofdstuk} · {telling}',
  opgelost: 'opgelost',
  boekVraag: 'Wat is hier aan de hand?',
  nietGevonden: 'Nog niet gevonden',
  /** The facts collected on missions: the same name as the card they came on (a
   *  "Veldnotitie" is Bram's note on a briefing; the code calls both veldnotities). */
  veldnotities: 'Wist je dat? · {n}/{m}',
  geenNotities: 'Weetjes over dieren komen hier ook.',
  /** The note under the clues, read after the newest clue: what is still to come. Never
   *  that clue again. A count is said as a word ({aantal}: TELWOORD). */
  geenSporen: ['Los missies op.', 'Aanwijzingen komen hier.'],
  nogEen: 'Nog één aanwijzing te vinden.',
  nogMeer: 'Nog {aantal} aanwijzingen te vinden.',
  alleGevonden: ['Je hebt alle aanwijzingen!', 'Volg nu het spoor.'],
  gestopt: ['De stroper is gestopt.', 'Alles groeit weer terug.'],
  volgSpoor: 'Volg het spoor',
  verder: 'Verder',
  verderPatrouille: 'Verder op patrouille',
  /** The ontknoping, step by step. */
  opHetSpoor: 'Op het spoor · {n}/{m}',
  klaar: 'Klaar',
  /** The badge wall. */
  breinkracht: 'Jouw breinkracht',
  badgesTitel: 'Badges',
  knappeWoorden: 'Knappe woorden · {n}',
  terugKort: 'Terug',
  /** What these screens say aloud as they open. */
  zegBoek: 'Je sporenboek. Wat is hier aan de hand?',
  zegBadges: 'Jouw breinkracht. Dit zijn je badges.',
} as const;

/* ----------------------------------------------------- the raaf's hut ---- */
/** The hut: the raaf (rescued, named, cared for) and the opvang (help, then let go). */
export const HUT = {
  kicker: 'De ranger-hut',
  titel: 'Jouw plekje',
  terugHut: 'Terug naar de hut',
  terug: 'Terug',
  /** The raaf before it has a name. */
  jeRaaf: 'Je raaf',
  /** Before the rescue: what happened, one idea a line. */
  redding: ['Een jonge raaf viel uit het nest.', 'Hij is nog zwak.', 'Wil jij voor hem zorgen?', 'Dan wordt hij je vriend.'],
  kiesNaam: 'Kies eerst een naam',
  vangOp: 'Vang {raaf} op',
  zegVeilig: '{raaf} is veilig. Verzorg hem goed.',
  /** The rescued raaf. */
  meeOpMissie: '{raaf} vliegt met je mee op missie.',
  geefZorg: 'Geef {raaf} zorg',
  /** The raaf grows: the card, its lines, the new kunstje. */
  groeiKicker: 'Je vriend groeit',
  gegroeid: '{raaf} is gegroeid: {fase}.',
  kanMee: '{raaf} kan nu met je mee.',
  nieuwKunstje: 'Nieuw kunstje: {kunstje}',
  fijn: 'Fijn!',
  /** The opvang: a guest (an animal that needs a little help), then letting it go. */
  opvang: 'De opvang',
  vrijgelaten: '{n} vrijgelaten',
  opvangUitleg: ['Soms heeft een dier even hulp nodig.', 'Je verzorgt het.', 'Daarna laat je het vrij.'],
  kijkWie: 'Kijk wie er is',
  gast: 'Een {gast} is {reden}.',
  juisteZorg: 'Geef de juiste zorg.',
  verzorgDe: 'Verzorg de {gast}',
  vrijKicker: 'Sterk genoeg',
  vrij: 'De {gast} is weer vrij',
  vrijRegels: ['Hij is weer sterk.', 'Je laat hem gaan.', 'Dat hoort erbij.'],
  dag: 'Dag, sterke vriend',
  /** The care round: in order, and not too much cuddling. */
  zorgKicker: 'Zorg op volgorde',
  verzorg: 'Verzorg {wie}',
  zorgTip: 'Doe de zorg op volgorde.',
  knuffelen: 'Knuffelen',
  zorgKlaar: 'De zorg is klaar. Knap gedaan.',
  eerst: 'Eerst: {stap}.',
  teVeel: 'Niet te veel knuffelen. Hij wil rust.',
} as const;

/** The names a rescued raaf can get (never a ranger name from the maker). */
export const RAAF_NAMEN = ['Kroa', 'Pluim', 'Schaduw', 'Inktje'] as const;

/** The raaf's three stages: its name and a few words each. */
export const RAAF_FASE = {
  baby: { label: 'kuiken', kort: 'Pas gered' },
  jong: { label: 'jonge raaf', kort: 'Wordt sterk' },
  zelfstandig: { label: 'vrije vriend', kort: 'Vliegt met je mee' },
} as const;

/** The raaf's tricks, learned as it grows. */
export const RAAF_KUNSTJE = {
  scout: { naam: 'Scout', uitleg: '{raaf} vliegt op en speurt mee.' },
  gids: { naam: 'Gids', uitleg: '{raaf} wijst je de weg.' },
} as const;

/** The care steps: the button and what the voice says when it is done. */
export const ZORG = {
  warmte: { label: 'Warm houden', zin: 'Leg een zacht doekje om hem heen.' },
  voer: { label: 'Voeren', zin: 'Geef een klein beetje voer.' },
  voerGroot: { label: 'Voeren', zin: 'Nu wat groter voer.' },
  rust: { label: 'Laten rusten', zin: 'Laat hem rustig slapen.' },
  check: { label: 'Checken', zin: 'Kijk of het beter gaat.' },
  checkJong: { label: 'Checken', zin: 'Gaat het goed?' },
  checkVrij: { label: 'Checken', zin: 'Hij wordt sterk en vrij.' },
  beweeg: { label: 'Laten bewegen', zin: 'Laat hem zijn vleugels strekken.' },
  oefen: { label: 'Samen oefenen', zin: 'Oefen samen het vliegen.' },
} as const;

/** The opvang's guests: why they are here. */
export const GAST = {
  nachtzwaluw: { reden: 'tegen een raam gevlogen' },
  das: { reden: 'moe en zwak' },
} as const;

/* -------------------------------------------------------- Instellingen ---- */
export const INSTELLINGEN = {
  kicker: 'Instellingen',
  titel: 'Maak het van jou',
  klaar: 'Klaar',
  aan: 'aan',
  uit: 'uit',
  geluid: { label: 'Geluid', hint: 'Tonen en dierengeluiden' },
  voorlezen: { label: 'Voorlezen', hint: 'Een stem leest de tekst voor' },
  rustig: { label: 'Rustige beweging', hint: 'Minder beweging op het scherm' },
  draaitMee: { label: 'Camera draait mee', hint: 'De camera draait met je mee' },
  helikopter: { label: 'Helikopter', hint: 'Vlieg rustig over de Veluwe' },
  leesletter: { label: 'Leesletter', hint: 'Extra duidelijke letters' },
  knap: { label: 'Knappe woorden', hint: 'Echte natuurwoorden zoals frisling en ven' },
  passend: { label: 'Vanzelf passend', hint: 'Het spel groeit met jou mee' },
  plat: { label: 'Platte weergave', hint: 'Speel altijd op de rustige platte vlakte' },
  tekst: 'Grootte van de letters',
  regels: 'Ruimte tussen de regels',
  bos: 'Geluid van het bos',
  spannend: 'Hoe spannend',
  ernst: { assist: 'Heel rustig', mild: 'Rustig', stevig: 'Spannender' },
  stick: 'Loopstick op het scherm',
  stickKeus: { auto: 'Vanzelf', aan: 'Altijd', uit: 'Nooit' },
  kleur: 'Jouw kleur',
  zeg: 'Instellingen. Maak het van jou.',
} as const;

/* ------------------------------------------------------------- general ---- */
export const ALGEMEEN = {
  leesVoor: 'Lees voor',
  jeNaam: 'Je rangernaam',
} as const;

/** A count said as a word: a child reads "twee" in a sentence, not "2" (the sporenboek's note). */
export const TELWOORD = ['nul', 'één', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven', 'acht', 'negen', 'tien'] as const;
