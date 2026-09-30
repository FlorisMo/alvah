/**
 * onboarding.test.ts — the device-aware wording rule (`forPointer`). The tips' words are
 * linted with the whole copy deck in core/readlevel.test.ts. Run:
 * `node --experimental-strip-types --test src/core/onboarding.test.ts`
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { forPointer } from './onboarding.ts';
import { countWords } from './readlevel.ts';

test('forPointer: touch keeps "Tik", a mouse reads "Klik" (same word count)', () => {
  const TAP = 'Tik op een ring om te spelen.';
  assert.equal(forPointer(TAP, false), TAP);
  assert.equal(forPointer('Tik op een dier om te spelen.', true), 'Klik op een dier om te spelen.');
  assert.equal(forPointer('Doe ze na. Tik op de dieren.', true), 'Doe ze na. Klik op de dieren.');
  assert.equal(forPointer('Je tik op het bord.', true), 'Je klik op het bord.');
  assert.equal(countWords(forPointer(TAP, true)), countWords(TAP));
});

test('forPointer never touches a bird call or other words with "tik" in them', () => {
  assert.equal(forPointer('Tik tik. Net twee steentjes.', true), 'Tik tik. Net twee steentjes.');
  assert.equal(forPointer('Het tikt zacht.', true), 'Het tikt zacht.');
  assert.equal(forPointer('Stik', true), 'Stik');
});
