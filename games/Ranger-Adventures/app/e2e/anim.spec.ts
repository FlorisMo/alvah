import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors, recordMotion, pageNow, motionFrames, median, plantedSlip } from './helpers';

/**
 * Player-animation E2E (WORLD-PLAN W3.2). The W3.1-staged ranger rig carries
 * baked idle/walk clips; W3.2 crossfades them by speed through an AnimationMixer.
 * This proves the mixer actually RUNS — not a frozen pose — by two state asserts
 * against the dev hook while a movement key is held:
 *   (1) `clip().name` is the walk clip once he is moving;
 *   (2) `clip().time` advances between two polls (the mixer clock is ticking).
 * At rest the gait must ease back to idle. State-only (headless SwiftShader
 * renders deterministically for state, not pixels); a screenshot is an artifact.
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

async function enterWorld(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByRole('button', { name: 'Dit is mijn ranger' }).click();
  await expect.poll(() => hook(page, (r) => r.screen), { timeout: 30_000 }).toBe('world');
}

test('anim: holding a key plays the walk clip and its mixer clock advances', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await enterWorld(page);

  // the rig loads async (loadRig + mixer wiring); wait until clip() reports. It takes
  // ~1 s alone and over 30 s with other worlds booting on the same GPU (TEST-2).
  await expect
    .poll(() => hook(page, (r) => (r.clip() ? r.clip()!.name : null)), {
      timeout: 60_000, message: 'player rig should attach and clip() report a gait',
    })
    .not.toBeNull();

  // at rest the ranger idles.
  const resting = await hook(page, (r) => r.clip());
  expect(resting, 'clip() available once the rig is attached').not.toBeNull();
  expect(resting!.name, 'standing ranger reads idle').toBe('idle');

  // hold ArrowUp → the gait crosses into walk.
  await page.keyboard.down('ArrowUp');
  try {
    await expect
      .poll(() => hook(page, (r) => (r.clip() ? r.clip()!.name : null)), {
        timeout: 15_000, message: 'holding a key should crossfade into the walk clip',
      })
      .toBe('walk');

    // the mixer clock advances — read the walk-clip time twice, must increase.
    const t1 = (await hook(page, (r) => r.clip()))!.time;
    await expect
      .poll(async () => {
        const c = await hook(page, (r) => r.clip());
        return c ? c.time : -1;
      }, { timeout: 10_000, message: 'the mixer clock (clip().time) must advance while walking' })
      .toBeGreaterThan(t1);

    await shot(page, 'anim-walking');
  } finally {
    await page.keyboard.up('ArrowUp');
  }

  // releasing the key eases the gait back to idle.
  await expect
    .poll(() => hook(page, (r) => (r.clip() ? r.clip()!.name : null)), {
      timeout: 10_000, message: 'stopping should ease back to idle',
    })
    .toBe('idle');

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});

/**
 * Run 6: the legs match the ground. Held Shift + ArrowUp plays the run clip (its clock
 * advancing), the cadence quickens but stays a child's (walk ≤ 3.7, run ≤ 4.6 steps a
 * second: long steps, not a scurry), and the ball of the planted foot stays put on the
 * rendered ground: its slip over each stance is at most 25 % of his speed, walking and
 * running (measured every rendered frame from the dev hook's sole probe, read only).
 */
test('anim: the run clip plays when he runs, and the planted foot does not skate (walk and run)', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);
  await enterWorld(page);
  await expect.poll(() => hook(page, (r) => r.clip()?.name ?? null), { timeout: 60_000, message: 'the ranger rig attaches' }).toBe('idle');
  await recordMotion(page);

  await page.keyboard.down('ArrowUp');
  try {
    await page.waitForTimeout(900);
    let t = await pageNow(page);
    await page.waitForTimeout(1300);
    const walk = await motionFrames(page, t);
    await page.keyboard.down('Shift');
    await expect.poll(() => hook(page, (r) => r.clip()?.name ?? null), { timeout: 5_000, message: 'Shift + ArrowUp crossfades into the run clip' }).toBe('run');
    const t1 = (await hook(page, (r) => r.clip()))!.time;
    await expect.poll(async () => (await hook(page, (r) => r.clip()))?.time ?? t1, { timeout: 5_000, message: 'the run clip advances' }).not.toBe(t1);
    await page.waitForTimeout(600);
    t = await pageNow(page);
    await page.waitForTimeout(1300);
    const run = await motionFrames(page, t);
    await shot(page, 'anim-running');
    await page.keyboard.up('Shift');
    await expect.poll(() => hook(page, (r) => r.clip()?.name ?? null), { timeout: 5_000, message: 'letting go of Shift walks again' }).toBe('walk');

    const cadWalk = median(walk.map((f) => f.cadence)), cadRun = median(run.map((f) => f.cadence));
    expect(cadWalk, `walking cadence ${cadWalk.toFixed(2)} steps/s: brisk, not a scurry`).toBeGreaterThan(2.6);
    expect(cadWalk).toBeLessThanOrEqual(3.7);
    expect(cadRun, `running cadence ${cadRun.toFixed(2)} steps/s: quicker, still a child's`).toBeGreaterThan(cadWalk);
    expect(cadRun).toBeLessThanOrEqual(4.6);
    const sw = plantedSlip(walk), sr = plantedSlip(run);
    testInfo.annotations.push({ type: 'slip', description: `walk ${(100 * sw.slip).toFixed(1)} % (${sw.frames} planted frames), run ${(100 * sr.slip).toFixed(1)} % (${sr.frames})` });
    expect(sw.frames, 'the walk has planted frames to judge').toBeGreaterThan(20);
    expect(sr.frames, 'the run has planted frames to judge').toBeGreaterThan(10);
    expect(sw.slip, `walking, the planted foot slips ${(100 * sw.slip).toFixed(1)} % of his speed (≤ 25 %)`).toBeLessThanOrEqual(0.25);
    expect(sr.slip, `running, the planted foot slips ${(100 * sr.slip).toFixed(1)} % of his speed (≤ 25 %)`).toBeLessThanOrEqual(0.25);
  } finally {
    await page.keyboard.up('Shift');
    await page.keyboard.up('ArrowUp');
  }
  await expect.poll(() => hook(page, (r) => r.clip()?.name ?? null), { timeout: 10_000 }).toBe('idle');

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
