import { test, expect, type Page } from '@playwright/test';
import { R, sleep } from './golden-lib';

/**
 * The title round trip (Pauze → "Naar het hoofdmenu" → Begin), played with real clicks,
 * three times over:
 *  - the title looks the same as at boot: its ranger, cabin and tree line are still
 *    drawn (they share their GPU buffers with the world's clones of the same GLBs, and
 *    a world teardown that freed them left the title with trees and a stray shadow only:
 *    parent:B9);
 *  - the world's GPU memory does not grow per trip (World.dispose freed only geometry,
 *    so every trip kept 22-36 more textures: LEAK-1 / breaker:B8).
 * Reduced motion holds the title camera and the ranger's idle still, so the boot title
 * and the returned title are the same picture.
 */

test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });

type Mem = { tex: number; geo: number };
const mem = (page: Page): Promise<Mem> => page.evaluate(() => {
  const info = (window as unknown as { __stage: { renderer: { info: { memory: { textures: number; geometries: number } } } } }).__stage.renderer.info;
  return { tex: info.memory.textures, geo: info.memory.geometries };
});

/** The left of the title (the cabin and the ranger; both title cards sit to its right). */
const LEFT = { x: 0, y: 220, width: 360, height: 520 };

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
  await sleep(page, 4_000); // the rigs, the forest and the name-tags stream in
}

test('title round trip: the title keeps its ranger and cabin, and the world frees what it made', async ({ page, context }) => {
  test.setTimeout(4 * 60_000);
  await context.addInitScript(() => {
    if (!localStorage.getItem('alvah-ef-v1')) localStorage.setItem('alvah-ef-v1', JSON.stringify({ ranger: { avatarGemaakt: true, settings: { wereldHintGezien: true, tikHintGezien: true } } }));
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?dev=1');
  // a player who looks at the title first: it dresses fully before Begin (the case that broke)
  await expect.poll(() => R<boolean>(page, 'r.titleReady()'), { timeout: 30_000, message: 'the title dresses itself' }).toBe(true);
  await sleep(page, 500);
  const boot = await page.screenshot({ clip: LEFT, path: test.info().outputPath('title-boot-left.png') });
  await page.getByRole('button', { name: 'Begin', exact: true }).click({ timeout: 30_000 });
  await inWorld(page);

  const world: Mem[] = [await mem(page)];
  for (let trip = 1; trip <= 3; trip++) {
    await page.getByRole('button', { name: /Pauze/ }).click();
    await page.getByRole('button', { name: /Naar het hoofdmenu/ }).click();
    await expect.poll(() => R<string>(page, 'r.screen')).toBe('title');
    await expect.poll(() => R<boolean>(page, 'r.titleReady()'), { timeout: 30_000 }).toBe(true);
    await sleep(page, 800);
    const back = await page.screenshot({ clip: LEFT, path: test.info().outputPath(`title-trip-${trip}-left.png`) });
    if (trip === 1) await page.screenshot({ path: test.info().outputPath('title-after-round-trip.png') });
    const diff = await blockDiff(page, boot, back);
    // measured: 0-1 when the title is whole, 28 when its ranger and cabin are gone (B9)
    expect(diff, `trip ${trip}: the title's left side (cabin, ranger) looks as at boot (block difference ${diff.toFixed(1)})`).toBeLessThan(8);
    // the in-app title card sits where the boot card sits (bottom centre), not mid-screen
    const card = await page.locator('.ra-title-card').boundingBox();
    expect(card && card.y + card.height > 800 * 0.8, 'the title card sits low, like the boot card').toBe(true);
    await page.getByRole('button', { name: 'Begin', exact: true }).click({ timeout: 30_000 });
    await inWorld(page);
    world.push(await mem(page));
  }
  const grew = world.slice(1).map((m) => m.tex - world[1].tex);
  expect(Math.max(...grew), `world textures per trip stay flat: ${world.map((m) => m.tex).join(' → ')}`).toBeLessThanOrEqual(4);
  expect(world[3].geo - world[1].geo, `world geometries per trip stay flat: ${world.map((m) => m.geo).join(' → ')}`).toBeLessThanOrEqual(8);
  expect(errors).toEqual([]);
});
