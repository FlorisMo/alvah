/**
 * CalmPoseRig.ts — the THREE-touching half of the calm-pose set (the pure §B recipe +
 * never-scary gate live in CalmPose.ts). Applies a species' static calm rest-pose bias
 * onto a loaded animal by nudging its ear / tail / head bones (or named child objects)
 * into the §B calm shape, ONCE at load.
 *
 * Best-effort, like EyeMaterial.ts / FaceRig.ts: a model whose bones/objects carry none
 * of the matched names (a single-mesh Meshy animal today) is left completely untouched
 * and never throws — the game stays playable. The moment a rigged GLB with named
 * ear/tail/head bones is staged, this lights up with zero further wiring.
 *
 * Not motion: this is a one-time pose nudge, so reduced-motion does not apply (the
 * per-frame gait in ProceduralMotion is the motion path, and it has its own gate).
 */

import * as THREE from 'three';
import { calmPoseBones } from './CalmPose';

/**
 * Substrings that contain "ear" but are NOT an ear bone — common in quadruped/bird
 * rigs (rear legs, forearms). Without this guard the ear-tilt bias would wrongly
 * rotate a deer's rear leg the moment a rigged GLB is staged.
 */
const EAR_FALSE_POSITIVES = ['rear', 'forearm', 'gear', 'bear', 'spear', 'shear', 'wear', 'year'];

/** True if `name` matches the bone keyword, rejecting the "ear"-in-"rear" trap. */
function nameMatches(name: string, keyword: string): boolean {
  if (!name.includes(keyword)) return false;
  if (keyword === 'ear' && EAR_FALSE_POSITIVES.some((w) => name.includes(w))) return false;
  return true;
}

/**
 * Apply the calm rest-pose bias for `id` onto `root`. Matches each pose bone-bias
 * keyword (head/ear/tail) case-insensitively against bone + object names and ADDS the
 * gated Euler bias to their rest rotation. Returns the number of objects biased (0 if
 * the model has no matchable bones — the dormant-but-ready case). Never throws.
 */
export function applyCalmPose(root: THREE.Object3D, id: string | null | undefined): number {
  const biases = calmPoseBones(id);
  if (biases.length === 0) return 0;

  let dressed = 0;
  root.traverse((o) => {
    const name = (o.name || '').toLowerCase();
    if (!name) return;
    for (const b of biases) {
      if (!nameMatches(name, b.keyword)) continue;
      o.rotation.x += b.euler.x;
      o.rotation.y += b.euler.y;
      o.rotation.z += b.euler.z;
      dressed++;
      break; // one bias per object — don't stack head+ear onto a "headear" name
    }
  });
  return dressed;
}
