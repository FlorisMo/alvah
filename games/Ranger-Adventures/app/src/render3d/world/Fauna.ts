/**
 * world/Fauna.ts — the life in the world that is not a mission.
 *
 * The two story humans (the BOA warden by the report board, the poacher off in the
 * trees) and the ambient wildlife: four animals roaming gentle wander loops and two
 * birds gliding overhead. None are markers; each gets a soft blob shadow. Their motion
 * is secondary, so it freezes at rest under reduced-motion.
 *
 * Run 6 (FEEL, wildlife): the four roamers notice the jeep and the ranger (core/wildlife):
 * each walks its loop on its own clock, lifts its head at the jeep coming and trots — the
 * ree bounds, low — off its path, watches it pass and walks back to its loop; on foot the
 * ranger may walk up close, and a run sends them off early. They move along their facing
 * (never sideways), slide round every trunk, wall, person, the jeep and the ranger, and
 * keep off the water, the mission markers' ground, the helipads and the forest edge. The
 * ranger walks round them in turn (`visitRoamers`); the jeep gives way to them.
 */

import * as THREE from 'three';
import { loadModel, loadRig, prepModel, renderedHeight } from '../Models';
import { SIZE, sizeRow, standHeightFor } from '../AnimalScale';
import { applyEyes } from '../EyeMaterial';
import { applyCoat, applyPosture } from '../AnimalDress';
import { applyCalmPose } from '../CalmPoseRig';
import { gaitFor, motionAt, type MotionRecipe } from '../ProceduralMotion';
import { clearLoop, glideAt, loopPeriod, wanderAt, type GlideConfig, type WanderConfig } from '../AmbientPaths';
import { dampFactor } from '../play/kit-math';
import { mergeColourSplits } from '../play/merge';
import { FarRest, restFar } from '../play/fade';
import { obstacleGap, resolveMove, type MoveLimits, type Obstacle } from '../CharacterController';
import {
  newWildState, strideBody, strideLength, temperamentFor, wildStep, RANGER_BODY,
  type Temperament, type Threats, type WildState, type WildWorld,
} from '../../core/wildlife';
import { JEEP_BODY } from '../../core/vehicle';
import type { Terrain } from './Terrain';

/** Far off in the golden-hour fog a roaming animal calmly fades out and rests (not
 *  drawn): the same edge as the mission markers' animals. */
const ROAM_REST_NEAR = 50;
const ROAM_REST_FAR = 56;

/** Nothing to react to (no ranger on foot, nobody drives). */
const NO_THREATS: Threats = { ranger: null, jeep: null };
/** A roamer keeps this far (m) inside the world's move bound: the forest edge's band. */
const RIM_KEEP = 9;
/** Already this far (m) inside the ranger's or the jeep's circle, a roamer walks out of it
 *  freely (never shoved); any less and the circle holds it. */
const OVERLAP_FREE = 0.1;
/** A roam loop keeps this much room (m) from every solid, marker ground and pad. */
const LOOP_ROOM = 1.2;
/** What a roamer looks at around it each frame (m): trunks, walls, marker ground. */
const NEAR_LOOK = 12;
/** A baked walk clip's ground speed at its own rate (m/s), measured off the planted hooves
 *  at the scale table's size: the legs match the ground at rate = speed / this… */
const CLIP_STRIDE: Record<string, number> = { 'animal-ree-roedeer': 0.62, 'animal-vos-fox': 0.36 };
/** …but never faster than this many times its own rate (a quicker patter reads as
 *  scurrying; a trotting fox's short-legged clip glides a little instead). */
const CLIP_RATE_MAX = 3.2;
/** The static meshes' stride: the squirrel hops, the boar walks and trots. */
const HOPS = new Set(['animal-eekhoorn-squirrel']);

/** One ambient creature (a ground roamer or a gliding bird). */
interface AmbientEntry {
  id: string; group: THREE.Group; phase: number;
  wander: WanderConfig | null;   // ground animals roam this loop
  glide: GlideConfig | null;     // birds sail this overhead orbit
  faceOffset: number;            // per-GLB forward correction (tuned in W3.7)
  recipe: MotionRecipe;          // procedural idle bob (procedural cast only)
  anim: THREE.Group | null;      // the prepped wrapper to drive procedurally
  mixer: THREE.AnimationMixer | null;
  walk: THREE.AnimationAction | null;   // baked stride clip
  graze: THREE.AnimationAction | null;  // baked rest/graze clip
  idle: THREE.AnimationAction | null;   // baked head-up clip: it watches (run 6)
  walkW: number; grazeW: number; idleW: number; // eased crossfade weights
  h: number;                            // applied canonical stand height (W3.7a)
  rest: FarRest;                        // far off in the fog it rests (not drawn)
  // run 6 (wildlife): a ground roamer's own mind and body
  wild: WildState | null;               // where it is, its mode, its own loop clock
  tm: Temperament | null;               // how it reacts (core/wildlife TEMPERAMENT)
  r: number;                            // its footprint radius: half its length (scale table)
  world: WildWorld | null;              // the world it moves in (free ground, a sliding step, its loop)
  body: THREE.Group | null;             // the prepped model: a bound's arc, a trot's bob
  cycle: number;                        // strides taken (the bob and the bound follow the ground)
  audited: boolean;                     // its loop was moved clear of the world's solids
}

/** Where Bram, the warden, stands: beside the missiebord (run 6, FLOW). */
export const WARDEN_AT = { x: 3.9, z: -5.0 } as const;
/** How fast Bram turns to the ranger and back (rad/s): a calm turn of the body. */
const WARDEN_TURN_RATE = 2.2;
/** Quiet this long (s), he turns back to the clearing. */
const WARDEN_RESUME_S = 1.6;
/** The ranger this close (m), Bram looks at him even when he says nothing. */
const WARDEN_NOTICE_M = 4.5;

export class Fauna {
  // W3.3 scenic actors: the warden (BOA) + poacher stand at fixed world spots and
  // play their single baked clip via a mixer. They are NOT missions (kept out of
  // `markers`), carry no proximity/collision — purely diegetic set-dressing that
  // brings the story arc into the world. Their clip is SECONDARY motion, so it
  // freezes at the rest pose under reduced-motion (unlike the player's locomotion).
  readonly scenicActors: {
    id: string; group: THREE.Group;
    mixer: THREE.AnimationMixer | null; action: THREE.AnimationAction | null;
    height: number;  // the actor's measured rendered height (m): the grown-up the
                     // boy is judged against
  }[] = [];
  // W3.6 ambient wildlife: a few animals roam gentle wander loops (baked walk↔graze
  // clips via the mixer for the W3.5-staged cast, improved procedural bob elsewhere)
  // and two birds glide overhead on spline loops. All are pure set-dressing — no
  // markers, no collision, kept out of `markers`. Their motion is SECONDARY, so it
  // freezes at the rest pose under reduced-motion (like the animals + scenic actors).
  readonly ambient: AmbientEntry[] = [];
  blobCount = 0;
  // the season's ontknoping (the poacher was reported): he no longer lurks in the trees
  // but stands calmly by the BOA warden — the reformed poacher of the canon (VISION §4a),
  // a step behind Bram's shoulder, off the sand path
  private readonly POACHER_REFORMED = { x: 5.6, z: -6.4 };
  // ---- run 6 (FLOW lane): Bram, the warden, speaks ---------------------------------
  // While he speaks (ui/hud/Speaker) he turns to the ranger and a small speech mark
  // floats over his head; after, he turns back to his rest (facing the spawn clearing).
  private wardenTalking = false;
  private wardenQuietS = 0;                       // how long he has been quiet (turns back after a beat)
  private speechMark: THREE.Sprite | null = null;
  // ---- end run 6 -------------------------------------------------------------------
  private poacherHome: { x: number; z: number } | null = null;
  private static blobTex: THREE.Texture | null = null;
  private readonly scene: THREE.Scene;
  private readonly terrain: Terrain;
  private readonly obstacles: readonly Obstacle[];
  private readonly limits: MoveLimits;
  private readonly roamLimits: MoveLimits;
  private readonly zones: (visit: (x: number, z: number, r: number) => void) => void;

  constructor(env: {
    scene: THREE.Scene; terrain: Terrain;
    /** the world's solids (trunks, walls, people, parked vehicles): a roamer slides round them */
    obstacles?: readonly Obstacle[];
    /** the world's bound and its water */
    limits?: MoveLimits;
    /** the ground a roamer keeps off (mission markers, helipads): centre + radius */
    zones?: (visit: (x: number, z: number, r: number) => void) => void;
  }) {
    this.scene = env.scene;
    this.terrain = env.terrain;
    this.obstacles = env.obstacles ?? [];
    this.limits = env.limits ?? { bound: 75 };
    // a roamer's feet keep off the whole drawn water (its dry rim under the reeds too), not only
    // off the ground below the surface: no bound or skid ever carries one onto the ven's edge
    const L = this.limits;
    this.roamLimits = {
      bound: L.bound - RIM_KEEP,
      blocked: L.wetWithin ? (x, z) => L.wetWithin!(x, z, this.gatherR) || !!L.blocked?.(x, z) : L.blocked,
    };
    this.zones = env.zones ?? (() => {});
  }

  /** The drawn ground height (the one ground truth, world/Terrain.ts). */
  private groundY(x: number, z: number): number {
    return this.terrain.y(x, z);
  }

  /** Per frame: the scenic actors play their clips and the ambient animals roam /
   *  glide. All SECONDARY motion, so it freezes under reduced-motion. With the lens
   *  (`camera`), a roamer far off in the fog rests. `threats`: the ranger on foot and a
   *  driven jeep, which the roamers see coming (run 6). */
  update(t: number, dt: number, reduced: boolean, camera?: THREE.Camera, threats: Threats = NO_THREATS): void {
    // W3.3: the warden + poacher play their baked clips. Secondary motion, so the
    // clip freezes at the rest pose under reduced-motion (same rule as the animals).
    for (const a of this.scenicActors) a.mixer?.update(reduced ? 0 : dt);

    // W3.6: ambient wildlife. Ground animals roam a gentle wander loop (baked
    // walk↔graze crossfade for the W3.5 cast, procedural bob elsewhere); birds
    // glide overhead. All SECONDARY motion → frozen at home/rest under reduced-
    // motion (the loop halts, the mixer holds its pose — locomotion-exempt rule
    // applies only to the PLAYER, §3.4).
    for (const a of this.ambient) {
      if (a.wander && camera) {
        const g = a.group.position;
        restFar(a.group, a.rest.step(Math.hypot(g.x - camera.position.x, g.z - camera.position.z), dt, reduced));
      }
      if (a.wander && a.wild) {
        // its loop moved clear of the world's solids, once everything is placed (placement,
        // not motion: also under reduced motion)
        if (!a.audited) this.auditLoop(a);
        // frozen under reduced motion, wherever it stands (the jeep's give-way brake keeps it safe)
        if (reduced) { a.mixer?.update(0); continue; }
        this.stepRoamer(a, t, dt, threats);
      } else if (a.glide && !reduced) {
        const st = glideAt(a.glide, t);
        a.group.position.set(st.x, st.y, st.z);
        a.group.rotation.y = st.facing + a.faceOffset;
      }
    }
  }

  /* ------------------------------------------------------- run 6: roamers -- */

  /** One frame of a roamer: it reads the jeep and the ranger, moves (core/wildlife), and
   *  its legs follow the ground it really covered. */
  private stepRoamer(a: AmbientEntry, t: number, dt: number, threats: Threats): void {
    const w = a.wild!;
    this.gatherNear(a, threats);
    wildStep(w, a.tm!, a.r, threats, a.world!, Math.min(dt, 0.1));
    a.group.position.set(w.x, this.groundY(w.x, w.z), w.z);
    a.group.rotation.y = w.facing + a.faceOffset;
    this.animateRoamer(a, t, dt);
  }

  /** The legs and body: baked clips crossfade walk (moving) / idle (watching, head up) /
   *  graze, the walk played at the rate that matches the ground; a ree's bound adds a low
   *  arc; the static boar and squirrel bob, trot and hop with the ground they cover. */
  private animateRoamer(a: AmbientEntry, t: number, dt: number): void {
    const w = a.wild!;
    const v = w.moved;
    const moving = v > 0.05 || Math.abs(w.turning) > 0.5;
    const kind = a.mixer ? (w.gait === 'bound' ? 'bound' : 'still')
      : !moving ? 'still' : HOPS.has(a.id) ? 'hop' : w.gait === 'trot' || w.gait === 'bound' ? 'trot' : 'walk';
    a.cycle += (v * dt) / strideLength(kind, v);
    const k = dampFactor(dt, 0.2);
    a.walkW += ((moving ? 1 : 0) - a.walkW) * k;
    const watching = !moving && (w.mode === 'alert' || w.threat !== null);
    a.idleW += ((watching && a.idle ? 1 : 0) - a.idleW) * k;
    a.grazeW += ((!moving && !(watching && a.idle) ? 1 : 0) - a.grazeW) * k;
    const off = strideBody(kind, a.cycle, v);
    if (a.mixer) {
      a.walk?.setEffectiveWeight(a.walkW);
      a.graze?.setEffectiveWeight(a.grazeW);
      a.idle?.setEffectiveWeight(a.idleW);
      if (a.walk) {
        const stride = CLIP_STRIDE[a.id] ?? 0.6;
        const dur = a.walk.getClip().duration;
        // bounding: one leg cycle per bound; else the rate whose stride matches the ground
        // (a turn on the spot steps the feet round)
        const rate = kind === 'bound' ? (dur * v) / strideLength('bound', v) : Math.max(v, Math.abs(w.turning) * 0.3) / stride;
        a.walk.timeScale = Math.min(CLIP_RATE_MAX, Math.max(0.6, rate));
      }
      a.mixer.update(dt);
      if (a.body) { a.body.position.y = off.lift; a.body.rotation.x = -off.pitch; }
    } else if (a.anim) {
      // breathing while it stands, the stride's bob while it moves (a crossfade, no pop);
      // a rocking body lifts a hair so its ends never dip into the ground
      const d = motionAt(a.recipe, t, a.phase);
      const m = a.walkW;
      const lift = off.lift + Math.abs(off.pitch) * a.r * 0.5;
      a.anim.position.set(d.dx * (1 - m), d.dy * (1 - m) + lift * m, 0);
      a.anim.rotation.set(-off.pitch * m, d.rotY * (1 - m), d.rotZ * (1 - m));
      a.anim.scale.set(1, 1 + (d.scaleY - 1) * (1 - m), 1);
    }
  }

  /** The first frame, with every solid, marker and pad placed: move its loop clear of them
   *  (AmbientPaths.clearLoop; the home stays) and stand it on it. */
  private auditLoop(a: AmbientEntry): void {
    a.audited = true;
    const w = a.wild!;
    this.gatherNear(a, NO_THREATS, true);
    // it grazes in the open: its loop keeps a good metre from every solid and zone
    const cleared = clearLoop(a.wander!, (x, z) => this.freeAt(x, z, LOOP_ROOM));
    a.wander = cleared;
    const at = wanderAt(cleared, w.loopT);
    w.x = at.x; w.z = at.z; w.facing = at.facing; w.gx = at.x; w.gz = at.z;
    a.group.position.set(at.x, this.groundY(at.x, at.z), at.z);
    a.group.rotation.y = at.facing + a.faceOffset;
  }

  // What a roamer meets this frame, gathered into reused buffers (no garbage): the solids
  // near it grown by its size, the marker and pad ground, and the ranger and the jeep.
  private readonly near: Obstacle[] = [];
  private readonly nearPool: Obstacle[] = [];
  private readonly nearBox: NonNullable<Obstacle['box']>[] = [];
  private nearUsed = 0;
  private gatherR = 0;
  // the roamer being gathered for (read by `nearZone`, one callback for every roamer and frame)
  private gatherX = 0;
  private gatherZ = 0;
  private gatherReach = 0;
  private readonly nearZone = (x: number, z: number, r: number): void => {
    const R = this.gatherReach + r;
    if ((x - this.gatherX) ** 2 + (z - this.gatherZ) ** 2 <= R * R) this.near.push(this.pooledObstacle(x, z, r + this.gatherR));
  };

  private pooledObstacle(x: number, z: number, r: number, box?: Obstacle['box'], grow = 0): Obstacle {
    const i = this.nearUsed++;
    const o = this.nearPool[i] ?? (this.nearPool[i] = { x: 0, z: 0, r: 0 });
    o.x = x; o.z = z; o.r = r;
    if (box) {
      const b = this.nearBox[i] ?? (this.nearBox[i] = { hx: 0, hz: 0, rot: 0, pad: 0 });
      b.hx = box.hx; b.hz = box.hz; b.rot = box.rot; b.pad = box.pad + grow;
      o.box = b;
    } else o.box = undefined;
    return o;
  }

  private gatherNear(a: AmbientEntry, threats: Threats, all = false): void {
    const w = a.wild!;
    const near = this.near;
    near.length = 0;
    this.nearUsed = 0;
    this.gatherR = a.r;
    const reach = all ? Infinity : NEAR_LOOK;
    // its body is longer than a child's: every solid is kept this much further off
    const grow = Math.max(0, a.r * 0.6 - 0.2);
    for (const o of this.obstacles) {
      const R = reach + o.r;
      const dx = o.x - w.x, dz = o.z - w.z;
      if (dx * dx + dz * dz > R * R) continue;
      near.push(this.pooledObstacle(o.x, o.z, o.r + grow, o.box, grow));
    }
    this.gatherX = w.x; this.gatherZ = w.z; this.gatherReach = reach;
    this.zones(this.nearZone);
    // the ranger on foot and a driven jeep: never walked through (unless it already stands
    // well inside one — the ranger stepped out of the jeep beside it — so it is never shoved)
    const rg = threats.ranger;
    if (rg) {
      const R = RANGER_BODY + a.r;
      if (Math.hypot(rg.x - w.x, rg.z - w.z) >= R - OVERLAP_FREE) near.push(this.pooledObstacle(rg.x, rg.z, R));
    }
    const j = threats.jeep;
    if (j) {
      const fx = Math.sin(j.heading), fz = Math.cos(j.heading);
      for (const c of JEEP_BODY) {
        const cx = j.x + fx * c.along, cz = j.z + fz * c.along, R = c.r + a.r * 0.8;
        if (Math.hypot(cx - w.x, cz - w.z) >= R - OVERLAP_FREE) near.push(this.pooledObstacle(cx, cz, R));
      }
    }
  }

  /** Open ground for the gathered roamer at (x, z), with `margin` m to spare: clear of the
   *  gathered solids and zones (already grown by its size), of the water by its length (the
   *  whole drawn water, its dry rim under the reeds too: a chased deer never ends up on the
   *  ven's edge) and inside the forest edge's band. */
  private freeAt(x: number, z: number, margin: number): boolean {
    const L = this.limits;
    if (Math.hypot(x, z) > L.bound - RIM_KEEP) return false;
    const q = this.gatherR + 0.6;
    if (L.wetWithin) { if (L.wetWithin(x, z, q)) return false; }
    else if (L.blocked && (L.blocked(x, z) || L.blocked(x + q, z) || L.blocked(x - q, z) || L.blocked(x, z + q) || L.blocked(x, z - q))) return false;
    for (const o of this.near) if (obstacleGap(o, x, z, margin) <= 0) return false;
    return true;
  }

  /** The ground roamers where they are now, for the ranger's step: he walks round them
   *  (`r` = the room he keeps from each centre). No allocation. */
  visitRoamers(visit: (x: number, z: number, r: number) => void): void {
    for (const a of this.ambient) if (a.wild) visit(a.group.position.x, a.group.position.z, a.r + RANGER_BODY);
  }

  /** W4.5: a soft radial blob texture (dark centre → transparent rim), baked once
   *  and shared by every animal blob shadow — cheap grounding with no shadow-map
   *  cost, the plan's choice for the moving cast. */
  private static getBlobTexture(): THREE.Texture {
    if (Fauna.blobTex) return Fauna.blobTex;
    const N = 64;
    const cv = document.createElement('canvas');
    cv.width = cv.height = N;
    const ctx = cv.getContext('2d')!;
    const g = ctx.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
    g.addColorStop(0, 'rgba(30,24,12,0.55)');
    g.addColorStop(0.6, 'rgba(30,24,12,0.28)');
    g.addColorStop(1, 'rgba(30,24,12,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, N, N);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    Fauna.blobTex = tex;
    return tex;
  }

  /** W4.5: add a flat blob shadow disc under an animal/actor group. A child of the
   *  group, so it rides the wander loop for free and freezes with the animal under
   *  reduced-motion. Radially symmetric → the group's yaw never shows. */
  private addBlobShadow(group: THREE.Group, radius: number): void {
    const mat = new THREE.MeshBasicMaterial({
      map: Fauna.getBlobTexture(), transparent: true, depthWrite: false,
    });
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), mat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.03; // just above the ground to avoid z-fighting
    disc.renderOrder = 1;
    group.add(disc);
    this.blobCount++;
  }

  /**
   * W3.3: place the two story-arc humans — the warden (BOA) near the case-board
   * hub where the player reports, and the poacher as a distant, calm figure off
   * in the bos edge. Each loads via `loadRig` and plays its single baked clip
   * through a mixer (advanced in `update`, frozen under reduced-motion). Both sit
   * to the +z side of spawn so the movement smoke's forward (−z) corridor stays
   * clear; neither pushes a collision circle or joins `markers` (pure dressing).
   */
  placeScenicActors(): void {
    // grown men at their true heights (AnimalScale), a head and a half above the boy
    const ACTORS: { id: string; x: number; z: number; height: number }[] = [
      // Bram, the BOA, stands beside his missiebord (2.2, -5) on its right as you arrive:
      // in the first play frame, clear of its ring and of the forward (−z) corridor, at
      // the edge of the sand track toward the watchtower (run 6, FLOW)
      { id: 'ranger-warden-boa', x: WARDEN_AT.x, z: WARDEN_AT.z, height: SIZE.boa.h },
      { id: 'figure-poacher', x: -11.5, z: 8.5, height: SIZE.stroper.h }, // a distant figure in the trees
    ];
    for (const a of ACTORS) {
      const group = new THREE.Group();
      group.position.set(a.x, this.groundY(a.x, a.z), a.z);
      group.rotation.y = Math.atan2(-a.x, -a.z); // face the spawn clearing
      this.scene.add(group);
      this.addBlobShadow(group, 0.55); // W4.5: soft grounding under the figure
      const entry = { id: a.id, group, mixer: null as THREE.AnimationMixer | null, action: null as THREE.AnimationAction | null, height: a.height };
      this.scenicActors.push(entry);
      void loadRig(a.id).then((rig) => {
        if (!rig) return;
        const prepped = prepModel(rig.group, a.height);
        applyEyes(prepped, a.id, { dusk: false });
        applyCalmPose(prepped, a.id); // §B never-scary: bias the poacher into a calm rest shape
        group.add(prepped);
        // expose the actor's MEASURED rendered height (Models.renderedHeight, the same
        // read as the ranger's), never the target it was asked for: a hook reports what
        // renders. `entry.height` keeps the target as the pre-load fallback.
        entry.height = renderedHeight(prepped) ?? entry.height;
        if (rig.clips.length) {
          const mixer = new THREE.AnimationMixer(prepped);
          const clip = rig.clips.find((c) => /idle|rest|stand|breath/i.test(c.name)) ?? rig.clips[0];
          const action = mixer.clipAction(clip).play();
          entry.mixer = mixer;
          entry.action = action;
        }
      });
    }
  }

  /** The ontknoping in the world: `true` walks the poacher out of the trees to stand
   *  by the warden (a cut — he is simply there next time you look), `false` back. */
  setReformed(on: boolean): void {
    const a = this.scenicActors.find((x) => x.id === 'figure-poacher');
    if (!a) return;
    this.poacherHome ??= { x: a.group.position.x, z: a.group.position.z };
    const at = on ? this.POACHER_REFORMED : this.poacherHome;
    a.group.position.set(at.x, this.groundY(at.x, at.z), at.z);
    a.group.rotation.y = Math.atan2(-at.x, -at.z); // face the spawn clearing, like the warden
  }

  // ---- run 6 (FLOW lane): Bram speaks ------------------------------------------------
  /** Bram speaks (true) or is quiet again (false): he turns to the ranger while he
   *  speaks and, when he talks in person (`mark`), a small speech mark floats over his
   *  head. Over the portofoon (far off) there is no mark: drawn on top of the world, it
   *  showed through the cabin roof when he stood behind it. */
  setWardenTalking(on: boolean, mark = on): void {
    this.wardenTalking = on;
    if (on) this.wardenQuietS = 0;
    const w = this.scenicActors.find((a) => a.id === 'ranger-warden-boa');
    if (!w) return;
    if (on && !this.speechMark) {
      this.speechMark = Fauna.makeSpeechMark();
      this.speechMark.position.y = w.height + 0.34;
      w.group.add(this.speechMark);
    }
    if (this.speechMark) this.speechMark.visible = on && mark;
  }

  /** Where Bram stands (x, z), or null before he is placed. */
  wardenPos(): { x: number; z: number } | null {
    const w = this.scenicActors.find((a) => a.id === 'ranger-warden-boa');
    return w ? { x: w.group.position.x, z: w.group.position.z } : null;
  }

  /** Bram for the dev hook: where he stands, how tall, whether he talks (a speech mark
   *  over him) and how far (rad) he turns away from facing `ranger`. */
  wardenState(ranger: { x: number; z: number }): { x: number; z: number; h: number; talking: boolean; mark: boolean; offRanger: number } | null {
    const w = this.scenicActors.find((a) => a.id === 'ranger-warden-boa');
    if (!w) return null;
    const p = w.group.position;
    const want = Math.atan2(ranger.x - p.x, ranger.z - p.z);
    const off = Math.abs(Math.atan2(Math.sin(want - w.group.rotation.y), Math.cos(want - w.group.rotation.y)));
    return { x: p.x, z: p.z, h: w.height, talking: this.wardenTalking, mark: !!this.speechMark?.visible, offRanger: Math.round(off * 100) / 100 };
  }

  /** Per frame: while he speaks, and while the ranger stands near him, Bram turns
   *  (calmly, the short way) to face the ranger; a little after he has finished he turns
   *  back to the clearing. Under reduced motion the turn is a cut. */
  tendWarden(dt: number, ranger: { x: number; z: number }, reduced: boolean): void {
    const w = this.scenicActors.find((a) => a.id === 'ranger-warden-boa');
    if (!w) return;
    const p = w.group.position;
    if (!this.wardenTalking) this.wardenQuietS += dt;
    const near = Math.hypot(ranger.x - p.x, ranger.z - p.z) < WARDEN_NOTICE_M;
    const facing = this.wardenTalking || near || this.wardenQuietS < WARDEN_RESUME_S;
    const want = facing ? Math.atan2(ranger.x - p.x, ranger.z - p.z) : Math.atan2(-p.x, -p.z);
    const d = Math.atan2(Math.sin(want - w.group.rotation.y), Math.cos(want - w.group.rotation.y));
    if (Math.abs(d) < 1e-3) return;
    const step = reduced ? d : Math.sign(d) * Math.min(Math.abs(d), WARDEN_TURN_RATE * dt * Math.min(1, 0.35 + Math.abs(d)));
    w.group.rotation.y += step;
  }

  /** A small warm speech mark (three dots in a paper bubble) over a speaker's head:
   *  drawn on top of the world like the name-tags, never clipped by a crown. */
  private static makeSpeechMark(): THREE.Sprite {
    const W = 96, H = 80;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = 'rgba(253, 252, 248, 0.96)';
    ctx.strokeStyle = 'rgba(40, 30, 18, 0.55)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    const r = 24, x0 = 6, y0 = 6, x1 = W - 6, y1 = H - 24;
    ctx.moveTo(x0 + r, y0); ctx.arcTo(x1, y0, x1, y1, r); ctx.arcTo(x1, y1, x0, y1, r);
    ctx.lineTo(W / 2 + 10, y1); ctx.lineTo(W / 2 - 4, H - 6); ctx.lineTo(W / 2 - 6, y1); // the tail
    ctx.arcTo(x0, y1, x0, y0, r); ctx.arcTo(x0, y0, x1, y0, r); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2f6b46';
    for (const dx of [-22, 0, 22]) { ctx.beginPath(); ctx.arc(W / 2 + dx, (y0 + y1) / 2, 7, 0, Math.PI * 2); ctx.fill(); }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.renderOrder = 13;
    s.scale.set(0.34, 0.34 * (H / W), 1);
    s.center.set(0.5, 0);
    return s;
  }
  // ---- end run 6 -------------------------------------------------------------------

  /** Dev-hook accessor (W3.3 ⊕ P1.6a): each scenic actor's id + its live baked-clip
   *  {name, time} (null until the rig loads / when it carries no clip) + its measured
   *  rendered stand-height (m). Lets the E2E assert the warden + poacher are present
   *  AND their mixers run, and reads the mature-human height the child ranger's scale
   *  is judged against (Alvah < 0.75 × the warden). */
  actorClips(): { id: string; height: number; clip: { name: string; time: number } | null }[] {
    return this.scenicActors.map((a) => ({
      id: a.id,
      height: a.height,
      clip: a.action ? { name: a.action.getClip().name, time: a.action.time } : null,
    }));
  }

  /**
   * W3.6: place the ambient wildlife. Four animals roam gentle wander loops in
   * the biomes (the W3.5-staged ree + vos crossfade their baked walk↔graze clips;
   * the eekhoorn + wild zwijn — no honest CC0 match — get the improved procedural
   * bob PLUS the roam/turn/graze the wander loop provides), and two birds glide
   * overhead on spline orbits. None are markers, none push collision — pure life.
   * Homes sit well clear of the spawn corridor (the −z movement-smoke lane) and
   * the submerged ven (46,-19), so nothing wanders into water or across the demo.
   */
  placeAmbientLife(): void {
    // ground roamers: [id, home x/z, loop radius, whether the GLB carries baked
    // walk/graze clips]. Their size is the scale table's (`AnimalScale.ts`).
    const GROUND: { id: string; hx: number; hz: number; r: number; baked: boolean }[] = [
      // run 6: out on the open drift sand east of the parked jeep (27-38 m straight on from it,
      // nothing solid within 4 m of any grazing stop), no longer in the pocket between two
      // junipers, a boulder and the helipad that a child could not drive into
      { id: 'animal-ree-roedeer', hx: 44, hz: 12, r: 6, baked: true },
      // run 6: the fox and the squirrel roam clear of the frisling's home (its wallow and
      // rooting field lie on the heath west of the clearing: adventure/missions/
      // frisling.places.ts); a squirrel belongs by the trees, not on the open heath
      { id: 'animal-vos-fox', hx: -42, hz: -2, r: 6, baked: true },     // heide, far west
      { id: 'animal-eekhoorn-squirrel', hx: 4, hz: -11, r: 3, baked: false }, // under the grove by the spawn→watchtower path
      { id: 'animal-wildzwijn-boar', hx: 10, hz: 36, r: 6, baked: false },     // heide, south
    ];
    GROUND.forEach((a, i) => {
      const h = standHeightFor(a.id) ?? 0.9; // the scale table (AnimalScale)
      const tm = temperamentFor(a.id);        // how it walks and how close it lets you come (run 6)
      const wander: WanderConfig = {
        homeX: a.hx, homeZ: a.hz, radius: a.r,
        // its legs stride at its calm walk at most (run 6: the old 22-34 s loops strode
        // 2.6-4 m/s and the feet skated); a little each to desync the paces
        period: loopPeriod(a.r, tm.walk) * (1 + i * 0.06),
        phase: (i * 0.27) % 1,       // desync the loops
        angle: i * 1.1,              // rotate each loop differently
      };
      const at = wanderAt(wander, 0); // its own loop clock starts at 0 (the phase desyncs them)
      const group = new THREE.Group();
      group.position.set(at.x, this.groundY(at.x, at.z), at.z);
      group.rotation.y = at.facing;
      this.scene.add(group);
      this.addBlobShadow(group, Math.max(0.35, h * 0.7)); // W4.5: blob under each roamer
      const entry: AmbientEntry = {
        id: a.id, group, phase: i * 1.7,
        wander, glide: null, faceOffset: 0,
        recipe: gaitFor(a.id),
        anim: null, mixer: null, walk: null, graze: null, idle: null,
        walkW: 0, grazeW: 1, idleW: 0, h, rest: new FarRest(ROAM_REST_NEAR, ROAM_REST_FAR),
        wild: newWildState(at, 0), tm, r: Math.max(0.2, (sizeRow(a.id)?.len ?? 1) / 2),
        world: null, body: null, cycle: 0, audited: false,
      };
      entry.world = {
        free: (x, z) => this.freeAt(x, z, 0.1),
        move: (fx, fz, tx, tz, out) => { const p = resolveMove(fx, fz, tx, tz, this.near, this.roamLimits); out.x = p.x; out.z = p.z; },
        loop: (t) => wanderAt(entry.wander!, t),
        loopLeg: wander.period / 4,
      };
      this.ambient.push(entry);
      void loadRig(a.id).then((rig) => {
        if (!rig) return;
        const prepped = prepModel(rig.group, h);
        applyEyes(prepped, a.id, { dusk: false });
        applyCoat(prepped, a.id);     // W3.7b: dossier coat-tint correction (vos rufous)
        applyPosture(prepped, a.id);  // W3.7b: head-low stance for snuffling species
        applyCalmPose(prepped, a.id); // §B never-scary rest-pose bias
        mergeColourSplits(prepped);   // one draw call per animal, not one per colour
        group.add(prepped);
        entry.body = prepped;
        if (a.baked && rig.clips.length) {
          // crossfade the baked walk (moving) against graze (grazing) and idle (head up,
          // watching: run 6); all play from frame one, weights eased each frame
          const mixer = new THREE.AnimationMixer(prepped);
          const walkClip = rig.clips.find((c) => /walk/i.test(c.name)) ?? rig.clips[0];
          const grazeClip = rig.clips.find((c) => /graze|eat/i.test(c.name)) ?? rig.clips.find((c) => /idle|rest/i.test(c.name)) ?? rig.clips[0];
          const idleClip = rig.clips.find((c) => /idle|rest|stand/i.test(c.name) && c !== grazeClip) ?? null;
          entry.walk = mixer.clipAction(walkClip); entry.walk.play(); entry.walk.setEffectiveWeight(0);
          entry.graze = mixer.clipAction(grazeClip); entry.graze.play(); entry.graze.setEffectiveWeight(1);
          if (idleClip) { entry.idle = mixer.clipAction(idleClip); entry.idle.play(); entry.idle.setEffectiveWeight(0); }
          entry.mixer = mixer;
        } else {
          // no baked clips → the improved procedural bob drives this wrapper (the
          // wander loop already supplies roam / turn-in-place / pause-and-graze).
          entry.anim = prepped;
        }
      });
    });

    // two birds gliding overhead on slow spline orbits (the buizerd soars wide,
    // the houtduif circles lower + tighter). Birds are static GLBs → the glide IS
    // the motion; they hold the calm-pose gate (no diving, no flapping panic).
    const BIRDS: { id: string; h: number; cx: number; cz: number; r: number; height: number; period: number; phase: number; bob: number }[] = [
      { id: 'bird-buizerd', h: SIZE.buizerd.h, cx: 4, cz: 0, r: 44, height: 24, period: 30, phase: 0, bob: 1.6 },
      { id: 'bird-houtduif', h: SIZE.houtduif.h, cx: -18, cz: 8, r: 26, height: 16, period: 22, phase: 0.5, bob: 1.1 },
    ];
    BIRDS.forEach((b, i) => {
      const glide: GlideConfig = { cx: b.cx, cz: b.cz, radius: b.r, height: b.height, bob: b.bob, period: b.period, phase: b.phase };
      const group = new THREE.Group();
      const g0 = glideAt(glide, 0);
      group.position.set(g0.x, g0.y, g0.z);
      this.scene.add(group);
      const entry: AmbientEntry = {
        id: b.id, group, phase: i * 2.1,
        wander: null, glide, faceOffset: 0,
        recipe: gaitFor(b.id),
        anim: null, mixer: null, walk: null, graze: null, idle: null,
        walkW: 0, grazeW: 0, idleW: 0, h: b.h, rest: new FarRest(ROAM_REST_NEAR, ROAM_REST_FAR),
        wild: null, tm: null, r: 0, world: null, body: null, cycle: 0, audited: true,
      };
      this.ambient.push(entry);
      void loadModel(b.id).then((m) => {
        if (!m) return;
        const prepped = prepModel(m, b.h);
        applyCalmPose(prepped, b.id);
        group.add(prepped);
      });
    });
  }

  /** Dev-hook accessor (W3.6): each ambient creature's id + live world x/z + its
   *  dominant baked clip {name, time} (null for the procedural + bird cast). Lets
   *  the E2E assert ≥2 animals are present AND a baked mixer clock advances. */
  ambientState(): {
    id: string; x: number; z: number; h: number; clip: { name: string; time: number } | null;
    mode: string | null; speed: number; gait: string | null; facing: number; r: number; threat: string | null;
    loop: { x: number; z: number; r: number; angle: number } | null;
  }[] {
    return this.ambient.map((a) => {
      const w = Math.max(a.walkW, a.grazeW, a.idleW);
      const dom = a.mixer ? (w === a.walkW ? a.walk : w === a.idleW && a.idle ? a.idle : a.graze) : null;
      return {
        id: a.id, x: a.group.position.x, z: a.group.position.z,
        h: a.h, // applied canonical stand height (W3.7a) — E2E asserts the live ordering
        clip: dom ? { name: dom.getClip().name, time: dom.time } : null,
        // run 6: what it is doing (roam / alert / away / yield / return), how fast it really
        // moves (m/s), its legs, the way it faces, its footprint radius, what it reacts to
        mode: a.wild?.mode ?? null, speed: a.wild?.moved ?? 0, gait: a.wild?.gait ?? null,
        facing: a.group.rotation.y, r: a.r, threat: a.wild?.threat ?? null,
        // its roam loop after the audit (home and radius)
        loop: a.wild && a.wander ? { x: a.wander.homeX, z: a.wander.homeZ, r: a.wander.radius, angle: a.wander.angle } : null,
      };
    });
  }
}
