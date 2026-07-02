import { test, expect } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors } from './helpers';

/**
 * Journey E2E (WORLD-PLAN W0.3). The full front-door path a first-time player
 * walks: title "Begin" → avatar creator "Dit is mijn ranger" → lodge → "Verken
 * de Veluwe (3D)" → the walkable world. Asserts the dev-state hook `screen`
 * transitions at each step and lands on `world`, with an artifact screenshot
 * per step for human review.
 *
 * Tagged `@smoke`: this folds world-reach into smoke v1 (§3.1). It is still
 * smoke v1 — NO movement assert yet. W0.4 adds tap-to-walk ≥2 m and freezes the
 * stronger smoke.
 */

/** Read the dev-hook `screen` (present because the dev server runs under DEV). */
function screen(page: import('@playwright/test').Page): Promise<string | null> {
  return page.evaluate(() => {
    const r = (window as unknown as { __ranger?: { screen: string } }).__ranger;
    return r ? r.screen : null;
  });
}

test('journey: Begin → avatar → lodge → world, screen reaches "world" @smoke', async ({ page }, testInfo) => {
  const errors: string[] = [];
  collectPageErrors(page, errors);

  // A fresh browser context has no saved avatar, so "Begin" routes through the
  // avatar creator — the genuine first-boot journey.
  await page.goto('/');
  await expect(page.locator('.boot-title')).toHaveText('Word boswachter');
  expect(await screen(page)).toBe('title');
  await shot(page, 'journey-1-title');

  // title → avatar creator
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.getByRole('button', { name: 'Dit is mijn ranger' })).toBeVisible();
  await expect.poll(() => screen(page)).toBe('avatar');
  await shot(page, 'journey-2-avatar');

  // avatar → lodge (mission picker)
  await page.getByRole('button', { name: 'Dit is mijn ranger' }).click();
  await expect(page.getByRole('button', { name: 'Verken de Veluwe (3D)' })).toBeVisible();
  await expect.poll(() => screen(page)).toBe('lodge');
  await shot(page, 'journey-3-lodge');

  // lodge → the walkable world
  await page.getByRole('button', { name: 'Verken de Veluwe (3D)' }).click();
  await expect.poll(() => screen(page), { timeout: 30_000 }).toBe('world');
  await shot(page, 'journey-4-world');

  await reportPageErrors(testInfo, errors);
  expect(errors, 'no uncaught errors across the journey').toEqual([]);
});
