/**
 * frisling.places.test.ts — where "De verdwaalde frisling" happens is chosen by looking
 * at the world; this pins that it stays a good place (design run6-missions §3.4, §4.1):
 * dry, on the heath (the stand in the meadow across the trail), inside the world, clear
 * of the paths, the props and the other markers, at the right distances from each other
 * (a real follow, a real lead home with the family ahead), and the rooting field's seven
 * look-alike spots in one view. Run: `npm test`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FRISLING_PLACES as P, FRISLING_RESIDENTS, FRISLING_HOME, MARKER, STAND, STAND_FRAME, FIELD_FRAME, WALLOW, WALLOW_FRAME, LOST_SPOT,
  fieldSpots, hideClumps, frislingClearings, onStand, SEARCH_VIEW, FIELD_VIEW, WALLOW_VIEW, LEAD_CLUMP_COUNT,
  cluePosts, clueGap, bootPrints, CLUE_FRAME,
} from './frisling.places.ts';
import { anchorInBiome, biomeAt, VEN_CENTER } from '../../Biomes.ts';
import { distanceToNetwork, LANE_HALF } from '../../Paths.ts';
import { dist, headingTo, toLocal, atLocal, segDist } from '../places.ts';
import { AREA_VELUWE } from '../../../content/veluwe.ts';
import { PRINT_SPOTS } from '../../../engines/corsi.ts';

/** The other missions' markers as the world places them (world/Markers.placeMarkers:
 *  the landschap anchors; read with `__ranger.markers()`, 2026-09-29). */
const OTHER_MARKERS = {
  'ree-niet-aanraken': { x: -15.008831796612796, z: -27.124434889984062 },
  herstel: { x: -34.999270825785885, z: -19.36623457627458 },
  wildcamera: { x: 15.556349186104047, z: -15.556349186104043 },
};
/** The world's props near the frisling home (world/Dressing.placeNatureDressing, the
 *  landmarks) + their solid radius: the foxgloves, the boulder, and in the meadow the west
 *  signpost and the mushrooms (`__ranger.dressing()`/`obstacles()`, 2026-09-30). */
const PROPS = [{ x: -10, z: -22, r: 0 }, { x: -20, z: -28, r: 0.9 }, { x: -6, z: -30, r: 0 }, { x: -16, z: 10, r: 1.2 }, { x: -19, z: 14, r: 0 }];
/** Every tree near the meadow and the heath west of the clearing (`__ranger.treeSpots()`,
 *  2026-09-30: none within 25 m of the stand; the nearest stand west of the boa post). */
const TREES = [{ x: -51, z: -24 }];
/** The roaming animals' wander loops (world/Fauna.placeAmbientLife): home + radius. */
const ROAMERS = [
  { id: 'vos', x: -42, z: -2, r: 6 },
  { id: 'eekhoorn', x: 4, z: -11, r: 3 },
];

const everything = (): { name: string; x: number; z: number; r: number }[] => [
  ...Object.entries(P).map(([name, p]) => ({ name, x: p.x, z: p.z, r: 0.5 })),
  ...fieldSpots().map((s) => ({ name: `field-${s.id}`, x: s.x, z: s.z, r: 0.5 })),
  ...hideClumps().map((h, i) => ({ name: `clump-${i}`, x: h.x, z: h.z, r: 0.5 })),
  // the stand's rim (its clumps reach halfW + 0.45 × halfD + 0.4, frisling.home.ts), each clump ≈ 0.45 m round
  ...Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    return { name: `stand-rim-${i}`, ...atLocal(STAND_FRAME, (STAND.halfW + 0.45) * Math.cos(a), (STAND.halfD + 0.4) * Math.sin(a)), r: 0.45 };
  }),
  { name: 'wallow', x: WALLOW_FRAME.x, z: WALLOW_FRAME.z, r: Math.max(WALLOW.halfW, WALLOW.halfD) + 0.4 },
  // the clue (after): the cut fence and the boot prints through its gap
  ...cluePosts().map((p, i) => ({ name: `clue-post-${i}`, ...p, r: 0.3 })),
  ...bootPrints().map((p, i) => ({ name: `clue-print-${i}`, x: p.x, z: p.z, r: 0.2 })),
];

test('the marker is where the world puts it (the heide anchor)', () => {
  const a = anchorInBiome('heide', 22);
  assert.ok(Math.abs(a.x - MARKER.x) < 1e-6 && Math.abs(a.z - MARKER.z) < 1e-6, `anchor (${a.x}, ${a.z})`);
  assert.equal(AREA_VELUWE.missies[0].id, 'frisling');
});

/** The stand and the first clumps of the way home lie in the meadow north of the west
 *  trail: the compass sector the world calls 'ven', grassland here, 70 m from its water. */
const inMeadow = (p: { x: number; z: number }): boolean => biomeAt(p.x, p.z) === 'ven' && p.z > -6 && Math.hypot(p.x - VEN_CENTER.x, p.z - VEN_CENTER.z) > 60;

test('every place is dry heath (or the dry meadow across the trail) inside the world', () => {
  for (const p of everything()) {
    assert.ok(biomeAt(p.x, p.z) === 'heide' || inMeadow(p), `${p.name} is on the heath or the dry meadow (${biomeAt(p.x, p.z)})`);
    assert.ok(Math.hypot(p.x, p.z) < 60, `${p.name} is well inside the world`);
    assert.ok(Math.hypot(p.x - VEN_CENTER.x, p.z - VEN_CENTER.z) > 25, `${p.name} is far from the ven`);
  }
});

test('the story reads from the marker: the family 10-14 m on, the squeak far off to the side', () => {
  const w = dist(MARKER, P.wallow), c = dist(MARKER, P.cover);
  assert.ok(w >= 10 && w <= 14, `the wallow is ${w.toFixed(1)} m from the marker`);
  assert.ok(c >= 30 && c <= 39, `the stand is ${c.toFixed(1)} m from the marker`);
  // walking up from the clearing (spawn → marker), the wallow lies ahead, the stand to the side
  const walkIn = headingTo({ x: 0, z: 0 }, MARKER);
  const off = (p: { x: number; z: number }): number => {
    let d = headingTo(MARKER, p) - walkIn;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return Math.abs(d) * 180 / Math.PI;
  };
  assert.ok(off(P.wallow) < 35, `the wallow is ${off(P.wallow).toFixed(0)}° off the way in: in view`);
  assert.ok(off(P.cover) > 60, `the stand is ${off(P.cover).toFixed(0)}° off the way in: to the side`);
  // the field lies between the stand and the wallow
  assert.ok(dist(P.cover, P.field) + dist(P.field, P.wallow) < dist(P.cover, P.wallow) * 1.25, 'the field is on the way home');
});

test('a real follow and a real lead home: ~34 m after the squeak, ≥ 30 m back with the family ahead', () => {
  // the follow: from the ring to where he searches the stand (the prints, the squeak)
  const follow = dist(MARKER, P.coverApproach);
  assert.ok(follow >= 15 && follow <= 36, `the follow is ${follow.toFixed(1)} m`);
  // the lead: from the stand to where he watches the route, one straight walk of ≥ 30 m
  // however close to the goal he stops (the walk ends within 1 m of it)
  const lead = dist(P.coverApproach, P.fieldApproach);
  assert.ok(lead - 1 >= 29.5, `the lead home is ${lead.toFixed(1)} m`);
  // walking it, the family at the wallow is ahead (within ±25° of the way, the follow
  // camera behind him sees it) all along, and in its last 15 m most of all
  const h = headingTo(P.coverApproach, P.fieldApproach);
  for (let t = 0; t <= 1.001; t += 0.1) {
    const at = { x: P.coverApproach.x + (P.fieldApproach.x - P.coverApproach.x) * t, z: P.coverApproach.z + (P.fieldApproach.z - P.coverApproach.z) * t };
    let d = headingTo(at, P.wallow) - h;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    assert.ok(Math.abs(d) < (25 * Math.PI) / 180, `at ${(t * 100).toFixed(0)}% of the way home the family is ${(d * 180 / Math.PI).toFixed(0)}° off ahead`);
  }
  // at least four clumps BESIDE the way (never on it: a child walks it straight), on both
  // sides, two of them in its last 15 m where running is tempting
  const beside = hideClumps().slice(0, LEAD_CLUMP_COUNT);
  assert.ok(beside.length >= 4);
  let left = 0, right = 0, late = 0;
  for (const c of beside) {
    const off = segDist(c, P.coverApproach, P.fieldApproach);
    assert.ok(off > 1.6 && off < 3, `a clump ${off.toFixed(1)} m beside the way`);
    const l = toLocal({ ...P.coverApproach, heading: h }, c);
    if (l.u > 0) right += 1; else left += 1;
    if (lead - l.v < 15) late += 1;
  }
  assert.ok(left >= 2 && right >= 2 && late >= 2, `clumps left ${left}, right ${right}, in the last 15 m ${late}`);
  // the free-roam squeak is heard near the stand (the trail by it), never at the spawn
  // clearing where Bram's first minute plays
  const voice = FRISLING_RESIDENTS.find((r) => r.key === 'lost')!.voice!;
  assert.ok(dist(P.cover, { x: 0, z: 0 }) > voice.within + 3, 'the squeak is not heard at the clearing');
  // a stand this far from the wallow keeps the home drawn when he is near it (Residents)
  assert.ok(FRISLING_HOME.spread?.some((s) => dist(s, P.cover) < 1), 'the home reaches out to its stand');
});

test('clear of the other missions, the paths, the props and the roaming animals', () => {
  for (const p of everything()) {
    for (const [id, m] of Object.entries(OTHER_MARKERS)) {
      assert.ok(dist(p, m) >= 8 + p.r - 0.5, `${p.name} keeps 8 m from the ${id} marker (${dist(p, m).toFixed(1)})`);
    }
    for (const q of PROPS) assert.ok(dist(p, q) > q.r + p.r + 0.3, `${p.name} is not on a prop at (${q.x}, ${q.z})`);
    for (const q of TREES) assert.ok(dist(p, q) > p.r + 2, `${p.name} is not at a tree at (${q.x}, ${q.z})`);
    for (const a of ROAMERS) assert.ok(dist(p, a) > a.r + p.r + 2, `${p.name} is off the ${a.id}'s wander loop`);
  }
  // the stand, the field, the wallow and the loose clumps keep off the sand paths
  for (const p of everything().filter((q) => /stand|wallow|field|clump/.test(q.name))) {
    assert.ok(distanceToNetwork(p.x, p.z) > LANE_HALF + p.r - 0.3, `${p.name} keeps off the paths (${distanceToNetwork(p.x, p.z).toFixed(1)} m)`);
  }
  // the marker ring (r 1.15) stays open: nothing of the home within 2 m of it
  for (const p of everything().filter((q) => q.name !== 'marker')) {
    assert.ok(dist(p, MARKER) > 2 + p.r, `${p.name} keeps off the marker ring`);
  }
});

test('the rooting field: seven look-alike spots in the PRINT_SPOTS layout, uniformly scaled, all in one view', () => {
  const s = fieldSpots();
  assert.equal(s.length, PRINT_SPOTS.length);
  // uniform: every pair keeps its 2D distance ratio
  const d2 = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);
  const k = dist(s[0], s[1]) / d2(PRINT_SPOTS[0], PRINT_SPOTS[1]);
  for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) {
    assert.ok(Math.abs(dist(s[i], s[j]) / d2(PRINT_SPOTS[i], PRINT_SPOTS[j]) - k) < 1e-9, 'one scale for the whole layout');
    assert.ok(dist(s[i], s[j]) > 1.4, `spots ${i} and ${j} stand apart (${dist(s[i], s[j]).toFixed(2)} m)`);
  }
  // from the lens behind the ranger watching the field, every spot lies within ±35° ahead
  // (one held view; the Stage fit backs the lens off until all of them are in the picture)
  const lens = atLocal({ x: P.fieldApproach.x, z: P.fieldApproach.z, heading: P.fieldApproach.heading! }, 0, -3);
  for (const p of s) {
    const l = toLocal({ x: lens.x, z: lens.z, heading: P.fieldApproach.heading! }, p);
    assert.ok(l.v > 2 && Math.abs(Math.atan2(l.u, l.v)) < (35 * Math.PI) / 180, `spot ${p.id} is ahead in the view`);
  }
  assert.deepEqual(frislingClearings().length, 1 + s.length + 2);
});

test('the lost piglet lies in the stand where the trial says (content doel 52, 58), the decoys round him', () => {
  const m = AREA_VELUWE.missies[0];
  const doel = m.stappen[0].skin.doel!;
  const at = onStand(doel.x, doel.y);
  assert.ok(dist(at, LOST_SPOT) < 1e-9);
  const l = toLocal(STAND_FRAME, LOST_SPOT);
  assert.ok(Math.abs(l.u) <= STAND.halfW && Math.abs(l.v) <= STAND.halfD, 'inside the stand');
  const before = FRISLING_RESIDENTS.find((r) => r.key === 'lost')!.before!;
  assert.ok(dist(before, LOST_SPOT) < 1e-9 && before.idle === 'lie');
  for (const d of m.stappen[0].skin.distractors ?? []) {
    assert.ok(dist(onStand(d.x, d.y), LOST_SPOT) > 0.4, `decoy ${d.id} is not on top of him`);
  }
  // the trail's end (the stand's near edge) is never the piglet's spot
  assert.ok(dist(P.coverApproach, LOST_SPOT) > 2.2);
});

test('the family lives at the wallow; after, the lost one is by his mother', () => {
  for (const r of FRISLING_RESIDENTS) {
    assert.ok(r.after, `${r.key} is at the wallow after`);
    assert.ok(dist(r.after!, P.wallow) < 2.4, `${r.key} lives at the wallow`);
    if (r.key !== 'lost') assert.ok(r.before && dist(r.before, P.wallow) < 2.4, `${r.key} is there before too`);
  }
  const sow = FRISLING_RESIDENTS.find((r) => r.key === 'sow')!.after!;
  const lost = FRISLING_RESIDENTS.find((r) => r.key === 'lost')!.after!;
  assert.ok(dist(sow, lost) < 2, 'the piglet ends within 2 m of his mother');
});

test('the framed views look at their place from the ranger\'s side, with him in the picture', () => {
  for (const [name, v, stand] of [['search', SEARCH_VIEW, P.coverApproach], ['field', FIELD_VIEW, P.fieldApproach], ['wallow', WALLOW_VIEW, P.wallowTalk]] as const) {
    assert.ok(v.include.some((q) => dist(q, stand) < 1e-9), `${name}: the ranger's spot is in the picture`);
    // the ranger stands on the lens's side of the place (the view looks past him at it)
    const l = toLocal({ x: v.at.x, z: v.at.z, heading: v.heading }, stand);
    assert.ok(l.v < -1, `${name}: he stands in front of what the view looks at`);
  }
  const w = atLocal(WALLOW_FRAME, 0, 0);
  assert.ok(dist(w, P.wallow) < 1e-9);
});

test('the clue: a cut fence past the wallow, boot prints through its gap, clear of the family', () => {
  const posts = cluePosts();
  const gap = clueGap();
  // the gap is a bay in the middle of the fence, the fence lies beyond the wallow
  assert.ok(dist(gap, P.wallow) > 4.5 && dist(gap, P.wallow) < 7, `the gap is ${dist(gap, P.wallow).toFixed(1)} m past the wallow`);
  assert.ok(toLocal(WALLOW_FRAME, CLUE_FRAME).v > 4, 'on the far side of the wallow from the ranger');
  // the prints: a grown-up's stride, one line through the gap, from outside toward the wallow
  const prints = bootPrints();
  for (let i = 1; i < prints.length; i++) {
    const s = dist(prints[i], prints[i - 1]);
    assert.ok(s > 0.6 && s < 0.9, `a long stride (${s.toFixed(2)} m)`);
    assert.ok(dist(prints[i], P.wallow) < dist(prints[i - 1], P.wallow), 'they lead toward the wallow');
  }
  const cross = prints.map((p) => toLocal(CLUE_FRAME, p).v);
  assert.ok(cross[0] > 0 && cross[cross.length - 1] < 0, 'they cross the fence line');
  const gu = toLocal(CLUE_FRAME, gap).u;
  for (const p of prints) assert.ok(Math.abs(toLocal(CLUE_FRAME, p).u - gu) < 0.3, 'through the gap, not through the wire');
  // the family (after) keeps clear of the wire
  for (const r of FRISLING_RESIDENTS) {
    for (const q of posts) assert.ok(dist(r.after!, q) > 2, `${r.key} keeps off the fence`);
  }
});
