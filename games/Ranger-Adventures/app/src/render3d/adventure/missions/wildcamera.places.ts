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

import { RANGER_STAND_HEIGHT } from '../../AnimalScale.ts';
import { anchorInBiome } from '../../Biomes.ts';
import type { HomeSpec, Place, ResidentSpec, Spot } from '../types.ts';
import { atLocal, headingTo, toward, type Frame } from '../places.ts';

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
  /** the end, handed back: a step out on the open crossing (clear of the pine and the
   *  thicket's bushes), facing the glade, where the roe grazes again */
  handBack: { ...at(0.8, -2.4), r: 1.4, heading: headingTo(at(0.8, -2.4), GLADE) },
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
 *  (where the animals go between cover and grazing). */
export function trailB(): Spot[] {
  return [
    at(-7.4, -1.4), at(-5.6, -2.0), GLADE, at(-3.3, -1.5), SNARE, at(-1.3, -1.1), at(0, -1.0), at(1.8, -1.25), at(3.6, -1.45), THICKET, at(6.4, -0.6),
  ];
}

/* --------------------------------------------------------- who comes by ---- */

/** Where an animal the camera photographs stands in a place (and comes from, out of
 *  view): the glade's middle, or the thicket's foot; the badger at its sett's mouth.
 *  The entries lie just outside the framed view (under the trees beyond the glade's
 *  edge; behind the bushes), so every animal walks in, and soon. */
export interface AimSpot { at: Spot; from: Spot; yaw: number; /** the nightjar: how high its perch holds it (m) */ lift?: number }

export function aimSpot(animal: string, bin: 'open' | 'hol'): AimSpot {
  if (animal === 'nachtzwaluw') {
    // it flies in (from the sky beyond the glade, or over the thicket) and lands on its
    // perch: the stump over the sett, or the sandy trail in the glade
    const n = NIGHTJAR_AT[bin];
    const spot = { x: n.x, z: n.z };
    // side-on to the child's view (its long shape and tail read), turned a touch toward
    // it, its head toward the pine's side (three-quarters to the camera on the pine)
    return { at: spot, from: bin === 'open' ? at(-10.5, -0.6) : THICKET_ENTRY, yaw: bin === 'open' ? Math.PI / 2 - 0.25 : -Math.PI / 2 + 0.25, lift: n.lift };
  }
  if (bin === 'open') {
    const spot = animal === 'edelhert' ? at(-4.8, -1.6) : at(-4.4, -2.3);
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
  const spot = animal === 'edelhert' ? at(5.0, -0.95) : at(4.35, -1.05);
  return { at: spot, from: THICKET_ENTRY, yaw: headingTo(spot, TREE) - 1.1 };
}

/** The four night callers round the crossing (design §4.3 beat 4): the badger at its
 *  sett, the wild boar by the bushes, the roe at the glade's edge, the nightjar on a
 *  fallen log — all four in the one view, well apart on screen. `from`: where each comes
 *  in from when night falls (the sett's mouth, behind the thicket, the forest beyond the
 *  glade, the sky). */
export const CALLER_SPOTS: Readonly<Record<string, { at: Spot; from: Spot; yaw: number }>> = {
  das: { at: at(2.0, -2.75), from: at(3.35, -2.05), yaw: VIEW_H + Math.PI - 0.6 },
  wildzwijn: { at: at(4.8, -2.7), from: THICKET_ENTRY, yaw: VIEW_H + Math.PI + 0.9 },
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
 *  steps in in the morning light), with the ranger back from the snare, a step out on the
 *  open crossing (where he is handed back). */
export const REUNION_VIEW = {
  ...CROSS_VIEW, insetTop: 150, insetBottom: 40,
  include: [{ x: WILDCAMERA_PLACES.handBack.x, z: WILDCAMERA_PLACES.handBack.z, h: RANGER_STAND_HEIGHT }],
} as const;

/** He has found the snare when he comes this near it (m): he sees it in the grass there. */
export const SNARE_FOUND = 2.3;

/** The snare: close by, from the side, the ranger at it (the action "Haal de val weg"):
 *  from the trail's east side, looking across it (the foxglove and the bush beside it). */
export const SNARE_VIEW = (() => {
  const sn = WILDCAMERA_PLACES.snare, me = WILDCAMERA_PLACES.snareApproach;
  const mid = { x: (sn.x + me.x) / 2, z: (sn.z + me.z) / 2 };
  const side = { x: mid.x + 2.4, z: mid.z - 1.1 };
  return {
    at: mid, heading: headingTo(side, mid),
    halfW: 1.5, halfD: 1.2, tall: 1.4, pitchDeg: 26, insetTop: 120, insetBottom: 120,
    include: [{ x: me.x, z: me.z, h: RANGER_STAND_HEIGHT }],
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
    // the snare's spot with its bush and foxglove
    { ...SNARE, r: 2.4 },
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
    // the snare's spot (its own grass) and the camera's line up the trail to it (no
    // bracken between the lens and the man in the morning photo)
    { ...SNARE, r: 1.6 },
  ];
  for (const p of [...trailA(), ...trailB()]) out.push({ x: p.x, z: p.z, r: 0.7 });
  for (let i = 1; i < 8; i++) out.push({ ...toward(CAMERA, SNARE, (i / 8) * Math.hypot(SNARE.x - CAMERA.x, SNARE.z - CAMERA.z)), r: 0.6 });
  return out;
}

/** The camera pine, planted as a real forest tree. */
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

