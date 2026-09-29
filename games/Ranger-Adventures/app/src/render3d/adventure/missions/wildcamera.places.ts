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
/** Where the empty snare lies: on the wildwissel he came in on, a few steps from the
 *  pine — where the camera looks when it rests (north, along the trail). */
const SNARE = { x: 7.3, z: -28.3 };

export const GLADE_R = 2.3;
export const THICKET_R = 1.9;

/** The places table. */
export const WILDCAMERA_PLACES = {
  marker: { ...MARKER, r: 2.4 },
  /** the stump in the marker ring the camera lies on (a little off the ring's middle) */
  stump: { x: MARKER.x - 0.35, z: MARKER.z - 0.25 },
  /** the end of the wildwissel: he arrives at the crossing here */
  crossApproach: { ...at(0.9, -2.6), r: 1.6, heading: VIEW_H },
  /** where he stands to strap the camera on (facing the trunk) */
  strap: { ...at(0, -0.85), r: 0.3, heading: VIEW_H },
  /** where he stands while the camera watches: beside the pine, a step back from its face */
  watch: { ...at(1.15, 0.2), r: 0.3, heading: VIEW_H },
  glade: { ...GLADE, r: GLADE_R },
  thicket: { ...THICKET, r: THICKET_R },
  sett: { ...SETT },
  snare: { ...SNARE },
  /** where he stands to take the snare away: a step up the trail from it, facing it */
  snareApproach: { x: 7.85, z: -27.3, r: 0.9, heading: Math.atan2(7.3 - 7.85, -28.3 + 27.3) },
  /** the start of the wildwissel at the marker ring: he steps onto it, facing the wood */
  trailStart: { x: MARKER.x - 1.25, z: MARKER.z - 1.2, r: 0.3, heading: 0 },
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
    { x: 13.2, z: -18.4 },
    { x: 11.3, z: -21.5 },
    { x: 9.9, z: -24.3 },
    { x: 8.2, z: -26.6 },
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
    at(-7.4, -1.4), at(-5.6, -2.0), GLADE, at(-2.2, -1.25), at(0, -1.0), SNARE, at(3.6, -1.45), THICKET, at(6.4, -0.6),
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
    const mouth = at(3.0, -2.75);
    return { at: mouth, from: at(3.35, -2.05), yaw: headingTo(SETT, mouth) };
  }
  const spot = animal === 'edelhert' ? at(5.1, -1.3) : animal === 'nachtzwaluw' ? at(4.0, -2.35) : at(4.5, -2.25);
  return { at: spot, from: at(8.6, 2.2), yaw: headingTo(spot, TREE) - 1.1 };
}

/** The four night callers round the crossing (design §4.3 beat 4): the badger at its
 *  sett, the wild boar by the bushes, the roe at the glade's edge, the nightjar on a
 *  fallen log — all four in the one view, well apart on screen. `from`: where each comes
 *  in from when night falls (the sett's mouth, behind the thicket, the forest beyond the
 *  glade, the sky). */
export const CALLER_SPOTS: Readonly<Record<string, { at: Spot; from: Spot; yaw: number }>> = {
  das: { at: at(2.7, -2.9), from: at(3.35, -2.05), yaw: VIEW_H + Math.PI - 0.6 },
  wildzwijn: { at: at(5.4, -2.6), from: at(8.6, 1.6), yaw: VIEW_H + Math.PI + 0.9 },
  ree: { at: at(-5.3, -1.1), from: at(-10.5, -0.6), yaw: VIEW_H + Math.PI - 1.2 },
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
 *  steps in in the morning light), with the ranger where he took the snare away. */
export const REUNION_VIEW = {
  ...CROSS_VIEW, insetTop: 150, insetBottom: 40,
  include: [{ x: WILDCAMERA_PLACES.snareApproach.x, z: WILDCAMERA_PLACES.snareApproach.z, h: RANGER_STAND_HEIGHT }],
} as const;

/** The start: from behind the ranger at the ring's edge, along the wildwissel into the
 *  wood (the follow camera takes over from there, looking the way he goes). */
export const TRAIL_VIEW = (() => {
  const t = trailA();
  const from = WILDCAMERA_PLACES.trailStart;
  return {
    at: t[2], heading: headingTo(from, t[2]),
    halfW: 2.2, halfD: 3.0, tall: 1.2, pitchDeg: 22, insetTop: 110, insetBottom: 30,
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

