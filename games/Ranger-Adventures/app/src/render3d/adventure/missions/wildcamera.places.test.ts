/**
 * wildcamera.places.test.ts — where "De wildcamera" happens is chosen by looking at the
 * world; this pins that it stays a good place (design run6-missions §3.4, §4.3): in the
 * bos, inside the world, clear of the paths and the other markers, the game trail
 * leading from the marker ring to the crossing, the glade LEFT and the thicket RIGHT of
 * the camera pine in the one view, every caller in that view, the animals the camera
 * photographs in the thicket never hidden behind the sett. Run: `npm test`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WILDCAMERA_PLACES as P, MARKER, TREE, CAMERA, CROSS, CROSS_VIEW, CALLER_SLOTS, LOG, PINE, STOPS, ENTRY, EXIT, JAY_AT, SIDE_OF, SLOT_IDS,
  arrivalPath, exitPath,
  WILDCAMERA_HOME, WILDCAMERA_RESIDENTS, AIM_AT, FAN_HALF, JUNIPER, aimSpot, cameraAim, swivel, trailA, trailB,
  NIGHTJAR_AT, NIGHTJAR_STUMP, TAG_AT, THICKET_BUSHES, SETT_MOUND, ROE_HIDEAWAY, ROE_SHY_WITHIN,
  wildcameraTreeClearings, wildcameraClearings, wildcameraTrees, TRAIL_VIEW, REUNION_VIEW, STRAP_VIEW, SETT_FACE,
  SNARE_MARKS, SNARE_FOUND, SNARE_IDS, SNARE_SPOTS, TEST_SPOT, inFan, trailC, snareTufts, type SnareId,
} from './wildcamera.places.ts';
import { anchorInBiome, biomeAt, heightAt, VEN_CENTER, VEN_SHORE_R } from '../../Biomes.ts';
import { distanceToNetwork, LANE_HALF } from '../../Paths.ts';
import { dist, headingTo, toLocal, segDist, offCentre } from '../places.ts';
import { AREA_VELUWE } from '../../../content/veluwe.ts';
import { REE_PLACES, LAYOUTS as REE_LAYOUTS, reeClearings } from './ree.places.ts';
import { frislingClearings } from './frisling.places.ts';
import { eekhoornClearings } from './eekhoorn.places.ts';
import type { Spot } from '../types.ts';

/** The other markers as the world places them (read with `__ranger.markers()`, 2026-09-29). */
const OTHER_MARKERS = {
  frisling: { x: -15.6, z: -15.6 }, 'ree-niet-aanraken': { x: -15.0, z: -27.1 }, ven: { x: 24.5, z: -19.0 },
  ecoduct: { x: 19.1, z: -24.4 }, nachtronde: { x: 20.8, z: -34.2 }, eekhoorn: { x: 25.4, z: -41.9 },
};
/** The roaming squirrel's loop (world/Fauna.placeAmbientLife): home + radius. */
const ROAMERS = [{ id: 'eekhoorn', x: 4, z: -11, r: 3 }];

const wrap = (a: number): number => { let d = a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const deg = (r: number): number => Math.round((r * 180) / Math.PI);

test('the marker is the bos anchor, and it is the wildcamera mission\'s', () => {
  const a = anchorInBiome('bos', 22);
  assert.ok(dist(a, MARKER) < 1e-9);
  assert.ok(AREA_VELUWE.missies.some((m) => m.id === 'wildcamera'));
  assert.equal(WILDCAMERA_HOME.marker?.look, 'none', 'the ring shows the stump with the camera, no animal');
  assert.ok(dist(P.stump, MARKER) < 0.6, 'the stump stands in the marker ring');
});

test('the crossing lies in the bos, well inside the world, clear of the paths and the other missions', () => {
  const crossing = [P.crossApproach, P.strap, P.watch, P.handBack, P.glade, P.thicket, P.sett, TREE];
  for (const p of crossing) {
    assert.equal(biomeAt(p.x, p.z), 'bos', `(${p.x.toFixed(1)}, ${p.z.toFixed(1)}) is in the bos`);
    assert.ok(Math.hypot(p.x, p.z) < 50, 'well inside the world');
    assert.ok(distanceToNetwork(p.x, p.z) > LANE_HALF + 3, `off the sand paths (${distanceToNetwork(p.x, p.z).toFixed(1)} m)`);
    for (const [id, m] of Object.entries(OTHER_MARKERS)) assert.ok(dist(p, m) >= 10, `${dist(p, m).toFixed(1)} m from the ${id} marker`);
    for (const a of ROAMERS) assert.ok(dist(p, a) > a.r + 3, `off the ${a.id}'s loop`);
  }
  for (const id of ['ecoduct', 'nachtronde'] as const) assert.ok(dist(TREE, OTHER_MARKERS[id]) >= 12, `the crossing keeps 12 m from ${id}`);
  const walk = dist(MARKER, P.crossApproach);
  assert.ok(walk > 12 && walk < 22, `a short walk into the wood (${walk.toFixed(1)} m)`);
});

test('the wildwissel runs from the marker ring to the pine; the second trail from the glade to the thicket', () => {
  const a = trailA();
  assert.ok(dist(a[0], MARKER) < 1.2 && dist(a[0], MARKER) > 0.6, 'it leaves the ring at its edge');
  assert.ok(segDist(P.trailStart, a[0], a[1]) < 0.3, 'he steps onto it just out of the ring');
  assert.ok(dist(P.trailStart, P.stump) > 2.2, 'clear of the stump: the follow camera behind him has room');
  for (let i = 1; i < a.length; i++) assert.ok(dist(a[i - 1], a[i]) < 4, 'no jumps: one trodden line');
  const nearTree = Math.min(...a.map((p) => dist(p, TREE)));
  assert.ok(nearTree < 1.6, 'it passes the pine');
  assert.ok(segDist(P.crossApproach, a[5], a[6]) < 1.6, 'it arrives where the walk ends');
  const b = trailB();
  assert.ok(Math.min(...b.map((p) => dist(p, P.glade))) < 0.01 && Math.min(...b.map((p) => dist(p, P.thicket))) < 0.01);
  assert.ok(Math.min(...b.map((p) => dist(p, TREE))) < 1.2, 'the two trails cross at the pine');
});

test('the snare: a real little search up the wildwissel, to the foxglove and the bush of the photo', () => {
  const a = trailA();
  const sn = P.snare;
  // half in the grass at the trail's edge (not in its middle), ~11 m up it from the crossing
  const onA = Math.min(...a.slice(1).map((p, i) => segDist(sn, a[i], p)));
  assert.ok(onA > 0.15 && onA < 0.5, `at the trail's edge (${onA.toFixed(2)} m from its middle)`);
  for (const from of [P.handBack, CAMERA]) {
    const d = dist(from, sn);
    assert.ok(d > 10 && d < 20, `${d.toFixed(1)} m from where the search starts`);
  }
  // in the bos, off the sand paths, and no nearer the other markers than the wildwissel
  // itself runs (it passes the ecoduct's ring at ~9 m on its way in)
  const trailNearest = (m: Spot): number => Math.min(...a.map((p) => dist(p, m)));
  assert.equal(biomeAt(sn.x, sn.z), 'bos');
  assert.ok(distanceToNetwork(sn.x, sn.z) > LANE_HALF + 3, 'off the sand paths');
  for (const [id, m] of Object.entries(OTHER_MARKERS)) assert.ok(dist(sn, m) >= Math.min(10, trailNearest(m)), `${dist(sn, m).toFixed(1)} m from the ${id} marker`);
  for (const r of ROAMERS) assert.ok(dist(sn, r) > r.r + 3, `off the ${r.id}'s loop`);
  // the camera on the pine looks straight up the trail at it (the morning photo)
  assert.ok(Math.abs(swivel(sn)) < (40 * Math.PI) / 180, `a swivel of ${deg(swivel(sn))}°`);
  // the photo's two things: just beyond it (as the camera, and a walker from the crossing,
  // see it), one each side, off the trail (he walks between them), never between the lens
  // and the snare
  const up = { x: CAMERA.x, z: CAMERA.z, heading: headingTo(CAMERA, sn) };
  const s0 = toLocal(up, sn);
  const bush = toLocal(up, SNARE_MARKS.bush), fox = toLocal(up, SNARE_MARKS.foxglove);
  assert.ok(bush.v > s0.v + 0.3 && fox.v > s0.v + 0.3, 'beyond the snare');
  assert.ok((bush.u - s0.u) * (fox.u - s0.u) < 0 && Math.min(Math.abs(bush.u - s0.u), Math.abs(fox.u - s0.u)) > 0.5, 'one each side');
  for (const [name, m, r] of [['bush', SNARE_MARKS.bush, SNARE_MARKS.bush.r], ['foxglove', SNARE_MARKS.foxglove, 0.15]] as const) {
    const off = Math.min(...a.slice(1).map((p, i) => segDist(m, a[i], p)));
    assert.ok(off > r + 0.3, `the ${name} stands off the trail (${off.toFixed(2)} m)`);
    assert.ok(dist(m, sn) < 1.6, `the ${name} is right by the snare`);
  }
  // he takes it away from a step before it on the trail, facing it; the search ends as soon
  // as he is near enough to see it in the grass
  const reach = dist(sn, P.snareApproach);
  assert.ok(reach > 0.7 && reach < 1.4, `he stands a step from it (${reach.toFixed(2)} m)`);
  assert.ok(Math.abs(wrap(headingTo(P.snareApproach, sn) - P.snareApproach.heading!)) < 0.01, 'facing it');
  assert.ok(Math.min(...a.slice(1).map((p, i) => segDist(P.snareApproach, a[i], p))) < 0.6, 'on the trail');
  assert.ok(SNARE_FOUND > reach + 0.5 && SNARE_FOUND < 3, 'found when he is near');
  assert.ok(segDist(SNARE_MARKS.bush, P.snareApproach, sn) > SNARE_MARKS.bush.r, 'the bush is not in his way');
});

test('handed back: a step out on the open crossing, facing the glade, the follow camera free behind him', () => {
  const h = P.handBack;
  assert.ok(dist(h, TREE) > 2, `clear of the pine (${dist(h, TREE).toFixed(2)} m)`);
  for (const b of THICKET_BUSHES) assert.ok(dist(h, b.at) > b.r + 2, `clear of the thicket's ${b.id}`);
  assert.ok(Math.abs(wrap(headingTo(h, P.glade) - h.heading!)) < 0.01, 'facing the glade');
  // the follow camera takes over from the reunion's view: it keeps that view's bearing
  // (south over the crossing) at ~4.6 m. Nothing solid between it and him, no bush over
  // it, no forest tree (the crossing's own clear ground)
  const vh = REUNION_VIEW.heading;
  const back = { x: h.x - Math.sin(vh) * 4.6, z: h.z - Math.cos(vh) * 4.6 };
  assert.ok(segDist(TREE, back, h) > PINE.trunkR + 1, 'the pine is not between');
  for (const b of THICKET_BUSHES) assert.ok(dist(back, b.at) > b.r + 0.8 && segDist(b.at, back, h) > b.r + 0.2, `the ${b.id} is not over the lens or between`);
  assert.ok(segDist(LOG, back, h) > 0.4, 'the log is not between');
  assert.ok(wildcameraTreeClearings().some((c) => dist(c, back) < c.r - 0.5), 'no forest tree where the lens stands');
  // his first step into the view (the Up key walks into the screen) passes the pine with
  // room to spare: never into its trunk, the camera on it in his face
  const ahead = { x: h.x + Math.sin(vh) * 4, z: h.z + Math.cos(vh) * 4 };
  assert.ok(segDist(TREE, h, ahead) > PINE.trunkR + 0.8, `the pine beside his way (${segDist(TREE, h, ahead).toFixed(2)} m)`);
  assert.ok(segDist(LOG, h, ahead) > 0.8 && segDist(P.sett, h, ahead) > SETT_MOUND.r + 0.5, 'the log and the sett beside it too');
  // no solid thing right at his side (the lens swings round him when he turns)
  assert.ok(dist(h, LOG) > 3 && dist(h, NIGHTJAR_STUMP) > 2 && dist(h, JUNIPER) > 3, 'the log, the stump and the juniper a few steps off');
  // and it is where the reunion's view has him
  assert.ok(REUNION_VIEW.include.some((q) => dist(q, h) < 1e-9), 'the reunion frames him there');
});

test('one view: the glade left, the thicket right, the camera pine between, the ranger beside it', () => {
  const v = { x: CROSS_VIEW.at.x, z: CROSS_VIEW.at.z, heading: CROSS_VIEW.heading };
  const g = toLocal(v, P.glade), t = toLocal(v, P.thicket), p = toLocal(v, TREE), w = toLocal(v, P.watch);
  assert.ok(g.u < -3 && t.u > 3, 'the glade on the left, the thicket on the right');
  assert.ok(Math.abs(p.u) < 0.6, 'the pine in the middle');
  for (const q of [g, t]) assert.ok(Math.abs(q.u) <= CROSS_VIEW.halfW, 'both places inside the view');
  assert.ok(Math.abs(w.u) < 2 && CROSS_VIEW.include.some((q) => dist(q, P.watch) < 1e-9), 'the ranger stands in the picture');
  // the camera turns on its strap to look at either, never round the back of the trunk
  for (const q of [P.glade, P.thicket]) assert.ok(Math.abs(swivel(q)) < (80 * Math.PI) / 180, `a swivel of ${deg(swivel(q))}°`);
  assert.ok(swivel(P.glade) < 0 && swivel(P.thicket) > 0, 'left for the glade, right for the thicket');
  assert.ok(dist(CAMERA, TREE) > PINE.trunkR && dist(CAMERA, TREE) < PINE.trunkR + 0.15, 'the camera sits on the trunk');
  const reach = dist(P.strap, CAMERA);
  assert.ok(reach > 0.5 && reach < 1, `he straps it on within reach (${reach.toFixed(2)} m), beside it, not in front of the lens`);
  // the other views are the ranger's side of what they show
  for (const [name, view] of [['trail', TRAIL_VIEW], ['strap', STRAP_VIEW], ...SNARE_IDS.map((id) => [`snare ${id}`, SNARE_SPOTS[id].view] as const)] as const) {
    for (const q of view.include) assert.ok(toLocal({ x: view.at.x, z: view.at.z, heading: view.heading }, q).v < 1, `${name}: he stands in front of what it shows`);
  }
  // the sett's way in (a badger's face at its opening) faces away from every view of it
  // (the snare's view looks across the wildwissel far up it: the crossing is out of it)
  for (const [name, view] of [['crossing', CROSS_VIEW], ['trail', TRAIL_VIEW], ['strap', STRAP_VIEW]] as const) {
    assert.ok(Math.cos(SETT_FACE - view.heading) > 0.3, `${name}: the sett's opening faces away (${deg(wrap(SETT_FACE - view.heading))}°)`);
  }
  // the reunion is the crossing's own view, with him back from the snare on the crossing
  assert.deepEqual({ ...REUNION_VIEW, include: [], insetTop: 0, insetBottom: 0 }, { ...CROSS_VIEW, include: [], insetTop: 0, insetBottom: 0 });
});

test('the animals the camera photographs walk in from out of view, and the thicket\'s never stand behind the sett', () => {
  const v = { x: CROSS_VIEW.at.x, z: CROSS_VIEW.at.z, heading: CROSS_VIEW.heading };
  for (const animal of ['edelhert', 'hinde', 'ree', 'das', 'wildzwijn', 'vos', 'nachtzwaluw', 'gaai']) {
    for (const bin of ['open', 'hol'] as const) {
      const s = aimSpot(animal, bin);
      const place = bin === 'open' ? P.glade : P.thicket;
      // (the nightjar by day perches on the stump at the thicket's front, before the sett;
      // the jay on its bramble at the thicket's far side)
      const reach = bin === 'open' ? P.glade.r : P.thicket.r + (animal === 'nachtzwaluw' || animal === 'gaai' ? 1.0 : 0.6);
      if (!(animal === 'das' && bin === 'hol')) assert.ok(dist(s.at, place) < reach, `${animal} in the ${bin} place`);
      if (animal !== 'das') assert.ok(Math.abs(toLocal(v, s.from).u) > CROSS_VIEW.halfW - 0.2 || toLocal(v, s.from).v > 2.5, `${animal} comes in from out of view`);
      if (bin === 'hol' && animal !== 'das' && animal !== 'nachtzwaluw' && animal !== 'gaai') {
        // as the camera sees it: well clear of the sett's mound (the nightjar sits on top of it)
        const off = Math.abs(wrap(cameraAim(s.at) - cameraAim(P.sett)));
        assert.ok(off > (12 * Math.PI) / 180, `${animal} is ${deg(off)}° off the sett`);
      }
    }
  }
  // every walk into the thicket keeps clear of its solid juniper (a walk round it could
  // stall behind it), and of the sett's mound (the badger's own comes out of it)
  for (const animal of ['edelhert', 'hinde', 'ree', 'wildzwijn', 'vos']) {
    const s = aimSpot(animal, 'hol');
    assert.ok(segDist(JUNIPER, s.from, s.at) > JUNIPER.r + 0.45, `${animal} walks in clear of the juniper (${segDist(JUNIPER, s.from, s.at).toFixed(2)} m)`);
    assert.ok(segDist(P.sett, s.from, s.at) > 0.9, `${animal} walks in clear of the sett`);
  }
  for (const id of SLOT_IDS) {
    const c = CALLER_SLOTS[id];
    if (c.animals.includes('nachtzwaluw') || c.animals.includes('das')) continue;
    assert.ok(segDist(JUNIPER, c.from, c.at) > JUNIPER.r + 0.4, `a walker comes in to ${id} at night clear of the juniper (${segDist(JUNIPER, c.from, c.at).toFixed(2)} m)`);
    assert.ok(segDist(P.sett, c.from, c.at) > SETT_MOUND.r + 0.3 && segDist(NIGHTJAR_STUMP, c.from, c.at) > NIGHTJAR_STUMP.r + 0.3, `…and of the sett and the stump`);
  }
  // the badger by day: out of its sett onto the open ground at its side — clear of the
  // mound for the camera on the pine, and in front of it for the lens
  const das = aimSpot('das', 'hol');
  assert.ok(dist(das.at, P.sett) < 1.5 && dist(das.from, P.sett) < 0.6, 'at its sett, out of it');
  const dasOff = Math.abs(wrap(cameraAim(das.at) - cameraAim(P.sett)));
  assert.ok(dasOff > (16 * Math.PI) / 180, `the badger is ${deg(dasOff)}° off its sett for the camera`);
  assert.ok(toLocal(v, das.at).v < toLocal(v, P.sett).v, 'nearer the lens than its sett');
  // every animal the camera photographs stands where its fan of view lies
  for (const animal of ['edelhert', 'hinde', 'ree', 'das', 'wildzwijn', 'vos', 'nachtzwaluw', 'gaai']) {
    for (const bin of ['open', 'hol'] as const) {
      const off = Math.abs(wrap(cameraAim(aimSpot(animal, bin).at) - cameraAim(AIM_AT[bin])));
      assert.ok(off < FAN_HALF, `${animal} (${bin}) is ${deg(off)}° off where the camera looks`);
    }
  }
});

test('the nightjar lands where the child sees it land: on a perch in the view, apart from the names, never behind a bush', () => {
  const v = { x: CROSS_VIEW.at.x, z: CROSS_VIEW.at.z, heading: CROSS_VIEW.heading };
  for (const bin of ['open', 'hol'] as const) {
    const n = NIGHTJAR_AT[bin];
    const s = aimSpot('nachtzwaluw', bin);
    assert.ok(dist(s.at, n) < 1e-9 && s.lift === n.lift, `${bin}: the camera photographs it where it lands`);
    const l = toLocal(v, n);
    // inside the one view (well inside its width; not at its far edge)
    assert.ok(Math.abs(l.u) < CROSS_VIEW.halfW - 0.8 && l.v > -CROSS_VIEW.halfD - 2 && l.v < CROSS_VIEW.halfD, `${bin}: in the view (u ${l.u.toFixed(1)}, v ${l.v.toFixed(1)})`);
    // well apart from the places' names: across the screen, or far below
    const t = TAG_AT[bin], tl = toLocal(v, t);
    const apart = Math.hypot(n.x - t.x, n.z - t.z, t.y - n.lift);
    assert.ok(Math.abs(l.u - tl.u) > 0.9 && apart > 1.8, `${bin}: ${Math.abs(l.u - tl.u).toFixed(2)} m across and ${apart.toFixed(2)} m from the name`);
    // nothing between the lens and it that stands taller than its perch holds it: no
    // bush of the thicket, no sett mound (it sits ON the mound, or in front of it)
    const blockers = [...THICKET_BUSHES.map((b) => ({ at: b.at, h: b.h, r: b.r })), { at: P.sett, h: SETT_MOUND.h, r: SETT_MOUND.r + 0.3 }];
    for (const b of blockers) {
      const bl = toLocal(v, b.at);
      const onIt = dist(b.at, n) < b.r && n.lift >= b.h - 0.05;
      const inFront = bl.v < l.v - 0.1 && Math.abs(bl.u - l.u) < b.r + 0.35 && b.h > n.lift + 0.1;
      assert.ok(onIt || !inFront, `${bin}: not behind the bush at (${bl.u.toFixed(1)}, ${bl.v.toFixed(1)})`);
    }
    // in the place the camera aims at, inside its fan
    const off = Math.abs(wrap(cameraAim(n) - cameraAim(AIM_AT[bin])));
    assert.ok(off < FAN_HALF - 0.05, `${bin}: ${deg(off)}° off where the camera looks`);
    // it comes in from out of view (the sky beyond the glade, or over the thicket)
    assert.ok(Math.abs(toLocal(v, s.from).u) > CROSS_VIEW.halfW, `${bin}: it flies in from out of view`);
  }
  // by day: on its own old stump at the thicket's front, before the sett (nothing between
  // it and the lens), in the thicket; the camera on the pine sees it clear of the sett
  const hol = NIGHTJAR_AT.hol;
  assert.ok(dist(hol, NIGHTJAR_STUMP) < 1e-9 && hol.lift === NIGHTJAR_STUMP.h, 'on its stump');
  assert.ok(dist(hol, P.thicket) < P.thicket.r + 1.0 && toLocal(v, hol).v < toLocal(v, P.sett).v - 1 && dist(hol, P.sett) < 2, 'at the thicket\'s front, before the sett');
  const settOff = Math.abs(wrap(cameraAim(hol) - cameraAim(P.sett)));
  assert.ok(settOff > (12 * Math.PI) / 180, `the sett is ${deg(settOff)}° off it for the camera`);
  // the stump stands in nobody's way: clear of every animal's walk in and out of the
  // thicket, of the badger's, and of the night callers' spots
  const ways: [Spot, Spot][] = [];
  for (const animal of ['edelhert', 'hinde', 'ree', 'wildzwijn', 'vos', 'das']) { const a = aimSpot(animal, 'hol'); ways.push([a.from, a.at]); }
  for (const id of ['sett-l', 'sett-r', 'bushes', 'juniper'] as const) ways.push([CALLER_SLOTS[id].from, CALLER_SLOTS[id].at]);
  for (const [a, b2] of ways) assert.ok(segDist(NIGHTJAR_STUMP, a, b2) > NIGHTJAR_STUMP.r + 0.9, `clear of a walk (${segDist(NIGHTJAR_STUMP, a, b2).toFixed(2)} m)`);
  // and the camera on the pine photographs the thicket's animals past it, never over it
  for (const animal of ['edelhert', 'hinde', 'ree', 'wildzwijn', 'vos', 'das']) {
    const a = aimSpot(animal, 'hol').at;
    const off = Math.abs(wrap(cameraAim(a) - cameraAim(NIGHTJAR_STUMP)));
    assert.ok(dist(CAMERA, NIGHTJAR_STUMP) > dist(CAMERA, a) || off > (14 * Math.PI) / 180, `the stump is not in front of the ${animal}`);
  }
  // at night: on the sandy game trail at the glade's edge (a dark bird on pale sand)
  const open = NIGHTJAR_AT.open;
  const b = trailB();
  const onTrail = Math.min(...b.slice(1).map((p, i) => segDist(open, b[i], p)));
  assert.ok(onTrail < 0.15 && open.lift === 0, `on the sandy trail (${onTrail.toFixed(2)} m)`);
  assert.ok(dist(open, P.glade) < P.glade.r, 'in the glade');
  // clear of the snare's spot and of the animals of the glade
  for (const animal of ['edelhert', 'hinde', 'ree', 'wildzwijn', 'das', 'vos', 'gaai']) assert.ok(dist(open, aimSpot(animal, 'open').at) > 0.9, `apart from the ${animal}`);
});

test('the night choir\'s spots: round the crossing, each for its own animals, every one in the view', () => {
  const v = { x: CROSS_VIEW.at.x, z: CROSS_VIEW.at.z, heading: CROSS_VIEW.heading };
  const m = AREA_VELUWE.missies.find((x) => x.id === 'wildcamera')!;
  const pool = m.stappen.find((s) => s.ef === 'simon')!.skin.roepPool ?? [];
  for (const id of pool) assert.ok(SLOT_IDS.some((s) => CALLER_SLOTS[s].animals.includes(id)), `${id} has a spot to call from`);
  for (const id of SLOT_IDS) {
    const s = CALLER_SLOTS[id];
    const l = toLocal(v, s.at);
    assert.ok(Math.abs(l.u) < CROSS_VIEW.halfW + 1 && l.v > -CROSS_VIEW.halfD - 3.2 && l.v < CROSS_VIEW.halfD + 1, `${id} is in the view (${l.u.toFixed(1)}, ${l.v.toFixed(1)})`);
    assert.ok(dist(s.at, P.watch) > 1.6, `${id} keeps from the ranger`);
    assert.ok(dist(s.at, TREE) > 1.2, `${id} keeps from the pine`);
  }
  // the badger beside its sett (never in front of it: grey on grey), the nightjar on the
  // log or the old stump, the walkers at the glade's back edge or in front of it, by the
  // bushes or in front of the juniper
  for (const id of ['sett-l', 'sett-r'] as const) assert.ok(dist(CALLER_SLOTS[id].at, P.sett) < 1.5 && Math.abs(toLocal(v, CALLER_SLOTS[id].at).u - toLocal(v, P.sett).u) > 0.8, `${id} beside the sett`);
  assert.ok(dist(CALLER_SLOTS.log.at, LOG) < 0.01 && dist(CALLER_SLOTS.stump.at, NIGHTJAR_STUMP) < 0.01, 'the nightjar on the log or the stump');
  assert.ok(dist(CALLER_SLOTS['glade-edge'].at, P.glade) < 1.6, 'the glade\'s edge');
  // where the walkers come in from: the glade's side or the thicket's
  for (const id of ['glade-edge', 'glade-front'] as const) assert.ok(toLocal(v, CALLER_SLOTS[id].from).u < -CROSS_VIEW.halfW, `${id} from the left`);
  for (const id of ['bushes', 'juniper'] as const) assert.ok(toLocal(v, CALLER_SLOTS[id].from).u > CROSS_VIEW.halfW, `${id} from the right`);
});

test('the evening\'s visitors: two stops each side, an in-lane and an out-lane that never meet', () => {
  const v = { x: CROSS_VIEW.at.x, z: CROSS_VIEW.at.z, heading: CROSS_VIEW.heading };
  const VISITORS = ['edelhert', 'hinde', 'ree', 'wildzwijn', 'vos', 'das', 'nachtzwaluw', 'gaai'];
  const spots = (bin: 'open' | 'hol'): Spot[] => VISITORS.map((a) => aimSpot(a, bin).at);
  for (const [id, s] of Object.entries(STOPS)) {
    assert.equal(biomeAt(s.x, s.z), 'bos');
    assert.ok(dist(s, P.watch) >= 1.6, `${id}: ${dist(s, P.watch).toFixed(2)} m from the ranger`);
    assert.ok(dist(s, TREE) > 1.6, `${id}: clear of the pine`);
    // not in a place (a visitor there would already say where it goes)
    assert.ok(dist(s, P.glade) > P.glade.r && dist(s, P.thicket) > P.thicket.r, `${id}: outside both places`);
    // not on the log, the sett, the stumps, nor where an animal is photographed
    assert.ok(dist(s, LOG) > 0.95 && dist(s, P.sett) > SETT_MOUND.r + 0.7 && dist(s, NIGHTJAR_STUMP) > 1.3, `${id}: clear of the log, the sett and the stump`);
    for (const p of [...spots('open'), ...spots('hol')]) assert.ok(dist(s, p) > 1.0, `${id}: ${dist(s, p).toFixed(2)} m from a photo spot`);
    assert.ok((toLocal(v, s).u < 0) === (s.side === 'left'), `${id} on its side`);
  }
  for (const side of ['left', 'right'] as const) {
    assert.ok(Math.abs(toLocal(v, ENTRY[side]).u) > CROSS_VIEW.halfW && Math.abs(toLocal(v, EXIT[side]).u) > CROSS_VIEW.halfW, `${side}: in and out beyond the view`);
  }
  // each side's way in and the walk off from its place never meet (≥ 1 m apart), so a
  // newcomer and an animal walking off on one side pass each other calmly
  for (const id of Object.keys(STOPS) as (keyof typeof STOPS)[]) {
    const path = arrivalPath(id);
    const side = STOPS[id].side;
    const bin = side === 'left' ? 'open' : 'hol';
    for (const animal of VISITORS.filter((a) => a !== 'nachtzwaluw' && a !== 'gaai')) {
      const from = aimSpot(animal, bin).at;
      const out = exitPath(bin, from, animal);
      for (let i = 1; i < path.length; i++) {
        // the closest the out-lane's line comes to the in-lane's (sampled)
        let near = Infinity;
        for (let t = 0; t <= 1.0001; t += 0.05) {
          const q = { x: out[0].x + (out[1].x - out[0].x) * t, z: out[0].z + (out[1].z - out[0].z) * t };
          if (dist(q, from) < 1.2) continue; // (where it stands at first, as the newcomer comes)
          near = Math.min(near, segDist(q, path[i - 1], path[i]));
        }
        // (the badger is back in its sett within ~1.5 s of its photo, long before a newcomer
        // from its side is half way in: it only must not brush the lane)
        assert.ok(near >= (animal === 'das' ? 0.6 : 1.0), `${id}: the in-lane and the ${animal}'s walk off come ${near.toFixed(2)} m apart`);
      }
    }
    // and the in-lane keeps clear of the solid things
    for (let i = 1; i < path.length; i++) {
      assert.ok(segDist(JUNIPER, path[i - 1], path[i]) > JUNIPER.r + 0.3, `${id}: clear of the juniper`);
      assert.ok(segDist(P.sett, path[i - 1], path[i]) > SETT_MOUND.r + 0.25, `${id}: clear of the sett (${segDist(P.sett, path[i - 1], path[i]).toFixed(2)} m)`);
      assert.ok(segDist(NIGHTJAR_STUMP, path[i - 1], path[i]) > NIGHTJAR_STUMP.r + 0.3, `${id}: clear of the stump`);
      assert.ok(segDist(LOG, path[i - 1], path[i]) > 0.7, `${id}: clear of the log`);
      assert.ok(segDist(TREE, path[i - 1], path[i]) > PINE.trunkR + 0.6 && segDist(P.watch, path[i - 1], path[i]) > 0.9, `${id}: clear of the pine and the ranger`);
    }
  }
  void SIDE_OF;
});

test('the jay: on the glade\'s sunny patch by day, at the thicket\'s foot with the rule turned', () => {
  assert.ok(dist(JAY_AT.open, P.glade) < 1.0 && JAY_AT.open.lift === 0, 'in the glade');
  assert.ok(dist(JAY_AT.hol, P.thicket) < P.thicket.r && JAY_AT.hol.lift === 0, 'on the ground at the thicket');
  // in front of the bushes (between them and the camera on the pine), never behind one
  for (const b of THICKET_BUSHES) assert.ok(segDist(b.at, CAMERA, JAY_AT.hol) > b.r * 0.6, `the ${b.id} is not between it and the camera`);
  assert.ok(segDist(P.sett, CAMERA, JAY_AT.hol) > SETT_MOUND.r, 'nor the sett');
  assert.ok(dist(JAY_AT.hol, NIGHTJAR_STUMP) > 2, 'never the nightjar\'s stump');
  for (const bin of ['open', 'hol'] as const) assert.ok(Math.abs(wrap(cameraAim(JAY_AT[bin]) - cameraAim(AIM_AT[bin]))) < FAN_HALF - 0.05, `${bin}: in the camera's fan`);
});

test('the ground: the glade, the thicket and the trail keep clear of trees; the pine is planted', () => {
  const tc = wildcameraTreeClearings();
  const covered = (p: { x: number; z: number }, margin = 0): boolean => tc.some((c) => dist(c, p) < c.r - margin);
  for (const p of [P.glade, P.thicket, P.crossApproach, P.snare, ...trailA()]) assert.ok(covered(p), 'no tree grows there');
  assert.ok(covered(P.glade, 3) && covered(TREE, 2.5), 'a real glade, a clear crossing');
  assert.deepEqual(wildcameraTrees().map((t) => [t.x, t.z, t.species]), [[TREE.x, TREE.z, 'prop-pine-scots']]);
  assert.ok(wildcameraClearings().some((c) => dist(c, P.glade) < 0.01 && c.r > 2), 'the glade keeps its own grass');
  void CROSS;
});

test('before and after, the roe grazes in the glade (shy of him before); nobody else stands about in daylight', () => {
  const v = { x: CROSS_VIEW.at.x, z: CROSS_VIEW.at.z, heading: CROSS_VIEW.heading };
  const roe = WILDCAMERA_RESIDENTS.find((r) => r.key === 'ree')!;
  for (const pose of [roe.before, roe.after]) assert.ok(pose && dist(pose, P.glade) < P.glade.r && pose.idle === 'graze', 'the roe grazes in the glade');
  for (const r of WILDCAMERA_RESIDENTS) if (r.key !== 'ree') assert.ok(r.before === null && r.after === null, `${r.key} is out in the wood`);
  // before, she is shy: she lifts her head and goes in under the trees as he comes along
  // the game trail (well before he reaches the crossing), away from him, to where the
  // glade's animals come from — out of the camera's view over the crossing
  const shy = roe.shy?.find((q) => q.state === 'before');
  assert.ok(shy && shy.within === ROE_SHY_WITHIN, 'shy before the mission');
  assert.ok(dist(P.crossApproach, roe.before!) < ROE_SHY_WITHIN - 3, 'she goes before he reaches the crossing');
  assert.ok(dist(ROE_HIDEAWAY, P.crossApproach) > dist(roe.before!, P.crossApproach) + 4, 'away from him');
  // (she comes back for the photos from under the same trees, a little nearer the glade)
  const back = aimSpot('ree', 'open').from;
  assert.ok(dist(ROE_HIDEAWAY, back) < 3 && dist(back, P.glade) < dist(ROE_HIDEAWAY, P.glade), 'she comes back from there for the photos');
  assert.ok(Math.abs(toLocal(v, ROE_HIDEAWAY).u) > CROSS_VIEW.halfW + 3, 'out of the view over the crossing');
  assert.ok(wildcameraTreeClearings().every((c) => dist(c, ROE_HIDEAWAY) > c.r - 0.5), 'in under the trees');
  // the reekalf's hide lies west of her glade: while he keeps still there and watches that
  // doe through his glasses, this roe grazes on (she never lifts her head at him and walks
  // off toward him through the lenses), wherever she roams round her spot
  const reach = (roe.before!.roam ?? 0.5) + ROE_SHY_WITHIN + 0.3;
  for (const k of ['hide', 'hideLeave', 'poolEdge'] as const) {
    assert.ok(dist(REE_PLACES[k], roe.before!) > reach, `the reekalf's ${k} is ${dist(REE_PLACES[k], roe.before!).toFixed(2)} m from her (> ${reach.toFixed(2)})`);
  }
});

/* --------------------------------------------- run 7 (wc-hands): the hands ---- */

/** The trail a snare spot lies by: S1 the wildwissel, S2 and S3 deer trail C. */
const trailOf = (id: SnareId): Spot[] => (id === 'S1' ? trailA() : trailC());
const nearLine = (p: Spot, line: Spot[]): number => Math.min(...line.slice(1).map((q, i) => segDist(p, line[i], q)));
/** The morning photo's frame from the camera on the pine (home.photoCamera with frameH 2.1,
 *  minFov 11, a 320 × 200 picture): half its width in degrees. */
const photoHalfW = (d: number): number => {
  const v = Math.max(11, (2 * Math.atan(1.05 / d) * 180) / Math.PI);
  return (Math.atan(Math.tan((v * Math.PI) / 360) * 1.6) * 180) / Math.PI;
};
const bearing = (p: Spot): number => (headingTo(CAMERA, p) * 180) / Math.PI;

/** The morning photo of a spot as the camera on the pine takes it (home.photoCamera: the
 *  lens on the trunk turned to it, 0.72 m up, framing 2.1 m of height round 0.62 m over the
 *  spot, ≥ 11°, 320 × 200): where a world point lands in it (x, y: -1..1, y up), and whether
 *  it shows (in front, inside, above the camera's own dark strip along the bottom, 13 %). */
function inPhoto(spot: Spot, p: Spot, up: number): { x: number; y: number; shows: boolean } {
  const aim = headingTo(CAMERA, spot);
  const camDepth = 0.3 * (1.29 / 1.6); // (wildcamera.home CAM_DEPTH at the camera's shown size)
  const lens = { x: TREE.x + Math.sin(aim) * (PINE.trunkR + camDepth + 0.05), z: TREE.z + Math.cos(aim) * (PINE.trunkR + camDepth + 0.05) };
  const ly = heightAt(CAMERA.x, CAMERA.z) + PINE.camY + 0.02;
  const look = { x: spot.x, y: heightAt(spot.x, spot.z) + 0.62, z: spot.z };
  const d = Math.max(1, Math.hypot(look.x - lens.x, look.z - lens.z));
  const vf = Math.min(58, Math.max(11, (2 * Math.atan(1.05 / d) * 180) / Math.PI)) * (Math.PI / 180);
  // the camera's basis (looking at `look`, the world's up)
  let fx = look.x - lens.x, fy = look.y - ly, fz = look.z - lens.z;
  const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  let rx = -fz, rz = fx; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl; // right = f × up
  const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy; // up = right × f
  const vx = p.x - lens.x, vy = heightAt(p.x, p.z) + up - ly, vz = p.z - lens.z;
  const zc = vx * fx + vy * fy + vz * fz;
  const x = (vx * rx + vz * rz) / (zc * Math.tan(vf / 2) * 1.6);
  const y = (vx * ux + vy * uy + vz * uz) / (zc * Math.tan(vf / 2));
  return { x, y, shows: zc > 0.1 && Math.abs(x) < 1 && y < 1 && y > -0.74 };
}

test('the snare\'s three spots: in the wood, dry, off the paths, clear of the other homes, apart', () => {
  const hides = REE_LAYOUTS.flatMap((l) => [l.hide, l.hideLeave, l.hideJuniper]);
  const others = [...reeClearings(), ...frislingClearings(), ...eekhoornClearings()];
  for (const id of SNARE_IDS) {
    const sp = SNARE_SPOTS[id];
    assert.equal(sp.id, id);
    for (const p of [sp.at, sp.approach, ...sp.marks.map((m) => m.at)]) {
      assert.equal(biomeAt(p.x, p.z), 'bos', `${id}: (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) is in the wood`);
      assert.ok(dist(p, VEN_CENTER) > VEN_SHORE_R + 2, `${id}: dry, off the ven`);
      assert.ok(distanceToNetwork(p.x, p.z) > LANE_HALF + (p === sp.at ? 3 : 1.5), `${id}: off the sand paths (${distanceToNetwork(p.x, p.z).toFixed(1)} m)`);
      // (the snare and where he stands to take it ≥ 9 m from the reekalf's hide, its way
      // out and its juniper; a landmark at least 7.5)
      const keep = p === sp.at || p === sp.approach ? 9 : 7.5;
      for (const h of hides) assert.ok(dist(p, h) >= keep, `${id}: ${dist(p, h).toFixed(1)} m from the reekalf's hide`);
      for (const c of others) assert.ok(dist(p, c) > c.r + 1, `${id}: off another home's ground (${dist(p, c).toFixed(1)} m from a clearing of r ${c.r.toFixed(1)})`);
      for (const r of ROAMERS) assert.ok(dist(p, r) > r.r + 3, `${id}: off the ${r.id}'s loop`);
    }
    // no nearer the other markers than the wildwissel itself runs (it passes the ecoduct's
    // ring at ~9 m on its way in), the crossing's 12 m from the ecoduct and nachtronde kept
    for (const [mid, m] of Object.entries(OTHER_MARKERS)) {
      const trailNearest = Math.min(...trailA().map((q) => dist(q, m)));
      assert.ok(dist(sp.at, m) >= Math.min(10, trailNearest), `${id}: ${dist(sp.at, m).toFixed(1)} m from the ${mid} marker`);
    }
    // half in the grass at its trail's edge (never in the trail's middle)
    const edge = nearLine(sp.at, trailOf(id));
    assert.ok(edge > 0.15 && edge < 0.5, `${id}: at the trail's edge (${edge.toFixed(2)} m from its middle)`);
    // a real little search from where it starts (beside the pine), never on top of him
    const far = dist(P.handBack, sp.at);
    assert.ok(far > 5 && far < 16, `${id}: ${far.toFixed(1)} m from where he starts looking`);
  }
  for (const a of SNARE_IDS) for (const b of SNARE_IDS) {
    if (a >= b) continue;
    assert.ok(dist(SNARE_SPOTS[a].at, SNARE_SPOTS[b].at) >= 4.5, `${a} and ${b} lie apart`);
    const d = Math.abs(bearing(SNARE_SPOTS[a].at) - bearing(SNARE_SPOTS[b].at));
    assert.ok(d >= 18, `${a} and ${b} lie ${d.toFixed(0)}° apart as the camera sees them`);
  }
  // S1 is run 6's spot by the juniper and the foxglove
  assert.ok(dist(SNARE_SPOTS.S1.at, P.snare) < 1e-9 && dist(SNARE_SPOTS.S1.marks[0].at, SNARE_MARKS.bush) < 1e-9 && dist(SNARE_SPOTS.S1.marks[1].at, SNARE_MARKS.foxglove) < 1e-9);
});

test('each spot\'s two landmarks: just beyond it as the camera sees it, one each side, off the trail; its morning photo shows them and no other spot\'s', () => {
  for (const id of SNARE_IDS) {
    const sp = SNARE_SPOTS[id];
    const up = { x: CAMERA.x, z: CAMERA.z, heading: headingTo(CAMERA, sp.at) };
    const s0 = toLocal(up, sp.at);
    const [a, b] = sp.marks.map((m) => toLocal(up, m.at));
    assert.ok(a.v > s0.v + 0.3 && b.v > s0.v + 0.3, `${id}: both beyond the snare`);
    assert.ok((a.u - s0.u) * (b.u - s0.u) < 0 && Math.min(Math.abs(a.u - s0.u), Math.abs(b.u - s0.u)) > 0.5, `${id}: one each side`);
    for (const m of sp.marks) {
      assert.ok(dist(m.at, sp.at) < 1.6, `${id}: the ${m.model} is right by it (${dist(m.at, sp.at).toFixed(2)} m)`);
      const off = Math.min(nearLine(m.at, trailA()), nearLine(m.at, trailB()), nearLine(m.at, trailC()));
      assert.ok(off > m.r + 0.3, `${id}: the ${m.model} stands off the trails (${off.toFixed(2)} m)`);
      assert.ok(segDist(m.at, sp.approach, sp.at) > m.r, `${id}: the ${m.model} is not in his way to it`);
    }
    // the photo: the camera on the pine turned to the spot, zoomed as home.photoCamera does:
    // its own two in it (their middles well inside), none of another spot's (anywhere on
    // them: their foot, middle and top, and their sides), the man at the middle
    const half = photoHalfW(dist(CAMERA, sp.at));
    assert.ok(half > 8 && half < 13, `${id}: the photo is ${(half * 2).toFixed(0)}° wide`);
    for (const m of sp.marks) {
      const q = inPhoto(sp.at, m.at, Math.min(1.0, m.h * 0.5));
      assert.ok(q.shows && Math.abs(q.x) < 0.8, `${id}: its ${m.model} is in its photo (${q.x.toFixed(2)}, ${q.y.toFixed(2)})`);
    }
    assert.ok(Math.abs(inPhoto(sp.at, sp.at, 0.62).x) < 0.01, `${id}: the photo is framed on it`);
    for (const o of SNARE_IDS) {
      if (o === id) continue;
      for (const m of SNARE_SPOTS[o].marks) for (const du of [-m.r, 0, m.r]) for (const hy of [0, 0.5, 1]) {
        const at = { x: m.at.x + du * Math.cos(headingTo(CAMERA, m.at)), z: m.at.z - du * Math.sin(headingTo(CAMERA, m.at)) };
        const q = inPhoto(sp.at, at, (m.h || 3) * hy);
        assert.ok(!q.shows, `${id}: ${o}'s ${m.model} stays out of its photo (${q.x.toFixed(2)}, ${q.y.toFixed(2)})`);
      }
    }
    // the camera turns on its strap to look there (never round the back of its trunk)
    assert.ok(Math.abs(swivel(sp.at)) < (40 * Math.PI) / 180, `${id}: a swivel of ${deg(swivel(sp.at))}°`);
  }
});

test('the camera sees each spot clear: no tree, bush or bracken on its line, nothing of the crossing in the way', () => {
  const tc = wildcameraTreeClearings(), sc = wildcameraClearings();
  const solids = [
    ...THICKET_BUSHES.map((b) => ({ at: b.at, r: b.r })), { at: P.sett, r: SETT_MOUND.r }, { at: LOG, r: 0.6 }, { at: NIGHTJAR_STUMP, r: NIGHTJAR_STUMP.r },
  ];
  for (const id of SNARE_IDS) {
    const sp = SNARE_SPOTS[id];
    const d = dist(CAMERA, sp.at);
    for (let t = 0.12; t < 0.92; t += 0.02) {
      const q = { x: CAMERA.x + (sp.at.x - CAMERA.x) * t, z: CAMERA.z + (sp.at.z - CAMERA.z) * t };
      // no forest tree within 0.6 m of the line (a trunk centre is kept r out of a clearing)
      assert.ok(tc.some((c) => dist(c, q) < c.r - 0.6), `${id}: a forest tree could stand on the photo's line ${(t * d).toFixed(1)} m out`);
      assert.ok(sc.some((c) => dist(c, q) < c.r), `${id}: bracken could grow on the photo's line ${(t * d).toFixed(1)} m out`);
    }
    // the crossing's things (low, near the lens) are out of its photo, or under its strip
    const parts = [
      ...THICKET_BUSHES.map((b) => ({ at: b.at, r: b.r, h: b.h })), { at: P.sett, r: SETT_MOUND.r, h: SETT_MOUND.h },
      { at: NIGHTJAR_STUMP, r: NIGHTJAR_STUMP.r, h: NIGHTJAR_STUMP.h },
      // the log: along its length (0.55 m each way along its turn), its top
      ...[-0.55, -0.27, 0, 0.27, 0.55].map((t) => ({ at: { x: LOG.x + Math.cos(LOG.turn) * t, z: LOG.z - Math.sin(LOG.turn) * t }, r: 0.16, h: LOG.h })),
    ];
    for (const b of parts) for (const hy of [0.5, 1]) {
      const q = inPhoto(sp.at, b.at, b.h * hy);
      assert.ok(!q.shows, `${id}: the crossing's thing at (${b.at.x.toFixed(1)}, ${b.at.z.toFixed(1)}) shows in its photo (${q.x.toFixed(2)}, ${q.y.toFixed(2)})`);
    }
    void solids;
    for (const o of SNARE_IDS) if (o !== id) for (const m of SNARE_SPOTS[o].marks) assert.ok(segDist(m.at, CAMERA, sp.at) > m.r + 0.3, `${id}: ${o}'s ${m.model} is not on its line`);
    // its own ground, and the forest keeps clear round it and its landmarks
    assert.ok(sc.some((c) => dist(c, sp.at) < 0.01 && c.r >= 1.5), `${id}: its own grass`);
    assert.ok(tc.some((c) => dist(c, sp.at) < 0.01 && c.r >= 2.3), `${id}: no forest tree on it`);
  }
  // deer trail C keeps clear of trees too, and runs from the glade to the wildwissel
  const c = trailC();
  for (const q of c) assert.ok(tc.some((t) => dist(t, q) < t.r - 0.5), 'no tree on trail C');
  assert.ok(dist(c[0], P.glade) < P.glade.r + 0.3, 'trail C leaves the glade');
  assert.ok(nearLine(c[c.length - 1], trailA()) < 0.05, 'trail C joins the wildwissel');
  for (let i = 1; i < c.length; i++) assert.ok(dist(c[i - 1], c[i]) < 4, 'trail C: one trodden line');
});

test('the snare lies half hidden in its grass: the tufts low on his side, never on the wire; he takes it from a step before it', () => {
  for (const id of SNARE_IDS) {
    const sp = SNARE_SPOTS[id];
    const tufts = snareTufts(sp);
    assert.ok(tufts.length >= 12, `${id}: a tuft of grass round it`);
    const toMe = headingTo(sp.at, sp.approach);
    let behind = 0;
    for (const t of tufts) {
      const r = dist(t, sp.at);
      assert.ok(r >= 0.2 && r <= 0.5, `${id}: a tuft at ${r.toFixed(2)} m, never on the loop`);
      const front = Math.cos(headingTo(sp.at, t) - toMe);
      if (front > 0.7) assert.ok(t.h <= 0.3, `${id}: the tufts on his side are low (${t.h.toFixed(2)} m)`);
      if (front < 0) behind++;
    }
    assert.ok(behind >= 5, `${id}: the grass stands round it behind (${behind})`);
    // he takes it away from a step before it, coming from the crossing, facing it
    const reach = dist(sp.at, sp.approach);
    assert.ok(reach > 0.7 && reach < 1.4, `${id}: he stands a step from it (${reach.toFixed(2)} m)`);
    assert.ok(Math.abs(wrap(headingTo(sp.approach, sp.at) - sp.approach.heading!)) < 0.01, `${id}: facing it`);
    assert.ok(dist(sp.approach, CAMERA) < dist(sp.at, CAMERA), `${id}: on the camera's side of it (the side the grass is low)`);
    assert.ok(SNARE_FOUND > reach + 0.5 && SNARE_FOUND < 3, `${id}: found when he is near`);
    // the close view: him in front of what it shows, the snare off its middle (≥ 0.1 of
    // its width), the snare and him in it
    const v = sp.view;
    const vf = { x: v.at.x, z: v.at.z, heading: v.heading };
    assert.ok(v.include.some((q) => dist(q, sp.approach) < 1e-9), `${id}: the view frames him at his spot`);
    assert.ok(toLocal(vf, sp.approach).v < 1, `${id}: he stands in front of what it shows`);
    assert.ok(Math.abs(toLocal(vf, sp.at).u) >= 0.1 * 2 * v.halfW || offCentre(v, sp.at) >= 0.2, `${id}: the snare is off the view's middle`);
    assert.ok(offCentre(v, sp.at) <= 1, `${id}: the snare is in the view`);
  }
});

test('the test: a spot in the camera\'s fan, out on the crossing, clear of the log, the stump and the sett', () => {
  assert.ok(inFan(TEST_SPOT), 'the test spot is in the fan');
  // anywhere he arrives there, he is in it
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
    const q = { x: TEST_SPOT.x + Math.sin(a) * TEST_SPOT.r!, z: TEST_SPOT.z + Math.cos(a) * TEST_SPOT.r! };
    assert.ok(inFan(q), `the edge of the test spot (${deg(a)}°) is in the fan`);
  }
  assert.ok(!inFan(P.strap) && !inFan(P.watch) && !inFan(P.handBack), 'beside the trunk, where he watches and handed back: not in it');
  assert.ok(!inFan({ x: CAMERA.x, z: CAMERA.z + 1.0 }), 'too near: no photo of his jacket only');
  assert.ok(!inFan({ x: CAMERA.x + 3, z: CAMERA.z + 1.5 }), 'off to the side: not in it');
  for (const [name, q, r] of [['log', LOG, 0.8], ['stump', NIGHTJAR_STUMP, NIGHTJAR_STUMP.r + 0.6], ['sett', P.sett, SETT_MOUND.r + 0.8], ['juniper', JUNIPER, JUNIPER.r + 0.8]] as const) {
    assert.ok(dist(TEST_SPOT, q) > TEST_SPOT.r! + r, `the ${name} is not on the test spot`);
  }
  assert.ok(distanceToNetwork(TEST_SPOT.x, TEST_SPOT.z) > LANE_HALF + 3, 'off the sand paths');
});

test('the walk back from every snare spot to the camera: a clear straight way (the arrow keys find it)', () => {
  const solids = [
    ...THICKET_BUSHES.filter((b) => b.id === 'prop-juniper-bush').map((b) => ({ at: b.at, r: b.r })),
    { at: P.sett, r: SETT_MOUND.r }, { at: LOG, r: 0.7 }, { at: NIGHTJAR_STUMP, r: NIGHTJAR_STUMP.r }, { at: TREE, r: 0.6 },
    ...SNARE_IDS.flatMap((o) => SNARE_SPOTS[o].marks.filter((m) => m.solid).map((m) => ({ at: m.at, r: m.r }))),
  ];
  for (const id of SNARE_IDS) {
    const from = SNARE_SPOTS[id].approach;
    for (const b of solids) {
      if (dist(b.at, from) < 1.6) continue; // (its own landmarks beside him: he turns from them)
      assert.ok(segDist(b.at, from, P.handBack) > b.r + 0.45, `${id}: the way back passes ${dist(b.at, from).toFixed(1)} m from (${b.at.x.toFixed(1)}, ${b.at.z.toFixed(1)}) with room (${segDist(b.at, from, P.handBack).toFixed(2)} m)`);
    }
  }
});
