import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * D1.2 DRIVE-ASSERT — the ranger's feet stay on the RENDERED terrain, never through it
 * (RUN-D-DIRECTION §2.2 "one ground truth: the rendered terrain mesh"; RUN-D-PLAN §5:
 * a physics/interaction box is proven by DRIVING the action and asserting live dev-hook
 * state ACROSS the burst — a static shot is no evidence).
 *
 * It walks the ranger from the spawn clearing out across the −z relief (the direction
 * the fresh `39-ven-shore` buried him — the `heightAt`-vs-mesh divergence zone) and,
 * every frame of the burst, reads `__ranger.grounded()`:
 *   - grounded === true      a down-ray hits the terrain under him AND his feet sit in
 *                            the on-foot band;
 *   - clearance ≥ −tol       feet ON the rendered surface, never sunk below it (the
 *                            pre-fix analytic Y-write read ~ −4 m here);
 *   - drawCalls < 150        the budget contract still holds with the BVH ground-snap.
 * It also proves the burst reached a REAL divergence zone (max |analyticGap| ≫ 0) so a
 * still-grounded ranger there is genuine evidence, not a flat-spawn no-op — on the OLD
 * code the analytic Y-write would have sunk/floated him at that exact spot.
 *
 * Lives in the capture testDir so `npm run capture` (the phase audit) re-runs it, and it
 * is runnable in isolation for a fast self-verify:
 *   npx playwright test --config playwright.capture.config.ts e2e-capture/ground-snap.spec.ts --project=laptop
 * Laptop-only automated verification (keyboard drive); the iPad walk is Floris's
 * on-device demo (P1.5a +demo). Pixels stay the court of appeal (§8.7): the per-frame
 * screenshots beside this burst let the audit overrule the asserts if they ever disagree.
 */

const EVID = path.resolve(process.cwd(), '../runs/run-3-ux-polish/audit-evidence');
// Feet-on-ground tolerances mirror World.ts GROUND_SINK_TOL / GROUND_AIR_TOL.
const SINK_TOL = 0.06;
const AIR_TOL = 0.60;

type GroundHook = { grounded: boolean; clearance: number; analyticGap: number } | null;
type Sample = {
  i: number;
  pos: { x: number; z: number } | null;
  grounded: boolean | null; clearance: number | null; analyticGap: number | null;
  drawCalls: number | null; clip: string | null; groundSpeed: number | null;
  file: string;
};

/** Robust click for the title/avatar buttons: a real click, then a faithful DOM
 *  `click` dispatch if the live render defeats the actionability gate (mirrors the
 *  capture harness `press`). */
async function clickish(page: Page, locator: ReturnType<Page['locator']>): Promise<void> {
  try { await locator.click({ timeout: 4_000 }); return; }
  catch { if (await locator.isVisible().catch(() => false)) await locator.dispatchEvent('click'); }
}

test('D1.2 ground-snap drive-burst — the ranger stays on the rendered terrain', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'ipad', 'laptop-only automated verification (iPad walk = Floris demo, P1.5a +demo)');
  test.setTimeout(300_000); // the first cold boot streams ~13 MB of GLBs (~3 min, config note)
  const platform = testInfo.project.name;
  const shotDir = path.join(EVID, platform, 'd12-ground-burst'); // subdir → never touched by the capture prune
  fs.mkdirSync(shotDir, { recursive: true });

  // ── seed the presence gate + a clean first-run save BEFORE any app script, then
  //    boot into the world (mirrors capture.spec.ts runGroup + bootWorld, keyboard). ──
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('alvah-ef-v1');
      localStorage.removeItem('ranger-mvp-state');
      sessionStorage.setItem('alvah-gate-v1', '1');
    } catch { /* storage unavailable — boot still fine */ }
  });
  await page.goto('/');
  await clickish(page, page.getByRole('button', { name: 'Begin' })); // title → avatar
  const confirm = page.getByRole('button', { name: 'Dit is mijn ranger' });
  const t0 = Date.now();
  for (;;) { // first run → avatar maker; a returning player drops straight to world
    if (await confirm.isVisible().catch(() => false)) { await clickish(page, confirm); break; }
    if (await page.evaluate(() => (window as unknown as { __ranger?: { screen: string } }).__ranger?.screen === 'world')) break;
    if (Date.now() - t0 > 40_000) { await clickish(page, confirm); break; }
    await page.waitForTimeout(150);
  }
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __ranger?: { screen: string } }).__ranger?.screen ?? null), { timeout: 40_000 })
    .toBe('world');
  // the real rig swaps in async over the stand-in — avatar.height reads once it lands
  await page.waitForFunction(() => {
    const r = (window as unknown as { __ranger?: { avatar?: () => { height: number } | null } }).__ranger;
    return !!(r && r.avatar && (r.avatar()?.height ?? 0) > 0.5);
  }, undefined, { timeout: 25_000 }).catch(() => { /* zero-asset env still asserts grounded */ });
  await page.waitForTimeout(1200); // seat the idle pose + settle the follow camera

  const samples: Sample[] = [];
  // Sample the ground-truth numbers EVERY frame (the drive-assert court); shoot a
  // screenshot only on a few frames (each waits for fonts → slow) for the visual audit.
  const grab = async (i: number, shoot: boolean): Promise<void> => {
    const s = await page.evaluate(() => {
      const r = (window as unknown as { __ranger?: {
        pos(): { x: number; z: number } | null;
        grounded(): { grounded: boolean; clearance: number; analyticGap: number } | null;
        drawCalls(): number | null; clip(): { name: string } | null; groundSpeed(): number | null;
      } }).__ranger;
      if (!r) return null;
      const g: GroundHook = r.grounded();
      return {
        pos: r.pos(),
        grounded: g ? g.grounded : null,
        clearance: g ? g.clearance : null,
        analyticGap: g ? g.analyticGap : null,
        drawCalls: r.drawCalls(),
        clip: r.clip() ? r.clip()!.name : null,
        groundSpeed: r.groundSpeed(),
      };
    });
    let file = '';
    if (shoot) {
      file = `d12-ground-${String(i).padStart(2, '0')}.png`;
      await page.screenshot({ path: path.join(shotDir, file) });
      file = `${platform}/d12-ground-burst/${file}`;
    }
    samples.push({
      i, file,
      pos: s?.pos ?? null, grounded: s?.grounded ?? null, clearance: s?.clearance ?? null,
      analyticGap: s?.analyticGap ?? null, drawCalls: s?.drawCalls ?? null,
      clip: s?.clip ?? null, groundSpeed: s?.groundSpeed ?? null,
    });
  };

  await grab(0, true); // frame 0 — at spawn (grounded, agrees with the analytic field at origin)
  // ── the burst: hold forward, walk out across the −z relief toward the ven basin ──
  await page.keyboard.down('ArrowUp');
  try {
    for (let i = 1; i <= 20; i++) {
      await page.waitForTimeout(340);
      await grab(i, i % 4 === 0); // shoot frames 4/8/12/16/20; sample numbers every frame
    }
  } finally { await page.keyboard.up('ArrowUp').catch(() => {}); }

  // write the burst annotations so the phase audit reads the ground-truth frame by frame
  fs.writeFileSync(
    path.join(EVID, `ground-burst-${platform}.json`),
    JSON.stringify({ box: 'D1.2', platform, spec: 'ground-snap.spec.ts', sinkTol: SINK_TOL, airTol: AIR_TOL, samples }, null, 2),
  );

  // ── assertions across the WHOLE burst (drive-assert, not one frame) ──
  for (const s of samples) {
    const at = `frame ${s.i} @ ${JSON.stringify(s.pos)}`;
    expect(s.grounded, `${at} grounded (feet on the rendered terrain)`).toBe(true);
    expect(s.clearance, `${at} clearance ≥ ${-SINK_TOL} (never sunk below the surface)`).toBeGreaterThanOrEqual(-SINK_TOL);
    expect(s.clearance, `${at} clearance ≤ ${AIR_TOL} (never floating)`).toBeLessThanOrEqual(AIR_TOL);
    expect(s.drawCalls ?? 0, `${at} drawCalls < 150 (budget holds with the BVH snap)`).toBeLessThan(150);
  }
  // the burst genuinely WALKED (not a no-op that trivially passes)
  const first = samples[0].pos, last = samples[samples.length - 1].pos;
  expect(first && last, 'spawn + final position present').toBeTruthy();
  const moved = Math.hypot(last!.x - first!.x, last!.z - first!.z);
  expect(moved, 'burst walked a real distance across the terrain').toBeGreaterThan(5);
  // and it crossed a REAL divergence zone — somewhere the rendered surface disagrees
  // with the old analytic field by ≫ 0, so the pre-fix Y-write WOULD have sunk/floated
  // him there. A still-grounded ranger at that spot is the proof the snap fixed it.
  const maxGap = Math.max(...samples.map((s) => Math.abs(s.analyticGap ?? 0)));
  expect(maxGap, 'burst reached a heightAt-vs-mesh divergence zone (proves the fix bites)').toBeGreaterThan(0.3);
});
