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
import { loadManifest, loadModel, prepModel } from '../Models';
import { BIOME_PALETTE, VEN_CENTER, VEN_REED_OUT, WATER_LEVEL, type Biome } from '../Biomes';
import { windSway } from '../Atmosphere';
import { PATH_NODES, PATH_SEGMENTS, LANE_HALF } from '../Paths';
import { WATER_DEEP, WATER_SHALLOW, WATER_OPACITY, FRESNEL_POWER, rippleAmp } from '../Water';
import { boxObstacle, type Obstacle, type MoveLimits } from '../CharacterController';
import type { Terrain } from './Terrain';
import type { Labels } from './Labels';
import { enableCast, proceduralTotem } from './props';

// P1.3: the tree canopy is authored at ONE fidelity. Both the scattered bos trees and
// the F-11 rim tree-line render an instant low-poly cone/cylinder stand-in, then the
// real staged tree GLBs (Scots pine · oak · birch) stream in as InstancedMesh and
// REPLACE them — so no low-poly tree ever stands beside a realistic prop or animal
// (RUN-C-DIRECTION §2.3: "no low-poly outlier may stand next to a realistic asset").
// InstancedMesh keeps the whole forest at a handful of draw calls regardless of tree
// count (§A8). The species mix is grove den dominant with eik/berk woven in (§2.2). The
// trees are static (no wind), so the reduced-motion freeze is a no-op on them.
export type TreeSpecies = 'prop-pine-scots' | 'prop-oak-tree' | 'prop-birch-tree';
export interface TreePlacement { x: number; y: number; z: number; s: number; rotY: number; species: TreeSpecies }
// prepModel target height (m) per species — mixed sizes; a per-instance scale rides on top.
export const TREE_BASE_H: Record<TreeSpecies, number> = {
  'prop-pine-scots': 6.6, 'prop-oak-tree': 5.4, 'prop-birch-tree': 6.0,
};
// deterministic species pattern woven along the scatter/rim index — pine dominant.
const TREE_SCATTER_MIX: readonly TreeSpecies[] = ['prop-pine-scots', 'prop-pine-scots', 'prop-oak-tree', 'prop-pine-scots', 'prop-birch-tree'];
const TREE_RIM_MIX: readonly TreeSpecies[] = ['prop-pine-scots', 'prop-pine-scots', 'prop-pine-scots', 'prop-birch-tree'];

/**
 * Build one InstancedMesh per sub-mesh of a normalized (feet at y=0, x/z-centred)
 * model, one instance per placement. Each sub-mesh's model-local matrix is baked into
 * every instance so a clone renders identically to loadModel+prepModel — just shared
 * across N spots at 1 draw call each. Shadows off + an instance-aware bounding sphere
 * so the follow frustum culls the ring correctly (the trees never pop at the rim).
 */
function instancesFromPrepped(prepped: THREE.Object3D, placements: TreePlacement[]): THREE.InstancedMesh[] {
  prepped.updateMatrixWorld(true); // wrapper sits at identity → mesh.matrixWorld IS model-local
  const out: THREE.InstancedMesh[] = [];
  const world = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  prepped.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const local = mesh.matrixWorld.clone(); // this sub-mesh's transform in model-local space
    const inst = new THREE.InstancedMesh(mesh.geometry, mesh.material, placements.length);
    inst.castShadow = false;
    inst.receiveShadow = false;
    placements.forEach((p, k) => {
      q.setFromAxisAngle(yAxis, p.rotY);
      pos.set(p.x, p.y, p.z);
      scl.set(p.s, p.s, p.s);
      world.compose(pos, q, scl).multiply(local);
      inst.setMatrixAt(k, world);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere(); // cover all instances so the rim ring isn't wrongly culled
    out.push(inst);
  });
  return out;
}

export class Dressing {
  // W4.6: reusable scratch for the per-frame wind matrix recompose (no per-frame
  // allocation while re-tilting a few hundred grass blades).
  private static readonly _m = new THREE.Matrix4();
  private static readonly _q = new THREE.Quaternion();
  private static readonly _e = new THREE.Euler();
  private static readonly _p = new THREE.Vector3();
  private static readonly _s = new THREE.Vector3();
  // W4.8 ven-water: the fresnel disc's shader material — the World drives its
  // `uTime` (from `skyTime`, so it freezes with the rest of the ambient motion)
  // and `uAmp` (0 under reduced-motion → waveless) each frame.
  private waterMat: THREE.ShaderMaterial | null = null;
  private lastWindT = NaN;                       // skip redundant wind re-uploads
  // tall grasses that catch the wind (marram + reed): their instanced mesh + the
  // per-blade base transform, re-tilted each frame by windSway.
  readonly windMeshes: {
    mesh: THREE.InstancedMesh;
    items: { x: number; y: number; z: number; sx: number; sy: number; phase: number }[];
    strength: number;
  }[] = [];
  // The furthest-out radius any LOW ground-tuft (heather/marram) landed at — reported on
  // the dev hook's boundary read-back.
  scatterMax = 0;
  // P1.3 tree canopy (see the module note above `instancesFromPrepped`): the instant
  // cone/cylinder stand-ins to swap out, and the per-instance placements (scattered bos
  // trees + the rim tree-line) to instance the real tree GLBs onto once they load.
  private readonly treeFallbacks: THREE.Object3D[] = [];
  // D1.5 occluder fade: the tree meshes the free-walk occluder fade currently dims — the
  // cone fallback while the GLBs stream, then the instanced GLB canopy after the swap.
  readonly treeFadeMeshes: THREE.Object3D[] = [];
  readonly treePlacements: TreePlacement[] = [];
  // D1.5 current applied tree-canopy occluder fade (1 = solid); the camera rig decides it.
  canopyOpacity = 1;
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
  }

  /** The drawn ground height (the one ground truth, world/Terrain.ts). */
  private groundY(x: number, z: number): number {
    return this.terrain.y(x, z);
  }

  /** The vegetation, in build order: bos trees, heather, marram, the reed belt, the rim
   *  tree-line, then the real tree GLBs stream in over the cone stand-ins. Density
   *  scales with the quality tier (W7.2: laag ≈ half). */
  scatterVegetation(veg: number): void {
    this.scatterPines(Math.round(80 * veg));
    this.scatterHeather(Math.round(150 * veg));
    this.scatterMarram(Math.round(110 * veg));
    this.scatterReeds(Math.round(160 * veg)); // D3.2: a denser reed fringe reads at the shore
    this.buildRim(); // F-11: the pine tree-line marking the world edge
    void this.upgradeTreesToGLB(); // P1.3: swap the cone stand-ins for the real tree GLBs
    this.applyWind(0); // W4.6: initial wind pose for both grass meshes
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
    const cabinAt = new THREE.Vector3(-4.2, 0, -4);
    cabinAt.y = this.groundY(cabinAt.x, cabinAt.z);
    this.cabinPos = cabinAt.clone(); // F-09: hub-in-frustum test reads this
    const cabin = new THREE.Group();
    cabin.position.copy(cabinAt);
    cabin.rotation.y = Math.atan2(-cabinAt.x, -cabinAt.z); // face the spawn point
    cabin.add(this.proceduralCabin());
    this.scene.add(cabin);
    // wave 2: the cabin's real footprint (the GLB at 3 m tall, porch included: 3.9 × 3.8 m),
    // turned with it, so the ranger cannot step onto the porch (the old r = 2 circle let him)
    this.obstacles.push(boxObstacle(cabinAt.x, cabinAt.z, 1.97, 1.9, cabin.rotation.y));
    void loadModel('prop-ranger-cabin').then((m) => {
      if (!m) return;
      const prepped = prepModel(m, 3.0);
      enableCast(prepped); // W4.5: the spawn cabin is a hero prop near the player
      cabin.remove(...cabin.children);
      cabin.add(prepped);
    });
  }

  /**
   * W4.3: the sand-path network (Paths.ts / §4) as ONE terrain-hugging ribbon
   * mesh — a warm sand strip laid a hair above the ground along every §4 edge so
   * the routes read visually (spawn ↔ the POIs). The whole network is a single
   * merged geometry → one draw call, so the budget (§3.4, <150) is untouched. Each
   * rib samples `groundY` at BOTH edge vertices so the strip hugs the rolling
   * relief instead of poking through it; a small +y lift + polygonOffset keeps it
   * off the ground plane without z-fighting. Sand vertex colour, no texture fetch.
   */
  buildPaths(): THREE.Mesh {
    const HALF = LANE_HALF;
    const STEP = 1.6;        // rib spacing along a segment (m)
    const LIFT = 0.05;       // sit just above the terrain
    const sand = new THREE.Color('#cdb887');
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    for (const [i, j] of PATH_SEGMENTS) {
      const a = PATH_NODES[i], b = PATH_NODES[j];
      const dx = b.x - a.x, dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 1;
      // unit perpendicular in XZ for the ribbon width
      const px = -dz / len, pz = dx / len;
      const ribs = Math.max(2, Math.ceil(len / STEP) + 1);
      const base = positions.length / 3;
      for (let r = 0; r < ribs; r++) {
        const t = r / (ribs - 1);
        const cx = a.x + dx * t, cz = a.z + dz * t;
        const lx = cx + px * HALF, lz = cz + pz * HALF;
        const rx = cx - px * HALF, rz = cz - pz * HALF;
        positions.push(lx, this.groundY(lx, lz) + LIFT, lz);
        positions.push(rx, this.groundY(rx, rz) + LIFT, rz);
        colors.push(sand.r, sand.g, sand.b, sand.r, sand.g, sand.b);
        if (r > 0) {
          const p = base + (r - 1) * 2, q = base + r * 2;
          // two triangles between rib r-1 and r
          indices.push(p, p + 1, q, q, p + 1, q + 1);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 1, metalness: 0,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 1; // draw over the ground plane
    return mesh;
  }

  /**
   * W4.8: the ven-water disc — a FRESNEL-tinted still plane. A custom shader
   * mixes a deep forest-teal (seen head-on) with a lighter warm sky-glow (at
   * grazing angles) by the Schlick view-angle factor (`Water.ts` mirrors the
   * maths), so the disc reads as water instead of a flat painted circle. The
   * ripple is a GENTLE FRAGMENT-TINT shimmer only — never a vertex displacement —
   * so the silhouette never moves (motion-comfort §1e/§C); it is WAVELESS by
   * default and its amplitude (`uAmp`) is driven to exactly 0 under reduced-motion
   * from `update()`. One mesh → one draw call, budget untouched (§3.4).
   */
  buildVenWater(): THREE.Mesh {
    const RADIUS = 20;
    const geo = new THREE.CircleGeometry(RADIUS, 48);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uAmp: { value: 0 },
        uDeep: { value: new THREE.Color(WATER_DEEP) },
        uShallow: { value: new THREE.Color(WATER_SHALLOW) },
        uOpacity: { value: WATER_OPACITY },
        uFresnelPower: { value: FRESNEL_POWER },
        uRadius: { value: RADIUS },
      },
      vertexShader: `
        varying vec3 vWorld;
        varying float vR;
        void main() {
          vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
          vR = length(position.xy); // local radial distance from the disc centre (pre-tilt)
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uAmp;
        uniform vec3 uDeep;
        uniform vec3 uShallow;
        uniform float uOpacity;
        uniform float uFresnelPower;
        uniform float uRadius;
        varying vec3 vWorld;
        varying float vR;
        void main() {
          // flat, up-facing plane → normal is world-up; fresnel from the view's
          // vertical component (straight-down = deep, grazing = sky-glow).
          vec3 viewDir = normalize(cameraPosition - vWorld);
          float fres = pow(clamp(1.0 - max(viewDir.y, 0.0), 0.0, 1.0), uFresnelPower);
          // subtle crossing shimmer — two slow sines over world position; uAmp is
          // 0 under reduced-motion so this term vanishes (dead-still mirror).
          float ripple = sin(vWorld.x * 1.15 + uTime * 0.8)
                       * sin(vWorld.z * 1.07 - uTime * 0.55);
          float mixv = clamp(fres + ripple * uAmp, 0.0, 1.0);
          vec3 col = mix(uDeep, uShallow, mixv);
          // D3.2: fade the alpha to 0 over the outer ~2.4 m so the water meets the
          // moss bank as a soft waterline, never a hard-edged dark polygon (the P1.2
          // grade's "hard-edged dark POLYGON" finding). The reed fringe + painted moss
          // bank complete the shore.
          float edge = smoothstep(uRadius, uRadius - 2.4, vR);
          gl_FragColor = vec4(col, uOpacity * edge);
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
   *  swap in via upgradeTreesToGLB. */
  private scatterPines(budget: number): void {
    const spots = this.candidates(budget * 4, 'bos');
    const placed: TreePlacement[] = spots.map(({ x, z, i }) => ({
      x, y: this.groundY(x, z), z,
      s: 0.85 + (i % 5) * 0.11,                     // 0.85–1.29 height variety
      rotY: (i * 2.39996) % (Math.PI * 2),          // golden-angle spin, no two alike
      species: TREE_SCATTER_MIX[i % TREE_SCATTER_MIX.length],
    }));
    // a soft collision circle around each trunk (the ranger slides around it).
    // D3.16: tag it a TREE so the all-occluder sightline test (propBlocksSightline)
    // skips it — a trunk's foliage is the fadeable crown (canopyBlocksSightline), so
    // trees report THROUGH the fade, never as an opaque viewClear=false blocker.
    for (const p of placed) this.obstacles.push({ x: p.x, z: p.z, r: 0.6 * p.s, tree: true });
    this.treePlacements.push(...placed);
    this.addTreeFallback(placed);
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

  /**
   * F-11: a calm pine tree-line ringing the playable area at the move bound, so
   * walking outward meets a visible forest edge ("Hier stopt het bos") instead of
   * the Run A silent void. The ring sits JUST BEYOND the bound (the ranger clamps at
   * `limits.bound`; the trees start a touch past it), so it needs no collision — it
   * is a backdrop wall, hidden by the fog and only revealed as the player nears the
   * edge (so hub/spawn shots are untouched). P1.3: the ring is now the real staged tree
   * cast (pine·oak·birch), instanced → a handful of draw calls regardless of count, so
   * the tree-line reads at the SAME fidelity as the animals/props it frames while the
   * <150 budget holds. Deterministic (index-driven jitter, no Math.random), uniform all
   * the way round so every heading ends at the same tidy edge. Shadows off — a distant
   * backdrop needs none.
   */
  private buildRim(): void {
    const bound = this.limits.bound;
    const N = 180;
    const placed: TreePlacement[] = [];
    for (let k = 0; k < N; k++) {
      const ang = (k / N) * Math.PI * 2;
      // two staggered rows just past the bound (bound+1.2 → bound+3.6, ≈76–79 at the
      // 75 m bound) → a wall with depth, not a single-file fence; stays well under 120
      // so it always lands on the 240² ground plane on-axis.
      const rad = bound + 1.2 + (k % 2) * 1.8 + Math.sin(k * 12.9) * 0.6;
      const x = Math.cos(ang) * rad;
      const z = Math.sin(ang) * rad;
      placed.push({
        x, y: this.groundY(x, z), z,
        s: 1.0 + (k % 5) * 0.18,                    // varied heights so the line reads as a natural edge
        rotY: (k * 1.71) % (Math.PI * 2),           // per-tree spin so the ring never repeats
        species: TREE_RIM_MIX[k % TREE_RIM_MIX.length],
      });
    }
    this.treePlacements.push(...placed);
    this.addTreeFallback(placed); // P1.3: cone stand-in until the real tree GLBs stream in
  }

  /** P1.3: the instant low-poly stand-in for a set of tree placements — an instanced
   *  cone crown + cylinder trunk (2 draw calls) shown ONLY until the real staged tree
   *  GLBs stream in and replace it (upgradeTreesToGLB). Tracked in `treeFallbacks`. */
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
    this.treeFadeMeshes.push(trunks, crowns); // D1.5: the occluder fade dims the cones until the GLBs land
    this.scene.add(trunks, crowns);
  }

  /**
   * P1.3: replace the instant cone/cylinder tree stand-ins with the real staged tree
   * GLBs (Scots pine · oak · birch), instanced so the whole canopy — the scattered bos
   * trees AND the F-11 rim tree-line — reads at the SAME fidelity as every other prop
   * and animal (RUN-C-DIRECTION §2.3). One InstancedMesh per species-mesh, so the
   * entire forest costs only a handful of draw calls regardless of tree count (§A8),
   * well under the <150 contract. Best-effort + all-or-nothing: only when EVERY needed
   * species loads do we build the real canopy and drop the cones — a partial load keeps
   * the whole cone stand-in (so a spot is never double-drawn, the world always playable).
   */
  private async upgradeTreesToGLB(): Promise<void> {
    if (!this.treePlacements.length) return;
    await loadManifest();
    const species = [...new Set(this.treePlacements.map((p) => p.species))];
    const prepped = new Map<TreeSpecies, THREE.Object3D>();
    for (const id of species) {
      const m = await loadModel(id);
      if (m) prepped.set(id, prepModel(m, TREE_BASE_H[id]));
    }
    if (prepped.size !== species.length) return; // a species is missing → keep the cone canopy
    const built: THREE.InstancedMesh[] = [];
    for (const [id, model] of prepped) {
      built.push(...instancesFromPrepped(model, this.treePlacements.filter((p) => p.species === id)));
    }
    for (const inst of built) this.scene.add(inst);
    // D1.5: the occluder fade now dims the real GLB canopy — retire the cone entries and
    // point it at the instanced tree meshes. Reset the fade cache to solid so the next
    // setCanopyOpacity re-applies to these fresh materials (the guard would otherwise skip
    // a mid-fade equal value on meshes that never had it stashed).
    this.treeFadeMeshes.length = 0;
    this.treeFadeMeshes.push(...built);
    this.canopyOpacity = 1;
    // swap: drop + dispose the now-hidden cone stand-ins so they leave no cost behind.
    for (const f of this.treeFallbacks) {
      this.scene.remove(f);
      const im = f as THREE.InstancedMesh;
      im.geometry?.dispose();
      (im.material as THREE.Material)?.dispose?.();
      im.dispose?.();
    }
    this.treeFallbacks.length = 0;
  }

  /** Drift-sand marram tussocks — upright pale grass blades on the stuifzand.
   *  W4.6: registered as a wind mesh so the blades lean in the breeze. */
  private scatterMarram(budget: number): void {
    const spots = this.candidates(budget * 4, 'stuifzand');
    const geo = new THREE.ConeGeometry(0.16, 0.9, 5);
    const mat = new THREE.MeshStandardMaterial({ color: BIOME_PALETTE.stuifzand.accent, roughness: 1, flatShading: true });
    const grass = new THREE.InstancedMesh(geo, mat, spots.length);
    const items: { x: number; y: number; z: number; sx: number; sy: number; phase: number }[] = [];
    spots.forEach(({ x, z, i }) => {
      const s = 0.6 + (i % 3) * 0.25;
      items.push({ x, y: this.groundY(x, z) + 0.4 * s, z, sx: s, sy: s, phase: (i % 7) * 0.9 });
    });
    this.windMeshes.push({ mesh: grass, items, strength: 1 }); // full sway — exposed dune grass
    this.scene.add(grass);
  }

  /** Reed clumps fringing the ven — only on the bank just above the waterline.
   *  W4.6: registered as a wind mesh (softer sway than the exposed marram). */
  private scatterReeds(budget: number): void {
    // D3.2: ring the basin with a golden-angle spread and keep only the stalks whose
    // ground sits in the shore band — so every reed stands on the bank at the waterline,
    // a tight belt around the water rather than a scatter over the whole ven biome.
    const bx = VEN_CENTER.x, bz = VEN_CENTER.z;
    const items: { x: number; y: number; z: number; sx: number; sy: number; phase: number }[] = [];
    for (let i = 0; i < budget * 12 && items.length < budget; i++) {
      const ang = i * 2.39996;             // golden angle → even, non-repeating ring
      const rad = 9 + (i % 22) * ((VEN_REED_OUT - 9) / 22); // 9–20 m out — a TIGHT belt hugging the waterline
      const x = bx + Math.cos(ang) * rad;
      const z = bz + Math.sin(ang) * rad;
      const gy = this.groundY(x, z);
      if (gy < WATER_LEVEL - 0.3 || gy > WATER_LEVEL + 1.0) continue; // keep the reed belt right at the shore
      const s = 0.8 + (i % 4) * 0.22;
      items.push({ x, y: gy + 0.85 * s, z, sx: s, sy: s, phase: (i % 5) * 1.3 });
    }
    // TALLER, thicker reeds (≈1.4–2.2 m) in a DARK reed-green so the fringe reads at follow
    // distance against BOTH the golden water and the tan bank (the P1.2 grade found "no reed
    // fringe" — thin pale 1.1 m stalks vanished against the shore). Still ONE instanced draw call.
    const geo = new THREE.CylinderGeometry(0.05, 0.09, 1.7, 5);
    const mat = new THREE.MeshStandardMaterial({ color: '#6d7b38', roughness: 1 });
    const reeds = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length));
    reeds.count = items.length;
    this.windMeshes.push({ mesh: reeds, items, strength: 0.7 }); // reeds sway gentler
    this.scene.add(reeds);
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
        Dressing._p.set(it.x, it.y, it.z);
        Dressing._s.set(it.sx, it.sy, it.sx);
        Dressing._m.compose(Dressing._p, Dressing._q, Dressing._s);
        wm.mesh.setMatrixAt(k, Dressing._m);
      }
      wm.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /**
   * D1.5 occluder fade (sibling of setAvatarOpacity): set the tree-canopy render opacity
   * (1 = solid) so a crown between the lens and the ranger on the free walk stops swallowing
   * him (`09-walk-4`). Each material's ORIGINAL opacity/transparent/depthWrite is stashed
   * once and restored at full, so a faded crown never loses its authored look; a faded
   * canopy drops depthWrite so the ranger behind it stays visible. Guarded on the cached
   * value — no traversal unless the fade actually changes. Fades the CURRENT tree meshes
   * (`treeFadeMeshes`: the cone fallback while the GLBs stream, then the instanced GLB
   * canopy). Draw-call count is untouched (same meshes, just transparent) so the <150
   * contract holds. Materials are tree-only (each species GLB / the cones own theirs), so
   * this never dims a non-tree prop.
   */
  setCanopyOpacity(o: number): void {
    if (o === this.canopyOpacity) return;
    this.canopyOpacity = o;
    const opaque = o >= 1;
    for (const obj of this.treeFadeMeshes) {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) continue;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const mat = m as THREE.Material & { opacity: number; transparent: boolean; depthWrite: boolean };
        const ud = mat.userData as { __canopyFadeOrig?: { o: number; t: boolean; d: boolean } };
        if (!ud.__canopyFadeOrig) ud.__canopyFadeOrig = { o: mat.opacity, t: mat.transparent, d: mat.depthWrite };
        const orig = ud.__canopyFadeOrig;
        if (opaque) { mat.opacity = orig.o; mat.transparent = orig.t; mat.depthWrite = orig.d; }
        else { mat.opacity = orig.o * o; mat.transparent = true; mat.depthWrite = false; }
      }
    }
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
    // [dev-hook id, GLB model, world x/z, target Y-height (m), collision radius,
    //  optional beacon label]. The watchtower is deliberately the farthest —
    //  the W4.1 E2E walks spawn→watchtower.
    // `foot` = the GLB's footprint half-extents at that height (its own x/z, measured
    // off the loaded models): a solid rectangle, turned with the landmark (wave 2 — the
    // old circles let the ranger stand between the watchtower's legs).
    const LANDMARKS: {
      id: string; model: string; x: number; z: number; height: number; foot: [number, number]; label?: string;
    }[] = [
      { id: 'prop-fire-watchtower', model: 'prop-fire-watchtower', x: 37, z: -37, height: 9, foot: [1.78, 1.86], label: 'Uitkijktoren' },
      { id: 'prop-bird-hide', model: 'prop-bird-hide', x: 26, z: -11, height: 2.8, foot: [1.61, 1.49], label: 'Vogelkijkhut' },
      { id: 'prop-ecoduct', model: 'prop-ecoduct', x: -70, z: 6, height: 6, foot: [7.74, 7.8], label: 'Ecoduct' },
      { id: 'prop-boa-post', model: 'prop-boa-post', x: -56, z: -20, height: 3, foot: [2.18, 2.13], label: 'BOA-post' },
      { id: 'prop-signpost', model: 'prop-signpost', x: 9, z: -8, height: 1.7, foot: [0.83, 0.29] },
      { id: 'prop-signpost-west', model: 'prop-signpost', x: -16, z: 10, height: 1.7, foot: [0.83, 0.29] },
    ];
    for (const lm of LANDMARKS) {
      const at = new THREE.Vector3(lm.x, this.groundY(lm.x, lm.z), lm.z);
      const group = new THREE.Group();
      group.position.copy(at);
      group.rotation.y = Math.atan2(-lm.x, -lm.z); // turn its face toward the clearing
      group.add(proceduralTotem(lm.label ? '#c8a36a' : '#8a7a5a')); // instant stand-in
      if (lm.label) {
        const label = this.labels.make(lm.label, '#e8d6a8');
        label.position.y = lm.height * 0.55 + 1.4;
        group.add(label);
      }
      this.scene.add(group);
      this.obstacles.push(boxObstacle(lm.x, lm.z, lm.foot[0], lm.foot[1], group.rotation.y));
      this.landmarks.push({ id: lm.id, x: lm.x, z: lm.z });
      void loadModel(lm.model).then((m) => {
        if (!m) return;
        const prepped = prepModel(m, lm.height);
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
      group.add(proceduralTotem(spec.collide > 0 ? '#6b5a3a' : '#7d8a4a')); // instant stand-in
      this.scene.add(group);
      if (model === 'prop-fallen-log') {
        this.obstacles.push(boxObstacle(x, z, 1.09, 0.32, group.rotation.y)); // a log is long, not round
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
