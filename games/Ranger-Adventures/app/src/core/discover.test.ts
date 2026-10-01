/**
 * discover.test.ts — run 7: the rare roll (a seeded chance + the pity rule) and the
 * discoveries table. Run: `node --experimental-strip-types --test src/core/discover.test.ts`
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { rollRare, nextRareCount, RARE_P, RARE_PITY } from './discover.ts';
import { newPlay } from './play.ts';
import { ONTDEKKINGEN, ontdekking, ontdekkingenVan, naamVan, type Ontdekking } from '../content/ontdekkingen.ts';

const TABLE: Ontdekking[] = [
  { id: 'h.a', home: 'h', soort: 'dier', naam: 'de a', hint: 'Wie is a?' },
  { id: 'h.ijsvogel', home: 'h', soort: 'zeldzaam', naam: 'de ijsvogel', hint: 'Wie flitst blauw?' },
  { id: 'h.uil', home: 'h', soort: 'zeldzaam', naam: 'de uil', hint: 'Wie roept in de schemer?', stemming: ['schemer'] },
  { id: 'g.b', home: 'g', soort: 'dier', naam: 'de b', hint: 'Wie is b?' },
];
const roll = (seed: number, counts: Record<string, number> = {}, found: Record<string, unknown> = {}, mood = 'gouden-uur' as const) =>
  rollRare({ home: 'h', play: newPlay('h', seed, 1), table: TABLE, found, counts, mood });

test('a home without rare rows never gets one', () => {
  for (let s = 0; s < 50; s++) assert.equal(rollRare({ home: 'g', play: newPlay('g', s, 1), table: TABLE, found: {}, counts: { g: 9 }, mood: 'gouden-uur' }), null);
});

test('deterministic per seed, and about a third of fresh plays get one', () => {
  for (let s = 0; s < 30; s++) assert.equal(roll(s)?.id ?? null, roll(s)?.id ?? null);
  const hits = Array.from({ length: 600 }, (_, s) => roll(s)).filter(Boolean).length;
  assert.ok(Math.abs(hits / 600 - RARE_P) < 0.07, `${hits}/600 ≈ ${RARE_P}`);
});

test('the pity rule: a rare surely comes by the third won play of a home', () => {
  // seeds whose luck says no, played three times in a row, each won without a rare
  const unlucky = Array.from({ length: 400 }, (_, s) => s).filter((s) => !roll(s));
  assert.ok(unlucky.length > 100);
  for (const s of unlucky.slice(0, 60)) {
    assert.ok(roll(s, { h: RARE_PITY }), `with ${RARE_PITY} won plays behind it, seed ${s} gets one`);
    // three plays in a row (a session's seeds s, s+1, s+2), each won without seeing it
    let count = 0;
    let at = 0;
    for (let play = 1; play <= 3 && !at; play++) {
      if (roll(s + play - 1, { h: count })) at = play;
      else count = nextRareCount(count, { won: true, gotRare: false });
    }
    assert.ok(at >= 1 && at <= 3, `seed ${s}: a rare within three plays`);
  }
});

test('the pick prefers one he has not found, and respects the mood', () => {
  for (let s = 0; s < 40; s++) {
    const r = roll(s, { h: RARE_PITY });
    assert.ok(r, 'pity');
    assert.equal(r!.id, 'h.ijsvogel', 'the uil only comes at dusk');
  }
  const atDusk = new Set(Array.from({ length: 40 }, (_, s) => roll(s, { h: RARE_PITY }, { 'h.ijsvogel': { t: 1, n: 1 } }, 'schemer' as never)?.id));
  assert.deepEqual([...atDusk], ['h.uil'], 'at dusk the one not found yet');
  // all found: the pity rule rests (only luck brings one, now and then)
  const found = { 'h.ijsvogel': { t: 1, n: 1 }, 'h.uil': { t: 1, n: 1 } };
  const some = Array.from({ length: 300 }, (_, s) => roll(s, { h: 9 }, found)).filter(Boolean).length;
  assert.ok(some > 20 && some < 110, `all found: about one in five (${some}/300)`);
});

test('the counter: reset by a rare, one up after a won play, kept after a stop', () => {
  assert.equal(nextRareCount(2, { won: true, gotRare: true }), 0);
  assert.equal(nextRareCount(1, { won: true, gotRare: false }), 2);
  assert.equal(nextRareCount(1, { won: false, gotRare: false }), 1);
  assert.equal(nextRareCount(1, { won: false, gotRare: true }), 0);
});

test('the table: unique ids named <home>.<thing>, a known kind, one helped animal per adventure', () => {
  const ids = ONTDEKKINGEN.map((o) => o.id);
  assert.equal(new Set(ids).size, ids.length, 'unique ids');
  for (const o of ONTDEKKINGEN) {
    assert.ok(o.id.startsWith(`${o.home}.`), `${o.id} lives in ${o.home}`);
    assert.ok(['dier', 'zeldzaam', 'spoor', 'vondst', 'foto'].includes(o.soort), o.id);
    assert.ok(/^(de|het) /.test(o.naam), `${o.id}: its name with its article ("${o.naam}")`);
    assert.ok(o.model || o.icon, `${o.id} has a picture`);
  }
  for (const home of ['frisling', 'ree-niet-aanraken', 'wildcamera', 'eekhoorn']) {
    assert.equal(ontdekkingenVan(home).filter((o) => o.geholpen).length, 1, `${home}: one helped animal`);
  }
  assert.equal(ontdekking('frisling.frisling')?.naam, 'de big');
  assert.equal(naamVan(ontdekking('frisling.frisling')!, true), 'de frisling');
  assert.equal(naamVan(ontdekking('frisling.frisling')!, false), 'de big');
  assert.equal(ontdekking('nope'), undefined);
});
