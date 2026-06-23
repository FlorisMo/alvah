/**
 * worldbeat.test.ts — seeded unit test for the pure world-EF micro-beat selector.
 * Run: `node --experimental-strip-types src/core/worldbeat.test.ts`
 *
 * Covers the invariants the light open-world seasoning relies on: the beat is
 * RARE (cadence gate), never fires on the first returns, alternates the two
 * flavours, suppresses wayfinding when there's no heading, exposes exactly one
 * calm-correct option whose slot never leaks the answer, scores recoverably, and
 * is deterministic + pure.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  pickWorldBeat, optionCorrect, coarseHeading, WORLDBEAT_EVERY,
  type CoarseHeading,
} from './worldbeat.ts';

const H: CoarseHeading = 'rechts';

test('light cadence: no beat until the Nth completed-mission return', () => {
  for (let t = 0; t < WORLDBEAT_EVERY; t++) {
    assert.equal(pickWorldBeat({ patrolTick: t, heading: H }), null, `tick ${t} must be quiet`);
  }
  assert.ok(pickWorldBeat({ patrolTick: WORLDBEAT_EVERY, heading: H }), 'fires on the Nth');
});

test('tick 0 (the very first patrol entry) is always quiet', () => {
  assert.equal(pickWorldBeat({ patrolTick: 0, heading: H }), null);
  assert.equal(pickWorldBeat({ patrolTick: 0, heading: null }), null);
});

test('flavours alternate — impulse first, then wayfinding', () => {
  // occurrence 1 (tick=EVERY) → impulse, 2 → wayfind, 3 → impulse, 4 → wayfind
  assert.equal(pickWorldBeat({ patrolTick: WORLDBEAT_EVERY * 1, heading: H })?.kind, 'blijf-op-pad');
  assert.equal(pickWorldBeat({ patrolTick: WORLDBEAT_EVERY * 2, heading: H })?.kind, 'welke-kant');
  assert.equal(pickWorldBeat({ patrolTick: WORLDBEAT_EVERY * 3, heading: H })?.kind, 'blijf-op-pad');
  assert.equal(pickWorldBeat({ patrolTick: WORLDBEAT_EVERY * 4, heading: H })?.kind, 'welke-kant');
});

test('no heading → the wayfinding flavour is suppressed, impulse stands in', () => {
  // occurrence 2 would be wayfind, but with everything done there is no heading
  const beat = pickWorldBeat({ patrolTick: WORLDBEAT_EVERY * 2, heading: null });
  assert.equal(beat?.kind, 'blijf-op-pad');
});

test('every beat exposes exactly one calm-correct option', () => {
  for (const occ of [1, 2, 3, 4]) {
    const beat = pickWorldBeat({ patrolTick: WORLDBEAT_EVERY * occ, heading: H });
    assert.ok(beat);
    assert.equal(beat.options.filter((o) => o.correct).length, 1, `occ ${occ}: one correct`);
    // dual-channel: every option carries a shape glyph, not colour alone
    assert.ok(beat.options.every((o) => o.glyph.length > 0));
  }
});

test('wayfinding correct slot tracks the heading — order never cues the answer', () => {
  const tick = WORLDBEAT_EVERY * 2; // a wayfinding occurrence
  const idxOf = (heading: CoarseHeading): number => {
    const beat = pickWorldBeat({ patrolTick: tick, heading })!;
    return beat.options.findIndex((o) => o.correct);
  };
  // fixed links→rechtdoor→rechts row, but the correct index rotates with heading
  assert.equal(idxOf('links'), 0);
  assert.equal(idxOf('rechtdoor'), 1);
  assert.equal(idxOf('rechts'), 2);
});

test('optionCorrect scores recoverably — out-of-range is a soft miss, not a crash', () => {
  const beat = pickWorldBeat({ patrolTick: WORLDBEAT_EVERY, heading: H })!;
  const correctIdx = beat.options.findIndex((o) => o.correct);
  assert.equal(optionCorrect(beat, correctIdx), true);
  assert.equal(optionCorrect(beat, correctIdx === 0 ? 1 : 0), false);
  assert.equal(optionCorrect(beat, 99), false); // never throws → re-present the same beat
  assert.equal(optionCorrect(beat, -1), false);
});

test('coarseHeading maps live wayfinding phrases, nulls the un-recallable ones', () => {
  assert.equal(coarseHeading('naar links'), 'links');
  assert.equal(coarseHeading('recht vooruit'), 'rechtdoor');
  assert.equal(coarseHeading('naar rechts'), 'rechts');
  // "achter je" / "je bent er" / unknown → no clean left/ahead/right to recall
  assert.equal(coarseHeading('achter je'), null);
  assert.equal(coarseHeading('je bent er'), null);
  assert.equal(coarseHeading(null), null);
  assert.equal(coarseHeading(undefined), null);
});

test('deterministic + pure — repeated calls match, input untouched', () => {
  const input = { patrolTick: WORLDBEAT_EVERY * 2, heading: H };
  const before = JSON.stringify(input);
  assert.deepEqual(
    pickWorldBeat({ ...input }),
    pickWorldBeat({ ...input }),
  );
  assert.equal(JSON.stringify(input), before);
});
