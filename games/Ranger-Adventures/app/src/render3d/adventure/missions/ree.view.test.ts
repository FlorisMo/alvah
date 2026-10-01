/**
 * ree.view.test.ts — what the lens shows in "Het reekalf in het gras", for every layout and
 * every spot the calf may lie in (run 7, design `state/ree/design.md` §6.3-6.4), measured
 * on a 1280×800 screen through the same fit the play Stage makes (play/stage.ts `fitAt`
 * with an anchor: a fixed pitch, the lens backed off until the box and what it must
 * include fit the band between the objective line and the bottom inset). Stage itself
 * needs the DOM, so `fitLens` below is its pure replica; the browser confirmed it
 * (layout A, spot 0: the search's hint read at (461, 282), this fit's back centre at
 * (448, 288); the lens 3.71 m over the ground, this fit 3.80). Run: `npm test`.
 *
 * The search: the calf never in the middle of the picture (outside the central box), below
 * the objective line, clear of the edges, as big in every (layout, spot) (±30 %); the boy
 * whole and small in a lower corner, seen from behind and beside, the far rim of the grass
 * in the picture; no pool in its foreground. By the calf: the calf big, the boy beside it, never over it.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { heightAt as groundY } from '../../Biomes.ts';
import { RANGER_STAND_HEIGHT, SIZE } from '../../AnimalScale.ts';
import { toward } from '../places.ts';
import {
  LAYOUTS, CALF_DOELEN, COPSE, THICKET, COPSE_TREES, FRINGE, POOL, STAND, calfAt, calfTalkOf, calfView, juniperR, poolsOf, type ViewSpec,
} from './ree.places.ts';

const W = 1280, H = 800, FOV = 55;

/** The pure replica of `Stage.fitAt` for an anchored view (play/stage.ts). */
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

/** Screen px of a world point (and whether it is in front of the lens). */
function px(cam: THREE.Camera, x: number, y: number, z: number): { x: number; y: number; front: boolean } {
  const v = new THREE.Vector3(x, y, z).project(cam);
  return { x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * H, front: v.z < 1 };
}

/** The calf lying: its back's middle (the height a glimpse is seen at) and its length. */
const LYING = 0.33;
function backOf(cam: THREE.Camera, c: { x: number; z: number; yaw: number }): { mid: { x: number; y: number }; len: number } {
  const y = groundY(c.x, c.z) + LYING;
  const h = SIZE.reekalf.len / 2;
  const a = px(cam, c.x + Math.sin(c.yaw) * h, y, c.z + Math.cos(c.yaw) * h), b = px(cam, c.x - Math.sin(c.yaw) * h, y, c.z - Math.cos(c.yaw) * h);
  return { mid: px(cam, c.x, y, c.z), len: Math.hypot(a.x - b.x, a.y - b.y) };
}

/** The convex outline of screen points (counter-clockwise in screen y-down terms). */
function hull(p: readonly { x: number; y: number }[]): { x: number; y: number }[] {
  const s = [...p].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo: { x: number; y: number }[] = [], up: { x: number; y: number }[] = [];
  for (const q of s) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of [...s].reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}

/** How far (px) a screen point lies outside a convex outline (≤ 0 inside). */
function outside(h: readonly { x: number; y: number }[], q: { x: number; y: number }): number {
  let worst = -Infinity;
  for (let i = 0; i < h.length; i++) {
    const a = h[i], b = h[(i + 1) % h.length];
    const ex = b.x - a.x, ey = b.y - a.y, L = Math.hypot(ex, ey) || 1;
    worst = Math.max(worst, ((q.x - a.x) * ey - (q.y - a.y) * ex) / L);
  }
  return worst;
}

/** Distance (m) from a point to a 3D segment. */
function segDist3(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
  const ab = b.clone().sub(a), t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / ab.lengthSq()));
  return p.distanceTo(a.clone().addScaledVector(ab, t));
}

test('the search: the calf never in the middle of the picture, as big in every stand and spot', () => {
  const lens: number[] = [];
  for (const l of LAYOUTS) {
    const cam = fitLens(l.views.search);
    for (const [i, d] of CALF_DOELEN.entries()) {
      const c = calfAt(l, d);
      const { mid, len } = backOf(cam, c);
      lens.push(len);
      const dx = Math.abs(mid.x - W / 2), dy = Math.abs(mid.y - H / 2);
      // (outside the central box, |dx| ≥ 160 or |dy| ≥ 110 px, with a fifth to spare: the
      // play's hint point is the part of its back that shows, a little off its middle)
      assert.ok(dx >= 160 * 1.2 || dy >= 110 * 1.2, `${l.id}${i}: its back is at (${mid.x.toFixed(0)}, ${mid.y.toFixed(0)}): in the middle`);
      assert.ok(mid.y >= 120, `${l.id}${i}: under the objective line (${mid.y.toFixed(0)})`);
      assert.ok(mid.x >= 90 && mid.x <= W - 90 && mid.y <= H - 90, `${l.id}${i}: clear of the edges`);
      // no juniper or trunk between the lens and the calf
      const back = new THREE.Vector3(c.x, groundY(c.x, c.z) + LYING, c.z);
      const solids = [...COPSE.junipers, ...THICKET.junipers, ...LAYOUTS.map((q) => q.hideJuniper)].map((j) => ({ x: j.x, z: j.z, r: juniperR(j.h), top: j.h }))
        .concat(COPSE_TREES.map((t) => ({ x: t.x, z: t.z, r: 0.3, top: t.h })));
      for (const s of solids) {
        const gy = groundY(s.x, s.z);
        const hit = [0.2, 0.5, 0.8].some((k) => segDist3(new THREE.Vector3(s.x, gy + s.top * k, s.z), cam.position, back) < s.r);
        assert.ok(!hit, `${l.id}${i}: a bush or a trunk stands between the lens and the calf`);
      }
    }
  }
  const med = [...lens].sort((a, b) => a - b)[Math.floor(lens.length / 2)];
  for (const len of lens) assert.ok(Math.abs(len - med) / med <= 0.3, `its back is ${len.toFixed(0)} px long (median ${med.toFixed(0)}): ±30 %`);
});

test('the search: he stands whole and small in a lower corner, the far rim of the grass in the picture, no pool in its foreground', () => {
  for (const l of LAYOUTS) {
    const cam = fitLens(l.views.search);
    const s = l.search, gs = groundY(s.x, s.z);
    const feet = px(cam, s.x, gs, s.z), head = px(cam, s.x, gs + RANGER_STAND_HEIGHT, s.z);
    const hFrac = (feet.y - head.y) / H;
    const nx = feet.x / (W / 2) - 1, ny = 1 - (feet.y + head.y) / H;
    assert.ok(hFrac >= 0.14 && hFrac <= 0.23, `${l.id}: he is ${(hFrac * 100).toFixed(0)} % of the picture's height (today 23 %)`);
    assert.ok(Math.abs(nx) >= 0.45 && ny <= -0.45, `${l.id}: he stands in a lower corner (ndc ${nx.toFixed(2)}, ${ny.toFixed(2)})`);
    assert.ok(feet.y <= H - 4 && head.y >= 100 && feet.x >= 10 && feet.x <= W - 10, `${l.id}: he is whole in the picture`);
    // the lens: behind him and beside him, never over his head
    const lensH = cam.position.y - groundY(cam.position.x, cam.position.z);
    const toHead = cam.position.distanceTo(new THREE.Vector3(s.x, gs + RANGER_STAND_HEIGHT, s.z));
    assert.ok(lensH <= 4.0 && toHead >= 3.5, `${l.id}: the lens ${lensH.toFixed(2)} m over the ground, ${toHead.toFixed(2)} m from his head`);
    // the grass's far rim (its fringe, standing) is in the picture, under the objective line
    const far = toward(l.frame, { x: l.frame.x + Math.sin(l.frame.heading), z: l.frame.z + Math.cos(l.frame.heading) }, FRINGE.b * 1.2);
    const rim = px(cam, far.x, groundY(far.x, far.z) + 0.9, far.z);
    assert.ok(rim.y >= 110, `${l.id}: the far rim of the grass shows (${rim.y.toFixed(0)} px)`);
    // the stand's tall grass in the picture (where the calf and the look-alikes lie): the
    // outline of the stand, standing (its loose fringe of tussocks thins out beyond)
    const rimPx: { x: number; y: number }[] = [];
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2, u = STAND.halfW * Math.cos(a), v = STAND.halfD * Math.sin(a);
      const q = { x: l.frame.x - Math.cos(l.frame.heading) * u + Math.sin(l.frame.heading) * v, z: l.frame.z + Math.sin(l.frame.heading) * u + Math.cos(l.frame.heading) * v };
      for (const y of [0, 0.9]) rimPx.push(px(cam, q.x, groundY(q.x, q.z) + y, q.z));
    }
    const grass = hull(rimPx);
    // no pool of this layout lies in the search's foreground (the pool on her path he
    // walked round may show far off beside the grass, in the heath beyond)
    for (const p of poolsOf(l)) {
      for (const [u, v] of [[0, 0], [POOL.halfW, 0], [-POOL.halfW, 0], [0, POOL.halfD], [0, -POOL.halfD]]) {
        const q = { x: p.x - Math.cos(p.heading) * u + Math.sin(p.heading) * v, z: p.z + Math.sin(p.heading) * u + Math.cos(p.heading) * v };
        const s2 = px(cam, q.x, groundY(q.x, q.z), q.z);
        const shows = s2.front && s2.x >= 0 && s2.x <= W && s2.y >= 0 && s2.y <= H;
        const far = cam.position.distanceTo(new THREE.Vector3(q.x, groundY(q.x, q.z), q.z));
        const beside = outside(grass, s2) > 10;
        assert.ok(!shows || (s2.y < H / 2 && beside && far > 8), `${l.id}: a pool shows in the search's foreground at (${s2.x.toFixed(0)}, ${s2.y.toFixed(0)}), ${far.toFixed(1)} m off`);
      }
    }
  }
});

test('by the calf: the calf big in the picture, the boy beside it, never over it', () => {
  for (const l of LAYOUTS) for (const [i, d] of CALF_DOELEN.entries()) {
    const c = calfAt(l, d);
    const talk = calfTalkOf(l, c);
    const cam = fitLens(calfView(l, c, talk));
    const { mid, len } = backOf(cam, c);
    assert.ok(len >= 120, `${l.id}${i}: the calf is ${len.toFixed(0)} px long`);
    assert.ok(mid.y >= 140 && mid.y <= H - 60 && mid.x >= 200 && mid.x <= W - 200, `${l.id}${i}: the calf in the middle of the picture (${mid.x.toFixed(0)}, ${mid.y.toFixed(0)})`);
    const g = groundY(talk.x, talk.z);
    const top = px(cam, talk.x, g + RANGER_STAND_HEIGHT, talk.z), chin = px(cam, talk.x, g + RANGER_STAND_HEIGHT - 0.3, talk.z), feet = px(cam, talk.x, g, talk.z);
    assert.ok((chin.y - top.y) / H <= 0.18, `${l.id}${i}: his head is ${(((chin.y - top.y) / H) * 100).toFixed(0)} % of the picture's height`);
    assert.ok(Math.abs((top.x + feet.x) / 2 - mid.x) > 200, `${l.id}${i}: he stands beside the calf, not in front of it`);
  }
});
