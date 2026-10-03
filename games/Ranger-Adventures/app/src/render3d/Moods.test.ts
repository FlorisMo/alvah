/**
 * Moods.test.ts — run 7: the five calm moods, the rule that gives a play its mood and the
 * rule that gives a visit its mood.
 * Run: `node --experimental-strip-types --test src/render3d/Moods.test.ts`
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MOOD_IDS, MOODS, DEFAULT_MOOD, isMood, playMood, sessionMood, parseMoodParam, mixMood, moodLightAt,
  lightShare, groundShare, glowShare, keyAtElevation, keyElevation, lastMoodAt, lastMoodsAt, shadeOn, type MoodId,
} from './Moods.ts';
import { newPlay } from '../core/play.ts';
import { EXPOSURE, SKY_STOPS, toneMappedHex } from './Atmosphere.ts';
import { lightAt, lightOn, luminance, nightSet } from './Daylight.ts';

test('five calm moods; the golden hour is the default', () => {
  assert.equal(MOOD_IDS.length, 5);
  assert.equal(DEFAULT_MOOD, 'gouden-uur');
  assert.ok(isMood('schemer'));
  assert.ok(!isMood('storm'));
  assert.ok(!isMood(null));
  assert.deepEqual(Object.keys(MOODS).sort(), [...MOOD_IDS].sort());
});

test('the golden hour is exactly today\'s look', () => {
  const g = MOODS['gouden-uur'];
  // Lighting.GOLDEN_HOUR (THREE-side, so its values are written out here)
  assert.equal(g.light.hemiSky, '#b4c6e0');
  assert.equal(g.light.hemiGround, '#8a6b4a');
  assert.equal(g.light.hemiI, 0.85);
  assert.equal(g.light.key, '#ffc080');
  assert.equal(g.light.keyI, 2.1);
  assert.equal(g.sky, SKY_STOPS, 'the same sky');
  assert.equal(g.light.fog, toneMappedHex(SKY_STOPS[SKY_STOPS.length - 1][1], EXPOSURE), 'the same haze');
  assert.deepEqual([g.fogNear, g.fogFar], [22, 90]);
  assert.deepEqual(g.keyAt, { x: -9, y: 7, z: 4 }, 'the same low sun');
  assert.equal(g.shadow, 1);
  assert.equal(g.wind, 1);
});

test('never dark: every mood keeps at least 0.85× the golden hour\'s light on an animal', () => {
  for (const id of MOOD_IDS) {
    const k = lightShare(id);
    assert.ok(k >= 0.85, `${id}: ${Math.round(k * 100)} % of the golden hour's light`);
    // an animal's side away from the sun: never darker than 0.85× the golden hour's (the
    // hemisphere on a flank + the animal fill; moods.spec measures the pixels)
    const sh = shadeOn(MOODS[id].light) / shadeOn(MOODS['gouden-uur'].light);
    assert.ok(sh >= 0.85, `${id}: the shaded side keeps ${Math.round(sh * 100)} % of the golden hour's light`);
    // a calm sky: no near-black or storm-grey stop, the horizon the lightest part
    for (const [, c] of MOODS[id].sky) assert.ok(luminance(c) > 0.15, `${id}: ${c} is not a dark sky`);
    assert.ok(luminance(MOODS[id].light.fog) > 0.45, `${id}: the haze is light (${MOODS[id].light.fog})`);
  }
});

test('never dark on the ground either: the sun\'s height counts', () => {
  // a low sun lights a flank fully but the ground only by sin(elevation): the dusk once kept
  // 0.89× the golden hour's light on an animal and 0.61× on the ground, and its search view
  // (frame median sRGB luma 41) looked almost like the wildcamera's night (35)
  for (const id of MOOD_IDS) {
    const k = groundShare(id);
    assert.ok(k >= 0.85, `${id}: ${Math.round(k * 100)} % of the golden hour's light on the ground (sun at ${keyElevation(MOODS[id].keyAt).toFixed(0)}°)`);
  }
  assert.equal(groundShare('gouden-uur'), 1);
});

test('no mood makes a search easier: an animal never glows against its ground', () => {
  // the animal fill lifts a coat's shaded side; against a dim ground it made the dusk's
  // hidden piglet stand out (its pixels 1.49× the bracken round it, the other moods
  // 0.92-1.03×): its share of the ground light stays at most the golden hour's (+10 %)
  for (const id of MOOD_IDS) {
    const k = glowShare(id);
    assert.ok(k <= 1.1, `${id}: an animal's shaded side ${k.toFixed(2)}× the golden hour's against its ground`);
  }
  assert.equal(glowShare('gouden-uur'), 1);
});

test('the fog never comes closer than 22 m, and meets the sky at the horizon', () => {
  for (const id of MOOD_IDS) {
    const m = MOODS[id];
    assert.ok(m.fogNear >= 22, `${id}: fog from ${m.fogNear} m`);
    assert.ok(m.fogFar >= m.fogNear + 30, `${id}: a soft fog (${m.fogNear}-${m.fogFar} m)`);
    assert.equal(m.light.fog, toneMappedHex(m.sky[m.sky.length - 1][1], EXPOSURE), `${id}: the fog is its dome's horizon through the tone curve`);
    assert.equal(m.sky[0][0], 0);
    assert.equal(m.sky[m.sky.length - 1][0], 1);
    for (let i = 1; i < m.sky.length; i++) assert.ok(m.sky[i][0] > m.sky[i - 1][0], `${id}: stops in order`);
  }
});

test('different light every visit: the moods are not alike', () => {
  for (const a of MOOD_IDS) for (const b of MOOD_IDS) {
    if (a >= b) continue;
    const A = MOODS[a], B = MOODS[b];
    const d = Math.abs(luminance(A.sky[0][1]) - luminance(B.sky[0][1])) + Math.abs(luminance(A.light.fog) - luminance(B.light.fog))
      + Math.abs(A.fogFar - B.fogFar) / 100 + Math.abs(keyElevation(A.keyAt) - keyElevation(B.keyAt)) / 45 + Math.abs(A.light.keyI - B.light.keyI) / 2;
    assert.ok(d > 0.12, `${a} and ${b} differ (${d.toFixed(2)})`);
  }
  // the sun stands on the golden hour's side in every mood, only higher or lower
  for (const id of MOOD_IDS) {
    const k = MOODS[id].keyAt;
    assert.ok(Math.abs(Math.atan2(k.z, k.x) - Math.atan2(4, -9)) < 1e-9, `${id}: the sun's side`);
    assert.ok(keyElevation(k) >= 12 && keyElevation(k) <= 60, `${id}: the sun at ${keyElevation(k).toFixed(0)}°`);
  }
  assert.ok(Math.abs(keyElevation(keyAtElevation(30)) - 30) < 1e-9);
});

test('a crossfade mixes straight; the night mixes from whatever mood is on screen', () => {
  const a = MOODS.zonnig, b = MOODS.schemer;
  assert.deepEqual(mixMood(a, b, 0).light, a.light);
  assert.deepEqual(mixMood(a, b, 1).light, b.light);
  const half = mixMood(a, b, 0.5);
  assert.equal(half.fogNear, (a.fogNear + b.fogNear) / 2);
  assert.ok(half.light.fillI > Math.min(a.light.fillI, b.light.fillI) - 1e-9);
  const night = nightSet(EXPOSURE);
  for (const id of MOOD_IDS) {
    assert.deepEqual(moodLightAt(id, night, 1), { ...MOODS[id].light, night: 0 }, `${id}: daylight 1 is the mood`);
    assert.deepEqual(moodLightAt(id, night, 0), { ...night, night: 1 }, `${id}: daylight 0 is the night`);
    const mid = moodLightAt(id, night, 0.5);
    assert.equal(mid.night, 0.5);
    assert.ok(mid.fill && mid.fillI !== undefined, `${id}: the animals keep a fill through the night`);
    for (let d = 0; d <= 1; d += 0.1) assert.ok(lightOn(lightAt(MOODS[id].light, night, d)) >= lightOn(night) - 1e-9, `${id}: never darker than the night`);
  }
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
  for (let s = 0; s < 40; s++) {
    const last: MoodId = MOOD_IDS[s % 5];
    assert.notEqual(playMood('gouden-uur', { perPlay: true }, newPlay('m', s, 1), last), last, 'per play: never the home\'s last');
    assert.equal(playMood('gouden-uur', { perPlay: true, allow: ['zonnig'] }, newPlay('m', s, 1), 'zonnig'), 'zonnig', 'only one allowed: that one');
  }
});

test('a visit\'s mood: the first is the golden hour, then a new one each visit', () => {
  assert.equal(sessionMood({ sessions: 0, last: null, seed: 123 }), 'gouden-uur', 'a fresh save: the golden hour');
  assert.equal(sessionMood({ sessions: 0, last: null, seed: 999, forced: 'schemer' }), 'schemer', '?mood= wins');
  assert.equal(sessionMood({ sessions: 4, last: 'zonnig', seed: 5, forced: 'zonnig' }), 'zonnig', '?mood= wins even over the last');
  assert.equal(sessionMood({ sessions: 3, last: null, seed: 5, forced: 'storm' }), sessionMood({ sessions: 3, last: null, seed: 5 }), 'a wrong ?mood= is ignored');
  const seen = new Set<MoodId>();
  let last: MoodId = 'gouden-uur';
  for (let s = 1; s < 60; s++) {
    const m = sessionMood({ sessions: s, last, seed: (s * 2654435761) >>> 0 });
    assert.notEqual(m, last, 'never the same twice in a row');
    seen.add(m);
    last = m;
  }
  assert.equal(seen.size, 5, `every mood comes (${[...seen].join(', ')})`);
  assert.equal(sessionMood({ sessions: 2, last: 'bewolkt', seed: 77 }), sessionMood({ sessions: 2, last: 'bewolkt', seed: 77 }), 'deterministic per seed');
  assert.equal(parseMoodParam('?dev=1&mood=bewolkt'), 'bewolkt');
  assert.equal(parseMoodParam('?mood=night'), null);
  assert.equal(parseMoodParam(''), null);
});

test('a home\'s last mood is read from the history', () => {
  const h = [
    { m: 'frisling', va: 'hide:b,mood:zonnig' },
    { m: 'ree', va: 'mood:schemer' },
    { m: 'frisling', va: 'route:3' },
    { m: 'frisling' },
  ];
  assert.equal(lastMoodAt(h, 'frisling'), 'zonnig');
  assert.equal(lastMoodAt(h, 'ree'), 'schemer');
  assert.equal(lastMoodAt(h, 'eekhoorn'), null);
  assert.equal(lastMoodAt([{ m: 'x', va: 'mood:storm' }], 'x'), null, 'not a mood');
});

test('run 7: perPlay as a number — never one of the home\'s last plays\' moods (the squirrel: 2), read back per play', () => {
  const allow = ['gouden-uur', 'ochtendnevel', 'zonnig', 'bewolkt'] as const;
  for (let s = 0; s < 60; s++) {
    const m = playMood('gouden-uur', { allow, perPlay: 2 }, newPlay('m', s, 1), ['zonnig', 'bewolkt']);
    assert.ok(m === 'gouden-uur' || m === 'ochtendnevel', `seed ${s}: ${m} is neither of the last two`);
    // (true keeps today's rule: only the last one is out)
    assert.notEqual(playMood('gouden-uur', { allow, perPlay: true }, newPlay('m', s, 1), ['zonnig', 'bewolkt']), 'zonnig');
  }
  // the last plays' moods, newest first, one per play (a play logs a beat per step)
  const hist = [
    { m: 'eekhoorn', sd: 1, va: 'mood:zonnig,ek:m-r-kgr' }, { m: 'eekhoorn', sd: 1, va: 'mood:zonnig,ek:m-r-kgr' },
    { m: 'frisling', sd: 2, va: 'mood:schemer' },
    { m: 'eekhoorn', sd: 3, va: 'mood:bewolkt,ek:n-u-mbk' }, { m: 'eekhoorn', sd: 3, va: 'mood:bewolkt,ek:n-u-mbk' },
  ];
  assert.deepEqual(lastMoodsAt(hist, 'eekhoorn', 2), ['bewolkt', 'zonnig']);
  assert.deepEqual(lastMoodsAt(hist, 'eekhoorn', 1), ['bewolkt']);
  assert.deepEqual(lastMoodsAt([], 'eekhoorn', 2), []);
});
