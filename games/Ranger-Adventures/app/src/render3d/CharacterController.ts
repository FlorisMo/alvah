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

/** A soft circular blocker in the XZ plane (a pine trunk, a rock, …). */
export interface Obstacle {
  x: number;
  z: number;
  /** soft-collision radius — the ranger is kept this far from the centre */
  r: number;
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
