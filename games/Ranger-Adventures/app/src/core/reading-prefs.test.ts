/**
 * reading-prefs.test.ts — seeded unit test for the pure reading/accent Tweaks.
 * Run: `node --experimental-strip-types src/core/reading-prefs.test.ts`
 *
 * Locks the invariants the Tweaks panel relies on: size/leading clamp to the
 * slider range (a corrupt persisted value can't blow up the layout), the
 * leesFont toggle swaps the font stack (Atkinson Hyperlegible on / clean sans
 * off — never OpenDyslexic), accent passes through to --spel-sun, and the output
 * is deterministic + pure (same Settings → same vars).
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { readingVars, clamp, READ_SIZE, LEADING } from './reading-prefs.ts';
import type { Settings } from './state.ts';

// a minimal Settings stub — readingVars only reads four fields
function settings(over: Partial<Settings> = {}): Settings {
  return {
    readSize: 28, leading: 1.7, leesFont: true, accent: '#f5c23b',
    geluid: true, voorlezen: true, reducedMotion: false, gevolgErnst: 'mild',
    autoMoeilijk: true, jargon: false, ambient: 0.85, force2d: false,
    lensSterkte: 0.6, afleiders: 4, spoorLengte: 3, spoorHelderheid: 0.7,
    routeLengte: 4, regelWissel: 0.4, slowmo: true, simonLengte: 3, wisselFreq: 0.4,
    reisSnelheid: 1, reisDichtheid: 1, reisMagneet: false,
    ...over,
  } as Settings;
}

test('clamp keeps values inside range and survives NaN', () => {
  assert.equal(clamp(5, 1, 10), 5);
  assert.equal(clamp(-3, 1, 10), 1);
  assert.equal(clamp(99, 1, 10), 10);
  assert.equal(clamp(Number.NaN, 1, 10), 1); // corrupt persisted value → floor, never NaN
});

test('read size + leading clamp to the slider range', () => {
  const huge = readingVars(settings({ readSize: 999, leading: 9 }));
  assert.equal(huge['--read-size'], `${READ_SIZE.max}px`);
  assert.equal(huge['--read-leading'], LEADING.max.toFixed(2));
  const tiny = readingVars(settings({ readSize: 1, leading: 0 }));
  assert.equal(tiny['--read-size'], `${READ_SIZE.min}px`);
  assert.equal(tiny['--read-leading'], LEADING.min.toFixed(2));
});

test('read size rounds to a whole px', () => {
  assert.equal(readingVars(settings({ readSize: 27.6 }))['--read-size'], '28px');
});

test('leesFont swaps the font stack (Atkinson on, clean sans off)', () => {
  const on = readingVars(settings({ leesFont: true }))['--font-read'];
  const off = readingVars(settings({ leesFont: false }))['--font-read'];
  assert.ok(on.includes('Atkinson Hyperlegible'));
  assert.ok(!off.includes('Atkinson Hyperlegible'));
  assert.ok(off.includes('Lexend'));
  // never the research-discredited OpenDyslexic in either mode
  assert.ok(!on.includes('OpenDyslexic') && !off.includes('OpenDyslexic'));
});

test('accent passes through to --spel-sun', () => {
  assert.equal(readingVars(settings({ accent: '#9a6aa8' }))['--spel-sun'], '#9a6aa8');
});

test('deterministic + pure: same Settings → identical vars', () => {
  const s = settings({ readSize: 32, leading: 1.9, leesFont: false, accent: '#abc' });
  assert.deepEqual(readingVars(s), readingVars(s));
});
