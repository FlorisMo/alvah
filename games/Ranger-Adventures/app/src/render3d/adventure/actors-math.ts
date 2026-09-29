/**
 * actors-math.ts — the pure parts of the adventure's animals (THREE-free, unit-tested
 * in actors.test.ts): how an animal turns and steps toward where it goes, how it keeps
 * its gap behind the ranger, and the procedural trot of a static mesh.
 *
 * Calm by construction: an animal only walks the way it faces (it turns first, at a
 * limited rate, never strafes), it slows into its spot, and a follower never backs
 * into the ranger or walks up to his face.
 */

/** Where an animal is and which way it faces (a heading: it looks along (sin, cos)). */
export interface Pose { x: number; z: number; yaw: number }

/** Wrap an angle to (−π, π]. */
export function wrap(a: number): number {
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
}

/** Turn `from` toward `to` by at most `max` rad (the short way). */
export function turnToward(from: number, to: number, max: number): number {
  const d = wrap(to - from);
  return wrap(from + Math.max(-max, Math.min(max, d)));
}

export interface StepOpts {
  /** the pace it wants (m/s) */
  speed: number;
  /** how fast it turns (rad/s) */
  turnRate: number;
  /** it slows down inside this distance of the goal (m), so it settles instead of stopping dead */
  ease?: number;
}

/**
 * One frame of walking toward (tx, tz): turn toward it (rate-limited), then step along
 * the facing — slower while the goal is off to the side, so a sharp turn is made on the
 * spot, and slower close in. Returns the new pose and the ground speed it walked at.
 * The caller resolves the step against the world's solids.
 */
export function stepToward(p: Pose, tx: number, tz: number, dt: number, o: StepOpts): { pose: Pose; speed: number; left: number } {
  const dx = tx - p.x, dz = tz - p.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-4) return { pose: { ...p }, speed: 0, left: 0 };
  const want = Math.atan2(dx, dz);
  const yaw = turnToward(p.yaw, want, o.turnRate * dt);
  const along = Math.max(0, Math.cos(wrap(want - yaw)));
  const ease = o.ease ?? 0.6;
  const slow = d < ease ? 0.35 + 0.65 * (d / ease) : 1;
  const v = o.speed * along * along * slow;
  const step = Math.min(d, v * dt);
  return {
    pose: { x: p.x + Math.sin(yaw) * step, z: p.z + Math.cos(yaw) * step, yaw },
    speed: dt > 0 ? step / dt : 0,
    left: d - step,
  };
}

/** Where a follower wants to stand: `gap` m from the leader, on its own side of him
 *  (on the line from the leader to itself), so it trails after him and never cuts in
 *  front of his face. */
export function followSpot(follower: { x: number; z: number }, leader: { x: number; z: number }, gap: number): { x: number; z: number; d: number } {
  const dx = follower.x - leader.x, dz = follower.z - leader.z;
  const d = Math.hypot(dx, dz) || 1e-6;
  return { x: leader.x + (dx / d) * gap, z: leader.z + (dz / d) * gap, d };
}

/** The follower's pace (m/s): it matches the leader and closes the gap it lost, up to
 *  `max`; inside the gap (+ a little slack) it stands. */
export function followSpeed(d: number, gap: number, leaderSpeed: number, max: number): number {
  const slack = 0.35;
  if (d <= gap + slack) return 0;
  return Math.min(max, leaderSpeed * 1.05 + (d - gap - slack) * 0.9 + 0.25);
}

/**
 * Is the ranger running? The run gait flag, or (whatever speeds the FEEL lane picks)
 * a ground speed clearly above a walk: "running" = above ~1.25× the walk speed. The
 * walk is ≤ 2.5 m/s in every tuning, so 3.1 m/s is always a run.
 */
export function isRunning(m: { speed: number; running?: boolean }, walk = 2.5): boolean {
  return !!m.running || m.speed > walk * 1.25;
}

/** A procedural trot for a static mesh (the boar, the piglet): the body bobs twice a
 *  stride and rolls a little from side to side; at rest nothing (the breathing recipe
 *  takes over). Heights in metres, angles in radians, all within the calm ceilings. */
export interface Gait { dy: number; roll: number; pitch: number }

/** How many metres one stride takes for an animal `h` m tall (a trot: ≈ 1.4 × its height). */
export function strideOf(h: number): number {
  return Math.max(0.3, h * 1.4);
}

/** The trot at stride phase `phase` (rad) and pace `speed` (m/s) for an animal `h` m tall. */
export function trot(phase: number, speed: number, h: number): Gait {
  const k = Math.min(1, speed / Math.max(0.3, h * 2.2)); // 0 standing → 1 at a brisk trot
  const bob = Math.min(0.06, h * 0.07) * k;
  return {
    dy: bob * Math.abs(Math.sin(phase)),
    roll: Math.min(0.1, 0.06 + h * 0.02) * k * Math.sin(phase),
    pitch: 0.035 * k * Math.sin(phase * 2),
  };
}

/** Rooting: the head goes down to the ground and nudges; `t` in seconds. 0..1 dip. */
export function rootDip(t: number, phase: number): number {
  const a = Math.sin(t * 1.3 + phase) * 0.5 + 0.5;
  const nudge = 0.2 * Math.sin(t * 5.1 + phase * 2);
  return Math.max(0, Math.min(1, 0.55 + 0.35 * a + nudge * a));
}

/** The nearest spot of `spots` to (x, z) that keeps at least `awayFrom.d` m from
 *  `awayFrom` (a frightened animal never hides next to what frightened it). */
export function nearestAway<T extends { x: number; z: number }>(
  x: number, z: number, spots: readonly T[], awayFrom?: { x: number; z: number; d: number },
): T | null {
  let best: T | null = null, bd = Infinity;
  for (const s of spots) {
    if (awayFrom && Math.hypot(s.x - awayFrom.x, s.z - awayFrom.z) < awayFrom.d) continue;
    const d = Math.hypot(s.x - x, s.z - z);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}
