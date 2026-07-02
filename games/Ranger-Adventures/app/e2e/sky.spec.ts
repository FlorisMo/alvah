import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors } from './helpers';

/**
 * "Lucht + adem" E2E (WORLD-PLAN W4.6). The sky now breathes: a richer
 * golden-hour gradient, drifting cloud shadows, a gentle grass wind wave, and a
 * bird crossing the sky every ~12 s. All of it is SECONDARY motion, so it must
 * advance while the world runs AND freeze completely under reduced-motion. This
 * spec proves, against the dev-state hook:
 *   1) the richer gradient (>= 5 stops), a cloud-shadow layer, and >= 2 wind
 *      grass meshes exist;
 *   2) with normal motion the atmosphere clock advances and the cloud offset +
 *      wind sample drift over time (the sky is alive);
 *   3) with reduced-motion emulated the clock and every effect FREEZE (comfort);
 *   4) the draw-call budget still holds (`drawCalls()` < 150) — cloud layer +
 *      bird are one draw call each, the wind rides the existing grass instances.
 *
 * Not a @smoke test — the frozen movement smoke is untouched; this is the box's
 * own acceptance assert.
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

test('sky is richer and breathes: gradient, cloud drift, wind, flyover — and stays in budget', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterWorld(page);

  const sky0 = await hook(page, (r) => r.sky());
  expect(sky0).not.toBeNull();
  expect(sky0!.gradientStops).toBeGreaterThanOrEqual(5); // richer than the old 3-stop ramp
  expect(sky0!.cloudDrift).toBe(true);                   // cloud-shadow layer present
  expect(sky0!.windMeshes).toBeGreaterThanOrEqual(2);    // marram + reed wave in the wind
  expect(sky0!.flyover).not.toBeNull();                  // a bird is on its flyover cycle

  // the atmosphere clock advances and the effects drift over time
  const t0 = sky0!.skyTime;
  await page.waitForTimeout(2200);
  const sky1 = await hook(page, (r) => r.sky());
  expect(sky1!.skyTime).toBeGreaterThan(t0 + 0.5);                 // clock advanced
  expect(Math.abs(sky1!.cloudOffset.x - sky0!.cloudOffset.x)).toBeGreaterThan(1e-4); // clouds drifted
  expect(sky1!.windSample).not.toBe(sky0!.windSample);            // grass swayed

  const calls = await hook(page, (r) => r.drawCalls());
  expect(calls).not.toBeNull();
  expect(calls!).toBeLessThan(150);

  await shot(page, 'w46-sky-breath');
  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});

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
