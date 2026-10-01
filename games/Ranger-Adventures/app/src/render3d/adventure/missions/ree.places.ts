/**
 * ree.places.ts — where "Het reekalf in het gras" happens in the world, and who lives
 * there (THREE-free; `ree.places.test.ts` pins it). Chosen by looking at the world
 * (design run6-missions §4.2, run 7 `state/ree/design.md` §6.2): the open heath round a
 * small COPSE (birches, a pine, junipers, bracken) where the heath meets the bos, south of
 * the marker, well clear of the frisling's wallow to the north-west.
 *
 * Run 7: the doe lays her calf in one of THREE stands of tall pijpenstrootje round her
 * copse, and each play draws one (ree.variety.ts). A LAYOUT is a stand + the side he
 * searches it from + her trodden path (wissel) there from the marker ring + the copse gap
 * she goes in and out by + the hide he watches from:
 *
 *   A  north-west of the copse, searched from its north-west, the copse beyond; her
 *      wissel bends west from the ring; the hide north of her way, looking south-west.
 *   B  south of the copse, searched from its west, the forest's edge beyond; her wissel
 *      runs south past A's west; the hide at the forest's edge, looking west.
 *   C  out on the open heath south-west, searched from its north; her wissel runs south-
 *      west; the hide north-west of her way, looking south-east at the copse.
 *
 * Every stand is the same size and is searched from the same distance and angle (decision
 * 1: a variant never changes how hard the search is); the calf lies in one of four spots
 * (the content's `doelen`, the same relative spot in every stand), never in the middle of
 * the picture.
 *
 *   ring ── (her prints on her wissel, 10-25 m) ── the stand (search; the calm moments)
 *                                     │ walk away quietly (12-18 m; the pool on it, or
 *                                     │ on her wissel before)
 *                                    hide (watch her come back; the flip)
 *   copse (the doe's cover) ── her way out of its gap to the calf, across the hide's view
 */

import { RANGER_STAND_HEIGHT, SIZE } from '../../AnimalScale.ts';
import { patchLocal } from '../../play/kit-math.ts';
import type { HomeSpec, Place, ResidentSpec, Spot } from '../types.ts';
import { atLocal, dist, headingTo, toLocal, toward, type Frame } from '../places.ts';
import { REE_LAYOUT_IDS, type ReeLayoutId } from './ree.variety.ts';

/** The ree marker: the heide's second anchor (Markers.placeMarkers: `anchorInBiome
 *  ('heide', 31)` fanned +0.28 rad). It stays where it always stood; the test checks
 *  the anchor still lands here. */
export const MARKER: Spot = { x: -15.008831796612796, z: -27.124434889984062 };

/** A stand of tall grass: half-size across (u) and in depth (v) of its search ellipse (m),
 *  laid in the frame he searches it in. The zoeken trial (target + decoys, 0..100) lands
 *  on it through `patchLocal`, the 3D zoeken's mapping. The same in every layout. */
export const STAND = { halfW: 2.4, halfD: 2.0 } as const;
/** Its looser fringe: tussocks on ellipses `k` × (a, b) round it, thinning into the heath. */
export const FRINGE = { a: STAND.halfW + 0.45, b: STAND.halfD + 0.4, kMin: 1.12, kMax: 1.47 } as const;
/** Where he stands to search a stand: on open heath, 0.9 m beyond its outermost fringe
 *  tussock (on the ellipse of these half-axes round its centre), off to one side of the
 *  way he looks (`SEARCH_LENS.side`), so the lens sees the grass past him and he stands
 *  in a lower corner of the picture, seen from behind. */
export const SEARCH_RING = { a: FRINGE.a * FRINGE.kMax + 0.9, b: FRINGE.b * FRINGE.kMax + 0.9 } as const;

/* ------------------------------------------------------------ the copse ---- */

/** The copse's centre (the doe's cover, shared by every layout), and its frame: `v` runs
 *  from its middle out of its west gap (layout A's), `u` across to the south. */
const COPSE_AT: Spot = { x: -6.206608284791748, z: -38.19390538953443 };
export const COPSE_FRAME: Frame = { x: COPSE_AT.x, z: COPSE_AT.z, heading: -1.308996938995747 };
const inCopse = (u: number, v: number): Spot => atLocal(COPSE_FRAME, u, v);
/** The bracken ellipse of the copse (u, v half-axes, m). */
export const COPSE_SIZE = { a: 3.9, b: 3.1 } as const;

/** The copse's junipers (u, v in its frame, height m): two in front of the west gap, one
 *  behind her bed, one by the south-west gap. */
export const JUNIPERS: readonly { u: number; v: number; h: number; turn: number }[] = [
  { u: -1.75, v: 2.2, h: SIZE.jeneverbes.h * 1.2, turn: 0.4 },
  { u: 1.85, v: 1.9, h: SIZE.jeneverbes.h * 1.05, turn: 2.1 },
  { u: 0.9, v: -1.9, h: SIZE.jeneverbes.h * 1.3, turn: 4.0 },
];
/** A juniper's solid radius (m) for its height: the ranger and the doe walk round it. */
export function juniperR(h: number): number {
  return 0.55 * (h / SIZE.jeneverbes.h) + 0.35;
}

/** The cover a doe lies up in: an ellipse of bracken round a frame (`v` out of its gap),
 *  its junipers (world, height, turn). */
export interface Cover { frame: Frame; a: number; b: number; junipers: readonly (Spot & { h: number; turn: number })[] }

/** The copse: the doe's home, and her cover in layouts A and B. */
export const COPSE: Cover = {
  frame: COPSE_FRAME, a: COPSE_SIZE.a, b: COPSE_SIZE.b,
  junipers: JUNIPERS.map((j) => ({ ...inCopse(j.u, j.v), h: j.h, turn: j.turn })),
};

/** A tree of the copse: its species and its grown height (m), from the scale table. It
 *  joins the world's forest (ree.ts hands it over as the home's `trees`). */
export interface CopseTree extends Spot {
  species: 'prop-pine-scots' | 'prop-birch-tree';
  h: number;
}

/** The copse's trees: three birches and a Scots pine, grown (the scale table). */
export const COPSE_TREES: readonly CopseTree[] = [
  { ...inCopse(-2.6, -0.6), species: 'prop-birch-tree', h: SIZE.berk.h * 0.92 },
  { ...inCopse(3.4, -1.4), species: 'prop-birch-tree', h: SIZE.berk.h * 1.02 },
  { ...inCopse(-0.7, -2.5), species: 'prop-pine-scots', h: SIZE.den.h * 0.95 },
  { ...inCopse(3.3, 2.3), species: 'prop-birch-tree', h: SIZE.berk.h * 0.84 },
];

/** Where the doe grazes in free roam (before any play laid her elsewhere): at the copse's
 *  corner toward the marker, out on open heath. */
const GRAZE: Spot = inCopse(-3.3, 1.2);
/** Her bed inside the copse in free roam, behind the right-hand juniper and the bracken
 *  (a shy doe slips in here when he comes near). */
export const DOE_BED: Spot & { yaw: number } = { ...inCopse(2.2, -0.25), yaw: COPSE_FRAME.heading + Math.PI * 0.6 };
/** Where her calf beds down beside her (after), in the copse's bracken. */
export const CALF_BED: Spot & { yaw: number } = { ...inCopse(0.9, -0.7), yaw: COPSE_FRAME.heading + Math.PI * 0.4 };

/* -------------------------------------------------------------- the pool ---- */

/** The wet pool's water (half-sizes, m): one pool, laid on this play's way. */
export const POOL = { halfW: 1.45, halfD: 0.95 } as const;

/** A pool on a way: its middle and its frame (`v` along the way he walks, `u` across),
 *  where a boot that went in steps back out to (its near edge), and the way round it a
 *  perfect player walks (golden's hint: along its side to its far edge). */
export interface PoolSpot extends Frame {
  edge: Place;
  round: readonly Spot[];
  /** which side he walks round (+1: its +u side) */
  side: 1 | -1;
  /** which leg of its way it lies on (her wissel's: 0 ring→bend, 1 bend→search; his way's:
   *  0 stand→first point …) */
  leg: number;
}

/** A pool lying across the way from `a` to `b`, `at` (0..1) along it, walked round on its
 *  `side`. */
function poolOn(a: Spot, b: Spot, at: number, side: 1 | -1, leg: number): PoolSpot {
  const p = toward(a, b, dist(a, b) * at);
  const f: Frame = { x: p.x, z: p.z, heading: headingTo(a, b) };
  return {
    ...f, side, leg,
    edge: { ...atLocal(f, 0, -(POOL.halfD + 0.55)), r: 1.9, heading: f.heading },
    round: [
      // (a stride clear of the water all the way round: a child steering with the arrow
      // keys swings a little wide of the line)
      atLocal(f, side * (POOL.halfW + 1.15), -0.6),
      atLocal(f, side * (POOL.halfW + 0.95), POOL.halfD + 0.7),
      atLocal(f, side * 0.3, POOL.halfD + 1.25),
    ],
  };
}

/* ------------------------------------------------------------ the layouts ---- */

/** A framed view of a world spot (play/stage `anchor`), as `k.frame` takes it. */
export interface ViewSpec {
  at: Spot; heading: number; halfW: number; halfD: number; tall: number; pitchDeg: number;
  insetTop: number; insetBottom: number; include?: readonly { x: number; z: number; h: number; r?: number }[];
  seconds?: number;
}

/** One layout of the story (design §6.2). */
export interface ReeLayout {
  id: ReeLayoutId;
  /** the stand of tall grass: its frame (`u` across, `v` away from him searching it) */
  frame: Frame;
  /** where he stands to search it: open heath, beyond its fringe */
  search: Place;
  /** her trodden path: the ring, one bend, his search spot (the prints lie on it) */
  wissel: readonly Spot[];
  /** her cover this morning (the copse, or a thicket of her own), the gap she goes in and
   *  out by, and her bed behind it (out of sight) */
  cover: Cover;
  gap: Spot;
  bed: Spot & { yaw: number };
  /** her way from where she grazes into her bed (she slips in): straight, or by her gap */
  slip: readonly Spot[];
  /** where she grazes as the play begins (one of two, seen from the ring) */
  graze: readonly [Spot & { yaw: number }, Spot & { yaw: number }];
  /** where mother and calf meet: open heath just out of the grass, toward her gap */
  meet: Spot;
  /** the pool on her path (`in`, walked on the way to the grass) or on his way to the
   *  hide (`out`; a layout whose way to the hide has no room for it has none) */
  pools: { readonly in: PoolSpot; readonly out?: PoolSpot };
  /** his way from the stand to the hide (golden's hint): back out of the grass the way
   *  he came (his search spot first), then round the grass, never past the calf; the
   *  hide last */
  way: readonly Spot[];
  hide: Place;
  hideJuniper: Spot & { h: number };
  hideLog: Spot & { turn: number; half: number };
  /** "Loop rustig weg": his quiet steps back out of the hide, away from the family */
  hideLeave: Place;
  /** the views: the search over the stand (him in a lower corner), the watch from the hide */
  views: { search: ViewSpec; watch: ViewSpec };
}

/** What a layout is made from (the rest follows). */
interface LayoutDef {
  id: ReeLayoutId;
  /** the stand's centre, and the heading he looks into it with when searching (rad) */
  stand: Spot; look: number;
  /** the corner he stands in while searching: +1 the lower left of the picture, −1 the lower right */
  corner: 1 | -1;
  /** her wissel's one bend */
  bend: Spot;
  /** her cover (default the copse), her gap and her bed in its frame (u, v), her bed's yaw
   *  offset; `slipVia`: she slips in by her gap (a juniper stands on the straight way) */
  cover?: Cover;
  gap: { u: number; v: number }; bed: { u: number; v: number; yaw: number }; slipVia?: boolean;
  graze: readonly [Spot, Spot];
  /** the pools: `in` at a share along her wissel's leg (0 ring→bend, 1 bend→search), `out`
   *  at a share along his way's leg `leg` (0: search spot → its first point …) */
  poolIn: { leg: 0 | 1; at: number; side: 1 | -1 };
  poolOut?: { leg: number; at: number; side: 1 | -1 };
  /** his way round the grass to the hide, after his search spot (stand-frame u, v of the
   *  points between) */
  way: readonly { u: number; v: number }[];
  hide: Spot;
  /** his quiet steps out of the hide (its frame; default a step and a half back) */
  leave?: { u: number; v: number };
  /** the hide's juniper and log, in the hide's frame (u right, v toward the scene) */
  hideJuniper: { u: number; v: number }; hideLog: { u: number; v: number };
  /** the watch view's middle (a share from her gap to the meet) and its size */
  watchMid: number; watchHalfW: number;
}

/** The search view (the owner's fix: the old lens looked steeply down on the top of his
 *  head, a carpet of grass edge to edge): lower and flatter (34° where it was 38°), from
 *  behind him and beside him, so he stands small and whole in a lower corner, seen from
 *  behind, and the stand reads with its rim, a band of heath and what lies beyond. The
 *  same in every layout (decision 1: the same distance and angle to every stand). `side`:
 *  how far round the stand (rad) he stands from straight in front; `turn`: the lens's turn
 *  the other way. */
export const SEARCH_LENS = { halfW: 3.6, halfD: 2.4, tall: 1.0, pitchDeg: 34, insetTop: 110, insetBottom: 30, r: 0.25, back: -0.6, side: (35 * Math.PI) / 180, turn: 0.1 } as const;

function build(d: LayoutDef): ReeLayout {
  const frame: Frame = { x: d.stand.x, z: d.stand.z, heading: d.look };
  const th = -d.corner * SEARCH_LENS.side;
  const search: Place = { ...atLocal(frame, SEARCH_RING.a * Math.sin(th), -SEARCH_RING.b * Math.cos(th)), r: 1.3, heading: d.look + th * 0.5 };
  const wissel = [MARKER, d.bend, search];
  const cover = d.cover ?? COPSE;
  const gap = atLocal(cover.frame, d.gap.u, d.gap.v);
  const bed = { ...atLocal(cover.frame, d.bed.u, d.bed.v), yaw: cover.frame.heading + d.bed.yaw };
  const meet = toward(d.stand, gap, FRINGE.a * 1.2 + 0.9);
  const graze = d.graze.map((g) => ({ ...g, yaw: headingTo(g, MARKER) + Math.PI / 2 })) as unknown as ReeLayout['graze'];
  const hide0 = d.hide;
  const mid = toward(gap, meet, dist(gap, meet) * d.watchMid);
  const hf: Frame = { ...hide0, heading: headingTo(hide0, mid) };
  const hide: Place = { ...hide0, r: 0.7, heading: hf.heading };
  const way = [{ x: search.x, z: search.z }, ...d.way.map((w) => atLocal(frame, w.u, w.v)), { x: hide.x, z: hide.z }];
  const wl = d.poolIn.leg === 0 ? [MARKER, d.bend] : [d.bend, search];
  const ol = d.poolOut ? way.slice(d.poolOut.leg, d.poolOut.leg + 2) : [];
  const log = { ...atLocal(hf, d.hideLog.u, d.hideLog.v), turn: hf.heading, half: 0.85 };
  return {
    id: d.id, frame, search, wissel, cover, gap, bed, slip: d.slipVia ? [gap, bed] : [bed], graze, meet,
    pools: {
      in: poolOn(wl[0], wl[1], d.poolIn.at, d.poolIn.side, d.poolIn.leg),
      ...(d.poolOut ? { out: poolOn(ol[0], ol[1], d.poolOut.at, d.poolOut.side, d.poolOut.leg) } : {}),
    },
    way, hide,
    hideJuniper: { ...atLocal(hf, d.hideJuniper.u, d.hideJuniper.v), h: SIZE.jeneverbes.h * 1.1 },
    hideLog: log,
    hideLeave: { ...atLocal(hf, d.leave?.u ?? 0.2, d.leave?.v ?? -1.5), r: 0.5, heading: hf.heading },
    views: {
      search: {
        at: atLocal(frame, 0, SEARCH_LENS.back), heading: d.look + d.corner * SEARCH_LENS.turn + th * 0.5,
        halfW: SEARCH_LENS.halfW, halfD: SEARCH_LENS.halfD, tall: SEARCH_LENS.tall, pitchDeg: SEARCH_LENS.pitchDeg,
        insetTop: SEARCH_LENS.insetTop, insetBottom: SEARCH_LENS.insetBottom,
        include: [{ x: search.x, z: search.z, h: RANGER_STAND_HEIGHT, r: SEARCH_LENS.r }],
      },
      watch: { at: mid, heading: hf.heading, halfW: d.watchHalfW, halfD: 1.4, tall: SIZE.ree.h + 0.3, pitchDeg: 12, insetTop: 110, insetBottom: 220 },
    },
  };
}

const deg = (d: number): number => (d * Math.PI) / 180;

/** Layout C's own cover: a thicket of three junipers and bracken out on the heath west of
 *  its stand (`v` runs east, out of its gap toward the grass). */
const THICKET_FRAME: Frame = { x: -27.6, z: -47.5, heading: deg(90) };
export const THICKET: Cover = {
  frame: THICKET_FRAME, a: 2.4, b: 1.8,
  junipers: [
    { ...atLocal(THICKET_FRAME, 1.6, 1.0), h: SIZE.jeneverbes.h * 1.05, turn: 0.9 },
    { ...atLocal(THICKET_FRAME, -1.6, 0.9), h: SIZE.jeneverbes.h * 0.95, turn: 2.6 },
    { ...atLocal(THICKET_FRAME, 0.6, -1.4), h: SIZE.jeneverbes.h * 1.15, turn: 4.4 },
  ],
};

/** The three layouts, chosen by looking at the world (pinned by ree.places.test.ts). */
export const REE_LAYOUTS: Readonly<Record<ReeLayoutId, ReeLayout>> = {
  A: build({
    id: 'A', stand: { x: -14.6, z: -36.4 }, look: deg(60), corner: 1, bend: { x: -21.0, z: -37.0 },
    gap: { u: 0, v: 2.4 }, bed: { u: 2.2, v: -0.25, yaw: Math.PI * 0.6 },
    graze: [inCopse(-3.3, 1.2), inCopse(-4.4, 0.4)],
    // (no pool on his way to the hide: that way passes the marker and the look at her)
    poolIn: { leg: 0, at: 0.45, side: -1 },
    way: [{ u: -4.07, v: 0.65 }, { u: -0.1, v: 3.76 }],
    hide: { x: -7.5, z: -26.5 }, hideJuniper: { u: 1.6, v: 0.0 }, hideLog: { u: 1.45, v: 1.2 },
    watchMid: 0.5, watchHalfW: 2.8,
  }),
  B: build({
    id: 'B', stand: { x: -8.5, z: -51.0 }, look: deg(135), corner: 1, bend: { x: -21.0, z: -39.5 },
    gap: { u: 3.7, v: 0.4 }, bed: { u: 1.6, v: -0.6, yaw: Math.PI * 1.1 },
    graze: [inCopse(-3.3, 1.2), inCopse(-4.2, 1.6)],
    poolIn: { leg: 1, at: 0.5, side: 1 }, poolOut: { leg: 2, at: 0.62, side: -1 },
    way: [{ u: -3.4, v: -0.2 }, { u: -1.0, v: 3.1 }],
    hide: { x: -2.0, z: -44.0 }, leave: { u: 1.0, v: -1.0 }, hideJuniper: { u: -1.4, v: 0.3 }, hideLog: { u: -0.9, v: 1.1 },
    watchMid: 0.55, watchHalfW: 2.8,
  }),
  C: build({
    id: 'C', stand: { x: -21.0, z: -49.0 }, look: deg(-90), corner: 1, bend: { x: -20.5, z: -38.8 },
    cover: THICKET, gap: { u: 0, v: 1.7 }, bed: { u: -1.4, v: -0.6, yaw: Math.PI * 0.5 }, slipVia: true,
    graze: [{ x: -24.1, z: -46.5 }, { x: -24.9, z: -45.0 }],
    poolIn: { leg: 1, at: 0.5, side: 1 }, poolOut: { leg: 0, at: 0.5, side: 1 },
    way: [],
    hide: { x: -25.0, z: -37.5 }, leave: { u: 2.8, v: -1.8 }, hideJuniper: { u: -1.45, v: 0.25 }, hideLog: { u: -0.95, v: 1.1 },
    watchMid: 0.5, watchHalfW: 2.8,
  }),
};

/** Every layout, in order. */
export const LAYOUTS: readonly ReeLayout[] = REE_LAYOUT_IDS.map((id) => REE_LAYOUTS[id]);

/** The candidate spots the calf may lie in, in trial coordinates (0..100): the content's
 *  `doelen` (content/veluwe.ts, the ree's zoeken skin), pinned there by the test. */
export const CALF_DOELEN: readonly { x: number; y: number }[] = [
  { x: 10, y: 26 }, { x: 90, y: 26 }, { x: 10, y: 72 }, { x: 90, y: 72 },
];

/** A 2D trial point (0..100) on a layout's stand, in the world. */
export function onStand(l: ReeLayout, x: number, y: number): Spot {
  const { u, v } = patchLocal(x, y, STAND.halfW, STAND.halfD);
  return atLocal(l.frame, u, v);
}

/** Where the calf lies at a trial point (its `doel`), and the way it lies: side-on to him
 *  searching (its spotted flank and back toward the searching eye). */
export function calfAt(l: ReeLayout, doel: { x: number; y: number }): Spot & { yaw: number } {
  return { ...onStand(l, doel.x, doel.y), yaw: l.frame.heading - Math.PI / 2 + 0.2 };
}

/** Where he stands to talk to (not touch) the calf: 1.35 m from it, on the side he came
 *  from (his search spot's). */
export function calfTalkOf(l: ReeLayout, calf: Spot): Place {
  const p = toward(calf, l.search, 1.35);
  return { ...p, r: 0.4, heading: headingTo(p, calf) };
}

/** Where a startled calf bolts to: a metre and a half to the side (never toward him or
 *  the lens, never out of the grass), and back from there. */
export function calfBolt(l: ReeLayout, calf: Spot, from: Spot): Spot {
  const f = { x: calf.x, z: calf.z, heading: headingTo(from, calf) };
  const lu = toLocal(l.frame, calf).u;
  const s = lu > 0 ? -1 : 1; // toward the stand's middle across: it stays in the grass
  return atLocal(f, s * 1.35, 0.45);
}

/** The view by the calf (the calm moments): from beside him, low (40° where it was 52°),
 *  the calf big in the middle of the picture and he whole at its side, never over it. */
export function calfView(l: ReeLayout, calf: Spot, talk: Place): ViewSpec {
  const h = headingTo(talk, calf);
  const lu = toLocal(l.frame, calf).u;
  const s = lu > 0 ? -1 : 1;
  return {
    at: toward(calf, talk, -0.3), heading: h + s * 1.15,
    halfW: 0.9, halfD: 0.6, tall: 0.9, pitchDeg: 40, insetTop: 110, insetBottom: 40,
    include: [{ x: talk.x, z: talk.z, h: RANGER_STAND_HEIGHT, r: 0.2 }],
  };
}

/** Leaving the calf: the lens swings round behind him as he turns away from it and takes
 *  his first quiet steps toward `next` (the way ahead in view). `at` his first steps' end. */
export function leaveView(at: Spot, next: Spot): ViewSpec {
  const h = headingTo(at, next);
  return {
    at: toward(at, next, 2.2), heading: h - 0.2, halfW: 1.6, halfD: 1.6, tall: 1.2, pitchDeg: 30, insetTop: 96, insetBottom: 16,
    include: [{ x: at.x, z: at.z, h: RANGER_STAND_HEIGHT }], seconds: 2.6,
  };
}

/** The spot at the doe's flank where her calf drinks (its head under her belly), on her
 *  right (`side` 1) or her left (−1): the side the watching eye is on. */
export function drinkSpot(doe: Spot & { yaw: number }, len: number, side: 1 | -1 = 1): Spot & { yaw: number } {
  const f = { x: doe.x, z: doe.z, heading: doe.yaw };
  return { ...atLocal(f, 0.34 * side, -0.12 * len), yaw: doe.yaw + Math.PI - 0.25 * side };
}

/* ---------------------------------------------------------- the places ---- */

/** Where the family lives after (mother and calf graze together out on the heath between
 *  the stands, south-west of the copse): within their walking reach (`HOME_REACH`) of
 *  every layout's meeting place, so after the reunion they walk there, never a cut. */
const HOME: Spot = { x: -12.0, z: -44.0 };

/** The places table: the marker and the home, and every layout's places under its letter
 *  (`A.search`, `B.hide` …: the jeep is parked out of all of them). `hide`, `hideLeave`
 *  and `poolEdge` are layout A's (the neighbours' tests read them). */
export const REE_PLACES: Readonly<Record<string, Place>> = (() => {
  const t: Record<string, Place> = { marker: { ...MARKER, r: 2.4 }, home: { ...HOME } };
  for (const l of LAYOUTS) {
    t[`${l.id}.stand`] = { x: l.frame.x, z: l.frame.z, heading: l.frame.heading };
    t[`${l.id}.search`] = l.search;
    t[`${l.id}.gap`] = { ...l.gap };
    t[`${l.id}.meet`] = { ...l.meet };
    t[`${l.id}.graze0`] = { ...l.graze[0] };
    t[`${l.id}.graze1`] = { ...l.graze[1] };
    t[`${l.id}.poolIn`] = { ...l.pools.in.edge };
    if (l.pools.out) t[`${l.id}.poolOut`] = { ...l.pools.out.edge };
    t[`${l.id}.hide`] = l.hide;
    t[`${l.id}.hideLeave`] = l.hideLeave;
  }
  const a = REE_LAYOUTS.A;
  t.hide = a.hide;
  t.hideLeave = a.hideLeave;
  t.poolEdge = a.pools.in.edge;
  return t;
})();

/* ------------------------------------------------------------ who lives here ---- */

/** How far (m) mother and calf walk home calmly (a reunion at layout C's thicket is ~13 m
 *  from home; a stop leaves them up to ~25 m from the spots a play laid them at). */
export const HOME_REACH = 30;

/** The calf's spot in free roam before any play laid it elsewhere: layout A's first spot. */
export const CALF_HOME: Spot & { yaw: number } = calfAt(REE_LAYOUTS.A, CALF_DOELEN[0]);

/**
 * The doe grazes at the copse's open side all along (shy: she slips into the copse when
 * the ranger comes within 8 m, and comes back out once he is 13 m off); her calf lies
 * pressed flat in the tall grass. A play lays both where it draws them (ree.ts `prepare`).
 * After, the two graze together at the copse's corner (and step into it together when he
 * comes close).
 */
export const REE_RESIDENTS: readonly ResidentSpec[] = [
  { key: 'doe', animal: 'ree', reach: HOME_REACH,
    before: { ...GRAZE, yaw: headingTo(GRAZE, MARKER) + Math.PI / 2, idle: 'graze', roam: 0.5 },
    after: { ...HOME, yaw: headingTo(HOME, COPSE_AT) + 1.2, idle: 'graze', roam: 0.4 },
    shy: [
      { within: 8, back: 13, to: DOE_BED, lie: true, state: 'before' },
      { within: 4, back: 7, to: DOE_BED, lie: true, state: 'after', after: 4 },
    ] },
  { key: 'calf', animal: 'reekalf', reach: HOME_REACH,
    before: { ...CALF_HOME, yaw: CALF_HOME.yaw, idle: 'lie', roam: 0 },
    after: { ...atLocal({ ...HOME, heading: headingTo(HOME, COPSE_AT) + 1.2 }, -0.65, -0.45), yaw: headingTo(HOME, COPSE_AT) + 0.7, idle: 'graze', roam: 0.3 },
    shy: [{ within: 4, back: 7, to: CALF_BED, lie: true, state: 'after', after: 4 }] },
];

/** The reekalf's home in the world. */
export const REE_HOME: HomeSpec = {
  missionId: 'ree-niet-aanraken',
  places: REE_PLACES,
  residents: REE_RESIDENTS,
  marker: { look: 'none' },
  // the stands and the hides lie spread round the copse: the home stays drawn while he is
  // near any of them
  spread: LAYOUTS.flatMap((l) => [{ x: l.frame.x, z: l.frame.z }, { x: l.hide.x, z: l.hide.z }]),
};

/* ------------------------------------------------------------- her wissel ---- */

/** Half the width (m) of the doe's trodden path. */
export const WISSEL_HALF = 0.24;
/** How far (m) it runs on behind the ring (away from the grass), and into the grass. */
const WISSEL_BACK = 1.5;
const WISSEL_IN = 1.4;

/**
 * The doe's trodden path across the heath (a roe's "wissel") of a layout: from the heath
 * behind the marker ring, through the ring, round its bend to the stand's near edge,
 * where it runs into the tall grass (it stops there, never on to the calf). Lighter sand
 * where her hooves wore the heather away, with a gentle sway in it. Her fresh prints on
 * it (`slotTrail`) are what he follows.
 */
export function wisselLine(l: ReeLayout): Spot[] {
  const a = toward(MARKER, l.wissel[1], -WISSEL_BACK);
  const b = toward(l.search, l.frame, WISSEL_IN);
  const legs: [Spot, Spot][] = [[a, l.wissel[1]], [l.wissel[1], l.search], [l.search, b]];
  const out: Spot[] = [];
  legs.forEach(([p, q], k) => {
    const L = dist(p, q);
    const d = { x: (q.x - p.x) / L, z: (q.z - p.z) / L };
    const N = Math.max(2, Math.round(L / 0.8));
    for (let i = k ? 1 : 0; i <= N; i++) {
      const t = i / N;
      const side = k < 2 ? 0.08 * Math.sin(t * Math.PI * 2) : 0; // a gentle S: straight at its ends and its middle
      out.push({ x: p.x + d.x * L * t - d.z * side, z: p.z + d.z * L * t + d.x * side });
    }
  });
  return out;
}

/** The doe's small prints ("prenten") on her wissel, from the far side of the marker ring
 *  (so the ring stands on them) to the stand's near edge: where she walked, round the
 *  bend; they end at the grass, never at the calf. */
export function slotTrail(l: ReeLayout): { from: Spot; to: Spot }[] {
  return [
    { from: toward(MARKER, l.wissel[1], -0.8), to: l.wissel[1] },
    { from: l.wissel[1], to: l.search },
    { from: l.search, to: toward(l.search, l.frame, 0.55) },
  ];
}

/** Ground the world's heather scatter leaves bare: every stand (tall grass grows there,
 *  not heather cushions), every pool spot, and a strip along every wissel. */
export function reeClearings(): { x: number; z: number; r: number }[] {
  const out: { x: number; z: number; r: number }[] = [];
  for (const l of LAYOUTS) {
    out.push({ x: l.frame.x, z: l.frame.z, r: STAND.halfW + 0.3 });
    for (const p of poolsOf(l)) out.push({ x: p.x, z: p.z, r: POOL.halfW + 0.5 });
    for (const p of wisselLine(l)) out.push({ ...p, r: WISSEL_HALF + 0.45 });
  }
  return out;
}

/** A layout's pool spots (on her path, and on his way to the hide when it has one). */
export function poolsOf(l: ReeLayout): PoolSpot[] {
  return l.pools.out ? [l.pools.in, l.pools.out] : [l.pools.in];
}

/** The sides a layout's pool may lie on (`ree.variety.ts` draws from them). */
export function poolSides(l: ReeLayout): ('in' | 'out')[] {
  return l.pools.out ? ['in', 'out'] : ['in'];
}

/**
 * A perfect player's way on one of the two walks (golden's hint, `k.walk`'s `via`): the
 * points he walks through in turn before the walk's goal — on her path the bend (the goal
 * is his search spot), on his way to the hide back out of the grass and round it (the
 * goal is the hide) — with the pool's way round put in on the leg it lies across when it
 * lies on this walk (`pool`: this play's pool, or null when it lies on the other walk).
 */
export function walkVia(l: ReeLayout, walk: 'meadow' | 'hide', pool: PoolSpot | null): Spot[] {
  // the walk's points from its start (the ring, or where he leaves the grass) to its goal;
  // a pool on leg k lies between points k and k + 1, so its way round goes in before k + 1
  const all = walk === 'meadow' ? [...l.wissel] : [...l.way];
  const inner = all.slice(1, -1);
  const out: Spot[] = walk === 'meadow' ? [] : [all[0]];
  inner.forEach((p, i) => {
    if (pool && pool.leg === i) out.push(...pool.round);
    out.push(p);
  });
  if (pool && pool.leg === all.length - 2) out.push(...pool.round);
  return out;
}

/** Frame-local position of a spot in a layout's stand frame (for the tests). */
export function inStand(l: ReeLayout, p: Spot): { u: number; v: number } { return toLocal(l.frame, p); }
