/**
 * PlayerRig.ts — the mixer wiring for the ranger's locomotion animation
 * (WORLD-PLAN §5 / W3.2). Wraps the pure `PlayerAnim` state machine around a
 * THREE.AnimationMixer: it keeps the baked `idle` + `walk` actions playing at
 * all times and crossfades their weights from the player's ground speed, so the
 * ranger breathes while standing and steps while walking, blending smoothly.
 *
 * When the rigged GLB is missing its clips (procedural fallback), there is no
 * mixer — a gentle vertical bob drives the stand-in group while moving instead,
 * and `clip()` reports null (the dev-hook contract: null when procedural).
 *
 * Locomotion is EXEMPT from the reduced-motion freeze (§3.4) — the mixer always
 * advances with real dt. Only the SECONDARY animal/ambient motion in World
 * freezes under reduced-motion; a walking ranger animates in both modes.
 */

import * as THREE from 'three';
import { stepWalkWeight, dominantGait, strideRate } from './PlayerAnim.ts';

/** Match a baked clip by name, tolerating the rig's naming (idle/walk/rest). */
function pick(clips: THREE.AnimationClip[], re: RegExp): THREE.AnimationClip | null {
  return clips.find((c) => re.test(c.name)) ?? null;
}

export class PlayerRig {
  private mixer: THREE.AnimationMixer | null = null;
  private idle: THREE.AnimationAction | null = null;
  private walk: THREE.AnimationAction | null = null;
  private walkWeight = 0;
  private walkName = 'walk';
  private idleName = 'idle';
  // procedural fallback: the stand-in group to bob when no clips are staged.
  private proc: THREE.Object3D | null = null;
  private procPhase = 0;
  // F-31: true while the ranger rides a vehicle seated — locomotion freezes and
  // `clip()` reports a still `sit`, so the dev hook never reads idle/walk while
  // driving (the boarding CUT the empty-jeep story hung on).
  private seated = false;

  /**
   * Drive `model` from its baked clips. Needs both an idle-ish and a walk-ish
   * clip to blend; if either is absent it falls back to procedural bob on the
   * model. `idle` starts full weight, `walk` at zero — both play from frame one
   * so the crossfade only moves weights (no start/stop pops).
   */
  attach(model: THREE.Object3D, clips: THREE.AnimationClip[]): void {
    const idleClip = pick(clips, /idle|rest|stand|breath/i);
    const walkClip = pick(clips, /walk/i);
    if (!idleClip || !walkClip) { this.attachProcedural(model); return; }

    this.mixer = new THREE.AnimationMixer(model);
    this.idle = this.mixer.clipAction(idleClip);
    this.walk = this.mixer.clipAction(walkClip);
    this.idleName = idleClip.name;
    this.walkName = walkClip.name;
    this.idle.play().setEffectiveWeight(1);
    this.walk.play().setEffectiveWeight(0);
    this.proc = null;
  }

  /** No usable clips → bob this object gently while it moves. */
  attachProcedural(obj: THREE.Object3D): void {
    this.mixer = null;
    this.idle = this.walk = null;
    this.proc = obj;
  }

  /**
   * F-31: enter/leave the seated-rider state. While seated the ranger is parked in
   * the vehicle (hidden under the jeep's canopy) so `update()` freezes — no idle or
   * walk advances — and `clip()` reports a still `sit`. Applied instantly (a state
   * cut, never an animated pose-blend), so it respects the motion-comfort law. On
   * `false` the rig re-settles to idle (weight reset) and locomotion resumes.
   */
  setSeated(seated: boolean): void {
    this.seated = seated;
    if (seated && this.idle && this.walk) {
      // hold at rest so a later stand resumes from idle, never mid-stride
      this.walkWeight = 0;
      this.idle.setEffectiveWeight(1);
      this.walk.setEffectiveWeight(0);
    }
  }

  /**
   * Advance one frame. `speed` is the ranger's post-collision ground speed
   * (m/s). Locomotion is reduced-motion-exempt, so the mixer always uses real
   * dt; the procedural fallback holds still under reduced-motion (a bob IS
   * secondary motion when there is no baked step to carry it).
   */
  update(dt: number, speed: number, reduced: boolean): void {
    // F-31: seated in the vehicle → locomotion is frozen (he is neither idling nor
    // walking, he is riding), so neither the mixer nor the procedural bob advances.
    if (this.seated) return;
    if (this.mixer && this.idle && this.walk) {
      this.walkWeight = stepWalkWeight(this.walkWeight, speed, dt);
      this.idle.setEffectiveWeight(1 - this.walkWeight);
      this.walk.setEffectiveWeight(this.walkWeight);
      // F-08: tie the walk clip's cadence to the REAL ground speed so the feet
      // plant on the ground instead of sliding (distance-per-cycle ≈ the authored
      // stride at any speed). Locomotion feedback, so it runs in both motion modes.
      this.walk.timeScale = strideRate(speed);
      this.mixer.update(dt);
      return;
    }
    if (this.proc) {
      // gentle step-bob while moving; frozen at rest and under reduced-motion.
      const moving = !reduced && speed > 0.2;
      if (moving) {
        this.procPhase += dt * 8;
        this.proc.position.y = Math.abs(Math.sin(this.procPhase)) * 0.05;
      } else {
        this.procPhase = 0;
        this.proc.position.y = 0;
      }
    }
  }

  /**
   * The dev-hook `clip()` value: the dominant gait's name + its action time, or
   * null when running procedurally. `time` advances while the mixer runs, which
   * the E2E polls to prove the animation is actually playing (not a frozen pose).
   */
  clip(): { name: string; time: number } | null {
    // F-31: a seated rider is neither idle nor walking — report a still `sit` (time
    // frozen at 0) so the in-vehicle drive frames never read the old planted-idle
    // lie, for the baked rig AND the procedural stand-in alike.
    if (this.seated) return { name: 'sit', time: 0 };
    if (!this.mixer || !this.idle || !this.walk) return null;
    const gait = dominantGait(this.walkWeight);
    const action = gait === 'walk' ? this.walk : this.idle;
    return { name: gait === 'walk' ? this.walkName : this.idleName, time: action.time };
  }
}
