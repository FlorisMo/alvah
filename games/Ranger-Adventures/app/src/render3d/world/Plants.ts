/**
 * world/Plants.ts — the low ground plants of the four landschappen, built to be
 * instanced by the hundred: struikhei cushions on the heide, straw grass tufts between
 * them, helmgras on the stuifzand, lisdodde (the real reed GLB, simplified) around the
 * ven and adelaarsvaren in the bos.
 *
 * Why (2026-09-27): the old heather was a flat-shaded purple icosahedron (it read as a
 * gem) and the old marram a dark cone (it read as a spike). A heather plant is a low,
 * lumpy cushion of twigs, olive-brown below with a speckle of muted mauve bloom on top;
 * grass is a fan of thin blades. Both are vertex-coloured so a whole field is one
 * material, and both are cheap (a few hundred triangles) so the heath can be dense.
 *
 * `PlantField` lays one kind of plant out in fixed 20 m chunks: every chunk is one
 * InstancedMesh whose instances never change order (so a before/after read of the
 * world near a marker compares like with like), culled by its own bounding sphere and
 * hidden once the lens is far enough away that the fog has taken it. Plants never
 * block a click or a camera ray (their raycast is empty): they are ground cover.
 */

import * as THREE from 'three';

/** A seeded linear-congruential stream in [0,1). */
function stream(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

const _col = new THREE.Color();

/**
 * One struikhei plant, ~1 m wide and ~0.45 m high before scaling: a dark, low core
 * (so the ground never shows through) bristling with thin twig spikes, olive-brown at
 * the root and muted mauve at the flowering tip. Every normal points away from the
 * plant's heart, so the low sun lights it as one soft, rounded bush (not as a scatter
 * of hard cards). Its base sits a hair below y=0 so it grows out of a gentle slope.
 */
export function heatherGeometry(seed = 1, spikes = 130): THREE.BufferGeometry {
  const rnd = stream(seed);
  const P: number[] = [], N: number[] = [], C: number[] = [], I: number[] = [];
  const core = new THREE.Color('#554a32');
  const stem = new THREE.Color('#6f6443');
  const tipGreen = new THREE.Color('#8c8756');
  const bloom = new THREE.Color('#a47a9c');
  const push = (x: number, y: number, z: number, c: THREE.Color): number => {
    P.push(x, y, z);
    const nx = x, ny = (y - 0.02) * 1.6 + 0.25, nz = z;
    const l = Math.hypot(nx, ny, nz) || 1;
    N.push(nx / l, ny / l, nz / l);
    C.push(c.r, c.g, c.b);
    return P.length / 3 - 1;
  };
  const tri = (a: number, b: number, c: number): void => { I.push(a, b, c); };
  // the core: a low, slightly lumpy dome of 8 x 3 quads
  const SEG = 8, RINGS = 3, R0 = 0.36, H0 = 0.17;
  const ring: number[][] = [];
  for (let j = 0; j <= RINGS; j++) {
    const v = j / RINGS, row: number[] = [];
    for (let i = 0; i < SEG; i++) {
      const a = (i / SEG) * Math.PI * 2, lump = 0.85 + rnd() * 0.3;
      const rr = R0 * Math.cos(v * Math.PI * 0.5) * lump, y = H0 * Math.sin(v * Math.PI * 0.5) - 0.03;
      _col.copy(core).lerp(stem, v * 0.6);
      row.push(push(Math.cos(a) * rr, y, Math.sin(a) * rr, _col));
    }
    ring.push(row);
  }
  for (let j = 0; j < RINGS; j++) for (let i = 0; i < SEG; i++) {
    const a = ring[j][i], b = ring[j][(i + 1) % SEG], c = ring[j + 1][i], d = ring[j + 1][(i + 1) % SEG];
    if (j === RINGS - 1) { tri(a, b, c); continue; } // the top ring meets at the crown point
    tri(a, b, c); tri(b, d, c);
  }
  // the twigs: two crossed tapering cards each, rising out of the dome
  const inBloom = rnd() > 0.2;
  for (let k = 0; k < spikes; k++) {
    const a = rnd() * Math.PI * 2;
    const up = 0.04 + rnd() * 0.96;                     // how far up the dome it starts
    const rr = R0 * Math.cos(up * Math.PI * 0.5) * (0.75 + rnd() * 0.3);
    const bx = Math.cos(a) * rr, bz = Math.sin(a) * rr, by = H0 * Math.sin(up * Math.PI * 0.5) - 0.05;
    // outward and upward: a heather twig leans out of the bush, tips reaching up
    const out = 0.3 + (1 - up) * 0.9, len = 0.08 + rnd() * 0.1;
    let dx = Math.cos(a) * out + (rnd() - 0.5) * 0.3, dy = 1, dz = Math.sin(a) * out + (rnd() - 0.5) * 0.3;
    const dl = Math.hypot(dx, dy, dz); dx /= dl; dy /= dl; dz /= dl;
    const tx = bx + dx * len, ty = by + dy * len, tz = bz + dz * len;
    const w = 0.018 + rnd() * 0.014;
    const tip = inBloom && rnd() > 0.35 ? bloom : tipGreen;
    for (const turn of [0, Math.PI / 2]) {
      const px = Math.cos(a + turn + 1.3) * w, pz = Math.sin(a + turn + 1.3) * w;
      const i0 = push(bx - px, by, bz - pz, stem);
      const i1 = push(bx + px, by, bz + pz, stem);
      const i2 = push(tx, ty, tz, tip);
      tri(i0, i1, i2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setIndex(I);
  return g;
}

/**
 * A grass tuft of `blades` thin tapered blades fanned out from its root, 1 m tall
 * before scaling, coloured `root` → `tip` up each blade (both faces lit). Straw for the
 * pijpenstrootje on the heide, grey-green for the helmgras on the stuifzand.
 */
export function tuftGeometry(opts: { blades: number; seed: number; root: string; tip: string; lean?: number; width?: number }): THREE.BufferGeometry {
  const rnd = stream(opts.seed);
  const root = new THREE.Color(opts.root), tip = new THREE.Color(opts.tip);
  const P: number[] = [], C: number[] = [];
  const lean0 = opts.lean ?? 0.3, w0 = opts.width ?? 0.035;
  for (let i = 0; i < opts.blades; i++) {
    const a = (i / opts.blades) * Math.PI * 2 + rnd() * 0.8;
    const r0 = 0.02 + rnd() * 0.07;
    const h = 0.55 + rnd() * 0.45;
    const lean = lean0 * (0.5 + rnd());
    const w = w0 * (0.7 + rnd() * 0.6);
    const cx = Math.cos(a), cz = Math.sin(a), px = -cz, pz = cx;
    const bx = cx * r0, bz = cz * r0;
    const mx = cx * (r0 + lean * 0.3), mz = cz * (r0 + lean * 0.3);
    const tx = cx * (r0 + lean), tz = cz * (r0 + lean);
    const quad = [
      [bx - px * w, 0, bz - pz * w], [bx + px * w, 0, bz + pz * w], [mx + px * w * 0.6, h * 0.55, mz + pz * w * 0.6],
      [bx - px * w, 0, bz - pz * w], [mx + px * w * 0.6, h * 0.55, mz + pz * w * 0.6], [mx - px * w * 0.6, h * 0.55, mz - pz * w * 0.6],
      [mx - px * w * 0.6, h * 0.55, mz - pz * w * 0.6], [mx + px * w * 0.6, h * 0.55, mz + pz * w * 0.6], [tx, h, tz],
    ];
    const t = [0, 0, 0.55, 0, 0.55, 0.55, 0.55, 0.55, 1];
    quad.forEach((v, k) => {
      P.push(v[0], v[1], v[2]);
      _col.copy(root).lerp(tip, t[k]);
      C.push(_col.r, _col.g, _col.b);
    });
  }
  // blades are thin cards: light them as if they faced up and out of the tuft
  const N: number[] = [];
  for (let i = 0; i < P.length; i += 3) {
    const nx = P[i] * 1.2, ny = 0.8, nz = P[i + 2] * 1.2;
    const l = Math.hypot(nx, ny, nz);
    N.push(nx / l, ny / l, nz / l);
  }
  const I: number[] = [];
  for (let t = 0; t < P.length / 3; t += 3) I.push(t, t + 1, t + 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setIndex(I);
  return g;
}

let plantMat: THREE.MeshStandardMaterial | null = null;
/**
 * The one matte, vertex-coloured material every procedural plant shares. Both faces
 * draw, but a card seen from behind keeps its own (outward) normal instead of the
 * flipped one three.js would give it: a thin blade or twig is lit the same from either
 * side, like the plant it belongs to, and never turns dark.
 */
export function plantMaterial(): THREE.MeshStandardMaterial {
  if (plantMat) return plantMat;
  plantMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
  plantMat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''),
    );
  };
  plantMat.customProgramCacheKey = () => 'plant-no-backface-flip';
  return plantMat;
}

/** One placed plant: world position (y = the ground there), size, turn and tint. */
export interface PlantSpot { x: number; y: number; z: number; s: number; sy?: number; rotY: number; tint?: THREE.Color; phase?: number }

const CHUNK = 20;
const noRaycast = (): void => {};

/**
 * One kind of plant laid out in fixed 20 m chunks (see the module note). `hideBeyond`
 * is the lens distance (m, to the nearest point of a chunk) past which a chunk is not
 * drawn. `wind` > 0 lets the field lean in the wind (the Dressing re-tilts it).
 */
export class PlantField {
  readonly chunks: { mesh: THREE.InstancedMesh; items: PlantSpot[]; cx: number; cz: number; r: number }[] = [];
  private readonly hideBeyond: number;

  constructor(scene: THREE.Scene, name: string, geometry: THREE.BufferGeometry, material: THREE.Material, spots: PlantSpot[], hideBeyond: number) {
    this.hideBeyond = hideBeyond;
    const cells = new Map<string, PlantSpot[]>();
    for (const s of spots) {
      const k = `${Math.floor(s.x / CHUNK)},${Math.floor(s.z / CHUNK)}`;
      let list = cells.get(k);
      if (!list) cells.set(k, (list = []));
      list.push(s);
    }
    geometry.computeBoundingSphere();
    const gr = geometry.boundingSphere!.radius + geometry.boundingSphere!.center.length();
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    for (const [key, items] of [...cells.entries()].sort()) {
      const mesh = new THREE.InstancedMesh(geometry, material, items.length);
      mesh.name = `${name}@${key}`;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.raycast = noRaycast;
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity, maxY = -Infinity, maxS = 0;
      items.forEach((s, k) => {
        m.compose(p.set(s.x, s.y, s.z), q.setFromAxisAngle(up, s.rotY), sc.set(s.s, s.sy ?? s.s, s.s));
        mesh.setMatrixAt(k, m);
        if (s.tint) mesh.setColorAt(k, s.tint);
        minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x); minZ = Math.min(minZ, s.z); maxZ = Math.max(maxZ, s.z);
        minY = Math.min(minY, s.y); maxY = Math.max(maxY, s.y); maxS = Math.max(maxS, s.s, s.sy ?? 0);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
      const r = Math.hypot(maxX - minX, maxZ - minZ) / 2 + gr * maxS;
      mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx, (minY + maxY) / 2, cz), Math.hypot(r, (maxY - minY) / 2 + gr * maxS));
      scene.add(mesh);
      this.chunks.push({ mesh, items, cx, cz, r });
    }
  }

  /** Per rendered frame: draw only the chunks the fog has not yet taken. */
  update(camera: THREE.Camera): void {
    const e = camera.matrixWorld.elements;
    for (const c of this.chunks) {
      const d = Math.hypot(c.cx - e[12], c.cz - e[14]) - c.r;
      c.mesh.visible = d < this.hideBeyond;
    }
  }
}
