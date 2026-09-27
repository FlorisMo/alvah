/**
 * World.ts — the explorable 3D Veluwe: a thin composer over the modules in world/.
 *
 * It builds the modules in a fixed order (the order is behaviour: the shared
 * collision-circle list is walked in insertion order by resolveMove), runs them once
 * a frame in `update`, routes the interact key and the pointer, and keeps the public
 * API the HUD (ui/Missions.ts), the in-place mini-games (`ctx()`) and the dev hook use.
 *
 *   world/Terrain.ts     the ground: mesh, y(x,z), biome(x,z) — the one ground truth
 *   world/Sky.ts         sky, fog, golden-hour light + hero-shadow sun, clouds, flyover, ambient clock
 *   world/Labels.ts      the diegetic name-tags + their distance fade
 *   world/Dressing.ts    paths, ven water, trees + rim, heather, marram, reeds + wind, cabin, landmarks, nature props
 *   world/Fauna.ts       the warden, the poacher, roaming animals, gliding birds
 *   world/Markers.ts     mission markers, the Missiebord, the sit-spot: proximity, interact, wayfinding
 *   world/Vehicles.ts    the jeep, the helicopter + pads, dust
 *   world/Player.ts      the ranger: rig, controls, on-foot step, footsteps
 *   world/CameraRig.ts   the follow camera and its comfort / visibility rails
 *   world/DevReadback.ts the dev hook's read-backs
 *
 * Render layer only — it drives the spine through callbacks and holds no game logic.
 * Camera law (§1e): fixed FOV, damped follow, roll 0, no shake; reduced-motion cuts.
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
import { DevReadback } from './world/DevReadback';
import type { MoveLimits, Obstacle } from './CharacterController';
import type { StickVector } from '../core/input';
import type { FootSurface } from '../core/footstep';
import { Sound } from '../core/sound';
import { store } from '../core/state';
import type { CamState } from '../core/devhook';
import { FpsProbe, nextTier, QUALITY_TIERS, type QualityTier } from '../core/quality';
import type { WayCue } from './Wayfinding';
import type { WorldCtx } from './play/types';
import { spawnModel, spawnPlant, heightFor } from './play/spawn';
import { Progress } from './world/Progress';

export type { WorldMarker } from './world/Markers';

export class World {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 240);

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
  // the dev hook's read-backs (world/DevReadback.ts)
  private readonly readback: DevReadback;
  private readonly labels = new Labels();
  // felt progress: each finished mission's lasting tableau at its marker (world/Progress.ts)
  private readonly progress: Progress;
  // W4.4 ground detail: on by default; `?groundDetail=off` bakes the old flat
  // per-biome slab so the before/after evidence pair is one reproducible toggle.
  private readonly groundDetailOn: boolean =
    typeof location === 'undefined' ||
    new URLSearchParams(location.search).get('groundDetail') !== 'off';
  private readonly raycaster = new THREE.Raycaster();
  // The ONE ground truth (world/Terrain.ts): the drawn ground mesh + y(x,z) + biome(x,z).
  // Every placement, the ranger's feet, the vehicles and the camera read terrain.y.
  private readonly terrain: Terrain;
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
    this.scene.add(this.terrain.mesh);
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
    this.progress = new Progress({
      scene: this.scene, groundY: (x, z) => this.terrain.y(x, z), spawnModel, spawnPlant, heightFor,
      obstacles: this.obstacles, blocked: (x, z) => !!this.limits.blocked?.(x, z),
      markers: () => this.markers.map((m) => ({ missionId: m.missionId, x: m.pos.x, z: m.pos.z, group: m.group })),
      actors: () => this.fauna.scenicActors.map((a) => a.group.position),
    });

    this.readback = new DevReadback(
      {
        camera: this.camera, terrain: this.terrain, obstacles: this.obstacles, limits: this.limits,
        sky: this.sky, dressing: this.dressing, fauna: this.fauna, pois: this.pois,
        vehicles: this.vehicles, player: this.player, cam: this.cam,
      },
      {
        renderer: () => this.renderer,
        activityActive: () => this.activityActive,
        activityFocus: () => this.activityFocus,
      },
    );

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

  /** Dev-hook accessor (W2.2 ⊕ P1.0): the Missiebord's position, whether the ranger
   *  stands at it, and whether its face is in frame. `null` before it is placed. */
  boardState(): { x: number; z: number; near: boolean; inFrustum: boolean } | null {
    return this.readback.boardState();
  }

  /** Dev-hook accessor (F-11): the world-rim state (bound, distance, at-rim, tuft reach). */
  boundaryState(): { bound: number; dist: number; atRim: boolean; scatterMax: number } {
    return this.readback.boundaryState();
  }

  /** Dev-hook accessor (F-05 ⊕ F-18): the REAL render camera read-back. */
  camState(): CamState | null {
    return this.readback.camState();
  }

  /** Dev-hook accessor (W4.5): shadow map, sun, ranger caster, blob shadows. */
  lightingState(): { shadowMap: boolean; sunCastsShadow: boolean; rangerCastsShadow: boolean; blobShadows: number } {
    return this.readback.lightingState();
  }

  /** Dev-hook accessor (W4.6): the live sky / cloud / wind / flyover state. */
  skyState(): ReturnType<Sky['state']> {
    return this.readback.skyState();
  }

  /** Dev-hook accessor (D1.2): the ranger's feet against the drawn ground. */
  groundedState(): { grounded: boolean; clearance: number; analyticGap: number } | null {
    return this.readback.groundedState();
  }

  /** Dev-hook accessor (W4.4): the procedural ground detail on/off + its mottle map. */
  groundDetailState(): { on: boolean; textured: boolean; tileRepeat: number } {
    return this.readback.groundDetailState();
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

  /** The drawn ground height at world (x,z) — the one ground truth (world/Terrain.ts).
   *  Both names are what `ctx()` has always read (the in-place mini-games get it as
   *  `WorldCtx.groundY`); every module seats itself with `terrain.y` directly. */
  private groundY(x: number, z: number): number {
    return this.terrain.y(x, z);
  }

  private groundSnapY(x: number, z: number): number {
    return this.groundY(x, z);
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
    this.progress.update(t, dt, reduced, this.camera, this.activityActive); // finished tableaus: reunion walks, idle breathing

    this.fauna.update(t, dt, reduced, this.camera); // W3.3 warden + poacher clips, W3.6 roaming animals + gliding birds

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
    // 2026-09-26: seat the anchor on the RENDERED ground (the raycast ground-snap), never
    // the marker's analytic Y — every mini-game stages per point on `groundY` from here.
    const spotY = this.groundSnapY(spot.x, spot.z);
    // D1.3: remember the task anchor so camState can prove the reframe frames it.
    this.activityFocus = { x: spot.x, y: spotY, z: spot.z };
    return {
      scene: this.scene,
      camera: this.camera,
      cameraRig: this.camera, // the §1e follow drives the camera directly (no separate rig)
      approachedModel: near ? near.group : null,
      activitySpot: { x: spot.x, y: spotY, z: spot.z },
      groundY: (x, z) => this.groundSnapY(x, z),
      isClear: (x, z, r) => this.playClear(x, z, r),
      player: { x: this.ranger.position.x, z: this.ranger.position.z, yaw: this.ranger.rotation.y },
      setFocus: (x, y, z) => { this.activityFocus = { x, y, z }; },
      spawnModel,
      spawnPlant,
      raycaster: this.raycaster,
      canvas: this.canvas,
      prompt,
      reducedMotion: prefersReducedMotion(),
    };
  }

  /** A mini-game patch is free at (x,z) within `r` m: dry land (not the ven), outside
   *  every solid prop (a tree's CROWN, not just its trunk; the cabin's porch, not just
   *  its walk-around circle), and clear of the other missions' animals and the two
   *  people. The approached marker is exempt: the stage hides it while the game runs. */
  private playClear(x: number, z: number, r: number, except: string | null = this.nearId): boolean {
    if (this.limits.blocked?.(x, z)) return false;
    if (this.progress.blocks(x, z, r, except)) return false; // a finished mission's family stays out of a game
    for (const o of this.obstacles) {
      const reach = o.r + (o.tree ? 1.6 : o.r >= 1.5 ? 1.0 : 0);
      if (Math.hypot(o.x - x, o.z - z) < reach + r) return false;
    }
    for (const m of this.markers) {
      if (m.missionId !== except && Math.hypot(m.pos.x - x, m.pos.z - z) < 1.2 + r) return false;
    }
    for (const a of this.fauna.scenicActors) { // the warden / poacher never stand in (or behind) a game
      if (Math.hypot(a.group.position.x - x, a.group.position.z - z) < 0.8 + r) return false;
    }
    return true;
  }

  /** Felt progress (ui/flow calls this on completion, and on world build for every
   *  mission already done): the marker reads "klaar" and its finished tableau stands
   *  (world/Progress.ts). `fresh` plays the calm reunion; resolves once it has played. */
  onMissionComplete(missionId: string, opts: { fresh: boolean }): Promise<void> {
    this.pois.setFinished(missionId);
    if (opts.fresh) this.pois.hideForActivity(null); // the marker's animal is back for its reunion
    const view = { camera: this.camera, ranger: { x: this.ranger.position.x, z: this.ranger.position.z } };
    return this.progress.complete(missionId, opts.fresh, livePolicy().reduced, view);
  }

  /** The season's ontknoping (the poacher was reported): he stands by the warden now. */
  setSeasonResolved(on: boolean): void {
    this.fauna.setReformed(on);
  }

  /** Freeze the world for an in-place activity (the mini-game owns input + camera).
   *  W6.1 friction fix: hide the floating mission name-tags so a marker label the
   *  activity reframe happens to keep in view never overlaps the play prompt. */
  beginActivity(): void {
    this.activityActive = true;
    this.pois.setLabelsVisible(false);
    this.pois.hideForActivity(this.nearId); // the played marker steps away for the whole mission
  }

  /** Resume free-roam after an in-place activity; re-emit the wayfinding cue.
   *  The activity reframe owned the camera; on resume the follow-yaw eases back
   *  to behind the ranger (a cut under reduced-motion, per §3.2). */
  endActivity(): void {
    this.activityActive = false;
    this.activityFocus = null; // D1.3: no task owns the camera in free-roam
    this.pois.setLabelsVisible(true); // W6.1: restore the name-tags on resume
    this.pois.hideForActivity(null);
    this.pois.resetAfterActivity();   // fresh proximity + cue re-fire (re-surfaces the hub prompt)
    this.cam.followTargetYaw = this.ranger.rotation.y;
    if (livePolicy().reduced) this.cam.place(true, 0, true); // reduced → cut back
    // otherwise the next update() frame damps position + yaw back into place.
  }

}
