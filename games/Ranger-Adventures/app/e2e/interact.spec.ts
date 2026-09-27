import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors } from './helpers';

/**
 * Interact key E2E (WORLD-PLAN W1.4). The laptop twin of tapping the "Speel mee"
 * prompt: the ranger walks up to a mission marker (proximity), then a Space press
 * opens the mission briefing. This proves the keyboard-only path Floris needs —
 * no canvas pointer event is used to trigger the action.
 *
 * Navigation uses the real arrow keys (tank steering); the E2E reads the marker
 * positions + live proximity from the dev hook and steers toward the nearest marker
 * until `nearId()` reports the ranger has arrived.
 */

interface Hook {
  screen: string;
  pos(): { x: number; z: number } | null;
  cam(): { x: number; z: number } | null;
  nearId(): string | null;
  markers(): { x: number; z: number; missionId: string }[] | null;
}
function hook<T>(page: Page, fn: (r: Hook) => T): Promise<T | null> {
  return page.evaluate((body) => {
    const r = (window as unknown as { __ranger?: unknown }).__ranger;
    // eslint-disable-next-line no-new-func
    return r ? (new Function('r', `return (${body})(r)`))(r) : null;
  }, fn.toString()) as Promise<T | null>;
}

/** Drive title → avatar → world (W2.1: world is the front door); return once screen === 'world'. */
async function enterWorld(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByRole('button', { name: 'Dit is mijn ranger' }).click();
  await expect.poll(() => hook(page, (r) => r.screen), { timeout: 30_000 }).toBe('world');
}

const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const;

/**
 * Steer the ranger to the nearest marker with arrow keys until proximity fires, the
 * way a child plays the tank keys (wave 2): Left/Right turn him until the marker is
 * ahead on screen (the camera looks from behind him), then Up walks. "Ahead" is the
 * camera→ranger direction on the ground, re-read every tick.
 */
async function walkToNearestMarker(page: Page): Promise<string> {
  const markers = await hook(page, (r) => r.markers());
  expect(markers, 'markers() available in world').not.toBeNull();
  expect(markers!.length, 'at least one mission marker exists').toBeGreaterThan(0);

  const start = await hook(page, (r) => r.pos());
  expect(start).not.toBeNull();
  const target = markers!
    .slice()
    .sort(
      (a, b) =>
        Math.hypot(a.x - start!.x, a.z - start!.z) - Math.hypot(b.x - start!.x, b.z - start!.z),
    )[0];

  const down = new Set<string>();
  const sync = async (want: Set<string>): Promise<void> => {
    for (const k of KEYS) {
      if (want.has(k) && !down.has(k)) { await page.keyboard.down(k); down.add(k); }
      else if (!want.has(k) && down.has(k)) { await page.keyboard.up(k); down.delete(k); }
    }
  };
  const releaseAll = async (): Promise<void> => { await sync(new Set()); };

  try {
    for (let i = 0; i < 200; i++) {
      const near = await hook(page, (r) => r.nearId());
      if (near) return near;
      const p = await hook(page, (r) => r.pos());
      const cam = await hook(page, (r) => r.cam());
      if (!p || !cam) { await page.waitForTimeout(100); continue; }
      const dx = target.x - p.x, dz = target.z - p.z;
      const d = Math.hypot(dx, dz) || 1;
      let fx = p.x - cam.x, fz = p.z - cam.z;
      const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
      // the marker's angle off the screen's forward (+ = to the right)
      const ang = (Math.atan2((dx * -fz + dz * fx) / d, (dx * fx + dz * fz) / d) * 180) / Math.PI;
      const want = new Set<string>();
      if (Math.abs(ang) < 20) want.add('ArrowUp');
      else if (Math.abs(ang) < 70) { want.add('ArrowUp'); want.add(ang > 0 ? 'ArrowRight' : 'ArrowLeft'); }
      else want.add(ang > 0 ? 'ArrowRight' : 'ArrowLeft');
      await sync(want);
      await page.waitForTimeout(120);
    }
    throw new Error('ranger never reached a marker within the step budget');
  } finally {
    await releaseAll();
  }
}

test('interact: Space at a marker opens the mission briefing', async ({ page }, testInfo) => {
  // A real-time walk to a marker (up to ~24 s of stepping) on SwiftShader, which
  // is ~10× slower and, run locally alongside the other specs, contends for the
  // GPU. The default 30 s is too tight under that parallel load; give headroom
  // (CI runs workers:1, so this only bites the local full-suite run).
  test.setTimeout(90_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await enterWorld(page);

  // 1) walk up to a marker — proximity surfaces the "Speel mee" affordance.
  const missionId = await walkToNearestMarker(page);
  expect(missionId, 'ranger is standing at a marker').toBeTruthy();
  const playBtn = page.locator('.explore-play');
  await expect(playBtn, 'the Speel mee prompt is on screen at a marker').toBeVisible();
  await shot(page, 'interact-at-marker');

  // 2) press Space (keyboard only) → the briefing card opens. From the world it
  // reads as a veldnotitie whose start button is "Ga op pad".
  await page.keyboard.press('Space');

  const startBtn = page.getByRole('button', { name: 'Ga op pad' });
  await expect(startBtn, 'Space opens the mission briefing').toBeVisible({ timeout: 10_000 });
  // the briefing card replaced the explore HUD, so the play prompt is gone.
  await expect(playBtn, 'briefing replaces the explore prompt').toHaveCount(0);
  await shot(page, 'interact-briefing-open');

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
