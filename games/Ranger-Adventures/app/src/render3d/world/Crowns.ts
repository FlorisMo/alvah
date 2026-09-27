/**
 * world/Crowns.ts — THE tree occluder model: what of a tree can stand between the
 * camera and the ranger. One model, used by both sides (2026-09-27, review CAM-1):
 * the camera rig decides with it which trees block the view (and keeps its lens out
 * of their leaves), and the forest fades exactly those trees. Before, each side had
 * its own model, so many crowns the camera counted as "in the way" never faded.
 *
 * A tree is three stacked upright cylinders: the trunk, the wide lower foliage and the
 * narrower top. Measured off the tree GLBs as the forest draws them (per 5 % of the
 * height: the furthest foliage vertex from the trunk), as fractions of the height:
 *
 *   pine   trunk ≤ 0.04 · foliage 0.44–0.78 reach 0.29 · top to 1.0 reach 0.20
 *   oak    trunk ≤ 0.075 · foliage 0.14–0.75 reach 0.65 · top to 1.0 reach 0.47
 *   birch  trunk ≤ 0.045 · foliage 0.34–0.80 reach 0.33 · top to 1.0 reach 0.22
 *
 * Cylinders, not spheres or ellipsoids: an oak's foliage is flat underneath and just
 * as wide at 0.15 of its height as at 0.4 (an ellipsoid round its middle missed the
 * leaves at the ranger's head height), and a line against a cylinder is exact and cheap.
 * Pure maths, no three.js: unit-tested in Crowns.test.ts.
 */

/** One cylinder of a tree: radius and height band as fractions of the tree height. */
interface Band { y0: number; y1: number; r: number }

/** Per species: the trunk, then the foliage bands (low to high). */
const SHAPES: Record<string, { trunk: Band; leaves: readonly Band[] }> = {
  'prop-pine-scots': { trunk: { y0: 0, y1: 0.44, r: 0.04 }, leaves: [{ y0: 0.44, y1: 0.78, r: 0.29 }, { y0: 0.78, y1: 1.0, r: 0.2 }] },
  'prop-oak-tree': { trunk: { y0: 0, y1: 0.14, r: 0.075 }, leaves: [{ y0: 0.14, y1: 0.75, r: 0.65 }, { y0: 0.75, y1: 1.0, r: 0.47 }] },
  'prop-birch-tree': { trunk: { y0: 0, y1: 0.34, r: 0.045 }, leaves: [{ y0: 0.34, y1: 0.8, r: 0.33 }, { y0: 0.8, y1: 1.0, r: 0.22 }] },
};

/** A tree for the camera: its trunk axis at (x, z), standing on y, and its cylinders in
 *  world metres. `tree` = its index in the forest (so the forest can fade it), or -1
 *  for a tree the forest cannot fade (the view must avoid it). */
export interface Crown {
  x: number; y: number; z: number;
  /** [y0, y1, r] per cylinder, trunk first; world heights. */
  bands: Float64Array;
  /** the widest reach of any band (m), for a quick reject */
  reach: number;
  /** the underside of the leaves (world y) */
  floor: number;
  /** the top of the tree (world y) */
  top: number;
  tree: number;
}

/** A crown for a tree of `kind` and height `H` standing at (x, y, z); null for a kind
 *  that is not a tree. */
export function crownOf(kind: string, H: number, x: number, y: number, z: number, tree: number): Crown | null {
  const shape = SHAPES[kind];
  if (!shape) return null;
  const all = [shape.trunk, ...shape.leaves];
  const bands = new Float64Array(all.length * 3);
  let reach = 0;
  all.forEach((b, i) => {
    bands[i * 3] = y + b.y0 * H;
    bands[i * 3 + 1] = y + b.y1 * H;
    bands[i * 3 + 2] = b.r * H;
    reach = Math.max(reach, b.r * H);
  });
  return { x, y, z, bands, reach, floor: y + shape.leaves[0].y0 * H, top: y + H, tree };
}

/** Is (px, py, pz) inside the tree, every cylinder grown by `margin` (m)? `leavesOnly`
 *  leaves the trunk out. */
export function insideCrown(k: Crown, px: number, py: number, pz: number, margin: number, leavesOnly = false): boolean {
  const dx = px - k.x, dz = pz - k.z;
  const d2 = dx * dx + dz * dz;
  const rr = k.reach + margin;
  if (d2 > rr * rr || py < k.y - margin || py > k.top + margin) return false;
  const b = k.bands;
  for (let i = leavesOnly ? 3 : 0; i < b.length; i += 3) {
    const r = b[i + 2] + margin;
    if (py >= b[i] - margin && py <= b[i + 1] + margin && d2 <= r * r) return true;
  }
  return false;
}

/**
 * Does the tree cross the straight line from (cx, cy, cz) (the lens) to (ax, ay, az)
 * (a point on the ranger) somewhere strictly between them? Only the stretch with line
 * parameter in (tMin, tMax) counts: a tree behind the lens or right at / beyond him is a
 * backdrop, not an occluder. A lens INSIDE the tree crosses it from t = 0, so it counts.
 */
export function blocksLine(
  k: Crown, cx: number, cy: number, cz: number, ax: number, ay: number, az: number,
  tMin = 0.02, tMax = 0.9,
): boolean {
  const dx = ax - cx, dy = ay - cy, dz = az - cz;
  // the horizontal circle of each band: |(c - k) + t·d|² ≤ r², as a·t² + b·t + c ≤ 0
  const px = cx - k.x, pz = cz - k.z;
  const a = dx * dx + dz * dz, bh = 2 * (px * dx + pz * dz), ch = px * px + pz * pz;
  // quick reject: the line never comes within the widest reach
  if (a > 1e-12) {
    const tc = Math.max(0, Math.min(1, -bh / (2 * a)));
    const gx = px + dx * tc, gz = pz + dz * tc;
    if (gx * gx + gz * gz > k.reach * k.reach) return false;
  } else if (ch > k.reach * k.reach) return false;
  const b = k.bands;
  for (let i = 0; i < b.length; i += 3) {
    const y0 = b[i], y1 = b[i + 1], r = b[i + 2];
    // the stretch of the line inside the band's height slab
    let lo = tMin, hi = tMax;
    if (Math.abs(dy) < 1e-9) {
      if (cy < y0 || cy > y1) continue;
    } else {
      let s0 = (y0 - cy) / dy, s1 = (y1 - cy) / dy;
      if (s0 > s1) { const t = s0; s0 = s1; s1 = t; }
      lo = Math.max(lo, s0); hi = Math.min(hi, s1);
      if (lo >= hi) continue;
    }
    // …and inside its circle
    const c = ch - r * r;
    if (a < 1e-12) { if (c <= 0) return true; continue; }
    const disc = bh * bh - 4 * a * c;
    if (disc < 0) continue;
    const sq = Math.sqrt(disc);
    const t0 = (-bh - sq) / (2 * a), t1 = (-bh + sq) / (2 * a);
    if (Math.max(lo, t0) < Math.min(hi, t1)) return true;
  }
  return false;
}

/** The underside of the tree's leaves (world y) above the ground point (x, z), with the
 *  leaves grown by `margin`: how high a lens there may rise before it is in the leaves.
 *  Infinity when (x, z) is outside the leaves' reach. */
export function leavesFloorAt(k: Crown, x: number, z: number, margin: number): number {
  const dx = x - k.x, dz = z - k.z;
  const d2 = dx * dx + dz * dz;
  const b = k.bands;
  let floor = Infinity;
  for (let i = 3; i < b.length; i += 3) {
    const r = b[i + 2] + margin;
    if (d2 <= r * r) floor = Math.min(floor, b[i] - margin);
  }
  return floor;
}
