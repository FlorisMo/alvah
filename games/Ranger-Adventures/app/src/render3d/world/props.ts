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
