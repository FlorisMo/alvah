/**
 * Paths.test.ts — seeded unit test for the pure sand-path network and the route the
 * wayfinding arrow follows (W4.3). Run:
 *   node --experimental-strip-types --test src/render3d/Paths.test.ts
 *
 * Pins:
 *  - TOPOLOGY: the network is one connected graph — spawn reaches every POI node.
 *  - WALKABLE: every node stands on open ground, clear of the buildings' solid
 *    footprints and the ven's water, and no trail runs through a building (parent B2:
 *    the ecoduct node sat inside the ecoduct's deck, so the arrow pointed into its wall).
 *  - ROUTING: from spawn the arrow follows a trail when it is worth it and goes
 *    straight when it is not; near the goal it aims straight at it; a route never runs
 *    through a building or the water.
 *  - STEADY: a walker who simply heads where the arrow points reaches every mission from
 *    every start, and the arrow never swings back and forth (parent B1: it pointed back
 *    at a node the moment he left its 7 m ring, and could loop for ever).
 *  - BROUGHT: a mission picked on the missiebord stands him where the arrow's walk comes
 *    in to its marker, and by the ven turned along the shore, so its game is laid on dry
 *    ground (parent B6: facing into the water, the frog's game swung round to the heath).
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PATH_NODES, PATH_SEGMENTS, LANE_HALF, DIRECT_R,
  distanceToNetwork, onPath, nearestNodeIndex, shortestPath, planRoute, RouteGuide, RouteMap,
  arrivalSpot, openHeading,
} from './Paths.ts';
import { boxObstacle, obstacleGap, segmentEntry, type Obstacle } from './CharacterController.ts';

const nodeOf = (id: string) => PATH_NODES.findIndex((n) => n.id === id);

/** The world's buildings, as world/Dressing.ts places them (landmarks face the clearing:
 *  rotation.y = atan2(−x, −z)), and the submerged ven (World.limits.blocked). */
const facing = (x: number, z: number): number => Math.atan2(-x, -z);
const BUILDINGS: Obstacle[] = [
  boxObstacle(-4.2, -4, 1.97, 1.9, facing(-4.2, -4)),   // the ranger cabin
  boxObstacle(37, -37, 1.78, 1.86, facing(37, -37)),    // the fire watchtower
  boxObstacle(26, -11, 1.61, 1.49, facing(26, -11)),    // the vogelkijkhut
  boxObstacle(-70, 6, 7.74, 7.8, facing(-70, 6)),       // the ecoduct
  boxObstacle(-56, -20, 2.18, 2.13, facing(-56, -20)),  // the BOA post
];
const VEN: Obstacle = { x: 46, z: -19, r: 18 };
const SOLIDS = [...BUILDINGS, VEN];
const MAP = new RouteMap(SOLIDS, (x, z) => Math.hypot(x, z) < 74);

/** The ten mission markers (world/Markers.ts places them in their biomes). */
const MARKERS: [string, number, number][] = [
  ['frisling', -15.56, -15.56], ['ree', -15.01, -27.12], ['wildcamera', 15.56, -15.56],
  ['ven', 24.5, -19], ['ecoduct', 19.14, -24.39], ['stuifzand', 8.27, 20.39],
  ['nachtronde', 20.75, -34.2], ['eekhoorn', 25.42, -41.89], ['vos', 35.81, -45.63], ['herstel', -35, -19.37],
];

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

test('every path node is walkable: at least 1 m clear of every building, and dry', () => {
  for (const n of PATH_NODES) {
    for (const b of BUILDINGS) {
      assert.ok(obstacleGap(b, n.x, n.z) >= 1, `node ${n.id} (${n.x}, ${n.z}) stands in a building at (${b.x}, ${b.z})`);
    }
    assert.ok(Math.hypot(n.x - VEN.x, n.z - VEN.z) >= VEN.r + 1, `node ${n.id} stands in the ven`);
  }
});

test('no trail runs through a building or along the water\'s edge', () => {
  for (const [i, j] of PATH_SEGMENTS) {
    const a = PATH_NODES[i], b = PATH_NODES[j];
    for (const o of BUILDINGS) {
      assert.equal(segmentEntry(o, a.x, a.z, b.x - a.x, b.z - a.z, 0.3), 1, `${a.id}→${b.id} runs into the building at (${o.x}, ${o.z})`);
    }
    assert.equal(segmentEntry(VEN, a.x, a.z, b.x - a.x, b.z - a.z, 0.6), 1, `${a.id}→${b.id} runs along the ven's water`);
  }
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
  assert.equal(nearestNodeIndex(32, -33), nodeOf('watchtower'));
});

test('a route takes the trail when it is worth it, and goes straight when it is not', () => {
  const tower = PATH_NODES[nodeOf('watchtower')];
  // out past the watchtower: along the spawn→watchtower trail
  const far = planRoute(0, 0, tower.x + 4, tower.z - 8, MAP);
  assert.ok(far.onSand.some(Boolean), 'the far goal is reached along the trail');
  // the frisling, off to the south-west with no trail its way: straight across
  const fris = planRoute(3, 3, -15.56, -15.56, MAP);
  assert.ok(!fris.onSand.some(Boolean), 'no detour onto a trail that leads elsewhere');
});

test('no leg of a route off the sand runs through a building or the ven', () => {
  const starts: [number, number][] = [[0, 0], [-44, -26], [32, 18], [-58, 2], [30, -32], [50, 5], [8, -45]];
  for (const [sx, sz] of starts) {
    for (const [id, gx, gz] of MARKERS) {
      const r = planRoute(sx, sz, gx, gz, MAP);
      r.pts.slice(1).forEach((q, k) => {
        if (r.onSand[k]) return;
        const p = r.pts[k];
        for (const o of SOLIDS) {
          assert.equal(segmentEntry(o, p.x, p.z, q.x - p.x, q.z - p.z, 0.3), 1,
            `from (${sx}, ${sz}) to ${id}: the leg (${p.x.toFixed(1)}, ${p.z.toFixed(1)})→(${q.x.toFixed(1)}, ${q.z.toFixed(1)}) runs into (${o.x}, ${o.z})`);
        }
      });
    }
  }
});

test('from spawn to the frisling behind the cabin the route goes round the cabin', () => {
  const r = planRoute(0, 0, -15.56, -15.56, MAP);
  assert.ok(r.pts.length >= 3, 'not straight through the cabin');
});

test('near the goal the guide aims straight at it', () => {
  const guide = new RouteGuide(MAP);
  const goal = { x: 8, z: -3 };             // within DIRECT_R of the ranger, nothing between
  assert.ok(Math.hypot(goal.x, goal.z) <= DIRECT_R);
  const wp = guide.aim(0, 0, goal.x, goal.z);
  assert.ok(Math.hypot(wp.x - goal.x, wp.z - goal.z) < 1e-6);
});

/** Walk straight toward wherever the guide aims, 0.25 m a step, the way the old
 *  routesim did: the loop the parent found never reached missions 3-10. */
function follow(sx: number, sz: number, gx: number, gz: number): { reached: boolean; reversals: number; steps: number } {
  const guide = new RouteGuide(MAP);
  let x = sx, z = sz, reversals = 0, steps = 0;
  let lastDir: { x: number; z: number } | null = null;
  for (; steps < 1200; steps++) {
    if (Math.hypot(gx - x, gz - z) < 2.4) return { reached: true, reversals, steps };
    const wp = guide.aim(x, z, gx, gz);
    const dx = wp.x - x, dz = wp.z - z, d = Math.hypot(dx, dz);
    if (d < 1e-6) break;
    const dir = { x: dx / d, z: dz / d };
    if (lastDir && dir.x * lastDir.x + dir.z * lastDir.z < -0.3) reversals++; // the arrow swung back on itself
    lastDir = dir;
    x += dir.x * 0.25; z += dir.z * 0.25;
  }
  return { reached: false, reversals, steps };
}

test('heading where the arrow points reaches every mission from every start, with no swinging back', () => {
  // spawn, the west helipad (the parent's 20-leg loop), the east pad, the ecoduct, the tower
  const starts: [number, number][] = [[0, 0], [-44, -26], [32, 18], [-58, 2], [30, -32]];
  for (const [sx, sz] of starts) {
    for (const [id, gx, gz] of MARKERS) {
      const run = follow(sx, sz, gx, gz);
      assert.ok(run.reached, `from (${sx}, ${sz}) the arrow never led to ${id}`);
      assert.equal(run.reversals, 0, `from (${sx}, ${sz}) to ${id} the arrow swung back ${run.reversals}×`);
    }
  }
});

test('a node he cannot stand on never holds the arrow: past the ecoduct node he walks on', () => {
  // the parent's B2 walk: from the clearing west toward the ecoduct, goal beyond the BOA post
  const run = follow(-50, 0, -35, -19.37);
  assert.ok(run.reached);
});

/** The frog's marker by the ven, and the missiebord by the cabin (as r.board() reads them). */
const VEN_MARKER = { x: 24.5, z: -19 };
const BOARD = { x: 2.2, z: -5 };

test('a mission brought to him puts him where the arrow\'s walk comes in: 1.8 m out, on open ground', () => {
  for (const [sx, sz] of [[BOARD.x, BOARD.z], [0, 0], [-44, -26], [30, -32]]) {
    for (const [id, gx, gz] of MARKERS) {
      const a = arrivalSpot(sx, sz, gx, gz, MAP);
      assert.ok(Math.abs(Math.hypot(a.x - gx, a.z - gz) - 1.8) < 0.05, `from (${sx}, ${sz}) he never came in to ${id}`);
      for (const o of SOLIDS) assert.ok(obstacleGap(o, a.x, a.z) > 0, `brought to ${id} from (${sx}, ${sz}) he stands in a solid`);
    }
  }
  // from the clearing the frog's marker is reached along the trail past the bird hide
  const a = arrivalSpot(0, 0, VEN_MARKER.x, VEN_MARKER.z, MAP);
  assert.ok(a.z > VEN_MARKER.z, 'he comes in from the bird hide\'s side');
});

/** How much of the strip where a game is laid (2.5-6.5 m ahead, 2.4 m either side) is wet. */
function wetAhead(x: number, z: number, h: number): number {
  const fx = Math.sin(h), fz = Math.cos(h);
  let n = 0;
  for (let v = 2.5; v <= 6.51; v += 1) for (let u = -2.4; u <= 2.41; u += 1.2) if (obstacleGap(VEN, x + fx * v + fz * u, z + fz * v - fx * u) <= 0) n++;
  return n;
}

test('brought to the frog facing into the ven, he turns along the shore so its game is laid on dry ground ahead', () => {
  const dry = (x: number, z: number): boolean => obstacleGap(VEN, x, z) > 0;
  const at = arrivalSpot(BOARD.x, BOARD.z, VEN_MARKER.x, VEN_MARKER.z, MAP); // the walk from the missiebord
  const toMarker = Math.atan2(VEN_MARKER.x - at.x, VEN_MARKER.z - at.z);
  assert.ok(wetAhead(at.x, at.z, toMarker) > 0, 'facing the marker from here, the strip ahead is wet (the case this is for)');
  const h = openHeading(at.x, at.z, toMarker, dry);
  const turn = Math.abs(Math.atan2(Math.sin(h - toMarker), Math.cos(h - toMarker))) * 180 / Math.PI;
  assert.ok(turn > 1 && turn <= 50.01, `he turned ${turn.toFixed(0)}°`);
  assert.ok(wetAhead(at.x, at.z, h) < wetAhead(at.x, at.z, toMarker), 'the ground ahead is drier than straight at the marker');
  // on open ground he simply faces the marker
  assert.equal(openHeading(0, 0, 1.0, () => true), 1.0);
});
