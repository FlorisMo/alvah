import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors } from './helpers';

/**
 * Two-mission chain E2E (WORLD-PLAN W2.3). Proves the world-first loop end to
 * end: from the open plek the ranger opens the case-board hub, plays a full
 * zoeken-mission IN-PLACE (`missionView === '3d'`, world never torn down),
 * returns to patrol, then walks back to the board and starts a SECOND mission —
 * all without a single lodge visit. Both missions persist a `BeatSummary`
 * (skill `trials` climb inside the shared `alvah-ef-v1` blob) and both resolve
 * to the 3D in-place view.
 *
 * Completing a 3D step: headless SwiftShader can't pixel-accurately raycast the
 * pick surfaces (that correctness lives in the per-engine parity tests), so the
 * suite fires the dev-only `__ranger.winStep()` hook — each running variant
 * drives its OWN genuine success path (real scoring, real BeatSummary, real
 * teardown, real persistence). It is the input-modality shortcut, not a
 * state shortcut: everything asserted below is real runtime state.
 *
 * Steering to the board reuses the camera-relative arrow-key walk from
 * board.spec / interact.spec (the follow-cam rotates, so each tick maps the
 * desired WORLD direction back into screen keys via the inverse of
 * `resolveInput`'s rotation).
 */

interface Hook {
  screen: string;
  missionView: '2d' | '3d' | null;
  pos(): { x: number; z: number } | null;
  cameraYaw(): number | null;
  board(): { x: number; z: number; near: boolean } | null;
  winStep(): boolean;
}
function hook<T>(page: Page, fn: (r: Hook) => T): Promise<T | null> {
  return page.evaluate((body) => {
    const r = (window as unknown as { __ranger?: unknown }).__ranger;
    // eslint-disable-next-line no-new-func
    return r ? (new Function('r', `return (${body})(r)`))(r) : null;
  }, fn.toString()) as Promise<T | null>;
}

/** Per-engine cumulative beat counts from the persisted ranger skill record. */
function skillTrials(page: Page): Promise<Record<string, number>> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('alvah-ef-v1');
    if (!raw) return {};
    const skill = (JSON.parse(raw).ranger?.skill ?? {}) as Record<string, { trials?: number }>;
    const out: Record<string, number> = {};
    for (const k of Object.keys(skill)) out[k] = skill[k]?.trials ?? 0;
    return out;
  });
}

/** Drive title → avatar → world (W2.1: world is the front door). */
async function enterWorld(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByRole('button', { name: 'Dit is mijn ranger' }).click();
  await expect.poll(() => hook(page, (r) => r.screen), { timeout: 30_000 }).toBe('world');
}

const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const;

/** Walk to the spawn case-board with arrow keys until its proximity fires. */
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

/** Open the mission board at the hub and start the mission with the given id. */
async function startMissionFromBoard(page: Page, missionId: string): Promise<void> {
  const openBtn = page.locator('.explore-board-open');
  await expect(openBtn, 'the hub affordance shows at the case-board').toBeVisible({ timeout: 15_000 });
  await openBtn.click();
  await expect(page.locator('.mission-board'), 'the mission board opens').toBeVisible();
  await page.locator(`.mission-card[data-id="${missionId}"]`).click();
  await page.getByRole('button', { name: 'Ga op pad' }).click();
}

/** Win the current 3D step, clicking through any between-step "Wist je dat" fact
 *  cards, until the reward card shows. Asserts the first step resolved to 3D. */
async function completeMissionInPlace(page: Page): Promise<void> {
  await expect
    .poll(() => hook(page, (r) => r.missionView), { timeout: 20_000, message: 'step resolves 3D in-place' })
    .toBe('3d');
  const reward = page.locator('.reward');
  const fact = page.locator('.fact .btn-start');
  for (let i = 0; i < 80; i++) {
    if (await reward.isVisible().catch(() => false)) return;
    if (await fact.isVisible().catch(() => false)) { await fact.click(); await page.waitForTimeout(150); continue; }
    const fired = await hook(page, (r) => r.winStep());
    // world is never torn down while a step plays in-place
    expect(await hook(page, (r) => r.pos()), 'world survives every step').not.toBeNull();
    await page.waitForTimeout(fired ? 300 : 200);
  }
  throw new Error('mission never reached the reward card');
}

/** From the reward card, return to the open plek (handling the optional
 *  wildcamera-capture + world-beat detours), landing back on screen 'world'. */
async function returnToPatrol(page: Page): Promise<void> {
  await expect(page.locator('.reward')).toBeVisible();
  const patrol = page.getByRole('button', { name: 'Verder op patrouille' });
  const wildcam = page.getByRole('button', { name: 'Bekijk de wildcamera' });
  if (await patrol.isVisible().catch(() => false)) await patrol.click();
  else { await wildcam.click(); await page.getByRole('button', { name: 'Verder op patrouille' }).click(); }
  const skip = page.getByRole('button', { name: 'Even verder lopen' }); // optional world-beat
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await expect.poll(() => hook(page, (r) => r.screen), { timeout: 15_000 }).toBe('world');
  await expect(page.locator('.explore-hud'), 'back on the open plek').toBeVisible();
}

test('chain: two world-first missions back to back, no lodge visit, both 3D + persisted', async ({ page }, testInfo) => {
  test.setTimeout(120_000); // two full walk-to-board + play cycles on SwiftShader
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await enterWorld(page);
  const before = await skillTrials(page);

  // ---- MISSION 1: a full zoeken-mission (zoeken + dagnacht) from the hub ----
  await walkToBoard(page);
  await startMissionFromBoard(page, 'ree-niet-aanraken');
  await completeMissionInPlace(page);
  await shot(page, 'chain-mission1-reward');
  await returnToPatrol(page);
  expect(await hook(page, (r) => r.screen), 'never dropped to the lodge').not.toBe('lodge');

  const afterOne = await skillTrials(page);
  expect(afterOne.zoeken ?? 0, 'mission 1 persisted a zoeken BeatSummary').toBeGreaterThan(before.zoeken ?? 0);
  expect(afterOne.dagnacht ?? 0, 'mission 1 persisted a dagnacht BeatSummary').toBeGreaterThan(before.dagnacht ?? 0);

  // ---- MISSION 2: walk back to the hub and start a second mission in-place ----
  await walkToBoard(page);
  await startMissionFromBoard(page, 'frisling');
  await expect
    .poll(() => hook(page, (r) => r.missionView), { timeout: 20_000, message: 'second mission resolves 3D' })
    .toBe('3d');
  // play its first (zoeken) beat → a fresh BeatSummary persists for mission 2.
  await hook(page, (r) => r.winStep());
  await expect
    .poll(() => skillTrials(page).then((t) => t.zoeken ?? 0), { timeout: 15_000, message: 'mission 2 persisted a BeatSummary' })
    .toBeGreaterThan(afterOne.zoeken ?? 0);
  expect(await hook(page, (r) => r.pos()), 'world survives the second launch').not.toBeNull();
  expect(await hook(page, (r) => r.screen), 'still no lodge visit').not.toBe('lodge');
  await shot(page, 'chain-mission2-3d');

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
