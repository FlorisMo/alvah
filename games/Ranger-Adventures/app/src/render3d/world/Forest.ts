/**
 * world/Forest.ts — every tree of the Veluwe (the bos scatter, the grove trees at the
 * landmarks and the rim tree-line) drawn as instanced copies of the three real tree
 * GLBs (Scots pine · oak · birch), at a detail that fits the distance.
 *
 * Why (2026-09-27): each tree GLB is ~9-12k triangles. One InstancedMesh per species
 * drew EVERY tree every frame (its bounding sphere spanned the map, so nothing was ever
 * culled): 2.6M triangles at spawn, ~5M in the bos. Now, once per rendered frame (the
 * scene's onBeforeRender, so it sees the final camera, also during a mini-game):
 *
 *   1. each tree outside the view frustum is skipped;
 *   2. the rest are sorted into four detail levels by their distance to the lens: the
 *      real GLB up close, then load-time simplified copies of the same GLB (Lod.ts:
 *      ~3000 / ~900 / ~250 triangles, coloured from the GLB's own texture) further out,
 *      with a little hysteresis so a tree on a boundary never flickers;
 *   3. each level of each species is ONE InstancedMesh holding just its trees, so the
 *      forest costs at most 12 draw calls however many trees stand in it.
 *
 * The occluder fade is per tree: the trees the camera rig finds between the lens and the
 * ranger (world/Crowns.ts, the one tree model both use) are lifted out of the instanced
 * meshes and drawn as a see-through copy of their own (`fadeOccluders`); every other
 * tree stays solid (the forest never ghosts as a whole). The see-through copies come from
 * a pool that lives as long as the forest, and their shader is compiled once when the
 * forest is built, so a tree fading in never stalls a frame on a shader compile.
 *
 * A tree may carry a dead branch stub (a mission's home tree: a squirrel's perch, a
 * jay's). The stub is part of its tree: drawn with it while it is solid (one instanced
 * mesh for every stub in view) and inside its see-through copy while it fades, at the
 * same opacity in the same frame, so a ghosted tree never leaves its stub hanging in the
 * air (review, 2026-09-29: a solid log across the ranger's chest).
 */

import * as THREE from 'three';
import { loadManifest, loadModel, prepModel } from '../Models.ts';
import { lodGeometries, lodMaterial } from '../Lod.ts';
import { SIZE } from '../AnimalScale.ts';

export type TreeSpecies = 'prop-pine-scots' | 'prop-oak-tree' | 'prop-birch-tree';
export interface TreePlacement {
  x: number; y: number; z: number; s: number; rotY: number; species: TreeSpecies; stub?: TreeStub;
  /** run 7 (additive): this tree's own full-detail range (m, lens → tree), when shorter than
   *  the forest's first (a home's many planted trees near one spot: the squirrel's pines).
   *  Unset: the forest's ranges, as every scattered tree. */
  near?: number;
}

/**
 * A short dead limb sticking out of a tree's trunk (a home tree's branch stub: where a
 * squirrel or a bird sits). World metres, measured from the tree's foot; the tree's own
 * scale and spin do not change it (a stub is placed where the animal on it sits).
 */
export interface TreeStub {
  /** which way it points out of the trunk (a heading: along (sin, cos)) */
  ang: number;
  /** the height of its axis where it leaves the trunk, above the tree's foot (m) */
  y: number;
  /** how far out from the trunk's axis it starts (m): a little inside the bark */
  start: number;
  /** how long it is (m) */
  len: number;
  /** its radius at the trunk (m); its tip is STUB_TAPER of that */
  r: number;
  /** the colour of its bark (css) */
  color: string;
}
/** A stub tips up a little from level (rad) and thins to this much of its root at its tip. */
export const STUB_TILT = 0.12;
export const STUB_TAPER = 0.6;

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _sv = new THREE.Vector3();
/**
 * Where a stub stands in the world: the unit stub (`stubGeometry`: 1 m long up its +y
 * from its root, radius 1 at the root) scaled to the stub's size, tipped out along its
 * heading STUB_TILT above level, its root `start` out from the trunk of the tree at `foot`.
 */
export function stubMatrix(foot: { x: number; y: number; z: number }, stub: TreeStub, out = new THREE.Matrix4()): THREE.Matrix4 {
  _q.setFromEuler(_e.set(Math.PI / 2 - STUB_TILT, stub.ang, 0, 'YXZ')); // +y → out, then round to its heading
  _v.set(foot.x + Math.sin(stub.ang) * stub.start, foot.y + stub.y, foot.z + Math.cos(stub.ang) * stub.start);
  return out.compose(_v, _q, _sv.set(stub.r, stub.len, stub.r));
}
/** The unit stub: a tapered 7-sided limb, 1 m up its +y from its root (radius 1). */
export function stubGeometry(): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(STUB_TAPER, 1, 1, 7, 1).translate(0, 0.5, 0);
}
/** prepModel target height (m) per species: grown trees (the scale table); a per-tree
 *  scale rides on top. */
export const TREE_BASE_H: Record<TreeSpecies, number> = {
  'prop-pine-scots': SIZE.den.h, 'prop-oak-tree': SIZE.eik.h, 'prop-birch-tree': SIZE.berk.h,
};

/** Triangle targets of the simplified copies (per species: the birch's leaves are
 *  small separate cards that thin out fast, so it keeps more). */
const LOD_TARGETS: Record<TreeSpecies, number[]> = {
  'prop-pine-scots': [3000, 900, 260],
  'prop-oak-tree': [3000, 900, 260],
  'prop-birch-tree': [4200, 1800, 700],
};
/** The simplified copies lose the GLB's normal-map shading; this brings their sampled
 *  colour back to the near tree's apparent tone so the switch does not read. */
const LOD_TONE: Record<TreeSpecies, number> = {
  'prop-pine-scots': 0.9, 'prop-oak-tree': 0.74, 'prop-birch-tree': 0.88,
};
/** Upper distance (m, lens → tree) of each detail level; the last level has none. */
export const LOD_RANGES: Record<'hoog' | 'laag', readonly number[]> = {
  hoog: [20, 36, 60],
  laag: [12, 26, 48],
};
const HYSTERESIS = 1.5; // m: a tree only changes level once it is this far past the line

interface Part { geometry: THREE.BufferGeometry; material: THREE.Material; local: THREE.Matrix4 }
interface SpeciesSet {
  species: TreeSpecies;
  trees: number[];                       // indices into `placements`, in fixed order
  parts: Part[];                         // the real GLB's sub-meshes (level 0)
  levels: THREE.InstancedMesh[][];       // [level][part] — levels ≥ 1 have one part
  lists: number[][];                     // per level: the trees it draws this frame (reused)
  counts: number[];                      // instances drawn per level this frame
  sig: number[];                         // a running signature of what each level holds
  spare: Ghost[];                        // see-through copies not in use (kept, never disposed)
}
/** A see-through copy of one tree: one mesh per GLB part, each with its own material,
 *  and its branch stub (shown when the tree it stands in for has one). */
interface Ghost { group: THREE.Group; mats: THREE.MeshStandardMaterial[]; set: SpeciesSet; stub: THREE.Mesh | null; stubMat: THREE.MeshStandardMaterial | null }

const _frustum = new THREE.Frustum();
const _pv = new THREE.Matrix4();
const _sphere = new THREE.Sphere();
const _c = new THREE.Color();

export class Forest {
  readonly placements: TreePlacement[];
  /** The opacity of the crowns in the lens → ranger sightline right now (1 = none). */
  blockingOpacity = 1;
  private readonly scene: THREE.Scene;
  private sets: SpeciesSet[] = [];
  private ready = false;
  private ranges: readonly number[];
  private readonly level: Int8Array;               // current detail level per tree (-1 = not drawn)
  private readonly world: Float32Array;            // per tree: its placement matrix (16 floats)
  private readonly tint: Float32Array;             // per tree: rgb variety
  private readonly fade: Float32Array;             // per tree: occluder-fade opacity (1 = solid)
  private readonly ghosts = new Map<number, Ghost>();
  /** the trees with a branch stub, and per tree its stub's world matrix and colour */
  private readonly stubbed: number[] = [];
  private readonly stubWorld: Float32Array;
  private readonly stubCol: Float32Array;
  /** the stubs of the solid trees drawn this frame (one instanced mesh; null: no stubs) */
  private stubs: THREE.InstancedMesh | null = null;
  private stubGeo: THREE.BufferGeometry | null = null;
  private readonly stubList: number[] = [];
  private stubSig = -1;
  private warm: THREE.Mesh[] = [];                  // the shader warm-up meshes (see `warmGhosts`)
  private warmed = false;

  constructor(scene: THREE.Scene, placements: TreePlacement[], tier: 'hoog' | 'laag') {
    this.scene = scene;
    this.placements = placements;
    this.ranges = LOD_RANGES[tier];
    const n = placements.length;
    this.level = new Int8Array(n).fill(-1);
    this.world = new Float32Array(n * 16);
    this.tint = new Float32Array(n * 3);
    this.fade = new Float32Array(n).fill(1);
    this.stubWorld = new Float32Array(n * 16);
    this.stubCol = new Float32Array(n * 3);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    placements.forEach((t, i) => {
      m.compose(p.set(t.x, t.y, t.z), q.setFromAxisAngle(up, t.rotY), s.setScalar(t.s));
      m.toArray(this.world, i * 16);
      // calm variety: a few % brighter/darker, a touch warmer or cooler, per tree
      const h = Math.sin(i * 12.9898 + t.x * 0.37) * 43758.5453;
      const r = h - Math.floor(h);
      const b = 0.9 + r * 0.16;
      const warm = (r - 0.5) * 0.06;
      this.tint[i * 3] = b * (1 + warm); this.tint[i * 3 + 1] = b; this.tint[i * 3 + 2] = b * (1 - warm);
      if (t.stub) {
        this.stubbed.push(i);
        stubMatrix(t, t.stub, m).toArray(this.stubWorld, i * 16);
        _c.set(t.stub.color).toArray(this.stubCol, i * 3);
      }
    });
  }

  /** The quality tier moved (the fps probe): tighten or relax the detail distances. */
  setTier(tier: 'hoog' | 'laag'): void { this.ranges = LOD_RANGES[tier]; }

  /**
   * Load the species GLBs, make their simplified copies and build the level meshes.
   * All-or-nothing: false when a species is missing (the caller keeps its stand-ins).
   * Simplifying yields a frame between species so the world keeps drawing.
   */
  async build(): Promise<boolean> {
    if (!this.placements.length) return false;
    await loadManifest();
    const species = [...new Set(this.placements.map((p) => p.species))];
    const models = species.map((id) => loadModel(id)); // every species downloads at once
    const sets: SpeciesSet[] = [];
    for (const [k, id] of species.entries()) {
      const m = await models[k];
      if (!m) return false;
      const prepped = prepModel(m, TREE_BASE_H[id]);
      prepped.updateMatrixWorld(true);
      const parts: Part[] = [];
      prepped.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) parts.push({ geometry: mesh.geometry, material: mesh.material as THREE.Material, local: mesh.matrixWorld.clone() });
      });
      await new Promise((r) => setTimeout(r, 0)); // let a frame through before the simplify
      const lods = lodGeometries(`${id}@${TREE_BASE_H[id]}`, prepped, LOD_TARGETS[id]);
      const tone = LOD_TONE[id];
      for (const g of lods) {
        if (g.userData.toned) continue;
        const col = g.attributes.color as THREE.BufferAttribute;
        for (let i = 0; i < col.array.length; i++) (col.array as Float32Array)[i] *= tone;
        g.userData.toned = true;
      }
      const trees = this.placements.map((p, i) => (p.species === id ? i : -1)).filter((i) => i >= 0);
      const cap = trees.length;
      const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, name: string): THREE.InstancedMesh => {
        const inst = new THREE.InstancedMesh(geo, mat, cap);
        inst.name = name;
        inst.count = 0;
        inst.frustumCulled = false; // culled per tree in update()
        inst.castShadow = false;
        inst.receiveShadow = false;
        inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        inst.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
        inst.userData.forest = true;
        return inst;
      };
      const short = id.replace('prop-', '');
      const levels: THREE.InstancedMesh[][] = [parts.map((pt, k) => mk(pt.geometry, pt.material, `${short}-tree${k ? `-${k}` : ''}`))];
      lods.forEach((g, k) => levels.push([mk(g, lodMaterial(), `${short}-tree-lod${k + 1}`)]));
      sets.push({ species: id, trees, parts, levels, lists: levels.map(() => []), counts: levels.map(() => 0), sig: levels.map(() => -1), spare: [] });
    }
    if (this.stubbed.length) {
      this.stubGeo = stubGeometry();
      const inst = new THREE.InstancedMesh(this.stubGeo, new THREE.MeshStandardMaterial({ roughness: 0.95 }), this.stubbed.length);
      inst.name = 'tree-stubs';
      inst.count = 0;
      inst.visible = false;
      inst.frustumCulled = false; // drawn with their trees, which are culled per tree in update()
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      inst.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.stubbed.length * 3), 3).setUsage(THREE.DynamicDrawUsage);
      this.stubs = inst;
      this.scene.add(inst);
    }
    this.sets = sets;
    for (const set of sets) for (const lv of set.levels) for (const inst of lv) this.scene.add(inst);
    this.warmGhosts();
    this.ready = true;
    return true;
  }

  /**
   * Compile the see-through copies' shader now, not on the first fade (review PERF-1:
   * each fade cloned the GLB materials and disposed them again when the tree turned
   * solid, and three drops a shader once no material uses it, so every fade after the
   * last ghost cleared compiled it again: a ~100 ms hitch right when the view needs a
   * tree faded). One spare copy per species goes into its pool, and each of its parts
   * is drawn once by an empty mesh (same material, a one-vertex stand-in geometry with
   * the part's attribute layout, nothing to draw), which compiles the shader; the pool
   * keeps its materials alive, so three keeps the shader.
   */
  private warmGhosts(): void {
    for (const set of this.sets) {
      const g = this.makeGhost(set);
      set.spare.push(g);
      const warm = (layout: THREE.BufferGeometry, mat: THREE.Material): void => {
        const geo = new THREE.BufferGeometry();
        for (const [name, attr] of Object.entries(layout.attributes)) {
          geo.setAttribute(name, new THREE.BufferAttribute(new Float32Array(attr.itemSize), attr.itemSize));
        }
        geo.setDrawRange(0, 0);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.frustumCulled = false;
        mesh.castShadow = false;
        mesh.name = 'tree-ghost-warmup';
        mesh.onAfterRender = () => { this.warmed = true; };
        this.warm.push(mesh);
        this.scene.add(mesh);
      };
      set.parts.forEach((pt, k) => warm(pt.geometry, g.mats[k]));
      if (g.stubMat && this.stubGeo) warm(this.stubGeo, g.stubMat); // (the see-through stub's shader too)
    }
  }

  get isReady(): boolean { return this.ready; }

  /** Per rendered frame: cull, choose each tree's level, refill the level meshes that changed. */
  update(camera: THREE.Camera): void {
    if (!this.ready) return;
    if (this.warmed && this.warm.length) { // the ghost shader is compiled: drop the warm-up meshes
      for (const m of this.warm) { this.scene.remove(m); m.geometry.dispose(); }
      this.warm = [];
    }
    _pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_pv);
    const e = camera.matrixWorld.elements;
    const cx = e[12], cy = e[13], cz = e[14];
    const R = this.ranges;
    for (const set of this.sets) {
      const H = TREE_BASE_H[set.species];
      const lists = set.lists;
      for (const l of lists) l.length = 0;
      for (const i of set.trees) {
        if (this.fade[i] < 1) { this.level[i] = -1; continue; } // drawn by its see-through copy
        const p = this.placements[i];
        const h = H * p.s;
        _sphere.center.set(p.x, p.y + h * 0.5, p.z);
        _sphere.radius = h * 0.62;
        if (!_frustum.intersectsSphere(_sphere)) { this.level[i] = -1; continue; }
        const d = Math.hypot(p.x - cx, p.y + h * 0.5 - cy, p.z - cz);
        // (a home tree may keep full detail only nearer: its own first range)
        const edge = (k: number): number => (k === 0 && p.near !== undefined ? Math.min(p.near, R[0]) : R[k]);
        let lv = 0;
        while (lv < R.length && d > edge(lv)) lv++;
        const cur = this.level[i];
        if (cur >= 0 && cur !== lv) {
          // hysteresis: stay on the current level until clearly past its edge
          const lo = cur > 0 ? edge(cur - 1) - HYSTERESIS : -Infinity;
          const hi = cur < R.length ? edge(cur) + HYSTERESIS : Infinity;
          if (d > lo && d < hi) lv = cur;
        }
        this.level[i] = lv;
        lists[lv].push(i);
      }
      lists.forEach((list, k) => {
        let sig = 17;
        for (const i of list) sig = (Math.imul(sig, 31) + i + 1) | 0;
        const same = sig === set.sig[k] && list.length === set.counts[k];
        set.sig[k] = sig;
        set.counts[k] = list.length;
        set.levels[k].forEach((inst, j) => {
          inst.visible = list.length > 0;
          if (!same) fillLevel(inst, list, this.world, this.tint, k === 0 ? set.parts[j].local : null);
        });
      });
    }
    // the stubs of the trees drawn solid now (a see-through tree draws its own)
    const stubs = this.stubs;
    if (stubs) {
      const list = this.stubList;
      list.length = 0;
      for (const i of this.stubbed) if (this.level[i] >= 0) list.push(i);
      let sig = 17;
      for (const i of list) sig = (Math.imul(sig, 31) + i + 1) | 0;
      if (sig !== this.stubSig || list.length !== stubs.count) fillLevel(stubs, list, this.stubWorld, this.stubCol, null);
      this.stubSig = sig;
      stubs.visible = list.length > 0;
    }
  }

  /**
   * Fade exactly the trees the camera rig found in the way (it tests them with
   * world/Crowns.ts, the one tree model): `targets` maps a tree's index to the opacity
   * it drops to at once (see-through, or near-invisible when the lens sits inside it).
   * Every other faded tree eases back toward solid by `release` (0..1 of the way per
   * frame; 1 = a cut). Only those trees ever change: the forest never ghosts as a whole.
   */
  fadeOccluders(targets: ReadonlyMap<number, number>, release: number): void {
    let worst = -1;
    for (const [i, o] of targets) {
      if (i < 0 || i >= this.placements.length) continue;
      if (o > worst) worst = o;
      if (this.fade[i] !== o) this.setFade(i, o);
    }
    for (const i of this.ghosts.keys()) { // (a Map may lose entries while it is iterated)
      if (targets.has(i)) continue;
      const was = this.fade[i];
      const o = was + (1 - was) * release;
      this.setFade(i, o > 0.995 ? 1 : o);
    }
    this.blockingOpacity = worst < 0 ? 1 : worst;
  }

  /** Every crown solid again at once (off-foot, teardown). */
  clearFades(): void {
    for (const i of [...this.ghosts.keys()]) this.setFade(i, 1);
    this.fade.fill(1);
    this.blockingOpacity = 1;
  }

  /** Trees that are see-through right now (dev read-back). */
  fadedCount(): number { return this.ghosts.size; }

  private setFade(i: number, o: number): void {
    this.fade[i] = o;
    let g = this.ghosts.get(i);
    if (o >= 1) {
      if (g) {
        this.scene.remove(g.group);
        g.set.spare.push(g); // back to its pool: its materials (and so the shader) stay alive
        this.ghosts.delete(i);
      }
      return;
    }
    if (!g) {
      const set = this.sets.find((s) => s.species === this.placements[i].species);
      if (!set) return; // stand-ins still up: nothing of its own to fade
      g = set.spare.pop() ?? this.makeGhost(set);
      g.group.matrix.fromArray(this.world, i * 16);
      // the same per-tree tint the instanced copy wore
      _c.setRGB(this.tint[i * 3], this.tint[i * 3 + 1], this.tint[i * 3 + 2]);
      g.mats.forEach((m, k) => {
        const base = (set.parts[k].material as THREE.MeshStandardMaterial).color;
        if (base && m.color) m.color.copy(base).multiply(_c);
      });
      // its branch stub, if it has one: in the tree's own frame (the group carries the tree)
      if (g.stub && g.stubMat) {
        g.stub.visible = !!this.placements[i].stub;
        if (g.stub.visible) {
          g.stub.matrix.fromArray(this.world, i * 16).invert().multiply(_m.fromArray(this.stubWorld, i * 16));
          g.stubMat.color.fromArray(this.stubCol, i * 3);
        }
      }
      this.ghosts.set(i, g);
      this.scene.add(g.group);
    }
    for (const m of g.mats) m.opacity = o;
    if (g.stubMat) g.stubMat.opacity = o; // the stub fades exactly with its tree
    g.group.visible = o > 0.005; // fully faded (the lens inside it): not drawn at all
  }

  /** A new see-through copy of a tree of this species (placed and tinted by setFade). */
  private makeGhost(set: SpeciesSet): Ghost {
    const group = new THREE.Group();
    group.name = `${set.species.replace('prop-', '')}-tree-faded`;
    group.matrixAutoUpdate = false;
    const mats: THREE.MeshStandardMaterial[] = [];
    for (const pt of set.parts) {
      const mat = pt.material.clone() as THREE.MeshStandardMaterial;
      mat.transparent = true;
      mat.depthWrite = false;
      mats.push(mat);
      const mesh = new THREE.Mesh(pt.geometry, mat);
      mesh.matrixAutoUpdate = false;
      mesh.matrix.copy(pt.local);
      mesh.castShadow = false;
      group.add(mesh);
    }
    // a species with a stubbed tree: its copies carry a see-through stub (hidden unless
    // the tree it stands in for has one)
    let stub: THREE.Mesh | null = null, stubMat: THREE.MeshStandardMaterial | null = null;
    if (this.stubGeo && this.stubbed.some((i) => this.placements[i].species === set.species)) {
      stubMat = new THREE.MeshStandardMaterial({ roughness: 0.95, transparent: true, depthWrite: false });
      stub = new THREE.Mesh(this.stubGeo, stubMat);
      stub.name = 'tree-stub-faded';
      stub.matrixAutoUpdate = false;
      stub.castShadow = false;
      stub.visible = false;
      group.add(stub);
    }
    return { group, mats, set, stub, stubMat };
  }
}

const _m = new THREE.Matrix4();
function isIdentity(m: THREE.Matrix4): boolean {
  const e = m.elements;
  for (let i = 0; i < 16; i++) if (Math.abs(e[i] - (i % 5 === 0 ? 1 : 0)) > 1e-6) return false;
  return true;
}

/**
 * Refill one level mesh with the trees in `list` (indices into the per-tree `world`
 * matrices, 16 floats each, and `tint`, 3 each): each tree's placement, times the GLB
 * part's own `local` matrix when it has one, and its tint.
 *
 * It also drops the mesh's cached bounds. three computes an InstancedMesh's bounding
 * sphere once, from the instances it holds at that moment, and never again: a ray
 * that misses that sphere tests no tree at all, and the renderer takes the sphere's
 * centre as the mesh's draw-order depth. Kept, it would describe the trees of an
 * earlier frame, so once the camera had moved a scene ray (golden's occluder probe, a
 * click test) would pass straight through the trees drawn now. Dropped, three
 * recomputes it from the trees drawn now when it next needs it (one pass over them,
 * like the refill itself; the frustum never reads it, each tree is culled in `update`).
 */
export function fillLevel(
  inst: THREE.InstancedMesh, list: readonly number[], world: Float32Array, tint: Float32Array,
  local: THREE.Matrix4 | null,
): void {
  const arr = inst.instanceMatrix.array as Float32Array;
  const col = inst.instanceColor?.array as Float32Array | undefined;
  const part = local && !isIdentity(local) ? local : null;
  list.forEach((i, n) => {
    if (part) _m.fromArray(world, i * 16).multiply(part).toArray(arr, n * 16);
    else arr.set(world.subarray(i * 16, i * 16 + 16), n * 16);
    col?.set(tint.subarray(i * 3, i * 3 + 3), n * 3);
  });
  inst.count = list.length;
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  inst.boundingSphere = null;
  inst.boundingBox = null;
}
