/**
 * voice.test.ts — Benjamin's recorded voice, the pure half (core/voice.ts): a text is
 * said in sentence clips, only when every sentence has one, and the word clock follows
 * the clips' real word starts. Run: `node --experimental-strip-types --test src/core/voice.test.ts`
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { voiceUnits, clipsFor, clipTiming, CLIP_GAP_MS, type VoiceManifest } from './voice.ts';
import { buildWordClock, activeWordAt } from './wordclock.ts';

const M: VoiceManifest = {
  voice: 'test',
  clips: {
    'Hoi Alvah!': { f: 'a.mp3', ms: 1000, w: [0, 400] },
    'Welkom op de Veluwe.': { f: 'b.mp3', ms: 1500, w: [0, 600, 700, 800] },
  },
};

test('a text is said one sentence a clip, as it sounds', () => {
  assert.deepEqual(voiceUnits('Hoi Alvah! Welkom op de Veluwe.'), ['Hoi Alvah!', 'Welkom op de Veluwe.']);
  assert.deepEqual(voiceUnits('  Dag-dier → open plek. Klaar?  Ja '), ['Dag-dier naar open plek.', 'Klaar?', 'Ja']);
  assert.deepEqual(voiceUnits('📓Open je sporenboek 0/3'), ['Open je sporenboek 0 van 3']);
  assert.deepEqual(voiceUnits(''), []);
});

test('clips only when every sentence has one (never two voices in one line)', () => {
  assert.deepEqual(clipsFor(M, 'Hoi Alvah! Welkom op de Veluwe.')?.map((c) => c.f), ['a.mp3', 'b.mp3']);
  assert.equal(clipsFor(M, 'Hoi Alvah! Kijk daar.'), null);
  assert.equal(clipsFor(null, 'Hoi Alvah!'), null);
  assert.equal(clipsFor(M, ''), null);
});

test('the words start where the clips say, a breath between two clips', () => {
  const t = clipTiming(clipsFor(M, 'Hoi Alvah! Welkom op de Veluwe.')!);
  const second = 1000 + CLIP_GAP_MS;
  assert.deepEqual(t.starts, [0, 400, second, second + 600, second + 700, second + 800]);
  assert.equal(t.totalMs, second + 1500);
});

test('the word clock follows the real starts when there is one per word', () => {
  const text = 'Hoi Alvah! Welkom op de Veluwe.';
  const clock = buildWordClock(text, clipTiming(clipsFor(M, text)!));
  assert.equal(activeWordAt(clock, 399), 0);
  assert.equal(activeWordAt(clock, 400), 1);
  assert.equal(activeWordAt(clock, 1000 + CLIP_GAP_MS + 650), 3);
  assert.equal(clock.words[5].endMs, clock.totalMs);
  // a shown line with a word the voice does not say (an icon): the estimate, scaled
  const scaled = buildWordClock('📓 Hoi Alvah!', { starts: [0, 400], totalMs: 1000 });
  assert.equal(scaled.words.length, 3);
  assert.equal(scaled.totalMs, 1000);
});
