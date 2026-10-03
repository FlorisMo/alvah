/**
 * portrait.ts — the veldgids's pictures (run 7, design §7.1): each discovery's REAL model,
 * drawn once into a small picture through the game's own renderer, lit like a calm golden
 * hour, and the same shape as a flat grey silhouette for what he has not found yet.
 *
 * Kept in memory only (data URLs, per page load), never in the save. Each picture is one
 * small render inside a frame of the world, before the world's own render (the way a
 * camera trap's photo is taken, World.snapshot): the canvas never shows it, and the frame
 * the player sees is the world's as always. The model is the world's own (play/spawn: the
 * same dressing, coat and calm pose), framed from the side a little in front (the shape a
 * child knows an animal by), with an orthographic lens so a small picture has no warp.
 * Best-effort: no world or no model resolves null and the gids keeps its drawn icon.
 */

import * as THREE from 'three';
import { spawnModel } from '../../render3d/play/spawn';
import { fawnSpots } from '../../render3d/play/pose';
import { renderedBox } from '../../render3d/Models';
import { session } from '../flow/session';

/** The picture's size (CSS px; drawn at the renderer's pixel ratio). */
export const PORTRAIT_W = 176;
export const PORTRAIT_H = 120;
/** The paper behind a picture (the gids tile's own colour, so the picture has no edge). */
export const PORTRAIT_BG = '#f8f1e2';
/** The silhouette: a soft warm grey on that paper. */
const SHADOW = '#c4b8a3';

export interface Portrait { found: string; shadow: string }

const cache = new Map<string, Promise<Portrait | null>>();
const done = new Map<string, Portrait>();

/** The picture of a model now, when it is already made (no wait). */
export function portraitNow(model: string): Portrait | null {
  return done.get(model) ?? null;
}

/** The picture of a model (made once per page load). */
export function portrait(model: string): Promise<Portrait | null> {
  let p = cache.get(model);
  if (!p) {
    p = make(model).then((pic) => { if (pic) done.set(model, pic); else cache.delete(model); return pic; });
    cache.set(model, p);
  }
  return p;
}

/* ------------------------------------------------------------- the studio ---- */

/** The silhouette's flat paint (one, shared: never disposed). */
let flatPaint: THREE.MeshBasicMaterial | null = null;

/** A small lit scene for ONE picture (pictures are made side by side, each in its own):
 *  a warm low key light from the front left, a soft cool fill, a sky-and-earth fill, the
 *  paper behind. */
function studio(): { scene: THREE.Scene; cam: THREE.OrthographicCamera; flat: THREE.MeshBasicMaterial } {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PORTRAIT_BG);
  scene.add(new THREE.HemisphereLight('#fff3dc', '#8a6c48', 1.5));
  const key = new THREE.DirectionalLight('#ffe0ad', 2.4);
  key.name = 'key';
  const fill = new THREE.DirectionalLight('#d9e4ff', 0.55);
  fill.name = 'fill';
  scene.add(key, key.target, fill, fill.target);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 60);
  flatPaint ??= new THREE.MeshBasicMaterial({ color: SHADOW, toneMapped: false });
  return { scene, cam, flat: flatPaint };
}

/** From the side, a little in front, a little above: the shape a child knows it by. */
const VIEW_AZIMUTH = THREE.MathUtils.degToRad(62);
const VIEW_ELEVATION = THREE.MathUtils.degToRad(11);
/** Room round the shape in the picture (share of its size). */
const MARGIN = 0.07;

/** A young one's own coat on its parent's model, as the world dresses it (adventure/actors
 *  DRESS): a row whose picture is a content animal id gets it ('reekalf': the roe calf's
 *  white spots; ree-discover, additive). */
const YOUNG: Readonly<Record<string, (root: THREE.Object3D) => () => void>> = { reekalf: fawnSpots };

async function make(model: string): Promise<Portrait | null> {
  const world = session.world;
  const renderer = session.stage?.renderer;
  if (!world || !renderer) return null;
  const sp = await spawnModel(model, { height: 1 });
  if (!sp) return null;
  const { scene, cam, flat } = studio();
  const root = sp.root as THREE.Object3D;
  const undress = YOUNG[model]?.(root);
  scene.add(root);
  try {
    frame(root, cam, scene);
    // compile its shaders off the frame where the GPU allows (never a hitch as a page opens)
    await renderer.compileAsync(scene, cam).catch(() => {});
    return await inWorldFrame(() => shoot(renderer, scene, cam, flat));
  } finally {
    scene.remove(root);
    undress?.();
    sp.dispose();
  }
}

/** Aim the lens and the lights at the model and fit it into the picture. */
function frame(root: THREE.Object3D, cam: THREE.OrthographicCamera, scene: THREE.Scene): void {
  const box = renderedBox(root);
  const c = box.getCenter(new THREE.Vector3());
  const dir = new THREE.Vector3(Math.sin(VIEW_AZIMUTH) * Math.cos(VIEW_ELEVATION), Math.sin(VIEW_ELEVATION), Math.cos(VIEW_AZIMUTH) * Math.cos(VIEW_ELEVATION));
  const size = box.getSize(new THREE.Vector3()).length();
  cam.position.copy(c).addScaledVector(dir, size * 3 + 1);
  cam.lookAt(c);
  cam.updateMatrixWorld(true);
  // the shape's extent as the lens sees it
  const inv = cam.matrixWorldInverse;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const v = new THREE.Vector3();
  for (let i = 0; i < 8; i++) {
    v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).applyMatrix4(inv);
    x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
  }
  let w = (x1 - x0) * (1 + MARGIN * 2), h = (y1 - y0) * (1 + MARGIN * 2);
  const aspect = PORTRAIT_W / PORTRAIT_H;
  if (w / h > aspect) h = w / aspect; else w = h * aspect;
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  cam.left = mx - w / 2; cam.right = mx + w / 2; cam.top = my + h / 2; cam.bottom = my - h / 2;
  cam.near = 0.05; cam.far = size * 6 + 2;
  cam.updateProjectionMatrix();
  // the key from the front left and above (as the lens sees it), the fill from the right
  const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
  const key = scene.getObjectByName('key') as THREE.DirectionalLight;
  const fill = scene.getObjectByName('fill') as THREE.DirectionalLight;
  key.position.copy(c).addScaledVector(dir, 2).addScaledVector(right, -1.6).addScaledVector(up, 2.2);
  key.target.position.copy(c);
  fill.position.copy(c).addScaledVector(dir, 1).addScaledVector(right, 2.2).addScaledVector(up, 0.4);
  fill.target.position.copy(c);
  key.target.updateMatrixWorld(); fill.target.updateMatrixWorld();
}

/** Run `job` inside the next world frame, before the world's own render (or null after
 *  a few seconds without one: the loop is stopped). */
function inWorldFrame<T>(job: () => T): Promise<T | null> {
  const world = session.world;
  if (!world) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const off = world.onFrame(() => {
      if (settled) return;
      settled = true;
      off();
      try { resolve(job()); } catch { resolve(null); }
    });
    window.setTimeout(() => { if (!settled) { settled = true; off(); resolve(null); } }, 4000);
  });
}

/** Draw the picture and its silhouette in the corner of the canvas and copy them out. */
function shoot(r: THREE.WebGLRenderer, scene: THREE.Scene, cam: THREE.Camera, flat: THREE.Material): Portrait | null {
  const pr = r.getPixelRatio();
  const bufH = r.domElement.height;
  const W = Math.round(PORTRAIT_W * pr), H = Math.round(PORTRAIT_H * pr);
  const vp = r.getViewport(new THREE.Vector4());
  const sc = r.getScissor(new THREE.Vector4());
  const scOn = r.getScissorTest();
  const target = r.getRenderTarget();
  const grab = (): string => {
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    out.getContext('2d')?.drawImage(r.domElement, 0, bufH - H, W, H, 0, 0, W, H);
    return out.toDataURL('image/png');
  };
  try {
    r.setRenderTarget(null);
    r.setViewport(0, 0, PORTRAIT_W, PORTRAIT_H);
    r.setScissor(0, 0, PORTRAIT_W, PORTRAIT_H);
    r.setScissorTest(true);
    r.render(scene, cam);
    const found = grab();
    scene.overrideMaterial = flat;
    r.render(scene, cam);
    const shadow = grab();
    return { found, shadow };
  } finally {
    scene.overrideMaterial = null;
    r.setViewport(vp);
    r.setScissor(sc);
    r.setScissorTest(scOn);
    r.setRenderTarget(target);
  }
}
