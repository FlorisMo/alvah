import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors, keySteer } from './helpers';

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
  frames(): number | null;
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
 * Steer the ranger to the parked jeep with arrow keys until `vehicle().near` (the
 * tank keys: helpers.keySteer turns him until it is ahead, then walks).
 */
async function walkToJeep(page: Page): Promise<void> {
  const v0 = await hook(page, (r) => r.vehicle());
  expect(v0, 'vehicle() available in world').not.toBeNull();
  expect(v0!.placed, 'the jeep is placed in the world').toBe(true);
  // come up to its open south side: the stuifzand marker stands 1.6 m north of the
  // jeep, and on foot a mission's prompt comes before "Stap in de jeep"
  const target = { x: v0!.x, z: v0!.z - 1.2 };

  const down = new Set<string>();
  const sync = async (want: Set<string>): Promise<void> => {
    for (const k of KEYS) {
      if (want.has(k) && !down.has(k)) { await page.keyboard.down(k); down.add(k); }
      else if (!want.has(k) && down.has(k)) { await page.keyboard.up(k); down.delete(k); }
    }
  };
  const steer = await keySteer(page);
  try {
    for (let i = 0; i < 240; i++) {
      const near = await hook(page, (r) => r.vehicle()?.near ?? false);
      if (near) return;
      const p = await hook(page, (r) => r.pos());
      const yaw = await hook(page, (r) => r.cameraYaw());
      if (!p || yaw == null) { await page.waitForTimeout(100); continue; }
      const dx = target.x - p.x, dz = target.z - p.z;
      await sync(steer(dx, dz, yaw)); // the arrow keys a child would hold (helpers.keySteer)
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

/** Hold keys for `n` rendered frames (at most 60 s), then let go: the game clock clamps a
 *  long frame, so on a loaded machine a fixed hold in wall-clock time drives less far. */
async function holdFrames(page: Page, keys: string[], n: number): Promise<void> {
  const f0 = (await hook(page, (r) => r.frames()))!;
  for (const k of keys) await page.keyboard.down(k);
  try {
    await page.waitForFunction(({ f0, n }) => ((window as unknown as { __ranger: { frames(): number } }).__ranger.frames() - f0) >= n, { f0, n }, { timeout: 60_000, polling: 50 });
  } finally { for (const k of keys) await page.keyboard.up(k); }
}

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

  // A tree to drive into, and a run-up to it like a player lines one up: a start point
  // Q in open ground ahead of the jeep and a point P 12 m out from the trunk, Q–P–trunk
  // on one straight line that every other solid (tree, landmark, prop, bench, board) and
  // keep-out zone (marker, helipad: the jeep bends round those) stays clear of.
  const plan = await page.evaluate(() => {
    const r = (window as unknown as { __ranger: Hook & { heli(): { pads: { x: number; z: number }[] } | null } }).__ranger;
    const v = r.vehicle()!;
    const trees = r.treeSpots() ?? [];
    type C = { x: number; z: number; r: number; t?: object; zone?: boolean };
    const others: C[] = [
      ...trees.map((t) => ({ x: t.x, z: t.z, r: 0.6 * t.s, t })),
      ...(r.landmarks() ?? []).map((l) => ({ x: l.x, z: l.z, r: 2.6 })),
      ...(r.dressing() ?? []).map((d) => ({ x: d.x, z: d.z, r: 1 })),
      ...(r.markers() ?? []).map((m) => ({ x: m.x, z: m.z, r: 5.2, zone: true })),
      ...(r.heli()?.pads ?? []).map((p) => ({ x: p.x, z: p.z, r: 3.6, zone: true })),
      ...[r.sitSpot(), r.board()].filter((o): o is { x: number; z: number } => !!o).map((o) => ({ x: o.x, z: o.z, r: 0.7 })),
    ];
    const gap = (o: C, ax: number, az: number, bx: number, bz: number): number => {
      const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
      const k = Math.max(0, Math.min(1, ((o.x - ax) * dx + (o.z - az) * dz) / L2));
      return Math.hypot(o.x - (ax + dx * k), o.z - (az + dz * k)) - o.r;
    };
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    let best: { t: { x: number; z: number; s: number }; P: { x: number; z: number }; Q: { x: number; z: number }; cost: number } | null = null;
    for (const t of trees) {
      const d = Math.hypot(t.x - v.x, t.z - v.z);
      if (d < 6 || d > 45) continue;
      for (let a = 0; a < 24; a++) {
        const ux = Math.sin((a * Math.PI) / 12), uz = Math.cos((a * Math.PI) / 12);
        const P = { x: t.x + ux * 12, z: t.z + uz * 12 }, Q = { x: t.x + ux * 20, z: t.z + uz * 20 };
        if (Math.hypot(Q.x, Q.z) > 60) continue;
        // the jeep bends round a keep-out zone it sees ~1.5 s ahead of its nose, so a zone
        // just BEHIND the trunk would steer it off the line before it arrives: keep the
        // line's continuation past the trunk clear of zones too
        const B = { x: t.x - ux * 10, z: t.z - uz * 10 };
        const ok = others.every((o) => o.t === t || (gap(o, Q.x, Q.z, t.x, t.z) > 1.6 && gap(o, v.x, v.z, Q.x, Q.z) > 1.6 && gap(o, Q.x, Q.z, Q.x, Q.z) > 6
          && (!o.zone || gap(o, t.x, t.z, B.x, B.z) > 1.6)));
        if (!ok) continue;
        const ahead = (Q.x - v.x) * fx + (Q.z - v.z) * fz;
        const cost = Math.hypot(Q.x - v.x, Q.z - v.z) - ahead; // prefer a start point ahead of the nose
        if (!best || cost < best.cost) best = { t, P, Q, cost };
      }
    }
    return best;
  });
  expect(plan, 'a tree with a clear straight run-up').not.toBeNull();
  const tree = plan!.t;
  // drive the run-up with the arrow keys: Up + steer toward Q, then toward P
  const driveTo = async (goal: { x: number; z: number }, within: number, coastAt = 0): Promise<void> => {
    const held = new Set<string>();
    const set = async (k: string, on: boolean): Promise<void> => {
      if (on && !held.has(k)) { await page.keyboard.down(k); held.add(k); } else if (!on && held.has(k)) { await page.keyboard.up(k); held.delete(k); }
    };
    try {
      for (let i = 0; i < 300; i++) {
        const v = (await hook(page, (r) => r.vehicle()))!;
        if (Math.hypot(goal.x - v.x, goal.z - v.z) < within) break;
        const want = Math.atan2(goal.x - v.x, goal.z - v.z);
        const e = Math.atan2(Math.sin(want - v.heading), Math.cos(want - v.heading));
        await set('ArrowUp', Math.hypot(goal.x - v.x, goal.z - v.z) > coastAt || Math.abs(v.speed) < 1);
        await set('ArrowLeft', e > 0.1);
        await set('ArrowRight', e < -0.1);
        await page.waitForTimeout(80);
      }
    } finally { for (const k of [...held]) await page.keyboard.up(k); }
  };
  await driveTo(plan!.Q, 3);
  await driveTo(plan!.P, 2, 7); // coast the last metres, so it comes to rest ON the run-up line, not metres past P
  // let it roll out, then line the nose up on the trunk with short taps (it never pivots).
  // Wait for the jeep itself, not for a fixed time: on a loaded machine it is still
  // rolling after 1.2 s, and the taps then aim a moving jeep.
  const rest = async (): Promise<void> => {
    await expect.poll(async () => Math.abs((await hook(page, (r) => r.vehicle()))!.speed), { timeout: 30_000, message: 'the jeep rolls to a stop' }).toBeLessThan(0.05);
  };
  await rest();
  const aim = async (): Promise<number> => {
    const v = (await hook(page, (r) => r.vehicle()))!;
    const want = Math.atan2(tree.x - v.x, tree.z - v.z);
    return Math.atan2(Math.sin(want - v.heading), Math.cos(want - v.heading));
  };
  for (let i = 0; i < 200; i++) {
    const e = await aim();
    if (Math.abs(e) < 0.05) break;
    await hold(page, [e > 0 ? 'ArrowLeft' : 'ArrowRight'], Math.min(250, 60 + Math.abs(e) * 400));
  }
  await rest();
  expect(Math.abs(await aim()), 'the nose is lined up on the trunk').toBeLessThan(0.1);
  const trunk = { x: tree.x, z: tree.z, r: 0.6 * tree.s };

  // full gas straight at it until it stops, then let go, like a child who drove into a
  // tree: it brakes by itself and rests against the trunk. Judged at the moment it stops,
  // in rendered frames (not a fixed 5 s of wall clock: on a loaded machine the game clock
  // clamps each long frame, and with the gas still held the jeep slides slowly round the
  // trunk and drives on, so where a fixed window ends is luck).
  let minGap = Infinity;
  let jolt = 0;
  let peak = 0;
  let stop: Vehicle | null = null;
  let prev: (Vehicle & { t: number }) | null = null;
  await page.keyboard.down('ArrowUp');
  try {
    const t0 = Date.now();
    const f0 = (await hook(page, (r) => r.frames()))!;
    while ((await hook(page, (r) => r.frames()))! - f0 < 600 && Date.now() - t0 < 60_000) {
      const v = { ...(await hook(page, (r) => r.vehicle()))!, t: Date.now() };
      minGap = Math.min(minGap, bodyGap(v, trunk));
      // a crash = the speed dropping far faster than the ~6 m/s² soft brake
      if (prev && (prev.speed - v.speed) / Math.max(0.05, (v.t - prev.t) / 1000) > 15) jolt += 1;
      prev = v;
      peak = Math.max(peak, v.speed);
      if (peak > 2 && Math.abs(v.speed) < 0.1) { stop = v; break; } // it drove, and now it stands
      await page.waitForTimeout(40);
    }
  } finally {
    await page.keyboard.up('ArrowUp');
  }
  expect(stop, `it came to a stop (top speed ${peak.toFixed(1)} m/s)`).not.toBeNull();
  const atTree = stop!;
  await shot(page, 'vehicle-at-tree');
  expect(minGap, 'the jeep body never drives into the trunk').toBeGreaterThan(-0.05);
  expect(bodyGap(atTree, trunk), 'it came to rest AT the trunk').toBeLessThan(0.5);
  expect(jolt, 'no crash: it slows down before it touches').toBe(0);

  // it never gets stuck: gas + a turn key swings it free along the trunk. A child tries
  // one way, then the other (a second trunk can close off one side of the nose).
  let free = atTree;
  for (const turn of ['ArrowLeft', 'ArrowRight']) {
    const from = (await hook(page, (r) => r.vehicle()))!;
    await holdFrames(page, ['ArrowUp', turn], 180); // 3 s of play at 60 fps
    free = (await hook(page, (r) => r.vehicle()))!;
    expect(bodyGap(free, trunk), 'still never inside the trunk').toBeGreaterThan(-0.05);
    if (Math.hypot(free.x - from.x, free.z - from.z) > 2) break;
  }
  expect(Math.hypot(free.x - atTree.x, free.z - atTree.z), 'gas + a turn key drives on past the tree').toBeGreaterThan(2);

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
