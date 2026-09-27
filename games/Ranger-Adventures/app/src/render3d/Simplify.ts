/**
 * Simplify.ts — a small quadric-error mesh simplifier (pure, THREE-free).
 *
 * Why it exists: every Meshy tree and plant GLB is ~9-12k triangles, and the Veluwe
 * plants a few hundred of them. Drawn at full detail that was 2.5-5M triangles a frame
 * (budget: 1M). The world keeps the real GLB up close and draws far copies from
 * lower-detail versions made HERE, at load time, from the same GLB (no new assets, no
 * runtime dependency). The low versions carry a per-vertex colour sampled from the
 * GLB's own texture, so a far tree is the same tree, just coarser.
 *
 * The method is Garland & Heckbert's edge collapse: every vertex carries the summed
 * plane quadrics of its faces; the cheapest edge is collapsed first (to the best of its
 * two ends and their midpoint), a collapse that would flip or crush a neighbouring face
 * is refused, and open borders are held by extra perpendicular planes so a leaf card
 * or the trunk base does not shrink away. One pass returns several targets, coarsest
 * last. Deterministic: the same input always gives the same output.
 */

export interface SimplifyInput {
  /** xyz per vertex */
  positions: Float32Array;
  /** triangle vertex indices */
  indices: ArrayLike<number>;
  /** optional rgb per vertex, averaged as vertices merge */
  colors?: Float32Array;
}

export interface SimplifiedMesh {
  positions: Float32Array;
  colors: Float32Array | null;
  indices: Uint32Array;
}

/** Symmetric 4×4 quadric, 10 unique terms: a² ab ac ad b² bc bd c² cd d². */
const Q = 10;

function addPlane(q: Float64Array, o: number, a: number, b: number, c: number, d: number, w: number): void {
  q[o] += w * a * a; q[o + 1] += w * a * b; q[o + 2] += w * a * c; q[o + 3] += w * a * d;
  q[o + 4] += w * b * b; q[o + 5] += w * b * c; q[o + 6] += w * b * d;
  q[o + 7] += w * c * c; q[o + 8] += w * c * d; q[o + 9] += w * d * d;
}

function evalQ(q: Float64Array, o: number, x: number, y: number, z: number): number {
  return q[o] * x * x + 2 * q[o + 1] * x * y + 2 * q[o + 2] * x * z + 2 * q[o + 3] * x
    + q[o + 4] * y * y + 2 * q[o + 5] * y * z + 2 * q[o + 6] * y
    + q[o + 7] * z * z + 2 * q[o + 8] * z + q[o + 9];
}

/** Binary min-heap of edge candidates. The records (cost, ends, their stamps, the
 *  collapse point) live in growable typed arrays; the heap orders record ids only. */
class EdgeHeap {
  private cap = 1024;
  private n = 0;         // records written
  private size_ = 0;     // ids in the heap
  private cost = new Float64Array(this.cap);
  private ends = new Int32Array(this.cap * 4); // a, b, stamp a, stamp b
  private pt = new Float64Array(this.cap * 3);
  private heap = new Int32Array(this.cap);
  get size(): number { return this.size_; }
  private grow(): void {
    this.cap *= 2;
    const c = new Float64Array(this.cap); c.set(this.cost); this.cost = c;
    const e = new Int32Array(this.cap * 4); e.set(this.ends); this.ends = e;
    const p = new Float64Array(this.cap * 3); p.set(this.pt); this.pt = p;
    const h = new Int32Array(this.cap); h.set(this.heap); this.heap = h;
  }
  push(cost: number, a: number, b: number, sa: number, sb: number, x: number, y: number, z: number): void {
    if (this.n >= this.cap || this.size_ >= this.cap) this.grow();
    const id = this.n++;
    this.cost[id] = cost;
    this.ends[id * 4] = a; this.ends[id * 4 + 1] = b; this.ends[id * 4 + 2] = sa; this.ends[id * 4 + 3] = sb;
    this.pt[id * 3] = x; this.pt[id * 3 + 1] = y; this.pt[id * 3 + 2] = z;
    const H = this.heap, C = this.cost;
    let i = this.size_++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (C[H[p]] <= cost) break;
      H[i] = H[p]; i = p;
    }
    H[i] = id;
  }
  /** Take the cheapest record into `out`. */
  pop(out: { cost: number; a: number; b: number; sa: number; sb: number; x: number; y: number; z: number }): void {
    const H = this.heap, C = this.cost;
    const id = H[0];
    out.cost = C[id]; out.a = this.ends[id * 4]; out.b = this.ends[id * 4 + 1]; out.sa = this.ends[id * 4 + 2]; out.sb = this.ends[id * 4 + 3];
    out.x = this.pt[id * 3]; out.y = this.pt[id * 3 + 1]; out.z = this.pt[id * 3 + 2];
    const last = H[--this.size_];
    const n = this.size_;
    const lc = C[last];
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      if (l >= n) break;
      const r = l + 1;
      const m = r < n && C[H[r]] < C[H[l]] ? r : l;
      if (C[H[m]] >= lc) break;
      H[i] = H[m]; i = m;
    }
    H[i] = last;
  }
}

/**
 * Simplify to each of `targets` (triangle counts, any order); returns one mesh per
 * target in the order given. A target at or above the input count returns the welded
 * input. Vertices are first welded by position (UV seams do not matter: the output
 * carries colours, not texture coordinates).
 */
export function simplify(input: SimplifyInput, targets: number[]): SimplifiedMesh[] {
  const src = input.positions;
  const nSrc = src.length / 3;
  // ---- weld by quantized position -------------------------------------------------
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < nSrc; i++) {
    const x = src[i * 3], y = src[i * 3 + 1], z = src[i * 3 + 2];
    if (x < minX) minX = x; if (y < minY) minY = y; if (z < minZ) minZ = z;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y; if (z > maxZ) maxZ = z;
  }
  const diag = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) || 1;
  const eps = diag / 90000; // quantized coords stay < 1e5, so three pack into one exact number
  const weldMap = new Int32Array(nSrc);
  const seen = new Map<number, number>();
  const pos: number[] = [];
  const colSum: number[] = [];
  const colN: number[] = [];
  const cin = input.colors;
  for (let i = 0; i < nSrc; i++) {
    const k = Math.round((src[i * 3] - minX) / eps) * 1e10 + Math.round((src[i * 3 + 1] - minY) / eps) * 1e5 + Math.round((src[i * 3 + 2] - minZ) / eps);
    let v = seen.get(k);
    if (v === undefined) {
      v = pos.length / 3;
      seen.set(k, v);
      pos.push(src[i * 3], src[i * 3 + 1], src[i * 3 + 2]);
      colSum.push(0, 0, 0); colN.push(0);
    }
    weldMap[i] = v;
    if (cin) { colSum[v * 3] += cin[i * 3]; colSum[v * 3 + 1] += cin[i * 3 + 1]; colSum[v * 3 + 2] += cin[i * 3 + 2]; colN[v] += 1; }
  }
  const nV = pos.length / 3;
  const P = new Float64Array(pos);
  const C = cin ? new Float64Array(nV * 3) : null;
  if (C) for (let v = 0; v < nV; v++) { const n = colN[v] || 1; C[v * 3] = colSum[v * 3] / n; C[v * 3 + 1] = colSum[v * 3 + 1] / n; C[v * 3 + 2] = colSum[v * 3 + 2] / n; }
  // ---- faces (degenerate ones dropped) --------------------------------------------
  const idx = input.indices;
  const F: number[] = [];
  for (let t = 0; t + 2 < idx.length; t += 3) {
    const a = weldMap[idx[t]], b = weldMap[idx[t + 1]], c = weldMap[idx[t + 2]];
    if (a === b || b === c || a === c) continue;
    F.push(a, b, c);
  }
  const nF = F.length / 3;
  const faceAlive = new Uint8Array(nF).fill(1);
  let liveFaces = nF;
  // vertex → incident faces
  const vf: number[][] = Array.from({ length: nV }, () => []);
  for (let f = 0; f < nF; f++) { vf[F[f * 3]].push(f); vf[F[f * 3 + 1]].push(f); vf[F[f * 3 + 2]].push(f); }
  // connected parts (a leaf, a heather spike, a trunk): a part is never collapsed away,
  // it keeps at least MIN_PART faces, so small leaves thin out instead of vanishing
  const part = new Int32Array(nV).fill(-1);
  const partFaces: number[] = [];
  for (let s = 0; s < nV; s++) {
    if (part[s] >= 0 || vf[s].length === 0) continue;
    const id = partFaces.length;
    partFaces.push(0);
    const stack = [s];
    part[s] = id;
    while (stack.length) {
      const v = stack.pop()!;
      for (const f of vf[v]) for (let k = 0; k < 3; k++) {
        const w = F[f * 3 + k];
        if (part[w] < 0) { part[w] = id; stack.push(w); }
      }
    }
  }
  for (let f = 0; f < nF; f++) partFaces[part[F[f * 3]]] += 1;
  const MIN_PART = 2;
  // ---- quadrics ----------------------------------------------------------------------
  const QV = new Float64Array(nV * Q);
  const area = new Float64Array(nV); // accumulated area → colour blend weight
  const edgeFaces = new Map<number, number>(); // edge key → face count (for borders)
  const ekey = (a: number, b: number): number => (a < b ? a * nV + b : b * nV + a);
  for (let f = 0; f < nF; f++) {
    const a = F[f * 3], b = F[f * 3 + 1], c = F[f * 3 + 2];
    const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
    const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    const ar = len / 2;
    if (len > 0) { nx /= len; ny /= len; nz /= len; }
    const d = -(nx * P[a * 3] + ny * P[a * 3 + 1] + nz * P[a * 3 + 2]);
    for (const v of [a, b, c]) { addPlane(QV, v * Q, nx, ny, nz, d, ar); area[v] += ar / 3; }
    for (let e = 0; e < 3; e++) { const k = ekey(F[f * 3 + e], F[f * 3 + (e + 1) % 3]); edgeFaces.set(k, (edgeFaces.get(k) ?? 0) + 1); }
  }
  // borders: a plane through the edge, perpendicular to its face, weighted heavily
  for (let f = 0; f < nF; f++) {
    const a = F[f * 3], b = F[f * 3 + 1], c = F[f * 3 + 2];
    const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
    const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    for (let e = 0; e < 3; e++) {
      const p = F[f * 3 + e], q = F[f * 3 + (e + 1) % 3];
      if (edgeFaces.get(ekey(p, q)) !== 1) continue;
      const ex = P[q * 3] - P[p * 3], ey = P[q * 3 + 1] - P[p * 3 + 1], ez = P[q * 3 + 2] - P[p * 3 + 2];
      const el = Math.hypot(ex, ey, ez);
      if (el === 0) continue;
      // perpendicular to the face, containing the edge
      let px = ey * nz - ez * ny, py = ez * nx - ex * nz, pz = ex * ny - ey * nx;
      const pl = Math.hypot(px, py, pz) || 1; px /= pl; py /= pl; pz /= pl;
      const pd = -(px * P[p * 3] + py * P[p * 3 + 1] + pz * P[p * 3 + 2]);
      const w = el * el * 4;
      addPlane(QV, p * Q, px, py, pz, pd, w);
      addPlane(QV, q * Q, px, py, pz, pd, w);
    }
  }
  // ---- candidates -------------------------------------------------------------------
  const alive = new Uint8Array(nV).fill(1);
  const stamp = new Uint32Array(nV);
  const heap = new EdgeHeap();
  const qs = new Float64Array(Q);
  const pushEdge = (a: number, b: number): void => {
    for (let i = 0; i < Q; i++) qs[i] = QV[a * Q + i] + QV[b * Q + i];
    const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
    const bx = P[b * 3], by = P[b * 3 + 1], bz = P[b * 3 + 2];
    const mx = (ax + bx) / 2, my = (ay + by) / 2, mz = (az + bz) / 2;
    const ca = evalQ(qs, 0, ax, ay, az), cb = evalQ(qs, 0, bx, by, bz), cm = evalQ(qs, 0, mx, my, mz);
    let cost = cm, x = mx, y = my, z = mz;
    if (ca < cost) { cost = ca; x = ax; y = ay; z = az; }
    if (cb < cost) { cost = cb; x = bx; y = by; z = bz; }
    heap.push(Math.max(0, cost), a, b, stamp[a], stamp[b], x, y, z);
  };
  const edgeDone = new Set<number>();
  for (let f = 0; f < nF; f++) {
    for (let e = 0; e < 3; e++) {
      const p = F[f * 3 + e], q = F[f * 3 + (e + 1) % 3];
      const k = ekey(p, q);
      if (edgeDone.has(k)) continue;
      edgeDone.add(k);
      pushEdge(p, q);
    }
  }
  // ---- collapse loop -----------------------------------------------------------------
  const order = targets.map((t, i) => ({ t: Math.max(1, Math.floor(t)), i })).sort((p, q) => q.t - p.t);
  const out: SimplifiedMesh[] = new Array(targets.length);
  const top = { cost: 0, a: 0, b: 0, sa: 0, sb: 0, x: 0, y: 0, z: 0 };
  const seenMark = new Int32Array(nV);
  let mark = 0;

  /** Would moving vertex v to (x,y,z) flip or crush any of its faces (ignoring faces with `skip`)? */
  const flips = (v: number, skip: number, x: number, y: number, z: number): boolean => {
    for (const f of vf[v]) {
      if (!faceAlive[f]) continue;
      const i0 = F[f * 3], i1 = F[f * 3 + 1], i2 = F[f * 3 + 2];
      if (i0 === skip || i1 === skip || i2 === skip) continue;
      const pt = (i: number, k: number): number => (i === v ? (k === 0 ? x : k === 1 ? y : z) : P[i * 3 + k]);
      const ox = P[i0 * 3], oy = P[i0 * 3 + 1], oz = P[i0 * 3 + 2];
      const n0x = (P[i1 * 3 + 1] - oy) * (P[i2 * 3 + 2] - oz) - (P[i1 * 3 + 2] - oz) * (P[i2 * 3 + 1] - oy);
      const n0y = (P[i1 * 3 + 2] - oz) * (P[i2 * 3] - ox) - (P[i1 * 3] - ox) * (P[i2 * 3 + 2] - oz);
      const n0z = (P[i1 * 3] - ox) * (P[i2 * 3 + 1] - oy) - (P[i1 * 3 + 1] - oy) * (P[i2 * 3] - ox);
      const qx = pt(i0, 0), qy = pt(i0, 1), qz = pt(i0, 2);
      const ux = pt(i1, 0) - qx, uy = pt(i1, 1) - qy, uz = pt(i1, 2) - qz;
      const wx = pt(i2, 0) - qx, wy = pt(i2, 1) - qy, wz = pt(i2, 2) - qz;
      const n1x = uy * wz - uz * wy, n1y = uz * wx - ux * wz, n1z = ux * wy - uy * wx;
      const l0 = Math.hypot(n0x, n0y, n0z), l1 = Math.hypot(n1x, n1y, n1z);
      if (l1 < 1e-12) return true; // crushed to a sliver
      if (l0 < 1e-12) continue;
      if ((n0x * n1x + n0y * n1y + n0z * n1z) / (l0 * l1) < 0.2) return true;
    }
    return false;
  };

  const snapshot = (): SimplifiedMesh => {
    const remap = new Int32Array(nV).fill(-1);
    const op: number[] = [], oc: number[] = [], oi: number[] = [];
    for (let f = 0; f < nF; f++) {
      if (!faceAlive[f]) continue;
      for (let k = 0; k < 3; k++) {
        const v = F[f * 3 + k];
        if (remap[v] < 0) {
          remap[v] = op.length / 3;
          op.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
          if (C) oc.push(C[v * 3], C[v * 3 + 1], C[v * 3 + 2]);
        }
        oi.push(remap[v]);
      }
    }
    return { positions: new Float32Array(op), colors: C ? new Float32Array(oc) : null, indices: new Uint32Array(oi) };
  };

  let oi = 0;
  while (oi < order.length && order[oi].t >= liveFaces) out[order[oi++].i] = snapshot();
  while (oi < order.length && heap.size > 0) {
    heap.pop(top);
    const { a, b } = top;
    if (!alive[a] || !alive[b] || stamp[a] !== top.sa || stamp[b] !== top.sb) continue;
    if (flips(a, b, top.x, top.y, top.z) || flips(b, a, top.x, top.y, top.z)) {
      // refused now; it may become acceptable once its neighbourhood changes
      continue;
    }
    let lost = 0;
    for (const f of vf[b]) {
      if (!faceAlive[f]) continue;
      if (F[f * 3] === a || F[f * 3 + 1] === a || F[f * 3 + 2] === a) lost += 1;
    }
    if (partFaces[part[a]] - lost < MIN_PART) continue; // the last of a leaf / spike stays
    partFaces[part[a]] -= lost;
    // collapse b into a at the chosen point
    P[a * 3] = top.x; P[a * 3 + 1] = top.y; P[a * 3 + 2] = top.z;
    for (let i = 0; i < Q; i++) QV[a * Q + i] += QV[b * Q + i];
    if (C) {
      const wa = area[a] || 1e-9, wb = area[b] || 1e-9, s = wa + wb;
      for (let k = 0; k < 3; k++) C[a * 3 + k] = (C[a * 3 + k] * wa + C[b * 3 + k] * wb) / s;
    }
    area[a] += area[b];
    alive[b] = 0;
    for (const f of vf[b]) {
      if (!faceAlive[f]) continue;
      const i0 = F[f * 3], i1 = F[f * 3 + 1], i2 = F[f * 3 + 2];
      if (i0 === a || i1 === a || i2 === a) { faceAlive[f] = 0; liveFaces -= 1; continue; }
      if (i0 === b) F[f * 3] = a; else if (i1 === b) F[f * 3 + 1] = a; else F[f * 3 + 2] = a;
      vf[a].push(f);
    }
    vf[b] = [];
    const fa = vf[a];
    let w = 0;
    for (let r = 0; r < fa.length; r++) if (faceAlive[fa[r]]) fa[w++] = fa[r];
    fa.length = w;
    stamp[a] += 1;
    // re-queue a's edges (each neighbour once)
    mark += 1;
    for (const f of fa) for (let k = 0; k < 3; k++) {
      const v = F[f * 3 + k];
      if (v === a || seenMark[v] === mark) continue;
      seenMark[v] = mark;
      pushEdge(a, v);
    }
    while (oi < order.length && order[oi].t >= liveFaces) out[order[oi++].i] = snapshot();
  }
  while (oi < order.length) out[order[oi++].i] = snapshot();
  return out;
}
