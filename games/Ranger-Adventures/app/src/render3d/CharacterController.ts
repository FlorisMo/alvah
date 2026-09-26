/**
 * CharacterController.ts — the kinematic ground-follow + soft-collision resolver
 * for the ranger walking the 3D Veluwe (BUILD-PLAN §4 box 38c, §8d.2).
 *
 * Deliberately an ANALYTIC CLAMP, not three-mesh-bvh: the world is fully
 * procedural and its blockers are known as data (pine trunks = circles, the ven =
 * the waterline from `Biomes.heightAt`, the world edge = a radius). So a handful of
 * pure circle/march operations resolve every constraint with ZERO new dependency,
 * zero BVH build cost, and — crucially — full determinism, so the move is seed-
 * testable like every other render3d construct (§9e). It runs on the small
 * per-frame step (a few cm), so one or two pushout passes fully de-penetrate.
 *
 * Motion-comfort (§1e): collisions SLIDE (tangential), they never stop the ranger
 * dead or snap the camera — the tap-to-walk feel is preserved. Never-scary: you
 * simply can't walk through a tree, into deep water, or off the edge of the world.
 *
 * Pure + render-agnostic (no THREE import) so it carries its own seeded unit test.
 */

/** A soft blocker in the XZ plane: a circle (a pine trunk, a rock, …) or, with
 *  `box`, a building's real footprint (the cabin, the watchtower, the board …). */
export interface Obstacle {
  x: number;
  z: number;
  /** circle: the soft-collision radius (the ranger is kept this far from the centre).
   *  box: the radius of a circle around the whole keep-out shape, for readers that
   *  only know circles (always on the safe side). */
  r: number;
  /** D3.16: a tree trunk — its foliage fades as a crown, so the all-occluder
   *  camera sightline test skips it (it reports through the fade, not opaque). */
  tree?: boolean;
  /** Wave 2: an oriented rectangle footprint — half-extents `hx`/`hz` along its own
   *  x/z, turned `rot` about +y (three's rotation.y). The ranger keeps `pad` metres
   *  from it (the keep-out shape is the rectangle with rounded corners), so he slides
   *  along its walls and round its corners and never stands on a porch or between
   *  the watchtower's legs. */
  box?: { hx: number; hz: number; rot: number; pad: number };
  /** Wave 2: a tree whose foliage the follow camera must keep out of (see CameraRig):
   *  its kind (the GLB id), its height and the ground under it. */
  crown?: { kind: string; h: number; y: number };
}

/** The ranger's clearance from a building wall (m). */
export const WALL_PAD = 0.3;

/** A rectangle footprint obstacle (see `Obstacle.box`). */
export function boxObstacle(x: number, z: number, hx: number, hz: number, rot: number, pad = WALL_PAD): Obstacle {
  return { x, z, r: Math.hypot(hx, hz) + pad, box: { hx, hz, rot, pad } };
}

/** World offset (dx, dz) from a box's centre → its own x/z (undo rotation.y). */
function toLocal(b: NonNullable<Obstacle['box']>, dx: number, dz: number): [number, number] {
  const c = Math.cos(b.rot), s = Math.sin(b.rot);
  return [dx * c - dz * s, dx * s + dz * c];
}

/** Its own x/z → world offset (three's rotation.y). */
function toWorldOff(b: NonNullable<Obstacle['box']>, lx: number, lz: number): [number, number] {
  const c = Math.cos(b.rot), s = Math.sin(b.rot);
  return [lx * c + lz * s, -lx * s + lz * c];
}

/**
 * Signed distance (m) from (x, z) to the obstacle's keep-out edge grown by `grow`:
 * < 0 inside, > 0 outside. Circle: the radius; box: the rectangle + pad + grow.
 */
export function obstacleGap(o: Obstacle, x: number, z: number, grow = 0): number {
  if (!o.box) return Math.hypot(x - o.x, z - o.z) - (o.r + grow);
  const b = o.box;
  const [lx, lz] = toLocal(b, x - o.x, z - o.z);
  const qx = Math.abs(lx) - b.hx, qz = Math.abs(lz) - b.hz;
  const out = Math.hypot(Math.max(qx, 0), Math.max(qz, 0));
  const inside = Math.min(Math.max(qx, qz), 0);
  return out + inside - (b.pad + grow);
}

/**
 * The fraction t ∈ (0, 1] of the segment from (ox, oz) along (dx, dz) where it first
 * enters the obstacle's keep-out shape grown by `grow` (1 = it never does). When the
 * origin already stands in the grown shape only the bare keep-out shape counts, and
 * inside that the obstacle is ignored (the prop he stands at never collapses the
 * camera onto him). Boxes are tested as the rectangle grown by pad + grow (square
 * corners: a touch conservative, never a miss).
 */
export function segmentEntry(o: Obstacle, ox: number, oz: number, dx: number, dz: number, grow: number): number {
  let g = grow;
  if (obstacleGap(o, ox, oz, g) < 0) {
    if (obstacleGap(o, ox, oz, 0) < 0) return 1;
    g = 0;
  }
  if (!o.box) {
    const R = o.r + g;
    const a = dx * dx + dz * dz;
    if (a < 1e-12) return 1;
    const fx = ox - o.x, fz = oz - o.z;
    const b = 2 * (fx * dx + fz * dz), cc = fx * fx + fz * fz - R * R;
    const disc = b * b - 4 * a * cc;
    if (disc < 0) return 1;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    return t > 0 && t < 1 ? t : 1;
  }
  const bx = o.box;
  const ex = bx.hx + bx.pad + g, ez = bx.hz + bx.pad + g;
  const [px, pz] = toLocal(bx, ox - o.x, oz - o.z);
  const [vx, vz] = toLocal(bx, dx, dz);
  const span = slab(px, pz, vx, vz, ex, ez);
  return span && span[0] > 0 && span[0] < 1 ? span[0] : 1;
}

/** Ray p + t·v against the axis-aligned rectangle |x| ≤ ex, |z| ≤ ez: [tIn, tOut] or null. */
function slab(px: number, pz: number, vx: number, vz: number, ex: number, ez: number): [number, number] | null {
  let t0 = -Infinity, t1 = Infinity;
  for (const [p, v, e] of [[px, vx, ex], [pz, vz, ez]] as const) {
    if (Math.abs(v) < 1e-12) { if (p < -e || p > e) return null; continue; }
    let a = (-e - p) / v, b = (e - p) / v;
    if (a > b) [a, b] = [b, a];
    if (a > t0) t0 = a;
    if (b < t1) t1 = b;
    if (t0 > t1) return null;
  }
  return [t0, t1];
}

/**
 * Does the segment from (ax, az) to (bx, bz) pass through the obstacle's SOLID part
 * (the circle; the bare rectangle, no pad) between the fractions t0 and t1? The
 * sightline test a camera read-back uses: a circle by its closest approach (foot
 * parameter in (t0, t1)), a box by where the segment crosses the rectangle.
 */
export function segmentCrosses(o: Obstacle, ax: number, az: number, bx: number, bz: number, t0: number, t1: number): boolean {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  if (len2 < 1e-12) return false;
  if (!o.box) {
    const t = ((o.x - ax) * dx + (o.z - az) * dz) / len2;
    if (t <= t0 || t >= t1) return false;
    const gx = o.x - (ax + dx * t), gz = o.z - (az + dz * t);
    return gx * gx + gz * gz <= o.r * o.r;
  }
  const [px, pz] = toLocal(o.box, ax - o.x, az - o.z);
  const [vx, vz] = toLocal(o.box, dx, dz);
  const span = slab(px, pz, vx, vz, o.box.hx, o.box.hz);
  return !!span && span[1] > t0 && span[0] < t1;
}

export interface MoveLimits {
  /** circular world bound — the ranger is clamped within this radius of origin */
  bound: number;
  /**
   * True where the ranger may NOT stand (the submerged ven). A predicate — not a
   * global height threshold — so dry rolling troughs in the relief are never
   * mistaken for water (which would read as an invisible wall, breaking never-scary).
   */
  blocked?: (x: number, z: number) => boolean;
}

const EPS = 1e-6;

/**
 * Slide a single small step from (fx,fz) toward the desired (tx,tz), honouring soft
 * circular obstacles, a circular world bound, and a no-wade waterline. Returns the
 * resolved XZ. Pure + deterministic — same inputs always give the same output.
 */
export function resolveMove(
  fx: number,
  fz: number,
  tx: number,
  tz: number,
  obstacles: readonly Obstacle[],
  limits: MoveLimits,
): { x: number; z: number } {
  let x = tx;
  let z = tz;

  // 1) soft obstacle pushout — slide tangentially out to the obstacle's rim.
  //    Two passes so de-penetrating one circle can't leave us inside the next.
  for (let pass = 0; pass < 2; pass++) {
    for (const o of obstacles) {
      if (o.box) { [x, z] = pushOutOfBox(o, x, z, fx, fz); continue; }
      const ox = x - o.x;
      const oz = z - o.z;
      const d = Math.hypot(ox, oz);
      if (d >= o.r) continue;
      if (d > EPS) {
        // push straight out along the contact normal → the residual motion is
        // tangential to the circle = a natural slide around the trunk
        x = o.x + (ox / d) * o.r;
        z = o.z + (oz / d) * o.r;
      } else {
        // standing exactly on the centre: push back along the way we came in
        const ix = o.x - fx;
        const iz = o.z - fz;
        const il = Math.hypot(ix, iz) || 1;
        x = o.x - (ix / il) * o.r;
        z = o.z - (iz / il) * o.r;
      }
    }
  }

  // 2) circular world bound — clamp back onto the rim (still slides along it)
  const r = Math.hypot(x, z);
  if (r > limits.bound) {
    x = (x / r) * limits.bound;
    z = (z / r) * limits.bound;
  }

  // 3) no-wade waterline — if the resolved spot is in the water, fall back to the
  //    last dry point along from→resolved (the shoreline stays walkable; the ranger
  //    simply can't step down into the ven).
  const blocked = limits.blocked;
  if (blocked && blocked(x, z)) {
    const STEPS = 6;
    let safeX = fx;
    let safeZ = fz;
    for (let i = 1; i <= STEPS; i++) {
      const s = i / STEPS;
      const px = fx + (x - fx) * s;
      const pz = fz + (z - fz) * s;
      if (blocked(px, pz)) break;
      safeX = px;
      safeZ = pz;
    }
    x = safeX;
    z = safeZ;
  }

  return { x, z };
}

/**
 * Push (x, z) out of a box obstacle's keep-out shape (the rectangle + pad, rounded
 * corners) along the contact normal, so the residual motion slides along the wall
 * or round the corner. A point that somehow sits inside the rectangle itself leaves
 * by the nearest wall (or, dead centre, back the way it came from (fx, fz)).
 */
function pushOutOfBox(o: Obstacle, x: number, z: number, fx: number, fz: number): [number, number] {
  const b = o.box!;
  let [lx, lz] = toLocal(b, x - o.x, z - o.z);
  const qx = Math.max(-b.hx, Math.min(b.hx, lx)), qz = Math.max(-b.hz, Math.min(b.hz, lz));
  const ox = lx - qx, oz = lz - qz;
  const d = Math.hypot(ox, oz);
  if (d >= b.pad) return [x, z];            // clear of the wall
  if (d > EPS) {                             // in the padding: out along the normal
    lx = qx + (ox / d) * b.pad;
    lz = qz + (oz / d) * b.pad;
  } else {                                   // inside the rectangle: leave by the nearest wall
    const px = b.hx - Math.abs(lx), pz = b.hz - Math.abs(lz);
    if (Math.abs(px - pz) < EPS && Math.abs(lx) < EPS && Math.abs(lz) < EPS) {
      const [fl, fm] = toLocal(b, fx - o.x, fz - o.z); // dead centre: back toward where we came from
      if (Math.abs(fl) / b.hx >= Math.abs(fm) / b.hz) lx = (fl >= 0 ? 1 : -1) * (b.hx + b.pad);
      else lz = (fm >= 0 ? 1 : -1) * (b.hz + b.pad);
    } else if (px < pz) lx = (lx >= 0 ? 1 : -1) * (b.hx + b.pad);
    else lz = (lz >= 0 ? 1 : -1) * (b.hz + b.pad);
  }
  const [wx, wz] = toWorldOff(b, lx, lz);
  return [o.x + wx, o.z + wz];
}
