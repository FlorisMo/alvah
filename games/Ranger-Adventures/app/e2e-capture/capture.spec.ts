import { test, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * RUN-3 AUDIT capture flow (WORLD-PLAN §3.1 lesson; FINDINGS.md "agreed shape").
 *
 * ONE test per project (laptop | ipad) walks the REAL player flow and drops a
 * screenshot + a state annotation at every screen/state the audit needs to see:
 *   title · avatar · world-entry · WALK BURST (≥3 frames, gliding evidence) ·
 *   controls HUD · (laptop) trackpad-zoom + orbit ATTEMPTS · mission board ·
 *   a 3D mission · pause hub · jeep near/in/drive burst · reduce-motion world.
 *
 * It asserts almost nothing — a failed capture is itself an audit finding, so
 * every scene is wrapped: on error it records a GAP and the flow continues.
 * Annotations are written to disk after EVERY shot, so even a mid-flow timeout
 * still leaves a usable partial contact sheet. Several verdicts are DATA-backed,
 * not just eyeballed:
 *   - gliding: per-burst-frame `pos` moved while `clip` stayed null / frozen.
 *   - no laptop camera: `cameraYaw` unchanged after a wheel-zoom / drag-orbit.
 *
 * Engine caveat (honesty contract): the `ipad` project is the iPad VIEWPORT +
 * TOUCH on the Chromium engine, not Safari (local WebKit bus-errors, §10). Every
 * iPad shot carries that caveat; true Safari look = a Floris on-device check.
 */

// cwd is app/. Evidence lands beside the run-3 docs; raw PNGs are gitignored,
// annotations.json is small + tracked so the audit is reproducible.
const EVID = path.resolve(process.cwd(), '../runs/run-3-ux-polish/audit-evidence');

type Annotation = {
  name: string; platform: string; group: string; note: string; ok: boolean;
  screen: string | null; pos: { x: number; z: number } | null; cameraYaw: number | null;
  drawCalls: number | null; missionView: string | null; clip: { name: string; time: number } | null;
  // vehicle heading/speed when driving — the DATA signal for the #3 steering
  // finding (heading unchanged across the drive burst while a turn key is held
  // → dead steering). null when not in a vehicle.
  veh: { heading: number; speed: number; inVehicle: boolean } | null;
  file: string;
};

interface Hook {
  screen: string; missionView: '2d' | '3d' | null; version: string;
  pos(): { x: number; z: number } | null; cameraYaw(): number | null; drawCalls(): number | null;
  clip(): { name: string; time: number } | null;
  board(): { x: number; z: number; near: boolean } | null;
  vehicle(): { placed: boolean; near: boolean; inVehicle: boolean; x: number; z: number; heading: number; speed: number } | null;
}
function hook<T>(page: Page, fn: (r: Hook) => T): Promise<T | null> {
  return page.evaluate((body) => {
    const r = (window as unknown as { __ranger?: unknown }).__ranger;
    // eslint-disable-next-line no-new-func
    return r ? (new Function('r', `return (${body})(r)`))(r) : null;
  }, fn.toString()) as Promise<T | null>;
}

test('audit capture flow', async ({ page }, testInfo) => {
  const platform = testInfo.project.name; // 'laptop' | 'ipad'
  const dir = path.join(EVID, platform);
  fs.mkdirSync(dir, { recursive: true });
  const shots: Annotation[] = [];
  let n = 0;
  let version: string | null = null;

  const flush = () =>
    fs.writeFileSync(
      path.join(EVID, `annotations-${platform}.json`),
      JSON.stringify({ platform, version, shots }, null, 2),
    );

  /** Screenshot the viewport + record the live hook state; persist immediately. */
  async function snap(name: string, group: string, note: string): Promise<void> {
    n += 1;
    const file = `${String(n).padStart(2, '0')}-${name}.png`;
    const a: Annotation = {
      name, platform, group, note, ok: true, file: `${platform}/${file}`,
      screen: null, pos: null, cameraYaw: null, drawCalls: null, missionView: null, clip: null, veh: null,
    };
    try {
      const s = await hook(page, (r) => {
        const v = r.vehicle();
        return {
          screen: r.screen, missionView: r.missionView, pos: r.pos(),
          cameraYaw: r.cameraYaw(), drawCalls: r.drawCalls(), clip: r.clip(), version: r.version,
          veh: v && v.inVehicle ? { heading: v.heading, speed: v.speed, inVehicle: v.inVehicle } : null,
        };
      });
      if (s) { Object.assign(a, s); version = s.version; }
      await page.screenshot({ path: path.join(dir, file) });
    } catch (e) { a.ok = false; a.note = `${note}  [CAPTURE FAILED: ${String(e).slice(0, 140)}]`; }
    shots.push(a);
    flush();
  }
  /** Run one scene; a thrown scene records a GAP and never kills the flow. */
  async function scene(label: string, fn: () => Promise<void>): Promise<void> {
    try { await fn(); }
    catch (e) {
      shots.push({
        name: label, platform, group: 'GAP', ok: false, file: '',
        note: `Scene "${label}" kon niet worden vastgelegd: ${String(e).slice(0, 200)} — dit is zelf een audit-bevinding.`,
        screen: null, pos: null, cameraYaw: null, drawCalls: null, missionView: null, clip: null, veh: null,
      });
      flush();
    }
  }

  // ══ BOOT 1 (normal motion): title → avatar → world → walk → controls →
  //    (laptop camera) → board → 3D mission (mission is terminal, ends boot 1) ══
  await scene('title', async () => {
    await page.goto('/');
    await page.locator('.boot-title').waitFor({ timeout: 30_000 });
    await snap('title', 'Boot', 'Titelscherm "Word boswachter" — eerste indruk.');
  });
  await scene('avatar', async () => {
    await page.getByRole('button', { name: 'Begin' }).click();
    await page.getByRole('button', { name: 'Dit is mijn ranger' }).waitFor({ timeout: 30_000 });
    await snap('avatar', 'Boot', 'Avatar-maker — de ranger die je speelt.');
  });
  await scene('world-entry', async () => {
    await page.getByRole('button', { name: 'Dit is mijn ranger' }).click();
    await waitForWorld(page);
    await settle(page, 1500);
    await snap('world-entry', 'Wereld', 'Eerste frame in de wereld — camera-kader + avatarschaal (punch-list #1).');
  });
  // WALK BURST — gliding evidence: hold ArrowUp, snap 5 frames ~250 ms apart.
  await scene('walk-burst', async () => {
    await page.keyboard.down('ArrowUp');
    try {
      for (let i = 1; i <= 5; i++) {
        await page.waitForTimeout(250);
        await snap(`walk-${i}`, 'Lopen (burst)', `Loopframe ${i}/5 — benen + pos/clip tussen frames (glijdt vs loopt, #2).`);
      }
    } finally { await page.keyboard.up('ArrowUp'); }
  });
  await scene('controls-hud', async () => {
    await settle(page, 400);
    await snap('controls-hud', 'Besturing', platform === 'ipad'
      ? 'iPad-kader: staat de joystick er, ≥56 px, tap-to-walk zichtbaar?'
      : 'Laptop-kader: joystick hoort weg te zijn (fijne pointer) — welke besturing zie je?');
  });
  if (platform === 'laptop') {
    await scene('camera-attempts', async () => {
      const box = await page.locator('canvas#scene').boundingBox();
      if (!box) throw new Error('no canvas');
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      await page.mouse.move(cx, cy);
      await page.mouse.wheel(0, -800); await settle(page, 400);
      await snap('camera-zoom-in', 'Laptop-camera', 'Trackpad/scroll "inzoomen" geprobeerd — komt het beeld dichterbij? (feature afwezig, #4)');
      await page.mouse.wheel(0, 1400); await settle(page, 400);
      await snap('camera-zoom-out', 'Laptop-camera', 'Trackpad/scroll "uitzoomen" geprobeerd — verandert de afstand?');
      await page.mouse.move(cx, cy); await page.mouse.down();
      for (let i = 1; i <= 12; i++) { await page.mouse.move(cx + i * 18, cy); await page.waitForTimeout(20); }
      await page.mouse.up(); await settle(page, 400);
      await snap('camera-orbit', 'Laptop-camera', 'Slepen om te draaien (orbit) — draait het beeld? cameraYaw in de annotatie zegt het (#4).');
    });
  }
  // pause hub — opened over the LIVE world (no re-boot), then closed back to the
  // explore HUD so the following scenes keep foot controls.
  await scene('pause-hub', async () => {
    await page.locator('.explore-pause').click();
    await settle(page, 400);
    await snap('pause-hub', 'Pauze/menu', 'Pauze-menu — is er een duidelijke "terug/hoofdmenu"? (punch-list #5)');
    await page.locator('.ph-back').click(); // "Terug naar de open plek" → explore HUD
    await page.locator('.explore-hud').waitFor({ timeout: 10_000 });
  });

  // jeep — walk to it, climb in, drive burst (steering test #3), climb back out.
  await scene('jeep', async () => {
    const placed = await hook(page, (r) => r.vehicle()?.placed ?? false);
    if (!placed) throw new Error('vehicle not placed in world');
    await walkToJeep(page);
    await snap('jeep-near', 'Jeep', 'Bij de jeep — model + "Stap in"-affordance.');
    await page.keyboard.press('Space'); // "Stap in"
    await waitFor(page, (r) => r.vehicle()?.inVehicle ?? false, 15_000);
    await settle(page, 700);
    await snap('jeep-in', 'Jeep', 'In de jeep — camerakader, blur/DOF, is het model helder? (#3)');
    try {
      await page.keyboard.down('ArrowUp');
      await page.keyboard.down('ArrowLeft'); // STEER — #3 says heading stays fixed
      try {
        for (let i = 1; i <= 4; i++) {
          await page.waitForTimeout(350);
          await snap(`jeep-drive-${i}`, 'Jeep (burst)', `Rijframe ${i}/4 met stuur-input — verandert de heading? (stuur-bug #3)`);
        }
      } finally { await page.keyboard.up('ArrowUp'); await page.keyboard.up('ArrowLeft'); }
    } finally {
      // always climb back out so the board walk below uses foot controls.
      if (await hook(page, (r) => r.vehicle()?.inVehicle ?? false)) {
        await page.keyboard.press('Space');
        await waitFor(page, (r) => !(r.vehicle()?.inVehicle ?? false), 10_000).catch(() => {});
      }
    }
  });

  // mission board → start a 3D mission in-place (TERMINAL — enters an activity,
  // so it ends boot 1).
  await scene('mission-board', async () => {
    await walkToBoard(page);
    await settle(page, 300);
    await snap('board-affordance', 'Missiebord', 'Bij het bord — is de "open"-affordance leesbaar/groot genoeg?');
    await page.locator('.explore-board-open').click();
    await page.locator('.mission-board').waitFor({ timeout: 10_000 });
    await snap('board-open', 'Missiebord', 'Missiebord open — layout, leesbaarheid, tap-doelen.');
  });
  await scene('mission-3d', async () => {
    await page.locator('.mission-card').first().click();
    await page.getByRole('button', { name: 'Ga op pad' }).click();
    await waitFor(page, (r) => r.missionView === '3d', 25_000);
    await settle(page, 1000);
    await snap('mission-3d', 'Missie', 'Missie speelt 3D in-place — hoe ziet een echte opdracht eruit?');
  });

  // ══ BOOT 2: reduce-motion world (set before entering) ══
  await scene('reduce-motion', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await boot(page);
    await settle(page, 1200);
    await snap('reduce-motion-world', 'Reduce-Motion', 'Verminder-beweging AAN — ziet de wereld er nog goed uit of plat/kapot?');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  });

  flush();
  attachSummary(testInfo, shots);
});

// ── helpers ──────────────────────────────────────────────────────────────────
function attachSummary(testInfo: TestInfo, shots: Annotation[]): void {
  const gaps = shots.filter((s) => !s.ok).length;
  testInfo.annotations.push({ type: 'capture', description: `${shots.length} shots, ${gaps} gaps` });
}
async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByRole('button', { name: 'Dit is mijn ranger' }).click();
  await waitForWorld(page);
}
async function waitForWorld(page: Page): Promise<void> {
  await waitFor(page, (r) => r.screen === 'world', 40_000);
}
async function waitFor(page: Page, pred: (r: Hook) => boolean, timeout: number): Promise<void> {
  const start = Date.now();
  for (;;) {
    if (await hook(page, pred)) return;
    if (Date.now() - start > timeout) throw new Error(`waitFor timed out after ${timeout} ms`);
    await page.waitForTimeout(250);
  }
}
async function settle(page: Page, ms: number): Promise<void> { await page.waitForTimeout(ms); }

const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const;
/** Camera-relative arrow walk toward a world target (board.spec / interact.spec idiom). */
async function walkTo(
  page: Page,
  target: () => Promise<{ x: number; z: number; near: boolean } | null>,
  budget = 200,
): Promise<void> {
  const down = new Set<string>();
  const sync = async (want: Set<string>) => {
    for (const k of KEYS) {
      if (want.has(k) && !down.has(k)) { await page.keyboard.down(k); down.add(k); }
      else if (!want.has(k) && down.has(k)) { await page.keyboard.up(k); down.delete(k); }
    }
  };
  try {
    for (let i = 0; i < budget; i++) {
      const t = await target();
      if (t?.near) return;
      const p = await hook(page, (r) => r.pos());
      const yaw = await hook(page, (r) => r.cameraYaw());
      if (!p || !t || yaw == null) { await page.waitForTimeout(100); continue; }
      const dx = t.x - p.x, dz = t.z - p.z;
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const sx = dx * cy - dz * sy;
      const sYf = -dx * sy - dz * cy;
      const want = new Set<string>();
      if (sx > 0.4) want.add('ArrowRight'); else if (sx < -0.4) want.add('ArrowLeft');
      if (sYf > 0.4) want.add('ArrowUp'); else if (sYf < -0.4) want.add('ArrowDown');
      await sync(want);
      await page.waitForTimeout(120);
    }
    throw new Error('never reached target within step budget');
  } finally { await sync(new Set()); }
}
async function walkToBoard(page: Page): Promise<void> {
  await walkTo(page, () => hook(page, (r) => r.board()));
}
async function walkToJeep(page: Page): Promise<void> {
  await walkTo(page, () => hook(page, (r) => {
    const v = r.vehicle();
    return v ? { x: v.x, z: v.z, near: v.near } : null;
  }));
}
