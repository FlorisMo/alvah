import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors, keySteer } from './helpers';

/**
 * W6.3a — the biology beat between two steps, and who tells it (run 6). Before a
 * raaf has been rescued nobody pretends one talks to you: the card says "Wist je
 * dat? · 1/3". Rescued and named in the hut (Pauze → "Help de jonge raaf"), the raaf
 * tells it: `.fact--raaf`, kicker "Kroa vertelt · 1/3", the fact read aloud.
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

/** Steer the ranger to a specific mission's marker (the tank keys: helpers.keySteer). */
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

/** Open the veldnotitie at the marker with Space and start it. */
async function startFromMarker(page: Page, missionId: string): Promise<void> {
  const playBtn = page.locator('.explore-play');
  await expect(playBtn, `the Speel mee prompt shows at the ${missionId} marker`).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('Space');
  const startBtn = page.getByRole('button', { name: 'Ga op pad' });
  await expect(startBtn, 'Space opens the veldnotitie briefing').toBeVisible({ timeout: 10_000 });
  await startBtn.click();
}

/** Win steps until a fact card is up (the first of the mission), and return it. */
async function firstFact(page: Page): Promise<void> {
  const anyFact = page.locator('.fact');
  for (let i = 0; i < 120; i++) {
    if (await anyFact.isVisible().catch(() => false)) return;
    await hook(page, (r) => r.winStep());
    await page.waitForTimeout(250);
  }
  throw new Error('no fact card appeared during in-world play');
}

/** Close the mission: every fact card, the reunion, the reward (and its clue), back on patrol. */
async function finishMission(page: Page): Promise<void> {
  for (let i = 0; i < 160; i++) {
    if (await page.locator('.explore-hud').isVisible().catch(() => false)
      && await hook(page, (r) => r.screen) === 'world' && await hook(page, (r) => r.missionView) === null) return;
    for (const name of [/^Verder$/, /Kijk wat je vond/, /Verder op patrouille/]) {
      const b = page.getByRole('button', { name }).filter({ visible: true }).first();
      if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); break; }
    }
    if (await hook(page, (r) => r.missionView) === '3d') await hook(page, (r) => r.winStep());
    await page.waitForTimeout(250);
  }
  throw new Error('the mission never led back to patrol');
}

test('raaf fact: "Wist je dat?" until the raaf is rescued, then the raaf tells it on location', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await enterWorld(page);
  await walkToMarker(page, 'frisling');
  await startFromMarker(page, 'frisling');
  await expect
    .poll(() => hook(page, (r) => r.missionView), { timeout: 20_000, message: 'mission resolves 3D in-place' })
    .toBe('3d');

  // no raaf yet: a plain "Wist je dat?" card, no raaf frame
  await firstFact(page);
  await expect(page.locator('.fact .boot-kicker')).toHaveText('Wist je dat? · 1/3');
  await expect(page.locator('.fact--raaf')).toHaveCount(0);
  await shot(page, 'fact-wist-je-dat');
  await finishMission(page);

  // rescue the raaf in the hut and name it, like a player: Pauze → the raaf → a name
  await page.locator('.explore-pause').click();
  await page.getByRole('button', { name: 'Help de jonge raaf' }).click();
  await page.getByRole('button', { name: 'Kroa', exact: true }).click();
  await page.getByRole('button', { name: 'Vang Kroa op' }).click();
  await page.getByRole('button', { name: 'Terug naar de open plek' }).click();
  await expect(page.locator('.explore-hud')).toBeVisible();

  // play it again at the marker: now Kroa tells the fact
  await page.getByRole('button', { name: /Speel nog eens: De verdwaalde frisling/ }).click();
  await page.getByRole('button', { name: 'Ga op pad' }).click();
  await firstFact(page);
  const raafFact = page.locator('.fact--raaf');
  await expect(raafFact).toBeVisible();
  await expect(raafFact.locator('.boot-kicker')).toHaveText('Kroa vertelt · 1/3');
  const factText = (await raafFact.locator('.fact-text').textContent())?.trim() ?? '';
  expect(factText.length, 'the raaf speaks a real fact').toBeGreaterThan(10);
  await shot(page, 'raaf-fact');

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
