/**
 * lessons.test.ts — the first minute's pure rules (core/lessons.ts): the order, the
 * skip-if-done rule, the run lesson that never blocks, the chip held for the hook, and
 * the save migration. Run: `node --experimental-strip-types --test src/core/lessons.test.ts`
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  nextStep, hookPending, learnedByDoing, lessonDone, lessonTimedOut, migrateGeleerd, readingMs, cutByRide,
  LESSON, type GuideState,
} from './lessons.ts';
import { BRAM, LES, BESTURING, metNaam } from '../content/mentor.ts';
import { countWords } from './readlevel.ts';

const fresh = (over: Partial<GuideState> = {}): GuideState => ({
  geleerd: {}, returning: false, welkomSaid: false, rennenShown: false, kijkenShown: false,
  hookRelevant: true, missiebordArmed: false, onFoot: true, jeepFar: false, stillS: 0, prompting: false,
  progress: { walkedM: 0, runS: 0, lookPx: 0 },
  ...over,
});

test('a new boswachter: Bram first, then walk, run, the hook — one at a time', () => {
  assert.equal(nextStep(fresh()), 'bram');
  assert.equal(nextStep(fresh({ geleerd: { bram: true } })), 'lopen');
  assert.equal(nextStep(fresh({ geleerd: { bram: true, lopen: true } })), 'rennen');
  assert.equal(nextStep(fresh({ geleerd: { bram: true, lopen: true, rennen: true } })), 'haak');
  assert.equal(nextStep(fresh({ geleerd: { bram: true, lopen: true, rennen: true, haak: true } })), null);
});

test('walking during Bram counts: a lesson already done is skipped', () => {
  const walked = { walkedM: LESSON.lopen.doneM + 0.1, runS: 0, lookPx: 0 };
  assert.equal(nextStep(fresh({ geleerd: { bram: true }, progress: walked })), 'rennen');
  assert.deepEqual(learnedByDoing({ bram: true }, walked), ['lopen']);
  const ran = { walkedM: 9, runS: LESSON.rennen.doneS, lookPx: 0 };
  assert.equal(nextStep(fresh({ geleerd: { bram: true }, progress: ran })), 'haak');
});

test('the run lesson never blocks: it gives way after 12 s or 25 m, and the hook still comes', () => {
  assert.equal(lessonTimedOut('rennen', 11.9, 3), false);
  assert.equal(lessonTimedOut('rennen', 12, 0), true);
  assert.equal(lessonTimedOut('rennen', 2, 25), true);
  assert.equal(lessonTimedOut('lopen', 999, 0), false, 'the walk lesson waits: it is the one thing he needs');
  assert.equal(nextStep(fresh({ geleerd: { bram: true, lopen: true }, rennenShown: true })), 'haak');
});

test('riding the jeep or the heli: the lessons on foot wait, the hook and the chip do not', () => {
  // he got in during Bram's greeting, before he had walked 3 m: the hook comes while he drives
  assert.equal(nextStep(fresh({ geleerd: { bram: true }, onFoot: false })), 'haak');
  assert.equal(nextStep(fresh({ geleerd: { bram: true, lopen: true }, onFoot: false })), 'haak');
  // told the hook while driving: nothing more while he rides
  assert.equal(nextStep(fresh({ geleerd: { bram: true, haak: true }, onFoot: false })), null);
  // on foot again, what he has not learned yet comes back, in order
  assert.equal(nextStep(fresh({ geleerd: { bram: true, haak: true } })), 'lopen');
  assert.equal(nextStep(fresh({ geleerd: { bram: true, lopen: true, haak: true } })), 'rennen');
  // Bram's greeting itself is never skipped for the ride (he can listen while he drives)
  assert.equal(nextStep(fresh({ onFoot: false })), 'bram');
});

test('a lesson on screen when he gets in ends unlearned, the queue goes on, and it comes back on foot', () => {
  // the run lesson was up (rennenShown) when he got into the jeep
  const cut = cutByRide('rennen', { rennenShown: true, kijkenShown: true });
  assert.deepEqual(cut, { rennenShown: false, kijkenShown: true }, 'only the cut lesson may show again');
  const riding = fresh({ geleerd: { bram: true, lopen: true }, onFoot: false, ...cut });
  assert.equal(nextStep(riding), 'haak', 'the cut lesson no longer holds the hook back');
  assert.equal(nextStep({ ...riding, geleerd: { ...riding.geleerd, haak: true }, onFoot: true }), 'rennen', 'on foot the run lesson comes back');
  // without the cut the run lesson that was shown would never come back this session
  assert.equal(nextStep(fresh({ geleerd: { bram: true, lopen: true, haak: true }, rennenShown: true })), null);
  // the look lesson, cut the same way, may come back once he stands still on foot again
  const look = cutByRide('kijken', { rennenShown: true, kijkenShown: true });
  assert.deepEqual(look, { rennenShown: true, kijkenShown: false });
  assert.equal(nextStep(fresh({ geleerd: { bram: true, lopen: true, rennen: true, haak: true }, stillS: LESSON.kijken.stillS, ...look })), 'kijken');
});

test('the chip waits for the hook, and only for the first mission', () => {
  assert.equal(hookPending({ geleerd: {}, hookRelevant: true }), true);
  assert.equal(hookPending({ geleerd: { haak: true }, hookRelevant: true }), false);
  assert.equal(hookPending({ geleerd: {}, hookRelevant: false }), false);
});

test('a returning player: welkom once a session, then only what is still to learn', () => {
  assert.equal(nextStep(fresh({ returning: true, geleerd: { bram: true, lopen: true, rennen: true, haak: true } })), 'welkom');
  assert.equal(nextStep(fresh({ returning: true, welkomSaid: true, geleerd: { bram: true, lopen: true, rennen: true, haak: true } })), null);
  // a returning player never gets the new player's greeting
  assert.equal(nextStep(fresh({ returning: true, welkomSaid: true, geleerd: { lopen: true, rennen: true, haak: true } })), null);
});

test('later beats: the missiebord after the first mission, the jeep when far, the look lesson when still', () => {
  const all = { bram: true, lopen: true, rennen: true, haak: true };
  assert.equal(nextStep(fresh({ geleerd: all, missiebordArmed: true })), 'missiebord');
  assert.equal(nextStep(fresh({ geleerd: { ...all, missiebord: true }, missiebordArmed: true })), null);
  assert.equal(nextStep(fresh({ geleerd: all, jeepFar: true })), 'jeep');
  assert.equal(nextStep(fresh({ geleerd: all, jeepFar: true, onFoot: false })), null);
  assert.equal(nextStep(fresh({ geleerd: all, stillS: LESSON.kijken.stillS })), 'kijken');
  assert.equal(nextStep(fresh({ geleerd: all, stillS: LESSON.kijken.stillS, prompting: true })), null, 'never over a prompt');
  assert.equal(nextStep(fresh({ geleerd: all, stillS: 60, kijkenShown: true })), null, 'once a session');
  assert.equal(lessonDone('kijken', { walkedM: 0, runS: 0, lookPx: LESSON.kijken.donePx }), true);
});

test('the old save flags become learned steps', () => {
  assert.deepEqual(migrateGeleerd({ wereldHintGezien: true, tikHintGezien: true }), { lopen: true, haak: true });
  assert.deepEqual(migrateGeleerd({ renHintGezien: true }), { rennen: true });
  assert.deepEqual(migrateGeleerd({}), {});
  assert.deepEqual(migrateGeleerd({ wereldHintGezien: true, geleerd: { kijken: true } }), { lopen: true, haak: true, kijken: true });
});

test('a line of Bram stays up at least its reading time', () => {
  assert.equal(readingMs('Help jij hem zoeken?'), 1200 + 4 * 350);
});

test('every line Bram says and every lesson is ≤ 7 words, with the name filled in', () => {
  const lines = [
    ...BRAM.intro, ...BRAM.haak.simpel, ...BRAM.haak.knap, ...BRAM.jeep, ...BRAM.missiebord, ...BRAM.raaf,
    ...BRAM.welkomTerug, BRAM.kennismaken,
    ...Object.values(LES).flatMap((l) => [l.keys, l.stick]),
    BESTURING.titel, BESTURING.terug, ...BESTURING.keys.map((r) => r.wat), ...BESTURING.stick.map((r) => r.wat),
  ].map((l) => metNaam(l, 'Alvah'));
  for (const l of lines) {
    assert.ok(countWords(l) <= 7, `"${l}" is ${countWords(l)} words`);
    assert.ok(!/\{naam\}/.test(l));
    assert.ok(!/—/.test(l), `"${l}" has an em dash`);
  }
  assert.equal(metNaam(BRAM.intro[0], 'Bo'), 'Hoi Bo! Welkom op de Veluwe.');
});
