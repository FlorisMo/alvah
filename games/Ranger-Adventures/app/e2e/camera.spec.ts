import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors, recordMotion, motionFrames, pageNow, type MotionFrame } from './helpers';

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

test('camera: a drag tips the view gently, a sideways drag never tips it, and the tilt stays calm', async ({ page }, testInfo) => {
  // parent B10 (2026-09-27): a 60 px drag up tipped the view from the horizon to steep,
  // and a slightly diagonal sideways drag tipped it too. Real mouse drags on the canvas.
  const errors: string[] = [];
  collectPageErrors(page, errors);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?dev=1');
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByRole('button', { name: 'Dit is mijn ranger' }).click();
  await expect.poll(() => hook(page, (r) => r.screen), { timeout: 30_000 }).toBe('world');
  await page.waitForTimeout(1_500);
  const pitch = async (): Promise<number> => {
    const p = await page.evaluate(() => (window as unknown as { __ranger: { cam(): { pitch: number } } }).__ranger.cam().pitch);
    return (-p * 180) / Math.PI; // degrees down
  };
  const drag = async (dx: number, dy: number): Promise<void> => {
    await page.mouse.move(640, 420);
    await page.mouse.down();
    for (let i = 1; i <= 20; i++) { await page.mouse.move(640 + (dx * i) / 20, 420 + (dy * i) / 20); await page.waitForTimeout(16); }
    await page.mouse.up();
    await page.waitForTimeout(700); // the tilt eases in
  };
  // run 6 (FLOW): play starts with one glide from the maker's shot to the follow view; the
  // tilt is measured from where the lens has come to rest, not part-way through that glide
  // (under load the glide takes longer and 1.5 s was not enough)
  let p0 = await pitch();
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(250);
    const p = await pitch();
    if (Math.abs(p - p0) < 0.05) break;
    p0 = p;
  }
  await drag(0, -60);
  const p1 = await pitch();
  expect(p1 - p0, `a 60 px drag up tips the view a little (${p0.toFixed(1)}° → ${p1.toFixed(1)}°)`).toBeGreaterThan(1);
  expect(p1 - p0, `…never a lurch (${p0.toFixed(1)}° → ${p1.toFixed(1)}°)`).toBeLessThan(8);
  await drag(300, -40);
  const p2 = await pitch();
  expect(Math.abs(p2 - p1), `a mostly sideways drag turns the view but does not tip it (${p1.toFixed(1)}° → ${p2.toFixed(1)}°)`).toBeLessThan(1);
  await drag(0, -700);
  expect(await pitch(), 'dragged all the way up, the view tips no steeper than 40°').toBeLessThanOrEqual(40.5);
  await drag(0, 1400);
  expect(await pitch(), 'dragged all the way down, the view still looks a little down').toBeGreaterThanOrEqual(5.5);
  await shot(page, 'camera-drag-tilt-floor');

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});

/**
 * Run 6: running keeps the calm walking view. Two fresh saves go straight ahead from
 * spawn, one walking (ArrowUp) and one running (Shift + ArrowUp); where each passes the
 * same spots (6, 9 and 12 m out) the ranger's on-screen height and centre are the same
 * within 4 %, the FOV never changes and the camera never rolls. Then, running and turning
 * (Shift + ArrowUp + ArrowLeft), the view turns at most 150°/s.
 */
test('camera: running frames him like walking (same size and place), fixed FOV, roll 0, a calm turn', async ({ browser }, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  const SPOTS = [6, 9, 12];
  const pass = async (runs: boolean): Promise<{ at: { hf: number; sx: number; sy: number }[]; frames: MotionFrame[]; rolls: number[]; yawRate: number }> => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    collectPageErrors(page, errors);
    await enterWorld(page);
    await expect.poll(() => page.evaluate(() => (window as any).__ranger.clip()?.name ?? null), { timeout: 60_000 }).not.toBeNull();
    await page.waitForTimeout(1_000);
    const p0 = (await hook(page, (r) => r.pos()))!;
    await recordMotion(page);
    const t0 = await pageNow(page);
    const rolls: number[] = [];
    if (runs) await page.keyboard.down('Shift');
    await page.keyboard.down('ArrowUp');
    for (let i = 0; i < 300; i++) {
      rolls.push(await page.evaluate(() => (window as any).__ranger.vehicle().roll as number));
      const p = (await hook(page, (r) => r.pos()))!;
      if (Math.hypot(p.x - p0.x, p.z - p0.z) > SPOTS[SPOTS.length - 1] + 0.8) break;
      await page.waitForTimeout(40);
    }
    await shot(page, runs ? 'camera-running' : 'camera-walking');
    let yawRate = 0;
    if (runs) {
      // running and turning: the view follows at a calm rate
      const t1 = await pageNow(page);
      await page.keyboard.down('ArrowLeft');
      await page.waitForTimeout(1_500);
      await page.keyboard.up('ArrowLeft');
      const turn = await motionFrames(page, t1);
      // over 0.1 s windows: a single frame's rate is noise (this read-only recorder and the
      // game share the frame, in either order, so one sample can span two game steps)
      for (let i = 0, j = 0; i < turn.length; i++) {
        while (j < turn.length && turn[j].t - turn[i].t < 100) j++;
        if (j >= turn.length) break;
        const d = Math.abs(Math.atan2(Math.sin(turn[j].yaw - turn[i].yaw), Math.cos(turn[j].yaw - turn[i].yaw)));
        yawRate = Math.max(yawRate, (d / ((turn[j].t - turn[i].t) / 1000)) * 180 / Math.PI);
      }
    }
    await page.keyboard.up('ArrowUp');
    if (runs) await page.keyboard.up('Shift');
    const frames = await motionFrames(page, t0);
    const at = SPOTS.map((spot) => {
      const near = frames.filter((f) => Math.abs(Math.hypot(f.x - p0.x, f.z - p0.z) - spot) < 0.3);
      const avg = (k: 'hf' | 'sx' | 'sy'): number => near.reduce((a, f) => a + f[k], 0) / Math.max(1, near.length);
      return { hf: avg('hf'), sx: avg('sx'), sy: avg('sy') };
    });
    await ctx.close();
    return { at, frames, rolls, yawRate };
  };
  const walk = await pass(false);
  const run = await pass(true);
  const fovs = new Set([...walk.frames, ...run.frames].map((f) => f.fov));
  expect(fovs.size, `the FOV never changes (${[...fovs].join(', ')})`).toBe(1);
  expect(Math.max(...walk.rolls.concat(run.rolls).map(Math.abs)), 'the camera never rolls').toBeLessThan(1e-3);
  expect(run.frames.some((f) => f.running), 'the second pass really ran').toBe(true);
  SPOTS.forEach((spot, i) => {
    const a = walk.at[i], b = run.at[i];
    const note = `at ${spot} m: walking height ${(100 * a.hf).toFixed(1)} % of the screen at (${a.sx.toFixed(3)}, ${a.sy.toFixed(3)}), running ${(100 * b.hf).toFixed(1)} % at (${b.sx.toFixed(3)}, ${b.sy.toFixed(3)})`;
    testInfo.annotations.push({ type: 'framing', description: note });
    expect(Math.abs(b.hf - a.hf) / a.hf, `same size on screen, ${note}`).toBeLessThanOrEqual(0.04);
    expect(Math.abs(b.sx - a.sx) / 2, `same place across, ${note}`).toBeLessThanOrEqual(0.04);
    expect(Math.abs(b.sy - a.sy) / 2, `same place up/down, ${note}`).toBeLessThanOrEqual(0.04);
  });
  testInfo.annotations.push({ type: 'turn', description: `running and turning, the view turned at most ${run.yawRate.toFixed(0)}°/s` });
  expect(run.yawRate, 'running and turning, the view turns calmly (≤ 150°/s)').toBeLessThanOrEqual(150);
  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
