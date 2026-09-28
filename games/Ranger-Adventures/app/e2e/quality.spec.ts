import { test, expect, type Page } from '@playwright/test';

/**
 * Slow-device contract (WORLD-PLAN W7.2): a PERSISTED 'laag' quality tier (a device
 * that stepped down last session) boots the world light: pixelRatio capped at
 * 1.25 x dpr and vegetation thinned to 0.55, so an older iPad starts playable. The
 * tier-knob consistency stat test was retired 2026-09-26 (internal numbers only).
 */

interface Quality {
  tier: 'hoog' | 'laag';
  pixelRatio: number;
  vegetationScale: number;
}
interface Hook {
  screen: string;
  drawCalls(): number | null;
  quality(): Quality | null;
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
  await expect
    .poll(() => hook(page, (r) => (r.quality() ? true : false)), { timeout: 15_000 })
    .toBe(true);
}

test('quality: a persisted laag tier boots the world light (slow-device contract)', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  // seed the shared alvah-ef-v1 blob (ranger namespace, no new key) with a prior
  // step-down verdict — a slow device that dropped last session.
  await page.addInitScript(() => {
    localStorage.setItem('alvah-ef-v1', JSON.stringify({ ranger: { settings: { kwaliteitTier: 'laag' } } }));
  });
  await enterWorld(page);

  const dpr = await page.evaluate(() => window.devicePixelRatio);
  // read immediately — before a probe window can step the tier back up on a fast
  // machine: the FIRST in-world frame already reflects the persisted seed.
  const q = await hook(page, (r) => r.quality());
  expect(q).not.toBeNull();
  expect(q!.tier).toBe('laag');
  expect(q!.pixelRatio).toBeCloseTo(Math.min(dpr, 1.25), 5); // fill-rate capped
  expect(q!.vegetationScale).toBe(0.55);                     // vegetation thinned
});

/**
 * The light mode (software GL: CI's SwiftShader; `?light=1` shows it on a GPU) has no
 * separate sparse title any more: the title is the world itself, built at boot in its
 * light form (the `laag` tier, pixelRatio 1, no shadow pass). Its veil waits at most a
 * short cap for the models, so Begin still comes quickly, and the picture stays inside
 * the draw-call budget.
 */
test('quality: the light-mode title is the light world, quick to Begin and in budget', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const t0 = Date.now();
  await page.goto('/?dev=1&light=1');
  await expect(page.getByRole('button', { name: 'Begin', exact: true })).toBeVisible({ timeout: 30_000 });
  const tBegin = (Date.now() - t0) / 1000;
  await expect(page.locator('.title-mark')).toHaveText('Ranger van de Veluwe');
  const mode = await page.evaluate(() => (window as unknown as { __ranger: { renderMode(): { light: boolean } | null } }).__ranger.renderMode());
  expect(mode?.light, 'the light mode is on').toBe(true);
  const q = await hook(page, (r) => r.quality());
  expect(q?.tier, 'the light world boots laag').toBe('laag');
  expect(q?.pixelRatio, 'at pixelRatio 1').toBe(1);
  expect(tBegin, `Begin after ${tBegin.toFixed(1)} s`).toBeLessThan(15);
  await page.waitForTimeout(500);
  const calls = await hook(page, (r) => r.drawCalls());
  expect(calls ?? 999, `draw calls on the light title: ${calls}`).toBeLessThan(150);
});
