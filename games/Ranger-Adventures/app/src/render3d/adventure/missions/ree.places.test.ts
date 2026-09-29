/**
 * ree.places.test.ts — where "Het reekalf in het gras" happens is chosen by looking at
 * the world; this pins that it stays a good place (design run6-missions §3.4, §4.2):
 * dry heath inside the world, clear of the paths, the props, the other markers and the
 * frisling's home, the story readable from the marker (the mother grazing beyond her
 * shy distance), the hide looking ACROSS her way back, the pool on the way to the hide,
 * her bed out of sight. Run: `npm test`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  REE_PLACES as P, REE_RESIDENTS, REE_HOME, MARKER, MEADOW, MEADOW_FRAME, CALF_SPOT, CALF_AT, COPSE_FRAME, COPSE_GAP,
  DOE_BED, JUNIPERS, COPSE_TREES, HIDE_FRAME, HIDE_JUNIPER, HIDE_LOG, POOL, POOL_ROUND, POOL_IN,
  SEARCH_VIEW, CALF_VIEW, POOL_VIEW, WATCH_VIEW, onMeadow, reeClearings, slotTrail, calfBolt, drinkSpot, inMeadow, alongLog,
  juniperR, MEET,
} from './ree.places.ts';
import {
  FRISLING_PLACES, hideClumps, fieldSpots, cluePosts, bootPrints,
} from './frisling.places.ts';
import { anchorInBiome, biomeAt, VEN_CENTER } from '../../Biomes.ts';
import { distanceToNetwork, LANE_HALF } from '../../Paths.ts';
import { atLocal, dist, headingTo, segDist, toLocal } from '../places.ts';
import { AREA_VELUWE } from '../../../content/veluwe.ts';
import { SIZE } from '../../AnimalScale.ts';

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

const juniperSpots = (): { x: number; z: number; h: number }[] => [
  ...JUNIPERS.map((j) => ({ ...atLocal(COPSE_FRAME, j.u, j.v), h: j.h })),
  { x: HIDE_JUNIPER.x, z: HIDE_JUNIPER.z, h: HIDE_JUNIPER.h },
];

const everything = (): { name: string; x: number; z: number; r: number }[] => [
  ...Object.entries(P).map(([name, p]) => ({ name, x: p.x, z: p.z, r: 0.5 })),
  // the meadow's tall grass (its search ellipse and the looser fringe round it)
  ...Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    return { name: `meadow-rim-${i}`, ...atLocal(MEADOW_FRAME, (MEADOW.halfW + 0.45) * 1.47 * Math.cos(a), (MEADOW.halfD + 0.4) * 1.47 * Math.sin(a)), r: 0.35 };
  }),
  // the copse: its bracken (an ellipse 3.9 × 3.1), junipers and trees
  ...Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    return { name: `copse-rim-${i}`, ...atLocal(COPSE_FRAME, 3.9 * Math.cos(a), 3.1 * Math.sin(a)), r: 0.4 };
  }),
  ...juniperSpots().map((j, i) => ({ name: `juniper-${i}`, x: j.x, z: j.z, r: juniperR(j.h) })),
  ...COPSE_TREES.map((t, i) => ({ name: `tree-${i}`, x: t.x, z: t.z, r: 0.7 })),
  { name: 'log', x: HIDE_LOG.x, z: HIDE_LOG.z, r: 1.1 },
  { name: 'pool', x: POOL.x, z: POOL.z, r: POOL.halfW + 0.55 },
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
});

test('every place is dry heath inside the world', () => {
  for (const p of everything()) {
    assert.equal(biomeAt(p.x, p.z), 'heide', `${p.name} is on the heath`);
    assert.ok(Math.hypot(p.x, p.z) < 60, `${p.name} is well inside the world`);
    assert.ok(Math.hypot(p.x - VEN_CENTER.x, p.z - VEN_CENTER.z) > 25, `${p.name} is far from the ven`);
  }
});

test('the story reads from the marker: the meadow 6-10 m on, the mother grazing by the copse beyond it', () => {
  const doe = REE_RESIDENTS.find((r) => r.key === 'doe')!;
  const m = dist(MARKER, P.meadow), c = dist(MARKER, P.copse), d = dist(MARKER, doe.before!);
  assert.ok(m >= 6 && m <= 10, `the meadow is ${m.toFixed(1)} m from the marker`);
  assert.ok(c >= 12 && c <= 22, `the copse is ${c.toFixed(1)} m from the marker`);
  assert.ok(d >= 10, `the mother grazes ${d.toFixed(1)} m from the marker`);
  // at the marker she keeps grazing (beyond her shy distance, with room to spare)
  const shy = doe.shy!.find((q) => q.state === 'before')!;
  assert.ok(d > shy.within + 2.5, `she grazes ${d.toFixed(1)} m from the marker (shy within ${shy.within} m)`);
  // walking on from the marker toward the meadow, she is right ahead: he sees her go
  // from the ring she is seen BESIDE the meadow's tall grass (never behind it), and near
  // enough the way he walks that he sees her go
  const off = Math.abs(((headingTo(MARKER, doe.before!) - headingTo(MARKER, P.meadow) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
  const grassHalf = Math.atan2((MEADOW.halfW + 0.45) * 1.2, dist(MARKER, P.meadow));
  assert.ok(off > grassHalf + 0.05 && off < 0.8, `the mother is ${(off * 57.3).toFixed(0)}° off the meadow (its grass spans ±${(grassHalf * 57.3).toFixed(0)}°)`);
  // coming up from the clearing to the marker, he never comes within her shy distance
  assert.ok(segDist(doe.before!, { x: 0, z: 0 }, MARKER) > shy.within + 1, 'the way in keeps her grazing');
});

test('the calf lies in the meadow where the trial says (content doel 48, 60), the decoys round it', () => {
  const mission = AREA_VELUWE.missies.find((x) => x.id === 'ree-niet-aanraken')!;
  const doel = mission.stappen[0].skin.doel!;
  assert.deepEqual({ x: doel.x, y: doel.y }, { x: CALF_AT.x, y: CALF_AT.y });
  assert.ok(dist(onMeadow(doel.x, doel.y), CALF_SPOT) < 1e-9);
  const l = inMeadow(CALF_SPOT);
  assert.ok(Math.abs(l.u) <= MEADOW.halfW && Math.abs(l.v) <= MEADOW.halfD, 'inside the meadow');
  const before = REE_RESIDENTS.find((r) => r.key === 'calf')!.before!;
  assert.ok(dist(before, CALF_SPOT) < 1e-9 && before.idle === 'lie', 'it lies there, pressed flat');
  for (const d of mission.stappen[0].skin.distractors ?? []) {
    assert.ok(dist(onMeadow(d.x, d.y), CALF_SPOT) > 0.45, `decoy ${d.id} is not on top of it`);
  }
  // the doe's prints end at the meadow's edge, never at the calf
  const t = slotTrail();
  assert.ok(dist(t.to, CALF_SPOT) > 2, `the prints end ${dist(t.to, CALF_SPOT).toFixed(1)} m from the calf`);
  assert.ok(dist(t.from, MARKER) < 1.5 && dist(t.to, P.meadowApproach) < 1, 'from the ring to the meadow');
  assert.ok(dist(P.meadowApproach, CALF_SPOT) > 2.4, 'the search starts from the meadow\'s edge');
  // a startled calf bolts a few metres to the side, stays in the meadow, never at him
  const b = calfBolt();
  const bd = dist(b, CALF_SPOT);
  assert.ok(bd > 1.4 && bd < 2.5, `it bolts ${bd.toFixed(1)} m`);
  assert.ok(dist(b, P.calfTalk) > dist(CALF_SPOT, P.calfTalk), 'away from him, not toward him');
  const bl = inMeadow(b);
  assert.ok(Math.abs(bl.u) <= MEADOW.halfW + 0.3 && Math.abs(bl.v) <= MEADOW.halfD + 0.3, 'in the tall grass');
  // he stands by it to talk, not on it
  const t2 = dist(P.calfTalk, CALF_SPOT);
  assert.ok(t2 > 1.2 && t2 < 1.6, `he stands ${t2.toFixed(2)} m from it`);
});

test('the hide looks across the meadow at the copse: her way back runs across its view', () => {
  const doe = REE_RESIDENTS.find((r) => r.key === 'doe')!;
  const h = dist(P.hide, P.meadow);
  assert.ok(h >= 7 && h <= 18, `the hide is ${h.toFixed(1)} m from the meadow`);
  // both the calf and the copse's gap are in front of the hide, within one view
  for (const [name, q] of [['calf', CALF_SPOT], ['gap', COPSE_GAP]] as const) {
    const l = toLocal(HIDE_FRAME, q);
    assert.ok(l.v > 6 && Math.abs(Math.atan2(l.u, l.v)) < 0.62, `${name} is ahead in the hide's view`);
  }
  // her walk from the gap to the calf: across the view, never toward the lens
  const walk = headingTo(COPSE_GAP, CALF_SPOT);
  const along = Math.cos(walk - HIDE_FRAME.heading);
  assert.ok(Math.abs(along) < 0.5, `her way back is across the view (cos ${along.toFixed(2)})`);
  // they meet on open heath out of the tall grass, in the middle of the watch
  const ml = inMeadow(MEET);
  const e = (ml.u / (MEADOW.halfW + 0.45)) ** 2 + (ml.v / (MEADOW.halfD + 0.4)) ** 2;
  assert.ok(Math.sqrt(e) > 1.3, `they meet out of the grass (${Math.sqrt(e).toFixed(2)} × its size)`);
  assert.ok(segDist(MEET, CALF_SPOT, COPSE_GAP) < 0.05 && dist(MEET, COPSE_GAP) > 1, 'between the calf and her gap');
  for (const j of juniperSpots()) assert.ok(dist(j, MEET) > juniperR(j.h) + 0.5, 'clear of the bushes');
  const wl = toLocal({ x: WATCH_VIEW.at.x, z: WATCH_VIEW.at.z, heading: WATCH_VIEW.heading }, MEET);
  assert.ok(Math.abs(wl.u) < WATCH_VIEW.halfW * 0.6, 'the meeting is near the middle of the watch');
  // the pool lies on the straight way from the calf to the hide
  assert.ok(segDist(POOL, P.calfTalk, P.hide) < 0.3, 'the pool is on the way');
  assert.ok(dist(P.calfTalk, POOL) > 3 && dist(P.hide, POOL) > 3, 'about half way');
  // "loop rustig weg": his steps back out of the hide take him away from the family
  assert.ok(dist(P.hideLeave, CALF_SPOT) > dist(P.hide, CALF_SPOT) + 1, 'the quiet steps lead away');
  // and he ends near the family's home (the world's step-8 bar: ≤ 12 m)
  assert.ok(dist(P.hideLeave, P.home) < 12.5 && dist(P.hide, P.home) < 11.5, `he ends ${dist(P.hideLeave, P.home).toFixed(1)} m from their home`);
});

test('her bed is out of sight: behind a juniper and not in line with the gap', () => {
  // seen from the meadow the bed is off the line through the gap
  for (const eye of [P.meadowApproach, P.calfTalk, CALF_SPOT]) {
    const l = toLocal({ x: eye.x, z: eye.z, heading: headingTo(eye, COPSE_GAP) }, DOE_BED);
    assert.ok(Math.abs(l.u) > 0.8, `the bed is ${Math.abs(l.u).toFixed(2)} m off the line through the gap`);
  }
  // seen from the hide a juniper stands between
  const js = juniperSpots();
  const hidden = js.some((j) => segDist(j, P.hide, DOE_BED) < juniperR(j.h) + 0.2 && dist(j, DOE_BED) < dist(P.hide, DOE_BED));
  assert.ok(hidden, 'from the hide a juniper hides the bed');
  // she fits through the gap and lies clear of the bushes and the trunks
  const [j1, j2] = js;
  assert.ok(dist(j1, j2) - juniperR(j1.h) - juniperR(j2.h) > 1.1, 'the gap between the front junipers is wide enough');
  for (const j of js) assert.ok(dist(j, DOE_BED) > juniperR(j.h) + 0.3, 'the bed is not in a juniper');
  for (const t of COPSE_TREES) assert.ok(dist(t, DOE_BED) > 1.2 && dist(t, COPSE_GAP) > 1.2, 'trunks keep off her way');
  // her ways: from where she grazes straight into her bed (free roam, and when he walks
  // up), and out of it through the gap to her calf — round every bush and trunk
  const doe = REE_RESIDENTS.find((r) => r.key === 'doe')!;
  const ways: [string, { x: number; z: number }, { x: number; z: number }][] = [
    ['graze→bed', doe.before!, DOE_BED], ['bed→gap', DOE_BED, COPSE_GAP], ['gap→calf', COPSE_GAP, CALF_SPOT],
  ];
  for (const [name, a, b] of ways) {
    for (const j of js) assert.ok(segDist(j, a, b) > juniperR(j.h) + 0.05, `${name} keeps off a juniper (${segDist(j, a, b).toFixed(2)} m)`);
    for (const t of COPSE_TREES) assert.ok(segDist(t, a, b) > 0.75, `${name} keeps off a trunk (${segDist(t, a, b).toFixed(2)} m)`);
  }
  for (const j of js) assert.ok(dist(j, doe.before!) > juniperR(j.h) + 0.4, 'she grazes clear of the bushes');
});

test('the walks are free: no bush, log or trunk on his way', () => {
  const solids = [
    ...juniperSpots().map((j) => ({ x: j.x, z: j.z, r: juniperR(j.h) })),
    ...COPSE_TREES.map((t) => ({ x: t.x, z: t.z, r: 0.75 })),
    // the log: a row of circles along its length (it lies across, in front of the hide)
    ...[-1, -0.5, 0, 0.5, 1].map((k) => ({ ...alongLog(k), r: 0.4 })),
  ];
  const legs: [string, { x: number; z: number }, { x: number; z: number }][] = [
    ['marker→meadow', MARKER, P.meadowApproach],
    ['meadow→calf', P.meadowApproach, P.calfTalk],
    ['calf→pool', P.calfTalk, P.poolEdge],
    ['pool edge→round', P.poolEdge, POOL_ROUND[0]],
    ['round', POOL_ROUND[0], POOL_ROUND[1]],
    ['round→far edge', POOL_ROUND[1], POOL_ROUND[2]],
    ['far edge→hide', POOL_ROUND[2], P.hide],
    ['hide→leave', P.hide, P.hideLeave],
  ];
  for (const [name, a, b] of legs) {
    for (const s of solids) assert.ok(segDist(s, a, b) > s.r, `${name} passes ${segDist(s, a, b).toFixed(2)} m from a solid (r ${s.r})`);
  }
  // the hide's log lies ACROSS his view, in front of him to the left (he looks past its end)
  const l0 = toLocal(HIDE_FRAME, alongLog(-1)), l1 = toLocal(HIDE_FRAME, alongLog(1));
  assert.ok(Math.abs(l0.v - l1.v) < 0.05 && Math.abs(l0.u - l1.u) > 1.5, 'the log lies across');
  assert.ok(Math.min(l0.u, l1.u) > 0 && l0.v > 0.8, 'in front of him, to the right');
  // the way round keeps out of the water; "recht erdoor" goes in
  for (const p of POOL_ROUND) {
    const l = toLocal({ x: POOL.x, z: POOL.z, heading: POOL.heading }, p);
    assert.ok((l.u / POOL.halfW) ** 2 + (l.v / POOL.halfD) ** 2 > 1.2, 'round it, not in it');
  }
  const li = toLocal({ x: POOL.x, z: POOL.z, heading: POOL.heading }, POOL_IN);
  assert.ok((li.u / POOL.halfW) ** 2 + (li.v / POOL.halfD) ** 2 < 0.5, 'straight through is in the water');
  const le = toLocal({ x: POOL.x, z: POOL.z, heading: POOL.heading }, P.poolEdge);
  assert.ok(le.v < -POOL.halfD, 'he stops at its near edge');
});

test('clear of the other missions, the frisling\'s home, the paths, the props and the roaming animals', () => {
  for (const p of everything()) {
    for (const [id, m] of Object.entries(OTHER_MARKERS)) {
      assert.ok(dist(p, m) >= 8 + p.r - 0.5, `${p.name} keeps 8 m from the ${id} marker (${dist(p, m).toFixed(1)})`);
    }
    for (const f of frislingHome()) assert.ok(dist(p, f) > 6, `${p.name} keeps 6 m from ${f.name} (${dist(p, f).toFixed(1)})`);
    for (const q of PROPS) assert.ok(dist(p, q) > q.r + p.r + 0.3, `${p.name} is not on a prop at (${q.x}, ${q.z})`);
    for (const a of ROAMERS) assert.ok(dist(p, a) > a.r + p.r + 2, `${p.name} is off the ${a.id}'s wander loop`);
    assert.ok(distanceToNetwork(p.x, p.z) > LANE_HALF + p.r - 0.3, `${p.name} keeps off the paths (${distanceToNetwork(p.x, p.z).toFixed(1)} m)`);
  }
  // the marker ring (r 1.15) stays open: nothing of the home within 2.5 m of it
  for (const p of everything().filter((q) => q.name !== 'marker')) {
    assert.ok(dist(p, MARKER) > 2.5 + p.r, `${p.name} keeps off the marker ring`);
  }
  assert.equal(reeClearings().length, 2);
});

test('who lives here: the doe by the copse and her calf in the grass; after, the two together', () => {
  const doe = REE_RESIDENTS.find((r) => r.key === 'doe')!;
  const calf = REE_RESIDENTS.find((r) => r.key === 'calf')!;
  assert.equal(doe.animal, 'ree');
  assert.equal(calf.animal, 'reekalf');
  assert.ok(dist(doe.before!, COPSE_GAP) < 4 && dist(doe.before!, MARKER) < dist(COPSE_GAP, MARKER), 'she grazes by the copse, on the marker\'s side of its gap');
  const before = doe.shy!.find((q) => q.state === 'before')!, after = doe.shy!.find((q) => q.state === 'after')!;
  assert.ok(dist(before.to, DOE_BED) < 1e-9 && before.lie, 'shy: she beds down in the copse');
  assert.ok(before.back > before.within + 3, 'she comes out only once he is well off');
  // after, the two let him watch them from the hide (they step in only when he walks right up)
  assert.ok(after.within < dist(P.hide, doe.after!) - 1.5 && after.within < dist(P.hideLeave, doe.after!) - 1.5, 'from the hide he can watch them');
  const cs = calf.shy!.find((q) => q.state === 'after')!;
  assert.ok(dist(cs.to, DOE_BED) < 1.5 && cs.within === after.within, 'the calf goes in with her');
  // after: grazing side by side at the copse's edge, at the home place
  assert.ok(dist(doe.after!, calf.after!) < 1.6, 'mother and calf together');
  for (const r of [doe, calf]) assert.ok(dist(r.after!, P.home) < 1.6, `${r.key} lives at the home place`);
  // the walk home after the mission is a calm one (Residents walks ≤ 9 m, else a cut)
  assert.ok(dist(calf.before!, calf.after!) < 9, 'the calf walks home, it never pops');
  // a calf drinks at its mother's flank, head under her belly
  const d = drinkSpot({ ...doe.after!, yaw: 0 }, SIZE.ree.len);
  const dd = dist(d, doe.after!);
  assert.ok(dd > 0.25 && dd < 0.5, `it drinks ${dd.toFixed(2)} m from her middle`);
});

test('the framed views look at their place from the ranger\'s side, with him in the picture', () => {
  for (const [name, v, stand] of [['search', SEARCH_VIEW, P.meadowApproach], ['pool', POOL_VIEW, P.poolEdge]] as const) {
    assert.ok(v.include.some((q) => dist(q, stand) < 1e-9), `${name}: the ranger's spot is in the picture`);
    const l = toLocal({ x: v.at.x, z: v.at.z, heading: v.heading }, stand);
    assert.ok(l.v < -0.3, `${name}: he stands in front of what the view looks at`);
  }
  // by the calf the lens looks over his shoulder at its flank: he stands off to one side
  // of the line to it (never in front of it), and it lies across the view, side-on
  assert.ok(CALF_VIEW.include.some((q) => dist(q, P.calfTalk) < 1e-9), 'calf: the ranger is in the picture');
  const cf = { x: CALF_VIEW.at.x, z: CALF_VIEW.at.z, heading: CALF_VIEW.heading };
  const cr = toLocal(cf, P.calfTalk), cc = toLocal(cf, CALF_SPOT);
  assert.ok(cr.v < cc.v - 0.5 && Math.abs(cr.u - cc.u) > 0.5, 'calf: he stands nearer the lens, to one side');
  const across = Math.abs(Math.sin(CALF_SPOT.yaw - CALF_VIEW.heading));
  assert.ok(across > 0.8, `calf: its flank faces the lens (${across.toFixed(2)})`);
  const fromSearch = Math.abs(Math.sin(CALF_SPOT.yaw - SEARCH_VIEW.heading));
  assert.ok(fromSearch > 0.7, `search: its back and flank face the searching eye (${fromSearch.toFixed(2)})`);
  // the watch has no ranger in it: the lens looks from the hide's side at the scene
  const l = toLocal({ x: WATCH_VIEW.at.x, z: WATCH_VIEW.at.z, heading: WATCH_VIEW.heading }, P.hide);
  assert.ok(l.v < -8 && Math.abs(l.u) < 1, 'the watch looks out from the hide');
  assert.ok(WATCH_VIEW.halfW >= dist(COPSE_GAP, CALF_SPOT) / 2 + 0.5, 'the gap and the calf both fit its width');
});
