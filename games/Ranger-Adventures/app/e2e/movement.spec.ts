import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors } from './helpers';

/**
 * Movement red-first E2E (WORLD-PLAN W0.4). The prep session's headless taps
 * moved the ranger nothing — the single core bug run 2 exists to fix. This spec
 * taps the ground a few metres ahead of the ranger and polls `pos()` for a
 * ≥2 m delta. Written red-first; once green it is folded into `e2e:smoke` and
 * the stronger smoke is FROZEN (§3.1).
 */

interface Hook {
  screen: string;
  pos(): { x: number; z: number } | null;
}
function hook<T>(page: Page, fn: (r: Hook) => T): Promise<T | null> {
  return page.evaluate((body) => {
    const r = (window as unknown as { __ranger?: unknown }).__ranger;
    // eslint-disable-next-line no-new-func
    return r ? (new Function('r', `return (${body})(r)`))(r) : null;
  }, fn.toString()) as Promise<T | null>;
}

/** Drive title → avatar → lodge → world; return once screen === 'world'. */
async function enterWorld(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByRole('button', { name: 'Dit is mijn ranger' }).click();
  await page.getByRole('button', { name: 'Verken de Veluwe (3D)' }).click();
  await expect.poll(() => hook(page, (r) => r.screen), { timeout: 30_000 }).toBe('world');
}

test('movement: tap-to-walk moves the ranger ≥2 m @smoke', async ({ page }, testInfo) => {
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await enterWorld(page);

  const start = await hook(page, (r) => r.pos());
  expect(start, 'pos() available once in world').not.toBeNull();

  const canvas = page.locator('canvas#scene');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  // Tap the ground ahead of the ranger (upper-middle of the canvas maps to the
  // terrain in front of him — the camera sits behind, looking forward).
  const tapX = box!.x + box!.width * 0.5;
  const tapY = box!.y + box!.height * 0.32;
  await page.mouse.click(tapX, tapY);

  await shot(page, 'movement-after-tap');

  await expect
    .poll(async () => {
      const p = await hook(page, (r) => r.pos());
      if (!p || !start) return 0;
      return Math.hypot(p.x - start.x, p.z - start.z);
    }, { timeout: 20_000, message: 'ranger should walk ≥2 m toward the tapped ground' })
    .toBeGreaterThanOrEqual(2);

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
