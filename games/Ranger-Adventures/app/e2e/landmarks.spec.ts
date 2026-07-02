import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors } from './helpers';

/**
 * Landmark-props E2E (WORLD-PLAN W4.1). The world now carries fixed landmark
 * beacons — fire-watchtower, vogelkijkhut, ecoduct, BOA post, signposts — placed
 * per §4 with collision circles. This spec proves two acceptance criteria:
 *   1) the ranger can WALK from the spawn clearing to the watchtower (a real
 *      camera-relative arrow walk over the terrain, closing the gap ≥ 8 m and
 *      arriving within ~4 m), so the landmark is reachable and its collision
 *      circle does not trap the player short of it;
 *   2) the full landmark cast holds `drawCalls()` < 150 (the frozen budget).
 *
 * Not a @smoke test — the frozen movement smoke is untouched; this is the box's
 * own acceptance assert (state, not pixels; artifact screenshots are evidence).
 * Navigation reuses the frozen keyboard-walk path, steering with the live
 * `cameraYaw()` exactly like interact.spec.
 */

interface Landmark { id: string; x: number; z: number }
interface Hook {
  screen: string;
  pos(): { x: number; z: number } | null;
  cameraYaw(): number | null;
  drawCalls(): number | null;
  landmarks(): Landmark[] | null;
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

/**
 * Steer the ranger toward a fixed world target with arrow keys until within
 * `arrive` metres (or the step budget runs out). Mirrors interact.spec's
 * camera-relative mapping: for camera yaw ψ,
 *   screenX =  dx·cosψ − dz·sinψ,   screenY = −dx·sinψ − dz·cosψ.
 */
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

test('landmarks: the ranger walks spawn→watchtower, draw calls stay < 150', async ({ page }, testInfo) => {
  // A real-time terrain walk to a far landmark on SwiftShader (~10× slower);
  // give the same headroom interact.spec uses for its marker walk.
  test.setTimeout(120_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await enterWorld(page);

  const landmarks = await hook(page, (r) => r.landmarks());
  expect(landmarks, 'landmarks() available in the world').not.toBeNull();
  // all five §4 landmark kinds are placed (two signposts share the model).
  const ids = landmarks!.map((l) => l.id);
  for (const id of ['prop-fire-watchtower', 'prop-bird-hide', 'prop-ecoduct', 'prop-boa-post', 'prop-signpost']) {
    expect(ids, `${id} placed`).toContain(id);
  }

  const tower = landmarks!.find((l) => l.id === 'prop-fire-watchtower')!;
  const start = await hook(page, (r) => r.pos());
  expect(start, 'pos() available in world').not.toBeNull();
  const startDist = Math.hypot(tower.x - start!.x, tower.z - start!.z);
  expect(startDist, 'watchtower is a real walk from spawn').toBeGreaterThan(20);
  await shot(page, 'landmarks-at-spawn');

  // walk to the watchtower — arrive within ~4 m (its collision radius is 1.8 m).
  const endDist = await walkTo(page, tower.x, tower.z, 4);
  await shot(page, 'landmarks-at-watchtower');
  expect(endDist, 'ranger reached the watchtower').toBeLessThanOrEqual(4);
  // sanity: he actually closed the gap by a lot, not a lucky proximity read.
  expect(startDist - endDist, 'closed the distance to the watchtower').toBeGreaterThanOrEqual(8);

  // the full landmark cast holds the frozen draw-call budget.
  const calls = await hook(page, (r) => r.drawCalls());
  expect(calls, 'drawCalls() available').not.toBeNull();
  expect(calls!, 'draw calls under the 150 budget').toBeLessThan(150);

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
