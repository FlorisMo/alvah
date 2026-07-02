import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors } from './helpers';

/**
 * Nature-dressing E2E (WORLD-PLAN W4.2). The world is now dressed with real GLB
 * props clustered at the POIs and biome cores — trees, a forest floor (stumps,
 * logs, snags, mushrooms, ferns), boulders, foxgloves, junipers and ven-shore
 * reeds — layered on top of the instanced-primitive filler. This spec proves:
 *   1) every dressing kind is placed and a real tree cluster sits by a POI (the
 *      watchtower grove), i.e. trees are near landmarks, not scattered at random;
 *   2) the draw-call budget still holds (`drawCalls()` < 150) BOTH at spawn AND
 *      after walking into the densest grove, so the added GLBs stay within §3.4.
 *
 * Not a @smoke test — the frozen movement smoke is untouched; this is the box's
 * own acceptance assert. Navigation reuses the camera-relative arrow walk from
 * landmarks.spec.
 */

interface Prop { id: string; x: number; z: number }
interface Hook {
  screen: string;
  pos(): { x: number; z: number } | null;
  cameraYaw(): number | null;
  drawCalls(): number | null;
  dressing(): Prop[] | null;
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

/** Steer the ranger toward a fixed world target (camera-relative, mirrors
 *  landmarks.spec). Returns the final distance to the target. */
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

test('dressing: biomes carry real GLB props, budget holds in the grove', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await enterWorld(page);

  const dressing = await hook(page, (r) => r.dressing());
  expect(dressing, 'dressing() available in the world').not.toBeNull();
  const ids = dressing!.map((d) => d.id);
  // every dressing kind the box names is placed: trees, forest floor, rocks,
  // heide/stuifzand flora and ven reeds.
  for (const id of [
    'prop-pine-scots', 'prop-oak-tree', 'prop-birch-tree',
    'prop-tree-stump', 'prop-fallen-log', 'prop-dead-snag',
    'prop-boulder', 'prop-mushrooms', 'prop-fern',
    'prop-foxglove', 'prop-juniper-bush', 'prop-reeds',
  ]) {
    expect(ids, `${id} placed`).toContain(id);
  }

  // real trees are CLUSTERED near a POI: at least one tree within 8 m of the
  // watchtower landmark (the grove), proving they dress the POIs, not random.
  const landmarks = await hook(page, (r) => r.landmarks());
  const tower = landmarks!.find((l) => l.id === 'prop-fire-watchtower')!;
  const treesNearTower = dressing!.filter(
    (d) => /pine|oak|birch/.test(d.id) && Math.hypot(d.x - tower.x, d.z - tower.z) <= 8,
  );
  expect(treesNearTower.length, 'a real tree grove hugs the watchtower').toBeGreaterThanOrEqual(2);

  // budget at spawn.
  await shot(page, 'dressing-at-spawn');
  const spawnCalls = await hook(page, (r) => r.drawCalls());
  expect(spawnCalls, 'drawCalls() available').not.toBeNull();
  expect(spawnCalls!, 'draw calls under 150 at spawn').toBeLessThan(150);

  // walk into the densest grove (the watchtower) so the GLB cluster renders,
  // then re-check the budget with the dressing in frustum.
  await walkTo(page, tower.x, tower.z, 6);
  await shot(page, 'dressing-in-grove');
  const groveCalls = await hook(page, (r) => r.drawCalls());
  expect(groveCalls, 'drawCalls() available in the grove').not.toBeNull();
  expect(groveCalls!, 'draw calls under 150 inside the grove').toBeLessThan(150);

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
