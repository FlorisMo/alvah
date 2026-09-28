/**
 * world/Presenter.ts — the title and the ranger maker are SHOTS OF THE REAL WORLD.
 *
 * While the world is presented (World.present('title' | 'maker')) it is frozen like an
 * activity (no player input, no prompts, no name-tags, no rings) but everything else lives:
 * the grass in the wind, the clouds, the animals, the ranger breathing. The presenter owns
 * the camera then, every frame, and turns the ranger:
 *
 *   title   a wide golden-hour view of the spawn clearing, the ranger small on the sand
 *           path, a barely-there drift (off under reduced motion)
 *   maker   the camera low in front of the ranger, who turns round to face you; he stands
 *           in the free part of the screen beside the maker panel (`setFocus`), full body
 *
 * Moving between shots is the play kit's eased reframe (roll 0, fixed FOV, yaw the short
 * way; a cut under reduced motion). Leaving (World.present(null)) hands the lens to the
 * follow rig as one move (CameraRig.handover) while he turns back to the forest.
 * Every pose is measured from the spawn and the ranger's measured height, never a copied
 * number, so it follows his size.
 */

import * as THREE from 'three';
import { makeReframe } from '../play/kit';
import { easeInOut, lerpAngle } from '../play/kit-math';
import { wrapAngle } from '../FollowCam';
import type { Player } from './Player';

export type Shot = 'title' | 'maker';

/** Where the ranger should stand on screen, as fractions of the canvas (0..1 from the
 *  left / the top), and how much of the canvas height he may fill. */
export interface Focus { x: number; y: number; h: number }

const TITLE_DRIFT_M = 0.25;   // the title's slow drift: this far to each side …
const TITLE_DRIFT_S = 22;     // … over this long a cycle (secondary motion, off when reduced)
const TURN_S = 0.8;           // the ranger turns round in this long (eased)
const GLIDE_S = 1.4;          // title → maker

export class Presenter {
  shot: Shot | null = null;
  /** The title pose, relative to the spawn (m): the lens and the point it looks at.
   *  Found by looking at candidate frames of the real clearing. */
  readonly title = {
    // low over the heath behind him and to his right, looking toward the low sun: heather
    // and grass in the front, the ranger on the sand track beside his cabin, the
    // missiebord and the oaks framing the right, a stag and a fox far off on the heath,
    // the west trail into the haze and the sky free for the title (it holds with the
    // grown trees and the bigger cabin of run 6's true scale too)
    lens: new THREE.Vector3(3.2, 1.7, 7.6),
    look: new THREE.Vector3(-7, 2.2, -13),
  };
  /** The maker: the lens stands this far round from straight behind the spawn heading
   *  (rad, + = to his right as he walks off), and its eye at this share of his height. */
  readonly maker = { bearing: 0.32, eye: 0.62, fill: 0.56 };

  private move: { update: (dt: number) => boolean } | null = null;
  private turn: { from: number; to: number; t: number } | null = null;
  private clock = 0;
  private focus: () => Focus = () => ({ x: 0.5, y: 0.5, h: 1 });
  private readonly pose = { lens: new THREE.Vector3(), look: new THREE.Vector3() };
  private readonly _right = new THREE.Vector3();

  private readonly camera: THREE.PerspectiveCamera;
  private readonly player: Player;
  private readonly spawn: { x: number; y: () => number; z: number; heading: number };
  private readonly live: () => { reduced: boolean; secondary: boolean };

  constructor(
    camera: THREE.PerspectiveCamera,
    player: Player,
    spawn: { x: number; y: () => number; z: number; heading: number },
    live: () => { reduced: boolean; secondary: boolean },
  ) {
    this.camera = camera;
    this.player = player;
    this.spawn = spawn;
    this.live = live;
  }

  get active(): boolean { return this.shot !== null; }

  /** Where the free part of the screen is (the maker panel covers the rest). */
  setFocus(fn: (() => Focus) | null): void {
    this.focus = fn ?? (() => ({ x: 0.5, y: 0.5, h: 1 }));
  }

  /** Go to a shot: an eased glide from where the lens is, or a cut (`cut`, or reduced
   *  motion). The ranger turns to fit it: his back to the lens on the title, facing it in
   *  the maker. */
  go(shot: Shot, cut: boolean): void {
    const reduced = this.live().reduced;
    this.shot = shot;
    this.clock = 0;
    this.poseOf(shot, 0);
    this.move = makeReframe(this.camera, this.pose.lens.clone(), this.pose.look.clone(), cut || reduced, GLIDE_S, 0);
    this.turnTo(shot === 'maker' ? this.makerFacing() : this.spawn.heading, cut || reduced);
  }

  /** Leave the shot for play: the ranger turns back to the forest (unless the player
   *  already steers him), the follow rig takes the lens (World.present(null)). */
  release(): void {
    this.shot = null;
    this.move = null;
    this.turnTo(this.spawn.heading, this.live().reduced);
  }

  /** Per frame, after the world's own update: the lens and the ranger's turn. */
  update(dt: number): void {
    this.stepTurn(dt);
    if (!this.shot) return;
    const { secondary } = this.live();
    if (secondary) this.clock += dt;
    if (this.move && !this.move.update(dt)) return; // still gliding
    this.move = null;
    // holding the shot: re-aim every frame (the ranger's size is measured once his rig
    // is in; the screen can turn), with the title's slow drift
    this.poseOf(this.shot, secondary && this.shot === 'title' ? this.clock : 0);
    this.camera.position.copy(this.pose.lens);
    this.camera.up.set(0, 1, 0); // roll 0, always
    this.camera.lookAt(this.pose.look);
  }

  /** The heading the ranger takes in the maker: facing the lens. */
  private makerFacing(): number {
    return wrapAngle(this.spawn.heading + Math.PI + this.maker.bearing);
  }

  private turnTo(yaw: number, cut: boolean): void {
    const g = this.player.group;
    if (cut) { g.rotation.y = yaw; this.turn = null; return; }
    if (Math.abs(wrapAngle(yaw - g.rotation.y)) < 1e-3) { this.turn = null; return; }
    this.turn = { from: g.rotation.y, to: yaw, t: 0 };
  }

  private stepTurn(dt: number): void {
    const tn = this.turn;
    if (!tn) return;
    // the player took over (a key, the stick, a tap-walk): his steering wins at once
    if (!this.shot && this.player.steering) { this.turn = null; return; }
    tn.t = Math.min(1, tn.t + dt / TURN_S);
    this.player.group.rotation.y = lerpAngle(tn.from, tn.to, easeInOut(tn.t));
    this.player.rig.setGait(false, true); // small steps while he turns on the spot
    if (tn.t >= 1) this.turn = null;
  }

  /** The pose of a shot into `this.pose`, `drift` seconds into the title's drift. */
  private poseOf(shot: Shot, drift: number): void {
    const { x, z } = this.spawn;
    const y = this.spawn.y();
    if (shot === 'title') {
      this.pose.lens.set(x + this.title.lens.x, y + this.title.lens.y, z + this.title.lens.z);
      this.pose.look.set(x + this.title.look.x, y + this.title.look.y, z + this.title.look.z);
      if (drift) {
        const s = Math.sin((drift / TITLE_DRIFT_S) * Math.PI * 2) * TITLE_DRIFT_M;
        this._right.subVectors(this.pose.look, this.pose.lens).setY(0).normalize();
        this.pose.lens.x += -this._right.z * s;
        this.pose.lens.z += this._right.x * s;
      }
      return;
    }
    // maker: in front of him, full body, in the free part of the screen
    const f = this.focus();
    const H = this.player.avatarTopY;                   // his measured height
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    const d = H / (this.maker.fill * f.h * 2 * tanV);  // he fills `fill` of the free height
    const b = this.spawn.heading + Math.PI + this.maker.bearing; // from him toward the lens
    const lx = x + Math.sin(b) * d, lz = z + Math.cos(b) * d;
    this.pose.lens.set(lx, y + H * this.maker.eye, lz);
    // aim beside and above/below him so his middle lands on the focus point
    const fwdX = x - lx, fwdZ = z - lz;
    const len = Math.hypot(fwdX, fwdZ) || 1;
    const rx = -fwdZ / len, rz = fwdX / len;          // the lens's right
    const nx = 2 * f.x - 1, ny = 1 - 2 * f.y;          // his middle in NDC
    const side = -nx * this.camera.aspect * tanV * d;
    const lift = -ny * tanV * d;
    this.pose.look.set(x + rx * side, y + H * 0.5 + lift, z + rz * side);
  }
}
