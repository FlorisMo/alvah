/**
 * world/CameraRig.ts — the follow camera (the motion-comfort law lives here).
 *
 * A damped, rate-clamped follow bearing that the ranger's steering tells what to do
 * (steer(); a fixed bearing when "Camera draait mee" is off; under reduced motion the
 * bearing holds while he turns and CUTS behind him once the turn rests), the player's
 * drag-orbit and wheel dolly on top, the jeep / helicopter chase offsets, and the rails
 * that keep the ranger (or the vehicle) visible: the lens slides sideways for a clear line
 * to him (never turning the view: its direction belongs to the player), the boom pulls
 * in calmly before a building, prop or person (and never into one), the eye rides over a
 * dune between lens and ranger, and every tree in the way fades (world/Crowns.ts is the
 * one tree model; world/Forest.ts fades exactly the trees found here). The view never
 * tips down steeper than PITCH_MAX: with no room behind him the lens comes in over his
 * shoulder instead of craning up over his head, and only right up against him does he
 * fade out. At the world rim the lens may stand among the rim trees, which fade, so
 * turning round at the edge keeps the normal view. Fixed FOV, roll 0, no shake; every
 * reframe is a cut under reduced motion.
 */

import * as THREE from 'three';
import { dampFactor, easeInOut, lerpAngle, reframeSeconds, yawPitch, aimDir } from '../play/kit-math';
import { dampedYaw, wrapAngle, FIXED_FOLLOW_YAW, FOLLOW_TAU, FOLLOW_MAX_RATE } from '../FollowCam';
import { livePolicy } from '../MotionMode';
import { WALK_SPEED } from '../../core/input';
import { segmentEntry, segmentCrosses, obstacleGap, obstacleSpan, type MoveLimits, type Obstacle } from '../CharacterController';
import type { Terrain } from './Terrain';
import { TREE_BASE_H, type Dressing } from './Dressing';
import type { Player, ViewFrame, CamSteer } from './Player';
import { JEEP_COLLIDE } from './Vehicles';
import { crownOf, insideCrown, blocksLine, leavesFloorAt, type Crown } from './Crowns';

/** What the camera needs from the rest of the world. */
export interface CameraRigHost {
  /** Riding the jeep / the helicopter (their chase offsets replace the walk boom). */
  mode(): { inVehicle: boolean; inHeli: boolean };
  /** An in-place activity, the jeep or the helicopter owns the wheel. */
  inputBlocked(): boolean;
  /** Called after every placement (the "go here" rings fade by the lens). */
  afterPlace(): void;
  /** Every creature standing on the ground (marker animals, the warden and the poacher,
   *  roaming animals): `visit` gets its feet and its height. The view keeps them out of
   *  the line to the ranger. (A visitor, so the per-frame search allocates nothing.) */
  creatures(visit: (x: number, y: number, z: number, h: number) => void): void;
  /** Run 6: what the jeep's chase lens keeps out of besides the solids: the parked
   *  helicopter's whole reach (its rotor overhangs the body circles it collides with).
   *  `visit` gets a centre and a radius; it must not allocate. */
  lensKeepOut(visit: (x: number, z: number, r: number) => void): void;
  /** Run 6 polish: the PARKED jeep, for the walk lens: its body circles as they stand in
   *  the collision list (the walker's keep-out ring, `room` wider than the body) and its
   *  roof (world y); null while it is driven or not placed. The walk boom never pulls in
   *  for it (he stands right beside it to board it): it fades while it stands between the
   *  lens and him, as a tree does (`fadeJeep`: attack at once, release eased by `release`). */
  parkedJeep(): { circles: readonly Obstacle[]; room: number; roof: number } | null;
  fadeJeep(target: number, release: number): void;
}

/** A creature standing on the ground: its feet and its height (m). */
export interface Creature { x: number; y: number; z: number; h: number }

const DEG = Math.PI / 180;

/** Run 7 (feel): a hand-over that would turn the view further than this (climbing into the
 *  jeep from its front turned it ~170° round the jeep) is not a glide but a soft dip-cut
 *  (World.ride): a motion-sensitive child never watches the world swing round. Up to it the
 *  glide stays (never faster than ~90°/s, `handover`). */
export const DIP_TURN = 90 * DEG;

export class CameraRig {
  private readonly camDesired = new THREE.Vector3();
  // The lens model (place): a smoothed pivot + boom length + eye height at the eased
  // bearing, plus a decaying offset when something else moved the lens.
  private readonly pivot = new THREE.Vector3();
  private boomNow = 4.6;
  private eyeNow = 2.4;
  private placed = false;
  private readonly lastSet = new THREE.Vector3();
  private readonly extOff = new THREE.Vector3();
  private readonly _lens = new THREE.Vector3();
  private readonly PIVOT_TAU = 0.15;         // on foot: the lens trails his steps a touch
  private readonly PIVOT_TAU_VEHICLE = 0.3;  // the jeep / helicopter: the old ~0.3 s follow
  // A solid behind him pulls the boom in calmly (child B4: at 0.06 s the view dived onto
  // his head within 0.2 s); the lens never enters the solid meanwhile (`wall`, place()).
  private readonly BOOM_IN_TAU = 0.3;
  private readonly BOOM_OUT_TAU = 0.5;       // …and let the boom out calmly
  private readonly EYE_UP_TAU = 0.25;        // rise over a crest calmly
  private readonly EYE_DOWN_TAU = 0.45;      // settle down calmly
  // The walk boom: eye 2.4 m / boom 4.6 m / aim at his sternum ≈ 19° down (the frozen
  // tap-to-walk smoke taps 32 % from the top expecting ground there, so the horizon must
  // sit above that row). The boom cast keeps it out of solids; the fade rail fades him
  // out if the lens has to come right up to him.
  readonly camOffset = new THREE.Vector3(0, 2.4, 4.6);
  // The look-at aim above his feet, as a FRACTION of his measured head height
  // (`avatarTopY`), so it tracks the ≈1.2 m child rig: walk ≈ sternum, idle ≈ chest.
  private readonly CAM_LOOK_FRAC = 0.65;
  private readonly CAM_IDLE_LOOK_FRAC = 0.59;
  private get camLookH(): number { return this.player.avatarTopY * this.CAM_LOOK_FRAC; }
  private get camIdleLookH(): number { return this.player.avatarTopY * this.CAM_IDLE_LOOK_FRAC; }
  private readonly CAM_PROBE_R = 0.35;  // the lens keeps this far from a solid (lensClear; the jeep's boom cast)
  private readonly WALL_PROBE = 0.12;   // the walk boom's line cast, and the wall the eased boom never passes
  private readonly CAM_GROUND_CLR = 0.5; // keep the lens this far above the terrain
  // The terrain sightline ride: how far the eye may rise to clear a dune between the lens
  // and the ranger (the Veluwe relief is gentle, ~±2.2 m, the ven ~3.4 m deep); past it
  // viewClear honestly reads not-clear.
  private readonly MAX_TERRAIN_LIFT = 6;
  // The occluder fade: every tree between the lens and him (or round the lens) fades — an
  // opacity change, never a camera move. Attack at once, release calmly.
  private readonly CANOPY_FADE_MIN = 0.16;    // a tree between: fade to this (he reads through it)
  private readonly CANOPY_FADE_BURIED = 0;    // the lens inside a tree: gone (a hint of leaves round the lens is only haze)
  private readonly CROWN_INSIDE_MARGIN = 0.4; // the lens-inside test leads the bury (no pop as the boom comes in)
  private readonly CANOPY_SEE_THROUGH = 0.5;  // blocking trees ≤ this ⇒ he reads through ⇒ viewClear
  private readonly CANOPY_RELEASE_TAU = 0.7;  // gentle ease back to solid once a tree clears
  private readonly fadeTargets = new Map<number, number>(); // this frame: tree index → fade
  // The clear view, by SLIDING the lens sideways (never by turning it): every frame the
  // walk boom is solved for a few side slides (straight behind, and the lens moved left or
  // right with the view still looking the same way) and the one with the clearest line to
  // the ranger wins: no lens inside foliage or a building, no creature, prop or unfadeable
  // tree between, no boom so short he fades. The view's direction belongs to the player
  // alone (his turn keys, his drag, his walk), so "Up" is always straight into the screen.
  // The slide changes only while he moves or turns (the view is moving anyway) or when the
  // line to him is blocked right now, and it eases in slowly. Under reduced motion (and
  // with the follow camera off) it changes only at a reframe (stepping out of the jeep, a
  // bearing cut), when the view is squeezed, or while he stands still — always as a cut.
  private readonly SIDE_STEPS = [0, 1 / 3, -1 / 3, 2 / 3, -2 / 3, 1, -1]; // of the widest slide
  private readonly SIDE_NDC = 0.45;  // the widest slide puts him this far off the screen's centre (of half its width)
  private readonly SIDE_COST = 0.6;  // what the widest slide costs in the search (straight behind is nicer)
  private readonly SIDE_HOLD = 0.8;  // s a choice is kept before the search may change its mind (no dithering)
  private readonly SIDE_HOLD_CUT = 1.2; // …and between two slide CUTS (reduced motion, fixed camera)
  private sideHeld = 0;
  private readonly SIDE_TAU = 0.5;
  private readonly SIDE_RATE = 0.25;        // boom lengths per second (≈1.2 m/s on the 4.6 m boom)
  private readonly SIDE_URGENT_RATE = 0.5;  // squeezed now, or he is turning: a little quicker
  private readonly BLOCKED = 2;             // a search cost this high = the line to him is blocked now
  private readonly LOOKAHEAD = 0.5;         // s: search where he is going (and where his turn takes the view) too
  private readonly BOOM_AHEAD = [1 / 3, 2 / 3, 1]; // …and the boom, at these shares of it
  private readonly _probe = new THREE.Vector3();
  private wasWalk = true;
  private lastBearing = 0;                   // the chase bearing last frame (its swing rate)
  private readonly KEEP_OUT_LEAD = 0.6;      // s: the jeep lens looks this far ahead along its swing…
  private readonly KEEP_OUT_LEAD_MAX = 0.6;  // rad: …at most this far round
  private readonly HUG_ANGLE = (60 * Math.PI) / 180;
  // The view never tips down steeper than this (child B4, parent B4: a lens craned up
  // over his head showed only his hair). With no room behind him the lens comes in close,
  // at most this steep, and the search slides it to a side with room. The drag
  // look-around stays inside PITCH_MIN…PITCH_MAX too.
  private readonly PITCH_MAX = 40 * DEG;
  private readonly PITCH_MIN = 6 * DEG;
  // …and closer in than PITCH_CLOSE_D (his back to a wall) the steepest view flattens to
  // PITCH_CLOSE and the eye comes to his own eye height: a look over his shoulder at the
  // world ahead (right up against him he fades out), never a lens on his hair or at the
  // ground by his feet.
  private readonly PITCH_CLOSE = 14 * DEG;
  private readonly PITCH_CLOSE_D = 1.2;
  private readonly EYES_FRAC = 0.9;
  private readonly AHEAD_TAU = 0.35;
  private aheadNow = 0;          // how far ahead of him the view aims now (m; eased)
  // The hide rail (place): he is hidden when the lens comes within his radius + HIDE_IN of
  // his body, and shown again past his radius + HIDE_OUT: at once, both ways.
  private readonly HIDE_IN = 0.35;
  private readonly HIDE_OUT = 0.5;
  private avatarHidden = false;
  private readonly MIN_BOOM = 0.05;
  // Run 6 polish (the fold): what the walk boom keeps out of, and how. A solid merely IN
  // THE LINE to him never moves the lens at once: the boom eases in before it (never
  // faster than BOOM_IN_RATE), and only when it stands at least NEAR_FLOOR from him (he
  // walks away from it; a solid closer than that stands beside him, and coming in front
  // of it would put the lens in his head: the side slide dodges it instead). Only the
  // lens ITSELF standing in a solid is a hard limit (`wall`), and even that pulls the
  // lens in at most WALL_RATE; a TURN that would sweep the lens into a wall faster than
  // the boom may come in waits for it (the bearing yields). The lens sees each solid's BODY: a circle's
  // keep-out ring is the walker's (he keeps WALK_CLEAR of his own room from it), a
  // building by its bare walls, a solid of known height only up to its top (the lens
  // passes over the board, a boulder, a juniper); the trees and the parked jeep fade.
  private readonly WALK_CLEAR = 0.3;
  private readonly NEAR_FLOOR = 1.4;
  private readonly LENS_PROBE = 0.2;   // the lens point's own room from a solid's body (the hard limit)
  private readonly OVER_CLEAR = 0.3;   // a lens this far above a solid's top passes over it
  private readonly BOOM_IN_RATE = 4;   // m/s: the fastest the walk boom dollies in…
  private readonly BOOM_OUT_RATE = 3;  // …and out
  private readonly WALL_RATE = 8;      // m/s the hard limit may pull the lens in (his walk carrying it into a wall)
  private prevWalkBearing: number | null = null; // the walk lens's bearing last frame (a turn yields to a wall)
  private readonly nearBodies: Obstacle[] = []; // this frame's solids as the walk lens sees them
  private readonly bodyPool: Obstacle[] = [];
  private readonly bodyTop: number[] = [];      // …and each one's top (world y; Infinity: unknown, a wall)
  private bodyCount = 0;
  // the parked jeep fades like a tree when it stands between the lens and him (JEEP_FADE),
  // gone when the lens stands in it; it stays faded JEEP_HOLD after the line cleared, so a
  // line that grazes it does not flicker it
  private readonly JEEP_FADE = 0.25;
  private readonly JEEP_HOLD = 0.8;
  private jeepClearFor = Infinity;
  private get headRoom(): number { return this.player.avatarRadius + 1.2; }
  // The world rim: the lens may stand this far outside the walk bound, among the rim
  // trees (they fade like any tree in the way), so a ranger at the edge who turns round
  // keeps the normal view instead of a lens with no room behind him (parent B3 / B4).
  private readonly LENS_RIM_OUT = 4.5;
  // Reduced motion (child B5): the bearing never turns smoothly. It holds while the
  // steering's target still moves, then cuts to it once the target has rested RM_REST,
  // or at once when the turn has gone RM_SNAP past the view (a long turn is a few calm
  // cuts, like a snap turn, never a swing).
  private readonly RM_REST = 0.1;
  private readonly RM_SNAP = 45 * DEG;
  private readonly RM_MIN_GAP = 1 * DEG;
  private rmLastTarget = FIXED_FOLLOW_YAW;
  private rmRest = 0;
  // …and the boom: under reduced motion every change of its length is a cut, so after a
  // solid shortened it, it cuts back out only once the full boom has been free RM_BOOM_OUT
  // (trees never shorten it at all: the fade carries them).
  private readonly RM_BOOM_OUT = 0.6;
  private rmBoomFree = 0;
  // The jeep / helicopter chase: the eye keeps the chase's pitch when the boom pulls in,
  // but never below the vehicle's roof.
  private readonly JEEP_EYE_MIN = 2.6;
  private readonly HELI_EYE_MIN = 3.5;
  private readonly HELI_MIN_BOOM = 4;
  private readonly vel = new THREE.Vector3();
  private readonly lastRp = new THREE.Vector3();
  private readonly ahead = new THREE.Vector3();
  private sideNow = 0;           // the eased side slide, in boom lengths (+ = to the screen's right)
  private sideStep = 0;          // the SIDE_STEPS entry the last search chose
  private readonly crowns: Crown[] = [];
  private crownTrees = -1;       // the tree / obstacle counts the crown list was built for
  private crownSolids = -1;
  private trunks = new WeakSet<Obstacle>(); // collision circles that are a forest tree's trunk
  private readonly nearCrowns: Crown[] = [];      // this frame's crowns / solids / creatures near the target
  private readonly nearSolids: Obstacle[] = [];
  private readonly creaturePool: Creature[] = []; // reused: nearCreatures = the first creatureCount
  private creatureCount = 0;
  private gatherX = 0;
  private gatherZ = 0;
  private gatherReach = 0;
  private readonly sol = { dist: 0, eye: 0, lift: 0, terrainClear: true, lensInCrown: false, cost: 0 };
  private pitchTan = 0;          // this frame's view pitch (settled + the player's tilt), as a tangent
  private readonly _look = new THREE.Vector3();
  // F-16 laptop dolly zoom: the player-set WALK boom distance (m, horizontal). Starts at
  // camOffset.z; the wheel / trackpad dollies it in and out within [zoomMinBoom() …
  // CAM_ZOOM_MAX], and the boom follows it with its own gentle ease (`zoomNow`); the eye
  // rises and sinks with the boom so the view keeps its pitch (a true dolly: zooming in
  // never tips the view steeply down). The FOV is NEVER touched. Vehicle / heli / activity
  // own the camera, so a scroll there is ignored.
  readonly CAM_ZOOM_MAX = 8;     // dolly ceiling
  private readonly CAM_ZOOM_MIN = 2.6; // dolly floor: the whole ranger stays in view, solid
  private readonly CAM_ZOOM_STEP = 0.01; // wheel deltaY → metres of boom change per notch
  private readonly CAM_ZOOM_TAU = 0.25;
  zoomDist = this.camOffset.z;   // current player-set walk boom (default = F-05 rig)
  private zoomNow = this.camOffset.z; // the eased boom the lens uses
  viewClearState = true;        // this frame: the ranger (or the vehicle) reads from the lens (see place)
  terrainClearState = true;     // this frame: no dune hides him that the eye could not rise over
  terrainLiftState = 0;         // metres the eye rode up to clear a dune this frame (0 = flat)
  // The rotating follow-cam: `followYaw` is the eased camera bearing; it chases
  // `followTargetYaw`, which on foot is set every frame by the ranger's steering (steer():
  // behind a tank-turning ranger, slowly behind a tap/stick walk, or hold — a standing
  // ranger never swings the view). Both start at π = straight behind on +z.
  followYaw = FIXED_FOLLOW_YAW;
  followTargetYaw = FIXED_FOLLOW_YAW;
  // On foot the steering tells the camera how to chase; the vehicles keep the default ease.
  private followTau = FOLLOW_TAU;
  private followMaxRate = FOLLOW_MAX_RATE;
  // "Camera draait mee" toggle (Instellingen, default aan), read LIVE each frame.
  private cameraFollowSource: (() => boolean) | null = null;
  // F-17 laptop drag look-around, layered ON TOP of the follow bearing: `orbitYaw` (free,
  // wraps) turns the walk boom round the ranger and `orbitTilt` (rad, clamped) tips the
  // view up or down. Both EASE toward their drag-set targets, or CUT to them under
  // reduced motion; they move only the lens, never the ranger. When he walks again steer()
  // folds the yaw into the follow bearing (the view does not move).
  orbitYaw = 0;
  private orbitTargetYaw = 0;
  orbitTilt = 0;
  private orbitTargetTilt = 0;
  private readonly ORBIT_YAW_PER_PX = 0.005;   // rad of yaw per CSS px dragged
  // parent B10: tilting the view is the most disorienting camera move for a motion-
  // sensitive player, so a vertical drag tips it gently (≈0.09°/px, a third of the yaw's
  // feel), a mostly sideways drag does not tip it at all, and the tilt stays in the calm
  // PITCH_MIN…PITCH_MAX band.
  private readonly ORBIT_TILT_PER_PX = 0.0015;
  private readonly ORBIT_TAU = 0.18;           // orbit ease smooth-time (snappier than the follow)
  // the vehicle chase offsets: the jeep (distance 9, height 4.5) and the helicopter
  // (higher + further back; the ranger rides at the heli's altitude, so the lens rises
  // with it). place() picks by the ride.
  readonly camOffsetVehicle = new THREE.Vector3(0, 4.5, 9);
  readonly camOffsetHeli = new THREE.Vector3(0, 6, 13);
  // Run 6: a held lens handed back (an adventure's framed beat ends): the follow view
  // takes over from where the lens was, position and aim on one smoothstep curve, never
  // turning faster than ~90°/s (kit makeReframe's rule). null = no hand-over running.
  // It and `handoff` (below) never run together: starting one ends the other.
  private blend: { t: number; dur: number; pos: THREE.Vector3; yaw: number; pitch: number; lift: number } | null = null;
  // run 6 polish: a hand-over glide that would pass within BLEND_CLEAR of him rises over
  // him on its way (by up to BLEND_LIFT_MAX), clearing his head and the cover round him by
  // BLEND_OVER
  private readonly BLEND_CLEAR = 2;
  private readonly BLEND_OVER = 1.2;
  private readonly BLEND_LIFT_MAX = 4;
  // A presented shot (world/Presenter.ts: the title, the ranger maker) hands the lens to
  // this rig as ONE move: for `dur` seconds the rig's own pose is blended in from where
  // the shot left the lens (eased, yaw the short way, roll 0). The rig runs underneath,
  // so a ranger who walks off mid-glide is followed; a cut under reduced motion.
  private handoff: { pos: THREE.Vector3; yaw: number; pitch: number; t: number; dur: number } | null = null;
  private readonly GLIDE_SPEED = 7.5; // m/s: a fitted glide's lens never travels faster than this at its peak
  private readonly _dir = new THREE.Vector3();
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
   *  helicopter the follow bearing alone. The clear-view slide moves the lens, never
   *  this bearing. */
  bearing(): number {
    const { inVehicle, inHeli } = this.host.mode();
    return inVehicle || inHeli ? this.followYaw : wrapAngle(this.followYaw + this.orbitYaw);
  }

  /** Dev-hook accessor: the camera yaw in the legacy input convention (screen
   *  forward = (−sin ψ, −cos ψ), so ψ = bearing + π), taken from the bearing that is
   *  ON SCREEN — the drag look-around included. */
  cameraYaw(): number {
    return wrapAngle(this.bearing() + Math.PI);
  }

  /** What the screen shows, for the ranger's steering (Player.walk). Under reduced
   *  motion the camera still follows him (by cuts), so the keys stay tank keys. */
  viewFrame(): ViewFrame {
    const follow = this.cameraFollowSource ? this.cameraFollowSource() : true;
    return { bearing: wrapAngle(this.followYaw + this.orbitYaw), follows: follow, cuts: livePolicy().reduced };
  }

  /** The widest clear-view slide (boom lengths) for this screen's shape: it puts him
   *  SIDE_NDC of the half-width off centre, whatever the aspect. */
  private sideMax(): number {
    const halfW = this.camera.aspect * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    return this.SIDE_NDC * halfW;
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

  /**
   * Run 6: the lens was somewhere else (an adventure held it): take it back calmly. The
   * follow bearing becomes the way the lens looks now (so the follow view comes from the
   * same side — a short glide, never round the ranger), and the lens eases from where it
   * is to the follow pose on one curve. Under reduced motion the next placement cuts.
   */
  handOver(reduced: boolean): void {
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    const yaw = Math.atan2(dir.x, dir.z);
    this.followYaw = this.followTargetYaw = yaw;
    this.orbitYaw = this.orbitTargetYaw = 0;
    this.extOff.set(0, 0, 0);
    this.handoff = null; // one hand-over at a time
    this.blend = reduced ? null : { t: 0, dur: 0, pos: this.camera.position.clone(), ...yawPitch(dir.x, dir.y, dir.z), lift: 0 };
  }

  /** Start the take-over from a presented shot: the lens is where the shot left it now,
   *  and over `seconds` it becomes this rig's own view (see `handoff`). `fit` (climbing
   *  into the jeep or the helicopter, stepping out, run 6 polish): at least `seconds`, and
   *  longer for a long move (the view turns ≤ ~90°/s, reframeSeconds; the lens travels
   *  ≤ GLIDE_SPEED), measured against the first pose the rig places. Reduced motion: a cut. */
  handover(seconds: number, fit = false): void {
    const d = this.camera.getWorldDirection(this._dir);
    const a = yawPitch(d.x, d.y, d.z);
    this.handoff = { pos: this.camera.position.clone(), yaw: a.yaw, pitch: a.pitch, t: 0, dur: fit ? -seconds : seconds };
    this.blend = null; // one hand-over at a time
  }

  /** Run 7 (feel): how far (rad, 0…π) the view turns to look along `bearing` (a heading)
   *  from where the lens looks now: what a hand-over to that bearing would sweep. */
  turnTo(bearing: number): number {
    const d = this.camera.getWorldDirection(this._dir);
    return Math.abs(wrapAngle(bearing - Math.atan2(d.x, d.z)));
  }

  /** Whether the rig has placed the lens yet (a glide needs a lens to start from). */
  get placedOnce(): boolean {
    return this.placed;
  }

  /** The take-over from a presented shot is still moving the lens. */
  get handingOver(): boolean {
    return this.handoff !== null;
  }

  /** A fresh start at the spawn (back from the title): the bearing straight behind a
   *  ranger heading `yaw`, no look-around. */
  reset(yaw: number): void {
    this.followYaw = this.followTargetYaw = this.rmLastTarget = yaw;
    this.orbitYaw = this.orbitTargetYaw = this.orbitTilt = this.orbitTargetTilt = 0;
    this.handoff = null;
    this.blend = null;
  }

  /** The "Camera draait mee" setting source (W1.5). Read live each frame
   *  so the toggle takes effect with no restart; null → default aan. */
  setFollowSource(source: (() => boolean) | null): void {
    this.cameraFollowSource = source;
  }

  /** F-17: a drag orbits the lens — free yaw (drag right → the lens orbits right around
   *  the ranger) and a gentle, clamped tilt (drag up → look further down; drag down →
   *  flatter, toward the horizon). A mostly sideways drag does not tilt. Only the lens
   *  moves, never the ranger. */
  orbitDrag(dx: number, dy: number): void {
    this.orbitTargetYaw += dx * this.ORBIT_YAW_PER_PX;
    if (Math.abs(dy) * 2 < Math.abs(dx)) return; // sideways: yaw only
    const base = this.basePitch();
    this.orbitTargetTilt = Math.max(this.PITCH_MIN - base, Math.min(this.PITCH_MAX - base,
      this.orbitTargetTilt - dy * this.ORBIT_TILT_PER_PX));
  }

  /** The settled walk pitch (rad, down): the default eye over the walk aim. */
  private basePitch(): number {
    return Math.atan2(this.camOffset.y - this.camLookH, this.camOffset.z);
  }

  /** The player's tilt as the eye lift (m) it makes at the default boom (the dev hook's
   *  `orbit.lift`: how far a drag raised the eye). */
  orbitLiftMetres(): number {
    const base = this.basePitch();
    return this.camOffset.z * (Math.tan(base + this.orbitTilt) - Math.tan(base));
  }

  /**
   * F-16 dolly floor: outside the avatar's own radius + the near plane, and well past the
   * fade rail (`avatarRadius + HIDE_OUT`) so the closest zoom keeps the ranger SOLID. Kept a metre below the ceiling so min < max even if a mis-scaled rig
   * inflates `avatarRadius`.
   */
  zoomMinBoom(): number {
    return Math.min(Math.max(this.CAM_ZOOM_MIN, this.player.avatarRadius + 1.3), this.CAM_ZOOM_MAX - 1);
  }

  /**
   * F-16 laptop wheel / trackpad-pinch DOLLY zoom on the walk follow-boom. Player-
   * initiated and clamped; NEVER a FOV zoom. The boom TARGET moves here; place() eases the
   * boom toward it (a cut under reduced motion). Ignored while driving / flying / in an
   * activity. preventDefault stops the page scrolling under the canvas.
   */
  readonly onWheel = (e: WheelEvent): void => {
    if (this.host.inputBlocked()) return;
    e.preventDefault();
    const next = this.zoomDist + e.deltaY * this.CAM_ZOOM_STEP;
    this.zoomDist = Math.max(this.zoomMinBoom(), Math.min(this.CAM_ZOOM_MAX, next));
  };

  /**
   * Place the camera for this frame. The lens hangs off a smoothed pivot (his spot) on a
   * smoothed boom (length + eye height) at the eased follow bearing, slid sideways for a
   * clear line; `snap` (reduced motion, first placement, a recut) sets it all at once.
   * Roll is always 0 and the FOV is fixed at construction — the motion-comfort law.
   */
  place(snap: boolean, dt = 0, reduced = false): void {
    // a hitch (a long frame) never turns into a jump of the view: the camera eases at
    // most one 20 fps frame's worth per frame and catches up over the next ones
    dt = Math.min(dt, 0.05);
    const rp = this.player.group.position;
    const { inVehicle, inHeli } = this.host.mode();
    const walk = !inVehicle && !inHeli;
    const follow = this.cameraFollowSource ? this.cameraFollowSource() : true;
    let bearingCut = false;
    if (follow && !reduced) {
      this.followYaw = walk
        ? dampedYaw(this.followYaw, this.followTargetYaw, dt, this.followTau, this.followMaxRate)
        : dampedYaw(this.followYaw, this.followTargetYaw, dt);
    } else if (follow) {
      bearingCut = this.cutBearing(dt);
    } else {
      // "Camera draait mee" off: a fixed bearing, straight behind on +z — and reset the
      // target so switching it back on doesn't whip-pan from a stale facing.
      this.followYaw = FIXED_FOLLOW_YAW;
      this.followTargetYaw = FIXED_FOLLOW_YAW;
    }
    // the player's look-around eases to its target, or CUTS to it under reduced motion
    if (reduced) {
      this.orbitYaw = this.orbitTargetYaw;
      this.orbitTilt = this.orbitTargetTilt;
    } else if (dt > 0) {
      const k = dampFactor(dt, this.ORBIT_TAU);
      this.orbitYaw += (this.orbitTargetYaw - this.orbitYaw) * k;
      this.orbitTilt += (this.orbitTargetTilt - this.orbitTilt) * k;
    }
    const off = inHeli ? this.camOffsetHeli : inVehicle ? this.camOffsetVehicle : this.camOffset;
    let dist = off.z;
    let eye = off.y;
    let wall = Infinity;
    const first = !this.placed;
    let reframe = first;
    if (walk) {
      this.zoomNow = reduced || snap ? this.zoomDist
        : this.zoomNow + (this.zoomDist - this.zoomNow) * dampFactor(dt, this.CAM_ZOOM_TAU);
      this.gatherNear(rp.x, rp.z, this.CAM_ZOOM_MAX + 4);
      const base = wrapAngle(this.followYaw + this.orbitYaw);
      // where he will be in half a second, and where his turn is taking the view, so the
      // slide starts before a person, a tree or the board is in the line, not after
      if (dt > 0 && this.placed) this.vel.set(rp.x - this.lastRp.x, 0, rp.z - this.lastRp.z).divideScalar(dt);
      this.lastRp.copy(rp);
      this.ahead.copy(rp).addScaledVector(this.vel, this.LOOKAHEAD);
      this.ahead.y = this.terrain.y(this.ahead.x, this.ahead.z);
      const aheadBearing = wrapAngle(base + this.player.turnRate * this.LOOKAHEAD);
      // stepping out of the jeep / helicopter is already a reframe (a solid parked beside
      // the lens is common there), and so is a reduced-motion bearing cut: the walk view
      // picks its clearest slide right away
      reframe = !this.wasWalk || bearingCut || first;
      const moving = this.vel.x * this.vel.x + this.vel.z * this.vel.z > 0.01 || this.player.turning;
      const calm = follow && !reduced; // the slide eases, and may change while he moves
      this.sideHeld += dt;
      const kMax = this.sideMax();
      const here = this.solveWalk(base, this.sideNow, rp);
      const squeezedNow = this.squeezed(here.cost, here.dist); // the view as it is this frame
      const standing = !moving && this.sideHeld >= this.SIDE_HOLD_CUT;
      if (this.player.dragging) this.sideStep = 0; // the player is placing the view himself
      else if (calm || reframe || squeezedNow || standing) {
        // score each slide now and where he is heading; keep the current choice unless
        // its view is squeezed now (then a clearly clearer one wins at once), or (while
        // he moves) another is clearly better and it has been held a while. Standing
        // still, nothing but a squeezed view changes it. Under reduced motion / a fixed
        // camera each change is a cut, so it happens only at a reframe, when squeezed, or
        // while he stands still, and never twice within SIDE_HOLD_CUT.
        let best = Infinity, pick = 0, pickNow = 0, cur = Infinity, curNow = 0, urgent = false;
        for (const f of this.SIDE_STEPS) {
          const sol = this.solveWalk(base, f * kMax, rp);
          const now = sol.cost;
          if (f === this.sideStep) { curNow = now; urgent = this.squeezed(now, sol.dist); }
          const cost = now + this.solveWalk(aheadBearing, f * kMax, this.ahead).cost + Math.abs(f) * this.SIDE_COST;
          if (f === this.sideStep) cur = cost;
          if (cost < best - 1e-9) { best = cost; pick = f; pickNow = now; }
        }
        const better = best < cur - 0.3;
        const clearer = urgent && better && pickNow < curNow - 0.3;
        const change = pick !== this.sideStep && (reframe || (calm
          ? clearer || (moving && this.sideHeld >= this.SIDE_HOLD && better)
          : this.sideHeld >= this.SIDE_HOLD_CUT && (clearer || (standing && better))));
        if (change) { this.sideStep = pick; this.sideHeld = 0; }
      }
      const sideTo = this.sideStep * kMax;
      if (reduced || snap) this.sideNow = sideTo;
      else if (dt > 0) {
        // a squeezed view, or one the player is turning anyway, slides a little quicker
        const step = (sideTo - this.sideNow) * dampFactor(dt, this.SIDE_TAU);
        const max = (squeezedNow || this.player.turning ? this.SIDE_URGENT_RATE : this.SIDE_RATE) * dt;
        this.sideNow += Math.max(-max, Math.min(max, step));
      }
      // the boom starts in before a solid his walk or his turn is about to put behind him
      // (it comes in calmly, so it has to start early: a wall swept in by a turn would
      // otherwise stop the lens at once): the shortest boom over the next half second (not
      // further: a turn key held now is not a turn held for a second, and a lens pulled in
      // for a wall he never turns to hides him for nothing)
      let cap = Infinity;
      if (calm && moving) {
        for (const f of this.BOOM_AHEAD) {
          const t = this.LOOKAHEAD * f;
          this._probe.copy(rp).addScaledVector(this.vel, t);
          this._probe.y = this.terrain.y(this._probe.x, this._probe.z);
          cap = Math.min(cap, this.solveWalk(wrapAngle(base + this.player.turnRate * t), this.sideNow, this._probe, Infinity, true, true).dist);
        }
      }
      const sol = this.solveWalk(base, this.sideNow, rp, cap, false, !(snap || reframe));
      dist = sol.dist;
      eye = sol.eye;
      this.terrainLiftState = sol.lift;
      this.terrainClearState = sol.terrainClear;
    } else {
      // the jeep / helicopter chase cams own their framing: the slide eases out (quickly,
      // while their longer boom lets out)
      this.sideStep = 0;
      if (reduced || snap) this.sideNow = 0;
      else if (dt > 0) this.sideNow *= 1 - dampFactor(dt, 0.3);
      this.gatherNear(rp.x, rp.z, off.z + 4);
      const b0 = this.bearing();
      const ux = -Math.sin(b0), uz = -Math.cos(b0);
      // how fast the boom swings round (a standing jeep pivots at ~0.6 rad/s): the lens
      // starts in before a keep-out disc it is swinging toward, so it eases in rather than
      // stepping in once the line touches it
      const swing = this.wasWalk || snap || first || !(dt > 0) ? 0 : wrapAngle(b0 - this.lastBearing) / dt;
      this.lastBearing = b0;
      const lead = Math.max(-this.KEEP_OUT_LEAD_MAX, Math.min(this.KEEP_OUT_LEAD_MAX, swing * this.KEEP_OUT_LEAD));
      const vx = -Math.sin(b0 + lead), vz = -Math.cos(b0 + lead);
      // the jeep's chase lens stays inside the lens ring at the rim (among the first rim
      // trees at most, which fade), and its boom pulls in before a hut / prop / person
      // behind it instead of burying the lens in that solid (its own collision circle is
      // lifted while driving, so the cast can't hit itself); trees fade instead. The
      // helicopter's lens rides above the treetops, where the rim is no wall.
      let frac = 1;
      let min = this.HELI_MIN_BOOM;
      if (inVehicle) {
        frac = Math.min(this.rimFraction(rp.x, rp.z, ux * dist, uz * dist),
          this.boomClearFraction(rp.x, rp.z, ux * dist, uz * dist, this.CAM_PROBE_R, true, true),
          this.keepOutFraction(rp.x, rp.z, ux * dist, uz * dist, this.CAM_PROBE_R),
          this.keepOutFraction(rp.x, rp.z, vx * dist, vz * dist, this.CAM_PROBE_R));
        min = JEEP_COLLIDE + this.camera.near + 0.3;
        const len = Math.max(dist, this.boomNow);
        wall = Math.max(min, len * Math.min(this.boomClearFraction(rp.x, rp.z, ux * len, uz * len, this.WALL_PROBE, true, true),
          this.keepOutFraction(rp.x, rp.z, ux * len, uz * len, this.WALL_PROBE)));
      }
      dist = Math.max(Math.min(min, dist), dist * frac);
      // a shorter boom keeps the chase's pitch (never a dive onto the roof), above the roof
      eye = Math.max(off.y * (dist / off.z), inVehicle ? this.JEEP_EYE_MIN : this.HELI_EYE_MIN);
      const lx = rp.x + ux * dist, lz = rp.z + uz * dist;
      const g = this.terrain.y(lx, lz);
      if (rp.y + eye < g + this.CAM_GROUND_CLR) eye = g + this.CAM_GROUND_CLR - rp.y;
      const need = this.terrainSightlineLift(lx, rp.y + eye, lz, rp.x, rp.y + 0.8, rp.z);
      this.terrainLiftState = Math.min(need, this.MAX_TERRAIN_LIFT);
      eye += this.terrainLiftState;
      this.terrainClearState = need <= this.MAX_TERRAIN_LIFT;
    }
    this.wasWalk = walk;
    let bearing = this.bearing();
    let s = Math.sin(bearing), c = Math.cos(bearing);
    // The lens hangs off a smoothed PIVOT (his spot) on a smoothed boom (length + eye
    // height) at the follow BEARING. The bearing is already eased, so the view turns
    // exactly as much as the bearing does. The boom pulls in and lets out calmly, and
    // never past a wall (`wall`: where the lens itself would touch a solid). A cut
    // (reduced motion, first placement) sets all of it at once.
    if (snap || first) {
      this.pivot.copy(rp);
      // reduced motion: a boom a solid shortened cuts back out only once the full boom has
      // been free a moment (one cut, not one per frame the line flickers)
      this.rmBoomFree = walk && reduced && !reframe && dist > this.boomNow + 0.05 ? this.rmBoomFree + dt : 0;
      if (this.rmBoomFree === 0 || this.rmBoomFree >= this.RM_BOOM_OUT) {
        this.boomNow = dist;
        this.eyeNow = eye;
        this.rmBoomFree = 0;
      }
      this.extOff.set(0, 0, 0);
    } else {
      // run 6: running, the pivot trails him by the same ~0.33 m as walking (its smooth-time
      // shortens as his pace passes a walk), so a run never shrinks him on screen
      const pace = this.player.pace;
      const pivotTau = !walk ? this.PIVOT_TAU_VEHICLE : pace > WALK_SPEED ? (this.PIVOT_TAU * WALK_SPEED) / pace : this.PIVOT_TAU;
      this.pivot.lerp(rp, dampFactor(dt, pivotTau));
      const boomBefore = this.boomNow;
      let step = (dist - this.boomNow) * dampFactor(dt, dist < this.boomNow ? this.BOOM_IN_TAU : this.BOOM_OUT_TAU);
      if (walk) step = Math.max(-this.BOOM_IN_RATE * dt, Math.min(this.BOOM_OUT_RATE * dt, step)); // a calm dolly, never a lurch
      this.boomNow += step;
      // on foot the one hard limit is the lens ITSELF in a solid (see NEAR_FLOOR): a solid
      // the look-ahead did not see coming (he turned right beside it)
      if (walk) {
        wall = this.lensWall(s, c);
        // …and a turn never sweeps the lens into a wall faster than the calm dolly comes
        // in: the follow bearing YIELDS (it turns only as far as the boom can follow this
        // frame, and catches up as the boom comes in). With his back to the cabin, turning
        // on the spot swept the lens along its wall so fast that the hard limit pulled it
        // in at 20 m/s, 2 m to 0.4 m in five frames (run 6 polish). A player's own drag,
        // and a wall his walk carries the lens into (the pivot), keep the hard limit.
        const floor = Math.max(this.MIN_BOOM, boomBefore - this.BOOM_IN_RATE * dt);
        if (wall < floor - 0.1 && this.prevWalkBearing !== null && !reduced && !this.player.dragging) {
          const from = this.prevWalkBearing, turn = wrapAngle(bearing - from);
          const clear = (f: number): boolean => { const b = from + turn * f; return !this.lensInWall(Math.sin(b), Math.cos(b), floor); };
          if (Math.abs(turn) > 1e-5 && clear(0)) {
            let lo = 0, hi = 1;
            for (let i = 0; i < 6; i++) { const m = (lo + hi) / 2; if (clear(m)) lo = m; else hi = m; }
            this.followYaw = wrapAngle(this.followYaw - turn * (1 - lo));
            bearing = wrapAngle(from + turn * lo);
            s = Math.sin(bearing); c = Math.cos(bearing);
            wall = this.lensWall(s, c);
          }
        }
        // and a boom letting out never lets out INTO a solid: it waits where it is (else,
        // pressed against the cabin, it let out a few cm, met the wall, was pulled in, let
        // out again: the view shook 0.1 m every frame)
        if (step > 0 && this.lensInWall(s, c, this.boomNow) && !this.lensInWall(s, c, boomBefore)) {
          this.boomNow = boomBefore;
          wall = this.lensWall(s, c);
        }
      }
      if (this.boomNow > wall) {
        // the lens never stays in it: it comes in, along the view (the eye comes down with
        // it), so the view does not tip, it only steps closer, on foot never faster than
        // WALL_RATE (the chase lens: at once, as ever)
        const to = walk ? Math.max(wall, this.boomNow - this.WALL_RATE * dt) : wall;
        const aim = walk ? this.camLookH : this.camIdleLookH;
        this.eyeNow = aim + (this.eyeNow - aim) * (to / this.boomNow);
        this.boomNow = to;
      }
      this.eyeNow += (eye - this.eyeNow) * dampFactor(dt, eye > this.eyeNow ? this.EYE_UP_TAU : this.EYE_DOWN_TAU);
      // someone else moved the lens since the last frame (a mini-game's reframe): ease
      // from where it left it instead of cutting
      if (this.camera.position.distanceToSquared(this.lastSet) > 1e-8) {
        this.extOff.copy(this.camera.position).sub(this.lensAt(this._lens, s, c));
      }
      this.extOff.multiplyScalar(1 - dampFactor(dt, 0.3));
    }
    this.prevWalkBearing = walk && !snap ? bearing : null;
    this.lensAt(this.camDesired, s, c).add(this.extOff);
    this.camera.position.copy(this.camDesired);
    this.lastSet.copy(this.camDesired);
    this.placed = true;
    this.camera.up.set(0, 1, 0); // roll = 0 always
    // look at the smoothed pivot the boom hangs off (not his live feet), moved by the
    // same side slide as the lens, so the view looks exactly along the eased bearing: a
    // boom pulling in, a slide or his steps can never add a twist. With the lens close to
    // him the view flattens (pitchCapAt) by aiming a little ahead of him (its heading stays
    // the bearing); that aim eases, so the view never nods, but it never lets the view tip
    // past PITCH_MAX, not even for a frame while the boom and the eye settle.
    const aimH = walk ? this.camLookH : this.camIdleLookH;
    this.sideOff(this._look.copy(this.pivot), s, c, 1);
    const rise = this.eyeNow - aimH;
    const aheadWant = Math.max(0, rise / Math.tan(this.pitchCapAt(this.boomNow)) - this.boomNow);
    if (snap || first) this.aheadNow = aheadWant;
    else this.aheadNow += (aheadWant - this.aheadNow) * dampFactor(dt, this.AHEAD_TAU);
    const ahead = Math.max(this.aheadNow, rise / Math.tan(this.PITCH_MAX) - this.boomNow);
    if (ahead > 0) { this._look.x += s * ahead; this._look.z += c * ahead; }
    this.camera.lookAt(this._look.x, this._look.y + aimH, this._look.z);
    if (this.blend) this.stepBlend(snap ? Infinity : dt);
    // F-05 fade rail: when the lens has to come right up to him (his back to a wall) he
    // is hidden rather than smear his interior across the lens; the view then looks over
    // where he stands. Solid or gone, never half, and never in between for a frame: even
    // a quick dissolve showed his see-through face and hands from inside his head (run 6
    // polish). The switch has a little hysteresis.
    const lp = this.camera.position;
    if (walk) {
      const d = this.bodyDist(Math.hypot(lp.x - rp.x, lp.z - rp.z), lp.y - rp.y);
      const r = this.player.avatarRadius;
      this.avatarHidden = d < r + (this.avatarHidden ? this.HIDE_OUT : this.HIDE_IN);
      this.player.setAvatarOpacity(this.avatarHidden ? 0 : 1);
    } else if (this.player.avatarOpacity !== 1) this.player.setAvatarOpacity(1); // never leave the driver faded
    // The occluder fade + the honest clear-line read, for the walk AND the chase cams:
    // every tree between the lens and him (his head and his chest; the vehicle's body and
    // roof), or round the lens, fades — exactly those trees (world/Forest.ts) — at once,
    // near-invisible when the lens sits inside one; the others ease back solid (a cut
    // under reduced motion or on a snap). viewClear is FALSE while a tree in the way still
    // stands above SEE_THROUGH opacity (the forest is not built yet), while a dune the eye
    // could not rise over hides him, or while an UNFADEABLE tree is in the way. Solid
    // props, the parked vehicles and animals are folded in per SHOT (DevReadback.camState).
    const a1 = walk ? rp.y + this.player.avatarTopY : rp.y + 1.0;
    const a2 = walk ? rp.y + this.camLookH : rp.y + 0.3;
    let blocked = false, solidTree = false;
    this.fadeTargets.clear();
    for (const k of this.nearCrowns) {
      const fadeable = k.tree >= 0;
      const inside = insideCrown(k, lp.x, lp.y, lp.z, fadeable ? this.CROWN_INSIDE_MARGIN : 0);
      if (!inside && !blocksLine(k, lp.x, lp.y, lp.z, rp.x, a1, rp.z) && !blocksLine(k, lp.x, lp.y, lp.z, rp.x, a2, rp.z)) continue;
      if (!fadeable) { solidTree = true; continue; }
      blocked = true;
      this.fadeTargets.set(k.tree, inside ? this.CANOPY_FADE_BURIED : this.CANOPY_FADE_MIN);
    }
    const release = reduced || snap ? 1 : dampFactor(dt, this.CANOPY_RELEASE_TAU);
    this.dressing.fadeOccluders(this.fadeTargets, release);
    this.viewClearState = (!blocked || this.dressing.canopyOpacity <= this.CANOPY_SEE_THROUGH) &&
      this.terrainClearState && !solidTree;
    if (this.handoff) this.blendHandoff(dt, reduced);
    this.fadeParkedJeep(walk, dt, reduced || snap);
    // the ground "go here" rings fade by the lens's proximity (both branches: a ring faded
    // on foot restores once a vehicle cam pulls the lens far away)
    this.host.afterPlace();
  }

  /**
   * Run 6 polish: the parked jeep, for the walk lens, is like a tree. He stands right
   * beside it to board it and steps out beside it, so a lens that came in front of it
   * would stand in his head (the fold): the boom never comes in for it. While its body
   * stands between the lens and him it fades to JEEP_FADE, gone while the lens stands in
   * it or right over it; solid again, eased, once the line has been clear JEEP_HOLD (a
   * cut under reduced motion). Driven: solid.
   */
  private fadeParkedJeep(walk: boolean, dt: number, cut: boolean): void {
    const jeep = this.host.parkedJeep();
    if (!jeep) return;
    let target = 1;
    if (walk) {
      const lp = this.camera.position, rp = this.player.group.position;
      const dx = rp.x - lp.x, dz = rp.z - lp.z, len2 = dx * dx + dz * dz;
      let inside = false, between = false;
      for (const o of jeep.circles) {
        const r = Math.max(0.05, o.r - jeep.room);
        if (lp.y < jeep.roof + this.OVER_CLEAR && Math.hypot(lp.x - o.x, lp.z - o.z) < r + 0.5) inside = true;
        if (len2 < 1e-6) continue;
        // (the same line the dev hook's clear-line read tests, a little wider)
        const t = ((o.x - lp.x) * dx + (o.z - lp.z) * dz) / len2;
        if (t <= 0.02 || t >= 0.98) continue;
        if (Math.hypot(o.x - (lp.x + dx * t), o.z - (lp.z + dz * t)) <= r + 0.15) between = true;
      }
      this.jeepClearFor = inside || between ? 0 : this.jeepClearFor + dt;
      target = inside ? 0 : this.jeepClearFor < this.JEEP_HOLD ? this.JEEP_FADE : 1;
    }
    this.host.fadeJeep(target, cut ? 1 : dampFactor(dt, this.CANOPY_RELEASE_TAU));
  }

  /**
   * Run 6: while an adventure HOLDS the lens (a framed beat in the wood), the trees still
   * fade the way they do for the follow camera: every tree whose crown is round the lens,
   * or stands between the lens and what it frames (`focus`: the framed spots) or the
   * ranger in front of it, fades — an opacity change, never a camera move; the others
   * ease back solid (at once under reduced motion). Without it a held view in the forest
   * froze whatever fade the walk left, and a crown in front of the lens stayed solid.
   */
  fadeHeld(dt: number, reduced: boolean, focus: readonly { x: number; y: number; z: number }[]): void {
    const lp = this.camera.position;
    const rp = this.player.group.position;
    const dir = this.camera.getWorldDirection(this._probe);
    const aims: { x: number; y: number; z: number }[] = [...focus];
    // the ranger, when the lens looks at him (a framed beat keeps him in the picture)
    if ((rp.x - lp.x) * dir.x + (rp.y - lp.y) * dir.y + (rp.z - lp.z) * dir.z > 0.5) {
      aims.push({ x: rp.x, y: rp.y + this.player.avatarTopY, z: rp.z }, { x: rp.x, y: rp.y + this.camLookH, z: rp.z });
    }
    let reach = 4;
    for (const a of aims) reach = Math.max(reach, Math.hypot(a.x - lp.x, a.z - lp.z) + 2);
    this.gatherNear(lp.x, lp.z, reach);
    this.fadeTargets.clear();
    for (const k of this.nearCrowns) {
      if (k.tree < 0) continue;
      const inside = insideCrown(k, lp.x, lp.y, lp.z, this.CROWN_INSIDE_MARGIN);
      if (!inside && !aims.some((a) => blocksLine(k, lp.x, lp.y, lp.z, a.x, a.y, a.z))) continue;
      this.fadeTargets.set(k.tree, inside ? this.CANOPY_FADE_BURIED : this.CANOPY_FADE_MIN);
    }
    this.dressing.fadeOccluders(this.fadeTargets, reduced ? 1 : dampFactor(dt, this.CANOPY_RELEASE_TAU));
  }

  /** The hand-over (see `handOver`): from the held pose to the follow pose placed this
   *  frame, position and aim on one smoothstep curve. */
  private stepBlend(dt: number): void {
    const b = this.blend!;
    const to = this.camera.position.clone();
    const d1 = this.camera.getWorldDirection(new THREE.Vector3());
    const a1 = yawPitch(d1.x, d1.y, d1.z);
    if (b.dur === 0) {
      const d0 = aimDir(b.yaw, b.pitch);
      b.dur = reframeSeconds(1.1, (d1.angleTo(new THREE.Vector3(d0.x, d0.y, d0.z)) * 180) / Math.PI);
    }
    // a held view that looked away from him (through his binoculars at the ree hide)
    // hands back to the view behind him on its far side: the straight glide went right
    // through him and the hide's bracken (0.4 s of leaves, run 6 polish). A glide that
    // passes within BLEND_CLEAR of him rises over him and the cover round him instead
    // (measured each frame against where the follow view settles; it only ever grows)
    const rp = this.player.group.position;
    const dx = to.x - b.pos.x, dz = to.z - b.pos.z, l2 = dx * dx + dz * dz;
    const k = l2 < 1e-6 ? 0 : Math.max(0, Math.min(1, ((rp.x - b.pos.x) * dx + (rp.z - b.pos.z) * dz) / l2));
    if (k > 0.15 && k < 0.85 && Math.hypot(b.pos.x + dx * k - rp.x, b.pos.z + dz * k - rp.z) < this.BLEND_CLEAR) {
      const need = rp.y + this.player.avatarTopY + this.BLEND_OVER - (b.pos.y + (to.y - b.pos.y) * k);
      b.lift = Math.max(b.lift, Math.min(this.BLEND_LIFT_MAX, Math.max(0, need) / Math.sin(Math.PI * k)));
    }
    b.t = Math.min(1, b.t + dt / b.dur);
    if (b.t >= 1) { this.blend = null; this.lastSet.copy(to); return; }
    const e = easeInOut(b.t);
    this.camera.position.lerpVectors(b.pos, to, e);
    this.camera.position.y += Math.sin(Math.PI * e) * b.lift;
    const d = aimDir(lerpAngle(b.yaw, a1.yaw, e), b.pitch + (a1.pitch - b.pitch) * e);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.camera.position.x + d.x, this.camera.position.y + d.y, this.camera.position.z + d.z);
    this.lastSet.copy(this.camera.position); // (the next frame must not read this as someone else's move)
  }

  /** The take-over from a presented shot (`handover`): this frame's view is the rig's own
   *  pose blended in from the shot's, eased; `lastSet` follows, so the rig never reads the
   *  blend as someone else moving its lens. */
  private blendHandoff(dt: number, reduced: boolean): void {
    const h = this.handoff!;
    const d = this.camera.getWorldDirection(this._dir);
    const to = yawPitch(d.x, d.y, d.z);
    const p = this.camera.position;
    if (h.dur < 0) {
      // fit the glide to the move: the smoothstep's top speed is 1.5× the average
      const d0 = aimDir(h.yaw, h.pitch);
      const turn = (Math.acos(Math.max(-1, Math.min(1, d0.x * d.x + d0.y * d.y + d0.z * d.z))) * 180) / Math.PI;
      h.dur = Math.max(-h.dur, reframeSeconds(0, turn), (1.5 * h.pos.distanceTo(p)) / this.GLIDE_SPEED);
    }
    h.t += Math.min(dt, 0.05);
    if (reduced || h.t >= h.dur) { this.handoff = null; return; }
    const e = easeInOut(h.t / h.dur);
    p.set(h.pos.x + (p.x - h.pos.x) * e, h.pos.y + (p.y - h.pos.y) * e, h.pos.z + (p.z - h.pos.z) * e);
    const a = aimDir(lerpAngle(h.yaw, to.yaw, e), h.pitch + (to.pitch - h.pitch) * e);
    this.camera.up.set(0, 1, 0); // roll 0, always
    this.camera.lookAt(p.x + a.x, p.y + a.y, p.z + a.z);
    this.lastSet.copy(p);
  }

  /** Reduced motion: hold the bearing while the steering's target still turns, then cut
   *  to it once it rests (a key came up, the jeep drives straight again), or at once when
   *  the turn has gone RM_SNAP past the view. True when it cut this frame. */
  private cutBearing(dt: number): boolean {
    const moved = Math.abs(wrapAngle(this.followTargetYaw - this.rmLastTarget)) > 1e-4;
    this.rmLastTarget = this.followTargetYaw;
    this.rmRest = moved ? 0 : this.rmRest + dt;
    const gap = Math.abs(wrapAngle(this.followTargetYaw - this.followYaw));
    if (gap < this.RM_MIN_GAP || (this.rmRest < this.RM_REST && gap < this.RM_SNAP)) return false;
    this.followYaw = this.followTargetYaw;
    return true;
  }

  /** Squeezed: the line to him is blocked, or a solid pulled the boom in below 60 %. */
  private squeezed(cost: number, d: number): boolean {
    return cost >= this.BLOCKED || d < this.zoomNow * 0.6;
  }

  /** The lens's distance to his body (a post from his feet to the top of his head), for
   *  a lens `hd` m from him horizontally and `up` m above his feet. */
  private bodyDist(hd: number, up: number): number {
    const dy = up > this.player.avatarTopY ? up - this.player.avatarTopY : up < 0 ? -up : 0;
    return Math.hypot(hd, dy);
  }

  /** The walk lens's hard limit: the longest boom, up to the eased one, at which the lens
   *  (this frame's pivot, bearing (s, c), side slide, the eye along the view) stands out of
   *  every solid's body by LENS_PROBE. A solid merely between the lens and him is no limit
   *  (NEAR_FLOOR); the old limit was where the LINE to him first met a solid, and a jeep's
   *  flank turning into that line beside him put the lens in his head in one frame. */
  private lensWall(s: number, c: number): number {
    for (let d = this.boomNow; d > this.MIN_BOOM; d -= 0.1) if (!this.lensInWall(s, c, d)) return d;
    return this.MIN_BOOM;
  }

  /** Would the walk lens at boom `d` on bearing (s, c) (this frame's pivot, side slide,
   *  the eye along the view) stand within LENS_PROBE of a solid's body? */
  private lensInWall(s: number, c: number, d: number): boolean {
    const b0 = this.boomNow, k = this.sideNow, p = this.pivot, aim = this.camLookH;
    const y = p.y + aim + (this.eyeNow - aim) * (d / b0);
    return this.lensInBody(p.x - s * d - c * k * d, y, p.z - c * d + s * k * d, this.LENS_PROBE, this.player.group.position);
  }

  /** How well a lens there shows him, for the clear-view search (1 = a good distance,
   *  0 = so close he fades out): a ramp from the fade-out distance to 0.4 m past it. */
  private opacityAt(hd: number, up: number): number {
    const near = this.player.avatarRadius + this.HIDE_IN;
    return Math.max(0, Math.min(1, (this.bodyDist(hd, up) - near) / 0.4));
  }

  /** The lens for this frame's smoothed pivot / boom / eye / side slide at bearing (s, c). */
  private lensAt(out: THREE.Vector3, s: number, c: number): THREE.Vector3 {
    out.set(this.pivot.x - s * this.boomNow, this.pivot.y + this.eyeNow, this.pivot.z - c * this.boomNow);
    return this.sideOff(out, s, c, 1);
  }

  /** Move `out` by the side slide (× `k`) along the screen's right, (−cos b, sin b). */
  private sideOff(out: THREE.Vector3, s: number, c: number, k: number): THREE.Vector3 {
    const m = this.sideNow * this.boomNow * k;
    out.x -= c * m;
    out.z += s * m;
    return out;
  }

  /** The fraction of the boom (origin ox,oz; vector dx,dz) that stays inside the lens
   *  ring (the walk bound + LENS_RIM_OUT: among the first rim trees at most). */
  private rimFraction(ox: number, oz: number, dx: number, dz: number): number {
    const R = this.limits.bound + this.LENS_RIM_OUT;
    const ex = ox + dx, ez = oz + dz;
    if (ex * ex + ez * ez <= R * R) return 1;
    // solve |o + t·d| = R for the t in (0, 1]
    const a = dx * dx + dz * dz, b = 2 * (ox * dx + oz * dz), cc = ox * ox + oz * oz - R * R;
    const disc = b * b - 4 * a * cc;
    if (a < 1e-9 || disc < 0) return 1;
    return Math.max(0, Math.min(1, (-b + Math.sqrt(disc)) / (2 * a)));
  }

  /** Rebuild the tree list when the forest changed (the scatter, the rim, the groves, a
   *  prop tree): the forest's trees (fadeable, by their index) and any tree the forest
   *  does not draw (a collision solid with a `crown`: unfadeable). */
  private refreshCrowns(): void {
    if (this.dressing.treePlacements.length === this.crownTrees && this.obstacles.length === this.crownSolids) return;
    this.crownTrees = this.dressing.treePlacements.length;
    this.crownSolids = this.obstacles.length;
    this.crowns.length = 0;
    const at = new Set<string>();
    this.dressing.treePlacements.forEach((p, i) => {
      const k = crownOf(p.species, TREE_BASE_H[p.species] * p.s, p.x, p.y, p.z, i);
      if (k) this.crowns.push(k);
      at.add(`${p.x},${p.z}`);
    });
    // a forest tree's collision circle is its trunk, tagged or not (the grove trees at the
    // landmarks push an untagged one): it fades with the tree, so it is no solid to the view
    this.trunks = new WeakSet();
    for (const o of this.obstacles) if (o.tree || at.has(`${o.x},${o.z}`)) this.trunks.add(o);
    for (const o of this.obstacles) {
      if (!o.crown) continue;
      const k = crownOf(o.crown.kind, o.crown.h, o.x, o.crown.y, o.z, -1);
      if (k) this.crowns.push(k);
    }
  }

  /** Is this collision solid a forest tree's trunk (it fades with its tree, world/Crowns.ts),
   *  rather than a building, prop or person? (The dev hook's clear-line read asks too.) */
  isTree(o: Obstacle): boolean {
    this.refreshCrowns();
    return this.trunks.has(o);
  }

  /** This frame's trees, solids and creatures within `reach` of (x, z). */
  private gatherNear(x: number, z: number, reach: number): void {
    this.refreshCrowns();
    this.nearCrowns.length = this.nearSolids.length = 0;
    for (const k of this.crowns) {
      const r = reach + k.reach;
      if (Math.abs(k.x - x) < r && Math.abs(k.z - z) < r) this.nearCrowns.push(k);
    }
    for (const o of this.obstacles) {
      const r = reach + o.r;
      if (Math.abs(o.x - x) < r && Math.abs(o.z - z) < r) this.nearSolids.push(o);
    }
    this.creatureCount = 0;
    this.gatherX = x; this.gatherZ = z; this.gatherReach = reach;
    this.host.creatures(this.visitCreature);
    // the walk lens's solids: each one's body (a circle without the walker's room, a box
    // by its bare walls as the casts already measure it), not the trees (they fade), not
    // the parked jeep (it fades too)
    const jeep = this.host.parkedJeep();
    this.bodyCount = 0;
    for (const o of this.nearSolids) {
      if (this.isTree(o) || (jeep && jeep.circles.includes(o))) continue;
      let b = this.bodyPool[this.bodyCount];
      if (!b) { b = { x: 0, z: 0, r: 0 }; this.bodyPool.push(b); }
      b.x = o.x; b.z = o.z; b.box = o.box;
      b.r = o.box ? o.r : Math.max(0.05, o.r - this.WALK_CLEAR);
      const h = o.crown ? o.crown.y + o.crown.h : o.h !== undefined ? this.terrain.y(o.x, o.z) + o.h : Infinity;
      this.bodyTop[this.bodyCount] = h;
      this.nearBodies[this.bodyCount++] = b;
    }
    this.nearBodies.length = this.bodyCount;
  }

  /** The fraction of the walk boom (origin ox,oz; vector dx,dz) clear before a probe of
   *  radius `probe` round the line meets a solid's body (boomClearFraction for the walk
   *  lens's solids: see gatherNear). 1 = nothing in the way. */
  private bodyEntry(ox: number, oz: number, dx: number, dz: number, probe: number): number {
    if (dx * dx + dz * dz < 1e-6) return 1;
    let best = 1;
    for (const o of this.nearBodies) {
      const t = segmentEntry(o, ox, oz, dx, dz, o.box ? probe - o.box.pad : probe);
      if (t < best) best = t;
    }
    return best;
  }

  /** Does a lens at (x, y, z) stand within `probe` of a solid's body (below its top +
   *  OVER_CLEAR: over a low one it passes)? A solid round his own feet (the prop he stands
   *  at) never counts. */
  private lensInBody(x: number, y: number, z: number, probe: number, rp: THREE.Vector3): boolean {
    for (let i = 0; i < this.bodyCount; i++) {
      const o = this.nearBodies[i];
      if (y >= this.bodyTop[i] + this.OVER_CLEAR) continue;
      const pad = o.box ? o.box.pad : 0;
      if (obstacleGap(o, rp.x, rp.z, -pad) < 0) continue;
      if (obstacleGap(o, x, z, -pad) < probe) return true;
    }
    return false;
  }

  /** gatherNear's creature visitor (bound once: no per-frame closure). */
  private readonly visitCreature = (x: number, y: number, z: number, h: number): void => {
    if (Math.abs(x - this.gatherX) >= this.gatherReach || Math.abs(z - this.gatherZ) >= this.gatherReach) return;
    let a = this.creaturePool[this.creatureCount];
    if (!a) { a = { x, y, z, h }; this.creaturePool.push(a); }
    else { a.x = x; a.y = y; a.z = z; a.h = h; }
    this.creatureCount++;
  };

  /** The steepest the view may look down with the boom at `d` m: PITCH_MAX, flattening
   *  to PITCH_CLOSE as the lens comes right up to him (see eyeFor). */
  private pitchCapAt(d: number): number {
    const k = Math.max(0, Math.min(1, d / this.PITCH_CLOSE_D));
    return this.PITCH_CLOSE + (this.PITCH_MAX - this.PITCH_CLOSE) * k;
  }

  /** The walk eye at boom `d` (horizontal) for the lens direction (ux, uz) per metre:
   *  the settled pitch (a true dolly). Close to him it rises toward over his head, but
   *  never steeper than PITCH_MAX and never into the leaves above the lens; right up
   *  against him it comes to his own eye height (place() then aims ahead, so the view
   *  looks over his shoulder at the world, not down at his hair or his feet). */
  private eyeFor(d: number, rp: THREE.Vector3, ux: number, uz: number): number {
    const lookH = this.camLookH;
    const e = lookH + d * this.pitchTan;
    const top = this.player.avatarTopY, room = this.headRoom;
    if (d >= room || Math.hypot(d, Math.max(0, e - top)) >= room) return e;
    const up = Math.min(top + Math.sqrt(room * room - d * d), lookH + d * Math.tan(this.PITCH_MAX));
    const leaves = this.crownFloor(rp.x + ux * d, rp.z + uz * d, 0.3) - rp.y;
    const eyes = top * this.EYES_FRAC * (1 - d / room);
    return Math.max(e, Math.min(up, leaves), Math.min(eyes, leaves));
  }

  /**
   * Solve the walk boom at bearing `b`, the lens slid `k` boom lengths to the screen's
   * right: the player's zoom, pulled in before a solid (buildings, props, people: a cast
   * along the line to him, then the lens kept clear) and the lens ring at the rim, then
   * further in while the lens would sit in a tree; the eye at the settled pitch (rising, no steeper than
   * PITCH_MAX, when a solid pulled the boom in close), above its own ground and lifted
   * until the line to his head clears the terrain. `cost` scores how clear the line to the
   * ranger is (0 = clear at full length); the search picks the lowest. `wall` is how far
   * the lens itself may go before it touches a solid (the eased boom never goes past it).
   * `cap`: a shorter boom wanted already (the one where he is heading). `solidsOnly`: only
   * `dist` as the solids and the rim leave it (the look-ahead's question), nothing else.
   */
  private solveWalk(b: number, k: number, rp: THREE.Vector3, cap = Infinity, solidsOnly = false, stayBeyond = false): CameraRig['sol'] {
    const out = this.sol;
    const s = Math.sin(b), c = Math.cos(b);
    // the lens per metre of boom: back along the bearing, and k to the screen's right
    const ux = -s - c * k, uz = -c + s * k;
    const want = this.zoomNow;
    const pitch = Math.max(this.PITCH_MIN, Math.min(this.PITCH_MAX, this.basePitch() + this.orbitTilt));
    this.pitchTan = Math.tan(pitch);
    const minDist = Math.min(want, this.MIN_BOOM); // no room behind him: the lens comes in close
    // the boom reaches as far as the player's zoom (and the lens ring at the rim). A solid's
    // body IN THE LINE to him (a thin cast: a corner it merely grazes is no reason to come
    // in) brings it in before that solid, but only one standing NEAR_FLOOR or further from
    // him: closer, it stands beside him, and the side slide dodges it (see NEAR_FLOOR).
    // Then the lens itself keeps CAM_PROBE_R clear of every solid's body (or passes over a
    // low one). The trees are left to the fade (world/Crowns.ts has their trunks too), and
    // so are their LEAVES: a boom that came in out of each crown made him twice as big
    // under every oak by the path, walking or running (run 6 polish, the run pump).
    let dist = want * this.rimFraction(rp.x, rp.z, ux * want, uz * want);
    // (`stayBeyond`, the lens as it is placed now: a solid that came into the line between
    // the lens and him (he walked on past it) is passed over or dodged, never pulled
    // through: the boom does not come in for it)
    const inLine = want * this.bodyEntry(rp.x, rp.z, ux * want, uz * want, this.WALL_PROBE);
    if (inLine >= this.NEAR_FLOOR && !(stayBeyond && this.boomNow > inLine + this.CAM_PROBE_R)) dist = Math.min(dist, inLine);
    dist = Math.max(minDist, Math.min(cap, dist));
    while (dist > minDist && !this.lensClear(rp.x + ux * dist, rp.y + this.eyeFor(dist, rp, ux, uz), rp.z + uz * dist, rp)) dist = Math.max(minDist, dist - 0.15);
    if (solidsOnly) { out.dist = dist; return out; } // (the look-ahead only asks how far the solids let it)
    const ex = rp.x + ux * dist, ey = rp.y + this.eyeFor(dist, rp, ux, uz), ez = rp.z + uz * dist;
    const lensInCrown = this.lensInCrown(ex, ey, ez, 0.3, false);            // an unfadeable tree: never a lens there
    const lensInLeaves = !lensInCrown && this.lensInCrown(ex, ey, ez, 0.3, true); // a forest tree: it fades
    // keep the WHOLE lens→ranger sightline above the rendered terrain, not just the lens
    // above the ground under itself (a clearance lift only, deterministic)
    let eye = this.eyeFor(dist, rp, ux, uz);
    const lx = rp.x + ux * dist, lz = rp.z + uz * dist;
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
    cost += 3 * (1 - this.opacityAt(dist * Math.hypot(1, k), eye));    // …and never so short he fades
    if (lensInCrown) cost += 3;
    else if (lensInLeaves) cost += 0.5; // the forest fades round the lens, but clear air is nicer
    if (!out.terrainClear) cost += 2;
    if (this.solidBetween(lx, lz, rp.x, rp.z)) cost += 4;              // a building / prop / person in the line
    if (this.solidHugsLens(lx, lz)) cost += 0.8;                        // …or right beside the lens, filling a side of the frame
    if (this.creatureBetween(lx, ly, lz, rp.x, headY, rp.z) || this.creatureBetween(lx, ly, lz, rp.x, chestY, rp.z)) cost += 4;
    if (this.crownBetween(lx, ly, lz, rp.x, headY, rp.z, false)) cost += 4; // an unfadeable tree
    else if (this.crownBetween(lx, ly, lz, rp.x, headY, rp.z, true)) cost += 0.5; // the forest fades, but a clear line is nicer
    out.cost = cost;
    return out;
  }

  /** The lowest underside of the near trees' leaves (grown by `margin`) above the ground
   *  point (x, z): how high a lens there may rise before it is in leaves. Infinity: none. */
  private crownFloor(x: number, z: number, margin: number): number {
    let floor = Infinity;
    for (const k of this.nearCrowns) floor = Math.min(floor, leavesFloorAt(k, x, z, margin));
    return floor;
  }

  /** Is (x, y, z) inside a near tree grown by `margin`? `fade`: only fadeable (true),
   *  only unfadeable (false) or any (null) trees. */
  private lensInCrown(x: number, y: number, z: number, margin: number, fade: boolean | null): boolean {
    for (const k of this.nearCrowns) {
      if (fade !== null && (k.tree >= 0) !== fade) continue;
      if (insideCrown(k, x, y, z, margin)) return true;
    }
    return false;
  }

  /** Does a near tree (fadeable or not, `fade`) cross the line from the lens (cx,cy,cz) to
   *  the ranger aim (ax,ay,az)? (world/Crowns.ts: only a tree genuinely between counts.) */
  private crownBetween(cx: number, cy: number, cz: number, ax: number, ay: number, az: number, fade: boolean): boolean {
    for (const k of this.nearCrowns) {
      if ((k.tree >= 0) !== fade) continue;
      if (blocksLine(k, cx, cy, cz, ax, ay, az)) return true;
    }
    return false;
  }

  /** Does the walk lens at (x, y, z) keep CAM_PROBE_R from every solid's body (see
   *  gatherNear: not the trees, not the parked jeep; over a low one it passes)? */
  private lensClear(x: number, y: number, z: number, rp: THREE.Vector3): boolean {
    return !this.lensInBody(x, y, z, this.CAM_PROBE_R, rp);
  }

  /** A building, prop or person (not a tree) in the line from the lens to him on the
   *  ground plane — the same test the dev hook's viewClear uses. */
  private solidBetween(cx: number, cz: number, ax: number, az: number): boolean {
    for (const o of this.nearSolids) {
      if (this.isTree(o)) continue;
      if (obstacleGap(o, ax, az) + (o.box ? o.box.pad : 0) <= 0) continue; // the prop he stands at
      if (segmentCrosses(o, cx, cz, ax, az, 0.05, 0.95)) return true;
    }
    return false;
  }

  /** A building, prop or person (not a tree trunk) within arm's reach of the lens, or
   *  so close and big that it fills a third of the view (a parked jeep beside it). A
   *  building is measured by its real walls, never by the circle round it. */
  private solidHugsLens(lx: number, lz: number): boolean {
    for (const o of this.nearSolids) {
      if (this.isTree(o)) continue;
      if (obstacleGap(o, lx, lz) < 0.8) return true;
      if (obstacleSpan(o, lx, lz) > this.HUG_ANGLE) return true;
    }
    return false;
  }

  /** A creature in the line from the lens to the aim point (a sphere around its body,
   *  as the dev hook models it, plus a margin: dodge before it is in the way). */
  private creatureBetween(cx: number, cy: number, cz: number, ax: number, ay: number, az: number): boolean {
    const dx = ax - cx, dy = ay - cy, dz = az - cz;
    const len2 = dx * dx + dy * dy + dz * dz;
    if (len2 < 1e-6) return false;
    for (let i = 0; i < this.creatureCount; i++) {
      const a = this.creaturePool[i];
      const R = Math.max(0.45, a.h * 0.5) + 0.3, py = a.y + a.h * 0.5;
      const t = ((a.x - cx) * dx + (py - cy) * dy + (a.z - cz) * dz) / len2;
      if (t <= 0.03 || t >= 0.97) continue;
      const gx = a.x - (cx + dx * t), gy = py - (cy + dy * t), gz = a.z - (cz + dz * t);
      if (gx * gx + gy * gy + gz * gz <= R * R) return true;
    }
    return false;
  }

  /**
   * F-05 spherecast: the fraction of the boom (origin `ox,oz`, vector `dx,dz` = the
   * horizontal offset) that is clear before a sphere of radius `probe` round the lens
   * would enter a collision solid. 1 = no obstacle in the way. Solids that already
   * CONTAIN the origin (the prop the ranger stands at) are skipped so the lens never
   * collapses onto him at a POI. `skipTrees` leaves the tree trunks out (the fade carries
   * them). 2D ray–circle / ray–rectangle maths over the obstacle list — deterministic, so
   * an idle pose holds frame to frame.
   */
  private boomClearFraction(ox: number, oz: number, dx: number, dz: number, probe: number, nearOnly = false, skipTrees = false): number {
    if (dx * dx + dz * dz < 1e-6) return 1;
    let best = 1;
    for (const o of nearOnly ? this.nearSolids : this.obstacles) {
      if (skipTrees && this.isTree(o)) continue;
      // circles and building rectangles alike; a building by its real walls + the probe
      // (its pad is the ranger's elbow room, not wall: a boom that grazes a corner stays out)
      const t = segmentEntry(o, ox, oz, dx, dz, o.box ? probe - o.box.pad : probe);
      if (t < best) best = t;
    }
    return best;
  }

  // keepOutFraction's cast, kept in fields so its visitor is bound once (no garbage)
  private readonly koDisc: Obstacle = { x: 0, z: 0, r: 0 };
  private koOx = 0; private koOz = 0; private koDx = 0; private koDz = 0; private koProbe = 0; private koBest = 1;
  private readonly visitKeepOut = (x: number, z: number, r: number): void => {
    const o = this.koDisc;
    o.x = x; o.z = z; o.r = r;
    const t = segmentEntry(o, this.koOx, this.koOz, this.koDx, this.koDz, this.koProbe);
    if (t < this.koBest) this.koBest = t;
  };

  /** boomClearFraction for the host's keep-out discs (`lensKeepOut`: the parked
   *  helicopter's reach): 1 = the boom stays out of every one. */
  private keepOutFraction(ox: number, oz: number, dx: number, dz: number, probe: number): number {
    if (dx * dx + dz * dz < 1e-6) return 1;
    this.koOx = ox; this.koOz = oz; this.koDx = dx; this.koDz = dz; this.koProbe = probe; this.koBest = 1;
    this.host.lensKeepOut(this.visitKeepOut);
    return this.koBest;
  }

  /**
   * The terrain sightline ride: the metres the lens must lift so the STRAIGHT line from
   * the lens (lx,ly,lz) to the aim (ax,ay,az) clears the rendered terrain by
   * CAM_GROUND_CLR everywhere between them. It samples terrain.y (the analytic height of
   * the drawn ground) along the line. Raising the lens by δ raises the line at parameter t
   * by (1−t)·δ (the aim end is pinned), so a crest poking `deficit` above the line at t
   * needs δ ≥ deficit/(1−t); the worst sample wins and clears them all at once. Returns
   * the RAW need (the caller caps it at MAX_TERRAIN_LIFT); 0 on flat ground.
   */
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
