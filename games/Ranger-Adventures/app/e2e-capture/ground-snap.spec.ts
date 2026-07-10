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
  // P1.5a ven-traverse extras (unused by the D1.2 forward-burst): the camera yaw used
  // to steer toward the ven, and a descriptive spawn/relief/ven-shore traverse label.
  yaw?: number | null; zone?: string;
};

/** Robust click for the title/avatar buttons: a real click, then a faithful DOM
 *  `click` dispatch if the live render defeats the actionability gate (mirrors the
 *  capture harness `press`). */
async function clickish(page: Page, locator: ReturnType<Page['locator']>): Promise<void> {
  try { await locator.click({ timeout: 4_000 }); return; }
  catch { if (await locator.isVisible().catch(() => false)) await locator.dispatchEvent('click'); }
}

/** The four locomotion keys + the world→screen steering basis (mirrors the capture
 *  harness `KEYS`/`screenDir`): converts a world (dx,dz) heading into the camera-
 *  relative axes the Arrow keys drive, so the P1.5a burst can STEER toward a world
 *  target (the ven basin) instead of holding one blind direction like the D1.2 burst. */
const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const;
function screenDir(dx: number, dz: number, yaw: number): { sx: number; sYf: number } {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return { sx: dx * c - dz * s, sYf: -dx * s - dz * c };
}

/** Boot from a clean first-run save into the live world with the rig up + the follow
 *  camera settled (mirrors capture.spec.ts runGroup + bootWorld, keyboard project).
 *  Shared by the D1.2 forward-burst and the P1.5a ven-traverse so both boot identically. */
async function bootToWorld(page: Page): Promise<void> {
  // seed the presence gate + a clean first-run save BEFORE any app script, then boot.
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
}

test('D1.2 ground-snap drive-burst — the ranger stays on the rendered terrain', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'ipad', 'laptop-only automated verification (iPad walk = Floris demo, P1.5a +demo)');
  test.setTimeout(300_000); // the first cold boot streams ~13 MB of GLBs (~3 min, config note)
  const platform = testInfo.project.name;
  const shotDir = path.join(EVID, platform, 'd12-ground-burst'); // subdir → never touched by the capture prune
  fs.mkdirSync(shotDir, { recursive: true });

  await bootToWorld(page);

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

/**
 * P1.5a DRIVE-ASSERT — the ranger NEVER sinks through the floor/terrain, all the way to
 * the ven bank (builds on D1.2's ground-truth; RUN-D-LEDGER P1.5a).
 *
 * Where the D1.2 burst holds ONE forward direction, this one STEERS spawn → the sloped
 * bos/ven relief → the ven-water bank (Biomes.VEN_CENTER 46,−19), sampling
 * `__ranger.grounded()` EVERY frame. The ven bank is the exact spot D0.1's fresh
 * `45-ven-shore` buried the ranger to his NECK on laptop: the rendered terrain surface
 * at world (x,z) is `heightAt(x,−z)` (buildGround tilts the plane −90° about X) while the
 * pre-D1.2 analytic Y-write read `heightAt(x,z)` — the two disagree by ~4 m AT THE VEN, so
 * the old code sank him ~3–4 m under the bank. This burst proves D1.2's raycast ground-snap
 * keeps his feet ON the rendered surface across the WHOLE traverse, ending on the bank with
 * the water ahead (no half-buried frame) — the drive-assert the ledger's verify-by names.
 *
 * Fast self-verify in isolation:
 *   npx playwright test --config playwright.capture.config.ts e2e-capture/ground-snap.spec.ts \
 *     --project=laptop -g "P1.5a"
 * Laptop-only (keyboard drive); the iPad dune walk is Floris's on-device demo (P1.5a +demo).
 * Pixels stay the court of appeal (§8.7): the ven-shore screenshot lets the audit overrule
 * the asserts if they ever disagree.
 */
test('P1.5a ven-shore drive-burst — the ranger stays grounded from spawn to the ven bank', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'ipad', 'laptop-only automated verification (iPad dune walk = Floris demo, P1.5a +demo)');
  test.setTimeout(300_000); // the first cold boot streams ~13 MB of GLBs (~3 min, config note)
  const platform = testInfo.project.name;
  const shotDir = path.join(EVID, platform, 'p15a-ven-burst'); // subdir → never touched by the capture prune
  fs.mkdirSync(shotDir, { recursive: true });

  await bootToWorld(page);

  // Biomes.VEN_CENTER / VEN_SHORE_R — the water basin + its moss/reed bank ring. Distance-
  // based traverse labels (hermetic — no game-code import): spawn (the lodge clearing) →
  // relief (the sloped bos/stuifzand between = the slopes + dunes the ledger names) → the
  // ven-shore bank. The near-latch mirrors capture.spec.ts walkToVen (< 22 m from centre).
  const VEN = { x: 46, z: -19 };
  const SHORE_R = 26;
  const zoneOf = (p: { x: number; z: number } | null): string => {
    if (!p) return 'unknown';
    if (Math.hypot(p.x, p.z) < 8) return 'spawn';
    if (Math.hypot(p.x - VEN.x, p.z - VEN.z) < SHORE_R) return 'ven-shore';
    return 'relief';
  };

  const samples: Sample[] = [];
  // Sample the ground-truth numbers + the camera yaw (to steer) EVERY frame (the drive-
  // assert court); shoot a screenshot only on a few frames for the visual audit.
  const grab = async (i: number, shoot: boolean): Promise<Sample> => {
    const s = await page.evaluate(() => {
      const r = (window as unknown as { __ranger?: {
        pos(): { x: number; z: number } | null; cameraYaw(): number | null;
        grounded(): { grounded: boolean; clearance: number; analyticGap: number } | null;
        drawCalls(): number | null; clip(): { name: string } | null; groundSpeed(): number | null;
      } }).__ranger;
      if (!r) return null;
      const g: GroundHook = r.grounded();
      return {
        pos: r.pos(), yaw: r.cameraYaw(),
        grounded: g ? g.grounded : null, clearance: g ? g.clearance : null, analyticGap: g ? g.analyticGap : null,
        drawCalls: r.drawCalls(), clip: r.clip() ? r.clip()!.name : null, groundSpeed: r.groundSpeed(),
      };
    });
    let file = '';
    if (shoot) {
      file = `p15a-ven-${String(i).padStart(2, '0')}.png`;
      await page.screenshot({ path: path.join(shotDir, file) });
      file = `${platform}/p15a-ven-burst/${file}`;
    }
    const sample: Sample = {
      i, file,
      pos: s?.pos ?? null, yaw: s?.yaw ?? null, zone: zoneOf(s?.pos ?? null),
      grounded: s?.grounded ?? null, clearance: s?.clearance ?? null, analyticGap: s?.analyticGap ?? null,
      drawCalls: s?.drawCalls ?? null, clip: s?.clip ?? null, groundSpeed: s?.groundSpeed ?? null,
    };
    samples.push(sample);
    return sample;
  };

  let last = await grab(0, true); // frame 0 — at spawn (grounded; mesh agrees with the analytic field at origin)
  // ── the burst: STEER toward the ven basin, PRESS onto the reed bank, sampling the
  //    ground-truth every frame. The deepest divergence (~4 m) is at VEN_CENTER itself,
  //    but that is un-standable water (World.limits.blocked no-wade line) — so the ranger
  //    presses in until the no-wade bank stops his advance (~14–18 m out, where the
  //    pre-D1.2 analytic Y-write still buried him past the neck). We break once he can get
  //    no closer (no distance improvement for a run of frames), i.e. he is ON the bank. ──
  const STEPS = 140; // bounded budget (never the 30-min stall, P0.3)
  const held = new Set<string>();
  const sync = async (want: Set<string>): Promise<void> => {
    for (const k of KEYS) {
      if (want.has(k) && !held.has(k)) { await page.keyboard.down(k); held.add(k); }
      else if (!want.has(k) && held.has(k)) { await page.keyboard.up(k); held.delete(k); }
    }
  };
  let reached = false, minD = Infinity, noImprove = 0;
  try {
    for (let step = 1; step <= STEPS; step++) {
      const p = last.pos, yaw = last.yaw;
      if (p && yaw != null) {
        const d = Math.hypot(p.x - VEN.x, p.z - VEN.z);
        if (d < SHORE_R) reached = true;                         // entered the moss/reed bank ring
        if (d < minD - 0.05) { minD = d; noImprove = 0; } else { noImprove += 1; }
        if (reached && noImprove >= 6) break;                    // pressed onto the no-wade bank — as close as he stands
        const { sx, sYf } = screenDir(VEN.x - p.x, VEN.z - p.z, yaw);
        const want = new Set<string>();
        if (sx > 0.4) want.add('ArrowRight'); else if (sx < -0.4) want.add('ArrowLeft');
        if (sYf > 0.4) want.add('ArrowUp'); else if (sYf < -0.4) want.add('ArrowDown');
        await sync(want);
      }
      await page.waitForTimeout(150);
      last = await grab(step, step % 8 === 0); // shoot every 8th frame for the visual audit
    }
  } finally { await sync(new Set()).catch(() => {}); }

  // settle at the bank + take the money frame: feet ON the ven shore, water ahead, NO
  // half-buried frame (the D0.1 `45-ven-shore` neck-deep sink is what this must disprove).
  await page.waitForTimeout(700);
  const shore = await grab(samples.length, true);

  // write the burst annotations so the phase audit reads the ground-truth frame by frame
  fs.writeFileSync(
    path.join(EVID, `ven-ground-burst-${platform}.json`),
    JSON.stringify({ box: 'P1.5a', platform, spec: 'ground-snap.spec.ts', venCenter: VEN, shoreR: SHORE_R, minDistToVen: minD, sinkTol: SINK_TOL, airTol: AIR_TOL, reached, samples }, null, 2),
  );

  // ── assertions across the WHOLE burst (drive-assert, not one frame) ──
  for (const s of samples) {
    const at = `frame ${s.i} @ ${JSON.stringify(s.pos)} [${s.zone}]`;
    expect(s.grounded, `${at} grounded (feet on the rendered terrain, never through it)`).toBe(true);
    expect(s.clearance, `${at} clearance ≥ ${-SINK_TOL} (never sunk below the surface)`).toBeGreaterThanOrEqual(-SINK_TOL);
    expect(s.clearance, `${at} clearance ≤ ${AIR_TOL} (never floating)`).toBeLessThanOrEqual(AIR_TOL);
    expect(s.drawCalls ?? 0, `${at} drawCalls < 150 (budget holds with the BVH snap)`).toBeLessThan(150);
  }
  // it reached + pressed onto the ven bank — the specific spot D0.1 buried him to the neck
  expect(reached, 'burst entered the ven bank ring (within SHORE_R of VEN_CENTER)').toBe(true);
  expect(zoneOf(shore.pos), 'final settle frame is on the ven shore').toBe('ven-shore');
  // it genuinely WALKED the full spawn → ven distance (not a no-op that trivially passes)
  const first = samples[0].pos, lastP = shore.pos;
  expect(first && lastP, 'spawn + ven-shore positions present').toBeTruthy();
  expect(Math.hypot(lastP!.x - first!.x, lastP!.z - first!.z), 'walked the full spawn → ven distance').toBeGreaterThan(20);
  // …and it crossed the ven divergence zone — the deepest the ranger can STAND is the
  // no-wade bank (the ~4 m centre is water), and even there the pre-D1.2 analytic Y-write
  // read ~2 m+ below the rendered surface (D0.1: buried to the neck on the 1.7 m model). A
  // still-grounded ranger across that zone is the proof D1.2's raycast snap fixed the sink.
  const maxGap = Math.max(...samples.map((s) => Math.abs(s.analyticGap ?? 0)));
  expect(maxGap, 'burst crossed the ven divergence zone (pre-fix neck-deep sink)').toBeGreaterThan(1.5);
  // he crossed real relief between spawn and the ven — the slopes/dunes the ledger names
  const zones = new Set(samples.map((s) => s.zone));
  expect(zones.has('spawn') && zones.has('relief') && zones.has('ven-shore'), 'burst crossed spawn → relief → ven-shore').toBe(true);
});
