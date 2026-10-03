/**
 * frisling.places.test.ts — where "De verdwaalde frisling" happens is chosen by looking
 * at the world; this pins that it stays a good place (design run6-missions §3.4, §4.1,
 * run 7 frisling §5.2-§5.4, §5.7): dry, on the heath or the dry meadow, inside the world,
 * clear of the paths, the props, the trees, the roaming animals, the other markers and the
 * other homes, at the right distances (a real follow, a real lead home with the family
 * ahead), the rooting fields' seven look-alike spots in one view — for EVERY WAY the play
 * may draw, every nook the piglet may lie in (off centre, inside the picture, the same
 * size and the same glimpse), and every way the family may lie at the mud. Run: `npm test`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  FRISLING_PLACES as P, FRISLING_RESIDENTS, FRISLING_HOME, MARKER, STAND, STAND_FRAME, FIELD_FRAME, WALLOW, WALLOW_FRAME, LOST_SPOT,
  fieldSpots, fieldSpotsOf, hideClumps, frislingClearings, SEARCH_VIEW, FIELD_VIEW, WALLOW_VIEW, LEAD_CLUMP_COUNT,
  cluePosts, clueGap, bootPrints, CLUE_FRAME, WAYS, WAY_IDS, FAMILY_LAYOUTS, nookAt, decoyAt, placesFor, useWay, wallowLog,
  wallowClumps, standCover, standSeed, spotTag, SOW_NOTICE_M, outSpotOf, bagView, sideBySideView, BAG_REACH, type WayId, type Way, type WayView,
  zeugStare, zeugView, ZEUG_STARE_M, ZEUG_STEP_M, walkOnSpot, yearlingSideOf, yearlingWay, legGap, YEARLING_LOG_M,
} from './frisling.places.ts';
import { WALK_ON_M } from '../beats/walk-math.ts';
import { anchorInBiome, biomeAt, heightAt, VEN_CENTER } from '../../Biomes.ts';
import { distanceToNetwork, LANE_HALF } from '../../Paths.ts';
import { dist, headingTo, toLocal, atLocal, segDist, offCentre } from '../places.ts';
import { AREA_VELUWE } from '../../../content/veluwe.ts';
import { PRINT_SPOTS } from '../../../engines/corsi.ts';
import { obstacleGap } from '../../CharacterController.ts';
import { REE_PLACES, reeClearings, LAYOUTS as REE_LAYOUTS, COPSE_TREES } from './ree.places.ts';
import { fitFrame, screenOf } from '../../play/frame-fit.ts';
import { growStems, openWindow, visibleShare, backPoints } from '../cover-math.ts';
import { SIZE, RANGER_STAND_HEIGHT } from '../../AnimalScale.ts';
import { lyingHeight, LEG_SHARE } from '../../play/pose.ts';
import { knobsFor } from '../../../core/skill.ts';

/** The other missions' markers as the world places them (world/Markers.placeMarkers:
 *  the landschap anchors; read with `__ranger.markers()`, 2026-10-01). */
const OTHER_MARKERS = {
  'ree-niet-aanraken': { x: -15.008831796612796, z: -27.124434889984062 },
  herstel: { x: -34.999270825785885, z: -19.36623457627458 },
  wildcamera: { x: 15.556349186104047, z: -15.556349186104043 },
  stuifzand: { x: 8.3, z: 20.39 },
  ven: { x: 24.5, z: -19.0 },
};
/** The world's props and solids near the frisling home (`__ranger.dressing()`,
 *  `obstacles()`, 2026-10-01) + their solid radius: the foxgloves, the big stone, the west
 *  signpost, the mushrooms, the poacher's figure in the meadow, the cabin. */
const PROPS = [
  { name: 'foxglove', x: -10, z: -22, r: 0 }, { name: 'stone', x: -20, z: -28, r: 0.9 }, { name: 'foxglove', x: -6, z: -30, r: 0 },
  { name: 'signpost-west', x: -16, z: 10, r: 1.2 }, { name: 'mushrooms', x: -19, z: 14, r: 0 },
  { name: 'poacher', x: -11.5, z: 8.5, r: 1.1 }, { name: 'cabin', x: -6.5, z: -6, r: 4.41 },
];
/** Every tree near the frisling home (`__ranger.treeSpots()`, 2026-10-01): the grove at
 *  the ree's copse, the boa post's birches, the forest's rim. */
const TREES = [
  { x: -51, z: -24 }, { x: -9.3, z: -40.8 }, { x: -5.7, z: -41.8 }, { x: -5.0, z: -35.8 }, { x: -3.6, z: -38.2 },
  { x: -60, z: -15 }, { x: -55.9, z: -51.1 }, { x: -58.2, z: -48.8 }, { x: 4.8, z: -15.3 }, { x: 5.2, z: -18.1 },
];
/** The roaming animals' wander loops (world/Fauna.placeAmbientLife): home + radius. */
const ROAMERS = [
  { id: 'vos', x: -42, z: -2, r: 6 },
  { id: 'eekhoorn', x: 4, z: -11, r: 3 },
  { id: 'wildzwijn', x: 10, z: 36, r: 6 },
];
/** The two helipads and their radius (world/Vehicles.ts PADS, PAD_RADIUS: not importable
 *  under node). */
const PADS = [{ x: 32, z: 18 }, { x: -44, z: -26 }];
const PAD_RADIUS = 3.2;
/** The lens the world takes (World.camera) and the screen golden plays on. */
const FOV = 55, W = 1280, H = 800;

/** The stand of a way, as a ring of its rim (its clumps reach halfW + 0.45 × halfD + 0.4). */
const rimOf = (w: Way): { name: string; x: number; z: number; r: number }[] => Array.from({ length: 24 }, (_, i) => {
  const a = (i / 24) * Math.PI * 2;
  return { name: `${w.id}.stand-rim-${i}`, ...atLocal(w.frame, (STAND.halfW + 0.45) * Math.cos(a), (STAND.halfD + 0.4) * Math.sin(a)), r: 0.45 };
});

/** Everything of a way on the ground (its stand, lead clumps, field, places, trees). */
const wayThings = (id: WayId): { name: string; x: number; z: number; r: number }[] => {
  const w = WAYS[id];
  return [
    ...Object.entries(placesFor(id)).filter(([k]) => k !== 'marker').map(([name, p]) => ({ name: `${id}.${name}`, x: p.x, z: p.z, r: 0.5 })),
    ...fieldSpotsOf(w.field).map((s) => ({ name: `${id}.field-${s.id}`, x: s.x, z: s.z, r: 0.5 })),
    ...w.leadClumps.map((h, i) => ({ name: `${id}.clump-${i}`, x: h.x, z: h.z, r: 0.5 })),
    ...rimOf(w),
    { name: `${id}.fieldSide`, x: w.fieldSide.x, z: w.fieldSide.z, r: 0.4 },
    { name: `${id}.nest`, x: w.nest.x, z: w.nest.z, r: 0.4 },
    ...w.walkSpots.map((s, i) => ({ name: `${id}.walk-${i}`, x: s.x, z: s.z, r: 0.3 })),
    ...w.trees.map((t, i) => ({ name: `${id}.tree-${i}`, x: t.x, z: t.z, r: 0.6 })),
  ];
};
/** The fixed home: the wallow, its clumps, the clue. */
const fixedThings = (): { name: string; x: number; z: number; r: number }[] => [
  { name: 'wallow', x: WALLOW_FRAME.x, z: WALLOW_FRAME.z, r: Math.max(WALLOW.halfW, WALLOW.halfD) + 0.4 },
  ...fieldSpots().map((s) => ({ name: `field-${s.id}`, x: s.x, z: s.z, r: 0.5 })),
  ...wallowClumps().map((h, i) => ({ name: `wallow-clump-${i}`, x: h.x, z: h.z, r: 0.5 })),
  ...cluePosts().map((p, i) => ({ name: `clue-post-${i}`, ...p, r: 0.3 })),
  ...bootPrints().map((p, i) => ({ name: `clue-print-${i}`, x: p.x, z: p.z, r: 0.2 })),
];
const everything = (): { name: string; x: number; z: number; r: number }[] => [...fixedThings(), ...WAY_IDS.flatMap(wayThings)];

/** The length of a polyline. */
const lengthOf = (pts: readonly { x: number; z: number }[]): number => pts.slice(1).reduce((s, p, i) => s + dist(pts[i], p), 0);
/** Distance from a spot to a polyline. */
const polyDist = (p: { x: number; z: number }, pts: readonly { x: number; z: number }[]): number =>
  Math.min(...pts.slice(1).map((q, i) => segDist(p, pts[i], q)));
const wrap = (a: number): number => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

test('the marker is where the world puts it (the heide anchor)', () => {
  const a = anchorInBiome('heide', 22);
  assert.ok(Math.abs(a.x - MARKER.x) < 1e-6 && Math.abs(a.z - MARKER.z) < 1e-6, `anchor (${a.x}, ${a.z})`);
  assert.equal(AREA_VELUWE.missies[0].id, 'frisling');
});

/** The north stands and the first clumps of their way home lie in the meadow north of the
 *  west trail: the compass sector the world calls 'ven', grassland here, 50+ m from the
 *  middle of its water (the water reaches 20 m out: 30 m of dry meadow between). */
const inMeadow = (p: { x: number; z: number }): boolean => biomeAt(p.x, p.z) === 'ven' && p.z > -6 && Math.hypot(p.x - VEN_CENTER.x, p.z - VEN_CENTER.z) > 50;

test('every place of every way is dry heath (or the dry meadow across the trail) inside the world', () => {
  for (const p of everything()) {
    assert.ok(biomeAt(p.x, p.z) === 'heide' || inMeadow(p), `${p.name} is on the heath or the dry meadow (${biomeAt(p.x, p.z)})`);
    // (a stand's young birch is a forest tree at the forest's edge: the forest reaches 70 m;
    // steen's bracken stands at the heath's south-west rim, where the heath runs on to the
    // forest at ~70 m and the world's bound is 75 m: its far rim may reach 61 m)
    const out = /tree/.test(p.name) ? 64 : /^steen\.(stand-rim|nest)/.test(p.name) ? 61 : 60;
    assert.ok(Math.hypot(p.x, p.z) < out, `${p.name} is well inside the world (${Math.hypot(p.x, p.z).toFixed(1)} m out)`);
    assert.ok(Math.hypot(p.x - VEN_CENTER.x, p.z - VEN_CENTER.z) > 25, `${p.name} is far from the ven`);
  }
});

test('three ways, each its own: a stand of the same size in another part of the world', () => {
  assert.deepEqual([...WAY_IDS], ['wei', 'steen', 'berk']);
  for (let i = 0; i < WAY_IDS.length; i++) {
    for (let j = i + 1; j < WAY_IDS.length; j++) {
      const a = WAYS[WAY_IDS[i]], b = WAYS[WAY_IDS[j]];
      assert.ok(dist(a.stand, b.stand) > 20, `the ${a.id} and ${b.id} stands lie apart (${dist(a.stand, b.stand).toFixed(1)} m)`);
    }
  }
  // the squeak comes from three different directions from the ring
  const dirs = WAY_IDS.map((id) => headingTo(MARKER, WAYS[id].stand));
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
    assert.ok(Math.abs(wrap(dirs[i] - dirs[j])) > (30 * Math.PI) / 180, `ways ${WAY_IDS[i]} and ${WAY_IDS[j]} lead off ≥ 30° apart`);
  }
  // the home keeps every stand drawn while he is near it
  for (const id of WAY_IDS) assert.ok(FRISLING_HOME.spread?.some((s) => dist(s, WAYS[id].stand) < 1), `the home reaches out to the ${id} stand`);
});

test('the story reads from the marker: the family 10-14 m on', () => {
  const w = dist(MARKER, P.wallow);
  assert.ok(w >= 10 && w <= 14, `the wallow is ${w.toFixed(1)} m from the marker`);
  const walkIn = headingTo({ x: 0, z: 0 }, MARKER);
  const off = Math.abs(wrap(headingTo(MARKER, P.wallow) - walkIn)) * 180 / Math.PI;
  assert.ok(off < 35, `the wallow is ${off.toFixed(0)}° off the way in: in view`);
});

for (const id of WAY_IDS) {
  const w = WAYS[id];
  test(`${id}: a real follow (25-42 m from the ring; steen's round the field and the family 46) round the family, the prints to the stand's edge`, () => {
    const follow = w.follow;
    assert.ok(dist(follow[0], MARKER) < 1.2, 'the prints start at the ring');
    assert.ok(dist(follow[follow.length - 1], w.stand) < STAND.halfD + 1.5, 'and end at the stand\'s edge');
    const len = lengthOf([MARKER, ...follow.slice(1, -1), w.coverApproach]);
    // (steen: the long follow past the family, design §5.2 — round the north field and the
    // family's west side, the roe's mornings south of the wallow left to the roe)
    assert.ok(len >= 25 && len <= (id === 'steen' ? 46 : 42), `the follow is ${len.toFixed(1)} m`);
    // never at the piglet: the trail ends ≥ 1.2 m from every nook
    for (let n = 0; n < w.nooks.length; n++) assert.ok(dist(follow[follow.length - 1], nookAt(id, n, 0)) > 1.2, `the trail ends off nook ${n}`);
    // it passes the family at a calm distance, the ree's ring and the solids round
    const path = [MARKER, ...follow.slice(1, -1), w.coverApproach];
    assert.ok(polyDist(P.wallow, path) >= 6.5, `the follow keeps 6.5 m from the wallow (${polyDist(P.wallow, path).toFixed(1)})`);
    // (≥ 3 m: the big stone stands 5.1 m from the ree's ring, and the way south passes between them)
    assert.ok(polyDist(OTHER_MARKERS['ree-niet-aanraken'], path) >= 3, `and 3 m from the ree's ring (${polyDist(OTHER_MARKERS['ree-niet-aanraken'], path).toFixed(1)})`);
    for (const q of PROPS) {
      const keep = q.name === 'poacher' ? 4.5 : q.r + 0.8;
      assert.ok(polyDist(q, path) > keep, `the follow passes the ${q.name} at ${polyDist(q, path).toFixed(1)} m`);
    }
    for (const c of cluePosts()) assert.ok(polyDist(c, path) > 1.5, 'the follow keeps off the fence line');
    // the prints pass the herstel's marker (the winterronde), never through its ring
    assert.ok(polyDist(OTHER_MARKERS.herstel, path) >= 3, `and 3 m from the herstel's ring (${polyDist(OTHER_MARKERS.herstel, path).toFixed(1)})`);
    // they never run over a rooting field's turned earth, nor through the wallow's bracken
    for (const s of [...fieldSpotsOf('N'), ...fieldSpotsOf('S')]) assert.ok(polyDist(s, path) > 1.2, `the prints keep off the rooted patch at (${s.x.toFixed(1)}, ${s.z.toFixed(1)}) (${polyDist(s, path).toFixed(2)} m)`);
    for (const c of wallowClumps()) assert.ok(polyDist(c, path) > 1.2, `the prints keep off the wallow's bracken (${polyDist(c, path).toFixed(2)} m)`);
    // and off the roe's ground: her pools (water and rushes), her trodden paths, her stands
    for (const c of reeClearings()) assert.ok(polyDist(c, path) > c.r + 1, `the prints keep off the roe's ground (${(polyDist(c, path) - c.r).toFixed(2)} m)`);
  });

  test(`${id}: following the prints never comes near the sow — in every family layout, from anywhere by the ring`, () => {
    // (review r1: on steen the sow at her log stood 5.6 m from the way, against a 5 m
    // notice, and a child doing what the game asked was told 'Niet zo dichtbij')
    const via = w.follow.slice(1, -1);
    for (const l of FAMILY_LAYOUTS) {
      const sow = l.poses.sow;
      const keep = SOW_NOTICE_M + 1.5 + (sow.roam ?? 0);
      assert.ok(polyDist(sow, [MARKER, ...via, w.coverApproach]) >= keep, `${l.id}: the way passes the sow at ${polyDist(sow, [MARKER, ...via, w.coverApproach]).toFixed(2)} m (want ≥ ${keep.toFixed(2)})`);
      // he sets out from wherever he stood at the ring (its prompt reaches 2.4 m)
      for (let a = 0; a < 16; a++) {
        const from = { x: MARKER.x + 2.4 * Math.cos((a * Math.PI) / 8), z: MARKER.z + 2.4 * Math.sin((a * Math.PI) / 8) };
        assert.ok(polyDist(sow, [from, ...via]) >= keep, `${l.id}: from the ring at ${a * 22.5}° the way passes the sow at ${polyDist(sow, [from, ...via]).toFixed(2)} m`);
      }
    }
  });

  test(`${id}: a real lead home with the family ahead, clumps beside it to dive into`, () => {
    const a = w.coverApproach, f = w.fieldApproach;
    const lead = dist(a, f);
    const want = id === 'steen' ? 10 : 28;
    assert.ok(lead - 1 >= want - 0.5, `the lead home is ${lead.toFixed(1)} m (want ≥ ${want})`);
    // walking it, the family at the wallow is ahead (within ±35° of the way) all along
    const h = headingTo(a, f);
    for (let t = 0; t <= 1.001; t += 0.1) {
      const at = { x: a.x + (f.x - a.x) * t, z: a.z + (f.z - a.z) * t };
      const d = wrap(headingTo(at, P.wallow) - h);
      assert.ok(Math.abs(d) < (35 * Math.PI) / 180, `at ${(t * 100).toFixed(0)}% of the way home the family is ${(d * 180 / Math.PI).toFixed(0)}° off ahead`);
    }
    // ≥ 3 clumps BESIDE the way (never on it: a child walks it straight), on both sides
    assert.ok(w.leadClumps.length >= 3);
    let left = 0, right = 0;
    for (const c of w.leadClumps) {
      const off = segDist(c, a, f);
      assert.ok(off > 1.6 && off < 3, `a clump ${off.toFixed(1)} m beside the way`);
      if (toLocal({ ...a, heading: h }, c).u > 0) right += 1; else left += 1;
    }
    assert.ok(left >= 1 && right >= 1 && left + right >= 3, `clumps left ${left}, right ${right}`);
    // the lead passes no solid
    for (const q of PROPS) assert.ok(segDist(q, a, f) > q.r + 1, `the lead passes the ${q.name} at ${segDist(q, a, f).toFixed(1)} m`);
    // on to the wallow: no further than a short walk, round what is to be walked round
    const toW = [f, ...w.toWallow, w.wallowTalk];
    assert.ok(lengthOf(toW) < 22, `the field to the wallow is ${lengthOf(toW).toFixed(1)} m`);
    for (const c of cluePosts()) assert.ok(polyDist(c, toW) > 1.5, 'the way to the wallow keeps off the fence line');
    assert.ok(polyDist(P.wallow, toW) > Math.max(WALLOW.halfW, WALLOW.halfD) + 0.8 || dist(w.wallowTalk, P.wallow) < 5.5, 'it never crosses the mud');
  });

  test(`${id}: the stand, the field and the wallow keep clear of the paths, the props, the trees, the roamers, the other homes`, () => {
    const mine = wayThings(id);
    for (const p of mine) {
      for (const [mid, m] of Object.entries(OTHER_MARKERS)) {
        // (the herstel marker's ground is its future home: the new ground keeps 12 m; the
        // wallow, the north field and the spots by them were there before and keep 8)
        // (steen's spots by the wallow's east side, where he stands and walks on: 7 m from the
        // ree's ring — the wallow itself lies 11 m from it, its south a fence, its west the herstel)
        if (mid === 'ree-niet-aanraken' && /^steen\.(wallowTalk|wallowGive)$/.test(p.name)) { assert.ok(dist(p, m) >= 7, `${p.name} keeps 7 m from the ree's ring`); continue; }
        const keep = mid === 'herstel' && !/\.(wallow|wallowTalk|wallowGive|home|field|fieldApproach|fieldSide)$|\.field-/.test(p.name.replace(/^steen\.(field|fieldApproach|fieldSide)$|^steen\.field-.*$/, 'S')) ? 12 : 8;
        assert.ok(dist(p, m) >= keep + p.r - 0.5, `${p.name} keeps ${keep} m from the ${mid} marker (${dist(p, m).toFixed(1)})`);
      }
      for (const q of PROPS) assert.ok(dist(p, q) > q.r + p.r + 0.3, `${p.name} is not on the ${q.name} (${dist(p, q).toFixed(1)})`);
      for (const q of TREES) assert.ok(dist(p, q) > p.r + 2, `${p.name} is not at a tree at (${q.x}, ${q.z})`);
      for (const a of ROAMERS) assert.ok(dist(p, a) > a.r + p.r + 2, `${p.name} is off the ${a.id}'s wander loop`);
      for (const pad of PADS) assert.ok(dist(p, pad) > PAD_RADIUS + 6, `${p.name} keeps off helipad (${pad.x}, ${pad.z})`);
      for (const [rn, rp] of Object.entries(REE_PLACES)) {
        const keep = rn === 'marker' && /^steen\.(wallowTalk|wallowGive)$/.test(p.name) ? 7 : 8; // (as above)
        assert.ok(dist(p, rp) >= keep, `${p.name} keeps ${keep} m from the ree's ${rn} (${dist(p, rp).toFixed(1)})`);
      }
      for (const c of reeClearings()) {
        const keep = /^steen\.(wallowTalk|wallowGive)$/.test(p.name) ? 7 : 8; // (as above)
        assert.ok(dist(p, c) >= c.r + keep - 0.7, `${p.name} keeps ${keep} m from the ree's ground (${(dist(p, c) - c.r).toFixed(1)})`);
      }
      if (!/wallowTalk|wallowGive|wallow$|field-|fieldSide|fieldApproach/.test(p.name)) {
        for (const q of cluePosts()) assert.ok(dist(p, q) > 1.5 + p.r, `${p.name} keeps off the fence`);
      }
      for (const q of cluePosts()) assert.ok(dist(p, q) > 1.5, `${p.name} is not on the fence`);
      for (const q of bootPrints()) assert.ok(dist(p, q) > 1.2, `${p.name} is not on the boot prints`);
    }
    // the stand, the field and the clumps keep off the sand paths
    for (const p of mine.filter((q) => /stand|field-|clump|nest|tree/.test(q.name))) {
      assert.ok(distanceToNetwork(p.x, p.z) > LANE_HALF + p.r - 0.3, `${p.name} keeps off the paths (${distanceToNetwork(p.x, p.z).toFixed(1)} m)`);
    }
    // the marker ring (r 1.15) stays open: nothing of the home within 2 m of it
    for (const p of mine) assert.ok(dist(p, MARKER) > 2 + p.r, `${p.name} keeps off the marker ring`);
    // the other ways' stands keep their own ground
    for (const o of WAY_IDS.filter((x) => x !== id)) {
      for (const p of rimOf(w)) assert.ok(dist(p, WAYS[o].stand) > 6, `${p.name} keeps off the ${o} stand`);
    }
  });

  test(`${id}: the route's field — seven patches in one view, the other field never in it`, () => {
    const s = fieldSpotsOf(w.field);
    const other = fieldSpotsOf(w.field === 'N' ? 'S' : 'N');
    const lens = atLocal({ x: w.fieldApproach.x, z: w.fieldApproach.z, heading: w.fieldApproach.heading! }, 0, -3);
    for (const p of s) {
      const l = toLocal({ x: lens.x, z: lens.z, heading: w.fieldApproach.heading! }, p);
      assert.ok(l.v > 2 && Math.abs(Math.atan2(l.u, l.v)) < (35 * Math.PI) / 180, `spot ${p.id} is ahead in the view`);
      assert.ok(dist(p, w.fieldApproach) > 1.2, `he stands off patch ${p.id} (${dist(p, w.fieldApproach).toFixed(2)} m)`);
      assert.ok(dist(p, w.fieldSide) > 0.9, `the piglet stands off patch ${p.id}`);
    }
    // the view (its framed picture): the other field's patches are not in it
    const fit = lensOf(w.fieldView);
    for (const p of other) {
      const sc = screenOf({ x: p.x, y: heightAt(p.x, p.z), z: p.z }, fit.cam, fit.look, FOV, W, H);
      assert.ok(!sc.ahead || sc.x < -40 || sc.x > W + 40 || sc.y < -40 || sc.y > H + 40, `the other field's patch ${p.id} is out of the ${id} route's picture (${sc.x.toFixed(0)}, ${sc.y.toFixed(0)})`);
    }
    // and its own seven are in it
    for (const p of s) {
      const sc = screenOf({ x: p.x, y: heightAt(p.x, p.z), z: p.z }, fit.cam, fit.look, FOV, W, H);
      assert.ok(sc.ahead && sc.x > 0 && sc.x < W && sc.y > 100 && sc.y < H - 56, `patch ${p.id} is in the ${id} route's picture (${sc.x.toFixed(0)}, ${sc.y.toFixed(0)})`);
    }
  });
}

test('the rooting fields: seven look-alike spots in the PRINT_SPOTS layout, uniformly scaled; the two views of the north field differ', () => {
  for (const f of ['N', 'S'] as const) {
    const s = fieldSpotsOf(f);
    assert.equal(s.length, PRINT_SPOTS.length);
    const d2 = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);
    const k = dist(s[0], s[1]) / d2(PRINT_SPOTS[0], PRINT_SPOTS[1]);
    for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) {
      assert.ok(Math.abs(dist(s[i], s[j]) / d2(PRINT_SPOTS[i], PRINT_SPOTS[j]) - k) < 1e-9, 'one scale for the whole layout');
      assert.ok(dist(s[i], s[j]) > 1.4, `spots ${i} and ${j} stand apart (${dist(s[i], s[j]).toFixed(2)} m)`);
    }
  }
  assert.equal(fieldSpots().length, 7);
  const nViews = WAY_IDS.filter((id) => WAYS[id].field === 'N').map((id) => WAYS[id].fieldApproach.heading!);
  assert.equal(nViews.length, 2);
  const apart = Math.abs(wrap(nViews[0] - nViews[1])) * 180 / Math.PI;
  assert.ok(apart >= 45, `the two views of the north field are ${apart.toFixed(0)}° apart`);
  assert.equal(frislingClearings().length, 1 + 14 + 2 * WAY_IDS.length);
  void FIELD_FRAME;
});

test('the family\'s layouts at the wallow: at home, off the log, off the fence', () => {
  const log = wallowLog();
  for (const lay of FAMILY_LAYOUTS) {
    for (const [key, p] of Object.entries(lay.poses)) {
      assert.ok(dist(p, P.wallow) < 2.4, `${lay.id}: ${key} lives at the wallow (${dist(p, P.wallow).toFixed(2)} m)`);
      const gap = obstacleGap(log, p.x, p.z) + log.box!.pad - (p.roam ?? 0);
      if (!(lay.id === 'boom' && key === 'sow')) assert.ok(gap >= 0.5, `${lay.id}: ${key} roots ${gap.toFixed(2)} m from the log`);
      else assert.ok(gap > 0.1 && gap < 0.6, `boom: the sow is at the log, never in it (${gap.toFixed(2)} m)`);
      for (const q of cluePosts()) assert.ok(dist(p, q) > 2, `${lay.id}: ${key} keeps off the fence`);
    }
  }
  // the residents' own poses (run 6's family, the yearling off the log) too
  for (const r of FRISLING_RESIDENTS.filter((x) => x.key !== 'lost')) {
    const gap = obstacleGap(log, r.before!.x, r.before!.z) + log.box!.pad - (r.before!.roam ?? 0);
    assert.ok(gap >= 0.5, `${r.key} roots ${gap.toFixed(2)} m from the log`);
  }
});

test('the way back: from where he stands at the wallow a free lane to the marker', () => {
  const log = wallowLog();
  for (const id of WAY_IDS) {
    const w = WAYS[id];
    for (const from of [w.wallowTalk, w.wallowGive]) {
      for (const lay of FAMILY_LAYOUTS) {
        for (const p of Object.values(lay.poses)) assert.ok(segDist(p, from, MARKER) > 1.0 + (p.roam ?? 0), `${id}: the way back passes the family (${lay.id}) at ${segDist(p, from, MARKER).toFixed(1)} m`);
      }
      for (const c of [...wallowClumps(), ...WAYS.wei.leadClumps, ...WAYS.berk.leadClumps]) assert.ok(segDist(c, from, MARKER) > 1.0 + 0.5, `${id}: the way back passes a clump at ${segDist(c, from, MARKER).toFixed(1)} m`);
      // the log: sampled along the lane
      for (let t = 0; t <= 1; t += 0.02) {
        const p = { x: from.x + (MARKER.x - from.x) * t, z: from.z + (MARKER.z - from.z) * t };
        assert.ok(obstacleGap(log, p.x, p.z) > 0.75, `${id}: the way back passes the log`);
      }
      for (const q of fieldSpots()) void q; // (turned earth: walked over freely)
      assert.ok(dist(from, MARKER) < 16, `${id}: the marker is a short walk back (${dist(from, MARKER).toFixed(1)} m)`);
    }
  }
});

/* -------------------------------------------- the nooks, as the lens sees them ---- */

/** The lens a framed view takes on a 1280×800 screen (the World's frameLens: a Stage fit). */
function lensOf(v: WayView): { cam: THREE.Vector3; look: THREE.Vector3 } {
  const f = { x: Math.sin(v.heading), z: Math.cos(v.heading) };
  const fit = fitFrame(v.at, f, { ...v }, heightAt, FOV, W, H);
  return { cam: fit.cam, look: fit.look };
}
const project = (p: { x: number; z: number }, y: number, lens: { cam: THREE.Vector3; look: THREE.Vector3 }): { x: number; y: number; ahead: boolean } =>
  screenOf({ x: p.x, y: heightAt(p.x, p.z) + y, z: p.z }, lens.cam, lens.look, FOV, W, H);

const LYING_H = lyingHeight(SIZE.frisling.h, LEG_SHARE.frisling);
/** Every glimpse the knobs may ask for (every band, and the contracts' default). */
const GLIMPSES = [...new Set([1, 2, 3, 4, 5, 6].map((b) => knobsFor('zoeken', b).glimpse).concat([0.38, 0.32, 0.27, 0.23, 0.2, 0.16]))];

for (const id of WAY_IDS) {
  const w = WAYS[id];
  test(`${id}: ≥ 5 nooks, never in the middle of the search picture, inside it, the same size`, () => {
    assert.ok(w.nooks.length >= 5, `${w.nooks.length} nooks`);
    const lens = lensOf(w.searchView);
    for (let n = 0; n < w.nooks.length; n++) {
      const nk = w.nooks[n];
      // inside the stand, behind ≥ 2 rows of clumps from its near edge (≈ 0.9 m in)
      assert.ok(Math.abs(nk.u) <= STAND.halfW - 0.4 && nk.v <= STAND.halfD - 0.3 && nk.v >= -STAND.halfD + 0.9, `nook ${n} (${nk.u}, ${nk.v}) lies inside the stand`);
      for (let m = n + 1; m < w.nooks.length; m++) assert.ok(dist(nookAt(id, n, 0), nookAt(id, m, 0)) > 0.75, `nooks ${n} and ${m} lie apart`);
      const at = nookAt(id, n, 0);
      assert.ok(offCentre(w.searchView, at) >= 0.25, `nook ${n} is off the middle of the framed view (${offCentre(w.searchView, at).toFixed(2)})`);
      for (const pose of [0, 1, 2] as const) {
        const p = nookAt(id, n, pose);
        const c = project(p, LYING_H * 0.8, lens);
        assert.ok(c.ahead, `${id} nook ${n} pose ${pose} is in front of the lens`);
        assert.ok(c.x > W * 0.12 && c.x < W * 0.88 && c.y > H * 0.12 && c.y < H * 0.88 && c.y > 130, `${id} nook ${n} pose ${pose} lies well inside the picture (${c.x.toFixed(0)}, ${c.y.toFixed(0)})`);
        const fromMid = Math.hypot(c.x - W / 2, c.y - H / 2);
        assert.ok(fromMid >= 120, `${id} nook ${n} lies ${fromMid.toFixed(0)} px from the screen's middle (want ≥ 120)`);
        // his length on screen: as readable in every nook and every pose
        const half = SIZE.frisling.len * 0.42;
        const head = project({ x: p.x + Math.sin(p.yaw) * half, z: p.z + Math.cos(p.yaw) * half }, LYING_H * 0.8, lens);
        const tail = project({ x: p.x - Math.sin(p.yaw) * half, z: p.z - Math.cos(p.yaw) * half }, LYING_H * 0.8, lens);
        const len = Math.hypot(head.x - tail.x, head.y - tail.y);
        assert.ok(len >= 30 && len <= 90, `${id} nook ${n} pose ${pose}: he is ${len.toFixed(0)} px long on screen`);
      }
    }
  });

  test(`${id}: every nook shows the glimpse the knobs ask for (the same window, never more)`, () => {
    const clumps = standCover(id);
    const lens = lensOf(w.searchView);
    const eye = { x: lens.cam.x, y: lens.cam.y, z: lens.cam.z };
    for (let n = 0; n < w.nooks.length; n++) {
      for (const pose of [0, 1, 2] as const) {
        const p = nookAt(id, n, pose);
        const back = backPoints(p.x, heightAt(p.x, p.z), p.z, p.yaw, SIZE.frisling.len, LYING_H);
        const closed = visibleShare(back, eye, growStems(clumps, standSeed(id), heightAt).stems);
        assert.ok(closed < 0.25, `${id} nook ${n} pose ${pose}: before the window he is (nearly) hidden (${closed.toFixed(2)})`);
        for (const g of GLIMPSES) {
          const stems = growStems(clumps, standSeed(id), heightAt).stems;
          const changed = openWindow(stems, eye, back, g, g * 1.5);
          const share = visibleShare(back, eye, stems);
          assert.ok(share >= g * 0.6 && share <= g * 1.6, `${id} nook ${n} pose ${pose}: glimpse ${g} shows ${share.toFixed(2)} of his back`);
          assert.ok(changed.length <= 20, `${id} nook ${n}: a few plants made smaller (${changed.length})`);
        }
      }
    }
  });

  test(`${id}: ≥ 8 look-alike spots, none on a nook, inside the picture; the dead bracken on each`, () => {
    assert.ok(w.decoySpots.length >= 8, `${w.decoySpots.length} spots`);
    assert.ok(w.decoySpots.filter((d) => d.edge).length >= 2, 'edge spots for the nightjar');
    const lens = lensOf(w.searchView);
    for (let i = 0; i < w.decoySpots.length; i++) {
      const d = w.decoySpots[i];
      assert.ok(Math.abs(d.u) <= STAND.halfW && Math.abs(d.v) <= STAND.halfD, `spot ${i} is in the stand`);
      const p = decoyAt(id, i);
      for (let n = 0; n < w.nooks.length; n++) assert.ok(dist(p, nookAt(id, n, 0)) > 0.45, `spot ${i} is off nook ${n} (${dist(p, nookAt(id, n, 0)).toFixed(2)})`);
      for (let j = i + 1; j < w.decoySpots.length; j++) assert.ok(dist(p, decoyAt(id, j)) > 0.5, `spots ${i} and ${j} lie apart`);
      const c = project(p, 0.3, lens);
      assert.ok(c.ahead && c.x > W * 0.06 && c.x < W * 0.94 && c.y > 110 && c.y < H - 30, `${id} spot ${i} is in the picture (${c.x.toFixed(0)}, ${c.y.toFixed(0)})`);
    }
    const cover = standCover(id);
    for (let i = 0; i < w.decoySpots.length; i++) assert.equal(cover.filter((c) => c.decoy === spotTag(i)).length, 1, `one dead clump on spot ${i}`);
    // no plain clump stands on a nook (he lies in his bed, never in a tussock)
    for (let n = 0; n < w.nooks.length; n++) {
      const p = nookAt(id, n, 0);
      for (const c of cover) assert.ok(dist(c, p) > 0.3, `${id} nook ${n} is free of clump (${c.x.toFixed(1)}, ${c.z.toFixed(1)})`);
    }
  });

  test(`${id}: the framed views look at their place from the ranger's side, with him in the picture`, () => {
    for (const [name, v, stand] of [['search', w.searchView, w.coverApproach], ['field', w.fieldView, w.fieldApproach], ['wallow', w.wallowView, w.wallowTalk]] as const) {
      assert.ok(v.include.some((q) => dist(q, stand) < 1e-9), `${name}: the ranger's spot is in the picture`);
      const l = toLocal({ x: v.at.x, z: v.at.z, heading: v.heading }, stand);
      assert.ok(l.v < -1, `${name}: he stands in front of what the view looks at`);
      const lens = lensOf(v as WayView);
      const c = project(stand, RANGER_STAND_HEIGHT * 0.5, lens);
      assert.ok(c.ahead && c.x > 0 && c.x < W && c.y > 0 && c.y < H, `${name}: he is in the picture (${c.x.toFixed(0)}, ${c.y.toFixed(0)})`);
      // a helipad's big H never sits in the picture of a search or a route
      if (name !== 'wallow') {
        for (const pad of PADS) for (let i = 0; i < 8; i++) {
          const q = project({ x: pad.x + PAD_RADIUS * Math.cos((i * Math.PI) / 4), z: pad.z + PAD_RADIUS * Math.sin((i * Math.PI) / 4) }, 0, lens);
          assert.ok(!q.ahead || q.x < 0 || q.x > W || q.y < 0 || q.y > H, `${name}: the helipad at (${pad.x}, ${pad.z}) is out of the picture (${q.x.toFixed(0)}, ${q.y.toFixed(0)})`);
        }
      }
    }
  });
}

test('the places table: the fixed places with this play\'s way laid in', () => {
  for (const id of WAY_IDS) {
    useWay(id);
    assert.ok(dist(P.cover, WAYS[id].stand) < 1e-9, `${id}: the cover is the ${id} stand`);
    assert.ok(dist(P.coverApproach, WAYS[id].coverApproach) < 1e-9);
    assert.ok(dist(P.fieldApproach, WAYS[id].fieldApproach) < 1e-9);
    assert.ok(dist(P.wallowTalk, WAYS[id].wallowTalk) < 1e-9);
    assert.ok(dist(P.home, P.wallow) < 1e-9, 'home is the wallow');
  }
  useWay('wei');
  assert.ok(FRISLING_HOME.places === P, 'the home reads the live table');
});

test('the lost piglet lies in a nook of the default stand; free roam keeps his squeak off the clearing', () => {
  const before = FRISLING_RESIDENTS.find((r) => r.key === 'lost')!.before!;
  assert.ok(dist(before, LOST_SPOT) < 1e-9 && before.idle === 'lie');
  assert.ok(dist(LOST_SPOT, nookAt('wei', 0, 0)) < 1e-9);
  const l = toLocal(STAND_FRAME, LOST_SPOT);
  assert.ok(Math.abs(l.u) <= STAND.halfW && Math.abs(l.v) <= STAND.halfD, 'inside the stand');
  const voice = FRISLING_RESIDENTS.find((r) => r.key === 'lost')!.voice!;
  assert.ok(dist(LOST_SPOT, { x: 0, z: 0 }) > voice.within + 3, 'the squeak is not heard at the clearing');
  assert.ok(hideClumps().length === LEAD_CLUMP_COUNT + wallowClumps().length);
  void SEARCH_VIEW; void FIELD_VIEW; void WALLOW_VIEW;
});

test('the family lives at the wallow; after, the lost one is by his mother', () => {
  for (const r of FRISLING_RESIDENTS) {
    assert.ok(r.after, `${r.key} is at the wallow after`);
    assert.ok(dist(r.after!, P.wallow) < 2.4, `${r.key} lives at the wallow`);
    if (r.key !== 'lost') assert.ok(r.before && dist(r.before, P.wallow) < 2.4, `${r.key} is there before too`);
  }
  const sow = FRISLING_RESIDENTS.find((r) => r.key === 'sow')!.after!;
  const lost = FRISLING_RESIDENTS.find((r) => r.key === 'lost')!.after!;
  assert.ok(dist(sow, lost) < 2, 'the piglet ends within 2 m of his mother');
});

test('the clue: a cut fence past the wallow, boot prints through its gap, clear of the family', () => {
  const posts = cluePosts();
  const gap = clueGap();
  assert.ok(dist(gap, P.wallow) > 4.5 && dist(gap, P.wallow) < 7, `the gap is ${dist(gap, P.wallow).toFixed(1)} m past the wallow`);
  assert.ok(toLocal(WALLOW_FRAME, CLUE_FRAME).v > 4, 'on the far side of the wallow from the north field');
  const prints = bootPrints();
  for (let i = 1; i < prints.length; i++) {
    const s = dist(prints[i], prints[i - 1]);
    assert.ok(s > 0.6 && s < 0.9, `a long stride (${s.toFixed(2)} m)`);
    assert.ok(dist(prints[i], P.wallow) < dist(prints[i - 1], P.wallow), 'they lead toward the wallow');
  }
  const cross = prints.map((p) => toLocal(CLUE_FRAME, p).v);
  assert.ok(cross[0] > 0 && cross[cross.length - 1] < 0, 'they cross the fence line');
  const gu = toLocal(CLUE_FRAME, gap).u;
  for (const p of prints) assert.ok(Math.abs(toLocal(CLUE_FRAME, p).u - gu) < 0.3, 'through the gap, not through the wire');
  for (const r of FRISLING_RESIDENTS) {
    for (const q of posts) assert.ok(dist(r.after!, q) > 2, `${r.key} keeps off the fence`);
  }
});

/** The roe's home as a lens would see it (her places, her stands, pools and paths, the
 *  junipers and trees of each morning's cover: the home next door, whose doe and calf
 *  rest there, ~30 draw calls in a picture), and any other marker close by. */
function neighbours(from: { x: number; z: number }): { name: string; x: number; z: number }[] {
  const out: { name: string; x: number; z: number }[] = [];
  for (const [k, q] of Object.entries(REE_PLACES)) out.push({ name: `ree.${k}`, x: q.x, z: q.z });
  for (const c of reeClearings()) out.push({ name: 'ree.ground', x: c.x, z: c.z });
  for (const l of REE_LAYOUTS) for (const j of l.cover.junipers) out.push({ name: `ree.${l.id}.juniper`, x: j.x, z: j.z });
  for (const t of COPSE_TREES) out.push({ name: 'ree.copse-tree', x: t.x, z: t.z });
  for (const [k, q] of Object.entries(OTHER_MARKERS)) if (dist(q, from) < 12) out.push({ name: `marker ${k}`, ...q });
  return out;
}

for (const id of WAY_IDS) {
  const w = WAYS[id];
  test(`${id}: the close pictures at the stand (the piglet out beside him: voeren, dragen) show no neighbour's home`, () => {
    const r = w.coverApproach;
    const pig = outSpotOf(w, r);
    // (the piglet comes out beside him, away from the way home or to the way's own side)
    assert.ok(Math.abs(dist(pig, r) - 1.16) < 0.05, `the piglet stands beside him (${dist(pig, r).toFixed(2)} m)`);
    // (run 7 body: the piglet at his bag shows beside him, never behind his legs)
    const bag = lensOf(bagView(r, pig));
    const at = { x: r.x + (pig.x - r.x) * (BAG_REACH / dist(r, pig)), z: r.z + (pig.z - r.z) * (BAG_REACH / dist(r, pig)) };
    const pc = project(at, 0.15, bag), me = project(r, 0.5, bag);
    assert.ok(Math.abs(pc.x - me.x) > 110, `voeren: the piglet stands beside him in the picture (${Math.abs(pc.x - me.x).toFixed(0)} px apart)`);
    assert.ok(pc.x > 60 && pc.x < W - 60 && pc.y > 120 && pc.y < H - 60, 'voeren: the piglet is in the picture');
    for (const [name, v] of [['voeren', bagView(r, pig)], ['dragen', sideBySideView(r, pig, w.stand)]] as const) {
      const lens = lensOf(v);
      for (const q of neighbours(r)) {
        const c = project(q, 0.6, lens);
        const inPic = c.ahead && c.x > -40 && c.x < W + 40 && c.y > -40 && c.y < H + 40;
        assert.ok(!inPic, `${name}: ${q.name} at (${q.x.toFixed(1)}, ${q.z.toFixed(1)}), ${dist(q, r).toFixed(1)} m off, is out of the picture (${c.x.toFixed(0)}, ${c.y.toFixed(0)})`);
      }
    }
  });
}

/* ------------------------- the calm moments with the body (package body) ---- */

/** Where a child may stand when he arrives at the mud (the walk ends within 1.5 m of the
 *  talk spot), and where he stands once he walked on ('pad' before the sow's stare). */
const standsAtMud = (w: Way): { x: number; z: number }[] => [
  w.wallowTalk,
  ...Array.from({ length: 8 }, (_, i) => atLocal({ x: w.wallowTalk.x, z: w.wallowTalk.z, heading: (i * Math.PI) / 4 }, 0, 1.2)),
  w.wallowGive,
];

/** A framed view's lens as the kit takes it (an include's `r`: both his shoulders). */
function kitLens(v: Omit<WayView, 'include'> & { include: readonly { x: number; z: number; h: number; r?: number }[] }): { cam: THREE.Vector3; look: THREE.Vector3 } {
  const right = { x: -Math.cos(v.heading), z: Math.sin(v.heading) };
  const include = v.include.flatMap((q) => (q.r ? [-q.r, q.r].map((u) => ({ x: q.x + right.x * u, z: q.z + right.z * u, h: q.h })) : [q]));
  return lensOf({ ...v, include });
}

test('the sow\'s stare: she comes to the rim toward him, big enough to read (≥ 110 px), him whole at the side', () => {
  const log = wallowLog();
  for (const id of WAY_IDS) {
    for (const lay of FAMILY_LAYOUTS) {
      for (const me of standsAtMud(WAYS[id])) {
        const sow = zeugStare(lay.poses.sow, me);
        assert.ok(dist(sow, lay.poses.sow) <= ZEUG_STEP_M + 1e-9, 'a step or two, never a charge');
        assert.ok(dist(sow, me) >= ZEUG_STARE_M - 0.5 || dist(lay.poses.sow, me) < ZEUG_STARE_M, `${id}/${lay.id}: she stays ${dist(sow, me).toFixed(1)} m from him (a step clear of the log at most half a metre nearer)`);
        assert.ok(obstacleGap(log, sow.x, sow.z) + log.box!.pad >= 0.5, `${id}/${lay.id}: she stands off the log`);
        for (const q of cluePosts()) assert.ok(dist(sow, q) > 2, 'off the fence');
        for (const s of [-1, 1]) {
          const lens = kitLens(zeugView(me, sow, s));
          const top = project(sow, SIZE.wildzwijn.h, lens), bot = project(sow, 0, lens);
          assert.ok(bot.y - top.y >= 110, `${id}/${lay.id} from (${me.x.toFixed(1)}, ${me.z.toFixed(1)}) side ${s}: the sow is ${(bot.y - top.y).toFixed(0)} px tall (want ≥ 110)`);
          assert.ok(top.x > 0 && top.x < W && top.y > 0 && bot.y < H, 'she is in the picture');
          const head = project(me, RANGER_STAND_HEIGHT, lens), feet = project(me, 0, lens);
          assert.ok(head.y > 0 && feet.y < H && head.x > 40 && head.x < W - 40, `${id}/${lay.id}: he is whole in the picture (${head.x.toFixed(0)}, ${head.y.toFixed(0)}-${feet.y.toFixed(0)})`);
          assert.ok(Math.abs(head.x - top.x) > 300, 'they face each other across the picture, him at its side');
        }
      }
    }
  }
});

test('walking on when the path is free (pad): a way on from wherever he stands, past the family, off the log and the mud', () => {
  const log = wallowLog();
  for (const id of WAY_IDS) {
    const w = WAYS[id];
    for (const me of standsAtMud(w)) {
      const on = walkOnSpot(w, me);
      assert.ok(dist(me, on) >= WALK_ON_M + 0.3, `${id}: from (${me.x.toFixed(1)}, ${me.z.toFixed(1)}) there are ${dist(me, on).toFixed(1)} m to walk on`);
      assert.ok(dist(on, WALLOW_FRAME) > Math.max(WALLOW.halfW, WALLOW.halfD) + 0.5, `${id}: the spot is beside the mud, not in it`);
      assert.ok(obstacleGap(log, on.x, on.z) > 0.5, `${id}: off the log`);
      for (const lay of FAMILY_LAYOUTS) {
        for (const [key, p] of Object.entries(lay.poses)) {
          assert.ok(segDist(p, me, on) > 0.8 + (p.roam ?? 0), `${id}/${lay.id}: walking on passes ${key} at ${segDist(p, me, on).toFixed(2)} m`);
        }
      }
      for (const q of cluePosts()) assert.ok(dist(on, q) > 1.5, 'off the fence');
    }
  }
});

test('the yearling trots out to him at the field and back round the log (every leg ≥ 0.5 m from it), every way and layout', () => {
  const log = wallowLog();
  for (const id of WAY_IDS) {
    const w = WAYS[id];
    const at = [w.fieldApproach, ...Array.from({ length: 6 }, (_, i) => atLocal({ x: w.fieldApproach.x, z: w.fieldApproach.z, heading: (i * Math.PI) / 3 }, 0, 0.8))];
    for (const lay of FAMILY_LAYOUTS) {
      const home = lay.poses.yearling;
      for (const me of at) {
        const side = yearlingSideOf(me, home);
        assert.ok(dist(side, me) >= 1.2, 'never nearer him than 1.2 m');
        for (const [from, to] of [[home, side], [side, home]] as const) {
          const legs = [from, ...yearlingWay(w, from, to), to];
          for (let i = 1; i < legs.length; i++) {
            const g = legGap(log, legs[i - 1], legs[i]);
            assert.ok(g >= YEARLING_LOG_M, `${id}/${lay.id}: a leg of the yearling's way passes ${g.toFixed(2)} m from the log`);
          }
          for (const p of legs) for (const q of cluePosts()) assert.ok(dist(p, q) > 1, 'off the fence');
        }
      }
    }
  }
});
