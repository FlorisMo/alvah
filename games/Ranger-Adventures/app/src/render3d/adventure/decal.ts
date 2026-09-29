/**
 * decal.ts — soft-edged shapes laid ON the rendered ground (a wallow's mud, a patch of
 * bare sand): a polar mesh draped vertex by vertex over `groundY`, so it never cuts
 * into a slope or floats over a dip, with a gently irregular rim. The adventure homes'
 * twin of play/Stage.decal (which lays one on a game's patch).
 */

import * as THREE from 'three';

export interface DecalOpts {
  roughness?: number;
  /** stack order: a higher layer draws over a lower one without z-fighting */
  layer?: number;
  /** the rim's wobble (0 = an ellipse) */
  wobble?: number;
  seed?: number;
  metalness?: number;
  /** a soft fade to the ground at the rim (vertex alpha) */
  feather?: boolean;
}

/** An ellipse `rx` × `rz` (m) at (x, z), turned `yaw`, draped over the ground. */
export function groundDecal(groundY: (x: number, z: number) => number, x: number, z: number, rx: number, rz: number,
  yaw: number, color: THREE.ColorRepresentation, o: DecalOpts = {}): THREE.Mesh {
  const layer = o.layer ?? 1, wob = o.wobble ?? 0.1, seed = o.seed ?? 1;
  const RINGS = 6, SEGS = 36;
  const pos: number[] = [], alpha: number[] = [], idx: number[] = [];
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const at = (u: number, v: number): [number, number, number] => {
    const wx = x + u * c + v * s, wz = z - u * s + v * c;
    return [wx, groundY(wx, wz) + 0.02 + layer * 0.012, wz];
  };
  pos.push(...at(0, 0)); alpha.push(1);
  for (let r = 1; r <= RINGS; r++) {
    const k = r / RINGS;
    for (let i = 0; i < SEGS; i++) {
      const a = (i / SEGS) * Math.PI * 2;
      const w = 1 + (k > 0.6 ? wob * (Math.sin(a * 3 + seed) * 0.6 + Math.cos(a * 5 + seed * 2) * 0.4) * k : 0);
      pos.push(...at(Math.cos(a) * rx * k * w, Math.sin(a) * rz * k * w));
      alpha.push(o.feather ? Math.min(1, (1 - k) * 3.5) : 1);
    }
  }
  for (let i = 0; i < SEGS; i++) idx.push(0, 1 + i, 1 + ((i + 1) % SEGS));
  for (let r = 1; r < RINGS; r++) {
    const a0 = 1 + (r - 1) * SEGS, b0 = 1 + r * SEGS;
    for (let i = 0; i < SEGS; i++) {
      const i1 = (i + 1) % SEGS;
      idx.push(a0 + i, b0 + i, a0 + i1, a0 + i1, b0 + i, b0 + i1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const n = geo.attributes.normal as THREE.BufferAttribute;
  if (n.getY(0) < 0) { geo.setIndex(idx.slice().reverse()); geo.computeVertexNormals(); }
  let mat: THREE.MeshStandardMaterial;
  if (o.feather) {
    const col: number[] = [];
    const base = new THREE.Color(color);
    for (const a of alpha) col.push(base.r, base.g, base.b, a);
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    mat = new THREE.MeshStandardMaterial({
      vertexColors: true, transparent: true, depthWrite: false, roughness: o.roughness ?? 1, metalness: o.metalness ?? 0,
      polygonOffset: true, polygonOffsetFactor: -2 * layer, polygonOffsetUnits: -2 * layer,
    });
  } else {
    mat = new THREE.MeshStandardMaterial({
      color, roughness: o.roughness ?? 1, metalness: o.metalness ?? 0,
      polygonOffset: true, polygonOffsetFactor: -2 * layer, polygonOffsetUnits: -2 * layer,
    });
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = layer;
  mesh.receiveShadow = true;
  return mesh;
}
