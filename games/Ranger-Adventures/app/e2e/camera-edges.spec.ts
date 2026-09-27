import { test, expect, type Page } from '@playwright/test';
import { R, sleep, walkTo, type P2 } from './golden-lib';
import { shot, collectPageErrors, reportPageErrors } from './helpers';

/**
 * The camera at the edges of the world, not only on the golden path (wave 4, 2026-09-27).
 * Real keys only; the dev hook only reads. Three places the QA wave found the view lost:
 *
 *  1. past the cabin: walking along its wall and turning round with his back to it, the
 *     lens craned up onto his head (-47°…-68°) within 0.2 s (child B4);
 *  2. the jeep at the world rim: a U-turn at the tree line buried the chase lens in rim
 *     crowns, a dark screen of leaves, while viewClear said true (parent B3);
 *  3. on foot at the rim: turning round there tipped the view straight down onto his
 *     hair (pitch -68°, boom 2 m) until he walked away (parent B4).
 *
 * Every rendered frame is sampled. The view must stay calm (never steeper than 40°, no
 * jump of the lens or the pitch from one frame to the next) and clear, twice over: the
 * rig's own viewClear, and an independent scene ray from the lens to him (or to the jeep)
 * every few frames that must meet nothing solid — a tree, a building, a prop — on the way
 * (see-through faded trees and thin ground plants do not count). Screenshots are for a
 * human eye.
 */

test.use({ viewport: { width: 1280, height: 800 } }); // the laptop comes first

type Frame = { t: number; pitch: number; clear: boolean; op: number; dist: number; x: number; y: number; z: number; px: number; pz: number };
type Stats = { frames: number; steepest: number; notClear: number; maxPitchStep: number; maxLensSpeed: number; minOpacity: number;
  hiddenFrames: number; longestHiddenMs: number; minDist: number; lensOut: number;
  rays: number; blockedRays: string[] };

async function startTrace(page: Page): Promise<void> {
  await page.evaluate(() => {
    type V3 = { x: number; y: number; z: number; clone(): V3; set(x: number, y: number, z: number): V3; sub(v: V3): V3; length(): number; normalize(): V3 };
    type Obj = { visible: boolean; parent: Obj | null; name: string; type: string; isMesh?: boolean; isInstancedMesh?: boolean; userData: Record<string, unknown>;
      material: Mat | Mat[] };
    type Mat = { visible: boolean; colorWrite: boolean; transparent: boolean; depthWrite: boolean; opacity: number };
    type Hit = { object: Obj; distance: number; face?: { materialIndex: number } | null };
    const w = window as unknown as {
      __edge: unknown[]; __edgeRays: string[]; __edgeRayN: number; __edgeOn: boolean;
      __ranger: { cam(): Record<string, number & boolean> | null; pos(): P2 | null; vehicle(): { inVehicle: boolean; x: number; y: number; z: number } | null };
      __stage: { world: { camera: { position: V3 }; scene: Obj; raycaster: { constructor: new () => { set(o: V3, d: V3): void; far: number; camera: unknown; intersectObject(o: Obj, r: boolean): Hit[] } }; player: { group: { position: V3 } } } };
    };
    w.__edge = []; w.__edgeRays = []; w.__edgeRayN = 0; w.__edgeOn = true;
    const world = w.__stage.world;
    const rc = new world.raycaster.constructor();
    rc.camera = world.camera; // the name tags are sprites: a sprite ray needs the camera
    const shown = (o: Obj | null): boolean => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
    // a scene ray from the lens to him (his chest) or to the jeep: the first SOLID thing it
    // meets before the last stretch (his own body, the jeep's own body), or null
    const probe = (): string | null => {
      const v = w.__ranger.vehicle();
      const riding = !!v?.inVehicle;
      const g = world.player.group.position;
      const from = world.camera.position.clone();
      const dir = from.clone().set(riding ? v!.x : g.x, riding ? v!.y + 1 : g.y + 0.8, riding ? v!.z : g.z).sub(from);
      const len = dir.length();
      rc.set(from, dir.normalize());
      rc.far = Math.max(0, len - (riding ? 2.6 : 0.6));
      for (const h of rc.intersectObject(world.scene, true)) {
        const o = h.object;
        if (!o.isMesh || !shown(o)) continue;
        if (o.isInstancedMesh && !o.userData.forest) continue; // grass, heather, plants: thin, not a wall
        const m = Array.isArray(o.material) ? o.material[h.face?.materialIndex ?? 0] : o.material;
        if (!m || !m.visible || m.colorWrite === false) continue;
        if (m.transparent && (!m.depthWrite || m.opacity < 0.35)) continue; // a faded tree, a shade
        return `${o.name || o.type} ${h.distance.toFixed(1)} m from the lens`;
      }
      return null;
    };
    let n = 0;
    const tick = (t: number): void => { // t: the frame's own time (not when this callback ran)
      if (!w.__edgeOn) return;
      const c = w.__ranger.cam(); const p = w.__ranger.pos();
      if (c && p) w.__edge.push({ t, pitch: c.pitch, clear: c.viewClear, op: c.avatarOpacity, dist: c.dist, x: c.x, y: c.y, z: c.z, px: p.x, pz: p.z });
      if (n++ % 10 === 0) { w.__edgeRayN += 1; const hit = probe(); if (hit) w.__edgeRays.push(hit); }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function stopTrace(page: Page): Promise<Stats> {
  const { f, rays, blocked } = await page.evaluate(() => {
    const w = window as unknown as { __edge: unknown[]; __edgeRays: string[]; __edgeRayN: number; __edgeOn: boolean };
    w.__edgeOn = false;
    return { f: w.__edge, rays: w.__edgeRayN, blocked: w.__edgeRays };
  }) as { f: Frame[]; rays: number; blocked: string[] };
  const st: Stats = { frames: f.length, steepest: 0, notClear: 0, maxPitchStep: 0, maxLensSpeed: 0, minOpacity: 1,
    hiddenFrames: 0, longestHiddenMs: 0, minDist: Infinity, lensOut: 0,
    rays, blockedRays: blocked.slice(0, 4) };
  (st as Stats & { blockedRayCount: number }).blockedRayCount = blocked.length;
  let hiddenSince = -1;
  f.forEach((b, i) => {
    if (b.op < 0.5) { st.hiddenFrames += 1; if (hiddenSince < 0) hiddenSince = b.t; st.longestHiddenMs = Math.max(st.longestHiddenMs, Math.round(b.t - hiddenSince)); }
    else hiddenSince = -1;
    st.lensOut = Math.max(st.lensOut, Math.round(Math.hypot(b.x, b.z) * 10) / 10); // how far out the lens stood (the rim trees start at ~75.6 m)
    st.steepest = Math.max(st.steepest, -b.pitch * 180 / Math.PI);
    if (!b.clear) st.notClear += 1;
    st.minOpacity = Math.min(st.minOpacity, b.op);
    st.minDist = Math.min(st.minDist, b.dist);
    if (!i) return;
    const a = f[i - 1];
    st.maxPitchStep = Math.max(st.maxPitchStep, Math.abs(b.pitch - a.pitch) * 180 / Math.PI);
    // how fast the lens moved round him (beyond what the ranger or the jeep moved): a turn
    // swings it at ~8 m/s, the boom letting out after it adds a few more; a snap is a jump
    // in one frame, half a metre and more (the rig eases at most 50 ms a frame, so a slow frame
    // never counts as a snap)
    const dt = Math.max(1 / 60, Math.min(0.05, (b.t - a.t) / 1000));
    const moved = Math.hypot((b.x - a.x) - (b.px - a.px), b.y - a.y, (b.z - a.z) - (b.pz - a.pz));
    st.maxLensSpeed = Math.max(st.maxLensSpeed, moved / dt);
  });
  st.steepest = Math.round(st.steepest * 10) / 10;
  st.maxPitchStep = Math.round(st.maxPitchStep * 10) / 10;
  st.maxLensSpeed = Math.round(st.maxLensSpeed * 10) / 10;
  st.minDist = Math.round(st.minDist * 100) / 100;
  return st;
}

/** The calm-view contract for one stretch of play (soft: every stretch is judged). */
function calm(st: Stats, where: string, clearShare = 0.98): void {
  const info = `${where}: ${JSON.stringify(st)}`;
  test.info().annotations.push({ type: 'camera', description: info });
  if (!process.env.EDGES_QUIET) console.log(info);
  expect.soft(st.frames, info).toBeGreaterThan(20);
  expect.soft(st.steepest, `${where}: the view never tips steeper than 40° down — ${info}`).toBeLessThanOrEqual(41);
  expect.soft(st.maxPitchStep, `${where}: the pitch never jumps between two frames — ${info}`).toBeLessThanOrEqual(3);
  expect.soft(st.maxLensSpeed, `${where}: the lens never jumps between two frames (m/s) — ${info}`).toBeLessThanOrEqual(30);
  expect.soft(1 - st.notClear / st.frames, `${where}: the view of him stays clear — ${info}`).toBeGreaterThanOrEqual(clearShare);
  const blockedRays = (st as Stats & { blockedRayCount: number }).blockedRayCount;
  expect.soft(1 - blockedRays / Math.max(1, st.rays), `${where}: a ray from the lens meets nothing solid before him — ${info}`).toBeGreaterThanOrEqual(clearShare);
}

async function hold(page: Page, keys: string[], ms: number): Promise<void> {
  for (const k of keys) await page.keyboard.down(k);
  await sleep(page, ms);
  for (const k of keys) await page.keyboard.up(k);
}

/** Drive the jeep toward `goal` with the arrow keys, steering by its heading. */
async function driveTo(page: Page, goal: P2, timeout: number): Promise<void> {
  const held = new Set<string>();
  const set = async (want: Set<string>): Promise<void> => {
    for (const k of [...held]) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); }
    for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
  };
  const t0 = Date.now();
  try {
    while (Date.now() - t0 < timeout) {
      const v = await R<{ x: number; z: number; heading: number }>(page, 'r.vehicle()');
      const dx = goal.x - v.x, dz = goal.z - v.z;
      if (Math.hypot(dx, dz) < 3) break;
      const da = Math.atan2(Math.sin(Math.atan2(dx, dz) - v.heading), Math.cos(Math.atan2(dx, dz) - v.heading));
      const keys = new Set(['ArrowUp']);
      if (da > 0.12) keys.add('ArrowLeft'); else if (da < -0.12) keys.add('ArrowRight');
      await set(keys);
      await sleep(page, 100);
    }
  } finally { await set(new Set()); }
}

test('camera at the edges: past the cabin, the jeep at the rim, turning round on foot at the rim', async ({ page }, info) => {
  test.setTimeout(4 * 60_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);
  await page.goto('/?dev=1');
  await page.getByRole('button', { name: 'Begin', exact: true }).click({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Dit is mijn ranger' }).click({ timeout: 60_000 });
  await expect.poll(() => R<string>(page, 'r.screen'), { timeout: 90_000 }).toBe('world');
  await sleep(page, 2_000);

  // 1. past the cabin (3.9 × 3.8 m at (-4.2, -4), turned so its door faces spawn): along
  //    its front wall a metre out, round its corner and along its side wall, then turn
  //    round there (the lens has to come in between him and the wall)
  await walkTo(page, { x: -4.5, z: 0.5 }, { stopDist: 0.5, timeout: 20_000 });
  await startTrace(page);
  await walkTo(page, { x: -0.55, z: -3.65 }, { stopDist: 0.5, timeout: 20_000 });
  await walkTo(page, { x: -0.8, z: -4.85 }, { stopDist: 0.5, timeout: 20_000 });
  await walkTo(page, { x: -3.5, z: -7.45 }, { stopDist: 0.5, timeout: 20_000 });
  const along = await stopTrace(page);
  await shot(page, 'edges-past-the-cabin');
  calm(along, 'along the cabin walls');
  // turning at a corner the lens may have to come right up to him for a moment: then he
  // fades out and back, but he is never gone for long
  expect.soft(along.longestHiddenMs, `along the cabin he is never gone for long (${JSON.stringify(along)})`).toBeLessThanOrEqual(800);
  expect.soft(along.hiddenFrames / along.frames, `along the cabin he is there nearly all the time (${JSON.stringify(along)})`).toBeLessThanOrEqual(0.05);
  await startTrace(page);
  await hold(page, ['ArrowLeft'], 2_000);
  await sleep(page, 1_200);
  const turned = await stopTrace(page);
  await shot(page, 'edges-turned-round-by-the-cabin');
  calm(turned, 'turning round beside the cabin');

  // 2. the jeep east to the rim, a U-turn at the tree line, stop
  const jeep = await R<P2>(page, 'r.vehicle()');
  await walkTo(page, jeep, { stopDist: 1, timeout: 40_000, until: (s) => s.jeepNear });
  await page.keyboard.press('Space');
  await expect.poll(() => R<boolean>(page, 'r.vehicle().inVehicle'), { timeout: 5_000 }).toBe(true);
  await driveTo(page, { x: 70, z: 20 }, 40_000); // (it crawls past animals, so give it time)
  const there = await R<P2>(page, 'r.vehicle()');
  expect(Math.hypot(there.x, there.z), `the jeep reached the rim (${there.x.toFixed(1)}, ${there.z.toFixed(1)})`).toBeGreaterThan(64);
  await startTrace(page);
  await hold(page, ['ArrowUp', 'ArrowRight'], 5_000);
  await sleep(page, 2_500);
  const uturn = await stopTrace(page);
  await shot(page, 'edges-jeep-u-turn-at-the-rim');
  expect(uturn.lensOut, `the chase lens swung out among the rim trees (${JSON.stringify(uturn)})`).toBeGreaterThan(75.6);
  calm(uturn, 'the jeep turning at the rim tree line', 1);

  // 3. out of the jeep, on foot to the rim, and turn round there (parent B4)
  await page.keyboard.press('Space');
  await expect.poll(() => R<boolean>(page, 'r.vehicle().inVehicle'), { timeout: 5_000 }).toBe(false);
  const p = (await R<P2>(page, 'r.pos()'))!;
  const out = Math.atan2(p.z, p.x);
  await walkTo(page, { x: Math.cos(out) * 80, z: Math.sin(out) * 80 }, { stopDist: 0.5, timeout: 30_000, until: (s) => !!s.p && Math.hypot(s.p.x, s.p.z) > 73.4 });
  await hold(page, ['ArrowUp'], 1_000); // pressed on against the rim
  await startTrace(page);
  // turn round with Left until the screen looks back inward (as a child would: until the
  // world is in front of him again), then stand
  await page.keyboard.down('ArrowLeft');
  try {
    await expect.poll(async () => {
      const [yaw, q] = await Promise.all([R<number>(page, 'r.cameraYaw()'), R<P2>(page, 'r.pos()')]);
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw), r = Math.hypot(q.x, q.z);
      return (fx * -q.x + fz * -q.z) / r; // the screen's forward · inward
    }, { timeout: 8_000, intervals: [80], message: 'turning round at the rim, the view came to look back inward' }).toBeGreaterThan(0.94);
  } finally { await page.keyboard.up('ArrowLeft'); }
  await sleep(page, 1_500);
  const rim = await stopTrace(page);
  const at = (await R<P2>(page, 'r.pos()'))!;
  await shot(page, 'edges-turned-round-at-the-rim');
  expect(Math.hypot(at.x, at.z), 'he stands at the rim').toBeGreaterThan(72);
  expect(rim.lensOut, `turned round, the lens stands out among the rim trees (${JSON.stringify(rim)})`).toBeGreaterThan(75.6);
  calm(rim, 'turning round at the rim', 1);
  // (a rim tree's leaves may bring the lens in a little: never below a third of the boom)
  expect.soft(rim.minDist, `at the rim the lens keeps its room behind him (${JSON.stringify(rim)})`).toBeGreaterThan(1.5);
  expect.soft(rim.minOpacity, `at the rim he stays solid (${JSON.stringify(rim)})`).toBeGreaterThan(0.9);

  await reportPageErrors(info, errors);
  expect(errors).toEqual([]);
});
