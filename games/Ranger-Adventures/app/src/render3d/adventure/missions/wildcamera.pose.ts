/**
 * wildcamera.pose.ts — the man in the morning photo crouches by his snare (design
 * run6-missions §4.3 beat 5: "a calm grey man from the side setting a snare"). His model
 * is rigged but has no crouch clip, so the pose is set on his bones once, when he is
 * built: each bone turns about the body's own side-to-side axis (its x: the model faces
 * +z, his left is +x), parents first, so the turns add up down the chain.
 */

import * as THREE from 'three';

/** How far each bone turns, in the body's frame (rad): `pitch` about the side axis
 *  (+ bends the top forward, − swings a leg forward), `roll` about the facing axis
 *  (+ tips it toward his right). Parents before children. */
export const CROUCH: readonly { bone: string; pitch: number; roll?: number }[] = [
  // the back bends over the snare, the head looks down at it
  { bone: 'Spine02', pitch: 0.34 },
  { bone: 'Spine01', pitch: 0.3 },
  { bone: 'Spine', pitch: 0.22 },
  { bone: 'neck', pitch: 0.12 },
  { bone: 'Head', pitch: 0.22 },
  // a deep squat: the thighs forward, the shins back, the feet flat on the ground
  { bone: 'LeftUpLeg', pitch: -1.55, roll: -0.12 },
  { bone: 'LeftLeg', pitch: 2.35 },
  { bone: 'LeftFoot', pitch: -0.8 },
  { bone: 'RightUpLeg', pitch: -1.3, roll: 0.12 },
  { bone: 'RightLeg', pitch: 2.05 },
  { bone: 'RightFoot', pitch: -0.75 },
  // the arms a little forward, by his knees (further, and the coat's hem lifts with them)
  { bone: 'LeftArm', pitch: -0.55 },
  { bone: 'LeftForeArm', pitch: -0.45 },
  { bone: 'RightArm', pitch: -0.7 },
  { bone: 'RightForeArm', pitch: -0.35 },
];

const X = new THREE.Vector3(1, 0, 0);
const Z = new THREE.Vector3(0, 0, 1);

/** Turn one bone by `dq` given in the ROOT's frame (the root stands unrotated at the
 *  origin while it is posed): local' = parent⁻¹ · dq · parent · local. */
function turn(b: THREE.Object3D, dq: THREE.Quaternion): void {
  const parent = b.parent;
  if (!parent) return;
  parent.updateWorldMatrix(true, false);
  const pq = parent.getWorldQuaternion(new THREE.Quaternion());
  const m = pq.clone().invert().multiply(dq).multiply(pq);
  b.quaternion.premultiply(m);
  b.updateMatrixWorld(true);
}

/**
 * Put the man into his crouch. Call it on his spawned root while it stands unrotated
 * at the origin. Returns how far he sinks (m): the root goes that much lower, so his
 * feet stay on the ground.
 */
export function crouchPose(root: THREE.Object3D): number {
  root.updateMatrixWorld(true);
  const ankles = (): number => {
    let y = Infinity;
    for (const n of ['LeftFoot', 'RightFoot']) {
      const b = root.getObjectByName(n);
      if (b) y = Math.min(y, b.getWorldPosition(new THREE.Vector3()).y);
    }
    return y;
  };
  const before = ankles();
  for (const c of CROUCH) {
    const b = root.getObjectByName(c.bone);
    if (!b) continue;
    const dq = new THREE.Quaternion().setFromAxisAngle(X, c.pitch);
    if (c.roll) dq.premultiply(new THREE.Quaternion().setFromAxisAngle(Z, c.roll));
    turn(b, dq);
  }
  root.updateMatrixWorld(true);
  const after = ankles();
  return Number.isFinite(before) && Number.isFinite(after) ? Math.max(0, after - before) : 0;
}
