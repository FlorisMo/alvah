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
  EEKHOORN_PLACES as P, EEKHOORN_RESIDENTS, HOME_TREES, TREE, MARKER, STUMP, HEAP, HEAP_SPOTS, SNAG, WOODPECKER, SEEDLING_AT, JAY_GROUND,
  GLADE_VIEW, CALLERS_VIEW, SPOT_SCALE, SPOT_SIZE, SEE_D, SEEN_X, WAIT_H, HIDE, gladeSpots, eekhoornTreeClear, eekhoornClearings, branchStub,
  seatOf, watchSpot, WATCH_R, hideStart, hideShift, slipSecs, roundStep, trunkClear, wayTo,
} from './eekhoorn.places.ts';
import { STUB_TILT } from '../../world/Forest.ts';
import { biomeAt, VEN_CENTER, VEN_SHORE_R } from '../../Biomes.ts';
import { distanceToNetwork, LANE_HALF } from '../../Paths.ts';
import { dist, headingTo, toLocal, segDist } from '../places.ts';
import { PRINT_SPOTS } from '../../../engines/corsi.ts';
import { SQ, barkRadius, lineClear, trunkUpright, type Trunk, type Upright } from '../squirrel-math.ts';
import { RANGER_STAND_HEIGHT } from '../../AnimalScale.ts';

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
  // it waits at A and C on a LOW stub (about his shoulder), and runs on once he is
  // within ~3 m of it (not of the trunk: then it reads as an animal, ~30 px)
  assert.equal(TREE.a.branch!.h, WAIT_H);
  assert.equal(TREE.c.branch!.h, WAIT_H);
  assert.ok(WAIT_H <= 1.2 && WAIT_H > 0.8, 'low, but over the fern and clear of his head in the follow lens');
  assert.ok(P.hopA.r === SEE_D && P.hopC.r === SEE_D && SEE_D <= 3);
  // walking from A to C, pine B never hides the squirrel waiting at C
  const bR = barkRadius(trunk(TREE.b), 1.5);
  assert.ok(segDist(TREE.b, TREE.a, TREE.c) > bR + 1, `B stands off the line from A to C (${segDist(TREE.b, TREE.a, TREE.c).toFixed(2)} m)`);
  // every waiting branch faces back along the way (where he follows from)
  for (const [t, from] of [[TREE.a, TREE.oak], [TREE.c, TREE.a]] as const) {
    const back = headingTo(t, from);
    assert.ok(Math.abs(Math.atan2(Math.sin(t.branch!.ang - back), Math.cos(t.branch!.ang - back))) < 0.6);
  }
});

/** The follow lens behind him (world/CameraRig: 2.4 m up, 4.6 m back) looking the way
 *  he walks, and what hides a squirrel from it: the home's trunks and his own body. */
const LENS = { up: 2.4, back: 4.6 };
const HFOV = Math.atan(Math.tan((55 / 2) * Math.PI / 180) * 1.6 * 0.98); // (55° lens at 1280×800: the whole picture)
/** …and the part of it where he has SEEN it: well inside, not at the edge */
const HFOV_SEEN = Math.atan(Math.tan((55 / 2) * Math.PI / 180) * 1.6 * SEEN_X);
function lensSees(me: { x: number; z: number }, heading: number, sq: { x: number; z: number; y: number }): boolean {
  const eye = { x: me.x - Math.sin(heading) * LENS.back, y: LENS.up, z: me.z - Math.cos(heading) * LENS.back };
  const body: Upright = { x: me.x, z: me.z, y0: 0, y1: RANGER_STAND_HEIGHT * 1.1, r: () => 0.22 };
  const ups = [...HOME_TREES.map((t) => trunkUpright(trunk(t), 0)), body];
  const off = Math.atan2(Math.sin(headingTo(eye, sq) - heading), Math.cos(headingTo(eye, sq) - heading));
  return Math.abs(off) < HFOV_SEEN && lineClear(eye, sq, ups, 0.12);
}

test('the follow: from where he walks up, the squirrel on its low stub sits in the lens, over his shoulder', () => {
  // walking straight from the last stop to the spot to see it from (golden's hint), it is
  // in view (not behind a trunk, not behind his head) within SEE_D of it, and the way
  // there clears every trunk
  // (he starts in the marker ring, anywhere in it; then from the spot he saw it from)
  const ring = [0, 1, 2, 3, 4, 5].map((i) => ({ x: P.marker.x + Math.sin(i * 1.05) * 1.4, z: P.marker.z + Math.cos(i * 1.05) * 1.4 }));
  const legs = [...ring.map((m) => [m, TREE.a] as const), [watchSpot(TREE.a), TREE.c] as const];
  for (const [from, t] of legs) {
    const w = watchSpot(t);
    const seat = seatOf(t);
    const sq = { ...seat, y: t.branch!.h + 0.15 };
    assert.ok(dist(w, seat) < SEE_D - 0.4, `the spot is within ${SEE_D} m of it (${dist(w, seat).toFixed(2)} m)`);
    // a perfect player walks the hint: straight, round a trunk in the way by a spot beside it
    let me = { ...from }, heading = headingTo(me, w), seen = false, legsN = 0, atSpot: boolean | null = null;
    while (dist(me, w) > 0.05 && legsN < 4) {
      const to = wayTo(me, w);
      legsN += 1;
      for (const o of HOME_TREES) assert.ok(segDist(o, me, to) > trunkClear(o) - 0.3, `each straight piece clears every trunk`);
      heading = headingTo(me, to);
      const n = Math.ceil(dist(me, to) / 0.1);
      const a = { ...me };
      for (let i = 1; i <= n; i++) {
        me = { x: a.x + (to.x - a.x) * (i / n), z: a.z + (to.z - a.z) * (i / n) };
        if (dist(me, seat) <= SEE_D && lensSees(me, heading, sq)) seen = true;
        // (golden stops as soon as it is within the hint's radius of the spot: from there
        // it must see it too, or it would wait there for ever)
        if (atSpot === null && to === w && dist(me, w) <= WATCH_R) atSpot = lensSees(me, heading, sq);
      }
    }
    assert.equal(atSpot, true, `where golden stops, within ${WATCH_R} m of the spot, it is in the lens`);
    assert.ok(legsN <= 3, `at most two spots beside a trunk on the way (${legsN})`);
    assert.ok(seen, 'within SEE_D of it, it is in the lens');
    assert.ok(lensSees(me, heading, sq), 'at the spot, it is in the lens');
  }
  // each stub looks back along the way he comes (so it sits up facing him)
  for (const [t, from] of [[TREE.a, P.marker], [TREE.c, watchSpot(TREE.a)]] as const) {
    const back = headingTo(t, from);
    assert.ok(Math.abs(Math.atan2(Math.sin(t.branch!.ang - back), Math.cos(t.branch!.ang - back))) < 0.7);
  }
});

/** The squirrel clinging to the bark of `t` at heading `ang`, `h` m up, as a lens sees
 *  it: points on its body (out from the bark, across it, up it). */
function clingPoints(t: typeof HOME_TREES[number], ang: number, h: number): { x: number; y: number; z: number }[] {
  const r = barkRadius(trunk(t), h);
  const out: { x: number; y: number; z: number }[] = [];
  for (const o of [0.03, 0.1, 0.17]) for (const side of [-0.06, 0, 0.06]) for (const up of [0.05, 0.25]) {
    const a = ang + side / (r + o);
    out.push({ x: t.x + Math.sin(a) * (r + o), y: h + up, z: t.z + Math.cos(a) * (r + o) });
  }
  return out;
}
/** How many of those points a lens (turned `camH`, 4.6 m behind him) sees (`hf`: in the
 *  whole picture, or well inside it). */
function lensSeesOf(me: { x: number; z: number }, camH: number, pts: { x: number; y: number; z: number }[], hf = HFOV): number {
  const eye = { x: me.x - Math.sin(camH) * LENS.back, y: LENS.up, z: me.z - Math.cos(camH) * LENS.back };
  const body: Upright = { x: me.x, z: me.z, y0: 0, y1: RANGER_STAND_HEIGHT * 1.1, r: () => 0.22 };
  const ups = [...HOME_TREES.map((t) => trunkUpright(trunk(t), 0)), body];
  return pts.filter((p) => Math.abs(Math.atan2(Math.sin(headingTo(eye, p) - camH), Math.cos(headingTo(eye, p) - camH))) < hf && lineClear(eye, p, ups)).length;
}
/** …at least half of them well inside the picture (the game's "seen": then he has found it). */
function lensSeesHalf(me: { x: number; z: number }, camH: number, pts: { x: number; y: number; z: number }[]): boolean {
  return lensSeesOf(me, camH, pts, HFOV_SEEN) >= pts.length / 2;
}

test('hide-and-seek at pine C: it keeps the trunk between them, slips round once or twice before the lens sees it, never faster than he walks; he walks about half round, then it is in view', () => {
  const c = TREE.c;
  const cR = barkRadius(trunk(c), HIDE.h);
  const clear = eekhoornTreeClear();
  // he comes up from pine A's side and stops where he sees it on its stub (anywhere within
  // SEE_D of it, on open ground); then he follows the hint (a perfect player walks
  // straight at 2.2 m/s, reading the hint anew within 1 m of it) and the follow lens
  // turns after him (≤ 1.6 rad/s)
  const seat = seatOf(c);
  const from = headingTo(c, TREE.a);
  let starts = 0;
  const wrapA = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
  for (let k = -6; k <= 6; k++) for (const d of [1.8, 2.4, 3, 3.6]) {
    let me = { x: c.x + Math.sin(from + k * 0.17) * d, z: c.z + Math.cos(from + k * 0.17) * d };
    if (dist(me, seat) > SEE_D || HOME_TREES.some((o) => dist(o, me) < trunkClear(o))) continue;
    starts += 1;
    let heading = headingTo(me, c);
    let camH = heading;
    const eyeAt = (): { x: number; z: number } => ({ x: me.x - Math.sin(camH) * LENS.back, z: me.z - Math.cos(camH) * LENS.back });
    let sqAng = hideStart(c, [me, eyeAt()], STUMP);
    // it starts out of the lens's sight, and out of his
    assert.equal(lensSeesHalf(me, camH, clingPoints(c, sqAng, HIDE.h)), false, 'hidden at first');
    const off0 = Math.abs(wrapA(sqAng - headingTo(c, me)));
    assert.ok(off0 > Math.acos(cR / d) + 0.6, `it hides across the trunk from him too (${(off0 * 180 / Math.PI).toFixed(0)}°)`);
    let slips = 0;
    let hiding = true;
    let slipping = 0; // s still slipping
    let round = 0; let found = false;
    let goal = roundStep(c, me, sqAng);
    const dt = 0.05;
    for (let t = 0; t < 40 && !found; t += dt) {
      if (dist(me, goal) < 1.0) goal = roundStep(c, me, sqAng); // (golden reads the hint anew on arrival)
      const dd = dist(me, goal);
      if (dd > 0.05) {
        // (each straight piece clears every trunk)
        for (const [i, o] of HOME_TREES.entries()) assert.ok(segDist(o, me, goal) > trunkClear(o) - 0.3, `the way round clears the trunks (tree ${i}: ${segDist(o, me, goal).toFixed(2)} from ${k}/${d})`);
        heading = headingTo(me, goal);
        const s = Math.min(dd, 2.2 * dt);
        const b0 = headingTo(c, me);
        me = { x: me.x + Math.sin(heading) * s, z: me.z + Math.cos(heading) * s };
        round += Math.abs(wrapA(headingTo(c, me) - b0));
      }
      camH += Math.max(-1.6 * dt, Math.min(1.6 * dt, wrapA(heading - camH)));
      if (slipping > 0) { slipping -= dt; continue; }
      const pts = clingPoints(c, sqAng, HIDE.h);
      if (hiding && (round >= HIDE.round || slips >= HIDE.most)) hiding = false;
      if (hiding) {
        // (a bit of it showing past the bark in his view sends it round too)
        const next = hideShift(sqAng, [headingTo(c, me), headingTo(c, eyeAt())], lensSeesOf(me, camH, pts) > 0);
        if (next !== null) {
          const secs = slipSecs(sqAng, next);
          // never a dart: about as fast round the bark as he goes round it
          assert.ok(Math.abs(wrapA(next - sqAng)) / secs <= HIDE.rate + 1e-9);
          assert.ok((Math.abs(wrapA(next - sqAng)) * (cR + 0.1)) / secs < SQ.climb);
          // a real move round the bark, and before the lens sees it
          assert.ok(Math.abs(wrapA(next - sqAng)) > 0.3, `a real slip (${(Math.abs(wrapA(next - sqAng)) * 180 / Math.PI).toFixed(0)}°)`);
          assert.equal(lensSeesHalf(me, camH, pts), false, 'it slips away before it is seen');
          slipping = secs; sqAng = next; slips += 1;
          continue;
        }
      }
      found = !hiding && lensSeesHalf(me, camH, pts);
    }
    assert.ok(found, `found from ${k}/${d}`);
    assert.ok(slips >= 1 && slips <= HIDE.most, `it slipped round ${slips}×`);
    assert.ok(round > 2.5, `he walked ${(round * 180 / Math.PI).toFixed(0)}° round the tree before he saw it`);
    assert.ok(round < 4.4, `…but not round and round (${(round * 180 / Math.PI).toFixed(0)}°)`);
    // round the tree is open ground (no stray forest tree)
    assert.ok(clear.some((q) => dist(q, me) < q.r), 'no stray forest tree there');
    assert.equal(biomeAt(me.x, me.z), 'bos');
  }
  assert.ok(starts >= 12, `${starts} ways up to it tried`);
});

test('hide-and-seek: right up at the bark on its side (where a child steering at its chatter ends up) he is by it; round the side he is not', () => {
  const c = TREE.c;
  const wrapA = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
  const at = (ang: number): { x: number; z: number } => ({ x: c.x + Math.sin(ang) * (barkRadius(trunk(c), HIDE.h) + 0.1), z: c.z + Math.cos(ang) * (barkRadius(trunk(c), HIDE.h) + 0.1) });
  const hug = (ang: number): { x: number; z: number } => ({ x: c.x + Math.sin(ang) * trunkClear(c), z: c.z + Math.cos(ang) * trunkClear(c) });
  const near = (me: { x: number; z: number }, sqAng: number): boolean => dist(me, at(sqAng)) < HIDE.near && Math.abs(wrapA(headingTo(c, me) - sqAng)) < HIDE.nearAng;
  for (let a = -Math.PI; a < Math.PI; a += 0.3) {
    assert.ok(near(hug(a), a), 'pressed against the bark in front of it');
    assert.ok(near(hug(a + 0.4), a), '…or a little beside it');
    assert.ok(!near(hug(a + Math.PI / 2), a), 'a quarter round the trunk from it: not by it');
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
  // the seedling grows in the glade, off every spot (not where an acorn was dug up)
  for (const p of s) assert.ok(dist(SEEDLING_AT, p) > SPOT_SIZE, 'the seedling is off the spots');
  assert.ok(dist(SEEDLING_AT, P.glade) < 3, 'the seedling is in the glade');
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

test('each home tree\'s branch stub is part of its tree: rooted in the bark, out past the squirrel\'s seat, its top at the branch', () => {
  let n = 0;
  for (const [i, t] of HOME_TREES.entries()) {
    const s = branchStub(t);
    if (!t.branch) { assert.equal(s, undefined, `tree-${i} has no branch, so no stub`); continue; }
    n++;
    assert.ok(s, `tree-${i} has its stub`);
    const b = t.branch;
    const bark = barkRadius(trunk(t), b.h);
    assert.equal(s.ang, b.ang, `tree-${i}: it points the branch's way`);
    assert.ok(s.start < bark * 0.95, `tree-${i}: rooted inside the bark (${s.start.toFixed(3)} < ${bark.toFixed(3)} m)`);
    const past = s.start + s.len * Math.cos(STUB_TILT) - bark;
    assert.ok(past >= b.out + 0.08, `tree-${i}: it reaches ${past.toFixed(2)} m out of the bark (the seat is ${b.out} m out)`);
    assert.ok(Math.abs(s.y + s.r - b.h) < 0.015, `tree-${i}: its top at the branch height (${(s.y + s.r).toFixed(3)} vs ${b.h})`);
    assert.ok(s.r > 0.03 && s.r < 0.09, `tree-${i}: a limb, not a log (${s.r} m)`);
  }
  assert.equal(n, HOME_TREES.length, 'every home tree has a branch');
});
