import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors } from './helpers';

/**
 * Adaptive-quality E2E (WORLD-PLAN W7.2). An fps probe measures the world's
 * frame rate over 5 s windows and steps a two-level quality tier ('hoog'|'laag')
 * with hysteresis; the tier drives the renderer pixelRatio cap + vegetation
 * density and is PERSISTED via state.ts settings (the `ranger` namespace — no new
 * localStorage key). This spec proves, against the dev-state hook:
 *   1) the hook exposes a valid tier, and its two knobs (pixelRatio,
 *      vegetationScale) stay CONSISTENT with that tier — before AND after a probe
 *      window can fire (so the live re-decision never desyncs the knobs);
 *   2) a PERSISTED 'laag' tier boots the world light — the seeded setting is read
 *      at boot and lowers both the pixelRatio (≤ 1.25 × dpr) and the vegetation
 *      scale (0.55), the "slow device boots light" contract.
 *
 * The measured-fps step-down itself is NOT asserted (it is device-dependent: a
 * GPU-backed dev machine stays 'hoog', a SwiftShader CI runner drops to 'laag' —
 * both correct). Not a @smoke test — the frozen movement smoke is untouched;
 * this is the box's own acceptance assert. State-only (§3.1).
 */

interface Quality {
  tier: 'hoog' | 'laag';
  pixelRatio: number;
  vegetationScale: number;
}
interface Hook {
  screen: string;
  drawCalls(): number | null;
  quality(): Quality | null;
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
  await expect
    .poll(() => hook(page, (r) => (r.quality() ? true : false)), { timeout: 15_000 })
    .toBe(true);
}

/** The pixelRatio + vegetation knobs must match the reported tier exactly. */
function assertConsistent(q: Quality, dpr: number): void {
  const cap = q.tier === 'laag' ? 1.25 : 2;
  expect(q.pixelRatio).toBeCloseTo(Math.min(dpr, cap), 5);
  expect(q.vegetationScale).toBe(q.tier === 'laag' ? 0.55 : 1);
}

test('quality: the hook exposes a consistent tier and it stays consistent after a probe window', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterWorld(page);

  const dpr = await page.evaluate(() => window.devicePixelRatio);

  const q0 = await hook(page, (r) => r.quality());
  expect(q0).not.toBeNull();
  expect(['hoog', 'laag']).toContain(q0!.tier); // the hook exposes a tier
  expect(q0!.pixelRatio).toBeGreaterThan(0);
  assertConsistent(q0!, dpr);

  // let at least one 5 s probe window close, then re-read: whether or not the
  // tier stepped, its knobs must still line up (the live re-decision is safe).
  await page.waitForTimeout(6000);
  const q1 = await hook(page, (r) => r.quality());
  expect(q1).not.toBeNull();
  assertConsistent(q1!, dpr);

  const calls = await hook(page, (r) => r.drawCalls());
  expect(calls).not.toBeNull();
  expect(calls!).toBeLessThan(150);

  await shot(page, 'w72-quality');
  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});

test('quality: a persisted laag tier boots the world light (slow-device contract)', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  // seed the shared alvah-ef-v1 blob (ranger namespace, no new key) with a prior
  // step-down verdict — a slow device that dropped last session.
  await page.addInitScript(() => {
    localStorage.setItem('alvah-ef-v1', JSON.stringify({ ranger: { settings: { kwaliteitTier: 'laag' } } }));
  });
  await enterWorld(page);

  const dpr = await page.evaluate(() => window.devicePixelRatio);
  // read immediately — before a probe window can step the tier back up on a fast
  // machine: the FIRST in-world frame already reflects the persisted seed.
  const q = await hook(page, (r) => r.quality());
  expect(q).not.toBeNull();
  expect(q!.tier).toBe('laag');
  expect(q!.pixelRatio).toBeCloseTo(Math.min(dpr, 1.25), 5); // fill-rate capped
  expect(q!.vegetationScale).toBe(0.55);                     // vegetation thinned
});
