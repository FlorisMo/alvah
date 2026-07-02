import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors } from './helpers';

/**
 * Ven-water E2E (WORLD-PLAN W4.8). The ven basin now carries a fresnel-tinted
 * disc that is WAVELESS by default: it ripples with a subtle fragment-tint
 * shimmer when motion is on, and holds dead-still under reduced-motion. This
 * spec proves, against the dev-state hook:
 *   1) the fresnel shader disc exists;
 *   2) with normal motion the ripple amplitude is > 0 AND the water clock
 *      advances over time (the surface shimmers);
 *   3) with reduced-motion emulated the amplitude is exactly 0 and the clock is
 *      frozen (waveless-still — comfort law §C);
 *   4) the draw-call budget still holds (< 150) — the disc is one draw call.
 *
 * Not a @smoke test — the frozen movement smoke is untouched; this is the box's
 * own acceptance assert. State-only asserts (headless SwiftShader renders
 * deterministically enough for hook state, not pixels — §3.1).
 */

interface Water {
  shader: boolean;
  amp: number;
  time: number;
}
interface Hook {
  screen: string;
  drawCalls(): number | null;
  water(): Water | null;
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
  // wait for the first update() frame to drive the water uniforms
  await expect
    .poll(() => hook(page, (r) => (r.water() ? r.water()!.shader : false)), { timeout: 15_000 })
    .toBe(true);
}

test('ven-water: fresnel disc ripples with motion on and stays in budget', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterWorld(page);

  const w0 = await hook(page, (r) => r.water());
  expect(w0).not.toBeNull();
  expect(w0!.shader).toBe(true);           // the fresnel shader disc exists
  expect(w0!.amp).toBeGreaterThan(0);      // the ripple shimmer is on (motion mode)

  // the water clock advances over time → the shimmer actually crosses the disc
  const t0 = w0!.time;
  await page.waitForTimeout(2200);
  const w1 = await hook(page, (r) => r.water());
  expect(w1!.time).toBeGreaterThan(t0 + 0.5);
  expect(w1!.amp).toBeGreaterThan(0);

  const calls = await hook(page, (r) => r.drawCalls());
  expect(calls).not.toBeNull();
  expect(calls!).toBeLessThan(150);

  await shot(page, 'w48-ven-water');
  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});

test('ven-water: waveless and frozen under reduced-motion (comfort law)', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enterWorld(page);

  const a = await hook(page, (r) => r.water());
  expect(a).not.toBeNull();
  expect(a!.shader).toBe(true);   // the fresnel tint stays — only the ripple is gone
  expect(a!.amp).toBe(0);         // amplitude is EXACTLY 0 → waveless

  await page.waitForTimeout(2200);
  const b = await hook(page, (r) => r.water());
  expect(b!.amp).toBe(0);         // still waveless
  expect(b!.time).toBe(a!.time);  // the shared clock never advances → dead-still
});
