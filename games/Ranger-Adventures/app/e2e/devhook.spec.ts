import { test, expect } from '@playwright/test';
import { collectPageErrors, reportPageErrors } from './helpers';

/**
 * Dev-state hook (WORLD-PLAN W0.2). The E2E suite reads runtime STATE through
 * `window.__ranger` (gated behind DEV or ?dev=1; the dev server is DEV, so it
 * is present without the flag). This box's acceptance: `screen === 'title'` on
 * boot. Later boxes extend the same hook (pos, cameraYaw, missionView, clip).
 */
test('devhook: window.__ranger present on boot, screen === "title" @smoke', async ({ page }, testInfo) => {
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await page.goto('/');
  await expect(page.locator('.boot-title')).toBeVisible();

  const hook = await page.evaluate(() => {
    const r = (window as unknown as {
      __ranger?: { version: string; screen: string; missionView: unknown; drawCalls: () => number | null };
    }).__ranger;
    if (!r) return null;
    return { version: r.version, screen: r.screen, missionView: r.missionView, drawCalls: r.drawCalls() };
  });

  expect(hook, 'window.__ranger installed under DEV').not.toBeNull();
  expect(hook!.version).toBe('2.0.0-world');
  expect(hook!.screen).toBe('title');
  expect(hook!.missionView).toBeNull();
  // draw calls come from renderer.info — a number once the title backdrop renders.
  expect(typeof hook!.drawCalls === 'number' || hook!.drawCalls === null).toBe(true);

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
