/**
 * ree.places.ts — where "Het reekalf in het gras" happens in the world, and who lives
 * there (THREE-free; `ree.places.test.ts` pins it). Chosen by looking at the world
 * (design run6-missions §4.2): the open heath north-east of the marker, where the heath
 * meets the bos (x ≈ 0 on this latitude), well clear of the frisling's wallow and
 * fence to the west.
 *
 * Seen by a child at the empty marker ring, looking on the way he came (away from the
 * clearing): 9 m ahead a MEADOW of tall pijpenstrootje; behind it, 21 m out against the
 * forest edge, a small COPSE (birches, a pine, junipers, bracken) where the DOE grazes
 * at the edge. Walking up she lifts her head and slips into the copse; her calf lies
 * pressed flat in the meadow. Off to the left, 11 m past the meadow, a HIDE (a juniper
 * and a fallen log) looks across the meadow at the copse, and a wet POOL lies on the
 * way there.
 *
 *   marker ── (her prints, ~6 m) ── meadow edge (search; three choices at the calf)
 *                                        │ walk away quietly (~11 m), the pool halfway
 *                                      hide (watch her come back; the flip)
 *   copse (the doe's cover) ── her way back to the calf, across the hide's view
 */

import { RANGER_STAND_HEIGHT, SIZE } from '../../AnimalScale.ts';
import { patchLocal } from '../../play/kit-math.ts';
import type { HomeSpec, HomeTree, Place, ResidentSpec, Spot } from '../types.ts';
import { approachOf, atLocal, dist, headingTo, toLocal, toward, type Frame } from '../places.ts';

/** The ree marker: the heide's second anchor (Markers.placeMarkers: `anchorInBiome
 *  ('heide', 31)` fanned +0.28 rad). It stays where it always stood; the test checks
 *  the anchor still lands here. */
export const MARKER: Spot = { x: -15.008831796612796, z: -27.124434889984062 };
/** Where the story lies from the marker: the meadow 9.5 m on the way the child walked
 *  in (away from the clearing, a heading in rad). */
const TO_MEADOW = (172 * Math.PI) / 180;
/** The centre of the meadow of tall grass the calf lies in. */
const MEADOW_AT: Spot = atLocal({ ...MARKER, heading: TO_MEADOW }, 0, 9.5);

/** The meadow: half-size across (u) and in depth (v) of its search ellipse (m), laid in
 *  the frame the ranger sees it in when he arrives from the marker. The zoeken trial
 *  (target + decoys, 0..100) lands on it through `patchLocal`, the 3D zoeken's mapping. */
export const MEADOW = { halfW: 2.4, halfD: 2.0 } as const;
/** How far out from the meadow's centre the ranger stops to search it (m). */
const MEADOW_BACK = 3.4;

const meadowApproach = approachOf(MEADOW_AT, MARKER, MEADOW_BACK, 1.3);

/** The meadow's frame (u across, v away from the ranger arriving from the marker). */
export const MEADOW_FRAME: Frame = { x: MEADOW_AT.x, z: MEADOW_AT.z, heading: meadowApproach.heading! };
/** A 2D trial point (0..100) on the meadow, in the world. */
export function onMeadow(x: number, y: number): Spot {
  const { u, v } = patchLocal(x, y, MEADOW.halfW, MEADOW.halfD);
  return atLocal(MEADOW_FRAME, u, v);
}

/** The zoeken target (content `doel` 48, 60): where the calf lies. */
export const CALF_AT = { x: 48, y: 60 } as const;
/** Where the calf lies, and the way it lies: side-on to the ranger arriving from the
 *  marker (its spotted flank and back toward the searching eye). */
export const CALF_SPOT: Spot & { yaw: number } = { ...onMeadow(CALF_AT.x, CALF_AT.y), yaw: MEADOW_FRAME.heading - Math.PI / 2 + 0.2 };

/* ------------------------------------------------------------ the copse ---- */

/** The copse stands just east of the meadow (toward the forest's edge): its gap, the way
 *  the doe goes in and out, looks at the calf 5.5 m off, so from the hide the whole of
 *  her way back fits one binocular view. (A heading from the calf, rad; metres.) */
const TO_GAP = (105 * Math.PI) / 180;
const GAP_OFF = 5.5;
/** The gap between the two front junipers she walks in and out through. */
export const COPSE_GAP: Spot = atLocal({ ...CALF_SPOT, heading: TO_GAP }, 0, GAP_OFF);
const COPSE_AT: Spot = atLocal({ ...CALF_SPOT, heading: TO_GAP }, 0, GAP_OFF + 2.4);
/** The copse's frame: `v` runs from its middle out of its gap, toward the calf. */
export const COPSE_FRAME: Frame = { x: COPSE_AT.x, z: COPSE_AT.z, heading: headingTo(COPSE_AT, CALF_SPOT) };

const inCopse = (u: number, v: number): Spot => atLocal(COPSE_FRAME, u, v);

/** Where the doe grazes before: at the copse's corner toward the marker (so from the
 *  ring she is seen beside the meadow's tall grass, never behind it), beside the gap's
 *  juniper, out on open heath. */
const GRAZE: Spot = inCopse(-3.3, 1.2);
/** Her bed inside the copse, behind the right-hand juniper and the bracken (hidden:
 *  not straight behind the gap, so no line of sight runs in through it). */
export const DOE_BED: Spot & { yaw: number } = { ...inCopse(2.2, -0.25), yaw: COPSE_FRAME.heading + Math.PI * 0.6 };

/** Where her calf beds down beside her (after), in the copse's bracken. */
export const CALF_BED: Spot & { yaw: number } = { ...inCopse(0.9, -0.7), yaw: COPSE_FRAME.heading + Math.PI * 0.4 };

/** The copse's junipers (u, v in its frame, height m): two in front with the gap
 *  between them, one behind her bed. */
export const JUNIPERS: readonly { u: number; v: number; h: number; turn: number }[] = [
  { u: -1.75, v: 2.2, h: SIZE.jeneverbes.h * 1.2, turn: 0.4 },
  { u: 1.85, v: 1.9, h: SIZE.jeneverbes.h * 1.05, turn: 2.1 },
  { u: 0.9, v: -1.9, h: SIZE.jeneverbes.h * 1.3, turn: 4.0 },
];
/** A juniper's solid radius (m) for its height: the ranger and the doe walk round it. */
export function juniperR(h: number): number {
  return 0.55 * (h / SIZE.jeneverbes.h) + 0.35;
}

/** The copse's trees: three birches and a Scots pine, grown (the scale table). */
export const COPSE_TREES: readonly HomeTree[] = [
  { ...inCopse(-2.6, -0.6), species: 'prop-birch-tree', h: SIZE.berk.h * 0.92 },
  { ...inCopse(3.4, -1.4), species: 'prop-birch-tree', h: SIZE.berk.h * 1.02 },
  { ...inCopse(-0.7, -2.5), species: 'prop-pine-scots', h: SIZE.den.h * 0.95 },
  { ...inCopse(3.3, 2.3), species: 'prop-birch-tree', h: SIZE.berk.h * 0.84 },
];

/* ---------------------------------------------------------- the hide, the pool ---- */

/** The hide: a juniper and a fallen log, 9.5 m off the doe's way back to her calf, on
 *  the side toward the marker, so it looks OUT across the meadow and the copse at the
 *  open heath and the far forest (never back at the clearing and its cabin); her way
 *  runs ACROSS its view, never toward it. */
const HIDE_BACK = 11.0;
/** (along her way: toward the copse +, the calf −) */
const HIDE_SHIFT = 0;
/** Where mother and calf meet: on the open heath just out of the tall grass, toward her
 *  gap — the calf walks out of the grass to her there (a calf standing IN the grass
 *  would be hidden), so the reunion is seen whole. */
export const MEET: Spot = toward(CALF_SPOT, COPSE_GAP, 4.3);
/** The middle of the watched scene: her gap, the meeting place, the edge of the grass. */
const WATCH_MID: Spot = toward(MEET, CALF_SPOT, 0.7);
const HIDE_AT: Spot = (() => {
  const d = { x: COPSE_GAP.x - CALF_SPOT.x, z: COPSE_GAP.z - CALF_SPOT.z };
  const l = Math.hypot(d.x, d.z);
  const n = { x: d.z / l, z: -d.x / l };
  const s = (MARKER.x - WATCH_MID.x) * n.x + (MARKER.z - WATCH_MID.z) * n.z > 0 ? 1 : -1; // the marker's side
  return {
    x: WATCH_MID.x + n.x * HIDE_BACK * s + (d.x / l) * HIDE_SHIFT,
    z: WATCH_MID.z + n.z * HIDE_BACK * s + (d.z / l) * HIDE_SHIFT,
  };
})();
/** The hide's frame: `v` looks from the ranger's spot at the watched scene. */
export const HIDE_FRAME: Frame = { ...HIDE_AT, heading: headingTo(HIDE_AT, WATCH_MID) };
/** The hide's juniper (to his right) and its fallen log (across in front of him, to the
 *  right: he comes in from the pool on the left and looks out past its end). */
export const HIDE_JUNIPER = { ...atLocal(HIDE_FRAME, 1.45, 0.25), h: SIZE.jeneverbes.h * 1.1 } as const;
/** (`turn` is its rotation.y: the log's length runs along its local x, so `turn` =
 *  the view's heading lays it ACROSS the view; `half` its half length, m) */
export const HIDE_LOG = { ...atLocal(HIDE_FRAME, 0.95, 1.1), turn: HIDE_FRAME.heading, half: 0.85 } as const;
/** A point `k` (−1..1) along the hide's log (world). */
export function alongLog(k: number): Spot {
  return { x: HIDE_LOG.x + Math.cos(HIDE_LOG.turn) * k * HIDE_LOG.half, z: HIDE_LOG.z - Math.sin(HIDE_LOG.turn) * k * HIDE_LOG.half };
}

/** Where the ranger stands to talk to (not touch) the calf: 1.35 m from it, on the side
 *  he came from. */
const calfTalk: Place = (() => {
  const p = toward(CALF_SPOT, meadowApproach, 1.35);
  return { ...p, r: 0.4, heading: headingTo(p, CALF_SPOT) };
})();

/** The wet pool, on the straight way from the calf to the hide (a little past half way,
 *  so from the hide it lies under the watch, not in it). */
const POOL_AT: Spot = toward(calfTalk, HIDE_AT, dist(calfTalk, HIDE_AT) * 0.6);
export const POOL = { ...POOL_AT, halfW: 1.45, halfD: 0.95, heading: headingTo(calfTalk, HIDE_AT) } as const;
/** The pool's frame: `v` along the way to the hide, `u` across it. */
export const POOL_FRAME: Frame = { x: POOL.x, z: POOL.z, heading: POOL.heading };
/** Where he stops at the pool's near edge (the choice), and the way round it (walked
 *  on the right answer: along its side, to its far edge). */
const poolEdge: Place = { ...atLocal(POOL_FRAME, 0, -(POOL.halfD + 0.55)), r: 1.9, heading: POOL.heading };
export const POOL_ROUND: readonly Spot[] = [
  atLocal(POOL_FRAME, POOL.halfW + 0.75, -0.35),
  atLocal(POOL_FRAME, POOL.halfW + 0.55, POOL.halfD + 0.45),
  atLocal(POOL_FRAME, 0.2, POOL.halfD + 0.9),
];
/** "Recht erdoor": the step he takes into the pool (and back out). */
export const POOL_IN: Spot = atLocal(POOL_FRAME, 0, -0.4);

const hide: Place = { ...HIDE_AT, r: 0.7, heading: HIDE_FRAME.heading };
/** "Loop rustig weg": his quiet steps back out of the hide, away from the family. */
const hideLeave: Place = { ...atLocal(HIDE_FRAME, 0.2, -1.5), r: 0.5, heading: HIDE_FRAME.heading };

/** The places table. */
export const REE_PLACES = {
  marker: { ...MARKER, r: 2.4 },
  /** the meadow's centre, and where the ranger stands to search it */
  meadow: { ...MEADOW_AT, heading: meadowApproach.heading },
  meadowApproach,
  /** where he stands by the calf for the three choices */
  calfTalk,
  /** the copse's centre, her gap, and where she grazes */
  copse: { ...COPSE_AT, heading: COPSE_FRAME.heading },
  gap: { ...COPSE_GAP },
  graze: { ...GRAZE },
  /** the pool's near edge (its choice) */
  poolEdge,
  /** the hide, and his quiet steps away from it */
  hide,
  hideLeave,
  /** the home place: where mother and calf met, and graze after (the ranger ends
   *  within 12 m of it) */
  home: { ...MEET },
} as const satisfies Record<string, Place>;

/* ----------------------------------------------------------- the framed views ---- */

/** The search: the lens over the meadow from the ranger's side, him in a lower corner. */
export const SEARCH_VIEW = {
  at: { x: MEADOW_AT.x, z: MEADOW_AT.z }, heading: MEADOW_FRAME.heading - 0.4,
  halfW: 2.85, halfD: 2.1, tall: 1.0, pitchDeg: 38, insetTop: 100, insetBottom: 12,
  include: [{ x: meadowApproach.x, z: meadowApproach.z, h: RANGER_STAND_HEIGHT }],
} as const;
/** The three choices by the calf: over his shoulder and from above, the calf's spotted
 *  flank beyond his boots (he in a lower corner, never in front of it), wide enough that
 *  a calf bolting a metre or two stays in the picture. */
export const CALF_VIEW = {
  at: toward(CALF_SPOT, calfTalk, 0.15), heading: headingTo(calfTalk, CALF_SPOT) + 0.5,
  halfW: 1.7, halfD: 1.0, tall: 0.9, pitchDeg: 52, insetTop: 40, insetBottom: 300,
  include: [{ x: calfTalk.x, z: calfTalk.z, h: RANGER_STAND_HEIGHT }],
} as const;
/** Leaving the calf: the lens swings round behind him as he turns away from it and
 *  takes his first quiet steps toward the pool (the hide's juniper beyond it), so the
 *  walk that follows starts with the way ahead in view. `at` his first steps' end. */
export function leaveView(at: Spot): {
  at: Spot; heading: number; halfW: number; halfD: number; tall: number; pitchDeg: number; insetTop: number; insetBottom: number;
  include: { x: number; z: number; h: number }[]; seconds: number;
} {
  const h = headingTo(at, POOL);
  return {
    at: toward(at, POOL, 2.2), heading: h - 0.2, halfW: 1.6, halfD: 1.6, tall: 1.2, pitchDeg: 30, insetTop: 96, insetBottom: 16,
    include: [{ x: at.x, z: at.z, h: RANGER_STAND_HEIGHT }], seconds: 2.6,
  };
}

/** The pool: the lens behind him, the water in front (its choice, a splash, the way round). */
export const POOL_VIEW = {
  at: { x: POOL.x, z: POOL.z }, heading: POOL.heading + 0.35,
  halfW: 2.3, halfD: 1.4, tall: 0.6, pitchDeg: 32, insetTop: 40, insetBottom: 290,
  include: [{ x: poolEdge.x, z: poolEdge.z, h: RANGER_STAND_HEIGHT }],
} as const;
/** The watch from the hide (binoculars): the lens moves toward the meadow and holds the
 *  copse's gap and the calf in one picture; the doe's way back runs across it. */
export const WATCH_VIEW = {
  at: WATCH_MID, heading: HIDE_FRAME.heading,
  halfW: 2.8, halfD: 1.4, tall: SIZE.ree.h + 0.3, pitchDeg: 12, insetTop: 110, insetBottom: 220,
} as const;

/* ------------------------------------------------------------ who lives here ---- */

/**
 * The doe grazes at the copse's open side all along (shy: she slips into the copse
 * when the ranger comes within 14 m, and comes back out once he is 19 m off); her calf
 * lies pressed flat in the meadow. After, the two graze together at the copse's edge
 * (and step into it together when he comes close).
 */
export const REE_RESIDENTS: readonly ResidentSpec[] = [
  { key: 'doe', animal: 'ree', len: SIZE.ree.len,
    before: { ...GRAZE, yaw: headingTo(GRAZE, MARKER) + Math.PI / 2, idle: 'graze', roam: 0.5 },
    after: { ...MEET, yaw: headingTo(MEET, CALF_SPOT) + 0.3, idle: 'graze', roam: 0.4 },
    // before: she slips into the copse when he comes within 8 m; after (with her calf) she
    // lets him watch from the hide, and only steps in when he walks right up
    shy: [
      { within: 8, back: 13, to: DOE_BED, lie: true, state: 'before' },
      { within: 4, back: 7, to: DOE_BED, lie: true, state: 'after', after: 4 },
    ] },
  { key: 'calf', animal: 'reekalf', len: SIZE.reekalf.len,
    before: { ...CALF_SPOT, yaw: CALF_SPOT.yaw, idle: 'lie', roam: 0 },
    after: { ...atLocal({ ...MEET, heading: headingTo(MEET, CALF_SPOT) + 0.3 }, -0.65, -0.45), yaw: headingTo(MEET, CALF_SPOT) - 0.2, idle: 'graze', roam: 0.3 },
    shy: [{ within: 4, back: 7, to: CALF_BED, lie: true, state: 'after', after: 4 }] },
];

/** The reekalf's home in the world. */
export const REE_HOME: HomeSpec = {
  missionId: 'ree-niet-aanraken',
  places: REE_PLACES,
  residents: REE_RESIDENTS,
  marker: { look: 'none' },
  trees: COPSE_TREES,
};

/** Ground the world's heather scatter leaves bare: the meadow (tall grass grows there,
 *  not heather cushions) and the wet pool. */
export function reeClearings(): { x: number; z: number; r: number }[] {
  return [
    { x: MEADOW_AT.x, z: MEADOW_AT.z, r: MEADOW.halfW + 0.3 },
    { x: POOL.x, z: POOL.z, r: POOL.halfW + 0.5 },
  ];
}

/** The doe's small prints ("prenten") from the marker ring to the meadow's near edge:
 *  where she walked; they end at the meadow, never at the calf. */
export function slotTrail(): { from: Spot; to: Spot } {
  return { from: toward(MARKER, meadowApproach, 0.9), to: toward(meadowApproach, MEADOW_AT, 0.55) };
}

/** The calf's bolt spots for a wrong answer: a few metres to the side (never toward the
 *  ranger or the lens), within the meadow; it bolts there and back. */
export function calfBolt(): Spot {
  const f = { x: CALF_SPOT.x, z: CALF_SPOT.z, heading: headingTo(calfTalk, CALF_SPOT) };
  return atLocal(f, -1.35, 0.55);
}

/** The spot at the doe's flank where her calf drinks (its head under her belly), on her
 *  right (`side` 1) or her left (−1): the side the watching eye is on. */
export function drinkSpot(doe: Spot & { yaw: number }, len: number, side: 1 | -1 = 1): Spot & { yaw: number } {
  const f = { x: doe.x, z: doe.z, heading: doe.yaw };
  return { ...atLocal(f, 0.34 * side, -0.12 * len), yaw: doe.yaw + Math.PI - 0.25 * side };
}

/** Frame-local position of a spot in the meadow's frame (for the tests). */
export function inMeadow(p: Spot): { u: number; v: number } { return toLocal(MEADOW_FRAME, p); }
