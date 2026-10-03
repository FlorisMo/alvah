/**
 * wildcamera.places.ts — where "De wildcamera" happens in the world, and who comes by
 * (THREE-free; `wildcamera.places.test.ts` pins it). Chosen by looking at the world
 * (design run6-missions §4.3): the open bos south-west of the marker, between the heath
 * edge (x ≈ 0) and the ven, ≥ 12 m from the ecoduct and nachtronde markers.
 *
 * Seen by a child at the marker (on the sand path, by the ven): a tree stump in the ring
 * with the camera trap lying on it, and a narrow trodden WILDWISSEL (a game trail with
 * deer, boar and badger prints) leaving the ring into the wood. It winds ~20 m south-west
 * to a CROSSING: a second game trail runs there from an OPEN GLADE (the forest edge,
 * where the deer graze) past a sturdy pine — the camera tree — to a THICKET of bramble,
 * juniper and bracken with the badger's sett at its foot (where the night animals sleep
 * by day). The camera hangs on the pine, facing the crossing.
 *
 *   marker ── (the wildwissel, ~20 m: the snare, by a foxglove and a bush) ── the crossing:
 *             glade ◄── camera pine ──► thicket (the sett)
 *
 * The views look SOUTH over the crossing (the ven, the markers and the path behind the
 * lens): `u` runs east (screen right), `v` south (away from the lens).
 */

import { RANGER_STAND_HEIGHT, SIZE } from '../../AnimalScale.ts';
import { anchorInBiome } from '../../Biomes.ts';
import type { HomeSpec, Place, ResidentSpec, Spot } from '../types.ts';
import { atLocal, dist, headingTo, stream, toward, type Frame } from '../places.ts';
import { TRUNK_OUTLINE } from '../squirrel-math.ts';

/** The wildcamera marker: the bos's first anchor (Biomes.anchorInBiome('bos', 22)). */
export const MARKER: Spot = anchorInBiome('bos', 22);

/** The camera pine at the crossing, and the way every framed view there looks (south). */
export const TREE: Spot = { x: 6.0, z: -32.0 };
export const VIEW_H = Math.PI;
/** The crossing's frame: `u` east (screen right in the views), `v` south (away). */
export const CROSS: Frame = { x: TREE.x, z: TREE.z, heading: VIEW_H };

/** The camera pine: a grown Scots pine (scale on the forest's 12.5 m), its trunk this
 *  wide at the camera's height (m, measured off the model at 0.7 m), and how high the
 *  camera hangs on it: at a child's chest, where rangers strap them. */
export const PINE = { s: 1.0, rotY: 0.6, trunkR: 0.26, camY: 0.7 } as const;

/** The camera on the trunk: its north face, toward the lens (so its lens and its red
 *  light face the child), turning on its strap to look at the glade or the thicket. */
export const CAMERA: Spot = { x: TREE.x, z: TREE.z + PINE.trunkR + 0.07 };

/** The camera pine's trunk as a click finds it (run 7): the whole trunk he sees, from just
 *  under its foot up to where its crown starts, at the model's own girth — its outline
 *  (squirrel-math TRUNK_OUTLINE: the furthest bark at each height, root flare and ridges,
 *  measured off the forest's pine) at this pine's height. A child told "Hang de camera
 *  aan de dikke boom." clicks the tree where he sees it, not only at the camera's place.
 *  `profile`: [m up from its foot, m out from its axis] for a lathe of `seg` sides, its
 *  corners pushed out so the flat sides stand on the outline (never inside the bark). */
export const PINE_PICK: { seg: number; crown: number; profile: readonly (readonly [number, number])[] } = (() => {
  const H = SIZE.den.h * PINE.s, seg = 12, out = 1 / Math.cos(Math.PI / seg);
  const rows = TRUNK_OUTLINE['prop-pine-scots'];
  const profile: [number, number][] = [[-0.3, 0]];
  for (let i = 0; i + 1 < rows.length; i++) {
    // (between two rows the larger reach, as the outline is read: never less than the bark)
    const r = Math.max(rows[i][1], rows[i + 1][1]) * H * out;
    profile.push([i === 0 ? -0.3 : rows[i][0] * H, r], [rows[i + 1][0] * H, r]);
  }
  const crown = rows[rows.length - 1][0] * H;
  profile.push([crown, 0]);
  return { seg, crown, profile };
})();

/* ------------------------------------------------------------ the places ---- */

const at = (u: number, v: number): Spot => atLocal(CROSS, u, v);

/** The open glade (de open plek) at the forest edge, and the thicket (het bosje) with the
 *  badger's sett at its foot: the two places the camera can look at. */
const GLADE = at(-4.4, -2.1);
const THICKET = at(4.5, -1.5);
/** The badger's sett: at the thicket's foot, on the tree's side. */
const SETT = at(3.2, -2.25);
/** Which way its way in faces (rad, rotation.y; the model's opening faces +z): south,
 *  into the wood, away from every view the child has of it — the model has a badger's
 *  face at its opening, and by day the badger sleeps inside. */
export const SETT_FACE = VIEW_H + 0.3;
/** Where the empty snare lies: half in the grass at the edge of the wildwissel, ~11 m up
 *  it from the crossing (the way he came in), with a foxglove and a juniper bush just
 *  beyond it. The camera on the pine looks straight up the trail and sees the man
 *  crouched there with those two beside him: that is the morning photo, and it is what
 *  the child goes looking for (from the crossing it is out of sight, in the grass). On
 *  the trail's segment (11.1, -20.4) → (12.7, -17.5), a little to its west side. */
const SNARE: Spot = { x: 11.05, z: -19.8 };
/** The two things by it the photo shows (m: a juniper, as the thicket's, and a foxglove,
 *  as the glade's): just beyond the snare as the camera and a walker from the crossing
 *  see it, one each side of the trail, so the pair reads from down the trail. */
export const SNARE_MARKS = {
  bush: { x: 10.2, z: -19.0, h: 1.35, r: 0.5, yaw: 0.9 },
  foxglove: { x: 12.25, z: -19.4, yaw: 2.1 },
} as const;

export const GLADE_R = 2.3;

/** Where the glade's animals step in from for the camera: under the trees just beyond
 *  the glade's edge, off the view's left side (the way the shy roe went, a little nearer). */
export const GLADE_ENTRY: Spot = at(-9.0, -0.8);

/** The thicket's one solid bush (its juniper; the brambles and bracken the animals walk
 *  through), and where the animals come into the thicket from, out of view: along the
 *  second trail from the east, clear of the juniper (a walk round it could stall behind
 *  it, and the camera would photograph the bush). */
export const JUNIPER = { ...at(5.9, 0.25), r: 0.7 } as const;
export const THICKET_ENTRY: Spot = at(8.6, -1.0);
export const THICKET_R = 1.9;

/** The thicket's bushes (model, height m, where, turn; `r` its footprint's half-width, m):
 *  the juniper (solid), the bramble and the bracken the animals walk through. */
export const THICKET_BUSHES: readonly { id: string; h: number; at: Spot; yaw: number; r: number }[] = [
  { id: 'prop-juniper-bush', h: 1.9, at: JUNIPER, yaw: 0.3, r: JUNIPER.r },
  { id: 'prop-bramble', h: 1.05, at: at(4.5, -0.15), yaw: 1.2, r: 0.6 },
  { id: 'prop-bramble', h: 0.95, at: at(6.9, -0.8), yaw: 2.9, r: 0.6 },
  { id: 'prop-fern', h: 1.15, at: at(3.6, 0.35), yaw: 0.8, r: 0.5 },
  { id: 'prop-fern', h: 1.0, at: at(7.3, -1.8), yaw: 2.2, r: 0.5 },
];
/** The sett's mound as it stands between the lens and what is behind it: its high front
 *  half (m; measured off the model: ~0.63 m over its north half, ~1 m across). */
export const SETT_MOUND = { h: 0.64, r: 0.55 } as const;

/** The places' names, over the glade's middle and over the thicket (m up). */
export const TAG_AT: Readonly<Record<'open' | 'hol', Spot & { y: number }>> = {
  open: { ...GLADE, y: 1.45 },
  hol: { ...at(4.8, -0.6), y: 2.35 },
};

/** The old tree stump at the thicket's front, before the sett (between it and the lens):
 *  the nightjar's perch by day (m: its height; clear of every animal's way in and out). */
export const NIGHTJAR_STUMP = { ...at(3.3, -3.95), h: 0.46, r: 0.3 } as const;

/**
 * Where the nightjar lands for the camera — it flies in, and the child must SEE it land:
 * by day in the thicket on the old stump at its front, before the sett (a raised perch
 * in the open, nothing between it and the lens; the camera on the pine sees it clear of
 * the sett); at night in the glade on the sandy game trail at its edge (nightjars sit on
 * warm sandy paths at night): a dark bird on pale sand, well away from the place's name.
 * `lift`: how high its perch holds it (m; the home measures the stump's top where it
 * lands, this is the stump's height).
 */
export const NIGHTJAR_AT: Readonly<Record<'open' | 'hol', Spot & { lift: number }>> = {
  hol: { x: NIGHTJAR_STUMP.x, z: NIGHTJAR_STUMP.z, lift: NIGHTJAR_STUMP.h },
  open: { ...at(-3.3, -1.5), lift: 0 },
};

/** The places table. */
export const WILDCAMERA_PLACES = {
  marker: { ...MARKER, r: 2.4 },
  /** the stump in the marker ring the camera lies on (a little off the ring's middle) */
  stump: { x: MARKER.x - 0.35, z: MARKER.z - 0.25 },
  /** the end of the wildwissel: he arrives at the crossing here */
  crossApproach: { ...at(0.9, -2.6), r: 1.6, heading: VIEW_H },
  /** where he stands to strap the camera on: beside the trunk's face, facing the camera */
  strap: { ...at(0.62, -0.62), r: 0.3, heading: headingTo(at(0.62, -0.62), CAMERA) },
  /** where he stands while the camera watches: beside the pine, a step back from its face */
  watch: { ...at(1.15, 0.2), r: 0.3, heading: VIEW_H },
  /** the end, handed back: a step out on the open crossing beside the wildwissel (clear
   *  of the pine, the thicket's bushes, the log and the stump), facing the glade, where the
   *  roe grazes again. Off the pine's line: the follow camera keeps the crossing's view
   *  (it looks south, over the pine), and his first step into it passes the trunk */
  handBack: { ...at(1.6, -2.4), r: 1.4, heading: headingTo(at(1.6, -2.4), GLADE) },
  glade: { ...GLADE, r: GLADE_R },
  thicket: { ...THICKET, r: THICKET_R },
  sett: { ...SETT },
  snare: { ...SNARE },
  /** where he stands to take the snare away: on the trail a step before it, coming up
   *  from the crossing, facing it (the walk ends as soon as he is near: `SNARE_FOUND`) */
  snareApproach: { ...toward(SNARE, CAMERA, 0.9), r: 1.2, heading: headingTo(toward(SNARE, CAMERA, 0.9), SNARE) },
  /** a few steps along the wildwissel out of the marker ring: he steps onto it, facing
   *  the wood (far enough from the stump that the follow camera behind him has room) */
  trailStart: { x: 12.95, z: -17.35, r: 0.3, heading: 0 },
  /** the home place: where the family lives (the roe's glade); the ranger ends near it
   *  (missions.spec) */
  home: { ...GLADE },
  /** the camera pine (the camera hangs on it after the mission) */
  pine: { ...TREE },
} as const satisfies Record<string, Place>;

/* ------------------------------------------------------------ the trails ---- */

/** The wildwissel from the marker ring to the crossing: a gently winding game trail
 *  (world points; the first leaves the ring's edge toward the wood). */
export function trailA(): Spot[] {
  const m = MARKER;
  const end = WILDCAMERA_PLACES.strap;
  return [
    { x: m.x - 0.7, z: m.z - 0.6 },
    { x: 12.7, z: -17.5 },
    { x: 11.1, z: -20.4 },
    { x: 9.9, z: -23.6 },
    { x: 8.3, z: -26.3 },
    { x: 7.0, z: -28.9 },
    { x: end.x + 0.1, z: end.z + 0.5 },
    // …and on past the pine, south into the wood
    { x: at(-0.9, 1.2).x, z: at(-0.9, 1.2).z },
    { x: at(-1.4, 3.6).x, z: at(-1.4, 3.6).z },
  ];
}

/** The second game trail: out of the glade, past the pine's face, into the thicket
 *  (where the animals go between cover and grazing). (Run 7: one line from the glade to
 *  the thicket; it used to run out to the snare up the wildwissel and back, a V of two
 *  extra trails toward the lens since the snare moved there.) */
export function trailB(): Spot[] {
  return [
    at(-7.4, -1.4), at(-5.6, -2.0), GLADE, at(-3.3, -1.5), at(-2.2, -1.25), at(-1.3, -1.1), at(0, -1.0), at(1.8, -1.25), at(3.6, -1.45), THICKET, at(6.4, -0.6),
  ];
}

/* --------------------------------------------------------- who comes by ---- */

/** Where an animal the camera photographs stands in a place (and comes from, out of
 *  view): the glade's middle, or the thicket's foot; the badger at its sett's mouth.
 *  The entries lie just outside the framed view (under the trees beyond the glade's
 *  edge; behind the bushes), so every animal walks in, and soon. */
export interface AimSpot { at: Spot; from: Spot; yaw: number; /** the nightjar: how high its perch holds it (m) */ lift?: number }

export function aimSpot(animal: string, bin: 'open' | 'hol'): AimSpot {
  if (animal === 'gaai') {
    // run 7: a jay by day on the glade's sunny patch (it hops there); with the rule turned
    // in the thicket, on top of its far bramble (its own perch, never the nightjar's stump)
    const n = JAY_AT[bin];
    return { at: { x: n.x, z: n.z }, from: bin === 'open' ? at(-10.5, -0.2) : at(10.0, -1.6), yaw: bin === 'open' ? Math.PI / 2 - 0.35 : -Math.PI / 2 + 0.35, lift: n.lift };
  }
  if (animal === 'vos') {
    // run 7: a fox by day curled up at the thicket's foot (in front of its bramble, clear of
    // the sett for the camera); with the rule turned out in the glade, by its sunny patch
    if (bin === 'open') { const spot = at(-3.95, -2.45); return { at: spot, from: GLADE_ENTRY, yaw: headingTo(spot, TREE) + 1.25 }; }
    const spot = at(4.05, -1.0);
    return { at: spot, from: THICKET_ENTRY, yaw: headingTo(spot, TREE) - 1.25 };
  }
  if (animal === 'nachtzwaluw') {
    // it flies in (from the sky beyond the glade, or over the thicket) and lands on its
    // perch: the stump over the sett, or the sandy trail in the glade
    const n = NIGHTJAR_AT[bin];
    const spot = { x: n.x, z: n.z };
    // side-on to the child's view (its long shape and tail read), turned a touch toward
    // it, its head toward the pine's side (three-quarters to the camera on the pine)
    return { at: spot, from: bin === 'open' ? at(-10.5, -0.6) : THICKET_ENTRY, yaw: bin === 'open' ? Math.PI / 2 - 0.25 : -Math.PI / 2 + 0.25, lift: n.lift };
  }
  // (a red deer, stag or hind, is the big one: it stands a little further back)
  const big = animal === 'edelhert' || animal === 'hinde';
  if (bin === 'open') {
    const spot = big ? at(-4.8, -1.6) : at(-4.4, -2.3);
    const from = GLADE_ENTRY;
    return { at: spot, from, yaw: headingTo(spot, TREE) + 1.15 };
  }
  if (animal === 'das') {
    // out of its sett onto the open ground at its side: clear of the mound for the camera
    // on the pine (a badger behind its mound is a photo of the mound) and in front of it
    // for the lens
    const out = at(2.0, -2.55);
    return { at: out, from: at(3.35, -2.05), yaw: headingTo(SETT, out) + 0.35 };
  }
  // at the thicket's foot, in front of its bushes and clear of the sett as the camera
  // sees it (an animal behind the mound would give a photo of the mound)
  const spot = big ? at(5.0, -0.95) : at(4.35, -1.05);
  return { at: spot, from: THICKET_ENTRY, yaw: headingTo(spot, TREE) - 1.1 };
}

/** The fallen log the nightjar sits on (between the glade and the pine, near the lens). */
export const LOG = { ...at(-1.9, -3.4), turn: 0.35, h: 0.38 } as const;

/* ------------------------------------------- run 7: who comes, and how ---- */

/** Which way a visitor comes onto the crossing: out of the trees beyond the glade (left),
 *  or past the thicket (right). */
export type Side = 'left' | 'right';
/** The side each place lies on. */
export const SIDE_OF: Readonly<Record<'open' | 'hol', Side>> = { open: 'left', hol: 'right' };

/** Where a visitor stops on the crossing before he aims the camera (design run 7 §6.2):
 *  it walks in and stands there side-on to the lens, so he sees it before he decides.
 *  Two each side of the pine, off the middle of the picture (the pine, the camera and the
 *  ranger are there), outside both places (a stop in the glade would already say where it
 *  goes), clear of the log, the sett, the stumps and the ranger. A visitor stops at one of
 *  its side's two: `l` on the trail left of the pine, `lf` a step nearer the lens; `r` on
 *  the trail right of the pine, `rb` a step back from it. Pinned in the places test. */
export type StopId = 'l' | 'lf' | 'r' | 'rf';
export const STOPS: Readonly<Record<StopId, Spot & { side: Side }>> = {
  l: { ...at(-2.2, -1.2), side: 'left' },
  lf: { ...at(-1.9, -2.35), side: 'left' },
  r: { ...at(2.4, -1.25), side: 'right' },
  rf: { ...at(1.8, -3.6), side: 'right' },
};
export const STOPS_OF: Readonly<Record<Side, readonly StopId[]>> = { left: ['l', 'lf'], right: ['r', 'rf'] };

/** Out of view on each side: where a visitor comes in from, and the way it comes (its
 *  in-lane): from the left past the glade's front (where the picture is narrowest: the
 *  shortest walk in), from the right between the thicket's foot and the sett. The
 *  walk-off (out-lane) of a photographed animal goes the other way round: out the back of
 *  the glade under its trees, out the back of the thicket through its bramble. So a
 *  newcomer and an animal walking off on the same side never meet. */
export const ENTRY: Readonly<Record<Side, Spot>> = { left: at(-8.9, -3.3), right: at(9.2, -2.2) };
/** The in-lane's turns to each stop (between the entry and the stop): past the glade's
 *  front, or between the thicket's foot and the sett (to the front stop on through the gap
 *  between the sett and the old stump). */
const IN_VIA: Readonly<Record<StopId, readonly Spot[]>> = {
  l: [at(-4.8, -3.65)], lf: [at(-4.8, -3.65)], r: [at(5.6, -2.05), at(4.0, -1.45)], rf: [at(5.4, -2.55), at(2.9, -3.2)],
};
export const EXIT: Readonly<Record<Side, Spot>> = { left: at(-11.2, 0.6), right: at(9.0, -0.2) };

/** A visitor's way in: from out of view on its side to its stop (world points). */
export function arrivalPath(stop: StopId): Spot[] {
  const s = STOPS[stop];
  return [ENTRY[s.side], ...IN_VIA[stop], { x: s.x, z: s.z }];
}

/** A photographed animal's way off: from where it stood to out of view on its place's
 *  side (world points); the badger by its sett goes back into it. */
export function exitPath(bin: 'open' | 'hol', from: Spot, animal = ''): Spot[] {
  if (animal === 'das' && bin === 'hol') return [{ x: from.x, z: from.z }, aimSpot('das', 'hol').from];
  return [{ x: from.x, z: from.z }, EXIT[SIDE_OF[bin]]];
}

/** A bird's flight in and out: from the sky beyond its side (m up), and away again. */
export const SKY: Readonly<Record<Side, Spot & { y: number }>> = {
  left: { ...at(-10.5, -0.4), y: 3.4 },
  right: { ...at(10.0, -1.4), y: 3.4 },
};

/** The jay (run 7: a day bird): by day it hops on the glade's sunny patch; with the rule
 *  turned it hops on the trodden ground at the thicket's foot, in front of its bramble
 *  (jays feed on the ground under the bushes; the nightjar keeps the old stump). On the
 *  ground the camera on the pine sees it whole: on top of a bramble the leaves hid it. */
export const JAY_AT: Readonly<Record<'open' | 'hol', Spot & { lift: number }>> = {
  open: { ...at(-4.15, -1.85), lift: 0 },
  hol: { ...at(4.45, -1.35), lift: 0 },
};

/**
 * The night choir's spots (run 7, design §6.4): eight places round the crossing, each
 * with the animals that may call from it — the badger beside its sett (left or right of
 * the mound), the nightjar on the fallen log or on the old stump, the walkers (the roe,
 * the boar, the fox) at the glade's back edge or in front of it, by the bushes or in front of the
 * juniper. `from`: where it walks (or flies) in from. A night's layout puts its four
 * callers in four of them; two spots too near each other on the screen are never used
 * in one night (`SLOT_CLASH`, pinned with the lens in the places test).
 */
export type SlotId = 'sett-l' | 'sett-r' | 'log' | 'stump' | 'glade-edge' | 'glade-front' | 'bushes' | 'juniper';
export interface CallerSlot { id: SlotId; at: Spot; from: Spot & { y?: number }; animals: readonly string[]; yaw: number; lift?: number }
const WALKERS = ['ree', 'wildzwijn', 'vos'] as const;
const SETT_MOUTH = at(3.35, -2.05);
export const CALLER_SLOTS: Readonly<Record<SlotId, CallerSlot>> = {
  'sett-l': { id: 'sett-l', at: at(2.0, -2.75), from: SETT_MOUTH, animals: ['das'], yaw: VIEW_H + Math.PI - 0.6 },
  'sett-r': { id: 'sett-r', at: at(4.3, -2.75), from: SETT_MOUTH, animals: ['das'], yaw: VIEW_H + Math.PI + 0.7 },
  log: { id: 'log', at: { x: LOG.x, z: LOG.z }, from: { ...at(-6, -9), y: 4 }, animals: ['nachtzwaluw'], yaw: VIEW_H + Math.PI / 2, lift: LOG.h * 0.9 },
  stump: { id: 'stump', at: { x: NIGHTJAR_STUMP.x, z: NIGHTJAR_STUMP.z }, from: { ...at(9, -8), y: 4 }, animals: ['nachtzwaluw'], yaw: -Math.PI / 2 + 0.25, lift: NIGHTJAR_STUMP.h },
  'glade-edge': { id: 'glade-edge', at: at(-4.7, -1.0), from: at(-10.5, -0.6), animals: WALKERS, yaw: VIEW_H + Math.PI - 1.2 },
  'glade-front': { id: 'glade-front', at: at(-3.3, -4.2), from: at(-10.5, -4.4), animals: WALKERS, yaw: VIEW_H + Math.PI - 1.45 },
  bushes: { id: 'bushes', at: at(4.8, -2.7), from: at(9.2, -2.2), animals: WALKERS, yaw: VIEW_H + Math.PI + 0.9 },
  juniper: { id: 'juniper', at: at(5.2, -0.9), from: at(9.4, -1.1), animals: WALKERS, yaw: VIEW_H + Math.PI + 1.15 },
};
export const SLOT_IDS = Object.keys(CALLER_SLOTS) as SlotId[];
/** Two spots never used in one night: too near each other on the screen (< 120 px at
 *  1280×800) or in the world (< 1.6 m), or one hiding a small animal behind the other from
 *  the lens (a fox at the juniper behind a roe by the bushes). The view test measures every
 *  other pair in every night the drawer can make. */
export const SLOT_CLASH: readonly (readonly [SlotId, SlotId])[] = [
  ['sett-r', 'bushes'], ['sett-r', 'stump'], ['bushes', 'stump'], ['stump', 'juniper'], ['bushes', 'juniper'], ['sett-r', 'juniper'],
];

/* ------------------------------------- run 7 (wc-album): the fox with her cubs ---- */

/**
 * The fox family's way (wc-album: a rare night, after the echo): out of the trees on one
 * side, along the second trail across the crossing in front of the pine, into the trees on
 * the other side — side-on to the lens all the way, between the night choir's spots (clear
 * of every one of them, of the sett, the log and the stumps, and of the ranger beside the
 * pine), so the callers watch them pass. Local points, west to east; the first and the
 * last lie out of the picture. Pinned in the view test.
 */
const FAMILY_WAY: readonly Spot[] = [
  at(-10.6, -1.5), at(-6.2, -1.9), at(-4.0, -2.2), at(-2.0, -1.65), at(0, -1.3), at(1.8, -1.4), at(3.4, -1.3),
  at(4.85, -1.85), at(6.6, -1.6), at(9.9, -1.25),
];

/** The family's way from side `from` (world points, out of view to out of view). */
export function familyPath(from: Side): Spot[] {
  return from === 'left' ? [...FAMILY_WAY] : [...FAMILY_WAY].reverse();
}

/** Where the camera on the pine photographs the family: right in front of it, where their
 *  way crosses its view side-on (a trail camera's photo of animals passing close by: all
 *  three side by side, never one behind the other). The middle of the photo; the shutter
 *  clicks as the first cub passes it (its mother a step ahead, the second cub a step
 *  behind), and how much of the wood the photo frames there (m of height at 1 m). */
export const FAMILY_SHOT: Spot & { frameH: number } = { ...at(0, -1.3), frameH: 1.1 };

/** The cubs trail their mother by this far along her way (m): close, a tumble behind. */
export const CUB_LAG: readonly [number, number] = [0.62, 1.2];

/** The white roe's way off after her photo (wc-album: a rare morning): back in under the
 *  trees beyond the glade, out of the picture (the ordinary roe of the glade comes back
 *  from there once the mission is done). */
export const WHITE_ROE_OUT: Spot = at(-10.8, 0.2);

/* ------------------------------------------------------------ the views ---- */

/** The camera's view over the crossing (the aim, the night callers): the glade left,
 *  the thicket right, the pine with its camera between, the ranger beside the pine. */
export const CROSS_VIEW = {
  at: at(0, -1.2), heading: VIEW_H,
  halfW: 5.0, halfD: 2.0, tall: 2.3, pitchDeg: 21, insetTop: 130, insetBottom: 200,
  include: [{ x: WILDCAMERA_PLACES.watch.x, z: WILDCAMERA_PLACES.watch.z, h: RANGER_STAND_HEIGHT }],
} as const;

/** The reunion: the crossing's own view (the pine with its camera, the glade where a roe
 *  steps in in the morning light), with the ranger back from the snare, a step out on the
 *  open crossing (where he is handed back). */
export const REUNION_VIEW = {
  ...CROSS_VIEW, insetTop: 150, insetBottom: 40,
  include: [{ x: WILDCAMERA_PLACES.handBack.x, z: WILDCAMERA_PLACES.handBack.z, h: RANGER_STAND_HEIGHT }],
} as const;

/** He has found the snare when he comes this near it (m): he sees it in the grass there. */
export const SNARE_FOUND = 2.3;

/* ------------------------------------------ run 7 (wc-hands): the snare's spots ---- */

/**
 * The deer trail C (run 7): a narrow trodden trail out of the glade's north edge, north
 * under the trees, then east along the wood to join the wildwissel. Two of the snare's
 * spots lie by it. North of the pine on purpose: the morning photo is taken by the camera
 * on the pine's NORTH face (a spot south of it is behind its own trunk); west of the glade
 * is the reekalf's ground, east of the thicket the ecoduct and nachtronde markers.
 */
export function trailC(): Spot[] {
  return [
    { x: 1.5, z: -27.6 }, { x: 1.15, z: -25.6 }, { x: 0.85, z: -23.6 }, { x: 0.75, z: -21.9 }, { x: 1.3, z: -20.65 },
    { x: 2.7, z: -20.2 }, { x: 4.0, z: -20.75 }, { x: 3.9, z: -22.6 }, { x: 4.6, z: -23.7 }, { x: 6.3, z: -23.95 },
    { x: 7.9, z: -24.0 }, { x: 9.9, z: -23.6 },
  ];
}

/** Which of the three spots the man set his snare at this play. */
export type SnareId = 'S1' | 'S2' | 'S3';
export const SNARE_IDS: readonly SnareId[] = ['S1', 'S2', 'S3'];

/** A thing that always stands by a snare spot (the photo shows two): its model, where,
 *  how tall (m), its footprint's half-width (m), its turn; `solid` = the ranger walks
 *  round it. (Each is a home plant, the birch too.) */
export interface SnareMark {
  model: 'prop-juniper-bush' | 'prop-foxglove' | 'prop-birch-tree' | 'prop-boulder' | 'prop-fallen-log' | 'prop-fern';
  at: Spot; h: number; r: number; yaw: number; solid?: boolean;
}

/** A framed view of a world spot (the kit's FrameSpec, THREE-free). */
export interface SnareView {
  at: Spot; heading: number; halfW: number; halfD: number; tall: number; pitchDeg: number; insetTop: number; insetBottom: number;
  include: readonly { x: number; z: number; h: number }[];
}

/** One spot the snare may lie at: the wire loop (and its turn), where he stands to take it
 *  away (a step before it on the camera's side, facing it), its two landmarks, and the
 *  close view of it there. */
export interface SnareSpot { id: SnareId; at: Spot; yaw: number; approach: Place; marks: readonly [SnareMark, SnareMark]; view: SnareView }

/** A spot `v` m beyond `s` as the camera on the pine sees it, `u` m to its right. */
function past(s: Spot, u: number, v: number): Spot {
  return atLocal({ x: s.x, z: s.z, heading: headingTo(CAMERA, s) }, u, v);
}

/** The close view of a snare: from his side, looking across his last step to it (the
 *  wire loop a little off the picture's middle, him at the edge, the landmarks behind).
 *  `turn`: how far round from his way the lens looks (rad, − from his right side). */
function snareViewOf(at: Spot, me: Spot, turn: number, halfW = 1.5): SnareView {
  // (centred a little nearer him than half way: the wire lies well off the picture's middle)
  const mid = toward({ x: (at.x + me.x) / 2, z: (at.z + me.z) / 2 }, me, 0.4);
  return {
    at: mid, heading: headingTo(me, at) + turn,
    halfW, halfD: 1.2, tall: 1.4, pitchDeg: 26, insetTop: 120, insetBottom: 120,
    include: [{ x: me.x, z: me.z, h: RANGER_STAND_HEIGHT }],
  };
}

const approachOfSnare = (at: Spot): Place => {
  const p = toward(at, CAMERA, 0.9);
  return { ...p, r: 1.2, heading: headingTo(p, at) };
};

/**
 * The snare's three spots (run 7, wc-hands; design state/wildcamera §4): each the man's
 * place on one play, each with its own two landmarks that ALWAYS stand there (only the
 * snare comes and goes), on three different bearings from the camera (the morning photo
 * of one never shows another's landmarks):
 *   S1 up the wildwissel he walked in on, a juniper and a foxglove (run 6's spot);
 *   S2 on deer trail C north of the glade, a birch and a big stone;
 *   S3 on trail C just north of the crossing, a fallen log and a fern.
 * Each lies half in the grass at its trail's edge; the landmarks stand just beyond it as
 * the camera sees it, one each side. Pinned in the places test (by looking: 2026-10-03).
 */
export const SNARE_SPOTS: Readonly<Record<SnareId, SnareSpot>> = (() => {
  const s2 = { x: 1.92, z: -20.67 }, s3 = { x: 6.32, z: -23.61 };
  const fox = SIZE.vingerhoedskruid.h * 0.85;
  const out: Record<SnareId, SnareSpot> = {
    S1: {
      id: 'S1', at: { ...SNARE }, yaw: 0.7, approach: { ...WILDCAMERA_PLACES.snareApproach },
      marks: [
        { model: 'prop-juniper-bush', at: { x: SNARE_MARKS.bush.x, z: SNARE_MARKS.bush.z }, h: SNARE_MARKS.bush.h, r: SNARE_MARKS.bush.r, yaw: SNARE_MARKS.bush.yaw, solid: true },
        { model: 'prop-foxglove', at: { x: SNARE_MARKS.foxglove.x, z: SNARE_MARKS.foxglove.z }, h: fox, r: 0.15, yaw: SNARE_MARKS.foxglove.yaw },
      ],
      view: snareViewOf(SNARE, WILDCAMERA_PLACES.snareApproach, -1.54),
    },
    S2: {
      id: 'S2', at: s2, yaw: 2.2, approach: approachOfSnare(s2),
      marks: [
        // (a young birch: its white trunk whole in the morning photo, never the dark foot of
        // a grown one; a home plant, so the forest never fades it to a dark ghost)
        { model: 'prop-birch-tree', at: past(s2, -0.85, 1.15), h: 3.6, r: 0.2, yaw: 1.3 },
        { model: 'prop-boulder', at: past(s2, 0.95, 1.05), h: 0.62, r: 0.45, yaw: 0.4, solid: true },
      ],
      view: snareViewOf(s2, approachOfSnare(s2), -1.5, 1.7),
    },
    S3: {
      id: 'S3', at: s3, yaw: -0.4, approach: approachOfSnare(s3),
      marks: [
        // (lying across the camera's line: its long side in the photo, never end-on)
        { model: 'prop-fallen-log', at: past(s3, -0.95, 1.1), h: 0.44, r: 0.75, yaw: headingTo(CAMERA, s3) + 0.3, solid: true },
        { model: 'prop-fern', at: past(s3, 1.0, 1.15), h: 1.1, r: 0.45, yaw: 2.6 },
      ],
      view: snareViewOf(s3, approachOfSnare(s3), -1.5, 1.7),
    },
  };
  return out;
})();

/**
 * Where he walks in front of the camera to test it (run 7, wc-hands): out on the crossing
 * ~2.5 m in front of the lens, clear of the log, the stump and the sett. The camera on the
 * pine takes his photo once he is inside its fan (`inFan`).
 */
export const TEST_SPOT: Place = { x: CAMERA.x, z: CAMERA.z + 2.5, r: 0.9 };

/** He is inside the camera's fan of view (it looks along `heading`, the trunk's north face
 *  by default): within FAN_HALF of its straight-ahead, 1.6-4 m from it (nearer, its photo
 *  of him would be his jacket only). */
export function inFan(p: Spot, heading = 0): boolean {
  const d = dist(CAMERA, p);
  if (d < 1.6 || d > 4) return false;
  let a = headingTo(CAMERA, p) - heading;
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return Math.abs(a) < FAN_HALF;
}

/** The test (run 7): from behind him as he stands at the trunk, turned to the crossing,
 *  looking over the camera's fan of ground to the spot in front of it — the lens the
 *  follow camera takes over from (so the Up key walks him into the fan, never back round
 *  the trunk). */
export const TEST_VIEW = (() => {
  const me = at(0.62, -0.62);
  return {
    at: { x: (me.x + TEST_SPOT.x) / 2, z: (me.z + TEST_SPOT.z) / 2 }, heading: headingTo(me, TEST_SPOT),
    halfW: 2.2, halfD: 1.6, tall: 1.5, pitchDeg: 20, insetTop: 110, insetBottom: 60,
    include: [{ x: me.x, z: me.z, h: RANGER_STAND_HEIGHT }],
  } as const;
})();

/** The search's start (run 7): from behind him on the open crossing, turned to the wood
 *  north of it where the man's three spots lie (up the wildwissel, the deer trail): the
 *  lens the follow camera takes over from, so the place on the photo is in front of him and
 *  the Up key walks him toward it (never one spot more than another: all three are ahead). */
export const SEARCH_VIEW = (() => {
  const me = at(1.6, -2.4);
  const ahead = { x: me.x - 0.6, z: me.z + 3.2 };
  return {
    at: ahead, heading: headingTo(me, ahead),
    halfW: 3.0, halfD: 2.4, tall: 1.6, pitchDeg: 14, insetTop: 260, insetBottom: 60,
    include: [{ x: me.x, z: me.z, h: RANGER_STAND_HEIGHT }],
  } as const;
})();

/** The way back (run 7): from behind him where he took the snare away, turned to his
 *  camera on the pine: the lens the follow camera takes over from, so the Up key walks him
 *  home (the snare's own close view looks at him from the side). */
export function walkBackView(me: Spot): SnareView {
  const home = WILDCAMERA_PLACES.handBack;
  const ahead = toward(me, home, Math.min(2.4, dist(me, home) * 0.4));
  return {
    at: ahead, heading: headingTo(me, home),
    halfW: 2.4, halfD: 1.8, tall: 1.6, pitchDeg: 16, insetTop: 120, insetBottom: 60,
    include: [{ x: me.x, z: me.z, h: RANGER_STAND_HEIGHT }],
  };
}

/** A tuft of grass round a snare (m: where, how tall, its turn). */
export interface Tuft extends Spot { h: number; turn: number }

/** The grass a snare lies half in (run 7: pure, so the places test pins it): 16 tufts
 *  round the wire, never on it, thickest behind and beside it; the few on the side he
 *  comes from (the camera's side) kept low, so the wire loop shows between them from
 *  close by, never from far. (S1's are run 6's tufts.) */
export function snareTufts(sp: SnareSpot): Tuft[] {
  const rt = stream(53 + SNARE_IDS.indexOf(sp.id) * 11);
  const toMe = headingTo(sp.at, sp.approach);
  const out: Tuft[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rt() * 0.3;
    const rr = 0.2 + rt() * 0.28;
    const front = Math.cos(a - toMe); // 1: between the snare and the way he comes
    const h = (front > 0.55 ? 0.16 : 0.3) + rt() * 0.12;
    out.push({ x: sp.at.x + Math.sin(a) * rr, z: sp.at.z + Math.cos(a) * rr, h, turn: rt() * 6.28 });
  }
  return out;
}

/** Strapping the camera on: close, low, from the north-west — the camera on the trunk's
 *  face, the ranger at its side. */
export const STRAP_VIEW = {
  at: { x: CAMERA.x + 0.2, z: CAMERA.z + 0.1 }, heading: headingTo({ x: CAMERA.x - 2.4, z: CAMERA.z + 2.6 }, CAMERA),
  halfW: 1.0, halfD: 0.7, tall: 1.5, pitchDeg: 14, insetTop: 130, insetBottom: 60,
  include: [{ x: at(0.62, -0.62).x, z: at(0.62, -0.62).z, h: RANGER_STAND_HEIGHT }],
} as const;

/** The start: from behind the ranger at the ring's edge, along the wildwissel into the
 *  wood (the follow camera takes over from there, looking the way he goes). */
export const TRAIL_VIEW = (() => {
  const t = trailA();
  const from = WILDCAMERA_PLACES.trailStart;
  return {
    at: { x: (t[1].x + t[2].x) / 2, z: (t[1].z + t[2].z) / 2 }, heading: headingTo(from, t[2]),
    // (as far back and as high as the follow camera stands, so its hand-over is calm)
    halfW: 3.0, halfD: 3.4, tall: 1.4, pitchDeg: 17, insetTop: 110, insetBottom: 60,
    include: [{ x: from.x, z: from.z, h: RANGER_STAND_HEIGHT }],
  } as const;
})();

/* ---------------------------------------------------------- the ground ---- */

/** Ground the forest's scattered trees keep clear of: the glade, the thicket (its own
 *  bushes), the crossing, the view's corridor, and the wildwissel itself. */
export function wildcameraTreeClearings(): { x: number; z: number; r: number }[] {
  const out = [
    { ...GLADE, r: 4.2 },
    { ...THICKET, r: 3.4 },
    { ...TREE, r: 3.6 },
    { ...at(0.4, -4.2), r: 3.4 },
    { ...at(0.5, -7.2), r: 2.6 },
  ];
  // run 7: the snare's three spots with their landmarks, and the camera's line to each (no
  // forest tree between the lens on the pine and the man in the morning photo)
  for (const id of SNARE_IDS) {
    const sp = SNARE_SPOTS[id];
    out.push({ ...sp.at, r: 2.4 });
    const d = dist(CAMERA, sp.at), n = Math.ceil(d / 0.9);
    for (let i = 1; i < n; i++) out.push({ ...toward(CAMERA, sp.at, (i / n) * d), r: 1.3 });
  }
  for (const p of [...trailA(), ...trailC()]) out.push({ x: p.x, z: p.z, r: 1.4 });
  return out;
}

/** Ground the heath/fern scatter leaves bare: the glade's middle (its own grass and
 *  flowers), the thicket's footprint, the crossing's trodden ground, the trails. */
export function wildcameraClearings(): { x: number; z: number; r: number }[] {
  const out = [
    { ...GLADE, r: GLADE_R + 0.4 },
    { ...THICKET, r: THICKET_R + 0.5 },
    { ...at(0.3, -0.9), r: 1.8 },
  ];
  for (const p of [...trailA(), ...trailB(), ...trailC()]) out.push({ x: p.x, z: p.z, r: 0.7 });
  // each snare spot (its own grass) and the camera's line to it (no bracken between the
  // lens and the man in the morning photo)
  for (const id of SNARE_IDS) {
    const sp = SNARE_SPOTS[id];
    out.push({ ...sp.at, r: 1.6 });
    const d = dist(CAMERA, sp.at), n = Math.ceil(d / 0.8);
    for (let i = 1; i < n; i++) out.push({ ...toward(CAMERA, sp.at, (i / n) * d), r: 0.6 });
  }
  return out;
}

/** The camera pine, planted as a real forest tree (the snare spots' landmarks are home
 *  plants: the forest would fade a tree of its own to a see-through ghost). */
export function wildcameraTrees(): { x: number; z: number; s: number; rotY: number; species: 'prop-pine-scots' }[] {
  return [{ x: TREE.x, z: TREE.z, s: PINE.s, rotY: PINE.rotY, species: 'prop-pine-scots' }];
}

/* ------------------------------------------------------------- the home ---- */

/** Where the roe grazes in the glade (before the mission, and again after it). */
const ROE_GRAZE = { ...at(-4.6, -1.8), yaw: VIEW_H + Math.PI / 2 + 0.4, idle: 'graze', roam: 0.5 } as const;
/** Where the shy roe slips off to when the ranger comes along the game trail: in under
 *  the trees beyond the glade, the way the glade's animals come and go (out of the
 *  camera's view over the crossing; she comes back from there for the photos). */
export const ROE_HIDEAWAY: Spot & { yaw: number } = { ...at(-10.5, -0.6), yaw: VIEW_H - Math.PI / 2 };
/** How near the ranger comes before the grazing roe lifts her head and goes (m): on the
 *  game trail a few steps before the crossing, but never from the reekalf's hide ~9.7 m
 *  west of her (ree.places.ts), so she stays grazing while he watches the doe there and
 *  never walks off toward him through the glasses. */
export const ROE_SHY_WITHIN = 8.8;

/**
 * Who lives here: the animals the camera photographs and the night callers — a red deer
 * stag, a roe, a badger, a wild boar and a nightjar. The roe grazes in the glade (the
 * deer's place: the child sees her from the game trail, and she slips off into the wood
 * as he comes — who comes back when nobody is there is what the camera is for); the
 * badger sleeps in its sett by day; the stag, the boar and the nightjar are out in the
 * wood. None of them pops up: each walks (or flies) in. After, the roe grazes in the
 * glade again.
 */
const nobody = (key: string, animal: string): ResidentSpec => ({ key, animal, before: null, after: null });
export const WILDCAMERA_RESIDENTS: readonly ResidentSpec[] = [
  nobody('edelhert', 'edelhert'),
  // run 7: the evening's other visitors (out in the wood until they come)
  nobody('hinde', 'hinde'),
  nobody('vos', 'vos'),
  { key: 'ree', animal: 'ree', before: ROE_GRAZE, after: ROE_GRAZE,
    // (in free roam before the mission, too: she steps in under the trees when he comes)
    shy: [{ within: ROE_SHY_WITHIN, back: ROE_SHY_WITHIN + 5, to: { ...at(-8.6, -0.9), yaw: ROE_HIDEAWAY.yaw }, state: 'before' }] },
  nobody('das', 'das'),
  nobody('wildzwijn', 'wildzwijn'),
];

export const WILDCAMERA_HOME: HomeSpec = {
  missionId: 'wildcamera',
  places: WILDCAMERA_PLACES,
  residents: WILDCAMERA_RESIDENTS,
  marker: { look: 'none' },
};

/** Where the camera looks for each place (the ground its fan of view is laid round): the
 *  glade's middle; the thicket's foot between the badger's side of its sett and the
 *  bushes the deer and the boar stand in. */
export const AIM_AT: Readonly<Record<'open' | 'hol', Spot>> = { open: GLADE, hol: at(3.8, -2.3) };

/** Half the camera's angle of view (rad): the fan it shows on the ground, and every
 *  animal it photographs in a place stands inside it (a trail camera sees ~50°). */
export const FAN_HALF = 0.46;

/** The camera's heading to look at a spot (rad, the World's rotation.y convention). */
export function cameraAim(p: Spot): number {
  return headingTo(CAMERA, p);
}

/** How far the lens of a place is off the camera's straight-ahead (its trunk face): the
 *  swivel a look at the glade or the thicket needs (rad). */
export function swivel(p: Spot): number {
  const face = 0; // the trunk's north face looks north (heading 0)
  let d = cameraAim(p) - face;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

