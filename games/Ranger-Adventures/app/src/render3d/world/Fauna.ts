/**
 * world/Fauna.ts — the life in the world that is not a mission.
 *
 * The two story humans (the BOA warden by the report board, the poacher off in the
 * trees) and the ambient wildlife: four animals roaming gentle wander loops and two
 * birds gliding overhead. None are markers and none collide; each gets a soft blob
 * shadow. Their motion is secondary, so it freezes at rest under reduced-motion.
 */

import * as THREE from 'three';
import { loadModel, loadRig, prepModel, renderedHeight } from '../Models';
import { SIZE, standHeightFor } from '../AnimalScale';
import { applyEyes } from '../EyeMaterial';
import { applyCoat, applyPosture } from '../AnimalDress';
import { applyCalmPose } from '../CalmPoseRig';
import { gaitFor, motionAt, type MotionRecipe } from '../ProceduralMotion';
import { glideAt, wanderAt, type GlideConfig, type WanderConfig } from '../AmbientPaths';
import { dampFactor } from '../play/kit-math';
import { mergeColourSplits } from '../play/merge';
import { FarRest, restFar } from '../play/fade';
import type { Terrain } from './Terrain';

/** Far off in the golden-hour fog a roaming animal calmly fades out and rests (not
 *  drawn): the same edge as the mission markers' animals. */
const ROAM_REST_NEAR = 50;
const ROAM_REST_FAR = 56;

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
  readonly ambient: {
    id: string; group: THREE.Group; phase: number;
    wander: WanderConfig | null;   // ground animals roam this loop
    glide: GlideConfig | null;     // birds sail this overhead orbit
    faceOffset: number;            // per-GLB forward correction (tuned in W3.7)
    recipe: MotionRecipe;          // procedural idle bob (procedural cast only)
    anim: THREE.Group | null;      // the prepped wrapper to drive procedurally
    mixer: THREE.AnimationMixer | null;
    walk: THREE.AnimationAction | null;   // baked stride clip
    graze: THREE.AnimationAction | null;  // baked rest/graze clip
    walkW: number; grazeW: number;        // eased crossfade weights
    h: number;                            // applied canonical stand height (W3.7a)
    rest: FarRest;                        // far off in the fog it rests (not drawn)
  }[] = [];
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

  constructor(env: { scene: THREE.Scene; terrain: Terrain }) {
    this.scene = env.scene;
    this.terrain = env.terrain;
  }

  /** The drawn ground height (the one ground truth, world/Terrain.ts). */
  private groundY(x: number, z: number): number {
    return this.terrain.y(x, z);
  }

  /** Per frame: the scenic actors play their clips and the ambient animals roam /
   *  glide. All SECONDARY motion, so it freezes under reduced-motion. With the lens
   *  (`camera`), a roamer far off in the fog rests. */
  update(t: number, dt: number, reduced: boolean, camera?: THREE.Camera): void {
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
      if (a.wander) {
        if (reduced) { a.mixer?.update(0); continue; }
        const st = wanderAt(a.wander, t);
        a.group.position.set(st.x, this.groundY(st.x, st.z), st.z);
        a.group.rotation.y = st.facing + a.faceOffset;
        if (a.mixer) {
          const k = dampFactor(dt, 0.25); // ease the walk↔graze crossfade (shared factor)
          a.walkW += ((st.moving ? 1 : 0) - a.walkW) * k;
          a.grazeW += ((st.moving ? 0 : 1) - a.grazeW) * k;
          a.walk?.setEffectiveWeight(a.walkW);
          a.graze?.setEffectiveWeight(a.grazeW);
          a.mixer.update(dt);
        } else if (a.anim) {
          const d = motionAt(a.recipe, t, a.phase);
          a.anim.position.set(d.dx, d.dy, 0);
          a.anim.rotation.set(0, d.rotY, d.rotZ);
          a.anim.scale.set(1, d.scaleY, 1);
        }
      } else if (a.glide && !reduced) {
        const st = glideAt(a.glide, t);
        a.group.position.set(st.x, st.y, st.z);
        a.group.rotation.y = st.facing + a.faceOffset;
      }
    }
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
   *  speaks and a small speech mark floats over his head. */
  setWardenTalking(on: boolean): void {
    this.wardenTalking = on;
    if (on) this.wardenQuietS = 0;
    const w = this.scenicActors.find((a) => a.id === 'ranger-warden-boa');
    if (!w) return;
    if (on && !this.speechMark) {
      this.speechMark = Fauna.makeSpeechMark();
      this.speechMark.position.y = w.height + 0.34;
      w.group.add(this.speechMark);
    }
    if (this.speechMark) this.speechMark.visible = on;
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
      { id: 'animal-ree-roedeer', hx: 26, hz: 26, r: 6, baked: true },   // bos/heide edge
      { id: 'animal-vos-fox', hx: -30, hz: -10, r: 7, baked: true },     // heide, west
      { id: 'animal-eekhoorn-squirrel', hx: -24, hz: -24, r: 3, baked: false }, // near trees
      { id: 'animal-wildzwijn-boar', hx: 10, hz: 36, r: 6, baked: false },     // heide, south
    ];
    GROUND.forEach((a, i) => {
      const h = standHeightFor(a.id) ?? 0.9; // the scale table (AnimalScale)
      const wander: WanderConfig = {
        homeX: a.hx, homeZ: a.hz, radius: a.r,
        period: 22 + i * 4,          // each roams at a slightly different pace
        phase: (i * 0.27) % 1,       // desync the loops
        angle: i * 1.1,              // rotate each loop differently
      };
      const group = new THREE.Group();
      group.position.set(a.hx, this.groundY(a.hx, a.hz), a.hz);
      this.scene.add(group);
      this.addBlobShadow(group, Math.max(0.35, h * 0.7)); // W4.5: blob under each roamer
      const entry = {
        id: a.id, group, phase: i * 1.7,
        wander, glide: null as GlideConfig | null, faceOffset: 0,
        recipe: gaitFor(a.id),
        anim: null as THREE.Group | null, mixer: null as THREE.AnimationMixer | null,
        walk: null as THREE.AnimationAction | null, graze: null as THREE.AnimationAction | null,
        walkW: 0, grazeW: 1, h, rest: new FarRest(ROAM_REST_NEAR, ROAM_REST_FAR),
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
        if (a.baked && rig.clips.length) {
          // crossfade the baked walk (striding) against graze (paused) by `moving`;
          // both play from frame one, weights eased each frame in update().
          const mixer = new THREE.AnimationMixer(prepped);
          const walkClip = rig.clips.find((c) => /walk/i.test(c.name)) ?? rig.clips[0];
          const grazeClip = rig.clips.find((c) => /graze|eat|idle|rest/i.test(c.name)) ?? rig.clips[0];
          entry.walk = mixer.clipAction(walkClip); entry.walk.play(); entry.walk.setEffectiveWeight(0);
          entry.graze = mixer.clipAction(grazeClip); entry.graze.play(); entry.graze.setEffectiveWeight(1);
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
      const entry = {
        id: b.id, group, phase: i * 2.1,
        wander: null as WanderConfig | null, glide, faceOffset: 0,
        recipe: gaitFor(b.id),
        anim: null as THREE.Group | null, mixer: null as THREE.AnimationMixer | null,
        walk: null as THREE.AnimationAction | null, graze: null as THREE.AnimationAction | null,
        walkW: 0, grazeW: 0, h: b.h, rest: new FarRest(ROAM_REST_NEAR, ROAM_REST_FAR),
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
  ambientState(): { id: string; x: number; z: number; h: number; clip: { name: string; time: number } | null }[] {
    return this.ambient.map((a) => {
      const dom = a.mixer ? (a.walkW >= a.grazeW ? a.walk : a.graze) : null;
      return {
        id: a.id, x: a.group.position.x, z: a.group.position.z,
        h: a.h, // applied canonical stand height (W3.7a) — E2E asserts the live ordering
        clip: dom ? { name: dom.getClip().name, time: dom.time } : null,
      };
    });
  }

  /** W5.2: distance to the nearest wandering ground animal from a world point
   *  (birds glide overhead → excluded). `Infinity` when none roam. */
  nearestAnimalDist(x: number, z: number): number {
    let best = Infinity;
    for (const a of this.ambient) {
      if (!a.wander) continue;
      const d = Math.hypot(a.group.position.x - x, a.group.position.z - z);
      if (d < best) best = d;
    }
    return best;
  }
}
