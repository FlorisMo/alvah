/**
 * onboarding.test.ts — the pure W1.6 first-world-entry hint copy is device-aware
 * and stays in the M3/E3 reading norm. Run:
 * `node --experimental-strip-types --test src/core/onboarding.test.ts`
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { onboardHint, forPointer, ONBOARD_HINT, ONBOARD_TAP, ONBOARD_TIPS } from './onboarding.ts';
import { countWords } from './readlevel.ts';

test('onboardHint picks the stick line on a coarse pointer, arrows otherwise', () => {
  assert.equal(onboardHint(true), ONBOARD_HINT.stick);
  assert.equal(onboardHint(false), ONBOARD_HINT.keys);
});

test('both hint lines stay within the ≤7-word M3/E3 norm', () => {
  for (const line of Object.values(ONBOARD_HINT)) {
    assert.ok(countWords(line) <= 7, `"${line}" should be ≤7 words`);
    assert.ok(line.trim().length > 0);
  }
});

test('the sequenced transient tips (tap + boundary) stay ≤7 words (P3.3)', () => {
  for (const line of ONBOARD_TIPS) {
    assert.ok(countWords(line) <= 7, `"${line}" should be ≤7 words`);
    assert.ok(line.trim().length > 0);
  }
});

test('forPointer: touch keeps "Tik", a mouse reads "Klik" (same word count)', () => {
  assert.equal(forPointer(ONBOARD_TAP, false), ONBOARD_TAP);
  assert.equal(forPointer(ONBOARD_TAP, true), 'Klik op een dier om te spelen.');
  assert.equal(forPointer('Doe ze na. Tik op de dieren.', true), 'Doe ze na. Klik op de dieren.');
  assert.equal(forPointer('Je tik op het bord.', true), 'Je klik op het bord.');
  assert.equal(countWords(forPointer(ONBOARD_TAP, true)), countWords(ONBOARD_TAP));
});

test('forPointer never touches a bird call or other words with "tik" in them', () => {
  assert.equal(forPointer('Tik tik. Net twee steentjes.', true), 'Tik tik. Net twee steentjes.');
  assert.equal(forPointer('Het tikt zacht.', true), 'Het tikt zacht.');
  assert.equal(forPointer('Stik', true), 'Stik');
});
