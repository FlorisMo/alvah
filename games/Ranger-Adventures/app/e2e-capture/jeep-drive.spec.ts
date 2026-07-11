import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * P1.5b DRIVE-ASSERT — the jeep actually DRIVES: it translates through the world along its
 * heading with believable ground contact, no stick-and-slide, no hard Y-snap
 * (RUN-D-LEDGER P1.5b; RUN-D-DIRECTION §2.2 vehicles read the rendered mesh;
 * runs/animation-research.md §4.5 damped hover; RUN-D-PLAN §5: a physics/interaction box is
 * proven by DRIVING the action and asserting live dev-hook state ACROSS the burst — a static
 * shot is no evidence).
 *
 * It boots the real world, walks the ranger to the parked jeep, climbs in, and drives TWO
 * bursts, sampling `__ranger.vehicle()` every frame:
 *   1. a HELD-TURN burst (throttle + one steer) — the heading must change SMOOTHLY and
 *      MONOTONICALLY (headingUnwrapped, the never-wrapped F-32 signal), no wrap-jump;
 *   2. a STRAIGHT burst (throttle only) — the jeep translates forward along its heading and
 *      the heading must NOT drift on its own (the F-32 control condition).
 * Across the WHOLE drive it asserts:
 *   - grounded === true          the jeep sits ON the rendered terrain every frame (the P1.5b
 *                                fix: a damped hover toward `groundSnapY`, never the old hard
 *                                `jp.y = groundY(...)` per-frame snap that welded it to bumps);
 *   - clearance in the jeep band never sunk THROUGH the ground nor launched off a crest;
 *   - x/z path length ≫ 0        it genuinely translated (refutes stick-and-slide-in-place);
 *   - forward progress           each driving frame moves FORWARD along its heading (never a
 *                                backward slide), and the straight burst is monotonic along it;
 *   - drawCalls < 150            the budget contract holds with the per-frame ground ray.
 *
 * Lives in the capture testDir so `npm run capture` (the phase audit) re-runs it, and it is
 * runnable in isolation for a fast self-verify:
 *   npx playwright test --config playwright.capture.config.ts e2e-capture/jeep-drive.spec.ts --project=laptop
 * Laptop-only automated verification (keyboard drive); the real-device drive FEEL is Floris's
 * on-device demo (P1.5b +demo). Pixels stay the court of appeal (§8.7): the per-frame
 * screenshots beside this burst let the audit overrule the asserts if they ever disagree.
 */

const EVID = path.resolve(process.cwd(), '../runs/run-3-ux-polish/audit-evidence');
// Jeep suspension band — MIRRORS World.ts JEEP_SINK_TOL / JEEP_AIR_TOL. Wider than the
// walker's tight feet band: the damped hover lets Y lag the ground target a little (that lag
// IS the smoothing, never the old hard snap), so the jeep rides a touch into / above the
// surface without being "not grounded".
const JEEP_SINK_TOL = 0.5;
const JEEP_AIR_TOL = 1.0;

type VehHook = {
  placed: boolean; near: boolean; inVehicle: boolean;
  x: number; z: number; y: number; heading: number; headingUnwrapped: number;
  grounded: boolean; clearance: number; speed: number;
} | null;

type JeepSample = {
  i: number; phase: 'enter' | 'turn' | 'straight' | 'rest'; t: number;
  x: number | null; z: number | null; y: number | null;
  heading: number | null; headingUnwrapped: number | null; speed: number | null;
  grounded: boolean | null; clearance: number | null;
  inVehicle: boolean | null; drawCalls: number | null;
  file: string;
};

/** Robust click for the title/avatar buttons (mirrors ground-snap.spec.ts / the capture
 *  harness `press`): a real click, then a faithful DOM `click` dispatch if the live render
 *  defeats the actionability gate. */
async function clickish(page: Page, locator: ReturnType<Page['locator']>): Promise<void> {
  try { await locator.click({ timeout: 4_000 }); return; }
  catch { if (await locator.isVisible().catch(() => false)) await locator.dispatchEvent('click'); }
}

/** The four locomotion keys + the world→screen steering basis (mirrors the capture harness
 *  `KEYS`/`screenDir`): converts a world (dx,dz) heading into the camera-relative axes the
 *  Arrow keys drive, so the walk-to-jeep leg can STEER toward the parked jeep. */
const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const;
function screenDir(dx: number, dz: number, yaw: number): { sx: number; sYf: number } {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return { sx: dx * c - dz * s, sYf: -dx * s - dz * c };
}

/** Boot from a clean first-run save into the live world with the rig up + the follow
 *  camera settled (mirrors ground-snap.spec.ts bootToWorld). */
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
  }, undefined, { timeout: 25_000 }).catch(() => { /* zero-asset env still asserts grounded */ });
  await page.waitForTimeout(1200); // seat the idle pose + settle the follow camera
}

/** Read the live jeep hook + drawCalls in one evaluate. */
async function readVeh(page: Page): Promise<{ v: VehHook; ranger: { x: number; z: number } | null; yaw: number | null; drawCalls: number | null }> {
  return page.evaluate(() => {
    const r = (window as unknown as { __ranger?: {
      vehicle(): VehHook; pos(): { x: number; z: number } | null; cameraYaw(): number | null; drawCalls(): number | null;
    } }).__ranger;
    if (!r) return { v: null, ranger: null, yaw: null, drawCalls: null };
    // VehHook is the World.vehicleState() shape (P1.5b adds y/grounded/clearance).
    return { v: r.vehicle(), ranger: r.pos(), yaw: r.cameraYaw(), drawCalls: r.drawCalls() };
  });
}

test('P1.5b jeep drive-burst — it translates along its heading, grounded, no stick-and-slide', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'ipad', 'laptop-only automated verification (real-device drive feel = Floris demo, P1.5b +demo)');
  // A COLD vite-dev boot (on-demand transform of three.js + ~170 modules, then ~13 MB of GLB
  // streaming) can take ~4–5 min on the FIRST request in isolation; under `npm run capture`
  // the server is already warm from earlier scenes and this finishes in ~90 s. The higher
  // ceiling only bites the cold isolated case — it never slows the warm audit run.
  test.setTimeout(600_000);
  const platform = testInfo.project.name;
  const shotDir = path.join(EVID, platform, 'p15b-jeep-burst');
  fs.mkdirSync(shotDir, { recursive: true });
  // D1.4: clear prior-run PNGs first — a shorter fresh drive would otherwise leave stale
  // higher-index frames beside fresh ones (the top-level prune skips subdirs; GATE-D1).
  for (const f of fs.readdirSync(shotDir)) {
    if (f.endsWith('.png')) { try { fs.rmSync(path.join(shotDir, f)); } catch { /* a rm miss is not fatal */ } }
  }
  // D1.6: WIPE the burst JSON up front too — its write is late in the test (after the walk +
  // enter asserts), so a failed leg would leave last run's JSON stale beside fresh PNGs. A
  // failed run now leaves NO json (honest gap); a passing run rewrites it fresh.
  try { fs.rmSync(path.join(EVID, `jeep-drive-burst-${platform}.json`)); } catch { /* absent on a first run — fine */ }

  await bootToWorld(page);

  // ── the jeep must be placed (World.placeJeep parks it at stuifzand NE ~21 m from spawn) ──
  const placed = await page.evaluate(() => {
    const r = (window as unknown as { __ranger?: { vehicle(): { placed: boolean } | null } }).__ranger;
    return r?.vehicle()?.placed ?? false;
  });
  expect(placed, 'the jeep is placed in the world').toBe(true);

  const samples: JeepSample[] = [];
  let shotN = 0;
  const grab = async (phase: JeepSample['phase'], shoot: boolean): Promise<JeepSample> => {
    const { v, drawCalls } = await readVeh(page);
    const t = Date.now(); // read-time stamp (BEFORE the slow screenshot) → clean per-sample Δt for the rate asserts
    let file = '';
    if (shoot) {
      const name = `p15b-jeep-${String(shotN).padStart(2, '0')}.png`;
      await page.screenshot({ path: path.join(shotDir, name) });
      file = `${platform}/p15b-jeep-burst/${name}`;
      shotN += 1;
    }
    const s: JeepSample = {
      i: samples.length, phase, t,
      x: v?.x ?? null, z: v?.z ?? null, y: v?.y ?? null,
      heading: v?.heading ?? null, headingUnwrapped: v?.headingUnwrapped ?? null, speed: v?.speed ?? null,
      grounded: v?.grounded ?? null, clearance: v?.clearance ?? null,
      inVehicle: v?.inVehicle ?? null, drawCalls: drawCalls ?? null, file,
    };
    samples.push(s);
    return s;
  };

  // ── walk to the parked jeep, steering by the same world→screen basis the P1.5a burst uses ──
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
      const { v, ranger, yaw } = await readVeh(page);
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
    }
  } finally { await sync(new Set()).catch(() => {}); }
  expect(near, 'ranger reached the jeep (vehicle().near)').toBe(true);

  // ── climb in (laptop: Space) and confirm the drive mode took over ──
  await page.keyboard.press('Space');
  await expect
    .poll(async () => (await readVeh(page)).v?.inVehicle ?? false, { timeout: 15_000, message: 'Space climbs into the jeep' })
    .toBe(true);
  await page.waitForTimeout(700); // settle the wider follow-cam ease-in
  const enterSample = await grab('enter', true); // rest frame — just boarded, parked, grounded

  // Fast-sample a burst: state EVERY ~stepMs with NO per-frame screenshot. A `page.screenshot`
  // of this GL scene costs ~3 s headless — interleaving one into the sample stream stretches an
  // interval so far the jeep drives ~14 m and sweeps a large arc between samples, which corrupts
  // every kinematic delta (the chord across a curved arc reads "backward"). So screenshots are
  // taken ONLY at the rest points below; the kinematic court is these clean ~stepMs samples.
  const sampleBurst = async (phase: JeepSample['phase'], n: number, stepMs: number): Promise<void> => {
    for (let i = 0; i < n; i++) { await page.waitForTimeout(stepMs); await grab(phase, false); }
  };

  // ── BURST 1 — HELD TURN: throttle + one steer (ArrowUp+ArrowLeft). With F-32 speed-scaled
  //    steering the jeep turns AS it drives; headingUnwrapped must change smoothly + monotonically
  //    (no wrap-jump), the jeep translating the whole time. ──
  await page.keyboard.down('ArrowUp');
  await page.keyboard.down('ArrowLeft');
  try { await sampleBurst('turn', 12, 200); }
  finally { await page.keyboard.up('ArrowLeft').catch(() => {}); await page.keyboard.up('ArrowUp').catch(() => {}); }
  await page.waitForTimeout(1000); // coast to a near-stop so the shot is a clean "further along" frame
  await grab('rest', true); // rest frame — jeep visibly further along than enter (visual audit)

  // ── BURST 2 — STRAIGHT: throttle only (ArrowUp). The jeep drives forward along a fixed heading;
  //    headingUnwrapped must NOT drift on its own (the F-32 control condition). ──
  await page.keyboard.down('ArrowUp');
  try { await sampleBurst('straight', 12, 200); }
  finally { await page.keyboard.up('ArrowUp').catch(() => {}); }
  await page.waitForTimeout(1000);
  const endSample = await grab('rest', true); // final money frame — jeep further still along the track

  // always climb back out (defensive — keep the exit path exercised + the state clean)
  if ((await readVeh(page)).v?.inVehicle) {
    await page.keyboard.press('Space');
    await expect.poll(async () => (await readVeh(page)).v?.inVehicle ?? true, { timeout: 10_000 }).toBe(false).catch(() => {});
  }

  // write the burst annotations so the phase audit reads the ground-truth frame by frame
  fs.writeFileSync(
    path.join(EVID, `jeep-drive-burst-${platform}.json`),
    JSON.stringify({ box: 'P1.5b', platform, spec: 'jeep-drive.spec.ts', sinkTol: JEEP_SINK_TOL, airTol: JEEP_AIR_TOL, samples }, null, 2),
  );

  // ── assertions across the WHOLE drive (drive-assert, not one frame) ──
  const driving = samples.filter((s) => s.inVehicle === true);
  expect(driving.length, 'the whole burst was driven in-vehicle').toBe(samples.length);

  // (a) grounded every frame — the jeep sits ON the rendered terrain, never through it, never
  //     launched. This is the P1.5b fix: a damped hover, never the old hard per-frame snap.
  for (const s of samples) {
    const at = `frame ${s.i} [${s.phase}] @ (${s.x?.toFixed(1)}, ${s.z?.toFixed(1)}) y=${s.y?.toFixed(2)}`;
    expect(s.grounded, `${at} jeep grounded (on the rendered terrain)`).toBe(true);
    expect(s.clearance, `${at} clearance ≥ ${-JEEP_SINK_TOL} (never sunk THROUGH the ground)`).toBeGreaterThanOrEqual(-JEEP_SINK_TOL);
    expect(s.clearance, `${at} clearance ≤ ${JEEP_AIR_TOL} (never launched off a crest)`).toBeLessThanOrEqual(JEEP_AIR_TOL);
    expect(s.drawCalls ?? 0, `${at} drawCalls < 150 (budget holds with the ground ray)`).toBeLessThan(150);
  }

  // CLEAN kinematic pairs = consecutive samples INSIDE one fast burst (same 'turn'/'straight'
  // phase, ~200 ms apart, no slow screenshot between them). Deltas across the rest/enter shot
  // frames are excluded — those intervals carry a ~3 s screenshot and would misread the motion.
  const cleanPairs: [JeepSample, JeepSample][] = [];
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    if ((a.phase === 'turn' || a.phase === 'straight') && a.phase === b.phase) cleanPairs.push([a, b]);
  }
  expect(cleanPairs.length, 'enough clean in-burst kinematic pairs sampled').toBeGreaterThan(10);

  // (b) it TRANSLATED a real distance (refutes stick-and-slide-in-place): the in-burst path
  //     length ≫ 0, AND it ended well away from where it boarded.
  let pathLen = 0;
  for (const [a, b] of cleanPairs) pathLen += Math.hypot((b.x ?? 0) - (a.x ?? 0), (b.z ?? 0) - (a.z ?? 0));
  expect(pathLen, 'jeep drove a real distance (in-burst x/z path ≫ 0 — not stuck in place)').toBeGreaterThan(6);
  const net = Math.hypot((endSample.x ?? 0) - (enterSample.x ?? 0), (endSample.z ?? 0) - (enterSample.z ?? 0));
  expect(net, 'jeep ended well away from where it boarded (world position translated)').toBeGreaterThan(4);

  // (c) FORWARD progress along heading, every clean driving pair — never a backward slide (the
  //     stick-and-slide signature). Over a ~200 ms step the heading barely turns, so the chord is
  //     ~parallel to it; require ≥ 30 % of the chord is forward progress. Rim-pinned frames (chord
  //     ≈ 0, an expected boundary clamp) and ramp frames (speed < 0.3) are skipped honestly.
  let forwardPairs = 0;
  for (const [a, b] of cleanPairs) {
    if (a.x == null || a.z == null || b.x == null || b.z == null || b.heading == null) continue;
    const chord = Math.hypot(b.x - a.x, b.z - a.z);
    if (chord < 0.05 || (b.speed ?? 0) < 0.3) continue;
    const along = (b.x - a.x) * Math.sin(b.heading) + (b.z - a.z) * Math.cos(b.heading);
    expect(along, `frame ${b.i} [${b.phase}] moves FORWARD along its heading (no backward slide)`).toBeGreaterThan(0.3 * chord);
    forwardPairs += 1;
  }
  expect(forwardPairs, 'enough moving pairs to prove forward translation').toBeGreaterThan(6);

  // (c2) MONOTONIC along the STRAIGHT heading — the clean reading of "monotonic along heading".
  //      The straight burst holds a fixed heading (no steer), so the position projected onto that
  //      axis only ever grows (a rim-pin plateaus it — still non-decreasing), never reverses.
  const straight = samples.filter((s) => s.phase === 'straight' && s.x != null && s.z != null && s.heading != null);
  expect(straight.length, 'straight burst sampled').toBeGreaterThan(3);
  const axisH = straight[0].heading!;
  const proj = (s: JeepSample): number => s.x! * Math.sin(axisH) + s.z! * Math.cos(axisH);
  let peak = proj(straight[0]);
  for (let i = 1; i < straight.length; i++) {
    const p = proj(straight[i]);
    expect(p, `straight frame ${straight[i].i} progresses along the heading (monotonic, never reverses)`).toBeGreaterThanOrEqual(peak - 0.15);
    peak = Math.max(peak, p);
  }
  expect(proj(straight[straight.length - 1]) - proj(straight[0]), 'straight burst translated forward along its heading').toBeGreaterThan(1.5);

  // (d) heading changes SMOOTHLY with no wrap-jump — the RATE of the unwrapped signal is bounded
  //     (sampling-invariant: Δunwrapped / Δt). The reachable yaw rate is ~0.6 rad/s and the frozen
  //     turn-rate ceiling is 1.2; a ±2π wrap over a ~0.2 s step would read ~31 rad/s, so a 1.5 rad/s
  //     cap catches any wrap-jump with a huge margin while never failing a legitimate turn.
  for (const [a, b] of cleanPairs) {
    if (a.headingUnwrapped == null || b.headingUnwrapped == null) continue;
    const dt = (b.t - a.t) / 1000;
    if (dt <= 0) continue;
    const rate = Math.abs(b.headingUnwrapped - a.headingUnwrapped) / dt;
    expect(rate, `frame ${b.i} yaw-rate ${rate.toFixed(2)} rad/s bounded (smooth, no wrap-jump)`).toBeLessThan(1.5);
  }

  // (e) the TURN burst turned MONOTONICALLY a real amount, and the STRAIGHT burst did NOT self-drift
  //     (the F-32 pair — a real steer turns, no steer holds the line).
  const turn = samples.filter((s) => s.phase === 'turn' && s.headingUnwrapped != null);
  const straightU = samples.filter((s) => s.phase === 'straight' && s.headingUnwrapped != null);
  expect(turn.length >= 2 && straightU.length >= 2, 'both drive bursts sampled').toBe(true);
  const turnDelta = turn[turn.length - 1].headingUnwrapped! - turn[0].headingUnwrapped!;
  expect(Math.abs(turnDelta), 'held-turn burst changed the heading a real amount').toBeGreaterThan(0.3);
  for (let i = 1; i < turn.length; i++) {
    const d = turn[i].headingUnwrapped! - turn[i - 1].headingUnwrapped!;
    expect(Math.sign(d) === Math.sign(turnDelta) || d === 0, `turn frame ${turn[i].i} keeps turning the same way (monotonic)`).toBe(true);
  }
  const straightDrift = straightU[straightU.length - 1].headingUnwrapped! - straightU[0].headingUnwrapped!;
  expect(Math.abs(straightDrift), 'straight burst holds its heading (no self-drift doughnut)').toBeLessThan(0.1);
});
