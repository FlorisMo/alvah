import { test, expect, type Page } from '@playwright/test';

/**
 * Ground-detail E2E (WORLD-PLAN W4.4). The world floor gained a procedural
 * gouache albedo — a per-vertex brightness wash + a repeating painterly mottle
 * canvas (`GroundDetail.ts`), no external texture, no extra draw calls. This spec:
 *   1) asserts the detail layers are ON by default (mottle map bound, tiling)
 *      and OFF under `?groundDetail=off` (the reproducible before/after toggle);
 *   2) asserts the draw-call budget still holds (`drawCalls()` < 150) — the
 *      detail is one shared texture on the existing single ground draw call;
 *   3) shoots the curated before (flat slab) / after (detailed) pair into the
 *      tracked qa-evidence-2/ folder for human review.
 *
 * Not a @smoke test — the frozen movement smoke is untouched; this is the box's
 * own acceptance assert.
 */

interface Hook {
  screen: string;
  drawCalls(): number | null;
  groundDetail(): { on: boolean; textured: boolean; tileRepeat: number } | null;
}
function hook<T>(page: Page, fn: (r: Hook) => T): Promise<T | null> {
  return page.evaluate((body) => {
    const r = (window as unknown as { __ranger?: unknown }).__ranger;
    // eslint-disable-next-line no-new-func
    return r ? (new Function('r', `return (${body})(r)`))(r) : null;
  }, fn.toString()) as Promise<T | null>;
}

async function enterWorld(page: Page, query = ''): Promise<void> {
  await page.goto(`/${query}`);
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByRole('button', { name: 'Dit is mijn ranger' }).click();
  await expect.poll(() => hook(page, (r) => r.screen), { timeout: 30_000 }).toBe('world');
}

/** Walk forward into the open heath so the follow-cam looks over a clear ground
 *  swath (dismisses the onboarding hint too), then hold still for a settled shot. */
async function walkIntoOpenGround(page: Page): Promise<void> {
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(2600);
  await page.keyboard.up('ArrowUp');
  await page.waitForTimeout(1200);
}

test('ground detail is on by default and stays within the draw-call budget', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterWorld(page);
  const gd = await hook(page, (r) => r.groundDetail());
  expect(gd).not.toBeNull();
  expect(gd!.on).toBe(true);
  expect(gd!.textured).toBe(true);           // the mottle map is bound
  expect(gd!.tileRepeat).toBeGreaterThan(1); // and it repeats over the terrain
  const calls = await hook(page, (r) => r.drawCalls());
  expect(calls).not.toBeNull();
  expect(calls!).toBeLessThan(150);          // detail added no draw calls
  await walkIntoOpenGround(page);
  await page.screenshot({ path: '../qa-evidence-2/w44-ground-after-detailed.png' });
});

test('ground detail toggles off with ?groundDetail=off (the before baseline)', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterWorld(page, '?groundDetail=off');
  const gd = await hook(page, (r) => r.groundDetail());
  expect(gd).not.toBeNull();
  expect(gd!.on).toBe(false);
  expect(gd!.textured).toBe(false);          // flat per-biome slab, no map
  await walkIntoOpenGround(page);
  await page.screenshot({ path: '../qa-evidence-2/w44-ground-before-flat.png' });
});
