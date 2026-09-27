/**
 * GroundMaterial.ts — the one ground material of the Veluwe (the world's terrain and
 * the title's heath): vertex colours, a soft 20 m painterly mottle and, close to the
 * lens, fine detail per landschap. Light (three + GroundDetail only), so the title can
 * use it without pulling in the world.
 */

import * as THREE from 'three';
import { DETAIL_TILE_M, DETAIL_TILE_PX, GROUND_TILE_PX, GROUND_TILE_REPEAT, detailTexel, mottleRGB } from './GroundDetail.ts';

/**
 * The fine ground detail, close to the lens only (it fades out by ~55 m so the far
 * ground never shimmers): soil grit everywhere, heather florets on the heath, pine
 * needles in the bos, sand grain on the drift sand, soft clumps of grass and moss.
 * Sampled in world space at two scales so the tile never shows. Patched into the
 * standard material, so the ground keeps the shared golden-hour light and fog.
 */
function addGroundDetail(mat: THREE.MeshStandardMaterial, tex: THREE.Texture): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uGroundDetail = { value: tex };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 groundMix;\nvarying vec4 vGround;\nvarying vec3 vGroundPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGround = groundMix;\nvGroundPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uGroundDetail;\nvarying vec4 vGround;\nvarying vec3 vGroundPos;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float gNear = 1.0 - smoothstep(14.0, 55.0, distance(vGroundPos, cameraPosition));
          vec3 d1 = texture2D(uGroundDetail, vGroundPos.xz * ${(1 / DETAIL_TILE_M).toFixed(4)}).rgb;
          vec3 d2 = texture2D(uGroundDetail, vGroundPos.xz * ${(1 / (DETAIL_TILE_M * 0.37)).toFixed(4)} + 0.37).rgb;
          float clump = texture2D(uGroundDetail, vGroundPos.xz * 0.07).r;
          // soil grit on everything
          diffuseColor.rgb *= mix(1.0, 0.84 + 0.32 * (d1.r * 0.5 + d2.r * 0.5), gNear);
          // soft clumps of grass and moss (and ripples in the sand), also a little from afar
          diffuseColor.rgb *= 1.0 + (clump - 0.5) * 0.3 * vGround.w * (0.4 + 0.6 * gNear);
          // pine needles: warm straight strokes on a darker litter
          float nd = max(d1.b, d2.b * 0.8) * vGround.y * gNear;
          diffuseColor.rgb *= mix(1.0, 0.85, vGround.y * gNear * 0.6);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.4, 1.18, 0.9), nd * 0.85);
          // heather: little mauve florets and olive leaf flecks
          float fl = max(d1.g, d2.g) * vGround.x * gNear;
          vec3 floret = mix(vec3(0.34, 0.16, 0.30), vec3(0.20, 0.19, 0.08), step(0.5, d1.r));
          diffuseColor.rgb = mix(diffuseColor.rgb, floret, fl * 0.75);
          // sand: bright grains
          diffuseColor.rgb *= mix(1.0, 0.9 + 0.22 * d2.r, vGround.z * gNear);
        }`);
  };
  mat.customProgramCacheKey = () => 'terrain-ground-detail';
}

/**
 * The ground's material: vertex colours (`color`), the soft 20 m mottle `map` and,
 * with `detail` in a browser, the fine near-lens detail driven by the `groundMix`
 * vertex attribute. Shared by the world's terrain and the title's heath, so both are
 * one ground.
 */
export function groundMaterial(detail: boolean, map: THREE.Texture | null): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  if (map) mat.map = map;
  if (detail && typeof document !== 'undefined') addGroundDetail(mat, detailTexture());
  return mat;
}

/** The fine-detail tile (GroundDetail.detailTexel) on a small repeating canvas. */
function detailTexture(): THREE.CanvasTexture {
  const N = DETAIL_TILE_PX;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(N, N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const [grit, speck, needle] = detailTexel(i / N, j / N);
    const o = (j * N + i) * 4;
    img.data[o] = Math.round(grit * 255);
    img.data[o + 1] = Math.round(speck * 255);
    img.data[o + 2] = Math.round(needle * 255);
    img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace; // data, not colour
  tex.anisotropy = 8;
  return tex;
}

/**
 * The fine painterly grain (GroundDetail.mottleRGB) baked once onto a small canvas
 * that repeats over the ground (12 × over 240 m); multiplied against the vertex colour
 * it reads as brushed tonal variation. Browser-only (needs a canvas).
 */
export function mottleTexture(): THREE.CanvasTexture {
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
