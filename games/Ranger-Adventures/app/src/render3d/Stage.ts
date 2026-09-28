import * as THREE from 'three';
import { GOLDEN_HOUR } from './Lighting';
import { provideRenderView, provideTris, provideFrames, provideRenderMode } from '../core/devhook';
import { glRendererName, isSoftwareRenderer, lightOverride, setLightMode } from '../core/quality';

/** Called once per rendered frame, AFTER the render (so renderer.info is fresh). */
export type FrameCallback = (dtSeconds: number, elapsedSeconds: number) => void;

/** What the Stage renders: the one explorable world (render3d/World.ts). */
export interface StageView {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  update: (dt: number, t: number) => void;
}

/**
 * The 3D render layer: the one WebGL renderer and the frame loop. It draws the world
 * (World.ts) from the moment it is built at boot; the title and the ranger maker are
 * shots of that same world (world/Presenter.ts), never a second scene. Until the world
 * is handed over the loop clears to the golden-hour horizon colour, under the boot veil.
 *
 * Motion-comfort (BUILD-PLAN §1e) lives with the cameras that move: roll 0, fixed FOV.
 */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;

  private readonly canvas: HTMLCanvasElement;
  private readonly clock = new THREE.Clock();
  private readonly frameCbs: FrameCallback[] = [];
  // before the world exists: an empty scene in the horizon colour (the veil covers it)
  private readonly empty = new THREE.Scene();
  private readonly emptyCam = new THREE.PerspectiveCamera(55, 1, 0.1, 10);
  private world: StageView | null = null;
  private running = false;
  private rafId = 0;
  // F-18: the draw-call count sampled the instant AFTER each render, when
  // renderer.info is fresh. The dev hook returns THIS (not a poll of
  // renderer.info at an arbitrary later moment), so a <150-budget assert reads a
  // stable same-frame number instead of the ±18 noise Run A saw between frames.
  private lastDrawCalls = 0;
  /** Software GL (no GPU): no MSAA, pixelRatio 1, and the world boots its light mode
   *  (core/quality.ts). Decided once, before the WebGL context exists. */
  readonly light: boolean;
  private frameCount = 0; // rendered frames, for tests that count frames instead of seconds

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    const glName = glRendererName();
    this.light = lightOverride(location.search) ?? isSoftwareRenderer(glName);
    setLightMode(this.light);
    // MSAA is a context attribute, so the light mode must be known before this line
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.light, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.light ? 1 : 2)); // cap for iPad fill-rate
    provideRenderMode(() => ({ light: this.light, renderer: glName }));
    provideFrames(() => this.frameCount);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = GOLDEN_HOUR.exposure; // the one golden-hour exposure (world, games)
    // dev hook: the golden-path probes measure exactly what this Stage renders
    provideRenderView(() => this.view);
    provideTris(() => this.renderer.info.render.triangles);
    this.empty.background = new THREE.Color(GOLDEN_HOUR.fogColor);

    this.resize();
    window.addEventListener('resize', this.resize);
  }

  onFrame(cb: FrameCallback): void {
    this.frameCbs.push(cb);
  }

  /** The scene + camera the loop renders now. */
  get view(): { scene: THREE.Scene; camera: THREE.PerspectiveCamera } {
    return this.world ?? { scene: this.empty, camera: this.emptyCam };
  }

  /** F-18: the draw calls of the most recently rendered frame, captured the
   *  instant after render (renderer.info fresh). The dev hook reads this. */
  get drawCalls(): number {
    return this.lastDrawCalls;
  }

  /** Hand rendering to the world (built once at boot, never torn down). */
  enterWorld(world: StageView): void {
    this.world = world;
    this.resize();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    const loop = () => {
      if (!this.running) return;
      this.rafId = requestAnimationFrame(loop);
      const dt = this.clock.getDelta();
      const t = this.clock.elapsedTime;
      this.world?.update(dt, t);
      const { scene, camera } = this.view;
      this.renderer.render(scene, camera);
      this.lastDrawCalls = this.renderer.info.render.calls; // F-18: same-frame sample
      this.frameCount += 1;
      for (const cb of this.frameCbs) cb(dt, t);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  private resize = (): void => {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    for (const cam of [this.emptyCam, this.world?.camera]) {
      if (!cam) continue;
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    }
  };
}
