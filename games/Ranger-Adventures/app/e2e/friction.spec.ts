import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors } from './helpers';

/**
 * In-world mission friction audit (WORLD-PLAN W6.1). Walks the ranger to a real
 * world MARKER, opens the veldnotitie with the interact key (Space — the laptop
 * twin of tapping "Speel mee"), and plays the mission through EVERY beat in
 * place, screenshotting each one. Two missions cover all five EF engines from a
 * marker entry:
 *   - `frisling`      → zoeken → corsi → dagnacht
 *   - `nachtronde`    → simon  → wisselen
 * Together: zoeken, corsi, dagnacht, simon, wisselen — the full EF five, each
 * driven from the open world with no lodge visit.
 *
 * The audit's job is to surface rough edges (prompt overlap, reframe jumps,
 * unreachable markers, a step that never resolves 3D). Every beat asserts
 * `missionView === '3d'` and that the world survives (never torn down), and the
 * page-error sink must stay empty. Completing a 3D step uses the dev-only
 * `__ranger.winStep()` hook — each variant runs its OWN genuine resolve path
 * (real scoring, BeatSummary, teardown), so every asserted value is real runtime
 * state; pick-accuracy stays covered by the per-engine parity tests.
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

/** Drive title → avatar → world (W2.1: world is the front door). */
async function enterWorld(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByRole('button', { name: 'Dit is mijn ranger' }).click();
  await expect.poll(() => hook(page, (r) => r.screen), { timeout: 30_000 }).toBe('world');
}

const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const;

/**
 * Steer the ranger to the marker of a SPECIFIC mission with arrow keys until its
 * proximity fires. Camera-relative steering (the follow-cam rotates, W1.5): each
 * tick maps the desired WORLD direction back into screen keys via the inverse of
 * `resolveInput`'s rotation (its own inverse — see interact.spec).
 */
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
  try {
    for (let i = 0; i < 220; i++) {
      if (await hook(page, (r) => r.nearId()) === missionId) return;
      const p = await hook(page, (r) => r.pos());
      const yaw = await hook(page, (r) => r.cameraYaw());
      if (!p || yaw == null) { await page.waitForTimeout(100); continue; }
      const dx = target!.x - p.x, dz = target!.z - p.z;
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
    throw new Error(`ranger never reached the ${missionId} marker within the step budget`);
  } finally {
    await sync(new Set());
  }
}

/** Open the veldnotitie at the marker with Space (interact key), then start it. */
async function startFromMarker(page: Page, missionId: string): Promise<void> {
  const playBtn = page.locator('.explore-play');
  await expect(playBtn, `the Speel mee prompt shows at the ${missionId} marker`).toBeVisible({ timeout: 10_000 });
  await shot(page, `friction-${missionId}-marker`);
  await page.keyboard.press('Space');
  const startBtn = page.getByRole('button', { name: 'Ga op pad' });
  await expect(startBtn, 'Space opens the veldnotitie briefing').toBeVisible({ timeout: 10_000 });
  // FRICTION CHECK: the briefing replaces the explore HUD — the play prompt and
  // the briefing card must never be on screen together (prompt overlap).
  await expect(playBtn, 'briefing replaces the explore prompt (no overlap)').toHaveCount(0);
  await shot(page, `friction-${missionId}-briefing`);
  await startBtn.click();
}

/**
 * Play the mission through every beat in place, screenshotting each. Asserts
 * every beat resolves to the 3D in-world view and the world is never torn down.
 * Returns the number of distinct 3D beats seen.
 */
async function playAllBeats(page: Page, missionId: string): Promise<number> {
  const reward = page.locator('.reward');
  const fact = page.locator('.fact .btn-start');
  let beats = 0;
  let shotAt = -1;
  for (let i = 0; i < 140; i++) {
    if (await reward.isVisible().catch(() => false)) break;
    if (await fact.isVisible().catch(() => false)) {
      await shot(page, `friction-${missionId}-fact-${beats}`);
      await fact.click();
      await page.waitForTimeout(150);
      continue;
    }
    const view = await hook(page, (r) => r.missionView);
    if (view === '3d') {
      // a fresh beat has resolved 3D — screenshot it once, assert the world lives.
      if (shotAt !== beats) {
        beats++;
        shotAt = beats;
        expect(await hook(page, (r) => r.pos()), 'world survives every beat').not.toBeNull();
        await shot(page, `friction-${missionId}-beat-${beats}`);
      }
    }
    const fired = await hook(page, (r) => r.winStep());
    if (fired) shotAt = -1; // the next resolved 3D view is the next beat
    await page.waitForTimeout(fired ? 300 : 200);
  }
  await expect(reward, `${missionId} reaches its reward card`).toBeVisible({ timeout: 10_000 });
  await shot(page, `friction-${missionId}-reward`);
  return beats;
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

// Two missions cover the EF five from marker entries; each is its own test so a
// full walk-to-marker + multi-beat play stays inside one Playwright timeout on
// SwiftShader (a single test with both walks overran). Together they audit
// zoeken/corsi/dagnacht (frisling) + simon/wisselen (nachtronde).
const AUDIT = [
  { mission: 'frisling', engines: 'zoeken/corsi/dagnacht', beats: 3 },
  { mission: 'nachtronde', engines: 'simon/wisselen', beats: 2 },
] as const;

for (const { mission, engines, beats } of AUDIT) {
  test(`friction: ${mission} plays from its world marker (${engines}), no rough edges`, async ({ page }, testInfo) => {
    test.setTimeout(90_000 + beats * 45_000); // walk-to-marker + each beat's play, on slow SwiftShader
    const errors: string[] = [];
    collectPageErrors(page, errors);

    await enterWorld(page);
    await walkToMarker(page, mission);
    await startFromMarker(page, mission);
    const seen = await playAllBeats(page, mission);
    expect(seen, `${mission} plays all its beats (${engines})`).toBeGreaterThanOrEqual(beats);
    await returnToPatrol(page);
    expect(await hook(page, (r) => r.screen), 'never dropped to the lodge').not.toBe('lodge');

    await reportPageErrors(testInfo, errors);
    expect(errors, `no page errors across the ${mission} friction audit`).toEqual([]);
  });
}
