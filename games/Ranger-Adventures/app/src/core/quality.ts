/**
 * quality.ts — adaptive quality tiers (WORLD-PLAN W7.2). A pure, THREE-free
 * fps probe measures the world's frame rate over fixed windows and steps a
 * two-level quality tier down (or back up) with HYSTERESIS, so a weaker device
 * (older iPad) drops fill-rate before it stutters and never flip-flops on the
 * boundary.
 *
 * Two knobs ride the tier (both named in the plan): the renderer pixelRatio cap
 * and the vegetation-scatter density. `laag` roughly halves both. The resolved
 * tier is PERSISTED via state.ts settings (the `ranger` namespace — no new
 * localStorage key), so a slow device boots straight into the lighter tier next
 * time instead of re-probing the jank.
 *
 * Only the timing/decision logic lives here (unit-tested); the World owns the
 * per-frame sampling and applies the resolved knobs.
 */

export type QualityTier = 'hoog' | 'laag';

export interface TierParams {
  /** Cap applied against `window.devicePixelRatio` (fill-rate — the big iPad win). */
  readonly pixelRatioCap: number;
  /** Multiplier on the vegetation-scatter budgets (geometry/vertex load). */
  readonly vegetationScale: number;
}

export const QUALITY_TIERS: Record<QualityTier, TierParams> = {
  hoog: { pixelRatioCap: 2, vegetationScale: 1 },
  laag: { pixelRatioCap: 1.25, vegetationScale: 0.55 },
};

/** How long each fps window measures before it emits an average and decides. */
export const PROBE_WINDOW_SEC = 5;

/**
 * Hysteresis band (average fps). Step DOWN to `laag` only below the low mark;
 * step back UP to `hoog` only above the high mark. The dead zone between the two
 * keeps the tier stable — a device hovering around ~45 fps never oscillates.
 */
export const STEP_DOWN_FPS = 40;
export const STEP_UP_FPS = 55;

/** Resolve the next tier from the current one and a windowed average fps. */
export function nextTier(current: QualityTier, avgFps: number): QualityTier {
  if (current === 'hoog' && avgFps < STEP_DOWN_FPS) return 'laag';
  if (current === 'laag' && avgFps > STEP_UP_FPS) return 'hoog';
  return current;
}

/**
 * Accumulate frame dt over a fixed window and emit the average fps once the
 * window closes, then reset. Pure timing — no THREE, no clock. Frames with a
 * non-positive or absurd dt (tab-switch / debugger stall) are ignored so a
 * single spike can never poison a window.
 */
export class FpsProbe {
  private acc = 0;
  private frames = 0;
  private readonly windowSec: number;

  constructor(windowSec: number = PROBE_WINDOW_SEC) {
    this.windowSec = windowSec;
  }

  /** Feed one frame's dt (seconds). Returns the window average fps when a window
   *  completes, else null. */
  sample(dt: number): number | null {
    if (!(dt > 0) || dt > 1) return null;
    this.acc += dt;
    this.frames += 1;
    if (this.acc < this.windowSec) return null;
    const fps = this.frames / this.acc;
    this.acc = 0;
    this.frames = 0;
    return fps;
  }
}
