import { test, expect, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { AREA_VELUWE } from '../src/content/veluwe';
import { WORLDBEAT_EVERY } from '../src/core/worldbeat';
import { R, sleep, visibleButtons, walkTo, type Hint, type P2 } from './golden-lib';
import { keySteer } from './helpers';

/**
 * ONDERWEG ON THE KEYBOARD (run 6, FLOW P3): the calm world beat between missions is
 * answered with the arrow keys and Enter, and Esc still walks on ("Even verder lopen").
 *
 *   RANGER_PORT=<port> npx playwright test e2e/onderweg.spec.ts --project=chromium
 *
 * Reached for real, like a player: the beat comes on every WORLDBEAT_EVERY-th finished
 * mission of a session (replays count) once he has walked on, so this plays a short
 * mission (De winterronde) three times at its marker with real clicks ("Speel nog eens"),
 * walks on toward an animal he can see, and answers the impulse beat ("Een vos loopt
 * weg. Wat doe jij?") with → ← Enter. Three more plays bring the direction beat
 * ("Welke kant is je volgende missie?"): ← ↑ → light up "Naar links", "Rechtdoor" and
 * "Naar rechts", and Esc walks on. The dev hook is only READ; `winStep()` is never called.
 * Screenshots: test-results/onderweg/NN-<name>.png.
 *
 * Run 7: it played mission 1 (De verdwaalde frisling) six times; the frisling became a
 * longer expedition every play (2.5-4 min), so six plays outran the test's 20 minutes. Any
 * finished mission counts toward the beat, so it plays the shortest one, and the next
 * mission the beat asks about is then the story's first (the frisling, not yet done).
 */

test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });

const FIRST = AREA_VELUWE.missies.find((m) => m.id === 'herstel')!;
/** The mission the game offers next while FIRST is the only one done: the story's first. */
const NEXT = AREA_VELUWE.missies[0];
type Skin = { encounters?: { vraag: string; opties: { label: string; goed: boolean }[] }[] };

let shotN = 0;
async function shot(page: Page, name: string): Promise<void> {
  const dir = path.join(test.info().project.outputDir, 'onderweg');
  fs.mkdirSync(dir, { recursive: true });
  shotN += 1;
  await page.screenshot({ path: path.join(dir, `${String(shotN).padStart(2, '0')}-${name}.png`) });
}

const beatUp = (page: Page): Promise<boolean> => page.locator('.worldbeat').isVisible().catch(() => false);
const onPatrol = async (page: Page): Promise<boolean> =>
  await page.locator('.explore-hud').isVisible().catch(() => false)
  && await R<string>(page, 'r.screen') === 'world' && await R<string | null>(page, 'r.missionView') === null;

/** The option the keyboard has lit (its label), or null. */
const lit = (page: Page): Promise<string | null> => page.evaluate(() => {
  const b = document.activeElement as HTMLElement | null;
  return b?.classList.contains('wb-opt') ? b.querySelector('.wb-label')?.textContent ?? null : null;
});

/** One play of FIRST from its marker to back on patrol, with real clicks: the 3D
 *  targets where a perfect player clicks, the choice the content marks goed, the cards'
 *  way on. `again`: "Speel nog eens" (the quiet chip under "Volgende: …"). */
async function playFirst(page: Page, again: boolean): Promise<void> {
  const titel = FIRST.titel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (again) {
    // (an adventure ends a few steps from its marker, a classic mission at it: he walks
    // back to the marker to play it again)
    const m = (await R<(P2 & { missionId: string })[]>(page, 'r.markers()')).find((x) => x.missionId === FIRST.id)!;
    await walkTo(page, m, { stopDist: 1.5, timeout: 60_000, until: (sn) => sn.near === FIRST.id });
  }
  await page.getByRole('button', { name: new RegExp(`${again ? 'Speel nog eens' : 'Speel mee'}: ${titel}`) }).click({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Ga op pad' }).click({ timeout: 15_000 });
  await expect.poll(() => R<string | null>(page, 'r.missionView'), { timeout: 15_000 }).not.toBeNull();
  const encounters = FIRST.stappen.flatMap((st) => (st.skin as Skin).encounters ?? []);
  const t0 = Date.now();
  while (Date.now() - t0 < 5 * 60_000) {
    if (await onPatrol(page)) return;
    const h = await R<(Hint & { walk?: { x: number; z: number; r: number } }) | null>(page, 'r.playHint()');
    if (h?.walk) { await walkTo(page, { x: h.walk.x, z: h.walk.z }, { stopDist: h.walk.r, timeout: 20_000 }); continue; }
    if (h?.onScreen) {
      let s = h;
      for (let i = 0; i < 12; i++) { // let a camera move settle
        await sleep(page, 150);
        const h2 = await R<Hint | null>(page, 'r.playHint()');
        if (!h2 || h2.id !== s.id) break;
        const still = Math.hypot(h2.x - s.x, h2.y - s.y) < 3; s = h2;
        if (still) break;
      }
      if (s.onScreen) { await page.mouse.click(s.x, s.y); await sleep(page, 400); continue; }
    }
    const text = await page.evaluate(() => document.getElementById('ui')?.innerText ?? '');
    const right = encounters.find((e) => text.includes(e.vraag))?.opties.find((o) => o.goed)?.label;
    const btn = right ? page.getByRole('button', { name: right, exact: true }).filter({ visible: true }).first() : null;
    if (btn && await btn.isVisible().catch(() => false) && await btn.isEnabled().catch(() => false)) {
      await btn.click(); await sleep(page, 900); continue;
    }
    const next = page.getByRole('button', { name: /^(Verder|Klaar|Kijk wat je vond|Verder op patrouille)$/ }).filter({ visible: true }).first();
    if (await next.isVisible().catch(() => false)) { await next.click().catch(() => {}); await sleep(page, 400); continue; }
    const act = page.locator('.adv-action').filter({ visible: true }).first(); // an adventure's action in the world
    if (await act.isVisible().catch(() => false)) { await act.click().catch(() => {}); await sleep(page, 400); continue; }
    await sleep(page, 250);
  }
  throw new Error(`${FIRST.id} never led back to patrol (visible: ${await visibleButtons(page)})`);
}

/** Walk like a player (the arrow keys) toward `goal` until within `stop` m, the Onderweg
 *  beat comes, or `ms` pass. The beat is checked every step, so no arrow key is pressed
 *  once it is up. */
async function walkLeg(page: Page, goal: () => Promise<P2 & { stop: number }>, ms: number): Promise<'beat' | 'arrived' | 'timeout'> {
  const steer = await keySteer(page);
  const held = new Set<string>();
  const setKeys = async (want: Set<string>): Promise<void> => {
    for (const k of [...held]) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); }
    for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
  };
  const t0 = Date.now();
  try {
    while (Date.now() - t0 < ms) {
      if (await beatUp(page)) return 'beat';
      const me = await R<P2>(page, 'r.pos()');
      const yaw = await R<number | null>(page, 'r.cameraYaw()');
      const g = await goal();
      if (Math.hypot(g.x - me.x, g.z - me.z) < g.stop) return 'arrived';
      if (yaw !== null) await setKeys(steer(g.x - me.x, g.z - me.z, yaw));
      await sleep(page, 100);
    }
    return 'timeout';
  } finally { await setKeys(new Set()); }
}

/** The roaming ground animal easiest to see from here (a deer from far, a fox closer):
 *  the beat names one in view, within about h × 21 m. */
async function animalToSee(page: Page): Promise<P2 & { stop: number }> {
  const me = await R<P2>(page, 'r.pos()');
  const animals = (await R<{ id: string; x: number; z: number; h: number }[] | null>(page, 'r.ambient()') ?? [])
    .filter((a) => !a.id.startsWith('bird-'))
    .map((a) => ({ x: a.x, z: a.z, stop: Math.min(18, a.h * 21) * 0.55, d: Math.hypot(a.x - me.x, a.z - me.z) }))
    .sort((a, b) => (a.d - a.stop) - (b.d - b.stop));
  return animals[0] ?? { x: me.x, z: me.z, stop: 1 };
}

test('Onderweg is answered with the arrow keys and Enter, Esc walks on @onderweg', async ({ page }) => {
  test.setTimeout(20 * 60_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.goto('/?dev=1');
  await page.getByRole('button', { name: 'Begin', exact: true }).click({ timeout: 30_000 });
  const maker = page.getByRole('button', { name: 'Dit is mijn ranger' });
  if (await maker.waitFor({ state: 'visible', timeout: 20_000 }).then(() => true, () => false)) await maker.click({ timeout: 30_000 });
  await expect.poll(() => R<string>(page, 'r.screen'), { timeout: 60_000 }).toBe('world');
  await expect.poll(() => R<P2 | null>(page, 'r.pos()'), { timeout: 30_000 }).not.toBeNull();
  const marker = (await R<(P2 & { missionId: string })[]>(page, 'r.markers()')).find((m) => m.missionId === FIRST.id)!;
  const w = await walkTo(page, marker, { stopDist: 1.0, until: (s) => s.near === FIRST.id, timeout: 120_000 });
  expect(['arrived', 'until']).toContain(w.res);

  // ---- three finished missions (a replay counts): the impulse beat
  for (let i = 0; i < WORLDBEAT_EVERY; i++) {
    await playFirst(page, i > 0);
    await sleep(page, 800);
    expect(await beatUp(page), 'the beat waits until he walks on (never on the reward)').toBe(false);
  }
  // he walks on (the beat waits for 15 m of walking), then toward an animal he can see
  const here = await R<P2>(page, 'r.pos()');
  let went = await walkLeg(page, async () => ({ x: here.x, z: here.z + 16, stop: 1 }), 30_000);
  for (let i = 0; i < 8 && went !== 'beat'; i++) {
    went = await walkLeg(page, () => animalToSee(page), 12_000);
    if (went === 'arrived') { await sleep(page, 1_500); if (await beatUp(page)) went = 'beat'; }
  }
  expect(went, 'walking on brought the Onderweg beat').toBe('beat');
  const card = page.locator('.worldbeat');
  await expect(card.locator('.wb-prompt')).toContainText('Wat doe jij?');
  await sleep(page, 400);
  await shot(page, 'impulse-beat');
  const opts = card.locator('.wb-opt');
  await expect(opts).toHaveCount(2);
  for (const o of await opts.all()) expect((await o.boundingBox())!.height, 'an option is a ≥56 px target').toBeGreaterThanOrEqual(56);
  // Esc is the way on: the skip is the card's back button
  await expect(card.locator('[data-key="back"]')).toHaveText('Even verder lopen');
  // → lights the second, ← the first: a visible focus, and nothing is chosen yet
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => lit(page)).toBe('Ren erachteraan');
  await expect(card.locator('.wb-opt.is-focus')).toHaveCount(1);
  await sleep(page, 300); // its ring eases in (0.12 s)
  await shot(page, 'impulse-right');
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => lit(page)).toBe('Blijf op het pad');
  await expect(card.locator('.wb-feedback')).toBeHidden();
  expect(await R<string>(page, 'r.screen'), 'arrow keys on the card never walk him').toBe('world');
  // Enter chooses the lit option: the calm rule, praised, and on he walks
  await page.keyboard.press('Enter');
  await expect(card.locator('.wb-feedback')).toHaveText('Knap, je blijft rustig.');
  await shot(page, 'impulse-chosen');
  await expect(card).toBeHidden({ timeout: 5_000 });
  await expect(page.locator('.explore-hud')).toBeVisible();

  // ---- three more: the direction beat (← ↑ → pick their own), and Esc walks on
  const back = (await R<(P2 & { missionId: string })[]>(page, 'r.markers()')).find((m) => m.missionId === FIRST.id)!;
  const w2 = await walkTo(page, back, { stopDist: 1.0, until: (s) => s.near === FIRST.id, timeout: 90_000 });
  expect(['arrived', 'until']).toContain(w2.res);
  for (let i = 0; i < WORLDBEAT_EVERY; i++) { await playFirst(page, true); await sleep(page, 800); }
  // walk 12 m away from the next mission, then back toward it: once he has walked 15 m
  // with it ahead of him, the beat asks which way it is
  const next = (await R<(P2 & { missionId: string })[]>(page, 'r.markers()')).find((m) => m.missionId === NEXT.id)!;
  const from = await R<P2>(page, 'r.pos()');
  const away = Math.hypot(from.x - next.x, from.z - next.z) || 1;
  const out = { x: from.x + ((from.x - next.x) / away) * 12, z: from.z + ((from.z - next.z) / away) * 12 };
  expect(await walkLeg(page, async () => ({ ...out, stop: 1 }), 30_000)).not.toBe('timeout');
  expect(await walkLeg(page, async () => ({ ...next, stop: 2 }), 40_000), 'walking toward the next mission brought the beat').toBe('beat');
  await expect(card.locator('.wb-prompt')).toContainText('Welke kant');
  await sleep(page, 400);
  await shot(page, 'direction-beat');
  await expect(opts).toHaveCount(3);
  for (const [key, label] of [['ArrowUp', 'Rechtdoor'], ['ArrowLeft', 'Naar links'], ['ArrowRight', 'Naar rechts']] as const) {
    await page.keyboard.press(key);
    await expect.poll(() => lit(page), { message: `${key} lights "${label}"` }).toBe(label);
  }
  await sleep(page, 300);
  await shot(page, 'direction-right');
  await page.keyboard.press('Escape');
  await expect(card, 'Esc: "Even verder lopen"').toBeHidden({ timeout: 5_000 });
  await expect(page.locator('.explore-hud')).toBeVisible();
  expect(errors).toEqual([]);
});
