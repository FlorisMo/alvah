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
  /** Which detail distances the forest uses (world/Forest.ts LOD_RANGES): `laag`
   *  swaps each tree to its lighter copy sooner. */
  readonly treeDetail: QualityTier;
}

export const QUALITY_TIERS: Record<QualityTier, TierParams> = {
  hoog: { pixelRatioCap: 2, vegetationScale: 1, treeDetail: 'hoog' },
  laag: { pixelRatioCap: 1.25, vegetationScale: 0.55, treeDetail: 'laag' },
};

/**
 * The tier a session starts on. A touch-first device (coarse pointer: the iPad) always
 * boots `laag` and earns `hoog` by measurement during the session (the fps probe steps
 * up above STEP_UP_FPS), so a first boot on an older iPad never starts on the heavy
 * tier. A laptop (fine pointer) starts on its last measured verdict (`hoog` when new).
 * The light mode (software GL, below) always boots `laag`.
 */
export function bootTier(saved: QualityTier | undefined, coarsePointer: boolean, light = false): QualityTier {
  if (coarsePointer || light) return 'laag';
  return saved === 'laag' ? 'laag' : 'hoog';
}

/* ------------------------------------------------------------ light mode ---- */
/*
 * A machine with no GPU draws WebGL in SOFTWARE: SwiftShader (headless Chrome on a
 * GPU-less CI runner), Mesa's llvmpipe / softpipe, Microsoft's Basic Render Driver.
 * There the full game draws at seconds per frame, so it boots a LIGHT mode: no MSAA,
 * pixelRatio 1, the `laag` tier, no shadow map, and a sparse title (no heath scatter).
 * The Stage decides it once at boot; a laptop or iPad GPU never matches, so their
 * picture is untouched. `?light=1` forces it on (to look at it on a GPU), `?light=0` off.
 */

/** Whether a GL renderer name is a software rasterizer. */
export function isSoftwareRenderer(renderer: string | null | undefined): boolean {
  return !!renderer && /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer);
}

/** The `?light=` override in a query string: true (1), false (0), or null (detect). */
export function lightOverride(search: string): boolean | null {
  const v = new URLSearchParams(search).get('light');
  return v === '1' ? true : v === '0' ? false : null;
}

/** The renderer pixelRatio: the device ratio, capped by the tier, and at 1 in light mode. */
export function pixelRatioFor(tier: QualityTier, devicePixelRatio: number, light: boolean): number {
  return Math.min(devicePixelRatio, QUALITY_TIERS[tier].pixelRatioCap, light ? 1 : Infinity);
}

/** Which GL renderer this browser draws with, read off a throwaway context: its
 *  RENDERER, or where that is the generic "WebKit WebGL" (Chrome, Safari) the unmasked
 *  name from WEBGL_debug_renderer_info (Firefox reports the real name in RENDERER and
 *  warns when the extension is asked for). Null outside a browser or without WebGL. */
export function glRendererName(): string | null {
  try {
    const gl = document.createElement('canvas').getContext('webgl2') as WebGL2RenderingContext | null;
    if (!gl) return null;
    let name = String(gl.getParameter(gl.RENDERER));
    if (/^webkit webgl$/i.test(name)) {
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      if (info) name = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
    }
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch {
    return null;
  }
}

let light = false;
/** Whether this session renders in the light mode (set once at boot by the Stage). */
export function lightMode(): boolean { return light; }
export function setLightMode(on: boolean): void { light = on; }

/** Whether this device's main pointer is coarse (a finger). False outside a browser. */
export function coarsePointer(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

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
