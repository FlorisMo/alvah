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
import { standHeightFor } from './AnimalScale';
import { applyEyes } from './EyeMaterial';
import { applyCoat, applyPosture } from './AnimalDress';
import { applyFace } from './FaceRig';
import { applyCalmPose } from './CalmPoseRig';
import { gaitFor, motionAt, REST, type MotionRecipe } from './ProceduralMotion';
import { glideAt, wanderAt, type GlideConfig, type WanderConfig } from './AmbientPaths';
import { resolveMove, type MoveLimits, type Obstacle } from './CharacterController';
import { resolveInput, type StickVector } from '../core/input';
import { attachInput, type InputHandle } from '../core/attach-input';
import { wayfind, type WayCue } from './Wayfinding';
import type { WorldCtx } from './play/types';
import { dampFactor } from './play/kit-math';
import { dampedYaw, wrapAngle, FIXED_FOLLOW_YAW } from './FollowCam';
import { PlayerRig } from './PlayerRig';

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
  // W1.5 rotating follow-cam: `followYaw` is the eased camera bearing; it chases
  // `followTargetYaw` (the ranger's facing, updated ONLY while he is moving — a
  // standing ranger never swings the camera). Both start at π = straight behind
  // on +z (the pre-W1.5 diorama bearing). Damped + rate-clamped in FollowCam.ts.
  private followYaw = FIXED_FOLLOW_YAW;
  private followTargetYaw = FIXED_FOLLOW_YAW;
  // "Camera draait mee" toggle (Instellingen, default aan), read LIVE each frame
  // so flipping it needs no restart; reduced-motion also forces the fixed bearing.
  private cameraFollowSource: (() => boolean) | null = null;
  private readonly markers: {
    group: THREE.Group; pos: THREE.Vector3; missionId: string;
    recipe: MotionRecipe; phase: number;
    anim: THREE.Group | null;          // the prepped model wrapper to drive procedurally
    mixer: THREE.AnimationMixer | null; // set instead when a real animated GLB is staged
  }[] = [];
  // W3.3 scenic actors: the warden (BOA) + poacher stand at fixed world spots and
  // play their single baked clip via a mixer. They are NOT missions (kept out of
  // `markers`), carry no proximity/collision — purely diegetic set-dressing that
  // brings the story arc into the world. Their clip is SECONDARY motion, so it
  // freezes at the rest pose under reduced-motion (unlike the player's locomotion).
  private readonly scenicActors: {
    id: string; group: THREE.Group;
    mixer: THREE.AnimationMixer | null; action: THREE.AnimationAction | null;
  }[] = [];
  // W3.6 ambient wildlife: a few animals roam gentle wander loops (baked walk↔graze
  // clips via the mixer for the W3.5-staged cast, improved procedural bob elsewhere)
  // and two birds glide overhead on spline loops. All are pure set-dressing — no
  // markers, no collision, kept out of `markers`. Their motion is SECONDARY, so it
  // freezes at the rest pose under reduced-motion (like the animals + scenic actors).
  private readonly ambient: {
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
  }[] = [];
  // W4.1 landmark props: the fixed wayfinding beacons (watchtower, ecoduct,
  // bird-hide, BOA post, signposts) placed per §4. Each is set-dressing with a
  // solid collision circle; the named ones carry a floating diegetic label so
  // they read as "over there" beacons. Kept out of `markers` (no proximity /
  // mission). Their world x/z is exposed through the dev hook for E2E navigation.
  private readonly landmarks: { id: string; x: number; z: number }[] = [];
  // W4.2 nature dressing: real tree/rock/mushroom/reed GLBs clustered near the
  // POIs and biome cores, on top of the instanced-primitive background filler.
  // Their world x/z is exposed through the dev hook so the E2E can assert them.
  private readonly dressing: { id: string; x: number; z: number }[] = [];
  private activeId: string | null = null;     // the mission the wayfinding cue points to
  private readonly onWayfind: (cue: WayCue | null) => void;
  private lastWayKey = '';                     // debounce identical cues (no DOM churn)
  private readonly raycaster = new THREE.Raycaster();
  private readonly ground: THREE.Mesh;
  private readonly canvas: HTMLCanvasElement;
  private readonly onApproach: (missionId: string | null) => void;
  private readonly onInteract: (missionId: string) => void;
  private readonly onBiome: (biome: Biome) => void;
  private lastBiome: Biome | null = null;       // re-pick the ambience bed on a crossing
  private nearId: string | null = null;
  private speed = 2.4;
  // W3.2 player animation: the mixer wrapper (idle/walk crossfade by speed, or a
  // procedural bob when the rigged GLB lacks clips). `playerSpeed` is the ranger's
  // post-collision ground speed (m/s), fed to the crossfade each frame.
  private readonly playerRig = new PlayerRig();
  private playerSpeed = 0;
  // keyboard (+ joystick) movement: the held-keys set feeds resolveInput →
  // resolveMove each frame, overriding tap-to-walk while any key is down (§3.2).
  private input: InputHandle | null = null;
  // the on-screen joystick's live vector (W1.3), fused with the keys at the
  // resolveInput call site. Set by the HUD via setJoystick; null when absent.
  private joystickSource: (() => StickVector | null) | null = null;
  // while a diegetic mini-game plays IN-PLACE, the world stays loaded but freezes:
  // movement, walk-taps, proximity, wayfinding and the §1e follow all pause so the
  // activity's reframe owns the camera (it restores on endActivity).
  private activityActive = false;

  // W2.2 spawn-clearing hub: the ranger-cabin (a solid prop the ranger walks
  // around) + the case-board (the MISSION hub — proximity opens the mission board
  // overlay WITHOUT tearing the world down). The board has its own proximity/tap/
  // interact path kept OUT of `markers` so it never pollutes wayfinding or the
  // "nearest mission marker" the E2E steers to.
  private boardGroup: THREE.Group | null = null;
  private boardPos: THREE.Vector3 | null = null;
  private nearBoard = false;
  private onBoardNear: (near: boolean) => void = () => {};
  private onBoardOpen: () => void = () => {};

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
    onInteract: (missionId: string) => void = () => {},
  ) {
    this.canvas = canvas;
    this.onApproach = onApproach;
    this.onInteract = onInteract;
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
    this.placeHub();
    this.placeLandmarks();
    this.placeNatureDressing();
    this.placeScenicActors();
    this.placeAmbientLife();
    void this.loadRealRanger();

    canvas.addEventListener('pointerdown', this.onPointer);
    this.input = attachInput(window, { onInteract: () => this.tryInteract() });
  }

  /**
   * Fire the current proximity action from the interact key (W1.4) — the laptop
   * twin of tapping the "Speel mee" prompt. Only when the ranger stands at a
   * marker (`nearId`) and no in-place activity owns the world; the HUD decides
   * what the action is (open the mission briefing).
   */
  private tryInteract(): void {
    if (this.activityActive) return;
    // the spawn case-board hub wins when the ranger stands at it (W2.2) — its
    // "open the mission board" affordance is what the interact key fires there.
    if (this.nearBoard) { this.onBoardOpen(); return; }
    if (this.nearId) this.onInteract(this.nearId);
  }

  /** Dev-hook accessor (W1.4): the mission the ranger is standing at, or null. */
  nearMission(): string | null {
    return this.nearId;
  }

  /** Dev-hook accessor (W2.2): the spawn case-board's world position + whether the
   *  ranger currently stands in its radius — lets the E2E steer to the hub and know
   *  it has arrived. `null` before the hub is placed. */
  boardState(): { x: number; z: number; near: boolean } | null {
    if (!this.boardPos) return null;
    return { x: this.boardPos.x, z: this.boardPos.z, near: this.nearBoard };
  }

  /** Register the spawn case-board hub callbacks (W2.2): `onNear(true|false)` as the
   *  ranger enters/leaves the board's radius, and `onOpen()` when he acts on it (tap
   *  the prompt or press the interact key). The mission board opens as an overlay —
   *  the world is never torn down. */
  setBoard(cbs: { onNear: (near: boolean) => void; onOpen: () => void }): void {
    this.onBoardNear = cbs.onNear;
    this.onBoardOpen = cbs.onOpen;
  }

  /** Dev-hook accessor (W1.4): every marker's world position, for E2E navigation. */
  markerPositions(): { x: number; z: number; missionId: string }[] {
    return this.markers.map((m) => ({ x: m.pos.x, z: m.pos.z, missionId: m.missionId }));
  }

  /** Register the on-screen joystick's live-vector source (W1.3). The HUD wires
   *  it on world entry; pass null to clear. Fused with held keys each frame. */
  setJoystick(source: (() => StickVector | null) | null): void {
    this.joystickSource = source;
  }

  /** Register the "Camera draait mee" setting source (W1.5). Read live each frame
   *  so the toggle takes effect with no restart; null → default aan. */
  setCameraFollow(source: (() => boolean) | null): void {
    this.cameraFollowSource = source;
  }

  /** Dev-hook accessor (WORLD-PLAN §3.1): the ranger's world position {x,z}. */
  pos(): { x: number; z: number } {
    return { x: this.ranger.position.x, z: this.ranger.position.z };
  }

  /** Dev-hook accessor: the follow-camera yaw in radians — the world direction
   *  "into the screen" that camera-relative input (`resolveInput`) rotates by.
   *  Derived DIRECTLY from the follow bearing (not read back from the pitched
   *  camera's Euler, which couples yaw with pitch): the camera looks along
   *  `(sin followYaw, cos followYaw)`, and `resolveInput`'s forward at yaw ψ is
   *  `(−sin ψ, −cos ψ)`, so ψ = followYaw + π. Fixed-bearing (followYaw = π)
   *  reads exactly 0, matching the W1.2–W1.4 baseline; the rotating follow makes
   *  it track input-driven facing so the W1.5 yaw-change assert has a real signal. */
  cameraYaw(): number {
    return wrapAngle(this.followYaw + Math.PI);
  }

  dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointer);
    this.input?.dispose();
    this.input = null;
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
    // W3.2: load WITH clips (the W3.1-staged rig carries idle/walk/run) so the
    // player animates. loadRig falls back to a static group when no clips exist.
    const rig = await loadRig('ranger-alvah');
    if (!rig) return;
    const prepped = prepModel(rig.group, 1.25);
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
    // wire the locomotion mixer: idle/walk crossfade by speed, or a procedural
    // bob when the clips are missing (loadRig returned an empty clip list).
    if (rig.clips.length) this.playerRig.attach(prepped, rig.clips);
    else this.playerRig.attachProcedural(prepped);
  }

  /** The ranger's active locomotion clip for the dev hook (null when procedural). */
  playerClip(): { name: string; time: number } | null {
    return this.playerRig.clip();
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
          // W3.7b dossier: coat-tint correction (only for a confirmed contradiction,
          // e.g. the CC0 vos) + a subtle head-low posture for snuffling species.
          applyCoat(prepped, mk.modelId);
          applyPosture(prepped, mk.modelId);
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

  /**
   * Place the spawn-clearing hub (§4, W2.2): the ranger-cabin (a solid building the
   * ranger walks around) and the case-board (the mission hub — walking up to it
   * opens the mission board). Both are best-effort GLBs over a procedural stand-in.
   * The props sit to the +x/+z side of spawn so the forward (−z) corridor the
   * movement smoke walks stays clear, and both push a collision circle.
   */
  private placeHub(): void {
    // ranger-cabin: off to one side of spawn, its door turned toward the clearing;
    // a solid blocker (bigger collision circle) the ranger can't walk through.
    const cabinAt = new THREE.Vector3(-4.6, 0, 3.6);
    cabinAt.y = this.groundY(cabinAt.x, cabinAt.z);
    const cabin = new THREE.Group();
    cabin.position.copy(cabinAt);
    cabin.rotation.y = Math.atan2(-cabinAt.x, -cabinAt.z); // face the spawn point
    cabin.add(this.proceduralCabin());
    this.scene.add(cabin);
    this.obstacles.push({ x: cabinAt.x, z: cabinAt.z, r: 2.0 });
    void loadModel('prop-ranger-cabin').then((m) => {
      if (!m) return;
      const prepped = prepModel(m, 3.0);
      cabin.remove(...cabin.children);
      cabin.add(prepped);
    });

    // case-board: to the other side of spawn, ~4.4 m out — the mission hub. A halo
    // ring + a floating "Missiebord" tag read as "go here", like a mission marker.
    const boardAt = new THREE.Vector3(3.6, 0, 2.6);
    boardAt.y = this.groundY(boardAt.x, boardAt.z);
    const board = new THREE.Group();
    board.position.copy(boardAt);
    board.rotation.y = Math.atan2(-boardAt.x, -boardAt.z); // face the spawn point
    board.add(this.proceduralBoard());
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.15, 24),
      new THREE.MeshBasicMaterial({ color: '#f5c23b', transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    board.add(ring);
    const label = this.makeLabel('Missiebord', '#f5c23b');
    label.position.y = 2.0;
    board.add(label);
    this.scene.add(board);
    this.obstacles.push({ x: boardAt.x, z: boardAt.z, r: 0.7 });
    this.boardGroup = board;
    this.boardPos = boardAt.clone();
    void loadModel('prop-case-board').then((m) => {
      if (!m) return;
      const prepped = prepModel(m, 1.8);
      const totem = board.children.find((c) => c.userData.totem);
      if (totem) board.remove(totem);
      board.add(prepped); // keep the ring + label
    });
  }

  /**
   * W4.1: place the fixed landmark props per the §4 world map — the
   * fire-watchtower (bos beacon), the vogelkijkhut overlooking the ven, the
   * ecoduct + BOA post on the west rim, and two wegwijzer signposts along the
   * routes out of the spawn clearing. Each is a best-effort GLB over an instant
   * procedural totem stand-in; every one pushes a solid collision circle (the
   * ranger slides around it), and the four named beacons float a diegetic label
   * so they read as wayfinding cues from a distance (no minimap chrome — same
   * camera-facing sprite the mission markers + case-board use). None join
   * `markers`: they are set-dressing, not missions, so they never pollute the
   * "nearest mission" proximity/wayfinding path. Positions sit clear of the
   * −z movement-smoke corridor and off the mission-marker anchors (radius 22+).
   */
  private placeLandmarks(): void {
    // [dev-hook id, GLB model, world x/z, target Y-height (m), collision radius,
    //  optional beacon label]. The watchtower is deliberately the farthest —
    //  the W4.1 E2E walks spawn→watchtower.
    const LANDMARKS: {
      id: string; model: string; x: number; z: number; height: number; collide: number; label?: string;
    }[] = [
      { id: 'prop-fire-watchtower', model: 'prop-fire-watchtower', x: 37, z: -37, height: 9, collide: 1.8, label: 'Uitkijktoren' },
      { id: 'prop-bird-hide', model: 'prop-bird-hide', x: 26, z: -11, height: 2.8, collide: 1.4, label: 'Vogelkijkhut' },
      { id: 'prop-ecoduct', model: 'prop-ecoduct', x: -70, z: 6, height: 6, collide: 2.6, label: 'Ecoduct' },
      { id: 'prop-boa-post', model: 'prop-boa-post', x: -56, z: -20, height: 3, collide: 1.0, label: 'BOA-post' },
      { id: 'prop-signpost', model: 'prop-signpost', x: 9, z: -8, height: 1.7, collide: 0.5 },
      { id: 'prop-signpost-west', model: 'prop-signpost', x: -16, z: 10, height: 1.7, collide: 0.5 },
    ];
    for (const lm of LANDMARKS) {
      const at = new THREE.Vector3(lm.x, this.groundY(lm.x, lm.z), lm.z);
      const group = new THREE.Group();
      group.position.copy(at);
      group.rotation.y = Math.atan2(-lm.x, -lm.z); // turn its face toward the clearing
      group.add(this.proceduralTotem(lm.label ? '#c8a36a' : '#8a7a5a')); // instant stand-in
      if (lm.label) {
        const label = this.makeLabel(lm.label, '#e8d6a8');
        label.position.y = lm.height * 0.55 + 1.4;
        group.add(label);
      }
      this.scene.add(group);
      this.obstacles.push({ x: lm.x, z: lm.z, r: lm.collide });
      this.landmarks.push({ id: lm.id, x: lm.x, z: lm.z });
      void loadModel(lm.model).then((m) => {
        if (!m) return;
        const prepped = prepModel(m, lm.height);
        const totem = group.children.find((c) => c.userData.totem);
        if (totem) group.remove(totem); // keep the label
        group.add(prepped);
      });
    }
  }

  /** Dev-hook accessor (W4.1): every landmark's id + world x/z, so the E2E can
   *  steer the ranger from spawn to the watchtower and back. */
  landmarkPositions(): { id: string; x: number; z: number }[] {
    return this.landmarks.map((l) => ({ id: l.id, x: l.x, z: l.z }));
  }

  /**
   * W4.2: nature dressing. Real GLB trees, stumps, snags, logs, boulders,
   * mushrooms, ferns, foxgloves and reeds clustered at the POIs (watchtower
   * grove, ecoduct + BOA approaches, ven shore by the bird-hide) and scattered
   * through the biome cores — layered ON TOP of the instanced-primitive filler
   * (scatterPines/Heather/Marram/Reeds), which stays the cheap background. Only
   * the solid props (trees, boulders, logs, snags, juniper, stumps) push a
   * collision circle; low ground detail (mushrooms/fern/foxglove/reeds) is
   * walk-through. Every position was pre-validated (a helper script) to sit off
   * the −z movement-smoke corridor, out of the spawn clearing, and clear of the
   * submerged ven disc — the reeds ring the water's DRY shore. Fully
   * deterministic; a procedural totem stands in until each GLB streams in.
   */
  private placeNatureDressing(): void {
    // per-model stand height (m, prepModel target) + collision radius (0 = none)
    const SPEC: Record<string, { h: number; collide: number }> = {
      'prop-pine-scots': { h: 5.5, collide: 0.7 },
      'prop-oak-tree': { h: 5.0, collide: 0.7 },
      'prop-birch-tree': { h: 5.5, collide: 0.7 },
      'prop-tree-stump': { h: 0.7, collide: 0.5 },
      'prop-fallen-log': { h: 0.7, collide: 0.7 },
      'prop-dead-snag': { h: 3.5, collide: 0.6 },
      'prop-boulder': { h: 1.1, collide: 0.9 },
      'prop-juniper-bush': { h: 1.1, collide: 0.7 },
      'prop-mushrooms': { h: 0.35, collide: 0 },
      'prop-fern': { h: 0.6, collide: 0 },
      'prop-foxglove': { h: 0.8, collide: 0 },
      'prop-reeds': { h: 1.1, collide: 0 },
    };
    // [model, x, z] — curated + validated placements per §4.
    const PLACES: [string, number, number][] = [
      // Watchtower bos grove (POI 37,-37): trees + a real forest floor
      ['prop-pine-scots', 33, -40], ['prop-oak-tree', 41, -40], ['prop-birch-tree', 34, -33],
      ['prop-tree-stump', 31, -37], ['prop-mushrooms', 46, -42], ['prop-fern', 30, -42],
      ['prop-dead-snag', 44, -42], ['prop-fallen-log', 35, -43],
      // Ecoduct approach grove (POI -70,6)
      ['prop-pine-scots', -64, 10], ['prop-birch-tree', -66, 1], ['prop-pine-scots', -73, 12], ['prop-fern', -61, 4],
      // BOA-post trees (POI -56,-20)
      ['prop-oak-tree', -51, -24], ['prop-birch-tree', -60, -15],
      // Bird-hide + ven shore reeds (POI 26,-11, basin 46,-19 dry shore)
      ['prop-fern', 23, -14], ['prop-reeds', 33, -8], ['prop-reeds', 38, -4], ['prop-reeds', 43, -2],
      ['prop-reeds', 30, -13], ['prop-reeds', 49, -2], ['prop-reeds', 56, -35],
      // Heide scatter (SW)
      ['prop-foxglove', -10, -22], ['prop-boulder', -20, -28], ['prop-foxglove', -6, -30],
      // Stuifzand junipers + boulders (NE)
      ['prop-juniper-bush', 24, 20], ['prop-boulder', 30, 26], ['prop-juniper-bush', 16, 30],
      // Signpost path dressing
      ['prop-boulder', 13, -13], ['prop-mushrooms', -19, 14],
    ];
    PLACES.forEach(([model, x, z], i) => {
      const spec = SPEC[model];
      const at = new THREE.Vector3(x, this.groundY(x, z), z);
      const group = new THREE.Group();
      group.position.copy(at);
      group.rotation.y = (i * 2.39996) % (Math.PI * 2); // golden-angle spin for variety
      group.add(this.proceduralTotem(spec.collide > 0 ? '#6b5a3a' : '#7d8a4a')); // instant stand-in
      this.scene.add(group);
      if (spec.collide > 0) this.obstacles.push({ x, z, r: spec.collide });
      this.dressing.push({ id: model, x, z });
      void loadModel(model).then((m) => {
        if (!m) return;
        const prepped = prepModel(m, spec.h);
        const totem = group.children.find((c) => c.userData.totem);
        if (totem) group.remove(totem);
        group.add(prepped);
      });
    });
  }

  /** Dev-hook accessor (W4.2): every nature-dressing prop's id + world x/z, so
   *  the E2E can assert the biomes are dressed with real GLBs. */
  dressingPositions(): { id: string; x: number; z: number }[] {
    return this.dressing.map((d) => ({ id: d.id, x: d.x, z: d.z }));
  }

  /**
   * W3.3: place the two story-arc humans — the warden (BOA) near the case-board
   * hub where the player reports, and the poacher as a distant, calm figure off
   * in the bos edge. Each loads via `loadRig` and plays its single baked clip
   * through a mixer (advanced in `update`, frozen under reduced-motion). Both sit
   * to the +z side of spawn so the movement smoke's forward (−z) corridor stays
   * clear; neither pushes a collision circle or joins `markers` (pure dressing).
   */
  private placeScenicActors(): void {
    const ACTORS: { id: string; x: number; z: number; height: number }[] = [
      { id: 'ranger-warden-boa', x: 6.4, z: 4.4, height: 1.7 }, // the BOA by the report board
      { id: 'figure-poacher', x: -11.5, z: 8.5, height: 1.7 },  // a distant figure in the trees
    ];
    for (const a of ACTORS) {
      const group = new THREE.Group();
      group.position.set(a.x, this.groundY(a.x, a.z), a.z);
      group.rotation.y = Math.atan2(-a.x, -a.z); // face the spawn clearing
      this.scene.add(group);
      const entry = { id: a.id, group, mixer: null as THREE.AnimationMixer | null, action: null as THREE.AnimationAction | null };
      this.scenicActors.push(entry);
      void loadRig(a.id).then((rig) => {
        if (!rig) return;
        const prepped = prepModel(rig.group, a.height);
        applyEyes(prepped, a.id, { dusk: false });
        applyCalmPose(prepped, a.id); // §B never-scary: bias the poacher into a calm rest shape
        group.add(prepped);
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

  /** Dev-hook accessor (W3.3): each scenic actor's id + its live baked-clip
   *  {name, time} (null until the rig loads / when it carries no clip). Lets the
   *  E2E assert the warden + poacher are present AND their mixers actually run. */
  actorClips(): { id: string; clip: { name: string; time: number } | null }[] {
    return this.scenicActors.map((a) => ({
      id: a.id,
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
  private placeAmbientLife(): void {
    // ground roamers: [id, home x/z, loop radius, whether the GLB carries baked
    // walk/graze clips]. Target height now comes from the canonical dossier
    // stand-height table (W3.7a, `AnimalScale.ts`) — one source of truth so the
    // world and the showroom true-scale mode read the SAME relative sizes.
    const GROUND: { id: string; hx: number; hz: number; r: number; baked: boolean }[] = [
      { id: 'animal-ree-roedeer', hx: 26, hz: 26, r: 6, baked: true },   // bos/heide edge
      { id: 'animal-vos-fox', hx: -30, hz: -10, r: 7, baked: true },     // heide, west
      { id: 'animal-eekhoorn-squirrel', hx: -24, hz: -24, r: 3, baked: false }, // near trees
      { id: 'animal-wildzwijn-boar', hx: 10, hz: 36, r: 6, baked: false },     // heide, south
    ];
    GROUND.forEach((a, i) => {
      const h = standHeightFor(a.id) ?? 0.9; // dossier canonical (W3.7a)
      const wander: WanderConfig = {
        homeX: a.hx, homeZ: a.hz, radius: a.r,
        period: 22 + i * 4,          // each roams at a slightly different pace
        phase: (i * 0.27) % 1,       // desync the loops
        angle: i * 1.1,              // rotate each loop differently
      };
      const group = new THREE.Group();
      group.position.set(a.hx, this.groundY(a.hx, a.hz), a.hz);
      this.scene.add(group);
      const entry = {
        id: a.id, group, phase: i * 1.7,
        wander, glide: null as GlideConfig | null, faceOffset: 0,
        recipe: gaitFor(a.id),
        anim: null as THREE.Group | null, mixer: null as THREE.AnimationMixer | null,
        walk: null as THREE.AnimationAction | null, graze: null as THREE.AnimationAction | null,
        walkW: 0, grazeW: 1, h,
      };
      this.ambient.push(entry);
      void loadRig(a.id).then((rig) => {
        if (!rig) return;
        const prepped = prepModel(rig.group, h);
        applyEyes(prepped, a.id, { dusk: false });
        applyCoat(prepped, a.id);     // W3.7b: dossier coat-tint correction (vos rufous)
        applyPosture(prepped, a.id);  // W3.7b: head-low stance for snuffling species
        applyCalmPose(prepped, a.id); // §B never-scary rest-pose bias
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
      { id: 'bird-buizerd', h: 0.9, cx: 4, cz: 0, r: 44, height: 24, period: 30, phase: 0, bob: 1.6 },
      { id: 'bird-houtduif', h: 0.5, cx: -18, cz: 8, r: 26, height: 16, period: 22, phase: 0.5, bob: 1.1 },
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
        walkW: 0, grazeW: 0, h: b.h,
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

  /** Procedural stand-in for the ranger-cabin (instant, before the GLB loads). */
  private proceduralCabin(): THREE.Group {
    const g = new THREE.Group();
    g.userData.totem = true;
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.8, 2.0),
      new THREE.MeshStandardMaterial({ color: '#7a5a3a', roughness: 1 }),
    );
    wall.position.y = 0.9;
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(1.9, 1.0, 4),
      new THREE.MeshStandardMaterial({ color: '#5b4327', roughness: 1 }),
    );
    roof.position.y = 2.3; roof.rotation.y = Math.PI / 4;
    g.add(wall, roof);
    return g;
  }

  /** Procedural stand-in for the case-board (two posts + a cork panel). */
  private proceduralBoard(): THREE.Group {
    const g = new THREE.Group();
    g.userData.totem = true;
    const postMat = new THREE.MeshStandardMaterial({ color: '#6b513a', roughness: 1 });
    const post1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 6), postMat);
    post1.position.set(-0.5, 0.7, 0);
    const post2 = post1.clone(); post2.position.x = 0.5;
    const cork = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.9, 0.08),
      new THREE.MeshStandardMaterial({ color: '#c8a36a', roughness: 1 }),
    );
    cork.position.set(0, 1.3, 0);
    g.add(post1, post2, cork);
    return g;
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
    // 1b) a tapped case-board hub → walk up to it (proximity then opens the board)
    if (this.boardGroup && this.boardPos) {
      const hit = this.raycaster.intersectObject(this.boardGroup, true);
      if (hit.length) {
        const dir = new THREE.Vector3(this.boardPos.x, 0, this.boardPos.z).sub(
          new THREE.Vector3(this.ranger.position.x, 0, this.ranger.position.z),
        );
        if (dir.lengthSq() > 0.001) dir.normalize();
        this.target.set(this.boardPos.x - dir.x * 1.6, 0, this.boardPos.z - dir.z * 1.6);
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
    this.playerSpeed = 0; // 0 while standing or during an in-place activity → mixer eases to idle
    if (!this.activityActive) {
      // W1.2 velocity branch: while a movement key is held (camera-relative via
      // resolveInput), it OVERRIDES tap-to-walk — the desired step is the input
      // vector · speed · dt, resolved by the same kinematic controller. When no
      // key is held we fall back to seeking the tapped target. Either way the
      // ACTUAL post-collision delta drives facing (slide-around-pine still turns).
      const stick = this.joystickSource ? this.joystickSource() : null;
      const move = this.input ? resolveInput(this.input.held, stick, this.cameraYaw()) : { x: 0, z: 0 };
      let wantX: number, wantZ: number, moving: boolean;
      if (move.x !== 0 || move.z !== 0) {
        const step = this.speed * dt;
        wantX = rp.x + move.x * step;
        wantZ = rp.z + move.z * step;
        this.target.set(rp.x, 0, rp.z); // drop any stale walk target so it can't resume on key-release
        moving = true;
      } else {
        const dx = this.target.x - rp.x, dz = this.target.z - rp.z;
        const dist = Math.hypot(dx, dz);
        moving = dist > 0.06;
        const step = moving ? Math.min(this.speed * dt, dist) : 0;
        wantX = rp.x + (moving ? (dx / dist) * step : 0);
        wantZ = rp.z + (moving ? (dz / dist) * step : 0);
      }
      if (moving) {
        const next = resolveMove(rp.x, rp.z, wantX, wantZ, this.obstacles, this.limits);
        const mx = next.x - rp.x, mz = next.z - rp.z;
        if (mx * mx + mz * mz > 1e-7) {
          this.ranger.rotation.y = Math.atan2(mx, mz);
          // W1.5: the follow-cam chases the ranger's facing ONLY while he moves,
          // so a standing ranger (or a mini-game reframe) never swings the view.
          this.followTargetYaw = this.ranger.rotation.y;
        }
        // W3.2: the actual post-collision ground speed drives the idle↔walk
        // crossfade (slide-around-pine slows him, so the gait reads honestly).
        this.playerSpeed = Math.hypot(mx, mz) / Math.max(dt, 1e-4);
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

    // W3.3: the warden + poacher play their baked clips. Secondary motion, so the
    // clip freezes at the rest pose under reduced-motion (same rule as the animals).
    for (const a of this.scenicActors) a.mixer?.update(reduced ? 0 : dt);

    // W3.6: ambient wildlife. Ground animals roam a gentle wander loop (baked
    // walk↔graze crossfade for the W3.5 cast, procedural bob elsewhere); birds
    // glide overhead. All SECONDARY motion → frozen at home/rest under reduced-
    // motion (the loop halts, the mixer holds its pose — locomotion-exempt rule
    // applies only to the PLAYER, §3.4).
    for (const a of this.ambient) {
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

    // W3.2: the ranger's own locomotion animation. Locomotion is reduced-motion
    // EXEMPT (§3.4) so the mixer always advances with real dt — a walking ranger
    // animates in both motion modes; only the procedural-bob fallback holds still.
    this.playerRig.update(dt, this.playerSpeed, reduced);

    if (this.activityActive) return; // the activity owns proximity/wayfinding/camera

    // proximity → surface the "play" affordance (debounced by id)
    let near: string | null = null;
    for (const mk of this.markers) {
      if (Math.hypot(mk.pos.x - rp.x, mk.pos.z - rp.z) < 2.4) { near = mk.missionId; break; }
    }
    if (near !== this.nearId) { this.nearId = near; this.onApproach(near); }

    // case-board hub proximity (W2.2) — surface / hide the "open the mission board"
    // affordance. Its own flag so a mission marker and the board never fight.
    if (this.boardPos) {
      const nb = Math.hypot(this.boardPos.x - rp.x, this.boardPos.z - rp.z) < 2.4;
      if (nb !== this.nearBoard) { this.nearBoard = nb; this.onBoardNear(nb); }
    }

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

    this.placeCamera(reduced, dt, reduced);
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

  /** Resume free-roam after an in-place activity; re-emit the wayfinding cue.
   *  The activity reframe owned the camera; on resume the follow-yaw eases back
   *  to behind the ranger (a cut under reduced-motion, per §3.2). */
  endActivity(): void {
    this.activityActive = false;
    this.nearId = null;
    this.nearBoard = false; // force a fresh proximity re-fire (re-surfaces the hub prompt)
    this.lastWayKey = '';
    this.followTargetYaw = this.ranger.rotation.y;
    if (livePolicy().reduced) this.placeCamera(true, 0, true); // reduced → cut back
    // otherwise the next update() frame damps position + yaw back into place.
  }

  /**
   * Place the follow-camera (§1e position follow + W1.5 rotating bearing).
   *
   * The horizontal offset is the fixed distance/height rotated by `followYaw`:
   * `-(sin yaw, cos yaw)·distance` sits the camera behind the ranger's facing.
   * When the follow rotates (toggle on AND not reduced-motion) `followYaw` eases
   * toward the ranger's facing with the damped, rate-clamped `dampedYaw`; else it
   * is pinned to π — the pre-W1.5 straight-behind bearing (reduced-motion falls
   * back to the fixed bearing per §3.2). Position exp-damps (~0.3 s) unless
   * `snap` (reduced-motion cut, activity resume, or first placement). Roll is
   * always 0 and the FOV is fixed at construction — the motion-comfort law.
   */
  private placeCamera(snap: boolean, dt = 0, reduced = false): void {
    const rp = this.ranger.position;
    const follow = this.cameraFollowSource ? this.cameraFollowSource() : true;
    if (follow && !reduced) {
      this.followYaw = dampedYaw(this.followYaw, this.followTargetYaw, dt);
    } else {
      // fixed bearing: straight behind on +z, no rotation — and reset the target
      // so re-enabling the follow doesn't whip-pan from a stale facing.
      this.followYaw = FIXED_FOLLOW_YAW;
      this.followTargetYaw = FIXED_FOLLOW_YAW;
    }
    const s = Math.sin(this.followYaw), c = Math.cos(this.followYaw);
    const dist = this.camOffset.z;
    this.camDesired.set(rp.x - s * dist, rp.y + this.camOffset.y, rp.z - c * dist);
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
