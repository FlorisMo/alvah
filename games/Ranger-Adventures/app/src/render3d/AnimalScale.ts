/**
 * AnimalScale.ts — THE scale table: how tall everything a player sees stands next to
 * Alvah's ranger (run 6). One row per thing: people, animals and their young, birds,
 * vehicles, buildings, props, trees and the plants the missions hide animals in.
 *
 * Every value is a RENDERED height in metres: what `Models.prepModel` sizes the model
 * to, and so what a screenshot on a 0.5 m grid shows (prepModel measures the drawn
 * mesh, head and soles included, since run 6). Height means the model as it stands:
 * a deer's ears, a stag's antlers, a squirrel's raised tail count when they are its
 * top. Each row carries its real-world range for that same measure and one line of
 * why. A row whose value sits outside its real range on purpose says so (`readable`:
 * a 6 cm frog is ~10 px from the lens, so the game shows it bigger).
 *
 * The anchor is Alvah himself: a real 8-year-old boy, 1.32 m (run decision). Adults
 * stand 1.78-1.80, a head and a half above him; the sow's back reaches his belly, a
 * roe deer's head his chin, the stag towers over him, and the forest is grown trees.
 *
 * THREE-free and deterministic, unit-tested in AnimalScale.test.ts. Read by the world
 * (Player, Fauna, Vehicles, Dressing, Forest, Progress, the title), by the mini-games
 * (`play/spawn.heightFor`) and by the cover rule the missions hide animals with.
 */

export type SizeGroup = 'people' | 'animals' | 'birds' | 'vehicles' | 'buildings' | 'props' | 'trees' | 'plants';

export interface Size {
  readonly group: SizeGroup;
  /** rendered height (m) as the model stands */
  readonly h: number;
  /** the real-world range (m) of that same height */
  readonly real: readonly [number, number];
  /** one line: what the height is, and why this value */
  readonly why: string;
  /** the manifest GLB this row sizes (the first row naming a GLB is its default size) */
  readonly model?: string;
  /** where many stand (a field, a scatter): the rendered heights they spread over */
  readonly vary?: readonly [number, number];
  /** animals and birds: nose-to-tail length (m) at `h`, measured off the model */
  readonly len?: number;
  /** animals that lie down in a mission (a fawn curled up in the grass): that shape */
  readonly lying?: { readonly h: number; readonly len: number };
  /** plants: the widest spread (m) at `h`, measured off the model */
  readonly w?: number;
  /** buildings: the door's clear height (m) at `h`, measured off the model */
  readonly door?: number;
  /** set when `h` lies outside `real` on purpose: why (a child must still see it) */
  readonly readable?: string;
}

/** Everything, by key: content ids for the animals and birds (as `veluwe.ts` names
 *  them), Dutch world names for the rest. */
export const SIZE = {
  // ── people ───────────────────────────────────────────────────────────────
  ranger: { group: 'people', h: 1.32, real: [1.22, 1.44], model: 'ranger-alvah',
    why: 'Alvah is 8: an average Dutch 8-year-old boy (run decision; P3-P97 ≈ 1.22-1.44)' },
  boa: { group: 'people', h: 1.8, real: [1.7, 1.95], model: 'ranger-warden-boa',
    why: 'the warden: a grown Dutch man (average ≈ 1.81), a head and a half above the boy' },
  stroper: { group: 'people', h: 1.78, real: [1.65, 1.95], model: 'figure-poacher',
    why: 'the poacher: a grown man, a touch shorter than the warden' },

  // ── animals (the adult first: it is the model's default size) ───────────
  wildzwijn: { group: 'animals', h: 0.85, real: [0.75, 1.0], model: 'animal-wildzwijn-boar', len: 1.47,
    why: 'a sow: shoulder 0.65-0.85, the model tops out at its ears and hump; her back at a child\'s belly' },
  overloper: { group: 'animals', h: 0.62, real: [0.5, 0.75], model: 'animal-wildzwijn-boar', len: 1.07,
    why: 'a yearling wild boar (last year\'s young, reddish-brown): ≈ 70 % of the sow, shoulder 0.5-0.6' },
  frisling: { group: 'animals', h: 0.3, real: [0.25, 0.4], model: 'animal-frisling-piglet', len: 0.52,
    why: 'a striped piglet of a few months: shoulder ≈ 0.25-0.35, ≈ 0.5 m long' },
  ree: { group: 'animals', h: 1.1, real: [1.0, 1.2], model: 'animal-ree-roedeer', len: 1.12,
    why: 'a roe doe: shoulder 0.65-0.75, head up ≈ 1.0-1.1, ears to 1.2; her head at a child\'s chin' },
  reekalf: { group: 'animals', h: 0.62, real: [0.5, 0.75], model: 'animal-ree-roedeer', len: 0.63,
    lying: { h: 0.3, len: 0.55 },
    why: 'a fawn of a few weeks (the roe model): shoulder ≈ 0.4, head ≈ 0.6; lying curled ≈ 0.3 high' },
  edelhert: { group: 'animals', h: 2.25, real: [2.0, 2.5], model: 'animal-edelhert-reddeer', len: 2.03,
    why: 'a Veluwe stag: shoulder 1.15-1.3, head ≈ 1.75, antler tips 2.1-2.5; he towers over the boy' },
  hinde: { group: 'animals', h: 1.65, real: [1.5, 1.8], model: 'animal-edelhert-reddeer', len: 1.9,
    why: 'a hind: the stag model with its antlers hidden; shoulder 1.0-1.15, head up ≈ 1.5-1.75' },
  hertenkalf: { group: 'animals', h: 1.1, real: [0.95, 1.25], model: 'animal-edelhert-reddeer', len: 1.27,
    why: 'a red-deer calf in its first summer (antlers hidden): shoulder ≈ 0.8, head ≈ 1.1' },
  vos: { group: 'animals', h: 0.52, real: [0.45, 0.6], model: 'animal-vos-fox', len: 1.08,
    why: 'a fox: shoulder 0.35-0.4, head up ≈ 0.45-0.5, ears to 0.6; ≈ 1.1 m with its tail' },
  'vos-welp': { group: 'animals', h: 0.3, real: [0.22, 0.38], model: 'animal-vos-fox', len: 0.62,
    why: 'a fox cub of ≈ 2 months: shoulder ≈ 0.2-0.25, ears ≈ 0.3' },
  das: { group: 'animals', h: 0.32, real: [0.25, 0.35], model: 'animal-das-badger', len: 0.79,
    why: 'a badger: low and wide, shoulder ≈ 0.3, ≈ 0.8 m long' },
  eekhoorn: { group: 'animals', h: 0.25, real: [0.2, 0.3], model: 'animal-eekhoorn-squirrel', len: 0.27,
    why: 'a red squirrel sitting up, its tail raised: body ≈ 0.2 plus ears and tail' },
  // run 7 (the eekhoorn's rare visitor): the dark-brown form of the same species
  'eekhoorn-donker': { group: 'animals', h: 0.25, real: [0.2, 0.3], model: 'animal-eekhoorn-squirrel', len: 0.27,
    why: 'a dark-brown red squirrel (the dark form of the same species): the same size' },
  raaf: { group: 'birds', h: 0.42, real: [0.35, 0.45], model: 'animal-raaf-raven', len: 0.45,
    why: 'a raven standing: ≈ 0.4 tall, 0.55-0.7 long; the model is compact, so the upper end' },
  wolf: { group: 'animals', h: 0.95, real: [0.85, 1.05], model: 'animal-wolf', len: 1.85,
    why: 'a wolf: shoulder 0.7-0.85, head up ≈ 0.9-1.0; ≈ 1.8 m with its tail' },
  adder: { group: 'animals', h: 0.15, real: [0.08, 0.2], model: 'animal-adder-snake', len: 0.47,
    why: 'an adder coiled with its head raised; ≈ 0.55 m long uncoiled' },
  heikikker: { group: 'animals', h: 0.12, real: [0.03, 0.06], model: 'animal-heikikker-frog', len: 0.23,
    readable: 'a sitting moor frog is 3-5 cm high: at true size it is ~10 px from the lens, so a child could never find it',
    why: 'a moor frog, shown at twice its size so a child can see it' },
  heideblauwtje: { group: 'animals', h: 0.028, real: [0.004, 0.006], model: 'animal-heideblauwtje-butterfly', len: 0.16,
    readable: 'a 2.5 cm butterfly would be a few pixels: shown ≈ 5× so it reads as a butterfly',
    why: 'a silver-studded blue, wings open (the model is ≈ 6× as wide as it is high)' },
  nachtzwaluw: { group: 'birds', h: 0.17, real: [0.15, 0.22], model: 'animal-nachtzwaluw-nightjar', len: 0.24,
    why: 'a nightjar on the ground: ≈ 0.26 m long, crouched low' },

  // ── birds (the mini-games' callers; the two gliding overhead) ────────────
  koekoek: { group: 'birds', h: 0.24, real: [0.22, 0.32], model: 'bird-koekoek', len: 0.14,
    why: 'a cuckoo perched upright, tail down: ≈ 0.25-0.3 high' },
  merel: { group: 'birds', h: 0.2, real: [0.16, 0.2], model: 'bird-merel', len: 0.29,
    why: 'a blackbird: 0.24-0.29 long; the model stands long and low' },
  roodborsttapuit: { group: 'birds', h: 0.15, real: [0.1, 0.12], model: 'bird-roodborsttapuit', len: 0.17,
    readable: 'a 12 cm stonechat on its perch is a speck at play distance: shown ≈ 1.3×',
    why: 'a stonechat: 0.12-0.13 long' },
  'groene-specht': { group: 'birds', h: 0.26, real: [0.25, 0.33], model: 'bird-groene-specht', len: 0.18,
    why: 'a green woodpecker clinging upright: ≈ 0.3 long' },
  gaai: { group: 'birds', h: 0.3, real: [0.26, 0.34], model: 'bird-gaai', len: 0.3,
    why: 'a jay on its twig (the model carries the twig): the bird ≈ 0.2 tall, 0.34 long' },
  koolmees: { group: 'birds', h: 0.14, real: [0.12, 0.2], model: 'bird-koolmees', len: 0.17,
    why: 'a great tit: ≈ 0.14 long' },
  'wilde-eend': { group: 'birds', h: 0.36, real: [0.35, 0.45], model: 'bird-wilde-eend', len: 0.52,
    why: 'a mallard on the water\'s edge: 0.5-0.65 long' },
  buizerd: { group: 'birds', h: 0.75, real: [0.65, 0.8], model: 'bird-buizerd', len: 1.26,
    why: 'a buzzard gliding, wings spread: wingspan 1.1-1.3 (the model is 1.7× as wide as high)' },
  houtduif: { group: 'birds', h: 0.38, real: [0.33, 0.4], model: 'bird-houtduif', len: 0.43,
    why: 'a wood pigeon in flight: ≈ 0.4 long' },
  // run 7: the open world's small surprises (world/Surprises.ts): the tree birds a little
  // over true size, heard more than seen as in a real wood; the robin, who hops along
  // beside him to be SEEN, shown big enough for that
  'grote-bonte-specht': { group: 'birds', h: 0.3, real: [0.22, 0.27], model: 'bird-grote-bonte-specht', len: 0.14,
    readable: 'a 24 cm woodpecker on a trunk 15 m off is a few pixels: shown ≈ 1.25× so its black, white and red read',
    why: 'a great spotted woodpecker clinging upright to a trunk: 0.22-0.26 long, tail braced' },
  winterkoning: { group: 'birds', h: 0.12, real: [0.06, 0.09], model: 'bird-winterkoning', len: 0.15,
    readable: 'a 10 cm wren is a speck at play distance: shown ≈ 1.5× so a child can spot it hopping',
    why: 'a wren, tail cocked: 0.09-0.10 long, a tiny round bird' },
  roodborst: { group: 'birds', h: 0.26, real: [0.09, 0.12], model: 'bird-roodborst', len: 0.36,
    readable: 'a 14 cm robin hopping beside him (≈ 5.5 m from the walk lens) is ~20 px: shown ≈ 2.3× so he sees it hop and its red breast reads (its hint promises a bird he sees)',
    why: 'a robin standing: ≈ 0.14 long, about 0.1 high' },
  // run 7 (the squirrel's neighbours, adventure/missions/eekhoorn): the nuthatch that walks
  // head-first down the store pine's bark — a small, big-headed, short-tailed bird
  boomklever: { group: 'birds', h: 0.14, real: [0.12, 0.15], model: 'bird-boomklever', len: 0.2,
    why: 'a nuthatch: 0.12-0.14 long, a short tail; the model stands on its own twig' },

  // ── vehicles ─────────────────────────────────────────────────────────────
  jeep: { group: 'vehicles', h: 1.9, real: [1.8, 2.05], model: 'vehicle-ranger-jeep', len: 3.65,
    why: 'a short 4×4 (Defender 90 class ≈ 1.95 × 3.9 m): the boy can just see out of it' },
  helikopter: { group: 'vehicles', h: 3.3, real: [2.9, 3.6], model: 'vehicle-helicopter', len: 5.6,
    why: 'a light helicopter ≈ 3.3 m to its rotor hub (R44 class); the stubby model is 5.6 m long; the boy sits visibly in its cockpit' },

  // ── buildings ────────────────────────────────────────────────────────────
  boshut: { group: 'buildings', h: 4.5, real: [3.8, 6.0], model: 'prop-ranger-cabin', door: 1.95,
    why: 'a ranger\'s log cabin on its stilts to the ridge: its door ≈ 1.95, taller than the warden' },
  missiebord: { group: 'buildings', h: 1.8, real: [1.6, 2.2], model: 'prop-case-board',
    why: 'a notice board on its posts, its papers at a child\'s eye' },
  vogelkijkhut: { group: 'buildings', h: 3.0, real: [2.6, 4.0], model: 'prop-bird-hide',
    why: 'a bird hide on its posts: ≈ 3 m to the roof' },
  'boa-post': { group: 'buildings', h: 3.3, real: [3.0, 4.5], model: 'prop-boa-post',
    why: 'the wardens\' post: a small building ≈ 3.3 m to its roof' },
  uitkijktoren: { group: 'buildings', h: 14, real: [12, 30], model: 'prop-fire-watchtower',
    why: 'a fire watchtower: its cabin above the pine crowns (real ones 15-30 m)' },
  ecoduct: { group: 'buildings', h: 6, real: [5, 10], model: 'prop-ecoduct',
    why: 'a wildlife bridge: its green deck ≈ 6 m over the road' },
  wegwijzer: { group: 'buildings', h: 1.7, real: [1.5, 2.2], model: 'prop-signpost',
    why: 'a wooden signpost, its arms above a child\'s head' },

  // ── props ────────────────────────────────────────────────────────────────
  hek: { group: 'props', h: 0.9, real: [0.8, 1.2], model: 'prop-wooden-fence',
    why: 'a post-and-rail fence: waist high to a grown-up, chest high to the boy' },
  boomstam: { group: 'props', h: 0.55, real: [0.35, 0.8], model: 'prop-fallen-log',
    why: 'a fallen pine on the forest floor (the model is 3× as long as it is high)' },
  stronk: { group: 'props', h: 0.6, real: [0.3, 1.0], model: 'prop-tree-stump',
    why: 'the stump of a felled pine, ≈ 0.8 m across' },
  kei: { group: 'props', h: 1.1, real: [0.6, 1.6], model: 'prop-boulder',
    why: 'an ice-age boulder of the Veluwe' },
  paddenstoelen: { group: 'props', h: 0.18, real: [0.08, 0.25], model: 'prop-mushrooms',
    why: 'a cluster of fly agarics' },
  wildcamera: { group: 'props', h: 0.3, real: [0.12, 0.2], model: 'prop-wildlife-camera',
    readable: 'a 15 cm trail camera on its post is hard to spot: shown ≈ 1.5× (a mission is about it)',
    why: 'a trail camera strapped to its stake' },
  dassenburcht: { group: 'props', h: 0.7, real: [0.3, 1.0], model: 'prop-badger-sett',
    why: 'the spoil mound at a badger sett\'s entrance' },
  vossenhol: { group: 'props', h: 0.45, real: [0.3, 0.8],
    why: 'the sandy mound over a fox\'s earth, a dark way in' },
  'dode-boom': { group: 'props', h: 3.5, real: [2.0, 12], model: 'prop-dead-snag',
    why: 'the broken-off trunk of a dead pine' },
  eikels: { group: 'props', h: 0.22, real: [0.1, 0.3], model: 'prop-acorn-cluster',
    why: 'a squirrel\'s winter store heaped by a stump' },
  sneeuwhoop: { group: 'props', h: 0.35, real: [0.1, 0.6], model: 'prop-snow-mound', vary: [0.25, 0.35],
    why: 'a drift of snow' },

  // ── trees (base heights; each tree gets its own variety on top) ──────────
  den: { group: 'trees', h: 12.5, real: [10, 25], model: 'prop-pine-scots', vary: [10.6, 23.8],
    why: 'a grown Scots pine: 15-25 m in old Veluwe stands, 10-15 in younger ones; bare trunk to ≈ 5.5 m' },
  eik: { group: 'trees', h: 10.5, real: [8, 25], model: 'prop-oak-tree', vary: [8.9, 20],
    why: 'a spreading oak: its crown ≈ 13 m across, low branches from ≈ 1.5 m' },
  berk: { group: 'trees', h: 11.5, real: [8, 22], model: 'prop-birch-tree', vary: [9.8, 18.4],
    why: 'a birch: slender, 10-20 m' },

  // ── plants and cover (fields spread over `vary`) ─────────────────────────
  struikhei: { group: 'plants', h: 0.27, real: [0.15, 0.8], vary: [0.189, 0.351], w: 0.85,
    why: 'heather cushions: knee-low domes on the heath' },
  dopheide: { group: 'plants', h: 0.22, real: [0.15, 0.6], vary: [0.162, 0.27], w: 0.75,
    why: 'cross-leaved heath on the wet heath by the ven' },
  winterhei: { group: 'plants', h: 0.42, real: [0.2, 0.8], model: 'prop-heather-winter', w: 0.83,
    why: 'a clump of old heather' },
  heidegras: { group: 'plants', h: 0.62, real: [0.3, 1.0], vary: [0.45, 0.8], w: 0.59,
    why: 'wavy hair-grass tussocks between the heather' },
  pijpenstrootje: { group: 'plants', h: 0.7, real: [0.3, 1.2], vary: [0.5, 0.9], w: 0.75,
    why: 'purple moor-grass tussocks on the wet heath, flower stalks up to 1 m' },
  helmgras: { group: 'plants', h: 0.8, real: [0.5, 1.2], vary: [0.6, 1.05], w: 0.62,
    why: 'marram tussocks on the drifting sand' },
  adelaarsvaren: { group: 'plants', h: 1.1, real: [0.6, 2.0], model: 'prop-fern', vary: [0.9, 1.6], w: 1.84,
    why: 'bracken under the pines: 1-1.5 m in late summer, up to 2' },
  braam: { group: 'plants', h: 1.0, real: [0.6, 2.0], model: 'prop-bramble', w: 1.37,
    why: 'a bramble thicket, a metre high and wider than tall' },
  jeneverbes: { group: 'plants', h: 1.8, real: [1.0, 4.0], model: 'prop-juniper-bush', w: 2.07,
    why: 'a Veluwe juniper: a dense evergreen bush, taller than the boy' },
  lisdodde: { group: 'plants', h: 1.6, real: [1.0, 2.5], model: 'prop-reeds', vary: [1.3, 1.85], w: 1.08,
    why: 'reedmace and reed round the ven: 1.5-2.5 m' },
  vingerhoedskruid: { group: 'plants', h: 1.2, real: [0.5, 2.0], model: 'prop-foxglove', w: 0.22,
    why: 'a foxglove spike in flower' },
} as const satisfies Record<string, Size>;

export type SizeKey = keyof typeof SIZE;

/** The player ranger's rendered height (m): Alvah, 8 years old. */
export const RANGER_STAND_HEIGHT: number = SIZE.ranger.h;

/** Each GLB's default row: the first row that names it (the adult for an animal). */
const MODEL_DEFAULT: ReadonlyMap<string, SizeKey> = (() => {
  const m = new Map<string, SizeKey>();
  for (const [k, r] of Object.entries(SIZE) as [SizeKey, Size][]) if (r.model && !m.has(r.model)) m.set(r.model, k);
  return m;
})();

/** The row for a table key or a manifest GLB id (its default row), or null. */
export function sizeRow(id: string | null | undefined): Size | null {
  if (!id) return null;
  if (id in SIZE) return SIZE[id as SizeKey];
  const k = MODEL_DEFAULT.get(id);
  return k ? SIZE[k] : null;
}

/** Rendered height (m) for a table key or a manifest GLB id, or null when the table
 *  has no row for it. Pure. */
export function standHeightFor(id: string | null | undefined): number | null {
  return sizeRow(id)?.h ?? null;
}

/** A height as a share of the boy's (the ranger = 1). Pure. */
export function ratioToRanger(id: string | null | undefined): number | null {
  const h = standHeightFor(id);
  return h === null ? null : h / RANGER_STAND_HEIGHT;
}

/**
 * THE COVER RULE (for the missions that hide an animal): a plant hides an animal when
 * it stands at least `COVER_TALL` × the animal's height and spreads at least as wide
 * as the animal is long. Pass a lying animal's shape to hide it lying down.
 */
export const COVER_TALL = 1.2;

export function hides(plant: { h: number; w: number }, animal: { h: number; len: number }): boolean {
  return plant.h >= COVER_TALL * animal.h && plant.w >= animal.len;
}

/** The plants (table keys) that hide `animal` at their table size, standing or lying. */
export function coverFor(animal: SizeKey, pose: 'staand' | 'liggend' = 'staand'): SizeKey[] {
  const a: Size = SIZE[animal];
  const shape = pose === 'liggend' && a.lying ? a.lying : a.len !== undefined ? { h: a.h, len: a.len } : null;
  if (!shape) return [];
  const out: SizeKey[] = [];
  for (const [k, r] of Object.entries(SIZE) as [SizeKey, Size][]) {
    if (r.group === 'plants' && r.w !== undefined && hides({ h: r.h, w: r.w }, shape)) out.push(k);
  }
  return out;
}

/** Every animal and bird the table sizes, with the plants that hide it standing (the
 *  missions lane plans its hiding places on this). */
export const COVER: Readonly<Partial<Record<SizeKey, readonly SizeKey[]>>> = Object.fromEntries(
  (Object.keys(SIZE) as SizeKey[])
    .filter((k) => SIZE[k].group === 'animals' || SIZE[k].group === 'birds')
    .map((k) => [k, coverFor(k)]),
);

/** A field's rendered height at a stable per-spot random `t` in [0,1): from the row's
 *  `vary` spread (its `h` when it has none). Pure. */
export function spreadAt(key: SizeKey, t: number): number {
  const r: Size = SIZE[key];
  return r.vary ? r.vary[0] + t * (r.vary[1] - r.vary[0]) : r.h;
}
