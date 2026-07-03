import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors } from './helpers';

/**
 * Sit-spot / "Ken je roep" E2E (WORLD-PLAN W6.4b2). A bench by the vogelkijkhut is
 * the diegetic entry to the perception slice: the ranger walks up to it, and acting
 * on the affordance plays roep3d IN-PLACE (`missionView === '3d'`) without the world
 * being torn down (`leaveWorld` is never called — `screen` stays 'world'). This spec
 * plays ONE FULL beat from the bench (driven through the genuine resolve via the
 * `winStep()` dev hook, exactly like the two-mission chain) and asserts the world
 * survives and the slice resolves back to free-roam in-place.
 *
 * Steering reuses the camera-relative arrow-key walk from board.spec/interact.spec:
 * the follow-cam rotates, so each tick we map the desired WORLD direction back into
 * screen keys with the inverse of `resolveInput`'s rotation.
 */

interface Hook {
  screen: string;
  missionView: '2d' | '3d' | null;
  pos(): { x: number; z: number } | null;
  cameraYaw(): number | null;
  sitSpot(): { x: number; z: number; near: boolean } | null;
  winStep(): boolean;
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

/** Walk to the sit-spot bench with arrow keys until its proximity fires. Same
 *  camera-relative mapping as board.spec's board walk (see that file's note). */
async function walkToSitSpot(page: Page): Promise<void> {
  const spot = await hook(page, (r) => r.sitSpot());
  expect(spot, 'sitSpot() available in world').not.toBeNull();

  const down = new Set<string>();
  const sync = async (want: Set<string>): Promise<void> => {
    for (const k of KEYS) {
      if (want.has(k) && !down.has(k)) { await page.keyboard.down(k); down.add(k); }
      else if (!want.has(k) && down.has(k)) { await page.keyboard.up(k); down.delete(k); }
    }
  };
  try {
    for (let i = 0; i < 300; i++) {
      const s = await hook(page, (r) => r.sitSpot());
      if (s?.near) return;
      const p = await hook(page, (r) => r.pos());
      const yaw = await hook(page, (r) => r.cameraYaw());
      if (!p || !s || yaw == null) { await page.waitForTimeout(100); continue; }
      const dx = s.x - p.x, dz = s.z - p.z;
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
    throw new Error('ranger never reached the sit-spot within the step budget');
  } finally {
    await sync(new Set());
  }
}

test('sitspot: bench by the vogelkijkhut plays a full "Ken je roep" beat in-world (3D)', async ({ page }, testInfo) => {
  // Real-time stepping to the far sit-spot on software rendering (~10× slower under load).
  test.setTimeout(240_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await enterWorld(page);

  // 1) walk to the sit-spot — proximity surfaces the "listen" affordance.
  await walkToSitSpot(page);
  const playBtn = page.locator('.explore-sit-play');
  await expect(playBtn, 'the sit-spot affordance shows at the bench').toBeVisible();
  // W6.5 tone-gate: the NEW sit-spot entry button is a ≥56px tap target.
  const sitBox = await playBtn.boundingBox();
  expect(sitBox, 'sit-spot button has a bounding box').not.toBeNull();
  expect(Math.min(sitBox!.width, sitBox!.height), 'sit-spot button ≥56px').toBeGreaterThanOrEqual(56);
  await shot(page, 'sitspot-at-bench');

  // 2) act on it → the roep slice plays IN-PLACE, so the resolved view is 3D and the
  // world must SURVIVE (no leaveWorld → screen stays 'world', scene still live).
  await playBtn.click();
  await expect
    .poll(() => hook(page, (r) => r.missionView), { timeout: 20_000, message: 'roep slice plays 3D in-place' })
    .toBe('3d');
  expect(await hook(page, (r) => r.screen), 'world survives behind the slice').toBe('world');
  expect(await hook(page, (r) => r.pos()), 'world scene still live during the slice').not.toBeNull();
  // the roep call banner + at least one calm bird form are staged in-world.
  await expect(page.locator('.roep3d-card'), 'the accessible roep banner is up').toBeVisible();
  // W6.5 tone-gate: the roep-slice controls (read-aloud + play-the-call) are ≥56px too.
  for (const sel of ['.roep3d-card .roep-speak', '.roep3d-card .roep-call']) {
    const loc = page.locator(sel);
    await expect(loc, `${sel} visible`).toBeVisible();
    const b = await loc.boundingBox();
    expect(b, `${sel} has a bounding box`).not.toBeNull();
    expect(Math.min(b!.width, b!.height), `${sel} ≥56px`).toBeGreaterThanOrEqual(56);
  }
  await shot(page, 'sitspot-roep-3d');

  // 3) play ONE FULL beat from the bench — drive the genuine resolve (answer every
  // remaining round correctly, real BeatSummary + teardown) via the winStep hook.
  await expect
    .poll(() => hook(page, (r) => r.winStep()), { timeout: 10_000, message: 'the roep beat accepts the win driver' })
    .toBe(true);

  // 4) the beat resolves back to free-roam IN-PLACE: missionView clears, the world
  // was never torn down, and the explore HUD returns with the sit-spot affordance
  // re-surfaced (the ranger is still at the bench).
  await expect
    .poll(() => hook(page, (r) => r.missionView), { timeout: 20_000, message: 'the beat resolves back to free-roam' })
    .toBeNull();
  expect(await hook(page, (r) => r.screen), 'still in the world after the beat').toBe('world');
  expect(await hook(page, (r) => r.pos()), 'world survived the whole beat').not.toBeNull();
  await expect(page.locator('.explore-hud'), 'the explore HUD returns after the beat').toBeVisible();
  await expect(playBtn, 'the sit-spot affordance is back at the bench').toBeVisible();
  await shot(page, 'sitspot-after-beat');

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
