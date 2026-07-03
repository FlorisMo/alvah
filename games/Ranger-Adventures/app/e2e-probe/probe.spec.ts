import { test, type Page } from '@playwright/test';
import fs from 'node:fs';

// THROWAWAY diagnostic (P1.2): why does the loaded ranger rig measure 1.7 m +
// animate but not RENDER (6× F-07 shot fails, empty ground where the hook
// projects him)? Hypothesis: the skinned mesh is frustum-culled by a bad
// bind-pose bounding volume. Confirm it, and test frustumCulled=false as the fix.
const OUT = '/tmp/ranger-probe';

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
    const inWorld = await page.evaluate(() => (window as any).__ranger?.screen === 'world');
    if (inWorld) break;
    if (Date.now() - start > 40_000) break;
    await page.waitForTimeout(150);
  }
  // wait for world + the REAL rig to load (clip becomes non-null once the mixer attaches)
  await page.waitForFunction(() => (window as any).__ranger?.screen === 'world', { timeout: 40_000 });
  await page.waitForTimeout(6000);
}

test('probe ranger render', async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  await boot(page);

  const dump = await page.evaluate(() => {
    const THREE = (window as any).THREE;
    const stage = (window as any).__stage;
    const world = stage?.world;
    const scene = world?.scene;
    const cam = world?.camera;
    if (!scene || !cam) return { error: 'no world scene/camera on __stage' };
    cam.updateMatrixWorld();
    const skinned: any[] = [];
    scene.traverse((o: any) => { if (o.isSkinnedMesh) skinned.push(o); });
    const report = skinned.map((m: any) => {
      m.updateWorldMatrix(true, false);
      const geo = m.geometry;
      if (!geo.boundingSphere) geo.computeBoundingSphere();
      const bs = geo.boundingSphere;
      // world-space sphere center
      const c = bs.center.clone().applyMatrix4(m.matrixWorld);
      const worldScale = m.getWorldScale(new (c.constructor)());
      const worldR = bs.radius * Math.max(Math.abs(worldScale.x), Math.abs(worldScale.y), Math.abs(worldScale.z));
      const dCam = c.distanceTo(cam.position);
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      return {
        name: m.name || '(unnamed)',
        visible: m.visible,
        frustumCulled: m.frustumCulled,
        parentVisible: m.parent?.visible,
        worldPos: { x: +m.getWorldPosition(new (c.constructor)()).x.toFixed(3), y: +m.getWorldPosition(new (c.constructor)()).y.toFixed(3), z: +m.getWorldPosition(new (c.constructor)()).z.toFixed(3) },
        boundingSphere_local: { cx: +bs.center.x.toFixed(3), cy: +bs.center.y.toFixed(3), cz: +bs.center.z.toFixed(3), r: +bs.radius.toFixed(3) },
        boundingSphere_worldCenter: { x: +c.x.toFixed(3), y: +c.y.toFixed(3), z: +c.z.toFixed(3) },
        boundingSphere_worldRadius: +worldR.toFixed(3),
        distToCam: +dCam.toFixed(3),
        materials: mats.map((mt: any) => ({ type: mt.type, opacity: mt.opacity, transparent: mt.transparent, visible: mt.visible, colorWrite: mt.colorWrite, depthWrite: mt.depthWrite })),
      };
    });
    return {
      camPos: { x: +cam.position.x.toFixed(3), y: +cam.position.y.toFixed(3), z: +cam.position.z.toFixed(3) },
      camNear: cam.near, camFar: cam.far, camFov: cam.fov,
      sceneFog: scene.fog ? { type: scene.fog.type ?? (scene.fog.isFog ? 'Fog' : 'FogExp2'), near: scene.fog.near, far: scene.fog.far } : null,
      skinnedCount: skinned.length,
      report,
    };
  });
  fs.writeFileSync(`${OUT}/dump.json`, JSON.stringify(dump, null, 2));
  // baseline screenshot (as the game renders it now)
  await page.screenshot({ path: `${OUT}/before.png` });

  // TEST THE FIX: force frustumCulled=false + tint every skinned mesh bright
  // magenta, force one render, screenshot. If the ranger APPEARS, culling is the bug.
  await page.evaluate(() => {
    const stage = (window as any).__stage;
    const world = stage?.world;
    const scene = world?.scene;
    scene.traverse((o: any) => {
      if (o.isSkinnedMesh) {
        o.frustumCulled = false;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const mt of mats) {
          if (mt.emissive) { mt.emissive.setRGB(1, 0, 1); mt.emissiveIntensity = 1; }
          mt.opacity = 1; mt.transparent = false; mt.visible = true; mt.needsUpdate = true;
        }
        o.visible = true;
      }
    });
    stage.renderer.render(world.scene, world.camera);
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/after-cullfix-tint.png` });

  // Also: ONLY frustumCulled=false (no tint), fresh boot-like render, to see the
  // real rig at its real colours.
  await page.evaluate(() => {
    const stage = (window as any).__stage;
    const world = stage?.world;
    world.scene.traverse((o: any) => {
      if (o.isSkinnedMesh) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const mt of mats) { if (mt.emissive) { mt.emissive.setRGB(0, 0, 0); } mt.needsUpdate = true; }
      }
    });
    stage.renderer.render(world.scene, world.camera);
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/after-cullfix-notint.png` });
});
