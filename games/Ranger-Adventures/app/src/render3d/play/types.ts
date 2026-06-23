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
  /** world-space anchor (x,y,z) the activity stages around */
  activitySpot: { x: number; y: number; z: number };
  /** a shared THREE.Raycaster for pick3d */
  raycaster: unknown;
  /** the live render canvas — pick3d maps pointer coords + sizes ≥56px hit-spheres against it */
  canvas: HTMLCanvasElement;
  /** the accessible DOM overlay host (cards/choices/read-aloud live here) */
  prompt: HTMLElement;
  /** true when motion must be reduced — views swap moves for cuts */
  reducedMotion: boolean;
}

/**
 * The 3D play contract — the exact twin of the 2D `PlayFn`, but handed a live
 * `WorldCtx` so it plays in-place. Consumes the same frozen trial builder and
 * MUST resolve the same `BeatSummary` as its 2D twin (proven by the per-engine
 * parity test, §0a).
 */
export type Play3dFn = (ctx: WorldCtx, step: Step) => Promise<BeatSummary>;

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
