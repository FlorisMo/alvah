/**
 * world/Residents.ts — the animals that LIVE at a mission's home (design §3.4), and
 * the home itself (a wallow, a stand of cover, a rooting field ...).
 *
 * They are in the world from the moment it is built, in one of two states: BEFORE the
 * mission is done (the rotte roots at its wallow, the lost piglet lies squeaking in the
 * bracken) or AFTER it (the family of six at the wallow) — after a reload too. Nothing
 * pops into existence: an adventure BORROWS a home's animals (`borrow`: live actors it
 * moves itself) and gives them back in the after state when it succeeds, in the state
 * the save says when it is stopped (`release`). The classic path's completion switches
 * a home to after (`setState`: a cut under reduced motion or from far away, a calm walk
 * home otherwise).
 *
 * While nobody borrows them they idle believably (rooting, lying still), call now and
 * then while the ranger is near (a squeak you can place: spatial, calm, never over a
 * spoken line), rest in the fog far away like every other animal, stand per point on
 * the rendered ground, and are movers: the seating probe and the jeep see them.
 */

import * as THREE from 'three';
import type { Spawned, SpawnOpts } from '../play/types';
import type { HomeSpec, HomeState, ResidentPose, ResidentSpec } from '../adventure/types';
import { Actor, type ActorEnv } from '../adventure/actors';
import { FarRest, restFar } from '../play/fade';
import type { MoveLimits, Obstacle } from '../CharacterController';
import { Sound } from '../../core/sound';
import { store } from '../../core/state';

/** What a home's dressing (the THREE side of an adventure) gets to build with. */
export interface DressingEnv {
  parent: THREE.Object3D;
  groundY(x: number, z: number): number;
  spawnModel(id: string, opts?: SpawnOpts): Promise<Spawned | null>;
  spawnPlant(id: string, height: number): Promise<Spawned | null>;
  /** the world's solids: a dressing may add its own (a fallen log) */
  obstacles: Obstacle[];
  /** where the lens will stand for a framed view (a Stage fit with an anchor, on a
   *  1280×800 screen): a stand opens its glimpse window for the search's eye */
  lensFor(view: FrameView): { cam: { x: number; y: number; z: number }; look: { x: number; y: number; z: number } };
}

/** A framed view of a world spot (play/stage `anchor`), as a home's places table writes it. */
export interface FrameView {
  at: { x: number; z: number };
  heading: number;
  halfW: number;
  halfD: number;
  tall?: number;
  pitchDeg?: number;
  insetTop?: number;
  insetBottom?: number;
  include?: readonly { x: number; z: number; h: number }[];
}

/** A built home dressing (the wallow, the cover, the field ...). */
export interface HomeDressing {
  /** per frame while the lens is near: `movers` = the home's animals now */
  update(dt: number, t: number, reduced: boolean, movers: readonly { x: number; z: number; moving: boolean }[]): void;
  /** the home's state changed (a replay puts it back before; a finish after) */
  setState(state: HomeState): void;
  dispose(): void;
}

export type DressingBuilder = (env: DressingEnv) => HomeDressing;

/** A resident's own body, when it is not a walking animal (a squirrel that runs up
 *  trees): built for the resident `spec` with the actor env; null = the plain Actor. */
export type ResidentBody = (spec: ResidentSpec, env: ActorEnv, height: number, dressing: HomeDressing | null) => Actor | null;

export interface ResidentsEnv {
  scene: THREE.Scene;
  lensFor: DressingEnv['lensFor'];
  groundY(x: number, z: number): number;
  spawnModel(id: string, opts?: SpawnOpts): Promise<Spawned | null>;
  spawnPlant(id: string, height: number): Promise<Spawned | null>;
  heightFor(id: string): number;
  obstacles: Obstacle[];
  limits: MoveLimits;
  reduced(): boolean;
}

/** A home's animals, lent to an adventure. */
export interface ResidentGroup {
  missionId: string;
  actors: Readonly<Record<string, Actor>>;
  dressing: HomeDressing | null;
  /** switch a resident's calls on or off while it is borrowed (a squeak to follow) */
  voice(key: string, on: boolean): void;
}

interface Home {
  spec: HomeSpec;
  group: THREE.Group;
  dressing: HomeDressing | null;
  actors: Map<string, Actor>;
  state: HomeState;
  borrowed: boolean;
  rest: FarRest;
  voices: Map<string, { next: number; on: boolean }>;
  centre: { x: number; z: number };
  /** free roam: how each animal is reacting to the ranger (see `react`) */
  reacting: Map<string, Reaction>;
  /** bumped whenever the home is laid out, borrowed or given back: a reaction still
   *  running from before leaves the animal alone */
  gen: number;
}

/** A resident's free-roam reaction to the ranger walking up. */
interface Reaction { busy: boolean; away: boolean; cool: number }

/** Within this (m) of the ranger a resident looks up at him (then roots on). */
const NOTICE = 5;
/** Closer than this (m) it steps calmly away from him, never more than `AWAY_MAX` from its spot. */
const SHY = 2.3;
const AWAY_MAX = 1.5;

/** Far off in the fog a home's animals rest (not drawn), like the other animals. */
const REST_NEAR = 46;
const REST_FAR = 52;
/** A home switched to after from further than this (m) is simply there (a cut). */
const WALK_HOME_MAX = 9;

export class Residents {
  private readonly env: ResidentsEnv;
  private readonly homes = new Map<string, Home>();
  private clock = 0;
  /** where the ranger is now (the free-roam reactions look at him) */
  private readonly rangerAt = { x: 0, z: 0 };

  constructor(env: ResidentsEnv) {
    this.env = env;
  }

  /** Build a home: its dressing and its animals, in the before state. `body` gives a
   *  resident its own body (a climbing squirrel) instead of a walking animal's. */
  add(spec: HomeSpec, build?: DressingBuilder, body?: ResidentBody): void {
    const group = new THREE.Group();
    group.name = `home-${spec.missionId}`;
    this.env.scene.add(group);
    const dressing = build ? build({
      parent: group, groundY: this.env.groundY, spawnModel: this.env.spawnModel, spawnPlant: this.env.spawnPlant,
      obstacles: this.env.obstacles, lensFor: this.env.lensFor,
    }) : null;
    const actors = new Map<string, Actor>();
    const home: Home = {
      spec, group, dressing, actors, state: 'before', borrowed: false,
      rest: new FarRest(REST_NEAR, REST_FAR), voices: new Map(),
      centre: spec.places.home ?? spec.places.marker ?? { x: 0, z: 0 },
      reacting: new Map(), gen: 0,
    };
    for (const r of spec.residents) {
      const aenv: ActorEnv = {
        parent: group, groundY: this.env.groundY, spawnModel: this.env.spawnModel,
        obstacles: this.env.obstacles, limits: this.env.limits, reduced: this.env.reduced,
      };
      const height = r.height ?? this.env.heightFor(r.animal);
      const a = body?.(r, aenv, height, dressing) ?? new Actor(r.key, r.animal, aenv, { height });
      actors.set(r.key, a);
      if (r.voice) home.voices.set(r.key, { next: 3 + Math.random() * 4, on: true });
    }
    this.homes.set(spec.missionId, home);
    this.lay(home, 'before', false);
  }

  /** The state a home is in. */
  state(missionId: string): HomeState | null {
    return this.homes.get(missionId)?.state ?? null;
  }

  /** The home's dressing (an adventure uses its cover, its field ...). */
  dressing(missionId: string): HomeDressing | null {
    return this.homes.get(missionId)?.dressing ?? null;
  }

  /**
   * Switch a home to a state. `fresh` = it happens now, in front of the player: the
   * animals walk calmly to their new spots (unless reduced motion, or the walk would be
   * long — then it is a cut); otherwise they are simply there (a reload, a replay under
   * the briefing card). A borrowed home is left to its adventure.
   */
  setState(missionId: string, state: HomeState, fresh = false): void {
    const home = this.homes.get(missionId);
    if (!home || home.borrowed) return;
    this.lay(home, state, fresh && !this.env.reduced());
  }

  /** Lend a home's animals to an adventure (they stop idling on their own). */
  borrow(missionId: string): ResidentGroup | null {
    const home = this.homes.get(missionId);
    if (!home) return null;
    home.borrowed = true;
    home.gen += 1;
    home.reacting.clear();
    // a borrowed home is where the mission plays: it is drawn, however far the lens
    restFar(home.group, 1);
    return {
      missionId,
      actors: Object.fromEntries(home.actors),
      dressing: home.dressing,
      voice: (key, on) => { const v = home.voices.get(key); if (v) { v.on = on; if (on) v.next = Math.min(v.next, 1.2); } },
    };
  }

  /** Give a home back: its animals go to their spots in `state` and idle again. */
  release(missionId: string, state: HomeState, fresh = true): void {
    const home = this.homes.get(missionId);
    if (!home) return;
    home.borrowed = false;
    for (const v of home.voices.values()) v.on = true;
    this.lay(home, state, fresh && !this.env.reduced());
  }

  /** Put every animal of a home at its spot in `state`: a calm walk, or at once. */
  private lay(home: Home, state: HomeState, walk: boolean): void {
    home.state = state;
    home.gen += 1;
    home.reacting.clear();
    home.dressing?.setState(state);
    for (const r of home.spec.residents) {
      const a = home.actors.get(r.key)!;
      const pose = state === 'before' ? r.before : r.after;
      a.group.visible = !!pose;
      if (!pose) { a.idle(); continue; }
      const far = Math.hypot(pose.x - a.x, pose.z - a.z);
      const placed = a.x !== 0 || a.z !== 0;
      if (walk && placed && far > 0.05 && far < WALK_HOME_MAX) {
        void a.go(pose.x, pose.z, { speed: 'walk', face: pose.yaw ?? this.faceHome(home, pose) }).then((ok) => { if (ok) this.idleAt(a, pose); });
      } else {
        a.place(pose.x, pose.z, pose.yaw ?? this.faceHome(home, pose));
        this.idleAt(a, pose);
      }
    }
  }

  private faceHome(home: Home, p: ResidentPose): number {
    return Math.atan2(home.centre.x - p.x, home.centre.z - p.z) + 1.2; // side-on to its home: rooting round it
  }

  private idleAt(a: Actor, pose: ResidentPose): void {
    if (pose.idle === 'lie') { void a.lie(true); a.idle(); return; }
    if (a.lies) void a.lie(false);
    if (pose.idle === 'stand') a.idle();
    else a.root(pose.x, pose.z, pose.roam ?? 0.5);
  }

  /**
   * Per frame: the animals move (their behaviours), the dressing breathes, far homes
   * rest, and a resident with a voice calls now and then while the ranger is near —
   * from where it is (panned by its bearing from the lens, softer further away).
   */
  update(t: number, dt: number, camera: THREE.Camera, ranger: { x: number; z: number }): void {
    this.clock += dt;
    const rangerMoving = dt > 0 && Math.hypot(ranger.x - this.rangerAt.x, ranger.z - this.rangerAt.z) / dt > 0.3;
    this.rangerAt.x = ranger.x; this.rangerAt.z = ranger.z;
    const reduced = this.env.reduced();
    const lx = camera.position.x, lz = camera.position.z;
    for (const home of this.homes.values()) {
      const d = Math.hypot(home.centre.x - lx, home.centre.z - lz);
      const k = home.borrowed ? 1 : home.rest.step(d, dt, reduced);
      restFar(home.group, k);
      if (k <= 0) continue;
      const movers: { x: number; z: number; moving: boolean }[] = [];
      for (const a of home.actors.values()) {
        if (!a.group.visible) continue;
        a.update(dt, t);
        movers.push({ x: a.x, z: a.z, moving: a.speed > 0.15 });
      }
      // the ranger pushes through the cover too
      movers.push({ x: ranger.x, z: ranger.z, moving: rangerMoving });
      home.dressing?.update(dt, t, reduced, movers);
      this.voices(home, dt, camera, ranger);
      if (!home.borrowed) this.react(home, dt, ranger);
    }
  }

  /**
   * Free roam: the family notices the ranger walking up. Within `NOTICE` an animal lifts
   * its head and looks at him for a moment (then roots on); closer than `SHY` it steps
   * calmly away (never toward him, never far from its spot), and once he has gone it
   * wanders back. A lying animal (the hidden piglet) stays pressed flat.
   */
  private react(home: Home, dt: number, ranger: { x: number; z: number }): void {
    for (const r of home.spec.residents) {
      const a = home.actors.get(r.key);
      const pose = home.state === 'before' ? r.before : r.after;
      if (!a || !pose || !a.group.visible || pose.idle === 'lie' || a.lies) continue;
      let st = home.reacting.get(r.key);
      if (!st) { st = { busy: false, away: false, cool: 0 }; home.reacting.set(r.key, st); }
      st.cool = Math.max(0, st.cool - dt);
      if (st.busy) continue;
      const gen = home.gen;
      const s = st;
      const still = (): boolean => home.gen === gen && !home.borrowed;
      const d = Math.hypot(a.x - ranger.x, a.z - ranger.z);
      if (d < SHY) {
        const ux = (a.x - ranger.x) / (d || 1), uz = (a.z - ranger.z) / (d || 1);
        let tx = a.x + ux * 1.2, tz = a.z + uz * 1.2;
        const off = Math.hypot(tx - pose.x, tz - pose.z);
        if (off > AWAY_MAX) { tx = pose.x + ((tx - pose.x) * AWAY_MAX) / off; tz = pose.z + ((tz - pose.z) * AWAY_MAX) / off; }
        if (Math.hypot(tx - a.x, tz - a.z) < 0.25) continue; // as far as it goes: it holds its ground, calm
        s.busy = true; s.away = true; s.cool = 4;
        void a.go(tx, tz, { speed: 'walk' }).then(() => {
          s.busy = false;
          if (still()) a.root(a.x, a.z, 0.25);
        });
      } else if (d < NOTICE && s.cool <= 0) {
        s.busy = true; s.cool = 9 + Math.random() * 4;
        void a.lookAt(() => ({ x: this.rangerAt.x, z: this.rangerAt.z, speed: 0 }), 2.2).then(() => {
          s.busy = false;
          if (!still()) return;
          if (s.away) a.root(a.x, a.z, 0.25);
          else this.idleAt(a, pose);
        });
      } else if (d > NOTICE + 1.5 && s.away) {
        s.busy = true; s.away = false;
        void a.go(pose.x, pose.z, { speed: 'walk' }).then(() => {
          s.busy = false;
          if (still()) this.idleAt(a, pose);
        });
      }
    }
  }

  private voices(home: Home, dt: number, camera: THREE.Camera, ranger: { x: number; z: number }): void {
    if (!home.voices.size) return;
    const geluid = store.get().settings.geluid;
    for (const r of home.spec.residents) {
      const v = home.voices.get(r.key);
      const voice = r.voice;
      const a = home.actors.get(r.key);
      if (!v || !voice || !a || !a.group.visible) continue;
      if (voice.state && voice.state !== home.state) continue;
      if (!v.on) continue;
      v.next -= dt;
      if (v.next > 0) continue;
      const near = Math.hypot(a.x - ranger.x, a.z - ranger.z) <= voice.within;
      // never over a spoken line: try again in a moment
      const speaking = typeof window !== 'undefined' && !!window.speechSynthesis?.speaking;
      if (!near || speaking || !geluid) { v.next = near ? 0.8 : 1.5; continue; }
      Sound.callAt(voice.call, a.x, a.z, listenerOf(camera));
      a.called(); // (a squirrel flicks its tail as it chatters)
      v.next = voice.every[0] + Math.random() * (voice.every[1] - voice.every[0]);
    }
  }

  /** Every home's animals as movers (the jeep brakes for them; the seating probe tags them). */
  movers(visit: (x: number, z: number, h: number) => void): void {
    for (const home of this.homes.values()) {
      if (!home.group.visible) continue;
      for (const a of home.actors.values()) if (a.group.visible) visit(a.x, a.z, a.height);
    }
  }

  /** Where every animal's group stands (exactly), for the seating probe's mover tag. */
  moverSpots(): { x: number; z: number }[] {
    const out: { x: number; z: number }[] = [];
    for (const home of this.homes.values()) for (const a of home.actors.values()) {
      if (a.group.visible) out.push({ x: a.group.position.x, z: a.group.position.z });
    }
    return out;
  }

  /** Dev read: each home's state and its animals. */
  read(): { missionId: string; state: HomeState; borrowed: boolean; actors: { key: string; animal: string; x: number; z: number; lying: boolean; visible: boolean; doing: string; detail: string }[] }[] {
    return [...this.homes.values()].map((h) => ({
      missionId: h.spec.missionId, state: h.state, borrowed: h.borrowed,
      actors: [...h.actors.values()].map((a) => ({
        key: a.key, animal: a.animal, x: a.x, z: a.z, lying: a.lies, visible: a.group.visible, doing: a.doing, detail: a.detail,
      })),
    }));
  }

  dispose(): void {
    for (const home of this.homes.values()) {
      for (const a of home.actors.values()) a.dispose();
      home.dressing?.dispose();
      home.group.removeFromParent();
    }
    this.homes.clear();
  }
}

/** The ears of the scene: where the lens is and which way it looks (a heading). */
export function listenerOf(camera: THREE.Camera): { x: number; z: number; yaw: number } {
  const e = camera.matrixWorld.elements;
  // the lens looks along −z of its own frame: world direction = −(e[8], e[10])
  return { x: camera.position.x, z: camera.position.z, yaw: Math.atan2(-e[8], -e[10]) };
}

export type { ResidentSpec };
