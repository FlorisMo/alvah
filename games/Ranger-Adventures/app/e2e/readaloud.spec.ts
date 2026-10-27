import { test, expect, type Page } from '@playwright/test';
import { AREA_VELUWE } from '../src/content/veluwe';
import { SAY } from '../src/content/screens';
import { R, sleep, walkTo, type Hint, type P2 } from './golden-lib';

/**
 * Read-aloud on the menu screens, the ranger maker at laptop size, and Enter on the
 * zoeken find card — wave-4 regressions (child:B12, child:B8, parent:B7), played with
 * the real mouse and keys from a fresh save at 1280×800:
 *
 *   RANGER_PORT=<port> npx playwright test e2e/readaloud.spec.ts --project=chromium
 *
 * What the game says is read from the narrator's `ranger:say` event (the words the
 * voice gets); the dev hook is only READ.
 */

test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });

const spoken = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __said: string[] }).__said.slice());
const clearSpoken = (page: Page): Promise<void> =>
  page.evaluate(() => { (window as unknown as { __said: string[] }).__said.length = 0; });

async function said(page: Page, what: string | RegExp, message: string): Promise<void> {
  await expect.poll(async () => (await spoken(page)).some((t) => (typeof what === 'string' ? t.includes(what) : what.test(t))),
    { timeout: 6_000, message }).toBe(true);
}

test('menus read aloud, the maker shows every choice, Enter presses Verder after a find @readaloud', async ({ page }) => {
  test.setTimeout(6 * 60_000);
  await page.addInitScript(() => {
    const w = window as unknown as { __said: string[] };
    w.__said = [];
    window.addEventListener('ranger:say', (e) => { w.__said.push((e as CustomEvent<string>).detail); });
  });
  await page.goto('/?dev=1');

  // --- the title: a 🔊 beside Begin says what the screen is (child:B12)
  const begin = page.getByRole('button', { name: 'Begin', exact: true });
  await begin.waitFor({ state: 'visible', timeout: 30_000 });
  await page.getByRole('button', { name: 'Lees voor' }).first().click();
  await said(page, 'Word de nieuwe boswachter', 'the title 🔊 reads the title aloud');
  await begin.click();

  // --- the maker: all four groups on screen at 1280×800, no scrolling needed (child:B8)
  const klaar = page.getByRole('button', { name: 'Dit is mijn ranger' });
  await klaar.waitFor({ state: 'visible', timeout: 30_000 });
  await sleep(page, 600);
  const panel = page.locator('.avatar-creator');
  expect(await panel.evaluate((el) => el.scrollHeight <= el.clientHeight + 1), 'the maker panel does not scroll').toBe(true);
  for (const g of ['Huid', 'Haar', 'Ranger-jas', 'Ogen']) {
    const inView = await page.locator('.av-legend', { hasText: g }).evaluate((el) => {
      const r = el.getBoundingClientRect();
      const box = (el.closest('.avatar-creator') as HTMLElement).getBoundingClientRect();
      return r.top >= box.top - 1 && r.bottom <= box.bottom + 1 && r.bottom <= innerHeight;
    });
    expect(inView, `the maker shows "${g}" without scrolling`).toBe(true);
  }
  const lastSwatch = page.locator('.av-swatch').last();
  expect(await lastSwatch.evaluate((el) => el.getBoundingClientRect().bottom <= (el.closest('.avatar-creator') as HTMLElement).getBoundingClientRect().bottom + 1),
    'the last eye colour is on screen').toBe(true);
  await said(page, 'Maak je ranger. Hoi, ranger Alvah!', 'the maker says its title and greets the ranger by name');
  await clearSpoken(page);
  await page.locator('.av-swatch[data-kenmerk="haar"]').nth(3).hover();
  await said(page, /Haar: /, 'a swatch says its own label when the mouse rests on it');
  await klaar.click();
  await expect.poll(() => R<string>(page, 'r.screen'), { timeout: 60_000 }).toBe('world');
  await expect.poll(() => R<P2 | null>(page, 'r.pos()'), { timeout: 30_000 }).not.toBeNull();
  await sleep(page, 1_500);

  // --- Pauze (Esc) reads its heading; every choice says its words on hover (child:B12)
  await clearSpoken(page);
  await page.keyboard.press('Escape');
  await expect(page.getByText('Wat wil je doen?')).toBeVisible({ timeout: 5_000 });
  await said(page, SAY.pauze, 'Pauze reads "Wat wil je doen?" aloud');
  await page.locator('.ra-chip', { hasText: 'Instellingen' }).hover();
  await said(page, 'Instellingen', 'a Pauze choice says its words on hover');
  expect((await spoken(page)).filter((t) => /[\p{Extended_Pictographic}]/u.test(t)), 'a hover label never says its icon').toEqual([]);
  await page.getByRole('button', { name: 'Terug naar de open plek' }).click();
  await sleep(page, 800);

  // --- the missiebord: its heading, and a card says its title on hover (child:B12)
  const board = await R<P2 | null>(page, 'r.board()');
  expect(board, 'a missiebord').not.toBeNull();
  await walkTo(page, board!, { stopDist: 1.6, timeout: 60_000 });
  await clearSpoken(page);
  await page.getByRole('button', { name: 'Bekijk het missiebord' }).click();
  await said(page, SAY.bord, 'the missiebord reads its heading aloud');
  const mission = AREA_VELUWE.missies[0];
  await page.locator(`.mission-card[data-id="${mission.id}"]`).hover();
  await said(page, mission.titel, 'a mission card says its title on hover');

  // --- a quick click (before the hover label is due) opens the briefing, and no stale
  //     label talks over the briefing's voice afterwards (V1)
  await page.mouse.move(5, 5, { steps: 4 });
  await sleep(page, 300);
  const box = (await page.locator(`.mission-card[data-id="${mission.id}"]`).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 });
  await sleep(page, 200);
  await clearSpoken(page);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await said(page, mission.titel, 'the briefing is read aloud');
  await sleep(page, 1_200);
  const afterClick = await spoken(page);
  expect(afterClick.length, `only the briefing is said after the click, got ${JSON.stringify(afterClick)}`).toBe(1);
  await page.getByRole('button', { name: 'Ga op pad' }).click();
  // run 6: the frisling is an adventure in the world: he walks after the squeak (a walk
  // hint: the arrow keys) until the search offers the piglet to click
  let hint: Hint | null = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 90_000) {
    hint = await R<Hint | null>(page, 'r.playHint()');
    if (hint?.walk) {
      const id = hint.id;
      await walkTo(page, { x: hint.walk.x, z: hint.walk.z }, { stopDist: hint.walk.r, timeout: 60_000, stopWhen: async () => (await R<Hint | null>(page, 'r.playHint()'))?.id !== id });
      continue;
    }
    if (hint?.onScreen) break;
    await sleep(page, 250);
  }
  expect(hint?.onScreen && !hint.walk, 'the search offers the piglet to click').toBe(true);
  await sleep(page, 800);
  hint = await R<Hint | null>(page, 'r.playHint()');
  await clearSpoken(page);
  await page.mouse.click(hint!.x, hint!.y);
  await said(page, 'Daar is hij', 'the find is read aloud');
  // the fact after the find: its "Verder" is the screen's primary, so Enter presses it
  // even though the last thing he did was click the world (FLOW keys.ts)
  const verder = page.locator('.fact .btn-start');
  await expect(verder, 'the fact card after the find').toBeVisible({ timeout: 15_000 });
  await page.keyboard.press('Enter');
  await expect(verder, 'Enter pressed "Verder"').toBeHidden({ timeout: 5_000 });
});

test.describe('on a tablet (touch, 1080×810)', () => {
  test.use({ viewport: { width: 1080, height: 810 }, hasTouch: true, isMobile: true });

  test('a tapped name chip says the new greeting whole; a tapped swatch says its label @readaloud', async ({ page }) => {
    test.setTimeout(2 * 60_000);
    await page.addInitScript(() => {
      const w = window as unknown as { __said: string[] };
      w.__said = [];
      window.addEventListener('ranger:say', (e) => { w.__said.push((e as CustomEvent<string>).detail); });
    });
    await page.goto('/?dev=1');
    await page.getByRole('button', { name: 'Begin', exact: true }).tap({ timeout: 40_000 });
    await page.getByRole('button', { name: 'Dit is mijn ranger' }).waitFor({ state: 'visible', timeout: 30_000 });
    await sleep(page, 1_500);
    // a tap's mouseenter comes after the press: the chip's own label must not follow it
    // (it would cut the greeting off 0.45 s in)
    for (const naam of ['Sam', 'Bo']) {
      await clearSpoken(page);
      await page.getByRole('button', { name: naam, exact: true }).tap();
      await sleep(page, 1_500);
      expect(await spoken(page), `the ${naam} chip says only the new greeting`).toEqual([`Hoi, ranger ${naam}!`]);
    }
    // a swatch is quiet when pressed: on a tablet the tap is how its label is heard
    await clearSpoken(page);
    const swatch = page.locator('.av-swatch[data-kenmerk="haar"]').nth(2);
    await swatch.tap();
    await sleep(page, 1_500);
    expect(await spoken(page), 'a tapped swatch says its label').toEqual([(await swatch.getAttribute('aria-label')) ?? '?']);
  });
});
