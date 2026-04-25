import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skinNiveau, bereikteDieren, alleSpelIds } from './skin.js';

test('skinNiveau: lege data → 0', () => {
  assert.equal(skinNiveau('simon', {}), 0);
  assert.equal(skinNiveau('simon', { mijlpalen: { bereikt: [] } }), 0);
});

test('skinNiveau: telt alleen bereikte mijlpalen voor dat spel', () => {
  const data = { mijlpalen: { bereikt: ['simon-1', 'simon-2', 'corsi-1'] } };
  assert.equal(skinNiveau('simon', data), 2);
  assert.equal(skinNiveau('corsi', data), 1);
  assert.equal(skinNiveau('zoeken', data), 0);
});

test('bereikteDieren: retourneert MIJLPALEN-objecten in volgorde', () => {
  const data = { mijlpalen: { bereikt: ['simon-3', 'simon-1'] } };
  const d = bereikteDieren('simon', data);
  assert.equal(d.length, 2);
  // Volgorde volgt MIJLPALEN-array, niet bereikt-array
  assert.equal(d[0].id, 'simon-1');
  assert.equal(d[1].id, 'simon-3');
  assert.equal(d[0].dier, 'trom-aap');
});

test('bereikteDieren: onbekend spel → []', () => {
  assert.deepEqual(bereikteDieren('xxx', { mijlpalen: { bereikt: ['simon-1'] } }), []);
});

test('alleSpelIds: 5 spellen', () => {
  assert.equal(alleSpelIds().length, 5);
});
