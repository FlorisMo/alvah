import { test, expect, type Page } from '@playwright/test';
import { collectPageErrors, reportPageErrors } from './helpers';

/**
 * Relative-scale E2E (WORLD-PLAN W3.7a). The ambient animals are now sized from
 * the canonical dossier stand-height table (`AnimalScale.ts`) instead of
 * placement-site ballparks. This proves the table is WIRED INTO the live world
 * (not just unit-tested in isolation): the applied height `h` each roamer
 * reports through the dev hook follows the dossier ordering — a ree stands
 * taller than a fox, which stands taller than a squirrel — and every animal is
 * shorter than the adult-human reference (1.7 m).
 *
 * Not a @smoke test — the frozen smoke set is untouched; this is the box's own
 * acceptance assert (state, not pixels; the showroom before/after screenshots
 * are the visual evidence, in showroom-w37.spec.ts).
 */

type Amb = { id: string; x: number; z: number; h: number; clip: { name: string; time: number } | null };
interface Hook { screen: string; ambient(): Amb[] | null; }
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

const hOf = (list: Amb[] | null, id: string): number | undefined =>
  list?.find((a) => a.id === id)?.h;

test('scale: ambient animals apply the dossier stand-height ordering', async ({ page }, testInfo) => {
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await enterWorld(page);

  // Placement is synchronous (heights are set before the async rig load), so the
  // ambient list is populated as soon as the world screen is reached.
  await expect
    .poll(async () => (await hook(page, (r) => r.ambient()))?.length ?? 0, { timeout: 30_000 })
    .toBeGreaterThanOrEqual(2);

  const list = await hook(page, (r) => r.ambient());
  expect(list, 'ambient() available in the world').not.toBeNull();

  const ree = hOf(list, 'animal-ree-roedeer');
  const vos = hOf(list, 'animal-vos-fox');
  const eekhoorn = hOf(list, 'animal-eekhoorn-squirrel');
  expect(ree, 'ree height applied').toBeGreaterThan(0);
  expect(vos, 'vos height applied').toBeGreaterThan(0);
  expect(eekhoorn, 'eekhoorn height applied').toBeGreaterThan(0);

  // dossier ordering: ree (roe deer) > vos (fox) > eekhoorn (squirrel)
  expect(ree!, 'ree taller than fox').toBeGreaterThan(vos!);
  expect(vos!, 'fox taller than squirrel').toBeGreaterThan(eekhoorn!);

  // every roaming animal is shorter than the adult-human reference (1.7 m)
  for (const a of list!.filter((x) => x.id.startsWith('animal-'))) {
    expect(a.h, `${a.id} shorter than the ranger reference`).toBeLessThan(1.7);
  }

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
