import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors } from './helpers';

/**
 * Cabin-hub / mission-board E2E (WORLD-PLAN W2.2). The spawn case-board is the
 * mission hub: the ranger walks up to it, opens the mission board WITHOUT the
 * world being torn down (`leaveWorld` is never called — `screen` stays 'world'),
 * and starting a mission from the board plays it in-place (`missionView === '3d'`).
 * Closing the board returns to the world in-place.
 *
 * Steering reuses the camera-relative arrow-key walk from interact.spec: the
 * follow-cam rotates, so each tick we map the desired WORLD direction back into
 * screen keys with the inverse of `resolveInput`'s rotation.
 */

interface Hook {
  screen: string;
  missionView: '2d' | '3d' | null;
  pos(): { x: number; z: number } | null;
  cameraYaw(): number | null;
  board(): { x: number; z: number; near: boolean } | null;
}
function hook<T>(page: Page, fn: (r: Hook) => T): Promise<T | null> {
  return page.evaluate((body) => {
    const r = (window as unknown as { __ranger?: unknown }).__ranger;
    // eslint-disable-next-line no-new-func
    return r ? (new Function('r', `return (${body})(r)`))(r) : null;
  }, fn.toString()) as Promise<T | null>;
}

/** Drive title → avatar → world (W2.1: world is the front door). */
async function enterWorld(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByRole('button', { name: 'Dit is mijn ranger' }).click();
  await expect.poll(() => hook(page, (r) => r.screen), { timeout: 30_000 }).toBe('world');
}

const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const;

/** Walk to the spawn case-board with arrow keys until its proximity fires. Same
 *  camera-relative mapping as interact.spec's marker walk (see that file's note). */
async function walkToBoard(page: Page): Promise<void> {
  const board = await hook(page, (r) => r.board());
  expect(board, 'board() available in world').not.toBeNull();

  const down = new Set<string>();
  const sync = async (want: Set<string>): Promise<void> => {
    for (const k of KEYS) {
      if (want.has(k) && !down.has(k)) { await page.keyboard.down(k); down.add(k); }
      else if (!want.has(k) && down.has(k)) { await page.keyboard.up(k); down.delete(k); }
    }
  };
  try {
    for (let i = 0; i < 200; i++) {
      const b = await hook(page, (r) => r.board());
      if (b?.near) return;
      const p = await hook(page, (r) => r.pos());
      const yaw = await hook(page, (r) => r.cameraYaw());
      if (!p || !b || yaw == null) { await page.waitForTimeout(100); continue; }
      const dx = b.x - p.x, dz = b.z - p.z;
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const sx = dx * cy - dz * sy;
      const sYf = -dx * sy - dz * cy;
      const want = new Set<string>();
      if (sx > 0.4) want.add('ArrowRight');
      else if (sx < -0.4) want.add('ArrowLeft');
      if (sYf > 0.4) want.add('ArrowUp');
      else if (sYf < -0.4) want.add('ArrowDown');
      await sync(want);
      await page.waitForTimeout(120);
    }
    throw new Error('ranger never reached the case-board within the step budget');
  } finally {
    await sync(new Set());
  }
}

test('board: case-board opens the mission board in-world and launches a 3D mission', async ({ page }, testInfo) => {
  // Real-time stepping to the board on SwiftShader (~10× slower under parallel load).
  test.setTimeout(90_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await enterWorld(page);

  // 1) walk up to the case-board — proximity surfaces the hub affordance.
  await walkToBoard(page);
  const openBtn = page.locator('.explore-board-open');
  await expect(openBtn, 'the mission-board affordance shows at the case-board').toBeVisible();
  await shot(page, 'board-at-hub');

  // 2) open the mission board — the world must SURVIVE (no leaveWorld → screen stays
  // 'world', the scene is still live behind the overlay).
  await openBtn.click();
  const boardOverlay = page.locator('.mission-board');
  await expect(boardOverlay, 'the mission board overlay opens').toBeVisible();
  expect(await hook(page, (r) => r.screen), 'world survives behind the board').toBe('world');
  expect(await hook(page, (r) => r.pos()), 'world scene still live').not.toBeNull();
  await shot(page, 'board-open');

  // 3) close it → back to the world in-place (explore HUD returns, still 'world').
  await page.getByRole('button', { name: 'Terug naar de open plek' }).click();
  await expect(page.locator('.explore-hud'), 'the explore HUD returns').toBeVisible();
  expect(await hook(page, (r) => r.screen), 'still in the world after closing').toBe('world');

  // 4) reopen (the hub affordance re-surfaced as the HUD remounted) and start a
  // mission → it plays IN-PLACE, so the resolved view is 3D.
  await expect(openBtn, 'the hub affordance is back at the board').toBeVisible();
  await openBtn.click();
  await expect(boardOverlay).toBeVisible();
  await page.locator('.mission-card').first().click();
  await page.getByRole('button', { name: 'Ga op pad' }).click();

  await expect
    .poll(() => hook(page, (r) => r.missionView), { timeout: 20_000, message: 'board-launched mission plays 3D in-place' })
    .toBe('3d');
  // the world is still loaded under the in-place activity (never torn down).
  expect(await hook(page, (r) => r.pos()), 'world survives the launch').not.toBeNull();
  await shot(page, 'board-mission-3d');

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
