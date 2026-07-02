import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors } from './helpers';

/**
 * Drivable-jeep E2E (WORLD-PLAN W5.1). The ranger walks up to the parked jeep,
 * presses Space to climb in ("Stap in"), drives it ≥ 10 m, then presses Space to
 * step out ("Stap uit"). A second run under emulated reduced-motion proves the
 * comfort caps bind (top speed ~3 m/s, turn-rate halved) while the same drive
 * still works. Both runs assert the motion-comfort invariants hold in the jeep:
 * FOV stays fixed (55) and roll stays 0.
 *
 * State-only asserts against the dev hook (headless SwiftShader renders
 * deterministically enough for state, not pixels — §3.1). Navigation reuses the
 * frozen camera-relative arrow-walk (interact.spec pattern): read the jeep's
 * world position + live proximity from the hook, steer toward it until
 * `vehicle().near` reports arrival, then use the real Space-interact path.
 */

interface Vehicle {
  placed: boolean; near: boolean; inVehicle: boolean;
  x: number; z: number; heading: number;
  speed: number; maxSpeed: number; turnRate: number;
  camDist: number; camHeight: number; fov: number; roll: number;
}
interface Hook {
  screen: string;
  pos(): { x: number; z: number } | null;
  cameraYaw(): number | null;
  vehicle(): Vehicle | null;
}
function hook<T>(page: Page, fn: (r: Hook) => T): Promise<T | null> {
  return page.evaluate((body) => {
    const r = (window as unknown as { __ranger?: unknown }).__ranger;
    // eslint-disable-next-line no-new-func
    return r ? (new Function('r', `return (${body})(r)`))(r) : null;
  }, fn.toString()) as Promise<T | null>;
}

/** Drive title → avatar → world (W2.1: world is the front door); return once screen === 'world'. */
async function enterWorld(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByRole('button', { name: 'Dit is mijn ranger' }).click();
  await expect.poll(() => hook(page, (r) => r.screen), { timeout: 30_000 }).toBe('world');
}

const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const;

/**
 * Steer the ranger to the parked jeep with arrow keys until `vehicle().near`.
 * Same camera-relative mapping as interact.spec: the follow-cam rotates, so each
 * tick we read the live `cameraYaw()` and map the desired WORLD direction back to
 * screen keys with the inverse of `resolveInput`'s rotation (its own inverse).
 */
async function walkToJeep(page: Page): Promise<void> {
  const v0 = await hook(page, (r) => r.vehicle());
  expect(v0, 'vehicle() available in world').not.toBeNull();
  expect(v0!.placed, 'the jeep is placed in the world').toBe(true);
  const target = { x: v0!.x, z: v0!.z };

  const down = new Set<string>();
  const sync = async (want: Set<string>): Promise<void> => {
    for (const k of KEYS) {
      if (want.has(k) && !down.has(k)) { await page.keyboard.down(k); down.add(k); }
      else if (!want.has(k) && down.has(k)) { await page.keyboard.up(k); down.delete(k); }
    }
  };
  try {
    for (let i = 0; i < 240; i++) {
      const near = await hook(page, (r) => r.vehicle()?.near ?? false);
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
    throw new Error('ranger never reached the jeep within the step budget');
  } finally {
    await sync(new Set());
  }
}

/** From standing beside the jeep, press Space to climb in; wait for inVehicle. */
async function enterJeep(page: Page): Promise<void> {
  await expect
    .poll(() => hook(page, (r) => r.vehicle()?.near ?? false), { timeout: 20_000 })
    .toBe(true);
  await page.keyboard.press('Space'); // real interact path → World.enterVehicle
  await expect
    .poll(() => hook(page, (r) => r.vehicle()?.inVehicle ?? false), {
      timeout: 10_000, message: 'Space at the jeep climbs in',
    })
    .toBe(true);
}

/** Hold ArrowUp until the jeep has driven ≥ 10 m from `start`, then release. */
async function driveForward(page: Page, start: { x: number; z: number }): Promise<void> {
  await page.keyboard.down('ArrowUp');
  try {
    await expect
      .poll(async () => {
        const v = await hook(page, (r) => r.vehicle());
        return v ? Math.hypot(v.x - start.x, v.z - start.z) : 0;
      }, { timeout: 40_000, message: 'the jeep drives ≥ 10 m on the throttle' })
      .toBeGreaterThanOrEqual(10);
  } finally {
    await page.keyboard.up('ArrowUp');
  }
}

test('vehicle: enter the jeep, drive ≥10 m, step out — FOV + roll comfort holds', async ({ page }, testInfo) => {
  test.setTimeout(120_000); // a real-time walk-to + drive on ~10× slower SwiftShader
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await enterWorld(page);
  const walkCam = (await hook(page, (r) => r.vehicle()))!.camDist;

  await walkToJeep(page);
  const enterBtn = page.locator('.explore-vehicle-enter');
  await expect(enterBtn, 'the "Stap in" affordance shows beside the jeep').toBeVisible();
  await shot(page, 'vehicle-at-jeep');

  await enterJeep(page);

  // in the jeep: wider camera, full-motion caps, comfort invariants.
  const vin = (await hook(page, (r) => r.vehicle()))!;
  expect(vin.camDist, 'the jeep pulls the camera back (wider than walking)').toBeGreaterThan(walkCam);
  expect(vin.maxSpeed, 'full-motion top speed ≈ 6 m/s').toBeCloseTo(6, 5);
  expect(vin.turnRate, 'full-motion turn-rate ≈ 1.2 rad/s').toBeCloseTo(1.2, 5);
  expect(vin.fov, 'FOV stays fixed at 55 (motion-comfort law)').toBeCloseTo(55, 3);
  expect(Math.abs(vin.roll), 'roll stays 0 (motion-comfort law)').toBeLessThan(1e-3);

  const start = { x: vin.x, z: vin.z };
  await driveForward(page, start);
  await shot(page, 'vehicle-driving');

  // comfort holds mid-drive too
  const mid = (await hook(page, (r) => r.vehicle()))!;
  expect(mid.fov, 'FOV fixed while driving').toBeCloseTo(55, 3);
  expect(Math.abs(mid.roll), 'roll 0 while driving').toBeLessThan(1e-3);

  // step out — back on foot, position finite and inside the rim
  await page.keyboard.press('Space');
  await expect
    .poll(() => hook(page, (r) => r.vehicle()?.inVehicle ?? true), {
      timeout: 10_000, message: 'Space in the jeep steps out',
    })
    .toBe(false);
  const p = await hook(page, (r) => r.pos());
  expect(p).not.toBeNull();
  expect(Number.isFinite(p!.x) && Number.isFinite(p!.z), 'on-foot pos stays finite').toBe(true);
  expect(Math.hypot(p!.x, p!.z), 'ranger stays inside the world rim').toBeLessThanOrEqual(116);
  await shot(page, 'vehicle-stepped-out');

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});

test('vehicle: reduced-motion caps speed ~3 m/s and halves the turn-rate', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);

  // OS-level reduce → prefersReducedMotion() true → the vehicle comfort caps bind.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enterWorld(page);

  await walkToJeep(page);
  await enterJeep(page);

  const vin = (await hook(page, (r) => r.vehicle()))!;
  expect(vin.maxSpeed, 'reduced-motion halves top speed to ~3 m/s').toBeCloseTo(3, 5);
  expect(vin.turnRate, 'reduced-motion halves the turn-rate to ~0.6 rad/s').toBeCloseTo(0.6, 5);
  expect(vin.fov, 'FOV fixed under reduced-motion').toBeCloseTo(55, 3);
  expect(Math.abs(vin.roll), 'roll 0 under reduced-motion').toBeLessThan(1e-3);

  // still drivable ≥ 10 m under the caps
  await driveForward(page, { x: vin.x, z: vin.z });
  await shot(page, 'vehicle-reduced-motion-driving');

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
