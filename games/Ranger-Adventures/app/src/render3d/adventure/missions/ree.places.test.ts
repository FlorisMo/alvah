/**
 * ree.places.test.ts — where "Het reekalf in het gras" happens is chosen by looking at
 * the world; this pins that EVERY layout stays a good place (design run6-missions §4.2,
 * run 7 `state/ree/design.md` §6.2): dry heath inside the world, clear of the paths, the
 * props, the other markers and the neighbours' homes; three stands of the same size, apart;
 * the story readable from the marker (the mother grazing beyond her shy distance, beside
 * the grass, never behind it); the calf's four spots inside every stand and clear of the
 * look-alikes; the hide looking ACROSS her way, away from the clearing and the wildcamera's
 * glade; the pools on the way with a dry way round; her bed out of sight; the walks free
 * and long enough to be walks. Run: `npm test`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  REE_PLACES as P, REE_RESIDENTS, REE_HOME, REE_LAYOUTS, LAYOUTS, MARKER, STAND, FRINGE, SEARCH_RING, POOL, COPSE_FRAME, COPSE_SIZE,
  COPSE, THICKET, HOME_REACH, COPSE_TREES, CALF_DOELEN, DOE_BED, CALF_HOME, onStand, calfAt, calfTalkOf, calfBolt, calfView, leaveView, drinkSpot,
  inStand, reeClearings, slotTrail, wisselLine, juniperR, poolsOf, poolSides, WISSEL_HALF, type ReeLayout, type PoolSpot,
} from './ree.places.ts';
import { FRISLING_PLACES, hideClumps, fieldSpots, cluePosts, bootPrints } from './frisling.places.ts';
import { WILDCAMERA_PLACES, WILDCAMERA_RESIDENTS, ROE_SHY_WITHIN, wildcameraClearings } from './wildcamera.places.ts';
import { anchorInBiome, biomeAt, VEN_CENTER } from '../../Biomes.ts';
import { distanceToNetwork, LANE_HALF } from '../../Paths.ts';
import { atLocal, dist, headingTo, segDist, toLocal, toward } from '../places.ts';
import { patchLocal } from '../../play/kit-math.ts';
import { AREA_VELUWE } from '../../../content/veluwe.ts';
import { SIZE } from '../../AnimalScale.ts';
import type { Spot } from '../types.ts';

/** The other missions' markers as the world places them (read with `__ranger.markers()`,
 *  2026-09-29). */
const OTHER_MARKERS = {
  frisling: { x: -15.556349186104043, z: -15.556349186104047 },
  herstel: { x: -34.999270825785885, z: -19.36623457627458 },
  wildcamera: { x: 15.556349186104047, z: -15.556349186104043 },
  nachtronde: { x: 20.8, z: -34.2 },
};
/** The world's props near the ree home (world/Dressing.placeNatureDressing) + their solid radius. */
const PROPS = [{ x: -10, z: -22, r: 0 }, { x: -20, z: -28, r: 0.9 }, { x: -6, z: -30, r: 0 }];
/** The roaming animals' wander loops (world/Fauna.placeAmbientLife): home + radius. */
const ROAMERS = [
  { id: 'vos', x: -42, z: -2, r: 6 },
  { id: 'eekhoorn', x: 4, z: -11, r: 3 },
];
const MISSION = AREA_VELUWE.missies.find((x) => x.id === 'ree-niet-aanraken')!;
const SKIN = MISSION.stappen[0].skin as { doel?: { x: number; y: number }; doelen?: { x: number; y: number }[]; distractors?: { id: string; x: number; y: number; k: string }[] };

/** Every cover the doe lies up in: the copse, and the thicket of layout C. */
const COVERS = [COPSE, THICKET];
/** How far inside (< 1) or outside (> 1) a cover's bracken a spot is. */
const inCover = (c: typeof COPSE, p: Spot): number => { const q = toLocal(c.frame, p); return Math.hypot(q.u / c.a, q.v / c.b); };
const juniperSpots = (l: ReeLayout | null = null): { x: number; z: number; h: number }[] => [
  ...COVERS.flatMap((c) => c.junipers),
  ...(l ? [l] : LAYOUTS).map((q) => ({ x: q.hideJuniper.x, z: q.hideJuniper.z, h: q.hideJuniper.h })),
];
/** A point `k` (−1..1) along a layout's hide log. */
const alongLog = (l: ReeLayout, k: number): Spot =>
  ({ x: l.hideLog.x + Math.cos(l.hideLog.turn) * k * l.hideLog.half, z: l.hideLog.z - Math.sin(l.hideLog.turn) * k * l.hideLog.half });
/** Everything solid: the junipers, the copse's trunks, every hide's log. */
const solids = (): { x: number; z: number; r: number }[] => [
  ...juniperSpots().map((j) => ({ x: j.x, z: j.z, r: juniperR(j.h) })),
  ...COPSE_TREES.map((t) => ({ x: t.x, z: t.z, r: 0.75 })),
  ...LAYOUTS.flatMap((l) => [-1, -0.5, 0, 0.5, 1].map((k) => ({ ...alongLog(l, k), r: 0.4 }))),
];
/** The rim of a stand's grass (its fringe's outer ellipse), as points. */
const rim = (l: ReeLayout, k = FRINGE.kMax, n = 36): Spot[] => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2;
  return atLocal(l.frame, FRINGE.a * k * Math.cos(a), FRINGE.b * k * Math.sin(a));
});
/** How far inside (< 1) or outside (> 1) a stand's fringe a spot is. */
const inGrass = (l: ReeLayout, p: Spot): number => {
  const q = inStand(l, p);
  return Math.hypot(q.u / (FRINGE.a * FRINGE.kMax), q.v / (FRINGE.b * FRINGE.kMax));
};
/** How deep in a pool's water a spot is (< 1 wet). */
const wet = (p: PoolSpot, q: Spot): number => { const l = toLocal(p, q); return (l.u / POOL.halfW) ** 2 + (l.v / POOL.halfD) ** 2; };
/** The calf's spots in a layout (world). */
const calves = (l: ReeLayout): (Spot & { yaw: number })[] => CALF_DOELEN.map((d) => calfAt(l, d));
/** A polyline's length. */
const length = (w: readonly Spot[]): number => w.slice(1).reduce((s, q, i) => s + dist(w[i], q), 0);
/** The angle (rad, 0..π) between two headings. */
const off = (a: number, b: number): number => Math.abs(((a - b + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);

const everything = (): { name: string; x: number; z: number; r: number }[] => [
  ...Object.entries(P).map(([name, p]) => ({ name, x: p.x, z: p.z, r: 0.5 })),
  ...LAYOUTS.flatMap((l) => [
    ...rim(l, FRINGE.kMax, 24).map((p, i) => ({ name: `${l.id}.rim-${i}`, ...p, r: 0.35 })),
    ...wisselLine(l).map((p, i) => ({ name: `${l.id}.wissel-${i}`, ...p, r: WISSEL_HALF })),
    ...poolsOf(l).map((q, k) => ({ name: `${l.id}.pool-${k ? 'out' : 'in'}`, x: q.x, z: q.z, r: POOL.halfW + 0.55 })),
    { name: `${l.id}.hideJuniper`, x: l.hideJuniper.x, z: l.hideJuniper.z, r: juniperR(l.hideJuniper.h) },
    { name: `${l.id}.log`, x: l.hideLog.x, z: l.hideLog.z, r: 1.1 },
  ]),
  // the copse and the thicket: their bracken (an ellipse), junipers and trees
  ...COVERS.flatMap((c, k) => Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    return { name: `cover${k}-rim-${i}`, ...atLocal(c.frame, c.a * Math.cos(a), c.b * Math.sin(a)), r: 0.4 };
  })),
  ...COVERS.flatMap((c, k) => c.junipers.map((j, i) => ({ name: `cover${k}-juniper-${i}`, x: j.x, z: j.z, r: juniperR(j.h) }))),
  ...COPSE_TREES.map((t, i) => ({ name: `tree-${i}`, x: t.x, z: t.z, r: 0.7 })),
];

/** The frisling's home (its places, its field, its cover, the fence): the ree keeps clear. */
const frislingHome = (): { name: string; x: number; z: number }[] => [
  ...Object.entries(FRISLING_PLACES).map(([name, p]) => ({ name: `frisling.${name}`, x: p.x, z: p.z })),
  ...fieldSpots().map((s) => ({ name: `frisling.field-${s.id}`, x: s.x, z: s.z })),
  ...hideClumps().map((h, i) => ({ name: `frisling.clump-${i}`, x: h.x, z: h.z })),
  ...cluePosts().map((p, i) => ({ name: `frisling.post-${i}`, x: p.x, z: p.z })),
  ...bootPrints().map((p, i) => ({ name: `frisling.print-${i}`, x: p.x, z: p.z })),
];

test('the marker is where the world puts it (the heide\'s second anchor, fanned out)', () => {
  const a = anchorInBiome('heide', 31);
  const r = Math.hypot(a.x, a.z), ang = Math.atan2(a.z, a.x) + 0.28;
  assert.ok(Math.abs(Math.cos(ang) * r - MARKER.x) < 1e-6 && Math.abs(Math.sin(ang) * r - MARKER.z) < 1e-6, `anchor (${a.x}, ${a.z})`);
  assert.equal(AREA_VELUWE.missies[1].id, 'ree-niet-aanraken');
  assert.equal(REE_HOME.marker?.look, 'none', 'the ring stays empty: the calf is hidden, its mother by the copse');
  assert.deepEqual(Object.keys(REE_LAYOUTS).sort(), ['A', 'B', 'C']);
});

test('every place of every layout is dry heath inside the world', () => {
  for (const p of everything()) {
    assert.equal(biomeAt(p.x, p.z), 'heide', `${p.name} is on the heath`);
    assert.ok(Math.hypot(p.x, p.z) < 58, `${p.name} is well inside the world (${Math.hypot(p.x, p.z).toFixed(1)} m out)`);
    assert.ok(Math.hypot(p.x - VEN_CENTER.x, p.z - VEN_CENTER.z) > 25, `${p.name} is far from the ven`);
  }
});

test('three stands of tall grass, the same size, apart; he searches each from open heath', () => {
  for (let i = 0; i < LAYOUTS.length; i++) {
    const a = LAYOUTS[i];
    // he stands on open heath beyond the outermost fringe tussock, in front of the stand
    // and off to one side of it (the same distance and angle in every stand)
    const s = inStand(a, a.search);
    assert.ok(Math.abs(Math.hypot(s.u / SEARCH_RING.a, s.v / SEARCH_RING.b) - 1) < 1e-9 && s.v < -2, `${a.id}: the search spot stands on its ring, in front`);
    assert.ok(inGrass(a, a.search) > 1.15, `${a.id}: the search spot is out of the fringe (${inGrass(a, a.search).toFixed(2)})`);
    assert.ok(Math.abs(Math.abs(s.u) - Math.abs(inStand(LAYOUTS[0], LAYOUTS[0].search).u)) < 1e-9, `${a.id}: the same side distance in every stand`);
    for (const b of LAYOUTS.slice(i + 1)) {
      // rim to rim (the fringes' outer ellipses) at least 4 m apart
      const gap = Math.min(...rim(a).flatMap((p) => rim(b).map((q) => dist(p, q))));
      assert.ok(gap >= 3, `${a.id}–${b.id}: ${gap.toFixed(1)} m of heath between the stands`);
      // never the same search picture: another side or another stand
      assert.ok(dist(a.frame, b.frame) > 8, `${a.id}–${b.id}: two stands`);
    }
    // a stand is no copse: clear of every cover's bracken
    for (const c of COVERS) for (const p of rim(a)) assert.ok(inCover(c, p) > 1.25, `${a.id}: its grass keeps off a cover`);
  }
});

test('the story reads from the marker: her prints lead off along her wissel, the mother grazing by the copse beyond', () => {
  const doe = REE_RESIDENTS.find((r) => r.key === 'doe')!;
  const shy = doe.shy!.find((q) => q.state === 'before')!;
  for (const l of LAYOUTS) {
    // the wissel: the ring, one bend, his search spot; a walk, not two steps
    const w = length(l.wissel);
    assert.ok(w >= 10 && w <= 28, `${l.id}: her wissel is ${w.toFixed(1)} m`);
    const bend = off(headingTo(l.wissel[0], l.wissel[1]), headingTo(l.wissel[1], l.wissel[2]));
    assert.ok(bend > 0.35, `${l.id}: it bends (${((bend * 180) / Math.PI).toFixed(0)}°)`);
    for (const [i, g] of l.graze.entries()) {
      const d = dist(MARKER, g);
      assert.ok(d >= 10 && d > shy.within + 2.5, `${l.id}: graze ${i} is ${d.toFixed(1)} m from the marker (shy within ${shy.within} m)`);
      // from the ring she is seen BESIDE every stand's grass that stands nearer, never behind it
      for (const s of LAYOUTS) {
        if (dist(MARKER, s.frame) > d) continue;
        const half = Math.atan2(FRINGE.a * FRINGE.kMax * 1.05, dist(MARKER, s.frame));
        const o = off(headingTo(MARKER, g), headingTo(MARKER, s.frame));
        assert.ok(o > half + 0.03, `${l.id}: graze ${i} is ${((o * 180) / Math.PI).toFixed(0)}° off ${s.id}'s grass (it spans ±${((half * 180) / Math.PI).toFixed(0)}°)`);
      }
      // she grazes by her cover, out on open heath, clear of the bushes and the trunks
      assert.ok(dist(g, l.cover.frame) < 7.5 && inCover(l.cover, g) > 0.9, `${l.id}: graze ${i} is by her cover, out of it`);
      for (const j of juniperSpots()) assert.ok(dist(j, g) > juniperR(j.h) + 0.4, `${l.id}: graze ${i} clear of the bushes`);
      for (const t of COPSE_TREES) assert.ok(dist(t, g) > 1.0, `${l.id}: graze ${i} clear of the trunks`);
      // nothing of the play in the look's foreground: no pool near the ring between it and her
      for (const q of poolsOf(l)) assert.ok(dist(q, MARKER) > 10 || segDist(q, MARKER, g) > POOL.halfW + 1.2, `${l.id}: a pool is in the look's foreground at graze ${i}`);
    }
    // coming up from the clearing to the marker, he never comes within her shy distance
    for (const g of l.graze) assert.ok(segDist(g, { x: 0, z: 0 }, MARKER) > shy.within + 1, `${l.id}: the way in keeps her grazing`);
    // her prints: from behind the ring to the grass's edge, round the bend, on her wissel
    const t = slotTrail(l);
    const line = wisselLine(l);
    const onWissel = (p: Spot): number => Math.min(...line.slice(1).map((q, i) => segDist(p, line[i], q)));
    for (const leg of t) for (const k of [0, 0.25, 0.5, 0.75, 1]) {
      const p = { x: leg.from.x + (leg.to.x - leg.from.x) * k, z: leg.from.z + (leg.to.z - leg.from.z) * k };
      assert.ok(onWissel(p) < WISSEL_HALF * 0.6, `${l.id}: her prints lie on her path (${onWissel(p).toFixed(2)} m off it)`);
    }
    assert.ok(dist(t[0].from, MARKER) < 1.5 && dist(t[t.length - 1].to, l.search) < 1, `${l.id}: from the ring to the grass`);
    for (const c of calves(l)) assert.ok(dist(t[t.length - 1].to, c) > 2, `${l.id}: the prints end short of the calf`);
    assert.ok(onWissel(MARKER) < 0.2, `${l.id}: the path runs through the ring`);
    assert.ok(inGrass(l, line[line.length - 1]) < 1, `${l.id}: it ends in the grass's fringe`);
    for (const c of calves(l)) assert.ok(dist(line[line.length - 1], c) > 1.6, `${l.id}: it stops short of the calf`);
    for (const p of line) assert.ok(distanceToNetwork(p.x, p.z) > LANE_HALF + WISSEL_HALF, `${l.id}: off the world's sand paths`);
    // never through another stand's grass
    for (const s of LAYOUTS) if (s !== l) for (const p of line) assert.ok(inGrass(s, p) > 1.05, `${l.id}: her wissel keeps out of ${s.id}'s grass`);
  }
});

test('the calf lies in one of four spots in every stand, clear of the look-alikes, never in the middle', () => {
  assert.deepEqual(SKIN.doelen, CALF_DOELEN, 'the content\'s doelen are the spots');
  assert.deepEqual(SKIN.doel, CALF_DOELEN[0], 'doel is the first spot (for anything that reads it)');
  for (const l of LAYOUTS) {
    for (const [i, d] of CALF_DOELEN.entries()) {
      const c = calfAt(l, d);
      const q = inStand(l, c);
      assert.ok(Math.abs(q.u) <= STAND.halfW && Math.abs(q.v) <= STAND.halfD, `${l.id}${i}: inside the stand`);
      assert.ok(Math.hypot(q.u / STAND.halfW, q.v / STAND.halfD) > 0.45, `${l.id}${i}: not in the middle of the stand`);
      assert.equal(biomeAt(c.x, c.z), 'heide', `${l.id}${i}: dry heath`);
      // the look-alikes keep their distance from EVERY spot (the cover never marks the real one)
      for (const x of SKIN.distractors ?? []) {
        const pd = patchLocal(x.x, x.y, STAND.halfW, STAND.halfD), pc = patchLocal(d.x, d.y, STAND.halfW, STAND.halfD);
        const m = Math.hypot(pd.u - pc.u, pd.v - pc.v);
        assert.ok(m >= 0.6, `${l.id}${i}: look-alike ${x.id} is ${m.toFixed(2)} m from the spot`);
      }
      for (const j of solids()) assert.ok(dist(j, c) > j.r + 1, `${l.id}${i}: no bush or trunk at the calf`);
      // he stands by it to talk, not on it; a startled calf bolts to the side, stays in
      // the grass, never toward him
      const talk = calfTalkOf(l, c);
      assert.ok(Math.abs(dist(talk, c) - 1.35) < 1e-9);
      const b = calfBolt(l, c, talk);
      const bd = dist(b, c);
      assert.ok(bd > 1.2 && bd < 2.0, `${l.id}${i}: it bolts ${bd.toFixed(1)} m`);
      assert.ok(dist(b, talk) > dist(c, talk), `${l.id}${i}: away from him, not toward him`);
      const bl = inStand(l, b);
      assert.ok(Math.abs(bl.u) <= STAND.halfW + 0.3 && Math.abs(bl.v) <= STAND.halfD + 0.3, `${l.id}${i}: it bolts into the tall grass`);
    }
  }
  // the calf in free roam lies in A's first spot
  const before = REE_RESIDENTS.find((r) => r.key === 'calf')!.before!;
  assert.ok(dist(before, CALF_HOME) < 1e-9 && before.idle === 'lie', 'it lies there, pressed flat');
});

test('the hide looks across her way at the copse\'s gap and the meeting place, away from the clearing and the glade', () => {
  const half = Math.atan(Math.tan((27.5 * Math.PI) / 180) * 1.6); // the lens's half view across (FOV 55, 1280×800)
  for (const l of LAYOUTS) {
    // her way out of the gap to the calf runs across the view, never toward the lens
    const along = Math.cos(headingTo(l.gap, l.meet) - l.hide.heading!);
    assert.ok(Math.abs(along) < 0.5, `${l.id}: her way is across the view (cos ${along.toFixed(2)})`);
    // the gap and the meeting place both ahead, inside the watch
    const w = { x: l.views.watch.at.x, z: l.views.watch.at.z, heading: l.views.watch.heading };
    for (const [name, q] of [['gap', l.gap], ['meet', l.meet]] as const) {
      const h = toLocal({ ...l.hide, heading: l.hide.heading! }, q);
      assert.ok(h.v > 5 && Math.abs(Math.atan2(h.u, h.v)) < 0.62, `${l.id}: the ${name} is ahead of the hide`);
      assert.ok(Math.abs(toLocal(w, q).u) < l.views.watch.halfW, `${l.id}: the ${name} is in the watch`);
    }
    // they meet on open heath out of the tall grass, between the grass and her gap
    assert.ok(inGrass(l, l.meet) > 1.0, `${l.id}: they meet out of the grass (${inGrass(l, l.meet).toFixed(2)} × its rim)`);
    for (const s of LAYOUTS) assert.ok(s === l || inGrass(s, l.meet) > 1.1, `${l.id}: the meeting is out of ${s.id}'s grass`);
    for (const j of juniperSpots()) assert.ok(dist(j, l.meet) > juniperR(j.h) + 0.5, `${l.id}: the meeting is clear of the bushes`);
    for (const t of COPSE_TREES) assert.ok(dist(t, l.meet) > 1.2, `${l.id}: the meeting is clear of the trunks`);
    // the watch's backdrop is heath and forest: the clearing (its cabin, the jeep) and
    // the wildcamera's glade (its roe) stay out of the picture, with room to spare
    const cabin = off(l.views.watch.heading, headingTo(l.views.watch.at, { x: 0, z: 0 }));
    assert.ok(cabin > half + 0.35, `${l.id}: the clearing is ${((cabin * 180) / Math.PI).toFixed(0)}° off the watch (half view ${((half * 180) / Math.PI).toFixed(0)}°)`);
    for (const [k, p] of Object.entries(WILDCAMERA_PLACES)) {
      const o = off(l.views.watch.heading, headingTo(l.hide, p));
      const strict = k === 'glade' || k === 'home';
      assert.ok(o > half + 0.2 || (!strict && dist(l.hide, p) > 25), `${l.id}: the wildcamera's ${k} is ${((o * 180) / Math.PI).toFixed(0)}° off the watch, ${dist(l.hide, p).toFixed(0)} m off`);
    }
    const roe = WILDCAMERA_RESIDENTS.find((r) => r.key === 'ree')!.before!;
    assert.ok(off(l.views.watch.heading, headingTo(l.hide, roe)) > half + 0.2, `${l.id}: the wildcamera's roe is out of the watch`);
    // the stand he searched is never in front of the lens: no grass between the hide and her way
    for (const s of LAYOUTS) for (const k of [0.15, 0.35, 0.55, 0.75]) {
      const p = toward(l.hide, l.views.watch.at, dist(l.hide, l.views.watch.at) * k);
      assert.ok(inGrass(s, p) > 1.0, `${l.id}: ${s.id}'s grass stands in front of the watch`);
    }
    // the walk to the hide is a walk: round the grass from where he leaves the calf
    for (const [i, d] of CALF_DOELEN.entries()) {
      const talk = calfTalkOf(l, calfAt(l, d));
      const m = length([talk, ...l.way]);
      assert.ok(m >= 10.5 && m <= 24, `${l.id}${i}: the walk to the hide is ${m.toFixed(1)} m`);
    }
    // "loop rustig weg": his steps back out of the hide take him away from the family, and
    // he ends near the marker or the family's home (the world's step-8 bar: ≤ 12 m)
    assert.ok(dist(l.hideLeave, l.meet) > dist(l.hide, l.meet) + 0.45, `${l.id}: the quiet steps lead away`);
    const end = Math.min(dist(l.hideLeave, P.home), dist(l.hideLeave, MARKER));
    assert.ok(end < 12, `${l.id}: he ends ${end.toFixed(1)} m from the marker or their home`);
    // the hide's log lies ACROSS his view, in front of him to one side (he looks past its end)
    const hf = { ...l.hide, heading: l.hide.heading! };
    const l0 = toLocal(hf, alongLog(l, -1)), l1 = toLocal(hf, alongLog(l, 1));
    assert.ok(Math.abs(l0.v - l1.v) < 0.05 && Math.abs(l0.u - l1.u) > 1.5, `${l.id}: the log lies across`);
    assert.ok(l0.v > 0.8 && (Math.min(l0.u, l1.u) > 0 || Math.max(l0.u, l1.u) < 0), `${l.id}: in front of him, to one side`);
  }
  // the three watches are three pictures
  for (let i = 0; i < LAYOUTS.length; i++) for (const b of LAYOUTS.slice(i + 1)) {
    const a = LAYOUTS[i];
    assert.ok(dist(a.hide, b.hide) > 6 || off(a.hide.heading!, b.hide.heading!) > 0.6, `${a.id}–${b.id}: two different watches`);
  }
});

test('her bed is out of sight: a bush, a trunk or the copse\'s bracken between it and the hide, and it is off the line through her gap', () => {
  /** How far (m) the straight line from `a` to `b` runs inside a cover's bracken. */
  const inBracken = (c: typeof COPSE, a: Spot, b: Spot): number => {
    let n = 0;
    for (let k = 0; k <= 40; k++) if (inCover(c, toward(a, b, (dist(a, b) * k) / 40)) < 0.95) n += 1;
    return (n / 41) * dist(a, b);
  };
  for (const l of LAYOUTS) {
    const js = juniperSpots(l);
    const cover = [...js.map((j) => ({ x: j.x, z: j.z, r: juniperR(j.h) })), ...COPSE_TREES.map((t) => ({ x: t.x, z: t.z, r: 0.3 }))];
    const hidden = cover.some((c) => segDist(c, l.hide, l.bed) < c.r + 0.2 && dist(c, l.bed) < dist(l.hide, l.bed) && dist(c, l.bed) > 0.6);
    const bracken = inBracken(l.cover, l.hide, l.bed);
    assert.ok(hidden || bracken >= 1.5, `${l.id}: from the hide her bed is hidden (${bracken.toFixed(1)} m of bracken between)`);
    for (const eye of [l.search, ...calves(l)]) {
      const q = toLocal({ x: eye.x, z: eye.z, heading: headingTo(eye, l.gap) }, l.bed);
      assert.ok(Math.abs(q.u) > 0.8 || inBracken(l.cover, eye, l.bed) >= 1.5, `${l.id}: the bed is ${Math.abs(q.u).toFixed(2)} m off the line through the gap`);
    }
    // inside her cover, clear of the bushes and the trunks; her gap at its rim
    assert.ok(inCover(l.cover, l.bed) < 0.8, `${l.id}: the bed is in her cover`);
    assert.ok(Math.abs(inCover(l.cover, l.gap) - 1) < 0.35, `${l.id}: the gap is at her cover's rim`);
    for (const j of js) assert.ok(dist(j, l.bed) > juniperR(j.h) + 0.3, `${l.id}: the bed is not in a juniper`);
    for (const t of COPSE_TREES) assert.ok(dist(t, l.bed) > 1.0 && dist(t, l.gap) > 1.0, `${l.id}: trunks keep off her bed and her gap`);
    // her ways: from where she grazes straight into her bed (she slips in), and out of it
    // through her gap to the meeting place: round every bush and trunk
    const ways: [string, Spot, Spot][] = [
      ...l.graze.map((g, i): [string, Spot, Spot] => [`graze ${i}→${l.slip.length > 1 ? 'gap' : 'bed'}`, g, l.slip[0]]),
      ...l.slip.slice(1).map((q, i): [string, Spot, Spot] => [`slip ${i}`, l.slip[i], q]),
      ['bed→gap', l.bed, l.gap], ['gap→meet', l.gap, l.meet],
    ];
    for (const [name, a, z] of ways) {
      for (const j of js) assert.ok(segDist(j, a, z) > juniperR(j.h) + 0.05, `${l.id}: ${name} keeps off a juniper (${segDist(j, a, z).toFixed(2)} m)`);
      for (const t of COPSE_TREES) assert.ok(segDist(t, a, z) > 0.75, `${l.id}: ${name} keeps off a trunk (${segDist(t, a, z).toFixed(2)} m)`);
    }
    // and her way to the calf runs out on open heath, never through another stand
    for (const s of LAYOUTS) for (const k of [0, 0.25, 0.5, 0.75, 1]) {
      const p = toward(l.gap, l.meet, dist(l.gap, l.meet) * k);
      assert.ok(s === l || inGrass(s, p) > 1.05, `${l.id}: her way crosses ${s.id}'s grass`);
    }
  }
  // free roam: she slips into her bed in the copse
  const doe = REE_RESIDENTS.find((r) => r.key === 'doe')!;
  const before = doe.shy!.find((q) => q.state === 'before')!;
  assert.ok(dist(before.to, DOE_BED) < 1e-9 && before.lie, 'shy: she beds down in the copse');
});

test('the walks are free: no bush, log or trunk on his way, and round the pool stays dry', () => {
  const S = solids();
  for (const l of LAYOUTS) {
    const legs: [string, Spot, Spot][] = [
      ['ring→bend', l.wissel[0], l.wissel[1]], ['bend→search', l.wissel[1], l.wissel[2]],
      ...CALF_DOELEN.map((d, i): [string, Spot, Spot] => [`search→calf ${i}`, l.search, calfTalkOf(l, calfAt(l, d))]),
      ...l.way.slice(1).map((q, i): [string, Spot, Spot] => [`way ${i}`, l.way[i], q]),
      ['hide→leave', l.hide, l.hideLeave],
    ];
    for (const [name, a, b] of legs) {
      for (const s of S) assert.ok(segDist(s, a, b) > s.r, `${l.id}: ${name} passes ${segDist(s, a, b).toFixed(2)} m from a solid (r ${s.r})`);
    }
    // his way out of the grass to the hide never passes the calf, and keeps out of the
    // other stands
    for (const [i, d] of CALF_DOELEN.entries()) {
      const c = calfAt(l, d);
      const talk = calfTalkOf(l, c);
      assert.ok(segDist(c, talk, l.way[0]) > 0.9, `${l.id}${i}: he leaves the grass without passing the calf`);
    }
    for (const s of LAYOUTS) if (s !== l) for (let i = 1; i < l.way.length; i++) for (const k of [0, 0.25, 0.5, 0.75, 1]) {
      const p = toward(l.way[i - 1], l.way[i], dist(l.way[i - 1], l.way[i]) * k);
      assert.ok(inGrass(s, p) > 1.05, `${l.id}: his way to the hide keeps out of ${s.id}'s grass`);
    }
    for (const k of poolSides(l)) {
      const p = l.pools[k]!;
      // the pool lies across the way: straight on is in the water, ≥ 3 m from both ends
      const leg = k === 'in' ? [l.wissel[0], l.wissel[1], l.wissel[2]] : [...l.way];
      const ends = leg.map((q) => dist(q, p));
      const on = leg.slice(1).some((q, i) => segDist(p, leg[i], q) < 0.05);
      assert.ok(on, `${l.id}: the ${k} pool lies on the way`);
      const near = leg.slice(1).findIndex((q, i) => segDist(p, leg[i], q) < 0.05);
      assert.ok(dist(p, leg[near]) >= 2.4 && dist(p, leg[near + 1]) >= 2.4, `${l.id}: the ${k} pool is ${Math.min(...ends).toFixed(1)} m from an end of its leg`);
      // the way round (golden's hint, walked point to point from before it) stays dry
      const before = toward(p, leg[near], POOL.halfD + 2.2);
      const after = toward(p, leg[near + 1], POOL.halfD + 2.2);
      const round = [before, ...p.round, after];
      for (let i = 1; i < round.length; i++) {
        for (let t = 0; t <= 1; t += 0.05) {
          const q = { x: round[i - 1].x + (round[i].x - round[i - 1].x) * t, z: round[i - 1].z + (round[i].z - round[i - 1].z) * t };
          assert.ok(wet(p, q) > 1.2, `${l.id}: round the ${k} pool, not in it (leg ${i}, ${wet(p, q).toFixed(2)})`);
        }
      }
      for (const q of p.round) for (const s of S) assert.ok(dist(q, s) > s.r + 0.3, `${l.id}: the way round the ${k} pool is free`);
      for (const s of LAYOUTS) for (const q of p.round) assert.ok(inGrass(s, q) > 1.0, `${l.id}: the way round the ${k} pool keeps out of ${s.id}'s grass`);
      assert.ok(wet(p, p) < 0.01 && toLocal(p, p.edge).v < -POOL.halfD, `${l.id}: a boot steps back out to its near edge`);
      // the water is clear of the grass, the bushes, the copse
      for (const s of LAYOUTS) assert.ok(inGrass(s, p) > 1.15, `${l.id}: the ${k} pool is out of ${s.id}'s grass`);
      for (const s of S) assert.ok(dist(p, s) > POOL.halfW + s.r + 0.3, `${l.id}: the ${k} pool is clear of the solids`);
    }
  }
});

test('clear of the other missions, the frisling\'s home, the wildcamera\'s, the paths, the props and the roaming animals', () => {
  for (const p of everything()) {
    for (const [id, m] of Object.entries(OTHER_MARKERS)) {
      assert.ok(dist(p, m) >= 8 + p.r - 0.5, `${p.name} keeps 8 m from the ${id} marker (${dist(p, m).toFixed(1)})`);
    }
    for (const f of frislingHome()) assert.ok(dist(p, f) > 6, `${p.name} keeps 6 m from ${f.name} (${dist(p, f).toFixed(1)})`);
    for (const c of wildcameraClearings()) assert.ok(dist(p, c) > c.r + p.r + 1, `${p.name} keeps off the wildcamera's ground`);
    for (const q of PROPS) assert.ok(dist(p, q) > q.r + p.r + 0.3, `${p.name} is not on a prop at (${q.x}, ${q.z})`);
    for (const a of ROAMERS) assert.ok(dist(p, a) > a.r + p.r + 2, `${p.name} is off the ${a.id}'s wander loop`);
    assert.ok(distanceToNetwork(p.x, p.z) > LANE_HALF + p.r - 0.3, `${p.name} keeps off the paths (${distanceToNetwork(p.x, p.z).toFixed(1)} m)`);
  }
  // the marker ring (r 1.15) stays open: nothing of the home within 2.5 m of it (her wissel
  // runs through it)
  for (const p of everything().filter((q) => q.name !== 'marker' && !q.name.includes('.wissel-'))) {
    assert.ok(dist(p, MARKER) > 2.5 + p.r, `${p.name} keeps off the marker ring`);
  }
  // every stand, every pool spot and the heather worn off along every wissel are bare
  const cl = reeClearings();
  for (const l of LAYOUTS) {
    assert.ok(cl.some((c) => dist(c, l.frame) < 1e-9 && c.r >= STAND.halfW), `${l.id}: the stand is bare of heather`);
    for (const q of poolsOf(l)) assert.ok(cl.some((c) => dist(c, q) < 1e-9), `${l.id}: a pool spot is bare`);
    for (const p of wisselLine(l)) assert.ok(cl.some((c) => dist(c, p) < c.r - WISSEL_HALF), `${l.id}: no heather on her path`);
  }
  // the wildcamera's roe grazes on while he watches from any hide (its test pins A's)
  const roe = WILDCAMERA_RESIDENTS.find((r) => r.key === 'ree')!;
  const reach = (roe.before!.roam ?? 0.5) + ROE_SHY_WITHIN + 0.3;
  for (const l of LAYOUTS) for (const q of [l.hide, l.hideLeave, ...poolsOf(l).map((p) => p.edge)]) {
    assert.ok(dist(q, roe.before!) > reach, `${l.id}: ${dist(q, roe.before!).toFixed(1)} m from the wildcamera's roe`);
  }
  // the places table names every layout's places (the jeep is parked out of them all)
  for (const l of LAYOUTS) for (const k of ['stand', 'search', 'gap', 'meet', 'hide', 'poolIn']) assert.ok(P[`${l.id}.${k}`], `${l.id}.${k}`);
  // at least two layouts can have the pool on either walk (variety: the calm moment first or fourth)
  assert.ok(LAYOUTS.filter((l) => poolSides(l).length === 2).length >= 2);
  assert.ok(P.marker && P.home && P.hide && P.hideLeave && P.poolEdge);
  for (const l of LAYOUTS) {
    assert.ok(REE_HOME.spread!.some((s) => dist(s, l.frame) < 1e-9) && REE_HOME.spread!.some((s) => dist(s, l.hide) < 1e-9), `${l.id}: the home stays drawn by its stand and hide`);
  }
});

test('who lives here: the doe by the copse and her calf in the grass; after, the two together at home', () => {
  const doe = REE_RESIDENTS.find((r) => r.key === 'doe')!;
  const calf = REE_RESIDENTS.find((r) => r.key === 'calf')!;
  assert.equal(doe.animal, 'ree');
  assert.equal(calf.animal, 'reekalf');
  assert.ok(dist(doe.before!, COPSE_FRAME) < 6, 'she grazes by the copse');
  for (const r of [doe, calf]) assert.equal(r.reach, HOME_REACH, `${r.key} walks to a play's spot, never pops`);
  const before = doe.shy!.find((q) => q.state === 'before')!, after = doe.shy!.find((q) => q.state === 'after')!;
  assert.ok(before.back > before.within + 3, 'she comes out only once he is well off');
  // after, the two let him watch them from any hide (they step in only when he walks right up)
  for (const l of LAYOUTS) {
    assert.ok(after.within < dist(l.hide, doe.after!) - 1.5 && after.within < dist(l.hideLeave, doe.after!) - 1.5, `${l.id}: from the hide he can watch them`);
    // after the reunion they walk home (Residents walks within their reach, else a cut)
    assert.ok(dist(l.meet, P.home) <= HOME_REACH - 5, `${l.id}: their home is ${dist(l.meet, P.home).toFixed(1)} m from where they met`);
    // and from wherever a play laid them, they walk to where the next one lays them
    for (const m of LAYOUTS) for (const g of m.graze) assert.ok(dist(g, l.graze[0]) <= HOME_REACH - 5 && dist(g, P.home) <= HOME_REACH, `${l.id}→${m.id}: she walks to her next graze spot`);
  }
  const cs = calf.shy!.find((q) => q.state === 'after')!;
  assert.ok(dist(cs.to, DOE_BED) < 1.5 && cs.within === after.within, 'the calf goes in with her');
  assert.ok(dist(doe.after!, calf.after!) < 1.6, 'mother and calf together');
  for (const r of [doe, calf]) assert.ok(dist(r.after!, P.home) < 1.6, `${r.key} lives at the home place`);
  // home is open heath, out of every stand and every cover
  for (const l of LAYOUTS) assert.ok(inGrass(l, P.home) > 1.1, `home is out of ${l.id}'s grass`);
  for (const c of COVERS) assert.ok(inCover(c, P.home) > 1.15, 'home is out of the bracken');
  // a calf drinks at its mother's flank, head under her belly
  const d = drinkSpot({ ...doe.after!, yaw: 0 }, SIZE.ree.len);
  const dd = dist(d, doe.after!);
  assert.ok(dd > 0.25 && dd < 0.5, `it drinks ${dd.toFixed(2)} m from her middle`);
});

test('the framed views look at their place from the ranger\'s side, with him in the picture', () => {
  for (const l of LAYOUTS) {
    const v = l.views.search;
    assert.ok(v.include!.some((q) => dist(q, l.search) < 1e-9), `${l.id}: search: the ranger's spot is in the picture`);
    assert.ok(toLocal({ ...v.at, heading: v.heading }, l.search).v < -0.3, `${l.id}: search: he stands in front of what the view looks at`);
    for (const [i, d] of CALF_DOELEN.entries()) {
      const c = calfAt(l, d);
      // its back and flank face the searching eye
      assert.ok(Math.abs(Math.sin(c.yaw - v.heading)) > 0.6, `${l.id}${i}: search: its flank faces the lens`);
      // by the calf the lens looks over his shoulder at its flank: he stands nearer the
      // lens, to one side of it (never in front of it, never over it)
      const talk = calfTalkOf(l, c);
      const cv = calfView(l, c, talk);
      const cf = { ...cv.at, heading: cv.heading };
      const cr = toLocal(cf, talk), cc = toLocal(cf, c);
      assert.ok(cr.v < cc.v - 0.5 && Math.abs(cr.u - cc.u) > 0.5, `${l.id}${i}: calf: he stands nearer the lens, to one side`);
      assert.ok(cv.pitchDeg >= 34 && cv.pitchDeg <= 40, `${l.id}${i}: calf: a low lens (${cv.pitchDeg}°)`);
      // leaving the calf the lens ends behind him looking along his way out
      const first = toward(talk, l.way[0], 1.4);
      const lv = leaveView(first, l.way[0]);
      assert.ok(toLocal({ ...lv.at, heading: lv.heading }, first).v < -0.5, `${l.id}${i}: leave: he stands in front of the lens's patch`);
    }
    // the watch has no ranger in it: the lens looks from the hide's side at the scene
    const w = { ...l.views.watch.at, heading: l.views.watch.heading };
    const h = toLocal(w, l.hide);
    assert.ok(h.v < -5 && Math.abs(h.u) < 1, `${l.id}: the watch looks out from the hide`);
  }
  // the search views: he stands off to one side of every stand (a lower corner of the
  // picture: ree.view.test.ts measures it)
  for (const l of LAYOUTS) assert.ok(Math.abs(inStand(l, l.search).u) > 2, `${l.id}: he stands to one side`);
});
