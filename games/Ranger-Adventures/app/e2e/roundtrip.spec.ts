import { test, expect, type Page } from '@playwright/test';
import { R, sleep } from './golden-lib';

/**
 * The title round trip (Pauze → "Naar het hoofdmenu" → Begin), played with real clicks,
 * three times over. The title is a shot of the one live world (world/Presenter.ts), so:
 *  - it is the SAME world instance every time: nothing is torn down or rebuilt, and the
 *    GPU memory stays flat per trip (a rebuild leaked 22-36 textures a trip: LEAK-1);
 *  - the title looks the same as at boot: the ranger back on the spawn clearing, his
 *    cabin beside him (parent:B9 lost them on a return);
 *  - the title block sits over the sky and never covers the ranger.
 * Reduced motion holds the title's drift, the animals and the ranger's idle still, so the
 * boot title and the returned title are the same picture.
 */

test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });

type Mem = { tex: number; geo: number };
const mem = (page: Page): Promise<Mem> => page.evaluate(() => {
  const info = (window as unknown as { __stage: { renderer: { info: { memory: { textures: number; geometries: number } } } } }).__stage.renderer.info;
  return { tex: info.memory.textures, geo: info.memory.geometries };
});

/** The lower half of the title: the ranger on the track, his cabin, the missiebord. */
const LOWER = { x: 0, y: 380, width: 1280, height: 400 };

/** Mean absolute difference (0-255) between two same-size PNG screenshots, per 40 px block
 *  (a missing cabin or ranger moves whole blocks; a pixel of anti-aliasing does not). */
function blockDiff(page: Page, a: Buffer, b: Buffer): Promise<number> {
  return page.evaluate(async ({ a, b }) => {
    const px = async (b64: string) => {
      const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
      const cv = new OffscreenCanvas(img.width, img.height); const g = cv.getContext('2d')!;
      g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height).data;
    };
    const img = new Image(); img.src = `data:image/png;base64,${a}`; await img.decode();
    const W = img.width, H = img.height, N = 40;
    const [pa, pb] = [await px(a), await px(b)];
    let sum = 0, n = 0;
    for (let by = 0; by < H; by += N) for (let bx = 0; bx < W; bx += N) {
      const ma = [0, 0, 0], mb = [0, 0, 0]; let k = 0;
      for (let y = by; y < Math.min(H, by + N); y++) for (let x = bx; x < Math.min(W, bx + N); x++) {
        const i = (y * W + x) * 4; k++;
        for (let c = 0; c < 3; c++) { ma[c] += pa[i + c]; mb[c] += pb[i + c]; }
      }
      for (let c = 0; c < 3; c++) sum += Math.abs(ma[c] - mb[c]) / k;
      n += 3;
    }
    return sum / n;
  }, { a: a.toString('base64'), b: b.toString('base64') });
}

async function inWorld(page: Page): Promise<void> {
  await expect.poll(async () => (await R<string>(page, 'r.screen')) === 'world' && (await R<unknown>(page, 'r.pos()')) !== null, { timeout: 60_000 }).toBe(true);
  await sleep(page, 2_500); // the glide into play has ended
}

/** The title block's bottom edge stays above the ranger's head (px from the top). */
async function titleClearOfRanger(page: Page): Promise<{ blockBottom: number; rangerTop: number }> {
  const box = await page.locator('.title-block').boundingBox();
  const c = await R<{ avatarScreen: { y: number; heightFrac: number } } | null>(page, 'r.cam()');
  const rangerTop = c ? ((1 - (c.avatarScreen.y + c.avatarScreen.heightFrac)) / 2) * 800 : 0;
  return { blockBottom: box ? box.y + box.height : 800, rangerTop };
}

test('title round trip: the same world, the same title, the ranger back home', async ({ page, context }) => {
  test.setTimeout(4 * 60_000);
  await context.addInitScript(() => {
    if (!localStorage.getItem('alvah-ef-v1')) localStorage.setItem('alvah-ef-v1', JSON.stringify({ ranger: { avatarGemaakt: true, settings: { wereldHintGezien: true, tikHintGezien: true } } }));
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?dev=1');
  await expect.poll(() => R<boolean>(page, 'r.titleReady()'), { timeout: 30_000, message: 'the veil lifts onto the title' }).toBe(true);
  await page.evaluate(() => { (window as unknown as { __bootWorld: unknown }).__bootWorld = (window as unknown as { __stage: { world: unknown } }).__stage.world; });
  await sleep(page, 800);
  const boot = await page.screenshot({ clip: LOWER, path: test.info().outputPath('title-boot-lower.png') });
  const clear0 = await titleClearOfRanger(page);
  expect(clear0.blockBottom, `the title block (bottom ${clear0.blockBottom} px) stays above the ranger (top ${clear0.rangerTop} px)`).toBeLessThan(clear0.rangerTop);
  await page.getByRole('button', { name: 'Begin', exact: true }).click({ timeout: 30_000 });
  await inWorld(page);

  const world: Mem[] = [await mem(page)];
  for (let trip = 1; trip <= 3; trip++) {
    await page.getByRole('button', { name: /Pauze/ }).click();
    await page.getByRole('button', { name: /Naar het hoofdmenu/ }).click();
    await expect.poll(() => R<string>(page, 'r.screen')).toBe('title');
    await expect.poll(() => R<boolean>(page, 'r.titleReady()'), { timeout: 30_000 }).toBe(true);
    await expect(page.getByRole('button', { name: 'Begin', exact: true })).toBeVisible();
    await sleep(page, 1_000);
    const same = await page.evaluate(() => (window as unknown as { __bootWorld: unknown }).__bootWorld === (window as unknown as { __stage: { world: unknown } }).__stage.world);
    expect(same, `trip ${trip}: the title is the same world, never rebuilt`).toBe(true);
    expect(await R<{ x: number; z: number }>(page, 'r.pos()'), `trip ${trip}: the ranger is back on the spawn`).toEqual({ x: 0, z: 0 });
    const back = await page.screenshot({ clip: LOWER, path: test.info().outputPath(`title-trip-${trip}-lower.png`) });
    if (trip === 1) await page.screenshot({ path: test.info().outputPath('title-after-round-trip.png') });
    const diff = await blockDiff(page, boot, back);
    expect(diff, `trip ${trip}: the title (ranger, cabin, missiebord) looks as at boot (block difference ${diff.toFixed(1)})`).toBeLessThan(8);
    const clear = await titleClearOfRanger(page);
    expect(clear.blockBottom, `trip ${trip}: the title block stays above the ranger`).toBeLessThan(clear.rangerTop);
    await page.getByRole('button', { name: 'Begin', exact: true }).click({ timeout: 30_000 });
    await inWorld(page);
    world.push(await mem(page));
  }
  const grew = world.slice(1).map((m) => m.tex - world[0].tex);
  expect(Math.max(...grew), `world textures per trip stay flat: ${world.map((m) => m.tex).join(' → ')}`).toBeLessThanOrEqual(4);
  expect(world[3].geo - world[0].geo, `world geometries per trip stay flat: ${world.map((m) => m.geo).join(' → ')}`).toBeLessThanOrEqual(8);
  expect(errors).toEqual([]);
});
