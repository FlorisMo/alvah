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
import { acornGeometry, acornMaterial } from './acorn';
import {
  SQ, anticPlan, barkRadius, climbPlan, dashDirectPlan, dashPlan, digBob, dismountPlan, flick, hold, leapPlan, mountPlan, planTime,
  poseAt, settlePlan, sqStream, tailAt, trunkPose, turn, wrap, type AnticKind, type OnTrunk, type Segment, type SqPose, type Trunk,
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
/** Where the cone it nibbles sits from its paws' point (group space, m): a little lower and
 *  out in front of its chest. */
const CONE_HELD = new THREE.Vector3(0, -0.03, 0.02);
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
  /** where the last plan left it (while a plan plays, `where` works it out from the pose) */
  private settled: Perch = { kind: 'ground' };
  /** the stumps it hops onto (their top, their radius) */
  readonly stumps: { x: number; z: number; top: number; r: number }[] = [];
  private plan: Segment[] = [];
  private planT = 0;
  private planDone: ((ok: boolean) => void) | null = null;
  private life: SquirrelTree | null = null;
  private lifeStep = 0;
  private watching: Lead | null = null;
  private watchUntil = 0;
  private rnd: () => number;
  private t = 0;
  private flickAt = -9;
  private chatterAt = -9;
  private digFrom = -9;
  private digPuffs = -1;
  private readonly tail = { value: 0 };
  /** a soft warm rim round its outline (0..1): it waits for him, over there (the fur's own
   *  colours stay; only the edge catches a warm light) */
  private readonly rim = { value: 0 };
  private rimTo = 0;
  /** a few points of the mesh (group space, at rest): its lowest point touches the ground */
  private hull: THREE.Vector3[] = [];
  private breathPhase: number;
  /** a dig: the home throws a puff of earth (x, z) */
  onDig: ((x: number, z: number) => void) | null = null;
  /** the acorn in its mouth (shown while it carries one; nibbled smaller as it eats) */
  private readonly nut = new THREE.Mesh(acornGeometry(), acornMaterial());
  private carrying = false;
  private readonly mouth = new THREE.Vector3();
  private readonly paws = new THREE.Vector3();
  private eatFrom = -9;
  private eatFor = 1;
  /** run 7 (ek-day): the pine cone it nibbles in its paws (an antic), stripped smaller as it
   *  goes; the stripped scales fall (`onScale`: the home drops one at x, y, z) */
  private readonly cone = new THREE.Mesh(pineConeGeometry(), pineConeMaterial());
  private coneFrom = -9;
  private coneFor = 1;
  private scaleAt = 0;
  onScale: ((x: number, y: number, z: number) => void) | null = null;
  /** the tail's held bend now (an antic's), eased so a cut-short antic never snaps it */
  private tailHold = 0;

  /** how much warm light its fur catches (the emissive's strength): see `dress` */
  private readonly warmth: number;

  /**
   * Run 7 (additive): `animal` — a content id with a coat of its own on the squirrel's model
   * (the eekhoorn's rare visitor, 'eekhoorn-donker': its dark coat comes from the world's
   * one dressing, Coat.ts), default 'eekhoorn'; `warmth` — how much of the low sun's warm
   * light its fur catches (default 0.16; a dark coat less, so it reads brown, not orange).
   * Its size is `height` (a young one: smaller).
   */
  constructor(key: string, env: ActorEnv, opts: { height: number; trees: readonly SquirrelTree[]; seed?: number; animal?: string; warmth?: number }) {
    super(key, opts.animal ?? 'eekhoorn', env, { height: opts.height, len: opts.height * 1.1 });
    this.warmth = opts.warmth ?? 0.16;
    this.homeReach = 45; // (it runs home from anywhere round its glade, never a cut in view)
    this.trees = [...opts.trees];
    this.rnd = sqStream(opts.seed ?? 7);
    this.breathPhase = (opts.seed ?? 7) * 1.3;
    // the model hangs at the actor's point itself (no hind-feet pivot: a squirrel's
    // whole body turns about where it holds on)
    this.pivot.position.set(0, 0, 0);
    this.gaitNode.position.set(0, 0, 0);
    this.shadow.scale.set(0.6, 1, 0.6);
    this.pose = { x: 0, z: 0, alt: 0, yaw: 0, pitch: 0, roll: 0, act: 'sit' };
    this.nut.name = 'acorn-in-mouth';
    this.nut.visible = false;
    this.group.add(this.nut);
    this.cone.name = 'pine-cone-in-paws';
    this.cone.visible = false;
    this.group.add(this.cone);
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
      m.geometry.computeBoundingBox();
      geoBox = m.geometry.boundingBox!.clone();
      // (its body without the bushy tail: the tail sits behind its root, −z in the mesh)
      const tailFrom = geoBox.min.z + (geoBox.max.z - geoBox.min.z) * 0.36;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i += step) {
        v.fromBufferAttribute(pos, i);
        const g = v.clone().applyMatrix4(toGroup);
        this.hull.push(g);
        if (v.z >= tailFrom) this.torso.push(g);
      }
      this.bendTail(m, geoBox);
      // a touch of warm light in its fur (the low sun catching it), so the small red
      // squirrel reads against the dark bark and the brown forest floor
      for (const mat of [m.material].flat() as THREE.MeshStandardMaterial[]) {
        if (!mat.isMeshStandardMaterial) continue;
        mat.emissive.set('#ff9a4a');
        mat.emissiveIntensity = this.warmth;
      }
    });
    // the acorn goes in its mouth: just under its nose (the most forward point of its
    // head), held crosswise in front of the fur; while it eats, a little lower, in its paws
    if (this.hull.length) {
      const top = this.hull.reduce((m, h) => Math.max(m, h.y), -Infinity);
      const head = this.hull.filter((h) => h.y > top * 0.72);
      const snout = head.reduce((a, h) => (h.z > a.z ? h : a), head[0]);
      const frontAt = (y: number): number => this.hull.filter((h) => Math.abs(h.y - y) < top * 0.06).reduce((m, h) => Math.max(m, h.z), snout.z - 0.02);
      const mouthY = snout.y - top * 0.06, pawsY = snout.y - top * 0.12;
      this.mouth.set(0, mouthY, frontAt(mouthY) + 0.012);
      this.paws.set(0, pawsY, frontAt(pawsY) + 0.014);
      this.nut.position.copy(this.mouth);
      this.nut.rotation.set(0, Math.PI / 2, 0);
    }
  }

  /** Run 7 (additive): THIS play's squirrel — its dash bursts, its stops, its life round
   *  its tree and its breath drawn from `seed` (a play's own fork) instead of the one
   *  squirrel every load (`opts.seed`): another play, another squirrel's day. */
  reseed(seed: number): void {
    this.rnd = sqStream(seed >>> 0);
    this.breathPhase = ((seed >>> 0) % 997) * 1.3;
  }

  /** It carries an acorn in its mouth (on) or not (off). */
  carry(on: boolean): void {
    this.carrying = on;
    this.nut.scale.setScalar(1);
    this.nut.position.copy(this.mouth);
    this.nut.visible = on;
  }

  /** Does it carry one now? */
  get carries(): boolean { return this.carrying; }

  /** The tail bends back and up about its root in the vertex shader: a flick. */
  private bendTail(m: THREE.Mesh, box: THREE.Box3): void {
    const size = box.getSize(new THREE.Vector3());
    // the mesh sits up facing +z, its bushy tail behind (−z), rooted low at its back
    const hingeZ = box.min.z + size.z * 0.36;
    const hingeY = box.min.y + size.y * 0.22;
    const span = size.z * 0.3;
    for (const mat of [m.material].flat() as THREE.MeshStandardMaterial[]) {
      // (the world's own animal light comes first: AnimalDress gave every animal material
      // its hooks — the mood's animal fill on the side away from the sun — and the tail's
      // bend and the rim go on top of them, never instead of them)
      const prev = mat.onBeforeCompile;
      const prevKey = mat.customProgramCacheKey();
      mat.onBeforeCompile = (shader, renderer) => {
        prev.call(mat, shader, renderer);
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
        // the rim: a warm light on the edge of its outline, where the fur turns away from
        // the lens (its own colours inside stay as they are)
        shader.uniforms.uRim = this.rim;
        shader.fragmentShader = 'uniform float uRim;\n' + shader.fragmentShader.replace('#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\n{ float sqEdge = 1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0);\n' +
          '  totalEmissiveRadiance += vec3(1.0, 0.72, 0.38) * (uRim * 0.9 * pow(sqEdge, 2.0)); }');
      };
      mat.customProgramCacheKey = () => `${prevKey}|squirrel-tail-rim`;
      mat.needsUpdate = true;
    }
  }

  /* ------------------------------------------------------------ what it does ---- */

  /** Where it is right now: where its last plan left it, or — in the middle of a plan
   *  (another one took over) — worked out from where its body is. */
  private get where(): Perch {
    return this.plan.length ? inferPerch(this.pose, this.trees, this.stumps) : this.settled;
  }

  /** Where it is now (its feet, its turn). */
  get now(): SqPose { return { ...this.pose }; }

  /** A dozen points on its body (its head and trunk, not its tail), in the world, as it is
   *  drawn now: what the player sees of it (how much of it a trunk hides). Empty until its
   *  mesh is in. */
  bodyPoints(n = 12): THREE.Vector3[] {
    const from = this.torso.length ? this.torso : this.hull;
    if (!from.length) return [];
    while (this.probe.length < Math.min(n, from.length)) this.probe.push(new THREE.Vector3());
    this.group.updateWorldMatrix(true, false);
    const step = from.length / this.probe.length;
    this.probe.forEach((p, i) => p.copy(from[Math.floor(i * step)]).applyMatrix4(this.group.matrixWorld));
    return this.probe;
  }
  private readonly probe: THREE.Vector3[] = [];
  /** the hull's points on its head and body (not the tail) */
  private readonly torso: THREE.Vector3[] = [];

  /** On a trunk or branch right now? */
  get up(): boolean { const w = this.where; return w.kind === 'trunk' || w.kind === 'branch'; }

  /** The tree it is on (or null on the ground). */
  get onTree(): SquirrelTree | null {
    const w = this.where;
    return w.kind === 'trunk' || w.kind === 'branch' ? w.tree : null;
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
  /** One quick dash to (x, z) on the ground. Run 7 (additive): `full` — at its full run
   *  (`SQ.run`, never faster), for a show that keeps a child's pace (the squirrel's visits
   *  to its caching spots, its sweep between two mouthfuls). */
  goDash(x: number, z: number, full = false): Promise<boolean> {
    const plan = this.dashDirect(x, z);
    if (full) for (const g of plan) if (g.act === 'run' && g.len > 0) g.dur = Math.max(SQ.minBurst, g.len / SQ.run);
    return this.run(plan, { kind: 'ground' });
  }
  /** Up a trunk to `at`, clinging there. */
  goTrunk(tree: SquirrelTree, at: OnTrunk): Promise<boolean> {
    return this.run(this.toTrunkPlan(tree, at), { kind: 'trunk', tree, at });
  }
  /** Round its trunk to `at` (from its branch or the bark of that tree): a quick scurry
   *  round the bark at about the same height — hiding on the far side of the tree from
   *  someone, as red squirrels do. From anywhere else: up the trunk to `at`. */
  goRound(tree: SquirrelTree, at: OnTrunk, secs?: number, turns = 0, headUp = true): Promise<boolean> {
    const w = this.where;
    if ((w.kind !== 'branch' && w.kind !== 'trunk') || w.tree !== tree) return this.goTrunk(tree, at);
    const plan: Segment[] = [];
    let from: OnTrunk;
    if (w.kind === 'branch') { plan.push(this.offBranch(tree)); from = { ang: tree.branch.ang, h: tree.branch.h - 0.12 }; }
    else from = w.at;
    // (`secs`: a calm slip round, no quicker than that — hide-and-seek keeps his pace;
    // run 7, additive: `turns` whole times round the trunk on the way (two squirrels chasing
    // round a pine), and `headUp` false: it stays head down where it stops, as it came)
    plan.push(...climbPlan(tree.trunk, from, at, turns * 2, secs));
    plan.push(hold(trunkPose(tree.trunk, at, headUp, 'cling'), 0.1, 'cling'));
    return this.run(plan, { kind: 'trunk', tree, at });
  }

  /** Run 7 (additive): put it at once on the bark of `tree` at `at`, head up or down — a
   *  visitor laid where he cannot see it, before it comes. */
  placeOnTrunk(tree: SquirrelTree, at: OnTrunk, headUp = true): void {
    this.life = null;
    this.watching = null;
    this.pose = trunkPose(tree.trunk, at, headUp, 'cling');
    this.settled = { kind: 'trunk', tree, at };
    this.plan = [];
    this.planDone?.(false);
    this.planDone = null;
    this.x = this.pose.x; this.z = this.pose.z; this.yaw = this.pose.yaw;
    this.apply();
  }

  /** Run 7 (additive): a short calm move straight to pose `p` in `secs` (into its nest, out
   *  onto the nest's crown), and it stays there. */
  moveTo(p: SqPose, secs: number): Promise<boolean> {
    const a = { ...this.pose };
    // (on its way it is seated by its feet, as on the ground: a climb would press its belly
    // to a bark that is not there)
    const act = p.act === 'cling' ? 'climb' : 'run';
    const seg: Segment = {
      dur: Math.max(0.1, secs), len: Math.hypot(p.x - a.x, p.z - a.z, p.alt - a.alt), act,
      at: (u) => {
        const e = u * u * (3 - 2 * u);
        return { x: a.x + (p.x - a.x) * e, z: a.z + (p.z - a.z) * e, alt: a.alt + (p.alt - a.alt) * e, yaw: a.yaw + wrap(p.yaw - a.yaw) * e,
          pitch: a.pitch + (p.pitch - a.pitch) * e, roll: e < 0.5 ? a.roll : p.roll, act: u < 1 ? act : p.act };
      },
    };
    return this.run([seg, hold(p, 0.1, p.act)]);
  }

  /** Back off its branch onto the bark under it, head down (the first move down). */
  private offBranch(tree: SquirrelTree): Segment {
    const b = tree.branch;
    const s = this.pose;
    const on = trunkPose(tree.trunk, { ang: b.ang, h: b.h - 0.12 }, false, 'climb');
    return { dur: 0.3, len: 0.4, act: 'climb', at: (u) => {
      const e = u * u * (3 - 2 * u);
      return { x: s.x + (on.x - s.x) * e, z: s.z + (on.z - s.z) * e, alt: s.alt + (on.alt - s.alt) * e, yaw: s.yaw + wrap(on.yaw - s.yaw) * e, pitch: on.pitch * e, roll: e > 0.5 ? Math.PI : 0, act: 'climb' };
    } };
  }

  /** A small turn where it is (on a stump, a branch, the ground): it keeps its perch. */
  look(yaw: number, hold1 = 0.5): Promise<boolean> {
    const p = this.pose;
    return this.run([turn(p, yaw), hold({ ...p, yaw }, hold1, p.act === 'cling' ? 'cling' : 'sit')], this.where);
  }
  private perchAfter: Perch | null = null;

  /** The warm rim round its outline on (it waits for him: easy to spot) or off. */
  glow(on: boolean): void { this.rimTo = on ? 1 : 0; }

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

  /** Sit up and eat an acorn held in its paws for `secs`: it gets smaller bite by bite. */
  async eat(secs: number): Promise<boolean> {
    this.carry(true);
    this.nut.position.copy(this.paws);
    this.eatFrom = this.t;
    this.eatFor = secs;
    const ok = await this.run([hold({ ...this.pose, pitch: 0, roll: 0, act: 'eat' }, secs, 'eat')], this.where);
    this.eatFrom = -9;
    this.carry(false);
    return ok;
  }

  /**
   * Run 7 (ek-day, additive): one of its antics where it sits (design §6.8: squirrel-math
   * `anticPlan`) — it looks round, grooms its tail, nibbles a pine cone (the cone in its paws,
   * stripped smaller, its scales falling through `onScale`), lies flat in the sun along its
   * branch (`along`: the way the stub points), or scolds — and sits up facing `face` again.
   * Resolves true once played out, false when something else took over.
   */
  async antic(kind: AnticKind, face: number, opts: { along?: number } = {}): Promise<boolean> {
    const plan = anticPlan(kind, this.pose, face, opts);
    if (kind === 'knabbelen') {
      this.carry(false);
      this.cone.visible = true;
      this.cone.scale.setScalar(1);
      // (held crosswise in its paws under its chin, like a cob: its face shows above it)
      this.cone.position.copy(this.paws).add(CONE_HELD);
      this.cone.rotation.set(0, 0, 1.25);
      this.coneFrom = this.t;
      this.coneFor = planTime(plan);
    }
    const ok = await this.run(plan, this.where);
    this.coneFrom = -9;
    this.cone.visible = false;
    return ok;
  }

  /** Run 7 (ek-day): from an antic he cut short, calmly back to sitting up facing `face` on
   *  its perch (on a branch: its seat's height). */
  settleTo(face: number, secs = 0.3): Promise<boolean> {
    const w = this.where;
    const alt = w.kind === 'branch' ? w.tree.branch.h : w.kind === 'stump' ? w.top : this.pose.alt;
    this.coneFrom = -9;
    this.cone.visible = false;
    return this.run(settlePlan(this.pose, face, secs, this.tailHold, alt), w);
  }

  /** Put it at (x, z) at once — on its branch when (x, z) is one of its trees (the world
   *  being built, a reload, a replay under the briefing card). In front of the player its
   *  home calls `go` instead (it runs there: see `homeReach`). */
  override place(x: number, z: number, yaw = this.yaw): void {
    this.carry(false); // (a home laid out anew: whatever it carried is put away)
    this.eatFrom = -9;
    const tree = this.treeAt(x, z);
    if (tree) { this.placeOnBranch(tree); return; }
    this.pose = { x, z, alt: 0, yaw, pitch: 0, roll: 0, act: 'sit' };
    this.settled = { kind: 'ground' };
    this.plan = [];
    this.planDone?.(false);
    this.planDone = null;
    this.x = x; this.z = z; this.yaw = yaw;
    this.apply();
  }

  /** One of its trees, when (x, z) is its trunk (within 0.6 m). */
  private treeAt(x: number, z: number): SquirrelTree | null {
    const tree = this.nearestTree(x, z);
    return tree && Math.hypot(tree.trunk.x - x, tree.trunk.z - z) < 0.6 ? tree : null;
  }

  /** Put it on its branch of `tree` at once (a home laid out: it sits there). */
  placeOnBranch(tree: SquirrelTree, face?: number): void {
    this.pose = this.branchPose(tree, face);
    this.settled = { kind: 'branch', tree };
    this.plan = [];
    this.x = this.pose.x; this.z = this.pose.z; this.yaw = this.pose.yaw;
    this.apply();
  }

  /** Sit up where it is. */
  override idle(): void {
    this.life = null;
    this.watching = null;
    void this.play([hold({ ...this.pose, act: this.up ? this.pose.act : 'sit' }, 0.1)], this.where);
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
    // to one of its trees: it runs up to its branch there (its home going home)
    const tree = this.treeAt(x, z);
    if (tree) return this.run(this.toBranchPlan(tree), { kind: 'branch', tree });
    if (this.up && Math.hypot(x - this.x, z - this.z) < 2.5) return this.play([turn(this.pose, Math.atan2(x - this.x, z - this.z))], this.where);
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
    return this.play(plan, tree ? { kind: 'branch', tree } : this.where).then((ok) => {
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
    const w = this.where;
    const onIt = w.kind === 'branch' && w.tree === tree;
    if (onIt) return face === undefined ? [] : [turn(this.pose, face)];
    const plan: Segment[] = [];
    // the bark just under the branch's root, on its side
    const under: OnTrunk = { ang: b.ang, h: b.h - 0.12 };
    if ((w.kind === 'trunk' || w.kind === 'branch') && w.tree === tree) {
      const at = w.kind === 'trunk' ? w.at : { ang: b.ang, h: b.h };
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
    if (this.where.kind !== 'branch') { plan.push(...this.toBranchPlan(from)); a = poseAtEnd(plan, a); }
    // it turns on the branch to face the next tree, then leaps to its bark, a little lower
    const toward = Math.atan2(to.trunk.x - a.x, to.trunk.z - a.z);
    plan.push(turn(a, toward));
    const landAng = Math.atan2(a.x - to.trunk.x, a.z - to.trunk.z); // the side facing it
    const land = trunkPose(to.trunk, { ang: landAng, h: Math.max(0.8, to.branch.h - 0.45) }, true, 'climb');
    plan.push(...leapPlan({ ...a, yaw: toward, pitch: 0.4 }, land));
    plan.push(hold(land, 0.18, 'cling'));
    // round and up to its branch
    plan.push(...climbPlan(to.trunk, { ang: landAng, h: land.alt }, { ang: to.branch.ang, h: to.branch.h - 0.12 }, 0));
    plan.push(...this.ontoBranch(to, face));
    return plan;
  }

  private ontoBranchFrom(tree: SquirrelTree): Segment[] { return this.ontoBranch(tree); }

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

  /** Down off its tree to the ground at the trunk's foot (nothing when it is on the ground).
   *  `side`: straight down the bark on that side (a heading from the trunk's axis) — where
   *  he sees it — instead of a little spiral round. */
  downPlan(side?: number): Segment[] {
    const p = this.where;
    if (p.kind === 'ground') return [];
    if (p.kind === 'stump') {
      const out = { x: p.x + Math.sin(this.pose.yaw) * 0.45, z: p.z + Math.cos(this.pose.yaw) * 0.45 };
      const a = this.pose;
      return [{ dur: 0.34, len: 0.5, act: 'leap', at: (u) => ({ ...a, x: a.x + (out.x - a.x) * u, z: a.z + (out.z - a.z) * u, alt: a.alt * (1 - u) + Math.sin(u * Math.PI) * 0.12, pitch: 0.7, act: 'leap' }) }];
    }
    const tree = p.tree;
    const at: OnTrunk = p.kind === 'trunk' ? p.at : { ang: tree.branch.ang, h: tree.branch.h - 0.12 };
    const plan: Segment[] = [];
    if (p.kind === 'branch') plan.push(this.offBranch(tree)); // back off the branch onto the bark, head down
    // head first down the bark, round toward where it goes next (a little spiral)
    const downAng = side ?? at.ang + (this.rnd() < 0.5 ? -1 : 1) * (0.6 + this.rnd() * 0.8);
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

  /** Dash (on the ground) to (x, z), down off its tree first (on `side` of the trunk, when
   *  given); `lens` bends it round. */
  dashTo(x: number, z: number, face?: number, side?: number): Segment[] {
    const plan = [...this.downPlan(side)];
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
    const here = this.where;
    if (here.kind === 'branch' && here.tree === tree) {
      // its day round the tree: sit and look, a run down and round the trunk and back up,
      // sit again, down to forage at the tree's foot
      const what = this.lifeStep % 4;
      if (what === 0 || what === 2) {
        // sit a while, looking round now and then
        const p = this.pose;
        plan.push(hold(p, 1.2 + r * 1.6, 'sit'), turn(p, tree.branch.ang + (this.rnd() - 0.5) * 1.6), hold({ ...p, act: 'sit' }, 0.8 + this.rnd() * 1.4, 'sit'));
        perch = here;
      } else if (what === 1) {
        // a run down the bark and round the trunk, a pause head-down, and back up round it
        const b = tree.branch;
        const under = { ang: b.ang, h: b.h - 0.12 };
        const s0 = this.pose;
        const on = trunkPose(tree.trunk, under, false, 'climb');
        plan.push({ dur: 0.3, len: 0.4, act: 'climb', at: (u) => {
          const e = u * u * (3 - 2 * u);
          return { x: s0.x + (on.x - s0.x) * e, z: s0.z + (on.z - s0.z) * e, alt: s0.alt + (on.alt - s0.alt) * e, yaw: s0.yaw + wrap(on.yaw - s0.yaw) * e, pitch: on.pitch * e, roll: e > 0.5 ? Math.PI : 0, act: 'climb' };
        } });
        const low = { ang: b.ang + (this.rnd() < 0.5 ? -1 : 1) * (1.6 + this.rnd() * 1.2), h: 0.55 + this.rnd() * 0.3 };
        plan.push(...climbPlan(tree.trunk, under, low, 0));
        plan.push(hold(trunkPose(tree.trunk, low, false, 'cling'), 0.7 + this.rnd() * 0.8, 'cling'));
        const turnUp = trunkPose(tree.trunk, low, true, 'cling');
        plan.push({ dur: 0.22, len: 0, act: 'cling', at: (u) => ({ ...turnUp, roll: Math.PI * (1 - u) }) });
        plan.push(...climbPlan(tree.trunk, low, under, 1));
        plan.push(...this.ontoBranchFrom(tree));
        perch = here;
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
        if (this.perchAfter) { this.settled = this.perchAfter; this.perchAfter = null; }
        else this.settled = inferPerch(this.pose, this.trees, this.stumps);
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
        if (this.pose.act === 'sit' && Math.abs(wrap(face - this.pose.yaw)) > 0.5) void this.play([turn(this.pose, face)], this.where);
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
    // the acorn it eats gets smaller, a bite at a time (a cut under reduced motion: whole)
    if (this.eatFrom > -9 && this.carrying) {
      const u = Math.min(1, (this.t - this.eatFrom) / Math.max(0.1, this.eatFor));
      this.nut.scale.setScalar(reduced ? 1 : 1 - 0.65 * Math.floor(u * 5) / 5);
    }
    // the pine cone it nibbles: stripped a little thinner bite by bite, its scales falling
    // from its paws (run 7, an antic)
    if (this.coneFrom > -9 && this.cone.visible) {
      const u = Math.min(1, (this.t - this.coneFrom) / Math.max(0.1, this.coneFor));
      const k = reduced ? 1 : 1 - 0.45 * Math.floor(u * 6) / 6;
      this.cone.scale.set(k, 1 - 0.15 * (1 - k), k);
      if (!reduced && this.pose.act === 'eat' && this.onScale && this.t >= this.scaleAt) {
        this.scaleAt = this.t + 0.2;
        this.group.updateWorldMatrix(true, false);
        V.copy(this.paws).add(CONE_HELD).applyMatrix4(this.group.matrixWorld);
        this.onScale(V.x, V.y, V.z);
      }
    }
    // the rim eases on and off (a cut under reduced motion)
    this.rim.value = reduced ? this.rimTo : this.rim.value + (this.rimTo - this.rim.value) * Math.min(1, dt * 3);
    // the tail: a flick lifts it and lets it fall (still under reduced motion); run 7: an
    // antic holds it bent (grooming it, stretched out in the sun), eased in and out
    const want = this.plan.length ? tailAt(this.plan, Math.min(this.planT, planTime(this.plan))) : 0;
    this.tailHold = reduced ? 0 : this.tailHold + (want - this.tailHold) * Math.min(1, dt * 9);
    this.tail.value = reduced ? 0 : flick(this.t - this.flickAt) * 0.55 + (this.pose.act === 'run' || this.pose.act === 'leap' ? -0.18 : 0) + this.tailHold;
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

  override dispose(): void {
    this.nut.geometry.dispose();
    (this.nut.material as THREE.Material).dispose();
    this.cone.geometry.dispose();
    (this.cone.material as THREE.Material).dispose();
    super.dispose();
  }

  override get doing(): string { return this.plan.length ? this.pose.act : this.life ? 'life' : this.watching ? 'watch' : 'sit'; }

  override get detail(): string {
    const p = this.pose;
    return `act=${p.act} alt=${p.alt.toFixed(2)} perch=${this.where.kind} plan=${this.plan.length} t=${this.planT.toFixed(1)}/${planTime(this.plan).toFixed(1)}`;
  }
}

/**
 * Run 7 (ek-day): a Scots pine cone, small and procedural (one geometry, vertex colours: one
 * draw call wherever it is): an egg of scales, rows of darker and lighter brown, ~9 cm long
 * (a little generous, like the acorn, so a child sees it in a squirrel's paws or dropping
 * from a pine), its middle at the origin, standing along +y.
 */
export const PINE_CONE_LEN = 0.09;
export function pineConeGeometry(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(0.5, 8, 9).toNonIndexed();
  const p = g.attributes.position as THREE.BufferAttribute;
  const c = new Float32Array(p.count * 3);
  const col = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    // an egg: fuller below its middle, a blunt tip; the scales' rows as bands of colour
    const k = 0.62 * (1 - 0.18 * y) * (1 + 0.06 * Math.cos(Math.atan2(p.getZ(i), p.getX(i)) * 8));
    p.setXYZ(i, p.getX(i) * k, y, p.getZ(i) * k);
    col.set(Math.floor((y + 0.5) * 7) % 2 ? '#a0703f' : '#7a4c2a');
    c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  g.scale(PINE_CONE_LEN, PINE_CONE_LEN, PINE_CONE_LEN);
  return g;
}
export function pineConeMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true, emissive: '#2a170a', emissiveIntensity: 0.5 });
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

/** Where a body in pose `p` is: on the ground, on a stump, on a tree's branch or its
 *  bark (in the middle of a leap it counts as the ground it will land on). */
function inferPerch(p: SqPose, trees: readonly SquirrelTree[], stumps: readonly { x: number; z: number; top: number; r: number }[] = []): Perch {
  if (p.alt < 0.05) return { kind: 'ground' };
  for (const s of stumps) {
    if (Math.hypot(p.x - s.x, p.z - s.z) < s.r + 0.1 && Math.abs(p.alt - s.top) < 0.15) return { kind: 'stump', top: s.top, x: s.x, z: s.z };
  }
  for (const tree of trees) {
    const b = tree.branch;
    const r = barkRadius(tree.trunk, b.h) + b.out;
    const bx = tree.trunk.x + Math.sin(b.ang) * r, bz = tree.trunk.z + Math.cos(b.ang) * r;
    if (Math.hypot(p.x - bx, p.z - bz) < 0.2 && Math.abs(p.alt - b.h) < 0.2) return { kind: 'branch', tree };
    const d = Math.hypot(p.x - tree.trunk.x, p.z - tree.trunk.z);
    if (d < barkRadius(tree.trunk, p.alt) + 0.5) {
      return { kind: 'trunk', tree, at: { ang: Math.atan2(p.x - tree.trunk.x, p.z - tree.trunk.z), h: p.alt } };
    }
  }
  return { kind: 'ground' };
}

export { SQ };
