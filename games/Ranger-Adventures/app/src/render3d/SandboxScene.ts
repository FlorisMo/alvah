/**
 * SandboxScene.ts — the render layer for the compact Demo Sandbox (DEMO-SANDBOX.md
 * Tier 2; BUILD-PLAN §5 / §8d.7; ledger 75b). A single small "ranger-station
 * showroom" clearing that holds the ranger at its centre, every staged cast member
 * calm-posed on concentric rings, and one trigger per interaction on the inner ring,
 * all reachable in a couple of seconds, with an instant ≥56px dual-channel jump-menu.
 *
 * The *placement geometry* is the pure `sandboxLayout` core (Sandbox.ts, unit-tested);
 * this module realises it in THREE and is a drop-in for `Stage.enterWorld` (it exposes
 * `{ scene, camera, update(dt,t) }`). It reuses the live asset path — `Models`/`CalmPose`/
 * `EyeMaterial`, the "prefer animated GLB over procedural" hook (`loadRig`), and the
 * `ProceduralMotion` fallback — so the sandbox always reflects later Phase 5/6 polish.
 *
 * 75b-i (this pass): the scene + cast + tap-to-frame + the real call + the jump-menu
 * camera tour. The EF activity triggers (driving the live diegetic engines via a
 * sandbox `WorldCtx`) + the meta interactions land in 75b-ii / 75c — their inner-ring
 * posts already render here so the jump-menu covers every target.
 *
 * Motion-comfort (§1e): fixed FOV, roll=0 always, no shake; the jump reframe is the
 * exp-damped `makeReframe` (cuts under reduced-motion); secondary cast motion freezes
 * to the calm rest pose under reduced-motion. Everything is best-effort — a missing
 * model falls back to a procedural stand-in so the demo never breaks.
 */

import * as THREE from 'three';
import { prefersReducedMotion } from '../core/reduced-motion';
import { loadManifest, loadRig, prepModel } from './Models';
import { applyEyes } from './EyeMaterial';
import { applyCalmPose } from './CalmPoseRig';
import { gaitFor, motionAt, REST, type MotionRecipe } from './ProceduralMotion';
import { makeReframe } from './play/kit';
import { Sound } from '../core/sound';
import type { WorldCtx } from './play/types';
import {
  sandboxLayout, castCallKey,
  type SandboxInteraction, type SandboxPlacement, type SandboxLayout, type SandboxKind,
} from './Sandbox';

const SKY_TOP = '#fde8c8', SKY_MID = '#f6cf9e', SKY_LOW = '#e9b27f';

/** the resting "showroom" camera pose the demo returns to after an activity. */
const OVERVIEW_POS = new THREE.Vector3(0, 7.5, 15);
const OVERVIEW_LOOK = new THREE.Vector3(0, 0.8, 0);

/** The interaction set the sandbox exposes a trigger for (5 EF + 6 meta beats). */
export const SANDBOX_INTERACTIONS: SandboxInteraction[] = [
  { id: 'zoeken', kind: 'ef', label: 'Spoor zoeken' },
  { id: 'corsi', kind: 'ef', label: 'Onthoud de plekken' },
  { id: 'simon', kind: 'ef', label: 'Luister en herhaal' },
  { id: 'dagnacht', kind: 'ef', label: 'Dag of nacht' },
  { id: 'wisselen', kind: 'ef', label: 'Wissel de regel' },
  { id: 'companion', kind: 'meta', label: 'Verzorg je maatje' },
  { id: 'caseboard', kind: 'meta', label: 'Het prikbord' },
  { id: 'avatar', kind: 'meta', label: 'Maak je ranger' },
  { id: 'badge', kind: 'meta', label: 'Breinkracht-badge' },
  { id: 'fact', kind: 'meta', label: 'Wist je dat' },
  { id: 'arc', kind: 'meta', label: 'Het verhaal' },
];

/** kind → a calm accent colour (dual-channel pip in the jump-menu + the trigger post). */
const KIND_COLOR: Record<string, string> = {
  ranger: '#6b8e5a', ef: '#f5c23b', meta: '#7a9bd1', cast: '#cdb892',
};

interface CastEntry {
  id: string;
  group: THREE.Group;        // the placement group (ring + label + model)
  holder: THREE.Group;       // the model wrapper the procedural fallback drives
  pos: THREE.Vector3;
  callKey: string;
  recipe: MotionRecipe;
  phase: number;
  anim: THREE.Group | null;
  mixer: THREE.AnimationMixer | null;
}

export class SandboxScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);

  /** the realised placement layout — rebuilt with the real cast once the manifest loads. */
  layout: SandboxLayout;
  private readonly canvas: HTMLCanvasElement;
  private readonly cast: CastEntry[] = [];
  /** the inner-ring interaction posts (EF + meta) — raycast for in-world taps. */
  private readonly triggers: { id: string; kind: SandboxKind; group: THREE.Group; pos: THREE.Vector3 }[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private reframe: { update: (dt: number) => boolean } | null = null;
  private focusId: string | null = null;
  /** true while an in-place activity owns the camera + taps (freeze free-roam input). */
  private activityActive = false;
  private readonly rangerId: string;
  /** fired once the manifest resolves + the final cast layout is realised. */
  private readonly onReady: (layout: SandboxLayout) => void;
  /** fired when an inner-ring interaction post is tapped in-world (UI launches it). */
  private readonly onTrigger: (id: string, kind: SandboxKind) => void;

  constructor(
    canvas: HTMLCanvasElement,
    ranger = 'ranger-alvah',
    onReady: (layout: SandboxLayout) => void = () => {},
    onTrigger: (id: string, kind: SandboxKind) => void = () => {},
  ) {
    this.canvas = canvas;
    this.rangerId = ranger;
    this.onReady = onReady;
    this.onTrigger = onTrigger;
    this.layout = sandboxLayout({
      ranger,
      cast: [],               // filled async from the manifest in load()
      interactions: SANDBOX_INTERACTIONS,
    });

    this.scene.background = this.skyTexture();
    this.scene.fog = new THREE.Fog(new THREE.Color(SKY_LOW), 26, 80);
    this.scene.add(new THREE.HemisphereLight(0xfde8c8, 0x6d8a45, 1.0));
    const sun = new THREE.DirectionalLight(0xffe6b0, 1.4);
    sun.position.set(-7, 9, 6);
    this.scene.add(sun);
    this.scene.add(this.buildGround());

    this.camera.up.set(0, 1, 0);
    this.camera.position.set(0, 7.5, 15);
    this.camera.lookAt(0, 0.8, 0);

    canvas.addEventListener('pointerdown', this.onPointer);
    void this.load(ranger);
  }

  dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointer);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
  }

  // ---- build ----
  private skyTexture(): THREE.Texture {
    const c = document.createElement('canvas');
    c.width = 2; c.height = 256;
    const ctx = c.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, SKY_TOP); g.addColorStop(0.55, SKY_MID); g.addColorStop(1, SKY_LOW);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 2, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private buildGround(): THREE.Mesh {
    // a small flat warm clearing — the sandbox is compact + level (no biome relief).
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(60, 48),
      new THREE.MeshStandardMaterial({ color: '#b9b07e', roughness: 1, metalness: 0 }),
    );
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }

  /**
   * Pick the cast from the staged manifest (every humanoid/animal/bird except the
   * ranger), rebuild the layout with the real cast, then realise each placement.
   */
  private async load(ranger: string): Promise<void> {
    const manifest = await loadManifest();
    const cast = Object.keys(manifest)
      .filter((id) => id !== ranger && /^(human|animal|bird)$/.test(manifest[id].category))
      .sort();

    const layout = sandboxLayout({ ranger, cast, interactions: SANDBOX_INTERACTIONS });
    this.layout = layout;

    for (const p of layout.placements) {
      if (p.kind === 'ranger') this.placeRanger(p);
      else if (p.kind === 'cast') this.placeCast(p);
      else this.placeTrigger(p); // ef / meta inner-ring posts (wired in 75b-ii / 75c)
    }
    this.onReady(layout);
  }

  private placeRanger(p: SandboxPlacement): void {
    const group = new THREE.Group();
    group.position.set(p.x, 0, p.z);
    group.rotation.y = p.facing;
    group.add(this.stand(KIND_COLOR.ranger));
    this.scene.add(group);
    const holder = group;
    const entry: CastEntry = {
      id: p.id, group, holder, pos: group.position.clone(),
      callKey: castCallKey(p.id), recipe: gaitFor(null), phase: 0,
      anim: null, mixer: null,
    };
    this.cast.push(entry);
    void loadRig(p.id).then((rig) => {
      if (!rig) return;
      const prepped = prepModel(rig.group, 1.25);
      applyEyes(prepped, p.id, { dusk: false, reducedMotion: prefersReducedMotion() });
      applyCalmPose(prepped, p.id);
      group.children.find((c) => c.userData.stand)?.removeFromParent();
      group.add(prepped);
      // the ranger stands calm at the station (no procedural bob — matches World); a
      // baked humanoid clip (warden/poacher) still plays via the mixer.
      this.wireMotion(entry, prepped, rig.clips, false);
    });
  }

  private placeCast(p: SandboxPlacement): void {
    const group = new THREE.Group();
    group.position.set(p.x, 0, p.z);
    group.rotation.y = p.facing;
    group.add(this.stand(KIND_COLOR.cast));
    group.userData.castId = p.id;
    this.scene.add(group);

    const entry: CastEntry = {
      id: p.id, group, holder: group, pos: group.position.clone(),
      callKey: castCallKey(p.id), recipe: gaitFor(p.id), phase: p.x * 0.7 + p.z * 0.3,
      anim: null, mixer: null,
    };
    this.cast.push(entry);

    void loadRig(p.id).then((rig) => {
      if (!rig) return;
      // birds read smaller than mammals — a gentle height heuristic from the id.
      const isBird = /raven|nightjar|fledgling|^bird-|merel|mees|specht|vink|gaai|ekster|koekoek|tjiftjaf|lijster|duif|eend|buizerd|haantje|tapuit|leeuwerik|klever|koning|borst/.test(p.id);
      const prepped = prepModel(rig.group, isBird ? 0.5 : 0.9);
      applyEyes(prepped, p.id, { dusk: false, reducedMotion: prefersReducedMotion() });
      applyCalmPose(prepped, p.id);
      group.children.find((c) => c.userData.stand)?.removeFromParent();
      group.add(prepped);
      this.wireMotion(entry, prepped, rig.clips);
    });
  }

  /** Prefer a real baked animation (Anything World rig) → mixer; else the procedural
   *  gait fallback (unless `allowProcedural` is false — the ranger stays calm-still). */
  private wireMotion(
    entry: CastEntry, prepped: THREE.Group, clips: THREE.AnimationClip[], allowProcedural = true,
  ): void {
    entry.holder = prepped;
    if (clips.length) {
      const mixer = new THREE.AnimationMixer(prepped);
      const idle = clips.find((c) => /idle|rest|stand|breath/i.test(c.name)) ?? clips[0];
      mixer.clipAction(idle).play();
      entry.mixer = mixer;
    } else if (allowProcedural) {
      entry.anim = prepped;
    }
  }

  /** An inner-ring interaction trigger — a small diegetic post (a station signpost).
   *  75b-i renders it so the jump-menu can frame it; the tap behaviour lands in
   *  75b-ii (EF → live diegetic engine) / 75c (meta screens). */
  private placeTrigger(p: SandboxPlacement): void {
    const group = new THREE.Group();
    group.position.set(p.x, 0, p.z);
    group.rotation.y = p.facing;
    const color = KIND_COLOR[p.kind] ?? KIND_COLOR.meta;
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 1.1, 6),
      new THREE.MeshStandardMaterial({ color: '#6b513a', roughness: 1 }),
    );
    post.position.y = 0.55;
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.42, 0.06),
      new THREE.MeshStandardMaterial({ color, roughness: 0.8, emissive: new THREE.Color(color), emissiveIntensity: 0.2 }),
    );
    board.position.y = 1.05;
    group.add(post, board);
    group.userData.triggerId = p.id;
    this.scene.add(group);
    this.triggers.push({ id: p.id, kind: p.kind, group, pos: group.position.clone() });
  }

  /** A calm procedural stand-in shown until the real model loads (best-effort). */
  private stand(color: string): THREE.Group {
    const g = new THREE.Group();
    g.userData.stand = true;
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.2, 0.4, 4, 8),
      new THREE.MeshStandardMaterial({ color, roughness: 1 }),
    );
    body.position.y = 0.42;
    g.add(body);
    return g;
  }

  // ---- the jump-menu camera tour ----
  /** §1e-reframe the camera onto a jump target; play its real call if it's a cast member. */
  jumpTo(id: string): void {
    const target = this.layout.placements.find((p) => p.id === id)
      ?? this.layout.jumpTargets.find((t) => t.id === id);
    if (!target) return;
    this.focusId = id;
    const reduced = prefersReducedMotion();
    // camera sits on the clearing-centre side of the target, looking outward at it
    // (the target faces the centre, so we see its front).
    let dx = target.x, dz = target.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-3) { dx = 0; dz = 1; } else { dx /= len; dz /= len; }
    const dist = id === this.layout.placements[0]?.id ? 5.5 : 3.8;
    const to = new THREE.Vector3(target.x - dx * dist, 2.3, target.z - dz * dist);
    const look = new THREE.Vector3(target.x, 0.8, target.z);
    this.reframe = makeReframe(this.camera, to, look, reduced);
    // play the real call for an animal/bird; the ranger has no call to sound.
    const cast = this.cast.find((c) => c.id === id);
    if (cast && cast.id !== this.rangerId) { Sound.unlock(); Sound.call(cast.callKey); }
  }

  // ---- input: tap a cast member → frame it + hear its call; tap an interaction
  //      post → hand off to the UI (EF → live diegetic engine, meta → its screen). ----
  private onPointer = (e: PointerEvent): void => {
    if (this.activityActive) return; // an in-place activity's own pick3d owns taps
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    // interaction posts win over cast (they ring closer to the centre).
    for (const t of this.triggers) {
      if (this.raycaster.intersectObject(t.group, true).length) { this.onTrigger(t.id, t.kind); return; }
    }
    for (const c of this.cast) {
      if (this.raycaster.intersectObject(c.group, true).length) { this.jumpTo(c.id); return; }
    }
  };

  // ---- in-place activity lifecycle (mirrors World.beginActivity/endActivity) ----
  /** The world-space anchor an activity stages around (the interaction post, flat ground). */
  spotOf(id: string): { x: number; y: number; z: number } {
    const t = this.triggers.find((tr) => tr.id === id);
    return { x: t?.pos.x ?? 0, y: 0, z: t?.pos.z ?? 0 };
  }

  /** Build the live `WorldCtx` a diegetic engine variant renders into — the sandbox
   *  scene/camera/raycaster/canvas, the post's spot as the activity anchor, the DOM
   *  `prompt` host for the accessible card. The variant reframes + restores nothing;
   *  `endActivity` returns the camera to the showroom overview. */
  ctx(prompt: HTMLElement, id: string): WorldCtx {
    const t = this.triggers.find((tr) => tr.id === id) ?? null;
    return {
      scene: this.scene,
      camera: this.camera,
      cameraRig: this.camera,
      approachedModel: t ? t.group : null,
      activitySpot: this.spotOf(id),
      raycaster: this.raycaster,
      canvas: this.canvas,
      prompt,
      reducedMotion: prefersReducedMotion(),
    };
  }

  /** Freeze free-roam: the activity's pick3d owns taps + its reframe owns the camera. */
  beginActivity(): void {
    this.activityActive = true;
    this.reframe = null; // drop any in-flight jump so it never fights the activity reframe
  }

  /** Resume the showroom: §1e-glide the camera back to the overview (cuts under reduced-motion). */
  endActivity(): void {
    this.activityActive = false;
    this.reframe = makeReframe(this.camera, OVERVIEW_POS.clone(), OVERVIEW_LOOK.clone(), prefersReducedMotion());
  }

  // ---- per-frame ----
  update(dt: number, t: number): void {
    const reduced = prefersReducedMotion();

    // cast motion: a real baked rig wins (mixer); else the always-on procedural
    // fallback. Both are secondary motion → frozen at REST under reduced-motion.
    for (const c of this.cast) {
      if (c.mixer) {
        c.mixer.update(reduced ? 0 : dt);
      } else if (c.anim) {
        const d = reduced ? REST : motionAt(c.recipe, t, c.phase);
        c.anim.position.set(d.dx, d.dy, 0);
        c.anim.rotation.set(0, d.rotY, d.rotZ);
        c.anim.scale.set(1, d.scaleY, 1);
      }
    }

    // drive an active jump reframe; once settled it releases and the camera holds.
    if (this.reframe && this.reframe.update(dt)) this.reframe = null;
  }

  /** The current focus (for the jump-menu active state). */
  get focused(): string | null { return this.focusId; }
}
