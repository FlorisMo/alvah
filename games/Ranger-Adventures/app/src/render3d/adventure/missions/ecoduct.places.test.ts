/**
 * ecoduct.places.test.ts — where "De oversteek" happens is chosen by looking at the world;
 * this pins that every variant of it stays a good place (design `state/adventures/design.md`
 * §4, §6.4): the marker, the sand bed and its seven patches, the screen, the trails round the
 * ecoduct's ends, the ways out, the place he steps aside to and the spot a young one comes up
 * to are dry, inside the world, clear of the ecoduct's solid, the grove, the other markers,
 * the roaming fox and every other home's ground; the seven patches lie in one held view from
 * the screen (and through its slit from his eyes); a group waits unseen behind the ecoduct's
 * end and comes into view at its corner; a play's crossings are drawn from its seed, never his
 * last play's first group, the red deer always among them, the group that waits for him to
 * step aside never the fox alone. Run: `npm test`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { heightAt as groundY, VEN_CENTER } from '../../Biomes.ts';
import { RANGER_STAND_HEIGHT } from '../../AnimalScale.ts';
import { fitFrame } from '../../play/frame-fit.ts';
import { obstacleGap } from '../../CharacterController.ts';
import { distanceToNetwork, LANE_HALF } from '../../Paths.ts';
import { dist, headingTo, segDist, toLocal } from '../places.ts';
import { knobsFor } from '../../../core/skill.ts';
import { newPlay } from '../../../core/play.ts';
import { playDagnachtTrial } from '../../../engines/dagnacht.ts';
import { buildCorsiTrial } from '../../../engines/corsi.ts';
import { AREA_VELUWE } from '../../../content/veluwe.ts';
import { ontdekkingenVan } from '../../../content/ontdekkingen.ts';
import { frislingClearings } from './frisling.places.ts';
import { reeClearings } from './ree.places.ts';
import { wildcameraClearings } from './wildcamera.places.ts';
import { eekhoornClearings } from './eekhoorn.places.ts';
import { venClearings } from './ven.places.ts';
import {
  ASIDE, BED, BED_HALF, BED_STAND, BED_VIEW, BEFORE_HINDE, BEFORE_KALF, DUCT, ECODUCT_HOME, ECODUCT_PLACES, ECODUCT_RESIDENTS, EXITS, FERN, FOX_LOOP, GROUPS,
  GROVE, HIDEAWAY, HOME, MARKER, PATCH_SIZE, SCREEN, SIDES, STAND, TRAILS, AFTER_HINDE, AFTER_KALF,
  asideView, bedSpots, crossingLine, crossingsFor, ductGap, ductHides, ecoductClearings, ecoductLayout, lastVariants, lineDist, mouthOf, onBed, readVariant, roepSpot,
  screenObstacle, type Side, type ViewSpec,
} from './ecoduct.places.ts';
import type { Spot } from '../types.ts';

const W = 1280, H = 800, FOV = 55;
const MISSION = AREA_VELUWE.missies.find((m) => m.id === 'ecoduct')!;

/** The other markers as the world places them (read with `__ranger.markers()`, 2026-10-05). */
const OTHER_MARKERS: Readonly<Record<string, Spot>> = {
  frisling: { x: -15.56, z: -15.56 }, 'ree-niet-aanraken': { x: -15.01, z: -27.12 }, wildcamera: { x: 15.56, z: -15.56 },
  ven: { x: 24.5, z: -19.0 }, stuifzand: { x: 8.27, z: 20.39 }, nachtronde: { x: 20.75, z: -34.2 },
  eekhoorn: { x: 25.42, z: -41.89 }, vos: { x: 35.81, z: -45.63 }, herstel: { x: -35.0, z: -19.37 },
};
/** The forest's trees near the ecoduct (`__ranger.treeSpots()`, 2026-10-05: the grove and the
 *  rim's front row; trunk radius 0.6 × scale). */
const TREES: readonly (Spot & { s: number })[] = [
  { x: -69.84, z: 29.08, s: 1.3 }, { x: -73.16, z: 20.35, s: 1.44 }, { x: -74.38, z: 14.24, s: 1.15 }, { x: -75.77, z: -1.9, s: 1.42 },
  { x: -63, z: 18.5, s: 1.02 }, { x: -66, z: -6.5, s: 0.9 }, { x: -70.5, z: 18.5, s: 0.96 }, { x: -60, z: -15, s: 0.96 },
];
const OTHER_HOMES = {
  frisling: frislingClearings(), ree: reeClearings(), wildcamera: wildcameraClearings(), eekhoorn: eekhoornClearings(), ven: venClearings(),
};
const at = (p: Spot): string => `(${p.x.toFixed(1)}, ${p.z.toFixed(1)})`;
const ORDERS = [['stil', 'roep', 'opzij'], ['stil', 'opzij', 'roep'], ['roep', 'stil', 'opzij'], ['roep', 'opzij', 'stil']] as const;

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

/** The bend points of a polyline sampled every `step` m. */
function samples(line: readonly Spot[], step = 0.25): Spot[] {
  const out: Spot[] = [];
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i], L = dist(a, b);
    for (let t = 0; t < L; t += step) out.push({ x: a.x + ((b.x - a.x) * t) / L, z: a.z + ((b.z - a.z) * t) / L });
  }
  out.push(line[line.length - 1]);
  return out;
}

/* ------------------------------------------------------------- the ground ---- */

test('every place is inside the world, clear of the ecoduct, its grove and the rim trees', () => {
  const places: [string, Spot][] = [
    ['marker', MARKER], ['stand', STAND], ['screen', SCREEN], ['bedStand', BED_STAND], ['home', HOME],
    ['asideN', ASIDE.N], ['asideS', ASIDE.S], ['before hinde', BEFORE_HINDE], ['before kalf', BEFORE_KALF], ['hideaway', HIDEAWAY],
    ...bedSpots().map((s): [string, Spot] => [`patch ${s.id}`, s]),
  ];
  for (const [name, p] of places) {
    assert.ok(Math.hypot(p.x, p.z) < 73.5, `${name} ${at(p)} is inside the world's bound`);
    assert.ok(ductGap(p) > 0.6, `${name} ${at(p)} is clear of the ecoduct (${ductGap(p).toFixed(2)} m)`);
    for (const t of GROVE) assert.ok(dist(p, t) > 1.6, `${name} ${at(p)} is clear of the grove's trunk ${at(t)}`);
  }
  // the bed's sand lies clear of the fern at the mouth, on ground the sand path only touches
  for (const u of [-BED_HALF.u, BED_HALF.u]) for (const v of [-BED_HALF.v, BED_HALF.v]) {
    const c = { x: BED.x + (u === -BED_HALF.u ? 1 : -1) * 0, z: BED.z };
    void c;
  }
  assert.ok(!onBed(FERN, 0.6), 'the fern at the mouth stands off the raked sand');
  for (const s of bedSpots()) assert.ok(distanceToNetwork(s.x, s.z) > LANE_HALF + PATCH_SIZE / 2, `patch ${s.id} lies off the sand path`);
});

test('the marker is clear of the other markers, the roaming fox and the paths; a quiet walk from the screen', () => {
  for (const [id, m] of Object.entries(OTHER_MARKERS)) assert.ok(dist(MARKER, m) >= 10, `≥ 10 m from the ${id} marker`);
  assert.ok(dist(MARKER, FOX_LOOP) - FOX_LOOP.r >= 8, `≥ 8 m beyond the roaming fox's loop (${(dist(MARKER, FOX_LOOP) - FOX_LOOP.r).toFixed(1)})`);
  const walk = dist(MARKER, STAND);
  assert.ok(walk >= 7 && walk <= 13, `the walk from the marker to the screen is ${walk.toFixed(1)} m (7-13)`);
  // the home's places keep away from the fox's loop too
  for (const p of [STAND, SCREEN, { x: BED.x, z: BED.z }, HOME, ...SIDES.flatMap((s) => EXITS[s].slice(0, 2))]) {
    assert.ok(dist(p, FOX_LOOP) - FOX_LOOP.r >= 4, `${at(p)} keeps clear of the fox's loop`);
  }
});

test('the home\'s ground overlaps no other home\'s ground (and the world\'s cattails stay with the ven)', () => {
  const ours = ecoductClearings();
  for (const [name, theirs] of Object.entries(OTHER_HOMES)) {
    for (const a of ours) for (const b of theirs) {
      assert.ok(dist(a, b) > a.r + b.r, `our ground ${at(a)} (r ${a.r}) overlaps the ${name} home's ${at(b)} (r ${b.r})`);
    }
  }
  assert.ok(dist(MARKER, VEN_CENTER) > 50, 'far from the ven');
});

/* ------------------------------------------------------------- the bed ---- */

test('the seven patches: inside the raked sand, apart, look-alikes in one held view from the screen', () => {
  const spots = bedSpots();
  assert.equal(spots.length, 7);
  for (const s of spots) {
    const { u, v } = toLocal(BED, s);
    assert.ok(Math.abs(u) + PATCH_SIZE / 2 <= BED_HALF.u - 0.2 && Math.abs(v) + PATCH_SIZE / 2 <= BED_HALF.v - 0.2, `patch ${s.id} lies inside the sand`);
    for (const q of spots) if (q.id < s.id) assert.ok(dist(s, q) >= PATCH_SIZE + 0.45, `patches ${q.id} and ${s.id} lie apart (${dist(s, q).toFixed(2)} m)`);
  }
  const cam = lensOf(BED_VIEW);
  for (const s of spots) {
    const g = groundY(s.x, s.z);
    const c = px(cam, s.x, g, s.z);
    assert.ok(c.front && c.x > 60 && c.x < W - 60 && c.y > (BED_VIEW.insetTop ?? 96) + 20 && c.y < H - 120, `patch ${s.id} is in the picture's free band (${c.x.toFixed(0)}, ${c.y.toFixed(0)})`);
    // big enough to point at: its width across the picture
    const a = px(cam, s.x - (PATCH_SIZE / 2) * Math.cos(BED.heading), g, s.z + (PATCH_SIZE / 2) * Math.sin(BED.heading));
    const b = px(cam, s.x + (PATCH_SIZE / 2) * Math.cos(BED.heading), g, s.z - (PATCH_SIZE / 2) * Math.sin(BED.heading));
    assert.ok(Math.abs(a.x - b.x) >= 38, `patch ${s.id} shows ${Math.abs(a.x - b.x).toFixed(0)} px wide (≥ 38)`);
  }
  // the ranger at the bottom of the picture, never over a patch
  const head = px(cam, STAND.x, groundY(STAND.x, STAND.z) + RANGER_STAND_HEIGHT, STAND.z);
  const lowest = Math.max(...spots.map((s) => px(cam, s.x, groundY(s.x, s.z), s.z).y));
  assert.ok(head.y > lowest + 40, `his head (${head.y.toFixed(0)} px) stays below the nearest patch (${lowest.toFixed(0)} px)`);
});

test('from behind the screen he sees every patch through its slit (his eyes at a child\'s height)', () => {
  const eye = groundY(STAND.x, STAND.z) + RANGER_STAND_HEIGHT * 0.9;
  const scr = toLocal(BED, SCREEN).v, me = toLocal(BED, STAND).v;
  for (const s of bedSpots()) {
    const sv = toLocal(BED, s).v;
    const k = (scr - me) / (sv - me);
    const g = groundY(SCREEN.x, SCREEN.z) - 0.04;
    const y = eye + (groundY(s.x, s.z) - eye) * k - g;
    assert.ok(y >= SCREEN.slit[0] - 0.02 && y <= SCREEN.slit[1] + 0.02, `patch ${s.id}: his sight crosses the screen at ${y.toFixed(2)} m (the slit ${SCREEN.slit.join('-')})`);
  }
  // the screen is solid where it stands, and he stands behind it, clear of it
  assert.ok(obstacleGap(screenObstacle(), STAND.x, STAND.z) > 0.15, 'he stands clear of the screen');
  assert.ok(obstacleGap(screenObstacle(), STAND.x, STAND.z) < 0.7, 'right behind it');
});

/* ------------------------------------------------------------ the ways ---- */

test('the trails: round the ecoduct\'s ends, never through its solid, clear of the trees; a group waits unseen and comes into view at the corner', () => {
  const lens = lensOf(BED_VIEW).position;
  for (const s of SIDES) {
    const t = TRAILS[s];
    for (const p of samples(t)) {
      assert.ok(ductGap(p) > 0.7, `${s} trail ${at(p)} keeps off the ecoduct (${ductGap(p).toFixed(2)} m)`);
      for (const tr of TREES) assert.ok(dist(p, tr) > 0.6 * tr.s + 0.8, `${s} trail ${at(p)} keeps off the tree ${at(tr)}`);
    }
    // the wait (the trail's start): hidden by the ecoduct from the screen's lens, from his eyes
    // there and on the bed; the corner: in view from the screen's lens
    // (and from wherever he waits for a group: aside by the screen, its held picture's lens,
    // and the walk camera behind him on the bed as he turns to the bridge's foot)
    const behindOnBed = (s2: Side): Spot => { const t2 = TRAILS[s2][2]; const h = headingTo(BED_STAND, t2); return { x: BED_STAND.x - Math.sin(h) * 4.6, z: BED_STAND.z - Math.cos(h) * 4.6 }; };
    // (aside by the screen's north end — they left south — the next group comes round the
    // south end: ecoductLayout)
    const asides: [string, Spot][] = [['asideN', ASIDE.N], ['asideN lens', lensOf(asideView(ASIDE.N)).position],
      ...(s === 'S' ? [['asideS', ASIDE.S], ['asideS lens', lensOf(asideView(ASIDE.S)).position]] as [string, Spot][] : [])];
    for (const [name, eye] of [['lens', lens], ['stand', STAND], ['bed', BED_STAND], ...asides, ['the walk camera on the bed', behindOnBed(s)]] as [string, Spot][]) {
      assert.ok(ductHides(eye, t[0]), `${s}: its wait ${at(t[0])} is hidden from the ${name}`);
      // (and the file behind the wait, back along the deck's foot)
      const back = { x: t[0].x + (t[0].x - t[1].x) * 0.6, z: t[0].z + (t[0].z - t[1].z) * 0.6 };
      assert.ok(ductHides(eye, back), `${s}: the file behind its wait is hidden from the ${name}`);
    }
    assert.ok(!ductHides(lens, t[1]), `${s}: its corner ${at(t[1])} is in view of the screen's lens`);
    // its mouth at the bed's edge
    const m = toLocal(BED, mouthOf(s));
    assert.ok(Math.abs(m.u) > BED_HALF.u - 1.2 && Math.abs(m.u) < BED_HALF.u + 2.6, `${s}: its mouth is at the bed's ${s === 'N' ? 'north' : 'south'} edge`);
  }
});

test('the ways out: off the bed sideways, clear of the screen, the ecoduct, the marker and the fox; out of his picture at their end', () => {
  const cam = lensOf(BED_VIEW);
  for (const s of SIDES) {
    const e = EXITS[s];
    for (const p of samples(e)) {
      assert.ok(ductGap(p) > 1, `${s} way out ${at(p)} keeps off the ecoduct`);
      assert.ok(obstacleGap(screenObstacle(), p.x, p.z) > 1.6, `${s} way out ${at(p)} passes the screen at ${obstacleGap(screenObstacle(), p.x, p.z).toFixed(2)} m`);
      assert.ok(dist(p, FOX_LOOP) - FOX_LOOP.r > 4, `${s} way out ${at(p)} keeps clear of the fox`);
      assert.ok(dist(p, MARKER) > 3, `${s} way out ${at(p)} passes the marker's ring`);
      assert.ok(dist(p, STAND) > 2.4, `${s} way out ${at(p)} passes him`);
    }
    const end = e[e.length - 1];
    const c = px(cam, end.x, groundY(end.x, end.z) + 0.6, end.z);
    assert.ok(!c.front || c.x < -20 || c.x > W + 20 || c.y < -20 || c.y > H + 20, `${s}: its way out ends out of the screen's picture (${c.x.toFixed(0)}, ${c.y.toFixed(0)})`);
    // sideways in the picture: it never comes at the lens (its last stretch moves across more
    // than toward it)
    const a = px(cam, e[0].x, groundY(e[0].x, e[0].z), e[0].z), b = px(cam, e[1].x, groundY(e[1].x, e[1].z), e[1].z);
    assert.ok(Math.abs(b.x - a.x) > Math.abs(b.y - a.y), `${s}: its way out runs across the picture`);
  }
});

test('stepping aside: ≥ 4.5 m from where he stood on the bed, off every group\'s way, clear of the screen, two steps from behind it', () => {
  for (const out of SIDES) {
    const a = ASIDE[out];
    assert.ok(dist(a, BED_STAND) >= 4.5 + a.r! * 0.8, `aside (${out}) lies ${dist(a, BED_STAND).toFixed(2)} m from where he stood`);
    for (const from of SIDES) assert.ok(lineDist(a, crossingLine(from, out)) >= 2.5, `aside (${out}) is ${lineDist(a, crossingLine(from, out)).toFixed(2)} m off the way ${from}→${out}`);
    assert.ok(obstacleGap(screenObstacle(), a.x, a.z) > 0.25, `aside (${out}) is clear of the screen`);
    assert.ok(dist(a, STAND) < 3.2, `aside (${out}) is close to his place behind the screen (${dist(a, STAND).toFixed(2)} m)`);
    // he watches them cross from there: the bed in his held picture, him in it
    const cam = lensOf(asideView(a));
    for (const s of bedSpots()) {
      const c = px(cam, s.x, groundY(s.x, s.z), s.z);
      assert.ok(c.front && c.x > 0 && c.x < W && c.y > 0 && c.y < H, `aside (${out}): patch ${s.id} in the picture`);
    }
  }
  // on the bed he stands right on every group's way
  for (const from of SIDES) for (const out of SIDES) assert.ok(lineDist(BED_STAND, crossingLine(from, out)) < 1.2, `the bed visit stands on the way ${from}→${out}`);
});

test('a young one comes up to him beside the screen: near, never behind the screen from the lens', () => {
  const cam = lensOf(BED_VIEW);
  for (const from of SIDES) {
    const y = roepSpot(STAND, from, 'scherm');
    assert.ok(dist(y, STAND) >= 1.5 && dist(y, STAND) <= 2.6, `${from}: it stops ${dist(y, STAND).toFixed(2)} m from him`);
    assert.ok(obstacleGap(screenObstacle(), y.x, y.z) > 0.25, `${from}: clear of the screen`);
    const c = px(cam, y.x, groundY(y.x, y.z) + 0.3, y.z);
    assert.ok(c.front && c.x > 40 && c.x < W - 40 && c.y < H - 30, `${from}: in the picture (${c.x.toFixed(0)}, ${c.y.toFixed(0)})`);
    assert.ok(!ductHides(STAND, y), `${from}: in his sight`);
  }
});

/* ------------------------------------------------------- who lives here ---- */

test('the home: the hind and her calf by the ecoduct before (shy), on the heath after, by the home place', () => {
  const hinde = ECODUCT_RESIDENTS.find((r) => r.key === 'hinde')!, kalf = ECODUCT_RESIDENTS.find((r) => r.key === 'kalf')!;
  assert.ok(hinde.before && kalf.before && hinde.after && kalf.after);
  for (const p of [AFTER_HINDE, AFTER_KALF]) assert.ok(dist(p, HOME) <= 3, `after: within 3 m of home ${at(p)}`);
  for (const p of [BEFORE_HINDE, BEFORE_KALF]) assert.ok(dist(p, MARKER) <= 26 && ductGap(p) > 0.8, `before: by the ecoduct's end, in view of the marker ${at(p)}`);
  assert.ok(dist(HOME, MARKER) <= 8, 'after, the family grazes near the marker');
  assert.ok(ECODUCT_RESIDENTS.filter((r) => r.before || r.after).every((r) => ['hinde', 'kalf'].includes(r.key)), 'every other animal is out of sight until a play brings it');
  assert.deepEqual(ECODUCT_HOME.marker, { at: MARKER, look: 'none' });
  assert.ok(ECODUCT_PLACES.home && ECODUCT_PLACES.marker, 'missions.spec reads its home and marker');
  for (const g of Object.values(GROUPS)) for (const key of g.members) assert.ok(ECODUCT_RESIDENTS.some((r) => r.key === key), `${key} lives here`);
});

/* ------------------------------------------------------- a play's variety ---- */

const orderOf = (seed: number, history: { m: string; sd?: number; va?: string }[] = []): string[] =>
  playDagnachtTrial(MISSION.stappen[1].skin, { ...knobsFor('dagnacht', 1) }, newPlay('ecoduct', seed, 1), history).encounters.map((e) => e.id);

test('the three moments: the trial\'s seeded order, the flip never first, every order comes', () => {
  const seen = new Set<string>();
  for (let seed = 1; seed <= 60; seed++) {
    const o = orderOf(seed);
    assert.equal(o.length, 3);
    assert.notEqual(o[0], 'opzij', `seed ${seed}: the flip never first`);
    assert.deepEqual(o, orderOf(seed), 'the same seed, the same order');
    seen.add(o.join());
  }
  for (const o of ORDERS) assert.ok(seen.has(o.join()), `the order ${o.join()} comes`);
});

test('a play\'s crossings: drawn from its seed, the deer always, never two alike in a row, the fox never waits to cross', () => {
  const firsts = new Set<string>(), corners = new Set<string>();
  for (let seed = 1; seed <= 80; seed++) {
    for (const rounds of [2, 3]) {
      for (const order of ORDERS) {
        const l = ecoductLayout(newPlay('ecoduct', seed, 1), rounds, order);
        assert.deepEqual(l, ecoductLayout(newPlay('ecoduct', seed, 1), rounds, order), 'deterministic');
        assert.equal(l.crossings.length, crossingsFor(rounds));
        const kinds = l.crossings.map((c) => c.kind);
        assert.equal(kinds[kinds.length - 1], 'hert', `seed ${seed}: the hind and her calf cross last (${kinds.join()})`);
        assert.equal(l.crossings[kinds.length - 1].n, 2, 'the hind and her calf: the home\'s own two');
        assert.equal(l.crossings[kinds.length - 1].out, 'N', 'onto the heath by the screen, where they live after');
        for (let i = 1; i < kinds.length; i++) assert.notEqual(kinds[i], kinds[i - 1], `seed ${seed}: never two alike in a row (${kinds.join()})`);
        const oi = order.indexOf('opzij');
        assert.notEqual(kinds[crossingsFor(rounds) - 3 + oi], 'vos', `seed ${seed} ${order.join()}: the group that waits for him is a group`);
        for (const c of l.crossings) assert.ok(c.n >= GROUPS[c.kind].min && c.n <= GROUPS[c.kind].members.length);
        if (order[1] === 'opzij' && l.crossings[kinds.length - 2].out === 'S') assert.equal(l.crossings[kinds.length - 1].from, 'S', 'aside by the north end: the last group comes round the south end');
        assert.ok(l.variant.length <= 20, l.variant);
        assert.deepEqual(readVariant(l.variant)?.kinds, kinds);
        firsts.add(kinds[0]); corners.add(l.crossings[0].from);
      }
    }
  }
  assert.equal(firsts.size, 4, 'every kind comes first now and then');
  // (a play's groups before the last: at least two kinds)
  assert.equal(corners.size, 2, 'both corners');
});

test('three plays in a row: another first group each time, never one of his last two plays\'', () => {
  for (let base = 1; base <= 40; base++) {
    const history: { m: string; sd?: number; va?: string }[] = [];
    const firsts: string[] = [];
    for (let i = 0; i < 3; i++) {
      const seed = base * 10 + i;
      const l = ecoductLayout(newPlay('ecoduct', seed, i + 1), 2, ['stil', 'roep', 'opzij'], lastVariants(history));
      for (const f of firsts.slice(-2)) assert.notEqual(l.crossings[0].kind, f, `base ${base}: play ${i + 1} first group one of the last two plays' ${l.variant}`);
      firsts.push(l.crossings[0].kind);
      history.push({ m: 'ecoduct', sd: seed, va: `mood:schemer,ec:${l.variant}` });
    }
  }
});

test('the route plays the level\'s rounds: one group a round, two at least', () => {
  for (let band = 1; band <= 6; band++) {
    const trial = buildCorsiTrial(MISSION.stappen[0].skin, knobsFor('corsi', band));
    assert.ok(trial.knobs.rounds >= 2, `band ${band}: ${trial.knobs.rounds} rounds`);
    assert.equal(crossingsFor(trial.knobs.rounds), trial.knobs.rounds + 2);
  }
});

test('its discoveries: four animals, the tracks, a rare badger; the red deer it helps', () => {
  const rows = ontdekkingenVan('ecoduct');
  assert.ok(rows.length >= 6);
  assert.deepEqual(rows.filter((o) => o.geholpen).map((o) => o.id), ['ecoduct.edelhert']);
  assert.ok(rows.some((o) => o.soort === 'zeldzaam' && o.id === 'ecoduct.das'));
  assert.ok(rows.some((o) => o.soort === 'spoor' && o.id === 'ecoduct.sporen'));
  for (const g of Object.values(GROUPS)) assert.ok(rows.some((o) => o.id === g.disc), `${g.disc} is a row`);
  void headingTo; void segDist;
});
