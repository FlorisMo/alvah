/**
 * world/Player.ts — the ranger and everything that moves him on foot.
 *
 * The rig (procedural stand-in, then the real child ranger with its idle/walk clips),
 * his measured size (the camera rails read it), his render opacity (the camera's fade
 * rail), the controls (held keys + joystick through core/input, tap-to-walk and the
 * click-vs-drag seam on the canvas) and the on-foot step: resolveMove against the
 * shared obstacles, the calm rim ease + "Hier stopt het bos" cue, feet on terrain.y,
 * the biome crossing and the surface-aware footsteps.
 */

import * as THREE from 'three';
import { loadManifest, loadRig, prepModel, skinnedRenderBox } from '../Models';
import { RANGER_STAND_HEIGHT } from '../AnimalScale';
import { applyEyes } from '../EyeMaterial';
import { applyFace } from '../FaceRig';
import { dressRanger } from '../RangerLook';
import { verfVan } from '../../core/avatar';
import type { Biome } from '../Biomes';
import { resolveMove, type MoveLimits, type Obstacle } from '../CharacterController';
import { PlayerRig } from '../PlayerRig';
import {
  screenVector, tankAxes, turnStep, approachAngle, stickBackpedal, stickHeading, wrapPi,
  JOYSTICK_DEADZONE, ALIGN_GAP, BACK_SPEED, PIVOT_RATE, type StickVector,
} from '../../core/input';
import { attachInput, type InputHandle } from '../../core/attach-input';
import { footSurface, stepFrame, newFootAccum, type FootAccum, type FootSurface } from '../../core/footstep';
import { Sound } from '../../core/sound';
import { store } from '../../core/state';
import type { Terrain } from './Terrain';
import { enableCast } from './props';

// F-11 world rim: a calm pine tree-line rings the playable area at the move bound
// (`limits.bound`, 75 m) so walking outward meets a visible forest edge, never the
// Run A silent void. RIM_EASE is the band (m) over which the ranger's OUTWARD step
// eases to zero — a gentle stop, no invisible-wall jolt (the tangential slide ALONG
// the rim keeps full speed). RIM_HINT is how close to the bound the calm "Hier stopt
// het bos" cue fires (once per approach, re-armed inward). All in metres.
const RIM_EASE = 8;
const RIM_HINT = 3.5;

// How the follow camera answers each way of walking (see walk()). Tank keys: it stays
// tightly behind his heading (lag = turn rate × tau ≈ 3°, so it settles within a few
// degrees of release). Stick / tap-walk: it eases in behind him slowly, and only
// when he walks roughly into the screen (within CAM_BEHIND_GAP of the view).
const CAM_TANK_TAU = 0.03;
const CAM_TANK_RATE = (100 * Math.PI) / 180; // just above the 90°/s turn: it catches up, never whips
const CAM_BEHIND_TAU = 0.8;
const CAM_BEHIND_RATE = (40 * Math.PI) / 180;
const CAM_BEHIND_GAP = (75 * Math.PI) / 180;

/** The stick backs him up (instead of turning him round) only while he faces within
 *  this angle of into-the-screen. */
const BACKPEDAL_FACING = (45 * Math.PI) / 180;

/** Who steered the ranger this frame. */
type DriveMode = 'keys' | 'stick' | 'tap';

/** What the camera shows, for steering (CameraRig.viewFrame). Bearings are headings:
 *  the lens looks along (sin b, cos b), so "the ranger faces into the screen" is
 *  heading == bearing. */
export interface ViewFrame {
  /** The bearing on screen now: follow + the player's drag look-around (what the
   *  follow bearing becomes after a fold). */
  bearing: number;
  /** The camera follows him (setting on, no reduced motion); else it is fixed. */
  follows: boolean;
}

/** What the follow camera should do this frame: chase `yaw` (with that ease), or
 *  hold its bearing (`yaw` null); `fold` = first fold the drag look-around into the
 *  base bearing (the view does not move). null = nothing new: hold. */
export interface CamSteer { yaw: number | null; tau: number; maxRate: number; fold: boolean }

/** A thing the ranger walks up to when it is tapped (stops `stop` metres short). */
export interface TapTarget { object: THREE.Object3D; x: number; z: number; stop: number }

/** What the player needs from the rest of the world. */
export interface PlayerHost {
  /** An in-place activity, the jeep or the helicopter owns the pointer. */
  pointerBlocked(): boolean;
  /** A past-threshold drag orbits the camera (CSS px moved this event). */
  orbitDrag(dx: number, dy: number): void;
  /** Tappable things in pick order: markers, the Missiebord, the sit-spot, the jeep, the heli. */
  tapTargets(): TapTarget[];
  /** The ambience follows the biome underfoot. */
  crossBiome(biome: Biome): void;
}

export class Player {
  // the ranger: the procedural stand-in first, the real rig swaps in when loaded
  readonly group = new THREE.Group();
  readonly target = new THREE.Vector3(0, 0, 0);
  // Cached ranger horizontal bounding radius, measured once whenever the mesh is
  // (re)built (measureAvatar). The min-boom clamp is `radius + near-plane` and the
  // avatar fades when the boom gets within ~`radius + 1 m`, so a rig that ever
  // renders bigger than the honest measured height still can't smear the lens (§4:
  // pixels outrank the hook).
  avatarRadius = 0.45;
  avatarTopY = 1.2;             // D1.5 ⊕ P1.6a measured head height (feet→top; child ≈1.2 m) — the occluder-fade sightline aim; measureAvatar overwrites it off the live rig
  avatarOpacity = 1;            // current applied ranger fade (avoids churn)
  castsShadow = false;                  // W4.5: the ranger is the primary hero shadow caster once loaded
  // F-08: on-foot ground speed (m/s). Retuned down from the giant-tuned 2.4 (which
  // measured ~2.7–3.5 m/s on the ground, 65–85 % of jeep speed) to a human ~1.8 m/s
  // now that F-07 sizes the ranger honestly. The jeep (max 6 m/s) stays clearly
  // faster — speed is its reason to exist. Drives BOTH the key-held and tap-to-walk
  // seek below; the walk clip's cadence is tied to the resulting ground speed.
  private readonly speed = 1.8;
  // W3.2 player animation: the mixer wrapper (idle/walk crossfade by speed, or a
  // procedural bob when the rigged GLB lacks clips). `groundSpeedNow` is the ranger's
  // post-collision ground speed (m/s), fed to the crossfade each frame.
  readonly rig = new PlayerRig();
  groundSpeedNow = 0;
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
  joystickSource: (() => StickVector | null) | null = null;
  // steering (walk()): the commanded heading, the ranger's body facing that swings to
  // it, the eased tank-turn rate, who steered last frame, the stick's latched view
  // bearing, a stuck tap-walk timer, and the camera's current instruction.
  private heading = Math.PI;
  private facing = Math.PI;
  private turnVel = 0;
  private drive: DriveMode | null = null;
  private frame = Math.PI;
  private tapStuck = 0;
  private camNow: { yaw: number; tau: number; maxRate: number } | null = null;
  // F-11: latched true while the ranger is pressed against the world rim heading
  // outward (the calm "Hier stopt het bos" cue has fired); re-armed once he walks
  // back inward. `onBoundary` fires on the rising edge — once per approach.
  atBoundary = false;
  onBoundary: () => void = () => {};
  // click-vs-drag discriminator (F-17 §3 seam): a pointer that travels past DRAG_PX is a
  // camera drag (tap-to-walk suppressed); a cleaner press taps (walks to the release
  // point). ~6 px per the finding — precise on a mouse, forgiving of a small touch jitter.
  private readonly DRAG_PX = 6;
  private dragId: number | null = null;   // the active orbit pointer (null = no gesture)
  private dragStartX = 0;
  private dragStartY = 0;
  private dragLastX = 0;
  private dragLastY = 0;
  private dragMoved = false;               // crossed DRAG_PX → this gesture is an orbit, not a tap
  private readonly _box = new THREE.Box3();  // scratch: ranger bbox for pose reads
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly canvas: HTMLCanvasElement;
  private readonly raycaster: THREE.Raycaster;
  private readonly terrain: Terrain;
  private readonly obstacles: Obstacle[];
  private readonly limits: MoveLimits;
  private readonly host: PlayerHost;

  constructor(
    env: {
      scene: THREE.Scene; camera: THREE.PerspectiveCamera; canvas: HTMLCanvasElement; raycaster: THREE.Raycaster;
      terrain: Terrain; obstacles: Obstacle[]; limits: MoveLimits;
    },
    host: PlayerHost,
  ) {
    this.scene = env.scene;
    this.camera = env.camera;
    this.canvas = env.canvas;
    this.raycaster = env.raycaster;
    this.terrain = env.terrain;
    this.obstacles = env.obstacles;
    this.limits = env.limits;
    this.host = host;
  }

  /** Put the instant stand-in in the world at spawn, back to the follow lens. */
  spawn(): void {
    // ranger: procedural stand-in first (instant), real model swaps in when loaded
    this.group.add(this.proceduralRanger());
    this.scene.add(this.group);
    // F-05 / F-09 world-entry composition (Run B P1.2 steer): spawn with the
    // ranger's BACK to the follow lens. The rig defaults to rotation.y = 0 = facing
    // +z = straight INTO the +z follow camera; π turns him down −z (forward, away from
    // the lens) so the camera frames his back + open ground/horizon ahead, and it
    // drops the 180° about-face the first forward press used to trigger. The follow
    // bearing already starts at π (FIXED_FOLLOW_YAW), so the lens is behind him from
    // frame one; loadRealRanger clears only the children, never this rotation.
    this.group.rotation.y = Math.PI;
    this.measureAvatar(); // F-05: seed the camera rails off the stand-in's size
  }

  /** Start listening: the click-vs-drag seam on the canvas (move/up on the window so a
   *  drag that leaves the canvas still orbits + ends cleanly). */
  listenPointer(): void {
    this.canvas.addEventListener('pointerdown', this.onPointerDown); // F-17 click-vs-drag seam
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
  }

  /** Start listening to the movement keys; `onInteract` is the interact key (Space). */
  listenKeys(onInteract: () => void): void {
    this.input = attachInput(window, { onInteract });
  }

  dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown); // F-17
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    this.input?.dispose();
    this.input = null;
  }

  /** The held keys + joystick as a screen vector (the jeep and heli read it). */
  intent(): { x: number; y: number } {
    const stick = this.joystickSource ? this.joystickSource() : null;
    return this.input ? screenVector(this.input.held, stick) : { x: 0, y: 0 };
  }

  /**
   * One on-foot frame. Picks who steers (held keys, else the touch stick, else a
   * tap-walk target), turns the ranger's HEADING, walks him along it through the
   * kinematic controller (slide around pines, stay out of the ven, stay inside the
   * world), keeps his feet on the drawn ground, and says what the follow camera
   * should do this frame (see `CamSteer`). The steering rules live in core/input.ts:
   * tank keys, a latched screen-relative stick, point-and-walk taps; everything
   * screen-relative when the follow camera is off.
   */
  walk(dt: number, view: ViewFrame): CamSteer | null {
    // a hitch (one long frame) never jumps him a long way or a big turn at once
    dt = Math.min(dt, 0.05);
    const rp = this.group.position;
    // someone else turned him (stepping out of the jeep, a reframe): take that as his
    // heading, and let the camera hold where it is.
    if (this.group.rotation.y !== this.facing) {
      this.heading = this.facing = this.group.rotation.y;
      this.turnVel = 0;
      this.camNow = null;
    }
    const held = this.input?.held;
    const keys = held && held.size > 0 ? held : null;
    const raw = this.joystickSource ? this.joystickSource() : null;
    const stick = !keys && raw && Math.hypot(raw.x, raw.y) >= JOYSTICK_DEADZONE ? raw : null;
    const dxT = this.target.x - rp.x, dzT = this.target.z - rp.z;
    const tapDist = Math.hypot(dxT, dzT);
    const mode: DriveMode | null = keys ? 'keys' : stick ? 'stick' : tapDist > 0.06 ? 'tap' : null;
    const starting = mode !== null && mode !== this.drive;
    this.drive = mode;
    if (mode === 'keys' || mode === 'stick') this.target.set(rp.x, 0, rp.z); // a stale tap target never resumes
    // Any walk start folds the player's drag look-around into the camera's base
    // bearing (invisible: the view does not move) so "behind him" is measured from
    // what the screen shows.
    const fold = starting && view.follows;
    // Only held keys turn him tank-style; a leftover turn eases out when they lift.
    if (mode !== null && mode !== 'keys') this.turnVel = 0;
    const tank = view.follows && (mode === 'keys' || (mode === null && this.turnVel !== 0));
    this.turnVel = turnStep(this.turnVel, mode === 'keys' && view.follows ? -tankAxes(keys!).turn : 0, dt);

    let speedK = 0;        // share of the walking speed this frame
    let back = false;      // backing up: walk opposite his heading, facing unchanged
    if (mode === 'keys' && view.follows) {
      // TANK: Up/Down along his heading, Left/Right turn it. If the view looks well off
      // his heading when the walk starts (a mouse drag, a tap-walk, the jeep), he first
      // turns to face into the screen, so Up is always "into the screen".
      if (starting && Math.abs(wrapPi(view.bearing - this.heading)) > ALIGN_GAP) this.heading = view.bearing;
      const ax = tankAxes(keys!);
      if (ax.fwd !== 0) { speedK = ax.fwd > 0 ? 1 : BACK_SPEED; back = ax.fwd < 0; }
    } else if (mode === 'keys' || mode === 'stick') {
      // screen-relative: the stick (and, with the follow camera off, the keys) point
      // where to go on the screen as it was when the walk started (a latched frame, so
      // the camera easing behind him never bends the walk: no feedback loop).
      if (starting) this.frame = view.bearing;
      const v = mode === 'keys' ? screenVector(keys!, null) : stick!;
      const m = Math.min(1, Math.hypot(v.x, v.y));
      if (m > 0) {
        // a stick pulled down backs him up like the Down key, but only while he faces
        // into the screen; otherwise "down" walks down the screen, toward the camera
        const intoScreen = Math.abs(wrapPi(this.facing - this.frame)) <= BACKPEDAL_FACING;
        if (mode === 'stick' && view.follows && intoScreen && stickBackpedal(v)) { speedK = m * BACK_SPEED; back = true; }
        else { this.heading = stickHeading(v, this.frame); speedK = m; }
      }
    } else if (mode === 'tap') {
      this.heading = Math.atan2(dxT, dzT);
      speedK = 1;
    }
    if (tank) this.heading = wrapPi(this.heading + this.turnVel * dt);

    // the body swings round to the heading (only the ranger turns, never the camera)
    const pivotFrom = this.facing;
    this.facing = approachAngle(this.facing, this.heading, PIVOT_RATE * dt);
    this.group.rotation.y = this.facing;
    // walk once he (nearly) faces the way he goes: no moonwalk toward the camera mid-pivot
    const along = back ? 1 : Math.max(0, Math.cos(wrapPi(this.heading - this.facing)));
    let step = this.speed * speedK * along * dt;
    if (mode === 'tap') step = Math.min(step, tapDist);
    const dir = back ? this.heading + Math.PI : this.heading;
    let wantX = rp.x + Math.sin(dir) * step;
    let wantZ = rp.z + Math.cos(dir) * step;
    let moved = 0; // post-collision ground distance this frame (drives footsteps)
    if (step > 0) {
      // F-11: the world rim is a calm stop, never an invisible wall. Ease the
      // OUTWARD part of the intended step to zero across the last RIM_EASE metres
      // (the tangential slide ALONG the rim keeps full speed); resolveMove's radial
      // clamp stays the hard backstop. And fire the calm "Hier stopt het bos" cue
      // once each time the ranger reaches the rim heading out — re-armed when he
      // walks back inward. Foot travel only (the jeep is clamped by resolveMove).
      const rNow = Math.hypot(rp.x, rp.z);
      const bound = this.limits.bound;
      let outward = 0;
      if (rNow > bound - RIM_EASE) {
        const nx = rp.x / (rNow || 1), nz = rp.z / (rNow || 1);
        outward = (wantX - rp.x) * nx + (wantZ - rp.z) * nz; // >0 ⇒ the step heads outward
        if (outward > 0) {
          const ease = Math.max(0, (bound - rNow) / RIM_EASE); // 1 at the band's inner edge → 0 at the bound
          wantX -= outward * nx * (1 - ease);
          wantZ -= outward * nz * (1 - ease);
        }
      }
      if (rNow > bound - RIM_HINT && outward > 0) {
        if (!this.atBoundary) { this.atBoundary = true; this.onBoundary(); }
      } else if (rNow < bound - RIM_HINT - 6) {
        this.atBoundary = false; // hysteresis: re-arm once well back inside the rim
      }
      const next = resolveMove(rp.x, rp.z, wantX, wantZ, this.obstacles, this.limits);
      moved = Math.hypot(next.x - rp.x, next.z - rp.z);
      // a tap-walk pressed against a wall gives up instead of treading on the spot
      if (mode === 'tap' && moved < step * 0.15) {
        if ((this.tapStuck += dt) > 0.6) this.target.set(rp.x, 0, rp.z);
      } else this.tapStuck = 0;
      rp.x = next.x;
      rp.z = next.z;
    }
    // W3.2: the actual post-collision ground speed drives the idle↔walk crossfade;
    // a turn on the spot steps the feet too, and backing up plays the walk in reverse.
    this.groundSpeedNow = moved / Math.max(dt, 1e-4);
    const pivoting = Math.abs(wrapPi(this.facing - pivotFrom)) > 1e-4;
    this.rig.setGait(back && moved > 0, pivoting && moved < 1e-4);
    rp.y = this.terrain.y(rp.x, rp.z); // feet on the drawn terrain

    // what the follow camera does (it is told, never left to chase the facing):
    if (!view.follows) this.camNow = null;
    else if (tank || (mode === 'keys')) this.camNow = { yaw: this.heading, tau: CAM_TANK_TAU, maxRate: CAM_TANK_RATE };
    else if (mode === 'stick' || mode === 'tap') {
      // ease in behind him only when he walks roughly into the screen; walking across
      // or toward the camera it holds (never a swing round to his face)
      const gap = Math.abs(wrapPi(this.heading - view.bearing));
      this.camNow = !back && gap <= CAM_BEHIND_GAP ? { yaw: this.heading, tau: CAM_BEHIND_TAU, maxRate: CAM_BEHIND_RATE } : null;
    } else if (mode === null && this.camNow && this.camNow.tau !== CAM_TANK_TAU) this.camNow = null; // a tap/stick walk ended: hold
    const out = this.camNow ? { ...this.camNow, fold } : (fold ? { yaw: null, tau: 0, maxRate: 0, fold } : null);

    // ambience follows the ranger across biomes — re-pick the bed on a crossing
    const here = this.terrain.biome(rp.x, rp.z);
    this.host.crossBiome(here);

    // W4.7b: surface-aware footsteps. The distance-carry cadence advances every
    // frame (so a stop re-arms cleanly); when a stride is crossed we plant a
    // foot with the timbre of the biome underfoot — gated on the sound setting.
    const fs = stepFrame(this.footAccum, this.groundSpeedNow, moved);
    this.footAccum = fs.accum;
    if (fs.steps > 0 && store.get().settings.geluid) {
      this.footstepCount += fs.steps;
      this.lastFootSurface = footSurface(here);
      Sound.footstep(this.lastFootSurface);
    }
    return out;
  }

  private proceduralRanger(): THREE.Group {
    const g = new THREE.Group();
    const av = store.get().avatar; // the stand-in already wears the chosen jacket and skin
    const mat = new THREE.MeshStandardMaterial({ color: verfVan('outfit', av.outfit), roughness: 1 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.6, 4, 8), mat);
    body.position.y = 0.7;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshStandardMaterial({ color: verfVan('huid', av.huid), roughness: 1 }));
    head.position.y = 1.32;
    g.add(body, head);
    // F-07 ⊕ P1.6a: normalize the instant stand-in to the SAME canonical height as
    // the real rig (Alvah is a CHILD ≈1.2 m now, feet on the ground) so it reads
    // child-sized and there is no scale pop when the loaded ranger swaps in. Plain
    // meshes (no skeleton), so a straight Box3 measure is correct.
    const raw = Math.max(new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3()).y, 0.0001);
    g.scale.setScalar(RANGER_STAND_HEIGHT / raw);
    g.position.y -= new THREE.Box3().setFromObject(g).min.y;
    return g;
  }

  async loadRealRanger(): Promise<void> {
    await loadManifest();
    // W3.2: load WITH clips (the W3.1-staged rig carries idle/walk/run) so the
    // player animates. loadRig falls back to a static group when no clips exist.
    const rig = await loadRig('ranger-alvah');
    if (!rig) return;
    // F-07 ⊕ P1.6a: normalize the ranger to Alvah's CHILD stand-height (≈1.2 m,
    // RANGER_STAND_HEIGHT) — a clear head shorter than the ~1.8 m warden — so
    // trees/hut/animals read at believable proportions around a child. prepModel
    // scales off the SKELETON's world extent (Models.skinnedRenderBox) — the size
    // that renders — not the bind-pose geometry box that read 1.7 m for a ~170 m
    // bone-driven giant.
    const prepped = prepModel(rig.group, RANGER_STAND_HEIGHT);
    // §1e eye system: bright, alive eyes (the golden-hour world is not dusk, so
    // eyeshine stays off; parallax freezes under reduced-motion).
    applyEyes(prepped, 'ranger-alvah', { dusk: false }); // parallax reads the live policy (no restart)
    // §A ARKit face: data-driven emotion + always-alive blink/microsaccade. The
    // child ranger blinks at the lower child rate. Best-effort — a humanoid GLB with
    // no ARKit blendshape rig (the Meshy mesh today) is left untouched, never throws.
    // Expression + blink are essential motion, so they stay on under reduced-motion.
    applyFace(prepped, { emotion: 'neutral', child: true }); // microsaccade reads the live policy (no restart)
    dressRanger(prepped); // wave 2: the creator's skin / hair / jacket / eyes, kept live
    enableCast(prepped); // W4.5: the ranger is the primary hero shadow caster
    this.castsShadow = true;
    this.group.clear();
    this.group.add(prepped);
    // F-11 (P4.6 rim re-judge): NEVER frustum-cull the ranger. He is a SkinnedMesh
    // whose `geometry.boundingSphere` is the BIND-POSE extent — the very F-07
    // giant-skeleton / small-geometry mismatch — and three's frustum test transforms
    // THAT stale sphere by the mesh matrix, not the live skinned bones. So once he
    // walks far from origin (the world rim, ~112 m out, camera facing OUTWARD) the
    // sphere falls behind the frustum and three drops him from BOTH the colour and
    // shadow passes: the "ranger nowhere in frame" the rim shot showed (mesh AND
    // blob-shadow gone) while `skinnedRenderBox` (real bones) still read him
    // in-frustum. He is one small model the follow-cam always frames, so skip his
    // frustum test entirely — a couple of draw calls at most, far under the <150
    // budget — and let the camera alone decide what is on screen.
    prepped.traverse((o) => { o.frustumCulled = false; });
    // D1.7: the rig materials are SHARED (Models.loadRig → SkeletonUtils.clone) with
    // the Stage title clone + every prior World instance, so this fresh rig can
    // inherit them left transparent by a prior fade; a fresh World's avatarOpacity==1
    // guard would never restore them (the `14-title-return-world` invisible ranger).
    // Force them solid the instant the rig is (re)built so world re-entry always
    // renders his body.
    this.forceAvatarOpaque();
    // wire the locomotion mixer: idle/walk crossfade by speed, or a procedural
    // bob when the clips are missing (loadRig returned an empty clip list).
    if (rig.clips.length) this.rig.attach(prepped, rig.clips);
    else this.rig.attachProcedural(prepped);
    this.measureAvatar(); // F-05: re-seed the camera rails off the REAL rig's size
  }

  /** F-05: cache the ranger's horizontal bounding radius + box height whenever the
   *  mesh is (re)built (stand-in at boot, real rig on load). The camera's min-boom
   *  clamp and its avatar-fade band are defined off this radius, so if a rig ever
   *  renders larger than the honest F-07 height the boom still clears it and the
   *  ranger fades rather than smear the lens. Measured off the SAME posed bbox the
   *  F-07 assert reads — one honest source, never the normalization target. */
  measureAvatar(): void {
    if (this.group.children.length === 0) return;
    this.group.updateWorldMatrix(true, true);
    // F-07: off the SKELETON, so the rig's honest measured size seeds the rails —
    // the bind-pose geometry box collapsed to ~0 on the giant and mis-clamped.
    const box = skinnedRenderBox(this.group) ?? this._box.setFromObject(this.group);
    const size = box.getSize(new THREE.Vector3());
    const r = Math.hypot(size.x, size.z) * 0.5;
    if (Number.isFinite(r) && r > 0) this.avatarRadius = Math.max(0.2, r);
    // D1.5: cache his head height (feet→top) so the occluder-fade sightline can aim at the
    // HEAD, the part low-hanging foliage swallows first (`10-walk-5`). Child-scale-safe: it
    // reads the measured rig, so it shrinks with the Phase-2 ≈1.2 m child height, not a pin.
    if (Number.isFinite(size.y) && size.y > 0) this.avatarTopY = Math.max(0.6, size.y);
  }

  /**
   * F-05 fade rail: set the ranger's render opacity (1 = solid). Each material's
   * ORIGINAL opacity/transparent/depthWrite is stashed once and restored at full
   * opacity, so a faded eye/coat material never loses its authored blend. A faded
   * ranger drops depthWrite so the world behind it stays visible. Guarded on the
   * cached value — no per-frame traversal unless the fade actually changes.
   */
  setAvatarOpacity(o: number): void {
    if (o === this.avatarOpacity) return;
    this.avatarOpacity = o;
    const opaque = o >= 1;
    this.group.traverse((n) => {
      const mesh = n as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const mat = m as THREE.Material & { opacity: number; transparent: boolean; depthWrite: boolean };
        const ud = mat.userData as { __fadeOrig?: { o: number; t: boolean; d: boolean } };
        if (!ud.__fadeOrig) ud.__fadeOrig = { o: mat.opacity, t: mat.transparent, d: mat.depthWrite };
        const orig = ud.__fadeOrig;
        if (opaque) { mat.opacity = orig.o; mat.transparent = orig.t; mat.depthWrite = orig.d; }
        else { mat.opacity = orig.o * o; mat.transparent = true; mat.depthWrite = false; }
      }
    });
  }

  /**
   * D1.7: force the ranger's SHARED materials back to their authored solid state,
   * bypassing setAvatarOpacity's churn-guard (`o === this.avatarOpacity`). A fresh
   * World starts `avatarOpacity` at 1, so `setAvatarOpacity(1)` is a no-op and can
   * NEVER un-fade materials a PRIOR instance left transparent (the shared-material
   * desync above). Called when the real rig is (re)built (loadRealRanger's swap — the
   * boot procedural stand-in makes its OWN fresh materials, so it can't inherit a leak)
   * so world re-entry always renders him solid — instant, so it is a cut under
   * reduced-motion too (an opacity reset is not a camera move). Poisoning
   * the guard and reusing setAvatarOpacity keeps the restore logic (the `__fadeOrig`
   * stash) in one place.
   */
  private forceAvatarOpaque(): void {
    this.avatarOpacity = -1; // poison the guard so the restore always runs
    this.setAvatarOpacity(1);
  }

  /**
   * D1.7: the ranger's ACTUAL rendered body opacity this frame — the honest,
   * pixel-truthful signal the hook reports instead of the `avatarOpacity` INTENT
   * field. The rig materials are SHARED by reference (Models.loadRig →
   * SkeletonUtils.clone; a Mesh clone shares its material) across the Stage title
   * clone and every World instance, so a fresh World inherits whatever opacity a
   * prior instance's fade rail left them in while its own `avatarOpacity` field
   * defaults to 1 — the `14-title-return-world` breach: shadow cast (the depth pass
   * ignores opacity), body unrendered, hook lying `avatarOpacity` 1 (§8.7). This
   * reads the materials directly: the MAX effective opacity across his meshes, so
   * one solid mesh proves he draws (a non-transparent material renders opaque
   * regardless of its `opacity` number → counts as 1; a faded material contributes
   * its live `opacity`). ~1 = solid body, ~0 = invisible. Empty rig → 0.
   */
  renderedAvatarOpacity(): number {
    if (this.group.children.length === 0) return 0; // rig not built yet
    // Visibility-aware walk that mirrors three's render gate: an invisible node hides
    // its whole subtree, an invisible material draws nothing, and an OPAQUE material
    // ignores its `opacity` number (renders solid). So MAX effective opacity over the
    // meshes three would actually draw = "is the body visible": ~1 solid, 0 when a
    // stale shared-material fade / a hidden mesh / a hidden group leaves him unrendered.
    // With frustumCulled=false (loadRealRanger) there is no other draw gate, so this
    // signal cannot lie the way the `avatarOpacity` intent field did (§8.7).
    let max = 0;
    const visit = (o: THREE.Object3D): void => {
      if (!o.visible) return; // an invisible node hides its whole subtree
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          const mat = m as THREE.Material & { opacity: number; transparent: boolean; visible: boolean };
          if (mat.visible === false) continue;
          const eff = mat.transparent ? mat.opacity : 1;
          if (eff > max) max = eff;
        }
      }
      for (const c of o.children) visit(c);
    };
    visit(this.group);
    return max;
  }

  // ---- input (F-17 click-vs-drag seam) ----
  /**
   * A pointerdown on the canvas STARTS a gesture; it does not act yet. If the pointer
   * then travels past DRAG_PX it is a camera orbit (yaw + eye-lift via orbitTarget*,
   * tap-to-walk suppressed); a cleaner press walks to the release point on pointerup.
   * The orbit feeds ONLY the lens (CameraRig.place), so a drag never moves `pos` — the exact
   * F-17 defect (a look-around used to relocate the ranger and flip the view 180°).
   */
  private onPointerDown = (e: PointerEvent): void => {
    if (this.host.pointerBlocked()) return; // pick / drive / flight own input
    this.dragId = e.pointerId;
    this.dragStartX = this.dragLastX = e.clientX;
    this.dragStartY = this.dragLastY = e.clientY;
    this.dragMoved = false;
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* a synthetic mouse may lack capture */ }
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.dragId !== e.pointerId) return;
    const dx = e.clientX - this.dragLastX, dy = e.clientY - this.dragLastY;
    this.dragLastX = e.clientX; this.dragLastY = e.clientY;
    if (!this.dragMoved) {
      // commit to "this is a drag" only once total travel from the press crosses DRAG_PX
      if (Math.hypot(e.clientX - this.dragStartX, e.clientY - this.dragStartY) < this.DRAG_PX) return;
      this.dragMoved = true;
    }
    // free yaw (drag right → the lens orbits right around the ranger); clamped eye-lift
    // (drag up → look further down; drag down → flatten toward the horizon).
    this.host.orbitDrag(dx, dy);
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (this.dragId !== e.pointerId) return;
    this.dragId = null;
    try { this.canvas.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    if (this.host.pointerBlocked()) return;
    if (!this.dragMoved) this.walkToPointer(e); // a clean tap still walks — the seam's other half
  };

  /** Tap-to-walk: raycast the tapped marker / hub / vehicle / ground and set the walk
   *  target. Called ONLY for a clean click (onPointerUp with no drag) so a look-around
   *  never relocates the ranger (F-17). Pick order unchanged from the pre-seam handler. */
  private walkToPointer(e: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);

    // 1) a tapped marker / Missiebord / sit-spot / parked jeep / parked helicopter → walk
    //    up to it, stopping just in front (proximity then offers its action). Pick order:
    //    markers, board, sit-spot, jeep, heli (the host lists them in that order).
    for (const t of this.host.tapTargets()) {
      const hit = this.raycaster.intersectObject(t.object, true);
      if (hit.length) {
        const dir = new THREE.Vector3(t.x, 0, t.z).sub(new THREE.Vector3(this.group.position.x, 0, this.group.position.z));
        if (dir.lengthSq() > 0.001) dir.normalize();
        this.target.set(t.x - dir.x * t.stop, 0, t.z - dir.z * t.stop);
        return;
      }
    }
    // 2) otherwise walk to the tapped ground point (marched against terrain.y, so a ray
    //    along a grid line — the centre-column click at spawn — still lands)
    const p = this.terrain.intersectRay(this.raycaster.ray);
    if (p) this.target.set(p.x, 0, p.z);
  }

  /** The keys are turning him (tank turn, easing in or out) right now. */
  get turning(): boolean {
    return this.turnVel !== 0;
  }

  /** A past-threshold mouse / finger drag is looking around right now. */
  get dragging(): boolean {
    return this.dragId !== null && this.dragMoved;
  }

  /** Dev-hook accessor (WORLD-PLAN §3.1): the ranger's world position {x,z}. */
  pos(): { x: number; z: number } {
    return { x: this.group.position.x, z: this.group.position.z };
  }

  /** The ranger's active locomotion clip for the dev hook (null when procedural). */
  clip(): { name: string; time: number } | null {
    return this.rig.clip();
  }

  /** Dev-hook accessor (F-08): the ranger's LIVE post-collision ground speed
   *  (m/s) — the honest walked speed AFTER slide/clamp, the value the walk clip's
   *  cadence is tied to. The assert reads it ∈ [1.4, 2.2] while `clip` = walk to
   *  prove the retuned foot speed is human-scaled, not the old near-jeep glide;
   *  0 while standing or in an in-place activity. */
  groundSpeed(): number {
    return this.groundSpeedNow;
  }

  /** Dev-hook accessor (F-07): the player ranger's LIVE rendered height (m),
   *  measured off the SKELETON (`skinnedRenderBox`) — the extent that actually
   *  draws — so the scale assert reads reality, not the bind-pose geometry box
   *  that once reported 1.7 m for a ~170 m bone-driven giant (§4: pixels are the
   *  court of appeal; this is the field that keeps them honest). Falls back to the
   *  geometry box for the procedural stand-in (no skeleton); null if empty. */
  avatarState(): { height: number } | null {
    if (this.group.children.length === 0) return null;
    this.group.updateWorldMatrix(true, true);
    const box = skinnedRenderBox(this.group) ?? new THREE.Box3().setFromObject(this.group);
    const h = box.getSize(new THREE.Vector3()).y;
    return Number.isFinite(h) && h > 0 ? { height: h } : null;
  }

  /** Dev-hook accessor (W4.7b): the running footstep count + the last surface
   *  the ranger planted a foot on, so the E2E can prove footsteps fire while
   *  walking (and the sound gate holds them when `geluid` is off). */
  footstepState(): { count: number; surface: FootSurface | null } {
    return { count: this.footstepCount, surface: this.lastFootSurface };
  }
}
