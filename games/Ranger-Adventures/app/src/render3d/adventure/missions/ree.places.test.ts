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
  COPSE, THICKET, HOME_REACH, COPSE_TREES, CALF_DOELEN, DOE_BED, CALF_HOME, onStand, calfAt, calfTalkOf, calfBolt, calfView, leaveView, drinkSpot, reunionPose,
  inStand, reeClearings, slotTrail, wisselLine, juniperR, poolsOf, poolSides, walkVia, WISSEL_HALF, type ReeLayout, type PoolSpot,
  BIRCH, BIRCH_CLEAR, BIRCH_NEAR, BUZZARD, LARK, LARK_TURNS, TWIN_AFTER, heathFor, larkFlight, larkRoom, larkWays, twinAt,
} from './ree.places.ts';
import { FRISLING_PLACES, hideClumps, fieldSpots, cluePosts, bootPrints } from './frisling.places.ts';
import { WILDCAMERA_PLACES, WILDCAMERA_RESIDENTS, ROE_SHY_WITHIN, wildcameraClearings } from './wildcamera.places.ts';
import { anchorInBiome, biomeAt, VEN_CENTER } from '../../Biomes.ts';
import { distanceToNetwork, LANE_HALF } from '../../Paths.ts';
import { atLocal, dist, headingTo, segDist, toLocal, toward } from '../places.ts';
import { patchLocal } from '../../play/kit-math.ts';
import { GO_AWAY_M } from '../beats/hold-math.ts';
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
    const out = [l.bed, ...[...l.bedWay].reverse(), l.gap];
    const ways: [string, Spot, Spot][] = [
      ...l.graze.map((g, i): [string, Spot, Spot] => [`graze ${i}→${l.slip.length > 1 ? 'gap' : 'bed'}`, g, l.slip[0]]),
      ...l.slip.slice(1).map((q, i): [string, Spot, Spot] => [`slip ${i}`, l.slip[i], q]),
      ...out.slice(1).map((q, i): [string, Spot, Spot] => [`bed→gap ${i}`, out[i], q]), ['gap→meet', l.gap, l.meet],
    ];
    assert.deepEqual(l.slip.slice(-1 - l.bedWay.length, -1), [...l.bedWay], `${l.id}: she slips in the way she comes out`);
    for (const [name, a, z] of ways) {
      // (with room for her turning: she walks round a bush, never into it and stuck)
      for (const j of js) assert.ok(segDist(j, a, z) > juniperR(j.h) + (l.cover === COPSE ? 0.05 : 0.4), `${l.id}: ${name} keeps off a juniper (${segDist(j, a, z).toFixed(2)} m)`);
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

test('a perfect player\'s way (golden\'s hint) walks round this play\'s pool, in order, dry', () => {
  for (const l of LAYOUTS) for (const k of poolSides(l)) {
    const pool = l.pools[k]!;
    const walk = k === 'in' ? 'meadow' : 'hide';
    // from where the walk starts, through its via, to its goal
    const starts = walk === 'meadow' ? [l.wissel[0]] : CALF_DOELEN.map((d) => calfTalkOf(l, calfAt(l, d)));
    const goal = walk === 'meadow' ? l.search : l.hide;
    const via = walkVia(l, walk, pool);
    const at = via.findIndex((q) => dist(q, pool.round[0]) < 1e-9);
    assert.ok(at >= 0 && pool.round.every((q, i) => dist(via[at + i], q) < 1e-9), `${l.id} ${k}: the way round is in the hint`);
    for (const s of starts) {
      const line = [s, ...via, goal];
      for (let i = 1; i < line.length; i++) for (let t = 0; t <= 1; t += 0.05) {
        const q = { x: line[i - 1].x + (line[i].x - line[i - 1].x) * t, z: line[i - 1].z + (line[i].z - line[i - 1].z) * t };
        assert.ok(wet(pool, q) > 1.0, `${l.id} ${k}: the hint's way runs through the pool (leg ${i}, ${wet(pool, q).toFixed(2)})`);
      }
    }
    // the other walk's way leaves the pool out (it is not there this play)
    const other = walkVia(l, walk === 'meadow' ? 'hide' : 'meadow', null);
    assert.ok(other.every((q) => !pool.round.some((r) => dist(q, r) < 1e-9)), `${l.id} ${k}: only one walk goes round it`);
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

test('run 7: "Loop stil weg" — his way out leads away from the family, free, to open heath near the marker or their home', () => {
  const S = solids();
  for (const l of LAYOUTS) {
    const w = l.wayOut;
    const way = [l.hide, ...l.outWay, w];
    const m = length(way);
    // (a walk of 5-10 m: the moment is answered after 4 m away; B's hide stands at the forest's
    // edge with the copse beside it, so its way out is the shortest)
    assert.ok(m >= 5 && m <= 10, `${l.id}: his way out is ${m.toFixed(1)} m`);
    assert.ok(dist(w, l.meet) >= dist(l.hide, l.meet) + 2, `${l.id}: it leads away from the family (${dist(l.hide, l.meet).toFixed(1)} → ${dist(w, l.meet).toFixed(1)} m)`);
    // walked 4 m along it (the moment's "away", GoCore), he is clearly farther from them
    let left = GO_AWAY_M, at4: Spot = w;
    for (let i = 1; i < way.length; i++) {
      const seg = dist(way[i - 1], way[i]);
      if (seg >= left) { at4 = toward(way[i - 1], way[i], left); break; }
      left -= seg;
    }
    assert.ok(dist(at4, l.hide) >= GO_AWAY_M - 0.6 && dist(at4, l.meet) >= dist(l.hide, l.meet) + 0.8, `${l.id}: 4 m along his way out he is ${dist(at4, l.meet).toFixed(1)} m from them`);
    // every point of it at least as far from the family as the hide, and 4 m on, 0.5 m farther
    for (let i = 1; i < way.length; i++) for (const k of [0, 0.25, 0.5, 0.75, 1]) {
      const p = toward(way[i - 1], way[i], dist(way[i - 1], way[i]) * k);
      assert.ok(dist(p, l.meet) >= dist(l.hide, l.meet) - 0.3, `${l.id}: his way out never leads toward them`);
      for (const s of S) assert.ok(segDist(s, way[i - 1], way[i]) > s.r + 0.15, `${l.id}: his way out passes a solid`);
      for (const s of LAYOUTS) assert.ok(inGrass(s, p) > 1.05, `${l.id}: his way out keeps out of ${s.id}'s grass`);
      for (const c of COVERS) assert.ok(inCover(c, p) > 1.05, `${l.id}: his way out keeps out of the bracken`);
      for (const s of LAYOUTS) for (const q of poolsOf(s)) assert.ok(wet(q, p) > 1.3, `${l.id}: his way out keeps out of a pool`);
      assert.equal(biomeAt(p.x, p.z), 'heide', `${l.id}: his way out is on the heath`);
    }
    // (≤ 11 m: where he really stops, up to ~1 m off it, stays within missions.spec's 12 —
    // and he stops where the moment is answered, 4 m along it, as often as at its end)
    for (const q of [w, at4]) {
      const end = Math.min(dist(q, P.home), dist(q, MARKER));
      assert.ok(end <= 11, `${l.id}: he ends ${end.toFixed(1)} m from the marker or their home`);
    }
    assert.ok(P[`${l.id}.wayOut`] && dist(P[`${l.id}.wayOut`], w) < 1e-9, `${l.id}.wayOut is in the places table`);
    assert.ok(Math.abs(w.heading! - headingTo(w, l.meet)) < 1e-9, `${l.id}: at his way out he faces back toward them`);
  }
});

test('run 7: the watch — she wanders by a point out on open heath in the picture, never toward the lens', () => {
  const js = juniperSpots();
  for (const l of LAYOUTS) {
    const wv = { ...l.views.watch.at, heading: l.views.watch.heading };
    const way = [l.gap, ...l.watchWay, l.meet];
    assert.ok(length(way) >= 3.2 && length(way) <= 6, `${l.id}: her walk in the watch is ${length(way).toFixed(1)} m`);
    for (const p of l.watchWay) {
      const q = toLocal(wv, p);
      assert.ok(Math.abs(q.u) <= l.views.watch.halfW - 0.4 && Math.abs(q.v) <= l.views.watch.halfD + 0.3, `${l.id}: the point is in the watch's picture (u ${q.u.toFixed(1)}, v ${q.v.toFixed(1)})`);
      assert.ok(dist(p, l.hide) >= Math.min(dist(l.gap, l.hide), dist(l.meet, l.hide)) - 0.4, `${l.id}: she never walks toward the lens`);
      assert.equal(biomeAt(p.x, p.z), 'heide');
    }
    for (let i = 1; i < way.length; i++) {
      for (const j of js) assert.ok(segDist(j, way[i - 1], way[i]) > juniperR(j.h) + 0.25, `${l.id}: her way in the watch keeps off a juniper`);
      for (const t of COPSE_TREES) assert.ok(segDist(t, way[i - 1], way[i]) > 0.9, `${l.id}: her way in the watch keeps off a trunk`);
      for (const k of [0, 0.25, 0.5, 0.75, 1]) {
        const p = toward(way[i - 1], way[i], dist(way[i - 1], way[i]) * k);
        for (const s of LAYOUTS) assert.ok(inGrass(s, p) > 1.0, `${l.id}: her way in the watch keeps out of ${s.id}'s grass`);
        if (i > 1 || k > 0.3) for (const c of COVERS) assert.ok(inCover(c, p) > 1.0, `${l.id}: out on the heath, out of the bracken`);
      }
    }
  }
});

test('run 7: the reunion looks at them from his side, away from the clearing and the wildcamera\'s glade', () => {
  const half = Math.atan(Math.tan((27.5 * Math.PI) / 180) * 1.6);
  for (const l of LAYOUTS) {
    const v = l.views.reunion;
    assert.ok(dist(v.at, l.meet) < 0.6, `${l.id}: the reunion frames the meeting place`);
    assert.ok(off(v.heading, headingTo(l.wayOut, l.meet)) <= (20 * Math.PI) / 180, `${l.id}: it looks from where he stands`);
    const cabin = off(v.heading, headingTo(v.at, { x: 0, z: 0 }));
    assert.ok(cabin > half + 0.35, `${l.id}: the clearing is out of the reunion's picture`);
    for (const k of ['glade', 'home'] as const) assert.ok(off(v.heading, headingTo(l.meet, WILDCAMERA_PLACES[k])) > half + 0.2, `${l.id}: the wildcamera's ${k} is out of it`);
    const roe = WILDCAMERA_RESIDENTS.find((r) => r.key === 'ree')!.before!;
    assert.ok(off(v.heading, headingTo(l.meet, roe)) > half + 0.2, `${l.id}: the wildcamera's roe is out of the reunion`);
    // the doe side-on to it, facing on along her way from her gap; her calf on the lens's side
    const { yaw, side } = reunionPose(l);
    assert.ok(Math.abs(Math.cos(yaw - v.heading)) < 1e-9, `${l.id}: side-on`);
    assert.ok(Math.cos(yaw - headingTo(l.gap, l.meet)) >= -1e-9, `${l.id}: she faces on, not back into her cover`);
    assert.ok(side === 1 || side === -1);
  }
});

/* ------------------------------------------------- ree-discover: something to notice ---- */

/** Every way a layout's walks may take (golden's hint, with or without its pool), and his
 *  way out of the hide: what a young birch keeps off. */
const waysOf = (l: ReeLayout): Spot[][] => [
  [P.marker, ...walkVia(l, 'meadow', l.pools.in), l.search], [P.marker, ...walkVia(l, 'meadow', null), l.search],
  [...walkVia(l, 'hide', null), l.hide], ...(l.pools.out ? [[...walkVia(l, 'hide', l.pools.out), l.hide]] : []),
  [l.hide, ...l.outWay, l.wayOut], wisselLine(l),
];
const polyDist = (p: Spot, w: readonly Spot[]): number => Math.min(...w.slice(1).map((q, i) => segDist(p, w[i], q)));

test('ree-discover: the rubbed young birch stands beside his way, in his picture as he walks up, off every way of its layout', () => {
  for (const l of LAYOUTS) {
    assert.ok(l.birches.length >= 1 && l.birches.length <= 2, `${l.id}: ${l.birches.length} birch spot(s)`);
    for (const [i, b] of l.birches.entries()) {
      const tag = `${l.id}.birch${i}`;
      assert.equal(biomeAt(b.x, b.z), 'heide', `${tag} on the heath`);
      // off every way the layout's walks take (a detour he may take, never in his way)
      for (const w of waysOf(l)) assert.ok(polyDist(b, w) >= 1.8, `${tag} is ${polyDist(b, w).toFixed(1)} m from a way of ${l.id}`);
      // …and near one of them: seen ahead as he walks up (≤ 30° off his way, 6-10 m before it)
      const near = waysOf(l).slice(0, -2).filter((w) => polyDist(b, w) <= 3.6);
      assert.ok(near.length, `${tag} lies beside a walk`);
      const seen = near.some((w) => w.slice(1).some((q, j) => {
        const a = w[j], L = dist(a, q);
        for (let t = 0; t <= L; t += 0.5) {
          const at = toward(a, q, t);
          if (dist(at, b) < 6 || dist(at, b) > 10) continue;
          if (off(headingTo(at, b), headingTo(a, q)) < 0.5) return true;
        }
        return false;
      }));
      assert.ok(seen, `${tag} is ahead of him on a walk`);
      // clear: out of every stand, cover and pool, a stride from every solid, not where she
      // grazes, they meet or he walks away to
      for (const m of LAYOUTS) assert.ok(inGrass(m, b) > 1.2, `${tag} out of ${m.id}'s grass`);
      for (const c of COVERS) assert.ok(inCover(c, b) > 1.1, `${tag} out of the bracken`);
      for (const m of LAYOUTS) for (const q of poolsOf(m)) assert.ok(wet(q, b) > 2.5, `${tag} out of a pool`);
      for (const q of solids()) assert.ok(dist(b, q) > q.r + 0.9, `${tag} by a solid at (${q.x.toFixed(1)}, ${q.z.toFixed(1)})`);
      for (const g of l.graze) assert.ok(dist(b, g) > 2, `${tag} where she grazes`);
      assert.ok(dist(b, l.meet) > 3 && dist(b, l.wayOut) > 2.5 && dist(b, P.home) > 3, `${tag} where the family meets or lives`);
      assert.ok(dist(b, MARKER) > 4, `${tag} off the marker ring`);
      // the places table names it (the jeep is parked out of it) and its ground is bare
      assert.ok(dist(P[tag], b) < 1e-9, `${tag} in the places table`);
      assert.ok(reeClearings().some((c) => dist(c, b) < 1e-9 && c.r === BIRCH_CLEAR), `${tag} is the home's ground`);
    }
  }
  assert.ok(BIRCH.h >= 1.2 && BIRCH.h <= 1.6, 'a young birch about his height');
  assert.ok(BIRCH_NEAR >= 2 && BIRCH_NEAR <= 3, 'he sees its marks from close by');
});

test('ree-discover: the woodlark flies up ahead of him, on along his way and back down, never toward the lens; every walk has room for it', () => {
  // its flight in his frame: ahead and further ahead, a little to one side, up and down again
  const order = [LARK.rise.v, LARK.top.v, LARK.drift.v, LARK.land.v];
  assert.ok(order.every((v, i) => i === 0 || v > order[i - 1]), 'always on, away from him (and the lens behind him)');
  assert.ok(LARK.rise.v >= 6 && LARK.rise.v <= 10, 'it flies up 6-10 m ahead of him');
  assert.ok(LARK.top.y >= 3 && LARK.drift.y <= 6, 'it hangs low enough for the walk\'s lens to see it');
  assert.ok(LARK.hangS >= 3.5, 'it hangs singing ~4 s');
  assert.ok(Math.max(...LARK_TURNS) <= 0.5, 'off his way at most ~30°: in the walk\'s picture');
  for (const l of LAYOUTS) {
    assert.ok(l.larkOn.length >= 1, `${l.id}: the woodlark comes on a walk`);
    for (const [walk, pool] of ([['meadow', l.pools.in], ['meadow', null], ['hide', null], ['hide', l.pools.out ?? null]] as const).filter(([wk]) => l.larkOn.includes(wk))) {
      const w = walk === 'meadow' ? [P.marker, ...walkVia(l, 'meadow', pool), l.search] : [...walkVia(l, 'hide', pool), l.hide];
      // he walks along it: from 3 m in, the flight's room is checked where he is, facing along
      let room = 0, tried = 0, left = 0;
      const total = w.slice(1).reduce((sum, q, i) => sum + dist(w[i], q), 0);
      let walked = 0;
      for (let j = 1; j < w.length; j++) {
        const a = w[j - 1], b = w[j];
        for (let t = 0; t < dist(a, b); t += 0.5) {
          const at = toward(a, b, t);
          if (dist(at, w[0]) < 3) continue;
          tried += 1;
          const ahead = total - walked - t;
          for (const way of larkWays(1)) {
            const side = way.side, h = headingTo(a, b) + side * way.turn;
            if (!larkRoom(at, h, side, pool)) continue;
            room += 1;
            left = Math.max(left, ahead);
            const f = larkFlight(at, h, side);
            // where it sits is open heath, never in the tall grass or the bracken or the water
            for (const q of [f.rise, f.land]) assert.ok(heathFor(q, pool), `${l.id} ${walk}: it sits in the heather`);
            // never toward the lens: every point further from where he stood than the last
            const ds = [f.rise, f.top, f.drift, f.land].map((q) => dist(q, at));
            assert.ok(ds.every((d, i) => i === 0 || d > ds[i - 1]), `${l.id} ${walk}: it flies away from him`);
            break;
          }
        }
        walked += dist(a, b);
      }
      // (it flies up where there is room as he walks on: somewhere on every walk, with a
      // good stretch of it still ahead of him, so he sees it while he walks)
      assert.ok(room >= 3, `${l.id} ${walk}${pool ? ' (pool)' : ''}: room for the woodlark at ${room} of ${tried} points`);
      assert.ok(left >= 6, `${l.id} ${walk}${pool ? ' (pool)' : ''}: it flies with ${left.toFixed(1)} m of the walk ahead`);
    }
  }
});

test('ree-discover: the buzzard circles low over the heath ahead of him on his way to the hide, over the home', () => {
  for (const l of LAYOUTS) {
    const c = l.buzzard;
    assert.ok(Math.hypot(c.x, c.z) + c.r < 56, `${l.id}: its circle is inside the world`);
    assert.ok(dist(c, COPSE_FRAME) < 30, `${l.id}: over the home (${dist(c, COPSE_FRAME).toFixed(1)} m from the copse)`);
    for (const [id, m] of Object.entries(OTHER_MARKERS)) assert.ok(dist(c, m) > c.r + 4, `${l.id}: it keeps off the ${id} marker`);
    assert.ok(Math.hypot(c.x - VEN_CENTER.x, c.z - VEN_CENTER.z) > 25, `${l.id}: not over the ven`);
    // ahead of him all the way from the grass to the hide (beyond the hide)
    assert.ok(off(headingTo(l.search, c), headingTo(l.search, l.hide)) < 0.35, `${l.id}: it circles ahead of him`);
    assert.ok(dist(l.search, c) > dist(l.search, l.hide), `${l.id}: beyond his hide`);
  }
  assert.ok(BUZZARD.y >= 4 && BUZZARD.y <= 7 && BUZZARD.high > 15, 'low over the heath, come down from high');
});

test('ree-discover: the cuckoo calls from off to one side of the watch, never from behind him; the twin lies in her cover by her gap', () => {
  for (const l of LAYOUTS) {
    const v = l.views.watch;
    const a = off(headingTo(l.hide, l.koekoek), v.heading);
    assert.ok(a >= (45 * Math.PI) / 180 && a <= (110 * Math.PI) / 180, `${l.id}: the cuckoo ${(a * 180 / Math.PI).toFixed(0)}° off the watch`);
    const d = dist(l.hide, l.koekoek);
    assert.ok(d >= 15 && d <= 32 && Math.hypot(l.koekoek.x, l.koekoek.z) < 56, `${l.id}: the cuckoo ${d.toFixed(1)} m off, inside the world`);
    // the twin: in her cover's bracken, near her gap, clear of her bed, her way in and the bushes
    const t = l.twinBed;
    assert.ok(inCover(l.cover, t) < 0.9, `${l.id}: the twin lies in the bracken (${inCover(l.cover, t).toFixed(2)})`);
    assert.ok(dist(t, l.gap) < 3, `${l.id}: by her gap`);
    assert.ok(dist(t, l.bed) > 1.2, `${l.id}: apart from her bed`);
    for (const w of [[l.gap, ...l.bedWay, l.bed]]) assert.ok(polyDist(t, w) > 0.9, `${l.id}: off her way in`);
    for (const j of l.cover.junipers) assert.ok(dist(t, j) > juniperR(j.h), `${l.id}: not in a juniper`);
    for (const q of COPSE_TREES) assert.ok(l.cover !== COPSE || dist(t, q) > 0.75, `${l.id}: not on a trunk`);
  }
  // after a play with twins, the twin grazes with them at home and has its own bed in the copse
  const twin = REE_RESIDENTS.find((r) => r.key === 'twin')!;
  assert.equal(twin.animal, 'reekalf');
  assert.equal(twin.before, null, 'there only in a play that has it');
  assert.equal(twin.reach, HOME_REACH);
  assert.ok(dist(TWIN_AFTER, P.home) < 1.6, 'it lives at the home place');
  const calf = REE_RESIDENTS.find((r) => r.key === 'calf')!;
  assert.ok(dist(TWIN_AFTER, calf.after!) > 0.9, 'beside its sibling, never in it');
  const bed = twin.shy![0].to;
  assert.ok(inCover(COPSE, bed) < 0.85 && dist(bed, DOE_BED) > 1.4 && dist(bed, REE_RESIDENTS.find((r) => r.key === 'calf')!.shy![0].to) > 0.9, 'its own bed in the copse');
  for (const j of COPSE.junipers) assert.ok(dist(bed, j) > juniperR(j.h), 'its bed is not in a juniper');
  // at the reunion it stands at her chest on his side, apart from its sibling at her flank
  const doe = { x: 0, z: 0, yaw: 0.3 };
  for (const side of [1, -1] as const) {
    const tw = twinAt(doe, SIZE.ree.len, side), dr = drinkSpot(doe, SIZE.ree.len, side);
    assert.ok(dist(tw, dr) > 0.6, 'two calves, apart');
    assert.ok(toLocal({ ...doe, heading: doe.yaw }, tw).u * side > 0.3, 'on the side he sees');
  }
});
