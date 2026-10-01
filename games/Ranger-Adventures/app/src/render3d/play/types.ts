/**
 * types.ts — the 3D play harness contracts (3D-IMMERSION-PLAN §2, BUILD-PLAN §1f).
 *
 * The render-agnostic spine is frozen: each EF engine's trial builder lives in
 * `engines/*.ts` and every view — 2D (`render2d/*`) or 3D (`render3d/engines/*`)
 * — must emit the SAME `BeatSummary` so skill/DDA scores the identical task
 * (construct parity, §0a). A 3D view renders the activity *into the running
 * world* via a `WorldCtx` instead of tearing the scene down, so mission play is
 * in-place. This module declares the shapes only (no THREE import) so it stays
 * cheap to type against and the resolver beside it carries a pure unit test.
 *
 * THREE-typed handles are kept `unknown` here on purpose: the harness contracts
 * must not drag the THREE namespace into the render-agnostic test surface. The
 * kit (`kit.ts`) and the in-place flow (`Missions.ts`) narrow them at the edge.
 */

import type { BeatSummary, Engine } from '../../core/skill';
import type { Step } from '../../content/types';
import type { Play } from '../../core/play';

/**
 * The live-world handle a 3D engine view renders into. Supplied by the mission
 * runner from the running `World`; the view reframes + restores the camera and
 * raycasts against `scene`, never calling `leaveWorld()`.
 */
export interface WorldCtx {
  /** the live THREE.Scene (typed `unknown` to keep this module THREE-free) */
  scene: unknown;
  /** the live THREE.PerspectiveCamera */
  camera: unknown;
  /** the camera rig the §1e damped follow drives (reframe target lives here) */
  cameraRig: unknown;
  /** the model group the ranger walked up to (the activity anchor), if any */
  approachedModel: unknown | null;
  /** world-space anchor (x,y,z) the activity stages around; y is seated on `groundY` */
  activitySpot: { x: number; y: number; z: number };
  /** The RENDERED-terrain ground height (m) at a world XZ — the raycast ground-snap
   *  truth (World.groundSnapY). Everything a game stages sits on this, per point, and
   *  the lens is kept above it (`safeCamHeight`). */
  groundY(x: number, z: number): number;
  /** 2026-09-26: is a play patch free at world (x,z) within radius `r` (m)? False on the
   *  ven water, inside a tree crown, the cabin, the case-board, the bench, the parked
   *  jeep/heli or another mission's animal — so a stage is planned clear of hub props. */
  isClear(x: number, z: number, r: number): boolean;
  /** the ranger's feet (world x,z) + facing (rad, rotation.y) when the activity began —
   *  the stage keeps him out of the play patch (he stands behind the lens). */
  player: { x: number; z: number; yaw: number };
  /** the ranger's motion right now (live, read it each frame): a game's animals react
   *  to him walking up calmly or running at them. */
  rangerMotion(): RangerMotion;
  /** move the task anchor the dev hook's `cam().taskInView` tests (the planned patch
   *  centre, which the stage may offset from `activitySpot`). */
  setFocus(x: number, y: number, z: number): void;
  /** Load one of the world's OWN animals (GLB manifest id, e.g. `animal-frisling-piglet`)
   *  with the world's dress (eyes, coat, posture, calm pose) at its canonical size
   *  (`AnimalScale`) or `opts.height`. Resolves null when the model is missing. The
   *  spawn owns its materials, so a game's glow never lights the world's copies. */
  spawnModel(id: string, opts?: SpawnOpts): Promise<Spawned | null>;
  /** Load a world vegetation piece (a GLB prop id such as `prop-bramble`, or `gras`
   *  for a grass tuft) at `height` m; null when missing. */
  spawnPlant(id: string, height: number): Promise<Spawned | null>;
  /** a shared THREE.Raycaster for pick3d */
  raycaster: unknown;
  /** the live render canvas — pick3d maps pointer coords + sizes ≥56px hit-spheres against it */
  canvas: HTMLCanvasElement;
  /** the accessible DOM overlay host (cards/choices/read-aloud live here) */
  prompt: HTMLElement;
  /** true when motion must be reduced — views swap moves for cuts */
  reducedMotion: boolean;
  /** 2026-09-27: this step is not the mission's last — when it ends the lens stays on
   *  the play view (no glide back to the ranger), and the next step's one reframe
   *  starts from there: one calm move between two games instead of back-and-forth. */
  keepView?: boolean;
  /** the follow camera's pose from before the mission's FIRST step — where the last
   *  step's glide back returns to (default: the pose when this step began) */
  home?: { pos: { x: number; y: number; z: number }; look: { x: number; y: number; z: number } } | null;
}

/** How the ranger moves right now (`World.rangerMotion`, `WorldCtx.rangerMotion`). */
export interface RangerMotion {
  /** where he stands (world x, z) */
  x: number;
  z: number;
  /** the way he faces (rad, rotation.y: he looks along (sin, cos)) */
  heading: number;
  /** his ground speed (m/s) after collisions: 0 standing still, riding or in a game */
  speed: number;
  /** the run gait is on (Shift, or the stick at its rim) */
  running: boolean;
}

/** Options for `WorldCtx.spawnModel`. */
export interface SpawnOpts {
  /** stand height (m); default = the world's canonical size for that model */
  height?: number;
  /** play the model's calm idle clip when it has one (default true; frozen under reduced-motion) */
  idle?: boolean;
  /** false = the red-deer model without the stag's antlers (a hind, a calf): hidden
   *  before it is sized, so the body takes the height */
  antlers?: false;
}

/** A model spawned for a mini-game. `root` is a THREE.Group (typed `unknown` here) with
 *  its feet at local y=0; the caller positions it and adds it to the scene. */
export interface Spawned {
  root: unknown;
  /** advance the idle clip (call once per frame); a no-op for static models */
  update(dt: number): void;
  /** true when the model carries baked clips (it animates itself; no procedural bob) */
  rigged?: boolean;
  /** calmly cross-fade to a baked clip ('walk', 'idle', 'graze'); a no-op without one */
  clip?(name: 'walk' | 'idle' | 'graze'): void;
  /** run 6: play the clips at `k` × their speed (a walk matched to the ground speed) */
  rate?(k: number): void;
  /** remove from the scene and free what this spawn created (the GLB stays cached) */
  dispose(): void;
}

/**
 * The 3D play contract — the exact twin of the 2D `PlayFn`, but handed a live
 * `WorldCtx` so it plays in-place. Consumes the same frozen trial builder and
 * MUST resolve the same `BeatSummary` as its 2D twin (proven by the per-engine
 * parity test, §0a). Run 7: `play` is the mission's play (its forks draw the trial, the
 * same draws as the 2D twin's).
 */
export type Play3dFn = (ctx: WorldCtx, step: Step, play?: Play) => Promise<BeatSummary>;

/**
 * A registered 3D engine variant. `rmSafe` marks a variant whose reduced-motion
 * path is defined (cuts-not-moves, no secondary motion) so the resolver may
 * still serve 3D under reduced-motion; otherwise reduced-motion falls to 2D.
 * A variant is only listed once its construct-parity test is green (§4 gate).
 */
export interface Play3dEngine {
  engine: Engine;
  play: Play3dFn;
  /** the variant's reduced-motion path is defined + audited */
  rmSafe: boolean;
}
