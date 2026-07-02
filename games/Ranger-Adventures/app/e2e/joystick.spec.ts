import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors } from './helpers';

/**
 * Virtual-joystick E2E (WORLD-PLAN W1.3). The iPad-primary walking control:
 * dragging the on-screen thumb feeds the same `resolveInput` path the keyboard
 * uses, so the ranger walks WITHOUT any keypress or ground tap — a pass can only
 * come from the joystick drag itself.
 *
 * The stick's `auto` default hides on a fine (desktop) pointer, so the spec
 * pre-seeds the Instellingen setting to `aan` (persisted in the shared
 * `alvah-ef-v1` blob under the `ranger` namespace — no new key), the same state
 * a touch user or the "Altijd" toggle produces. Then: drag the thumb forward,
 * poll `pos()` for a ≥2 m delta, release.
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

/** Force the joystick visible on the desktop test pointer by pre-seeding the
 *  `joystick: 'aan'` setting into the shared save blob before the app boots. */
async function forceJoystickOn(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('alvah-ef-v1', JSON.stringify({ ranger: { settings: { joystick: 'aan' } } }));
  });
}

/** Drive title → avatar → world (W2.1: world is the front door); return once screen === 'world'. */
async function enterWorld(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByRole('button', { name: 'Dit is mijn ranger' }).click();
  await expect.poll(() => hook(page, (r) => r.screen), { timeout: 30_000 }).toBe('world');
}

test('joystick: dragging the thumb forward walks the ranger ≥2 m', async ({ page }, testInfo) => {
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await forceJoystickOn(page);
  await enterWorld(page);

  const stick = page.locator('.rj-base');
  await expect(stick, 'joystick shown when setting is "aan"').toBeVisible();

  // ≥56 px tap-target floor (frozen contract): the thumb must be a comfortable size.
  const thumbBox = await page.locator('.rj-thumb').boundingBox();
  expect(thumbBox).not.toBeNull();
  expect(Math.min(thumbBox!.width, thumbBox!.height), 'thumb ≥56 px').toBeGreaterThanOrEqual(56);

  const box = await stick.boundingBox();
  expect(box).not.toBeNull();
  const cx = box!.x + box!.width / 2;
  const cy = box!.y + box!.height / 2;

  const start = await hook(page, (r) => r.pos());
  expect(start, 'pos() available once in world').not.toBeNull();

  // Press the thumb centre, then drag straight UP (screen-up = walk forward) and
  // HOLD past the ring so the vector saturates. Pointer capture keeps the drag
  // routed to the stick even as the cursor leaves the ring.
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy - 100, { steps: 8 });

  try {
    await expect
      .poll(async () => {
        const p = await hook(page, (r) => r.pos());
        if (!p) return 0;
        return Math.hypot(p.x - start!.x, p.z - start!.z);
      }, { timeout: 20_000, message: 'dragging the joystick forward should walk the ranger ≥ 2 m' })
      .toBeGreaterThanOrEqual(2);
  } finally {
    await page.mouse.up();
  }

  await shot(page, 'joystick-after-drag');

  // collision / rim invariant: finite, inside the world rim (r=116).
  const end = await hook(page, (r) => r.pos());
  expect(end).not.toBeNull();
  expect(Number.isFinite(end!.x) && Number.isFinite(end!.z), 'pos stays finite').toBe(true);
  expect(Math.hypot(end!.x, end!.z), 'ranger stays inside the world rim').toBeLessThanOrEqual(116);

  // releasing the thumb stops the walk: pos should settle (no runaway drift).
  const afterRelease = await hook(page, (r) => r.pos());
  await page.waitForTimeout(400);
  const settled = await hook(page, (r) => r.pos());
  expect(Math.hypot(settled!.x - afterRelease!.x, settled!.z - afterRelease!.z),
    'ranger stops when the thumb is released').toBeLessThan(0.5);

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
