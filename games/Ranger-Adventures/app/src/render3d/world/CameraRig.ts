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
import { dampedYaw, wrapAngle, FIXED_FOLLOW_YAW } from '../FollowCam';
import type { MoveLimits, Obstacle } from '../CharacterController';
import type { Terrain } from './Terrain';
import { TREE_BASE_H, type Dressing } from './Dressing';
import type { Player } from './Player';
import { JEEP_COLLIDE } from './Vehicles';

/** What the camera needs from the rest of the world. */
export interface CameraRigHost {
  /** Riding the jeep / the helicopter (their chase offsets replace the walk boom). */
  mode(): { inVehicle: boolean; inHeli: boolean };
  /** The walking ranger stands at the Missiebord (the over-the-shoulder reframe). */
  nearBoard(): boolean;
  /** An in-place activity, the jeep or the helicopter owns the wheel. */
  inputBlocked(): boolean;
  /** Called after every placement (the "go here" rings fade by the lens). */
  afterPlace(): void;
}

export class CameraRig {
  private readonly camDesired = new THREE.Vector3();
  // F-05: the third-person walk boom, rebuilt with guaranteed clearance and
  // brought in + down from the giant-era (3.4, 6.2) rig so the ranger reads
  // human-sized in an immersive over-the-shoulder frame. The old rig had no
  // anti-clip rail, so the boom buried itself in whatever solid stood behind the
  // ranger at a POI (the spawn hub, the dune by the jeep) and rendered that prop's
  // unlit interior — Floris's #1 finding. placeCamera now spherecasts this boom
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
  // D1.5 free-walk occluder fade — the crown model for the cam→avatar sightline test.
  // A tree's foliage is approximated as a sphere at CROWN_CENTER_FRAC of its GLB height
  // (`TREE_BASE_H`×scale) with CROWN_RADIUS_FRAC radius. The trunk anti-clip
  // (boomClearFraction) + the ranger fade already cover a trunk BEHIND him; the gap is
  // the wide CROWN the lens lands INSIDE on a forest walk (`09-walk-4` full-frame void),
  // which the projection-based avatarInView/onScreen cannot see. When a crown crosses the
  // sightline the canopy is FADED (an opacity change, never a camera move → no
  // comfort-law risk, §2.5) so the ranger is never lost behind leaves.
  private readonly CROWN_CENTER_FRAC = 0.55; // crown centre height ÷ tree height (low enough to reach a head-height sightline)
  private readonly CROWN_RADIUS_FRAC = 0.38; // crown radius ÷ tree height (the foliage volume, not the trunk)
  private readonly CANOPY_FADE_MIN = 0.16;   // a lone between-lens crown ⇒ fade to this (the ranger reads through it)
  private readonly CANOPY_FADE_BURIED = 0.04; // lens INSIDE a crown ⇒ fade near-invisible so stacked overlapping foliage still reads through (GATE-D1 audit #2: 0.16 global was still murk when buried)
  private readonly CROWN_INSIDE_MARGIN = 0.6; // grow the crown for the lens-inside test so the fade LEADS the bury (no pop as the boom collapses into a crown)
  private readonly CANOPY_SEE_THROUGH = 0.5; // canopy ≤ this ⇒ ranger reads through ⇒ viewClear true
  private readonly CANOPY_RELEASE_TAU = 0.7; // gentle ease back to solid once the crown clears (calm, no pop)
  // F-16 laptop dolly zoom: the player-set WALK boom distance (m, horizontal). Starts
  // at the F-05 default (camOffset.z = 4.6); wheel/trackpad scroll dollies it in/out,
  // clamped [zoomMinBoom() … CAM_ZOOM_MAX]. placeCamera reads it for the walk boom, so
  // the existing position-damp gives the damped feel (and a CUT under reduced-motion,
  // where placeCamera already snaps). The FOV is NEVER touched — a dolly, not a lens
  // zoom (motion-comfort law). Vehicle/heli/activity own the camera, so a scroll there
  // is ignored (onWheel returns early).
  readonly CAM_ZOOM_MAX = 9.5;   // dolly ceiling (~8–10 m boom, F-16)
  private readonly CAM_ZOOM_STEP = 0.01; // wheel deltaY → metres of boom change per notch
  zoomDist = this.camOffset.z;   // current player-set walk boom (default = F-05 rig)
  viewClearState = true;        // D1.5 last cam→avatar sightline-clear read (camState reports it)
  terrainClearState = true;     // D1.5 (audit #4) last cam→avatar TERRAIN-clear read (folded into viewClear)
  terrainLiftState = 0;         // D1.5 (audit #4) metres the follow boom rode up to clear a dune this frame (0 = flat)
  // W1.5 rotating follow-cam: `followYaw` is the eased camera bearing; it chases
  // `followTargetYaw` (the ranger's facing, updated ONLY while he is moving — a
  // standing ranger never swings the camera). Both start at π = straight behind
  // on +z (the pre-W1.5 diorama bearing). Damped + rate-clamped in FollowCam.ts.
  followYaw = FIXED_FOLLOW_YAW;
  followTargetYaw = FIXED_FOLLOW_YAW;
  // "Camera draait mee" toggle (Instellingen, default aan), read LIVE each frame
  // so flipping it needs no restart; reduced-motion also forces the fixed bearing.
  private cameraFollowSource: (() => boolean) | null = null;
  // F-17 laptop drag-orbit: a PLAYER look-around layered ON TOP of the follow bearing.
  // `orbitYaw` (free, wraps) rotates the walk boom around the ranger; `orbitLift` (m,
  // clamped) raises/lowers the eye to tilt the view (the camera's real pitch — shown on
  // the hook — follows). Both EASE toward their drag-set targets with the boom's own
  // exp-damp, or CUT to them under reduced-motion (the "orbit as stepped cuts" the
  // finding asks for). placeCamera applies them to the WALK cam only, so the drag moves
  // ONLY the lens — never `pos` (the F-17 defect was a drag relocating the ranger). The
  // click-vs-drag seam (onPointerDown/Move/Up) routes a clean tap to tap-to-walk and a
  // past-threshold drag to the orbit alone. Input forward stays on the base bearing
  // (cameraYaw unchanged) so orbiting can never feed back into a heading spin.
  orbitYaw = 0;
  private orbitTargetYaw = 0;
  orbitLift = 0;
  private orbitTargetLift = 0;
  private readonly ORBIT_YAW_PER_PX = 0.005;  // rad of yaw per CSS px dragged (feel: demo)
  private readonly ORBIT_LIFT_PER_PX = 0.02;  // m of eye-lift per CSS px dragged (feel: demo)
  private readonly ORBIT_LIFT_MIN = -1.2;     // eye lower → flatter, toward the horizon (~pitch up)
  private readonly ORBIT_LIFT_MAX = 3.0;      // eye higher → more top-down (~pitch down)
  private readonly ORBIT_TAU = 0.18;          // orbit ease smooth-time (snappier than the follow)
  // P1.0 (F-19) board-approach framing: when the walking ranger stands in the
  // case-board's near-radius, `boardFrameYaw` eases onto the follow bearing so the
  // lens swings to an over-the-shoulder three-quarter — the board FACE + its pinned
  // papers clear the ranger's body instead of hiding directly behind his spine,
  // while lookAt keeps the WHOLE ranger framed at believable scale. Player-initiated
  // (walking INTO the radius), damped like the orbit, and a CUT under reduced-motion
  // (the motion-comfort law: a reframe is a stepped cut, never a swoop). Eases back
  // to 0 on leaving, so free-roam is untouched. The board is ALSO statically turned
  // `BOARD_APPROACH_FACE_TURN` toward the +x swing side (placeHub) so its face + notes
  // stay readable at that angle instead of going edge-on.
  private boardFrameYaw = 0;
  private readonly BOARD_FRAME_YAW = 0.9;      // over-the-shoulder swing (rad) when near the board
  private readonly BOARD_FRAME_TAU = 0.16;     // board-reframe ease smooth-time (gentle, settles fast)
  // the wider vehicle follow-cam offset (§5 W5.1: distance 9, height 4.5) — the
  // walking offset stays (0, 3.4, 6.2). placeCamera picks by `inVehicle`.
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
   * placeCamera then eases the camera toward it (damped ~0.3 s) — or CUTS to it under
   * reduced-motion (placeCamera snaps then), exactly the "zoom applies as an instant
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
   * toward the ranger's facing with the damped, rate-clamped `dampedYaw`; else it
   * is pinned to π — the pre-W1.5 straight-behind bearing (reduced-motion falls
   * back to the fixed bearing per §3.2). Position exp-damps (~0.3 s) unless
   * `snap` (reduced-motion cut, activity resume, or first placement). Roll is
   * always 0 and the FOV is fixed at construction — the motion-comfort law.
   */
  place(snap: boolean, dt = 0, reduced = false): void {
    const rp = this.player.group.position;
    const { inVehicle, inHeli } = this.host.mode();
    const follow = this.cameraFollowSource ? this.cameraFollowSource() : true;
    if (follow && !reduced) {
      this.followYaw = dampedYaw(this.followYaw, this.followTargetYaw, dt);
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
    // P1.0 (F-19) board-approach framing: ease a fixed over-the-shoulder yaw offset
    // onto the follow bearing whenever the walking ranger stands in the case-board's
    // near-radius, so the lens swings off his spine and the board FACE + papers clear
    // his body. A CUT under reduced-motion (stepped, never a swoop); eases to 0 on
    // leaving. Walk cam only — the vehicle/heli cams own their framing (bearing below).
    const boardFrameTarget = (walk && this.host.nearBoard()) ? this.BOARD_FRAME_YAW : 0;
    if (reduced) {
      this.boardFrameYaw = boardFrameTarget;
    } else if (dt > 0) {
      this.boardFrameYaw += (boardFrameTarget - this.boardFrameYaw) * dampFactor(dt, this.BOARD_FRAME_TAU);
    }
    // the walk boom's effective bearing = follow + the player's orbit + the board
    // reframe (the vehicle/heli cams own their framing, so they ignore both offsets);
    // s/c rotate the boom + spherecast.
    const bearing = walk ? wrapAngle(this.followYaw + this.orbitYaw + this.boardFrameYaw) : this.followYaw;
    const s = Math.sin(bearing), c = Math.cos(bearing);
    const off = inHeli ? this.camOffsetHeli : inVehicle ? this.camOffsetVehicle : this.camOffset;
    let dist = off.z;
    let boomK = 1; // D3.16: the fraction the F-05 anti-clip shrank the WALK boom (1 = untouched)
    // F-05 anti-clip (walk only): spherecast the boom against the collision solids
    // (the same circles the ranger can't walk through) so a prop or hut BEHIND the
    // ranger pulls the lens IN instead of rendering that prop's unlit interior. The
    // eye height stays put (a pull-in, never a dip); the min clamp keeps the lens
    // outside the ranger's own radius + near plane.
    if (walk) {
      dist = this.zoomDist; // F-16: the player-set dolly distance replaces the fixed 4.6 boom
      const frac = this.boomClearFraction(rp.x, rp.z, -s * dist, -c * dist);
      const minFrac = Math.min(1, (this.player.avatarRadius + this.camera.near + 0.2) / dist);
      boomK = Math.max(minFrac, frac);
      dist *= boomK;
    } else if (inVehicle) {
      // F-30: give the jeep boom F-05's clearance too — a tree / hut / prop BEHIND the
      // jeep pulls the lens IN instead of burying it in that solid's unlit interior,
      // the exact "driving is blind" murk the finding names. The jeep's own collision
      // circle is lifted while driving (enterVehicle), so the cast can't hit itself;
      // the min-clamp keeps the lens outside the JEEP's bounding radius + near plane.
      const frac = this.boomClearFraction(rp.x, rp.z, -s * dist, -c * dist);
      const minFrac = Math.min(1, (JEEP_COLLIDE + this.camera.near + 0.3) / dist);
      dist *= Math.max(minFrac, frac);
    }
    // F-17 pitch: the player's eye-lift tilts the WALK view. The horizontal boom is
    // unchanged, so the F-05 spherecast/min-clamp + fade rail stay exactly valid — only
    // the eye rises/drops, and the fixed lookAt at chest turns that into a down/up tilt.
    // D3.16: keep the WALK follow pitch in its normal band when F-05 pulls the boom IN.
    // The eye used to stay HIGH (off.y) while the horizontal boom collapsed, tipping the
    // lens toward straight-down (the `18-jeep-near` −1.17 breach, boom ~0.7 m under a
    // 2.4 m eye). Scale the eye's height ABOVE the look-point by the SAME fraction the
    // boom shrank, so a pull-in becomes a pure radial dolly-IN at the settled follow
    // pitch (~−0.33), never a steepening tilt. k=1 (nothing pulled it in) leaves the
    // default framing AND the player's deliberate zoom/orbit-lift untouched; the value is
    // deterministic (function of rp/off/boomK), so the RM cut stays pixel-frozen and the
    // position lerp below still eases it — a geometry change, never a camera-move shake.
    const lookH = walk ? this.camLookH : this.camIdleLookH;
    const eyeAboveLook = off.y + (walk ? this.orbitLift : 0) - lookH;
    const eyeY = rp.y + lookH + eyeAboveLook * (walk ? boomK : 1);
    this.camDesired.set(rp.x - s * dist, eyeY, rp.z - c * dist);
    // F-11: never let the walk lens swing OUT through the world-rim tree-line. When the
    // ranger stops at the edge and turns, the rim-ease cancels his outward step so his
    // residual (tangential) facing can rotate the follow boom back into the NON-collision
    // pine ring (bound + ~1.2 m out) — a trunk then buries the lens and the rim frame
    // reads "ranger nowhere". Clamp the lens's distance-from-centre to just inside the
    // ring so it stays in the open with the tree-line as a backdrop BEHIND the ranger.
    // A pure no-op everywhere but the rim (the cap is only reachable near the edge).
    if (walk) {
      const camR = Math.hypot(this.camDesired.x, this.camDesired.z);
      const capR = this.limits.bound - 0.8;
      if (camR > capR) {
        const k = capR / camR;
        this.camDesired.x *= k;
        this.camDesired.z *= k;
      }
    }
    // D1.5 (audit #4): keep the WHOLE cam→ranger SIGHTLINE above the RENDERED terrain — not
    // just the lens above the ground under itself. A dune face standing between the trailing
    // lens and the ranger is an occluder NO fade can touch (terrain can't be made transparent
    // the way a crown can) — the GATE-D1 audit #4 murk: fresh `11-controls-hud` a full-frame
    // terrain void with NO ranger while the hook lied clear. Keeping only the LENS above the
    // ground does not clear the LINE to a ranger standing in a hollow. Ride the crest instead: first keep the lens above its own rendered ground, then lift the
    // eye until the straight line lens→HEAD clears the drawn terrain by CAM_GROUND_CLR (capped
    // at MAX_TERRAIN_LIFT). This is the D1.3 above-terrain law extended to the whole segment —
    // damped follow behaviour (the lerp below eases it; a CUT on snap / under reduced-motion),
    // never a player-initiated orbit. A clearance lift only (never a downward move) so the idle
    // pose stays deterministic frame to frame (groundSnapY is deterministic).
    if (walk) {
      const gLens = this.terrain.y(this.camDesired.x, this.camDesired.z);
      if (this.camDesired.y < gLens + this.CAM_GROUND_CLR) this.camDesired.y = gLens + this.CAM_GROUND_CLR;
      const aimY = rp.y + this.player.avatarTopY; // clear the line to his HEAD (strictest aim → whole body reads)
      const need = this.terrainSightlineLift(this.camDesired.x, this.camDesired.y, this.camDesired.z, rp.x, aimY, rp.z);
      const lift = Math.min(need, this.MAX_TERRAIN_LIFT);
      this.camDesired.y += lift;
      this.terrainLiftState = lift;
      // the settled (desired) line is clear iff the raw need fit under the cap — read off camDesired
      // (where the eased boom is heading) so a mid-lerp frame doesn't blip false while it rides up;
      // at any settled/shot frame camera==camDesired, so the hook still matches the pixels (§4/§8.7).
      this.terrainClearState = need <= this.MAX_TERRAIN_LIFT;
    }
    if (snap) {
      this.camera.position.copy(this.camDesired);
    } else {
      // exp-damping (~0.3 s) off the REAL frame dt → genuinely frame-rate independent
      // (§C.5 item 2: identical feel at 30/60/120 fps), no shake. Shared dampFactor.
      this.camera.position.lerp(this.camDesired, dampFactor(dt, 0.3));
    }
    this.camera.up.set(0, 1, 0); // roll = 0 always
    this.camera.lookAt(rp.x, rp.y + (walk ? this.camLookH : this.camIdleLookH), rp.z);
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
      // passed is a collision solid, boomClearFraction pulls the lens IN — World.ts:1539) and
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
      const insideCrown = this.camInsideCrown(
        this.camera.position.x, this.camera.position.y, this.camera.position.z,
      );
      const blocked =
        insideCrown ||
        this.canopyBlocksSightline(
          this.camera.position.x, this.camera.position.y, this.camera.position.z,
          rp.x, rp.y + this.player.avatarTopY, rp.z,
        ) ||
        this.canopyBlocksSightline(
          this.camera.position.x, this.camera.position.y, this.camera.position.z,
          rp.x, rp.y + this.camLookH, rp.z,
        );
      let co: number;
      if (blocked) co = insideCrown ? this.CANOPY_FADE_BURIED : this.CANOPY_FADE_MIN; // attack: instant dim (buried ⇒ deeper, never a hidden frame)
      else if (reduced || snap) co = 1;                             // RM / cut: snap back solid
      else co = this.dressing.canopyOpacity + (1 - this.dressing.canopyOpacity) * dampFactor(dt, this.CANOPY_RELEASE_TAU); // release: gentle ease up
      this.dressing.setCanopyOpacity(co);
      // viewClear is FALSE while a sightline occluder still sits above SEE_THROUGH opacity (a
      // canopy crown that hasn't faded through) OR a terrain crest still blocks the cam→head line
      // (the boom-lift capped out, `terrainClearState` above) — both tested against the SAME
      // rendered geometry the pixels show, so the hook can never claim clear over a murk frame
      // (audit #4: terrain used to be untested, so a dune-face frame lied clear). D3.16's solid
      // prop / vehicle / animal occluders are folded in per-SHOT (camState) — they only drive the
      // hook, not the fade, so they cost nothing on the per-frame walk path.
      this.viewClearState = (!blocked || this.dressing.canopyOpacity <= this.CANOPY_SEE_THROUGH) && this.terrainClearState;
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

  /**
   * D1.5 free-walk occluder test: does ANY tree crown intersect the straight cam→avatar
   * segment? Each placement's foliage is modelled as a sphere at CROWN_CENTER_FRAC of its
   * GLB height (`TREE_BASE_H`×scale) with CROWN_RADIUS_FRAC radius; the segment is tested
   * by its closest approach to that centre (≤ R ⇒ the crown is in the way). This is the
   * REAL occlusion the projection-based `avatarInView`/`onScreen` cannot see — they stay
   * true with a crown between lens and ranger (the `09-walk-4` full-frame void, §8.7).
   * Pure numeric math over `treePlacements` — no allocation, no THREE calls, deterministic
   * so the idle-stability pose holds frame to frame; a few-hundred-sphere loop, on par with
   * `boomClearFraction`'s obstacle loop (the tree trunks live in that same list).
   */
  private canopyBlocksSightline(cx: number, cy: number, cz: number, ax: number, ay: number, az: number): boolean {
    const dx = ax - cx, dy = ay - cy, dz = az - cz;
    const len2 = dx * dx + dy * dy + dz * dz;
    if (len2 < 1e-6) return false; // lens on top of him — nothing between
    for (const p of this.dressing.treePlacements) {
      const H = TREE_BASE_H[p.species] * p.s;
      const R = H * this.CROWN_RADIUS_FRAC;
      const ccx = p.x, ccy = p.y + H * this.CROWN_CENTER_FRAC, ccz = p.z;
      const t = ((ccx - cx) * dx + (ccy - cy) * dy + (ccz - cz) * dz) / len2; // foot param, unclamped
      // Only a crown genuinely BETWEEN the lens and the ranger occludes him. A crown behind
      // the lens (t ≤ 0) or BEYOND the ranger (t ≥ ~0.9) is a BACKDROP he stands in front of,
      // not an occluder — fading it would needlessly ghost the tree-line (e.g. the F-11
      // world-rim edge). The 0.9 upper bound also skips the tree he stands directly under
      // (t ≈ 1), whose close-boom collapse the ranger-fade rail already handles.
      if (t <= 0.02 || t >= 0.9) continue;
      const gx = ccx - (cx + dx * t), gy = ccy - (cy + dy * t), gz = ccz - (cz + dz * t);
      if (gx * gx + gy * gy + gz * gz <= R * R) return true;
    }
    return false;
  }

  /**
   * D1.5 lens-inside-crown test (GATE-D1 audit #2's murk case): is the camera POINT inside any
   * tree crown sphere? The between-lens sightline test misses this — a crown the lens sits
   * INSIDE has its centre at ~t=0 on the cam→ranger segment (skipped as "behind the lens"), so
   * a frontface-only ray exits unhit and the frame is raw-foliage murk while `viewClear` lied
   * true (`11-controls-hud` z≈−59: `viewClear`=true + `canopyFade`=1 over full-frame murk). A
   * point-in-sphere test has no frontface blind spot; the crown is grown by CROWN_INSIDE_MARGIN
   * so the fade LEADS the bury (no pop as the boom collapses in). The fade then drives the canopy
   * to CANOPY_FADE_BURIED — near-invisible — so even a stack of overlapping crowns near the lens
   * reads through (fading to 0.16 was still murk when buried, `12-pause-hub`). Same crown model as
   * canopyBlocksSightline (sphere at CROWN_CENTER_FRAC height, CROWN_RADIUS_FRAC radius over
   * `TREE_BASE_H`×scale); pure numeric math over treePlacements — no allocation, deterministic so
   * the idle-stability pose holds frame to frame.
   */
  private camInsideCrown(cx: number, cy: number, cz: number): boolean {
    for (const p of this.dressing.treePlacements) {
      const H = TREE_BASE_H[p.species] * p.s;
      const R = H * this.CROWN_RADIUS_FRAC + this.CROWN_INSIDE_MARGIN;
      const dx = cx - p.x, dy = cy - (p.y + H * this.CROWN_CENTER_FRAC), dz = cz - p.z;
      if (dx * dx + dy * dy + dz * dz <= R * R) return true;
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
  private boomClearFraction(ox: number, oz: number, dx: number, dz: number): number {
    const a = dx * dx + dz * dz;
    if (a < 1e-6) return 1;
    let best = 1;
    for (const o of this.obstacles) {
      const R = o.r + this.CAM_PROBE_R;
      const fx = ox - o.x, fz = oz - o.z;
      const cc = fx * fx + fz * fz - R * R;
      if (cc < 0) continue;                 // origin already inside — ignore this solid
      const b = 2 * (fx * dx + fz * dz);
      const disc = b * b - 4 * a * cc;
      if (disc < 0) continue;               // boom misses the circle
      const t = (-b - Math.sqrt(disc)) / (2 * a);
      if (t > 0 && t < best) best = t;      // nearest entry along the boom
    }
    return best;
  }

  /**
   * D1.5 (audit #4) terrain sightline ride: the metres the follow boom must lift so the STRAIGHT
   * line from the lens (lx,ly,lz) to the ranger aim (ax,ay,az) clears the RENDERED terrain by
   * CAM_GROUND_CLR everywhere between them. Marches the drawn terrain (`groundSnapY`). Raising the lens by δ raises the segment height
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
