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
  WILDCAMERA_PLACES as P, MARKER, TREE, CAMERA, CROSS, CROSS_VIEW, CALLER_SPOTS, LOG, PINE,
  WILDCAMERA_HOME, WILDCAMERA_RESIDENTS, AIM_AT, FAN_HALF, JUNIPER, aimSpot, cameraAim, swivel, trailA, trailB,
  NIGHTJAR_AT, NIGHTJAR_STUMP, TAG_AT, THICKET_BUSHES, SETT_MOUND, ROE_HIDEAWAY, ROE_SHY_WITHIN,
  wildcameraTreeClearings, wildcameraClearings, wildcameraTrees, TRAIL_VIEW, SNARE_VIEW, REUNION_VIEW, STRAP_VIEW, VAL_VIEW, SETT_FACE,
} from './wildcamera.places.ts';
import { anchorInBiome, biomeAt } from '../../Biomes.ts';
import { distanceToNetwork, LANE_HALF } from '../../Paths.ts';
import { dist, headingTo, toLocal, segDist } from '../places.ts';
import { AREA_VELUWE } from '../../../content/veluwe.ts';
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
  const crossing = [P.crossApproach, P.strap, P.watch, P.glade, P.thicket, P.sett, P.snare, P.snareApproach, TREE];
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
  // the snare lies on the trail into the glade (where the deer come out to graze), a
  // step from where he takes it away
  const onB = Math.min(...b.slice(1).map((p, i) => segDist(P.snare, b[i], p)));
  assert.ok(onB < 0.35, `the snare lies on the trail (${onB.toFixed(2)} m)`);
  assert.ok(dist(P.snare, P.glade) < P.glade.r + 0.6 && dist(P.snare, P.glade) > 1.2, 'at the glade\'s edge');
  // the camera on the pine sees it side-on, with the glade behind: a turn it can make
  assert.ok(Math.abs(swivel(P.snare)) < (80 * Math.PI) / 180, `a swivel of ${deg(swivel(P.snare))}°`);
  // from where he sets off to it, nothing stands between him and the snare: not the pine
  assert.ok(segDist(TREE, P.valStart, P.snare) > PINE.trunkR + 0.5, 'the pine is not in the way');
  assert.ok(segDist(TREE, P.watch, P.valStart) > PINE.trunkR + 0.4, 'he steps round in front of it');
  const reach = dist(P.snare, P.snareApproach);
  assert.ok(reach > 0.7 && reach < 1.4, `he stands a step from it (${reach.toFixed(2)} m)`);
  assert.ok(Math.abs(wrap(headingTo(P.snareApproach, P.snare) - P.snareApproach.heading!)) < 0.01, 'facing it');
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
  for (const [name, view] of [['trail', TRAIL_VIEW], ['strap', STRAP_VIEW], ['snare', SNARE_VIEW], ['to the snare', VAL_VIEW]] as const) {
    for (const q of view.include) assert.ok(toLocal({ x: view.at.x, z: view.at.z, heading: view.heading }, q).v < 1, `${name}: he stands in front of what it shows`);
  }
  // the sett's way in (a badger's face at its opening) faces away from every view of it
  for (const [name, view] of [['crossing', CROSS_VIEW], ['trail', TRAIL_VIEW], ['strap', STRAP_VIEW], ['snare', SNARE_VIEW], ['to the snare', VAL_VIEW]] as const) {
    assert.ok(Math.cos(SETT_FACE - view.heading) > 0.3, `${name}: the sett's opening faces away (${deg(wrap(SETT_FACE - view.heading))}°)`);
  }
  // the reunion is the crossing's own view, with him back beside his camera
  assert.deepEqual(REUNION_VIEW.include, CROSS_VIEW.include);
});

test('the animals the camera photographs walk in from out of view, and the thicket\'s never stand behind the sett', () => {
  const v = { x: CROSS_VIEW.at.x, z: CROSS_VIEW.at.z, heading: CROSS_VIEW.heading };
  for (const animal of ['edelhert', 'ree', 'das', 'wildzwijn', 'nachtzwaluw']) {
    for (const bin of ['open', 'hol'] as const) {
      const s = aimSpot(animal, bin);
      const place = bin === 'open' ? P.glade : P.thicket;
      // (the nightjar by day perches on the stump at the thicket's front, before the sett)
      const reach = bin === 'open' ? P.glade.r : P.thicket.r + (animal === 'nachtzwaluw' ? 1.0 : 0.6);
      if (!(animal === 'das' && bin === 'hol')) assert.ok(dist(s.at, place) < reach, `${animal} in the ${bin} place`);
      if (animal !== 'das') assert.ok(Math.abs(toLocal(v, s.from).u) > CROSS_VIEW.halfW - 0.2 || toLocal(v, s.from).v > 2.5, `${animal} comes in from out of view`);
      if (bin === 'hol' && animal !== 'das' && animal !== 'nachtzwaluw') {
        // as the camera sees it: well clear of the sett's mound (the nightjar sits on top of it)
        const off = Math.abs(wrap(cameraAim(s.at) - cameraAim(P.sett)));
        assert.ok(off > (12 * Math.PI) / 180, `${animal} is ${deg(off)}° off the sett`);
      }
    }
  }
  // every walk into the thicket keeps clear of its solid juniper (a walk round it could
  // stall behind it), and of the sett's mound (the badger's own comes out of it)
  for (const animal of ['edelhert', 'ree', 'wildzwijn']) {
    const s = aimSpot(animal, 'hol');
    assert.ok(segDist(JUNIPER, s.from, s.at) > JUNIPER.r + 0.45, `${animal} walks in clear of the juniper (${segDist(JUNIPER, s.from, s.at).toFixed(2)} m)`);
    assert.ok(segDist(P.sett, s.from, s.at) > 0.9, `${animal} walks in clear of the sett`);
  }
  for (const id of ['wildzwijn', 'ree']) {
    const c = CALLER_SPOTS[id];
    assert.ok(segDist(JUNIPER, c.from, c.at) > JUNIPER.r + 0.45, `the ${id} comes in at night clear of the juniper`);
  }
  // the badger by day: out of its sett onto the open ground at its side — clear of the
  // mound for the camera on the pine, and in front of it for the lens
  const das = aimSpot('das', 'hol');
  assert.ok(dist(das.at, P.sett) < 1.5 && dist(das.from, P.sett) < 0.6, 'at its sett, out of it');
  const dasOff = Math.abs(wrap(cameraAim(das.at) - cameraAim(P.sett)));
  assert.ok(dasOff > (16 * Math.PI) / 180, `the badger is ${deg(dasOff)}° off its sett for the camera`);
  assert.ok(toLocal(v, das.at).v < toLocal(v, P.sett).v, 'nearer the lens than its sett');
  // every animal the camera photographs stands where its fan of view lies
  for (const animal of ['edelhert', 'ree', 'das', 'wildzwijn', 'nachtzwaluw']) {
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
  for (const animal of ['edelhert', 'ree', 'wildzwijn', 'das']) { const a = aimSpot(animal, 'hol'); ways.push([a.from, a.at]); }
  for (const id of ['das', 'wildzwijn']) ways.push([CALLER_SPOTS[id].from, CALLER_SPOTS[id].at]);
  for (const [a, b2] of ways) assert.ok(segDist(NIGHTJAR_STUMP, a, b2) > NIGHTJAR_STUMP.r + 0.9, `clear of a walk (${segDist(NIGHTJAR_STUMP, a, b2).toFixed(2)} m)`);
  // and the camera on the pine photographs the thicket's animals past it, never over it
  for (const animal of ['edelhert', 'ree', 'wildzwijn', 'das']) {
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
  for (const animal of ['edelhert', 'ree', 'wildzwijn', 'das']) assert.ok(dist(open, aimSpot(animal, 'open').at) > 1.0, `apart from the ${animal}`);
});

test('the four night callers: at their own spots round the crossing, all in the one view, well apart', () => {
  const v = { x: CROSS_VIEW.at.x, z: CROSS_VIEW.at.z, heading: CROSS_VIEW.heading };
  const ids = Object.keys(CALLER_SPOTS);
  const m = AREA_VELUWE.missies.find((x) => x.id === 'wildcamera')!;
  assert.deepEqual(ids.slice().sort(), [...(m.stappen.find((s) => s.ef === 'simon')!.skin.dieren ?? [])].sort(), 'one spot per caller of the content');
  for (const id of ids) {
    const l = toLocal(v, CALLER_SPOTS[id].at);
    assert.ok(Math.abs(l.u) < CROSS_VIEW.halfW && l.v > -CROSS_VIEW.halfD - 2 && l.v < CROSS_VIEW.halfD + 1, `${id} is in the view`);
    for (const o of ids) if (o !== id) assert.ok(dist(CALLER_SPOTS[id].at, CALLER_SPOTS[o].at) > 1.6, `${id} and ${o} stand apart`);
  }
  assert.ok(dist(CALLER_SPOTS.das.at, P.sett) < 1.5, 'the badger at its sett');
  assert.ok(toLocal(v, CALLER_SPOTS.das.at).u < toLocal(v, P.sett).u - 0.8, 'beside its mound (not in front of it: grey on grey)');
  assert.ok(dist(CALLER_SPOTS.nachtzwaluw.at, LOG) < 0.01, 'the nightjar on its log');
  assert.ok(dist(CALLER_SPOTS.ree.at, P.glade) < 1.6, 'the roe at the glade');
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
  assert.ok(dist(ROE_HIDEAWAY, aimSpot('ree', 'open').from) < 0.01, 'she comes back from there for the photos');
  assert.ok(Math.abs(toLocal(v, ROE_HIDEAWAY).u) > CROSS_VIEW.halfW + 3, 'out of the view over the crossing');
  assert.ok(wildcameraTreeClearings().every((c) => dist(c, ROE_HIDEAWAY) > c.r - 0.5), 'in under the trees');
});
