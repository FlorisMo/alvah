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
  x: number; z: number; y: number; heading: number;
  speed: number; maxSpeed: number; turnRate: number;
  camDist: number; camHeight: number; fov: number; roll: number;
  nearAnimal: boolean; dust: boolean; contact: boolean;
  clearance: number; grounded: boolean; driverSeated: boolean; markerDist: number;
}
interface Animal { id: string; x: number; z: number; h: number }
interface Hook {
  screen: string;
  pos(): { x: number; z: number } | null;
  cameraYaw(): number | null;
  vehicle(): Vehicle | null;
  ambient(): Animal[] | null;
  treeSpots(): { x: number; z: number; s: number }[] | null;
  landmarks(): { x: number; z: number }[] | null;
  dressing(): { x: number; z: number }[] | null;
  markers(): { x: number; z: number }[] | null;
  sitSpot(): { x: number; z: number } | null;
  board(): { x: number; z: number } | null;
  shapeAt(x: number, z: number, dx: number, dz: number): { id: string; along: number; across: number } | null;
}
/** The jeep's footprint (core/vehicle.ts JEEP_BODY): circles along its axis. */
const JEEP_BODY = [{ along: 1.0, r: 0.9 }, { along: 0, r: 0.95 }, { along: -1.0, r: 0.9 }];
/** The gap (m) between the jeep's body and a circle; < 0 = inside it. */
function bodyGap(v: Vehicle, c: { x: number; z: number; r: number }): number {
  const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
  return Math.min(...JEEP_BODY.map((b) => Math.hypot(v.x + fx * b.along - c.x, v.z + fz * b.along - c.z) - b.r - c.r));
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
  const parked = (await hook(page, (r) => r.vehicle()))!;
  const walkCam = parked.camDist;
  expect(parked.markerDist, 'the jeep parks ≥ 6 m from every mission marker').toBeGreaterThanOrEqual(6);
  expect(Math.abs(parked.clearance), 'parked, it sits on the drawn ground (not hovering)').toBeLessThan(0.1);

  await walkToJeep(page);
  const enterBtn = page.locator('.explore-vehicle-enter');
  await expect(enterBtn, 'the "Stap in" affordance shows beside the jeep').toBeVisible();
  await shot(page, 'vehicle-at-jeep');

  await enterJeep(page);

  // in the jeep: wider camera, full-motion caps, comfort invariants, a seated driver.
  const vin = (await hook(page, (r) => r.vehicle()))!;
  expect(vin.driverSeated, 'the ranger sits in the driver seat (posed, seen — not hidden, not standing)').toBe(true);
  expect(vin.camDist, 'the jeep pulls the camera back (wider than walking)').toBeGreaterThan(walkCam);
  expect(vin.maxSpeed, 'full-motion top speed ≈ 6 m/s').toBeCloseTo(6, 5);
  expect(vin.turnRate, 'full-motion turn-rate ≈ 1.2 rad/s').toBeCloseTo(1.2, 5);
  expect(vin.fov, 'FOV stays fixed at 55 (motion-comfort law)').toBeCloseTo(55, 3);
  expect(Math.abs(vin.roll), 'roll stays 0 (motion-comfort law)').toBeLessThan(1e-3);

  // W5.2: dust kicks up while driving. The jeep is parked clear of any animal
  // (nearest ~15 m), so it drives at full pace here → dust emits (motion on).
  await page.keyboard.down('ArrowUp');
  await expect
    .poll(() => hook(page, (r) => r.vehicle()?.dust ?? false), {
      timeout: 20_000, message: 'W5.2: dust kicks up behind the driving jeep',
    })
    .toBe(true);
  await page.keyboard.up('ArrowUp');

  const start = { x: vin.x, z: vin.z };
  await driveForward(page, start);
  await shot(page, 'vehicle-driving');
  const shape = await page.evaluate(([sx, sz]) => {
    const r = (window as unknown as { __ranger: Hook }).__ranger;
    const now = r.vehicle()!;
    return r.shapeAt(now.x, now.z, now.x - sx, now.z - sz);
  }, [start.x, start.z]);
  expect(shape, 'the jeep model is found where it drove').not.toBeNull();
  expect(shape!.along, 'it drives nose-first: longer along its travel than across').toBeGreaterThan(shape!.across);

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

  // W5.2: dust is secondary motion → OFF under reduced-motion. Hold the throttle
  // and confirm the jeep drives (moves) while dust never emits across the drive.
  await page.keyboard.down('ArrowUp');
  try {
    await expect
      .poll(async () => {
        const v = await hook(page, (r) => r.vehicle());
        return v ? Math.hypot(v.x - vin.x, v.z - vin.z) : 0;
      }, { timeout: 20_000, message: 'the jeep still drives under reduced-motion' })
      .toBeGreaterThanOrEqual(3);
    const v = await hook(page, (r) => r.vehicle());
    expect(v!.dust, 'W5.2: no dust under reduced-motion (secondary motion off)').toBe(false);
  } finally {
    await page.keyboard.up('ArrowUp');
  }

  // still drivable ≥ 10 m under the caps
  await driveForward(page, { x: vin.x, z: vin.z });
  await shot(page, 'vehicle-reduced-motion-driving');

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});

test('vehicle: auto-slows to a crawl near a wandering animal (calm rule)', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);

  // full-motion (animals wander) so the ree is a real, reachable target.
  await enterWorld(page);
  await walkToJeep(page);
  await enterJeep(page);

  // Steer the jeep toward the roaming ree with the throttle held; the arcade
  // controller turns the nose (right-steer decreases heading) while it drives.
  const down = new Set<string>();
  const setKey = async (k: string, on: boolean): Promise<void> => {
    if (on && !down.has(k)) { await page.keyboard.down(k); down.add(k); }
    else if (!on && down.has(k)) { await page.keyboard.up(k); down.delete(k); }
  };
  await setKey('ArrowUp', true);
  let reached = false;
  try {
    for (let i = 0; i < 300; i++) {
      const v = await hook(page, (r) => r.vehicle());
      const animals = await hook(page, (r) => r.ambient());
      if (!v || !animals) { await page.waitForTimeout(100); continue; }
      if (v.nearAnimal) { reached = true; break; }
      const ree = animals.find((a) => a.id === 'animal-ree-roedeer') ?? animals[0];
      // desired world heading toward the ree; steer to close the yaw error. Right
      // (+) DECREASES heading (vehicle.ts), so a positive error → steer left.
      const desired = Math.atan2(ree.x - v.x, ree.z - v.z);
      const e = Math.atan2(Math.sin(desired - v.heading), Math.cos(desired - v.heading));
      await setKey('ArrowLeft', e > 0.12);
      await setKey('ArrowRight', e < -0.12);
      await page.waitForTimeout(100);
    }
    expect(reached, 'the jeep drives up to the ree within the step budget').toBe(true);

    // Stop steering, keep the throttle floored → the auto-slow holds the crawl.
    await setKey('ArrowLeft', false);
    await setKey('ArrowRight', false);
    await expect
      .poll(() => hook(page, (r) => r.vehicle()?.speed ?? 0), {
        timeout: 10_000, message: 'W5.2: auto-slow holds the jeep to ≤ 2 m/s near the animal',
      })
      .toBeLessThanOrEqual(2.05);

    const v = (await hook(page, (r) => r.vehicle()))!;
    expect(v.nearAnimal, 'still within the auto-slow radius of the animal').toBe(true);
    expect(v.speed, 'the jeep is still creeping forward, not stopped').toBeGreaterThan(0.2);
    expect(v.maxSpeed, 'the arcade cap stays 6 — the crawl is the auto-slow, not the cap').toBeCloseTo(6, 5);
  } finally {
    for (const k of [...down]) await page.keyboard.up(k);
  }
  await shot(page, 'vehicle-auto-slow-near-animal');

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});

/** Hold keys for `ms`, then let go. */
async function hold(page: Page, keys: string[], ms: number): Promise<void> {
  for (const k of keys) await page.keyboard.down(k);
  try { await page.waitForTimeout(ms); } finally { for (const k of keys) await page.keyboard.up(k); }
}

test('vehicle: a tree stops the jeep softly — its body never enters the trunk, and it steers free', async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);
  await enterWorld(page);
  await walkToJeep(page);
  await enterJeep(page);

  // a tree with a clear straight run to it from where the jeep stands: every other
  // solid (tree, landmark, prop, marker, bench, board) stays clear of the jeep's path
  const tree = (await hook(page, (r) => {
    const v = r.vehicle()!;
    const trees = r.treeSpots() ?? [];
    type C = { x: number; z: number; r: number; t?: object };
    const others: C[] = [
      ...trees.map((t) => ({ x: t.x, z: t.z, r: 0.6 * t.s, t })),
      ...(r.landmarks() ?? []).map((l) => ({ x: l.x, z: l.z, r: 2.6 })),
      ...(r.dressing() ?? []).map((d) => ({ x: d.x, z: d.z, r: 1 })),
      ...(r.markers() ?? []).map((m) => ({ x: m.x, z: m.z, r: 5.2 })), // a marker is a keep-out zone for the jeep
      ...[r.sitSpot(), r.board()].filter((o): o is { x: number; z: number } => !!o).map((o) => ({ x: o.x, z: o.z, r: 0.7 })),
    ];
    const clear = (t: object & { x: number; z: number }): boolean => others.every((o) => {
      if (o.t === t) return true;
      const dx = t.x - v.x, dz = t.z - v.z, L2 = dx * dx + dz * dz;
      const k = Math.max(0, Math.min(1, ((o.x - v.x) * dx + (o.z - v.z) * dz) / L2));
      return Math.hypot(o.x - (v.x + dx * k), o.z - (v.z + dz * k)) > o.r + 1.3; // body half-width + room
    });
    return trees
      .filter((t) => { const d = Math.hypot(t.x - v.x, t.z - v.z); return d > 10 && d < 40 && clear(t); })
      .sort((a, b) => Math.hypot(a.x - v.x, a.z - v.z) - Math.hypot(b.x - v.x, b.z - v.z))[0] ?? null;
  }))!;
  expect(tree, 'a tree with a clear run to it').not.toBeNull();
  const trunk = { x: tree.x, z: tree.z, r: 0.6 * tree.s };

  // turn to face it (short taps; a turn needs a little roll, never a pivot)
  for (let i = 0; i < 80; i++) {
    const v = (await hook(page, (r) => r.vehicle()))!;
    const want = Math.atan2(trunk.x - v.x, trunk.z - v.z);
    const e = Math.atan2(Math.sin(want - v.heading), Math.cos(want - v.heading));
    if (Math.abs(e) < 0.05) break;
    await hold(page, [e > 0 ? 'ArrowLeft' : 'ArrowRight'], Math.min(250, 60 + Math.abs(e) * 400));
  }
  await page.waitForTimeout(800);

  // full gas straight at it for 5 s: it brakes by itself and rests against the trunk
  let minGap = Infinity;
  let jolt = 0;
  let prev: (Vehicle & { t: number }) | null = null;
  await page.keyboard.down('ArrowUp');
  try {
    const t0 = Date.now();
    while (Date.now() - t0 < 5_000) {
      const v = { ...(await hook(page, (r) => r.vehicle()))!, t: Date.now() };
      minGap = Math.min(minGap, bodyGap(v, trunk));
      // a crash = the speed dropping far faster than the ~6 m/s² soft brake
      if (prev && (prev.speed - v.speed) / Math.max(0.05, (v.t - prev.t) / 1000) > 15) jolt += 1;
      prev = v;
      await page.waitForTimeout(80);
    }
  } finally {
    await page.keyboard.up('ArrowUp');
  }
  const atTree = (await hook(page, (r) => r.vehicle()))!;
  await shot(page, 'vehicle-at-tree');
  expect(minGap, 'the jeep body never drives into the trunk').toBeGreaterThan(-0.05);
  expect(bodyGap(atTree, trunk), 'it came to rest AT the trunk').toBeLessThan(0.5);
  expect(jolt, 'no crash: it slows down before it touches').toBe(0);

  // it never gets stuck: gas + a turn key swings it free along the trunk
  await hold(page, ['ArrowUp', 'ArrowLeft'], 3_000);
  const free = (await hook(page, (r) => r.vehicle()))!;
  expect(Math.hypot(free.x - atTree.x, free.z - atTree.z), 'gas + left drives on past the tree').toBeGreaterThan(2);
  expect(bodyGap(free, trunk), 'still never inside the trunk').toBeGreaterThan(-0.05);

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});

test('vehicle: the stick pushed only sideways still drives and turns (audit veh-05)', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);
  await page.addInitScript(() => {
    localStorage.setItem('alvah-ef-v1', JSON.stringify({ ranger: { settings: { joystick: 'aan' } } }));
  });
  await enterWorld(page);
  await walkToJeep(page);
  await page.locator('.explore-vehicle-enter').click();
  await expect.poll(() => hook(page, (r) => r.vehicle()?.inVehicle ?? false)).toBe(true);
  await expect(page.locator('.explore-drive-hint'), 'a line says how to drive').toBeVisible();

  const stick = page.locator('.rj-base');
  await expect(stick).toBeVisible();
  const box = (await stick.boundingBox())!;
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const a = (await hook(page, (r) => r.vehicle()))!;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 100, cy, { steps: 8 }); // straight RIGHT, no forward at all
  await page.waitForTimeout(3_000);
  await page.mouse.up();
  const b = (await hook(page, (r) => r.vehicle()))!;
  expect(Math.hypot(b.x - a.x, b.z - a.z), 'a sideways push rolls the jeep forward').toBeGreaterThan(2);
  const turned = Math.atan2(Math.sin(b.heading - a.heading), Math.cos(b.heading - a.heading));
  expect(turned, 'and turns it to the right (right lowers the yaw)').toBeLessThan(-0.3);

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
