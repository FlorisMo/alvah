import { test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';

/**
 * Shared E2E helpers for the browser-proof suite (WORLD-PLAN §3.1).
 */

/** Directory for curated artifact screenshots (gitignored, W0.1). */
export const SHOTS_DIR = 'e2e/__shots__';

/**
 * Save a named artifact screenshot for human review. Screenshots are proof for
 * a person, never an assertion target (SwiftShader pixels are not stable).
 * No-op on webkit (W0.8): the iPad-Safari pass exists for engine coverage, not
 * curated shots — chromium already captures the same steps.
 */
export async function shot(page: Page, name: string): Promise<void> {
  if (test.info().project.name === 'webkit') return;
  await page.screenshot({ path: `${SHOTS_DIR}/${name}.png` });
}

/**
 * Collect page errors (uncaught exceptions). The boot smoke asserts this stays
 * empty — a silent throw during boot is exactly the class of failure run 1
 * never caught.
 */
export function collectPageErrors(page: Page, sink: string[]): void {
  page.on('pageerror', (err) => sink.push(String(err)));
}

/**
 * Attach the collected page errors to the test report so a failure is
 * self-explaining.
 */
export async function reportPageErrors(testInfo: TestInfo, errors: string[]): Promise<void> {
  if (errors.length) {
    await testInfo.attach('pageerrors', { body: errors.join('\n'), contentType: 'text/plain' });
  }
}

/**
 * The arrow keys a child holds to walk to a goal (wave 2). With the follow camera on
 * they are tank keys: Left / Right turn the ranger (the camera stays behind him, by cuts
 * under reduced motion) until the goal is ahead on screen, and Up walks once it is within
 * 70° of ahead. With "Camera draait mee" off the camera stands still and the keys walk
 * the way the screen shows (Right = to the right of the screen). Call the result every tick with the goal's
 * offset from the ranger (dx, dz) and `cameraYaw()` (the screen's forward on the ground
 * is (−sin ψ, −cos ψ)). When the goal has come no closer for 2 s (pressed against a
 * wall; the cabin stands on the line from spawn to the frisling) he goes round it like
 * a child would: turn away and walk on for a moment, always to the same side (the
 * other side after three tries that got nowhere).
 */
export async function keySteer(page: Page): Promise<(dx: number, dz: number, yaw: number) => Set<string>> {
  const screen = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('alvah-ef-v1') ?? '{}').ranger?.settings?.cameraDraaitMee === false; } catch { return false; }
  });
  let best = Infinity, bestAt = Date.now(), tries = 0, side = 1, turnUntil = 0, walkUntil = 0;
  return (dx, dz, yaw) => {
    const now = Date.now();
    const d = Math.hypot(dx, dz) || 1;
    if (d < best - 0.3) { best = d; bestAt = now; tries = 0; }
    const sideKey = side > 0 ? 'ArrowRight' : 'ArrowLeft';
    if (now < turnUntil) return new Set(screen ? [sideKey] : [sideKey, 'ArrowUp']);
    if (now < walkUntil) return new Set(screen ? [sideKey] : ['ArrowUp']);
    if (now - bestAt > 2_000) {
      if (++tries > 3) { side = -side; tries = 1; }
      turnUntil = now + 700; walkUntil = turnUntil + 900; bestAt = walkUntil;
      return new Set(screen ? [side > 0 ? 'ArrowRight' : 'ArrowLeft'] : [side > 0 ? 'ArrowRight' : 'ArrowLeft', 'ArrowUp']);
    }
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const right = (dx * -fz + dz * fx) / d, ahead = (dx * fx + dz * fz) / d; // the goal on screen
    const want = new Set<string>();
    if (screen) {
      if (right > 0.3) want.add('ArrowRight'); else if (right < -0.3) want.add('ArrowLeft');
      if (ahead > 0.3) want.add('ArrowUp'); else if (ahead < -0.3) want.add('ArrowDown');
      return want;
    }
    const ang = (Math.atan2(right, ahead) * 180) / Math.PI; // + = to the right
    if (Math.abs(ang) < 20) want.add('ArrowUp');
    else if (Math.abs(ang) < 70) { want.add('ArrowUp'); want.add(ang > 0 ? 'ArrowRight' : 'ArrowLeft'); }
    else want.add(ang > 0 ? 'ArrowRight' : 'ArrowLeft');
    return want;
  };
}

/* ------------------------------------------------------------ run 6: motion trace -- */

/** One rendered frame of the ranger on foot, as the dev hook reads it (run 6). */
export interface MotionFrame {
  /** page time (ms) and the frame's length (s) */
  t: number; dt: number;
  x: number; z: number;
  /** post-collision ground speed (m/s) and whether the run gait is on */
  speed: number; running: boolean;
  /** the gait read: which clip leads, footfalls per second */
  gait: 'idle' | 'walk' | 'run' | null; cadence: number;
  /** the ball of each foot (left, right) and the rendered ground under it */
  balls: { x: number; y: number; z: number }[]; ground: number[];
  /** the follow camera: FOV, the ranger's projected height share and centre */
  fov: number; hf: number; sx: number; sy: number; yaw: number;
}

/**
 * Start recording `MotionFrame`s every rendered frame (a rAF loop in the page that only
 * READS `window.__ranger`). Idempotent. Pair with `motionFrames` and `pageNow`.
 */
export async function recordMotion(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __motionRec?: unknown[]; __ranger: any };
    if (w.__motionRec) return;
    const rec: unknown[] = []; w.__motionRec = rec;
    const r = w.__ranger; let last = performance.now();
    const loop = (now: number): void => {
      const m = r.motion(), g = r.gait(), c = r.cam();
      if (m && c) {
        const balls = (g?.soles ?? []).map((s: { toe: { x: number; y: number; z: number } }) => s.toe);
        rec.push({
          t: now, dt: (now - last) / 1000, x: m.x, z: m.z, speed: m.speed, running: m.running,
          gait: g?.name ?? null, cadence: g?.cadence ?? 0,
          balls, ground: balls.map((b: { x: number; z: number }) => r.groundAt(b.x, b.z)),
          fov: c.fov, hf: c.avatarScreen.heightFrac, sx: c.avatarScreen.x, sy: c.avatarScreen.y, yaw: c.yaw,
        });
      }
      last = now;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}

/** The page's clock (ms), to mark a window of the motion trace. */
export function pageNow(page: Page): Promise<number> {
  return page.evaluate(() => performance.now());
}

/** The recorded frames with `from ≤ t ≤ to` (page ms; `to` defaults to now). */
export function motionFrames(page: Page, from: number, to = Infinity): Promise<MotionFrame[]> {
  return page.evaluate(({ from, to }) => ((window as unknown as { __motionRec?: MotionFrame[] }).__motionRec ?? [])
    .filter((f) => f.t >= from && f.t <= to), { from, to });
}

/** The median of some numbers (NaN when empty). */
export function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/**
 * Planted-foot slip over a window, as a share of his ground speed: every frame the ball
 * of the lower foot is within 2.5 cm of the rendered ground (its stance), how fast it
 * moves over the ground (m/s), averaged, ÷ his mean ground speed. 0 = the foot stays put.
 */
export function plantedSlip(frames: MotionFrame[]): { slip: number; frames: number } {
  let sum = 0, n = 0;
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1], b = frames[i];
    if (a.balls.length < 2 || b.balls.length < 2 || !(b.dt > 0)) continue;
    const hA = a.balls.map((p, k) => p.y - a.ground[k]), hB = b.balls.map((p, k) => p.y - b.ground[k]);
    const k = hB[0] <= hB[1] ? 0 : 1;
    if (hB[k] > 0.025 || hA[k] > 0.025) continue;
    sum += Math.hypot(b.balls[k].x - a.balls[k].x, b.balls[k].z - a.balls[k].z) / b.dt;
    n++;
  }
  const v = frames.reduce((s, f) => s + f.speed, 0) / Math.max(1, frames.length);
  return { slip: n && v > 0 ? sum / n / v : NaN, frames: n };
}
