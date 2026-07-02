import { test, expect } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors } from './helpers';

/**
 * Boot smoke (WORLD-PLAN W0.1, smoke v1 = boot only).
 *
 * The floor of the browser-proof contract: the app loads, the render canvas is
 * present, the title card shows, and NOTHING throws during boot. W0.3 extends
 * smoke to world-reach; W0.4 adds the movement assert and freezes it.
 */
test('boot: page loads, canvas present, title shows, zero pageerrors @smoke', async ({ page }, testInfo) => {
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await page.goto('/');

  // The render canvas mounts immediately (Stage constructs it in main.ts).
  const canvas = page.locator('canvas#scene');
  await expect(canvas).toBeVisible();

  // The title card is the first screen ("Word boswachter" + a "Begin" button).
  await expect(page.locator('.boot-title')).toHaveText('Word boswachter');
  await expect(page.getByRole('button', { name: 'Begin' })).toBeVisible();

  await shot(page, 'boot-title');

  await reportPageErrors(testInfo, errors);
  expect(errors, 'no uncaught errors during boot').toEqual([]);
});
