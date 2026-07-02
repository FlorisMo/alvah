/**
 * veldnotitie.test.ts — unit test for the W6.3b collectible-veldnotitie model.
 * Run: `node --experimental-strip-types --test src/core/veldnotitie.test.ts`
 *
 * Two layers, both pure/deterministic:
 *  1. The pure collection model (`addVeldnotitie`/`collectedCount`): idempotent,
 *     empty-id-safe, same-ref on a no-op (so the store can skip a dead commit).
 *  2. The content invariant the collection rests on: every "Wist je dat"-fact in
 *     the area has a STABLE, UNIQUE id of the shape `<missionId>:<step>` — the
 *     exact id the registry derive emits (mirrored here from the source data,
 *     since registry.ts uses extensionless imports node cannot resolve; the
 *     derive itself is exercised end-to-end in raaf-fact/board E2E).
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { addVeldnotitie, collectedCount } from './veldnotitie.ts';
import { AREA_VELUWE } from '../content/veluwe.ts';

/** The same derive Content.veldnotities runs: one note per fact step, id = `${m.id}:${i}`. */
function factIds(): string[] {
  const out: string[] = [];
  const area = AREA_VELUWE as unknown as { missies: { id: string; stappen: { skin: { feit?: string } }[] }[] };
  for (const m of area.missies) {
    m.stappen.forEach((s, i) => { if (s.skin.feit) out.push(`${m.id}:${i}`); });
  }
  return out;
}

test('addVeldnotitie pins an id, is idempotent, and empty-id-safe (same ref on no-op)', () => {
  const empty = {};
  const one = addVeldnotitie(empty, 'frisling:2');
  assert.deepEqual(one, { 'frisling:2': true }, 'the id is pinned');
  assert.notEqual(one, empty, 'a real change returns a NEW object (immutable)');

  // idempotent: collecting the same id again returns the SAME reference
  assert.equal(addVeldnotitie(one, 'frisling:2'), one, 'no-op returns the same ref');
  // empty id is a no-op that never writes a junk key
  assert.equal(addVeldnotitie(one, ''), one, 'empty id ignored, same ref');

  const two = addVeldnotitie(one, 'nachtronde:0');
  assert.deepEqual(two, { 'frisling:2': true, 'nachtronde:0': true });
});

test('collectedCount counts only ids present in the set', () => {
  const set = addVeldnotitie(addVeldnotitie({}, 'a:0'), 'b:1');
  assert.equal(collectedCount(set, ['a:0', 'b:1', 'c:2']), 2);
  assert.equal(collectedCount({}, ['a:0']), 0);
  assert.equal(collectedCount(set, []), 0);
});

test('every fact step yields one veldnotitie id, all unique and <missionId>:<step>', () => {
  const ids = factIds();
  assert.ok(ids.length > 0, 'the Veluwe has collectible facts');
  assert.equal(new Set(ids).size, ids.length, 'no two facts collide on an id');
  for (const id of ids) assert.match(id, /^[a-z0-9-]+:\d+$/, `id ${id} is <missionId>:<step>`);

  // a full collection reports every id found
  const all = ids.reduce<Record<string, boolean>>((s, id) => addVeldnotitie(s, id), {});
  assert.equal(collectedCount(all, ids), ids.length, 'collecting all ids counts them all');
});
