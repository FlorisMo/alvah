import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors } from './helpers';

/**
 * Ambient-wildlife E2E (WORLD-PLAN W3.6). A few animals roam gentle wander loops
 * (the W3.5-staged ree + vos crossfade their baked walk↔graze clips; the eekhoorn
 * + wild zwijn get the procedural bob) and two birds glide overhead. This proves,
 * against the dev hook (state, not pixels — headless SwiftShader is deterministic
 * for state):
 *   (1) ≥2 animals are present in the world scene (report a live position);
 *   (2) at least one W3.5-staged animal's baked mixer clock actually advances
 *       (its `clip().time` grows between two polls — not a frozen pose);
 *   (3) the draw-call budget still holds: `drawCalls() < 150`.
 * No input is needed — ambient motion is always-on secondary motion.
 */

type Amb = { id: string; x: number; z: number; clip: { name: string; time: number } | null };
interface Hook {
  screen: string;
  ambient(): Amb[] | null;
  drawCalls(): number | null;
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

/** The baked animals whose mixer must be observed to run (W3.5-staged). */
const BAKED = ['animal-ree-roedeer', 'animal-vos-fox'];

function clipOf(list: Amb[] | null, id: string): { name: string; time: number } | null {
  return list?.find((a) => a.id === id)?.clip ?? null;
}

test('ambient: animals roam and a baked mixer runs; draw calls stay in budget', async ({ page }, testInfo) => {
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await enterWorld(page);

  // the rigs load async; wait until at least one baked animal reports a clip.
  await expect
    .poll(async () => {
      const a = await hook(page, (r) => r.ambient());
      return BAKED.some((id) => clipOf(a, id) != null);
    }, { timeout: 30_000, message: 'at least one W3.5 baked animal should attach a rig + clip' })
    .toBe(true);

  const list = await hook(page, (r) => r.ambient());
  expect(list, 'ambient() available in the world').not.toBeNull();
  // ≥2 animals present in the scene (roamers report a finite world position).
  const animals = list!.filter((a) => a.id.startsWith('animal-') && Number.isFinite(a.x) && Number.isFinite(a.z));
  expect(animals.length, 'at least two roaming animals are placed').toBeGreaterThanOrEqual(2);

  // a baked mixer clock advances (proves the walk/graze clip runs, not a still pose)
  const ranger = BAKED.find((id) => clipOf(list, id) != null)!;
  const t1 = clipOf(list, ranger)!.time;
  await expect
    .poll(async () => {
      const a = await hook(page, (r) => r.ambient());
      return clipOf(a, ranger)?.time ?? -1;
    }, { timeout: 10_000, message: `${ranger}'s baked mixer clock must advance` })
    .toBeGreaterThan(t1);

  // the draw-call budget still holds with the ambient cast added (§3.4: < 150)
  const calls = await hook(page, (r) => r.drawCalls());
  expect(calls, 'drawCalls() readable').not.toBeNull();
  expect(calls!, 'draw calls stay under the 150 budget').toBeLessThan(150);

  await shot(page, 'ambient-wildlife');

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
