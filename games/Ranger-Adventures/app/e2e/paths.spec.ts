import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors } from './helpers';

/**
 * Sand-path network E2E (WORLD-PLAN W4.3). The world now carries a terrain-hugging
 * sand-path network connecting the spawn clearing to every POI, and the wayfinding
 * cue follows those paths (routeVia — unit-tested in Paths.test.ts). This spec
 * proves the player-visible half:
 *   1) the network is placed and is ONE connected graph — spawn reaches every POI
 *      node over the segments (the §4 "connect spawn and the POIs" requirement);
 *   2) the nodes sit on the W4.1 landmark anchors (a path leads to each beacon);
 *   3) the added ribbon mesh stays within budget (`drawCalls()` < 150) BOTH at
 *      spawn AND after walking a spoke, so the sand paths cost is one draw call.
 *
 * Not a @smoke test — the frozen movement smoke is untouched; this is the box's
 * own acceptance assert. Navigation reuses the camera-relative arrow walk.
 */

interface Node { id: string; x: number; z: number }
interface Net { nodes: Node[]; segments: [number, number][] }
interface Prop { id: string; x: number; z: number }
interface Hook {
  screen: string;
  pos(): { x: number; z: number } | null;
  cameraYaw(): number | null;
  drawCalls(): number | null;
  paths(): Net | null;
  landmarks(): Prop[] | null;
}
function hook<T>(page: Page, fn: (r: Hook) => T): Promise<T | null> {
  return page.evaluate((body) => {
    const r = (window as unknown as { __ranger?: unknown }).__ranger;
    // eslint-disable-next-line no-new-func
    return r ? (new Function('r', `return (${body})(r)`))(r) : null;
  }, fn.toString()) as Promise<T | null>;
}

async function enterWorld(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByRole('button', { name: 'Dit is mijn ranger' }).click();
  await expect.poll(() => hook(page, (r) => r.screen), { timeout: 30_000 }).toBe('world');
}

const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const;

async function walkTo(page: Page, tx: number, tz: number, arrive: number): Promise<number> {
  const down = new Set<string>();
  const sync = async (want: Set<string>): Promise<void> => {
    for (const k of KEYS) {
      if (want.has(k) && !down.has(k)) { await page.keyboard.down(k); down.add(k); }
      else if (!want.has(k) && down.has(k)) { await page.keyboard.up(k); down.delete(k); }
    }
  };
  let dist = Infinity;
  try {
    for (let i = 0; i < 260; i++) {
      const p = await hook(page, (r) => r.pos());
      const yaw = await hook(page, (r) => r.cameraYaw());
      if (!p || yaw == null) { await page.waitForTimeout(100); continue; }
      const dx = tx - p.x, dz = tz - p.z;
      dist = Math.hypot(dx, dz);
      if (dist <= arrive) return dist;
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const sx = dx * cy - dz * sy;
      const sYf = -dx * sy - dz * cy;
      const want = new Set<string>();
      if (sx > 0.4) want.add('ArrowRight');
      else if (sx < -0.4) want.add('ArrowLeft');
      if (sYf > 0.4) want.add('ArrowUp');
      else if (sYf < -0.4) want.add('ArrowDown');
      await sync(want);
      await page.waitForTimeout(120);
    }
    return dist;
  } finally {
    await sync(new Set());
  }
}

test('paths: sand-path network connects spawn to every POI, budget holds', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await enterWorld(page);

  const net = await hook(page, (r) => r.paths());
  expect(net, 'paths() available in the world').not.toBeNull();
  const { nodes, segments } = net!;

  // every §4 POI node exists, and spawn is at the clearing centre.
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const id of ['spawn', 'watchtower', 'birdhide', 'stuifzand', 'boa', 'ecoduct']) {
    expect(byId.has(id), `node ${id} present`).toBe(true);
  }
  const spawn = byId.get('spawn')!;
  expect(Math.hypot(spawn.x, spawn.z), 'spawn node at the clearing centre').toBeLessThan(2);

  // ONE connected network: spawn reaches every node over the segments (BFS).
  const adj: number[][] = nodes.map(() => []);
  for (const [i, j] of segments) { adj[i].push(j); adj[j].push(i); }
  const spawnIdx = nodes.findIndex((n) => n.id === 'spawn');
  const seen = new Set<number>([spawnIdx]);
  const queue = [spawnIdx];
  while (queue.length) {
    const u = queue.shift()!;
    for (const v of adj[u]) if (!seen.has(v)) { seen.add(v); queue.push(v); }
  }
  expect(seen.size, 'spawn reaches every route node').toBe(nodes.length);

  // the nodes sit on the W4.1 landmark anchors — a path leads to each beacon.
  const landmarks = await hook(page, (r) => r.landmarks());
  const tower = landmarks!.find((l) => l.id === 'prop-fire-watchtower')!;
  const wtNode = byId.get('watchtower')!;
  expect(Math.hypot(wtNode.x - tower.x, wtNode.z - tower.z), 'watchtower path node on its beacon').toBeLessThan(3);

  // budget at spawn.
  await shot(page, 'paths-at-spawn');
  const spawnCalls = await hook(page, (r) => r.drawCalls());
  expect(spawnCalls, 'drawCalls() available').not.toBeNull();
  expect(spawnCalls!, 'draw calls under 150 at spawn').toBeLessThan(150);

  // walk a spoke so the ribbon is squarely in frustum, then re-check the budget.
  await walkTo(page, tower.x, tower.z, 8);
  await shot(page, 'paths-along-spoke');
  const spokeCalls = await hook(page, (r) => r.drawCalls());
  expect(spokeCalls, 'drawCalls() available along the spoke').not.toBeNull();
  expect(spokeCalls!, 'draw calls under 150 walking the path').toBeLessThan(150);

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
