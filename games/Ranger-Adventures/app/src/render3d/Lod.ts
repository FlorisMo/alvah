/**
 * Lod.ts — lower-detail copies of a loaded GLB, made at load time (no new assets).
 *
 * `lodGeometries(id, prepped, targets)` bakes a normalized model (Models.prepModel:
 * feet at y=0, x/z-centred, scaled to its stand height) into one model-space mesh,
 * samples the model's own base-colour texture at every vertex, and simplifies it
 * (Simplify.ts) to each triangle target. The result is a vertex-coloured geometry per
 * target that draws with one shared material (`lodMaterial`), so a far tree or a
 * heather bush costs a few hundred triangles instead of ~12k and still wears the
 * colours of the real model. Results are cached per model + height, so re-entering
 * the world (after a mission, a title round-trip) does not simplify twice.
 */

import * as THREE from 'three';
import { simplify } from './Simplify';

const cache = new Map<string, THREE.BufferGeometry[]>();
const SAMPLE_PX = 128; // the texture is read at this size: a far copy needs the colour, not the detail

/** Read a texture's pixels (sRGB bytes) at SAMPLE_PX², or null when it has no drawable image. */
function texturePixels(tex: THREE.Texture | null | undefined): Uint8ClampedArray | null {
  const img = tex?.image as CanvasImageSource | undefined;
  if (!img || typeof document === 'undefined') return null;
  try {
    const cv = document.createElement('canvas');
    cv.width = cv.height = SAMPLE_PX;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, SAMPLE_PX, SAMPLE_PX);
    return ctx.getImageData(0, 0, SAMPLE_PX, SAMPLE_PX).data;
  } catch {
    return null;
  }
}

const srgbToLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/**
 * Simplified, vertex-coloured copies of `prepped` (its meshes baked into its own
 * space), one per triangle target, cached under `key`. Returns [] when the model has
 * no mesh.
 */
export function lodGeometries(key: string, prepped: THREE.Object3D, targets: number[]): THREE.BufferGeometry[] {
  const hit = cache.get(key);
  if (hit) return hit;
  prepped.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(prepped.matrixWorld).invert();
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const v = new THREE.Vector3();
  const m = new THREE.Matrix4();
  prepped.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry?.attributes.position) return;
    const g = mesh.geometry;
    const pos = g.attributes.position as THREE.BufferAttribute;
    const uv = g.attributes.uv as THREE.BufferAttribute | undefined;
    const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
    const px = texturePixels(mat?.map);
    const base = mat?.color ?? new THREE.Color(1, 1, 1);
    m.multiplyMatrices(inv, mesh.matrixWorld); // mesh → prepped space
    const off = positions.length / 3;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      positions.push(v.x, v.y, v.z);
      let r = 0.5, gg = 0.5, b = 0.5;
      if (px && uv) {
        const u = uv.getX(i), w = uv.getY(i);
        const x = Math.min(SAMPLE_PX - 1, Math.max(0, Math.floor((u - Math.floor(u)) * SAMPLE_PX)));
        const y = Math.min(SAMPLE_PX - 1, Math.max(0, Math.floor((w - Math.floor(w)) * SAMPLE_PX)));
        const o4 = (y * SAMPLE_PX + x) * 4;
        r = srgbToLinear(px[o4] / 255); gg = srgbToLinear(px[o4 + 1] / 255); b = srgbToLinear(px[o4 + 2] / 255);
      }
      colors.push(r * base.r, gg * base.g, b * base.b);
    }
    const idx = g.index;
    if (idx) for (let i = 0; i < idx.count; i++) indices.push(off + idx.getX(i));
    else for (let i = 0; i < pos.count; i++) indices.push(off + i);
  });
  if (!indices.length) return [];
  const out = simplify(
    { positions: new Float32Array(positions), indices, colors: new Float32Array(colors) },
    targets,
  ).map((s) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(s.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(s.colors ?? new Float32Array(s.positions.length).fill(0.5), 3));
    geo.setIndex(new THREE.BufferAttribute(s.indices, 1));
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    return geo;
  });
  cache.set(key, out);
  return out;
}

let sharedMat: THREE.MeshStandardMaterial | null = null;
/** The one material every LOD copy draws with: its colours are on the vertices. */
export function lodMaterial(): THREE.MeshStandardMaterial {
  if (!sharedMat) {
    sharedMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
  }
  return sharedMat;
}
