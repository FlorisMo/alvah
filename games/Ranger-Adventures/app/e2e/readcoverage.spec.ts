import { test, expect, type Page, type TestInfo } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { R, walkTo, sleep, save, type P2, type Hint } from './golden-lib';
import { AREA_VELUWE } from '../src/content/veluwe';
import { MISSIE, HUB } from '../src/content/copy';
import { SAY } from '../src/content/screens';
import { metNaam } from '../src/content/mentor';

/**
 * READ-ALOUD COVERAGE (run 6, FLOW P4): every line a child sees appear is also read aloud,
 * played like a player (real clicks and keys, a fresh browser):
 *
 *   1. the first visit: the title (nothing is said before the player touches the page,
 *      the voice starts at his first click), the maker, Bram's greeting, the lessons, the
 *      hook, the mission marker's prompt, the briefing;
 *   2. a save that knows the first minute: mission 1 played with the real mouse (the play
 *      hints) to its reunion, the fact cards, the reward and the first clue, which says
 *      where the sporenboek is; then that sporenboek: the newest clue and the note under
 *      it are read and lit up, each fact by its own 🔊, and no line on the clue card or the
 *      book is over 7 words as the browser draws it;
 *   3. a first visit that starts with Enter: the maker speaks, the title never does.
 *
 * A real first visit: Playwright's page counts as touched from the start
 * (navigator.userActivation.hasBeenActive is true at load), so the title's wait for the
 * first press would never run. Tests 1 and 3 make the page untouched until the first
 * pointerdown or keydown, as a browser does for a child who just opened the link.
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
 * question and answer, and in the sporenboek the note under the clues and the facts. Not
 * lines to read: an empty frame's "Nog niet gevonden" (the note says how many are still to
 * find), the wayfinding chip (a live compass: its title
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
  '.cb-note .zin', '.cb-veld-text .zin',
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
      'cb-clue-title', 'cw-boek', 'cw-waar', 'briefing-line', 'wb-feedback', 'fact-text', 'reunion-text', 'cb-clue-text', 'wb-prompt',
      'cb-note', 'cb-veld-text'];
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

/** A real first visit: the page is untouched until the first press (see the header). */
async function untouchedUntilFirstPress(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let active = false;
    const on = (): void => { active = true; };
    addEventListener('pointerdown', on, true);
    addEventListener('keydown', on, true);
    Object.defineProperty(Navigator.prototype, 'userActivation', {
      configurable: true,
      get: () => ({ hasBeenActive: active, isActive: active }),
    });
  });
}

/** Every utterance so far (the spy's). */
const utterances = (page: Page): Promise<Said[]> =>
  page.evaluate(() => (window as unknown as { __said: Said[] }).__said.slice());
/** The page's clock now (the spy's time line). */
const pageNow = (page: Page): Promise<number> => page.evaluate(() => performance.now());

/** Every line inside `sel` with more than 7 words, measured as the browser draws it: each
 *  word's Range rect, grouped by its block and the top of its line box. */
async function longLines(page: Page, sel: string): Promise<string[]> {
  return page.evaluate((s: string) => {
    const root = document.querySelector(s);
    if (!root) return [`no ${s} on screen`];
    const blocks = new Map<Element, { top: number; words: string[] }[]>();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const host = n.parentElement;
      if (!host || host.closest('[aria-hidden="true"], [hidden]') || getComputedStyle(host).visibility === 'hidden') continue;
      let block: Element | null = host;
      while (block && getComputedStyle(block).display.startsWith('inline')) block = block.parentElement;
      if (!block) continue;
      const text = n.textContent ?? '';
      for (const m of text.matchAll(/\S+/g)) {
        if (!/[\p{L}\p{N}]/u.test(m[0])) continue; // a lone "·" is not a word
        const r = document.createRange();
        r.setStart(n, m.index ?? 0);
        r.setEnd(n, (m.index ?? 0) + m[0].length);
        const rect = r.getBoundingClientRect();
        if (rect.width < 1) continue;
        const lines = blocks.get(block) ?? [];
        blocks.set(block, lines);
        const line = lines.find((l) => Math.abs(l.top - rect.top) < 6);
        if (line) line.words.push(m[0]);
        else lines.push({ top: rect.top, words: [m[0]] });
      }
    }
    const out: string[] = [];
    for (const [block, lines] of blocks) {
      for (const l of lines) if (l.words.length > 7) out.push(`${l.words.length} words [${String(block.className).split(' ')[0]}] "${l.words.join(' ')}"`);
    }
    return out;
  }, sel);
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

/** Walk (real arrow keys) into the ring of mission 1, however long it takes under load:
 *  stop as soon as he stands in it, and walk again if he overshot. */
async function toFirstMarker(page: Page): Promise<void> {
  const marker = (await R<{ x: number; z: number; missionId: string }[]>(page, 'r.markers()')).find((m) => m.missionId === FIRST.id)!;
  for (let i = 0; i < 4 && (await R<string | null>(page, 'r.nearId()')) !== FIRST.id; i++) {
    await walkTo(page, marker, { stopDist: 1.2, until: (s) => s.near === FIRST.id, timeout: 90_000 });
    await sleep(page, 500);
  }
  expect(await R<string | null>(page, 'r.nearId()'), 'he stands in the ring of mission 1').toBe(FIRST.id);
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
  await untouchedUntilFirstPress(page);
  await watch(page);
  await page.goto('/?dev=1');

  // the title: the voice may only start at the first touch (nothing is said before it);
  // a curious child clicks the sky, and the title is said
  const begin = page.getByRole('button', { name: 'Begin', exact: true });
  await begin.waitFor({ state: 'visible', timeout: 40_000 });
  await sleep(page, 1_500);
  expect((await utterances(page)).map((u) => u.text), 'nothing is said before the first touch').toEqual([]);
  await page.mouse.click(640, 40);
  await expect.poll(async () => (await utterances(page)).map((u) => u.text), { timeout: 5_000, message: 'the sky click says the title' }).toContain(SAY.title);
  await sleep(page, 400);
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
  await toFirstMarker(page);
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
  await toFirstMarker(page);
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

  await everyLineSpoken(page, 'mission 1 → reward → clue');
  expect(await longLines(page, '.card.wildcam'), 'the clue card: no line over 7 words').toEqual([]);
  expect(facts, 'the fact cards came between the games').toBeGreaterThan(0);

  // the sporenboek it points at, one sentence a line: the newest clue (its title and text)
  // and the note under the cork are read and lit up; the note never repeats the clue
  const opened = await pageNow(page);
  await page.getByRole('button', { name: MISSIE.bekijkBoek }).click();
  const boek = page.locator('.case-board');
  await expect(boek).toBeVisible({ timeout: 10_000 });
  const newest = boek.locator('.cb-clue.found').last();
  await expect.poll(() => newest.locator('.is-spoken').count(), { timeout: 10_000, intervals: [100], message: 'the newest clue lights up as it is read' }).toBeGreaterThan(0);
  const note = boek.locator('.cb-note-main');
  await expect.poll(() => note.locator('.is-spoken').count(), { timeout: 15_000, intervals: [100], message: 'the note lights up as it is read' }).toBeGreaterThan(0);
  await expect(note).toHaveText(HUB.nogMeer.replace('{aantal}', 'twee'));
  await snap(page, 'sporenboek');
  const bookLines = [
    ...(await newest.locator('.cb-clue-title').allTextContents()),
    ...(await newest.locator('.cb-clue-text .zin').allTextContents()),
    ...(await note.locator('.zin').allTextContents()),
  ].map((t) => t.replace(/\s+/g, ' ').trim());
  const clueText = norm(await newest.locator('.cb-clue-text').innerText());
  expect(norm(await note.innerText()), 'the note does not repeat the clue').not.toContain(clueText);
  const bookSaid = (await utterances(page)).filter((u) => u.at >= opened).map((u) => norm(u.text)).join(' | ');
  expect(bookLines.filter((l) => !bookSaid.includes(norm(l))), 'every line of the sporenboek was read aloud').toEqual([]);
  expect(bookLines.length, 'the clue title, its lines and the note').toBeGreaterThanOrEqual(3);

  // each fact: its 🔊 reads it, lit up line by line
  const notes = boek.locator('.cb-veld-note');
  const nFacts = await notes.count();
  expect(nFacts, 'the facts from mission 1 are in the book').toBeGreaterThan(0);
  for (let i = 0; i < nFacts; i++) {
    const row = notes.nth(i);
    const at = await pageNow(page);
    await row.locator('.cb-veld-speak').click();
    await expect.poll(() => row.locator('.cb-veld-text .zin').first().locator('.is-spoken').count(), { timeout: 5_000, intervals: [100], message: `fact ${i + 1} lights up` }).toBeGreaterThan(0);
    const lines = (await row.locator('.cb-veld-text .zin').allTextContents()).map((t) => t.replace(/\s+/g, ' ').trim());
    expect(lines.length, `fact ${i + 1}: one sentence a line`).toBeGreaterThan(1);
    if (i === 0) await expect.poll(() => row.locator('.cb-veld-text .zin').nth(1).locator('.is-spoken').count(), { timeout: 10_000, intervals: [100], message: 'then its next line lights up' }).toBeGreaterThan(0);
    const factSaid = (await utterances(page)).filter((u) => u.at >= at).map((u) => norm(u.text)).join(' | ');
    expect(lines.filter((l) => !factSaid.includes(norm(l))), `fact ${i + 1} was read aloud`).toEqual([]);
  }
  expect(await longLines(page, '.case-board'), 'the sporenboek: no line over 7 words').toEqual([]);

  const seen = await everyLineSpoken(page, 'mission 1 → reward → clue → sporenboek');
  const where = new Set(seen.map((s) => s.where));
  for (const w of ['fact-text', 'reunion-text', 'reward-lof', 'rk-word', 'card-title', 'cb-clue-title', 'cb-clue-text', 'cw-boek', 'cw-waar', 'cb-note']) expect(where.has(w), `a "${w}" line was seen`).toBe(true);
  fs.writeFileSync(path.join(dir, 'LINES.txt'), seen.map((s) => `${(s.at / 1000).toFixed(1)}s ${s.where}: ${s.line}`).join('\n'));

  // on patrol again; the sporenboek is in Pauze
  await page.getByRole('button', { name: HUB.verderPatrouille }).click();
  await expect.poll(() => R<string>(page, 'r.screen'), { timeout: 10_000 }).toBe('world');
  expect(errors).toEqual([]);
});

test('a first visit that starts with Enter: the maker speaks, the title never does', async ({ page }, testInfo) => {
  test.setTimeout(2 * 60_000);
  shotsInto(testInfo, 'first-enter');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await untouchedUntilFirstPress(page);
  await watch(page);
  await page.goto('/?dev=1');
  const begin = page.getByRole('button', { name: 'Begin', exact: true });
  await begin.waitFor({ state: 'visible', timeout: 40_000 });
  await sleep(page, 1_500);
  expect((await utterances(page)).map((u) => u.text), 'nothing is said before the first key').toEqual([]);

  // Enter at once: it presses Begin, and the title's words (due at the first press) are
  // not said over the maker
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Dit is mijn ranger' }).waitFor({ state: 'visible', timeout: 30_000 });
  const maker = metNaam(SAY.maker, 'Alvah');
  await expect.poll(async () => (await utterances(page)).map((u) => u.text), { timeout: 10_000, message: 'the maker says its line' }).toContain(maker);
  await sleep(page, 1_500);
  await snap(page, 'maker');
  const all = (await utterances(page)).map((u) => u.text);
  expect(all.filter((t) => t.includes('Word de nieuwe boswachter')), 'the title is never said').toEqual([]);
  expect(all[0], 'the first words are the maker\'s').toBe(maker);
  expect(errors).toEqual([]);
});
