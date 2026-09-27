import { test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';

/**
 * Shared E2E helpers for the browser-proof suite (WORLD-PLAN §3.1).
 */

/** Directory for curated artifact screenshots (gitignored, W0.1). */
export const SHOTS_DIR = 'e2e/__shots__';

/**
 * Save a named artifact screenshot for human review. Screenshots are proof for
 * a person, never an assertion target (SwiftShader pixels are not stable).
 * No-op on webkit (W0.8): the iPad-Safari pass exists for engine coverage, not
 * curated shots — chromium already captures the same steps.
 */
export async function shot(page: Page, name: string): Promise<void> {
  if (test.info().project.name === 'webkit') return;
  await page.screenshot({ path: `${SHOTS_DIR}/${name}.png` });
}

/**
 * Collect page errors (uncaught exceptions). The boot smoke asserts this stays
 * empty — a silent throw during boot is exactly the class of failure run 1
 * never caught.
 */
export function collectPageErrors(page: Page, sink: string[]): void {
  page.on('pageerror', (err) => sink.push(String(err)));
}

/**
 * Attach the collected page errors to the test report so a failure is
 * self-explaining.
 */
export async function reportPageErrors(testInfo: TestInfo, errors: string[]): Promise<void> {
  if (errors.length) {
    await testInfo.attach('pageerrors', { body: errors.join('\n'), contentType: 'text/plain' });
  }
}

/**
 * The arrow keys a child holds to walk to a goal (wave 2). With the follow camera on
 * they are tank keys: Left / Right turn the ranger (the camera stays behind him) until
 * the goal is ahead on screen, and Up walks once it is within 70° of ahead. Under
 * reduced motion the camera stands still and the keys walk the way the screen shows
 * (Right = to the right of the screen). Call the result every tick with the goal's
 * offset from the ranger (dx, dz) and `cameraYaw()` (the screen's forward on the ground
 * is (−sin ψ, −cos ψ)). When the goal has come no closer for 2 s (pressed against a
 * wall; the cabin stands on the line from spawn to the frisling) he goes round it like
 * a child would: turn away and walk on for a moment, always to the same side (the
 * other side after three tries that got nowhere).
 */
export async function keySteer(page: Page): Promise<(dx: number, dz: number, yaw: number) => Set<string>> {
  const screen = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  let best = Infinity, bestAt = Date.now(), tries = 0, side = 1, turnUntil = 0, walkUntil = 0;
  return (dx, dz, yaw) => {
    const now = Date.now();
    const d = Math.hypot(dx, dz) || 1;
    if (d < best - 0.3) { best = d; bestAt = now; tries = 0; }
    const sideKey = side > 0 ? 'ArrowRight' : 'ArrowLeft';
    if (now < turnUntil) return new Set(screen ? [sideKey] : [sideKey, 'ArrowUp']);
    if (now < walkUntil) return new Set(screen ? [sideKey] : ['ArrowUp']);
    if (now - bestAt > 2_000) {
      if (++tries > 3) { side = -side; tries = 1; }
      turnUntil = now + 700; walkUntil = turnUntil + 900; bestAt = walkUntil;
      return new Set(screen ? [side > 0 ? 'ArrowRight' : 'ArrowLeft'] : [side > 0 ? 'ArrowRight' : 'ArrowLeft', 'ArrowUp']);
    }
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const right = (dx * -fz + dz * fx) / d, ahead = (dx * fx + dz * fz) / d; // the goal on screen
    const want = new Set<string>();
    if (screen) {
      if (right > 0.3) want.add('ArrowRight'); else if (right < -0.3) want.add('ArrowLeft');
      if (ahead > 0.3) want.add('ArrowUp'); else if (ahead < -0.3) want.add('ArrowDown');
      return want;
    }
    const ang = (Math.atan2(right, ahead) * 180) / Math.PI; // + = to the right
    if (Math.abs(ang) < 20) want.add('ArrowUp');
    else if (Math.abs(ang) < 70) { want.add('ArrowUp'); want.add(ang > 0 ? 'ArrowRight' : 'ArrowLeft'); }
    else want.add(ang > 0 ? 'ArrowRight' : 'ArrowLeft');
    return want;
  };
}
