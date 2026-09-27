/**
 * play/merge.ts — one draw call per animal, not one per colour.
 *
 * The world's rigged animals (edelhert, ree, vos, wolf) come as one skinned mesh split
 * into 4-7 primitives, one per flat colour (coat, belly, hooves, nose …), so ONE stag
 * cost six draw calls and a finished bos full of families broke the < 150 budget.
 * Every colour is a plain `MeshStandardMaterial` with the same roughness and
 * metalness, so the split buys nothing: `mergeColourSplits` joins such siblings into
 * ONE mesh that carries its colours per vertex, drawn by one material — it looks the
 * same and costs one call. The eyes (EyeMaterial's own shader), a textured material,
 * a transparent one or anything else unusual is left exactly as it was.
 *
 * Run it on a DRESSED model (after applyEyes / applyCoat, which pick materials by
 * name). The merged geometry is cached per source, so every clone of a model shares
 * it (and it lives as long as the cached GLB it came from: never dispose it).
 */

import * as THREE from 'three';

const MAPS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap',
  'lightMap', 'bumpMap', 'displacementMap', 'envMap'] as const;

/** A mesh this may merge: one plain, opaque, untextured standard material, no
 *  morphs, no per-frame hook (the eyes have one). Vertex colours of its own are fine:
 *  they are multiplied into the merged colour. */
function plain(o: THREE.Object3D): o is THREE.Mesh {
  const mesh = o as THREE.Mesh;
  if (!mesh.isMesh || Array.isArray(mesh.material) || !mesh.visible) return false;
  const m = mesh.material as THREE.MeshStandardMaterial;
  if (m.type !== 'MeshStandardMaterial' || m.transparent || m.opacity !== 1) return false;
  if (MAPS.some((k) => m[k])) return false;
  const g = mesh.geometry;
  if (Object.keys(g.morphAttributes).length || g.groups.length > 1) return false;
  return mesh.onBeforeRender === THREE.Object3D.prototype.onBeforeRender;
}

/** Siblings merge only when nothing but their colour tells them apart. */
function keyOf(mesh: THREE.Mesh): string {
  const m = mesh.material as THREE.MeshStandardMaterial;
  const g = mesh.geometry;
  const sk = mesh as THREE.SkinnedMesh;
  const attrs = Object.keys(g.attributes).sort().map((n) => `${n}${g.attributes[n].itemSize}`).join(',');
  return [
    sk.isSkinnedMesh ? `skin:${sk.skeleton.bones.map((b) => b.uuid).join('.')}:${sk.bindMatrix.elements.join(',')}:${sk.bindMode}` : 'static',
    mesh.matrix.elements.join(','),
    m.roughness, m.metalness, m.emissive.getHex(), m.emissiveIntensity, m.side, m.flatShading, m.wireframe,
    m.fog, m.depthWrite, m.depthTest, m.alphaTest, m.envMapIntensity,
    mesh.castShadow, mesh.receiveShadow, mesh.renderOrder, mesh.frustumCulled, mesh.layers.mask,
    attrs, g.index ? 'i' : 'n',
  ].join('|');
}

/** Merged geometry per set of (source geometry, colour): shared by every clone. */
const cache = new Map<string, THREE.BufferGeometry>();

function mergedGeometry(list: THREE.Mesh[]): THREE.BufferGeometry {
  const key = list.map((m) => {
    const mat = m.material as THREE.MeshStandardMaterial;
    const c = mat.color;
    return `${m.geometry.uuid}:${c.r.toFixed(5)},${c.g.toFixed(5)},${c.b.toFixed(5)}:${mat.vertexColors}`;
  }).join(';');
  const hit = cache.get(key);
  if (hit) return hit;
  const geos = list.map((m) => m.geometry);
  const total = geos.reduce((n, g) => n + g.attributes.position.count, 0);
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(geos[0].attributes)) {
    if (name === 'color') continue; // baked below, with the material colour
    const size = geos[0].attributes[name].itemSize;
    const arr = new Float32Array(total * size);
    let o = 0;
    for (const g of geos) {
      const a = g.attributes[name] as THREE.BufferAttribute; // getComponent reads interleaved + normalized alike
      for (let i = 0; i < a.count; i++) for (let k = 0; k < size; k++) arr[o++] = a.getComponent(i, k);
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  // the colour each primitive was drawn in, now per vertex: its material colour (linear,
  // like material.color) times its own vertex colour when its material used one
  const cs = geos[0].attributes.color?.itemSize === 4 ? 4 : 3;
  const col = new Float32Array(total * cs);
  let v = 0;
  list.forEach((m, j) => {
    const mat = m.material as THREE.MeshStandardMaterial;
    const c = mat.color;
    const own = mat.vertexColors ? geos[j].attributes.color : undefined;
    for (let i = 0; i < geos[j].attributes.position.count; i++) {
      col[v++] = c.r * (own ? own.getComponent(i, 0) : 1);
      col[v++] = c.g * (own ? own.getComponent(i, 1) : 1);
      col[v++] = c.b * (own ? own.getComponent(i, 2) : 1);
      if (cs === 4) col[v++] = own && own.itemSize === 4 ? own.getComponent(i, 3) : 1;
    }
  });
  out.setAttribute('color', new THREE.BufferAttribute(col, cs));
  if (geos[0].index) {
    const idx: number[] = [];
    let base = 0;
    for (const g of geos) {
      const ix = g.index!;
      for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + base);
      base += g.attributes.position.count;
    }
    out.setIndex(idx); // three picks Uint16/Uint32 by the largest index
  }
  cache.set(key, out);
  return out;
}

/**
 * Join every set of colour-only sibling primitives under `root` into one mesh with
 * vertex colours. Returns how many draw calls it saved (0 = left untouched).
 */
export function mergeColourSplits(root: THREE.Object3D): number {
  const parents = new Set<THREE.Object3D>();
  root.updateMatrixWorld(true);
  root.traverse((o) => { if (o.parent && plain(o)) parents.add(o.parent); });
  let saved = 0;
  for (const parent of parents) {
    const buckets = new Map<string, THREE.Mesh[]>();
    for (const c of parent.children) {
      if (!plain(c)) continue;
      const k = keyOf(c);
      buckets.set(k, [...(buckets.get(k) ?? []), c]);
    }
    for (const list of buckets.values()) {
      if (list.length < 2) continue;
      const first = list[0];
      const mat = (first.material as THREE.MeshStandardMaterial).clone();
      mat.color.setRGB(1, 1, 1);
      mat.vertexColors = true;
      const geo = mergedGeometry(list);
      const sk = first as THREE.SkinnedMesh;
      let mesh: THREE.Mesh;
      if (sk.isSkinnedMesh) {
        const s = new THREE.SkinnedMesh(geo, mat);
        s.bindMode = sk.bindMode;
        s.bind(sk.skeleton, sk.bindMatrix);
        mesh = s;
      } else {
        mesh = new THREE.Mesh(geo, mat);
      }
      mesh.name = first.name;
      mesh.position.copy(first.position);
      mesh.quaternion.copy(first.quaternion);
      mesh.scale.copy(first.scale);
      mesh.castShadow = first.castShadow;
      mesh.receiveShadow = first.receiveShadow;
      mesh.renderOrder = first.renderOrder;
      mesh.frustumCulled = first.frustumCulled;
      mesh.layers.mask = first.layers.mask;
      parent.add(mesh);
      for (const m of list) parent.remove(m); // (their geometry + materials stay the cached GLB's)
      saved += list.length - 1;
    }
  }
  return saved;
}
