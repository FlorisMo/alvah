import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors } from './helpers';

/**
 * Player-animation E2E (WORLD-PLAN W3.2). The W3.1-staged ranger rig carries
 * baked idle/walk clips; W3.2 crossfades them by speed through an AnimationMixer.
 * This proves the mixer actually RUNS — not a frozen pose — by two state asserts
 * against the dev hook while a movement key is held:
 *   (1) `clip().name` is the walk clip once he is moving;
 *   (2) `clip().time` advances between two polls (the mixer clock is ticking).
 * At rest the gait must ease back to idle. State-only (headless SwiftShader
 * renders deterministically for state, not pixels); a screenshot is an artifact.
 */

interface Hook {
  screen: string;
  pos(): { x: number; z: number } | null;
  clip(): { name: string; time: number } | null;
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

test('anim: holding a key plays the walk clip and its mixer clock advances', async ({ page }, testInfo) => {
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await enterWorld(page);

  // the rig loads async (loadRig + mixer wiring); wait until clip() reports.
  await expect
    .poll(() => hook(page, (r) => (r.clip() ? r.clip()!.name : null)), {
      timeout: 30_000, message: 'player rig should attach and clip() report a gait',
    })
    .not.toBeNull();

  // at rest the ranger idles.
  const resting = await hook(page, (r) => r.clip());
  expect(resting, 'clip() available once the rig is attached').not.toBeNull();
  expect(resting!.name, 'standing ranger reads idle').toBe('idle');

  // hold ArrowUp → the gait crosses into walk.
  await page.keyboard.down('ArrowUp');
  try {
    await expect
      .poll(() => hook(page, (r) => (r.clip() ? r.clip()!.name : null)), {
        timeout: 15_000, message: 'holding a key should crossfade into the walk clip',
      })
      .toBe('walk');

    // the mixer clock advances — read the walk-clip time twice, must increase.
    const t1 = (await hook(page, (r) => r.clip()))!.time;
    await expect
      .poll(async () => {
        const c = await hook(page, (r) => r.clip());
        return c ? c.time : -1;
      }, { timeout: 10_000, message: 'the mixer clock (clip().time) must advance while walking' })
      .toBeGreaterThan(t1);

    await shot(page, 'anim-walking');
  } finally {
    await page.keyboard.up('ArrowUp');
  }

  // releasing the key eases the gait back to idle.
  await expect
    .poll(() => hook(page, (r) => (r.clip() ? r.clip()!.name : null)), {
      timeout: 10_000, message: 'stopping should ease back to idle',
    })
    .toBe('idle');

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
