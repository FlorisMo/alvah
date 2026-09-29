/**
 * PlayerRig.ts — the mixer wiring for the ranger's locomotion (WORLD-PLAN §5 / W3.2,
 * run 6). Wraps the pure `PlayerAnim` gait maths around a THREE.AnimationMixer:
 *
 *  - the baked `idle`, `walk` and `run` clips play at all times; their weights follow
 *    the ground speed (idle ↔ moving, then walk ↔ run), so nothing ever pops;
 *  - walk and run are posed from ONE shared cycle phase through each clip's gait clock
 *    (left foot down at 0, right at 0.5, the planted foot sliding back evenly), so the
 *    feet never double-step in the crossfade; the phase turns at the rate that keeps the
 *    planted foot still on the ground (`cycleRate`);
 *  - after the mixer, the legs and arms swing wider about the clip's mean pose by the
 *    stride gain (`strideGain`), so a brisk walk takes long steps instead of blurring its
 *    legs; then the body stands on its lowest sole (or, in a run's flight, just above it).
 *
 * The clocks and stride tables are measured from the clips when the rig attaches (a
 * few ms): nothing about this particular model is pinned.
 *
 * It also counts the foot plants as the phase crosses them (the footsteps follow the
 * feet) and exposes the soles it tracks (the dev hook's foot probe).
 *
 * When the rigged GLB is missing its clips (procedural fallback) there is no mixer: a
 * gentle vertical bob drives the stand-in while moving, `clip()` reports null and the
 * footsteps come from walked distance instead (Player).
 *
 * Locomotion is EXEMPT from the reduced-motion freeze (§3.4): the mixer always advances
 * with real dt. Only the procedural bob (secondary motion without a baked step) holds.
 */

import * as THREE from 'three';
import {
  stepWalkWeight, stepRunWeight, dominantGait, strideGain, cycleRate, stepPhase, flightLift,
  gaitClockTimes, stanceTravel, clockTime, cadence,
  FOOT_PLANTS, STANCE_SHARE, TURN_STEP_SPEED, WALK_GAIN, WALK_GAIN_MIN, RUN_GAIN,
  type Gait, type GaitClock, type FootSample,
} from './PlayerAnim.ts';
import { plantsBetween } from '../core/footstep.ts';

/** Match a baked clip by name, tolerating the rig's naming (idle/walk/run/rest). */
function pick(clips: THREE.AnimationClip[], re: RegExp): THREE.AnimationClip | null {
  return clips.find((c) => re.test(c.name)) ?? null;
}

/** The bones the stride gain swings wider, with the share of the gain each takes.
 *  Hip and shoulder carry the stride; the knee and elbow a little (a longer step bends
 *  the swinging knee more, so the foot clears the ground); shin-to-foot, spine and head
 *  are left as authored. */
const STRIDE_BONES: ReadonlyArray<readonly [RegExp, number]> = [
  [/^(Left|Right)UpLeg$/, 1],
  [/^(Left|Right)Leg$/, 0.5],
  [/^(Left|Right)Arm$/, 0.7],
  [/^(Left|Right)ForeArm$/, 0],
];

/** The stride gains each clip's ground table is measured at (the gain never drops
 *  under the walk's floor). */
const TABLE_GAINS: readonly number[] = [WALK_GAIN_MIN, 1.6, 1.9];
/** Poses sampled over one loop when measuring a clip. */
const SAMPLES = 64;

interface StrideBone {
  bone: THREE.Object3D;
  /** The bone's mean rotation over the walk and the run cycle (the swing's centre). */
  walkMean: THREE.Quaternion;
  runMean: THREE.Quaternion;
  share: number;
}

/** One tracked point of a sole: a skinned vertex (its mesh + index). */
interface SolePoint { mesh: THREE.SkinnedMesh; index: number }
/** A world point (the dev hook's foot probe). */
type P3 = { x: number; y: number; z: number };
/** One sole's heel, ball of the foot (the planted toe) and tip, in world metres. */
export interface SoleProbe { heel: P3; toe: P3; tip: P3 }
/** A sole: heel, ball of the foot (the planted toe) and tip. */
interface Sole { heel: SolePoint; toe: SolePoint; tip: SolePoint }

/** A clip's seamless loop: from its first key to its last (the authored clips start
 *  their first key a frame in, and end on a copy of it). */
function loopOf(clip: THREE.AnimationClip): [number, number] {
  let t0 = Infinity, t1 = -Infinity;
  for (const tr of clip.tracks) {
    if (tr.times.length < 2) continue;
    t0 = Math.min(t0, tr.times[0]);
    t1 = Math.max(t1, tr.times[tr.times.length - 1]);
  }
  return Number.isFinite(t0) && t1 > t0 ? [t0, t1] : [0, clip.duration];
}

/** The mean of a quaternion track over one loop (sign-aligned sum, normalized). */
function meanRotation(clip: THREE.AnimationClip, boneName: string, fallback: THREE.Quaternion): THREE.Quaternion {
  const track = clip.tracks.find((t) => t.name === `${boneName}.quaternion`);
  if (!track) return fallback.clone();
  const interp = new THREE.QuaternionLinearInterpolant(track.times, track.values, 4, new Float32Array(4));
  const [t0, t1] = loopOf(clip);
  const sum = new THREE.Vector4();
  const q = new THREE.Quaternion();
  const N = 48;
  for (let i = 0; i < N; i++) {
    const v = interp.evaluate(t0 + (i / N) * (t1 - t0)) as ArrayLike<number>;
    q.set(v[0], v[1], v[2], v[3]);
    // align hemispheres to the running sum so the average never cancels out
    if (i > 0 && sum.x * q.x + sum.y * q.y + sum.z * q.z + sum.w * q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w);
    sum.x += q.x; sum.y += q.y; sum.z += q.z; sum.w += q.w;
  }
  return new THREE.Quaternion(sum.x, sum.y, sum.z, sum.w).normalize();
}

const _q = new THREE.Quaternion();
const _d = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();

export class PlayerRig {
  private mixer: THREE.AnimationMixer | null = null;
  private idle: THREE.AnimationAction | null = null;
  private walk: THREE.AnimationAction | null = null;
  private run: THREE.AnimationAction | null = null;
  private walkClock: GaitClock | null = null;
  private runClock: GaitClock | null = null;
  private walkWeight = 0;
  private runWeight = 0;
  /** The shared walk/run cycle, normalized [0,1): left foot down at 0, right at 0.5. */
  private phase = 0;
  private rate = 0;
  private walkName = 'walk';
  private runName = 'run';
  private idleName = 'idle';
  /** The model the rig drives (the wrapper Player adds); its y stands him on his soles. */
  private model: THREE.Object3D | null = null;
  private strideBones: StrideBone[] = [];
  /** Heel, ball and tip of each sole (left, right): the settle and the foot probe. */
  private soles: Sole[] = [];
  private gain = 1;
  // procedural fallback: the stand-in group to bob when no clips are staged.
  private proc: THREE.Object3D | null = null;
  private procPhase = 0;
  // F-31: true while the ranger rides a vehicle seated — locomotion freezes and
  // `clip()` reports a still `sit`, so the dev hook never reads idle/walk while
  // driving (the boarding CUT the empty-jeep story hung on).
  private seated = false;
  // wave 2 tank steering: this frame's gait hints from Player.walk (consumed by the
  // next update): backing up turns the cycle backwards, and a turn on the spot
  // steps the feet at a slow walk instead of sliding round in the idle pose.
  private backward = false;
  private turning = false;

  /**
   * Drive `model` from its baked clips. Needs an idle-ish and a walk-ish clip; the run
   * clip is optional (without it the walk covers every speed). If idle or walk is
   * absent (or the walk cannot be measured) it falls back to the procedural bob.
   * Measures the locomotion clips first (their gait clocks and ground tables), then
   * plays every action from frame one so the crossfades only move weights; walk and run
   * are posed by the shared phase (timeScale 0), idle runs on its own clock.
   */
  attach(model: THREE.Object3D, clips: THREE.AnimationClip[]): void {
    const idleClip = pick(clips, /idle|rest|stand|breath/i);
    const walkClip = pick(clips, /walk/i);
    const runClip = pick(clips, /run|jog/i);
    if (!idleClip || !walkClip) { this.attachProcedural(model); return; }
    this.model = model;

    // the stride bones and their mean pose per clip (the centre the swing grows about)
    this.strideBones = [];
    model.traverse((o) => {
      if (!(o as THREE.Bone).isBone) return;
      const hit = STRIDE_BONES.find(([re]) => re.test(o.name));
      if (!hit) return;
      const walkMean = meanRotation(walkClip, o.name, o.quaternion);
      const runMean = runClip ? meanRotation(runClip, o.name, o.quaternion) : walkMean.clone();
      this.strideBones.push({ bone: o, walkMean, runMean, share: hit[1] });
    });
    const walkClock = this.measure(walkClip, STANCE_SHARE.walk, WALK_GAIN, 0);
    if (!walkClock) { this.attachProcedural(model); return; }
    this.walkClock = walkClock;
    this.runClock = runClip ? this.measure(runClip, STANCE_SHARE.run, RUN_GAIN, 1) : null;
    this.soles = findSoles(model);
    this.proc = null;

    this.mixer = new THREE.AnimationMixer(model);
    this.idle = this.mixer.clipAction(idleClip);
    this.walk = this.mixer.clipAction(walkClip);
    this.run = runClip && this.runClock ? this.mixer.clipAction(runClip) : null;
    this.idleName = idleClip.name;
    this.walkName = walkClip.name;
    this.runName = runClip?.name ?? 'run';
    this.idle.play().setEffectiveWeight(1);
    this.walk.play().setEffectiveWeight(0);
    this.walk.timeScale = 0;
    if (this.run) { this.run.play().setEffectiveWeight(0); this.run.timeScale = 0; }
  }

  /**
   * Measure a locomotion clip: pose it over one loop (on a scratch mixer, which puts the
   * bones back when it lets go), with the legs swung at a few stride gains, and read how
   * far forward the ball of each foot is. Its gait clock is built at the design gain; its
   * ground table at every gain. null if the model has no toe bones to read.
   */
  private measure(clip: THREE.AnimationClip, stance: number, designGain: number, runWeight: number): GaitClock | null {
    const model = this.model!;
    let ballL: THREE.Object3D | null = null, ballR: THREE.Object3D | null = null;
    model.traverse((o) => {
      if (o.name === 'LeftToeBase') ballL = o;
      else if (o.name === 'RightToeBase') ballR = o;
    });
    if (!ballL || !ballR) return null;
    const bl: THREE.Object3D = ballL, br: THREE.Object3D = ballR;
    const loop = loopOf(clip);
    const tmp = new THREE.AnimationMixer(model);
    const action = tmp.clipAction(clip);
    action.play();
    action.timeScale = 0;
    const inv = new THREE.Matrix4();
    const sampleAt = (gain: number): FootSample[] => {
      const out: FootSample[] = [];
      for (let i = 0; i < SAMPLES; i++) {
        const t = loop[0] + (i / SAMPLES) * (loop[1] - loop[0]);
        action.time = t;
        tmp.update(0);
        this.swing(gain, runWeight);
        model.updateMatrixWorld(true);
        inv.copy(model.matrixWorld).invert();
        const zL = bl.getWorldPosition(_v).applyMatrix4(inv).z;
        const zR = br.getWorldPosition(_v).applyMatrix4(inv).z;
        out.push({ t, zL, zR });
      }
      return out;
    };
    const design = sampleAt(designGain);
    const strides = TABLE_GAINS.map((g) => [g, stanceTravel(g === designGain ? design : sampleAt(g), loop, stance)] as const);
    action.stop();
    tmp.uncacheRoot(model);
    model.updateMatrixWorld(true);
    return { loop, times: gaitClockTimes(design, loop, stance), stance, strides };
  }

  /** No usable clips → bob this object gently while it moves. */
  attachProcedural(obj: THREE.Object3D): void {
    this.mixer = null;
    this.idle = this.walk = this.run = null;
    this.walkClock = this.runClock = null;
    this.model = null;
    this.strideBones = [];
    this.soles = [];
    this.proc = obj;
  }

  /** The rig has baked clips (its feet, and so its footsteps, follow the cycle). */
  get baked(): boolean {
    return this.mixer !== null;
  }

  /**
   * F-31: enter/leave the seated-rider state. While seated the ranger is parked in
   * the vehicle so `update()` freezes — nothing advances — and `clip()` reports a still
   * `sit`. Applied instantly (a state cut, never an animated pose-blend), so it
   * respects the motion-comfort law. On `false` the rig re-settles to idle.
   */
  setSeated(seated: boolean): void {
    this.seated = seated;
    if (seated && this.idle && this.walk) {
      // hold at rest so a later stand resumes from idle, never mid-stride
      this.walkWeight = 0;
      this.runWeight = 0;
      this.idle.setEffectiveWeight(1);
      this.walk.setEffectiveWeight(0);
      this.run?.setEffectiveWeight(0);
      if (this.model) this.model.position.y = 0;
    }
  }

  /** The next update's gait hints (Player.walk sets them each on-foot frame). */
  setGait(backward: boolean, turningOnTheSpot: boolean): void {
    this.backward = backward;
    this.turning = turningOnTheSpot;
  }

  /**
   * Advance one frame. `speed` is the ranger's post-collision ground speed (m/s).
   * Returns how many feet were put down this frame (the footsteps follow them).
   * Locomotion is reduced-motion-exempt, so the mixer always uses real dt; the
   * procedural fallback holds still under reduced-motion.
   */
  update(dt: number, speed: number, reduced: boolean): number {
    // F-31: seated in the vehicle → locomotion is frozen (he is riding).
    if (this.seated) return 0;
    const backward = this.backward, turning = this.turning;
    this.backward = this.turning = false; // hints last one frame (off foot: none)
    const stepping = turning ? Math.max(speed, TURN_STEP_SPEED) : speed;
    this.walkWeight = stepWalkWeight(this.walkWeight, stepping, dt);
    this.runWeight = stepRunWeight(this.runWeight, backward ? 0 : stepping, dt);
    if (this.mixer && this.idle && this.walk && this.walkClock) {
      const moving = this.walkWeight, r = this.run ? this.runWeight : 0;
      // one shared cycle, turned at the rate that keeps the planted foot still
      const prev = this.phase;
      this.rate = cycleRate(stepping, r, this.walkClock, this.runClock);
      this.phase = stepPhase(this.phase, this.rate, dt, backward);
      const plants = speed > 0.05 ? plantsBetween(prev, this.phase, FOOT_PLANTS, backward) : 0;
      this.idle.setEffectiveWeight(1 - moving);
      this.walk.setEffectiveWeight(moving * (1 - r));
      this.walk.time = clockTime(this.walkClock, this.phase);
      if (this.run && this.runClock) {
        this.run.setEffectiveWeight(moving * r);
        this.run.time = clockTime(this.runClock, this.phase);
      }
      this.mixer.update(dt);
      // the stride: legs and arms swing wider than the clip at speed (1 = as authored)
      this.gain = 1 + (strideGain(stepping, r) - 1) * moving;
      this.swing(this.gain, r);
      this.stand(r);
      return plants;
    }
    if (this.proc) {
      // gentle step-bob while moving; frozen at rest and under reduced-motion.
      const bobbing = !reduced && speed > 0.2;
      if (bobbing) {
        this.procPhase += dt * 8;
        this.proc.position.y = Math.abs(Math.sin(this.procPhase)) * 0.05;
      } else {
        this.procPhase = 0;
        this.proc.position.y = 0;
      }
    }
    return 0;
  }

  /** Swing the stride bones wider about their mean pose (walk and run means blended by
   *  `runWeight`) by `gain`. A no-op at gain 1. */
  private swing(gain: number, runWeight: number): void {
    if (gain <= 1.0005) return;
    for (const sb of this.strideBones) {
      const k = 1 + (gain - 1) * sb.share;
      // mean⁻¹·q is the swing away from the centre; raise it to the power k
      _q.copy(sb.walkMean).slerp(sb.runMean, runWeight);
      _d.copy(_q).invert().multiply(sb.bone.quaternion);
      if (_d.w < 0) _d.set(-_d.x, -_d.y, -_d.z, -_d.w);
      const half = Math.acos(Math.min(1, _d.w));
      const s = Math.sin(half);
      if (s > 1e-6) {
        _v.set(_d.x / s, _d.y / s, _d.z / s);
        _d.setFromAxisAngle(_v, 2 * half * k);
      }
      sb.bone.quaternion.copy(_q).multiply(_d);
    }
  }

  /** Stand the body on its lowest sole: on the ground (a wider stance stands lower, like
   *  a real long step; the clips themselves sink the sole 1-4 cm while planted), or in a
   *  run's flight just above it (`flightLift`: the run clip's feet only skim the ground). */
  private stand(runWeight: number): void {
    const model = this.model;
    if (!model) return;
    model.position.y = 0;
    const low = this.lowestSole();
    if (low !== null) model.position.y = flightLift(this.phase, runWeight) - low;
  }

  /** The lowest heel/ball/tip y (in the model's parent frame), or null without soles. */
  private lowestSole(): number | null {
    if (!this.model || this.soles.length === 0) return null;
    this.model.updateMatrixWorld(true);
    const parentInv = this.model.parent ? _m.copy(this.model.parent.matrixWorld).invert() : null;
    let low = Infinity;
    for (const s of this.soles) {
      for (const p of [s.heel, s.toe, s.tip]) {
        p.mesh.getVertexPosition(p.index, _v).applyMatrix4(p.mesh.matrixWorld);
        if (parentInv) _v.applyMatrix4(parentInv);
        if (_v.y < low) low = _v.y;
      }
    }
    return Number.isFinite(low) ? low : null;
  }

  /** The soles' world positions this frame (left then right: heel, ball of the foot
   *  and tip), for the dev hook's foot probe. Empty without a baked rig. */
  soleProbe(): SoleProbe[] {
    const out: SoleProbe[] = [];
    if (!this.model || this.soles.length === 0) return out;
    // where he stands NOW: the parents first, then updateMatrixWorld (only it refreshes a
    // skinned mesh's bindMatrixInverse; a stale one moves every skinned vertex)
    this.model.parent?.updateWorldMatrix(true, false);
    this.model.updateMatrixWorld(true);
    const at = (p: SolePoint): P3 => {
      p.mesh.getVertexPosition(p.index, _v).applyMatrix4(p.mesh.matrixWorld);
      return { x: _v.x, y: _v.y, z: _v.z };
    };
    for (const s of this.soles) out.push({ heel: at(s.heel), toe: at(s.toe), tip: at(s.tip) });
    return out;
  }

  /** The run gait is on (his pace has the run leading the blend, with or without a run
   *  clip to show it, the stand-in too): rangerMotion().running. */
  get running(): boolean {
    return !this.seated && dominantGait(this.walkWeight, this.runWeight) === 'run';
  }

  /** The gait for the dev hook: which clip leads, the cycle phase, footfalls per second,
   *  the run share and the stride gain this frame. */
  gait(): { name: Gait; phase: number; cadence: number; run: number; gain: number } {
    const name = this.seated ? 'idle' : dominantGait(this.walkWeight, this.run ? this.runWeight : 0);
    return { name, phase: this.phase, cadence: name === 'idle' ? 0 : cadence(this.rate), run: this.runWeight, gain: this.gain };
  }

  /**
   * The dev-hook `clip()` value: the dominant gait's name + its action time, or null
   * when running procedurally. `time` advances while the mixer runs, which the E2E
   * polls to prove the animation is actually playing (not a frozen pose).
   */
  clip(): { name: string; time: number } | null {
    // F-31: a seated rider is neither idle nor walking — report a still `sit` (time
    // frozen at 0), for the baked rig AND the procedural stand-in alike.
    if (this.seated) return { name: 'sit', time: 0 };
    if (!this.mixer || !this.idle || !this.walk) return null;
    const gait = dominantGait(this.walkWeight, this.run ? this.runWeight : 0);
    const action = gait === 'run' ? this.run! : gait === 'walk' ? this.walk : this.idle;
    const name = gait === 'run' ? this.runName : gait === 'walk' ? this.walkName : this.idleName;
    return { name, time: action.time };
  }
}

/**
 * Three points of each sole: the heel (rearmost), the ball of the foot (under the toe
 * joint: the "planted toe" a foot rolls over) and the tip. Among the vertices skinned
 * mostly to a foot or toe bone, the lowest ones at rest. Found in the model's own
 * frame (it faces +z at rest), left first.
 */
function findSoles(model: THREE.Object3D): Sole[] {
  model.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const sides: Record<'Left' | 'Right', { p: SolePoint; y: number; z: number }[]> = { Left: [], Right: [] };
  const ball: Partial<Record<'Left' | 'Right', number>> = {};
  model.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh || !mesh.skeleton) return;
    const si = mesh.geometry.getAttribute('skinIndex');
    const sw = mesh.geometry.getAttribute('skinWeight');
    const pos = mesh.geometry.getAttribute('position');
    if (!si || !sw || !pos) return;
    const names = mesh.skeleton.bones.map((b) => b.name);
    for (const b of mesh.skeleton.bones) {
      const t = /^(Left|Right)ToeBase$/.exec(b.name);
      if (t) ball[t[1] as 'Left' | 'Right'] = b.getWorldPosition(_v).applyMatrix4(inv).z;
    }
    for (let i = 0; i < pos.count; i++) {
      let best = -1, bw = 0;
      for (let c = 0; c < 4; c++) { const w = sw.getComponent(i, c); if (w > bw) { bw = w; best = si.getComponent(i, c); } }
      const m = /^(Left|Right)(Foot|ToeBase)$/.exec(names[best] ?? '');
      if (!m) continue;
      mesh.getVertexPosition(i, _v).applyMatrix4(mesh.matrixWorld).applyMatrix4(inv);
      sides[m[1] as 'Left' | 'Right'].push({ p: { mesh, index: i }, y: _v.y, z: _v.z });
    }
  });
  const out: Sole[] = [];
  for (const side of ['Left', 'Right'] as const) {
    const vs = sides[side];
    if (vs.length === 0) return [];
    let low = Infinity;
    for (const v of vs) if (v.y < low) low = v.y;
    const sole = vs.filter((v) => v.y <= low + 0.015);
    const heel = sole.reduce((a, b) => (b.z < a.z ? b : a));
    const tip = sole.reduce((a, b) => (b.z > a.z ? b : a));
    const bz = ball[side] ?? (heel.z + tip.z) / 2;
    const toe = sole.reduce((a, b) => (Math.abs(b.z - bz) < Math.abs(a.z - bz) ? b : a));
    out.push({ heel: heel.p, toe: toe.p, tip: tip.p });
  }
  return out;
}
