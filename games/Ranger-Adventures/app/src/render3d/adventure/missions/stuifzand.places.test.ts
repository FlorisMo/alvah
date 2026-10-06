/**
 * stuifzand.places.test.ts — where "Het stille zand" happens is chosen by looking at the world;
 * this pins that every variant of it stays a good place (design `state/adventures/design.md`
 * §5, §6.4): the marker, the three scrapes and her two spots in each, the car's two routes, where
 * he stands to search, where the flushed parent flutters to, the guard place (the juniper and
 * its burrow, the open sand, the stop, the ways in and out), the anthill — dry sand inside the
 * world, clear of the solids, the sand path, the roaming boar and roe, the other markers and
 * every other home's ground; every spot partly visible from its search's lens (fitted to every
 * band's glimpse) and never in the middle of the picture; the look-alikes in the picture; the
 * visitors walk in from outside the guard's picture and leave out of it; a play is drawn from
 * its seed, never his last play's scrape, three plays in a row meet all three. Run: `npm test`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { heightAt as groundY, biomeAt } from '../../Biomes.ts';
import { RANGER_STAND_HEIGHT, SIZE } from '../../AnimalScale.ts';
import { fitFrame } from '../../play/frame-fit.ts';
import { dist, offCentre, segDist } from '../places.ts';
import { backPoints, growStems, visibleShare } from '../cover-math.ts';
import { fitWindow } from './ree.window.ts';
import { knobsFor } from '../../../core/skill.ts';
import { newPlay } from '../../../core/play.ts';
import { buildZoekenTrial } from '../../../engines/zoeken.ts';
import { AREA_VELUWE } from '../../../content/veluwe.ts';
import { ontdekkingenVan } from '../../../content/ontdekkingen.ts';
import { frislingClearings } from './frisling.places.ts';
import { reeClearings } from './ree.places.ts';
import { wildcameraClearings } from './wildcamera.places.ts';
import { eekhoornClearings } from './eekhoorn.places.ts';
import { venClearings } from './ven.places.ts';
import { ecoductClearings } from './ecoduct.places.ts';
import {
  ANTHILL, ARRIVE, BOAR_LOOP, BURROW, GUARD_STAND, GUARD_VIEW, GUESTS, HOL_JUNIPER, ZAND_RESIDENTS, headingTo, LEAVE, MARKER, NESTS, NEST_IDS, OPEN, PASSES, PRESSED_H, ROE_LOOP,
  SETTLE, SOLIDS, STOP, TAG_AT, ZAND_HOME, ZAND_PLACES, ZONES, ZWALUW_LEN, ON_PATH, OFF_PATH_S, PAD,
  COVER_SEED, DISPLAY_UP, FLUSH_BEFORE, GAPS_FROM, HER_ROOM, HER_REACT, ANTHILL_NEAR, BACK_SIDE, nestBackOf, nestBackVia, wayRound, allClumps, approachOf, closeViewOf, displayOf, displayYaw, endSpot, endViewOf, headingAt, larkFrom, pointAt, clearOfSolids, flushOf, gapsOf, gapsTo, lastVariants, lineDist, offPath, readVariant, routeOf, rutAlpha, setNestNow, slotsOf, zandClearings, zandLayout,
  type ViewSpec,
} from './stuifzand.places.ts';
import type { Spot } from '../types.ts';

const W = 1280, H = 800, FOV = 55;
const MISSION = AREA_VELUWE.missies.find((m) => m.id === 'stuifzand')!;

/** The other markers as the world places them (read with `__ranger.markers()`, 2026-10-05). */
const OTHER_MARKERS: Readonly<Record<string, Spot>> = {
  frisling: { x: -15.56, z: -15.56 }, 'ree-niet-aanraken': { x: -15.01, z: -27.12 }, wildcamera: { x: 15.56, z: -15.56 },
  ven: { x: 24.5, z: -19.0 }, ecoduct: { x: -45.5, z: 12.5 }, nachtronde: { x: 20.75, z: -34.2 },
  eekhoorn: { x: 25.42, z: -41.89 }, vos: { x: 35.81, z: -45.63 }, herstel: { x: -35.0, z: -19.37 },
};
const OTHER_HOMES = {
  frisling: frislingClearings(), ree: reeClearings(), wildcamera: wildcameraClearings(), eekhoorn: eekhoornClearings(),
  ven: venClearings(), ecoduct: ecoductClearings(),
};
const at = (p: Spot): string => `(${p.x.toFixed(1)}, ${p.z.toFixed(1)})`;
const beyond = (p: Spot, loop: { x: number; z: number; r: number }): number => dist(p, loop) - loop.r;

/** The lens the kit fits for a framed view (kit `lensFor` → Stage → play/frame-fit: a spot to
 *  include with a width `r` is two spots, `r` m either side of it), on a 1280×800 screen. */
function lensOf(f: ViewSpec): THREE.PerspectiveCamera {
  const fw = { x: Math.sin(f.heading), z: Math.cos(f.heading) };
  const right = { x: -Math.cos(f.heading), z: Math.sin(f.heading) };
  const include = (f.include ?? []).flatMap((q) => ((q.r ?? 0) > 0 ? [-q.r!, q.r!].map((u) => ({ x: q.x + right.x * u, z: q.z + right.z * u, h: q.h })) : [q]));
  const fit = fitFrame(f.at, fw, { tall: 1, pitchDeg: 34, insetTop: 96, insetBottom: 16, ...f, include }, groundY, FOV, W, H);
  const cam = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 400);
  cam.position.copy(fit.cam); cam.up.set(0, 1, 0); cam.lookAt(fit.look); cam.updateMatrixWorld(true);
  return cam;
}
/** A world point on the 1280×800 screen (px), and whether it is in front of the lens. */
function px(cam: THREE.Camera, x: number, y: number, z: number): { x: number; y: number; front: boolean } {
  const v = new THREE.Vector3(x, y, z).project(cam);
  const behind = new THREE.Vector3(x, y, z).applyMatrix4(cam.matrixWorldInverse).z > 0;
  return { x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * H, front: !behind };
}
/** Would an animal `h` m tall and `len` m long at `p` show anywhere in the picture (with a
 *  margin of `m` px beyond its edge)? */
function inPicture(cam: THREE.Camera, p: Spot, h: number, len: number, m = 0): boolean {
  const y = groundY(p.x, p.z);
  const r = len / 2;
  for (const [dx, dz, dy] of [[0, 0, 0.05], [0, 0, h], [r, 0, h * 0.6], [-r, 0, h * 0.6], [0, r, h * 0.6], [0, -r, h * 0.6]] as const) {
    const q = px(cam, p.x + dx, y + dy, p.z + dz);
    if (q.front && q.x > -m && q.x < W + m && q.y > -m && q.y < H + m) return true;
  }
  return false;
}

/* ------------------------------------------------------------- the ground ---- */

/** How far along its route a walk ends (m). */
function projectS(a: ReturnType<typeof approachOf>): number {
  let best = 0, bd = Infinity;
  for (let s = 0; s <= a.route.length; s += 0.05) { const p = pointAt(a.route, s); const d = dist(p, a.approach); if (d < bd) { bd = d; best = s; } }
  return best;
}

/** Every place a play uses, by name. */
function everyPlace(): [string, Spot][] {
  const out: [string, Spot][] = [['marker', MARKER], ['guard', GUARD_STAND], ['stop', STOP], ['open', OPEN], ['hol settle', SETTLE.hol], ['anthill', ANTHILL]];
  for (const n of NEST_IDS) {
    const N = NESTS[n];
    out.push([`nest ${n}`, N.c], [`nest ${n} roost`, N.roost], [`nest ${n} stand l`, N.stands.l], [`nest ${n} stand r`, N.stands.r], ...N.spots.map((s, i): [string, Spot] => [`nest ${n} spot ${i}`, s]));
    for (const side of PASSES) {
      const a = approachOf(n, side);
      out.push([`nest ${n}${side} approach`, a.approach]);
      for (const fl of PASSES) { const f = flushOf(n, side, fl); out.push([`nest ${n}${side} flush ${fl} land`, f.land], [`nest ${n}${side} flush ${fl} drag`, f.drag]); }
    }
  }
  return out;
}

test('every place is on the drift sand inside the world, clear of the solids, the sand path and the roaming animals', () => {
  for (const [name, p] of everyPlace()) {
    assert.ok(Math.hypot(p.x, p.z) < 66, `${name} ${at(p)} is inside the world`);
    assert.equal(biomeAt(p.x, p.z), 'stuifzand', `${name} ${at(p)} lies on the drift sand`);
    // (where the flushed parent comes down for a few seconds: ≥ 5.5 m; every other place ≥ 8 m)
    const loopGap = name.includes('flush') ? 5.5 : 8;
    assert.ok(beyond(p, BOAR_LOOP) >= loopGap, `${name} ${at(p)} keeps ≥ ${loopGap} m from the roaming boar's loop (${beyond(p, BOAR_LOOP).toFixed(1)})`);
    assert.ok(beyond(p, ROE_LOOP) >= loopGap, `${name} ${at(p)} keeps ≥ ${loopGap} m from the roaming roe's loop`);
    assert.ok(dist(p, PAD) >= PAD.r + (name.includes('flush') ? 1.2 : 2.5), `${name} ${at(p)} keeps off the helipad`);
    if (name === 'marker') continue;
    assert.ok(clearOfSolids(p, name.includes('flush') ? 0.9 : 0.6), `${name} ${at(p)} is clear of the junipers, the boulder and the helicopter`);
    assert.ok(offPath(p) >= 0.6, `${name} ${at(p)} lies off the sand path (${offPath(p).toFixed(2)} m beyond its edge)`);
  }
  // the marker stays where the world always put it, ≥ 10 m from every other marker
  for (const [id, m] of Object.entries(OTHER_MARKERS)) assert.ok(dist(MARKER, m) >= 10, `≥ 10 m from the ${id} marker`);
  assert.deepEqual(ZAND_HOME.marker, { at: MARKER, look: 'none' });
});

test('the home\'s ground overlaps no other home\'s ground', () => {
  const ours = zandClearings();
  for (const [name, theirs] of Object.entries(OTHER_HOMES)) {
    for (const a of ours) for (const b of theirs) {
      assert.ok(dist(a, b) > a.r + b.r, `our ground ${at(a)} (r ${a.r}) overlaps the ${name} home's ${at(b)} (r ${b.r})`);
    }
  }
});

/* ------------------------------------------------------------ the tracks ---- */

test('the car came up the sand path and off its end; each route passes every scrape close (never over her), clear of every solid', () => {
  for (const p of ON_PATH) assert.ok(offPath(p) < -0.8, `the car drove up the middle of the path ${at(p)}`);
  for (const side of PASSES) {
    const r = routeOf(side);
    assert.ok(r.length > OFF_PATH_S + 22, `the ${side} route crosses the sand (${r.length.toFixed(1)} m)`);
    for (const n of NEST_IDS) {
      const d = lineDist(NESTS[n].c, r.pts);
      assert.ok(d >= 1.9 && d <= 3.3, `the ${side} route passes scrape ${n} at ${d.toFixed(2)} m (1.9-3.3)`);
      for (const s of NESTS[n].spots) assert.ok(lineDist(s, r.pts) >= 1.5, `the ${side} route keeps ≥ 1.5 m from her spot ${at(s)} (its near rut ≥ 0.75 m)`);
    }
    for (const s of SOLIDS) assert.ok(lineDist(s, r.pts) >= s.r + 1.2, `the ${side} route passes ${at(s)} ≥ 1.2 m beyond its edge (${(lineDist(s, r.pts) - s.r).toFixed(2)})`);
    for (const p of [GUARD_STAND, STOP, OPEN, BURROW, HOL_JUNIPER]) assert.ok(lineDist(p, r.pts) >= 3.2, `the ${side} route keeps clear of the guard place ${at(p)}`);
    const end = r.pts[r.pts.length - 1];
    assert.ok(Math.hypot(end.x, end.z) < 66, 'the tracks end inside the world');
  }
});

test('the wind blew sand over the tracks: as many gaps as the level\'s legs, before the flush point, apart', () => {
  for (let band = 1; band <= 6; band++) {
    const k = knobsFor('zoeken', band);
    for (const n of NEST_IDS) for (const side of PASSES) {
      const a = approachOf(n, side);
      for (let seed = 1; seed <= 20; seed++) {
        const play = newPlay('stuifzand', seed, 1);
        const gaps = gapsOf(k.trailLegs, GAPS_FROM, gapsTo(a.passS), play.fork('sz-gaten').rng);
        assert.equal(gaps.length, Math.round(k.trailLegs) - 1, `band ${band} nest ${n}${side}: ${gaps.length} gaps`);
        let end = GAPS_FROM - 0.5;
        for (const g of gaps) {
          assert.ok(g.s >= end + 0.5 - 1e-9, `band ${band} nest ${n}${side} seed ${seed}: a gap starts at ${g.s.toFixed(2)} (≥ ${(end + 0.5).toFixed(2)})`);
          assert.ok(g.len >= 1.1 && g.len <= 2.4, `a gap is ${g.len.toFixed(2)} m long`);
          assert.ok(g.s + g.len <= a.passS - FLUSH_BEFORE - 1.39, 'every gap ends ≥ 1.4 m before the flush point');
          end = g.s + g.len;
        }
      }
    }
    const alpha = rutAlpha(k.trailClarity);
    assert.ok(alpha >= 0.3 && alpha <= 0.95, `band ${band}: the ruts drawn at ${alpha.toFixed(2)}`);
  }
  assert.ok(rutAlpha(knobsFor('zoeken', 1).trailClarity) > rutAlpha(knobsFor('zoeken', 6).trailClarity) + 0.3, 'fainter ruts at the top band');
});

test('a woodlark rises from open sand ahead of him wherever he walks along the tracks', () => {
  for (const n of NEST_IDS) for (const side of PASSES) {
    const a = approachOf(n, side);
    let tried = 0, found = 0;
    for (let s = OFF_PATH_S - 4; s < a.passS - FLUSH_BEFORE; s += 1) {
      const me = pointAt(a.route, s), h = headingAt(a.route, s);
      for (const ls of PASSES) {
        tried += 1;
        const p = larkFrom(me, h, ls);
        if (!p) continue;
        found += 1;
        assert.ok(clearOfSolids(p, 1) && offPath(p) > 0.5, `the lark rises from open sand ${at(p)}`);
      }
    }
    // (where a juniper or the path stands there, it rises a step further on)
    assert.ok(found >= tried * 0.6, `nest ${n}${side}: a lark spot along most of the walk (${found}/${tried})`);
  }
});

/* ------------------------------------------------------------ the search ---- */

test('the search: from where he stands, each of her spots is partly visible at every band\'s glimpse, off the middle, big enough', () => {
  for (const n of NEST_IDS) {
    const N = NESTS[n];
    for (const side of PASSES) {
    const view = N.views[side], stand = N.stands[side];
    const cam = lensOf(view);
    const eye = { x: cam.position.x, y: cam.position.y, z: cam.position.z };
    N.spots.forEach((s, j) => {
      const where = `nest ${n}${side} spot ${j}`;
      assert.ok(offCentre(view, s) >= 0.25, `${where}: never in the middle of the picture (${offCentre(view, s).toFixed(2)})`);
      const g = groundY(s.x, s.z);
      const c = px(cam, s.x, g + PRESSED_H * 0.6, s.z);
      assert.ok(c.front && c.x > 70 && c.x < W - 70 && c.y > (view.insetTop ?? 96) + 30 && c.y < H - 60, `${where}: in the picture's free band (${c.x.toFixed(0)}, ${c.y.toFixed(0)})`);
      assert.ok(Math.hypot(c.x - W / 2, c.y - H / 2) >= 120, `${where}: well off the picture's middle (${Math.hypot(c.x - W / 2, c.y - H / 2).toFixed(0)} px)`);
      const fx = Math.sin(s.yaw) * ZWALUW_LEN / 2, fz = Math.cos(s.yaw) * ZWALUW_LEN / 2;
      const head = px(cam, s.x + fx, g + 0.05, s.z + fz), tail = px(cam, s.x - fx, g + 0.05, s.z - fz);
      const long = Math.hypot(head.x - tail.x, head.y - tail.y);
      assert.ok(long >= 60, `${where}: she shows ${long.toFixed(0)} px long (≥ 60)`);
      const back = backPoints(s.x, g, s.z, s.yaw, ZWALUW_LEN, PRESSED_H);
      for (let band = 1; band <= 6; band++) {
        const glimpse = knobsFor('zoeken', band).glimpse;
        const stems = growStems(allClumps(), COVER_SEED, groundY).stems;
        const built = stems.map((q) => ({ h: q.h, lx: q.lx, lz: q.lz, r: q.r }));
        const before = visibleShare(back, eye, stems);
        assert.ok(before <= 0.4, `${where} band ${band}: the tufts as grown hide most of her (${before.toFixed(2)} shows)`);
        fitWindow(stems, built, eye, back, glimpse, { x: s.x, y: g, z: s.z });
        const share = visibleShare(back, eye, stems);
        assert.ok(share >= glimpse * 0.6 && share <= glimpse * 1.6, `${where} band ${band}: ${share.toFixed(2)} of her shows (glimpse ${glimpse})`);
      }
    });
    // the look-alikes' slots: in the picture, apart from her and each other
    const slots = slotsOf(n);
    slots.forEach((p, i) => {
      const c = px(cam, p.x, groundY(p.x, p.z) + 0.05, p.z);
      assert.ok(c.front && c.x > 50 && c.x < W - 50 && c.y > (view.insetTop ?? 96) + 10 && c.y < H - 40, `nest ${n}${side} slot ${i} in the picture (${c.x.toFixed(0)}, ${c.y.toFixed(0)})`);
      for (const s of N.spots) assert.ok(dist(p, s) >= 0.4, `nest ${n} slot ${i} ≥ 0.4 m from her spot (${dist(p, s).toFixed(2)})`);
      for (let j = 0; j < i; j++) assert.ok(dist(p, slots[j]) >= 0.35, `nest ${n} slots ${j} and ${i} apart`);
    });
    // he stands at the bottom of the picture, never over the scrape; the roost beyond her
    const headPx = px(cam, stand.x, groundY(stand.x, stand.z) + RANGER_STAND_HEIGHT, stand.z);
    const feetPx = px(cam, stand.x, groundY(stand.x, stand.z), stand.z);
    assert.ok(headPx.front && Math.abs(headPx.x - W / 2) > W * 0.12, `nest ${n}${side}: he stands at the side of the picture (head at ${headPx.x.toFixed(0)}, ${headPx.y.toFixed(0)})`);
    for (const p of [...N.spots, ...slotsOf(n)]) {
      const c = px(cam, p.x, groundY(p.x, p.z) + 0.06, p.z);
      // (his body: the band from his feet to his head, ~70 px wide)
      const t = Math.max(0, Math.min(1, (c.y - headPx.y) / Math.max(1, feetPx.y - headPx.y)));
      const bx = headPx.x + (feetPx.x - headPx.x) * t;
      const over = c.y > headPx.y - 30 && c.y < feetPx.y + 10 && Math.abs(c.x - bx) < 70;
      assert.ok(!over, `nest ${n}${side}: he never stands over ${at(p)} in the picture (${c.x.toFixed(0)}, ${c.y.toFixed(0)})`);
    }
    const a = approachOf(n, side);
    const step = dist(a.approach, stand);
    assert.ok(step <= 3.6, `nest ${n}${side}: from the walk's end he steps ${step.toFixed(1)} m to the stand`);
    assert.ok(dist(a.approach, N.roost) >= 3.2, `nest ${n}${side}: the resting parent is ${dist(a.approach, N.roost).toFixed(1)} m ahead when he stops`);
    }
  }
});

test('the look-alikes a play lays are the zoeken trial\'s (the 2D floor\'s set and count), on the scrape\'s slots', () => {
  const skin = MISSION.stappen[0].skin;
  for (let band = 1; band <= 6; band++) {
    const trial = buildZoekenTrial(skin, knobsFor('zoeken', band), newPlay('stuifzand', 7, 1).fork('zoeken').rng);
    assert.ok(trial.decoys.length <= slotsOf(1).length, `band ${band}: ${trial.decoys.length} look-alikes fit the eight slots`);
  }
});

/* ------------------------------------------------------------ the flush ---- */

test('the flushed parent flutters off sideways and ahead (never toward him or the lens), onto open sand in the held picture', () => {
  for (const n of NEST_IDS) for (const side of PASSES) for (const fl of PASSES) {
    const a = approachOf(n, side);
    const f = flushOf(n, side, fl);
    const where = `nest ${n}${side} flush ${fl}`;
    for (const s of NESTS[n].spots) assert.ok(dist(f.land, s) >= 2.4 && dist(f.drag, s) >= 2.4, `${where}: it shows away from her (${dist(f.land, s).toFixed(1)} m)`);
    const d = dist(a.approach, f.land);
    assert.ok(d >= 2.6 && d <= 6.2, `${where}: it comes down ${d.toFixed(1)} m from him`);
    // ahead of him (in front of the line through him across his way)
    const h = headingAt(a.route, OFF_PATH_S > 0 ? (a.passS - 0) * 0 + projectS(a) : 0);
    const ahead = (f.land.x - a.approach.x) * Math.sin(h) + (f.land.z - a.approach.z) * Math.cos(h);
    assert.ok(ahead > 0.8, `${where}: it flutters ahead of him (${ahead.toFixed(1)} m)`);
    // (away from her eggs: never nearer them than 2.6 m)
    for (const q of NESTS[n].spots) assert.ok(dist(f.land, q) >= 2.6 && dist(f.drag, q) >= 2.6, `${where}: it shows well away from her`);
    const cam = lensOf(f.view);
    // big enough to see it drag its wing: its length across the picture
    const g0 = groundY(f.drag.x, f.drag.z);
    const tip = px(cam, f.drag.x - ZWALUW_LEN / 2, g0 + 0.08, f.drag.z), tail = px(cam, f.drag.x + ZWALUW_LEN / 2, g0 + 0.08, f.drag.z);
    const tip2 = px(cam, f.drag.x, g0 + 0.08, f.drag.z - ZWALUW_LEN / 2), tail2 = px(cam, f.drag.x, g0 + 0.08, f.drag.z + ZWALUW_LEN / 2);
    const big = Math.max(Math.hypot(tip.x - tail.x, tip.y - tail.y), Math.hypot(tip2.x - tail2.x, tip2.y - tail2.y));
    assert.ok(big >= 40, `${where}: it shows ${big.toFixed(0)} px long (≥ 40)`);
    for (const p of [f.land, f.drag]) {
      const c = px(cam, p.x, groundY(p.x, p.z) + 0.1, p.z);
      assert.ok(c.front && c.x > 50 && c.x < W - 50 && c.y > 130 && c.y < H - 60, `${where}: ${at(p)} is in the held picture (${c.x.toFixed(0)}, ${c.y.toFixed(0)})`);
    }
    // it flies off out of the picture at last
    assert.ok(!inPicture(cam, f.away, 0.6, 0.6, 20) || dist(cam.position, { x: f.away.x, z: f.away.z } as Spot) > 15, `${where}: it flies off out of the picture`);
    assert.ok(Math.hypot(f.away.x, f.away.z) < 70, `${where}: it flies off inside the world`);
  }
});

/** How far (px) his body (feet to head, ±0.25 m round his middle) lies OUTSIDE the picture at
 *  its nearest point (negative: some of it shows), and how far INSIDE it at its deepest. */
function bodyOut(cam: THREE.Camera, me: Spot): { out: number; deepest: number } {
  const g = groundY(me.x, me.z);
  let out = Infinity, deepest = -Infinity;
  for (let h = 0; h <= 1.0001; h += 0.05) for (const dx of [-0.25, 0, 0.25]) for (const dz of [-0.25, 0, 0.25]) {
    const q = px(cam, me.x + dx, g + h * RANGER_STAND_HEIGHT, me.z + dz);
    if (!q.front) continue; // (behind the lens: not in its picture)
    const beyond = Math.max(-q.x, q.x - W, -q.y, q.y - H); // > 0: outside by that many px
    out = Math.min(out, beyond); deepest = Math.max(deepest, -beyond);
  }
  return { out, deepest };
}

test('back at the scrape: the close look shows her (and her eggs) big, his whole body out of its picture', () => {
  for (const n of NEST_IDS) {
    const N = NESTS[n];
    N.spots.forEach((s, j) => {
      const cam = lensOf(closeViewOf(n, j as 0 | 1));
      const g = groundY(s.x, s.z);
      const a = px(cam, s.x + Math.sin(s.yaw) * ZWALUW_LEN / 2, g + 0.06, s.z + Math.cos(s.yaw) * ZWALUW_LEN / 2);
      const b = px(cam, s.x - Math.sin(s.yaw) * ZWALUW_LEN / 2, g + 0.06, s.z - Math.cos(s.yaw) * ZWALUW_LEN / 2);
      const long = Math.hypot(a.x - b.x, a.y - b.y);
      const c = px(cam, s.x, g + 0.08, s.z);
      for (const side of PASSES) {
        const where = `nest ${n}${side} spot ${j}`;
        assert.ok(long >= 90, `${where}: close up she shows ${long.toFixed(0)} px long`);
        assert.ok(c.front && c.x > 160 && c.x < W - 160 && c.y > 180 && c.y < H - 100, `${where}: she is well in the close look (${c.x.toFixed(0)}, ${c.y.toFixed(0)})`);
        // he stepped back beside the lens's way in: feet to head, none of him in its picture
        const me = endSpot(n, side);
        const body = bodyOut(cam, me);
        assert.ok(body.out >= 30, `${where}: his whole body is out of the close look (nearest ${body.out.toFixed(0)} px beyond its edge)`);
        assert.ok(Math.hypot(cam.position.x - me.x, cam.position.z - me.z) > 0.9, `${where}: the lens stands clear of him`);
        for (const q of N.spots) assert.ok(dist(me, q) > 1.2, `${where}: he stands off her spot`);
        assert.ok(dist(me, N.stands[side]) < 1.3, `${where}: one step back from where he searched (${dist(me, N.stands[side]).toFixed(2)} m)`);
      }
    });
  }
});

/** Where a wing tip of the displaying male is (`a`: the wings' angle up from level), facing `yaw`. */
function tip(d: { x: number; y: number; z: number }, yaw: number, a: number, sign: 1 | -1): { x: number; y: number; z: number } {
  const lat = { x: -Math.cos(yaw), z: Math.sin(yaw) };
  return { x: d.x + lat.x * sign * 0.36 * Math.cos(a), y: d.y + 0.36 * Math.sin(a), z: d.z + lat.z * sign * 0.36 * Math.cos(a) };
}

test('the rare: in the dusk picture the male claps big and in the air, his shadow below, over her on her nest', () => {
  for (const n of NEST_IDS) {
    const N = NESTS[n];
    N.spots.forEach((s, j) => {
      const spot = j as 0 | 1;
      const d0 = displayOf(n, spot);
      const gd = groundY(d0.x, d0.z);
      const d = { x: d0.x, y: gd + DISPLAY_UP, z: d0.z };
      const yaw = displayYaw(n, spot);
      const view = endViewOf(n, spot);
      const cam = lensOf(view);
      // his open wings (nearly level, mid-beat) tip to tip, and the V of a clap: both big
      const [l1, l2] = [tip(d, yaw, 0.15, 1), tip(d, yaw, 0.15, -1)].map((q) => px(cam, q.x, q.y, q.z));
      const span = Math.hypot(l1.x - l2.x, l1.y - l2.y);
      const vee = [tip(d, yaw, 1.0, 1), tip(d, yaw, 1.0, -1), { x: d.x + Math.sin(yaw) * 0.16, y: d.y, z: d.z + Math.cos(yaw) * 0.16 }, { x: d.x - Math.sin(yaw) * 0.16, y: d.y - 0.08, z: d.z - Math.cos(yaw) * 0.16 }]
        .map((q) => px(cam, q.x, q.y, q.z));
      const box = { x0: Math.min(...vee.map((q) => q.x)), x1: Math.max(...vee.map((q) => q.x)), y0: Math.min(...vee.map((q) => q.y)), y1: Math.max(...vee.map((q) => q.y)) };
      const him = px(cam, d.x, d.y, d.z);
      const shadow = px(cam, d.x, gd, d.z);
      const her = px(cam, s.x, groundY(s.x, s.z) + 0.08, s.z);
      const toHer = Math.hypot(her.x - him.x, her.y - him.y);
      // what stands behind him in the picture: the sand, never the boulder or a juniper (the
      // ground where the line from the lens through him comes down)
      const c = cam.position, k = (c.y - gd) / (c.y - d.y);
      const bg = { x: c.x + (d.x - c.x) * k, z: c.z + (d.z - c.z) * k };
      const bgClear = Math.min(...SOLIDS.map((q) => dist(bg, q) - q.r), dist(bg, HOL_JUNIPER) - HOL_JUNIPER.r);
      for (const side of PASSES) {
        const where = `nest ${n}${side} spot ${j}`;
        assert.ok(span >= 150, `${where}: his open wings show ${span.toFixed(0)} px tip to tip (≥ 150)`);
        assert.ok(Math.max(box.x1 - box.x0, box.y1 - box.y0) >= 120, `${where}: his clap's V shows ${Math.max(box.x1 - box.x0, box.y1 - box.y0).toFixed(0)} px (≥ 120)`);
        assert.ok(him.front && Math.min(l1.x, l2.x, box.x0) > 60 && Math.max(l1.x, l2.x, box.x1) < W - 60 && box.y0 > (view.insetTop ?? 96) + 20 && him.y < H / 2,
          `${where}: he claps in the picture's free band, in its upper half (${him.x.toFixed(0)}, ${him.y.toFixed(0)})`);
        assert.ok(bgClear >= 0.5, `${where}: open sand behind him in the picture, no solid (${bgClear.toFixed(2)} m from one at ${at(bg)})`);
        assert.ok(shadow.front && shadow.y > box.y1 + 120 && shadow.y < H - 40, `${where}: his shadow on the sand well below him (${shadow.y.toFixed(0)} px; he ${him.y.toFixed(0)})`);
        assert.ok(her.front && her.x > 120 && her.x < W - 120 && her.y > H / 2 && her.y < H - 50 && toHer > 300, `${where}: she sits on her nest low in the picture, apart from him (${her.x.toFixed(0)}, ${her.y.toFixed(0)})`);
        // (the boy, a step back beside the way in: out of this picture too)
        const body = bodyOut(cam, endSpot(n, side));
        assert.ok(body.out >= 30, `${where}: his whole body is out of the dusk picture (nearest ${body.out.toFixed(0)} px beyond its edge)`);
      }
      // he rises from his branch to there: a short flight up, never straight over her
      assert.ok(dist(d0, s) >= 0.6 && dist(d0, N.roost) <= 2.6, `nest ${n} spot ${j}: he claps beside her (${dist(d0, s).toFixed(2)} m), near his branch (${dist(d0, N.roost).toFixed(2)} m)`);
    });
    assert.ok(DISPLAY_UP >= 1.0, 'he claps well up in the air');
  }
});

/* ------------------------------------------------------------- the guard ---- */

test('the guard place: both places, the stop and their names in one held view; he at its bottom; the visitors come and go out of it', () => {
  const cam = lensOf(GUARD_VIEW);
  const free = (p: Spot & { y?: number }, what: string, y = 0.1): void => {
    const c = px(cam, p.x, groundY(p.x, p.z) + (p.y ?? y), p.z);
    assert.ok(c.front && c.x > 60 && c.x < W - 60 && c.y > (GUARD_VIEW.insetTop ?? 96) + 8 && c.y < H - 40, `${what} ${at(p)} is in the picture's free band (${c.x.toFixed(0)}, ${c.y.toFixed(0)})`);
  };
  free(OPEN, 'the open sand'); free(BURROW, 'the burrow'); free(STOP, 'the stop'); free(SETTLE.open, 'the open sand\'s settle spot'); free(SETTLE.hol, 'the burrow\'s settle spot');
  free({ ...TAG_AT.open }, 'the name of the open sand', TAG_AT.open.y); free({ ...TAG_AT.hol }, 'the name of the burrow', TAG_AT.hol.y);
  // the two places far enough apart to point at; the stop between them
  const o = px(cam, OPEN.x, groundY(OPEN.x, OPEN.z), OPEN.z), b = px(cam, BURROW.x, groundY(BURROW.x, BURROW.z), BURROW.z), s = px(cam, STOP.x, groundY(STOP.x, STOP.z), STOP.z);
  assert.ok(Math.abs(o.x - b.x) > 520, `the open sand and the burrow lie ${Math.abs(o.x - b.x).toFixed(0)} px apart`);
  assert.ok(s.x > Math.min(o.x, b.x) + 160 && s.x < Math.max(o.x, b.x) - 160, 'the stop lies between them');
  // the open sand on his right, the burrow on his left (he faces north)
  assert.ok(o.x > b.x, 'the open sand on the right, the burrow on the left');
  // his head at the bottom, never over a place or the stop
  const head = px(cam, GUARD_STAND.x, groundY(GUARD_STAND.x, GUARD_STAND.z) + RANGER_STAND_HEIGHT, GUARD_STAND.z);
  const feet = px(cam, GUARD_STAND.x, groundY(GUARD_STAND.x, GUARD_STAND.z), GUARD_STAND.z);
  assert.ok(head.y > s.y + 60, `his head (${head.y.toFixed(0)} px) below the stop (${s.y.toFixed(0)})`);
  // every visitor big enough to watch at the stop (he decides by the animal, not its card):
  // ≥ 50 px on its longest side as it stands there, turned side-on to him
  for (const [id, key] of Object.entries(GUESTS)) {
    const r = ZAND_RESIDENTS.find((q) => q.key === key)!;
    const z = SIZE[r.animal as keyof typeof SIZE] as { h: number; len?: number };
    const h = r.height ?? z.h, len = (z.len ?? 0.5) * (h / z.h);
    const g = groundY(STOP.x, STOP.z);
    let longest = 0;
    for (const turn of [-1.3, 1.3, 1.4]) {
      const yaw = headingTo(STOP, GUARD_STAND) + turn;
      const fx = Math.sin(yaw) * len / 2, fz = Math.cos(yaw) * len / 2;
      const a = px(cam, STOP.x + fx, g + h * 0.5, STOP.z + fz), b = px(cam, STOP.x - fx, g + h * 0.5, STOP.z - fz);
      const top = px(cam, STOP.x, g + h, STOP.z), foot = px(cam, STOP.x, g, STOP.z);
      longest = Math.max(longest, Math.hypot(a.x - b.x, a.y - b.y), Math.hypot(top.x - foot.x, top.y - foot.y));
    }
    assert.ok(longest >= 50, `the ${id} shows ${longest.toFixed(0)} px at the stop (≥ 50)`);
  }
  // (he stands above the card at the bottom of the screen, never under it)
  assert.ok(feet.y < H - 150, `his feet (${feet.y.toFixed(0)} px) above the card`);
  // a visitor waits outside the picture before it comes, and leaves out of it
  for (const e of ['L', 'R'] as const) {
    assert.ok(!inPicture(cam, ARRIVE[e][0], 1.2, 1.3, 30), `the ${e} way in starts outside the picture ${at(ARRIVE[e][0])}`);
    assert.ok(inPicture(cam, ARRIVE[e][1], 0.3, 0.3), `the ${e} way in comes into the picture ${at(ARRIVE[e][1])}`);
  }
  for (const p of ['open', 'hol'] as const) {
    const last = LEAVE[p][LEAVE[p].length - 1];
    assert.ok(!inPicture(cam, last, 1.2, 1.3, 30), `the way out from the ${p} leaves the picture ${at(last)}`);
  }
  // the juniper is solid and the places clear of it; the zones round the places don't overlap
  assert.ok(dist(BURROW, HOL_JUNIPER) < HOL_JUNIPER.r + 0.6 && dist(BURROW, HOL_JUNIPER) > HOL_JUNIPER.r - 0.2, 'the burrow lies at the juniper\'s foot');
  assert.ok(dist(SETTLE.hol, HOL_JUNIPER) > HOL_JUNIPER.r + 0.3, 'one lies down beside the juniper, not in it');
  assert.ok(dist(ZONES.open, ZONES.hol) > ZONES.open.r + ZONES.hol.r + 0.4, 'the two places\' zones lie apart');
  assert.ok(dist(STOP, ZONES.open) > ZONES.open.r + 0.3 && dist(STOP, ZONES.hol) > ZONES.hol.r + 0.3, 'the stop lies outside both zones');
  assert.ok(dist(GUARD_STAND, ANTHILL) > 2.5, 'the anthill is not where he stands');
  assert.ok(!inPicture(cam, ANTHILL, 0.5, 0.9, 10), 'the anthill is out of the guard\'s picture');
  // (never in the foreground of a search or a flush: at most a small thing far behind it)
  const near = (cam: THREE.Camera): boolean => inPicture(cam, ANTHILL, 0.5, 0.9) && Math.hypot(cam.position.x - ANTHILL.x, cam.position.z - ANTHILL.z) < 10;
  for (const n of NEST_IDS) for (const side of PASSES) {
    assert.ok(!near(lensOf(NESTS[n].views[side])), `the anthill is out of scrape ${n}${side}'s search picture`);
    for (const fl of PASSES) assert.ok(!near(lensOf(flushOf(n, side, fl).view)), `the anthill is out of the flush picture ${n}${side}${fl}`);
  }
});

/* ------------------------------------------------------------- a play ---- */

test('a play is drawn from its seed: never his last play\'s scrape, three plays in a row meet all three; the variant reads back', () => {
  const seen = new Map<string, number>();
  for (let seed = 1; seed <= 60; seed++) {
    const a = zandLayout(newPlay('stuifzand', seed, 1));
    assert.deepEqual(zandLayout(newPlay('stuifzand', seed, 1)), a, 'the same seed, the same play');
    seen.set(a.variant, (seen.get(a.variant) ?? 0) + 1);
    const back = readVariant(a.variant);
    assert.deepEqual(back, { nest: a.nest, spot: a.spot, side: a.side });
    // three plays in a row
    const b = zandLayout(newPlay('stuifzand', seed + 1000, 2), [a.variant]);
    const c = zandLayout(newPlay('stuifzand', seed + 2000, 3), [a.variant, b.variant]);
    assert.notEqual(b.nest, a.nest, `seed ${seed}: the second play another scrape`);
    assert.equal(new Set([a.nest, b.nest, c.nest]).size, 3, `seed ${seed}: three plays, three scrapes`);
    // the car's route: never the last play's (the tracks and his walk another way each time)
    assert.notEqual(b.side, a.side, `seed ${seed}: the second play the other route`);
    assert.notEqual(c.side, b.side, `seed ${seed}: the third play the other route`);
  }
  assert.ok(seen.size >= 10, `the plays draw many variants (${seen.size})`);
  // the history's key round-trips
  const hist = [{ m: 'stuifzand', sd: 5, va: 'mood:bewolkt,sz:2a-l-r' }, { m: 'stuifzand', sd: 5, va: 'mood:bewolkt,sz:2a-l-r' }, { m: 'ven', sd: 6, va: 'ven:A1' }, { m: 'stuifzand', sd: 9, va: 'mood:schemer,rare:vlucht,sz:3b-r-l' }];
  assert.deepEqual(lastVariants(hist), ['2a-l-r', '3b-r-l']);
  // the variant fits the history's 60 characters beside the mood and the rare
  assert.ok(`mood:ochtendnevel,rare:vlucht,sz:${zandLayout(newPlay('stuifzand', 3, 1)).variant}`.length <= 60);
});

test('the home: its places table, its home follows the nest the pair lives at, its discoveries', () => {
  assert.ok(ZAND_PLACES.marker && ZAND_PLACES.guard && ZAND_PLACES.home, 'marker, guard and home');
  setNestNow(3, 1);
  assert.deepEqual({ ...ZAND_PLACES }.home, { x: NESTS[3].c.x, z: NESTS[3].c.z }, 'the home is the nest of the last play');
  setNestNow(2, 0);
  assert.deepEqual({ ...ZAND_PLACES }.home, { x: NESTS[2].c.x, z: NESTS[2].c.z });
  const rows = ontdekkingenVan('stuifzand');
  assert.ok(rows.length >= 5, `≥ 5 things to discover (${rows.length})`);
  assert.ok(rows.some((r) => r.soort === 'zeldzaam'), 'a rare one');
  assert.ok(rows.some((r) => r.geholpen), 'the animal the mission helps');
});

/* ------------------------------------------- fix-discovery-homes (2026-10-05) ---- */

/** A child who walks where the chip's arrow points (or the hint: the same way), 0.1 m a
 *  step, from `from` to the nest's back spot: the nearest he comes to her, and whether he
 *  got there. */
function followChip(from: Spot, back: Spot, her: Spot): { nearest: number; there: boolean } {
  let me = { ...from }, nearest = dist(me, her);
  for (let i = 0; i < 900; i++) {
    if (dist(me, back) < 0.7) return { nearest, there: true };
    const aim = wayRound(me, back, her) ?? back;
    const d = dist(me, aim) || 1;
    me = { x: me.x + ((aim.x - me.x) / d) * 0.1, z: me.z + ((aim.z - me.z) / d) * 0.1 };
    nearest = Math.min(nearest, dist(me, her));
  }
  return { nearest, there: false };
}

test('the walk back at dusk keeps ≥ 1.5 m from her, for every nest, side and spot: its end, its line, its chip', () => {
  assert.equal(BACK_SIDE, 'l', 'he comes back on the guard\'s side of the scrape');
  assert.ok(HER_REACT < HER_ROOM, 'she only reacts when he leaves the way');
  for (const n of NEST_IDS) {
    const back = nestBackOf(n);
    assert.ok(dist(back, GUARD_STAND) < dist(endSpot(n, 'r'), GUARD_STAND), `nest ${n}: the guard\'s side is the near side`);
    NESTS[n].spots.forEach((her, j) => {
      for (const side of PASSES) {
        const where = `nest ${n}${side} spot ${'ab'[j]}`;
        assert.ok(dist(back, her) >= HER_ROOM + 0.2, `${where}: the walk ends ${dist(back, her).toFixed(2)} m from her`);
        // the line a perfect player walks (golden's hint) from where he stood guard
        const line = [GUARD_STAND, ...nestBackVia(n, j as 0 | 1), back];
        const near = Math.min(...line.slice(1).map((q, i) => segDist(her, line[i], q)));
        assert.ok(near >= HER_ROOM, `${where}: the walk back passes ${near.toFixed(2)} m from her`);
        // a child who follows the chip's arrow, from where he stood guard and from anywhere
        // round the scrape he may have wandered to
        const starts: Spot[] = [GUARD_STAND, NESTS[n].stands[side], ...Array.from({ length: 16 }, (_, k) => ({ x: her.x + Math.sin(k * Math.PI / 8) * 4, z: her.z + Math.cos(k * Math.PI / 8) * 4 }))];
        for (const st of starts) {
          const f = followChip(st, back, her);
          assert.ok(f.there, `${where} from ${at(st)}: the chip brings him there`);
          assert.ok(f.nearest >= Math.min(HER_ROOM - 0.05, dist(st, her)), `${where} from ${at(st)}: following the chip he passes ${f.nearest.toFixed(2)} m from her`);
        }
      }
    });
  }
  // (the old way: straight to the search stand on the car's side passed her at 0.12 m)
  assert.ok(segDist(NESTS[2].spots[1], GUARD_STAND, NESTS[2].stands.r) < 0.5, 'the line the old walk took');
});

test('the anthill is his only once he walks right up to it: no walk of the story passes that near', () => {
  assert.ok(ANTHILL_NEAR <= 2.5, 'right up to it');
  for (const n of NEST_IDS) for (const side of PASSES) {
    const a = approachOf(n, side);
    assert.ok(lineDist(ANTHILL, a.route.pts) > ANTHILL_NEAR + 0.3, `${n}${side}: the tracks keep off it`);
    // to the juniper from where he searched, and back to the nest
    assert.ok(segDist(ANTHILL, NESTS[n].stands[side], GUARD_STAND) > ANTHILL_NEAR + 0.8, `${n}${side}: the walk to the juniper keeps off it (${segDist(ANTHILL, NESTS[n].stands[side], GUARD_STAND).toFixed(2)} m)`);
    for (const j of [0, 1] as const) {
      const line = [GUARD_STAND, ...nestBackVia(n, j), nestBackOf(n)];
      for (let i = 1; i < line.length; i++) assert.ok(segDist(ANTHILL, line[i - 1], line[i]) > ANTHILL_NEAR + 0.2, `${n} spot ${j}: the walk back keeps off it`);
    }
  }
});

test('the woodlark over the sand is a later visit\'s song: never his first play here', () => {
  let later = 0;
  for (let seed = 1; seed <= 300; seed++) {
    assert.equal(zandLayout({ ...newPlay('stuifzand', seed, 1), fork: newPlay('stuifzand', seed, 1).fork, n: 1 }).lark, null, `seed ${seed}`);
    const p2 = newPlay('stuifzand', seed, 2);
    if (zandLayout(p2).lark) later += 1;
    // (the rest of the play is drawn as before: the lark's own fork)
    assert.equal(zandLayout(newPlay('stuifzand', seed, 1)).variant, zandLayout(newPlay('stuifzand', seed, 2)).variant);
  }
  assert.ok(later > 140 && later < 220, `from his second visit about three plays in five (${later}/300)`);
});
