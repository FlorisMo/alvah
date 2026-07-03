import { test, expect } from '@playwright/test';

/**
 * W7.4 SHIP proof — the production site build, served by `astro preview`,
 * boots the ranger world behind a pre-seeded access gate.
 *
 * This is the ONLY spec that runs against the real `--mode site` artifact
 * (fixed-name `/ranger/app.js`, code-split vendor/mission chunks, base
 * `/ranger/`, `import.meta.env.DEV === false`) instead of the vite dev server.
 * It proves three things the dev suite structurally cannot:
 *   1. the BaseLayout access gate can be bypassed with the presence-only
 *      `sessionStorage['alvah-gate-v1']` key (never the password — the gate is
 *      documented as intentionally bypassable, WORLD-PLAN §7),
 *   2. the shipped bundle reports the shipped VERSION (`2.1.0-ship`) — the same
 *      value the live curl check confirms after deploy, proving the site served
 *      the freshly-built app.js and not a stale cache,
 *   3. the full lazy graph (vendor + Missions + AvatarCreator chunks) loads and
 *      runs under the `/ranger/` base path all the way to a live world.
 *
 * The production hook `window.__ranger` is gated `import.meta.env.DEV || ?dev=1`;
 * DEV is false in the site build, so we navigate with `?dev=1`. The SPA keeps
 * the query across the title→avatar→world flow (no real navigation).
 */

/** Read the production dev-hook `screen` (exposed via `?dev=1`). */
function screen(page: import('@playwright/test').Page): Promise<string | null> {
  return page.evaluate(() => {
    const r = (window as unknown as { __ranger?: { screen: string } }).__ranger;
    return r ? r.screen : null;
  });
}

test('ship: site build boots the world behind the pre-seeded gate, reports 2.1.0-ship', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  // Pre-seed the presence-only gate BEFORE any page script runs, so the
  // BaseLayout gate check (`if (!sessionStorage.getItem('alvah-gate-v1'))`)
  // short-circuits and the game shell is revealed. Never scripts the password.
  await page.addInitScript(() => {
    sessionStorage.setItem('alvah-gate-v1', '1');
  });

  // The real shipped route, with the dev hook opened for state asserts.
  await page.goto('/ranger/?dev=1');

  // Gate bypassed → the game shell mounts; the boot title renders from the
  // production bundle.
  await expect(page.locator('canvas#scene')).toBeVisible();
  await expect(page.locator('.boot-title')).toHaveText('Word boswachter', { timeout: 30_000 });

  // The SHIPPED bundle reports the SHIPPED version — the same string the live
  // curl asserts after deploy.
  const version = await page.evaluate(
    () => (window as unknown as { __ranger?: { version: string } }).__ranger?.version ?? null,
  );
  expect(version, 'production bundle reports the ship version').toBe('2.1.0-ship');
  expect(await screen(page)).toBe('title');

  // Full journey on the production bundle: title → avatar → live world. This
  // exercises the lazy vendor/Missions/AvatarCreator chunks under `/ranger/`.
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.getByRole('button', { name: 'Dit is mijn ranger' })).toBeVisible({
    timeout: 30_000,
  });
  await expect.poll(() => screen(page), { timeout: 30_000 }).toBe('avatar');

  await page.getByRole('button', { name: 'Dit is mijn ranger' }).click();
  await expect.poll(() => screen(page), { timeout: 60_000 }).toBe('world');

  // The shipped world HUD is coherent (same front-door assert as journey.spec).
  await expect(page.locator('.explore-pause')).toBeVisible();

  if (errors.length) {
    test.info().attach('pageerrors', { body: errors.join('\n'), contentType: 'text/plain' });
  }
  expect(errors, 'no uncaught errors booting the shipped bundle').toEqual([]);
});
