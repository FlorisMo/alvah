/**
 * world/props.ts — small shared helpers for placed props: the instant procedural
 * stand-in shown until a GLB streams in, and opting a loaded prop into the hero
 * shadow map.
 */

import * as THREE from 'three';

/** W4.5: opt a loaded prop/ranger into the hero shadow map (Models.ts clears
 *  castShadow on every mesh at load, so this re-enables it on the hero set only).
 *  The sun's tight ranger-following frustum still culls to the closest props. */
export function enableCast(obj: THREE.Object3D): void {
  obj.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
}

/** The instant procedural stand-in (a post + a coloured orb) a prop, marker or
 *  vehicle shows until its GLB streams in. Tagged `userData.totem` so the loader can
 *  find and drop it. */
export function proceduralTotem(color: string): THREE.Group {
  const g = new THREE.Group();
  g.userData.totem = true;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1, 6), new THREE.MeshStandardMaterial({ color: '#6b513a', roughness: 1 }));
  post.position.y = 0.5;
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), new THREE.MeshStandardMaterial({ color, roughness: 0.6, emissive: new THREE.Color(color), emissiveIntensity: 0.25 }));
  orb.position.y = 1.2;
  g.add(post, orb);
  return g;
}

/**
 * Paint a loaded prop's pale concrete (bright, near-grey texels of its base-colour map)
 * into living ground: sandy track, dry grass and moss in soft patches, keeping each
 * texel's own light and shade. The ecoduct GLB arrives as a green arch on a bare
 * grey-white slab that read as an untextured block (parent B11); a wildlife bridge is
 * soil and plants. Browser-only (a canvas); a map it cannot read is left alone.
 */
export function naturaliseConcrete(root: THREE.Object3D): void {
  if (typeof document === 'undefined') return;
  const SAND = [0.74, 0.64, 0.45], GRASS = [0.52, 0.56, 0.28], MOSS = [0.34, 0.45, 0.2];
  const hash = (x: number, y: number): number => {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const patch = (x: number, y: number): number => { // smooth value noise, ~20 texels
    const fx = x / 20, fy = y / 20, x0 = Math.floor(fx), y0 = Math.floor(fy);
    const u = fx - x0, v = fy - y0, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
    const a = hash(x0, y0), b = hash(x0 + 1, y0), c = hash(x0, y0 + 1), d = hash(x0 + 1, y0 + 1);
    return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
  };
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const mat = m as THREE.MeshStandardMaterial;
      // the GLB's materials are shared by every clone of it (Models caches the GLTF): paint once
      if (mat.userData.naturalised) continue;
      mat.userData.naturalised = true;
      const tex = mat.map;
      const img = tex?.image as CanvasImageSource & { width: number; height: number } | undefined;
      if (!tex || !img?.width) continue;
      const cv = document.createElement('canvas');
      cv.width = img.width; cv.height = img.height;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      if (!ctx) continue;
      try { ctx.drawImage(img, 0, 0); } catch { continue; }
      const data = ctx.getImageData(0, 0, cv.width, cv.height);
      const px = data.data;
      for (let i = 0; i < px.length; i += 4) {
        const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255;
        const hi = Math.max(r, g, b), lo = Math.min(r, g, b), lum = (r + g + b) / 3;
        if (hi <= 0 || (hi - lo) / hi > 0.2 || lum < 0.45) continue; // not the pale concrete
        const k = (i / 4) | 0, x = k % cv.width, y = (k / cv.width) | 0;
        const n = patch(x, y), shade = 0.7 + 0.45 * (lum - 0.7);
        const t1 = Math.min(1, Math.max(0, (n - 0.25) / 0.2)), t2 = Math.min(1, Math.max(0, (n - 0.55) / 0.2));
        for (let c = 0; c < 3; c++) {
          const base = SAND[c] + (GRASS[c] - SAND[c]) * t1 + (MOSS[c] - GRASS[c]) * t2;
          px[i + c] = Math.round(Math.min(1, base * shade) * 255);
        }
      }
      ctx.putImageData(data, 0, 0);
      const out = new THREE.CanvasTexture(cv);
      out.flipY = tex.flipY; out.colorSpace = tex.colorSpace; out.wrapS = tex.wrapS; out.wrapT = tex.wrapT;
      out.channel = tex.channel; out.anisotropy = tex.anisotropy;
      mat.map = out;
      mat.needsUpdate = true;
    }
  });
}
