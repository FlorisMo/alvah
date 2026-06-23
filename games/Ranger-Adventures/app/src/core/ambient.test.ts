/**
 * ambient.test.ts — seeded unit test for the pure ambience-bed selector.
 * Run: `node --experimental-strip-types src/core/ambient.test.ts`
 *
 * Covers: the biome's own bed wins; the acoustic fallback chain fills gaps;
 * a single staged bed serves every biome; nothing staged → null; a
 * season-specific bed is preferred when present and ignored otherwise;
 * selection is deterministic + case-insensitive on the season.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { pickAmbientBed } from './ambient.ts';

const BOTH = ['ambient-bos', 'ambient-heide'];

test('prefers the biome\'s own bed when staged', () => {
  assert.equal(pickAmbientBed('bos', BOTH), 'ambient-bos');
  assert.equal(pickAmbientBed('heide', BOTH), 'ambient-heide');
});

test('falls back along the acoustic chain when the own bed is absent', () => {
  // stuifzand has no own bed → nearest is the heath wind bed
  assert.equal(pickAmbientBed('stuifzand', BOTH), 'ambient-heide');
  // ven has no own bed → nearest is the forest bed
  assert.equal(pickAmbientBed('ven', BOTH), 'ambient-bos');
});

test('falls back to a single available bed for any biome', () => {
  const only = ['ambient-bos'];
  for (const b of ['heide', 'bos', 'stuifzand', 'ven'] as const) {
    assert.equal(pickAmbientBed(b, only), 'ambient-bos');
  }
});

test('returns null when nothing is staged', () => {
  assert.equal(pickAmbientBed('bos', []), null);
});

test('prefers a season-specific bed when present, plain bed otherwise', () => {
  const withWinter = [...BOTH, 'ambient-heide-winter'];
  assert.equal(pickAmbientBed('heide', withWinter, 'winter'), 'ambient-heide-winter');
  // no winter bos bed → the plain biome bed still wins over the chain
  assert.equal(pickAmbientBed('bos', withWinter, 'winter'), 'ambient-bos');
  // season given but no seasonal bed at all → plain biome bed
  assert.equal(pickAmbientBed('heide', BOTH, 'zomer'), 'ambient-heide');
});

test('a season-specific fallback bed beats a plain own-biome absence', () => {
  // stuifzand (no own bed) in winter → seasonal heath bed leads the chain
  const beds = ['ambient-bos', 'ambient-heide-winter'];
  assert.equal(pickAmbientBed('stuifzand', beds, 'winter'), 'ambient-heide-winter');
});

test('is deterministic and case-insensitive on season', () => {
  const beds = [...BOTH, 'ambient-heide-winter'];
  assert.equal(pickAmbientBed('heide', beds, 'Winter'), 'ambient-heide-winter');
  assert.equal(pickAmbientBed('heide', beds, '  winter '), 'ambient-heide-winter');
  assert.equal(pickAmbientBed('heide', beds, 'winter'), pickAmbientBed('heide', beds, 'winter'));
});
