import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors } from './helpers';

/**
 * Onboarding E2E (run 6, FLOW P2: the lessons, ui/hud/Lessons.ts). After Bram's greeting
 * the walk lesson shows ONE strip with the arrow key caps and "Loop met de pijltjes." (the
 * desktop test pointer), walking a few metres dismisses it, and what was learned is saved
 * in the shared `alvah-ef-v1` blob (`settings.geleerd`) so it never shows again. An old
 * save's one-off flag (`wereldHintGezien`) counts as learned: no walk lesson, the chip up.
 *
 * The lesson is a plain DOM node (`.lesson-strip`) over the live world, so this asserts on
 * the DOM; the dev hook is only read for where the ranger is.
 */

interface Hook {
  screen: string;
  pos(): { x: number; z: number } | null;
  hint(): { active: string | null; learned: string[]; chip: boolean } | null;
}
function hook<T>(page: Page, fn: (r: Hook) => T): Promise<T | null> {
  return page.evaluate((body) => {
    const r = (window as unknown as { __ranger?: unknown }).__ranger;
    // eslint-disable-next-line no-new-func
    return r ? (new Function('r', `return (${body})(r)`))(r) : null;
  }, fn.toString()) as Promise<T | null>;
}

test('onboarding: the walk lesson shows after Bram, walking dismisses it, the learned flag persists', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await page.goto('/?dev=1');
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByRole('button', { name: 'Dit is mijn ranger' }).click();
  await expect.poll(() => hook(page, (r) => r.screen), { timeout: 30_000 }).toBe('world');

  // (1) one teaching strip at a time: Bram first, then the walk lesson with its key caps
  const lesson = page.locator('.lesson-strip.ls-lopen');
  await expect(lesson).toBeVisible({ timeout: 30_000 });
  await expect(lesson).toContainText('Loop met de pijltjes.'); // desktop pointer → the arrow keys
  await expect(lesson.locator('.kcap')).toHaveCount(4);
  await expect(page.locator('.speaker-strip')).toHaveCount(0);
  await expect(page.locator('.explore-wayfind'), 'the chip waits for Bram\'s hook').toBeHidden();
  await shot(page, 'onboarding-walk-lesson');

  // (2) walking a few metres dismisses it
  const start = await hook(page, (r) => r.pos());
  expect(start, 'pos() available in world').not.toBeNull();
  await page.keyboard.down('ArrowUp');
  try {
    await expect.poll(async () => {
      const p = await hook(page, (r) => r.pos());
      return p ? Math.hypot(p.x - start!.x, p.z - start!.z) : 0;
    }, { timeout: 20_000 }).toBeGreaterThanOrEqual(3);
  } finally {
    await page.keyboard.up('ArrowUp');
  }
  await expect(lesson).toHaveCount(0, { timeout: 5_000 });

  // (3) learned for good, in the shared blob → the walk lesson never returns
  const blob = await page.evaluate(() => localStorage.getItem('alvah-ef-v1'));
  expect(JSON.parse(blob ?? '{}').ranger?.settings?.geleerd?.lopen).toBe(true);

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});

test('onboarding: an old save that saw the walk hint skips the walk lesson and shows the chip', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    if (!localStorage.getItem('alvah-ef-v1')) {
      localStorage.setItem('alvah-ef-v1', JSON.stringify({ ranger: { avatarGemaakt: true, settings: { wereldHintGezien: true, tikHintGezien: true } } }));
    }
  });
  await page.goto('/?dev=1');
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect.poll(() => hook(page, (r) => r.screen), { timeout: 30_000 }).toBe('world');
  await expect(page.locator('.explore-wayfind'), 'the chip is up at once').toBeVisible({ timeout: 10_000 });
  const h = await hook(page, (r) => r.hint());
  expect(h?.learned).toEqual(expect.arrayContaining(['lopen', 'haak']));
  await page.waitForTimeout(6_000);
  await expect(page.locator('.lesson-strip.ls-lopen')).toHaveCount(0);
  // the old flags are gone from the save (migrated, never written back)
  const settings = await page.evaluate(() => JSON.parse(localStorage.getItem('alvah-ef-v1') ?? '{}').ranger?.settings ?? {});
  expect(settings.wereldHintGezien).toBeUndefined();
});
