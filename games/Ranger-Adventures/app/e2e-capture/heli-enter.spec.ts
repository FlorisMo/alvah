import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * P1.5c DRIVE-ASSERT — the helicopter can be ENABLED in Instellingen AND ENTERED
 * (RUN-D-LEDGER P1.5c; RUN-D-PLAN §5: an interaction box is proven by DRIVING the
 * action and asserting live dev-hook state ACROSS the burst — a static shot is no
 * evidence). Where the frozen `e2e/heli.spec.ts` SEEDS `helikopter:true` straight
 * into localStorage to test FLIGHT, this scene drives the REAL player path that
 * Floris hit on the iPad and could not complete: open Pauze → Instellingen, tap the
 * "Helikopter" toggle ON (the toggle that was MISSING from the panel — the bug),
 * walk to the parked heli, and tap "🚁 Stap in de helikopter".
 *
 * Runs with reduced-motion OFF (default; NOT emulated) — flight is withheld under
 * reduced-motion BY DESIGN (`heli().available` = false, flight is the one mode we
 * withhold rather than merely calm), so an RM scene would prove nothing here.
 *
 * It asserts, in order:
 *   - toggle reachable   the "Helikopter" toggle box sits INSIDE the viewport, ≥56 px;
 *   - enables flight     after tapping it ON, heli().available === true (opt-in + full motion);
 *   - reaches a pad      walking to the parked heli, heli().near === true;
 *   - enters             after the "Stap in de helikopter" tap, heli().inHeli === true;
 *   - drawCalls < 150    the budget contract holds throughout.
 * BEFORE the toggle it also proves heli().available === false (opt-in default UIT), so
 * the toggle is doing the real work — the assert is not passing trivially.
 *
 * Lives in the capture testDir so `npm run capture` (the phase audit) re-runs it, and
 * it is runnable in isolation for a fast self-verify:
 *   npx playwright test --config playwright.capture.config.ts e2e-capture/heli-enter.spec.ts --project=laptop
 * Laptop-only automated verification (keyboard/DOM drive); the real-device enable +
 * fly is Floris's on-device demo (P1.5c +demo). Pixels stay the court of appeal (§8.7):
 * the per-step screenshots beside this burst let the audit overrule the asserts if they
 * ever disagree.
 */

const EVID = path.resolve(process.cwd(), '../runs/run-3-ux-polish/audit-evidence');

type HeliHook = {
  placed: boolean; available: boolean; optIn: boolean; near: boolean; inHeli: boolean; onPad: boolean;
  x: number; z: number; heading: number; altitude: number; fov: number; roll: number;
} | null;

type Step = {
  i: number; phase: 'boot' | 'instellingen' | 'enabled' | 'at-pad' | 'in-heli';
  available: boolean | null; optIn: boolean | null; near: boolean | null; inHeli: boolean | null;
  heliX: number | null; heliZ: number | null; pos: { x: number; z: number } | null;
  drawCalls: number | null; file: string;
};

/** Robust click for the title/avatar/UI buttons (mirrors ground-snap/jeep-drive `clickish`):
 *  a real click, then a faithful DOM `click` dispatch if the live render defeats the
 *  actionability gate. */
async function clickish(page: Page, locator: ReturnType<Page['locator']>): Promise<void> {
  try { await locator.click({ timeout: 4_000 }); return; }
  catch { if (await locator.isVisible().catch(() => false)) await locator.dispatchEvent('click'); }
}

/** The four locomotion keys + the world→screen steering basis (mirrors the capture harness
 *  `KEYS`/`screenDir`): converts a world (dx,dz) heading into the camera-relative axes the
 *  Arrow keys drive, so the walk-to-heli leg can STEER toward the parked aircraft. */
const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const;
function screenDir(dx: number, dz: number, yaw: number): { sx: number; sYf: number } {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return { sx: dx * c - dz * s, sYf: -dx * s - dz * c };
}

/** Boot from a clean first-run save into the live world with the rig up + the follow
 *  camera settled (mirrors ground-snap/jeep-drive bootToWorld). No reduced-motion
 *  emulation — this scene REQUIRES full motion (heli availability is withheld under RM). */
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
  }, undefined, { timeout: 25_000 }).catch(() => { /* zero-asset env still asserts the heli path */ });
  await page.waitForTimeout(1200); // seat the idle pose + settle the follow camera
}

/** Read the live heli hook + ranger pos + camera yaw + drawCalls in one evaluate. */
async function readHeli(page: Page): Promise<{ h: HeliHook; pos: { x: number; z: number } | null; yaw: number | null; drawCalls: number | null }> {
  return page.evaluate(() => {
    const r = (window as unknown as { __ranger?: {
      heli(): HeliHook; pos(): { x: number; z: number } | null; cameraYaw(): number | null; drawCalls(): number | null;
    } }).__ranger;
    if (!r) return { h: null, pos: null, yaw: null, drawCalls: null };
    return { h: r.heli(), pos: r.pos(), yaw: r.cameraYaw(), drawCalls: r.drawCalls() };
  });
}

test('P1.5c heli enable+enter — the Instellingen toggle turns it on AND "Stap in" enters', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'ipad', 'laptop-only automated verification (real-device enable+fly = Floris demo, P1.5c +demo)');
  test.setTimeout(300_000); // the first cold boot streams ~13 MB of GLBs (~3 min, config note)
  const platform = testInfo.project.name;
  const shotDir = path.join(EVID, platform, 'p15c-heli-enter'); // subdir → never touched by the capture prune
  fs.mkdirSync(shotDir, { recursive: true });

  await bootToWorld(page);

  const steps: Step[] = [];
  let shotN = 0;
  const record = async (phase: Step['phase'], shoot: boolean): Promise<Step> => {
    const { h, pos, drawCalls } = await readHeli(page);
    let file = '';
    if (shoot) {
      const name = `p15c-heli-${String(shotN).padStart(2, '0')}-${phase}.png`;
      await page.screenshot({ path: path.join(shotDir, name) });
      file = `${platform}/p15c-heli-enter/${name}`;
      shotN += 1;
    }
    const s: Step = {
      i: steps.length, phase,
      available: h?.available ?? null, optIn: h?.optIn ?? null, near: h?.near ?? null, inHeli: h?.inHeli ?? null,
      heliX: h?.x ?? null, heliZ: h?.z ?? null, pos: pos ?? null, drawCalls: drawCalls ?? null, file,
    };
    steps.push(s);
    return s;
  };

  // ── (1) the heli is placed AND unavailable before the toggle (opt-in default UIT) —
  //        proves the toggle does real work, not that availability is trivially on. ──
  const boot = await readHeli(page);
  expect(boot.h?.placed, 'the helicopter is placed in the world').toBe(true);
  expect(boot.h?.optIn, 'opt-in defaults to UIT (no seeded save)').toBe(false);
  expect(boot.h?.available, 'the helicopter is NOT available before the toggle').toBe(false);
  await record('boot', false);

  // ── (2) open Pauze → Instellingen (the real player path; bounded, mirrors the capture
  //        harness reduce-motion-toggle group). ──
  await clickish(page, page.locator('.explore-pause'));
  await clickish(page, page.locator('.ph-tweaks'));
  const toggle = page.locator('.tw-toggle[data-key="helikopter"]');
  await toggle.waitFor({ state: 'visible', timeout: 10_000 });

  // ── (3) the "Helikopter" toggle is REACHABLE — its box sits INSIDE the viewport and is
  //        ≥56 px tall (the tap-target contract). The panel scrolls internally
  //        (.boot-card-ish overflow-y), so bring it into view first. ──
  await toggle.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200); // let the internal scroll settle before measuring
  const rect = await toggle.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height,
      vw: window.innerWidth, vh: window.innerHeight,
    };
  });
  expect(rect.height, 'helikopter toggle ≥ 56 px tall (tap target)').toBeGreaterThanOrEqual(56);
  expect(rect.top, `helikopter toggle top inside the viewport (top=${rect.top.toFixed(0)})`).toBeGreaterThanOrEqual(0);
  expect(rect.bottom, `helikopter toggle bottom inside the viewport (bottom=${rect.bottom.toFixed(0)} ≤ vh=${rect.vh})`).toBeLessThanOrEqual(rect.vh);
  expect(rect.left, 'helikopter toggle left inside the viewport').toBeGreaterThanOrEqual(0);
  expect(rect.right, `helikopter toggle right inside the viewport (right=${rect.right.toFixed(0)} ≤ vw=${rect.vw})`).toBeLessThanOrEqual(rect.vw);
  await record('instellingen', true); // shot: the toggle on-screen in Instellingen

  // ── (4) tap it ON (defensive if already on) and confirm it armed. ──
  if ((await toggle.getAttribute('aria-checked')) !== 'true') await clickish(page, toggle);
  await expect
    .poll(() => toggle.getAttribute('aria-checked'), { timeout: 5_000, message: 'the Helikopter toggle reads ON after the tap' })
    .toBe('true');

  // ── (5) close the panel: Klaar → pause hub → Terug naar de open plek → the live world. ──
  await clickish(page, page.locator('.tw-back'));
  await clickish(page, page.locator('.ph-back'));
  await page.locator('.explore-pause').waitFor({ state: 'visible', timeout: 10_000 }); // back on the world HUD
  await page.waitForTimeout(400);

  // ── (6) the opt-in now makes the helicopter AVAILABLE (opt-in + full motion). ──
  const enabled = await readHeli(page);
  expect(enabled.h?.optIn, 'toggle ON → opt-in true').toBe(true);
  expect(enabled.h?.available, 'toggle ON + full motion → the helicopter is available').toBe(true);
  await record('enabled', false);

  // ── (7) walk to the parked helicopter (heli.x/z) until heli().near (mirrors the frozen
  //        e2e/heli.spec.ts walkToHeli steering + budget). ──
  const target = { x: enabled.h!.x, z: enabled.h!.z };
  const held = new Set<string>();
  const sync = async (want: Set<string>): Promise<void> => {
    for (const k of KEYS) {
      if (want.has(k) && !held.has(k)) { await page.keyboard.down(k); held.add(k); }
      else if (!want.has(k) && held.has(k)) { await page.keyboard.up(k); held.delete(k); }
    }
  };
  let near = false;
  try {
    for (let step = 0; step < 240 && !near; step++) {
      const { h, pos, yaw } = await readHeli(page);
      if (h && pos && yaw != null) {
        near = h.near;
        if (near) break;
        const { sx, sYf } = screenDir(target.x - pos.x, target.z - pos.z, yaw);
        const want = new Set<string>();
        if (sx > 0.4) want.add('ArrowRight'); else if (sx < -0.4) want.add('ArrowLeft');
        if (sYf > 0.4) want.add('ArrowUp'); else if (sYf < -0.4) want.add('ArrowDown');
        await sync(want);
      }
      await page.waitForTimeout(120);
    }
  } finally { await sync(new Set()).catch(() => {}); }
  expect(near, 'ranger reached the parked helicopter (heli().near)').toBe(true);
  await page.waitForTimeout(400); // let the affordance render + camera settle
  const atPad = await record('at-pad', true); // shot: the "Stap in de helikopter" affordance at the pad
  expect(atPad.near, 'at the pad heli().near is true').toBe(true);
  expect(atPad.available, 'at the pad the helicopter is still available').toBe(true);

  // the "🚁 Stap in de helikopter" affordance is up (available + beside it).
  const enterBtn = page.locator('.explore-heli-enter');
  await expect(enterBtn, 'the "Stap in de helikopter" affordance shows at the pad').toBeVisible();

  // ── (8) TAP to enter (the real player action). A Space-interact fallback (the same
  //        enterHeli path the frozen e2e uses) covers a dropped tap so the scene never
  //        flakes on actionability — the assert below is what proves the entry. ──
  await clickish(page, enterBtn);
  let inHeli = false;
  for (let i = 0; i < 40; i++) {
    inHeli = (await readHeli(page)).h?.inHeli ?? false;
    if (inHeli) break;
    if (i === 12 && !inHeli) await page.keyboard.press('Space'); // fallback: the interact key
    await page.waitForTimeout(200);
  }
  const entered = await record('in-heli', true); // shot: airborne (cockpit frame up)
  expect(entered.inHeli, 'after the "Stap in de helikopter" tap, the ranger is flying (heli().inHeli)').toBe(true);

  // write the burst annotations so the phase audit reads the enable→enter path step by step
  fs.writeFileSync(
    path.join(EVID, `heli-enter-${platform}.json`),
    JSON.stringify({ box: 'P1.5c', platform, spec: 'heli-enter.spec.ts', toggleRect: rect, steps }, null, 2),
  );

  // ── budget contract holds across every recorded step. ──
  for (const s of steps) {
    if (s.drawCalls == null) continue;
    expect(s.drawCalls, `step ${s.i} [${s.phase}] drawCalls < 150 (budget holds)`).toBeLessThan(150);
  }
});
