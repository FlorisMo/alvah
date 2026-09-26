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
 * The occluder fade is per tree: the crowns that block the lens → ranger sightline are
 * lifted out of the instanced meshes and drawn as a see-through copy of their own
 * (`fadeOccluders`); every other tree stays solid (the forest never ghosts as a whole).
 */

import * as THREE from 'three';
import { loadManifest, loadModel, prepModel } from '../Models';
import { lodGeometries, lodMaterial } from '../Lod';

export type TreeSpecies = 'prop-pine-scots' | 'prop-oak-tree' | 'prop-birch-tree';
export interface TreePlacement { x: number; y: number; z: number; s: number; rotY: number; species: TreeSpecies }
/** prepModel target height (m) per species; a per-tree scale rides on top. */
export const TREE_BASE_H: Record<TreeSpecies, number> = {
  'prop-pine-scots': 6.6, 'prop-oak-tree': 5.4, 'prop-birch-tree': 6.0,
};
/** The crown model the camera rig's occluder test uses (CameraRig): a sphere at this
 *  fraction of the tree's height, with this fraction of its height as radius; the lens
 *  counts as INSIDE a crown within the radius + this margin. */
export const CROWN_CENTER_FRAC = 0.55;
export const CROWN_RADIUS_FRAC = 0.38;
export const CROWN_INSIDE_MARGIN = 0.6;

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
  counts: number[];                      // instances drawn per level this frame
  sig: number[];                         // a running signature of what each level holds
}

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
  private readonly ghosts = new Map<number, { group: THREE.Group; mats: THREE.Material[] }>();

  constructor(scene: THREE.Scene, placements: TreePlacement[], tier: 'hoog' | 'laag') {
    this.scene = scene;
    this.placements = placements;
    this.ranges = LOD_RANGES[tier];
    const n = placements.length;
    this.level = new Int8Array(n).fill(-1);
    this.world = new Float32Array(n * 16);
    this.tint = new Float32Array(n * 3);
    this.fade = new Float32Array(n).fill(1);
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
    const sets: SpeciesSet[] = [];
    for (const id of species) {
      const m = await loadModel(id);
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
      sets.push({ species: id, trees, parts, levels, counts: levels.map(() => 0), sig: levels.map(() => -1) });
    }
    this.sets = sets;
    for (const set of sets) for (const lv of set.levels) for (const inst of lv) this.scene.add(inst);
    this.ready = true;
    return true;
  }

  get isReady(): boolean { return this.ready; }

  /** Per rendered frame: cull, choose each tree's level, refill the level meshes that changed. */
  update(camera: THREE.Camera): void {
    if (!this.ready) return;
    _pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_pv);
    const e = camera.matrixWorld.elements;
    const cx = e[12], cy = e[13], cz = e[14];
    const R = this.ranges;
    for (const set of this.sets) {
      const H = TREE_BASE_H[set.species];
      const lists = set.levels.map(() => [] as number[]);
      for (const i of set.trees) {
        if (this.fade[i] < 1) { this.level[i] = -1; continue; } // drawn by its see-through copy
        const p = this.placements[i];
        const h = H * p.s;
        _sphere.center.set(p.x, p.y + h * 0.5, p.z);
        _sphere.radius = h * 0.62;
        if (!_frustum.intersectsSphere(_sphere)) { this.level[i] = -1; continue; }
        const d = Math.hypot(p.x - cx, p.y + h * 0.5 - cy, p.z - cz);
        let lv = 0;
        while (lv < R.length && d > R[lv]) lv++;
        const cur = this.level[i];
        if (cur >= 0 && cur !== lv) {
          // hysteresis: stay on the current level until clearly past its edge
          const lo = cur > 0 ? R[cur - 1] - HYSTERESIS : -Infinity;
          const hi = cur < R.length ? R[cur] + HYSTERESIS : Infinity;
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
          inst.count = list.length;
          inst.visible = list.length > 0;
          if (same) return;
          const arr = inst.instanceMatrix.array as Float32Array;
          const col = inst.instanceColor!.array as Float32Array;
          const local = k === 0 ? set.parts[j].local : null;
          list.forEach((i, n) => {
            if (local && !isIdentity(local)) _m.fromArray(this.world, i * 16).multiply(local).toArray(arr, n * 16);
            else arr.set(this.world.subarray(i * 16, i * 16 + 16), n * 16);
            col.set(this.tint.subarray(i * 3, i * 3 + 3), n * 3);
          });
          inst.instanceMatrix.needsUpdate = true;
          inst.instanceColor!.needsUpdate = true;
        });
      });
    }
  }

  /**
   * Fade the crowns between the lens and the ranger (the camera rig decides the view is
   * `blocked`; this finds WHICH trees do it, with the rig's crown model). A blocking
   * crown drops at once to `min` (`buried` when the lens sits inside it); every other
   * faded crown eases back toward solid by `release` (0..1 of the way per frame; 1 = a
   * cut). Only the blocking trees ever change: the forest never ghosts as a whole.
   */
  fadeOccluders(
    blocked: boolean, eye: THREE.Vector3, feet: THREE.Vector3, aimHeights: readonly number[],
    release: number, min: number, buried: number,
  ): void {
    let worst = -1;
    const ex = eye.x, ey = eye.y, ez = eye.z;
    for (let i = 0; i < this.placements.length; i++) {
      const p = this.placements[i];
      const H = TREE_BASE_H[p.species] * p.s;
      const R = H * CROWN_RADIUS_FRAC;
      const ccx = p.x, ccy = p.y + H * CROWN_CENTER_FRAC, ccz = p.z;
      let target = 1;
      if (blocked && Math.abs(ccx - ex) < 30 && Math.abs(ccz - ez) < 30) {
        const ix = ex - ccx, iy = ey - ccy, iz = ez - ccz, Ri = R + CROWN_INSIDE_MARGIN;
        if (ix * ix + iy * iy + iz * iz <= Ri * Ri) target = buried;
        else {
          for (const ah of aimHeights) {
            const dx = feet.x - ex, dy = feet.y + ah - ey, dz = feet.z - ez;
            const len2 = dx * dx + dy * dy + dz * dz;
            if (len2 < 1e-6) continue;
            const t = ((ccx - ex) * dx + (ccy - ey) * dy + (ccz - ez) * dz) / len2;
            if (t <= 0.02 || t >= 0.9) continue;
            const gx = ccx - (ex + dx * t), gy = ccy - (ey + dy * t), gz = ccz - (ez + dz * t);
            if (gx * gx + gy * gy + gz * gz <= R * R) { target = min; break; }
          }
        }
      }
      const was = this.fade[i];
      let o: number;
      if (target < 1) o = target;                          // attack: at once
      else if (was >= 1) continue;                         // solid and staying solid
      else o = was + (1 - was) * release;                  // release: ease back
      if (o > 0.995) o = 1;
      if (target < 1 && o > worst) worst = o;
      this.setFade(i, o);
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
        for (const m of g.mats) m.dispose();
        this.ghosts.delete(i);
      }
      return;
    }
    if (!g) {
      const set = this.sets.find((s) => s.species === this.placements[i].species);
      if (!set) return; // stand-ins still up: nothing of its own to fade
      const group = new THREE.Group();
      group.name = `${set.species.replace('prop-', '')}-tree-faded`;
      group.matrixAutoUpdate = false;
      group.matrix.fromArray(this.world, i * 16);
      const mats: THREE.Material[] = [];
      for (const pt of set.parts) {
        const mat = pt.material.clone();
        mat.transparent = true;
        mat.depthWrite = false;
        mats.push(mat);
        const mesh = new THREE.Mesh(pt.geometry, mat);
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(pt.local);
        mesh.castShadow = false;
        group.add(mesh);
      }
      // the same per-tree tint the instanced copy wore
      _c.setRGB(this.tint[i * 3], this.tint[i * 3 + 1], this.tint[i * 3 + 2]);
      for (const m of mats) (m as THREE.MeshStandardMaterial).color?.multiply(_c);
      g = { group, mats };
      this.ghosts.set(i, g);
      this.scene.add(group);
    }
    for (const m of g.mats) m.opacity = o;
  }
}

const _m = new THREE.Matrix4();
function isIdentity(m: THREE.Matrix4): boolean {
  const e = m.elements;
  for (let i = 0; i < 16; i++) if (Math.abs(e[i] - (i % 5 === 0 ? 1 : 0)) > 1e-6) return false;
  return true;
}
