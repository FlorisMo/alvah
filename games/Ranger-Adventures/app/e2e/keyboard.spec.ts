import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors } from './helpers';

/**
 * Keyboard walking E2E (WORLD-PLAN W1.2). Holding a movement key drives the
 * velocity branch in `World.update` through `resolveInput` → `resolveMove`. This
 * proves the laptop path (arrow keys + WASD) Floris needs, WITHOUT any canvas
 * pointer event — so a pass can only come from the keyboard, never a stray tap.
 *
 * Two asserts per the box: (1) hold key → `pos()` delta ≥ 2 m; (2) collision
 * holds — after walking, pos is finite (no NaN) and inside the world rim (r=116).
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

/** Drive title → avatar → lodge → world; return once screen === 'world'. */
async function enterWorld(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByRole('button', { name: 'Dit is mijn ranger' }).click();
  await page.getByRole('button', { name: 'Verken de Veluwe (3D)' }).click();
  await expect.poll(() => hook(page, (r) => r.screen), { timeout: 30_000 }).toBe('world');
}

/** Hold `key` until the ranger has walked ≥ 2 m from `start`, then release it. */
async function walkWith(page: Page, key: string, start: { x: number; z: number }): Promise<void> {
  await page.keyboard.down(key);
  try {
    await expect
      .poll(async () => {
        const p = await hook(page, (r) => r.pos());
        if (!p) return 0;
        return Math.hypot(p.x - start.x, p.z - start.z);
      }, { timeout: 20_000, message: `holding ${key} should walk the ranger ≥ 2 m` })
      .toBeGreaterThanOrEqual(2);
  } finally {
    await page.keyboard.up(key);
  }
}

test('keyboard: holding ArrowUp walks the ranger ≥2 m and collision holds', async ({ page }, testInfo) => {
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await enterWorld(page);

  const start = await hook(page, (r) => r.pos());
  expect(start, 'pos() available once in world').not.toBeNull();

  await walkWith(page, 'ArrowUp', start!);
  await shot(page, 'keyboard-after-arrowup');

  // collision / rim invariant: the kinematic controller never yields NaN and
  // never lets the ranger leave the walkable world (rim r=116).
  const end = await hook(page, (r) => r.pos());
  expect(end).not.toBeNull();
  expect(Number.isFinite(end!.x) && Number.isFinite(end!.z), 'pos stays finite (no NaN clip-through)').toBe(true);
  expect(Math.hypot(end!.x, end!.z), 'ranger stays inside the world rim').toBeLessThanOrEqual(116);

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});

test('keyboard: WASD drives the same walk (KeyW moves the ranger ≥2 m)', async ({ page }, testInfo) => {
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await enterWorld(page);

  const start = await hook(page, (r) => r.pos());
  expect(start, 'pos() available once in world').not.toBeNull();

  await walkWith(page, 'KeyW', start!);

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
