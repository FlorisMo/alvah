import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chordVoor, bloemSvg, alleSpelIds } from './celebration.js';

test('chordVoor: bekende mijlpaal-id retourneert array van frequencies', () => {
  const c = chordVoor('simon-1');
  assert.ok(Array.isArray(c));
  assert.ok(c.length >= 3);
  assert.ok(c.every((f) => typeof f === 'number' && f > 0));
});

test('chordVoor: hogere mijlpaal-volgnummer = hogere root', () => {
  const c1 = chordVoor('simon-1');
  const c4 = chordVoor('simon-4');
  assert.ok(c1[0] < c4[0]);
});

test('chordVoor: zelfde volgnummer over spellen = zelfde chord', () => {
  // mijlpaal-1 in elk spel is altijd het eerste in de MIJLPALEN-lijst
  const a = chordVoor('simon-1');
  const b = chordVoor('corsi-1');
  const c = chordVoor('zoeken-1');
  assert.deepEqual(a, b);
  assert.deepEqual(a, c);
});

test('chordVoor: onbekende id → null', () => {
  assert.equal(chordVoor('niet-bestaand-1'), null);
  assert.equal(chordVoor(''), null);
});

test('bloemSvg: alle 5 spellen geven SVG-string', () => {
  for (const spelId of ['simon', 'corsi', 'day-night', 'zoeken', 'wisselen']) {
    const svg = bloemSvg(spelId);
    assert.ok(typeof svg === 'string');
    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.includes('</svg>'));
  }
});

test('bloemSvg: onbekend spel → null', () => {
  assert.equal(bloemSvg('xxx'), null);
});

test('alleSpelIds: 5 spellen', () => {
  assert.equal(alleSpelIds().length, 5);
});
