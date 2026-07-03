import { test, type Page } from '@playwright/test';
import fs from 'node:fs';

// THROWAWAY probe 4 (F-07 fix verification): confirm the skeleton-scale fix in
// Models.prepModel/skinnedRenderBox brings the RENDERED ranger to ~1.7 m (no more
// ~170 m giant) and that the dev-hook fields now agree with the render.
const OUT = '/tmp/ranger-probe4';

async function boot(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('alvah-ef-v1');
      localStorage.removeItem('ranger-mvp-state');
      sessionStorage.setItem('alvah-gate-v1', '1');
    } catch { /* ignore */ }
  });
  await page.goto('/?dev=1');
  await page.getByRole('button', { name: 'Begin' }).click();
  const confirm = page.getByRole('button', { name: 'Dit is mijn ranger' });
  const start = Date.now();
  for (;;) {
    if (await confirm.isVisible().catch(() => false)) { await confirm.click(); break; }
    if (await page.evaluate(() => (window as any).__ranger?.screen === 'world')) break;
    if (Date.now() - start > 40_000) break;
    await page.waitForTimeout(150);
  }
  await page.waitForFunction(() => (window as any).__ranger?.screen === 'world', { timeout: 40_000 });
  await page.waitForTimeout(6000); // let the real rig load + settle
}

test('probe F-07 skeleton-scale fix landed', async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  await boot(page);
  await page.screenshot({ path: `${OUT}/world-entry.png` });

  const result = await page.evaluate(() => {
    const r = (window as any).__ranger;
    const stage = (window as any).__stage;
    const scene = stage?.world?.scene;
    // player = char1 skinned mesh nearest world origin
    let player: any = null; let best = 1e9;
    scene.traverse((o: any) => {
      if (o.isSkinnedMesh && o.name === 'char1') {
        const p = o.getWorldPosition(o.position.clone());
        const d = p.x * p.x + p.z * p.z; if (d < best) { best = d; player = o; }
      }
    });
    player.updateWorldMatrix(true, true);
    const mkV = () => player.position.clone();
    // TRUE posed (skinned) render height via per-vertex bone skinning
    const geo = player.geometry, pos = geo.attributes.position, tmp = mkV();
    let minY = 1e9, maxY = -1e9;
    const step = Math.max(1, Math.floor(pos.count / 3000));
    for (let i = 0; i < pos.count; i += step) {
      tmp.fromBufferAttribute(pos, i);
      player.applyBoneTransform(i, tmp);
      tmp.applyMatrix4(player.matrixWorld);
      if (tmp.y < minY) minY = tmp.y; if (tmp.y > maxY) maxY = tmp.y;
    }
    // skeleton world height (what skinnedRenderBox measures)
    let sMinY = 1e9, sMaxY = -1e9;
    for (const b of player.skeleton.bones) { const wp = b.getWorldPosition(mkV()); if (wp.y < sMinY) sMinY = wp.y; if (wp.y > sMaxY) sMaxY = wp.y; }
    return {
      renderedPosedHeight: +(maxY - minY).toFixed(3),
      renderedFeetY: +minY.toFixed(3),
      skeletonHeight: +(sMaxY - sMinY).toFixed(3),
      hook_avatarHeight: r.avatar()?.height ?? null,
      hook_cam: r.cam(),
    };
  });
  fs.writeFileSync(`${OUT}/result.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
});
