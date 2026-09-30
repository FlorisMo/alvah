/**
 * world/Vehicles.ts — the drivable jeep, the opt-in helicopter and its two helipads.
 *
 * Placement (each parked vehicle is solid: its footprint circles join the collision
 * list), the proximity prompts, the interact dispatch (in / out / land), the per-frame
 * arcade drive and damped flight (the pure maths live in core/vehicle.ts and
 * core/heli.ts), the jeep's dust and the dev read-backs.
 *
 * Wave 2 (2026-09-27), what makes them feel like real, calm vehicles:
 *  - both GLBs are turned where the model is prepared (`MODEL_YAW`), so the nose
 *    points along the heading they travel;
 *  - the jeep's whole BODY collides (three circles), brakes softly toward whatever is
 *    ahead, and slides along it; the people are solid too, mission markers are zones it
 *    bends round, and (run 6) the roaming animals are neither: it gives way to them;
 *  - the wheels rest on the drawn ground (height + pitch + roll of the MODEL; the
 *    camera never rolls);
 *  - the ranger SITS in the driver's seat / the pilot's seat, seen, never hidden;
 *  - the dust is a low, faint haze behind the rear wheels;
 *  - the helicopter lands on real-looking helipads, is guided to them, and the "Land"
 *    button always brings it down on the nearest pad (it never gets stuck flying).
 */

import * as THREE from 'three';
import { livePolicy } from '../MotionMode';
import { loadModel, prepModel } from '../Models';
import { SIZE, sizeRow } from '../AnimalScale';
import type { Biome } from '../Biomes';
import type { MoveLimits, Obstacle } from '../CharacterController';
import { resolveMove } from '../CharacterController';
import { wayfind, type WayCue } from '../Wayfinding';
import {
  driveCaps, driveIntent, vehicleDt, jeepStep, resolveBody, wheelContact, bodyReach, bodyOverlap, bodyWet, parkOutOf,
  JEEP_BODY, type BodyCircle, type Solid, type YieldAnimal, type JeepWorld, type HomePlace,
} from '../../core/vehicle';
import {
  flyStep, heliVignette, heliAvailable, heliRamp, landingAltitude,
  HELI_CRUISE_HEIGHT, HELI_PAD_HEIGHT, HELI_CAPS, HELI_ROLL, HELI_BODY, HELI_REACH,
} from '../../core/heli';
import { predictJeep, PATH_DT, PATH_N, PATH_STRIDE, type JeepRead } from '../../core/wildlife';
import { Sound } from '../../core/sound';
import { store } from '../../core/state';
import type { Terrain } from './Terrain';
import { enableCast, proceduralTotem } from './props';

// Both vehicle GLBs were modelled nose-first along their local −x; the game's heading
// points a model's local +z (rotation.y = heading, forward = (sin, cos)). A quarter
// turn where the model is prepared makes the nose lead (audit veh-01: the jeep was
// 1.87 m along its travel and 3.65 m across it — it drove sideways).
const MODEL_YAW = Math.PI / 2;

// W5.1 jeep: its rough bounding radius (the chase camera keeps its lens outside it),
// and the proximity radius that surfaces the "Stap in" affordance (from its centre).
export const JEEP_COLLIDE = 1.6;
const JEEP_NEAR_R = 3.6;
// The jeep's home: on the stuifzand 14 m east of the spawn, ≥ 15 m from every mission
// marker (audit veh-09: it used to park ON "Het stille zand"), facing away from the
// clearing (verifier V1: faced at the first mission it drove straight into the
// Missiebord, and stepping out there buried the walk camera). It looks at the
// helicopter on pad A, 25 m ahead over open sand: a first push on the gas drives toward
// it and eases round the pad (a keep-out zone), leaving the helicopter on the driver's
// side — so after "Stap uit" the walk to it leads away from the parked jeep instead of
// round it (a parked body between the walk camera and the ranger folds the camera in;
// played clean for drives of 14-25 m). Aimed a hair right of
// the pad's centre, so it always eases round the same side. The ranger walks up from
// the spawn behind it, the warden ≥ 4 m off his path.
const JEEP_HOME = { x: 14, z: 0, faceX: 32, faceZ: 18.4 };
// P1.5b ground contact: the body eases toward the wheels' ground each frame (a damped
// suspension glide, never a hard per-frame snap). Converges in ~0.1 s.
const JEEP_HOVER_RATE = 10;
// The grounded band the dev hook judges (the hover lets Y lag a little on relief).
const JEEP_SINK_TOL = 0.5;
const JEEP_AIR_TOL = 1.0;
// A walker keeps this much extra room from a parked vehicle's footprint circles.
const WALKER_ROOM = 0.3;
/** Run 6 polish: why the jeep stands with the gas on (the HUD's line): animals it gives way
 *  to, something solid (a trunk, a wall, the water), the forest edge. */
export type JeepStall = 'dieren' | 'vast' | 'rand';
/** …said once it has stood this long (s) with the gas held. */
const STALL_S = 2;

// W5.3b helicopter: the pad-proximity radius that surfaces "Stap in de helikopter",
// and how close (horizontally) it must be to a pad for "Land hier".
const HELI_NEAR_R = 4.0;
const PAD_LAND_R = 6.0;
/** The radius (m) of a drawn helipad. */
export const PAD_RADIUS = 3.2;
const DEPART_CLEAR = 15;
// In the air the helicopter stays this far inside the move bound, out of the rim trees.
const HELI_RIM_KEEP = 8;
// Above this altitude (m) the flying helicopter is over every trunk and roof; below
// it (lifting off, touching down) its body collides like the jeep's.
const HELI_AIRBORNE_Y = 2.5;
// The two helipads: flat, open, ≥ 9 m from every marker and ≥ 6 m from every solid.
// A: the stuifzand apron beyond the jeep (the helicopter parks here); B: the heath by
// the BOA-post on the western side (the old A had a juniper on it, the old B a slope).
export const PADS: readonly { readonly x: number; readonly z: number }[] = [
  { x: 32, z: 18 },
  { x: -44, z: -26 },
];

// Where the rider sits, in the vehicle's own frame: x = left, y = up from the ground
// the body rests on, z = forward. The Dutch driver's seat is on the left. In the
// helicopter (3.3 m, AnimalScale) he sits behind its side window and canopy, his head
// at ≈ 2 m, so he shows through the glass (`glazeCanopy`).
const JEEP_SEAT = new THREE.Vector3(0.36, 0.48, -0.22);
const HELI_SEAT = new THREE.Vector3(0.38, 1.25, 1.0);
// The helicopter's chase camera looks at it a little from the pilot's (left) side, so
// the boy shows in its side window (straight behind, only its closed back shows). A
// fixed framing: the camera follows the heading exactly as calmly as before. (A bearing
// below the heading puts the lens behind his left shoulder.)
const HELI_CHASE_YAW = -0.45;
// Stepping out, he stands this far to the side of the vehicle's centre: clear of its
// body (the jeep ≈ 0.9 m half-wide, the helicopter's skids ≈ 1.05).
const JEEP_STEP_OUT = 2.4;
const HELI_STEP_OUT = 2.8;
// The seated pose of the ranger rig (ranger-alvah): absolute bone turns (Euler XYZ),
// its idle stance with the thighs forward, the knees bent and the hands on the wheel.
// Absolute, so boarding mid-stride still sits straight. A rig without these bones
// (the procedural stand-in before the GLB streams in) rides hidden instead.
const SIT_POSE: Record<string, [number, number, number]> = {
  Hips: [-0.46, 0.01, -0.06], Spine: [-0.16, -0.02, 0.01], Spine01: [0, 0, 0], Spine02: [0.27, 0, 0.07],
  LeftUpLeg: [-4.34, -0.16, -0.18], RightUpLeg: [-4.33, 0.12, 0.07],
  LeftLeg: [1.45, 0.06, 0.06], RightLeg: [1.47, -0.07, -0.07],
  LeftFoot: [-0.96, -0.12, -0.18], RightFoot: [-0.98, 0.12, 0.2],
  LeftArm: [0.23, 1.31, 0.04], RightArm: [0.19, -1.25, -0.04],
  LeftForeArm: [-1.36, -0.36, 0.12], RightForeArm: [-1.29, 0.38, -0.24],
  neck: [0.16, 0.01, -0.01], Head: [0.74, 0, -0.01],
};

// The people, as the jeep sees them (solid: it brakes for them and slides along them).
const PERSON_R = 0.45;   // the warden, the poacher
// A mission marker is a keep-out zone for vehicles: the jeep bends round it and parks
// ≥ 6 m from the marker (audit veh-09 / B3: a jeep parked on or by a marker hid its
// prompt, sat in the mini-game's stage and collapsed the walk camera).
export const MARKER_R = 5.2;
// A roaming animal's footprint for the give-way brake: half its nose-to-tail length
// (the scale table), so a boar met broadside or end-on is both covered.
const animalR = (id: string): number => Math.max(0.2, (sizeRow(id)?.len ?? 1) / 2);

/** What the vehicles need from the rest of the world. */
export interface VehicleHost {
  /** The ranger's group: he sits in the vehicle's seat and steps out beside it. */
  readonly ranger: THREE.Group;
  /** Seat / unseat the ranger's locomotion (a still `sit` clip while riding). */
  seat(seated: boolean): void;
  /** Stepping out: drop any walk target at (x,z) and stand still. */
  stopWalk(x: number, z: number): void;
  /** The held keys + joystick as a screen vector (y = forward, x = right): the heli. */
  intent(): { x: number; y: number };
  /** The jeep's controls: the held keys as tank axes (null when none are held) and the
   *  touch stick (null when untouched). */
  controls(): { keys: { turn: number; fwd: number } | null; stick: { x: number; y: number } | null };
  /** Point the follow camera behind `yaw`; `snap` also cuts the eased bearing there. */
  follow(yaw: number, snap: boolean): void;
  /** Boarding / stepping out re-frames the camera as a cut. */
  recut(): void;
  /** Boarding: drop the walk-time marker + hub prompts. */
  clearWalkPrompts(): void;
  /** The ambience follows the biome under the vehicle. */
  crossBiome(biome: Biome): void;
  /** The camera offsets (walk / jeep / heli) the read-backs report. */
  camOffsets(): { walk: THREE.Vector3; vehicle: THREE.Vector3; heli: THREE.Vector3 };
  /** Visit the people (warden, poacher) where they stand now: solid for a vehicle.
   *  Called every frame: it must not allocate (review PERF-2). */
  people(visit: (x: number, z: number) => void): void;
  /** Visit the roaming ground animals (id + where they are now): never solid for a
   *  vehicle, the jeep gives way to them. `size`: the scale-table key when `id` is not
   *  one (a home's animal, `<mission>:<key>`). Called every frame: it must not allocate. */
  animals(visit: (id: string, x: number, z: number, size?: string) => void): void;
  /** The mission markers (read every frame: the live list, not a copy). */
  markers(): readonly { readonly pos: { readonly x: number; readonly z: number } }[];
}

export class Vehicles {
  // W5.1 drivable jeep: a solid parked prop the ranger walks up to ("Stap in"), then
  // drives arcade-kinematic with a wider follow-cam; "Stap uit" drops him beside it.
  // Kept OUT of `markers` so it never pollutes wayfinding or the mission proximity.
  jeep: THREE.Group | null = null;
  jeepPos: THREE.Vector3 | null = null;   // === jeep.position (x/z the controller drives)
  private jeepHeading = 0;
  private jeepHeadingUnwrapped = 0;       // F-32: cumulative yaw (never wrapped) since boarding
  private jeepPitch = 0;                  // nose-up tilt of the model on a slope (rad)
  private jeepRoll = 0;                   // left-up tilt of the model on a side slope (rad)
  private jeepContact = false;            // the body touched a solid this frame
  private jeepBraked = false;             // a brake held it back while the gas was on
  private jeepParked: Obstacle[] = [];    // its footprint circles while parked
  // run 6 polish: the parked jeep as the walk lens sees it (CameraRig.parkedJeep; one
  // object, refreshed where it parks) and how see-through it is now (it fades like a tree
  // while it stands between the lens and him on foot)
  private readonly jeepBody = { circles: [] as readonly Obstacle[], room: WALKER_ROOM, roof: 0 };
  private jeepOpacity = 1;
  inVehicle = false;
  nearJeep = false;
  private vehicleSpeed = 0;               // the controller's carried signed speed (m/s)
  private jeepMoved = 0;                  // the speed it really moved at along its heading (m/s)
  private yieldFor: string | null = null; // run 6: the animal the jeep is braking for
  private jeepYawRate = 0;                // run 6: how fast it turned last frame (rad/s, + = left)
  // run 6 (wildlife): where the jeep will be over the next seconds if the driver keeps doing
  // what he does (core/wildlife predictJeep), looked at again every PATH_DT: the roaming
  // animals see it coming along the path it will really drive, bends included
  private readonly jeepPath = new Float64Array(PATH_N * PATH_STRIDE);
  private jeepPathN = 0;
  private predictIn = 0;
  private readonly jeepRead: JeepRead = { x: 0, z: 0, heading: 0, speed: 0, yawRate: 0, path: null, pathN: 0 };
  private brake: 'solid' | 'edge' | 'water' | 'dead-end' | 'animal' | null = null; // run 6: what held its speed back
  private intent = { throttle: 0, steer: 0 };     // run 6: what the keys / stick asked for last frame
  private onJeepNear: (near: boolean) => void = () => {};
  private onVehicleChange: (inVehicle: boolean) => void = () => {};
  // run 6 polish: held back with the gas on — why (tendStall), once it has stood STALL_S
  private stallWhy: JeepStall | null = null;
  private stallFor = 0;
  private stallShown: JeepStall | null = null;
  private onStall: (why: JeepStall | null) => void = () => {};
  // W5.3b helicopter (opt-in, withheld under reduced-motion). States while the ranger
  // is inside: resting on the ground (`airborne` false: after boarding and after a
  // landing — any push lifts off, "Stap uit" gets out), flying, and landing (the
  // autopilot flies it to a pad's centre and sets it down; it always finishes).
  heli: THREE.Group | null = null;
  heliPos: THREE.Vector3 | null = null;   // === heli.position (y = ground + altitude)
  private heliHeading = 0;
  private heliAltitude = 0;
  private heliParked: Obstacle[] = [];
  inHeli = false;
  nearHeli = false;
  private heliAirborne = false;
  private heliLanding = false;
  private liftArmed = false;               // a push lifts off only after the keys were let go once
  private landPad: { x: number; z: number } | null = null;
  // The pad it lifted off from. For the whole flight the pad chip — and the Land
  // autopilot with it — goes to the OTHER pad: a flight goes somewhere (the chip used to
  // say "Helipad achter je, 5 meter" at lift-off, and flipped back to it mid-flight).
  // "Land hier" shows over it again only once the helicopter has been away
  // (`departLeft`, DEPART_CLEAR m) — not the moment it lifts off.
  private departPad: { x: number; z: number } | null = null;
  private departLeft = false;
  private heliSpeed = 0;
  private heliClimbRate = 0;
  private heliVignetteVal = 0;
  private readonly helipads: { x: number; z: number }[] = [];
  private readonly beacons: THREE.Object3D[] = [];
  private onHeliNear: (near: boolean) => void = () => {};
  private onHeliChange: (inHeli: boolean) => void = () => {};
  private onHeliFrame: (vignette: number) => void = () => {};
  private heliOptInSource: () => boolean = () => false;
  // The seated rider: the rig root that carries the pose, and each posed bone's
  // own rotation to hand back when he stands up.
  private posedRoot: THREE.Object3D | null = null;
  private posedBones: { bone: THREE.Object3D; q: THREE.Quaternion }[] = [];
  // W5.2 jeep dust: ONE Points cloud (1 draw call, hidden while idle) of small, faint
  // puffs kicked up low behind the rear wheels. World-sized points (a puff is ~0.4 →
  // 1.1 m wide wherever it is), clamped on screen and faded near the lens, so the dust
  // can never become a blob over the screen (audit veh-02). Off under reduced-motion.
  private dust: THREE.Points | null = null;
  private dustPos: Float32Array | null = null;
  private dustVel: Float32Array | null = null;
  private dustAge: Float32Array | null = null;
  private dustLife: Float32Array | null = null;
  private dustSoil: Float32Array | null = null;   // N strengths: pale sand shows most, dark heath least
  private dustNext = 0;
  private dustDebt = 0;                   // fractional puffs owed (emission is per second)
  private dustSeed = 0x9e3779b1;
  dustEmitting = false;
  private static readonly DUST_N = 48;
  // Draw the dust and the pad beacons for the first frames (all invisible: no live puffs,
  // pads far away) so their shaders compile while the world loads — not as a ~1 s stall
  // the moment the jeep first kicks up dust or the helicopter first lifts off.
  private warmFrames = 3;

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
  private readonly groundAt = (x: number, z: number): number => this.terrain.y(x, z);

  /** The interact key when no button on screen takes it: in the jeep = step out; in
   *  the helicopter = land (in the air) or step out (on the ground); beside a parked
   *  one = climb in. False when no vehicle takes the key. */
  interact(): boolean {
    if (this.inVehicle) { this.exitVehicle(); return true; }
    if (this.inHeli) { if (this.heliAirborne) this.landHeli(); else this.exitHeli(); return true; }
    if (this.nearJeep) { this.enterVehicle(); return true; }
    if (this.nearHeli) { this.enterHeli(); return true; }
    return false;
  }

  /** Walking near a parked jeep surfaces "Stap in" (W5.1), near the parked heli "Stap in
   *  de helikopter" (W5.3b). Suppressed while riding either one. */
  updateProximity(x: number, z: number): void {
    // Parked side by side, both are within reach: only the NEARER one offers "Stap in",
    // so the button on screen and Space always mean the vehicle he walked up to (the
    // jeep's prompt used to hide the helicopter's whenever it stood within 3.6 m).
    const dj = this.jeepPos ? Math.hypot(this.jeepPos.x - x, this.jeepPos.z - z) : Infinity;
    const dh = this.heliPos ? Math.hypot(this.heliPos.x - x, this.heliPos.z - z) : Infinity;
    const inJ = dj < JEEP_NEAR_R, inH = dh < HELI_NEAR_R;
    if (this.jeep && this.jeepPos && !this.inVehicle && !this.inHeli) {
      const nj = inJ && !(inH && dh < dj);
      if (nj !== this.nearJeep) { this.nearJeep = nj; this.onJeepNear(nj); }
    }
    if (this.heli && this.heliPos && !this.inHeli && !this.inVehicle) {
      const nh = inH && !(inJ && dj <= dh);
      if (nh !== this.nearHeli) { this.nearHeli = nh; this.onHeliNear(nh); }
    }
  }

  /** Register the jeep HUD callbacks (W5.1): `onNear` while walking up to / away from
   *  the parked jeep, `onChange(inVehicle)` on climbing in / stepping out, `onStall(why)`
   *  when the gas is held but something holds the jeep back (run 6 polish; null: moving
   *  again, or the gas let go). */
  setVehicle(cbs: { onNear: (near: boolean) => void; onChange: (inVehicle: boolean) => void; onStall?: (why: JeepStall | null) => void }): void {
    this.onJeepNear = cbs.onNear;
    this.onVehicleChange = cbs.onChange;
    this.onStall = cbs.onStall ?? (() => {});
  }

  /** Run 6 polish: the gas held, and the jeep standing because something holds it back
   *  (an animal it gives way to, a solid, the forest edge): after STALL_S the HUD says why,
   *  in one line (onStall). A child held W for 20 s at the frisling family and nothing
   *  said why the jeep stood. It moves again, or the gas is let go: the line goes. */
  private tendStall(throttle: number, dt: number): void {
    const held = throttle > 0.3 && Math.abs(this.jeepMoved) < 0.15;
    const why: JeepStall | null = !held ? null
      : this.brake === 'animal' || this.yieldFor ? 'dieren'
      : this.brake === 'edge' ? 'rand'
      : this.brake || this.jeepContact ? 'vast' : null;
    this.stallFor = why && why === this.stallWhy ? this.stallFor + dt : 0;
    this.stallWhy = why;
    const show = why && (this.stallFor >= STALL_S || this.stallShown === why) ? why : null;
    if (show !== this.stallShown) { this.stallShown = show; this.onStall(show); }
  }

  /** Clear the stall line (climbing in or out). */
  private clearStall(): void {
    this.stallWhy = null; this.stallFor = 0;
    if (this.stallShown) { this.stallShown = null; this.onStall(null); }
  }

  /** Register the helicopter HUD callbacks (W5.3b): `onNear`, `onChange(inHeli)`,
   *  `onFrame(vignette)` each frame inside it (the HUD also re-reads `heliState()`
   *  there), and `optIn` = the live Instellingen "Helikopter" toggle. */
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

  /* --------------------------------------------------------- placement ---- */

  /** A model turned so its nose leads (`MODEL_YAW`), sized, casting a hero shadow. */
  private static prepVehicle(m: THREE.Group, height: number): THREE.Group {
    const prepped = prepModel(m, height);
    prepped.rotation.y = MODEL_YAW;
    enableCast(prepped);
    return prepped;
  }

  /**
   * The helicopter's cockpit glass. The GLB is one opaque mesh whose texture paints the
   * canopy and side windows near-black, so the pilot sat unseen inside it. The triangles
   * painted black in the cockpit (the upper front of the body; the black engine cowls
   * further back stay solid) move to a second, see-through material: the boy shows
   * through the glass from the chase camera and from the side. The body turns
   * double-sided so the glass looks into a cabin, not out through the far side. A copy
   * of the geometry (the cached GLB's stays untouched); one extra draw call.
   */
  private static glazeCanopy(prepped: THREE.Group): void {
    if (typeof document === 'undefined') return;
    prepped.updateMatrixWorld(true);
    const h = SIZE.helikopter.h;
    prepped.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const img = mat.map?.image as CanvasImageSource & { width: number; height: number } | undefined;
      const uv = mesh.geometry.getAttribute('uv');
      const pos = mesh.geometry.getAttribute('position');
      if (!img || !uv || !pos || !img.width) return;
      const cv = document.createElement('canvas');
      cv.width = img.width; cv.height = img.height;
      const g2 = cv.getContext('2d', { willReadFrequently: true });
      if (!g2) return;
      g2.drawImage(img, 0, 0);
      const px = g2.getImageData(0, 0, cv.width, cv.height).data;
      const geo = mesh.geometry.clone();
      const index = geo.index ? Array.from(geo.index.array) : Array.from({ length: pos.count }, (_, i) => i);
      const solid: number[] = [], glass: number[] = [];
      const v = new THREE.Vector3();
      for (let t = 0; t < index.length; t += 3) {
        let u = 0, w = 0, y = 0, along = 0;
        for (let k = 0; k < 3; k++) {
          const i = index[t + k];
          u += uv.getX(i) / 3; w += uv.getY(i) / 3;
          v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
          y += v.y / 3; along += v.z / 3;
        }
        const tx = Math.min(cv.width - 1, Math.max(0, Math.floor((u - Math.floor(u)) * cv.width)));
        const ty = Math.min(cv.height - 1, Math.max(0, Math.floor((w - Math.floor(w)) * cv.height)));
        const p = (ty * cv.width + tx) * 4;
        const luma = (0.2126 * px[p] + 0.7152 * px[p + 1] + 0.0722 * px[p + 2]) / 255;
        const cockpit = y > 0.46 * h && y < 0.82 * h && along > 0;
        (cockpit && luma < 0.16 ? glass : solid).push(index[t], index[t + 1], index[t + 2]);
      }
      if (!glass.length) return;
      geo.setIndex([...solid, ...glass]);
      geo.clearGroups();
      geo.addGroup(0, solid.length, 0);
      geo.addGroup(solid.length, glass.length, 1);
      const body = mat.clone();
      body.side = THREE.DoubleSide;
      const pane = mat.clone();
      pane.transparent = true;
      pane.opacity = 0.32;
      pane.depthWrite = false;
      mesh.geometry = geo;
      mesh.material = [body, pane];
    });
  }

  /** Push a parked vehicle's footprint into the shared collision list (the walker and
   *  the other vehicle collide with its real shape, not one round blob). */
  private park(x: number, z: number, heading: number, body: readonly BodyCircle[]): Obstacle[] {
    const fx = Math.sin(heading), fz = Math.cos(heading);
    const circles = body.map((c) => ({ x: x + fx * c.along, z: z + fz * c.along, r: c.r + WALKER_ROOM }));
    this.obstacles.push(...circles);
    return circles;
  }

  private unpark(circles: Obstacle[]): void {
    for (const c of circles) {
      const i = this.obstacles.indexOf(c);
      if (i >= 0) this.obstacles.splice(i, 1);
    }
  }

  /** Run 6 polish: the parked jeep for the walk lens (its keep-out circles, the walker's
   *  room in them, its roof), or null while it is driven or not placed. */
  parkedJeep(): { circles: readonly Obstacle[]; room: number; roof: number } | null {
    if (this.inVehicle || !this.jeepPos || !this.jeepParked.length) return null;
    this.jeepBody.circles = this.jeepParked;
    this.jeepBody.roof = this.jeepPos.y + SIZE.jeep.h;
    return this.jeepBody;
  }

  /** Run 6 polish: fade the parked jeep toward `target` (1 = solid): down at once, back up
   *  by `release` a frame (the walk lens's occluder fade, as the trees do). */
  fadeJeep(target: number, release: number): void {
    const now = this.jeepOpacity;
    let o = target <= now ? target : now + (target - now) * release;
    if (Math.abs(o - target) < 0.01) o = target;
    if (o !== now) this.setJeepOpacity(o);
  }

  /** Is this collision circle the parked jeep, faded so he reads through it? (The dev
   *  hook's clear-line read skips it then, as it skips a faded tree.) */
  seeThrough(o: Obstacle): boolean {
    return this.jeepOpacity <= 0.5 && this.jeepParked.includes(o);
  }

  /** The parked jeep's BODY circle for one of its collision circles (the collision circle
   *  holds the walker's room too), or null when `o` is not the parked jeep: what hides him
   *  on the dev hook's clear-line read. */
  parkedBody(o: Obstacle): Obstacle | null {
    const i = this.jeepParked.indexOf(o);
    if (i < 0) return null;
    const b = (this.jeepBodies[i] ??= { x: 0, z: 0, r: 0 });
    b.x = o.x; b.z = o.z; b.r = o.r - WALKER_ROOM;
    return b;
  }
  private readonly jeepBodies: Obstacle[] = [];

  /** Set the jeep's opacity: only its own materials (fadeable(): drawn in the blended
   *  pass from the start, so a fade changes a number and a depth write, never a shader). */
  private setJeepOpacity(o: number): void {
    this.jeepOpacity = o;
    this.jeep?.traverse((n) => {
      const mesh = n as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const orig = (m.userData as { jeepFade?: { o: number; d: boolean } }).jeepFade;
        if (!orig) continue;
        m.opacity = orig.o * o;
        m.depthWrite = o >= 1 ? orig.d : false;
      }
    });
  }

  /** Give the jeep model its own materials, ready to fade (setJeepOpacity): blended from
   *  the start (a solid jeep writes depth and has opacity 1, so it looks the same), so the
   *  first fade compiles nothing. */
  private static fadeable(prepped: THREE.Object3D): void {
    prepped.traverse((n) => {
      const mesh = n as THREE.Mesh;
      if (!mesh.isMesh) return;
      const own = (m: THREE.Material): THREE.Material => {
        const c = m.clone();
        c.userData.jeepFade = { o: c.opacity, d: c.depthWrite };
        c.transparent = true;
        return c;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(own) : own(mesh.material);
    });
  }

  /**
   * Run 6 polish: before a mission is played as an adventure, under its briefing card: a
   * jeep he left in that mission's home (by its places, on the walks between them, in the
   * pictures looked from them: core/vehicle.parkOutOf) would stand in its framed shots and
   * in the family's way. It is parked again, at once, on the side he came from: just out
   * of the home behind its `marker`, facing out (else the nearest spot out of it): open
   * ground with room round it for him to walk, off the water, the helipads and every
   * marker's ground, not on a slope. Never while he drives. True when it moved.
   */
  parkOutOfHome(places: readonly HomePlace[], marker?: { x: number; z: number }): boolean {
    if (this.inVehicle || !this.jeep || !this.jeepPos) return false;
    const solids = this.solids(this.jeepParked);
    const zones = this.zones(true);
    const roomy = JEEP_BODY.map((c) => ({ along: c.along, r: c.r + WALKER_ROOM }));
    const bound = this.limits.bound - bodyReach(JEEP_BODY) - 2;
    const blocked = (x: number, z: number): boolean => !!this.limits.blocked?.(x, z);
    const clear = (x: number, z: number, h: number): boolean => {
      if (Math.hypot(x, z) > bound || bodyWet(x, z, h, JEEP_BODY, blocked)) return false;
      if (bodyOverlap(x, z, h, roomy, solids) > 0 || bodyOverlap(x, z, h, JEEP_BODY, zones) > 0) return false;
      const wc = wheelContact(x, z, h, (gx, gz) => this.groundY(gx, gz));
      return Math.abs(wc.pitch) < 0.2 && Math.abs(wc.roll) < 0.2;
    };
    const to = parkOutOf(this.jeepPos.x, this.jeepPos.z, this.jeepHeading, JEEP_BODY, places, clear, marker);
    if (!to) return false;
    this.unpark(this.jeepParked);
    this.jeepPos.set(to.x, this.groundY(to.x, to.z), to.z);
    this.jeepHeading = to.heading;
    this.settleJeep();
    this.jeepParked = this.park(to.x, to.z, this.jeepHeading, JEEP_BODY);
    if (this.nearJeep) { this.nearJeep = false; this.onJeepNear(false); }
    return true;
  }

  /** Rest the jeep's four wheels on the drawn ground at its current x/z + heading. */
  private settleJeep(): void {
    if (!this.jeep || !this.jeepPos) return;
    const wc = wheelContact(this.jeepPos.x, this.jeepPos.z, this.jeepHeading, (x, z) => this.groundY(x, z));
    this.jeepPos.y = wc.y;
    this.jeepPitch = wc.pitch;
    this.jeepRoll = wc.roll;
    this.jeep.rotation.set(-this.jeepPitch, this.jeepHeading, this.jeepRoll, 'YXZ');
  }

  /**
   * W5.1: park the jeep at its home on the stuifzand (≥ 8 m from every mission marker),
   * wheels on the ground, as a solid footprint the ranger walks up to. Kept OUT of
   * `markers`.
   */
  placeJeep(): void {
    const { x, z } = JEEP_HOME;
    const group = new THREE.Group();
    group.position.set(x, this.groundY(x, z), z);
    this.jeepHeading = Math.atan2(JEEP_HOME.faceX - x, JEEP_HOME.faceZ - z);
    group.add(proceduralTotem('#6a7b4a')); // instant stand-in until the GLB streams in
    this.scene.add(group);
    this.jeep = group;
    this.jeepPos = group.position;
    this.settleJeep();
    this.jeepParked = this.park(x, z, this.jeepHeading, JEEP_BODY);
    void loadModel('vehicle-ranger-jeep').then((m) => {
      if (!m) return;
      const prepped = Vehicles.prepVehicle(m, SIZE.jeep.h);
      Vehicles.fadeable(prepped); // its own materials: it fades on its own (fadeJeep)
      const totem = group.children.find((c) => c.userData.totem);
      if (totem) group.remove(totem);
      group.add(prepped);
      if (this.jeepOpacity < 1) this.setJeepOpacity(this.jeepOpacity);
    });
    this.initDust(); // W5.2: the jeep's dust cloud (hidden until it drives)
  }

  /**
   * W5.3b: lay the two helipads on the drawn ground and park the helicopter on pad A.
   * A pad is walk-through (you land ON it); the parked aircraft is solid. Its PRESENCE
   * is unconditional — the opt-in + reduced-motion gate governs only boarding.
   */
  placeHelipads(): void {
    const tex = Vehicles.helipadTexture();
    for (const p of PADS) {
      this.scene.add(this.makeHelipad(p.x, p.z, tex));
      const beacon = Vehicles.makeBeacon();
      beacon.position.set(p.x, this.groundY(p.x, p.z), p.z);
      beacon.visible = true;                // warm-up; then shown only while flying: "land here"
      beacon.frustumCulled = false;         // (two still columns; drawn only while flying)
      this.scene.add(beacon);
      this.beacons.push(beacon);
      this.helipads.push({ x: p.x, z: p.z });
    }
    const pad = PADS[0];
    const group = new THREE.Group();
    group.position.set(pad.x, this.groundY(pad.x, pad.z), pad.z);
    this.heliHeading = Math.atan2(-pad.x, -pad.z); // parked facing the clearing
    group.rotation.set(0, this.heliHeading, HELI_ROLL, 'YXZ');
    group.add(proceduralTotem('#8a8f98'));
    this.scene.add(group);
    this.heli = group;
    this.heliPos = group.position;
    this.heliAltitude = HELI_PAD_HEIGHT;
    this.heliParked = this.park(pad.x, pad.z, this.heliHeading, HELI_BODY);
    void loadModel('vehicle-helicopter').then((m) => {
      if (!m) return;
      const prepped = Vehicles.prepVehicle(m, SIZE.helikopter.h);
      Vehicles.glazeCanopy(prepped);
      const totem = group.children.find((c) => c.userData.totem);
      if (totem) group.remove(totem);
      group.add(prepped);
    });
  }

  /** The helipad face: light concrete, a yellow ring and a big white H (1 texture for
   *  both pads). Audit: the old pad was a flat dark ellipse nobody read as a helipad. */
  private static helipadTexture(): THREE.Texture | null {
    if (typeof document === 'undefined') return null;
    const S = 256;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d');
    if (!g) return null;
    g.fillStyle = '#b7b1a3';
    g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#8f8a7e'; g.lineWidth = 6;
    g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 3, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#f1c232'; g.lineWidth = 16;
    g.beginPath(); g.arc(S / 2, S / 2, S * 0.39, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#fbfaf6';
    const u = S / 256;
    g.fillRect(78 * u, 70 * u, 26 * u, 116 * u);   // the H's legs
    g.fillRect(152 * u, 70 * u, 26 * u, 116 * u);
    g.fillRect(104 * u, 115 * u, 48 * u, 26 * u);  // its bar
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  /** A helipad draped over the drawn ground (1 draw call): a disc whose every vertex
   *  sits 4 cm above terrain.y, so no part of it floats or sinks into a slope. */
  private makeHelipad(px: number, pz: number, tex: THREE.Texture | null): THREE.Mesh {
    const geo = new THREE.RingGeometry(0.001, PAD_RADIUS, 40, 6);
    geo.rotateX(-Math.PI / 2); // lay it flat (x, z), normal up
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, this.groundY(px + pos.getX(i), pz + pos.getZ(i)) + 0.04);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    // the H stands upright along the pad's approach (facing the clearing, like the
    // parked helicopter), so it reads as an H from the chase camera behind it
    const yaw = Math.atan2(-px, -pz);
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const along = x * fx + z * fz, left = x * fz - z * fx;
      uv.setXY(i, 0.5 - left / (2 * PAD_RADIUS), 0.5 + along / (2 * PAD_RADIUS));
    }
    const mat = new THREE.MeshStandardMaterial({
      color: '#ffffff', map: tex, roughness: 0.95, metalness: 0,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(px, 0, pz);
    mesh.receiveShadow = true;
    mesh.userData.helipad = true;
    return mesh;
  }

  /** A soft, still column of warm light over a pad (1 draw call), shown only while
   *  flying so a child sees from the air where to land. No pulse, no motion. */
  private static makeBeacon(): THREE.Mesh {
    const H = 14;
    const geo = new THREE.CylinderGeometry(0.9, 1.6, H, 16, 1, true);
    geo.translate(0, H / 2, 0);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color('#ffd76a') } },
      vertexShader: `
        varying float vH;
        void main() { vH = position.y / ${H.toFixed(1)}; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: `
        uniform vec3 uColor; varying float vH;
        void main() { gl_FragColor = vec4(uColor, 0.38 * (1.0 - vH) * (1.0 - vH)); }
      `,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.beacon = true;
    return mesh;
  }

  /* -------------------------------------------------------- read-backs ---- */

  /** Run 6 (wildlife): the jeep as the roaming animals see it — where it is, the way it
   *  faces, how fast it rolls (signed) and turns — or null when nobody drives it (parked,
   *  it is only a solid). One reused object: read it before the next frame. */
  jeepThreat(): JeepRead | null {
    if (!this.inVehicle || !this.jeepPos) return null;
    const r = this.jeepRead;
    r.x = this.jeepPos.x; r.z = this.jeepPos.z; r.heading = this.jeepHeading;
    r.speed = this.jeepMoved; r.yawRate = this.jeepYawRate;
    r.path = this.jeepPath; r.pathN = this.jeepPathN;
    return r;
  }

  /** The two helipads (their centres): keep-out ground for the roaming animals too. */
  pads(): readonly { readonly x: number; readonly z: number }[] {
    return this.helipads;
  }

  /** Run 6: the parked helicopter's whole reach from above (its centre, HELI_REACH: the
   *  rotor tips), for the jeep's chase lens; nothing while someone flies it. */
  visitHeliReach(visit: (x: number, z: number, r: number) => void): void {
    if (this.heliPos && !this.inHeli) visit(this.heliPos.x, this.heliPos.z, HELI_REACH);
  }

  /** Dev-hook accessor (W5.1): the jeep's live state — placement, proximity, driving,
   *  pose, ground contact, speed (what it really moves at), the caps, the camera
   *  offset + comfort invariants (fixed FOV, roll 0), dust, and the driver: seated
   *  (visible, in his seat) or hidden (only the stand-in before the rig loads). */
  vehicleState(): {
    placed: boolean; near: boolean; inVehicle: boolean;
    x: number; z: number; y: number; heading: number; headingUnwrapped: number;
    grounded: boolean; clearance: number; bodyPitch: number; bodyRoll: number; contact: boolean;
    speed: number; maxSpeed: number; turnRate: number;
    camDist: number; camHeight: number; fov: number; roll: number;
    yieldFor: string | null; brake: 'solid' | 'edge' | 'water' | 'dead-end' | 'animal' | null; dust: boolean; driverHidden: boolean; driverSeated: boolean;
    intent: { throttle: number; steer: number };
    markerDist: number;
  } | null {
    if (!this.jeep || !this.jeepPos) return null;
    const caps = driveCaps(livePolicy().reduced);
    const offs = this.host.camOffsets();
    const off = this.inVehicle ? offs.vehicle : offs.walk;
    // P1.5b: its world Y against the drawn surface under it, read by an independent
    // downward ray onto the ground mesh.
    const rayY = this.terrain.raycastY(this.jeepPos.x, this.jeepPos.z);
    const surfaceY = Number.isFinite(rayY) ? rayY : this.groundY(this.jeepPos.x, this.jeepPos.z);
    const clearance = this.jeepPos.y - surfaceY;
    const grounded = Number.isFinite(rayY) && clearance >= -JEEP_SINK_TOL && clearance <= JEEP_AIR_TOL;
    // TRUE camera roll = the right vector's world-y (camera.up is world-up).
    this.camera.updateMatrixWorld();
    const rightY = this.camera.matrixWorld.elements[1];
    let markerDist = Infinity;
    for (const m of this.host.markers()) markerDist = Math.min(markerDist, Math.hypot(m.pos.x - this.jeepPos.x, m.pos.z - this.jeepPos.z));
    return {
      placed: true, near: this.nearJeep, inVehicle: this.inVehicle,
      x: this.jeepPos.x, z: this.jeepPos.z, y: this.jeepPos.y, heading: this.jeepHeading,
      headingUnwrapped: this.jeepHeadingUnwrapped,
      grounded, clearance, bodyPitch: this.jeepPitch, bodyRoll: this.jeepRoll, contact: this.jeepContact,
      speed: this.inVehicle ? this.jeepMoved : 0, maxSpeed: caps.maxSpeed, turnRate: caps.turnRate,
      camDist: off.z, camHeight: off.y, fov: this.camera.fov, roll: rightY,
      yieldFor: this.yieldFor, brake: this.inVehicle ? this.brake : null, dust: this.dustEmitting,
      intent: { ...this.intent },
      // F-31: read off the REAL `.visible`, so it can never claim what the render did not do
      driverHidden: this.inVehicle && !this.host.ranger.visible,
      driverSeated: this.inVehicle && this.host.ranger.visible && this.posedRoot !== null,
      markerDist,
    };
  }

  /** Dev-hook accessor (W5.3b): the helicopter's live state — placement, pads, opt-in +
   *  availability, proximity, inside / airborne / landing, pose + altitude, the flight
   *  caps, whether it is over a pad, the cue to the nearest pad, the vignette and the
   *  comfort invariants (fixed FOV, roll 0). */
  heliState(): {
    placed: boolean; available: boolean; optIn: boolean; near: boolean; inHeli: boolean; onPad: boolean;
    airborne: boolean; landing: boolean;
    x: number; z: number; y: number; heading: number; altitude: number; clearance: number;
    speed: number; climbRate: number; cruiseHeight: number; maxSpeed: number; turnRate: number;
    camDist: number; camHeight: number; fov: number; roll: number; vignette: number;
    pads: { x: number; z: number }[]; padCue: WayCue | null; pilotSeated: boolean;
  } | null {
    if (!this.heli || !this.heliPos) return null;
    const optIn = this.heliOptInSource();
    this.camera.updateMatrixWorld();
    const rightY = this.camera.matrixWorld.elements[1];
    const pad = this.guidePad(this.heliPos.x, this.heliPos.z);
    const rayY = this.terrain.raycastY(this.heliPos.x, this.heliPos.z);
    return {
      placed: true, available: heliAvailable(optIn, livePolicy().reduced), optIn,
      near: this.nearHeli, inHeli: this.inHeli, onPad: this.overPad(),
      airborne: this.heliAirborne, landing: this.heliLanding,
      x: this.heliPos.x, z: this.heliPos.z, y: this.heliPos.y, heading: this.heliHeading, altitude: this.heliAltitude,
      clearance: Number.isFinite(rayY) ? this.heliPos.y - rayY : NaN,
      speed: this.heliSpeed, climbRate: this.heliClimbRate,
      cruiseHeight: HELI_CRUISE_HEIGHT, maxSpeed: HELI_CAPS.maxSpeed, turnRate: HELI_CAPS.turnRate,
      camDist: this.host.camOffsets().heli.z, camHeight: this.host.camOffsets().heli.y,
      fov: this.camera.fov, roll: rightY, vignette: this.heliVignetteVal,
      pads: this.helipads.map((p) => ({ x: p.x, z: p.z })),
      padCue: pad ? wayfind(this.heliPos.x, this.heliPos.z, this.heliHeading, pad.x, pad.z) : null,
      pilotSeated: this.inHeli && this.host.ranger.visible && this.posedRoot !== null,
    };
  }

  private nearestPad(x: number, z: number, skip: { x: number; z: number } | null = null): { x: number; z: number } | null {
    let best: { x: number; z: number } | null = null, bd = Infinity;
    for (const p of this.helipads) {
      if (p === skip) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  /** The pad the flight is guided to (the chip, the Land autopilot): the nearest one
   *  other than the pad it lifted off from. */
  private guidePad(x: number, z: number): { x: number; z: number } | null {
    return this.nearestPad(x, z, this.inHeli && this.heliAirborne ? this.departPad : null) ?? this.nearestPad(x, z);
  }

  /** The pad the helicopter is over and may land on ("Land hier"), or null. */
  private padBelow(): { x: number; z: number } | null {
    if (!this.heliPos) return null;
    const skip = this.inHeli && this.heliAirborne && !this.departLeft ? this.departPad : null;
    const p = this.nearestPad(this.heliPos.x, this.heliPos.z, skip);
    return p && Math.hypot(p.x - this.heliPos.x, p.z - this.heliPos.z) <= PAD_LAND_R ? p : null;
  }

  /** Whether the helicopter is over a pad it may land on (so "Land hier" shows). */
  private overPad(): boolean {
    return this.padBelow() !== null;
  }

  /* ------------------------------------------------------- the rider ---- */

  /** Sit the ranger in `seat` of `body` (visible, posed) — or hide him when his rig has
   *  no bones to sit with (the stand-in before the GLB streams in). Called every frame
   *  while riding: it only re-poses when the rig itself was swapped. */
  private seatRider(body: THREE.Group, seat: THREE.Vector3): void {
    const r = this.host.ranger;
    const p = seat.clone().applyEuler(body.rotation).add(body.position);
    r.position.copy(p);
    r.rotation.copy(body.rotation);
    const root = r.children[0] ?? null;
    if (root && root === this.posedRoot) return;
    this.posedBones = [];
    this.posedRoot = null;
    const bones = new Map<string, THREE.Object3D>();
    root?.traverse((o) => { if ((o as THREE.Bone).isBone) bones.set(o.name, o); });
    if (!root || !bones.has('LeftUpLeg') || !bones.has('RightUpLeg')) { r.visible = false; return; }
    for (const [name, e] of Object.entries(SIT_POSE)) {
      const b = bones.get(name);
      if (!b) continue;
      this.posedBones.push({ bone: b, q: b.quaternion.clone() });
      b.rotation.set(e[0], e[1], e[2], 'XYZ');
    }
    this.posedRoot = root;
    r.visible = true;
  }

  /** Stand the ranger up again: hand every posed bone its own rotation back. */
  private unseatRider(): void {
    for (const { bone, q } of this.posedBones) bone.quaternion.copy(q);
    this.posedBones = [];
    this.posedRoot = null;
    this.host.ranger.visible = true;
  }

  /**
   * Where the rider steps out of a vehicle at (x, z) facing h: the driver's door (its
   * LEFT) first, then its right, then behind it — the first spot with room round him
   * AND a clear line behind him for the walk camera, whose boom must not fold into the
   * parked vehicle or a solid (verifier V1: stepped out beside the Missiebord, the lens
   * collapsed onto him and he faded to a see-through, giant ghost). Room = ≥ 2 m from
   * every solid, which also keeps him out of the board's and the bench's reach. None
   * clear (a thicket): the roomiest. `side` = how far out beside the vehicle; `face` =
   * the way he will look (his walk camera's boom lies behind him along it).
   */
  private exitSpot(x: number, z: number, h: number, side: number, body: readonly BodyCircle[], face = h): { x: number; z: number } {
    const fx = Math.sin(h), fz = Math.cos(h);
    const lx = Math.cos(h), lz = -Math.sin(h);         // left-of-forward
    const bx = Math.sin(face), bz = Math.cos(face);    // his facing: the boom lies behind it
    const back = bodyReach(body) + 1.2;
    const offsets = [[lx * side, lz * side], [-lx * side, -lz * side], [-fx * back, -fz * back]];
    // the vehicle's own footprint as it is about to be parked (the walker and the lens see it)
    const parked = body.map((c) => ({ x: x + fx * c.along, z: z + fz * c.along, r: c.r + WALKER_ROOM }));
    const solids = this.solids();
    const BOOM = 5, PROBE = 0.35;                         // the walk camera's boom + its probe
    let best = { x: x + offsets[0][0], z: z + offsets[0][1] }, bestScore = -Infinity;
    for (const [ox, oz] of offsets) {
      const p = resolveMove(x, z, x + ox, z + oz, this.obstacles, this.limits);
      let room = Infinity, boom = Infinity;
      for (const o of solids) room = Math.min(room, Math.hypot(p.x - o.x, p.z - o.z) - o.r);
      for (const o of solids.concat(parked)) {
        // the gap between the boom (the segment behind him along −facing) and this circle
        const t = Math.max(0, Math.min(BOOM, -((o.x - p.x) * bx + (o.z - p.z) * bz)));
        boom = Math.min(boom, Math.hypot(o.x - (p.x - bx * t), o.z - (p.z - bz * t)) - o.r - PROBE);
      }
      const score = Math.min(room - 2, boom);
      if (score >= 0) return p;
      if (score > bestScore) { bestScore = score; best = p; }
    }
    return best;
  }

  /** Step out of a vehicle onto the drawn ground, at `exitSpot` (the driver's door when
   *  it has room), looking along `face` (default: the way the vehicle points). */
  private stepOut(x: number, z: number, h: number, side: number, body: readonly BodyCircle[], face = h): void {
    // exitSpot keeps him on solid ground inside the rim; the vehicle's footprint is not
    // back in the list yet, so he clears it fully
    const next = this.exitSpot(x, z, h, side, body, face);
    const r = this.host.ranger;
    r.position.set(next.x, this.groundY(next.x, next.z), next.z);
    r.rotation.set(0, face, 0, 'XYZ');
    this.unseatRider();
    this.host.seat(false);              // F-31: back on foot — locomotion resumes (idle)
    this.host.stopWalk(next.x, next.z); // no stale walk target, standing still
  }

  /* ----------------------------------------------------------- the jeep ---- */

  /** W5.1: climb into the parked jeep — the arcade drive takes over and the wider
   *  chase-cam cuts in; the ranger sits in the driver's seat. No-op unless beside it. */
  enterVehicle(): void {
    if (this.inVehicle || this.inHeli || !this.jeep || !this.jeepPos) return;
    this.inVehicle = true;
    this.jeepHeadingUnwrapped = 0;
    this.jeepYawRate = 0;
    this.jeepPathN = 0;
    this.predictIn = 0;
    this.vehicleSpeed = 0;
    this.jeepMoved = 0;
    this.jeepContact = false;
    this.jeepBraked = false;
    this.yieldFor = null;
    this.unpark(this.jeepParked);
    this.jeepParked = [];
    if (this.jeepOpacity < 1) this.setJeepOpacity(1); // he drives a solid jeep
    this.clearStall();
    this.host.seat(true);               // F-31: a still `sit`, never idle/walk, while riding
    this.seatRider(this.jeep, JEEP_SEAT);
    this.host.clearWalkPrompts();
    // the boarding reframe is a CUT for everyone (F-30), behind the parked jeep
    this.host.follow(this.jeepHeading, true);
    this.onVehicleChange(true);
    if (store.get().settings.geluid) Sound.engineStart();
    this.host.recut();
  }

  /** W5.1: step out beside the jeep (its left, the driver's side) and re-park it as a
   *  solid footprint where it stands. No-op unless driving. */
  exitVehicle(): void {
    if (!this.inVehicle || !this.jeep || !this.jeepPos) return;
    this.inVehicle = false;
    const h = this.jeepHeading;
    this.stepOut(this.jeepPos.x, this.jeepPos.z, h, JEEP_STEP_OUT, JEEP_BODY);
    this.host.follow(h, true);          // the step-out is a CUT too
    this.vehicleSpeed = 0;
    this.jeepMoved = 0;
    this.settleJeep();                  // parked: all four wheels exactly on the ground
    this.jeepParked = this.park(this.jeepPos.x, this.jeepPos.z, h, JEEP_BODY);
    this.nearJeep = true;               // standing right beside it → "Stap in" again
    this.yieldFor = null;
    this.clearStall();
    this.dustEmitting = false;
    Sound.engineStop();
    this.onVehicleChange(false);
    this.host.recut();
  }

  /** Every solid a vehicle's body meets: the static list (trunks, cabin, landmarks,
   *  board, props, the other parked vehicle) plus the people. Rebuilt every frame into
   *  reused arrays and pooled circles, so driving makes no garbage (review PERF-2: it
   *  copied the whole obstacle list and made new objects per frame). The roaming
   *  animals are not solids (run 6): see `yielding`. `skip`: circles to leave out (the
   *  parked jeep, for a helicopter flying over its roof). */
  private solids(skip: readonly Obstacle[] | null = null): Solid[] {
    const out = this.solidBuf;
    out.length = 0;
    for (const o of this.obstacles) if (!skip || !skip.includes(o)) out.push(o);
    this.poolUsed = 0;
    this.host.people(this.addPerson);
    return out;
  }

  /** The roaming animals the jeep gives way to (pooled, no garbage). */
  private yielding(): YieldAnimal[] {
    const out = this.animalBuf;
    out.length = 0;
    this.animalsUsed = 0;
    this.host.animals(this.addAnimal);
    return out;
  }

  private readonly solidBuf: Solid[] = [];
  private readonly animalBuf: YieldAnimal[] = [];
  private readonly animalPool: { id: string; x: number; z: number; r: number }[] = [];
  private animalsUsed = 0;
  private readonly zoneBuf: Solid[] = [];
  private readonly allBuf: Solid[] = [];
  // what the jeep meets: the same reused buffers, refilled each frame by solids(),
  // zones(), joined() and yielding()
  private get jeepWorld(): JeepWorld {
    return this.jeepWorldObj ??= { solids: this.solidBuf, zones: this.zoneBuf, walls: this.allBuf, animals: this.animalBuf, limits: this.limits };
  }
  private jeepWorldObj: JeepWorld | null = null;
  // the same world with no animals in it: the path the jeep would drive, for the animals
  private get predictWorld(): JeepWorld {
    return this.predictWorldObj ??= { solids: this.solidBuf, zones: this.zoneBuf, walls: this.allBuf, animals: [], limits: this.limits };
  }
  private predictWorldObj: JeepWorld | null = null;
  private readonly pool: Solid[] = [];
  private poolUsed = 0;
  private pooled(x: number, z: number, r: number, soft = false): Solid {
    const c = this.pool[this.poolUsed] ?? (this.pool[this.poolUsed] = { x: 0, z: 0, r: 0 });
    this.poolUsed++;
    c.x = x; c.z = z; c.r = r; c.soft = soft;
    return c;
  }
  private readonly addPerson = (x: number, z: number): void => {
    this.solidBuf.push(this.pooled(x, z, PERSON_R));
  };
  private readonly addAnimal = (id: string, x: number, z: number, size?: string): void => {
    const a = this.animalPool[this.animalsUsed] ?? (this.animalPool[this.animalsUsed] = { id: '', x: 0, z: 0, r: 0 });
    this.animalsUsed++;
    if (a.id !== id) { a.id = id; a.r = animalR(size ?? id); }
    a.x = x; a.z = z;
    this.animalBuf.push(a);
  };

  /** The keep-out zones: the ground round each mission marker (so a vehicle never parks
   *  in a mission's stage: ≥ 6 m from the marker) and, for the jeep, each helipad (so a
   *  pad is always free for the helicopter's autopilot to land on). Unlike a solid a zone
   *  shows nothing to stop at, so the jeep bends round it (`keepOutSteer`) instead of
   *  braking for it; its body still never enters one. Pooled like `solids`: call
   *  `solids()` first, the two share the pool. */
  private zones(forJeep: boolean): Solid[] {
    const out = this.zoneBuf;
    out.length = 0;
    for (const m of this.host.markers()) out.push(this.pooled(m.pos.x, m.pos.z, MARKER_R, true));
    if (forJeep) for (const p of this.helipads) out.push(this.pooled(p.x, p.z, PAD_RADIUS, true));
    return out;
  }

  /** `a` then `b` in one reused array (no garbage). */
  private joined(a: readonly Solid[], b: readonly Solid[]): Solid[] {
    const out = this.allBuf;
    out.length = 0;
    for (const o of a) out.push(o);
    for (const o of b) out.push(o);
    return out;
  }

  /**
   * W5.1: one frame of the arcade drive (the pure frame is `core/vehicle.jeepStep`). Up
   * = full gas, Down = brake then reverse, Left/Right = steer and keep the gas (run 6);
   * a sideways push creeps forward while it turns. The speed ramps (~1 s), brakes softly
   * for whatever solid is ahead (it rolls to rest AT a trunk, never into it), gives way
   * to an animal in its path (a soft stop a metre short of it; nothing that moves ever
   * pushes it), bends round a keep-out zone and along the forest edge; the whole body
   * then resolves against every solid and zone and slides along it. The wheels rest on
   * the drawn ground, the driver rides in his seat, the follow-cam trails the heading.
   */
  driveJeep(rawDt: number): void {
    const dt = vehicleDt(rawDt);          // a stall never teleports the jeep
    if (!this.jeep || !this.jeepPos || dt <= 0) return;
    const jp = this.jeepPos;
    const reduced = livePolicy().reduced;
    const caps = driveCaps(reduced);
    const c = this.host.controls();
    const solids = this.solids();
    const zones = this.zones(true);
    this.joined(solids, zones);
    this.yielding();
    const want = driveIntent(c.keys, c.stick);
    this.intent.throttle = want.throttle; this.intent.steer = want.steer;
    const f = jeepStep(
      { x: jp.x, z: jp.z, heading: this.jeepHeading, speed: this.vehicleSpeed, contact: this.jeepContact, braked: this.jeepBraked },
      want, dt, caps, this.jeepWorld,
    );
    const turned = Math.atan2(Math.sin(f.heading - this.jeepHeading), Math.cos(f.heading - this.jeepHeading));
    this.jeepHeadingUnwrapped += turned;
    this.jeepYawRate = turned / dt;
    this.jeepHeading = f.heading;
    jp.x = f.x; jp.z = f.z;
    this.jeepContact = f.contact;
    this.jeepBraked = f.braked;
    this.vehicleSpeed = f.speed;
    this.jeepMoved = f.moved;
    this.yieldFor = f.yieldFor;
    this.brake = f.brake;
    this.tendStall(want.throttle, dt);
    const moved = f.moved;
    // the path it will drive if the keys stay as they are, for the animals (a world without
    // them: they must not see the jeep braking for themselves)
    if ((this.predictIn -= dt) <= 0) {
      this.predictIn = PATH_DT;
      this.jeepPathN = predictJeep(
        { x: jp.x, z: jp.z, heading: this.jeepHeading, speed: this.vehicleSpeed, contact: this.jeepContact, braked: this.jeepBraked },
        want, caps, this.predictWorld, this.jeepPath,
      );
    }
    // (4) the wheels on the drawn ground: height + pitch + roll ease in (a damped
    // suspension glide — research §4.5 — never a hard per-frame snap)
    const wc = wheelContact(jp.x, jp.z, this.jeepHeading, this.groundAt);
    const k = 1 - Math.exp(-JEEP_HOVER_RATE * dt);
    jp.y += (wc.y - jp.y) * k;
    this.jeepPitch += (wc.pitch - this.jeepPitch) * k;
    this.jeepRoll += (wc.roll - this.jeepRoll) * k;
    this.jeep.rotation.set(-this.jeepPitch, this.jeepHeading, this.jeepRoll, 'YXZ');
    // (5) the driver in his seat; the camera trails the heading
    this.seatRider(this.jeep, JEEP_SEAT);
    this.host.follow(this.jeepHeading, false);
    // W5.2: the engine revs with the real pace; dust kicks up behind the rear wheels
    const pace = Math.min(1, Math.abs(moved) / caps.maxSpeed);
    if (store.get().settings.geluid) Sound.engineSet(pace);
    this.dustEmitting = !reduced && Math.abs(moved) > 1.5;
    if (this.dustEmitting) this.emitDust(dt, pace);
    this.host.crossBiome(this.terrain.biome(jp.x, jp.z));
  }

  /* ----------------------------------------------------- the helicopter ---- */

  /** W5.3b: board the parked helicopter: the ranger sits in the pilot's seat, it rests
   *  on the pad until he pushes to fly. No-op unless beside it and available (opt-in +
   *  NOT reduced-motion — flight is withheld entirely rather than merely calmed). */
  enterHeli(): void {
    if (this.inHeli || this.inVehicle || !this.heli || !this.heliPos) return;
    if (!heliAvailable(this.heliOptInSource(), livePolicy().reduced)) return;
    this.inHeli = true;
    this.heliAirborne = false;
    this.liftArmed = false;
    this.heliLanding = false;
    this.landPad = null;
    this.heliAltitude = HELI_PAD_HEIGHT;
    this.heliSpeed = 0; this.heliClimbRate = 0; this.heliVignetteVal = 0;
    this.unpark(this.heliParked);
    this.heliParked = [];
    this.host.seat(true);
    this.seatRider(this.heli, HELI_SEAT);
    this.host.clearWalkPrompts();
    this.host.follow(this.heliHeading + HELI_CHASE_YAW, true);
    this.onHeliChange(true);
    this.host.recut();
  }

  /**
   * W5.3b: "Land": in the air, the autopilot takes the helicopter to the pad it is over
   * ("Land hier") or else to the pad the chip points at ("Land op de helipad"), turning
   * to face where it flies, descending calmly (≤ 2 m/s) and setting down on the pad's
   * centre. It always finishes, so a child can never be stuck in the air. On the
   * ground it is a no-op.
   */
  landHeli(): void {
    if (!this.inHeli || !this.heliAirborne || !this.heliPos) return;
    this.landPad = this.padBelow() ?? this.guidePad(this.heliPos.x, this.heliPos.z);
    this.heliLanding = !!this.landPad;
  }

  /** Back to the title from the air (Pauze → "Naar het hoofdmenu", under its fade): the
   *  helicopter stands on the nearest pad at once, the pilot still seated, so he can step
   *  out. No-op on the ground. */
  setDownNow(): void {
    const hp = this.heliPos;
    if (!this.inHeli || !this.heliAirborne || !this.heli || !hp) return;
    const pad = this.nearestPad(hp.x, hp.z); // any pad, the one it lifted off from too
    if (pad) { hp.x = pad.x; hp.z = pad.z; }
    this.heliAltitude = HELI_PAD_HEIGHT;
    hp.y = this.groundY(hp.x, hp.z);
    this.heliAirborne = false;
    this.liftArmed = false;
    this.heliLanding = false;
    this.landPad = null;
    this.departPad = null;
    this.heliSpeed = 0; this.heliClimbRate = 0; this.heliVignetteVal = 0;
    for (const b of this.beacons) b.visible = false;
    this.heli.rotation.set(0, this.heliHeading, 0, 'YXZ');
    this.seatRider(this.heli, HELI_SEAT);
  }

  /** W5.3b: step out of the helicopter resting on the ground (its left) and re-park it
   *  as a solid footprint. No-op in the air (land first). */
  exitHeli(): void {
    if (!this.inHeli || this.heliAirborne || !this.heli || !this.heliPos) return;
    this.inHeli = false;
    this.heliLanding = false;
    const h = this.heliHeading;
    this.heliAltitude = HELI_PAD_HEIGHT;
    this.heliPos.y = this.groundY(this.heliPos.x, this.heliPos.z);
    // out of the helicopter he looks toward the clearing, not along the flight: the way
    // back to the world lies ahead of him, and at his size the helicopter would otherwise
    // stand in the walk camera's way as he turns home past it
    const face = Math.atan2(-this.heliPos.x, -this.heliPos.z);
    this.stepOut(this.heliPos.x, this.heliPos.z, h, HELI_STEP_OUT, HELI_BODY, face);
    this.host.follow(face, true);
    this.heliSpeed = 0; this.heliClimbRate = 0; this.heliVignetteVal = 0;
    this.heliParked = this.park(this.heliPos.x, this.heliPos.z, h, HELI_BODY);
    this.nearHeli = true;               // standing right beside it → "Stap in" again
    for (const b of this.beacons) b.visible = false;
    this.onHeliChange(false);
    this.onHeliFrame(0);
    this.host.recut();
  }

  /**
   * W5.3b: one frame inside the helicopter. On the ground it rests until the player
   * pushes (any arrow / the stick) — then it lifts off. In the air: Up = fly forward
   * (it always faces where it flies: it never flies backwards; Down brakes to a
   * hover), Left/Right = turn. Climb and descent ease at ≤ 2 m/s to a fixed cruise
   * height; yaw is the only rotation (horizon level). Landing = the autopilot.
   */
  flyHeli(rawDt: number): void {
    const dt = vehicleDt(rawDt);
    if (!this.heli || !this.heliPos || dt <= 0) return;
    const hp = this.heliPos;
    const intent = this.host.intent();
    if (!this.heliAirborne) {
      const push = Math.hypot(intent.x, intent.y);
      if (push < 0.1) this.liftArmed = true;   // let go once (after boarding / touchdown)
      if (this.liftArmed && push > 0.2) { // lift off
        this.heliAirborne = true;
        const from = this.nearestPad(hp.x, hp.z);
        this.departPad = from && Math.hypot(from.x - hp.x, from.z - hp.z) <= PAD_LAND_R ? from : null;
        this.departLeft = false;
      }
      else {
        hp.y = this.groundY(hp.x, hp.z);
        this.heli.rotation.set(0, this.heliHeading, HELI_ROLL, 'YXZ');
        this.seatRider(this.heli, HELI_SEAT);
        this.heliSpeed = 0; this.heliClimbRate = 0; this.heliVignetteVal = 0;
        this.onHeliFrame(0);
        return;
      }
    }
    let throttle: number, steer: number, target = HELI_CRUISE_HEIGHT;
    let hold = false; // the last metre over the pad: drift straight onto its centre
    if (this.heliLanding && this.landPad) {
      const dx = this.landPad.x - hp.x, dz = this.landPad.z - hp.z, d = Math.hypot(dx, dz);
      target = landingAltitude(d);
      if (d > 1.2) {
        const err = Math.atan2(Math.sin(Math.atan2(dx, dz) - this.heliHeading), Math.cos(Math.atan2(dx, dz) - this.heliHeading));
        steer = Math.max(-1, Math.min(1, -err * 2));        // right (+) lowers the yaw
        throttle = Math.min(1, Math.max(0.15, d / 12)) * (Math.abs(err) < 0.5 ? 1 : 0.2);
      } else { throttle = 0; steer = 0; hold = true; }
    } else {
      throttle = Math.max(0, intent.y); // never backwards: it faces where it flies
      steer = intent.x;
    }
    this.heliSpeed = heliRamp(this.heliSpeed, throttle, dt);
    const step = flyStep(
      { heading: this.heliHeading, altitude: this.heliAltitude },
      { throttle: this.heliSpeed / HELI_CAPS.maxSpeed, steer }, target, dt, HELI_CAPS,
    );
    let nx = hp.x + step.dx, nz = hp.z + step.dz, nh = step.heading;
    if (hold && this.landPad) {
      const k = 1 - Math.exp(-2.5 * dt);
      nx = hp.x + (this.landPad.x - hp.x) * k; nz = hp.z + (this.landPad.z - hp.z) * k;
      this.heliSpeed = 0;
    }
    if (this.heliAltitude <= HELI_AIRBORNE_Y) { // low: the body collides like the jeep's
      // …but once higher than the parked jeep's roof it flies over it (run 6: parked on
      // the helicopter's way out, the jeep pushed it sideways at 2.4 m up)
      const solids = this.solids(this.heliAltitude > SIZE.jeep.h ? this.jeepParked : null);
      const next = resolveBody(hp.x, hp.z, this.heliHeading, nx, nz, nh, HELI_BODY, this.joined(solids, this.zones(false)), this.limits);
      nx = next.x; nz = next.z; nh = next.heading;
    } else {                                     // over the treetops: only the rim bounds it
      // (short of the rim tree-line: its grown crowns, up to ≈ 24 m, reach ≈ 6 m inward)
      const r = Math.hypot(nx, nz), lim = this.limits.bound - HELI_RIM_KEEP;
      if (r > lim) { nx = (nx / r) * lim; nz = (nz / r) * lim; }
    }
    hp.x = nx; hp.z = nz;
    if (this.departPad && Math.hypot(this.departPad.x - hp.x, this.departPad.z - hp.z) > DEPART_CLEAR) this.departLeft = true;
    this.heliHeading = nh;
    this.heliAltitude = step.altitude;
    hp.y = this.groundY(hp.x, hp.z) + this.heliAltitude;
    this.heli.rotation.set(0, this.heliHeading, HELI_ROLL, 'YXZ'); // yaw only; horizon level
    this.heliClimbRate = step.climbRate;
    this.seatRider(this.heli, HELI_SEAT);
    this.host.follow(this.heliHeading + HELI_CHASE_YAW, false);
    for (const b of this.beacons) b.visible = true; // the pads glow while flying
    this.heliVignetteVal = heliVignette(this.heliSpeed, step.climbRate);
    // touchdown on the pad's centre: it rests there, the pilot still in his seat
    if (this.heliLanding && hold && this.heliAltitude <= HELI_PAD_HEIGHT + 0.03) {
      this.heliAltitude = HELI_PAD_HEIGHT;
      hp.y = this.groundY(hp.x, hp.z);
      this.heliAirborne = false;
      this.liftArmed = false;             // a key still held from the flight never lifts it again
      this.heliLanding = false;
      this.landPad = null;
      this.departPad = null;
      this.heliSpeed = 0; this.heliClimbRate = 0; this.heliVignetteVal = 0;
      for (const b of this.beacons) b.visible = false;
      this.seatRider(this.heli, HELI_SEAT);
    }
    this.onHeliFrame(this.heliVignetteVal);
    this.host.crossBiome(this.terrain.biome(hp.x, hp.z));
  }

  /* --------------------------------------------------------------- dust ---- */

  /** W5.2: the dust pool (1 draw call, hidden while idle). Points are sized in METRES
   *  (`uScale` = the lens's pixels per metre at 1 m, set per render), clamped on screen
   *  and faded out near the lens, so a puff reads as a low wisp at any distance. */
  private initDust(): void {
    const N = Vehicles.DUST_N;
    this.dustPos = new Float32Array(N * 3);
    this.dustVel = new Float32Array(N * 3);
    this.dustAge = new Float32Array(N);
    this.dustLife = new Float32Array(N); // all 0 → every slot starts dead
    this.dustSoil = new Float32Array(N);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.dustPos, 3));
    geo.setAttribute('aAge', new THREE.BufferAttribute(this.dustAge, 1));
    geo.setAttribute('aLife', new THREE.BufferAttribute(this.dustLife, 1));
    geo.setAttribute('aSoil', new THREE.BufferAttribute(this.dustSoil, 1));
    const uniforms = { uColor: { value: new THREE.Color('#ebdfc4') }, uScale: { value: 700 } };
    const mat = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: `
        uniform float uScale;
        attribute float aAge;
        attribute float aLife;
        attribute float aSoil;
        varying float vAlpha;
        void main() {
          float life = max(aLife, 0.0001);
          float f = clamp(aAge / life, 0.0, 1.0);
          float alive = step(0.0001, aLife) * (1.0 - step(aLife, aAge));
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float depth = max(-mv.z, 0.5);
          // fade in fast, out slowly; and away near the lens: never a blob over the screen
          float near = smoothstep(2.5, 6.0, depth);
          vAlpha = smoothstep(0.0, 0.15, f) * (1.0 - f) * alive * near * aSoil;
          float metres = mix(0.45, 1.3, f);
          gl_PointSize = clamp(metres * uScale / depth, 1.0, 72.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        precision mediump float;
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          vec2 d = gl_PointCoord - vec2(0.5);
          float r2 = dot(d, d) * 4.0;          // 0 at the centre, 1 at the rim
          float soft = exp(-3.5 * r2) * (1.0 - r2);
          float a = max(soft, 0.0) * vAlpha * 0.4; // a light haze, not a cloud
          if (a <= 0.003) discard;
          gl_FragColor = vec4(uColor, a);
        }
      `,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false; // particles live in world space, not around the origin
    pts.visible = true; // warm-up (all puffs dead: nothing shows); updateDust hides it
    const size = new THREE.Vector2();
    pts.onBeforeRender = (renderer, _scene, cam) => {
      renderer.getDrawingBufferSize(size);
      const fov = (cam as THREE.PerspectiveCamera).fov ?? 55;
      uniforms.uScale.value = size.y / (2 * Math.tan((fov * Math.PI) / 360));
    };
    this.scene.add(pts);
    this.dust = pts;
  }

  /** A deterministic 0..1 (LCG) for dust scatter — no `Math.random`, stable frames. */
  private dustRand(): number {
    this.dustSeed = (this.dustSeed * 1103515245 + 12345) & 0x7fffffff;
    return this.dustSeed / 0x7fffffff;
  }

  /** W5.2: puffs off the two REAR wheels, low on the ground, at a rate that follows
   *  the pace and the ground (sand kicks up most, heather and forest floor less). */
  private emitDust(dt: number, pace: number): void {
    if (!this.jeepPos || !this.dustPos || !this.dustVel || !this.dustAge || !this.dustLife || !this.dustSoil) return;
    const soil: Record<Biome, number> = { stuifzand: 1, heide: 0.55, bos: 0.35, ven: 0.3 };
    const shows: Record<Biome, number> = { stuifzand: 1, heide: 0.45, bos: 0.35, ven: 0.35 }; // on dark ground a pale puff stands out: fainter
    const jp = this.jeepPos;
    const h = this.jeepHeading;
    const fx = Math.sin(h), fz = Math.cos(h);  // forward
    const lx = fz, lz = -fx;                   // left-of-forward
    const biome = this.terrain.biome(jp.x, jp.z);
    this.dustDebt += dt * 34 * pace * soil[biome];
    while (this.dustDebt >= 1) {
      this.dustDebt -= 1;
      const i = this.dustNext;
      this.dustNext = (this.dustNext + 1) % Vehicles.DUST_N;
      const side = i % 2 ? 0.72 : -0.72;        // alternate the two rear wheels
      const back = 1.25 + this.dustRand() * 0.3;
      const px = jp.x - fx * back + lx * (side + (this.dustRand() - 0.5) * 0.2);
      const pz = jp.z - fz * back + lz * (side + (this.dustRand() - 0.5) * 0.2);
      this.dustPos[i * 3] = px;
      this.dustPos[i * 3 + 1] = this.groundY(px, pz) + 0.15;
      this.dustPos[i * 3 + 2] = pz;
      const spread = (this.dustRand() - 0.5) * 0.5;
      this.dustVel[i * 3] = lx * spread - fx * 0.3;
      this.dustVel[i * 3 + 1] = 0.12 + this.dustRand() * 0.18; // a low, slow rise
      this.dustVel[i * 3 + 2] = lz * spread - fz * 0.3;
      this.dustAge[i] = 0;
      this.dustLife[i] = 0.9 + this.dustRand() * 0.6;
      this.dustSoil[i] = shows[biome];
    }
  }

  /** W5.2: age every live puff, drift it, and hide the cloud once none survive (so an
   *  idle jeep costs no draw call). */
  updateDust(dt: number): void {
    if (!this.dust || !this.dustPos || !this.dustVel || !this.dustAge || !this.dustLife) return;
    const step = vehicleDt(dt);
    let anyAlive = false;
    for (let i = 0; i < Vehicles.DUST_N; i++) {
      if (this.dustLife[i] <= 0) continue;
      const age = this.dustAge[i] + step;
      if (age >= this.dustLife[i]) { this.dustLife[i] = 0; this.dustAge[i] = age; continue; }
      this.dustAge[i] = age;
      this.dustPos[i * 3] += this.dustVel[i * 3] * step;
      this.dustPos[i * 3 + 1] += this.dustVel[i * 3 + 1] * step;
      this.dustPos[i * 3 + 2] += this.dustVel[i * 3 + 2] * step;
      anyAlive = true;
    }
    const g = this.dust.geometry;
    (g.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (g.getAttribute('aAge') as THREE.BufferAttribute).needsUpdate = true;
    (g.getAttribute('aLife') as THREE.BufferAttribute).needsUpdate = true;
    (g.getAttribute('aSoil') as THREE.BufferAttribute).needsUpdate = true;
    if (this.warmFrames > 0 && --this.warmFrames === 0 && !this.inHeli) for (const b of this.beacons) b.visible = false;
    this.dust.visible = anyAlive || this.warmFrames > 0;
  }
}
