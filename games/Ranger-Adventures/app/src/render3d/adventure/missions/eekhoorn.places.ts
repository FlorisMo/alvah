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
import { atLocal, dist, headingTo, segDist, uniformLocal, type Frame } from '../places.ts';
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

/** How high the two stubs it waits on stand (m, their top): low, about the boy's
 *  shoulder (he is 1.32 m), so the squirrel sitting up there faces him eye to eye. */
export const WAIT_H = 1.1;

/** The trees of the home (the forest draws them with its own; the scatter keeps clear). */
export const HOME_TREES: readonly HomeTree[] = [
  // the squirrel's pine: its branch stub faces the marker (where the ranger comes from)
  { ...OAK_AT, species: 'prop-pine-scots', h: 14, rotY: 0.9, branch: { ang: headingTo(OAK_AT, MARKER) - 0.5, h: 1.45, out: 0.3 } },
  // the way: each stub faces back along the way (where he follows from). The two it
  // waits on (A, C) are LOW (WAIT_H): sitting up there it looks him in the eye, over his
  // shoulder in the follow camera (on the ground in front of him his own body hides it)
  { ...PINE_A, species: 'prop-pine-scots', h: 13.5, rotY: 2.2, branch: { ang: headingTo(PINE_A, OAK_AT) + 0.35, h: WAIT_H, out: 0.28 } },
  { ...PINE_B, species: 'prop-pine-scots', h: 12.4, rotY: 4.1, branch: { ang: headingTo(PINE_B, PINE_A) + 0.2, h: 1.55, out: 0.26 } },
  { ...PINE_C, species: 'prop-pine-scots', h: 14.2, rotY: 5.3, branch: { ang: headingTo(PINE_C, PINE_A) - 0.35, h: WAIT_H, out: 0.28 } },
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

/* ------------------------------------------------------- the follow's waits ---- */

/** Where the squirrel sits up on a tree's stub (world x/z; its feet at `branch.h`). */
export function seatOf(t: HomeTree): Spot {
  const b = t.branch!;
  const r = barkRadius({ x: t.x, z: t.z, H: t.h, species: t.species }, b.h) + b.out;
  return { x: t.x + Math.sin(b.ang) * r, z: t.z + Math.cos(b.ang) * r };
}

/** How near (m) he comes to the squirrel waiting on its stub before it runs on: close
 *  enough that it reads as an animal through the follow lens (≈ 33 px tall at 1280×800
 *  at this distance, ≈ 40 px at the spot to see it from). */
export const SEE_D = 2.6;
/** He has SEEN it when most of it is well inside the picture — within this much of the
 *  half-width from the middle (0.7: the middle 70 % of the screen; at the very edge it is
 *  there, but a child has not seen it yet) — and not behind a trunk or his own body. */
export const SEEN_X = 0.7;
/** The spot to see it from (golden's walk hint): out along its stub a little to the side,
 *  so it sits over his shoulder, not straight over his head, and nothing is between. */
const WATCH_D = 1.9;
const WATCH_TURN = 0.3;
/** Near enough the spot to see it from (golden's walk hint radius): there he is close,
 *  whatever SEE_D says (WATCH_D + WATCH_R stays within ~3 m of it). */
export const WATCH_R = 1.0;
export function watchSpot(t: HomeTree): Spot {
  const s = seatOf(t), a = t.branch!.ang + WATCH_TURN;
  return { x: s.x + Math.sin(a) * WATCH_D, z: s.z + Math.cos(a) * WATCH_D };
}

/** The places table. */
export const EEKHOORN_PLACES = {
  marker: { ...MARKER, r: 2.4 },
  oak: { ...OAK_AT },
  /** the waits of the follow: where he sees the squirrel on its low stub from (it runs
   *  on once he is within SEE_D m of it and it is in his view) */
  hopA: { ...watchSpot(HOME_TREES[1]), r: SEE_D },
  hopC: { ...watchSpot(HOME_TREES[3]), r: SEE_D },
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

const wrapA = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

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

/** Hide-and-seek round pine C: a red squirrel keeps the trunk between itself and whoever
 *  comes near — him, and his eye (the follow lens behind him, which swings round as he
 *  turns). It clings `h` m up the bark on the side of the trunk farthest from both. When
 *  one of them comes round within `keepAt` rad of it (its body is thick beside a pine's
 *  trunk, so that is well before it shows), or a bit of it already peeks out in his
 *  view, it slips round to the farthest side again — a real move (`gain` rad further
 *  from them at least), never faster than he walks (`rate` rad/s round the bark: under
 *  1 m/s). Once he has walked `round` rad round the tree (or it slipped `most` times) it
 *  stays, and he finds it as he comes round — in his view, or right by it (within `near`
 *  m of it, within `nearAng` rad of its side of the tree) with a bit of it showing. So he
 *  walks about half round the tree, and it slips once or twice. */
export const HIDE = { h: 1.05, keepAt: 1.9, gain: 0.6, round: 2.2, most: 3, rate: 1.8, near: 1.4, nearAng: 0.9 } as const;

/** Never on the side of pine C that faces a close neighbour (pine B, 3.2 m off): he could
 *  not stand there to see it, and the way round would run into that trunk. */
const HIDE_TREE = HOME_TREES[3];
const HIDE_AVOID = HOME_TREES.filter((t) => t !== HIDE_TREE && dist(t, HIDE_TREE) < 4.5).map((t) => headingTo(HIDE_TREE, t));
const AVOID_HALF = 0.65;
const allowed = (a: number): boolean => HIDE_AVOID.every((b) => Math.abs(wrapA(a - b)) >= AVOID_HALF);

/** How far round the trunk (rad) the nearest of `eyes` (headings from its axis) is from `a`. */
function margin(a: number, eyes: readonly number[]): number {
  return Math.min(...eyes.map((e) => Math.abs(wrapA(a - e))));
}

/** The side of the trunk farthest from all `eyes` (headings from its axis; off a
 *  neighbour's side), the one nearer `from` when two are as good. */
export function hideFrom(eyes: readonly number[], from: number): number {
  let best = from, score = -1;
  for (let i = 0; i < 144; i++) {
    const a = (i / 144) * Math.PI * 2 - Math.PI;
    if (!allowed(a)) continue;
    const m = margin(a, eyes) - Math.abs(wrapA(a - from)) * 0.02;
    if (m > score) { score = m; best = a; }
  }
  return best;
}

/** Where it first hides (a heading from the trunk's axis): across the trunk from him and
 *  his eye (`eyes`), the side toward `toward` (its glade) when that is as good. */
export function hideStart(trunk: Spot, eyes: readonly Spot[], toward: Spot): number {
  const a = hideFrom(eyes.map((e) => headingTo(trunk, e)), headingTo(trunk, toward));
  // (a little toward its glade: the short way round to it goes that way)
  const b = a + Math.sign(wrapA(headingTo(trunk, toward) - a) || 1) * 0.25;
  return allowed(b) ? b : a;
}

/** He or his eye has come round toward it (`eyes`: their headings from the trunk), or
 *  (`peek`) a bit of it shows in his view: where it slips to now, or null when it stays
 *  (none of them near enough round yet and unseen, or no side farther from them). */
export function hideShift(sqAng: number, eyes: readonly number[], peek = false): number | null {
  const m = margin(sqAng, eyes);
  if (m >= HIDE.keepAt && !peek) return null;
  const to = hideFrom(eyes, sqAng);
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
 *  tree, the follow lens behind him looks at it). */
const OUT_R = 3.0;
const IN_R = 2.3;
const ROUND_STEP = 1.05;
const ON_ITS_SIDE = 0.3;
export function roundStep(t: HomeTree, me: Spot, sqAng: number): Spot {
  const him = headingTo(t, me);
  const off = wrapA(sqAng - him);
  if (Math.abs(off) <= ON_ITS_SIDE) return wayTo(me, { x: t.x + Math.sin(sqAng) * IN_R, z: t.z + Math.cos(sqAng) * IN_R });
  const a = him + Math.sign(off) * Math.min(ROUND_STEP, Math.abs(off));
  // (round a neighbour's trunk in the way, too)
  return wayTo(me, { x: t.x + Math.sin(a) * OUT_R, z: t.z + Math.cos(a) * OUT_R });
}

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
    // round pine C, where he walks round it (hide-and-seek), a wider ring
    { ...PINE_C, r: 4.6 },
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
