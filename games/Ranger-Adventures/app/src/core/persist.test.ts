/**
 * persist.test.ts — seeded unit test for the localStorage namespacing + legacy
 * migration (RUN-LEDGER Phase 8: `ranger-mvp-state` → `alvah-ef-v1`).
 * Run: `node --experimental-strip-types --test src/core/persist.test.ts`
 *
 * The load-bearing invariant: co-tenanting the shared `alvah-ef-v1` key must
 * NEVER destroy the `/spelen` games' data (exercises/mijlpalen/preferences).
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STORAGE_KEY,
  RANGER_NS,
  LEGACY_KEY,
  readRangerPartial,
  writeRangerRoot,
} from './persist.ts';

// A representative `/spelen` blob (docs/practice-games-schema.md) we must preserve.
const SPELEN = {
  schemaVersion: 1,
  createdAt: '2026-04-22T10:00:00Z',
  preferences: { sound: true, textSize: 'large' },
  exercises: { simon: { currentLevel: 2, highestLevel: 3, sessions: [{ id: 's1' }] } },
  mijlpalen: { bereikt: ['simon-1'], cadeaus: [] },
};

test('the shared key is alvah-ef-v1 and the ns is ranger (not the legacy key)', () => {
  assert.equal(STORAGE_KEY, 'alvah-ef-v1');
  assert.equal(RANGER_NS, 'ranger');
  assert.equal(LEGACY_KEY, 'ranger-mvp-state');
});

test('nothing persisted anywhere → null (caller builds fresh)', () => {
  assert.equal(readRangerPartial(null, null), null);
  assert.equal(readRangerPartial('', ''), null);
});

test('reads the ranger namespace out of the shared blob', () => {
  const root = JSON.stringify({ ...SPELEN, [RANGER_NS]: { eikels: 7, missie: 'ven' } });
  const got = readRangerPartial(root, null);
  assert.deepEqual(got, { eikels: 7, missie: 'ven' });
});

test('falls back to the legacy standalone key when no ns present', () => {
  const legacy = JSON.stringify({ eikels: 3, missie: 'frisling' });
  // shared blob has only /spelen data, no ranger ns
  const got = readRangerPartial(JSON.stringify(SPELEN), legacy);
  assert.deepEqual(got, { eikels: 3, missie: 'frisling' });
});

test('the ranger namespace WINS over a stale legacy key', () => {
  const root = JSON.stringify({ [RANGER_NS]: { eikels: 99 } });
  const legacy = JSON.stringify({ eikels: 1 });
  assert.deepEqual(readRangerPartial(root, legacy), { eikels: 99 });
});

test('writing the ranger state PRESERVES every /spelen field', () => {
  const root = JSON.stringify(SPELEN);
  const out = JSON.parse(writeRangerRoot(root, { eikels: 5, voltooid: { frisling: true } }));
  // ranger landed
  assert.deepEqual(out[RANGER_NS], { eikels: 5, voltooid: { frisling: true } });
  // /spelen survived verbatim
  assert.equal(out.schemaVersion, 1);
  assert.deepEqual(out.preferences, SPELEN.preferences);
  assert.deepEqual(out.exercises, SPELEN.exercises);
  assert.deepEqual(out.mijlpalen, SPELEN.mijlpalen);
});

test('full migration round-trip: legacy-only → write → reads back from the ns, /spelen intact', () => {
  // Start: /spelen blob exists + a legacy ranger key (pre-migration state).
  const sharedBefore = JSON.stringify(SPELEN);
  const legacy = JSON.stringify({ eikels: 4, missie: 'stuifzand' });
  const migrated = readRangerPartial(sharedBefore, legacy);
  assert.deepEqual(migrated, { eikels: 4, missie: 'stuifzand' });
  // Save it back into the shared blob.
  const sharedAfter = writeRangerRoot(sharedBefore, migrated);
  // Now the ns wins and /spelen is untouched.
  assert.deepEqual(readRangerPartial(sharedAfter, legacy), { eikels: 4, missie: 'stuifzand' });
  const out = JSON.parse(sharedAfter);
  assert.deepEqual(out.exercises, SPELEN.exercises);
  assert.deepEqual(out.mijlpalen, SPELEN.mijlpalen);
});

test('garbage / wrong-type sources are treated as absent, never throw', () => {
  assert.equal(readRangerPartial('not json{', 'also bad'), null);
  assert.equal(readRangerPartial(JSON.stringify([1, 2, 3]), null), null); // array root
  assert.equal(readRangerPartial(JSON.stringify({ ranger: 42 }), null), null); // ns not an object
  // writing onto a garbage root still yields a clean object with the ns set
  const out = JSON.parse(writeRangerRoot('garbage{', { eikels: 1 }));
  assert.deepEqual(out, { ranger: { eikels: 1 } });
});

test('deterministic — same inputs, same outputs', () => {
  const root = JSON.stringify({ ...SPELEN, [RANGER_NS]: { eikels: 2 } });
  assert.deepEqual(readRangerPartial(root, null), readRangerPartial(root, null));
  assert.equal(writeRangerRoot(root, { eikels: 2 }), writeRangerRoot(root, { eikels: 2 }));
});
