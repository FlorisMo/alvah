import { test, expect, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { AREA_VELUWE } from '../src/content/veluwe';
import { R, save, sleep, snap, visibleButtons, walkTo, type Hint, type P2 } from './golden-lib';

/**
 * THE FLOW AROUND THE GOLDEN PATH, played with real keys and clicks (wave 4 · flow):
 *
 *   RANGER_PORT=<port> npx playwright test e2e/flow.spec.ts --project=chromium --workers=2
 *
 * Each test is one finding the fresh-eyes QA wave reported, played where the player
 * meets it: the wayfinding arrow from the west helipad (parent B1/B2, child B10), menus
 * that hold the ranger still (breaker B1), "Stop de missie" and the way on after a
 * mission (review MIS-1, child B6/B7, parent B12), a mission picked on the missiebord
 * (parent B6), the raaf hut's way back (breaker B3), the bird bench's Pauze (breaker
 * B5) and a jeep parked by the missiebord (breaker B4, parent B8). The dev hook is only
 * READ (and `__stage` for one visibility read); `winStep()` is never called.
 * Screenshots: test-results/flow/<test>/NN-<name>.png.
 */

test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });

const missions = AREA_VELUWE.missies;
const byId = (id: string): (typeof missions)[number] => missions.find((m) => m.id === id)!;
type Skin = { encounters?: { vraag: string; opties: { label: string; goed: boolean }[] }[] };

/** A returning player's save: the ranger made, the first-entry hints seen, `done` finished. */
async function seed(page: Page, done: string[] = []): Promise<void> {
  const ranger = {
    avatarGemaakt: true,
    voltooid: Object.fromEntries(done.map((id) => [id, true])),
    settings: { wereldHintGezien: true, tikHintGezien: true },
  };
  await page.addInitScript((r) => {
    if (!localStorage.getItem('alvah-ef-v1')) localStorage.setItem('alvah-ef-v1', JSON.stringify({ ranger: r }));
  }, ranger);
}

/** Begin → the world. */
async function boot(page: Page): Promise<void> {
  await page.goto('/?dev=1');
  await page.getByRole('button', { name: 'Begin', exact: true }).click({ timeout: 30_000 });
  await expect.poll(() => R<string>(page, 'r.screen'), { timeout: 60_000 }).toBe('world');
  await expect.poll(() => R<P2 | null>(page, 'r.pos()'), { timeout: 30_000 }).not.toBeNull();
  await sleep(page, 1_500);
}

let shotN = 0;
async function shot(page: Page, name: string): Promise<void> {
  const dir = path.join(test.info().project.outputDir, 'flow', test.info().title.replace(/[^a-z0-9]+/gi, '-').slice(0, 60));
  fs.mkdirSync(dir, { recursive: true });
  shotN += 1;
  await page.screenshot({ path: path.join(dir, `${String(shotN).padStart(2, '0')}-${name}.png`) });
}

const pos = (page: Page): Promise<P2> => R<P2>(page, 'r.pos()');
const markerOf = async (page: Page, id: string): Promise<P2> =>
  (await R<(P2 & { missionId: string })[]>(page, 'r.markers()')).find((m) => m.missionId === id)!;
const dist = (a: P2, b: P2): number => Math.hypot(a.x - b.x, a.z - b.z);

/** Hold a key for `ms`; how far the ranger moved. */
async function holdKey(page: Page, key: string, ms: number): Promise<number> {
  const a = await pos(page);
  await page.keyboard.down(key);
  await sleep(page, ms);
  await page.keyboard.up(key);
  await sleep(page, 300);
  return dist(a, await pos(page));
}

/** The chip as a player reads it: the arrow's turn (rad), its words, the glyph. */
async function chip(page: Page): Promise<{ turn: number | null; cue: string; glyph: string } | null> {
  return page.evaluate(() => {
    const strip = document.querySelector<HTMLElement>('.explore-wayfind');
    if (!strip || strip.hidden) return null;
    const g = strip.querySelector<HTMLElement>('.wf-glyph');
    const m = /rotate\(([-\d.]+)rad\)/.exec(g?.style.transform ?? '');
    return { turn: m ? Number(m[1]) : null, cue: strip.querySelector('.wf-cue')?.textContent ?? '', glyph: g?.textContent ?? '' };
  });
}

/** Follow ONLY the chip, like a child: walk while its arrow points up, turn toward it
 *  otherwise. Returns how it went: arrived, how often the words changed once he was on
 *  his way (the first turn toward it and the last 6 m aside), metres walked away. */
async function followChip(page: Page, target: string, timeout = 90_000): Promise<{ arrived: boolean; changes: number; away: number; words: string[] }> {
  const held = new Set<string>();
  const setKeys = async (want: Set<string>): Promise<void> => {
    for (const k of [...held]) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); }
    for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
  };
  const goal = await markerOf(page, target);
  const words: string[] = [];
  let away = 0; let prev: number | null = null; let arrived = false;
  const t0 = Date.now();
  try {
    while (Date.now() - t0 < timeout) {
      if ((await snap(page)).near === target) { arrived = true; break; }
      const c = await chip(page);
      const d = dist(await pos(page), goal);
      if (prev !== null && d > prev + 0.05 && d > 6) away += d - prev;
      prev = d;
      // the words once he is on his way, until the last few metres (stepping past the
      // ring and turning back to it is his steering, not the arrow swinging)
      const w = (c?.cue ?? '').split(' · ')[0];
      if (w && d > 6 && (words.length || w === 'recht vooruit') && w !== words[words.length - 1]) words.push(w);
      const a = c?.turn == null ? 0 : Math.atan2(Math.sin(c.turn), Math.cos(c.turn));
      const want = new Set<string>();
      if (c?.glyph === '◎' || Math.abs(a) < 0.35) want.add('ArrowUp');
      else { want.add(a > 0 ? 'ArrowRight' : 'ArrowLeft'); if (Math.abs(a) < 1) want.add('ArrowUp'); }
      await setKeys(want);
      await sleep(page, 100);
    }
  } finally { await setKeys(new Set()); }
  return { arrived, changes: Math.max(0, words.length - 1), away, words };
}

/** Play the running mission's steps with real clicks until it is marked done. */
async function playToTheEnd(page: Page, id: string): Promise<void> {
  const mission = byId(id);
  const t0 = Date.now();
  while (!(await save(page))?.voltooid[id] && Date.now() - t0 < 4 * 60_000) {
    const h = await R<Hint | null>(page, 'r.playHint()');
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
    const enc = mission.stappen.flatMap((st) => (st.skin as Skin).encounters ?? []).find((e) => text.includes(e.vraag));
    const right = enc?.opties.find((o) => o.goed)?.label;
    const btn = right ? page.getByRole('button', { name: right, exact: true }).filter({ visible: true }).first() : null;
    if (btn && await btn.isVisible().catch(() => false) && await btn.isEnabled().catch(() => false)) {
      await btn.click(); await sleep(page, 900); continue;
    }
    const card = page.getByRole('button', { name: /^(Verder|Klaar)$/ }).filter({ visible: true }).first();
    if (await card.isVisible().catch(() => false)) { await card.click(); await sleep(page, 400); continue; }
    await sleep(page, 250);
  }
  expect(!!(await save(page))?.voltooid[id], `the mission "${id}" was never won`).toBe(true);
}

const markerShown = (page: Page, id: string): Promise<boolean | null> => page.evaluate((mid) => {
  const w = (window as unknown as { __stage?: { world?: { pois?: { list: { missionId: string; group: { visible: boolean } }[] } } } }).__stage?.world;
  return w?.pois?.list.find((m) => m.missionId === mid)?.group.visible ?? null;
}, id);

test('from the west helipad, following only the arrow leads to the frisling: it never swings back @flow', async ({ page }) => {
  test.setTimeout(4 * 60_000);
  await seed(page);
  await boot(page);
  const w = await walkTo(page, { x: -44, z: -26 }, { stopDist: 1.5, timeout: 90_000 });
  expect(w.res).toBe('arrived');
  const run = await followChip(page, 'frisling');
  await shot(page, 'at-frisling');
  expect(run.arrived, `the arrow never led to the frisling (words: ${run.words.join(' / ')})`).toBe(true);
  expect(run.away, 'following the arrow walked him away from the mission').toBeLessThan(3);
  expect(run.changes, `on his way the words changed ${run.changes}× (${run.words.join(' / ')})`).toBeLessThanOrEqual(2);
});

test('Pauze, the missiebord and a briefing hold the ranger still under held arrow keys @flow', async ({ page }) => {
  test.setTimeout(3 * 60_000);
  await seed(page);
  await boot(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Terug naar de open plek' })).toBeVisible();
  expect(await holdKey(page, 'ArrowUp', 2_000), 'he walked away behind Pauze').toBeLessThan(0.1);
  await page.keyboard.press('Escape');
  expect(await holdKey(page, 'ArrowUp', 1_000), 'back in the world he walks').toBeGreaterThan(0.8);
  const board = (await R<P2>(page, 'r.board()'))!;
  await walkTo(page, board, { stopDist: 1.6 });
  await page.getByRole('button', { name: 'Bekijk het missiebord' }).click();
  expect(await holdKey(page, 'ArrowUp', 2_000), 'he walked away behind the missiebord').toBeLessThan(0.1);
  await page.keyboard.press('Enter'); // the "Nu doen" mission
  await expect(page.getByRole('button', { name: 'Ga op pad' })).toBeVisible({ timeout: 10_000 });
  expect(await holdKey(page, 'ArrowUp', 2_000), 'he walked away behind the briefing').toBeLessThan(0.1);
});

test('Stop de missie keeps the marker; the replay is won, Enter walks on, the chip points and the next mission is the big button @flow', async ({ page }) => {
  test.setTimeout(9 * 60_000); // a whole mission with real clicks; slow on a loaded machine
  await seed(page);
  await boot(page);
  const marker = await markerOf(page, 'frisling');
  await walkTo(page, marker, { stopDist: 1.5, until: (s) => s.near === 'frisling' });
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: 'Ga op pad' }).click();
  await expect.poll(() => R<string | null>(page, 'r.missionView'), { timeout: 15_000 }).not.toBeNull();
  await sleep(page, 1_500);
  await page.keyboard.press('Escape'); // the mission's Pauze
  await page.getByRole('button', { name: /Stop de missie/ }).click();
  await expect.poll(async () => (await R<string>(page, 'r.screen')) === 'world' && (await R<string | null>(page, 'r.missionView')) === null,
    { timeout: 10_000 }).toBe(true);
  await sleep(page, 800); // a stopped game disposes a frame later: the marker must stay
  await shot(page, 'after-stop');
  expect(await markerShown(page, 'frisling'), 'the marker vanished after Stop de missie (MIS-1)').toBe(true);
  // and the mission can be played again, right there, to the end
  await page.getByRole('button', { name: /Speel mee: De verdwaalde frisling/ }).click();
  await page.getByRole('button', { name: 'Ga op pad' }).click();
  await expect.poll(() => R<string | null>(page, 'r.missionView'), { timeout: 15_000 }).not.toBeNull();
  await playToTheEnd(page, 'frisling');
  // only Enter from the reward on: it always moves on, never a dead end (child B7)
  let presses = 0;
  while (presses < 10) {
    if ((await R<string>(page, 'r.screen')) === 'world' && (await R<string | null>(page, 'r.missionView')) === null
      && await page.locator('.explore-hud').isVisible().catch(() => false)) break;
    await page.keyboard.press('Enter');
    presses += 1;
    await sleep(page, 1_500);
  }
  expect(await page.locator('.explore-hud').isVisible(), `Enter never led back to the world (visible: ${await visibleButtons(page)})`).toBe(true);
  // the chip points the way at once (parent B12)
  const c = await chip(page);
  expect(c?.cue ?? '', 'the chip waits for a step before it points').not.toContain('zoek het spoor');
  expect(c?.cue ?? '').toMatch(/ m$|je bent er/);
  await shot(page, 'back-in-world');
  // the big button leads on; playing it again is a quiet choice (child B6)
  const next = page.locator('.explore-prompt .btn-start');
  await expect(next).toHaveText(/Volgende: Het reekalf in het gras/);
  await expect(page.locator('.explore-prompt .explore-replay')).not.toHaveClass(/btn-start/);
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snap(page)).near, { timeout: 10_000, message: '"Volgende" brings him to the next marker' }).toBe('ree-niet-aanraken');
  await expect(page.locator('.briefing .boot-title')).toHaveText('Het reekalf in het gras', { timeout: 10_000 });
  expect(await markerShown(page, 'frisling')).toBe(true);
});

test('a mission picked on the missiebord is played at its own marker, by the water, and Enter starts it at once @flow', async ({ page }) => {
  test.setTimeout(3 * 60_000);
  await seed(page, ['frisling', 'ree-niet-aanraken', 'wildcamera']); // "Nu doen": the frog by the ven
  await boot(page);
  const board = (await R<P2>(page, 'r.board()'))!;
  await walkTo(page, board, { stopDist: 1.6 });
  await page.keyboard.press('Enter'); // Bekijk het missiebord
  await expect(page.locator('.mission-card.mc-next')).toBeVisible();
  await page.keyboard.press('Enter'); // the "Nu doen" card
  await expect(page.locator('.briefing .boot-title')).toHaveText('De kikker in het ven', { timeout: 10_000 });
  // the calm cut's veil is still lifting now: it must not swallow the next Enter
  const at = await snap(page);
  await page.keyboard.press('Enter'); // Ga op pad, at once
  expect(at.near).toBe('ven');
  expect(dist(at.p!, await markerOf(page, 'ven')), 'the ven mission starts away from the ven').toBeLessThan(2.4);
  await expect.poll(() => R<string | null>(page, 'r.missionView'), { timeout: 5_000, message: 'Enter on "Ga op pad" was swallowed by the lifting veil' }).not.toBeNull();
  await sleep(page, 3_000); // the stage's one calm reframe
  // "Zoek de kikker bij het water": framed straight ahead, the ven in view — not swung
  // ~200° round to the dry heath behind him (parent B6)
  const yaw0 = at.c!.yaw, yaw1 = (await snap(page)).c!.yaw;
  const turn = Math.abs(Math.atan2(Math.sin(yaw1 - yaw0), Math.cos(yaw1 - yaw0))) * 180 / Math.PI;
  expect(turn, 'the lens swung away from where he looked').toBeLessThan(40);
  const water = await page.evaluate(() => {
    const w = (window as unknown as { __stage?: { world?: { limits?: { blocked?: (x: number, z: number) => boolean } } } }).__stage?.world;
    const r = (window as unknown as { __ranger?: { screenOf(x: number, y: number, z: number): { onScreen: boolean } | null } }).__ranger;
    let on = 0;
    for (let x = 28; x <= 64; x += 2) for (let z = -37; z <= -1; z += 2) if (w?.limits?.blocked?.(x, z) && r?.screenOf(x, -1.4, z)?.onScreen) on++;
    return on;
  });
  expect(water, 'the ven is not in the picture of "Zoek de kikker bij het water"').toBeGreaterThan(10);
  await shot(page, 'frog-game-by-the-water');
});

test('the raaf hut and Instellingen keep their way back on screen, and Esc leaves them @flow', async ({ page }) => {
  test.setTimeout(3 * 60_000);
  await seed(page);
  await boot(page);
  const clickable = (sel: string): Promise<boolean> => page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.bottom <= innerHeight && !!hit && (hit === el || el.contains(hit));
  }, sel);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Help de jonge raaf|Verzorg/ }).click();
  expect(await clickable('.cabin-back'), 'the raaf hut\'s way back is clipped').toBe(true);
  await shot(page, 'raaf-hut');
  await page.keyboard.press('Escape');
  await expect(page.locator('.explore-hud')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Instellingen/ }).click();
  expect(await clickable('.tw-back'), '"Klaar" is below the fold').toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Terug naar de open plek' })).toBeVisible();
  // the briefing at 800×600: its way back stays on the card
  await page.setViewportSize({ width: 800, height: 600 });
  await page.keyboard.press('Escape');
  const board = (await R<P2>(page, 'r.board()'))!;
  await walkTo(page, board, { stopDist: 1.6 });
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Ga op pad' })).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.ra-fade')).toHaveCount(0); // the calm cut to the marker has lifted
  expect(await clickable('.briefing-back'), '"Nog even rondkijken" fell below the card at 800×600').toBe(true);
  await shot(page, 'briefing-800x600');
});

test('the bird bench has Pauze: Esc opens it and "Stop met luisteren" hands the world back @flow', async ({ page }) => {
  test.setTimeout(3 * 60_000);
  await seed(page);
  await boot(page);
  const sit = (await R<P2>(page, 'r.sitSpot()'))!;
  await walkTo(page, sit, { stopDist: 1.2, until: (s) => false, timeout: 90_000 });
  await page.getByRole('button', { name: 'Luister naar de vogels' }).click();
  await expect.poll(() => R<string | null>(page, 'r.missionView'), { timeout: 10_000 }).not.toBeNull();
  await sleep(page, 2_000);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /Stop met luisteren/ })).toBeVisible();
  await shot(page, 'bench-pause');
  await page.getByRole('button', { name: /Stop met luisteren/ }).click();
  await expect.poll(async () => (await R<string>(page, 'r.screen')) === 'world' && (await R<string | null>(page, 'r.missionView')) === null,
    { timeout: 10_000 }).toBe(true);
  expect(await holdKey(page, 'ArrowUp', 1_000), 'he cannot walk on after the bench').toBeGreaterThan(0.6);
});

test('a jeep parked by the missiebord never hides "Bekijk het missiebord" @flow', async ({ page }) => {
  test.setTimeout(4 * 60_000);
  await seed(page);
  await boot(page);
  const v = (await R<P2>(page, 'r.vehicle()'))!;
  await walkTo(page, v, { stopDist: 2.8, until: (s) => false, timeout: 60_000 });
  await page.getByRole('button', { name: /Stap in de jeep/ }).click();
  // drive to beside the board, then get out
  const target = { x: 3.5, z: -1.5 };
  const t0 = Date.now();
  const held = new Set<string>();
  const setKeys = async (want: Set<string>): Promise<void> => {
    for (const k of [...held]) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); }
    for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
  };
  while (Date.now() - t0 < 40_000) {
    const j = await R<{ x: number; z: number; heading: number }>(page, 'r.vehicle()');
    const dx = target.x - j.x, dz = target.z - j.z;
    if (Math.hypot(dx, dz) < 1.5) break;
    const turn = Math.atan2(Math.sin(Math.atan2(dx, dz) - j.heading), Math.cos(Math.atan2(dx, dz) - j.heading));
    const want = new Set(['ArrowUp']);
    if (Math.abs(turn) > 0.12) want.add(turn > 0 ? 'ArrowLeft' : 'ArrowRight');
    await setKeys(want);
    await sleep(page, 120);
  }
  await setKeys(new Set());
  await sleep(page, 800);
  await page.getByRole('button', { name: /Stap uit/ }).click();
  await sleep(page, 800);
  const board = (await R<P2>(page, 'r.board()'))!;
  await walkTo(page, board, { stopDist: 1.3, timeout: 30_000 });
  const jeep = (await R<P2>(page, 'r.vehicle()'))!;
  expect(dist(jeep, board), 'the jeep is parked by the board').toBeLessThan(6);
  await shot(page, 'board-by-jeep');
  await expect(page.getByRole('button', { name: 'Bekijk het missiebord' }), `visible: ${await visibleButtons(page)}`).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.locator('.mission-board')).toBeVisible();
});
