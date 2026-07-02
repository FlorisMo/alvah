/**
 * World.ts — the explorable 3D Veluwe (BUILD-PLAN §4). A procedural heath/forest
 * (instanced pines + heather to stay well under the draw-call budget), the real
 * generated ranger you walk around, and one animal "marker" per mission. Tap the
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
import {
  BIOME_PALETTE, VEN_CENTER, WATER_LEVEL,
  anchorInBiome, biomeAt, heightAt, type Biome,
} from './Biomes';
import { loadManifest, loadModel, loadRig, prepModel } from './Models';
import { standHeightFor } from './AnimalScale';
import { applyEyes } from './EyeMaterial';
import { applyCoat, applyPosture } from './AnimalDress';
import { applyFace } from './FaceRig';
import { applyCalmPose } from './CalmPoseRig';
import { gaitFor, motionAt, REST, type MotionRecipe } from './ProceduralMotion';
import { glideAt, wanderAt, type GlideConfig, type WanderConfig } from './AmbientPaths';
import { resolveMove, type MoveLimits, type Obstacle } from './CharacterController';
import { resolveInput, screenVector, type StickVector } from '../core/input';
import { driveStep, driveCaps, calmSpeed, ANIMAL_SLOW_RADIUS } from '../core/vehicle';
import {
  flyStep, heliVignette, heliAvailable,
  HELI_CRUISE_HEIGHT, HELI_PAD_HEIGHT, HELI_CAPS, HELI_ROLL,
} from '../core/heli';
import { attachInput, type InputHandle } from '../core/attach-input';
import { footSurface, stepFrame, newFootAccum, type FootAccum, type FootSurface } from '../core/footstep';
import { Sound } from '../core/sound';
import { store } from '../core/state';
import { FpsProbe, nextTier, QUALITY_TIERS, type QualityTier } from '../core/quality';
import { wayfind, bearing, cue as makeCue, distanceTo, type WayCue } from './Wayfinding';
import { PATH_NODES, PATH_SEGMENTS, LANE_HALF, routeVia } from './Paths';
import {
  mottleRGB, vertexTint, GROUND_TILE_PX, GROUND_TILE_REPEAT, GROUND_BRIGHTEN,
} from './GroundDetail';
import type { WorldCtx } from './play/types';
import { dampFactor } from './play/kit-math';
import { dampedYaw, wrapAngle, FIXED_FOLLOW_YAW } from './FollowCam';
import { PlayerRig } from './PlayerRig';
import { ROEP_COPY } from '../engines/roep';
import {
  SKY_STOPS, cloudOffset, windSway, flyoverAt, type Flyover,
} from './Atmosphere';
import {
  WATER_DEEP, WATER_SHALLOW, WATER_OPACITY, FRESNEL_POWER, rippleAmp,
} from './Water';

export interface WorldMarker {
  missionId: string;
  titel: string;
  modelId: string | null;   // generated GLB id, or null → procedural totem
  height: number;           // target world height for the model
  color: string;            // totem / accent colour
  biome?: Biome;            // the mission's landschap → anchor the marker in it
}

const SKY_LOW = '#e9b27f'; // horizon band + fog colour (matches SKY_STOPS' last stop)

// W5.1 jeep: its collision radius while parked, and the proximity radius that
// surfaces the "Stap in" affordance (a touch wider than the 2.4 m marker radius —
// the jeep is a bigger object the ranger walks up to).
const JEEP_COLLIDE = 1.6;
const JEEP_NEAR_R = 3.6;

// W5.3b helicopter: its parked collision radius, the pad-proximity radius that
// surfaces "Stap in de helikopter", and how close (horizontally) the aircraft
// must be to a helipad to land on it.
const HELI_COLLIDE = 1.8;
const HELI_NEAR_R = 4.0;
const PAD_LAND_R = 6.0;
// Above this altitude (m) the flying helicopter ignores ground obstacles (it is
// over the treetops) — only the world rim still bounds it; below it, on descent,
// the normal resolver applies again (pads are walk-through, so touchdown is clean).
const HELI_AIRBORNE_Y = 2.5;

export class World {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 240);

  private readonly ranger = new THREE.Group();
  private readonly target = new THREE.Vector3(0, 0, 0);
  private readonly camDesired = new THREE.Vector3();
  private readonly camOffset = new THREE.Vector3(0, 3.4, 6.2); // gentle behind-above
  // W1.5 rotating follow-cam: `followYaw` is the eased camera bearing; it chases
  // `followTargetYaw` (the ranger's facing, updated ONLY while he is moving — a
  // standing ranger never swings the camera). Both start at π = straight behind
  // on +z (the pre-W1.5 diorama bearing). Damped + rate-clamped in FollowCam.ts.
  private followYaw = FIXED_FOLLOW_YAW;
  private followTargetYaw = FIXED_FOLLOW_YAW;
  // "Camera draait mee" toggle (Instellingen, default aan), read LIVE each frame
  // so flipping it needs no restart; reduced-motion also forces the fixed bearing.
  private cameraFollowSource: (() => boolean) | null = null;
  private readonly markers: {
    group: THREE.Group; pos: THREE.Vector3; missionId: string;
    recipe: MotionRecipe; phase: number;
    label: THREE.Sprite;               // the floating diegetic name-tag (hidden during an activity)
    anim: THREE.Group | null;          // the prepped model wrapper to drive procedurally
    mixer: THREE.AnimationMixer | null; // set instead when a real animated GLB is staged
  }[] = [];
  // W3.3 scenic actors: the warden (BOA) + poacher stand at fixed world spots and
  // play their single baked clip via a mixer. They are NOT missions (kept out of
  // `markers`), carry no proximity/collision — purely diegetic set-dressing that
  // brings the story arc into the world. Their clip is SECONDARY motion, so it
  // freezes at the rest pose under reduced-motion (unlike the player's locomotion).
  private readonly scenicActors: {
    id: string; group: THREE.Group;
    mixer: THREE.AnimationMixer | null; action: THREE.AnimationAction | null;
  }[] = [];
  // W3.6 ambient wildlife: a few animals roam gentle wander loops (baked walk↔graze
  // clips via the mixer for the W3.5-staged cast, improved procedural bob elsewhere)
  // and two birds glide overhead on spline loops. All are pure set-dressing — no
  // markers, no collision, kept out of `markers`. Their motion is SECONDARY, so it
  // freezes at the rest pose under reduced-motion (like the animals + scenic actors).
  private readonly ambient: {
    id: string; group: THREE.Group; phase: number;
    wander: WanderConfig | null;   // ground animals roam this loop
    glide: GlideConfig | null;     // birds sail this overhead orbit
    faceOffset: number;            // per-GLB forward correction (tuned in W3.7)
    recipe: MotionRecipe;          // procedural idle bob (procedural cast only)
    anim: THREE.Group | null;      // the prepped wrapper to drive procedurally
    mixer: THREE.AnimationMixer | null;
    walk: THREE.AnimationAction | null;   // baked stride clip
    graze: THREE.AnimationAction | null;  // baked rest/graze clip
    walkW: number; grazeW: number;        // eased crossfade weights
    h: number;                            // applied canonical stand height (W3.7a)
  }[] = [];
  // W4.1 landmark props: the fixed wayfinding beacons (watchtower, ecoduct,
  // bird-hide, BOA post, signposts) placed per §4. Each is set-dressing with a
  // solid collision circle; the named ones carry a floating diegetic label so
  // they read as "over there" beacons. Kept out of `markers` (no proximity /
  // mission). Their world x/z is exposed through the dev hook for E2E navigation.
  private readonly landmarks: { id: string; x: number; z: number }[] = [];
  // W4.2 nature dressing: real tree/rock/mushroom/reed GLBs clustered near the
  // POIs and biome cores, on top of the instanced-primitive background filler.
  // Their world x/z is exposed through the dev hook so the E2E can assert them.
  private readonly dressing: { id: string; x: number; z: number }[] = [];
  // W4.4 ground detail: on by default; `?groundDetail=off` bakes the old flat
  // per-biome slab so the before/after evidence pair is one reproducible toggle.
  private readonly groundDetailOn: boolean =
    typeof location === 'undefined' ||
    new URLSearchParams(location.search).get('groundDetail') !== 'off';
  private activeId: string | null = null;     // the mission the wayfinding cue points to
  private readonly onWayfind: (cue: WayCue | null) => void;
  private lastWayKey = '';                     // debounce identical cues (no DOM churn)
  private readonly raycaster = new THREE.Raycaster();
  private readonly ground: THREE.Mesh;
  // W4.5 golden-hour light + selective hero shadow map. The warm sun casts a soft
  // shadow only for the ranger + solid props (castShadow=true); its tight ortho
  // frustum FOLLOWS the ranger via a fixed offset (`sunOffset`) so the covered set
  // stays the CLOSEST props and the light DIRECTION never changes (static, no day
  // cycle). Moving animals get cheap blob shadows instead (no shadow-map cost).
  private sun: THREE.DirectionalLight | null = null;
  private readonly sunOffset = new THREE.Vector3(-9, 7, 4);
  private rangerCastsShadow = false;
  private blobCount = 0;
  private renderer: THREE.WebGLRenderer | null = null;
  // W7.2 adaptive quality: the live tier drives the pixelRatio cap + vegetation
  // density. Seeded from the persisted verdict so a slow device boots light; the
  // per-frame fps probe re-decides with hysteresis (see update()).
  private tier: QualityTier = store.get().settings.kwaliteitTier;
  private readonly fpsProbe = new FpsProbe();
  private static blobTex: THREE.Texture | null = null;
  // W4.6: reusable scratch for the per-frame wind matrix recompose (no per-frame
  // allocation while re-tilting a few hundred grass blades).
  private static readonly _m = new THREE.Matrix4();
  private static readonly _q = new THREE.Quaternion();
  private static readonly _e = new THREE.Euler();
  private static readonly _p = new THREE.Vector3();
  private static readonly _s = new THREE.Vector3();
  // W4.6 "Lucht + adem": all SECONDARY ambient motion (drifting cloud shadows,
  // grass wind wave, bird flyover). `skyTime` advances ONLY when reduced-motion is
  // off, so every effect freezes together under reduced-motion (comfort §C). The
  // effects are driven from the pure Atmosphere math.
  private skyTime = 0;
  // W4.8 ven-water: the fresnel disc's shader material — the World drives its
  // `uTime` (from `skyTime`, so it freezes with the rest of the ambient motion)
  // and `uAmp` (0 under reduced-motion → waveless) each frame.
  private waterMat: THREE.ShaderMaterial | null = null;
  private lastWindT = NaN;                       // skip redundant wind re-uploads
  private cloudLayer: THREE.Mesh | null = null;  // multiply-blended cloud-shadow plane
  private flyBird: THREE.Group | null = null;    // the ~12 s sky crossing bird
  private lastFlyover: Flyover | null = null;
  // tall grasses that catch the wind (marram + reed): their instanced mesh + the
  // per-blade base transform, re-tilted each frame by windSway.
  private readonly windMeshes: {
    mesh: THREE.InstancedMesh;
    items: { x: number; y: number; z: number; sx: number; sy: number; phase: number }[];
    strength: number;
  }[] = [];
  private readonly canvas: HTMLCanvasElement;
  private readonly onApproach: (missionId: string | null) => void;
  private readonly onInteract: (missionId: string) => void;
  private readonly onBiome: (biome: Biome) => void;
  private lastBiome: Biome | null = null;       // re-pick the ambience bed on a crossing
  private nearId: string | null = null;
  private speed = 2.4;
  // W3.2 player animation: the mixer wrapper (idle/walk crossfade by speed, or a
  // procedural bob when the rigged GLB lacks clips). `playerSpeed` is the ranger's
  // post-collision ground speed (m/s), fed to the crossfade each frame.
  private readonly playerRig = new PlayerRig();
  private playerSpeed = 0;
  // W4.7b surface-aware footsteps: a distance-carry cadence (fires every stride
  // of ground actually covered), gated on sound + speed + biome surface.
  // Locomotion feedback, so NOT reduced-motion gated (§3.4 exempts locomotion).
  private footAccum: FootAccum = newFootAccum();
  private footstepCount = 0;
  private lastFootSurface: FootSurface | null = null;
  // keyboard (+ joystick) movement: the held-keys set feeds resolveInput →
  // resolveMove each frame, overriding tap-to-walk while any key is down (§3.2).
  private input: InputHandle | null = null;
  // the on-screen joystick's live vector (W1.3), fused with the keys at the
  // resolveInput call site. Set by the HUD via setJoystick; null when absent.
  private joystickSource: (() => StickVector | null) | null = null;
  // while a diegetic mini-game plays IN-PLACE, the world stays loaded but freezes:
  // movement, walk-taps, proximity, wayfinding and the §1e follow all pause so the
  // activity's reframe owns the camera (it restores on endActivity).
  private activityActive = false;

  // W2.2 spawn-clearing hub: the ranger-cabin (a solid prop the ranger walks
  // around) + the case-board (the MISSION hub — proximity opens the mission board
  // overlay WITHOUT tearing the world down). The board has its own proximity/tap/
  // interact path kept OUT of `markers` so it never pollutes wayfinding or the
  // "nearest mission marker" the E2E steers to.
  private boardGroup: THREE.Group | null = null;
  private boardPos: THREE.Vector3 | null = null;
  private nearBoard = false;
  private onBoardNear: (near: boolean) => void = () => {};
  private onBoardOpen: () => void = () => {};

  // W6.4b2 "Ken je roep" sit-spot: a bench by the vogelkijkhut. Its own
  // proximity/tap/interact path (like the case-board) — walking up surfaces
  // "Luister naar de vogels", and acting on it plays the roep3d perception slice
  // in-place. Kept OUT of `markers` so it never pollutes wayfinding or the
  // "nearest mission" proximity the E2E steers to.
  private sitSpotGroup: THREE.Group | null = null;
  private sitSpotPos: THREE.Vector3 | null = null;
  private nearSitSpot = false;
  private onSitSpotNear: (near: boolean) => void = () => {};
  private onSitSpotActivate: () => void = () => {};

  // W5.1 drivable jeep: a solid parked prop the ranger walks up to ("Stap in"),
  // then drives arcade-kinematic (heading-based, rate-clamped, terrain-stuck)
  // with a WIDER follow-cam; "Stap uit" drops him beside it. Kept OUT of
  // `markers` so it never pollutes wayfinding or the "nearest mission" proximity
  // the E2E steers to (same reasoning as the case-board + scenic actors).
  private jeep: THREE.Group | null = null;
  private jeepPos: THREE.Vector3 | null = null;   // === jeep.position (x/z the controller drives)
  private jeepHeading = 0;                         // yaw the arcade controller steers
  private jeepObstacle: Obstacle | null = null;    // its collision circle while parked
  private inVehicle = false;
  private nearJeep = false;
  private vehicleSpeed = 0;                         // live signed speed (m/s), for the dev hook
  private vehicleNearAnimal = false;                // W5.2: within the auto-slow radius of an animal
  private onJeepNear: (near: boolean) => void = () => {};
  private onVehicleChange: (inVehicle: boolean) => void = () => {};
  // the wider vehicle follow-cam offset (§5 W5.1: distance 9, height 4.5) — the
  // walking offset stays (0, 3.4, 6.2). placeCamera picks by `inVehicle`.
  private readonly camOffsetVehicle = new THREE.Vector3(0, 4.5, 9);

  // W5.3b helicopter (opt-in, unavailable under reduced-motion): a parked prop the
  // ranger walks up to on a helipad, "Stap in" lifts off to a fixed cruise height
  // (exp-damped ≤ 2 m/s climb, always-level horizon, damped yaw only), and landing
  // at either pad steps back out. The pure flight maths live in core/heli.ts; World
  // owns placement, collision (shared resolveMove), the follow-cam and the overlay.
  private heli: THREE.Group | null = null;
  private heliPos: THREE.Vector3 | null = null;     // === heli.position (x/z driven; y = ground + altitude)
  private heliHeading = 0;                           // yaw (the only rotation)
  private heliAltitude = 0;                          // metres above the ground plane
  private heliObstacle: Obstacle | null = null;      // its collision circle while parked on a pad
  private inHeli = false;
  private nearHeli = false;
  private heliLanding = false;                        // descend-to-pad in progress → exit on touchdown
  private heliSpeed = 0;                              // live signed horizontal speed (m/s)
  private heliClimbRate = 0;                          // live signed vertical speed (m/s)
  private heliVignetteVal = 0;                        // live motion-vignette opacity (0 at hover)
  private readonly helipads: { x: number; z: number }[] = [];
  private onHeliNear: (near: boolean) => void = () => {};
  private onHeliChange: (inHeli: boolean) => void = () => {};
  private onHeliFrame: (vignette: number) => void = () => {};
  private heliOptInSource: () => boolean = () => false; // Instellingen "Helikopter" toggle, read live
  // an aerial follow offset (higher + further back than the jeep) — the ranger
  // rides at the heli's world position (y = altitude), so the camera rises with it.
  private readonly camOffsetHeli = new THREE.Vector3(0, 6, 13);

  // W5.2 jeep dust: a single Points cloud (1 draw call, hidden while idle) that
  // kicks up sand behind the driving jeep. Per-particle age/life drives a
  // shader-side fade; emission is OFF under reduced-motion (secondary motion).
  private dust: THREE.Points | null = null;
  private dustPos: Float32Array | null = null;      // N·3 world positions
  private dustVel: Float32Array | null = null;      // N·3 drift velocities
  private dustAge: Float32Array | null = null;      // N ages (s)
  private dustLife: Float32Array | null = null;     // N lifespans (s); ≤0 → dead slot
  private dustNext = 0;                              // round-robin emit cursor
  private dustSeed = 0x9e3779b1;                     // LCG state for deterministic scatter
  private dustEmitting = false;                      // emitted this frame (dev hook: off under reduced-motion)
  private static readonly DUST_N = 40;

  // soft-collision blockers (pine trunks) + the kinematic move limits — the
  // ranger slides around trees, can't wade into the ven, can't leave the world.
  private readonly obstacles: Obstacle[] = [];
  private readonly limits: MoveLimits = {
    bound: 116,                                  // ground plane is 240² → rim ~120
    // off-limits = the submerged ven only (inside the water disc AND below the
    // surface) — NOT a global height test, so dry relief troughs stay walkable.
    blocked: (x, z) => {
      const dx = x - VEN_CENTER.x, dz = z - VEN_CENTER.z;
      return dx * dx + dz * dz < 18 * 18 && heightAt(x, z) < WATER_LEVEL + 0.15;
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
    this.onApproach = onApproach;
    this.onInteract = onInteract;
    this.onWayfind = onWayfind;
    this.onBiome = onBiome;
    this.activeId = activeId;

    this.scene.background = this.skyTexture();
    this.scene.fog = new THREE.Fog(new THREE.Color(SKY_LOW), 22, 90);

    this.scene.add(new THREE.HemisphereLight(0xfde8c8, 0x6d8a45, 0.95));
    // W4.5: a warm, low golden-hour sun raking in from screen-left (the camera
    // looks down −z, so −x is the left of frame). Static direction — no day cycle.
    const sun = new THREE.DirectionalLight(0xffe6b0, 1.6);
    sun.position.copy(this.sunOffset);
    // Selective HERO shadow map: only meshes with castShadow=true (the ranger +
    // solid props, opted in on load) drop a soft shadow. The ortho frustum is
    // kept tight (±16 m) and FOLLOWS the ranger each frame (see update()), so the
    // covered set is always the CLOSEST props — high-res + budget-safe.
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 60;
    const R = 16;
    sun.shadow.camera.left = -R; sun.shadow.camera.right = R;
    sun.shadow.camera.top = R; sun.shadow.camera.bottom = -R;
    sun.shadow.bias = -0.0006; // kill shadow acne on the low-poly ground
    this.scene.add(sun);
    this.scene.add(sun.target); // the shadow camera aims here; moved with the ranger
    this.sun = sun;

    this.ground = this.buildGround();
    this.scene.add(this.ground);
    this.scene.add(this.buildPaths()); // W4.3: sand-path ribbons over the ground
    this.scene.add(this.buildVenWater());
    this.buildCloudShadows(); // W4.6: drifting cloud shadows over the ground
    this.buildFlyover();      // W4.6: the ~12 s bird flyover
    // W7.2: vegetation density scales with the persisted quality tier (laag ≈ half).
    const veg = QUALITY_TIERS[this.tier].vegetationScale;
    this.scatterPines(Math.round(80 * veg));
    this.scatterHeather(Math.round(150 * veg));
    this.scatterMarram(Math.round(110 * veg));
    this.scatterReeds(Math.round(90 * veg));
    this.applyWind(0); // W4.6: initial wind pose for both grass meshes

    // ranger: procedural stand-in first (instant), real model swaps in when loaded
    this.ranger.add(this.proceduralRanger());
    this.scene.add(this.ranger);

    this.camera.up.set(0, 1, 0);
    this.placeCamera(true);

    this.placeMarkers(markers);
    this.placeHub();
    this.placeLandmarks();
    this.placeSitSpot();
    this.placeNatureDressing();
    this.placeScenicActors();
    this.placeAmbientLife();
    this.placeJeep();
    this.placeHelipads();
    void this.loadRealRanger();

    canvas.addEventListener('pointerdown', this.onPointer);
    this.input = attachInput(window, { onInteract: () => this.tryInteract() });
  }

  /**
   * Fire the current proximity action from the interact key (W1.4) — the laptop
   * twin of tapping the "Speel mee" prompt. Only when the ranger stands at a
   * marker (`nearId`) and no in-place activity owns the world; the HUD decides
   * what the action is (open the mission briefing).
   */
  private tryInteract(): void {
    if (this.activityActive) return;
    // W5.1: the jeep owns the interact key when driving (Space = "Stap uit") or
    // when standing beside the parked jeep (Space = "Stap in") — it wins over the
    // hub/marker affordances (they never overlap the jeep's spot in practice).
    if (this.inVehicle) { this.exitVehicle(); return; }
    if (this.inHeli) { this.landHeli(); return; } // W5.3b: Space while flying → land at a pad
    if (this.nearJeep) { this.enterVehicle(); return; }
    // W5.3b: standing beside the parked helicopter → lift off (no-op + a calm
    // "aan de grond" message under reduced-motion / when the toggle is UIT; the
    // HUD reads `heliState().available` to decide what it shows).
    if (this.nearHeli) { this.enterHeli(); return; }
    // the spawn case-board hub wins when the ranger stands at it (W2.2) — its
    // "open the mission board" affordance is what the interact key fires there.
    if (this.nearBoard) { this.onBoardOpen(); return; }
    // W6.4b2: standing at the sit-spot → play the "Ken je roep" slice.
    if (this.nearSitSpot) { this.onSitSpotActivate(); return; }
    if (this.nearId) this.onInteract(this.nearId);
  }

  /** Dev-hook accessor (W1.4): the mission the ranger is standing at, or null. */
  nearMission(): string | null {
    return this.nearId;
  }

  /** Dev-hook accessor (W2.2): the spawn case-board's world position + whether the
   *  ranger currently stands in its radius — lets the E2E steer to the hub and know
   *  it has arrived. `null` before the hub is placed. */
  boardState(): { x: number; z: number; near: boolean } | null {
    if (!this.boardPos) return null;
    return { x: this.boardPos.x, z: this.boardPos.z, near: this.nearBoard };
  }

  /** Register the spawn case-board hub callbacks (W2.2): `onNear(true|false)` as the
   *  ranger enters/leaves the board's radius, and `onOpen()` when he acts on it (tap
   *  the prompt or press the interact key). The mission board opens as an overlay —
   *  the world is never torn down. */
  setBoard(cbs: { onNear: (near: boolean) => void; onOpen: () => void }): void {
    this.onBoardNear = cbs.onNear;
    this.onBoardOpen = cbs.onOpen;
  }

  /** Dev-hook accessor (W6.4b2): the sit-spot's world position + whether the ranger
   *  stands in its radius — lets the E2E steer to the bench and know it has arrived.
   *  `null` before the sit-spot is placed. */
  sitSpotState(): { x: number; z: number; near: boolean } | null {
    if (!this.sitSpotPos) return null;
    return { x: this.sitSpotPos.x, z: this.sitSpotPos.z, near: this.nearSitSpot };
  }

  /** Register the sit-spot callbacks (W6.4b2): `onNear(true|false)` as the ranger
   *  enters/leaves the bench's radius, and `onActivate()` when he acts on it (tap
   *  the prompt or press the interact key). The roep3d slice plays in-place — the
   *  world is never torn down. */
  setSitSpot(cbs: { onNear: (near: boolean) => void; onActivate: () => void }): void {
    this.onSitSpotNear = cbs.onNear;
    this.onSitSpotActivate = cbs.onActivate;
  }

  /** Register the drivable-jeep HUD callbacks (W5.1): `onNear(true|false)` as the
   *  ranger enters/leaves the parked jeep's radius (while walking), and
   *  `onChange(inVehicle)` when he climbs in / steps out. The HUD swaps its
   *  "Stap in" / "Stap uit" affordance from the live `vehicleState()`. */
  setVehicle(cbs: { onNear: (near: boolean) => void; onChange: (inVehicle: boolean) => void }): void {
    this.onJeepNear = cbs.onNear;
    this.onVehicleChange = cbs.onChange;
  }

  /** Register the helicopter HUD callbacks (W5.3b): `onNear` as the ranger enters/
   *  leaves a parked heli's pad radius, `onChange(inHeli)` on lift-off/touchdown
   *  (the HUD toggles the cockpit frame), `onFrame(vignette)` each flight frame (the
   *  HUD drives the motion-vignette opacity — off at hover), and `optIn` = the live
   *  Instellingen "Helikopter" toggle (read each frame, so the availability updates
   *  with no restart). */
  setHeli(cbs: {
    onNear: (near: boolean) => void;
    onChange: (inHeli: boolean) => void;
    onFrame: (vignette: number) => void;
    optIn: () => boolean;
  }): void {
    this.onHeliNear = cbs.onNear;
    this.onHeliChange = cbs.onChange;
    this.onHeliFrame = cbs.onFrame;
    this.heliOptInSource = cbs.optIn;
  }

  /** Dev-hook accessor (W5.3b): the helicopter's live state — placement, the two
   *  helipads, opt-in + availability (withheld under reduced-motion), proximity,
   *  whether the ranger is flying, world position + heading + altitude, the flight
   *  caps + fixed cruise height, whether it is over a pad (can land), the live
   *  vignette, and the comfort invariants (fixed FOV, roll 0) the E2E asserts. Null
   *  before the helicopter is placed. */
  heliState(): {
    placed: boolean; available: boolean; optIn: boolean; near: boolean; inHeli: boolean; onPad: boolean;
    x: number; z: number; heading: number; altitude: number;
    speed: number; climbRate: number; cruiseHeight: number; maxSpeed: number; turnRate: number;
    camDist: number; camHeight: number; fov: number; roll: number; vignette: number;
    pads: { x: number; z: number }[];
  } | null {
    if (!this.heli || !this.heliPos) return null;
    const optIn = this.heliOptInSource();
    // TRUE roll = the camera right-vector's world-y (== 0 at any yaw/pitch because
    // camera.up is world-up), NOT the Euler z — the same trap vehicleState() documents.
    this.camera.updateMatrixWorld();
    const rightY = this.camera.matrixWorld.elements[1];
    return {
      placed: true, available: heliAvailable(optIn, livePolicy().reduced), optIn,
      near: this.nearHeli, inHeli: this.inHeli, onPad: this.overPad(),
      x: this.heliPos.x, z: this.heliPos.z, heading: this.heliHeading, altitude: this.heliAltitude,
      speed: this.heliSpeed, climbRate: this.heliClimbRate,
      cruiseHeight: HELI_CRUISE_HEIGHT, maxSpeed: HELI_CAPS.maxSpeed, turnRate: HELI_CAPS.turnRate,
      camDist: this.camOffsetHeli.z, camHeight: this.camOffsetHeli.y,
      fov: this.camera.fov, roll: rightY, vignette: this.heliVignetteVal,
      pads: this.helipads.map((p) => ({ x: p.x, z: p.z })),
    };
  }

  /** Horizontal distance from the helicopter to the nearest helipad (m). */
  private nearestPadDist(x: number, z: number): number {
    let best = Infinity;
    for (const p of this.helipads) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < best) best = d;
    }
    return best;
  }

  /** Whether the flying helicopter is over a pad (so the interact key can land it). */
  private overPad(): boolean {
    return this.heliPos ? this.nearestPadDist(this.heliPos.x, this.heliPos.z) <= PAD_LAND_R : false;
  }

  /** W5.3b: lift off from the pad into damped flight. No-op unless standing beside
   *  the parked heli AND the mode is available (opt-in + NOT reduced-motion — flight
   *  is the one mode withheld entirely rather than merely calmed). The parked
   *  collision circle is lifted so the aircraft can move; the ranger rides hidden. */
  enterHeli(): void {
    if (this.inHeli || !this.heli || !this.heliPos) return;
    if (!heliAvailable(this.heliOptInSource(), livePolicy().reduced)) return; // withheld
    this.inHeli = true;
    this.heliHeading = this.heli.rotation.y;
    this.heliAltitude = HELI_PAD_HEIGHT;
    this.heliLanding = false;
    this.heliSpeed = 0; this.heliClimbRate = 0; this.heliVignetteVal = 0;
    if (this.heliObstacle) {
      const i = this.obstacles.indexOf(this.heliObstacle);
      if (i >= 0) this.obstacles.splice(i, 1);
      this.heliObstacle = null;
    }
    this.ranger.visible = false;                       // he rides inside
    if (this.nearId) { this.nearId = null; this.onApproach(null); }
    if (this.nearBoard) { this.nearBoard = false; this.onBoardNear(false); }
    this.followTargetYaw = this.heliHeading;
    this.onHeliChange(true);
  }

  /** W5.3b: begin the descent when the interact key is pressed while flying — but
   *  ONLY over a helipad (§5 W5.3 "descend at pads only"). Off a pad it is a no-op
   *  (the HUD then shows a calm "vlieg naar een helipad" hint). The exp-damped
   *  ≤ 2 m/s descent + touchdown-triggered step-out happen in `flyHeli`. */
  landHeli(): void {
    if (!this.inHeli) return;
    if (this.overPad()) this.heliLanding = true;
  }

  /** W5.3b: touchdown — set the helicopter down on the pad, step the ranger out
   *  beside it (its LEFT, like the jeep), and re-park it as a solid prop so it
   *  blocks + can be re-entered. Called from `flyHeli` at ground contact. */
  private exitHeli(): void {
    if (!this.inHeli || !this.heli || !this.heliPos) return;
    this.inHeli = false;
    this.heliLanding = false;
    const h = this.heliHeading;
    const hx = this.heliPos.x, hz = this.heliPos.z;
    this.heliAltitude = HELI_PAD_HEIGHT;
    this.heliPos.y = this.groundY(hx, hz);   // rest on the pad
    this.heli.rotation.set(0, h, HELI_ROLL);
    // step out to the heli's LEFT — (cos h, −sin h); resolveMove keeps him on solid
    // ground and inside the rim, and the heli obstacle isn't back yet so he clears it.
    const side = 2.6;
    const next = resolveMove(hx, hz, hx + Math.cos(h) * side, hz - Math.sin(h) * side, this.obstacles, this.limits);
    this.ranger.position.set(next.x, this.groundY(next.x, next.z), next.z);
    this.ranger.rotation.y = h;
    this.ranger.visible = true;
    this.target.set(next.x, 0, next.z);      // no stale walk target
    this.followTargetYaw = h;
    this.heliSpeed = 0; this.heliClimbRate = 0; this.heliVignetteVal = 0;
    this.playerSpeed = 0;
    this.heliObstacle = { x: hx, z: hz, r: HELI_COLLIDE };
    this.obstacles.push(this.heliObstacle);
    this.nearHeli = true;                     // standing right beside it → "Stap in" again
    this.onHeliChange(false);
    this.onHeliFrame(0);                       // clear the motion vignette
  }

  /** Dev-hook accessor (W5.1): the drivable jeep's live state — placement,
   *  proximity, whether the ranger is driving, world position + heading, the
   *  active arcade caps (reduced-motion halves them), the wider camera offset and
   *  the comfort invariants (fixed FOV, roll 0) the E2E asserts. Null before the
   *  jeep is placed. */
  vehicleState(): {
    placed: boolean; near: boolean; inVehicle: boolean;
    x: number; z: number; heading: number;
    speed: number; maxSpeed: number; turnRate: number;
    camDist: number; camHeight: number; fov: number; roll: number;
    nearAnimal: boolean; dust: boolean;
  } | null {
    if (!this.jeep || !this.jeepPos) return null;
    const caps = driveCaps(livePolicy().reduced);
    const off = this.inVehicle ? this.camOffsetVehicle : this.camOffset;
    // TRUE roll = tilt of the camera's right vector off horizontal. `camera.up` is
    // pinned to world-up and lookAt derives the basis from it, so right lies in the
    // xz-plane → right.y ≈ 0 at ANY yaw/pitch. (camera.rotation.z is NOT roll here —
    // the pitched+yawed Euler couples the axes, the same trap cameraYaw() avoids.)
    this.camera.updateMatrixWorld();
    const rightY = this.camera.matrixWorld.elements[1]; // column 0, row 1 = right.y
    return {
      placed: true, near: this.nearJeep, inVehicle: this.inVehicle,
      x: this.jeepPos.x, z: this.jeepPos.z, heading: this.jeepHeading,
      speed: this.vehicleSpeed, maxSpeed: caps.maxSpeed, turnRate: caps.turnRate,
      camDist: off.z, camHeight: off.y, fov: this.camera.fov, roll: rightY,
      nearAnimal: this.vehicleNearAnimal, dust: this.dustEmitting,
    };
  }

  /** W5.1: climb into the parked jeep — arcade drive mode takes over movement and
   *  the wider follow-cam eases in; the ranger rides hidden. The parked collision
   *  circle is lifted so the jeep can move. No-op unless standing beside it. */
  enterVehicle(): void {
    if (this.inVehicle || !this.jeep || !this.jeepPos) return;
    this.inVehicle = true;
    this.jeepHeading = this.jeep.rotation.y;
    this.vehicleSpeed = 0;
    if (this.jeepObstacle) {
      const i = this.obstacles.indexOf(this.jeepObstacle);
      if (i >= 0) this.obstacles.splice(i, 1);
      this.jeepObstacle = null;
    }
    this.ranger.visible = false;                       // he rides inside
    // clear any walk-time affordances so nothing lingers behind the "Stap uit" pill
    if (this.nearId) { this.nearId = null; this.onApproach(null); }
    if (this.nearBoard) { this.nearBoard = false; this.onBoardNear(false); }
    this.followTargetYaw = this.jeepHeading;
    this.onVehicleChange(true);
    // W5.2: soft engine loop while driving (gated on the sound setting; the
    // Space-to-enter gesture already unlocked the AudioContext).
    if (store.get().settings.geluid) Sound.engineStart();
    if (livePolicy().reduced) this.placeCamera(true, 0, true); // reduced → cut to the wider cam
  }

  /** W5.1: step out of the jeep beside it, back to walking; re-park the jeep as a
   *  solid prop at its resting spot so it blocks + can be re-entered. No-op unless
   *  currently driving. */
  exitVehicle(): void {
    if (!this.inVehicle || !this.jeep || !this.jeepPos) return;
    this.inVehicle = false;
    const h = this.jeepHeading;
    const jx = this.jeepPos.x, jz = this.jeepPos.z;
    // step out to the jeep's LEFT — the left-of-forward vector is (cos h, −sin h)
    // (see vehicle.ts steer derivation). resolveMove keeps him on solid ground
    // and inside the rim; the jeep obstacle isn't back yet, so he clears it fully.
    const side = 2.4;
    const next = resolveMove(jx, jz, jx + Math.cos(h) * side, jz - Math.sin(h) * side, this.obstacles, this.limits);
    this.ranger.position.set(next.x, this.groundY(next.x, next.z), next.z);
    this.ranger.rotation.y = h;
    this.ranger.visible = true;
    this.target.set(next.x, 0, next.z);   // no stale walk target
    this.followTargetYaw = h;
    this.vehicleSpeed = 0;
    this.playerSpeed = 0;
    // re-park the jeep as a solid obstacle at its new resting spot
    this.jeepObstacle = { x: jx, z: jz, r: JEEP_COLLIDE };
    this.obstacles.push(this.jeepObstacle);
    this.nearJeep = true;                  // standing right beside it → "Stap in" again
    this.vehicleNearAnimal = false;
    this.dustEmitting = false;
    Sound.engineStop();                    // W5.2: engine falls silent on step-out
    this.onVehicleChange(false);
    if (livePolicy().reduced) this.placeCamera(true, 0, true); // reduced → cut back to walk cam
  }

  /** Dev-hook accessor (W1.4): every marker's world position, for E2E navigation. */
  markerPositions(): { x: number; z: number; missionId: string }[] {
    return this.markers.map((m) => ({ x: m.pos.x, z: m.pos.z, missionId: m.missionId }));
  }

  /** Register the on-screen joystick's live-vector source (W1.3). The HUD wires
   *  it on world entry; pass null to clear. Fused with held keys each frame. */
  setJoystick(source: (() => StickVector | null) | null): void {
    this.joystickSource = source;
  }

  /** Register the "Camera draait mee" setting source (W1.5). Read live each frame
   *  so the toggle takes effect with no restart; null → default aan. */
  setCameraFollow(source: (() => boolean) | null): void {
    this.cameraFollowSource = source;
  }

  /** Dev-hook accessor (WORLD-PLAN §3.1): the ranger's world position {x,z}. */
  pos(): { x: number; z: number } {
    return { x: this.ranger.position.x, z: this.ranger.position.z };
  }

  /** Dev-hook accessor: the follow-camera yaw in radians — the world direction
   *  "into the screen" that camera-relative input (`resolveInput`) rotates by.
   *  Derived DIRECTLY from the follow bearing (not read back from the pitched
   *  camera's Euler, which couples yaw with pitch): the camera looks along
   *  `(sin followYaw, cos followYaw)`, and `resolveInput`'s forward at yaw ψ is
   *  `(−sin ψ, −cos ψ)`, so ψ = followYaw + π. Fixed-bearing (followYaw = π)
   *  reads exactly 0, matching the W1.2–W1.4 baseline; the rotating follow makes
   *  it track input-driven facing so the W1.5 yaw-change assert has a real signal. */
  cameraYaw(): number {
    return wrapAngle(this.followYaw + Math.PI);
  }

  dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointer);
    Sound.engineStop(); // W5.2: never leak the engine loop past teardown
    this.input?.dispose();
    this.input = null;
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
  }

  // ---- build ----
  private skyTexture(): THREE.Texture {
    const c = document.createElement('canvas');
    c.width = 2; c.height = 256;
    const ctx = c.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    // W4.6: a richer, multi-band golden-hour ramp (Atmosphere.SKY_STOPS) instead
    // of the old three-stop wash — soft warm bands from zenith to horizon.
    for (const [at, col] of SKY_STOPS) g.addColorStop(at, col);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 2, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private buildGround(): THREE.Mesh {
    // continuous biome relief (Biomes.heightAt) + per-vertex biome tint so heide
    // fades into bos / stuifzand / ven with no seam. One draw call (vertexColors).
    // W4.4: on top of the flat slab, each vertex gets a low-frequency brightness
    // wash (vertexTint) and the material carries a repeating procedural mottle
    // canvas (mottleRGB) for hand-brushed grain — both add detail, no draw calls.
    const detail = this.groundDetailOn;
    const geo = new THREE.PlaneGeometry(240, 240, 96, 96);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i); // plane is XY before the -90° tilt → world z = y
      pos.setZ(i, this.groundY(x, y));
      c.set(BIOME_PALETTE[biomeAt(x, y)].ground);
      if (detail) {
        // brighten to offset the mottle map's average shade (parity), then a soft
        // per-vertex wash blotch; clamp so no channel blows past 1.
        const m = GROUND_BRIGHTEN * vertexTint(x, y);
        c.setRGB(Math.min(1, c.r * m), Math.min(1, c.g * m), Math.min(1, c.b * m));
      }
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
    if (detail) mat.map = this.groundMottleTexture();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true; // W4.5: the hero shadow lands on the ground
    return mesh;
  }

  /** W4.5: opt a loaded prop/ranger into the hero shadow map (Models.ts clears
   *  castShadow on every mesh at load, so this re-enables it on the hero set only).
   *  The sun's tight ranger-following frustum still culls to the closest props. */
  private static enableCast(obj: THREE.Object3D): void {
    obj.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  }

  /** W4.5: a soft radial blob texture (dark centre → transparent rim), baked once
   *  and shared by every animal blob shadow — cheap grounding with no shadow-map
   *  cost, the plan's choice for the moving cast. */
  private static getBlobTexture(): THREE.Texture {
    if (World.blobTex) return World.blobTex;
    const N = 64;
    const cv = document.createElement('canvas');
    cv.width = cv.height = N;
    const ctx = cv.getContext('2d')!;
    const g = ctx.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
    g.addColorStop(0, 'rgba(30,24,12,0.55)');
    g.addColorStop(0.6, 'rgba(30,24,12,0.28)');
    g.addColorStop(1, 'rgba(30,24,12,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, N, N);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    World.blobTex = tex;
    return tex;
  }

  /** W4.5: add a flat blob shadow disc under an animal/actor group. A child of the
   *  group, so it rides the wander loop for free and freezes with the animal under
   *  reduced-motion. Radially symmetric → the group's yaw never shows. */
  private addBlobShadow(group: THREE.Group, radius: number): void {
    const mat = new THREE.MeshBasicMaterial({
      map: World.getBlobTexture(), transparent: true, depthWrite: false,
    });
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), mat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.03; // just above the ground to avoid z-fighting
    disc.renderOrder = 1;
    group.add(disc);
    this.blobCount++;
  }

  /**
   * W4.6: drifting cloud shadows. ONE large flat plane over the play area,
   * MULTIPLY-blended so its soft grey blobs darken the ground pixels behind it —
   * a real cheap cloud shadow (one draw call, no shadow-map cost). The texture
   * repeats and its offset is scrolled by `cloudOffset(skyTime)` each frame, so
   * the patches drift; a frozen clock (reduced-motion) stops them. Sits low over
   * the terrain and only DARKENS (multiply against white = no change), so it
   * never adds a visible plane — just soft moving shade.
   */
  private buildCloudShadows(): void {
    const N = 256;
    const cv = document.createElement('canvas');
    cv.width = cv.height = N;
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = '#ffffff'; // white = "no darkening" under multiply
    ctx.fillRect(0, 0, N, N);
    // a few soft grey blobs = the cloud undersides that darken the ground. Drawn
    // with wrap-around copies so the tile stays seamless when it repeats.
    const blobs: [number, number, number, number][] = [
      [0.22, 0.30, 0.26, 0.30], [0.66, 0.20, 0.20, 0.24],
      [0.48, 0.62, 0.30, 0.26], [0.83, 0.74, 0.22, 0.22],
      [0.12, 0.82, 0.18, 0.20],
    ];
    for (const [bx, by, br, a] of blobs) {
      for (const ox of [-1, 0, 1]) for (const oy of [-1, 0, 1]) {
        const cx = (bx + ox) * N, cy = (by + oy) * N, r = br * N;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, `rgba(120,116,110,${a})`); // soft warm-grey shade
        g.addColorStop(1, 'rgba(120,116,110,0)');
        ctx.fillStyle = g;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2.2, 2.2); // ~110 m per tile over the 240 m ground — big soft clouds
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false,
      blending: THREE.MultiplyBlending, premultipliedAlpha: true, // three wants this for multiply
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 3.2;   // low over the gentle relief so shade reads on the ground
    mesh.renderOrder = 2;    // after the ground + props so the multiply lands on them
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    this.cloudLayer = mesh;
  }

  /**
   * W4.6: the bird flyover. A small dark silhouette (a shallow V of two wings)
   * high in the sky; `flyoverAt(skyTime)` sails it west→east on the ~12 s period
   * with a calm gap between passes. Parked off-view / frozen under reduced-motion.
   */
  private buildFlyover(): void {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: '#3b3630' });
    const wing = new THREE.BoxGeometry(1.6, 0.06, 0.34);
    const left = new THREE.Mesh(wing, mat);
    const right = new THREE.Mesh(wing, mat);
    left.position.set(-0.75, 0, 0); left.rotation.z = 0.28;
    right.position.set(0.75, 0, 0); right.rotation.z = -0.28;
    g.add(left, right);
    g.visible = false;
    this.flyBird = g;
    this.scene.add(g);
  }

  /**
   * W4.6: re-tilt every wind-blade to `windSway(skyTime, phase)` about its base
   * transform. Cheap (a few hundred instance matrices), skipped when the clock is
   * unchanged (reduced-motion → one still pose, no redundant GPU uploads).
   */
  private applyWind(t: number): void {
    if (t === this.lastWindT) return;
    this.lastWindT = t;
    for (const wm of this.windMeshes) {
      for (let k = 0; k < wm.items.length; k++) {
        const it = wm.items[k];
        World._e.set(0, 0, windSway(t, it.phase) * wm.strength);
        World._q.setFromEuler(World._e);
        World._p.set(it.x, it.y, it.z);
        World._s.set(it.sx, it.sy, it.sx);
        World._m.compose(World._p, World._q, World._s);
        wm.mesh.setMatrixAt(k, World._m);
      }
      wm.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /**
   * W4.4: bake the fine painterly grain (GroundDetail.mottleRGB) onto ONE small
   * canvas that repeats over the terrain. Grayscale-ish + faintly warm, so
   * multiplied against the biome vertex colour it reads as brushed tonal
   * variation. No external texture fetch, one texture shared by the single ground
   * draw call. Seamlessly tileable (the pure fn wraps), so no repeat seams show.
   */
  private groundMottleTexture(): THREE.CanvasTexture {
    const N = GROUND_TILE_PX;
    const cv = document.createElement('canvas');
    cv.width = cv.height = N;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(N, N);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const [r, g, b] = mottleRGB(i / N, j / N);
        const o = (j * N + i) * 4;
        img.data[o] = Math.round(r * 255);
        img.data[o + 1] = Math.round(g * 255);
        img.data[o + 2] = Math.round(b * 255);
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(GROUND_TILE_REPEAT, GROUND_TILE_REPEAT);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  /**
   * W4.8: the ven-water disc — a FRESNEL-tinted still plane. A custom shader
   * mixes a deep forest-teal (seen head-on) with a lighter warm sky-glow (at
   * grazing angles) by the Schlick view-angle factor (`Water.ts` mirrors the
   * maths), so the disc reads as water instead of a flat painted circle. The
   * ripple is a GENTLE FRAGMENT-TINT shimmer only — never a vertex displacement —
   * so the silhouette never moves (motion-comfort §1e/§C); it is WAVELESS by
   * default and its amplitude (`uAmp`) is driven to exactly 0 under reduced-motion
   * from `update()`. One mesh → one draw call, budget untouched (§3.4).
   */
  private buildVenWater(): THREE.Mesh {
    const geo = new THREE.CircleGeometry(20, 48);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uAmp: { value: 0 },
        uDeep: { value: new THREE.Color(WATER_DEEP) },
        uShallow: { value: new THREE.Color(WATER_SHALLOW) },
        uOpacity: { value: WATER_OPACITY },
        uFresnelPower: { value: FRESNEL_POWER },
      },
      vertexShader: `
        varying vec3 vWorld;
        void main() {
          vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uAmp;
        uniform vec3 uDeep;
        uniform vec3 uShallow;
        uniform float uOpacity;
        uniform float uFresnelPower;
        varying vec3 vWorld;
        void main() {
          // flat, up-facing plane → normal is world-up; fresnel from the view's
          // vertical component (straight-down = deep, grazing = sky-glow).
          vec3 viewDir = normalize(cameraPosition - vWorld);
          float fres = pow(clamp(1.0 - max(viewDir.y, 0.0), 0.0, 1.0), uFresnelPower);
          // subtle crossing shimmer — two slow sines over world position; uAmp is
          // 0 under reduced-motion so this term vanishes (dead-still mirror).
          float ripple = sin(vWorld.x * 1.15 + uTime * 0.8)
                       * sin(vWorld.z * 1.07 - uTime * 0.55);
          float mixv = clamp(fres + ripple * uAmp, 0.0, 1.0);
          vec3 col = mix(uDeep, uShallow, mixv);
          gl_FragColor = vec4(col, uOpacity);
        }
      `,
    });
    this.waterMat = mat;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(VEN_CENTER.x, WATER_LEVEL, VEN_CENTER.z);
    return mesh;
  }

  /** sample ground height at world x,z (delegates to the pure biome field). */
  private groundY(x: number, z: number): number {
    return heightAt(x, z);
  }

  /**
   * W4.3: the sand-path network (Paths.ts / §4) as ONE terrain-hugging ribbon
   * mesh — a warm sand strip laid a hair above the ground along every §4 edge so
   * the routes read visually (spawn ↔ the POIs). The whole network is a single
   * merged geometry → one draw call, so the budget (§3.4, <150) is untouched. Each
   * rib samples `groundY` at BOTH edge vertices so the strip hugs the rolling
   * relief instead of poking through it; a small +y lift + polygonOffset keeps it
   * off the ground plane without z-fighting. Sand vertex colour, no texture fetch.
   */
  private buildPaths(): THREE.Mesh {
    const HALF = LANE_HALF;
    const STEP = 1.6;        // rib spacing along a segment (m)
    const LIFT = 0.05;       // sit just above the terrain
    const sand = new THREE.Color('#cdb887');
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    for (const [i, j] of PATH_SEGMENTS) {
      const a = PATH_NODES[i], b = PATH_NODES[j];
      const dx = b.x - a.x, dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 1;
      // unit perpendicular in XZ for the ribbon width
      const px = -dz / len, pz = dx / len;
      const ribs = Math.max(2, Math.ceil(len / STEP) + 1);
      const base = positions.length / 3;
      for (let r = 0; r < ribs; r++) {
        const t = r / (ribs - 1);
        const cx = a.x + dx * t, cz = a.z + dz * t;
        const lx = cx + px * HALF, lz = cz + pz * HALF;
        const rx = cx - px * HALF, rz = cz - pz * HALF;
        positions.push(lx, this.groundY(lx, lz) + LIFT, lz);
        positions.push(rx, this.groundY(rx, rz) + LIFT, rz);
        colors.push(sand.r, sand.g, sand.b, sand.r, sand.g, sand.b);
        if (r > 0) {
          const p = base + (r - 1) * 2, q = base + r * 2;
          // two triangles between rib r-1 and r
          indices.push(p, p + 1, q, q, p + 1, q + 1);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 1, metalness: 0,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 1; // draw over the ground plane
    return mesh;
  }

  /**
   * Deterministic golden-angle candidate positions over the world, kept only where
   * they fall in the wanted biome (so each landschap grows its own vegetation) and
   * outside the lodge clearing. Returns the surviving (x,z) — fully reproducible.
   */
  private candidates(count: number, want: Biome): { x: number; z: number; i: number }[] {
    const out: { x: number; z: number; i: number }[] = [];
    for (let i = 0; i < count; i++) {
      const ang = i * 2.39996; // golden angle
      const rad = 12 + (i / count) * 100;
      const x = Math.cos(ang) * rad + Math.sin(i * 12.9) * 6;
      const z = Math.sin(ang) * rad + Math.cos(i * 7.3) * 6;
      if (Math.hypot(x, z) < 12) continue;        // clearing
      if (biomeAt(x, z) !== want) continue;        // wrong landschap
      out.push({ x, z, i });
    }
    return out;
  }

  private scatterPines(budget: number): void {
    const spots = this.candidates(budget * 4, 'bos');
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1.2, 6);
    const crownGeo = new THREE.ConeGeometry(0.95, 2.4, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#5b4327', roughness: 1 });
    const crownMat = new THREE.MeshStandardMaterial({ color: BIOME_PALETTE.bos.ground, roughness: 1 });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, spots.length);
    const m = new THREE.Matrix4();
    spots.forEach(({ x, z, i }, k) => {
      const s = 0.8 + (i % 5) * 0.12;
      const y = this.groundY(x, z);
      m.makeScale(s, s, s); m.setPosition(x, y + 0.6 * s, z); trunks.setMatrixAt(k, m);
      m.makeScale(s, s, s); m.setPosition(x, y + 1.9 * s, z); crowns.setMatrixAt(k, m);
      // a soft collision circle around each trunk (the ranger slides around it)
      this.obstacles.push({ x, z, r: 0.6 * s });
    });
    trunks.instanceMatrix.needsUpdate = true; crowns.instanceMatrix.needsUpdate = true;
    this.scene.add(trunks, crowns);
  }

  private scatterHeather(budget: number): void {
    const spots = this.candidates(budget * 3, 'heide');
    const geo = new THREE.IcosahedronGeometry(0.32, 0);
    const mat = new THREE.MeshStandardMaterial({ color: BIOME_PALETTE.heide.accent, roughness: 1, flatShading: true });
    const tufts = new THREE.InstancedMesh(geo, mat, spots.length);
    const m = new THREE.Matrix4();
    spots.forEach(({ x, z, i }, k) => {
      const s = 0.5 + (i % 4) * 0.22;
      m.makeScale(s, s * 0.6, s); m.setPosition(x, this.groundY(x, z) + 0.12, z);
      tufts.setMatrixAt(k, m);
    });
    tufts.instanceMatrix.needsUpdate = true;
    this.scene.add(tufts);
  }

  /** Drift-sand marram tussocks — upright pale grass blades on the stuifzand.
   *  W4.6: registered as a wind mesh so the blades lean in the breeze. */
  private scatterMarram(budget: number): void {
    const spots = this.candidates(budget * 4, 'stuifzand');
    const geo = new THREE.ConeGeometry(0.16, 0.9, 5);
    const mat = new THREE.MeshStandardMaterial({ color: BIOME_PALETTE.stuifzand.accent, roughness: 1, flatShading: true });
    const grass = new THREE.InstancedMesh(geo, mat, spots.length);
    const items: { x: number; y: number; z: number; sx: number; sy: number; phase: number }[] = [];
    spots.forEach(({ x, z, i }) => {
      const s = 0.6 + (i % 3) * 0.25;
      items.push({ x, y: this.groundY(x, z) + 0.4 * s, z, sx: s, sy: s, phase: (i % 7) * 0.9 });
    });
    this.windMeshes.push({ mesh: grass, items, strength: 1 }); // full sway — exposed dune grass
    this.scene.add(grass);
  }

  /** Reed clumps fringing the ven — only on land just above the waterline.
   *  W4.6: registered as a wind mesh (softer sway than the exposed marram). */
  private scatterReeds(budget: number): void {
    const spots = this.candidates(budget * 6, 'ven').filter(({ x, z }) => {
      const y = this.groundY(x, z);
      return y > WATER_LEVEL - 0.1 && y < WATER_LEVEL + 1.1; // a reed belt at the shore
    });
    const geo = new THREE.CylinderGeometry(0.04, 0.06, 1.1, 5);
    const mat = new THREE.MeshStandardMaterial({ color: '#8f8a4a', roughness: 1 });
    const reeds = new THREE.InstancedMesh(geo, mat, Math.max(1, spots.length));
    const items: { x: number; y: number; z: number; sx: number; sy: number; phase: number }[] = [];
    spots.forEach(({ x, z, i }) => {
      const s = 0.7 + (i % 4) * 0.2;
      items.push({ x, y: this.groundY(x, z) + 0.55 * s, z, sx: s, sy: s, phase: (i % 5) * 1.3 });
    });
    reeds.count = items.length;
    this.windMeshes.push({ mesh: reeds, items, strength: 0.7 }); // reeds sway gentler
    this.scene.add(reeds);
  }

  private proceduralRanger(): THREE.Group {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: '#3f7a3a', roughness: 1 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.6, 4, 8), mat);
    body.position.y = 0.7;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshStandardMaterial({ color: '#e8c39a', roughness: 1 }));
    head.position.y = 1.32;
    g.add(body, head);
    return g;
  }

  private async loadRealRanger(): Promise<void> {
    await loadManifest();
    // W3.2: load WITH clips (the W3.1-staged rig carries idle/walk/run) so the
    // player animates. loadRig falls back to a static group when no clips exist.
    const rig = await loadRig('ranger-alvah');
    if (!rig) return;
    const prepped = prepModel(rig.group, 1.25);
    // §1e eye system: bright, alive eyes (the golden-hour world is not dusk, so
    // eyeshine stays off; parallax freezes under reduced-motion).
    applyEyes(prepped, 'ranger-alvah', { dusk: false }); // parallax reads the live policy (no restart)
    // §A ARKit face: data-driven emotion + always-alive blink/microsaccade. The
    // child ranger blinks at the lower child rate. Best-effort — a humanoid GLB with
    // no ARKit blendshape rig (the Meshy mesh today) is left untouched, never throws.
    // Expression + blink are essential motion, so they stay on under reduced-motion.
    applyFace(prepped, { emotion: 'neutral', child: true }); // microsaccade reads the live policy (no restart)
    World.enableCast(prepped); // W4.5: the ranger is the primary hero shadow caster
    this.rangerCastsShadow = true;
    this.ranger.clear();
    this.ranger.add(prepped);
    // wire the locomotion mixer: idle/walk crossfade by speed, or a procedural
    // bob when the clips are missing (loadRig returned an empty clip list).
    if (rig.clips.length) this.playerRig.attach(prepped, rig.clips);
    else this.playerRig.attachProcedural(prepped);
  }

  /** The ranger's active locomotion clip for the dev hook (null when procedural). */
  playerClip(): { name: string; time: number } | null {
    return this.playerRig.clip();
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
      sunCastsShadow: this.sun ? this.sun.castShadow : false,
      rangerCastsShadow: this.rangerCastsShadow,
      blobShadows: this.blobCount,
    };
  }

  /** Dev-hook accessor (W4.6): the live "Lucht + adem" state — richer-gradient
   *  stop count, whether the cloud-shadow layer + wind grasses are present, and
   *  the LIVE cloud offset / wind phase / bird position so the E2E can prove the
   *  ambient motion advances when moving AND freezes under reduced-motion. */
  skyState(): {
    gradientStops: number;
    cloudDrift: boolean;
    windMeshes: number;
    skyTime: number;
    cloudOffset: { x: number; y: number };
    windSample: number;
    flyover: { x: number; y: number; z: number; visible: boolean } | null;
  } {
    const f = this.lastFlyover;
    return {
      gradientStops: SKY_STOPS.length,
      cloudDrift: this.cloudLayer !== null,
      windMeshes: this.windMeshes.length,
      skyTime: this.skyTime,
      cloudOffset: cloudOffset(this.skyTime),
      windSample: windSway(this.skyTime, 0),
      flyover: f ? { x: f.x, y: f.y, z: f.z, visible: f.visible } : null,
    };
  }

  /** Dev-hook accessor (W4.7b): the running footstep count + the last surface
   *  the ranger planted a foot on, so the E2E can prove footsteps fire while
   *  walking (and the sound gate holds them when `geluid` is off). */
  footstepState(): { count: number; surface: FootSurface | null } {
    return { count: this.footstepCount, surface: this.lastFootSurface };
  }

  /** Dev-hook accessor (W4.8): the live ven-water state — whether the fresnel
   *  shader disc exists, the ripple amplitude in force (0 under reduced-motion →
   *  waveless), and the live clock, so the E2E can prove the disc ripples with
   *  motion on and holds dead-still under reduced-motion. */
  waterState(): { shader: boolean; amp: number; time: number } {
    const mat = this.waterMat;
    return {
      shader: mat !== null,
      amp: mat ? (mat.uniforms.uAmp.value as number) : 0,
      time: mat ? (mat.uniforms.uTime.value as number) : 0,
    };
  }

  private placeMarkers(markers: WorldMarker[]): void {
    const N = Math.max(1, markers.length);
    const perBiome = new Map<Biome, number>();
    markers.forEach((mk, i) => {
      let x: number, z: number;
      if (mk.biome) {
        // anchor each mission in the heart of its own landschap; fan repeats outward
        const n = perBiome.get(mk.biome) ?? 0;
        perBiome.set(mk.biome, n + 1);
        const a = anchorInBiome(mk.biome, 22 + n * 9);
        x = a.x; z = a.z;
      } else {
        const ang = (i / N) * Math.PI * 2;
        x = Math.cos(ang) * 9; z = Math.sin(ang) * 9;
      }
      const group = new THREE.Group();
      group.position.set(x, this.groundY(x, z), z);

      // a soft halo ring so every marker reads as "go here", model or totem
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1.15, 24),
        new THREE.MeshBasicMaterial({ color: mk.color, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      group.add(ring);

      // a small diegetic name-tag floating above the marker (in-world label, no
      // minimap chrome) — a camera-facing sprite so it stays readable from any angle
      const label = this.makeLabel(mk.titel, mk.color);
      label.position.y = 1.9;
      group.add(label);

      group.add(this.proceduralTotem(mk.color)); // instant stand-in
      this.scene.add(group);
      const entry = {
        group, pos: group.position.clone(), missionId: mk.missionId,
        recipe: gaitFor(mk.modelId), phase: i * 1.7, label,
        anim: null as THREE.Group | null, mixer: null as THREE.AnimationMixer | null,
      };
      this.markers.push(entry);

      if (mk.modelId) {
        void loadRig(mk.modelId).then((rig) => {
          if (!rig) return;
          const prepped = prepModel(rig.group, mk.height);
          // §1e eye system per species (catchlight + clearcoat cornea + pupil +
          // iris parallax); golden-hour world ⇒ dusk off (eyeshine stays calm).
          applyEyes(prepped, mk.modelId, { dusk: false }); // parallax reads the live policy (no restart)
          // W3.7b dossier: coat-tint correction (only for a confirmed contradiction,
          // e.g. the CC0 vos) + a subtle head-low posture for snuffling species.
          applyCoat(prepped, mk.modelId);
          applyPosture(prepped, mk.modelId);
          // §B never-scary calm-pose: a static rest-pose bias (ears/tail/head into the
          // calm shape). Best-effort — a single-mesh Meshy animal with no named bones is
          // left untouched. Not motion (one-time nudge), so reduced-motion does not apply.
          applyCalmPose(prepped, mk.modelId);
          // drop the totem (keep the ring), add the real animal
          const totem = group.children.find((c) => c.userData.totem);
          if (totem) group.remove(totem);
          group.add(prepped);
          if (rig.clips.length) {
            // prefer the real baked rig: play a calm idle (or the first clip)
            const mixer = new THREE.AnimationMixer(prepped);
            const idle = rig.clips.find((c) => /idle|rest|stand|breath/i.test(c.name)) ?? rig.clips[0];
            mixer.clipAction(idle).play();
            entry.mixer = mixer;
          } else {
            // no rig → the always-on procedural fallback drives this wrapper
            entry.anim = prepped;
          }
        });
      }
    });
  }

  /** A camera-facing sprite name-tag (rounded warm card + the mission title). */
  private makeLabel(text: string, color: string): THREE.Sprite {
    const pad = 24, fontPx = 44;
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d')!;
    ctx.font = `600 ${fontPx}px Inter, system-ui, sans-serif`;
    const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
    const h = fontPx + pad * 2;
    c.width = w; c.height = h;
    // rounded warm card
    const r = 22;
    ctx.fillStyle = 'rgba(40, 30, 18, 0.78)';
    ctx.beginPath();
    ctx.moveTo(r, 0); ctx.arcTo(w, 0, w, h, r); ctx.arcTo(w, h, 0, h, r);
    ctx.arcTo(0, h, 0, 0, r); ctx.arcTo(0, 0, w, 0, r); ctx.closePath(); ctx.fill();
    // a colour pip + the title (dual-channel: colour + word)
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(pad + 10, h / 2, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fdf6e8';
    ctx.font = `600 ${fontPx}px Inter, system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, pad + 34, h / 2 + 2);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    const scale = 0.0042; // world units per px → ~legible without dominating
    sprite.scale.set(w * scale, h * scale, 1);
    return sprite;
  }

  /**
   * Place the spawn-clearing hub (§4, W2.2): the ranger-cabin (a solid building the
   * ranger walks around) and the case-board (the mission hub — walking up to it
   * opens the mission board). Both are best-effort GLBs over a procedural stand-in.
   * The props sit to the +x/+z side of spawn so the forward (−z) corridor the
   * movement smoke walks stays clear, and both push a collision circle.
   */
  private placeHub(): void {
    // ranger-cabin: off to one side of spawn, its door turned toward the clearing;
    // a solid blocker (bigger collision circle) the ranger can't walk through.
    const cabinAt = new THREE.Vector3(-4.6, 0, 3.6);
    cabinAt.y = this.groundY(cabinAt.x, cabinAt.z);
    const cabin = new THREE.Group();
    cabin.position.copy(cabinAt);
    cabin.rotation.y = Math.atan2(-cabinAt.x, -cabinAt.z); // face the spawn point
    cabin.add(this.proceduralCabin());
    this.scene.add(cabin);
    this.obstacles.push({ x: cabinAt.x, z: cabinAt.z, r: 2.0 });
    void loadModel('prop-ranger-cabin').then((m) => {
      if (!m) return;
      const prepped = prepModel(m, 3.0);
      World.enableCast(prepped); // W4.5: the spawn cabin is a hero prop near the player
      cabin.remove(...cabin.children);
      cabin.add(prepped);
    });

    // case-board: to the other side of spawn, ~4.4 m out — the mission hub. A halo
    // ring + a floating "Missiebord" tag read as "go here", like a mission marker.
    const boardAt = new THREE.Vector3(3.6, 0, 2.6);
    boardAt.y = this.groundY(boardAt.x, boardAt.z);
    const board = new THREE.Group();
    board.position.copy(boardAt);
    board.rotation.y = Math.atan2(-boardAt.x, -boardAt.z); // face the spawn point
    board.add(this.proceduralBoard());
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.15, 24),
      new THREE.MeshBasicMaterial({ color: '#f5c23b', transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    board.add(ring);
    const label = this.makeLabel('Missiebord', '#f5c23b');
    label.position.y = 2.0;
    board.add(label);
    this.scene.add(board);
    this.obstacles.push({ x: boardAt.x, z: boardAt.z, r: 0.7 });
    this.boardGroup = board;
    this.boardPos = boardAt.clone();
    void loadModel('prop-case-board').then((m) => {
      if (!m) return;
      const prepped = prepModel(m, 1.8);
      const totem = board.children.find((c) => c.userData.totem);
      if (totem) board.remove(totem);
      board.add(prepped); // keep the ring + label
    });
  }

  /**
   * W6.4b2: the "Ken je roep" sit-spot — a calm wooden bench a couple of metres
   * out from the vogelkijkhut (landmark at 26,-11), facing the open heath so the
   * perched bird forms of the perception slice have room to sit in front. Like the
   * case-board hub it carries a halo ring + a floating "Zitplek · luister" label so
   * it reads as "go here" (the diegetic wayfinding cue — no minimap chrome), and it
   * has its own proximity/tap/interact path OUTSIDE `markers`. Acting on it plays
   * `roep3d` in-place (Missions wires `onActivate`). The bench is a small procedural
   * prop (no GLB dependency); its collision circle is tiny so the ranger can stand
   * right at it.
   */
  private placeSitSpot(): void {
    const at = new THREE.Vector3(22, 0, -6.5);
    at.y = this.groundY(at.x, at.z);
    const group = new THREE.Group();
    group.position.copy(at);
    // turn the seat to look out over the heath (away from the clearing/hide)
    group.rotation.y = Math.atan2(at.x, at.z);
    group.add(this.proceduralBench());
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.15, 24),
      new THREE.MeshBasicMaterial({ color: '#8ab6d6', transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    group.add(ring);
    const label = this.makeLabel(ROEP_COPY.wayfinding, '#cfe6f2');
    label.position.y = 1.7;
    group.add(label);
    this.scene.add(group);
    this.obstacles.push({ x: at.x, z: at.z, r: 0.5 });
    this.sitSpotGroup = group;
    this.sitSpotPos = at.clone();
  }

  /** A small calm wooden bench (two legs + a seat + a low backrest) — an instant
   *  procedural prop so the sit-spot needs no GLB. Warm heath-wood tones. */
  private proceduralBench(): THREE.Group {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: '#7a5f3e', roughness: 1 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.09, 0.42), wood);
    seat.position.y = 0.46;
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.34, 0.07), wood);
    back.position.set(0, 0.7, -0.18);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.46, 0.42), wood);
    legL.position.set(-0.6, 0.23, 0);
    const legR = legL.clone();
    legR.position.x = 0.6;
    g.add(seat, back, legL, legR);
    return g;
  }

  /**
   * W4.1: place the fixed landmark props per the §4 world map — the
   * fire-watchtower (bos beacon), the vogelkijkhut overlooking the ven, the
   * ecoduct + BOA post on the west rim, and two wegwijzer signposts along the
   * routes out of the spawn clearing. Each is a best-effort GLB over an instant
   * procedural totem stand-in; every one pushes a solid collision circle (the
   * ranger slides around it), and the four named beacons float a diegetic label
   * so they read as wayfinding cues from a distance (no minimap chrome — same
   * camera-facing sprite the mission markers + case-board use). None join
   * `markers`: they are set-dressing, not missions, so they never pollute the
   * "nearest mission" proximity/wayfinding path. Positions sit clear of the
   * −z movement-smoke corridor and off the mission-marker anchors (radius 22+).
   */
  private placeLandmarks(): void {
    // [dev-hook id, GLB model, world x/z, target Y-height (m), collision radius,
    //  optional beacon label]. The watchtower is deliberately the farthest —
    //  the W4.1 E2E walks spawn→watchtower.
    const LANDMARKS: {
      id: string; model: string; x: number; z: number; height: number; collide: number; label?: string;
    }[] = [
      { id: 'prop-fire-watchtower', model: 'prop-fire-watchtower', x: 37, z: -37, height: 9, collide: 1.8, label: 'Uitkijktoren' },
      { id: 'prop-bird-hide', model: 'prop-bird-hide', x: 26, z: -11, height: 2.8, collide: 1.4, label: 'Vogelkijkhut' },
      { id: 'prop-ecoduct', model: 'prop-ecoduct', x: -70, z: 6, height: 6, collide: 2.6, label: 'Ecoduct' },
      { id: 'prop-boa-post', model: 'prop-boa-post', x: -56, z: -20, height: 3, collide: 1.0, label: 'BOA-post' },
      { id: 'prop-signpost', model: 'prop-signpost', x: 9, z: -8, height: 1.7, collide: 0.5 },
      { id: 'prop-signpost-west', model: 'prop-signpost', x: -16, z: 10, height: 1.7, collide: 0.5 },
    ];
    for (const lm of LANDMARKS) {
      const at = new THREE.Vector3(lm.x, this.groundY(lm.x, lm.z), lm.z);
      const group = new THREE.Group();
      group.position.copy(at);
      group.rotation.y = Math.atan2(-lm.x, -lm.z); // turn its face toward the clearing
      group.add(this.proceduralTotem(lm.label ? '#c8a36a' : '#8a7a5a')); // instant stand-in
      if (lm.label) {
        const label = this.makeLabel(lm.label, '#e8d6a8');
        label.position.y = lm.height * 0.55 + 1.4;
        group.add(label);
      }
      this.scene.add(group);
      this.obstacles.push({ x: lm.x, z: lm.z, r: lm.collide });
      this.landmarks.push({ id: lm.id, x: lm.x, z: lm.z });
      void loadModel(lm.model).then((m) => {
        if (!m) return;
        const prepped = prepModel(m, lm.height);
        World.enableCast(prepped); // W4.5: solid landmarks cast when near the player
        const totem = group.children.find((c) => c.userData.totem);
        if (totem) group.remove(totem); // keep the label
        group.add(prepped);
      });
    }
  }

  /** Dev-hook accessor (W4.1): every landmark's id + world x/z, so the E2E can
   *  steer the ranger from spawn to the watchtower and back. */
  landmarkPositions(): { id: string; x: number; z: number }[] {
    return this.landmarks.map((l) => ({ id: l.id, x: l.x, z: l.z }));
  }

  /**
   * W4.2: nature dressing. Real GLB trees, stumps, snags, logs, boulders,
   * mushrooms, ferns, foxgloves and reeds clustered at the POIs (watchtower
   * grove, ecoduct + BOA approaches, ven shore by the bird-hide) and scattered
   * through the biome cores — layered ON TOP of the instanced-primitive filler
   * (scatterPines/Heather/Marram/Reeds), which stays the cheap background. Only
   * the solid props (trees, boulders, logs, snags, juniper, stumps) push a
   * collision circle; low ground detail (mushrooms/fern/foxglove/reeds) is
   * walk-through. Every position was pre-validated (a helper script) to sit off
   * the −z movement-smoke corridor, out of the spawn clearing, and clear of the
   * submerged ven disc — the reeds ring the water's DRY shore. Fully
   * deterministic; a procedural totem stands in until each GLB streams in.
   */
  private placeNatureDressing(): void {
    // per-model stand height (m, prepModel target) + collision radius (0 = none)
    const SPEC: Record<string, { h: number; collide: number }> = {
      'prop-pine-scots': { h: 5.5, collide: 0.7 },
      'prop-oak-tree': { h: 5.0, collide: 0.7 },
      'prop-birch-tree': { h: 5.5, collide: 0.7 },
      'prop-tree-stump': { h: 0.7, collide: 0.5 },
      'prop-fallen-log': { h: 0.7, collide: 0.7 },
      'prop-dead-snag': { h: 3.5, collide: 0.6 },
      'prop-boulder': { h: 1.1, collide: 0.9 },
      'prop-juniper-bush': { h: 1.1, collide: 0.7 },
      'prop-mushrooms': { h: 0.35, collide: 0 },
      'prop-fern': { h: 0.6, collide: 0 },
      'prop-foxglove': { h: 0.8, collide: 0 },
      'prop-reeds': { h: 1.1, collide: 0 },
    };
    // [model, x, z] — curated + validated placements per §4.
    const PLACES: [string, number, number][] = [
      // Watchtower bos grove (POI 37,-37): trees + a real forest floor
      ['prop-pine-scots', 33, -40], ['prop-oak-tree', 41, -40], ['prop-birch-tree', 34, -33],
      ['prop-tree-stump', 31, -37], ['prop-mushrooms', 46, -42], ['prop-fern', 30, -42],
      ['prop-dead-snag', 44, -42], ['prop-fallen-log', 35, -43],
      // Ecoduct approach grove (POI -70,6)
      ['prop-pine-scots', -64, 10], ['prop-birch-tree', -66, 1], ['prop-pine-scots', -73, 12], ['prop-fern', -61, 4],
      // BOA-post trees (POI -56,-20)
      ['prop-oak-tree', -51, -24], ['prop-birch-tree', -60, -15],
      // Bird-hide + ven shore reeds (POI 26,-11, basin 46,-19 dry shore)
      ['prop-fern', 23, -14], ['prop-reeds', 33, -8], ['prop-reeds', 38, -4], ['prop-reeds', 43, -2],
      ['prop-reeds', 30, -13], ['prop-reeds', 49, -2], ['prop-reeds', 56, -35],
      // Heide scatter (SW)
      ['prop-foxglove', -10, -22], ['prop-boulder', -20, -28], ['prop-foxglove', -6, -30],
      // Stuifzand junipers + boulders (NE)
      ['prop-juniper-bush', 24, 20], ['prop-boulder', 30, 26], ['prop-juniper-bush', 16, 30],
      // Signpost path dressing
      ['prop-boulder', 13, -13], ['prop-mushrooms', -19, 14],
    ];
    PLACES.forEach(([model, x, z], i) => {
      const spec = SPEC[model];
      const at = new THREE.Vector3(x, this.groundY(x, z), z);
      const group = new THREE.Group();
      group.position.copy(at);
      group.rotation.y = (i * 2.39996) % (Math.PI * 2); // golden-angle spin for variety
      group.add(this.proceduralTotem(spec.collide > 0 ? '#6b5a3a' : '#7d8a4a')); // instant stand-in
      this.scene.add(group);
      if (spec.collide > 0) this.obstacles.push({ x, z, r: spec.collide });
      this.dressing.push({ id: model, x, z });
      void loadModel(model).then((m) => {
        if (!m) return;
        const prepped = prepModel(m, spec.h);
        // W4.5: only the SOLID dressing (trees/boulders/logs/snags/juniper/stumps)
        // casts a hero shadow; low ground detail (mushrooms/fern/foxglove/reeds)
        // does not. The tight ranger-following frustum still culls to the closest.
        if (spec.collide > 0) World.enableCast(prepped);
        const totem = group.children.find((c) => c.userData.totem);
        if (totem) group.remove(totem);
        group.add(prepped);
      });
    });
  }

  /** Dev-hook accessor (W4.2): every nature-dressing prop's id + world x/z, so
   *  the E2E can assert the biomes are dressed with real GLBs. */
  dressingPositions(): { id: string; x: number; z: number }[] {
    return this.dressing.map((d) => ({ id: d.id, x: d.x, z: d.z }));
  }

  /** Dev-hook accessor (W4.3): the sand-path network — route nodes (id + world
   *  x/z) and the segment index pairs — so the E2E can assert the trails connect
   *  spawn to every POI. Static (the network is deterministic). */
  pathNetwork(): { nodes: { id: string; x: number; z: number }[]; segments: [number, number][] } {
    return {
      nodes: PATH_NODES.map((n) => ({ id: n.id, x: n.x, z: n.z })),
      segments: PATH_SEGMENTS.map(([i, j]) => [i, j] as [number, number]),
    };
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

  /**
   * W3.3: place the two story-arc humans — the warden (BOA) near the case-board
   * hub where the player reports, and the poacher as a distant, calm figure off
   * in the bos edge. Each loads via `loadRig` and plays its single baked clip
   * through a mixer (advanced in `update`, frozen under reduced-motion). Both sit
   * to the +z side of spawn so the movement smoke's forward (−z) corridor stays
   * clear; neither pushes a collision circle or joins `markers` (pure dressing).
   */
  private placeScenicActors(): void {
    const ACTORS: { id: string; x: number; z: number; height: number }[] = [
      { id: 'ranger-warden-boa', x: 6.4, z: 4.4, height: 1.7 }, // the BOA by the report board
      { id: 'figure-poacher', x: -11.5, z: 8.5, height: 1.7 },  // a distant figure in the trees
    ];
    for (const a of ACTORS) {
      const group = new THREE.Group();
      group.position.set(a.x, this.groundY(a.x, a.z), a.z);
      group.rotation.y = Math.atan2(-a.x, -a.z); // face the spawn clearing
      this.scene.add(group);
      this.addBlobShadow(group, 0.55); // W4.5: soft grounding under the figure
      const entry = { id: a.id, group, mixer: null as THREE.AnimationMixer | null, action: null as THREE.AnimationAction | null };
      this.scenicActors.push(entry);
      void loadRig(a.id).then((rig) => {
        if (!rig) return;
        const prepped = prepModel(rig.group, a.height);
        applyEyes(prepped, a.id, { dusk: false });
        applyCalmPose(prepped, a.id); // §B never-scary: bias the poacher into a calm rest shape
        group.add(prepped);
        if (rig.clips.length) {
          const mixer = new THREE.AnimationMixer(prepped);
          const clip = rig.clips.find((c) => /idle|rest|stand|breath/i.test(c.name)) ?? rig.clips[0];
          const action = mixer.clipAction(clip).play();
          entry.mixer = mixer;
          entry.action = action;
        }
      });
    }
  }

  /** Dev-hook accessor (W3.3): each scenic actor's id + its live baked-clip
   *  {name, time} (null until the rig loads / when it carries no clip). Lets the
   *  E2E assert the warden + poacher are present AND their mixers actually run. */
  actorClips(): { id: string; clip: { name: string; time: number } | null }[] {
    return this.scenicActors.map((a) => ({
      id: a.id,
      clip: a.action ? { name: a.action.getClip().name, time: a.action.time } : null,
    }));
  }

  /**
   * W3.6: place the ambient wildlife. Four animals roam gentle wander loops in
   * the biomes (the W3.5-staged ree + vos crossfade their baked walk↔graze clips;
   * the eekhoorn + wild zwijn — no honest CC0 match — get the improved procedural
   * bob PLUS the roam/turn/graze the wander loop provides), and two birds glide
   * overhead on spline orbits. None are markers, none push collision — pure life.
   * Homes sit well clear of the spawn corridor (the −z movement-smoke lane) and
   * the submerged ven (46,-19), so nothing wanders into water or across the demo.
   */
  private placeAmbientLife(): void {
    // ground roamers: [id, home x/z, loop radius, whether the GLB carries baked
    // walk/graze clips]. Target height now comes from the canonical dossier
    // stand-height table (W3.7a, `AnimalScale.ts`) — one source of truth so the
    // world and the showroom true-scale mode read the SAME relative sizes.
    const GROUND: { id: string; hx: number; hz: number; r: number; baked: boolean }[] = [
      { id: 'animal-ree-roedeer', hx: 26, hz: 26, r: 6, baked: true },   // bos/heide edge
      { id: 'animal-vos-fox', hx: -30, hz: -10, r: 7, baked: true },     // heide, west
      { id: 'animal-eekhoorn-squirrel', hx: -24, hz: -24, r: 3, baked: false }, // near trees
      { id: 'animal-wildzwijn-boar', hx: 10, hz: 36, r: 6, baked: false },     // heide, south
    ];
    GROUND.forEach((a, i) => {
      const h = standHeightFor(a.id) ?? 0.9; // dossier canonical (W3.7a)
      const wander: WanderConfig = {
        homeX: a.hx, homeZ: a.hz, radius: a.r,
        period: 22 + i * 4,          // each roams at a slightly different pace
        phase: (i * 0.27) % 1,       // desync the loops
        angle: i * 1.1,              // rotate each loop differently
      };
      const group = new THREE.Group();
      group.position.set(a.hx, this.groundY(a.hx, a.hz), a.hz);
      this.scene.add(group);
      this.addBlobShadow(group, Math.max(0.35, h * 0.7)); // W4.5: blob under each roamer
      const entry = {
        id: a.id, group, phase: i * 1.7,
        wander, glide: null as GlideConfig | null, faceOffset: 0,
        recipe: gaitFor(a.id),
        anim: null as THREE.Group | null, mixer: null as THREE.AnimationMixer | null,
        walk: null as THREE.AnimationAction | null, graze: null as THREE.AnimationAction | null,
        walkW: 0, grazeW: 1, h,
      };
      this.ambient.push(entry);
      void loadRig(a.id).then((rig) => {
        if (!rig) return;
        const prepped = prepModel(rig.group, h);
        applyEyes(prepped, a.id, { dusk: false });
        applyCoat(prepped, a.id);     // W3.7b: dossier coat-tint correction (vos rufous)
        applyPosture(prepped, a.id);  // W3.7b: head-low stance for snuffling species
        applyCalmPose(prepped, a.id); // §B never-scary rest-pose bias
        group.add(prepped);
        if (a.baked && rig.clips.length) {
          // crossfade the baked walk (striding) against graze (paused) by `moving`;
          // both play from frame one, weights eased each frame in update().
          const mixer = new THREE.AnimationMixer(prepped);
          const walkClip = rig.clips.find((c) => /walk/i.test(c.name)) ?? rig.clips[0];
          const grazeClip = rig.clips.find((c) => /graze|eat|idle|rest/i.test(c.name)) ?? rig.clips[0];
          entry.walk = mixer.clipAction(walkClip); entry.walk.play(); entry.walk.setEffectiveWeight(0);
          entry.graze = mixer.clipAction(grazeClip); entry.graze.play(); entry.graze.setEffectiveWeight(1);
          entry.mixer = mixer;
        } else {
          // no baked clips → the improved procedural bob drives this wrapper (the
          // wander loop already supplies roam / turn-in-place / pause-and-graze).
          entry.anim = prepped;
        }
      });
    });

    // two birds gliding overhead on slow spline orbits (the buizerd soars wide,
    // the houtduif circles lower + tighter). Birds are static GLBs → the glide IS
    // the motion; they hold the calm-pose gate (no diving, no flapping panic).
    const BIRDS: { id: string; h: number; cx: number; cz: number; r: number; height: number; period: number; phase: number; bob: number }[] = [
      { id: 'bird-buizerd', h: 0.9, cx: 4, cz: 0, r: 44, height: 24, period: 30, phase: 0, bob: 1.6 },
      { id: 'bird-houtduif', h: 0.5, cx: -18, cz: 8, r: 26, height: 16, period: 22, phase: 0.5, bob: 1.1 },
    ];
    BIRDS.forEach((b, i) => {
      const glide: GlideConfig = { cx: b.cx, cz: b.cz, radius: b.r, height: b.height, bob: b.bob, period: b.period, phase: b.phase };
      const group = new THREE.Group();
      const g0 = glideAt(glide, 0);
      group.position.set(g0.x, g0.y, g0.z);
      this.scene.add(group);
      const entry = {
        id: b.id, group, phase: i * 2.1,
        wander: null as WanderConfig | null, glide, faceOffset: 0,
        recipe: gaitFor(b.id),
        anim: null as THREE.Group | null, mixer: null as THREE.AnimationMixer | null,
        walk: null as THREE.AnimationAction | null, graze: null as THREE.AnimationAction | null,
        walkW: 0, grazeW: 0, h: b.h,
      };
      this.ambient.push(entry);
      void loadModel(b.id).then((m) => {
        if (!m) return;
        const prepped = prepModel(m, b.h);
        applyCalmPose(prepped, b.id);
        group.add(prepped);
      });
    });
  }

  /** Dev-hook accessor (W3.6): each ambient creature's id + live world x/z + its
   *  dominant baked clip {name, time} (null for the procedural + bird cast). Lets
   *  the E2E assert ≥2 animals are present AND a baked mixer clock advances. */
  ambientState(): { id: string; x: number; z: number; h: number; clip: { name: string; time: number } | null }[] {
    return this.ambient.map((a) => {
      const dom = a.mixer ? (a.walkW >= a.grazeW ? a.walk : a.graze) : null;
      return {
        id: a.id, x: a.group.position.x, z: a.group.position.z,
        h: a.h, // applied canonical stand height (W3.7a) — E2E asserts the live ordering
        clip: dom ? { name: dom.getClip().name, time: dom.time } : null,
      };
    });
  }

  /**
   * W5.1: place the drivable jeep at a sand-track head in the stuifzand sector
   * (§4, NE), parked facing the clearing. It pushes a solid collision circle
   * while parked (the ranger walks up to it), kept OUT of `markers`. The spot is
   * off the frozen −z movement-smoke corridor and clear of the spawn clearing.
   */
  private placeJeep(): void {
    const x = 16, z = 14, height = 1.9; // stuifzand NE; ~21 m from spawn, +z off the smoke corridor
    const group = new THREE.Group();
    group.position.set(x, this.groundY(x, z), z);
    this.jeepHeading = Math.atan2(-x, -z); // parked facing the clearing (like the landmarks)
    group.rotation.y = this.jeepHeading;
    group.add(this.proceduralTotem('#6a7b4a')); // instant stand-in until the GLB streams in
    this.scene.add(group);
    this.jeepObstacle = { x, z, r: JEEP_COLLIDE };
    this.obstacles.push(this.jeepObstacle);
    this.jeep = group;
    this.jeepPos = group.position;
    void loadModel('vehicle-ranger-jeep').then((m) => {
      if (!m) return;
      const prepped = prepModel(m, height);
      World.enableCast(prepped); // W4.5: a solid hero prop near the player casts a shadow
      const totem = group.children.find((c) => c.userData.totem);
      if (totem) group.remove(totem);
      group.add(prepped);
    });
    this.initDust(); // W5.2: the jeep's dust cloud (hidden until it drives)
  }

  /**
   * W5.3b: place the two helipads (§4 — one on the stuifzand apron by the sand
   * track, one by the BOA-post on the western rim) as flat walk-through discs, and
   * park the helicopter on the stuifzand pad. The pads never push a collision
   * circle (you land ON them); the parked aircraft does (the ranger walks up to
   * it). Its PRESENCE is unconditional — the opt-in + reduced-motion gate governs
   * only whether it can be ENTERED (`enterHeli`/`heliAvailable`).
   */
  private placeHelipads(): void {
    const PADS = [
      { x: 24, z: 22 },    // stuifzand NE apron — the aviation area, heli parked here
      { x: -46, z: -22 },  // by the BOA-post on the western rim
    ];
    for (const p of PADS) {
      const disc = World.makeHelipad();
      disc.position.set(p.x, this.groundY(p.x, p.z) + 0.02, p.z);
      this.scene.add(disc);
      this.helipads.push({ x: p.x, z: p.z });
    }
    const pad = PADS[0];
    const group = new THREE.Group();
    group.position.set(pad.x, this.groundY(pad.x, pad.z), pad.z);
    this.heliHeading = Math.atan2(-pad.x, -pad.z); // parked facing the clearing
    group.rotation.y = this.heliHeading;
    group.add(this.proceduralTotem('#8a8f98')); // instant stand-in until the GLB streams in
    this.scene.add(group);
    this.heliObstacle = { x: pad.x, z: pad.z, r: HELI_COLLIDE };
    this.obstacles.push(this.heliObstacle);
    this.heli = group;
    this.heliPos = group.position;
    this.heliAltitude = HELI_PAD_HEIGHT;
    void loadModel('vehicle-helicopter').then((m) => {
      if (!m) return;
      const prepped = prepModel(m, 2.6);
      World.enableCast(prepped);
      const totem = group.children.find((c) => c.userData.totem);
      if (totem) group.remove(totem);
      group.add(prepped);
    });
  }

  /** W5.3b: a flat helipad disc (1 draw call) — dark asphalt circle laid on the
   *  ground, the visual landing target. Walk-through (no collision). */
  private static makeHelipad(): THREE.Mesh {
    const geo = new THREE.CircleGeometry(3.2, 24);
    const mat = new THREE.MeshStandardMaterial({ color: '#454b52', roughness: 1, metalness: 0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2; // lay the XY disc flat, normal up
    mesh.receiveShadow = true;
    return mesh;
  }

  /**
   * W5.3b: advance the helicopter one frame. The SAME `screenVector` becomes
   * throttle (y) + steer (x); the pure `flyStep` core (core/heli.ts) turns them
   * into a rate-clamped heading + horizontal delta AND an exp-damped ≤ 2 m/s
   * vertical ease toward the target altitude (cruise while flying, 0 while
   * landing). Horizontal motion resolves through the SAME `resolveMove` — but
   * ABOVE the treetops (`HELI_AIRBORNE_Y`) it ignores ground obstacles (only the
   * world rim bounds it), so it never snags on a pine at altitude. The horizon is
   * a hard level (roll 0); the ranger rides hidden at the aircraft's spot so the
   * follow-cam + step-out anchor track it. The motion vignette fades in with
   * translation and is OFF at hover.
   */
  private flyHeli(dt: number): void {
    if (!this.heli || !this.heliPos) return;
    const stick = this.joystickSource ? this.joystickSource() : null;
    const intent = this.input ? screenVector(this.input.held, stick) : { x: 0, y: 0 };
    const targetAlt = this.heliLanding ? HELI_PAD_HEIGHT : HELI_CRUISE_HEIGHT;
    const step = flyStep(
      { heading: this.heliHeading, altitude: this.heliAltitude },
      { throttle: intent.y, steer: intent.x },
      targetAlt, dt, HELI_CAPS,
    );
    this.heliHeading = step.heading;
    const hp = this.heliPos;
    const obs = this.heliAltitude > HELI_AIRBORNE_Y ? [] : this.obstacles; // over the treetops → free
    const next = resolveMove(hp.x, hp.z, hp.x + step.dx, hp.z + step.dz, obs, this.limits);
    hp.x = next.x; hp.z = next.z;
    this.heliAltitude = step.altitude;
    hp.y = this.groundY(next.x, next.z) + this.heliAltitude; // fly ABOVE the ground
    this.heli.rotation.set(0, this.heliHeading, HELI_ROLL);  // yaw only; horizon level (roll 0)
    this.heliSpeed = step.speed;
    this.heliClimbRate = step.climbRate;
    this.ranger.position.set(hp.x, hp.y, hp.z);
    this.ranger.rotation.y = this.heliHeading;
    this.followTargetYaw = this.heliHeading;
    this.heliVignetteVal = heliVignette(step.speed, step.climbRate);
    this.onHeliFrame(this.heliVignetteVal);
    // touchdown: the landing descent has reached the pad → step out
    if (this.heliLanding && this.heliAltitude <= HELI_PAD_HEIGHT + 0.2) {
      this.exitHeli();
      return;
    }
    // ambience still follows across biomes while flying
    const here = biomeAt(hp.x, hp.z);
    if (here !== this.lastBiome) { this.lastBiome = here; this.onBiome(here); }
  }

  /**
   * W5.1: advance the jeep one frame in arcade-kinematic drive mode. The SAME
   * `screenVector` the walker reads becomes throttle (y) + steer (x); the pure
   * `driveStep` core turns them into a heading + move delta (rate-clamped, caps
   * halved under reduced-motion), which the SAME `resolveMove` resolves for
   * collision/rim/water. The jeep sticks to the terrain and the ranger rides
   * hidden at its spot so the follow-cam + step-out anchor track it.
   */
  private driveJeep(dt: number): void {
    if (!this.jeep || !this.jeepPos) return;
    const reduced = livePolicy().reduced;
    const stick = this.joystickSource ? this.joystickSource() : null;
    const intent = this.input ? screenVector(this.input.held, stick) : { x: 0, y: 0 };
    const caps = driveCaps(reduced);
    const step = driveStep(this.jeepHeading, { throttle: intent.y, steer: intent.x }, dt, caps);
    this.jeepHeading = step.heading;
    const jp = this.jeepPos;
    // W5.2 calm rule: auto-slow to a crawl within reach of any wandering animal so
    // it never panic-flees. The pure `calmSpeed` caps the signed speed; scaling the
    // move delta by the same factor keeps the heading + terrain stick intact.
    const animalDist = this.nearestAnimalDist(jp.x, jp.z);
    this.vehicleNearAnimal = animalDist <= ANIMAL_SLOW_RADIUS;
    const capped = calmSpeed(step.speed, animalDist);
    const k = step.speed !== 0 ? capped / step.speed : 1;
    this.vehicleSpeed = capped;
    const next = resolveMove(jp.x, jp.z, jp.x + step.dx * k, jp.z + step.dz * k, this.obstacles, this.limits);
    jp.x = next.x; jp.z = next.z;
    jp.y = this.groundY(next.x, next.z);       // terrain stick
    this.jeep.rotation.y = this.jeepHeading;
    // the ranger rides along (hidden) so placeCamera + exitVehicle anchor track it
    this.ranger.position.set(jp.x, jp.y, jp.z);
    this.ranger.rotation.y = this.jeepHeading;
    this.followTargetYaw = this.jeepHeading;
    // W5.2: rev the engine loop by drive fraction (gated on the sound setting) and
    // kick up dust behind the jeep when it is moving with any pace — off under
    // reduced-motion (dust is secondary motion; the engine hum stays, it is audio).
    if (store.get().settings.geluid) Sound.engineSet(Math.abs(capped) / caps.maxSpeed);
    this.dustEmitting = !reduced && Math.abs(capped) > 1.2;
    if (this.dustEmitting) this.emitDust(jp.x, jp.y, jp.z, this.jeepHeading);
    // ambience still follows across biomes while driving
    const here = biomeAt(jp.x, jp.z);
    if (here !== this.lastBiome) { this.lastBiome = here; this.onBiome(here); }
  }

  /** W5.2: distance to the nearest wandering ground animal from a world point
   *  (birds glide overhead → excluded). `Infinity` when none roam. */
  private nearestAnimalDist(x: number, z: number): number {
    let best = Infinity;
    for (const a of this.ambient) {
      if (!a.wander) continue;
      const d = Math.hypot(a.group.position.x - x, a.group.position.z - z);
      if (d < best) best = d;
    }
    return best;
  }

  /** W5.2: build the single dust Points cloud (1 draw call, hidden while idle). A
   *  small fixed pool of particles is recycled round-robin; per-particle age/life
   *  attributes drive a shader-side fade so one buffer covers every puff. */
  private initDust(): void {
    const N = World.DUST_N;
    this.dustPos = new Float32Array(N * 3);
    this.dustVel = new Float32Array(N * 3);
    this.dustAge = new Float32Array(N);
    this.dustLife = new Float32Array(N); // all 0 → every slot starts dead
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.dustPos, 3));
    geo.setAttribute('aAge', new THREE.BufferAttribute(this.dustAge, 1));
    geo.setAttribute('aLife', new THREE.BufferAttribute(this.dustLife, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color('#d8c49a') } }, // warm sandy haze
      transparent: true,
      depthWrite: false,
      vertexShader: `
        attribute float aAge;
        attribute float aLife;
        varying float vAlpha;
        void main() {
          float lifeSafe = max(aLife, 0.0001);
          float f = clamp(aAge / lifeSafe, 0.0, 1.0);
          float alive = step(0.0001, aLife);
          float within = 1.0 - step(aLife, aAge);
          vAlpha = (1.0 - f) * alive * within;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float sz = mix(7.0, 30.0, f);       // puffs expand as they rise + thin out
          gl_PointSize = sz * (260.0 / max(-mv.z, 1.0));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        precision mediump float;
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          vec2 d = gl_PointCoord - vec2(0.5);
          float soft = smoothstep(0.5, 0.12, length(d));
          float a = soft * vAlpha * 0.45;      // deliberately faint — a light haze
          if (a <= 0.002) discard;
          gl_FragColor = vec4(uColor, a);
        }
      `,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false; // particles live in world space, not around the origin
    pts.visible = false;
    this.scene.add(pts);
    this.dust = pts;
  }

  /** A deterministic 0..1 (LCG) for dust scatter — no `Math.random`, stable frames. */
  private dustRand(): number {
    this.dustSeed = (this.dustSeed * 1103515245 + 12345) & 0x7fffffff;
    return this.dustSeed / 0x7fffffff;
  }

  /** W5.2: kick two dust puffs off the jeep's rear wheels. Rear = −forward; the
   *  left-of-forward vector (cos h, −sin h) scatters them across the track. */
  private emitDust(x: number, y: number, z: number, heading: number): void {
    if (!this.dustPos || !this.dustVel || !this.dustAge || !this.dustLife) return;
    const fx = Math.sin(heading), fz = Math.cos(heading); // forward
    const lx = fz, lz = -fx;                              // left-of-forward
    for (let s = 0; s < 2; s++) {
      const i = this.dustNext;
      this.dustNext = (this.dustNext + 1) % World.DUST_N;
      const lat = (this.dustRand() - 0.5) * 1.1;
      const back = 1.3 + this.dustRand() * 0.5;
      this.dustPos[i * 3] = x - fx * back + lx * lat;
      this.dustPos[i * 3 + 1] = y + 0.12;
      this.dustPos[i * 3 + 2] = z - fz * back + lz * lat;
      this.dustVel[i * 3] = lx * lat * 0.3 - fx * 0.2;
      this.dustVel[i * 3 + 1] = 0.5 + this.dustRand() * 0.4; // rise
      this.dustVel[i * 3 + 2] = lz * lat * 0.3 - fz * 0.2;
      this.dustAge[i] = 0;
      this.dustLife[i] = 0.7 + this.dustRand() * 0.4;
    }
  }

  /** W5.2: age every live dust particle, drift it up + settle, and hide the whole
   *  cloud once none survive (so an idle jeep costs no draw call). */
  private updateDust(dt: number): void {
    if (!this.dust || !this.dustPos || !this.dustVel || !this.dustAge || !this.dustLife) return;
    let anyAlive = false;
    for (let i = 0; i < World.DUST_N; i++) {
      if (this.dustLife[i] <= 0) continue;
      const age = this.dustAge[i] + dt;
      if (age >= this.dustLife[i]) { this.dustLife[i] = 0; this.dustAge[i] = age; continue; }
      this.dustAge[i] = age;
      this.dustPos[i * 3] += this.dustVel[i * 3] * dt;
      this.dustPos[i * 3 + 1] += this.dustVel[i * 3 + 1] * dt;
      this.dustPos[i * 3 + 2] += this.dustVel[i * 3 + 2] * dt;
      this.dustVel[i * 3 + 1] *= (1 - Math.min(dt * 1.2, 1)); // the rise eases off
      anyAlive = true;
    }
    const g = this.dust.geometry;
    (g.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (g.getAttribute('aAge') as THREE.BufferAttribute).needsUpdate = true;
    (g.getAttribute('aLife') as THREE.BufferAttribute).needsUpdate = true;
    this.dust.visible = anyAlive;
  }

  /** Procedural stand-in for the ranger-cabin (instant, before the GLB loads). */
  private proceduralCabin(): THREE.Group {
    const g = new THREE.Group();
    g.userData.totem = true;
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.8, 2.0),
      new THREE.MeshStandardMaterial({ color: '#7a5a3a', roughness: 1 }),
    );
    wall.position.y = 0.9;
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(1.9, 1.0, 4),
      new THREE.MeshStandardMaterial({ color: '#5b4327', roughness: 1 }),
    );
    roof.position.y = 2.3; roof.rotation.y = Math.PI / 4;
    g.add(wall, roof);
    return g;
  }

  /** Procedural stand-in for the case-board (two posts + a cork panel). */
  private proceduralBoard(): THREE.Group {
    const g = new THREE.Group();
    g.userData.totem = true;
    const postMat = new THREE.MeshStandardMaterial({ color: '#6b513a', roughness: 1 });
    const post1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 6), postMat);
    post1.position.set(-0.5, 0.7, 0);
    const post2 = post1.clone(); post2.position.x = 0.5;
    const cork = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.9, 0.08),
      new THREE.MeshStandardMaterial({ color: '#c8a36a', roughness: 1 }),
    );
    cork.position.set(0, 1.3, 0);
    g.add(post1, post2, cork);
    return g;
  }

  /** Re-point the wayfinding cue at another mission (e.g. after one is completed). */
  setActiveMission(id: string | null): void {
    this.activeId = id;
    this.lastWayKey = '';
  }

  /** The live `richting` phrase (relative to facing) toward a mission marker, for
   *  the world-EF "welke kant?" recall beat — `null` if the marker is unknown.
   *  Synchronous so the beat can score against the true bearing at fire time. */
  headingTo(id: string | null): string | null {
    if (!id) return null;
    const goal = this.markers.find((m) => m.missionId === id);
    if (!goal) return null;
    const rp = this.ranger.position;
    return wayfind(rp.x, rp.z, this.ranger.rotation.y, goal.pos.x, goal.pos.z).richting;
  }

  private proceduralTotem(color: string): THREE.Group {
    const g = new THREE.Group();
    g.userData.totem = true;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1, 6), new THREE.MeshStandardMaterial({ color: '#6b513a', roughness: 1 }));
    post.position.y = 0.5;
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), new THREE.MeshStandardMaterial({ color, roughness: 0.6, emissive: new THREE.Color(color), emissiveIntensity: 0.25 }));
    orb.position.y = 1.2;
    g.add(post, orb);
    return g;
  }

  // ---- input ----
  private onPointer = (e: PointerEvent): void => {
    if (this.activityActive || this.inVehicle || this.inHeli) return; // in-place pick / drive / flight own input
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);

    // 1) a tapped marker → walk over to it (proximity then offers "Speel mee")
    for (const mk of this.markers) {
      const hit = this.raycaster.intersectObject(mk.group, true);
      if (hit.length) {
        const dir = new THREE.Vector3(mk.pos.x, 0, mk.pos.z).sub(new THREE.Vector3(this.ranger.position.x, 0, this.ranger.position.z));
        if (dir.lengthSq() > 0.001) dir.normalize();
        this.target.set(mk.pos.x - dir.x * 1.6, 0, mk.pos.z - dir.z * 1.6); // stop just in front
        return;
      }
    }
    // 1b) a tapped case-board hub → walk up to it (proximity then opens the board)
    if (this.boardGroup && this.boardPos) {
      const hit = this.raycaster.intersectObject(this.boardGroup, true);
      if (hit.length) {
        const dir = new THREE.Vector3(this.boardPos.x, 0, this.boardPos.z).sub(
          new THREE.Vector3(this.ranger.position.x, 0, this.ranger.position.z),
        );
        if (dir.lengthSq() > 0.001) dir.normalize();
        this.target.set(this.boardPos.x - dir.x * 1.6, 0, this.boardPos.z - dir.z * 1.6);
        return;
      }
    }
    // 1b') a tapped sit-spot bench → walk up to it (proximity then offers the roep slice)
    if (this.sitSpotGroup && this.sitSpotPos) {
      const hit = this.raycaster.intersectObject(this.sitSpotGroup, true);
      if (hit.length) {
        const dir = new THREE.Vector3(this.sitSpotPos.x, 0, this.sitSpotPos.z).sub(
          new THREE.Vector3(this.ranger.position.x, 0, this.ranger.position.z),
        );
        if (dir.lengthSq() > 0.001) dir.normalize();
        this.target.set(this.sitSpotPos.x - dir.x * 1.4, 0, this.sitSpotPos.z - dir.z * 1.4);
        return;
      }
    }
    // 1c) a tapped parked jeep → walk up to it (proximity then offers "Stap in")
    if (this.jeep && this.jeepPos) {
      const hit = this.raycaster.intersectObject(this.jeep, true);
      if (hit.length) {
        const dir = new THREE.Vector3(this.jeepPos.x, 0, this.jeepPos.z).sub(
          new THREE.Vector3(this.ranger.position.x, 0, this.ranger.position.z),
        );
        if (dir.lengthSq() > 0.001) dir.normalize();
        this.target.set(this.jeepPos.x - dir.x * 2.2, 0, this.jeepPos.z - dir.z * 2.2); // stop beside it
        return;
      }
    }
    // 1d) a tapped parked helicopter → walk up to it (proximity then offers "Stap in")
    if (this.heli && this.heliPos) {
      const hit = this.raycaster.intersectObject(this.heli, true);
      if (hit.length) {
        const dir = new THREE.Vector3(this.heliPos.x, 0, this.heliPos.z).sub(
          new THREE.Vector3(this.ranger.position.x, 0, this.ranger.position.z),
        );
        if (dir.lengthSq() > 0.001) dir.normalize();
        this.target.set(this.heliPos.x - dir.x * 2.4, 0, this.heliPos.z - dir.z * 2.4); // stop beside it
        return;
      }
    }
    // 2) otherwise walk to the tapped ground point
    const g = this.raycaster.intersectObject(this.ground, false);
    if (g.length) {
      const p = g[0].point;
      this.target.set(p.x, 0, p.z);
    }
  };

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
    // W4.5: the hero shadow camera follows the ranger — the tight ortho frustum
    // tracks him via a FIXED offset so the light DIRECTION never changes (static
    // golden-hour sun), only the covered set (the closest props) moves with him.
    if (this.sun) {
      const o = this.sunOffset;
      this.sun.position.set(rp.x + o.x, o.y, rp.z + o.z);
      this.sun.target.position.set(rp.x, 0, rp.z);
      this.sun.target.updateMatrixWorld();
    }
    this.playerSpeed = 0; // 0 while standing or during an in-place activity → mixer eases to idle
    this.dustEmitting = false; // driveJeep re-arms it while the jeep is moving (W5.2)
    if (!this.activityActive && this.inHeli) {
      // W5.3b: damped flight mode owns movement while the ranger is in the heli.
      this.flyHeli(dt);
    } else if (!this.activityActive && this.inVehicle) {
      // W5.1: arcade drive mode owns movement while the ranger is in the jeep.
      this.driveJeep(dt);
    } else if (!this.activityActive) {
      // W1.2 velocity branch: while a movement key is held (camera-relative via
      // resolveInput), it OVERRIDES tap-to-walk — the desired step is the input
      // vector · speed · dt, resolved by the same kinematic controller. When no
      // key is held we fall back to seeking the tapped target. Either way the
      // ACTUAL post-collision delta drives facing (slide-around-pine still turns).
      const stick = this.joystickSource ? this.joystickSource() : null;
      const move = this.input ? resolveInput(this.input.held, stick, this.cameraYaw()) : { x: 0, z: 0 };
      let wantX: number, wantZ: number, moving: boolean;
      let moved = 0; // post-collision ground distance this frame (drives footsteps)
      if (move.x !== 0 || move.z !== 0) {
        const step = this.speed * dt;
        wantX = rp.x + move.x * step;
        wantZ = rp.z + move.z * step;
        this.target.set(rp.x, 0, rp.z); // drop any stale walk target so it can't resume on key-release
        moving = true;
      } else {
        const dx = this.target.x - rp.x, dz = this.target.z - rp.z;
        const dist = Math.hypot(dx, dz);
        moving = dist > 0.06;
        const step = moving ? Math.min(this.speed * dt, dist) : 0;
        wantX = rp.x + (moving ? (dx / dist) * step : 0);
        wantZ = rp.z + (moving ? (dz / dist) * step : 0);
      }
      if (moving) {
        const next = resolveMove(rp.x, rp.z, wantX, wantZ, this.obstacles, this.limits);
        const mx = next.x - rp.x, mz = next.z - rp.z;
        if (mx * mx + mz * mz > 1e-7) {
          this.ranger.rotation.y = Math.atan2(mx, mz);
          // W1.5: the follow-cam chases the ranger's facing ONLY while he moves,
          // so a standing ranger (or a mini-game reframe) never swings the view.
          this.followTargetYaw = this.ranger.rotation.y;
        }
        // W3.2: the actual post-collision ground speed drives the idle↔walk
        // crossfade (slide-around-pine slows him, so the gait reads honestly).
        moved = Math.hypot(mx, mz);
        this.playerSpeed = moved / Math.max(dt, 1e-4);
        rp.x = next.x;
        rp.z = next.z;
      }
      rp.y = this.groundY(rp.x, rp.z);

      // ambience follows the ranger across biomes — re-pick the bed on a crossing
      const here = biomeAt(rp.x, rp.z);
      if (here !== this.lastBiome) { this.lastBiome = here; this.onBiome(here); }

      // W4.7b: surface-aware footsteps. The distance-carry cadence advances every
      // frame (so a stop re-arms cleanly); when a stride is crossed we plant a
      // foot with the timbre of the biome underfoot — gated on the sound setting.
      const fs = stepFrame(this.footAccum, this.playerSpeed, moved);
      this.footAccum = fs.accum;
      if (fs.steps > 0 && store.get().settings.geluid) {
        this.footstepCount += fs.steps;
        this.lastFootSurface = footSurface(here);
        Sound.footstep(this.lastFootSurface);
      }
    }

    // per-animal motion: a real baked rig wins (mixer); else the always-on
    // procedural fallback (gentle, never-scary, calm-pose gated). Both are
    // secondary motion, so reduced-motion freezes them at the rest pose.
    for (const mk of this.markers) {
      if (mk.mixer) {
        mk.mixer.update(reduced ? 0 : dt);
      } else if (mk.anim) {
        const d = reduced ? REST : motionAt(mk.recipe, t, mk.phase);
        mk.anim.position.set(d.dx, d.dy, 0);
        mk.anim.rotation.set(0, d.rotY, d.rotZ);
        mk.anim.scale.set(1, d.scaleY, 1);
      }
    }

    // W3.3: the warden + poacher play their baked clips. Secondary motion, so the
    // clip freezes at the rest pose under reduced-motion (same rule as the animals).
    for (const a of this.scenicActors) a.mixer?.update(reduced ? 0 : dt);

    // W3.6: ambient wildlife. Ground animals roam a gentle wander loop (baked
    // walk↔graze crossfade for the W3.5 cast, procedural bob elsewhere); birds
    // glide overhead. All SECONDARY motion → frozen at home/rest under reduced-
    // motion (the loop halts, the mixer holds its pose — locomotion-exempt rule
    // applies only to the PLAYER, §3.4).
    for (const a of this.ambient) {
      if (a.wander) {
        if (reduced) { a.mixer?.update(0); continue; }
        const st = wanderAt(a.wander, t);
        a.group.position.set(st.x, this.groundY(st.x, st.z), st.z);
        a.group.rotation.y = st.facing + a.faceOffset;
        if (a.mixer) {
          const k = dampFactor(dt, 0.25); // ease the walk↔graze crossfade (shared factor)
          a.walkW += ((st.moving ? 1 : 0) - a.walkW) * k;
          a.grazeW += ((st.moving ? 0 : 1) - a.grazeW) * k;
          a.walk?.setEffectiveWeight(a.walkW);
          a.graze?.setEffectiveWeight(a.grazeW);
          a.mixer.update(dt);
        } else if (a.anim) {
          const d = motionAt(a.recipe, t, a.phase);
          a.anim.position.set(d.dx, d.dy, 0);
          a.anim.rotation.set(0, d.rotY, d.rotZ);
          a.anim.scale.set(1, d.scaleY, 1);
        }
      } else if (a.glide && !reduced) {
        const st = glideAt(a.glide, t);
        a.group.position.set(st.x, st.y, st.z);
        a.group.rotation.y = st.facing + a.faceOffset;
      }
    }

    // W3.2: the ranger's own locomotion animation. Locomotion is reduced-motion
    // EXEMPT (§3.4) so the mixer always advances with real dt — a walking ranger
    // animates in both motion modes; only the procedural-bob fallback holds still.
    this.playerRig.update(dt, this.playerSpeed, reduced);

    // W7.2: measure fps and step the quality tier down/up with hysteresis.
    this.probeQuality(dt);

    // W5.2: age the jeep's dust cloud every frame (so puffs keep fading after a
    // stop or step-out). Emission itself happens in driveJeep, gated on motion +
    // reduced-motion; this only advances what is already alive.
    this.updateDust(dt);

    // W4.6 "Lucht + adem": drifting cloud shadows + grass wind wave + bird flyover.
    // All SECONDARY motion → the atmosphere clock advances ONLY when reduced-motion
    // is off, so a frozen clock stills every effect together (comfort §C). Runs
    // every frame (even during an in-place activity) so the sky keeps breathing.
    if (!reduced) this.skyTime += dt;
    const st = this.skyTime;
    if (this.cloudLayer) {
      const off = cloudOffset(st);
      const map = (this.cloudLayer.material as THREE.MeshBasicMaterial).map;
      if (map) map.offset.set(off.x, off.y);
    }
    this.applyWind(st);
    if (this.flyBird) {
      const f = flyoverAt(st);
      this.lastFlyover = f;
      this.flyBird.visible = f.visible;
      this.flyBird.position.set(f.x, f.y, f.z);
      this.flyBird.rotation.y = f.facing;
    }

    // W4.8 ven-water: share the ambient clock (`skyTime` froze above under
    // reduced-motion) and gate the ripple amplitude to 0 when reduced → the disc
    // holds waveless-still (fresnel tint stays; only the shimmer stops).
    if (this.waterMat) {
      this.waterMat.uniforms.uTime.value = st;
      this.waterMat.uniforms.uAmp.value = rippleAmp(reduced);
    }

    if (this.activityActive) return; // the activity owns proximity/wayfinding/camera

    // W5.1 jeep proximity — surface "Stap in" while walking near the parked jeep.
    // Suppressed while driving (the HUD then shows "Stap uit" via onVehicleChange).
    if (this.jeep && this.jeepPos && !this.inVehicle && !this.inHeli) {
      const nj = Math.hypot(this.jeepPos.x - rp.x, this.jeepPos.z - rp.z) < JEEP_NEAR_R;
      if (nj !== this.nearJeep) { this.nearJeep = nj; this.onJeepNear(nj); }
    }

    // W5.3b helicopter proximity — surface "Stap in de helikopter" while walking
    // near the parked heli. Suppressed while flying (rp is the aircraft's spot).
    if (this.heli && this.heliPos && !this.inHeli && !this.inVehicle) {
      const nh = Math.hypot(this.heliPos.x - rp.x, this.heliPos.z - rp.z) < HELI_NEAR_R;
      if (nh !== this.nearHeli) { this.nearHeli = nh; this.onHeliNear(nh); }
    }

    // proximity → surface the "play" affordance (debounced by id). Marker + hub
    // proximity are suppressed while driving/flying so no stale prompt sits behind
    // the vehicle pill (rp is the vehicle's spot while the ranger rides hidden).
    if (!this.inVehicle && !this.inHeli) {
      let near: string | null = null;
      for (const mk of this.markers) {
        if (Math.hypot(mk.pos.x - rp.x, mk.pos.z - rp.z) < 2.4) { near = mk.missionId; break; }
      }
      if (near !== this.nearId) { this.nearId = near; this.onApproach(near); }

      // case-board hub proximity (W2.2) — surface / hide the "open the mission board"
      // affordance. Its own flag so a mission marker and the board never fight.
      if (this.boardPos) {
        const nb = Math.hypot(this.boardPos.x - rp.x, this.boardPos.z - rp.z) < 2.4;
        if (nb !== this.nearBoard) { this.nearBoard = nb; this.onBoardNear(nb); }
      }

      // sit-spot proximity (W6.4b2) — surface / hide the "Luister naar de vogels"
      // affordance. Its own flag so it never fights a mission marker or the board.
      if (this.sitSpotPos) {
        const ns = Math.hypot(this.sitSpotPos.x - rp.x, this.sitSpotPos.z - rp.z) < 2.4;
        if (ns !== this.nearSitSpot) { this.nearSitSpot = ns; this.onSitSpotNear(ns); }
      }
    }

    // wayfinding cue to the active mission — calm direction + distance, no minimap.
    // Debounced so the diegetic HUD only re-renders when the words actually change.
    const goal = this.activeId ? this.markers.find((m) => m.missionId === this.activeId) : null;
    if (goal) {
      // W4.3: the cue FOLLOWS the sand paths — the ARROW aims at the next path
      // waypoint (routeVia), while the distance + "je bent er" stay measured to
      // the real marker, so the child walks the trail then peels off at the end.
      const wp = routeVia(rp.x, rp.z, goal.pos.x, goal.pos.z);
      const angle = bearing(rp.x, rp.z, this.ranger.rotation.y, wp.x, wp.z);
      const dist = distanceTo(rp.x, rp.z, goal.pos.x, goal.pos.z);
      const cue = makeCue(angle, dist);
      const key = `${cue.glyph}|${cue.richting}|${cue.afstand}`;
      if (key !== this.lastWayKey) { this.lastWayKey = key; this.onWayfind(cue); }
    } else if (this.lastWayKey !== '') {
      this.lastWayKey = ''; this.onWayfind(null);
    }

    this.placeCamera(reduced, dt, reduced);
  }

  /**
   * Build the live `WorldCtx` an in-place 3D mini-game renders into (3D-IMMERSION
   * §2). The activity anchors on the marker the ranger walked up to (`nearId`), or
   * the ranger's own spot if free-standing. The view reframes + restores the camera
   * and raycasts against this scene — it never tears the world down.
   */
  ctx(prompt: HTMLElement): WorldCtx {
    const near = this.nearId ? this.markers.find((m) => m.missionId === this.nearId) : null;
    const spot = near ? near.pos : this.ranger.position;
    return {
      scene: this.scene,
      camera: this.camera,
      cameraRig: this.camera, // the §1e follow drives the camera directly (no separate rig)
      approachedModel: near ? near.group : null,
      activitySpot: { x: spot.x, y: spot.y, z: spot.z },
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
    for (const m of this.markers) m.label.visible = false;
  }

  /** Resume free-roam after an in-place activity; re-emit the wayfinding cue.
   *  The activity reframe owned the camera; on resume the follow-yaw eases back
   *  to behind the ranger (a cut under reduced-motion, per §3.2). */
  endActivity(): void {
    this.activityActive = false;
    for (const m of this.markers) m.label.visible = true; // W6.1: restore the name-tags on resume
    this.nearId = null;
    this.nearBoard = false; // force a fresh proximity re-fire (re-surfaces the hub prompt)
    this.nearSitSpot = false; // W6.4b2: same — re-surface the sit-spot prompt on resume
    this.lastWayKey = '';
    this.followTargetYaw = this.ranger.rotation.y;
    if (livePolicy().reduced) this.placeCamera(true, 0, true); // reduced → cut back
    // otherwise the next update() frame damps position + yaw back into place.
  }

  /**
   * Place the follow-camera (§1e position follow + W1.5 rotating bearing).
   *
   * The horizontal offset is the fixed distance/height rotated by `followYaw`:
   * `-(sin yaw, cos yaw)·distance` sits the camera behind the ranger's facing.
   * When the follow rotates (toggle on AND not reduced-motion) `followYaw` eases
   * toward the ranger's facing with the damped, rate-clamped `dampedYaw`; else it
   * is pinned to π — the pre-W1.5 straight-behind bearing (reduced-motion falls
   * back to the fixed bearing per §3.2). Position exp-damps (~0.3 s) unless
   * `snap` (reduced-motion cut, activity resume, or first placement). Roll is
   * always 0 and the FOV is fixed at construction — the motion-comfort law.
   */
  private placeCamera(snap: boolean, dt = 0, reduced = false): void {
    const rp = this.ranger.position;
    const follow = this.cameraFollowSource ? this.cameraFollowSource() : true;
    if (follow && !reduced) {
      this.followYaw = dampedYaw(this.followYaw, this.followTargetYaw, dt);
    } else {
      // fixed bearing: straight behind on +z, no rotation — and reset the target
      // so re-enabling the follow doesn't whip-pan from a stale facing.
      this.followYaw = FIXED_FOLLOW_YAW;
      this.followTargetYaw = FIXED_FOLLOW_YAW;
    }
    const s = Math.sin(this.followYaw), c = Math.cos(this.followYaw);
    // W5.1/W5.3b: the jeep uses the wider offset (distance 9, height 4.5) and the
    // helicopter a higher aerial one (13, 6); walking keeps (6.2, 3.4). Same
    // damping — the pull-back (and climb) eases in when he boards.
    const off = this.inHeli ? this.camOffsetHeli : this.inVehicle ? this.camOffsetVehicle : this.camOffset;
    const dist = off.z;
    this.camDesired.set(rp.x - s * dist, rp.y + off.y, rp.z - c * dist);
    if (snap) {
      this.camera.position.copy(this.camDesired);
    } else {
      // exp-damping (~0.3 s) off the REAL frame dt → genuinely frame-rate independent
      // (§C.5 item 2: identical feel at 30/60/120 fps), no shake. Shared dampFactor.
      this.camera.position.lerp(this.camDesired, dampFactor(dt, 0.3));
    }
    this.camera.up.set(0, 1, 0); // roll = 0 always
    this.camera.lookAt(rp.x, rp.y + 1.0, rp.z);
  }
}
