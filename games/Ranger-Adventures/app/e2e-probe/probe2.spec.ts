import { test, type Page } from '@playwright/test';
import fs from 'node:fs';

// THROWAWAY probe 2: the tint test proved the "murk" is the ranger skinned mesh
// rendering as a GIANT at 4.85 m while its bind-pose bbox measures 1.7 m. Find
// the giant's SOURCE: measure the TRUE posed (skinned) world bbox via
// applyBoneTransform, and walk the scale chain mesh→…→scene + the skeleton.
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
    if (await page.evaluate(() => (window as any).__ranger?.screen === 'world')) break;
    if (Date.now() - start > 40_000) break;
    await page.waitForTimeout(150);
  }
  await page.waitForFunction(() => (window as any).__ranger?.screen === 'world', { timeout: 40_000 });
  await page.waitForTimeout(6000);
}

test('probe ranger giant source', async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  await boot(page);

  const dump = await page.evaluate(() => {
    const stage = (window as any).__stage;
    const scene = stage?.world?.scene;
    if (!scene) return { error: 'no scene' };
    // the player ranger = the char1 skinned mesh nearest world origin
    let player: any = null; let best = 1e9;
    scene.traverse((o: any) => {
      if (o.isSkinnedMesh && o.name === 'char1') {
        const p = o.getWorldPosition(o.position.clone());
        const d = p.x * p.x + p.z * p.z;
        if (d < best) { best = d; player = o; }
      }
    });
    if (!player) return { error: 'no player char1' };
    player.updateWorldMatrix(true, true);
    const mkV = () => player.position.clone();

    // TRUE posed world bbox via per-vertex bone skinning
    const geo = player.geometry;
    const pos = geo.attributes.position;
    const tmp = mkV();
    let minY = 1e9, maxY = -1e9, minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    const step = Math.max(1, Math.floor(pos.count / 4000));
    for (let i = 0; i < pos.count; i += step) {
      tmp.fromBufferAttribute(pos, i);
      player.applyBoneTransform(i, tmp);   // skin the vertex (posed)
      tmp.applyMatrix4(player.matrixWorld); // → world space
      if (tmp.y < minY) minY = tmp.y; if (tmp.y > maxY) maxY = tmp.y;
      if (tmp.x < minX) minX = tmp.x; if (tmp.x > maxX) maxX = tmp.x;
      if (tmp.z < minZ) minZ = tmp.z; if (tmp.z > maxZ) maxZ = tmp.z;
    }

    // scale chain mesh → scene
    const chain: any[] = [];
    let n: any = player;
    while (n) {
      chain.push({
        name: n.name || `(${n.type})`, type: n.type,
        scale: { x: +n.scale.x.toFixed(4), y: +n.scale.y.toFixed(4), z: +n.scale.z.toFixed(4) },
        pos: { x: +n.position.x.toFixed(3), y: +n.position.y.toFixed(3), z: +n.position.z.toFixed(3) },
      });
      n = n.parent;
    }

    // skeleton: root bone scale + a few bone world scales
    const skel = player.skeleton;
    const bones = skel ? skel.bones.slice(0, 8).map((b: any) => {
      const ws = b.getWorldScale(mkV());
      return { name: b.name, localScale: { x: +b.scale.x.toFixed(3), y: +b.scale.y.toFixed(3), z: +b.scale.z.toFixed(3) }, worldScale: { x: +ws.x.toFixed(3), y: +ws.y.toFixed(3), z: +ws.z.toFixed(3) } };
    }) : null;
    const boneCount = skel ? skel.bones.length : 0;

    const ws = player.getWorldScale(mkV());

    // skeleton world bbox (bone positions) — reflects the ANIMATED render extent
    let sMinY = 1e9, sMaxY = -1e9;
    for (const b of skel.bones) {
      const wp = b.getWorldPosition(mkV());
      if (wp.y < sMinY) sMinY = wp.y; if (wp.y > sMaxY) sMaxY = wp.y;
    }
    // mesh geometry bind-pose world bbox height (what setFromObject/avatar.height reads)
    if (!geo.boundingBox) geo.computeBoundingBox();
    const gb = geo.boundingBox;
    const corners: number[] = [];
    for (let i = 0; i < 8; i++) {
      const v = mkV().set(i & 1 ? gb.max.x : gb.min.x, i & 2 ? gb.max.y : gb.min.y, i & 4 ? gb.max.z : gb.min.z);
      v.applyMatrix4(player.matrixWorld); corners.push(v.y);
    }
    const bindWorldY = Math.max(...corners) - Math.min(...corners);

    return {
      skeletonWorldBBoxY: +(sMaxY - sMinY).toFixed(3),
      meshBindPoseWorldBBoxY: +bindWorldY.toFixed(3),
      posedWorldBBox: {
        sizeY: +(maxY - minY).toFixed(3), sizeX: +(maxX - minX).toFixed(3), sizeZ: +(maxZ - minZ).toFixed(3),
        minY: +minY.toFixed(3), maxY: +maxY.toFixed(3),
      },
      meshWorldScale: { x: +ws.x.toFixed(4), y: +ws.y.toFixed(4), z: +ws.z.toFixed(4) },
      bindMode: player.bindMode,
      geomBoundingBoxSizeY: geo.boundingBox ? +(geo.boundingBox.max.y - geo.boundingBox.min.y).toFixed(4) : (geo.computeBoundingBox(), +(geo.boundingBox.max.y - geo.boundingBox.min.y).toFixed(4)),
      scaleChain: chain,
      boneCount,
      firstBones: bones,
    };
  });
  fs.writeFileSync(`${OUT}/dump2.json`, JSON.stringify(dump, null, 2));
  console.log(JSON.stringify(dump, null, 2));
});
