/**
 * world/Dressing.ts — everything that stands still on the ground.
 *
 * The sand-path ribbons, the ven water disc, the tree canopy (scattered bos trees and
 * the rim tree-line, instanced real GLBs over an instant cone stand-in), heather,
 * marram and the reed belt (the grasses sway in the wind), the ranger-cabin, the
 * landmark beacons and the curated nature dressing. Every piece is seated with
 * `terrain.y`, the solid ones push a collision circle into the shared obstacle list,
 * and the canopy can be faded as one (the camera rig's occluder fade decides when).
 */

import * as THREE from 'three';
import { loadModel, prepModel, whileLoading } from '../Models';
import { BIOME_PALETTE, VEN_CENTER, VEN_REED_OUT, VEN_SHORE_R, VEN_WATER_R, WATER_LEVEL, type Biome } from '../Biomes';
import { windSway } from '../Atmosphere';
import { PATH_NODES, PATH_SEGMENTS, LANE_HALF, distanceToNetwork, trackSand } from '../Paths';
import { WATER_DEEP, WATER_SHALLOW, WATER_TREES, WATER_OPACITY, FRESNEL_POWER, WATER_F0, rippleAmp } from '../Water';
import { boxObstacle, obstacleGap, type Obstacle, type MoveLimits } from '../CharacterController';
import type { TierParams } from '../../core/quality';
import { buildFarForest, buildPathGeometry, farCanopyTexture, type Terrain } from './Terrain';
import type { Labels } from './Labels';
import { enableCast, naturaliseConcrete, proceduralTotem } from './props';
import { Forest, TREE_BASE_H, type TreePlacement, type TreeSpecies, type TreeStub } from './Forest';
import { PlantField, heatherGeometry, plantMaterial, tuftGeometry, type PlantSpot } from './Plants';
import { lodGeometries, lodMaterial } from '../Lod';
import { heathCover } from '../GroundDetail';
import { groundMaterial } from '../GroundMaterial';
import { PADS, PAD_RADIUS } from './Vehicles';
import { SIZE, spreadAt, type SizeKey } from '../AnimalScale';

export { TREE_BASE_H, type TreePlacement, type TreeSpecies } from './Forest';

// P1.3: the tree canopy is authored at ONE fidelity: the scattered bos trees, the grove
// trees at the landmarks and the F-11 rim tree-line are all the real staged tree GLBs
// (Scots pine · oak · birch), instanced by world/Forest.ts at a detail that fits the
// distance. An instant low-poly cone/cylinder stand-in shows only until they are ready.
// The species mix is grove den dominant with eik/berk woven in (§2.2). The trees are
// static (no wind), so the reduced-motion freeze is a no-op on them.
// deterministic species pattern woven along the scatter/rim index — pine dominant.
const TREE_SCATTER_MIX: readonly TreeSpecies[] = ['prop-pine-scots', 'prop-pine-scots', 'prop-oak-tree', 'prop-pine-scots', 'prop-birch-tree'];
const NATURE_TREES = new Set<string>(['prop-pine-scots', 'prop-oak-tree', 'prop-birch-tree']);

/**
 * W4.1 landmarks: [dev-hook id, GLB model, world x/z, its row in the scale table, the
 * footprint's half extents PER METRE of height (its own x/z, measured off the loaded
 * models: a solid rectangle turned with the landmark, wave 2), optional beacon label].
 * The watchtower is deliberately the farthest — the W4.1 E2E walks spawn→watchtower.
 * Each one faces the clearing (rotation.y = atan2(−x, −z)).
 */
const LANDMARKS: readonly {
  id: string; model: string; x: number; z: number; size: SizeKey; foot: [number, number]; label?: string;
}[] = [
  { id: 'prop-fire-watchtower', model: 'prop-fire-watchtower', x: 37, z: -37, size: 'uitkijktoren', foot: [0.198, 0.207], label: 'Uitkijktoren' },
  { id: 'prop-bird-hide', model: 'prop-bird-hide', x: 26, z: -11, size: 'vogelkijkhut', foot: [0.575, 0.532], label: 'Vogelkijkhut' },
  { id: 'prop-ecoduct', model: 'prop-ecoduct', x: -70, z: 6, size: 'ecoduct', foot: [1.29, 1.3], label: 'Ecoduct' },
  { id: 'prop-boa-post', model: 'prop-boa-post', x: -56, z: -20, size: 'boa-post', foot: [0.727, 0.71], label: 'BOA-post' },
  { id: 'prop-signpost', model: 'prop-signpost', x: 9, z: -8, size: 'wegwijzer', foot: [0.488, 0.171] },
  { id: 'prop-signpost-west', model: 'prop-signpost', x: -16, z: 10, size: 'wegwijzer', foot: [0.488, 0.171] },
];
/** A landmark's height (m) and footprint half extents (m) at that height. */
const landmarkSize = (lm: typeof LANDMARKS[number]): { h: number; fx: number; fz: number } => {
  const h = SIZE[lm.size].h;
  return { h, fx: lm.foot[0] * h, fz: lm.foot[1] * h };
};
/** The landmarks' footprints: no plant grows inside one (no grass through a floor). */
const LANDMARK_FEET: readonly Obstacle[] = LANDMARKS.map((lm) => { const f = landmarkSize(lm); return boxObstacle(lm.x, lm.z, f.fx, f.fz, Math.atan2(-lm.x, -lm.z)); });

/** The heather dome's height above the ground at scale 1 (world/Plants.heatherGeometry):
 *  a field's rendered heather height divided by it is the dome's vertical scale. */
const HEATHER_DOME_H = 0.27;

/** The ranger cabin by the spawn clearing, and its footprint's half extents per metre of
 *  its height (the GLB, porch included). */
export const CABIN_AT = { x: -6.5, z: -6 } as const;
const CABIN_FOOT: readonly [number, number] = [0.657, 0.633];
/** Its height (m): the yard's flowers and its open porch scale with it. */
const CABIN_H = SIZE.boshut.h;

/** The spot before the cabin's door, out on the clearing (run 6: the porch ring where the
 *  hut is entered). The cabin faces the spawn point and its porch reaches the front of its
 *  footprint; `out` m further lies the spot. It stays inside the open yard (YARD_OPEN). */
export function cabinDoorSpot(out = 1.4): { x: number; z: number } {
  const d = Math.hypot(CABIN_AT.x, CABIN_AT.z);
  const r = CABIN_FOOT[1] * CABIN_H + out;
  return { x: CABIN_AT.x - (CABIN_AT.x / d) * r, z: CABIN_AT.z - (CABIN_AT.z / d) * r };
}

/** The cabin's yard: the grassy clearing round the spawn, crossed by the sand tracks (the
 *  heath's own plant fields start where it ends: gridSpots). */
const YARD_R = 9;
/** The yard stays open here: the ranger's own spot, the ground between him and the lens
 *  of the ranger maker (world/Presenter.ts: a little to his right, in front of him as he
 *  turns round), the missiebord and its ring (the warden stands by it), the cabin and
 *  its porch (its footprint's corner, and a step). [x, z, radius] */
const YARD_OPEN: readonly (readonly [number, number, number])[] = [
  [0, 0, 1.1], [0.5, 1.7, 1.7], [2.2, -5, 2.8], [CABIN_AT.x, CABIN_AT.z, Math.hypot(CABIN_FOOT[0], CABIN_FOOT[1]) * CABIN_H + 0.6],
];

/** The forest beyond the rim's material (Terrain.buildFarForest), made once a session. */
let farMat: THREE.MeshLambertMaterial | null = null;

/** A stable hash of an integer pair + seed → [0,1) (the plant grid's jitter). */
function hash2(x: number, z: number, seed: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(seed | 0, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export class Dressing {
  // W4.6: reusable scratch for the per-frame wind matrix recompose (no per-frame
  // allocation while re-tilting a few hundred grass blades).
  private static readonly _m = new THREE.Matrix4();
  private static readonly _q = new THREE.Quaternion();
  private static readonly _e = new THREE.Euler();
  private static readonly _p = new THREE.Vector3();
  private static readonly _s = new THREE.Vector3();
  private static readonly _r = new THREE.Quaternion();
  private static readonly _up = new THREE.Vector3(0, 1, 0);
  // W4.8 ven-water: the fresnel disc's shader material — the World drives its
  // `uTime` (from `skyTime`, so it freezes with the rest of the ambient motion)
  // and `uAmp` (0 under reduced-motion → waveless) each frame.
  private waterMat: THREE.ShaderMaterial | null = null;
  private lastWindT = NaN;                       // skip redundant wind re-uploads
  // tall grasses that catch the wind (marram + reed): their instanced mesh + the
  // per-blade base transform, re-tilted each frame by windSway.
  readonly windMeshes: {
    mesh: THREE.InstancedMesh;
    items: { x: number; y: number; z: number; sx: number; sy: number; phase: number; rotY?: number }[];
    strength: number;
  }[] = [];
  // The furthest-out radius any LOW ground-tuft (heather/marram) landed at — reported on
  // the dev hook's boundary read-back.
  scatterMax = 0;
  // Run 6: ground a mission's home keeps bare (a wallow's mud, a rooting field's turned
  // earth): no scattered heather or grass grows through it. Set before the scatter.
  clearings: readonly { x: number; z: number; r: number }[] = [];
  /** run 6: ground a mission's home keeps free of the scattered trees (a glade, a trail) */
  treeClearings: readonly { x: number; z: number; r: number }[] = [];
  /** run 6: trees a mission's home plants itself (a camera tree), drawn with the forest,
   *  each with its branch stub if it has one (a squirrel's perch: it fades with its tree) */
  homeTrees: readonly { x: number; z: number; s: number; rotY: number; species: TreeSpecies; stub?: TreeStub }[] = [];
  // P1.3 tree canopy: the instant cone/cylinder stand-ins (dropped once the Forest is
  // ready) and every tree placement: the bos scatter, the rim tree-line and the grove
  // trees of the nature dressing. The camera rig tests its crowns against these.
  private readonly treeFallbacks: THREE.Object3D[] = [];
  readonly treePlacements: TreePlacement[] = [];
  // the instanced real trees at distance-fitting detail + the per-tree occluder fade
  private forest: Forest | null = null;
  // the low ground plants, one field per kind (world/Plants.ts)
  private readonly plantFields: PlantField[] = [];
  // small nature-dressing props, hidden once they are deep in the fog
  private readonly farProps: { group: THREE.Object3D; x: number; z: number; far: number }[] = [];
  private quality: TierParams | null = null;
  // F-09: the cabin's world position, kept so camState's landmark-in-frustum test
  // can prove a hub landmark is in the world-entry frame (the board + cabin are the
  // only hub markers inside the forward frustum; the beacons sit off to the sides).
  cabinPos: THREE.Vector3 | null = null;
  // W4.1 landmark props: the fixed wayfinding beacons (watchtower, ecoduct,
  // bird-hide, BOA post, signposts) placed per §4. Each is set-dressing with a
  // solid collision circle; the named ones carry a floating diegetic label so
  // they read as "over there" beacons. Kept out of `markers` (no proximity /
  // mission). Their world x/z is exposed through the dev hook for E2E navigation.
  readonly landmarks: { id: string; x: number; z: number }[] = [];
  // W4.2 nature dressing: real tree/rock/mushroom/reed GLBs clustered near the
  // POIs and biome cores, on top of the instanced-primitive background filler.
  // Their world x/z is exposed through the dev hook so the E2E can assert them.
  private readonly props: { id: string; x: number; z: number }[] = [];

  private readonly scene: THREE.Scene;
  private readonly terrain: Terrain;
  private readonly obstacles: Obstacle[];
  private readonly limits: MoveLimits;
  private readonly labels: Labels;

  constructor(env: { scene: THREE.Scene; terrain: Terrain; obstacles: Obstacle[]; limits: MoveLimits; labels: Labels }) {
    this.scene = env.scene;
    this.terrain = env.terrain;
    this.obstacles = env.obstacles;
    this.limits = env.limits;
    this.labels = env.labels;
    // Once per rendered frame, with the camera actually rendered (free walk, vehicle,
    // mini-game reframe alike): the forest picks each tree's detail and culls the rest.
    const before = this.scene.onBeforeRender;
    this.scene.onBeforeRender = (...args) => {
      before.apply(this.scene, args);
      const cam = args[2];
      this.forest?.update(cam);
      for (const f of this.plantFields) f.update(cam);
      const e = cam.matrixWorld.elements;
      for (const p of this.farProps) p.group.visible = Math.hypot(p.x - e[12], p.z - e[14]) < p.far;
    };
  }

  /** The opacity of the tree crowns that block the view right now (1 = none; the
   *  camera rig reads it for `viewClear`, the dev hook reports it). */
  get canopyOpacity(): number {
    return this.forest?.blockingOpacity ?? 1;
  }

  /** The drawn ground height (the one ground truth, world/Terrain.ts). */
  private groundY(x: number, z: number): number {
    return this.terrain.y(x, z);
  }

  /** The vegetation, in build order: bos trees, heather, marram, the reed belt, the rim
   *  tree-line, then the real tree GLBs stream in over the cone stand-ins. Density
   *  scales with the quality tier (W7.2: laag ≈ half). */
  scatterVegetation(quality: TierParams): void {
    const veg = quality.vegetationScale;
    this.quality = quality;
    this.scatterPines(Math.round(80 * veg));
    this.scatterPlants(veg); // heather + grass, helmgras, ferns, the reed belt
    this.buildRim(); // F-11: the pine tree-line marking the world edge
    void whileLoading(this.buildForest()); // P1.3: swap the cone stand-ins for the real tree GLBs (the boot veil waits for it)
    this.applyWind(0); // W4.6: initial wind pose for both grass meshes
  }

  /** The quality tier changed (the fps probe): the forest tightens its detail distances. */
  setQuality(quality: TierParams): void {
    this.quality = quality;
    this.forest?.setTier(quality.treeDetail);
  }

  /** Per frame, on the ambient clock: the grasses lean in the wind and the ven water
   *  shimmers (W4.8: its ripple amplitude is exactly 0 under reduced-motion). */
  animate(skyTime: number, reduced: boolean): void {
    this.applyWind(skyTime);
    if (this.waterMat) {
      this.waterMat.uniforms.uTime.value = skyTime;
      this.waterMat.uniforms.uAmp.value = rippleAmp(reduced);
    }
  }

  /**
   * The spawn-clearing ranger-cabin (§4, W2.2): a solid building the ranger walks
   * around, best-effort GLB over a procedural stand-in. It sits forward-left of spawn
   * (the Missiebord, world/Markers.ts, stands forward-right); both keep the x≈0
   * forward (−z) corridor the movement smoke walks clear.
   */
  placeCabin(): void {
    // ranger-cabin: forward-left of spawn (WSW), its door turned toward the clearing;
    // a solid blocker (bigger collision circle) the ranger can't walk through.
    //
    // F-05 ⊕ F-07 world-entry composition: at (−4.6, 3.6) the cabin sat straight
    // BEHIND spawn on +z — exactly where the follow boom lands — so its 3.9 m-wide
    // GLB filled the world-entry lens AND (as a hero shadow caster, sun from −x/+z)
    // dropped its shadow +x/−z right over the spawn, leaving the frame a dark
    // reddish murk (no ground/horizon/ranger — Floris's #1 finding). Moving it to
    // (−6, −9): interim — that cleared the boom but parked the cabin ~14 m deep off
    // the left edge, reading too small to give the ranger scale (five P1.1 re-grades
    // read "nothing beside him"). (−4.2, −4): keeps it OUT of the +z boom volume and
    // ~2 m clear of the x≈0 tap-to-walk lane (its circle spans x∈[−6.2,−2.2] at
    // z=−4, so the movement/journey/ground @smoke walks and the spawn boom are
    // untouched — the boom casts +z, never toward this −z circle), while sitting it
    // ~10 m from the lens in the forward (−z) frustum, off to the LEFT: a believable
    // hut BESIDE the back-turned ranger (see the rotation.y = π spawn) for the F-07
    // proportion shot AND the F-09 hub in the first frame. Sun from −x/+z still
    // throws the cabin shadow −z AWAY from the lit spawn. Its door faces spawn (below).
    // Run 6: at its true size (4.5 m, a door the warden walks through) it stands further
    // out, (−6.5, −6): the same bearing from the lens, as big in the first frame, and its
    // turned footprint (x ≤ −2.4) keeps even further off the x≈0 lane.
    const cabinAt = new THREE.Vector3(CABIN_AT.x, 0, CABIN_AT.z);
    cabinAt.y = this.groundY(cabinAt.x, cabinAt.z);
    this.cabinPos = cabinAt.clone(); // F-09: hub-in-frustum test reads this
    const cabin = new THREE.Group();
    cabin.position.copy(cabinAt);
    cabin.rotation.y = Math.atan2(-cabinAt.x, -cabinAt.z); // face the spawn point
    cabin.add(this.proceduralCabin());
    this.scene.add(cabin);
    // wave 2: the cabin's real footprint (porch included: 1.31 × 1.27 of its height,
    // measured off the GLB), turned with it, so the ranger cannot step onto the porch
    const H = SIZE.boshut.h;
    this.obstacles.push({ ...boxObstacle(cabinAt.x, cabinAt.z, CABIN_FOOT[0] * H, CABIN_FOOT[1] * H, cabin.rotation.y), h: H });
    void loadModel('prop-ranger-cabin').then((m) => {
      if (!m) return;
      const prepped = prepModel(m, H);
      enableCast(prepped); // W4.5: the spawn cabin is a hero prop near the player
      cabin.remove(...cabin.children);
      cabin.add(prepped);
    });
  }

  /**
   * W4.3: the sand-path network (Paths.ts / §4), so the routes read (spawn ↔ the POIs):
   * sand tracks that fade into the ground (Terrain.buildPathGeometry), drawn with the
   * ground's own material so they share its light, fog, mottle and near-lens detail. One
   * draw call; it takes the hero shadow like the ground.
   */
  buildPaths(): THREE.Mesh {
    const geo = buildPathGeometry(this.terrain);
    // the ground's own material (same program, textures and light)
    const mat = groundMaterial(this.terrain.detail, (this.terrain.mesh.material as THREE.MeshStandardMaterial).map);
    mat.userData.cloudShade = true; // the cloud shade drifts over the paths like the ground (Sky.buildCloudShadows)
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'sand-paths';
    mesh.renderOrder = 1;        // drawn after the ground it lies on
    mesh.receiveShadow = true;
    mesh.raycast = () => {};     // paint on the ground, not ground: clicks and probes meet the terrain
    return mesh;
  }

  /**
   * W4.8: the ven-water disc — a FRESNEL-tinted still plane. A custom shader
   * mixes a dark peaty teal (seen head-on) with what the still water mirrors (the
   * cream sky where the view is steeper, the far bank's tree-line at grazing angles)
   * by the Schlick view-angle factor (`Water.ts` holds the constants), so the disc
   * reads as dark still water instead of a flat painted circle; it is fogged and tone
   * mapped like the rest of the world (2026-09-27). The
   * ripple is a GENTLE FRAGMENT-TINT shimmer only — never a vertex displacement —
   * so the silhouette never moves (motion-comfort §1e/§C); it is WAVELESS by
   * default and its amplitude (`uAmp`) is driven to exactly 0 under reduced-motion
   * from `update()`. One mesh → one draw call, budget untouched (§3.4).
   */
  buildVenWater(): THREE.Mesh {
    const geo = new THREE.CircleGeometry(VEN_WATER_R, 48);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        uTime: { value: 0 },
        uAmp: { value: 0 },
        uDeep: { value: new THREE.Color(WATER_DEEP) },
        uShallow: { value: new THREE.Color(WATER_SHALLOW) },
        uTrees: { value: new THREE.Color(WATER_TREES) },
        uOpacity: { value: WATER_OPACITY },
        uFresnelPower: { value: FRESNEL_POWER },
        uF0: { value: WATER_F0 },
        uRadius: { value: VEN_WATER_R },
      }]),
      vertexShader: `
        #include <fog_pars_vertex>
        varying vec3 vWorld;
        varying float vR;
        void main() {
          vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
          vR = length(position.xy); // local radial distance from the disc centre (pre-tilt)
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: `
        #include <fog_pars_fragment>
        uniform float uTime;
        uniform float uAmp;
        uniform vec3 uDeep;
        uniform vec3 uShallow;
        uniform vec3 uTrees;
        uniform float uOpacity;
        uniform float uFresnelPower;
        uniform float uF0;
        uniform float uRadius;
        varying vec3 vWorld;
        varying float vR;
        void main() {
          // flat, up-facing plane → normal is world-up; Schlick fresnel from the view's
          // vertical component: looking down = the dark water, grazing = the sky's haze.
          vec3 viewDir = normalize(cameraPosition - vWorld);
          float fres = uF0 + (1.0 - uF0) * pow(clamp(1.0 - max(viewDir.y, 0.0), 0.0, 1.0), uFresnelPower);
          // subtle crossing shimmer — two slow sines over world position; uAmp is
          // 0 under reduced-motion so this term vanishes (dead-still mirror).
          float ripple = sin(vWorld.x * 1.15 + uTime * 0.8)
                       * sin(vWorld.z * 1.07 - uTime * 0.55);
          float mixv = clamp(fres + ripple * uAmp * 0.5, 0.0, 1.0);
          // what it mirrors: grazing (the far water) sees the far bank's tree-line, a
          // steeper look (nearer water) sees the sky; the dark body shows through
          vec3 mirrored = mix(uTrees, uShallow, smoothstep(0.07, 0.24, viewDir.y));
          vec3 col = mix(uDeep, mirrored, mixv);
          // D3.2: fade the alpha to 0 over the outer ~2.4 m so the water meets the
          // bank as a soft waterline, never a hard-edged dark polygon. The reed belt
          // and the wet bank complete the shore.
          float edge = smoothstep(uRadius, uRadius - 2.4, vR);
          gl_FragColor = vec4(col, uOpacity * edge);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }
      `,
    });
    this.waterMat = mat;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(VEN_CENTER.x, WATER_LEVEL, VEN_CENTER.z); // over the basin the terrain digs at VEN_CENTER
    return mesh;
  }

  /**
   * Deterministic golden-angle candidate positions over the world, kept only where
   * they fall in the wanted biome (so each landschap grows its own vegetation),
   * outside the lodge clearing, and inside the playable bound (no vegetation out in
   * the fog band past the tree-line). Returns the surviving (x,z) — fully
   * reproducible.
   */
  private candidates(count: number, want: Biome): { x: number; z: number; i: number }[] {
    const out: { x: number; z: number; i: number }[] = [];
    for (let i = 0; i < count; i++) {
      const ang = i * 2.39996; // golden angle
      const rad = 12 + (i / count) * 100;
      const x = Math.cos(ang) * rad + Math.sin(i * 12.9) * 6;
      const z = Math.sin(ang) * rad + Math.cos(i * 7.3) * 6;
      const r = Math.hypot(x, z);
      if (r < 12) continue;                        // clearing
      if (r > this.limits.bound) continue;         // no vegetation out past the tree-line
      if (this.terrain.biome(x, z) !== want) continue; // wrong landschap
      if (want !== 'bos' && r > this.scatterMax) this.scatterMax = r; // furthest low tuft (dev hook)
      out.push({ x, z, i });
    }
    return out;
  }

  /** The scattered bos trees. P1.3: record real-tree placements (mixed species) +
   *  the soft trunk collisions, and drop the instant cone stand-in — the real GLBs
   *  swap in via buildForest. */
  private scatterPines(budget: number): void {
    const spots = this.candidates(budget * 4, 'bos')
      .filter((p) => !this.treeClearings.some((c) => Math.hypot(p.x - c.x, p.z - c.z) < c.r)); // a home's glade stays open
    const placed: TreePlacement[] = spots.map(({ x, z, i }) => ({
      x, y: this.groundY(x, z), z,
      s: 0.85 + (i % 5) * 0.11,                     // 0.85–1.29 height variety
      rotY: (i * 2.39996) % (Math.PI * 2),          // golden-angle spin, no two alike
      species: TREE_SCATTER_MIX[i % TREE_SCATTER_MIX.length],
    }));
    // run 6: the trees a mission's home plants (a camera tree at a crossing)
    for (const t of this.homeTrees) placed.push({ x: t.x, y: this.groundY(t.x, t.z), z: t.z, s: t.s, rotY: t.rotY, species: t.species, stub: t.stub });
    // a soft collision circle around each trunk (the ranger slides around it).
    // D3.16: tag it a TREE so the all-occluder sightline test (propBlocksSightline)
    // skips it — the whole tree is the camera's fadeable crown (world/Crowns.ts), so
    // trees report THROUGH the fade, never as an opaque viewClear=false blocker.
    for (const p of placed) this.obstacles.push({ x: p.x, z: p.z, r: 0.6 * p.s, tree: true });
    this.treePlacements.push(...placed);
    this.addTreeFallback(placed);
  }

  /**
   * F-11: a calm forest edge ringing the playable area just past the move bound, so
   * walking outward meets a real tree-line ("Hier stopt het bos") instead of a void.
   * It sits JUST BEYOND the bound (the ranger clamps at `limits.bound`), so it needs no
   * collision: a backdrop wall the fog reveals only as the player nears the edge.
   * 2026-09-27: three staggered, jittered rows (pine-dominant with oak, birch only in
   * front) instead of two even rows, so it reads as the edge of a forest with depth, not
   * a fence of identical poles; the far rows cost little (world/Forest draws them as
   * simplified copies). Deterministic (index-hashed jitter), the same all the way round.
   */
  private buildRim(): void {
    const bound = this.limits.bound;
    const ROWS: readonly { n: number; out: number; spread: number; s0: number; mix: readonly TreeSpecies[] }[] = [
      { n: 170, out: 1.4, spread: 0.8, s0: 1.0, mix: ['prop-pine-scots', 'prop-oak-tree', 'prop-pine-scots', 'prop-birch-tree', 'prop-pine-scots'] },
      { n: 150, out: 5.6, spread: 1.2, s0: 1.15, mix: ['prop-pine-scots', 'prop-pine-scots', 'prop-oak-tree'] },
      { n: 130, out: 10.2, spread: 1.4, s0: 1.3, mix: ['prop-pine-scots', 'prop-oak-tree', 'prop-pine-scots', 'prop-pine-scots'] },
    ];
    const placed: TreePlacement[] = [];
    ROWS.forEach((row, r) => {
      for (let k = 0; k < row.n; k++) {
        const h1 = hash2(k, r, 91), h2 = hash2(k, r, 92), h3 = hash2(k, r, 93);
        const ang = ((k + (h1 - 0.5) * 0.8 + r * 0.37) / row.n) * Math.PI * 2;
        const rad = bound + row.out + (h2 - 0.5) * 2 * row.spread;
        const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
        placed.push({
          x, y: this.groundY(x, z), z,
          s: row.s0 + h3 * 0.6,                          // varied heights: a ragged, natural skyline
          rotY: h1 * Math.PI * 2,
          species: row.mix[(k + r) % row.mix.length],
        });
      }
    });
    this.treePlacements.push(...placed);
    this.addTreeFallback(placed); // P1.3: cone stand-in until the real tree GLBs stream in
    // behind the tree-line the forest goes on (Terrain.buildFarForest): no view ever
    // reaches the end of the ground plate (parent B11, breaker B9)
    farMat ??= new THREE.MeshLambertMaterial({ vertexColors: true, map: farCanopyTexture() }); // one a session
    const far = new THREE.Mesh(buildFarForest(bound, (x, z) => this.groundY(x, z), this.quality?.treeDetail === 'laag'), farMat);
    far.name = 'far-forest';
    far.raycast = () => {}; // scenery past the rim: never clicked, never a probe's ground
    this.scene.add(far);
  }

  /** P1.3: the instant low-poly stand-in for a set of tree placements — an instanced
   *  cone crown + cylinder trunk (2 draw calls) shown ONLY until the real staged tree
   *  GLBs stream in and replace it (buildForest). Tracked in `treeFallbacks`. */
  private addTreeFallback(placed: TreePlacement[]): void {
    if (!placed.length) return;
    const trunkGeo = new THREE.CylinderGeometry(0.14, 0.2, 1.4, 6);
    const crownGeo = new THREE.ConeGeometry(1.05, 2.8, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#5b4327', roughness: 1 });
    const crownMat = new THREE.MeshStandardMaterial({ color: BIOME_PALETTE.bos.ground, roughness: 1 });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, placed.length);
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, placed.length);
    const m = new THREE.Matrix4();
    placed.forEach((p, k) => {
      m.makeScale(p.s, p.s, p.s); m.setPosition(p.x, p.y + 0.7 * p.s, p.z); trunks.setMatrixAt(k, m);
      m.makeScale(p.s, p.s, p.s); m.setPosition(p.x, p.y + 2.2 * p.s, p.z); crowns.setMatrixAt(k, m);
    });
    trunks.instanceMatrix.needsUpdate = true; crowns.instanceMatrix.needsUpdate = true;
    this.treeFallbacks.push(trunks, crowns);
    this.scene.add(trunks, crowns);
  }

  /**
   * P1.3: replace the instant cone/cylinder stand-ins with the real tree GLBs, instanced
   * by world/Forest.ts (near trees at full detail, far ones as simplified copies of the
   * same GLB, everything outside the view culled). It starts after a tick, so the grove
   * trees of the nature dressing (placed later in the World's build) join it too.
   * All-or-nothing: a species that fails to load keeps the whole cone stand-in.
   */
  private async buildForest(): Promise<void> {
    await Promise.resolve();
    if (!this.treePlacements.length) return;
    const forest = new Forest(this.scene, this.treePlacements, this.quality?.treeDetail ?? 'hoog');
    if (!(await forest.build())) return;
    this.forest = forest;
    for (const f of this.treeFallbacks) {
      this.scene.remove(f);
      const im = f as THREE.InstancedMesh;
      im.geometry?.dispose();
      (im.material as THREE.Material)?.dispose?.();
      im.dispose?.();
    }
    this.treeFallbacks.length = 0;
  }

  /**
   * The low ground plants (world/Plants.ts), each kind in fixed 20 m chunks that the fog
   * hides from afar: struikhei with straw grass between it on the heide (heather where
   * the heath's ground reads as heather, grass on its sandier patches), helmgras on the
   * stuifzand, adelaarsvaren in the bos and lisdodde round the ven. None stand on the
   * sand paths or in the spawn clearing. The grasses and reeds lean in the wind (W4.6).
   * `veg` (the quality tier) thins every field.
   */
  private scatterPlants(veg: number): void {
    const thin = 1 / Math.sqrt(Math.max(0.2, veg)); // fewer cells, same look
    const up = new THREE.Color();
    // heide: heather cushions where the ground is heather, grass where it is sandier
    const heather = this.gridSpots('heide', 2.3 * thin, 11, (x, z, h) => heathCover(x, z) > 0.32 + h * 0.3);
    // the cabin's yard (the spawn clearing): a few heather mats at its edge, between the tracks
    heather.push(...this.yardSpots(1.05 * thin, 71, (x, z, h, r) => r > 4.2 && heathCover(x * 1.7 + 9, z * 1.7 - 4) > 0.42 + h * 0.25));
    this.addField('heide-heather', heatherGeometry(5), plantMaterial(), heather.map((p, i) => ({
      x: p.x, y: this.groundY(p.x, p.z), z: p.z,
      s: 0.75 + p.h * 0.7, sy: spreadAt('struikhei', p.h) / HEATHER_DOME_H, rotY: i * 2.39996,
      tint: up.setRGB(0.9 + p.h * 0.2, 0.9 + ((i * 7) % 5) * 0.03, 0.9 + p.h * 0.15).clone(),
    })), 50, 0, { geometry: heatherGeometry(5, 60), from: 16 });
    const heideGrass = this.gridSpots('heide', 3.1 * thin, 23, (x, z, h) => heathCover(x, z) < 0.55 + h * 0.2);
    const grassSpots: PlantSpot[] = heideGrass.map((p, i) => ({ x: p.x, y: this.groundY(p.x, p.z), z: p.z, s: spreadAt('heidegras', p.h), rotY: i * 1.7, phase: (i % 7) * 0.9 }));
    // …and the yard's grass, greener than the heath's straw (it is the cabin's own patch):
    // thick along the tracks' edges and toward the yard's rim, short in the middle, where
    // it is walked every day
    const yardGreen = new THREE.Color(0.8, 0.98, 0.6);
    this.yardSpots(0.5 * thin, 73, (x, z, h, r) => {
      const byTrack = trackSand(x, z) > 0 || distanceToNetwork(x, z) < 2.6 ? 0.35 : 0;
      return h < Math.min(0.92, 0.22 + THREE.MathUtils.smoothstep(r, 2, 7.5) * 0.5 + byTrack);
    }).forEach((p, i) => grassSpots.push({
      x: p.x, y: this.groundY(p.x, p.z), z: p.z, s: 0.3 + p.h * 0.32, rotY: i * 2.3, phase: (i % 7) * 0.9,
      tint: yardGreen.clone().multiplyScalar(0.92 + p.h * 0.16),
    }));
    // …and under it a short sward all over the yard, so the ground between the tufts reads
    // as sun-dried grass, not soil (where the arrival and the maker look: in front of the
    // lens and round his spot). Low enough to walk through and never to hide his feet.
    this.yardSpots(0.3 * thin, 79, (_x, _z, h, r) => h < 0.8 * THREE.MathUtils.smoothstep(r, 1.0, 1.8))
      .forEach((p, i) => grassSpots.push({
        x: p.x, y: this.groundY(p.x, p.z), z: p.z, s: 0.2 + p.h * 0.12, rotY: i * 2.7, phase: (i % 7) * 0.9,
        tint: yardGreen.clone().multiplyScalar(0.86 + p.h * 0.22),
      }));
    this.addField('heide-grass', tuftGeometry({ blades: 16, seed: 3, root: '#5f5a30', tip: '#d2bd7e', lean: 0.32 }), plantMaterial(), grassSpots, 40, 0.8);
    // stuifzand: helmgras tussocks, grey-green to straw, full sway in the open
    const marram = this.gridSpots('stuifzand', 2.9 * thin, 37, (_x, _z, h) => h < 0.62);
    this.addField('stuifzand-helmgras', tuftGeometry({ blades: 22, seed: 5, root: '#6c7552', tip: '#dccf9e', lean: 0.24, width: 0.03 }), plantMaterial(),
      marram.map((p, i) => ({ x: p.x, y: this.groundY(p.x, p.z), z: p.z, s: spreadAt('helmgras', p.h), rotY: i * 2.1, phase: (i % 7) * 0.9 })), 48, 1);
    // the ven sector away from the water is wet heath: pijpenstrootje tussocks and
    // pinker dopheide between them
    const dryVen = (x: number, z: number): boolean => Math.hypot(x - VEN_CENTER.x, z - VEN_CENTER.z) > VEN_SHORE_R + 1;
    const wetGrass = this.gridSpots('ven', 2.6 * thin, 61, (x, z, h) => dryVen(x, z) && h < 0.7);
    this.addField('ven-pijpenstrootje', tuftGeometry({ blades: 18, seed: 7, root: '#5c6536', tip: '#cdbd82', lean: 0.34 }), plantMaterial(),
      wetGrass.map((p, i) => ({ x: p.x, y: this.groundY(p.x, p.z), z: p.z, s: spreadAt('pijpenstrootje', p.h), rotY: i * 1.9, phase: (i % 7) * 0.9 })), 40, 0.8);
    const dopheide = this.gridSpots('ven', 3.4 * thin, 67, (x, z, h) => dryVen(x, z) && heathCover(x, z) > 0.45 + h * 0.3);
    this.addField('ven-dopheide', heatherGeometry(9), plantMaterial(), dopheide.map((p, i) => ({
      x: p.x, y: this.groundY(p.x, p.z), z: p.z, s: 0.6 + p.h * 0.5, sy: spreadAt('dopheide', p.h) / HEATHER_DOME_H, rotY: i * 2.39996,
      tint: new THREE.Color(1.02, 0.9, 1.0),
    })), 44, 0, { geometry: heatherGeometry(9, 60), from: 16 });
    // the GLB plants stream in: ferns under the bos trees, lisdodde round the ven
    void this.scatterGlbPlants(veg, thin);
  }

  /**
   * Spots on a jittered `cell` m grid over the cabin's yard (the spawn clearing, which
   * `gridSpots` leaves out): never on the sand tracks, and the ranger's own spot, the
   * missiebord's ring and the cabin's porch stay open. `keep(x, z, h, r)` thins them
   * (h: a stable per-spot random in [0,1), r: the distance from the spawn).
   */
  private yardSpots(cell: number, seed: number, keep: (x: number, z: number, h: number, r: number) => boolean): { x: number; z: number; h: number }[] {
    const out: { x: number; z: number; h: number }[] = [];
    const n = Math.ceil(YARD_R / cell);
    for (let gx = -n; gx < n; gx++) for (let gz = -n; gz < n; gz++) {
      const x = (gx + hash2(gx, gz, seed)) * cell, z = (gz + hash2(gx, gz, seed + 1)) * cell;
      const r = Math.hypot(x, z);
      if (r >= YARD_R) continue;                                     // past it the heath's own field grows
      if (trackSand(x, z) > 0.15) continue;                          // the tracks stay sand
      if (YARD_OPEN.some(([ox, oz, or]) => Math.hypot(x - ox, z - oz) < or)) continue;
      const h = hash2(gx, gz, seed + 2);
      if (keep(x, z, h, r)) out.push({ x, z, h });
    }
    return out;
  }

  /** Foxgloves by the cabin: a few pink spires either side of its porch and along its
   *  sunny wall (walk-through, one instanced draw call). */
  private async plantYardFlowers(): Promise<void> {
    const m = await loadModel('prop-foxglove');
    if (!m) return;
    const [geo] = lodGeometries('prop-foxglove@1', prepModel(m, 1), [1600]);
    if (!geo) return;
    const face = Math.atan2(-CABIN_AT.x, -CABIN_AT.z);             // the cabin faces the spawn
    const fx = Math.sin(face), fz = Math.cos(face), sx = fz, sz = -fx; // its front and its side
    // [along the front, out from the wall] in m from the cabin's centre, for a 3 m cabin
    const AT: readonly (readonly [number, number])[] = [
      [-2.55, 1.5], [-2.3, 2.25], [-2.8, 0.7], [2.5, 1.6], [2.75, 0.8], [2.35, 2.35], [-2.6, -0.4], [2.7, -0.3],
    ];
    const k = CABIN_H / 3; // the offsets were set out round a 3 m cabin
    const spots: PlantSpot[] = AT.map(([a, o], i) => {
      const x = CABIN_AT.x + (sx * a + fx * o) * k, z = CABIN_AT.z + (sz * a + fz * o) * k;
      const h = hash2(i, 5, 77);
      return { x, y: this.groundY(x, z) - 0.02, z, s: 0.7 + h * 0.45, rotY: i * 2.39996, phase: (i % 5) * 1.1 };
    });
    this.addField('yard-vingerhoedskruid', geo, lodMaterial(), spots, 60, 0.35);
  }

  /** The two real-GLB plants, simplified for the crowd (Lod.ts): adelaarsvaren in the bos
   *  and lisdodde (the reed belt, D3.2: a tight ring on the bank just above the water). */
  private async scatterGlbPlants(veg: number, thin: number): Promise<void> {
    void this.plantYardFlowers();
    const fern = await loadModel('prop-fern');
    if (fern) {
      const [geo, far] = lodGeometries('prop-fern@1', prepModel(fern, 1), [2000, 600]);
      const spots = this.gridSpots('bos', 4.2 * thin, 53, (_x, _z, h) => h < 0.45);
      if (geo && far) this.addField('bos-varen', geo, lodMaterial(), spots.map((p, i) => ({
        x: p.x, y: this.groundY(p.x, p.z) - 0.02, z: p.z, s: spreadAt('adelaarsvaren', p.h), rotY: i * 2.39996,
        // late-summer bracken in the shade: olive, some already turning bronze
        tint: new THREE.Color(0.72 + p.h * 0.25, 0.68 + p.h * 0.08, 0.42),
      })), 40, 0, { geometry: far, from: 14 });
    }
    const reeds = await loadModel('prop-reeds');
    if (!reeds) return;
    const [geo] = lodGeometries('prop-reeds@1', prepModel(reeds, 1), [650]);
    if (!geo) return;
    const bx = VEN_CENTER.x, bz = VEN_CENTER.z;
    const budget = Math.round(90 * veg);
    const spots: PlantSpot[] = [];
    for (let i = 0; i < budget * 12 && spots.length < budget; i++) {
      const ang = i * 2.39996;             // golden angle → even, non-repeating ring
      const rad = 9 + (i % 22) * ((VEN_REED_OUT - 9) / 22); // 9–20 m out — a TIGHT belt hugging the waterline
      const x = bx + Math.cos(ang) * rad;
      const z = bz + Math.sin(ang) * rad;
      const gy = this.groundY(x, z);
      if (gy < WATER_LEVEL - 0.3 || gy > WATER_LEVEL + 1.0) continue; // keep the reed belt right at the shore
      spots.push({ x, y: gy - 0.03, z, s: spreadAt('lisdodde', (i % 4) / 3), rotY: ang * 3.1, phase: (i % 5) * 1.3 });
    }
    void thin;
    this.addField('ven-lisdodde', geo, lodMaterial(), spots, 62, 0.7);
  }

  /** Lay out one plant field and, when it sways (`wind` > 0), hand its chunks to the wind. */
  private addField(
    name: string, geo: THREE.BufferGeometry, mat: THREE.Material, spots: PlantSpot[], hideBeyond: number, wind = 0,
    far?: { geometry: THREE.BufferGeometry; from: number },
  ): void {
    if (!spots.length) return;
    const field = new PlantField(this.scene, name, geo, mat, spots, hideBeyond, far);
    this.plantFields.push(field);
    if (wind > 0) {
      for (const c of field.chunks) {
        this.windMeshes.push({
          mesh: c.mesh, strength: wind,
          items: c.items.map((p) => ({ x: p.x, y: p.y, z: p.z, sx: p.s, sy: p.sy ?? p.s, phase: p.phase ?? 0, rotY: p.rotY })),
        });
      }
      this.lastWindT = NaN; // pose the new blades on the next tick
    }
  }

  /**
   * Plant spots on a jittered grid of `cell` m over one landschap: off the sand paths, the
   * helipads and the landmarks' footprints, out of the spawn clearing, inside the rim; `keep(x, z, h)` (h: a stable per-spot
   * random in [0,1)) thins them. Deterministic.
   */
  private gridSpots(want: Biome, cell: number, seed: number, keep: (x: number, z: number, h: number) => boolean): { x: number; z: number; h: number }[] {
    const out: { x: number; z: number; h: number }[] = [];
    const B = this.limits.bound - 1;
    const n = Math.ceil(B / cell);
    for (let gx = -n; gx < n; gx++) for (let gz = -n; gz < n; gz++) {
      const x = (gx + hash2(gx, gz, seed)) * cell, z = (gz + hash2(gx, gz, seed + 1)) * cell;
      const r = Math.hypot(x, z);
      if (r < 9 || r > B) continue;                               // the spawn clearing, the rim
      if (this.terrain.biome(x, z) !== want) continue;
      if (distanceToNetwork(x, z) < LANE_HALF + 0.6) continue;  // the paths stay bare sand
      if (PADS.some((p) => Math.hypot(x - p.x, z - p.z) < PAD_RADIUS + 0.9)) continue; // nothing grows through a helipad (breaker B9)
      if (LANDMARK_FEET.some((o) => obstacleGap(o, x, z) < 0.3)) continue;       // ...nor through a landmark's floor
      if (this.clearings.some((c) => Math.hypot(x - c.x, z - c.z) < c.r)) continue; // ...nor through a mission home's mud
      const h = hash2(gx, gz, seed + 2);
      if (!keep(x, z, h)) continue;
      if (r > this.scatterMax) this.scatterMax = r;                // furthest low plant (dev hook)
      out.push({ x, z, h });
    }
    return out;
  }

  /**
   * W4.6: re-tilt every wind-blade to `windSway(skyTime, phase)` about its base
   * transform. Cheap (a few hundred instance matrices), skipped when the clock is
   * unchanged (reduced-motion → one still pose, no redundant GPU uploads).
   */
  private applyWind(t: number): void {
    if (t === this.lastWindT) return;
    this.lastWindT = t;
    for (const wm of this.windMeshes) {
      for (let k = 0; k < wm.items.length; k++) {
        const it = wm.items[k];
        Dressing._e.set(0, 0, windSway(t, it.phase) * wm.strength);
        Dressing._q.setFromEuler(Dressing._e);
        if (it.rotY) Dressing._q.multiply(Dressing._r.setFromAxisAngle(Dressing._up, it.rotY)); // lean, then its own turn
        Dressing._p.set(it.x, it.y, it.z);
        Dressing._s.set(it.sx, it.sy, it.sx);
        Dressing._m.compose(Dressing._p, Dressing._q, Dressing._s);
        wm.mesh.setMatrixAt(k, Dressing._m);
      }
      wm.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** The occluder fade, per tree: the camera rig finds the trees in the way (tree index →
   *  opacity, world/Crowns.ts) and the forest fades exactly those (world/Forest.ts). */
  fadeOccluders(targets: ReadonlyMap<number, number>, release: number): void {
    this.forest?.fadeOccluders(targets, release);
  }

  /** Every crown solid again at once (`1`), e.g. off-foot or at teardown. Kept for the
   *  callers of the old whole-canopy fade: any value below 1 is ignored (the fade is per
   *  tree now, see `fadeOccluders`). */
  setCanopyOpacity(o: number): void {
    if (o >= 1) this.forest?.clearFades();
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
  placeLandmarks(): void {
    for (const lm of LANDMARKS) {
      const f = landmarkSize(lm);
      const at = new THREE.Vector3(lm.x, this.groundY(lm.x, lm.z), lm.z);
      const group = new THREE.Group();
      group.position.copy(at);
      group.rotation.y = Math.atan2(-lm.x, -lm.z); // turn its face toward the clearing
      group.add(proceduralTotem(lm.label ? '#c8a36a' : '#8a7a5a')); // instant stand-in
      if (lm.label) {
        const label = this.labels.make(lm.label, '#e8d6a8');
        label.position.y = f.h * 0.55 + 1.4;
        group.add(label);
      }
      this.scene.add(group);
      this.obstacles.push({ ...boxObstacle(lm.x, lm.z, f.fx, f.fz, group.rotation.y), h: f.h });
      this.landmarks.push({ id: lm.id, x: lm.x, z: lm.z });
      void loadModel(lm.model).then((m) => {
        if (!m) return;
        const prepped = prepModel(m, f.h);
        if (lm.id === 'prop-ecoduct') {
          // a green wildlife bridge, not a grey block (parent B11): its bare concrete slab
          // is painted as soil and plants, and the slab's 0.3 m edge is sunk into the heath
          naturaliseConcrete(prepped);
          prepped.position.y -= 0.45;
        }
        enableCast(prepped); // W4.5: solid landmarks cast when near the player
        const totem = group.children.find((c) => c.userData.totem);
        if (totem) group.remove(totem); // keep the label
        group.add(prepped);
      });
    }
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
  placeNatureDressing(): void {
    // per-model height (m: its row in the scale table) + collision radius (0 = none).
    // The grove trees stand at their grown base height (their own slight variety below).
    const SPEC: Record<string, { h: number; collide: number }> = {
      'prop-pine-scots': { h: SIZE.den.h, collide: 0.7 },
      'prop-oak-tree': { h: SIZE.eik.h, collide: 0.7 },
      'prop-birch-tree': { h: SIZE.berk.h, collide: 0.7 },
      'prop-tree-stump': { h: SIZE.stronk.h, collide: 0.5 },
      'prop-fallen-log': { h: SIZE.boomstam.h, collide: 0.7 },
      'prop-dead-snag': { h: SIZE['dode-boom'].h, collide: 0.6 },
      'prop-boulder': { h: SIZE.kei.h, collide: 0.9 },
      'prop-juniper-bush': { h: SIZE.jeneverbes.h, collide: 1.0 },
      'prop-mushrooms': { h: SIZE.paddenstoelen.h, collide: 0 },
      'prop-fern': { h: SIZE.adelaarsvaren.h, collide: 0 },
      'prop-foxglove': { h: SIZE.vingerhoedskruid.h, collide: 0 },
      'prop-reeds': { h: SIZE.lisdodde.h, collide: 0 },
    };
    // [model, x, z] — curated + validated placements per §4.
    const PLACES: [string, number, number][] = [
      // Watchtower bos grove (POI 37,-37): trees + a real forest floor. Run 6: grown, the
      // trees stand far enough out that no crown reaches into the tower (a spreading oak
      // would need ~10 m, so pines and a birch).
      ['prop-pine-scots', 31.5, -41.5], ['prop-pine-scots', 42.5, -42], ['prop-birch-tree', 44.5, -45],
      ['prop-tree-stump', 31, -37], ['prop-mushrooms', 46, -42], ['prop-fern', 30, -42],
      ['prop-dead-snag', 45.5, -40.5], ['prop-fallen-log', 35, -43],
      // Ecoduct approach grove (POI -70,6): beside the bridge, out of its footprint (grown
      // trees would stand through its deck)
      ['prop-pine-scots', -63, 18.5], ['prop-birch-tree', -66, -6.5], ['prop-pine-scots', -70.5, 18.5], ['prop-fern', -61, 4],
      // BOA-post trees (POI -56,-20): birches, whose crowns start above its roof and clear
      // helipad B's rotor
      ['prop-birch-tree', -51, -24], ['prop-birch-tree', -60, -15],
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
    const groveTrees: TreePlacement[] = [];
    PLACES.forEach(([model, x, z], i) => {
      const spec = SPEC[model];
      if (NATURE_TREES.has(model)) {
        // a grove tree joins the forest: the same instanced GLB, its detail and its fade
        const species = model as TreeSpecies;
        groveTrees.push({ x, y: this.groundY(x, z), z, s: (spec.h / TREE_BASE_H[species]) * (0.9 + (i % 3) * 0.06), rotY: (i * 2.39996) % (Math.PI * 2), species });
        this.obstacles.push({ x, z, r: spec.collide });
        this.props.push({ id: model, x, z });
        return;
      }
      const at = new THREE.Vector3(x, this.groundY(x, z), z);
      const group = new THREE.Group();
      group.position.copy(at);
      group.rotation.y = (i * 2.39996) % (Math.PI * 2); // golden-angle spin for variety
      group.add(proceduralTotem(spec.collide > 0 ? '#6b5a3a' : '#7d8a4a')); // instant stand-in
      this.scene.add(group);
      // small dressing is not drawn once the fog has it (a 12k-triangle mushroom at 60 m
      // is a few grey pixels): low plants from 36 m, logs, stumps and boulders from 50 m
      if (spec.h <= 1.8) this.farProps.push({ group, x, z, far: spec.collide > 0 ? 50 : 36 });
      if (model === 'prop-fallen-log') {
        // a log is long, not round: its footprint (half 1.56 × 0.46 of its height, the GLB)
        this.obstacles.push(boxObstacle(x, z, 1.56 * spec.h, 0.46 * spec.h, group.rotation.y));
      } else if (spec.collide > 0) {
        // a real tree also tells the follow camera where its foliage is (never a lens in the leaves)
        const crown = model === 'prop-pine-scots' || model === 'prop-oak-tree' || model === 'prop-birch-tree'
          ? { kind: model, h: spec.h, y: at.y } : undefined;
        this.obstacles.push({ x, z, r: spec.collide, crown });
      }
      this.props.push({ id: model, x, z });
      void loadModel(model).then((m) => {
        if (!m) return;
        const prepped = prepModel(m, spec.h);
        // W4.5: only the SOLID dressing (trees/boulders/logs/snags/juniper/stumps)
        // casts a hero shadow; low ground detail (mushrooms/fern/foxglove/reeds)
        // does not. The tight ranger-following frustum still culls to the closest.
        if (spec.collide > 0) enableCast(prepped);
        const totem = group.children.find((c) => c.userData.totem);
        if (totem) group.remove(totem);
        group.add(prepped);
      });
    });
    this.treePlacements.push(...groveTrees);
    this.addTreeFallback(groveTrees);
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
    g.scale.setScalar(SIZE.boshut.h / 2.8); // the stand-in stands as tall as the cabin
    return g;
  }

  /** Dev-hook accessor (W4.1): every landmark's id + world x/z, so the E2E can
   *  steer the ranger from spawn to the watchtower and back. */
  landmarkPositions(): { id: string; x: number; z: number }[] {
    return this.landmarks.map((l) => ({ id: l.id, x: l.x, z: l.z }));
  }

  /** Dev-hook accessor (D1.5): the scatter + rim tree placements (world x/z + scale), so the
   *  view-clear E2E can steer a walk PAST a tree to reproduce a genuine cam→ranger crown
   *  occlusion. Read-only snapshot; the placements are fixed after build. */
  treeSpotList(): { x: number; z: number; s: number }[] {
    return this.treePlacements.map((p) => ({ x: p.x, z: p.z, s: p.s }));
  }

  /** Dev-hook accessor (W4.2): every nature-dressing prop's id + world x/z, so
   *  the E2E can assert the biomes are dressed with real GLBs. */
  dressingPositions(): { id: string; x: number; z: number }[] {
    return this.props.map((d) => ({ id: d.id, x: d.x, z: d.z }));
  }

  /** Dev-hook accessor (W4.3): the sand-path network — route nodes (id + world
   *  x/z) and the segment index pairs — so the E2E can assert the trails connect
   *  spawn to every POI. Static (the network is deterministic). */
  pathNetwork(): { nodes: { id: string; x: number; z: number }[]; segments: [number, number][] } {
    return {
      nodes: PATH_NODES.map((n) => ({ id: n.id, x: n.x, z: n.z })),
      segments: PATH_SEGMENTS.map(([i, j]) => [i, j] as [number, number]),
    };
  }

  /** Dev-hook accessor (W4.8): the live ven-water state — whether the fresnel
   *  shader disc exists, the ripple amplitude in force (0 under reduced-motion →
   *  waveless), and the live clock, so the E2E can prove the disc ripples with
   *  motion on and holds dead-still under reduced-motion. */
  waterState(): { shader: boolean; amp: number; time: number } {
    const mat = this.waterMat;
    return {
      shader: mat !== null,
      amp: mat ? (mat.uniforms.uAmp.value as number) : 0,
      time: mat ? (mat.uniforms.uTime.value as number) : 0,
    };
  }
}
