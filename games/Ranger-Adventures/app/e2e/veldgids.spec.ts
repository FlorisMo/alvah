import { test, expect, type Page } from '@playwright/test';
import { R, sleep, walkTo, MAX_DRAW_CALLS, type P2 } from './golden-lib';
import { VELDGIDS, REVEAL } from '../src/content/copy';

/**
 * Run 7 (veldgids): his field guide and the open world's small surprises, played with the
 * real mouse and keys at 1280×800:
 *
 *   RANGER_PORT=<port> npx playwright test e2e/veldgids.spec.ts --project=chromium
 *
 * 1. A seeded save with a few discoveries opens the gids from Pauze and from the hut:
 *    it opens where something is new, the arrow keys turn its pages (round and round),
 *    a found thing shows its real picture and its name (a rare one its gold rim, a new
 *    one its tag until seen), what is still out there a grey shape with its hint, read
 *    aloud on a pointer's rest; every target ≥ 56 px; Enter and Esc go back.
 * 2. A free-roam walk at `/?dev=1&seed=5&mood=gouden-uur` meets that visit's first
 *    surprise (the seed draws the buzzard first), sees its calm reveal (read aloud, the
 *    real animal's picture, where the veldgids is) and finds it in the gids.
 *
 * What the game says is read from a hook on `speechSynthesis.speak`; the dev hook is only
 * READ (`__ranger.surprise()` says where the surprise is, it never brings one).
 */

test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });

const GELEERD = { lopen: true, rennen: true, kijken: true, bram: true, haak: true, missiebord: true, raaf: true, jeep: true };

/** A practised save (the ranger made, the first minute learned), with `extra` on top. */
function seedSave(page: Page, extra: Record<string, unknown>): Promise<void> {
  const save = { ranger: { avatarGemaakt: true, avatar: { naam: 'Alvah' }, settings: { geleerd: GELEERD }, sfeer: { laatste: 'zonnig', sessies: 3 }, ...extra } };
  return page.addInitScript((s) => {
    try { if (!localStorage.getItem('alvah-ef-v1')) localStorage.setItem('alvah-ef-v1', s); } catch { /* fresh */ }
    const w = window as unknown as { __said: string[] };
    w.__said = [];
    const synth = window.speechSynthesis;
    if (synth) {
      const orig = synth.speak.bind(synth);
      synth.speak = (u: SpeechSynthesisUtterance) => { w.__said.push(u.text); try { orig(u); } catch { /* no voice */ } };
    }
  }, JSON.stringify(save));
}

const spoken = (page: Page): Promise<string[]> => page.evaluate(() => (window as unknown as { __said: string[] }).__said.slice());
async function said(page: Page, what: string | RegExp, message: string, timeout = 8_000): Promise<void> {
  await expect.poll(async () => (await spoken(page)).some((t) => (typeof what === 'string' ? t.includes(what) : what.test(t))),
    { timeout, message }).toBe(true);
}

async function enter(page: Page, query = ''): Promise<void> {
  await page.goto(`/?dev=1${query}`);
  await page.getByRole('button', { name: 'Begin', exact: true }).click({ timeout: 60_000 });
  await expect.poll(() => R<string>(page, 'r.screen'), { timeout: 60_000 }).toBe('world');
  await expect.poll(() => R<P2 | null>(page, 'r.pos()'), { timeout: 30_000 }).not.toBeNull();
  await sleep(page, 1_200);
}

/** Every button on the card at least 56 px both ways (Alvah's targets). */
async function targetsOk(page: Page, sel: string): Promise<string[]> {
  return page.locator(sel).evaluateAll((els) => els
    .filter((e) => (e as HTMLElement).offsetParent !== null && getComputedStyle(e).visibility !== 'hidden')
    .map((e) => { const r = e.getBoundingClientRect(); return { c: e.className, w: r.width, h: r.height }; })
    .filter((b) => b.w < 56 || b.h < 56)
    .map((b) => `${b.c} ${Math.round(b.w)}×${Math.round(b.h)}`));
}

test('the veldgids opens from Pauze and the hut; pages, pictures, shapes and hints; Enter and Esc', async ({ page }) => {
  test.setTimeout(4 * 60_000);
  const t = Date.now();
  await seedSave(page, {
    voltooid: { frisling: true },
    companion: { rescued: true, naam: 'Kroa', soort: 'raaf', fase: 'baby', bond: 10, kunstjes: [], meeOpMissie: false },
    ontdekt: { 'frisling.frisling': { t, n: 1 }, 'wereld.buizerd': { t, n: 2, g: 1 }, 'wereld.edelhert': { t, n: 1 } },
  });
  await enter(page);

  // Pauze: the fifth tile, with a small "nieuw" tag (never a count)
  await page.locator('.explore-pause').click();
  const tile = page.locator('.ra-overlay .ph-veldgids');
  await expect(tile).toBeVisible();
  await expect(tile.locator('.vg-tile-new')).toHaveText(VELDGIDS.nieuw);
  expect(await tile.innerText(), 'no number on the tile').not.toMatch(/\d/);
  await tile.click();

  // it opens where something is new: the wallow's page, the piglet found, its real picture
  const card = page.locator('.ra-overlay .card.veldgids');
  await expect(card).toBeVisible();
  await expect(card.locator('.vg-title')).toHaveText(VELDGIDS.plek.frisling);
  await said(page, `${VELDGIDS.zegOpen} ${VELDGIDS.plek.frisling}`, 'the gids says what it is and the place');
  const big = card.locator('.vg-entry[data-id="frisling.frisling"]');
  await expect(big).toHaveClass(/is-found/);
  await expect(big.locator('.vg-new')).toHaveText(VELDGIDS.nieuw);
  await expect(big.locator('.vg-name')).toHaveText('De big');
  await expect(big.locator('img.vg-img'), 'the real model as a picture').toBeVisible({ timeout: 15_000 });
  expect(await card.innerText(), 'no "x/y" count on the gids').not.toMatch(/\d+\s*\/\s*\d+/);

  // the arrow keys turn the page round: ← from the first page is "Overal"
  await page.keyboard.press('ArrowLeft');
  await expect(card.locator('.vg-title')).toHaveText(VELDGIDS.plek.wereld);
  await said(page, VELDGIDS.plek.wereld, 'turning the page says the place');
  const buizerd = card.locator('.vg-entry[data-id="wereld.buizerd"]');
  await expect(buizerd).toHaveClass(/is-found/);
  await expect(buizerd.locator('.vg-new'), 'seen in the gids before: no tag').toHaveCount(0);
  const stag = card.locator('.vg-entry[data-id="wereld.edelhert"]');
  await expect(stag).toHaveClass(/is-rare/);
  await expect(stag).toHaveClass(/is-found/);
  // what is still out there: a grey shape, its hint and a speaker; a pointer's rest reads it
  const specht = card.locator('.vg-entry[data-id="wereld.specht"]');
  await expect(specht).toHaveClass(/is-missing/);
  await expect(specht.locator('.vg-hint')).toHaveText('Wie tikt er op een boom?');
  await expect(specht.locator('.vg-hear')).toBeVisible();
  await expect(specht.locator('img.vg-img'), 'its shape').toBeVisible({ timeout: 15_000 });
  await specht.hover();
  await said(page, 'Wie tikt er op een boom?', 'a hint is read aloud when the pointer rests on it');
  // the dots: a picture of how much of the page he found
  expect(await card.locator('.vg-dot').count()).toBe(await card.locator('.vg-entry').count());
  expect(await card.locator('.vg-dot.on').count()).toBe(2);
  // a tap on a found one says its name (the iPad's way to hear it)
  await stag.click();
  await said(page, 'Het edelhert', 'tapping a found thing says its name');

  // every target ≥ 56 px: the arrows, the tiles, the 🔊, Terug
  expect(await targetsOk(page, '.ra-overlay .card.veldgids button'), 'targets under 56 px').toEqual([]);
  await page.keyboard.press('ArrowRight');
  await expect(card.locator('.vg-title')).toHaveText(VELDGIDS.plek.frisling);

  // Enter: back to Pauze; the "nieuw" is gone now that he has seen it
  await page.keyboard.press('Enter');
  await expect(page.locator('.ra-overlay .ph-veldgids')).toBeVisible();
  await expect(page.locator('.ra-overlay .ph-veldgids .vg-tile-new')).toHaveCount(0);

  // the hut: the veldgids chip; Esc brings him back to the hut
  await page.locator('.ra-overlay .ph-companion').click();
  await expect(page.locator('.ra-overlay .card.cabin')).toBeVisible();
  const chip = page.locator('.ra-overlay .cabin-gids');
  await expect(chip).toBeVisible();
  expect(await targetsOk(page, '.ra-overlay .card.cabin .cabin-gids'), 'the hut chip ≥ 56 px').toEqual([]);
  await chip.click();
  await expect(card).toBeVisible();
  await expect(card.locator('.vg-entry.is-new'), 'nothing new any more').toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('.ra-overlay .card.cabin')).toBeVisible();
});

test('a free-roam walk meets the seed\'s surprise: a calm reveal, read aloud, then it is in the gids', async ({ page }) => {
  test.setTimeout(5 * 60_000);
  await seedSave(page, { voltooid: { frisling: true } });
  // seed 5's visit draws the buzzard first (surprises-math: surpriseOrder); the golden hour
  await enter(page, '&seed=5&mood=gouden-uur');
  test.info().annotations.push({ type: 'seed', description: 'replay: /?dev=1&seed=5&mood=gouden-uur' });
  // a few steps out of the clearing, then he stands and looks
  await walkTo(page, { x: 0, z: -9 }, { stopDist: 1.5, timeout: 30_000 });

  // the visit's first surprise comes in free roam after a little while
  await expect.poll(() => R<string | null>(page, 'r.surprise()?.active?.id ?? null'), { timeout: 90_000, message: 'a surprise comes' }).toBe('buizerd');
  // he meets it (sees it low over the heath, or hears its mew)
  await expect.poll(() => R<string | null>(page, 'r.surprise()?.active?.met ?? null'), { timeout: 60_000, message: 'he saw or heard it' }).not.toBeNull();
  // the budget holds with it in the picture
  const dc = await R<number>(page, 'r.drawCalls()');
  expect(dc, 'draw calls with a surprise in view').toBeLessThan(MAX_DRAW_CALLS);

  // its reveal: calm, the real animal's picture, its name, where the gids is, read aloud once
  const reveal = page.locator('#ui > .reveal');
  await expect(reveal).toHaveAttribute('data-id', 'wereld.buizerd', { timeout: 30_000 });
  await expect(reveal).toContainText(REVEAL.nieuw);
  await expect(reveal).toContainText('De buizerd');
  await expect(reveal.locator('.rv-where')).toHaveText(REVEAL.waar);
  await expect(reveal.locator('img.rv-img'), 'the real model as its picture').toBeVisible({ timeout: 10_000 });
  await said(page, `${REVEAL.nieuw} De buizerd. ${REVEAL.waar}`, 'the reveal is read aloud', 10_000);
  expect(await reveal.evaluate((el) => getComputedStyle(el).pointerEvents), 'never in the way of a click').toBe('none');
  // only one at a time
  expect(await page.locator('#ui > .reveal').count()).toBe(1);
  const found = await R<{ found: string[] }>(page, 'r.discoveries()');
  expect(found.found).toContain('wereld.buizerd');

  // it is in his veldgids, new
  await page.locator('.explore-pause').click();
  await page.locator('.ra-overlay .ph-veldgids').click();
  const card = page.locator('.ra-overlay .card.veldgids');
  await expect(card.locator('.vg-title')).toHaveText(VELDGIDS.plek.wereld);
  await expect(card.locator('.vg-entry[data-id="wereld.buizerd"]')).toHaveClass(/is-new/);
});
