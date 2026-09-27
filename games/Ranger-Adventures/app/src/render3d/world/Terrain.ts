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
import { BIOME_PALETTE, VEN_CENTER, VEN_SHORE_R, WATER_LEVEL, biomeAt, heightAt, type Biome } from '../Biomes.ts';
import { BIOME_ACCENT_TONES, BIOME_GROUND_TONES, GROUND_BRIGHTEN, groundPatch, groundSpeckle, heathCover, vertexTint } from '../GroundDetail.ts';
import { groundMaterial, mottleTexture } from '../GroundMaterial.ts';
import { PATH_NODES, PATH_SEGMENTS, distanceToNetwork } from '../Paths.ts';

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
const WET = new THREE.Color('#4a4d33');   // wet moss and peat right at the ven's waterline
const CLEAR = new THREE.Color('#c2b089'); // trodden sand and dry grass round the lodge
const FAR = new THREE.Color('#57533a');   // forest floor past the rim: shade under the tree-line

/**
 * The ground colour at world (x,z) with height h. `detail` mixes the biome's two
 * ground tones (the heide by its heather cover, the others by the patch field) and
 * adds the soft brightness wash (W4.4/P1.2); without it every biome is its flat
 * palette colour (the `?groundDetail=off` baseline). On top: the lodge clearing is
 * trodden sand, smaller patches a few metres across break every landschap up (its
 * BIOME_ACCENT_TONES by `groundSpeckle`), the ven basin's bank turns to wet peat just
 * above the water, and past the rim the ground falls into the forest's shade (so no pale
 * "dune" shows behind the tree-line).
 */
export function groundColor(x: number, z: number, h: number, detail: boolean, out: THREE.Color): THREE.Color {
  const biome = biomeAt(x, z);
  if (!detail) return out.set(BIOME_PALETTE[biome].ground);
  const [hexA, hexB] = BIOME_GROUND_TONES[biome];
  _a.set(hexA); _b.set(hexB);
  // the heide mixes sand ↔ heather carpet by heathCover (the field its heather plants
  // grow on, so bush and ground agree); the other biomes mix their tones by the patches.
  const t = biome === 'heide' ? heathCover(x, z) : groundPatch(x, z);
  const m = GROUND_BRIGHTEN * vertexTint(x, z);
  out.setRGB(
    Math.min(1, (_a.r + (_b.r - _a.r) * t) * m),
    Math.min(1, (_a.g + (_b.g - _a.g) * t) * m),
    Math.min(1, (_a.b + (_b.b - _a.b) * t) * m),
  );
  const r = Math.hypot(x, z);
  const clearing = 1 - THREE.MathUtils.smoothstep(r, 5, 10);
  if (clearing > 0) out.lerp(CLEAR, clearing * 0.85);
  // smaller patches a few metres across (wave 4: the floor read as one smooth wash), on
  // the trodden clearing too, more softly: worn sand with tufts and darker soil
  const sp = groundSpeckle(x, z);
  const [lowHex, highHex] = BIOME_ACCENT_TONES[biome];
  const k = 0.8 * (1 - 0.45 * clearing);
  if (sp < 0.38) out.lerp(_a.set(lowHex).multiplyScalar(m), Math.min(1, (0.38 - sp) / 0.12) * k);
  else if (sp > 0.6) out.lerp(_a.set(highHex).multiplyScalar(m), Math.min(1, (sp - 0.6) / 0.12) * k);
  // the basin's bank darkens to wet peat only in the last metre above the water
  if (Math.hypot(x - VEN_CENTER.x, z - VEN_CENTER.z) < VEN_SHORE_R + 2) {
    out.lerp(WET, (1 - THREE.MathUtils.smoothstep(h, WATER_LEVEL - 0.2, WATER_LEVEL + 0.9)) * 0.75);
  }
  if (r > 76) out.lerp(FAR, THREE.MathUtils.smoothstep(r, 76, 88));
  return out;
}

/**
 * Which fine ground detail (GroundDetail.detailTile) the terrain shader lays down at
 * world (x,z): [heather florets, pine needles, sand grain, grass/moss clumps], each in
 * [0,1]. Painted on the vertices, so the landschappen blend over a few metres.
 */
export function groundMix(x: number, z: number, h: number): [number, number, number, number] {
  const r = Math.hypot(x, z);
  const clearing = 1 - THREE.MathUtils.smoothstep(r, 5, 10);
  const inBasin = Math.hypot(x - VEN_CENTER.x, z - VEN_CENTER.z) < VEN_SHORE_R + 2;
  let mix: [number, number, number, number];
  switch (biomeAt(x, z)) {
    case 'heide': { const c = heathCover(x, z); mix = [c, 0, (1 - c) * 0.8, (1 - c) * 0.6]; break; }
    case 'bos': mix = [0, 1, 0, 0.35]; break;
    case 'stuifzand': mix = [0, 0, 1, 0.25]; break;
    default: mix = inBasin ? [0, 0.15, 0.1, 0.7] : [0.25, 0, 0.1, 0.8]; // ven: the wet bank / the wet heath
  }
  if (inBasin && h < WATER_LEVEL + 0.9) mix = [0, 0, 0, 0.5];      // wet peat: smooth
  if (clearing > 0) mix = mix.map((v, i) => v * (1 - clearing) + [0, 0, 0.7, 0.5][i] * clearing) as typeof mix;
  return mix;
}

/**
 * The displaced, vertex-coloured ground geometry in WORLD coordinates: vertex (x,z)
 * carries height `heightAt(x,z)`, colour `groundColor(x,z)` and (with detail) the fine
 * detail mix `groundMix(x,z)`. One draw call.
 */
export function buildTerrainGeometry(detail: boolean): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
  geo.rotateX(-Math.PI / 2); // lay it flat in the geometry itself: (x, 0, z) is now world
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const mixes = new Float32Array(pos.count * 4);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    groundColor(x, z, h, detail, c);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    if (detail) mixes.set(groundMix(x, z, h), i * 4);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  if (detail) geo.setAttribute('groundMix', new THREE.BufferAttribute(mixes, 4));
  geo.computeVertexNormals();
  geo.computeBoundsTree();
  return geo;
}

/**
 * W4.3 → wave 4: the sand-path network (Paths.ts) as ONE terrain-hugging ribbon mesh along
 * every edge, a Veluwe sand track: two sandy wheel ruts with a strip of the ground's own
 * growth between them, fading at its edges into the ground it lies on (it takes the
 * ground's own colour and detail mix there: `Terrain.sampleAttr`, and the ground's plate
 * uv for its mottle map, so drawn with the ground's material it has no seam). The colour
 * comes from the distance to the whole NETWORK, not to its own ribbon, so where ribbons
 * overlap (the spokes at the clearing) both draw the same colour and never flicker. The
 * tracks start at the edge of the trodden spawn clearing. Every vertex sits 3 cm over the
 * drawn ground (under the 5 cm halo rings). Wound to face UP: the old ribbon faced down, so
 * it was back-face culled and no path was ever drawn (parent B11 "flat brown ground").
 */
export function buildPathGeometry(terrain: Terrain): THREE.BufferGeometry {
  const STEP = 1.0;                                   // rib spacing along a segment (m)
  const LIFT = 0.03;                                  // just above the terrain (under the 5 cm halo rings)
  const ACROSS = [-1.9, -1.15, -0.45, -0.2, 0.2, 0.45, 1.15, 1.9]; // the cross-section (m)
  const W = ACROSS.length;
  const sand = new THREE.Color('#cdb887'), rut = new THREE.Color('#bda877'), c = new THREE.Color();
  const detail = terrain.detail;
  const positions: number[] = [], colors: number[] = [], mixes: number[] = [], uvs: number[] = [], indices: number[] = [];
  const gc: number[] = [], gm: number[] = [];
  // how sandy the track is at (x,z) from the network's centreline: 0 = the ground itself
  const profile = (d: number): { sand: number; mid: number } => {
    const edge = 1 - THREE.MathUtils.smoothstep(d, 1.05, 1.9);  // the sandy band fades out at its edges
    const mid = 1 - THREE.MathUtils.smoothstep(d, 0.2, 0.45);    // the grassy strip between the ruts
    return { sand: edge, mid };
  };
  for (const [i, j] of PATH_SEGMENTS) {
    const a = PATH_NODES[i], b = PATH_NODES[j];
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    const px = -dz / len, pz = dx / len;              // unit perpendicular in XZ
    const ribs = Math.max(2, Math.ceil(len / STEP) + 1);
    const base = positions.length / 3;
    for (let r = 0; r < ribs; r++) {
      const t = r / (ribs - 1);
      const cx = a.x + dx * t, cz = a.z + dz * t;
      for (const off of ACROSS) {
        const x = cx + px * off, z = cz + pz * off;
        positions.push(x, terrain.y(x, z) + LIFT, z);
        uvs.push((x + 120) / 240, (120 - z) / 240);   // the ground plate's own uv (its mottle map)
        terrain.sampleAttr('color', x, z, gc);
        const d = distanceToNetwork(x, z);
        const prof = profile(d), mid = prof.mid;
        // the tracks start at the edge of the trodden spawn clearing (Terrain paints that)
        const s = prof.sand * THREE.MathUtils.smoothstep(Math.hypot(x, z), 6, 11);
        // ruts of sand (a touch darker in the wheel tracks), a strip of the ground's own
        // growth between them, the ground itself at the edges
        c.copy(sand).lerp(rut, THREE.MathUtils.smoothstep(d, 0.45, 0.9) * (1 - THREE.MathUtils.smoothstep(d, 0.9, 1.2)));
        const k = s * (1 - 0.6 * mid);
        colors.push(gc[0] + (c.r - gc[0]) * k, gc[1] + (c.g - gc[1]) * k, gc[2] + (c.b - gc[2]) * k);
        if (detail) {
          terrain.sampleAttr('groundMix', x, z, gm);
          const want = [0, 0, 0.9, 0.3 + 0.5 * mid];   // sand grain in the ruts, clumps in the strip
          for (let q = 0; q < 4; q++) mixes.push(gm[q] + (want[q] - gm[q]) * s);
        }
      }
      if (r > 0) {
        const p0 = base + (r - 1) * W, p1 = base + r * W;
        for (let q = 0; q + 1 < W; q++) {
          // wound so the face looks UP (the old ribbon faced down and was culled)
          indices.push(p0 + q, p0 + q + 1, p1 + q, p0 + q + 1, p1 + q + 1, p1 + q);
        }
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (detail) geo.setAttribute('groundMix', new THREE.Float32BufferAttribute(mixes, 4));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/* ----------------------------------------------------------- beyond the rim ---- */

/** The forest beyond the rim starts this far (m) past the move bound: just behind the
 *  rim tree-line's third row (Dressing.buildRim: rows at +1.4, +5.6 and +10.2 m). */
export const FAR_FOREST_IN = 13;
/** ...and runs out to this radius: past anything the lens (far plane 240 m, never
 *  further out than the bound) can see, so no view ever reaches its end. */
export const FAR_FOREST_OUT = 330;
const FAR_AROUND = 420;        // segments round the ring (1.3 m apart at its inner edge)
/** Crowns per side of one canopy tile, and the tile's size in world metres (~3.8 m crowns). */
const FAR_GRID = 8;
export const FAR_TILE_M = 30;

/** A stable hash of an integer pair + seed → [0,1). */
function hash2(x: number, z: number, seed: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(seed | 0, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth open value noise in [0,1]. */
function vnoise2(x: number, z: number, seed: number): number {
  const x0 = Math.floor(x), z0 = Math.floor(z);
  const fx = x - x0, fz = z - z0;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash2(x0, z0, seed), b = hash2(x0 + 1, z0, seed), c = hash2(x0, z0 + 1, seed), d = hash2(x0 + 1, z0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

/**
 * The crown of the canopy at tile coordinates (u, v) (FAR_GRID crowns per tile side,
 * repeating seamlessly): how far in from its edge the point lies (`t`: 0 on the crest, 1
 * at the lobed edge, > 1 in a gap), the offset from its centre in crown radii (`bx`, `bz`)
 * and the crown's own size in [0,1). The geometry's domes (buildFarForest) and the painted
 * shading (farCanopyTexture) both read it, so the painted crowns sit on the modelled ones.
 */
export function canopyCrown(u: number, v: number): { t: number; bx: number; bz: number; size: number } {
  const G = FAR_GRID, C = crownTable();
  const cu = Math.floor(u), cv = Math.floor(v);
  let t = Infinity, bx = 0, bz = 0, size = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const wi = (((cu + i) % G) + G) % G, wj = (((cv + j) % G) + G) % G;
    const c = (wj * G + wi) * 5;
    const dx = u - (cu + i + C[c]), dz = v - (cv + j + C[c + 1]), r = C[c + 2];
    const d = Math.sqrt(dx * dx + dz * dz);
    // a lobed outline (leaf clusters); a crown clearly out of reach needs no trig
    const k = d > r * 1.16 ? d / r : d / (r * (1 + 0.15 * Math.sin(Math.atan2(dz, dx) * 5 + C[c + 4])));
    if (k < t) { t = k; bx = dx / r; bz = dz / r; size = C[c + 3]; }
  }
  return { t, bx, bz, size };
}

let crowns: Float32Array | null = null;
/** Per crown of the tile: its centre in its cell, radius, size and lobe phase (made once). */
function crownTable(): Float32Array {
  if (crowns) return crowns;
  const G = FAR_GRID;
  crowns = new Float32Array(G * G * 5);
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const c = (j * G + i) * 5, sz = hash2(i, j, 23);
    crowns[c] = 0.2 + 0.6 * hash2(i, j, 17);
    crowns[c + 1] = 0.2 + 0.6 * hash2(i, j, 19);
    crowns[c + 2] = 0.5 + 0.2 * sz;
    crowns[c + 3] = sz;
    crowns[c + 4] = hash2(i, j, 31) * 6.28;
  }
  return crowns;
}

/** Which trees make up the forest beyond the rim at (x,z), in [0,1]: dark pine stands
 *  (0) to lighter oak and birch (1), in patches of a few tens of metres. */
export function farStand(x: number, z: number): number {
  const n = 0.7 * vnoise2(x * 0.035, z * 0.035, 331) + 0.3 * vnoise2(x * 0.09, z * 0.09, 337);
  return THREE.MathUtils.smoothstep(n, 0.42, 0.68);
}

/** How high (m) the canopy stands above the ground at (x,z): a slow swell (~5.5-8 m; the
 *  rim's own trees are 6.6-12 m tall) with each crown a rounded dome on it. `fine` (0..1)
 *  scales the domes: the coarse outer rings cannot draw them. */
export function farCanopyLift(x: number, z: number, fine = 1): number {
  const swell = 6.6 + 1.2 * (vnoise2(x * 0.03, z * 0.03, 311) * 2 - 1);
  if (fine <= 0) return swell + 0.7;
  const c = canopyCrown((x / FAR_TILE_M) * FAR_GRID, (z / FAR_TILE_M) * FAR_GRID);
  const dome = c.t < 1 ? (1 - c.t * c.t) ** 1.2 : 0;
  return swell + (1 - fine) * 0.7 + fine * (1.2 + 0.9 * c.size) * dome;
}

// the forest beyond, seen from inside: dark shade under the trees, then the canopy
const FAR_DEEP = new THREE.Color('#2a2717');    // the forest floor in deep shade
const FAR_TRUNKS = new THREE.Color('#403c23');  // the trunk zone in shadow (the texture streaks it)
const FAR_UNDER = new THREE.Color('#4a5626');   // the crowns' undersides
const FAR_PINE = new THREE.Color('#566f28');    // pine stands (the texture shades the crowns)
const FAR_LEAF = new THREE.Color('#7f9636');    // oak and birch

/**
 * The forest beyond the playable rim (parent B11, breaker B9): one ring-shaped mesh from
 * just behind the rim tree-line out to FAR_FOREST_OUT, so no view — on foot at the rim,
 * from the jeep, from the helicopter at cruise height — ever reaches the end of the
 * ground plate. Its inner edge is the shaded depth of a forest (dark trunks under the
 * crowns) behind the real rim trees; its top is a canopy of rounded crowns (modelled where
 * the rings are fine enough, painted everywhere by `farCanopyTexture` on the same layout)
 * in pine stands and lighter oak and birch, and the fog dissolves it into the horizon
 * haze. One draw call, ~46k triangles. Positions, vertex colours and uv (in tile units
 * of world metres, every row alike). `ground` = the drawn ground height.
 */
export function buildFarForest(bound: number, ground: (x: number, z: number) => number): THREE.BufferGeometry {
  const r0 = bound + FAR_FOREST_IN;
  // the rows from the inside out: the shaded face, then the canopy rings (finer near the rim)
  // The canopy's first ring hangs out over the face (like the crowns of edge trees), so
  // from above only crowns show behind the rim trees, never a dark band; from below, the
  // fold between them is the crowns' shaded underside.
  const rows: { r: number; kind: 'deep' | 'trunks' | 'under' | 'canopy'; step: number }[] = [
    { r: r0, kind: 'deep', step: 0 },
    { r: r0 + 0.2, kind: 'trunks', step: 0 },
    { r: r0 + 0.7, kind: 'under', step: 0 },
    { r: r0 - 0.6, kind: 'canopy', step: 1.25 },
  ];
  for (let r = r0 + 0.8, step = 1.25; r < FAR_FOREST_OUT + step; r += step, step *= 1.045) {
    rows.push({ r: Math.min(r, FAR_FOREST_OUT), kind: 'canopy', step });
  }
  const A = FAR_AROUND;
  const pos = new Float32Array(rows.length * A * 3);
  const col = new Float32Array(rows.length * A * 3);
  const uv = new Float32Array(rows.length * A * 2);
  const c = new THREE.Color();
  rows.forEach((row, k) => {
    const around = (2 * Math.PI * row.r) / A;
    // the domes need ~4 vertices across a crown: they flatten out as the rings coarsen
    const fine = THREE.MathUtils.clamp((2.4 - Math.max(row.step, around)) / 0.9, 0, 1);
    for (let a = 0; a < A; a++) {
      const ang = (a / A) * Math.PI * 2;
      const x = Math.cos(ang) * row.r, z = Math.sin(ang) * row.r;
      const g = ground(x, z);
      let y: number;
      const j = k * A + a;
      // every row takes the texture in world metres: a row with other uv squeezes whole
      // tiles into the band between them, which aliased into stripes seen from the air
      uv[j * 2] = x / FAR_TILE_M; uv[j * 2 + 1] = z / FAR_TILE_M;
      if (row.kind === 'canopy') {
        y = g + farCanopyLift(x, z, fine);
        c.copy(FAR_PINE).lerp(FAR_LEAF, farStand(x, z));
      } else {
        y = g + (row.kind === 'deep' ? -0.6 : row.kind === 'trunks' ? 2.6 : 5.0);
        c.copy(row.kind === 'deep' ? FAR_DEEP : row.kind === 'trunks' ? FAR_TRUNKS : FAR_UNDER);
      }
      pos[j * 3] = x; pos[j * 3 + 1] = y; pos[j * 3 + 2] = z;
      col[j * 3] = c.r; col[j * 3 + 1] = c.g; col[j * 3 + 2] = c.b;
    }
  });
  const index: number[] = [];
  for (let k = 0; k + 1 < rows.length; k++) {
    for (let a = 0; a < A; a++) {
      const p = k * A + a, q = k * A + ((a + 1) % A), p2 = p + A, q2 = q + A;
      index.push(p, q, p2, q, q2, p2); // wound so the canopy faces up and the inner face the rim
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * The canopy seen from above, one seamless tile (FAR_TILE_M metres, FAR_GRID² crowns on
 * the `canopyCrown` layout the geometry's domes use): each crown lit by the low sun from
 * the west-south-west (as in the world) with leafy grain, dark gaps between them.
 * Brightness only: the vertex colour gives the hue. Browser-only (a canvas); null without.
 */
export function farCanopyTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const N = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(N, N);
  // the sun (Lighting keyDir −9, 7, 4) in the tile's frame: u = world x, v = world z
  const L = new THREE.Vector3(-9, 7, 4).normalize();
  for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
    // uv (0,0) is the canvas's bottom-left (flipY): v runs up the canvas
    const cr = canopyCrown(((px + 0.5) / N) * FAR_GRID, (1 - (py + 0.5) / N) * FAR_GRID);
    const clump = vnoise2(px / 4.5, py / 4.5, 41) * 0.55 + vnoise2(px / 2, py / 2, 43) * 0.45; // leafy grain
    let b: number;
    if (cr.t < 1) {
      const ny = Math.sqrt(Math.max(0, 1 - cr.bx * cr.bx - cr.bz * cr.bz));
      const lit = Math.max(0, cr.bx * L.x + ny * L.y + cr.bz * L.z);
      b = (0.5 + 0.55 * lit) * (0.84 + 0.26 * clump) * (1 - 0.3 * cr.t ** 3);
    } else b = 0.34 + 0.1 * clump;                           // the shaded gaps between crowns (soft: hard ones alias into stripes at a glance)
    const o = (py * N + px) * 4;
    const val = Math.round(Math.min(1, b) * 255);
    img.data[o] = val; img.data[o + 1] = val; img.data[o + 2] = Math.round(val * 0.95); img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16; // seen at a glancing angle from the heli: sharp, not striped (three clamps to the GPU's max)
  return tex;
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
    const mat = groundMaterial(opts.detail, opts.map ?? null);
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

  /**
   * The ground's own vertex attribute (`color`: rgb, `groundMix`: the four detail weights)
   * as the GPU interpolates it at world (x,z): the same two triangles per cell as `y`.
   * Something drawn over the ground with the ground's material (the sand paths) fades
   * into it seamlessly by taking these at its edge. Writes `out` (zeros when the
   * attribute is missing or (x,z) is off the plane) and returns it.
   */
  sampleAttr(name: 'color' | 'groundMix', x: number, z: number, out: number[]): number[] {
    const attr = this.mesh.geometry.getAttribute(name) as THREE.BufferAttribute | undefined;
    const n = name === 'color' ? 3 : 4;
    out.length = n;
    out.fill(0);
    const gx = (x + HALF) / CELL, gz = (z + HALF) / CELL;
    if (!attr || !(gx >= 0 && gz >= 0 && gx <= TERRAIN_SEGMENTS && gz <= TERRAIN_SEGMENTS)) return out;
    const ix = Math.min(TERRAIN_SEGMENTS - 1, Math.floor(gx));
    const iz = Math.min(TERRAIN_SEGMENTS - 1, Math.floor(gz));
    const fx = gx - ix, fz = gz - iz;
    const a = (ix + ROW * iz) * n, b = (ix + ROW * (iz + 1)) * n, c = (ix + 1 + ROW * (iz + 1)) * n, d = (ix + 1 + ROW * iz) * n;
    const v = attr.array as Float32Array;
    for (let k = 0; k < n; k++) {
      out[k] = fx + fz <= 1
        ? v[a + k] + fx * (v[d + k] - v[a + k]) + fz * (v[b + k] - v[a + k])
        : v[c + k] + (1 - fx) * (v[b + k] - v[c + k]) + (1 - fz) * (v[d + k] - v[c + k]);
    }
    return out;
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

  /** The fine painterly grain (GroundDetail.mottleRGB) on a small repeating canvas
   *  (GroundMaterial.ts). Browser-only (needs a canvas). */
  static mottleTexture(): THREE.CanvasTexture {
    return mottleTexture();
  }
}
