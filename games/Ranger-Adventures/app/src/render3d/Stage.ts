import * as THREE from 'three';
import { livePolicy } from './MotionMode';
import { GOLDEN_HOUR, addGoldenHourHemi, makeGoldenHourSun, makeSkyDome } from './Lighting';
import { BIOME_GROUND_TONES, GROUND_BRIGHTEN, heathCover, vertexTint } from './GroundDetail';
import { groundMaterial, mottleTexture } from './GroundMaterial';
import { heatherGeometry, plantMaterial, tuftGeometry } from './world/Plants';
import { RANGER_STAND_HEIGHT, SIZE, standHeightFor } from './AnimalScale';
import { provideRenderView, provideTris, provideFrames, provideRenderMode } from '../core/devhook';
import { dressRanger } from './RangerLook';
import { glRendererName, isSoftwareRenderer, lightOverride, setLightMode } from '../core/quality';

/** The real staged tree species — the SAME GLBs the explorable world plants
 *  (World.ts TreeSpecies), so the title tree line and the world tree line are
 *  one material language (RUN-C-DIRECTION §2.3 / §3.1). */
type TitleTree = 'prop-pine-scots' | 'prop-oak-tree' | 'prop-birch-tree';

/** Called once per rendered frame, AFTER the render (so renderer.info is fresh). */
export type FrameCallback = (dtSeconds: number, elapsedSeconds: number) => void;

const FOG = new THREE.Color(GOLDEN_HOUR.fogColor); // shared golden-hour horizon (P1.1)
/** How much further from the lens the title's real trees and cabin stand than where the
 *  line was first composed (with 6 m trees and a 3 m cabin): at their true size (run 6)
 *  this keeps the crowns in frame and the cabin from crowding the ranger. */
const TITLE_TREE_BACK = 1.55;
const TITLE_CABIN_BACK = 1.3;
// Echoes of the Veluwe biome palette (Biomes.ts) so the title reads like the
// world beyond the Begin button: pine + birch greens, sand path.
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
  // P1.4: the primitive backdrop is an INSTANT, zero-asset-safe stand-in; the real
  // world props (tree line, prikbord, cabin, grounded ranger) load async and swap
  // over it so the title reads as "the world seen calmly" (RUN-C-DIRECTION §3.1).
  private fallbackTrees: THREE.Group | null = null;
  private titleMixer: THREE.AnimationMixer | null = null;
  private titleRangerH = 0; // measured render height of the title ranger (m); 0 = not loaded
  // P1.4 smoke fix: flips true the instant the player taps "Begin" (markLeavingTitle)
  // or enters the world, so the async title dress stops decoding GLBs on the boot-
  // critical Begin→world path — the eager concurrent decode starved journey/movement.
  private leavingTitle = false;
  // D3.17: the real-GLB title props (tree line, prikbord, cabin, grounded ranger) live in
  // ONE tracked group so a RE-DRESS can manage them. `titleDressGen` cancels a stale async
  // dress the moment a newer one starts (or the player leaves); `titleDressed` flips true
  // only once the real hero props have swapped in over the primitive stand-ins — the composed
  // title reads at FULL fidelity. The bug this repairs: an early "Begin" BAILS the first dress
  // (the smoke-safety), so a world→title round-trip returned to the bare primitive backdrop —
  // cone pines, a faceted oak, NO cabin (fresh `d17-titlereturn-17`) — and never re-dressed.
  private titleReal: THREE.Group | null = null;
  private titleDressGen = 0;
  private titleDressed = false;
  /** Software GL (no GPU): no MSAA, pixelRatio 1, a sparse title, and the world boots its
   *  light mode (core/quality.ts). Decided once, before the WebGL context exists. */
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
    this.renderer.toneMappingExposure = GOLDEN_HOUR.exposure; // the one golden-hour exposure (title, world, games)
    // dev hook: the golden-path probes measure exactly what this Stage renders
    provideRenderView(() => this.view);
    provideTris(() => this.renderer.info.render.triangles);

    this.scene = new THREE.Scene();
    this.scene.background = FOG.clone();
    this.scene.add(makeSkyDome()); // the same golden-hour sky the world stands under
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

  /** The shared golden-hour rig (P1.1): warm low key + cool-sky / warm-ground
   *  hemisphere fill, identical to the World and Sandbox scenes. */
  private addLights(): void {
    addGoldenHourHemi(this.scene);
    const sun = makeGoldenHourSun();
    sun.position.copy(GOLDEN_HOUR.keyDir); // low, warm, raking key
    this.scene.add(sun);
  }

  /**
   * The heath the title stands on: the SAME ground as the world's heide (GroundMaterial:
   * sand with dry grass broken by mats of muted mauve heather, the fine detail close to
   * the lens), opening to bare sand along the track. One draw call.
   */
  private addGround(): void {
    const geo = new THREE.PlaneGeometry(160, 160, 64, 64);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    const mix = new Float32Array(pos.count * 4);
    const sand = new THREE.Color(BIOME_GROUND_TONES.heide[0]);
    const heath = new THREE.Color(BIOME_GROUND_TONES.heide[1]);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const cover = titleCover(x, z);
      c.copy(sand).lerp(heath, cover).multiplyScalar(GROUND_BRIGHTEN * vertexTint(x, z));
      col.set([c.r, c.g, c.b], i * 3);
      mix.set([cover, 0, (1 - cover) * 0.8, (1 - cover) * 0.6], i * 4);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('groundMix', new THREE.BufferAttribute(mix, 4));
    const ground = new THREE.Mesh(geo, groundMaterial(true, mottleTexture()));
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
    // The primitives live in ONE group so the whole low-poly stand-in can be
    // removed + disposed the instant the real GLB world swaps in (P1.4). The
    // heather carpet stays persistent (it is the heath's purple ground cue, not a
    // low-poly outlier next to the hero).
    const group = new THREE.Group();
    this.fallbackTrees = group;
    const blobs: Array<readonly [number, number, number]> = []; // [x, z, radius]
    this.addPines(group, blobs);
    this.addBirches(group, blobs);
    if (!this.light) this.addHeather(); // the light mode's sparse title: no heath scatter (and no real trees, below)
    this.addMissionBoard(group, blobs);
    this.addBlobShadows(group, blobs);
    this.scene.add(group);
    // P1.4: kick the real-GLB swap off now (the primitives paint first — the
    // dynamic import yields a frame). It loads the props SEQUENTIALLY and BAILS the
    // instant the player taps "Begin" (markLeavingTitle), so it never starves the
    // Begin→world boot the way the earlier all-at-once concurrent decode did — that
    // kept ~10 GLB parses chewing the main thread through the smoke journey and
    // timed it out. A player who dwells on the title — and the capture harness —
    // still gets the fully dressed golden-hour world (RUN-C-DIRECTION §3.1).
    void this.dressTitleReal().catch(() => { /* zero-asset safe: primitives stay */ });
  }

  /** Pointed conifers of mixed size — the Veluwe's dark pine stands. */
  private addPines(parent: THREE.Group, blobs: Array<readonly [number, number, number]>): void {
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
    parent.add(trunks, crowns);
  }

  /** Rounded broad-leaves that break the row of identical cones (F-04 variety). */
  private addBirches(parent: THREE.Group, blobs: Array<readonly [number, number, number]>): void {
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
    parent.add(trunks, crowns);
  }

  /**
   * The heath's plants — the SAME struikhei and straw grass the world's heide grows
   * (world/Plants.ts), heather on the heather mats, grass on the sandier ground, none on
   * the track or under the cabin, the board or the ranger. Three instanced draw calls.
   */
  private addHeather(): void {
    const keepOut: ReadonlyArray<readonly [number, number, number]> = [
      [-6.0, -4.8, 2.8], [2.6, -5.2, 1.3], [-2.3, 2.8, 0.9], // cabin, prikbord, the ranger
    ];
    const heather: THREE.Matrix4[] = [], farHeather: THREE.Matrix4[] = [], grass: THREE.Matrix4[] = [];
    const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    for (let gx = -16; gx <= 16; gx++) for (let gz = -30; gz <= 4; gz++) {
      const h = titleHash(gx, gz);
      const x = gx * 0.95 + (h - 0.5) * 0.8, z = gz * 0.95 + (titleHash(gz, gx) - 0.5) * 0.8;
      if (Math.abs(x + 0.4 - (z + 7) * 0.06) < 2.4 && z < 6) continue;   // the sand track
      if (keepOut.some(([kx, kz, r]) => Math.hypot(x - kx, z - kz) < r)) continue;
      const cover = titleCover(x, z);
      const m = new THREE.Matrix4();
      if (cover > 0.45 + h * 0.35) {
        const s = 0.7 + h * 0.6;
        const far = Math.hypot(x - this.camBase.x, z - this.camBase.z) > 15; // past 15 m a lighter bush
        (far ? farHeather : heather).push(m.compose(new THREE.Vector3(x, 0, z), q.setFromAxisAngle(up, h * 40), new THREE.Vector3(s, s * (0.8 + h * 0.4), s)));
      } else if (h < 0.3) {
        const s = 0.35 + h * 0.8;
        grass.push(m.compose(new THREE.Vector3(x, 0, z), q.setFromAxisAngle(up, h * 31), new THREE.Vector3(s, s, s)));
      }
    }
    const put = (geo: THREE.BufferGeometry, list: THREE.Matrix4[]): void => {
      const inst = new THREE.InstancedMesh(geo, plantMaterial(), Math.max(1, list.length));
      list.forEach((m, k) => inst.setMatrixAt(k, m));
      inst.count = list.length;
      inst.instanceMatrix.needsUpdate = true;
      this.scene.add(inst);
    };
    put(heatherGeometry(5), heather);
    put(heatherGeometry(5, 60), farHeather);
    put(tuftGeometry({ blades: 16, seed: 3, root: '#5f5a30', tip: '#d2bd7e', lean: 0.32 }), grass);
  }

  /** One recognizable landmark: the mission board, echoing World.proceduralBoard. */
  private addMissionBoard(parent: THREE.Group, blobs: Array<readonly [number, number, number]>): void {
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
    parent.add(board);
    blobs.push([2.4, -5.6, 0.95]);
  }

  /** One instanced set of soft blob discs so no tree or prop floats (F-04). */
  private addBlobShadows(parent: THREE.Group, blobs: ReadonlyArray<readonly [number, number, number]>): void {
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
    parent.add(discs);
  }

  /**
   * P1.4: swap the primitive title backdrop for the SAME real GLB props the
   * explorable world plants — a golden-hour Veluwe tree line, the prikbord, the
   * ranger's cabin, and the GROUNDED ranger avatar standing calmly on the heath by
   * the path — so the title IS the world seen calmly (RUN-C-DIRECTION §3.1), not
   * separate menu art. Async + best-effort (a dynamic import keeps the boot shell
   * light per W7.1): the primitives paint instantly and are disposed the moment the
   * real props arrive; a missing model just leaves its primitive (zero-asset safe,
   * the Models.ts contract). Every prop is grounded by a soft blob shadow (§2.2 —
   * nothing floats) and lit by the ONE shared golden rig already on this scene.
   */
  private async dressTitleReal(): Promise<void> {
    if (this.world || this.leavingTitle) return; // already leaving/left the title — dressing is moot
    if (this.titleDressed) return;               // D3.17: the real hero props are already up — idempotent
    const gen = ++this.titleDressGen;            // D3.17: this run's token; a newer (re)dress supersedes it
    const Models = await import('./Models');
    await Models.loadManifest();
    // navigated away / superseded while the chunk loaded
    if (this.world || this.leavingTitle || gen !== this.titleDressGen) return;
    const { loadModel, loadRig, prepModel, renderedHeight } = Models;

    // P1.4 smoke fix: load the real props ONE AT A TIME and BAIL the moment the
    // player leaves the title. The earlier version fired ~10 GLB decodes CONCURRENTLY
    // at every boot; when the smoke test tapped "Begin" a beat later they kept
    // chewing the main thread through the Begin→world→movement path and timed the
    // journey + movement @smoke out. Sequential + bail bounds the boot-path cost to
    // the single prop already mid-decode when "Begin" is tapped (the 30 s smoke
    // budget absorbs one), while a player who DWELLS on the title still fills the
    // scene in incrementally. The ranger rig loads LAST, so a loaded `titleAvatar()`
    // (P1.6a: the child reads >0.9) still doubles as "the title is fully dressed" for
    // the capture snap gate.
    // D3.17: the real props go in ONE tracked group (`titleReal`) so a re-dress after a
    // round-trip can bail-clean exactly its own run; a fresh run also drops any idle mixer a
    // prior bailed run left pointing at a removed rig, so the title never accrues mixers.
    const real = new THREE.Group();
    this.titleReal = real;
    this.titleMixer = null;
    this.scene.add(real);
    // Bail cleanly if the player leaves the title mid-load — OR a newer dress supersedes this
    // one (gen mismatch): drop the partial group (NEVER dispose it — the clones SHARE the
    // world's id-cached geometry/materials, so disposing here would corrupt the props the world
    // reuses) and keep the primitive stand-ins so the title is never bare. `bail()` always
    // returns true, so `left() && bail()` only removes + signals a return when we have left.
    const left = (): boolean => this.world !== null || this.leavingTitle || gen !== this.titleDressGen;
    const bail = (): true => { this.scene.remove(real); if (this.titleReal === real) this.titleReal = null; return true; };

    // The bosrand: mixed real trees framing the clearing + path, the left
    // foreground kept open for the ranger and the centre open for the sand track.
    // A modest count (kind to the iPad tri budget + boot decode) that still reads
    // as a Veluwe tree line. [x, z, species, share of its grown height (AnimalScale)].
    // The light mode (software GL) keeps the cheap primitive tree line and board: the real
    // crowns fill half the screen and cost a software renderer most of each frame.
    const trees: ReadonlyArray<readonly [number, number, TitleTree, number]> = this.light ? [] : [
      [-5.2, -7.5, 'prop-pine-scots', 0.97], [-7.0, -11.5, 'prop-oak-tree', 1.04],
      [-4.0, -13.5, 'prop-birch-tree', 1.0],
      [5.0, -7.5, 'prop-oak-tree', 1.0], [7.0, -11.5, 'prop-pine-scots', 0.97],
      [4.2, -14, 'prop-birch-tree', 1.0], [0.7, -18, 'prop-pine-scots', 1.05],
    ];
    // Grown trees (run 6: ~1.9× the saplings this line was composed with) stand further
    // back from the lens by TITLE_TREE_BACK, so their crowns stay framed above the clearing.
    const back = (x: number, z: number, k: number): [number, number] =>
      [this.camBase.x + (x - this.camBase.x) * k, this.camBase.z + (z - this.camBase.z) * k];
    for (let i = 0; i < trees.length; i++) {
      if (left() && bail()) return;
      const [x0, z0, id, k] = trees[i];
      const h = (standHeightFor(id) ?? 10) * k;
      const [x, z] = back(x0, z0, TITLE_TREE_BACK);
      const m = await loadModel(id);
      if (left() && bail()) return;
      if (!m) continue;
      const p = prepModel(m, h);
      p.position.set(x, 0, z);
      p.rotation.y = (i * 1.3) % (Math.PI * 2); // deterministic facing jitter (no Math.random)
      this.groundProp(real, p, Math.min(1.4, 0.1 * h));
    }

    // The prikbord (real case board), cork face angled toward the approach.
    if (left() && bail()) return;
    const board = this.light ? null : await loadModel('prop-case-board');
    if (left() && bail()) return;
    if (board) {
      const p = prepModel(board, SIZE.missiebord.h);
      p.position.set(2.6, 0, -5.2);
      p.rotation.y = -0.5;
      this.groundProp(real, p, 1.1);
    }

    // The ranger's cabin — the world-entry hero — on the left, angled to the clearing.
    if (left() && bail()) return;
    const cabin = await loadModel('prop-ranger-cabin');
    if (left() && bail()) return;
    if (cabin) {
      const p = prepModel(cabin, SIZE.boshut.h);
      const [cx, cz] = back(-6.0, -4.8, TITLE_CABIN_BACK); // its true 4.5 m, a step further back
      p.position.set(cx, 0, cz);
      p.rotation.y = 0.5;
      this.groundProp(real, p, 2.2);
    }

    // The GROUNDED ranger avatar, standing calmly in the open left lane by the path.
    // He loads LAST (heaviest asset + the capture's "fully dressed" signal): his
    // measured height feeds the scale read (avatar.height: the 1.32 m boy) and the
    // capture's avatar-loaded snap gate the moment he lands.
    if (left() && bail()) return;
    const rig = await loadRig('ranger-alvah');
    if (left() && bail()) return;
    if (rig) {
      const p = prepModel(rig.group, RANGER_STAND_HEIGHT);
      dressRanger(p); // the creator's look, live: this ranger is the maker's 3D preview
      p.position.set(-2.3, 0, 2.8);
      p.rotation.y = Math.PI * 0.86; // face the camera / path — a calm welcome
      p.traverse((o) => { o.frustumCulled = false; }); // F-11: never cull the hero
      this.groundProp(real, p, 0.55);
      // Play the idle clip so he breathes calmly (never a bind-pose T). Idle is
      // SECONDARY motion → frozen under reduced-motion (contract); update(0) seats
      // the rest pose immediately so the RM title still shows a natural stance.
      const idle = rig.clips.find((c) => /idle|rest|stand|breath/i.test(c.name)) ?? rig.clips[0];
      if (idle) {
        this.titleMixer = new THREE.AnimationMixer(p);
        this.titleMixer.clipAction(idle).play();
        this.titleMixer.update(0);
      }
      // Expose the grounded title ranger to the scale read: what he draws
      // (Models.renderedHeight), in his idle pose.
      this.titleRangerH = renderedHeight(p.children[0]) ?? 0;
    }

    // Swap: dispose the primitive stand-ins now every real prop has settled. Guard
    // on real content — a zero-asset env keeps the primitives so the title is never
    // bare (the Models.ts best-effort contract). Only the primitive STAND-INS are
    // disposed (we own them); the real props are never disposed here (see `bail`).
    if (left() && bail()) return;
    if (real.children.length === 0) { if (this.titleReal === real) this.titleReal = null; return; }
    if (this.fallbackTrees && !this.light) { // the light mode keeps its primitive tree line + board
      this.scene.remove(this.fallbackTrees);
      Stage.disposeTree(this.fallbackTrees);
      this.fallbackTrees = null;
    }
    this.titleDressed = true; // D3.17: the composed title now reads at full fidelity (real hero props up)
  }

  /** Ground a real prop with a soft blob shadow (a child disc, so it rides the
   *  prop) and add it to `parent` — the same cheap grounding the world uses
   *  (§2.2: "een zachte slagschaduw grondt het dier ... voorkomt dat het zweeft"). */
  private groundProp(parent: THREE.Group, group: THREE.Group, radius: number): void {
    const disc = new THREE.Mesh(
      new THREE.PlaneGeometry(radius * 2, radius * 2),
      new THREE.MeshBasicMaterial({ map: Stage.getBlobTexture(), transparent: true, depthWrite: false }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.03; // just above the ground, no z-fighting
    disc.renderOrder = 1;
    group.add(disc);
    parent.add(group);
  }

  /** Free the primitive stand-in's geometry + materials once the real props swap in. */
  private static disposeTree(root: THREE.Object3D): void {
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material;
      if (Array.isArray(mat)) mat.forEach((mm) => mm.dispose());
      else if (mat) (mat as THREE.Material).dispose();
    });
  }

  /** P1.4: the grounded title ranger's measured render height (m) for the scale
   *  assert — null until he loads (the world hook's null-before-ready contract). */
  titleAvatar(): { height: number } | null {
    return this.titleRangerH > 0 ? { height: this.titleRangerH } : null;
  }

  /** D3.17: true once the real hero props (cabin + tree line + prikbord) have swapped in over
   *  the primitive stand-ins — the composed title reads at FULL fidelity. False while only the
   *  instant low-poly stand-in is up (a fresh boot mid-dress, or a round-trip mid-re-dress). The
   *  capture holds the title snap until this is true so a composed title is never shot on its
   *  low-LOD stand-in world (fresh `d17-titlereturn-17`: cone pines, faceted oak, no cabin). */
  titleReady(): boolean {
    return this.titleDressed;
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

  /** The scene + camera the loop renders now: the entered world, else the title. */
  get view(): { scene: THREE.Scene; camera: THREE.PerspectiveCamera } {
    return this.world ?? { scene: this.scene, camera: this.camera };
  }

  /** F-18: the draw calls of the most recently rendered frame, captured the
   *  instant after render (renderer.info fresh). The dev hook reads this. */
  get drawCalls(): number {
    return this.lastDrawCalls;
  }

  /** P1.4 smoke fix: the player tapped "Begin" — stop the async title dress from
   *  decoding any more GLBs so it never competes with the world boot on the
   *  Begin→world→movement path (the eager concurrent decode timed the journey +
   *  movement @smoke out at every boot). Called SYNCHRONOUSLY in the Begin handler,
   *  BEFORE `enterWorld` (which only fires once the world is already built — too
   *  late to matter). At most one prop is mid-decode when this flips, which the
   *  smoke budget absorbs; a player who dwells on the title still gets the dress. */
  markLeavingTitle(): void {
    this.leavingTitle = true;
  }

  /** Hand rendering to an explorable world (keeps the one renderer + budget overlay). */
  enterWorld(world: { scene: THREE.Scene; camera: THREE.PerspectiveCamera; update: (dt: number, t: number) => void }): void {
    this.world = world;
    this.leavingTitle = true; // in the world → title dressing is moot (belt-and-suspenders with markLeavingTitle)
    this.resize();
  }

  /** Return to the title backdrop. */
  exitWorld(): void {
    this.world = null;
    // D3.17: back on the title — clear the leave flag (enterWorld / markLeavingTitle set it to
    // BAIL the async dress) so a re-dress can run, and re-dress the real hero props if the title
    // is still on its primitive stand-ins. An early "Begin" bails the first dress, so a round-trip
    // returned to cone pines + no cabin (`d17-titlereturn-17`); the world session left every title
    // GLB warm in the Models cache, so this re-dress is a fast swap, not a re-download. Skipped when
    // the title never left its primitives (already dressed → the real props are still resident).
    this.leavingTitle = false;
    this.resize();
    if (!this.titleDressed) void this.dressTitleReal().catch(() => { /* zero-asset safe: primitives stay */ });
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
        // The title ranger's calm idle breathing is SECONDARY motion → frozen
        // under reduced-motion (contract); locomotion n/a on the title.
        if (this.titleMixer && livePolicy().secondaryMotion) this.titleMixer.update(dt);
        this.renderer.render(this.scene, this.camera);
      }
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

/** How much heather covers the title's heath at (x,z): the world's heath field, opened
 *  up to sand and grass along the track and in the ranger's foreground. */
function titleCover(x: number, z: number): number {
  const track = THREE.MathUtils.smoothstep(Math.abs(x + 0.4 - (z + 7) * 0.06), 1.6, 5.5);
  const fore = THREE.MathUtils.smoothstep(Math.hypot(x + 2.3, z - 2.8), 1.5, 4.5);
  return heathCover(x * 1.3 + 17, z * 1.3 - 6) * track * (0.35 + 0.65 * fore);
}

/** A stable hash of an integer pair → [0,1) (the title heath's jitter). */
function titleHash(a: number, b: number): number {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + 1013904223) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
