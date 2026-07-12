import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * P1.6a DRIVE-ASSERT + PAIR SHOT — Alvah is a CHILD beside the adult warden
 * (RUN-D-DIRECTION §2.4 "speler Alvah is een KIND ... ≈120 cm; volwassen mensen
 * ≈180 cm"; RUN-D-PLAN §5: a scale box is proven by DRIVING the walk to the adult
 * NPC and asserting the live dev-hook heights ACROSS the approach, plus a pixel
 * frame the audit can overrule — §8.7, pixels are the court of appeal).
 *
 * The audit read the ranger as adult-scale (avatar.height ≈ 1.70) dark-haired in
 * every frame. This walks the ranger up to the staged warden (BOA) at his fixed
 * hub spot (World.ts placeScenicActors, ~6.4,4.4) — close enough that the warden's
 * distance-faded name-tag stops ghosting him and he reads SOLID (audit #3) — and,
 * at IDLE (the walk bob inflates the height read ~+0.01, audit note), asserts:
 *   - avatar.height ∈ [1.1, 1.35]        the child band (was the ~1.7 m adult)
 *   - the warden's measured height ∈ [1.7, 1.9]   the mature-human reference
 *   - avatar.height < 0.75 × warden      a clear head-and-shoulders shorter
 *   - drawCalls < 150                    the budget contract holds
 * then shoots `p16a-child-vs-adult` — the child in the near foreground with the
 * adult just beyond, the size gap unmistakable. The main capture's `01-title` +
 * `d13-*-entry` frames re-read at child scale for free (Stage + World prep the
 * ranger GLB to the same ≈1.2 m stand-height).
 *
 * Lives in the capture testDir so `npm run capture` (the phase audit) re-runs it;
 * runnable in isolation for a fast self-verify:
 *   npx playwright test --config playwright.capture.config.ts e2e-capture/child-scale.spec.ts --project=laptop
 * Laptop-only automated verification (keyboard drive).
 */

const EVID = path.resolve(process.cwd(), '../runs/run-3-ux-polish/audit-evidence');

// The warden (BOA) stands at this fixed hub spot — World.ts placeScenicActors.
// A harness knows the world layout (like ground-snap.spec.ts knows the ven centre);
// his HEIGHT comes off the live `actors()` hook, only his XZ is read from here.
const WARDEN = { x: 6.4, z: 4.4 };
// Aim BESIDE the warden, not straight at him: a follow camera trails behind the ranger, so a
// head-on stop parks the warden farther from the lens than the child and perspective cancels the
// real 1.2-vs-1.8 m height gap (they read the same on-screen). Standing the child abreast of the
// warden puts BOTH at ~equal camera depth, so the adult reads a genuine ~1.5× taller. `SIDE_OFFSET`
// is the abreast spacing (perpendicular to the spawn→warden line); the child stops within STOP_TO_B
// of that spot.
const SIDE_OFFSET = 2.0;
const STOP_TO_B = 1.1;  // forgiving arrival radius around the abreast spot (never a precise point the walk overshoots)
const REACH_MAX = 3.6;  // the settled pair-shot pose must confirm this close to the warden, or the run diverged (hard assert)

type Sample = {
  i: number;
  pos: { x: number; z: number } | null; yaw: number | null;
  avatarH: number | null; wardenH: number | null;
  drawCalls: number | null; clip: string | null;
  file: string;
};

const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const;
/** world (dx,dz) heading → camera-relative Arrow axes (mirrors view-clear/ground-snap). */
function screenDir(dx: number, dz: number, yaw: number): { sx: number; sYf: number } {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return { sx: dx * c - dz * s, sYf: -dx * s - dz * c };
}

async function clickish(page: Page, locator: ReturnType<Page['locator']>): Promise<void> {
  try { await locator.click({ timeout: 4_000 }); return; }
  catch { if (await locator.isVisible().catch(() => false)) await locator.dispatchEvent('click'); }
}

/** Boot from a clean first-run save into the live world with the rig up + camera settled
 *  (mirrors view-clear.spec.ts). Reduced-motion OFF (default) so the follow boom eases normally. */
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
  for (;;) {
    if (await confirm.isVisible().catch(() => false)) { await clickish(page, confirm); break; }
    if (await page.evaluate(() => (window as unknown as { __ranger?: { screen: string } }).__ranger?.screen === 'world')) break;
    if (Date.now() - t0 > 40_000) { await clickish(page, confirm); break; }
    await page.waitForTimeout(150);
  }
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __ranger?: { screen: string } }).__ranger?.screen ?? null), { timeout: 40_000 })
    .toBe('world');
  // the real child rig swaps in async over the stand-in — avatar.height reads once it lands
  await page.waitForFunction(() => {
    const r = (window as unknown as { __ranger?: { avatar?: () => { height: number } | null } }).__ranger;
    return !!(r && r.avatar && (r.avatar()?.height ?? 0) > 0.5);
  }, undefined, { timeout: 25_000 }).catch(() => { /* zero-asset env still asserts the child band on the stand-in */ });
  await page.waitForTimeout(1500); // seat the idle pose + settle the follow camera + stream the scenic actors in
}

/** Read the live child + warden heights + budget off the dev hook. */
async function readState(page: Page): Promise<{
  pos: { x: number; z: number } | null; yaw: number | null;
  avatarH: number | null; wardenH: number | null; drawCalls: number | null; clip: string | null;
}> {
  return page.evaluate(() => {
    const r = (window as unknown as { __ranger?: {
      pos(): { x: number; z: number } | null; cameraYaw(): number | null;
      avatar(): { height: number } | null;
      actors(): { id: string; height: number }[] | null;
      drawCalls(): number | null; clip(): { name: string } | null;
    } }).__ranger;
    if (!r) return { pos: null, yaw: null, avatarH: null, wardenH: null, drawCalls: null, clip: null };
    const warden = (r.actors() ?? []).find((a) => a.id === 'ranger-warden-boa') ?? null;
    return {
      pos: r.pos(), yaw: r.cameraYaw(),
      avatarH: r.avatar()?.height ?? null,
      wardenH: warden ? warden.height : null,
      drawCalls: r.drawCalls(),
      clip: r.clip() ? r.clip()!.name : null,
    };
  });
}

test('P1.6a child-scale — Alvah reads a clear head shorter than the adult warden', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'ipad', 'laptop-only automated verification (keyboard drive)');
  test.setTimeout(300_000); // the first cold boot streams ~13 MB of GLBs (~3 min, config note)
  const platform = testInfo.project.name;
  const shotDir = path.join(EVID, platform, 'p16a-childscale-burst');
  fs.mkdirSync(shotDir, { recursive: true });
  // D1.4: clear prior-run PNGs from this incremental-named burst subdir so the fresh set on disk
  // EQUALS this run (the top-level capture prune skips subdirs).
  for (const f of fs.readdirSync(shotDir)) {
    if (f.endsWith('.png')) { try { fs.rmSync(path.join(shotDir, f)); } catch { /* a rm miss is not fatal */ } }
  }
  // D1.6: WIPE the burst JSON up front so a failed leg leaves NO json (honest gap), not a stale one.
  try { fs.rmSync(path.join(EVID, `childscale-burst-${platform}.json`)); } catch { /* absent on a first run — fine */ }

  await bootToWorld(page);

  const samples: Sample[] = [];
  let idx = 0;
  const grab = async (shoot: boolean, name?: string): Promise<Sample> => {
    const i = idx++;
    const s = await readState(page);
    let file = '';
    if (shoot) {
      const base = name ?? `p16a-childscale-${String(i).padStart(2, '0')}`;
      await page.screenshot({ path: path.join(shotDir, `${base}.png`) });
      file = `${platform}/p16a-childscale-burst/${base}.png`;
    }
    const sample: Sample = { i, file, pos: s.pos, yaw: s.yaw, avatarH: s.avatarH, wardenH: s.wardenH, drawCalls: s.drawCalls, clip: s.clip };
    samples.push(sample);
    return sample;
  };

  const start = (await readState(page)).pos ?? { x: 0, z: 0 };
  // the abreast stop spot: perpendicular to the spawn→warden line, SIDE_OFFSET metres to one side of
  // the warden, so the child ends up standing next to him at ~equal camera depth (see SIDE_OFFSET).
  const uw = { x: WARDEN.x - start.x, z: WARDEN.z - start.z };
  const un = Math.hypot(uw.x, uw.z) || 1;
  const perp = { x: -uw.z / un, z: uw.x / un }; // 90° off the approach line
  const B = { x: WARDEN.x + perp.x * SIDE_OFFSET, z: WARDEN.z + perp.z * SIDE_OFFSET };

  let cur = await grab(true); // frame 0 — at spawn
  // ── the approach: PULSED steering toward the abreast spot `B`. Each poll re-reads the SETTLED
  //    pose, aims fresh, holds the keys for ONE short burst, then RELEASES before the next read — so
  //    an uncorrected leg can never exceed ~0.4 m and the walk cannot orbit the target under poll
  //    starvation (D1.6 convergence law). The old continuous-hold walk diverged into a ~20 m
  //    oscillation that ended 7 m from the warden while `walked > 1.5` still "passed" — a vacuous
  //    pass (doc §8.7). Stop on a FORGIVING radius around `B` (like the jeep's near), never a precise
  //    point the hold overshoots; he arrives beside the warden so the trailing follow camera frames
  //    both at ~equal depth (the size gap reads true). ──
  const held = new Set<string>();
  const sync = async (want: Set<string>): Promise<void> => {
    for (const k of KEYS) {
      if (want.has(k) && !held.has(k)) { await page.keyboard.down(k); held.add(k); }
      else if (!want.has(k) && held.has(k)) { await page.keyboard.up(k); held.delete(k); }
    }
  };
  const pulse = async (want: Set<string>): Promise<void> => {
    await sync(want); await page.waitForTimeout(300);       // hold ≤400 ms (D1.6) — one bounded leg
    await sync(new Set()); await page.waitForTimeout(150);  // RELEASE + let the body decelerate before re-reading
  };
  let reached = false;
  try {
    for (let step = 1; step <= 90 && !reached; step++) {
      if (cur.pos && cur.yaw != null) {
        const dist = Math.hypot(cur.pos.x - B.x, cur.pos.z - B.z);
        if (dist <= STOP_TO_B) { reached = true; break; } // arrived beside the warden (forgiving radius)
        const { sx, sYf } = screenDir(B.x - cur.pos.x, B.z - cur.pos.z, cur.yaw);
        const want = new Set<string>();
        if (sx > 0.4) want.add('ArrowRight'); else if (sx < -0.4) want.add('ArrowLeft');
        if (sYf > 0.4) want.add('ArrowUp'); else if (sYf < -0.4) want.add('ArrowDown');
        await pulse(want);
      } else { await page.waitForTimeout(150); }
      cur = await grab(step % 4 === 0); // periodic burst frame; `cur` feeds the next poll's aim (settled read)
    }
  } finally { await sync(new Set()).catch(() => {}); }

  // settle at the stop: release the keys, let the walk bob decay to the IDLE pose (the height read
  // is sampled at idle — the bob inflates it), settle the follow camera, then the PAIR shot.
  await page.waitForTimeout(1600);
  const idle = await grab(true, 'p16a-child-vs-adult');
  // a second idle read a beat later — take the MINIMUM avatar height across the two settled reads as
  // the honest idle height (never a mid-bob inflated value).
  await page.waitForTimeout(400);
  const idle2 = await grab(false);
  const idleAvatarH = Math.min(idle.avatarH ?? Infinity, idle2.avatarH ?? Infinity);
  const wardenH = idle.wardenH ?? idle2.wardenH ?? null;
  // CONFIRMED distance to the warden at the SETTLED pair-shot pose (re-read after release, not a
  // mid-walk value) — the honest "did he actually reach the warden" signal.
  const finalPos = idle.pos ?? idle2.pos ?? null;
  const distToWarden = finalPos ? Math.hypot(finalPos.x - WARDEN.x, finalPos.z - WARDEN.z) : Infinity;

  const maxDraw = Math.max(0, ...samples.map((s) => s.drawCalls ?? 0));
  const walked = Math.max(...samples.map((s) => (s.pos ? Math.hypot(s.pos.x - start.x, s.pos.z - start.z) : 0)));

  fs.writeFileSync(
    path.join(EVID, `childscale-burst-${platform}.json`),
    JSON.stringify({ box: 'P1.6a', platform, spec: 'child-scale.spec.ts', warden: WARDEN, abreast: B, reached, distToWarden, idleAvatarH, wardenH, maxDraw, walked, samples }, null, 2),
  );

  // ── assertions ──
  // the budget contract holds across the whole approach.
  for (const s of samples) {
    expect(s.drawCalls ?? 0, `frame ${s.i} drawCalls < 150`).toBeLessThan(150);
  }
  // the child band — Alvah is ≈1.2 m at idle, no longer the ~1.7 m adult.
  expect(idleAvatarH, `idle avatar.height in the child band [1.1, 1.35] (was the ~1.7 m adult)`).toBeGreaterThanOrEqual(1.1);
  expect(idleAvatarH, `idle avatar.height in the child band [1.1, 1.35]`).toBeLessThanOrEqual(1.35);
  // the warden is the mature-human reference, and the child reads a clear head shorter beside him.
  // (Guarded like view-clear's `if (target)` — a zero-asset env has no warden to compare; the real
  // capture always loads him, so this leg carries the pair-shot evidence.)
  if (wardenH != null) {
    expect(wardenH, `warden height ∈ [1.7, 1.9] (the ~1.8 m adult reference)`).toBeGreaterThanOrEqual(1.7);
    expect(wardenH, `warden height ∈ [1.7, 1.9]`).toBeLessThanOrEqual(1.9);
    expect(idleAvatarH, `Alvah < 0.75 × the warden (a clear head-and-shoulders shorter)`).toBeLessThan(0.75 * wardenH);
  }
  // the approach genuinely CONVERGED on the warden — the pair shot frames them together, not a
  // divergent orbit that ended metres away (the vacuous pass the old `walked > 1.5` let slip).
  expect(reached, `the pulsed approach converged on the warden (no orbit)`).toBe(true);
  expect(distToWarden, `settled within ${REACH_MAX} m of the warden for the pair shot`).toBeLessThanOrEqual(REACH_MAX);
});
