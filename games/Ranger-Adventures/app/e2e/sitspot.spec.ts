import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors } from './helpers';
import { R, sleep, walkTo, type Hint, type P2 } from './golden-lib';
import { ROEP_COPY } from '../src/engines/roep';

/**
 * Sit-spot / "Ken je roep" E2E (WORLD-PLAN W6.4b2). A bench by the vogelkijkhut is
 * the diegetic entry to the perception slice: the ranger walks up to it with the arrow
 * keys, and acting on the affordance plays roep3d IN-PLACE (`missionView === '3d'`)
 * without the world being torn down (`leaveWorld` is never called: `screen` stays
 * 'world'). The card (roep3d.ts: `.p3-bottom.roep3d .p3-card`, its read-aloud
 * `.p3-speak` and play-the-call `.p3-call`) carries each call as text and sound. The
 * beat is played to the end with REAL mouse clicks on the bird the engine says a
 * perfect player picks (`__ranger.playHint()`, as golden.spec does), and the slice
 * resolves back to free-roam in place.
 */

test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });

/** Drive title → avatar → world (W2.1: world is the front door). */
async function enterWorld(page: Page): Promise<void> {
  await page.goto('/?dev=1');
  await page.getByRole('button', { name: 'Begin' }).click({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Dit is mijn ranger' }).click({ timeout: 30_000 });
  await expect.poll(() => R<string>(page, 'r.screen'), { timeout: 60_000 }).toBe('world');
  await expect.poll(() => R<P2 | null>(page, 'r.pos()'), { timeout: 30_000 }).not.toBeNull();
}

test('sitspot: bench by the vogelkijkhut plays a full "Ken je roep" beat in-world (3D) with real clicks', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await enterWorld(page);

  // 1) walk to the sit-spot with the arrow keys: proximity surfaces the "listen" affordance.
  const spot = await R<{ x: number; z: number; near: boolean } | null>(page, 'r.sitSpot()');
  expect(spot, 'sitSpot() available in world').not.toBeNull();
  const walk = await walkTo(page, spot!, { stopDist: 1.0, timeout: 120_000 });
  expect(['arrived', 'until'], `walked to the bench (${walk.res} at ${walk.end.x.toFixed(1)}, ${walk.end.z.toFixed(1)})`).toContain(walk.res);
  await expect.poll(async () => (await R<{ near: boolean } | null>(page, 'r.sitSpot()'))?.near, { timeout: 5_000 }).toBe(true);
  const playBtn = page.locator('.explore-sit-play');
  await expect(playBtn, 'the sit-spot affordance shows at the bench').toBeVisible();
  // W6.5 tone-gate: the NEW sit-spot entry button is a ≥56px tap target.
  const sitBox = await playBtn.boundingBox();
  expect(sitBox, 'sit-spot button has a bounding box').not.toBeNull();
  expect(Math.min(sitBox!.width, sitBox!.height), 'sit-spot button ≥56px').toBeGreaterThanOrEqual(56);
  await shot(page, 'sitspot-at-bench');

  // 2) act on it → the roep slice plays IN-PLACE, so the resolved view is 3D and the
  // world must SURVIVE (no leaveWorld → screen stays 'world', scene still live).
  // note every line the card shows (each is up for a moment only)
  await page.evaluate(() => {
    const w = window as unknown as { __roepLines: string[] };
    w.__roepLines = [];
    new MutationObserver(() => {
      const t = (document.querySelector('.p3-bottom.roep3d .p3-text') as HTMLElement | null)?.innerText;
      if (t && w.__roepLines[w.__roepLines.length - 1] !== t) w.__roepLines.push(t);
    }).observe(document.getElementById('ui')!, { childList: true, subtree: true, characterData: true });
  });
  await playBtn.click();
  await expect
    .poll(() => R<string | null>(page, 'r.missionView'), { timeout: 20_000, message: 'roep slice plays 3D in-place' })
    .toBe('3d');
  expect(await R<string>(page, 'r.screen'), 'world survives behind the slice').toBe('world');
  expect(await R<P2 | null>(page, 'r.pos()'), 'world scene still live during the slice').not.toBeNull();
  // the roep card: the call as words, with read-aloud and play-the-call (once the birds sit)
  const card = page.locator('.p3-bottom.roep3d .p3-card');
  await expect(card.locator('.p3-call'), 'the first call is up, as words and sound').toBeVisible({ timeout: 30_000 });
  // W6.5 tone-gate: the roep-slice controls (read-aloud + play-the-call) are ≥56px too.
  for (const sel of ['.p3-bottom.roep3d .p3-speak', '.p3-bottom.roep3d .p3-call']) {
    const loc = page.locator(sel);
    await expect(loc, `${sel} visible`).toBeVisible();
    const b = await loc.boundingBox();
    expect(b, `${sel} has a bounding box`).not.toBeNull();
    expect(Math.min(b!.width, b!.height), `${sel} ≥56px`).toBeGreaterThanOrEqual(56);
  }
  await shot(page, 'sitspot-roep-3d');

  // 3) play the whole beat like a player: listen, then click the bird that called
  // (where the engine says a perfect player clicks: playHint, projected with the live camera).
  let clicks = 0;
  const t0 = Date.now();
  while ((await R<string | null>(page, 'r.missionView')) === '3d' && Date.now() - t0 < 120_000) {
    const h = await R<Hint | null>(page, 'r.playHint()');
    if (!h) { await sleep(page, 250); continue; }
    expect(h.onScreen && h.reachesCanvas, `the calling bird "${h.id}" can be clicked (on screen, not under ${h.blocker})`).toBe(true);
    await page.mouse.click(h.x, h.y);
    clicks += 1;
    await expect.poll(async () => (await R<Hint | null>(page, 'r.playHint()'))?.id ?? null, { timeout: 5_000, message: `a click on the calling bird "${h.id}" answers the round` })
      .not.toBe(h.id).catch(() => { /* the next round may call the same bird: the round counter below judges */ });
    await sleep(page, 300);
  }
  expect(clicks, 'every round of the beat was answered with a click').toBeGreaterThanOrEqual(3);
  const lines = await page.evaluate(() => (window as unknown as { __roepLines: string[] }).__roepLines);
  expect(lines.filter((l) => l === ROEP_COPY.goed).length, `every click was the right bird (card lines: ${lines.join(' | ')})`).toBe(clicks);
  expect(lines, 'the beat ends with its closing line').toContain(ROEP_COPY.klaar);

  // 4) the beat resolves back to free-roam IN-PLACE: missionView clears, the world
  // was never torn down, and the explore HUD returns with the sit-spot affordance
  // re-surfaced (the ranger is still at the bench).
  await expect
    .poll(() => R<string | null>(page, 'r.missionView'), { timeout: 20_000, message: 'the beat resolves back to free-roam' })
    .toBeNull();
  expect(await R<string>(page, 'r.screen'), 'still in the world after the beat').toBe('world');
  expect(await R<P2 | null>(page, 'r.pos()'), 'world survived the whole beat').not.toBeNull();
  await expect(page.locator('.explore-hud'), 'the explore HUD returns after the beat').toBeVisible();
  await expect(playBtn, 'the sit-spot affordance is back at the bench').toBeVisible();
  await shot(page, 'sitspot-after-beat');

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
