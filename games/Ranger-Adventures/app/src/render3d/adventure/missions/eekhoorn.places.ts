/**
 * eekhoorn.places.ts — where "De verstopte nootjes" happens in the world, and who lives
 * there (THREE-free; `eekhoorn.places.test.ts` pins it). Chosen by looking at the world
 * (design run6-missions §4.4): the bos south-west of the watchtower, flat, open forest,
 * the nachtronde and vos markers and the tower ≥ 10 m away, the wildcamera's wood to the
 * north left alone.
 *
 * Seen by a child walking up from the clearing: the marker ring in the wood, and right
 * past it the squirrel's PINE, the squirrel running up and down it. The squirrel leads
 * him off to the left, tree to tree: down its pine and over the forest floor to a
 * second pine (it waits on a branch stub there), a leap to the next pine and on to a
 * third (where it hides round the trunk until he walks round), then over the ground into
 * its GLADE: an open patch of forest floor with seven look-alike mossy spots (where it
 * buries its acorns), a stump with its store of acorns, a big oak at the side, and round
 * the stump the neighbours — the pine by the store (the jay on its stub, the green
 * woodpecker on its bark), a dead snag the raven sits on.
 *
 *   marker ── pine ── (dash) ── pine A · wait ── (leap) ── pine B ── (leap) ── pine C · hide
 *                                                                       └── (dash) ── the glade
 */

import { PRINT_SPOTS } from '../../../engines/corsi.ts';
import { RANGER_STAND_HEIGHT } from '../../AnimalScale.ts';
import type { HomeSpec, Place, ResidentSpec, Spot } from '../types.ts';
import { atLocal, headingTo, uniformLocal, type Frame } from '../places.ts';
import { barkRadius } from '../squirrel-math.ts';
import type { TreeStub } from '../../world/Forest.ts';

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

/** The way the ranger walks up to the marker (from the clearing): the squirrel's tree
 *  stands a little ahead of him, to the left, so it is in view as he arrives. It is a
 *  Scots pine (a red squirrel's home on the Veluwe): its crown starts high, so the lens
 *  sees the whole trunk and the squirrel on it solid — an oak's low leaf dome hangs
 *  between the lens and a child standing near it, and the forest fades such a tree to a
 *  ghost. The acorns come from the big oak at its glade. */
const ARRIVE: Frame = { x: MARKER.x, z: MARKER.z, heading: headingTo({ x: 0, z: 0 }, MARKER) };
/** The squirrel's pine, right past the marker ring. */
const OAK_AT: Spot = atLocal(ARRIVE, -1.5, 2.5);

/** The glade frame: the way runs from its pine along its depth axis (`v`) into the glade,
 *  whose middle is its origin; `u` runs across (right +, seen along the way). */
export const GLADE_FRAME: Frame = (() => {
  const dir = Math.atan2(-0.66, -0.75); // from its pine off to the child's left, into the wood
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

/** Where the ranger stands to watch the glade floor (the corsi): at its left edge, by
 *  the stump, so the lens sees him whole beside the spots, not the back of his head.
 *  He stays there for the neighbours' calls (the simon): they are round the stump, a
 *  few metres ahead of him, near enough to read. */
const STAND = g(-1.55, -1.45);
const CALLERS_STAND = g(-1.0, -3.1);

/** The trees of the home (the forest draws them with its own; the scatter keeps clear). */
export const HOME_TREES: readonly HomeTree[] = [
  // the squirrel's pine: its branch stub faces the marker (where the ranger comes from)
  { ...OAK_AT, species: 'prop-pine-scots', h: 14, rotY: 0.9, branch: { ang: headingTo(OAK_AT, MARKER) - 0.5, h: 1.45, out: 0.3 } },
  // the way: each stub faces back along the way (where he follows from)
  { ...PINE_A, species: 'prop-pine-scots', h: 13.5, rotY: 2.2, branch: { ang: headingTo(PINE_A, OAK_AT) + 0.35, h: 1.4, out: 0.28 } },
  { ...PINE_B, species: 'prop-pine-scots', h: 12.4, rotY: 4.1, branch: { ang: headingTo(PINE_B, PINE_A) + 0.2, h: 1.55, out: 0.26 } },
  { ...PINE_C, species: 'prop-pine-scots', h: 14.2, rotY: 5.3, branch: { ang: headingTo(PINE_C, PINE_A) - 0.35, h: 1.4, out: 0.28 } },
  // the glade's big oak, at its right side: the acorns come from it (its crown stays
  // clear of the neighbours on the left)
  { ...g(8.0, 2.6), species: 'prop-oak-tree', h: 11, rotY: 2.7, branch: { ang: headingTo(g(8.0, 2.6), g(0, 0)), h: 1.5, out: 0.34 } },
  // the pine by the store, left of the stump: the jay sits on its dead stub before the
  // mission (it has an eye on the acorns), the green woodpecker clings lower down its
  // side, and after the mission the squirrel lives in it (the stub is its branch then)
  { ...g(-2.45, 1.7), species: 'prop-pine-scots', h: 12, rotY: 3.3, branch: { ang: headingTo(g(-2.45, 1.7), CALLERS_STAND) - 0.6, h: 1.75, out: 0.34 } },
];

/**
 * A home tree's branch stub as the forest draws it (part of its tree: it fades with it):
 * a short dead limb rooted inside the bark, reaching `out` past the bark and a little
 * more, a little upward, its top where the squirrel's feet are (`branch.h`), the colour
 * of its tree's bark. None for a tree without a branch.
 */
export function branchStub(t: HomeTree): TreeStub | undefined {
  const b = t.branch;
  if (!b) return undefined;
  const r0 = barkRadius({ x: t.x, z: t.z, H: t.h, species: t.species }, b.h);
  const oak = t.species === 'prop-oak-tree';
  const r = oak ? 0.07 : 0.05;
  return {
    ang: b.ang,
    y: b.h - (oak ? 0.06 : 0.045),
    start: r0 * 0.7,
    len: b.out + 0.12 + r0 * 0.3,
    r,
    color: oak ? '#5d5448' : '#6a4632',
  };
}

/** A home tree by its spot (for the tests and the script). */
export const TREE = {
  oak: HOME_TREES[0], a: HOME_TREES[1], b: HOME_TREES[2], c: HOME_TREES[3],
  gladeOak: HOME_TREES[4], storePine: HOME_TREES[5],
} as const;

/** The stump with the acorn store (left of the spots), and the dead snag (the raven's). */
export const STUMP = { ...g(-1.3, 0.8), h: 0.62, top: 0.6, r: 0.36 } as const;
export const HEAP = { ...g(-0.75, 1.3), h: 0.2 } as const;
/** Where the squirrel stands at its store to take an acorn or to add one (the heap's
 *  side toward the spots). */
export const HEAP_GRAB: Spot = g(-0.35, 0.95);
/** The acorn store round the stump's foot: one cluster before, more as he piles them. */
export const HEAP_SPOTS: readonly Spot[] = [g(-0.75, 1.3), g(-0.6, 0.95), g(-0.95, 1.55), g(-0.45, 1.3), g(-1.0, 1.15)];
export const SNAG = { ...g(0.35, 1.95), h: 1.75, rotY: 0.6 } as const;
/** Where the jay lands by the store when it comes for the acorns (on a twig in the
 *  leaf litter, right of the heap: the thief next to the loot). */
export const JAY_GROUND: Spot = g(-0.2, 1.45);
/** Where the woodpecker clings on its pine: 1.2 m up, on the side of the trunk that is
 *  its edge as the lens sees it (`ang`: the heading from the trunk's axis out to it,
 *  square to the lens), so it is seen in profile against the wood behind — its red cap,
 *  its green back, its tail braced on the bark — never half behind the trunk. */
export const WOODPECKER = { tree: HOME_TREES[5], h: 1.2, ang: headingTo(HOME_TREES[5], g(-1.0, -1.9)) + 1.5 } as const;

/** Where a forgotten acorn grows into an oak seedling (after, on a later visit): in the
 *  glade between the caching spots and the big oak, off every spot (the acorns the child
 *  helped find are all back in the store: this one was forgotten long before). */
export const SEEDLING_AT: Spot = g(1.6, 1.6);

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
  callers: { ...CALLERS_STAND, r: 0.8, heading: headingTo(CALLERS_STAND, g(-1.0, 1.45)) },
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

/** The one look at the start (design §3.6: an establishing look): the child meets the
 *  squirrel on its branch stub. The lens stands on his side of the pine, turned ~40° off
 *  the line from him to the squirrel (so his head is not in front of it, and the trunk
 *  never stands between the lens and him), on the side the squirrel will lead him to
 *  (so the hand-over to the follow camera behind him is a short, calm move). */
const STUB_AT: Spot = (() => {
  const t = HOME_TREES[0], b = t.branch!;
  const r = barkRadius({ x: t.x, z: t.z, H: t.h, species: t.species }, b.h) + b.out;
  return { x: t.x + Math.sin(b.ang) * r, z: t.z + Math.cos(b.ang) * r };
})();
const INTRO_OFF = 0.7;
const INTRO_D = 2.8; // (≈ where the lens fit lands: for choosing the side only)
export function introView(me: Spot): {
  at: Spot; heading: number; halfW: number; halfD: number; tall: number; pitchDeg: number; insetTop: number; insetBottom: number;
} {
  const toStub = headingTo(me, STUB_AT);
  // the follow camera will stand behind him, looking where the squirrel runs (pine A)
  const on = headingTo(me, PINE_A);
  const follow = { x: me.x - Math.sin(on) * 4, z: me.z - Math.cos(on) * 4 };
  const lensOf = (h: number): Spot => ({ x: STUB_AT.x - Math.sin(h) * INTRO_D, z: STUB_AT.z - Math.cos(h) * INTRO_D });
  const a = toStub + INTRO_OFF, b = toStub - INTRO_OFF;
  const heading = Math.hypot(lensOf(a).x - follow.x, lensOf(a).z - follow.z) < Math.hypot(lensOf(b).x - follow.x, lensOf(b).z - follow.z) ? a : b;
  return { at: STUB_AT, heading, halfW: 0.55, halfD: 0.3, tall: 1.85, pitchDeg: 8, insetTop: 104, insetBottom: 60 };
}

/** The framed views (design §3.6): the glade floor from above for the acorns (corsi),
 *  the stump in the picture too (where the squirrel sits when it forgets); and the
 *  neighbours on their perches, looking a little up, for the calls (simon). */
export const GLADE_VIEW = {
  at: g(SPOTS_AT.u - 0.55, SPOTS_AT.v + 0.25), heading: GLADE_FRAME.heading + 0.1,
  halfW: 2.2, halfD: 1.45, tall: 0.7, pitchDeg: 38, insetTop: 100, insetBottom: 10,
  include: [{ x: STAND.x, z: STAND.z, h: RANGER_STAND_HEIGHT }],
} as const;
/** The neighbours round the stump (their middle, for the view's aim). */
const NEIGHBOURS_AT = g(-1.0, 1.5);
/** (the lens stands by the ranger: the four neighbours fill the picture, near enough to
 *  read, seen as he sees them, looking a little up) */
export const CALLERS_VIEW = {
  at: NEIGHBOURS_AT, heading: headingTo(CALLERS_STAND, NEIGHBOURS_AT),
  halfW: 1.8, halfD: 0.7, tall: 2.15, pitchDeg: 3, insetTop: 60, insetBottom: 110,
} as const;

/** Where round a trunk (a heading from its axis) the squirrel hides from the ranger at
 *  `me`: about 110° round from him (out of his sight behind the bark, and the way round
 *  to see it passes the trunk with room to spare), on the side nearer `toward` (its glade). */
export function hideSide(trunk: { x: number; z: number }, me: { x: number; z: number }, toward: { x: number; z: number }): number {
  const him = headingTo(trunk, me);
  const a = him + Math.PI - 1.2, b = him + Math.PI + 1.2;
  const at = (h: number): { x: number; z: number } => ({ x: trunk.x + Math.sin(h) * 2, z: trunk.z + Math.cos(h) * 2 });
  return Math.hypot(at(a).x - toward.x, at(a).z - toward.z) < Math.hypot(at(b).x - toward.x, at(b).z - toward.z) ? a : b;
}

/** How far out from the trunk's axis (m) the ranger stands to see it there. */
export const HIDE_SEEN_AT = 2.8;

/** Who lives here: the squirrel, round its pine by the marker before; at its glade after,
 *  in the pine by its store (the jay's branch is free: the jay flew off). */
export const EEKHOORN_RESIDENTS: readonly ResidentSpec[] = [
  {
    key: 'squirrel', animal: 'eekhoorn',
    before: { ...OAK_AT, idle: 'root', roam: 0 },
    after: { x: TREE.storePine.x, z: TREE.storePine.z, idle: 'root', roam: 0 },
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
    // round pine C, where it plays hide-and-seek: no fern to hide it when it pops out
    { x: PINE_C.x, z: PINE_C.z, r: 4.2 },
    // the marker ring stays open (the child stands in it, looking at the squirrel's pine)
    { x: MARKER.x, z: MARKER.z, r: 1.8 },
    // the neighbours' corner: no fern in front of or behind the jay and the raven
    { x: JAY_GROUND.x, z: JAY_GROUND.z, r: 1.0 },
    { x: SNAG.x, z: SNAG.z, r: 1.3 },
    { x: SEEDLING_AT.x, z: SEEDLING_AT.z, r: 0.8 },
    { ...g(0.1, 3.1), r: 1.6 },
  ];
}
