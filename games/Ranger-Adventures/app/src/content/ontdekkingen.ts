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
const REE: Ontdekking[] = [
  { id: 'ree-niet-aanraken.reekalf', home: 'ree-niet-aanraken', soort: 'dier', naam: 'het reekalf',
    hint: 'Wie ligt heel stil in het gras?', model: 'animal-ree-roedeer', geholpen: true },
  // the ree lane adds its rows here
];

/* ------------------------------------------------ wildcamera (the crossing) ---- */
const WILDCAMERA: Ontdekking[] = [
  { id: 'wildcamera.das', home: 'wildcamera', soort: 'dier', naam: 'de das',
    hint: 'Wie snuffelt er in de nacht?', model: 'animal-das-badger', geholpen: true },
  // run 7 (wc-album): the camera's album. His own photo when he walks past the camera to
  // test it (every play; new the first time); the fox, the first time it walks in for a
  // photo or calls at night (it comes in about three plays of four); a nose pressed to the
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

export const ONTDEKKINGEN: readonly Ontdekking[] = [...FRISLING, ...REE, ...WILDCAMERA, ...EEKHOORN, ...WERELD];

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
