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
 * in the picture; no pool in its foreground; the doe in her bed out of the picture or
 * behind a juniper (a second deer in it is what a child would click). By the calf: the calf big, the boy beside it, never over it.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { heightAt as groundY } from '../../Biomes.ts';
import { RANGER_STAND_HEIGHT, SIZE } from '../../AnimalScale.ts';
import { toward } from '../places.ts';
import { backPoints } from '../cover-math.ts';
import { lyingHeight, LEG_SHARE } from '../../play/pose.ts';
import {
  LAYOUTS, CALF_DOELEN, COPSE, THICKET, COPSE_TREES, FRINGE, POOL, STAND, calfAt, calfBolt, calfTalkOf, calfView, bootView, roomView, ROOM_BACK_M, drinkSpot, juniperR, poolsOf,
  reunionPose, twinAt, twinEnd, type ViewSpec,
} from './ree.places.ts';

const W = 1280, H = 800, FOV = 55;

/** The pure replica of `Stage.fitAt` for an anchored view (play/stage.ts), on a `w` × `h`
 *  screen (the laptop's by default). */
function fitLens(f: ViewSpec, w = W, h = H): THREE.PerspectiveCamera {
  const tall = f.tall, pitch = (f.pitchDeg * Math.PI) / 180;
  const right = { x: -Math.cos(f.heading), z: Math.sin(f.heading) };
  const include = (f.include ?? []).flatMap((q) => ((q.r ?? 0) > 0 ? [-q.r!, q.r!].map((u) => ({ x: q.x + right.x * u, z: q.z + right.z * u, h: q.h })) : [q]));
  const fv = new THREE.Vector3(Math.sin(f.heading), 0, Math.cos(f.heading));
  const rv = new THREE.Vector3(-fv.z, 0, fv.x);
  const P = new THREE.Vector3(f.at.x, groundY(f.at.x, f.at.z), f.at.z);
  const yTop = 1 - (2 * (f.insetTop + 12)) / h, yBot = -1 + (2 * (f.insetBottom + 12)) / h, xLim = 1 - (24 / w) * 2;
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
  const cam = new THREE.PerspectiveCamera(FOV, w / h, 0.1, 400);
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
function px(cam: THREE.Camera, x: number, y: number, z: number, w = W, h = H): { x: number; y: number; front: boolean } {
  const v = new THREE.Vector3(x, y, z).project(cam);
  return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h, front: v.z < 1 };
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

/** The screens the search is framed on: the laptop's, an iPad's held across, and a wide
 *  screen's (a doe out of the picture only at the laptop's edge would show on it). */
const SCREENS: readonly (readonly [number, number])[] = [[W, H], [1024, 768], [1920, 1080]];

/** The dense body of a juniper (the world's bush drawn slim and tall, ree.home.ts: ~0.75 ×
 *  its height across): an upright ellipsoid round its middle, a third smaller than the
 *  bush's outline, so a line through it is a line the bush's needles stop. */
function inJuniper(q: THREE.Vector3, j: { x: number; z: number; h: number }): boolean {
  const gy = groundY(j.x, j.z);
  const r = 0.377 * j.h * 0.7, half = 0.5 * j.h * 0.85;
  return ((q.x - j.x) ** 2 + (q.z - j.z) ** 2) / (r * r) + (q.y - (gy + j.h / 2)) ** 2 / (half * half) < 1;
}

test('the search: the doe lying in her bed is out of the picture, or a juniper stands on every line to her', () => {
  // (review r1: in the thicket morning a second deer lay in the picture above the calf's
  // grass, between two junipers, and a child looking for the calf clicks her)
  const lyH = lyingHeight(SIZE.ree.h, LEG_SHARE.ree);
  const junipers = [...COPSE.junipers, ...THICKET.junipers, ...LAYOUTS.map((q) => q.hideJuniper)];
  const seen: string[] = [];
  for (const l of LAYOUTS) for (const [w, h] of SCREENS) {
    const cam = fitLens(l.views.search, w, h);
    const b = l.bed, g = groundY(b.x, b.z);
    // her back (its middle line and both flanks, rump to withers) and her raised head
    const head = { x: b.x + Math.sin(b.yaw) * SIZE.ree.len * 0.5, y: g + lyH, z: b.z + Math.cos(b.yaw) * SIZE.ree.len * 0.5 };
    const body = [...backPoints(b.x, g, b.z, b.yaw, SIZE.ree.len, lyH), head];
    let shown = 0;
    for (const p of body) {
      const s = px(cam, p.x, p.y, p.z, w, h);
      if (!s.front || s.x < 0 || s.x > w || s.y < 0 || s.y > h) continue; // out of the picture
      const P = new THREE.Vector3(p.x, p.y, p.z);
      let hid = false;
      for (let i = 1; i < 80 && !hid; i++) {
        const q = cam.position.clone().lerp(P, i / 80);
        hid = junipers.some((j) => inJuniper(q, j));
      }
      if (!hid) shown++;
    }
    if (shown) seen.push(`${l.id} (${w}×${h}): ${shown} of ${body.length} points`);
  }
  assert.deepEqual(seen, [], `the doe in her bed shows in the search's picture: ${seen.join('; ')}`);
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

test('run 7 (words-ree): three calf moments, three pictures — by his boots lower and nearer, giving room wider with the step back in it', () => {
  for (const l of LAYOUTS) for (const [i, d] of CALF_DOELEN.entries()) {
    const c = calfAt(l, d);
    const talk = calfTalkOf(l, c);
    const g = groundY(talk.x, talk.z);
    const side = fitLens(calfView(l, c, talk));
    // geur (feet still): the calf big, his boots in the picture beside it, the lens lower
    const boot = fitLens(bootView(l, c, talk));
    const b = backOf(boot, c);
    assert.ok(b.len >= 100, `${l.id}${i} boots: the calf is ${b.len.toFixed(0)} px long`);
    assert.ok(b.mid.x >= 200 && b.mid.x <= W - 200 && b.mid.y >= 140 && b.mid.y <= H - 80, `${l.id}${i} boots: the calf at (${b.mid.x.toFixed(0)}, ${b.mid.y.toFixed(0)})`);
    const feet = px(boot, talk.x, g, talk.z);
    assert.ok(feet.x >= 40 && feet.x <= W - 40 && feet.y >= 140 && feet.y <= H - 40, `${l.id}${i} boots: his boots at (${feet.x.toFixed(0)}, ${feet.y.toFixed(0)})`);
    assert.ok(Math.abs(feet.x - b.mid.x) > 150, `${l.id}${i} boots: his boots beside the calf, not over it`);
    const above = (cam: THREE.Camera): number => cam.position.y - groundY(cam.position.x, cam.position.z);
    assert.ok(above(boot) < above(side) - 0.3, `${l.id}${i} boots: the lens is lower (${above(boot).toFixed(2)} m, the side view ${above(side).toFixed(2)} m)`);
    // oppakken (give room): he whole where he stands AND where a step back takes him, the
    // calf still clearly there, his head under the objective line
    const room = fitLens(roomView(l, c, talk));
    const r = backOf(room, c);
    assert.ok(r.len >= 75, `${l.id}${i} room: the calf is ${r.len.toFixed(0)} px long`);
    const back = toward(talk, c, -ROOM_BACK_M);
    for (const [what, q] of [['here', talk], ['a step back', back]] as const) {
      const gq = groundY(q.x, q.z);
      const f = px(room, q.x, gq, q.z), t = px(room, q.x, gq + RANGER_STAND_HEIGHT, q.z);
      assert.ok(f.x >= 30 && f.x <= W - 30 && f.y <= H - 30 && t.y >= 110 && t.x >= 30 && t.x <= W - 30, `${l.id}${i} room: he ${what} at feet (${f.x.toFixed(0)}, ${f.y.toFixed(0)}), head (${t.x.toFixed(0)}, ${t.y.toFixed(0)})`);
    }
  }
});

test('by the calf: a startled calf bolts across the picture or up it, never down toward the lens or out of it', () => {
  // (review r2: the bolt ran down the picture and the calf's body was cut by its bottom edge)
  for (const l of LAYOUTS) for (const [i, d] of CALF_DOELEN.entries()) {
    const c = calfAt(l, d);
    const talk = calfTalkOf(l, c);
    const cam = fitLens(calfView(l, c, talk));
    const b = calfBolt(l, c, talk);
    const from = backOf(cam, c).mid;
    // where it lies after the bolt: its whole body (both ends, any way it lies) in the picture
    for (let k = 0; k < 8; k++) {
      const yaw = (k / 8) * Math.PI * 2, h = SIZE.reekalf.len / 2, y = groundY(b.x, b.z) + LYING;
      for (const e of [-h, h]) {
        const q = px(cam, b.x + Math.sin(yaw) * e, y, b.z + Math.cos(yaw) * e);
        assert.ok(q.x >= 30 && q.x <= W - 30 && q.y >= 120 && q.y <= H - 40, `${l.id}${i}: after its bolt it lies at the picture's edge (${q.x.toFixed(0)}, ${q.y.toFixed(0)})`);
      }
    }
    const to = px(cam, b.x, groundY(b.x, b.z) + LYING, b.z);
    assert.ok(to.y <= from.y + 25, `${l.id}${i}: it bolts down the picture, toward the lens (${from.y.toFixed(0)} → ${to.y.toFixed(0)})`);
  }
});

test('the reunion: through his glasses, the doe big and side-on, her calf drinking at the flank he sees', () => {
  for (const l of LAYOUTS) {
    const v = l.views.reunion;
    const cam = fitLens(v);
    const { yaw, side } = reunionPose(l);
    const m = l.meet, g = groundY(m.x, m.z);
    // the doe: ≥ 280 px tall (her hooves to the top of her head), whole in the picture,
    // under the reunion's line (its card reaches ~130 px down)
    const head = { x: m.x + Math.sin(yaw) * SIZE.ree.len * 0.45, z: m.z + Math.cos(yaw) * SIZE.ree.len * 0.45 };
    const hoof = px(cam, m.x, g, m.z), top = px(cam, head.x, groundY(head.x, head.z) + SIZE.ree.h, head.z);
    const tall = hoof.y - top.y;
    assert.ok(tall >= 280, `${l.id}: the doe is ${tall.toFixed(0)} px tall`);
    assert.ok(top.y >= 135 && hoof.y <= H - 30, `${l.id}: she stands under the line, whole (${top.y.toFixed(0)}-${hoof.y.toFixed(0)})`);
    // side-on: her length across the picture
    const ends = [1, -1].map((k) => px(cam, m.x + Math.sin(yaw) * k * SIZE.ree.len / 2, g + 0.6, m.z + Math.cos(yaw) * k * SIZE.ree.len / 2));
    const across = Math.abs(ends[0].x - ends[1].x);
    assert.ok(across >= 220, `${l.id}: side-on, her length is ${across.toFixed(0)} px across`);
    for (const e of ends) assert.ok(e.x >= 60 && e.x <= W - 60, `${l.id}: her head and tail in the picture (${e.x.toFixed(0)})`);
    // the calf at her flank toward the lens: nearer the lens than she is, in the picture
    const dr = drinkSpot({ ...m, yaw }, SIZE.ree.len, side);
    const camAt = { x: cam.position.x, z: cam.position.z };
    assert.ok(Math.hypot(dr.x - camAt.x, dr.z - camAt.z) < Math.hypot(m.x - camAt.x, m.z - camAt.z), `${l.id}: the calf drinks on the side he sees`);
    const cp = px(cam, dr.x, groundY(dr.x, dr.z) + 0.4, dr.z);
    assert.ok(cp.x >= 150 && cp.x <= W - 150 && cp.y <= H - 60, `${l.id}: the calf in the picture (${cp.x.toFixed(0)}, ${cp.y.toFixed(0)})`);
    // nothing between the lens and them: no juniper, no trunk
    const solids = [...COPSE.junipers, ...THICKET.junipers, ...LAYOUTS.map((q) => q.hideJuniper)].map((j) => ({ x: j.x, z: j.z, r: juniperR(j.h), top: j.h }))
      .concat(COPSE_TREES.map((t) => ({ x: t.x, z: t.z, r: 0.3, top: t.h })));
    for (const target of [new THREE.Vector3(m.x, g + 0.7, m.z), new THREE.Vector3(dr.x, g + 0.35, dr.z)]) {
      for (const q of solids) {
        const gy = groundY(q.x, q.z);
        const hit = [0.2, 0.5, 0.8].some((k) => segDist3(new THREE.Vector3(q.x, gy + q.top * k, q.z), cam.position, target) < q.r);
        assert.ok(!hit, `${l.id}: a bush or a trunk stands between the lens and the family`);
      }
    }
    // the lens stands on open heath, out of the tall grass (no stems across the picture)
    for (const s of LAYOUTS) {
      const q = { x: cam.position.x - s.frame.x, z: cam.position.z - s.frame.z };
      const u = -Math.cos(s.frame.heading) * q.x + Math.sin(s.frame.heading) * q.z, w = Math.sin(s.frame.heading) * q.x + Math.cos(s.frame.heading) * q.z;
      assert.ok(Math.hypot(u / (FRINGE.a * FRINGE.kMax), w / (FRINGE.b * FRINGE.kMax)) > 1.05, `${l.id}: the reunion's lens stands in ${s.id}'s grass`);
    }
  }
});

test('ree-discover: the rare twins at the reunion — the second calf in the picture at her chest, never behind her', () => {
  for (const l of LAYOUTS) {
    const cam = fitLens(l.views.reunion);
    const { yaw, side } = reunionPose(l);
    const m = l.meet, g = groundY(m.x, m.z);
    const tw = twinAt({ ...m, yaw }, SIZE.ree.len, side, twinEnd({ ...m, yaw }, l.twinBed));
    const dr = drinkSpot({ ...m, yaw }, SIZE.ree.len, side);
    const tp = px(cam, tw.x, groundY(tw.x, tw.z) + 0.4, tw.z);
    const cp = px(cam, dr.x, groundY(dr.x, dr.z) + 0.4, dr.z);
    assert.ok(tp.front && tp.x >= 110 && tp.x <= W - 110 && tp.y >= 160 && tp.y <= H - 50, `${l.id}: the twin in the picture (${tp.x.toFixed(0)}, ${tp.y.toFixed(0)})`);
    assert.ok(Math.abs(tp.x - cp.x) > 90, `${l.id}: the two calves apart in the picture (${Math.abs(tp.x - cp.x).toFixed(0)} px)`);
    // on his side of her: nearer the lens than her middle (nothing of her in front of it)
    const camAt = { x: cam.position.x, z: cam.position.z };
    assert.ok(Math.hypot(tw.x - camAt.x, tw.z - camAt.z) < Math.hypot(m.x - camAt.x, m.z - camAt.z), `${l.id}: the twin on the side he sees`);
    // it lies in the picture behind them (it rises there), on the side it comes round to
    const bed = l.twinBed;
    const bp = px(cam, bed.x, groundY(bed.x, bed.z) + 0.3, bed.z);
    const mp = px(cam, m.x, g + 0.6, m.z);
    assert.ok(bp.front && bp.x >= 120 && bp.x <= W - 120 && bp.y >= 180 && bp.y <= H - 100, `${l.id}: where the twin lies is in the picture (${bp.x.toFixed(0)}, ${bp.y.toFixed(0)})`);
    assert.ok(Math.hypot(bed.x - camAt.x, bed.z - camAt.z) > Math.hypot(m.x - camAt.x, m.z - camAt.z) + 2, `${l.id}: it lies behind them`);
    assert.ok(Math.sign(bp.x - mp.x) === Math.sign(tp.x - mp.x), `${l.id}: it comes round to her on its own side, never past her`);
    // it comes round her end, never through her: its way passes beyond her (m from her middle)
    assert.ok(Math.hypot(tw.round.x - m.x, tw.round.z - m.z) >= SIZE.ree.len * 0.6, `${l.id}: round her end`);
  }
});
