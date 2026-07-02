import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors } from './helpers';

/**
 * Scenic-actors E2E (WORLD-PLAN W3.3). The warden (BOA) and poacher stand at
 * fixed world spots and play their single baked clip through a mixer. This proves
 * both are placed AND their mixers actually RUN (not a frozen pose) via two state
 * asserts against the dev hook — no input needed (their clip is always-on
 * secondary motion, unlike the player's key-gated locomotion):
 *   (1) both `ranger-warden-boa` and `figure-poacher` report a baked clip;
 *   (2) at least one actor's `clip().time` advances between two polls.
 * State-only (headless SwiftShader renders deterministically for state, not
 * pixels); a screenshot is an artifact.
 */

type Actor = { id: string; clip: { name: string; time: number } | null };
interface Hook {
  screen: string;
  actors(): Actor[] | null;
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

const WARDEN = 'ranger-warden-boa';
const POACHER = 'figure-poacher';

/** The baked clip for one actor id, or null if the actor/rig is not ready. */
function clipOf(actors: Actor[] | null, id: string): { name: string; time: number } | null {
  return actors?.find((a) => a.id === id)?.clip ?? null;
}

test('actors: warden + poacher are placed and their baked clips run', async ({ page }, testInfo) => {
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await enterWorld(page);

  // the rigs load async (loadRig + mixer wiring); wait until BOTH report a clip.
  await expect
    .poll(async () => {
      const a = await hook(page, (r) => r.actors());
      return clipOf(a, WARDEN) != null && clipOf(a, POACHER) != null;
    }, { timeout: 30_000, message: 'both scenic actors should attach a rig and report a baked clip' })
    .toBe(true);

  const actors = await hook(page, (r) => r.actors());
  expect(actors, 'actors() available in the world').not.toBeNull();
  expect(actors!.map((a) => a.id).sort(), 'both story-arc humans are placed').toEqual([POACHER, WARDEN].sort());
  expect(clipOf(actors, WARDEN), 'warden plays a baked clip').not.toBeNull();
  expect(clipOf(actors, POACHER), 'poacher plays a baked clip').not.toBeNull();

  // the mixer clock advances with no input — read the warden's clip time twice.
  const t1 = clipOf(actors, WARDEN)!.time;
  await expect
    .poll(async () => {
      const a = await hook(page, (r) => r.actors());
      return clipOf(a, WARDEN)?.time ?? -1;
    }, { timeout: 10_000, message: "the warden's mixer clock (clip().time) must advance" })
    .toBeGreaterThan(t1);

  await shot(page, 'actors-warden-poacher');

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
