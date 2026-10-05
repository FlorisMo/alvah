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
import { RANGER_STAND_HEIGHT } from '../../AnimalScale.ts';
import { fitFrame } from '../../play/frame-fit.ts';
import { dist, offCentre } from '../places.ts';
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
  ANTHILL, ARRIVE, BOAR_LOOP, BURROW, GUARD_STAND, GUARD_VIEW, HOL_JUNIPER, LARK_SPOTS, LEAVE, MARKER, NESTS, NEST_IDS, OPEN, PASSES, PRESSED_H, ROE_LOOP,
  SETTLE, SOLIDS, STOP, TAG_AT, ZAND_HOME, ZAND_PLACES, ZONES, ZWALUW_LEN, ON_PATH, OFF_PATH_S, PAD,
  FLUSH_BEFORE, GAPS_FROM, approachOf, clearOfSolids, flushOf, gapsOf, gapsTo, lastVariants, lineDist, nestClumps, offPath, readVariant, routeOf, rutAlpha, setNestNow, slotsOf, zandClearings, zandLayout,
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

/** Every place a play uses, by name. */
function everyPlace(): [string, Spot][] {
  const out: [string, Spot][] = [['marker', MARKER], ['guard', GUARD_STAND], ['stop', STOP], ['open', OPEN], ['hol settle', SETTLE.hol], ['anthill', ANTHILL],
    ...LARK_SPOTS.map((p, i): [string, Spot] => [`lark ${i}`, p])];
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
    assert.ok(beyond(p, BOAR_LOOP) >= 8, `${name} ${at(p)} keeps ≥ 8 m from the roaming boar's loop (${beyond(p, BOAR_LOOP).toFixed(1)})`);
    assert.ok(beyond(p, ROE_LOOP) >= 8, `${name} ${at(p)} keeps ≥ 8 m from the roaming roe's loop`);
    assert.ok(dist(p, PAD) >= PAD.r + 2.5, `${name} ${at(p)} keeps off the helipad`);
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

/* ------------------------------------------------------------ the search ---- */

test('the search: from where he stands, each of her spots is partly visible at every band\'s glimpse, off the middle, big enough', () => {
  for (const n of NEST_IDS) {
    const N = NESTS[n];
    const clumps = nestClumps(n);
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
      const fx = Math.sin(s.yaw) * ZWALUW_LEN / 2, fz = Math.cos(s.yaw) * ZWALUW_LEN / 2;
      const head = px(cam, s.x + fx, g + 0.05, s.z + fz), tail = px(cam, s.x - fx, g + 0.05, s.z - fz);
      const long = Math.hypot(head.x - tail.x, head.y - tail.y);
      assert.ok(long >= 60, `${where}: she shows ${long.toFixed(0)} px long (≥ 60)`);
      const back = backPoints(s.x, g, s.z, s.yaw, ZWALUW_LEN, PRESSED_H);
      for (let band = 1; band <= 6; band++) {
        const glimpse = knobsFor('zoeken', band).glimpse;
        const stems = growStems(clumps, 70 + n, groundY).stems;
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
    assert.ok(d >= 3.8 && d <= 6.2, `${where}: it comes down ${d.toFixed(1)} m from him`);
    // ahead of him (in front of the line through him across his way)
    const h = a.approach.heading!;
    const ahead = (f.land.x - a.approach.x) * Math.sin(h) + (f.land.z - a.approach.z) * Math.cos(h);
    assert.ok(ahead > 1.2, `${where}: it flutters ahead of him (${ahead.toFixed(1)} m)`);
    const cam = lensOf(f.view);
    for (const p of [f.land, f.drag]) {
      const c = px(cam, p.x, groundY(p.x, p.z) + 0.1, p.z);
      assert.ok(c.front && c.x > 80 && c.x < W - 80 && c.y > 130 && c.y < H - 60, `${where}: ${at(p)} is in the held picture (${c.x.toFixed(0)}, ${c.y.toFixed(0)})`);
    }
    // it flies off out of the picture at last
    assert.ok(!inPicture(cam, f.away, 0.6, 0.6, 20) || dist(cam.position, { x: f.away.x, z: f.away.z } as Spot) > 15, `${where}: it flies off out of the picture`);
    assert.ok(Math.hypot(f.away.x, f.away.z) < 70, `${where}: it flies off inside the world`);
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
  assert.ok(head.y > s.y + 60, `his head (${head.y.toFixed(0)} px) below the stop (${s.y.toFixed(0)})`);
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
    // with the same scrape again later, the car passed it on the other side
    const d = zandLayout(newPlay('stuifzand', seed + 3000, 4), [a.variant, b.variant, c.variant]);
    const lastSame = [a, b, c].filter((x) => x.nest === d.nest).pop();
    if (lastSame) assert.notEqual(d.side, lastSame.side, `seed ${seed}: scrape ${d.nest} again, the other route`);
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
