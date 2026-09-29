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
 *   marker ── (the wildwissel, ~20 m) ── the crossing: glade ◄── camera pine ──► thicket
 *                                                             (the sett, the snare)
 *
 * The views look SOUTH over the crossing (the ven, the markers and the path behind the
 * lens): `u` runs east (screen right), `v` south (away from the lens).
 */

import { RANGER_STAND_HEIGHT } from '../../AnimalScale.ts';
import { anchorInBiome } from '../../Biomes.ts';
import type { HomeSpec, Place, ResidentSpec, Spot } from '../types.ts';
import { atLocal, headingTo, type Frame } from '../places.ts';

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

/* ------------------------------------------------------------ the places ---- */

const at = (u: number, v: number): Spot => atLocal(CROSS, u, v);

/** The open glade (de open plek) at the forest edge, and the thicket (het bosje) with the
 *  badger's sett at its foot: the two places the camera can look at. */
const GLADE = at(-4.4, -2.1);
const THICKET = at(4.5, -1.5);
/** The badger's sett: at the thicket's foot, on the tree's side. */
const SETT = at(3.2, -2.25);
/** Where the empty snare lies: on the second trail where it goes into the glade (where
 *  the deer come out to graze), a few steps from the pine. The camera sees it side-on,
 *  with the glade and the open heath behind: that is the morning photo. */
const SNARE = at(-2.55, -1.35);

export const GLADE_R = 2.3;
export const THICKET_R = 1.9;

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
  /** after the photos he steps out in front of the pine onto the trail to the glade, and
   *  looks along it (the pine no longer between him and the snare) */
  valStart: { ...at(0.75, -1.05), r: 0.3, heading: headingTo(at(0.75, -1.05), at(-2.55, -1.35)) },
  glade: { ...GLADE, r: GLADE_R },
  thicket: { ...THICKET, r: THICKET_R },
  sett: { ...SETT },
  snare: { ...SNARE },
  /** where he stands to take the snare away: a step from it on the pine's side (toward
   *  the lens), facing it */
  snareApproach: { ...at(-1.75, -1.85), r: 0.8, heading: headingTo(at(-1.75, -1.85), SNARE) },
  /** the start of the wildwissel at the marker ring: he steps onto it, facing the wood */
  trailStart: { x: 14.35, z: -16.5, r: 0.3, heading: 0 },
  /** the home place: the ranger ends near it (golden step 8, missions.spec) */
  home: { ...TREE },
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
 *  (where the animals go between cover and grazing). */
export function trailB(): Spot[] {
  return [
    at(-7.4, -1.4), at(-5.6, -2.0), GLADE, at(-3.3, -1.5), SNARE, at(-1.3, -1.1), at(0, -1.0), at(1.8, -1.25), at(3.6, -1.45), THICKET, at(6.4, -0.6),
  ];
}

/* --------------------------------------------------------- who comes by ---- */

/** Where an animal the camera photographs stands in a place (and comes from, out of
 *  view): the glade's middle, or the thicket's foot; the badger at its sett's mouth.
 *  The entries lie outside the framed view (the forest beyond the glade; behind the
 *  bushes), so every animal walks in. */
export interface AimSpot { at: Spot; from: Spot; yaw: number }

export function aimSpot(animal: string, bin: 'open' | 'hol'): AimSpot {
  if (bin === 'open') {
    const spot = animal === 'nachtzwaluw' ? at(-3.9, -1.9) : animal === 'edelhert' ? at(-4.8, -1.6) : at(-4.4, -2.3);
    const from = at(-10.5, -0.6);
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
  const spot = animal === 'edelhert' ? at(5.0, -0.95) : animal === 'nachtzwaluw' ? at(3.9, -1.2) : at(4.35, -1.05);
  return { at: spot, from: at(8.4, 1.9), yaw: headingTo(spot, TREE) - 1.1 };
}

/** The four night callers round the crossing (design §4.3 beat 4): the badger at its
 *  sett, the wild boar by the bushes, the roe at the glade's edge, the nightjar on a
 *  fallen log — all four in the one view, well apart on screen. `from`: where each comes
 *  in from when night falls (the sett's mouth, behind the thicket, the forest beyond the
 *  glade, the sky). */
export const CALLER_SPOTS: Readonly<Record<string, { at: Spot; from: Spot; yaw: number }>> = {
  das: { at: at(2.0, -2.75), from: at(3.35, -2.05), yaw: VIEW_H + Math.PI - 0.6 },
  wildzwijn: { at: at(4.8, -2.7), from: at(8.4, 1.9), yaw: VIEW_H + Math.PI + 0.9 },
  ree: { at: at(-4.7, -1.0), from: at(-10.5, -0.6), yaw: VIEW_H + Math.PI - 1.2 },
  nachtzwaluw: { at: at(-1.9, -3.4), from: at(-6, -9), yaw: VIEW_H + Math.PI / 2 },
};

/** The fallen log the nightjar sits on (between the glade and the pine, near the lens). */
export const LOG = { ...at(-1.9, -3.4), turn: 0.35, h: 0.38 } as const;

/* ------------------------------------------------------------ the views ---- */

/** The camera's view over the crossing (the aim, the night callers): the glade left,
 *  the thicket right, the pine with its camera between, the ranger beside the pine. */
export const CROSS_VIEW = {
  at: at(0, -1.2), heading: VIEW_H,
  halfW: 5.0, halfD: 2.0, tall: 2.3, pitchDeg: 21, insetTop: 130, insetBottom: 200,
  include: [{ x: WILDCAMERA_PLACES.watch.x, z: WILDCAMERA_PLACES.watch.z, h: RANGER_STAND_HEIGHT }],
} as const;

/** The reunion: the crossing's own view (the pine with its camera, the glade where a roe
 *  steps in in the morning light along the trail that is safe now), with the ranger back
 *  beside his camera. */
export const REUNION_VIEW = { ...CROSS_VIEW, insetTop: 150, insetBottom: 40 } as const;

/** The snare: close by, from the side, the ranger at it (the action "Haal de val weg"). */
export const SNARE_VIEW = (() => {
  const sn = WILDCAMERA_PLACES.snare, me = WILDCAMERA_PLACES.snareApproach;
  const mid = { x: (sn.x + me.x) / 2, z: (sn.z + me.z) / 2 };
  const side = atLocal({ ...mid, heading: VIEW_H }, 1.6, -2.6); // from the lens's side: the glade behind
  return {
    at: mid, heading: headingTo(side, mid),
    halfW: 1.5, halfD: 1.2, tall: 1.4, pitchDeg: 26, insetTop: 120, insetBottom: 120,
    include: [{ x: me.x, z: me.z, h: RANGER_STAND_HEIGHT }],
  } as const;
})();

/** After the photos: from behind him on the trail in front of the pine, along it into
 *  the glade, to the snare lying on it (the follow camera takes over from there as he
 *  walks to it). */
export const VAL_VIEW = (() => {
  const from = WILDCAMERA_PLACES.valStart, sn = WILDCAMERA_PLACES.snare;
  return {
    at: { x: sn.x + (from.x - sn.x) * 0.2, z: sn.z + (from.z - sn.z) * 0.2 }, heading: headingTo(from, sn),
    halfW: 1.6, halfD: 1.4, tall: 1.0, pitchDeg: 22, insetTop: 120, insetBottom: 40,
    include: [{ x: from.x, z: from.z, h: RANGER_STAND_HEIGHT }],
  } as const;
})();

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
    halfW: 2.0, halfD: 2.4, tall: 1.2, pitchDeg: 20, insetTop: 110, insetBottom: 30,
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
  for (const p of trailA()) out.push({ x: p.x, z: p.z, r: 1.4 });
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
  for (const p of [...trailA(), ...trailB()]) out.push({ x: p.x, z: p.z, r: 0.7 });
  return out;
}

/** The camera pine, planted as a real forest tree. */
export function wildcameraTrees(): { x: number; z: number; s: number; rotY: number; species: 'prop-pine-scots' }[] {
  return [{ x: TREE.x, z: TREE.z, s: PINE.s, rotY: PINE.rotY, species: 'prop-pine-scots' }];
}

/* ------------------------------------------------------------- the home ---- */

/**
 * Who lives here: the animals the camera photographs and the night callers — a red deer
 * stag, a roe, a badger, a wild boar and a nightjar. None of them stands about in the
 * daylight (before or after): they are in the wood, and come by while the camera
 * watches, each walking (or flying) in from out of view.
 */
const nobody = (key: string, animal: string): ResidentSpec => ({ key, animal, before: null, after: null });
export const WILDCAMERA_RESIDENTS: readonly ResidentSpec[] = [
  nobody('edelhert', 'edelhert'),
  // after: the roe the camera photographed in the morning grazes in the glade
  { key: 'ree', animal: 'ree', before: null, after: { ...at(-4.6, -1.8), yaw: VIEW_H + Math.PI / 2 + 0.4, idle: 'graze', roam: 0.5 } },
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

