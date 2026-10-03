/**
 * frisling.places.ts — where "De verdwaalde frisling" happens in the world, and who
 * lives there (THREE-free; `frisling.places.test.ts` pins it). Chosen by looking at the
 * world (design run6-missions §4.1, run 7 frisling §5.2): the heide west of the clearing,
 * open ground, the west trail across it, the ree and herstel markers ≥ 8 m away.
 *
 * Seen by a child walking up from the clearing (heading south-west, the camera behind
 * him): the empty marker ring ahead; beyond it, 13 m out and a little left, the family
 * rooting at its muddy WALLOW, and between the ring and the wallow the ROOTING FIELD,
 * seven look-alike patches of turned earth where the group went home.
 *
 * Run 7: every play the squeak comes from one of THREE WAYS (`WAYS`, drawn per play by
 * frisling.vary.ts), each with its own stand of bracken, its own nooks the piglet may lie
 * in (never in the middle of the search picture), its own look-alike spots, its own way
 * home and the side he watches the group's route from:
 *
 *   wei    north, across the sand trail into the meadow (run 6's stand); the long lead
 *          home to the rooting field, seen from its north-west
 *   steen  west round the north field and down the family's far side, then south over
 *          the open heath to bracken at the forest edge; a short lead to the SOUTH rooting
 *          field, then home past the family's west side to the wallow's north
 *   berk   north-east, to a lone birch in the meadow, past the cabin; the long lead
 *          home to the rooting field, seen from its east
 *
 * The fixed part (the marker, the wallow, the north field, the log, the clue) stands every
 * play; `FRISLING_PLACES` is the places table the world and the specs read, with THIS
 * play's way flattened in (`useWay`, under the briefing card).
 */

import { PRINT_SPOTS } from '../../../engines/corsi.ts';
import { RANGER_STAND_HEIGHT } from '../../AnimalScale.ts';
import { boxObstacle, obstacleGap, type Obstacle } from '../../CharacterController.ts';
import type { HomeSpec, Place, ResidentPose, ResidentSpec, Spot } from '../types.ts';
import { approachOf, atLocal, dist, headingTo, stream, toLocal, toward, uniformLocal, type Frame } from '../places.ts';
import { standClumps, type Clump } from '../cover-math.ts';
import { biomeAt, VEN_CENTER } from '../../Biomes.ts';

/** The frisling marker: the heide's first anchor (Biomes.anchorInBiome('heide', 22)).
 *  The marker stays where it always stood; the test checks the anchor still lands here. */
export const MARKER: Spot = { x: -15.556349186104043, z: -15.556349186104047 };
/** The centre of the wallow (zoel), the rotte's home. */
const WALLOW_AT: Spot = { x: -26, z: -24 };

/** A cover stand: half-size across (u) and in depth (v) of its clump layout (m), laid in
 *  the frame the ranger sees it in when he arrives. Every way's stand is this size: the
 *  same search at the same level, wherever it lies. */
export const STAND = { halfW: 2.1, halfD: 1.5 } as const;
/** How far out from the stand's centre the ranger stops to search it (m). */
const STAND_BACK = 2.9;

/** A rooting field: PRINT_SPOTS scaled UNIFORMLY (m per percent), all seven in one view. */
export const FIELD_SCALE = 0.078;

/** The wallow's mud (half-sizes, m) and how far from its centre the ranger stops by it. */
export const WALLOW = { halfW: 1.8, halfD: 1.35 } as const;
const WALLOW_TALK = 4.8;

/* ------------------------------------------------------- the fixed home ---- */

/** The north rooting field (between the ring and the wallow): its patches are laid in the
 *  frame they always had (seen from its north-east); `wei` watches it from its north-west,
 *  `berk` from its east — two views of the same board. */
const FIELD_N_AT: Spot = { x: -24, z: -16 };
export const FIELD_FRAME: Frame = { x: FIELD_N_AT.x, z: FIELD_N_AT.z, heading: approachOf(FIELD_N_AT, { x: -20, z: -8 }, 3.3).heading! };
/** The south rooting field (`steen`): out on the open heath south-west of the wallow, seen
 *  from its east-north-east (he turns to it at the end of the lead home). Run 7 round 3:
 *  the roe's mornings took the heath south of the wallow (ree:variety), so steen's ground
 *  moved west of them, between the herstel's ground and the world's south-west rim. */
const FIELD_S_AT: Spot = { x: -36.8, z: -34.3 };
const FIELD_S_LOOK = -1.99; // the way he looks at it (rad): west-south-west
export const FIELD_S_FRAME: Frame = { x: FIELD_S_AT.x, z: FIELD_S_AT.z, heading: FIELD_S_LOOK };
export type FieldId = 'N' | 'S';
/** A field's board frame. */
export const fieldFrame = (f: FieldId): Frame => (f === 'N' ? FIELD_FRAME : FIELD_S_FRAME);

/** The seven patches of turned earth of a field (world x/z), in PRINT_SPOTS id order. */
export function fieldSpotsOf(f: FieldId): (Spot & { id: number })[] {
  const frame = fieldFrame(f);
  return PRINT_SPOTS.map((s) => {
    const { u, v } = uniformLocal(s.x, s.y, FIELD_SCALE);
    return { id: s.id, ...atLocal(frame, u, v) };
  });
}

/** The wallow's frame: seen from the north-north-east (the field side), as it always was. */
const WALLOW_TALK_N = approachOf(WALLOW_AT, FIELD_N_AT, WALLOW_TALK, 1.2);
export const WALLOW_FRAME: Frame = { x: WALLOW_AT.x, z: WALLOW_AT.z, heading: WALLOW_TALK_N.heading! };

/** The fallen log at the wallow (a pig's scratching post), in the wallow frame. */
export const WALLOW_LOG = { u: 2.3, v: 0.4, turn: 1.2 } as const;
/** The log as the world's solid (the home pushes it into the obstacles). */
export function wallowLog(): Obstacle {
  const at = atLocal(WALLOW_FRAME, WALLOW_LOG.u, WALLOW_LOG.v);
  return boxObstacle(at.x, at.z, 0.85, 0.22, WALLOW_FRAME.heading + WALLOW_LOG.turn, 0.25);
}

/** The wallow's rim: bracken behind the mud, away from where the ranger comes (the
 *  wallow frame), and three clumps between the north field and the wallow. (The south rim
 *  keeps the gap run 7's first `steen` came up through from the south-east.) */
const WALLOW_CLUMPS: readonly (readonly [number, number, number])[] = [
  [-3.6, -4.4, 0.9], [3.2, -4.0, 0.85], [2.6, -1.8, 0.8],
  [-2.4, 1.7, 1], [-0.8, 2.3, 1.1], [-2.95, 0.15, 0.9],
];

/* ------------------------------------------------------------ the ways ---- */

export type WayId = 'wei' | 'steen' | 'berk';
export const WAY_IDS: readonly WayId[] = ['wei', 'steen', 'berk'];

/** A nook of a stand the lost piglet may lie in (stand frame: u across, v away from him),
 *  and which way he lies there: `side` (+1/−1) is the way his head points lying side-on. */
export interface Nook { u: number; v: number; side: 1 | -1 }
/** A sow's nest at a stand's edge (package body): its radius (m); never on a nook or a
 *  look-alike spot (frisling.places.test.ts). */
export const NEST_R = 0.4;

/** A spot of a stand a look-alike may be laid on; `edge`: at the stand's rim (a nightjar
 *  pressed to a bare patch belongs there, never deep in the bracken). */
export interface DecoySpot { u: number; v: number; edge?: boolean }

/** A framed view as the script takes it (adventure/kit FrameSpec, THREE-free). */
export interface WayView {
  at: Spot; heading: number; halfW: number; halfD: number; tall: number; pitchDeg: number;
  insetTop: number; insetBottom: number; include: readonly { x: number; z: number; h: number }[];
}

/** One way of the frisling: the follow, the stand, the lead home, the field, the wallow. */
export interface Way {
  id: WayId;
  /** the stand's centre and its frame (u across, v away from the ranger arriving) */
  stand: Spot;
  frame: Frame;
  /** where the ranger stops to search it */
  coverApproach: Place;
  /** the follow, from the ring to the stand's approach (the prints run along it) */
  follow: readonly Spot[];
  nooks: readonly Nook[];
  decoySpots: readonly DecoySpot[];
  /** the search's framed view (the ranger in a lower corner) */
  searchView: WayView;
  /** the clumps beside the lead home a frightened piglet dives into */
  leadClumps: readonly (Spot & { size: number })[];
  field: FieldId;
  /** where he stands to watch the group's route, the piglet at his side, the view */
  fieldApproach: Place;
  fieldSide: Spot;
  fieldView: WayView;
  /** golden's way from the field to the wallow (round what is to be walked round) */
  toWallow: readonly Spot[];
  /** at the wallow: where he stops, where he walks on to when the path is free, the view */
  wallowTalk: Place;
  wallowGive: Place;
  wallowView: WayView;
  /** (package 2) a ring of bitten fronds at the stand's edge, and where a woodlark may sit */
  nest: Spot;
  walkSpots: readonly Spot[];
  /** the stand's cover: its seed and how its clumps lean (more fronds, more grass) */
  cover: { seed: number; bracken: number; grass: number };
  /** young trees the home plants at the stand (Adventure.trees) */
  trees: readonly (Spot & { h: number; rotY: number })[];
  /** the side (+1 his right, −1 his left, facing the stand) the found piglet comes out to,
   *  where the way home lies straight behind him (otherwise: away from the way home) —
   *  chosen so the close pictures at the stand look away from a neighbour's home */
  outSide?: 1 | -1;
}

/** A stand's frame and the spot he searches it from, arriving from `from`. */
function standAt(centre: Spot, from: Spot): { frame: Frame; coverApproach: Place } {
  const coverApproach = approachOf(centre, from, STAND_BACK, 1.3);
  return { frame: { ...centre, heading: coverApproach.heading! }, coverApproach };
}

/** The search's view of a stand (its heading turned a little: he stands in a lower corner). */
function searchViewOf(frame: Frame, approach: Place, turn: number): WayView {
  return {
    at: { x: frame.x, z: frame.z }, heading: frame.heading + turn,
    halfW: 2.35, halfD: 1.7, tall: 1.05, pitchDeg: 40, insetTop: 100, insetBottom: 12,
    include: [{ x: approach.x, z: approach.z, h: RANGER_STAND_HEIGHT }],
  };
}

/** The route's view of a field from where he stands, the piglet at his left. */
function fieldViewOf(field: FieldId, approach: Place, side: Spot, turn: number): WayView {
  const f = field === 'N' ? FIELD_N_AT : FIELD_S_AT;
  return {
    at: { x: f.x, z: f.z }, heading: approach.heading! + turn,
    halfW: 3.1, halfD: 2.2, tall: 0.5, pitchDeg: 46, insetTop: 100, insetBottom: 56,
    include: [{ x: approach.x, z: approach.z, h: RANGER_STAND_HEIGHT }, { x: side.x, z: side.z, h: 0.45 }],
  };
}

/** The wallow's view from where he stops (the frame of the wallow as he sees it), turned a
 *  little to one side (`turn`: the side clear of the big stone). */
function wallowViewOf(talk: Place, turn = -0.38): WayView {
  const frame: Frame = { x: WALLOW_AT.x, z: WALLOW_AT.z, heading: talk.heading! };
  return {
    at: atLocal(frame, 0.3 * Math.sign(-turn), -1.6), heading: frame.heading + turn,
    halfW: 2.6, halfD: 2.3, tall: 0.95, pitchDeg: 28, insetTop: 96, insetBottom: 290,
    include: [{ x: talk.x, z: talk.z, h: RANGER_STAND_HEIGHT }],
  };
}

/** The clumps beside a lead from `a` to `b`: [share of the way, metres to its side (+
 *  right, walking it), size]. Alternately left and right, never on the way. */
function leadClumpsOf(a: Spot, b: Spot, table: readonly (readonly [number, number, number])[]): (Spot & { size: number })[] {
  const way: Frame = { x: a.x, z: a.z, heading: headingTo(a, b) };
  const len = dist(a, b);
  return table.map(([t, u, size]) => ({ ...atLocal(way, u, t * len), size }));
}

/** Where he walks on to when the path is free: a few calm steps along the way, to the
 *  side of the wallow (never into it). */
function giveOf(talk: Place, u: number, v: number): Place {
  const p = atLocal({ x: talk.x, z: talk.z, heading: talk.heading! }, u, v);
  return { ...p, r: 0.6, heading: headingTo(p, WALLOW_AT) };
}

/** The piglet's spot at his left while he watches the route. */
const sideOf = (a: Place): Spot => atLocal({ x: a.x, z: a.z, heading: a.heading! }, -1.0, 0.35);

/* -- wei: north, across the trail into the meadow (run 6's stand) -- */
const WEI = ((): Way => {
  const stand: Spot = { x: -25.7, z: 20.4 };
  const { frame, coverApproach } = standAt(stand, MARKER);
  const fieldApproach = approachOf(FIELD_N_AT, { x: -30, z: -6 }, 4.5, 1.2);
  const fieldSide = sideOf(fieldApproach);
  const wallowTalk = WALLOW_TALK_N;
  return {
    id: 'wei', stand, frame, coverApproach,
    follow: [toward(MARKER, coverApproach, 0.9), toward(coverApproach, stand, 0.6)],
    nooks: [
      { u: -1.35, v: 0.45, side: 1 }, { u: -1.15, v: -0.5, side: -1 }, { u: 1.3, v: 0.75, side: -1 },
      { u: 1.45, v: -0.3, side: 1 }, { u: -0.85, v: 1.15, side: 1 },
    ],
    decoySpots: [
      { u: -1.85, v: 0.1, edge: true }, { u: -0.5, v: 0.25 }, { u: 0.35, v: 0.5 }, { u: 0.55, v: -0.55 },
      { u: 1.0, v: 1.3 }, { u: 0.3, v: 1.25 }, { u: 1.95, v: 0.35, edge: true }, { u: 0.0, v: -0.9, edge: true },
      { u: -1.6, v: -1.0, edge: true }, { u: -0.35, v: 1.45, edge: true },
    ],
    searchView: searchViewOf(frame, coverApproach, 0.42),
    leadClumps: leadClumpsOf(coverApproach, fieldApproach, [[0.16, 2.2, 0.9], [0.34, -2.3, 0.85], [0.5, 2.1, 0.9], [0.64, -2.2, 0.8], [0.71, 2.2, 0.85], [0.94, 2.1, 0.8]]),
    field: 'N', fieldApproach, fieldSide, fieldView: fieldViewOf('N', fieldApproach, fieldSide, -0.3),
    toWallow: [],
    wallowTalk, wallowGive: giveOf(wallowTalk, -1.9, 1.1), wallowView: wallowViewOf(wallowTalk),
    nest: atLocal(frame, 2.55, 1.25),
    walkSpots: [atLocal({ x: MARKER.x, z: MARKER.z, heading: headingTo(MARKER, coverApproach) }, 1.6, 14), atLocal({ x: MARKER.x, z: MARKER.z, heading: headingTo(MARKER, coverApproach) }, -1.7, 24)],
    cover: { seed: 71, bracken: 0.2, grass: 0.25 },
    trees: [],
  };
})();

/** On `steen` the follow passes the family: a child who walks within this of the sow makes
 *  her lift her head ('Niet zo dichtbij. De moeder kijkt.'). The way the prints go keeps
 *  ≥ 1.5 m more than this from her in every family layout (frisling.places.test.ts): doing
 *  what the game asks is never told off. */
export const SOW_NOTICE_M = 4;

/* -- steen: round the north field and the family's west side, south to the heath's rim -- */
const STEEN = ((): Way => {
  const stand: Spot = { x: -36.42, z: -46.11 };
  // the follow (run 7 round 3: the roe's mornings took the heath between the wallow and
  // her marker, the only way south on the family's east side): west along the north
  // field's far edge, round the family's west side (6.6 m from the mud, between it and the
  // herstel's ring), then south over the open heath to the bracken at the forest edge
  const follow0: Spot[] = [{ x: -25.8, z: -11.7 }, { x: -29.6, z: -16.4 }, { x: -32.6, z: -22.1 }, { x: -33.0, z: -30.5 }];
  const { frame, coverApproach } = standAt(stand, follow0[follow0.length - 1]);
  const fieldApproach = approachOf(FIELD_S_AT, atLocal(FIELD_S_FRAME, 0, -6), 3.3, 1.2);
  const fieldSide = sideOf(fieldApproach);
  // home from the south field round the family's other side (west of the mud, by the
  // fence's west end), to where wei and berk come home too: the wallow's north-north-east
  const wallowTalk = WALLOW_TALK_N;
  return {
    id: 'steen', stand, frame, coverApproach,
    follow: [toward(MARKER, follow0[0], 0.9), ...follow0, toward(coverApproach, stand, 0.6)],
    nooks: [
      { u: 1.3, v: 0.5, side: -1 }, { u: -1.35, v: 0.35, side: 1 }, { u: 1.05, v: -0.35, side: 1 },
      { u: -1.15, v: -0.4, side: -1 }, { u: -1.05, v: 1.15, side: -1 },
    ],
    decoySpots: [
      { u: 1.9, v: -0.2, edge: true }, { u: 0.55, v: 0.35 }, { u: -0.45, v: 0.6 }, { u: -0.5, v: -0.55 },
      { u: -1.6, v: 1.05, edge: true }, { u: 1.45, v: 1.2, edge: true }, { u: -1.95, v: -0.25, edge: true },
      { u: 0.15, v: -0.95, edge: true }, { u: -0.65, v: 1.45, edge: true }, { u: 0.05, v: -0.3 },
    ],
    searchView: searchViewOf(frame, coverApproach, -0.42),
    leadClumps: leadClumpsOf(coverApproach, fieldApproach, [[0.25, -2.0, 0.9], [0.17, 1.85, 0.85], [0.5, -1.75, 0.8], [0.35, 2.4, 0.9]]),
    // (turned a little right: the west helipad stays out of the route's picture)
    field: 'S', fieldApproach, fieldSide, fieldView: fieldViewOf('S', fieldApproach, fieldSide, -0.15),
    toWallow: [{ x: -33.6, z: -23.1 }],
    wallowTalk, wallowGive: giveOf(wallowTalk, -1.9, 1.1), wallowView: wallowViewOf(wallowTalk),
    nest: atLocal(frame, 2.4, 1.2),
    // (the woodlark's spots 12-14 m short of the stand, either side of his way: it settles on
    // across the heath, never in the stand's bracken ahead)
    walkSpots: [{ x: -32.7, z: -34.0 }, { x: -35.0, z: -32.1 }],
    cover: { seed: 115, bracken: 0.45, grass: 0.15 },
    trees: [{ ...atLocal(frame, -1.34, 3.4), h: 5.5, rotY: 2.3 }],
    // (the way home lies straight behind him: the piglet comes out on his west side, so
    // the close pictures at the stand look out over the heath's rim, never east over the
    // roe's mornings to her home)
    outSide: -1,
  };
})();

/* -- berk: north-east, to a lone birch in the meadow -- */
const BERK = ((): Way => {
  const stand: Spot = { x: -2.5, z: 14.5 };
  // the follow: over the west trail beside the cabin, then up into the meadow
  const follow0: Spot[] = [{ x: -12.4, z: -2.2 }];
  const { frame, coverApproach } = standAt(stand, follow0[0]);
  const fieldApproach = approachOf(FIELD_N_AT, { x: -15, z: -14.5 }, 3.8, 1.2);
  const fieldSide = sideOf(fieldApproach);
  const wallowTalk = WALLOW_TALK_N;
  return {
    id: 'berk', stand, frame, coverApproach,
    follow: [toward(MARKER, follow0[0], 0.9), ...follow0, toward(coverApproach, stand, 0.6)],
    nooks: [
      { u: -1.4, v: 0.45, side: -1 }, { u: 1.2, v: 0.6, side: 1 }, { u: -1.0, v: -0.4, side: 1 },
      { u: 1.4, v: -0.3, side: -1 }, { u: -0.8, v: 1.05, side: -1 },
    ],
    decoySpots: [
      { u: -1.95, v: -0.3, edge: true }, { u: -0.4, v: 0.25 }, { u: 0.5, v: 0.1 }, { u: 0.3, v: -0.7 },
      { u: 0.65, v: 1.3 }, { u: 1.95, v: 0.3, edge: true }, { u: -1.7, v: 1.0, edge: true },
      { u: -0.3, v: -0.95, edge: true }, { u: 1.5, v: 1.15, edge: true }, { u: -0.9, v: 1.5, edge: true },
    ],
    searchView: searchViewOf(frame, coverApproach, 0.42),
    leadClumps: leadClumpsOf(coverApproach, fieldApproach, [[0.12, -2.2, 0.9], [0.22, 2.3, 0.85], [0.64, -2.2, 0.9], [0.75, 2.2, 0.8], [0.86, -2.3, 0.9], [0.94, -2.1, 0.8]]),
    field: 'N', fieldApproach, fieldSide, fieldView: fieldViewOf('N', fieldApproach, fieldSide, 0.3),
    toWallow: [],
    wallowTalk, wallowGive: giveOf(wallowTalk, -1.9, 1.1), wallowView: wallowViewOf(wallowTalk),
    nest: atLocal(frame, 2.45, 1.2),
    // (the second woodlark spot on the meadow leg, past its bend and 13.5 m short of the
    // stand: it settles on across the meadow, never in the stand's bracken ahead)
    walkSpots: [{ x: -13.9, z: -8.5 }, { x: -10.7, z: 3.8 }],
    cover: { seed: 151, bracken: 0.15, grass: 0.4 },
    // (behind the stand, beyond the search picture's top edge: from the follow a white beacon
    // over the bracken, never a dark trunk across the picture's corner)
    trees: [{ ...atLocal(frame, 0.8, 4.2), h: 9.5, rotY: 1.9 }],
  };
})();

/** The three ways (design §5.2). */
export const WAYS: Readonly<Record<WayId, Way>> = { wei: WEI, steen: STEEN, berk: BERK };

/** The way the home is laid out for when no play is on (free roam): run 6's stand. */
export const DEFAULT_WAY: WayId = 'wei';

/* ------------------------------------- the close pictures on the way home ---- */

/** Where the found piglet comes out to, beside him (`r`, facing the stand) — to the side
 *  away from the way home, so walking on he leads and the piglet follows; on a way whose
 *  way home lies straight behind him, the way's own `outSide`. */
export function outSpotOf(way: Way, r: Spot): Spot & { side: 1 | -1 } {
  const facing: Frame = { x: r.x, z: r.z, heading: headingTo(r, way.stand) };
  const side: 1 | -1 = way.outSide ?? (toLocal(facing, way.fieldApproach).u >= 0 ? -1 : 1);
  return { ...atLocal(facing, 1.15 * side, 0.15), side };
}

/** How close (m) the hungry piglet's snout comes to him at his bag ('voeren' at the stand). */
export const BAG_REACH = 0.55;

/** The close picture of him and the piglet nosing the bag on his hip ('voeren' at the
 *  stand): from across the two of them, side by side in the picture (run 7 body: the old
 *  view looked past him at the piglet, which stood behind his legs), the piglet whole and
 *  big enough to see and to reach for (pinned: no neighbour's home in it either). `pig`:
 *  where the piglet comes out beside him; it noses in to `BAG_REACH` of him. */
export function bagView(r: Spot, pig: Spot): WayView {
  const at = toward(r, pig, BAG_REACH);
  return {
    at: { x: (r.x + at.x) / 2, z: (r.z + at.z) / 2 }, heading: headingTo(r, at) - Math.PI / 2,
    halfW: 0.9, halfD: 0.6, tall: 1.3, pitchDeg: 20, insetTop: 120, insetBottom: 70,
    include: [{ x: r.x, z: r.z, h: 1.32 }, { x: at.x, z: at.z, h: 0.3 }],
  };
}

/** The close picture for 'dragen': the two of them side by side, what he looked at (the
 *  stand, the field) behind, turned a little away from the piglet's side. */
export function sideBySideView(r: Spot, pig: Spot, looked: Spot): WayView {
  const facingH = headingTo(r, looked);
  const side = toLocal({ x: r.x, z: r.z, heading: facingH }, pig).u >= 0 ? 1 : -1;
  return {
    at: { x: (r.x + pig.x) / 2, z: (r.z + pig.z) / 2 }, heading: facingH - 0.35 * side,
    halfW: 1.1, halfD: 0.6, tall: 1.3, pitchDeg: 22, insetTop: 40, insetBottom: 300,
    include: [{ x: r.x, z: r.z, h: 1.32 }, { x: pig.x, z: pig.z, h: 0.3 }],
  };
}

/* ------------------------------- the calm moments with the body (package body) ---- */

/** The sow's stare ('zeug'): she comes out of the mud toward him, to the rim between her
 *  piglets and him, until she stands this far (m) from him (never more than
 *  `ZEUG_STEP_M` from where she was, never toward the lens: the side lens sees her come
 *  across its picture) — big enough to read her look (≥ 110 px at 1280×800, pinned). */
export const ZEUG_STARE_M = 3.6;
export const ZEUG_STEP_M = 2.0;

/** Where the sow stands to look at him (`me`) from her place `home` (from her scratching
 *  post she steps clear of the log first). */
export function zeugStare(home: Spot, me: Spot): Spot {
  const log = wallowLog();
  let step = Math.min(ZEUG_STEP_M, Math.max(0, dist(home, me) - ZEUG_STARE_M));
  let p = toward(home, me, step);
  while (obstacleGap(log, p.x, p.z) + log.box!.pad < 0.55 && step < ZEUG_STEP_M) {
    step = Math.min(ZEUG_STEP_M, step + 0.1);
    p = toward(home, me, step);
  }
  return p;
}

/** The side lens on the sow's stare: low, the two of them facing each other across the
 *  picture, him whole at its side (`s`: which side the lens stands on, ±1). */
export function zeugView(me: Spot, sow: Spot, s: number): Omit<WayView, 'include'> & { include: readonly { x: number; z: number; h: number; r?: number }[] } {
  const zh = headingTo(me, sow), zd = dist(me, sow);
  return {
    at: toward(me, sow, zd * 0.55), heading: zh + 1.25 * s,
    halfW: zd * 0.5 + 0.6, halfD: 0.8, tall: 1.0, pitchDeg: 12, insetTop: 110, insetBottom: 30,
    include: [{ x: me.x, z: me.z, h: 1.32, r: 0.4 }, { x: sow.x, z: sow.z, h: 0.9 }], // (his shoulders both: never cut by the edge)
  };
}

/** 'pad' (the flip, walked): from where he stands at the mud, the spot he walks on to past
 *  the wallow — the way's `wallowGive`, or, when he stands almost on it already, the same
 *  way on from where he is (`WALK_ON_GOAL_M` along it), so there is always a way to walk. */
export const WALK_ON_GOAL_M = 2.4;
export function walkOnSpot(w: Way, me: Spot): Place {
  if (dist(me, w.wallowGive) >= WALK_ON_GOAL_M - 0.4) return w.wallowGive;
  const on = dirOfWay(w.wallowTalk, w.wallowGive);
  const p = { x: me.x + on.x * WALK_ON_GOAL_M, z: me.z + on.z * WALK_ON_GOAL_M };
  return { ...p, r: 0.6, heading: headingTo(p, WALLOW_AT) };
}
const dirOfWay = (a: Spot, b: Spot): Spot => { const d = dist(a, b) || 1; return { x: (b.x - a.x) / d, z: (b.z - a.z) / d }; };

/** 'voeren' at the field: where the yearling stops beside him at his bag (never at the
 *  lens, never nearer him than 1.2 m: the picture looks past him at it). */
export function yearlingSideOf(me: Spot, from: Spot): Spot {
  return atLocal({ x: me.x, z: me.z, heading: headingTo(me, from) }, 1.3, 0.75);
}

/** The yearling's way between its place at the mud and a field station: to the SOUTH field
 *  round the mud's west side and the fence's west end (these points from the wallow south;
 *  reversed coming back); to the north field straight, unless the log is in the way — then
 *  round its nearer end. Every leg keeps ≥ 0.5 m from the log (frisling.places.test.ts). */
const YEARLING_SOUTH: readonly Spot[] = [{ x: -31.0, z: -25.6 }, { x: -33.0, z: -29.8 }];
export const YEARLING_LOG_M = 0.5;
export function yearlingWay(w: Way, from: Spot, to: Spot): Spot[] {
  if (w.field === 'S') return from.z > to.z ? [...YEARLING_SOUTH] : [...YEARLING_SOUTH].reverse();
  const log = wallowLog();
  const clear = (a: Spot, b: Spot): boolean => legGap(log, a, b) >= YEARLING_LOG_M + 0.1;
  if (clear(from, to)) return [];
  // round the log's nearer end: a point past each end, out from the log by its half-width
  // and a pig's width; the one that keeps both legs clear and walks least
  const b = log.box!;
  const ends = [-1, 1].flatMap((e) => [-1, 1].map((sd) => {
    const c = Math.cos(b.rot), s = Math.sin(b.rot);
    const lx = e * (b.hx + 0.9), lz = sd * (b.hz + 0.6);
    return { x: log.x + lx * c + lz * s, z: log.z - lx * s + lz * c };
  }));
  const ok = ends.filter((p) => clear(from, p) && clear(p, to)).sort((p, q) => (dist(from, p) + dist(p, to)) - (dist(from, q) + dist(q, to)));
  return ok.length ? [ok[0]] : [];
}
/** The least gap (m) between a straight leg and the log's box (not its pad). */
export function legGap(log: Obstacle, a: Spot, b: Spot): number {
  let g = Infinity;
  for (let t = 0; t <= 1.0001; t += 0.02) g = Math.min(g, obstacleGap(log, a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t) + log.box!.pad);
  return g;
}

/* ---------------------------------------------------- the places table ---- */

/** The places of one way, flattened in with the fixed ones: what the world and the specs
 *  read (`__ranger.missionPlaces('frisling')`, the jeep parked out of them). */
export function placesFor(id: WayId): Record<string, Place> {
  const w = WAYS[id];
  const fieldAt = w.field === 'N' ? FIELD_N_AT : FIELD_S_AT;
  return {
    marker: { ...MARKER, r: 2.4 },
    /** the stand's centre, and the spot the ranger arrives at to search it */
    cover: { ...w.stand, heading: w.frame.heading },
    coverApproach: w.coverApproach,
    /** the rooting field's centre, and where the ranger stands to watch the route */
    field: { ...fieldAt, heading: w.fieldApproach.heading },
    fieldApproach: w.fieldApproach,
    /** the wallow's centre (the rotte's home), where the choices are made, and where he
     *  stops for the reunion */
    wallow: { ...WALLOW_AT, heading: w.wallowTalk.heading },
    wallowTalk: w.wallowTalk,
    wallowGive: w.wallowGive,
    /** the home place: the ranger ends within 12 m of it (golden step 8) */
    home: { ...WALLOW_AT },
  };
}

/** The places table (the HomeSpec's): the fixed places with THIS play's way flattened in
 *  (`useWay`). Before any play it holds the default way. */
export const FRISLING_PLACES: Record<string, Place> = placesFor(DEFAULT_WAY);

/** Lay this play's way into the places table (under the briefing card). */
export function useWay(id: WayId): void {
  Object.assign(FRISLING_PLACES, placesFor(id));
}

/* ----------------------------------------- the default way's old names ---- */

const STAND_AT = WEI.stand;
/** The default stand's frame (wei). */
export const STAND_FRAME: Frame = WEI.frame;
export const SEARCH_VIEW = WEI.searchView;
export const FIELD_SIDE = WEI.fieldSide;
export const FIELD_VIEW = WEI.fieldView;
export const WALLOW_VIEW = WEI.wallowView;

/** The seven patches of the north field (world x/z), in PRINT_SPOTS id order. */
export function fieldSpots(): (Spot & { id: number })[] { return fieldSpotsOf('N'); }

/** Loose clumps of cover a frightened piglet can dive into: beside a way's lead home, and
 *  the wallow's own clumps (between the north field and the wallow, and its rim). */
export function hideClumpsOf(id: WayId): (Spot & { size: number })[] {
  return [
    ...WAYS[id].leadClumps,
    ...WALLOW_CLUMPS.map(([u, v, size]) => ({ ...atLocal(WALLOW_FRAME, u, v), size })),
  ];
}
/** The default way's (wei's) dive clumps, and the wallow's. */
export function hideClumps(): (Spot & { size: number })[] { return hideClumpsOf(DEFAULT_WAY); }
/** How many of `hideClumpsOf(way)` stand beside the lead home (the first ones). */
export const leadClumpCount = (id: WayId): number => WAYS[id].leadClumps.length;
export const LEAD_CLUMP_COUNT = leadClumpCount(DEFAULT_WAY);
/** The wallow's own clumps (every way's dive spots there). */
export function wallowClumps(): (Spot & { size: number })[] {
  return WALLOW_CLUMPS.map(([u, v, size]) => ({ ...atLocal(WALLOW_FRAME, u, v), size }));
}

/** A nook's world spot and the way he lies there in a pose: 0 side-on (his striped flank
 *  toward the searching eye), 1 head toward the lens, 2 tail toward it. */
export function nookAt(id: WayId, nook: number, pose: 0 | 1 | 2): Spot & { yaw: number } {
  const w = WAYS[id];
  const n = w.nooks[nook];
  const p = atLocal(w.frame, n.u, n.v);
  const lens = w.searchView.heading; // the way the search lens looks
  const yaw = pose === 0 ? lens + n.side * (Math.PI / 2) + 0.3 * n.side
    : pose === 1 ? lens + Math.PI + 0.3 * n.side
      : lens + 0.3 * n.side;
  return { ...p, yaw };
}

/** A look-alike spot of a way's stand, in the world. */
export function decoyAt(id: WayId, i: number): Spot {
  const d = WAYS[id].decoySpots[i];
  return atLocal(WAYS[id].frame, d.u, d.v);
}

/** The lost piglet's spot when no play is on (free roam): the default way's first nook,
 *  side-on — where his squeak comes from, never heard at the clearing. */
export const LOST_SPOT: Spot & { yaw: number } = nookAt(DEFAULT_WAY, 0, 0);

/** The zoeken target of the 2D floor (content `doel`): the 2D field keeps its own layout. */
export const LOST_AT = { x: 52, y: 58 } as const;

/* --------------------------------------------------- who lives there ---- */

const at = (u: number, v: number): Spot => atLocal(WALLOW_FRAME, u, v);
const home = (u: number, v: number, idle: 'root' | 'lie' | 'stand' = 'root', roam = 0.5) => ({ ...at(u, v), idle, roam });

/** Who lives at the wallow, before and after (world/Residents.ts). The sow, a yearling
 *  (last year's young) and three striped piglets root there all along; the fourth piglet
 *  is lost, lying flat in a stand, until the ranger brings him home. */
export const FRISLING_RESIDENTS: readonly ResidentSpec[] = [
  { key: 'sow', animal: 'wildzwijn', before: home(-0.3, 0.3, 'root', 0.6), after: home(-0.3, 0.3, 'root', 0.6),
    voice: { call: 'wildzwijn', every: [9, 15], within: 16 } },
  // (run 7: off the fallen log, never rooting through it)
  { key: 'yearling', animal: 'overloper', before: home(0.6, -1.25, 'root', 0.6), after: home(0.6, -1.25, 'root', 0.6) },
  { key: 'p1', animal: 'frisling', before: home(-1.3, -0.5), after: home(-1.3, -0.5) },
  { key: 'p2', animal: 'frisling', before: home(0.6, 0.9), after: home(0.6, 0.9) },
  { key: 'p3', animal: 'frisling', before: home(-1.1, 1.0, 'root', 0.4), after: home(-1.1, 1.0, 'root', 0.4) },
  // the lost one: in a stand (laid per play in a nook of this play's way), home by his mother after
  { key: 'lost', animal: 'frisling', before: { x: LOST_SPOT.x, z: LOST_SPOT.z, yaw: LOST_SPOT.yaw, idle: 'lie', roam: 0 }, after: home(0.2, -0.6),
    voice: { call: 'piep', every: [4, 6], within: 22, state: 'before' } },
];

/**
 * The family's layouts at the wallow (design §5.4), one drawn per play: where each lies,
 * roots or scratches before the mission (the wallow frame: u across, v away from the
 * north-north-east). 0 'modder': the sow wallowing in the wet core, the piglets rooting at the
 * rim, the yearling off to the far side; 1 'rand': all rooting round the mud (run 6's,
 * the yearling off the log); 2 'boom': the sow at the fallen log (her scratching post),
 * the yearling and the piglets on the other side.
 */
export const FAMILY_LAYOUTS: readonly { id: 'modder' | 'rand' | 'boom'; poses: Readonly<Record<'sow' | 'yearling' | 'p1' | 'p2' | 'p3', ResidentPose>> }[] = [
  { id: 'modder', poses: {
    sow: { ...at(-0.35, 0.25), idle: 'root', roam: 0.15, yaw: WALLOW_FRAME.heading + 1.9 },
    yearling: home(-1.75, 0.95, 'root', 0.5),
    p1: home(0.9, -1.05, 'root', 0.4), p2: home(-1.35, -0.75, 'root', 0.4), p3: home(0.75, 0.95, 'root', 0.35),
  } },
  { id: 'rand', poses: {
    sow: home(-0.3, 0.3, 'root', 0.6), yearling: home(0.6, -1.25, 'root', 0.6),
    p1: home(-1.3, -0.5), p2: home(0.6, 0.9), p3: home(-1.1, 1.0, 'root', 0.4),
  } },
  { id: 'boom', poses: {
    sow: { ...at(1.45, 0.05), idle: 'stand', roam: 0, yaw: WALLOW_FRAME.heading + WALLOW_LOG.turn + Math.PI / 2 },
    yearling: home(-1.4, 0.55, 'root', 0.5),
    p1: home(-0.9, -0.8, 'root', 0.4), p2: home(0.2, 1.0, 'root', 0.35), p3: home(-1.65, -0.3, 'root', 0.35),
  } },
];

/** The frisling's home in the world. */
export const FRISLING_HOME: HomeSpec = {
  missionId: 'frisling',
  places: FRISLING_PLACES,
  residents: FRISLING_RESIDENTS,
  marker: { look: 'none' },
  // the stands lie 30-45 m from the wallow: the home stays drawn while he is near one
  spread: [WEI.stand, BERK.stand, STEEN.stand],
};

/** Ground the world's heather and grass scatter leaves bare: the wallow's mud and both
 *  rooting fields' patches (a tuft through turned earth reads wrong), and where he and the
 *  piglet stand to watch a route (no tuft hides the piglet there). Read at world build. */
export function frislingClearings(): { x: number; z: number; r: number }[] {
  const out = [
    { x: WALLOW_AT.x, z: WALLOW_AT.z, r: Math.max(WALLOW.halfW, WALLOW.halfD) + 0.9 },
    ...fieldSpotsOf('N').map((s) => ({ x: s.x, z: s.z, r: 0.95 })),
    ...fieldSpotsOf('S').map((s) => ({ x: s.x, z: s.z, r: 0.95 })),
  ];
  for (const id of WAY_IDS) {
    const w = WAYS[id];
    out.push({ x: w.fieldSide.x, z: w.fieldSide.z, r: 0.8 }, { x: w.fieldApproach.x, z: w.fieldApproach.z, r: 0.6 });
  }
  return out;
}

/* -------------------------------------------------------------- the clue ---- */

/**
 * The season's first clue as world dressing (design §4.1 beat 15, content clue 'spoor':
 * "Iemand knipte het hek stuk. In het zand staan grote voetstappen."): a stretch of old
 * wire fence on the far side of the wallow, one bay cut open, and a grown-up's boot
 * prints in a strip of sand through the gap. It is there after the mission (and after a
 * reload), never before. `v` is how far past the wallow's centre the fence runs.
 */
export const CLUE = { v: 5.4, posts: 5, bay: 1.55, gapBay: 1, postH: 1.2 } as const;
/** The fence line: `u` along it, `v` away from the wallow. */
export const CLUE_FRAME: Frame = { ...atLocal(WALLOW_FRAME, 0.4, CLUE.v), heading: WALLOW_FRAME.heading };

/** The fence posts, left to right. */
export function cluePosts(): Spot[] {
  const half = ((CLUE.posts - 1) * CLUE.bay) / 2;
  return Array.from({ length: CLUE.posts }, (_, i) => atLocal(CLUE_FRAME, -half + i * CLUE.bay, 0));
}

/** The middle of the cut bay (where the prints go through). */
export function clueGap(): Spot {
  const p = cluePosts();
  return { x: (p[CLUE.gapBay].x + p[CLUE.gapBay + 1].x) / 2, z: (p[CLUE.gapBay].z + p[CLUE.gapBay + 1].z) / 2 };
}

/** A grown-up's boot prints through the gap: from outside the fence to the wallow side
 *  (a long stride, 0.75 m), left and right feet apart; `yaw` is the way the toes point. */
export function bootPrints(): (Spot & { yaw: number; left: boolean })[] {
  const g = toLocal(CLUE_FRAME, clueGap());
  const out: (Spot & { yaw: number; left: boolean })[] = [];
  const toward = CLUE_FRAME.heading + Math.PI; // walking in: from the far side toward the wallow
  for (let i = 0; i < 8; i++) {
    const left = i % 2 === 0;
    const v = 2.6 - i * 0.75;
    const u = g.u + (left ? -0.13 : 0.13) + Math.sin(i * 1.7) * 0.05;
    out.push({ ...atLocal(CLUE_FRAME, u, v), yaw: toward + Math.sin(i * 2.3) * 0.08, left });
  }
  return out;
}

/** Everything of the frisling's home on the ground, every way (a neighbour keeps clear):
 *  the fixed places, both fields, every way's stand, follow, lead clumps and places. */
export function frislingGround(): { name: string; x: number; z: number; r: number }[] {
  const out: { name: string; x: number; z: number; r: number }[] = [
    { name: 'marker', ...MARKER, r: 2.4 },
    { name: 'wallow', ...WALLOW_AT, r: Math.max(WALLOW.halfW, WALLOW.halfD) + 0.4 },
    ...fieldSpotsOf('N').map((s) => ({ name: `fieldN-${s.id}`, x: s.x, z: s.z, r: 0.5 })),
    ...fieldSpotsOf('S').map((s) => ({ name: `fieldS-${s.id}`, x: s.x, z: s.z, r: 0.5 })),
    ...wallowClumps().map((c, i) => ({ name: `wallow-clump-${i}`, x: c.x, z: c.z, r: 0.5 })),
    ...cluePosts().map((p, i) => ({ name: `clue-post-${i}`, ...p, r: 0.3 })),
  ];
  for (const id of WAY_IDS) {
    const w = WAYS[id];
    out.push({ name: `${id}.stand`, ...w.stand, r: Math.hypot(STAND.halfW, STAND.halfD) + 0.5 });
    for (const [k, p] of Object.entries({ coverApproach: w.coverApproach, fieldApproach: w.fieldApproach, fieldSide: w.fieldSide, wallowTalk: w.wallowTalk, wallowGive: w.wallowGive })) {
      out.push({ name: `${id}.${k}`, x: p.x, z: p.z, r: 0.5 });
    }
    w.leadClumps.forEach((c, i) => out.push({ name: `${id}.clump-${i}`, x: c.x, z: c.z, r: 0.5 }));
    w.trees.forEach((t, i) => out.push({ name: `${id}.tree-${i}`, x: t.x, z: t.z, r: 0.5 }));
  }
  return out;
}

/* ------------------------------------------------------ a stand's cover ---- */

/** A dead-bracken look-alike clump's tag: the stand's decoy spot it stands on. */
export const spotTag = (i: number): string => `spot-${i}`;

/** The tussocks close round a nook (a bed the piglet presses into: an empty one is plain
 *  cover, never a miss), in the stand frame relative to the nook. */
const BED: readonly (readonly [number, number, Clump['kind']])[] = [[-0.42, 0.18, 'grass'], [0.44, 0.22, 'mix'], [0.05, 0.46, 'bracken'], [-0.3, -0.36, 'grass']];

/**
 * A way's stand of cover as its CoverField is built (frisling.home.ts) — pure, so the
 * places test measures the glimpse of the very stand the world draws: the stand's clumps
 * (its own mix of fronds and grass), a bed round every nook, a low clump of dead bracken on
 * every look-alike spot (tagged `spot-<i>`; each play shows only its trial's), and the
 * clumps beside its lead home.
 */
export function standCover(id: WayId): Clump[] {
  const w = WAYS[id];
  const nooks = w.nooks.map((n) => atLocal(w.frame, n.u, n.v));
  const spots = w.decoySpots.map((d) => atLocal(w.frame, d.u, d.v));
  const keep = (u: number, v: number): boolean => {
    const p = atLocal(w.frame, u, v);
    return !nooks.some((q) => dist(p, q) < 0.36) && !spots.some((q) => dist(p, q) < 0.45);
  };
  const out: Clump[] = standClumps(w.frame, STAND.halfW + 0.45, STAND.halfD + 0.4, 0.52, w.cover.seed, keep);
  // this stand's own texture: more fronds (the forest edge), more grass (the meadow)
  const rnd = stream(w.cover.seed + 7);
  for (const c of out) {
    const r = rnd();
    c.kind = r < w.cover.bracken ? 'bracken' : r < w.cover.bracken + w.cover.grass ? 'grass' : 'mix';
  }
  // a bed round every nook (its tussocks clear of the other nooks and the look-alike spots)
  w.nooks.forEach((n, ni) => {
    for (const [u, v, kind] of BED) {
      const p = atLocal(w.frame, n.u + u, n.v + v);
      if (nooks.some((q, qi) => qi !== ni && dist(p, q) < 0.4) || spots.some((q) => dist(p, q) < 0.4)) continue;
      out.push({ ...p, kind, size: 0.95 });
    }
  });
  spots.forEach((p, i) => out.push({ ...p, kind: 'dead', size: 1, decoy: spotTag(i) }));
  for (const c of w.leadClumps) out.push({ x: c.x, z: c.z, kind: c.size >= 1 ? 'bracken' : 'mix', size: c.size });
  return out;
}

/** The seed a way's stand grows its plants from (CoverField). */
export const standSeed = (id: WayId): number => WAYS[id].cover.seed + 1000;

/** (exported for the tests) the stand's centre of the default way */
export const DEFAULT_STAND: Spot = STAND_AT;

/* ---------------------------------------------------- the woodlark's flight ---- */

/** The follow lens looks from this far behind him (m; world/CameraRig camOffset's boom). */
export const LENS_BACK = 4.6;
/** A woodlark flushed from the heather where he walks settles this far from the follow lens
 *  once it has landed (m, along its line: his picture's middle distance, where a bird reads)
 *  and this far across that line (m: well to one side of him, never in his way). */
export const LARK_LAND = { depth: [8, 10], across: [3.6, 4.4] } as const;

/**
 * Where a woodlark that rose in front of him may settle (package body r2): ACROSS his
 * picture, never along the lens away from it: it keeps pace with the picture as he walks on
 * (`walked`: how far on he will be halfway through its sit, m), so it sits at the picture's
 * middle distance (`LARK_LAND.depth` from the lens then) well to one side. `look` is the lens's
 * heading (it looks along it from behind him), `side` the way across it (+1: u > 0 of that
 * frame). In the order to try them (the real lens picks the first in view now and once he
 * walked on, on the other side of the picture from where it rose, on the world's free
 * ground): open ground of this home only, clear of every way's stand (it never settles in
 * the search's bracken), the mud and its family, the rooting fields, the ring and the fence.
 */
export function larkLandings(me: Spot, look: number, side: 1 | -1, walked: number): Spot[] {
  const frame: Frame = { x: me.x, z: me.z, heading: look };
  const out: Spot[] = [];
  for (const depth of [9, 8.5, 9.5, LARK_LAND.depth[0], LARK_LAND.depth[1]]) {
    for (const u of [4, LARK_LAND.across[0], LARK_LAND.across[1]]) {
      const p = atLocal(frame, side * u, walked + depth - LENS_BACK);
      if (larkFree(p)) out.push(p);
    }
  }
  return out;
}

/** Open ground of the home a woodlark may settle on: the heath (or the dry meadow, far from
 *  the ven's water), the stands, the mud, the fields, the ring and the fence kept clear. */
export function larkFree(p: Spot): boolean {
  const b = biomeAt(p.x, p.z);
  if (b !== 'heide' && !(b === 'ven' && Math.hypot(p.x - VEN_CENTER.x, p.z - VEN_CENTER.z) > 50)) return false;
  if (Math.hypot(p.x, p.z) > 60) return false;
  for (const id of WAY_IDS) if (dist(p, WAYS[id].stand) < STAND.halfW + 4.4) return false;
  if (dist(p, WALLOW_AT) < 6.5) return false;
  if (dist(p, FIELD_N_AT) < 5 || dist(p, FIELD_S_AT) < 5) return false;
  if (dist(p, MARKER) < 2.5) return false;
  return !cluePosts().some((q) => dist(p, q) < 1.5);
}
