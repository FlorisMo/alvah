/**
 * Moods.test.ts — run 7: the mood ids and the rule that gives a play its mood.
 * Run: `node --experimental-strip-types --test src/render3d/Moods.test.ts`
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { MOOD_IDS, DEFAULT_MOOD, isMood, playMood } from './Moods.ts';
import { newPlay } from '../core/play.ts';

test('five calm moods; the golden hour is the default', () => {
  assert.equal(MOOD_IDS.length, 5);
  assert.equal(DEFAULT_MOOD, 'gouden-uur');
  assert.ok(isMood('schemer'));
  assert.ok(!isMood('storm'));
  assert.ok(!isMood(null));
});

test('a play stands in the session mood unless its home asks otherwise', () => {
  const p = newPlay('m', 3, 1);
  assert.equal(playMood('gouden-uur', undefined, p), 'gouden-uur');
  assert.equal(playMood('zonnig', { allow: ['zonnig', 'bewolkt'] }, p), 'zonnig', 'allowed: kept');
  for (let s = 0; s < 20; s++) {
    const m = playMood('schemer', { allow: ['zonnig', 'bewolkt'] }, newPlay('m', s, 1));
    assert.ok(m === 'zonnig' || m === 'bewolkt', `not allowed: drawn from allow (${m})`);
  }
  const drawn = new Set(Array.from({ length: 40 }, (_, s) => playMood('gouden-uur', { perPlay: true }, newPlay('m', s, 1))));
  assert.ok(drawn.size >= 3, `per play: a new one each play (${[...drawn].join(', ')})`);
  assert.equal(playMood('gouden-uur', { perPlay: true }, newPlay('m', 8, 1)), playMood('gouden-uur', { perPlay: true }, newPlay('m', 8, 1)), 'deterministic per seed');
});
