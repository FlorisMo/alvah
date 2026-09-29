import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors, recordMotion, pageNow, motionFrames, median } from './helpers';

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
  clip(): { name: string; time: number } | null;
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

/**
 * Run 6: the stick walks at a partial push and runs at its rim, and the ring shows it.
 * A 60 % push walks (slower than the full walk, never running); pushed to the rim he
 * runs a steady 3.8-4.6 m/s and the ring lights up (`.rj-run`); easing back to 60 %
 * walks again and the ring goes back. Mouse on the stick (setting "aan"), like a finger.
 */
test('joystick: a partial push walks, the rim runs and the ring shows it', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);
  await forceJoystickOn(page);
  await enterWorld(page);
  await expect.poll(() => hook(page, (r) => r.clip()?.name ?? null), { timeout: 60_000, message: 'the ranger rig attaches' }).not.toBeNull();
  await recordMotion(page);
  const stick = page.locator('.rj-base');
  await expect(stick).toBeVisible();
  const box = (await stick.boundingBox())!;
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2, radius = box.width / 2;

  await page.mouse.move(cx, cy);
  await page.mouse.down();
  try {
    // 60 % of the travel, straight up (into the screen)
    await page.mouse.move(cx, cy - 0.6 * radius, { steps: 6 });
    await page.waitForTimeout(900);
    let t = await pageNow(page);
    await page.waitForTimeout(700);
    const part = await motionFrames(page, t);
    const vPart = median(part.map((f) => f.speed));
    expect(vPart, `a 60 % push walks, slower than a full walk (median ${vPart.toFixed(2)} m/s)`).toBeGreaterThan(1.2);
    expect(vPart).toBeLessThan(2.1);
    expect(part.every((f) => !f.running), 'a partial push never runs').toBe(true);
    await expect(stick, 'the ring is plain while walking').not.toHaveClass(/rj-run/);

    // to the rim (and past it: the thumb saturates at the ring)
    await page.mouse.move(cx, cy - 1.5 * radius, { steps: 6 });
    await page.waitForTimeout(900);
    t = await pageNow(page);
    await page.waitForTimeout(700);
    const rim = await motionFrames(page, t);
    const vRim = median(rim.map((f) => f.speed));
    expect(vRim, `the rim runs a steady 3.8-4.6 m/s (median ${vRim.toFixed(2)})`).toBeGreaterThanOrEqual(3.8);
    expect(vRim).toBeLessThanOrEqual(4.6);
    expect(rim.every((f) => f.running), 'the run gait is on').toBe(true);
    await expect(stick, 'the ring shows he runs').toHaveClass(/rj-run/);
    const thumb = (await page.locator('.rj-thumb').boundingBox())!;
    expect(Math.min(thumb.width, thumb.height), 'the thumb stays ≥ 56 px').toBeGreaterThanOrEqual(56);
    await shot(page, 'joystick-running');

    // back to 60 %: walks again, the ring goes back
    await page.mouse.move(cx, cy - 0.6 * radius, { steps: 6 });
    await page.waitForTimeout(900);
    const again = await motionFrames(page, (await pageNow(page)) - 300);
    expect(again.every((f) => !f.running), 'back from the rim he walks').toBe(true);
    await expect(stick, 'the ring is plain again').not.toHaveClass(/rj-run/);
  } finally {
    await page.mouse.up();
  }

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
