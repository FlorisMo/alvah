import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gidsPages, openingPage, anyNieuw, turnPage, revealSaysWhere, WERELD } from './gids-math.ts';
import { ONTDEKKINGEN, type Ontdekking } from '../../content/ontdekkingen.ts';

const row = (id: string, soort: Ontdekking['soort'] = 'dier'): Ontdekking =>
  ({ id, home: id.split('.')[0], soort, naam: 'de x', hint: 'Wie is dit?', icon: 'paw' });

const TABLE: Ontdekking[] = [
  row('wereld.buizerd'), row('wereld.edelhert', 'zeldzaam'), row('wereld.specht'),
  row('eekhoorn.eekhoorn'), row('frisling.spoor', 'spoor'), row('frisling.zeldzaam', 'zeldzaam'),
  row('frisling.frisling'), row('frisling.foto', 'foto'), row('ven.kikker'),
];
const ORDER = ['frisling', 'ree-niet-aanraken', 'wildcamera', 'eekhoorn', 'ven'];

test('pages: the homes in story order, the open world last', () => {
  const pages = gidsPages(TABLE, {}, ORDER);
  assert.deepEqual(pages.map((p) => p.home), ['frisling', 'eekhoorn', 'ven', WERELD]);
  // a home the story does not list comes after the story's, before the open world
  const extra = gidsPages([...TABLE, row('nieuw.ding')], {}, ORDER);
  assert.deepEqual(extra.map((p) => p.home), ['frisling', 'eekhoorn', 'ven', 'nieuw', WERELD]);
});

test('a page keeps its slots: animals, a track, a find, a photo, the rare one last', () => {
  const [fris] = gidsPages(TABLE, {}, ORDER);
  assert.deepEqual(fris.entries.map((e) => e.o.id), ['frisling.frisling', 'frisling.spoor', 'frisling.foto', 'frisling.zeldzaam']);
  const wereld = gidsPages(TABLE, {}, ORDER).at(-1)!;
  assert.deepEqual(wereld.entries.map((e) => e.o.id), ['wereld.buizerd', 'wereld.specht', 'wereld.edelhert']);
  // ...and finding something never moves it
  const after = gidsPages(TABLE, { 'frisling.zeldzaam': {}, 'frisling.foto': { g: 1 } }, ORDER)[0];
  assert.deepEqual(after.entries.map((e) => e.o.id), fris.entries.map((e) => e.o.id));
});

test('found, new until looked at, rare and photo, the dots', () => {
  const [fris] = gidsPages(TABLE, { 'frisling.frisling': {}, 'frisling.foto': { g: 1 } }, ORDER);
  const by = Object.fromEntries(fris.entries.map((e) => [e.o.id, e]));
  assert.equal(by['frisling.frisling'].found, true);
  assert.equal(by['frisling.frisling'].nieuw, true, 'not looked at in the gids yet');
  assert.equal(by['frisling.foto'].nieuw, false, 'looked at');
  assert.equal(by['frisling.foto'].foto, true);
  assert.equal(by['frisling.zeldzaam'].rare, true);
  assert.equal(by['frisling.spoor'].found, false);
  assert.equal(by['frisling.spoor'].nieuw, false, 'nothing is new before it is found');
  assert.equal(fris.found, 2);
});

test('the gids opens where something is new, else where he looked last, else at the start', () => {
  const none = gidsPages(TABLE, {}, ORDER);
  assert.equal(openingPage(none, null), 0);
  assert.equal(openingPage(none, 'ven'), 2);
  assert.equal(openingPage(none, 'gone'), 0);
  const fresh = gidsPages(TABLE, { 'wereld.specht': {}, 'frisling.frisling': { g: 1 } }, ORDER);
  assert.equal(openingPage(fresh, 'frisling'), 3, 'the open world has something new');
  assert.equal(anyNieuw(TABLE, { 'wereld.specht': {} }), true);
  assert.equal(anyNieuw(TABLE, { 'wereld.specht': { g: 1 } }), false);
  assert.equal(anyNieuw(TABLE, {}), false);
});

test('the arrows wrap round: no dead end at either side', () => {
  assert.equal(turnPage(0, -1, 4), 3);
  assert.equal(turnPage(3, 1, 4), 0);
  assert.equal(turnPage(1, 1, 4), 2);
  assert.equal(turnPage(0, 1, 0), 0);
});

test('the reveal says where the gids is: the first reveals, until he has looked', () => {
  assert.equal(revealSaysWhere({}), true, 'the first reveal ever');
  assert.equal(revealSaysWhere({ a: { r: 1 }, b: {} }), true);
  assert.equal(revealSaysWhere({ a: { r: 1 }, b: { r: 1 }, c: { r: 1 } }), false, 'three reveals said it');
  assert.equal(revealSaysWhere({ a: { g: 1 } }), false, 'he has opened his gids');
});

test('the real table: every page has a picture for every slot, the open world has its surprises', () => {
  const pages = gidsPages(ONTDEKKINGEN, {}, ORDER);
  assert.equal(pages.at(-1)!.home, WERELD);
  const wereld = pages.at(-1)!.entries.map((e) => e.o.id);
  for (const id of ['buizerd', 'specht', 'koekoek', 'winterkoning', 'roodborst', 'edelhert', 'das']) {
    assert.ok(wereld.includes(`wereld.${id}`), `the open world holds ${id}`);
  }
  assert.ok(pages.at(-1)!.entries.filter((e) => e.rare).length >= 1, 'a rare one in the open world');
  for (const p of pages) for (const e of p.entries) assert.ok(e.o.model || e.o.icon, `${e.o.id}: a picture`);
});
