import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors } from './helpers';

/**
 * W6.3a — the diegetic biology beat. When a mission is played IN THE WORLD
 * (fromWorld), the "Wist je dat" fact is no longer a neutral narrator card: the
 * companion raaf tells it to you on location (`.fact--raaf`, kicker "<raaf>
 * vertelt", the fact text read-aloud-ready). The lodge 2D path is untouched.
 *
 * Navigation reuses the proven friction/W6.1 marker path: walk to the frisling
 * marker, open the veldnotitie with Space, play in place. frisling carries fact
 * beats between its beats (biggetjes-pyjama, zwijn-reukzin). Winning steps uses
 * the dev-only `__ranger.winStep()` hook — the variant runs its OWN genuine
 * resolve path, so only input modality is shortcut, never runtime state.
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

/** Steer the ranger to a specific mission's marker (camera-relative, W1.5). */
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

/** Open the veldnotitie at the marker with Space and start it. */
async function startFromMarker(page: Page, missionId: string): Promise<void> {
  const playBtn = page.locator('.explore-play');
  await expect(playBtn, `the Speel mee prompt shows at the ${missionId} marker`).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('Space');
  const startBtn = page.getByRole('button', { name: 'Ga op pad' });
  await expect(startBtn, 'Space opens the veldnotitie briefing').toBeVisible({ timeout: 10_000 });
  await startBtn.click();
}

test('raaf fact: an in-world fact beat is delivered as raaf-companion speech on location', async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await enterWorld(page);
  await walkToMarker(page, 'frisling');
  await startFromMarker(page, 'frisling');
  await expect
    .poll(() => hook(page, (r) => r.missionView), { timeout: 20_000, message: 'mission resolves 3D in-place' })
    .toBe('3d');

  // Win steps until the diegetic raaf fact card surfaces. It carries the raaf
  // frame ("<raaf> vertelt") + the corvid mark + real fact text — NOT the
  // neutral "Wist je dat" lodge kicker. Assert the moment it appears (do not
  // click through it), so a plain (non-raaf) fact card can never pass this.
  const raafFact = page.locator('.fact--raaf');
  const anyFact = page.locator('.fact');
  const reward = page.locator('.reward');
  let seen = false;
  for (let i = 0; i < 120; i++) {
    if (await raafFact.isVisible().catch(() => false)) { seen = true; break; }
    if (await anyFact.isVisible().catch(() => false)) {
      // a fact card is up but not the raaf variant → click through and keep going
      await anyFact.locator('.btn-start').click();
      await page.waitForTimeout(150);
      continue;
    }
    if (await reward.isVisible().catch(() => false)) break;
    await hook(page, (r) => r.winStep());
    await page.waitForTimeout(250);
  }
  expect(seen, 'the raaf fact card appeared during in-world play').toBe(true);

  await expect(raafFact.locator('.boot-kicker')).toContainText('vertelt');
  const factText = (await raafFact.locator('.fact-text').textContent())?.trim() ?? '';
  expect(factText.length, 'the raaf speaks a real fact').toBeGreaterThan(10);
  await shot(page, 'raaf-fact');

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
