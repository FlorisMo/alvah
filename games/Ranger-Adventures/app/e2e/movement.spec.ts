import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors } from './helpers';

/**
 * Movement red-first E2E (WORLD-PLAN W0.4). The prep session's headless taps
 * moved the ranger nothing — the single core bug run 2 exists to fix. This spec
 * taps the ground a few metres ahead of the ranger and polls `pos()` for a
 * ≥2 m delta. Written red-first; once green it is folded into `e2e:smoke` and
 * the stronger smoke is FROZEN (§3.1).
 */

interface Hook {
  screen: string;
  pos(): { x: number; z: number } | null;
  frames(): number | null;
}
function hook<T>(page: Page, fn: (r: Hook) => T): Promise<T | null> {
  return page.evaluate((body) => {
    const r = (window as unknown as { __ranger?: unknown }).__ranger;
    // eslint-disable-next-line no-new-func
    return r ? (new Function('r', `return (${body})(r)`))(r) : null;
  }, fn.toString()) as Promise<T | null>;
}

/**
 * How long the ranger gets to walk 2 m, in RENDERED FRAMES, not seconds. The game clock
 * clamps a long frame (Player.walk: dt ≤ 0.05 s), so on CI's software renderer (seconds
 * per frame) he walks in slow motion: a wall-clock poll measured the machine, not the
 * game. 240 frames is 4 s of play at 60 fps and 12 s of clamped play on a slow machine;
 * 2 m takes about 1 s. The test timeout stays the backstop for a game that stops drawing.
 */
const WALK_FRAMES = 240;

/** Drive title → avatar → world (W2.1: world is the front door); return once screen === 'world'. */
async function enterWorld(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByRole('button', { name: 'Dit is mijn ranger' }).click();
  await expect.poll(() => hook(page, (r) => r.screen), { timeout: 30_000 }).toBe('world');
}

test('movement: tap-to-walk moves the ranger ≥2 m @smoke', async ({ page }, testInfo) => {
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await enterWorld(page);

  const start = await hook(page, (r) => r.pos());
  expect(start, 'pos() available once in world').not.toBeNull();
  const f0 = await hook(page, (r) => r.frames());
  expect(f0, 'frames() counts the rendered frames').not.toBeNull();

  const canvas = page.locator('canvas#scene');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  // Tap the ground ahead of the ranger (upper-middle of the canvas maps to the
  // terrain in front of him — the camera sits behind, looking forward).
  const tapX = box!.x + box!.width * 0.5;
  const tapY = box!.y + box!.height * 0.32;
  await page.mouse.click(tapX, tapY);

  await shot(page, 'movement-after-tap');

  // wait until he has walked 2 m, or WALK_FRAMES frames went by without it
  const walked = await page.waitForFunction(({ sx, sz, f0, n }) => {
    const r = (window as unknown as { __ranger: Hook }).__ranger;
    const p = r.pos();
    const d = p ? Math.hypot(p.x - sx, p.z - sz) : 0;
    const frames = (r.frames() ?? 0) - f0;
    return d >= 2 || frames >= n ? { d, frames } : false;
  }, { sx: start!.x, sz: start!.z, f0: f0!, n: WALK_FRAMES }, { timeout: 0, polling: 200 }).then((h) => h.jsonValue());
  expect(walked.d, `the ranger should walk ≥2 m toward the tapped ground (walked ${walked.d.toFixed(2)} m in ${walked.frames} frames)`)
    .toBeGreaterThanOrEqual(2);

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
