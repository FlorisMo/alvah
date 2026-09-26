/**
 * World.ts — the explorable 3D Veluwe (BUILD-PLAN §4). A naturalistic heath/forest
 * (instanced real tree GLBs — pine·oak·birch — plus heather, all instanced to stay
 * well under the draw-call budget; P1.3), the real generated ranger you walk around,
 * and one animal "marker" per mission. Tap the
 * ground to walk; tap an animal (or walk up to it) to start that mission.
 *
 * Render layer only — it drives the spine through the onApproach callback and
 * holds no game logic. Camera follows the §1e spec: fixed FOV, exponentially
 * damped follow, roll=0 always, no shake / head-bob / snap-rotate. Under
 * reduced-motion the follow cuts instead of damping and idle motion is off.
 * Every asset is best-effort — missing models fall back to procedural stand-ins.
 */

import * as THREE from 'three';
import { prefersReducedMotion } from '../core/reduced-motion';
import { livePolicy } from './MotionMode';
import { VEN_CENTER, WATER_LEVEL, type Biome } from './Biomes';
import { Terrain } from './world/Terrain';
import { Sky } from './world/Sky';
import { Labels } from './world/Labels';
import { Dressing } from './world/Dressing';
import { Fauna } from './world/Fauna';
import { Markers, type WorldMarker } from './world/Markers';
import { Vehicles } from './world/Vehicles';
import { Player, type TapTarget } from './world/Player';
import { CameraRig } from './world/CameraRig';
import { skinnedRenderBox } from './Models';
import type { MoveLimits, Obstacle } from './CharacterController';
import type { StickVector } from '../core/input';
import type { FootSurface } from '../core/footstep';
import { Sound } from '../core/sound';
import { store } from '../core/state';
import type { CamState } from '../core/devhook';
import { FpsProbe, nextTier, QUALITY_TIERS, type QualityTier } from '../core/quality';
import type { WayCue } from './Wayfinding';
import type { WorldCtx } from './play/types';
import { wrapAngle } from './FollowCam';

export type { WorldMarker } from './world/Markers';

// `grounded` band for the dev-hook court check (P1.5a asserts it across the world):
// after the snap the feet sit ON the rendered surface, so clearance ≈ 0. A few cm of
// float tolerance absorbs numeric wobble; more than SINK below or AIR above is "not
// grounded" (the pre-fix analytic Y-write buried him ~4 m at the ven — clearance ≪ 0).
const GROUND_SINK_TOL = 0.06; // feet may sit at most 6 cm below the rendered surface
const GROUND_AIR_TOL = 0.60;  // and at most 60 cm above it (a step), else airborne



export class World {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 240);

  private readonly _camPose = new THREE.Vector3();  // scratch: camera world forward
  private readonly _camBox = new THREE.Box3();       // scratch: ranger bbox for pose reads
  // the sky, golden-hour light + ambient clock (world/Sky.ts) and the name-tags (world/Labels.ts)
  private readonly sky: Sky;
  // the paths, water, trees, grasses, cabin, landmarks + nature dressing (world/Dressing.ts)
  private readonly dressing: Dressing;
  // the warden, the poacher and the roaming / gliding wildlife (world/Fauna.ts)
  private readonly fauna: Fauna;
  // mission markers, the Missiebord + the sit-spot: proximity, interact, wayfinding (world/Markers.ts)
  private readonly pois: Markers;
  // the jeep, the helicopter + its pads, the dust (world/Vehicles.ts)
  private readonly vehicles: Vehicles;
  // the ranger: rig, controls, the on-foot step, footsteps (world/Player.ts)
  private readonly player: Player;
  // the follow camera: bearing, orbit, zoom, reframes, anti-clip + fade rails (world/CameraRig.ts)
  private readonly cam: CameraRig;
  private readonly labels = new Labels();
  // W4.4 ground detail: on by default; `?groundDetail=off` bakes the old flat
  // per-biome slab so the before/after evidence pair is one reproducible toggle.
  private readonly groundDetailOn: boolean =
    typeof location === 'undefined' ||
    new URLSearchParams(location.search).get('groundDetail') !== 'off';
  private readonly raycaster = new THREE.Raycaster();
  // The ONE ground truth (world/Terrain.ts): the drawn ground mesh + y(x,z) + biome(x,z).
  // Every placement, the ranger's feet, the vehicles and the camera read terrain.y.
  private readonly terrain: Terrain;
  private readonly ground: THREE.Mesh;
  private renderer: THREE.WebGLRenderer | null = null;
  // W7.2 adaptive quality: the live tier drives the pixelRatio cap + vegetation
  // density. Seeded from the persisted verdict so a slow device boots light; the
  // per-frame fps probe re-decides with hysteresis (see update()).
  private tier: QualityTier = store.get().settings.kwaliteitTier;
  private readonly fpsProbe = new FpsProbe();
  private readonly canvas: HTMLCanvasElement;
  private readonly onBiome: (biome: Biome) => void;
  private lastBiome: Biome | null = null;       // re-pick the ambience bed on a crossing
  // while a diegetic mini-game plays IN-PLACE, the world stays loaded but freezes:
  // movement, walk-taps, proximity, wayfinding and the §1e follow all pause so the
  // activity's reframe owns the camera (it restores on endActivity).
  private activityActive = false;
  // D1.3: the world-space anchor the running in-place activity stages its task
  // around (= the `ctx()` activitySpot). camState tests it against the live frustum
  // for `taskInView`, so a game-3D reframe that lands off the playfield / on a
  // backside is caught. Set in ctx(), cleared in endActivity(); null in free-roam.
  private activityFocus: { x: number; y: number; z: number } | null = null;






  // soft-collision blockers (pine trunks) + the kinematic move limits — the
  // ranger slides around trees, can't wade into the ven, can't leave the world.
  private readonly obstacles: Obstacle[] = [];
  private readonly limits: MoveLimits = {
    // F-11 (P4.6 rim re-judge): the calm forest edge sits at 75 m, NOT the old 116 m.
    // The Meshy ranger rig is a ~85-unit SKELETON scaled ×0.02 (bind-pose mesh geometry
    // is ~0.9 unit — the F-07 skeleton-drives-a-giant / tiny-geometry mismatch, see
    // Models.prepModel + skinnedRenderBox). Far from the world origin the view-space
    // skinning matrix (viewMatrix × modelMatrix) loses float32 precision, and that ~94×
    // skeleton-to-geometry conditioning amplifies it catastrophically: past ~100 m the
    // walked ranger deforms into shards, and by ~110 m he vanishes from the colour AND
    // shadow passes entirely (the "ranger nowhere in frame" the rim shot showed — NOT
    // frustum culling or terrain occlusion, both ruled out; the follow lens is rigidly
    // eye+2.4/boom-4.6 off his feet so it can never sink below him either). He renders
    // SOLID well within ~85 m — and the rim-ease parks him ~3 m short of the bound, so a
    // 75 m bound stops him at ~72 m, WELL within that zone (a prior 85 m bound left him
    // at ~82 m, right at the edge with no margin for the capture's software renderer,
    // whose float precision the dev-browser check never exercised). This serves F-11's
    // intent better too (the Run A "featureless void after 20 m" meets a forest edge much
    // sooner). All content is inside ~50 m (the ven basin), COMPACT_RADIUS 22, so the
    // playable world stays spacious. Everything downstream reads `limits.bound` (rim
    // tree-line, resolveMove clamp, RIM_EASE/HINT bands, the camera rim clamp,
    // boundaryState), so this one value moves the whole edge in together.
    bound: 75,                                   // ground plane is 240² → trees at ~76 land on it
    // off-limits = the submerged ven only (inside the water disc AND below the
    // surface) — NOT a global height test, so dry relief troughs stay walkable.
    blocked: (x, z) => {
      const dx = x - VEN_CENTER.x, dz = z - VEN_CENTER.z;
      return dx * dx + dz * dz < 18 * 18 && this.terrain.y(x, z) < WATER_LEVEL + 0.15;
    },
  };

  constructor(
    canvas: HTMLCanvasElement,
    markers: WorldMarker[],
    onApproach: (missionId: string | null) => void,
    onWayfind: (cue: WayCue | null) => void = () => {},
    activeId: string | null = null,
    onBiome: (biome: Biome) => void = () => {},
    onInteract: (missionId: string) => void = () => {},
  ) {
    this.canvas = canvas;
    this.onBiome = onBiome;

    this.sky = new Sky(this.scene); // golden-hour sky, fog, hemisphere fill + the hero-shadow sun

    this.terrain = new Terrain({
      detail: this.groundDetailOn,
      map: this.groundDetailOn ? Terrain.mottleTexture() : null,
    });
    this.ground = this.terrain.mesh;
    this.scene.add(this.ground);
    this.dressing = new Dressing({
      scene: this.scene, terrain: this.terrain, obstacles: this.obstacles, limits: this.limits, labels: this.labels,
    });
    this.fauna = new Fauna({ scene: this.scene, terrain: this.terrain });
    this.pois = new Markers(
      { scene: this.scene, terrain: this.terrain, obstacles: this.obstacles, labels: this.labels },
      { onApproach, onInteract, onWayfind }, activeId,
    );
    this.player = new Player(
      {
        scene: this.scene, camera: this.camera, canvas, raycaster: this.raycaster,
        terrain: this.terrain, obstacles: this.obstacles, limits: this.limits,
      },
      {
        pointerBlocked: () => this.activityActive || this.vehicles.inVehicle || this.vehicles.inHeli,
        orbitDrag: (dx, dy) => this.cam.orbitDrag(dx, dy),
        tapTargets: () => this.tapTargets(),
        crossBiome: (here) => this.crossBiome(here),
      },
    );
    this.vehicles = new Vehicles(
      { scene: this.scene, camera: this.camera, terrain: this.terrain, obstacles: this.obstacles, limits: this.limits },
      {
        ranger: this.ranger,
        seat: (seated) => this.player.rig.setSeated(seated),
        stopWalk: (x, z) => { this.player.target.set(x, 0, z); this.player.groundSpeedNow = 0; },
        intent: () => this.player.intent(),
        follow: (yaw, snap) => { this.cam.followTargetYaw = yaw; if (snap) this.cam.followYaw = yaw; },
        recut: () => this.cam.place(true, 0, livePolicy().reduced),
        clearWalkPrompts: () => this.pois.clearForVehicle(),
        crossBiome: (here) => this.crossBiome(here),
        nearestAnimalDist: (x, z) => this.fauna.nearestAnimalDist(x, z),
        camOffsets: () => ({ walk: this.cam.camOffset, vehicle: this.cam.camOffsetVehicle, heli: this.cam.camOffsetHeli }),
      },
    );
    this.cam = new CameraRig(
      { camera: this.camera, terrain: this.terrain, obstacles: this.obstacles, limits: this.limits },
      this.player, this.dressing,
      {
        mode: () => ({ inVehicle: this.vehicles.inVehicle, inHeli: this.vehicles.inHeli }),
        nearBoard: () => this.pois.nearBoard,
        inputBlocked: () => this.activityActive || this.vehicles.inVehicle || this.vehicles.inHeli,
        afterPlace: () => this.pois.fadeRings(this.camera),
      },
    );
    this.scene.add(this.dressing.buildPaths()); // W4.3: sand-path ribbons over the ground
    this.scene.add(this.dressing.buildVenWater());
    this.sky.buildCloudShadows(); // W4.6: drifting cloud shadows over the ground
    this.sky.buildFlyover();      // W4.6: the ~12 s bird flyover
    // W7.2: vegetation density scales with the persisted quality tier (laag ≈ half).
    this.dressing.scatterVegetation(QUALITY_TIERS[this.tier].vegetationScale);

    this.player.spawn(); // the instant stand-in at spawn, back to the lens; the real rig streams in below

    this.camera.up.set(0, 1, 0);
    this.cam.place(true);

    this.pois.placeMarkers(markers);
    this.dressing.placeCabin();
    this.pois.placeBoard();
    this.dressing.placeLandmarks();
    this.pois.placeSitSpot();
    this.dressing.placeNatureDressing();
    this.fauna.placeScenicActors();
    this.fauna.placeAmbientLife();
    this.vehicles.placeJeep();
    this.vehicles.placeHelipads();
    void this.player.loadRealRanger();

    this.player.listenPointer(); // F-17 click-vs-drag seam: tap-to-walk or drag-orbit
    canvas.addEventListener('wheel', this.cam.onWheel, { passive: false }); // F-16 dolly zoom
    this.player.listenKeys(() => this.tryInteract());
  }

  /**
   * Fire the current proximity action from the interact key (W1.4) — the laptop
   * twin of tapping the "Speel mee" prompt. Only when the ranger stands at a
   * marker (`nearId`) and no in-place activity owns the world; the HUD decides
   * what the action is (open the mission briefing).
   */
  private tryInteract(): void {
    if (this.activityActive) return;
    // W5.1/W5.3b: the jeep + helicopter own the interact key while riding and when
    // standing beside a parked one — they win over the hub/marker affordances.
    if (this.vehicles.interact()) return;
    // then the spawn case-board hub (W2.2), the sit-spot (W6.4b2), a mission marker.
    this.pois.interact();
  }

  /** Dev-hook accessor (W1.4): the mission the ranger is standing at, or null. */
  nearMission(): string | null {
    return this.pois.nearId;
  }

  /** Dev-hook accessor (W2.2): the spawn case-board's world position + whether the
   *  ranger currently stands in its radius — lets the E2E steer to the hub and know
   *  it has arrived. `null` before the hub is placed. */
  boardState(): { x: number; z: number; near: boolean; inFrustum: boolean } | null {
    if (!this.pois.boardPos) return null;
    // P1.0 (F-19): is the board FACE/papers point (~1.4 m up = the pinned-notes band)
    // actually inside the live view frustum? The board-affordance assert reads this
    // TRUE while `near` to prove the approach framing keeps the board (not just the
    // ranger's back) in shot. Pixels stay the court of appeal (AUDIT-FINDINGS §4).
    const inFrustum = this.pointInFrustum(
      this.pois.boardPos.x, this.groundY(this.pois.boardPos.x, this.pois.boardPos.z) + 1.4, this.pois.boardPos.z,
    );
    return { x: this.pois.boardPos.x, z: this.pois.boardPos.z, near: this.pois.nearBoard, inFrustum };
  }

  /** P1.0 dev-hook helper: is the world point (x,y,z) inside the live camera view
   *  frustum? Same plane-distance idiom as camState's landmark test, built off the
   *  ACTUAL render camera (fresh matrices) so a board-in-frustum claim can never sit
   *  on a stale matrix. Dev-hook-only (read at capture time), so the per-call Frustum
   *  build is fine. */
  private pointInFrustum(x: number, y: number, z: number): boolean {
    const cam = this.camera;
    cam.updateMatrixWorld();
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    const fr = new THREE.Frustum().setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse),
    );
    const p = new THREE.Vector3(x, y, z);
    for (const plane of fr.planes) if (plane.distanceToPoint(p) < 0) return false;
    return true;
  }

  /** Register the spawn case-board hub callbacks (W2.2): `onNear(true|false)` as the
   *  ranger enters/leaves the board's radius, and `onOpen()` when he acts on it (tap
   *  the prompt or press the interact key). The mission board opens as an overlay —
   *  the world is never torn down. */
  setBoard(cbs: { onNear: (near: boolean) => void; onOpen: () => void }): void {
    this.pois.setBoard(cbs);
  }

  /** Register the F-11 world-rim cue: fired ONCE each time the walking ranger reaches
   *  the rim heading outward (re-armed when he walks back inward). The explore HUD
   *  wires it to the calm "Hier stopt het bos" one-tip channel (`showBoundaryHint`) —
   *  the boundary hint joining the one sequenced hint system (BUILD-PLAN §3). */
  setBoundaryHint(cb: () => void): void {
    this.player.onBoundary = cb;
  }

  /** Dev-hook accessor (F-11): the world-rim state — `bound` (the move-limit radius,
   *  m), the ranger's live `dist` from world centre, and `atRim` (he is pressed
   *  against the rim heading outward, so the "Hier stopt het bos" cue has fired). The
   *  P4.6 assert reads `dist` ≤ `bound` (clamped, never beyond) with `atRim` true
   *  after an outward walk — the gentle stop, not an invisible wall. `scatterMax` is the
   *  furthest LOW ground-tuft radius (heather/marram). */
  boundaryState(): { bound: number; dist: number; atRim: boolean; scatterMax: number } {
    const p = this.ranger.position;
    return { bound: this.limits.bound, dist: Math.hypot(p.x, p.z), atRim: this.player.atBoundary, scatterMax: this.dressing.scatterMax };
  }

  /** Dev-hook accessor (W6.4b2): the sit-spot's world position + whether the ranger
   *  stands in its radius. `null` before the sit-spot is placed. */
  sitSpotState(): { x: number; z: number; near: boolean } | null {
    return this.pois.sitSpotState();
  }

  /** Register the sit-spot callbacks (W6.4b2): `onNear(true|false)` as the ranger
   *  enters/leaves the bench's radius, and `onActivate()` when he acts on it (tap
   *  the prompt or press the interact key). The roep3d slice plays in-place — the
   *  world is never torn down. */
  setSitSpot(cbs: { onNear: (near: boolean) => void; onActivate: () => void }): void {
    this.pois.setSitSpot(cbs);
  }

  /** Register the drivable-jeep HUD callbacks (W5.1): `onNear(true|false)` as the
   *  ranger enters/leaves the parked jeep's radius (while walking), and
   *  `onChange(inVehicle)` when he climbs in / steps out. The HUD swaps its
   *  "Stap in" / "Stap uit" affordance from the live `vehicleState()`. */
  setVehicle(cbs: { onNear: (near: boolean) => void; onChange: (inVehicle: boolean) => void }): void {
    this.vehicles.setVehicle(cbs);
  }

  /** Register the helicopter HUD callbacks (W5.3b): `onNear`, `onChange(inHeli)`,
   *  `onFrame(vignette)` each flight frame, and `optIn` = the live Instellingen
   *  "Helikopter" toggle (read each frame, so availability updates with no restart). */
  setHeli(cbs: {
    onNear: (near: boolean) => void;
    onChange: (inHeli: boolean) => void;
    onFrame: (vignette: number) => void;
    optIn: () => boolean;
  }): void {
    this.vehicles.setHeli(cbs);
  }

  /** Dev-hook accessor (W5.3b): the helicopter's live state (null before it is placed). */
  heliState(): ReturnType<Vehicles['heliState']> {
    return this.vehicles.heliState();
  }

  /** W5.3b: lift off from the pad (no-op unless beside the parked heli and available). */
  enterHeli(): void {
    this.vehicles.enterHeli();
  }

  /** W5.3b: begin the descent — only over a helipad. */
  landHeli(): void {
    this.vehicles.landHeli();
  }

  /** Dev-hook accessor (W5.1): the drivable jeep's live state (null before it is placed). */
  vehicleState(): ReturnType<Vehicles['vehicleState']> {
    return this.vehicles.vehicleState();
  }

  /** W5.1: climb into the parked jeep (no-op unless standing beside it). */
  enterVehicle(): void {
    this.vehicles.enterVehicle();
  }

  /** W5.1: step out of the jeep beside it, back to walking (no-op unless driving). */
  exitVehicle(): void {
    this.vehicles.exitVehicle();
  }

  /** Dev-hook accessor (W1.4): every marker's world position, for E2E navigation. */
  markerPositions(): { x: number; z: number; missionId: string }[] {
    return this.pois.markerPositions();
  }

  /** Dev-hook accessor (WORLD-PLAN §3.1): the ranger's world position {x,z}. */
  pos(): { x: number; z: number } {
    return this.player.pos();
  }

  /** The ranger's active locomotion clip for the dev hook (null when procedural). */
  playerClip(): { name: string; time: number } | null {
    return this.player.clip();
  }

  /** Dev-hook accessor (F-08): the ranger's live post-collision ground speed (m/s). */
  groundSpeed(): number {
    return this.player.groundSpeed();
  }

  /** Dev-hook accessor (F-07): the player ranger's live rendered height (m). */
  avatarState(): { height: number } | null {
    return this.player.avatarState();
  }

  /** Dev-hook accessor (W4.7b): the running footstep count + the last surface. */
  footstepState(): { count: number; surface: FootSurface | null } {
    return this.player.footstepState();
  }

  /** The ambience follows the ranger (on foot, driving or flying) across biomes. */
  private crossBiome(here: Biome): void {
    if (here !== this.lastBiome) { this.lastBiome = here; this.onBiome(here); }
  }

  /** What a tap on the canvas can walk the ranger up to, in pick order (then the ground). */
  private tapTargets(): TapTarget[] {
    const out: TapTarget[] = [];
    for (const mk of this.pois.list) out.push({ object: mk.group, x: mk.pos.x, z: mk.pos.z, stop: 1.6 });
    const p = this.pois, v = this.vehicles;
    if (p.boardGroup && p.boardPos) out.push({ object: p.boardGroup, x: p.boardPos.x, z: p.boardPos.z, stop: 1.6 });
    if (p.sitSpotGroup && p.sitSpotPos) out.push({ object: p.sitSpotGroup, x: p.sitSpotPos.x, z: p.sitSpotPos.z, stop: 1.4 });
    if (v.jeep && v.jeepPos) out.push({ object: v.jeep, x: v.jeepPos.x, z: v.jeepPos.z, stop: 2.2 });
    if (v.heli && v.heliPos) out.push({ object: v.heli, x: v.heliPos.x, z: v.heliPos.z, stop: 2.4 });
    return out;
  }

  /** Register the on-screen joystick's live-vector source (W1.3). The HUD wires
   *  it on world entry; pass null to clear. Fused with held keys each frame. */
  setJoystick(source: (() => StickVector | null) | null): void {
    this.player.joystickSource = source;
  }

  /** Register the "Camera draait mee" setting source (W1.5). Read live each frame
   *  so the toggle takes effect with no restart; null → default aan. */
  setCameraFollow(source: (() => boolean) | null): void {
    this.cam.setFollowSource(source);
  }

  /** Dev-hook accessor: the follow-camera yaw the camera-relative input rotates by. */
  cameraYaw(): number {
    return this.cam.cameraYaw();
  }

  dispose(): void {
    // D1.5 (audit #4): hand the shared id-cached tree + ranger materials back at FULL opacity
    // before teardown. A canopy (or ranger) left faded LEAKS onto the Stage title backdrop, which
    // CLONES the same cached GLBs and so SHARES their materials (Stage.ts: "the clones SHARE the
    // world's id-cached geometry/materials") — the fresh `13-title-return` showed half-ghosted
    // crowns on the title, the slow fade release carried into a composed hero screen (§2.5:
    // occluder fades reset when a composed screen takes the camera). Cheap material writes only.
    this.dressing.setCanopyOpacity(1);
    this.player.setAvatarOpacity(1);
    this.player.dispose(); // pointer seam + keys
    this.canvas.removeEventListener('wheel', this.cam.onWheel); // F-16 dolly zoom
    Sound.engineStop(); // W5.2: never leak the engine loop past teardown
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
  }

  /** The drawn ground height at world (x,z) — the one ground truth (world/Terrain.ts). */
  private groundY(x: number, z: number): number {
    return this.terrain.y(x, z);
  }

  /** Same ground truth as `groundY`; kept under this name for `ctx()` (the in-place
   *  mini-games read it through `WorldCtx.groundY`). */
  private groundSnapY(x: number, z: number): number {
    return this.terrain.y(x, z);
  }

  /** Dev-hook accessor (F-05 ⊕ F-18): the REAL render camera, read back off the
   *  actual `this.camera` object (position + world quaternion) and the ranger's
   *  live bbox — NOT the follow bearing that lied in Run A. `dist` is the true
   *  camera→ranger-centre boom length (the field F-16's zoom also reads); `yaw`
   *  and `pitch` come from the camera's own forward vector; `avatarInView` tests
   *  the ranger's whole box against the live view frustum (F-05's "avatar bbox
   *  inside the frustum" assert). Any camera claim is graded off these, and the
   *  pixels outrank them if they ever disagree (§4). Null before the world is up. */
  camState(): CamState | null {
    if (this.ranger.children.length === 0) return null;
    const cam = this.camera;
    cam.updateMatrixWorld();
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert(); // fresh frustum, not last-render's
    // ranger centre from the SKELETON box (F-07): the extent that actually renders,
    // so dist / avatarInView / avatarScreen can't sit on the bind-pose box that
    // once framed a 1.7 m phantom while a ~170 m giant filled the lens (§4).
    const box = skinnedRenderBox(this.ranger) ?? this._camBox.setFromObject(this.ranger);
    const centre = box.getCenter(new THREE.Vector3());
    const dist = cam.position.distanceTo(centre);
    // yaw/pitch from the camera's OWN forward vector (world quaternion), so the
    // value is whatever the render actually shows — the F-18 cross-check.
    const fwd = cam.getWorldDirection(this._camPose);
    const yaw = wrapAngle(Math.atan2(fwd.x, fwd.z) + Math.PI);
    const pitch = Math.asin(Math.max(-1, Math.min(1, fwd.y)));
    // whole-box-in-frustum: build the frustum from the live view-projection and
    // require every bbox corner inside it (fully visible, not merely intersecting).
    const frustum = new THREE.Frustum().setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse),
    );
    const min = box.min, max = box.max;
    let avatarInView = true;
    for (let i = 0; i < 8 && avatarInView; i++) {
      const corner = this._camPose.set(
        i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z,
      );
      for (const plane of frustum.planes) {
        if (plane.distanceToPoint(corner) < 0) { avatarInView = false; break; }
      }
    }
    // Framing machine signal (F-05 / Run B monitor steer #2): project the ranger's
    // bbox to normalised screen space so a grade can PROVE he is framed rather than
    // infer it from a soft-DOF frame. `heightFrac` (box top→bottom, projected)
    // catches the "solid but a distant speck" frame that avatarInView alone passes.
    const wx = centre.x, wz = centre.z; // keep world x/z before `centre` is spent
    const topY = this._camPose.set(wx, max.y, wz).project(cam).y;
    const botY = this._camPose.set(wx, min.y, wz).project(cam).y;
    // F-11 TERRAIN-occlusion-aware visibility: the frustum/projection tests above stay
    // TRUE when something stands BETWEEN the lens and the ranger (projection cannot see
    // an occluder in the way). Two occluders modelled: (1) TERRAIN — march the ground
    // height field along the sightline lens→ranger, hidden if it climbs above the line
    // (test his head AND chest so a crest that only clips his legs still reads visible);
    // (2) the rim TREE-LINE — a lens at/beyond the pine ring (bound + ~1.2 m) has a
    // trunk in the way, so require the lens inside the ring. Folded with onScreen + the
    // fade into `visible`. NB this catches GEOMETRIC occlusion only — the actual P4.6
    // rim "ranger nowhere" was a SkinnedMesh view-space precision collapse far from
    // origin (BUILD-PLAN §8), invisible to any raycast; the 75 m `bound` fixes that by
    // keeping the rim (and where the rim-ease parks the ranger, ~72 m) inside the
    // precision-safe radius. Pixels remain the court (§4).
    const headClear = this.terrainClearTo(cam.position, wx, max.y - 0.15, wz);
    const chestClear = this.terrainClearTo(cam.position, wx, (min.y + max.y) * 0.5, wz);
    const lensInRim = Math.hypot(cam.position.x, cam.position.z) < this.limits.bound + 0.6;
    const ndc = centre.project(cam); // centre → NDC in [-1, 1]³ (mutates in place)
    const onScreen = ndc.z > -1 && ndc.z < 1 && Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1;
    // D1.5 free-walk canopy clear-line: the REAL cam→avatar occluder test placeCamera
    // computed this frame (a tree crown between lens and ranger fades, so this reads the
    // "ranger is readable" truth the projection tests above can't — `09-walk-4` kept
    // onScreen/avatarInView true while a crown swallowed him, §8.7). Only the free-walk
    // follow cam can sit inside a crown; a vehicle/heli/mission-owned cam reads clear.
    // D3.16: fold in EVERY other rendered occluder class on the cam→ranger sightline — solid
    // props + the parked vehicles (propBlocksSightline) and staged animals / marker models
    // (animalBlocksSightline). These are UNFADEABLE, so a hit reports `viewClear` FALSE
    // (honest) rather than ghosting them — the §2.5 (GATE-D2) law: "the clear-line test binds
    // to anything the renderer draws; unfadeable ones report honestly" (`18-jeep-near` lied
    // clear while a nachtzwaluw marker model swallowed the ranger). Tested HERE, per-SHOT, not
    // in the per-frame placeCamera: they only drive the hook (no fade), so the walk path pays
    // nothing. `rp`/head come from the live ranger; the same segment the crown/terrain legs use.
    const rp = this.ranger.position;
    const viewClear = (this.vehicles.inVehicle || this.vehicles.inHeli || this.activityActive)
      ? true
      : this.cam.viewClearState
        && !this.propBlocksSightline(cam.position.x, cam.position.z, rp.x, rp.z)
        && !this.animalBlocksSightline(cam.position.x, cam.position.y, cam.position.z, rp.x, rp.y, rp.z);
    // D1.7: the RENDERED body opacity read off the shared materials — NOT the
    // `avatarOpacity` intent field, which lied 1 over an invisible ranger on the
    // title-return path. `visible` folds it in, so the hook matches the pixels: a
    // ~0-opacity body (shadow still casting) reads not-visible (§8.7).
    const renderedOpacity = this.player.renderedAvatarOpacity();
    const avatarScreen = {
      x: ndc.x, y: ndc.y,
      onScreen,
      heightFrac: Math.abs(topY - botY) / 2,
      visible: onScreen && renderedOpacity > 0.5 && lensInRim && (headClear || chestClear) && viewClear,
    };
    // F-09 hub-in-frustum: is at least one hub landmark actually in this frame? The
    // world-entry assert reads it to PROVE the spawn faces the hub, not the void —
    // `landmarkInView` == true means the cabin, the mission board, or a fixed beacon
    // sits inside the live view frustum (the pixels stay the court of appeal, §4).
    // Same plane-distance idiom as avatarInView above (no new three API); the point
    // is lifted a metre so a prop whose base grazes the bottom plane still counts.
    const hub = new THREE.Vector3();
    const ptInFrustum = (px: number, pz: number): boolean => {
      hub.set(px, this.groundY(px, pz) + 1.0, pz);
      for (const plane of frustum.planes) if (plane.distanceToPoint(hub) < 0) return false;
      return true;
    };
    let landmarkInView =
      (this.dressing.cabinPos != null && ptInFrustum(this.dressing.cabinPos.x, this.dressing.cabinPos.z)) ||
      (this.pois.boardPos != null && ptInFrustum(this.pois.boardPos.x, this.pois.boardPos.z));
    for (let i = 0; !landmarkInView && i < this.dressing.landmarks.length; i++) {
      landmarkInView = ptInFrustum(this.dressing.landmarks[i].x, this.dressing.landmarks[i].z);
    }
    // D1.3 mission-entry camera truth. `groundAtCam` = the drawn terrain height
    // under the lens; a game-3D reframe assert reads
    // `y > groundAtCam` so a below-ground entry (fresh simon-3D, cam.y −1.29) is caught.
    const groundAtCam = this.groundSnapY(cam.position.x, cam.position.z);
    // `taskInView` = the running activity's task anchor (its staging centre, a hair
    // above the ground so a form/footprint at the spot still counts) sits inside the
    // live frustum — proving the reframe lands ON the playfield, not on a backside or
    // bare ground off the field. null in free-roam (no in-place activity owns the cam).
    let taskInView: boolean | null = null;
    if (this.activityActive && this.activityFocus) {
      const f = this.activityFocus;
      hub.set(f.x, f.y + 0.4, f.z);
      taskInView = true;
      for (const plane of frustum.planes) if (plane.distanceToPoint(hub) < 0) { taskInView = false; break; }
    }
    // F-16 dolly-zoom read-back: the player-set walk boom clamped to its live bounds,
    // so a grade proves the wheel respects BOTH clamps straight off the annotation
    // (`zoom.dist` ∈ [min, max] as an invariant; wheel-in saturates to min, wheel-out
    // to max). `fov` is the fixed lens — a dolly must never change it, so the assert
    // reads it constant across the zoom pair. `dist` above (the real 3D boom) still
    // outranks these if the pixels ever disagree (§4).
    const zoomMin = this.cam.zoomMinBoom();
    const zoomDist = Math.max(zoomMin, Math.min(this.cam.CAM_ZOOM_MAX, this.cam.zoomDist));
    return {
      dist, yaw, pitch,
      x: cam.position.x, y: cam.position.y, z: cam.position.z,
      target: this.vehicles.inVehicle ? 'vehicle' : 'avatar', avatarInView,
      fov: this.camera.fov,
      zoom: { dist: zoomDist, min: zoomMin, max: this.cam.CAM_ZOOM_MAX },
      // F-17 drag-orbit read-back: the player's look offset on the follow bearing. A drag
      // moves `yaw` (and `lift`) while `pos` holds; a clean click walks and never touches
      // it. The real render `yaw` above (quaternion) stays the court of appeal (§4).
      orbit: { yaw: this.cam.orbitYaw, lift: this.cam.orbitLift },
      // D1.7: the RENDERED body opacity (read off the shared materials), NOT the
      // fade-rail INTENT field — which lied 1 over an invisible ranger after a
      // title round-trip (`14-title-return-world`: shadow cast, body unrendered;
      // the shared rig materials were left transparent and a fresh World's
      // avatarOpacity==1 guard never restored them, §8.7). 1 = the ranger renders
      // solid; anything < 1 flags an empty/faded frame BEFORE the judge looks, and
      // now it cannot be faked by the intent field. In the normal case (a settled
      // hero/POI shot, or the F-05 boom fade) this equals the applied fade, so the
      // F-07 machine signal is unchanged; only the title-return lie is caught.
      avatarOpacity: renderedOpacity,
      avatarScreen,
      viewClear,
      canopyFade: this.dressing.canopyOpacity,
      terrainLift: this.cam.terrainLiftState,
      landmarkInView,
      groundAtCam,
      taskInView,
    };
  }

  /** F-11 / D1.5 (audit #4) line-of-sight over the terrain: true when the RENDERED ground never
   *  climbs above the straight segment from `from` to the world point (`tx,ty,tz`). Marches
   *  the drawn terrain (`groundSnapY` = terrain.y, the ONE ground truth). A crest poking above the ray (a rim berm / dune face between lens and
   *  ranger) returns false = the ranger is hidden, so `avatarScreen.visible` matches the pixels.
   *  Deterministic, so the idle pose holds frame to frame; a per-SHOT hook read (camState). */
  private terrainClearTo(from: THREE.Vector3, tx: number, ty: number, tz: number): boolean {
    const dx = tx - from.x, dz = tz - from.z;
    const horiz = Math.hypot(dx, dz);
    if (horiz < 0.5) return true; // lens is right on top of him — nothing can be between
    const steps = Math.min(48, Math.max(6, Math.ceil(horiz / 1.5)));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const rayY = from.y + (ty - from.y) * t;
      if (this.groundSnapY(from.x + dx * t, from.z + dz * t) > rayY + 0.05) return false;
    }
    return true;
  }

  /** W4.5: hand the World the shared renderer so it can enable the shadow map (a
   *  renderer-wide flag) and report it. The title backdrop stays shadowless — no
   *  scene there carries a casting light. Called once after construction. */
  setRenderer(renderer: THREE.WebGLRenderer): void {
    this.renderer = renderer;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoft is deprecated in this three build
    this.applyPixelRatio(); // W7.2: seed the fill-rate cap from the persisted tier
  }

  /** W7.2: cap the renderer pixelRatio at the live tier's ceiling (× the device
   *  ratio). Cheap and safe to call live on a tier change — no re-render needed. */
  private applyPixelRatio(): void {
    if (!this.renderer) return;
    const cap = QUALITY_TIERS[this.tier].pixelRatioCap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, cap));
  }

  /** Dev-hook accessor (W7.2): the resolved quality tier + the live pixelRatio and
   *  vegetation-density scale in force — lets the E2E assert the probe exposes a
   *  tier and its knobs stay consistent. */
  qualityState(): { tier: QualityTier; pixelRatio: number; vegetationScale: number } {
    return {
      tier: this.tier,
      pixelRatio: this.renderer ? this.renderer.getPixelRatio() : 0,
      vegetationScale: QUALITY_TIERS[this.tier].vegetationScale,
    };
  }

  /** W7.2: feed one frame into the fps probe; when a window closes, step the tier
   *  with hysteresis. A change is PERSISTED (so a slow device boots light next
   *  time) and the pixelRatio cap is re-applied live. Vegetation density can only
   *  change on the next world build (re-scatter would pop meshes), so a mid-session
   *  step-down lightens fill-rate now and geometry next entry. */
  private probeQuality(dt: number): void {
    const avgFps = this.fpsProbe.sample(dt);
    if (avgFps === null) return;
    const next = nextTier(this.tier, avgFps);
    if (next === this.tier) return;
    this.tier = next;
    store.setSetting({ kwaliteitTier: next });
    this.applyPixelRatio();
  }

  /** Dev-hook accessor (W4.5): the lighting/shadow state — renderer shadow map on,
   *  sun casting the hero shadow, ranger opted in, and the animal blob count — so
   *  the E2E can assert selective shadows exist. */
  lightingState(): { shadowMap: boolean; sunCastsShadow: boolean; rangerCastsShadow: boolean; blobShadows: number } {
    return {
      shadowMap: this.renderer ? this.renderer.shadowMap.enabled : false,
      sunCastsShadow: this.sky.sun.castShadow,
      rangerCastsShadow: this.player.castsShadow,
      blobShadows: this.fauna.blobCount,
    };
  }

  /** Dev-hook accessor (W4.6): the live "Lucht + adem" state — richer-gradient
   *  stop count, whether the cloud-shadow layer + wind grasses are present, and
   *  the LIVE cloud offset / wind phase / bird position so the E2E can prove the
   *  ambient motion advances when moving AND freezes under reduced-motion. */
  skyState(): ReturnType<Sky['state']> {
    return this.sky.state(this.dressing.windMeshes.length);
  }

  /** Dev-hook accessor (D1.2 locomotion ground-truth; P1.5a asserts it across the
   *  walkable world). Reads the ranger's feet against the RENDERED terrain surface
   *  right under him — the court check for "he is ON the ground, not through it":
   *   - `clearance` = his feet Y minus the surface Y an independent downward ray hits
   *     on the ground mesh. ≈ 0 when he stands on the drawn ground.
   *   - `analyticGap` = that drawn surface minus the smooth relief field `heightAt(x,z)`
   *     at the same spot. Since the terrain un-mirror (2026-09-26) this is only the
   *     triangle-vs-curve difference (< ~2 cm); anything larger means the drawn ground and
   *     the field every placement reads have come apart again.
   *   - `grounded` = the ray hit the terrain AND clearance sits in the on-foot band.
   *  Null before the rig is up or while seated in a vehicle (his mesh is hidden then,
   *  so a feet-on-ground check is meaningless). Pixels stay the court of appeal (§8.7):
   *  this is an assert, and a shot that contradicts it outranks it. */
  groundedState(): { grounded: boolean; clearance: number; analyticGap: number } | null {
    if (this.ranger.children.length === 0 || this.vehicles.inVehicle) return null;
    const p = this.ranger.position;
    const surfaceY = this.terrain.raycastY(p.x, p.z);
    if (!Number.isFinite(surfaceY)) return { grounded: false, clearance: Number.NEGATIVE_INFINITY, analyticGap: 0 };
    const clearance = p.y - surfaceY;
    return {
      grounded: clearance >= -GROUND_SINK_TOL && clearance <= GROUND_AIR_TOL,
      clearance,
      analyticGap: surfaceY - this.terrain.field(p.x, p.z),
    };
  }

  /** Dev-hook accessor (W3.3 ⊕ P1.6a): each scenic actor's id + live clip + measured height. */
  actorClips(): { id: string; height: number; clip: { name: string; time: number } | null }[] {
    return this.fauna.actorClips();
  }

  /** Dev-hook accessor (W3.6): each ambient creature's id + live world x/z + height + clip. */
  ambientState(): { id: string; x: number; z: number; h: number; clip: { name: string; time: number } | null }[] {
    return this.fauna.ambientState();
  }

  /** Dev-hook accessor (W4.1): every landmark's id + world x/z. */
  landmarkPositions(): { id: string; x: number; z: number }[] {
    return this.dressing.landmarkPositions();
  }

  /** Dev-hook accessor (D1.5): the scatter + rim tree placements (world x/z + scale). */
  treeSpotList(): { x: number; z: number; s: number }[] {
    return this.dressing.treeSpotList();
  }

  /** Dev-hook accessor (W4.2): every nature-dressing prop's id + world x/z. */
  dressingPositions(): { id: string; x: number; z: number }[] {
    return this.dressing.dressingPositions();
  }

  /** Dev-hook accessor (W4.3): the sand-path network (nodes + segments). */
  pathNetwork(): { nodes: { id: string; x: number; z: number }[]; segments: [number, number][] } {
    return this.dressing.pathNetwork();
  }

  /** Dev-hook accessor (W4.8): the ven-water shader + ripple amplitude + clock. */
  waterState(): { shader: boolean; amp: number; time: number } {
    return this.dressing.waterState();
  }

  /** Dev-hook accessor (W4.4): the ground-detail state — whether the procedural
   *  albedo layers are on and whether the repeating mottle map is actually bound
   *  to the ground material — so the E2E asserts the before/after toggle flips. */
  groundDetailState(): { on: boolean; textured: boolean; tileRepeat: number } {
    const mat = this.ground.material as THREE.MeshStandardMaterial;
    return {
      on: this.groundDetailOn,
      textured: mat.map != null,
      tileRepeat: mat.map ? mat.map.repeat.x : 0,
    };
  }

  /** Re-point the wayfinding cue at another mission (e.g. after one is completed). */
  setActiveMission(id: string | null): void {
    this.pois.setActiveMission(id);
  }

  /** The live `richting` phrase (relative to facing) toward a mission marker, for
   *  the world-EF "welke kant?" recall beat — `null` if the marker is unknown.
   *  Synchronous so the beat can score against the true bearing at fire time. */
  headingTo(id: string | null): string | null {
    const rp = this.ranger.position;
    return this.pois.headingTo(id, rp.x, rp.z, this.ranger.rotation.y);
  }

  // ---- per-frame ----
  update(dt: number, t: number): void {
    // the §1e mode, read LIVE each frame from the single policy authority (no restart):
    // camera follow stops lagging (cuts), secondary animal motion freezes to rest.
    const reduced = livePolicy().reduced;

    // move the ranger toward the walk target — the desired straight step is then
    // resolved by the kinematic controller (slide around pines, stay out of the
    // ven, stay inside the world). Facing follows the ACTUAL motion so the ranger
    // turns naturally when a collision slides them sideways. Frozen during an
    // in-place activity (the mini-game holds the scene + drives the camera itself).
    const rp = this.ranger.position;
    this.sky.followSun(rp.x, rp.z); // W4.5: the hero shadow frustum follows the ranger
    this.player.groundSpeedNow = 0; // 0 while standing or during an in-place activity → mixer eases to idle
    this.vehicles.dustEmitting = false; // driveJeep re-arms it while the jeep is moving (W5.2)
    if (!this.activityActive && this.vehicles.inHeli) {
      // W5.3b: damped flight mode owns movement while the ranger is in the heli.
      this.vehicles.flyHeli(dt);
    } else if (!this.activityActive && this.vehicles.inVehicle) {
      // W5.1: arcade drive mode owns movement while the ranger is in the jeep.
      this.vehicles.driveJeep(dt);
    } else if (!this.activityActive) {
      // W1.2: keys / stick (camera-relative) or the tapped target move the ranger; the
      // follow-cam chases his facing only while he actually moves (W1.5).
      if (this.player.walk(dt, this.cameraYaw())) this.cam.followTargetYaw = this.ranger.rotation.y;
    }

    this.pois.animate(t, dt, reduced); // each mission marker's animal (secondary motion)

    this.fauna.update(t, dt, reduced); // W3.3 warden + poacher clips, W3.6 roaming animals + gliding birds

    // W3.2: the ranger's own locomotion animation. Locomotion is reduced-motion
    // EXEMPT (§3.4) so the mixer always advances with real dt — a walking ranger
    // animates in both motion modes; only the procedural-bob fallback holds still.
    this.player.rig.update(dt, this.player.groundSpeedNow, reduced);

    // W7.2: measure fps and step the quality tier down/up with hysteresis.
    this.probeQuality(dt);

    // W5.2: age the jeep's dust cloud every frame (so puffs keep fading after a
    // stop or step-out). Emission itself happens in driveJeep, gated on motion +
    // reduced-motion; this only advances what is already alive.
    this.vehicles.updateDust(dt);

    // W4.6 "Lucht + adem": drifting cloud shadows + grass wind wave + bird flyover.
    // All SECONDARY motion → the atmosphere clock advances ONLY when reduced-motion
    // is off, so a frozen clock stills every effect together (comfort §C). Runs
    // every frame (even during an in-place activity) so the sky keeps breathing.
    const st = this.sky.advance(dt, reduced); // clouds drift + the flyover bird sails
    this.dressing.animate(st, reduced); // grass wind wave + the ven water shimmer

    // F-22: keep the occlusion-proof world/vehicle/POI name-tags distance-faded.
    // Runs before the activity early-return so an open mission's Missiebord tag
    // (clipped in Run A's 22-mission-3d) keeps its close-up full opacity too.
    this.labels.fade(this.camera);

    if (this.activityActive) return; // the activity owns proximity/wayfinding/camera

    // W5.1 / W5.3b: "Stap in" near the parked jeep or helicopter (suppressed while riding)
    this.vehicles.updateProximity(rp.x, rp.z);

    // proximity → the marker / Missiebord / sit-spot prompts. Suppressed while driving
    // or flying so no stale prompt sits behind the vehicle pill (rp is the vehicle's
    // spot while the ranger rides hidden).
    if (!this.vehicles.inVehicle && !this.vehicles.inHeli) this.pois.updateProximity(rp.x, rp.z);

    // the calm wayfinding cue toward the active mission (follows the sand paths)
    this.pois.updateWayfinding(rp.x, rp.z, this.ranger.rotation.y);

    this.cam.place(reduced, dt, reduced);
  }

  // ctx() (below) reads the ranger's position straight off the World.
  private get ranger(): THREE.Group { return this.player.group; }
  // ctx() (below) reads the marker list and the nearest marker straight off the World.
  private get markers(): Markers['list'] { return this.pois.list; }
  private get nearId(): string | null { return this.pois.nearId; }

  /**
   * Build the live `WorldCtx` an in-place 3D mini-game renders into (3D-IMMERSION
   * §2). The activity anchors on the marker the ranger walked up to (`nearId`), or
   * the ranger's own spot if free-standing. The view reframes + restores the camera
   * and raycasts against this scene — it never tears the world down.
   */
  ctx(prompt: HTMLElement): WorldCtx {
    const near = this.nearId ? this.markers.find((m) => m.missionId === this.nearId) : null;
    const spot = near ? near.pos : this.ranger.position;
    // D1.3: remember the task anchor so camState can prove the reframe frames it.
    this.activityFocus = { x: spot.x, y: spot.y, z: spot.z };
    return {
      scene: this.scene,
      camera: this.camera,
      cameraRig: this.camera, // the §1e follow drives the camera directly (no separate rig)
      approachedModel: near ? near.group : null,
      activitySpot: { x: spot.x, y: spot.y, z: spot.z },
      // D1.3: the rendered-terrain height (raycast ground-snap) so a mini-game reframe
      // lifts the lens above the REAL surface, never the mirrored analytic marker Y
      // that buried the mission camera (the markers seat on `heightAt`, which diverges
      // from the pixels the way P1.5a's sink did — direction §2.2 one-ground-truth).
      groundY: (x, z) => this.groundSnapY(x, z),
      raycaster: this.raycaster,
      canvas: this.canvas,
      prompt,
      reducedMotion: prefersReducedMotion(),
    };
  }

  /** Freeze the world for an in-place activity (the mini-game owns input + camera).
   *  W6.1 friction fix: hide the floating mission name-tags so a marker label the
   *  activity reframe happens to keep in view never overlaps the play prompt. */
  beginActivity(): void {
    this.activityActive = true;
    this.pois.setLabelsVisible(false);
  }

  /** Resume free-roam after an in-place activity; re-emit the wayfinding cue.
   *  The activity reframe owned the camera; on resume the follow-yaw eases back
   *  to behind the ranger (a cut under reduced-motion, per §3.2). */
  endActivity(): void {
    this.activityActive = false;
    this.activityFocus = null; // D1.3: no task owns the camera in free-roam
    this.pois.setLabelsVisible(true); // W6.1: restore the name-tags on resume
    this.pois.resetAfterActivity();   // fresh proximity + cue re-fire (re-surfaces the hub prompt)
    this.cam.followTargetYaw = this.ranger.rotation.y;
    if (livePolicy().reduced) this.cam.place(true, 0, true); // reduced → cut back
    // otherwise the next update() frame damps position + yaw back into place.
  }

  /**
   * D3.16 all-occluder sightline (props + vehicles): does any SOLID collision circle
   * (cabin, board, sign, watchtower, the parked jeep/helicopter — everything in
   * `obstacles` EXCEPT the fadeable tree trunks) stand BETWEEN the lens and the ranger
   * on the XZ plane? These are UNFADEABLE occluders, so — per §2.5 (GATE-D2: "the
   * clear-line test binds to anything the renderer draws; unfadeable ones report
   * honestly") — a hit makes `viewClear` FALSE rather than trying to fade the mesh. The
   * `18-jeep-near` breach: the sightline test covered crowns + terrain but not props /
   * vehicles / animals, so the hook lied clear while a mesh swallowed the ranger. Same
   * 2D closest-approach-between math as `boomClearFraction`/`canopyBlocksSightline`;
   * circles that CONTAIN the ranger's foot (the prop he stands at) are skipped so a POI
   * never self-reports occluded. Trees are skipped (their crown fade already handles
   * them, and the frozen view-clear spec walks past trunks expecting viewClear=true).
   * Deterministic (no allocation) so the idle-stability pose holds frame to frame.
   */
  private propBlocksSightline(cx: number, cz: number, ax: number, az: number): boolean {
    const dx = ax - cx, dz = az - cz;
    const len2 = dx * dx + dz * dz;
    if (len2 < 1e-6) return false; // lens on top of him
    for (const o of this.obstacles) {
      if (o.tree) continue;                        // fadeable crown — handled by the canopy fade
      const fx = o.x - ax, fz = o.z - az;
      if (fx * fx + fz * fz <= o.r * o.r) continue; // the prop the ranger stands at — not an occluder
      const t = ((o.x - cx) * dx + (o.z - cz) * dz) / len2; // foot param on the segment
      if (t <= 0.05 || t >= 0.95) continue;        // behind the lens or at/behind the ranger → a backdrop
      const gx = o.x - (cx + dx * t), gz = o.z - (cz + dz * t);
      if (gx * gx + gz * gz <= o.r * o.r) return true;
    }
    return false;
  }

  /**
   * D3.16 all-occluder sightline (animals): does any staged CREATURE — a mission-marker
   * model, a scenic actor (warden/poacher), or an ambient roamer/bird — stand BETWEEN
   * the lens and the ranger's body? The `18-jeep-near` breach was exactly this: a
   * mission-marker BIRD model (the stuifzand nachtzwaluw, anchored by the jeep) filled
   * the near foreground while `viewClear` claimed clear. Each creature is modelled as a
   * sphere at its group's world position, lifted to mid-height, with a radius from its
   * stand-height (a floor so even a low bird reads); the cam→body segment is tested to
   * the ranger's HEAD and CHEST (a low creature swallows his feet first, a tall one his
   * head) by closest approach. Animals are UNFADEABLE set-dressing, so a hit reports
   * `viewClear` FALSE (honest) — we do not ghost a live animal. Birds gliding tens of
   * metres overhead never touch a follow-height sightline, so the loop is a cheap no-op
   * for them. Pure numeric math over the staged casts — deterministic, no allocation.
   */
  private animalBlocksSightline(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number): boolean {
    const near = (px: number, py: number, pz: number, R: number, ay: number): boolean => {
      const dx = rx - cx, dy = ay - cy, dz = rz - cz;
      const len2 = dx * dx + dy * dy + dz * dz;
      if (len2 < 1e-6) return false;
      const t = ((px - cx) * dx + (py - cy) * dy + (pz - cz) * dz) / len2;
      if (t <= 0.05 || t >= 0.95) return false;    // behind the lens / at-or-behind the ranger
      const gx = px - (cx + dx * t), gy = py - (cy + dy * t), gz = pz - (cz + dz * t);
      return gx * gx + gy * gy + gz * gz <= R * R;
    };
    const aimHead = ry + this.player.avatarTopY;          // his crown — a tall creature reaches it
    const aimChest = ry + this.player.avatarTopY * 0.35;  // low on his body — a ground bird swallows here first
    const test = (g: THREE.Vector3, h: number): boolean => {
      const R = Math.max(0.45, h * 0.5);           // footprint sphere (floor so a small model still reads)
      const cyc = g.y + h * 0.5;                   // centre at mid-height above the creature's own ground
      return near(g.x, cyc, g.z, R, aimHead) || near(g.x, cyc, g.z, R, aimChest);
    };
    for (const m of this.pois.list) { if (test(m.group.position, 1.0)) return true; }
    for (const a of this.fauna.scenicActors) { if (test(a.group.position, a.height)) return true; }
    for (const a of this.fauna.ambient) {
      if (a.glide) continue;                        // birds gliding overhead never cross a follow sightline
      if (test(a.group.position, a.h)) return true;
    }
    return false;
  }

}
