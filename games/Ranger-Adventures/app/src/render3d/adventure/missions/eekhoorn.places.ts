/**
 * eekhoorn.places.ts — where "De verstopte nootjes" happens in the world, and who lives
 * there (THREE-free; `eekhoorn.places.test.ts` pins it). Chosen by looking at the world
 * (design run6-missions §4.4, run 7 `state/eekhoorn/design.md` §6): the bos south-west of
 * the watchtower, flat, open forest, the nachtronde and vos markers and the tower ≥ 10 m
 * away, the wildcamera's wood to the north left alone.
 *
 * Seen by a child walking up from the clearing: the marker ring in the wood, and right
 * past it the squirrel's PINE (its den), the squirrel running up and down it. Every play
 * (run 7) it leads him another WAY through its pines (`ROUTES`): along the middle (the
 * old line), round to the left past the old pines, or up the right past the fallen wood.
 * Tree to tree it waits on a low stub beside the trunk, leaps between close pines, and at
 * its last pine it hides round the trunk until he walks round and finds it; then it runs
 * into its GLADE: an open patch of forest floor with seven look-alike mossy spots (where
 * it buries its acorns, in one of four mirror-images of the same pattern), a stump with
 * its store of acorns, a big oak at the side, and round the stump its neighbours — one
 * bird on the store pine's dead stub, one on its bark, one on a dead snag (drawn per play
 * from `NEIGHBOURS`) — while the jay, the nut thief, waits on the oak.
 *
 *   marker ── den pine ─┬─ midden: Z1 · wait ── A · wait ── (leap) B ── (leap) C · hide
 *                       ├─ noord:  N1 · wait ── B · wait ── N4 · hide
 *                       └─ zuid:   Z1 · wait ── Z2 · wait ── Z4 · hide
 *                                                                  └── (dash) ── the glade
 */

import { PRINT_SPOTS } from '../../../engines/corsi.ts';
import { RANGER_STAND_HEIGHT } from '../../AnimalScale.ts';
import type { HomeSpec, Place, ResidentSpec, Spot } from '../types.ts';
import { atLocal, dist, headingTo, segDist, uniformLocal, type Frame } from '../places.ts';
import { barkRadius } from '../squirrel-math.ts';
import type { TreeStub } from '../../world/Forest.ts';

/** The eekhoorn marker: the bos anchor it has always had (the test checks it). */
export const MARKER: Spot = { x: 25.419167959680543, z: -41.89111958682353 };

/** The kind of tree (the world's forest GLB) and how tall it grows (m). */
export type TreeKind = 'prop-oak-tree' | 'prop-pine-scots' | 'prop-birch-tree';
export interface HomeTree extends Spot {
  /** its name in this file (the tests and the stats say it) */
  id: string;
  species: TreeKind;
  /** its height (m) */
  h: number;
  /** its spin (rad): which way its low limbs face */
  rotY: number;
  /** the branch stub the squirrel (or a bird) sits on: which way it points (a heading),
   *  how high its top is (m), how far it reaches out from the bark (m); `look`: the
   *  heading from its seat out to the spot he sees it from (default a little round from
   *  the stub's own way) */
  branch?: { ang: number; h: number; out: number; look?: number };
}

const wrapA = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/* -------------------------------------------------------------- the den ---- */

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

/** How high the stubs it waits on stand (m, their top): low, about the boy's shoulder (he
 *  is 1.32 m), so the squirrel sitting up there faces him eye to eye. */
export const WAIT_H = 1.1;
/** How far round from the line back to where he comes from a wait's stub points (rad):
 *  BESIDE its trunk as he comes (design §6.2: 45-75°), so the squirrel's outline stands
 *  against the wood behind it, not against its own dark bark. */
export const WAIT_TURN = (60 * Math.PI) / 180;
/** The spot to see a waiting squirrel from: `WATCH_D` m from its seat, a little round
 *  from its stub (`WATCH_TURN` rad) — or, at a wait whose stub points beside its trunk,
 *  back toward where he comes from, `LOOK_TURN` rad round to the stub's side: he stands
 *  in front of the tree and sees it sitting beside the trunk, over his shoulder. */
const WATCH_D = 1.6;
const WATCH_TURN = 0.3;
const LOOK_TURN = 0.35;

/* -------------------------------------------------------------- the way ---- */

/** The ways it leads him (run 7, design §6.2). */
export type RouteId = 'midden' | 'noord' | 'zuid';
export const ROUTE_IDS: readonly RouteId[] = ['midden', 'noord', 'zuid'];

/** One tree of a way: how it gets there (a dash over the ground, or a leap from the
 *  branch of the tree before), and whether it waits there for him. */
export interface Hop { tree: HomeTree; how: 'dash' | 'leap'; wait: boolean }
export interface Route {
  id: RouteId;
  /** the trees in order from its den (the last one is `hide`) */
  hops: readonly Hop[];
  /** the tree it plays hide-and-seek round (its last wait) */
  hide: HomeTree;
  /** the trees it waits at, in order (the last is `hide`) */
  waits: readonly HomeTree[];
}

/** One tree of a way as this file writes it: where it stands (unless another way already
 *  planted it: `x` unset), how the squirrel gets there, whether it waits there. A wait's
 *  stub points `side` of the line back to where he comes from (`turn` round, default
 *  `WAIT_TURN`), and he sees it from `look` round from that line (default `LOOK_TURN`); a
 *  tree it only passes gets a stub a little round from the tree before (where it lands). */
interface Spec { id: string; x?: number; z?: number; h?: number; rotY?: number; how: 'dash' | 'leap'; wait: boolean;
  side?: 1 | -1; turn?: number; look?: number }

/** The trees of each way (world x/z, chosen by looking at the wood from the marker and
 *  pinned by the tests): the first wait within 6 m of the ring, each wait within 6.5 m of
 *  the one before, leaps only between pines ≤ 3.6 m apart and onward, the three hide
 *  trees each in its own open ring. Few new pines: the view over this wood toward the
 *  tower already draws ~0.98M of the 1M triangles (measured 2026-10-03; every pine near the
 *  lens costs 12k, and 12k more while the lens looks through it), so the ways share where
 *  they can: the left way waits at the old line's middle pine (B), which the middle way
 *  only leaps through; the middle and the right way leave the den for the same pine (Z1)
 *  and part there. */
const WAY_SPECS: Readonly<Record<RouteId, readonly Spec[]>> = {
  // along the middle: off to the pine behind the den on the right (the right way's first
  // pine too), then the old line (A, a leap to B and on to C)
  midden: [
    { id: 'z1', how: 'dash', wait: true },
    { id: 'a', x: 20.504, z: -48.594, h: 13.5, rotY: 2.2, how: 'dash', wait: true, side: -1, look: 0.6 },
    { id: 'b', how: 'leap', wait: false },
    { id: 'c', x: 15.561, z: -51.028, h: 14.2, rotY: 5.3, how: 'leap', wait: true, side: 1, look: 1.2 },
  ],
  // round to the left: off the ring to the child's left, over to the old line's middle pine
  // (B, where it waits low), and down to a pine on its own at the glade's north side
  noord: [
    { id: 'n1', x: 21.2, z: -43.6, h: 12.8, rotY: 0.6, how: 'dash', wait: true, side: 1 },
    { id: 'b', x: 17.002, z: -48.18, h: 12.4, rotY: 4.1, how: 'dash', wait: true, side: -1 },
    { id: 'n4', x: 11.4, z: -51.2, h: 14.6, rotY: 2.5, how: 'dash', wait: true, side: 1 },
  ],
  // up the right: behind the den to the right, a long dash, and a pine on its own at the
  // glade's east side
  zuid: [
    // (z1's stub only 45° round: further round, the spot to see it from comes within 8 m of
    // the vos marker; on its other side the den's trunk hides it from the ring)
    { id: 'z1', x: 25.9, z: -47.4, h: 13.0, rotY: 5.9, how: 'dash', wait: true, side: 1, turn: Math.PI / 4, look: 0.3 },
    { id: 'z2', x: 24.4, z: -51.2, h: 13.8, rotY: 1.1, how: 'dash', wait: true, side: -1 },
    { id: 'z4', x: 22.6, z: -57.2, h: 14.4, rotY: 0.2, how: 'dash', wait: true, side: 1 },
  ],
};
/** The way that plants each shared tree is laid first (its stub is that way's wait). */
const PLANT_ORDER: readonly RouteId[] = ['noord', 'zuid', 'midden'];

/** The trees of the home (the forest draws them with its own; the scatter keeps clear).
 *  [0] its den by the marker; then every way's trees; then the glade's oak and the pine
 *  by the store. */
export const HOME_TREES: readonly HomeTree[] = (() => {
  const den: HomeTree = { id: 'den', ...OAK_AT, species: 'prop-pine-scots', h: 14, rotY: 0.9, branch: { ang: headingTo(OAK_AT, MARKER) - 0.5, h: 1.45, out: 0.3 } };
  const out: HomeTree[] = [den];
  for (const id of PLANT_ORDER) {
    let from: Spot = MARKER; // (where he comes from to the next wait)
    let prev: Spot = OAK_AT; // (the tree before)
    for (const s of WAY_SPECS[id]) {
      let t = out.find((q) => q.id === s.id);
      if (!t) {
        if (s.x === undefined || s.z === undefined) throw new Error(`[eekhoorn] tree ${s.id} is planted by no way`);
        t = { id: s.id, x: s.x, z: s.z, species: 'prop-pine-scots', h: s.h ?? 13, rotY: s.rotY ?? 0 };
        // a wait: its LOW stub beside the trunk as he comes (over his shoulder in the
        // follow lens, never behind his head); a tree it only passes: a stub a little
        // round from the tree before (where it lands from its leap)
        t.branch = s.wait
          ? { ang: headingTo(t, from) + (s.side ?? 1) * (s.turn ?? WAIT_TURN), h: WAIT_H, out: 0.28, look: headingTo(t, from) + (s.side ?? 1) * (s.look ?? LOOK_TURN) }
          : { ang: headingTo(t, prev) + 0.2, h: 1.55, out: 0.26 };
        out.push(t);
      }
      if (s.wait) from = watchSpot(t);
      prev = t;
    }
  }
  // the glade's big oak, at its right side: the acorns come from it (its crown stays
  // clear of the neighbours on the left); the jay waits on its low stub
  out.push({ id: 'gladeOak', ...g(8.0, 2.6), species: 'prop-oak-tree', h: 11, rotY: 2.7, branch: { ang: headingTo(g(8.0, 2.6), g(0, 0)), h: 1.5, out: 0.34 } });
  // the pine by the store, left of the stump: a small bird sits on its dead stub, a
  // woodpecker or a nuthatch on its bark, and after the mission the squirrel lives in it
  out.push({ id: 'storePine', ...g(-2.45, 1.7), species: 'prop-pine-scots', h: 12, rotY: 3.3, branch: { ang: headingTo(g(-2.45, 1.7), CALLERS_STAND) - 0.6, h: 1.75, out: 0.34 } });
  return out;
})();

const treeById = (id: string): HomeTree => {
  const t = HOME_TREES.find((q) => q.id === id);
  if (!t) throw new Error(`[eekhoorn] no home tree ${id}`);
  return t;
};

/** The three ways (design §6.2), each a list of hops from its den. */
export const ROUTES: Readonly<Record<RouteId, Route>> = Object.fromEntries(ROUTE_IDS.map((id) => {
  const hops = WAY_SPECS[id].map((s): Hop => ({ tree: treeById(s.id), how: s.how, wait: s.wait }));
  return [id, { id, hops, hide: hops[hops.length - 1].tree, waits: hops.filter((h) => h.wait).map((h) => h.tree) }];
})) as unknown as Record<RouteId, Route>;

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

/** A home tree by its name (for the tests and the script). */
export const TREE = {
  oak: HOME_TREES[0], a: treeById('a'), b: treeById('b'), c: treeById('c'),
  gladeOak: treeById('gladeOak'), storePine: treeById('storePine'),
} as const;

/** The stump with the acorn store (left of the spots), and the dead snag. */
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
/** Where the woodpecker (the `stam` neighbour) clings on its pine: 1.2 m up, on the side
 *  of the trunk that is its edge as the lens sees it (`ang`: the heading from the trunk's
 *  axis out to it, square to the lens), so it is seen in profile against the wood behind,
 *  never half behind the trunk. */
export const WOODPECKER = { tree: TREE.storePine, h: 1.2, ang: headingTo(TREE.storePine, g(-1.0, -1.9)) + 1.5 } as const;

/** Where a forgotten acorn grows into an oak seedling (after, on a later visit): in the
 *  glade between the caching spots and the big oak, off every spot (the acorns the child
 *  helped find are all back in the store: this one was forgotten long before). */
export const SEEDLING_AT: Spot = g(1.6, 1.6);

/* ------------------------------------------------------- the follow's waits ---- */

/** Where the squirrel sits up on a tree's stub (world x/z; its feet at `branch.h`). */
export function seatOf(t: HomeTree): Spot {
  const b = t.branch!;
  const r = barkRadius({ x: t.x, z: t.z, H: t.h, species: t.species }, b.h) + b.out;
  return { x: t.x + Math.sin(b.ang) * r, z: t.z + Math.cos(b.ang) * r };
}

/** How near (m) he comes to the squirrel waiting on its stub before it runs on: close
 *  enough that it reads as an animal through the follow lens (≈ 35 px tall at 1280×800,
 *  more as he comes closer). */
export const SEE_D = 2.2;
/** Where golden's walk hint stops him short of its seat once he is at the spot to see it
 *  from and it sits there (m): walking on at it, the lens turns to it, it comes within
 *  SEE_D, and it is still over his shoulder, not behind his head. */
export const SEAT_STOP = 1.4;
/** Right at it (m): he walked up to the squirrel on its stub — under it, the trunk
 *  stopping him — and that counts as soon as a bit of it shows in the picture: his own
 *  head in front of it in the lens behind him hides nothing from HIM (hide-and-seek's
 *  `near` rule). Walking straight at it, the trunk stops him well inside this. */
export const AT_IT = 1.6;
/** He has SEEN it when most of it is well inside the picture — within this much of the
 *  half-width from the middle (0.7: the middle 70 % of the screen; at the very edge it is
 *  there, but a child has not seen it yet) — and not behind a trunk or his own body. */
export const SEEN_X = 0.7;
/** It runs on only once it is inside this much of the half-width from the middle of his
 *  picture (the middle 80 %), so a dash or a leap STARTS where he sees it (design §6.2);
 *  it waits for that at most `RUN_ON_WAIT` s. */
export const RUN_ON_X = 0.8;
export const RUN_ON_WAIT = 3;
/** The spot to see it from (golden's walk hint): out from its seat a little to the side,
 *  so it sits over his shoulder, not straight over his head, and nothing is between
 *  (`WATCH_D`, `WATCH_TURN`, `LOOK_TURN`: above, the ways are laid with them). */
/** Near enough the spot to see it from (golden's walk hint radius). */
export const WATCH_R = 1.0;
export function watchSpot(t: HomeTree): Spot {
  const s = seatOf(t), a = t.branch!.look ?? t.branch!.ang + WATCH_TURN;
  return { x: s.x + Math.sin(a) * WATCH_D, z: s.z + Math.cos(a) * WATCH_D };
}

/** Where he comes from to each wait of a way (the marker, then the spot he saw the wait
 *  before from). */
export function comesFrom(route: Route, i: number): Spot {
  return i === 0 ? MARKER : watchSpot(route.waits[i - 1]);
}

/** The places table (the waits of the middle way stand for the follow; the play reads
 *  its own way's). */
export const EEKHOORN_PLACES = {
  marker: { ...MARKER, r: 2.4 },
  oak: { ...OAK_AT },
  /** where he sees the squirrel on its low stub from, on the middle way's first and last
   *  waits (it runs on once he is within SEE_D m of it and it is in his view) */
  hopA: { ...watchSpot(ROUTES.midden.waits[0]), r: SEE_D },
  hopC: { ...watchSpot(ROUTES.midden.hide), r: SEE_D },
  /** where the ranger stands to watch the glade floor, facing its spots */
  stand: { ...STAND, r: 1.6, heading: headingTo(STAND, g(SPOTS_AT.u, SPOTS_AT.v)) },
  /** where he steps to for the neighbours' calls, facing them */
  callers: { ...CALLERS_STAND, r: 0.8, heading: headingTo(CALLERS_STAND, g(-1.0, 1.45)) },
  glade: { ...GLADE_AT, heading: GLADE_FRAME.heading },
  stump: { x: STUMP.x, z: STUMP.z },
  /** the home place: the ranger ends near it (golden step 8) */
  home: { ...GLADE_AT },
} as const satisfies Record<string, Place>;

/* ------------------------------------------------------------ the glade ---- */

/** The four mirror-images of the caching pattern (design §6.4): as drawn, mirrored left to
 *  right (u → −u), front to back (v → −v), or both (turned half round). All four keep
 *  every distance between two spots: the same pattern to remember as the 2D floor's. */
export type FieldSym = 'recht' | 'spiegel-u' | 'spiegel-v' | 'om';
export const FIELD_SYMS: readonly FieldSym[] = ['recht', 'spiegel-u', 'spiegel-v', 'om'];

/** The middle of the PRINT_SPOTS layout (in its own percent units). */
const PRINT_MID = (() => {
  const xs = PRINT_SPOTS.map((s) => s.x), ys = PRINT_SPOTS.map((s) => s.y);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
})();

/** A mirror-image's small shift over the floor (m, in the glade's u/v): mirrored front to
 *  back, the pattern's corner spot would lie in the heap's acorns; a step right keeps it
 *  0.7 m off (the same pattern, only moved). */
const SYM_SHIFT: Readonly<Record<FieldSym, { u: number; v: number }>> = {
  recht: { u: 0, v: 0 }, 'spiegel-u': { u: 0, v: 0 }, 'spiegel-v': { u: 0.15, v: -0.15 }, om: { u: 0, v: 0 },
};

/** The seven caching spots (world x/z), in PRINT_SPOTS id order, under `sym`. */
export function gladeSpots(sym: FieldSym = 'recht'): (Spot & { id: number })[] {
  const fu = sym === 'spiegel-u' || sym === 'om' ? -1 : 1;
  const fv = sym === 'spiegel-v' || sym === 'om' ? -1 : 1;
  return PRINT_SPOTS.map((s) => {
    const x = PRINT_MID.x + (s.x - PRINT_MID.x) * fu;
    const y = PRINT_MID.y + (s.y - PRINT_MID.y) * fv;
    const { u, v } = uniformLocal(x, y, SPOT_SCALE);
    return { id: s.id, ...g(SPOTS_AT.u + SYM_SHIFT[sym].u + u, SPOTS_AT.v + SYM_SHIFT[sym].v + v) };
  });
}

/* ----------------------------------------------------------- the den look ---- */

/** The one look at the start (design §3.6: an establishing look): the child meets the
 *  squirrel on its branch stub. The lens stands on his side of the pine, turned ~40° off
 *  the line from him to the squirrel (so his head is not in front of it, and the trunk
 *  never stands between the lens and him), on the side the squirrel will lead him to
 *  (`toward`: this play's first wait), so the hand-over to the follow camera behind him
 *  is a short, calm move. */
const STUB_AT: Spot = (() => {
  const t = HOME_TREES[0], b = t.branch!;
  const r = barkRadius({ x: t.x, z: t.z, H: t.h, species: t.species }, b.h) + b.out;
  return { x: t.x + Math.sin(b.ang) * r, z: t.z + Math.cos(b.ang) * r };
})();
const INTRO_OFF = 0.7;
const INTRO_D = 2.8; // (≈ where the lens fit lands: for choosing the side only)
export function introView(me: Spot, toward: Spot = ROUTES.midden.waits[0], tall = 1.85): {
  at: Spot; heading: number; halfW: number; halfD: number; tall: number; pitchDeg: number; insetTop: number; insetBottom: number;
} {
  const toStub = headingTo(me, STUB_AT);
  // the follow camera will stand behind him, looking where the squirrel runs
  const on = headingTo(me, toward);
  const follow = { x: me.x - Math.sin(on) * 4, z: me.z - Math.cos(on) * 4 };
  const lensOf = (h: number): Spot => ({ x: STUB_AT.x - Math.sin(h) * INTRO_D, z: STUB_AT.z - Math.cos(h) * INTRO_D });
  const a = toStub + INTRO_OFF, b = toStub - INTRO_OFF;
  const heading = Math.hypot(lensOf(a).x - follow.x, lensOf(a).z - follow.z) < Math.hypot(lensOf(b).x - follow.x, lensOf(b).z - follow.z) ? a : b;
  return { at: STUB_AT, heading, halfW: 0.55, halfD: 0.3, tall, pitchDeg: 8, insetTop: 104, insetBottom: 60 };
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
/** (the lens stands by the ranger: the four callers fill the picture, near enough to
 *  read, seen as he sees them, looking a little up) */
export const CALLERS_VIEW = {
  at: NEIGHBOURS_AT, heading: headingTo(CALLERS_STAND, NEIGHBOURS_AT),
  halfW: 1.8, halfD: 0.7, tall: 2.15, pitchDeg: 3, insetTop: 60, insetBottom: 110,
} as const;

/** The trunk's collider plus the boy and a margin (world/Dressing: 0.6 m per 12.5 m of
 *  tree; the boy ≈ 0.3 m round). */
export function trunkClear(t: HomeTree): number { return (0.6 * t.h) / 12.5 + 0.3 + 0.25; }

/** The next spot on a straight way to `goal` (golden's walk hint: a perfect player walks
 *  straight): `goal` itself, or — when a home tree's trunk stands in the way — the spot
 *  where his way just grazes past that trunk (a tangent), or, right by it, a step round
 *  it toward the goal. */
export function wayTo(me: Spot, goal: Spot): Spot {
  let block: HomeTree | null = null, bt = Infinity;
  for (const t of HOME_TREES) {
    if (segDist(t, me, goal) >= trunkClear(t) - 0.15) continue;
    const along = (t.x - me.x) * (goal.x - me.x) + (t.z - me.z) * (goal.z - me.z);
    if (along < bt) { bt = along; block = t; }
  }
  if (!block) return goal;
  const r = trunkClear(block) + 0.35;
  const th = headingTo(block, me);
  const toGoal = wrapA(headingTo(block, goal) - th);
  const d = dist(me, block);
  const tangent = d > r + 0.05 ? Math.acos(r / d) : 0;
  const a = th + Math.sign(toGoal || 1) * Math.max(tangent, Math.min(0.9, Math.abs(toGoal)));
  return { x: block.x + Math.sin(a) * r, z: block.z + Math.cos(a) * r };
}

/* --------------------------------------------------------- hide-and-seek ---- */

/** Hide-and-seek round this play's hide tree: a red squirrel keeps the trunk between
 *  itself and whoever comes near — him, and his eye (the follow lens behind him, which
 *  swings round as he turns). It clings `h` m up the bark on the side of the trunk
 *  farthest from both. When one of them comes round within `keepAt` rad of it (its body is
 *  thick beside a pine's trunk, so that is well before it shows), or a bit of it already
 *  peeks out in his view, it slips round to the farthest side again — a real move (`gain`
 *  rad further from them at least), never faster than he walks (`rate` rad/s round the
 *  bark: under 1 m/s). Once he has walked `round` rad round the tree (or it slipped `most`
 *  times) it stays, and he finds it as he comes round — in his view, or right by it
 *  (within `near` m of it, within `nearAng` rad of its side of the tree) with a bit of it
 *  showing. So he walks about half round the tree, and it slips once or twice. */
export const HIDE = { h: 1.05, keepAt: 1.9, gain: 0.6, round: 2.2, most: 3, rate: 1.8, near: 1.4, nearAng: 0.9 } as const;

/** Never on the side of a hide tree that faces a close neighbour (a home pine within
 *  4.5 m): he could not stand there to see it, and the way round would run into that
 *  trunk. */
const AVOID_HALF = 0.65;
const avoidOf = (tree: HomeTree): number[] =>
  HOME_TREES.filter((t) => t !== tree && dist(t, tree) < 4.5).map((t) => headingTo(tree, t));
const allowed = (tree: HomeTree, a: number): boolean => avoidOf(tree).every((b) => Math.abs(wrapA(a - b)) >= AVOID_HALF);

/** How far round the trunk (rad) the nearest of `eyes` (headings from its axis) is from `a`. */
function margin(a: number, eyes: readonly number[]): number {
  return Math.min(...eyes.map((e) => Math.abs(wrapA(a - e))));
}

/** The side of `tree`'s trunk farthest from all `eyes` (headings from its axis; off a
 *  neighbour's side), the one nearer `from` when two are as good. */
export function hideFrom(tree: HomeTree, eyes: readonly number[], from: number): number {
  let best = from, score = -1;
  for (let i = 0; i < 144; i++) {
    const a = (i / 144) * Math.PI * 2 - Math.PI;
    if (!allowed(tree, a)) continue;
    const m = margin(a, eyes) - Math.abs(wrapA(a - from)) * 0.02;
    if (m > score) { score = m; best = a; }
  }
  return best;
}

/** Where it first hides on `tree` (a heading from the trunk's axis): across the trunk
 *  from him and his eye (`eyes`), the side toward `toward` (its glade) when that is as
 *  good. */
export function hideStart(tree: HomeTree, eyes: readonly Spot[], toward: Spot): number {
  const a = hideFrom(tree, eyes.map((e) => headingTo(tree, e)), headingTo(tree, toward));
  // (a little toward its glade: the short way round to it goes that way)
  const b = a + Math.sign(wrapA(headingTo(tree, toward) - a) || 1) * 0.25;
  return allowed(tree, b) ? b : a;
}

/** He or his eye has come round toward it (`eyes`: their headings from the trunk), or
 *  (`peek`) a bit of it shows in his view: where it slips to now, or null when it stays
 *  (none of them near enough round yet and unseen, or no side farther from them). */
export function hideShift(tree: HomeTree, sqAng: number, eyes: readonly number[], peek = false): number | null {
  const m = margin(sqAng, eyes);
  if (m >= HIDE.keepAt && !peek) return null;
  const to = hideFrom(tree, eyes, sqAng);
  // (a peek always sends it round; otherwise only a real move is worth a slip)
  return peek || margin(to, eyes) - m >= HIDE.gain ? to : null;
}

/** How long a slip round the bark from `a` to `b` takes (s). */
export function slipSecs(a: number, b: number): number {
  return Math.max(0.55, Math.abs(wrapA(b - a)) / HIDE.rate);
}

/** Golden's walk hint round the tree (a perfect player walks straight, then looks): round
 *  the tree `OUT_R` m out, at most `ROUND_STEP` rad at a time, the short way toward where
 *  it clings; once he is out on its side, in toward the trunk to `IN_R` m (walking at the
 *  tree, the follow lens behind him looks at it) — all the way in (`IN_STOP`), and from
 *  right by that spot a step further in to `IN_NEAR`: he must walk AT the tree. Golden
 *  stops within a hint's radius, and a step in that was within it already left him
 *  standing on its side, still facing along the trunk from his walk round, the lens
 *  beside the bark where the squirrel clings on the trunk's edge in the picture, counted
 *  hidden — for good (4 of 13 plays, 2026-10-01). */
const OUT_R = 3.0;
const IN_R = 2.3;
const IN_NEAR = 1.6;
const IN_STOP = 0.5;
const ROUND_STEP = 1.05;
const ON_ITS_SIDE = 0.3;
export function roundStep(t: HomeTree, me: Spot, sqAng: number): Spot & { r?: number } {
  const him = headingTo(t, me);
  const off = wrapA(sqAng - him);
  const a = him + Math.sign(off) * Math.min(ROUND_STEP, Math.abs(off));
  const out = { x: t.x + Math.sin(a) * OUT_R, z: t.z + Math.cos(a) * OUT_R };
  // (round a neighbour's trunk in the way, too) — unless he is on its side, or so near it
  // that the step round would not move him at all (within a hint's radius): then in
  if (Math.abs(off) > ON_ITS_SIDE && dist(me, out) >= WATCH_R + 0.2) return wayTo(me, out);
  const at = (d: number): Spot => ({ x: t.x + Math.sin(sqAng) * d, z: t.z + Math.cos(sqAng) * d });
  const d = dist(me, at(IN_R)) < IN_STOP + 0.4 ? IN_NEAR : IN_R;
  return { ...wayTo(me, at(d)), r: IN_STOP };
}

/* ------------------------------------------------------ the found view ---- */

/** Where the lens holds him and the squirrel once he has found it (design §6.3): on HIS
 *  side of the tree, about level with it (~1.4 m up), turned `turns[0]` off the line from
 *  him to it, so the two of them stand apart across the picture, face to face — him at
 *  one side, whole, the squirrel peeking round the bark at the other, big (≥ 60 px) and
 *  well off the middle. (Measured on the fit, eekhoorn.places.test.ts, and played
 *  2026-10-03: at the design's 30° the squirrel sat within ~70 px of the middle with his
 *  body in line behind it, and the lens ~1.5 m from him faded him; at 75° they face each
 *  other across the picture, the lens ~2.9 m from him and ~3.2-4 m from the squirrel: him
 *  whole in it keeps it there.) When a pine of the home would stand between that lens and
 *  either of them, the lens tries the other side, then a smaller turn (`turns`). */
export const FOUND = { turns: [75, 60, 45, 30].map((d) => (d * Math.PI) / 180), toward: 0.55, back: 3.4 } as const;
/** He has found it only from within this far of its trunk (m): from further off, a squirrel
 *  that shows past the bark is still hiding from him (played 2026-10-03: a bot walked 20 m
 *  round and "found" it from the glade, 11 m off, and the held view lost them both). */
export const FIND_R = 4.2;
export function foundView(tree: HomeTree, sqAng: number, me: Spot): {
  at: Spot; heading: number; halfW: number; halfD: number; tall: number; pitchDeg: number; insetTop: number; insetBottom: number;
  include: { x: number; z: number; h: number; r: number }[];
} {
  const r = barkRadius({ x: tree.x, z: tree.z, H: tree.h, species: tree.species }, HIDE.h) + 0.08;
  const sq = { x: tree.x + Math.sin(sqAng) * r, z: tree.z + Math.cos(sqAng) * r };
  // the picture's middle: between them, a little nearer the squirrel (at a smaller turn,
  // nearer him: the squirrel stays well off the middle of the picture)
  const middle = (turn: number): Spot => {
    const k = FOUND.toward + Math.max(0, Math.min(1, (FOUND.turns[0] - turn) / (FOUND.turns[0] - FOUND.turns[FOUND.turns.length - 1]))) * 0.3;
    return { x: sq.x + (me.x - sq.x) * k, z: sq.z + (me.z - sq.z) * k };
  };
  const toSq = headingTo(me, sq);
  // (the side away from the trunk first: it never looks past the bark at either of them)
  const pref = Math.sign(wrapA(headingTo(sq, me) - sqAng)) || 1;
  const clear = (heading: number, at: Spot): boolean => {
    const cam = { x: at.x - Math.sin(heading) * FOUND.back, z: at.z - Math.cos(heading) * FOUND.back };
    // the squirrel's side of the trunk faces the lens
    if (Math.abs(wrapA(headingTo(tree, cam) - sqAng)) > (80 * Math.PI) / 180) return false;
    return HOME_TREES.every((t) => {
      const rr = barkRadius({ x: t.x, z: t.z, H: t.h, species: t.species }, 1) + 0.3;
      if (dist(t, cam) < rr + 0.7) return false;
      return segDist(t, cam, me) > rr && (t === tree || segDist(t, cam, sq) > rr);
    });
  };
  let heading = toSq - pref * FOUND.turns[0];
  let at = middle(FOUND.turns[0]);
  find: for (const turn of FOUND.turns) for (const side of [pref, -pref]) {
    if (clear(toSq - side * turn, middle(turn))) { heading = toSq - side * turn; at = middle(turn); break find; }
  }
  return { at, heading, halfW: 0.3, halfD: 0.25, tall: 1.3, pitchDeg: 4, insetTop: 96, insetBottom: 36,
    include: [{ x: me.x, z: me.z, h: RANGER_STAND_HEIGHT, r: 0.25 }] };
}

/** Where he stands in the found view: where he is, or — found from further off than
 *  `FOUND_NEAR` m — a few calm steps nearer it (the lens holding the two of them keeps the
 *  squirrel ≥ 60 px only that near). */
export const FOUND_NEAR = 2.1;
export function foundStand(tree: HomeTree, sqAng: number, me: Spot): Spot {
  const r = barkRadius({ x: tree.x, z: tree.z, H: tree.h, species: tree.species }, HIDE.h) + 0.08;
  const sq = { x: tree.x + Math.sin(sqAng) * r, z: tree.z + Math.cos(sqAng) * r };
  const d = dist(me, sq);
  if (d <= FOUND_NEAR) return me;
  const k = (FOUND_NEAR - 0.3) / d;
  return { x: sq.x + (me.x - sq.x) * k, z: sq.z + (me.z - sq.z) * k };
}

/** The face of the trunk it comes out on once he found it (design §6.3): turned from his
 *  side toward the found view's lens, so it shows whole beside the bark. */
export function foundFace(tree: HomeTree, sqAng: number, me: Spot): number {
  const side = Math.sign(wrapA(headingTo(tree, me) - sqAng)) || 1;
  return headingTo(tree, me) - side * FOUND.turns[0] * 0.7;
}

/* -------------------------------------------- what he can find (run 7) ---- */

/**
 * The squirrel's NEST (a drey: a rough ball of twigs and dry leaves against the trunk), on
 * one wait tree of a play's way (design §6.7): `h` m up (2.1-2.5), on the side he comes
 * from, turned `turn` rad off the line back to where he comes from to the side away from
 * the stub it waits on (so the nest and the squirrel on its stub stand apart in his
 * picture: never one in front of the other), `r` m round (≈ 0.45 m across), hugging the
 * bark. Never on the hide tree (it plays hide-and-seek there).
 */
export const NEST = { h: 2.15, r: 0.23, turn: 0.35, hug: 0.72 } as const;
export interface NestSpot { tree: HomeTree; x: number; z: number; y: number; ang: number }
/** The wait trees of a way that may carry its nest (every wait but the hide tree). */
export function nestTrees(route: Route): readonly HomeTree[] { return route.waits.slice(0, -1); }
/** The nest on the `i`th wait of `route` (world x/z; its middle `y` m up; `ang` the heading
 *  from the trunk's axis out to it). */
export function nestOf(route: Route, i: number): NestSpot {
  const t = route.waits[i];
  const back = headingTo(t, comesFrom(route, i));
  const side = Math.sign(wrapA(t.branch!.ang - back)) || 1;
  const ang = back - side * NEST.turn;
  const r = barkRadius({ x: t.x, z: t.z, H: t.h, species: t.species }, NEST.h) + NEST.r * NEST.hug;
  return { tree: t, x: t.x + Math.sin(ang) * r, z: t.z + Math.cos(ang) * r, y: NEST.h, ang };
}
/** How solid the nest stands (1) or how far it fades (0), as the follow lens trailing him
 *  sees it: like a home tree's crown, it never fills the lens nor stands between the lens
 *  and him — the lens passes within `NEST_FADE.near` m of it on some ways (it hangs at the
 *  lens's height), or it is on the line from the lens to his head. `lens`, `nest`: world
 *  x/y/z; `me`: his feet. */
export const NEST_FADE = { near: 1.6, line: 0.5 } as const;
export function nestSolid(lens: { x: number; y: number; z: number }, nest: { x: number; y: number; z: number }, me: { x: number; y: number; z: number }): number {
  const d = Math.hypot(lens.x - nest.x, lens.y - nest.y, lens.z - nest.z);
  if (d < NEST_FADE.near) return 0;
  // (between the lens and his head, nearer the lens than he is)
  const hx = me.x, hy = me.y + 1.0, hz = me.z;
  const vx = hx - lens.x, vy = hy - lens.y, vz = hz - lens.z;
  const l2 = vx * vx + vy * vy + vz * vz;
  const t = l2 > 1e-9 ? ((nest.x - lens.x) * vx + (nest.y - lens.y) * vy + (nest.z - lens.z) * vz) / l2 : 0;
  if (t > 0 && t < 1) {
    const off = Math.hypot(lens.x + vx * t - nest.x, lens.y + vy * t - nest.y, lens.z + vz * t - nest.z);
    if (off < NEST.r + NEST_FADE.line) return 0;
  }
  return 1;
}
/** Where the squirrel peeks out of its nest at him (world x/z, its feet `y` m up, facing
 *  `yaw`: him): its head and shoulders out of the ball's side toward him, its back half still
 *  in the twigs. `me`: where he stands. */
export function nestPeek(n: NestSpot, me: Spot): { x: number; z: number; y: number; yaw: number } {
  const t = n.tree;
  // (out of the ball on his side, never into the bark behind it)
  let a = headingTo(n, me);
  const back = headingTo(n, t);
  if (Math.abs(wrapA(a - back)) < 1.4) a = back + Math.sign(wrapA(a - back) || 1) * 1.4;
  const out = NEST.r * 0.72;
  return { x: n.x + Math.sin(a) * out, z: n.z + Math.cos(a) * out, y: n.y - 0.16, yaw: headingTo(n, me) };
}

/**
 * Its DINING spots (design §6.7): a low stump or the end of a fallen trunk by the way,
 * where it sits to strip pine cones (the scales fall, the bare cores stay: the gnawed
 * cones a ranger learns to read). Each way passes two; a play lays its cones at one of
 * them (`kegels`). Chosen by walking each way as golden does (eekhoorn.places.test): dry,
 * in the wood, off every way's line (he walks past, never into it), out of the hide
 * trees' rings and the glade, and seen for a while as he walks or waits.
 */
export type DiningId = 'z1-oost' | 'z1-a' | 'z2-west' | 'n1-noord' | 'n4-noord';
export interface DiningSpot extends Spot { id: DiningId; kind: 'stronk' | 'stam'; turn: number }
export const DINING: readonly DiningSpot[] = [
  // behind the first pine of the middle and the right way: seen while he waits for it there
  { id: 'z1-oost', x: 27.5, z: -48.6, kind: 'stronk', turn: 0.4 },
  // between that pine and the old line's first pine (the middle way and the right way pass it)
  { id: 'z1-a', x: 22.95, z: -47.85, kind: 'stam', turn: 1.9 },
  // west of the right way's second pine, on the way down to its hide tree
  { id: 'z2-west', x: 20.75, z: -51.0, kind: 'stronk', turn: 2.6 },
  // on the left way, past its first pine toward the old line's middle pine
  { id: 'n1-noord', x: 19.25, z: -43.3, kind: 'stam', turn: 0.3 },
  // on the left way, before its hide tree
  { id: 'n4-noord', x: 13.3, z: -46.1, kind: 'stronk', turn: 5.1 },
];
/** The two dining spots each way passes. */
export const ROUTE_DINING: Readonly<Record<RouteId, readonly [DiningId, DiningId]>> = {
  midden: ['z1-oost', 'z1-a'],
  noord: ['n1-noord', 'n4-noord'],
  zuid: ['z1-oost', 'z2-west'],
};
export const diningById = (id: DiningId): DiningSpot => DINING.find((d) => d.id === id)!;
/** A stump's size (m: how high its cut top is, how wide round) and a log end's (how long
 *  it lies, how thick). */
export const STRONK = { h: 0.36, r: 0.26 } as const;
export const STAM = { len: 1.5, r: 0.17 } as const;
/** How near he must be (m) to see the gnawed cones, and how big they read (px across). */
export const DINING_SEE = { within: 5, across: 30, secs: 1 } as const;

/**
 * He SAW it (design §4.4: on screen, big enough, for a moment): a calm clock that runs only
 * while the thing is in his picture this frame and stops (back to 0) the moment it is not;
 * once it has run `secs` in a row it is seen, for good.
 */
export class SeenClock {
  private run = 0;
  seen = false;
  readonly secs: number;
  constructor(secs = 1) { this.secs = secs; }
  /** One frame: `ok` = in the picture, big enough, not hidden, near enough. */
  step(dt: number, ok: boolean): boolean {
    if (this.seen) return true;
    this.run = ok ? this.run + dt : 0;
    if (this.run >= this.secs) this.seen = true;
    return this.seen;
  }
}

/**
 * The rare dark-brown squirrel at the den (design §6.7): it comes down the trunk of the
 * den pine from above, out of the den look's picture and behind the trunk from the lens
 * (`start`), to the bark above ours on the side the lens sees (`meet`); the two spiral once
 * round the pine; then it runs up the far side of the trunk and away through the crown
 * (`up`: out of the picture, never toward the lens, never along the way ours leads him —
 * on the ground round the den every way off is a way of ours or the vos's ring).
 * `lens`: where the den look's lens stands. A play with this visitor frames the den look
 * a little taller (`tall`), so the two of them are in it.
 */
export const DEN_VISITOR = { startH: 4.4, meetH: 2.15, upH: 6.5, tall: 2.6, spiralH: 1.15 } as const;
export function denVisitor(lens: Spot): { start: { ang: number; h: number }; meet: { ang: number; h: number }; up: { ang: number; h: number } } {
  const t = HOME_TREES[0];
  const camAng = headingTo(t, lens);
  const stub = t.branch!.ang;
  // the bark above ours, turned a little toward the lens (well in its face of the trunk)
  const toCam = Math.sign(wrapA(camAng - stub)) || 1;
  const away = camAng + Math.PI;
  return {
    start: { ang: away, h: DEN_VISITOR.startH },
    meet: { ang: stub + toCam * 0.45, h: DEN_VISITOR.meetH },
    up: { ang: away, h: DEN_VISITOR.upH },
  };
}

/**
 * The rare young squirrel in the found view (design §6.7): it hides on the far side of the
 * trunk from the found view's lens (`start`), peeks round the bark beside ours (`peek`: a
 * little above it, on the lens's side), and once he has seen it runs up the trunk out of
 * the picture (`up`). `face`: where ours clings (foundFace); `lens`: the found view's lens.
 */
export const YOUNG = { scale: 0.7, peekUp: -0.3, peekTurn: 0.55, upH: 6 } as const;
export function youngPeek(tree: HomeTree, face: number, lens: Spot): { start: { ang: number; h: number }; peek: { ang: number; h: number }; up: { ang: number; h: number } } {
  const camAng = headingTo(tree, lens);
  const toCam = Math.sign(wrapA(camAng - face)) || 1;
  // (toward the lens's middle of the bark: never past it, where ours would hide it)
  const turn = Math.min(YOUNG.peekTurn, Math.abs(wrapA(camAng - face)));
  return {
    start: { ang: camAng + Math.PI, h: HIDE.h + YOUNG.peekUp },
    peek: { ang: face + toCam * turn, h: HIDE.h + YOUNG.peekUp },
    up: { ang: camAng + Math.PI, h: YOUNG.upH },
  };
}

/* -------------------------------------------------------- the neighbours ---- */

/** Where a neighbour sits round the stump: on the store pine's dead stub (sitting
 *  upright), on its bark (side-on to the lens), or on top of the dead snag. */
export type Slot = 'tak' | 'stam' | 'top';
export const SLOTS: readonly Slot[] = ['tak', 'stam', 'top'];
/** The neighbours a play draws one of per slot (design §6.5): their slot, their call's
 *  family (four callers of a play always call four different kinds of call), how tall the
 *  home shows them (m), and the letter the play's variant keeps. */
export interface NeighbourRow { id: string; slot: Slot; family: string; letter: string; h: number }
/** `h` is the height the home shows its model at (m), the modeller's perch block under its
 *  feet included (the home cuts that away: eekhoorn.home BIRD_POSE). What shows of each
 *  bird, ~4.5 m from the callers' lens: the small birds of the stub ~0.2 m (a great tit or a
 *  robin is 0.14 long: shown ≈ 1.5×, so a child sees which bird it is at ~35 px, as the
 *  scale table does for the robin that hops along), the woodpeckers and the nuthatch on the
 *  bark ~0.2-0.3 m, the raven and the cuckoo on the snag their true 0.3-0.42 m. */
export const NEIGHBOURS: readonly NeighbourRow[] = [
  { id: 'koolmees', slot: 'tak', family: 'pomp', letter: 'k', h: 0.33 },
  { id: 'merel', slot: 'tak', family: 'fluit', letter: 'm', h: 0.23 },
  { id: 'roodborst', slot: 'tak', family: 'zang', letter: 'r', h: 0.21 },
  { id: 'groene-specht', slot: 'stam', family: 'lach', letter: 'g', h: 0.42 },
  { id: 'grote-bonte-specht', slot: 'stam', family: 'roffel', letter: 'b', h: 0.3 },
  { id: 'boomklever', slot: 'stam', family: 'fluitje', letter: 'n', h: 0.29 },
  { id: 'raaf', slot: 'top', family: 'kras', letter: 'r', h: 0.42 },
  { id: 'koekoek', slot: 'top', family: 'koekoek', letter: 'k', h: 0.45 },
];
/** Two that never come together: two short, repeated tit-like notes (the great tit's
 *  "ti-ta" and the nuthatch's "tuuit") are too alike to tell apart in an echo. */
export const NOT_TOGETHER: readonly (readonly [string, string])[] = [['koolmees', 'boomklever']];
/** The squirrel's own call's family (it calls along from its stump). */
export const SQUIRREL_FAMILY = 'tjik';

export type Trio = Readonly<Record<Slot, string>>;
/** Before any play (the free world): a great tit, the green woodpecker, the raven. */
export const FIRST_TRIO: Trio = { tak: 'koolmees', stam: 'groene-specht', top: 'raaf' };

/** Every trio a play may draw (one per slot, never two that sound alike). */
export function legalTrios(): Trio[] {
  const of = (s: Slot): string[] => NEIGHBOURS.filter((n) => n.slot === s).map((n) => n.id);
  const out: Trio[] = [];
  for (const tak of of('tak')) for (const stam of of('stam')) for (const top of of('top')) {
    const ids = [tak, stam, top];
    if (NOT_TOGETHER.some(([a, b]) => ids.includes(a) && ids.includes(b))) continue;
    out.push({ tak, stam, top });
  }
  return out;
}

/** The trio as the variant keeps it: three letters, slot by slot ('kgr'). */
export function trioCode(t: Trio): string {
  return SLOTS.map((s) => NEIGHBOURS.find((n) => n.slot === s && n.id === t[s])!.letter).join('');
}
export function trioOf(code: string): Trio | null {
  if (code.length !== 3) return null;
  const ids = SLOTS.map((s, i) => NEIGHBOURS.find((n) => n.slot === s && n.letter === code[i])?.id);
  if (ids.some((x) => !x)) return null;
  return { tak: ids[0]!, stam: ids[1]!, top: ids[2]! };
}

/** Where each slot's bird is (world x/z; its feet `y` m up), the jay's perches, and the
 *  steps it backs off by. */
export const PERCH = {
  // (its feet ON the stub's top: lower, the stub ran in front of a blackbird's belly and
  // hid its middle from the lens — missions.spec, 2026-10-03)
  tak: (() => {
    const t = TREE.storePine, b = t.branch!;
    const r = barkRadius({ x: t.x, z: t.z, H: t.h, species: t.species }, b.h) + b.out * 0.75;
    return { x: t.x + Math.sin(b.ang) * r, z: t.z + Math.cos(b.ang) * r, y: b.h - 0.01 };
  })(),
  stam: (() => {
    const t = WOODPECKER.tree;
    const r = barkRadius({ x: t.x, z: t.z, H: t.h, species: t.species }, WOODPECKER.h) + 0.07;
    return { x: t.x + Math.sin(WOODPECKER.ang) * r, z: t.z + Math.cos(WOODPECKER.ang) * r, y: WOODPECKER.h };
  })(),
  top: { x: SNAG.x, z: SNAG.z, y: SNAG.h },
} as const satisfies Record<Slot, Spot & { y: number }>;

/** The jay before the mission: on the glade oak's low stub (out of the glade's and the
 *  callers' pictures), its eye on the store. */
export const JAY_WAIT = (() => {
  const t = TREE.gladeOak, b = t.branch!;
  const r = barkRadius({ x: t.x, z: t.z, H: t.h, species: t.species }, b.h) + b.out * 0.75;
  return { x: t.x + Math.sin(b.ang) * r, z: t.z + Math.cos(b.ang) * r, y: b.h - 0.08 };
})();
/** The jay's way back after each echo he gets right (design §6.5): from the ground by the
 *  heap, back over the leaf litter (away from him), onto the snag's root; after the last
 *  echo it flies off. A play's rounds spread their steps evenly along it. */
export const JAY_RETREAT: readonly Spot[] = (() => {
  const back = headingTo(CALLERS_STAND, JAY_GROUND);
  const litter = { x: JAY_GROUND.x + Math.sin(back) * 0.5, z: JAY_GROUND.z + Math.cos(back) * 0.5 };
  // (the root on the snag's near flank: beside it as he sees it, never in front of it)
  const toStand = headingTo(SNAG, CALLERS_STAND);
  const root = { x: SNAG.x + Math.sin(toStand + 1.5) * 0.4, z: SNAG.z + Math.cos(toStand + 1.5) * 0.4 };
  return [JAY_GROUND, litter, root];
})();
/** Where the jay stands after `step` of `steps` backings-off (0: by the heap; `steps`:
 *  at the snag's root), evenly along `JAY_RETREAT`. */
export function jayStep(step: number, steps: number): Spot {
  const pts = JAY_RETREAT;
  const lens = pts.slice(1).map((p, i) => dist(pts[i], p));
  const total = lens.reduce((s, l) => s + l, 0);
  let want = total * Math.max(0, Math.min(1, steps > 0 ? step / steps : 1));
  for (let i = 0; i < lens.length; i++) {
    if (want <= lens[i] || i === lens.length - 1) {
      const f = lens[i] > 0 ? Math.min(1, want / lens[i]) : 1;
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * f, z: pts[i].z + (pts[i + 1].z - pts[i].z) * f };
    }
    want -= lens[i];
  }
  return pts[pts.length - 1];
}

/* -------------------------------------------------------- this play's draw ---- */

/** What a play of the squirrel's game draws (design §6.1): its way, the mirror-image of
 *  its caching pattern (and the look of its cushions), its three neighbours; run 7 (its
 *  finds, design §6.7): which wait tree of the way carries its nest (`nest`: an index into
 *  `nestTrees(route)`) and the look of it, and at which of the way's two dining spots its
 *  gnawed cones lie (`kegels`) and how they lie. */
export interface EekhoornPlay { route: RouteId; veld: FieldSym; veldSeed: number; buren: Trio; nest: number; nestSeed: number; kegels: DiningId; kegelSeed: number }

/** The history's key for this mission's variant (the play notes it as `ek`). */
export const VARIANT_KEY = 'ek';
const ROUTE_LETTER: Record<RouteId, string> = { midden: 'm', noord: 'n', zuid: 'z' };
const SYM_LETTER: Record<FieldSym, string> = { recht: 'r', 'spiegel-u': 'u', 'spiegel-v': 'v', om: 'o' };

/** The variant as the history keeps it: way, pattern, trio ('n-u-kgr'). */
export function variantOf(p: Pick<EekhoornPlay, 'route' | 'veld' | 'buren'>): string {
  return `${ROUTE_LETTER[p.route]}-${SYM_LETTER[p.veld]}-${trioCode(p.buren)}`;
}
export function parseVariant(v: string): Pick<EekhoornPlay, 'route' | 'veld' | 'buren'> | null {
  const m = /^([mnz])-([ruvo])-([a-z]{3})$/.exec(v);
  if (!m) return null;
  const route = ROUTE_IDS.find((r) => ROUTE_LETTER[r] === m[1])!;
  const veld = FIELD_SYMS.find((s) => SYM_LETTER[s] === m[2])!;
  const buren = trioOf(m[3]);
  return buren ? { route, veld, buren } : null;
}

type Drawn = Pick<EekhoornPlay, 'route' | 'veld' | 'buren'>;

/** The squirrel's game's last plays' variants, newest first (at most `n`), from the save's
 *  beat history (each play logs it with every beat as `ek:<variant>`; a play's two beats
 *  are one play). Empty for a fresh save. */
export function lastVariants(history: readonly { m: string; sd?: number; va?: string }[], n = 2, missionId = 'eekhoorn'): Drawn[] {
  const out: Drawn[] = [];
  let lastSeed: number | undefined;
  for (let i = history.length - 1; i >= 0 && out.length < n; i--) {
    const b = history[i];
    if (b.m !== missionId || !b.va) continue;
    const pair = b.va.split(',').find((p) => p.startsWith(`${VARIANT_KEY}:`));
    const v = pair ? parseVariant(pair.slice(VARIANT_KEY.length + 1)) : null;
    if (!v || (b.sd !== undefined && b.sd === lastSeed)) continue;
    lastSeed = b.sd;
    out.push(v);
  }
  return out;
}
/** The newest of them, or null. */
export function lastVariant(history: readonly { m: string; sd?: number; va?: string }[], missionId = 'eekhoorn'): Drawn | null {
  return lastVariants(history, 1, missionId)[0] ?? null;
}

/** A draw that is none of `recent` (the newest first), as far as the list allows: never
 *  the last one, and none of the ones before it when there are enough. */
function freshPick<T>(rng: { pick<U>(l: readonly U[]): U }, list: readonly T[], recent: readonly T[], same = (a: T, b: T): boolean => a === b): T {
  for (let k = recent.length; k >= 0; k--) {
    const fresh = list.filter((x) => !recent.slice(0, k).some((r) => same(x, r)));
    if (fresh.length) return rng.pick(fresh);
  }
  return rng.pick(list);
}

/** This play's draw (pure, from the play's own forks, design §6.1): another way and
 *  pattern than the last two plays' (three plays in a row: the three ways), a trio that
 *  came in neither of the last two, with at least two neighbours another than last time
 *  where the trios allow it. `recent`: the last plays' variants, newest first. */
export function drawEekhoornPlay(play: { fork(label: string): { pick<T>(l: readonly T[]): T; int(a: number, b: number): number } },
  recent: readonly Drawn[] | Drawn | null): EekhoornPlay {
  const lasts: readonly Drawn[] = recent === null ? [] : Array.isArray(recent) ? recent : [recent as Drawn];
  const route = freshPick(play.fork('route'), ROUTE_IDS, lasts.map((l) => l.route));
  const veldFork = play.fork('veld');
  const veld = freshPick(veldFork, FIELD_SYMS, lasts.map((l) => l.veld));
  const veldSeed = veldFork.int(1, 9999);
  const same = (a: Trio, b: Trio): boolean => SLOTS.every((s) => a[s] === b[s]);
  const differ = (a: Trio, b: Trio): number => SLOTS.filter((s) => a[s] !== b[s]).length;
  const all = legalTrios();
  const wide = lasts.length ? all.filter((t) => differ(t, lasts[0].buren) >= 2) : all;
  const buren = freshPick(play.fork('buren'), wide.length ? wide : all, lasts.map((l) => l.buren), same);
  // (its finds: each from a fork of its own, so they never move a draw above)
  const nestFork = play.fork('nest');
  const nest = nestFork.int(0, nestTrees(ROUTES[route]).length - 1);
  const nestSeed = nestFork.int(1, 9999);
  const kegelFork = play.fork('kegels');
  const kegels = ROUTE_DINING[route][kegelFork.int(0, 1)];
  const kegelSeed = kegelFork.int(1, 9999);
  return { route, veld, veldSeed, buren, nest, nestSeed, kegels, kegelSeed };
}

/* --------------------------------------------------------------- the home ---- */

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

/** The trees it hides round (one per way). */
export const HIDE_TREES: readonly HomeTree[] = ROUTE_IDS.map((id) => ROUTES[id].hide);

/**
 * The one scattered pine the squirrel's wood takes out (run 7, the triangle budget): the
 * small bos pine 4 m east of its den, between the den and the zuid way's first pine.
 * Turning round at the marker, at the noord way's first watch and at pine A, the lens
 * looks back over the whole world toward the tower (~0.95M triangles before this home
 * adds a pine), and this pine stood within 6 m of the lens in each of those turns, in
 * full detail (12k); at the zuid way's first watch the lens stood inside it. The wood
 * round the other homes stays (the birch by the vos and the watchtower's grove pine).
 */
export const SCATTER_TAKEN: Spot = { x: 29.75, z: -47.72 };

/** Ground the forest's own scattered trees keep clear of: the glade, and room round each
 *  home tree (so no stray pine stands in the squirrel's way or in a framed view). */
export function eekhoornTreeClear(): { x: number; z: number; r: number }[] {
  return [
    { ...g(0, 0.8), r: 7 },
    // behind the stands, where the lens holds its views
    { ...g(0.6, -6), r: 4.2 },
    ...HOME_TREES.map((t) => ({ x: t.x, z: t.z, r: 3.2 })),
    // round each hide tree, where he walks round it (hide-and-seek), a wider ring
    ...HIDE_TREES.map((t) => ({ x: t.x, z: t.z, r: 4.6 })),
    { ...SCATTER_TAKEN, r: 0.6 },
    // its dining stumps and logs: no stray pine on them
    ...DINING.map((d) => ({ x: d.x, z: d.z, r: 1.6 })),
  ];
}

/** Ground the low plants (the bracken of the bos) keep bare: the caching spots and the
 *  stump (a fern through a mossy spot reads wrong). Every mirror-image's spots: the
 *  plants are laid once, with the world. */
export function eekhoornClearings(): { x: number; z: number; r: number }[] {
  return [
    ...FIELD_SYMS.flatMap((s) => gladeSpots(s)).map((s) => ({ x: s.x, z: s.z, r: 0.7 })),
    { x: STUMP.x, z: STUMP.z, r: 0.9 },
    // round each hide tree, where it plays hide-and-seek: no fern to hide it when it pops out
    ...HIDE_TREES.map((t) => ({ x: t.x, z: t.z, r: 4.2 })),
    // round each pine of its ways and where he stands to see it waiting: open needle litter,
    // no fern in front of a squirrel on a low stub (each fern also costs the picture ~8k
    // triangles, which the view over this wood cannot spare: measured 2026-10-03)
    ...[...new Set(ROUTE_IDS.flatMap((id) => ROUTES[id].hops.map((h) => h.tree)))].map((t) => ({ x: t.x, z: t.z, r: 2.6 })),
    ...[...new Set(ROUTE_IDS.flatMap((id) => ROUTES[id].waits))].map((t) => ({ ...watchSpot(t), r: 1.6 })),
    // the marker ring stays open (the child stands in it, looking at the squirrel's pine)
    { x: MARKER.x, z: MARKER.z, r: 1.8 },
    // the neighbours' corner: no fern in front of or behind the jay and the raven
    { x: JAY_GROUND.x, z: JAY_GROUND.z, r: 1.0 },
    ...JAY_RETREAT.map((p) => ({ x: p.x, z: p.z, r: 0.6 })),
    { x: SNAG.x, z: SNAG.z, r: 1.3 },
    { x: SEEDLING_AT.x, z: SEEDLING_AT.z, r: 0.8 },
    // its dining stumps and logs: open needle litter round them, no fern over the cones
    ...DINING.map((d) => ({ x: d.x, z: d.z, r: d.kind === 'stam' ? STAM.len * 0.5 + 0.5 : 1.1 })),
    { ...g(0.1, 3.1), r: 1.6 },
  ];
}
