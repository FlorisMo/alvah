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
 *   world/Presenter.ts   the title and the ranger maker: shots of this world (present())
 *   world/DevReadback.ts the dev hook's read-backs
 *
 * Render layer only — it drives the spine through callbacks and holds no game logic.
 * Camera law (§1e): fixed FOV, damped follow, roll 0, no shake; reduced-motion cuts.
 * Every asset is best-effort — missing models fall back to procedural stand-ins.
 */

import * as THREE from 'three';
import { prefersReducedMotion } from '../core/reduced-motion';
import { livePolicy } from './MotionMode';
import { VEN_CENTER, VEN_WATER_R, WATER_LEVEL, type Biome } from './Biomes';
import { Terrain } from './world/Terrain';
import { Sky } from './world/Sky';
import { Labels } from './world/Labels';
import { Dressing, cabinDoorSpot } from './world/Dressing';
import { Fauna } from './world/Fauna';
import { Markers, type WorldMarker } from './world/Markers';
import { Vehicles, MARKER_R, PAD_RADIUS, type JeepStall } from './world/Vehicles';
import { Player, SPAWN, type TapTarget } from './world/Player';
import type { DustHeart } from './world/Dust';
import { CameraRig, DIP_TURN } from './world/CameraRig';
import { Presenter, type Shot, type Focus } from './world/Presenter';
import { DevReadback } from './world/DevReadback';
import type { MoveLimits, Obstacle } from './CharacterController';
import type { StickVector } from '../core/input';
import type { FootSurface } from '../core/footstep';
import { store } from '../core/state';
import type { CamState } from '../core/devhook';
import { FpsProbe, nextTier, bootTier, coarsePointer, lightMode, pixelRatioFor, QUALITY_TIERS, type QualityTier } from '../core/quality';
import { loadsInFlight } from './Models';
import type { WayCue } from './Wayfinding';
import type { RangerMotion, WorldCtx } from './play/types';
import type { RangerRead, Threats } from '../core/wildlife';
import type { HomePlace } from '../core/vehicle';
import { spawnModel, spawnPlant, heightFor } from './play/spawn';
import { Progress } from './world/Progress';
import { Residents, type DressingBuilder, type FrameView, type ResidentBody } from './world/Residents';
import { Stage } from './play/stage';
import type { HomeSpec } from './adventure/types';
import { DEFAULT_MOOD, type MoodId } from './Moods';
import { MOOD_FADE_S } from './world/Sky';
import type { TreeSpecies, TreeStub } from './world/Forest';
import { Surprises, type SurpriseHooks, type SurpriseReadout } from './world/Surprises';

export type { WorldMarker } from './world/Markers';

/**
 * Run 6 · the in-world adventure mode (design §3.3): while a mission with an adventure
 * plays, the world stays LIVE (walking, the follow camera, fauna, sky, the homes'
 * animals) but offers nothing else: no marker or vehicle prompt, no marker labels, no
 * wayfinding (the adventure's own HUD points), the interact key does nothing for them.
 * `input` 'locked' ignores the keys, the stick and a tap on the ground (a
 * `walkRangerTo` target still walks him; the canvas pointer belongs to the adventure's
 * picking); `camera` 'held' leaves the lens to the adventure (its framed beats), and
 * handing it back to 'follow' eases from where it was (a cut under reduced motion).
 */
export interface MissionMode {
  missionId: string;
  input: 'free' | 'locked';
  camera: 'follow' | 'held';
  /** a held lens: what it looks at (the framed view's spots). The trees between the lens
   *  and these (and the ranger) fade, as they do for the follow camera. */
  focus?: readonly { x: number; y: number; z: number }[];
}

/** How far round a home's own ground (its clearings, m) its dressing reaches: the
 *  bushes and look-alikes laid round a glade or a thicket. */
const HOME_MARGIN = 1.5;

/** A mission's home, built with the world (world/Residents.ts). */
export interface WorldHome {
  spec: HomeSpec;
  build?: DressingBuilder;
  /** ground its mud / turned earth keeps bare of the heath scatter */
  clearings?: readonly { x: number; z: number; r: number }[];
  /** ground the forest's scattered trees keep clear of (a glade, a game trail, a view) */
  treeClearings?: readonly { x: number; z: number; r: number }[];
  /** trees the home plants itself, as real forest trees (a camera tree) */
  trees?: readonly HomeTree[];
  /** a resident's own body (a squirrel that climbs), instead of a walking animal's */
  actor?: ResidentBody;
}

/** A tree a mission's home plants (world/Forest.ts draws it with the rest), with the
 *  dead branch stub an animal sits on if it has one (drawn and faded with its tree). */
export interface HomeTree { x: number; z: number; s: number; rotY: number; species: TreeSpecies; stub?: TreeStub }


export type { Shot, Focus } from './world/Presenter';

/** How long the follow rig takes to take the lens over from a presented shot (s). */
const HANDOVER_S = 2.2;
/** A game or the bird bench gives the lens back (s): one calm move from wherever it left
 *  it (a stopped game never glided home) to the follow view — its heading too, not only
 *  its place, so the view never swings round in a frame. */
const ACTIVITY_HANDOVER_S = 1.1;
/** Run 6 polish: climbing into or out of the jeep (or the helicopter) glides the view at
 *  least this long (CameraRig.handover fits it to a longer move); a cut under reduced motion. */
const VEHICLE_GLIDE_S = 1.1;
/** Once it has, the name-tags and the "go here" rings come in over this long (s). */
const WORDS_IN_S = 0.4;
/** The boot veil waits at most this long for the models (ms; software GL: shorter). */
const READY_CAP_MS = 6000;
const READY_CAP_LIGHT_MS = 2000;
/** The fps probe starts this long after the world is ready (ms). */
const PROBE_AFTER_READY_MS = 1500;

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
  private tier: QualityTier = bootTier(store.get().settings.kwaliteitTier, coarsePointer(), lightMode()); // an iPad (and software GL) boots laag
  private readonly fpsProbe = new FpsProbe();
  private readonly canvas: HTMLCanvasElement;
  private readonly onBiome: (biome: Biome) => void;
  private lastBiome: Biome | null = null;       // re-pick the ambience bed on a crossing
  // while a diegetic mini-game plays IN-PLACE, the world stays loaded but freezes:
  // movement, walk-taps, proximity, wayfinding and the §1e follow all pause so the
  // activity's reframe owns the camera (it restores on endActivity).
  private activityActive = false;
  // a menu card over the live world (Pauze, the missiebord, a briefing, the sporenboek):
  // the ranger stands still behind it and a jeep or helicopter gets no input
  private menuOpen: () => boolean = () => false;
  // run 7 (feel): the UI's soft dip (the warm veil fadeCut uses), for a climb into or out of
  // a vehicle that would turn the view more than DIP_TURN (`ride`); null: a plain cut
  private dip: ((move: () => void, then: () => void) => void) | null = null;
  private dipping = false;  // a dip is on its way in: he stands, the keys wait
  private rideCut = false;  // the climb under the dip cuts the view (no glide)
  // the title and the ranger maker are shots of this world (world/Presenter.ts): while
  // one is up the world is frozen like an activity, and the presenter owns the lens
  private readonly presenter: Presenter;
  // how far the name-tags and the "go here" rings are in (0..1): out while a shot is up,
  // and after one they wait for the follow rig to have the lens, then ease in (no pop)
  private wordsIn = 1;
  // the boot veil lifts once every model the build asked for has arrived (Models counts
  // them) or a cap has passed: the player never sees a stand-in waiting for its model
  private readonly builtAt = performance.now();
  private readyAt: number | null = null;
  private settledFrames = 0;
  private compiling = false;
  // D1.3: the world-space anchor the running in-place activity stages its task
  // around (= the `ctx()` activitySpot). camState tests it against the live frustum
  // for `taskInView`, so a game-3D reframe that lands off the playfield / on a
  // backside is caught. Set in ctx(), cleared in endActivity(); null in free-roam.
  private activityFocus: { x: number; y: number; z: number } | null = null;
  // Run 6: the adventure mode (see MissionMode), the per-frame hooks an adventure
  // registers, and a programmatic walk the adventure asked for (walkRangerTo).
  private mode: MissionMode | null = null;
  private readonly frameFns = new Set<(dt: number, t: number) => void>();
  private walkGoal: { x: number; z: number; near: number; done: (ok: boolean) => void } | null = null;
  // run 6: photographs the world asked for (a camera trap's), taken inside the frame
  private readonly shots: { cam: THREE.Camera; w: number; h: number; prepare?: () => (() => void) | void; done: (c: HTMLCanvasElement | null) => void }[] = [];
  /** the animals that live at the missions' homes, and the homes (world/Residents.ts) */
  readonly residents: Residents;
  /** Run 7 (veldgids): the open world's small surprises (world/Surprises.ts) */
  private readonly surprises: Surprises;
  /** …and when the game says free roam is on (WorldSession: no lesson, no briefing) */
  private surpriseFree: () => boolean = () => false;
  private surpriseFreeNow = false;
  private surpriseAsk = 0;
  // run 6 (FLOW): how far (px) the player has dragged the view round (the look lesson),
  // and whether the parked jeep glows (Bram suggested it)
  private lookPx = 0;
  private jeepGlow = false;
  // run 7 (design §4.5): the session's mood (drawn before the title shows) and the one on
  // screen (a play's own, while it stands in one; world/Sky.ts shows it)
  private moodSession: MoodId = DEFAULT_MOOD;
  private moodNow: MoodId = DEFAULT_MOOD;

  // soft-collision blockers (pine trunks) + the kinematic move limits — the
  // ranger slides around trees, can't wade into the ven, can't leave the world.
  private readonly obstacles: Obstacle[] = [];
  /** Run 6: the adventures' homes, by mission — their glades, mud and turned earth (their
   *  `clearings`): another mission's staged game is never laid into them (playClear) */
  private homeGround: { missionId: string; x: number; z: number; r: number }[] = [];
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
    // off-limits = the submerged ven only (inside the drawn water disc AND below the
    // surface) — NOT a global height test, so dry relief troughs stay walkable. (Run 6: the
    // test used an 18 m disc under the 20 m drawn one, so south of the ven, where the basin
    // stays under the surface out to 20 m, a jeep drove into water it could see.)
    blocked: (x, z) => {
      const dx = x - VEN_CENTER.x, dz = z - VEN_CENTER.z;
      return dx * dx + dz * dz < VEN_WATER_R * VEN_WATER_R && this.terrain.y(x, z) < WATER_LEVEL + 0.15;
    },
    // whether any of that water lies within r of (x, z): the jeep's look for the ven's
    // shore is skipped everywhere else
    wetWithin: (x, z, r) => Math.hypot(x - VEN_CENTER.x, z - VEN_CENTER.z) < VEN_WATER_R + r,
  };

  constructor(
    canvas: HTMLCanvasElement,
    markers: WorldMarker[],
    onApproach: (missionId: string | null) => void,
    onWayfind: (cue: WayCue | null) => void = () => {},
    activeId: string | null = null,
    onBiome: (biome: Biome) => void = () => {},
    onInteract: (missionId: string) => void = () => {},
    opts: { homes?: readonly WorldHome[]; mood?: MoodId } = {},
  ) {
    this.canvas = canvas;
    this.onBiome = onBiome;

    // run 7: the visit's mood (WorldSession draws it before the title shows: the golden hour
    // on a save's first visit)
    this.moodSession = this.moodNow = opts.mood ?? DEFAULT_MOOD;
    this.sky = new Sky(this.scene, this.moodSession); // the mood's sky, fog, hemisphere fill + the hero-shadow sun

    this.terrain = new Terrain({
      detail: this.groundDetailOn,
      map: this.groundDetailOn ? Terrain.mottleTexture() : null,
    });
    this.scene.add(this.terrain.mesh);
    // run 6: the tags read the solids (a building hides the tag behind it) and the ground
    this.labels.setWorld({ obstacles: this.obstacles, groundY: (x, z) => this.terrain.y(x, z) });
    this.dressing = new Dressing({
      scene: this.scene, terrain: this.terrain, obstacles: this.obstacles, limits: this.limits, labels: this.labels,
    });
    this.dressing.clearings = (opts.homes ?? []).flatMap((h) => h.clearings ?? []);
    this.dressing.treeClearings = (opts.homes ?? []).flatMap((h) => h.treeClearings ?? []);
    this.dressing.homeTrees = (opts.homes ?? []).flatMap((h) => h.trees ?? []);
    this.homeGround = (opts.homes ?? []).flatMap((h) => (h.clearings ?? []).map((c) => ({ missionId: h.spec.missionId, x: c.x, z: c.z, r: c.r })));
    // the roaming animals slide round the world's solids and keep off the mission markers'
    // ground and the helipads (run 6: they see the jeep and the ranger coming)
    this.fauna = new Fauna({
      scene: this.scene, terrain: this.terrain, obstacles: this.obstacles, limits: this.limits,
      zones: (visit) => {
        for (const m of this.pois.list) visit(m.pos.x, m.pos.z, MARKER_R);
        for (const p of this.vehicles.pads()) visit(p.x, p.z, PAD_RADIUS + 0.3);
      },
    });
    this.pois = new Markers(
      { scene: this.scene, terrain: this.terrain, obstacles: this.obstacles, labels: this.labels, limits: this.limits },
      { onApproach, onInteract, onWayfind }, activeId,
    );
    this.player = new Player(
      {
        scene: this.scene, camera: this.camera, canvas, raycaster: this.raycaster,
        terrain: this.terrain, obstacles: this.obstacles, limits: this.limits,
      },
      {
        pointerBlocked: () => this.frozen || this.vehicles.inVehicle || this.vehicles.inHeli || this.player.inputLocked,
        orbitDrag: (dx, dy) => { this.lookPx += Math.abs(dx) + Math.abs(dy); this.cam.orbitDrag(dx, dy); },
        tapTargets: () => this.tapTargets(),
        crossBiome: (here) => this.crossBiome(here),
        movers: (visit) => this.fauna.visitRoamers(visit), // he walks round the roaming animals (run 6)
      },
    );
    this.vehicles = new Vehicles(
      { scene: this.scene, camera: this.camera, terrain: this.terrain, obstacles: this.obstacles, limits: this.limits },
      {
        ranger: this.ranger,
        seat: (seated) => this.player.rig.setSeated(seated),
        stopWalk: (x, z) => { this.player.target.set(x, 0, z); this.player.groundSpeedNow = 0; },
        intent: () => (this.menuOpen() ? { x: 0, y: 0 } : this.player.intent()),
        controls: () => (this.menuOpen() ? { keys: null, stick: null } : this.player.controls()),
        follow: (yaw, snap) => { this.cam.followTargetYaw = yaw; if (snap) this.cam.followYaw = yaw; },
        // climbing in or out: the view glides from the walk view to the chase view and back
        // (eased, the short way round, fitted to the move); a cut under reduced motion (and
        // in the light mode, whose few frames a second would make a glide a slide show)
        recut: () => {
          const reduced = livePolicy().reduced;
          if (!reduced && !lightMode() && this.cam.placedOnce && !this.rideCut) this.cam.handover(VEHICLE_GLIDE_S, true);
          this.cam.place(true, 0, reduced);
        },
        clearWalkPrompts: () => this.pois.clearForVehicle(),
        crossBiome: (here) => this.crossBiome(here),
        camOffsets: () => ({ walk: this.cam.camOffset, vehicle: this.cam.camOffsetVehicle, heli: this.cam.camOffsetHeli }),
        people: (visit) => { // every frame: no allocation (review PERF-2)
          for (const a of this.fauna.scenicActors) visit(a.group.position.x, a.group.position.z);
        },
        animals: (visit) => { // the roaming ground animals (the birds glide overhead)
          for (const a of this.fauna.ambient) if (a.wander) visit(a.id, a.group.position.x, a.group.position.z);
          // the homes' animals too: the jeep gives way to them, sized by their scale-table row
          this.residents?.movers((x, z, _h, id, animal) => visit(id, x, z, animal));
          // run 7: and to a stag or a badger out there as a surprise
          this.surprises?.movers((id, x, z) => visit(id, x, z));
        },
        markers: () => this.pois.list,
      },
    );
    this.cam = new CameraRig(
      { camera: this.camera, terrain: this.terrain, obstacles: this.obstacles, limits: this.limits },
      this.player, this.dressing,
      {
        mode: () => ({ inVehicle: this.vehicles.inVehicle, inHeli: this.vehicles.inHeli }),
        inputBlocked: () => this.frozen || this.vehicles.inVehicle || this.vehicles.inHeli,
        afterPlace: () => this.pois.fadeRings(this.camera),
        lensKeepOut: (visit) => this.vehicles.visitHeliReach(visit), // run 6: the parked heli's rotor
        parkedJeep: () => this.vehicles.parkedJeep(),                 // run 6 polish: it fades, never folds the lens
        fadeJeep: (target, release) => this.vehicles.fadeJeep(target, release),
        creatures: (visit) => { // what stands on the ground, for the clear view (marker animals ~1 m, as the dev hook reads them)
          for (const m of this.pois.list) { const p = m.group.position; visit(p.x, p.y, p.z, 1.0); }
          for (const a of this.fauna.scenicActors) { const p = a.group.position; visit(p.x, p.y, p.z, a.height); }
          for (const a of this.fauna.ambient) if (!a.glide) { const p = a.group.position; visit(p.x, p.y, p.z, a.h); }
          this.residents?.movers((x, z, h) => visit(x, this.terrain.y(x, z), z, h));
        },
      },
    );
    this.presenter = new Presenter(
      this.camera, this.player,
      { ...SPAWN, y: () => this.terrain.y(SPAWN.x, SPAWN.z) },
      // software GL (the light mode) draws a few frames a second: a glide would be a slide
      // show, so there every move between shots is a cut, as under reduced motion
      () => { const p = livePolicy(); return { reduced: p.reduced || lightMode(), secondary: p.secondaryMotion }; },
    );
    this.scene.add(this.dressing.buildPaths()); // W4.3: sand-path ribbons over the ground
    this.scene.add(this.dressing.buildVenWater());
    this.sky.buildCloudShadows(); // W4.6: drifting cloud shadows over the ground
    this.sky.buildFlyover();      // W4.6: the ~12 s bird flyover
    // W7.2: vegetation density scales with the persisted quality tier (laag ≈ half).
    this.dressing.scatterVegetation(QUALITY_TIERS[this.tier]);

    this.player.spawn(); // the instant stand-in at spawn, back to the lens; the real rig streams in below

    this.camera.up.set(0, 1, 0);
    this.cam.place(true);

    this.pois.placeMarkers(markers);
    this.dressing.placeCabin();
    this.pois.placeBoard();
    this.pois.placePorch(cabinDoorSpot()); // run 6: the hut's door ring (hidden until the raaf is told)
    this.dressing.placeLandmarks();
    this.pois.placeSitSpot();
    this.dressing.placeNatureDressing();
    this.fauna.placeScenicActors();
    // people are solid: the ranger walks round the warden and the poacher (with a child's
    // bit of personal space), never through them
    // (`h`: a lens passes over a grown-up's head, never through him; a tag hides behind him)
    for (const a of this.fauna.scenicActors) this.obstacles.push({ x: a.group.position.x, z: a.group.position.z, r: 1.1, h: a.height, body: 0.3 });
    this.fauna.placeAmbientLife();
    this.vehicles.placeJeep();
    this.vehicles.placeHelipads();
    void this.player.loadRealRanger();
    this.progress = new Progress({
      scene: this.scene, groundY: (x, z) => this.terrain.y(x, z), spawnModel, spawnPlant, heightFor,
      obstacles: this.obstacles, blocked: (x, z) => !!this.limits.blocked?.(x, z),
      markers: () => this.markers.map((m) => ({ missionId: m.missionId, x: m.pos.x, z: m.pos.z, group: m.group, animal: m.animalAt })),
      actors: () => this.fauna.scenicActors.map((a) => a.group.position),
    });
    // the missions' homes: their dressing and their animals, before (or after) each mission
    this.residents = new Residents({
      scene: this.scene, lensFor: (v) => this.frameLens(v), groundY: (x, z) => this.terrain.y(x, z), spawnModel, spawnPlant, heightFor,
      obstacles: this.obstacles, limits: this.limits, reduced: () => livePolicy().reduced,
    });
    for (const h of opts.homes ?? []) this.residents.add(h.spec, h.build, h.actor);
    // run 7 (veldgids): now and then a little of the Veluwe happens near him in free roam
    this.surprises = new Surprises({
      scene: this.scene, camera: this.camera, terrain: this.terrain, fauna: this.fauna,
      trees: () => this.dressing.treePlacements,
      ground: (x, z, r) => this.playClear(x, z, r, null),
      homeNear: (x, z, r) => this.homeNear(x, z, r),
      perches: () => this.obstacles.filter((o) => !o.tree && !o.box && o.h !== undefined && o.r <= 1.1 && o.h <= 4) as { x: number; z: number; r: number; h: number }[],
      viewH: () => this.canvas.clientHeight || 800,
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
    if (this.frozen || this.menuOpen() || this.mode || this.dipping) return; // an adventure offers nothing else
    // W5.1/W5.3b: the jeep + helicopter own the interact key while riding and when
    // standing beside a parked one — they win over the hub/marker affordances. Climbing
    // in or stepping out changes the view (run 7: a big turn is a soft dip-cut, `ride`).
    const view = this.vehicles.interactView();
    if (view !== null) { this.ride(view, () => this.vehicles.interact()); return; }
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

  /** The UI's "a menu card is over the world" test, read each frame (see `menuOpen`). */
  setMenuGate(fn: () => boolean): void {
    this.menuOpen = fn;
  }

  /** Run 7 (feel): the UI's soft dip for a cut inside the world (ui/flow/session.dipCut):
   *  `move` runs while the veil is deepest, `then` once the new view is drawn under it. */
  setDip(fn: ((move: () => void, then: () => void) => void) | null): void {
    this.dip = fn;
  }

  /** Run 7 (ree-growth, additive): the same soft dip for a cut inside a mission's framed
   *  beat (`AdventureKit.frame` with `dip`: a view that would swing the lens more than 90°
   *  round him). `move` runs under the veil, `then` once the new view is drawn; without the
   *  UI's dip, under reduced motion and in the light mode a plain cut (both at once). */
  dipCut(move: () => void, then: () => void): void {
    const dip = this.dip;
    if (!dip || livePolicy().reduced || lightMode()) { move(); then(); return; }
    dip(move, then);
  }

  /**
   * Run 7 (feel): climb into or out of a vehicle (`act`), the view ending up looking along
   * `view`. Today's glide (CameraRig.handover: eased, never faster than ~90°/s) when that
   * turns the view at most DIP_TURN; a bigger turn (the jeep boarded from its front swung
   * the lens ~170° round it) is a soft dip-cut instead: the warm veil comes up, he climbs in
   * under it, the view cuts (`rideCut`) and the veil lifts, so nothing swings in front of a
   * motion-sensitive child. Reduced motion and the light mode keep their plain cut (recut);
   * a no-op `act` (`view` null) just runs. He stands and the keys wait while the veil comes.
   */
  private ride(view: number | null, act: () => void): void {
    if (this.dipping) return;
    const dip = this.dip;
    if (view === null || !dip || livePolicy().reduced || lightMode() || !this.cam.placedOnce || this.cam.turnTo(view) <= DIP_TURN) { act(); return; }
    this.dipping = true;
    dip(() => {
      this.rideCut = true;
      try { act(); } finally { this.rideCut = false; }
    }, () => { this.dipping = false; });
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

  /** Run 6 (FLOW P4): the hut's porch ring — `onNear` as the ranger enters/leaves it,
   *  `onOpen` when he acts on it (the prompt or the interact key): the hut opens. */
  setPorch(cbs: { onNear: (near: boolean) => void; onOpen: () => void }): void {
    this.pois.setPorch(cbs);
  }

  /** Show the porch ring and its tag (Bram told about the young raaf, or it lives there);
   *  `tag`: the words over it. */
  showPorch(on: boolean, tag?: string): void {
    this.pois.showPorch(on, tag);
  }

  /** The porch's ring and tag glow for `seconds` of being seen. */
  glowPorch(seconds: number): void {
    this.pois.glowPorch(seconds);
  }

  /** Dev-hook accessor: the porch ring (where, shown, whether he stands in it, its tag). */
  porchState(): ReturnType<Markers['porchState']> {
    return this.pois.porchState();
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
   *  "Stap in" / "Stap uit" affordance from the live `vehicleState()`; `onStall(why)`:
   *  the gas held but the jeep held back (run 6 polish), null when that is over. */
  setVehicle(cbs: { onNear: (near: boolean) => void; onChange: (inVehicle: boolean) => void; onStall?: (why: JeepStall | null) => void }): void {
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
    this.ride(this.vehicles.viewAfter('heli-in'), () => this.vehicles.enterHeli());
  }

  /** W5.3b: land — the autopilot sets it down on the nearest helipad. */
  landHeli(): void {
    this.vehicles.landHeli();
  }

  /** W5.3b: step out of the helicopter resting on the ground (no-op in the air). */
  exitHeli(): void {
    this.ride(this.vehicles.viewAfter('heli-out'), () => this.vehicles.exitHeli());
  }

  /** Dev-hook accessor (W5.1): the drivable jeep's live state (null before it is placed). */
  vehicleState(): ReturnType<Vehicles['vehicleState']> {
    return this.vehicles.vehicleState();
  }

  /** W5.1: climb into the parked jeep (no-op unless standing beside it). */
  enterVehicle(): void {
    this.ride(this.vehicles.viewAfter('jeep-in'), () => this.vehicles.enterVehicle());
  }

  /** Run 6 polish: under a mission's briefing card, the parked jeep is taken out of that
   *  mission's home (its places), so it never stands in the adventure's pictures or its
   *  walks: it waits behind the `marker` (Vehicles.parkOutOfHome). True when it moved. */
  parkJeepOutOf(places: readonly HomePlace[], marker?: { x: number; z: number }): boolean {
    return this.vehicles.parkOutOfHome(places, marker);
  }

  /** W5.1: step out of the jeep beside it, back to walking (no-op unless driving). */
  exitVehicle(): void {
    this.ride(this.vehicles.viewAfter('jeep-out'), () => this.vehicles.exitVehicle());
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

  /** Dev-hook accessor (run 6): the ranger's gait and his soles (the foot-slip probe). */
  playerGait(): ReturnType<Player['gait']> {
    return this.player.gait();
  }

  /** Dev-hook accessor (run 7 feel): the heels' or the jeep's dust, its strongest puff's
   *  heart on screen before and after the cloud is drawn (world/Dust.ts DustCloud.probe). */
  dustHeart(which: 'heels' | 'jeep'): DustHeart | null {
    return which === 'jeep' ? this.vehicles.dustHeart() : this.player.dustHeart();
  }

  /** How the ranger moves right now: where he stands, his heading, his ground speed
   *  (m/s) and whether he runs. Live; the missions' animals and the dev hook read it. */
  rangerMotion(): RangerMotion {
    return this.player.motion();
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
   *  it on world entry; pass null to clear. Fused with held keys each frame. `onRun`
   *  hears whether the stick has him running (its ring shows it, run 6). */
  setJoystick(source: (() => StickVector | null) | null, onRun: ((running: boolean) => void) | null = null): void {
    this.player.joystickSource = source;
    this.player.stickRunFeedback = onRun;
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

  /** An in-place activity or a presented shot holds the world still. */
  private get frozen(): boolean {
    return this.activityActive || this.presenter.active;
  }

  /**
   * Show the world as the title or the ranger maker (world/Presenter.ts), or (`null`)
   * hand it to the player. While a shot is up the world is frozen like an activity: no
   * input, no prompts or wayfinding, no name-tags or rings; everything else lives. The
   * first shot at boot is a cut; a move between shots, or up from play to the title
   * (`cut` false), an eased glide. Leaving is one move: the follow rig takes the lens
   * over from the shot while the ranger turns back to the forest, and the player can
   * walk at once.
   */
  present(shot: Shot | null, cut = !this.presenter.active): void {
    const reduced = livePolicy().reduced || lightMode(); // moves are cuts (see the Presenter's live())
    if (shot) {
      const entering = !this.presenter.active;
      if (entering) {
        this.setWordsIn(0);
        this.dressing.setCanopyOpacity(1); // no tree left faded from play
        this.player.setAvatarOpacity(1);   // and he stands solid in every shot
      }
      this.presenter.go(shot, cut);
      return;
    }
    if (!this.presenter.active) return;
    this.presenter.release();
    this.pois.resetAfterActivity(); // fresh proximity + cue on the first play frame
    this.cam.reset(SPAWN.heading);
    if (!reduced) this.cam.handover(HANDOVER_S);
    else this.setWordsIn(1); // a cut: the tags and rings are there at once
    this.cam.place(true, 0, livePolicy().reduced);
  }

  /** Where the free part of the screen is while the maker panel is up (the presenter
   *  stands the ranger there). */
  setFocus(fn: (() => Focus) | null): void {
    this.presenter.setFocus(fn);
  }

  /** Back to the start (the title, from Pauze): out of any vehicle, the ranger on the
   *  spawn facing the forest. Called under a fade; the next shot is a cut. */
  resetToSpawn(): void {
    if (this.vehicles.inVehicle) this.vehicles.exitVehicle();
    if (this.vehicles.inHeli) { this.vehicles.setDownNow(); this.vehicles.exitHeli(); }
    const g = this.ranger;
    g.position.set(SPAWN.x, this.terrain.y(SPAWN.x, SPAWN.z), SPAWN.z);
    g.rotation.y = SPAWN.heading;
    this.player.target.set(SPAWN.x, 0, SPAWN.z);
    this.player.groundSpeedNow = 0;
    this.crossBiome(this.terrain.biome(SPAWN.x, SPAWN.z));
    this.cam.reset(SPAWN.heading);
    this.cam.place(true, 0, true); // the lens behind him at the spawn: a glide to a shot starts here
  }

  /** The world is ready to be seen: every model the build asked for has arrived, or the
   *  cap passed (a slow network or software GL never waits long). */
  ready(): boolean {
    return this.readyAt !== null;
  }

  /** Whether the Stage should draw this frame: not while the boot veil hides a world that
   *  is still loading (every frame drawn then is main-thread time the loading needs). */
  get drawable(): boolean {
    return this.readyAt !== null;
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
    renderer.shadowMap.enabled = !lightMode(); // software GL draws no shadow pass (core/quality.ts light mode)
    renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoft is deprecated in this three build
    this.applyPixelRatio(); // W7.2: seed the fill-rate cap from the persisted tier
  }

  /** W7.2: cap the renderer pixelRatio at the live tier's ceiling (× the device
   *  ratio). Cheap and safe to call live on a tier change — no re-render needed. */
  private applyPixelRatio(): void {
    if (!this.renderer) return;
    this.renderer.setPixelRatio(pixelRatioFor(this.tier, window.devicePixelRatio, lightMode()));
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
    this.dressing.setQuality(QUALITY_TIERS[next]); // the forest swaps to lighter/heavier detail now
  }

  /** Dev-hook accessor (W3.3 ⊕ P1.6a): each scenic actor's id + live clip + measured height. */
  actorClips(): { id: string; height: number; clip: { name: string; time: number } | null }[] {
    return this.fauna.actorClips();
  }

  /** Dev-hook accessor (W3.6): each ambient creature's id + live world x/z + height + clip. */
  ambientState(): ReturnType<Fauna['ambientState']> {
    return this.fauna.ambientState();
  }

  /** Dev-hook accessor (W4.1): every landmark's id + world x/z. */
  landmarkPositions(): { id: string; x: number; z: number }[] {
    return this.dressing.landmarkPositions();
  }

  /** Every static solid (dev hook, run 6): circles and the buildings' real footprints. */
  obstacleList(): { x: number; z: number; r: number; box?: { hx: number; hz: number; rot: number; pad: number } }[] {
    return this.obstacles.map((o) => (o.box ? { x: o.x, z: o.z, r: o.r, box: { ...o.box } } : { x: o.x, z: o.z, r: o.r }));
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

  /** Bring the ranger to a mission's marker (a mission picked on the missiebord, or
   *  "Volgende"; the UI covers it with a calm fade): he stands just outside its ring,
   *  facing it, the camera cuts in behind him and its prompt is his, so the mission
   *  plays where it belongs (parent B6). False on foot-less states or an unknown id. */
  bringRangerTo(missionId: string): boolean {
    if (this.activityActive || this.vehicles.inVehicle || this.vehicles.inHeli) return false;
    // facing ground where its game can be laid (the patch test the stage itself uses)
    const spot = this.pois.approachSpot(missionId, this.ranger.position, (x, z) => this.playClear(x, z, 0.2, missionId));
    if (!spot) return false;
    this.ranger.position.set(spot.x, this.terrain.y(spot.x, spot.z), spot.z);
    this.ranger.rotation.y = spot.yaw;
    this.player.target.set(spot.x, 0, spot.z);
    this.cam.followYaw = this.cam.followTargetYaw = spot.yaw;
    this.cam.place(true, 0, livePolicy().reduced);
    this.crossBiome(this.terrain.biome(spot.x, spot.z));
    this.pois.updateProximity(spot.x, spot.z);
    return true;
  }

  /* ------------------------------------------------ run 6: the adventure mode ---- */

  /** Enter, change or leave (null) the adventure mode (see `MissionMode`). */
  setMissionMode(m: MissionMode | null): void {
    const was = this.mode;
    this.mode = m;
    const lock = !!m && m.input === 'locked';
    // locking the input drops any walk he was still doing on his own (a tap target)
    if (lock && !this.player.inputLocked && !this.walkGoal) this.player.target.copy(this.ranger.position).setY(0);
    this.player.inputLocked = lock;
    if (m && !was) {
      // the marker's ring and its name step away for the whole adventure; no prompt stays up
      this.pois.setLabelsVisible(false);
      this.pois.hideForActivity(m.missionId);
      this.pois.clearForVehicle();
      this.vehicles.updateProximity(Infinity, Infinity);
    }
    if (!m && was) {
      this.walkGoal?.done(false);
      this.walkGoal = null;
      this.player.target.copy(this.ranger.position).setY(0);
      this.pois.setLabelsVisible(true);
      this.pois.hideForActivity(null);
      this.pois.resetAfterActivity(); // the next frame re-fires the prompts + the cue
    }
    // a held lens handed back to the follow camera eases from where it was (a cut when reduced)
    if (was?.camera === 'held' && (!m || m.camera === 'follow')) this.cam.handOver(livePolicy().reduced);
  }

  /** The adventure mode now, or null. */
  missionMode(): MissionMode | null {
    return this.mode;
  }

  /**
   * Walk the ranger to (x, z) at his walking pace, as a tap on the ground would (round
   * trees, never into the ven), stopping `stop` m short of it. Works while the input is
   * locked. Resolves true on arrival, false when stopped or given up (blocked).
   */
  walkRangerTo(x: number, z: number, stop = 0.25): Promise<boolean> {
    this.walkGoal?.done(false);
    const rp = this.ranger.position;
    const dx = x - rp.x, dz = z - rp.z, d = Math.hypot(dx, dz);
    const k = d > stop ? (d - stop) / d : 0;
    this.player.walkTarget(rp.x + dx * k, rp.z + dz * k);
    return new Promise((done) => {
      this.walkGoal = { x: this.player.target.x, z: this.player.target.z, near: 0.12, done };
    });
  }

  /** Stop a walk the adventure asked for (he stands where he is). */
  stopRanger(): void {
    this.player.target.copy(this.ranger.position).setY(0);
    this.walkGoal?.done(false);
    this.walkGoal = null;
  }

  private checkWalkGoal(): void {
    const g = this.walkGoal;
    if (!g) return;
    const rp = this.ranger.position;
    const t = this.player.target;
    const arrived = Math.hypot(rp.x - g.x, rp.z - g.z) < g.near;
    const gaveUp = !arrived && Math.hypot(t.x - rp.x, t.z - rp.z) < 0.05; // the tap-walk gave up (blocked)
    if (arrived || gaveUp) { this.walkGoal = null; g.done(arrived); }
  }

  /** Turn the ranger to face a heading (rad) at once — he stands still (a framed beat's
   *  start; the follow camera does not move for it). */
  faceRanger(heading: number): void {
    this.ranger.rotation.y = heading;
    // he stands: a tap-walk target left a few centimetres off (a walk the adventure asked
    // for ends within 0.12 m of it) would turn him straight back to face that spot
    if (!this.walkGoal) this.player.target.copy(this.ranger.position).setY(0);
  }

  /** Run `fn(dt, t)` every frame (inside the world's update, after the animals moved)
   *  until the returned unsubscribe is called. */
  onFrame(fn: (dt: number, t: number) => void): () => void {
    this.frameFns.add(fn);
    return () => { this.frameFns.delete(fn); };
  }

  /** Is a menu card over the world (the ranger held by it)? */
  menuShown(): boolean {
    return this.menuOpen();
  }

  /** Run 6: turn the time of day (1 = the golden hour, 0 = a readable blue night) over
   *  `seconds` (~2 s; a cut under reduced motion). World/Sky.ts. */
  setDaylight(k: number, seconds?: number): void {
    this.sky.setDaylight(k, seconds);
  }

  /** The time of day now (1 = the golden hour). */
  daylight(): number {
    return this.sky.daylight.now;
  }

  /** Run 7 (design §4.5): the session's mood (the light this visit stands in) and the one
   *  on screen now (a play's mood, while a mission plays in it). */
  mood(): { session: MoodId; now: MoodId } {
    return { session: this.moodSession, now: this.moodNow };
  }

  /** Run 7: put the world in a mood (world/Sky.ts: a crossfade of ~`seconds`, 2.5 s by
   *  default; a cut with 0 or under reduced motion). A cut is for a moment a card covers
   *  the world: it also puts the sun where this mood has it (a crossfade never moves it). */
  setMood(id: MoodId, seconds: number = MOOD_FADE_S): void {
    this.moodNow = id;
    this.sky.setMood(id, seconds);
    if (seconds <= 0) this.sky.settleSun();
  }

  /**
   * Run 6: a photograph of the world through `cam` (a camera trap on a tree), `w`×`h` CSS
   * px. It is taken at the end of the next frame's update, right before the frame is drawn
   * (so the picture is lit, tone mapped and fogged exactly as the screen is, and nothing
   * of it ever reaches the screen): the renderer draws the view into a corner of the
   * canvas and it is copied out at once; the frame then draws over it. `prepare` may put
   * something in the picture for that one render (it returns how to take it out again).
   * A trap photographs the wild: the ranger's own jeep and helicopter are never in it
   * (`Vehicles.outOfPicture`). Resolves null without a renderer.
   */
  snapshot(cam: THREE.Camera, w: number, h: number, prepare?: () => (() => void) | void): Promise<HTMLCanvasElement | null> {
    return new Promise((done) => this.shots.push({ cam, w, h, prepare, done }));
  }

  private takeShots(): void {
    const r = this.renderer;
    while (this.shots.length) {
      const job = this.shots.shift()!;
      if (!r) { job.done(null); continue; }
      const undo = job.prepare?.();
      const machines = this.vehicles.outOfPicture();
      const out = document.createElement('canvas');
      out.width = job.w;
      out.height = job.h;
      try {
        const pr = r.getPixelRatio();
        const bufH = r.domElement.height;
        const vp = r.getViewport(new THREE.Vector4());
        const sc = r.getScissor(new THREE.Vector4());
        const scOn = r.getScissorTest();
        r.setViewport(0, 0, job.w, job.h);
        r.setScissor(0, 0, job.w, job.h);
        r.setScissorTest(true);
        if ((job.cam as THREE.PerspectiveCamera).isPerspectiveCamera) {
          const pc = job.cam as THREE.PerspectiveCamera;
          pc.aspect = job.w / job.h;
          pc.updateProjectionMatrix();
        }
        r.render(this.scene, job.cam);
        out.getContext('2d')?.drawImage(r.domElement, 0, bufH - job.h * pr, job.w * pr, job.h * pr, 0, 0, job.w, job.h);
        r.setViewport(vp);
        r.setScissor(sc);
        r.setScissorTest(scOn);
      } finally {
        machines();
        if (typeof undo === 'function') undo();
      }
      job.done(out);
    }
  }

  /** The heading (rad) the lens looks along on the ground. */
  lensHeading(): number {
    const d = this.camera.getWorldDirection(new THREE.Vector3());
    return Math.atan2(d.x, d.z);
  }

  /** Where the lens stands for a framed view of a world spot (a Stage fit with an anchor;
   *  on a 1280×800 screen unless `viewport`), without moving it. */
  frameLens(v: FrameView, viewport = { w: 1280, h: 800 }): { cam: THREE.Vector3; look: THREE.Vector3 } {
    const ctx: WorldCtx = {
      scene: this.scene, camera: this.camera, cameraRig: this.camera, approachedModel: null,
      activitySpot: { x: v.at.x, y: this.terrain.y(v.at.x, v.at.z), z: v.at.z },
      groundY: (x, z) => this.terrain.y(x, z), isClear: () => true,
      player: { x: this.ranger.position.x, z: this.ranger.position.z, yaw: this.ranger.rotation.y },
      rangerMotion: () => this.player.motion(), setFocus: () => {}, spawnModel, spawnPlant,
      raycaster: this.raycaster, canvas: this.canvas, prompt: document.body, reducedMotion: false,
    };
    const st = new Stage(ctx, {
      halfW: v.halfW, halfD: v.halfD, tall: v.tall ?? 1, pitchDeg: v.pitchDeg ?? 34,
      insetTop: v.insetTop ?? 96, insetBottom: v.insetBottom ?? 16,
      anchor: { x: v.at.x, z: v.at.z, heading: v.heading, include: v.include }, viewport,
    });
    return { cam: st.cam.clone(), look: st.look.clone() };
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
    if (!this.frozen && this.vehicles.inHeli) {
      // W5.3b: damped flight mode owns movement while the ranger is in the heli.
      this.vehicles.flyHeli(dt);
    } else if (!this.frozen && this.vehicles.inVehicle) {
      // W5.1: arcade drive mode owns movement while the ranger is in the jeep.
      this.vehicles.driveJeep(dt);
    } else if (!this.frozen && !this.menuOpen() && !this.dipping) {
      // on foot: tank keys, the stick or a tap-walk move the ranger, and his steering
      // tells the follow camera what to do (world/Player.walk → CameraRig.steer). In an
      // adventure the same walk (the keys only while its input is free), and a held
      // lens is the adventure's.
      const steer = this.player.walk(dt, this.cam.viewFrame());
      if (this.mode?.camera !== 'held') this.cam.steer(steer);
    }
    this.checkWalkGoal();

    this.pois.animate(t, dt, reduced); // each mission marker's animal (secondary motion)
    this.progress.update(t, dt, reduced, this.camera, this.activityActive); // finished tableaus: reunion walks, idle breathing

    // W3.3 warden + poacher clips, W3.6 roaming animals + gliding birds; run 6: the roamers
    // see the ranger on foot and a driven jeep coming
    this.fauna.update(t, dt, reduced, this.camera, this.threats(dt));
    this.residents.update(t, dt, this.camera, rp);  // run 6: the missions' homes and their animals
    // run 7 (veldgids): the open world's small surprises, in free roam only (on foot or in the
    // jeep; never in a mission, a game, the helicopter or before the world is up); a menu
    // card holds them still
    // (the game's own word on free roam is asked a few times a second, not every frame)
    this.surpriseAsk -= dt;
    if (this.surpriseAsk <= 0) { this.surpriseAsk = 0.25; this.surpriseFreeNow = this.surpriseFree(); }
    this.surprises.update(dt, {
      free: this.readyAt !== null && !this.mode && !this.frozen && !this.vehicles.inHeli && this.surpriseFreeNow,
      paused: this.menuOpen(),
      ranger: { x: rp.x, z: rp.z, running: this.player.rig.running },
      onFoot: !this.vehicles.inVehicle && !this.vehicles.inHeli,
      reduced,
    });
    this.fauna.tendWarden(dt, rp, reduced); // run 6: Bram turns to the ranger while he speaks

    // W3.2: the ranger's own locomotion animation (and his footsteps, on his feet).
    // Locomotion is reduced-motion EXEMPT (§3.4) so the mixer always advances with real
    // dt — a walking ranger animates in both motion modes; only the procedural-bob
    // fallback holds still.
    this.player.animate(dt, reduced);

    // ready once nothing the build asked for is still loading (two frames in a row, so a
    // model that swaps in after its load is in the scene) and every shader the scene needs
    // is compiled (in parallel, off the main thread where the GPU allows: the first frame
    // the player sees never stalls), or at the cap
    if (this.readyAt === null) {
      this.settledFrames = loadsInFlight() === 0 ? this.settledFrames + 1 : 0;
      const now = performance.now();
      if (now - this.builtAt > (lightMode() ? READY_CAP_LIGHT_MS : READY_CAP_MS)) this.readyAt = now;
      else if (this.settledFrames >= 2 && !this.compiling && this.renderer) {
        this.compiling = true;
        const done = (): void => { this.readyAt ??= performance.now(); };
        this.renderer.compileAsync(this.scene, this.camera).then(done, done);
      }
    }

    // W7.2: measure fps and step the quality tier down/up with hysteresis — only once
    // the world is up: the decode stalls behind the boot veil are not the device's pace
    if (this.readyAt !== null && performance.now() - this.readyAt > PROBE_AFTER_READY_MS) this.probeQuality(dt);

    // W5.2: age the jeep's dust cloud every frame (so puffs keep fading after a
    // stop or step-out). Emission itself happens in driveJeep, gated on motion +
    // reduced-motion; this only advances what is already alive.
    this.vehicles.updateDust(dt);

    // W4.6 "Lucht + adem": drifting cloud shadows + grass wind wave + bird flyover.
    // All SECONDARY motion → the atmosphere clock advances ONLY when reduced-motion
    // is off, so a frozen clock stills every effect together (comfort §C). Runs
    // every frame (even during an in-place activity) so the sky keeps breathing.
    const st = this.sky.advance(dt, reduced); // clouds drift + the flyover bird sails
    this.dressing.animate(st, reduced, this.sky.wind); // grass wind wave (the mood's breeze) + the ven water shimmer

    this.tendBeacon();

    for (const fn of this.frameFns) fn(dt, t); // an adventure's per-frame beat (its lens, its animals, its checks)

    if (this.shots.length) this.takeShots(); // run 6: a camera trap's photographs (before the frame is drawn)

    // the activity owns proximity/wayfinding/camera; a presented shot owns the lens.
    // F-22: the name-tags are faded here too, so an open mission's Missiebord tag
    // (clipped in Run A's 22-mission-3d) keeps its close-up full opacity.
    if (this.frozen) { this.presenter.update(dt); this.fadeTags(rp, dt, reduced); return; }
    if (this.mode) {
      // an adventure: nothing to offer but the adventure (no prompts, no wayfinding);
      // the follow camera, unless the adventure holds the lens (then the trees between
      // the held lens and what it frames still fade, as they do for the follow camera)
      if (this.mode.camera === 'follow') this.cam.place(reduced, dt, reduced);
      else this.cam.fadeHeld(dt, reduced, this.mode.focus ?? []);
      this.fadeTags(rp, dt, reduced); // (once the lens stands where this frame draws it)
      return;
    }

    // W5.1 / W5.3b: "Stap in" near the parked jeep or helicopter (suppressed while riding)
    this.vehicles.updateProximity(rp.x, rp.z);

    // proximity → the marker / Missiebord / sit-spot prompts. Suppressed while driving
    // or flying so no stale prompt sits behind the vehicle pill (rp is the vehicle's
    // spot while the ranger rides hidden).
    if (!this.vehicles.inVehicle && !this.vehicles.inHeli) this.pois.updateProximity(rp.x, rp.z);

    // the calm wayfinding cue toward the active mission (follows the sand paths)
    this.pois.updateWayfinding(rp.x, rp.z, this.ranger.rotation.y);

    this.cam.place(reduced, dt, reduced);
    this.presenter.update(dt); // the ranger's turn back to the forest after a shot
    this.fadeTags(rp, dt, reduced);
    // after a shot the tags and rings come in once the lens has settled behind him
    if (this.wordsIn < 1 && !this.cam.handingOver) {
      this.setWordsIn(reduced || lightMode() ? 1 : this.wordsIn + Math.min(dt, 0.05) / WORDS_IN_S);
    }
  }

  /** F-22 + run 6: the name-tags' per-frame pass (who shows, faded, never cut at the edge),
   *  run once the lens stands where this frame draws it: a tag's box on screen is the one
   *  the player sees, never last frame's (a turning view moved it by tens of px). */
  private fadeTags(rp: THREE.Vector3, dt: number, reduced: boolean): void {
    this.labels.fade(this.camera, { w: this.canvas.clientWidth, h: this.canvas.clientHeight }, rp, dt, reduced);
  }

  private setWordsIn(k: number): void {
    this.wordsIn = Math.min(1, k);
    this.labels.setShown(this.wordsIn);
    this.pois.setRingsShown(this.wordsIn);
  }

  // Run 6 (wildlife): what the roaming animals react to, rebuilt each frame in reused objects.
  private readonly threatNow: Threats = { ranger: null, jeep: null };
  private readonly rangerNow: RangerRead = { x: 0, z: 0, heading: 0, speed: 0, running: false };
  private rangerLast = { x: Number.NaN, z: Number.NaN };
  /** The ranger on foot (his real velocity this frame: backing up and tap-walks included;
   *  a cut such as a mission's step-in is no speed) and the jeep while someone drives it. */
  private threats(dt: number): Threats {
    const th = this.threatNow;
    const rp = this.ranger.position;
    const last = this.rangerLast;
    if (!this.vehicles.inVehicle && !this.vehicles.inHeli) {
      const r = this.rangerNow;
      const vx = Number.isNaN(last.x) || dt <= 0 ? 0 : (rp.x - last.x) / dt;
      const vz = Number.isNaN(last.z) || dt <= 0 ? 0 : (rp.z - last.z) / dt;
      const sp = Math.hypot(vx, vz);
      r.x = rp.x; r.z = rp.z;
      r.speed = sp > 8 ? 0 : sp;
      r.heading = r.speed > 0.05 ? Math.atan2(vx, vz) : this.ranger.rotation.y;
      r.running = this.player.rig.running;
      th.ranger = r;
    } else th.ranger = null;
    last.x = rp.x; last.z = rp.z;
    th.jeep = this.vehicles.jeepThreat();
    return th;
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
      rangerMotion: () => this.player.motion(),
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
   *  people, and off another mission's home (its glade, its mud, the bushes round them:
   *  the nachtronde's den was laid in the wildcamera's thicket, half behind its bush). The
   *  approached marker is exempt, its animal beside the ring too: the stage hides them
   *  while the game runs. */
  private playClear(x: number, z: number, r: number, except: string | null = this.nearId): boolean {
    if (this.limits.blocked?.(x, z)) return false;
    if (this.progress.blocks(x, z, r, except)) return false; // a finished mission's family stays out of a game
    for (const c of this.homeGround) {
      if (c.missionId !== except && Math.hypot(c.x - x, c.z - z) < c.r + HOME_MARGIN + r) return false;
    }
    for (const o of this.obstacles) {
      if (o.marker !== undefined && o.marker === except) continue;
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

  /** Run 7 (veldgids): a mission's home ground or a marker lies within `r` of (x, z). */
  private homeNear(x: number, z: number, r: number): boolean {
    for (const c of this.homeGround) if (Math.hypot(c.x - x, c.z - z) < c.r + HOME_MARGIN + r) return true;
    for (const m of this.markers) if (Math.hypot(m.pos.x - x, m.pos.z - z) < 1.2 + r) return true;
    return false;
  }

  /**
   * Run 7 (veldgids): the open world's small surprises talk to the game through these:
   * `free` says when free roam is on as the game sees it (no first-minute lesson, no
   * briefing), the rest is what he met (the save, the reveal). null: no surprises.
   */
  setSurprises(hooks: (SurpriseHooks & { free(): boolean }) | null): void {
    this.surpriseFree = hooks ? () => hooks.free() : () => false;
    this.surprises.setHooks(hooks);
  }

  /** Run 7: the surprises read (`__ranger.surprise()`). */
  surpriseState(): SurpriseReadout {
    return this.surprises.state();
  }

  /** Felt progress (ui/flow calls this on completion, and on world build for every
   *  mission already done): the marker reads "klaar" and its finished tableau stands
   *  (world/Progress.ts). `fresh` plays the calm reunion; resolves once it has played. */
  onMissionComplete(missionId: string, opts: { fresh: boolean }): Promise<void> {
    this.pois.setFinished(missionId);
    this.residents.setState(missionId, 'after', opts.fresh); // (a borrowed home is its adventure's)
    if (opts.fresh) this.pois.hideForActivity(null); // the marker's animal is back for its reunion
    const view = { camera: this.camera, ranger: { x: this.ranger.position.x, z: this.ranger.position.z } };
    return this.progress.complete(missionId, opts.fresh, livePolicy().reduced, view);
  }

  // ---- run 6 (FLOW lane): Bram, the lessons, the glowing cues --------------------------
  /** Bram speaks (he turns to the ranger, a speech mark over his head) or is quiet. */
  setWardenTalking(on: boolean, mark = on): void {
    this.fauna.setWardenTalking(on, mark);
  }

  /** How far the ranger is from Bram (m); Infinity before Bram stands. */
  wardenDistance(): number {
    const w = this.fauna.wardenPos();
    if (!w) return Infinity;
    return Math.hypot(w.x - this.ranger.position.x, w.z - this.ranger.position.z);
  }

  /** Bram for the dev hook (see Fauna.wardenState). */
  wardenState(): ReturnType<Fauna['wardenState']> {
    return this.fauna.wardenState(this.ranger.position);
  }

  /** How far (px) the player has dragged the view round so far (a mouse or a finger). */
  lookedPx(): number {
    return this.lookPx;
  }

  /** Bram named the next mission: its tag now shows from afar, and its ring and tag
   *  glow for `seconds`. `false` holds it back again (until the hook, a fresh player). */
  revealNext(on: boolean, seconds = 0): void {
    this.pois.setNextRevealed(on);
    if (on && seconds > 0) this.pois.glowActive(seconds);
  }

  /** The missiebord's ring and tag glow for `seconds`. */
  glowBoard(seconds: number): void {
    this.pois.glowBoard(seconds);
  }

  /** The parked jeep glows (a warm ring round it) until he gets in, or `false`. */
  glowJeep(on: boolean): void {
    this.jeepGlow = on;
    const v = this.vehicles;
    if (!on || !v.jeep || !v.jeepPos || v.inVehicle) { this.pois.setBeacon(null); return; }
    this.pois.setBeacon({ x: v.jeepPos.x, z: v.jeepPos.z, r: 2.5 });
  }

  /** Where the glowing cues stand (the dev hook): the next mission, the board, the jeep. */
  glowState(): ReturnType<Markers['glowState']> {
    return this.pois.glowState();
  }

  /** Every name-tag drawn now: its words, opacity and box on screen (the dev hook). */
  tagsOnScreen(): ReturnType<Labels['visibleTags']> {
    return this.labels.visibleTags();
  }

  /** The jeep's glow ends once he gets in. */
  private tendBeacon(): void {
    if (this.jeepGlow && this.vehicles.inVehicle) this.glowJeep(false);
  }
  // ---- end run 6 -------------------------------------------------------------------

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
   *  The activity reframe owned the camera; on resume the lens eases back from where
   *  the reframe left it to the follow view at the bearing it had (a cut under
   *  reduced-motion, per §3.2). */
  endActivity(): void {
    this.activityActive = false;
    this.activityFocus = null; // D1.3: no task owns the camera in free-roam
    this.pois.setLabelsVisible(true); // W6.1: restore the name-tags on resume
    this.pois.hideForActivity(null);
    this.pois.resetAfterActivity();   // fresh proximity + cue re-fire (re-surfaces the hub prompt)
    if (livePolicy().reduced) this.cam.place(true, 0, true); // reduced → cut back
    else this.cam.handover(ACTIVITY_HANDOVER_S); // otherwise one eased move back into place
  }

}
