import { test, expect, type Page } from '@playwright/test';

/**
 * Ven-water comfort law (WORLD-PLAN W4.8): under reduced-motion the fresnel disc
 * is waveless and its clock frozen (Alvah is motion-sensitive). The motion-on
 * ripple/budget stat test was retired 2026-09-26 (numbers only; the golden path
 * measures the budget where the player goes).
 */

interface Water {
  shader: boolean;
  amp: number;
  time: number;
}
interface Hook {
  screen: string;
  drawCalls(): number | null;
  water(): Water | null;
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
  // wait for the first update() frame to drive the water uniforms
  await expect
    .poll(() => hook(page, (r) => (r.water() ? r.water()!.shader : false)), { timeout: 15_000 })
    .toBe(true);
}

test('ven-water: waveless and frozen under reduced-motion (comfort law)', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enterWorld(page);

  const a = await hook(page, (r) => r.water());
  expect(a).not.toBeNull();
  expect(a!.shader).toBe(true);   // the fresnel tint stays — only the ripple is gone
  expect(a!.amp).toBe(0);         // amplitude is EXACTLY 0 → waveless

  await page.waitForTimeout(2200);
  const b = await hook(page, (r) => r.water());
  expect(b!.amp).toBe(0);         // still waveless
  expect(b!.time).toBe(a!.time);  // the shared clock never advances → dead-still
});
