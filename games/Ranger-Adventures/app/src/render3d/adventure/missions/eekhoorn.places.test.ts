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
  NEST, nestTrees, nestOf, nestPeek, nestSolid, NEST_FADE, DINING, ROUTE_DINING, diningById, STRONK, STAM, DINING_SEE, SeenClock, denVisitor, DEN_VISITOR, youngPeek, YOUNG,
  type HomeTree, type Route, type Trio,
} from './eekhoorn.places.ts';
import { STUB_TILT } from '../../world/Forest.ts';
import { biomeAt, heightAt as groundY, VEN_CENTER, VEN_SHORE_R } from '../../Biomes.ts';
import { distanceToNetwork, LANE_HALF } from '../../Paths.ts';
import { dist, headingTo, toLocal, segDist, offCentre } from '../places.ts';
import { PRINT_SPOTS } from '../../../engines/corsi.ts';
import { SQ, barkRadius, lineClear, trunkFadeUpright, trunkOutline, trunkUpright, type Trunk, type Upright } from '../squirrel-math.ts';
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
  // lens costs 12k); the old home planted six trees
  assert.ok(HOME_TREES.length <= 11, `${HOME_TREES.length} home trees`);
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
function playHide(c: HomeTree, start: { x: number; z: number }, id: string): { found: boolean; slips: number; round: number; me: { x: number; z: number }; sqAng: number } {
  const cR = barkRadius(trunk(c), HIDE.h);
  let me = { ...start };
  let heading = headingTo(me, c);
  let camH = heading;
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
    if (hiding && (round >= HIDE.round || slips >= HIDE.most)) hiding = false;
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
    // …and anywhere on its side, near or as far as he may find it from
    for (let a = -Math.PI; a < Math.PI; a += Math.PI / 6) for (const d of [1.2, 2.2, 3.2, FIND_R]) {
      const me = { x: c.x + Math.sin(a + 0.5) * d, z: c.z + Math.cos(a + 0.5) * d };
      if (HOME_TREES.some((o) => dist(o, me) < trunkClear(o))) continue;
      check(rid, c, a, me);
    }
  }
  assert.ok(n >= 60, `${n} finds framed`);
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
    assert.deepEqual(parseVariant(variantOf(a)), { route: a.route, veld: a.veld, buren: a.buren }, 'its variant reads back');
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

test('the nest, every way: on a wait tree he comes to (never its hide tree), 2.1-2.5 m up on his side, apart from the stub, big in his lens where he waits for it', () => {
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
      assert.ok(Math.abs(wrapA(nest.ang - headingTo(t, comesFrom(r, i)))) <= 0.5, `${id}/${t.id}: on the side he comes from`);
      assert.ok(Math.abs(wrapA(nest.ang - t.branch!.ang)) >= 0.9, `${id}/${t.id}: well round the trunk from its stub (${deg(Math.abs(wrapA(nest.ang - t.branch!.ang)))}°)`);
      // hugging its bark: not floating off it, not inside it
      const bark = barkRadius(trunk(t), nest.y);
      assert.ok(dist(nest, t) > bark && dist(nest, t) < bark + NEST.r, `${id}/${t.id}: against the bark (${(dist(nest, t) - bark).toFixed(2)} m out)`);
      // where he stands to see the squirrel (golden's watch spot), facing it: the nest is in
      // his picture, below the line card, not behind a trunk or his head, big enough
      const w = watchSpot(t);
      const h = headingTo(w, seatOf(t));
      const at = { x: nest.x, y: g + nest.y, z: nest.z };
      const q = followPx(w, h, at);
      assert.ok(q.inside && q.x > 60 && q.x < W - 60 && q.y > 110 && q.y < H - 70, `${id}/${t.id}: in his picture at (${q.x.toFixed(0)}, ${q.y.toFixed(0)})`);
      const eye = { x: w.x - Math.sin(h) * LENS.back, y: groundY(w.x, w.z) + LENS.up, z: w.z - Math.cos(h) * LENS.back };
      const ups = HOME_TREES.filter((o) => o !== t).map((o) => trunkUpright(trunk(o), groundY(o.x, o.z)));
      ups.push({ ...trunkUpright(trunk(t), groundY(t.x, t.z)), r: (y: number) => barkRadius(trunk(t), Math.max(0, y - groundY(t.x, t.z))) });
      ups.push({ x: w.x, z: w.z, y0: groundY(w.x, w.z), y1: groundY(w.x, w.z) + RANGER_STAND_HEIGHT * 1.1, r: () => 0.22 });
      assert.ok(lineClear(eye, at, ups, 0.05), `${id}/${t.id}: no trunk and not his head between the lens and the nest`);
      assert.ok(pxAt(NEST.r * 2, q.d) >= 40, `${id}/${t.id}: it reads ${pxAt(NEST.r * 2, q.d).toFixed(0)} px`);
      // the squirrel peeking out of it is in the picture too (it says "Kijk, zijn nest!"),
      // its head under the line card, out of the ball on his side (not into the bark)
      const pk = nestPeek(nest, w);
      const qp = followPx(w, h, { x: pk.x, y: g + pk.y + 0.33, z: pk.z });
      assert.ok(qp.inside && qp.y > 104, `${id}/${t.id}: the squirrel peeking out of its nest is in the picture (${qp.x.toFixed(0)}, ${qp.y.toFixed(0)})`);
      assert.ok(dist(pk, t) > barkRadius(trunk(t), nest.y) + 0.12, `${id}/${t.id}: it peeks out of the ball, not out of the bark`);
      assert.ok(dist(pk, w) < dist(nest, w), `${id}/${t.id}: on his side of the nest`);
      // where he waits for the squirrel it stands solid; the follow lens trailing him on any
      // way never runs into it or looks past it at him: there it fades (as a home tree's
      // crown does), and the lens passes 0.6-0.8 m from some nests at its own height
      assert.equal(nestSolid({ x: eye.x, y: eye.y, z: eye.z }, at, { x: w.x, y: groundY(w.x, w.z), z: w.z }), 1, `${id}/${t.id}: solid where he waits for it`);
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
