/**
 * wisselen.test.ts — the words of the day/night sort (child:B3): the rule after a
 * flip is stated outright, and every animal carries its cue (icon + word).
 *   node --experimental-strip-types --test src/engines/wisselen.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { placeNames, regelAndersom, dagOfNacht } from './wisselen.ts';
import { forSpeech } from '../core/narrator.ts';

test('the two places come from the mission rule', () => {
  assert.deepEqual(placeNames('Dag-dier → open plek. Nacht-dier → het hol.'), { open: 'open plek', hol: 'het hol' });
  assert.deepEqual(placeNames('Dag-dier → open zand. Nacht-dier → het hol.'), { open: 'open zand', hol: 'het hol' });
  assert.deepEqual(placeNames('iets anders'), { open: 'open plek', hol: 'het hol' });
});

test('after a flip the rule says the new mapping, not only "andersom"', () => {
  assert.equal(regelAndersom('Dag-dier → open plek. Nacht-dier → het hol.'), 'Dag-dier → het hol. Nacht-dier → open plek.');
});

test('every animal carries an icon and a word for day or night', () => {
  assert.deepEqual(dagOfNacht(true), { icoon: '☀️', woord: 'Dag-dier' });
  assert.deepEqual(dagOfNacht(false), { icoon: '🌙', woord: 'Nacht-dier' });
});

test('a rule is spoken with "naar", never "pijl"', () => {
  assert.equal(forSpeech('Dag-dier → open plek. Nacht-dier → het hol.'), 'Dag-dier naar open plek. Nacht-dier naar het hol.');
});
