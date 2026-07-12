import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * D1.7 DRIVE-ASSERT — the ranger's BODY renders after a title round-trip (RUN-D-LEDGER
 * D1.7; RUN-D-PLAN §5: an interaction box is proven by DRIVING the action and asserting
 * live dev-hook state ACROSS the burst — a static shot is no evidence).
 *
 * The GATE-D1 audit #4 found `14-title-return-world`: after the pause-hub's "Naar het
 * hoofdmenu" and a "Begin" back into the world, the hub showed the ranger's SHADOW crisply
 * cast but NO body, while the OLD hook claimed `avatarOpacity` 1 + `avatarScreen.visible`
 * true + clip 'idle' — a hook-vs-pixel lie on the REAL player path (§8.7). Two fixes:
 *   1. the hook now reports the RENDERED body opacity (World.renderedAvatarOpacity — the
 *      visibility-aware max effective material opacity), not the fade-rail INTENT field, so
 *      it can no longer read 1 over an unrendered ranger; `avatarScreen.visible` folds it in.
 *   2. the rig's SHARED materials (Models.loadRig → SkeletonUtils.clone shares them across the
 *      Stage title clone + every World instance) are FORCED solid the instant the rig is
 *      (re)built (World.forceAvatarOpaque), bypassing the setAvatarOpacity churn-guard a fresh
 *      World's avatarOpacity==1 would trip — so re-entry always renders him solid.
 *
 * This burst DRIVES the exact path: boot → walk into the tree line so the F-05 boom fade
 * FADES the shared rig materials in world A (proving the restore is genuinely exercised, the
 * analog of view-clear's `occludedFrames`) → pause → "Naar het hoofdmenu" (leaveWorld/dispose)
 * → "Begin" (a fresh World) → sample `cam().avatarOpacity` (rendered) + `avatarScreen.visible`
 * EVERY frame across the settle window. Asserts the body is SOLID (rendered opacity ≥ 0.99)
 * within ~1 s of re-entry and the hook matches (a solid on-screen ranger reads visible).
 *
 * Runnable in isolation for a fast self-verify:
 *   npx playwright test --config playwright.capture.config.ts e2e-capture/title-return.spec.ts --project=laptop
 * Laptop-only automated verification (keyboard drive). Pixels stay the court of appeal (§8.7):
 * the return screenshots beside this burst let the audit overrule the asserts if they disagree.
 */

const EVID = path.resolve(process.cwd(), '../runs/run-3-ux-polish/audit-evidence');

type Sample = {
  i: number; phase: string;
  pos: { x: number; z: number } | null;
  renderedOpacity: number | null; visible: boolean | null; onScreen: boolean | null;
  clip: string | null; drawCalls: number | null; screen: string | null;
  titleReady: boolean | null; // D3.17: the composed title reads at full fidelity (real hero props up)
  file: string;
};

async function clickish(page: Page, locator: ReturnType<Page['locator']>): Promise<void> {
  try { await locator.click({ timeout: 4_000 }); return; }
  catch { if (await locator.isVisible().catch(() => false)) await locator.dispatchEvent('click'); }
}
function rangerScreen(page: Page): Promise<string | null> {
  return page.evaluate(() => (window as unknown as { __ranger?: { screen: string } }).__ranger?.screen ?? null);
}
async function bootToWorld(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('alvah-ef-v1');
      localStorage.removeItem('ranger-mvp-state');
      sessionStorage.setItem('alvah-gate-v1', '1');
    } catch { /* storage unavailable — boot still fine */ }
  });
  await page.goto('/');
  await clickish(page, page.getByRole('button', { name: 'Begin' }));
  const confirm = page.getByRole('button', { name: 'Dit is mijn ranger' });
  const t0 = Date.now();
  for (;;) {
    if (await confirm.isVisible().catch(() => false)) { await clickish(page, confirm); break; }
    if (await rangerScreen(page) === 'world') break;
    if (Date.now() - t0 > 40_000) { await clickish(page, confirm); break; }
    await page.waitForTimeout(150);
  }
  await expect.poll(() => rangerScreen(page), { timeout: 40_000 }).toBe('world');
  await page.waitForFunction(() => {
    const r = (window as unknown as { __ranger?: { avatar?: () => { height: number } | null } }).__ranger;
    return !!(r && r.avatar && (r.avatar()?.height ?? 0) > 0.5);
  }, undefined, { timeout: 25_000 }).catch(() => { /* zero-asset env still asserts the return */ });
  await page.waitForTimeout(1500); // seat the idle pose + settle the follow camera + stream the GLBs in
}

test('D1.7 title-return drive-burst — the ranger renders after a title round-trip', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'ipad', 'laptop-only automated verification (keyboard drive)');
  test.setTimeout(300_000); // the first cold boot streams ~13 MB of GLBs (~3 min, config note)
  const platform = testInfo.project.name;
  const shotDir = path.join(EVID, platform, 'd17-titlereturn-burst');
  fs.mkdirSync(shotDir, { recursive: true });
  // D1.4: clear this incremental-named burst subdir so the fresh set on disk EQUALS this run.
  for (const f of fs.readdirSync(shotDir)) {
    if (f.endsWith('.png')) { try { fs.rmSync(path.join(shotDir, f)); } catch { /* a rm miss is not fatal */ } }
  }
  // D1.6: WIPE the burst JSON up front so a failed leg leaves NO json (honest gap), not a stale one.
  try { fs.rmSync(path.join(EVID, `titlereturn-burst-${platform}.json`)); } catch { /* absent on a first run — fine */ }

  const samples: Sample[] = [];
  let idx = 0;
  const grab = async (phase: string, shoot: boolean): Promise<Sample> => {
    const i = idx++;
    const s = await page.evaluate(() => {
      const r = (window as unknown as { __ranger?: {
        screen: string; pos(): { x: number; z: number } | null;
        cam(): { avatarOpacity: number; avatarScreen: { visible: boolean; onScreen: boolean } } | null;
        clip(): { name: string } | null; drawCalls(): number | null;
        titleReady?(): boolean;
      } }).__ranger;
      if (!r) return null;
      const c = r.cam();
      return {
        screen: r.screen, pos: r.pos(),
        renderedOpacity: c ? c.avatarOpacity : null,
        visible: c ? c.avatarScreen.visible : null,
        onScreen: c ? c.avatarScreen.onScreen : null,
        clip: r.clip() ? r.clip()!.name : null,
        drawCalls: r.drawCalls(),
        titleReady: r.titleReady ? r.titleReady() : null, // D3.17
      };
    });
    let file = '';
    if (shoot) {
      file = `d17-titlereturn-${String(i).padStart(2, '0')}.png`;
      await page.screenshot({ path: path.join(shotDir, file) });
      file = `${platform}/d17-titlereturn-burst/${file}`;
    }
    const sample: Sample = {
      i, phase, file,
      pos: s?.pos ?? null,
      renderedOpacity: s?.renderedOpacity ?? null, visible: s?.visible ?? null, onScreen: s?.onScreen ?? null,
      clip: s?.clip ?? null, drawCalls: s?.drawCalls ?? null, screen: s?.screen ?? null,
      titleReady: s?.titleReady ?? null,
    };
    samples.push(sample);
    return sample;
  };

  await bootToWorld(page);
  await grab('spawn', true);

  // ── Leg 1: walk SOUTH into the tree line so the F-05 boom fade fades the SHARED rig
  //    materials (the state world A leaves them in). Pulsed hold/release to un-stick from
  //    tree collisions and reach the occluder band; sample the rendered opacity each pulse. ──
  let worldAMinOpacity = 1;
  for (let step = 0; step < 16; step++) {
    await page.keyboard.down('ArrowDown');
    await page.waitForTimeout(1200);
    await page.keyboard.up('ArrowDown');
    await page.waitForTimeout(250);
    const s = await grab('walkA', step % 4 === 0);
    if (s.renderedOpacity != null) worldAMinOpacity = Math.min(worldAMinOpacity, s.renderedOpacity);
  }

  // ── Leg 2: the title round-trip — pause hub → "Naar het hoofdmenu" (leaveWorld/dispose) →
  //    "Begin" (a fresh World). This is the exact F-27 player path the audit shot. ──
  const pause = page.locator('.explore-pause');
  await pause.waitFor({ state: 'visible', timeout: 8_000 });
  await clickish(page, pause);
  const home = page.locator('.ph-hoofdmenu');
  await home.waitFor({ state: 'visible', timeout: 8_000 });
  await clickish(page, home);
  await expect.poll(() => rangerScreen(page), { timeout: 20_000 }).toBe('title');
  // D3.17: HOLD the title snap until the composed title has re-dressed its real hero props
  // (cabin + tree line + prikbord) in over the primitive stand-ins. An early "Begin" (bootToWorld)
  // BAILED the first dress, so the round-trip returned to the low-poly stand-in world
  // (`d17-titlereturn-17`: cone pines, faceted oak, NO cabin); the game re-dresses on `exitWorld`,
  // so wait for its readiness hook before shooting. Bounded — a timeout fails the spec honestly.
  await expect.poll(() => page.evaluate(() => {
    const r = (window as unknown as { __ranger?: { titleReady?(): boolean } }).__ranger;
    return r?.titleReady ? r.titleReady() : false;
  }), { timeout: 20_000 }).toBe(true);
  const titleSample = await grab('title', true);
  await clickish(page, page.locator('.ra-title-begin'));
  await expect.poll(() => rangerScreen(page), { timeout: 40_000 }).toBe('world');

  // ── Leg 3: sample the RENDERED opacity + visibility EVERY ~140 ms across the settle window
  //    (the box: the body renders within ~1 s of re-entry). Screenshot a few frames. ──
  let returnPeakOpacity = 0;
  for (let i = 0; i < 16; i++) {
    await page.waitForTimeout(140);
    const s = await grab('return', i % 4 === 0 || i === 15);
    if (s.renderedOpacity != null) returnPeakOpacity = Math.max(returnPeakOpacity, s.renderedOpacity);
  }
  await page.waitForTimeout(400);
  const settled = await grab('settled', true);

  fs.writeFileSync(
    path.join(EVID, `titlereturn-burst-${platform}.json`),
    JSON.stringify({ box: 'D1.7', platform, spec: 'title-return.spec.ts', worldAMinOpacity, returnPeakOpacity, settled, samples }, null, 2),
  );

  // ── assertions ──
  // D3.17: the composed title was shot at FULL fidelity — the real hero props (cabin + tree line +
  // prikbord) had swapped in over the primitive cone/faceted stand-ins before the snap. This is the
  // anti-`d17-titlereturn-17` assert; the returned title frame beside it is the pixel court of appeal.
  expect(titleSample.titleReady, 'D3.17: the returned title reads full-fidelity (real hero props up, not the low-LOD stand-in world)').toBe(true);
  expect(titleSample.drawCalls ?? 0, 'D3.17: the full-fidelity title still holds the draw-call budget').toBeLessThan(150);
  // Evidence the restore is genuinely exercised: world A DID fade the shared rig materials
  // (the F-05 boom fade fired), so a solid return is proof the force-solid restore works — not
  // a walk that never faded. (Skipped only in a zero-asset env where no tree can collapse the boom.)
  const anyRig = samples.some((s) => s.clip != null);
  if (anyRig) {
    expect(worldAMinOpacity, 'world A faded the shared rig materials (F-05 boom fade fired) — the restore is exercised').toBeLessThan(0.5);
  }
  // PRIMARY: within the settle window the RENDERED body opacity reaches solid — the ranger's
  // body draws after the round-trip (not shadow-only). This is the anti-`14-title-return-world` assert.
  expect(returnPeakOpacity, 'after the title round-trip the ranger body renders solid within ~1 s (rendered opacity ≥ 0.99)').toBeGreaterThanOrEqual(0.99);
  // the SETTLED return frame: solid, on-screen, and the hook MATCHES the pixels (visible true) —
  // the old lie was visible=true over an unrendered body; now visible can only be true when he draws.
  expect(settled.screen, 'settled on the world after the round-trip').toBe('world');
  expect(settled.renderedOpacity ?? 0, 'settled: the ranger body renders solid').toBeGreaterThanOrEqual(0.99);
  if (settled.onScreen) {
    expect(settled.visible, 'settled: a solid on-screen ranger reads visible (hook matches pixels, no shadow-only lie)').toBe(true);
  }
  // the hook can never claim visible over an unrendered body: on EVERY return/settled frame,
  // visible=true ⇒ the body actually renders (rendered opacity > 0.5).
  for (const s of samples.filter((x) => x.phase === 'return' || x.phase === 'settled')) {
    const at = `frame ${s.i} (${s.phase}) renderedOpacity ${s.renderedOpacity}`;
    if (s.visible === true) {
      expect(s.renderedOpacity ?? 0, `${at}: visible ⇒ body renders (>0.5) — the hook matches the pixels`).toBeGreaterThan(0.5);
    }
    expect(s.drawCalls ?? 0, `${at}: drawCalls < 150 (budget holds)`).toBeLessThan(150);
  }
});
