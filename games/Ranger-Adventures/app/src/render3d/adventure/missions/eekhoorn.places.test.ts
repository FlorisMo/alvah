/**
 * eekhoorn.places.test.ts — where "De verstopte nootjes" happens is chosen by looking at
 * the world; this pins that it stays a good place (design run6-missions §3.4, §4.4): in
 * the wood, inside the world, clear of the paths and the other missions, the squirrel's
 * oak in view as the child walks up, a follow of 3-4 hops over 15-25 m where no tree of
 * the way hides the next wait, the glade's seven look-alike spots in one view, and the
 * four callers at distinct places, none behind a trunk or under the oak's leaves.
 * Run: `npm test`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EEKHOORN_PLACES as P, EEKHOORN_RESIDENTS, HOME_TREES, TREE, MARKER, STUMP, HEAP, HEAP_SPOTS, SNAG, WOODPECKER, SEEDLING_SPOT, JAY_GROUND,
  GLADE_VIEW, CALLERS_VIEW, SPOT_SCALE, SPOT_SIZE, gladeSpots, eekhoornTreeClear, eekhoornClearings,
} from './eekhoorn.places.ts';
import { biomeAt, VEN_CENTER, VEN_SHORE_R } from '../../Biomes.ts';
import { distanceToNetwork, LANE_HALF } from '../../Paths.ts';
import { dist, headingTo, toLocal, segDist } from '../places.ts';
import { PRINT_SPOTS } from '../../../engines/corsi.ts';
import { barkRadius, type Trunk } from '../squirrel-math.ts';

/** The other missions' markers as the world places them (`__ranger.markers()`, 2026-09-29). */
const OTHER_MARKERS = {
  nachtronde: { x: 20.8, z: -34.2 }, vos: { x: 35.8, z: -45.6 }, ecoduct: { x: 19.1, z: -24.4 },
  ven: { x: 24.5, z: -19.0 }, wildcamera: { x: 15.56, z: -15.56 },
};
/** The watchtower (world/Dressing LANDMARKS): its footprint ≈ 3 m round its middle. */
const TOWER = { x: 37, z: -37, r: 3.2 };

const trunk = (t: typeof HOME_TREES[number]): Trunk => ({ x: t.x, z: t.z, H: t.h, species: t.species });

const everything = (): { name: string; x: number; z: number }[] => [
  ...Object.entries(P).map(([name, p]) => ({ name, x: p.x, z: p.z })),
  ...HOME_TREES.map((t, i) => ({ name: `tree-${i}`, x: t.x, z: t.z })),
  ...gladeSpots().map((s) => ({ name: `spot-${s.id}`, x: s.x, z: s.z })),
  { name: 'stump', x: STUMP.x, z: STUMP.z }, { name: 'snag', x: SNAG.x, z: SNAG.z },
  ...HEAP_SPOTS.map((h, i) => ({ name: `heap-${i}`, ...h })),
];

test('the marker stays where the world puts it; the squirrel\'s tree is in view as the child walks up', () => {
  assert.ok(Math.abs(MARKER.x - 25.419) < 0.01 && Math.abs(MARKER.z + 41.891) < 0.01);
  const d = dist(MARKER, TREE.oak);
  assert.ok(d > 2.2 && d < 4, `its tree stands by the ring (${d.toFixed(1)} m)`);
  // a pine: its crown starts high above the lens (an oak's low leaf dome would fade to a ghost)
  assert.equal(TREE.oak.species, 'prop-pine-scots');
  // walking in from the clearing, the oak lies ahead (within 45° of the way in)
  const walkIn = headingTo({ x: 0, z: 0 }, MARKER);
  const off = Math.abs(Math.atan2(Math.sin(headingTo(MARKER, TREE.oak) - walkIn), Math.cos(headingTo(MARKER, TREE.oak) - walkIn)));
  assert.ok(off < Math.PI / 4, `its tree is ${(off * 180 / Math.PI).toFixed(0)}° off the way in: in view`);
  // its branch stub points toward the ring's side (the squirrel sits facing the child)
  const b = TREE.oak.branch!;
  const toRing = headingTo(TREE.oak, MARKER);
  assert.ok(Math.abs(Math.atan2(Math.sin(b.ang - toRing), Math.cos(b.ang - toRing))) < 1.2);
});

test('every place is in the wood, inside the world, dry', () => {
  for (const p of everything()) {
    assert.equal(biomeAt(p.x, p.z), 'bos', `${p.name} is in the wood`);
    assert.ok(Math.hypot(p.x, p.z) < 70, `${p.name} is well inside the world (the rim is at 75 m)`);
    assert.ok(Math.hypot(p.x - VEN_CENTER.x, p.z - VEN_CENTER.z) > VEN_SHORE_R + 2, `${p.name} is off the ven`);
  }
});

test('clear of the other missions, the tower and the sand paths', () => {
  for (const p of everything()) {
    for (const [id, m] of Object.entries(OTHER_MARKERS)) assert.ok(dist(p, m) >= 8, `${p.name} keeps 8 m from the ${id} marker (${dist(p, m).toFixed(1)})`);
    assert.ok(dist(p, TOWER) > TOWER.r + 3, `${p.name} keeps off the watchtower`);
    assert.ok(distanceToNetwork(p.x, p.z) > LANE_HALF + 1, `${p.name} keeps off the paths`);
    if (p.name !== 'marker') assert.ok(dist(p, MARKER) > 1.8, `${p.name} keeps off the marker ring`);
  }
});

test('the follow: 3-4 hops over 15-25 m, a dash, two leaps, a dash into the glade', () => {
  const hops = [dist(TREE.oak, TREE.a), dist(TREE.a, TREE.b), dist(TREE.b, TREE.c), dist(TREE.c, STUMP)];
  const total = hops.reduce((s, h) => s + h, 0);
  assert.ok(total >= 15 && total <= 25, `the way is ${total.toFixed(1)} m`);
  assert.ok(hops[0] > 4.5, 'a dash over the ground from the oak');
  assert.ok(hops[1] < 3.7 && hops[2] < 3.7, `leaps between close pines (${hops[1].toFixed(2)}, ${hops[2].toFixed(2)} m)`);
  // the waits are at A and C, within ~4 m
  assert.ok(P.hopA.r === 4 && P.hopC.r === 4);
  // walking from A to C, pine B never hides the squirrel waiting at C
  const bR = barkRadius(trunk(TREE.b), 1.5);
  assert.ok(segDist(TREE.b, TREE.a, TREE.c) > bR + 1, `B stands off the line from A to C (${segDist(TREE.b, TREE.a, TREE.c).toFixed(2)} m)`);
  // every waiting branch faces back along the way (where he follows from)
  for (const [t, from] of [[TREE.a, TREE.oak], [TREE.c, TREE.a]] as const) {
    const back = headingTo(t, from);
    assert.ok(Math.abs(Math.atan2(Math.sin(t.branch!.ang - back), Math.cos(t.branch!.ang - back))) < 0.6);
  }
});

test('the glade: seven look-alike spots in the PRINT_SPOTS layout, uniformly scaled, all in one view', () => {
  const s = gladeSpots();
  assert.equal(s.length, PRINT_SPOTS.length);
  const d2 = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);
  for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) {
    assert.ok(Math.abs(dist(s[i], s[j]) / d2(PRINT_SPOTS[i], PRINT_SPOTS[j]) - SPOT_SCALE) < 1e-9, 'one scale for the whole layout');
    assert.ok(dist(s[i], s[j]) > SPOT_SIZE + 0.4, `spots ${i} and ${j} stand apart`);
  }
  // from the stand, every spot lies ahead within ±50° (the held view takes them all in)
  for (const p of s) {
    const l = toLocal({ x: P.stand.x, z: P.stand.z, heading: P.stand.heading! }, p);
    assert.ok(l.v > 0.6 && Math.abs(Math.atan2(l.u, l.v)) < (50 * Math.PI) / 180, `spot ${p.id} is ahead in the view`);
  }
  assert.ok(SEEDLING_SPOT >= 0 && SEEDLING_SPOT < s.length);
  // no fern grows through a spot
  for (const p of s) assert.ok(eekhoornClearings().some((c) => dist(c, p) < 0.01 && c.r >= SPOT_SIZE), `spot ${p.id} is kept bare`);
  // the view includes the ranger's spot and looks past him at the spots
  assert.ok(GLADE_VIEW.include.some((q) => dist(q, P.stand) < 1e-9));
});

test('the stands are clear: no trunk, no spot, no stump under the ranger', () => {
  for (const st of [P.stand, P.callers]) {
    for (const t of HOME_TREES) assert.ok(dist(st, t) > barkRadius(trunk(t), 0) + 1, 'off every trunk');
    for (const p of gladeSpots()) assert.ok(dist(st, p) > 0.9, 'off every spot');
    assert.ok(dist(st, STUMP) > STUMP.r + 1, 'off the stump');
  }
});

test('the callers: four distinct places, none behind a trunk, none under the oak\'s leaves', () => {
  const wp = WOODPECKER.tree;
  const wAng = WOODPECKER.ang;
  const perches = {
    eekhoorn: { x: STUMP.x, z: STUMP.z, y: STUMP.top + 0.15 },
    // (the jay has come down to the store: on a twig in the litter by the heap)
    gaai: { x: JAY_GROUND.x, z: JAY_GROUND.z, y: 0.15 },
    'groene-specht': { x: wp.x + Math.sin(wAng) * barkRadius(trunk(wp), WOODPECKER.h), z: wp.z + Math.cos(wAng) * barkRadius(trunk(wp), WOODPECKER.h), y: WOODPECKER.h },
    raaf: { x: SNAG.x, z: SNAG.z, y: SNAG.h },
  };
  const list = Object.entries(perches);
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const [a, p] = list[i], [b, q] = list[j];
    assert.ok(Math.hypot(p.x - q.x, p.z - q.z, p.y - q.y) > 0.9, `${a} and ${b} sit apart`);
  }
  // seen from the stand, nothing of the home stands between the ranger's eye and a caller
  const eye = { x: P.callers.x, z: P.callers.z };
  for (const [id, p] of list) {
    for (const t of HOME_TREES) {
      if (dist(t, p) < barkRadius(trunk(t), 0) + 0.6) continue; // (its own tree)
      assert.ok(segDist(t, eye, p) > barkRadius(trunk(t), 1) + 0.15, `${id} is not behind a trunk`);
    }
    // the glade oak's crown (world/Crowns.ts: reach 0.65 × its height) keeps clear of it
    assert.ok(dist(TREE.gladeOak, p) > 0.65 * TREE.gladeOak.h, `${id} is out from under the oak's leaves`);
  }
  // the jay (the nut thief) lands right by the store, off the spots, the squirrel's
  // stump beside it
  assert.ok(dist(JAY_GROUND, HEAP) < 0.8, 'the jay is at the acorns');
  for (const p of gladeSpots()) assert.ok(dist(JAY_GROUND, p) > SPOT_SIZE, 'not on a caching spot');
  // the held view looks at them from the stand's side
  const l = toLocal({ x: CALLERS_VIEW.at.x, z: CALLERS_VIEW.at.z, heading: CALLERS_VIEW.heading }, P.callers);
  assert.ok(l.v < -2, 'the ranger stands in front of what the view looks at');
});

test('the scattered trees keep out of the glade, the lens and the room round each home tree', () => {
  const clear = eekhoornTreeClear();
  const inside = (p: { x: number; z: number }): boolean => clear.some((c) => dist(c, p) < c.r);
  for (const t of HOME_TREES) assert.ok(inside(t), 'room round a home tree');
  for (const p of gladeSpots()) assert.ok(inside(p), 'the glade is open');
  assert.ok(inside(P.stand) && inside(P.callers));
});

test('the squirrel lives on its tree by the marker before, at its glade after', () => {
  const sq = EEKHOORN_RESIDENTS.find((r) => r.key === 'squirrel')!;
  assert.ok(sq.before && dist(sq.before, TREE.oak) < 0.01, 'on its tree by the marker');
  assert.ok(sq.after && dist(sq.after, TREE.storePine) < 0.01, 'at its glade after, in the pine by its store');
  assert.ok(dist(TREE.storePine, STUMP) < 3.5, 'its store is at the foot of that pine');
  assert.ok(sq.voice && sq.voice.call === 'eekhoorn', 'it chatters');
});
