import { test, expect } from '@playwright/test';
import { collectPageErrors, reportPageErrors } from './helpers';
import { isSoftwareRenderer } from '../src/core/quality';

/**
 * Dev-state hook (WORLD-PLAN W0.2). The E2E suite reads runtime STATE through
 * `window.__ranger` (gated behind DEV or ?dev=1: the smoke opens `?dev=1`, since CI
 * serves the production build). This box's acceptance: `screen === 'title'` on
 * boot. Later boxes extend the same hook (pos, cameraYaw, missionView, clip).
 */
test('devhook: window.__ranger present on boot, screen === "title" @smoke', async ({ page }, testInfo) => {
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await page.goto('/?dev=1'); // the hook; CI serves the production build, where only ?dev=1 installs it
  await expect(page.locator('.boot-title')).toBeVisible();

  const hook = await page.evaluate(() => {
    const r = (window as unknown as {
      __ranger?: { version: string; screen: string; missionView: unknown; drawCalls: () => number | null };
    }).__ranger;
    if (!r) return null;
    return { version: r.version, screen: r.screen, missionView: r.missionView, drawCalls: r.drawCalls() };
  });

  expect(hook, 'window.__ranger installed under ?dev=1').not.toBeNull();
  expect(hook!.version).toBe('2.1.0-ship');
  expect(hook!.screen).toBe('title');
  expect(hook!.missionView).toBeNull();
  // draw calls come from renderer.info — a number once the title backdrop renders.
  expect(typeof hook!.drawCalls === 'number' || hook!.drawCalls === null).toBe(true);

  // The light mode is on exactly when the GL draws in software: on CI's SwiftShader it
  // must be on (or the smoke crawls), on a laptop or iPad GPU it must be off (its
  // picture is never traded away). core/quality.ts decides it once at boot.
  const mode = await page.evaluate(() => (window as unknown as { __ranger: { renderMode(): { light: boolean; renderer: string | null } | null } }).__ranger.renderMode());
  expect(mode, 'renderMode() reports the boot decision').not.toBeNull();
  expect(mode!.light, `light mode ⇔ software GL (renderer: ${mode!.renderer})`).toBe(isSoftwareRenderer(mode!.renderer));

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
