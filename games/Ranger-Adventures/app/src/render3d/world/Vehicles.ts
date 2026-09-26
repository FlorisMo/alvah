/**
 * world/Vehicles.ts — the drivable jeep, the opt-in helicopter and its two pads.
 *
 * Placement (each parked as a solid collision circle), the proximity prompts, the
 * interact dispatch (Space: in / out / land), the per-frame arcade drive and damped
 * flight (the pure maths live in core/vehicle.ts and core/heli.ts), the jeep's dust
 * and the dev read-backs. The ranger rides hidden at the vehicle's spot; everything
 * the vehicles need from the rest of the world goes through the narrow `VehicleHost`.
 */

import * as THREE from 'three';
import { livePolicy } from '../MotionMode';
import { loadModel, prepModel } from '../Models';
import type { Biome } from '../Biomes';
import { resolveMove, type MoveLimits, type Obstacle } from '../CharacterController';
import { driveStep, driveCaps, calmSpeed, rampSpeed, comfortSteer, ANIMAL_SLOW_RADIUS } from '../../core/vehicle';
import {
  flyStep, heliVignette, heliAvailable,
  HELI_CRUISE_HEIGHT, HELI_PAD_HEIGHT, HELI_CAPS, HELI_ROLL,
} from '../../core/heli';
import { Sound } from '../../core/sound';
import { store } from '../../core/state';
import type { Terrain } from './Terrain';
import { enableCast, proceduralTotem } from './props';

// W5.1 jeep: its collision radius while parked, and the proximity radius that
// surfaces the "Stap in" affordance (a touch wider than the 2.4 m marker radius —
// the jeep is a bigger object the ranger walks up to).
export const JEEP_COLLIDE = 1.6;
const JEEP_NEAR_R = 3.6;
// P1.5b jeep ground contact (runs/animation-research.md §4.5: a damped
// hover, NEVER a hard per-frame Y-snap). The jeep's Y EASES toward the raycast ground
// target each frame instead of clamping exactly to it — the old snap welded it to every
// undulation (the "magnetically welded" stick Floris felt). The rate converges in ~0.1 s:
// small enough that the jeep visually hugs the ground, large enough that its Y is a
// smoothed suspension glide, not a lockstep terrain trace. Frame-rate independent.
const JEEP_HOVER_RATE = 10;   // 1/s exponential approach of the jeep Y toward the ground target
// The jeep's grounded band is wider than the walker's tight feet band: the hover lets Y
// lag the target a little (that lag IS the smoothing) and a suspension rides a touch into
// or above the surface. Below −SINK it has dropped THROUGH the ground; above +AIR it has
// launched off a crest — either bound failing means "not grounded" (the dev-hook court).
const JEEP_SINK_TOL = 0.5;    // may ride up to 0.5 m below the surface (compress / uphill lag)
const JEEP_AIR_TOL = 1.0;     // and up to 1.0 m above it (crest / downhill lag) before airborne

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

/** What the vehicles need from the rest of the world. */
export interface VehicleHost {
  /** The ranger's group: he rides hidden at the vehicle's spot and steps out beside it. */
  readonly ranger: THREE.Group;
  /** Seat / unseat the ranger's locomotion (a still `sit` clip while riding). */
  seat(seated: boolean): void;
  /** Stepping out: drop any walk target at (x,z) and stand still. */
  stopWalk(x: number, z: number): void;
  /** The held keys + joystick as a screen vector (y = throttle, x = steer). */
  intent(): { x: number; y: number };
  /** Point the follow camera behind `yaw`; `snap` also cuts the eased bearing there. */
  follow(yaw: number, snap: boolean): void;
  /** Boarding / stepping out re-frames the camera as a cut. */
  recut(): void;
  /** Boarding: drop the walk-time marker + hub prompts. */
  clearWalkPrompts(): void;
  /** The ambience follows the biome under the vehicle. */
  crossBiome(biome: Biome): void;
  /** Distance to the nearest roaming animal (the jeep's calm rule). */
  nearestAnimalDist(x: number, z: number): number;
  /** The camera offsets (walk / jeep / heli) the read-backs report. */
  camOffsets(): { walk: THREE.Vector3; vehicle: THREE.Vector3; heli: THREE.Vector3 };
}

export class Vehicles {
  // W5.1 drivable jeep: a solid parked prop the ranger walks up to ("Stap in"),
  // then drives arcade-kinematic (heading-based, rate-clamped, terrain-stuck)
  // with a WIDER follow-cam; "Stap uit" drops him beside it. Kept OUT of
  // `markers` so it never pollutes wayfinding or the "nearest mission" proximity
  // the E2E steers to (same reasoning as the case-board + scenic actors).
  jeep: THREE.Group | null = null;
  jeepPos: THREE.Vector3 | null = null;   // === jeep.position (x/z the controller drives)
  private jeepHeading = 0;                         // yaw the arcade controller steers
  private jeepHeadingUnwrapped = 0;                // F-32: cumulative (never wrapped) yaw the
                                                   //   steering assert reads — a whole turn can
                                                   //   never alias away between samples (F-18)
  private jeepObstacle: Obstacle | null = null;    // its collision circle while parked
  inVehicle = false;
  nearJeep = false;
  private vehicleSpeed = 0;                         // live signed speed (m/s), for the dev hook
  private vehicleNearAnimal = false;                // W5.2: within the auto-slow radius of an animal
  private onJeepNear: (near: boolean) => void = () => {};
  private onVehicleChange: (inVehicle: boolean) => void = () => {};
  // W5.3b helicopter (opt-in, unavailable under reduced-motion): a parked prop the
  // ranger walks up to on a helipad, "Stap in" lifts off to a fixed cruise height
  // (exp-damped ≤ 2 m/s climb, always-level horizon, damped yaw only), and landing
  // at either pad steps back out. The pure flight maths live in core/heli.ts; World
  // owns placement, collision (shared resolveMove), the follow-cam and the overlay.
  heli: THREE.Group | null = null;
  heliPos: THREE.Vector3 | null = null;     // === heli.position (x/z driven; y = ground + altitude)
  private heliHeading = 0;                           // yaw (the only rotation)
  private heliAltitude = 0;                          // metres above the ground plane
  private heliObstacle: Obstacle | null = null;      // its collision circle while parked on a pad
  inHeli = false;
  nearHeli = false;
  private heliLanding = false;                        // descend-to-pad in progress → exit on touchdown
  private heliSpeed = 0;                              // live signed horizontal speed (m/s)
  private heliClimbRate = 0;                          // live signed vertical speed (m/s)
  private heliVignetteVal = 0;                        // live motion-vignette opacity (0 at hover)
  private readonly helipads: { x: number; z: number }[] = [];
  private onHeliNear: (near: boolean) => void = () => {};
  private onHeliChange: (inHeli: boolean) => void = () => {};
  private onHeliFrame: (vignette: number) => void = () => {};
  private heliOptInSource: () => boolean = () => false; // Instellingen "Helikopter" toggle, read live
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
  dustEmitting = false;                      // emitted this frame (dev hook: off under reduced-motion)
  private static readonly DUST_N = 40;

  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly terrain: Terrain;
  private readonly obstacles: Obstacle[];
  private readonly limits: MoveLimits;
  private readonly host: VehicleHost;

  constructor(
    env: { scene: THREE.Scene; camera: THREE.PerspectiveCamera; terrain: Terrain; obstacles: Obstacle[]; limits: MoveLimits },
    host: VehicleHost,
  ) {
    this.scene = env.scene;
    this.camera = env.camera;
    this.terrain = env.terrain;
    this.obstacles = env.obstacles;
    this.limits = env.limits;
    this.host = host;
  }

  /** The drawn ground height (the one ground truth, world/Terrain.ts). */
  private groundY(x: number, z: number): number {
    return this.terrain.y(x, z);
  }

  /** The interact key (W5.1/W5.3b): the jeep and the heli own it while riding (Space =
   *  step out / land) and when standing beside a parked one (Space = climb in); they
   *  win over the hub/marker affordances. False when no vehicle takes the key. */
  interact(): boolean {
    if (this.inVehicle) { this.exitVehicle(); return true; }
    if (this.inHeli) { this.landHeli(); return true; } // W5.3b: Space while flying → land at a pad
    if (this.nearJeep) { this.enterVehicle(); return true; }
    // W5.3b: standing beside the parked helicopter → lift off (no-op + a calm
    // "aan de grond" message under reduced-motion / when the toggle is UIT; the
    // HUD reads `heliState().available` to decide what it shows).
    if (this.nearHeli) { this.enterHeli(); return true; }
    return false;
  }

  /** Walking near a parked jeep surfaces "Stap in" (W5.1), near the parked heli "Stap in
   *  de helikopter" (W5.3b). Suppressed while riding either one. */
  updateProximity(x: number, z: number): void {
    if (this.jeep && this.jeepPos && !this.inVehicle && !this.inHeli) {
      const nj = Math.hypot(this.jeepPos.x - x, this.jeepPos.z - z) < JEEP_NEAR_R;
      if (nj !== this.nearJeep) { this.nearJeep = nj; this.onJeepNear(nj); }
    }
    if (this.heli && this.heliPos && !this.inHeli && !this.inVehicle) {
      const nh = Math.hypot(this.heliPos.x - x, this.heliPos.z - z) < HELI_NEAR_R;
      if (nh !== this.nearHeli) { this.nearHeli = nh; this.onHeliNear(nh); }
    }
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

  /**
   * W5.1: place the drivable jeep at a sand-track head in the stuifzand sector
   * (§4, NE), parked facing the clearing. It pushes a solid collision circle
   * while parked (the ranger walks up to it), kept OUT of `markers`. The spot is
   * off the frozen −z movement-smoke corridor and clear of the spawn clearing.
   */
  placeJeep(): void {
    const x = 16, z = 14, height = 1.9; // stuifzand NE; ~21 m from spawn, +z off the smoke corridor
    const group = new THREE.Group();
    group.position.set(x, this.groundY(x, z), z); // on the drawn ground: the drive begins grounded
    this.jeepHeading = Math.atan2(-x, -z); // parked facing the clearing (like the landmarks)
    group.rotation.y = this.jeepHeading;
    group.add(proceduralTotem('#6a7b4a')); // instant stand-in until the GLB streams in
    this.scene.add(group);
    this.jeepObstacle = { x, z, r: JEEP_COLLIDE };
    this.obstacles.push(this.jeepObstacle);
    this.jeep = group;
    this.jeepPos = group.position;
    void loadModel('vehicle-ranger-jeep').then((m) => {
      if (!m) return;
      const prepped = prepModel(m, height);
      enableCast(prepped); // W4.5: a solid hero prop near the player casts a shadow
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
  placeHelipads(): void {
    const PADS = [
      { x: 24, z: 22 },    // stuifzand NE apron — the aviation area, heli parked here
      { x: -46, z: -22 },  // by the BOA-post on the western rim
    ];
    for (const p of PADS) {
      const disc = Vehicles.makeHelipad();
      disc.position.set(p.x, this.groundY(p.x, p.z) + 0.02, p.z);
      this.scene.add(disc);
      this.helipads.push({ x: p.x, z: p.z });
    }
    const pad = PADS[0];
    const group = new THREE.Group();
    group.position.set(pad.x, this.groundY(pad.x, pad.z), pad.z);
    this.heliHeading = Math.atan2(-pad.x, -pad.z); // parked facing the clearing
    group.rotation.y = this.heliHeading;
    group.add(proceduralTotem('#8a8f98')); // instant stand-in until the GLB streams in
    this.scene.add(group);
    this.heliObstacle = { x: pad.x, z: pad.z, r: HELI_COLLIDE };
    this.obstacles.push(this.heliObstacle);
    this.heli = group;
    this.heliPos = group.position;
    this.heliAltitude = HELI_PAD_HEIGHT;
    void loadModel('vehicle-helicopter').then((m) => {
      if (!m) return;
      const prepped = prepModel(m, 2.6);
      enableCast(prepped);
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

  /** Dev-hook accessor (W5.1): the drivable jeep's live state — placement,
   *  proximity, whether the ranger is driving, world position + heading, the
   *  active arcade caps (reduced-motion halves them), the wider camera offset and
   *  the comfort invariants (fixed FOV, roll 0) the E2E asserts. Null before the
   *  jeep is placed. */
  vehicleState(): {
    placed: boolean; near: boolean; inVehicle: boolean;
    x: number; z: number; y: number; heading: number; headingUnwrapped: number;
    grounded: boolean; clearance: number;
    speed: number; maxSpeed: number; turnRate: number;
    camDist: number; camHeight: number; fov: number; roll: number;
    nearAnimal: boolean; dust: boolean; driverHidden: boolean;
  } | null {
    if (!this.jeep || !this.jeepPos) return null;
    const caps = driveCaps(livePolicy().reduced);
    const offs = this.host.camOffsets();
    const off = this.inVehicle ? offs.vehicle : offs.walk;
    // P1.5b: the jeep's live ground contact — its world Y against the drawn surface
    // directly under it, read by an independent downward ray onto the ground mesh.
    // Sitting still, `clearance` ≈ 0; while driving relief the damped hover lets it lag
    // a little (that lag IS the smoothing — never a hard snap). `grounded` = the ray hit
    // AND the clearance sits in the jeep suspension band.
    const rayY = this.terrain.raycastY(this.jeepPos.x, this.jeepPos.z);
    const jeepSurfaceY = Number.isFinite(rayY) ? rayY : this.groundY(this.jeepPos.x, this.jeepPos.z);
    const jeepClearance = this.jeepPos.y - jeepSurfaceY;
    const jeepGrounded = Number.isFinite(rayY) && jeepClearance >= -JEEP_SINK_TOL && jeepClearance <= JEEP_AIR_TOL;
    // TRUE roll = tilt of the camera's right vector off horizontal. `camera.up` is
    // pinned to world-up and lookAt derives the basis from it, so right lies in the
    // xz-plane → right.y ≈ 0 at ANY yaw/pitch. (camera.rotation.z is NOT roll here —
    // the pitched+yawed Euler couples the axes, the same trap cameraYaw() avoids.)
    this.camera.updateMatrixWorld();
    const rightY = this.camera.matrixWorld.elements[1]; // column 0, row 1 = right.y
    return {
      placed: true, near: this.nearJeep, inVehicle: this.inVehicle,
      x: this.jeepPos.x, z: this.jeepPos.z, y: this.jeepPos.y, heading: this.jeepHeading,
      headingUnwrapped: this.jeepHeadingUnwrapped,
      grounded: jeepGrounded, clearance: jeepClearance,
      speed: this.vehicleSpeed, maxSpeed: caps.maxSpeed, turnRate: caps.turnRate,
      camDist: off.z, camHeight: off.y, fov: this.camera.fov, roll: rightY,
      nearAnimal: this.vehicleNearAnimal, dust: this.dustEmitting,
      // F-31: true only while actually riding the jeep with the ranger mesh hidden
      // (the sanctioned fallback). Read off the REAL `.visible`, so it can never
      // claim a hidden driver the render did not hide (§4: telemetry stays honest).
      driverHidden: this.inVehicle && !this.host.ranger.visible,
    };
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
      camDist: this.host.camOffsets().heli.z, camHeight: this.host.camOffsets().heli.y,
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

  /** W5.1: climb into the parked jeep — arcade drive mode takes over movement and
   *  the wider follow-cam eases in; the ranger rides hidden. The parked collision
   *  circle is lifted so the jeep can move. No-op unless standing beside it. */
  enterVehicle(): void {
    if (this.inVehicle || !this.jeep || !this.jeepPos) return;
    this.inVehicle = true;
    this.jeepHeading = this.jeep.rotation.y;
    this.jeepHeadingUnwrapped = 0;   // F-32: fresh drive → measure steering drift from entry
    this.vehicleSpeed = 0;
    if (this.jeepObstacle) {
      const i = this.obstacles.indexOf(this.jeepObstacle);
      if (i >= 0) this.obstacles.splice(i, 1);
      this.jeepObstacle = null;
    }
    this.host.ranger.visible = false;                       // he rides inside
    // F-31: he is now SEATED, not idling — freeze locomotion so `clip` reports a
    // still `sit` (never idle/walk) for every in-vehicle frame, killing the empty-
    // jeep story-lie. He rides hidden under the jeep's canopy (the sanctioned
    // "verifiably hidden" fallback — the cabin roof occludes a driver from the
    // F-30 chase cam anyway); `vehicleState().driverHidden` proves it to the assert.
    this.host.seat(true);
    // F-30: re-anchor the (hidden) ranger AT the jeep now, so the boarding CUT frames
    // the jeep itself, not the boarding spot ~2 m to its side (driveJeep keeps him
    // pinned here every frame after, so the follow-cam + step-out anchor track the jeep).
    this.host.ranger.position.copy(this.jeepPos);
    this.host.ranger.rotation.y = this.jeepHeading;
    // clear any walk-time affordances so nothing lingers behind the "Stap uit" pill
    this.host.clearWalkPrompts();
    // snap the follow bearing behind the parked jeep so the boarding reframe is a clean
    // CUT, never a swing from the old walk facing; the eased jeep-follow takes over next
    // frame (damped toward jeepHeading — F-30 wants a lagged follow, not a hard lock).
    this.host.follow(this.jeepHeading, true);
    this.onVehicleChange(true);
    // W5.2: soft engine loop while driving (gated on the sound setting; the
    // Space-to-enter gesture already unlocked the AudioContext).
    if (store.get().settings.geluid) Sound.engineStart();
    // F-30: boarding is a CUT for EVERYONE, not only under reduced-motion — the walk
    // boom → wider jeep chase-cam reframe is exactly the kind of camera MOVE the
    // motion-comfort law turns into a step. Snap straight to the jeep cam; pass the
    // live reduced flag through so the fade/orbit handling stays correct.
    this.host.recut();
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
    this.host.ranger.position.set(next.x, this.groundY(next.x, next.z), next.z); // step out onto the drawn ground
    this.host.ranger.rotation.y = h;
    this.host.ranger.visible = true;
    this.host.seat(false);       // F-31: back on foot — locomotion resumes (idle)
    this.host.stopWalk(next.x, next.z);   // no stale walk target, standing still
    this.host.follow(h, true); // snap the bearing behind the exit facing so the step-out is a CUT too
    this.vehicleSpeed = 0;
    // re-park the jeep as a solid obstacle at its new resting spot
    this.jeepObstacle = { x: jx, z: jz, r: JEEP_COLLIDE };
    this.obstacles.push(this.jeepObstacle);
    this.nearJeep = true;                  // standing right beside it → "Stap in" again
    this.vehicleNearAnimal = false;
    this.dustEmitting = false;
    Sound.engineStop();                    // W5.2: engine falls silent on step-out
    this.onVehicleChange(false);
    // F-30: stepping out hands straight back to the walk boom as a CUT for EVERYONE
    // (symmetry with boarding; the motion-comfort law prefers cuts to reframe moves).
    this.host.recut();
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
    this.host.ranger.visible = false;                       // he rides inside
    this.host.clearWalkPrompts();
    this.host.follow(this.heliHeading, false);
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
    this.host.ranger.position.set(next.x, this.groundY(next.x, next.z), next.z); // step out onto the drawn ground
    this.host.ranger.rotation.y = h;
    this.host.ranger.visible = true;
    this.host.stopWalk(next.x, next.z);      // no stale walk target, standing still
    this.host.follow(h, false);
    this.heliSpeed = 0; this.heliClimbRate = 0; this.heliVignetteVal = 0;
    this.heliObstacle = { x: hx, z: hz, r: HELI_COLLIDE };
    this.obstacles.push(this.heliObstacle);
    this.nearHeli = true;                     // standing right beside it → "Stap in" again
    this.onHeliChange(false);
    this.onHeliFrame(0);                       // clear the motion vignette
  }

  /**
   * W5.1: advance the jeep one frame in arcade-kinematic drive mode. The SAME
   * `screenVector` the walker reads becomes throttle (y) + steer (x); the pure
   * `driveStep` core turns them into a heading + move delta (rate-clamped, caps
   * halved under reduced-motion), which the SAME `resolveMove` resolves for
   * collision/rim/water. The jeep sticks to the terrain and the ranger rides
   * hidden at its spot so the follow-cam + step-out anchor track it.
   */
  driveJeep(dt: number): void {
    if (!this.jeep || !this.jeepPos) return;
    const reduced = livePolicy().reduced;
    const intent = this.host.intent();
    const caps = driveCaps(reduced);
    // F-32 comfort tuning (jeep only — the shared driveStep core + the heli stay
    // untouched, and the frozen turnRate/maxSpeed caps are unchanged):
    //  (1) ACCEL RAMP: ease the live speed toward the throttle's target over ~1 s
    //      instead of snapping to the cap on frame one. Feed the ramped speed back
    //      in as an effective throttle so the pure core drives at the built-up pace.
    //  (2) SPEED-SCALED STEER: scale the steer by how fast the jeep is really moving
    //      so a held turn key can never pivot it in place (the audit's spin-top).
    // `this.vehicleSpeed` (the calm-capped live speed) is the ramp's carried state,
    // so leaving an animal's slow-radius re-accelerates smoothly from the crawl.
    const ramped = rampSpeed(this.vehicleSpeed, intent.y, dt, caps);
    const effThrottle = caps.maxSpeed !== 0 ? ramped / caps.maxSpeed : 0;
    const effSteer = comfortSteer(intent.x, ramped, caps);
    const step = driveStep(this.jeepHeading, { throttle: effThrottle, steer: effSteer }, dt, caps);
    this.jeepHeading = step.heading;
    // F-32: accumulate the UNWRAPPED heading from the exact yaw delta driveStep applied
    // (heading -= steer·turnRate·dt), the honest steering signal the control-condition
    // assert reads — no turn key ⇒ drift 0, a held turn ⇒ a monotonic change.
    this.jeepHeadingUnwrapped += -effSteer * caps.turnRate * dt;
    const jp = this.jeepPos;
    // W5.2 calm rule: auto-slow to a crawl within reach of any wandering animal so
    // it never panic-flees. The pure `calmSpeed` caps the signed speed; scaling the
    // move delta by the same factor keeps the heading + terrain stick intact.
    const animalDist = this.host.nearestAnimalDist(jp.x, jp.z);
    this.vehicleNearAnimal = animalDist <= ANIMAL_SLOW_RADIUS;
    const capped = calmSpeed(step.speed, animalDist);
    const k = step.speed !== 0 ? capped / step.speed : 1;
    this.vehicleSpeed = capped;
    const next = resolveMove(jp.x, jp.z, jp.x + step.dx * k, jp.z + step.dz * k, this.obstacles, this.limits);
    jp.x = next.x; jp.z = next.z;
    // P1.5b ground contact: EASE the jeep's Y toward the ground with a damped hover
    // (research §4.5), never a hard per-frame snap — the snap welded the jeep to every
    // undulation (the "magnetically welded" stick). The exponential approach smooths it
    // into a suspension-like glide that still hugs the ground. Frame-rate independent.
    const targetY = this.groundY(next.x, next.z);
    jp.y += (targetY - jp.y) * (1 - Math.exp(-JEEP_HOVER_RATE * dt));
    this.jeep.rotation.y = this.jeepHeading;
    // the ranger rides along (hidden) so CameraRig.place + exitVehicle anchor track it
    this.host.ranger.position.set(jp.x, jp.y, jp.z);
    this.host.ranger.rotation.y = this.jeepHeading;
    this.host.follow(this.jeepHeading, false);
    // W5.2: rev the engine loop by drive fraction (gated on the sound setting) and
    // kick up dust behind the jeep when it is moving with any pace — off under
    // reduced-motion (dust is secondary motion; the engine hum stays, it is audio).
    if (store.get().settings.geluid) Sound.engineSet(Math.abs(capped) / caps.maxSpeed);
    this.dustEmitting = !reduced && Math.abs(capped) > 1.2;
    if (this.dustEmitting) this.emitDust(jp.x, jp.y, jp.z, this.jeepHeading);
    // ambience still follows across biomes while driving
    this.host.crossBiome(this.terrain.biome(jp.x, jp.z));
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
  flyHeli(dt: number): void {
    if (!this.heli || !this.heliPos) return;
    const intent = this.host.intent();
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
    this.host.ranger.position.set(hp.x, hp.y, hp.z);
    this.host.ranger.rotation.y = this.heliHeading;
    this.host.follow(this.heliHeading, false);
    this.heliVignetteVal = heliVignette(step.speed, step.climbRate);
    this.onHeliFrame(this.heliVignetteVal);
    // touchdown: the landing descent has reached the pad → step out
    if (this.heliLanding && this.heliAltitude <= HELI_PAD_HEIGHT + 0.2) {
      this.exitHeli();
      return;
    }
    // ambience still follows across biomes while flying
    this.host.crossBiome(this.terrain.biome(hp.x, hp.z));
  }

  /** W5.2: build the single dust Points cloud (1 draw call, hidden while idle). A
   *  small fixed pool of particles is recycled round-robin; per-particle age/life
   *  attributes drive a shader-side fade so one buffer covers every puff. */
  private initDust(): void {
    const N = Vehicles.DUST_N;
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
      this.dustNext = (this.dustNext + 1) % Vehicles.DUST_N;
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
  updateDust(dt: number): void {
    if (!this.dust || !this.dustPos || !this.dustVel || !this.dustAge || !this.dustLife) return;
    let anyAlive = false;
    for (let i = 0; i < Vehicles.DUST_N; i++) {
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
}
