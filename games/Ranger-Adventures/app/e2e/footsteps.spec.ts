import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors } from './helpers';

/**
 * Surface-aware footsteps E2E (WORLD-PLAN W4.7b). Footsteps are the box's own
 * player-visible behaviour, so they land their own assert. Audio has no pixel
 * surface, so — like the W3.0/W4.7a audio precedent — verification reads the
 * `footsteps()` dev hook (running count + last surface) rather than listening.
 *
 * Two asserts: (1) walking from the spawn heide clearing plants footsteps and
 * the surface reads 'gras'; (2) the sound gate holds — with `geluid` off,
 * walking the same distance plants ZERO footsteps.
 */

interface Hook {
  screen: string;
  pos(): { x: number; z: number } | null;
  footsteps(): { count: number; surface: 'zand' | 'gras' | null } | null;
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

/** Hold `key` until the ranger has walked ≥ `dist` m from `start`, then release. */
async function walkAtLeast(page: Page, key: string, start: { x: number; z: number }, dist = 2): Promise<void> {
  await page.keyboard.down(key);
  try {
    await expect
      .poll(async () => {
        const p = await hook(page, (r) => r.pos());
        return p ? Math.hypot(p.x - start.x, p.z - start.z) : 0;
      }, { timeout: 20_000, message: `holding ${key} should walk the ranger ≥ ${dist} m` })
      .toBeGreaterThanOrEqual(dist);
  } finally {
    await page.keyboard.up(key);
  }
}

test('footsteps: walking the spawn clearing plants grass footsteps', async ({ page }, testInfo) => {
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await enterWorld(page);

  const before = await hook(page, (r) => r.footsteps());
  expect(before, 'footsteps() available once in world').not.toBeNull();
  expect(before!.count, 'no footsteps before moving').toBe(0);

  const start = await hook(page, (r) => r.pos());
  await walkAtLeast(page, 'ArrowUp', start!);

  // footsteps accrue while walking (poll — the cadence needs a few strides)
  await expect
    .poll(async () => (await hook(page, (r) => r.footsteps()))?.count ?? 0, {
      timeout: 20_000,
      message: 'walking should plant footsteps',
    })
    .toBeGreaterThan(0);

  await shot(page, 'footsteps-after-walk');

  // spawn is the forced-heide clearing → the surface reads as 'gras'
  const after = await hook(page, (r) => r.footsteps());
  expect(after!.surface, 'spawn heide clearing reads as grass underfoot').toBe('gras');

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});

test('footsteps: the sound gate holds — no footsteps when geluid is off', async ({ page }, testInfo) => {
  const errors: string[] = [];
  collectPageErrors(page, errors);

  // pre-seed geluid:false into the shared alvah-ef-v1 blob (ranger namespace, no new key)
  await page.addInitScript(() => {
    localStorage.setItem('alvah-ef-v1', JSON.stringify({ ranger: { settings: { geluid: false } } }));
  });

  await enterWorld(page);

  const start = await hook(page, (r) => r.pos());
  await walkAtLeast(page, 'ArrowUp', start!); // proves the ranger really moved ≥ 2 m

  const after = await hook(page, (r) => r.footsteps());
  expect(after!.count, 'sound off → footsteps gated, count stays 0 despite walking').toBe(0);

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
