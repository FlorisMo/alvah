/**
 * ven.life.test.ts — the ven's life (run 7, package ven-life) is placed by looking at the
 * world; this pins that every spot of it stays a good one: the duck family's loops on deep
 * open water, in view from the path, never in a search's picture or near the song's lens;
 * the dragonflies' homes over the water's edge, away from the play's cove; the heath blue on
 * the heather and the feather on the bank by the path, on the stretch every way walks and
 * clear of the moments; the plopping frogs at the very edge; the blue frog on the moss beside
 * the singing frog, in the answer's picture, big enough to see, at every nook; and a play's
 * life drawn from its own forks, deterministic, different play to play, never a knob.
 * Run: `npm test`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { heightAt as groundY, WATER_LEVEL } from '../../Biomes.ts';
import { fitFrame } from '../../play/frame-fit.ts';
import { dist } from '../places.ts';
import { compactVariant, newPlay } from '../../../core/play.ts';
import { ONTDEKKINGEN } from '../../../content/ontdekkingen.ts';
import { MOOD_IDS, type MoodId } from '../../Moods.ts';
import {
  BAYS, BAY_IDS, PATH, PATH_HALF, SIDES, above, answerView, edgeOf, pathR, polarOf, pointAt, project, singOf, underBoy,
  type ViewSpec,
} from './ven.places.ts';
import {
  BLUE_AWAY, BUTTERFLY_MOODS, BUTTERFLY_TH, DRAGONFLY_MOODS, DRAGONFLY_RANGE, DRAGONFLY_TH, DUCK_LOOPS, DUCKLINGS, FEATHER_TH, PLOP_NEAR, PLOP_PASS,
  BLUE_ID, SEEN, SEEN_SWEEP, blueOf, butterflySpot, clearOfStations, seenStep, dragonflyHome, dragonflyHomesFor, featherSpot, lastLifeOf, lifeTag, onEveryWay, onLoop, plopSpot, trailLength, venLife,
} from './ven.life.ts';
import type { Spot } from '../types.ts';

const W = 1280, H = 800, FOV = 55;
const r2 = (n: number): string => n.toFixed(2);
const at = (p: Spot): string => `(${p.x.toFixed(1)}, ${p.z.toFixed(1)})`;

/** The lens the kit fits for a framed view (as ven.places.test's). */
function lensOf(f: ViewSpec): THREE.PerspectiveCamera {
  const fw = { x: Math.sin(f.heading), z: Math.cos(f.heading) };
  const right = { x: -Math.cos(f.heading), z: Math.sin(f.heading) };
  const include = (f.include ?? []).flatMap((q) => ((q.r ?? 0) > 0 ? [-q.r!, q.r!].map((u) => ({ x: q.x + right.x * u, z: q.z + right.z * u, h: q.h })) : [q]));
  const fit = fitFrame(f.at, fw, { ...f, include }, groundY, FOV, W, H);
  const cam = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 400);
  cam.position.copy(fit.cam); cam.up.set(0, 1, 0); cam.lookAt(fit.look); cam.updateMatrixWorld(true);
  return cam;
}
/** A point (y absolute) on the screen, and whether it is in the picture. */
function screen(cam: THREE.Camera, p: Spot, y: number): { x: number; y: number; inside: boolean } {
  const v = new THREE.Vector3(p.x, y, p.z).project(cam);
  const x = ((v.x + 1) / 2) * W, yy = ((1 - v.y) / 2) * H;
  return { x, y: yy, inside: v.z < 1 && x >= -20 && x <= W + 20 && yy >= -20 && yy <= H + 20 };
}
const searchCams = BAY_IDS.flatMap((id) => SIDES.map((side) => ({ id, side, cam: lensOf(BAYS[id].views.search[side]) })));

test('the duck loops: deep open water all round, out from the coves and the song\'s lens, never in a search\'s picture, in view from the path', () => {
  for (const l of DUCK_LOOPS) {
    const n = 48;
    const pts: Spot[] = [];
    for (let i = 0; i < n; i++) pts.push(onLoop(l, (i / n) * 2 * Math.PI * l.r));
    for (const p of pts) {
      assert.ok(above(p) <= -0.3, `loop ${l.id}: deep water at ${at(p)} (${r2(above(p))} m)`);
      for (const id of BAY_IDS) assert.ok(dist(p, BAYS[id].frame) >= 5, `loop ${l.id}: ${r2(dist(p, BAYS[id].frame))} m from cove ${id}`);
      for (const { id, side, cam } of searchCams) assert.ok(!screen(cam, p, WATER_LEVEL + 0.2).inside, `loop ${l.id}: ${at(p)} is in cove ${id}'s search picture from side ${side}`);
      for (const id of BAY_IDS) for (const f of BAYS[id].nooks) {
        const lens = lensOf(singOf(BAYS[id], f).view).position;
        assert.ok(Math.hypot(p.x - lens.x, p.z - lens.z) >= 3, `loop ${l.id}: near the song's lens at cove ${id} nook ${f.nook}`);
      }
    }
    // a duck's way is the loop's tangent: one step on is the next point
    const a = onLoop(l, 1), b = onLoop(l, 1.05);
    assert.ok(Math.abs(Math.atan2(b.x - a.x, b.z - a.z) - a.yaw) < 0.05 || Math.abs(Math.abs(Math.atan2(b.x - a.x, b.z - a.z) - a.yaw) - 2 * Math.PI) < 0.05, `loop ${l.id}: she faces the way she paddles`);
    // in view from the path: its nearest point within ~16 m of the bank's path
    const near = Math.min(...pts.map((p) => Math.min(...PATH.pts.filter((_, i) => i > 4).map((q) => dist(p, q)))));
    assert.ok(near <= 16, `loop ${l.id}: ${r2(near)} m from the shore path`);
    // the whole family fits on the loop (the trail never laps her)
    assert.ok(trailLength(DUCKLINGS[1]) < Math.PI * l.r, `loop ${l.id}: the ducklings' trail fits on it`);
  }
});

test('the dragonflies: their homes over the water\'s edge; a play keeps to the ones away from its cove, never in its search picture', () => {
  for (let i = 0; i < DRAGONFLY_TH.length; i++) {
    const h = dragonflyHome(i);
    assert.ok(above(h) <= 0.02 && above(h) >= -0.35, `dragonfly home ${i} just out over the water's edge (${r2(above(h))})`);
  }
  for (const id of BAY_IDS) {
    const homes = dragonflyHomesFor(id);
    assert.ok(homes.length >= 2, `cove ${id}: ${homes.length} dragonfly homes away from it`);
    for (const i of homes) {
      const h = dragonflyHome(i);
      for (const side of SIDES) {
        const cam = searchCams.find((c) => c.id === id && c.side === side)!.cam;
        for (let a = 0; a < 16; a++) for (const y of [0.45, 1.15]) {
          const p = { x: h.x + Math.cos(a) * DRAGONFLY_RANGE, z: h.z + Math.sin(a) * DRAGONFLY_RANGE };
          assert.ok(!screen(cam, p, WATER_LEVEL + y).inside, `cove ${id}: dragonfly home ${i} reaches into the search picture from side ${side}`);
        }
      }
    }
  }
});

test('the heath blue and the feather: by the path on the stretch every way walks, clear of the moments; the blue on the heather, the feather on the bank', () => {
  for (let i = 0; i < BUTTERFLY_TH.length; i++) {
    const p = butterflySpot(i);
    assert.ok(above(p) >= 0.6, `heath blue ${i}: dry heather (${r2(above(p))})`);
    assert.ok(polarOf(p).r > pathR(polarOf(p).th) + 0.6, `heath blue ${i}: on the path's land side`);
    assert.ok(project(PATH, p).d >= PATH_HALF + 0.5 && project(PATH, p).d <= 1.6, `heath blue ${i}: beside the path (${r2(project(PATH, p).d)} m)`);
    assert.ok(clearOfStations(p), `heath blue ${i}: clear of every station`);
    assert.ok(onEveryWay(p), `heath blue ${i}: every way to a cove passes it`);
  }
  for (let i = 0; i < FEATHER_TH.length; i++) {
    const p = featherSpot(i);
    assert.ok(above(p) >= 0.3, `feather ${i}: on the dry bank (${r2(above(p))})`);
    assert.ok(polarOf(p).r < pathR(polarOf(p).th), `feather ${i}: on the path's water side`);
    assert.ok(project(PATH, p).d >= PATH_HALF + 0.4 && project(PATH, p).d <= 1.5, `feather ${i}: just off the path (${r2(project(PATH, p).d)} m)`);
    assert.ok(clearOfStations(p), `feather ${i}: clear of every station`);
    assert.ok(onEveryWay(p), `feather ${i}: every way to a cove passes it`);
  }
  // the three of each lie apart (a play's spot is a different place from the next's)
  for (const f of [butterflySpot, featherSpot] as const) for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) assert.ok(dist(f(i), f(j)) >= 1.7, `spots ${i} and ${j} lie apart`);
});

test('the plopping frogs: at the very edge by each cove, never in its search picture, near his way down and near the path above it', () => {
  for (const id of BAY_IDS) {
    const b = BAYS[id];
    for (const i of [0, 1] as const) {
      const p = plopSpot(b, i);
      assert.ok(above(p) >= 0.0 && above(p) <= 0.08, `cove ${id} plop ${i}: at the very edge (${r2(above(p))})`);
      for (const f of b.nooks) assert.ok(dist(p, f) >= 0.9, `cove ${id} plop ${i}: off nook ${f.nook}`);
      // his own cove's frog sits on the side he comes down to: he comes well within its reach
      // there, so it plops before the search (never a sitting frog in the search's picture)
      const side = i === 1 ? 1 : -1;
      const near = dist(p, b.stands[side as 1 | -1]);
      assert.ok(near <= PLOP_NEAR - 0.6, `cove ${id} plop ${i}: ${r2(near)} m from where he stands on that side`);
      // and passes above it on the path (a cove he walks past)
      const fromPath = Math.min(...PATH.pts.map((q) => dist(p, q)));
      assert.ok(fromPath <= PLOP_PASS - 0.5, `cove ${id} plop ${i}: ${r2(fromPath)} m below the path`);
    }
  }
});

test('the blue frog: on the moss at the water\'s edge beside the singing frog, in the answer\'s picture and big enough, at every nook', () => {
  for (const id of BAY_IDS) {
    const b = BAYS[id];
    for (const f of b.nooks) {
      const blue = blueOf(b, f);
      const sing = edgeOf(b, f);
      assert.ok(above(blue) >= 0.0 && above(blue) <= 0.1, `cove ${id} nook ${f.nook}: the blue frog sits at the edge (${r2(above(blue))})`);
      assert.ok(above(blue.up) < -0.01, `cove ${id} nook ${f.nook}: it comes up out of the water`);
      const d = dist(blue, sing);
      assert.ok(d >= 2.0 && d <= BLUE_AWAY + 0.7, `cove ${id} nook ${f.nook}: ${r2(d)} m from the singing frog`);
      const sOf = singOf(b, f);
      assert.ok(dist(blue, sOf.stand) >= 1.0, `cove ${id} nook ${f.nook}: away from the boy`);
      const cam = lensOf(answerView(b, f, blue));
      const g = groundY(blue.x, blue.z);
      const c = screen(cam, blue, g + 0.06);
      assert.ok(c.x > 60 && c.x < W - 60 && c.y > 140 && c.y < H - 40, `cove ${id} nook ${f.nook}: the blue frog in the answer's picture (${c.x.toFixed(0)}, ${c.y.toFixed(0)})`);
      const e0 = screen(cam, { x: blue.x - Math.sin(blue.yaw) * 0.12, z: blue.z - Math.cos(blue.yaw) * 0.12 }, g + 0.05);
      const e1 = screen(cam, { x: blue.x + Math.sin(blue.yaw) * 0.12, z: blue.z + Math.cos(blue.yaw) * 0.12 }, g + 0.05);
      const side0 = screen(cam, { x: blue.x - Math.cos(blue.yaw) * 0.08, z: blue.z + Math.sin(blue.yaw) * 0.08 }, g);
      const side1 = screen(cam, { x: blue.x + Math.cos(blue.yaw) * 0.08, z: blue.z - Math.sin(blue.yaw) * 0.08 }, g + 0.12);
      const px = Math.max(Math.hypot(e1.x - e0.x, e1.y - e0.y), Math.hypot(side1.x - side0.x, side1.y - side0.y));
      assert.ok(px >= 22, `cove ${id} nook ${f.nook}: the blue frog's body spans ${px.toFixed(0)} px in the answer's picture`);
      // never at the boy in that picture
      const boy = screen(cam, sOf.stand, groundY(sOf.stand.x, sOf.stand.z) + 0.7);
      assert.ok(Math.hypot(boy.x - c.x, boy.y - c.y) >= 70, `cove ${id} nook ${f.nook}: the blue frog beside the boy in the picture`);
      void underBoy;
    }
  }
});

test('a play\'s life: drawn from its own forks, deterministic, never the last play\'s duck loop, dragonflies and the heath blue only in their moods', () => {
  const laid = { bay: 'B' as const, side: 1 as const };
  for (let seed = 1; seed <= 40; seed++) {
    const a = venLife(newPlay('ven', seed, 1), 'zonnig', laid), b = venLife(newPlay('ven', seed, 1), 'zonnig', laid);
    assert.deepEqual(a, b, 'the same seed, the same life');
    assert.ok(a.ducks.count >= DUCKLINGS[0] && a.ducks.count <= DUCKLINGS[1]);
    const c = venLife(newPlay('ven', seed, 1), 'zonnig', laid, lastLifeOf(`B1-apm+0.2/${lifeTag(a)}`));
    assert.notEqual(c.ducks.loop, a.ducks.loop, 'never the last play\'s loop');
    assert.notEqual(c.ducks.count, a.ducks.count, 'never as many ducklings as last play');
    if (a.veer !== null && c.veer !== null) assert.notEqual(c.veer, a.veer, 'the feather never where it lay last play');
    for (const h of a.libellen) assert.ok(dragonflyHomesFor('B').includes(h), 'dragonflies away from the cove');
    assert.ok(a.plops[0].bay === 'B' && a.plops[0].i === 1, 'one frog plops at his own cove, on his side');
    for (const p of a.plops.slice(1)) assert.ok(BAYS[p.bay].th > BAYS.B.th, 'another at a cove he walks past');
  }
  const moodsOf = (m: MoodId): { fly: number; blue: number; veer: number } => {
    let fly = 0, blue = 0, veer = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const l = venLife(newPlay('ven', seed, 1), m, laid);
      if (l.libellen.length) fly++;
      if (l.vlinder !== null) blue++;
      if (l.veer !== null) veer++;
      // every play brings at least one of them besides the ducks (three plays in a row with
      // the ducks alone felt alike)
      assert.ok(l.libellen.length || l.vlinder !== null || l.veer !== null, `${m} seed ${seed}: a small thing besides the ducks`);
    }
    return { fly, blue, veer };
  };
  for (const m of MOOD_IDS) {
    const r = moodsOf(m);
    const others = DRAGONFLY_MOODS.includes(m) || BUTTERFLY_MOODS.includes(m);
    if (DRAGONFLY_MOODS.includes(m)) assert.ok(r.fly >= 70 && r.fly <= 145, `${m}: dragonflies in ${r.fly} of 200 plays`); else assert.equal(r.fly, 0, `${m}: no dragonflies`);
    if (BUTTERFLY_MOODS.includes(m)) assert.ok(r.blue >= 70 && r.blue <= 135, `${m}: the heath blue in ${r.blue} of 200 plays`); else assert.equal(r.blue, 0, `${m}: no heath blue`);
    // (where nothing else lives in this light, the feather lies there every play)
    if (others) assert.ok(r.veer >= 60 && r.veer <= 125, `${m}: the feather in ${r.veer} of 200 plays`); else assert.equal(r.veer, 200, `${m}: the feather every play`);
  }
  // three plays in a row bring different life (the ducks' loop at least)
  for (const base of [11, 31, 71]) {
    let last: ReturnType<typeof lastLifeOf> = null;
    const rows = [base, base + 1, base + 2].map((s) => { const l = venLife(newPlay('ven', s, 1), 'gouden-uur', laid, last); last = lastLifeOf(`B1-apm+0.2/${lifeTag(l)}`); return l; });
    assert.equal(new Set(rows.map((r) => r.variant)).size, 3, `seeds ${base}…: ${rows.map((r) => r.variant).join(' | ')}`);
    for (let i = 1; i < 3; i++) assert.ok(rows[i].ducks.count !== rows[i - 1].ducks.count && rows[i].ducks.loop !== rows[i - 1].ducks.loop, 'another duck family each play');
  }
  // the cove's variant carries the family back to the next play
  const l = venLife(newPlay('ven', 5, 1), 'zonnig', laid);
  assert.deepEqual(lastLifeOf(`B1-apm+0.2/${lifeTag(l)}`), { loop: l.ducks.loop, count: l.ducks.count, veer: l.veer });
  assert.deepEqual(lastLifeOf('B1-apm+0.2/e5nf2'), { loop: 0, count: 5, veer: 2 });
  assert.equal(lastLifeOf('B1-apm+0.2'), null);
  void pointAt;
});

test('the play\'s noted variant keeps the cove and the ducks in the history in every mood, with the rare too', () => {
  // (the history keeps 60 characters of a play's notes, in the order noted: the mood, the
  // rare, the moments' order, then the ven's own — the next play reads the last cove, nook,
  // duck family and feather back from it)
  const rare = ONTDEKKINGEN.find((o) => o.home === 'ven' && o.soort === 'zeldzaam')!;
  assert.equal(rare.id, BLUE_ID);
  const longestMood = [...MOOD_IDS].sort((a, b) => b.length - a.length)[0];
  const va = compactVariant({ mood: longestMood, rare: rare.id.slice(rare.id.indexOf('.') + 1), rust: 'amp', ven: 'A5-amp-0.9/e7of2', l: 'e7olv2f2p2' })!;
  assert.match(va, /(^|,)ven:A5-amp-0\.9\/e7of2(,|$)/, `the ven's note survives: ${va}`);
});

test('seen means steady in his picture: a thing a gliding lens sweeps through is not seen, one he stands or walks by is', () => {
  const me = { x: 0, z: 0 };
  const run = (speed: number, secs: number, px = 60): number => {
    let st: { run: number; last: { x: number; y: number } | null } = { run: 0, last: null };
    let best = 0;
    for (let t = 0; t < secs; t += 1 / 60) {
      st = seenStep(st.run, st.last, { on: true, px, centre: { x: 8, z: 0 }, sx: 100 + speed * t, sy: 400 }, me, SEEN.eend, 1 / 60);
      best = Math.max(best, st.run);
    }
    return best;
  };
  // (played: the look's glide along the bank swept the duck family through his picture at
  // 500-1000 px/s for over a second, and its card came with no duck in view)
  // (the first frame it shows has nothing to compare with: one frame, never a second)
  assert.ok(run(530, 2) < 0.02, 'swept through by a gliding lens: never seen');
  assert.ok(run(970, 1.3) < 0.02);
  assert.ok(run(0, 1.2) >= SEEN.eend.secs, 'standing, it in view: seen');
  assert.ok(run(160, 1.2) >= SEEN.eend.secs, 'walking past it (it crosses his picture slowly): seen');
  assert.ok(SEEN_SWEEP >= 300 && SEEN_SWEEP <= 450);
  assert.equal(run(0, 2, 10), 0, 'too small: never seen');
  // out of the picture resets the count, and a reappearance starts afresh (no sweep from afar)
  let st = seenStep(0.9, { x: 100, y: 100 }, { on: false, px: 0, centre: { x: 8, z: 0 }, sx: 0, sy: 0 }, me, SEEN.eend, 0.1);
  assert.deepEqual(st, { run: 0, last: null });
  st = seenStep(st.run, st.last, { on: true, px: 60, centre: { x: 8, z: 0 }, sx: 1200, sy: 700 }, me, SEEN.eend, 0.1);
  assert.ok(st.run > 0);
});
