import { test, expect, type Page } from '@playwright/test';

/**
 * Sky comfort law (WORLD-PLAN W4.6): the sky's cloud drift, grass wind and bird
 * flyover are SECONDARY motion, so under reduced-motion they must freeze
 * completely (Alvah is motion-sensitive). The motion-on "the sky is alive" stat
 * test was retired 2026-09-26 (numbers only; the golden path judges the look).
 */

interface Sky {
  gradientStops: number;
  cloudDrift: boolean;
  windMeshes: number;
  skyTime: number;
  cloudOffset: { x: number; y: number };
  windSample: number;
  flyover: { x: number; y: number; z: number; visible: boolean } | null;
}
interface Hook {
  screen: string;
  drawCalls(): number | null;
  sky(): Sky | null;
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
  // wait for the first atmosphere frame (flyover populated by update())
  await expect
    .poll(() => hook(page, (r) => (r.sky() ? r.sky()!.flyover !== null : false)), { timeout: 15_000 })
    .toBe(true);
}

test('sky freezes completely under reduced-motion (comfort law)', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enterWorld(page);

  const a = await hook(page, (r) => r.sky());
  expect(a).not.toBeNull();
  await page.waitForTimeout(2200);
  const b = await hook(page, (r) => r.sky());

  // the atmosphere clock never advances → every effect holds still
  expect(b!.skyTime).toBe(a!.skyTime);
  expect(b!.cloudOffset.x).toBe(a!.cloudOffset.x);
  expect(b!.cloudOffset.y).toBe(a!.cloudOffset.y);
  expect(b!.windSample).toBe(a!.windSample);
  expect(b!.flyover!.x).toBe(a!.flyover!.x);
  expect(b!.flyover!.visible).toBe(a!.flyover!.visible);
});
