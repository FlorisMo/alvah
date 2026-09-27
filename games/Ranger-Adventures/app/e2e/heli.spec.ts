import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors, keySteer } from './helpers';

/**
 * Helicopter E2E (WORLD-PLAN W5.3b, wave 2). The opt-in aircraft is parked on the
 * stuifzand helipad. The "Helikopter" toggle is switched ON the way a player does it
 * (Pauze → Instellingen → Helikopter, real clicks); with full motion the ranger walks
 * up, boards (he sits in the pilot's seat, it rests on the pad), lifts off with a
 * push, flies pad-to-pad to the BOA-post helipad facing where it flies, and lands on
 * the pad's centre; "Stap uit" gets him out. A second run proves "Land op de helipad"
 * always brings it down on the nearest pad (never stuck flying). The flight asserts
 * the LOCKED comfort law throughout: FOV fixed (55), horizon level (roll 0), climb
 * ≤ 2 m/s, yaw damped. A third run under emulated reduced-motion proves flight is
 * WITHHELD entirely (a calm "aan de grond" message, Space does not lift off).
 */

interface Heli {
  placed: boolean; available: boolean; optIn: boolean; near: boolean; inHeli: boolean; onPad: boolean;
  airborne: boolean; landing: boolean; pilotSeated: boolean; clearance: number;
  x: number; z: number; heading: number; altitude: number;
  speed: number; climbRate: number; cruiseHeight: number; maxSpeed: number; turnRate: number;
  camDist: number; camHeight: number; fov: number; roll: number; vignette: number;
  pads: { x: number; z: number }[]; padCue: { distance: number } | null;
}
interface Hook {
  screen: string;
  pos(): { x: number; z: number } | null;
  cameraYaw(): number | null;
  heli(): Heli | null;
  shapeAt(x: number, z: number, dx: number, dz: number): { id: string; along: number; across: number } | null;
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

/** Switch the helicopter on like a player: Pauze → Instellingen → Helikopter → Klaar
 *  → back to the open plek (real mouse clicks). */
async function switchOnInSettings(page: Page): Promise<void> {
  const click = async (name: RegExp): Promise<void> => {
    await page.getByRole('button', { name }).filter({ visible: true }).first().click();
  };
  await click(/Pauze/);
  await click(/Instellingen/);
  const sw = page.getByRole('switch', { name: 'Helikopter' });
  await sw.click();
  await expect(sw, 'the Helikopter switch turns on').toHaveAttribute('aria-checked', 'true');
  await click(/^Klaar$/);
  await click(/Terug naar de open plek/);
  await expect.poll(() => hook(page, (r) => r.heli()?.optIn ?? false), { message: 'the world reads the toggle live' }).toBe(true);
}

/** Drive title → avatar → world (W2.1: world is the front door). */
async function enterWorld(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByRole('button', { name: 'Dit is mijn ranger' }).click();
  await expect.poll(() => hook(page, (r) => r.screen), { timeout: 30_000 }).toBe('world');
}

const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const;

/** Steer the ranger to the parked helicopter with arrow keys until `heli().near`
 *  (the tank keys: helpers.keySteer turns him until it is ahead, then walks). */
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
  const steer = await keySteer(page);
  try {
    for (let i = 0; i < 240; i++) {
      const near = await hook(page, (r) => r.heli()?.near ?? false);
      if (near) return;
      const p = await hook(page, (r) => r.pos());
      const yaw = await hook(page, (r) => r.cameraYaw());
      if (!p || yaw == null) { await page.waitForTimeout(100); continue; }
      const dx = target.x - p.x, dz = target.z - p.z;
      await sync(steer(dx, dz, yaw)); // the arrow keys a child would hold (helpers.keySteer)
      await page.waitForTimeout(120);
    }
    throw new Error('ranger never reached the helicopter within the step budget');
  } finally {
    await sync(new Set());
  }
}

const assertComfort = (h: Heli): void => {
  expect(h.fov, 'FOV stays fixed at 55 while flying (comfort law)').toBeCloseTo(55, 3);
  expect(Math.abs(h.roll), 'roll stays 0 while flying (horizon always level)').toBeLessThan(1e-3);
  expect(Math.abs(h.climbRate), 'vertical speed within the LOCKED 2 m/s clamp').toBeLessThanOrEqual(2.05);
};

/** Board the parked helicopter by its button; it rests on the pad, pilot seated. */
async function board(page: Page): Promise<Heli> {
  await walkToHeli(page);
  const avail = (await hook(page, (r) => r.heli()))!;
  expect(avail.available, 'opt-in + full motion → the helicopter is available').toBe(true);
  const enterBtn = page.locator('.explore-heli-enter');
  await expect(enterBtn, 'the "Stap in de helikopter" affordance shows beside it').toBeVisible();
  await shot(page, 'heli-at-pad');
  await enterBtn.click();
  await expect.poll(() => hook(page, (r) => r.heli()?.inHeli ?? false), { timeout: 10_000, message: 'the button boards it' }).toBe(true);
  const h = (await hook(page, (r) => r.heli()))!;
  expect(h.airborne, 'boarded, it rests on the pad until the player pushes').toBe(false);
  expect(h.pilotSeated, 'the ranger sits in the pilot seat (posed, not hidden)').toBe(true);
  await expect(page.locator('.explore-heli-exit'), 'on the ground you can step out again').toBeVisible();
  return avail;
}

/** Wait for touchdown; it must rest ON a pad (centre, drawn ground), pilot still in. */
/** How far (rad) a move (mx, mz) between two samples points off the nose. The nose is
 *  taken halfway between its heading at the two samples: in a turn it swings between
 *  them, so comparing with the last heading alone read a slow sample as "sideways". */
function offNose(mx: number, mz: number, h0: number, h1: number): number {
  const mid = h0 + Math.atan2(Math.sin(h1 - h0), Math.cos(h1 - h0)) / 2;
  const d = Math.atan2(mx, mz) - mid;
  return Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
}

async function expectLandedOnPad(page: Page, pad: { x: number; z: number }): Promise<void> {
  await expect.poll(() => hook(page, (r) => r.heli()?.airborne ?? true), { timeout: 60_000, message: 'it touches down' }).toBe(false);
  const h = (await hook(page, (r) => r.heli()))!;
  expect(h.inHeli, 'landed, the pilot is still in his seat').toBe(true);
  expect(Math.hypot(h.x - pad.x, h.z - pad.z), 'set down on the pad centre').toBeLessThan(1);
  expect(Math.abs(h.clearance), 'resting on the drawn ground, not sunk or floating').toBeLessThan(0.1);
}

test('heli: switch on in Instellingen, fly pad-to-pad facing its travel, land on the pad, step out', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await enterWorld(page);
  await switchOnInSettings(page);
  const avail = await board(page);
  const padB = avail.pads[1]; // the BOA-post helipad on the western side
  const start = { x: avail.x, z: avail.z };
  // parked on the pad there is no cockpit frame (parent B14: an 18 px grey border framed
  // the screen the whole time and read as a rendering bug)
  const cockpit = (): Promise<{ opacity: string; border: string }> => page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('.explore-heli-cockpit')!);
    return { opacity: cs.opacity, border: cs.borderTopWidth };
  });
  await expect.poll(async () => (await cockpit()).opacity, { message: 'no cockpit frame while parked' }).toBe('0');

  const down = new Set<string>();
  const setKey = async (k: string, on: boolean): Promise<void> => {
    if (on && !down.has(k)) { await page.keyboard.down(k); down.add(k); }
    else if (!on && down.has(k)) { await page.keyboard.up(k); down.delete(k); }
  };

  // 1) YAW PROBE: a push lifts off; hold Left — the nose yaws (the ONLY rotation) and
  // the follow-cam tracks it (≥ 45°, damped) while it climbs toward cruise.
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
  expect(maxYawDelta, 'yaw is DAMPED but present — the camera followed the turn ≥ 45°').toBeGreaterThanOrEqual(Math.PI / 4);

  // 2) fly to pad B on the throttle, steering to close the heading error; it must face
  // where it flies (the model's long side along the motion) and the vignette fades in.
  let sawVignette = false;
  let sideways = 0;
  let measured = false;
  await setKey('ArrowUp', true);
  let reached = false;
  try {
    let prev = await hook(page, (r) => r.heli());
    const tFly = Date.now();
    while (Date.now() - tFly < 90_000) {
      const h = await hook(page, (r) => r.heli());
      if (!h) { await page.waitForTimeout(100); continue; }
      assertComfort(h);
      if (h.climbRate > 0.05) sawClimb = true;
      if (h.vignette > 0) sawVignette = true;
      if (prev && h.speed > 3) {
        const mx = h.x - prev.x, mz = h.z - prev.z;
        if (Math.hypot(mx, mz) > 0.3) {
          const off = offNose(mx, mz, prev.heading, h.heading);
          if (off > 0.35) sideways += 1;
          // measured on a straight stretch: in a turn the move between two samples is a
          // chord of the arc, not the nose's direction (a slow sample read it 30° off)
          if (!measured && h.altitude > 8 && Math.abs(Math.atan2(Math.sin(h.heading - prev.heading), Math.cos(h.heading - prev.heading))) < 0.03) {
            measured = true;
            const shape = await page.evaluate(([dx, dz]) => { // measured where it is NOW
              const r = (window as unknown as { __ranger: Hook }).__ranger;
              const now = r.heli()!;
              return r.shapeAt(now.x, now.z, dx, dz);
            }, [mx, mz]);
            expect(shape, 'the helicopter model is found under it').not.toBeNull();
            expect(shape!.along, 'it flies nose-first: longer along its travel than across').toBeGreaterThan(shape!.across);
            await shot(page, 'heli-flying');
          }
        }
      }
      prev = h;
      if (h.onPad && Math.hypot(h.x - padB.x, h.z - padB.z) < 5) { reached = true; break; }
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
  expect(sideways, 'it never flies sideways or backwards (motion within 20° of the nose)').toBe(0);
  expect(measured, 'its shape was measured along a straight stretch of the flight').toBe(true);
  const here = (await hook(page, (r) => r.heli()))!;
  expect(Math.hypot(here.x - start.x, here.z - start.z), 'genuinely flew pad-to-pad (≥ 40 m)').toBeGreaterThan(40);
  expect(sawClimb, 'the helicopter climbed toward cruise height').toBe(true);
  expect(sawVignette, 'the motion vignette faded in while translating').toBe(true);

  // in the air a calm, screen-fixed sill low in the frame is the steady horizon cue
  await expect.poll(async () => (await cockpit()).opacity, { message: 'the sill shows in the air' }).toBe('1');
  expect((await cockpit()).border, 'never the grey border').toBe('0px');

  // 3) over pad B the HUD offers "Land hier"; Space presses it; it glides onto the
  // pad centre (≤ 2 m/s descent) and rests there with the pilot inside
  await expect(page.locator('.explore-heli-land'), '"Land hier" shows over the pad').toBeVisible();
  await page.keyboard.press('Space');
  await expectLandedOnPad(page, padB);
  await shot(page, 'heli-landed');
  // nothing grows through either pad (breaker B9: heather poked through the pad and the skids)
  const growing = await page.evaluate((pads) => {
    const r = (window as unknown as { __ranger: { seating(x: number, z: number, r: number): { id: string }[] | null } }).__ranger;
    return pads.flatMap((p) => (r.seating(p.x, p.z, 3.2) ?? []).map((s) => s.id)).filter((id) => /^(heide|stuifzand|ven|bos)-/.test(id));
  }, avail.pads);
  expect(growing, 'no plant stands on a helipad').toEqual([]);

  // 4) "Stap uit" (Space presses the one visible button) — on foot beside pad B
  await page.keyboard.press('Space');
  await expect.poll(() => hook(page, (r) => r.heli()?.inHeli ?? true), { timeout: 10_000, message: 'Stap uit gets out' }).toBe(false);
  const p = await hook(page, (r) => r.pos());
  expect(p).not.toBeNull();
  expect(Math.hypot(p!.x - padB.x, p!.z - padB.z), 'stepped out beside the BOA-post pad').toBeLessThan(6);
  expect(Math.hypot(p!.x, p!.z), 'ranger stays inside the world rim').toBeLessThanOrEqual(116);

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});

test('heli: "Land op de helipad" always lands, on the pad the chip points to, facing where it flies', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);

  await optInHelicopter(page);
  await enterWorld(page);
  await board(page);
  const start = (await hook(page, (r) => r.heli()))!;

  // lift off and fly away from the pads for a while (a child lost in the air)
  await page.keyboard.down('ArrowUp');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(3_000);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(4_000);
  await page.keyboard.up('ArrowUp');
  const lost = (await hook(page, (r) => r.heli()))!;
  expect(lost.airborne, 'flying').toBe(true);
  expect(lost.onPad, 'away from any pad').toBe(false);
  // a flight goes somewhere: the chip (and the autopilot) point at the pad it did not lift off from
  const other = lost.pads.reduce((a, b) => (Math.hypot(b.x - start.x, b.z - start.z) > Math.hypot(a.x - start.x, a.z - start.z) ? b : a));
  expect(Math.abs(lost.padCue!.distance - Math.hypot(other.x - lost.x, other.z - lost.z)), 'the chip points at the other pad').toBeLessThan(1);

  const land = page.locator('.explore-heli-land');
  await expect(land, 'a Land button is always there while flying').toBeVisible();
  await expect(page.locator('.explore-heli-prompt .explore-heli-hint'), 'the HUD says where the pad is').toContainText('Helipad');
  await land.click();
  // the autopilot flies there nose-first and sets it down
  let sideways = 0;
  let prev = await hook(page, (r) => r.heli());
  for (let i = 0; i < 600; i++) {
    const h = (await hook(page, (r) => r.heli()))!;
    assertComfort(h);
    if (!h.airborne) break;
    const mx = h.x - prev!.x, mz = h.z - prev!.z;
    if (h.speed > 3 && Math.hypot(mx, mz) > 0.3) {
      const off = offNose(mx, mz, prev!.heading, h.heading);
      if (off > 0.35) sideways += 1;
    }
    prev = h;
    await page.waitForTimeout(100);
  }
  expect(sideways, 'the autopilot flies nose-first').toBe(0);
  await expectLandedOnPad(page, other);
  await shot(page, 'heli-autolanded');

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
