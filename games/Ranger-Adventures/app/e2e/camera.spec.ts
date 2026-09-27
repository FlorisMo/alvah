import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors } from './helpers';

/**
 * Rotating follow-cam E2E (WORLD-PLAN W1.5). The camera eases behind the ranger
 * as he turns (damped, rate-clamped, roll 0, fixed FOV). Two asserts, straight
 * from the box acceptance:
 *  1) walk a quarter-circle → `cameraYaw()` changes ≥ 45°.
 *  2) with reduced-motion emulated → the view never TURNS: while he walks a curve the
 *     bearing only ever changes by a cut (never a frame of smooth rotation), once the
 *     turn key is up it has cut behind him, so Up walks straight into the screen, and
 *     Down backs him up without turning him to face the lens (child B5, 2026-09-27:
 *     screen-relative keys under reduced motion turned him round on Down).
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

test('camera: reduced-motion — the view turns only by cuts, and Up walks into the screen after a turn', async ({ page }, testInfo) => {
  const errors: string[] = [];
  collectPageErrors(page, errors);

  // OS-level reduce → prefersReducedMotion() true → the follow turns by cuts only.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enterWorld(page);

  const startPos = await hook(page, (r) => r.pos());
  expect(startPos, 'pos() available').not.toBeNull();

  /** Every rendered frame for `ms`: how the bearing changed frame to frame (a cut is a
   *  jump of > 5°, anything between 0.05° and 5° is a frame of smooth rotation). */
  const trace = (ms: number): Promise<{ frames: number; cuts: number; smooth: number }> => page.evaluate(async (dur) => {
    const r = (window as unknown as { __ranger: { cameraYaw(): number } }).__ranger;
    let prev = r.cameraYaw(), frames = 0, cuts = 0, smooth = 0;
    const t0 = performance.now();
    await new Promise<void>((res) => {
      const tick = (): void => {
        const y = r.cameraYaw();
        const d = Math.abs(Math.atan2(Math.sin(y - prev), Math.cos(y - prev))) * 180 / Math.PI;
        if (d > 5) cuts += 1; else if (d > 0.05) smooth += 1;
        prev = y; frames += 1;
        if (performance.now() - t0 < dur) requestAnimationFrame(tick); else res();
      };
      requestAnimationFrame(tick);
    });
    return { frames, cuts, smooth };
  }, ms);

  // a curve: Up + Right for 2.5 s (the ranger turns ~225° while he walks)
  await page.keyboard.down('ArrowUp');
  await page.keyboard.down('ArrowRight');
  const curve = trace(3000);
  await page.waitForTimeout(2500);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.up('ArrowUp');
  const c = await curve;
  const p1 = (await hook(page, (r) => r.pos()))!;
  expect(Math.hypot(p1.x - startPos!.x, p1.z - startPos!.z), 'reduced-motion still lets the ranger walk').toBeGreaterThanOrEqual(2);
  expect(c.smooth, `reduced motion: the view never rotates smoothly (${JSON.stringify(c)})`).toBe(0);
  expect(c.cuts, `a long turn is a few calm cuts (${JSON.stringify(c)})`).toBeGreaterThanOrEqual(1);
  expect(c.cuts, `…never a flicker of cuts (${JSON.stringify(c)})`).toBeLessThanOrEqual(8);

  // the turn is over: the view has cut behind him, so Up walks straight into the screen
  await page.waitForTimeout(300);
  const yaw = (await hook(page, (r) => r.cameraYaw()))!;
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(1200);
  await page.keyboard.up('ArrowUp');
  const p2 = (await hook(page, (r) => r.pos()))!;
  const walked = Math.atan2(p2.x - p1.x, p2.z - p1.z);
  const intoScreen = Math.atan2(-Math.sin(yaw), -Math.cos(yaw));
  const off = Math.abs(Math.atan2(Math.sin(walked - intoScreen), Math.cos(walked - intoScreen))) * 180 / Math.PI;
  expect(off, 'after the turn, Up walks straight into the screen').toBeLessThan(12);

  // Down backs him up toward the lens without turning him round: the bearing stays put
  const back = trace(1500);
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(1200);
  await page.keyboard.up('ArrowDown');
  const b = await back;
  const p3 = (await hook(page, (r) => r.pos()))!;
  expect(Math.hypot(p3.x - p2.x, p3.z - p2.z), 'Down backs him up').toBeGreaterThan(0.5);
  expect(b.cuts + b.smooth, `Down never turns the view (${JSON.stringify(b)})`).toBe(0);
  await shot(page, 'camera-reduced-motion-cuts');

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
