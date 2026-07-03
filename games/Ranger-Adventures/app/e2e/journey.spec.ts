import { test, expect } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors } from './helpers';

/**
 * Journey E2E (WORLD-PLAN W0.3, updated for W2.1). The world is now the FRONT
 * DOOR: title "Begin" → avatar creator "Dit is mijn ranger" → straight into the
 * walkable world. No lodge stop, no "Verken de Veluwe (3D)" button — that is
 * W2.1's acceptance: `screen === 'world'` within ≤ 2 clicks of the title. Asserts
 * the dev-state hook `screen` transitions at each step, with an artifact
 * screenshot per step for human review.
 *
 * Tagged `@smoke`: this folds world-reach into smoke v1 (§3.1). It is still
 * smoke v1 — NO movement assert here (movement.spec.ts owns the frozen ≥2 m
 * assert). W2.4b removed the interim "Terug naar de hut" pill; the in-world menu
 * is now the "Pauze" pill (prikbord + raaf + instellingen + badges), asserted
 * present here so the front door still lands on a coherent HUD.
 */

/** Read the dev-hook `screen` (present because the dev server runs under DEV). */
function screen(page: import('@playwright/test').Page): Promise<string | null> {
  return page.evaluate(() => {
    const r = (window as unknown as { __ranger?: { screen: string } }).__ranger;
    return r ? r.screen : null;
  });
}

test('journey: Begin → avatar → world (≤2 clicks), screen reaches "world" @smoke', async ({ page }, testInfo) => {
  const errors: string[] = [];
  collectPageErrors(page, errors);

  // A fresh browser context has no saved avatar, so "Begin" routes through the
  // avatar creator — the genuine first-boot journey.
  await page.goto('/');
  await expect(page.locator('.boot-title')).toHaveText('Word boswachter');
  expect(await screen(page)).toBe('title');
  await shot(page, 'journey-1-title');

  // click 1: title → avatar creator
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.getByRole('button', { name: 'Dit is mijn ranger' })).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => screen(page)).toBe('avatar');
  await shot(page, 'journey-2-avatar');

  // click 2: avatar → STRAIGHT into the walkable world (W2.1: no lodge stop).
  await page.getByRole('button', { name: 'Dit is mijn ranger' }).click();
  await expect.poll(() => screen(page), { timeout: 30_000 }).toBe('world');
  await shot(page, 'journey-3-world');

  // The lodge is no longer reachable in normal play (W2.4b). The world HUD's
  // single menu entry is the Pauze pill (opens the in-world hub).
  await expect(page.locator('.explore-pause')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Terug naar de hut' })).toHaveCount(0);

  await reportPageErrors(testInfo, errors);
  expect(errors, 'no uncaught errors across the journey').toEqual([]);
});
