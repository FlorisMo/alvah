/**
 * Simplify.test.ts — the load-time LOD simplifier keeps a shape's size and outline,
 * hits its triangle targets, never emits a crushed triangle and is deterministic.
 * Run: `node --experimental-strip-types --test src/render3d/Simplify.test.ts`
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { simplify, type SimplifiedMesh } from './Simplify.ts';

/** A UV sphere with duplicated seam vertices (like a textured GLB) and a colour per vertex. */
function sphere(seg: number, r = 1): { positions: Float32Array; indices: Uint32Array; colors: Float32Array } {
  const p: number[] = [], c: number[] = [], idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const th = (i / seg) * Math.PI;
    for (let j = 0; j <= seg; j++) {
      const ph = (j / seg) * Math.PI * 2;
      const x = r * Math.sin(th) * Math.cos(ph), y = r * Math.cos(th), z = r * Math.sin(th) * Math.sin(ph);
      p.push(x, y, z);
      c.push(0.2 + 0.6 * (y > 0 ? 1 : 0), 0.5, 0.3); // two colour bands
    }
  }
  const row = seg + 1;
  for (let i = 0; i < seg; i++) for (let j = 0; j < seg; j++) {
    const a = i * row + j, b = a + row;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  return { positions: new Float32Array(p), indices: new Uint32Array(idx), colors: new Float32Array(c) };
}

function bbox(m: SimplifiedMesh): number[] {
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.positions.length; i += 3) for (let k = 0; k < 3; k++) {
    b[k] = Math.min(b[k], m.positions[i + k]); b[k + 3] = Math.max(b[k + 3], m.positions[i + k]);
  }
  return b;
}

function minArea(m: SimplifiedMesh): number {
  let min = Infinity;
  const P = m.positions;
  for (let t = 0; t < m.indices.length; t += 3) {
    const [a, b, c] = [m.indices[t] * 3, m.indices[t + 1] * 3, m.indices[t + 2] * 3];
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    min = Math.min(min, Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2);
  }
  return min;
}

test('a sphere reaches each target and keeps its size', () => {
  const s = sphere(48); // 4608 triangles with seams
  const [mid, far] = simplify(s, [600, 120]);
  const tris = (m: SimplifiedMesh): number => m.indices.length / 3;
  assert.ok(tris(mid) <= 600 && tris(mid) >= 480, `mid ${tris(mid)} tris`);
  assert.ok(tris(far) <= 120 && tris(far) >= 80, `far ${tris(far)} tris`);
  for (const m of [mid, far]) {
    const b = bbox(m);
    for (let k = 0; k < 3; k++) {
      assert.ok(b[k] < -0.85 && b[k + 3] > 0.85, `axis ${k} keeps the radius: [${b[k].toFixed(2)}, ${b[k + 3].toFixed(2)}]`);
    }
    assert.ok(minArea(m) > 1e-9, 'no crushed triangle');
    assert.ok(m.colors && m.colors.length === m.positions.length, 'one colour per vertex');
    for (const v of m.colors!) assert.ok(v >= 0 && v <= 1, 'colours stay in range');
  }
});

test('an open flat patch keeps its outline (borders are held)', () => {
  const n = 20, p: number[] = [], idx: number[] = [];
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) p.push(i / n, 0, j / n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const a = i * (n + 1) + j, b = a + n + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const [low] = simplify({ positions: new Float32Array(p), indices: idx }, [40]);
  const b = bbox(low);
  assert.deepEqual(b.map((v) => Math.round(v * 1000) / 1000), [0, 0, 0, 1, 0, 1], 'the square keeps its corners');
  assert.ok(low.indices.length / 3 <= 40);
  // the area is kept: a flat square simplified must still cover 1 m²
  let area = 0;
  for (let t = 0; t < low.indices.length; t += 3) {
    const [a, bb, c] = [low.indices[t] * 3, low.indices[t + 1] * 3, low.indices[t + 2] * 3];
    const P = low.positions;
    area += Math.abs((P[bb] - P[a]) * (P[c + 2] - P[a + 2]) - (P[bb + 2] - P[a + 2]) * (P[c] - P[a])) / 2;
  }
  assert.ok(Math.abs(area - 1) < 0.02, `area ${area.toFixed(3)} ≈ 1`);
});

test('deterministic: the same input gives the same output', () => {
  const s = sphere(24);
  const [a] = simplify(s, [200]);
  const [b] = simplify(s, [200]);
  assert.deepEqual(Array.from(a.indices), Array.from(b.indices));
  assert.deepEqual(Array.from(a.positions), Array.from(b.positions));
});

test('a target above the input count returns the welded input', () => {
  const s = sphere(8); // 128 triangles, seams welded; the poles' slivers drop out
  const [same] = simplify(s, [10_000]);
  assert.ok(same.indices.length / 3 <= 128 && same.indices.length / 3 >= 100);
  assert.ok(same.positions.length / 3 < s.positions.length / 3, 'seam duplicates are welded');
});
