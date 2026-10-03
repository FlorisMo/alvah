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
  GLADE_VIEW, CALLERS_VIEW, SPOT_SCALE, SPOT_SIZE, SEE_D, SEEN_X, WAIT_H, WAIT_TURN, HIDE, gladeSpots, eekhoornTreeClear, eekhoornClearings, branchStub,
  seatOf, watchSpot, WATCH_R, SEAT_STOP, AT_IT, hideStart, hideShift, slipSecs, roundStep, trunkClear, wayTo, comesFrom, introView, foundView, foundFace,
  ROUTES, ROUTE_IDS, HIDE_TREES, FIELD_SYMS, NEIGHBOURS, NOT_TOGETHER, SQUIRREL_FAMILY, SLOTS, PERCH, JAY_WAIT, JAY_RETREAT, FIRST_TRIO,
  legalTrios, trioCode, trioOf, jayStep, variantOf, parseVariant, lastVariant, lastVariants, drawEekhoornPlay, VARIANT_KEY,
  type HomeTree, type Route, type Trio,
} from './eekhoorn.places.ts';
import { STUB_TILT } from '../../world/Forest.ts';
import { biomeAt, heightAt as groundY, VEN_CENTER, VEN_SHORE_R } from '../../Biomes.ts';
import { distanceToNetwork, LANE_HALF } from '../../Paths.ts';
import { dist, headingTo, toLocal, segDist, offCentre } from '../places.ts';
import { PRINT_SPOTS } from '../../../engines/corsi.ts';
import { SQ, barkRadius, lineClear, trunkFadeUpright, trunkUpright, type Trunk, type Upright } from '../squirrel-math.ts';
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
 *  home tree's clear ring must not take them away (the wood round the other homes stays). */
const SCATTER = [{ x: 14.4, z: -39.3 }, { x: 6.9, z: -41.9 }, { x: 29.8, z: -47.7 }, { x: 31.9, z: -48.7 }];
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

test('the found view: on his side of the tree, him whole at one side, the squirrel big at the other, off the middle', () => {
  let n = 0;
  for (const rid of ROUTE_IDS) {
    const c = ROUTES[rid].hide;
    const from = headingTo(c, comesFrom(ROUTES[rid], ROUTES[rid].waits.length - 1));
    for (let k = -6; k <= 6; k += 3) for (const d of [1.8, 2.6, 3.4]) {
      const start = { x: c.x + Math.sin(from + k * 0.17) * d, z: c.z + Math.cos(from + k * 0.17) * d };
      if (dist(start, seatOf(c)) > SEE_D || HOME_TREES.some((o) => dist(o, start) < trunkClear(o))) continue;
      const res = playHide(c, start, `${rid} found view`);
      if (!res.found) continue;
      n += 1;
      const f = foundView(c, res.sqAng, res.me);
      const cam = fitLens(f);
      const rr = barkRadius(trunk(c), HIDE.h) + 0.08;
      // (it comes out onto the near face once found)
      const face = foundFace(c, res.sqAng, res.me);
      assert.ok(Math.abs(wrapA(face - res.sqAng)) < 1.6, `${rid}: it comes out a short way round from where it was`);
      const sq = { x: c.x + Math.sin(face) * rr, z: c.z + Math.cos(face) * rr };
      const camD = Math.hypot(cam.position.x - sq.x, cam.position.z - sq.z);
      assert.ok(camD >= 2.4 && camD <= 4.2, `${rid}: the lens ${camD.toFixed(2)} m from the squirrel`);
      const camUp = cam.position.y - groundY(cam.position.x, cam.position.z);
      assert.ok(camUp >= 1.0 && camUp <= 2.0, `${rid}: the lens at ${camUp.toFixed(2)} m, about its height`);
      // turned off the line from him to it (his head not in front of it)
      const off = Math.abs(wrapA(headingTo(cam.position, sq) - headingTo(res.me, sq)));
      assert.ok(off >= (15 * Math.PI) / 180, `${rid}: the lens ${deg(off)}° off his line to it`);
      // big: its 0.3 m (with its tail) at least 60 px tall, in the picture, off the middle
      const top = px(cam, sq, HIDE.h + 0.3), bot = px(cam, sq, HIDE.h);
      assert.ok(!top.behind && Math.abs(bot.y - top.y) >= 60, `${rid}: it is ${Math.abs(bot.y - top.y).toFixed(0)} px tall`);
      assert.ok(top.x > 60 && top.x < W - 60 && top.y > 110 && bot.y < H - 80, `${rid}: it is in the picture (${top.x.toFixed(0)}, ${top.y.toFixed(0)})`);
      assert.ok(Math.abs(top.x - W / 2) >= 0.25 * (W / 2), `${rid}: well off the middle (${top.x.toFixed(0)} px)`);
      // him: whole in the picture, at the other side, the trunk between the lens and neither
      const head = px(cam, res.me, RANGER_STAND_HEIGHT), foot = px(cam, res.me, 0.05);
      assert.ok(!head.behind && head.x > 20 && head.x < W - 20 && head.y > 90 && foot.y < H, `${rid}: he is in the picture (${head.x.toFixed(0)}, ${head.y.toFixed(0)}–${foot.y.toFixed(0)})`);
      assert.ok(Math.sign(head.x - W / 2) !== Math.sign(top.x - W / 2), `${rid}: he and the squirrel at either side`);
      const bark = [trunkUpright(trunk(c), groundY(c.x, c.z))];
      assert.ok(lineClear(cam.position, { ...res.me, y: groundY(res.me.x, res.me.z) + 1.0 }, bark), `${rid}: the trunk is not in front of him`);
      assert.ok(lineClear(cam.position, { ...sq, y: groundY(sq.x, sq.z) + HIDE.h + 0.12 }, [{ ...bark[0], r: (y: number) => barkRadius(trunk(c), Math.max(0, y - groundY(c.x, c.z))) }]), `${rid}: the trunk is not in front of the squirrel`);
    }
  }
  assert.ok(n >= 6, `${n} finds framed`);
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
  assert.equal(lastVariant([{ m: 'eekhoorn', va: 'mood:zonnig' }]), null, 'an old play without a variant: a free draw');
  // the history keeps it whole after the mood and a rare (≤ 60 characters)
  const va = `mood:ochtendnevel,rare:donkere-eekhoorn,${VARIANT_KEY}:${variantOf({ route: 'midden', veld: 'spiegel-v', buren: { tak: 'roodborst', stam: 'grote-bonte-specht', top: 'koekoek' } })}`;
  assert.ok(va.length <= 60, `the longest variant line is ${va.length} characters`);
});
