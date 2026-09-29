/**
 * Daylight.test.ts — the day↔night the wildcamera adventure turns (design run6-missions
 * §4.3): 1 is exactly the golden hour, 0 a readable blue night (never pitch black), the
 * crossfade is calm (~2 s) and a cut under reduced motion. Run: `npm test`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { DaylightFade, DAYLIGHT_FADE_S, NIGHT_STOPS, lightAt, lightOn, luminance, mixHex, nightSet, type LightSet } from './Daylight.ts';
import { toneMappedHex } from './Atmosphere.ts';

/** The golden hour as World/Sky.ts hands it in (Lighting.GOLDEN_HOUR's values). */
const DAY: LightSet = {
  fog: toneMappedHex('#f3cc9c', 1.08), hemiSky: '#b4c6e0', hemiGround: '#8a6b4a', hemiI: 0.85, key: '#ffc080', keyI: 2.1,
};
const NIGHT = nightSet(1.08);

test('daylight 1 is exactly the golden hour; 0 is the night', () => {
  assert.deepEqual(lightAt(DAY, NIGHT, 1), { ...DAY, night: 0 });
  assert.deepEqual(lightAt(DAY, NIGHT, 0), { ...NIGHT, night: 1 });
  assert.deepEqual(lightAt(DAY, NIGHT, 7), { ...DAY, night: 0 }, 'clamped');
  const half = lightAt(DAY, NIGHT, 0.5);
  assert.equal(half.night, 0.5);
  assert.equal(half.fog, mixHex(DAY.fog, NIGHT.fog, 0.5));
});

test('the night is blue and readable, never pitch black', () => {
  // the sky: blue from zenith to horizon, lighter at the horizon (the tree line stands out)
  for (const [, c] of NIGHT_STOPS) {
    const [r, , b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    assert.ok(b > r + 20, `${c} is blue`);
  }
  assert.ok(luminance(NIGHT_STOPS[NIGHT_STOPS.length - 1][1]) > luminance(NIGHT_STOPS[0][1]), 'lighter at the horizon');
  assert.ok(luminance(NIGHT.fog) > 0.03, `the night haze is not black (${luminance(NIGHT.fog).toFixed(3)})`);
  // the animals: at least a third of the golden hour's light still falls on them
  const k = lightOn(NIGHT) / lightOn(DAY);
  assert.ok(k > 0.33 && k < 0.8, `the night keeps ${Math.round(k * 100)} % of the day's light on the animals`);
  // the light on the way there never dips below the night
  for (let d = 0; d <= 1; d += 0.1) assert.ok(lightOn(lightAt(DAY, NIGHT, d)) >= lightOn(NIGHT) - 1e-9);
});

test('the day turns calmly over ~2 s, and at once under reduced motion', () => {
  const f = new DaylightFade();
  assert.equal(f.value, 1);
  f.set(0);
  const seen: number[] = [];
  let t = 0;
  while (t < DAYLIGHT_FADE_S + 0.2) { f.step(1 / 60, false); t += 1 / 60; seen.push(f.value); }
  assert.equal(f.value, 0);
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i] <= seen[i - 1] + 1e-12, 'it only goes one way');
  const at1s = seen[59];
  assert.ok(at1s > 0.4 && at1s < 0.6, `halfway at 1 s (${at1s.toFixed(2)})`);
  assert.ok(Math.max(...seen.slice(1).map((v, i) => Math.abs(v - seen[i]))) < 0.03, 'no step bigger than 3 % a frame');
  f.set(1);
  assert.equal(f.step(1 / 60, true), true);
  assert.equal(f.value, 1, 'reduced motion: a cut');
  assert.equal(f.step(1 / 60, true), false, 'nothing more to do');
  f.set(0, 2);
  f.step(0.5, false);
  f.cut(1);
  assert.equal(f.value, 1);
  assert.equal(f.step(1 / 60, false), false, 'a cut ends the fade');
});
