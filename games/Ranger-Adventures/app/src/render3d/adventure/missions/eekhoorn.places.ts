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
import { ANTIC_KINDS, barkRadius, dashPath, trunkFadeUpright, trunkOutline, type AnticKind } from '../squirrel-math.ts';
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

/** Run 7 (ek-day, design §6.8): the pine of each way it hides round a SECOND time on some
 *  plays ("Nog een keer!"), close to its first hide tree. The old line's hide pine and the
 *  left way's stand 4.2 m apart, each the other's; the right way's is a pine of its own
 *  4.7 m south-west of its hide pine, toward the glade (open forest floor: no other tree of
 *  the wood there, `__ranger.treeSpots()` 2026-10-04). Each in its own open ring, as a hide
 *  tree (the places test plays hide-and-seek round it from where the first one is found). */
const Z5 = { id: 'z5', x: 20.3, z: -61.3, h: 13.6, rotY: 4.4 } as const;

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
  // run 7 (ek-day): the right way's second hide pine (its stub where it lands from the
  // hide pine before, as on a pine it passes)
  const z4 = out.find((t) => t.id === 'z4')!;
  out.push({ ...Z5, species: 'prop-pine-scots', branch: { ang: headingTo(Z5, z4) + 0.2, h: 1.55, out: 0.26 } });
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

/** Run 7 (ek-day, the ending `begraaf`): where it buries one last acorn by its stump and
 *  pats it down — beside the stump on the side away from its store and the jay's way, in
 *  the callers' picture, a little further from the lens than the stump (it runs there
 *  across the picture, never toward the lens), off every caching spot (the places test). */
export const BURY_AT: Spot = g(-2.0, 0.75);

/**
 * Run 7 (ek-day, the surprise `gaai`): where the jay buries an acorn of its own on a play
 * with that surprise — on the needles at the glade's edge, ahead of him and beside his
 * way as he walks from the pine he found the squirrel round to the glade (3.5-8.5 m on,
 * within 45° of his way there and 1.1-3 m off his straight line: he walks up past it, near
 * enough that it acts — from the second hide pine too, but for the south way's, which stands
 * too near the glade for it: `drawDay` gives that play another surprise), off the caching
 * spots, the store and the
 * trunks (the places test, from wherever he may have found it). It waits there from the
 * briefing (a jay foraging on the ground), and when he comes it pushes its acorn into the
 * needles, looks at him and flies up to the glade oak — where it waits for the store.
 */
export const JAY_CACHE: Readonly<Record<RouteId, Spot>> = {
  midden: { x: 15.0, z: -56.75 }, noord: { x: 15.0, z: -56.75 }, zuid: { x: 16.25, z: -59.25 },
};
/** It acts only while its flight up to the glade oak goes off across his picture or away
 *  from him, never back at him: the flight's heading within `fly` rad of his way to it. */
export const JAY_FLY = (100 * Math.PI) / 180;
/**
 * When the jay buries its acorn (review r1: it acted 12-25 px tall, with the squirrel
 * running through the same picture or sitting by its fern, so 'De gaai verstopt ook
 * nootjes!' named something he could not find): only while it stands at least `px` tall in
 * his picture (its `h` m: about 8 m from the lens, 3-3.5 m ahead of him) and inside the
 * picture's middle `mid` (−mid…mid across, and the middle share of its height), off his own
 * body (`body` across), mostly clear of the trunks, he still `close` m from it or more and
 * its flight up away from him (jayFliesAway); and only while the squirrel is on its stump or
 * clearly elsewhere (not in the lower half of his picture, `apart` m from the jay at least).
 * Not in the first `after` s of his walk. If that never comes on his walk, it flies up
 * without a word, as when he comes on it from the side (within `close` m).
 */
export const JAY_SEE = { h: 0.3, px: 28, mid: 0.7, body: 0.1, close: 2.5, apart: 3.0, after: 1.2 } as const;
export function jayFliesAway(me: Spot, at: Spot = JAY_CACHE.midden): boolean {
  return Math.abs(wrapA(headingTo(at, JAY_WAIT) - headingTo(me, at))) < JAY_FLY;
}

/**
 * Run 7 (ek-day, the surprise `denappel`): where a pine cone from the crown of the pine he
 * walks up to (where the squirrel waits for him) lands — in front of its trunk on his side,
 * `r` m out from it and turned `turn` rad off his line to it (the first that fits: beside
 * his way, never on it — `beside` m off it at least — never on a trunk's root spurs
 * `clear`, nor a dining spot), while he is `from` m off the pine; else null. Walking up to
 * the squirrel he looks there: it falls in the middle of his picture (played 2026-10-04: a
 * cone dropped beside his own path, from a pine he passed under, fell at the picture's edge
 * or behind him as he walked on and turned, a speck nobody saw).
 */
export const CONE_DROP = { r: [1.5, 1.9], turn: [0.75, 1.0], from: [4.0, 7.5], beside: 0.9, clear: 1.25 } as const;
export function coneDrop(me: Spot, t: HomeTree): Spot | null {
  const d = dist(me, t);
  if (d < CONE_DROP.from[0] || d > CONE_DROP.from[1]) return null;
  const toMe = headingTo(t, me);
  for (const r of CONE_DROP.r) for (const a of CONE_DROP.turn) for (const s of [1, -1]) {
    const p = { x: t.x + Math.sin(toMe + s * a) * r, z: t.z + Math.cos(toMe + s * a) * r };
    if (HOME_TREES.some((o) => dist(o, p) < CONE_DROP.clear) || segDist(p, me, t) < CONE_DROP.beside) continue;
    if (DINING.some((q) => dist(q, p) < 1.0)) continue;
    return p;
  }
  return null;
}

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
export function introView(me: Spot, toward: Spot = ROUTES.midden.waits[0], tall = 1.85, at: Spot = STUB_AT): {
  at: Spot; heading: number; halfW: number; halfD: number; tall: number; pitchDeg: number; insetTop: number; insetBottom: number;
} {
  const toStub = headingTo(me, STUB_AT);
  // the follow camera will stand behind him, looking where the squirrel runs
  const on = headingTo(me, toward);
  const follow = { x: me.x - Math.sin(on) * 4, z: me.z - Math.cos(on) * 4 };
  const lensOf = (h: number): Spot => ({ x: STUB_AT.x - Math.sin(h) * INTRO_D, z: STUB_AT.z - Math.cos(h) * INTRO_D });
  const a = toStub + INTRO_OFF, b = toStub - INTRO_OFF;
  const heading = Math.hypot(lensOf(a).x - follow.x, lensOf(a).z - follow.z) < Math.hypot(lensOf(b).x - follow.x, lensOf(b).z - follow.z) ? a : b;
  return { at, heading, halfW: 0.55, halfD: 0.3, tall, pitchDeg: 8, insetTop: 104, insetBottom: 60 };
}

/**
 * Run 7 (ek-day, design §6.8): where it is in the den look, by this play's den. `omlaag`: head
 * down on the bark under its stub (its feet `downH` m up), turned `downTurn` rad from the
 * stub toward the lens — it hangs there looking out, its tail up the trunk. `voet`: sitting
 * on the needles at the pine's foot, out past its root spurs (`footOut` m beyond them), turned
 * `footTurn` rad round from the lens toward the stub's side — nibbling a pine cone. `lens`:
 * where the den look's lens stands. (`tak` and `spiraal` end on its stub, as it always sat.)
 */
export const DEN_DAY = { downH: 0.95, downTurn: 0.4, footTurn: 0.75, footOut: 0.2, footTall: 1.2 } as const;
export function denSpot(lens: Spot, me: Spot): { down: { ang: number; h: number }; foot: Spot; footFace: number } {
  const t = HOME_TREES[0], b = t.branch!;
  const tr = { x: t.x, z: t.z, H: t.h, species: t.species };
  const camAng = headingTo(t, lens);
  const toCam = Math.sign(wrapA(camAng - b.ang)) || 1;
  const down = { ang: b.ang + toCam * DEN_DAY.downTurn, h: DEN_DAY.downH };
  // (round from the lens on the side away from him: never at his feet)
  const r = Math.max(trunkOutline(tr, 0), barkRadius(tr, 0)) + DEN_DAY.footOut;
  const at = (a: number): Spot => ({ x: t.x + Math.sin(a) * r, z: t.z + Math.cos(a) * r });
  const [a1, a2] = [camAng + DEN_DAY.footTurn, camAng - DEN_DAY.footTurn];
  const foot = dist(at(a1), me) >= dist(at(a2), me) ? at(a1) : at(a2);
  return { down, foot, footFace: headingTo(foot, lens) };
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
    // (a trunk behind him never stands in his way: standing right by one — where the
    // squirrel's nest left him, played 2026-10-03 — the way off it is straight on, never a
    // step round it that he already stands on)
    if (along <= 0) continue;
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
/** How far back from the found view's middle its lens stands (m, level: the fit's nearest
 *  try, 3 m along a 4° pitch — measured on every found view, eekhoorn.places.test), and a
 *  little either side: a view for the young one keeps it whole from each. */
const FOUND_YOUNG_BACK = [2.8, 3.0, 3.3];
export function foundView(tree: HomeTree, sqAng: number, me: Spot, young = false): {
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
  // (a play with the rare young one: a view that holds it whole too, sitting up on the ground
  // past the root spurs — no pine of the home in front of it — wherever the lens fits back
  // along that heading; else the view all the same, and it comes out where it can)
  const youngFits = (h: number, a: Spot): boolean => FOUND_YOUNG_BACK.every((b) => youngPeek(tree, me, { x: a.x - Math.sin(h) * b, z: a.z - Math.cos(h) * b }, sqAng).whole);
  let heading = toSq - pref * FOUND.turns[0];
  let at = middle(FOUND.turns[0]);
  find: for (const want of young ? [true, false] : [false]) for (const turn of FOUND.turns) for (const side of [pref, -pref]) {
    const h = toSq - side * turn, a = middle(turn);
    if (clear(h, a) && (!want || youngFits(h, a))) { heading = h; at = a; break find; }
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

/**
 * Run 7 (ek-day, review r1): after a find — the first and the second, round every pine it
 * hides round, the young one's play too — the squirrel's way from the bark to its stump
 * plays in his picture, across it or away from the lens, never at it (played 2026-10-04:
 * he still faced the tree from the found view, so where he found it from the glade's side
 * the stump stood behind him, and the squirrel ran from the bark past him into the
 * picture's bottom corner, big, at the lens, in 3 of 3 plays with a second hide).
 *
 * So he turns first — the lens comes round behind him (kit `behind`: `back` m back) — to
 * the heading nearest his way to the glade from which: the squirrel on the bark is in the
 * picture (`half` rad either side of its middle), on the bark's side toward the lens
 * (`face`), not behind his body (`body`) nor another trunk; the stump stands at least
 * `front` m in front of the lens (its run never goes round behind the lens); and its whole
 * real way — down the bark (round to the side `sides` picks), off the bark, the dash to
 * where it pops up in front of him (`pops`: m ahead of him, rad off his heading, on the
 * stump's side first), and on to its stump as its dash plans it (round him and round the
 * lens: squirrel-math `dashPath`) — never comes nearer the lens than it has been by more
 * than `toward` m, never through a trunk's foot nor within `feet` m of his, and its first `runIn` m on from the pop
 * stay in the picture. The pop is in the picture too, off his body, off every trunk's foot.
 * Where no heading from where he stands does it, a few calm steps first (`steps` m, the way
 * back from the tree first). `ok`: one did.
 */
export const FOUND_RUN = {
  back: 4.6, half: (28 * Math.PI) / 180, body: (9 * Math.PI) / 180, face: (75 * Math.PI) / 180, toward: 0.25, front: 3.0, feet: 1.25,
  step: (2.5 * Math.PI) / 180, runIn: 2,
  pops: [[1.6, 0.7], [1.6, 0.9], [1.9, 0.6], [1.9, 0.8], [2.3, 0.5], [2.3, 0.7], [1.9, 1.0], [2.7, 0.45], [2.7, 0.65]] as readonly (readonly [number, number])[],
  sides: [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9],
  steps: [0.6, 1.0, 1.4, 1.8],
} as const;
/** The picture's whole half-width (rad) through the 55° follow lens at 1280×800 (a little in
 *  from its edge). */
const FOLLOW_HALF = Math.atan(Math.tan((55 / 2) * Math.PI / 180) * 1.6 * 0.9);
/** Where it clings on the bark once found (its found face, `HIDE.h` up). */
export function barkSpot(tree: HomeTree, ang: number): Spot {
  const r = barkRadius({ x: tree.x, z: tree.z, H: tree.h, species: tree.species }, HIDE.h) + 0.08;
  return { x: tree.x + Math.sin(ang) * r, z: tree.z + Math.cos(ang) * r };
}
/** The squirrel's real way after a find, over the ground (x/z): from the bark at `sqAng`
 *  round and down to `side`, off the bark, its dash to `pop`, and its dash on to its stump's
 *  foot — each dash as squirrel-math plans it (round `me`, round `lens`). `pop`: the index
 *  of the pop in `pts`; `foot`: of the spot it comes off the bark. */
export function foundRunPath(me: Spot, tree: HomeTree, sqAng: number, side: number, pop: Spot, lens: Spot): { pts: Spot[]; foot: number; pop: number } {
  const tr = { x: tree.x, z: tree.z, H: tree.h, species: tree.species };
  const pts: Spot[] = [barkSpot(tree, sqAng)];
  const da = wrapA(side - sqAng);
  const n = Math.max(1, Math.ceil(Math.abs(da) / 0.15));
  for (let i = 1; i <= n; i++) {
    const a = sqAng + (da * i) / n, r = barkRadius(tr, HIDE.h + ((0.25 - HIDE.h) * i) / n) + 0.08;
    pts.push({ x: tree.x + Math.sin(a) * r, z: tree.z + Math.cos(a) * r });
  }
  const r0 = barkRadius(tr, 0) + 0.35; // (squirrel-math dismountPlan)
  pts.push({ x: tree.x + Math.sin(side) * r0, z: tree.z + Math.cos(side) * r0 });
  const foot = pts.length - 1;
  const avoid = { x: me.x, z: me.z, r: 1.6 }; // (squirrel.ts: a dash goes round him)
  const toPop = dashPath(pts[foot], pop.x, pop.z, lens, avoid);
  pts.push(...toPop.slice(1));
  const at = pts.length - 1;
  const d = dist(pop, STUMP) || 1;
  const sf = { x: STUMP.x + ((pop.x - STUMP.x) / d) * (STUMP.r + 0.3), z: STUMP.z + ((pop.z - STUMP.z) / d) * (STUMP.r + 0.3) }; // (squirrel.ts toStumpPlan)
  pts.push(...dashPath(pop, sf.x, sf.z, lens, avoid).slice(1));
  return { pts, foot, pop: at };
}
/** Points every `step` m along a way. */
function along(pts: readonly Spot[], step = 0.1): Spot[] {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(dist(a, b) / step));
    for (let k = 1; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n });
  }
  return out;
}
/** The follow lens behind him facing `h` (x/z). */
export function lensBehind(me: Spot, h: number, back: number = FOUND_RUN.back): Spot {
  return { x: me.x - Math.sin(h) * back, z: me.z - Math.cos(h) * back };
}
/** From `me` facing `h`: where it pops up and the side it comes down, when its run plays in
 *  his picture (FOUND_RUN); else null. */
function foundRunAt(me: Spot, tree: HomeTree, sqAng: number, h: number): { pop: Spot; side: number } | null {
  const lens = lensBehind(me, h);
  const off = (q: Spot): number => Math.abs(wrapA(headingTo(lens, q) - h));
  const rOf = (t: HomeTree): number => barkRadius({ x: t.x, z: t.z, H: t.h, species: t.species }, 1) + 0.3;
  const footOf = (t: HomeTree): number => trunkOutline({ x: t.x, z: t.z, H: t.h, species: t.species }, 0.15) + 0.05;
  const sq = barkSpot(tree, sqAng);
  // (the lens clear of every trunk, its own pine not between the lens and him, the stump in
  // front of the lens, the squirrel's side of the bark toward the lens, in the picture, not
  // behind his body nor another trunk)
  if (HOME_TREES.some((t) => dist(t, lens) < rOf(t) + 0.7) || segDist(tree, lens, me) < rOf(tree) + 0.2) return null;
  if ((STUMP.x - lens.x) * Math.sin(h) + (STUMP.z - lens.z) * Math.cos(h) < FOUND_RUN.front) return null;
  if (Math.abs(wrapA(headingTo(tree, lens) - sqAng)) > FOUND_RUN.face || off(sq) > FOUND_RUN.half) return null;
  if (off(sq) < FOUND_RUN.body && dist(lens, sq) > dist(lens, me) - 0.3) return null;
  if (HOME_TREES.some((t) => t !== tree && segDist(t, lens, sq) < rOf(t))) return null;
  const toStump = Math.sign(wrapA(headingTo(me, STUMP) - h)) || 1;
  for (const [d, turn] of FOUND_RUN.pops) for (const s of [toStump, -toStump]) {
    const pop = { x: me.x + Math.sin(h + s * turn) * d, z: me.z + Math.cos(h + s * turn) * d };
    if (HOME_TREES.some((t) => dist(t, pop) < footOf(t) + 0.35) || off(pop) > FOUND_RUN.half) continue;
    if (off(pop) < FOUND_RUN.body && dist(lens, pop) > dist(lens, me) - 0.3) continue;
    for (const k of FOUND_RUN.sides) {
      const side = sqAng + k;
      if (Math.abs(wrapA(headingTo(tree, lens) - side)) > FOUND_RUN.face) continue;
      const way = foundRunPath(me, tree, sqAng, side, pop, lens);
      let far = -Infinity, bad = false;
      for (const q of along(way.pts)) {
        const dq = dist(lens, q);
        if (dq < far - FOUND_RUN.toward) { bad = true; break; }
        far = Math.max(far, dq);
      }
      if (bad) continue;
      // (over the ground: never through a trunk's foot — its own pine's only once it is off it
      // — nor over his feet)
      const dash = along(way.pts.slice(way.foot));
      if (dash.some((q) => dist(q, me) < FOUND_RUN.feet || HOME_TREES.some((t) => (t !== tree || dist(q, tree) > 1.2) && dist(t, q) < footOf(t)))) continue;
      // (its first `runIn` m on from the pop in the picture: it runs off where he sees it)
      let run = 0, prev = pop;
      if (along(way.pts.slice(way.pop)).some((q) => { run += dist(prev, q); prev = q; return run <= FOUND_RUN.runIn && off(q) > FOLLOW_HALF; })) continue;
      return { pop, side };
    }
  }
  return null;
}
/** After a find (`sqAng`: its found face on `tree`'s bark, `me`: where he stands): where he
 *  turns to (and, where he must, a few calm steps first) so that its run to its stump plays
 *  in his picture (FOUND_RUN). */
export function foundRun(me: Spot, sqAng: number, tree: HomeTree): { at: Spot; face: number; pop: Spot; side: number; ok: boolean } {
  const turnFrom = (at: Spot): { face: number; pop: Spot; side: number } | null => {
    const want = headingTo(at, wayTo(at, STAND));
    for (let a = 0; a <= Math.PI + 1e-9; a += FOUND_RUN.step) {
      for (const s of a === 0 ? [1] : [1, -1]) {
        const r = foundRunAt(at, tree, sqAng, want + s * a);
        if (r) return { face: wrapA(want + s * a), ...r };
      }
    }
    return null;
  };
  const here = turnFrom(me);
  if (here) return { at: me, ...here, ok: true };
  const back = headingTo(tree, me);
  const ways = Array.from({ length: 16 }, (_, i) => back + ((i % 2 ? 1 : -1) * Math.ceil(i / 2) * Math.PI) / 8);
  for (const r of FOUND_RUN.steps) for (const a of ways) {
    const at = { x: me.x + Math.sin(a) * r, z: me.z + Math.cos(a) * r };
    if (HOME_TREES.some((t) => dist(t, at) < trunkClear(t) || segDist(t, me, at) < trunkClear(t) - 0.15)) continue;
    const t = turnFrom(at);
    if (t) return { at, ...t, ok: true };
  }
  // (none: as before — toward the glade, it pops up ahead of him)
  const face = headingTo(me, wayTo(me, STAND));
  return { at: me, face, pop: { x: me.x + Math.sin(face + 0.6) * 1.9, z: me.z + Math.cos(face + 0.6) * 1.9 }, side: sqAng, ok: false };
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
/**
 * Where he stands to see its nest while it waits in it (the walk hint's end then; design
 * §6.7): out from the nest on its own side of the trunk, one of `d` m off, turned one of
 * `turns` toward where he comes from — the first that keeps every pine clear of him and of
 * the line from the follow lens to the nest. The hint's last step: from within `r` m of
 * the spot he walks at a point `aside` m beside the nest (to its left as he sees it: the
 * nest stands right of the middle, clear of the chips' corner), about `step` m on — he turns to it, the follow lens comes round
 * behind him, and the nest stands off the middle of his picture (a find, never dead
 * centre); seen on his way there, he stands where he saw it. From the spot and from wherever that step leaves him the nest stands at least
 * NEST_SEE.px + a margin tall in his picture, under the line card, no trunk and not his
 * head in front of it — also `carry` m further on, where a walk's own run may carry him
 * (seed 2: a step of 1 m carried him 0.75 m on, 1.3 m from the nest, and it stood over his
 * head) — for every nest tree of every way (eekhoorn.places.test). `under`: nearer the
 * nest than this he is under it (m).
 * Played 2026-10-04 (seeds 3, 45, a zuid play): the hint walked him on past the nest to its
 * foot, or away to the stub's watch spot while the line played, and the moment was lost.
 */
export const NEST_WATCH = { d: [3.5, 3.2, 3.8, 2.9], turns: [0.25, 0, -0.25, 0.5, -0.5, 0.75, -0.75, 1.0, 1.25, -1.0], r: 0.5, aside: 1.0, step: 0.8, carry: 0.8, under: 1.8 } as const;
/** He has SEEN the nest (its moment: it peeks out, "Kijk, zijn nest!", and into his
 *  veldgids): within `near` m of it, in a steady picture (the lens turning at most `turn`
 *  rad/s: played 2026-10-04, seed 2, seen as the follow lens swung round behind him on a
 *  turn, it swung on and the nest was gone by the time its card came), at least `px` tall
 *  in his picture (its box, as eekhoorn.home pictureOf measures it), its middle within `x`
 *  of the half-width from the picture's middle (well in it, not at its edge: seed 3, it peeked out
 *  at the very right edge while he walked past), under the line card and out of the top
 *  left corner where the chips and a reveal card sit (`hud`: px at 1280×800; seed 2, it
 *  peeked out behind "De kale dennenappels"), mostly clear of the trunks and his head — for
 *  `secs` in a row (SeenClock). The runtime and the places test read this one row. */
export const NEST_SEE = { px: 44, x: 0.7, hud: { w: 400, h: 250 }, turn: 0.35, secs: 0.5, near: 5.5 } as const;
/** The point the hint's last step walks at: `aside` m beside the nest, to its LEFT as he
 *  sees it from `w` — he looks a little left of it, so the nest stands right of the
 *  middle of his picture, away from the top left corner where the chips and a reveal card
 *  sit (played 2026-10-04, seed 45: beside it toward its stub, the nest stood at the chips'
 *  corner and never counted as seen). (A heading turned up is to his left: three.js.) */
export function nestAim(n: Spot, w: Spot): Spot {
  const a = headingTo(w, n) + Math.PI / 2;
  return { x: n.x + Math.sin(a) * NEST_WATCH.aside, z: n.z + Math.cos(a) * NEST_WATCH.aside };
}
/** Where the hint's last step leaves him, from `from` (within NEST_WATCH.r of the spot):
 *  walking at `aim`, `stop` m short of it (or where he is, nearer than that already). */
export function nestStep(aim: Spot, from: Spot, stop: number): Spot {
  const d = dist(from, aim);
  if (d <= stop) return { x: from.x, z: from.z };
  const f = stop / d;
  return { x: aim.x + (from.x - aim.x) * f, z: aim.z + (from.z - aim.z) * f };
}
export function nestWatch(route: Route, i: number): Spot & { heading: number; aim: Spot; stop: number } {
  const n = nestOf(route, i);
  const from = comesFrom(route, i);
  // (toward where he comes from: the nest's side turned that way)
  const toFrom = Math.sign(wrapA(headingTo(n, from) - n.ang)) || 1;
  const spotAt = (d: number, turn: number): Spot => {
    const a = n.ang + toFrom * turn;
    return { x: n.x + Math.sin(a) * d, z: n.z + Math.cos(a) * d };
  };
  // (clear: he stands clear of every pine there and wherever the last step leaves him, and
  // there the follow lens 4.6 m behind him looks at the nest past his shoulder with no pine
  // between — a trunk the camera fades, between the lens and him, hides nothing:
  // world/CameraRig)
  const clear = (w: Spot): boolean => {
    const aim = nestAim(n, w);
    const stop = dist(w, aim) - NEST_WATCH.step;
    const stands: Spot[] = [w];
    for (let k = 0; k < 12; k++) for (const rr of [NEST_WATCH.r * 0.5, NEST_WATCH.r]) for (const on of [0, NEST_WATCH.carry]) {
      stands.push(nestStep(aim, { x: w.x + Math.sin((k * Math.PI) / 6) * rr, z: w.z + Math.cos((k * Math.PI) / 6) * rr }, stop - on));
    }
    return stands.every((st) => dist(st, n) > NEST_WATCH.under + 0.2 && HOME_TREES.every((o) => {
      if (dist(o, st) <= trunkClear(o)) return false;
      if (o === n.tree) return true;
      const ot = { x: o.x, z: o.z, H: o.h, species: o.species };
      const back = headingTo(aim, st);
      const lens = { x: st.x + Math.sin(back) * 4.6, z: st.z + Math.cos(back) * 4.6 };
      if (segDist(o, lens, st) < trunkFadeUpright(ot, 0).r(1.0)) return true; // (faded)
      return segDist(o, lens, n) > trunkOutline(ot, 1.5) + 0.35;
    }));
  };
  const at = (w: Spot): Spot & { heading: number; aim: Spot; stop: number } => {
    const aim = nestAim(n, w);
    return { ...w, heading: headingTo(w, aim), aim, stop: dist(w, aim) - NEST_WATCH.step };
  };
  for (const d of NEST_WATCH.d) for (const t of NEST_WATCH.turns) {
    const w = spotAt(d, t);
    if (clear(w)) return at(w);
  }
  return at(spotAt(NEST_WATCH.d[0], NEST_WATCH.turns[0]));
}
/** How solid the nest stands (1) or how far it fades (0), as the follow lens trailing him
 *  sees it: like a home tree's crown, it never fills the lens nor stands between the lens
 *  and him — the lens passes within `NEST_FADE.near` m of it on some ways (it hangs at the
 *  lens's height: nearer, it would loom over 150 px of his picture), or it is on the line
 *  from the lens to his head. `lens`, `nest`: world x/y/z; `me`: his feet. */
export const NEST_FADE = { near: 2.8, line: 0.5 } as const;
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
 * cones a ranger learns to read). Each way passes two of its own; a play lays its cones at one of
 * them (`kegels`). Chosen by walking each way as golden does (eekhoorn.places.test): dry,
 * in the wood, off every way's line (he walks past, never into it), out of the hide
 * trees' rings and the glade, and seen for a while as he walks or waits.
 */
export type DiningId = 'z1-oost' | 'z1-a' | 'z2-west' | 'z3-zuid' | 'n1-noord' | 'n4-noord';
export interface DiningSpot extends Spot { id: DiningId; kind: 'stronk' | 'stam'; turn: number }
export const DINING: readonly DiningSpot[] = [
  // behind the first pine of the middle and the right way: seen while he waits for it there
  { id: 'z1-oost', x: 27.5, z: -48.6, kind: 'stronk', turn: 0.4 },
  // between that pine and the old line's first pine (the middle way and the right way pass it)
  { id: 'z1-a', x: 22.95, z: -47.85, kind: 'stam', turn: 1.9 },
  // west of the right way's second pine, on the way down to its hide tree
  { id: 'z2-west', x: 20.75, z: -51.0, kind: 'stronk', turn: 2.6 },
  // past the right way's hide tree, on his walk down to the glade
  { id: 'z3-zuid', x: 23.75, z: -53.25, kind: 'stronk', turn: 1.2 },
  // on the left way, past its first pine toward the old line's middle pine
  { id: 'n1-noord', x: 19.25, z: -43.3, kind: 'stam', turn: 0.3 },
  // on the left way, before its hide tree
  { id: 'n4-noord', x: 13.3, z: -46.1, kind: 'stronk', turn: 5.1 },
];
/** The two dining spots each way passes — no way shares one with another, so the gnawed
 *  cones lie somewhere new every play (the way is never the last two plays'). */
export const ROUTE_DINING: Readonly<Record<RouteId, readonly [DiningId, DiningId]>> = {
  midden: ['z1-oost', 'z1-a'],
  noord: ['n1-noord', 'n4-noord'],
  zuid: ['z2-west', 'z3-zuid'],
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
 * trunk from the found view's lens (`start`, low), comes round the bark head first to the
 * trunk's outline (`edge`: a little head peeks round the wood), runs down and out onto the
 * ground and sits up there facing him (`sit`): on the side of the trunk away from him in the
 * picture, so the three of them read left to right — him, ours on the bark, the little one
 * on the ground. Sitting up is a squirrel's own shape (played 2026-10-03: clinging to the
 * bark beside ours a small one showed its back like ours).
 * It sits OUT PAST THE ROOT SPURS by its own length (`len`): the pine's root flare reaches
 * `trunkOutline(tree, 0)` from the axis (≈ 1.2 m), and played 2026-10-04 (seed 45) a sit
 * spot 1.0 m out put it inside a spur — ~25 px of fragments while "Gevonden! En nog een
 * kleintje!" was said. Its turn round the trunk from the lens is the first of `sitAngs` that
 * keeps it whole in the picture: no other pine (out to its root spurs) and not him between
 * the lens and it, a little nearer the lens than ours on the bark (`ours`: its angle round
 * the trunk) — the found view holds ours ≥ 60 px, so the little one (0.7 of it) reads ≥ 40 —
 * and from the trunk's edge out to it at most `toLens` m nearer the lens (it runs out across
 * the picture, never at it). Where another pine stands in front of all of those (the middle way's hide tree, found
 * from its neighbour's side: the found view's lens stands just past that pine), it comes out
 * round HIS side of the trunk instead, past him in the picture (`side` −1: him between ours
 * and the little one). Once he has seen it, it runs up its side of the trunk (`climb`) and on
 * round the back and up, out of the picture (`up`). `me`: where he stands; `lens`: the found
 * view's lens.
 */
export const YOUNG = {
  scale: 0.7, startH: 0.55, edgeAng: 1.5, edgeH: 0.4, sitAngs: [1.0, 1.2, 0.8, 1.4], len: 0.3, toLens: 0.6, climbH: 1.0, upH: 6,
} as const;
export function youngPeek(tree: HomeTree, me: Spot, lens: Spot, ours: number): {
  start: { ang: number; h: number }; edge: { ang: number; h: number }; sit: Spot; climb: { ang: number; h: number }; up: { ang: number; h: number };
  /** 1: the far side of the trunk from him (as it should be), −1: his side, past him */
  side: 1 | -1;
  /** whether a spot was found that keeps it whole (else the first, all the same) */
  whole: boolean;
} {
  const camAng = headingTo(tree, lens);
  // (the far side of the trunk from him, round from the lens)
  const far = -(Math.sign(wrapA(headingTo(tree, me) - camAng)) || 1);
  const tr = { x: tree.x, z: tree.z, H: tree.h, species: tree.species };
  const r = Math.max(trunkOutline(tr, 0), barkRadius(tr, 0)) + YOUNG.len;
  const er = barkRadius(tr, YOUNG.edgeH) + 0.06;
  const at = (a: number, rr: number): Spot => ({ x: tree.x + Math.sin(a) * rr, z: tree.z + Math.cos(a) * rr });
  const oursD = dist(at(ours, barkRadius(tr, HIDE.h) + 0.08), lens);
  const whole = (s: number, turn: number): boolean => {
    const p = at(camAng + s * turn, r);
    if (dist(p, lens) > oursD - 0.1 || dist(p, me) <= 1.1 || segDist(me, lens, p) <= 0.45) return false;
    if (dist(at(camAng + s * YOUNG.edgeAng, er), lens) - dist(p, lens) > YOUNG.toLens) return false;
    return HOME_TREES.every((o) => {
      if (o === tree) return true;
      const ot = { x: o.x, z: o.z, H: o.h, species: o.species };
      const reach = Math.max(trunkOutline(ot, 0), barkRadius(ot, 0));
      return dist(o, p) > reach + YOUNG.len && segDist(o, lens, p) > reach + 0.25;
    });
  };
  let side: 1 | -1 = 1, turn: number = YOUNG.sitAngs[0], ok = false;
  pick: for (const sd of [1, -1] as const) for (const t of YOUNG.sitAngs) if (whole(far * sd, t)) { side = sd; turn = t; ok = true; break pick; }
  const s = far * side;
  const sitAng = camAng + s * turn;
  return {
    start: { ang: camAng + s * 2.5, h: YOUNG.startH },
    edge: { ang: camAng + s * YOUNG.edgeAng, h: YOUNG.edgeH },
    sit: at(sitAng, r),
    climb: { ang: sitAng, h: YOUNG.climbH },
    up: { ang: camAng + Math.PI, h: YOUNG.upH },
    side,
    whole: ok,
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
 *  gnawed cones lie (`kegels`) and how they lie; run 7 (ek-day, design §6.8): the
 *  squirrel's own day (`day`). */
export interface EekhoornPlay { route: RouteId; veld: FieldSym; veldSeed: number; buren: Trio; nest: number; nestSeed: number; kegels: DiningId; kegelSeed: number; day: Day }

/* ------------------------------------------------- the squirrel's day (ek-day) ---- */

/** How it is when he comes to the marker (design §6.8, `den`): on its stub (as it always
 *  was), hanging head down on the trunk under it, nibbling a pine cone at the pine's foot,
 *  or a spiral run up the trunk to its stub as he arrives. */
export type DenKind = 'tak' | 'omlaag' | 'voet' | 'spiraal';
export const DEN_KINDS: readonly DenKind[] = ['tak', 'omlaag', 'voet', 'spiraal'];
/** How the mission ends (`einde`): it eats an acorn on its stump (as it always did), it
 *  buries one last acorn by the stump and pats it down (a forgotten one: the seedling a
 *  later visit finds), or it grooms on its stump with its tail curled. */
export type Einde = 'eet' | 'begraaf' | 'poets';
export const EINDES: readonly Einde[] = ['eet', 'begraaf', 'poets'];
/** One small surprise on a walk (`verrassing`), or none: a pine cone drops beside his path,
 *  the jay buries an acorn of its own ahead of him, a drum roll from the glade (only when
 *  the great spotted woodpecker is today's neighbour on the bark). */
export type Verrassing = 'geen' | 'denappel' | 'gaai' | 'roffel';
export const SURPRISES: readonly Exclude<Verrassing, 'geen'>[] = ['denappel', 'gaai', 'roffel'];
/** What it does at each wait while he comes, none twice in a play (squirrel-math
 *  `anticPlan`); lying flat in the sun only in a sunny light. */
export type Antic = AnticKind;
export const ANTICS: readonly Antic[] = ANTIC_KINDS;
export const SUN_MOODS: readonly string[] = ['zonnig', 'gouden-uur'];
/** The squirrel's day: its den, an antic per wait (in order), the surprise, a second hide
 *  (round `SECOND_HIDE[route]`), the ending. */
export interface Day { den: DenKind; antics: readonly Antic[]; verrassing: Verrassing; verstop2: boolean; einde: Einde }
/** How often (design §6.8): a surprise in about 2 of 3 plays, a second hide in about 1 of 3
 *  — and never three plays in a row without one (the third has it). */
export const DAY_ODDS = { verrassing: 2 / 3, verstop2: 1 / 3 } as const;

/** The history's key for this mission's variant (the play notes it as `ek`). */
export const VARIANT_KEY = 'ek';
const ROUTE_LETTER: Record<RouteId, string> = { midden: 'm', noord: 'n', zuid: 'z' };
const SYM_LETTER: Record<FieldSym, string> = { recht: 'r', 'spiegel-u': 'u', 'spiegel-v': 'v', om: 'o' };
const DEN_LETTER: Record<DenKind, string> = { tak: 't', omlaag: 'o', voet: 'v', spiraal: 's' };
const EINDE_LETTER: Record<Einde, string> = { eet: 'e', begraaf: 'b', poets: 'p' };
const VERR_LETTER: Record<Verrassing, string> = { geen: 'x', denappel: 'd', gaai: 'g', roffel: 'r' };
const ANTIC_LETTER: Record<Antic, string> = { kijken: 'k', poetsen: 'p', knabbelen: 'n', zonnen: 'z', mopperen: 'm' };
const byLetter = <T extends string>(m: Record<T, string>, l: string): T => (Object.keys(m) as T[]).find((k) => m[k] === l)!;

/** The variant as the history keeps it: way, pattern, trio ('n-u-kgr'); run 7 (ek-day), with
 *  its day: the nest's tree, the den, the ending, the surprise, the second hide and the
 *  antic at each wait ('n-u-kgr-1obg2pkm'), so the next play's day is drawn against it.
 *  ≤ 16 characters: after the mood and a rare it still fits the history's 60 (the places
 *  test). */
export function variantOf(p: Pick<EekhoornPlay, 'route' | 'veld' | 'buren'> & Partial<Pick<EekhoornPlay, 'nest' | 'day'>>): string {
  const base = `${ROUTE_LETTER[p.route]}-${SYM_LETTER[p.veld]}-${trioCode(p.buren)}`;
  if (!p.day || p.nest === undefined) return base;
  const d = p.day;
  return `${base}-${p.nest}${DEN_LETTER[d.den]}${EINDE_LETTER[d.einde]}${VERR_LETTER[d.verrassing]}${d.verstop2 ? 2 : 1}${d.antics.map((a) => ANTIC_LETTER[a]).join('')}`;
}

/** A last play as the draw reads it: its way, pattern and trio, and (when the history kept
 *  it) the tree its nest was on (`nest`: its index in that way's nest trees) and its day's
 *  den, ending, surprise and second hide. */
export type Drawn = Pick<EekhoornPlay, 'route' | 'veld' | 'buren'> & Partial<Pick<EekhoornPlay, 'nest'>>
  & Partial<Pick<Day, 'den' | 'einde' | 'verrassing' | 'verstop2' | 'antics'>>;

export function parseVariant(v: string): Drawn | null {
  const m = /^([mnz])-([ruvo])-([a-z]{3})(?:-(\d)([tovs])([ebp])([xdgr])([12])([kpnzm]{0,3}))?$/.exec(v);
  if (!m) return null;
  const route = ROUTE_IDS.find((r) => ROUTE_LETTER[r] === m[1])!;
  const veld = FIELD_SYMS.find((s) => SYM_LETTER[s] === m[2])!;
  const buren = trioOf(m[3]);
  if (!buren) return null;
  if (m[4] === undefined) return { route, veld, buren };
  const day = { nest: Number(m[4]), den: byLetter(DEN_LETTER, m[5]), einde: byLetter(EINDE_LETTER, m[6]), verrassing: byLetter(VERR_LETTER, m[7]), verstop2: m[8] === '2' };
  // (its antics, kept since ek-day's review: a variant from before reads without them)
  return m[9] ? { route, veld, buren, ...day, antics: [...m[9]].map((l) => byLetter(ANTIC_LETTER, l)) } : { route, veld, buren, ...day };
}

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
    if (v.nest !== undefined) { out.push(v); continue; } // (ek-day: its day kept the nest)
    // (its nest's tree, noted after the variant: `nest:<tree id>`)
    const tree = b.va.split(',').find((p) => p.startsWith('nest:'))?.slice(5);
    const nest = tree ? nestTrees(ROUTES[v.route]).findIndex((t) => t.id === tree) : -1;
    out.push(nest >= 0 ? { ...v, nest } : v);
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

/** The forks a draw reads (a `Play`'s). */
type Forks = { fork(label: string): { pick<T>(l: readonly T[]): T; int(a: number, b: number): number; shuffle<T>(l: readonly T[]): T[]; chance(p: number): boolean } };

/**
 * The squirrel's day (pure, ek-day, design §6.8), each choice from a fork of its own: its
 * den (never one of the last two plays'; with the rare dark visitor at the den, one that
 * ends on its stub, where the visitor meets it), an antic per wait of the way (none twice,
 * none at the wait it held last play; lying in the sun only in `SUN_MOODS`), a surprise in about 2 of 3 plays (never the last
 * play's; the drum roll only with the great spotted woodpecker on the bark), a second
 * hide in about 1 of 3 (the third play surely, after two without), its ending (never one of
 * the last two plays': three plays, three endings).
 */
export function drawDay(play: Forks, o: { route: RouteId; buren: Trio; mood?: string; rare?: string | null; recent: readonly Drawn[] }): Day {
  const dens = o.rare === 'eekhoorn.donkere-eekhoorn' || o.rare === 'donkere-eekhoorn' ? DEN_KINDS.filter((d) => d === 'tak' || d === 'spiraal') : DEN_KINDS;
  const known = (k: 'den' | 'einde' | 'verrassing' | 'verstop2' | 'antics') => o.recent.filter((r) => r[k] !== undefined);
  const den = freshPick(play.fork('den'), dens, known('den').map((r) => r.den!));
  // (nibbling a cone at its den already: not again at a wait)
  const pool = ANTICS.filter((a) => (a !== 'zonnen' || SUN_MOODS.includes(o.mood ?? '')) && (a !== 'knabbelen' || den !== 'voet'));
  // (in a shuffled order, wait by wait: never the one that wait had last play — three plays in
  // a row, the third wait grooming every time, read alike — where the pool leaves another)
  const lastAntics = known('antics')[0]?.antics ?? [];
  const order = play.fork('antics').shuffle(pool);
  const antics: Antic[] = [];
  for (let w = 0; w < ROUTES[o.route].waits.length; w++) {
    const free = order.filter((a) => !antics.includes(a));
    antics.push(free.find((a) => a !== lastAntics[w]) ?? free[0]);
  }
  const twice = known('verstop2');
  const verstop2 = play.fork('verstop2').chance(DAY_ODDS.verstop2) || (twice.length >= 2 && !twice[0].verstop2 && !twice[1].verstop2);
  const vf = play.fork('verrassing');
  // (the jay's own cache waits on his way from the hide pine to the glade: not after the south
  // way's second hide, whose pine stands too near the glade — JAY_CACHE)
  const can = SURPRISES.filter((s) => (s !== 'roffel' || o.buren.stam === 'grote-bonte-specht') && (s !== 'gaai' || !(verstop2 && o.route === 'zuid')));
  const lastSurprise = known('verrassing')[0]?.verrassing;
  // (never the last play's: where today's way leaves none other, no surprise this play)
  const fresh = can.filter((x) => x !== lastSurprise);
  const verrassing: Verrassing = vf.chance(DAY_ODDS.verrassing) && fresh.length ? vf.pick(fresh) : 'geen';
  const einde = freshPick(play.fork('einde'), EINDES, known('einde').map((r) => r.einde!));
  return { den, antics, verrassing, verstop2, einde };
}

/** This play's draw (pure, from the play's own forks, design §6.1): another way and
 *  pattern than the last two plays' (three plays in a row: the three ways), a trio that
 *  came in neither of the last two, with at least two neighbours another than last time
 *  where the trios allow it; run 7 (ek-day): the squirrel's day (`drawDay`; `ctx`: the play's
 *  mood and rare, as the briefing drew them). `recent`: the last plays' variants, newest
 *  first. */
export function drawEekhoornPlay(play: Forks, recent: readonly Drawn[] | Drawn | null, ctx: { mood?: string; rare?: string | null } = {}): EekhoornPlay {
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
  const trees = nestTrees(ROUTES[route]);
  let nest = nestFork.int(0, trees.length - 1);
  // (never on the tree the last play's nest was on: two ways share their first pine)
  const last = lasts[0];
  const lastTree = last?.nest !== undefined ? nestTrees(ROUTES[last.route])[last.nest]?.id : undefined;
  if (trees[nest].id === lastTree && trees.length > 1) nest = (nest + 1) % trees.length;
  const nestSeed = nestFork.int(1, 9999);
  const kegelFork = play.fork('kegels');
  const kegels = ROUTE_DINING[route][kegelFork.int(0, 1)];
  const kegelSeed = kegelFork.int(1, 9999);
  const day = drawDay(play, { route, buren, mood: ctx.mood, rare: ctx.rare, recent: lasts });
  return { route, veld, veldSeed, buren, nest, nestSeed, kegels, kegelSeed, day };
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

/** Run 7 (ek-day): each way's second hide pine (see Z5 above). */
export const SECOND_HIDE: Readonly<Record<RouteId, HomeTree>> = {
  midden: ROUTES.noord.hide, noord: ROUTES.midden.hide, zuid: HOME_TREES.find((t) => t.id === Z5.id)!,
};
/** Every tree it may hide round (the hide trees and the second hide pines), each once. */
export const ALL_HIDE_TREES: readonly HomeTree[] = [...new Set([...HIDE_TREES, ...ROUTE_IDS.map((id) => SECOND_HIDE[id])])];

/**
 * Run 7 (ek-day): how he turns before the second hide, so the squirrel's dash to the second
 * pine plays in his picture (played 2026-10-04: with the found view's lens left where it
 * was, the second pine stood behind it and the squirrel ran at the lens). The lens comes
 * round behind him (kit `behind`: `back` m back, looking the way he faces); from there the
 * squirrel where it sits on the first pine (`sq`) and the second pine both stand in the
 * picture (`half` rad either side of its middle), neither behind a trunk, its way between
 * them over the ground at most a moment behind his body (`body` rad either side of him) or
 * a trunk's foot (`hid` of five bits, never as it reaches the pine), the second pine in
 * front of him and the first not far behind him nor near the lens, the lens clear of every trunk, and its run from the one to the other goes
 * across the picture or away from the lens (at most `toward` of it toward the lens). The
 * turn nearest his way to the second pine that does it (`ok`); else that way.
 */
export const HIDE2_TURN = { back: 4.6, half: (28 * Math.PI) / 180, body: (9 * Math.PI) / 180, toward: 0.3, step: (2.5 * Math.PI) / 180, most: (85 * Math.PI) / 180, ahead: 0.4, behind: 0.8, lensD: 3.0, hid: 2 } as const;
export function hide2Turn(me: Spot, sq: Spot, from: HomeTree, t2: HomeTree): { face: number; ok: boolean } {
  const want = headingTo(me, t2);
  const run = { x: t2.x - sq.x, z: t2.z - sq.z };
  const len = Math.hypot(run.x, run.z) || 1;
  const rOf = (t: HomeTree): number => barkRadius({ x: t.x, z: t.z, H: t.h, species: t.species }, 1) + 0.3;
  const footOf = (t: HomeTree): number => trunkOutline({ x: t.x, z: t.z, H: t.h, species: t.species }, 0.15) + 0.05;
  const fits = (h: number): boolean => {
    const f = { x: Math.sin(h), z: Math.cos(h) };
    const lens = { x: me.x - f.x * HIDE2_TURN.back, z: me.z - f.z * HIDE2_TURN.back };
    const off = (q: Spot): number => Math.abs(wrapA(headingTo(lens, q) - h));
    if (off(sq) > HIDE2_TURN.half || off(t2) > HIDE2_TURN.half) return false;
    // (the pine it runs to in front of him, the one it leaves at most `behind` m back from
    // him and well off the lens (`lensD` m): it never starts under the picture's edge by the
    // lens, its trunk faded between him and the lens — played 2026-10-04)
    const ahead = (q: Spot): number => (q.x - me.x) * f.x + (q.z - me.z) * f.z;
    if (ahead(t2) < HIDE2_TURN.ahead || ahead(sq) < -HIDE2_TURN.behind || dist(lens, sq) < HIDE2_TURN.lensD) return false;
    if (segDist(from, lens, me) < rOf(from) + 0.2) return false;
    // (its way over the ground not behind his own body: off to his side, or nearer the lens
    // than he is — played 2026-10-04: facing the second pine square on, his back hid the
    // whole dash; up on the bark, where it sits and where it climbs, it shows over his head)
    // (nor behind a trunk's foot — the pine it leaves too: played 2026-10-04, standing close
    // to that pine he saw it go down the bark and the rest of its run hid behind the trunk):
    // a moment of it may (`hid` of five bits, never the last two: he sees it reach the pine)
    let hid = 0;
    for (let k = 1; k <= 5; k++) {
      const q = { x: sq.x + (run.x * k) / 6, z: sq.z + (run.z * k) / 6 };
      if ((off(q) < HIDE2_TURN.body && dist(lens, q) > dist(lens, me) - 0.3)
        || HOME_TREES.some((t) => { const r = footOf(t); return dist(t, q) > r && dist(lens, t) < dist(lens, q) && segDist(t, lens, q) < r; })) {
        if (k >= 4) return false;
        hid += 1;
      }
    }
    if (hid > HIDE2_TURN.hid) return false;
    if ((run.x * f.x + run.z * f.z) / len < -HIDE2_TURN.toward) return false;
    return HOME_TREES.every((t) => dist(t, lens) > rOf(t) + 0.7
      && (t === from || segDist(t, lens, sq) > rOf(t))
      && (t === t2 || segDist(t, lens, t2) > rOf(t)));
  };
  for (let a = 0; a <= HIDE2_TURN.most; a += HIDE2_TURN.step) {
    for (const s of a === 0 ? [1] : [1, -1]) if (fits(want + s * a)) return { face: wrapA(want + s * a), ok: true };
  }
  return { face: want, ok: false };
}
/** Where he watches its dash from: where he stands when a turn there does it (`hide2Turn`);
 *  else — standing between the two pines, or with them too far apart in his picture — a few
 *  calm steps back from them (the nearest spot, `HIDE2_STEP` m at most, the way straight
 *  back from the two pines first) that is clear of the trunks, his steps there too, and
 *  from which one does; else where he stands. */
export const HIDE2_STEP = [0.6, 1.0, 1.4, 1.8] as const;
export function hide2Stand(me: Spot, sq: Spot, from: HomeTree, t2: HomeTree): { at: Spot; face: number; ok: boolean } {
  const here = hide2Turn(me, sq, from, t2);
  if (here.ok) return { at: me, ...here };
  const back = headingTo({ x: (sq.x + t2.x) / 2, z: (sq.z + t2.z) / 2 }, me);
  const ways = Array.from({ length: 16 }, (_, i) => back + ((i % 2 ? 1 : -1) * Math.ceil(i / 2) * Math.PI) / 8);
  for (const r of HIDE2_STEP) for (const a of ways) {
    const at = { x: me.x + Math.sin(a) * r, z: me.z + Math.cos(a) * r };
    if (HOME_TREES.some((t) => dist(t, at) < trunkClear(t) || segDist(t, me, at) < trunkClear(t) - 0.15)) continue;
    const t = hide2Turn(at, sq, from, t2);
    if (t.ok) return { at, ...t };
  }
  return { at: me, ...here };
}

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
    // round each hide tree, where he walks round it (hide-and-seek), a wider ring (run 7,
    // ek-day: the second hide pines too)
    ...ALL_HIDE_TREES.map((t) => ({ x: t.x, z: t.z, r: 4.6 })),
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
    ...ALL_HIDE_TREES.map((t) => ({ x: t.x, z: t.z, r: 4.2 })),
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
