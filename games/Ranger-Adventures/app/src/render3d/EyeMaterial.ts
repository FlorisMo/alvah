/**
 * EyeMaterial.ts — the THREE-touching half of the eye system (the pure spec + maths
 * live in Eyes.ts). Builds the clearcoat-cornea material over a canvas iris texture
 * and applies it best-effort to a loaded model's eye meshes, wiring iris parallax.
 * Like Models.ts, every call is best-effort: a model with no recognisable eye mesh
 * is left untouched (0 eyes dressed) and never throws — the game stays playable.
 */

import * as THREE from 'three';
import { eyeSpecFor, eyeshineAt, irisParallax, pupilRadii, type EyeSpec } from './Eyes';

/**
 * Draw iris+pupil+catchlight to a small canvas texture. Robust + identical on every
 * GPU (no GLSL to mis-compile). The pupil ellipse is scaled per shape; the
 * catchlight is a soft white dot in the upper quadrant (catchlight.v>0.5 ⇒ top).
 */
export function makeIrisTexture(spec: EyeSpec): THREE.CanvasTexture {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  const cx = S / 2, cy = S / 2;

  // warm base so a uv shift never reveals a hard edge
  ctx.fillStyle = '#efe6d6';
  ctx.fillRect(0, 0, S, S);

  // iris: radial gradient from the spec colour out to a lighter rim
  const iris = ctx.createRadialGradient(cx, cy, S * 0.06, cx, cy, S * 0.44);
  const base = new THREE.Color(spec.irisColor);
  const rim = base.clone().lerp(new THREE.Color('#ffffff'), 0.35);
  iris.addColorStop(0, '#' + base.getHexString());
  iris.addColorStop(1, '#' + rim.getHexString());
  ctx.fillStyle = iris;
  ctx.beginPath();
  ctx.arc(cx, cy, S * 0.44, 0, Math.PI * 2);
  ctx.fill();

  // pupil: an ellipse scaled by shape (round / vertical-slit / horizontal-bar)
  const { rx, ry } = pupilRadii(spec.pupilShape, S * 0.22);
  ctx.fillStyle = '#0a0a0a';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  // catchlight: a soft white dot in the upper quadrant (uv v from the bottom)
  const lx = spec.catchlight.u * S;
  const ly = (1 - spec.catchlight.v) * S; // v>0.5 → near the top
  const lr = spec.catchlight.size * S;
  const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
  glow.addColorStop(0, 'rgba(255,255,255,0.95)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(lx, ly, lr, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; // parallax shift clamps cleanly
  return tex;
}

/** Build the eye material: a clearcoat cornea over the iris texture + gated eyeshine. */
export function buildEyeMaterial(spec: EyeSpec, opts: { dusk?: boolean } = {}): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    map: makeIrisTexture(spec),
    roughness: 0.12,            // wet
    metalness: 0,
    clearcoat: 1,               // the cornea
    clearcoatRoughness: spec.clearcoatRoughness,
    emissive: new THREE.Color(spec.eyeshineColor),
    emissiveIntensity: eyeshineAt(spec, !!opts.dusk),
  });
  mat.userData.eyeSpec = spec;
  return mat;
}

const EYE_NAME = /eye|oog|iris|cornea|pupil/i;

/**
 * Find the eye meshes in a loaded model and give them the eye material, wiring a
 * frozen-or-live iris parallax via onBeforeRender. Returns the count of eyes
 * dressed (0 for a procedural totem — harmless).
 */
export function applyEyes(
  root: THREE.Object3D,
  id: string | null,
  opts: { dusk?: boolean; reducedMotion?: boolean } = {},
): number {
  const spec = eyeSpecFor(id);
  let n = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const matName = (mesh.material as THREE.Material | undefined)?.name ?? '';
    if (!EYE_NAME.test(mesh.name) && !EYE_NAME.test(matName)) return;

    const mat = buildEyeMaterial(spec, { dusk: opts.dusk });
    mesh.material = mat;
    n++;

    // one-mesh iris parallax: shift the iris uv opposite the camera each frame
    // (frozen flat under reduced-motion). Cheap — a texture-offset write only.
    const tmp = new THREE.Vector3();
    mesh.onBeforeRender = (_r, _s, camera) => {
      const depth = opts.reducedMotion ? 0 : spec.parallaxDepth;
      mesh.getWorldPosition(tmp);
      tmp.subVectors((camera as THREE.Camera).position, tmp).normalize();
      const off = irisParallax({ x: tmp.x, y: tmp.y }, depth);
      mat.map!.offset.set(off.u, off.v);
    };
  });
  return n;
}
