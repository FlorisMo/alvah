import { test, expect } from '@playwright/test';
import { collectPageErrors, reportPageErrors } from './helpers';

/**
 * Budgets overlay gate (WORLD-PLAN W0.5). The draw-call/fps overlay is a dev
 * instrument, not player UI: it must appear ONLY behind `?dev=1`, never on a
 * plain boot — even though the dev server is `import.meta.env.DEV`. The draw
 * calls themselves stay readable by E2E through `window.__ranger.drawCalls()`
 * regardless, so gating the visible overlay costs the suite nothing.
 */

test('budgets: overlay ABSENT on plain boot (no ?dev flag)', async ({ page }, testInfo) => {
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await page.goto('/');
  await expect(page.locator('.boot-title')).toBeVisible();

  // No overlay in the DOM at all — the gate is construction-time, not CSS.
  await expect(page.locator('.budgets')).toHaveCount(0);

  // The draw-call channel is still live for the E2E suite via the dev hook.
  const drawCalls = await page.evaluate(() => {
    const r = (window as unknown as { __ranger?: { drawCalls: () => number | null } }).__ranger;
    return r ? r.drawCalls() : undefined;
  });
  expect(typeof drawCalls === 'number' || drawCalls === null).toBe(true);

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});

test('budgets: overlay PRESENT with ?dev=1', async ({ page }, testInfo) => {
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await page.goto('/?dev=1');
  await expect(page.locator('.boot-title')).toBeVisible();

  const overlay = page.locator('.budgets');
  await expect(overlay).toHaveCount(1);
  // It paints ~2x/second off the title backdrop's render loop — prove it fills.
  await expect(overlay).toContainText('draw calls');

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
