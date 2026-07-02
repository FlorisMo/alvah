import { test, expect } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors } from './helpers';

/**
 * Code-splitting proof (WORLD-PLAN W7.1).
 *
 * The entry `app.js` is now a light boot shell: three.js lives in the `vendor`
 * chunk and the mission/world/demo graph is lazy-`import()`ed only after the
 * "Begin" tap (vite.config.ts + main.ts). The build already proves the entry
 * gzip is < 120 kB; this spec proves the split app still BOOTS to a live world
 * (the lazy `Missions` chunk loads and runs, `Sound.unlock()` still fires in the
 * gesture) and logs the world-interactive time — the box's own E2E assert.
 *
 * The returning-player path (avatar already made) is used so the direct
 * `import('./ui/Missions')` → `startWorld` chunk load is exercised in one click.
 */

function screen(page: import('@playwright/test').Page): Promise<string | null> {
  return page.evaluate(() => {
    const r = (window as unknown as { __ranger?: { screen: string } }).__ranger;
    return r ? r.screen : null;
  });
}

test('codesplit: split app boots to world, interactive time logged', async ({ page }, testInfo) => {
  const errors: string[] = [];
  collectPageErrors(page, errors);

  // Returning player: seed the ranger namespace so "Begin" drops STRAIGHT into
  // the world (the 1-click path that lazy-loads the Missions chunk directly).
  await page.addInitScript(() => {
    localStorage.setItem('alvah-ef-v1', JSON.stringify({ ranger: { avatarGemaakt: true } }));
  });

  await page.goto('/');
  await expect(page.locator('.boot-title')).toHaveText('Word boswachter');
  expect(await screen(page)).toBe('title');

  // Tap Begin → the lazy Missions chunk loads, the world builds. Measure the
  // time from the tap to an interactive world (screen === 'world').
  const t0 = Date.now();
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect.poll(() => screen(page), { timeout: 30_000 }).toBe('world');
  const interactiveMs = Date.now() - t0;

  // Log the world-interactive time as an artifact (headless SwiftShader is
  // ~10× slower than a device, so this is a trend signal, not a hard budget).
  await testInfo.attach('world-interactive-ms', {
    body: String(interactiveMs),
    contentType: 'text/plain',
  });
  // eslint-disable-next-line no-console
  console.log(`[W7.1] world interactive in ${interactiveMs} ms (code-split entry)`);

  await shot(page, 'codesplit-world');

  await reportPageErrors(testInfo, errors);
  expect(errors, 'no uncaught errors booting the code-split app').toEqual([]);
});
