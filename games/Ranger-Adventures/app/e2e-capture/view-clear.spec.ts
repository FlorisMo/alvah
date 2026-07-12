import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * D1.5 DRIVE-ASSERT — the free-walk follow camera never leaves the ranger lost in a
 * foliage void (RUN-D-DIRECTION §2.5 "the outside-props half binds the FREE-WALK follow
 * camera too"; RUN-D-PLAN §5: a camera/interaction box is proven by DRIVING the action and
 * asserting live dev-hook state ACROSS the burst — a static shot is no evidence).
 *
 * The GATE-D1 audit found `09-walk-4`/`10-walk-5`: on the plain spawn-south walk a tree crown
 * (or sapling) sat between the follow lens and the ranger — the whole frame foliage, the ranger
 * swallowed to the head — while the projection hooks (`onScreen`, `avatarInView`) still read
 * true (a hook-vs-pixel lie, §8.7). The fix is an OCCLUDER FADE: a real cam→avatar sightline
 * test against the tree crowns, and when one is genuinely BETWEEN lens and ranger the canopy is
 * faded (an opacity change, never a camera move → no comfort-law risk) so the ranger reads
 * through it.
 *
 * This burst STEERS the ranger past a real scatter pine (read from `treeSpots()`) so the tree
 * falls into the gap between him and the trailing follow camera — the exact `09-walk-4` geometry
 * — and every frame reads `__ranger.cam()`:
 *   - viewClear === true       the ranger is READABLE from the lens — no un-faded crown swallows
 *                              him (the primary contract: no fully-occluded frame);
 *   - drawCalls < 150          the budget contract holds (the fade re-uses the same meshes);
 *   - canopyFade               proof the fade fired on a GENUINE between-lens occluder (a burst
 *                              whose min canopyFade never dropped below 1 never met one, so a
 *                              still-clear viewClear there is a no-op — the analog of D1.2's
 *                              `analyticGap`).
 *   - terrainLift              (audit #4) the metres the follow boom rode UP to clear a TERRAIN
 *                              dune between lens and ranger — terrain can't be faded, so viewClear
 *                              now ALSO folds in a rendered-terrain sightline test and the boom
 *                              rides the crest (the D1.3 above-terrain law over the whole segment).
 *                              The pinned controls-hud/pause-hub frames in the full capture are the
 *                              primary terrain evidence; this burst records lift where its walk meets one.
 * It also records `avatarScreen.visible` + `avatarOpacity`: `visible` now folds in `viewClear`
 * so the hook can no longer read true over a foliage void — but it ALSO legitimately drops when
 * the boom collapses close and the ranger himself fades (the pre-existing F-05 rail), so the
 * honest anti-lie assert is "a SOLID, on-screen ranger always reads clear" (not visible===true).
 *
 * Lives in the capture testDir so `npm run capture` (the phase audit) re-runs it; runnable in
 * isolation for a fast self-verify:
 *   npx playwright test --config playwright.capture.config.ts e2e-capture/view-clear.spec.ts --project=laptop
 * Laptop-only automated verification (keyboard drive). Pixels stay the court of appeal (§8.7):
 * the per-frame screenshots beside this burst let the audit overrule the asserts if they ever
 * disagree — the ranger must be READABLE in every one.
 */

const EVID = path.resolve(process.cwd(), '../runs/run-3-ux-polish/audit-evidence');

type Sample = {
  i: number;
  pos: { x: number; z: number } | null; yaw: number | null;
  viewClear: boolean | null; canopyFade: number | null; terrainLift: number | null;
  visible: boolean | null; onScreen: boolean | null; avatarOpacity: number | null;
  drawCalls: number | null; clip: string | null;
  file: string;
};

/** The four locomotion keys + world→screen steering basis (mirrors ground-snap.spec.ts's
 *  proven ven-traverse): converts a world (dx,dz) heading into the camera-relative Arrow axes so
 *  the burst can STEER toward a world target (a chosen tree) instead of holding one blind heading. */
const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const;
function screenDir(dx: number, dz: number, yaw: number): { sx: number; sYf: number } {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return { sx: dx * c - dz * s, sYf: -dx * s - dz * c };
}

/** Robust click for the title/avatar buttons (mirrors ground-snap.spec.ts / the capture
 *  harness `press`): a real click, then a faithful DOM `click` dispatch if the live render
 *  defeats the actionability gate. */
async function clickish(page: Page, locator: ReturnType<Page['locator']>): Promise<void> {
  try { await locator.click({ timeout: 4_000 }); return; }
  catch { if (await locator.isVisible().catch(() => false)) await locator.dispatchEvent('click'); }
}

/** Boot from a clean first-run save into the live world with the rig up + the follow camera
 *  settled (mirrors ground-snap.spec.ts `bootToWorld`). Reduced-motion OFF (the default) so
 *  the follow boom eases normally — the occluder fade must hold on the moving free-walk cam. */
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
  // the real rig swaps in async over the stand-in — avatar.height reads once it lands
  await page.waitForFunction(() => {
    const r = (window as unknown as { __ranger?: { avatar?: () => { height: number } | null } }).__ranger;
    return !!(r && r.avatar && (r.avatar()?.height ?? 0) > 0.5);
  }, undefined, { timeout: 25_000 }).catch(() => { /* zero-asset env still asserts viewClear */ });
  await page.waitForTimeout(1500); // seat the idle pose + settle the follow camera + stream the GLB trees in
}

test('D1.5 view-clear drive-burst — the ranger is never lost in a foliage void', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'ipad', 'laptop-only automated verification (keyboard drive)');
  test.setTimeout(300_000); // the first cold boot streams ~13 MB of GLBs (~3 min, config note)
  const platform = testInfo.project.name;
  const shotDir = path.join(EVID, platform, 'd15-viewclear-burst');
  fs.mkdirSync(shotDir, { recursive: true });
  // D1.4: clear prior-run PNGs from this incremental-named burst subdir so the fresh set on
  // disk EQUALS this run (the top-level capture prune skips subdirs).
  for (const f of fs.readdirSync(shotDir)) {
    if (f.endsWith('.png')) { try { fs.rmSync(path.join(shotDir, f)); } catch { /* a rm miss is not fatal */ } }
  }
  // D1.6: WIPE the burst JSON up front too, so a failed leg leaves NO json (honest gap)
  // rather than last run's stale one beside fresh PNGs; a passing run rewrites it fresh.
  try { fs.rmSync(path.join(EVID, `viewclear-burst-${platform}.json`)); } catch { /* absent on a first run — fine */ }

  await bootToWorld(page);

  // Pick a real SCATTER pine to walk PAST — a mostly-LATERAL one (large |x|, small |z|), the
  // ground-snap ven-traverse steering handles that heading most reliably — at a moderate radius so
  // it is well inside the rim (~76 m). Steering a few m PAST it puts it in the gap between the
  // ranger and the trailing follow camera → the genuine `09-walk-4` occlusion. `treeSpots()` is
  // the scatter+rim placement list; null/empty in a zero-asset env (then the occlusion legs skip).
  const spots = await page.evaluate(() => (window as unknown as {
    __ranger?: { treeSpots(): { x: number; z: number; s: number }[] | null };
  }).__ranger?.treeSpots() ?? null);
  // D3.16: `viewClear` now reports EVERY rendered occluder class on the cam→ranger
  // sightline (props, the parked jeep/heli, the scenic actors + ambient animals, marker
  // models) — not only crowns + terrain. So this FOLIAGE spec must reach its scatter pine
  // WITHOUT an unrelated point-occluder standing between the trailing lens and the ranger,
  // or an incidental warden/marker would flip viewClear false (nothing to do with foliage).
  // Read the live point-occluders and keep only targets whose straight spawn→(2.5 m past)
  // path clears every one by ≥ CLR — so the burst tests the crown fade in isolation.
  const occluders = await page.evaluate(() => {
    const r = (window as unknown as { __ranger?: {
      markers?: () => { x: number; z: number }[] | null;
      ambient?: () => { x: number; z: number; h: number }[] | null;
    } }).__ranger;
    const pts: { x: number; z: number }[] = [
      { x: 6.4, z: 4.4 }, { x: -11.5, z: 8.5 }, // W3.3 scenic actors (warden by the board, distant figure)
    ];
    for (const m of r?.markers?.() ?? []) pts.push({ x: m.x, z: m.z });     // mission-marker models
    for (const a of r?.ambient?.() ?? []) if (a.h < 6) pts.push({ x: a.x, z: a.z }); // ground roamers (birds glide high)
    return pts;
  });
  const CLR = 3.5; // an occluder must sit at least this far off the swept sightline
  const pathClear = (tx: number, tz: number): boolean => {
    const tr = Math.hypot(tx, tz) || 1;
    const ex = tx * (tr + 2.5) / tr, ez = tz * (tr + 2.5) / tr; // stop point (2.5 m past the pine)
    const len2 = ex * ex + ez * ez;
    for (const o of occluders) {
      let t = len2 > 1e-6 ? (o.x * ex + o.z * ez) / len2 : 0; // project onto origin→stop
      t = Math.max(-0.3, Math.min(1, t));                     // a little back (the trailing boom) → the stop
      const gx = o.x - ex * t, gz = o.z - ez * t;
      if (gx * gx + gz * gz < CLR * CLR) return false;
    }
    return true;
  };
  const target = (spots ?? [])
    .filter((t) => { const r = Math.hypot(t.x, t.z); return r > 22 && r < 42 && Math.abs(t.x) > 1.6 * Math.abs(t.z) && pathClear(t.x, t.z); })
    .sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0] ?? null;
  const targetR = target ? Math.hypot(target.x, target.z) : 0;
  // aim = 2.5 m beyond the tree along the outward (origin→tree) ray. Stopping there leaves the tree
  // ~2.5 m behind the ranger — inside the ~4.6 m follow-boom gap → between the lens and him.
  const aim = target
    ? (() => { const k = (targetR + 2.5) / (targetR || 1); return { x: target.x * k, z: target.z * k }; })()
    : { x: 30, z: -6 }; // fallback: a lateral walk into the tree band

  const samples: Sample[] = [];
  let idx = 0;
  // Sample the cam clear-line EVERY step (the drive-assert court); shoot a screenshot on a few
  // steps (each waits for fonts → slow) for the visual audit.
  const grab = async (shoot: boolean): Promise<Sample> => {
    const i = idx++;
    const s = await page.evaluate(() => {
      const r = (window as unknown as { __ranger?: {
        pos(): { x: number; z: number } | null; cameraYaw(): number | null;
        cam(): { viewClear: boolean; canopyFade: number; terrainLift: number; avatarOpacity: number; avatarScreen: { visible: boolean; onScreen: boolean } } | null;
        drawCalls(): number | null; clip(): { name: string } | null;
      } }).__ranger;
      if (!r) return null;
      const c = r.cam();
      return {
        pos: r.pos(), yaw: r.cameraYaw(),
        viewClear: c ? c.viewClear : null,
        canopyFade: c ? c.canopyFade : null,
        terrainLift: c ? c.terrainLift : null,
        visible: c ? c.avatarScreen.visible : null,
        onScreen: c ? c.avatarScreen.onScreen : null,
        avatarOpacity: c ? c.avatarOpacity : null,
        drawCalls: r.drawCalls(),
        clip: r.clip() ? r.clip()!.name : null,
      };
    });
    let file = '';
    if (shoot) {
      file = `d15-viewclear-${String(i).padStart(2, '0')}.png`;
      await page.screenshot({ path: path.join(shotDir, file) });
      file = `${platform}/d15-viewclear-burst/${file}`;
    }
    const sample: Sample = {
      i, file,
      pos: s?.pos ?? null, yaw: s?.yaw ?? null,
      viewClear: s?.viewClear ?? null, canopyFade: s?.canopyFade ?? null, terrainLift: s?.terrainLift ?? null,
      visible: s?.visible ?? null, onScreen: s?.onScreen ?? null, avatarOpacity: s?.avatarOpacity ?? null,
      drawCalls: s?.drawCalls ?? null, clip: s?.clip ?? null,
    };
    samples.push(sample);
    return sample;
  };

  let last = await grab(true); // frame 0 — at the open spawn clearing (no trees → viewClear true, canopy solid)
  // ── the burst: STEER out toward (and a few m past) the chosen scatter pine, holding the keys
  //    CONTINUOUSLY (the game needs a sustained hold to reach walk speed — discrete taps stall on
  //    the start ramp). Sample the clear-line every ~180 ms; take a screenshot every 6th step by
  //    briefly RELEASING the keys, shooting while stopped, then re-holding — so no tree-pass is
  //    skipped during a slow font-waiting shot. As the ranger clears the pine it drops into the
  //    camera→ranger gap and the occluder fade fires (canopyFade → see-through) while viewClear
  //    stays true — he reads THROUGH it. The gentle 0.7 s release keeps the dip sampleable. ──
  const held = new Set<string>();
  const sync = async (want: Set<string>): Promise<void> => {
    for (const k of KEYS) {
      if (want.has(k) && !held.has(k)) { await page.keyboard.down(k); held.add(k); }
      else if (!want.has(k) && held.has(k)) { await page.keyboard.up(k); held.delete(k); }
    }
  };
  try {
    for (let step = 1; step <= 60; step++) {
      const p = last.pos, yaw = last.yaw;
      if (p && yaw != null) {
        const dist = Math.hypot(p.x - aim.x, p.z - aim.z);
        const rangerR = Math.hypot(p.x, p.z);
        if (dist < 1.3 || (target && rangerR > targetR + 4.5)) break; // reached / passed the tree
        const { sx, sYf } = screenDir(aim.x - p.x, aim.z - p.z, yaw);
        const want = new Set<string>();
        if (sx > 0.4) want.add('ArrowRight'); else if (sx < -0.4) want.add('ArrowLeft');
        if (sYf > 0.4) want.add('ArrowUp'); else if (sYf < -0.4) want.add('ArrowDown');
        await sync(want);
      }
      await page.waitForTimeout(180);
      const shoot = step % 6 === 0;
      if (shoot) await sync(new Set()); // stop before the slow screenshot so no pass is skipped
      last = await grab(shoot);
    }
  } finally { await sync(new Set()).catch(() => {}); }
  // settle at the aim point (tree ~2.5 m behind him, in the gap) and take a clean occluded frame:
  // the tree faded, the ranger solid + readable through it.
  await page.waitForTimeout(700);
  await grab(true);

  const minFade = Math.min(...samples.map((s) => s.canopyFade ?? 1));
  const occludedFrames = samples.filter((s) => (s.canopyFade ?? 1) < 1).length;
  // D1.5 (audit #4) terrain evidence: the most the follow boom rode UP to clear a dune between
  // the lens and the ranger over the burst (the terrain analog of `occludedFrames`/`minFade` — a
  // burst that never lifted met no dune, so viewClear staying true there is a flat-ground no-op).
  const maxTerrainLift = Math.max(0, ...samples.map((s) => s.terrainLift ?? 0));
  const start = samples[0]?.pos;
  const walked = start ? Math.max(...samples.map((s) => (s.pos ? Math.hypot(s.pos.x - start.x, s.pos.z - start.z) : 0))) : 0;

  // write the burst annotations so the phase audit reads the clear-line frame by frame
  fs.writeFileSync(
    path.join(EVID, `viewclear-burst-${platform}.json`),
    JSON.stringify({ box: 'D1.5', platform, spec: 'view-clear.spec.ts', target, aim, minFade, occludedFrames, maxTerrainLift, walked, samples }, null, 2),
  );

  // ── assertions across the WHOLE burst (drive-assert, not one frame) ──
  for (const s of samples) {
    const at = `frame ${s.i} @ ${JSON.stringify(s.pos)} (canopyFade ${s.canopyFade}, avatarOpacity ${s.avatarOpacity})`;
    // PRIMARY: the ranger is READABLE from the lens on every frame — no un-faded crown swallows him.
    expect(s.viewClear, `${at} viewClear (ranger readable, no full-frame foliage void)`).toBe(true);
    // anti-lie: a SOLID, on-screen ranger must read as clear. (visible ALSO drops legitimately when
    // the boom collapses close and the ranger himself fades — the F-05 rail — so we gate on solid.)
    if (s.onScreen && (s.avatarOpacity ?? 0) > 0.5) {
      expect(s.visible, `${at} a solid on-screen ranger reads clear (the hook no longer lies over foliage)`).toBe(true);
    }
    expect(s.drawCalls ?? 0, `${at} drawCalls < 150 (budget holds — the fade re-uses the same meshes)`).toBeLessThan(150);
  }
  // the burst genuinely WALKED out into the tree band (not a trivial no-op on the open clearing) …
  expect(walked, `walked ≥ 15 m out from spawn (reached the scatter tree band)`).toBeGreaterThan(15);
  // … AND, where a target tree was found, genuinely met a crown BETWEEN lens and ranger (the fade
  // fired), so a still-clear viewClear above is real evidence the occluder-fade WORKS, not a walk
  // that never hit one.
  if (target) {
    expect(occludedFrames, `≥1 frame met a crown between lens and ranger (canopyFade < 1 ⇒ the occluder fade fired)`).toBeGreaterThanOrEqual(1);
    expect(minFade, `the fade dipped to see-through (canopyFade ≤ 0.5) on the worst occluded frame`).toBeLessThanOrEqual(0.5);
  }
});
