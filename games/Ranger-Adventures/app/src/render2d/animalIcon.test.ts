/**
 * animalIcon.test.ts — the 2D floors show a picture + a plain word, never a raw
 * content id or two decoded letters (audit mg-09, 2026-09-26).
 *   node --experimental-strip-types --test src/render2d/animalIcon.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { animalIcon, subjectView } from './animalIcon.ts';

test('every mission animal has a picture, unknown ids a calm default', () => {
  for (const id of ['edelhert', 'ree', 'wildzwijn', 'raaf', 'das', 'vos', 'eekhoorn', 'nachtzwaluw', 'heikikker']) {
    assert.ok(animalIcon(id).length > 0 && animalIcon(id) !== '🐾', id);
  }
  assert.equal(animalIcon('onbekend'), '🐾');
});

test('encounter subjects read as words, never as raw ids', () => {
  for (const s of ['adder', 'modderpoel', 'pad-veilig', 'zwijn-honger', 'reekalf']) {
    const v = subjectView(s);
    assert.ok(!v.label.includes('-'), `${s} → ${v.label}`);
    assert.ok(v.icon.length > 0);
  }
  assert.equal(subjectView('reekalf', 'edelhert').label, 'edelhert');
  // mission 1 (the frisling): its three subjects read as the piglet, the sow + her piglets, the rotte
  assert.equal(subjectView('frisling', 'wildzwijn').label, 'frisling');
  assert.equal(subjectView('wildzwijn', 'wildzwijn').label, 'zeug met biggen');
  assert.equal(subjectView('rotte', 'wildzwijn').label, 'de rotte');
  assert.equal(subjectView('onbekend', 'wildzwijn').label, 'wild zwijn');
});
