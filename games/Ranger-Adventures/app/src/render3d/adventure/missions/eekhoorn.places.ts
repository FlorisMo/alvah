/**
 * eekhoorn.places.ts — where "De verstopte nootjes" happens in the world, and who lives
 * there (THREE-free; `eekhoorn.places.test.ts` pins it). Chosen by looking at the world
 * (design run6-missions §4.4): the bos south-west of the watchtower, flat, open forest,
 * the nachtronde and vos markers and the tower ≥ 10 m away, the wildcamera's wood to the
 * north left alone.
 *
 * Seen by a child walking up from the clearing: the marker ring in the wood, and right
 * past it the squirrel's OAK, the squirrel running up and down it. The squirrel leads
 * him off to the left, tree to tree: down its oak and over the forest floor to a first
 * pine (it waits on a branch stub there), a leap to the next pine and on to a third
 * (it waits again), then over the ground into its GLADE: an open patch of forest floor
 * with seven look-alike mossy spots (where it buries its acorns), a stump with its store
 * of acorns, a big oak at the side, and round it the neighbours' trees — a pine the jay
 * sits in, a dead snag the raven sits on, a pine the green woodpecker clings to.
 *
 *   marker ── oak ── (dash) ── pine A · wait ── (leap) ── pine B ── (leap) ── pine C · wait
 *                                                                       └── (dash) ── the glade
 */

import { PRINT_SPOTS } from '../../../engines/corsi.ts';
import { RANGER_STAND_HEIGHT } from '../../AnimalScale.ts';
import type { HomeSpec, Place, ResidentSpec, Spot } from '../types.ts';
import { atLocal, headingTo, uniformLocal, type Frame } from '../places.ts';

/** The eekhoorn marker: the bos anchor it has always had (the test checks it). */
export const MARKER: Spot = { x: 25.419167959680543, z: -41.89111958682353 };

/** The kind of tree (the world's forest GLB) and how tall it grows (m). */
export type TreeKind = 'prop-oak-tree' | 'prop-pine-scots' | 'prop-birch-tree';
export interface HomeTree extends Spot {
  species: TreeKind;
  /** its height (m) */
  h: number;
  /** its spin (rad): which way its low limbs face */
  rotY: number;
  /** the branch stub the squirrel (or a bird) sits on: which way it points (a heading),
   *  how high its top is (m), how far it reaches out from the bark (m) */
  branch?: { ang: number; h: number; out: number };
}

/* ------------------------------------------------------------ the route ---- */

/** The way the ranger walks up to the marker (from the clearing): the squirrel's oak
 *  stands a little ahead of him, to the left, so it is in view as he arrives. */
const ARRIVE: Frame = { x: MARKER.x, z: MARKER.z, heading: headingTo({ x: 0, z: 0 }, MARKER) };
/** The squirrel's oak, right past the marker ring (its crown over the ring). */
const OAK_AT: Spot = atLocal(ARRIVE, -1.5, 2.5);

/** The glade frame: the way runs from the oak along its depth axis (`v`) into the glade,
 *  whose middle is its origin; `u` runs across (right +, seen along the way). */
export const GLADE_FRAME: Frame = (() => {
  const dir = Math.atan2(-0.66, -0.75); // from the oak off to the child's left, into the wood
  const o = { x: OAK_AT.x + Math.sin(dir) * 19.5, z: OAK_AT.z + Math.cos(dir) * 19.5 };
  return { x: o.x, z: o.z, heading: dir };
})();
const g = (u: number, v: number): Spot => atLocal(GLADE_FRAME, u, v);
const GLADE_AT: Spot = g(0, 0);

/** The three pines of its way to the glade (it waits at A and C, passes B in a leap). */
const PINE_A: Spot = g(-1.2, -13.4);
const PINE_B: Spot = g(-4.1, -11.4);
const PINE_C: Spot = g(-3.3, -8.3);

/** The seven caching spots: PRINT_SPOTS scaled UNIFORMLY (m per percent), all in one
 *  view, centred a little right of the glade's middle (the stump and the neighbours are
 *  to its left). */
export const SPOT_SCALE = 0.05;
const SPOTS_AT = { u: 1.35, v: -0.3 } as const;
/** Each spot's size across (m): a mossy cushion with a little leaf litter. */
export const SPOT_SIZE = 0.52;

/** Where the ranger stands to watch the glade floor (the corsi), and where he steps to
 *  for the neighbours' calls (the simon): nearer to them, the view clear of every trunk. */
const STAND = g(-0.2, -2.35);
const CALLERS_STAND = g(-0.45, -2.9);

/** The trees of the home (the forest draws them with its own; the scatter keeps clear). */
export const HOME_TREES: readonly HomeTree[] = [
  // the squirrel's oak: its branch stub faces the marker (where the ranger comes from)
  { ...OAK_AT, species: 'prop-oak-tree', h: 11.2, rotY: 0.9, branch: { ang: headingTo(OAK_AT, MARKER) - 0.75, h: 1.75, out: 0.3 } },
  // the way: each stub faces back along the way (where he follows from)
  { ...PINE_A, species: 'prop-pine-scots', h: 13.5, rotY: 2.2, branch: { ang: headingTo(PINE_A, OAK_AT) + 0.35, h: 1.8, out: 0.28 } },
  { ...PINE_B, species: 'prop-pine-scots', h: 12.4, rotY: 4.1, branch: { ang: headingTo(PINE_B, PINE_A) + 0.2, h: 1.95, out: 0.26 } },
  { ...PINE_C, species: 'prop-pine-scots', h: 14.2, rotY: 5.3, branch: { ang: headingTo(PINE_C, PINE_A) - 0.35, h: 1.75, out: 0.28 } },
  // the glade's big oak, at its right side: the acorns come from it (its crown stays
  // clear of the neighbours on the left)
  { ...g(8.0, 2.6), species: 'prop-oak-tree', h: 11, rotY: 2.7, branch: { ang: headingTo(g(8.0, 2.6), g(0, 0)), h: 1.5, out: 0.34 } },
  // the jay's pine (behind the stump): a dead stub it sits on, facing the ranger
  { ...g(-1.85, 2.5), species: 'prop-pine-scots', h: 13, rotY: 1.3, branch: { ang: headingTo(g(-1.85, 2.5), CALLERS_STAND) + 0.3, h: 1.6, out: 0.34 } },
  // the green woodpecker's pine (left of the stump)
  { ...g(-3.0, 1.2), species: 'prop-pine-scots', h: 12, rotY: 3.3 },
];

/** A home tree by its spot (for the tests and the script). */
export const TREE = {
  oak: HOME_TREES[0], a: HOME_TREES[1], b: HOME_TREES[2], c: HOME_TREES[3],
  gladeOak: HOME_TREES[4], jayPine: HOME_TREES[5], woodpeckerPine: HOME_TREES[6],
} as const;

/** The stump with the acorn store (left of the spots), and the dead snag (the raven's). */
export const STUMP = { ...g(-1.3, 0.8), h: 0.62, top: 0.6, r: 0.36 } as const;
export const HEAP = { ...g(-0.75, 1.3), h: 0.2 } as const;
/** The acorn store round the stump's foot: one cluster before, more as he piles them. */
export const HEAP_SPOTS: readonly Spot[] = [g(-0.75, 1.3), g(-0.6, 0.95), g(-0.95, 1.55), g(-0.45, 1.3), g(-1.0, 1.15)];
export const SNAG = { ...g(-0.15, 2.2), h: 1.95, rotY: 0.6 } as const;
/** Where the woodpecker clings on its pine (1.3 m up, seen side-on from the ranger). */
export const WOODPECKER = { tree: HOME_TREES[6], h: 1.2 } as const;

/** Where the corsi's forgotten acorn grows into a seedling (after, on a later visit). */
export const SEEDLING_SPOT = 6;

/** The places table. */
export const EEKHOORN_PLACES = {
  marker: { ...MARKER, r: 2.4 },
  oak: { ...OAK_AT },
  /** the waits of the follow: he comes within 4 m of the squirrel on its branch */
  hopA: { ...PINE_A, r: 4 },
  hopC: { ...PINE_C, r: 4 },
  /** where the ranger stands to watch the glade floor, facing its spots */
  stand: { ...STAND, r: 1.6, heading: headingTo(STAND, g(SPOTS_AT.u, SPOTS_AT.v)) },
  /** where he steps to for the neighbours' calls, facing them */
  callers: { ...CALLERS_STAND, r: 0.8, heading: headingTo(CALLERS_STAND, g(-1.45, 1.65)) },
  glade: { ...GLADE_AT, heading: GLADE_FRAME.heading },
  stump: { x: STUMP.x, z: STUMP.z },
  /** the home place: the ranger ends near it (golden step 8) */
  home: { ...GLADE_AT },
} as const satisfies Record<string, Place>;

/** The seven caching spots (world x/z), in PRINT_SPOTS id order. */
export function gladeSpots(): (Spot & { id: number })[] {
  return PRINT_SPOTS.map((s) => {
    const { u, v } = uniformLocal(s.x, s.y, SPOT_SCALE);
    return { id: s.id, ...g(SPOTS_AT.u + u, SPOTS_AT.v + v) };
  });
}

/** The framed views (design §3.6): the glade floor from above for the acorns (corsi),
 *  the stump in the picture too (where the squirrel sits when it forgets); and the
 *  neighbours on their perches, looking a little up, for the calls (simon). */
export const GLADE_VIEW = {
  at: g(SPOTS_AT.u - 0.55, SPOTS_AT.v + 0.25), heading: GLADE_FRAME.heading + 0.1,
  halfW: 2.2, halfD: 1.45, tall: 0.7, pitchDeg: 44, insetTop: 100, insetBottom: 10,
  include: [{ x: STAND.x, z: STAND.z, h: RANGER_STAND_HEIGHT }],
} as const;
/** The neighbours round the stump (its centre, for the view's aim). */
const NEIGHBOURS_AT = g(-1.45, 1.65);
/** (the ranger stands just behind the lens here: the neighbours fill the picture, seen
 *  as he sees them) */
export const CALLERS_VIEW = {
  at: NEIGHBOURS_AT, heading: headingTo(CALLERS_STAND, NEIGHBOURS_AT),
  halfW: 1.45, halfD: 1.0, tall: 2.45, pitchDeg: 3, insetTop: 104, insetBottom: 20,
} as const;

/** Who lives here: the squirrel, round its oak by the marker before; at its glade after
 *  (it sits on the stump by its store). */
export const EEKHOORN_RESIDENTS: readonly ResidentSpec[] = [
  {
    key: 'squirrel', animal: 'eekhoorn',
    before: { ...OAK_AT, idle: 'root', roam: 0 },
    after: { x: TREE.gladeOak.x, z: TREE.gladeOak.z, idle: 'root', roam: 0 },
    voice: { call: 'eekhoorn', every: [5, 9], within: 9 },
  },
];

/** The squirrel's home in the world. */
export const EEKHOORN_HOME: HomeSpec = {
  missionId: 'eekhoorn',
  places: EEKHOORN_PLACES,
  residents: EEKHOORN_RESIDENTS,
  marker: { look: 'none' },
};

/** Ground the forest's own scattered trees keep clear of: the glade, and room round each
 *  home tree (so no stray pine stands in the squirrel's way or in a framed view). */
export function eekhoornTreeClear(): { x: number; z: number; r: number }[] {
  return [
    { ...g(0, 0.8), r: 7 },
    // behind the stands, where the lens holds its views
    { ...g(0.6, -6), r: 4.2 },
    ...HOME_TREES.map((t) => ({ x: t.x, z: t.z, r: 3.2 })),
  ];
}

/** Ground the low plants (the bracken of the bos) keep bare: the caching spots and the
 *  stump (a fern through a mossy spot reads wrong). */
export function eekhoornClearings(): { x: number; z: number; r: number }[] {
  return [
    ...gladeSpots().map((s) => ({ x: s.x, z: s.z, r: 0.7 })),
    { x: STUMP.x, z: STUMP.z, r: 0.9 },
  ];
}
