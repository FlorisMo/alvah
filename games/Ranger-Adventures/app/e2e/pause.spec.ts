import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors } from './helpers';

/**
 * Pause / hub-overlay shell E2E (WORLD-PLAN W2.4a, extended W2.4b). A "Pauze"
 * pill on the explore HUD opens a light menu over the LIVE world — prikbord +
 * raaf-companion + instellingen + badges — WITHOUT `leaveWorld`, so `screen`
 * stays 'world' and the scene survives behind the card. Instellingen + badges
 * return to the hub; the prikbord + raaf return to the open plek; the hub's own
 * back ("Terug naar de open plek") returns to the explore HUD in-place.
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

/** Drive title → avatar → world (W2.1: world is the front door). */
async function enterWorld(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByRole('button', { name: 'Dit is mijn ranger' }).click();
  await expect.poll(() => hook(page, (r) => r.screen), { timeout: 30_000 }).toBe('world');
}

test('pause: hub shell reaches prikbord + raaf + instellingen + badges over the live world', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await enterWorld(page);

  // 1) open the pause hub from the HUD pill — the world SURVIVES (no leaveWorld).
  await page.locator('.explore-pause').click();
  await expect(page.locator('.ph-back'), 'the pause hub opens').toBeVisible();
  expect(await hook(page, (r) => r.screen), 'world survives behind the hub').toBe('world');
  expect(await hook(page, (r) => r.pos()), 'world scene still live').not.toBeNull();
  await shot(page, 'pause-hub');

  // 2) instellingen reachable without leaveWorld; "Klaar" returns to the hub.
  await page.locator('.ph-tweaks').click();
  await expect(page.locator('.tweaks'), 'Instellingen opens over the world').toBeVisible();
  expect(await hook(page, (r) => r.screen), 'world survives behind Instellingen').toBe('world');
  await page.getByRole('button', { name: 'Klaar' }).click();
  await expect(page.locator('.ph-back'), 'back at the hub after Instellingen').toBeVisible();

  // 3) badges reachable without leaveWorld; its back returns to the hub.
  await page.locator('.ph-badges').click();
  await expect(page.locator('.badge-row'), 'badges open over the world').toBeVisible();
  expect(await hook(page, (r) => r.screen), 'world survives behind badges').toBe('world');
  await page.getByRole('button', { name: 'Terug' }).click();
  await expect(page.locator('.ph-back'), 'back at the hub after badges').toBeVisible();

  // 4) prikbord folded into the hub (W2.4b): opens over the live world; its own
  //    "Verder op patrouille" returns to the world HUD.
  await page.locator('.ph-prikbord').click();
  await expect(page.locator('.case-board'), 'the prikbord opens over the world').toBeVisible();
  expect(await hook(page, (r) => r.screen), 'world survives behind the prikbord').toBe('world');
  await page.getByRole('button', { name: 'Verder op patrouille' }).click();
  await expect(page.locator('.explore-hud'), 'back in the world after the prikbord').toBeVisible();

  // 5) raaf-companion folded into the hub (W2.4b): reopen the hub, open the raaf;
  //    its "Terug naar de open plek" returns to the world HUD.
  await page.locator('.explore-pause').click();
  await page.locator('.ph-companion').click();
  await expect(page.locator('.cabin'), 'the raaf-companion opens over the world').toBeVisible();
  expect(await hook(page, (r) => r.screen), 'world survives behind the raaf').toBe('world');
  await shot(page, 'pause-raaf');
  await page.getByRole('button', { name: 'Terug naar de open plek' }).click();
  await expect(page.locator('.explore-hud'), 'back in the world after the raaf').toBeVisible();

  // 6) reopen + close the hub → the explore HUD returns in-place, still 'world'.
  await page.locator('.explore-pause').click();
  await page.getByRole('button', { name: 'Terug naar de open plek' }).click();
  await expect(page.locator('.explore-hud'), 'the explore HUD returns').toBeVisible();
  expect(await hook(page, (r) => r.screen), 'still in the world after closing').toBe('world');
  await shot(page, 'pause-closed');

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
