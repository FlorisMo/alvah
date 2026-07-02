/**
 * Paths.test.ts — seeded unit test for the pure sand-path network (W4.3).
 * Run: `node --experimental-strip-types src/render3d/Paths.test.ts`
 *
 * Pins the two contracts W4.3 makes:
 *  - TOPOLOGY: the network is one connected graph — spawn reaches every POI
 *    node (the §4 "connect spawn and the POIs" requirement).
 *  - GEOMETRY: a point on a ribbon centreline reads ~0 from the network; a
 *    point far off reads large.
 *  - ROUTING ("wayfinding follows paths"): from spawn to a far goal the cue
 *    aims at the first path node, NOT straight at the goal; near the goal it
 *    aims straight; standing at a mid-route node it advances to the next node.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PATH_NODES, PATH_SEGMENTS, LANE_HALF, DIRECT_R,
  distanceToNetwork, onPath, nearestNodeIndex, shortestPath, routeVia,
} from './Paths.ts';

const nodeOf = (id: string) => PATH_NODES.findIndex((n) => n.id === id);

test('every POI node is reachable from spawn (one connected network)', () => {
  const spawn = nodeOf('spawn');
  assert.equal(spawn, 0);
  for (let i = 0; i < PATH_NODES.length; i++) {
    if (i === spawn) continue;
    const route = shortestPath(spawn, i);
    assert.ok(route.length >= 2, `no route spawn→${PATH_NODES[i].id}`);
    assert.equal(route[0], spawn);
    assert.equal(route[route.length - 1], i);
  }
});

test('the §4 named POIs all exist as nodes', () => {
  for (const id of ['spawn', 'watchtower', 'birdhide', 'stuifzand', 'boa', 'ecoduct']) {
    assert.ok(nodeOf(id) >= 0, `missing node ${id}`);
  }
  assert.ok(PATH_SEGMENTS.length >= 5);
});

test('a point on a ribbon centreline is on the path; a far point is not', () => {
  // midpoint of the spawn→watchtower spoke
  const a = PATH_NODES[0], b = PATH_NODES[nodeOf('watchtower')];
  const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
  assert.ok(distanceToNetwork(mx, mz) < 1e-6);
  assert.ok(onPath(mx, mz));
  // a point far from every ribbon (deep in an empty quadrant)
  assert.ok(distanceToNetwork(-40, 60) > LANE_HALF + 5);
  assert.ok(!onPath(-40, 60));
});

test('nearestNodeIndex snaps to the closest route node', () => {
  assert.equal(nearestNodeIndex(1, -1), 0); // near spawn
  assert.equal(nearestNodeIndex(36, -36), nodeOf('watchtower'));
});

test('routeVia bends the arrow onto the path from spawn to a far goal', () => {
  // goal out past the watchtower (SE) — far from spawn, so it must route
  const goal = { x: 44, z: -46 };
  const wp = routeVia(0, 0, goal.x, goal.z);
  // the first waypoint is a route node, not the raw goal
  const isGoal = Math.hypot(wp.x - goal.x, wp.z - goal.z) < 1e-6;
  assert.ok(!isGoal, 'from spawn the cue should aim at a path node, not the goal');
  // and it should be the watchtower node (nearest node to the goal, first hop)
  const wt = PATH_NODES[nodeOf('watchtower')];
  assert.ok(Math.hypot(wp.x - wt.x, wp.z - wt.z) < 1e-6);
});

test('routeVia aims straight at the goal on the final leg', () => {
  const goal = { x: 8, z: 3 };            // within DIRECT_R of the ranger
  const wp = routeVia(0, 0, goal.x, goal.z);
  assert.ok(Math.hypot(0 - goal.x, 0 - goal.z) <= DIRECT_R);
  assert.ok(Math.hypot(wp.x - goal.x, wp.z - goal.z) < 1e-6);
});

test('routeVia advances to the next node once the ranger stands at a mid-route node', () => {
  // ranger standing AT the boa node, goal beyond the ecoduct → next hop is ecoduct
  const boa = PATH_NODES[nodeOf('boa')];
  const eco = PATH_NODES[nodeOf('ecoduct')];
  const goal = { x: -78, z: 12 }; // past the ecoduct
  const wp = routeVia(boa.x, boa.z, goal.x, goal.z);
  assert.ok(Math.hypot(wp.x - eco.x, wp.z - eco.z) < 1e-6);
});
