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
import { addVeldnotitie, collectedCount, factPool, pickFact, planFacts, type Feit } from './veldnotitie.ts';
import { newPlay } from './play.ts';
import { AREA_VELUWE } from '../content/veluwe.ts';

type Skin = { feit?: string; meerFeiten?: string[] };
const AREA = AREA_VELUWE as unknown as { missies: { id: string; stappen: { skin: Skin }[] }[] };

/** The old derive (before run 7): one note per fact step, id = `${m.id}:${i}`. */
function factIds(): string[] {
  const out: string[] = [];
  for (const m of AREA.missies) {
    m.stappen.forEach((s, i) => { if (s.skin.feit) out.push(`${m.id}:${i}`); });
  }
  return out;
}

/** The same derive Content.veldnotities runs since run 7: every fact of every step's pool. */
function poolIds(): string[] {
  return AREA.missies.flatMap((m) => m.stappen.flatMap((s, i) => factPool(m.id, i, s.skin).map((f) => f.id)));
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

/* ---- run 7 (words-ree): a small pool of facts per step, drawn unread-first ---- */

test('every fact step keeps its old id first, and its pool adds new ids after it (an old save keeps its board)', () => {
  const ids = poolIds();
  assert.equal(new Set(ids).size, ids.length, 'no two facts collide on an id');
  for (const id of factIds()) assert.ok(ids.includes(id), `the old id ${id} is still on the board`);
  for (const id of ids) assert.match(id, /^[a-z0-9-]+:\d+(\.\d+)?$/, `id ${id} is <missionId>:<step>[.<n>]`);
  // every step with a fact has a small pool: today's fact and two more
  for (const m of AREA.missies) m.stappen.forEach((s, i) => {
    if (s.skin.feit) assert.equal(factPool(m.id, i, s.skin).length, 3, `${m.id}:${i} has three facts`);
  });
  // an old save's collected ids are all still facts the board shows
  const old = { 'frisling:0': true, 'frisling:2': true, 'ree-niet-aanraken:1': true };
  assert.equal(collectedCount(old, ids), 3);
});

test('pickFact: one he has not read, from the play\'s stream; none once he read them all', () => {
  const pool: Feit[] = [{ id: 'a:0', tekst: 'A.' }, { id: 'a:0.1', tekst: 'B.' }, { id: 'a:0.2', tekst: 'C.' }];
  assert.equal(pickFact(pool, { 'a:0': true, 'a:0.2': true }, () => 0.99)?.id, 'a:0.1');
  assert.equal(pickFact(pool, { 'a:0': true, 'a:0.1': true, 'a:0.2': true }, () => 0.5), null);
  assert.equal(pickFact([], {}, () => 0.5), null);
  // every unread fact can be drawn
  const seen = new Set([0, 0.34, 0.67, 0.999].map((r) => pickFact(pool, {}, () => r)?.id));
  assert.equal(seen.size, 3);
});

test('planFacts: three plays in a row show different facts or none — never one he read, the same for a replayed seed', () => {
  const m = AREA.missies.find((x) => x.id === 'frisling')!;
  let read: Record<string, boolean> = {};
  const shown: string[] = [];
  for (let n = 1; n <= 4; n++) {
    const play = newPlay('frisling', 1000 + n, n);
    const plan = planFacts('frisling', m.stappen, read, play.fork('feit').rng);
    // (the same seed draws the same plan)
    assert.deepEqual([...planFacts('frisling', m.stappen, read, newPlay('frisling', 1000 + n, n).fork('feit').rng)], [...plan]);
    for (const f of plan.values()) {
      assert.ok(!read[f.id], `play ${n}: ${f.id} was read before`);
      shown.push(f.id);
      read = addVeldnotitie(read, f.id);
    }
    if (n <= 3) assert.equal(plan.size, 3, `play ${n}: a card at each of the three steps`);
    else assert.equal(plan.size, 0, 'every fact read: no card at all');
  }
  assert.equal(new Set(shown).size, 9, 'nine different facts over three plays');
});
