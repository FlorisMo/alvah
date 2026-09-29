import { test, expect, type Page, type TestInfo } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { R, walkTo, sleep, save, type P2, type Hint } from './golden-lib';
import { AREA_VELUWE } from '../src/content/veluwe';
import { MISSIE } from '../src/content/copy';

/**
 * READ-ALOUD COVERAGE (run 6, FLOW P4): every line a child sees appear is also read aloud,
 * played like a player (real clicks and keys, a fresh browser):
 *
 *   1. the first visit: the title (the voice starts at the first click), the maker, Bram's
 *      greeting, the lessons, the hook, the mission marker's prompt, the briefing;
 *   2. a save that knows the first minute: mission 1 played with the real mouse (the play
 *      hints) to its reunion, the fact cards, the reward and the first clue, which says
 *      where the sporenboek is.
 *
 * How: a watcher in the page notes every reading line the moment it is on screen (the
 * surfaces below), and a spy on `speechSynthesis.speak` notes every utterance. A line
 * passes when its words were spoken in an utterance around the time it appeared (up to
 * 30 s before: a card is read at once, its lines are written as the voice reaches them;
 * up to 15 s after: a line waits for the voice before it). The test fails on the first
 * visible line that was never spoken, naming it.
 *
 * The reading surfaces (FLOW's): the title, the maker's title and greeting, Bram's strip,
 * the lesson strip, the one prompt bottom centre (its words, not the key cap), the rim
 * tip, and on the cards every title, briefing line, fact, reunion line, the reward's
 * praise and knap woord, the clue (its title, text and where it went) and Onderweg's
 * question and answer. Not lines to read: the wayfinding chip (a live compass: its title
 * is said by the prompt at the ring), kickers and counts, key caps, the maker's legends
 * and swatches (they say themselves on hover), and the buttons on a card (the screen's
 * words name what they do). The dev hook is only READ.
 *
 *   RANGER_PORT=<port> npx playwright test e2e/readcoverage.spec.ts --project=chromium
 */

test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });

const FIRST = AREA_VELUWE.missies[0];
type Seen = { line: string; at: number; where: string };
type Said = { text: string; at: number };

/** The surfaces a line is read from, and how to take its words. */
const SURFACES = [
  '.title-mark', '.title-sub', '.av-titel', '.av-greet',
  '.speaker-strip .sp-line', '.lesson-strip .ls-text', '.explore-tip',
  '.explore-prompt button', '.explore-hub-prompt button', '.explore-porch-prompt button', '.explore-sit-prompt button', '.explore-vehicle-prompt button',
  '.card .boot-title', '.briefing-line', '.fact-text .zin', '.reunion-text .zin', '.reward-lof', '.reward-knap .rk-word',
  '.cb-clue-title', '.cb-clue-text .zin', '.clue-where .cw-lines > span', '.wb-prompt .zin', '.wb-feedback',
].join(', ');

/** Spy on the voice and watch the screen, from the first frame. */
async function watch(page: Page): Promise<void> {
  await page.addInitScript((sel: string) => {
    const w = window as unknown as { __said: Said[]; __seen: Seen[] };
    w.__said = [];
    w.__seen = [];
    const orig = SpeechSynthesis.prototype.speak;
    SpeechSynthesis.prototype.speak = function (u: SpeechSynthesisUtterance) {
      w.__said.push({ text: u.text, at: performance.now() });
      try { return orig.call(this, u); } catch { /* no voice in this browser */ }
    };
    const known = new Set<string>();
    const words = (el: Element): string => {
      const c = el.cloneNode(true) as HTMLElement;
      c.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
      return (c.textContent ?? '').replace(/\s+/g, ' ').trim();
    };
    const shown = (el: Element): boolean => {
      if (el.closest('[hidden], [aria-hidden="true"], .ra-leaving, [class*="--leaving"]')) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight) return false;
      for (let at: Element | null = el; at; at = at.parentElement) {
        const s = getComputedStyle(at);
        if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) < 0.35) return false;
      }
      return true;
    };
    // which surface a line is on: its own name, or its card's for a line of a text
    const NAMES = ['title-mark', 'title-sub', 'av-titel', 'av-greet', 'sp-line', 'ls-text', 'explore-tip', 'reward-lof', 'rk-word',
      'cb-clue-title', 'cw-boek', 'cw-waar', 'briefing-line', 'wb-feedback', 'fact-text', 'reunion-text', 'cb-clue-text', 'wb-prompt'];
    const whereOf = (el: Element): string => {
      if (el.tagName === 'BUTTON') return 'prompt';
      const own = el.classList.contains('zin') ? el.parentElement : el;
      const hit = NAMES.find((k) => own?.classList.contains(k));
      return hit ?? (own?.classList.contains('boot-title') ? 'card-title' : (own?.className || el.tagName).toString().split(' ')[0]);
    };
    const tick = (): void => {
      document.querySelectorAll(sel).forEach((el) => {
        const line = words(el);
        if (!line || known.has(line) || !shown(el)) return;
        known.add(line);
        w.__seen.push({ line, at: performance.now(), where: whereOf(el) });
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, SURFACES);
}

/** How a line and an utterance compare: the words only, as the voice hears them. */
function norm(t: string): string {
  return t
    .replace(/\s*→\s*/g, ' naar ')
    .replace(/(\d+)\s*\/\s*(\d+)/g, '$1 van $2')
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '')
    .replace(/[.,!?:;…“”"'’‘«»·()]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

let dir = '';
let n = 0;
async function snap(page: Page, name: string): Promise<void> {
  n += 1;
  await page.screenshot({ path: path.join(dir, `${String(n).padStart(2, '0')}-${name}.png`) });
}
function shotsInto(testInfo: TestInfo, sub: string): void {
  dir = path.join(testInfo.project.outputDir, 'readcoverage', sub);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  n = 0;
}

/** Every line seen so far was spoken around the time it appeared. */
async function everyLineSpoken(page: Page, where: string): Promise<Seen[]> {
  await sleep(page, 400);
  const { seen, said } = await page.evaluate(() => {
    const w = window as unknown as { __said: Said[]; __seen: Seen[] };
    return { seen: w.__seen.slice(), said: w.__said.slice() };
  });
  fs.writeFileSync(path.join(dir, 'SAID.txt'), said.map((u) => `${(u.at / 1000).toFixed(1)}s ${u.text}`).join('\n'));
  const missing = seen.filter((s) => !said.some((u) => u.at >= s.at - 30_000 && u.at <= s.at + 15_000 && norm(u.text).includes(norm(s.line))));
  expect(missing.map((m) => `${m.where}: "${m.line}"`), `${where}: lines on screen that were never read aloud`).toEqual([]);
  return seen;
}

test('the first visit, title to briefing: every line that appears is read aloud', async ({ page }, testInfo) => {
  test.setTimeout(5 * 60_000);
  shotsInto(testInfo, 'first-visit');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await watch(page);
  await page.goto('/?dev=1');

  // the title: the voice may only start at the first touch; a curious child clicks the sky
  const begin = page.getByRole('button', { name: 'Begin', exact: true });
  await begin.waitFor({ state: 'visible', timeout: 40_000 });
  await sleep(page, 600);
  await page.mouse.click(640, 40);
  await sleep(page, 900);
  await snap(page, 'title');
  await begin.click();

  // the maker: its title and the greeting; a name chip says the new greeting
  const klaar = page.getByRole('button', { name: 'Dit is mijn ranger' });
  await klaar.waitFor({ state: 'visible', timeout: 30_000 });
  await sleep(page, 1_500);
  await page.getByRole('button', { name: 'Bo', exact: true }).click();
  await expect(page.locator('.av-greet')).toHaveText('Hoi, ranger Bo!');
  await sleep(page, 900);
  await snap(page, 'maker');
  await klaar.click();
  await expect.poll(() => R<string>(page, 'r.screen'), { timeout: 60_000 }).toBe('world');

  // Bram's greeting, then walk, run, the hook (the golden walker's keys)
  await expect.poll(async () => (await R<{ learned: string[] }>(page, 'r.hint()')).learned.includes('bram'), { timeout: 40_000, message: 'Bram greeted' }).toBe(true);
  await snap(page, 'after-greeting');
  await expect(page.locator('.lesson-strip')).toBeVisible({ timeout: 15_000 });
  await page.keyboard.down('ArrowUp'); await sleep(page, 1_800); await page.keyboard.up('ArrowUp');
  await expect(page.locator('.lesson-strip.ls-rennen')).toBeVisible({ timeout: 15_000 });
  await snap(page, 'run-lesson');
  await page.keyboard.down('Shift'); await page.keyboard.down('ArrowLeft'); await sleep(page, 300);
  await page.keyboard.down('ArrowUp'); await sleep(page, 2_200);
  await page.keyboard.up('ArrowUp'); await page.keyboard.up('ArrowLeft'); await page.keyboard.up('Shift');
  await expect.poll(async () => (await R<{ chip: boolean; speaking: boolean }>(page, 'r.hint()')).chip, { timeout: 40_000, message: 'the hook brought the chip' }).toBe(true);
  await expect.poll(async () => (await R<{ speaking: boolean }>(page, 'r.hint()')).speaking, { timeout: 20_000 }).toBe(false);
  await snap(page, 'hook-chip');

  // to the marker: its prompt names the mission and says so
  const marker = (await R<{ x: number; z: number; missionId: string }[]>(page, 'r.markers()')).find((m) => m.missionId === FIRST.id)!;
  await walkTo(page, marker, { stopDist: 1.6, timeout: 90_000 });
  await expect(page.getByRole('button', { name: `Speel mee: ${FIRST.titel}` })).toBeVisible({ timeout: 10_000 });
  await sleep(page, 1_200);
  await snap(page, 'marker');

  // the briefing: Bram's field note, every line written as it is read
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: MISSIE.gaOpPad })).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => page.locator('.briefing-line.ra-line-wait').count(), { timeout: 30_000, message: 'every briefing line is written' }).toBe(0);
  await snap(page, 'briefing');

  const seen = await everyLineSpoken(page, 'title → briefing');
  // the walk really met every beat (a false green would see nothing)
  const where = new Set(seen.map((s) => s.where));
  for (const w of ['title-mark', 'title-sub', 'av-titel', 'av-greet', 'sp-line', 'ls-text', 'prompt', 'card-title', 'briefing-line']) expect(where.has(w), `a "${w}" line was seen`).toBe(true);
  expect(seen.length, 'lines seen').toBeGreaterThan(12);
  fs.writeFileSync(path.join(dir, 'LINES.txt'), seen.map((s) => `${(s.at / 1000).toFixed(1)}s ${s.where}: ${s.line}`).join('\n'));
  expect(errors).toEqual([]);
});

test('mission 1 to its reward and first clue: every line is read aloud, the clue says where the sporenboek is', async ({ page }, testInfo) => {
  test.setTimeout(9 * 60_000);
  shotsInto(testInfo, 'reward-clue');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  // a save that has met Bram and learned the controls (so the walk goes straight to work)
  await page.addInitScript(() => {
    if (!localStorage.getItem('alvah-ef-v1')) localStorage.setItem('alvah-ef-v1', JSON.stringify({ ranger: { avatarGemaakt: true, settings: { geleerd: { bram: true, lopen: true, rennen: true, haak: true, kijken: true, jeep: true } } } }));
  });
  await watch(page);
  await page.goto('/?dev=1');
  await page.getByRole('button', { name: 'Begin', exact: true }).click({ timeout: 40_000 });
  await expect.poll(() => R<string>(page, 'r.screen'), { timeout: 60_000 }).toBe('world');
  await sleep(page, 2_500);
  const marker = (await R<{ x: number; z: number; missionId: string }[]>(page, 'r.markers()')).find((m) => m.missionId === FIRST.id)!;
  await walkTo(page, marker, { stopDist: 1.6, timeout: 90_000 });
  await page.getByRole('button', { name: `Speel mee: ${FIRST.titel}` }).click({ timeout: 10_000 });
  await page.getByRole('button', { name: MISSIE.gaOpPad }).click({ timeout: 10_000 });

  // play it like a player: walk where the game points, click what it points at, answer a
  // choice with the option marked goed (the question on screen, any step), close a card
  const encounters = FIRST.stappen.flatMap((s) => ((s.skin as { encounters?: { vraag: string; vraagKnap?: string; opties: { label: string; goed: boolean }[] }[] }).encounters ?? []));
  const base = (await save(page))?.trials ?? {};
  const deadline = Date.now() + 7 * 60_000;
  let facts = 0;
  while (Date.now() < deadline) {
    if (await page.locator('.card.reward').isVisible().catch(() => false)) break;
    const h = await R<(Hint & { walk?: P2 & { r: number } }) | null>(page, 'r.playHint()');
    if (h?.walk) { await walkTo(page, h.walk, { stopDist: Math.max(0.8, h.walk.r * 0.8), timeout: 30_000 }); continue; }
    if (h) {
      let at = h;
      for (let i = 0; i < 12; i++) {
        await sleep(page, 150);
        const h2 = await R<Hint | null>(page, 'r.playHint()');
        if (!h2 || h2.id !== at.id) break;
        const still = Math.hypot(h2.x - at.x, h2.y - at.y) < 3; at = h2;
        if (still) break;
      }
      await page.mouse.click(at.x, at.y);
      await sleep(page, 350);
      continue;
    }
    const text = await page.evaluate(() => document.getElementById('ui')?.innerText ?? '');
    const enc = encounters.find((e) => text.includes(e.vraag) || (!!e.vraagKnap && text.includes(e.vraagKnap)));
    const right = enc?.opties.find((o) => o.goed)?.label;
    const answer = right ? page.getByRole('button', { name: right, exact: true }).filter({ visible: true }).first() : null;
    if (answer && await answer.isEnabled().catch(() => false)) { await answer.click(); await sleep(page, 500); continue; }
    const action = page.locator('.adv-action').filter({ visible: true }).first();
    if (await action.count()) { await action.click(); await sleep(page, 400); continue; }
    const card = page.getByRole('button', { name: /^(Verder|Klaar)$/ }).filter({ visible: true }).first();
    if (await card.count()) {
      if (await page.locator('.card.fact').isVisible().catch(() => false)) { facts += 1; await sleep(page, 700); await snap(page, `fact-${facts}`); }
      await card.click();
      await sleep(page, 400);
      continue;
    }
    await sleep(page, 250);
  }
  const trials = (await save(page))?.trials ?? {};
  expect(FIRST.stappen.every((s) => (trials[s.ef] ?? 0) > (base[s.ef] ?? 0)), `mission 1 played to the end (trials ${JSON.stringify(trials)})`).toBe(true);

  // the reward: "Missie klaar!", the praise, the knap woord
  const reward = page.locator('.card.reward');
  await expect(reward).toBeVisible();
  await sleep(page, 1_500);
  await snap(page, 'reward');
  await page.getByRole('button', { name: MISSIE.kijkWatJeVond }).click();

  // the first clue: what it is, that it is in the sporenboek, and where that is
  const clue = page.locator('.card.wildcam');
  await expect(clue).toBeVisible({ timeout: 10_000 });
  await expect(clue.locator('.cw-boek')).toHaveText(MISSIE.clueBoek);
  await expect(clue.locator('.cw-waar'), 'the first clue says where the sporenboek is').toHaveText(MISSIE.clueWaar);
  await sleep(page, 2_000);
  await snap(page, 'clue');

  const seen = await everyLineSpoken(page, 'mission 1 → reward → clue');
  const where = new Set(seen.map((s) => s.where));
  for (const w of ['fact-text', 'reunion-text', 'reward-lof', 'rk-word', 'card-title', 'cb-clue-title', 'cb-clue-text', 'cw-boek', 'cw-waar']) expect(where.has(w), `a "${w}" line was seen`).toBe(true);
  expect(facts, 'the fact cards came between the games').toBeGreaterThan(0);
  fs.writeFileSync(path.join(dir, 'LINES.txt'), seen.map((s) => `${(s.at / 1000).toFixed(1)}s ${s.where}: ${s.line}`).join('\n'));

  // on patrol again; the sporenboek it pointed at is in Pauze
  await page.getByRole('button', { name: MISSIE.verderPatrouille }).click();
  await expect.poll(() => R<string>(page, 'r.screen'), { timeout: 10_000 }).toBe('world');
  expect(errors).toEqual([]);
});
