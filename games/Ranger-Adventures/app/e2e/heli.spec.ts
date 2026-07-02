import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors } from './helpers';

/**
 * Helicopter E2E (WORLD-PLAN W5.3b). The opt-in aircraft is parked on the
 * stuifzand helipad. With the "Helikopter" toggle ON (seeded into the ranger
 * settings before boot) and full motion, the ranger walks up to it, presses Space
 * to lift off, flies pad-to-pad to the BOA-post helipad, and lands there. The
 * flight asserts the LOCKED comfort law throughout: FOV stays fixed (55), the
 * horizon stays level (roll 0), the climb never exceeds 2 m/s, and yaw is damped
 * (it changes with steering but never whips). A second run under emulated
 * reduced-motion proves flight is WITHHELD entirely (a calm "aan de grond" message
 * shows and Space does not lift off) — the one mode too motion-heavy to merely calm.
 *
 * State-only asserts against the dev hook (headless SwiftShader renders
 * deterministically enough for state, not pixels — §3.1).
 */

interface Heli {
  placed: boolean; available: boolean; optIn: boolean; near: boolean; inHeli: boolean; onPad: boolean;
  x: number; z: number; heading: number; altitude: number;
  speed: number; climbRate: number; cruiseHeight: number; maxSpeed: number; turnRate: number;
  camDist: number; camHeight: number; fov: number; roll: number; vignette: number;
  pads: { x: number; z: number }[];
}
interface Hook {
  screen: string;
  pos(): { x: number; z: number } | null;
  cameraYaw(): number | null;
  heli(): Heli | null;
}
function hook<T>(page: Page, fn: (r: Hook) => T): Promise<T | null> {
  return page.evaluate((body) => {
    const r = (window as unknown as { __ranger?: unknown }).__ranger;
    // eslint-disable-next-line no-new-func
    return r ? (new Function('r', `return (${body})(r)`))(r) : null;
  }, fn.toString()) as Promise<T | null>;
}

/** Seed the ranger settings so the opt-in helicopter is ON before the store loads
 *  (persist co-tenants under `alvah-ef-v1` → `ranger`). */
async function optInHelicopter(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('alvah-ef-v1', JSON.stringify({ ranger: { settings: { helikopter: true } } }));
  });
}

/** Drive title → avatar → world (W2.1: world is the front door). */
async function enterWorld(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByRole('button', { name: 'Dit is mijn ranger' }).click();
  await expect.poll(() => hook(page, (r) => r.screen), { timeout: 30_000 }).toBe('world');
}

const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const;

/** Steer the ranger to the parked helicopter with arrow keys until `heli().near`.
 *  Same camera-relative mapping as the jeep/interact specs (the follow-cam rotates,
 *  so each tick we read the live `cameraYaw()` and map the world direction back to
 *  screen keys with the inverse of `resolveInput`'s rotation). */
async function walkToHeli(page: Page): Promise<void> {
  const h0 = await hook(page, (r) => r.heli());
  expect(h0, 'heli() available in world').not.toBeNull();
  expect(h0!.placed, 'the helicopter is placed in the world').toBe(true);
  const target = { x: h0!.x, z: h0!.z };

  const down = new Set<string>();
  const sync = async (want: Set<string>): Promise<void> => {
    for (const k of KEYS) {
      if (want.has(k) && !down.has(k)) { await page.keyboard.down(k); down.add(k); }
      else if (!want.has(k) && down.has(k)) { await page.keyboard.up(k); down.delete(k); }
    }
  };
  try {
    for (let i = 0; i < 240; i++) {
      const near = await hook(page, (r) => r.heli()?.near ?? false);
      if (near) return;
      const p = await hook(page, (r) => r.pos());
      const yaw = await hook(page, (r) => r.cameraYaw());
      if (!p || yaw == null) { await page.waitForTimeout(100); continue; }
      const dx = target.x - p.x, dz = target.z - p.z;
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
    throw new Error('ranger never reached the helicopter within the step budget');
  } finally {
    await sync(new Set());
  }
}

test('heli: fly pad-to-pad — FOV fixed, roll 0, climb ≤2 m/s, damped yaw, then land', async ({ page }, testInfo) => {
  test.setTimeout(180_000); // a real-time walk-to + climb + cruise + descent on ~10× slower SwiftShader
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await optInHelicopter(page);
  await enterWorld(page);

  await walkToHeli(page);
  const avail = (await hook(page, (r) => r.heli()))!;
  expect(avail.available, 'opt-in + full motion → the helicopter is available').toBe(true);
  const enterBtn = page.locator('.explore-heli-enter');
  await expect(enterBtn, 'the "Stap in de helikopter" affordance shows beside it').toBeVisible();
  await shot(page, 'heli-at-pad');

  // lift off via the real Space-interact path.
  await page.keyboard.press('Space');
  await expect
    .poll(() => hook(page, (r) => r.heli()?.inHeli ?? false), {
      timeout: 10_000, message: 'Space beside the heli lifts off',
    })
    .toBe(true);

  const padB = avail.pads[1]; // the BOA-post helipad on the western rim
  const start = { x: avail.x, z: avail.z };

  const down = new Set<string>();
  const setKey = async (k: string, on: boolean): Promise<void> => {
    if (on && !down.has(k)) { await page.keyboard.down(k); down.add(k); }
    else if (!on && down.has(k)) { await page.keyboard.up(k); down.delete(k); }
  };
  const assertComfort = (h: Heli): void => {
    expect(h.fov, 'FOV stays fixed at 55 while flying (comfort law)').toBeCloseTo(55, 3);
    expect(Math.abs(h.roll), 'roll stays 0 while flying (horizon always level)').toBeLessThan(1e-3);
    expect(Math.abs(h.climbRate), 'vertical speed within the LOCKED 2 m/s clamp').toBeLessThanOrEqual(2.05);
  };

  // 1) YAW PROBE: hover (no throttle) and steer — the nose yaws (the ONLY rotation)
  // and the follow-cam tracks it. Prove the swing reaches ≥ 45° (damped, present)
  // while the comfort law holds and the aircraft climbs toward cruise all the while.
  const yaw0 = (await hook(page, (r) => r.cameraYaw()))!;
  let maxYawDelta = 0;
  let sawClimb = false;
  await setKey('ArrowLeft', true);
  try {
    for (let i = 0; i < 120; i++) {
      const h = await hook(page, (r) => r.heli());
      const yaw = await hook(page, (r) => r.cameraYaw());
      if (!h || yaw == null) { await page.waitForTimeout(100); continue; }
      assertComfort(h);
      if (h.climbRate > 0.05) sawClimb = true;
      maxYawDelta = Math.max(maxYawDelta, Math.abs(Math.atan2(Math.sin(yaw - yaw0), Math.cos(yaw - yaw0))));
      if (maxYawDelta >= Math.PI / 4) break;
      await page.waitForTimeout(100);
    }
  } finally {
    await setKey('ArrowLeft', false);
  }
  expect(maxYawDelta, 'yaw is DAMPED but present — the camera followed the turn ≥ 45°')
    .toBeGreaterThanOrEqual(Math.PI / 4);

  // 2) fly toward pad B on the throttle, steering to close the heading error, still
  // asserting the comfort law every tick and watching the motion vignette fade in.
  let sawVignette = false;
  await setKey('ArrowUp', true);
  let reached = false;
  try {
    for (let i = 0; i < 400; i++) {
      const h = await hook(page, (r) => r.heli());
      if (!h) { await page.waitForTimeout(100); continue; }
      assertComfort(h);
      if (h.climbRate > 0.05) sawClimb = true;
      if (h.vignette > 0) sawVignette = true;
      const distB = Math.hypot(h.x - padB.x, h.z - padB.z);
      if (distB < 5) { reached = true; break; }
      // steer toward pad B; right (+) DECREASES heading (vehicle.ts), so a positive
      // yaw error → steer left.
      const desired = Math.atan2(padB.x - h.x, padB.z - h.z);
      const e = Math.atan2(Math.sin(desired - h.heading), Math.cos(desired - h.heading));
      await setKey('ArrowLeft', e > 0.12);
      await setKey('ArrowRight', e < -0.12);
      await page.waitForTimeout(100);
    }
    expect(reached, 'the helicopter flies across to the BOA-post pad within the budget').toBe(true);
  } finally {
    for (const k of [...down]) await page.keyboard.up(k);
  }

  const flew = Math.hypot(
    (await hook(page, (r) => r.heli()))!.x - start.x,
    (await hook(page, (r) => r.heli()))!.z - start.z,
  );
  expect(flew, 'genuinely flew pad-to-pad (≥ 40 m)').toBeGreaterThan(40);
  expect(sawClimb, 'the helicopter climbed toward cruise height').toBe(true);
  expect(sawVignette, 'the motion vignette faded in while translating').toBe(true);
  await shot(page, 'heli-flying');

  // land at pad B: over the pad the HUD offers "Land hier"; Space starts the
  // exp-damped descent and steps out at touchdown.
  await expect
    .poll(() => hook(page, (r) => r.heli()?.onPad ?? false), {
      timeout: 10_000, message: 'the helicopter hovers over the BOA-post pad',
    })
    .toBe(true);
  await page.keyboard.press('Space');
  await expect
    .poll(() => hook(page, (r) => r.heli()?.inHeli ?? true), {
      timeout: 60_000, message: 'Space over the pad lands + steps the ranger out',
    })
    .toBe(false);

  // landed on foot, beside pad B, inside the rim.
  const p = await hook(page, (r) => r.pos());
  expect(p).not.toBeNull();
  expect(Number.isFinite(p!.x) && Number.isFinite(p!.z), 'on-foot pos stays finite').toBe(true);
  expect(Math.hypot(p!.x - padB.x, p!.z - padB.z), 'stepped out beside the BOA-post pad').toBeLessThan(6);
  expect(Math.hypot(p!.x, p!.z), 'ranger stays inside the world rim').toBeLessThanOrEqual(116);
  await shot(page, 'heli-landed');

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});

test('heli: reduced-motion withholds flight — a calm message, Space does not lift off', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);

  // opted IN, but OS-level reduce → flight is withheld entirely (not merely calmed).
  await optInHelicopter(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enterWorld(page);

  await walkToHeli(page);
  const h = (await hook(page, (r) => r.heli()))!;
  expect(h.optIn, 'the toggle is ON').toBe(true);
  expect(h.available, 'but reduced-motion withholds the helicopter').toBe(false);

  // the calm "aan de grond" note shows (not an enter button).
  await expect(page.locator('.explore-heli-hint'), 'a calm unavailable message shows')
    .toBeVisible();
  await expect(page.locator('.explore-heli-enter'), 'no lift-off affordance under reduced-motion')
    .toHaveCount(0);
  await shot(page, 'heli-reduced-motion-grounded');

  // Space does nothing — the ranger never lifts off.
  await page.keyboard.press('Space');
  await page.waitForTimeout(600);
  expect((await hook(page, (r) => r.heli()))!.inHeli, 'Space cannot lift off under reduced-motion').toBe(false);

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
