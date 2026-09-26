/**
 * world/Markers.ts — every place you walk up to that offers an action.
 *
 * One marker per mission (a halo ring, a floating name-tag and the mission's animal,
 * or a totem until its GLB streams in), the Missiebord at the spawn clearing (opens
 * the mission board) and the "Ken je roep" sit-spot bench. Owns their proximity
 * (which prompt the HUD shows), the interact dispatch, the wayfinding cue toward the
 * active mission (it follows the sand paths) and the lens-proximity fade of the
 * "go here" rings.
 */

import * as THREE from 'three';
import { loadModel, loadRig, prepModel } from '../Models';
import { anchorInBiome, type Biome } from '../Biomes';
import { applyEyes } from '../EyeMaterial';
import { applyCoat, applyPosture } from '../AnimalDress';
import { applyCalmPose } from '../CalmPoseRig';
import { gaitFor, motionAt, REST, type MotionRecipe } from '../ProceduralMotion';
import { wayfind, bearing, cue as makeCue, distanceTo, type WayCue } from '../Wayfinding';
import { routeVia } from '../Paths';
import { ROEP_COPY } from '../../engines/roep';
import type { Obstacle } from '../CharacterController';
import type { Terrain } from './Terrain';
import type { Labels } from './Labels';
import { proceduralTotem } from './props';

export interface WorldMarker {
  missionId: string;
  titel: string;
  modelId: string | null;   // generated GLB id, or null → procedural totem
  height: number;           // target world height for the model
  color: string;            // totem / accent colour
  biome?: Biome;            // the mission's landschap → anchor the marker in it
}

/** Within this distance (m) of a marker, the board or the sit-spot its prompt shows. */
const NEAR_R = 2.4;

export class Markers {
  readonly list: {
    group: THREE.Group; pos: THREE.Vector3; missionId: string;
    recipe: MotionRecipe; phase: number;
    label: THREE.Sprite;               // the floating diegetic name-tag (hidden during an activity)
    anim: THREE.Group | null;          // the prepped model wrapper to drive procedurally
    mixer: THREE.AnimationMixer | null; // set instead when a real animated GLB is staged
  }[] = [];
  nearId: string | null = null;                // the mission marker the ranger stands at
  // W2.2 spawn-clearing hub: the ranger-cabin (a solid prop the ranger walks
  // around) + the case-board (the MISSION hub — proximity opens the mission board
  // overlay WITHOUT tearing the world down). The board has its own proximity/tap/
  // interact path kept OUT of `markers` so it never pollutes wayfinding or the
  // "nearest mission marker" the E2E steers to.
  boardGroup: THREE.Group | null = null;
  boardPos: THREE.Vector3 | null = null;
  nearBoard = false;
  private onBoardNear: (near: boolean) => void = () => {};
  private onBoardOpen: () => void = () => {};
  // W6.4b2 "Ken je roep" sit-spot: a bench by the vogelkijkhut. Its own
  // proximity/tap/interact path (like the case-board) — walking up surfaces
  // "Luister naar de vogels", and acting on it plays the roep3d perception slice
  // in-place. Kept OUT of `markers` so it never pollutes wayfinding or the
  // "nearest mission" proximity the E2E steers to.
  sitSpotGroup: THREE.Group | null = null;
  sitSpotPos: THREE.Vector3 | null = null;
  nearSitSpot = false;
  private onSitSpotNear: (near: boolean) => void = () => {};
  private onSitSpotActivate: () => void = () => {};
  // D3.16: the diegetic "go here" halo rings (mission markers, the case-board, the
  // sit-spot). They are wayfinding UI (§3), so they FADE by the lens's proximity — a
  // collapsed close follow boom must never render one as a frame-filling hoop
  // (`18-jeep-near`). Full 0.5 beyond RING_FADE_FAR, linearly to 0 by RING_FADE_NEAR.
  private readonly groundRings: { mat: THREE.MeshBasicMaterial; x: number; z: number; base: number }[] = [];
  private readonly RING_FADE_NEAR = 2.2; // lens ≤ this from a ring ⇒ fully faded (it's under/around the ranger)
  private readonly RING_FADE_FAR = 4.2;  // lens ≥ this ⇒ full "go here" opacity (normal approach/standing boom ~4.6 m)
  private activeId: string | null = null;     // the mission the wayfinding cue points to
  private lastWayKey = '';                     // debounce identical cues (no DOM churn)
  private readonly onApproach: (missionId: string | null) => void;
  private readonly onInteract: (missionId: string) => void;
  private readonly onWayfind: (cue: WayCue | null) => void;
  // P1.0 (F-19): the board is statically turned toward the +x side the camera rig swings
  // to when the ranger stands at it, so its face + papers stay readable at that angle.
  private readonly BOARD_APPROACH_FACE_TURN = 0.5; // static board face turn (rad) toward the +x approach view
  private readonly scene: THREE.Scene;
  private readonly terrain: Terrain;
  private readonly obstacles: Obstacle[];
  private readonly labels: Labels;

  constructor(
    env: { scene: THREE.Scene; terrain: Terrain; obstacles: Obstacle[]; labels: Labels },
    cbs: {
      onApproach: (missionId: string | null) => void;
      onInteract: (missionId: string) => void;
      onWayfind: (cue: WayCue | null) => void;
    },
    activeId: string | null,
  ) {
    this.scene = env.scene;
    this.terrain = env.terrain;
    this.obstacles = env.obstacles;
    this.labels = env.labels;
    this.onApproach = cbs.onApproach;
    this.onInteract = cbs.onInteract;
    this.onWayfind = cbs.onWayfind;
    this.activeId = activeId;
  }

  /** The drawn ground height (the one ground truth, world/Terrain.ts). */
  private groundY(x: number, z: number): number {
    return this.terrain.y(x, z);
  }

  placeMarkers(markers: WorldMarker[]): void {
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
      this.groundRings.push({ mat: ring.material as THREE.MeshBasicMaterial, x, z, base: 0.5 }); // D3.16: fade near the lens

      // a small diegetic name-tag floating above the marker (in-world label, no
      // minimap chrome) — a camera-facing sprite so it stays readable from any angle
      const label = this.labels.make(mk.titel, mk.color);
      label.position.y = 1.9;
      group.add(label);

      group.add(proceduralTotem(mk.color)); // instant stand-in
      this.scene.add(group);
      const entry = {
        group, pos: group.position.clone(), missionId: mk.missionId,
        recipe: gaitFor(mk.modelId), phase: i * 1.7, label,
        anim: null as THREE.Group | null, mixer: null as THREE.AnimationMixer | null,
      };
      this.list.push(entry);

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

  /**
   * The spawn-clearing case-board (§4, W2.2): the mission hub — walking up to it
   * opens the mission board. Best-effort GLB over a procedural stand-in, a few
   * metres out on the +x side of spawn, pushing a collision circle.
   */
  placeBoard(): void {
    // case-board: the mission hub. A halo ring + a floating "Missiebord" tag read
    // as "go here", like a mission marker.
    //
    // F-09 (spawn faces the void, the hub sits BEHIND the player): it used to sit at
    // (3.6, 2.6) — the +z side, i.e. straight BEHIND the back-turned ranger and off
    // the world-entry frame, so the very content the player should walk toward was
    // never in the first frame and holding forward (−z) walked AWAY from it into the
    // heath. Moving it to (2.2, −5) puts the mission hub in the forward (−z) frustum,
    // off to the RIGHT — a mirror of the cabin's forward-LEFT — so world-entry now
    // composes cabin (left) + Missiebord (right) + the bos tree line ahead, and the
    // first stride heads TOWARD content. It stays off the x≈0 tap-to-walk lane (its
    // r=0.7 circle spans x∈[1.5,2.9]), ~1.3 m clear of the spawn→watchtower diagonal
    // the paths @smoke walks, and 5.5 m out (> the 2.4 m board proximity, so the hub
    // prompt does NOT fire at spawn). The board faces the spawn point (below).
    const boardAt = new THREE.Vector3(2.2, 0, -5);
    boardAt.y = this.groundY(boardAt.x, boardAt.z);
    const board = new THREE.Group();
    board.position.copy(boardAt);
    // P1.0 (F-19): face the spawn point, then turn a little toward +x so the board
    // face + its pinned papers point at the over-the-shoulder approach framing (the
    // lens swings to the +x side while the ranger stands here — CameraRig.place), not
    // straight back down the ranger's spine where his body hides them. A small turn:
    // world-entry still reads the board face (its +z-facing component only grows).
    board.rotation.y = Math.atan2(-boardAt.x, -boardAt.z) + this.BOARD_APPROACH_FACE_TURN;
    board.add(this.proceduralBoard());
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.15, 24),
      new THREE.MeshBasicMaterial({ color: '#f5c23b', transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    board.add(ring);
    this.groundRings.push({ mat: ring.material as THREE.MeshBasicMaterial, x: boardAt.x, z: boardAt.z, base: 0.5 }); // D3.16
    const label = this.labels.make('Missiebord', '#f5c23b');
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
   * W6.4b2: the "Ken je roep" sit-spot — a calm wooden bench a couple of metres
   * out from the vogelkijkhut (landmark at 26,-11), facing the open heath so the
   * perched bird forms of the perception slice have room to sit in front. Like the
   * case-board hub it carries a halo ring + a floating "Zitplek · luister" label so
   * it reads as "go here" (the diegetic wayfinding cue — no minimap chrome), and it
   * has its own proximity/tap/interact path OUTSIDE `markers`. Acting on it plays
   * `roep3d` in-place (Missions wires `onActivate`). The bench is a small procedural
   * prop (no GLB dependency); its collision circle is tiny so the ranger can stand
   * right at it.
   */
  placeSitSpot(): void {
    const at = new THREE.Vector3(22, 0, -6.5);
    at.y = this.groundY(at.x, at.z);
    const group = new THREE.Group();
    group.position.copy(at);
    // turn the seat to look out over the heath (away from the clearing/hide)
    group.rotation.y = Math.atan2(at.x, at.z);
    group.add(this.proceduralBench());
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.15, 24),
      new THREE.MeshBasicMaterial({ color: '#8ab6d6', transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    group.add(ring);
    this.groundRings.push({ mat: ring.material as THREE.MeshBasicMaterial, x: at.x, z: at.z, base: 0.5 }); // D3.16
    const label = this.labels.make(ROEP_COPY.wayfinding, '#cfe6f2');
    label.position.y = 1.7;
    group.add(label);
    this.scene.add(group);
    this.obstacles.push({ x: at.x, z: at.z, r: 0.5 });
    this.sitSpotGroup = group;
    this.sitSpotPos = at.clone();
  }

  /** A small calm wooden bench (two legs + a seat + a low backrest) — an instant
   *  procedural prop so the sit-spot needs no GLB. Warm heath-wood tones. */
  private proceduralBench(): THREE.Group {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: '#7a5f3e', roughness: 1 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.09, 0.42), wood);
    seat.position.y = 0.46;
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.34, 0.07), wood);
    back.position.set(0, 0.7, -0.18);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.46, 0.42), wood);
    legL.position.set(-0.6, 0.23, 0);
    const legR = legL.clone();
    legR.position.x = 0.6;
    g.add(seat, back, legL, legR);
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

  /** Register the spawn case-board hub callbacks (W2.2): `onNear(true|false)` as the
   *  ranger enters/leaves the board's radius, and `onOpen()` when he acts on it. */
  setBoard(cbs: { onNear: (near: boolean) => void; onOpen: () => void }): void {
    this.onBoardNear = cbs.onNear;
    this.onBoardOpen = cbs.onOpen;
  }

  /** Register the sit-spot callbacks (W6.4b2): `onNear(true|false)` as the ranger
   *  enters/leaves the bench's radius, and `onActivate()` when he acts on it. */
  setSitSpot(cbs: { onNear: (near: boolean) => void; onActivate: () => void }): void {
    this.onSitSpotNear = cbs.onNear;
    this.onSitSpotActivate = cbs.onActivate;
  }

  /** Re-point the wayfinding cue at another mission (e.g. after one is completed). */
  setActiveMission(id: string | null): void {
    this.activeId = id;
    this.lastWayKey = '';
  }

  /** The live `richting` phrase (relative to facing) toward a mission marker, for
   *  the world-EF "welke kant?" recall beat — `null` if the marker is unknown.
   *  Synchronous so the beat can score against the true bearing at fire time. */
  headingTo(id: string | null, x: number, z: number, facing: number): string | null {
    if (!id) return null;
    const goal = this.list.find((m) => m.missionId === id);
    if (!goal) return null;
    return wayfind(x, z, facing, goal.pos.x, goal.pos.z).richting;
  }

  /**
   * Per frame: each marker's animal moves — a real baked rig wins (mixer); else the
   * always-on procedural fallback (gentle, never-scary, calm-pose gated). Both are
   * secondary motion, so reduced-motion freezes them at the rest pose.
   */
  animate(t: number, dt: number, reduced: boolean): void {
    for (const mk of this.list) {
      if (mk.mixer) {
        mk.mixer.update(reduced ? 0 : dt);
      } else if (mk.anim) {
        const d = reduced ? REST : motionAt(mk.recipe, t, mk.phase);
        mk.anim.position.set(d.dx, d.dy, 0);
        mk.anim.rotation.set(0, d.rotY, d.rotZ);
        mk.anim.scale.set(1, d.scaleY, 1);
      }
    }
  }

  /**
   * Proximity → surface the "play" affordance (debounced by id), the "open the
   * mission board" affordance (W2.2) and the "Luister naar de vogels" sit-spot
   * affordance (W6.4b2). Each has its own flag so they never fight. The composer
   * skips this while driving/flying so no stale prompt sits behind the vehicle pill.
   */
  updateProximity(x: number, z: number): void {
    let near: string | null = null;
    for (const mk of this.list) {
      if (Math.hypot(mk.pos.x - x, mk.pos.z - z) < NEAR_R) { near = mk.missionId; break; }
    }
    if (near !== this.nearId) { this.nearId = near; this.onApproach(near); }
    if (this.boardPos) {
      const nb = Math.hypot(this.boardPos.x - x, this.boardPos.z - z) < NEAR_R;
      if (nb !== this.nearBoard) { this.nearBoard = nb; this.onBoardNear(nb); }
    }
    if (this.sitSpotPos) {
      const ns = Math.hypot(this.sitSpotPos.x - x, this.sitSpotPos.z - z) < NEAR_R;
      if (ns !== this.nearSitSpot) { this.nearSitSpot = ns; this.onSitSpotNear(ns); }
    }
  }

  /**
   * The wayfinding cue to the active mission — calm direction + distance, no minimap.
   * Debounced so the diegetic HUD only re-renders when the words actually change.
   * W4.3: the ARROW aims at the next sand-path waypoint (routeVia) while the distance
   * and "je bent er" stay measured to the real marker, so the child walks the trail
   * then peels off at the end.
   */
  updateWayfinding(x: number, z: number, facing: number): void {
    const goal = this.activeId ? this.list.find((m) => m.missionId === this.activeId) : null;
    if (goal) {
      const wp = routeVia(x, z, goal.pos.x, goal.pos.z);
      const angle = bearing(x, z, facing, wp.x, wp.z);
      const dist = distanceTo(x, z, goal.pos.x, goal.pos.z);
      const cue = makeCue(angle, dist);
      const key = `${cue.glyph}|${cue.richting}|${cue.afstand}`;
      if (key !== this.lastWayKey) { this.lastWayKey = key; this.onWayfind(cue); }
    } else if (this.lastWayKey !== '') {
      this.lastWayKey = ''; this.onWayfind(null);
    }
  }

  /** The interact key at the hub, the sit-spot or a marker (W1.4/W2.2/W6.4b2), in
   *  that order. False when the ranger stands at none of them. */
  interact(): boolean {
    if (this.nearBoard) { this.onBoardOpen(); return true; }
    if (this.nearSitSpot) { this.onSitSpotActivate(); return true; }
    if (this.nearId) { this.onInteract(this.nearId); return true; }
    return false;
  }

  /** Boarding a vehicle: drop the walk-time marker + hub prompts so nothing lingers
   *  behind the "Stap uit" pill. */
  clearForVehicle(): void {
    if (this.nearId) { this.nearId = null; this.onApproach(null); }
    if (this.nearBoard) { this.nearBoard = false; this.onBoardNear(false); }
  }

  /** W6.1: hide the floating mission name-tags during an in-place activity (so a label
   *  the reframe keeps in view never overlaps the play prompt), restore them after. */
  setLabelsVisible(visible: boolean): void {
    for (const m of this.list) m.label.visible = visible;
  }

  /** After an in-place activity: forget every proximity + the last cue so the next
   *  frame re-fires them (re-surfaces the hub / sit-spot prompt and the cue). */
  resetAfterActivity(): void {
    this.nearId = null;
    this.nearBoard = false;
    this.nearSitSpot = false;
    this.lastWayKey = '';
  }

  /**
   * D3.16: fade the diegetic "go here" halo rings (mission markers, case-board, sit-spot)
   * by the LENS's horizontal proximity — full 0.5 beyond RING_FADE_FAR, linearly to 0 at
   * RING_FADE_NEAR. The `18-jeep-near` breach filled the frame with a marker ring when a
   * collapsed close boom looked near-straight-down at it; a ring is wayfinding UI (§3 /
   * §2.5 GATE-D2), so it caps/hides at close range instead of reading as a giant hoop. The
   * normal approach + standing boom (~4.6 m behind the ranger who stands ON the ring) sits
   * beyond FAR, so the "go here" cue is untouched while walking up; only a lens driven
   * right on top of a ring fades it. A pure per-material opacity write, guarded on change —
   * no geometry/draw-call change (<150 holds), deterministic so RM frames stay frozen.
   */
  fadeRings(camera: THREE.Camera): void {
    if (this.groundRings.length === 0) return;
    const cx = camera.position.x, cz = camera.position.z;
    const span = this.RING_FADE_FAR - this.RING_FADE_NEAR;
    for (const r of this.groundRings) {
      const d = Math.hypot(cx - r.x, cz - r.z);
      const k = Math.max(0, Math.min(1, (d - this.RING_FADE_NEAR) / span));
      const o = r.base * k;
      if (r.mat.opacity !== o) r.mat.opacity = o;
    }
  }

  /** Dev-hook accessor (W1.4): every marker's world position, for E2E navigation. */
  markerPositions(): { x: number; z: number; missionId: string }[] {
    return this.list.map((m) => ({ x: m.pos.x, z: m.pos.z, missionId: m.missionId }));
  }

  /** Dev-hook accessor (W6.4b2): the sit-spot's world position + whether the ranger
   *  stands in its radius — lets the E2E steer to the bench and know it has arrived.
   *  `null` before the sit-spot is placed. */
  sitSpotState(): { x: number; z: number; near: boolean } | null {
    if (!this.sitSpotPos) return null;
    return { x: this.sitSpotPos.x, z: this.sitSpotPos.z, near: this.nearSitSpot };
  }
}
