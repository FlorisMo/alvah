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
import type { BeatSummary, Engine, EngineKnobs } from '../../core/skill';
import { store } from '../../core/state';
import { newPlay, type Play } from '../../core/play';
import { ontdekking, type Ontdekking } from '../../content/ontdekkingen';
import type { MoodId } from '../Moods';
import type { RangerMotion, WorldCtx } from '../play/types';
import type { Residents, ResidentGroup } from '../world/Residents';
import type { MissionMode } from '../World';
import { Stage, type StageSpec } from '../play/stage';
import { makeReframe, registerPlayHint, clearPlayHint } from '../play/kit';
import { ARRIVE_RADIUS, bearing as bearingTo, cue as cueAt, wayfind } from '../Wayfinding';
import { isRunning, nearestAway } from './actors-math';
import { walkPace } from '../world/Player';
import type { Actor } from './actors';
import type { AdventureRead, Place, Places, Spot } from './types';
import type { IconName } from '../../ui/icons';
import { atLocal, dist, headingTo } from './places';

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
  /** a photograph of the world through `cam` (taken inside the next frame, never shown);
   *  run 7 (additive): `opts.people: false` leaves the story's grown-ups out of it */
  snapshot(cam: THREE.Camera, w: number, h: number, prepare?: () => (() => void) | void, opts?: { people?: boolean }): Promise<HTMLCanvasElement | null>;
  /** run 7 (§4.5): the session's mood and the one on screen; put the world in a mood */
  mood(): { session: MoodId; now: MoodId };
  setMood(id: MoodId, seconds?: number): void;
  /** run 7 (ree-growth, optional): the UI's soft dip for a cut inside the world: `move`
   *  runs under the warm veil, `then` once the new view is drawn (none: both at once) */
  dipCut?(move: () => void, then: () => void): void;
}

/** The adventure's HUD (ui/flow/AdventureHud.ts implements it). */
export interface AdventureUi {
  say(text: string | null, opts?: { good?: boolean; queue?: boolean }): void;
  readonly current: string | null;
  setChip(c: { doel: string; cue: string; angle: number | null; arrived?: boolean; glyph?: IconName } | null): void;
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
  reunion(play: () => Promise<void>, holdS?: number): Promise<void>;
  /** the pause card is up (the mission clock stands still) */
  paused(): boolean;
  /** run 7 (§4.4): a NEW discovery's calm reveal (queued; it waits for a quiet moment);
   *  `heard` (ree-discover, additive): he met it by its call alone ("Dat hoorde je!");
   *  `first` (ek-finds, additive): the find of the moment, before what waits */
  reveal?(o: Ontdekking, opts?: { heard?: boolean; first?: boolean }): void;
  /** ree-discover (additive): how many reveals wait or show now (none when not wired) */
  revealsWaiting?(): number;
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
  /** run 7 (§4.1): this play's variety, drawn at the briefing (default: a play over seed 0) */
  play?: Play;
  /** run 7 (§4.5): this play's mood (default: the one on screen) */
  mood?: MoodId;
  /** run 7 (§4.4): this play's rare visitor for this home, rolled at the briefing */
  rare?: Ontdekking | null;
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
  /** things that must be in the picture too (the ranger, an animal); `r`: how wide it
   *  is round its middle (m) — his shoulders both in the picture, never cut by its edge */
  include?: readonly { x: number; z: number; h: number; r?: number }[];
  /** seconds of the eased move (≥ ~90°/s turns: longer for a big turn) */
  seconds?: number;
  /** run 7 (additive, ven): the closest (m) the lens may come to what it frames, and how
   *  low (m) over the ground it may stand (defaults 3 and 1.4: every view as before) — a
   *  singing frog seen from just over the water */
  near?: number;
  lensUp?: number;
}

export interface WalkOpts {
  /** a name for the beat ('cover', 'field' ...) */
  name: string;
  /** run 7 (additive): the beat while he walks, when it is not a plain walk (default
   *  `walk:<name>`, a calm beat a veldgids reveal may show in; a walk that is a search
   *  of his own, e.g. 'seek:val', keeps the reveals for later) */
  beat?: string;
  to: Place | Spot;
  /** arrive within this (m); default the place's r, else 1.2 */
  r?: number;
  /** the objective line */
  line: string;
  /** the chip: where he goes, in words, and the cue under it before the arrow shows */
  doel: string;
  cue?: string;
  /** the chip's sign before the words, from the game's icon set (default 'ear': a sound
   *  to follow; 'footprints' prints; 'boot' a quiet walk) */
  glyph?: IconName;
  /** seconds without getting closer before the chip shows the arrow (default 20) */
  arrowAfter?: number;
  /** an animal that follows him (the piglet he leads): it keeps its gap, hides when he
   *  runs (`hide`: the cover it dives into: one in his picture, by it), and stays hidden
   *  until he has walked calmly back to it — a run never gains him a metre; the walk
   *  waits for it */
  lead?: {
    actor: Actor;
    gap?: number;
    hide?: readonly Spot[];
    /** said on EVERY run (why it hid) */
    runLine?: string;
    backLine?: string;
    /** said when it waits for him: he walked far off, or he is calm again but away from
     *  the clump it hides in (and the chip points to it) */
    waitLine?: string;
    /** called when it hides / comes out (a rustle, a squeak) */
    onHide?: (spot: Spot) => void;
    onOut?: () => void;
    /** his walk at the animal's pace while he leads it (m/s): a careful walk, so they stay
     *  together; running is his own choice, and the animal hides */
    pace?: number;
    /** run 7 (additive): how near (m) he must walk back to it, calm, before it comes out of
     *  its clump after a run (default `LEAD_BACK_M`; the frisling's tired piglet: right up
     *  to it, so the walk back is part of walking calmly with it again) */
    backM?: number;
    /** it trots at his SIDE (m, + right, − left) instead of trailing `gap` m behind him:
     *  the follow lens behind him sees it beside his legs, never at its own feet at the
     *  bottom edge of the picture (`gap` is then how close it keeps to that spot) */
    side?: number;
  };
  /** extra per-frame work while he walks (a squeak getting louder ...) */
  tick?: (dt: number) => void;
  /** he should walk QUIETLY (away from a calf lying in the grass): running says `line`
   *  (and calls `onRun`) once per run; walking calmly again brings the walk's line back */
  quiet?: { line: string; onRun?: () => void };
  /** the way a perfect player walks (golden's hint only): these points in turn, round
   *  what is to be walked round (the ree's pool), each until he comes within 1 m of it */
  via?: readonly Spot[];
  /** run 7 (additive, fix-discovery-homes): where the chip's arrow points from where he is
   *  NOW when not straight at `to` — round what he must not walk over or into (a brooding
   *  bird, the wildlife screen) — or null: straight at `to` (the default). The metres it
   *  shows stay those to `to` (by that point); golden's hint walks there too once `via` has
   *  no point left. */
  way?: (me: Spot) => Spot | null;
  /** a second way to be there, besides within `r` of `to` (the hint still walks to `to`):
   *  e.g. right up at the bark on the side the squirrel hides, not only out at the spot
   *  to see it from */
  reached?: () => boolean;
}

/**
 * Run 7: a calm move of the lens round `about` (the ranger) to the pose `to`/`lookAt`: its
 * bearing from him, its distance and its height eased together (an arc, never a straight
 * line through him), its aim turned with it; ≥ `seconds`, and slow enough that neither the
 * arc nor the aim turns more than 90° a second. A cut under reduced motion.
 */
function orbitReframe(camera: THREE.PerspectiveCamera, about: Spot, to: THREE.Vector3, lookAt: THREE.Vector3, reduced: boolean, seconds: number): { update: (dt: number) => boolean } {
  let start: { r: number; phi: number; y: number; yaw: number; pitch: number } | null = null;
  let end: { r: number; phi: number; y: number; yaw: number; pitch: number } | null = null;
  let dPhi = 0, dYaw = 0, dur = seconds, t = 0;
  const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
  const aimOf = (d: THREE.Vector3): { yaw: number; pitch: number } => ({ yaw: Math.atan2(d.x, d.z), pitch: Math.asin(Math.max(-1, Math.min(1, d.y / (d.length() || 1)))) });
  const poseOf = (p: THREE.Vector3, d: THREE.Vector3) => ({ r: Math.hypot(p.x - about.x, p.z - about.z), phi: Math.atan2(p.x - about.x, p.z - about.z), y: p.y, ...aimOf(d) });
  const hold = (): void => { camera.position.copy(to); camera.up.set(0, 1, 0); camera.lookAt(lookAt); };
  return {
    update(dt: number): boolean {
      if (reduced) { hold(); return true; }
      if (!start || !end) {
        start = poseOf(camera.position, camera.getWorldDirection(new THREE.Vector3()));
        end = poseOf(to, lookAt.clone().sub(to));
        dPhi = wrap(end.phi - start.phi);
        dYaw = wrap(end.yaw - start.yaw);
        dur = Math.max(seconds, Math.abs(dPhi) / (Math.PI / 2), Math.abs(dYaw) / (Math.PI / 2));
      }
      t = Math.min(1, t + Math.min(dt, 0.05) / dur);
      if (t >= 1) { hold(); return true; }
      const e = t * t * (3 - 2 * t);
      const phi = start.phi + dPhi * e, r = start.r + (end.r - start.r) * e;
      camera.position.set(about.x + Math.sin(phi) * r, start.y + (end.y - start.y) * e, about.z + Math.cos(phi) * r);
      const yaw = start.yaw + dYaw * e, pitch = start.pitch + (end.pitch - start.pitch) * e;
      camera.up.set(0, 1, 0); // roll = 0 always
      camera.lookAt(camera.position.x + Math.sin(yaw) * Math.cos(pitch), camera.position.y + Math.sin(pitch), camera.position.z + Math.cos(yaw) * Math.cos(pitch));
      return false;
    },
  };
}

const WALK_HINT_R = 0.8; // golden walks until it is within this share of r
/** The animal he leads waits where it is once he is this far off (m) — a long walk away,
 *  not a few running steps — and follows again once he is back within `LEAD_BACK_M`.
 *  After a run it hides in its clump until he is calm AND back within `LEAD_BACK_M`. */
const LEAD_WAIT_M = 20;
const LEAD_BACK_M = 5;
/** How long (s) he walks calmly before the animal he leads trusts him again. */
const LEAD_CALM_S = 1.4;
/** The clump a frightened animal dives into is at most this far from it (m). */
const LEAD_DIVE_M = 8;
const DIVE_V = new THREE.Vector3();

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
  /** Run 7 (§4.1): THIS play's variety. Draw every choice from a fork of it, one per
   *  decision (`k.play.fork('hide').pick(SPOTS)`), and note it (`k.play.note('hide', id)`):
   *  never `Math.random`. */
  readonly play: Play;
  /** Run 7 (§4.5): the mood this play stands in (the end hands the session's back). */
  readonly mood: MoodId;
  private readonly rareRow: Ontdekking | null;
  /** what he discovered in this play (seen or heard; new or not) */
  private readonly found = new Set<string>();

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
    this.play = o.play ?? newPlay(o.mission.id, 0, 1);
    this.mood = o.mood ?? o.world.mood().now;
    this.rareRow = o.rare ?? null;
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

  /* ------------------------------------------- run 7: variety, growth, finds ---- */

  /** The live level of a breinkracht (1..6): where its beat starts (design §4.2). */
  level(engine: Engine): number { return store.level(engine); }

  /** The knobs a breinkracht's beat reads now: the SAME knobs its 2D floor reads. A home
   *  maps them onto its world; it never invents its own difficulty number (§4.2). */
  knobs<E extends Engine>(engine: E): EngineKnobs[E] { return store.knobs(engine); }

  /**
   * He saw or heard it (design §4.4): call when the thing was really in his picture (on
   * screen, ≥ ~40 px, ≥ 1 s) or its call reached him — never as a prize. Recorded in the
   * save at once; a NEW one gets one calm reveal at a quiet moment (`quiet`: none).
   * Returns whether it was new. Once a play: a second call for the same id in this play
   * records nothing (safe to call from a tick). An id missing from content/ontdekkingen.ts
   * is a bug: it warns and records nothing. `heard` (ree-discover, additive): he met it by
   * its call alone (a cuckoo in the trees): its reveal says "Dat hoorde je!". `first`
   * (ek-finds, additive): it is the find of the moment he is in (its line just said): its
   * reveal goes before the ones that wait, so the card comes with its moment.
   */
  discover(id: string, opts: { quiet?: boolean; heard?: boolean; first?: boolean } = {}): boolean {
    const row = ontdekking(id);
    if (!row) { console.warn(`[adventure] k.discover: no discovery "${id}" in content/ontdekkingen.ts`); return false; }
    if (this.found.has(id)) return false; // (once a play: "times seen" counts plays, not frames)
    this.found.add(id);
    const fresh = store.discover(id);
    if (fresh && !opts.quiet) this.hooks.reveal?.(row, opts.heard || opts.first ? { ...(opts.heard ? { heard: true } : {}), ...(opts.first ? { first: true } : {}) } : undefined);
    return fresh;
  }

  /** How many new finds' reveals still wait for a quiet moment, or show now (ree-discover,
   *  additive): a home may hold a calm picture until they have all been seen. */
  revealsWaiting(): number { return this.hooks.revealsWaiting?.() ?? 0; }

  /** THIS play's rare visitor for this home (rolled at the briefing, §4.4), or null. Show
   *  it in the world; call `discover(its id)` once he really saw or heard it. */
  rare(): Ontdekking | null { return this.rareRow; }

  /** Did he discover a rare of this home in this play (the pity counter resets)? */
  get gotRare(): boolean {
    return [...this.found].some((id) => { const r = ontdekking(id); return r?.soort === 'zeldzaam' && r.home === this.mission.id; });
  }

  /** The raaf tells step `i`'s fact (a card over the world; the ranger holds still). */
  async fact(i: number): Promise<void> {
    this.beat = `fact:${i}`;
    this.ui.say(null);
    await this.guard(this.hooks.fact(i));
  }

  /** The mission is won: the flow marks it done, and shows its line while `play` plays.
   *  `holdS` (ree-discover, additive): how much longer than its usual most the line may
   *  stay while `play` still plays (new finds' cards still to be seen there). */
  async reunion(play: () => Promise<void>, opts: { holdS?: number } = {}): Promise<void> {
    // the EF contract: a mission is done only once every step was played and logged
    const missing = this.steps.map((_, i) => i).filter((i) => !this.logged.includes(i));
    if (missing.length) throw new Error(`[adventure] the reunion came before step(s) ${missing.join(', ')} were played`);
    this.beat = 'reunion';
    this.ui.say(null);
    this.ui.setChip(null);
    await this.guard(this.hooks.reunion(play, opts.holdS));
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
    const right = { x: -Math.cos(f.heading), z: Math.sin(f.heading) }; // (the frame's u axis)
    const include = f.include?.flatMap((q) => {
      const p = dist(q, me) < 1.2 ? { ...q, x: me.x, z: me.z } : q;
      const r = q.r ?? 0;
      return r > 0 ? [-r, r].map((u) => ({ x: p.x + right.x * u, z: p.z + right.z * u, h: p.h })) : [{ x: p.x, z: p.z, h: p.h }];
    });
    const spec: StageSpec = {
      halfW: f.halfW, halfD: f.halfD, tall: f.tall ?? 1, pitchDeg: f.pitchDeg ?? 34,
      insetTop: f.insetTop ?? 96, insetBottom: f.insetBottom ?? 16,
      anchor: { x: f.at.x, z: f.at.z, heading: f.heading, include },
      ...(f.near !== undefined ? { near: f.near } : {}), ...(f.lensUp !== undefined ? { lensUp: f.lensUp } : {}),
    };
    const stage = new Stage(this.ctx, spec);
    return { cam: stage.cam.clone(), look: stage.look.clone(), stage };
  }

  /**
   * Hold the lens on a framed view (one calm eased move there — a cut under reduced
   * motion) with the ranger's input locked: a framed beat. Resolves once the lens has
   * settled. `face`: turn the ranger to look this way first (he stands). Run 7 (additive):
   * `dip` — a view that would turn the lens more than 90° (he walked away and the family is
   * behind him) is one soft dip-cut instead of a swing round him (the world's warm veil, as
   * climbing into the jeep from its front); up to 90° the glide stays.
   */
  async frame(f: FrameSpec, opts: { face?: number; dip?: boolean } = {}): Promise<Stage> {
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
    const camera = this.world.camera;
    const now = camera.getWorldDirection(new THREE.Vector3()).setY(0);
    const want = look.clone().sub(cam).setY(0);
    const turn = now.lengthSq() > 1e-9 && want.lengthSq() > 1e-9 ? now.angleTo(want) : 0;
    const dipCut = this.world.dipCut;
    if (opts.dip && dipCut && !this.reduced && turn > Math.PI / 2) {
      // (under the veil the lens cuts there and holds; the veil lifts on the new view)
      this.held = { update: () => false, settled: false };
      await this.guard(new Promise<void>((resolve) => dipCut.call(this.world, () => {
        const cut = makeReframe(camera, cam, look, true);
        cut.update(0);
        this.held = { update: (dt) => cut.update(dt), settled: false };
      }, resolve)));
      await this.until(() => !!this.held?.settled);
      return stage;
    }
    const move = makeReframe(camera, cam, look, this.reduced, f.seconds ?? 1.4, 0.3);
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
   * the story goes on, instead of the way he came. Run 7 `face`: he turns to THIS heading
   * instead (the way a squeak comes from), and the lens comes round behind him on an arc
   * about him (never a straight line through him), at most 90° a second. Run 7 (additive)
   * `seconds`: each glide takes this long (default 2.2 there, 2.0 back) — a look across the
   * ven's water travels 20-28 m and glides slower, never faster than a calm walk's lens.
   */
  async look(at: Spot & { y?: number }, line: string, hold = 2.5, opts: { turn?: boolean; face?: number; seconds?: number } = {}): Promise<void> {
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
    let move = makeReframe(cam, pos, target, this.reduced, opts.seconds ?? 2.2, 0);
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
    const me = this.ranger();
    if (opts.turn || opts.face !== undefined) {
      // the lens's pose behind him, turned round him by as much as he turns to face it
      const h = opts.face ?? headingTo(me, at);
      const d = h - Math.atan2(fromLook.x - from.x, fromLook.z - from.z);
      const turnAbout = (p: THREE.Vector3): THREE.Vector3 => {
        const dx = p.x - me.x, dz = p.z - me.z;
        return new THREE.Vector3(me.x + dx * Math.cos(d) + dz * Math.sin(d), p.y, me.z - dx * Math.sin(d) + dz * Math.cos(d));
      };
      back = turnAbout(from);
      backLook = turnAbout(fromLook);
      this.world.faceRanger(h);
    }
    const backS = opts.seconds ?? 2.0;
    move = opts.face !== undefined ? orbitReframe(cam, me, back, backLook, this.reduced, backS) : makeReframe(cam, back, backLook, this.reduced, backS, 0);
    this.held = { update: (dt) => move.update(dt), settled: false };
    await this.until(() => !!this.held?.settled);
    this.free();
  }

  /**
   * Run 7: the lens comes round BEHIND him — where the walk camera stands, looking the way
   * he faces — on an arc about him (≤ 90° a second; a cut under reduced motion). After a
   * framed moment (he turned to an animal at his side) a walk then starts with the view
   * the way he goes, not the way the moment's picture looked.
   */
  async behind(): Promise<void> {
    this.check();
    const cam = this.world.camera;
    const me = this.ranger();
    const g = this.ctx.groundY(me.x, me.z);
    const f = { x: Math.sin(me.heading), z: Math.cos(me.heading) };
    const to = new THREE.Vector3(me.x - f.x * 4.6, 0, me.z - f.z * 4.6);
    to.y = Math.max(g + 2.4, this.ctx.groundY(to.x, to.z) + 1.4);
    const look = new THREE.Vector3(me.x + f.x * 1.6, g + 0.9, me.z + f.z * 1.6);
    this.world.setMissionMode({ missionId: this.mission.id, input: 'locked', camera: 'held' });
    this.ui.walking(false);
    const move = orbitReframe(cam, me, to, look, this.reduced, 1.0);
    this.held = { update: (dt) => move.update(dt), settled: false };
    await this.until(() => !!this.held?.settled);
  }

  /* -------------------------------------------------------------- walking ---- */

  /**
   * A WALK beat (design §3.3): the ranger walks himself (keys, stick, a tap on the
   * ground) with the follow camera; the kit never moves the lens meanwhile. The line
   * says where to; the chip names the goal in words, and only after `arrowAfter` s
   * without getting closer does it show the arrow and the way (the fallback, never the
   * first cue). A walk hint tells golden where a perfect player walks now. Walking far
   * away is never a fail: the chip points back. With `lead`, an animal follows him: it
   * hides when he runs (into a clump he sees, with the line, every run) and comes out
   * once he walks calmly back to it, so running never gains him a metre; the walk waits
   * for it.
   */
  async walk(o: WalkOpts): Promise<void> {
    this.check();
    this.beat = o.beat ?? `walk:${o.name}`;
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
    const rangerLead = (): { x: number; z: number; speed: number } => {
      const m = this.ranger();
      if (!lead?.side) return { x: m.x, z: m.z, speed: m.speed };
      const at = atLocal({ x: m.x, z: m.z, heading: m.heading }, lead.side, -0.25); // (beside his legs, a little back)
      return { x: at.x, z: at.z, speed: m.speed };
    };
    if (lead) lead.actor.follow(rangerLead, gap);
    if (lead?.pace) walkPace.cap = lead.pace;
    // the way he really walked (m), the straight way it asked (m) and how long it took from
    // his first step (s): a test checks the design's bar against them
    let walked = 0;
    let began: number | null = null;
    let was = this.ranger();
    const line = dist(was, to);
    // (a perfect player walks to the goal — round what `via` names; when the animal he
    // leads waits for him, back to it)
    let viaI = 0;
    const unhint = this.hint(() => {
      if (lead && (waiting || hiding)) return { id: `walk:${o.name}:back`, walk: { x: lead.actor.x, z: lead.actor.z, r: (hiding ? lead.backM ?? LEAD_BACK_M : LEAD_BACK_M) * 0.7 } };
      const v = o.via?.[viaI];
      if (v) return { id: `walk:${o.name}:via${viaI}`, walk: { x: v.x, z: v.z, r: 0.7 } };
      const w = o.way?.(this.ranger());
      if (w) return { id: `walk:${o.name}:way`, walk: { x: w.x, z: w.z, r: 0.7 } };
      return { id: `walk:${o.name}`, walk: { x: to.x, z: to.z, r: r * WALK_HINT_R } };
    });
    let loud = false;
    let hushFor = 0;
    let runs = 0;
    const off = this.onTick((dt) => {
      const m = this.ranger();
      walked += Math.min(1, dist(m, was)); // (a jump — a cut — is not a walk)
      if (began === null && walked > 0.3) began = this.clock;
      was = m;
      const d = dist(m, to);
      if (d < best - 1) { best = d; bestAt = this.clock; }
      while (o.via && viaI < o.via.length && dist(m, o.via[viaI]) < 1.0) viaI += 1;
      if (o.quiet) {
        // a quiet walk: running gets the hush line once, a calm walk brings the goal back
        const run = isRunning(m);
        if (run && !loud) { loud = true; hushFor = 0; runs += 1; this.ui.say(o.quiet.line); o.quiet.onRun?.(); }
        else if (loud) { hushFor = run ? 0 : hushFor + dt; if (hushFor > 1.6) { loud = false; this.ui.say(o.line); } }
      }
      if (!arrow && this.clock - bestAt > arrowAfter) arrow = true;
      // the chip: the goal in words; the arrow and the way only as the fallback
      // (the animal he leads waits for him — he walked off, or it hides and he is calm
      // again but away from it: the chip names it and points to it)
      const lost = waiting || (!!hiding && calmFor > LEAD_CALM_S);
      const goal = lead && lost ? lead.actor : to;
      const here = d < r || !!o.reached?.();
      // (round what is in the way: the arrow at the way's next point, the metres to the goal)
      const round = goal === to && !here ? o.way?.(m) ?? null : null;
      const raw = round
        ? cueAt(bearingTo(m.x, m.z, m.heading, round.x, round.z), Math.max(ARRIVE_RADIUS, dist(m, round) + dist(round, to)))
        : wayfind(m.x, m.z, m.heading, goal.x, goal.z);
      // (within a marker's arrive radius of the goal but not yet at this walk's own: the
      // way and the metres still, never "je bent er" while nothing happens)
      const cue = raw.arrived && !(goal === to && here) ? cueAt(raw.angle, ARRIVE_RADIUS) : raw;
      this.ui.setChip({
        doel: lead && lost ? (lead.waitLine ? this.copy.chipBig ?? o.doel : o.doel) : o.doel,
        cue: arrow || lost ? `${cue.richting} · ${cue.afstand}` : (o.cue ?? ''),
        angle: arrow || lost ? cue.angle : null,
        arrived: here,
        glyph: o.glyph,
      });
      o.tick?.(dt);
      if (!lead) return;
      // the animal he leads: hides when he runs — into a clump in his picture, so he sees
      // it dive — and comes out only once he is calm again AND back by it
      const a = lead.actor;
      const run = isRunning(m);
      const far = dist(a, m) > LEAD_WAIT_M;
      if (run && !hiding) {
        const spot = this.diveSpot(a, m, lead.hide ?? []);
        if (spot) {
          hiding = spot;
          told = false;
          void a.go(spot.x, spot.z, { speed: 'trot' }).then((ok) => { if (ok && hiding === spot) void a.lie(true); });
          lead.onHide?.(spot);
          if (lead.runLine) this.ui.say(lead.runLine); // (every run: why it hid)
          this.stats[`walk_${o.name}_dives`] = (this.stats[`walk_${o.name}_dives`] ?? 0) + 1;
        }
        calmFor = 0;
      } else if (hiding) {
        calmFor = run ? 0 : calmFor + dt;
        if (calmFor > LEAD_CALM_S && dist(a, m) < (lead.backM ?? LEAD_BACK_M)) {
          hiding = null;
          a.follow(rangerLead, gap);
          lead.onOut?.();
          this.ui.say(lead.backLine ?? o.line, { good: true });
        } else if (calmFor > LEAD_CALM_S && !told) {
          told = true; // calm again, but away from it: it waits in its clump for him
          if (lead.waitLine) this.ui.say(lead.waitLine);
        }
      } else if (far && !waiting) {
        waiting = true; // he walked off: the animal waits where it is
        this.stats[`walk_${o.name}_waits`] = (this.stats[`walk_${o.name}_waits`] ?? 0) + 1; // (run 7: a test's measure)
        a.idle();
        if (lead.waitLine) this.ui.say(lead.waitLine);
      } else if (waiting && dist(a, m) < LEAD_BACK_M) {
        waiting = false;
        a.follow(rangerLead, gap);
        this.ui.say(o.line);
      }
    });
    try {
      await this.until(() => {
        const m = this.ranger();
        if (dist(m, to) >= r && !o.reached?.()) return false;
        if (!lead) return true;
        return !hiding && !waiting && dist(lead.actor, m) < gap + 1.6;
      });
    } finally {
      off();
      unhint();
      this.ui.setChip(null);
      if (lead?.pace) walkPace.cap = null;
    }
    this.stats[`walk_${o.name}_s`] = Math.round(this.clock);
    this.stats[`walk_${o.name}_m`] = Math.round(walked * 10) / 10;
    // (run 7: the lead's bar is its straight line at the animal's pace)
    this.stats[`walk_${o.name}_line`] = Math.round(line * 10) / 10;
    this.stats[`walk_${o.name}_dur`] = Math.round((this.clock - (began ?? this.clock)) * 10) / 10;
    if (o.quiet) this.stats[`walk_${o.name}_runs`] = runs;
  }

  /** The clump a frightened animal he leads dives into: the nearest to it (within
   *  LEAD_DIVE_M, and not at his feet) that is in his picture — so the child sees it
   *  bolt in (a dive behind the follow camera was only a line and a squeak) — else the
   *  nearest one away from him. */
  private diveSpot(a: { x: number; z: number }, m: { x: number; z: number }, spots: readonly Spot[]): Spot | null {
    const cam = this.world.camera;
    cam.updateMatrixWorld();
    const seen = spots.filter((s) => {
      if (dist(s, m) < 1.5 || dist(s, a) > LEAD_DIVE_M) return false;
      DIVE_V.set(s.x, this.ctx.groundY(s.x, s.z) + 0.25, s.z);
      if (DIVE_V.clone().applyMatrix4(cam.matrixWorldInverse).z > -1) return false; // (behind the lens)
      DIVE_V.project(cam);
      return Math.abs(DIVE_V.x) < 0.85 && DIVE_V.y > -0.85 && DIVE_V.y < 0.6;
    });
    return nearestAway(a.x, a.z, seen) ?? nearestAway(a.x, a.z, spots, { x: m.x, z: m.z, d: 1.5 });
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
    walkPace.cap = null; // (a stop in the middle of a lead: his own walk back)
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
    // run 7: a play in its own mood hands the session's mood back (calmly; a cut under
    // reduced motion), won or stopped
    const m = this.world.mood();
    if (m.now !== m.session) this.world.setMood(m.session, this.reduced ? 0 : 2.4);
  }
}
