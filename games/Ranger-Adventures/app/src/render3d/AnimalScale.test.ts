/**
 * AnimalScale.test.ts — the scale table's truths (run 6). Run: `npm test`.
 *
 * Pins what a player must see side by side: the ranger is a real 8-year-old (1.32 m),
 * the grown-ups a head and a half above him, every animal at its true size next to
 * him, grown trees, cover big enough to hide what it hides; and the table's own
 * honesty (every value inside its documented real range, or a stated reason).
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SIZE, RANGER_STAND_HEIGHT, COVER_TALL, COVER, standHeightFor, ratioToRanger, sizeRow, hides, coverFor, spreadAt,
  type Size, type SizeKey,
} from './AnimalScale.ts';

const rows = Object.entries(SIZE) as [SizeKey, Size][];
const h = (k: SizeKey): number => SIZE[k].h;

test('every row is honest: a positive height inside its real range, or a stated reason', () => {
  for (const [k, r] of rows) {
    assert.ok(r.h > 0 && r.real[0] > 0 && r.real[0] < r.real[1], `${k}: a positive height and a real range`);
    assert.ok(r.why.length > 10, `${k}: says why`);
    const inside = r.h >= r.real[0] && r.h <= r.real[1];
    if (r.readable) assert.ok(!inside && r.readable.length > 20, `${k}: 'readable' only for a value outside its range, with the reason`);
    else assert.ok(inside, `${k}: ${r.h} m lies outside its real range ${r.real[0]}-${r.real[1]}`);
    if (r.vary) {
      assert.ok(r.vary[0] < r.vary[1], `${k}: a spread low to high`);
      assert.ok(r.vary[0] >= r.real[0] * 0.95 && r.vary[1] <= r.real[1] * 1.001, `${k}: its spread stays (about) inside the real range`);
    }
  }
});

test('the ranger is a real 8-year-old boy', () => {
  assert.equal(RANGER_STAND_HEIGHT, 1.32);
  assert.ok(RANGER_STAND_HEIGHT >= 1.25 && RANGER_STAND_HEIGHT <= 1.4, 'the child band of an 8-year-old');
  assert.equal(standHeightFor('ranger-alvah'), RANGER_STAND_HEIGHT);
});

test('the grown-ups stand a head and a half above him', () => {
  for (const k of ['boa', 'stroper'] as const) {
    assert.ok(h(k) >= 1.7 && h(k) <= 1.95, `${k} is a grown-up`);
    const above = h(k) - h('ranger');
    assert.ok(above >= 0.4 && above <= 0.55, `${k} stands ${above.toFixed(2)} m above the boy`);
  }
  assert.ok(h('ranger') / h('boa') > 0.7 && h('ranger') / h('boa') < 0.76, 'the boy reaches the warden\'s shoulder');
});

test('the animals read true next to the boy', () => {
  const r = (k: SizeKey): number => ratioToRanger(k) as number;
  assert.ok(r('wildzwijn') > 0.55 && r('wildzwijn') < 0.7, 'the sow\'s back at his belly');
  assert.ok(r('ree') > 0.78 && r('ree') < 0.9, 'the roe\'s head at his chin');
  assert.ok(r('edelhert') > 1.5, 'the stag towers over him');
  assert.ok(r('hinde') > 1.1 && r('hinde') < r('edelhert'), 'a hind is taller than he is, smaller than the stag');
  assert.ok(r('frisling') < 0.3 && r('eekhoorn') < 0.25 && r('das') < 0.3, 'the small ones come to his knee');
  // young below their mothers
  for (const [young, adult] of [['frisling', 'wildzwijn'], ['reekalf', 'ree'], ['hertenkalf', 'hinde'], ['vos-welp', 'vos']] as const) {
    assert.ok(h(young) < h(adult), `${young} is smaller than ${adult}`);
  }
  // the strict size ordering of the adults
  const order: SizeKey[] = ['edelhert', 'hinde', 'ree', 'wolf', 'wildzwijn', 'vos', 'raaf', 'das', 'eekhoorn', 'nachtzwaluw', 'adder'];
  for (let i = 1; i < order.length; i++) assert.ok(h(order[i - 1]) > h(order[i]), `${order[i - 1]} is taller than ${order[i]}`);
});

test('vehicles and buildings fit people', () => {
  assert.ok(h('jeep') > h('ranger') && h('jeep') < h('boa') + 0.3, 'the boy can just see out of the jeep');
  assert.ok(h('helikopter') > h('boa') * 1.6, 'a real helicopter, not a toy');
  assert.ok((SIZE.boshut.door as number) >= h('boa') + 0.1, 'the cabin door is taller than the warden');
  assert.ok(h('uitkijktoren') > h('den'), 'the watchtower looks out over the pines');
});

test('the forest is grown trees', () => {
  for (const k of ['den', 'eik', 'berk'] as const) {
    assert.ok(h(k) >= 7 * h('ranger'), `${k} (${h(k)} m) is a grown tree next to the boy`);
    assert.equal(standHeightFor(SIZE[k].model), h(k));
  }
});

test('the cover rule: tall enough and wide enough', () => {
  assert.ok(hides({ h: 1.2, w: 1 }, { h: 1, len: 1 }));
  assert.ok(!hides({ h: 1.19, w: 1 }, { h: 1, len: 1 }), `at least ${COVER_TALL}× as tall`);
  assert.ok(!hides({ h: 2, w: 0.9 }, { h: 1, len: 1 }), 'at least as wide as the animal is long');
  // the hiding places the missions build on
  for (const plant of ['braam', 'adelaarsvaren', 'jeneverbes'] as const) {
    for (const animal of ['frisling', 'das', 'eekhoorn', 'vos'] as const) {
      assert.ok(coverFor(animal).includes(plant), `a ${plant} hides a ${animal}`);
    }
  }
  assert.ok(coverFor('reekalf', 'liggend').includes('pijpenstrootje'), 'tall grass hides a fawn lying down');
  assert.ok(coverFor('heikikker').includes('lisdodde') && coverFor('wilde-eend').includes('lisdodde'), 'the reeds hide a frog and a duck');
  assert.ok(!coverFor('ree').includes('braam'), 'a bramble does not hide a roe');
  assert.deepEqual(coverFor('edelhert'), [], 'nothing hides the stag');
  assert.deepEqual(COVER.frisling, coverFor('frisling'));
});

test('a GLB id resolves to its default (adult) row; unknown ids give null', () => {
  assert.equal(sizeRow('animal-ree-roedeer'), SIZE.ree);
  assert.equal(sizeRow('animal-edelhert-reddeer'), SIZE.edelhert);
  assert.equal(sizeRow('animal-vos-fox'), SIZE.vos);
  assert.equal(standHeightFor('reekalf'), SIZE.reekalf.h);
  for (const id of ['animal-wildzwijn-boar', 'animal-frisling-piglet', 'animal-das-badger', 'animal-eekhoorn-squirrel',
    'animal-raaf-raven', 'animal-nachtzwaluw-nightjar', 'animal-adder-snake', 'animal-heikikker-frog', 'animal-wolf',
    'animal-heideblauwtje-butterfly', 'vehicle-helicopter', 'prop-ranger-cabin', 'prop-juniper-bush']) {
    assert.ok((standHeightFor(id) ?? 0) > 0, `${id} has a size`);
  }
  assert.equal(standHeightFor('bird-vink'), null);
  assert.equal(standHeightFor(null), null);
  assert.equal(standHeightFor(undefined), null);
});

test('a field spreads over its row\'s range', () => {
  assert.equal(spreadAt('helmgras', 0), SIZE.helmgras.vary[0]);
  assert.ok(Math.abs(spreadAt('helmgras', 1) - SIZE.helmgras.vary[1]) < 1e-9);
  assert.equal(spreadAt('braam', 0.5), SIZE.braam.h);
});
