/**
 * frisling.places.ts — where "De verdwaalde frisling" happens in the world, and who
 * lives there (THREE-free; `frisling.places.test.ts` pins it). Chosen by looking at the
 * world (design run6-missions §4.1): the heide west of the clearing, open ground, the
 * west trail across it, the ree and herstel markers ≥ 8 m away.
 *
 * Seen by a child walking up from the clearing (heading south-west, the camera behind
 * him): the empty marker ring ahead; beyond it, 13 m out and a little left, the family
 * rooting at its muddy WALLOW, and between the ring and the wallow the ROOTING FIELD,
 * seven look-alike patches of turned earth where the group went home. Off to his right,
 * across the sand of the west trail in the long grass of the meadow, a STAND of bracken
 * and pijpenstrootje the squeak comes from.
 *
 *   marker ── (follow the squeak + faint prints, ~30 m, over the trail) ── the stand
 *                                                                 (search, two holds)
 *   the stand ── (lead him home, ~26 m back over the trail, the family ahead) ──┐
 *                                                        rooting field (the route, corsi)
 *                                              │ walk on (~5 m, the yearling comes)
 *                                           wallow (three choices, the reunion)
 *
 * Run 6 polish: the stand lay 8 m from the ring and the way home was 5 m (the lead was
 * over before it began). The marker, the field and the wallow stay where they were; the
 * stand moved as far as the ground allows: every way from the ring to a stand and on to
 * the field is at most the follow + the 7.4 m from the ring to the field, the heath east
 * of the ring ends at the forest (a stand there leads home with the family off to the
 * side), so it lies north, where leading him home walks straight at his family.
 */

import { PRINT_SPOTS } from '../../../engines/corsi.ts';
import { patchLocal } from '../../play/kit-math.ts';
import { RANGER_STAND_HEIGHT } from '../../AnimalScale.ts';
import type { HomeSpec, Place, ResidentSpec, Spot } from '../types.ts';
import { approachOf, atLocal, dist, headingTo, toLocal, uniformLocal, type Frame } from '../places.ts';

/** The frisling marker: the heide's first anchor (Biomes.anchorInBiome('heide', 22)).
 *  The marker stays where it always stood; the test checks the anchor still lands here. */
export const MARKER: Spot = { x: -15.556349186104043, z: -15.556349186104047 };
/** The centre of the cover stand the lost piglet lies in: in the meadow's long grass,
 *  20 m north of the west trail (open grassland, no tree within 25 m, dry: the ven's
 *  water lies 70 m east). */
const STAND_AT: Spot = { x: -25.7, z: 16 };
/** The centre of the rooting field (the corsi spots). */
const FIELD_AT: Spot = { x: -24, z: -16 };
/** The centre of the wallow (zoel), the rotte's home. */
const WALLOW_AT: Spot = { x: -26, z: -24 };

/** The cover stand: half-size across (u) and in depth (v) of its clump layout (m), laid
 *  in the frame the ranger sees it in when he arrives from the marker. The zoeken trial
 *  (target + decoys, 0..100) lands on it through `patchLocal(x, y, halfW, halfD)`, the
 *  same mapping the 3D zoeken always used. */
export const STAND = { halfW: 2.1, halfD: 1.5 } as const;
/** How far out from the stand's centre the ranger stops to search it (m). */
const STAND_BACK = 2.9;

/** The rooting field: PRINT_SPOTS scaled UNIFORMLY (m per percent), all seven in one
 *  view; the ranger stops `FIELD_BACK` m out from its centre to watch the route. */
export const FIELD_SCALE = 0.078;
const FIELD_BACK = 3.3;
/** The side the ranger comes to the field from to watch the route: its north-east, the
 *  way the group went home (where the stand used to be; kept when the stand moved, so the
 *  field's layout and its view are the ones every run so far played). */
const FIELD_FROM: Spot = { x: -20, z: -8 };

/** The wallow's mud (half-sizes, m) and where the ranger stops by it. */
export const WALLOW = { halfW: 1.8, halfD: 1.35 } as const;
const WALLOW_TALK = 4.8;   // the three choices: the yearling comes to him here

const coverApproach = approachOf(STAND_AT, MARKER, STAND_BACK, 1.3);
const fieldApproach = approachOf(FIELD_AT, FIELD_FROM, FIELD_BACK, 1.2);
const wallowTalk = approachOf(WALLOW_AT, FIELD_AT, WALLOW_TALK, 1.2);
/** "Loop rustig door": he walks on along the way, past the wallow (to its side), and so
 *  gives the family room — never into it. */
const wallowGive: Place = (() => {
  const h = headingTo(wallowTalk, WALLOW_AT);
  const p = atLocal({ x: wallowTalk.x, z: wallowTalk.z, heading: h }, -1.9, 1.1);
  return { ...p, r: 0.6, heading: headingTo(p, WALLOW_AT) };
})();

/** The stand's frame (u across, v away from the ranger arriving from the marker). */
export const STAND_FRAME: Frame = { x: STAND_AT.x, z: STAND_AT.z, heading: coverApproach.heading! };
/** The field's frame (the ranger arrives from the stand side). */
export const FIELD_FRAME: Frame = { x: FIELD_AT.x, z: FIELD_AT.z, heading: fieldApproach.heading! };
/** The wallow's frame (seen from the field side, where the ranger comes from). */
export const WALLOW_FRAME: Frame = { x: WALLOW_AT.x, z: WALLOW_AT.z, heading: wallowTalk.heading! };

/** The places table. */
export const FRISLING_PLACES = {
  marker: { ...MARKER, r: 2.4 },
  /** the stand's centre, and the spot the ranger arrives at to search it */
  cover: { ...STAND_AT, heading: coverApproach.heading },
  coverApproach,
  /** the rooting field's centre, and where the ranger stands to watch the route */
  field: { ...FIELD_AT, heading: fieldApproach.heading },
  fieldApproach,
  /** the wallow's centre (the rotte's home), where the choices are made, and where he
   *  stops for the reunion */
  wallow: { ...WALLOW_AT, heading: wallowTalk.heading },
  wallowTalk,
  wallowGive,
  /** the home place: the ranger ends within 12 m of it (golden step 8) */
  home: { ...WALLOW_AT },
} as const satisfies Record<string, Place>;

/** The seven patches of turned earth (world x/z), in PRINT_SPOTS id order. */
export function fieldSpots(): (Spot & { id: number })[] {
  return PRINT_SPOTS.map((s) => {
    const { u, v } = uniformLocal(s.x, s.y, FIELD_SCALE);
    return { id: s.id, ...atLocal(FIELD_FRAME, u, v) };
  });
}

/** The clumps beside the way home, from the stand to the field: [share of the way,
 *  metres to its side (+ right, walking home), size]. Alternately left and right, never
 *  on the way (a child walks it straight), clear of the sand of the west trail; the last
 *  ones stand where the family is in sight and running is tempting. */
const LEAD_CLUMPS: readonly (readonly [number, number, number])[] = [
  [0.16, 2.2, 0.9], [0.34, -2.3, 0.85], [0.5, 2.1, 0.9], [0.6, -2.2, 0.8], [0.82, 2.3, 0.9], [0.93, -2.1, 0.8],
];

/** Loose clumps of cover a frightened piglet can dive into: beside the way home from
 *  the stand to the field (LEAD_CLUMPS), three between the field and the wallow, and the
 *  wallow's own bracken rim behind it. */
export function hideClumps(): (Spot & { size: number })[] {
  const out: (Spot & { size: number })[] = [];
  const a = coverApproach, f = fieldApproach;
  // beside the way home (never on it)
  const way: Frame = { x: a.x, z: a.z, heading: headingTo(a, f) };
  const len = dist(a, f);
  for (const [t, u, size] of LEAD_CLUMPS) out.push({ ...atLocal(way, u, t * len), size });
  // between the field and the wallow
  out.push({ ...atLocal(WALLOW_FRAME, -1.9, -5.3), size: 0.9 });
  out.push({ ...atLocal(WALLOW_FRAME, 3.2, -4.0), size: 0.85 });
  out.push({ ...atLocal(WALLOW_FRAME, 2.6, -1.8), size: 0.8 });
  // the wallow's rim: bracken behind the mud, away from where the ranger comes
  for (const [u, v, sz] of [[-2.4, 1.7, 1], [-0.8, 2.3, 1.1], [0.9, 2.2, 1], [2.5, 1.4, 0.9]] as const) {
    out.push({ ...atLocal(WALLOW_FRAME, u, v), size: sz });
  }
  return out;
}

/** How many of `hideClumps()` stand beside the way home (the first ones). */
export const LEAD_CLUMP_COUNT = LEAD_CLUMPS.length;

/** The fallen log at the wallow (a pig's scratching post), in the wallow frame. */
export const WALLOW_LOG = { u: 2.3, v: 0.4, turn: 1.2 } as const;

/** Who lives at the wallow, before and after (world/Residents.ts). The sow, a yearling
 *  (last year's young) and three striped piglets root there all along; the fourth piglet
 *  is lost, lying flat in the stand, until the ranger brings him home. */
const at = (u: number, v: number): Spot => atLocal(WALLOW_FRAME, u, v);
const home = (u: number, v: number, idle: 'root' | 'lie' | 'stand' = 'root', roam = 0.5) => ({ ...at(u, v), idle, roam });

/** The zoeken target (content `doel` 52, 58) on the stand: where the lost piglet lies. */
export const LOST_AT = { x: 52, y: 58 } as const;

/** A 2D trial point (0..100) on the stand, in the world: the same mapping the 3D
 *  zoeken always used (`patchLocal` over the stand's half-size), in the stand's frame. */
export function onStand(x: number, y: number): Spot {
  const { u, v } = patchLocal(x, y, STAND.halfW, STAND.halfD);
  return atLocal(STAND_FRAME, u, v);
}

/** Where the lost piglet lies in the stand, and the way he lies (side-on to the ranger
 *  arriving from the marker: his striped flank and back toward the searching eye). */
export const LOST_SPOT: Spot & { yaw: number } = { ...onStand(LOST_AT.x, LOST_AT.y), yaw: STAND_FRAME.heading + Math.PI / 2 + 0.35 };

/** The framed views of the beats (design §3.6): the lens frames a world spot from a
 *  chosen side, with the ranger in a lower corner (`include`). Shared by the script (the
 *  lens it takes) and the stand's build (the glimpse window it opens for that lens). */
export const SEARCH_VIEW = {
  at: { x: STAND_AT.x, z: STAND_AT.z }, heading: STAND_FRAME.heading + 0.42, // (he stands in a lower corner)
  halfW: 2.35, halfD: 1.7, tall: 1.05, pitchDeg: 40, insetTop: 100, insetBottom: 12,
  include: [{ x: coverApproach.x, z: coverApproach.z, h: RANGER_STAND_HEIGHT }],
} as const;
/** Where the piglet stands while the ranger watches the route: at his left, a little
 *  ahead, both of them looking over the field (in the route's picture with him). */
export const FIELD_SIDE: Spot = atLocal({ x: fieldApproach.x, z: fieldApproach.z, heading: fieldApproach.heading! }, -1.0, 0.35);
export const FIELD_VIEW = {
  at: { x: FIELD_AT.x, z: FIELD_AT.z }, heading: FIELD_FRAME.heading + 0.3,
  halfW: 3.1, halfD: 2.2, tall: 0.5, pitchDeg: 46, insetTop: 100, insetBottom: 56,
  include: [{ x: fieldApproach.x, z: fieldApproach.z, h: RANGER_STAND_HEIGHT }, { x: FIELD_SIDE.x, z: FIELD_SIDE.z, h: 0.45 }],
} as const;
export const WALLOW_VIEW = {
  at: atLocal(WALLOW_FRAME, 0.3, -1.6), heading: WALLOW_FRAME.heading - 0.38,
  halfW: 2.6, halfD: 2.3, tall: 0.95, pitchDeg: 28, insetTop: 96, insetBottom: 290,
  include: [{ x: wallowTalk.x, z: wallowTalk.z, h: RANGER_STAND_HEIGHT }],
} as const;

export const FRISLING_RESIDENTS: readonly ResidentSpec[] = [
  { key: 'sow', animal: 'wildzwijn', before: home(-0.3, 0.3, 'root', 0.6), after: home(-0.3, 0.3, 'root', 0.6),
    voice: { call: 'wildzwijn', every: [9, 15], within: 16 } },
  { key: 'yearling', animal: 'overloper', before: home(1.3, -0.9, 'root', 0.9), after: home(1.3, -0.9, 'root', 0.9) },
  { key: 'p1', animal: 'frisling', before: home(-1.3, -0.5), after: home(-1.3, -0.5) },
  { key: 'p2', animal: 'frisling', before: home(0.6, 0.9), after: home(0.6, 0.9) },
  { key: 'p3', animal: 'frisling', before: home(-1.1, 1.0, 'root', 0.4), after: home(-1.1, 1.0, 'root', 0.4) },
  // the lost one: in the stand (placed by the stand's layout, LOST_AT), home by his mother after
  { key: 'lost', animal: 'frisling', before: { x: LOST_SPOT.x, z: LOST_SPOT.z, yaw: LOST_SPOT.yaw, idle: 'lie', roam: 0 }, after: home(0.2, -0.6),
    voice: { call: 'piep', every: [4, 6], within: 22, state: 'before' } },
];

/** The frisling's home in the world. */
export const FRISLING_HOME: HomeSpec = {
  missionId: 'frisling',
  places: FRISLING_PLACES,
  residents: FRISLING_RESIDENTS,
  marker: { look: 'none' },
  // the stand lies 40 m from the wallow: the home stays drawn while he is near either
  spread: [STAND_AT],
};

/** Ground the world's heather and grass scatter leaves bare: the wallow's mud and the
 *  rooting field's patches (a tuft through turned earth reads wrong). */
export function frislingClearings(): { x: number; z: number; r: number }[] {
  return [
    { x: WALLOW_AT.x, z: WALLOW_AT.z, r: Math.max(WALLOW.halfW, WALLOW.halfD) + 0.9 },
    ...fieldSpots().map((s) => ({ x: s.x, z: s.z, r: 0.95 })),
  ];
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
