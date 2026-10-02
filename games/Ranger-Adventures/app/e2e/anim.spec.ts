import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors, recordMotion, pageNow, motionFrames, median, plantedSlip } from './helpers';
import { R, walkTo, type P2 } from './golden-lib';

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
    // a run has flights: both soles off the ground; a walk never leaves it
    const air = (fs: typeof run): number => fs.filter((f) => f.lift.length === 2 && f.lift[0] > 0.02 && f.lift[1] > 0.02).length / Math.max(1, fs.length);
    testInfo.annotations.push({ type: 'flight', description: `both feet off the ground: walking ${(100 * air(walk)).toFixed(0)} % of frames, running ${(100 * air(run)).toFixed(0)} %` });
    expect(air(run), 'running, both feet leave the ground mid-stride (≥ 10 % of frames)').toBeGreaterThanOrEqual(0.1);
    expect(air(walk), 'walking, a foot is always on the ground').toBe(0);
  } finally {
    await page.keyboard.up('Shift');
    await page.keyboard.up('ArrowUp');
  }
  await expect.poll(() => hook(page, (r) => r.clip()?.name ?? null), { timeout: 10_000 }).toBe('idle');

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});

test('anim: running on sand kicks up a little dust at his heels — never walking, never off the sand, never under reduced motion (run 7)', async ({ page }, testInfo) => {
  test.setTimeout(4 * 60_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);
  await page.goto('/?dev=1');
  await page.getByRole('button', { name: 'Begin', exact: true }).click({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Dit is mijn ranger' }).click({ timeout: 60_000 });
  await expect.poll(() => R<string>(page, 'r.screen'), { timeout: 90_000 }).toBe('world');
  await expect.poll(() => hook(page, (r) => r.clip()?.name ?? null), { timeout: 60_000, message: 'the ranger rig attaches' }).toBe('idle');
  const puffs = (): Promise<number> => R<number>(page, 'r.gait().dust.puffs');
  /** Hold ArrowUp (and Shift) for `ms`: how many puffs his heels kicked up meanwhile. */
  const go = async (ms: number, run: boolean): Promise<number> => {
    const p0 = await puffs();
    if (run) await page.keyboard.down('Shift');
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(ms);
    await page.keyboard.up('ArrowUp');
    if (run) await page.keyboard.up('Shift');
    return (await puffs()) - p0;
  };
  /** Walk to `from` and a few steps on toward `to`, so he stands facing the way. */
  const face = async (from: P2, to: P2): Promise<void> => {
    await walkTo(page, from, { stopDist: 0.8, timeout: 60_000 });
    const d = Math.hypot(to.x - from.x, to.z - from.z);
    await walkTo(page, { x: from.x + ((to.x - from.x) * 2.5) / d, z: from.z + ((to.z - from.z) * 2.5) / d }, { stopDist: 0.6, timeout: 30_000 });
    await page.waitForTimeout(500);
  };
  // from the spawn into the forest (−z): heather, then the forest floor — no sand
  const offSand = await go(2_500, true);
  // the open drift sand east of the jeep: walking, then running
  const from = { x: 20, z: 6 }, to = { x: 50, z: 8 };
  await face(from, to);
  const walking = await go(1_800, false);
  await face(from, to);
  const running = await go(1_800, true);
  const drawn = await R<boolean>(page, 'r.gait().dust.drawn');
  await shot(page, 'anim-run-dust');
  // the same run under reduced motion (read live): no dust at all
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await face(from, to);
  const reduced = await go(1_800, true);
  const note = `puffs: running off the sand ${offSand}, walking on sand ${walking}, running on sand ${running} (drawn ${drawn}), running on sand under reduced motion ${reduced}`;
  testInfo.annotations.push({ type: 'dust', description: note });
  console.log(note);
  expect.soft(running, `running on sand kicks up dust at his heels (two puffs a footfall) — ${note}`).toBeGreaterThanOrEqual(8);
  expect.soft(drawn, `…and its little cloud is drawn — ${note}`).toBe(true);
  expect.soft(walking, `walking kicks up none — ${note}`).toBe(0);
  expect.soft(offSand, `off the sand none — ${note}`).toBe(0);
  expect.soft(reduced, `under reduced motion none — ${note}`).toBe(0);
  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});

/** One dust pixel read (devhook `dustHeart`): the colour at the strongest puff's heart just
 *  before its cloud is drawn and just after, in one frame. */
interface DustHeart { before: [number, number, number]; after: [number, number, number]; alpha: number; x: number; y: number }

test('anim: the heel dust reads as dust in every mood — a puff is a touch lighter than its sand, never a glowing dot, never yellower (run 7)', async ({ page }, testInfo) => {
  test.setTimeout(8 * 60_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);
  const lum = (c: readonly number[]): number => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const notes: string[] = [];
  for (const mood of ['gouden-uur', 'ochtendnevel', 'zonnig', 'bewolkt', 'schemer']) {
    await page.goto(`/?dev=1&mood=${mood}`);
    await page.getByRole('button', { name: 'Begin', exact: true }).click({ timeout: 60_000 });
    await page.getByRole('button', { name: 'Dit is mijn ranger' }).click({ timeout: 60_000 });
    await expect.poll(() => R<string>(page, 'r.screen'), { timeout: 90_000 }).toBe('world');
    await expect.poll(() => hook(page, (r) => r.clip()?.name ?? null), { timeout: 60_000, message: 'the ranger rig attaches' }).toBe('idle');
    // the open drift sand east of the jeep, facing on along it
    const from = { x: 20, z: 6 }, to = { x: 50, z: 8 }, d = Math.hypot(to.x - from.x, to.z - from.z);
    await walkTo(page, from, { stopDist: 0.8, timeout: 60_000 });
    await walkTo(page, { x: from.x + ((to.x - from.x) * 2.5) / d, z: from.z + ((to.z - from.z) * 2.5) / d }, { stopDist: 0.6, timeout: 30_000 });
    await page.waitForTimeout(500);
    // run on it with the real keys, reading the strongest puff's heart as it goes
    const hearts: DustHeart[] = [];
    await page.keyboard.down('Shift');
    await page.keyboard.down('ArrowUp');
    const t0 = Date.now();
    while (Date.now() - t0 < 2_600) {
      const h = await R<DustHeart | null>(page, "r.dustHeart('heels')");
      if (h && !hearts.some((x) => x.x === h.x && x.y === h.y && x.alpha === h.alpha)) hearts.push(h);
      await page.waitForTimeout(40);
    }
    await shot(page, `anim-dust-${mood}`);
    await page.keyboard.up('ArrowUp');
    await page.keyboard.up('Shift');
    // the puffs over the open sand: what lay there before the dust was drawn is the lit sand
    // (within 10% of the median), not his shadow or his boot, and the puff drew over it
    const bl = hearts.map((h) => lum(h.before)).sort((a, b) => a - b);
    const sand = bl[Math.floor(bl.length / 2)] ?? 0;
    const over = hearts.filter((h) => Math.abs(lum(h.before) - sand) <= 0.1 * sand && h.after.some((c, i) => c !== h.before[i]));
    const lift = over.map((h) => lum(h.after) - lum(h.before)).sort((a, b) => a - b);
    const typical = lift[Math.floor(lift.length / 2)] ?? NaN;
    const overlap = lift[Math.floor(lift.length * 0.9)] ?? NaN, worst = lift[lift.length - 1] ?? NaN;
    const yellower = Math.min(...over.map((h) => h.after[2] / h.after[0] - h.before[2] / h.before[0]));
    const note = `${mood}: ${over.length}/${hearts.length} puffs over the lit sand (lum ${Math.round(sand)}), a puff's heart +${typical.toFixed(1)} levels (where puffs overlap +${overlap.toFixed(1)}, the most +${worst.toFixed(1)}), blue/red ${yellower >= 0 ? '+' : ''}${yellower.toFixed(3)} against the sand`;
    notes.push(note);
    console.log(note);
    expect.soft(over.length, `a run on the drift sand kicks up puffs over the open sand — ${note}`).toBeGreaterThanOrEqual(4);
    expect.soft(typical, `a puff's heart is at most about 25 levels lighter than its sand (dust, not a glowing dot) — ${note}`).toBeLessThanOrEqual(25);
    expect.soft(overlap, `…and nine in ten stay within about 30 even where two or three puffs overlap — ${note}`).toBeLessThanOrEqual(32);
    expect.soft(yellower, `a puff is no more yellow than its sand (blue/red not more than 0.05 below it) — ${note}`).toBeGreaterThanOrEqual(-0.05);
    await page.evaluate(() => localStorage.clear()); // the next mood starts from a fresh save
  }
  testInfo.annotations.push({ type: 'dust', description: notes.join(' · ') });
  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
