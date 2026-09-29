import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors } from './helpers';

/**
 * Onboarding-hint E2E (WORLD-PLAN W1.6). On the first world entry a hint appears
 * (icon + "Loop met de pijltjes." on the desktop test pointer), it dismisses
 * itself the moment the ranger takes his first step, and the seen-flag persists
 * into the shared `alvah-ef-v1` blob so it never shows again.
 *
 * The hint is a plain DOM node (`.explore-onboard`) over the live world, so this
 * asserts on the DOM directly — no dev-hook needed for presence/absence.
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

async function enterWorld(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByRole('button', { name: 'Dit is mijn ranger' }).click();
  await expect.poll(() => hook(page, (r) => r.screen), { timeout: 30_000 }).toBe('world');
}

test('onboarding: first-entry hint shows, dismisses on first step, seen-flag persists', async ({ page }, testInfo) => {
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await enterWorld(page);

  // (1) the hint is on screen on first entry, with its device-aware copy.
  const hint = page.locator('.explore-onboard');
  await expect(hint).toBeVisible();
  await expect(hint).toContainText('pijltjes'); // desktop pointer → arrow-keys line
  await shot(page, 'onboarding-first-entry');

  // (2) it dismisses itself once the ranger actually walks (his first step).
  const start = await hook(page, (r) => r.pos());
  expect(start, 'pos() available in world').not.toBeNull();
  await page.keyboard.down('ArrowUp');
  try {
    await expect
      .poll(async () => {
        const p = await hook(page, (r) => r.pos());
        return p ? Math.hypot(p.x - start!.x, p.z - start!.z) : 0;
      }, { timeout: 20_000 })
      .toBeGreaterThanOrEqual(2);
  } finally {
    await page.keyboard.up('ArrowUp');
  }
  await expect(hint).toHaveCount(0);

  // (3) the seen-flag persisted into the shared blob → the hint never returns.
  const blob = await page.evaluate(() => localStorage.getItem('alvah-ef-v1'));
  expect(blob ?? '').toContain('"wereldHintGezien":true');

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});

/**
 * Run 6: once per save, after his first ~15 m on foot, the one-tip channel teaches the
 * run: "Houd Shift in om te rennen." on screen and read aloud (the words the voice gets,
 * from a hook on speechSynthesis.speak). It never comes back after a reload.
 */
test('onboarding: after his first metres the Shift tip shows once and reads aloud', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);
  await page.addInitScript(() => {
    const w = window as unknown as { __said: string[] };
    w.__said = [];
    const synth = window.speechSynthesis;
    if (synth) {
      const orig = synth.speak.bind(synth);
      synth.speak = (u: SpeechSynthesisUtterance) => { w.__said.push(u.text); try { orig(u); } catch { /* no voice */ } };
    }
  });
  await enterWorld(page);
  const TIP = 'Houd Shift in om te rennen.';
  const start = (await hook(page, (r) => r.pos()))!;
  const tip = page.locator('.explore-tip', { hasText: TIP });
  await page.keyboard.down('ArrowUp');
  try {
    // the walk hint seals at the first step and the tap tip shows first; the run tip only
    // once he has walked ~15 m and the tap tip has gone
    await expect(tip, 'the run tip shows after his first metres').toBeVisible({ timeout: 25_000 });
  } finally {
    await page.keyboard.up('ArrowUp');
  }
  const p = (await hook(page, (r) => r.pos()))!;
  expect(Math.hypot(p.x - start.x, p.z - start.z), 'not before ~15 m on foot').toBeGreaterThanOrEqual(13);
  await shot(page, 'onboarding-run-tip');
  const said = await page.evaluate(() => (window as unknown as { __said: string[] }).__said.slice());
  expect(said.some((t) => t.includes(TIP)), 'the run tip is read aloud').toBe(true);
  const blob = await page.evaluate(() => localStorage.getItem('alvah-ef-v1'));
  expect(blob ?? '').toContain('"renHintGezien":true');

  // a reload never shows it again
  await page.reload();
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect.poll(() => hook(page, (r) => r.screen), { timeout: 30_000 }).toBe('world');
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(9_000);
  await page.keyboard.up('ArrowUp');
  await expect(page.locator('.explore-tip', { hasText: TIP }), 'once per save').toHaveCount(0);

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
