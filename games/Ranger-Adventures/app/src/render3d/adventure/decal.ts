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

/**
 * A strip `half` m either side of a line on the ground (a trodden game path, a
 * "wissel"): draped vertex by vertex over `groundY` like the ellipse, its edges gently
 * irregular (`wobble`), its sides and both ends fading into the ground (vertex alpha),
 * a faint mottle along it so it reads as worn sand, not a painted stripe. One mesh.
 */
export function groundStrip(groundY: (x: number, z: number) => number, line: readonly { x: number; z: number }[],
  half: number, color: THREE.ColorRepresentation, o: DecalOpts & { ends?: number } = {}): THREE.Mesh {
  const layer = o.layer ?? 1, wob = o.wobble ?? 0.2, seed = o.seed ?? 1, ends = o.ends ?? 0.7;
  // the line, measured
  const acc = [0];
  for (let i = 1; i < line.length; i++) acc.push(acc[i - 1] + Math.hypot(line[i].x - line[i - 1].x, line[i].z - line[i - 1].z));
  const L = acc[acc.length - 1] || 1;
  const at = (s: number): { x: number; z: number; dx: number; dz: number } => {
    let i = 1;
    while (i < line.length - 1 && acc[i] < s) i++;
    const a = line[i - 1], b = line[i];
    const seg = acc[i] - acc[i - 1] || 1;
    const k = Math.min(1, Math.max(0, (s - acc[i - 1]) / seg));
    return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, dx: (b.x - a.x) / seg, dz: (b.z - a.z) / seg };
  };
  // across: the sides fade, the middle is worn barest
  const ACROSS = [-1, -0.62, -0.28, 0, 0.28, 0.62, 1];
  const SIDE_A = [0, 0.8, 1, 1, 1, 0.8, 0];
  const rows = Math.max(2, Math.ceil(L / 0.14));
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const base = new THREE.Color(color);
  const ramp = (u: number): number => { const t = Math.min(1, Math.max(0, u)); return t * t * (3 - 2 * t); };
  for (let r = 0; r <= rows; r++) {
    const s = (r / rows) * L;
    const p = at(s);
    const nx = -p.dz, nz = p.dx; // the line's left
    const endA = ramp(s / ends) * ramp((L - s) / ends);
    const left = half * (1 + wob * (Math.sin(s * 2.1 + seed) * 0.6 + Math.cos(s * 3.7 + seed * 2) * 0.4));
    const right = half * (1 + wob * (Math.sin(s * 2.7 + seed * 3) * 0.6 + Math.cos(s * 4.3 + seed) * 0.4));
    const mottle = 1 + 0.06 * Math.sin(s * 5.3 + seed) * Math.cos(s * 2.2 + seed * 1.7);
    ACROSS.forEach((k, c) => {
      const w = k < 0 ? left * k : right * k;
      const x = p.x + nx * w, z = p.z + nz * w;
      pos.push(x, groundY(x, z) + 0.02 + layer * 0.012, z);
      const lit = mottle * (1 + 0.05 * (1 - Math.abs(k)));
      // (worn patchy: a little more ground shows through here and there)
      const patch = 0.82 + 0.18 * (0.5 + 0.5 * Math.sin(s * 3.1 + k * 2.3 + seed * 5) * Math.cos(s * 1.3 - k + seed));
      col.push(base.r * lit, base.g * lit, base.b * lit, (o.feather === false ? 1 : SIDE_A[c]) * endA * patch);
    });
  }
  const C = ACROSS.length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < C - 1; c++) {
      const a = r * C + c, b = (r + 1) * C + c;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mid = Math.floor(C / 2);
  if ((geo.attributes.normal as THREE.BufferAttribute).getY(mid) < 0) { geo.setIndex(idx.slice().reverse()); geo.computeVertexNormals(); }
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, transparent: true, depthWrite: false, roughness: o.roughness ?? 1, metalness: o.metalness ?? 0,
    polygonOffset: true, polygonOffsetFactor: -2 * layer, polygonOffsetUnits: -2 * layer,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = layer;
  mesh.receiveShadow = true;
  return mesh;
}
