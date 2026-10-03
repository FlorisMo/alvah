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
  CAMERA, SNARE_IDS, SNARE_SPOTS, SEARCH_VIEW, TEST_SPOT, TEST_VIEW, walkBackView, PINE_PICK,
  CUB_LAG, FAMILY_SHOT, WHITE_ROE_OUT, familyPath, aimSpot, FAN_HALF,
} from './wildcamera.places.ts';
import { trunkOutline, type Trunk } from '../squirrel-math.ts';
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

/* --------------------------------------------- run 7 (wc-hands): the hands ---- */

test('the strap beat: from the crossing\'s lens the camera\'s place on the trunk shows past him', () => {
  // he stands where the walk in ends (the crossing's approach); the lens is the crossing's
  const me = P.crossApproach;
  const spotY = groundY(CAMERA.x, CAMERA.z) + PINE.camY;
  const sc = px(lens, CAMERA.x, spotY, CAMERA.z);
  assert.ok(sc.front && sc.x > 120 && sc.x < W - 120 && sc.y > TOP && sc.y < CARD_TOP, `on screen at (${sc.x.toFixed(0)}, ${sc.y.toFixed(0)})`);
  // the line from the lens to it passes him (beside him, or over his head)
  const d = segDist(me, { x: lens.position.x, z: lens.position.z }, CAMERA);
  const tAt = Math.hypot(me.x - lens.position.x, me.z - lens.position.z) / Math.hypot(CAMERA.x - lens.position.x, CAMERA.z - lens.position.z);
  const yAt = lens.position.y + (spotY - lens.position.y) * tAt;
  assert.ok(d > 0.35 || yAt > groundY(me.x, me.z) + RANGER_STAND_HEIGHT + 0.1, `he is not in front of it (${d.toFixed(2)} m beside the line, the line ${(yAt - groundY(me.x, me.z)).toFixed(2)} m up there)`);
  // and he stands in the picture, apart from it on the screen
  const him = onGround(lens, me, RANGER_STAND_HEIGHT * 0.6);
  assert.ok(Math.hypot(him.x - sc.x, him.y - sc.y) > 60, `apart on the screen (${Math.hypot(him.x - sc.x, him.y - sc.y).toFixed(0)} px)`);
});

test('the strap beat: a click anywhere on the camera pine\'s trunk finds it, from its foot up to its crown, at its girth', () => {
  // the lens of the beat (the crossing's view, him at the crossing's approach)
  const cam = fitLens({ ...CROSS_VIEW, include: [{ x: P.crossApproach.x, z: P.crossApproach.z, h: RANGER_STAND_HEIGHT }] } as unknown as ViewSpec);
  // the click's target as the home builds it (wildcamera.home: a lathe of PINE_PICK at the tree's foot)
  const foot = groundY(TREE.x, TREE.z);
  const proxy = new THREE.Mesh(
    new THREE.LatheGeometry(PINE_PICK.profile.map(([y, r]) => new THREE.Vector2(r, y)), PINE_PICK.seg),
    new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }),
  );
  proxy.position.set(TREE.x, foot, TREE.z);
  proxy.updateMatrixWorld(true);
  // the trunk the player sees: the pine's measured outline (squirrel-math TRUNK_OUTLINE, the
  // furthest bark at each height) up to where its crown starts (world/Crowns.ts: 0.44 of a
  // pine's height)
  const trunk: Trunk = { x: TREE.x, z: TREE.z, H: SIZE.den.h * PINE.s, species: 'prop-pine-scots' };
  const crown = 0.44 * trunk.H;
  assert.ok(PINE_PICK.crown >= crown - 1e-6, `the target reaches the crown (${PINE_PICK.crown.toFixed(2)} m of ${crown.toFixed(2)} m)`);
  // across the trunk as the lens sees it: its left edge, its middle, its right edge
  const toLens = new THREE.Vector3(cam.position.x - TREE.x, 0, cam.position.z - TREE.z).normalize();
  const across = new THREE.Vector3(-toLens.z, 0, toLens.x);
  const ray = new THREE.Raycaster();
  let shown = 0, top = Infinity, bottom = -Infinity;
  for (let h = 0.02; h < crown; h += 0.1) {
    const r = trunkOutline(trunk, h) * 0.98;
    // (a little off its axis: a ray exactly along a seam of the lathe's facets is a
    // floating-point coin toss, never a click)
    for (const u of [-1, -0.45, 0.07, 0.55, 1]) {
      const p = new THREE.Vector3(TREE.x + across.x * u * r, foot + h, TREE.z + across.z * u * r);
      const s = px(cam, p.x, p.y, p.z);
      if (!s.front || s.x < 0 || s.x > W || s.y < 0 || s.y > H) continue; // (off the picture)
      shown++;
      top = Math.min(top, s.y); bottom = Math.max(bottom, s.y);
      ray.set(cam.position, p.clone().sub(cam.position).normalize());
      assert.ok(ray.intersectObject(proxy).length > 0, `a click on the trunk ${h.toFixed(2)} m up, ${u === -1 ? 'its left edge' : u === 1 ? 'its right edge' : 'across it'} (${s.x.toFixed(0)}, ${s.y.toFixed(0)}) finds the pine`);
    }
  }
  // the trunk stands tall in the picture (a band round it at his chest would not cover it)
  assert.ok(shown > 100 && bottom - top > 300, `the trunk shows ${(bottom - top).toFixed(0)} px tall`);
  // and the camera's place on it (the play hint) is on it too
  const spot = new THREE.Vector3(CAMERA.x, foot + PINE.camY, CAMERA.z);
  ray.set(cam.position, spot.clone().sub(cam.position).normalize());
  assert.ok(ray.intersectObject(proxy).length > 0, 'the camera\'s place');
  // (how big the trunk and the glow round the camera's place show: wildcamera.home GHOST_GLOW)
  const mPx = (H / 2) / (cam.position.distanceTo(spot) * Math.tan((FOV * Math.PI) / 360));
  console.log(`# strap view: trunk ${(bottom - top).toFixed(0)} px tall, ${(2 * trunkOutline(trunk, PINE.camY) * mPx).toFixed(0)} px wide at the camera; ${mPx.toFixed(0)} px per m there`);
});

test('each snare\'s close view: the wire in the grass off the middle, under the line and the pinned photo, its landmarks and him in the picture', () => {
  // the pinned photo (wildcamera.css .wc-pin): 220 × 138 px top-centre under the line
  const PIN = { x0: W / 2 - 114, x1: W / 2 + 114, y0: 100, y1: 250 };
  for (const id of SNARE_IDS) {
    const sp = SNARE_SPOTS[id];
    const cam = fitLens(sp.view as unknown as ViewSpec);
    const wire = onGround(cam, sp.at, 0.06);
    assert.ok(wire.front && wire.x > 60 && wire.x < W - 60 && wire.y > TOP && wire.y < H - 60, `${id}: the snare at (${wire.x.toFixed(0)}, ${wire.y.toFixed(0)})`);
    assert.ok(!(wire.x > PIN.x0 && wire.x < PIN.x1 && wire.y > PIN.y0 && wire.y < PIN.y1), `${id}: the snare is not under the pinned photo`);
    assert.ok(Math.abs(wire.x - W / 2) >= 0.1 * W || Math.abs(wire.y - H / 2) >= 0.1 * H, `${id}: the snare is not dead centre (${wire.x.toFixed(0)}, ${wire.y.toFixed(0)})`);
    for (const m of sp.marks) {
      const q = onGround(cam, m.at, m.h * 0.5);
      assert.ok(q.front && q.x > -40 && q.x < W + 40 && q.y > 0 && q.y < H, `${id}: its ${m.model} is in the picture (${q.x.toFixed(0)}, ${q.y.toFixed(0)})`);
    }
    const him = onGround(cam, sp.approach, RANGER_STAND_HEIGHT * 0.5);
    assert.ok(him.front && him.x > 40 && him.x < W - 40 && him.y > TOP && him.y < H, `${id}: he is in the picture (${him.x.toFixed(0)}, ${him.y.toFixed(0)})`);
    // he never stands between the lens and the wire
    const d = segDist(sp.approach, { x: cam.position.x, z: cam.position.z }, sp.at);
    assert.ok(d > 0.3, `${id}: he is not in front of the snare (${d.toFixed(2)} m)`);
  }
});

test('the hand-overs: before each walk of his own the lens stands behind him, turned the way he goes (the Up key walks him there)', () => {
  /** the lens's ground spot is behind him, and the goal lies ahead in the picture's middle half */
  const behind = (name: string, v: ViewSpec, me: Spot, goal: Spot): void => {
    const cam = fitLens(v);
    const back = { x: cam.position.x - me.x, z: cam.position.z - me.z };
    const fwd = { x: goal.x - me.x, z: goal.z - me.z };
    const cos = (back.x * fwd.x + back.z * fwd.z) / (Math.hypot(back.x, back.z) * Math.hypot(fwd.x, fwd.z));
    assert.ok(cos < -0.9, `${name}: the lens stands behind him (${cos.toFixed(2)})`);
    const him = onGround(cam, me, RANGER_STAND_HEIGHT * 0.5);
    assert.ok(him.front && him.x > 200 && him.x < W - 200 && him.y > TOP && him.y < H - 40, `${name}: he is in the picture (${him.x.toFixed(0)}, ${him.y.toFixed(0)})`);
  };
  behind('the test', TEST_VIEW as unknown as ViewSpec, P.strap, TEST_SPOT);
  for (const id of SNARE_IDS) {
    const sp = SNARE_SPOTS[id];
    behind(`back from ${id}`, walkBackView(sp.approach) as unknown as ViewSpec, sp.approach, P.handBack);
    // the search: every spot lies ahead of him (within 60° of the way the lens looks)
    const ahead = Math.abs(Math.atan2(Math.sin(Math.atan2(sp.at.x - P.handBack.x, sp.at.z - P.handBack.z) - SEARCH_VIEW.heading), Math.cos(Math.atan2(sp.at.x - P.handBack.x, sp.at.z - P.handBack.z) - SEARCH_VIEW.heading)));
    assert.ok(ahead < Math.PI / 3, `the search: ${id} lies ahead of him (${((ahead * 180) / Math.PI).toFixed(0)}°)`);
  }
  behind('the search', SEARCH_VIEW as unknown as ViewSpec, P.handBack, SEARCH_VIEW.at);
});

/* ---------------------------------------------- wc-album: the rare ones' ways ---- */

test('the fox family: out of the picture, across the crossing side-on, clear of every caller, the sett and him, out again', () => {
  for (const side of ['left', 'right'] as const) {
    const path = familyPath(side);
    // (a whole fox, nose to tail, out of the picture where they come out and where they go)
    for (const end of [path[0], path[path.length - 1]]) {
      for (const du of [-0.55, 0, 0.55]) {
        const q = onGround(lens, atLocal(CROSS, toLocal(CROSS, end).u + du, toLocal(CROSS, end).v), SIZE.vos.h * 0.5);
        assert.ok(q.x < -10 || q.x > W + 10, `${side}: an end of their way is in the picture (${q.x.toFixed(0)} px)`);
      }
    }
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      // never at the lens (as the visitors' ways in: every leg ≥ 35° off the line to the lens),
      // and across the picture while in it (≥ 45°: a three-quarter view at its edges at most,
      // side-on in its middle)
      const dx = b.x - a.x, dz = b.z - a.z;
      const tx = lens.position.x - (a.x + b.x) / 2, tz = lens.position.z - (a.z + b.z) / 2;
      const ang = Math.acos(Math.abs(dx * tx + dz * tz) / (Math.hypot(dx, dz) * Math.hypot(tx, tz)));
      assert.ok(ang > (35 * Math.PI) / 180, `${side}: leg ${i} runs ${Math.round((ang * 180) / Math.PI)}° off the lens`);
      const mid = onGround(lens, { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });
      if (mid.x > 0 && mid.x < W) assert.ok(ang > (45 * Math.PI) / 180, `${side}: leg ${i} in the picture runs ${Math.round((ang * 180) / Math.PI)}° off the lens`);
    }
    // in the picture they cross it above the card and under the line
    for (const p of path.slice(1, -1)) {
      const q = onGround(lens, p, SIZE.vos.h);
      if (q.x < 0 || q.x > W) continue;
      assert.ok(q.y > TOP && q.y < CARD_TOP - 40, `${side}: a fox at (${q.x.toFixed(0)}, ${q.y.toFixed(0)}) is under the line, above the card`);
    }
  }
  // clear of what stands on the crossing: every caller's spot (callers stand there that night),
  // the sett's mound, the log, the stump, the juniper, the pine and the ranger beside it
  const path = familyPath('left');
  const near = (q: Spot): number => Math.min(...path.slice(1).map((b, i) => segDist(q, path[i], b)));
  for (const id of SLOT_IDS) assert.ok(near(CALLER_SLOTS[id].at) >= 0.8, `${id}: their way passes ${near(CALLER_SLOTS[id].at).toFixed(2)} m from it`);
  for (const [what, q, r] of [
    ['the sett', P.sett, SETT_MOUND.r + 0.3], ['the log', LOG, 1.0], ['the old stump', NIGHTJAR_STUMP, NIGHTJAR_STUMP.r + 0.5],
    ['the juniper', JUNIPER, JUNIPER.r + 0.4], ['the pine', TREE, 1.0], ['the ranger', P.watch, 1.4],
  ] as [string, Spot, number][]) assert.ok(near(q) >= r, `${what}: their way passes ${near(q).toFixed(2)} m from it`);
});

test('the fox family\'s photo: right in front of the camera on its pine, where their way crosses its view side-on', () => {
  const path = familyPath('left');
  const on = Math.min(...path.slice(1).map((b, i) => segDist(FAMILY_SHOT, path[i], b)));
  assert.ok(on < 0.05, `the photo's middle lies on their way (${on.toFixed(2)} m)`);
  const d = Math.hypot(FAMILY_SHOT.x - CAMERA.x, FAMILY_SHOT.z - CAMERA.z);
  assert.ok(d > 0.7 && d < 1.4, `${d.toFixed(2)} m in front of the camera`);
  // their way there runs across the camera's view (≥ 70° off its line), so the three stand
  // side by side in the photo, and the mother and the second cub (a cub's lag either side)
  // stay inside its widest view
  for (let i = 1; i < path.length; i++) {
    if (segDist(FAMILY_SHOT, path[i - 1], path[i]) > 0.05) continue;
    const dx = path[i].x - path[i - 1].x, dz = path[i].z - path[i - 1].z;
    const lx = FAMILY_SHOT.x - CAMERA.x, lz = FAMILY_SHOT.z - CAMERA.z;
    const ang = Math.acos(Math.abs(dx * lx + dz * lz) / (Math.hypot(dx, dz) * Math.hypot(lx, lz)));
    assert.ok(ang > (70 * Math.PI) / 180, `their way crosses the camera's view at ${Math.round((ang * 180) / Math.PI)}°`);
  }
  // the photo's widest view (58° high, 16:10): its half-width at the shot is ≥ the second cub's lag + half a fox
  const half = Math.tan((29 * Math.PI) / 180) * 1.6 * d;
  assert.ok(half >= CUB_LAG[1] - CUB_LAG[0] + 0.25, `the photo is ${(2 * half).toFixed(2)} m wide there`);
  // and the camera turns there within its swivel (its fan's half-angle twice over)
  assert.ok(Math.abs(Math.atan2(FAMILY_SHOT.x - CAMERA.x, FAMILY_SHOT.z - CAMERA.z)) < FAN_HALF * 2, 'the camera looks out over the crossing');
});

test('the white roe: in from out of the picture like the glade\'s roe, and off again out of it under the trees', () => {
  const from = aimSpot('ree', 'open').from;
  for (const [what, q] of [['in', from], ['off', WHITE_ROE_OUT]] as [string, Spot][]) {
    for (const du of [-0.5, 0, 0.5]) {
      const s2 = onGround(lens, atLocal(CROSS, toLocal(CROSS, q).u + du, toLocal(CROSS, q).v), SIZE.ree.h * 0.5);
      assert.ok(s2.x < -10 || s2.x > W + 10 || !s2.front, `she walks ${what} at (${s2.x.toFixed(0)}, ${s2.y.toFixed(0)}): in the picture`);
    }
  }
});
