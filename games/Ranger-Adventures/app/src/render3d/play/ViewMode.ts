/**
 * ViewMode.ts — the one place the mission runner decides 3D vs the 2D floor
 * (3D-IMMERSION-PLAN §2 + §4 acceptance, BUILD-PLAN §1f). Pure + THREE-free so
 * it carries a seeded unit test like every render3d construct (§9e).
 *
 * Contract (frozen, §0b): the 2D `render2d/*` view is the ALWAYS-AVAILABLE
 * floor; 3D is additive and only chosen when every gate passes. The resolver
 * branches the runMission loop exactly once, so logic never duplicates and the
 * game never blocks — any failed gate keeps serving 2D.
 */

import type { Play3dEngine } from './types';
import type { Engine } from '../../core/skill';

export type ViewMode = '2d' | '3d';

/** Everything the resolver weighs. All explicit (no globals) so it is pure. */
export interface ViewModeReq {
  /** the engine the current step asks for */
  engine: Engine;
  /** the 3D world is loaded + live (false during a torn-down/boot state) */
  sceneLive: boolean;
  /** the device can render WebGL (probe once at boot; pass the cached result) */
  webglCapable: boolean;
  /** motion must be reduced (OS query OR the in-game toggle) */
  reducedMotion: boolean;
  /** demo/Tweaks "always use the 2D view" override (forces the floor) */
  force2d: boolean;
  /** the registry of shipped, parity-green 3D variants */
  registry: readonly Play3dEngine[];
}

/** The registered 3D variant for an engine, or undefined if none ships yet. */
export function variantFor(
  registry: readonly Play3dEngine[],
  engine: Engine,
): Play3dEngine | undefined {
  return registry.find((v) => v.engine === engine);
}

/**
 * Pick the view for a step. Returns `'3d'` only when ALL hold:
 *  - not forced to the 2D floor (demo/Tweaks),
 *  - the world scene is live,
 *  - the device is WebGL-capable,
 *  - a parity-green 3D variant ships for this engine, AND
 *  - motion is fine, OR that variant declares a reduced-motion-safe path.
 * Otherwise the 2D floor. Deterministic: same req → same mode.
 */
export function resolveViewMode(req: ViewModeReq): ViewMode {
  if (req.force2d) return '2d';
  if (!req.sceneLive) return '2d';
  if (!req.webglCapable) return '2d';
  const variant = variantFor(req.registry, req.engine);
  if (!variant) return '2d';
  if (req.reducedMotion && !variant.rmSafe) return '2d';
  return '3d';
}
