import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * D1.3 DRIVE-ASSERT — the mission-entry camera lands ABOVE the terrain with the task
 * in frame, for ALL FIVE game-3D scenes (RUN-D-LEDGER D1.3; RUN-D-PLAN §5: a
 * camera/interaction box is proven by DRIVING the real player path and asserting live
 * dev-hook state, not by a static shot).
 *
 * The bug (fresh 2026-07-05 player-path capture): simon-3D was shot from BELOW the
 * terrain by the game's own §1e mission reframe (`cam.y` −1.29, up-tilt, the ranger
 * plainly in frame above it); corsi-3D framed bare ground off its route field. Root
 * cause: the mission markers seat on the MIRRORED analytic `heightAt` (World.ts marker
 * placement) while the RENDERED ground is the raycast `groundSnapY` — the SAME
 * divergence that buried the ranger to his hair in P1.5a — so the reframe's authored
 * height (activity-spot Y + a raised look) could land under the visual surface. The fix
 * lifts every engine's reframe target above `ctx.groundY` (= `groundSnapY`, matches the
 * pixels) via `liftReframeAboveGround`, and camState now exposes `groundAtCam` (the
 * rendered ground under the lens) + `taskInView` (the staging in the live frustum).
 *
 * This scene drives the REAL player path per game — board → the mission card whose step
 * uses the engine (by `data-id`) → "Ga op pad" → the step plays 3D IN-PLACE — waits out
 * the §1e reframe (settleMissionCam), then asserts on the SETTLED camera:
 *   - above terrain   cam.y > cam.groundAtCam (never under the rendered ground, §2.5/§8.7);
 *   - task in frame   cam.taskInView === true (the reframe landed ON the playfield);
 *   - drawCalls < 150 the budget contract holds.
 * A per-game screenshot lands beside the burst so the audit can overrule the asserts if
 * the pixels ever disagree (§8.7: pixels are the court of appeal).
 *
 * Runs with reduced-motion OFF (default) — the reframe still lands (cut vs ease), but the
 * settle wait assumes the eased move. Lives in the capture testDir so `npm run capture`
 * (the phase audit) re-runs it; runnable in isolation for a fast self-verify:
 *   npx playwright test --config playwright.capture.config.ts e2e-capture/mission-cam.spec.ts --project=laptop
 * Laptop-only automated verification ([both] is a shared-code fix; the on-device feel is
 * folded into Phase-1's +demo).
 */

const EVID = path.resolve(process.cwd(), '../runs/run-3-ux-polish/audit-evidence');

/** The five games, which mission surfaces each engine on the player path, whether it
 *  needs a step-advance to reach it (dagnacht/wisselen are never a first step,
 *  veluwe.ts), and the 3D card its variant mounts — mirrors capture.spec.ts GAMES3D. */
const GAMES: { ef: string; mission: string; advance: boolean; card: string; label: string }[] = [
  { ef: 'zoeken',   mission: 'frisling',          advance: false, card: '.zoeken-bar',   label: 'Speurkracht' },
  { ef: 'corsi',    mission: 'ecoduct',           advance: false, card: '.route3d-card', label: 'Geheugenkracht' },
  { ef: 'simon',    mission: 'nachtronde',        advance: false, card: '.simon3d-card', label: 'Echokracht' },
  { ef: 'dagnacht', mission: 'ree-niet-aanraken', advance: true,  card: '.dag3d-card',   label: 'Rustkracht' },
  { ef: 'wisselen', mission: 'stuifzand',         advance: true,  card: '.wissel3d-card', label: 'Wisselkracht' },
];

type CamRead = {
  y: number; groundAtCam: number; taskInView: boolean | null; pitch: number;
} | null;

/** Robust click for title/avatar/UI buttons (mirrors heli-enter `clickish`). */
async function clickish(page: Page, locator: ReturnType<Page['locator']>): Promise<void> {
  try { await locator.click({ timeout: 4_000 }); return; }
  catch { if (await locator.isVisible().catch(() => false)) await locator.dispatchEvent('click'); }
}

/** The four locomotion keys + world→screen steering basis (mirrors the capture
 *  harness KEYS/screenDir): a world (dx,dz) heading → the camera-relative Arrow axes. */
const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const;
function screenDir(dx: number, dz: number, yaw: number): { sx: number; sYf: number } {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return { sx: dx * c - dz * s, sYf: -dx * s - dz * c };
}

/** Boot from a clean first-run save into the live world with the rig up + the follow
 *  camera settled (mirrors heli-enter bootToWorld). Full motion (no RM emulation). */
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
  await page.waitForTimeout(1200); // seat the idle pose + settle the follow camera
}

/** The live mission-entry camera: y + the rendered ground under the lens + taskInView. */
async function readCam(page: Page): Promise<{ cam: CamRead; drawCalls: number | null; missionView: string | null }> {
  return page.evaluate(() => {
    const r = (window as unknown as { __ranger?: {
      cam(): { y: number; groundAtCam: number; taskInView: boolean | null; pitch: number } | null;
      drawCalls(): number | null; missionView: string | null;
    } }).__ranger;
    if (!r) return { cam: null, drawCalls: null, missionView: null };
    const c = r.cam();
    return {
      cam: c ? { y: c.y, groundAtCam: c.groundAtCam, taskInView: c.taskInView, pitch: c.pitch } : null,
      drawCalls: r.drawCalls(), missionView: r.missionView,
    };
  });
}

/** board + pos + yaw in ONE page.evaluate — the walk loop's hot read. Collapsing the
 *  three round-trips into one keeps the loop responsive when the headless page is CPU-
 *  starved (a heavy 3D boot + a loaded machine stall each `evaluate`, so three-per-step
 *  once ran the whole walk past its budget). */
async function readWalkState(page: Page): Promise<{ b: { x: number; z: number; near: boolean } | null; p: { x: number; z: number } | null; yaw: number | null }> {
  return page.evaluate(() => {
    const r = (window as unknown as { __ranger?: {
      board(): { x: number; z: number; near: boolean } | null;
      pos(): { x: number; z: number } | null;
      cameraYaw(): number | null;
    } }).__ranger;
    return r ? { b: r.board(), p: r.pos(), yaw: r.cameraYaw() } : { b: null, p: null, yaw: null };
  });
}

/** Keyboard walk toward the case-board until board().near (mirrors keyboardWalkTo). */
async function walkToBoard(page: Page, budget = 320): Promise<void> {
  const down = new Set<string>();
  const sync = async (want: Set<string>): Promise<void> => {
    for (const k of KEYS) {
      if (want.has(k) && !down.has(k)) { await page.keyboard.down(k); down.add(k); }
      else if (!want.has(k) && down.has(k)) { await page.keyboard.up(k); down.delete(k); }
    }
  };
  try {
    for (let i = 0; i < budget; i++) {
      const { b, p, yaw } = await readWalkState(page);
      if (b?.near) return;
      if (!p || !b || yaw == null) { await page.waitForTimeout(100); continue; }
      const { sx, sYf } = screenDir(b.x - p.x, b.z - p.z, yaw);
      const want = new Set<string>();
      if (sx > 0.4) want.add('ArrowRight'); else if (sx < -0.4) want.add('ArrowLeft');
      if (sYf > 0.4) want.add('ArrowUp'); else if (sYf < -0.4) want.add('ArrowDown');
      await sync(want);
      await page.waitForTimeout(120);
    }
    throw new Error('never reached the case-board within the walk budget');
  } finally { await sync(new Set()).catch(() => {}); }
}

/** Open the board + start the mission by data-id, then "Ga op pad" (mirrors the
 *  capture harness startMissionFromBoard / the frozen chain.spec.ts). */
async function startMission(page: Page, missionId: string): Promise<void> {
  const open = page.locator('.explore-board-open');
  await open.waitFor({ state: 'visible', timeout: 15_000 });
  await clickish(page, open);
  await page.locator('.mission-board').waitFor({ timeout: 10_000 });
  const cardBtn = page.locator(`.mission-card[data-id="${missionId}"]`);
  await cardBtn.waitFor({ state: 'visible', timeout: 15_000 });
  await clickish(page, cardBtn);
  const go = page.getByRole('button', { name: 'Ga op pad' });
  await go.waitFor({ state: 'visible', timeout: 15_000 });
  await clickish(page, go);
}

/** Advance a running mission by one step (via the genuine `winStep()` resolve) to reach
 *  a second-step engine's 3D card, clicking through any "Wist je dat" fact card — never
 *  winning the target step itself (mirrors the capture harness advanceToStepCard). */
async function advanceToStepCard(page: Page, targetCard: string): Promise<void> {
  const target = page.locator(targetCard);
  const fact = page.locator('.fact .btn-start');
  const reward = page.locator('.reward');
  let wins = 0;
  for (let i = 0; i < 120; i++) {
    if (await target.isVisible().catch(() => false)) return;
    if (await reward.isVisible().catch(() => false)) throw new Error(`mission reached its reward before ${targetCard} staged`);
    if (await fact.isVisible().catch(() => false)) { await clickish(page, fact); await page.waitForTimeout(150); continue; }
    if (wins < 1) { if (await page.evaluate(() => (window as unknown as { __ranger?: { winStep(): boolean } }).__ranger?.winStep() ?? false)) wins += 1; }
    await page.waitForTimeout(300);
  }
  throw new Error(`3D card ${targetCard} never staged while advancing the mission`);
}

/** Block until the §1e MISSION reframe has SETTLED (the camera POSITION has stopped
 *  moving across two ~90 ms polls) so the reads are the DESTINATION framing, never a
 *  pre-settle void (mirrors the capture harness settleMissionCam).
 *
 *  The reframe is an exp-damped push-in (tau 0.35 s → ~2 s on a 60 fps device — the calm
 *  §2.5 "stable eased push-in"). In the HEADLESS capture the engine's own rAF is throttled,
 *  so the SAME ease converges far slower (measured effective tau ≈ 4–5 s → ~10–15 s to
 *  arrive on the farther reframes: corsi/simon/dagnacht/wisselen). Hence the generous
 *  backstop; on backstop we RETURN best-effort (not throw), because the ease is monotone-
 *  converging and the caller's camera-above-terrain + task-in-frustum asserts — which hold
 *  across the WHOLE ease, the real D1.3 gate — read a representative near-destination frame
 *  either way. A dead hook (cam()===null forever) is caught by the caller's not-null assert,
 *  not here. */
async function settleMissionCam(page: Page, timeoutMs = 20000): Promise<void> {
  const start = Date.now();
  let prev: { x: number; y: number; z: number } | null = null;
  let stable = 0;
  for (;;) {
    const p = await page.evaluate(() => {
      const r = (window as unknown as { __ranger?: { cam(): { x: number; y: number; z: number } | null } }).__ranger;
      const c = r ? r.cam() : null;
      return c ? { x: c.x, y: c.y, z: c.z } : null;
    });
    if (p) {
      if (prev && Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z) <= 0.03) { if (++stable >= 2) return; }
      else stable = 0;
      prev = p;
    }
    if (Date.now() - start > timeoutMs) return; // best-effort near-destination frame; the asserts gate correctness
    await page.waitForTimeout(90);
  }
}

for (const g of GAMES) {
  test(`D1.3 ${g.ef} (${g.mission}) — mission-entry camera lands above terrain with the task in frame`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'ipad', 'laptop-only automated verification (shared-code camera fix; on-device feel = Phase-1 +demo)');
    test.setTimeout(240_000); // cold boot streams ~13 MB of GLBs, then the walk + mission

    const platform = testInfo.project.name;
    const shotDir = path.join(EVID, platform, 'd13-mission-cam');
    fs.mkdirSync(shotDir, { recursive: true });
    // D1.4: the top-level capture prune skips subdirs. These are FIVE separate tests sharing
    // ONE subdir, so a clear-ALL-at-start would delete a sibling ef's fresh frame — instead
    // delete only THIS ef's own target (so a failed test leaves no stale frame for it) PLUS
    // any PNG that is NOT one of the five canonical d13-<ef>-entry.png names (a historical
    // orphan from an older naming). Siblings' valid fresh frames are preserved. Keeps the box's
    // "every PNG under laptop/ incl. subdirs matches a fresh record" true for this subdir too.
    const canonical = new Set(GAMES.map((x) => `d13-${x.ef}-entry.png`));
    for (const f of fs.readdirSync(shotDir)) {
      if (!f.endsWith('.png')) continue;
      if (f === `d13-${g.ef}-entry.png` || !canonical.has(f)) {
        try { fs.rmSync(path.join(shotDir, f)); } catch { /* a rm miss is not fatal */ }
      }
    }

    await bootToWorld(page);
    await walkToBoard(page);
    await startMission(page, g.mission);
    await expect.poll(() => readCam(page).then((r) => r.missionView), { timeout: 25_000 }).toBe('3d');
    if (g.advance) await advanceToStepCard(page, g.card);
    else await page.locator(g.card).waitFor({ state: 'visible', timeout: 20_000 });

    await page.waitForTimeout(500);   // let the staged forms mount + the §1e reframe kick off
    await settleMissionCam(page);     // wait out the reframe so the reads are the DESTINATION framing

    const { cam, drawCalls } = await readCam(page);
    await page.screenshot({ path: path.join(shotDir, `d13-${g.ef}-entry.png`) });

    expect(cam, 'camState present on a live 3D mission entry').not.toBeNull();
    const c = cam!;
    // above the RENDERED terrain under the lens — never an under-terrain reframe (§2.5/§8.7)
    expect(c.y, `${g.ef}: cam.y ${c.y.toFixed(2)} m must be ABOVE the rendered ground ${c.groundAtCam.toFixed(2)} m under the lens`).toBeGreaterThan(c.groundAtCam);
    // the task staging is in the live frustum — the reframe landed ON the playfield
    expect(c.taskInView, `${g.ef}: the task staging must be in the frustum (taskInView)`).toBe(true);
    // the budget contract holds
    if (drawCalls != null) expect(drawCalls, `${g.ef}: drawCalls under 150`).toBeLessThan(150);
  });
}
