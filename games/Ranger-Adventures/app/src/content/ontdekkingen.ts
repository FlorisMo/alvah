/**
 * ontdekkingen.ts — what Alvah can discover, in one table (run 7, design
 * `state/foundation/design.md` §4.4): the animals of each home he saw or heard, a track, a
 * find, the wildcamera's photos, a few rare ones, and the small surprises of the open
 * world ('wereld'). What he found goes into his veldgids in the hut; what is still out
 * there shows as a grey silhouette with its one hint line.
 *
 * A discovery is WHAT HE SAW OR HEARD (a home calls `k.discover(id)` when the thing was
 * really in his picture or its call reached him), never a prize. The animal a mission
 * helped (`geholpen`) is recorded quietly when that mission is won, whichever way it was
 * played (the world, the classic stage or the 2D floor).
 *
 * Rules (linted by core/readlevel.test.ts): `naam` plain, with its article, no knappe
 * woorden (they go in `naamKnap`); `hint` one line of at most 7 words, read aloud; first
 * names only. Each home ends up with ≥ 4 rows and ≥ 1 `zeldzaam` (§4.7). Every lane adds
 * its home's rows in its OWN block below, so lanes never edit the same lines.
 *
 * Pure data (the node tests read it directly): type-only imports.
 */

import type { IconName } from '../ui/icons';
import type { MoodId } from '../render3d/Moods';

/** dier: an animal he saw or heard · zeldzaam: a rare visitor · spoor: a track or a trace ·
 *  vondst: something he found · foto: one of the wildcamera's photographs */
export type OntdekSoort = 'dier' | 'zeldzaam' | 'spoor' | 'vondst' | 'foto';

export interface Ontdekking {
  /** '<home>.<thing>': 'frisling.zeug', 'wereld.buizerd' */
  id: string;
  /** a mission id, or 'wereld' (the open world) */
  home: string;
  soort: OntdekSoort;
  /** plain, with its article: 'de big' */
  naam: string;
  /** with the knappe woorden (only when that setting is on): 'de frisling' */
  naamKnap?: string;
  /** what is still out there, ≤ 7 words, read aloud: 'Wie tikt er op een boom?' */
  hint: string;
  /** the GLB id of its picture in the veldgids (a real model) */
  model?: string;
  /** a drawn icon when there is no model (a print, a feather) */
  icon?: IconName;
  /** only in these moods (a nightjar at dusk) */
  stemming?: MoodId[];
  /** the animal this home's mission helped: recorded quietly when the mission is won */
  geholpen?: boolean;
}

/* ------------------------------------------------------- frisling (the wallow) ---- */
// (run 7 package body: the family he meets, a bird that flies up where he walks, the pigs'
// rubbing log, a nest of bitten bracken at a stand's edge, and rarely a magpie riding the
// sow; each recorded only once he really saw it, render3d/adventure/missions/frisling.finds.ts)
const FRISLING: Ontdekking[] = [
  { id: 'frisling.frisling', home: 'frisling', soort: 'dier', naam: 'de big', naamKnap: 'de frisling',
    hint: 'Wie heeft een pyjama met strepen?', model: 'animal-frisling-piglet', geholpen: true },
  { id: 'frisling.zeug', home: 'frisling', soort: 'dier', naam: 'het moederzwijn', naamKnap: 'de zeug',
    hint: 'Wie past op de biggen?', model: 'animal-wildzwijn-boar' },
  { id: 'frisling.overloper', home: 'frisling', soort: 'dier', naam: 'het jonge zwijn', naamKnap: 'de overloper',
    hint: 'Wie is de grote broer?', model: 'animal-wildzwijn-boar' },
  { id: 'frisling.leeuwerik', home: 'frisling', soort: 'dier', naam: 'de leeuwerik', naamKnap: 'de boomleeuwerik',
    hint: 'Soms vliegt er een vogel op.', model: 'bird-boomleeuwerik' },
  { id: 'frisling.schuurboom', home: 'frisling', soort: 'spoor', naam: 'de schuurboom', naamKnap: 'de malboom',
    hint: 'Waar schuren de zwijnen hun rug?', icon: 'paw' },
  { id: 'frisling.nest', home: 'frisling', soort: 'vondst', naam: 'het bedje van varens', naamKnap: 'de worpketel',
    hint: 'Een moeder maakt een bedje. Waar?', icon: 'leaf' },
  { id: 'frisling.ekster', home: 'frisling', soort: 'zeldzaam', naam: 'de ekster op het zwijn',
    hint: 'Wie rijdt er mee op een zwijn?', model: 'bird-ekster' },
];

/* --------------------------------------------- ree-niet-aanraken (the meadow) ---- */
// (run 7 package ree-discover, render3d/adventure/missions/ree.finds.ts: the mother, seen in
// the first look; each play one or two small things of the heath, drawn from its seed: a
// woodlark flushed out of the heather, singing, on a walk; a buzzard hunting low over the
// heath on his way to the hide; a cuckoo the mother turns her head to in the watch (heard);
// a young birch a roebuck rubbed pale beside the path (he walks up to it); and, rarely,
// twins: a second calf rises from the grass behind them and comes to its mother at the
// reunion. Each recorded only once he really saw it, heard it or walked up to it.)
const REE: Ontdekking[] = [
  { id: 'ree-niet-aanraken.reekalf', home: 'ree-niet-aanraken', soort: 'dier', naam: 'het reekalf',
    hint: 'Wie ligt heel stil in het gras?', model: 'reekalf', geholpen: true },
  { id: 'ree-niet-aanraken.moeder', home: 'ree-niet-aanraken', soort: 'dier', naam: 'de ree', naamKnap: 'de reegeit',
    hint: 'Wie eet er bij het bosje?', model: 'animal-ree-roedeer' },
  { id: 'ree-niet-aanraken.leeuwerik', home: 'ree-niet-aanraken', soort: 'dier', naam: 'de leeuwerik', naamKnap: 'de boomleeuwerik',
    hint: 'Een vogeltje vliegt op uit de hei.', model: 'bird-boomleeuwerik' },
  { id: 'ree-niet-aanraken.buizerd', home: 'ree-niet-aanraken', soort: 'dier', naam: 'de buizerd',
    hint: 'Wie zweeft er boven de hei?', model: 'bird-buizerd' },
  { id: 'ree-niet-aanraken.koekoek', home: 'ree-niet-aanraken', soort: 'dier', naam: 'de koekoek',
    hint: 'Luister goed als je stil wacht.', model: 'bird-koekoek' },
  { id: 'ree-niet-aanraken.veegsporen', home: 'ree-niet-aanraken', soort: 'spoor', naam: 'het geschuurde boompje', naamKnap: 'de veegsporen van de bok',
    hint: 'Kijk goed naar de jonge boompjes.', model: 'prop-birch-tree' },
  { id: 'ree-niet-aanraken.tweeling', home: 'ree-niet-aanraken', soort: 'zeldzaam', naam: 'de twee kalfjes', naamKnap: 'de tweeling',
    hint: 'Soms heeft een ree twee kalfjes.', model: 'reekalf' },
];

/* ------------------------------------------------ wildcamera (the crossing) ---- */
const WILDCAMERA: Ontdekking[] = [
  { id: 'wildcamera.das', home: 'wildcamera', soort: 'dier', naam: 'de das',
    hint: 'Wie snuffelt er in de nacht?', model: 'animal-das-badger', geholpen: true },
  // run 7 (wc-album): the camera's album. His own photo when he walks past the camera to
  // test it (every play; new the first time); the fox, the first time it walks in for a
  // photo or into the night (it comes in about three plays of four); a nose pressed to the
  // lens on a photo the camera took on its own in the night (some plays, surely within
  // three); and two rare ones (k.rare: a seeded chance and the pity rule): a fox with her
  // cubs crossing in the night, and a white roe stepping into the glade in the morning.
  // No wolf: next to the man and his snare it would read as a threat.
  { id: 'wildcamera.selfie', home: 'wildcamera', soort: 'foto', naam: 'de foto van jou', naamKnap: 'de foto van jou op de wildcamera',
    hint: 'Loop eens langs de camera.', model: 'ranger-alvah' },
  { id: 'wildcamera.vos', home: 'wildcamera', soort: 'dier', naam: 'de vos',
    hint: 'Wie sluipt er ’s nachts langs?', model: 'animal-vos-fox' },
  { id: 'wildcamera.neus', home: 'wildcamera', soort: 'foto', naam: 'de neus op de foto', naamKnap: 'de snuit op de foto',
    hint: 'Wie komt héél dichtbij?', model: 'animal-wildzwijn-boar' },
  { id: 'wildcamera.vosjes', home: 'wildcamera', soort: 'zeldzaam', naam: 'de vos met jongen', naamKnap: 'de vos met welpen',
    hint: 'Soms komt er een hele familie.', model: 'vos-welp' },
  { id: 'wildcamera.witte-ree', home: 'wildcamera', soort: 'zeldzaam', naam: 'de witte ree',
    hint: 'Een heel bijzondere ree…', model: 'witte-ree' },
];

/* ------------------------------------------------------ eekhoorn (the pines) ---- */
// (run 7, the eekhoorn lane: what he can find in the squirrel's wood. Its neighbours of
// the day are met with a click and recorded quietly (the meet is their moment); the
// nest, the gnawed cones and the seedling only once he saw them; the two rare visitors
// are staged where a squirrel is big in the picture. The great tit, the blackbird, the
// robin, the raven and the cuckoo are birds of the whole wood: their rows are 'wereld'.)
const EEKHOORN: Ontdekking[] = [
  { id: 'eekhoorn.eekhoorn', home: 'eekhoorn', soort: 'dier', naam: 'de eekhoorn', naamKnap: 'de rode eekhoorn',
    hint: 'Wie verstopt nootjes onder het mos?', model: 'animal-eekhoorn-squirrel', geholpen: true },
  // (its full name, 'de Vlaamse gaai', reads as a surname to the copy lint: the plain name)
  { id: 'eekhoorn.gaai', home: 'eekhoorn', soort: 'dier', naam: 'de gaai',
    hint: 'Wie wil de nootjes pikken?', model: 'bird-gaai' },
  { id: 'eekhoorn.groene-specht', home: 'eekhoorn', soort: 'dier', naam: 'de groene specht',
    hint: 'Wie lacht er in het bos?', model: 'bird-groene-specht' },
  { id: 'eekhoorn.grote-bonte-specht', home: 'eekhoorn', soort: 'dier', naam: 'de bonte specht', naamKnap: 'de grote bonte specht',
    hint: 'Wie roffelt op een boom?', model: 'bird-grote-bonte-specht' },
  { id: 'eekhoorn.boomklever', home: 'eekhoorn', soort: 'dier', naam: 'de boomklever',
    hint: 'Wie loopt ondersteboven langs de boom?', model: 'bird-boomklever' },
  { id: 'eekhoorn.nest', home: 'eekhoorn', soort: 'vondst', naam: 'het eekhoornnest', naamKnap: 'de kobel',
    hint: 'Waar slaapt de eekhoorn?', icon: 'home' },
  { id: 'eekhoorn.kale-kegels', home: 'eekhoorn', soort: 'spoor', naam: 'de kale dennenappels',
    hint: 'Wie heeft hier zitten smullen?', icon: 'cone' },
  { id: 'eekhoorn.eikje', home: 'eekhoorn', soort: 'vondst', naam: 'het eikenboompje',
    hint: 'Groeit er iets uit een nootje?', icon: 'leaf' },
  // (its picture is the squirrel in its dark coat: a content id with its own coat, Coat.ts)
  { id: 'eekhoorn.donkere-eekhoorn', home: 'eekhoorn', soort: 'zeldzaam', naam: 'de donkere eekhoorn',
    hint: 'Is elke eekhoorn rood?', model: 'eekhoorn-donker' },
  { id: 'eekhoorn.jonge-eekhoorn', home: 'eekhoorn', soort: 'zeldzaam', naam: 'de jonge eekhoorn',
    hint: 'Wie verstopt zich nog meer?', model: 'animal-eekhoorn-squirrel' },
];

/* ------------------------------------------------------------- the new homes ---- */
// the adventures lane adds a block per new adventure here (the ven first)

/* ------------------------------------------------------- ven (the north bank) ---- */
// (run 7, the adventures lane, package ven-life: render3d/adventure/missions/ven.finds.ts
// shows them, ven.life.ts says where. The frog he helped is his once the mission is won;
// the adder once he really saw her in her moment; the duck with her ducklings on the open
// water (from the bank, in a mission or in free roam); a dragonfly that comes up to him on
// his way (the warm moods); the heath blue that flutters up from the heather by the path
// (the sunny moods); a duck's blue feather he walks past on the bank; and now and then a
// sky-blue frog that answers his singing frog — moor frog males turn blue for a few days in
// spring: the world shows no season, so its line says "heel even".)
const VEN: Ontdekking[] = [
  { id: 'ven.heikikker', home: 'ven', soort: 'dier', naam: 'de kikker', naamKnap: 'de heikikker',
    hint: 'Wie zingt er bij het water?', model: 'animal-heikikker-frog', geholpen: true },
  { id: 'ven.adder', home: 'ven', soort: 'dier', naam: 'de slang', naamKnap: 'de adder',
    hint: 'Wie ligt er in de zon?', model: 'animal-adder-snake' },
  { id: 'ven.eend', home: 'ven', soort: 'dier', naam: 'de eend met haar kleintjes', naamKnap: 'de wilde eend met kuikens',
    hint: 'Wie zwemt er met kleintjes?', model: 'eend-moeder' },
  { id: 'ven.libel', home: 'ven', soort: 'dier', naam: 'de libel', naamKnap: 'de oeverlibel',
    hint: 'Wie vliegt er over het water?', icon: 'dragonfly', stemming: ['zonnig', 'gouden-uur', 'bewolkt'] },
  { id: 'ven.heideblauwtje', home: 'ven', soort: 'dier', naam: 'het blauwe vlindertje', naamKnap: 'het heideblauwtje',
    hint: 'Wie zit er op de hei?', model: 'animal-heideblauwtje-butterfly', stemming: ['zonnig', 'gouden-uur'] },
  { id: 'ven.veer', home: 'ven', soort: 'vondst', naam: 'de blauwe veer', naamKnap: 'de spiegelveer van de eend',
    hint: 'Wat ligt er op de oever?', model: 'prop-feather' },
  { id: 'ven.blauw', home: 'ven', soort: 'zeldzaam', naam: 'de blauwe kikker', naamKnap: 'de blauwe heikikker',
    hint: 'Soms is een kikker heel even blauw.', model: 'heikikker-blauw' },
];

/* ------------------------------------------------------- ecoduct (the crossing) ---- */
// (run 7, the adventures lane, package oversteek: render3d/adventure/missions/ecoduct.ts.
// Who comes over the bridge differs every play: the red deer always (the animals the
// mission helps: theirs once it is won), and of a sow with her piglets, a roe with her calf
// and a fox alone those the play brings — each his once he really saw it cross; the tracks
// once he stood in the sand bed and looked at them; and now and then, round the bridge's
// end, a badger trundles over (rare: a seeded chance and the pity rule).)
const ECODUCT: Ontdekking[] = [
  { id: 'ecoduct.edelhert', home: 'ecoduct', soort: 'dier', naam: 'het hert met haar kalfje', naamKnap: 'de hinde met haar kalf',
    hint: 'Wie komt er over de brug?', model: 'hinde', geholpen: true },
  { id: 'ecoduct.wildzwijn', home: 'ecoduct', soort: 'dier', naam: 'het zwijn met haar biggen', naamKnap: 'de zeug met frislingen',
    hint: 'Wie knort er over de brug?', model: 'animal-wildzwijn-boar' },
  { id: 'ecoduct.ree', home: 'ecoduct', soort: 'dier', naam: 'de ree met haar kalfje', naamKnap: 'de reegeit met haar kalf',
    hint: 'Wie stapt er licht over?', model: 'animal-ree-roedeer' },
  { id: 'ecoduct.vos', home: 'ecoduct', soort: 'dier', naam: 'de vos op de brug',
    hint: 'Wie sluipt er bij schemer over?', model: 'animal-vos-fox', stemming: ['ochtendnevel', 'schemer'] },
  { id: 'ecoduct.sporen', home: 'ecoduct', soort: 'spoor', naam: 'de sporen in het zand', naamKnap: 'het sporenbed',
    hint: 'Wie liep er door het zand?', icon: 'paw' },
  { id: 'ecoduct.das', home: 'ecoduct', soort: 'zeldzaam', naam: 'de das op de brug',
    hint: 'Wie waggelt er laat over de brug?', model: 'animal-das-badger' },
];

/* ------------------------------------------------- stuifzand (the drift sand) ---- */
// (run 7, the adventures lane, package stille-zand: render3d/adventure/missions/stuifzand.ts.
// The nightjar he found pressed flat on the sand is his once the mission is won; a woodlark
// that rises over the sand and sings (about three plays in five) once he heard its song; the
// rabbit's burrow under the juniper once he stood guard by it; the anthill at the sand's edge
// once he walked past it and saw it; the two speckled eggs once she shifted on them in his
// picture; and now and then, at dusk, the male's display flight: he claps his wings over the
// sand (rare: a seeded chance and the pity rule).)
const STUIFZAND: Ontdekking[] = [
  { id: 'stuifzand.nachtzwaluw', home: 'stuifzand', soort: 'dier', naam: 'de nachtzwaluw',
    hint: 'Wie lijkt precies op het zand?', model: 'animal-nachtzwaluw-nightjar', geholpen: true },
  { id: 'stuifzand.leeuwerik', home: 'stuifzand', soort: 'dier', naam: 'de leeuwerik', naamKnap: 'de boomleeuwerik',
    hint: 'Wie zingt er hoog boven het zand?', model: 'bird-boomleeuwerik' },
  { id: 'stuifzand.konijnenhol', home: 'stuifzand', soort: 'spoor', naam: 'het konijnenhol',
    hint: 'Wie woont er onder de struik?', model: 'prop-badger-sett' },
  { id: 'stuifzand.mierenhoop', home: 'stuifzand', soort: 'spoor', naam: 'de mierenhoop',
    hint: 'Wie bouwt een berg van naaldjes?', icon: 'mound' },
  { id: 'stuifzand.eieren', home: 'stuifzand', soort: 'vondst', naam: 'de eitjes',
    hint: 'Wat ligt er onder de vogel?', icon: 'egg' },
  { id: 'stuifzand.vlucht', home: 'stuifzand', soort: 'zeldzaam', naam: 'de klappende nachtzwaluw',
    hint: 'Wie klapt bij schemer met zijn vleugels?', model: 'animal-nachtzwaluw-nightjar' },
];

/* ------------------------------------------------- wereld (the open world) ---- */
// The free roam's small surprises (render3d/world/Surprises.ts stages them, one at a time):
// each is met by seeing it (on screen, big enough, long enough) or hearing its call close by.
// The tiny birds are heard far more than seen, as in a real wood. The two rare ones only
// come in their own light (`stemming`): the stag at the forest edge in the morning mist or
// at dusk, the badger at dusk. No wolf, no adder: nothing that could scare.
const WERELD: Ontdekking[] = [
  { id: 'wereld.buizerd', home: 'wereld', soort: 'dier', naam: 'de buizerd',
    hint: 'Wie cirkelt hoog boven de hei?', model: 'bird-buizerd' },
  { id: 'wereld.specht', home: 'wereld', soort: 'dier', naam: 'de specht', naamKnap: 'de grote bonte specht',
    hint: 'Wie tikt er op een boom?', model: 'bird-grote-bonte-specht' },
  { id: 'wereld.koekoek', home: 'wereld', soort: 'dier', naam: 'de koekoek',
    hint: 'Wie roept zijn eigen naam?', model: 'bird-koekoek', stemming: ['ochtendnevel', 'gouden-uur'] },
  { id: 'wereld.winterkoning', home: 'wereld', soort: 'dier', naam: 'het winterkoninkje', naamKnap: 'de winterkoning',
    hint: 'Wie is klein maar zingt heel hard?', model: 'bird-winterkoning' },
  { id: 'wereld.roodborst', home: 'wereld', soort: 'dier', naam: 'het roodborstje', naamKnap: 'de roodborst',
    hint: 'Wie hupt een stukje met je mee?', model: 'bird-roodborst' },
  { id: 'wereld.edelhert', home: 'wereld', soort: 'zeldzaam', naam: 'het edelhert',
    hint: 'Wie draagt een gewei in de mist?', model: 'animal-edelhert-reddeer', stemming: ['ochtendnevel', 'schemer'] },
  { id: 'wereld.das', home: 'wereld', soort: 'zeldzaam', naam: 'de das',
    hint: 'Wie waggelt in de schemer voorbij?', model: 'animal-das-badger', stemming: ['schemer'] },
];

export const ONTDEKKINGEN: readonly Ontdekking[] = [...FRISLING, ...REE, ...WILDCAMERA, ...EEKHOORN, ...VEN, ...ECODUCT, ...STUIFZAND, ...WERELD];

/** One row by id, or undefined. */
export function ontdekking(id: string): Ontdekking | undefined {
  return ONTDEKKINGEN.find((o) => o.id === id);
}

/** The rows of one home ('wereld' for the open world). */
export function ontdekkingenVan(home: string): Ontdekking[] {
  return ONTDEKKINGEN.filter((o) => o.home === home);
}

/** Its name as this player reads it: with the knappe woorden only when that setting is on. */
export function naamVan(o: Ontdekking, jargon: boolean): string {
  return jargon && o.naamKnap ? o.naamKnap : o.naam;
}
