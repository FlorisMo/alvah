/**
 * avatar.test.ts — seeded unit test for the pure ranger-avatar model.
 * Run: `node --experimental-strip-types src/core/avatar.test.ts`
 *
 * Covers the invariants the creator UI + the name-threaded copy rely on:
 * "Alvah" as the default name, name cleanup/clamping, valid-option coercion,
 * the partial-apply setter validating only present fields, and merge tolerating
 * junk saves without ever desyncing a kenmerk to a bogus id.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  blankAvatar, mergeAvatar, applyAvatar, rangerNaam, schoonNaam, geldigeOptie, kleurVan,
  HUID_OPTIES, HAAR_OPTIES, OUTFIT_OPTIES, IRIS_OPTIES, STANDAARD_NAAM, MAX_NAAM,
} from './avatar.ts';

test('blankAvatar defaults to Alvah and the first option of each kenmerk', () => {
  const a = blankAvatar();
  assert.equal(a.naam, 'Alvah');
  assert.equal(a.huid, HUID_OPTIES[0].id);
  assert.equal(a.haar, HAAR_OPTIES[0].id);
  assert.equal(a.outfit, OUTFIT_OPTIES[0].id);
  assert.equal(a.iris, IRIS_OPTIES[0].id);
});

test('schoonNaam trims, collapses whitespace and caps length', () => {
  assert.equal(schoonNaam('  Bo  '), 'Bo');
  assert.equal(schoonNaam('Anna   Lijn'), 'Anna Lijn');
  assert.equal(schoonNaam(undefined), '');
  assert.equal(schoonNaam('x'.repeat(40)).length, MAX_NAAM);
});

test('rangerNaam falls back to Alvah when the name is blank', () => {
  assert.equal(rangerNaam(undefined), STANDAARD_NAAM);
  assert.equal(rangerNaam({ ...blankAvatar(), naam: '' }), 'Alvah');
  assert.equal(rangerNaam({ ...blankAvatar(), naam: '   ' }), 'Alvah');
  assert.equal(rangerNaam({ ...blankAvatar(), naam: 'Robin' }), 'Robin');
});

test('geldigeOptie coerces junk to the kenmerk default, keeps valid ids', () => {
  assert.equal(geldigeOptie('huid', 'donker'), 'donker');
  assert.equal(geldigeOptie('huid', 'paars'), HUID_OPTIES[0].id);
  assert.equal(geldigeOptie('iris', 42), IRIS_OPTIES[0].id);
  assert.equal(geldigeOptie('outfit', undefined), OUTFIT_OPTIES[0].id);
});

test('kleurVan returns the option tint, default tint for unknown ids', () => {
  assert.equal(kleurVan('haar', 'zwart'), HAAR_OPTIES.find((o) => o.id === 'zwart')!.kleur);
  assert.equal(kleurVan('haar', 'bogus'), HAAR_OPTIES[0].kleur);
});

test('applyAvatar validates only the fields present in the patch', () => {
  const a = applyAvatar(undefined, { huid: 'bruin', naam: '  Sam ' });
  assert.equal(a.huid, 'bruin');
  assert.equal(a.naam, 'Sam');
  assert.equal(a.haar, HAAR_OPTIES[0].id, 'untouched field keeps its value');
  const b = applyAvatar(a, { huid: 'nonsense' });
  assert.equal(b.huid, HUID_OPTIES[0].id, 'bogus option coerced to default');
  assert.equal(b.naam, 'Sam', 'name preserved when not in the patch');
  const c = applyAvatar(a, { naam: '' });
  assert.equal(c.naam, 'Alvah', 'cleared name falls back to Alvah');
});

test('mergeAvatar tolerates junk and never desyncs a kenmerk', () => {
  const a = mergeAvatar({ naam: '  Veer ', huid: 'bruin', haar: 'bogus', outfit: 7, iris: 'blauw' });
  assert.equal(a.naam, 'Veer');
  assert.equal(a.huid, 'bruin');
  assert.equal(a.haar, HAAR_OPTIES[0].id, 'invalid haar dropped to default');
  assert.equal(a.outfit, OUTFIT_OPTIES[0].id, 'non-string outfit dropped to default');
  assert.equal(a.iris, 'blauw');
  assert.deepEqual(mergeAvatar(null), blankAvatar());
  assert.deepEqual(mergeAvatar(undefined), blankAvatar());
  assert.equal(mergeAvatar({ naam: '' }).naam, 'Alvah');
});
