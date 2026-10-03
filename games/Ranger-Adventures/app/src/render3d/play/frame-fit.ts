/**
 * frame-fit.ts — where the lens stands to frame a patch of ground (run 7): the pure half
 * of `Stage.fitAt` (stage.ts), so a home's places test can compute the very lens a framed
 * beat will take (and where its hiding place lands on a 1280×800 screen) without a scene,
 * a canvas or a world. Stage calls this; nothing here touches the DOM.
 *
 * The lens keeps a fixed pitch and FOV and backs off along its heading until the patch
 * box (its ground corners and the tallest form over them) and everything it must include
 * (the ranger in a lower corner) fit the free band between the card insets, re-centring
 * the aim up or down; it never stands under the ground at its own spot.
 */

import * as THREE from 'three';
import { safeCamHeight } from './kit-math.ts';

export interface FitSpec {
  halfW: number;
  halfD: number;
  tall: number;
  pitchDeg: number;
  insetTop: number;
  insetBottom: number;
  /** things that must be in the picture too: their feet and their tops */
  include?: readonly { x: number; z: number; h: number }[];
}

/**
 * The lens pose that frames a patch centred at P0 (x, z), laid along unit heading `f`
 * (x, z), on a W×H screen with a lens of `fovDeg` (vertical). `groundY` is the rendered
 * ground. Returns the patch centre on the ground, the lens and its aim point.
 */
export function fitFrame(
  P0: { x: number; z: number }, f: { x: number; z: number }, spec: FitSpec,
  groundY: (x: number, z: number) => number, fovDeg: number, W: number, H: number,
): { P: THREE.Vector3; cam: THREE.Vector3; look: THREE.Vector3 } {
  const V = (x = 0, y = 0, z = 0): THREE.Vector3 => new THREE.Vector3(x, y, z);
  const { halfW, halfD, tall, pitchDeg, insetTop, insetBottom } = spec;
  const fw = V(f.x, 0, f.z);
  const yTop = 1 - (2 * (insetTop + 12)) / H;
  const yBot = -1 + (2 * (insetBottom + 12)) / H;
  const xLim = 1 - 24 / W * 2;
  const P = V(P0.x, 0, P0.z);
  P.y = groundY(P.x, P.z);
  const right = V(-fw.z, 0, fw.x);
  // the patch box: its ground corners + the tallest form over the front/back rows
  const pts: THREE.Vector3[] = [];
  for (const u of [-halfW, 0, halfW]) {
    for (const v of [-halfD, halfD]) {
      const g = P.clone().addScaledVector(right, u).addScaledVector(fw, v);
      g.y = groundY(g.x, g.z);
      pts.push(g, g.clone().setY(g.y + tall));
    }
  }
  const include: THREE.Vector3[] = [];
  for (const t of spec.include ?? []) { // (run 6) what must be in the picture too
    const g = V(t.x, groundY(t.x, t.z), t.z);
    pts.push(g, g.clone().setY(g.y + t.h));
    include.push(g.clone().setY(g.y + t.h * 0.5));
  }
  const tmp = new THREE.PerspectiveCamera(fovDeg, W / H, 0.1, 400);
  const pitch = (pitchDeg * Math.PI) / 180;
  const dir = fw.clone().multiplyScalar(Math.cos(pitch)).setY(-Math.sin(pitch)); // lens → aim
  const ndc = V();
  let bestFit: { cam: THREE.Vector3; look: THREE.Vector3 } | null = null;
  for (let dist = 3; dist <= 16 && !bestFit; dist += 0.2) {
    // slide the aim point up/down so the box sits centred in the free band
    let lift = tall * 0.35;
    for (let k = 0; k < 4; k++) {
      const look = P.clone().setY(P.y + lift);
      tmp.position.copy(look).addScaledVector(dir, -dist);
      // (run 6) the ranger it must show stands well in FRONT of the lens, never under it
      if (include.some((q) => q.clone().sub(tmp.position).dot(dir) < 1.6)) break;
      tmp.up.set(0, 1, 0);
      tmp.lookAt(look);
      tmp.updateMatrixWorld(true);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of pts) {
        ndc.copy(p).project(tmp);
        minX = Math.min(minX, ndc.x); maxX = Math.max(maxX, ndc.x);
        minY = Math.min(minY, ndc.y); maxY = Math.max(maxY, ndc.y);
      }
      if (minX >= -xLim && maxX <= xLim && minY >= yBot && maxY <= yTop) {
        bestFit = { cam: tmp.position.clone(), look };
        break;
      }
      // re-centre vertically: shift the aim by the band-centre error (in metres at the patch)
      const err = (minY + maxY) / 2 - (yTop + yBot) / 2;
      const mPerNdc = dist * Math.tan((fovDeg * Math.PI) / 360);
      lift += err * mPerNdc;
    }
  }
  if (!bestFit) {
    const look = P.clone().setY(P.y + tall * 0.35);
    bestFit = { cam: look.clone().addScaledVector(dir, -16), look };
  }
  // never under (or skimming) the rendered ground at the lens's own spot
  bestFit.cam.y = safeCamHeight(bestFit.cam.y, groundY(bestFit.cam.x, bestFit.cam.z), 1.4);
  return { P, cam: bestFit.cam, look: bestFit.look };
}

/** Where a world point lands on a W×H screen seen by a lens at `cam` aimed at `look`
 *  (px from the top-left; `ahead`: in front of the lens). */
export function screenOf(p: { x: number; y: number; z: number }, cam: { x: number; y: number; z: number },
  look: { x: number; y: number; z: number }, fovDeg: number, W: number, H: number): { x: number; y: number; ahead: boolean } {
  const tmp = new THREE.PerspectiveCamera(fovDeg, W / H, 0.1, 400);
  tmp.position.set(cam.x, cam.y, cam.z);
  tmp.up.set(0, 1, 0);
  tmp.lookAt(look.x, look.y, look.z);
  tmp.updateMatrixWorld(true);
  const v = new THREE.Vector3(p.x, p.y, p.z);
  const ahead = v.clone().applyMatrix4(tmp.matrixWorldInverse).z < 0;
  v.project(tmp);
  return { x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * H, ahead };
}
