import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors, keySteer } from './helpers';

/**
 * W6.3b — the collectible veldnotitie. Playing a mission IN THE WORLD pins each
 * "Wist je dat"-fact as a veldnotitie on the case-board (prikbord), persisted in
 * the ranger namespace. This walks a classic mission from its marker, plays
 * it (its fact beats collect the notes), returns to patrol, then opens the
 * prikbord from the pause hub and asserts a collected veldnotitie is pinned —
 * with its real fact text and a non-zero count — and that it round-tripped to
 * localStorage.
 *
 * Navigation + step-winning reuse the proven friction/W6.1 marker path; the
 * dev-only `__ranger.winStep()` hook drives each variant's genuine resolve path,
 * so only input modality is shortcut, never runtime state.
 *
 * Run 6: De verdwaalde frisling plays as an in-world adventure (real-input tests: golden,
 * missions.spec); `winStep()` resolves the classic in-place steps, so this plays a classic
 * mission. Run 7: De kikker in het ven, played here before, is an adventure now, so it plays
 * De winterronde.
 */

interface Hook {
  screen: string;
  missionView: '2d' | '3d' | null;
  pos(): { x: number; z: number } | null;
  cameraYaw(): number | null;
  nearId(): string | null;
  markers(): { x: number; z: number; missionId: string }[] | null;
  winStep(): boolean;
}
function hook<T>(page: Page, fn: (r: Hook) => T): Promise<T | null> {
  return page.evaluate((body) => {
    const r = (window as unknown as { __ranger?: unknown }).__ranger;
    // eslint-disable-next-line no-new-func
    return r ? (new Function('r', `return (${body})(r)`))(r) : null;
  }, fn.toString()) as Promise<T | null>;
}

async function enterWorld(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByRole('button', { name: 'Dit is mijn ranger' }).click();
  await expect.poll(() => hook(page, (r) => r.screen), { timeout: 30_000 }).toBe('world');
}

const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const;

async function walkToMarker(page: Page, missionId: string): Promise<void> {
  const markers = await hook(page, (r) => r.markers());
  expect(markers, 'markers() available in world').not.toBeNull();
  const target = markers!.find((m) => m.missionId === missionId);
  expect(target, `a world marker exists for ${missionId}`).toBeTruthy();
  const down = new Set<string>();
  const sync = async (want: Set<string>): Promise<void> => {
    for (const k of KEYS) {
      if (want.has(k) && !down.has(k)) { await page.keyboard.down(k); down.add(k); }
      else if (!want.has(k) && down.has(k)) { await page.keyboard.up(k); down.delete(k); }
    }
  };
  const steer = await keySteer(page);
  try {
    for (let i = 0; i < 220; i++) {
      if (await hook(page, (r) => r.nearId()) === missionId) return;
      const p = await hook(page, (r) => r.pos());
      const yaw = await hook(page, (r) => r.cameraYaw());
      if (!p || yaw == null) { await page.waitForTimeout(100); continue; }
      const dx = target!.x - p.x, dz = target!.z - p.z;
      await sync(steer(dx, dz, yaw)); // the arrow keys a child would hold (helpers.keySteer)
      await page.waitForTimeout(120);
    }
    throw new Error(`ranger never reached the ${missionId} marker within the step budget`);
  } finally {
    await sync(new Set());
  }
}

async function startFromMarker(page: Page, missionId: string): Promise<void> {
  const playBtn = page.locator('.explore-play');
  await expect(playBtn, `the Speel mee prompt shows at the ${missionId} marker`).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('Space');
  const startBtn = page.getByRole('button', { name: 'Ga op pad' });
  await expect(startBtn, 'Space opens the veldnotitie briefing').toBeVisible({ timeout: 10_000 });
  await startBtn.click();
}

/** Play the mission to its reward, clicking through fact cards on the way. */
async function playToReward(page: Page): Promise<void> {
  await expect
    .poll(() => hook(page, (r) => r.missionView), { timeout: 20_000, message: 'mission resolves 3D in-place' })
    .toBe('3d');
  const reward = page.locator('.reward');
  const fact = page.locator('.fact .btn-start');
  for (let i = 0; i < 140; i++) {
    if (await reward.isVisible().catch(() => false)) return;
    if (await fact.isVisible().catch(() => false)) { await fact.click(); await page.waitForTimeout(150); continue; }
    await hook(page, (r) => r.winStep());
    await page.waitForTimeout(220);
  }
  throw new Error('mission never reached the reward card');
}

/** From the reward card, return to the open plek (handling the wildcamera-capture
 *  + world-beat detours a verhaalHaak mission triggers). */
async function returnToPatrol(page: Page): Promise<void> {
  await expect(page.locator('.reward')).toBeVisible();
  const patrol = page.getByRole('button', { name: 'Verder op patrouille' });
  const wildcam = page.getByRole('button', { name: /Kijk wat je vond|Bekijk de wildcamera/ });
  if (await patrol.isVisible().catch(() => false)) await patrol.click();
  else { await wildcam.click(); await page.getByRole('button', { name: 'Verder op patrouille' }).click(); }
  const skip = page.getByRole('button', { name: 'Even verder lopen' });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await expect.poll(() => hook(page, (r) => r.screen), { timeout: 15_000 }).toBe('world');
  await expect(page.locator('.explore-hud'), 'back on the open plek').toBeVisible();
}

test('veldnotitie: an in-world fact is pinned to the prikbord and persisted', async ({ page }, testInfo) => {
  test.setTimeout(300_000); // headroom for slow software rendering under sustained load
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await enterWorld(page);
  await walkToMarker(page, 'herstel');
  await startFromMarker(page, 'herstel');
  await playToReward(page);
  await returnToPatrol(page);

  // it round-tripped into the shared alvah-ef-v1 ranger namespace
  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem('alvah-ef-v1');
    return raw ? Object.keys(JSON.parse(raw).ranger?.veldnotities ?? {}) : [];
  });
  expect(stored.length, 'a veldnotitie persisted after the in-world play').toBeGreaterThan(0);

  // open the prikbord from the pause hub (over the live world — no leaveWorld)
  await page.locator('.explore-pause').click();
  await expect(page.locator('.ph-back'), 'the pause hub opens').toBeVisible();
  await page.locator('.ph-prikbord').click();
  await expect(page.locator('.case-board'), 'the prikbord opens over the world').toBeVisible();

  // a collected veldnotitie is pinned with real fact text + a non-zero count
  const note = page.locator('.cb-veld-note').first();
  await expect(note, 'a veldnotitie is pinned to the board').toBeVisible();
  const noteText = (await note.locator('.cb-veld-text').textContent())?.trim() ?? '';
  expect(noteText.length, 'the note carries the real fact text').toBeGreaterThan(5);
  await expect(page.locator('.cb-veld-head')).not.toContainText('· 0/');
  // read-aloud is wired (≥56px dual-channel button per note)
  await expect(note.locator('.cb-veld-speak')).toBeVisible();
  await shot(page, 'veldnotitie-board');

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
