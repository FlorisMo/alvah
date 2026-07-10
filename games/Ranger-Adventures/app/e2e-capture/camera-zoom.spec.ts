import { test, expect, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * D1.1 DRIVE-ASSERT — the laptop dolly-zoom PAIR waits out the eased follow-boom
 * (best-effort settle, GATE-D1) and renders two PROVABLY-DIFFERENT settled frames
 * (RUN-D-LEDGER D1.1; RUN-D-PLAN §5: a camera box is proven by DRIVING the real input
 * and asserting live dev-hook state, not by a static shot).
 *
 * The bug (fresh 2026-07-05 + the 2026-07-11 audit capture): `12/13-camera-zoom-*` were
 * two IDENTICAL pre-settle voids — the eased dolly caught mid-ease (cam.dist 1.67 while
 * zoom.dist 9.5) — and in the fuller audit run the camera scene's 6 s settle bound fired
 * MID-ease ("camera boom never settled within 6000 ms", cam.dist 4.85 vs 9.5) and THREW,
 * GAPping the whole scene so ZERO zoom frames existed and the pixelHash-differ assert
 * never ran (direction doc §8.7: a pre-settle frame is no-evidence). Root cause: under the
 * full capture load the engine's own rAF is throttled ~13×, so the ~0.3 s exp-damp ease
 * takes ~7–8 s to reach steady-state — past the old 6 s bound.
 *
 * The fix (capture.spec.ts `settleCam`): a 20 s bounded BEST-EFFORT backstop (return, not
 * throw) mirroring `settleMissionCam`, so a slow-but-healthy ease settles inside the bound
 * and the scene never GAPs; the pixelHash-differ assert stays HARD so a best-effort settle
 * can NEVER excuse two identical pre-settle frames.
 *
 * This focused spec proves that fix in ISOLATION (the main-flow camera group is
 * timeout-prone under full load — this is D1.1's reliable, standalone evidence, exactly
 * as mission-cam.spec.ts is D1.3's). It boots the un-sunk spawn, dollies to the near clamp
 * then the far clamp, waits out `settleCam` each time, and HARD-asserts on the SETTLED reads:
 *   - settled, not timed-out   each settleCam returned WELL under its 20 s backstop;
 *   - settled TO TARGET        the horizontal boom ≈ the player-set `zoom.dist`, and
 *                              `zoom.dist` saturated to BOTH clamps (min on scroll-in,
 *                              max on scroll-out) — the "cam.dist ≈ zoom.dist" verify-by leg;
 *   - the boom actually MOVED  the far-clamp boom is metres beyond the near-clamp boom;
 *   - the pair PROVABLY DIFFERS the two PNG md5 hashes differ — the core D1.1 gate;
 *   - budget                   drawCalls < 150 on both.
 * A per-shot screenshot lands beside the burst (a prune-safe subdir) so the audit can
 * overrule the asserts if the pixels ever disagree (§8.7: pixels are the court of appeal).
 *
 * Laptop-only (the iPad leg has no wheel/trackpad dolly). Lives in the capture testDir so
 * `npm run capture` (the phase audit) re-runs it; runnable in isolation for a fast
 * self-verify:
 *   npx playwright test --config playwright.capture.config.ts e2e-capture/camera-zoom.spec.ts --project=laptop
 */

const EVID = path.resolve(process.cwd(), '../runs/run-3-ux-polish/audit-evidence');
const BACKSTOP_MS = 20000; // settleCam best-effort bound (mirrors capture.spec.ts)

type ZoomRead = {
  cam: { x: number; z: number; dist: number; zoomDist: number; zoomMin: number; zoomMax: number } | null;
  pos: { x: number; z: number } | null;
  drawCalls: number | null;
};

/** Robust click for title/avatar/UI buttons (mirrors mission-cam `clickish`). */
async function clickish(page: Page, locator: ReturnType<Page['locator']>): Promise<void> {
  try { await locator.click({ timeout: 4_000 }); return; }
  catch { if (await locator.isVisible().catch(() => false)) await locator.dispatchEvent('click'); }
}

/** Boot from a clean first-run save into the live world with the rig up + the follow
 *  camera settled (mirrors mission-cam bootToWorld). Full motion (no RM emulation). */
async function bootToWorld(page: Page): Promise<void> {
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
  await page.waitForFunction(() => {
    const r = (window as unknown as { __ranger?: { avatar?: () => { height: number } | null } }).__ranger;
    return !!(r && r.avatar && (r.avatar()?.height ?? 0) > 0.5);
  }, undefined, { timeout: 25_000 }).catch(() => { /* zero-asset env still asserts the camera path */ });
  await page.waitForTimeout(1500); // seat the idle pose + settle the follow camera
}

/** Block until the eased zoom-dolly boom has SETTLED (`cam.dist` steady-state across two
 *  ~80 ms polls) before a snap, so the frame is the DESTINATION framing — never a
 *  pre-settle void. Bounded 20 s BEST-EFFORT backstop: on the bound RETURN (not throw),
 *  because the ease is monotone-converging and the caller's HARD asserts (settled-to-
 *  target + frames-differ) gate correctness either way — mirrors capture.spec.ts settleCam
 *  exactly, so this spec exercises the real shipped behaviour. Returns the elapsed ms so
 *  the caller can assert it landed WELL under the backstop (= a genuine steady-state
 *  settle, not a timed-out best-effort read). */
async function settleCam(page: Page, timeoutMs = BACKSTOP_MS): Promise<number> {
  const start = Date.now();
  let prev: number | null = null;
  let stable = 0;
  for (;;) {
    const dist = await page.evaluate(() => {
      const r = (window as unknown as { __ranger?: { cam(): { dist: number } | null } }).__ranger;
      const c = r ? r.cam() : null;
      return c ? c.dist : null;
    });
    if (dist != null) {
      if (prev != null && Math.abs(dist - prev) <= Math.max(0.03, 0.004 * dist)) { if (++stable >= 2) return Date.now() - start; }
      else stable = 0;
      prev = dist;
    }
    if (Date.now() - start > timeoutMs) return Date.now() - start; // best-effort near-destination frame
    await page.waitForTimeout(80);
  }
}

/** The live zoom-dolly camera + the ranger pos + drawCalls, in ONE round-trip. */
async function readZoom(page: Page): Promise<ZoomRead> {
  return page.evaluate(() => {
    const r = (window as unknown as { __ranger?: {
      cam(): { x: number; z: number; dist: number; zoom: { dist: number; min: number; max: number } } | null;
      pos(): { x: number; z: number } | null;
      drawCalls(): number | null;
    } }).__ranger;
    if (!r) return { cam: null, pos: null, drawCalls: null };
    const c = r.cam();
    const p = r.pos();
    return {
      cam: c ? { x: c.x, z: c.z, dist: c.dist, zoomDist: c.zoom.dist, zoomMin: c.zoom.min, zoomMax: c.zoom.max } : null,
      pos: p ? { x: p.x, z: p.z } : null,
      drawCalls: r.drawCalls(),
    };
  });
}

/** Horizontal boom = lens→ranger distance in XZ (excludes the fixed eye-height); the
 *  player-set dolly `zoom.dist` IS this horizontal boom (capture.spec.ts boomNote). */
function horizBoom(z: ZoomRead): number {
  if (!z.cam || !z.pos) return NaN;
  return Math.hypot(z.cam.x - z.pos.x, z.cam.z - z.pos.z);
}

test('D1.1 laptop dolly-zoom pair — settles to target and the two frames provably differ', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'ipad', 'laptop-only automated verification (the iPad leg has no wheel/trackpad dolly)');
  test.setTimeout(150_000); // cold boot streams ~13 MB of GLBs, then two ~8 s eased settles

  const platform = testInfo.project.name;
  const shotDir = path.join(EVID, platform, 'd11-camera-zoom');
  fs.mkdirSync(shotDir, { recursive: true });
  // D1.4: the top-level capture prune skips subdirs, so clear this burst subdir at start —
  // this is a SINGLE test writing two FIXED names (d11-camera-zoom-in/out.png), so it can only
  // ever hold this run's fresh pair; the clear guards against a historical orphan from an older
  // naming so the box's "every PNG under laptop/ incl. subdirs matches a fresh record" holds here too.
  for (const f of fs.readdirSync(shotDir)) {
    if (f.endsWith('.png')) { try { fs.rmSync(path.join(shotDir, f)); } catch { /* a rm miss is not fatal */ } }
  }

  await bootToWorld(page);

  const box = await page.locator('canvas#scene').boundingBox();
  expect(box, 'the 3D canvas is visible').not.toBeNull();
  const cx = box!.x + box!.width / 2, cy = box!.y + box!.height / 2;
  await page.mouse.move(cx, cy);
  await settleCam(page); // confirm the spawn follow-boom is steady before the first dolly

  // ── zoom IN: a real wheel-in (−800 · 0.01 = −8 m) saturates the dolly to its NEAR clamp.
  await page.mouse.wheel(0, -800);
  await page.waitForTimeout(150);
  const inSettleMs = await settleCam(page);
  const inState = await readZoom(page);
  const inBuf = await page.screenshot({ path: path.join(shotDir, 'd11-camera-zoom-in.png') });
  const inHash = createHash('md5').update(inBuf).digest('hex');

  // ── zoom OUT: a real wheel-out (+1400 · 0.01 = +14 m) saturates the dolly to its FAR clamp.
  await page.mouse.wheel(0, 1400);
  await page.waitForTimeout(150);
  const outSettleMs = await settleCam(page);
  const outState = await readZoom(page);
  const outBuf = await page.screenshot({ path: path.join(shotDir, 'd11-camera-zoom-out.png') });
  const outHash = createHash('md5').update(outBuf).digest('hex');

  // ── the reads (for the audit's benefit, logged) ────────────────────────────
  const inBoom = horizBoom(inState), outBoom = horizBoom(outState);
  // eslint-disable-next-line no-console
  console.log(
    `[D1.1] zoom-IN  settle ${inSettleMs} ms · zoom.dist ${inState.cam?.zoomDist.toFixed(2)} (clamp ${inState.cam?.zoomMin.toFixed(2)}..${inState.cam?.zoomMax.toFixed(2)}) · horiz boom ${inBoom.toFixed(2)} · cam.dist ${inState.cam?.dist.toFixed(2)} · md5 ${inHash.slice(0, 8)}\n` +
    `[D1.1] zoom-OUT settle ${outSettleMs} ms · zoom.dist ${outState.cam?.zoomDist.toFixed(2)} · horiz boom ${outBoom.toFixed(2)} · cam.dist ${outState.cam?.dist.toFixed(2)} · md5 ${outHash.slice(0, 8)}`,
  );

  // ── HARD asserts (D1.1 verify-by) ──────────────────────────────────────────
  expect(inState.cam, 'camState present on the settled zoom-in').not.toBeNull();
  expect(outState.cam, 'camState present on the settled zoom-out').not.toBeNull();

  // (1) settled, NOT timed-out: a healthy throttled ease reaches steady-state in ~7–8 s,
  //     well under the 20 s backstop — riding the backstop would mean the boom never settled.
  expect(inSettleMs, 'zoom-in settled via steady-state (not the 20 s best-effort backstop)').toBeLessThan(BACKSTOP_MS - 2000);
  expect(outSettleMs, 'zoom-out settled via steady-state (not the 20 s best-effort backstop)').toBeLessThan(BACKSTOP_MS - 2000);

  // (2) settled TO TARGET — the "cam.dist ≈ zoom.dist" verify-by leg. The player-set dolly
  //     `zoom.dist` IS the horizontal boom; after settle the real boom tracks it (a generous
  //     band absorbs the follow-pitch geometry yet a pre-settle void — boom ~1.6 vs zoom.dist
  //     9.5 — fails hard). AND `zoom.dist` saturated to BOTH clamps (min in, max out).
  expect(Math.abs(inBoom - inState.cam!.zoomDist), `zoom-in horiz boom ${inBoom.toFixed(2)} ≈ zoom.dist ${inState.cam!.zoomDist.toFixed(2)}`).toBeLessThan(0.25 * inState.cam!.zoomDist + 0.6);
  expect(Math.abs(outBoom - outState.cam!.zoomDist), `zoom-out horiz boom ${outBoom.toFixed(2)} ≈ zoom.dist ${outState.cam!.zoomDist.toFixed(2)}`).toBeLessThan(0.25 * outState.cam!.zoomDist + 0.6);
  expect(inState.cam!.zoomDist, 'scroll-in saturates the dolly to its NEAR clamp').toBeLessThan(inState.cam!.zoomMin + 0.5);
  expect(outState.cam!.zoomDist, 'scroll-out saturates the dolly to its FAR clamp').toBeGreaterThan(outState.cam!.zoomMax - 0.5);

  // (3) the boom actually MOVED between the two settled frames (a pre-settle void reads
  //     both ~1.6 → this diff ~0). Metres, so robust to the exact clamp geometry.
  expect(outBoom - inBoom, 'the far-clamp boom is metres beyond the near-clamp boom').toBeGreaterThan(2.0);

  // (4) THE core D1.1 gate: two SETTLED dolly frames must render provably-DIFFERENT pixels.
  //     A shared md5 means the boom never moved (a pre-settle/clamped void) — and a
  //     best-effort settle must NEVER excuse that (GATE-D1). This is the HARD assert.
  expect(inHash, 'the zoom-in and zoom-out frames must provably DIFFER (distinct md5)').not.toBe(outHash);

  // (5) budget contract.
  if (inState.drawCalls != null) expect(inState.drawCalls, 'zoom-in drawCalls < 150').toBeLessThan(150);
  if (outState.drawCalls != null) expect(outState.drawCalls, 'zoom-out drawCalls < 150').toBeLessThan(150);
});
