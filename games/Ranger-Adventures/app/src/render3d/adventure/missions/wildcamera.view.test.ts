/**
 * wildcamera.view.test.ts — what the lens over the crossing shows in "De wildcamera" (run 7,
 * design `state/wildcamera/design.md` §6.2-6.4), measured on a 1280×800 screen through the
 * same fit the play Stage makes (play/stage.ts `fitAt` with an anchor; `fitLens` is its pure
 * replica, as in ree.view.test.ts). The browser confirmed it: the crossing's view put its
 * lens at (6.00, 3.21, -22.58) (`__ranger.cam()`, 2026-10-02), this fit within 0.15 m.
 *
 * The aim: every stop a visitor waits at is in the picture, off its middle (the pine, the
 * camera and the ranger are there), clear of what stands between it and the lens, and each
 * visitor walks in from out of the picture. The night: every legal layout of the night
 * choir has all four callers in the picture, unhidden, well apart on the screen.
 * Run: `npm test`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { heightAt as groundY } from '../../Biomes.ts';
import { RANGER_STAND_HEIGHT, SIZE } from '../../AnimalScale.ts';
import {
  CROSS, CROSS_VIEW, CALLER_SLOTS, ENTRY, EXIT, JUNIPER, LOG, NIGHTJAR_STUMP, PINE, SETT_MOUND, SKY, STOPS, SLOT_CLASH, SLOT_IDS, TAG_AT, THICKET_BUSHES, TREE,
  WILDCAMERA_PLACES as P, arrivalPath, type SlotId, type StopId,
} from './wildcamera.places.ts';
import { legalLayouts } from './wildcamera.variety.ts';
import { atLocal, segDist, toLocal } from '../places.ts';
import type { Spot } from '../types.ts';

const W = 1280, H = 800, FOV = 55;

type ViewSpec = {
  at: Spot; heading: number; halfW: number; halfD: number; tall: number; pitchDeg: number; insetTop: number; insetBottom: number;
  include?: readonly { x: number; z: number; h: number; r?: number }[];
};

/** The pure replica of `Stage.fitAt` for an anchored view (play/stage.ts), on a `w` × `h`
 *  screen (the laptop's by default). (A copy of ree.view.test.ts's.) */
function fitLens(f: ViewSpec, w = W, h = H): THREE.PerspectiveCamera {
  const tall = f.tall, pitch = (f.pitchDeg * Math.PI) / 180;
  const right = { x: -Math.cos(f.heading), z: Math.sin(f.heading) };
  const include = (f.include ?? []).flatMap((q) => ((q.r ?? 0) > 0 ? [-q.r!, q.r!].map((u) => ({ x: q.x + right.x * u, z: q.z + right.z * u, h: q.h })) : [q]));
  const fv = new THREE.Vector3(Math.sin(f.heading), 0, Math.cos(f.heading));
  const rv = new THREE.Vector3(-fv.z, 0, fv.x);
  const Pp = new THREE.Vector3(f.at.x, groundY(f.at.x, f.at.z), f.at.z);
  const yTop = 1 - (2 * (f.insetTop + 12)) / h, yBot = -1 + (2 * (f.insetBottom + 12)) / h, xLim = 1 - (24 / w) * 2;
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
  const cam = new THREE.PerspectiveCamera(FOV, w / h, 0.1, 400);
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

/** Screen px of a world point. */
function px(cam: THREE.Camera, x: number, y: number, z: number): { x: number; y: number; front: boolean } {
  const v = new THREE.Vector3(x, y, z).project(cam);
  return { x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * H, front: v.z < 1 };
}
const onGround = (cam: THREE.Camera, p: Spot, up = 0): { x: number; y: number; front: boolean } => px(cam, p.x, groundY(p.x, p.z) + up, p.z);

const lens = fitLens(CROSS_VIEW as unknown as ViewSpec);
/** The card at the bottom covers the screen from here down (px), the objective line the top. */
const CARD_TOP = 640, TOP = 110;

/** How much of an animal standing at `p` (`h` m tall, `len` m long side-on) a solid thing
 *  hides from the lens: the share of 9 points of its body whose line to the lens passes
 *  through the pine's trunk, the juniper, the sett's mound or the ranger. */
function hidden(p: Spot, h: number, len: number, extra: { at: Spot; r: number; h: number }[] = [], lift = 0): number {
  const solids = [
    { at: TREE, r: PINE.trunkR + 0.05, h: 8 },
    { at: JUNIPER, r: JUNIPER.r, h: 1.9 },
    { at: P.sett, r: SETT_MOUND.r, h: SETT_MOUND.h },
    { at: P.watch, r: 0.2, h: RANGER_STAND_HEIGHT },
    ...extra,
  ];
  const cam = lens.position;
  let n = 0, hid = 0;
  for (const du of [-0.4, 0, 0.4]) for (const hy of [0.35, 0.6, 0.85]) {
    const q = atLocal(CROSS, toLocal(CROSS, p).u + du * len, toLocal(CROSS, p).v);
    const y = groundY(q.x, q.z) + lift + h * hy;
    n++;
    for (const s of solids) {
      // the point on the line lens → body nearest the solid's axis, and its height there
      const d = segDist(s.at, { x: cam.x, z: cam.z }, q);
      if (d > s.r) continue;
      const tAlong = Math.hypot(s.at.x - cam.x, s.at.z - cam.z) / Math.hypot(q.x - cam.x, q.z - cam.z);
      if (tAlong >= 1) continue; // (behind the animal)
      const yAt = cam.y + (y - cam.y) * tAlong;
      if (yAt < groundY(s.at.x, s.at.z) + s.h) { hid++; break; }
    }
  }
  return hid / n;
}

test('the fit is the browser\'s lens over the crossing', () => {
  assert.ok(Math.hypot(lens.position.x - 6.0, lens.position.z + 22.58) < 0.3, `lens at (${lens.position.x.toFixed(2)}, ${lens.position.z.toFixed(2)})`);
  assert.ok(Math.abs(lens.position.y - 3.21) < 0.3, `lens ${lens.position.y.toFixed(2)} m up`);
});

test('every stop a visitor waits at: in the picture, off its middle, unhidden, clear of the ranger', () => {
  const big = { len: SIZE.hinde.len, h: SIZE.hinde.h };
  for (const [id, s] of Object.entries(STOPS) as [StopId, (typeof STOPS)[StopId]][]) {
    const feet = onGround(lens, s), back = onGround(lens, s, big.h);
    assert.ok(feet.front && feet.x > 60 && feet.x < W - 60 && feet.y < CARD_TOP - 30, `${id}: its feet in the picture above the card (${feet.x.toFixed(0)}, ${feet.y.toFixed(0)})`);
    assert.ok(back.y > TOP, `${id}: a deer's back under the objective line (${back.y.toFixed(0)})`);
    // never the middle of the picture (≥ 0.12 of its width off the centre)
    assert.ok(Math.abs(feet.x - W / 2) >= 0.12 * W, `${id}: ${Math.abs(feet.x - W / 2).toFixed(0)} px off the middle`);
    // its side: the left stops left of the pine, the right ones right
    assert.equal(feet.x < W / 2 ? 'left' : 'right', s.side, `${id} on its side`);
    // nothing solid between it and the lens
    const hid = hidden(s, big.h, big.len);
    assert.ok(hid === 0, `${id}: ${Math.round(hid * 100)} % of a deer hidden`);
  }
});

/** Does an animal standing at `p` (side-on along the view, `len` long, `h` tall, ~0.6 m
 *  wide) stand between the lens and the world point `q` (`y` m over the ground)? */
function covers(p: Spot, len: number, h: number, q: Spot, y: number): boolean {
  const cam = lens.position;
  const qy = groundY(q.x, q.z) + y;
  const pl = toLocal(CROSS, p);
  for (let t = 0.02; t < 0.995; t += 0.005) {
    const x = cam.x + (q.x - cam.x) * t, z = cam.z + (q.z - cam.z) * t, yy = cam.y + (qy - cam.y) * t;
    const l = toLocal(CROSS, { x, z });
    if (Math.abs(l.u - pl.u) < len / 2 + 0.1 && Math.abs(l.v - pl.v) < 0.35 && yy - groundY(x, z) < h + 0.05) return true;
  }
  return false;
}

test('a visitor at a stop never stands between the lens and a place: its name, its sunny patch, its juniper', () => {
  const targets: [string, Spot, number][] = [
    ['the glade\'s sunny patch', P.glade, 0.05], ['the glade\'s name', TAG_AT.open, TAG_AT.open.y],
    ['the juniper', JUNIPER, 0.95], ['the thicket\'s name', TAG_AT.hol, TAG_AT.hol.y],
  ];
  // the biggest that comes (the stag, antlers and all), and the others
  for (const animal of ['edelhert', 'hinde', 'ree', 'wildzwijn', 'vos', 'das']) {
    const z = (SIZE as Record<string, { h: number; len?: number }>)[animal];
    for (const [id, s] of Object.entries(STOPS)) {
      for (const [what, q, y] of targets) assert.ok(!covers(s, z.len ?? 1, z.h, q, y), `a ${animal} at ${id} hides ${what}`);
    }
  }
});

test('the visitors walk in from out of the picture, never at the lens', () => {
  for (const side of ['left', 'right'] as const) {
    const e = ENTRY[side];
    // a whole deer out of the picture where it starts (its near end too)
    const near = atLocal(CROSS, toLocal(CROSS, e).u + (side === 'left' ? 1 : -1) * SIZE.hinde.len * 0.5, toLocal(CROSS, e).v);
    const q = onGround(lens, near, SIZE.hinde.h * 0.5);
    assert.ok(q.x < -10 || q.x > W + 10, `${side}: it starts out of the picture (${q.x.toFixed(0)} px)`);
    const out = onGround(lens, EXIT[side], SIZE.hinde.h * 0.5);
    assert.ok(out.x < -60 || out.x > W + 60, `${side}: it walks off out of the picture (${out.x.toFixed(0)} px)`);
    const sky = onGround(lens, SKY[side], SKY[side].y);
    assert.ok(sky.x < 0 || sky.x > W || sky.y < 0, `${side}: a bird flies in from out of the picture`);
  }
  for (const id of Object.keys(STOPS) as StopId[]) {
    const path = arrivalPath(id);
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      // the walk's direction against the line from it to the lens: never within 35° of it
      const dx = b.x - a.x, dz = b.z - a.z;
      const tx = lens.position.x - (a.x + b.x) / 2, tz = lens.position.z - (a.z + b.z) / 2;
      const ang = Math.acos((dx * tx + dz * tz) / (Math.hypot(dx, dz) * Math.hypot(tx, tz)));
      assert.ok(ang > (35 * Math.PI) / 180, `${id}: leg ${i} walks ${Math.round((ang * 180) / Math.PI)}° off the lens`);
    }
  }
});

test('every night: the four callers in the picture, unhidden, well apart on the screen', () => {
  // the casts the core may draw: the badger and three of the others
  const others = ['wildzwijn', 'ree', 'nachtzwaluw', 'vos'];
  const casts = others.map((leave) => ['das', ...others.filter((o) => o !== leave)]);
  const H_OF: Record<string, number> = { das: SIZE.das.h, wildzwijn: SIZE.wildzwijn.h, ree: SIZE.ree.h, vos: SIZE.vos.h, nachtzwaluw: SIZE.nachtzwaluw.h * 1.5 };
  const LIFT: Partial<Record<SlotId, number>> = { log: LOG.h, stump: NIGHTJAR_STUMP.h };
  const LEN = (id: string): number => ((SIZE as Record<string, { len?: number }>)[id]?.len ?? 0.5) * (id === 'nachtzwaluw' ? 1.5 : 1);
  const mid = (slot: SlotId, id: string): { x: number; y: number } => {
    const s = CALLER_SLOTS[slot];
    return onGround(lens, s.at, (LIFT[slot] ?? 0) + H_OF[id] * 0.5);
  };
  let layouts = 0;
  for (const cast of casts) {
    const all = legalLayouts(cast);
    assert.ok(all.length >= 4, `${cast.join(', ')}: ${all.length} layouts`);
    for (const lay of all) {
      layouts++;
      const ids = Object.keys(lay);
      for (const id of ids) {
        const m = mid(lay[id], id);
        assert.ok(m.x > 50 && m.x < W - 50 && m.y > TOP + 20 && m.y < CARD_TOP - 20, `${id} at ${lay[id]} in the picture (${m.x.toFixed(0)}, ${m.y.toFixed(0)})`);
        const s = CALLER_SLOTS[lay[id]];
        // (the other callers stand between it and the lens too: the solids and them)
        const others = ids.filter((o) => o !== id).map((o) => ({ at: CALLER_SLOTS[lay[o]].at, r: Math.max(0.2, LEN(o) * 0.5), h: (LIFT[lay[o]] ?? 0) + H_OF[o] }));
        const hid = hidden(s.at, H_OF[id], LEN(id), others, LIFT[lay[id]] ?? 0);
        assert.ok(hid <= 0.12, `${id} at ${lay[id]}: ${Math.round(hid * 100)} % hidden`);
      }
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
        const a = mid(lay[ids[i]], ids[i]), b = mid(lay[ids[j]], ids[j]);
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        assert.ok(d >= 120, `${ids[i]}@${lay[ids[i]]} and ${ids[j]}@${lay[ids[j]]}: ${d.toFixed(0)} px apart`);
        assert.ok(Math.hypot(CALLER_SLOTS[lay[ids[i]]].at.x - CALLER_SLOTS[lay[ids[j]]].at.x, CALLER_SLOTS[lay[ids[i]]].at.z - CALLER_SLOTS[lay[ids[j]]].at.z) >= 1.6, 'apart in the wood');
      }
    }
  }
  assert.ok(layouts > 20, `${layouts} nights pinned`);
  // every walker comes in from out of the picture, never walking at the lens
  for (const id of SLOT_IDS) {
    const s = CALLER_SLOTS[id];
    if (s.animals.includes('nachtzwaluw')) continue; // (it flies in)
    const st = onGround(lens, s.from, 0.5);
    if (id !== 'sett-l' && id !== 'sett-r') assert.ok(st.x < -40 || st.x > W + 40, `${id}: it comes from out of the picture (${st.x.toFixed(0)} px)`);
    const dx = s.at.x - s.from.x, dz = s.at.z - s.from.z;
    const tx = lens.position.x - (s.at.x + s.from.x) / 2, tz = lens.position.z - (s.at.z + s.from.z) / 2;
    const ang = Math.acos((dx * tx + dz * tz) / (Math.hypot(dx, dz) * Math.hypot(tx, tz)));
    assert.ok(ang > (35 * Math.PI) / 180, `${id}: it walks in ${Math.round((ang * 180) / Math.PI)}° off the lens`);
  }
  // the clashing pairs are what keeps two spots apart: each one IS too near
  for (const [a, b] of SLOT_CLASH) {
    const dw = Math.hypot(CALLER_SLOTS[a].at.x - CALLER_SLOTS[b].at.x, CALLER_SLOTS[a].at.z - CALLER_SLOTS[b].at.z);
    let near = Infinity, hid = 0;
    for (const ida of CALLER_SLOTS[a].animals) for (const idb of CALLER_SLOTS[b].animals) {
      const pa = mid(a, ida), pb = mid(b, idb);
      near = Math.min(near, Math.hypot(pa.x - pb.x, pa.y - pb.y));
      const occ = (x: SlotId, idx: string, y: SlotId, idy: string): number => hidden(CALLER_SLOTS[x].at, H_OF[idx], LEN(idx), [{ at: CALLER_SLOTS[y].at, r: Math.max(0.2, LEN(idy) * 0.5), h: (LIFT[y] ?? 0) + H_OF[idy] }], LIFT[x] ?? 0);
      hid = Math.max(hid, occ(a, ida, b, idb), occ(b, idb, a, ida));
    }
    assert.ok(near < 120 || dw < 1.6 || hid > 0.12, `${a} and ${b} are a real clash (${near.toFixed(0)} px, ${dw.toFixed(2)} m, ${Math.round(hid * 100)} % hidden)`);
  }
  void SLOT_IDS; void THICKET_BUSHES;
});
