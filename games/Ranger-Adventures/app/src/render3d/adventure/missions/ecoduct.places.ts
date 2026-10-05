/**
 * ecoduct.places.ts — where "De oversteek" happens (run 7, design
 * `state/adventures/design.md` §4): at the REAL ecoduct on the west rim, chosen by looking at
 * the world and pinned by ecoduct.places.test.ts. Pure (THREE-free): the test, the home
 * (ecoduct.home.ts) and the script (ecoduct.ts) read the same tables.
 *
 * The ecoduct (world/Dressing's landmark, -70, 6) is a green arch: its deck runs north-south
 * over a tunnel whose mouth faces the heath (east). Its deck is no ground anyone walks on
 * here (the world seats every animal on the terrain): the animals come down off it BEHIND
 * its two ends, out of sight, and come round its north-east or south-east corner along a
 * trodden trail to a raked SAND BED in front of its mouth (rangers rake one to read who
 * crossed: the story). Seven look-alike patches of fresh tracks lie in the bed (the corsi
 * spots: PRINT_SPOTS scaled uniformly, all in one held view from the screen). Five metres
 * east of the bed stands a low wooden WILDLIFE SCREEN (kijkscherm) the ranger watches from.
 * Past the bed each group leaves along one of two ways out, north-north-east onto the heath
 * or south-south-east along the sand track: sideways in his picture, never at the lens.
 *
 * Every play draws from its forks (decision 1; `ecoductLayout`): which groups cross and in
 * which order (red deer, a sow with her piglets, a roe with her calf, a fox alone; never his
 * last play's first group), which corner each comes round and which way it leaves, how big
 * a group is. None of it changes a knob: every corner is as far from the bed, every group
 * walks as calmly, every route is the corsi core's; how long a route is, how many groups
 * cross for it, how long he must keep still and how long the animals wait are the level's.
 */

import { heightAt } from '../../Biomes.ts';
import { RANGER_STAND_HEIGHT } from '../../AnimalScale.ts';
import { boxObstacle, obstacleGap, type Obstacle } from '../../CharacterController.ts';
import { PRINT_SPOTS } from '../../../engines/corsi.ts';
import { atLocal, dist, headingTo, segDist, toLocal, toward, uniformLocal, type Frame } from '../places.ts';
import type { HomeSpec, Place, ResidentSpec, Spot } from '../types.ts';
import type { Play } from '../../../core/play.ts';

export const MISSION = 'ecoduct';

/* ------------------------------------------------------------ the ecoduct ---- */

/** The ecoduct as the world makes it solid (world/Dressing LANDMARKS: its model's footprint
 *  per metre of its 6 m height, turned to face the clearing). */
export const DUCT_AT: Spot = { x: -70, z: 6 };
export const DUCT_H = 6;
export const DUCT: Obstacle = boxObstacle(DUCT_AT.x, DUCT_AT.z, 1.29 * DUCT_H, 1.3 * DUCT_H, Math.atan2(-DUCT_AT.x, -DUCT_AT.z), 0.3);

/** How far (m) `p` stands outside the ecoduct's solid keep-out shape (< 0: inside it). The
 *  world keeps the ranger and the animals out of its whole footprint, ramps included. */
export function ductGap(p: Spot): number {
  return obstacleGap(DUCT, p.x, p.z);
}
/* (Its footprint is NOT a wall to hide behind: the model is an arch ~7 m deep over a tunnel
   that is open from the heath to the forest, its ends are low ramps, and the flat pads round
   it are ground. Nothing waits behind it: a group waits outside every picture he watches
   from — pinned by ecoduct.places.test.ts through the very lenses the kit fits.) */

/** A corner of the ecoduct's footprint (its own x/z signs), in the world. */
function ductCorner(sx: number, sz: number): Spot {
  const b = DUCT.box!;
  const c = Math.cos(b.rot), s = Math.sin(b.rot);
  const lx = sx * b.hx, lz = sz * b.hz;
  return { x: DUCT.x + lx * c + lz * s, z: DUCT.z - lx * s + lz * c };
}
/** Its mouth's two corners (the face toward the heath): its deck's north and south ends. */
export const DUCT_NE: Spot = ductCorner(-1, 1);
export const DUCT_SE: Spot = ductCorner(1, 1);

/** The world's props by the ecoduct (world/Dressing PLACES): the grove's trunks (solid) and
 *  a fern at its mouth (walk-through). */
export const GROVE: readonly Spot[] = [{ x: -63, z: 18.5 }, { x: -66, z: -6.5 }, { x: -70.5, z: 18.5 }];
export const FERN: Spot = { x: -61, z: 4 };

/* ------------------------------------------------------------ the sand bed ---- */

/** The sand bed's frame: its middle, looked at from the screen (heading west, toward the
 *  ecoduct's mouth): `u` across (his right: south), `v` away from him (west). */
export const BED: Frame = { x: -57.6, z: 7.9, heading: -Math.PI / 2 };
/** PRINT_SPOTS scaled UNIFORMLY (m per percent): the seven patches span ~4.1 × 2.9 m. */
export const BED_SCALE = 0.06;
/** The raked sand's half extents (m) round the frame: the patches with a margin. */
export const BED_HALF = { u: 2.75, v: 2.15 } as const;
/** One patch of tracks (m across). */
export const PATCH_SIZE = 0.62;

/** The seven patches of the bed (world x/z), in PRINT_SPOTS id order. */
export function bedSpots(): (Spot & { id: number })[] {
  return PRINT_SPOTS.map((s) => {
    const { u, v } = uniformLocal(s.x, s.y, BED_SCALE);
    return { id: s.id, ...atLocal(BED, u, v) };
  });
}

/** Is (x, z) on the raked sand (within `grow` m of its edge)? */
export function onBed(p: Spot, grow = 0): boolean {
  const { u, v } = toLocal(BED, p);
  return Math.abs(u) <= BED_HALF.u + grow && Math.abs(v) <= BED_HALF.v + grow;
}

/* ------------------------------------------------------------ the screen ---- */

/** The wildlife screen: a low wall of planks with a slit, across his way to the bed, ~5 m
 *  east of it; he stands behind it (`STAND`) and looks over it and through its slit. */
export const SCREEN = { ...atLocal(BED, 0.15, -4.75), heading: BED.heading, halfW: 1.2, h: 1.28, thick: 0.09, slit: [0.98, 1.1] as const };
/** Its solid (the ranger and the animals walk round it). */
export function screenObstacle(): Obstacle {
  return { ...boxObstacle(SCREEN.x, SCREEN.z, SCREEN.halfW, SCREEN.thick, SCREEN.heading, 0.22), h: SCREEN.h };
}
/** Where he stands to watch: right behind the screen's middle, looking at the bed. */
export const STAND: Place = { ...atLocal(BED, 0.15, -5.4), r: 0.6, heading: BED.heading };

/* ------------------------------------------------------------ the marker ---- */

/** The marker: out on the heath north-east of the screen, ~9 m from it (a quiet walk), the
 *  ecoduct in view beyond it; ≥ 8 m from the roaming fox's loop. */
export const MARKER: Spot = { x: -45.5, z: 12.5 };
/** The roaming fox's loop (world/Fauna): its home and radius. */
export const FOX_LOOP = { x: -42, z: -2, r: 6 } as const;

/* ------------------------------------------------------- the ways across ---- */

/** Which corner a group comes round: the ecoduct's north end (`N`) or its south end (`S`). */
export type Side = 'N' | 'S';
export const SIDES: readonly Side[] = ['N', 'S'];

/**
 * A group's way to the bed: from where it waits (the first point: OUTSIDE every picture he
 * watches from — past the held view's side edge, off the heath beside the bridge's end),
 * past the bridge's corner into his picture (the second point: at the picture's edge, so a
 * group walks in from the side, never appears in it), down a trodden trail to the bridge's
 * foot (the third: where a group stops to look at him) and on to the bed's edge (the last
 * point: the MOUTH, where a group stops when he stands in its way).
 */
export const TRAILS: Readonly<Record<Side, readonly Spot[]>> = {
  N: [{ x: -62.0, z: 23.0 }, { x: -61.2, z: 18.2 }, { x: -60.4, z: 14.7 }, { x: -58.9, z: 11.4 }],
  S: [{ x: -62.8, z: -7.4 }, { x: -61.8, z: -3.1 }, { x: -60.5, z: 0.3 }, { x: -59.0, z: 3.0 }],
};
/** Where a group's way down meets the bed: its mouth (the trail's last point). */
export function mouthOf(side: Side): Spot { const t = TRAILS[side]; return t[t.length - 1]; }
/** Where a group waits before it comes (the trail's first point), out of his picture. */
export function waitOf(side: Side): Spot { return TRAILS[side][0]; }
/** Where it comes into his picture (the trail's second point: the held view's edge). */
export function cornerOf(side: Side): Spot { return TRAILS[side][1]; }
/** Where a group stops when he stands on the bed in its way (the flip): on its trail a few
 *  steps above the bed's mouth, ~5-6 m from him — close enough to see them look at him. */
export function haltOf(side: Side): Spot {
  const t = TRAILS[side], a = t[2], b = t[3];
  return { x: a.x + (b.x - a.x) * 0.6, z: a.z + (b.z - a.z) * 0.6 };
}
/** The way back from a wait (a unit vector, away from the bed): a group stands in file
 *  along it, and a play may wait further back along it (`fileBack`). */
export function backOf(side: Side): Spot {
  const [p, q] = TRAILS[side];
  const L = dist(p, q) || 1;
  return { x: (p.x - q.x) / L, z: (p.z - q.z) / L };
}
/** The spot `d` m back from a side's wait, along its way back. */
export function fileBack(side: Side, d: number): Spot {
  const p = waitOf(side), b = backOf(side);
  return { x: p.x + b.x * d, z: p.z + b.z * d };
}
/** How far back (m) a wait may move along its way back when the lens he has now sees it
 *  (the play's guard, for a child who stepped aside somewhere else): the longest file
 *  still stands inside the world there. */
export const BACK_MAX = 6;

/** A way out: from the bed's edge onto the heath (north-north-east) or along the sand track
 *  (south-south-east), sideways in the picture from the screen. The last point is far enough
 *  that a group is out of his picture there. */
export const EXITS: Readonly<Record<Side, readonly Spot[]>> = {
  N: [{ x: -56.4, z: 11.2 }, { x: -55.0, z: 15.2 }, { x: -54.0, z: 21.5 }, { x: -52.5, z: 28.5 }],
  S: [{ x: -56.6, z: 4.4 }, { x: -56.2, z: 0.4 }, { x: -55.8, z: -6.0 }, { x: -55.2, z: -13.0 }],
};

/** How far (m) behind the bed's back edge (toward the ecoduct) a lead steps off it after a
 *  route's show: nothing stands between the lens and a patch while he points them back. */
export const BACK_OFF = 0.7;
/** Where the lead steps off the bed after the route's last patch: straight back off its far
 *  edge, behind the patches (nothing behind a patch hides it from the lens). */
export function backOff(p: Spot): Spot {
  const { u } = toLocal(BED, p);
  return atLocal(BED, Math.max(-BED_HALF.u, Math.min(BED_HALF.u, u)), BED_HALF.v + BACK_OFF);
}
/** …and its way on to the side it leaves by, along the bed's back and side (never over it),
 *  out onto that side's way out. */
export function backWay(out: Side): Spot[] {
  const su = out === 'N' ? -1 : 1;
  return [atLocal(BED, su * (BED_HALF.u + 0.8), BED_HALF.v + BACK_OFF), ...EXITS[out]];
}

/** Where the `i`-th of a group's others steps after a route's show, from the bed's edge where
 *  it waited (`at`): round the bed's near back corner, never over the sand (each a little
 *  further along than the one before, so no two make for one spot). */
export function backCorner(at: Spot, i: number): Spot {
  const su = toLocal(BED, at).u < 0 ? -1 : 1;
  return atLocal(BED, su * (BED_HALF.u + 0.8 + 0.7 * i), BED_HALF.v + BACK_OFF - 0.15 * i);
}

/** A group's whole way: down its trail, over the bed to the other side, and out. */
export function crossingLine(from: Side, out: Side): Spot[] {
  return [...TRAILS[from], { x: BED.x, z: BED.z }, ...EXITS[out]];
}

/* ------------------------------------------------------- who crosses ---- */

/** The four kinds of group that cross (the rare badger comes on its own). */
export type Kind = 'hert' | 'zwijn' | 'ree' | 'vos';
export const KINDS: readonly Kind[] = ['hert', 'zwijn', 'ree', 'vos'];

/** A group's members (resident keys), its lead first; the young one (the curious one that
 *  looks at him) and how many may come. */
export const GROUPS: Readonly<Record<Kind, { members: readonly string[]; min: number; young: string; disc: string }>> = {
  hert: { members: ['hinde', 'kalf', 'hinde2'], min: 2, young: 'kalf', disc: 'ecoduct.edelhert' },
  zwijn: { members: ['zeug', 'big1', 'big2', 'big3'], min: 3, young: 'big1', disc: 'ecoduct.wildzwijn' },
  ree: { members: ['ree', 'reekalf'], min: 2, young: 'reekalf', disc: 'ecoduct.ree' },
  vos: { members: ['vos'], min: 1, young: 'vos', disc: 'ecoduct.vos' },
};
/** The rare visitor's resident key. */
export const DAS = 'das';
export const DAS_ID = 'ecoduct.das';

/** One crossing of this play: who, round which corner, out which way, how many. */
export interface Crossing { kind: Kind; from: Side; out: Side; n: number }

/** A play's crossings: the first group (its arrival holds the first calm moment), one more
 *  per further route round, then one per later calm moment (two). */
export function crossingsFor(rounds: number): number {
  return Math.max(1, Math.floor(rounds)) + 2;
}

/** The history's key for this mission's variant (the play notes it as `ec`). */
export const VARIANT_KEY = 'ec';

/** This mission's last variants (oldest first), one per play, from the beat history. */
export function lastVariants(history: readonly { m: string; sd?: number; va?: string }[]): string[] {
  const out: { sd: number | undefined; v: string }[] = [];
  for (const b of history) {
    if (b.m !== MISSION || !b.va) continue;
    const pair = b.va.split(',').find((p) => p.startsWith(`${VARIANT_KEY}:`));
    if (!pair) continue;
    if (out.length && out[out.length - 1].sd === b.sd) continue;
    out.push({ sd: b.sd, v: pair.slice(VARIANT_KEY.length + 1) });
  }
  return out.map((o) => o.v);
}

const LETTER: Readonly<Record<Kind, string>> = { hert: 'h', zwijn: 'z', ree: 'r', vos: 'v' };
const OF_LETTER: Readonly<Record<string, Kind>> = { h: 'hert', z: 'zwijn', r: 'ree', v: 'vos' };

/** A logged variant read back: its groups' kinds and corners (null: not this mission's). */
export function readVariant(v: string): { kinds: Kind[]; froms: Side[] } | null {
  const m = /^([hzrv]+)-([NS]+)/.exec(v);
  if (!m) return null;
  return { kinds: [...m[1]].map((c) => OF_LETTER[c]), froms: [...m[2]] as Side[] };
}

/** What a play lays: the crossings in order and its compact variant. */
export interface EcoductLaid {
  crossings: Crossing[];
  /** `hzrv-NSSN-1`: the kinds, the corners, the group sizes' code */
  variant: string;
}

/**
 * This play's crossings, drawn from its forks (one per decision). `rounds`: the route's
 * rounds (the level's corsi knob); `order`: the three calm moments' ids in this play's order
 * (the dagnacht trial's: the first is met as the first group comes, the other two after the
 * route, one group each); `last`: his last plays' variants (oldest first).
 *
 * The last group over is always the hind and her calf (the ecoduct's own animals, the ones
 * the mission helps: they cross into the heath by the screen and graze there after). Before
 * them the kinds come in shuffled rounds of all four, never two alike in a row, the first
 * never one of his last two plays' first. A group whose coming is a calm moment for his FEET
 * (`stil`: they stop and stare at a step) or that must wait for him to step aside (`opzij`)
 * is a group, never the fox alone (their words say "ze", and a lone fox at the picture's
 * edge is too small to see what his step did). The corner each comes round and the way it
 * leaves: seeded, never three groups in a row round the same corner (the hind and her calf
 * leave onto the heath, north). How many piglets come: seeded.
 */
export function ecoductLayout(play: Pick<Play, 'fork'>, rounds: number, order: readonly string[], last: readonly string[] = []): EcoductLaid {
  const n = crossingsFor(rounds);
  const prev = last.length ? readVariant(last[last.length - 1]) : null;
  // (the first group never one of his last two plays' first groups)
  const before = last.slice(-2).map((v) => readVariant(v)?.kinds[0]).filter((k): k is Kind => !!k);
  // which crossing holds which calm moment: the first as the first group comes, the other
  // two one group each after the route's
  const at = (id: string): number => { const j = order.indexOf(id); return j < 0 ? -1 : j === 0 ? 0 : n - 3 + j; };
  const groupOnly = new Set([at('stil'), at('opzij')].filter((i) => i >= 0));
  const kf = play.fork('ec-groepen');
  // the kinds before the last: shuffled rounds of all four, never two alike in a row (nor the
  // deer right before the deer), the first never his last play's first, never the fox alone
  // where a moment needs a group
  const kinds: Kind[] = [];
  for (let guard = 0; kinds.length < n - 1 && guard < 40; guard++) {
    const deck = kf.shuffle(KINDS);
    for (const k of deck) {
      if (kinds.length >= n - 1) break;
      const i = kinds.length;
      if (i && kinds[i - 1] === k) continue;
      if (!i && before.includes(k)) continue;
      if (i === n - 2 && k === 'hert') continue;
      if (k === 'vos' && groupOnly.has(i)) continue;
      kinds.push(k);
    }
  }
  kinds.push('hert');
  // the corners and the ways out
  const sf = play.fork('ec-paden');
  const froms: Side[] = [];
  for (let i = 0; i < n; i++) {
    let s = sf.pick(SIDES);
    if (i >= 2 && froms[i - 1] === froms[i - 2] && s === froms[i - 1]) s = s === 'N' ? 'S' : 'N';
    if (i === 0 && prev?.froms[0] === s && sf.chance(0.6)) s = s === 'N' ? 'S' : 'N';
    froms.push(s);
  }
  // most groups leave on the far side of the bed from where they came down (they cross it);
  // now and then one turns back the way it came; the hind and her calf onto the heath (north)
  const outs: Side[] = froms.map((f, i) => (i === n - 1 ? 'N' : sf.chance(0.75) ? (f === 'N' ? 'S' : 'N') : f));
  // he steps aside by the screen's end away from where a group leaves (ASIDE): from there he
  // looks over the bed toward the corner they leave by, so the next group (the last, while
  // he still stands there) comes round the other corner, whose wait lies out of that picture
  const oi = at('opzij');
  if (oi >= 0 && oi < n - 1) froms[oi + 1] = outs[oi] === 'N' ? 'S' : 'N';
  const gf = play.fork('ec-grootte');
  const sizes = kinds.map((k, i) => {
    const g = GROUPS[k];
    if (i === n - 1) return 2; // (the hind and her calf: the home's own)
    return g.members.length === g.min ? g.min : gf.int(g.min, g.members.length);
  });
  const crossings = kinds.map((kind, i) => ({ kind, from: froms[i], out: outs[i], n: sizes[i] }));
  const variant = `${kinds.map((k) => LETTER[k]).join('')}-${froms.join('')}-${outs.join('')}`;
  return { crossings, variant };
}

/* ------------------------------------------------------- the lens ---- */

/** A framed view as the kit's `frame` takes it (FrameSpec, THREE-free). */
export interface ViewSpec {
  at: Spot;
  heading: number;
  halfW: number;
  halfD: number;
  tall?: number;
  pitchDeg?: number;
  insetTop?: number;
  insetBottom?: number;
  include?: readonly { x: number; z: number; h: number; r?: number }[];
}

/** Behind the screen: the bed, the ecoduct's mouth and both corners' trails, the ranger at
 *  the bottom of the picture (the route's held view, and every moment at the screen). */
export const BED_VIEW: ViewSpec = {
  at: atLocal(BED, 0, 0.4), heading: BED.heading, halfW: 2.9, halfD: 2.4, tall: 2.4, pitchDeg: 24,
  insetTop: 100, insetBottom: 20,
  include: [{ x: STAND.x, z: STAND.z, h: RANGER_STAND_HEIGHT, r: 0.3 }],
};

/** The way he looks at the ecoduct first (one calm look from the marker): its deck's middle. */
export const DECK_LOOK: Spot & { y: number } = { x: -66.4, z: 6.4, y: heightAt(-66.4, 6.4) + 4.2 };

/** Where he stands on the bed to see the tracks up close (the bed visit): in its west half,
 *  right on the line every group takes over it. */
export const BED_STAND: Place = { ...atLocal(BED, 0, 0.7), r: 0.8, heading: BED.heading };
/** Where he steps aside to when a group wants over (`opzij`), by the way they will leave:
 *  off their way, beside the screen's far end from it (≥ 4.5 m from where he stood on the bed,
 *  ≥ 2.5 m off any group's line over the bed; back behind the screen is two steps from there). */
export const ASIDE: Readonly<Record<Side, Place>> = {
  // (they leave north: he steps out to the screen's south end; they leave south: its north end)
  N: { ...atLocal(BED, SCREEN.halfW + 1.1 + 0.15, -5.0), r: 0.9 },
  S: { ...atLocal(BED, -SCREEN.halfW - 0.8 + 0.15, -5.0), r: 0.9 },
};

/** Where a young one comes up to look at him (`roep`): behind the screen, beside the
 *  screen's end on its group's side (~2 m from him, never behind the screen from the lens);
 *  on the open sand, 2.2 m from him toward its group. */
export function roepSpot(him: Spot, from: Side, where: 'scherm' | 'bed'): Spot {
  if (where === 'scherm') return atLocal(BED, from === 'N' ? -1.75 : 2.05, -4.55);
  return toward(him, mouthOf(from), 2.2);
}

/** He stands aside (in front of the screen) and watches a group cross the bed past him:
 *  from behind him, over the bed (the held picture of the flip's end). */
export function asideView(me: Spot): ViewSpec {
  return {
    at: atLocal(BED, 0, 0.4), heading: headingTo(me, { x: BED.x, z: BED.z }), halfW: 2.9, halfD: 2.4, tall: 2.4, pitchDeg: 24,
    insetTop: 100, insetBottom: 20, include: [{ x: me.x, z: me.z, h: RANGER_STAND_HEIGHT, r: 0.3 }],
  };
}

/* ------------------------------------------------------- who lives here ---- */

/** The hind and her calf before the mission: grazing by the ecoduct's north foot, across
 *  from the heath (shy: they slip round behind its end when he comes near), and after it:
 *  on the heath north-east of the screen, the side they crossed to. */
export const BEFORE_HINDE: Spot & { yaw: number } = { x: -66.2, z: 17.0, yaw: 1.9 };
export const BEFORE_KALF: Spot & { yaw: number } = { x: -64.6, z: 16.5, yaw: 2.3 };
export const HOME: Spot = { x: -50.6, z: 15.4 };
export const AFTER_HINDE: Spot & { yaw: number } = { x: HOME.x, z: HOME.z, yaw: -2.3 };
export const AFTER_KALF: Spot & { yaw: number } = { x: HOME.x + 1.3, z: HOME.z - 0.9, yaw: -2.0 };
/** Where the before-deer slip to when he comes near (round the bridge's north end). */
export const HIDEAWAY: Spot & { yaw: number } = { x: -71.5, z: 16.1, yaw: -1.5 };

/**
 * When a play begins the hind and her calf (grazing by the bridge before, or on the heath by
 * the screen after his last crossing) walk calmly off, away from where he will watch — the
 * play brings whoever comes. Each way leads away from the screen's picture; they are hidden
 * only once out of his picture (and walk on along it until they are).
 */
export function leaveWay(from: Spot): Spot[] {
  // from the heath by the screen: north-east onto the open heath, away from the bed
  if (from.x > -58) return [{ x: from.x + 2.5, z: from.z + 7 }, { x: from.x + 5, z: from.z + 15 }];
  // from by the bridge (or round its end): north along the forest's edge
  return [{ x: -65.4, z: 23.5 }, { x: -63.6, z: 31.5 }];
}

const nobody = (key: string, animal: string): ResidentSpec => ({ key, animal, before: null, after: null, reach: 30 });

/**
 * The animals of the crossing: every group's members, out of sight until their crossing
 * comes (`before`/`after` null: a play brings them round the corner), except the hind and her
 * calf who graze by the ecoduct before and on the heath after. The rare badger is the home's
 * too (only a play that rolled it brings it).
 */
export const ECODUCT_RESIDENTS: readonly ResidentSpec[] = [
  { key: 'hinde', animal: 'hinde', reach: 30,
    before: { ...BEFORE_HINDE, idle: 'graze', roam: 0.6 }, after: { ...AFTER_HINDE, idle: 'graze', roam: 0.6 },
    shy: [{ within: 12, back: 17, to: HIDEAWAY, after: 4, state: 'before' }] },
  { key: 'kalf', animal: 'hertenkalf', reach: 30,
    before: { ...BEFORE_KALF, idle: 'graze', roam: 0.5 }, after: { ...AFTER_KALF, idle: 'graze', roam: 0.5 },
    shy: [{ within: 12, back: 17, to: { x: HIDEAWAY.x - 1.6, z: HIDEAWAY.z + 0.2, yaw: -1.5 }, after: 4, state: 'before' }] },
  nobody('hinde2', 'hinde'),
  nobody('zeug', 'wildzwijn'), nobody('big1', 'frisling'), nobody('big2', 'frisling'), nobody('big3', 'frisling'),
  nobody('ree', 'ree'), nobody('reekalf', 'reekalf'),
  nobody('vos', 'vos'),
  nobody(DAS, 'das'),
];

/** The places table (`__ranger.missionPlaces('ecoduct')`). */
export const ECODUCT_PLACES: Readonly<Record<string, Place>> = {
  marker: { ...MARKER, r: 2.4 },
  home: { ...HOME },
  stand: STAND,
  bed: { x: BED.x, z: BED.z, heading: BED.heading },
  screen: { x: SCREEN.x, z: SCREEN.z, heading: SCREEN.heading },
  bedStand: BED_STAND,
  mouthN: mouthOf('N'),
  mouthS: mouthOf('S'),
  asideN: ASIDE.N,
  asideS: ASIDE.S,
};

/** The ground the world's scatter leaves to the home: the raked bed, round the screen and
 *  the stand, the trodden trails and the first stretch of each way out. */
export function ecoductClearings(): { x: number; z: number; r: number }[] {
  const out: { x: number; z: number; r: number }[] = [];
  for (let u = -BED_HALF.u; u <= BED_HALF.u + 1e-6; u += 1.1) {
    for (let v = -BED_HALF.v; v <= BED_HALF.v + 1e-6; v += 1.0) out.push({ ...atLocal(BED, u, v), r: 1.0 });
  }
  out.push({ x: SCREEN.x, z: SCREEN.z, r: 1.7 }, { x: STAND.x, z: STAND.z, r: 1.2 });
  for (const s of SIDES) {
    for (const line of [TRAILS[s].slice(1), EXITS[s].slice(0, 2)]) {
      for (let i = 1; i < line.length; i++) {
        const a = line[i - 1], b = line[i];
        const L = dist(a, b);
        for (let t = 0; t <= L + 1e-6; t += 1.2) out.push({ x: a.x + ((b.x - a.x) * t) / L, z: a.z + ((b.z - a.z) * t) / L, r: 0.9 });
      }
    }
  }
  return out;
}

/** The ground the forest's scattered trees keep clear of: where the groups wait in file and
 *  come in beside the ecoduct's two ends. */
export function ecoductTreeClearings(): { x: number; z: number; r: number }[] {
  return SIDES.flatMap((s) => [...TRAILS[s].slice(0, 2), fileBack(s, 3), fileBack(s, 6)].map((p) => ({ x: p.x, z: p.z, r: 2.2 })));
}

/** The ecoduct's home in the world. */
export const ECODUCT_HOME: HomeSpec = {
  missionId: MISSION,
  places: ECODUCT_PLACES,
  residents: ECODUCT_RESIDENTS,
  marker: { at: MARKER, look: 'none' },
  // (the bed, the screen, where the hind grazes before and after: it stays drawn near any of
  // them, and rests from the other homes' views — the frisling's fields are ~45 m off)
  spread: [{ x: BED.x, z: BED.z }, { x: SCREEN.x, z: SCREEN.z }, BEFORE_HINDE, HOME],
};

/** Is `p` within `r` m of a polyline? */
export function nearLine(p: Spot, line: readonly Spot[], r: number): boolean {
  for (let i = 1; i < line.length; i++) if (segDist(p, line[i - 1], line[i]) < r) return true;
  return false;
}
/** The distance (m) from `p` to a polyline. */
export function lineDist(p: Spot, line: readonly Spot[]): number {
  let d = Infinity;
  for (let i = 1; i < line.length; i++) d = Math.min(d, segDist(p, line[i - 1], line[i]));
  return d;
}
/** The point of a polyline nearest to `p`. */
export function nearestOn(p: Spot, line: readonly Spot[]): Spot {
  let best = line[0], bd = Infinity;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i];
    const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / L2));
    const q = { x: a.x + dx * t, z: a.z + dz * t };
    const d = dist(p, q);
    if (d < bd) { bd = d; best = q; }
  }
  return best;
}

/** (headingTo, for the script and the home) */
export { headingTo };
