import { test, expect, type Page } from '@playwright/test';
import { R, sleep, walkTo, type P2 } from './golden-lib';
import { shot, collectPageErrors, reportPageErrors } from './helpers';

/**
 * The calm camera in free roam, frame by frame (run 6 polish). Real keys and real mouse
 * clicks only; the dev hook only reads. The playtest found four ways the view broke the
 * calm-camera contract (fixed FOV 55, roll 0, no shake, no snap; reduced motion = cuts):
 *
 *  1. the fold: turning beside the parked jeep or walking past the missiebord, the walk
 *     lens came from 3.3 m to 0.5 m in one frame, into his head (his see-through face and
 *     hands filled the screen);
 *  2. climbing into the jeep cut the view 7.5 m and 40° in one frame, stepping out 5.7 m;
 *  3. running past the trees by the path pulled the lens in from 5.2 m to 2.6 m and out
 *     again: he doubled in size on the screen and shrank back;
 *  4. a half-faded ranger: the dissolve showed his inside.
 *
 * Every rendered frame is read (a rAF loop started after the game's own, so each row is
 * the frame the player saw, timed by the game's own clock). A SNAP is one frame that moves the lens over 0.35 m faster
 * than 15 m/s, or turns the view over 6°. The rig eases at most one 20 fps frame's worth
 * a frame, so a slow frame on a loaded machine is never counted as a snap: its speed is
 * measured over at most 50 ms.
 */

test.use({ viewport: { width: 1280, height: 800 } }); // the laptop comes first

/** One rendered frame: time (ms), the lens, its aim, FOV, lens → ranger distance, how
 *  solid he is drawn, his on-screen height share, in the jeep, his feet, running. */
type Frame = { t: number; x: number; y: number; z: number; yaw: number; pitch: number; fov: number; dist: number;
  op: number; hf: number; jeep: boolean; px: number; pz: number; run: boolean };

async function enterWorld(page: Page): Promise<void> {
  await page.goto('/?dev=1');
  await page.getByRole('button', { name: 'Begin', exact: true }).click({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Dit is mijn ranger' }).click({ timeout: 60_000 });
  await expect.poll(() => R<string>(page, 'r.screen'), { timeout: 90_000 }).toBe('world');
  await sleep(page, 2_500); // (the take-over from the maker's shot has landed)
}

async function startTrace(page: Page): Promise<void> {
  await page.evaluate(() => {
    type Cam = { x: number; y: number; z: number; yaw: number; pitch: number; fov: number; dist: number; avatarOpacity: number;
      avatarScreen: { heightFrac: number } };
    const w = window as unknown as { __calm: unknown[]; __calmOn: boolean; __stage?: { clock?: { oldTime: number } };
      __ranger: { cam(): Cam | null; pos(): P2 | null; vehicle(): { inVehicle: boolean } | null; motion(): { running: boolean } | null } };
    w.__calm = []; w.__calmOn = true;
    const tick = (): void => {
      if (!w.__calmOn) return;
      // the time the game's own frame read (its THREE.Clock), not this callback's: a slow
      // render between the two (a GPU shared with other work) made a 50 ms game frame
      // look like 16 ms, and its calm 4.7° like a snap
      const t = w.__stage?.clock?.oldTime ?? performance.now();
      const r = w.__ranger;
      const c = r.cam(); const p = r.pos();
      if (c && p) {
        w.__calm.push({ t, x: c.x, y: c.y, z: c.z, yaw: c.yaw, pitch: c.pitch, fov: c.fov, dist: c.dist, op: c.avatarOpacity,
          hf: c.avatarScreen.heightFrac, jeep: !!r.vehicle()?.inVehicle, px: p.x, pz: p.z, run: !!r.motion()?.running });
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function stopTrace(page: Page): Promise<Frame[]> {
  return page.evaluate(() => {
    const w = window as unknown as { __calm: Frame[]; __calmOn: boolean };
    w.__calmOn = false;
    return w.__calm;
  }) as Promise<Frame[]>;
}

const dirOf = (yaw: number, pitch: number): number[] => [Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw)];

/** The lens between two frames: how far it moved (m), how fast (m/s, over at most 50 ms),
 *  how far the view turned (°). */
function between(a: Frame, b: Frame): { step: number; speed: number; turn: number } {
  const step = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  const dt = Math.max(1 / 60, Math.min(0.05, (b.t - a.t) / 1000));
  const A = dirOf(a.yaw, a.pitch), B = dirOf(b.yaw, b.pitch);
  const turn = (Math.acos(Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2])) * 180) / Math.PI;
  return { step, speed: step / dt, turn };
}
const isSnap = (m: { step: number; speed: number; turn: number }): boolean => (m.step > 0.35 && m.speed > 15) || m.turn > 6;

type Calm = { frames: number; fovs: number[]; snaps: string[]; maxStep: number; maxTurn: number; minWalkDist: number; halfFaded: number; hidden: number };

/** Measure a stretch of frames against the calm-camera contract. */
function measure(f: Frame[]): Calm {
  const out: Calm = { frames: f.length, fovs: [], snaps: [], maxStep: 0, maxTurn: 0, minWalkDist: Infinity, halfFaded: 0, hidden: 0 };
  const fovs = new Set<number>();
  f.forEach((b, i) => {
    fovs.add(Math.round(b.fov * 100) / 100);
    if (!b.jeep) {
      out.minWalkDist = Math.min(out.minWalkDist, b.dist);
      if (b.op > 0.02 && b.op < 0.98) out.halfFaded += 1; // solid or gone, never half
      if (b.op <= 0.02) out.hidden += 1;
    }
    if (!i) return;
    const m = between(f[i - 1], b);
    out.maxStep = Math.max(out.maxStep, m.step); out.maxTurn = Math.max(out.maxTurn, m.turn);
    if (isSnap(m) && out.snaps.length < 6) {
      out.snaps.push(`${m.step.toFixed(2)} m, ${m.turn.toFixed(1)}° in ${(b.t - f[i - 1].t).toFixed(0)} ms (dist ${f[i - 1].dist.toFixed(2)}→${b.dist.toFixed(2)}, at ${b.px.toFixed(1)},${b.pz.toFixed(1)}${b.jeep ? ', in the jeep' : ''})`);
    }
  });
  out.fovs = [...fovs];
  out.maxStep = Math.round(out.maxStep * 100) / 100;
  out.maxTurn = Math.round(out.maxTurn * 10) / 10;
  out.minWalkDist = Math.round(out.minWalkDist * 100) / 100;
  return out;
}

function report(where: string, c: Calm): string {
  const info = `${where}: ${JSON.stringify(c)}`;
  test.info().annotations.push({ type: 'camera', description: info });
  console.log(info);
  return info;
}

/** The contract every stretch keeps. */
function calm(where: string, c: Calm): void {
  const info = report(where, c);
  expect.soft(c.frames, info).toBeGreaterThan(30);
  expect.soft(c.fovs, `${where}: the FOV is 55 on every frame — ${info}`).toEqual([55]);
  expect.soft(c.snaps, `${where}: no frame snaps the lens — ${info}`).toEqual([]);
  expect.soft(c.halfFaded, `${where}: he is solid or gone, never half see-through — ${info}`).toBe(0);
}

test('calm camera: the walk from the parked jeep to four markers and back never folds into him', async ({ page }, info) => {
  test.setTimeout(8 * 60_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);
  await enterWorld(page);
  const jeep = await R<P2>(page, 'r.vehicle()');
  const markers = await R<(P2 & { missionId: string })[]>(page, 'r.markers()');
  await walkTo(page, jeep, { stopDist: 2.5, timeout: 60_000 });
  // the tour a child walks on the first day: from the jeep to a marker and back, turning
  // round beside the jeep and passing the missiebord and the cabin on the way
  for (const id of ['frisling', 'ree-niet-aanraken', 'nachtronde', 'stuifzand']) {
    const m = markers.find((k) => k.missionId === id)!;
    for (const [name, at] of [[id, m], ['jeep', jeep]] as [string, P2][]) {
      await startTrace(page);
      const w = await walkTo(page, at, { stopDist: 2.5, timeout: 90_000 });
      const c = measure(await stopTrace(page));
      calm(`to ${name}`, c);
      if (w.res === 'stuck' || w.res === 'timeout') info.annotations.push({ type: 'walk', description: `the walker did not reach ${name} (${w.res}); the camera was judged on the way` });
      expect.soft(c.minWalkDist, `to ${name}: the lens stays at least 1.2 m from him`).toBeGreaterThanOrEqual(1.2);
      expect.soft(c.hidden, `to ${name}: in the open he is never hidden`).toBe(0);
      await sleep(page, 300);
    }
  }
  await shot(page, 'calm-tour-back-at-the-jeep');
  await reportPageErrors(info, errors);
  expect(errors).toEqual([]);
});

test('calm camera: running looks like walking (the same framing, he never doubles in size)', async ({ page }, info) => {
  test.setTimeout(4 * 60_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);
  await enterWorld(page);
  const p0 = await R<P2>(page, 'r.pos()');
  expect(Math.abs(p0.x), 'he starts on the spawn line x = 0').toBeLessThan(0.5);
  await startTrace(page);
  await page.keyboard.down('ArrowUp');
  const shotsAt = [-16, -20, -24];
  try {
    await sleep(page, 3_000); // walk
    await page.keyboard.down('Shift'); // …and run, straight on (heading -z along x = 0)
    try {
      await expect.poll(async () => {
        const z = (await R<P2>(page, 'r.pos()')).z;
        if (shotsAt.length && z <= shotsAt[0]) await shot(page, `calm-run-at-z${-shotsAt.shift()!}`);
        return z;
      }, { timeout: 20_000, intervals: [50] }).toBeLessThan(-45);
    } finally { await page.keyboard.up('Shift'); }
  } finally { await page.keyboard.up('ArrowUp'); }
  const f = await stopTrace(page);
  calm('walk 3 s, then run to z -45', measure(f));
  // the walk's framing, once the view has settled on the walk (its last second)…
  const walkFrames = f.filter((r) => !r.run && r.pz < -3.5 && r.pz > -6.5);
  const runFrames = f.filter((r) => r.run && r.pz < -12);
  const med = (xs: number[]): number => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  const walkDist = med(walkFrames.map((r) => r.dist)), walkHf = med(walkFrames.map((r) => r.hf));
  const runDist = runFrames.map((r) => r.dist), runHf = runFrames.map((r) => r.hf);
  const note = `walk: lens ${walkDist.toFixed(2)} m, height share ${walkHf.toFixed(3)} (${walkFrames.length} frames); ` +
    `run: lens ${Math.min(...runDist).toFixed(2)}–${Math.max(...runDist).toFixed(2)} m, height share ${Math.min(...runHf).toFixed(3)}–${Math.max(...runHf).toFixed(3)} (${runFrames.length} frames)`;
  info.annotations.push({ type: 'camera', description: note });
  console.log(note);
  expect(walkFrames.length, note).toBeGreaterThan(20);
  expect(runFrames.length, note).toBeGreaterThan(60);
  // …and running keeps it: the lens within 15 % of the walking distance the whole way, he
  // as tall on the screen (FOV untouched)
  expect.soft(Math.max(...runDist.map((d) => Math.abs(d - walkDist) / walkDist)), `running keeps the lens within 15 % of the walk's — ${note}`).toBeLessThanOrEqual(0.15);
  expect.soft(Math.max(...runHf.map((h) => Math.abs(h - walkHf) / walkHf)), `running, he stays as tall on the screen (within 15 %) — ${note}`).toBeLessThanOrEqual(0.15);
  await reportPageErrors(info, errors);
  expect(errors).toEqual([]);
});

/** The view as he climbs in or steps out: the frames from the click until it rests.
 *  `moved`: frames whose lens moved over 2 cm; `jumps`: frames over 1 m (a cut). */
function transition(f: Frame[], from: number, to = Infinity): { frames: Frame[]; moved: number; jumps: number; secs: number } {
  const fr = f.filter((r) => r.t >= from && r.t <= to);
  let moved = 0, jumps = 0, first = -1, last = -1;
  for (let i = 1; i < fr.length; i++) {
    const s = between(fr[i - 1], fr[i]).step;
    if (s > 0.02) { moved += 1; if (first < 0) first = fr[i - 1].t; last = fr[i].t; }
    if (s > 1) jumps += 1;
  }
  return { frames: fr, moved, jumps, secs: first < 0 ? 0 : (last - first) / 1000 };
}

async function boardAndStepOut(page: Page, reduced: boolean): Promise<void> {
  const tag = reduced ? 'reduced motion' : 'full motion';
  const jeep = await R<P2>(page, 'r.vehicle()');
  await walkTo(page, jeep, { stopDist: 1, timeout: 60_000, until: (s) => s.jeepNear });
  await sleep(page, 1_500); // he stands; the view rests behind him
  await startTrace(page);
  await sleep(page, 300);
  const t0 = await page.evaluate(() => performance.now());
  await page.getByRole('button', { name: /Stap in de jeep/ }).click();
  await expect.poll(() => R<boolean>(page, 'r.vehicle().inVehicle'), { timeout: 5_000 }).toBe(true);
  await sleep(page, 2_500);
  await shot(page, `calm-board-${reduced ? 'reduced' : 'glide'}`);
  // a little drive: straight on, then a turn
  await page.keyboard.down('ArrowUp'); await sleep(page, 2_000);
  await page.keyboard.down('ArrowLeft'); await sleep(page, 1_500);
  await page.keyboard.up('ArrowLeft'); await page.keyboard.up('ArrowUp');
  await sleep(page, 2_000); // it rolls to a stop, the chase view rests
  const t1 = await page.evaluate(() => performance.now());
  await page.getByRole('button', { name: /Stap uit/ }).click();
  await expect.poll(() => R<boolean>(page, 'r.vehicle().inVehicle'), { timeout: 5_000 }).toBe(false);
  await sleep(page, 2_500);
  await shot(page, `calm-step-out-${reduced ? 'reduced' : 'glide'}`);
  const f = await stopTrace(page);
  const board = transition(f, t0, t0 + 2_500);
  const out = transition(f, t1);
  const walkBefore = f.filter((r) => r.t < t0).map((r) => r.dist);
  const chase = board.frames[board.frames.length - 1].dist, back = out.frames[out.frames.length - 1].dist;
  const note = `${tag}: board ${board.moved} moving frames over ${board.secs.toFixed(2)} s, ${board.jumps} cuts, lens ${walkBefore[walkBefore.length - 1].toFixed(2)} → ${chase.toFixed(2)} m; ` +
    `step out ${out.moved} moving frames over ${out.secs.toFixed(2)} s, ${out.jumps} cuts, lens → ${back.toFixed(2)} m`;
  test.info().annotations.push({ type: 'camera', description: note });
  console.log(note);
  expect.soft(chase, `${tag}: aboard, the view is the chase view — ${note}`).toBeGreaterThan(7);
  expect.soft(back, `${tag}: stepped out, the view is the walk view again — ${note}`).toBeLessThan(6.5);
  if (reduced) {
    // one clean cut each way: the lens stands still, jumps once, and stands still again
    const c = measure(f);
    const info = report(`${tag}: board, drive and step out`, c);
    expect.soft(c.fovs, `${tag}: the FOV is 55 on every frame — ${info}`).toEqual([55]);
    expect.soft(c.halfFaded, `${tag}: he is solid or gone, never half see-through — ${info}`).toBe(0);
    expect.soft(board.jumps, `${tag}: climbing in is one cut — ${note}`).toBe(1);
    expect.soft(out.jumps, `${tag}: stepping out is one cut — ${note}`).toBe(1);
    expect.soft(board.moved, `${tag}: …and nothing glides round it — ${note}`).toBeLessThanOrEqual(2);
    expect.soft(out.moved, `${tag}: …and nothing glides round it — ${note}`).toBeLessThanOrEqual(3);
  } else {
    // a glide each way, over about a second, never one frame's snap
    calm(`${tag}: board, drive and step out`, measure(f));
    expect.soft(board.jumps + out.jumps, `${tag}: no cut — ${note}`).toBe(0);
    // (counted in seconds: a loaded machine draws fewer frames of the same glide)
    expect.soft(board.secs, `${tag}: climbing in glides over ~1 s — ${note}`).toBeGreaterThan(0.8);
    expect.soft(out.secs, `${tag}: stepping out glides over ~1 s — ${note}`).toBeGreaterThan(0.8);
    expect.soft(Math.min(board.moved, out.moved), `${tag}: …drawn as a glide, frame by frame — ${note}`).toBeGreaterThan(10);
  }
}

test('calm camera: into the jeep and out again, the view glides (and cuts once each way under reduced motion)', async ({ page }, info) => {
  test.setTimeout(5 * 60_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);
  await enterWorld(page);
  await boardAndStepOut(page, false);
  await reportPageErrors(info, errors);
  expect(errors).toEqual([]);
});

test('calm camera: under reduced motion climbing in and stepping out are each one clean cut', async ({ page }, info) => {
  test.setTimeout(5 * 60_000);
  const errors: string[] = [];
  collectPageErrors(page, errors);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enterWorld(page);
  await boardAndStepOut(page, true);
  await reportPageErrors(info, errors);
  expect(errors).toEqual([]);
});
