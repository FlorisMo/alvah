/**
 * acorn.ts — one acorn (a nut in its cup), small and procedural: the one a squirrel
 * carries in its mouth, buries in the moss and digs up again. One geometry with vertex
 * colours (one draw call wherever it is used). About 5 cm long: generous for an oak's
 * acorn (2-3 cm), so a child still sees it in the squirrel's mouth a few metres off.
 */

import * as THREE from 'three';

/** Its length (m), cup to tip. */
export const ACORN_LEN = 0.052;

/** The acorn lying along +z (its cup behind, its tip ahead), its middle at the origin. */
export function acornGeometry(): THREE.BufferGeometry {
  const nut = new THREE.SphereGeometry(0.5, 10, 8);
  nut.scale(0.62, 0.62, 1);
  nut.translate(0, 0, 0.12);
  paint(nut, (y, z) => (z > 0.5 ? '#7a5228' : y > 0.18 ? '#e0ac62' : '#c08a48'));
  const cup = new THREE.SphereGeometry(0.36, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55);
  cup.rotateX(-Math.PI / 2);
  cup.translate(0, 0, -0.18);
  paint(cup, () => '#7a6444');
  const stalk = new THREE.CylinderGeometry(0.04, 0.05, 0.16, 5);
  stalk.rotateX(Math.PI / 2);
  stalk.translate(0, 0, -0.5);
  paint(stalk, () => '#5a4a30');
  const parts = [nut, cup, stalk].map((p) => p.toNonIndexed());
  const pos: number[] = [], col: number[] = [];
  for (const p of parts) {
    pos.push(...(p.attributes.position.array as Float32Array));
    col.push(...(p.attributes.color.array as Float32Array));
    p.dispose();
  }
  nut.dispose(); cup.dispose(); stalk.dispose();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  g.scale(ACORN_LEN, ACORN_LEN, ACORN_LEN);
  return g;
}

/** A material for acorns (glossy nut, a touch of warm light so it reads in the shade). */
export function acornMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, emissive: '#3a2410', emissiveIntensity: 0.6 });
}

function paint(g: THREE.BufferGeometry, color: (y: number, z: number) => string): void {
  const p = g.attributes.position;
  const c = new Float32Array(p.count * 3);
  const col = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    col.set(color(p.getY(i), p.getZ(i)));
    c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
}
