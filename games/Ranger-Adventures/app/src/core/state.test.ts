/**
 * state.test.ts — run 7: the save grows additively. A run-6 save loads with everything it
 * had and the new fields defaulted; the beat history stays bounded; a discovery is new
 * once; the store's level and knobs read the skill record.
 * Run: `node --experimental-strip-types --test src/core/state.test.ts`
 * (No localStorage under node: the store starts fresh and its writes are quietly skipped.)
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { hydrate, beatLog, appendBeat, HISTORY_MAX, DEFAULT_STATE, store, type BeatLog, type GameState } from './state.ts';
import { newPlay } from './play.ts';
import { knobsFor } from './skill.ts';

/** A save as run 6 wrote it: DEFAULT_STATE's shape before run 7, with progress in it. */
function run6Save(): Partial<GameState> {
  const { geschiedenis: _g, ontdekt: _o, zeldzaam: _z, gespeeld: _p, sfeer: _s, ...run6 } = structuredClone(DEFAULT_STATE);
  return {
    ...run6,
    voltooid: { frisling: true, 'ree-niet-aanraken': true },
    veldnotities: { 'frisling-0': true },
    knapWoorden: { 'knap-frisling': { naam: 'frisling' } },
    skill: {
      ...run6.skill,
      zoeken: { level: 2.36, best: 2.7, reversals: [{ dir: 1, at: 2 }], recent: [true, true], trials: 4 },
      simon: { level: 1.34, best: 1.34, reversals: [], recent: [true], trials: 1 },
    },
    avatar: { naam: 'Bo', huid: 'bruin', haar: run6.avatar.haar, outfit: run6.avatar.outfit, iris: run6.avatar.iris },
    avatarGemaakt: true,
    settings: { ...run6.settings, jargon: true, voorlezen: false, force2d: true },
  };
}

test('a run-6 save loads: progress, skills, avatar and settings kept, the run-7 fields defaulted', () => {
  const saved = run6Save();
  assert.ok(!('geschiedenis' in saved) && !('sfeer' in saved), 'the fixture has no run-7 fields');
  const s = hydrate(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(s.voltooid, { frisling: true, 'ree-niet-aanraken': true });
  assert.deepEqual(s.veldnotities, { 'frisling-0': true });
  assert.deepEqual(s.knapWoorden, { 'knap-frisling': { naam: 'frisling' } });
  assert.equal(s.skill.zoeken.level, 2.36);
  assert.equal(s.skill.zoeken.best, 2.7);
  assert.equal(s.skill.zoeken.trials, 4);
  assert.equal(s.skill.simon.level, 1.34);
  assert.equal(s.skill.corsi.level, 1, 'an engine never played: blank');
  assert.equal(s.avatar.naam, 'Bo');
  assert.equal(s.avatar.huid, 'bruin');
  assert.equal(s.avatarGemaakt, true);
  assert.equal(s.settings.jargon, true);
  assert.equal(s.settings.voorlezen, false);
  assert.equal(s.settings.force2d, true);
  // run 7, defaulted
  assert.deepEqual(s.geschiedenis, []);
  assert.deepEqual(s.ontdekt, {});
  assert.deepEqual(s.zeldzaam, {});
  assert.deepEqual(s.gespeeld, {});
  assert.deepEqual(s.sfeer, { laatste: null, sessies: 0 });
});

test('a broken run-7 field never breaks a load', () => {
  const s = hydrate({ ...run6Save(), geschiedenis: 'x' as never, ontdekt: [1] as never, zeldzaam: null as never, sfeer: { laatste: 'storm', sessies: -3 } as never });
  assert.deepEqual(s.geschiedenis, []);
  assert.deepEqual(s.ontdekt, {});
  assert.deepEqual(s.zeldzaam, {});
  assert.deepEqual(s.sfeer, { laatste: null, sessies: 0 });
  assert.equal(hydrate(null).screen, 'map', 'no save: a fresh state');
  const kept = hydrate({ sfeer: { laatste: 'schemer', sessies: 4 }, gespeeld: { frisling: 3 }, ontdekt: { 'frisling.frisling': { t: 5, n: 2 } } });
  assert.deepEqual(kept.sfeer, { laatste: 'schemer', sessies: 4 });
  assert.deepEqual(kept.gespeeld, { frisling: 3 });
  assert.deepEqual(kept.ontdekt, { 'frisling.frisling': { t: 5, n: 2 } });
});

test('a beat log: what was played, at which level, from which play', () => {
  const play = newPlay('frisling', 4242, 1);
  play.note('hide', 'b');
  play.note('mood', 'gouden-uur');
  const log = beatLog('zoeken', { trials: 1, correct: 1, misses: 0, seconds: 3.04, span: undefined }, { missionId: 'frisling', view: 'world', play }, 1.3367, 1000);
  assert.deepEqual(log, { t: 1000, e: 'zoeken', m: 'frisling', w: 'world', lv: 1.34, n: 1, c: 1, ms: 0, s: 3, sd: 4242, va: 'hide:b,mood:gouden-uur' });
  const hut = beatLog('corsi', { trials: 1, correct: 0 }, { missionId: '', view: '2d', play: null }, 2, 7);
  assert.deepEqual(hut, { t: 7, e: 'corsi', m: '', w: '2d', lv: 2, n: 1, c: 0, sd: 0 });
  assert.equal(beatLog('simon', { success: true }, { missionId: 'm', view: 'stage', play: null }, 1, 0).c, 1, 'success without counts');
  const span = beatLog('simon', { trials: 3, correct: 2, span: 4, start: 2 }, { missionId: 'm', view: 'world', play: null }, 1, 0);
  assert.equal(span.sp, 4);
  assert.equal(span.st, 2);
});

test('the history is bounded: the oldest beats go first', () => {
  let h: BeatLog[] = [];
  for (let i = 0; i < HISTORY_MAX + 25; i++) h = appendBeat(h, { t: i, e: 'zoeken', m: '', w: '2d', lv: 1, n: 1, c: 1, sd: 0 });
  assert.equal(h.length, HISTORY_MAX);
  assert.equal(h[0].t, 25);
  assert.equal(h[h.length - 1].t, HISTORY_MAX + 24);
  assert.equal(hydrate({ geschiedenis: h.concat(h) }).geschiedenis.length, HISTORY_MAX, 'a load keeps the newest too');
});

test('the store: a beat goes into the history and the skill record, as before', () => {
  const before = store.get().skill.dagnacht.level;
  const play = newPlay('frisling', 9, 2);
  store.logBeat('dagnacht', { trials: 5, correct: 5 }, { missionId: 'frisling', view: 'world', play });
  const s = store.get();
  const last = s.geschiedenis[s.geschiedenis.length - 1];
  assert.equal(last.e, 'dagnacht');
  assert.equal(last.lv, Math.round(before * 100) / 100, 'the level it started at');
  assert.equal(last.sd, 9);
  assert.equal(last.w, 'world');
  assert.ok(s.skill.dagnacht.level > before, 'the staircase still moved');
  assert.equal(s.skill.dagnacht.trials, 5);
  store.logSession('corsi', { trials: 1, correct: 1 });
  const hut = store.get().geschiedenis.at(-1)!;
  assert.deepEqual([hut.e, hut.m, hut.w, hut.sd], ['corsi', '', '2d', 0], 'logSession: a 2D beat without a play');
  assert.equal(store.level('dagnacht'), store.get().skill.dagnacht.level);
  assert.deepEqual(store.knobs('dagnacht'), knobsFor('dagnacht', store.level('dagnacht')));
  store.setSetting({ autoMoeilijk: false, routeLengte: 5 });
  assert.deepEqual(store.knobs('corsi'), { start: 5, max: 5, rounds: 1 }, 'automatisch off: the manual setting');
  store.setSetting({ autoMoeilijk: true });
});

test('the store: a discovery is new once; plays and rare counters count; a session is noted', () => {
  assert.equal(store.discover('frisling.frisling'), true);
  assert.equal(store.discover('frisling.frisling'), false);
  assert.equal(store.get().ontdekt['frisling.frisling'].n, 2);
  assert.equal(store.notePlay('frisling'), 1);
  assert.equal(store.notePlay('frisling'), 2);
  store.rareEnd('frisling', false);
  store.rareEnd('frisling', false);
  assert.equal(store.get().zeldzaam.frisling, 2);
  store.rareEnd('frisling', false, false);
  assert.equal(store.get().zeldzaam.frisling, 2, 'a stopped play keeps the count');
  store.rareEnd('frisling', true);
  assert.equal(store.get().zeldzaam.frisling, 0);
  const n = store.get().sfeer.sessies;
  store.noteSession('gouden-uur');
  assert.deepEqual(store.get().sfeer, { laatste: 'gouden-uur', sessies: n + 1 });
});

test('the store (veldgids): seen in the gids and revealed are kept on the discovery, a new meeting keeps them', () => {
  store.discover('wereld.specht');
  store.markGezien(['wereld.specht', 'nope.nope']);
  assert.equal(store.get().ontdekt['wereld.specht'].g, 1);
  assert.equal(store.get().ontdekt['nope.nope'], undefined, 'only what he discovered');
  store.markRevealed('wereld.specht');
  assert.equal(store.get().ontdekt['wereld.specht'].r, 1);
  store.discover('wereld.specht');
  assert.deepEqual({ ...store.get().ontdekt['wereld.specht'], t: 0 }, { t: 0, n: 2, g: 1, r: 1 }, 'met again: counted, the flags stay');
  // an older save's discovery (no flags) loads as it was
  assert.deepEqual(hydrate({ ontdekt: { 'wereld.buizerd': { t: 1, n: 1 } } }).ontdekt, { 'wereld.buizerd': { t: 1, n: 1 } });
});
