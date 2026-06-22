import * as THREE from 'three';
import { prefersReducedMotion } from '../core/reduced-motion';

/** Called once per rendered frame, AFTER the render (so renderer.info is fresh). */
export type FrameCallback = (dtSeconds: number, elapsedSeconds: number) => void;

const HEATH = new THREE.Color('#8a9a55');
const FOG = new THREE.Color('#e9b27f');

/**
 * The 3D render layer. Phase 0: a calm golden-hour Veluwe stage proving the
 * pipeline (WebGL2, sRGB, ACES) and the draw-call budget. The EF engines and
 * content are render-agnostic and live elsewhere; this is one swappable layer.
 *
 * Motion-comfort (BUILD-PLAN §1e): roll is always 0, no head-bob, fixed FOV,
 * and the gentle idle sway is disabled entirely under reduced-motion.
 */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;

  private readonly canvas: HTMLCanvasElement;
  private readonly clock = new THREE.Clock();
  private readonly frameCbs: FrameCallback[] = [];
  private readonly camBase = new THREE.Vector3(0, 1.6, 6.5);
  private readonly camTarget = new THREE.Vector3(0, 1.1, 0);
  private running = false;
  private rafId = 0;
  /** when set, the loop renders this scene/camera instead of the title backdrop */
  private world: { scene: THREE.Scene; camera: THREE.PerspectiveCamera; update: (dt: number, t: number) => void } | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // cap for iPad fill-rate
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.background = this.makeSkyTexture();
    this.scene.fog = new THREE.Fog(FOG, 16, 64);

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200); // fixed FOV — no dynamic FOV
    this.camera.position.copy(this.camBase);
    this.camera.lookAt(this.camTarget);

    this.addLights();
    this.addGround();
    this.addPlaceholderPines();

    this.resize();
    window.addEventListener('resize', this.resize);
  }

  /** Vertical golden-hour gradient as the sky background. */
  private makeSkyTexture(): THREE.Texture {
    const c = document.createElement('canvas');
    c.width = 2;
    c.height = 256;
    const ctx = c.getContext('2d');
    if (ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, '#fde8c8');
      g.addColorStop(0.55, '#f6cf9e');
      g.addColorStop(1, '#e9b27f');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 2, 256);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private addLights(): void {
    this.scene.add(new THREE.HemisphereLight(0xfde8c8, 0x6d8a45, 0.9));
    const sun = new THREE.DirectionalLight(0xffe6b0, 1.6);
    sun.position.set(-6, 5, 4); // low, warm, raking light
    this.scene.add(sun);
  }

  private addGround(): void {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: HEATH, roughness: 1, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);
  }

  /** A few low-poly pines so the scene reads as nature and the budget overlay shows real draw calls. */
  private addPlaceholderPines(): void {
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#5b4327', roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: '#2f6b46', roughness: 1 });
    const spots: ReadonlyArray<readonly [number, number]> = [
      [-3, -4], [4, -6], [-6, -9], [2, -3], [7, -11], [-1.5, -13], [5.5, -16],
    ];
    for (const [x, z] of spots) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1, 6), trunkMat);
      trunk.position.set(x, 0.5, z);
      const crown = new THREE.Mesh(new THREE.ConeGeometry(0.85, 2.1, 7), leafMat);
      crown.position.set(x, 2.05, z);
      this.scene.add(trunk, crown);
    }
  }

  onFrame(cb: FrameCallback): void {
    this.frameCbs.push(cb);
  }

  /** Hand rendering to an explorable world (keeps the one renderer + budget overlay). */
  enterWorld(world: { scene: THREE.Scene; camera: THREE.PerspectiveCamera; update: (dt: number, t: number) => void }): void {
    this.world = world;
    this.resize();
  }

  /** Return to the title backdrop. */
  exitWorld(): void {
    this.world = null;
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
      if (this.world) {
        this.world.update(dt, t);
        this.renderer.render(this.world.scene, this.world.camera);
      } else {
        this.updateCamera(t);
        this.renderer.render(this.scene, this.camera);
      }
      for (const cb of this.frameCbs) cb(dt, t);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  private updateCamera(t: number): void {
    if (prefersReducedMotion()) {
      this.camera.position.copy(this.camBase);
    } else {
      const sway = Math.sin(t * 0.18) * 0.25; // barely-there breathing motion
      this.camera.position.set(this.camBase.x + sway, this.camBase.y, this.camBase.z);
    }
    this.camera.up.set(0, 1, 0); // roll = 0, always
    this.camera.lookAt(this.camTarget);
  }

  private resize = (): void => {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.world) {
      this.world.camera.aspect = w / h;
      this.world.camera.updateProjectionMatrix();
    }
  };
}
