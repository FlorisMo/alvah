/**
 * discover.test.ts — run 7: the rare roll (a seeded chance + the pity rule) and the
 * discoveries table. Run: `node --experimental-strip-types --test src/core/discover.test.ts`
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { rollRare, nextRareCount, rareChance, RARE_P, RARE_STEP, RARE_PITY, RARE_P_FOUND } from './discover.ts';
import { newPlay } from './play.ts';
import { ONTDEKKINGEN, ontdekking, ontdekkingenVan, naamVan, type Ontdekking } from '../content/ontdekkingen.ts';

const TABLE: Ontdekking[] = [
  { id: 'h.a', home: 'h', soort: 'dier', naam: 'de a', hint: 'Wie is a?' },
  { id: 'h.ijsvogel', home: 'h', soort: 'zeldzaam', naam: 'de ijsvogel', hint: 'Wie flitst blauw?' },
  { id: 'h.uil', home: 'h', soort: 'zeldzaam', naam: 'de uil', hint: 'Wie roept in de schemer?', stemming: ['schemer'] },
  { id: 'g.b', home: 'g', soort: 'dier', naam: 'de b', hint: 'Wie is b?' },
];
/** A play of home h: its `n` (the home's play number) follows the counter unless given (a
 *  counter of k won plays without a rare is at least play k + 1). */
const roll = (seed: number, counts: Record<string, number> = {}, found: Record<string, unknown> = {}, mood = 'gouden-uur' as const, n?: number) =>
  rollRare({ home: 'h', play: newPlay('h', seed, n ?? (counts.h ?? 0) + 1), table: TABLE, found, counts, mood });

test('a home without rare rows never gets one', () => {
  for (let s = 0; s < 50; s++) assert.equal(rollRare({ home: 'g', play: newPlay('g', s, 9), table: TABLE, found: {}, counts: { g: 9 }, mood: 'gouden-uur' }), null);
});

test('never on a home\'s first play, nor on the play right after one of its rares', () => {
  for (let s = 0; s < 300; s++) {
    assert.equal(roll(s, {}, {}, 'gouden-uur', 1), null, 'its first play');
    assert.equal(roll(s, { h: 9 }, {}, 'gouden-uur', 1), null, 'its first play, whatever an old counter says');
    assert.equal(roll(s, { h: 0 }, {}, 'gouden-uur', 4), null, 'right after a rare (the counter is 0)');
    assert.equal(roll(s, { h: 0 }, { 'h.ijsvogel': {}, 'h.uil': {} }, 'gouden-uur', 7), null, 'all found: the same spacing');
  }
});

test('deterministic per seed; a low chance that grows, sure after RARE_PITY won plays without one', () => {
  for (let s = 0; s < 30; s++) assert.equal(roll(s, { h: 2 })?.id ?? null, roll(s, { h: 2 })?.id ?? null);
  assert.equal(rareChance(1, true), RARE_P);
  assert.ok(RARE_P >= 0.1 && RARE_P <= 0.15, 'a low chance at first');
  for (let c = 2; c < RARE_PITY; c++) assert.ok(Math.abs(rareChance(c, true) - (RARE_P + RARE_STEP * (c - 1))) < 1e-9);
  assert.equal(rareChance(RARE_PITY, true), 1);
  for (const c of [1, 3, RARE_PITY, 12]) assert.equal(rareChance(c, false), RARE_P_FOUND, 'all found: now and then, no pity');
  const hits = Array.from({ length: 1200 }, (_, s) => roll(s, { h: 1 })).filter(Boolean).length;
  assert.ok(Math.abs(hits / 1200 - RARE_P) < 0.04, `${hits}/1200 ≈ ${RARE_P}`);
  for (let s = 0; s < 60; s++) assert.ok(roll(s, { h: RARE_PITY }), `seed ${s}: after ${RARE_PITY} won plays without one, it comes`);
});

/** One career at a home: he plays it `plays` times, winning each, and sees every rare that
 *  comes. Returns the plays (1-based) that brought one. */
function career(base: number, plays: number, lose: (n: number) => boolean = () => false): number[] {
  const counts: Record<string, number> = {};
  const found: Record<string, unknown> = {};
  const at: number[] = [];
  for (let n = 1; n <= plays; n++) {
    const r = rollRare({ home: 'h', play: newPlay('h', (base * 7919 + n * 104729) >>> 0, n), table: TABLE, found, counts, mood: 'schemer' });
    const won = !lose(n);
    if (r && won) { at.push(n); found[r.id] = { t: 1, n: 1 }; }
    counts.h = nextRareCount(counts.h ?? 0, { won, gotRare: !!r && won });
  }
  return at;
}

test('many careers: the first rare never on play 1, always by play 6, about the 4th-5th as a rule, never two plays in a row', () => {
  const firsts: number[] = [];
  for (let c = 0; c < 2000; c++) {
    const at = career(c, 30);
    assert.ok(at.length > 0, `career ${c}: a rare within 30 plays`);
    assert.ok(at[0] >= 2 && at[0] <= 6, `career ${c}: the first rare on play ${at[0]}`);
    firsts.push(at[0]);
    for (let i = 1; i < at.length; i++) assert.ok(at[i] - at[i - 1] >= 2, `career ${c}: rares on plays ${at[i - 1]} and ${at[i]}`);
    // the home's second rare (the uil at dusk) by the 6th play after the first, too
    assert.ok(at.length >= 2 && at[1] - at[0] <= 6, `career ${c}: the second rare ${at[1] - at[0]} plays after the first`);
  }
  firsts.sort((a, b) => a - b);
  const median = firsts[Math.floor(firsts.length / 2)];
  const mean = firsts.reduce((a, b) => a + b, 0) / firsts.length;
  assert.ok(median >= 4 && median <= 5, `median first rare: play ${median}`);
  assert.ok(mean >= 4 && mean <= 5, `mean first rare: play ${mean.toFixed(2)}`);
  assert.ok(firsts.filter((n) => n === 2).length > 0.05 * firsts.length, 'now and then early: a nice surprise');
  // all found: still now and then over a long career (spaced, never two in a row: above)
  const late = Array.from({ length: 300 }, (_, c) => career(c, 60).filter((n) => n > 25).length);
  const per = late.reduce((a, b) => a + b, 0) / (300 * 35);
  assert.ok(per > 0.05 && per < 0.12, `all found: about one play in ten (${per.toFixed(3)})`);
});

test('a stopped play neither counts toward the rule nor resets it', () => {
  // he stops every other play: the rare still comes by his 6th WON play
  for (let c = 0; c < 400; c++) {
    const at = career(c, 30, (n) => n % 2 === 0);
    assert.ok(at[0] >= 2 && at[0] <= 11, `career ${c}: first rare on play ${at[0]} (won plays 1..6)`);
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
  const some = Array.from({ length: 600 }, (_, s) => roll(s, { h: 9 }, found)).filter(Boolean).length;
  assert.ok(some > 30 && some < 95, `all found: about one in ten (${some}/600)`);
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
