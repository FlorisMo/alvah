/**
 * world/CameraRig.ts — the follow camera (the motion-comfort law lives here).
 *
 * A damped, rate-clamped follow bearing that chases the ranger's facing while he
 * moves (or a fixed bearing when "Camera draait mee" is off / under reduced-motion),
 * the player's drag-orbit and wheel dolly on top, the Missiebord over-the-shoulder
 * reframe, the jeep / helicopter chase offsets, and the rails that keep the ranger
 * visible: the boom pulls in before a solid (spherecast), the eye rides over a dune
 * between lens and ranger, the ranger fades when the boom collapses onto him and the
 * tree canopy fades when a crown crosses the sightline. Fixed FOV, roll 0, no shake;
 * every reframe is a cut under reduced-motion.
 */

import * as THREE from 'three';
import { dampFactor } from '../play/kit-math';
import { dampedYaw, wrapAngle, FIXED_FOLLOW_YAW, FOLLOW_TAU, FOLLOW_MAX_RATE } from '../FollowCam';
import { livePolicy } from '../MotionMode';
import { segmentEntry, segmentCrosses, obstacleGap, type MoveLimits, type Obstacle } from '../CharacterController';
import type { Terrain } from './Terrain';
import { TREE_BASE_H, type Dressing } from './Dressing';
import type { Player, ViewFrame, CamSteer } from './Player';
import { JEEP_COLLIDE } from './Vehicles';

/** What the camera needs from the rest of the world. */
export interface CameraRigHost {
  /** Riding the jeep / the helicopter (their chase offsets replace the walk boom). */
  mode(): { inVehicle: boolean; inHeli: boolean };
  /** An in-place activity, the jeep or the helicopter owns the wheel. */
  inputBlocked(): boolean;
  /** Called after every placement (the "go here" rings fade by the lens). */
  afterPlace(): void;
  /** Every creature standing on the ground (marker animals, the warden and the poacher,
   *  roaming animals): its feet and its height. The view keeps them out of the line
   *  to the ranger. */
  creatures(): readonly Creature[];
}

/** A creature standing on the ground: its feet and its height (m). */
export interface Creature { x: number; y: number; z: number; h: number }

/** A tree's foliage for the camera: an upright ellipsoid (horizontal radius R,
 *  vertical semi-axis V); `fade` = the canopy fade can see through it (the scattered
 *  forest); the few prop trees cannot be faded, so the view must avoid them. */
interface Crown { x: number; y: number; z: number; R: number; V: number; fade: boolean }

/** Measured off the tree GLBs (wave 2): where the foliage starts and ends (÷ height)
 *  and how far out it reaches (÷ height). The old model was one fat sphere from 17 %
 *  of the height up, so the lens read "inside a crown" under every pine's bare trunk. */
const CROWN_PROFILE: Record<string, { y0: number; y1: number; r: number }> = {
  'prop-pine-scots': { y0: 0.40, y1: 1.0, r: 0.29 },
  'prop-oak-tree': { y0: 0.12, y1: 1.0, r: 0.60 },
  'prop-birch-tree': { y0: 0.30, y1: 1.0, r: 0.31 },
};

export class CameraRig {
  private readonly camDesired = new THREE.Vector3();
  // Wave 2 lens model (place): a smoothed pivot + boom length + eye height at the
  // eased bearing, plus a decaying offset when something else moved the lens.
  private readonly pivot = new THREE.Vector3();
  private boomNow = 4.6;
  private eyeNow = 2.4;
  private placed = false;
  private readonly lastSet = new THREE.Vector3();
  private readonly extOff = new THREE.Vector3();
  private readonly _lens = new THREE.Vector3();
  private readonly PIVOT_TAU = 0.15;         // on foot: the lens trails his steps a touch
  private readonly PIVOT_TAU_VEHICLE = 0.3;  // the jeep / helicopter: the old ~0.3 s follow
  private readonly BOOM_IN_TAU = 0.06;       // a solid behind him: pull in quickly
  private readonly BOOM_OUT_TAU = 0.5;       // …and let the boom out calmly
  private readonly EYE_UP_TAU = 0.12;        // rise over a crest quickly
  private readonly EYE_DOWN_TAU = 0.45;      // settle down calmly
  // F-05: the third-person walk boom, rebuilt with guaranteed clearance and
  // brought in + down from the giant-era (3.4, 6.2) rig so the ranger reads
  // human-sized in an immersive over-the-shoulder frame. The old rig had no
  // anti-clip rail, so the boom buried itself in whatever solid stood behind the
  // ranger at a POI (the spawn hub, the dune by the jeep) and rendered that prop's
  // unlit interior — Floris's #1 finding. CameraRig.place now spherecasts this boom
  // against the collision solids + the ground and fades the ranger if it still
  // collapses, so the world is always visible.
  //
  // Eye 2.4 m / boom 4.6 m / aim 1.1 m gives ~16° down. That is steeper than
  // F-05's "a few degrees" because the FROZEN tap-to-walk smoke (e2e/movement:
  // taps 32 % from the top expecting ground ahead) needs the horizon to sit above
  // that tap row — a shallower lens lands the tap on sky and the ranger never
  // moves. So this is F-05's lower/closer intent, clamped by the frozen contract.
  readonly camOffset = new THREE.Vector3(0, 2.4, 4.6); // behind-above, F-05 clearance
  // P1.6a: the follow-lookAt aim point above the ranger's feet, derived as a
  // FRACTION of his measured head height (`avatarTopY`) instead of a pin, so it
  // tracks the ≈1.2 m child rig (~sternum: 1.1 m on a 1.7 m adult → ~0.78 m on the
  // child) — else the child gets framed like a hobbit under an adult lens and the
  // D1.5 chest-sightline test aims above his head (poort-audit #3). The walk aim
  // sits a touch higher (sternum) than the idle aim (chest).
  private readonly CAM_LOOK_FRAC = 0.65;      // walk aim ≈ sternum
  private readonly CAM_IDLE_LOOK_FRAC = 0.59; // idle aim ≈ chest
  private get camLookH(): number { return this.player.avatarTopY * this.CAM_LOOK_FRAC; }
  private get camIdleLookH(): number { return this.player.avatarTopY * this.CAM_IDLE_LOOK_FRAC; }
  private readonly CAM_PROBE_R = 0.35;  // camera "sphere" radius for the push-in cast
  private readonly CAM_GROUND_CLR = 0.5; // keep the lens this far above the terrain
  // D1.5 (audit #4) terrain sightline: cap how far the follow boom rides UP to clear a dune
  // standing BETWEEN the lens and the ranger, so a pathological crest can't rocket the eye
  // skyward. The Veluwe relief is gentle (~±2.2 m) and the ven basin ~3.4 m deep,
  // so ~6 m clears every real dune; past it viewClear honestly reads not-clear (the fade rail
  // then keeps the world visible rather than a smear).
  private readonly MAX_TERRAIN_LIFT = 6;
  // D1.5 free-walk occluder fade: when a scattered tree's crown crosses the sightline the
  // canopy is FADED (an opacity change, never a camera move), so the ranger is never lost
  // behind leaves. Crowns are upright ellipsoids off the measured tree profiles (above).
  private readonly CROWN_GROW = 1.1;         // a touch bigger than the measured foliage (leaves are not a clean shell)
  private readonly CANOPY_FADE_MIN = 0.16;   // a lone between-lens crown ⇒ fade to this (the ranger reads through it)
  private readonly CANOPY_FADE_BURIED = 0.04; // lens INSIDE a crown ⇒ fade near-invisible so stacked overlapping foliage still reads through (GATE-D1 audit #2: 0.16 global was still murk when buried)
  private readonly CROWN_INSIDE_MARGIN = 0.4; // grow the crown for the lens-inside test so the fade LEADS the bury (no pop as the boom collapses into a crown)
  private readonly CANOPY_SEE_THROUGH = 0.5; // canopy ≤ this ⇒ ranger reads through ⇒ viewClear true
  private readonly CANOPY_RELEASE_TAU = 0.7; // gentle ease back to solid once the crown clears (calm, no pop)
  // Wave 2 clear view: every frame the walk boom is solved for a few bearings (straight
  // behind and gentle side offsets) and the one with the clearest line to the ranger wins:
  // no lens inside foliage or a building, no creature, prop or unfadeable crown between.
  // The chosen side offset eases in slowly (never a swing), and it is off under reduced
  // motion (there only the boom pulls in, as a cut).
  private readonly AVOID_OFFSETS = [0, 0.26, -0.26, 0.52, -0.52, 0.79, -0.79]; // straight behind, ±15°, ±30°, ±45°
  private readonly TURN_BUDGET = (110 * Math.PI) / 180; // rad/s: follow + dodge together, well under a restless 150°/s
  private readonly AVOID_HOLD = 0.8;   // s a choice is kept before the search may change its mind (no dithering)
  private avoidHeld = 0;
  private readonly AVOID_AFTER_TURN = 1.2; // s after the player's own turn before the dodge may move
  private sinceTurn = 99;
  private readonly AVOID_TAU = 0.6;
  private readonly AVOID_MAX_RATE = (30 * Math.PI) / 180;
  private readonly AVOID_URGENT_RATE = (45 * Math.PI) / 180; // the line is blocked now: a little quicker
  private readonly AVOID_LOOKAHEAD = 0.5;                     // s: search where he is going too
  private readonly vel = new THREE.Vector3();
  private readonly lastRp = new THREE.Vector3();
  private readonly ahead = new THREE.Vector3();
  private avoidYaw = 0;          // the eased side offset on the walk bearing
  private avoidTarget = 0;       // the offset the last search chose
  private readonly crowns: Crown[] = [];
  private crownKey = '';
  private readonly nearCrowns: Crown[] = [];      // this frame's crowns / solids / creatures near the ranger
  private readonly nearSolids: Obstacle[] = [];
  private readonly nearCreatures: Creature[] = [];
  private readonly sol = { dist: 0, eye: 0, lift: 0, terrainClear: true, lensInCrown: false, cost: 0 };
  // F-16 laptop dolly zoom: the player-set WALK boom distance (m, horizontal). Starts
  // at the F-05 default (camOffset.z = 4.6); wheel/trackpad scroll dollies it in/out,
  // clamped [zoomMinBoom() … CAM_ZOOM_MAX]. CameraRig.place reads it for the walk boom, so
  // the existing position-damp gives the damped feel (and a CUT under reduced-motion,
  // where CameraRig.place already snaps). The FOV is NEVER touched — a dolly, not a lens
  // zoom (motion-comfort law). Vehicle/heli/activity own the camera, so a scroll there
  // is ignored (onWheel returns early).
  readonly CAM_ZOOM_MAX = 9.5;   // dolly ceiling (~8–10 m boom, F-16)
  private readonly CAM_ZOOM_STEP = 0.01; // wheel deltaY → metres of boom change per notch
  zoomDist = this.camOffset.z;   // current player-set walk boom (default = F-05 rig)
  viewClearState = true;        // D1.5 last cam→avatar sightline-clear read (camState reports it)
  terrainClearState = true;     // D1.5 (audit #4) last cam→avatar TERRAIN-clear read (folded into viewClear)
  terrainLiftState = 0;         // D1.5 (audit #4) metres the follow boom rode up to clear a dune this frame (0 = flat)
  // W1.5 rotating follow-cam: `followYaw` is the eased camera bearing; it chases
  // `followTargetYaw`, which on foot is set every frame by the ranger's steering
  // (steer(): behind a tank-turning ranger, slowly behind a tap/stick walk, or hold —
  // a standing ranger never swings the view). Both start at π = straight behind on
  // +z. Damped + rate-clamped in FollowCam.ts.
  followYaw = FIXED_FOLLOW_YAW;
  followTargetYaw = FIXED_FOLLOW_YAW;
  // wave 2: on foot the ranger's steering tells the camera how to chase (steer()):
  // tightly behind a tank-turning ranger, slowly behind a tap/stick walk, or hold.
  // The vehicles keep the default ease (FollowCam's FOLLOW_TAU / FOLLOW_MAX_RATE).
  private followTau = FOLLOW_TAU;
  private followMaxRate = FOLLOW_MAX_RATE;
  // "Camera draait mee" toggle (Instellingen, default aan), read LIVE each frame
  // so flipping it needs no restart; reduced-motion also forces the fixed bearing.
  private cameraFollowSource: (() => boolean) | null = null;
  // F-17 laptop drag-orbit: a PLAYER look-around layered ON TOP of the follow bearing.
  // `orbitYaw` (free, wraps) rotates the walk boom around the ranger; `orbitLift` (m,
  // clamped) raises/lowers the eye to tilt the view. Both EASE toward their drag-set
  // targets, or CUT to them under reduced-motion. place() applies them to the WALK cam
  // only, so a drag moves ONLY the lens, never the ranger. The click-vs-drag seam
  // (Player.onPointerDown/Move/Up) routes a clean tap to tap-to-walk and a past-
  // threshold drag to the orbit. The steering reads the bearing ON SCREEN (orbit
  // included), and when he walks again steer() folds the orbit into the follow bearing
  // (the view does not move) so the camera then settles behind him from there.
  orbitYaw = 0;
  private orbitTargetYaw = 0;
  orbitLift = 0;
  private orbitTargetLift = 0;
  private readonly ORBIT_YAW_PER_PX = 0.005;  // rad of yaw per CSS px dragged (feel: demo)
  private readonly ORBIT_LIFT_PER_PX = 0.02;  // m of eye-lift per CSS px dragged (feel: demo)
  private readonly ORBIT_LIFT_MIN = -1.2;     // eye lower → flatter, toward the horizon (~pitch up)
  private readonly ORBIT_LIFT_MAX = 3.0;      // eye higher → more top-down (~pitch down)
  private readonly ORBIT_TAU = 0.18;          // orbit ease smooth-time (snappier than the follow)
  // (P1.0's automatic over-the-shoulder swing at the Missiebord is gone, wave 2: it
  // swung the view 51° whenever the ranger merely walked past the board, a camera move
  // nobody asked for. With the child-height ranger the board face reads above his head
  // from the plain follow framing.)
  // the wider vehicle follow-cam offset (§5 W5.1: distance 9, height 4.5) — the
  // walking offset stays (0, 3.4, 6.2). CameraRig.place picks by `inVehicle`.
  readonly camOffsetVehicle = new THREE.Vector3(0, 4.5, 9);
  // an aerial follow offset (higher + further back than the jeep) — the ranger
  // rides at the heli's world position (y = altitude), so the camera rises with it.
  readonly camOffsetHeli = new THREE.Vector3(0, 6, 13);
  private readonly camera: THREE.PerspectiveCamera;
  private readonly terrain: Terrain;
  private readonly obstacles: Obstacle[];
  private readonly limits: MoveLimits;
  private readonly player: Player;
  private readonly dressing: Dressing;
  private readonly host: CameraRigHost;

  constructor(
    env: { camera: THREE.PerspectiveCamera; terrain: Terrain; obstacles: Obstacle[]; limits: MoveLimits },
    player: Player,
    dressing: Dressing,
    host: CameraRigHost,
  ) {
    this.camera = env.camera;
    this.terrain = env.terrain;
    this.obstacles = env.obstacles;
    this.limits = env.limits;
    this.player = player;
    this.dressing = dressing;
    this.host = host;
  }

  /** The bearing on screen now (a heading: the lens looks along (sin b, cos b)). On
   *  foot it is the follow bearing + the player's drag look-around; in the jeep /
   *  helicopter the follow bearing alone. */
  bearing(): number {
    const { inVehicle, inHeli } = this.host.mode();
    return inVehicle || inHeli ? this.followYaw : wrapAngle(this.followYaw + this.orbitYaw + this.avoidYaw);
  }

  /** Dev-hook accessor: the camera yaw in the legacy input convention (screen
   *  forward = (−sin ψ, −cos ψ), so ψ = bearing + π), taken from the bearing that is
   *  ON SCREEN — the drag look-around included (audit foot-04:
   *  it used to leave them out, so after a drag the controls walked off-screen). */
  cameraYaw(): number {
    return wrapAngle(this.bearing() + Math.PI);
  }

  /** What the screen shows, for the ranger's steering (Player.walk). */
  viewFrame(): ViewFrame {
    const follow = this.cameraFollowSource ? this.cameraFollowSource() : true;
    // the steering reads the bearing without the clear-view side offset: that is the
    // camera's own small dodge, never a new "forward" for the ranger
    return { bearing: wrapAngle(this.followYaw + this.orbitYaw), follows: follow && !livePolicy().reduced };
  }

  /**
   * Take this frame's instruction from the ranger's steering. `fold` first moves
   * the player's drag look-around into the base bearing (the rendered bearing does
   * not change, so the view does not move): from then on "behind him" is measured
   * from what the screen shows, which is what makes the view ease back behind the
   * ranger once he walks again. Then chase `yaw` with the given ease, or hold.
   */
  steer(s: CamSteer | null): void {
    if (s?.fold) {
      this.followYaw = wrapAngle(this.followYaw + this.orbitYaw);
      this.orbitYaw = this.orbitTargetYaw = 0;
    }
    if (s && s.yaw !== null) {
      this.followTargetYaw = s.yaw;
      this.followTau = s.tau;
      this.followMaxRate = s.maxRate;
    } else {
      this.followTargetYaw = this.followYaw; // hold: nothing on foot swings the view
    }
  }

  /** The "Camera draait mee" setting source (W1.5). Read live each frame
   *  so the toggle takes effect with no restart; null → default aan. */
  setFollowSource(source: (() => boolean) | null): void {
    this.cameraFollowSource = source;
  }

  /** F-17: a drag orbits the lens — free yaw (drag right → the lens orbits right around
   *  the ranger) and a clamped eye-lift (drag up → look further down; drag down →
   *  flatten toward the horizon). Only the lens moves, never the ranger. */
  orbitDrag(dx: number, dy: number): void {
    this.orbitTargetYaw += dx * this.ORBIT_YAW_PER_PX;
    this.orbitTargetLift = Math.max(this.ORBIT_LIFT_MIN, Math.min(this.ORBIT_LIFT_MAX,
      this.orbitTargetLift - dy * this.ORBIT_LIFT_PER_PX));
  }

  /**
   * F-16 dolly floor: outside the avatar's own radius + the near plane (the F-05
   * min-clamp intent — a full zoom-in never buries the lens inside the ranger), and
   * set just PAST the F-05 fade rail's `far` threshold (`avatarRadius + 1.1`) so the
   * closest zoom keeps the ranger SOLID (opacity 1) rather than fading him translucent
   * — a faded ranger at max zoom-in reads as the exact "murk" the F-05 saga chased.
   * Kept a metre below the ceiling so min < max even if a mis-scaled rig inflates
   * `avatarRadius`.
   */
  zoomMinBoom(): number {
    return Math.min(this.player.avatarRadius + 1.3, this.CAM_ZOOM_MAX - 1);
  }

  /**
   * F-16 laptop wheel / trackpad-pinch DOLLY zoom on the walk follow-boom.
   * Player-initiated + clamped [zoomMinBoom() … CAM_ZOOM_MAX]; NEVER a FOV zoom
   * (fixed lens is the motion-comfort law). The boom TARGET moves instantly here;
   * CameraRig.place then eases the camera toward it (damped ~0.3 s) — or CUTS to it under
   * reduced-motion (CameraRig.place snaps then), exactly the "zoom applies as an instant
   * step" the finding asks for. Ignored while driving/flying/in an activity (those own
   * the camera). preventDefault stops the page scrolling under the canvas.
   */
  readonly onWheel = (e: WheelEvent): void => {
    if (this.host.inputBlocked()) return;
    e.preventDefault();
    const next = this.zoomDist + e.deltaY * this.CAM_ZOOM_STEP;
    this.zoomDist = Math.max(this.zoomMinBoom(), Math.min(this.CAM_ZOOM_MAX, next));
  };

  /**
   * Place the follow-camera (§1e position follow + W1.5 rotating bearing).
   *
   * The horizontal offset is the fixed distance/height rotated by `followYaw`:
   * `-(sin yaw, cos yaw)·distance` sits the camera behind the ranger's facing.
   * When the follow rotates (toggle on AND not reduced-motion) `followYaw` eases
   * toward the steering's target with the damped, rate-clamped `dampedYaw`; else it
   * is pinned to π — the pre-W1.5 straight-behind bearing (reduced-motion falls
   * back to the fixed bearing per §3.2). The lens hangs off a smoothed pivot on a
   * smoothed boom at that bearing (see below) unless `snap` (reduced-motion cut,
   * first placement), which sets it at once. Roll is always 0 and the FOV is fixed
   * at construction — the motion-comfort law.
   */
  place(snap: boolean, dt = 0, reduced = false): void {
    // a hitch (a long frame) never turns into a jump of the view: the camera eases at
    // most one 20 fps frame's worth per frame and catches up over the next ones
    dt = Math.min(dt, 0.05);
    const rp = this.player.group.position;
    const { inVehicle, inHeli } = this.host.mode();
    const follow = this.cameraFollowSource ? this.cameraFollowSource() : true;
    const followBefore = this.followYaw;
    if (follow && !reduced) {
      const walking = !inVehicle && !inHeli;
      this.followYaw = walking
        ? dampedYaw(this.followYaw, this.followTargetYaw, dt, this.followTau, this.followMaxRate)
        : dampedYaw(this.followYaw, this.followTargetYaw, dt);
    } else {
      // fixed bearing: straight behind on +z, no rotation — and reset the target
      // so re-enabling the follow doesn't whip-pan from a stale facing.
      this.followYaw = FIXED_FOLLOW_YAW;
      this.followTargetYaw = FIXED_FOLLOW_YAW;
    }
    // F-17 player orbit: ease the drag-set look toward its target with the boom's own
    // exp-damp, or CUT to it under reduced-motion (a step, never an interpolation — the
    // motion-comfort law). Layered ON TOP of the follow bearing, so the auto-follow still
    // re-centres behind the ranger as he walks with the player's offset held on top.
    if (reduced) {
      this.orbitYaw = this.orbitTargetYaw;
      this.orbitLift = this.orbitTargetLift;
    } else if (dt > 0) {
      const k = dampFactor(dt, this.ORBIT_TAU);
      this.orbitYaw += (this.orbitTargetYaw - this.orbitYaw) * k;
      this.orbitLift += (this.orbitTargetLift - this.orbitLift) * k;
    }
    // W5.1/W5.3b: the jeep uses the wider offset (distance 9, height 4.5) and the
    // helicopter a higher aerial one (13, 6); walking keeps the F-05 clearance rig
    // (boom 4.6, eye 2.4). Same damping — the pull-back (and climb) eases on board.
    const walk = !inVehicle && !inHeli;
    // the walk boom's bearing = follow + the player's orbit + the clear-view side offset
    // (the vehicle/heli cams own their framing, so they ignore both).
    const off = inHeli ? this.camOffsetHeli : inVehicle ? this.camOffsetVehicle : this.camOffset;
    let dist = off.z;
    let eye = off.y;
    if (walk) {
      this.gatherNear(rp);
      // search the bearings (not in reduced motion, and not while the player drags the view)
      const base = wrapAngle(this.followYaw + this.orbitYaw);
      // where he will be in ~half a second, so the dodge starts before a person or tree
      // is in the line, not after
      if (dt > 0 && this.placed) this.vel.set(rp.x - this.lastRp.x, 0, rp.z - this.lastRp.z).divideScalar(dt);
      this.lastRp.copy(rp);
      this.ahead.copy(rp).addScaledVector(this.vel, this.AVOID_LOOKAHEAD);
      this.ahead.y = this.terrain.y(this.ahead.x, this.ahead.z);
      let urgent = false;
      this.avoidHeld += dt;
      this.sinceTurn = this.player.turning ? 0 : this.sinceTurn + dt;
      if (reduced || this.player.dragging) this.avoidTarget = 0;
      else if (this.player.turning || this.sinceTurn < this.AVOID_AFTER_TURN) {
        // the player is turning the view himself, or just did: the dodge holds still (it
        // never adds a turn of its own on top, nor starts one the moment he lets go)
      } else {
        // score each side offset now and where he is heading; keep the current choice
        // unless it is blocked or another is clearly better and it has been held a while
        let best = Infinity, pick = 0, cur = Infinity;
        for (const o of this.AVOID_OFFSETS) {
          const now = this.solveWalk(wrapAngle(base + o), rp).cost;
          const cost = now + this.solveWalk(wrapAngle(base + o), this.ahead).cost + Math.abs(o) * 0.8;
          if (o === this.avoidTarget) { cur = cost; urgent = now >= 4; }
          if (cost < best - 1e-9) { best = cost; pick = o; }
        }
        const change = pick !== this.avoidTarget &&
          (urgent || (this.avoidHeld >= this.AVOID_HOLD && best < cur - 0.3));
        if (change) { this.avoidTarget = pick; this.avoidHeld = 0; }
      }
      if (reduced || snap) this.avoidYaw = this.avoidTarget;
      else if (dt > 0 && !this.player.turning && this.sinceTurn >= this.AVOID_AFTER_TURN) {
        const step = (this.avoidTarget - this.avoidYaw) * dampFactor(dt, urgent ? this.AVOID_TAU / 2 : this.AVOID_TAU);
        // the dodge only gets what the follow leaves of the calm turn budget, so the two
        // together never turn the view faster than TURN_BUDGET
        const followStep = Math.abs(wrapAngle(this.followYaw - followBefore));
        const max = Math.min(urgent ? this.AVOID_URGENT_RATE : this.AVOID_MAX_RATE,
          Math.max(0, this.TURN_BUDGET - followStep / dt)) * dt;
        this.avoidYaw += Math.max(-max, Math.min(max, step));
      }
      const sol = this.solveWalk(this.bearing(), rp);
      dist = sol.dist;
      eye = sol.eye;
      this.terrainLiftState = sol.lift;
      this.terrainClearState = sol.terrainClear;
    } else if (inVehicle) {
      // F-30: give the jeep boom F-05's clearance too — a tree / hut / prop BEHIND the
      // jeep pulls the lens IN instead of burying it in that solid's unlit interior,
      // the exact "driving is blind" murk the finding names. The jeep's own collision
      // circle is lifted while driving (enterVehicle), so the cast can't hit itself;
      // the min-clamp keeps the lens outside the JEEP's bounding radius + near plane.
      const b0 = this.bearing();
      const frac = this.boomClearFraction(rp.x, rp.z, -Math.sin(b0) * dist, -Math.cos(b0) * dist);
      const minFrac = Math.min(1, (JEEP_COLLIDE + this.camera.near + 0.3) / dist);
      dist *= Math.max(minFrac, frac);
    }
    const bearing = this.bearing();
    const s = Math.sin(bearing), c = Math.cos(bearing);
    // Wave 2: the lens hangs off a smoothed PIVOT (the ranger's spot) on a smoothed
    // boom (length + eye height) at the follow BEARING. The bearing is already eased
    // (followYaw above), so the view turns exactly as much as the bearing does: no
    // extra swing-lag after a turn stops (the old whole-position lerp added ~0.3 s of
    // lag, so the view kept turning ~30° after the key came up) and no corner-cutting
    // toward the ranger mid-turn. The boom pulls IN fast (a solid appears behind him)
    // and lets out slowly (calm). A cut (reduced motion, first placement) sets all of
    // it at once.
    if (snap || !this.placed) {
      this.pivot.copy(rp);
      this.boomNow = dist;
      this.eyeNow = eye;
      this.extOff.set(0, 0, 0);
    } else {
      this.pivot.lerp(rp, dampFactor(dt, walk ? this.PIVOT_TAU : this.PIVOT_TAU_VEHICLE));
      this.boomNow += (dist - this.boomNow) * dampFactor(dt, dist < this.boomNow ? this.BOOM_IN_TAU : this.BOOM_OUT_TAU);
      this.eyeNow += (eye - this.eyeNow) * dampFactor(dt, eye > this.eyeNow ? this.EYE_UP_TAU : this.EYE_DOWN_TAU);
      // someone else moved the lens since the last frame (a mini-game's reframe): ease
      // from where it left it instead of cutting (the old whole-position lerp did this)
      if (this.camera.position.distanceToSquared(this.lastSet) > 1e-8) {
        this.extOff.copy(this.camera.position).sub(this.lensAt(this._lens, s, c));
      }
      this.extOff.multiplyScalar(1 - dampFactor(dt, 0.3));
    }
    this.lensAt(this.camDesired, s, c).add(this.extOff);
    this.camera.position.copy(this.camDesired);
    this.lastSet.copy(this.camDesired);
    this.placed = true;
    this.camera.up.set(0, 1, 0); // roll = 0 always
    // look at the smoothed pivot the boom hangs off (not his live feet), so the view's
    // yaw IS the eased bearing: a boom pulling in or his steps can never add a twist
    this.camera.lookAt(this.pivot.x, this.pivot.y + (walk ? this.camLookH : this.camIdleLookH), this.pivot.z);
    // F-05 fade rail: if the boom still collapses toward the ranger (an occluder
    // right behind him, or a rig that renders larger than its honest measured height)
    // fade the ranger out rather than smear his interior across the lens — the
    // world stays visible. Opacity is a pure function of the REAL lens→ranger
    // distance, so it is a cut under reduced-motion too (no camera move).
    if (walk) {
      const hd = Math.hypot(this.camera.position.x - rp.x, this.camera.position.z - rp.z);
      const near = this.player.avatarRadius + 0.3, far = this.player.avatarRadius + 1.1;
      this.player.setAvatarOpacity(Math.max(0, Math.min(1, (hd - near) / (far - near))));
      // D1.5 occluder fade: when a tree stands between the lens and the ranger on the free
      // walk — OR the lens sits INSIDE a crown — fade the canopy so he is never lost in a
      // full-frame foliage void (`09-walk-4`) or murk (`11-controls-hud`). TWO occlusion
      // models, because a between-lens sightline test alone misses the lens-inside-crown case
      // the GATE-D1 audit #2 convicted: the boom collapses behind the ranger (a trunk he just
      // passed is a collision solid, boomClearFraction pulls the lens IN) and
      // drives the lens into that crown; its centre then sits at ~t=0 on the cam→ranger segment,
      // read as "behind the lens" and skipped, so a frontface-only ray exits unhit and the hook
      // lied `viewClear`=true over raw leaves. (1) camInsideCrown — the camera POINT inside any
      // crown sphere (a point-in-volume test — no frontface blind spot); (2) canopyBlocksSightline
      // — a crown genuinely between lens and ranger (the `10-walk-5` sapling), tested to his HEAD
      // (where low foliage swallows him first) AND his chest so a bush over his face never reads
      // clear just because his boots show. setCanopyOpacity dims EVERY tree mesh at once, so this
      // fades every crown on the sightline, not only the first hit. Attack fast (a cut to the fade
      // target the frame it is blocked, so `viewClear` flips true at once and the ranger reads
      // through it — buried ⇒ near-invisible CANOPY_FADE_BURIED so stacked overlapping crowns
      // still clear, a lone between-lens crown ⇒ the gentler CANOPY_FADE_MIN), release slow (ease
      // back to solid) to kill edge flicker; under reduced-motion / on a snap both are cuts, so an
      // idle frame behind a tree stays pixel-frozen (constant block → constant opacity → no
      // per-frame change). A fade is an opacity change, never a camera move, so orbit/zoom/reframe
      // stays player-initiated (frozen comfort law, §2.5).
      const cp = this.camera.position;
      const insideCrown = this.lensInCrown(cp.x, cp.y, cp.z, this.CROWN_INSIDE_MARGIN, true);
      const headY = rp.y + this.player.avatarTopY, chestY = rp.y + this.camLookH;
      const blocked = insideCrown ||
        this.crownBetween(cp.x, cp.y, cp.z, rp.x, headY, rp.z, true) ||
        this.crownBetween(cp.x, cp.y, cp.z, rp.x, chestY, rp.z, true);
      let co: number;
      if (blocked) co = insideCrown ? this.CANOPY_FADE_BURIED : this.CANOPY_FADE_MIN; // attack: instant dim (buried ⇒ deeper, never a hidden frame)
      else if (reduced || snap) co = 1;                             // RM / cut: snap back solid
      else co = this.dressing.canopyOpacity + (1 - this.dressing.canopyOpacity) * dampFactor(dt, this.CANOPY_RELEASE_TAU); // release: gentle ease up
      this.dressing.setCanopyOpacity(co);
      // viewClear is FALSE while a fadeable crown on the line still sits above SEE_THROUGH
      // opacity, a terrain crest still blocks the cam→head line (the lift capped out), or an
      // UNFADEABLE prop tree is in the way (its crown between, or the lens in its leaves).
      // D3.16's solid prop / vehicle / animal occluders are folded in per-SHOT (camState).
      const solidTree = this.lensInCrown(cp.x, cp.y, cp.z, 0, false) ||
        this.crownBetween(cp.x, cp.y, cp.z, rp.x, headY, rp.z, false) ||
        this.crownBetween(cp.x, cp.y, cp.z, rp.x, chestY, rp.z, false);
      this.viewClearState = (!blocked || this.dressing.canopyOpacity <= this.CANOPY_SEE_THROUGH) &&
        this.terrainClearState && !solidTree;
    } else {
      if (this.player.avatarOpacity !== 1) this.player.setAvatarOpacity(1); // never leave the driver faded when he re-emerges
      if (this.dressing.canopyOpacity !== 1) this.dressing.setCanopyOpacity(1); // never leave the canopy faded off-foot
      this.viewClearState = true;
      this.terrainLiftState = 0;   // no boom on a vehicle/heli/mission cam → nothing ridden
      this.terrainClearState = true;
    }
    // D3.16: fade the ground "go here" rings by the lens's proximity so a marker ring
    // never reads as a frame-filling hoop at a collapsed close boom (`18-jeep-near`).
    // Runs in BOTH branches (a ring faded on foot restores once a vehicle cam pulls the
    // lens far away). Rings are wayfinding UI (§3), so shrinking them near is on-spec.
    this.host.afterPlace();
  }

  /** The lens for this frame's smoothed pivot / boom / eye at bearing (s, c). */
  private lensAt(out: THREE.Vector3, s: number, c: number): THREE.Vector3 {
    return out.set(this.pivot.x - s * this.boomNow, this.pivot.y + this.eyeNow, this.pivot.z - c * this.boomNow);
  }

  /** F-11: the fraction of the boom (origin ox,oz; vector dx,dz) that stays inside the
   *  world-rim ring (bound − 0.8 m), so the lens never ends in the rim tree-line. */
  private rimFraction(ox: number, oz: number, dx: number, dz: number): number {
    const R = this.limits.bound - 0.8;
    const ex = ox + dx, ez = oz + dz;
    if (ex * ex + ez * ez <= R * R) return 1;
    // solve |o + t·d| = R for the t in (0, 1]
    const a = dx * dx + dz * dz, b = 2 * (ox * dx + oz * dz), cc = ox * ox + oz * oz - R * R;
    const disc = b * b - 4 * a * cc;
    if (a < 1e-9 || disc < 0) return 1;
    return Math.max(0, Math.min(1, (-b + Math.sqrt(disc)) / (2 * a)));
  }

  /** Rebuild the crown list when the forest changed (the scatter, then the prop trees). */
  private refreshCrowns(): void {
    const key = `${this.dressing.treePlacements.length}/${this.obstacles.length}`;
    if (key === this.crownKey) return;
    this.crownKey = key;
    this.crowns.length = 0;
    const add = (kind: string, H: number, x: number, y: number, z: number, fade: boolean): void => {
      const pr = CROWN_PROFILE[kind];
      if (!pr) return;
      this.crowns.push({
        x, z, y: y + H * (pr.y0 + pr.y1) / 2,
        R: H * pr.r * this.CROWN_GROW, V: (H * (pr.y1 - pr.y0) / 2) * this.CROWN_GROW, fade,
      });
    };
    for (const p of this.dressing.treePlacements) add(p.species, TREE_BASE_H[p.species] * p.s, p.x, p.y, p.z, true);
    for (const o of this.obstacles) if (o.crown) add(o.crown.kind, o.crown.h, o.x, o.crown.y, o.z, false);
  }

  /** This frame's crowns, solids and creatures within reach of the walk boom. */
  private gatherNear(rp: THREE.Vector3): void {
    this.refreshCrowns();
    const reach = this.CAM_ZOOM_MAX + 4;
    this.nearCrowns.length = this.nearSolids.length = this.nearCreatures.length = 0;
    for (const k of this.crowns) {
      const r = reach + k.R;
      if (Math.abs(k.x - rp.x) < r && Math.abs(k.z - rp.z) < r) this.nearCrowns.push(k);
    }
    for (const o of this.obstacles) {
      const r = reach + o.r;
      if (Math.abs(o.x - rp.x) < r && Math.abs(o.z - rp.z) < r) this.nearSolids.push(o);
    }
    for (const a of this.host.creatures()) {
      if (Math.abs(a.x - rp.x) < reach && Math.abs(a.z - rp.z) < reach) this.nearCreatures.push(a);
    }
  }

  /**
   * Solve the walk boom at bearing `b`: the player's zoom, pulled in before a solid
   * (buildings, trunks, people: the spherecast) and the rim, then further in while the
   * lens would sit in foliage; the eye at the settled follow pitch, above its own ground
   * and lifted until the line to his head clears the terrain. `cost` scores how clear the
   * line to the ranger is (0 = clear at full length); the search picks the lowest.
   */
  private solveWalk(b: number, rp: THREE.Vector3): CameraRig['sol'] {
    const out = this.sol;
    const s = Math.sin(b), c = Math.cos(b);
    const want = this.zoomDist;
    const minDist = Math.min(want, this.player.avatarRadius + this.camera.near + 0.2);
    const frac = Math.min(this.boomClearFraction(rp.x, rp.z, -s * want, -c * want, true),
      this.rimFraction(rp.x, rp.z, -s * want, -c * want));
    let dist = Math.max(minDist, want * frac);
    const lookH = this.camLookH;
    const eyeAt = (d: number): number => lookH + (this.camOffset.y + this.orbitLift - lookH) * (d / want);
    // never a lens in the leaves: step the boom in until it is out of every crown
    // (not below 35 % of the zoom: then the canopy fade has to carry it)
    let lensInCrown = this.lensInCrown(rp.x - s * dist, rp.y + eyeAt(dist), rp.z - c * dist, 0.3, null);
    if (lensInCrown) {
      for (let d = dist - 0.3; d >= Math.max(minDist, want * 0.35); d -= 0.3) {
        if (!this.lensInCrown(rp.x - s * d, rp.y + eyeAt(d), rp.z - c * d, 0.3, null)) { dist = d; lensInCrown = false; break; }
      }
    }
    // D1.5 (audit #4): keep the WHOLE cam→ranger SIGHTLINE above the RENDERED terrain, not
    // just the lens above the ground under itself (a clearance lift only, deterministic).
    let eye = eyeAt(dist);
    const lx = rp.x - s * dist, lz = rp.z - c * dist;
    const gLens = this.terrain.y(lx, lz);
    if (rp.y + eye < gLens + this.CAM_GROUND_CLR) eye = gLens + this.CAM_GROUND_CLR - rp.y;
    const headY = rp.y + this.player.avatarTopY;
    const need = this.terrainSightlineLift(lx, rp.y + eye, lz, rp.x, headY, rp.z);
    out.lift = Math.min(need, this.MAX_TERRAIN_LIFT);
    eye += out.lift;
    out.terrainClear = need <= this.MAX_TERRAIN_LIFT;
    out.dist = dist;
    out.eye = eye;
    out.lensInCrown = lensInCrown;
    // how clear is the line to him from there?
    const ly = rp.y + eye, chestY = rp.y + this.player.avatarTopY * 0.35;
    let cost = (want - dist) / want;                                   // prefer the full boom
    if (lensInCrown) cost += 3;
    if (!out.terrainClear) cost += 2;
    if (this.solidBetween(lx, lz, rp.x, rp.z)) cost += 4;              // a building / prop / person in the line
    if (this.solidHugsLens(lx, lz)) cost += 0.8;                        // …or right beside the lens, filling a side of the frame
    if (this.creatureBetween(lx, ly, lz, rp.x, headY, chestY, rp.z)) cost += 4;
    if (this.crownBetween(lx, ly, lz, rp.x, headY, rp.z, false)) cost += 4; // an unfadeable prop tree
    else if (this.crownBetween(lx, ly, lz, rp.x, headY, rp.z, true)) cost += 0.5; // the forest fades, but a clear line is nicer
    out.cost = cost;
    return out;
  }

  /** Is (x, y, z) inside a crown grown by `margin`? `fade`: only fadeable (true),
   *  only unfadeable (false) or any (null) crowns. Walks this frame's near crowns. */
  private lensInCrown(x: number, y: number, z: number, margin: number, fade: boolean | null): boolean {
    const list = this.nearCrowns.length || this.crowns.length === 0 ? this.nearCrowns : this.crowns;
    for (const k of list) {
      if (fade !== null && k.fade !== fade) continue;
      const R = k.R + margin, V = k.V + margin;
      const dx = x - k.x, dy = y - k.y, dz = z - k.z;
      if ((dx * dx + dz * dz) / (R * R) + (dy * dy) / (V * V) <= 1) return true;
    }
    return false;
  }

  /**
   * Does a crown cross the straight line from the lens (cx,cy,cz) to the ranger aim
   * (ax,ay,az)? Only a crown genuinely BETWEEN them counts: one behind the lens or beyond
   * him (foot parameter outside 0.02–0.9) is a backdrop. The ellipsoid is squashed to a
   * sphere (y scaled by R/V) so the closest-approach test is exact. `fade` as lensInCrown.
   */
  private crownBetween(cx: number, cy: number, cz: number, ax: number, ay: number, az: number, fade: boolean): boolean {
    for (const k of this.nearCrowns) {
      if (k.fade !== fade) continue;
      const q = k.R / k.V;
      const px = cx - k.x, py = (cy - k.y) * q, pz = cz - k.z;
      const dx = ax - cx, dy = (ay - cy) * q, dz = az - cz;
      const len2 = dx * dx + dy * dy + dz * dz;
      if (len2 < 1e-6) continue;
      const t = -(px * dx + py * dy + pz * dz) / len2;
      if (t <= 0.02 || t >= 0.9) continue;
      const gx = px + dx * t, gy = py + dy * t, gz = pz + dz * t;
      if (gx * gx + gy * gy + gz * gz <= k.R * k.R) return true;
    }
    return false;
  }

  /** A building, prop or person (not a fadeable tree) in the line from the lens to him
   *  on the ground plane — the same test the dev hook's viewClear uses. */
  private solidBetween(cx: number, cz: number, ax: number, az: number): boolean {
    for (const o of this.nearSolids) {
      if (o.tree) continue;
      if (obstacleGap(o, ax, az) + (o.box ? o.box.pad : 0) <= 0) continue; // the prop he stands at
      if (segmentCrosses(o, cx, cz, ax, az, 0.05, 0.95)) return true;
    }
    return false;
  }

  /** A building, prop or person (not a tree trunk) within arm's reach of the lens. */
  private solidHugsLens(lx: number, lz: number): boolean {
    for (const o of this.nearSolids) {
      if (!o.tree && obstacleGap(o, lx, lz) < 0.8) return true;
    }
    return false;
  }

  /** A creature in the line from the lens to his head or chest (a sphere around its body,
   *  as the dev hook models it). */
  private creatureBetween(cx: number, cy: number, cz: number, ax: number, headY: number, chestY: number, az: number): boolean {
    for (const a of this.nearCreatures) {
      const R = Math.max(0.45, a.h * 0.5) + 0.3, py = a.y + a.h * 0.5; // + a margin: dodge before it is in the way
      for (const ay of [headY, chestY]) {
        const dx = ax - cx, dy = ay - cy, dz = az - cz;
        const len2 = dx * dx + dy * dy + dz * dz;
        if (len2 < 1e-6) continue;
        const t = ((a.x - cx) * dx + (py - cy) * dy + (a.z - cz) * dz) / len2;
        if (t <= 0.03 || t >= 0.97) continue;
        const gx = a.x - (cx + dx * t), gy = py - (cy + dy * t), gz = a.z - (cz + dz * t);
        if (gx * gx + gy * gy + gz * gz <= R * R) return true;
      }
    }
    return false;
  }

  /**
   * F-05 spherecast: the fraction of the walk boom (origin `ox,oz`, vector
   * `dx,dz` = the horizontal offset) that is clear before the lens would enter a
   * collision solid's circle grown by the camera probe radius. 1 = no obstacle in
   * the way. Circles that already CONTAIN the origin (the prop the ranger stands
   * at) are skipped so the lens never collapses onto him at a POI. Cheap 2D
   * ray–circle math over the existing `obstacles` list — deterministic, so the
   * idle-stability assert (yaw/dist steady ±0.01) holds frame to frame.
   */
  private boomClearFraction(ox: number, oz: number, dx: number, dz: number, nearOnly = false): number {
    if (dx * dx + dz * dz < 1e-6) return 1;
    let best = 1;
    for (const o of nearOnly ? this.nearSolids : this.obstacles) {
      const t = segmentEntry(o, ox, oz, dx, dz, this.CAM_PROBE_R); // circles and building rectangles alike
      if (t < best) best = t;
    }
    return best;
  }

  /**
   * D1.5 (audit #4) terrain sightline ride: the metres the follow boom must lift so the STRAIGHT
   * line from the lens (lx,ly,lz) to the ranger aim (ax,ay,az) clears the RENDERED terrain by
   * CAM_GROUND_CLR everywhere between them. Marches the drawn terrain (terrain.y). Raising the lens by δ raises the segment height
   * at parameter t by (1−t)·δ (the aim end is pinned to the ranger), so a crest poking `deficit`
   * above the line at t needs δ ≥ deficit/(1−t); the worst sample wins and clears them all at once
   * (raising the eye lifts every point, never lowers one). Returns the RAW need (the caller caps
   * it at MAX_TERRAIN_LIFT); 0 on flat ground. ~6 BVH ground rays on a 6 m boom — deterministic,
   * so the idle-stability pose holds frame to frame, and on par with the per-frame ground snap. */
  private terrainSightlineLift(lx: number, ly: number, lz: number, ax: number, ay: number, az: number): number {
    const dx = ax - lx, dz = az - lz;
    const horiz = Math.hypot(dx, dz);
    if (horiz < 0.5) return 0; // lens on top of him — nothing between
    const steps = Math.min(24, Math.max(6, Math.ceil(horiz / 2)));
    let need = 0;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (t > 0.85) break; // the last stretch IS the ranger + his own footing, not an occluder between
      const g = this.terrain.y(lx + dx * t, lz + dz * t);
      const segY = ly + (ay - ly) * t;
      const deficit = g + this.CAM_GROUND_CLR - segY;
      if (deficit > 0) { const d = deficit / (1 - t); if (d > need) need = d; }
    }
    return need;
  }
}
