import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors } from './helpers';

/**
 * Rotating follow-cam E2E (WORLD-PLAN W1.5). The camera eases behind the ranger
 * as he turns (damped, rate-clamped, roll 0, fixed FOV). Two asserts, straight
 * from the box acceptance:
 *  1) walk a quarter-circle → `cameraYaw()` changes ≥ 45°.
 *  2) with reduced-motion emulated → the bearing is FIXED, so `cameraYaw()` does
 *     not move (locomotion still runs — the ranger walks, the view just holds).
 *
 * State-only asserts against the dev hook (headless SwiftShader renders
 * deterministically enough for state, not pixels — §3.1). Screenshots are
 * artifacts for human review, not asserted on.
 */

interface Hook {
  screen: string;
  pos(): { x: number; z: number } | null;
  cameraYaw(): number | null;
}
function hook<T>(page: Page, fn: (r: Hook) => T): Promise<T | null> {
  return page.evaluate((body) => {
    const r = (window as unknown as { __ranger?: unknown }).__ranger;
    // eslint-disable-next-line no-new-func
    return r ? (new Function('r', `return (${body})(r)`))(r) : null;
  }, fn.toString()) as Promise<T | null>;
}

/** Drive title → avatar → world (W2.1: world is the front door); return once screen === 'world'. */
async function enterWorld(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByRole('button', { name: 'Dit is mijn ranger' }).click();
  await expect.poll(() => hook(page, (r) => r.screen), { timeout: 30_000 }).toBe('world');
}

/** Shortest absolute angle between two yaws, in DEGREES (wrap-safe). */
function degApart(a: number, b: number): number {
  return Math.abs((Math.atan2(Math.sin(a - b), Math.cos(a - b)) * 180) / Math.PI);
}

test('camera: walking a quarter-circle rotates the follow-cam ≥45°', async ({ page }, testInfo) => {
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await enterWorld(page);
  const startYaw = await hook(page, (r) => r.cameraYaw());
  expect(startYaw, 'cameraYaw() available in world').not.toBeNull();

  // Holding a lateral key with a following camera curves the ranger's heading —
  // the camera eases to stay behind him, so the bearing sweeps. Poll until it
  // has turned at least a quarter-circle.
  await page.keyboard.down('ArrowRight');
  try {
    await expect
      .poll(async () => {
        const y = await hook(page, (r) => r.cameraYaw());
        return y == null ? 0 : degApart(y, startYaw!);
      }, { timeout: 20_000, message: 'the follow-cam should rotate ≥ 45° as the ranger turns' })
      .toBeGreaterThanOrEqual(45);
  } finally {
    await page.keyboard.up('ArrowRight');
  }
  await shot(page, 'camera-after-quarter-circle');

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});

test('camera: reduced-motion keeps the bearing fixed while the ranger still walks', async ({ page }, testInfo) => {
  const errors: string[] = [];
  collectPageErrors(page, errors);

  // OS-level reduce → prefersReducedMotion() true → the follow falls back to the
  // fixed bearing (§3.2) with position cuts. Set before entering the world.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enterWorld(page);

  const startYaw = await hook(page, (r) => r.cameraYaw());
  const startPos = await hook(page, (r) => r.pos());
  expect(startYaw, 'cameraYaw() available').not.toBeNull();
  expect(startPos, 'pos() available').not.toBeNull();

  // Hold the same lateral key long enough that a ROTATING cam would have swung
  // well past 45°; here the bearing must stay put.
  await page.keyboard.down('ArrowRight');
  try {
    // the ranger keeps walking — locomotion is never reduced (§1e KEEP)
    await expect
      .poll(async () => {
        const p = await hook(page, (r) => r.pos());
        return p ? Math.hypot(p.x - startPos!.x, p.z - startPos!.z) : 0;
      }, { timeout: 20_000, message: 'reduced-motion still lets the ranger walk' })
      .toBeGreaterThanOrEqual(2);

    const endYaw = await hook(page, (r) => r.cameraYaw());
    expect(endYaw).not.toBeNull();
    expect(
      degApart(endYaw!, startYaw!),
      'reduced-motion holds a fixed camera bearing (no rotation)',
    ).toBeLessThan(2);
  } finally {
    await page.keyboard.up('ArrowRight');
  }
  await shot(page, 'camera-reduced-motion-fixed');

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
