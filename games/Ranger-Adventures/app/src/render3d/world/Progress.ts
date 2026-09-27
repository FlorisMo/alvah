/**
 * world/Progress.ts — progress you can SEE (VISION §4a gap 1, §5 "the world reacts").
 *
 * Every finished mission leaves a lasting, calm change at its marker that tells its
 * own ending: the frisling's sow and siblings root beside it, the reekalf's mother
 * stands with it again, the wildcamera hangs by the badger's burcht, the fox's cub
 * plays at the den, the winter herd grazes on the heath. A small flag with a check
 * stands at the marker's ring, so a finished place reads as "klaar" at a glance.
 *
 *   complete(id, fresh=false)  build the finished tableau at once (the world is
 *                              built, or reloaded, with the mission already done)
 *   complete(id, fresh=true)   the reunion: the flag rises, the props fade up and the
 *                              family walks calmly in to the marker (~2.6 s). The
 *                              camera never moves; under reduced motion it is a cut:
 *                              everything simply stands there. Finished somewhere
 *                              else (a mission picked on the missiebord is played at
 *                              the board), the family is laid out at its marker as a
 *                              reload lays it out, and it comes home the first time
 *                              the ranger comes to look.
 *
 * Where: each tableau is laid out in the marker's own frame — `a` metres along the
 * line from where the ranger comes from to the marker (beyond it = +), `s` metres
 * across (right = +) — so the family stands around the marker's animal, in view of
 * the follow camera behind the ranger. Every piece is seated per point on the rendered
 * ground (`groundY`) and nudged round the marker until its spot is free (no water, no
 * tree, prop or other marker). Nothing here collides: it is set-dressing, so it never
 * blocks the way to a marker.
 *
 * The models are the world's own (via `spawnModel` / `spawnPlant`, passed in by the
 * World), so this module imports no loader and its layout carries a node unit test.
 */

import * as THREE from 'three';
import type { Spawned, SpawnOpts } from '../play/types';
import { fadeable, FarRest, setOpacity } from '../play/fade.ts';
import { gaitFor, motionAt, REST, type MotionRecipe } from '../ProceduralMotion.ts';

/* ------------------------------------------------------------ the tableaus ---- */

/** One thing in a finished tableau. */
export interface Piece {
  /** content animal id (`spawnModel`), a world prop GLB id (`spawnPlant`), or for a
   *  `den` the kind of den (a fox's earth: a low mound with a dark way in) */
  id: string;
  kind: 'animal' | 'prop' | 'den';
  /** stand height (m); animals default to their canonical play size */
  h?: number;
  /** metres along the approach → marker line (+ = beyond the marker) */
  a: number;
  /** metres across it (+ = to the right, seen from the approach) */
  s: number;
  /** which way it looks: at the marker's animal, back at the approach (the lens),
   *  or a yaw (rad) relative to looking back at the approach */
  face?: 'hero' | 'lens' | number;
  /** metres above the ground (a raven on a log) */
  lift?: number;
  /** walks in to its spot during the reunion (animals); props fade up in place */
  arrive?: boolean;
  /** false = a hind or a calf: the red-deer model without the stag's antlers */
  antlers?: false;
  /** stands on a wooden stake this tall (m): a wildcamera strapped to its post */
  stake?: number;
}

export interface Tableau {
  /** the animal that stands AT the marker, before and after (content animal id) */
  hero: string;
  /** what gathers round it once the mission is finished */
  pieces: Piece[];
  /** where the "klaar" flag stands (marker frame); default at the ring's right edge */
  flag?: { a: number; s: number };
}

/**
 * The ending of every mission, from its content (veluwe.ts: `reunion`, `payoff`) and
 * the story canon (VISION §4a/§5). Sizes: the world's canonical ones (AnimalScale),
 * the young at their own size.
 */
export const TABLEAUS: Record<string, Tableau> = {
  // "De zeug knort blij. Haar big is terug." — the frisling home with its rotte
  frisling: {
    hero: 'frisling',
    pieces: [
      { id: 'wildzwijn', kind: 'animal', h: 0.8, a: 1.3, s: -1.9, face: 'hero', arrive: true },   // the sow
      { id: 'frisling', kind: 'animal', a: 0.6, s: -1.05, face: 1.2, arrive: true },              // a sibling
      { id: 'frisling', kind: 'animal', a: 1.9, s: -0.9, face: -0.9, arrive: true },              // and another
    ],
  },
  // payoff 'moeder-keert-terug': you left the calf alone, and its mother came back
  'ree-niet-aanraken': {
    hero: 'reekalf',
    pieces: [
      { id: 'ree', kind: 'animal', a: 1.1, s: 1.35, face: 'hero', arrive: true },
    ],
    flag: { a: -0.3, s: -1.4 },
  },
  // "De camera bewaakt het bos." — the camera by the badger's burcht
  wildcamera: {
    hero: 'das',
    pieces: [
      { id: 'prop-badger-sett', kind: 'prop', h: 0.7, a: 1.7, s: -1.5, face: 'lens' },
      { id: 'prop-wildlife-camera', kind: 'prop', h: 0.3, a: 1.0, s: 2.0, face: 'hero', stake: 0.75 },
    ],
    flag: { a: -0.4, s: -1.5 },
  },
  // "De kikker plonst terug het ven in." — frogs at home in the reeds
  ven: {
    hero: 'heikikker',
    pieces: [
      { id: 'prop-reeds', kind: 'prop', h: 1.1, a: 1.2, s: -1.3, face: 'lens' },
      { id: 'prop-reeds', kind: 'prop', h: 0.9, a: 1.5, s: 1.1, face: 1.4 },
      { id: 'heikikker', kind: 'animal', a: 0.7, s: -0.7, face: 'hero', arrive: true },
    ],
  },
  // "De dieren staken veilig over." — a hind and her calf, calm on the crossing
  ecoduct: {
    hero: 'edelhert',
    pieces: [
      { id: 'edelhert', kind: 'animal', h: 1.3, a: 1.5, s: -2.0, face: 1.4, arrive: true, antlers: false },
      { id: 'edelhert', kind: 'animal', h: 0.85, a: 0.9, s: -1.3, face: 1.4, arrive: true, antlers: false },
    ],
  },
  // "De nachtzwaluw blijft rustig op het nest." — a quiet zone, fenced off
  stuifzand: {
    hero: 'nachtzwaluw',
    pieces: [
      { id: 'prop-wooden-fence', kind: 'prop', h: 0.7, a: 1.4, s: -1.1, face: 0.5 },
      { id: 'prop-wooden-fence', kind: 'prop', h: 0.7, a: 1.4, s: 1.1, face: -0.5 },
      { id: 'prop-heather-winter', kind: 'prop', h: 0.4, a: 0.5, s: 1.6, face: 'lens' },
    ],
  },
  // payoff 'nachtronde': the night was kept safe — a calm dawn on the log
  nachtronde: {
    hero: 'edelhert',
    pieces: [
      { id: 'prop-fallen-log', kind: 'prop', h: 0.5, a: 1.3, s: 1.9, face: 1.3 },
      { id: 'raaf', kind: 'animal', a: 1.3, s: 1.9, lift: 0.42, face: 'lens' },
      { id: 'prop-mushrooms', kind: 'prop', h: 0.3, a: 0.6, s: -1.6, face: 'lens' },
    ],
  },
  // "Alle nootjes terug." — the winter store by the stump, and a friend
  eekhoorn: {
    hero: 'eekhoorn',
    pieces: [
      { id: 'prop-tree-stump', kind: 'prop', h: 0.55, a: 1.4, s: -1.5, face: 'lens' },
      { id: 'prop-acorn-cluster', kind: 'prop', h: 0.22, a: 0.7, s: -1.2, face: 'lens' },
      { id: 'eekhoorn', kind: 'animal', a: 0.8, s: 1.2, face: 'hero', arrive: true },
    ],
  },
  // "De vos is gerust. Hij draaft terug naar zijn hol." — the den, and a cub
  vos: {
    hero: 'vos',
    pieces: [
      { id: 'vos', kind: 'den', h: 0.45, a: 1.9, s: 1.5, face: -0.5 },
      { id: 'vos', kind: 'animal', h: 0.3, a: 1.1, s: 2.5, face: 'hero', arrive: true },
    ],
    flag: { a: -0.3, s: -1.4 },
  },
  // the season finale: "De kudde trekt rustig verder. Het is weer veilig op de Veluwe."
  herstel: {
    hero: 'edelhert',
    pieces: [
      { id: 'edelhert', kind: 'animal', h: 1.3, a: 1.4, s: -2.1, face: 1.3, arrive: true, antlers: false },
      { id: 'edelhert', kind: 'animal', h: 0.85, a: 0.8, s: -1.4, face: 1.3, arrive: true, antlers: false },
      { id: 'prop-snow-mound', kind: 'prop', h: 0.35, a: 2.0, s: 1.8, face: 'lens' },
      { id: 'prop-snow-mound', kind: 'prop', h: 0.25, a: 2.6, s: -0.6, face: 1 },
    ],
  },
};

/** The flag's default spot (marker frame): at the ring's right edge, a step toward the lens. */
const FLAG_AT = { a: -0.3, s: 1.4 };

/** The animal that stands at a mission's marker — the one the mission is about
 *  (the frisling, not the grown boar; the reekalf, not a grown roe). */
export function heroOf(missionId: string, dier: string | undefined): string {
  return TABLEAUS[missionId]?.hero ?? dier ?? '';
}

/* ---------------------------------------------------------------- layout ---- */

export interface Frame { ox: number; oz: number; dx: number; dz: number }

/** The marker's frame: origin at the marker, `d` = the unit direction the ranger
 *  walks in on (from `from` to the marker; a calm default when they coincide). */
export function frameAt(mx: number, mz: number, fromX: number, fromZ: number): Frame {
  let dx = mx - fromX, dz = mz - fromZ;
  const l = Math.hypot(dx, dz);
  if (l < 1e-3) { dx = 0; dz = -1; } else { dx /= l; dz /= l; }
  return { ox: mx, oz: mz, dx, dz };
}

/** World x/z of marker-frame (a, s). Right of `d` (seen along it) is (-dz, dx). */
export function toWorld(f: Frame, a: number, s: number): { x: number; z: number } {
  return { x: f.ox + f.dx * a - f.dz * s, z: f.oz + f.dz * a + f.dx * s };
}

/**
 * The spot a piece really stands on: its planned (a, s), or — when that is not free —
 * the nearest free spot turned round the marker (±25°, ±50°, …) at the same distance,
 * then a little further out. Deterministic, so a reload lays the same tableau out
 * the same way. Null when nothing within reach is free (the piece is left out).
 */
export function freeSpot(
  f: Frame, a: number, s: number, r: number,
  free: (x: number, z: number, r: number) => boolean,
): { x: number; z: number } | null {
  const dist = Math.hypot(a, s);
  const ang = Math.atan2(s, a);
  for (const k of [1, 1.3, 1.6, 2.0]) {
    for (let i = 0; i <= 14; i++) {
      const turn = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (25 * Math.PI) / 180;
      if (Math.abs(turn) > Math.PI) break;
      const d = Math.max(dist * k, 0.8);
      const p = toWorld(f, Math.cos(ang + turn) * d, Math.sin(ang + turn) * d);
      if (free(p.x, p.z, r)) return p;
    }
  }
  return null;
}

/** What the lens sees when a mission is finished: the reunion is laid out IN view. */
export interface ReunionView {
  camera: THREE.Camera;
  /** where the ranger stands (nothing may stand between the lens and him) */
  ranger: { x: number; z: number };
}

/**
 * The marker frame for a reunion seen through `view`: `d` is where the lens looks
 * (flat), and when the marker lies close in front of (or beside, or under) the lens —
 * the ranger walked past it and turned round — the frame's origin steps forward along
 * the look, so the family gathers in the picture instead of at the lens's feet.
 */
export function reunionFrame(mx: number, mz: number, view: ReunionView): Frame {
  const dir = view.camera.getWorldDirection(new THREE.Vector3());
  dir.y = 0;
  if (dir.lengthSq() < 1e-6) return frameAt(mx, mz, view.camera.position.x, view.camera.position.z);
  dir.normalize();
  const along = (mx - view.camera.position.x) * dir.x + (mz - view.camera.position.z) * dir.z;
  const shift = Math.min(SHIFT_MAX, Math.max(0, 5 - along)); // the family stays AT its marker
  return { ox: mx + dir.x * shift, oz: mz + dir.z * shift, dx: dir.x, dz: dir.z };
}

/** The reunion plays in the picture when the ranger finished the mission this close
 *  to its marker (m) — at the marker itself, where its games are staged. */
export const HERE_R = 6;
/** How far (m) a reunion frame may step forward along the look: never further, so
 *  the family always gathers round its own marker. */
const SHIFT_MAX = 3.5;
/** A family that comes home later (the mission was finished at the board) walks in
 *  when the lens comes this close (m) with the marker in the picture. */
const COME_HOME_R = 18;

/** Is the marker at (mx, my, mz) in the lens's picture, within `r` m? */
export function markerInSight(camera: THREE.Camera, mx: number, my: number, mz: number, r: number): boolean {
  if (Math.hypot(mx - camera.position.x, mz - camera.position.z) > r) return false;
  camera.updateMatrixWorld();
  const p = new THREE.Vector3(mx, my, mz).project(camera);
  return p.z > -1 && p.z < 1 && Math.abs(p.x) < 0.8 && Math.abs(p.y) < 0.85;
}

/** Is a piece at (x, y, z) in the lens's picture (clear of the top caption band), a
 *  calm distance away, and not standing between the lens and the ranger? */
export function inReunionView(view: ReunionView, x: number, y: number, z: number, r: number): boolean {
  const cam = view.camera;
  cam.updateMatrixWorld();
  const p = new THREE.Vector3(x, y, z).project(cam);
  if (!(p.z > -1 && p.z < 1) || Math.abs(p.x) > 0.82 || p.y < -0.72 || p.y > 0.5) return false;
  const cx = cam.position.x, cz = cam.position.z;
  if (Math.hypot(x - cx, z - cz) < 3.5) return false;
  const sx = view.ranger.x - cx, sz = view.ranger.z - cz;
  const len2 = sx * sx + sz * sz || 1;
  const t = Math.max(0, Math.min(1, ((x - cx) * sx + (z - cz) * sz) / len2));
  return Math.hypot(x - (cx + sx * t), z - (cz + sz * t)) >= 0.8 + r;
}

/** rotation.y that turns a model's +z face toward the world direction (fx, fz). */
export function yawToward(fx: number, fz: number): number {
  return Math.atan2(fx, fz);
}

/* ------------------------------------------------------------- the module ---- */

export interface ProgressEnv {
  scene: THREE.Scene;
  /** the rendered ground height (world/Terrain.ts) */
  groundY(x: number, z: number): number;
  /** the world's solid things: tree trunks, the cabin, the board, a parked jeep … */
  obstacles: readonly { x: number; z: number; r: number; tree?: boolean }[];
  /** off-limits ground (the ven's water) */
  blocked(x: number, z: number): boolean;
  /** every mission marker: where it stands and its scene group (hidden with it) */
  markers(): readonly { missionId: string; x: number; z: number; group: THREE.Object3D }[];
  /** the two story people (the warden, the poacher) — nobody stands in them */
  actors(): readonly { x: number; z: number }[];
  spawnModel(id: string, opts?: SpawnOpts): Promise<Spawned | null>;
  spawnPlant(id: string, height: number): Promise<Spawned | null>;
  /** canonical play height (m) of a content animal */
  heightFor(id: string): number;
}

interface Live {
  piece: Piece;
  root: THREE.Object3D;
  spawned: Spawned | null;
  x: number; z: number; y: number;
  recipe: MotionRecipe;
  phase: number;
  /** hidden until its reunion starts (then it walks in, or fades up) */
  held: boolean;
  /** reunion walk: from (fx,fz) to (x,z), 0..1 */
  walk: { fx: number; fz: number; t: number } | null;
  /** reunion fade-up 0..1 (the props); null = done */
  fade: number | null;
  /** its own materials (fadeable), and the opacity they are drawn at now: the
   *  reunion fade-up times the fade into the far fog */
  mats: THREE.Material[];
  alpha: number;
  /** rides on another piece (a raven on its log): that piece places it */
  riding?: boolean;
}

interface Built {
  missionId: string;
  group: THREE.Group;
  frame: Frame;
  live: Live[];
  flag: THREE.Mesh;
  spots: { x: number; z: number; r: number }[];
  /** finished away from its marker: the family comes home once the ranger comes to look */
  later: boolean;
  /** far off, its family rests (the flag stays) */
  rest: FarRest;
}

/** How long the reunion takes (s): the family's calm walk in, the flag rising. */
export const REUNION_S = 2.6;
/** A tableau's animals + props calmly fade out once the lens is further than
 *  REST_FAR m, and back in within REST_NEAR m (the flag, the green halo and the "✓"
 *  tag always stay): the families you walk up to stand there, and a bos full of
 *  finished families never pushes the draw calls past the budget. */
export const REST_NEAR = 30;
export const REST_FAR = 36;

/**
 * Is (x,z) a free spot for a piece of radius r at mission `id`'s marker (frame `f`)?
 * Dry land, clear of trunks and solid props (a log may lie under a crown: only the
 * trunk counts), of the other missions' markers and of the two story people — and
 * never in the approach corridor, the strip between the lens and the marker's own
 * animal, so the family stands AROUND it and never in front of it.
 */
export function spotFree(env: Pick<ProgressEnv, 'obstacles' | 'blocked' | 'markers' | 'actors'>,
  id: string, f: Frame, x: number, z: number, r: number): boolean {
  if (env.blocked(x, z)) return false;
  for (const o of env.obstacles) if (Math.hypot(o.x - x, o.z - z) < o.r + r + 0.2) return false;
  for (const m of env.markers()) {
    if (m.missionId !== id && Math.hypot(m.x - x, m.z - z) < 1.7 + r) return false;
  }
  for (const a of env.actors()) if (Math.hypot(a.x - x, a.z - z) < 0.8 + r) return false;
  const lx = x - f.ox, lz = z - f.oz;
  const a = lx * f.dx + lz * f.dz, s = -lx * f.dz + lz * f.dx; // back into the marker frame
  if (a < 0.6 && Math.abs(s) < 1.0) return false;
  return true;
}

export class Progress {
  private readonly env: ProgressEnv;
  private readonly built = new Map<string, Built>();
  private readonly pending = new Map<string, Promise<Built | null>>();
  private readonly waiters: { until: number; resolve: () => void }[] = [];
  private clock = 0;

  constructor(env: ProgressEnv) {
    this.env = env;
  }

  /** Is this mission's finished tableau standing (or being built)? */
  has(missionId: string): boolean {
    return this.built.has(missionId) || this.pending.has(missionId);
  }

  /**
   * A mission is finished. Builds its tableau once (a repeat completion only replays
   * the calm moment). `fresh` = it was finished just now: play the reunion; resolves
   * when it has played (at once under `reduced`). `view` = the lens position when
   * fresh, so the family gathers on the side the player is looking from.
   */
  async complete(missionId: string, fresh: boolean, reduced: boolean, view?: ReunionView): Promise<void> {
    const t = TABLEAUS[missionId];
    const m = this.env.markers().find((k) => k.missionId === missionId);
    if (!t || !m) return;
    // finished AT its marker (its games were staged there), or somewhere else: a
    // mission picked on the missiebord is played at the board
    const here = !!view && Math.hypot(view.ranger.x - m.x, view.ranger.z - m.z) <= HERE_R;
    let b = this.built.get(missionId) ?? null;
    if (!b) {
      let job = this.pending.get(missionId);
      if (!job) {
        // finished just now at the marker: laid out in the picture the player is
        // looking at; else as a reload lays it out, as seen from spawn (where the
        // board stands, and where a returning ranger comes from)
        const seen = fresh && here ? view! : null;
        const frame = seen ? reunionFrame(m.x, m.z, seen) : frameAt(m.x, m.z, 0, 0);
        job = this.build(missionId, t, frame, m, fresh && !reduced, seen);
        this.pending.set(missionId, job);
      }
      b = await job;
      this.pending.delete(missionId);
      if (!b) return;
    }
    if (!fresh || reduced) { this.settle(b); return; }
    // away from the marker nobody would see it: the family waits out of sight and
    // comes home the first time the ranger comes to look (update)
    if (!here) { if (b.live.some((l) => l.held)) b.later = true; return; }
    this.startReunion(b);
    await new Promise<void>((resolve) => this.waiters.push({ until: this.clock + REUNION_S, resolve }));
  }

  /** Would a piece of radius r at (x,z) stand in a finished tableau? The tableau of
   *  `except` (the mission being replayed right here — it steps away) is left out. */
  blocks(x: number, z: number, r: number, except: string | null): boolean {
    for (const b of this.built.values()) {
      if (b.missionId === except || !b.group.visible) continue;
      for (const p of b.spots) if (Math.hypot(p.x - x, p.z - z) < p.r + r) return true;
    }
    return false;
  }

  /** Per frame: the reunion walks + fades, the idle breathing, and resting far tableaus.
   *  `activity` = a mission is being played (a waiting family never walks in then). */
  update(t: number, dt: number, reduced: boolean, camera: THREE.Camera, activity = false): void {
    this.clock += dt;
    for (let i = this.waiters.length - 1; i >= 0; i--) {
      if (this.clock >= this.waiters[i].until) { this.waiters[i].resolve(); this.waiters.splice(i, 1); }
    }
    const cx = camera.position.x, cz = camera.position.z;
    for (const b of this.built.values()) {
      if (b.later && !activity && b.group.visible) {
        const m = this.env.markers().find((k) => k.missionId === b.missionId);
        if (m && markerInSight(camera, m.x, this.env.groundY(m.x, m.z) + 0.5, m.z, COME_HOME_R)) {
          b.later = false;
          if (reduced) this.settle(b); else this.startReunion(b); // it comes home now, in view
        }
      }
      const near = b.rest.step(Math.hypot(b.frame.ox - cx, b.frame.oz - cz), dt, reduced);
      for (const l of b.live) {
        if (l.fade !== null) { // the reunion's fade-up
          l.fade = Math.min(1, l.fade + (reduced ? 1 : dt / 1.2));
          if (l.fade >= 1) l.fade = null;
        }
        const alpha = l.held ? 0 : near * (l.fade ?? 1);
        if (alpha !== l.alpha) { l.alpha = alpha; if (alpha > 0) setOpacity(l.mats, alpha); }
        const show = alpha > 0;
        if (l.root.visible !== show) l.root.visible = show;
        if (!show) continue;
        if (l.walk) this.stepWalk(l, dt, reduced);
        l.spawned?.update(dt);
        this.breathe(l, t, reduced);
      }
      const flag = b.flag;
      if (flag.userData.rise !== undefined) {
        const k = reduced ? 1 : Math.min(1, (flag.userData.rise as number) + dt / 1.1);
        flag.userData.rise = k;
        flag.scale.y = Math.max(0.001, easeOut(k));
        if (k >= 1) delete flag.userData.rise;
      }
    }
  }

  /** Dev/test read-back: every tableau's pieces (id + where they stand). */
  state(): { missionId: string; pieces: { id: string; x: number; z: number; y: number }[] }[] {
    return [...this.built.values()].map((b) => ({
      missionId: b.missionId,
      pieces: b.live.map((l) => ({ id: l.piece.id, x: l.x, z: l.z, y: l.y })),
    }));
  }

  /* ------------------------------------------------------------ building ---- */

  private async build(
    missionId: string, t: Tableau, frame: Frame,
    marker: { x: number; z: number; group: THREE.Object3D }, hidden: boolean, view: ReunionView | null,
  ): Promise<Built | null> {
    const env = this.env;
    const markerGroup = marker.group;
    const group = new THREE.Group();
    group.name = `progress-${missionId}`;
    const spots: { x: number; z: number; r: number }[] = [];
    const ground = (x: number, z: number, r: number): boolean =>
      spotFree(env, missionId, frame, x, z, r)
      && !this.blocks(x, z, r, missionId) // a neighbour's family keeps its place
      && spots.every((p) => Math.hypot(p.x - x, p.z - z) >= p.r + r)
      && Math.hypot(x - marker.x, z - marker.z) >= 0.55 + r // the marker's own animal keeps its spot
      && level(env.groundY, x, z, Math.max(0.3, r));
    // a reunion is laid out in the picture; if nothing in reach is, then anywhere free
    const seen = (h: number) => (x: number, z: number, r: number): boolean =>
      ground(x, z, r) && (!view || inReunionView(view, x, env.groundY(x, z) + h * 0.5, z, r));
    const place = (f: Frame, a: number, s: number, r: number, h: number): { x: number; z: number } | null =>
      freeSpot(f, a, s, r, seen(h)) ?? (view ? freeSpot(f, a, s, r, ground) : null);

    // the flag first: it is the "klaar" sign, it must stand — at the marker's own ring
    const fa = t.flag ?? FLAG_AT;
    const atMarker: Frame = { ...frame, ox: marker.x, oz: marker.z };
    const fp = place(atMarker, fa.a, fa.s, 0.15, 1.1) ?? toWorld(atMarker, fa.a, fa.s);
    spots.push({ x: fp.x, z: fp.z, r: 0.15 });
    const flag = finishedFlag();
    flag.position.set(fp.x, env.groundY(fp.x, fp.z), fp.z);
    flag.rotation.y = yawToward(-frame.dx, -frame.dz) + 0.35; // the pennant (and its check) turned to the lens
    if (hidden) { flag.scale.y = 0.001; flag.visible = false; } // it rises when the reunion starts
    group.add(flag);

    const plans = t.pieces.map((p) => {
      const h = p.h ?? (p.kind === 'animal' ? env.heightFor(p.id) : 0.5);
      const r = p.lift ? 0 : Math.max(0.12, h * (p.kind === 'animal' ? 0.45 : 0.6));
      const at = p.lift ? toWorld(frame, p.a, p.s) : place(frame, p.a, p.s, r, h);
      if (at && r > 0) spots.push({ x: at.x, z: at.z, r });
      return { p, h, at };
    });
    // a raven "on the log": it follows the log wherever the log found room
    for (const pl of plans) {
      if (!pl.p.lift) continue;
      const base = plans.find((q) => q !== pl && !q.p.lift && q.p.a === pl.p.a && q.p.s === pl.p.s);
      pl.at = base?.at ?? null;
    }

    const live: Live[] = [];
    await Promise.all(plans.map(async ({ p, h, at }, i) => {
      if (!at) return;
      const s = p.kind === 'animal' ? await env.spawnModel(p.id, { height: h })
        : p.kind === 'den' ? earthDen(h)
        : await env.spawnPlant(p.id, h);
      if (!s) return;
      const root = s.root as THREE.Object3D;
      if (p.antlers === false) {
        root.traverse((o) => { if (/horn|antler|gewei/i.test(o.name)) o.visible = false; });
      }
      if (p.stake) { // strapped to its post: the post stands on the ground, the prop on top
        const post = woodenStake(p.stake);
        root.add(post);
        post.position.y = -p.stake / root.scale.y;
        post.scale.setScalar(1 / root.scale.y);
      }
      const y = env.groundY(at.x, at.z) + (p.lift ?? 0) + (p.stake ?? 0);
      root.position.set(at.x, y, at.z);
      root.rotation.y = facing(p, frame, at);
      const l: Live = {
        piece: p, root, spawned: s, x: at.x, z: at.z, y,
        recipe: p.kind === 'animal' ? gaitFor(modelKey(p.id)) : gaitFor(null),
        phase: i * 1.9 + missionId.length, held: hidden, walk: null, fade: null,
        mats: fadeable(root), alpha: 1, // (collected before a rider is attached: each fades on its own)
      };
      if (hidden) { root.visible = false; l.alpha = 0; } // out of sight until the reunion
      group.add(root);
      live.push(l);
    }));
    // a piece that sits ON another (the raven on the log) becomes part of it: one
    // thing standing on the ground, and it moves and rests with its log
    for (const l of live) {
      if (!l.piece.lift) continue;
      const base = live.find((q) => q !== l && !q.piece.lift && q.piece.a === l.piece.a && q.piece.s === l.piece.s);
      if (base) { base.root.attach(l.root); l.riding = true; }
    }

    const b: Built = { missionId, group, frame, live, flag, spots, later: false, rest: new FarRest(REST_NEAR, REST_FAR) };
    env.scene.add(group);
    this.built.set(missionId, b);
    // a replay of this mission stages its game right here: the tableau steps away
    // with the marker's animal (play/stage.ts hides `companions` with it)
    const companions = (markerGroup.userData.companions as THREE.Object3D[] | undefined) ?? [];
    markerGroup.userData.companions = [...companions, group];
    return b;
  }

  /** Everything at its place at once (a reload, a replay, reduced motion). */
  private settle(b: Built): void {
    b.later = false;
    b.flag.visible = true;
    for (const l of b.live) {
      l.walk = null;
      l.held = false;
      l.root.visible = true;
      if (!l.riding) l.root.position.set(l.x, l.y, l.z);
      l.fade = null;
      l.alpha = 1;
      setOpacity(l.mats, 1); // (the next frame fades it by its distance)
    }
    b.flag.scale.y = 1;
    delete b.flag.userData.rise;
  }

  /** The reunion: the flag rises, the props fade up, and the arriving animals start
   *  a few metres out and walk in. A tableau already standing (a replay) just stands. */
  private startReunion(b: Built): void {
    if (!b.flag.visible) { b.flag.visible = true; b.flag.userData.rise = 0; }
    for (const l of b.live) {
      if (!l.held) continue;
      l.held = false;
      if (!(l.piece.kind === 'animal' && l.piece.arrive)) { l.fade = 0; continue; } // it fades up
      // start 2.4 m further out from the marker, on the line through their spot
      let ox = l.x - b.frame.ox, oz = l.z - b.frame.oz;
      const len = Math.hypot(ox, oz) || 1;
      ox /= len; oz /= len;
      let fx = l.x + ox * 2.4, fz = l.z + oz * 2.4;
      if (!spotFree(this.env, b.missionId, b.frame, fx, fz, 0.2)) { fx = l.x + ox * 1.2; fz = l.z + oz * 1.2; }
      l.walk = { fx, fz, t: 0 };
      l.root.position.set(fx, this.env.groundY(fx, fz), fz);
      l.root.visible = true;
      l.spawned?.clip?.('walk');
    }
  }

  private stepWalk(l: Live, dt: number, reduced: boolean): void {
    const w = l.walk!;
    w.t = reduced ? 1 : Math.min(1, w.t + dt / (REUNION_S - 0.3));
    const k = easeInOut(w.t);
    const x = w.fx + (l.x - w.fx) * k, z = w.fz + (l.z - w.fz) * k;
    l.root.position.set(x, this.env.groundY(x, z) + (l.piece.lift ?? 0), z);
    if (w.t >= 1) { l.walk = null; l.root.position.set(l.x, l.y, l.z); l.spawned?.clip?.('idle'); }
  }

  /** Calm procedural breathing for the static-mesh animals (the rigged ones idle). */
  private breathe(l: Live, t: number, reduced: boolean): void {
    if (l.piece.kind !== 'animal' || l.walk) return;
    const inner = (l.root as THREE.Group).children[0];
    if (!inner || (l.spawned as { rigged?: boolean } | null)?.rigged) return;
    const d = reduced ? REST : motionAt(l.recipe, t, l.phase);
    inner.position.y = (inner.userData.baseY ??= inner.position.y) + d.dy;
    inner.scale.y = (inner.userData.baseSY ??= inner.scale.y) * d.scaleY;
  }
}

/* ---------------------------------------------------------------- helpers ---- */

/** Flat enough to stand on: the ground over the footprint rises less than a hand. */
export function level(groundY: (x: number, z: number) => number, x: number, z: number, r: number): boolean {
  const ys = [groundY(x + r, z), groundY(x - r, z), groundY(x, z + r), groundY(x, z - r)];
  return Math.max(...ys) - Math.min(...ys) < 0.22 + r * 0.25;
}

function easeInOut(t: number): number { return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; }
function easeOut(t: number): number { return 1 - (1 - t) ** 3; }

/** The world GLB id the procedural gait table knows an animal by. */
function modelKey(id: string): string {
  const m: Record<string, string> = {
    heikikker: 'animal-heikikker-frog', adder: 'animal-adder-snake', heideblauwtje: 'animal-heideblauwtje-butterfly',
  };
  return m[id] ?? `animal-${id}`;
}

function facing(p: Piece, f: Frame, at: { x: number; z: number }): number {
  const back = yawToward(-f.dx, -f.dz); // looking back down the approach, at the lens
  if (p.face === 'hero') {
    const hx = f.ox - at.x, hz = f.oz - at.z;
    return Math.hypot(hx, hz) < 1e-3 ? back : yawToward(hx, hz);
  }
  if (p.face === 'lens' || p.face === undefined) return back;
  return back + p.face;
}

/** A slim wooden stake (m tall), feet at y=0: what a wildcamera is strapped to. */
function woodenStake(h: number): THREE.Mesh {
  const g = new THREE.CylinderGeometry(0.035, 0.045, h, 6);
  g.translate(0, h / 2, 0);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#6b513a', roughness: 1 }));
  m.name = 'stake';
  return m;
}

/**
 * A fox's earth: a low mound of sandy soil with a dark way in on its front (+z), feet
 * at y=0, `h` m high — one mesh, one draw call (vertex colours). A procedural piece,
 * so it disposes itself.
 */
export function earthDen(h: number): Spawned {
  const geo = new THREE.SphereGeometry(1, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col: number[] = [];
  const soil = new THREE.Color('#7a5a3a'), moss = new THREE.Color('#5d6b35'), hole = new THREE.Color('#1c140e');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    // the entrance: a dark oval low on the front of the mound
    const inHole = z > 0.55 && Math.abs(x) < 0.38 && y < 0.55;
    c.copy(inHole ? hole : soil).lerp(inHole ? hole : moss, inHole ? 0 : Math.max(0, y - 0.6));
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.scale(h * 2.2, h, h * 1.8);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'den';
  const root = new THREE.Group();
  root.add(mesh);
  return {
    root,
    update: () => {},
    rigged: false,
    dispose: () => { root.removeFromParent(); geo.dispose(); mat.dispose(); },
  };
}

/**
 * The "klaar" flag: a slim wooden pole with a green pennant carrying a white check,
 * readable from both sides — ONE mesh, one draw call (vertex colours), ~1.1 m tall.
 */
export function finishedFlag(): THREE.Mesh {
  const pos: number[] = [];
  const col: number[] = [];
  const push = (c: THREE.Color, ...v: number[]): void => {
    for (let i = 0; i < v.length; i += 3) { pos.push(v[i], v[i + 1], v[i + 2]); col.push(c.r, c.g, c.b); }
  };
  const wood = new THREE.Color('#6b513a');
  const green = new THREE.Color('#4f9a5c');
  const white = new THREE.Color('#fdf6e8');
  // the pole: a thin square post, 1.1 m
  const w = 0.03, H = 1.1;
  const c = [[-w, -w], [w, -w], [w, w], [-w, w]];
  for (let i = 0; i < 4; i++) {
    const [x0, z0] = c[i], [x1, z1] = c[(i + 1) % 4];
    push(wood, x0, 0, z0, x1, 0, z1, x1, H, z1, x0, 0, z0, x1, H, z1, x0, H, z0);
  }
  push(wood, -w, H, -w, w, H, -w, w, H, w, -w, H, -w, w, H, w, -w, H, w);
  // the pennant: a triangle off the top of the pole
  push(green, w, H - 0.02, 0, w, H - 0.34, 0, 0.44, H - 0.18, 0);
  // the check, on both faces (just proud of the pennant)
  for (const zz of [0.004, -0.004]) {
    const q = (x0: number, y0: number, x1: number, y1: number, t: number): void => {
      const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy);
      const nx = (-dy / l) * t, ny = (dx / l) * t;
      push(white, x0 - nx, y0 - ny, zz, x1 - nx, y1 - ny, zz, x1 + nx, y1 + ny, zz,
        x0 - nx, y0 - ny, zz, x1 + nx, y1 + ny, zz, x0 + nx, y0 + ny, zz);
    };
    q(0.1, H - 0.19, 0.15, H - 0.25, 0.012);
    q(0.15, H - 0.25, 0.26, H - 0.1, 0.012);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }));
  mesh.name = 'klaar-flag';
  return mesh;
}
