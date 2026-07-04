import * as THREE from 'three';
import { livePolicy } from './MotionMode';

/** Called once per rendered frame, AFTER the render (so renderer.info is fresh). */
export type FrameCallback = (dtSeconds: number, elapsedSeconds: number) => void;

const HEATH = new THREE.Color('#8a9a55');
const FOG = new THREE.Color('#e9b27f');
// Echoes of the Veluwe biome palette (Biomes.ts) so the title reads like the
// world beyond the Begin button: heather bloom, pine + birch greens, sand path.
const HEATHER = new THREE.Color('#9a6aa8');
const PINE_GREEN = new THREE.Color('#2f6b46');
const BIRCH_GREEN = new THREE.Color('#88a24d');
const SAND = new THREE.Color('#d0bd90');

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
  // F-18: the draw-call count sampled the instant AFTER each render, when
  // renderer.info is fresh. The dev hook returns THIS (not a poll of
  // renderer.info at an arbitrary later moment), so a <150-budget assert reads a
  // stable same-frame number instead of the ±18 noise Run A saw between frames.
  private lastDrawCalls = 0;
  // F-04: one soft radial blob texture, baked once and shared by every title
  // blob shadow (the same cheap grounding the world uses).
  private static blobTex: THREE.Texture | null = null;
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
    this.addSandPath();
    this.addBackdrop();

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

  /** A soft sand track curving into the tree line — a quiet Veluwe cue that also
   *  gives the flat backdrop some depth (F-04). One flat plane, one draw call. */
  private addSandPath(): void {
    const geo = new THREE.PlaneGeometry(2.6, 24);
    geo.rotateX(-Math.PI / 2); // lie flat once
    const path = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: SAND, roughness: 1, metalness: 0 }));
    path.rotation.y = 0.06; // barely off-axis so it doesn't read as a painted stripe
    path.position.set(-0.4, 0.02, -7); // lifted a hair to sit on the heath without z-fighting
    this.scene.add(path);
  }

  /**
   * F-04: the title vignette. Run A shipped six identical dark cones on bare
   * ground — trees floating, nothing that says "Veluwe". This grounds and varies
   * it cheaply: mixed pines + birches of varying size, a heather carpet and a
   * mission-board landmark, each grounded by a soft blob shadow so nothing floats.
   * Every repeated element is instanced, so the whole richer scene still costs
   * only a handful of draw calls — far under the 150 budget. Calm, never-scary.
   */
  private addBackdrop(): void {
    const blobs: Array<readonly [number, number, number]> = []; // [x, z, radius]
    this.addPines(blobs);
    this.addBirches(blobs);
    this.addHeather();
    this.addMissionBoard(blobs);
    this.addBlobShadows(blobs);
  }

  /** Pointed conifers of mixed size — the Veluwe's dark pine stands. */
  private addPines(blobs: Array<readonly [number, number, number]>): void {
    // [x, z, scale]
    const spots: ReadonlyArray<readonly [number, number, number]> = [
      [-4.5, -5.5, 1.15], [-6.8, -9.5, 1.4], [4.6, -6.5, 1.05], [7.2, -11, 1.5],
      [-2.2, -13.5, 1.3], [5.4, -15, 1.55], [-5.2, -16.5, 1.45], [2.6, -18, 1.6],
      [0.4, -21, 1.7],
    ];
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#5b4327', roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: PINE_GREEN, roughness: 1 });
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.16, 1, 6), trunkMat, spots.length);
    const crowns = new THREE.InstancedMesh(new THREE.ConeGeometry(0.85, 2.1, 7), leafMat, spots.length);
    const m = new THREE.Matrix4();
    spots.forEach(([x, z, s], k) => {
      m.makeScale(s, s, s); m.setPosition(x, 0.5 * s, z); trunks.setMatrixAt(k, m);
      m.makeScale(s, s, s); m.setPosition(x, 2.05 * s, z); crowns.setMatrixAt(k, m);
      blobs.push([x, z, 0.75 * s]);
    });
    trunks.instanceMatrix.needsUpdate = true; crowns.instanceMatrix.needsUpdate = true;
    this.scene.add(trunks, crowns);
  }

  /** Rounded broad-leaves that break the row of identical cones (F-04 variety). */
  private addBirches(blobs: Array<readonly [number, number, number]>): void {
    // [x, z, scale]
    const spots: ReadonlyArray<readonly [number, number, number]> = [
      [-3.2, -4.2, 1.05], [3.4, -4.6, 0.95], [6.2, -9, 1.2], [-7.2, -13, 1.25], [1.2, -10.5, 1.1],
    ];
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#c9bfa8', roughness: 1 }); // pale birch bark
    const leafMat = new THREE.MeshStandardMaterial({ color: BIRCH_GREEN, roughness: 1, flatShading: true });
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.13, 1.6, 6), trunkMat, spots.length);
    const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.05, 0), leafMat, spots.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const squash = new THREE.Vector3(); // slightly flattened crown → clearly not a cone
    spots.forEach(([x, z, s], k) => {
      m.makeScale(s, s, s); m.setPosition(x, 0.8 * s, z); trunks.setMatrixAt(k, m);
      squash.set(s, s * 0.85, s);
      m.compose(new THREE.Vector3(x, 1.9 * s, z), q, squash);
      crowns.setMatrixAt(k, m);
      blobs.push([x, z, 0.85 * s]);
    });
    trunks.instanceMatrix.needsUpdate = true; crowns.instanceMatrix.needsUpdate = true;
    this.scene.add(trunks, crowns);
  }

  /** A low heather carpet — the Veluwe's signature purple bloom (F-04). */
  private addHeather(): void {
    const spots: ReadonlyArray<readonly [number, number]> = [
      [-1.5, 2], [1.6, 2.5], [-3, 0.5], [3.2, 0.8], [-2, -1.5], [2.4, -1],
      [-4, -2.5], [4.2, -2], [-1, -4], [1.4, -4.5], [-5.5, -6], [5.2, -7],
      [-3.5, -8], [3.8, -9.5], [-2.5, -11], [2, -12.5],
    ];
    const mat = new THREE.MeshStandardMaterial({ color: HEATHER, roughness: 1, flatShading: true });
    const tufts = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.3, 0), mat, spots.length);
    const m = new THREE.Matrix4();
    spots.forEach(([x, z], k) => {
      const s = 0.5 + ((k * 7) % 5) * 0.09; // deterministic size jitter (no Math.random)
      m.makeScale(s, s * 0.6, s); m.setPosition(x, 0.12, z);
      tufts.setMatrixAt(k, m);
    });
    tufts.instanceMatrix.needsUpdate = true;
    this.scene.add(tufts);
  }

  /** One recognizable landmark: the mission board, echoing World.proceduralBoard. */
  private addMissionBoard(blobs: Array<readonly [number, number, number]>): void {
    const board = new THREE.Group();
    board.position.set(2.4, 0, -5.6);
    board.rotation.y = -0.4; // three-quarter view, cork face toward the camera
    const postMat = new THREE.MeshStandardMaterial({ color: '#6b513a', roughness: 1 });
    const post1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 6), postMat);
    post1.position.set(-0.5, 0.7, 0);
    const post2 = post1.clone(); post2.position.x = 0.5;
    const cork = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.9, 0.08),
      new THREE.MeshStandardMaterial({ color: '#c8a36a', roughness: 1 }),
    );
    cork.position.set(0, 1.3, 0);
    board.add(post1, post2, cork);
    this.scene.add(board);
    blobs.push([2.4, -5.6, 0.95]);
  }

  /** One instanced set of soft blob discs so no tree or prop floats (F-04). */
  private addBlobShadows(blobs: ReadonlyArray<readonly [number, number, number]>): void {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2); // lie flat once; instances only scale + translate
    const mat = new THREE.MeshBasicMaterial({
      map: Stage.getBlobTexture(), transparent: true, depthWrite: false,
    });
    const discs = new THREE.InstancedMesh(geo, mat, blobs.length);
    discs.renderOrder = 1;
    const m = new THREE.Matrix4();
    blobs.forEach(([x, z, r], k) => {
      m.makeScale(r * 2, 1, r * 2); m.setPosition(x, 0.03, z);
      discs.setMatrixAt(k, m);
    });
    discs.instanceMatrix.needsUpdate = true;
    this.scene.add(discs);
  }

  /** F-04: a soft radial blob (dark centre → transparent rim), baked once and
   *  shared by every title blob shadow — the same cheap grounding the world uses. */
  private static getBlobTexture(): THREE.Texture {
    if (Stage.blobTex) return Stage.blobTex;
    const N = 64;
    const cv = document.createElement('canvas');
    cv.width = cv.height = N;
    const ctx = cv.getContext('2d')!;
    const g = ctx.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
    g.addColorStop(0, 'rgba(30,24,12,0.5)');
    g.addColorStop(0.6, 'rgba(30,24,12,0.24)');
    g.addColorStop(1, 'rgba(30,24,12,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, N, N);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    Stage.blobTex = tex;
    return tex;
  }

  onFrame(cb: FrameCallback): void {
    this.frameCbs.push(cb);
  }

  /** F-18: the draw calls of the most recently rendered frame, captured the
   *  instant after render (renderer.info fresh). The dev hook reads this. */
  get drawCalls(): number {
    return this.lastDrawCalls;
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
      this.lastDrawCalls = this.renderer.info.render.calls; // F-18: same-frame sample
      for (const cb of this.frameCbs) cb(dt, t);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  private updateCamera(t: number): void {
    // idle title/lodge sway is SECONDARY motion → off under the live policy (no restart)
    if (!livePolicy().secondaryMotion) {
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
