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

/** How far (m) `p` stands outside the ecoduct's solid keep-out shape (< 0: inside it). */
export function ductGap(p: Spot): number {
  return obstacleGap(DUCT, p.x, p.z);
}

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
 * A group's way down to the bed: from where it waits unseen behind the ecoduct's end (the
 * first point: the deck comes down to the ground behind it; from the screen's view the end
 * hides it), along the deck's foot to its corner (the second point: where it comes into his
 * picture), down a trodden trail (the third) to the bed's edge (the last point: the MOUTH,
 * where a group stops when he stands in its way).
 */
export const TRAILS: Readonly<Record<Side, readonly Spot[]>> = {
  N: [{ x: -70.4, z: 16.0 }, { x: -63.6, z: 15.6 }, { x: -60.6, z: 13.6 }, { x: -58.9, z: 11.4 }],
  S: [{ x: -70.4, z: -4.2 }, { x: -63.6, z: -4.4 }, { x: -60.6, z: -2.0 }, { x: -59.0, z: 3.0 }],
};
/** Where a group's way down meets the bed: its mouth (the trail's last point). */
export function mouthOf(side: Side): Spot { const t = TRAILS[side]; return t[t.length - 1]; }
/** Where a group waits unseen before it comes (the trail's first point). */
export function waitOf(side: Side): Spot { return TRAILS[side][0]; }
/** Where it comes round the corner into his picture (the trail's second point). */
export function cornerOf(side: Side): Spot { return TRAILS[side][1]; }

/** A way out: from the bed's edge onto the heath (north-north-east) or along the sand track
 *  (south-south-east), sideways in the picture from the screen. The last point is far enough
 *  that a group is out of his picture there. */
export const EXITS: Readonly<Record<Side, readonly Spot[]>> = {
  N: [{ x: -56.4, z: 11.2 }, { x: -55.0, z: 15.2 }, { x: -54.0, z: 21.5 }, { x: -52.5, z: 28.5 }],
  S: [{ x: -56.6, z: 4.4 }, { x: -56.2, z: 0.4 }, { x: -55.8, z: -6.0 }, { x: -55.2, z: -13.0 }],
};

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
 * never his last play's first. The group that must wait for him to step aside (`opzij`) is a
 * group, never the fox alone (their words say "ze"). The corner each comes round and the
 * way it leaves: seeded, never three groups in a row round the same corner (the hind and her
 * calf leave onto the heath, north). How many piglets come: seeded.
 */
export function ecoductLayout(play: Pick<Play, 'fork'>, rounds: number, order: readonly string[], last: readonly string[] = []): EcoductLaid {
  const n = crossingsFor(rounds);
  const prev = last.length ? readVariant(last[last.length - 1]) : null;
  const kf = play.fork('ec-groepen');
  // the kinds before the last: shuffled rounds of all four, never two alike in a row (nor the
  // deer right before the deer), the first never his last play's first
  const kinds: Kind[] = [];
  for (let guard = 0; kinds.length < n - 1 && guard < 40; guard++) {
    const deck = kf.shuffle(KINDS);
    for (const k of deck) {
      if (kinds.length >= n - 1) break;
      if (kinds.length && kinds[kinds.length - 1] === k) continue;
      if (!kinds.length && prev?.kinds[0] === k) continue;
      if (kinds.length === n - 2 && k === 'hert') continue;
      kinds.push(k);
    }
  }
  kinds.push('hert');
  // the group that waits for him to step aside is never the fox alone: it changes places with
  // the other post-route group, or another kind takes its place
  const post = (id: string): number => { const j = order.indexOf(id); return j >= 1 ? n - 3 + j : -1; };
  const oi = post('opzij');
  if (oi >= 0 && kinds[oi] === 'vos') {
    const other = oi === n - 1 ? n - 2 : n - 1;
    if (kinds[other] !== 'vos' && kinds[other - 1] !== 'vos' && other !== n - 1) [kinds[oi], kinds[other]] = [kinds[other], kinds[oi]];
    else kinds[oi] = (['zwijn', 'ree'] as Kind[]).find((k) => k !== kinds[oi - 1] && k !== kinds[oi + 1]) ?? 'zwijn';
  }
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
/** Where the before-deer slip to when he comes near (behind the north end, out of sight). */
export const HIDEAWAY: Spot & { yaw: number } = { x: -71.5, z: 16.1, yaw: -1.5 };

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

/** The ground the forest's scattered trees keep clear of: the trails along the ecoduct's
 *  two ends, where the groups wait and come down. */
export function ecoductTreeClearings(): { x: number; z: number; r: number }[] {
  return SIDES.flatMap((s) => [...TRAILS[s].slice(0, 2), { x: TRAILS[s][0].x - 3, z: TRAILS[s][0].z }].map((p) => ({ x: p.x, z: p.z, r: 2.2 })));
}

/** The ecoduct's home in the world. */
export const ECODUCT_HOME: HomeSpec = {
  missionId: MISSION,
  places: ECODUCT_PLACES,
  residents: ECODUCT_RESIDENTS,
  marker: { at: MARKER, look: 'none' },
  // (the bed, the screen and the two corners lie over ~25 m: it stays drawn near any of them)
  spread: [{ x: BED.x, z: BED.z }, { x: SCREEN.x, z: SCREEN.z }, DUCT_NE, DUCT_SE, BEFORE_HINDE],
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
