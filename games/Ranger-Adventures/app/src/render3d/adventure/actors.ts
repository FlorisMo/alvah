/**
 * actors.ts — the animals of an adventure, alive in the world (design §3.5).
 *
 * An `Actor` wraps one of the world's own animal models (`spawnModel`: the same GLB,
 * eyes, coat and calm pose as everywhere else) and gives it calm behaviours a script
 * can ask for: root about its spot, go somewhere, follow the ranger, look at
 * something, sniff, lie down in cover, get up. Every behaviour replaces the one
 * before it; the promise of the one it replaced resolves `false`.
 *
 * It stands per frame on the rendered ground (`groundY`), faces where it goes (the
 * turn is rate-limited, it never strafes), slides round the world's solids like the
 * ranger does (`resolveMove`), and — the boar and the piglet are static meshes —
 * trots with a procedural bob and roll scaled by its pace; at rest it breathes.
 * Under reduced motion the secondary motion (the bob, the rooting dip, the breath)
 * holds still; walking somewhere still walks.
 *
 * The pure parts (steering, the follow gap, the trot) live in actors-math.ts.
 */

import * as THREE from 'three';
import type { Spawned, SpawnOpts } from '../play/types';
import { lieDown, LEG_SHARE } from '../play/pose';
import { contactShadow } from '../play/kit';
import { resolveMove, type MoveLimits, type Obstacle } from '../CharacterController';
import { gaitFor, motionAt, REST } from '../ProceduralMotion';
import { modelFor } from '../play/spawn';
import {
  stepToward, followSpot, followSpeed, trot, strideOf, rootDip, turnToward, wrap, type Pose,
} from './actors-math';

/** What an actor needs from the world. */
export interface ActorEnv {
  /** where its model hangs (the scene, or a home's group) */
  parent: THREE.Object3D;
  groundY(x: number, z: number): number;
  spawnModel(id: string, opts?: SpawnOpts): Promise<Spawned | null>;
  /** the world's solids (trunks, props, buildings): it walks round them */
  obstacles: readonly Obstacle[];
  limits: MoveLimits;
  /** reduced motion right now (read live) */
  reduced(): boolean;
}

/** A point it follows or looks at, read live every frame. */
export type Lead = () => { x: number; z: number; speed: number };

type Task =
  | { kind: 'idle' }
  | { kind: 'root'; cx: number; cz: number; roam: number; goal: { x: number; z: number } | null; wait: number }
  | { kind: 'go'; x: number; z: number; speed: number; face: number | null; done: (ok: boolean) => void; best: number; stall: number }
  | { kind: 'follow'; lead: Lead; gap: number; max: number; wait: number; sniffing: number }
  | { kind: 'look'; lead: Lead; until: number; done: ((ok: boolean) => void) | null }
  | { kind: 'sniff'; x: number; z: number; until: number; reach: number; done: (ok: boolean) => void };

/** Speeds (m/s) per kind of animal: a calm walk and a trot. */
const PACE: Record<string, { walk: number; trot: number; turn: number }> = {
  frisling: { walk: 0.7, trot: 2.4, turn: 4.5 },
  overloper: { walk: 0.6, trot: 1.6, turn: 3 },
  wildzwijn: { walk: 0.5, trot: 1.0, turn: 2.2 },
};
const PACE_DEFAULT = { walk: 0.6, trot: 1.2, turn: 3 };

let nextPhase = 0.7;

export class Actor {
  readonly key: string;
  readonly animal: string;
  /** the actor in the world: position + facing (its model hangs below) */
  readonly group = new THREE.Group();
  readonly height: number;
  x = 0;
  z = 0;
  yaw = 0;
  /** ground speed this frame (m/s) */
  speed = 0;
  /** loaded (its model stands in the world) */
  readonly ready: Promise<void>;
  protected readonly env: ActorEnv;
  private readonly pace: { walk: number; trot: number; turn: number };
  protected readonly gaitNode = new THREE.Group();   // the trot bob/roll + the rooting dip
  protected readonly pivot = new THREE.Group();      // pitch pivot at the hind feet
  private stand: Spawned | null = null;
  private lying: Spawned | null = null;
  private lyingJob: Promise<void> | null = null;
  private freeLie: (() => void) | null = null;
  private isLying = false;
  private task: Task = { kind: 'idle' };
  private phase = 0;          // stride phase (rad)
  private clock = 0;
  private readonly seed = (nextPhase = (nextPhase * 7.13) % 6.28);
  private dip = 0;            // 0..1 head down (rooting, sniffing)
  private dipWant = 0;
  private headUp = 0;         // 0..1 alert: head up (looking at something)
  private readonly recipe;
  private disposed = false;
  protected readonly shadow: THREE.Mesh;
  private readonly len: number;

  constructor(key: string, animal: string, env: ActorEnv, opts: { height: number; len?: number }) {
    this.key = key;
    this.animal = animal;
    this.env = env;
    this.height = opts.height;
    this.len = opts.len ?? opts.height * 1.7;
    this.pace = PACE[animal] ?? PACE_DEFAULT;
    this.recipe = gaitFor(modelFor(animal));
    this.group.name = `actor-${key}`;
    this.pivot.position.z = -this.len * 0.45;
    this.gaitNode.position.z = this.len * 0.45;
    this.pivot.add(this.gaitNode);
    this.group.add(this.pivot);
    this.shadow = contactShadow(Math.max(0.16, this.len * 0.42));
    this.shadow.position.y = 0.02;
    this.shadow.scale.set(0.75, 1, 1); // a longish pool under a long body
    this.group.add(this.shadow);
    env.parent.add(this.group);
    this.ready = this.load();
  }

  private async load(): Promise<void> {
    const s = await this.env.spawnModel(this.animal, { height: this.height, idle: true });
    if (!s || this.disposed) { s?.dispose(); return; }
    this.stand = s;
    const root = s.root as THREE.Object3D;
    root.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = false; });
    this.gaitNode.add(root);
    root.visible = !this.isLying;
    if (this.isLying) await this.loadLying();
  }

  /** The lying version of its model (legs folded under, play/pose.lieDown), made once. */
  private loadLying(): Promise<void> {
    this.lyingJob ??= (async () => {
      const share = LEG_SHARE[this.animal];
      if (share === undefined) return;
      const s = await this.env.spawnModel(this.animal, { height: this.height, idle: false });
      if (!s || this.disposed) { s?.dispose(); return; }
      const root = s.root as THREE.Object3D;
      this.freeLie = lieDown(root, share);
      root.visible = this.isLying;
      this.gaitNode.add(root);
      this.lying = s;
    })();
    return this.lyingJob;
  }

  /** Stand it at (x, z) facing `yaw`, at once. */
  place(x: number, z: number, yaw = this.yaw): void {
    this.x = x; this.z = z; this.yaw = yaw;
    this.seat();
  }

  /** Is it lying down? */
  get lies(): boolean { return this.isLying; }

  /** Lie down (legs folded under, flat in the cover) or get up. Resolves once shown. */
  async lie(on: boolean): Promise<void> {
    this.isLying = on;
    if (on) await this.loadLying();
    this.showBody();
  }

  private showBody(): void {
    const lyingShown = this.isLying && !!this.lying;
    if (this.stand) (this.stand.root as THREE.Object3D).visible = !lyingShown;
    if (this.lying) (this.lying.root as THREE.Object3D).visible = lyingShown;
  }

  /** The object a player sees (for picking, a hint, a glow): the body shown now. */
  get body(): THREE.Object3D | null {
    const s = this.isLying && this.lying ? this.lying : this.stand;
    return (s?.root as THREE.Object3D | undefined) ?? null;
  }

  /* ----------------------------------------------------------- behaviours ---- */

  private replace(t: Task): void {
    const old = this.task;
    this.task = t;
    if (old !== t && 'done' in old && old.done) old.done(false);
  }

  /** Stand still (breathing). */
  idle(): void { this.replace({ kind: 'idle' }); }

  /** Root about (cx, cz): head down, a slow shuffle to a nearby spot now and then. */
  root(cx = this.x, cz = this.z, roam = 0.5): void {
    this.replace({ kind: 'root', cx, cz, roam, goal: null, wait: 0.5 + ((this.seed * 3) % 2) });
  }

  /** Walk (or trot, `speed` 'trot') to (x, z); then face `face` (a heading) if given.
   *  Resolves true on arrival, false when another behaviour took over. */
  go(x: number, z: number, opts: { speed?: 'walk' | 'trot' | number; face?: number } = {}): Promise<boolean> {
    const speed = typeof opts.speed === 'number' ? opts.speed : opts.speed === 'trot' ? this.pace.trot : this.pace.walk;
    if (this.isLying) void this.lie(false);
    return new Promise((done) => this.replace({ kind: 'go', x, z, speed, face: opts.face ?? null, done, best: Infinity, stall: 0 }));
  }

  /** Follow `lead` at `gap` m, at up to `max` m/s (default: its trot). Snuffles about
   *  while the leader stands still. */
  follow(lead: Lead, gap: number, max = this.pace.trot): void {
    if (this.isLying) void this.lie(false);
    this.replace({ kind: 'follow', lead, gap, max, wait: 0, sniffing: 0 });
  }

  /** Turn to look at `lead` (head up) for `secs` (Infinity: until told otherwise). */
  lookAt(lead: Lead, secs = Infinity): Promise<boolean> {
    return new Promise((done) => this.replace({ kind: 'look', lead, until: this.clock + secs, done }));
  }

  /** Nose to (x, z) for `secs`: it comes up to within `reach` m of it (its snout just
   *  there by default; further off for a bag it must not bump into) and sniffs. */
  sniff(x: number, z: number, secs = 1.4, reach = this.len * 0.6): Promise<boolean> {
    return new Promise((done) => this.replace({ kind: 'sniff', x, z, until: this.clock + secs, reach, done }));
  }

  /** It just called (its voice, a squeak or a chatter): a subclass may move with it. */
  called(): void { /* a static mesh just calls */ }

  /** What it is doing now. */
  get doing(): string { return this.task.kind; }

  /** Dev read: its behaviour's numbers (where to, how stuck). */
  get detail(): string {
    const t = this.task as Record<string, unknown>;
    return Object.entries(t).filter(([, v]) => typeof v !== 'function' && typeof v !== 'object').map(([k, v]) => `${k}=${typeof v === 'number' ? (v as number).toFixed(2) : v}`).join(' ') + ` yaw=${this.yaw.toFixed(2)} clock=${this.clock.toFixed(1)}`;
  }

  /* --------------------------------------------------------------- frame ---- */

  update(dt: number, t: number): void {
    if (this.disposed) return;
    this.clock += dt;
    const reduced = this.env.reduced();
    let speed = 0;
    this.dipWant = 0;
    let alert = 0;
    const task = this.task;
    switch (task.kind) {
      case 'idle':
        break;
      case 'root': {
        if (reduced) { this.dipWant = 0.6; break; } // (holds still, head down)
        if (!task.goal) {
          this.dipWant = 1;
          task.wait -= dt;
          if (task.wait <= 0) {
            // the next spot: a short shuffle within its roam, never far
            const a = this.seed * 11 + this.clock * 0.37;
            const r = task.roam * (0.35 + 0.65 * ((Math.sin(a * 3.1) + 1) / 2));
            task.goal = { x: task.cx + Math.cos(a) * r, z: task.cz + Math.sin(a) * r };
          }
        } else {
          this.dipWant = 0.5;
          speed = this.move(task.goal.x, task.goal.z, this.pace.walk * 0.45, dt);
          if (Math.hypot(task.goal.x - this.x, task.goal.z - this.z) < 0.08) {
            task.goal = null;
            task.wait = 1.6 + ((Math.sin(this.clock * 1.7 + this.seed) + 1) / 2) * 2.8;
          }
        }
        break;
      }
      case 'go': {
        // (once there it only turns to face: stepping on would turn it back to the spot,
        // and the two turns would hold each other still for ever)
        if (Math.hypot(task.x - this.x, task.z - this.z) >= 0.06) speed = this.move(task.x, task.z, task.speed, dt);
        const left = Math.hypot(task.x - this.x, task.z - this.z);
        // blocked (a log, a trunk between): it gives up calmly where it is
        if (left < task.best - 0.03) { task.best = left; task.stall = 0; } else task.stall += dt;
        if (task.stall > 1.5 && left >= 0.06) { this.task = { kind: 'idle' }; task.done(false); break; }
        if (left < 0.06) {
          if (task.face !== null && Math.abs(wrap(task.face - this.yaw)) > 0.05) {
            this.yaw = turnToward(this.yaw, task.face, this.pace.turn * dt);
          } else {
            this.task = { kind: 'idle' };
            task.done(true);
          }
        }
        break;
      }
      case 'follow': {
        const l = task.lead();
        const spot = followSpot(this, l, task.gap);
        const want = followSpeed(spot.d, task.gap, l.speed, task.max);
        if (want > 0) {
          speed = this.move(spot.x, spot.z, want, dt);
          task.wait = 0;
        } else {
          // he stands: look up at him, then snuffle at the ground now and then
          task.wait += dt;
          const face = Math.atan2(l.x - this.x, l.z - this.z);
          if (task.wait < 1.5) { this.yaw = turnToward(this.yaw, face, this.pace.turn * 0.5 * dt); alert = 1; }
          else this.dipWant = (Math.sin(task.wait * 0.9) > 0.2) ? 0.8 : 0;
        }
        break;
      }
      case 'look': {
        const l = task.lead();
        // (lying down it only lifts its head: it never spins round on its belly)
        if (!this.isLying) this.yaw = turnToward(this.yaw, Math.atan2(l.x - this.x, l.z - this.z), this.pace.turn * 0.6 * dt);
        alert = 1;
        if (this.clock >= task.until) { this.task = { kind: 'idle' }; task.done?.(true); }
        break;
      }
      case 'sniff': {
        const d = Math.hypot(task.x - this.x, task.z - this.z);
        // a spot further off it trots to; close by it walks up with its nose down
        if (d > task.reach) {
          const k = (d - task.reach) / d; // (it stops `reach` short of the spot)
          speed = this.move(this.x + (task.x - this.x) * k, this.z + (task.z - this.z) * k, d - task.reach > 1 ? this.pace.trot * 0.75 : this.pace.walk, dt);
        } else {
          this.dipWant = 1;
          this.yaw = turnToward(this.yaw, Math.atan2(task.x - this.x, task.z - this.z), this.pace.turn * 0.5 * dt);
        }
        if (this.clock >= task.until) { this.task = { kind: 'idle' }; task.done(d <= task.reach + 0.2); }
        break;
      }
    }
    this.speed = speed;
    this.animate(dt, t, speed, alert, reduced);
    this.seat();
    this.stand?.update(dt); // a rigged animal's own clip
  }

  /** One step toward (tx, tz) at `speed`, round the world's solids. Returns the speed. */
  private move(tx: number, tz: number, speed: number, dt: number): number {
    const p: Pose = { x: this.x, z: this.z, yaw: this.yaw };
    const s = stepToward(p, tx, tz, dt, { speed, turnRate: this.pace.turn, ease: Math.max(0.3, this.len * 0.8) });
    const next = resolveMove(this.x, this.z, s.pose.x, s.pose.z, this.env.obstacles, this.env.limits);
    const moved = Math.hypot(next.x - this.x, next.z - this.z);
    this.x = next.x; this.z = next.z; this.yaw = s.pose.yaw;
    return dt > 0 ? moved / dt : 0;
  }

  /** The procedural body motion: the trot, the rooting dip, the alert head, the breath. */
  private animate(dt: number, t: number, speed: number, alert: number, reduced: boolean): void {
    const k = Math.min(1, dt * 4);
    this.dip += ((reduced ? Math.min(this.dipWant, 0.6) : this.dipWant) - this.dip) * k;
    this.headUp += (alert - this.headUp) * k;
    this.phase += (speed * dt / strideOf(this.height)) * Math.PI * 2;
    const g = reduced ? { dy: 0, roll: 0, pitch: 0 } : trot(this.phase, speed, this.height);
    const breath = reduced || speed > 0.05 ? REST : motionAt(this.recipe, t, this.seed);
    const dipNow = this.dip * (reduced ? 1 : 0.75 + 0.25 * rootDip(t, this.seed));
    this.gaitNode.position.y = g.dy + breath.dy;
    this.gaitNode.rotation.set(0, 0, g.roll);
    this.gaitNode.scale.set(1, breath.scaleY, 1);
    // pitch about the hind feet: nose down while rooting / sniffing, up when alert
    // (a rigid body tipping about its hind feet would sink its front feet: the pivot rises
    // by half the front's drop, so neither end leaves the ground by more than ~2.5 cm, and
    // a long body tips less)
    const lf = this.len * 0.9; // hind feet → its front end's lowest point, at most
    const k2 = Math.min(1, Math.asin(Math.min(1, 0.05 / lf)) / 0.13);
    const pitch = g.pitch + (dipNow * 0.13 - this.headUp * 0.05) * k2;
    this.pivot.rotation.x = pitch;
    this.pivot.position.y = (lf * Math.sin(pitch)) / 2;
  }

  private seat(): void {
    this.group.position.set(this.x, this.env.groundY(this.x, this.z), this.z);
    this.group.rotation.y = this.yaw;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const t = this.task;
    this.task = { kind: 'idle' };
    if ('done' in t && t.done) t.done(false);
    this.stand?.dispose();
    this.lying?.dispose();
    this.freeLie?.();
    this.shadow.geometry.dispose();
    (this.shadow.material as THREE.Material).dispose();
    this.group.removeFromParent();
  }
}
