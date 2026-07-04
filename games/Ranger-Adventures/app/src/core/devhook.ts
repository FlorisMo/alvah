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

/** The REAL render-camera read-back (F-05 ⊕ F-18). See `RangerDevHook.cam`. */
export type CamState = {
  dist: number; yaw: number; pitch: number;
  x: number; y: number; z: number;
  target: 'avatar' | 'vehicle'; avatarInView: boolean;
  /** The applied ranger render opacity this frame (1 = solid). The F-05 fade rail
   *  drops it below 1 ONLY when the boom collapses toward the ranger; a settled
   *  hero/POI frame must read 1. Exposed as the machine signal that ends the F-07
   *  proportion-shot's blind retries: a genuinely faded ranger (opacity < 1)
   *  predicts an empty frame BEFORE the judge looks, and opacity == 1 proves the
   *  fade is NOT why the ranger is hard to see — so a hard-to-see-but-solid ranger
   *  redirects the fix to framing, not to the boom (AUDIT-FINDINGS §4: pixels are
   *  the court of appeal; this is the field that keeps them honest). */
  avatarOpacity: number;
  /** The ranger's world centre projected to normalised screen space (F-05 framing,
   *  Run B monitor steer #2): `x`/`y` in [-1, 1] (0 = frame centre, +y up), `onScreen`
   *  true when he is inside the frustum AND in front of the lens. The framing machine
   *  signal — a settled world-entry / walk / hub frame must keep the WHOLE ranger in
   *  the central band (|x|, |y| ≲ 0.6), so a ranger who projects to the horizon edge
   *  or off-frame FAILS the assert BEFORE a judge misreads a soft-DOF frame as "murk"
   *  or "a distant speck". `avatarInView` only tests the frustum; this tests that he
   *  is actually FRAMED — the field that ends the F-07 proportion shot's blind loop.
   *  `heightFrac` is his bbox's projected vertical extent as a fraction of the
   *  viewport, so "solid but a 10 px speck" is detectable, not just off-screen. */
  avatarScreen: { x: number; y: number; onScreen: boolean; heightFrac: number };
  /** F-09 (spawn faces the void, the hub sits behind the player): true when at least
   *  one hub landmark — the cabin, the mission board, or a fixed beacon — is inside
   *  the live view frustum. The world-entry assert reads this to PROVE the spawn
   *  faces the hub (≥1 landmark in the first frame) rather than infer it from a
   *  soft-DOF pixel; a spawn that looked at empty heath would read false. The
   *  screenshot stays the court of appeal (AUDIT-FINDINGS §4). */
  landmarkInView: boolean;
  /** F-16 laptop dolly zoom: the fixed camera FOV (never changes — a dolly moves the
   *  boom, never the lens; the motion-comfort law). The zoom assert reads it constant
   *  across the zoom-in/zoom-out pair to prove no FOV kick. */
  fov: number;
  /** F-16 laptop dolly zoom read-back: the player-set WALK boom distance (`dist`, m,
   *  horizontal) clamped to its live bounds — `min` sits outside the avatar radius +
   *  near plane AND past the F-05 fade threshold (so a full zoom-in keeps the ranger
   *  solid, never translucent-murk), `max` the ~9.5 m ceiling. `dist` ∈ [min, max] is
   *  an invariant, so the wheel assert proves "respects both clamps" straight off the
   *  annotation: a scroll-in saturates `dist` to `min`, a scroll-out to `max`, while
   *  the fixed `fov` above stays put. The real 3D boom (`dist` at the top) is what the
   *  pixels show and outranks this if they ever disagree (§4). */
  zoom: { dist: number; min: number; max: number };
  /** F-17 laptop drag-orbit read-back: the PLAYER's look offset layered on the follow
   *  bearing — `yaw` (rad, free/wraps: a drag changes it, tap-to-walk never does) and
   *  `lift` (m of eye-lift, clamped, that tilts the pitch). A drag changing `yaw` while
   *  `pos` holds is the finding's assert; the real render `yaw` at the top of this type
   *  (from the camera quaternion) is what the pixels show and outranks this offset if the
   *  two ever disagree (§4). Zero at spawn and whenever a clean click walks. */
  orbit: { yaw: number; lift: number };
};

export interface RangerDevHook {
  readonly version: string;
  readonly screen: Screen;
  readonly missionView: MissionView;
  pos(): { x: number; z: number } | null;
  cameraYaw(): number | null;
  drawCalls(): number | null;
  clip(): { name: string; time: number } | null;
  /** The player ranger's LIVE world bounding-box height (m), measured from the
   *  real posed mesh — the honest scale signal the F-07 assert reads
   *  (avatar.height ∈ [1.5, 2.0]). It is the measured render size, NOT the
   *  normalization target, so the telemetry can never mask a mis-scaled rig
   *  (AUDIT-FINDINGS §4: pixels are the court of appeal). Null before the
   *  hook/world is ready. */
  avatar(): { height: number } | null;
  /** The player ranger's LIVE post-collision ground speed (m/s) — the honest
   *  walked speed AFTER the kinematic slide/clamp, which the walk clip's cadence
   *  is tied to (F-08). The assert reads it ∈ [1.4, 2.2] while `clip` = walk to
   *  prove the retuned foot speed is human-scaled, not the old near-jeep glide
   *  that slid the feet ~2.5× per stride. 0 while standing or in an in-place
   *  activity; null before the hook/world is ready. */
  groundSpeed(): number | null;
  /** The REAL render camera read back AFTER the frame update (F-05 ⊕ F-18): the
   *  live camera-to-subject boom length (`dist`), the yaw/pitch derived from the
   *  camera's own world quaternion (NOT the follow bearing), the camera's world
   *  position, what the boom anchors on (`avatar` on foot, `vehicle` when driving)
   *  and whether the ranger's whole bounding box sits inside the view frustum.
   *  F-18 proved the old telemetry could contradict the pixels (yaw moved between
   *  pixel-identical frames); these fields are measured off the actual camera, so
   *  a camera assert can never sit on a value the render never had. Null before
   *  the world/hook is ready. */
  cam(): CamState | null;
  /** The mission id the ranger is standing at (proximity), or null (W1.4). */
  nearId(): string | null;
  /** Every mission marker's world position, for E2E navigation (W1.4). */
  markers(): { x: number; z: number; missionId: string }[] | null;
  /** The spawn case-board hub: world position + live proximity, for E2E (W2.2). */
  board(): { x: number; z: number; near: boolean } | null;
  /** The "Ken je roep" sit-spot bench: world position + live proximity, for E2E
   *  (W6.4b2). */
  sitSpot(): { x: number; z: number; near: boolean } | null;
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
  /** The W7.2 adaptive-quality state: the resolved tier ('hoog'|'laag'), the
   *  live renderer pixelRatio, and the vegetation-density scale in force — lets
   *  the E2E assert the fps probe exposes a tier and its knobs are consistent.
   *  Null before the world is live. */
  quality(): { tier: 'hoog' | 'laag'; pixelRatio: number; vegetationScale: number } | null;
}

// Bumped at the W7.4 ship box: stamps the shipped world-first release so the
// deployed bundle is identifiable (the preview + live E2E assert this exact
// value, proving the site served the freshly-built app.js, not a stale cache).
const VERSION = '2.1.0-ship';

const state = {
  screen: 'title' as Screen,
  missionView: null as MissionView,
  pos: null as null | (() => { x: number; z: number }),
  cameraYaw: null as null | (() => number),
  drawCalls: null as null | (() => number),
  clip: null as null | (() => { name: string; time: number } | null),
  avatar: null as null | (() => { height: number } | null),
  groundSpeed: null as null | (() => number | null),
  cam: null as null | (() => CamState | null),
  nearId: null as null | (() => string | null),
  markers: null as null | (() => { x: number; z: number; missionId: string }[]),
  board: null as null | (() => { x: number; z: number; near: boolean } | null),
  sitSpot: null as null | (() => { x: number; z: number; near: boolean } | null),
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
  quality: null as null | (() => { tier: 'hoog' | 'laag'; pixelRatio: number; vegetationScale: number } | null),
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

/** Register the live avatar-scale source (the World's measured ranger bbox
 *  height). Pass null to clear (F-07). */
export function provideAvatar(fn: (() => { height: number } | null) | null): void {
  state.avatar = fn;
}

/** Register the live ground-speed source (the World's post-collision `playerSpeed`
 *  in m/s). Pass null to clear (F-08). */
export function provideGroundSpeed(fn: (() => number | null) | null): void {
  state.groundSpeed = fn;
}

/** Register the live real-camera read-back source (the World's `camState`, read
 *  off the actual render camera after the frame update). Pass null to clear
 *  (F-05 ⊕ F-18). */
export function provideCam(fn: (() => CamState | null) | null): void {
  state.cam = fn;
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

/** Register the live sit-spot source (the World). Pass null to clear (W6.4b2). */
export function provideSitSpot(
  fn: (() => { x: number; z: number; near: boolean } | null) | null,
): void {
  state.sitSpot = fn;
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

/** Register the W7.2 adaptive-quality state source (the World). Pass null to clear. */
export function provideQuality(
  fn: (() => { tier: 'hoog' | 'laag'; pixelRatio: number; vegetationScale: number } | null) | null,
): void {
  state.quality = fn;
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
    avatar: () => (state.avatar ? state.avatar() : null),
    groundSpeed: () => (state.groundSpeed ? state.groundSpeed() : null),
    cam: () => (state.cam ? state.cam() : null),
    nearId: () => (state.nearId ? state.nearId() : null),
    markers: () => (state.markers ? state.markers() : null),
    board: () => (state.board ? state.board() : null),
    sitSpot: () => (state.sitSpot ? state.sitSpot() : null),
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
    quality: () => (state.quality ? state.quality() : null),
  };
  (window as unknown as { __ranger: RangerDevHook }).__ranger = hook;
  return true;
}
