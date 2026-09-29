/**
 * squirrel-math.ts — the pure maths of a LIVELY squirrel (THREE-free, unit-tested in
 * squirrel.test.ts). The squirrel model is one static mesh (no rig), so every bit of its
 * life is procedural: dash-stop-dash bursts over the forest floor, a spiral run up or
 * down a trunk with its belly to the bark, a low arc leaping from a branch to the next
 * tree, sitting up on a branch, digging, sniffing.
 *
 * A move is a PLAN: a list of timed segments, each a pose as a function of its own
 * progress (0..1). squirrel.ts plays a plan frame by frame and adds the small things on
 * top (breath, a tail flick, the digging paws). The rules a child's eye needs are built
 * in here, and pinned by the tests:
 *
 *   - readable: fast but short bursts (≤ 3 m/s on the ground, ≤ 1.7 m/s on a trunk,
 *     ≤ 4.2 m/s through the air), every burst at least a quarter of a second, a stop
 *     between bursts where it sits up and looks round;
 *   - never at the camera: a dash whose straight line would bring it nearer the lens is
 *     bent out sideways, so it never runs AT the child;
 *   - on the bark: a trunk run stays on the trunk's surface (the tree's own measured
 *     radius at that height), belly to the bark, head up going up and head down coming
 *     down, as a squirrel runs.
 *
 * Conventions (the World's): a heading `h` looks along (sin h, cos h). `alt` is the
 * height (m) of the squirrel's feet above the ground under it.
 */

/** Where the squirrel is and how its body is turned. The mesh sits UP (its face and
 *  belly along its local +z, its head up +y): `pitch` tips the head forward (a run, a
 *  leap), `roll` turns it about its own belly axis (π: head down on a trunk). */
export interface SqPose {
  x: number;
  z: number;
  /** feet above the ground (m) */
  alt: number;
  yaw: number;
  pitch: number;
  roll: number;
  /** what it is doing now (squirrel.ts adds the matching small motion) */
  act: SqAct;
}

export type SqAct = 'sit' | 'run' | 'climb' | 'cling' | 'leap' | 'dig' | 'sniff' | 'eat';

/** One timed piece of a plan: its pose at its own progress `u` (0..1). */
export interface Segment {
  dur: number;
  at(u: number): SqPose;
  /** metres travelled (for the speed rules) */
  len: number;
  act: SqAct;
}

/** A tree the squirrel runs on: its trunk axis at (x, z), height H, the kind of tree. */
export interface Trunk { x: number; z: number; H: number; species: TrunkSpecies }
export type TrunkSpecies = 'prop-oak-tree' | 'prop-pine-scots' | 'prop-birch-tree';

/**
 * The bark's radius up the trunk, as fractions of the tree's height: measured off the
 * tree GLBs as the forest draws them (per 2 % of the height, the median distance of the
 * trunk's vertices from its axis, 2026-09-29). Above the last row the crown begins.
 */
export const TRUNK_PROFILE: Readonly<Record<TrunkSpecies, readonly (readonly [number, number])[]>> = {
  'prop-oak-tree': [[0, 0.07], [0.03, 0.062], [0.06, 0.055], [0.09, 0.047], [0.13, 0.048], [0.18, 0.05]],
  'prop-pine-scots': [[0, 0.045], [0.03, 0.031], [0.06, 0.027], [0.12, 0.027], [0.2, 0.023], [0.3, 0.022], [0.42, 0.02]],
  'prop-birch-tree': [[0, 0.03], [0.05, 0.024], [0.12, 0.024], [0.2, 0.022], [0.3, 0.02]],
};

/** The bark's radius (m) at `h` m up a trunk. */
export function barkRadius(t: Trunk, h: number): number {
  const rows = TRUNK_PROFILE[t.species];
  const f = Math.max(0, h / t.H);
  if (f <= rows[0][0]) return rows[0][1] * t.H;
  for (let i = 1; i < rows.length; i++) {
    if (f <= rows[i][0]) {
      const [f0, r0] = rows[i - 1], [f1, r1] = rows[i];
      return (r0 + ((f - f0) / (f1 - f0)) * (r1 - r0)) * t.H;
    }
  }
  return rows[rows.length - 1][1] * t.H;
}

/** Speed ceilings (m/s) and the shortest readable burst (s). */
export const SQ = {
  run: 2.6,      // a dash over the forest floor
  climb: 1.5,    // along the bark
  leap: 3.6,     // through the air (horizontal)
  minBurst: 0.26,
  /** how far a dash burst goes before it stops to look (m) */
  burst: [0.7, 1.4] as readonly [number, number],
  /** how long it stops between two bursts (s) */
  stop: [0.28, 0.55] as readonly [number, number],
  /** its feet off the bark (m): it clings, never sinks in */
  clear: 0.035,
  /** the body tipped forward while it runs (rad) */
  runPitch: 1.05,
  /** leaning back against the bark while it climbs (rad) */
  cling: -0.18,
} as const;

/** Wrap an angle to (−π, π]. */
export function wrap(a: number): number {
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const smooth = (t: number): number => t * t * (3 - 2 * t);
/** A burst: a quick start, a quick stop (never an instant jump). */
const burstEase = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));

/** A small deterministic random stream (the same squirrel every load). */
export function sqStream(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/* --------------------------------------------------------------- still ---- */

/** Holding still in a pose (sitting up, clinging, digging) for `dur` s. */
export function hold(p: SqPose, dur: number, act: SqAct = p.act): Segment {
  const q = { ...p, act };
  return { dur, len: 0, act, at: () => q };
}

/** Turn on the spot to face `yaw` (sitting), quickly but not instantly. */
export function turn(p: SqPose, yaw: number): Segment {
  const d = wrap(yaw - p.yaw);
  const dur = Math.max(0.12, Math.abs(d) / 9);
  return { dur, len: 0, act: 'sit', at: (u) => ({ ...p, yaw: p.yaw + d * smooth(u), pitch: lerp(p.pitch, 0, smooth(u)), act: 'sit' }) };
}

/* -------------------------------------------------------------- ground ---- */

/**
 * Dash-stop-dash over the ground from `from` to (tx, tz): bursts of ~1 m at up to
 * `SQ.run`, each a low bounding run with its body tipped forward, then a short stop
 * where it sits up and looks. With `lens`, a straight line that would bring it nearer
 * the lens is bent out to the side (it runs round, never at the child).
 */
export function dashPlan(from: SqPose, tx: number, tz: number, rnd: () => number, lens?: { x: number; z: number }, avoid?: { x: number; z: number; r: number }): Segment[] {
  const pts = dashPath(from, tx, tz, lens, avoid);
  const out: Segment[] = [];
  let p: SqPose = { ...from, alt: 0, roll: 0 };
  for (let k = 1; k < pts.length; k++) {
    const goal = pts[k];
    let left = Math.hypot(goal.x - p.x, goal.z - p.z);
    while (left > 0.02) {
      const step = Math.min(left, lerp(SQ.burst[0], SQ.burst[1], rnd()));
      // a very short last piece joins the burst before it (no hesitant 10 cm hops)
      const take = left - step < 0.3 ? left : step;
      const yaw = Math.atan2(goal.x - p.x, goal.z - p.z);
      if (Math.abs(wrap(yaw - p.yaw)) > 0.2) out.push(turn(p, yaw));
      const a = { ...p, yaw };
      const b = { x: a.x + Math.sin(yaw) * take, z: a.z + Math.cos(yaw) * take };
      const dur = Math.max(SQ.minBurst, take / (SQ.run * (0.82 + 0.18 * rnd())));
      const bounds = Math.max(1, Math.round(take / 0.34)); // one bound per ~34 cm
      out.push({
        dur, len: take, act: 'run',
        at: (u) => {
          const e = burstEase(u);
          const hop = Math.abs(Math.sin(u * bounds * Math.PI)) * 0.05 * Math.min(1, u * 6, (1 - u) * 6);
          return {
            x: lerp(a.x, b.x, e), z: lerp(a.z, b.z, e), alt: hop, yaw,
            // the body tips forward as it runs and comes up again as it stops
            pitch: SQ.runPitch * Math.min(1, u * 5, (1 - u) * 3.5) + 0.12 * Math.sin(u * bounds * Math.PI * 2),
            roll: 0, act: 'run',
          };
        },
      });
      p = { ...a, x: b.x, z: b.z, alt: 0, pitch: 0, act: 'sit' };
      left = Math.hypot(goal.x - p.x, goal.z - p.z);
      // a stop to look (not after the last burst: the caller decides what comes next)
      if (left > 0.02 || k < pts.length - 1) out.push(hold(p, lerp(SQ.stop[0], SQ.stop[1], rnd()), 'sit'));
    }
  }
  return out;
}

/** One quick dash straight to (tx, tz): a turn to face it, then a single burst (no stops
 *  on the way). The show's pace: an animal going from spot to spot in one go. */
export function dashDirectPlan(from: SqPose, tx: number, tz: number): Segment[] {
  const d = Math.hypot(tx - from.x, tz - from.z);
  const p: SqPose = { ...from, alt: 0, roll: 0 };
  if (d < 0.03) return [hold(p, 0.05)];
  const yaw = Math.atan2(tx - p.x, tz - p.z);
  const out: Segment[] = [];
  if (Math.abs(wrap(yaw - p.yaw)) > 0.2) out.push(turn(p, yaw));
  const dur = Math.max(SQ.minBurst, d / (SQ.run * 0.92));
  const bounds = Math.max(1, Math.round(d / 0.34));
  out.push({
    dur, len: d, act: 'run',
    at: (u) => {
      const e = burstEase(u);
      const hop = Math.abs(Math.sin(u * bounds * Math.PI)) * 0.05 * Math.min(1, u * 6, (1 - u) * 6);
      return {
        x: lerp(p.x, tx, e), z: lerp(p.z, tz, e), alt: hop, yaw,
        pitch: SQ.runPitch * Math.min(1, u * 5, (1 - u) * 3.5) + 0.12 * Math.sin(u * bounds * Math.PI * 2),
        roll: 0, act: 'run',
      };
    },
  });
  out.push(hold({ ...p, x: tx, z: tz, yaw, pitch: 0, act: 'sit' }, 0.06, 'sit'));
  return out;
}

/** The corner points of a dash: straight, or bent out sideways when the straight line
 *  would bring it nearer the lens than where it starts (and ends). */
export function dashPath(
  from: { x: number; z: number }, tx: number, tz: number,
  lens?: { x: number; z: number }, avoid?: { x: number; z: number; r: number },
): { x: number; z: number }[] {
  const straight = [{ x: from.x, z: from.z }, { x: tx, z: tz }];
  // round someone standing in the way (the ranger: a wild squirrel never runs over his
  // feet) — unless it starts or ends by him
  if (avoid && Math.hypot(from.x - avoid.x, from.z - avoid.z) > avoid.r && Math.hypot(tx - avoid.x, tz - avoid.z) > avoid.r
    && nearestOnSeg(avoid, from, { x: tx, z: tz }) < avoid.r) {
    const dx = tx - from.x, dz = tz - from.z;
    const l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((avoid.x - from.x) * dx + (avoid.z - from.z) * dz) / l2));
    const cx = from.x + dx * t, cz = from.z + dz * t;
    let ox = cx - avoid.x, oz = cz - avoid.z;
    let ol = Math.hypot(ox, oz);
    if (ol < 1e-3) { ox = -dz; oz = dx; ol = Math.hypot(ox, oz) || 1; } // (straight through him: go round his left)
    const corner = { x: avoid.x + (ox / ol) * (avoid.r + 0.35), z: avoid.z + (oz / ol) * (avoid.r + 0.35) };
    return [{ x: from.x, z: from.z }, corner, { x: tx, z: tz }];
  }
  if (!lens) return straight;
  const d0 = Math.hypot(from.x - lens.x, from.z - lens.z);
  const d1 = Math.hypot(tx - lens.x, tz - lens.z);
  const floor = Math.min(d0, d1);
  if (nearestOnSeg(lens, from, { x: tx, z: tz }) >= floor - 0.05) return straight;
  // the segment dips toward the lens: go round by a corner on the far side of the line
  const mx = (from.x + tx) / 2, mz = (from.z + tz) / 2;
  let ox = mx - lens.x, oz = mz - lens.z;
  const ol = Math.hypot(ox, oz) || 1;
  ox /= ol; oz /= ol;
  const need = floor - Math.hypot(mx - lens.x, mz - lens.z) + 0.15;
  const corner = { x: mx + ox * Math.max(0, need), z: mz + oz * Math.max(0, need) };
  return [{ x: from.x, z: from.z }, corner, { x: tx, z: tz }];
}

/** Distance from `p` to the segment a–b. */
function nearestOnSeg(p: { x: number; z: number }, a: { x: number; z: number }, b: { x: number; z: number }): number {
  const dx = b.x - a.x, dz = b.z - a.z;
  const l2 = dx * dx + dz * dz;
  const t = l2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2));
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
}

/* --------------------------------------------------------------- trunk ---- */

/** Where on a trunk: round it (`ang`, the heading from the axis out to the squirrel) and up it (`h`, m). */
export interface OnTrunk { ang: number; h: number }

/** The pose clinging to a trunk at `at`: belly to the bark, head up (or down). */
export function trunkPose(t: Trunk, at: OnTrunk, headUp: boolean, act: SqAct = 'cling'): SqPose {
  const r = barkRadius(t, at.h) + SQ.clear;
  return {
    x: t.x + Math.sin(at.ang) * r,
    z: t.z + Math.cos(at.ang) * r,
    alt: at.h,
    yaw: wrap(at.ang + Math.PI), // facing the trunk
    pitch: SQ.cling,
    roll: headUp ? 0 : Math.PI,
    act,
  };
}

/**
 * A spiral run along the bark from `a` to `b` (round the trunk by the short or the long
 * way: `turns` extra half-turns), head first: head up going up, head down coming down.
 */
export function climbPlan(t: Trunk, a: OnTrunk, b: OnTrunk, halfTurns = 0): Segment[] {
  const up = b.h >= a.h;
  let da = wrap(b.ang - a.ang);
  if (halfTurns) da += Math.sign(da || 1) * halfTurns * Math.PI;
  const rMid = barkRadius(t, (a.h + b.h) / 2) + SQ.clear;
  const len = Math.hypot(b.h - a.h, da * rMid);
  const dur = Math.max(SQ.minBurst, len / SQ.climb);
  return [{
    dur, len, act: 'climb',
    at: (u) => {
      const e = burstEase(u);
      return trunkPose(t, { ang: a.ang + da * e, h: lerp(a.h, b.h, e) }, up, 'climb');
    },
  }];
}

/** From the ground at the foot of a trunk (facing it) onto the bark: a small hop up. */
export function mountPlan(from: SqPose, t: Trunk, at: OnTrunk): Segment[] {
  const on = trunkPose(t, at, true, 'climb');
  const dur = 0.3;
  return [{
    dur, len: Math.hypot(on.x - from.x, on.z - from.z) + at.h, act: 'climb',
    at: (u) => {
      const e = smooth(u);
      return { x: lerp(from.x, on.x, e), z: lerp(from.z, on.z, e), alt: lerp(from.alt, on.alt, e) + Math.sin(u * Math.PI) * 0.05, yaw: from.yaw + wrap(on.yaw - from.yaw) * e, pitch: lerp(SQ.runPitch * 0.6, on.pitch, e), roll: 0, act: 'climb' };
    },
  }];
}

/** Off the bark, head first, onto the ground a little out from the trunk. */
export function dismountPlan(t: Trunk, at: OnTrunk, out = 0.35): Segment[] {
  const on = trunkPose(t, at, false, 'climb');
  const r = barkRadius(t, 0) + out;
  const g = { x: t.x + Math.sin(at.ang) * r, z: t.z + Math.cos(at.ang) * r };
  const yaw = at.ang; // facing out, away from the trunk
  return [{
    dur: 0.32, len: Math.hypot(g.x - on.x, g.z - on.z) + at.h, act: 'run',
    at: (u) => {
      const e = smooth(u);
      // it pours off the bark: from head-down (roll π) to running out (pitched forward)
      return { x: lerp(on.x, g.x, e), z: lerp(on.z, g.z, e), alt: lerp(on.alt, 0, e), yaw: e < 0.5 ? on.yaw : yaw, pitch: e < 0.5 ? on.pitch : SQ.runPitch * (1 - e) * 1.6, roll: e < 0.5 ? Math.PI : 0, act: 'run' };
    },
  }];
}

/* ---------------------------------------------------------------- leap ---- */

/**
 * A low leap through the air from pose `a` to pose `b` (a branch to the bark of the next
 * tree): a smooth arc a little above both ends, the body stretched along the flight.
 * Readable: never faster than `SQ.leap` across the ground, never shorter than 0.4 s.
 */
export function leapPlan(a: SqPose, b: SqPose): Segment[] {
  const d = Math.hypot(b.x - a.x, b.z - a.z);
  const dur = Math.max(0.4, d / SQ.leap);
  const apex = Math.min(0.9, 0.18 + d * 0.16);
  const yaw = Math.atan2(b.x - a.x, b.z - a.z);
  return [{
    dur, len: d, act: 'leap',
    at: (u) => {
      const alt = lerp(a.alt, b.alt, u) + apex * 4 * u * (1 - u);
      // the body follows the flight: nose up on the rise, level at the top, down to land
      const slope = (b.alt - a.alt) / Math.max(0.3, d) + apex * 4 * (1 - 2 * u) / Math.max(0.3, d);
      const flight = Math.PI / 2 - Math.atan(slope); // 0 = straight up, π/2 = level
      const e = smooth(Math.min(1, u * 4));
      const land = smooth(Math.max(0, (u - 0.8) / 0.2));
      return {
        x: lerp(a.x, b.x, u), z: lerp(a.z, b.z, u), alt,
        yaw: u < 0.8 ? yaw : yaw + wrap(b.yaw - yaw) * land,
        pitch: lerp(lerp(a.pitch, flight, e), b.pitch, land),
        roll: u < 0.85 ? lerp(a.roll, 0, e) : b.roll,
        act: 'leap',
      };
    },
  }];
}

/* ------------------------------------------------------------ the plans ---- */

/** A plan's total time (s). */
export function planTime(plan: readonly Segment[]): number {
  return plan.reduce((s, g) => s + g.dur, 0);
}

/** The pose `t` s into a plan (the last pose once it is over). */
export function poseAt(plan: readonly Segment[], t: number): SqPose {
  let left = t;
  for (const g of plan) {
    if (left <= g.dur) return g.at(g.dur > 0 ? left / g.dur : 1);
    left -= g.dur;
  }
  const last = plan[plan.length - 1];
  return last.at(1);
}

/** The fastest a plan moves in each kind of move (m/s), for the readability rules. */
export function topSpeeds(plan: readonly Segment[]): { run: number; climb: number; leap: number; shortest: number } {
  const out = { run: 0, climb: 0, leap: 0, shortest: Infinity };
  for (const g of plan) {
    if (g.len <= 0) continue;
    out.shortest = Math.min(out.shortest, g.dur);
    const v = g.len / g.dur;
    if (g.act === 'run') out.run = Math.max(out.run, v);
    else if (g.act === 'climb') out.climb = Math.max(out.climb, v);
    else if (g.act === 'leap') out.leap = Math.max(out.leap, v);
  }
  return out;
}

/* ------------------------------------------------------------ the flick ---- */

/** A tail flick `s` s after it started: 0..1 how far the tail is up (a quick lift, a
 *  softer fall). 0 before and after. */
export function flick(s: number, dur = 0.42): number {
  if (s <= 0 || s >= dur) return 0;
  const u = s / dur;
  return u < 0.3 ? smooth(u / 0.3) : 1 - smooth((u - 0.3) / 0.7);
}

/** Digging: the little up-and-down of its front paws `s` s into a dig (m). */
export function digBob(s: number): number {
  return 0.012 * Math.abs(Math.sin(s * 22)) * Math.min(1, s * 4);
}
