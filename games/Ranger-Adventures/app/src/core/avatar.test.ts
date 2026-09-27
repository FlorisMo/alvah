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
  lookPart, repaint, paintLum, hexRgb,
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

/* ---- the 3D ranger look: which texel is what, and the repaint ---- */

test('lookPart: the painted parts, told apart by colour and body height', () => {
  assert.equal(lookPart(104, 125, 66, 0.5), 'outfit', 'green on the torso = jacket');
  assert.equal(lookPart(104, 125, 66, 0.1), null, 'green on the boots is not the jacket');
  assert.equal(lookPart(203, 188, 146, 0.85), 'haar', 'cream on the head = hair');
  assert.equal(lookPart(203, 188, 146, 0.02), null, 'cream on the soles is not hair');
  assert.equal(lookPart(248, 159, 116, 0.7), 'huid', 'peach face');
  assert.equal(lookPart(248, 159, 116, 0.15), 'huid', 'peach legs');
  assert.equal(lookPart(187, 136, 86, 0.3), null, 'the shorts stay as painted');
  assert.equal(lookPart(238, 178, 23, 0.45), null, 'the yellow shirt stays');
  assert.equal(lookPart(58, 106, 154, 0.75), 'iris', 'a clear blue in the head = the iris');
  assert.equal(lookPart(104, 125, 66, -1), null, 'off the mesh: untouched');
});

test('repaint: the part\'s average becomes the chosen colour, light and shade kept', () => {
  const target = hexRgb('#b5532a');
  const mean = paintLum(203, 188, 146);
  assert.deepEqual(repaint(203, 188, 146, target, mean), target, 'average texel → exactly the swatch');
  const dark = repaint(150, 139, 108, target, mean);
  assert.ok(paintLum(...dark) < paintLum(...target), 'a darker stroke stays darker');
  const bright = repaint(255, 255, 255, target, mean);
  assert.ok(bright.every((v) => v >= 0 && v <= 255), 'clamped');
});

test('hexRgb reads the swatch colours', () => {
  assert.deepEqual(hexRgb('#3a5a6b'), [0x3a, 0x5a, 0x6b]);
});
