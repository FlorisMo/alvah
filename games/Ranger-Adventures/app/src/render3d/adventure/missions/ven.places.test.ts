/**
 * ven.places.test.ts — where "De kikker in het ven" happens is chosen by looking at the
 * world; this pins that every variant of it stays a good place (design
 * `state/adventures/design.md` §6.4): every cove, frog spot, stand, station, carpet and
 * the way there is dry where he stands, on the north bank, clear of the hide, the bench,
 * the other markers, the other homes and the world's props; every frog spot is partly
 * visible from the search's lens at every level's glimpse, never in the middle of the
 * picture and big enough to see; every order of the three moments fits between the
 * stations; a play's layout follows the dagnacht trial's own order. Run: `npm test`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { heightAt as groundY } from '../../Biomes.ts';
import { RANGER_STAND_HEIGHT } from '../../AnimalScale.ts';
import { dist, offCentre, segDist, toLocal } from '../places.ts';
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
  ADDER_BEFORE, ADDER_NEAR, ADDER_SHIFT, AFTER_FROG, APPROACH, BAYS, BAY_IDS, BENCH, BIRD_SLOTS, BUTTERFLY_SLOTS, CARPET_WET, CLOD_SLOTS,
  CUSHION, FROG_H, FROG_LEN, FROG_SPOTS, GO_AWAY, HIDE, HIDE_R, MARKER, PATH, VEN_HOME, VEN_PLACES, VEN_RESIDENTS,
  above, adderAt, allStations, blocked, carpetAt, carpetPast, carpetRound, coveClumps, decoySlots, inCarpet, lastVenVariants,
  polar, polarOf, pointAt, project, route, singOf, spanOf, stationsOf, venClearings, venLayout, venOrder, wayOf, type BayId, type ViewSpec,
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

/** The pure replica of `Stage.fitAt` for an anchored view (play/stage.ts; the same as
 *  ree.view.test.ts's), on a 1280×800 screen. */
function fitLens(f: ViewSpec): THREE.PerspectiveCamera {
  const tall = f.tall, pitch = (f.pitchDeg * Math.PI) / 180;
  const right = { x: -Math.cos(f.heading), z: Math.sin(f.heading) };
  const include = (f.include ?? []).flatMap((q) => ((q.r ?? 0) > 0 ? [-q.r!, q.r!].map((u) => ({ x: q.x + right.x * u, z: q.z + right.z * u, h: q.h })) : [q]));
  const fv = new THREE.Vector3(Math.sin(f.heading), 0, Math.cos(f.heading));
  const rv = new THREE.Vector3(-fv.z, 0, fv.x);
  const P = new THREE.Vector3(f.at.x, groundY(f.at.x, f.at.z), f.at.z);
  const yTop = 1 - (2 * (f.insetTop + 12)) / H, yBot = -1 + (2 * (f.insetBottom + 12)) / H, xLim = 1 - (24 / W) * 2;
  const pts: THREE.Vector3[] = [];
  for (const u of [-f.halfW, 0, f.halfW]) for (const v of [-f.halfD, f.halfD]) {
    const g = P.clone().addScaledVector(rv, u).addScaledVector(fv, v);
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
      const look = P.clone().setY(P.y + lift);
      cam.position.copy(look).addScaledVector(dir, -d);
      if (inc.some((q) => q.clone().sub(cam.position).dot(dir) < 1.6)) break;
      cam.up.set(0, 1, 0); cam.lookAt(look); cam.updateMatrixWorld(true);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of pts) { ndc.copy(p).project(cam); minX = Math.min(minX, ndc.x); maxX = Math.max(maxX, ndc.x); minY = Math.min(minY, ndc.y); maxY = Math.max(maxY, ndc.y); }
      if (minX >= -xLim && maxX <= xLim && minY >= yBot && maxY <= yTop) { best = { cam: cam.position.clone(), look }; break; }
      lift += ((minY + maxY) / 2 - (yTop + yBot) / 2) * d * Math.tan((FOV * Math.PI) / 360);
    }
  }
  if (!best) { const look = P.clone().setY(P.y + tall * 0.35); best = { cam: look.clone().addScaledVector(dir, -16), look }; }
  best.cam.y = Math.max(best.cam.y, groundY(best.cam.x, best.cam.z) + 1.4);
  cam.position.copy(best.cam); cam.up.set(0, 1, 0); cam.lookAt(best.look); cam.updateMatrixWorld(true);
  return cam;
}

/** A frog's box on the screen (px): its length along its yaw, its width, its height. */
function frogBox(cam: THREE.Camera, f: Spot & { yaw: number }): { w: number; h: number; cx: number; cy: number } {
  const fx = Math.sin(f.yaw), fz = Math.cos(f.yaw), rx = -fz, rz = fx;
  const y0 = groundY(f.x, f.z);
  let x0 = Infinity, x1 = -Infinity, y0p = Infinity, y1 = -Infinity;
  for (const a of [-0.5, 0.5]) for (const b of [-0.3, 0.3]) for (const h of [0, FROG_H]) {
    const v = new THREE.Vector3(f.x + (fx * a + rx * b) * FROG_LEN, y0 + h, f.z + (fz * a + rz * b) * FROG_LEN).project(cam);
    const x = ((v.x + 1) / 2) * W, y = ((1 - v.y) / 2) * H;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0p = Math.min(y0p, y); y1 = Math.max(y1, y);
  }
  return { w: x1 - x0, h: y1 - y0p, cx: (x0 + x1) / 2, cy: (y0p + y1) / 2 };
}

/** Everything he stands on or walks to in every variant. */
function standings(): { name: string; p: Spot }[] {
  const out: { name: string; p: Spot }[] = [];
  for (const id of BAY_IDS) {
    const b = BAYS[id];
    out.push({ name: `${id}.stand`, p: b.stand }, { name: `${id}.off`, p: b.off });
    for (const f of b.frogs) out.push({ name: `${id}.sing`, p: singOf(b, f).stand });
    for (const st of stationsOf(id)) {
      out.push({ name: `${id}.S${st.i + 1}`, p: st.at });
      carpetRound(carpetAt(st)).forEach((q, i) => out.push({ name: `${id}.S${st.i + 1}.round${i}`, p: q }));
      out.push({ name: `${id}.S${st.i + 1}.past`, p: carpetPast(id, st) });
      for (const sh of [-ADDER_SHIFT, ADDER_SHIFT]) out.push({ name: `${id}.S${st.i + 1}.adder${sh}`, p: adderAt(id, st, sh, 0) });
    }
    const l = route(id);
    for (let s = 0; s <= l.length; s += 0.5) out.push({ name: `${id}.route@${s}`, p: pointAt(l, s) });
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
});

test('dry where he stands and walks, the frog spots at the water line, on the north bank inside the world', () => {
  for (const { name, p } of standings()) {
    assert.ok(above(p) >= 0.2, `${name} ${at(p)} is dry (${r2(above(p))} m above the water)`);
    assert.ok(!blocked(p), `${name} is ground he may walk on`);
    assert.ok(Math.hypot(p.x, p.z) < 68, `${name} is inside the world`);
  }
  for (const id of BAY_IDS) {
    const th = polarOf(BAYS[id].frame).th;
    assert.ok(th > 30 && th < 150, `cove ${id} lies on the north bank (θ ${th.toFixed(0)}°)`);
    for (const f of BAYS[id].frogs) {
      const h = above(f);
      assert.ok(h >= 0.02 && h <= 0.3, `a frog of cove ${id} sits at the water line (${r2(h)} m)`);
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
  // stands well off the roe's loop; the stations a little nearer (the path along the bank
  // passes 5.7 m from it at θ 90: the moments' shots look south over the water, she grazes
  // behind the lens), the way round the moss nearer still, never into it
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
    for (const p of [b.stand, b.frame]) assert.ok(roeGap(p) >= 8, `cove ${id} keeps 8 m off the roe's loop`);
    for (const f of b.frogs) for (const pr of PROPS) {
      const eye = fitLens(b.views.search).position;
      assert.ok(segDist(pr, { x: eye.x, z: eye.z }, f) > 0.6, `no cattail prop between the lens and cove ${id}'s frog`);
    }
  }
  // the home's own ground stays off the other homes' clearings
  for (const c of venClearings()) for (const [home, cs] of Object.entries(OTHER_HOMES)) {
    for (const o of cs) assert.ok(dist(c, o) > c.r + o.r, `the ven's ground ${at(c)} overlaps the ${home} home`);
  }
});

test('the search: every frog spot partly visible at every level, off the middle, big enough, its look-alikes apart', () => {
  for (const id of BAY_IDS) {
    const b = BAYS[id];
    const { stems } = growStems(coveClumps(b), 61, groundY);
    const built = stems.map((s) => ({ h: s.h, lx: s.lx, lz: s.lz, r: s.r }));
    const cam = fitLens(b.views.search);
    const eye = { x: cam.position.x, y: cam.position.y, z: cam.position.z };
    for (const [i, f] of b.frogs.entries()) {
      const back = backPoints(f.x, groundY(f.x, f.z), f.z, f.yaw, FROG_LEN, FROG_H);
      for (let band = 1; band <= 6; band++) {
        const g = knobsFor('zoeken', band).glimpse;
        const st = stems.map((s) => ({ ...s }));
        fitWindow(st, built, eye, back, g, { x: f.x, y: 0, z: f.z });
        const share = visibleShare(back, eye, st);
        assert.ok(share >= g * 0.6 - 1e-9 && share <= g * 1.6 + 1e-9, `cove ${id} frog ${i} at band ${band}: ${r2(share)} of it shows (glimpse ${g})`);
      }
      assert.ok(offCentre(b.views.search, f) >= 0.25, `cove ${id} frog ${i} is off the middle of the view (${r2(offCentre(b.views.search, f))})`);
      const box = frogBox(cam, f);
      assert.ok(box.w >= 55, `cove ${id} frog ${i} is ${box.w.toFixed(0)} px wide on a 1280×800 picture`);
      assert.ok(Math.abs(box.cx - W / 2) > W * 0.1, `cove ${id} frog ${i} is never in the middle column (${box.cx.toFixed(0)} px)`);
      assert.ok(box.cy > b.views.search.insetTop + 20 && box.cy < H - 60 && box.cx > 60 && box.cx < W - 60, `cove ${id} frog ${i} is in the picture, below the line`);
      // the cover round it stands at least twice its height
      const near = stems.filter((s) => Math.hypot(s.x - f.x, s.z - f.z) < 0.5).map((s) => s.h).sort((a, c) => a - c);
      assert.ok(near.length >= 3 && near[Math.floor(near.length / 2)] >= 2 * FROG_H, `cove ${id} frog ${i} sits among sedge twice its height`);
    }
    // the look-alikes' slots: off every frog spot and each other, inside the view
    const slots = [...CLOD_SLOTS, ...BUTTERFLY_SLOTS, ...BIRD_SLOTS].map((q) => ({ u: q.u, v: q.v }));
    for (const [k, q] of slots.entries()) {
      for (const f of FROG_SPOTS) assert.ok(Math.hypot(q.u - f.u, q.v - f.v) >= 0.35, `slot ${k} keeps off the frog's spots`);
      for (const q2 of slots.slice(k + 1)) assert.ok(Math.hypot(q.u - q2.u, q.v - q2.v) >= 0.3, `slots ${k} apart`);
      assert.ok(Math.abs(q.u) < b.views.search.halfW + 0.15 && Math.abs(q.v) < b.views.search.halfD + 0.15, `slot ${k} is in the view`);
    }
    // the singing: he steps down beside it, the frog big in the closer view
    for (const f of b.frogs) {
      const sing = singOf(b, f);
      assert.ok(dist(sing.stand, f) > 0.9 && dist(sing.stand, f) < 1.6, 'a long arm\'s length from the frog');
      const box = frogBox(fitLens(sing.view), f);
      assert.ok(box.w >= 60 && box.w >= frogBox(fitLens(b.views.search), f).w, `the singing frog is big (${box.w.toFixed(0)} px)`);
    }
    // the moss cushion lies open (the after-frog sits on it in plain view)
    const cushion = { x: b.frame.x + 0, z: b.frame.z + 0 };
    void cushion;
    const cl = toLocal(b.frame, AFTER_FROG);
    if (id === 'B') assert.ok(Math.hypot(cl.u - CUSHION.u, cl.v - CUSHION.v) < 0.01);
  }
});

test('the stations: the path runs through the moss, a dry way round it above, none round it below; the adder on the path', () => {
  for (const { bay, st } of allStations()) {
    const c = carpetAt(st);
    assert.ok(inCarpet(c, st.at) < CARPET_WET, `${bay}.S${st.i + 1}: the path runs through the soft moss`);
    for (const q of carpetRound(c)) assert.ok(inCarpet(c, q) > 1.3, `${bay}.S${st.i + 1}: the way round stays off the moss`);
    // below it the moss reaches the water he may not walk into: no dry way round there
    const pc = polarOf(st.at);
    let r = pc.r;
    while (r > 8 && !blocked(polar(pc.th, r))) r -= 0.1;
    assert.ok(inCarpet(c, polar(pc.th, r + 0.2)) < 1, `${bay}.S${st.i + 1}: the moss runs down to the water`);
    // the adder lies on the path, and a way round her on the heather side keeps 3.2 m
    for (const sh of [-ADDER_SHIFT, ADDER_SHIFT]) {
      const a = adderAt(bay, st, sh, 0);
      assert.ok(project(PATH, a).d < 0.5, 'she lies on the path');
      const pa = polarOf(a);
      const round = polar(pa.th, pa.r + 3.3);
      assert.ok(above(round) > 0.2 && !blocked(round) && dist(round, a) >= 3.2 && dist(round, a) > ADDER_NEAR, 'a dry way round her');
    }
  }
});

test('every order of the three moments fits on the way to every cove; the dry path is never first; band 1 listens twice', () => {
  for (const id of BAY_IDS) {
    const l = route(id);
    assert.ok(l.length >= 35 && l.length <= 56, `the way to cove ${id} is ${l.length.toFixed(1)} m`);
    assert.ok(segDist(HIDE, MARKER, BAYS[id].chorus) > HIDE_R + 0.5, `the look from the marker sees cove ${id}'s water past the hide`);
    for (const order of ORDERS) for (const sh of [-ADDER_SHIFT, ADDER_SHIFT]) for (const listens of [1, 2, 3, 4]) {
      const dangers = order.filter((x) => x !== 'pad-ven');
      const laid = { bay: id, order, stations: { 'adder-ven': dangers.indexOf('adder-ven') as 0 | 1, 'modder-ven': dangers.indexOf('modder-ven') as 0 | 1 }, adderShift: sh, adderTurn: 0 };
      const way = wayOf(laid, listens);
      const moments = way.filter((w) => w.kind === 'adder' || w.kind === 'modder' || w.kind === 'pad').map((w) => w.kind);
      assert.deepEqual(moments, order.map((o) => o.split('-')[0]), `cove ${id}: the moments come in the trial's order`);
      assert.equal(way[way.length - 1].kind, 'bay', 'the cove last');
      // the moments never overlap: each one's stretch ends before the next begins (the dry
      // path starts where the moment before it ended: he walks on from there)
      const ms = way.filter((w) => w.kind !== 'listen' && w.kind !== 'bay');
      for (let k = 1; k < ms.length; k++) {
        const prev = spanOf(ms[k - 1]), next = spanOf(ms[k]);
        if (ms[k].kind === 'pad') assert.ok(Math.abs(next[0] - (ms[k - 1].kind === 'adder' ? ms[k - 1].s : prev[1])) < 1e-6, 'the dry path right after the moment before it');
        else assert.ok(next[0] >= prev[1] - 1e-6, `cove ${id} ${order.join(',')} shift ${sh}: moment ${k} starts after the one before (${prev[1].toFixed(1)} → ${next[0].toFixed(1)})`);
      }
      const pad = way.find((w) => w.kind === 'pad');
      if (pad?.kind === 'pad') {
        assert.ok(dist(pointAt(l, pad.s), pad.to) >= GO_AWAY, `cove ${id} ${order.join(',')}: the dry path's walk on is ${dist(pointAt(l, pad.s), pad.to).toFixed(1)} m`);
        assert.ok(dist(pad.to, pad.from) > dist(pointAt(l, pad.s), pad.from) + 0.5, 'walking on is walking away from his way behind him');
      }
      const adder = way.find((w) => w.kind === 'adder');
      if (adder?.kind === 'adder') assert.ok(dist(adder.approach, adder.adder) > 4, 'his walk to her ends well before her');
      if (listens === 1) assert.equal(way.filter((w) => w.kind === 'listen').length, 1, `cove ${id} ${order.join(',')}: one listening stop on the way (and the cove's own)`);
      for (const w of way) if (w.kind === 'listen') assert.ok(dist(w.at, MARKER) > 4, 'a listening stop on the way, not at the marker');
    }
  }
  assert.ok(ADDER_BEFORE > ADDER_NEAR + 1, 'his walk to the adder ends out of her reach');
});

test('a play\'s layout: deterministic per seed, the stations in the trial\'s order, three plays three coves', () => {
  const skin = AREA_VELUWE.missies.find((m) => m.id === 'ven')!.stappen[1].skin;
  const knobs = knobsFor('dagnacht', 1);
  const seen = new Set<string>();
  for (let seed = 1; seed <= 30; seed++) {
    const order = venOrder(skin, knobs, newPlay('ven', seed, 1), []);
    // the very trial the world's ChoiceRun and the 2D floor build for this play
    const trial = playDagnachtTrial(skin, { jargon: false, reducedMotion: false, ...knobs }, newPlay('ven', seed, 1), []).encounters.map((e) => e.id);
    assert.deepEqual(order, trial, `seed ${seed}: the layout's order is the trial's`);
    assert.notEqual(order[0], 'pad-ven', 'the dry path never first');
    seen.add(order.join(','));
    const a = venLayout(newPlay('ven', seed, 1), order);
    const b = venLayout(newPlay('ven', seed, 1), order);
    assert.deepEqual(a, b, 'the same seed lays the same bank');
    const dangers = order.filter((x) => x !== 'pad-ven');
    assert.equal(a.stations['adder-ven'], dangers.indexOf('adder-ven'));
    assert.equal(a.stations['modder-ven'], dangers.indexOf('modder-ven'));
    assert.ok(Math.abs(a.adderShift) <= ADDER_SHIFT);
  }
  assert.equal(seen.size, 4, 'all four orders come up');
  // three plays in a row, with the history: three coves, three orders
  const hist: { m: string; sd: number; va: string }[] = [];
  const coves: string[] = [], orders: string[] = [];
  for (const seed of [41, 42, 43]) {
    const play = newPlay('ven', seed, coves.length + 1);
    const order = venOrder(skin, knobs, play, hist);
    const l = venLayout(play, order, lastVenVariants(hist));
    play.note('ven', l.variant);
    hist.push({ m: 'ven', sd: seed, va: Object.entries(play.variant).map(([k, v]) => `${k}:${v}`).join(',') });
    coves.push(l.bay); orders.push(order.join(','));
  }
  assert.equal(new Set(coves).size, 3, `three plays, three coves (${coves.join(', ')})`);
  assert.equal(new Set(orders).size, 3, `three plays, three orders (${orders.join(' | ')})`);
});

test('the decoys: a trial\'s look-alikes laid on the cove\'s own slots, the same for the same stream', () => {
  const rng = (seed: number): (() => number) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };
  const decoys = [{ id: 'r1', k: 'bush' }, { id: 'r2', k: 'bush' }, { id: 'v1', k: 'butterfly' }, { id: 'b1', k: 'bird' }];
  for (const id of BAY_IDS) {
    const a = decoySlots(BAYS[id], decoys, rng(7)), b = decoySlots(BAYS[id], decoys, rng(7));
    assert.deepEqual(a, b);
    assert.equal(a.length, 4);
    for (const q of a) for (const f of BAYS[id].frogs) assert.ok(dist(q, f) >= 0.35);
  }
  const ids: BayId[] = [...BAY_IDS];
  assert.equal(ids.length, 3);
  void APPROACH; void RANGER_STAND_HEIGHT;
});
