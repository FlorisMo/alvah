/**
 * devhook.ts — the dev-state hook `window.__ranger` (WORLD-PLAN §3.1 / W0.2).
 *
 * The browser-proof contract asserts against runtime STATE, not pixels
 * (headless SwiftShader renders deterministically enough for state but not for
 * pixel diffs). This module is the single, DOM-free channel the E2E suite reads.
 *
 * It is gated behind `import.meta.env.DEV || ?dev=1` (W0.2): the hook object is
 * only attached to `window` in that case. The setter/provider calls elsewhere
 * are always safe — they just update module state; when the hook is not
 * installed nothing reads it.
 *
 * Fields (per §3.1): `screen`, `pos()`, `cameraYaw()`, `drawCalls()`,
 * `missionView`, `clip()`, `version`. Live values (pos, camera, draw calls,
 * animation clip) come through registered providers so this module never needs
 * to import three.js or the World — keeping it out of the pure-core test spine.
 */

export type Screen = 'title' | 'avatar' | 'lodge' | 'world' | 'mission';
export type MissionView = '2d' | '3d' | null;

export interface RangerDevHook {
  readonly version: string;
  readonly screen: Screen;
  readonly missionView: MissionView;
  pos(): { x: number; z: number } | null;
  cameraYaw(): number | null;
  drawCalls(): number | null;
  clip(): { name: string; time: number } | null;
  /** The mission id the ranger is standing at (proximity), or null (W1.4). */
  nearId(): string | null;
  /** Every mission marker's world position, for E2E navigation (W1.4). */
  markers(): { x: number; z: number; missionId: string }[] | null;
  /** The spawn case-board hub: world position + live proximity, for E2E (W2.2). */
  board(): { x: number; z: number; near: boolean } | null;
  /** Win the active 3D mission step via its genuine resolve path; true if one
   *  was pending. Drives the two-mission-chain E2E deterministically (W2.3). */
  winStep(): boolean;
  /** The scenic story-arc actors (warden + poacher) with their live baked-clip
   *  {name, time}, or null before the hook/world is ready (W3.3). */
  actors(): { id: string; clip: { name: string; time: number } | null }[] | null;
  /** The ambient wildlife (roaming animals + gliding birds): id + live world x/z
   *  + applied canonical stand height `h` (W3.7a) + dominant baked clip
   *  {name, time} (null for the procedural/bird cast), or null before the
   *  hook/world is ready (W3.6). */
  ambient(): { id: string; x: number; z: number; h: number; clip: { name: string; time: number } | null }[] | null;
  /** The fixed landmark props (watchtower, ecoduct, bird-hide, BOA post,
   *  signposts): id + world x/z, for E2E spawn→watchtower navigation (W4.1). */
  landmarks(): { id: string; x: number; z: number }[] | null;
  /** The nature-dressing props (real tree/rock/mushroom/reed GLBs clustered at
   *  POIs + biome cores): id + world x/z, or null before the hook/world is
   *  ready (W4.2). */
  dressing(): { id: string; x: number; z: number }[] | null;
  /** The sand-path network: route nodes (id + world x/z) + segment index pairs,
   *  or null before the hook/world is ready (W4.3). */
  paths(): { nodes: { id: string; x: number; z: number }[]; segments: [number, number][] } | null;
  /** The W4.4 ground-detail state: whether the procedural albedo layers are on,
   *  whether the repeating mottle map is bound, and its tile repeat — lets the
   *  E2E assert the before/after toggle actually flips the floor. */
  groundDetail(): { on: boolean; textured: boolean; tileRepeat: number } | null;
  /** The W4.5 lighting state: whether the renderer shadow map is on, whether the
   *  golden-hour sun casts the hero shadow, whether the ranger casts it, and how
   *  many animal blob shadows are placed — lets the E2E assert selective shadows
   *  exist and the budget still holds. */
  lighting(): { shadowMap: boolean; sunCastsShadow: boolean; rangerCastsShadow: boolean; blobShadows: number } | null;
  /** The W4.6 "Lucht + adem" state: richer-gradient stop count, whether the
   *  cloud-shadow layer + wind grasses exist, and the LIVE cloud offset / wind
   *  sample / bird flyover — lets the E2E assert the ambient motion advances when
   *  moving and FREEZES under reduced-motion. */
  sky(): {
    gradientStops: number;
    cloudDrift: boolean;
    windMeshes: number;
    skyTime: number;
    cloudOffset: { x: number; y: number };
    windSample: number;
    flyover: { x: number; y: number; z: number; visible: boolean } | null;
  } | null;
  /** The W4.7b footstep state: the running count of footsteps planted and the
   *  last surface ('zand'|'gras'), or null before the hook/world is ready — lets
   *  the E2E assert footsteps fire while walking and the sound gate holds. */
  footsteps(): { count: number; surface: 'zand' | 'gras' | null } | null;
  /** The W4.8 ven-water state: whether the fresnel disc shader exists, the ripple
   *  amplitude in force (0 under reduced-motion → waveless), and the live clock —
   *  lets the E2E assert the disc ripples with motion on and holds still under
   *  reduced-motion. Null before the hook/world is ready. */
  water(): { shader: boolean; amp: number; time: number } | null;
  /** The W5.1 drivable-jeep state: placement, proximity, whether the ranger is
   *  driving, the jeep's world position + heading, the active arcade caps
   *  (reduced-motion halves them), the wider camera offset, and the comfort
   *  invariants (fixed FOV, roll 0) — lets the E2E enter, drive ≥10 m, exit, and
   *  assert the caps + comfort. Null before the jeep is placed. */
  vehicle(): {
    placed: boolean; near: boolean; inVehicle: boolean;
    x: number; z: number; heading: number;
    speed: number; maxSpeed: number; turnRate: number;
    camDist: number; camHeight: number; fov: number; roll: number;
    nearAnimal: boolean; dust: boolean;
  } | null;
  /** The W5.3b helicopter state: placement + the two helipads, opt-in +
   *  availability (false under reduced-motion — flight is withheld, not calmed),
   *  proximity, whether the ranger is flying, world x/z + heading + altitude, the
   *  flight caps + fixed cruise height, whether it is over a pad (can land), the
   *  live motion vignette, and the comfort invariants (fixed FOV, roll 0) — lets
   *  the E2E fly pad-to-pad and assert the comfort law. Null before it is placed. */
  heli(): {
    placed: boolean; available: boolean; optIn: boolean; near: boolean; inHeli: boolean; onPad: boolean;
    x: number; z: number; heading: number; altitude: number;
    speed: number; climbRate: number; cruiseHeight: number; maxSpeed: number; turnRate: number;
    camDist: number; camHeight: number; fov: number; roll: number; vignette: number;
    pads: { x: number; z: number }[];
  } | null;
}

const VERSION = '2.0.0-world';

const state = {
  screen: 'title' as Screen,
  missionView: null as MissionView,
  pos: null as null | (() => { x: number; z: number }),
  cameraYaw: null as null | (() => number),
  drawCalls: null as null | (() => number),
  clip: null as null | (() => { name: string; time: number } | null),
  nearId: null as null | (() => string | null),
  markers: null as null | (() => { x: number; z: number; missionId: string }[]),
  board: null as null | (() => { x: number; z: number; near: boolean } | null),
  winStep: null as null | (() => boolean),
  actors: null as null | (() => { id: string; clip: { name: string; time: number } | null }[]),
  ambient: null as null | (() => { id: string; x: number; z: number; h: number; clip: { name: string; time: number } | null }[]),
  landmarks: null as null | (() => { id: string; x: number; z: number }[]),
  dressing: null as null | (() => { id: string; x: number; z: number }[]),
  paths: null as null | (() => { nodes: { id: string; x: number; z: number }[]; segments: [number, number][] }),
  groundDetail: null as null | (() => { on: boolean; textured: boolean; tileRepeat: number }),
  lighting: null as null | (() => { shadowMap: boolean; sunCastsShadow: boolean; rangerCastsShadow: boolean; blobShadows: number }),
  sky: null as null | (() => {
    gradientStops: number;
    cloudDrift: boolean;
    windMeshes: number;
    skyTime: number;
    cloudOffset: { x: number; y: number };
    windSample: number;
    flyover: { x: number; y: number; z: number; visible: boolean } | null;
  }),
  footsteps: null as null | (() => { count: number; surface: 'zand' | 'gras' | null }),
  water: null as null | (() => { shader: boolean; amp: number; time: number }),
  vehicle: null as null | (() => {
    placed: boolean; near: boolean; inVehicle: boolean;
    x: number; z: number; heading: number;
    speed: number; maxSpeed: number; turnRate: number;
    camDist: number; camHeight: number; fov: number; roll: number;
    nearAnimal: boolean; dust: boolean;
  } | null),
  heli: null as null | (() => {
    placed: boolean; available: boolean; optIn: boolean; near: boolean; inHeli: boolean; onPad: boolean;
    x: number; z: number; heading: number; altitude: number;
    speed: number; climbRate: number; cruiseHeight: number; maxSpeed: number; turnRate: number;
    camDist: number; camHeight: number; fov: number; roll: number; vignette: number;
    pads: { x: number; z: number }[];
  } | null),
};

/** Current screen the player is on. */
export function setScreen(s: Screen): void {
  state.screen = s;
}

/** Resolved view mode of the active mission ('2d' | '3d'), or null when none. */
export function setMissionView(v: MissionView): void {
  state.missionView = v;
}

/** Register the live ranger-position source (the World). Pass null to clear. */
export function providePos(fn: (() => { x: number; z: number }) | null): void {
  state.pos = fn;
}

/** Register the live camera-yaw source (the World). Pass null to clear. */
export function provideCameraYaw(fn: (() => number) | null): void {
  state.cameraYaw = fn;
}

/** Register the live draw-call source (the Budgets overlay / renderer.info). */
export function provideDrawCalls(fn: (() => number) | null): void {
  state.drawCalls = fn;
}

/** Register the live player-animation clip source (the mixer, W3.2). */
export function provideClip(fn: (() => { name: string; time: number } | null) | null): void {
  state.clip = fn;
}

/** Register the live proximity source (the World's `nearId`). Pass null to clear. */
export function provideNearId(fn: (() => string | null) | null): void {
  state.nearId = fn;
}

/** Register the live marker-positions source (the World). Pass null to clear. */
export function provideMarkers(
  fn: (() => { x: number; z: number; missionId: string }[]) | null,
): void {
  state.markers = fn;
}

/** Register the live case-board hub source (the World). Pass null to clear (W2.2). */
export function provideBoard(
  fn: (() => { x: number; z: number; near: boolean } | null) | null,
): void {
  state.board = fn;
}

/** Register the "win the active 3D step" driver (the mission runner). W2.3. */
export function provideWinStep(fn: (() => boolean) | null): void {
  state.winStep = fn;
}

/** Register the scenic-actors source (the World's warden + poacher clips). W3.3. */
export function provideActors(
  fn: (() => { id: string; clip: { name: string; time: number } | null }[]) | null,
): void {
  state.actors = fn;
}

/** Register the ambient-wildlife source (the World's roaming animals + birds). W3.6. */
export function provideAmbient(
  fn: (() => { id: string; x: number; z: number; h: number; clip: { name: string; time: number } | null }[]) | null,
): void {
  state.ambient = fn;
}

/** Register the landmark-props source (the World's fixed beacons). W4.1. */
export function provideLandmarks(
  fn: (() => { id: string; x: number; z: number }[]) | null,
): void {
  state.landmarks = fn;
}

/** Register the nature-dressing source (the World's clustered GLB props). W4.2. */
export function provideDressing(
  fn: (() => { id: string; x: number; z: number }[]) | null,
): void {
  state.dressing = fn;
}

/** Register the sand-path network source (the World's route graph). W4.3. */
export function providePaths(
  fn: (() => { nodes: { id: string; x: number; z: number }[]; segments: [number, number][] }) | null,
): void {
  state.paths = fn;
}

/** Register the W4.4 ground-detail state source (the World's ground material). */
export function provideGroundDetail(
  fn: (() => { on: boolean; textured: boolean; tileRepeat: number }) | null,
): void {
  state.groundDetail = fn;
}

/** Register the W4.5 lighting/shadow state source (the World). Pass null to clear. */
export function provideLighting(
  fn: (() => { shadowMap: boolean; sunCastsShadow: boolean; rangerCastsShadow: boolean; blobShadows: number }) | null,
): void {
  state.lighting = fn;
}

/** Register the W4.6 "Lucht + adem" atmosphere state source (the World). */
export function provideSky(
  fn: (() => {
    gradientStops: number;
    cloudDrift: boolean;
    windMeshes: number;
    skyTime: number;
    cloudOffset: { x: number; y: number };
    windSample: number;
    flyover: { x: number; y: number; z: number; visible: boolean } | null;
  }) | null,
): void {
  state.sky = fn;
}

/** Register the W4.7b footstep-state source (the World). Pass null to clear. */
export function provideFootsteps(
  fn: (() => { count: number; surface: 'zand' | 'gras' | null }) | null,
): void {
  state.footsteps = fn;
}

/** Register the W4.8 ven-water-state source (the World). Pass null to clear. */
export function provideWater(
  fn: (() => { shader: boolean; amp: number; time: number }) | null,
): void {
  state.water = fn;
}

/** Register the W5.1 drivable-jeep-state source (the World). Pass null to clear. */
export function provideVehicle(
  fn: (() => {
    placed: boolean; near: boolean; inVehicle: boolean;
    x: number; z: number; heading: number;
    speed: number; maxSpeed: number; turnRate: number;
    camDist: number; camHeight: number; fov: number; roll: number;
    nearAnimal: boolean; dust: boolean;
  } | null) | null,
): void {
  state.vehicle = fn;
}

/** Register the W5.3b helicopter-state source (the World). Pass null to clear. */
export function provideHeli(
  fn: (() => {
    placed: boolean; available: boolean; optIn: boolean; near: boolean; inHeli: boolean; onPad: boolean;
    x: number; z: number; heading: number; altitude: number;
    speed: number; climbRate: number; cruiseHeight: number; maxSpeed: number; turnRate: number;
    camDist: number; camHeight: number; fov: number; roll: number; vignette: number;
    pads: { x: number; z: number }[];
  } | null) | null,
): void {
  state.heli = fn;
}

/**
 * Attach `window.__ranger` when DEV or `?dev=1`. Idempotent. Returns whether
 * the hook was installed (for logging/tests).
 */
export function installDevHook(): boolean {
  const devFlag =
    import.meta.env.DEV ||
    new URLSearchParams(location.search).has('dev');
  if (!devFlag) return false;
  const hook: RangerDevHook = {
    version: VERSION,
    get screen() { return state.screen; },
    get missionView() { return state.missionView; },
    pos: () => (state.pos ? state.pos() : null),
    cameraYaw: () => (state.cameraYaw ? state.cameraYaw() : null),
    drawCalls: () => (state.drawCalls ? state.drawCalls() : null),
    clip: () => (state.clip ? state.clip() : null),
    nearId: () => (state.nearId ? state.nearId() : null),
    markers: () => (state.markers ? state.markers() : null),
    board: () => (state.board ? state.board() : null),
    winStep: () => (state.winStep ? state.winStep() : false),
    actors: () => (state.actors ? state.actors() : null),
    ambient: () => (state.ambient ? state.ambient() : null),
    landmarks: () => (state.landmarks ? state.landmarks() : null),
    dressing: () => (state.dressing ? state.dressing() : null),
    paths: () => (state.paths ? state.paths() : null),
    groundDetail: () => (state.groundDetail ? state.groundDetail() : null),
    lighting: () => (state.lighting ? state.lighting() : null),
    sky: () => (state.sky ? state.sky() : null),
    footsteps: () => (state.footsteps ? state.footsteps() : null),
    water: () => (state.water ? state.water() : null),
    vehicle: () => (state.vehicle ? state.vehicle() : null),
    heli: () => (state.heli ? state.heli() : null),
  };
  (window as unknown as { __ranger: RangerDevHook }).__ranger = hook;
  return true;
}
