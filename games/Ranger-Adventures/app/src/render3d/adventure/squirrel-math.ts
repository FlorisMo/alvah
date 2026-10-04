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
  /** run 7 (ek-day, additive): how far its tail is bent while this piece plays (a flick's
   *  lift is 0.55; + curls it up and forward over its back, − stretches it back), at the
   *  piece's own progress `u` — an antic grooming its tail, a sunning stretch. None: at rest
   *  (a flick still rides on top). Never copied into a later piece's pose. */
  tail?: (u: number) => number;
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
  // the straight line dips toward the lens: go round it instead, on a gentle spiral from
  // the start's distance to the end's (so it never comes nearer than the nearer end)
  const a0 = Math.atan2(from.x - lens.x, from.z - lens.z), a1 = Math.atan2(tx - lens.x, tz - lens.z);
  const da = wrap(a1 - a0);
  const n = Math.max(2, Math.ceil(Math.abs(da) / 0.26));
  const pts = [{ x: from.x, z: from.z }];
  for (let i = 1; i < n; i++) {
    const u = i / n;
    const a = a0 + da * u, r = d0 + (d1 - d0) * u + 0.15 * Math.sin(u * Math.PI);
    pts.push({ x: lens.x + Math.sin(a) * r, z: lens.z + Math.cos(a) * r });
  }
  pts.push({ x: tx, z: tz });
  return pts;
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
 * `minDur`: never quicker than that (a calm slip round, hide-and-seek).
 */
export function climbPlan(t: Trunk, a: OnTrunk, b: OnTrunk, halfTurns = 0, minDur: number = SQ.minBurst): Segment[] {
  const up = b.h >= a.h;
  let da = wrap(b.ang - a.ang);
  if (halfTurns) da += Math.sign(da || 1) * halfTurns * Math.PI;
  const rMid = barkRadius(t, (a.h + b.h) / 2) + SQ.clear;
  const len = Math.hypot(b.h - a.h, da * rMid);
  const dur = Math.max(minDur, len / SQ.climb);
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
  const apex = Math.min(0.6, 0.12 + d * 0.12);
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

/** Run 7 (ek-day): the tail's held bend `t` s into a plan (0 where a piece holds none). */
export function tailAt(plan: readonly Segment[], t: number): number {
  let left = t;
  for (const g of plan) {
    if (left <= g.dur) return g.tail ? g.tail(g.dur > 0 ? left / g.dur : 1) : 0;
    left -= g.dur;
  }
  const last = plan[plan.length - 1];
  return last?.tail ? last.tail(1) : 0;
}

/* ------------------------------------------------------------ its antics ---- */

/**
 * Run 7 (ek-day, design §6.8): what the squirrel does on its stub while he comes — its
 * day, so no wait is like the one before. Each is a pure plan from where it sits (`p`) back
 * to sitting up facing him (`face`): it never leaves its seat (no step toward anything, so
 * never toward the lens), never faster than a calm move, 1.5-3 s long (squirrel.test):
 *
 *   kijken    — it looks round, this way and that, chin up, and flicks its tail
 *   poetsen   — it turns aside and bends to its tail (curled forward round to its paws),
 *               grooming it with quick little bobs, one side then the other
 *   knabbelen — it sits up turning a pine cone in its paws, nibbling (squirrel.ts holds the
 *               cone, the home lets the stripped scales fall: the gnawed cones' story)
 *   zonnen    — it lies down flat along its branch (`along`: the way the stub points), its
 *               tail stretched out, and breathes slowly in the sun (a home allows it only in
 *               a sunny light)
 *   mopperen  — it scolds: stamps its feet, its tail flicking, bob after bob (the
 *               adventure lets it chatter with it)
 */
export type AnticKind = 'kijken' | 'poetsen' | 'knabbelen' | 'zonnen' | 'mopperen';
export const ANTIC_KINDS: readonly AnticKind[] = ['kijken', 'poetsen', 'knabbelen', 'zonnen', 'mopperen'];

/** A calm turn of the body where it sits (its seat, its roll kept): `to` over `dur` s, its
 *  tail eased from `tail[0]` to `tail[1]`. */
function settle(from: SqPose, to: Partial<Pick<SqPose, 'yaw' | 'pitch' | 'alt'>>, dur: number, act: SqAct, tail: readonly [number, number] = [0, 0]): Segment {
  const yaw1 = to.yaw ?? from.yaw, pitch1 = to.pitch ?? from.pitch, alt1 = to.alt ?? from.alt;
  const dy = wrap(yaw1 - from.yaw);
  return {
    dur, len: 0, act,
    at: (u) => { const e = smooth(u); return { ...from, yaw: from.yaw + dy * e, pitch: lerp(from.pitch, pitch1, e), alt: lerp(from.alt, alt1, e), act }; },
    tail: (u) => lerp(tail[0], tail[1], smooth(u)),
  };
}

/** Holding a pose `dur` s with a small motion on it (`wob(s)`: what it adds at `s` s in). */
function wobble(p: SqPose, dur: number, act: SqAct, wob: (s: number) => Partial<Pick<SqPose, 'yaw' | 'pitch' | 'alt'>>, tail: (s: number) => number): Segment {
  return {
    dur, len: 0, act,
    at: (u) => { const w = wob(u * dur); return { ...p, yaw: p.yaw + (w.yaw ?? 0), pitch: p.pitch + (w.pitch ?? 0), alt: p.alt + (w.alt ?? 0), act }; },
    tail: (u) => tail(u * dur),
  };
}

/** A piece that also moves it a few centimetres over its seat, from `a` to `b` (lying down
 *  along its branch: its body lies ahead of its feet). */
function slide(g: Segment, a: { x: number; z: number }, b: { x: number; z: number }): Segment {
  return { ...g, at: (u) => { const e = smooth(u); return { ...g.at(u), x: lerp(a.x, b.x, e), z: lerp(a.z, b.z, e) }; } };
}

/** The end of a piece (its last pose). */
const endOf = (g: Segment): SqPose => g.at(1);

export function anticPlan(kind: AnticKind, p: SqPose, face: number, o: { along?: number } = {}): Segment[] {
  const sit: SqPose = { ...p, act: 'sit' };
  const out: Segment[] = [];
  const push = (g: Segment): SqPose => { out.push(g); return endOf(g); };
  let at = sit;
  if (kind === 'kijken') {
    at = push(settle(at, { yaw: face + 0.75, pitch: -0.08 }, Math.max(0.3, Math.abs(wrap(face + 0.75 - at.yaw)) / 5), 'sit'));
    at = push(wobble(at, 0.55, 'sit', () => ({}), () => 0));
    at = push(settle(at, { yaw: face - 0.7 }, 0.42, 'sit'));
    at = push(wobble(at, 0.5, 'sit', () => ({}), () => 0));
    at = push(settle(at, { yaw: face, pitch: 0 }, 0.3, 'sit'));
    // (a flick as it turns back to him)
    push(wobble(at, 0.42, 'sit', () => ({}), (s) => flick(s) * 0.55));
  } else if (kind === 'poetsen') {
    const curl = 0.85;
    const groom = (dur: number) => wobble(at, dur, 'sit', (s) => ({ pitch: 0.07 * Math.sin(s * Math.PI * 2 * 4.5), yaw: 0.05 * Math.sin(s * Math.PI * 2 * 2.2) }), (s) => curl + 0.08 * Math.sin(s * Math.PI * 2 * 2.2));
    at = push(settle(at, { yaw: face + 0.85, pitch: 0.5 }, Math.max(0.36, Math.abs(wrap(face + 0.85 - at.yaw)) / 5), 'sit', [0, curl]));
    at = push(groom(0.85));
    at = push(settle(at, { yaw: face - 0.85 }, 0.38, 'sit', [curl, curl]));
    at = push(groom(0.65));
    push(settle(at, { yaw: face, pitch: 0 }, 0.36, 'sit', [curl, 0]));
  } else if (kind === 'knabbelen') {
    // (act 'eat': squirrel.ts adds the nibbling bob and holds the cone in its paws)
    const turnCone = (dur: number) => wobble(at, dur, 'eat', (s) => ({ yaw: 0.13 * Math.sin(s * Math.PI * 2 * 1.5) }), () => 0.12);
    at = push(settle(at, { yaw: face + 0.35, pitch: 0.12 }, Math.max(0.26, Math.abs(wrap(face + 0.35 - at.yaw)) / 5), 'eat', [0, 0.12]));
    at = push(turnCone(1.05));
    at = push(settle(at, { yaw: face - 0.25 }, 0.3, 'eat', [0.12, 0.12]));
    at = push(turnCone(0.85));
    push(settle(at, { yaw: face, pitch: 0 }, 0.26, 'sit', [0.12, 0]));
  } else if (kind === 'zonnen') {
    // it lies down flat along its branch facing the trunk (`along`: the way the stub points
    // out from the trunk), its body on the stub, its tail curled forward over its back like a
    // parasol (as red squirrels shade themselves): lying down it shifts `out` m out along
    // the stub (its body lies ahead of its feet)
    const along = o.along ?? face;
    const toward = along + Math.PI;
    const flat = 1.5, out = 0.08, tl = 0.55;
    const lie = { x: p.x + Math.sin(along) * out, z: p.z + Math.cos(along) * out };
    // (a calm turn to lie along its branch and back: ≤ 4.5 rad/s, the lying shorter for it)
    const tin = Math.max(0.35, Math.abs(wrap(toward - at.yaw)) / 4.5), tout = Math.max(0.5, Math.abs(wrap(face - toward)) / 4.5);
    at = push(settle(at, { yaw: toward, pitch: 0.2 }, tin, 'sit'));
    at = push(slide(settle(at, { pitch: flat, alt: p.alt - 0.03 }, 0.55, 'sit', [0, tl]), at, lie));
    at = push(wobble(at, Math.max(0.8, Math.min(1.3, 2.85 - 0.55 - tin - tout)), 'sit', (s) => ({ pitch: 0.025 * Math.sin(s * Math.PI * 2 * 0.7) }), () => tl));
    push(slide(settle(at, { yaw: face, pitch: 0, alt: p.alt }, tout, 'sit', [tl, 0]), at, p));
  } else {
    // mopperen: three stamps, each a jolt of its body and a flick, a breath, two more
    at = push(settle(at, { yaw: face, pitch: -0.05 }, Math.max(0.2, Math.abs(wrap(face - at.yaw)) / 5), 'sit'));
    const stamp = (dur: number) => wobble(at, dur, 'sit', (s) => {
      const u = Math.min(1, s / dur);
      return { alt: 0.018 * Math.sin(u * Math.PI), pitch: 0.16 * Math.sin(u * Math.PI) };
    }, (s) => flick(s, dur) * 0.75);
    for (let i = 0; i < 3; i++) at = push(stamp(0.26));
    at = push(wobble(at, 0.36, 'sit', () => ({}), () => 0));
    for (let i = 0; i < 2; i++) at = push(stamp(0.24));
    push(settle(at, { yaw: face, pitch: 0 }, 0.3, 'sit'));
  }
  return out;
}

/** Run 7 (ek-day): from whatever it is doing on its perch (an antic he cut short by coming
 *  close) back to sitting up facing `face`, calmly, in `dur` s, its feet at `alt` (its seat:
 *  lying flat it sank a little); its tail eases from `tail`. */
export function settlePlan(p: SqPose, face: number, dur = 0.3, tail = 0, alt = p.alt): Segment[] {
  return [settle({ ...p, act: 'sit' }, { yaw: face, pitch: 0, alt }, dur, 'sit', [tail, 0])];
}

/**
 * Run 7 (ek-day, the ending): it pats the earth down over an acorn it just buried — three
 * slow pats of its front paws, its nose down, where it sits (`p`, on the ground) — then
 * sits up facing `face`. ~1.4 s; it never leaves the spot.
 */
export function patPlan(p: SqPose, face: number): Segment[] {
  const down: SqPose = { ...p, alt: 0, roll: 0, act: 'dig' };
  const out: Segment[] = [settle({ ...down, pitch: p.pitch }, { pitch: 0.62 }, 0.2, 'dig')];
  out.push(wobble({ ...down, pitch: 0.62 }, 0.9, 'dig', (s) => ({ pitch: 0.14 * Math.max(0, Math.sin(s * Math.PI * 2 * 3.3)) }), () => 0.1));
  out.push(settle({ ...down, pitch: 0.62 }, { pitch: 0, yaw: face }, 0.3, 'sit', [0.1, 0]));
  return out;
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

/* ---------------------------------------------------------------- sight ---- */

/** A point in the world (m, world y up). */
export interface P3 { x: number; y: number; z: number }

/** Something upright that hides what is behind it: a trunk (its bark's radius changes up
 *  it), the ranger's body. It stands from `y0` to `y1` (world y); `r(y)` is how far out
 *  from its axis it reaches at height y. */
export interface Upright { x: number; z: number; y0: number; y1: number; r: (y: number) => number }

/**
 * How far a trunk's bark reaches out from its axis where it hides what is behind it, up
 * the tree, as fractions of the tree's height: its OUTLINE at that height, the furthest
 * trunk vertex (the low-poly bark is ridged, so its outline lies outside the median
 * radius the squirrel clings at) — measured off the tree GLBs as the forest draws them,
 * per 2 % of the height, 2026-10-01 (rows: [share of the height, reach]; between two
 * rows the larger, so it is never less than the bark that shows). Played 2026-09-30: a
 * squirrel clinging just past the median bark's edge was "in view" by the median and
 * hidden on the screen by the ridges. Played 2026-10-01: one reach for the whole trunk
 * (its root flare's, 0.04 of a pine's height) hid a squirrel sitting in plain view at
 * the trunk's edge a metre up, where the bark reaches 0.03.
 */
export const TRUNK_OUTLINE: Readonly<Record<TrunkSpecies, readonly (readonly [number, number])[]>> = {
  'prop-oak-tree': [[0, 0.143], [0.02, 0.112], [0.04, 0.084], [0.06, 0.073], [0.08, 0.057], [0.14, 0.06]],
  'prop-pine-scots': [[0, 0.082], [0.02, 0.056], [0.04, 0.036], [0.06, 0.03], [0.16, 0.029], [0.24, 0.027], [0.32, 0.031], [0.44, 0.03]],
  'prop-birch-tree': [[0, 0.036], [0.02, 0.031], [0.1, 0.029], [0.14, 0.031], [0.18, 0.038], [0.3, 0.051], [0.32, 0.056]],
};

/** The trunk's outline (m out from its axis) at `h` m up it. */
export function trunkOutline(t: Trunk, h: number): number {
  const rows = TRUNK_OUTLINE[t.species];
  const f = Math.max(0, h / t.H);
  for (let i = 1; i < rows.length; i++) if (f < rows[i][0]) return Math.max(rows[i - 1][1], rows[i][1]) * t.H;
  return rows[rows.length - 1][1] * t.H;
}

/**
 * How far out (a share of the tree's height) the follow camera counts a trunk as standing
 * between the lens and him — and FADES it (world/Crowns.ts's trunk measure: the whole
 * trunk's furthest vertex, root flare and all). A trunk that near the line from the lens
 * to his head or his chest is see-through: it hides nothing behind it. (This is the fade's
 * reach, not what the bark hides: `trunkUpright`.)
 */
const TRUNK_FADE: Readonly<Record<TrunkSpecies, number>> = { 'prop-pine-scots': 0.04, 'prop-oak-tree': 0.075, 'prop-birch-tree': 0.045 };

/** A trunk as the camera's fade decision sees it (see TRUNK_FADE). */
export function trunkFadeUpright(t: Trunk, ground: number): Upright {
  const reach = TRUNK_FADE[t.species] * t.H;
  return { x: t.x, z: t.z, y0: ground - 0.5, y1: ground + t.H, r: (y) => Math.max(reach, barkRadius(t, Math.max(0, y - ground))) };
}

/** An upright trunk as a line of sight meets it: out to its ridged outline at each height
 *  (never less than the bark's measured radius), its foot on the ground at `ground`. */
export function trunkUpright(t: Trunk, ground: number): Upright {
  return { x: t.x, z: t.z, y0: ground - 0.5, y1: ground + t.H, r: (y) => { const h = Math.max(0, y - ground); return Math.max(trunkOutline(t, h), barkRadius(t, h)); } };
}

/** Is the straight line from `eye` to `at` clear of every upright, by at least `pad` m?
 *  Each is met where the line passes nearest its axis, at the height the line has there.
 *  (`at` is the middle of a body: a line that only just grazes past the bark to it sees
 *  a sliver at most — `pad` asks for most of the body in view.) When the line comes
 *  nearest an upright at its very end, `at` is on the side of it that faces the eye (a
 *  squirrel on the near side of the bark, among its ridges): that upright hides nothing. */
export function lineClear(eye: P3, at: P3, uprights: readonly Upright[], pad = 0): boolean {
  const dx = at.x - eye.x, dz = at.z - eye.z;
  const l2 = dx * dx + dz * dz;
  for (const u of uprights) {
    const raw = l2 < 1e-9 ? 1 : ((u.x - eye.x) * dx + (u.z - eye.z) * dz) / l2;
    if (raw >= 1) continue;
    const t = Math.max(0, raw);
    const y = eye.y + (at.y - eye.y) * t;
    if (y < u.y0 || y > u.y1) continue;
    if (Math.hypot(eye.x + dx * t - u.x, eye.z + dz * t - u.z) < u.r(y) + pad) return false;
  }
  return true;
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
