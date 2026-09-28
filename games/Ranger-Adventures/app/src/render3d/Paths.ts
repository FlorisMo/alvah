/**
 * Paths.ts — the sand-path network for the explorable Veluwe (W4.3, WORLD-PLAN §4).
 *
 * The §4 world map calls for sand paths that "connect: spawn ↔ watchtower ↔
 * ecoduct ↔ ven ↔ stuifzand ↔ spawn". This module is the PURE description of
 * that network — a small named-node graph plus the helpers the render layer and
 * the wayfinding cue both read:
 *
 *   • `PATH_NODES` / `PATH_SEGMENTS` — the route graph (spawn + the five POIs).
 *   • `distanceToNetwork(x,z)` — how far a point is from the nearest ribbon (the
 *     render layer hugs the terrain along these; the scatter keeps them bare).
 *   • `planRoute` / `RouteGuide` — "wayfinding FOLLOWS the paths": the route from
 *     the ranger to the goal over the sand paths (when they are worth the walk), and
 *     the steady point on it the calm direction cue aims at. Distance/arrival stay
 *     measured to the true goal (Markers does that); this only bends the ARROW.
 *   • `arrivalSpot` / `openHeading` — where a mission brought to the ranger (picked on
 *     the missiebord, or "Volgende") stands him: where the arrow's walk comes in to its
 *     marker, facing ground its game can be laid on (not the ven's water).
 *
 * Deterministic + render-agnostic (no THREE, no Math.random / Date.now) so it
 * carries a seeded unit test like every other render3d construct (§9e / §3.1).
 */

import { obstacleGap, segmentEntry, type Obstacle } from './CharacterController.ts';

export interface PathNode {
  /** stable id (also the dev-hook / debugging label) */
  id: string;
  x: number;
  z: number;
}

/**
 * Route nodes: the spawn clearing plus the five §4 POIs. A POI's node stands on the
 * open ground IN FRONT of its landmark (the side that faces the clearing), never
 * under it: the watchtower, the bird hide, the BOA post and the ecoduct are solid,
 * and a node inside one could never be reached — the arrow pointed into the ecoduct's
 * wall for ever (parent B2). Every node is walkable (Paths.test.ts pins it).
 */
export const PATH_NODES: readonly PathNode[] = [
  { id: 'spawn', x: 0, z: 0 },
  { id: 'watchtower', x: 31.5, z: -34.5 }, // in front of the fire watchtower (37, -37), its trail clear of the ven
  { id: 'birdhide', x: 22.5, z: -10.5 }, // in front of the vogelkijkhut (26, -11), by the ven
  { id: 'stuifzand', x: 20, z: 24 },     // drift-sand juniper head (NE)
  { id: 'boa', x: -52.2, z: -18.7 },     // in front of the BOA post (-56, -20) on the west rim
  { id: 'ecoduct', x: -60, z: 4 },       // in front of the ecoduct (-70, 6): its 15 m deck is solid
  { id: 'hut', x: -6, z: 2.5 },          // the west trail bends round the ranger cabin (-6.5, -6)
] as const;

/**
 * Undirected edges (index pairs into PATH_NODES). Four spokes radiate from spawn to
 * the near POIs (the west one round the cabin), the boa→ecoduct leg extends the west
 * spoke, and the watchtower↔birdhide edge closes a SE loop — so the network connects
 * spawn to every POI and reads as one continuous set of trails, not dead-end spurs.
 */
export const PATH_SEGMENTS: readonly (readonly [number, number])[] = [
  [0, 1], // spawn → watchtower
  [0, 2], // spawn → birdhide (ven)
  [0, 3], // spawn → stuifzand
  [0, 6], // spawn → round the cabin
  [6, 4], // … → boa
  [4, 5], // boa → ecoduct
  [1, 2], // watchtower → birdhide (closes the SE loop)
] as const;

/** Half-width of a sand ribbon (m). The render layer builds a 2·LANE_HALF strip. */
export const LANE_HALF = 1.2;

/** Within this straight-line distance to the goal the cue points STRAIGHT at it
 *  (final leg — no detour onto the network). It lets go again only past
 *  DIRECT_R + DIRECT_HYST, so the arrow never flips at the edge of the ring. */
export const DIRECT_R = 14;
export const DIRECT_HYST = 4;

/** A metre walked off the sand counts this much against a metre on it: a path is
 *  taken when it is not much of a detour (a 30 % longer walk on sand is fine). */
export const OFF_PATH = 1.3;

/** How far ahead along the route (m) the arrow aims: the ranger rounds a corner of
 *  the trail smoothly instead of having to touch its node first. */
export const LOOK_AHEAD = 6;

/** A ranger this far (m) from his route has left it: plan a new one from here. */
export const OFF_ROUTE = 9;

/** A new plan must save at least this much (weighted m) before the arrow changes to
 *  it — the hysteresis that keeps two near-equal routes from flip-flopping. */
export const SWITCH_GAIN = 4;

/** Look for a cheaper route every this many calls (a few times a second), not every frame. */
export const REPLAN_EVERY = 12;

interface P { x: number; z: number }

/** Squared distance from point P to segment AB, clamped to the segment ends. */
function distToSegSq(
  px: number, pz: number,
  ax: number, az: number, bx: number, bz: number,
): number {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cz = az + t * dz;
  const ex = px - cx, ez = pz - cz;
  return ex * ex + ez * ez;
}

/** Shortest distance (m) from (x,z) to any ribbon centreline in the network. */
export function distanceToNetwork(x: number, z: number): number {
  let best = Infinity;
  for (const [i, j] of PATH_SEGMENTS) {
    const a = PATH_NODES[i], b = PATH_NODES[j];
    const d2 = distToSegSq(x, z, a.x, a.z, b.x, b.z);
    if (d2 < best) best = d2;
  }
  return Math.sqrt(best);
}

/** Where a spoke's sand track starts, out from the spawn (m): the track to the
 *  missiebord (and on to the watchtower) runs from the ranger's feet, the west trail
 *  from beside the cabin; the others come in from the edge of the cabin's grassy yard. */
const SPOKE_START: Readonly<Record<string, number>> = { watchtower: 0.8, hut: 2.2 };
const YARD_EDGE_START = 5.5;
const TRACK_FADE_IN = 2.5; // m over which a spoke's sand comes in

const smooth = (e0: number, e1: number, v: number): number => {
  const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * How much sand track shows at (x,z), 0..1: full in the ruts, fading out at its edges
 * (1.05 → 1.9 m from the centreline) and where a spoke comes in to the yard. The track
 * ribbons (world/Terrain) and the yard's grass (world/Dressing) read the same value, so
 * grass never grows through sand and where two ribbons overlap they draw one colour.
 */
export function trackSand(x: number, z: number): number {
  let best = 0;
  for (const [i, j] of PATH_SEGMENTS) {
    const a = PATH_NODES[i], b = PATH_NODES[j];
    const dx = b.x - a.x, dz = b.z - a.z;
    const len2 = dx * dx + dz * dz;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / len2)) : 0;
    const d = Math.hypot(x - (a.x + t * dx), z - (a.z + t * dz));
    let k = 1 - smooth(1.05, 1.9, d);
    if (k <= best) continue;
    if (a.id === 'spawn') {
      const s0 = SPOKE_START[b.id] ?? YARD_EDGE_START;
      k *= smooth(s0, s0 + TRACK_FADE_IN, t * Math.sqrt(len2));
    }
    if (k > best) best = k;
  }
  return best;
}

/** True when (x,z) is on a sand path (within a lane half-width). */
export function onPath(x: number, z: number, margin = 0): boolean {
  return distanceToNetwork(x, z) <= LANE_HALF + margin;
}

/** Index of the route node nearest to (x,z). */
export function nearestNodeIndex(x: number, z: number): number {
  let best = 0, bestD = Infinity;
  PATH_NODES.forEach((n, i) => {
    const d = (n.x - x) * (n.x - x) + (n.z - z) * (n.z - z);
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

/** Adjacency list (node index → neighbour indices), derived from PATH_SEGMENTS. */
function adjacency(): number[][] {
  const adj: number[][] = PATH_NODES.map(() => []);
  for (const [i, j] of PATH_SEGMENTS) { adj[i].push(j); adj[j].push(i); }
  return adj;
}

const dist = (a: P, b: P): number => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * Shortest node path from `from` to `to` over the network (Dijkstra by edge
 * length — the graph is tiny). Returns the index sequence including both ends;
 * `[from]` when from === to; `[]` if disconnected (never, the graph is connected).
 */
export function shortestPath(from: number, to: number): number[] {
  if (from === to) return [from];
  const adj = adjacency();
  const n = PATH_NODES.length;
  const cost = new Array<number>(n).fill(Infinity);
  const prev = new Array<number>(n).fill(-1);
  const seen = new Array<boolean>(n).fill(false);
  cost[from] = 0;
  for (let iter = 0; iter < n; iter++) {
    let u = -1, uc = Infinity;
    for (let k = 0; k < n; k++) if (!seen[k] && cost[k] < uc) { uc = cost[k]; u = k; }
    if (u === -1) break;
    seen[u] = true;
    if (u === to) break;
    for (const v of adj[u]) {
      const nc = cost[u] + dist(PATH_NODES[u], PATH_NODES[v]);
      if (nc < cost[v]) { cost[v] = nc; prev[v] = u; }
    }
  }
  if (cost[to] === Infinity) return [];
  const out: number[] = [];
  for (let at = to; at !== -1; at = prev[at]) out.unshift(at);
  return out;
}

/** A route the ranger can walk: its corner points (the ranger first, the goal
 *  last) and its cost in weighted metres (off the sand × OFF_PATH). */
export interface Route {
  pts: P[];
  /** per leg (pts[i] → pts[i+1]): true when it runs along a sand path */
  onSand: boolean[];
  cost: number;
}

/** Where on segment AB a walker from P best joins it (or leaves it for P): the foot
 *  of the perpendicular and, either side of it, the point a straight line off the
 *  sand meets the path at its cheapest angle (cos θ = 1/OFF_PATH). */
function joinPoints(p: P, a: P, b: P): number[] {
  const dx = b.x - a.x, dz = b.z - a.z;
  const len = Math.hypot(dx, dz);
  if (len < 1e-9) return [0];
  const t = ((p.x - a.x) * dx + (p.z - a.z) * dz) / (len * len);
  const h = Math.abs((p.x - a.x) * dz - (p.z - a.z) * dx) / len; // off the line (m)
  const slide = h / Math.sqrt(OFF_PATH * OFF_PATH - 1) / len;    // as a share of the segment
  return [t, t - slide, t + slide].map((u) => Math.max(0, Math.min(1, u)));
}

/** How much room (m) a route keeps from a building or the water. */
const SOLID_GROW = 0.6;
/** Its corner points stand this much further out, so the legs between them stay clear. */
const CORNER_OUT = SOLID_GROW + 0.6;

/** Where a route may turn round a solid: a box's four corners, or eight points round a
 *  big circle (the ven), grown so the legs between them clear it. */
function cornersOf(o: Obstacle): P[] {
  if (o.box) {
    const b = o.box;
    const ex = b.hx + b.pad + CORNER_OUT, ez = b.hz + b.pad + CORNER_OUT;
    const c = Math.cos(b.rot), s = Math.sin(b.rot);
    return [[ex, ez], [ex, -ez], [-ex, ez], [-ex, -ez]].map(([lx, lz]) => ({ x: o.x + lx * c + lz * s, z: o.z - lx * s + lz * c }));
  }
  const R = (o.r + CORNER_OUT) / Math.cos(Math.PI / 8); // the octagon round the grown circle
  return Array.from({ length: 8 }, (_, k) => ({ x: o.x + R * Math.cos((k * Math.PI) / 4), z: o.z + R * Math.sin((k * Math.PI) / 4) }));
}

/**
 * The world a route is planned through: the sand network plus the SOLIDS a walk off
 * the sand must not run into — the buildings (the cabin, the landmarks) and the ven's
 * water, where the ranger simply stops at the shore. A leg off the sand that crosses one
 * is no way at all; the route turns round its corners instead (from spawn to the
 * frisling behind the cabin it no longer points into the cabin wall; to the vos behind
 * the watchtower it walks round the tower). `walkable` drops a corner that stands in
 * the water or in another solid. Built once per world; everything that does not move
 * with the ranger (which corners see which) is worked out here.
 */
export class RouteMap {
  readonly solids: readonly Obstacle[];
  /** the fixed vertices: the network nodes, then every usable corner */
  readonly fixed: P[];
  /** off-sand legs between fixed vertices that clear every solid (indices into fixed) */
  readonly fixedLegs: [number, number][] = [];

  constructor(solids: readonly Obstacle[] = [], walkable: (x: number, z: number) => boolean = () => true) {
    this.solids = solids;
    const corners = solids.flatMap(cornersOf).filter((c) => walkable(c.x, c.z) && !this.inside(c.x, c.z));
    this.fixed = [...PATH_NODES.map((n) => ({ x: n.x, z: n.z })), ...corners];
    const N = PATH_NODES.length;
    for (let a = N; a < this.fixed.length; a++) {
      for (let b = 0; b < a; b++) if (!this.crosses(this.fixed[a], this.fixed[b])) this.fixedLegs.push([a, b]);
    }
  }

  /** Does a straight walk from a to b run into a solid? */
  crosses(a: P, b: P): boolean {
    for (const o of this.solids) if (segmentEntry(o, a.x, a.z, b.x - a.x, b.z - a.z, SOLID_GROW) < 1) return true;
    return false;
  }

  private inside(x: number, z: number): boolean {
    for (const o of this.solids) if (obstacleGap(o, x, z, SOLID_GROW) < 0) return true;
    return false;
  }
}

/** The bare network: no solids to walk round (the unit tests' default). */
const OPEN = new RouteMap();

/**
 * The cheapest way from P to the goal G: straight across (every metre off the sand), or
 * onto the network wherever it is cheapest to join, along the sand, and off it again
 * toward the goal — round the corners of any solid in the way. A small Dijkstra over
 * the network nodes, the solids' corners and the join and leave points on every
 * segment. Pure and deterministic.
 */
export function planRoute(px: number, pz: number, gx: number, gz: number, map: RouteMap = OPEN): Route {
  const p = { x: px, z: pz }, g = { x: gx, z: gz };
  // vertices: 0 = P, 1 = G, then the map's fixed ones (nodes, corners), then the join/leave points
  const base = 2;
  const vs: P[] = [p, g, ...map.fixed];
  const edges: { a: number; b: number; w: number; sand: boolean }[] = [];
  const offLeg = (a: number, b: number, w: number): void => { edges.push({ a, b, w, sand: false }); };
  const off = (a: number, b: number): void => {
    if (!map.crosses(vs[a], vs[b])) offLeg(a, b, OFF_PATH * dist(vs[a], vs[b]));
  };
  for (const [a, b] of map.fixedLegs) offLeg(base + a, base + b, OFF_PATH * dist(map.fixed[a], map.fixed[b]));
  off(0, 1);
  for (let k = 0; k < map.fixed.length; k++) { off(0, base + k); off(base + k, 1); }
  PATH_SEGMENTS.forEach(([i, j]) => {
    const a = PATH_NODES[i], b = PATH_NODES[j];
    // every point on this segment, by its share t along it: the two ends, where P joins, where G is left
    const on: { t: number; v: number }[] = [{ t: 0, v: base + i }, { t: 1, v: base + j }];
    for (const t of joinPoints(p, a, b)) {
      vs.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
      on.push({ t, v: vs.length - 1 });
      off(0, vs.length - 1);
    }
    for (const t of joinPoints(g, a, b)) {
      vs.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
      on.push({ t, v: vs.length - 1 });
      off(vs.length - 1, 1);
    }
    on.sort((u, v) => u.t - v.t);
    for (let k = 1; k < on.length; k++) {
      edges.push({ a: on[k - 1].v, b: on[k].v, w: dist(vs[on[k - 1].v], vs[on[k].v]), sand: true });
    }
  });
  // boxed in on every side (never, in this world): straight to the goal after all
  if (!edges.some((e) => e.a === 0 || e.b === 0)) offLeg(0, 1, OFF_PATH * dist(p, g));
  // Dijkstra from P (vertex 0) to G (vertex 1), undirected
  const n = vs.length;
  const adj: { to: number; w: number; sand: boolean }[][] = vs.map(() => []);
  for (const e of edges) { adj[e.a].push({ to: e.b, w: e.w, sand: e.sand }); adj[e.b].push({ to: e.a, w: e.w, sand: e.sand }); }
  const cost = new Array<number>(n).fill(Infinity);
  const prev = new Array<number>(n).fill(-1);
  const prevSand = new Array<boolean>(n).fill(false);
  const done = new Array<boolean>(n).fill(false);
  cost[0] = 0;
  for (;;) {
    let u = -1, uc = Infinity;
    for (let k = 0; k < n; k++) if (!done[k] && cost[k] < uc) { uc = cost[k]; u = k; }
    if (u === -1 || u === 1) break;
    done[u] = true;
    for (const e of adj[u]) {
      const c = cost[u] + e.w;
      if (c < cost[e.to] - 1e-9) { cost[e.to] = c; prev[e.to] = u; prevSand[e.to] = e.sand; }
    }
  }
  if (cost[1] === Infinity) return { pts: [p, g], onSand: [false], cost: OFF_PATH * dist(p, g) };
  const chain: number[] = [];
  for (let at = 1; at !== -1; at = prev[at]) chain.unshift(at);
  const pts: P[] = [{ x: vs[chain[0]].x, z: vs[chain[0]].z }];
  const onSand: boolean[] = [];
  for (let k = 1; k < chain.length; k++) {
    const q = vs[chain[k]];
    if (dist(pts[pts.length - 1], q) < 1e-6) continue; // a join point that sits on a node
    pts.push({ x: q.x, z: q.z });
    onSand.push(prevSand[chain[k]]);
  }
  return { pts, onSand, cost: cost[1] };
}

/**
 * The steady arrow: follows ONE planned route and remembers how far along it the
 * ranger has come, so leaving a corner never sends the arrow back to it (the old
 * per-frame "nearest node" choice pointed back at a node the moment he stepped out
 * of its ring, and could loop for ever — parent B1). Each frame it projects the
 * ranger onto the route just ahead of his progress and aims LOOK_AHEAD m further
 * along it, so the aim point slides smoothly round every corner. It plans afresh
 * only when the goal changes, when he has clearly left the route (OFF_ROUTE), or
 * when another route has become cheaper by SWITCH_GAIN — never back and forth.
 * Inside DIRECT_R of the goal it aims straight at it (with DIRECT_HYST).
 */
export class RouteGuide {
  private readonly map: RouteMap;
  private goal: P | null = null;
  private route: Route | null = null;
  private cum: number[] = [];   // arc length (m) at each route point
  private s = 0;                // how far along the route the ranger has come (m)
  private direct = false;

  private calls = 0;

  constructor(map: RouteMap = OPEN) {
    this.map = map;
  }

  /** Forget the route (a new goal, the world rebuilt). */
  reset(): void {
    this.goal = null;
    this.route = null;
    this.direct = false;
  }

  /** The point the arrow aims at, for the ranger at P heading to the goal G. */
  aim(px: number, pz: number, gx: number, gz: number): P {
    if (!this.goal || Math.hypot(this.goal.x - gx, this.goal.z - gz) > 0.5) {
      this.goal = { x: gx, z: gz };
      this.route = null;
      this.direct = false;
    }
    const toGoal = Math.hypot(gx - px, gz - pz);
    const near = toGoal <= DIRECT_R || (this.direct && toGoal <= DIRECT_R + DIRECT_HYST);
    if (near && !this.map.crosses({ x: px, z: pz }, { x: gx, z: gz })) {
      this.direct = true;
      this.route = null;
      return { x: gx, z: gz };
    }
    this.direct = false;
    if (!this.route) this.follow(planRoute(px, pz, gx, gz, this.map));
    let at = this.progress(px, pz);
    if (at.off > OFF_ROUTE) {
      this.follow(planRoute(px, pz, gx, gz, this.map));
      at = this.progress(px, pz);
    } else if (++this.calls % REPLAN_EVERY === 0) {
      const fresh = planRoute(px, pz, gx, gz, this.map);
      if (fresh.cost < this.remaining(at) - SWITCH_GAIN) {
        this.follow(fresh);
        at = this.progress(px, pz);
      }
    }
    this.s = Math.max(this.s, at.s);
    // aim LOOK_AHEAD m along the route, but never across a corner of a building or the
    // water: pull the aim back along the route until the straight line to it is clear
    const here = { x: px, z: pz };
    let ahead = LOOK_AHEAD;
    let q = this.pointAt(this.s + ahead);
    while (ahead > 0.5 && this.map.crosses(here, q)) { ahead /= 2; q = this.pointAt(this.s + ahead); }
    return q;
  }

  private follow(route: Route): void {
    this.route = route;
    this.cum = [0];
    for (let i = 1; i < route.pts.length; i++) this.cum.push(this.cum[i - 1] + dist(route.pts[i - 1], route.pts[i]));
    this.s = 0;
  }

  /** The nearest point of the route to P from just behind his progress to a little
   *  ahead of it: `s` its arc length, `off` how far he stands from it. */
  private progress(px: number, pz: number): { s: number; off: number } {
    const pts = this.route!.pts;
    const lo = this.s - 1, hi = this.s + 3 * LOOK_AHEAD;
    let best = { s: this.s, off: Infinity };
    for (let i = 1; i < pts.length; i++) {
      const s0 = this.cum[i - 1], s1 = this.cum[i];
      if (s1 < lo || s0 > hi) continue;
      const a = pts[i - 1], b = pts[i];
      const len = s1 - s0;
      let t = len > 0 ? ((px - a.x) * (b.x - a.x) + (pz - a.z) * (b.z - a.z)) / (len * len) : 0;
      t = Math.max((lo - s0) / (len || 1), Math.min((hi - s0) / (len || 1), t));
      t = Math.max(0, Math.min(1, t));
      const cx = a.x + (b.x - a.x) * t, cz = a.z + (b.z - a.z) * t;
      const off = Math.hypot(px - cx, pz - cz);
      if (off < best.off) best = { s: s0 + t * len, off };
    }
    return best;
  }

  /** What is left of the route from `at` to the goal, in weighted metres. */
  private remaining(at: { s: number; off: number }): number {
    const r = this.route!;
    let c = OFF_PATH * at.off;
    for (let i = 1; i < r.pts.length; i++) {
      const s0 = this.cum[i - 1], s1 = this.cum[i];
      const left = Math.max(0, s1 - Math.max(s0, at.s));
      c += left * (r.onSand[i - 1] ? 1 : OFF_PATH);
    }
    return c;
  }

  /** The route point at arc length `s` (the goal beyond its end). */
  private pointAt(s: number): P {
    const pts = this.route!.pts;
    for (let i = 1; i < pts.length; i++) {
      if (s <= this.cum[i]) {
        const len = this.cum[i] - this.cum[i - 1];
        const t = len > 0 ? (s - this.cum[i - 1]) / len : 1;
        return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, z: pts[i - 1].z + (pts[i].z - pts[i - 1].z) * t };
      }
    }
    return { ...pts[pts.length - 1] };
  }
}

/**
 * Where a walker who simply heads where the arrow points comes in to the goal: the spot
 * `stop` m from it that his walk from P reaches first (a RouteGuide walk in half-metre
 * steps, like Paths.test's walker). A mission brought to the ranger — picked on the
 * missiebord, or "Volgende" at a finished marker — puts him on THIS side of its marker,
 * the side he would have walked up to (along the trail, round the buildings and the
 * water, never across them); `openHeading` then turns him to face ground its game can
 * be laid on. Pure and deterministic.
 */
export function arrivalSpot(px: number, pz: number, gx: number, gz: number, map: RouteMap = OPEN, stop = 1.8): P {
  const guide = new RouteGuide(map);
  let x = px, z = pz;
  for (let i = 0; i < 4000; i++) {
    const left = Math.hypot(gx - x, gz - z) - stop;
    if (left <= 1e-6) break;
    const aim = guide.aim(x, z, gx, gz);
    const d = Math.hypot(aim.x - x, aim.z - z);
    if (d < 1e-6) break;
    const step = Math.min(0.5, left);
    x += ((aim.x - x) / d) * step;
    z += ((aim.z - z) / d) * step;
  }
  return { x, z };
}

/** Turns tried (deg off facing the marker), nearest first, when the ground ahead of a
 *  ranger brought to a marker is no place for a game (openHeading). */
const OPEN_TURNS = [0, 20, -20, 35, -35, 50, -50];

/**
 * The heading nearest `yaw` (up to 50° off it) whose ground ahead is open: the strip
 * 2.5-8.5 m in front and 2.4 m either side, where a stage (render3d/play/stage.ts) lays
 * a mini-game's patch straight ahead of the lens (further out on a tablet's narrower
 * screen: at 1180×820 the frog's patch reached 7.5 m, and a 6.5 m strip let the stage
 * turn the lens away from the water after all). The first fully open one wins;
 * else the one with the fewest blocked samples. A ranger brought to the frog's marker
 * facing into the ven turns along the shore, so its game is laid on the dry bank with
 * the water beside it, and the lens need not swing round (parent B6).
 */
export function openHeading(x: number, z: number, yaw: number, clear: (x: number, z: number) => boolean): number {
  let best = yaw, fewest = Infinity;
  for (const deg of OPEN_TURNS) {
    const h = yaw + (deg * Math.PI) / 180;
    const fx = Math.sin(h), fz = Math.cos(h);
    let blocked = 0;
    for (let v = 2.5; v <= 8.51; v += 1) {
      for (let u = -2.4; u <= 2.41; u += 1.2) if (!clear(x + fx * v + fz * u, z + fz * v - fx * u)) blocked++;
    }
    if (blocked < fewest) { fewest = blocked; best = h; }
    if (blocked === 0) break;
  }
  return best;
}
