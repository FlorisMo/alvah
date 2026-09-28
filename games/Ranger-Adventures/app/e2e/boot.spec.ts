import { test, expect } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors } from './helpers';

/**
 * Boot smoke (WORLD-PLAN W0.1, smoke v1 = boot only).
 *
 * The floor of the browser-proof contract: the app loads, the render canvas is
 * present, the title shows over the world, and NOTHING throws during boot. W0.3 extends
 * smoke to world-reach; W0.4 adds the movement assert and freezes it. Since run 6 the
 * world itself is built at boot behind the paper veil, and the title is a shot of it.
 */
test('boot: page loads, canvas present, title shows, zero pageerrors @smoke', async ({ page }, testInfo) => {
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await page.goto('/');

  // The render canvas mounts immediately (Stage constructs it in main.ts).
  const canvas = page.locator('canvas#scene');
  await expect(canvas).toBeVisible();

  // The veil lifts onto the title: the game's name, one line of story and "Begin".
  await expect(page.locator('.title-mark')).toHaveText('Ranger van de Veluwe', { timeout: 60_000 });
  await expect(page.locator('.title-sub')).toHaveText('Word de nieuwe boswachter.');
  await expect(page.getByRole('button', { name: 'Begin' })).toBeVisible();
  await expect(page.locator('.boot-veil')).toHaveCount(0, { timeout: 10_000 }); // the veil is gone, not just see-through

  await shot(page, 'boot-title');

  await reportPageErrors(testInfo, errors);
  expect(errors, 'no uncaught errors during boot').toEqual([]);
});
