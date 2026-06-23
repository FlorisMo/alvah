/**
 * demo.test.ts — seeded unit test for the pure demo-skip core (§9g).
 * Run: `node --experimental-strip-types src/core/demo.test.ts`
 *
 * Pins the invariants the demo panel relies on: locked areas are not jumpable,
 * every mission appears with its lead-engine label + done flag, the arc
 * fast-forward maps cover exactly the right missions, and everything is
 * deterministic + pure (inputs untouched).
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  demoAreaTargets,
  demoMissionTargets,
  engineTargets,
  voltooidAll,
  voltooidArc,
  arcMissionIds,
  leadEngine,
} from './demo.ts';

const AREA = {
  id: 'veluwe',
  naam: 'Veluwe',
  status: 'actief',
  missies: [
    { id: 'frisling', titel: 'Het verdwaalde frisling', landschap: 'bos', verhaalHaak: 'spoor', stappen: [{ ef: 'zoeken' }, { ef: 'corsi' }] },
    { id: 'das', titel: 'De das in de burcht', landschap: 'bos', stappen: [{ ef: 'corsi' }] },
    { id: 'ven', titel: 'Stilte bij het ven', landschap: 'ven', verhaalHaak: 'camera', stappen: [{ ef: 'dagnacht' }] },
    { id: 'mystery', titel: 'Onbekende stap', landschap: 'heide', stappen: [{ ef: 'gibberish' }] },
  ],
};

const AREAS = [
  AREA,
  { id: 'wadden', naam: 'Wadden', status: 'binnenkort', missies: [] },
  { id: 'duinen', naam: 'Duinen', missies: [] }, // no status → treated locked
];

test('area targets: only the active area is enabled (locked ones not jumpable)', () => {
  const t = demoAreaTargets(AREAS);
  assert.equal(t.length, 3);
  assert.deepEqual(t.map((a) => a.enabled), [true, false, false]);
  assert.equal(t[0].id, 'veluwe');
  assert.equal(t[2].status, 'binnenkort'); // missing status defaults locked
});

test('mission targets: every mission present, in authored order, with lead-engine label', () => {
  const t = demoMissionTargets(AREA, { das: true });
  assert.deepEqual(t.map((m) => m.id), ['frisling', 'das', 'ven', 'mystery']);
  assert.equal(t[0].engine, 'zoeken');
  assert.equal(t[0].engineLabel, 'Speurkracht');     // SKILL_META.zoeken.naam
  assert.equal(t[0].done, false);
  assert.equal(t[1].done, true);                      // voltooid passthrough
  assert.equal(t[2].engine, 'dagnacht');
  assert.equal(t[3].engine, null);                    // unknown ef → null engine
  assert.equal(t[3].engineLabel, 'gibberish');        // falls back to the raw ef
  assert.equal(t[0].verhaalHaak, 'spoor');
  assert.equal(t[1].verhaalHaak, null);
});

test('leadEngine reads the first step, guards unknown engines', () => {
  assert.equal(leadEngine(AREA.missies[0]), 'zoeken');
  assert.equal(leadEngine(AREA.missies[3]), null);
  assert.equal(leadEngine({ id: 'x', titel: '', landschap: '', stappen: [] }), null);
});

test('engineTargets covers exactly the 5 EF engines with labels', () => {
  const t = engineTargets();
  assert.deepEqual(t.map((e) => e.engine), ['zoeken', 'corsi', 'simon', 'dagnacht', 'wisselen']);
  assert.ok(t.every((e) => e.label.length > 0 && e.taak.length > 0));
});

test('voltooidAll marks every mission done', () => {
  const all = voltooidAll(AREA);
  assert.deepEqual(Object.keys(all).sort(), ['das', 'frisling', 'mystery', 'ven']);
  assert.ok(Object.values(all).every((v) => v === true));
});

test('arcMissionIds = exactly the verhaalHaak missions, authored order', () => {
  assert.deepEqual(arcMissionIds(AREA), ['frisling', 'ven']);
});

test('voltooidArc marks the arc missions done without clobbering other progress', () => {
  const merged = voltooidArc(AREA, { das: true });
  assert.equal(merged.das, true);       // preserved
  assert.equal(merged.frisling, true);  // arc hook → done
  assert.equal(merged.ven, true);       // arc hook → done
  assert.equal(merged.mystery, undefined); // not an arc mission, untouched
});

test('deterministic + pure — repeated calls match, inputs untouched', () => {
  const voltooid = { das: true };
  const before = JSON.stringify(voltooid);
  const a = demoMissionTargets(AREA, voltooid);
  const b = demoMissionTargets(AREA, voltooid);
  assert.deepEqual(a, b);
  voltooidArc(AREA, voltooid);
  voltooidAll(AREA);
  assert.equal(JSON.stringify(voltooid), before); // no mutation
});
