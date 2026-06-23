/**
 * World.ts — the explorable 3D Veluwe (BUILD-PLAN §4). A procedural heath/forest
 * (instanced pines + heather to stay well under the draw-call budget), the real
 * generated ranger you walk around, and one animal "marker" per mission. Tap the
 * ground to walk; tap an animal (or walk up to it) to start that mission.
 *
 * Render layer only — it drives the spine through the onApproach callback and
 * holds no game logic. Camera follows the §1e spec: fixed FOV, exponentially
 * damped follow, roll=0 always, no shake / head-bob / snap-rotate. Under
 * reduced-motion the follow cuts instead of damping and idle motion is off.
 * Every asset is best-effort — missing models fall back to procedural stand-ins.
 */

import * as THREE from 'three';
import { prefersReducedMotion } from '../core/reduced-motion';
import { livePolicy } from './MotionMode';
import {
  BIOME_PALETTE, VEN_CENTER, WATER_LEVEL,
  anchorInBiome, biomeAt, heightAt, type Biome,
} from './Biomes';
import { loadManifest, loadModel, loadRig, prepModel } from './Models';
import { applyEyes } from './EyeMaterial';
import { applyFace } from './FaceRig';
import { applyCalmPose } from './CalmPoseRig';
import { gaitFor, motionAt, REST, type MotionRecipe } from './ProceduralMotion';
import { resolveMove, type MoveLimits, type Obstacle } from './CharacterController';
import { wayfind, type WayCue } from './Wayfinding';
import type { WorldCtx } from './play/types';
import { dampFactor } from './play/kit-math';

export interface WorldMarker {
  missionId: string;
  titel: string;
  modelId: string | null;   // generated GLB id, or null → procedural totem
  height: number;           // target world height for the model
  color: string;            // totem / accent colour
  biome?: Biome;            // the mission's landschap → anchor the marker in it
}

const SKY_TOP = '#fde8c8', SKY_MID = '#f6cf9e', SKY_LOW = '#e9b27f';

export class World {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 240);

  private readonly ranger = new THREE.Group();
  private readonly target = new THREE.Vector3(0, 0, 0);
  private readonly camDesired = new THREE.Vector3();
  private readonly camOffset = new THREE.Vector3(0, 3.4, 6.2); // gentle behind-above
  private readonly markers: {
    group: THREE.Group; pos: THREE.Vector3; missionId: string;
    recipe: MotionRecipe; phase: number;
    anim: THREE.Group | null;          // the prepped model wrapper to drive procedurally
    mixer: THREE.AnimationMixer | null; // set instead when a real animated GLB is staged
  }[] = [];
  private activeId: string | null = null;     // the mission the wayfinding cue points to
  private readonly onWayfind: (cue: WayCue | null) => void;
  private lastWayKey = '';                     // debounce identical cues (no DOM churn)
  private readonly raycaster = new THREE.Raycaster();
  private readonly ground: THREE.Mesh;
  private readonly canvas: HTMLCanvasElement;
  private readonly onApproach: (missionId: string | null) => void;
  private readonly onBiome: (biome: Biome) => void;
  private lastBiome: Biome | null = null;       // re-pick the ambience bed on a crossing
  private nearId: string | null = null;
  private speed = 2.4;
  // while a diegetic mini-game plays IN-PLACE, the world stays loaded but freezes:
  // movement, walk-taps, proximity, wayfinding and the §1e follow all pause so the
  // activity's reframe owns the camera (it restores on endActivity).
  private activityActive = false;

  // soft-collision blockers (pine trunks) + the kinematic move limits — the
  // ranger slides around trees, can't wade into the ven, can't leave the world.
  private readonly obstacles: Obstacle[] = [];
  private readonly limits: MoveLimits = {
    bound: 116,                                  // ground plane is 240² → rim ~120
    // off-limits = the submerged ven only (inside the water disc AND below the
    // surface) — NOT a global height test, so dry relief troughs stay walkable.
    blocked: (x, z) => {
      const dx = x - VEN_CENTER.x, dz = z - VEN_CENTER.z;
      return dx * dx + dz * dz < 18 * 18 && heightAt(x, z) < WATER_LEVEL + 0.15;
    },
  };

  constructor(
    canvas: HTMLCanvasElement,
    markers: WorldMarker[],
    onApproach: (missionId: string | null) => void,
    onWayfind: (cue: WayCue | null) => void = () => {},
    activeId: string | null = null,
    onBiome: (biome: Biome) => void = () => {},
  ) {
    this.canvas = canvas;
    this.onApproach = onApproach;
    this.onWayfind = onWayfind;
    this.onBiome = onBiome;
    this.activeId = activeId;

    this.scene.background = this.skyTexture();
    this.scene.fog = new THREE.Fog(new THREE.Color(SKY_LOW), 22, 90);

    this.scene.add(new THREE.HemisphereLight(0xfde8c8, 0x6d8a45, 0.95));
    const sun = new THREE.DirectionalLight(0xffe6b0, 1.5);
    sun.position.set(-8, 7, 5);
    this.scene.add(sun);

    this.ground = this.buildGround();
    this.scene.add(this.ground);
    this.scene.add(this.buildVenWater());
    this.scatterPines(80);
    this.scatterHeather(150);
    this.scatterMarram(110);
    this.scatterReeds(90);

    // ranger: procedural stand-in first (instant), real model swaps in when loaded
    this.ranger.add(this.proceduralRanger());
    this.scene.add(this.ranger);

    this.camera.up.set(0, 1, 0);
    this.placeCamera(true);

    this.placeMarkers(markers);
    void this.loadRealRanger();

    canvas.addEventListener('pointerdown', this.onPointer);
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
    // continuous biome relief (Biomes.heightAt) + per-vertex biome tint so heide
    // fades into bos / stuifzand / ven with no seam. One draw call (vertexColors).
    const geo = new THREE.PlaneGeometry(240, 240, 96, 96);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i); // plane is XY before the -90° tilt → world z = y
      pos.setZ(i, this.groundY(x, y));
      c.set(BIOME_PALETTE[biomeAt(x, y)].ground);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }

  /** A calm still-water plane filling the ven basin (no waves — motion-comfort §1e). */
  private buildVenWater(): THREE.Mesh {
    const geo = new THREE.CircleGeometry(20, 40);
    const mat = new THREE.MeshStandardMaterial({
      color: '#4a6b78', roughness: 0.35, metalness: 0.1, transparent: true, opacity: 0.82,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(VEN_CENTER.x, WATER_LEVEL, VEN_CENTER.z);
    return mesh;
  }

  /** sample ground height at world x,z (delegates to the pure biome field). */
  private groundY(x: number, z: number): number {
    return heightAt(x, z);
  }

  /**
   * Deterministic golden-angle candidate positions over the world, kept only where
   * they fall in the wanted biome (so each landschap grows its own vegetation) and
   * outside the lodge clearing. Returns the surviving (x,z) — fully reproducible.
   */
  private candidates(count: number, want: Biome): { x: number; z: number; i: number }[] {
    const out: { x: number; z: number; i: number }[] = [];
    for (let i = 0; i < count; i++) {
      const ang = i * 2.39996; // golden angle
      const rad = 12 + (i / count) * 100;
      const x = Math.cos(ang) * rad + Math.sin(i * 12.9) * 6;
      const z = Math.sin(ang) * rad + Math.cos(i * 7.3) * 6;
      if (Math.hypot(x, z) < 12) continue;        // clearing
      if (biomeAt(x, z) !== want) continue;        // wrong landschap
      out.push({ x, z, i });
    }
    return out;
  }

  private scatterPines(budget: number): void {
    const spots = this.candidates(budget * 4, 'bos');
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1.2, 6);
    const crownGeo = new THREE.ConeGeometry(0.95, 2.4, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#5b4327', roughness: 1 });
    const crownMat = new THREE.MeshStandardMaterial({ color: BIOME_PALETTE.bos.ground, roughness: 1 });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, spots.length);
    const m = new THREE.Matrix4();
    spots.forEach(({ x, z, i }, k) => {
      const s = 0.8 + (i % 5) * 0.12;
      const y = this.groundY(x, z);
      m.makeScale(s, s, s); m.setPosition(x, y + 0.6 * s, z); trunks.setMatrixAt(k, m);
      m.makeScale(s, s, s); m.setPosition(x, y + 1.9 * s, z); crowns.setMatrixAt(k, m);
      // a soft collision circle around each trunk (the ranger slides around it)
      this.obstacles.push({ x, z, r: 0.6 * s });
    });
    trunks.instanceMatrix.needsUpdate = true; crowns.instanceMatrix.needsUpdate = true;
    this.scene.add(trunks, crowns);
  }

  private scatterHeather(budget: number): void {
    const spots = this.candidates(budget * 3, 'heide');
    const geo = new THREE.IcosahedronGeometry(0.32, 0);
    const mat = new THREE.MeshStandardMaterial({ color: BIOME_PALETTE.heide.accent, roughness: 1, flatShading: true });
    const tufts = new THREE.InstancedMesh(geo, mat, spots.length);
    const m = new THREE.Matrix4();
    spots.forEach(({ x, z, i }, k) => {
      const s = 0.5 + (i % 4) * 0.22;
      m.makeScale(s, s * 0.6, s); m.setPosition(x, this.groundY(x, z) + 0.12, z);
      tufts.setMatrixAt(k, m);
    });
    tufts.instanceMatrix.needsUpdate = true;
    this.scene.add(tufts);
  }

  /** Drift-sand marram tussocks — upright pale grass blades on the stuifzand. */
  private scatterMarram(budget: number): void {
    const spots = this.candidates(budget * 4, 'stuifzand');
    const geo = new THREE.ConeGeometry(0.16, 0.9, 5);
    const mat = new THREE.MeshStandardMaterial({ color: BIOME_PALETTE.stuifzand.accent, roughness: 1, flatShading: true });
    const grass = new THREE.InstancedMesh(geo, mat, spots.length);
    const m = new THREE.Matrix4();
    spots.forEach(({ x, z, i }, k) => {
      const s = 0.6 + (i % 3) * 0.25;
      m.makeScale(s, s, s); m.setPosition(x, this.groundY(x, z) + 0.4 * s, z);
      grass.setMatrixAt(k, m);
    });
    grass.instanceMatrix.needsUpdate = true;
    this.scene.add(grass);
  }

  /** Reed clumps fringing the ven — only on land just above the waterline. */
  private scatterReeds(budget: number): void {
    const spots = this.candidates(budget * 6, 'ven').filter(({ x, z }) => {
      const y = this.groundY(x, z);
      return y > WATER_LEVEL - 0.1 && y < WATER_LEVEL + 1.1; // a reed belt at the shore
    });
    const geo = new THREE.CylinderGeometry(0.04, 0.06, 1.1, 5);
    const mat = new THREE.MeshStandardMaterial({ color: '#8f8a4a', roughness: 1 });
    const reeds = new THREE.InstancedMesh(geo, mat, Math.max(1, spots.length));
    const m = new THREE.Matrix4();
    spots.forEach(({ x, z, i }, k) => {
      const s = 0.7 + (i % 4) * 0.2;
      m.makeScale(s, s, s); m.setPosition(x, this.groundY(x, z) + 0.55 * s, z);
      reeds.setMatrixAt(k, m);
    });
    reeds.count = spots.length;
    reeds.instanceMatrix.needsUpdate = true;
    this.scene.add(reeds);
  }

  private proceduralRanger(): THREE.Group {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: '#3f7a3a', roughness: 1 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.6, 4, 8), mat);
    body.position.y = 0.7;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshStandardMaterial({ color: '#e8c39a', roughness: 1 }));
    head.position.y = 1.32;
    g.add(body, head);
    return g;
  }

  private async loadRealRanger(): Promise<void> {
    await loadManifest();
    const model = await loadModel('ranger-alvah');
    if (!model) return;
    const prepped = prepModel(model, 1.25);
    // §1e eye system: bright, alive eyes (the golden-hour world is not dusk, so
    // eyeshine stays off; parallax freezes under reduced-motion).
    applyEyes(prepped, 'ranger-alvah', { dusk: false }); // parallax reads the live policy (no restart)
    // §A ARKit face: data-driven emotion + always-alive blink/microsaccade. The
    // child ranger blinks at the lower child rate. Best-effort — a humanoid GLB with
    // no ARKit blendshape rig (the Meshy mesh today) is left untouched, never throws.
    // Expression + blink are essential motion, so they stay on under reduced-motion.
    applyFace(prepped, { emotion: 'neutral', child: true }); // microsaccade reads the live policy (no restart)
    this.ranger.clear();
    this.ranger.add(prepped);
  }

  private placeMarkers(markers: WorldMarker[]): void {
    const N = Math.max(1, markers.length);
    const perBiome = new Map<Biome, number>();
    markers.forEach((mk, i) => {
      let x: number, z: number;
      if (mk.biome) {
        // anchor each mission in the heart of its own landschap; fan repeats outward
        const n = perBiome.get(mk.biome) ?? 0;
        perBiome.set(mk.biome, n + 1);
        const a = anchorInBiome(mk.biome, 22 + n * 9);
        x = a.x; z = a.z;
      } else {
        const ang = (i / N) * Math.PI * 2;
        x = Math.cos(ang) * 9; z = Math.sin(ang) * 9;
      }
      const group = new THREE.Group();
      group.position.set(x, this.groundY(x, z), z);

      // a soft halo ring so every marker reads as "go here", model or totem
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1.15, 24),
        new THREE.MeshBasicMaterial({ color: mk.color, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      group.add(ring);

      // a small diegetic name-tag floating above the marker (in-world label, no
      // minimap chrome) — a camera-facing sprite so it stays readable from any angle
      const label = this.makeLabel(mk.titel, mk.color);
      label.position.y = 1.9;
      group.add(label);

      group.add(this.proceduralTotem(mk.color)); // instant stand-in
      this.scene.add(group);
      const entry = {
        group, pos: group.position.clone(), missionId: mk.missionId,
        recipe: gaitFor(mk.modelId), phase: i * 1.7,
        anim: null as THREE.Group | null, mixer: null as THREE.AnimationMixer | null,
      };
      this.markers.push(entry);

      if (mk.modelId) {
        void loadRig(mk.modelId).then((rig) => {
          if (!rig) return;
          const prepped = prepModel(rig.group, mk.height);
          // §1e eye system per species (catchlight + clearcoat cornea + pupil +
          // iris parallax); golden-hour world ⇒ dusk off (eyeshine stays calm).
          applyEyes(prepped, mk.modelId, { dusk: false }); // parallax reads the live policy (no restart)
          // §B never-scary calm-pose: a static rest-pose bias (ears/tail/head into the
          // calm shape). Best-effort — a single-mesh Meshy animal with no named bones is
          // left untouched. Not motion (one-time nudge), so reduced-motion does not apply.
          applyCalmPose(prepped, mk.modelId);
          // drop the totem (keep the ring), add the real animal
          const totem = group.children.find((c) => c.userData.totem);
          if (totem) group.remove(totem);
          group.add(prepped);
          if (rig.clips.length) {
            // prefer the real baked rig: play a calm idle (or the first clip)
            const mixer = new THREE.AnimationMixer(prepped);
            const idle = rig.clips.find((c) => /idle|rest|stand|breath/i.test(c.name)) ?? rig.clips[0];
            mixer.clipAction(idle).play();
            entry.mixer = mixer;
          } else {
            // no rig → the always-on procedural fallback drives this wrapper
            entry.anim = prepped;
          }
        });
      }
    });
  }

  /** A camera-facing sprite name-tag (rounded warm card + the mission title). */
  private makeLabel(text: string, color: string): THREE.Sprite {
    const pad = 24, fontPx = 44;
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d')!;
    ctx.font = `600 ${fontPx}px Inter, system-ui, sans-serif`;
    const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
    const h = fontPx + pad * 2;
    c.width = w; c.height = h;
    // rounded warm card
    const r = 22;
    ctx.fillStyle = 'rgba(40, 30, 18, 0.78)';
    ctx.beginPath();
    ctx.moveTo(r, 0); ctx.arcTo(w, 0, w, h, r); ctx.arcTo(w, h, 0, h, r);
    ctx.arcTo(0, h, 0, 0, r); ctx.arcTo(0, 0, w, 0, r); ctx.closePath(); ctx.fill();
    // a colour pip + the title (dual-channel: colour + word)
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(pad + 10, h / 2, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fdf6e8';
    ctx.font = `600 ${fontPx}px Inter, system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, pad + 34, h / 2 + 2);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    const scale = 0.0042; // world units per px → ~legible without dominating
    sprite.scale.set(w * scale, h * scale, 1);
    return sprite;
  }

  /** Re-point the wayfinding cue at another mission (e.g. after one is completed). */
  setActiveMission(id: string | null): void {
    this.activeId = id;
    this.lastWayKey = '';
  }

  /** The live `richting` phrase (relative to facing) toward a mission marker, for
   *  the world-EF "welke kant?" recall beat — `null` if the marker is unknown.
   *  Synchronous so the beat can score against the true bearing at fire time. */
  headingTo(id: string | null): string | null {
    if (!id) return null;
    const goal = this.markers.find((m) => m.missionId === id);
    if (!goal) return null;
    const rp = this.ranger.position;
    return wayfind(rp.x, rp.z, this.ranger.rotation.y, goal.pos.x, goal.pos.z).richting;
  }

  private proceduralTotem(color: string): THREE.Group {
    const g = new THREE.Group();
    g.userData.totem = true;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1, 6), new THREE.MeshStandardMaterial({ color: '#6b513a', roughness: 1 }));
    post.position.y = 0.5;
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), new THREE.MeshStandardMaterial({ color, roughness: 0.6, emissive: new THREE.Color(color), emissiveIntensity: 0.25 }));
    orb.position.y = 1.2;
    g.add(post, orb);
    return g;
  }

  // ---- input ----
  private onPointer = (e: PointerEvent): void => {
    if (this.activityActive) return; // the activity's own pick3d owns taps in-place
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);

    // 1) a tapped marker → walk over to it (proximity then offers "Speel mee")
    for (const mk of this.markers) {
      const hit = this.raycaster.intersectObject(mk.group, true);
      if (hit.length) {
        const dir = new THREE.Vector3(mk.pos.x, 0, mk.pos.z).sub(new THREE.Vector3(this.ranger.position.x, 0, this.ranger.position.z));
        if (dir.lengthSq() > 0.001) dir.normalize();
        this.target.set(mk.pos.x - dir.x * 1.6, 0, mk.pos.z - dir.z * 1.6); // stop just in front
        return;
      }
    }
    // 2) otherwise walk to the tapped ground point
    const g = this.raycaster.intersectObject(this.ground, false);
    if (g.length) {
      const p = g[0].point;
      this.target.set(p.x, 0, p.z);
    }
  };

  // ---- per-frame ----
  update(dt: number, t: number): void {
    // the §1e mode, read LIVE each frame from the single policy authority (no restart):
    // camera follow stops lagging (cuts), secondary animal motion freezes to rest.
    const reduced = livePolicy().reduced;

    // move the ranger toward the walk target — the desired straight step is then
    // resolved by the kinematic controller (slide around pines, stay out of the
    // ven, stay inside the world). Facing follows the ACTUAL motion so the ranger
    // turns naturally when a collision slides them sideways. Frozen during an
    // in-place activity (the mini-game holds the scene + drives the camera itself).
    const rp = this.ranger.position;
    if (!this.activityActive) {
      const dx = this.target.x - rp.x, dz = this.target.z - rp.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.06) {
        const step = Math.min(this.speed * dt, dist);
        const wantX = rp.x + (dx / dist) * step;
        const wantZ = rp.z + (dz / dist) * step;
        const next = resolveMove(rp.x, rp.z, wantX, wantZ, this.obstacles, this.limits);
        const mx = next.x - rp.x, mz = next.z - rp.z;
        if (mx * mx + mz * mz > 1e-7) this.ranger.rotation.y = Math.atan2(mx, mz);
        rp.x = next.x;
        rp.z = next.z;
      }
      rp.y = this.groundY(rp.x, rp.z);

      // ambience follows the ranger across biomes — re-pick the bed on a crossing
      const here = biomeAt(rp.x, rp.z);
      if (here !== this.lastBiome) { this.lastBiome = here; this.onBiome(here); }
    }

    // per-animal motion: a real baked rig wins (mixer); else the always-on
    // procedural fallback (gentle, never-scary, calm-pose gated). Both are
    // secondary motion, so reduced-motion freezes them at the rest pose.
    for (const mk of this.markers) {
      if (mk.mixer) {
        mk.mixer.update(reduced ? 0 : dt);
      } else if (mk.anim) {
        const d = reduced ? REST : motionAt(mk.recipe, t, mk.phase);
        mk.anim.position.set(d.dx, d.dy, 0);
        mk.anim.rotation.set(0, d.rotY, d.rotZ);
        mk.anim.scale.set(1, d.scaleY, 1);
      }
    }

    if (this.activityActive) return; // the activity owns proximity/wayfinding/camera

    // proximity → surface the "play" affordance (debounced by id)
    let near: string | null = null;
    for (const mk of this.markers) {
      if (Math.hypot(mk.pos.x - rp.x, mk.pos.z - rp.z) < 2.4) { near = mk.missionId; break; }
    }
    if (near !== this.nearId) { this.nearId = near; this.onApproach(near); }

    // wayfinding cue to the active mission — calm direction + distance, no minimap.
    // Debounced so the diegetic HUD only re-renders when the words actually change.
    const goal = this.activeId ? this.markers.find((m) => m.missionId === this.activeId) : null;
    if (goal) {
      const cue = wayfind(rp.x, rp.z, this.ranger.rotation.y, goal.pos.x, goal.pos.z);
      const key = `${cue.glyph}|${cue.richting}|${cue.afstand}`;
      if (key !== this.lastWayKey) { this.lastWayKey = key; this.onWayfind(cue); }
    } else if (this.lastWayKey !== '') {
      this.lastWayKey = ''; this.onWayfind(null);
    }

    this.placeCamera(reduced, dt);
  }

  /**
   * Build the live `WorldCtx` an in-place 3D mini-game renders into (3D-IMMERSION
   * §2). The activity anchors on the marker the ranger walked up to (`nearId`), or
   * the ranger's own spot if free-standing. The view reframes + restores the camera
   * and raycasts against this scene — it never tears the world down.
   */
  ctx(prompt: HTMLElement): WorldCtx {
    const near = this.nearId ? this.markers.find((m) => m.missionId === this.nearId) : null;
    const spot = near ? near.pos : this.ranger.position;
    return {
      scene: this.scene,
      camera: this.camera,
      cameraRig: this.camera, // the §1e follow drives the camera directly (no separate rig)
      approachedModel: near ? near.group : null,
      activitySpot: { x: spot.x, y: spot.y, z: spot.z },
      raycaster: this.raycaster,
      canvas: this.canvas,
      prompt,
      reducedMotion: prefersReducedMotion(),
    };
  }

  /** Freeze the world for an in-place activity (the mini-game owns input + camera). */
  beginActivity(): void { this.activityActive = true; }

  /** Resume free-roam after an in-place activity; re-emit the wayfinding cue. */
  endActivity(): void {
    this.activityActive = false;
    this.nearId = null;
    this.lastWayKey = '';
    this.placeCamera(true); // snap the §1e follow back behind the ranger
  }

  private placeCamera(snap: boolean, dt = 0): void {
    const rp = this.ranger.position;
    this.camDesired.set(rp.x + this.camOffset.x, rp.y + this.camOffset.y, rp.z + this.camOffset.z);
    if (snap) {
      this.camera.position.copy(this.camDesired);
    } else {
      // exp-damping (~0.3 s) off the REAL frame dt → genuinely frame-rate independent
      // (§C.5 item 2: identical feel at 30/60/120 fps), no shake. Shared dampFactor.
      this.camera.position.lerp(this.camDesired, dampFactor(dt, 0.3));
    }
    this.camera.up.set(0, 1, 0); // roll = 0 always
    this.camera.lookAt(rp.x, rp.y + 1.0, rp.z);
  }
}
