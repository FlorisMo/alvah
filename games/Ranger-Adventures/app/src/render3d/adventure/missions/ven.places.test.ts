/**
 * ven.places.test.ts — where "De kikker in het ven" happens is chosen by looking at the
 * world; this pins that every variant of it stays a good place (design
 * `state/adventures/design.md` §6.4, review r1): every cove, nook, stand, station, carpet
 * and the way there is dry where he stands, on the north bank, clear of the hide, the
 * bench, the other markers, the other homes and the world's props; every nook is partly
 * visible from its side's search lens at every level's glimpse, never in the middle of the
 * picture, big enough to see, where its table says it lands, and the eighteen nooks fall
 * at many places over the picture; a play never puts the frog where it sat in the last
 * play's picture; the song sees the frog big and three-quarters, the boy whole beside it;
 * every order of the three moments fits between the stations; a play's layout follows the
 * dagnacht trial's own order. Run: `npm test`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { heightAt as groundY, WATER_LEVEL } from '../../Biomes.ts';
import { RANGER_STAND_HEIGHT } from '../../AnimalScale.ts';
import { fitFrame } from '../../play/frame-fit.ts';
import { dist, headingTo, offCentre, segDist, toLocal } from '../places.ts';
import { backPoints, growStems, visibleShare } from '../cover-math.ts';
import { fitWindow } from './ree.window.ts';
import { knobsFor } from '../../../core/skill.ts';
import { newPlay } from '../../../core/play.ts';
import { playDagnachtTrial } from '../../../engines/dagnacht.ts';
import { AREA_VELUWE } from '../../../content/veluwe.ts';
import { frislingClearings } from './frisling.places.ts';
import { reeClearings } from './ree.places.ts';
import { wildcameraClearings } from './wildcamera.places.ts';
import { eekhoornClearings } from './eekhoorn.places.ts';
import {
  ADDER_BEFORE, ADDER_NEAR, ADDER_SHIFT, ADDER_WARN, AFTER_FROG, BAYS, BAY_IDS, BENCH, CARPET_A, CARPET_WET, CLOD_H, CLOD_LEN, COVES, CUSHION, FROG_H, FROG_LEN, GO_AWAY, GO_CLEAR,
  HIDE, HIDE_R, MARKER, NOOK_GAP_PX, SIDES, VEN_HOME, VEN_PLACES, VEN_RESIDENTS,
  above, adderAt, allStations, answerOrder, answerView, blocked, carpetAt, carpetPast, carpetRound, clodSpots, coveClumps, clodsOf, decoySlots, fitCove, inCarpet, underBoy,
  lastVenVariants, padGoal, polar, polarOf, plopOf, pointAt, project, readVariant, route, singOf, spanOf, stationsOf, venClearings, venLayout, venOrder, wayOf,
  type BayId, type FrogSpot, type Side, type ViewSpec,
} from './ven.places.ts';
import type { Spot } from '../types.ts';

const W = 1280, H = 800, FOV = 55;

/** The other markers as the world places them (read with `__ranger.markers()`, 2026-10-03). */
const OTHER_MARKERS: Readonly<Record<string, Spot>> = {
  frisling: { x: -15.56, z: -15.56 }, 'ree-niet-aanraken': { x: -15.01, z: -27.12 }, wildcamera: { x: 15.56, z: -15.56 },
  ecoduct: { x: 19.14, z: -24.39 }, stuifzand: { x: 8.27, z: 20.39 }, nachtronde: { x: 20.75, z: -34.2 },
  eekhoorn: { x: 25.42, z: -41.89 }, vos: { x: 35.81, z: -45.63 }, herstel: { x: -35.0, z: -19.37 },
};
/** The world's single cattail props on this bank (world/Dressing PLACES). */
const PROPS: readonly Spot[] = [{ x: 33, z: -8 }, { x: 38, z: -4 }, { x: 43, z: -2 }, { x: 49, z: -2 }, { x: 30, z: -13 }];
/** The roaming roe's loop (world/Fauna): home + radius. */
const ROE = { x: 44, z: 12, r: 6 };
const roeGap = (p: Spot): number => dist(p, ROE) - ROE.r;
const OTHER_HOMES = { frisling: frislingClearings(), ree: reeClearings(), wildcamera: wildcameraClearings(), eekhoorn: eekhoornClearings() };
const ORDERS = [['adder-ven', 'pad-ven', 'modder-ven'], ['adder-ven', 'modder-ven', 'pad-ven'], ['modder-ven', 'pad-ven', 'adder-ven'], ['modder-ven', 'adder-ven', 'pad-ven']] as const;
const r2 = (n: number): string => n.toFixed(2);
const at = (p: Spot): string => `(${p.x.toFixed(1)}, ${p.z.toFixed(1)})`;

/** The lens the kit fits for a framed view (kit `lensFor` → Stage → play/frame-fit: a spot
 *  to include with a width `r` is two spots, `r` m either side of it), on a 1280×800 screen. */
function lensOf(f: ViewSpec): THREE.PerspectiveCamera {
  const fw = { x: Math.sin(f.heading), z: Math.cos(f.heading) };
  const right = { x: -Math.cos(f.heading), z: Math.sin(f.heading) };
  const include = (f.include ?? []).flatMap((q) => ((q.r ?? 0) > 0 ? [-q.r!, q.r!].map((u) => ({ x: q.x + right.x * u, z: q.z + right.z * u, h: q.h })) : [q]));
  const fit = fitFrame(f.at, fw, { ...f, include }, groundY, FOV, W, H);
  const cam = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 400);
  cam.position.copy(fit.cam); cam.up.set(0, 1, 0); cam.lookAt(fit.look); cam.updateMatrixWorld(true);
  return cam;
}

/** A body's box on the screen (px): `len` along its yaw, 0.6 of it across, `h` high. */
function boxOf(cam: THREE.Camera, f: Spot & { yaw: number }, len = FROG_LEN, h = FROG_H): { w: number; h: number; cx: number; cy: number; x0: number; x1: number; y0: number; y1: number } {
  const fx = Math.sin(f.yaw), fz = Math.cos(f.yaw), rx = -fz, rz = fx;
  const g = groundY(f.x, f.z);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const a of [-0.5, 0.5]) for (const b of [-0.3, 0.3]) for (const k of [0, h]) {
    const v = new THREE.Vector3(f.x + (fx * a + rx * b) * len, g + k, f.z + (fz * a + rz * b) * len).project(cam);
    const x = ((v.x + 1) / 2) * W, y = ((1 - v.y) / 2) * H;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return { w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, x0, x1, y0, y1 };
}
/** The boy's box on the screen: a body 0.16 m round (his big hair the widest of it), his
 *  height tall. */
function boyBox(cam: THREE.Camera, p: Spot): ReturnType<typeof boxOf> {
  const g = groundY(p.x, p.z);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let a = 0; a < 16; a++) for (const k of [0, RANGER_STAND_HEIGHT * 0.75, RANGER_STAND_HEIGHT]) {
    const r = k === 0 ? 0.12 : 0.16;
    const v = new THREE.Vector3(p.x + Math.cos((a / 16) * Math.PI * 2) * r, g + k, p.z + Math.sin((a / 16) * Math.PI * 2) * r).project(cam);
    const x = ((v.x + 1) / 2) * W, y = ((1 - v.y) / 2) * H;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return { w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, x0, x1, y0, y1 };
}
/** A spot `h` m over the ground, on the screen (px). */
function screenAt(cam: THREE.Camera, p: Spot, h: number): { x: number; y: number } {
  const v = new THREE.Vector3(p.x, groundY(p.x, p.z) + h, p.z).project(cam);
  return { x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * H };
}

/** Everything he stands on or walks to in every variant. */
function standings(): { name: string; p: Spot }[] {
  const out: { name: string; p: Spot }[] = [];
  for (const id of BAY_IDS) {
    const b = BAYS[id];
    for (const side of SIDES) {
      out.push({ name: `${id}.stand${side}`, p: b.stands[side] }, { name: `${id}.off${side}`, p: b.offs[side] });
      for (const st of stationsOf(id, side)) {
        out.push({ name: `${id}${side}.S${st.i + 1}`, p: st.at });
        carpetRound(carpetAt(st)).forEach((q, i) => out.push({ name: `${id}.S${st.i + 1}.round${i}`, p: q }));
        out.push({ name: `${id}${side}.S${st.i + 1}.past`, p: carpetPast(id, side, st) });
        for (const sh of [-ADDER_SHIFT, ADDER_SHIFT]) out.push({ name: `${id}${side}.S${st.i + 1}.adder${sh}`, p: adderAt(id, side, st, sh, 0) });
      }
      const l = route(id, side);
      for (let s = 0; s <= l.length; s += 0.5) out.push({ name: `${id}${side}.route@${s}`, p: pointAt(l, s) });
    }
  }
  return out;
}

test('the marker is the ven anchor, its ring empty; the home is the after-frog on bay B\'s cushion', () => {
  assert.ok(AREA_VELUWE.missies.some((m) => m.id === 'ven'));
  assert.equal(VEN_HOME.marker?.look, 'none', 'no frog in the ring: the frogs are heard');
  assert.ok(dist(VEN_PLACES.marker, MARKER) < 1e-9);
  const cushion = { x: BAYS.B.frame.x, z: BAYS.B.frame.z };
  assert.ok(dist(VEN_PLACES.home, AFTER_FROG) < 1e-9 && dist(AFTER_FROG, cushion) < 0.2, 'the home: bay B\'s moss cushion');
  const after = VEN_RESIDENTS.filter((r) => r.after);
  assert.deepEqual(after.map((r) => r.key), ['koorB'], 'after the mission one frog sits on the cushion (the others are under the water)');
  for (const r of after) assert.ok(dist(r.after!, VEN_PLACES.home) < 4, 'the home\'s animals are at their home after');
  assert.ok(VEN_RESIDENTS.every((r) => r.animal === 'heikikker'), 'no adder in free roam: she is laid only for a play');
  const cl = toLocal(BAYS.B.frame, AFTER_FROG);
  assert.ok(Math.hypot(cl.u - CUSHION.u, cl.v - CUSHION.v) < 0.01);
});

test('dry where he stands and walks, the nooks at the water\'s edge or a step up, on the north bank inside the world', () => {
  for (const { name, p } of standings()) {
    assert.ok(above(p) >= 0.2, `${name} ${at(p)} is dry (${r2(above(p))} m above the water)`);
    assert.ok(!blocked(p), `${name} is ground he may walk on`);
    assert.ok(Math.hypot(p.x, p.z) < 68, `${name} is inside the world`);
  }
  for (const id of BAY_IDS) {
    const th = polarOf(BAYS[id].frame).th;
    assert.ok(th > 30 && th < 150, `cove ${id} lies on the north bank (θ ${th.toFixed(0)}°)`);
    for (const f of BAYS[id].nooks) {
      const h = above(f);
      assert.ok(h >= 0.02 && h <= 0.3, `cove ${id} nook ${f.nook} sits at the water's edge or a step up (${r2(h)} m)`);
    }
    assert.ok(above(BAYS[id].chorus) < 0 && above(BAYS[id].chorus) > -0.15, `cove ${id}'s calling frog floats where the water is a hand deep`);
  }
});

test('clear of the hide, the bench, the other markers, the roe\'s loop, the props and the other homes', () => {
  for (const { name, p } of standings()) {
    if (name.includes('route@')) continue;
    for (const [id, m] of Object.entries(OTHER_MARKERS)) assert.ok(dist(p, m) >= 10, `${name} is ${dist(p, m).toFixed(1)} m from the ${id} marker`);
    for (const [home, cs] of Object.entries(OTHER_HOMES)) for (const c of cs) assert.ok(dist(p, c) > c.r + 0.5, `${name} ${at(p)} is clear of the ${home} home`);
    if (!name.includes('.off')) assert.ok(dist(p, HIDE) - HIDE_R >= 3.5, `${name} keeps off the bird hide (${(dist(p, HIDE) - HIDE_R).toFixed(1)} m)`);
    assert.ok(dist(p, BENCH) >= 4, `${name} keeps off the bench`);
  }
  // the moments: ≥ 15 m from the marker (nothing a play lays pops up in view); the coves and
  // stands well off the roe's loop; the stations a little nearer, the way round the moss
  // nearer still, never into it
  for (const { bay, st } of allStations()) {
    assert.ok(dist(st.at, MARKER) >= 15, `${bay}.S${st.i + 1} is ${dist(st.at, MARKER).toFixed(1)} m from the marker`);
    assert.ok(roeGap(st.at) >= 5.5, `${bay}.S${st.i + 1} keeps off the roe's loop (${roeGap(st.at).toFixed(1)} m)`);
    for (const q of carpetRound(carpetAt(st))) assert.ok(roeGap(q) >= 3, `the way round ${bay}.S${st.i + 1}'s moss keeps off the roe's loop (${roeGap(q).toFixed(1)} m)`);
    for (const pr of PROPS) {
      assert.ok(inCarpet(carpetAt(st), pr) > 1.15, `no cattail prop ${at(pr)} in ${bay}.S${st.i + 1}'s moss`);
      assert.ok(dist(pr, st.at) > 1.5, `no cattail prop on ${bay}.S${st.i + 1}`);
    }
  }
  for (const id of BAY_IDS) {
    const b = BAYS[id];
    for (const p of [b.stands[1], b.stands[-1], b.frame]) assert.ok(roeGap(p) >= 8, `cove ${id} keeps 8 m off the roe's loop`);
    for (const f of b.nooks) {
      const eye = lensOf(b.views.search[f.side]).position;
      for (const pr of PROPS) assert.ok(segDist(pr, { x: eye.x, z: eye.z }, f) > 0.6, `no cattail prop between the lens and cove ${id}'s nook ${f.nook}`);
    }
  }
  // the home's own ground stays off the other homes' clearings
  for (const c of venClearings()) for (const [home, cs] of Object.entries(OTHER_HOMES)) {
    for (const o of cs) assert.ok(dist(c, o) > c.r + o.r, `the ven's ground ${at(c)} overlaps the ${home} home`);
  }
});

test('the search: every nook partly visible at every level, off the middle, big enough, where its table says, away from the boy', () => {
  const places: { id: BayId; nook: number; x: number; y: number }[] = [];
  for (const id of BAY_IDS) {
    const b = BAYS[id];
    const { stems } = growStems(coveClumps(b), 61, groundY);
    const built = stems.map((s) => ({ h: s.h, lx: s.lx, lz: s.lz, r: s.r }));
    const cams = { 1: lensOf(b.views.search[1]), [-1]: lensOf(b.views.search[-1]) } as Record<Side, THREE.PerspectiveCamera>;
    for (const f of b.nooks) {
      const view = b.views.search[f.side];
      const cam = cams[f.side];
      const eye = { x: cam.position.x, y: cam.position.y, z: cam.position.z };
      const back = backPoints(f.x, groundY(f.x, f.z), f.z, f.yaw, FROG_LEN, FROG_H);
      for (let band = 1; band <= 6; band++) {
        const g = knobsFor('zoeken', band).glimpse;
        const st = stems.map((s) => ({ ...s }));
        fitWindow(st, built, eye, back, g, { x: f.x, y: 0, z: f.z });
        const share = visibleShare(back, eye, st);
        assert.ok(share >= g * 0.6 - 1e-9 && share <= g * 1.6 + 1e-9, `cove ${id} nook ${f.nook} at band ${band}: ${r2(share)} of it shows (glimpse ${g})`);
      }
      assert.ok(offCentre(view, f) >= 0.25, `cove ${id} nook ${f.nook} is off the middle of the view (${r2(offCentre(view, f))})`);
      const box = boxOf(cam, f);
      assert.ok(box.w >= 50, `cove ${id} nook ${f.nook}: the frog is ${box.w.toFixed(0)} px wide on a 1280×800 picture`);
      const px = COVES[id].nooks[f.nook].px;
      assert.ok(Math.hypot(box.cx - px[0], box.cy - px[1]) <= 25, `cove ${id} nook ${f.nook} lands at (${box.cx.toFixed(0)}, ${box.cy.toFixed(0)}), its table says (${px[0]}, ${px[1]})`);
      // in the picture, below the line, never its middle (the free band's), never at the boy
      assert.ok(box.y0 > view.insetTop + 20 && box.y1 < H - 40 && box.x0 > 60 && box.x1 < W - 60, `cove ${id} nook ${f.nook} is in the picture, below the line`);
      const mid = { x: W / 2, y: (view.insetTop + 12 + H - view.insetBottom - 12) / 2 };
      assert.ok(Math.hypot(box.cx - mid.x, box.cy - mid.y) >= 120, `cove ${id} nook ${f.nook} is not in the middle of the picture (${Math.hypot(box.cx - mid.x, box.cy - mid.y).toFixed(0)} px)`);
      const boy = boyBox(cam, b.stands[f.side]);
      assert.ok(box.x1 < boy.x0 - 40 || box.x0 > boy.x1 + 40 || box.y1 < boy.y0 - 40, `cove ${id} nook ${f.nook} keeps away from the boy in the picture (frog ${box.x0.toFixed(0)}-${box.x1.toFixed(0)}, ${box.y0.toFixed(0)}-${box.y1.toFixed(0)}; boy ${boy.x0.toFixed(0)}-${boy.x1.toFixed(0)}, ${boy.y0.toFixed(0)}-${boy.y1.toFixed(0)})`);
      // the cover round it stands at least twice its height (the same ring at every nook)
      const near = stems.filter((s) => Math.hypot(s.x - f.x, s.z - f.z) < 0.5).map((s) => s.h).sort((a, c) => a - c);
      assert.ok(near.length >= 3 && near[Math.floor(near.length / 2)] >= 2 * FROG_H, `cove ${id} nook ${f.nook} sits among sedge twice its height`);
      // the look-alikes' tops (the stonechat on its stalk, the heath blue on its head) never
      // stand over the frog in its picture
      for (const q of b.slots.birds) { const t = screenAt(cam, q, 0.66); assert.ok(Math.hypot(t.x - box.cx, t.y - box.cy) > 70, `cove ${id}: a stonechat's stalk stands over nook ${f.nook}`); }
      for (const q of b.slots.butterflies) { const t = screenAt(cam, q, 0.36); assert.ok(Math.hypot(t.x - box.cx, t.y - box.cy) > 60, `cove ${id}: a heath blue sits over nook ${f.nook}`); }
      places.push({ id, nook: f.nook, x: box.cx, y: box.cy });
    }
    // each cove's own: six nooks, three searched from either side, each side's spread over
    // both halves of the picture; apart from each other; the look-alike slots off them
    const spec = COVES[id];
    assert.equal(spec.nooks.length, 6);
    for (const side of SIDES) {
      const xs = spec.nooks.filter((n) => n.side === side).map((n) => n.px[0]);
      assert.equal(xs.length, 3, `cove ${id}: three nooks searched from side ${side}`);
      assert.ok(xs.some((x) => x < 600) && xs.some((x) => x > 680), `cove ${id}: from side ${side} the frog may sit left or right in the picture`);
    }
    spec.nooks.forEach((n, i) => spec.nooks.slice(i + 1).forEach((m) => assert.ok(Math.hypot(n.u - m.u, n.v - m.v) >= 0.6, `cove ${id}: its nooks lie apart`)));
    const slots = [...spec.clods, ...spec.butterflies, ...spec.birds];
    for (const [k, q] of slots.entries()) {
      for (const n of spec.nooks) assert.ok(Math.hypot(q.u - n.u, q.v - n.v) >= 0.35, `cove ${id}: slot ${k} keeps 0.35 m off nook (${n.u}, ${n.v})`);
      for (const q2 of slots.slice(k + 1)) assert.ok(Math.hypot(q.u - q2.u, q.v - q2.v) >= 0.3, `cove ${id}: slots ${k} apart`);
    }
    // every look-alike spot (a slot, or a nook a clod may fill) is in the picture from either
    // side, and never under the boy (his hair is big seen from above)
    for (const side of SIDES) {
      const boy = boyBox(cams[side], b.stands[side]);
      for (const q of [...b.slots.clods, ...b.slots.butterflies, ...b.slots.birds, ...b.nooks]) {
        const p = screenAt(cams[side], q, 0.06);
        assert.ok(p.x > 60 && p.x < W - 60 && p.y > b.views.search[side].insetTop + 20 && p.y < H - 40, `cove ${id}: a look-alike spot ${at(q)} is in the picture from side ${side}`);
        // (the box is a little wider than his drawn hair: no margin on top of it)
        const under = !(p.x < boy.x0 || p.x > boy.x1 || p.y < boy.y0 || p.y > boy.y1);
        if (under) assert.ok(underBoy(b, side, q), `cove ${id}: a look-alike spot ${at(q)} lies under the boy from side ${side} (at ${p.x.toFixed(0)}, ${p.y.toFixed(0)}) and is not left out`);
      }
      // …and enough are left: five clods, a heath blue and a stonechat
      const free = (qs: readonly Spot[]): number => qs.filter((q) => !underBoy(b, side, q)).length;
      for (const n of b.nooks.filter((m) => m.side === side)) {
        assert.ok(free([...b.slots.clods, ...b.nooks.filter((m) => m !== n)]) >= 5 && free(b.slots.butterflies) >= 1 && free(b.slots.birds) >= 1, `cove ${id} side ${side}: look-alikes enough beside the boy`);
      }
    }
  }
  // the eighteen nooks fall at many places over the picture: any two of a cove ≥ 60 px apart
  for (const p of places) for (const q of places) {
    if (p === q || p.id !== q.id) continue;
    assert.ok(Math.hypot(p.x - q.x, p.y - q.y) >= 60, `cove ${p.id}: nooks ${p.nook} and ${q.nook} land ${Math.hypot(p.x - q.x, p.y - q.y).toFixed(0)} px apart`);
  }
  const xs = places.map((p) => p.x), ys = places.map((p) => p.y);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 450 && Math.max(...ys) - Math.min(...ys) > 180, 'the nooks spread over the picture, across and up and down');
});

test('every moss clod (in an empty nook or on the open moss) is seen — at least half the frog\'s share — and the frog still shows the level\'s share', () => {
  for (const id of BAY_IDS) {
    const b = BAYS[id];
    const { stems } = growStems(coveClumps(b), 61, groundY);
    const built = stems.map((s) => ({ h: s.h, lx: s.lx, lz: s.lz, r: s.r }));
    for (const f of b.nooks) {
      const cam = lensOf(b.views.search[f.side]);
      const eye = { x: cam.position.x, y: cam.position.y, z: cam.position.z };
      // (the worst case: a clod in every other nook and on every slot)
      const clods = clodsOf([...b.nooks.filter((n) => n.nook !== f.nook), ...b.slots.clods].map((q) => ({ k: 'bush', x: q.x, z: q.z })));
      assert.equal(clods.length, 10);
      for (const band of [1, 4, 6]) {
        const g = knobsFor('zoeken', band).glimpse;
        const st = stems.map((q) => ({ ...q }));
        fitCove(st, built, eye, f, clods, g, groundY);
        const frogShare = visibleShare(backPoints(f.x, groundY(f.x, f.z), f.z, f.yaw, FROG_LEN, FROG_H), eye, st);
        assert.ok(frogShare >= g * 0.6 - 1e-9 && frogShare <= g * 1.6 + 1e-9, `cove ${id} nook ${f.nook} band ${band}: the frog shows ${r2(frogShare)} (glimpse ${g})`);
        for (const d of clods) {
          const yaw = headingTo({ x: eye.x, z: eye.z }, d) + 0.9;
          const sh = visibleShare(backPoints(d.x, groundY(d.x, d.z), d.z, yaw, CLOD_LEN, CLOD_H), eye, st);
          assert.ok(sh >= g * 0.5 - 1e-9, `cove ${id}, the frog in nook ${f.nook}, band ${band}: a clod at ${at(d)} shows ${r2(sh)} (glimpse ${g})`);
        }
      }
    }
  }
});

test('the song: the frog big and three-quarters toward the lens (his throat to it), the boy whole beside him; the answer in the picture; the plop into the water', () => {
  for (const id of BAY_IDS) {
    const b = BAYS[id];
    for (const f of b.nooks) {
      const sing = singOf(b, f);
      const cam = lensOf(sing.view);
      const at = sing.at;
      assert.ok(above(at) >= 0.0 && above(at) <= 0.15 && dist(at, f) < 1.3, `cove ${id} nook ${f.nook}: he sings at the water's edge (${r2(above(at))} m), two hops at most from his nook`);
      const box = boxOf(cam, { ...at, yaw: sing.yaw });
      assert.ok(box.w >= 80, `cove ${id} nook ${f.nook}: the singing frog is ${box.w.toFixed(0)} px`);
      const lens = { x: cam.position.x, z: cam.position.z };
      assert.ok(above(lens) < 0, `cove ${id} nook ${f.nook}: the lens stands out over the water (${above(lens).toFixed(2)})`);
      assert.ok(cam.position.y - Math.max(WATER_LEVEL, groundY(lens.x, lens.z)) > 0.7, 'the lens well above the water or the bank');
      assert.ok(cam.position.y - WATER_LEVEL < 1.6, 'the lens low: at a frog\'s eye, not a heron\'s');
      const { stems } = growStems(coveClumps(b), 61, groundY);
      assert.ok(stems.every((st) => Math.hypot(st.x - lens.x, st.z - lens.z) > 0.35 || st.h < cam.position.y - groundY(lens.x, lens.z) - 0.3), 'no sedge at the lens');
      // his nose (and the throat under it) turned 20-50° off the lens: three-quarters toward it
      const toLens = headingTo(at, lens);
      let off = Math.abs(sing.yaw - toLens) % (2 * Math.PI);
      if (off > Math.PI) off = 2 * Math.PI - off;
      assert.ok(off >= (20 * Math.PI) / 180 && off <= (50 * Math.PI) / 180, `cove ${id} nook ${f.nook}: he faces ${((off * 180) / Math.PI).toFixed(0)}° off the lens`);
      // the boy: whole in the picture, behind on the bank and to one side of the frog
      const boy = boyBox(cam, sing.stand);
      assert.ok(boy.y0 > sing.view.insetTop - 30 && boy.y1 < H - sing.view.insetBottom + 30 && boy.x0 > 0 && boy.x1 < W, `cove ${id} nook ${f.nook}: the boy is whole in the picture (${boy.x0.toFixed(0)}-${boy.x1.toFixed(0)}, ${boy.y0.toFixed(0)}-${boy.y1.toFixed(0)})`);
      assert.ok(Math.abs(boy.cx - box.cx) >= 150, `cove ${id} nook ${f.nook}: the boy stands ${Math.abs(boy.cx - box.cx).toFixed(0)} px beside the frog`);
      assert.ok(box.cy > boy.cy, 'the frog in front, the boy behind on the bank');
      // the answer: the singing frog, the boy and the nearest answering cove's frog all in
      // the pulled-back picture
      const ans = lensOf(answerView(b, f));
      const other = BAYS[answerOrder(id)[0]].chorus;
      for (const [what, p, h] of [['the frog', at, 0.06], ['the boy', sing.stand, 0.6], ['the answering frog', other, 0.0]] as const) {
        const q = screenAt(ans, p, h);
        assert.ok(q.x > 40 && q.x < W - 40 && q.y > 140 && q.y < H - 40, `cove ${id} nook ${f.nook}: ${what} is in the answer's picture (${q.x.toFixed(0)}, ${q.y.toFixed(0)})`);
      }
      assert.ok(dist(other, b.frame) < 12, 'the nearest answering cove is near');
      // the plop: from where he sang, one leap out into the water, away from the boy
      const plop = plopOf(b, f);
      assert.ok(above(plop) < -0.02, `it plops into the water (${above(plop).toFixed(2)})`);
      assert.ok(dist(plop, sing.stand) > dist(at, sing.stand), 'away from the boy');
      assert.ok(dist(at, plop) < 1.6, `the plop is one leap (${dist(at, plop).toFixed(2)} m)`);
    }
  }
});

test('the stations: the path runs through the moss, a dry way round it above, none round it below; the adder on the path', () => {
  for (const { bay, st } of allStations()) {
    const c = carpetAt(st);
    assert.ok(inCarpet(c, st.at) < CARPET_WET, `${bay}.S${st.i + 1}: the path runs through the soft moss`);
    for (const q of carpetRound(c)) assert.ok(inCarpet(c, q) > 1.3, `${bay}.S${st.i + 1}: the way round stays off the moss`);
    const pc = polarOf(st.at);
    let r = pc.r;
    while (r > 8 && !blocked(polar(pc.th, r))) r -= 0.1;
    assert.ok(inCarpet(c, polar(pc.th, r + 0.2)) < 1, `${bay}.S${st.i + 1}: the moss runs down to the water`);
    for (const side of SIDES) for (const sh of [-ADDER_SHIFT, ADDER_SHIFT]) {
      const a = adderAt(bay, side, stationsOf(bay, side)[st.i], sh, 0);
      assert.ok(dist(a, adderAt(bay, 1, st, sh, 0)) < 1e-6, 'she lies at the same spot whichever side he searches from');
      const pa = polarOf(a);
      const round = polar(pa.th, pa.r + 3.3);
      assert.ok(above(round) > 0.2 && !blocked(round) && dist(round, a) >= 3.2 && dist(round, a) > ADDER_NEAR, 'a dry way round her');
    }
  }
});

test('every order of the three moments fits on the way to every cove and side; the dry path is never first; band 1 listens twice', () => {
  for (const id of BAY_IDS) for (const side of SIDES) {
    const l = route(id, side);
    assert.ok(l.length >= 35 && l.length <= 58, `the way to cove ${id} (side ${side}) is ${l.length.toFixed(1)} m`);
    assert.ok(segDist(HIDE, MARKER, BAYS[id].chorus) > HIDE_R + 0.5, `the look from the marker sees cove ${id}'s water past the hide`);
    for (const order of ORDERS) for (const sh of [-ADDER_SHIFT, ADDER_SHIFT]) for (const listens of [1, 2, 3, 4]) {
      const dangers = order.filter((x) => x !== 'pad-ven');
      const laid = { bay: id, side, order, stations: { 'adder-ven': dangers.indexOf('adder-ven') as 0 | 1, 'modder-ven': dangers.indexOf('modder-ven') as 0 | 1 }, adderShift: sh, adderTurn: 0 };
      const way = wayOf(laid, listens);
      const moments = way.filter((w) => w.kind === 'adder' || w.kind === 'modder' || w.kind === 'pad').map((w) => w.kind);
      assert.deepEqual(moments, order.map((o) => o.split('-')[0]), `cove ${id}: the moments come in the trial's order`);
      assert.equal(way[way.length - 1].kind, 'bay', 'the cove last');
      const ms = way.filter((w) => w.kind !== 'listen' && w.kind !== 'bay');
      for (let k = 1; k < ms.length; k++) {
        const prev = spanOf(ms[k - 1]), next = spanOf(ms[k]);
        if (ms[k].kind === 'pad') assert.ok(Math.abs(next[0] - (ms[k - 1].kind === 'adder' ? ms[k - 1].s : prev[1])) < 1e-6, 'the dry path right after the moment before it');
        else assert.ok(next[0] >= prev[1] - 1e-6, `cove ${id}${side} ${order.join(',')} shift ${sh}: moment ${k} starts after the one before (${prev[1].toFixed(1)} → ${next[0].toFixed(1)})`);
      }
      // both stations lie on the path before his way turns down to the cove (the dry path
      // after the last one may lead on down the bank to it)
      const sOff = project(l, BAYS[id].offs[side]).s;
      for (const st of stationsOf(id, side)) assert.ok(st.s + CARPET_A + 0.5 < sOff, `cove ${id}${side}: station S${st.i + 1} (${st.s.toFixed(1)}) lies before the way down (${sOff.toFixed(1)})`);
      const pad = way.find((w) => w.kind === 'pad');
      if (pad?.kind === 'pad') {
        assert.ok(dist(pointAt(l, pad.s), pad.to) >= GO_AWAY, `cove ${id}${side} ${order.join(',')}: the dry path's walk on is ${dist(pointAt(l, pad.s), pad.to).toFixed(1)} m`);
        assert.ok(dist(pad.to, pad.from) > dist(pointAt(l, pad.s), pad.from) + 0.5, 'walking on is walking away from his way behind him');
      }
      const adder = way.find((w) => w.kind === 'adder');
      if (adder?.kind === 'adder') assert.ok(dist(adder.approach, adder.adder) > ADDER_WARN, 'his walk to her ends before she even lifts her head');
      if (listens === 1) assert.equal(way.filter((w) => w.kind === 'listen').length, 1, `cove ${id}${side} ${order.join(',')}: one listening stop on the way (and the cove's own)`);
      for (const w of way) if (w.kind === 'listen') assert.ok(dist(w.at, MARKER) > 4, 'a listening stop on the way, not at the marker');
    }
  }
  assert.ok(ADDER_BEFORE > ADDER_NEAR + 1, 'his walk to the adder ends out of her reach');
});

test('the dry path\'s walk on is set from where he stands: at least GO_AWAY ahead of him from any start on the way, on dry open ground', () => {
  for (const id of BAY_IDS) for (const side of SIDES) {
    const l = route(id, side);
    for (let s = 0; s <= l.length + 1e-6; s += 0.5) {
      const p = pointAt(l, s), h = Math.atan2(pointAt(l, Math.min(l.length, s + 0.5)).x - pointAt(l, Math.max(0, s - 0.5)).x, pointAt(l, Math.min(l.length, s + 0.5)).z - pointAt(l, Math.max(0, s - 0.5)).z);
      // on his way, or off it either side (he walked round the adder on the heather side)
      for (const off of [0, -1.2, 1.2]) {
        const me = { x: p.x - Math.cos(h) * off, z: p.z + Math.sin(h) * off };
        if (above(me) < 0.2 || blocked(me)) continue;
        // the moment was planned from anywhere behind him (or where he is)
        for (const s0 of [0, Math.max(0, s - 5), s]) {
          const g = padGoal(id, side, s0, me);
          const d = dist(me, g.to);
          assert.ok(d >= GO_CLEAR - 1e-6, `cove ${id}${side}, from ${s.toFixed(1)} m (${off} m off it), planned at ${s0.toFixed(1)}: the walk on ends ${d.toFixed(2)} m from his feet`);
          // walking there is walking away from his way behind him (GoCore: 0.5 m farther)
          assert.ok(dist(g.to, g.from) >= dist(me, g.from) + 0.5, `cove ${id}${side} from ${s.toFixed(1)}: the walk on goes away from his way behind him`);
          assert.ok(above(g.to) >= 0.2 && !blocked(g.to) && Math.hypot(g.to.x, g.to.z) < 68, `cove ${id}${side} from ${s.toFixed(1)}: the walk on ends on dry ground ${at(g.to)}`);
          for (const [home, cs] of Object.entries(OTHER_HOMES)) for (const c of cs) assert.ok(dist(g.to, c) > c.r + 0.5, `the walk on ${at(g.to)} keeps off the ${home} home`);
        }
      }
    }
  }
});

/** Play `seeds` in a row on one save (its history carried on): each play's layout. */
function playRow(seeds: readonly number[], first: { m: string; sd: number; va: string }[] = []): ReturnType<typeof venLayout>[] {
  const skin = AREA_VELUWE.missies.find((m) => m.id === 'ven')!.stappen[1].skin;
  const knobs = knobsFor('dagnacht', 1);
  const hist = [...first];
  const out: ReturnType<typeof venLayout>[] = [];
  seeds.forEach((seed, i) => {
    const play = newPlay('ven', seed, i + 1);
    const order = venOrder(skin, knobs, play, hist);
    const l = venLayout(play, order, lastVenVariants(hist));
    play.note('ven', l.variant);
    hist.push({ m: 'ven', sd: seed, va: Object.entries(play.variant).map(([k, v]) => `${k}:${v}`).join(',') });
    out.push(l);
  });
  return out;
}
const pxOf = (l: { bay: BayId; nook: number }): readonly [number, number] => COVES[l.bay].nooks[l.nook].px;
const gap = (a: readonly [number, number], b: readonly [number, number]): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

test('a play\'s layout: deterministic per seed, the stations in the trial\'s order, never the last play\'s cove or picture place', () => {
  const skin = AREA_VELUWE.missies.find((m) => m.id === 'ven')!.stappen[1].skin;
  const knobs = knobsFor('dagnacht', 1);
  const seen = new Set<string>();
  for (let seed = 1; seed <= 30; seed++) {
    const order = venOrder(skin, knobs, newPlay('ven', seed, 1), []);
    const trial = playDagnachtTrial(skin, { jargon: false, reducedMotion: false, ...knobs }, newPlay('ven', seed, 1), []).encounters.map((e) => e.id);
    assert.deepEqual(order, trial, `seed ${seed}: the layout's order is the trial's`);
    assert.notEqual(order[0], 'pad-ven', 'the dry path never first');
    seen.add(order.join(','));
    const a = venLayout(newPlay('ven', seed, 1), order);
    const b = venLayout(newPlay('ven', seed, 1), order);
    assert.deepEqual(a, b, 'the same seed lays the same bank');
    assert.equal(a.side, COVES[a.bay].nooks[a.nook].side, 'the side is the nook\'s');
    assert.deepEqual(readVariant(a.variant), { bay: a.bay, nook: a.nook }, 'the variant reads back');
    const dangers = order.filter((x) => x !== 'pad-ven');
    assert.equal(a.stations['adder-ven'], dangers.indexOf('adder-ven'));
    assert.equal(a.stations['modder-ven'], dangers.indexOf('modder-ven'));
    assert.ok(Math.abs(a.adderShift) <= ADDER_SHIFT);
  }
  assert.equal(seen.size, 4, 'all four orders come up');
  // after ANY play, the next one is in another cove, its frog ≥ NOOK_GAP_PX from the last
  // frog in the picture: every cove and nook a last play may have left
  for (const id of BAY_IDS) for (let n = 0; n < 6; n++) for (let seed = 1; seed <= 12; seed++) {
    const lastV = `${id}${n}-amp+0.0`;
    const l = venLayout(newPlay('ven', seed, 2), ['adder-ven', 'modder-ven', 'pad-ven'], [lastV]);
    assert.notEqual(l.bay, id, 'never the last play\'s cove');
    assert.ok(gap(pxOf(l), COVES[id].nooks[n].px) >= NOOK_GAP_PX, `after ${lastV}: ${l.variant} sits ${gap(pxOf(l), COVES[id].nooks[n].px).toFixed(0)} px from the last frog`);
  }
  // both other coves come up (a seeded pick, not a fixed cycle)
  const nexts = new Set<string>();
  for (let seed = 1; seed <= 40; seed++) nexts.add(venLayout(newPlay('ven', seed, 2), ['adder-ven', 'modder-ven', 'pad-ven'], ['A0-amp+0.0']).bay);
  assert.deepEqual([...nexts].sort(), ['B', 'C'], 'after cove A both B and C come next');
});

test('three plays in a row (and six): new coves, the frog at new places in the picture, other orders', () => {
  for (const base of [101, 201, 301, 501, 901]) {
    const row = playRow([base, base + 1, base + 2]);
    for (let i = 1; i < row.length; i++) {
      assert.notEqual(row[i].bay, row[i - 1].bay, `seeds ${base}…: two plays in a row never in one cove (${row.map((r) => r.variant).join(' | ')})`);
      assert.ok(gap(pxOf(row[i]), pxOf(row[i - 1])) >= NOOK_GAP_PX, `seeds ${base}…: play ${i + 1}'s frog sits ${gap(pxOf(row[i]), pxOf(row[i - 1])).toFixed(0)} px from the play before's`);
    }
    assert.ok(new Set(row.map((r) => r.order.join())).size >= 2, `seeds ${base}…: the moments come in another order (${row.map((r) => r.variant).join(' | ')})`);
    // six plays: at least five clearly different places in the picture (> 120 px apart)
    const six = playRow([base, base + 1, base + 2, base + 3, base + 4, base + 5]);
    const distinct: (readonly [number, number])[] = [];
    for (const r of six) if (distinct.every((d) => gap(d, pxOf(r)) > 120)) distinct.push(pxOf(r));
    assert.ok(distinct.length >= 5, `seeds ${base}…: six plays put the frog at ${distinct.length} different places (${six.map((r) => r.variant).join(' | ')})`);
  }
});

test('the look-alikes: a trial\'s set laid on the cove\'s own slots and its empty nooks, never the frog\'s nook, the same for the same stream', () => {
  const rng = (seed: number): (() => number) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };
  const decoys = [{ id: 'r1', k: 'bush' }, { id: 'r2', k: 'bush' }, { id: 'r3', k: 'bush' }, { id: 'r4', k: 'bush' }, { id: 'r5', k: 'bush' }, { id: 'v1', k: 'butterfly' }, { id: 'b1', k: 'bird' }];
  for (const id of BAY_IDS) {
    const b = BAYS[id];
    let inNooks = 0;
    for (let n = 0; n < 6; n++) for (const seed of [3, 7, 11, 19]) {
      const a = decoySlots(b, n, decoys, rng(seed)), c = decoySlots(b, n, decoys, rng(seed));
      assert.deepEqual(a, c);
      assert.equal(a.length, decoys.length);
      const frog: FrogSpot = b.nooks[n];
      for (const q of a) assert.ok(dist(q, frog) >= 0.35, `cove ${id}: no look-alike on the frog's nook ${n}`);
      inNooks += a.filter((q) => b.nooks.some((m) => dist(m, q) < 1e-6)).length;
      for (const q of a.filter((d) => d.k === 'bush')) assert.ok(clodSpots(b).some((s) => dist(s, q) < 1e-6), 'a clod lies on a clod spot');
    }
    assert.ok(inNooks > 0, `cove ${id}: an empty nook holds a clod now and then`);
  }
});
