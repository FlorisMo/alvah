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
 *     render layer hugs the terrain along these; the cue uses it to know whether
 *     the ranger is already ON a path).
 *   • `routeVia(px,pz, gx,gz)` — "wayfinding FOLLOWS the paths": the next steering
 *     waypoint along the shortest route from the ranger to the goal, so the calm
 *     direction cue points ALONG the sand path and only peels off to the marker on
 *     the final leg. Distance/arrival stay measured to the true goal (World does
 *     that); this only bends the ARROW onto the path.
 *
 * Deterministic + render-agnostic (no THREE, no Math.random / Date.now) so it
 * carries a seeded unit test like every other render3d construct (§9e / §3.1).
 * The node positions mirror the W4.1 landmark anchors so a path always leads to
 * the beacon that stands at its end.
 */

export interface PathNode {
  /** stable id (also the dev-hook / debugging label) */
  id: string;
  x: number;
  z: number;
}

/**
 * Route nodes: the spawn clearing plus the five §4 POIs, positioned on the W4.1
 * landmark anchors so each spoke ends at its beacon.
 */
export const PATH_NODES: readonly PathNode[] = [
  { id: 'spawn', x: 0, z: 0 },
  { id: 'watchtower', x: 37, z: -37 }, // bos beacon (prop-fire-watchtower)
  { id: 'birdhide', x: 26, z: -11 },   // ven POI (prop-bird-hide)
  { id: 'stuifzand', x: 20, z: 24 },   // drift-sand juniper head (NE)
  { id: 'boa', x: -56, z: -20 },       // BOA post on the west rim
  { id: 'ecoduct', x: -70, z: 6 },     // ecoduct beyond the BOA post
] as const;

/**
 * Undirected edges (index pairs into PATH_NODES). Four spokes radiate from spawn
 * to the near POIs, the boa→ecoduct leg extends the west spoke, and the
 * watchtower↔birdhide edge closes a SE loop — so the network connects spawn to
 * every POI and reads as one continuous set of trails, not dead-end spurs. This
 * honours the §4 "connect spawn and the POIs, spawn ↔ … ↔ spawn" intent (the
 * literal chain order in §4 crossed the map awkwardly; see §10).
 */
export const PATH_SEGMENTS: readonly (readonly [number, number])[] = [
  [0, 1], // spawn → watchtower
  [0, 2], // spawn → birdhide (ven)
  [0, 3], // spawn → stuifzand
  [0, 4], // spawn → boa
  [4, 5], // boa → ecoduct
  [1, 2], // watchtower → birdhide (closes the SE loop)
] as const;

/** Half-width of a sand ribbon (m). The render layer builds a 2·LANE_HALF strip. */
export const LANE_HALF = 1.2;

/** Within this straight-line distance to the goal the cue points STRAIGHT at it
 *  (final leg — no detour onto the network). */
export const DIRECT_R = 14;

/** A route node this close counts as "reached", so the cue advances to the next
 *  node along the path. */
export const REACHED_R = 7;

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

const dist2 = (a: PathNode, b: PathNode) =>
  Math.hypot(a.x - b.x, a.z - b.z);

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
      const nc = cost[u] + dist2(PATH_NODES[u], PATH_NODES[v]);
      if (nc < cost[v]) { cost[v] = nc; prev[v] = u; }
    }
  }
  if (cost[to] === Infinity) return [];
  const out: number[] = [];
  for (let at = to; at !== -1; at = prev[at]) out.unshift(at);
  return out;
}

/**
 * "Wayfinding follows the paths." Given the ranger at P and a goal G, return the
 * next steering point the DIRECTION cue should aim at:
 *
 *  1. Goal within `DIRECT_R` → aim straight at the goal (final leg, no detour).
 *  2. Otherwise route P→G over the network: nearest node to P (entry) and to G
 *     (exit), shortest node path between them.
 *      - not yet on/at any route node → aim at the entry node (get onto a path);
 *      - standing at some node in the route → aim at the NEXT node along it;
 *      - reached the exit node → aim straight at the goal (peel off to the marker).
 *
 * Distance + arrival are measured to the true goal by the caller — this only
 * bends the arrow onto the sand path.
 */
export function routeVia(
  px: number, pz: number, gx: number, gz: number,
): { x: number; z: number } {
  if (Math.hypot(gx - px, gz - pz) <= DIRECT_R) return { x: gx, z: gz };
  const entry = nearestNodeIndex(px, pz);
  const exit = nearestNodeIndex(gx, gz);
  if (entry === exit) return { x: gx, z: gz }; // same local hub → walk straight
  const route = shortestPath(entry, exit);
  if (route.length === 0) return { x: gx, z: gz };
  // furthest node along the route the ranger has already reached
  let lastReached = -1;
  route.forEach((idx, k) => {
    if (Math.hypot(PATH_NODES[idx].x - px, PATH_NODES[idx].z - pz) <= REACHED_R) lastReached = k;
  });
  if (lastReached === -1) return { x: PATH_NODES[route[0]].x, z: PATH_NODES[route[0]].z };
  if (lastReached >= route.length - 1) return { x: gx, z: gz }; // at the exit node → go to goal
  const next = PATH_NODES[route[lastReached + 1]];
  return { x: next.x, z: next.z };
}
