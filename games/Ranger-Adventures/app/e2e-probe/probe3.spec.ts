import { test, type Page } from '@playwright/test';
import fs from 'node:fs';

// THROWAWAY probe 3: verify the FIX direction — scaling off the SKELETON world
// height (× 1.7/skelH) brings the animated render to ~1.7 m and shows a normal
// ranger. If before.png = giant murk and after.png = a believable ranger on the
// ground, the prepModel skeleton-scale fix is confirmed.
const OUT = '/tmp/ranger-probe3';

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
  await page.waitForTimeout(6000);
}

test('probe skeleton-scale fix', async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  await boot(page);
  await page.screenshot({ path: `${OUT}/before.png` });

  const result = await page.evaluate(() => {
    const stage = (window as any).__stage;
    const scene = stage?.world?.scene;
    // player = char1 nearest origin
    let player: any = null; let best = 1e9;
    scene.traverse((o: any) => {
      if (o.isSkinnedMesh && o.name === 'char1') {
        const p = o.getWorldPosition(o.position.clone());
        const d = p.x * p.x + p.z * p.z; if (d < best) { best = d; player = o; }
      }
    });
    const mkV = () => player.position.clone();
    // skeleton world height
    let sMinY = 1e9, sMaxY = -1e9;
    for (const b of player.skeleton.bones) { const wp = b.getWorldPosition(mkV()); if (wp.y < sMinY) sMinY = wp.y; if (wp.y > sMaxY) sMaxY = wp.y; }
    const skelH = sMaxY - sMinY;
    // find the gltf Scene ancestor (the ~188 scale node prepModel scaled)
    let node: any = player, gltfScene: any = null;
    while (node) { if (Math.abs(node.scale.x) > 10) gltfScene = node; node = node.parent; }
    const factor = 1.7 / skelH;
    gltfScene.scale.multiplyScalar(factor);
    gltfScene.updateMatrixWorld(true);
    // re-seat feet: measure posed min.y, shift the ranger group so feet ≈ ground
    const geo = player.geometry, pos = geo.attributes.position, tmp = mkV();
    let minY = 1e9, maxY = -1e9; const step = Math.max(1, Math.floor(pos.count / 3000));
    for (let i = 0; i < pos.count; i += step) { tmp.fromBufferAttribute(pos, i); player.applyBoneTransform(i, tmp); tmp.applyMatrix4(player.matrixWorld); if (tmp.y < minY) minY = tmp.y; if (tmp.y > maxY) maxY = tmp.y; }
    // shift gltfScene up so posed feet sit at the ranger-group origin (~ground)
    gltfScene.position.y -= minY - 0; gltfScene.updateMatrixWorld(true);
    stage.renderer.render(stage.world.scene, stage.world.camera);
    return { skelH: +skelH.toFixed(3), factor: +factor.toFixed(5), posedHeightAfter: +(maxY - minY).toFixed(3) };
  });
  fs.writeFileSync(`${OUT}/result.json`, JSON.stringify(result, null, 2));
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}/after.png` });
});
