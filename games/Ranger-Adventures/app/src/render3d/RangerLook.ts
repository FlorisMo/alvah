/**
 * RangerLook.ts — the creator's choices (skin, hair, jacket, eyes) on the 3D ranger.
 *
 * The ranger GLB is one skinned mesh with one painted atlas, so the look is a
 * repaint of that atlas: every texel is sorted into hair / jacket / skin / iris by
 * its paint colour and by how high on the body the triangle it sits in is drawn
 * (core/avatar.ts `lookPart`, pure and tested), then pulled to the chosen swatch
 * colour keeping its brush light and shade (`repaint`). The rig's material is
 * shared by every clone (the title ranger, the world ranger), so one repaint dresses
 * them all; a single store subscription repaints when the avatar changes, which is
 * what makes the title ranger beside the creator card a live 3D preview.
 *
 * Best-effort like Models.ts: a model without a painted map is left alone.
 */

import * as THREE from 'three';
import { store } from '../core/state';
import { hexRgb, verfVan, lookPart, paintLum, repaint, type Avatar, type LookPart } from '../core/avatar';

const PARTS: readonly LookPart[] = ['haar', 'outfit', 'huid', 'iris'];
const PART_CODE: Record<LookPart, number> = { haar: 1, outfit: 2, huid: 3, iris: 4 };
const HEIGHT_RES = 256; // body-height lookup resolution over the atlas

interface Painted {
  mat: THREE.MeshStandardMaterial;
  src: Uint8ClampedArray;    // the atlas as painted
  part: Uint8Array;          // per texel: 0 = untouched, else PART_CODE
  mean: Record<LookPart, number>; // each part's average brightness as painted
  ctx: CanvasRenderingContext2D;
  img: ImageData;
  tex: THREE.CanvasTexture;
  key: string;               // the look it shows now
}

const painted = new Map<THREE.Material, Painted>();
let listening = false;

/**
 * Dress every painted mesh under `root` in the saved avatar's look, and keep it
 * dressed as the avatar changes. Safe to call on every clone (the shared material is
 * prepared once).
 */
export function dressRanger(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (Array.isArray(mat) || !mat?.map || painted.has(mat)) return;
    const p = prepare(mesh, mat);
    if (p) painted.set(mat, p);
  });
  const av = store.get().avatar;
  for (const p of painted.values()) paint(p, av);
  if (!listening) {
    listening = true;
    store.subscribe((s) => { for (const p of painted.values()) paint(p, s.avatar); });
  }
}

/** Read the atlas, sort its texels into parts (once per shared material). */
function prepare(mesh: THREE.Mesh, mat: THREE.MeshStandardMaterial): Painted | null {
  const image = mat.map!.image as CanvasImageSource & { width: number; height: number } | undefined;
  if (!image || !image.width || !image.height || typeof document === 'undefined') return null;
  const W = image.width, H = image.height;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0);
  const img = ctx.getImageData(0, 0, W, H);
  const src = new Uint8ClampedArray(img.data);
  const heights = bodyHeights(mesh.geometry, mat.map!.flipY);
  if (!heights) return null;
  const part = new Uint8Array(W * H);
  const sum: Record<LookPart, number> = { haar: 0, outfit: 0, huid: 0, iris: 0 };
  const cnt: Record<LookPart, number> = { haar: 0, outfit: 0, huid: 0, iris: 0 };
  for (let y = 0; y < H; y++) {
    const hy = Math.min(HEIGHT_RES - 1, Math.floor((y / H) * HEIGHT_RES));
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const h = heights[hy * HEIGHT_RES + Math.min(HEIGHT_RES - 1, Math.floor((x / W) * HEIGHT_RES))];
      const r = src[i * 4], g = src[i * 4 + 1], b = src[i * 4 + 2];
      const p = lookPart(r, g, b, h);
      if (!p) continue;
      part[i] = PART_CODE[p];
      sum[p] += paintLum(r, g, b);
      cnt[p]++;
    }
  }
  // stray brush strokes in the hair (a darker brown, a golden glint) belong to the hair
  // when hair surrounds them: otherwise they stay as flecks of the old colour
  const hair = PART_CODE.haar;
  const extra: number[] = [];
  for (let y = 2; y < H - 2; y++) {
    const hy = Math.min(HEIGHT_RES - 1, Math.floor((y / H) * HEIGHT_RES));
    for (let x = 2; x < W - 2; x++) {
      const i = y * W + x;
      if (part[i] || heights[hy * HEIGHT_RES + Math.min(HEIGHT_RES - 1, Math.floor((x / W) * HEIGHT_RES))] < 0.66) continue;
      let n = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (part[i + dy * W + dx] === hair) n++;
      if (n >= 12) extra.push(i);
    }
  }
  for (const i of extra) {
    part[i] = hair;
    sum.haar += paintLum(src[i * 4], src[i * 4 + 1], src[i * 4 + 2]);
    cnt.haar++;
  }
  const mean = { haar: 0, outfit: 0, huid: 0, iris: 0 } as Record<LookPart, number>;
  for (const p of PARTS) mean[p] = cnt[p] ? sum[p] / cnt[p] : 0;
  // the repainted atlas replaces the map (and the emissive map: this GLB lights its
  // own paint) with the same sampling settings
  const orig = mat.map!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = orig.flipY;
  tex.colorSpace = orig.colorSpace;
  tex.wrapS = orig.wrapS; tex.wrapT = orig.wrapT;
  tex.channel = orig.channel;
  tex.anisotropy = orig.anisotropy;
  const usesEmissive = mat.emissiveMap === orig;
  mat.map = tex;
  if (usesEmissive) mat.emissiveMap = tex;
  mat.needsUpdate = true;
  return { mat, src, part, mean, ctx, img, tex, key: '' };
}

/** Repaint the atlas for this avatar (skipped when it already shows that look). */
function paint(p: Painted, av: Avatar): void {
  const key = `${av.haar}|${av.outfit}|${av.huid}|${av.iris}`;
  if (key === p.key) return;
  p.key = key;
  const target: Record<number, [number, number, number]> = {};
  const mean: Record<number, number> = {};
  for (const part of PARTS) {
    target[PART_CODE[part]] = hexRgb(verfVan(part, av[part]));
    mean[PART_CODE[part]] = p.mean[part];
  }
  const d = p.img.data, src = p.src;
  d.set(src);
  for (let i = 0; i < p.part.length; i++) {
    const code = p.part[i];
    if (!code) continue;
    const o = i * 4;
    const [r, g, b] = repaint(src[o], src[o + 1], src[o + 2], target[code], mean[code]);
    d[o] = r; d[o + 1] = g; d[o + 2] = b;
  }
  p.ctx.putImageData(p.img, 0, 0);
  p.tex.needsUpdate = true;
}

/**
 * Where on the body each atlas spot is drawn: rasterize every triangle's UVs into a
 * HEIGHT_RES² map holding the triangle's bind-pose height (0 = soles, 1 = the top),
 * −1 where no triangle is; then grow the islands a few texels so the atlas padding
 * (which mipmaps blend in) is repainted with its island.
 */
function bodyHeights(geo: THREE.BufferGeometry, flipY: boolean): Float32Array | null {
  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  if (!pos || !uv) return null;
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const y0 = bb.min.y, span = Math.max(1e-6, bb.max.y - bb.min.y);
  const N = HEIGHT_RES;
  const map = new Float32Array(N * N).fill(-1);
  const index = geo.getIndex();
  const count = index ? index.count : pos.count;
  const vx = [0, 0, 0], vy = [0, 0, 0];
  for (let t = 0; t + 2 < count; t += 3) {
    let h = 0;
    for (let k = 0; k < 3; k++) {
      const i = index ? index.getX(t + k) : t + k;
      vx[k] = uv.getX(i) * N;
      vy[k] = (flipY ? 1 - uv.getY(i) : uv.getY(i)) * N;
      h += (pos.getY(i) - y0) / span;
    }
    h /= 3;
    const area = (vx[1] - vx[0]) * (vy[2] - vy[0]) - (vx[2] - vx[0]) * (vy[1] - vy[0]);
    if (Math.abs(area) < 1e-9) continue;
    const minX = Math.max(0, Math.floor(Math.min(vx[0], vx[1], vx[2])));
    const maxX = Math.min(N - 1, Math.ceil(Math.max(vx[0], vx[1], vx[2])));
    const minY = Math.max(0, Math.floor(Math.min(vy[0], vy[1], vy[2])));
    const maxY = Math.min(N - 1, Math.ceil(Math.max(vy[0], vy[1], vy[2])));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((vx[1] - px) * (vy[2] - py) - (vx[2] - px) * (vy[1] - py)) / area;
        const w1 = ((vx[2] - px) * (vy[0] - py) - (vx[0] - px) * (vy[2] - py)) / area;
        if (w0 < -0.05 || w1 < -0.05 || 1 - w0 - w1 < -0.05) continue;
        map[y * N + x] = h;
      }
    }
  }
  for (let pass = 0; pass < 3; pass++) {
    const prev = map.slice();
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (prev[y * N + x] >= 0) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
          const v = prev[ny * N + nx];
          if (v >= 0) { map[y * N + x] = v; break; }
        }
      }
    }
  }
  return map;
}
