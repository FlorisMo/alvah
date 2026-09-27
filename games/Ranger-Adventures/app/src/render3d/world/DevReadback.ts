/**
 * world/DevReadback.ts — what the dev hook (`?dev=1`, window.__ranger) reads back.
 *
 * The honest read-backs the e2e specs and the playtest scripts grade: the REAL render
 * camera (framing, visibility against terrain / props / animals / canopy, zoom, orbit,
 * the task-in-view proof), the ranger's feet against the drawn ground, the board in
 * frame, the world rim, the lighting, the sky and the ground detail. Read-only: it
 * never changes the world. Pixels outrank every number here.
 */

import * as THREE from 'three';
import { skinnedRenderBox } from '../Models';
import { obstacleGap, segmentCrosses, type MoveLimits, type Obstacle } from '../CharacterController';
import type { CamState } from '../../core/devhook';
import { wrapAngle } from '../FollowCam';
import type { Terrain } from './Terrain';
import type { Sky } from './Sky';
import type { Dressing } from './Dressing';
import type { Fauna } from './Fauna';
import type { Markers } from './Markers';
import type { Vehicles } from './Vehicles';
import type { Player } from './Player';
import type { CameraRig } from './CameraRig';

// `grounded` band for the dev-hook court check (P1.5a asserts it across the world):
// after the snap the feet sit ON the rendered surface, so clearance ≈ 0. A few cm of
// float tolerance absorbs numeric wobble; more than SINK below or AIR above is "not
// grounded" (the pre-fix analytic Y-write buried him ~4 m at the ven — clearance ≪ 0).
const GROUND_SINK_TOL = 0.06; // feet may sit at most 6 cm below the rendered surface
const GROUND_AIR_TOL = 0.60;  // and at most 60 cm above it (a step), else airborne

/** The live world state the read-backs need that no module owns. */
export interface ReadbackHost {
  renderer(): THREE.WebGLRenderer | null;
  activityActive(): boolean;
  activityFocus(): { x: number; y: number; z: number } | null;
}

export class DevReadback {
  private readonly _camPose = new THREE.Vector3();  // scratch: camera world forward
  private readonly _camBox = new THREE.Box3();       // scratch: ranger bbox for pose reads
  private readonly camera: THREE.PerspectiveCamera;
  private readonly terrain: Terrain;
  private readonly obstacles: Obstacle[];
  private readonly limits: MoveLimits;
  private readonly sky: Sky;
  private readonly dressing: Dressing;
  private readonly fauna: Fauna;
  private readonly pois: Markers;
  private readonly vehicles: Vehicles;
  private readonly player: Player;
  private readonly cam: CameraRig;
  private readonly host: ReadbackHost;

  constructor(
    w: {
      camera: THREE.PerspectiveCamera; terrain: Terrain; obstacles: Obstacle[]; limits: MoveLimits;
      sky: Sky; dressing: Dressing; fauna: Fauna; pois: Markers; vehicles: Vehicles; player: Player; cam: CameraRig;
    },
    host: ReadbackHost,
  ) {
    this.camera = w.camera;
    this.terrain = w.terrain;
    this.obstacles = w.obstacles;
    this.limits = w.limits;
    this.sky = w.sky;
    this.dressing = w.dressing;
    this.fauna = w.fauna;
    this.pois = w.pois;
    this.vehicles = w.vehicles;
    this.player = w.player;
    this.cam = w.cam;
    this.host = host;
  }

  /** Dev-hook accessor (W2.2): the spawn case-board's world position + whether the
   *  ranger currently stands in its radius — lets the E2E steer to the hub and know
   *  it has arrived. `null` before the hub is placed. */
  boardState(): { x: number; z: number; near: boolean; inFrustum: boolean } | null {
    if (!this.pois.boardPos) return null;
    // P1.0 (F-19): is the board FACE/papers point (~1.4 m up = the pinned-notes band)
    // actually inside the live view frustum? The board-affordance assert reads this
    // TRUE while `near` to prove the approach framing keeps the board (not just the
    // ranger's back) in shot. Pixels stay the court of appeal (AUDIT-FINDINGS §4).
    const inFrustum = this.pointInFrustum(
      this.pois.boardPos.x, this.terrain.y(this.pois.boardPos.x, this.pois.boardPos.z) + 1.4, this.pois.boardPos.z,
    );
    return { x: this.pois.boardPos.x, z: this.pois.boardPos.z, near: this.pois.nearBoard, inFrustum };
  }

  /** P1.0 dev-hook helper: is the world point (x,y,z) inside the live camera view
   *  frustum? Same plane-distance idiom as camState's landmark test, built off the
   *  ACTUAL render camera (fresh matrices) so a board-in-frustum claim can never sit
   *  on a stale matrix. Dev-hook-only (read at capture time), so the per-call Frustum
   *  build is fine. */
  private pointInFrustum(x: number, y: number, z: number): boolean {
    const cam = this.camera;
    cam.updateMatrixWorld();
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    const fr = new THREE.Frustum().setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse),
    );
    const p = new THREE.Vector3(x, y, z);
    for (const plane of fr.planes) if (plane.distanceToPoint(p) < 0) return false;
    return true;
  }

  /** Dev-hook accessor (F-11): the world-rim state — `bound` (the move-limit radius,
   *  m), the ranger's live `dist` from world centre, and `atRim` (he is pressed
   *  against the rim heading outward, so the "Hier stopt het bos" cue has fired). The
   *  P4.6 assert reads `dist` ≤ `bound` (clamped, never beyond) with `atRim` true
   *  after an outward walk — the gentle stop, not an invisible wall. `scatterMax` is the
   *  furthest LOW ground-tuft radius (heather/marram). */
  boundaryState(): { bound: number; dist: number; atRim: boolean; scatterMax: number } {
    const p = this.player.group.position;
    return { bound: this.limits.bound, dist: Math.hypot(p.x, p.z), atRim: this.player.atBoundary, scatterMax: this.dressing.scatterMax };
  }

  /** Dev-hook accessor (F-05 ⊕ F-18): the REAL render camera, read back off the
   *  actual `this.camera` object (position + world quaternion) and the ranger's
   *  live bbox — NOT the follow bearing that lied in Run A. `dist` is the true
   *  camera→ranger-centre boom length (the field F-16's zoom also reads); `yaw`
   *  and `pitch` come from the camera's own forward vector; `avatarInView` tests
   *  the ranger's whole box against the live view frustum (F-05's "avatar bbox
   *  inside the frustum" assert). Any camera claim is graded off these, and the
   *  pixels outrank them if they ever disagree (§4). Null before the world is up. */
  camState(): CamState | null {
    if (this.player.group.children.length === 0) return null;
    const cam = this.camera;
    cam.updateMatrixWorld();
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert(); // fresh frustum, not last-render's
    // ranger centre from the SKELETON box (F-07): the extent that actually renders,
    // so dist / avatarInView / avatarScreen can't sit on the bind-pose box that
    // once framed a 1.7 m phantom while a ~170 m giant filled the lens (§4).
    const box = skinnedRenderBox(this.player.group) ?? this._camBox.setFromObject(this.player.group);
    const centre = box.getCenter(new THREE.Vector3());
    const dist = cam.position.distanceTo(centre);
    // yaw/pitch from the camera's OWN forward vector (world quaternion), so the
    // value is whatever the render actually shows — the F-18 cross-check.
    const fwd = cam.getWorldDirection(this._camPose);
    const yaw = wrapAngle(Math.atan2(fwd.x, fwd.z) + Math.PI);
    const pitch = Math.asin(Math.max(-1, Math.min(1, fwd.y)));
    // whole-box-in-frustum: build the frustum from the live view-projection and
    // require every bbox corner inside it (fully visible, not merely intersecting).
    const frustum = new THREE.Frustum().setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse),
    );
    const min = box.min, max = box.max;
    let avatarInView = true;
    for (let i = 0; i < 8 && avatarInView; i++) {
      const corner = this._camPose.set(
        i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z,
      );
      for (const plane of frustum.planes) {
        if (plane.distanceToPoint(corner) < 0) { avatarInView = false; break; }
      }
    }
    // Framing machine signal (F-05 / Run B monitor steer #2): project the ranger's
    // bbox to normalised screen space so a grade can PROVE he is framed rather than
    // infer it from a soft-DOF frame. `heightFrac` (box top→bottom, projected)
    // catches the "solid but a distant speck" frame that avatarInView alone passes.
    const wx = centre.x, wz = centre.z; // keep world x/z before `centre` is spent
    const topY = this._camPose.set(wx, max.y, wz).project(cam).y;
    const botY = this._camPose.set(wx, min.y, wz).project(cam).y;
    // F-11 TERRAIN-occlusion-aware visibility: the frustum/projection tests above stay
    // TRUE when something stands BETWEEN the lens and the ranger (projection cannot see
    // an occluder in the way). The terrain: march the ground height field along the
    // sightline lens→ranger, hidden if it climbs above the line (test his head AND chest
    // so a crest that only clips his legs still reads visible). The rim tree-line is no
    // special case any more: the lens may stand among the rim trees, and they are trees
    // like any other (viewClear below). Folded with onScreen + the fade into `visible`.
    // Pixels remain the court (§4).
    const headClear = this.terrainClearTo(cam.position, wx, max.y - 0.15, wz);
    const chestClear = this.terrainClearTo(cam.position, wx, (min.y + max.y) * 0.5, wz);
    const ndc = centre.project(cam); // centre → NDC in [-1, 1]³ (mutates in place)
    const onScreen = ndc.z > -1 && ndc.z < 1 && Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1;
    // The clear line: the REAL lens→target occluder read CameraRig.place made this frame —
    // every tree in the way is faded below see-through (world/Crowns.ts, the one tree model),
    // no unfadeable tree, no dune the eye could not rise over — for the walk AND the jeep /
    // helicopter chase cams (their target is the seated ranger, i.e. the vehicle: parent B3,
    // where a chase lens buried in rim crowns read clear). Only a mission's reframe, which
    // owns its framing, reads clear. D3.16: fold in EVERY other rendered occluder class on the
    // lens→target line — solid props + the parked vehicles (propBlocksSightline) and staged
    // animals / marker models (animalBlocksSightline). These are UNFADEABLE, so a hit reports
    // `viewClear` FALSE (honest) rather than ghosting them. Tested HERE, per-SHOT, not in the
    // per-frame CameraRig.place: they only drive the hook (no fade), so the walk pays nothing.
    const rp = this.player.group.position;
    const aloft = this.vehicles.inHeli && rp.y - this.terrain.y(rp.x, rp.z) > 8; // flying high over the props
    const viewClear = this.host.activityActive()
      ? true
      : this.cam.viewClearState
        && (aloft || !this.propBlocksSightline(cam.position.x, cam.position.z, rp.x, rp.z))
        && !this.animalBlocksSightline(cam.position.x, cam.position.y, cam.position.z, rp.x, rp.y, rp.z);
    // D1.7: the RENDERED body opacity read off the shared materials — NOT the
    // `avatarOpacity` intent field, which lied 1 over an invisible ranger on the
    // title-return path. `visible` folds it in, so the hook matches the pixels: a
    // ~0-opacity body (shadow still casting) reads not-visible (§8.7).
    const renderedOpacity = this.player.renderedAvatarOpacity();
    const avatarScreen = {
      x: ndc.x, y: ndc.y,
      onScreen,
      heightFrac: Math.abs(topY - botY) / 2,
      visible: onScreen && renderedOpacity > 0.5 && (headClear || chestClear) && viewClear,
    };
    // F-09 hub-in-frustum: is at least one hub landmark actually in this frame? The
    // world-entry assert reads it to PROVE the spawn faces the hub, not the void —
    // `landmarkInView` == true means the cabin, the mission board, or a fixed beacon
    // sits inside the live view frustum (the pixels stay the court of appeal, §4).
    // Same plane-distance idiom as avatarInView above (no new three API); the point
    // is lifted a metre so a prop whose base grazes the bottom plane still counts.
    const hub = new THREE.Vector3();
    const ptInFrustum = (px: number, pz: number): boolean => {
      hub.set(px, this.terrain.y(px, pz) + 1.0, pz);
      for (const plane of frustum.planes) if (plane.distanceToPoint(hub) < 0) return false;
      return true;
    };
    let landmarkInView =
      (this.dressing.cabinPos != null && ptInFrustum(this.dressing.cabinPos.x, this.dressing.cabinPos.z)) ||
      (this.pois.boardPos != null && ptInFrustum(this.pois.boardPos.x, this.pois.boardPos.z));
    for (let i = 0; !landmarkInView && i < this.dressing.landmarks.length; i++) {
      landmarkInView = ptInFrustum(this.dressing.landmarks[i].x, this.dressing.landmarks[i].z);
    }
    // D1.3 mission-entry camera truth. `groundAtCam` = the drawn terrain height
    // under the lens; a game-3D reframe assert reads
    // `y > groundAtCam` so a below-ground entry (fresh simon-3D, cam.y −1.29) is caught.
    const groundAtCam = this.terrain.y(cam.position.x, cam.position.z);
    // `taskInView` = the running activity's task anchor (its staging centre, a hair
    // above the ground so a form/footprint at the spot still counts) sits inside the
    // live frustum — proving the reframe lands ON the playfield, not on a backside or
    // bare ground off the field. null in free-roam (no in-place activity owns the cam).
    let taskInView: boolean | null = null;
    const focus = this.host.activityFocus();
    if (this.host.activityActive() && focus) {
      const f = focus;
      hub.set(f.x, f.y + 0.4, f.z);
      taskInView = true;
      for (const plane of frustum.planes) if (plane.distanceToPoint(hub) < 0) { taskInView = false; break; }
    }
    // F-16 dolly-zoom read-back: the player-set walk boom clamped to its live bounds,
    // so a grade proves the wheel respects BOTH clamps straight off the annotation
    // (`zoom.dist` ∈ [min, max] as an invariant; wheel-in saturates to min, wheel-out
    // to max). `fov` is the fixed lens — a dolly must never change it, so the assert
    // reads it constant across the zoom pair. `dist` above (the real 3D boom) still
    // outranks these if the pixels ever disagree (§4).
    const zoomMin = this.cam.zoomMinBoom();
    const zoomDist = Math.max(zoomMin, Math.min(this.cam.CAM_ZOOM_MAX, this.cam.zoomDist));
    return {
      dist, yaw, pitch,
      x: cam.position.x, y: cam.position.y, z: cam.position.z,
      target: this.vehicles.inVehicle ? 'vehicle' : 'avatar', avatarInView,
      fov: this.camera.fov,
      zoom: { dist: zoomDist, min: zoomMin, max: this.cam.CAM_ZOOM_MAX },
      // F-17 drag-orbit read-back: the player's look offset on the follow bearing. A drag
      // moves `yaw` (and `lift`) while `pos` holds; a clean click walks and never touches
      // it. The real render `yaw` above (quaternion) stays the court of appeal (§4).
      orbit: { yaw: this.cam.orbitYaw, lift: this.cam.orbitLiftMetres() },
      // D1.7: the RENDERED body opacity (read off the shared materials), NOT the
      // fade-rail INTENT field — which lied 1 over an invisible ranger after a
      // title round-trip (`14-title-return-world`: shadow cast, body unrendered;
      // the shared rig materials were left transparent and a fresh World's
      // avatarOpacity==1 guard never restored them, §8.7). 1 = the ranger renders
      // solid; anything < 1 flags an empty/faded frame BEFORE the judge looks, and
      // now it cannot be faked by the intent field. In the normal case (a settled
      // hero/POI shot, or the F-05 boom fade) this equals the applied fade, so the
      // F-07 machine signal is unchanged; only the title-return lie is caught.
      avatarOpacity: renderedOpacity,
      avatarScreen,
      viewClear,
      canopyFade: this.dressing.canopyOpacity,
      terrainLift: this.cam.terrainLiftState,
      landmarkInView,
      groundAtCam,
      taskInView,
    };
  }

  /** F-11 / D1.5 (audit #4) line-of-sight over the terrain: true when the RENDERED ground never
   *  climbs above the straight segment from `from` to the world point (`tx,ty,tz`). Marches
   *  the drawn terrain (terrain.y, the ONE ground truth). A crest poking above the ray (a rim berm / dune face between lens and
   *  ranger) returns false = the ranger is hidden, so `avatarScreen.visible` matches the pixels.
   *  Deterministic, so the idle pose holds frame to frame; a per-SHOT hook read (camState). */
  private terrainClearTo(from: THREE.Vector3, tx: number, ty: number, tz: number): boolean {
    const dx = tx - from.x, dz = tz - from.z;
    const horiz = Math.hypot(dx, dz);
    if (horiz < 0.5) return true; // lens is right on top of him — nothing can be between
    const steps = Math.min(48, Math.max(6, Math.ceil(horiz / 1.5)));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const rayY = from.y + (ty - from.y) * t;
      if (this.terrain.y(from.x + dx * t, from.z + dz * t) > rayY + 0.05) return false;
    }
    return true;
  }

  /** Dev-hook accessor (W4.5): the lighting/shadow state — renderer shadow map on,
   *  sun casting the hero shadow, ranger opted in, and the animal blob count — so
   *  the E2E can assert selective shadows exist. */
  lightingState(): { shadowMap: boolean; sunCastsShadow: boolean; rangerCastsShadow: boolean; blobShadows: number } {
    return {
      shadowMap: this.host.renderer()?.shadowMap.enabled ?? false,
      sunCastsShadow: this.sky.sun.castShadow,
      rangerCastsShadow: this.player.castsShadow,
      blobShadows: this.fauna.blobCount,
    };
  }

  /** Dev-hook accessor (W4.6): the live "Lucht + adem" state — richer-gradient
   *  stop count, whether the cloud-shadow layer + wind grasses are present, and
   *  the LIVE cloud offset / wind phase / bird position so the E2E can prove the
   *  ambient motion advances when moving AND freezes under reduced-motion. */
  skyState(): ReturnType<Sky['state']> {
    return this.sky.state(this.dressing.windMeshes.length);
  }

  /** Dev-hook accessor (D1.2 locomotion ground-truth; P1.5a asserts it across the
   *  walkable world). Reads the ranger's feet against the RENDERED terrain surface
   *  right under him — the court check for "he is ON the ground, not through it":
   *   - `clearance` = his feet Y minus the surface Y an independent downward ray hits
   *     on the ground mesh. ≈ 0 when he stands on the drawn ground.
   *   - `analyticGap` = that drawn surface minus the smooth relief field `heightAt(x,z)`
   *     at the same spot. Since the terrain un-mirror (2026-09-26) this is only the
   *     triangle-vs-curve difference (< ~2 cm); anything larger means the drawn ground and
   *     the field every placement reads have come apart again.
   *   - `grounded` = the ray hit the terrain AND clearance sits in the on-foot band.
   *  Null before the rig is up or while seated in a vehicle (his mesh is hidden then,
   *  so a feet-on-ground check is meaningless). Pixels stay the court of appeal (§8.7):
   *  this is an assert, and a shot that contradicts it outranks it. */
  groundedState(): { grounded: boolean; clearance: number; analyticGap: number } | null {
    if (this.player.group.children.length === 0 || this.vehicles.inVehicle) return null;
    const p = this.player.group.position;
    const surfaceY = this.terrain.raycastY(p.x, p.z);
    if (!Number.isFinite(surfaceY)) return { grounded: false, clearance: Number.NEGATIVE_INFINITY, analyticGap: 0 };
    const clearance = p.y - surfaceY;
    return {
      grounded: clearance >= -GROUND_SINK_TOL && clearance <= GROUND_AIR_TOL,
      clearance,
      analyticGap: surfaceY - this.terrain.field(p.x, p.z),
    };
  }

  /** Dev-hook accessor (W4.4): the ground-detail state — whether the procedural
   *  albedo layers are on and whether the repeating mottle map is actually bound
   *  to the ground material — so the E2E asserts the before/after toggle flips. */
  groundDetailState(): { on: boolean; textured: boolean; tileRepeat: number } {
    const mat = this.terrain.mesh.material as THREE.MeshStandardMaterial;
    return {
      on: this.terrain.detail,
      textured: mat.map != null,
      tileRepeat: mat.map ? mat.map.repeat.x : 0,
    };
  }

  /**
   * D3.16 all-occluder sightline (props + vehicles): does any SOLID collision circle
   * (cabin, board, sign, watchtower, the parked jeep/helicopter — everything in
   * `obstacles` EXCEPT the fadeable tree trunks) stand BETWEEN the lens and the ranger
   * on the XZ plane? These are UNFADEABLE occluders, so — per §2.5 (GATE-D2: "the
   * clear-line test binds to anything the renderer draws; unfadeable ones report
   * honestly") — a hit makes `viewClear` FALSE rather than trying to fade the mesh. The
   * `18-jeep-near` breach: the sightline test covered crowns + terrain but not props /
   * vehicles / animals, so the hook lied clear while a mesh swallowed the ranger. The same
   * 2D between-test the camera rig's clear-view search uses (CameraRig.solidBetween);
   * circles that CONTAIN the ranger's foot (the prop he stands at) are skipped so a POI
   * never self-reports occluded. Trees are skipped (their crown fade already handles
   * them, and the frozen view-clear spec walks past trunks expecting viewClear=true).
   * Deterministic (no allocation) so the idle-stability pose holds frame to frame.
   */
  private propBlocksSightline(cx: number, cz: number, ax: number, az: number): boolean {
    const dx = ax - cx, dz = az - cz;
    const len2 = dx * dx + dz * dz;
    if (len2 < 1e-6) return false; // lens on top of him
    for (const o of this.obstacles) {
      if (this.cam.isTree(o)) continue;            // a tree's trunk — the tree fades (CameraRig, world/Crowns.ts)
      if (obstacleGap(o, ax, az) + (o.box ? o.box.pad : 0) <= 0) continue; // the prop the ranger stands at — not an occluder
      // behind the lens or at/behind the ranger (t outside 0.05–0.95) is a backdrop; a box by its real rectangle
      if (segmentCrosses(o, cx, cz, ax, az, 0.05, 0.95)) return true;
    }
    return false;
  }

  /**
   * D3.16 all-occluder sightline (animals): does any staged CREATURE — a mission-marker
   * model, a scenic actor (warden/poacher), or an ambient roamer/bird — stand BETWEEN
   * the lens and the ranger's body? The `18-jeep-near` breach was exactly this: a
   * mission-marker BIRD model (the stuifzand nachtzwaluw, anchored by the jeep) filled
   * the near foreground while `viewClear` claimed clear. Each creature is modelled as a
   * sphere at its group's world position, lifted to mid-height, with a radius from its
   * stand-height (a floor so even a low bird reads); the cam→body segment is tested to
   * the ranger's HEAD and CHEST (a low creature swallows his feet first, a tall one his
   * head) by closest approach. Animals are UNFADEABLE set-dressing, so a hit reports
   * `viewClear` FALSE (honest) — we do not ghost a live animal. Birds gliding tens of
   * metres overhead never touch a follow-height sightline, so the loop is a cheap no-op
   * for them. Pure numeric math over the staged casts — deterministic, no allocation.
   */
  private animalBlocksSightline(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number): boolean {
    const near = (px: number, py: number, pz: number, R: number, ay: number): boolean => {
      const dx = rx - cx, dy = ay - cy, dz = rz - cz;
      const len2 = dx * dx + dy * dy + dz * dz;
      if (len2 < 1e-6) return false;
      const t = ((px - cx) * dx + (py - cy) * dy + (pz - cz) * dz) / len2;
      if (t <= 0.05 || t >= 0.95) return false;    // behind the lens / at-or-behind the ranger
      const gx = px - (cx + dx * t), gy = py - (cy + dy * t), gz = pz - (cz + dz * t);
      return gx * gx + gy * gy + gz * gz <= R * R;
    };
    const aimHead = ry + this.player.avatarTopY;          // his crown — a tall creature reaches it
    const aimChest = ry + this.player.avatarTopY * 0.35;  // low on his body — a ground bird swallows here first
    const test = (g: THREE.Vector3, h: number): boolean => {
      const R = Math.max(0.45, h * 0.5);           // footprint sphere (floor so a small model still reads)
      const cyc = g.y + h * 0.5;                   // centre at mid-height above the creature's own ground
      return near(g.x, cyc, g.z, R, aimHead) || near(g.x, cyc, g.z, R, aimChest);
    };
    for (const m of this.pois.list) { if (test(m.group.position, 1.0)) return true; }
    for (const a of this.fauna.scenicActors) { if (test(a.group.position, a.height)) return true; }
    for (const a of this.fauna.ambient) {
      if (a.glide) continue;                        // birds gliding overhead never cross a follow sightline
      if (test(a.group.position, a.h)) return true;
    }
    return false;
  }
}
