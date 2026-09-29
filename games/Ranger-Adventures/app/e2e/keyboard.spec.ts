import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors, recordMotion, pageNow, motionFrames, median, type MotionFrame } from './helpers';

/**
 * Keyboard walking E2E (WORLD-PLAN W1.2). Holding a movement key drives the
 * velocity branch in `World.update` through `resolveInput` → `resolveMove`. This
 * proves the laptop path (arrow keys + WASD) Floris needs, WITHOUT any canvas
 * pointer event — so a pass can only come from the keyboard, never a stray tap.
 *
 * Two asserts per the box: (1) hold key → `pos()` delta ≥ 2 m; (2) collision
 * holds — after walking, pos is finite (no NaN) and inside the world rim (r=116).
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

/** Drive title → avatar → world (W2.1: world is the front door); return once screen === 'world'. */
async function enterWorld(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByRole('button', { name: 'Dit is mijn ranger' }).click();
  await expect.poll(() => hook(page, (r) => r.screen), { timeout: 30_000 }).toBe('world');
}

/** Hold `key` until the ranger has walked ≥ 2 m from `start`, then release it. */
async function walkWith(page: Page, key: string, start: { x: number; z: number }): Promise<void> {
  await page.keyboard.down(key);
  try {
    await expect
      .poll(async () => {
        const p = await hook(page, (r) => r.pos());
        if (!p) return 0;
        return Math.hypot(p.x - start.x, p.z - start.z);
      }, { timeout: 20_000, message: `holding ${key} should walk the ranger ≥ 2 m` })
      .toBeGreaterThanOrEqual(2);
  } finally {
    await page.keyboard.up(key);
  }
}

test('keyboard: holding ArrowUp walks the ranger ≥2 m and collision holds', async ({ page }, testInfo) => {
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await enterWorld(page);

  const start = await hook(page, (r) => r.pos());
  expect(start, 'pos() available once in world').not.toBeNull();

  await walkWith(page, 'ArrowUp', start!);
  await shot(page, 'keyboard-after-arrowup');

  // collision / rim invariant: the kinematic controller never yields NaN and
  // never lets the ranger leave the walkable world (rim r=116).
  const end = await hook(page, (r) => r.pos());
  expect(end).not.toBeNull();
  expect(Number.isFinite(end!.x) && Number.isFinite(end!.z), 'pos stays finite (no NaN clip-through)').toBe(true);
  expect(Math.hypot(end!.x, end!.z), 'ranger stays inside the world rim').toBeLessThanOrEqual(116);

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});

test('keyboard: WASD drives the same walk (KeyW moves the ranger ≥2 m)', async ({ page }, testInfo) => {
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await enterWorld(page);

  const start = await hook(page, (r) => r.pos());
  expect(start, 'pos() available once in world').not.toBeNull();

  await walkWith(page, 'KeyW', start!);

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});

/**
 * Run 6: a brisk walk and a real run, with real keys. ArrowUp walks a steady 2.1-2.5 m/s;
 * Shift + ArrowUp runs a steady 3.8-4.6 m/s (the run gait on); letting go of Shift eases
 * back to a walk without a pop; Shift + ArrowDown backs up at the walking back-up speed
 * and never runs; Shift + a turn key never runs; Shift alone never moves him. Speeds are
 * read every rendered frame (dev hook, read only) while the keys are held.
 */
test('keyboard: Shift + ArrowUp runs, ArrowUp walks briskly, backing up and Shift alone never run', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);
  await enterWorld(page);
  await expect.poll(() => hook(page, (r) => r.clip()?.name ?? null), { timeout: 60_000, message: 'the ranger rig attaches' }).not.toBeNull();
  await recordMotion(page);
  const hold = async (ms: number): Promise<void> => { await page.waitForTimeout(ms); };
  const window = async (from: number): Promise<MotionFrame[]> => motionFrames(page, from);
  const jumps = (fs: MotionFrame[]): number => fs.slice(1).reduce((m, f, i) => Math.max(m, Math.abs(f.speed - fs[i].speed)), 0);

  // walk: ArrowUp 2 s → a steady brisk walk
  await page.keyboard.down('ArrowUp');
  await hold(1000);
  let t = await pageNow(page);
  await hold(1000);
  const walk = await window(t);
  const vWalk = median(walk.map((f) => f.speed));
  expect(vWalk, `ArrowUp walks a steady 2.1-2.5 m/s (median ${vWalk.toFixed(2)})`).toBeGreaterThanOrEqual(2.1);
  expect(vWalk).toBeLessThanOrEqual(2.5);
  expect(walk.every((f) => !f.running), 'walking is not running').toBe(true);

  // run: + Shift → up to speed in about a third of a second, then steady
  const tShift = await pageNow(page);
  await page.keyboard.down('Shift');
  await hold(1000);
  t = await pageNow(page);
  await hold(1000);
  const run = await window(t);
  const vRun = median(run.map((f) => f.speed));
  expect(vRun, `Shift + ArrowUp runs a steady 3.8-4.6 m/s (median ${vRun.toFixed(2)})`).toBeGreaterThanOrEqual(3.8);
  expect(vRun).toBeLessThanOrEqual(4.6);
  expect(run.every((f) => f.running && f.gait === 'run'), 'the run gait is on (rangerMotion().running)').toBe(true);
  const rampIn = await motionFrames(page, tShift, t);
  const reach = rampIn.find((f) => f.speed >= vWalk + 0.9 * (vRun - vWalk));
  expect(reach, 'he reaches running speed').toBeTruthy();
  expect((reach!.t - tShift) / 1000, 'within about a third of a second (≤ 0.6 s)').toBeLessThanOrEqual(0.6);
  expect(jumps(rampIn), 'never a pop: no frame changes his speed by more than 0.35 m/s').toBeLessThanOrEqual(0.35);
  await shot(page, 'keyboard-running');

  // let go of Shift → eases back to the walk
  const tUnshift = await pageNow(page);
  await page.keyboard.up('Shift');
  await hold(1000);
  const back2walk = await window(tUnshift);
  const tail = back2walk.filter((f) => f.t > tUnshift + 600);
  expect(median(tail.map((f) => f.speed)), 'releasing Shift walks again').toBeLessThanOrEqual(2.5);
  expect(tail.every((f) => !f.running), 'the run gait is off').toBe(true);
  expect(jumps(back2walk), 'easing back never pops').toBeLessThanOrEqual(0.35);
  const tRelease = await pageNow(page);
  await page.keyboard.up('ArrowUp');
  await hold(800);
  // letting go, he coasts a short way on, the way he faces, and stays facing it (he
  // never turns round to walk back to where the key came up)
  const coast = await window(tRelease);
  const h0 = coast[0].heading;
  const turned = Math.max(...coast.map((f) => Math.abs(Math.atan2(Math.sin(f.heading - h0), Math.cos(f.heading - h0)))));
  expect(turned * 180 / Math.PI, 'letting go, he keeps facing the way he walked').toBeLessThan(5);
  const last = coast[coast.length - 1];
  const along = (last.x - coast[0].x) * Math.sin(h0) + (last.z - coast[0].z) * Math.cos(h0);
  expect(along, `he coasts a short way on (${along.toFixed(2)} m), never back`).toBeGreaterThan(0.05);
  expect(along).toBeLessThan(0.8);
  expect(last.speed, 'and stands').toBe(0);

  // Shift + ArrowDown: backs up at the walking back-up speed, never runs
  t = await pageNow(page);
  await page.keyboard.down('Shift');
  await page.keyboard.down('ArrowDown');
  await hold(1500);
  await page.keyboard.up('ArrowDown');
  const backUp = (await window(t)).filter((f) => f.t > t + 700);
  const vBack = median(backUp.map((f) => f.speed));
  expect(vBack, `backing up with Shift held stays at the back-up speed (median ${vBack.toFixed(2)})`).toBeLessThanOrEqual(0.6 * 2.5);
  expect(vBack, 'but it does back up').toBeGreaterThan(0.8);
  expect(backUp.every((f) => !f.running), 'backing up never runs').toBe(true);

  // Shift + a turn key: turns on the spot, never runs
  await hold(600);
  t = await pageNow(page);
  await page.keyboard.down('ArrowLeft');
  await hold(900);
  await page.keyboard.up('ArrowLeft');
  const turn = await window(t);
  expect(turn.every((f) => !f.running), 'turning on the spot never runs').toBe(true);
  expect(Math.max(...turn.map((f) => f.speed)), 'turning on the spot does not walk away').toBeLessThan(0.5);

  // Shift alone: never moves him
  await hold(400);
  const p0 = await hook(page, (r) => r.pos());
  await hold(900);
  await page.keyboard.up('Shift');
  const p1 = await hook(page, (r) => r.pos());
  expect(Math.hypot(p1!.x - p0!.x, p1!.z - p0!.z), 'Shift alone never moves him').toBeLessThan(0.02);

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});

/**
 * Run 6 (FLOW): Enter always means "the button I would expect". A child who CLICKS a
 * swatch and then presses Enter gets "Dit is mijn ranger" (the maker closes), not that
 * swatch again. A child who moves to a swatch WITH KEYS (Tab, then an arrow) and presses
 * Enter picks that swatch, and the maker stays. Real keys and a real mouse.
 */
test('keyboard: after a clicked swatch Enter is Dit is mijn ranger; a swatch reached by keys keeps Enter', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  const klaar = page.getByRole('button', { name: 'Dit is mijn ranger' });
  await expect(klaar).toBeVisible({ timeout: 30_000 });

  // keys: from the name field, Tab to the first swatch row, → to the next swatch, Enter picks it
  await page.getByRole('textbox').click();
  const label = (): Promise<string> => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
  for (let i = 0; i < 12 && !(await label()).startsWith('Huid:'); i++) await page.keyboard.press('Tab');
  expect(await label(), 'Tab reaches the skin row').toBe('Huid: Licht');
  await page.keyboard.press('ArrowRight');
  expect(await label(), '→ moves to the next swatch').toBe('Huid: Getint');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('radio', { name: 'Huid: Getint' }), 'Enter picks the swatch reached by keys').toHaveAttribute('aria-checked', 'true');
  expect(await hook(page, (r) => r.screen), 'and the maker stays').toBe('avatar');

  // mouse: click a swatch, then Enter is the primary button
  await page.getByRole('radio', { name: 'Huid: Donker' }).click();
  await expect(page.getByRole('radio', { name: 'Huid: Donker' })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Enter');
  await expect.poll(() => hook(page, (r) => r.screen), { timeout: 10_000, message: 'Enter after a clicked swatch is Dit is mijn ranger' }).toBe('world');
  await expect(klaar).toBeHidden();

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
