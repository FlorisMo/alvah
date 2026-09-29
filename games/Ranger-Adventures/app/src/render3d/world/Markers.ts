/**
 * world/Markers.ts — every place you walk up to that offers an action.
 *
 * One marker per mission (a halo ring, a floating name-tag and the mission's animal,
 * or a totem until its GLB streams in), the Missiebord at the spawn clearing (opens
 * the mission board), the hut's porch (opens the hut, once Bram has told about the
 * young raaf) and the "Ken je roep" sit-spot bench. Owns their proximity
 * (which prompt the HUD shows), the interact dispatch, the wayfinding cue toward the
 * active mission (it follows the sand paths) and the lens-proximity fade of the
 * "go here" rings.
 */

import * as THREE from 'three';
import { loadModel, loadRig, prepModel } from '../Models';
import { SIZE } from '../AnimalScale';
import { anchorInBiome, biomeAt, type Biome } from '../Biomes';
import { applyEyes } from '../EyeMaterial';
import { applyCoat, applyPosture } from '../AnimalDress';
import { applyCalmPose } from '../CalmPoseRig';
import { gaitFor, motionAt, REST, type MotionRecipe } from '../ProceduralMotion';
import { wayfind, bearing, distanceTo, SteadyCue, type WayCue } from '../Wayfinding';
import { RouteGuide, RouteMap, arrivalSpot, openHeading } from '../Paths';
import { VEN_CENTER } from '../Biomes';
import { ROEP_COPY } from '../../engines/roep';
import { TAG } from '../../content/copy';
import { boxObstacle, obstacleGap, type MoveLimits, type Obstacle } from '../CharacterController';
import type { Terrain } from './Terrain';
import { Labels } from './Labels';
import { proceduralTotem } from './props';
import { mergeColourSplits } from '../play/merge';
import { FarRest, restFar } from '../play/fade';

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
/** Per landschap, how far (rad) its markers turn off the biome's centre line. */
const ANCHOR_TURN: Partial<Record<Biome, number>> = { stuifzand: 0.4 };
/** Per landschap, how far (rad) its 2nd, 3rd … marker fan out left/right of the first. */
const ANCHOR_FAN: Partial<Record<Biome, number>> = { heide: 0.28 };
/** Far off, half in the golden-hour fog, a marker's animal calmly fades out and rests
 *  (beyond ANIMAL_REST_FAR m from the lens; back within ANIMAL_REST_NEAR m). Its halo
 *  and name-tag stay: they are the way there. */
const ANIMAL_REST_NEAR = 50;
const ANIMAL_REST_FAR = 56;
/** The chip's arrow turns with the bearing in steps of this many rad (~4°). */
const ARROW_STEP = 0.07;
/** A finished mission's halo + tag pip: a calm green ("klaar"). */
const FINISHED_COLOR = '#3dbb5c';

export class Markers {
  readonly list: {
    group: THREE.Group; pos: THREE.Vector3; missionId: string;
    recipe: MotionRecipe; phase: number;
    label: THREE.Sprite;               // the floating diegetic name-tag (hidden during an activity)
    titel: string;                     // the mission title the tag shows
    ring: THREE.MeshBasicMaterial;     // the "go here" halo (turns the finished colour when done)
    finished: boolean;                 // the mission is done: the tag reads "✓ <titel>"
    anim: THREE.Group | null;          // the prepped model wrapper to drive procedurally
    model: THREE.Group | null;         // the loaded animal (fades out far off in the fog)
    rest: FarRest;
    mixer: THREE.AnimationMixer | null; // set instead when a real animated GLB is staged
  }[] = [];
  nearId: string | null = null;                // the mission marker the ranger stands at
  private readonly lens = { x: 0, z: 0, seen: false }; // where the camera stood last frame
  // W2.2 spawn-clearing hub: the ranger-cabin (a solid prop the ranger walks
  // around) + the case-board (the MISSION hub — proximity opens the mission board
  // overlay WITHOUT tearing the world down). The board has its own proximity/tap/
  // interact path kept OUT of `markers` so it never pollutes wayfinding or the
  // "nearest mission marker" the E2E steers to.
  boardGroup: THREE.Group | null = null;
  boardPos: THREE.Vector3 | null = null;
  private boardLabel: THREE.Sprite | null = null;
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
  // run 6 (FLOW P4): the hut's porch — a ring before its door and a tag, shown once Bram
  // has told about the young raaf (`showPorch`). Its own proximity/interact path, like
  // the board; kept OUT of `markers` (never a wayfinding goal).
  private porch: { group: THREE.Group; pos: THREE.Vector3; label: THREE.Sprite; tag: string } | null = null;
  nearPorch = false;
  private onPorchNear: (near: boolean) => void = () => {};
  private onPorchOpen: () => void = () => {};
  // D3.16: the diegetic "go here" halo rings (mission markers, the case-board, the
  // sit-spot). They are wayfinding UI (§3), so they FADE by the lens's proximity — a
  // collapsed close follow boom must never render one as a frame-filling hoop
  // (`18-jeep-near`). Full 0.5 beyond RING_FADE_FAR, linearly to 0 by RING_FADE_NEAR.
  private readonly groundRings: {
    mat: THREE.MeshBasicMaterial; x: number; z: number; base: number;
    mesh: THREE.Mesh; glow: number; pulse: number; // run 6: a ring that glows (s left) breathes
    glowTag?: THREE.Sprite | null;                  // …as long as this tag glows (seen-time, Labels)
  }[] = [];
  // run 6 (FLOW): the next mission's tag shows from afar only once Bram has told the
  // player about it (the chip and the tag come together); a glowing ring round the
  // parked jeep when Bram suggests it (`setBeacon`)
  private nextRevealed = true;
  private beacon: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; clock: number } | null = null;
  private glowClock = 0;
  private ringsShown = 1; // 0..1: how far every ring is in (0 on the title and in the maker)
  private readonly RING_FADE_NEAR = 2.2; // lens ≤ this from a ring ⇒ fully faded (it's under/around the ranger)
  private readonly RING_FADE_FAR = 4.2;  // lens ≥ this ⇒ full "go here" opacity (normal approach/standing boom ~4.6 m)
  private activeId: string | null = null;     // the mission the wayfinding cue points to
  private labelsOn = true;                     // false while an in-place activity runs (W6.1)
  private lastWayKey = '';                     // debounce identical cues (no DOM churn)
  // the steady arrow (parent B1, child B10): one route followed with memory, words that
  // never flicker, and the pose they were last worked out for (to re-send them at once)
  private guide: RouteGuide | null = null;
  /** the solids a route walks round (built once, on first use: by then every building stands) */
  private routes: RouteMap | null = null;
  private readonly steady = new SteadyCue();
  private lastPose: { x: number; z: number; facing: number } | null = null;
  private readonly onApproach: (missionId: string | null) => void;
  private readonly onInteract: (missionId: string) => void;
  private readonly onWayfind: (cue: WayCue | null) => void;
  // P1.0 (F-19): the board is statically turned toward the +x side the camera rig swings
  // to when the ranger stands at it, so its face + papers stay readable at that angle.
  private readonly BOARD_APPROACH_FACE_TURN = 0.5; // static board face turn (rad) toward the +x approach view
  private readonly scene: THREE.Scene;
  private readonly terrain: Terrain;
  private readonly obstacles: Obstacle[];
  private readonly limits: MoveLimits | null;
  private readonly labels: Labels;

  constructor(
    env: { scene: THREE.Scene; terrain: Terrain; obstacles: Obstacle[]; labels: Labels; limits?: MoveLimits },
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
    this.limits = env.limits ?? null;
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
        // the stuifzand diagonal is the jeep's parking bay and the helicopter apron
        // (world/Vehicles.ts): its marker stands a little to the side, so the mission's
        // nightjar never hides behind a parked jeep. The heide's later missions fan out
        // left and right of the first one's line, so from the clearing their animals and
        // name tags never stand stacked behind each other.
        const fan = n > 0 ? (n % 2 ? 1 : -1) * (ANCHOR_FAN[mk.biome] ?? 0) : 0;
        const turn = (ANCHOR_TURN[mk.biome] ?? 0) + fan;
        if (turn) {
          const r = Math.hypot(x, z), ang = Math.atan2(z, x) + turn;
          const tx = Math.cos(ang) * r, tz = Math.sin(ang) * r;
          if (biomeAt(tx, tz) === mk.biome) { x = tx; z = tz; }
        }
      } else {
        const ang = (i / N) * Math.PI * 2;
        x = Math.cos(ang) * 9; z = Math.sin(ang) * 9;
      }
      const group = new THREE.Group();
      group.position.set(x, this.groundY(x, z), z);

      // a soft halo ring so every marker reads as "go here", model or totem
      const ring = this.haloRing(mk.color, x, z, group.position.y, 0);
      group.add(ring);
      this.groundRings.push({ mat: ring.material as THREE.MeshBasicMaterial, x, z, base: 0.5, mesh: ring, glow: 0, pulse: 0 }); // D3.16: fade near the lens

      // a small diegetic name-tag floating above the marker (in-world label, no
      // minimap chrome) — a camera-facing sprite so it stays readable from any angle
      const label = this.labels.make(mk.titel, mk.color);
      label.position.y = 1.9;
      group.add(label);

      group.add(proceduralTotem(mk.color)); // instant stand-in
      this.scene.add(group);
      const entry = {
        group, pos: group.position.clone(), missionId: mk.missionId,
        recipe: gaitFor(mk.modelId), phase: i * 1.7, label, titel: mk.titel,
        ring: ring.material as THREE.MeshBasicMaterial, finished: false,
        anim: null as THREE.Group | null, mixer: null as THREE.AnimationMixer | null,
        model: null as THREE.Group | null, rest: new FarRest(ANIMAL_REST_NEAR, ANIMAL_REST_FAR),
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
          mergeColourSplits(prepped); // one draw call per animal, not one per colour
          // drop the totem (keep the ring), add the real animal
          const totem = group.children.find((c) => c.userData.totem);
          if (totem) group.remove(totem);
          group.add(prepped);
          entry.model = prepped;
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
    this.syncAlways(); // the next mission's tag reads from afar (run 6)
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
    const ring = this.haloRing('#f5c23b', boardAt.x, boardAt.z, boardAt.y, board.rotation.y);
    board.add(ring);
    this.groundRings.push({ mat: ring.material as THREE.MeshBasicMaterial, x: boardAt.x, z: boardAt.z, base: 0.5, mesh: ring, glow: 0, pulse: 0 }); // D3.16
    // the board's tag reads from further than the rest (20 m): it is the hub of the clearing
    const label = this.labels.make(TAG.missiebord, '#f5c23b', { reach: 20 });
    this.boardLabel = label;
    label.position.y = 2.0;
    board.add(label);
    this.scene.add(board);
    this.obstacles.push(boxObstacle(boardAt.x, boardAt.z, 0.83, 0.24, board.rotation.y)); // its real footprint (wave 2)
    this.boardGroup = board;
    this.boardPos = boardAt.clone();
    void loadModel('prop-case-board').then((m) => {
      if (!m) return;
      const prepped = prepModel(m, SIZE.missiebord.h);
      const totem = board.children.find((c) => c.userData.totem);
      if (totem) board.remove(totem);
      board.add(prepped); // keep the ring + label
    });
  }

  /**
   * Run 6 (FLOW P4): the hut's porch — a halo ring on the ground in front of its door and a
   * tag over it, hidden until `showPorch(true)` (Bram told about the young raaf, or the raaf
   * lives there). `door`: the spot before the door, on the clearing side.
   */
  placePorch(door: { x: number; z: number }): void {
    const at = new THREE.Vector3(door.x, 0, door.z);
    at.y = this.groundY(at.x, at.z);
    const group = new THREE.Group();
    group.position.copy(at);
    group.visible = false;
    const ring = this.haloRing('#f5c23b', at.x, at.z, at.y, 0);
    group.add(ring);
    this.groundRings.push({ mat: ring.material as THREE.MeshBasicMaterial, x: at.x, z: at.z, base: 0.5, mesh: ring, glow: 0, pulse: 0 });
    const label = this.labels.make(TAG.hut, '#f5c23b', { reach: 20 });
    label.position.y = 2.0;
    group.add(label);
    this.scene.add(group);
    this.porch = { group, pos: at.clone(), label, tag: TAG.hut };
  }

  /** Show (or hide) the porch ring and its tag; `tag`: the words on it (the raaf's name
   *  once it lives there). Idempotent. */
  showPorch(on: boolean, tag?: string): void {
    const p = this.porch;
    if (!p) return;
    if (tag && tag !== p.tag) { p.tag = tag; this.labels.retitle(p.label, tag, '#f5c23b'); }
    if (p.group.visible === on) return;
    p.group.visible = on;
    if (!on && this.nearPorch) { this.nearPorch = false; this.onPorchNear(false); }
  }

  /** The porch's ring and tag glow for `seconds` of being seen (Bram just told about it). */
  glowPorch(seconds: number): void {
    const p = this.porch;
    if (!p) return;
    this.labels.setGlow(p.label, seconds);
    const r = this.groundRings.find((g) => g.x === p.pos.x && g.z === p.pos.z);
    if (r) { r.glow = seconds; r.glowTag = p.label; }
  }

  /** Register the porch callbacks: `onNear` as the ranger enters/leaves its ring, `onOpen`
   *  when he acts on it (the prompt or the interact key). */
  setPorch(cbs: { onNear: (near: boolean) => void; onOpen: () => void }): void {
    this.onPorchNear = cbs.onNear;
    this.onPorchOpen = cbs.onOpen;
  }

  /** The porch for the dev hook: where it is, whether it shows and he stands in it. */
  porchState(): { x: number; z: number; shown: boolean; near: boolean; tag: string } | null {
    const p = this.porch;
    return p ? { x: p.pos.x, z: p.pos.z, shown: p.group.visible, near: this.nearPorch, tag: p.tag } : null;
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
    const ring = this.haloRing('#8ab6d6', at.x, at.z, at.y, group.rotation.y);
    group.add(ring);
    this.groundRings.push({ mat: ring.material as THREE.MeshBasicMaterial, x: at.x, z: at.z, base: 0.5, mesh: ring, glow: 0, pulse: 0 }); // D3.16
    const label = this.labels.make(ROEP_COPY.wayfinding, '#cfe6f2');
    label.position.y = 1.7;
    group.add(label);
    this.scene.add(group);
    this.obstacles.push({ x: at.x, z: at.z, r: 0.5 });
    this.sitSpotGroup = group;
    this.sitSpotPos = at.clone();
  }

  /**
   * The "go here" halo: a flat ring laid ON the rendered ground — every vertex seated
   * on the terrain under it (5 cm proud), so on a slope it follows the ground instead
   * of sinking half under the hill. Built in the local frame of a group standing at
   * (x, y0, z) turned by `yaw`.
   */
  private haloRing(color: string, x: number, z: number, y0: number, yaw: number): THREE.Mesh {
    const geo = new THREE.RingGeometry(0.9, 1.15, 32, 2);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyAxisAngle(up, yaw); // local → world offset
      pos.setY(i, this.groundY(x + v.x, z + v.z) - y0 + 0.05);
    }
    pos.needsUpdate = true;
    geo.computeBoundingSphere();
    return new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
    );
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

  /**
   * A finished mission's marker (felt progress, world/Progress.ts adds its tableau):
   * the halo turns a calm green and the tag reads "✓ <titel>" — colour + glyph + word,
   * so "klaar" reads at a glance. Idempotent; the tag keeps its sprite (and its fade).
   */
  setFinished(missionId: string): void {
    const m = this.list.find((k) => k.missionId === missionId);
    if (!m || m.finished) return;
    m.finished = true;
    m.ring.color.set(FINISHED_COLOR);
    const ring = this.groundRings.find((r) => r.mat === m.ring);
    if (ring) ring.base = 0.85; // a full, calm "klaar" halo (it still fades near the lens)
    m.ring.opacity = Math.max(m.ring.opacity, 0.85);
    this.labels.retitle(m.label, `✓ ${m.titel}`, FINISHED_COLOR); // same sprite, new words
  }

  /** Point the wayfinding cue at a mission (after one is completed, or when the HUD is
   *  drawn afresh) and send the cue for it at once, from where the ranger stands: a new
   *  chip never waits for his first step (parent B12). The same mission keeps its route. */
  setActiveMission(id: string | null): void {
    if (id !== this.activeId) { this.guide?.reset(); this.steady.reset(); }
    this.activeId = id;
    this.lastWayKey = '';
    this.syncAlways();
    if (this.lastPose) this.updateWayfinding(this.lastPose.x, this.lastPose.z, this.lastPose.facing);
  }

  // ---- run 6 (FLOW lane): the tag that matters, and glowing "go here" cues -----------
  /** Whether the next mission's tag may show from afar (false until Bram's hook). */
  setNextRevealed(on: boolean): void {
    this.nextRevealed = on;
    this.syncAlways();
  }

  /** Only the next mission's tag shows at any distance (the rest near the ranger). */
  private syncAlways(): void {
    for (const m of this.list) this.labels.setAlways(m.label, this.nextRevealed && m.missionId === this.activeId);
  }

  /** The next mission's ring and tag glow for `seconds` (Bram just named it). */
  glowActive(seconds: number): void {
    const m = this.activeId ? this.list.find((k) => k.missionId === this.activeId) : null;
    if (!m) return;
    this.labels.setGlow(m.label, seconds);
    const r = this.groundRings.find((g) => g.mat === m.ring);
    if (r) { r.glow = seconds; r.glowTag = m.label; }
  }

  /** The missiebord's ring and tag glow for `seconds` (more work waits there). */
  glowBoard(seconds: number): void {
    if (this.boardLabel) this.labels.setGlow(this.boardLabel, seconds);
    const r = this.boardPos ? this.groundRings.find((g) => g.x === this.boardPos!.x && g.z === this.boardPos!.z) : null;
    if (r) { r.glow = seconds; r.glowTag = this.boardLabel; }
  }

  /** Whether the next mission's tag / the board's tag glows now (dev hook). */
  glowState(): { next: boolean; board: boolean; beacon: boolean; porch: boolean } {
    const m = this.activeId ? this.list.find((k) => k.missionId === this.activeId) : null;
    return {
      next: !!m && this.labels.glowing(m.label),
      board: !!this.boardLabel && this.labels.glowing(this.boardLabel),
      beacon: !!this.beacon?.mesh.visible,
      porch: !!this.porch && this.labels.glowing(this.porch.label),
    };
  }

  /** A warm glowing ring on the ground round a spot (the parked jeep Bram points at), or
   *  none (`null`). One mesh, made on first use; laid on the ground where it is put. */
  setBeacon(at: { x: number; z: number; r: number } | null): void {
    if (!at) { if (this.beacon) this.beacon.mesh.visible = false; return; }
    if (this.beacon) { this.scene.remove(this.beacon.mesh); this.beacon.mesh.geometry.dispose(); this.beacon.mat.dispose(); }
    const y0 = this.groundY(at.x, at.z);
    const geo = new THREE.RingGeometry(at.r, at.r + 0.32, 48, 2);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, this.groundY(at.x + pos.getX(i), at.z + pos.getZ(i)) - y0 + 0.06);
    pos.needsUpdate = true;
    geo.computeBoundingSphere();
    const mat = new THREE.MeshBasicMaterial({ color: '#f5c23b', transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(at.x, y0, at.z);
    this.scene.add(mesh);
    this.beacon = { mesh, mat, clock: 0 };
  }

  /** Per frame: the glowing rings breathe (a steady glow under reduced motion). */
  private stepGlow(dt: number, reduced: boolean): void {
    this.glowClock += dt;
    const breath = reduced ? 1 : 0.5 - 0.5 * Math.cos((this.glowClock / 1.6) * Math.PI * 2);
    for (const r of this.groundRings) {
      if (r.glow <= 0 && r.pulse === 0) continue;
      // a ring glows as long as its tag does (the tag's glow counts only while it is seen)
      if (r.glowTag) { if (!this.labels.glowing(r.glowTag)) { r.glow = 0; r.glowTag = null; } }
      else r.glow = Math.max(0, r.glow - dt);
      r.pulse = r.glow > 0 ? breath : 0;
      const s = r.glow > 0 ? 1 + (reduced ? 0.06 : 0.1 * breath) : 1;
      r.mesh.scale.set(s, 1, s);
    }
    const b = this.beacon;
    if (b?.mesh.visible) {
      b.mat.opacity = (0.55 + 0.35 * breath) * this.ringsShown;
      const s = reduced ? 1 : 1 + 0.05 * breath;
      b.mesh.scale.set(s, 1, s);
    }
  }
  // ---- end run 6 -------------------------------------------------------------------

  /** What a route may not cross off the sand: the buildings (the cabin and the
   *  landmarks, every big solid box) and the ven's water, where he stops at the shore.
   *  Built once, on the first cue: by then every building stands. */
  private routeMap(): RouteMap {
    if (this.routes) return this.routes;
    const solids: Obstacle[] = this.obstacles.filter((o) => !!o.box && o.r >= 2);
    solids.push({ x: VEN_CENTER.x, z: VEN_CENTER.z, r: 18 }); // the submerged ven (World.limits.blocked)
    const lim = this.limits;
    this.routes = new RouteMap(solids, (x, z) => !lim || (Math.hypot(x, z) < lim.bound - 1 && !lim.blocked?.(x, z)));
    return this.routes;
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
    this.stepGlow(dt, reduced);
    for (const mk of this.list) {
      // far off, half in the fog, the animal fades out and rests (not drawn): a whole
      // Veluwe of markers in one view stays inside the draw-call budget
      if (mk.model && this.lens.seen) restFar(mk.model, mk.rest.step(Math.hypot(this.lens.x - mk.pos.x, this.lens.z - mk.pos.z), dt, reduced));
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
    if (near !== this.nearId) {
      this.nearId = near;
      this.onApproach(near);
      this.syncLabels();
    }
    if (this.boardPos) {
      const nb = Math.hypot(this.boardPos.x - x, this.boardPos.z - z) < NEAR_R;
      if (nb !== this.nearBoard) { this.nearBoard = nb; this.onBoardNear(nb); }
    }
    if (this.sitSpotPos) {
      const ns = Math.hypot(this.sitSpotPos.x - x, this.sitSpotPos.z - z) < NEAR_R;
      if (ns !== this.nearSitSpot) { this.nearSitSpot = ns; this.onSitSpotNear(ns); }
    }
    const p = this.porch;
    if (p) {
      const np = p.group.visible && Math.hypot(p.pos.x - x, p.pos.z - z) < NEAR_R;
      if (np !== this.nearPorch) { this.nearPorch = np; this.onPorchNear(np); }
    }
  }

  /**
   * The wayfinding cue to the active mission — calm direction + distance, no minimap.
   * W4.3: the ARROW aims along the route (RouteGuide: the sand paths when they are worth
   * it, round the buildings and the water) while the distance and "je bent er" stay
   * measured to the real marker. The words hold steady (SteadyCue); the chip's arrow
   * turns with the bearing, so it is sent again whenever that turns by a few degrees.
   */
  updateWayfinding(x: number, z: number, facing: number): void {
    this.lastPose = { x, z, facing };
    const goal = this.activeId ? this.list.find((m) => m.missionId === this.activeId) : null;
    if (goal) {
      this.guide ??= new RouteGuide(this.routeMap());
      const wp = this.guide.aim(x, z, goal.pos.x, goal.pos.z);
      const angle = bearing(x, z, facing, wp.x, wp.z);
      const dist = distanceTo(x, z, goal.pos.x, goal.pos.z);
      const cue = this.steady.update(angle, dist, performance.now());
      const key = `${cue.glyph}|${cue.richting}|${cue.afstand}|${Math.round(angle / ARROW_STEP)}`;
      if (key !== this.lastWayKey) { this.lastWayKey = key; this.onWayfind(cue); }
    } else if (this.lastWayKey !== '') {
      this.lastWayKey = ''; this.onWayfind(null);
    }
  }

  /**
   * Where the ranger stands when a mission is brought to him (World.bringRangerTo: one
   * picked on the missiebord, or "Volgende"): 1.8 m out from its marker where the arrow
   * would have brought him walking from `from` (Paths.arrivalSpot: along the trail, round
   * the ven), on dry, open ground (searched round the ring), turned toward the marker —
   * and, where the ground right past it is no place for a game (the ven's water), turned
   * along it (up to 50°) until the ground ahead is open (`clear`: the World's own test
   * for a play patch). The stage lays the first game straight ahead of the lens, so it is
   * framed with no turn, by the water. Facing straight into the ven, the stage swung the
   * lens round ~200° and the frog's game played on dry heath (parent B6). Null for an
   * unknown marker.
   */
  approachSpot(
    missionId: string,
    from: { x: number; z: number },
    clear: (x: number, z: number) => boolean = (x, z) => this.standable(x, z),
  ): { x: number; z: number; yaw: number } | null {
    const m = this.list.find((k) => k.missionId === missionId);
    if (!m) return null;
    const came = arrivalSpot(from.x, from.z, m.pos.x, m.pos.z, this.routeMap());
    const base = Math.atan2(came.x - m.pos.x, came.z - m.pos.z); // from the marker toward where he comes in
    const at = (a: number, r: number) => {
      const x = m.pos.x + Math.sin(a) * r, z = m.pos.z + Math.cos(a) * r;
      return { x, z, yaw: Math.atan2(m.pos.x - x, m.pos.z - z) };
    };
    for (const r of [1.8, 2.1, 1.5]) {
      for (let k = 0; k < 16; k++) {
        const s = at(base + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 8), r);
        if (this.standable(s.x, s.z)) return { ...s, yaw: openHeading(s.x, s.z, s.yaw, clear) };
      }
    }
    return at(base, 1.8);
  }

  /** Dry, inside the world and clear of every solid (with a little room). */
  private standable(x: number, z: number): boolean {
    const lim = this.limits;
    if (lim && (Math.hypot(x, z) > lim.bound - 2 || lim.blocked?.(x, z))) return false;
    for (const o of this.obstacles) if (obstacleGap(o, x, z) < 0.35) return false;
    return true;
  }

  /** The interact key at the hub, the sit-spot or a marker (W1.4/W2.2/W6.4b2), in
   *  that order. False when the ranger stands at none of them. */
  interact(): boolean {
    if (this.nearBoard) { this.onBoardOpen(); return true; }
    if (this.nearPorch) { this.onPorchOpen(); return true; }
    if (this.nearSitSpot) { this.onSitSpotActivate(); return true; }
    if (this.nearId) { this.onInteract(this.nearId); return true; }
    return false;
  }

  /** Boarding a vehicle: drop the walk-time marker + hub prompts so nothing lingers
   *  behind the "Stap uit" pill. */
  clearForVehicle(): void {
    if (this.nearId) { this.nearId = null; this.onApproach(null); this.syncLabels(); }
    if (this.nearBoard) { this.nearBoard = false; this.onBoardNear(false); }
    if (this.nearPorch) { this.nearPorch = false; this.onPorchNear(false); }
  }

  /** How far every "go here" ring is in: 0 while the world is presented (the title, the
   *  maker), easing back to 1 once the follow camera has the lens (World steps it). */
  setRingsShown(k: number): void {
    this.ringsShown = Math.max(0, Math.min(1, k));
    for (const r of this.groundRings) r.mat.visible = this.ringsShown > 0;
  }

  /** W6.1: hide the floating mission name-tags during an in-place activity (so a label
   *  the reframe keeps in view never overlaps the play prompt), restore them after. */
  setLabelsVisible(visible: boolean): void {
    this.labelsOn = visible;
    this.syncLabels();
  }

  /** The tags show, except during an activity and over the marker the ranger stands at:
   *  its prompt already names it, and its tag would float big right in front of the lens. */
  private syncLabels(): void {
    for (const m of this.list) {
      m.label.visible = this.labelsOn && m.missionId !== this.nearId;
      // while its mission plays, the marker's own halo would lie right under the play
      // view (a big ring filling the frame between two games): it steps away too
      const ring = m.group.children.find((c) => (c as THREE.Mesh).material === m.ring);
      if (ring) ring.visible = this.labelsOn || m.missionId !== this.nearId;
    }
  }

  /**
   * While a mission plays at its marker, the marker (its animal, its halo) and a
   * finished family around it step out of the scene for the WHOLE mission — not
   * per game, so nothing pops back in front of the lens between two games. `null`
   * brings them back (the mission ended, or its reunion is about to play).
   */
  hideForActivity(missionId: string | null): void {
    for (const m of this.list) {
      const away = m.missionId === missionId;
      const all = [m.group, ...((m.group.userData.companions as THREE.Object3D[] | undefined) ?? [])];
      for (const o of all) {
        if (away && o.userData.awayWas === undefined) { o.userData.awayWas = o.visible; o.visible = false; }
        if (!away && o.userData.awayWas !== undefined) { o.visible = o.userData.awayWas as boolean; delete o.userData.awayWas; }
      }
    }
  }

  /** After an in-place activity: forget every proximity + the last cue so the next
   *  frame re-fires them (re-surfaces the hub / sit-spot prompt and the cue). */
  resetAfterActivity(): void {
    this.nearId = null;
    this.nearBoard = false;
    this.nearPorch = false;
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
    const cx = camera.position.x, cz = camera.position.z;
    this.lens.x = cx; this.lens.z = cz; this.lens.seen = true; // (the far marker animals rest by it: animate)
    if (this.groundRings.length === 0) return;
    const span = this.RING_FADE_FAR - this.RING_FADE_NEAR;
    for (const r of this.groundRings) {
      const d = Math.hypot(cx - r.x, cz - r.z);
      const k = Math.max(0, Math.min(1, (d - this.RING_FADE_NEAR) / span));
      const base = r.glow > 0 ? Math.max(r.base, 0.62 + 0.33 * r.pulse) : r.base; // run 6: a glowing ring
      const o = base * k * this.ringsShown;
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
