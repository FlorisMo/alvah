/**
 * adventure/kit.ts — the AdventureKit: what a mission's in-world script is written with
 * (design §3.2). A script is an async function over it:
 *
 *   await k.look(places.wallow, k.copy.kijk);             // one calm look at the family
 *   await k.walk({ to: places.coverApproach, line: k.copy.volg, ... });
 *   const found = await searchBeat(k, 0, { ... });         // beats/search.ts (zoeken)
 *   const rust = choiceRun(k, 2);                          // beats/choice.ts (dagnacht)
 *   await rust.ask('aaien', { ... });
 *   ...
 *
 * Every call is ABORTABLE: "Stop de missie" rejects the call the script is waiting on
 * with `Aborted`, so the script unwinds at once and the flow cleans up (`dispose`: the
 * animals go home, the lens comes back, the HUD goes). Every call speaks its line (the
 * HUD reads a new objective aloud once). The kit owns the objective line and chip, the
 * mission mode (who drives the ranger, who holds the lens), framed views, the play
 * hint (golden plays every beat with real keys and clicks through it), a mission clock
 * that stands still while the pause card is up, and the EF logging: each `stappen[i]`
 * is logged exactly once, through the mission flow (`hooks.log`), so the skill record,
 * the badges and the 2D floor stay one system.
 */

import * as THREE from 'three';
import type { Mission, Step } from '../../content/types';
import type { BeatSummary } from '../../core/skill';
import type { RangerMotion, WorldCtx } from '../play/types';
import type { Residents, ResidentGroup } from '../world/Residents';
import type { MissionMode } from '../World';
import { Stage, type StageSpec } from '../play/stage';
import { makeReframe, registerPlayHint, clearPlayHint } from '../play/kit';
import { wayfind } from '../Wayfinding';
import { isRunning, nearestAway } from './actors-math';
import type { Actor } from './actors';
import type { AdventureRead, Place, Places, Spot } from './types';
import { dist, headingTo } from './places';

/** The world as an adventure drives it (World implements it; a test can fake it). */
export interface MissionWorld {
  setMissionMode(m: MissionMode | null): void;
  missionMode(): MissionMode | null;
  walkRangerTo(x: number, z: number, stop?: number): Promise<boolean>;
  stopRanger(): void;
  faceRanger(heading: number): void;
  rangerMotion(): RangerMotion;
  onFrame(fn: (dt: number, t: number) => void): () => void;
  menuShown(): boolean;
  readonly residents: Residents;
  readonly camera: THREE.PerspectiveCamera;
  /** the time of day (1 = the golden hour, 0 = a readable blue night), turned calmly */
  setDaylight(k: number, seconds?: number): void;
  daylight(): number;
  /** a photograph of the world through `cam` (taken inside the next frame, never shown) */
  snapshot(cam: THREE.Camera, w: number, h: number, prepare?: () => (() => void) | void): Promise<HTMLCanvasElement | null>;
}

/** The adventure's HUD (ui/flow/AdventureHud.ts implements it). */
export interface AdventureUi {
  say(text: string | null, opts?: { good?: boolean; queue?: boolean }): void;
  readonly current: string | null;
  setChip(c: { doel: string; cue: string; angle: number | null; arrived?: boolean; glyph?: string } | null): void;
  action(label: string | null): Promise<void>;
  binoculars(on: boolean): void;
  /** time passes: a calm veil over the world with one line (null lifts it) */
  veil(text: string | null): void;
  walking(on: boolean): void;
  /** the binoculars' frame for a LONG watch (a hide): it closes in further than a look's */
  watching(on: boolean): void;
}

/** What the mission flow does for the kit (ui/flow/MissionFlow.ts). */
export interface FlowHooks {
  /** log step `i`'s result (the skill record, the badge) */
  log(i: number, summary: BeatSummary): void;
  /** the raaf tells step `i`'s fact (and it becomes a veldnotitie) */
  fact(i: number): Promise<void>;
  /** the mission is won: the flow marks it done and shows the reunion line while the
   *  world plays `play` (the family together again) */
  reunion(play: () => Promise<void>): Promise<void>;
  /** the pause card is up (the mission clock stands still) */
  paused(): boolean;
}

export interface KitOptions {
  mission: Mission;
  places: Places;
  /** the adventure's words, resolved (knap or simpel, "Klik" or "Tik") */
  copy: Readonly<Record<string, string>>;
  /** the mission's steps as a view gets them (device words, no fact) */
  steps: readonly Step[];
  world: MissionWorld;
  /** the live WorldCtx (world.ctx(host)): the ground, the scene, the canvas, picking */
  ctx: WorldCtx;
  ui: AdventureUi;
  hooks: FlowHooks;
  /** the mission's abort scope ("Stop de missie") */
  signal: AbortSignal;
  /** where a beat's cards mount (a choice card, a found card) */
  host: HTMLElement;
}

/** "Stop de missie" — the script unwinds. */
export class Aborted extends Error {
  constructor() { super('adventure stopped'); this.name = 'Aborted'; }
}

/** A framed view of a world spot (a Stage fit with an anchor, design §3.6). */
export interface FrameSpec {
  at: Spot;
  heading: number;
  halfW: number;
  halfD: number;
  tall?: number;
  pitchDeg?: number;
  insetTop?: number;
  insetBottom?: number;
  /** things that must be in the picture too (the ranger, an animal) */
  include?: readonly { x: number; z: number; h: number }[];
  /** seconds of the eased move (≥ ~90°/s turns: longer for a big turn) */
  seconds?: number;
}

export interface WalkOpts {
  /** a name for the beat ('cover', 'field' ...) */
  name: string;
  to: Place | Spot;
  /** arrive within this (m); default the place's r, else 1.2 */
  r?: number;
  /** the objective line */
  line: string;
  /** the chip: where he goes, in words, and the cue under it before the arrow shows */
  doel: string;
  cue?: string;
  /** the chip's sign before the words (default 👂: a sound to follow; 👣 prints) */
  glyph?: string;
  /** seconds without getting closer before the chip shows the arrow (default 20) */
  arrowAfter?: number;
  /** an animal that follows him (the piglet he leads): it keeps its gap, hides when he
   *  runs (`hide`: the cover it dives into), and the walk waits for it */
  lead?: {
    actor: Actor;
    gap?: number;
    hide?: readonly Spot[];
    runLine?: string;
    backLine?: string;
    waitLine?: string;
    /** called when it hides / comes out (a rustle, a squeak) */
    onHide?: (spot: Spot) => void;
    onOut?: () => void;
  };
  /** extra per-frame work while he walks (a squeak getting louder ...) */
  tick?: (dt: number) => void;
  /** he should walk QUIETLY (away from a calf lying in the grass): running says `line`
   *  (and calls `onRun`) once per run; walking calmly again brings the walk's line back */
  quiet?: { line: string; onRun?: () => void };
}

const WALK_HINT_R = 0.8; // golden walks until it is within this share of r

export class AdventureKit {
  readonly mission: Mission;
  readonly places: Places;
  readonly copy: Readonly<Record<string, string>>;
  readonly steps: readonly Step[];
  readonly world: MissionWorld;
  readonly ctx: WorldCtx;
  readonly ui: AdventureUi;
  readonly signal: AbortSignal;
  readonly host: HTMLElement;
  readonly reduced: boolean;
  /** the beat running now (the dev read, the screenshots) */
  beat = 'start';
  /** numbers a test checks the design's bar against (the dev read) */
  readonly stats: Record<string, number> = {};
  private readonly hooks: FlowHooks;
  private readonly logged: number[] = [];
  private clock = 0;
  private readonly ticks = new Set<(dt: number, t: number) => void>();
  private readonly offs: (() => void)[] = [];
  private readonly abortP: Promise<never>;
  private held: { update: (dt: number) => boolean; settled: boolean } | null = null;
  private group: ResidentGroup | null = null;
  private disposed = false;
  private readonly owned: THREE.Object3D[] = [];
  /** the adventure turned the time of day (the end hands the golden hour back) */
  private dayTurned = false;
  /** a photograph that belongs with the mission's clue (the reward's clue card shows it) */
  cluePhoto: string | null = null;

  constructor(o: KitOptions) {
    this.mission = o.mission;
    this.places = o.places;
    this.copy = o.copy;
    this.steps = o.steps;
    this.world = o.world;
    this.ctx = o.ctx;
    this.ui = o.ui;
    this.hooks = o.hooks;
    this.signal = o.signal;
    this.host = o.host;
    this.reduced = o.ctx.reducedMotion;
    this.abortP = new Promise<never>((_, reject) => {
      if (o.signal.aborted) reject(new Aborted());
      o.signal.addEventListener('abort', () => reject(new Aborted()), { once: true });
    });
    this.abortP.catch(() => {}); // (a stop nobody is waiting on is not an error)
    this.offs.push(o.world.onFrame((dt, t) => this.tick(dt, t)));
  }

  /* ------------------------------------------------------------ lifecycle ---- */

  /** Race a promise against "Stop de missie": rejects with `Aborted` on a stop. */
  guard<T>(p: Promise<T>): Promise<T> {
    if (this.signal.aborted) return Promise.reject(new Aborted());
    return Promise.race([p, this.abortP]);
  }

  /** Throw `Aborted` if the mission was stopped. */
  check(): void {
    if (this.signal.aborted || this.disposed) throw new Aborted();
  }

  private tick(dt: number, t: number): void {
    if (this.disposed) return;
    if (!this.hooks.paused()) this.clock += dt;
    if (this.held) {
      if (this.held.update(dt)) this.held.settled = true;
    }
    for (const fn of [...this.ticks]) fn(dt, this.clock);
    void t;
  }

  /** The mission clock (s): it stands still while the pause card is up. */
  get now(): number { return this.clock; }

  /** Run `fn(dt, now)` every frame until the returned unsubscribe (or the end). */
  onTick(fn: (dt: number, now: number) => void): () => void {
    this.ticks.add(fn);
    return () => { this.ticks.delete(fn); };
  }

  /** Wait `s` seconds of mission time (paused with the pause card). */
  wait(s: number): Promise<void> {
    const until = this.clock + s;
    return this.until(() => this.clock >= until).then(() => {});
  }

  /** Wait until `pred()` holds (checked every frame), or `timeout` s of mission time. */
  until(pred: () => boolean, timeout = Infinity): Promise<boolean> {
    const end = this.clock + timeout;
    return this.guard(new Promise<boolean>((done) => {
      if (pred()) { done(true); return; }
      const off = this.onTick(() => {
        if (pred()) { off(); done(true); } else if (this.clock >= end) { off(); done(false); }
      });
    }));
  }

  /** The step as the mission flow logs it: once each, ever. */
  log(i: number, summary: BeatSummary): void {
    if (this.logged.includes(i)) { console.warn(`[adventure] step ${i} logged twice`); return; }
    this.logged.push(i);
    this.hooks.log(i, summary);
  }

  /** Which steps are logged. */
  get stepsLogged(): readonly number[] { return this.logged; }

  /** The raaf tells step `i`'s fact (a card over the world; the ranger holds still). */
  async fact(i: number): Promise<void> {
    this.beat = `fact:${i}`;
    this.ui.say(null);
    await this.guard(this.hooks.fact(i));
  }

  /** The mission is won: the flow marks it done, and shows its line while `play` plays. */
  async reunion(play: () => Promise<void>): Promise<void> {
    // the EF contract: a mission is done only once every step was played and logged
    const missing = this.steps.map((_, i) => i).filter((i) => !this.logged.includes(i));
    if (missing.length) throw new Error(`[adventure] the reunion came before step(s) ${missing.join(', ')} were played`);
    this.beat = 'reunion';
    this.ui.say(null);
    this.ui.setChip(null);
    await this.guard(this.hooks.reunion(play));
  }

  /** Borrow this mission's home animals (they stop idling on their own). */
  borrow(): ResidentGroup {
    this.group ??= this.world.residents.borrow(this.mission.id);
    if (!this.group) throw new Error(`[adventure] no home for ${this.mission.id}`);
    return this.group;
  }

  /** An object the kit removes when the adventure ends (a trail of prints ...). */
  own<T extends THREE.Object3D>(o: T): T {
    (this.ctx.scene as THREE.Scene).add(o);
    this.owned.push(o);
    return o;
  }

  /** Where the ranger is and how he moves now. */
  ranger(): RangerMotion { return this.world.rangerMotion(); }

  /** Register what a perfect player does now (golden's hint channel); null = watch. */
  hint(fn: () => ReturnType<Parameters<typeof registerPlayHint>[0]>): () => void {
    return registerPlayHint(fn);
  }

  /* ------------------------------------------------------------- the lens ---- */

  /** The pose a framed view would take (no move). A spot to include that is where the
   *  ranger stands (within 1.2 m) is taken where he really stands. */
  lensFor(f: FrameSpec): { cam: THREE.Vector3; look: THREE.Vector3; stage: Stage } {
    const me = this.ranger();
    const include = f.include?.map((q) => (dist(q, me) < 1.2 ? { ...q, x: me.x, z: me.z } : q));
    const spec: StageSpec = {
      halfW: f.halfW, halfD: f.halfD, tall: f.tall ?? 1, pitchDeg: f.pitchDeg ?? 34,
      insetTop: f.insetTop ?? 96, insetBottom: f.insetBottom ?? 16,
      anchor: { x: f.at.x, z: f.at.z, heading: f.heading, include },
    };
    const stage = new Stage(this.ctx, spec);
    return { cam: stage.cam.clone(), look: stage.look.clone(), stage };
  }

  /**
   * Hold the lens on a framed view (one calm eased move there — a cut under reduced
   * motion) with the ranger's input locked: a framed beat. Resolves once the lens has
   * settled. `face`: turn the ranger to look this way first (he stands).
   */
  async frame(f: FrameSpec, opts: { face?: number } = {}): Promise<Stage> {
    this.check();
    const { cam, look, stage } = this.lensFor(f);
    if (opts.face !== undefined) this.world.faceRanger(opts.face);
    this.world.stopRanger();
    // (the trees between the held lens and what it frames fade, as for the follow camera)
    const focus = [{ x: look.x, y: look.y, z: look.z },
      ...(f.include ?? []).map((q) => ({ x: q.x, y: this.ctx.groundY(q.x, q.z) + q.h * 0.75, z: q.z }))];
    this.world.setMissionMode({ missionId: this.mission.id, input: 'locked', camera: 'held', focus });
    this.ui.walking(false);
    this.ui.setChip(null);
    const move = makeReframe(this.world.camera, cam, look, this.reduced, f.seconds ?? 1.4, 0.3);
    this.held = { update: (dt) => move.update(dt), settled: false };
    await this.until(() => !!this.held?.settled);
    return stage;
  }

  /** The lens back to the follow camera (it eases from the held view), the input free. */
  free(): void {
    this.held = null;
    this.world.setMissionMode({ missionId: this.mission.id, input: 'free', camera: 'follow' });
    this.ui.walking(true);
  }

  /** The input locked, the follow camera on (the ranger walks where the kit sends him). */
  lockFollow(): void {
    this.held = null;
    this.world.setMissionMode({ missionId: this.mission.id, input: 'locked', camera: 'follow' });
    this.ui.walking(false);
  }

  /** Walk the ranger to (x, z), stopping `stop` short. His own input is locked first (a
   *  key still held from the walk before must never cancel it); the lens stays as it is. */
  async walkRanger(x: number, z: number, stop = 0.25): Promise<boolean> {
    const m = this.world.missionMode();
    if (!m || m.input !== 'locked') {
      this.world.setMissionMode({ missionId: this.mission.id, input: 'locked', camera: m?.camera ?? 'follow' });
      this.ui.walking(false);
    }
    return this.guard(this.world.walkRangerTo(x, z, stop));
  }

  /**
   * One calm LOOK at a place (design §3.6): the lens glides a little toward it and rises
   * (a soft binocular frame), holds `hold` s (Space or Enter ends it sooner), and glides
   * back to where it was; a cut each way under reduced motion. At most one per mission.
   * `turn`: the ranger turns to face the place while the lens is on it (out of his own
   * sight), and the lens glides back to behind him facing it — he ends up looking where
   * the story goes on, instead of the way he came.
   */
  async look(at: Spot & { y?: number }, line: string, hold = 2.5, opts: { turn?: boolean } = {}): Promise<void> {
    this.check();
    this.beat = 'look';
    this.ui.say(line);
    this.world.stopRanger();
    this.world.setMissionMode({ missionId: this.mission.id, input: 'locked', camera: 'held' });
    this.ui.walking(false);
    const cam = this.world.camera;
    const from = cam.position.clone();
    const fromLook = from.clone().add(cam.getWorldDirection(new THREE.Vector3()).multiplyScalar(6));
    const g = this.ctx.groundY(at.x, at.z);
    const target = new THREE.Vector3(at.x, (at.y ?? g) + 0.45, at.z);
    const toward = target.clone().sub(from).setY(0);
    const d = toward.length();
    // the lens glides toward them until they are ~7 m off (as through binoculars), a
    // little higher to see over the heather, never nearer than it started
    const pos = from.clone().addScaledVector(toward.normalize(), Math.max(0, d - 6.2));
    pos.y = Math.max(from.y + 0.3, this.ctx.groundY(pos.x, pos.z) + 2.4);
    let move = makeReframe(cam, pos, target, this.reduced, 2.2, 0);
    this.held = { update: (dt) => move.update(dt), settled: false };
    this.ui.binoculars(true);
    await this.until(() => !!this.held?.settled);
    let skip = false;
    const onKey = (e: KeyboardEvent): void => { if (e.code === 'Space' || e.code === 'Enter') skip = true; };
    window.addEventListener('keydown', onKey);
    try {
      await this.until(() => skip, hold);
    } finally {
      window.removeEventListener('keydown', onKey);
    }
    this.ui.binoculars(false);
    let back = from, backLook = fromLook;
    if (opts.turn) {
      // the lens's pose behind him, turned round him by as much as he turns to face it
      const me = this.ranger();
      const h = headingTo(me, at);
      const d = h - Math.atan2(fromLook.x - from.x, fromLook.z - from.z);
      const turnAbout = (p: THREE.Vector3): THREE.Vector3 => {
        const dx = p.x - me.x, dz = p.z - me.z;
        return new THREE.Vector3(me.x + dx * Math.cos(d) + dz * Math.sin(d), p.y, me.z - dx * Math.sin(d) + dz * Math.cos(d));
      };
      back = turnAbout(from);
      backLook = turnAbout(fromLook);
      this.world.faceRanger(h);
    }
    move = makeReframe(cam, back, backLook, this.reduced, 2.0, 0);
    this.held = { update: (dt) => move.update(dt), settled: false };
    await this.until(() => !!this.held?.settled);
    this.free();
  }

  /* -------------------------------------------------------------- walking ---- */

  /**
   * A WALK beat (design §3.3): the ranger walks himself (keys, stick, a tap on the
   * ground) with the follow camera; the kit never moves the lens meanwhile. The line
   * says where to; the chip names the goal in words, and only after `arrowAfter` s
   * without getting closer does it show the arrow and the way (the fallback, never the
   * first cue). A walk hint tells golden where a perfect player walks now. Walking far
   * away is never a fail: the chip points back. With `lead`, an animal follows him: it
   * hides when he runs (the line once) and comes out when he walks calmly; the walk
   * waits for it.
   */
  async walk(o: WalkOpts): Promise<void> {
    this.check();
    this.beat = `walk:${o.name}`;
    this.free();
    this.ui.say(o.line);
    const r = o.r ?? (o.to as Place).r ?? 1.2;
    const to = o.to;
    let best = Infinity;
    let bestAt = this.clock;
    let arrow = false;
    const arrowAfter = o.arrowAfter ?? 20;
    const lead = o.lead;
    let hiding: Spot | null = null;
    let calmFor = 0;
    let told = false;
    let waiting = false;
    const gap = lead?.gap ?? 2;
    const rangerLead = (): { x: number; z: number; speed: number } => { const m = this.ranger(); return { x: m.x, z: m.z, speed: m.speed }; };
    if (lead) lead.actor.follow(rangerLead, gap);
    const unhint = this.hint(() => ({ id: `walk:${o.name}`, walk: { x: to.x, z: to.z, r: r * WALK_HINT_R } }));
    let loud = false;
    let hushFor = 0;
    let runs = 0;
    const off = this.onTick((dt) => {
      const m = this.ranger();
      const d = dist(m, to);
      if (d < best - 1) { best = d; bestAt = this.clock; }
      if (o.quiet) {
        // a quiet walk: running gets the hush line once, a calm walk brings the goal back
        const run = isRunning(m);
        if (run && !loud) { loud = true; hushFor = 0; runs += 1; this.ui.say(o.quiet.line); o.quiet.onRun?.(); }
        else if (loud) { hushFor = run ? 0 : hushFor + dt; if (hushFor > 1.6) { loud = false; this.ui.say(o.line); } }
      }
      if (!arrow && this.clock - bestAt > arrowAfter) arrow = true;
      // the chip: the goal in words; the arrow and the way only as the fallback
      const goal = lead && waiting ? lead.actor : to;
      const cue = wayfind(m.x, m.z, m.heading, goal.x, goal.z);
      this.ui.setChip({
        doel: lead && waiting ? (lead.waitLine ? this.copy.chipBig ?? o.doel : o.doel) : o.doel,
        cue: arrow || waiting ? `${cue.richting} · ${cue.afstand}` : (o.cue ?? ''),
        angle: arrow || waiting ? cue.angle : null,
        arrived: d < r,
        glyph: o.glyph,
      });
      o.tick?.(dt);
      if (!lead) return;
      // the animal he leads: hides when he runs, comes out when he walks calmly again
      const a = lead.actor;
      const run = isRunning(m);
      const far = dist(a, m) > 14;
      if (run && !hiding) {
        const spot = nearestAway(a.x, a.z, lead.hide ?? [], { x: m.x, z: m.z, d: 1.5 });
        if (spot) {
          hiding = spot;
          void a.go(spot.x, spot.z, { speed: 'trot' }).then((ok) => { if (ok && hiding === spot) void a.lie(true); });
          lead.onHide?.(spot);
          if (!told && lead.runLine) { told = true; this.ui.say(lead.runLine); }
        }
        calmFor = 0;
      } else if (hiding) {
        calmFor = run ? 0 : calmFor + dt;
        if (calmFor > 1.4) {
          hiding = null;
          a.follow(rangerLead, gap);
          lead.onOut?.();
          this.ui.say(lead.backLine ?? o.line, { good: true });
        }
      } else if (far && !waiting) {
        waiting = true; // he walked off: the animal waits where it is
        a.idle();
        if (lead.waitLine) this.ui.say(lead.waitLine);
      } else if (waiting && dist(a, m) < 5) {
        waiting = false;
        a.follow(rangerLead, gap);
        this.ui.say(o.line);
      }
    });
    try {
      await this.until(() => {
        const m = this.ranger();
        if (dist(m, to) >= r) return false;
        if (!lead) return true;
        return !hiding && !waiting && dist(lead.actor, m) < gap + 1.6;
      });
    } finally {
      off();
      unhint();
      this.ui.setChip(null);
    }
    this.stats[`walk_${o.name}_s`] = Math.round(this.clock);
    if (o.quiet) this.stats[`walk_${o.name}_runs`] = runs;
  }

  /* ---------------------------------------------------------------- misc ---- */

  /**
   * An ACTION in the world (design §3.9): one big button bottom-centre ("Hang de camera
   * op"; Space or Enter press it, golden clicks the visible `.adv-action`). The line, if
   * given, says what to do. Resolves when he presses it.
   */
  async act(label: string, line?: string): Promise<void> {
    this.check();
    if (line) this.ui.say(line);
    try {
      await this.guard(this.ui.action(label));
    } finally {
      if (this.disposed || this.signal.aborted) this.ui.action(null);
    }
  }

  /** Turn the time of day (1 = the golden hour, 0 = a readable blue night) over `seconds`
   *  (~2 s; a cut under reduced motion). The end of the adventure hands the golden hour
   *  back, whether it was won or stopped. */
  daylight(k: number, seconds?: number): void {
    this.dayTurned = true;
    this.world.setDaylight(k, seconds);
  }

  /** The objective line (read aloud once). */
  say(line: string | null, opts?: { good?: boolean; queue?: boolean }): void {
    this.ui.say(line, opts);
  }

  /** The heading from the ranger to a spot. */
  headingFromRanger(p: Spot): number {
    return headingTo(this.ranger(), p);
  }

  /** The dev read (`__ranger.adventure()`). */
  read(): AdventureRead {
    return { mission: this.mission.id, beat: this.beat, stepsLogged: [...this.logged], line: this.ui.current, stats: { ...this.stats } };
  }

  /**
   * The end, won or stopped: every tick and hint goes, the HUD goes, the lens comes
   * back to the follow camera (easing from a held view), the ranger's input is free,
   * the kit's own objects leave the scene, and the home's animals go back to their
   * spots in `state` (walking there calmly).
   */
  dispose(state: 'before' | 'after'): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const off of this.offs) off();
    this.ticks.clear();
    clearPlayHint();
    this.held = null;
    this.world.stopRanger();
    this.world.setMissionMode(null);
    this.ui.setChip(null);
    this.ui.say(null);
    this.ui.action(null);
    this.ui.binoculars(false);
    this.ui.veil(null);
    this.ui.walking(false);
    for (const o of this.owned) {
      o.removeFromParent();
      o.traverse((c) => {
        const m = c as THREE.Mesh;
        m.geometry?.dispose();
        for (const mat of m.material ? [m.material].flat() : []) mat.dispose();
      });
    }
    if (this.group) this.world.residents.release(this.mission.id, state);
    this.group = null;
    // the golden hour comes back (calmly; a cut under reduced motion): never a dark sky
    // after a stop, a win or an error
    if (this.dayTurned || this.world.daylight() < 1) this.world.setDaylight(1, this.reduced ? 0 : 2.4);
  }
}
