import { test, expect, type Page } from '@playwright/test';
import { shot, collectPageErrors, reportPageErrors } from './helpers';
import { walkTo } from './golden-lib';
import { hookR, stagingPoint, driveTo, jeepRests, type P2 } from './drive-lib';

/**
 * The roaming animals see the jeep and the ranger coming (run 6, FEEL: wildlife), played
 * with the real keys.
 *
 * Floris: "The car is bumped to the side by animals, seems a bit weird; they should avoid
 * being hit by the car and jump to the side." Driven straight at a grazing roamer, it lifts
 * its head and trots (the ree bounds, low) off the track while the jeep is still well off,
 * watches it pass and walks back to its grazing; the jeep keeps its speed and never has to
 * brake for it (`vehicle().yieldFor` stays null). On foot a calm walker gets close, a runner
 * sends it off early, and nobody walks through anybody. Nothing strafes, runs toward the
 * jeep, or enters a marker's ground, a solid, the water or the forest edge.
 *
 * The ree grazes on open drift sand straight on from where the jeep is parked: its drives start
 * right there, a child boarding and steering at it. The boar and the fox graze far off between
 * bushes, so their drives first line up where a straight run through one of their grazing
 * stops is clear (e2e/drive-lib), then wait for them to graze there, like a child picking a
 * way in. And the chase: a child steering the jeep AT the ree the whole way, which is exactly
 * what Alvah will do — it keeps to one side of the bonnet and never zig-zags across it.
 */

type Roamer = {
  id: string; x: number; z: number; h: number; mode: string; speed: number; gait: string; facing: number; r: number;
  threat: string | null; loop: { x: number; z: number; r: number; angle: number };
};
type Frame = {
  t: number; label: string;
  v: { x: number; z: number; h: number; sp: number; y: string | null; b: string | null; iv: boolean } | null;
  p: P2 | null; run: boolean;
  a: { x: number; z: number; f: number; mode: string; sp: number; g: string } | null;
};
type World = { markers: P2[]; pads: P2[]; obstacles: { x: number; z: number; r: number; box?: { hx: number; hz: number; rot: number } }[]; bound: number };

/** The jeep's footprint (core/vehicle.ts JEEP_BODY): circles along its axis. */
const JEEP_BODY = [{ along: 1.0, r: 0.9 }, { along: 0, r: 0.95 }, { along: -1.0, r: 0.9 }];
const gapOf = (v: NonNullable<Frame['v']>, a: { x: number; z: number }, r: number): number => {
  const fx = Math.sin(v.h), fz = Math.cos(v.h);
  return Math.min(...JEEP_BODY.map((b) => Math.hypot(v.x + fx * b.along - a.x, v.z + fz * b.along - a.z) - b.r - r));
};
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

async function enterWorld(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByRole('button', { name: 'Dit is mijn ranger' }).click();
  await expect.poll(() => hookR(page, 'r.screen'), { timeout: 30_000 }).toBe('world');
  await page.waitForTimeout(1500);
}

const roamer = async (page: Page, id: string): Promise<Roamer> =>
  (await hookR<Roamer[]>(page, 'r.ambient()')).find((a) => a.id === id)!;

async function boardJeep(page: Page): Promise<void> {
  const v = await hookR<P2>(page, 'r.vehicle()');
  await walkTo(page, { x: v.x, z: v.z - 1.2 }, { stopDist: 0.3, until: (s) => s.jeepNear, timeout: 60_000 });
  await expect.poll(() => hookR(page, 'r.vehicle().near'), { timeout: 20_000 }).toBe(true);
  await page.keyboard.press('Space');
  await expect.poll(() => hookR(page, 'r.vehicle().inVehicle'), { timeout: 10_000, message: 'Space at the jeep climbs in' }).toBe(true);
}

/** What the roamers must keep off: the markers' ground, the pads, every solid, the forest edge. */
function worldOf(page: Page): Promise<World> {
  return hookR<World>(page, '({ markers: r.markers(), pads: r.heli()?.pads ?? [], obstacles: r.obstacles(), bound: r.boundary()?.bound ?? 75 })');
}

/** A per-frame recorder in the page (reads only): the jeep, the ranger, one roamer. */
async function recStart(page: Page, id: string): Promise<void> {
  await page.evaluate((id) => {
    const w = window as unknown as { __wl: Frame[]; __wlOn: boolean; __wlLabel: string; __ranger: any };
    w.__wl = []; w.__wlOn = true; w.__wlLabel = '';
    const f = (t: number): void => {
      const r = w.__ranger;
      const v = r.vehicle(), m = r.motion(), a = r.ambient().find((x: { id: string }) => x.id === id);
      w.__wl.push({
        t, label: w.__wlLabel, p: r.pos(), run: !!m?.running,
        v: v ? { x: v.x, z: v.z, h: v.heading, sp: v.speed, y: v.yieldFor, b: v.brake, iv: v.inVehicle } : null,
        a: a ? { x: a.x, z: a.z, f: a.facing, mode: a.mode, sp: a.speed, g: a.gait } : null,
      });
      if (w.__wlOn) requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  }, id);
}
const recLabel = (page: Page, l: string): Promise<void> => page.evaluate((l) => { (window as unknown as { __wlLabel: string }).__wlLabel = l; }, l);
const recStop = (page: Page): Promise<Frame[]> => page.evaluate(() => { const w = window as unknown as { __wlOn: boolean; __wl: Frame[] }; w.__wlOn = false; return w.__wl; });

/** The roamer's manners over a recording: never sideways or backwards, never toward the jeep
 *  or the ranger while it makes way, never on a marker's ground, a pad, in a solid or at the
 *  forest edge. */
function manners(frames: Frame[], world: World, r: number): { sideways: number; toward: number; trespass: string[] } {
  let sideways = 0, toward = 0;
  const trespass = new Set<string>();
  for (let i = 1; i < frames.length; i++) {
    const p = frames[i - 1].a, q = frames[i].a;
    if (!p || !q) continue;
    const mx = q.x - p.x, mz = q.z - p.z, m = Math.hypot(mx, mz);
    if (m > 0.02) {
      const off = Math.acos(Math.max(-1, Math.min(1, (mx * Math.sin(q.f) + mz * Math.cos(q.f)) / m)));
      if (off > (35 * Math.PI) / 180) sideways++;
      const th = frames[i].v?.iv ? frames[i].v : frames[i].p;
      if (th && (q.mode === 'yield' || q.mode === 'away')) {
        const tx = th.x - q.x, tz = th.z - q.z, tl = Math.hypot(tx, tz) || 1;
        if ((mx * tx + mz * tz) / (m * tl) > 0.3) toward++;
      }
    }
    for (const mk of world.markers) if (Math.hypot(q.x - mk.x, q.z - mk.z) < 5.2) trespass.add('a marker\'s ground');
    for (const pd of world.pads) if (Math.hypot(q.x - pd.x, q.z - pd.z) < 3.2) trespass.add('a helipad');
    for (const o of world.obstacles) if (!o.box && o.r < 3 && Math.hypot(q.x - o.x, q.z - o.z) < o.r * 0.8) trespass.add(`a solid at (${o.x.toFixed(1)}, ${o.z.toFixed(1)})`);
    if (Math.hypot(q.x, q.z) > world.bound - 6) trespass.add('the forest edge');
    if (Math.hypot(q.x - 46, q.z + 19) < 20 + r) trespass.add('the ven');
  }
  return { sideways, toward, trespass: [...trespass] };
}

/**
 * Drive at the roamer like a child: W and the turn keys aimed at it until 24 m out, then W
 * alone, straight on past it; let go, and watch it go back to grazing. The ree is driven at
 * from where the jeep is parked; far-off roamers (`staged`) are first lined up on: a clear run
 * through one of their grazing stops, waiting for them to graze there.
 */
async function driveStraightAt(page: Page, id: string, name: string, staged: boolean): Promise<void> {
  await enterWorld(page);
  await boardJeep(page);
  const a0 = await roamer(page, id);
  if (staged) {
    const L = a0.loop;
    const stops = [0, 1, 2, 3].map((i) => ({ x: L.x + Math.cos(L.angle + (i * Math.PI) / 2) * L.r, z: L.z + Math.sin(L.angle + (i * Math.PI) / 2) * L.r }));
    const v0 = await hookR<P2>(page, 'r.vehicle()');
    const stage = await stagingPoint(page, L, v0, { back: 36, beyond: 10, room: 1.6, stops, need: 2 });
    expect(stage, `${name}: a clear run-up through two of its grazing stops`).not.toBeNull();
    await driveTo(page, stage!.A, 3, 60_000, 7);
    await jeepRests(page);
    await expect.poll(async () => {
      const a = await roamer(page, id);
      return a.mode === 'roam' && a.speed < 0.02 && stage!.through.some((s) => Math.hypot(stops[s].x - a.x, stops[s].z - a.z) < 0.8);
    }, { timeout: 150_000, intervals: [250], message: `${name} grazes at a stop the run-up is clear through` }).toBe(true);
  } else {
    await expect.poll(async () => { const a = await roamer(page, id); return a.mode === 'roam' && a.speed < 0.02; },
      { timeout: 150_000, intervals: [250], message: `${name} grazes` }).toBe(true);
  }

  const world = await worldOf(page);
  await recStart(page, id);
  const held = new Set<string>();
  const set = async (k: string, on: boolean): Promise<void> => {
    if (on && !held.has(k)) { await page.keyboard.down(k); held.add(k); } else if (!on && held.has(k)) { await page.keyboard.up(k); held.delete(k); }
  };
  let phase = 'aim', shots = 0, firstYield = 0, passShot = false;
  const t0 = Date.now();
  try {
    await recLabel(page, 'aim');
    while (Date.now() - t0 < 40_000) {
      const v = await hookR<{ x: number; z: number; heading: number; speed: number }>(page, 'r.vehicle()');
      const a = await roamer(page, id);
      const d = Math.hypot(a.x - v.x, a.z - v.z);
      const e = wrap(Math.atan2(a.x - v.x, a.z - v.z) - v.heading);
      if (phase === 'aim' && (d < 24 || a.mode === 'yield')) { phase = 'straight'; await recLabel(page, 'straight'); }
      if (phase === 'straight' && d > 6 && Math.abs(e) > 1.6) { phase = 'past'; await recLabel(page, 'past'); }
      if (phase === 'aim') { await set('KeyW', true); await set('KeyA', e > 0.02); await set('KeyD', e < -0.02); }
      else if (phase === 'straight') { await set('KeyA', false); await set('KeyD', false); await set('KeyW', true); }
      else { await set('KeyW', false); await set('KeyA', false); await set('KeyD', false); if (Math.abs(v.speed) < 0.05) break; }
      // the strip: the moment it makes way, then while it goes
      if (a.mode === 'yield' && !firstYield) firstYield = Date.now();
      if (firstYield && shots < 4 && Date.now() - firstYield >= shots * 450) await shot(page, `wildlife-${name}-${++shots}`);
      if (!passShot && phase === 'straight' && d < 9) { passShot = true; await shot(page, `wildlife-${name}-5-watches-it-pass`); }
      await page.waitForTimeout(40);
    }
  } finally { for (const k of [...held]) await page.keyboard.up(k); }
  await recLabel(page, 'after');
  await expect.poll(async () => (await roamer(page, id)).mode, { timeout: 20_000, intervals: [250], message: `${name} goes back to grazing` }).toBe('roam');
  await shot(page, `wildlife-${name}-grazing-again`);
  const frames = await recStop(page);

  // read the run
  const r = a0.r;
  let noticed = Infinity, minGap = Infinity, minSpeed = Infinity, full = false, yieldFor: string | null = null, passedAt = 0, backAt = 0;
  const modes = new Set<string>();
  for (const f of frames) {
    if (!f.v || !f.a) continue;
    const gap = gapOf(f.v, f.a, r);
    minGap = Math.min(minGap, gap);
    modes.add(f.a.mode);
    if (f.a.mode !== 'roam' && noticed === Infinity) noticed = gap;
    if (f.v.y) yieldFor = f.v.y;
    if (f.v.sp > 5.9) full = true;
    if (full && f.label === 'straight') minSpeed = Math.min(minSpeed, f.v.sp);
    if (f.label === 'past' && !passedAt) passedAt = f.t;
    if (passedAt && !backAt && f.a.mode === 'roam') backAt = f.t;
  }
  const m = manners(frames, world, r);
  console.log(`[wildlife] ${name}: looked up with the jeep ${noticed.toFixed(1)} m off; modes ${[...modes].join('/')}; closest ${minGap.toFixed(2)} m; the jeep held ≥ ${minSpeed.toFixed(2)} m/s; yieldFor ${yieldFor}; back to grazing ${backAt ? ((backAt - passedAt) / 1000).toFixed(1) : '(after the recording)'} s after it passed; sideways ${m.sideways}, toward ${m.toward}, trespass ${m.trespass.join(', ') || 'none'}`);
  expect(noticed, `${name} looked up while the jeep was still at least 10 m off`).toBeGreaterThanOrEqual(10);
  expect(modes.has('yield'), `${name} made way off the jeep's path`).toBe(true);
  expect(yieldFor, 'the jeep never had to brake for it').toBeNull();
  expect(minSpeed, 'the jeep kept at least 5 m/s past it').toBeGreaterThanOrEqual(5);
  expect(minGap, 'the jeep\'s body never came within 0.8 m of it').toBeGreaterThanOrEqual(0.8);
  expect(m.sideways, 'it only ever moved along its facing (never sideways or backwards)').toBe(0);
  expect(m.toward, 'making way it never moved toward the jeep').toBe(0);
  expect(m.trespass, 'it kept off every marker\'s ground, pad, solid, the water and the forest edge').toEqual([]);
}

test('wildlife: driven straight at the ree from where the jeep is parked, it bounds off the track early and the jeep keeps its speed (run 6)', async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);
  await driveStraightAt(page, 'animal-ree-roedeer', 'ree', false);
  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});

test('wildlife: driven straight at the boar, it trots aside and the jeep keeps its speed (run 6)', async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);
  await driveStraightAt(page, 'animal-wildzwijn-boar', 'boar', true);
  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});

test('wildlife: driven straight at the fox, it lopes aside and the jeep keeps its speed (run 6)', async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);
  await driveStraightAt(page, 'animal-vos-fox', 'fox', true);
  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});

/**
 * How a chased roamer moved over a recording: the times its own sideways motion across the
 * jeep's current line reversed while it was within 14 m in front of the rolling jeep's bonnet
 * (a zig-zag across the nose; counted per pass: it forgets the side once it has been out of
 * that stretch, or the jeep has stood, for a second), the closest the jeep's body came, and
 * how long the jeep's give-way brake acted.
 */
function chaseRead(frames: Frame[], r: number): { reversals: number; closest: number; brakeS: number; worst: string } {
  let reversals = 0, last = 0, outFor = 0, closest = Infinity, brakeS = 0, worst = '';
  for (let i = 1; i < frames.length; i++) {
    const p = frames[i - 1], q = frames[i];
    if (!p.a || !q.a || !q.v || !p.v) continue;
    const dt = (q.t - p.t) / 1000;
    if (dt <= 0) continue;
    if (q.v.y) brakeS += dt;
    const gap = gapOf(q.v, q.a, r);
    if (gap < closest) { closest = gap; worst = `jeep (${q.v.x.toFixed(1)}, ${q.v.z.toFixed(1)}) at ${q.v.sp.toFixed(2)} m/s, animal (${q.a.x.toFixed(1)}, ${q.a.z.toFixed(1)}) ${q.a.mode}`; }
    const fx = Math.sin(q.v.h), fz = Math.cos(q.v.h);
    const ahead = (q.a.x - q.v.x) * fx + (q.a.z - q.v.z) * fz;
    const across = ((q.a.x - p.a.x) * fz - (q.a.z - p.a.z) * fx) / dt;   // its own speed across the jeep's line
    if (ahead > 0 && ahead < 14 && Math.abs(q.v.sp) >= 1) {
      outFor = 0;
      if (Math.abs(across) > 0.8) { if (last && Math.sign(across) !== last) reversals++; last = Math.sign(across); }
    } else if ((outFor += dt) > 1) last = 0;
  }
  return { reversals, closest, brakeS, worst };
}

test('wildlife: a child steering the jeep AT the ree the whole way — it keeps to one side and never zig-zags across the bonnet (run 6)', async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);
  await enterWorld(page);
  await boardJeep(page);
  const id = 'animal-ree-roedeer';
  await expect.poll(async () => { const a = await roamer(page, id); return a.mode === 'roam' && a.speed < 0.02; },
    { timeout: 150_000, intervals: [250], message: 'the ree grazes' }).toBe(true);
  const world = await worldOf(page);
  const r = (await roamer(page, id)).r;
  await recStart(page, id);
  const held = new Set<string>();
  const set = async (k: string, on: boolean): Promise<void> => {
    if (on && !held.has(k)) { await page.keyboard.down(k); held.add(k); } else if (!on && held.has(k)) { await page.keyboard.up(k); held.delete(k); }
  };
  // W held (off only for a sharp turn at speed, as a child does) and A/D at it, all the way,
  // for 14 s: past it, round, and at it again
  let shots = 0, firstYield = 0, near = false;
  const t0 = Date.now();
  try {
    while (Date.now() - t0 < 14_000) {
      const v = await hookR<{ x: number; z: number; heading: number; speed: number }>(page, 'r.vehicle()');
      const a = await roamer(page, id);
      const e = wrap(Math.atan2(a.x - v.x, a.z - v.z) - v.heading);
      await set('KeyW', !(Math.abs(e) > 0.9 && v.speed > 2.5));
      await set('KeyA', e > 0.08);
      await set('KeyD', e < -0.08);
      if (a.mode === 'yield' && !firstYield) firstYield = Date.now();
      if (firstYield && shots < 4 && Date.now() - firstYield >= shots * 500) await shot(page, `wildlife-chase-${++shots}`);
      if (!near && Math.hypot(a.x - v.x, a.z - v.z) < 7) { near = true; await shot(page, 'wildlife-chase-5-closest'); }
      await page.waitForTimeout(40);
    }
  } finally { for (const k of [...held]) await page.keyboard.up(k); }
  await shot(page, 'wildlife-chase-6-after');
  const frames = await recStop(page);
  const c = chaseRead(frames, r);
  const m = manners(frames, world, r);
  console.log(`[wildlife] chasing the ree with the keys for 14 s: reversals across the bonnet ${c.reversals}; closest ${c.closest.toFixed(2)} m (${c.worst}); the jeep's give-way brake acted ${c.brakeS.toFixed(1)} s; sideways ${m.sideways}, toward ${m.toward}, trespass ${m.trespass.join(', ') || 'none'}`);
  expect(firstYield, 'the ree made way').toBeGreaterThan(0);
  expect(c.reversals, 'it never zig-zagged across the jeep\'s nose').toBe(0);
  expect(c.closest, 'the jeep\'s body never came within 0.8 m of it').toBeGreaterThanOrEqual(0.8);
  expect(m.sideways, 'it only ever moved along its facing').toBe(0);
  expect(m.toward, 'making way it never moved toward the jeep').toBe(0);
  expect(m.trespass).toEqual([]);
  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});

/** Walk (or run, Shift held) at the ree with the arrow keys for up to `ms`, steering by the
 *  view; returns the distances at which it looked up and moved off, and the closest he got. */
async function approachRee(page: Page, run: boolean, ms: number): Promise<{ lookAt: number; awayAt: number; closest: number; frames: Frame[] }> {
  await recStart(page, 'animal-ree-roedeer');
  const held = new Set<string>();
  const set = async (k: string, on: boolean): Promise<void> => {
    if (on && !held.has(k)) { await page.keyboard.down(k); held.add(k); } else if (!on && held.has(k)) { await page.keyboard.up(k); held.delete(k); }
  };
  const t0 = Date.now();
  try {
    if (run) await set('ShiftLeft', true);
    while (Date.now() - t0 < ms) {
      const s = await hookR<{ p: P2; c: { x: number; z: number }; a: Roamer }>(page, '({ p: r.pos(), c: r.cam(), a: r.ambient().find((x) => x.id === "animal-ree-roedeer") })');
      const dx = s.a.x - s.p.x, dz = s.a.z - s.p.z, d = Math.hypot(dx, dz);
      let fx = s.p.x - s.c.x, fz = s.p.z - s.c.z; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
      const ang = Math.atan2((dx * -fz + dz * fx) / d, (dx * fx + dz * fz) / d);
      await set('ArrowUp', Math.abs(ang) < 1.2);
      await set('ArrowLeft', ang < -0.12);
      await set('ArrowRight', ang > 0.12);
      await page.waitForTimeout(60);
    }
  } finally { for (const k of [...held]) await page.keyboard.up(k); }
  const frames = await recStop(page);
  let lookAt = -1, awayAt = -1, closest = Infinity;
  for (const f of frames) {
    if (!f.a || !f.p) continue;
    const d = Math.hypot(f.a.x - f.p.x, f.a.z - f.p.z);
    closest = Math.min(closest, d);
    if (f.a.mode !== 'roam' && lookAt < 0) lookAt = d;
    if (f.a.mode === 'away' && awayAt < 0) awayAt = d;
  }
  return { lookAt, awayAt, closest, frames };
}

test('wildlife: on foot a calm walker gets close to the ree, a runner sends it off early, and he never walks through it (run 6)', async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);
  await enterWorld(page);
  const world = await worldOf(page);
  const L = (await roamer(page, 'animal-ree-roedeer')).loop;
  const goTo = async (): Promise<void> => {
    const p = await hookR<P2>(page, 'r.pos()');
    const dx = p.x - L.x, dz = p.z - L.z, dl = Math.hypot(dx, dz) || 1;
    await walkTo(page, { x: L.x + (dx / dl) * (L.r + 9), z: L.z + (dz / dl) * (L.r + 9) }, { stopDist: 1.5, timeout: 90_000 });
    await expect.poll(async () => { const a = await roamer(page, 'animal-ree-roedeer'); return a.mode === 'roam' && a.speed < 0.02; },
      { timeout: 150_000, intervals: [250], message: 'the ree grazes' }).toBe(true);
  };

  await goTo();
  await shot(page, 'wildlife-walk-0-grazing');
  const walk = await approachRee(page, false, 12_000);
  await shot(page, 'wildlife-walk-1-keeps-its-distance');
  const mw = manners(walk.frames, world, 0.56);
  console.log(`[wildlife] walking at the ree: it looked up at ${walk.lookAt.toFixed(2)} m, stepped away at ${walk.awayAt.toFixed(2)} m, closest ${walk.closest.toFixed(2)} m; sideways ${mw.sideways}, toward ${mw.toward}`);
  expect(walk.lookAt, 'walking calmly at it, it looks up at about 5-6 m').toBeGreaterThanOrEqual(4.8);
  expect(walk.lookAt).toBeLessThanOrEqual(6.6);
  expect(walk.awayAt, 'and steps away at about 3-4 m').toBeGreaterThanOrEqual(2.8);
  expect(walk.awayAt).toBeLessThanOrEqual(4.3);
  expect(walk.closest, 'it never lets him within about 1.5 m (and he never walks through it)').toBeGreaterThanOrEqual(1.5);
  expect(mw.sideways + mw.toward, 'along its facing, never toward him').toBe(0);
  expect(mw.trespass).toEqual([]);

  // let it settle back to grazing, then run at it
  await expect.poll(async () => (await roamer(page, 'animal-ree-roedeer')).mode, { timeout: 60_000, intervals: [250] }).toBe('roam');
  await goTo();
  const run = await approachRee(page, true, 10_000);
  await shot(page, 'wildlife-run-it-bounds-off');
  const mr = manners(run.frames, world, 0.56);
  console.log(`[wildlife] running at the ree: it looked up at ${run.lookAt.toFixed(2)} m, moved off at ${run.awayAt.toFixed(2)} m, closest ${run.closest.toFixed(2)} m; sideways ${mr.sideways}, toward ${mr.toward}`);
  expect(run.frames.some((f) => f.run), 'Shift + ArrowUp runs').toBe(true);
  expect(run.awayAt, 'running at it, it moves off from about 8 m').toBeGreaterThanOrEqual(6.5);
  expect(run.closest, 'and he never catches up with it (never within about 1.5 m)').toBeGreaterThanOrEqual(1.5);
  expect(mr.sideways + mr.toward).toBe(0);
  expect(mr.trespass).toEqual([]);

  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});

test('wildlife: under reduced motion the roaming animals hold still, and he walks round one, never through it (run 6)', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enterWorld(page);
  const before = (await hookR<Roamer[]>(page, 'r.ambient()')).filter((a) => a.mode);
  await page.waitForTimeout(3000);
  const after = (await hookR<Roamer[]>(page, 'r.ambient()')).filter((a) => a.mode);
  expect(before.length, 'the four roamers are there').toBe(4);
  for (const a of before) {
    const b = after.find((x) => x.id === a.id)!;
    expect(Math.hypot(b.x - a.x, b.z - a.z), `${a.id} holds still`).toBeLessThan(0.001);
  }
  // walk straight into the frozen ree with the arrow keys: he stops against it and goes
  // round it (soft, like a trunk), never through it
  const ree = after.find((a) => a.id === 'animal-ree-roedeer')!;
  await recStart(page, ree.id);
  await walkTo(page, { x: ree.x, z: ree.z }, { stopDist: 0.2, timeout: 45_000 });
  const frames = await recStop(page);
  await shot(page, 'wildlife-reduced-motion-beside-the-ree');
  const closest = Math.min(...frames.filter((f) => f.p && f.a).map((f) => Math.hypot(f.a!.x - f.p!.x, f.a!.z - f.p!.z)));
  console.log(`[wildlife] reduced motion: walking into the still ree he came no closer than ${closest.toFixed(2)} m (its footprint ${ree.r} m + his 0.3 m)`);
  expect(closest, 'he never walked into the ree').toBeGreaterThanOrEqual(ree.r + 0.3 - 0.05);
  await reportPageErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
