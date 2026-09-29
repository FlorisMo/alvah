/**
 * squirrel.ts — a LIVELY red squirrel (design run6-missions §4.4): the world's static
 * squirrel mesh brought to life by procedure alone. It dashes over the forest floor in
 * short bursts and stops to sit up and look, runs up and round a trunk with its belly to
 * the bark (head down coming down), sits on a branch with its tail curled, leaps on a
 * low arc from a branch to the next tree, digs with quick paws while little puffs of
 * earth fly, and flicks its tail when it chatters.
 *
 * It is an `Actor` (a home's resident like the boar family), so the world's homes can
 * hold it, lend it to an adventure and take it back; the calls a home makes of an actor
 * (idle, root about a spot, go somewhere, look at the ranger) become squirrel things
 * here: rooting about a spot = living round its tree, looking at him = running up to its
 * branch to watch him and chatter.
 *
 * The plans (where it goes, how fast, never at the lens) are the pure squirrel-math.ts;
 * this side seats them on the rendered ground and the bark, and adds the small motion:
 * the breath, the tail flick (a bend of the tail in the mesh's own vertex shader: one
 * draw call, no seam), the digging paws. Under reduced motion the small motion holds
 * still and a flick is not played; where it goes it still goes (a calm, clear move).
 */

import * as THREE from 'three';
import { Actor, type ActorEnv, type Lead } from './actors';
import {
  SQ, barkRadius, climbPlan, dashDirectPlan, dashPlan, digBob, dismountPlan, flick, hold, leapPlan, mountPlan, planTime,
  poseAt, sqStream, trunkPose, turn, wrap, type OnTrunk, type Segment, type SqPose, type Trunk,
} from './squirrel-math';

/** Where on a tree the squirrel sits to wait and watch: a branch (a stub sticking out of
 *  the trunk, `out` m from the axis, its top `h` m up, pointing along `ang`). */
export interface Branch { tree: Trunk; ang: number; h: number; out: number }

/** A tree the squirrel knows: its trunk and the branch it sits on. */
export interface SquirrelTree { trunk: Trunk; branch: Branch }

/** Where it is: on the ground, or on a trunk (and where on it), or on a branch. */
type Perch =
  | { kind: 'ground' }
  | { kind: 'trunk'; tree: SquirrelTree; at: OnTrunk }
  | { kind: 'branch'; tree: SquirrelTree }
  | { kind: 'stump'; top: number; x: number; z: number };

const V = new THREE.Vector3();
const Q = new THREE.Quaternion();
const E = new THREE.Euler();
const UP = new THREE.Vector3(0, 1, 0);
const SHADOW_Q = new THREE.Quaternion();
/** a contact shadow lies flat, facing up */
const FLAT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

export class Squirrel extends Actor {
  /** the trees it knows (its home oak, the trees along its way, the glade's oak) */
  readonly trees: SquirrelTree[];
  private pose: SqPose;
  private perch: Perch = { kind: 'ground' };
  private plan: Segment[] = [];
  private planT = 0;
  private planDone: ((ok: boolean) => void) | null = null;
  private life: SquirrelTree | null = null;
  private lifeStep = 0;
  private watching: Lead | null = null;
  private watchUntil = 0;
  private readonly rnd: () => number;
  private t = 0;
  private flickAt = -9;
  private chatterAt = -9;
  private digFrom = -9;
  private digPuffs = -1;
  private readonly tail = { value: 0 };
  /** a few points of the mesh (group space, at rest): its lowest point touches the ground */
  private hull: THREE.Vector3[] = [];
  private breathPhase: number;
  /** a dig: the home throws a puff of earth (x, z) */
  onDig: ((x: number, z: number) => void) | null = null;

  constructor(key: string, env: ActorEnv, opts: { height: number; trees: readonly SquirrelTree[]; seed?: number }) {
    super(key, 'eekhoorn', env, { height: opts.height, len: opts.height * 1.1 });
    this.trees = [...opts.trees];
    this.rnd = sqStream(opts.seed ?? 7);
    this.breathPhase = (opts.seed ?? 7) * 1.3;
    // the model hangs at the actor's point itself (no hind-feet pivot: a squirrel's
    // whole body turns about where it holds on)
    this.pivot.position.set(0, 0, 0);
    this.gaitNode.position.set(0, 0, 0);
    this.shadow.scale.set(0.6, 1, 0.6);
    this.pose = { x: 0, z: 0, alt: 0, yaw: 0, pitch: 0, roll: 0, act: 'sit' };
    void this.ready.then(() => this.dress());
  }

  /** Once the mesh is in: learn its shape (the ground contact) and give its tail the flick. */
  private dress(): void {
    const body = this.body;
    if (!body) return;
    body.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(this.group.matrixWorld).invert();
    let geoBox: THREE.Box3 | null = null;
    body.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || m.userData.hitSphere) return;
      const pos = m.geometry.attributes.position;
      const step = Math.max(1, Math.floor(pos.count / 260));
      const toGroup = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
      for (let i = 0; i < pos.count; i += step) this.hull.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(toGroup));
      m.geometry.computeBoundingBox();
      geoBox = m.geometry.boundingBox!.clone();
      this.bendTail(m, geoBox);
      // a touch of warm light in its fur (the low sun catching it), so the small red
      // squirrel reads against the dark bark and the brown forest floor
      for (const mat of [m.material].flat() as THREE.MeshStandardMaterial[]) {
        if (!mat.isMeshStandardMaterial) continue;
        mat.emissive.set('#ff9a4a');
        mat.emissiveIntensity = 0.16;
      }
    });
    // lift the model so its feet (the lowest points under the body, not the tail) stand on y=0
  }

  /** The tail bends back and up about its root in the vertex shader: a flick. */
  private bendTail(m: THREE.Mesh, box: THREE.Box3): void {
    const size = box.getSize(new THREE.Vector3());
    // the mesh sits up facing +z, its bushy tail behind (−z), rooted low at its back
    const hingeZ = box.min.z + size.z * 0.36;
    const hingeY = box.min.y + size.y * 0.22;
    const span = size.z * 0.3;
    for (const mat of [m.material].flat() as THREE.MeshStandardMaterial[]) {
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTail = this.tail;
        shader.uniforms.uHinge = { value: new THREE.Vector3(0, hingeY, hingeZ) };
        shader.uniforms.uSpan = { value: span };
        const head = 'uniform float uTail;\nuniform vec3 uHinge;\nuniform float uSpan;\n' +
          'vec3 sqBend(vec3 p) {\n' +
          '  float w = smoothstep(uHinge.z, uHinge.z - uSpan, p.z);\n' +
          '  float a = uTail * w;\n' +
          '  vec2 yz = p.yz - uHinge.yz;\n' +
          '  float c = cos(a), s = sin(a);\n' +
          '  return vec3(p.x, vec2(c * yz.x - s * yz.y, s * yz.x + c * yz.y) + uHinge.yz);\n' +
          '}\n';
        shader.vertexShader = head + shader.vertexShader
          .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = sqBend(transformed);')
          .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n{ float w = smoothstep(uHinge.z, uHinge.z - uSpan, position.z); float a = uTail * w; float c = cos(a), s = sin(a); objectNormal.yz = vec2(c * objectNormal.y - s * objectNormal.z, s * objectNormal.y + c * objectNormal.z); }');
      };
      mat.customProgramCacheKey = () => 'squirrel-tail';
      mat.needsUpdate = true;
    }
  }

  /* ------------------------------------------------------------ what it does ---- */

  /** Where it is now (its feet, its turn). */
  get now(): SqPose { return { ...this.pose }; }

  /** On a trunk or branch right now? */
  get up(): boolean { return this.perch.kind === 'trunk' || this.perch.kind === 'branch'; }

  /** The tree it is on (or null on the ground). */
  get onTree(): SquirrelTree | null {
    return this.perch.kind === 'trunk' || this.perch.kind === 'branch' ? this.perch.tree : null;
  }

  /** Play a plan; resolves true when it is played out, false when something else took over. */
  run(plan: Segment[], perch?: Perch): Promise<boolean> {
    this.life = null;
    this.watching = null;
    return this.play(plan, perch);
  }

  private play(plan: Segment[], perch?: Perch): Promise<boolean> {
    const old = this.planDone;
    this.planDone = null;
    old?.(false);
    this.plan = plan;
    this.planT = 0;
    // where this plan leaves it (never a perch left over from a plan it replaced)
    this.perchAfter = perch ?? null;
    return new Promise((done) => { this.planDone = done; });
  }

  /* the moves a script asks for: each knows where it leaves the squirrel */

  /** Run to a tree's branch and sit up there facing `face`. */
  goBranch(tree: SquirrelTree, face?: number): Promise<boolean> {
    return this.run(this.toBranchPlan(tree, face), { kind: 'branch', tree });
  }
  /** Leap from this tree's branch to another's bark, up to its branch, facing `face`. */
  goLeap(tree: SquirrelTree, face?: number): Promise<boolean> {
    return this.run(this.leapToPlan(tree, face), { kind: 'branch', tree });
  }
  /** Run to a stump and hop up onto it, facing `face`. */
  goStump(x: number, z: number, top: number, r: number, face: number): Promise<boolean> {
    return this.run(this.toStumpPlan(x, z, top, r, face), { kind: 'stump', top, x, z });
  }
  /** One quick dash to (x, z) on the ground. */
  goDash(x: number, z: number): Promise<boolean> {
    return this.run(this.dashDirect(x, z), { kind: 'ground' });
  }
  /** Up a trunk to `at`, clinging there. */
  goTrunk(tree: SquirrelTree, at: OnTrunk): Promise<boolean> {
    return this.run(this.toTrunkPlan(tree, at), { kind: 'trunk', tree, at });
  }
  /** A small turn where it is (on a stump, a branch, the ground): it keeps its perch. */
  look(yaw: number, hold1 = 0.5): Promise<boolean> {
    const p = this.pose;
    return this.run([turn(p, yaw), hold({ ...p, yaw }, hold1, p.act === 'cling' ? 'cling' : 'sit')], this.perch);
  }
  private perchAfter: Perch | null = null;

  /** A tail flick (with a chatter, a find, a call). */
  flick(): void { if (!this.env.reduced()) this.flickAt = this.t; }

  /** It chatters: a flick and a quick shiver of its body with the sound. */
  called(): void { this.flick(); this.chatterAt = this.t; }

  /** Dig at where it is for `secs` (quick paws, puffs of earth). */
  async dig(secs = 0.9): Promise<boolean> {
    const p = { ...this.pose, alt: 0, pitch: 0.55, roll: 0, act: 'dig' as const };
    this.digFrom = this.t;
    const ok = await this.play([hold(p, secs, 'dig')], { kind: 'ground' });
    this.digFrom = -9;
    return ok;
  }

  /** Sniff at the ground where it is (nose down, a quick bob), then sit up. */
  async sniffHere(secs = 0.8): Promise<boolean> {
    const p = { ...this.pose, alt: 0, roll: 0 };
    return this.run([
      { dur: 0.18, len: 0, act: 'sniff', at: (u) => ({ ...p, pitch: 0.75 * u, act: 'sniff' }) },
      hold({ ...p, pitch: 0.75, act: 'sniff' }, secs, 'sniff'),
      { dur: 0.2, len: 0, act: 'sit', at: (u) => ({ ...p, pitch: 0.75 * (1 - u), act: 'sit' }) },
    ], { kind: 'ground' });
  }

  /** Sit up and eat (nibbling an acorn held in its paws) for `secs`. */
  eat(secs: number): Promise<boolean> {
    return this.run([hold({ ...this.pose, pitch: 0, roll: 0, act: 'eat' }, secs, 'eat')], this.perch);
  }

  /** Put it at (x, z) — on its branch when (x, z) is one of its trees. The first time
   *  (the world is built) it is simply there; later, when its home is laid out anew while
   *  it is somewhere else (the mission stopped, the story moved on), it RUNS there itself
   *  rather than popping from one spot to another (a cut only under reduced motion). */
  override place(x: number, z: number, yaw = this.yaw): void {
    const tree = this.nearestTree(x, z);
    const atTree = tree && Math.hypot(tree.trunk.x - x, tree.trunk.z - z) < 0.6 ? tree : null;
    if (this.placed && !this.env.reduced() && Math.hypot(x - this.pose.x, z - this.pose.z) > 1.5) {
      void this.play(atTree ? this.toBranchPlan(atTree) : this.dashTo(x, z, yaw), atTree ? { kind: 'branch', tree: atTree } : { kind: 'ground' });
      return;
    }
    this.placed = true;
    if (atTree) { this.placeOnBranch(atTree); return; }
    this.pose = { x, z, alt: 0, yaw, pitch: 0, roll: 0, act: 'sit' };
    this.perch = { kind: 'ground' };
    this.plan = [];
    this.x = x; this.z = z; this.yaw = yaw;
    this.apply();
  }
  private placed = false;

  /** Put it on its branch of `tree` at once (a home laid out: it sits there). */
  placeOnBranch(tree: SquirrelTree, face?: number): void {
    this.placed = true;
    this.pose = this.branchPose(tree, face);
    this.perch = { kind: 'branch', tree };
    this.plan = [];
    this.x = this.pose.x; this.z = this.pose.z; this.yaw = this.pose.yaw;
    this.apply();
  }

  /** Sit up where it is. */
  override idle(): void {
    this.life = null;
    this.watching = null;
    void this.play([hold({ ...this.pose, act: this.up ? this.pose.act : 'sit' }, 0.1)], this.perch);
  }

  /** A home's "root about your spot": live round the tree nearest (cx, cz). */
  override root(cx = this.x, cz = this.z): void {
    const tree = this.nearestTree(cx, cz);
    if (!tree) { this.idle(); return; }
    // (a run home already under way plays out first: its life starts once it is there)
    this.watching = null;
    this.life = tree;
    this.lifeStep = 0;
  }

  /** Go to (x, z): a dash there (down off its tree first). Up a tree it is already safe
   *  from someone walking up: a short "step away" there is only a turn on its branch. */
  override go(x: number, z: number, opts: { speed?: 'walk' | 'trot' | number; face?: number } = {}): Promise<boolean> {
    if (this.up && Math.hypot(x - this.x, z - this.z) < 2.5) return this.play([turn(this.pose, Math.atan2(x - this.x, z - this.z))], this.perch);
    const plan = [...this.downPlan(), ...dashPlan(this.groundPose(), x, z, this.rnd, this.lens(), this.avoid())];
    if (opts.face !== undefined) plan.push(turn(poseAtEnd(plan, this.pose), opts.face));
    return this.run(plan, { kind: 'ground' });
  }

  /** Follow is not a squirrel thing: it waits where it is. */
  override follow(): void { this.idle(); }

  /** Look at the ranger: it runs up to its branch (or turns there) to watch him, and
   *  keeps watching `secs` s; then it goes on with its life. */
  override lookAt(lead: Lead, secs = Infinity): Promise<boolean> {
    const tree = this.life ?? this.onTree ?? this.nearestTree(this.x, this.z);
    const l = lead();
    const face = Math.atan2(l.x - this.x, l.z - this.z);
    const plan = tree ? this.toBranchPlan(tree, face) : [turn(this.pose, face)];
    const back = this.life;
    this.life = null;
    this.watching = lead;
    this.watchUntil = this.t + planTime(plan) + (Number.isFinite(secs) ? secs : 1e9);
    return this.play(plan, tree ? { kind: 'branch', tree } : this.perch).then((ok) => {
      if (!ok) return false;
      return new Promise<boolean>((done) => {
        const check = (): void => {
          if (this.watching !== lead) { done(false); return; }
          if (this.t >= this.watchUntil) { this.watching = null; if (back) this.root(back.trunk.x, back.trunk.z); done(true); return; }
          window.setTimeout(check, 120);
        };
        check();
      });
    });
  }

  /** Sniff at (x, z): it dashes up to it and sniffs. */
  override sniff(x: number, z: number, secs = 1.2): Promise<boolean> {
    const plan = [...this.downPlan(), ...dashPlan(this.groundPose(), x, z, this.rnd, this.lens(), this.avoid())];
    const end = poseAtEnd(plan, this.pose);
    plan.push(
      { dur: 0.18, len: 0, act: 'sniff', at: (u) => ({ ...end, pitch: 0.75 * u, act: 'sniff' }) },
      hold({ ...end, pitch: 0.75, act: 'sniff' }, secs, 'sniff'),
    );
    return this.run(plan, { kind: 'ground' });
  }

  /** Lying down is not a squirrel thing. */
  override async lie(): Promise<void> { /* it never lies down */ }

  /* ------------------------------------------------------------ the plans ---- */

  /** To a tree's branch (where it sits to watch), from wherever it is, facing `face`. */
  toBranchPlan(tree: SquirrelTree, face?: number): Segment[] {
    const b = tree.branch;
    const onIt = this.perch.kind === 'branch' && this.perch.tree === tree;
    if (onIt) return face === undefined ? [] : [turn(this.pose, face)];
    const plan: Segment[] = [];
    // the bark just under the branch's root, on its side
    const under: OnTrunk = { ang: b.ang, h: b.h - 0.12 };
    if ((this.perch.kind === 'trunk' || this.perch.kind === 'branch') && this.perch.tree === tree) {
      const at = this.perch.kind === 'trunk' ? this.perch.at : { ang: b.ang, h: b.h };
      plan.push(...climbPlan(tree.trunk, at, under, 0));
    } else {
      plan.push(...this.downPlan());
      const g = poseAtEnd(plan, this.pose);
      const start = this.climbStart(tree, g);
      const foot = footOf(tree.trunk, start);
      plan.push(...dashPlan(g, foot.x, foot.z, this.rnd, this.lens(), this.avoid()));
      plan.push(...mountPlan(poseAtEnd(plan, g), tree.trunk, { ang: start, h: 0.22 }));
      // round the trunk on the way up (a spiral), up to the branch
      plan.push(...climbPlan(tree.trunk, { ang: start, h: 0.22 }, under, 0));
    }
    plan.push(...this.ontoBranch(tree, face));
    return plan;
  }

  /** The leap from this tree's branch to another tree's trunk (they stand close). */
  leapToPlan(to: SquirrelTree, face?: number): Segment[] {
    const from = this.onTree;
    const plan: Segment[] = [];
    let a = this.pose;
    if (!from) return this.toBranchPlan(to, face);
    if (this.perch.kind !== 'branch') { plan.push(...this.toBranchPlan(from)); a = poseAtEnd(plan, a); }
    // it turns on the branch to face the next tree, then leaps to its bark, a little lower
    const toward = Math.atan2(to.trunk.x - a.x, to.trunk.z - a.z);
    plan.push(turn(a, toward));
    const landAng = Math.atan2(a.x - to.trunk.x, a.z - to.trunk.z); // the side facing it
    const land = trunkPose(to.trunk, { ang: landAng, h: Math.max(0.9, to.branch.h - 0.5) }, true, 'climb');
    plan.push(...leapPlan({ ...a, yaw: toward, pitch: 0.4 }, land));
    plan.push(hold(land, 0.18, 'cling'));
    // round and up to its branch
    plan.push(...climbPlan(to.trunk, { ang: landAng, h: land.alt }, { ang: to.branch.ang, h: to.branch.h - 0.12 }, 0));
    plan.push(...this.ontoBranch(to, face));
    return plan;
  }

  /** From the bark under a branch out onto it, then sit up facing `face`. */
  private ontoBranch(tree: SquirrelTree, face?: number): Segment[] {
    const b = tree.branch;
    const from = trunkPose(tree.trunk, { ang: b.ang, h: b.h - 0.12 }, true, 'climb');
    const sit = this.branchPose(tree, face);
    return [{
      dur: 0.34, len: 0.4, act: 'climb',
      at: (u) => {
        const e = u * u * (3 - 2 * u);
        return { x: from.x + (sit.x - from.x) * e, z: from.z + (sit.z - from.z) * e, alt: from.alt + (sit.alt - from.alt) * e + Math.sin(u * Math.PI) * 0.04,
          yaw: from.yaw + wrap(sit.yaw - from.yaw) * e, pitch: from.pitch + (sit.pitch - from.pitch) * e, roll: 0, act: 'climb' };
      },
    }, hold(sit, 0.2, 'sit')];
  }

  /** Sitting up on a tree's branch, facing `face` (default: out along the branch). */
  branchPose(tree: SquirrelTree, face?: number): SqPose {
    const b = tree.branch;
    const r = barkRadius(tree.trunk, b.h) + b.out;
    return { x: tree.trunk.x + Math.sin(b.ang) * r, z: tree.trunk.z + Math.cos(b.ang) * r, alt: b.h, yaw: face ?? b.ang, pitch: 0, roll: 0, act: 'sit' };
  }

  /** Down off its tree to the ground at the trunk's foot (nothing when it is on the ground). */
  downPlan(): Segment[] {
    const p = this.perch;
    if (p.kind === 'ground') return [];
    if (p.kind === 'stump') {
      const out = { x: p.x + Math.sin(this.pose.yaw) * 0.45, z: p.z + Math.cos(this.pose.yaw) * 0.45 };
      const a = this.pose;
      return [{ dur: 0.34, len: 0.5, act: 'leap', at: (u) => ({ ...a, x: a.x + (out.x - a.x) * u, z: a.z + (out.z - a.z) * u, alt: a.alt * (1 - u) + Math.sin(u * Math.PI) * 0.12, pitch: 0.7, act: 'leap' }) }];
    }
    const tree = p.tree;
    const at: OnTrunk = p.kind === 'trunk' ? p.at : { ang: tree.branch.ang, h: tree.branch.h - 0.12 };
    const plan: Segment[] = [];
    if (p.kind === 'branch') {
      // back off the branch onto the bark, head down
      const s = this.pose;
      const on = trunkPose(tree.trunk, at, false, 'climb');
      plan.push({ dur: 0.3, len: 0.4, act: 'climb', at: (u) => {
        const e = u * u * (3 - 2 * u);
        return { x: s.x + (on.x - s.x) * e, z: s.z + (on.z - s.z) * e, alt: s.alt + (on.alt - s.alt) * e, yaw: s.yaw + wrap(on.yaw - s.yaw) * e, pitch: on.pitch * e, roll: e > 0.5 ? Math.PI : 0, act: 'climb' };
      } });
    }
    // head first down the bark, round toward where it goes next (a little spiral)
    const downAng = at.ang + (this.rnd() < 0.5 ? -1 : 1) * (0.6 + this.rnd() * 0.8);
    plan.push(...climbPlan(tree.trunk, at, { ang: downAng, h: 0.25 }, 0));
    plan.push(...dismountPlan(tree.trunk, { ang: downAng, h: 0.25 }));
    return plan;
  }

  /** Up onto a stump's top (x, z, top height) and sit up there facing `face`. */
  toStumpPlan(x: number, z: number, top: number, r: number, face: number): Segment[] {
    const plan = [...this.downPlan()];
    const g = poseAtEnd(plan, this.pose);
    const d = Math.hypot(g.x - x, g.z - z) || 1;
    const foot = { x: x + ((g.x - x) / d) * (r + 0.3), z: z + ((g.z - z) / d) * (r + 0.3) };
    plan.push(...dashPlan(g, foot.x, foot.z, this.rnd, this.lens(), this.avoid()));
    const a = poseAtEnd(plan, g);
    const on: SqPose = { x, z, alt: top, yaw: face, pitch: 0, roll: 0, act: 'sit' };
    plan.push({ dur: 0.36, len: Math.hypot(x - a.x, z - a.z), act: 'leap', at: (u) => ({
      x: a.x + (x - a.x) * u, z: a.z + (z - a.z) * u, alt: top * u + Math.sin(u * Math.PI) * 0.18,
      yaw: a.yaw + wrap(face - a.yaw) * u, pitch: 0.6 * Math.sin(u * Math.PI), roll: 0, act: 'leap' }) });
    plan.push(hold(on, 0.1, 'sit'));
    return plan;
  }

  /** Dash (on the ground) to (x, z), down off its tree first; `lens` bends it round. */
  dashTo(x: number, z: number, face?: number): Segment[] {
    const plan = [...this.downPlan()];
    plan.push(...dashPlan(poseAtEnd(plan, this.pose), x, z, this.rnd, this.lens(), this.avoid()));
    if (face !== undefined) plan.push(turn(poseAtEnd(plan, this.pose), face));
    return plan;
  }

  /** One quick dash straight to (x, z), down off its tree or stump first (the show's and
   *  a pick's dash: a single burst so the show keeps its pace). */
  dashDirect(x: number, z: number): Segment[] {
    const down = this.downPlan();
    return [...down, ...dashDirectPlan(poseAtEnd(down, this.pose), x, z)];
  }

  /** Up the trunk of `tree` to `at` (from wherever it is), clinging there head up. */
  toTrunkPlan(tree: SquirrelTree, at: OnTrunk): Segment[] {
    const plan = [...this.downPlan()];
    const g = poseAtEnd(plan, this.pose);
    const foot = footOf(tree.trunk, at.ang);
    plan.push(...dashPlan(g, foot.x, foot.z, this.rnd, this.lens(), this.avoid()));
    plan.push(...mountPlan(poseAtEnd(plan, g), tree.trunk, { ang: at.ang, h: 0.22 }));
    plan.push(...climbPlan(tree.trunk, { ang: at.ang, h: 0.22 }, at, 0));
    plan.push(hold(trunkPose(tree.trunk, at, true, 'cling'), 0.1, 'cling'));
    return plan;
  }

  /** Where it will be once `plan` is played (from where it is now). */
  endOf(plan: readonly Segment[]): SqPose { return poseAtEnd(plan, this.pose); }

  /** The side of a tree it starts up: the side facing where it comes from. */
  private climbStart(tree: SquirrelTree, from: { x: number; z: number }): number {
    return Math.atan2(from.x - tree.trunk.x, from.z - tree.trunk.z);
  }

  private groundPose(): SqPose {
    return { ...this.pose, alt: 0, pitch: 0, roll: 0, act: 'sit' };
  }

  /** The lens a dash never runs at (the camera). */
  private lens(): { x: number; z: number } | undefined {
    return this.lensAt?.() ?? undefined;
  }
  /** where the camera is (set by the world: a dash bends round it) */
  lensAt: (() => { x: number; z: number }) | null = null;
  /** where the ranger stands (set by an adventure: a dash goes round him, never over his feet) */
  rangerAt: (() => { x: number; z: number }) | null = null;
  private avoid(): { x: number; z: number; r: number } | undefined {
    const r = this.rangerAt?.();
    return r ? { x: r.x, z: r.z, r: 1.6 } : undefined;
  }

  private nearestTree(x: number, z: number): SquirrelTree | null {
    let best: SquirrelTree | null = null, bd = Infinity;
    for (const t of this.trees) {
      const d = Math.hypot(t.trunk.x - x, t.trunk.z - z);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  /* -------------------------------------------------------------- its life ---- */

  /** Living round its tree while nobody needs it: sit on the branch, run down, forage
   *  at the tree's foot in dash-stop-dash bursts, nibble, run back up round the trunk. */
  private nextLife(tree: SquirrelTree): void {
    const r = this.rnd();
    const plan: Segment[] = [];
    let perch: Perch;
    if (this.perch.kind === 'branch' && this.perch.tree === tree) {
      if (this.lifeStep % 3 !== 2) {
        // sit a while, looking round now and then
        const p = this.pose;
        plan.push(hold(p, 1.6 + r * 2.4, 'sit'), turn(p, tree.branch.ang + (this.rnd() - 0.5) * 1.6), hold({ ...p, act: 'sit' }, 1 + this.rnd() * 2, 'sit'));
        perch = this.perch;
      } else {
        // down to forage: two or three spots at the tree's foot (its front side)
        plan.push(...this.downPlan());
        let g = poseAtEnd(plan, this.pose);
        const n = 2 + Math.floor(this.rnd() * 2);
        for (let i = 0; i < n; i++) {
          const a = tree.branch.ang + (this.rnd() - 0.5) * 2.2;
          const d = barkRadius(tree.trunk, 0) + 0.8 + this.rnd() * 1.6;
          const tx = tree.trunk.x + Math.sin(a) * d, tz = tree.trunk.z + Math.cos(a) * d;
          plan.push(...dashPlan(g, tx, tz, this.rnd, this.lens(), this.avoid()));
          g = poseAtEnd(plan, g);
          plan.push(
            { dur: 0.16, len: 0, act: 'sniff', at: (u) => ({ ...g, pitch: 0.7 * u, act: 'sniff' }) },
            hold({ ...g, pitch: 0.7, act: 'sniff' }, 0.6 + this.rnd() * 0.6, 'sniff'),
            hold({ ...g, pitch: 0, act: 'eat' }, 1.2 + this.rnd() * 1.6, 'eat'),
          );
        }
        perch = { kind: 'ground' };
      }
    } else {
      // back up its tree (round the trunk) to the branch
      plan.push(...this.toBranchPlan(tree));
      perch = { kind: 'branch', tree };
    }
    this.lifeStep += 1;
    void this.play(plan, perch).then(() => {});
  }

  /* --------------------------------------------------------------- frame ---- */

  override update(dt: number, _t: number): void {
    this.t += dt;
    const reduced = this.env.reduced();
    if (this.plan.length) {
      this.planT += dt;
      const total = planTime(this.plan);
      const p = poseAt(this.plan, Math.min(this.planT, total));
      this.step(p, dt);
      if (this.planT >= total) {
        this.plan = [];
        if (this.perchAfter) { this.perch = this.perchAfter; this.perchAfter = null; }
        else this.perch = inferPerch(this.pose, this.trees);
        const done = this.planDone;
        this.planDone = null;
        done?.(true);
      }
    } else {
      this.speed = 0;
      if (this.life) this.nextLife(this.life);
      else if (this.watching) {
        // it keeps its eye on him: a small turn now and then on its branch
        const l = this.watching();
        const face = Math.atan2(l.x - this.pose.x, l.z - this.pose.z);
        if (this.pose.act === 'sit' && Math.abs(wrap(face - this.pose.yaw)) > 0.5) void this.play([turn(this.pose, face)], this.perch);
      }
    }
    // digging: little puffs of earth thrown up from under its paws
    if (this.pose.act === 'dig' && this.digFrom > -9 && this.onDig) {
      const k = Math.floor((this.t - this.digFrom) / 0.22);
      if (k !== this.digPuffs) {
        this.digPuffs = k;
        this.onDig(this.pose.x + Math.sin(this.pose.yaw) * 0.09, this.pose.z + Math.cos(this.pose.yaw) * 0.09);
      }
    }
    // the tail: a flick lifts it and lets it fall (still under reduced motion)
    this.tail.value = reduced ? 0 : flick(this.t - this.flickAt) * 0.55 + (this.pose.act === 'run' || this.pose.act === 'leap' ? -0.18 : 0);
    this.apply(reduced);
  }

  private step(p: SqPose, dt: number): void {
    const moved = Math.hypot(p.x - this.pose.x, p.z - this.pose.z) + Math.abs(p.alt - this.pose.alt);
    this.speed = dt > 0 ? moved / dt : 0;
    this.pose = p;
    this.x = p.x; this.z = p.z; this.yaw = p.yaw;
  }

  /** Seat the pose: on the ground its lowest point touches the ground; on the bark its
   *  belly holds on; the small motion rides on top. */
  private apply(reduced = this.env.reduced()): void {
    const p = this.pose;
    const g = this.env.groundY(p.x, p.z);
    let pitch = p.pitch;
    let lift = 0;
    const s = this.t;
    if (!reduced) {
      if (p.act === 'dig' && this.digFrom > -9) { lift += digBob(s - this.digFrom); pitch += 0.12 * Math.sin((s - this.digFrom) * 22); }
      if (p.act === 'eat') pitch += 0.05 * Math.sin(s * 14);
      if (p.act === 'sit' || p.act === 'cling') pitch += 0.015 * Math.sin(s * 2.2 + this.breathPhase);
      const ch = s - this.chatterAt;
      if (ch >= 0 && ch < 0.6) pitch += 0.07 * Math.sin(ch * 38) * (1 - ch / 0.6);
    }
    E.set(pitch, 0, p.roll, 'YXZ');
    Q.setFromEuler(E);
    const yawQ = new THREE.Quaternion().setFromAxisAngle(UP, p.yaw);
    this.group.quaternion.copy(yawQ).multiply(Q);
    let x = p.x, z = p.z, y = g + p.alt + lift;
    if (this.hull.length) {
      if (p.act === 'cling' || p.act === 'climb') {
        // belly to the bark: push out along the outward normal until nothing is inside
        const out = new THREE.Vector3(-Math.sin(p.yaw), 0, -Math.cos(p.yaw)); // facing the trunk: out is behind it
        let inward = -Infinity;
        for (const h of this.hull) { V.copy(h).applyQuaternion(this.group.quaternion); inward = Math.max(inward, -V.dot(out)); }
        x += out.x * inward; z += out.z * inward;
        y = g + p.alt;
      } else if (p.act !== 'leap') {
        let low = Infinity;
        for (const h of this.hull) { V.copy(h).applyQuaternion(this.group.quaternion); low = Math.min(low, V.y); }
        y -= low;
      }
    }
    this.group.position.set(x, y, z);
    // its shadow stays on the ground under it (small and soft; gone high up)
    this.shadow.visible = p.alt < 0.3;
    const undo = SHADOW_Q.copy(this.group.quaternion).invert();
    this.shadow.quaternion.copy(undo).multiply(FLAT);
    this.shadow.position.set(p.x - x, g + 0.02 - y, p.z - z).applyQuaternion(undo);
  }

  override get doing(): string { return this.plan.length ? this.pose.act : this.life ? 'life' : this.watching ? 'watch' : 'sit'; }

  override get detail(): string {
    const p = this.pose;
    return `act=${p.act} alt=${p.alt.toFixed(2)} perch=${this.perch.kind} plan=${this.plan.length} t=${this.planT.toFixed(1)}/${planTime(this.plan).toFixed(1)}`;
  }
}

/** The pose at the end of `plan` (or `from` when it is empty). */
function poseAtEnd(plan: readonly Segment[], from: SqPose): SqPose {
  return plan.length ? plan[plan.length - 1].at(1) : from;
}

/** The ground at the foot of a trunk on side `ang`, a little out from the bark. */
function footOf(t: Trunk, ang: number): { x: number; z: number } {
  const r = barkRadius(t, 0) + 0.3;
  return { x: t.x + Math.sin(ang) * r, z: t.z + Math.cos(ang) * r };
}

/** Where a plan left it, when the plan did not say. */
function inferPerch(p: SqPose, trees: readonly SquirrelTree[]): Perch {
  if (p.alt < 0.05) return { kind: 'ground' };
  for (const tree of trees) {
    const d = Math.hypot(p.x - tree.trunk.x, p.z - tree.trunk.z);
    if (d < barkRadius(tree.trunk, p.alt) + 0.5) {
      return { kind: 'trunk', tree, at: { ang: Math.atan2(p.x - tree.trunk.x, p.z - tree.trunk.z), h: p.alt } };
    }
  }
  return { kind: 'ground' };
}

export { SQ };
