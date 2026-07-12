import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * D3.16 DRIVE-ASSERT — the follow camera keeps the ranger READABLE at the jeep approach:
 * no near-straight-down collapse, no lying `viewClear`, no frame-filling marker ring
 * (RUN-D-LEDGER D3.16; RUN-D-DIRECTION §2.5 GATE-D2: "the clear-line test binds to anything
 * the renderer draws; fadeable occluders fade, unfadeable ones report honestly", the
 * vehicle-approach cam stays in the follow pitch band, and marker rings are wayfinding UI).
 *
 * The convicting frame was `18-jeep-near`: the walk follow cam collapsed to dist 1.93 /
 * pitch −1.17 (near straight-down, WAY outside the −0.33…−0.58 band), a nachtzwaluw marker
 * model filled the near foreground swallowing the ranger, the mission ring read as a giant
 * hoop — and the hook held `viewClear`=true while `avatarScreen.visible` was honestly FALSE.
 *
 * This boots the real world and walks the ranger to the parked jeep, sampling the cam
 * clear-line EVERY step. Across the WHOLE approach it asserts (a drive-assert, not one frame):
 *   - ANTI-LIE: whenever `viewClear`=true AND the ranger is on-screen + SOLID (not the F-05
 *     boom fade), he MUST read `visible` — so `viewClear` can never claim clear over a
 *     swallowed ranger (a swallow now drives `viewClear` FALSE via the all-occluder test);
 *   - PITCH BAND at the jeep-near snap: `cam.pitch` is a normal downward follow tilt, never
 *     the near-straight-down collapse (the −1.17 breach);
 *   - drawCalls < 150 every frame (the sightline tests + ring fade add no geometry).
 * The pixels stay the court of appeal (§8.7): the per-step screenshots beside this burst let
 * the audit overrule the asserts if they ever disagree.
 *
 * Lives in the capture testDir so `npm run capture` (the phase audit) re-runs it; runnable in
 * isolation for a fast self-verify:
 *   npx playwright test --config playwright.capture.config.ts e2e-capture/jeep-near.spec.ts --project=laptop
 * Laptop-only automated verification (keyboard walk).
 */

const EVID = path.resolve(process.cwd(), '../runs/run-3-ux-polish/audit-evidence');
// The follow pitch band is roughly −0.33…−0.58 (RUN-D-DIRECTION §2.5). The breach was −1.17
// (near straight-down). Assert a generous band around the honest follow tilt so a normal
// zoom/variance passes while the collapse is caught with margin.
const PITCH_STEEPEST = -0.85; // steeper (more negative) than this at the snap = the collapse
const PITCH_SHALLOWEST = -0.05; // shallower than this = level/up — not a follow cam any more

const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const;
function screenDir(dx: number, dz: number, yaw: number): { sx: number; sYf: number } {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return { sx: dx * c - dz * s, sYf: -dx * s - dz * c };
}

type VehHook = { placed: boolean; near: boolean; x: number; z: number } | null;
type CamHook = {
  pitch: number; dist: number;
  viewClear: boolean; canopyFade: number;
  avatarOpacity: number;
  avatarScreen: { visible: boolean; onScreen: boolean };
} | null;

type Sample = {
  i: number; file: string;
  pos: { x: number; z: number } | null; distToJeep: number | null;
  pitch: number | null; dist: number | null;
  viewClear: boolean | null; canopyFade: number | null;
  visible: boolean | null; onScreen: boolean | null; avatarOpacity: number | null;
  drawCalls: number | null;
};

async function clickish(page: Page, locator: ReturnType<Page['locator']>): Promise<void> {
  try { await locator.click({ timeout: 4_000 }); return; }
  catch { if (await locator.isVisible().catch(() => false)) await locator.dispatchEvent('click'); }
}

/** Boot from a clean first-run save into the live world (mirrors jeep-drive.spec.ts). */
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
  }, undefined, { timeout: 25_000 }).catch(() => { /* zero-asset env still asserts the cam legs */ });
  await page.waitForTimeout(1200);
}

async function readState(page: Page): Promise<{ v: VehHook; cam: CamHook; ranger: { x: number; z: number } | null; yaw: number | null; drawCalls: number | null }> {
  return page.evaluate(() => {
    const r = (window as unknown as { __ranger?: {
      vehicle(): VehHook; cam(): CamHook; pos(): { x: number; z: number } | null;
      cameraYaw(): number | null; drawCalls(): number | null;
    } }).__ranger;
    if (!r) return { v: null, cam: null, ranger: null, yaw: null, drawCalls: null };
    return { v: r.vehicle(), cam: r.cam(), ranger: r.pos(), yaw: r.cameraYaw(), drawCalls: r.drawCalls() };
  });
}

test('D3.16 jeep-approach — the follow cam keeps the ranger readable (pitch band, honest viewClear)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'ipad', 'laptop-only automated verification (keyboard walk)');
  test.setTimeout(600_000); // a cold isolated boot streams ~13 MB of GLBs; warm under capture it is ~90 s
  const platform = testInfo.project.name;
  const shotDir = path.join(EVID, platform, 'd316-jeepnear-burst');
  fs.mkdirSync(shotDir, { recursive: true });
  // D1.4: clear prior-run PNGs from this subdir so the on-disk set EQUALS this run.
  for (const f of fs.readdirSync(shotDir)) {
    if (f.endsWith('.png')) { try { fs.rmSync(path.join(shotDir, f)); } catch { /* a rm miss is not fatal */ } }
  }
  // D1.6: wipe the burst JSON up front so a failed leg leaves NO stale json beside fresh PNGs.
  try { fs.rmSync(path.join(EVID, `jeepnear-burst-${platform}.json`)); } catch { /* absent on a first run — fine */ }

  await bootToWorld(page);

  const placed = await page.evaluate(() => {
    const r = (window as unknown as { __ranger?: { vehicle(): { placed: boolean } | null } }).__ranger;
    return r?.vehicle()?.placed ?? false;
  });
  expect(placed, 'the jeep is placed in the world').toBe(true);

  const samples: Sample[] = [];
  let idx = 0;
  const grab = async (shoot: boolean): Promise<Sample> => {
    const i = idx++;
    const { v, cam, ranger, drawCalls } = await readState(page);
    let file = '';
    if (shoot) {
      const name = `d316-jeepnear-${String(i).padStart(2, '0')}.png`;
      await page.screenshot({ path: path.join(shotDir, name) });
      file = `${platform}/d316-jeepnear-burst/${name}`;
    }
    const distToJeep = v && ranger ? Math.hypot(v.x - ranger.x, v.z - ranger.z) : null;
    const s: Sample = {
      i, file,
      pos: ranger, distToJeep,
      pitch: cam?.pitch ?? null, dist: cam?.dist ?? null,
      viewClear: cam?.viewClear ?? null, canopyFade: cam?.canopyFade ?? null,
      visible: cam?.avatarScreen.visible ?? null, onScreen: cam?.avatarScreen.onScreen ?? null,
      avatarOpacity: cam?.avatarOpacity ?? null,
      drawCalls: drawCalls ?? null,
    };
    samples.push(s);
    return s;
  };

  // ── walk to the parked jeep, steering by the world→screen basis (mirrors jeep-drive.spec.ts).
  //    Sample the cam clear-line EVERY step; shoot a screenshot on every 4th step (release the
  //    keys first so the slow GL screenshot doesn't skip a step of the approach). ──
  const held = new Set<string>();
  const sync = async (want: Set<string>): Promise<void> => {
    for (const k of KEYS) {
      if (want.has(k) && !held.has(k)) { await page.keyboard.down(k); held.add(k); }
      else if (!want.has(k) && held.has(k)) { await page.keyboard.up(k); held.delete(k); }
    }
  };
  let near = false;
  try {
    for (let step = 0; step < 90 && !near; step++) {
      const { v, ranger, yaw } = await readState(page);
      if (v && ranger && yaw != null) {
        near = v.near;
        if (near) break;
        const { sx, sYf } = screenDir(v.x - ranger.x, v.z - ranger.z, yaw);
        const want = new Set<string>();
        if (sx > 0.4) want.add('ArrowRight'); else if (sx < -0.4) want.add('ArrowLeft');
        if (sYf > 0.4) want.add('ArrowUp'); else if (sYf < -0.4) want.add('ArrowDown');
        await sync(want);
      }
      await page.waitForTimeout(150);
      const shoot = step % 4 === 0;
      if (shoot) await sync(new Set()); // stop before the slow screenshot so no step is skipped
      await grab(shoot);
    }
  } finally { await sync(new Set()).catch(() => {}); }
  expect(near, 'ranger reached the jeep (vehicle().near)').toBe(true);

  // settle at the jeep and take the clean jeep-near snap — the frame the phase audit re-courts.
  await page.waitForTimeout(900);
  const snap = await grab(true);

  const walked = samples.length > 1 && samples[0].distToJeep != null && snap.distToJeep != null
    ? samples[0].distToJeep - snap.distToJeep : 0;

  fs.writeFileSync(
    path.join(EVID, `jeepnear-burst-${platform}.json`),
    JSON.stringify({ box: 'D3.16', platform, spec: 'jeep-near.spec.ts', walked, snap, samples }, null, 2),
  );

  // ── assertions across the WHOLE approach (drive-assert, not one frame) ──
  for (const s of samples) {
    const at = `frame ${s.i} @ ${JSON.stringify(s.pos)} (viewClear ${s.viewClear}, visible ${s.visible}, opacity ${s.avatarOpacity})`;
    // ANTI-LIE: viewClear may NEVER claim clear while a SOLID, on-screen ranger is swallowed.
    // (visible drops legitimately when the F-05 boom collapses close and the ranger himself
    // fades — opacity ≤ 0.5 — so gate on solid, exactly like the D1.5 view-clear spec.)
    if (s.viewClear === true && s.onScreen === true && (s.avatarOpacity ?? 0) > 0.5) {
      expect(s.visible, `${at} viewClear=true over a solid on-screen ranger ⇒ he reads visible (the hook no longer lies)`).toBe(true);
    }
    expect(s.drawCalls ?? 0, `${at} drawCalls < 150 (sightline tests + ring fade add no geometry)`).toBeLessThan(150);
  }
  // the approach genuinely CLOSED on the jeep (not a trivial no-op) …
  expect(walked, 'walked ≥ 5 m toward the jeep').toBeGreaterThan(5);
  // … and viewClear is a LIVE signal, not vacuously false: most of the open approach reads clear.
  const clearFrames = samples.filter((s) => s.viewClear === true).length;
  expect(clearFrames, 'viewClear reads true on ≥ half the approach (it is not stuck false)').toBeGreaterThanOrEqual(Math.ceil(samples.length / 2));

  // ── the JEEP-NEAR SNAP: the follow pitch is in-band (no near-straight-down collapse) ──
  expect(snap.pitch, `jeep-near pitch inside the follow band (not the −1.17 straight-down collapse)`).not.toBeNull();
  expect(snap.pitch as number, `jeep-near pitch not steeper than ${PITCH_STEEPEST} (the collapse)`).toBeGreaterThan(PITCH_STEEPEST);
  expect(snap.pitch as number, `jeep-near pitch still a downward follow tilt (< ${PITCH_SHALLOWEST})`).toBeLessThan(PITCH_SHALLOWEST);
  // and the snap hook is honest: a viewClear=true snap over a solid on-screen ranger reads visible.
  if (snap.viewClear === true && snap.onScreen === true && (snap.avatarOpacity ?? 0) > 0.5) {
    expect(snap.visible, 'jeep-near snap: viewClear=true ⇒ the ranger reads visible (readable frame)').toBe(true);
  }
});
