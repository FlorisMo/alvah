/**
 * eekhoorn.places.test.ts — where "De verstopte nootjes" happens is chosen by looking at
 * the world; this pins that it stays a good place (design run6-missions §3.4, §4.4; run 7
 * `state/eekhoorn/design.md` §6): in the wood, inside the world, clear of the paths and
 * the other missions, the squirrel's pine in view as the child walks up; for EVERY way it
 * leads him (three): a readable follow (the first wait near the ring, each wait beside
 * its trunk over his shoulder, leaps only between close pines and onward), a hide tree in
 * its own open ring where he walks about half round and the found view holds him and the
 * squirrel close; the glade's seven look-alike spots in one view in every mirror-image;
 * every trio of neighbours four distinct calls at four distinct places, none behind a
 * trunk; the jay's way back in the picture; and the play's draw never the last play's.
 * Run: `npm test`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  EEKHOORN_PLACES as P, EEKHOORN_RESIDENTS, HOME_TREES, TREE, MARKER, STUMP, HEAP, HEAP_SPOTS, SNAG, SEEDLING_AT, JAY_GROUND,
  GLADE_VIEW, CALLERS_VIEW, SPOT_SCALE, SPOT_SIZE, SEE_D, SEEN_X, WAIT_H, WAIT_TURN, HIDE, gladeSpots, eekhoornTreeClear, eekhoornClearings, branchStub, SCATTER_TAKEN,
  seatOf, watchSpot, WATCH_R, SEAT_STOP, AT_IT, hideStart, hideShift, slipSecs, roundStep, trunkClear, wayTo, comesFrom, introView, foundView, foundFace, foundStand, FIND_R,
  ROUTES, ROUTE_IDS, HIDE_TREES, FIELD_SYMS, NEIGHBOURS, NOT_TOGETHER, SQUIRREL_FAMILY, SLOTS, PERCH, JAY_WAIT, JAY_RETREAT, FIRST_TRIO,
  legalTrios, trioCode, trioOf, jayStep, variantOf, parseVariant, lastVariant, lastVariants, drawEekhoornPlay, VARIANT_KEY,
  drawDay, DEN_KINDS, EINDES, ANTICS, SUN_MOODS, SECOND_HIDE, ALL_HIDE_TREES, HIDE2_TURN, HIDE2_STEP, hide2Stand, denSpot, DEN_DAY, BURY_AT, JAY_CACHE, jayFliesAway, coneDrop, CONE_DROP, CONE_FALL, type Drawn,
  FOUND_RUN, foundRun, foundRunPath, lensBehind, JAY_SEE,
  NEST, NEST_SEE, NEST_WATCH, nestTrees, nestOf, nestPeek, nestSolid, nestWatch, nestAim, NEST_FADE, DINING, ROUTE_DINING, diningById, STRONK, STAM, DINING_SEE, SeenClock, denVisitor, DEN_VISITOR, youngPeek, YOUNG,
  type HomeTree, type Route, type Trio,
} from './eekhoorn.places.ts';
import { STUB_TILT } from '../../world/Forest.ts';
import { biomeAt, heightAt as groundY, VEN_CENTER, VEN_SHORE_R } from '../../Biomes.ts';
import { distanceToNetwork, LANE_HALF } from '../../Paths.ts';
import { dist, headingTo, toLocal, segDist, offCentre } from '../places.ts';
import { PRINT_SPOTS } from '../../../engines/corsi.ts';
import { SQ, barkRadius, climbPlan, dashPlan, dismountPlan, lineClear, trunkFadeUpright, trunkOutline, trunkUpright, type Segment, type SqPose, type Trunk, type Upright } from '../squirrel-math.ts';
import { RANGER_STAND_HEIGHT } from '../../AnimalScale.ts';
import { newPlay } from '../../../core/play.ts';

/** The other missions' markers as the world places them (`__ranger.markers()`, 2026-09-29). */
const OTHER_MARKERS = {
  nachtronde: { x: 20.8, z: -34.2 }, vos: { x: 35.8, z: -45.6 }, ecoduct: { x: 19.1, z: -24.4 },
  ven: { x: 24.5, z: -19.0 }, wildcamera: { x: 15.56, z: -15.56 },
};
/** The watchtower (world/Dressing LANDMARKS): its footprint ≈ 3 m round its middle. */
const TOWER = { x: 37, z: -37, r: 3.2 };
/** The forest's scattered trees nearest the ways (`__ranger.treeSpots()`, 2026-10-03): a
 *  home tree's clear ring must not take them away (the wood round the other homes stays).
 *  The one at (29.75, -47.72) is taken on purpose (SCATTER_TAKEN, the triangle budget). */
const SCATTER = [{ x: 14.4, z: -39.3 }, { x: 6.9, z: -41.9 }, { x: 31.9, z: -48.7 }];
/** The glade's tree clearing and the lens room behind the stands (design §6.2). */
const GLADE_RING = { x: 12.0, z: -60.1, r: 7 };
const LENS_ROOM = { x: 16.97, z: -55.34, r: 4.2 };

const trunk = (t: HomeTree): Trunk => ({ x: t.x, z: t.z, H: t.h, species: t.species });
const wrapA = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
const deg = (r: number): number => Math.round((r * 180) / Math.PI);
const ROUTE_TREES = new Set(ROUTE_IDS.flatMap((id) => ROUTES[id].hops.map((h) => h.tree)));

const everything = (): { name: string; x: number; z: number }[] => [
  ...Object.entries(P).map(([name, p]) => ({ name, x: p.x, z: p.z })),
  ...HOME_TREES.map((t) => ({ name: `tree-${t.id}`, x: t.x, z: t.z })),
  ...FIELD_SYMS.flatMap((sym) => gladeSpots(sym).map((s) => ({ name: `spot-${sym}-${s.id}`, x: s.x, z: s.z }))),
  ...[...ROUTE_TREES].filter((t) => t.branch).flatMap((t) => [{ name: `seat-${t.id}`, ...seatOf(t) }, { name: `watch-${t.id}`, ...watchSpot(t) }]),
  { name: 'stump', x: STUMP.x, z: STUMP.z }, { name: 'snag', x: SNAG.x, z: SNAG.z },
  ...HEAP_SPOTS.map((h, i) => ({ name: `heap-${i}`, ...h })),
  ...JAY_RETREAT.map((h, i) => ({ name: `jay-${i}`, ...h })), { name: 'jay-wait', ...JAY_WAIT },
];

test('the marker stays where the world puts it; the squirrel\'s tree is in view as the child walks up', () => {
  assert.ok(Math.abs(MARKER.x - 25.419) < 0.01 && Math.abs(MARKER.z + 41.891) < 0.01);
  const d = dist(MARKER, TREE.oak);
  assert.ok(d > 2.2 && d < 4, `its tree stands by the ring (${d.toFixed(1)} m)`);
  // a pine: its crown starts high above the lens (an oak's low leaf dome would fade to a ghost)
  assert.equal(TREE.oak.species, 'prop-pine-scots');
  // walking in from the clearing, the oak lies ahead (within 45° of the way in)
  const walkIn = headingTo({ x: 0, z: 0 }, MARKER);
  const off = Math.abs(wrapA(headingTo(MARKER, TREE.oak) - walkIn));
  assert.ok(off < Math.PI / 4, `its tree is ${deg(off)}° off the way in: in view`);
  // its branch stub points toward the ring's side (the squirrel sits facing the child)
  const b = TREE.oak.branch!;
  assert.ok(Math.abs(wrapA(b.ang - headingTo(TREE.oak, MARKER))) < 1.2);
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

test('the three ways: each its own way and hide tree, out of the glade and the lens room, the wood round them left standing', () => {
  for (const id of ROUTE_IDS) {
    for (const { tree: t } of ROUTES[id].hops) {
      assert.ok(dist(t, GLADE_RING) > GLADE_RING.r, `${id}/${t.id} stands outside the glade's clearing`);
      assert.ok(dist(t, LENS_ROOM) > LENS_ROOM.r, `${id}/${t.id} stands outside the lens room (${dist(t, LENS_ROOM).toFixed(2)})`);
      const ring = HIDE_TREES.includes(t) ? 4.6 : 3.2;
      for (const s of SCATTER) assert.ok(dist(t, s) > ring + 0.25, `${id}/${t.id} leaves the scattered pine at (${s.x}, ${s.z}) standing (${dist(t, s).toFixed(2)} m)`);
    }
    // each way has pines of its own (where they share one, they part after it)
    const own = ROUTES[id].hops.filter((h) => ROUTE_IDS.every((o) => o === id || !ROUTES[o].hops.some((q) => q.tree === h.tree)));
    assert.ok(own.length >= 2, `${id}: ${own.length} pines of its own`);
  }
  // no two ways share their second wait or their hide tree; two that share a first wait
  // part straight after it (another second wait)
  assert.equal(new Set(HIDE_TREES).size, 3, 'three hide trees');
  assert.equal(new Set(ROUTE_IDS.map((id) => ROUTES[id].waits[1])).size, 3, 'three different second waits');
  assert.ok(new Set(ROUTE_IDS.map((id) => ROUTES[id].waits[0])).size >= 2, 'at least two first waits');
  // home trees stand apart (two trunks a child can walk between)
  for (let i = 0; i < HOME_TREES.length; i++) for (let j = i + 1; j < HOME_TREES.length; j++) {
    const a = HOME_TREES[i], b = HOME_TREES[j];
    assert.ok(dist(a, b) > 2.2, `${a.id} and ${b.id} stand apart (${dist(a, b).toFixed(2)} m)`);
  }
  // few new pines: the view over this wood is near its triangle budget (a pine near the
  // lens costs 12k); the old home planted six trees; run 7 (ek-day): one more, the right
  // way's second hide pine (the simple copy until it plays round it: homeTreeNear)
  assert.ok(HOME_TREES.length <= 12, `${HOME_TREES.length} home trees`);
});

test('each way is a readable follow: the first wait near the ring, waits close, 2-3 waits, 14-26 m, leaps only between close pines and onward', () => {
  for (const id of ROUTE_IDS) {
    const r = ROUTES[id];
    const hops = r.hops;
    assert.ok(r.waits.length >= 2 && r.waits.length <= 3, `${id}: ${r.waits.length} waits`);
    assert.equal(r.waits[r.waits.length - 1], r.hide, `${id}: it hides at its last wait`);
    assert.ok(dist(r.waits[0], MARKER) <= 6.0, `${id}: the first wait is ${dist(r.waits[0], MARKER).toFixed(2)} m from the ring`);
    for (let i = 1; i < r.waits.length; i++) assert.ok(dist(r.waits[i], r.waits[i - 1]) <= 6.5, `${id}: wait ${i + 1} is ${dist(r.waits[i], r.waits[i - 1]).toFixed(2)} m from the one before`);
    const legs = [TREE.oak, ...hops.map((h) => h.tree), STUMP];
    const total = legs.slice(1).reduce((s, t, i) => s + dist(legs[i], t), 0);
    assert.ok(total >= 14 && total <= 26, `${id}: the way is ${total.toFixed(1)} m`);
    const leaps = hops.filter((h) => h.how === 'leap');
    assert.ok(leaps.length <= 2, `${id}: ${leaps.length} leaps`);
    let lastWait: HomeTree = TREE.oak;
    hops.forEach((h, i) => {
      const prev = i ? hops[i - 1].tree : TREE.oak;
      if (h.how === 'leap') {
        assert.ok(i > 0, `${id}: never a leap from the den`);
        const d = dist(prev, h.tree);
        assert.ok(d <= 3.6, `${id}: a leap ${prev.id} → ${h.tree.id} of ${d.toFixed(2)} m`);
        const fwd = Math.abs(wrapA(headingTo(prev, h.tree) - headingTo(lastWait, h.tree)));
        assert.ok(lastWait === prev || fwd <= Math.PI / 4, `${id}: the leap to ${h.tree.id} goes on (${deg(fwd)}° off the way from ${lastWait.id})`);
        for (const o of HOME_TREES) {
          if (o === prev || o === h.tree) continue;
          assert.ok(segDist(o, prev, h.tree) > 1, `${id}: ${o.id} stands off the leap ${prev.id} → ${h.tree.id}`);
        }
      } else assert.ok(dist(prev, h.tree) > 2, `${id}: a dash of ${dist(prev, h.tree).toFixed(2)} m`);
      if (h.wait) lastWait = h.tree;
    });
    // each wait's stub BESIDE its trunk as he comes (45-75° off the line back to where he
    // comes from), the sides alternating, low (about his shoulder)
    let lastSide = 0;
    r.waits.forEach((t, i) => {
      const off = wrapA(t.branch!.ang - headingTo(t, comesFrom(r, i)));
      assert.ok(Math.abs(off) >= Math.PI / 4 - 1e-9 && Math.abs(off) <= (75 * Math.PI) / 180 + 1e-9, `${id}/${t.id}: its stub ${deg(off)}° off the line back`);
      assert.ok(Math.sign(off) !== lastSide, `${id}/${t.id}: the sides alternate`);
      lastSide = Math.sign(off);
      assert.ok(t.branch!.h >= 0.9 && t.branch!.h <= 1.2, `${id}/${t.id}: a low stub`);
    });
  }
  assert.ok(WAIT_TURN >= Math.PI / 4 && WAIT_TURN <= (75 * Math.PI) / 180);
  assert.ok(WAIT_H <= 1.2 && WAIT_H > 0.8, 'low, but over the fern and clear of his head in the follow lens');
  assert.ok(P.hopA.r === SEE_D && P.hopC.r === SEE_D && SEE_D <= 3);
});

/** The follow lens behind him (world/CameraRig: 2.4 m up, 4.6 m back) looking the way
 *  he walks, and what hides a squirrel from it: the home's trunks and his own body. */
const LENS = { up: 2.4, back: 4.6 };
const HFOV = Math.atan(Math.tan((55 / 2) * Math.PI / 180) * 1.6 * 0.98); // (55° lens at 1280×800: the whole picture)
/** …and the part of it where he has SEEN it: well inside, not at the edge */
const HFOV_SEEN = Math.atan(Math.tan((55 / 2) * Math.PI / 180) * 1.6 * SEEN_X);
/** The home's trunks that can hide something from that eye: not the ones between the eye
 *  and him (the follow camera fades those: world/CameraRig) — and his own body. */
function hiders(eye: { x: number; y: number; z: number }, me: { x: number; z: number }): Upright[] {
  const body: Upright = { x: me.x, z: me.z, y0: 0, y1: RANGER_STAND_HEIGHT * 1.1, r: () => 0.22 };
  return [...HOME_TREES.filter((t) => {
    const f = trunkFadeUpright(trunk(t), 0); // (the camera's own fade decision)
    return lineClear(eye, { ...me, y: RANGER_STAND_HEIGHT }, [f]) && lineClear(eye, { ...me, y: 0.9 }, [f]);
  }).map((t) => trunkUpright(trunk(t), 0)), body];
}
function lensSees(me: { x: number; z: number }, heading: number, sq: { x: number; z: number; y: number }): boolean {
  const eye = { x: me.x - Math.sin(heading) * LENS.back, y: LENS.up, z: me.z - Math.cos(heading) * LENS.back };
  const ups = hiders(eye, me);
  const off = wrapA(headingTo(eye, sq) - heading);
  return Math.abs(off) < HFOV_SEEN && lineClear(eye, sq, ups, 0.12);
}

test('the follow, every way: from where he walks up, the squirrel on its low stub sits in the lens, over his shoulder', () => {
  // walking straight from the last stop to the spot to see it from (golden's hint), it is
  // in view (not behind a trunk, not behind his head) within SEE_D of it, and the way
  // there clears every trunk (he starts in the marker ring, anywhere in it; then from the
  // spot he saw the wait before from)
  const ring = [0, 1, 2, 3, 4, 5].map((i) => ({ x: P.marker.x + Math.sin(i * 1.05) * 1.4, z: P.marker.z + Math.cos(i * 1.05) * 1.4 }));
  for (const id of ROUTE_IDS) {
    const r = ROUTES[id];
    const legs = [...ring.map((m) => [m, r.waits[0]] as const), ...r.waits.slice(1).map((t, i) => [watchSpot(r.waits[i]), t] as const)];
    for (const [from, t] of legs) {
      const w = watchSpot(t);
      const seat = seatOf(t);
      const sq = { ...seat, y: t.branch!.h + 0.15 };
      assert.ok(dist(w, seat) < SEE_D - 0.4, `${id}/${t.id}: the spot is within ${SEE_D} m of it (${dist(w, seat).toFixed(2)} m)`);
      // a perfect player walks the hint: straight, round a trunk in the way by a spot beside it
      let me = { ...from }, heading = headingTo(me, w), seen = false, legsN = 0, atSpot: { x: number; z: number; h: number } | null = null;
      while (dist(me, w) > 0.05 && legsN < 4) {
        const to = wayTo(me, w);
        legsN += 1;
        for (const o of HOME_TREES) assert.ok(segDist(o, me, to) > trunkClear(o) - 0.3, `${id}/${t.id}: each straight piece clears every trunk (${o.id})`);
        heading = headingTo(me, to);
        const n = Math.ceil(dist(me, to) / 0.1);
        const a = { ...me };
        for (let i = 1; i <= n; i++) {
          me = { x: a.x + (to.x - a.x) * (i / n), z: a.z + (to.z - a.z) * (i / n) };
          if (dist(me, seat) <= SEE_D && lensSees(me, heading, sq)) seen = true;
          // (golden stops as soon as it is within the hint's radius of the spot)
          if (atSpot === null && to === w && dist(me, w) <= WATCH_R) atSpot = { ...me, h: heading };
        }
      }
      // …and from there the hint walks it on toward its seat, to SEAT_STOP short of it: on
      // that way, within SEE_D of it, it is in the lens (or golden would wait for ever)
      assert.ok(atSpot, `${id}/${t.id}: golden reaches the spot`);
      {
        const h = headingTo(atSpot, seat);
        // (already within SEAT_STOP of it there, golden stands still: the lens behind him
        // looks the way he walked in)
        let onSeen = dist(atSpot, seat) <= SEAT_STOP && lensSees(atSpot, atSpot.h, sq);
        for (let p = { x: atSpot.x, z: atSpot.z }; dist(p, seat) > SEAT_STOP; p = { x: p.x + Math.sin(h) * 0.05, z: p.z + Math.cos(h) * 0.05 }) {
          if (dist(p, seat) <= SEE_D && lensSees(p, h, sq)) onSeen = true;
        }
        assert.ok(onSeen, `${id}/${t.id}: walking on from the spot toward it, it is in the lens within ${SEE_D} m`);
        if (dist(atSpot, seat) > SEAT_STOP) assert.ok(lensSees({ x: seat.x - Math.sin(h) * SEAT_STOP, z: seat.z - Math.cos(h) * SEAT_STOP }, h, sq), `${id}/${t.id}: where the hint stops him, it is in the lens (over his shoulder)`);
      }
      assert.ok(legsN <= 3, `${id}/${t.id}: at most two spots beside a trunk on the way (${legsN})`);
      assert.ok(seen, `${id}/${t.id}: within SEE_D of it, it is in the lens`);
      assert.ok(lensSees(me, heading, sq), `${id}/${t.id}: at the spot, it is in the lens`);
    }
  }
});

test('the follow, every way: the next wait is never behind a trunk from where he saw the one before', () => {
  for (const id of ROUTE_IDS) {
    const r = ROUTES[id];
    r.waits.forEach((t, i) => {
      const from = i ? watchSpot(r.waits[i - 1]) : MARKER;
      const eye = { ...from, y: 1.25 };
      const sq = { ...seatOf(t), y: t.branch!.h + 0.15 };
      const ups = HOME_TREES.filter((o) => o !== t && (i === 0 || o !== r.waits[i - 1])).map((o) => trunkUpright(trunk(o), 0));
      assert.ok(lineClear(eye, sq, ups, 0.05), `${id}/${t.id}: in sight from where he saw the wait before`);
    });
  }
});

test('the follow, every way: a child who walks straight at the squirrel till the trunk stops him is right at it, and it shows past his head', () => {
  // (played 2026-10-01: steering at it by keys, he ended 0.7-0.9 m from it, its ears over
  // his hair in the lens, and nothing happened — his own body hid it from "seen")
  for (const t of new Set(ROUTE_IDS.flatMap((id) => ROUTES[id].waits))) {
    const seat = seatOf(t);
    const sq = { ...seat, y: t.branch!.h + 0.15 };
    const stop = trunkClear(t) - 0.25; // (the trunk's collider and the boy: where it stops him)
    // from anywhere on its side of the tree (within a quarter turn of where its stub points)
    for (let off = -1.5; off <= 1.5 + 1e-9; off += 0.1) {
      const a = t.branch!.ang + off;
      let me = { x: seat.x + Math.sin(a) * 4, z: seat.z + Math.cos(a) * 4 };
      const h = headingTo(me, seat);
      while (dist(me, t) > stop && dist(me, seat) > 0.05) me = { x: me.x + Math.sin(h) * 0.02, z: me.z + Math.cos(h) * 0.02 };
      assert.ok(dist(me, seat) <= AT_IT, `${t.id}: from ${off.toFixed(1)} rad he stops ${dist(me, seat).toFixed(2)} m from it (≤ ${AT_IT})`);
      // the lens behind him — straight behind, or still swinging round after him (up to
      // ~35° off) — sees a bit of it past the bark (his head in front of it does not count;
      // at the trunk's edge in the picture it shows past the bark, not past the ridges)
      const body = [-0.07, 0, 0.07].flatMap((dx) => [0.05, 0.2].map((up) => ({ x: sq.x + Math.cos(t.branch!.ang) * dx, y: t.branch!.h + up, z: sq.z - Math.sin(t.branch!.ang) * dx })));
      for (const swing of [-0.6, -0.3, 0, 0.3, 0.6]) {
        const ch = h + swing;
        const eye = { x: me.x - Math.sin(ch) * LENS.back, y: LENS.up, z: me.z - Math.cos(ch) * LENS.back };
        const bark: Upright[] = hiders(eye, me).slice(0, -1).map((u) => {
          const tr = HOME_TREES.find((o) => o.x === u.x && o.z === u.z)!;
          return { ...u, r: (y: number) => barkRadius(trunk(tr), Math.max(0, y)) };
        });
        assert.ok(body.some((b) => lineClear(eye, b, bark)), `${t.id}: from ${off.toFixed(1)} rad, the lens ${swing} rad round: a bit of it shows past the bark`);
      }
    }
  }
});

/** The squirrel clinging to the bark of `t` at heading `ang`, `h` m up, as a lens sees
 *  it: points on its body (out from the bark, across it, up it). */
function clingPoints(t: HomeTree, ang: number, h: number): { x: number; y: number; z: number }[] {
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
  const ups = hiders(eye, me);
  return pts.filter((p) => Math.abs(wrapA(headingTo(eye, p) - camH)) < hf && lineClear(eye, p, ups)).length;
}
/** …at least half of them well inside the picture (the game's "seen": then he has found it). */
function lensSeesHalf(me: { x: number; z: number }, camH: number, pts: { x: number; y: number; z: number }[]): boolean {
  return lensSeesOf(me, camH, pts, HFOV_SEEN) >= pts.length / 2;
}

/** A perfect player's hide-and-seek round `c` from his last wait's side: where he finds it. */
function playHide(c: HomeTree, start: { x: number; z: number }, id: string, o: { most: number; round: number; cam?: number } = HIDE): { found: boolean; slips: number; round: number; me: { x: number; z: number }; sqAng: number } {
  const cR = barkRadius(trunk(c), HIDE.h);
  let me = { ...start };
  let heading = headingTo(me, c);
  let camH = o.cam ?? heading; // (the lens's bearing as the hide begins: behind him, or `cam`)
  const eyeAt = (): { x: number; z: number } => ({ x: me.x - Math.sin(camH) * LENS.back, z: me.z - Math.cos(camH) * LENS.back });
  let sqAng = hideStart(c, [me, eyeAt()], STUMP);
  // it starts out of the lens's sight, and out of his
  assert.equal(lensSeesHalf(me, camH, clingPoints(c, sqAng, HIDE.h)), false, `${id}: hidden at first`);
  const off0 = Math.abs(wrapA(sqAng - headingTo(c, me)));
  assert.ok(off0 > Math.acos(Math.min(1, cR / dist(me, c))) + 0.6, `${id}: it hides across the trunk from him too (${deg(off0)}°)`);
  let slips = 0;
  let hiding = true;
  let slipping = 0; // s still slipping
  let round = 0; let found = false;
  let goal = roundStep(c, me, sqAng);
  const dt = 0.05;
  // (golden walks until it is within the hint's radius, then reads the hint anew)
  const stopAt = (g: { r?: number }): number => g.r ?? WATCH_R;
  for (let t = 0; t < 40 && !found; t += dt) {
    if (dist(me, goal) < stopAt(goal)) goal = roundStep(c, me, sqAng);
    const dd = dist(me, goal);
    if (dd >= stopAt(goal)) {
      for (const o of HOME_TREES) assert.ok(segDist(o, me, goal) > trunkClear(o) - 0.3, `${id}: the way round clears the trunks (${o.id}: ${segDist(o, me, goal).toFixed(2)})`);
      heading = headingTo(me, goal);
      const s = Math.min(dd, 2.2 * dt);
      const b0 = headingTo(c, me);
      me = { x: me.x + Math.sin(heading) * s, z: me.z + Math.cos(heading) * s };
      round += Math.abs(wrapA(headingTo(c, me) - b0));
    }
    camH += Math.max(-1.6 * dt, Math.min(1.6 * dt, wrapA(heading - camH)));
    if (slipping > 0) { slipping -= dt; continue; }
    const pts = clingPoints(c, sqAng, HIDE.h);
    if (hiding && (round >= o.round || slips >= o.most)) hiding = false;
    if (hiding) {
      const next = hideShift(c, sqAng, [headingTo(c, me), headingTo(c, eyeAt())], lensSeesOf(me, camH, pts) > 0);
      if (next !== null) {
        const secs = slipSecs(sqAng, next);
        // never a dart: about as fast round the bark as he goes round it
        assert.ok(Math.abs(wrapA(next - sqAng)) / secs <= HIDE.rate + 1e-9);
        assert.ok((Math.abs(wrapA(next - sqAng)) * (cR + 0.1)) / secs < SQ.climb);
        assert.ok(Math.abs(wrapA(next - sqAng)) > 0.3, `${id}: a real slip (${deg(Math.abs(wrapA(next - sqAng)))}°)`);
        assert.equal(lensSeesHalf(me, camH, pts), false, `${id}: it slips away before it is seen`);
        slipping = secs; sqAng = next; slips += 1;
        continue;
      }
    }
    found = !hiding && lensSeesHalf(me, camH, pts);
  }
  return { found, slips, round, me, sqAng };
}

test('hide-and-seek round every hide tree: it keeps the trunk between them, slips round once or twice before the lens sees it; he walks about half round, then it is in view', () => {
  const clear = eekhoornTreeClear();
  for (const rid of ROUTE_IDS) {
    const r = ROUTES[rid];
    const c = r.hide;
    const seat = seatOf(c);
    const from = headingTo(c, comesFrom(r, r.waits.length - 1));
    let starts = 0;
    for (let k = -6; k <= 6; k++) for (const d of [1.8, 2.4, 3, 3.6]) {
      const me = { x: c.x + Math.sin(from + k * 0.17) * d, z: c.z + Math.cos(from + k * 0.17) * d };
      if (dist(me, seat) > SEE_D || HOME_TREES.some((o) => dist(o, me) < trunkClear(o))) continue;
      starts += 1;
      const res = playHide(c, me, `${rid}/${c.id} from ${k}/${d}`);
      assert.ok(res.found, `${rid}: found from ${k}/${d}`);
      assert.ok(res.slips >= 1 && res.slips <= HIDE.most, `${rid}: it slipped round ${res.slips}×`);
      assert.ok(res.round > 2.5, `${rid}: he walked ${deg(res.round)}° round the tree before he saw it`);
      assert.ok(res.round < 4.4, `${rid}: …but not round and round (${deg(res.round)}°)`);
      // round the tree is open ground (no stray forest tree)
      assert.ok(clear.some((q) => dist(q, res.me) < q.r), `${rid}: no stray forest tree there`);
      assert.equal(biomeAt(res.me.x, res.me.z), 'bos');
    }
    assert.ok(starts >= 8, `${rid}: ${starts} ways up to it tried`);
  }
});

test('the second hide (ek-day): from where he found it the first time, a short hide-and-seek round the close pine — it slips once at most, he walks a little round, then it is in view', () => {
  const short = { most: 1, round: HIDE.round * 0.6 };
  let n = 0, stepped = 0;
  for (const rid of ROUTE_IDS) {
    const r = ROUTES[rid], c = r.hide, t2 = SECOND_HIDE[rid];
    const from = headingTo(c, comesFrom(r, r.waits.length - 1));
    for (let k = -6; k <= 6; k += 2) for (const d of [1.8, 2.6, 3.4]) {
      const start = { x: c.x + Math.sin(from + k * 0.17) * d, z: c.z + Math.cos(from + k * 0.17) * d };
      if (dist(start, seatOf(c)) > SEE_D || HOME_TREES.some((o) => dist(o, start) < trunkClear(o))) continue;
      const first = playHide(c, start, `${rid} first`);
      if (!first.found) continue;
      // he stands where the found view left him and turns so that the lens behind him holds
      // the squirrel on the first pine and the second pine both (its dash plays in his
      // picture, across it or away from the lens: hide2Turn), and plays from there
      // (or, where no turn does it, from a few calm steps off: hide2Stand)
      const face = foundFace(c, first.sqAng, first.me);
      const at0 = foundStand(c, face, first.me);
      const rr = barkRadius(trunk(c), HIDE.h) + 0.08;
      const sqAt = { x: c.x + Math.sin(face) * rr, z: c.z + Math.cos(face) * rr };
      const turn = hide2Stand(at0, sqAt, c, t2);
      const me = turn.at;
      if (dist(me, at0) > 0) stepped += 1;
      assert.ok(turn.ok, `${rid}: a turn whose picture holds its dash to ${t2.id} (from ${k}/${d})`);
      assert.ok(dist(me, at0) <= HIDE2_STEP[HIDE2_STEP.length - 1] + 1e-9, `${rid}: a few steps at most`);
      for (const o of HOME_TREES) assert.ok(dist(o, me) >= trunkClear(o), `${rid}: he stands clear of ${o.id}`);
      const lens = { x: me.x - Math.sin(turn.face) * HIDE2_TURN.back, z: me.z - Math.cos(turn.face) * HIDE2_TURN.back };
      // (never toward the lens: the second pine no nearer it than where the squirrel leaves)
      assert.ok(dist(lens, t2) > dist(lens, sqAt) - 0.3 * dist(sqAt, t2), `${rid}: its dash goes across or away (from ${k}/${d})`);
      const res = playHide(t2, me, `${rid}/${t2.id} second from ${k}/${d}`, { ...short, cam: turn.face });
      n += 1;
      assert.ok(res.found, `${rid}: found round ${t2.id} too (from ${k}/${d})`);
      assert.ok(res.slips <= 1, `${rid}: a short one (${res.slips} slips)`);
      assert.ok(res.round < 3.6, `${rid}: not round and round (${deg(res.round)}°)`);
      assert.equal(biomeAt(res.me.x, res.me.z), 'bos');
    }
  }
  assert.ok(n >= 12, `${n} second hides played`);
  // (mostly he watches it go from where he found it)
  assert.ok(stepped <= n / 4, `${stepped} of ${n} stepped back first`);
});

test('hide-and-seek: right up at the bark on its side (where a child steering at its chatter ends up) he is by it; round the side he is not', () => {
  for (const c of HIDE_TREES) {
    const at = (ang: number): { x: number; z: number } => ({ x: c.x + Math.sin(ang) * (barkRadius(trunk(c), HIDE.h) + 0.1), z: c.z + Math.cos(ang) * (barkRadius(trunk(c), HIDE.h) + 0.1) });
    const hug = (ang: number): { x: number; z: number } => ({ x: c.x + Math.sin(ang) * trunkClear(c), z: c.z + Math.cos(ang) * trunkClear(c) });
    const near = (me: { x: number; z: number }, sqAng: number): boolean => dist(me, at(sqAng)) < HIDE.near && Math.abs(wrapA(headingTo(c, me) - sqAng)) < HIDE.nearAng;
    for (let a = -Math.PI; a < Math.PI; a += 0.3) {
      assert.ok(near(hug(a), a), `${c.id}: pressed against the bark in front of it`);
      assert.ok(near(hug(a + 0.4), a), `${c.id}: …or a little beside it`);
      assert.ok(!near(hug(a + Math.PI / 2), a), `${c.id}: a quarter round the trunk from it: not by it`);
    }
  }
});

/* ---------------------------------------------------- the lens, measured ---- */

const W = 1280, H = 800, FOV = 55;
type ViewSpec = {
  at: { x: number; z: number }; heading: number; halfW: number; halfD: number; tall: number; pitchDeg: number; insetTop: number; insetBottom: number;
  include?: readonly { x: number; z: number; h: number; r?: number }[];
};
/** The pure replica of `Stage.fitAt` for an anchored view (play/stage.ts), on a 1280×800
 *  screen (a copy of ree.view.test.ts's). */
function fitLens(f: ViewSpec): THREE.PerspectiveCamera {
  const tall = f.tall, pitch = (f.pitchDeg * Math.PI) / 180;
  const right = { x: -Math.cos(f.heading), z: Math.sin(f.heading) };
  const include = (f.include ?? []).flatMap((q) => ((q.r ?? 0) > 0 ? [-q.r!, q.r!].map((u) => ({ x: q.x + right.x * u, z: q.z + right.z * u, h: q.h })) : [q]));
  const fv = new THREE.Vector3(Math.sin(f.heading), 0, Math.cos(f.heading));
  const rv = new THREE.Vector3(-fv.z, 0, fv.x);
  const Pp = new THREE.Vector3(f.at.x, groundY(f.at.x, f.at.z), f.at.z);
  const yTop = 1 - (2 * (f.insetTop + 12)) / H, yBot = -1 + (2 * (f.insetBottom + 12)) / H, xLim = 1 - (24 / W) * 2;
  const pts: THREE.Vector3[] = [];
  for (const u of [-f.halfW, 0, f.halfW]) for (const v of [-f.halfD, f.halfD]) {
    const g = Pp.clone().addScaledVector(rv, u).addScaledVector(fv, v);
    g.y = groundY(g.x, g.z);
    pts.push(g, g.clone().setY(g.y + tall));
  }
  const inc: THREE.Vector3[] = [];
  for (const t of include) {
    const g = new THREE.Vector3(t.x, groundY(t.x, t.z), t.z);
    pts.push(g, g.clone().setY(g.y + t.h));
    inc.push(g.clone().setY(g.y + t.h * 0.5));
  }
  const cam = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 400);
  const dir = fv.clone().multiplyScalar(Math.cos(pitch)).setY(-Math.sin(pitch));
  const ndc = new THREE.Vector3();
  let best: { cam: THREE.Vector3; look: THREE.Vector3 } | null = null;
  for (let d = 3; d <= 16 && !best; d += 0.2) {
    let lift = tall * 0.35;
    for (let k = 0; k < 4; k++) {
      const look = Pp.clone().setY(Pp.y + lift);
      cam.position.copy(look).addScaledVector(dir, -d);
      if (inc.some((q) => q.clone().sub(cam.position).dot(dir) < 1.6)) break;
      cam.up.set(0, 1, 0); cam.lookAt(look); cam.updateMatrixWorld(true);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of pts) { ndc.copy(p).project(cam); minX = Math.min(minX, ndc.x); maxX = Math.max(maxX, ndc.x); minY = Math.min(minY, ndc.y); maxY = Math.max(maxY, ndc.y); }
      if (minX >= -xLim && maxX <= xLim && minY >= yBot && maxY <= yTop) { best = { cam: cam.position.clone(), look }; break; }
      lift += ((minY + maxY) / 2 - (yTop + yBot) / 2) * d * Math.tan((FOV * Math.PI) / 360);
    }
  }
  if (!best) { const look = Pp.clone().setY(Pp.y + tall * 0.35); best = { cam: look.clone().addScaledVector(dir, -16), look }; }
  best.cam.y = Math.max(best.cam.y, groundY(best.cam.x, best.cam.z) + 1.4);
  cam.position.copy(best.cam); cam.up.set(0, 1, 0); cam.lookAt(best.look); cam.updateMatrixWorld(true);
  return cam;
}
/** Screen px of a world point (y up from the ground at x/z). */
function px(cam: THREE.PerspectiveCamera, p: { x: number; z: number }, up: number): { x: number; y: number; behind: boolean } {
  const v = new THREE.Vector3(p.x, groundY(p.x, p.z) + up, p.z);
  const behind = v.clone().applyMatrix4(cam.matrixWorldInverse).z > 0;
  v.project(cam);
  return { x: (v.x + 1) * 0.5 * W, y: (1 - v.y) * 0.5 * H, behind };
}

test('the found view: on his side of the tree, him whole at one side, the squirrel big at the other, no pine between', () => {
  let n = 0;
  const check = (rid: string, c: HomeTree, sqAng: number, at: { x: number; z: number }): void => {
    n += 1;
    const face0 = foundFace(c, sqAng, at);
    // (found from further off, he takes a few calm steps nearer first; never into a trunk)
    const me = foundStand(c, face0, at);
    for (const t of HOME_TREES) assert.ok(segDist(t, at, me) > trunkClear(t) - 0.35 || dist(at, me) < 0.01, `${rid}: his steps nearer clear ${t.id}`);
    const face = foundFace(c, sqAng, me);
    assert.ok(Math.abs(wrapA(face - sqAng)) < 1.6, `${rid}: it comes out a short way round from where it was`);
    // (a play with the rare young one frames the view that holds it too: the same rules)
    for (const young of [false, true]) {
    const f = foundView(c, face, me, young);
    const cam = fitLens(f);
    const rr = barkRadius(trunk(c), HIDE.h) + 0.08;
    const sq = { x: c.x + Math.sin(face) * rr, z: c.z + Math.cos(face) * rr };
    const camD = Math.hypot(cam.position.x - sq.x, cam.position.z - sq.z);
    assert.ok(camD >= 2.4 && camD <= 5.0, `${rid}: the lens ${camD.toFixed(2)} m from the squirrel`);
    const camUp = cam.position.y - groundY(cam.position.x, cam.position.z);
    assert.ok(camUp >= 1.0 && camUp <= 2.2, `${rid}: the lens at ${camUp.toFixed(2)} m, about its height`);
    // turned off the line from him to it (his head not in front of it)
    const off = Math.abs(wrapA(headingTo(cam.position, sq) - headingTo(me, sq)));
    assert.ok(off >= (15 * Math.PI) / 180, `${rid}: the lens ${deg(off)}° off his line to it`);
    // big: its 0.33 m (with its tail) at least 60 px tall, in the picture, off the middle
    const top = px(cam, sq, HIDE.h + 0.33), bot = px(cam, sq, HIDE.h);
    assert.ok(!top.behind && Math.abs(bot.y - top.y) >= 60, `${rid}${young ? ' (young)' : ''}: it is ${Math.abs(bot.y - top.y).toFixed(1)} px tall (him ${dist(me, sq).toFixed(1)} m from it; turn ${deg(Math.abs(wrapA(f.heading - headingTo(me, sq))))}°, lens ${camD.toFixed(2)} m)`);
    assert.ok(top.x > 40 && top.x < W - 40 && top.y > 110 && bot.y < H - 80, `${rid}: it is in the picture (${top.x.toFixed(0)}, ${top.y.toFixed(0)})`);
    assert.ok(Math.abs(top.x - W / 2) >= 0.2 * (W / 2), `${rid}: well off the middle (${top.x.toFixed(0)} px; turn ${deg(Math.abs(wrapA(f.heading - headingTo(me, sq))))}°, him ${dist(me, sq).toFixed(1)} m, sqAng ${sqAng.toFixed(2)})`);
    // him: whole in the picture, no pine of the home between the lens and him or it
    const head = px(cam, me, RANGER_STAND_HEIGHT), foot = px(cam, me, 0.05);
    assert.ok(!head.behind && head.x > 20 && head.x < W - 20 && head.y > 90 && foot.y < H, `${rid}: he is in the picture (${head.x.toFixed(0)}, ${head.y.toFixed(0)}–${foot.y.toFixed(0)})`);
    for (const t of HOME_TREES) {
      const g0 = groundY(t.x, t.z);
      const bark: Upright[] = [{ ...trunkUpright(trunk(t), g0), r: (y: number) => barkRadius(trunk(t), Math.max(0, y - g0)) }];
      assert.ok(lineClear(cam.position, { ...me, y: groundY(me.x, me.z) + 1.0 }, bark), `${rid}: ${t.id} is not in front of him`);
      if (t !== c) assert.ok(lineClear(cam.position, { ...sq, y: groundY(sq.x, sq.z) + HIDE.h + 0.12 }, bark), `${rid}: ${t.id} is not in front of the squirrel`);
    }
    assert.ok(lineClear(cam.position, { ...sq, y: groundY(sq.x, sq.z) + HIDE.h + 0.12 }, [{ ...trunkUpright(trunk(c), groundY(c.x, c.z)), r: (y: number) => barkRadius(trunk(c), Math.max(0, y - groundY(c.x, c.z))) }]), `${rid}: its own trunk is not in front of it`);
    }
  };
  for (const rid of ROUTE_IDS) {
    const c = ROUTES[rid].hide;
    const from = headingTo(c, comesFrom(ROUTES[rid], ROUTES[rid].waits.length - 1));
    // where a perfect player finds it…
    for (let k = -6; k <= 6; k += 3) for (const d of [1.8, 2.6, 3.4]) {
      const start = { x: c.x + Math.sin(from + k * 0.17) * d, z: c.z + Math.cos(from + k * 0.17) * d };
      if (dist(start, seatOf(c)) > SEE_D || HOME_TREES.some((o) => dist(o, start) < trunkClear(o))) continue;
      const res = playHide(c, start, `${rid} found view`);
      if (res.found) check(rid, c, res.sqAng, res.me);
    }
    // …and anywhere on its side, near or as far as he may find it from (run 7, ek-day: round
    // its second hide pine too)
    for (const t of [c, SECOND_HIDE[rid]]) for (let a = -Math.PI; a < Math.PI; a += Math.PI / 6) for (const d of [1.2, 2.2, 3.2, FIND_R]) {
      const me = { x: t.x + Math.sin(a + 0.5) * d, z: t.z + Math.cos(a + 0.5) * d };
      if (HOME_TREES.some((o) => dist(o, me) < trunkClear(o))) continue;
      check(`${rid}/${t.id}`, t, a, me);
    }
  }
  assert.ok(n >= 60, `${n} finds framed`);
});

test('after a find (ek-day, review r1): he turns toward its glade and its run from the bark to its stump plays in his picture — it starts in it and never comes at the lens', () => {
  let n = 0, stepped = 0, feet = 0, roomy = 0;
  const turns = [0, 0, 0]; // (≤ 45° off his way to the glade, ≤ 90°, more)
  const popPx: number[] = [], hiddenShare: number[] = [];
  const check = (id: string, c: HomeTree, sqAng: number, at: { x: number; z: number }): void => {
    // where the found view left him (a few calm steps nearer it, from further off) and the
    // side of the bark it peeks out on
    const me0 = foundStand(c, foundFace(c, sqAng, at), at);
    const face = foundFace(c, sqAng, me0);
    const run = foundRun(me0, face, c);
    n += 1;
    assert.ok(run.ok, `${id}: a turn whose picture holds its run to its stump`);
    const me = run.at;
    if (dist(me, me0) > 0) {
      stepped += 1;
      assert.ok(dist(me, me0) <= FOUND_RUN.steps[FOUND_RUN.steps.length - 1] + 1e-9, `${id}: a few calm steps at most`);
      for (const o of HOME_TREES) assert.ok(dist(o, me) >= trunkClear(o) && segDist(o, me0, me) >= trunkClear(o) - 0.15, `${id}: his steps clear ${o.id}`);
    }
    const way = headingTo(me, wayTo(me, P.stand));
    const off = Math.abs(wrapA(run.face - way));
    turns[off <= Math.PI / 4 ? 0 : off <= Math.PI / 2 ? 1 : 2] += 1;
    // the lens where the kit's behind() puts it, and the squirrel's REAL plan from there: down
    // the bark round to the side it comes off, off the bark, its dash to where it pops up,
    // and its dash on to its stump's foot and the hop up (squirrel.ts dashTo + toStumpPlan;
    // each dash bends round him and round the lens as it does in the game)
    const lens = { x: me.x - Math.sin(run.face) * LENS.back, z: me.z - Math.cos(run.face) * LENS.back };
    const tr = trunk(c);
    const rb = barkRadius(tr, HIDE.h) + 0.08;
    if (Math.hypot(c.x + Math.sin(face) * rb - lens.x, c.z + Math.cos(face) * rb - lens.z) >= FOUND_RUN.roomy) roomy += 1;
    const avoid = { x: me.x, z: me.z, r: 1.6 };
    const rnd = (): number => 0.5;
    const last = (p: readonly Segment[]): SqPose => p[p.length - 1].at(1);
    const plan: Segment[] = [...climbPlan(tr, { ang: face, h: HIDE.h }, { ang: run.side, h: 0.25 }, 0), ...dismountPlan(tr, { ang: run.side, h: 0.25 })];
    const atFoot = plan.length;
    plan.push(...dashPlan(last(plan), run.pop.x, run.pop.z, rnd, lens, avoid));
    const atPop = plan.length;
    // (its dash to the pop, through the lens: how much of it is behind his body or a trunk)
    {
      // (heights over the ground, as `hiders` and `lensSees` measure them)
      const eye = { x: lens.x, y: LENS.up, z: lens.z };
      const ups = hiders(eye, me);
      const pts = plan.slice(atFoot).filter((s) => s.act === 'run').flatMap((s) => { const k = Math.max(2, Math.ceil(s.len / 0.1)); return Array.from({ length: k }, (_, i) => s.at((i + 0.5) / k)); });
      const hid = pts.filter((q) => !lineClear(eye, { x: q.x, y: 0.15, z: q.z }, ups)).length;
      hiddenShare.push(pts.length ? hid / pts.length : 0);
    }
    const g = last(plan);
    const ds = dist(g, STUMP);
    const sf = { x: STUMP.x + ((g.x - STUMP.x) / ds) * (STUMP.r + 0.3), z: STUMP.z + ((g.z - STUMP.z) / ds) * (STUMP.r + 0.3) };
    plan.push(...dashPlan(g, sf.x, sf.z, rnd, lens, avoid));
    const poses = plan.flatMap((s) => { const k = Math.max(2, Math.ceil(s.len / 0.1)); return Array.from({ length: k + 1 }, (_, i) => s.at(i / k)); });
    // it starts in his picture: on the bark, well inside it, under the line card
    const p0 = poses[0];
    const s0 = followPx(me, run.face, { x: p0.x, y: groundY(p0.x, p0.z) + p0.alt + 0.12, z: p0.z });
    assert.ok(s0.inside && s0.x > 0.1 * W && s0.x < 0.9 * W && s0.y > 110 && s0.y < H - 70, `${id}: it starts in his picture (${s0.x.toFixed(0)}, ${s0.y.toFixed(0)})`);
    // its distance to the lens never shrinks by more than a little (the pour off the bark)
    let far = -Infinity;
    for (const q of poses) {
      const dq = Math.hypot(q.x - lens.x, q.z - lens.z);
      assert.ok(dq >= far - 0.3, `${id}: it never comes at the lens (${dq.toFixed(2)} m after ${far.toFixed(2)})`);
      far = Math.max(far, dq);
    }
    // (over the ground, off the bark: never by his feet, never through a trunk; to the pop and
    // its first steps on, above the picture's bottom edge)
    for (const sgm of plan.slice(atFoot, atPop)) for (let u = 0; u <= 1; u += 0.25) {
      const q = sgm.at(u), s1 = followPx(me, run.face, { x: q.x, y: groundY(q.x, q.z) + 0.1, z: q.z });
      assert.ok(s1.inside && s1.y <= H - 90, `${id}: it runs off the bark in his picture, off its bottom edge (${s1.x.toFixed(0)}, ${s1.y.toFixed(0)})`);
    }
    for (const sgm of plan.slice(atFoot)) for (let u = 0; u <= 1; u += 0.1) {
      const q = sgm.at(u);
      assert.ok(dist(q, me) >= 1.1, `${id}: never by his feet (${dist(q, me).toFixed(2)} m)`);
      for (const o of HOME_TREES) assert.ok(dist(q, o) >= barkRadius(trunk(o), 0) + 0.1, `${id}: never through ${o.id} (${dist(q, o).toFixed(2)} m)`);
    }
    // where it sits up facing him: in his picture, off his body, big enough to read
    const pp = followPx(me, run.face, { x: run.pop.x, y: groundY(run.pop.x, run.pop.z) + 0.15, z: run.pop.z });
    assert.ok(pp.inside && pp.x > 0.1 * W && pp.x < 0.9 * W && pp.y < H - 60, `${id}: it pops up in his picture (${pp.x.toFixed(0)}, ${pp.y.toFixed(0)})`);
    assert.ok(Math.abs(pp.x - W / 2) > 60, `${id}: …beside him, not behind his body (${pp.x.toFixed(0)})`);
    popPx.push(pxAt(0.33, pp.d));
    // (at the foot of its own pine, where it comes off the bark, or out on the ground)
    const popFoot = Math.abs(dist(c, run.pop) - (barkRadius(trunk(c), 0) + 0.35)) < 1e-6;
    if (popFoot) feet += 1;
    for (const o of HOME_TREES) if (!(popFoot && o === c)) assert.ok(dist(o, run.pop) >= trunkOutline(trunk(o), 0.15) + 0.35, `${id}: not on ${o.id}'s root spurs`);
    assert.equal(biomeAt(run.pop.x, run.pop.z), 'bos');
  };
  for (const rid of ROUTE_IDS) {
    // where a perfect player finds it…
    const c = ROUTES[rid].hide;
    const from = headingTo(c, comesFrom(ROUTES[rid], ROUTES[rid].waits.length - 1));
    for (let k = -6; k <= 6; k += 3) for (const d of [1.8, 2.6, 3.4]) {
      const start = { x: c.x + Math.sin(from + k * 0.17) * d, z: c.z + Math.cos(from + k * 0.17) * d };
      if (dist(start, seatOf(c)) > SEE_D || HOME_TREES.some((o) => dist(o, start) < trunkClear(o))) continue;
      const res = playHide(c, start, `${rid} run`);
      if (res.found) check(`${rid}/${c.id} played ${k}/${d}`, c, res.sqAng, res.me);
    }
  }
  // …and all round each pine it hides round (the second hide's too), near or as far as he
  // may find it from
  for (const t of ALL_HIDE_TREES) for (let a = -Math.PI; a < Math.PI; a += Math.PI / 12) for (const d of [1.2, 2.2, 3.2, FIND_R]) {
    const at = { x: t.x + Math.sin(a + 0.5) * d, z: t.z + Math.cos(a + 0.5) * d };
    if (HOME_TREES.some((o) => dist(o, at) < trunkClear(o))) continue;
    check(`${t.id} ${deg(a)}°/${d}`, t, a, at);
  }
  assert.ok(n >= 250, `${n} finds`);
  // (mostly he turns from where he stands; mostly toward the glade)
  // (a few calm steps back first where its pine would stand by the lens: about one find in three)
  assert.ok(stepped <= n / 3, `${stepped} of ${n} stepped first`);
  assert.ok(roomy >= n * 0.95, `its pine ${FOUND_RUN.roomy} m from the lens or more in ${roomy} of ${n}`);
  assert.ok(turns[2] <= n / 6, `turns off his way to the glade: ${turns.join(' / ')} (≤45° / ≤90° / more)`);
  popPx.sort((a, b) => a - b);
  console.log(`after a find: ${n} finds, ${stepped} stepped, ${roomy} roomy, ${feet} sit up at its pine's foot, turns ${turns.join('/')}, pop ${popPx[0].toFixed(0)}-${popPx[popPx.length - 1].toFixed(0)} px (median ${popPx[popPx.length >> 1].toFixed(0)})`);
  assert.ok(popPx[0] >= 30 && popPx[popPx.length >> 1] >= 37, `it pops up big enough to read (smallest ${popPx[0].toFixed(0)} px, median ${popPx[popPx.length >> 1].toFixed(0)})`);
  // (the places pick at most a fifth of its way; by time, its bursts easing in and out, a little more)
  assert.ok(Math.max(...hiddenShare) <= 0.3, `he sees it run to where it pops up (at most ${(Math.max(...hiddenShare) * 100).toFixed(0)}% of its dash's time behind his body or a trunk)`);
});

test('the den (ek-day): every opening stands in the den look, big and whole — on its stub, head down under it, nibbling at the pine\'s foot', () => {
  const den = TREE.oak, tr = trunk(den), g0 = groundY(den.x, den.z);
  const report: string[] = [];
  for (const id of ROUTE_IDS) for (const [dx, dz] of [[0, 0], [1.2, 0.6], [-1, 0.8], [0.6, -1.4], [-1.3, -0.9]]) {
    const me = { x: MARKER.x + dx, z: MARKER.z + dz };
    for (const kind of ['tak', 'omlaag', 'voet'] as const) {
      const base = introView(me, ROUTES[id].waits[0]);
      const lens0 = fitLens(base);
      const spot = denSpot({ x: lens0.position.x, z: lens0.position.z }, me);
      const view = kind === 'voet' ? introView(me, ROUTES[id].waits[0], DEN_DAY.footTall, spot.foot) : base;
      const cam = fitLens(view);
      // where it is: its feet and its head (m up)
      let at: { x: number; z: number }, lo: number, hi: number;
      if (kind === 'tak') { at = seatOf(den); lo = den.branch!.h; hi = lo + 0.33; }
      else if (kind === 'omlaag') {
        const r = barkRadius(tr, spot.down.h) + 0.12;
        at = { x: den.x + Math.sin(spot.down.ang) * r, z: den.z + Math.cos(spot.down.ang) * r }; hi = spot.down.h + 0.05; lo = hi - 0.33;
      } else { at = spot.foot; lo = 0; hi = 0.3; }
      const top = px(cam, at, hi), bot = px(cam, at, lo);
      const tall = Math.abs(bot.y - top.y);
      report.push(`${id}/${dx},${dz}/${kind}: ${tall.toFixed(0)} px at (${top.x.toFixed(0)}, ${top.y.toFixed(0)})`);
      assert.ok(!top.behind && tall >= 60, `${id} ${dx},${dz} ${kind}: ${tall.toFixed(0)} px in the den look`);
      assert.ok(top.x > 60 && top.x < W - 60 && top.y > 110 && bot.y < H - 60, `${id} ${dx},${dz} ${kind}: in the picture (${top.x.toFixed(0)}, ${top.y.toFixed(0)}–${bot.y.toFixed(0)})`);
      // no trunk in front of it (its own pine only behind it), not his head
      const mid = { ...at, y: groundY(at.x, at.z) + (lo + hi) / 2 };
      for (const t of HOME_TREES) {
        const tg = groundY(t.x, t.z);
        const bark: Upright[] = [{ ...trunkUpright(trunk(t), tg), r: (y: number) => barkRadius(trunk(t), Math.max(0, y - tg)) }];
        assert.ok(lineClear(cam.position, mid, bark), `${id} ${dx},${dz} ${kind}: ${t.id} is not in front of it`);
      }
      const head = [{ x: me.x, z: me.z, y0: groundY(me.x, me.z), y1: groundY(me.x, me.z) + RANGER_STAND_HEIGHT * 1.05, r: () => 0.22 }];
      assert.ok(lineClear(cam.position, mid, head), `${id} ${dx},${dz} ${kind}: his head is not in front of it`);
      // at the foot: on dry needles, clear of the den's root spurs and of the ring he stands in
      if (kind === 'voet') {
        assert.ok(dist(at, den) >= Math.max(trunkOutline(tr, 0), barkRadius(tr, 0)) + 0.15, `${kind}: past the root spurs`);
        assert.ok(dist(at, me) > 1.2, `${id} ${dx},${dz} ${kind}: not at his feet (${dist(at, me).toFixed(2)} m; foot ${dist(at, den).toFixed(2)} m from the axis, ${(headingTo(den, at) - headingTo(den, me)).toFixed(2)} rad round from him)`);
      }
    }
  }
  void g0;
  console.log(report.filter((_, i) => i % 5 === 0).join('\n'));
});

test('the ending (ek-day): it buries its last acorn beside its stump, in the callers\' picture, never toward the lens, off the store, the jay and the caching spots', () => {
  const cam = fitLens(CALLERS_VIEW);
  const lens = { x: cam.position.x, z: cam.position.z };
  const ds = dist(BURY_AT, STUMP);
  assert.ok(ds >= 0.55 && ds <= 1.1, `beside the stump (${ds.toFixed(2)} m)`);
  for (const h of HEAP_SPOTS) assert.ok(dist(h, BURY_AT) >= 0.55, 'off its store');
  for (const j of [...JAY_RETREAT, JAY_GROUND]) assert.ok(dist(j, BURY_AT) >= 0.6, 'off the jay\'s way');
  assert.ok(dist(TREE.storePine, BURY_AT) >= 0.95, 'off the store pine');
  for (const sym of FIELD_SYMS) for (const s of gladeSpots(sym)) assert.ok(dist(s, BURY_AT) >= 0.55, `off the caching spot ${sym}/${s.id}`);
  // from its stump top across the picture and a little away from the lens, never toward it
  assert.ok(dist(BURY_AT, lens) >= dist(STUMP, lens) - 0.05, 'never toward the lens');
  const top = px(cam, BURY_AT, 0.33), bot = px(cam, BURY_AT, 0);
  assert.ok(!top.behind && top.x > 100 && top.x < W - 100 && top.y > 140 && bot.y < H - 100, `in the picture (${top.x.toFixed(0)}, ${top.y.toFixed(0)}–${bot.y.toFixed(0)})`);
  assert.ok(Math.abs(bot.y - top.y) >= 50, `big enough (${Math.abs(bot.y - top.y).toFixed(0)} px)`);
  // the stump is not in front of it (seen past its side)
  const g0 = groundY(STUMP.x, STUMP.z);
  assert.ok(lineClear(cam.position, { ...BURY_AT, y: groundY(BURY_AT.x, BURY_AT.z) + 0.15 }, [{ x: STUMP.x, z: STUMP.z, y0: g0, y1: g0 + STUMP.h, r: () => STUMP.r }]), 'not behind the stump');
  assert.equal(biomeAt(BURY_AT.x, BURY_AT.z), 'bos');
});

test('the surprises (ek-day): the jay\'s cache lies ahead of him and beside his way into the glade, wherever he found the squirrel; it flies off away from him', () => {
  const spots = FIELD_SYMS.flatMap((sym) => gladeSpots(sym));
  for (const rid of ROUTE_IDS) {
    const J = JAY_CACHE[rid];
    assert.equal(biomeAt(J.x, J.z), 'bos');
    for (const t of HOME_TREES) assert.ok(dist(t, J) > trunkClear(t) + 0.5, `${rid}: off ${t.id}`);
    for (const q of spots) assert.ok(dist(q, J) >= 1.0, `${rid}: off the caching spots`);
    for (const q of [STUMP, SNAG, ...HEAP_SPOTS, ...JAY_RETREAT]) assert.ok(dist(q, J) >= 1.0, `${rid}: off the store, the snag and the jay's own way back`);
    for (const d of DINING) assert.ok(dist(d, J) >= 1.5, `${rid}: off the dining spot ${d.id}`);
    assert.ok(dist(J, P.stand) >= 2.4, `${rid}: before the glade's stand`);
    // (from where he may have found the squirrel: round its hide pine, and round the second
    // one — but the south way's, whose plays never bring the jay's cache: drawDay)
    for (const t of rid === 'zuid' ? [ROUTES[rid].hide] : [ROUTES[rid].hide, SECOND_HIDE[rid]]) {
      let ok = 0, n = 0;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) for (const d of [1.6, 2.1, 2.6]) {
        const st = { x: t.x + Math.sin(a) * d, z: t.z + Math.cos(a) * d };
        if (HOME_TREES.some((o) => dist(o, st) < trunkClear(o))) continue;
        n += 1;
        const dd = dist(st, J), off = Math.abs(wrapA(headingTo(st, J) - headingTo(st, P.stand)));
        // (ahead of him as he sets off, beside his way, so that he walks up past it — where it
        // acts in his picture is the next test's; its flight up to the glade oak across his
        // picture or away from him, never back at him: jayFliesAway)
        const pass = segDist(J, st, P.stand);
        if (dd >= 3.5 && dd <= 8.5 && off <= (45 * Math.PI) / 180 && pass >= 1.1 && pass <= 3.0 && jayFliesAway(st, J)) ok += 1;
      }
      assert.ok(ok / n >= 0.7, `${rid}: ahead of him and beside his way from ${ok} of ${n} places round ${t.id}`);
    }
  }
});

test('the surprises (ek-day, review r1): the jay buries its acorn where he sees it — big, in the middle of his picture, the squirrel\'s run to its stump well away from it — from wherever he found the squirrel', () => {
  const edge = (1 - JAY_SEE.mid) / 2;
  let n = 0, opened = 0, apart = 0;
  const pxs: number[] = [];
  for (const rid of ROUTE_IDS) {
    const J = JAY_CACHE[rid];
    for (const t of rid === 'zuid' ? [ROUTES[rid].hide] : [ROUTES[rid].hide, SECOND_HIDE[rid]]) {
      for (let a = -Math.PI; a < Math.PI; a += Math.PI / 12) for (const d of [1.2, 2.2, 3.2, FIND_R]) {
        const at = { x: t.x + Math.sin(a + 0.5) * d, z: t.z + Math.cos(a + 0.5) * d };
        if (HOME_TREES.some((o) => dist(o, at) < trunkClear(o))) continue;
        n += 1;
        // where he stands as it runs off (foundRun), and its real way to its stump
        const me0 = foundStand(t, foundFace(t, a, at), at);
        const face = foundFace(t, a, me0);
        const run = foundRun(me0, face, t);
        const way = foundRunPath(run.at, t, face, run.side, run.pop, lensBehind(run.at, run.face)).pts;
        if (Math.min(...way.map((q) => dist(q, J))) >= JAY_SEE.apart) apart += 1;
        // his walk to the glade (a perfect player: straight along the hint's way, 0.1 m a
        // step, the follow lens behind him): its window opens before he is `close` m from it
        let me = { ...run.at };
        for (let s = 0; s < 150 && dist(me, P.stand) > 1.6; s++) {
          const h = headingTo(me, wayTo(me, P.stand));
          me = { x: me.x + Math.sin(h) * 0.1, z: me.z + Math.cos(h) * 0.1 };
          if (dist(me, J) < JAY_SEE.close) break;
          const g = groundY(J.x, J.z);
          const b = followBox(me, h, new THREE.Box3(new THREE.Vector3(J.x - 0.05, g, J.z - 0.05), new THREE.Vector3(J.x + 0.05, g + JAY_SEE.h, J.z + 0.05)));
          if (b.px >= JAY_SEE.px && Math.abs(b.cx) <= JAY_SEE.mid && Math.abs(b.cx) >= JAY_SEE.body && b.cy >= H * edge && b.cy <= H * (1 - edge) && jayFliesAway(me, J)) {
            opened += 1; pxs.push(b.px);
            break;
          }
        }
      }
    }
  }
  console.log(`the jay's window: opens on ${opened} of ${n} walks in, the squirrel's run ≥ ${JAY_SEE.apart} m off it on ${apart}`);
  assert.ok(opened / n >= 0.95, `its window opens on his walk in (${opened} of ${n})`);
  assert.ok(apart / n >= 0.75, `the squirrel's run to its stump keeps away from it (${apart} of ${n})`);
  assert.ok(Math.min(...pxs) >= JAY_SEE.px, 'big enough');
  // (≈ 8 m from the lens at most: 3-3.5 m ahead of him)
  assert.ok(pxAt(JAY_SEE.h, 8.3) < JAY_SEE.px && pxAt(JAY_SEE.h, 8.0) >= JAY_SEE.px, `${JAY_SEE.px} px is a ${JAY_SEE.h} m jay about 8 m from the lens`);
});

test('the surprises (ek-day): a pine cone drops from the pine he walks up to, in front of its trunk beside his way, away from the squirrel — its fall plays in his picture and it lies big enough to read', () => {
  let n = 0, walks = 0, walkDrops = 0;
  const falls: number[] = [], sizes: number[] = [];
  const T = Math.sqrt((2 * CONE_FALL.from) / CONE_FALL.g);
  for (const rid of ROUTE_IDS) for (const t of ROUTES[rid].waits) {
    const seat = seatOf(t);
    // (he walks straight up to it from all round: somewhere on the way, at a frame's step, it drops)
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
      const from = { x: t.x + Math.sin(a) * 6, z: t.z + Math.cos(a) * 6 };
      if (HOME_TREES.some((o) => o !== t && segDist(o, from, t) < trunkClear(o))) continue;
      walks += 1;
      let me = { ...from }, c: { x: number; z: number } | null = null;
      for (let s = 0; s < 40 && !c && dist(me, t) > 2.6; s++) {
        const h = headingTo(me, t);
        me = { x: me.x + Math.sin(h) * 0.1, z: me.z + Math.cos(h) * 0.1 };
        c = coneDrop(me, t);
      }
      if (!c) continue;
      walkDrops += 1; n += 1;
      const id = `${rid}/${t.id} from ${deg(a)}°`;
      const h = headingTo(me, t);
      const r = dist(c, t);
      assert.ok(r >= 1.45 && r <= 2.15, `${id}: in front of its trunk, under its crown (${r.toFixed(2)} m)`);
      assert.ok(dist(c, me) < dist(t, me), `${id}: on his side of the trunk`);
      assert.ok(segDist(c, me, t) >= CONE_DROP.beside, `${id}: beside his way, never on it`);
      assert.ok(dist(c, me) >= 1.5, `${id}: never on him`);
      assert.ok(dist(c, seat) >= CONE_DROP.seat, `${id}: away from the squirrel's stub`);
      for (const o of HOME_TREES) assert.ok(dist(o, c) >= CONE_DROP.clear, `${id}: not on ${o.id}'s root spurs`);
      assert.equal(biomeAt(c.x, c.z), 'bos');
      // through the follow lens behind him at the drop: where it starts is out of sight (over the
      // picture's top, or under the line card), its last CONE_FALL.see s at least fall inside
      // the picture, clear of his body and of the squirrel on its stub, and it lies big enough
      const g = groundY(c.x, c.z);
      const start = followPx(me, h, { x: c.x, y: g + CONE_FALL.from, z: c.z });
      assert.ok(start.y <= 92, `${id}: it starts out of sight (${start.y.toFixed(0)} px from the top)`);
      const sq = followPx(me, h, { x: seat.x, y: groundY(seat.x, seat.z) + WAIT_H + 0.15, z: seat.z });
      let seen = 0;
      for (let u = 0; u <= T; u += 0.01) {
        const q = followPx(me, h, { x: c.x, y: g + CONE_FALL.from - (CONE_FALL.g * u * u) / 2, z: c.z });
        if (!q.inside || q.y < 96) { assert.equal(seen, 0, `${id}: once in his picture it stays in it`); continue; }
        seen += 0.01;
        assert.ok(Math.abs(q.x - W / 2) >= 80, `${id}: clear of his body (${q.x.toFixed(0)} px)`);
        assert.ok(Math.hypot(q.x - sq.x, q.y - sq.y) >= 70, `${id}: clear of the squirrel (${Math.hypot(q.x - sq.x, q.y - sq.y).toFixed(0)} px)`);
      }
      falls.push(seen);
      assert.ok(seen >= CONE_FALL.see, `${id}: its fall is in his picture ${seen.toFixed(2)} s`);
      const land = followPx(me, h, { x: c.x, y: g + 0.07, z: c.z });
      assert.ok(land.inside && land.y > 200 && land.y < H - 120, `${id}: it lands in the middle of his picture (${land.y.toFixed(0)})`);
      const size = pxAt(CONE_DROP.len, land.d);
      sizes.push(size);
      assert.ok(size >= CONE_DROP.px, `${id}: it lies ${size.toFixed(0)} px long`);
    }
  }
  console.log(`the cone: drops on ${walkDrops} of ${walks} walks up to a wait; its fall seen ${Math.min(...falls).toFixed(2)}-${Math.max(...falls).toFixed(2)} s; ${Math.min(...sizes).toFixed(0)}-${Math.max(...sizes).toFixed(0)} px where it lies`);
  assert.ok(walkDrops / walks >= 0.85, `a cone drops on ${walkDrops} of ${walks} walks up to a wait`);
  assert.equal(coneDrop({ x: ROUTES.midden.waits[0].x + 9, z: ROUTES.midden.waits[0].z }, ROUTES.midden.waits[0]), null, 'not from far off');
  assert.ok(n > 60, `${n} drops`);
});

test('the den look turns to the side the squirrel will lead him', () => {
  for (const id of ROUTE_IDS) {
    const v = introView(MARKER, ROUTES[id].waits[0]);
    assert.ok(Math.abs(v.heading - headingTo(MARKER, v.at)) > 0.5, `${id}: the den look stands off his line to it`);
  }
});

/* ------------------------------------------------------------- the glade ---- */

test('the glade: seven look-alike spots in the PRINT_SPOTS layout, uniformly scaled, all in one view, in every mirror-image', () => {
  for (const sym of FIELD_SYMS) {
    const s = gladeSpots(sym);
    assert.equal(s.length, PRINT_SPOTS.length);
    const d2 = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);
    for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) {
      // the same distances as the 2D floor's field: the same pattern to remember
      assert.ok(Math.abs(dist(s[i], s[j]) / d2(PRINT_SPOTS[i], PRINT_SPOTS[j]) - SPOT_SCALE) < 1e-9, `${sym}: one scale for the whole layout`);
      assert.ok(dist(s[i], s[j]) > SPOT_SIZE + 0.4, `${sym}: spots ${i} and ${j} stand apart`);
    }
    // from the stand, every spot lies ahead within ±50° (the held view takes them all in)
    for (const p of s) {
      const l = toLocal({ x: P.stand.x, z: P.stand.z, heading: P.stand.heading! }, p);
      assert.ok(l.v > 0.6 && Math.abs(Math.atan2(l.u, l.v)) < (50 * Math.PI) / 180, `${sym}: spot ${p.id} is ahead in the view`);
      // in the held view's picture, clear of its edges and the line card
      const cam = fitLens(GLADE_VIEW);
      const q = px(cam, p, 0.05);
      assert.ok(q.x > 40 && q.x < W - 40 && q.y > 120 && q.y < H - 30, `${sym}: spot ${p.id} is in the picture (${q.x.toFixed(0)}, ${q.y.toFixed(0)})`);
      // off the stump and the heap
      assert.ok(dist(p, STUMP) > 0.7 + STUMP.r && dist(p, HEAP) > 0.7, `${sym}: spot ${p.id} keeps off the stump and the heap`);
      // the seedling grows in the glade, off every spot (not where an acorn was dug up)
      assert.ok(dist(SEEDLING_AT, p) > SPOT_SIZE, `${sym}: the seedling is off the spots`);
      // no fern grows through a spot
      assert.ok(eekhoornClearings().some((c) => dist(c, p) < 0.01 && c.r >= SPOT_SIZE), `${sym}: spot ${p.id} is kept bare`);
    }
  }
  assert.ok(new Set(FIELD_SYMS.map((s) => gladeSpots(s).map((p) => `${p.x.toFixed(2)}:${p.z.toFixed(2)}`).join())).size === 4, 'four different patterns on the floor');
  assert.ok(dist(SEEDLING_AT, P.glade) < 3, 'the seedling is in the glade');
  assert.ok(GLADE_VIEW.include.some((q) => dist(q, P.stand) < 1e-9));
});

test('the stands are clear: no trunk, no spot, no stump under the ranger', () => {
  for (const st of [P.stand, P.callers]) {
    for (const t of HOME_TREES) assert.ok(dist(st, t) > barkRadius(trunk(t), 0) + 1, 'off every trunk');
    for (const sym of FIELD_SYMS) for (const p of gladeSpots(sym)) assert.ok(dist(st, p) > 0.9, 'off every spot');
    assert.ok(dist(st, STUMP) > STUMP.r + 1, 'off the stump');
  }
});

/* ------------------------------------------------------- the neighbours ---- */

test('every trio of neighbours: four different calls, one bird per slot, never the two that sound alike', () => {
  const trios = legalTrios();
  assert.equal(trios.length, 16, `${trios.length} trios`);
  for (const t of trios) {
    const fam = [SQUIRREL_FAMILY, ...SLOTS.map((s) => NEIGHBOURS.find((n) => n.id === t[s])!.family)];
    assert.equal(new Set(fam).size, 4, `${trioCode(t)}: four kinds of call`);
    for (const s of SLOTS) assert.equal(NEIGHBOURS.find((n) => n.id === t[s])!.slot, s);
    for (const [a, b] of NOT_TOGETHER) assert.ok(!(Object.values(t).includes(a) && Object.values(t).includes(b)));
    assert.deepEqual(trioOf(trioCode(t)), t, 'its code reads back');
  }
  assert.ok(trios.some((t) => SLOTS.every((s) => t[s] === FIRST_TRIO[s])), 'the free world\'s trio is a legal one');
  for (const n of NEIGHBOURS) assert.ok(trios.some((t) => t[n.slot] === n.id), `${n.id} comes in some play`);
});

test('the callers\' picture: the squirrel, every slot\'s bird and the jay all in it, none behind a trunk, each a clear click apart', () => {
  const cam = fitLens(CALLERS_VIEW);
  const eye = { x: P.callers.x, y: 1.25, z: P.callers.z };
  const tall = Math.max(...NEIGHBOURS.map((n) => n.h));
  const spots: { id: string; x: number; z: number; y: number; h: number }[] = [
    { id: 'eekhoorn', x: STUMP.x, z: STUMP.z, y: STUMP.top, h: 0.25 },
    ...SLOTS.map((s) => ({ id: s, ...PERCH[s], h: Math.min(...NEIGHBOURS.filter((n) => n.slot === s).map((n) => n.h)) })),
  ];
  for (const p of spots) {
    const q = px(cam, p, p.y + p.h / 2);
    assert.ok(!q.behind && q.x > 30 && q.x < W - 30 && q.y > 70 && q.y < H - 120, `${p.id} is in the picture, clear of the line card (${q.x.toFixed(0)}, ${q.y.toFixed(0)})`);
    for (const t of HOME_TREES) {
      if (dist(t, p) < barkRadius(trunk(t), 0) + 0.6) continue; // (its own tree)
      assert.ok(segDist(t, eye, p) > barkRadius(trunk(t), 1) + 0.15, `${p.id} is not behind ${t.id}`);
    }
    // the glade oak's crown (world/Crowns.ts: reach 0.65 × its height) keeps clear of it
    assert.ok(dist(TREE.gladeOak, p) > 0.65 * TREE.gladeOak.h, `${p.id} is out from under the oak's leaves`);
  }
  for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) {
    const a = px(cam, spots[i], spots[i].y + spots[i].h / 2), b = px(cam, spots[j], spots[j].y + spots[j].h / 2);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 70, `${spots[i].id} and ${spots[j].id} are ${Math.hypot(a.x - b.x, a.y - b.y).toFixed(0)} px apart on the screen`);
  }
  // the jay's way back: every step in the picture, off the others, never toward the lens
  let lastD = 0;
  for (let k = 0; k <= 6; k++) {
    const p = jayStep(k, 6);
    const q = px(cam, p, 0.12);
    assert.ok(!q.behind && q.x > 30 && q.x < W - 30 && q.y > 70 && q.y < H - 120, `the jay at step ${k}/6 is in the picture (${q.x.toFixed(0)}, ${q.y.toFixed(0)})`);
    const d = dist(p, P.callers);
    assert.ok(d >= lastD - 1e-9, 'it only ever backs away from him');
    lastD = d;
    for (const s of spots) if (s.id !== 'top') assert.ok(Math.hypot(p.x - s.x, p.z - s.z) > 0.35, `the jay keeps off the ${s.id}`);
  }
  assert.ok(dist(jayStep(0, 3), HEAP) < 0.8, 'it starts at the acorns');
  assert.ok(dist(jayStep(3, 3), SNAG) < 0.6, 'it ends at the snag\'s root');
  // before the mission the jay waits on the glade oak's stub: out of both pictures' middles
  const gcam = fitLens(GLADE_VIEW);
  const jw = px(gcam, JAY_WAIT, JAY_WAIT.y);
  assert.ok(jw.behind || jw.x < 120 || jw.x > W - 120 || jw.y < 100, `the waiting jay is not in the glade picture's middle (${jw.x.toFixed(0)}, ${jw.y.toFixed(0)})`);
  const jc = px(cam, JAY_WAIT, JAY_WAIT.y);
  assert.ok(jc.behind || jc.x < 0 || jc.x > W || jc.y < 0, 'the waiting jay is out of the callers\' picture');
  // the held view looks at them from the stand's side
  const l = toLocal({ x: CALLERS_VIEW.at.x, z: CALLERS_VIEW.at.z, heading: CALLERS_VIEW.heading }, P.callers);
  assert.ok(l.v < -2, 'the ranger stands in front of what the view looks at');
  void tall;
});

test('the scattered trees keep out of the glade, the lens and the room round each home tree', () => {
  const clear = eekhoornTreeClear();
  const inside = (p: { x: number; z: number }): boolean => clear.some((c) => dist(c, p) < c.r);
  for (const t of HOME_TREES) assert.ok(inside(t), 'room round a home tree');
  for (const sym of FIELD_SYMS) for (const p of gladeSpots(sym)) assert.ok(inside(p), 'the glade is open');
  assert.ok(inside(P.stand) && inside(P.callers));
  for (const c of HIDE_TREES) assert.ok(clear.some((q) => dist(q, c) < 1e-9 && q.r >= 4.6), `a wide ring round ${c.id}`);
  // the one scattered pine it takes (the budget), and none of the wood round the other homes
  assert.ok(inside(SCATTER_TAKEN), 'the small pine east of the den is taken');
  for (const s of SCATTER) assert.ok(!inside(s), `the scattered tree at (${s.x}, ${s.z}) stays`);
  for (const s of [{ x: 31.5, z: -41.5 }, { x: 25.71, z: -35.48 }]) assert.ok(!inside(s), `the tree at (${s.x}, ${s.z}) stays`);
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
  for (const t of HOME_TREES) {
    const s = branchStub(t);
    if (!t.branch) { assert.equal(s, undefined, `${t.id} has no branch, so no stub`); continue; }
    n++;
    assert.ok(s, `${t.id} has its stub`);
    const b = t.branch;
    const bark = barkRadius(trunk(t), b.h);
    assert.equal(s.ang, b.ang, `${t.id}: it points the branch's way`);
    assert.ok(s.start < bark * 0.95, `${t.id}: rooted inside the bark (${s.start.toFixed(3)} < ${bark.toFixed(3)} m)`);
    const past = s.start + s.len * Math.cos(STUB_TILT) - bark;
    assert.ok(past >= b.out + 0.08, `${t.id}: it reaches ${past.toFixed(2)} m out of the bark (the seat is ${b.out} m out)`);
    assert.ok(Math.abs(s.y + s.r - b.h) < 0.015, `${t.id}: its top at the branch height (${(s.y + s.r).toFixed(3)} vs ${b.h})`);
    assert.ok(s.r > 0.03 && s.r < 0.09, `${t.id}: a limb, not a log (${s.r} m)`);
  }
  assert.equal(n, HOME_TREES.length, 'every home tree has a branch');
});

test('the walk hint never strands him: from right beside any pine of the home, the way to a watch spot is the spot itself or a step beyond the hint\'s radius', () => {
  const goals = [...new Set(ROUTE_IDS.flatMap((id) => ROUTES[id].waits))].map((t) => watchSpot(t));
  let n = 0;
  // (as near as he can stand: the trunk's collider and his own 0.3 m, and a little further)
  for (const t of HOME_TREES) for (const r of [(0.6 * t.h) / 12.5 + 0.32, trunkClear(t) - 0.2, trunkClear(t) + 0.05]) for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
    const me = { x: t.x + Math.sin(a) * r, z: t.z + Math.cos(a) * r };
    if (HOME_TREES.some((o) => o !== t && dist(o, me) < (0.6 * o.h) / 12.5 + 0.32)) continue;
    for (const g of goals) {
      if (dist(me, g) < 2) continue;
      const w = wayTo(me, g);
      n += 1;
      assert.ok(w === g || dist(me, w) > WATCH_R, `beside ${t.id} at ${deg(a)}°, ${r.toFixed(2)} m: a step of ${dist(me, w).toFixed(2)} m toward (${g.x.toFixed(1)}, ${g.z.toFixed(1)})`);
    }
  }
  assert.ok(n > 500, `${n} ways`);
});

/* ---------------------------------------------------------- the draw ---- */

test('a play\'s draw: from its own forks, replayed by its seed, never the last play\'s way or pattern, a new neighbour at least', () => {
  // the same seed, the same play (a reload with ?seed=N replays it)
  for (let s = 1; s <= 30; s++) {
    const a = drawEekhoornPlay(newPlay('eekhoorn', s, 1), null), b = drawEekhoornPlay(newPlay('eekhoorn', s, 1), null);
    assert.deepEqual(a, b, `seed ${s} replays`);
    assert.deepEqual(parseVariant(variantOf(a)), { route: a.route, veld: a.veld, buren: a.buren, nest: a.nest, den: a.day.den, einde: a.day.einde, verrassing: a.day.verrassing, verstop2: a.day.verstop2, antics: a.day.antics }, 'its variant reads back');
    // (a day kept before its antics were: it reads without them)
    assert.equal(parseVariant(variantOf(a).slice(0, -a.day.antics.length))?.antics, undefined, 'a day without its antics reads back');
    assert.deepEqual(parseVariant(variantOf({ route: a.route, veld: a.veld, buren: a.buren })), { route: a.route, veld: a.veld, buren: a.buren }, 'an older play\'s variant (no day) reads back');
  }
  // plays in a row, each after the last two: three in a row are three ways, three
  // patterns, three trios; each trio two neighbours another than the last
  const routes = new Set<string>(), syms = new Set<string>(), trios = new Set<string>();
  const seen: ReturnType<typeof drawEekhoornPlay>[] = [];
  for (let s = 1; s <= 200; s++) {
    const recent = seen.slice(-2).reverse();
    const p = drawEekhoornPlay(newPlay('eekhoorn', 1000 + s, s), recent);
    for (const [i, q] of recent.entries()) {
      assert.notEqual(p.route, q.route, `play ${s}: another way than ${i + 1} play(s) ago`);
      assert.notEqual(p.veld, q.veld, `play ${s}: another pattern than ${i + 1} play(s) ago`);
      assert.notEqual(trioCode(p.buren), trioCode(q.buren), `play ${s}: another trio than ${i + 1} play(s) ago`);
    }
    if (recent[0]) assert.ok(SLOTS.filter((k) => p.buren[k] !== recent[0].buren[k]).length >= 2, `play ${s}: two other neighbours`);
    // its finds somewhere new: never the last play's nest tree nor its dining spot
    if (recent[0]) {
      assert.notEqual(nestTrees(ROUTES[p.route])[p.nest].id, nestTrees(ROUTES[recent[0].route])[recent[0].nest].id, `play ${s}: its nest on another tree`);
      assert.notEqual(p.kegels, recent[0].kegels, `play ${s}: its cones somewhere new`);
    }
    routes.add(p.route); syms.add(p.veld); trios.add(trioCode(p.buren));
    seen.push(p);
  }
  assert.equal(routes.size, 3); assert.equal(syms.size, 4);
  assert.ok(trios.size >= 14, `${trios.size} trios came`);
  // the history: the newest of this mission's plays, read back from its beats' variants
  const hist = [
    { m: 'eekhoorn', va: `mood:zonnig,${VARIANT_KEY}:n-u-mbr` },
    { m: 'frisling', va: 'mood:bewolkt' },
    { m: 'eekhoorn', va: `mood:bewolkt,rare:jonge-eekhoorn,${VARIANT_KEY}:z-o-kgk` },
    { m: 'ree-niet-aanraken', va: 'ree:A21-in-ago' },
  ];
  assert.deepEqual(lastVariant(hist), { route: 'zuid', veld: 'om', buren: { tak: 'koolmees', stam: 'groene-specht', top: 'koekoek' } });
  assert.equal(lastVariant([]), null);
  // the last two PLAYS (a play logs two beats with one seed)
  const two = [
    { m: 'eekhoorn', sd: 7, va: `mood:zonnig,${VARIANT_KEY}:n-u-mbr` }, { m: 'eekhoorn', sd: 7, va: `mood:zonnig,${VARIANT_KEY}:n-u-mbr` },
    { m: 'eekhoorn', sd: 8, va: `mood:bewolkt,${VARIANT_KEY}:z-o-kgk` }, { m: 'eekhoorn', sd: 8, va: `mood:bewolkt,${VARIANT_KEY}:z-o-kgk` },
  ];
  assert.deepEqual(lastVariants(two).map((v) => v.route), ['zuid', 'noord']);
  // the last play's nest tree, read back (the draw keeps the next nest off it)
  const withNest = [{ m: 'eekhoorn', sd: 9, va: `mood:ochtendnevel,rare:donkere-eekhoorn,${VARIANT_KEY}:m-v-rnr,nest:z1` }];
  assert.equal(lastVariants(withNest)[0].nest, nestTrees(ROUTES.midden).findIndex((t) => t.id === 'z1'));
  assert.ok(withNest[0].va.length <= 60, 'the nest note survives the history\'s 60 characters');
  for (let s = 1; s <= 60; s++) {
    const p = drawEekhoornPlay(newPlay('eekhoorn', 5000 + s, 1), [{ ...lastVariants(withNest)[0], route: 'midden' }]);
    if (p.route === 'zuid') assert.notEqual(nestTrees(ROUTES.zuid)[p.nest].id, 'z1', `seed ${5000 + s}: not on z1 again`);
  }
  assert.equal(lastVariant([{ m: 'eekhoorn', va: 'mood:zonnig' }]), null, 'an old play without a variant: a free draw');
  // the history keeps it whole after the mood and a rare (≤ 60 characters)
  const va = `mood:ochtendnevel,rare:donkere-eekhoorn,${VARIANT_KEY}:${variantOf({ route: 'midden', veld: 'spiegel-v', buren: { tak: 'roodborst', stam: 'grote-bonte-specht', top: 'koekoek' } })}`;
  assert.ok(va.length <= 60, `the longest variant line is ${va.length} characters`);
});

test('the squirrel\'s day (ek-day): from its own forks, replayed by its seed; three plays in a row, three endings and three dens; an antic per wait, none twice', () => {
  for (let s = 1; s <= 30; s++) {
    const a = drawEekhoornPlay(newPlay('eekhoorn', s, 1), null, { mood: 'zonnig' });
    assert.deepEqual(a, drawEekhoornPlay(newPlay('eekhoorn', s, 1), null, { mood: 'zonnig' }), `seed ${s} replays its day`);
    // (its day never moves the way, the pattern, the trio or the finds: forks of its own)
    const b = drawEekhoornPlay(newPlay('eekhoorn', s, 1), null);
    assert.deepEqual({ ...a, day: null }, { ...b, day: null }, `seed ${s}: the day draws from forks of its own`);
  }
  const moods = ['gouden-uur', 'ochtendnevel', 'zonnig', 'bewolkt'];
  const seen: Drawn[] = [];
  let surprises = 0, second = 0, dry = 0;
  const kinds = new Set<string>(), dens = new Set<string>(), ends = new Set<string>(), antics = new Set<string>();
  const N = 300;
  for (let s = 1; s <= N; s++) {
    const recent = seen.slice(-2).reverse();
    const mood = moods[s % 4];
    const rare = s % 7 === 0 ? 'donkere-eekhoorn' : null;
    const p = drawEekhoornPlay(newPlay('eekhoorn', 7000 + s, s), recent, { mood, rare });
    const d = p.day;
    // read back from the history line (as the next play reads it)
    const back = parseVariant(variantOf(p))!;
    assert.deepEqual([back.den, back.einde, back.verrassing, back.verstop2, back.nest, back.antics], [d.den, d.einde, d.verrassing, d.verstop2, p.nest, d.antics]);
    // the den: never one of the last two plays'; with the dark visitor one that ends on its stub
    if (rare) assert.ok(d.den === 'tak' || d.den === 'spiraal', `play ${s}: the dark visitor meets it on its stub (${d.den})`);
    else for (const r of recent) assert.notEqual(d.den, r.den, `play ${s}: another den than lately`);
    // the ending: never one of the last two plays' (three plays, three endings)
    for (const r of recent) assert.notEqual(d.einde, r.einde, `play ${s}: another ending than lately`);
    // an antic per wait, none twice; in the sun only in a sunny light
    assert.equal(d.antics.length, ROUTES[p.route].waits.length);
    assert.equal(new Set(d.antics).size, d.antics.length, `play ${s}: no antic twice`);
    if (!SUN_MOODS.includes(mood)) assert.ok(!d.antics.includes('zonnen'), `play ${s}: no sunning in the ${mood}`);
    if (d.den === 'voet') assert.ok(!d.antics.includes('knabbelen'), `play ${s}: it nibbled at its den, not again at a wait`);
    // never the antic a wait had last play (where the light and the den leave a fourth)
    const pool = ANTICS.filter((a) => (a !== 'zonnen' || SUN_MOODS.includes(mood)) && (a !== 'knabbelen' || d.den !== 'voet'));
    if (recent[0]?.antics && pool.length > d.antics.length) for (const [w, a] of d.antics.entries()) assert.notEqual(a, recent[0].antics[w], `play ${s}: wait ${w + 1} does something new`);
    // a surprise: never the last play's; the drum only with the great spotted woodpecker
    if (d.verrassing !== 'geen') { surprises += 1; if (recent[0]?.verrassing && recent[0].verrassing !== 'geen') assert.notEqual(d.verrassing, recent[0].verrassing, `play ${s}: another surprise`); }
    if (d.verrassing === 'roffel') assert.equal(p.buren.stam, 'grote-bonte-specht');
    if (d.verrassing === 'gaai') assert.ok(!(d.verstop2 && p.route === 'zuid'), `play ${s}: the jay's cache is on his way`);
    // a second hide about 1 in 3, and never three plays without one
    if (d.verstop2) { second += 1; dry = 0; } else { dry += 1; assert.ok(dry <= 2 || s <= 2, `play ${s}: three plays without a second hide`); }
    kinds.add(d.verrassing); dens.add(d.den); ends.add(d.einde); d.antics.forEach((x) => antics.add(x));
    seen.push(back);
  }
  assert.ok(surprises / N > 0.55 && surprises / N < 0.8, `a surprise in ${surprises} of ${N} plays`);
  assert.ok(second / N > 0.28 && second / N < 0.5, `a second hide in ${second} of ${N} plays`);
  assert.deepEqual([...kinds].sort(), ['denappel', 'gaai', 'geen', 'roffel']);
  assert.deepEqual([...dens].sort(), [...DEN_KINDS].sort());
  assert.deepEqual([...ends].sort(), [...EINDES].sort());
  assert.deepEqual([...antics].sort(), [...ANTICS].sort());
  // a fresh save (no history): a free draw
  const fresh = drawDay(newPlay('eekhoorn', 3, 1), { route: 'zuid', buren: FIRST_TRIO, recent: [] });
  assert.ok(DEN_KINDS.includes(fresh.den) && EINDES.includes(fresh.einde));
  // the history keeps the whole day after the longest mood and rare (≤ 60 characters)
  const longest = drawEekhoornPlay(newPlay('eekhoorn', 11, 1), null);
  const va = `mood:ochtendnevel,rare:donkere-eekhoorn,${VARIANT_KEY}:${variantOf({ ...longest, route: 'midden', veld: 'spiegel-v', buren: { tak: 'roodborst', stam: 'grote-bonte-specht', top: 'koekoek' } })}`;
  assert.ok(va.length <= 60, `the longest variant line is ${va.length} characters`);
  // an old save's history (a variant without its day) still reads, and draws freely
  assert.equal(lastVariants([{ m: 'eekhoorn', sd: 1, va: `mood:zonnig,${VARIANT_KEY}:n-u-mbr,nest:n1` }])[0].den, undefined);
});

test('the second hide (ek-day): a close pine of each way, in its own open ring, never one the way waits at', () => {
  for (const id of ROUTE_IDS) {
    const t2 = SECOND_HIDE[id], h = ROUTES[id].hide;
    assert.notEqual(t2, h);
    const d = dist(t2, h);
    assert.ok(d >= 3.8 && d <= 5.2, `${id}: ${t2.id} stands ${d.toFixed(2)} m from ${h.id}`);
    assert.ok(!ROUTES[id].waits.includes(t2), `${id}: not a pine it waits at`);
    assert.ok(dist(t2, GLADE_RING) > GLADE_RING.r && dist(t2, LENS_ROOM) > LENS_ROOM.r, `${id}: ${t2.id} out of the glade and the lens room`);
    assert.ok(dist(t2, P.stand) <= 11, `${id}: the glade ${dist(t2, P.stand).toFixed(1)} m on`);
    for (const s of SCATTER) assert.ok(dist(t2, s) > 4.85, `${id}: ${t2.id} leaves the scattered pine standing`);
  }
  assert.ok(ALL_HIDE_TREES.length === 4, `${ALL_HIDE_TREES.length} trees it hides round`);
  const clear = eekhoornTreeClear(), plants = eekhoornClearings();
  for (const t of ALL_HIDE_TREES) {
    assert.ok(clear.some((c) => dist(c, t) < 0.01 && c.r >= 4.6), `${t.id}: its open ring`);
    assert.ok(plants.some((c) => dist(c, t) < 0.01 && c.r >= 4.2), `${t.id}: no fern round it`);
  }
});

/* ------------------------------------------------ what he can find (run 7) ---- */

/** The follow lens as the world places it (world/CameraRig): 2.4 m up, 4.6 m behind him,
 *  looking at 0.65 of his height: a point's place in the picture (px from the top) and
 *  whether it is inside it at all. */
const FOLLOW_LOOK_H = 0.65 * RANGER_STAND_HEIGHT;
function followPx(me: { x: number; z: number }, heading: number, p: { x: number; y: number; z: number }): { x: number; y: number; d: number; inside: boolean } {
  const g = groundY(me.x, me.z);
  const eye = new THREE.Vector3(me.x - Math.sin(heading) * LENS.back, g + LENS.up, me.z - Math.cos(heading) * LENS.back);
  const cam = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 400);
  cam.position.copy(eye); cam.lookAt(me.x, g + FOLLOW_LOOK_H, me.z); cam.updateMatrixWorld(true);
  const v = new THREE.Vector3(p.x, p.y, p.z);
  const behind = v.clone().applyMatrix4(cam.matrixWorldInverse).z > 0;
  v.project(cam);
  const x = (v.x + 1) * 0.5 * W, y = (1 - v.y) * 0.5 * H;
  return { x, y, d: eye.distanceTo(new THREE.Vector3(p.x, p.y, p.z)), inside: !behind && x > 0 && x < W && y > 0 && y < H };
}
/** A box through the follow lens behind him (as eekhoorn.home `pictureOf` measures a find):
 *  how tall it stands (px), its middle across the picture (−1…1), its top (px from the top),
 *  and whether its middle is inside the picture at all. */
function followBox(me: { x: number; z: number }, heading: number, box: THREE.Box3): { px: number; cx: number; cy: number; top: number; inside: boolean } {
  const g = groundY(me.x, me.z);
  const cam = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 400);
  cam.position.set(me.x - Math.sin(heading) * LENS.back, g + LENS.up, me.z - Math.cos(heading) * LENS.back);
  cam.lookAt(me.x, g + FOLLOW_LOOK_H, me.z); cam.updateMatrixWorld(true);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < 8; i++) {
    const v = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
    if (v.clone().applyMatrix4(cam.matrixWorldInverse).z > -0.2) return { px: 0, cx: 9, cy: -1, top: 0, inside: false };
    v.project(cam);
    minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
  }
  const cx = (minX + maxX) / 2, cy = (1 - (minY + maxY) / 2) * 0.5 * H;
  return { px: (maxY - minY) * 0.5 * H, cx, cy, top: (1 - maxY) * 0.5 * H, inside: Math.abs(cx) <= 0.92 && cy >= 96 && cy <= H - 8 };
}
/** How tall (px) something `size` m across reads at `d` m through a 55° lens on 800 px. */
const pxAt = (size: number, d: number): number => (size / (2 * d * Math.tan((FOV / 2) * Math.PI / 180))) * H;

/** The walk a perfect player makes along a way (golden's hints): straight to each wait's
 *  watch spot (round a trunk in the way), standing there a moment facing the squirrel,
 *  then to the hide tree and on into the glade — at 2 m/s, a sample every 0.05 s. */
function walkOf(r: Route): { x: number; z: number; h: number; leg: string }[] {
  const out: { x: number; z: number; h: number; leg: string }[] = [];
  let me = { x: MARKER.x, z: MARKER.z };
  const go = (to: { x: number; z: number }, stop: number, leg: string): void => {
    for (let n = 0; n < 6 && dist(me, to) > stop; n++) {
      const via = wayTo(me, to), h = headingTo(me, via), a = { ...me }, steps = Math.ceil(dist(a, via) / 0.1);
      for (let i = 1; i <= steps && dist(me, to) > stop; i++) { me = { x: a.x + (via.x - a.x) * (i / steps), z: a.z + (via.z - a.z) * (i / steps) }; out.push({ ...me, h, leg }); }
    }
  };
  r.waits.forEach((t, i) => {
    if (i < r.waits.length - 1) {
      go(watchSpot(t), WATCH_R, t.id);
      const h = headingTo(me, seatOf(t));
      for (let k = 0; k < 40; k++) out.push({ ...me, h, leg: `${t.id}:wacht` }); // (≥ SIT: it sits a moment first)
    } else go(t, 3.2, 'hide');
  });
  go(P.stand, 1.6, 'glade');
  return out;
}

test('the nest, every way: on a wait tree he comes to (never its hide tree), 2.1-2.5 m up on his side, apart from the stub, big in his picture from the spot to see it from (the threshold the runtime reads, with room)', () => {
  let n = 0;
  for (const id of ROUTE_IDS) {
    const r = ROUTES[id];
    assert.ok(nestTrees(r).length >= 2, `${id}: ${nestTrees(r).length} trees may carry its nest`);
    assert.ok(!nestTrees(r).includes(r.hide), `${id}: never on its hide tree`);
    nestTrees(r).forEach((t, i) => {
      n += 1;
      const nest = nestOf(r, i);
      const g = groundY(nest.x, nest.z);
      assert.ok(nest.y >= 2.1 && nest.y <= 2.5, `${id}/${t.id}: ${nest.y} m up`);
      assert.equal(r.hops.find((h) => h.tree === t)?.how, 'dash', `${id}/${t.id}: it dashes to it (its nest moment comes at the end of a dash)`);
      assert.ok(Math.abs(wrapA(nest.ang - headingTo(t, comesFrom(r, i)))) <= 0.5, `${id}/${t.id}: on the side he comes from`);
      assert.ok(Math.abs(wrapA(nest.ang - t.branch!.ang)) >= 0.9, `${id}/${t.id}: well round the trunk from its stub (${deg(Math.abs(wrapA(nest.ang - t.branch!.ang)))}°)`);
      // hugging its bark: not floating off it, not inside it
      const bark = barkRadius(trunk(t), nest.y);
      assert.ok(dist(nest, t) > bark && dist(nest, t) < bark + NEST.r, `${id}/${t.id}: against the bark (${(dist(nest, t) - bark).toFixed(2)} m out)`);
      // where he stands to see it while it waits in its nest (the walk hint's end), facing it
      // — and wherever the hint's last step may leave him: from anywhere within NEST_WATCH.r
      // of the spot he walks at the nest and stops NEST_WATCH.stop short of it. From each:
      // the nest at least the runtime's NEST_SEE.px + a margin tall in his picture (its box,
      // as the runtime measures it), its top under the line card, inside the picture, every
      // point of it clear of the trunks and his head; not under it; he stands clear of every
      // trunk
      const w = nestWatch(r, i);
      assert.ok(dist(w, nest) >= NEST_WATCH.under + 0.4 && dist(w, nest) <= NEST_SEE.near - 1, `${id}/${t.id}: the spot to see it from stands ${dist(w, nest).toFixed(2)} m off it`);
      assert.equal(biomeAt(w.x, w.z), 'bos', `${id}/${t.id}: the spot to see it from is in the wood`);
      // (he looks at a point beside the nest, left of it as he sees it: the nest right of the
      // middle of his picture, off the middle and away from the chips' corner)
      const aim = nestAim(nest, w);
      assert.ok(dist(w.aim, aim) < 1e-9, `${id}/${t.id}: the spot's aim`);
      assert.ok(Math.abs(dist(aim, nest) - NEST_WATCH.aside) < 1e-9 && wrapA(headingTo(w, aim) - headingTo(w, nest)) > 0.2, `${id}/${t.id}: he looks beside it, to its left`);
      assert.ok(Math.abs(wrapA(w.heading - headingTo(w, aim))) < 1e-9, `${id}/${t.id}: facing it`);
      const stands: { x: number; z: number; h: number; tag: string }[] = [{ ...w, h: w.heading, tag: 'at the spot' }];
      for (let a = -Math.PI; a < Math.PI; a += Math.PI / 6) for (const rr of [NEST_WATCH.r * 0.5, NEST_WATCH.r]) for (const on of [0, NEST_WATCH.carry]) {
        const s0 = { x: w.x + Math.sin(a) * rr, z: w.z + Math.cos(a) * rr };
        const d0 = dist(s0, aim);
        // (he always takes a step: it turns him to it; and the walk may carry him a little on)
        assert.ok(d0 - w.stop >= NEST_WATCH.step - NEST_WATCH.r - 1e-9 && w.stop - on > 0.5, `${id}/${t.id}: from ${deg(a)}° ${rr} m he steps ${(d0 - w.stop).toFixed(2)} m`);
        const k0 = (w.stop - on) / d0;
        const pp = { x: aim.x + (s0.x - aim.x) * k0, z: aim.z + (s0.z - aim.z) * k0 };
        stands.push({ ...pp, h: headingTo(s0, aim), tag: `stepped from ${deg(a)}° ${rr} m${on ? ', carried on' : ''}` });
      }
      const box = new THREE.Box3(new THREE.Vector3(nest.x - NEST.r, g + nest.y - NEST.r, nest.z - NEST.r), new THREE.Vector3(nest.x + NEST.r, g + nest.y + NEST.r, nest.z + NEST.r));
      const pts = [[0, 0, 0], [0, 0.6, 0], [0.6, 0.1, 0], [-0.6, 0.1, 0], [0, 0.1, 0.6], [0, 0.1, -0.6], [0, -0.5, 0]]
        .map(([x, y, z]) => ({ x: nest.x + x * NEST.r, y: g + nest.y + y * NEST.r, z: nest.z + z * NEST.r }));
      for (const st of stands) {
        const tag = `${id}/${t.id} ${st.tag}`;
        for (const o of HOME_TREES) assert.ok(dist(o, st) > trunkClear(o) - 0.35, `${tag}: clear of ${o.id}`);
        assert.ok(dist(st, nest) > NEST_WATCH.under, `${tag}: not under it`);
        const q = followBox(st, st.h, box);
        assert.ok(q.inside && Math.abs(q.cx) <= NEST_SEE.x - 0.1 && q.top >= 104, `${tag}: well in his picture, under the line card (x ${q.cx.toFixed(2)}, top ${q.top.toFixed(0)} px)`);
        assert.ok(((q.cx + 1) / 2) * W >= NEST_SEE.hud.w + 40 || q.cy >= NEST_SEE.hud.h + 40, `${tag}: out of the chips' corner`);
        // (where the step leaves him: the nest off the middle of his picture)
        if (st.tag !== "at the spot") assert.ok(q.cx >= 0.1, `${tag}: right of the middle of his picture (x ${q.cx.toFixed(2)})`);
        // (where the step leaves him, with room; at the spot itself, on his way, at least the
        // runtime's own threshold)
        assert.ok(q.px >= NEST_SEE.px + (st.tag === 'at the spot' ? 2 : 6), `${tag}: it stands ${q.px.toFixed(0)} px tall (the moment wants ${NEST_SEE.px})`);
        const gs = groundY(st.x, st.z);
        const eye = { x: st.x - Math.sin(st.h) * LENS.back, y: gs + LENS.up, z: st.z - Math.cos(st.h) * LENS.back };
        // (every point clear of the other pines out to their outline, of its own trunk's bark it
        // hugs, and of his head; and as the runtime counts it — every trunk out to its outline
        // — most of it clear)
        const head: Upright = { x: st.x, z: st.z, y0: gs, y1: gs + RANGER_STAND_HEIGHT * 1.1, r: () => 0.22 };
        // (a trunk between the lens and his head or chest the follow camera fades: it hides
        // nothing — world/CameraRig, the camera's own fade decision)
        const shown = HOME_TREES.filter((o) => {
          const f = trunkFadeUpright(trunk(o), groundY(o.x, o.z));
          return lineClear(eye, { x: st.x, y: gs + RANGER_STAND_HEIGHT, z: st.z }, [f]) && lineClear(eye, { x: st.x, y: gs + 0.9, z: st.z }, [f]);
        });
        const ups = shown.map((o) => (o === t ? { ...trunkUpright(trunk(o), groundY(o.x, o.z)), r: (y: number) => barkRadius(trunk(o), Math.max(0, y - groundY(o.x, o.z))) } : trunkUpright(trunk(o), groundY(o.x, o.z))));
        for (const pt of pts) assert.ok(lineClear(eye, pt, [...ups, head]), `${tag}: no trunk and not his head in front of the nest`);
        const runtime = shown.map((o) => trunkUpright(trunk(o), groundY(o.x, o.z)));
        assert.ok(pts.filter((pt) => lineClear(eye, pt, [...runtime, head])).length / pts.length >= 0.75, `${tag}: most of it clear as the runtime counts it`);
        // the squirrel peeking out of it is in the picture too ("Kijk, zijn nest!"), its head
        // under the line card, out of the ball on his side (not into the bark)
        const pk = nestPeek(nest, st);
        const qp = followPx(st, st.h, { x: pk.x, y: g + pk.y + 0.33, z: pk.z });
        assert.ok(qp.inside && qp.y > 104, `${tag}: the squirrel peeking out of its nest is in the picture (${qp.x.toFixed(0)}, ${qp.y.toFixed(0)})`);
        assert.ok(dist(pk, t) > barkRadius(trunk(t), nest.y) + 0.12, `${tag}: it peeks out of the ball, not out of the bark`);
        assert.ok(dist(pk, st) < dist(nest, st), `${tag}: on his side of the nest`);
        assert.equal(nestSolid({ x: eye.x, y: eye.y, z: eye.z }, { x: nest.x, y: g + nest.y, z: nest.z }, { x: st.x, y: gs, z: st.z }), 1, `${tag}: it stands solid there`);
      }
      const at = { x: nest.x, y: g + nest.y, z: nest.z };
      // the follow lens trailing him on any way never runs into it or looks past it at him:
      // there it fades (as a home tree's crown does), and the lens passes 0.6-0.8 m from some
      // nests at its own height
      for (const o of ROUTE_IDS) for (const s of walkOf(ROUTES[o])) {
        const gs = groundY(s.x, s.z);
        const lens = { x: s.x - Math.sin(s.h) * LENS.back, y: gs + LENS.up, z: s.z - Math.cos(s.h) * LENS.back };
        const solid = nestSolid(lens, at, { x: s.x, y: gs, z: s.z });
        const d = Math.hypot(lens.x - at.x, lens.y - at.y, lens.z - at.z);
        if (solid) {
          // (solid, it never looms: at most ~150 px of his picture — played 2026-10-03, the
          // lens trailing him past the first pine had it 220 px wide at its right shoulder)
          assert.ok(pxAt(NEST.r * 2, d) <= 150, `${id}/${t.id}: on the ${o} way the lens is ${d.toFixed(2)} m from it (${pxAt(NEST.r * 2, d).toFixed(0)} px), and it stands solid`);
          assert.ok(lineClear(lens, { x: s.x, y: gs + 1.0, z: s.z }, [{ x: at.x, z: at.z, y0: at.y - NEST.r, y1: at.y + NEST.r, r: () => NEST.r }]), `${id}/${t.id}: on the ${o} way it stands solid between the lens and him`);
        }
      }
    });
  }
  assert.ok(n >= 6, `${n} nests`);
});

test('the dining spots: in the wood, off every way, out of the hide-and-seek rings and the glade; each way passes two, and he sees each for a moment as he goes', () => {
  const clear = eekhoornClearings(), treeClear = eekhoornTreeClear();
  const walks = Object.fromEntries(ROUTE_IDS.map((id) => [id, walkOf(ROUTES[id])])) as Record<string, ReturnType<typeof walkOf>>;
  const lines = ROUTE_IDS.flatMap((id) => walks[id].slice(1).map((s, i) => [walks[id][i], s] as const));
  const waits = [...new Set(ROUTE_IDS.flatMap((id) => ROUTES[id].waits))];
  for (const d of DINING) {
    const reach = d.kind === 'stam' ? STAM.len / 2 : STRONK.r;
    assert.equal(biomeAt(d.x, d.z), 'bos', `${d.id}: in the wood`);
    assert.ok(distanceToNetwork(d.x, d.z) > LANE_HALF + 1, `${d.id}: off the paths`);
    for (const [mid, m] of Object.entries(OTHER_MARKERS)) assert.ok(dist(d, m) >= 8, `${d.id}: 8 m from the ${mid} marker`);
    assert.ok(dist(d, MARKER) > 2.8, `${d.id}: off the marker ring`);
    for (const t of HOME_TREES) assert.ok(dist(d, t) > trunkClear(t) + reach * 0.5, `${d.id}: clear of ${t.id}`);
    for (const t of HIDE_TREES) assert.ok(dist(d, t) > 3.9, `${d.id}: out of the ${t.id} hide-and-seek ring`);
    for (const t of waits) assert.ok(dist(d, watchSpot(t)) > 1.5 && dist(d, seatOf(t)) > 1.5, `${d.id}: off ${t.id}'s watch spot and seat`);
    assert.ok(dist(d, GLADE_RING) > GLADE_RING.r && dist(d, LENS_ROOM) > LENS_ROOM.r, `${d.id}: out of the glade and the lens room`);
    for (const s of SCATTER) assert.ok(dist(d, s) > 1.6, `${d.id}: off the scattered pine at (${s.x}, ${s.z})`);
    const lineMin = Math.min(...lines.map(([a, b]) => segDist(d, a, b)));
    assert.ok(lineMin > reach + 0.55, `${d.id}: ${lineMin.toFixed(2)} m off every way he walks`);
    assert.ok(clear.some((c) => dist(c, d) < c.r - reach * 0.6) && treeClear.some((c) => dist(c, d) < c.r - 0.5), `${d.id}: open ground round it (no fern, no stray pine)`);
  }
  // no way shares a dining spot with another: the way is never the last two plays', so the
  // gnawed cones lie somewhere new every play
  const used = ROUTE_IDS.flatMap((id) => [...ROUTE_DINING[id]]);
  assert.equal(new Set(used).size, used.length, 'every way its own two dining spots');
  for (const a of DINING) for (const b of DINING) if (a !== b) assert.ok(dist(a, b) >= 3, `${a.id} and ${b.id} stand apart`);
  for (const id of ROUTE_IDS) {
    const two = ROUTE_DINING[id];
    assert.equal(new Set(two).size, 2, `${id}: two spots`);
    for (const did of two) {
      const d = diningById(did);
      // walking (or waiting) along the way: within DINING_SEE.within m of him, in the follow
      // lens, below the line card, no trunk in front of it, ≥ 30 px across, for 1.2 s at least
      let run = 0, best = 0;
      for (const s of walks[id]) {
        const top = { x: d.x, y: groundY(d.x, d.z) + (d.kind === 'stam' ? STAM.r * 2 : STRONK.h), z: d.z };
        const q = followPx(s, s.h, top);
        const eye = { x: s.x - Math.sin(s.h) * LENS.back, y: groundY(s.x, s.z) + LENS.up, z: s.z - Math.cos(s.h) * LENS.back };
        const across = pxAt(d.kind === 'stam' ? STAM.len * 0.6 : STRONK.r * 2, q.d) * 1.0;
        const ok = dist(s, d) <= DINING_SEE.within && q.inside && Math.abs(q.x - W / 2) < W * 0.45 && q.y > 110
          && lineClear(eye, top, hiders(eye, s), 0.05) && across >= DINING_SEE.across;
        run = ok ? run + 0.05 : 0;
        best = Math.max(best, run);
      }
      assert.ok(best >= 1.2, `${id}/${did}: in his picture for ${best.toFixed(2)} s in a row`);
    }
  }
});

test('the seen clock: it runs only while it is in his picture, and a moment out of it starts it again', () => {
  const c = new SeenClock(1);
  for (let i = 0; i < 9; i++) assert.equal(c.step(0.1, true), false);
  assert.equal(c.step(0.1, false), false, 'out of the picture: back to the start');
  for (let i = 0; i < 9; i++) c.step(0.1, true);
  assert.equal(c.seen, false);
  assert.equal(c.step(0.12, true), true, '1 s in a row: seen');
  assert.equal(c.step(0.1, false), true, 'seen stays seen');
});

test('the dark visitor at the den: it comes down out of sight onto the bark above ours, in the den look, and runs up out of it', () => {
  const den = HOME_TREES[0];
  const g0 = groundY(den.x, den.z);
  const bark = (t: HomeTree): Upright => ({ ...trunkUpright(trunk(t), groundY(t.x, t.z)), r: (y: number) => barkRadius(trunk(t), Math.max(0, y - groundY(t.x, t.z))) });
  const onBark = (a: { ang: number; h: number }, out = 0.1): { x: number; y: number; z: number } => {
    const r = barkRadius(trunk(den), a.h) + out;
    return { x: den.x + Math.sin(a.ang) * r, y: g0 + a.h, z: den.z + Math.cos(a.ang) * r };
  };
  let n = 0;
  for (const id of ROUTE_IDS) for (let i = 0; i < 6; i++) {
    const me = { x: MARKER.x + Math.sin(i * 1.05) * 1.2, z: MARKER.z + Math.cos(i * 1.05) * 1.2 };
    const toward = ROUTES[id].waits[0];
    // (the den look of a play with this visitor frames a little higher: the two of them)
    const cam = fitLens(introView(me, toward, DEN_VISITOR.tall));
    const v = denVisitor({ x: cam.position.x, z: cam.position.z });
    n += 1;
    // ours on its stub is still big in it
    const ot = px(cam, seatOf(den), den.branch!.h + 0.33), ob = px(cam, seatOf(den), den.branch!.h);
    assert.ok(Math.abs(ob.y - ot.y) >= 60 && ot.y > 100 && ob.y < H - 60, `${id}/${i}: ours reads ${Math.abs(ob.y - ot.y).toFixed(0)} px in the taller den look`);
    // it starts hidden (behind the trunk from the lens, or above the picture) and leaves so
    for (const [what, a] of [['starts', v.start], ['ends', v.up]] as const) {
      const q = px(cam, onBark(a), a.h);
      assert.ok(!lineClear(cam.position, onBark(a, 0.06), [bark(den)]) || q.y < 0 || q.behind, `${id}/${i}: it ${what} out of sight`);
    }
    assert.ok(v.up.h - v.meet.h > 3, `${id}/${i}: it runs up, not down to the ground`);
    // it meets ours above its stub: in the picture, big, not behind the bark, apart from ours
    const m = onBark(v.meet);
    const top = px(cam, m, v.meet.h + 0.3), bot = px(cam, m, v.meet.h);
    assert.ok(!top.behind && top.x > 60 && top.x < W - 60 && top.y > 100 && bot.y < H - 60, `${id}/${i}: above ours in the den look (${top.x.toFixed(0)}, ${top.y.toFixed(0)})`);
    assert.ok(Math.abs(bot.y - top.y) >= 60, `${id}/${i}: ${Math.abs(bot.y - top.y).toFixed(0)} px tall`);
    assert.ok(lineClear(cam.position, m, [bark(den)]), `${id}/${i}: not behind the bark`);
    assert.ok(Math.hypot(ot.x - top.x, ot.y - top.y) > 50, `${id}/${i}: apart from ours in the picture`);
    // the spiral round the pine (both of them, about ours's height): its far half is
    // behind the trunk, its near half in the picture — round, never toward the lens
    const sp = onBark({ ang: headingTo(den, cam.position), h: DEN_VISITOR.spiralH });
    const sq = px(cam, sp, DEN_VISITOR.spiralH + 0.2);
    assert.ok(!sq.behind && sq.y > 100 && sq.y < H - 60, `${id}/${i}: the spiral passes through the picture`);
  }
  assert.ok(n >= 18);
});

test('the young one in the found view: it hides behind the trunk, peeks round its outline, sits up on open ground past the root spurs, away from him — whole in the picture, big enough, clear of the bark\'s outline and of him — and runs up out of the picture', () => {
  let n = 0, sides = 0;
  const check = (rid: string, c: HomeTree, sqAng: number, at: { x: number; z: number }, tag: string): void => {
    const gc = groundY(c.x, c.z);
    const tr = trunk(c);
    const bark: Upright = { ...trunkUpright(tr, gc), r: (y: number) => barkRadius(tr, Math.max(0, y - gc)) };
    // (what hides it on the ground: the trunk out to its ridged outline, root spurs and all —
    // played 2026-10-04, seed 45: sat 1.0 m from the axis it sat INSIDE a root spur, ~25 px
    // of fragments showing while 'Gevonden! En nog een kleintje!' was said)
    const outline = trunkUpright(tr, gc);
    const onBark = (a: { ang: number; h: number }, out = 0.1): { x: number; y: number; z: number } => {
      const r = barkRadius(tr, a.h) + out;
      return { x: c.x + Math.sin(a.ang) * r, y: gc + a.h, z: c.z + Math.cos(a.ang) * r };
    };
    const face0 = foundFace(c, sqAng, at);
    const me = foundStand(c, face0, at);
    const face = foundFace(c, sqAng, me);
    const cam = fitLens(foundView(c, face, me, true));
    const lens = { x: cam.position.x, z: cam.position.z };
    const y = youngPeek(c, me, lens, face);
    n += 1;
    assert.ok(!lineClear(cam.position, onBark(y.start, 0.06), [bark]), `${tag}: it starts behind the trunk from the lens`);
    // out past the root spurs by its own length: never in among them
    const out = dist(y.sit, c), need = trunkOutline(tr, 0) + YOUNG.len;
    assert.ok(out >= need - 1e-9, `${tag}: it sits ${out.toFixed(2)} m from the axis (the root spurs reach ${trunkOutline(tr, 0).toFixed(2)} m, + its length ${YOUNG.len}: want ${need.toFixed(2)})`);
    // sitting up there: whole in the picture and big enough
    const H0 = 0.33 * YOUNG.scale;
    const top = px(cam, y.sit, H0), bot = px(cam, y.sit, 0);
    assert.ok(!top.behind && top.x > 40 && top.x < W - 40 && top.y > 110 && bot.y < H - 30, `${tag}: it sits in the picture (${top.x.toFixed(0)}, ${top.y.toFixed(0)}-${bot.y.toFixed(0)})`);
    assert.ok(bot.y - top.y >= 40, `${tag}: ${(bot.y - top.y).toFixed(0)} px tall`);
    // whole: its foot, middle and head, and either side of it, clear of the trunk's outline
    // (root spurs and all), of the other pines and of him
    const g = groundY(y.sit.x, y.sit.z);
    const others: Upright[] = HOME_TREES.filter((o) => o !== c).map((o) => trunkUpright(trunk(o), groundY(o.x, o.z)));
    const boy: Upright = { x: me.x, z: me.z, y0: groundY(me.x, me.z), y1: groundY(me.x, me.z) + RANGER_STAND_HEIGHT * 1.1, r: () => 0.25 };
    const across = headingTo(lens, y.sit) + Math.PI / 2;
    for (const k of [0.1, 0.45, 0.85]) for (const u of [-0.08, 0, 0.08]) {
      const pt = { x: y.sit.x + Math.sin(across) * u, y: g + H0 * k, z: y.sit.z + Math.cos(across) * u };
      assert.ok(lineClear(cam.position, pt, [outline, boy, ...others]), `${tag}: it is seen whole (${k}, ${u})`);
    }
    // on dry, clear ground at the foot: off his feet, off every other pine's outline
    assert.ok(dist(y.sit, me) > 1.0, `${tag}: not at his feet (${dist(y.sit, me).toFixed(2)} m)`);
    assert.ok(HOME_TREES.every((o) => o === c || dist(o, y.sit) > trunkOutline(trunk(o), 0) + YOUNG.len), `${tag}: off the other pines`);
    assert.equal(biomeAt(y.sit.x, y.sit.z), 'bos', `${tag}: in the wood`);
    assert.ok(Math.abs(g - gc) < 0.4, `${tag}: on the ground by its tree (${(g - gc).toFixed(2)} m)`);
    // it runs out across the picture, not at the lens: from the trunk's edge to its sit it
    // comes at most a step nearer the lens
    const edgeAt = onBark(y.edge, 0.06);
    assert.ok(dist(edgeAt, lens) - dist(y.sit, lens) <= YOUNG.toLens, `${tag}: it comes ${(dist(edgeAt, lens) - dist(y.sit, lens)).toFixed(2)} m nearer the lens`);
    // away from him in the picture: him, ours on the bark, the little one on the ground — or,
    // where a pine stands in front of all of that side, past him on his side (ours, him, it)
    const tx = px(cam, c, 0.6).x, bx = px(cam, me, 0.9).x;
    if (y.side === 1) assert.ok(Math.sign(top.x - tx) === -Math.sign(bx - tx), `${tag}: on the far side of the trunk from him (${top.x.toFixed(0)} | trunk ${tx.toFixed(0)} | him ${bx.toFixed(0)})`);
    else {
      sides += 1;
      assert.ok(Math.abs(top.x - bx) > 60, `${tag}: on his side, apart from him (${top.x.toFixed(0)} | him ${bx.toFixed(0)} | trunk ${tx.toFixed(0)})`);
    }
    const ours = px(cam, onBark({ ang: face, h: HIDE.h }, 0.08), HIDE.h);
    assert.ok(Math.hypot(ours.x - top.x, ours.y - top.y) > 60, `${tag}: apart from ours in the picture`);
    // its way up ends out of the picture
    const upTop = px(cam, onBark(y.up, 0.06), y.up.h);
    assert.ok(upTop.y < 0 || upTop.behind || !lineClear(cam.position, onBark(y.up, 0.06), [bark]), `${tag}: it runs up out of the picture`);
  };
  for (const rid of ROUTE_IDS) {
    const c = ROUTES[rid].hide;
    // where a perfect player finds it (from his last wait's side)…
    const from = headingTo(c, comesFrom(ROUTES[rid], ROUTES[rid].waits.length - 1));
    for (let k = -6; k <= 6; k += 3) for (const d of [1.8, 2.6, 3.4]) {
      const start = { x: c.x + Math.sin(from + k * 0.17) * d, z: c.z + Math.cos(from + k * 0.17) * d };
      if (dist(start, seatOf(c)) > SEE_D || HOME_TREES.some((o) => dist(o, start) < trunkClear(o))) continue;
      const res = playHide(c, start, `${rid} young`);
      if (res.found) check(rid, c, res.sqAng, res.me, `${rid} played from ${deg(from + k * 0.17)}° ${d} m`);
    }
    // …and anywhere round the tree, either side of it, near or as far as he may find it from
    for (let a = -Math.PI; a < Math.PI; a += Math.PI / 6) for (const d of [1.2, 1.4, 2.2, 2.4, 3.2, 3.4, FIND_R]) {
      const at = { x: c.x + Math.sin(a + 0.5) * d, z: c.z + Math.cos(a + 0.5) * d };
      if (HOME_TREES.some((o) => dist(o, at) < trunkClear(o))) continue;
      check(rid, c, a, at, `${rid} ${deg(a)}° ${d} m`);
    }
  }
  assert.ok(n >= 150, `${n} finds`);
  // (his side is the exception, where a pine stands in front of the far one)
  assert.ok(sides <= n * 0.1, `${sides} of ${n} on his side`);
});

test('a play\'s finds: the nest tree and the dining spot from forks of their own (the way, the pattern and the neighbours do not move), replayed by the seed, each comes', () => {
  const nests = new Map<string, Set<number>>(), spots = new Map<string, Set<string>>();
  for (let s = 1; s <= 120; s++) {
    const p = drawEekhoornPlay(newPlay('eekhoorn', s, 1), null);
    assert.deepEqual(drawEekhoornPlay(newPlay('eekhoorn', s, 1), null), p, `seed ${s} replays`);
    assert.ok(p.nest >= 0 && p.nest < nestTrees(ROUTES[p.route]).length, `seed ${s}: a nest tree of its way`);
    assert.ok(ROUTE_DINING[p.route].includes(p.kegels), `seed ${s}: a dining spot of its way`);
    (nests.get(p.route) ?? nests.set(p.route, new Set()).get(p.route)!).add(p.nest);
    (spots.get(p.route) ?? spots.set(p.route, new Set()).get(p.route)!).add(p.kegels);
  }
  for (const id of ROUTE_IDS) {
    assert.equal(nests.get(id)?.size, nestTrees(ROUTES[id]).length, `${id}: every nest tree comes`);
    assert.equal(spots.get(id)?.size, 2, `${id}: both dining spots come`);
  }
});

test('fix-discovery-homes: a neighbour of a later visit (the nuthatch) never comes on his first play here, and comes after', () => {
  let later = 0;
  for (let s = 1; s <= 300; s++) {
    assert.notEqual(drawEekhoornPlay(newPlay('eekhoorn', s, 1), null, { n: 1 }).buren.stam, 'boomklever', `seed ${s}`);
    if (drawEekhoornPlay(newPlay('eekhoorn', s, 2), null, { n: 2 }).buren.stam === 'boomklever') later += 1;
  }
  assert.ok(later > 40, `from his second visit it comes (${later}/300)`);
});
