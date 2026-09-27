/**
 * pose.ts — an animal that LIES in the grass (child:B13, breaker:B7).
 *
 * The words say "the fawn lies still", "Laat hem liggen", "he presses himself flat",
 * but the world's animals only stand (the piglet is a static mesh, the roe deer has
 * graze/walk/idle clips and no lying clip). `lieDown` gives a spawned animal a lying
 * pose without any new asset: it bakes the model in its current pose and folds the
 * legs under the body — every vertex below the belly line is pressed down toward the
 * ground, everything above it drops by the same amount. The soles stay ON the ground
 * (the model is not sunk into it), the back and the raised head stay as they were,
 * so it reads as an animal lying with its legs tucked under, head up.
 *
 * `fawnSpots` gives the roe deer's calf its white spots, so a "reekalf" is not a small
 * copy of the adult doe. Both are one-time geometry edits on the spawn's own copies
 * (never the cached GLB); each returns what it made, for the caller to free.
 */

import * as THREE from 'three';

/** Belly line per animal, as a share of its standing height (legs below it) — measured
 *  on the world's models: the piglet's body starts at ~40 % of its height, the roe
 *  deer's at ~50 % (a vertex-height histogram, 2026-09-27). */
export const LEG_SHARE: Record<string, number> = { frisling: 0.42, big: 0.42, reekalf: 0.5, ree: 0.5 };
/** How much of the leg length stays visible once folded under the body. */
const KEEP = 0.16;

/** Pure: how tall an animal of standing height `h` is once it lies down. */
export function lyingHeight(h: number, legShare: number, keep = KEEP): number {
  return h - h * legShare * (1 - keep);
}

/** Pure: a height above the soles in the lying pose. The legs [0, legTop] fold to
 *  [0, legTop·keep]; everything above drops by legTop·(1−keep) (continuous at legTop). */
export function lieY(y: number, legTop: number, keep = KEEP): number {
  return y <= legTop ? y * keep : y - legTop * (1 - keep);
}

/** Every mesh under `root`, with its posed vertex positions in `root` space. */
function posedMeshes(root: THREE.Object3D): { mesh: THREE.Mesh; toRoot: THREE.Matrix4; pts: THREE.Vector3[] }[] {
  root.updateMatrixWorld(true);
  const rootInv = root.matrixWorld.clone().invert();
  const out: { mesh: THREE.Mesh; toRoot: THREE.Matrix4; pts: THREE.Vector3[] }[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.hitSphere || !mesh.geometry?.attributes?.position) return;
    const toRoot = rootInv.clone().multiply(mesh.matrixWorld);
    const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
    const skinned = (mesh as THREE.SkinnedMesh).isSkinnedMesh ? (mesh as THREE.SkinnedMesh) : null;
    skinned?.skeleton?.update();
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i);
      if (skinned) skinned.applyBoneTransform(i, v);
      pts.push(v.applyMatrix4(toRoot));
    }
    out.push({ mesh, toRoot, pts });
  });
  return out;
}

/**
 * Lay a spawned animal down (see the file note). `root` is the spawn's root (soles at
 * its y=0); `legShare` the belly line as a share of its height. A skinned model is
 * baked into a still mesh in its current pose (spawn it with `idle: false`). Returns
 * a disposer for the geometry it created.
 */
export function lieDown(root: THREE.Object3D, legShare: number, keep = KEEP): () => void {
  const meshes = posedMeshes(root);
  let minY = Infinity, maxY = -Infinity;
  for (const m of meshes) for (const p of m.pts) { minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  if (!Number.isFinite(minY) || maxY - minY < 1e-3) return () => {};
  const legTop = (maxY - minY) * legShare;
  const made: THREE.BufferGeometry[] = [];
  for (const { mesh, toRoot, pts } of meshes) {
    const fromRoot = toRoot.clone().invert();
    const geo = mesh.geometry.clone();
    geo.deleteAttribute('skinIndex');
    geo.deleteAttribute('skinWeight');
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < pts.length; i++) {
      v.copy(pts[i]);
      v.y = minY + lieY(v.y - minY, legTop, keep);
      v.applyMatrix4(fromRoot);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true;
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    made.push(geo);
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
      // a skinned mesh would re-apply its bones to the baked shape: swap in a still mesh
      const still = new THREE.Mesh(geo, mesh.material);
      still.name = mesh.name;
      still.position.copy(mesh.position);
      still.quaternion.copy(mesh.quaternion);
      still.scale.copy(mesh.scale);
      still.castShadow = mesh.castShadow;
      still.receiveShadow = mesh.receiveShadow;
      still.renderOrder = mesh.renderOrder;
      mesh.parent?.add(still);
      mesh.removeFromParent();
    } else {
      mesh.geometry = geo;
    }
  }
  root.userData.lying = true;
  return () => { for (const g of made) g.dispose(); };
}

/** Pure: is this spot (cell coordinates) one of the fawn's spots? A calm, even scatter. */
export function isSpot(cx: number, cz: number): boolean {
  const h = Math.sin(cx * 127.1 + cz * 311.7) * 43758.5453;
  return h - Math.floor(h) < 0.3;
}

/**
 * The fawn's white spots on its back and flanks. The world's deer carry their flat
 * colours per vertex (merge.ts joins the colour splits into one mesh), so a spot is a
 * cream vertex colour on the coat; a model that still colours by material gets a
 * vertex-colour multiplier on its own material copy instead. The model faces +z; the
 * head, neck, belly and legs stay plain. A lying (baked) fawn is coloured in place; a
 * standing one first gets its own copy of the geometry (skinning kept), so the cached
 * GLB is never touched. Returns a disposer for what it made.
 */
export function fawnSpots(root: THREE.Object3D): () => void {
  const copies: THREE.BufferGeometry[] = [];
  if (!root.userData.lying) {
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || mesh.userData.hitSphere) return;
      mesh.geometry = mesh.geometry.clone();
      copies.push(mesh.geometry);
    });
  }
  const meshes = posedMeshes(root);
  let min = new THREE.Vector3(Infinity, Infinity, Infinity), max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (const m of meshes) for (const p of m.pts) { min = min.min(p); max = max.max(p); }
  if (!Number.isFinite(min.y)) return () => {};
  const H = max.y - min.y, L = max.z - min.z;
  const cell = Math.max(0.03, H * 0.11); // spot size: ~4.5 cm on a 0.4 m tall lying fawn
  const cream = new THREE.Color('#f3e6c8');
  const lum = (c: THREE.Color): number => c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
  const onBack = (p: THREE.Vector3): boolean =>
    p.y > min.y + H * 0.45 && p.y < min.y + H * 0.8 && p.z > min.z + L * 0.12 && p.z < min.z + L * 0.62
    && isSpot(Math.floor(p.x / cell), Math.floor(p.z / cell) + Math.floor(p.y / cell) * 7);
  const made: THREE.Material[] = [];
  const c = new THREE.Color();
  for (const { mesh, pts } of meshes) {
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (Array.isArray(mesh.material) || !mat?.isMeshStandardMaterial || /eye/i.test(`${mat.name} ${mesh.name}`)) continue;
    const colors = mesh.geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
    if (colors && mat.vertexColors) {
      // the coat is the mid-brown: never the pale belly, the dark nose or the hooves
      pts.forEach((p, i) => {
        c.fromBufferAttribute(colors, i).multiply(mat.color);
        const l = lum(c);
        if (l > 0.05 && l < 0.4 && onBack(p)) colors.setXYZ(i, cream.r, cream.g, cream.b);
      });
      colors.needsUpdate = true;
      continue;
    }
    const l = lum(mat.color);
    if (l > 0.4 || l < 0.05) continue;
    const lift = [cream.r / Math.max(mat.color.r, 0.02), cream.g / Math.max(mat.color.g, 0.02), cream.b / Math.max(mat.color.b, 0.02)];
    const col = new Float32Array(pts.length * 3);
    pts.forEach((p, i) => col.set(onBack(p) ? lift : [1, 1, 1], i * 3));
    mesh.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const own = mat.clone();
    own.vertexColors = true;
    mesh.material = own;
    made.push(own);
  }
  return () => { for (const m of made) m.dispose(); for (const g of copies) g.dispose(); };
}
