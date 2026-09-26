/**
 * world/Terrain.ts — the ONE ground truth of the explorable Veluwe.
 *
 * Owns the ground mesh and every question about the ground: how high it is at a
 * world point (`y`), which landschap it is (`biome`), and what colour it is painted.
 * Everything that stands on the ground (trees, heather, paths, markers, cabin, board,
 * landmarks, animals, the ranger, the jeep, the helicopter, its pads) asks `y(x,z)`,
 * so nothing can stand on a different ground than the one that is drawn.
 *
 * Why this module exists (2026-09-26): the ground used to be a PlaneGeometry displaced
 * in its own XY plane and then tilted with `mesh.rotation.x = −π/2`. That tilt maps
 * plane-y to world −z, so the DRAWN height at world (x,z) was `heightAt(x, −z)` while
 * every placement used `heightAt(x, z)`: a z-mirror. Trees floated or sank, mission
 * props were buried and the biome colours sat on the wrong side of the map. Here the
 * plane is laid flat INSIDE the geometry (`rotateX` before displacement) and the mesh
 * keeps an identity transform, so a vertex's (x,z) is its world position and the
 * height and colour written there are the ones drawn there. `Terrain.test.ts` pins it.
 */

import * as THREE from 'three';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { BIOME_PALETTE, WATER_LEVEL, biomeAt, heightAt, type Biome } from '../Biomes.ts';
import {
  BIOME_GROUND_TONES, GROUND_BRIGHTEN, GROUND_TILE_PX, GROUND_TILE_REPEAT,
  groundPatch, mottleRGB, vertexTint,
} from '../GroundDetail.ts';

// three-mesh-bvh accelerated raycasts: the tap-to-walk ray (and the dev-hook ground
// check) hit the ~18k-triangle terrain in O(log n). A mesh without a boundsTree falls
// back to the stock raycast, so this one-time patch is safe for every other mesh.
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

/** Edge length of the square ground (m). Covers the 75 m world bound with margin. */
export const TERRAIN_SIZE = 240;
/** Grid cells per edge. 240 / 96 = 2.5 m cells. */
export const TERRAIN_SEGMENTS = 96;

const HALF = TERRAIN_SIZE / 2;
const CELL = TERRAIN_SIZE / TERRAIN_SEGMENTS;
const ROW = TERRAIN_SEGMENTS + 1;
const RAY_TOP = 60;   // ray origin height for raycastY (above the tallest relief)
const RAY_FAR = 200;  // ray length (reaches the deepest basin)
const DOWN = new THREE.Vector3(0, -1, 0);

const _a = new THREE.Color();
const _b = new THREE.Color();
const WET = new THREE.Color('#39422e'); // wet moss/peat at the ven waterline

/**
 * The ground colour at world (x,z) with height h. `detail` mixes the biome's two
 * ground tones by the patch field and adds the soft brightness wash (W4.4/P1.2);
 * without it every biome is its flat palette colour (the `?groundDetail=off` baseline).
 */
export function groundColor(x: number, z: number, h: number, detail: boolean, out: THREE.Color): THREE.Color {
  const biome = biomeAt(x, z);
  if (!detail) return out.set(BIOME_PALETTE[biome].ground);
  const [hexA, hexB] = BIOME_GROUND_TONES[biome];
  _a.set(hexA); _b.set(hexB);
  // heide leans toward its bloom tone so the hub reads as flowering paarse heide
  // (purple mats over sand), not a flat warm-brown slab; other biomes mix evenly.
  const patch = groundPatch(x, z);
  const t = biome === 'heide' ? Math.min(1, patch * 1.5 + 0.08) : patch;
  const m = GROUND_BRIGHTEN * vertexTint(x, z);
  out.setRGB(
    Math.min(1, (_a.r + (_b.r - _a.r) * t) * m),
    Math.min(1, (_a.g + (_b.g - _a.g) * t) * m),
    Math.min(1, (_a.b + (_b.b - _a.b) * t) * m),
  );
  // the ven bank darkens toward wet peat as it nears the water, following the real
  // basin slope (painted on the vertices, so it can never float or z-fight).
  if (biome === 'ven') {
    const wet = 1 - THREE.MathUtils.smoothstep(h, WATER_LEVEL - 0.3, WATER_LEVEL + 1.4);
    out.lerp(WET, wet * 0.6);
  }
  return out;
}

/**
 * The displaced, vertex-coloured ground geometry in WORLD coordinates: vertex (x,z)
 * carries height `heightAt(x,z)` and colour `groundColor(x,z)`. One draw call.
 */
export function buildTerrainGeometry(detail: boolean): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
  geo.rotateX(-Math.PI / 2); // lay it flat in the geometry itself: (x, 0, z) is now world
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    groundColor(x, z, h, detail, c);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  geo.computeBoundsTree();
  return geo;
}

export class Terrain {
  readonly mesh: THREE.Mesh;
  readonly detail: boolean;
  /** Vertex heights on the grid (row-major, x fastest), read back from the geometry. */
  private readonly heights: Float32Array;
  private readonly ray = Object.assign(new THREE.Raycaster(), { firstHitOnly: true });
  private readonly _origin = new THREE.Vector3();

  constructor(opts: { detail: boolean; map?: THREE.Texture | null }) {
    this.detail = opts.detail;
    const geo = buildTerrainGeometry(opts.detail);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    this.heights = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) this.heights[i] = pos.getY(i);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
    if (opts.map) mat.map = opts.map;
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true; // the hero shadow lands on the ground
  }

  /**
   * Height of the DRAWN ground at world (x,z): the exact plane of the terrain triangle
   * under the point (the same two triangles per cell PlaneGeometry builds), so a thing
   * seated at `y(x,z)` touches the pixels. Equals `heightAt(x,z)` at every vertex and
   * stays within ~2 cm of it between vertices. Off the ground plane it falls back to
   * the smooth field.
   */
  y(x: number, z: number): number {
    const gx = (x + HALF) / CELL, gz = (z + HALF) / CELL;
    if (!(gx >= 0 && gz >= 0 && gx <= TERRAIN_SEGMENTS && gz <= TERRAIN_SEGMENTS)) return heightAt(x, z);
    const ix = Math.min(TERRAIN_SEGMENTS - 1, Math.floor(gx));
    const iz = Math.min(TERRAIN_SEGMENTS - 1, Math.floor(gz));
    const fx = gx - ix, fz = gz - iz;
    const h = this.heights;
    const ha = h[ix + ROW * iz];             // (ix,   iz)
    const hb = h[ix + ROW * (iz + 1)];       // (ix,   iz+1)
    const hc = h[ix + 1 + ROW * (iz + 1)];   // (ix+1, iz+1)
    const hd = h[ix + 1 + ROW * iz];         // (ix+1, iz)
    // PlaneGeometry splits each cell along b–d: triangle (a,b,d) below it, (b,c,d) above.
    if (fx + fz <= 1) return ha + fx * (hd - ha) + fz * (hb - ha);
    return hc + (1 - fx) * (hb - hc) + (1 - fz) * (hd - hc);
  }

  /** Which landschap world (x,z) is (the same field the ground is painted with). */
  biome(x: number, z: number): Biome {
    return biomeAt(x, z);
  }

  /** The smooth analytic relief the ground is built from (the dev hook's cross-check). */
  field(x: number, z: number): number {
    return heightAt(x, z);
  }

  /** An independent read of the drawn surface: a ray cast straight down onto the mesh.
   *  NaN when it misses (off the ground plane). For dev-hook checks, not placement. */
  raycastY(x: number, z: number): number {
    this.ray.far = RAY_FAR;
    this.ray.set(this._origin.set(x, RAY_TOP, z), DOWN);
    const hit = this.ray.intersectObject(this.mesh, false);
    return hit.length ? hit[0].point.y : NaN;
  }

  /**
   * Where a ray first meets the drawn ground, or null when it does not within `far`
   * (or leaves the ground plane first).
   * Marches the ray against `y(x,z)` and bisects the crossing. Unlike a mesh raycast it
   * cannot slip between the two triangles of a shared edge: a click whose ray runs
   * exactly along a grid line (the screen-centre column while the camera sits at x = 0,
   * i.e. at spawn) used to hit nothing and the tap walked nowhere.
   */
  intersectRay(ray: THREE.Ray, far = 240, out = new THREE.Vector3()): THREE.Vector3 | null {
    const o = ray.origin, d = ray.direction;
    const above = (t: number): number => o.y + d.y * t - this.y(o.x + d.x * t, o.z + d.z * t);
    if (above(0) < 0) return null; // the ray starts under the ground
    const STEP = 0.5;
    let t0 = 0;
    for (let t1 = STEP; t1 <= far; t1 += STEP) {
      const x = o.x + d.x * t1, z = o.z + d.z * t1;
      if (Math.abs(x) > HALF || Math.abs(z) > HALF) return null; // left the drawn ground
      if (above(t1) <= 0) {
        let a = t0, b = t1;
        for (let i = 0; i < 30; i++) { const m = (a + b) / 2; if (above(m) > 0) a = m; else b = m; }
        return out.set(o.x + d.x * b, o.y + d.y * b, o.z + d.z * b);
      }
      t0 = t1;
    }
    return null;
  }

  /**
   * The fine painterly grain (GroundDetail.mottleRGB) baked once onto a small canvas
   * that repeats over the terrain; multiplied against the vertex colour it reads as
   * brushed tonal variation. Browser-only (needs a canvas).
   */
  static mottleTexture(): THREE.CanvasTexture {
    const N = GROUND_TILE_PX;
    const cv = document.createElement('canvas');
    cv.width = cv.height = N;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(N, N);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const [r, g, b] = mottleRGB(i / N, j / N);
        const o = (j * N + i) * 4;
        img.data[o] = Math.round(r * 255);
        img.data[o + 1] = Math.round(g * 255);
        img.data[o + 2] = Math.round(b * 255);
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(GROUND_TILE_REPEAT, GROUND_TILE_REPEAT);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }
}
