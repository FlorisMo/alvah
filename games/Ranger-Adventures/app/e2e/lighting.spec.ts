import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors } from './helpers';

/**
 * Golden-hour light + selective shadows E2E (WORLD-PLAN W4.5). The world now
 * carries a warm low sun casting a HERO shadow map (ranger + solid props, via a
 * tight ranger-following ortho frustum) plus cheap blob shadows under the moving
 * animals. This spec proves, against the dev-state hook:
 *   1) the renderer shadow map is enabled and the sun casts;
 *   2) the ranger is opted into the hero shadow once its rig loads;
 *   3) blob shadows are placed under the ambient animals + scenic actors (>=6);
 *   4) the draw-call budget still holds (`drawCalls()` < 150) BOTH at spawn AND
 *      after walking into the watchtower grove, where the solid props enter the
 *      shadow frustum and the shadow pass renders them.
 *
 * Not a @smoke test — the frozen movement smoke is untouched; this is the box's
 * own acceptance assert. Navigation reuses the camera-relative arrow walk.
 */

interface Prop { id: string; x: number; z: number }
interface Lighting { shadowMap: boolean; sunCastsShadow: boolean; rangerCastsShadow: boolean; blobShadows: number }
interface Hook {
  screen: string;
  pos(): { x: number; z: number } | null;
  cameraYaw(): number | null;
  drawCalls(): number | null;
  lighting(): Lighting | null;
  landmarks(): Prop[] | null;
}
function hook<T>(page: Page, fn: (r: Hook) => T): Promise<T | null> {
  return page.evaluate((body) => {
    const r = (window as unknown as { __ranger?: unknown }).__ranger;
    // eslint-disable-next-line no-new-func
    return r ? (new Function('r', `return (${body})(r)`))(r) : null;
  }, fn.toString()) as Promise<T | null>;
}

async function enterWorld(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByRole('button', { name: 'Dit is mijn ranger' }).click();
  await expect.poll(() => hook(page, (r) => r.screen), { timeout: 30_000 }).toBe('world');
}

const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const;

/** Steer the ranger toward a fixed world target (camera-relative, mirrors
 *  dressing.spec). Returns the final distance to the target. */
async function walkTo(page: Page, tx: number, tz: number, arrive: number): Promise<number> {
  const down = new Set<string>();
  const sync = async (want: Set<string>): Promise<void> => {
    for (const k of KEYS) {
      if (want.has(k) && !down.has(k)) { await page.keyboard.down(k); down.add(k); }
      else if (!want.has(k) && down.has(k)) { await page.keyboard.up(k); down.delete(k); }
    }
  };
  let dist = Infinity;
  try {
    for (let i = 0; i < 260; i++) {
      const p = await hook(page, (r) => r.pos());
      const yaw = await hook(page, (r) => r.cameraYaw());
      if (!p || yaw == null) { await page.waitForTimeout(100); continue; }
      const dx = tx - p.x, dz = tz - p.z;
      dist = Math.hypot(dx, dz);
      if (dist <= arrive) return dist;
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const sx = dx * cy - dz * sy;
      const sYf = -dx * sy - dz * cy;
      const want = new Set<string>();
      if (sx > 0.4) want.add('ArrowRight');
      else if (sx < -0.4) want.add('ArrowLeft');
      if (sYf > 0.4) want.add('ArrowUp');
      else if (sYf < -0.4) want.add('ArrowDown');
      await sync(want);
      await page.waitForTimeout(120);
    }
    return dist;
  } finally {
    await sync(new Set());
  }
}

test('lighting: golden-hour hero shadow + blob shadows, budget holds', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await enterWorld(page);

  // shadow map + sun cast are set at construction; blob shadows are placed
  // synchronously with the ambient/scenic cast.
  const light = await hook(page, (r) => r.lighting());
  expect(light, 'lighting() available in the world').not.toBeNull();
  expect(light!.shadowMap, 'renderer shadow map enabled').toBe(true);
  expect(light!.sunCastsShadow, 'the golden-hour sun casts the hero shadow').toBe(true);
  // 4 ambient ground roamers + 2 scenic actors each get a blob shadow.
  expect(light!.blobShadows, 'blob shadows under the animals + actors').toBeGreaterThanOrEqual(6);

  // the ranger opts into the hero shadow once its rig streams in (async load).
  await expect.poll(() => hook(page, (r) => r.lighting()?.rangerCastsShadow), { timeout: 30_000 })
    .toBe(true);

  // budget at spawn (shadow pass covers the ranger + hub cabin near the player).
  await shot(page, 'lighting-at-spawn');
  const spawnCalls = await hook(page, (r) => r.drawCalls());
  expect(spawnCalls, 'drawCalls() available').not.toBeNull();
  expect(spawnCalls!, 'draw calls under 150 at spawn').toBeLessThan(150);

  // walk into the watchtower grove so the solid props enter the shadow frustum
  // and the shadow pass renders them — the budget must still hold.
  const landmarks = await hook(page, (r) => r.landmarks());
  const tower = landmarks!.find((l) => l.id === 'prop-fire-watchtower')!;
  await walkTo(page, tower.x, tower.z, 6);
  await shot(page, 'lighting-in-grove');
  const groveCalls = await hook(page, (r) => r.drawCalls());
  expect(groveCalls, 'drawCalls() available in the grove').not.toBeNull();
  expect(groveCalls!, 'draw calls under 150 inside the grove (shadow pass on)').toBeLessThan(150);

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
