import { test, expect, type Locator, type Page } from '@playwright/test';
import * as path from 'node:path';

/**
 * Helpers for the golden-path spec (golden.spec.ts): the step/pass/fail table, the
 * read-only dev-hook reads, and "play like a player" input (walking with held arrow
 * keys, clicking buttons with the real mouse). Nothing here wins or skips a step.
 */

export const MAX_DRAW_CALLS = 150;
export const MAX_TRIS = 1_000_000;
export const SEAT_TOLERANCE = 0.05; // m: props stand ON the ground, not in or above it

// ------------------------------------------------------------ report table ----
export type Status = 'pass' | 'FAIL' | 'soft-fail' | 'not reached';
export interface Row { n: number; step: string; status: Status; notes: string[] }

const ROWS: Row[] = [
  'Opening screen', 'Make your ranger', 'Walk the free world', 'Drive the jeep',
  'Go to the first mission', 'Play its mini-games', 'Finish the mission', 'Back in the world + reload',
].map((step, i) => ({ n: i + 1, step, status: 'not reached' as Status, notes: [] }));
let current: Row = ROWS[0];

/** Record a note (a measured number, what was done) on the current step. */
export function note(msg: string): void { current.notes.push(msg); }

/** Quality check: a soft failure (`expect.soft`, the run goes on). */
export function soft(ok: boolean, msg: string): boolean {
  expect.soft(ok, `[golden ${current.n}. ${current.step}] ${msg}`).toBe(true);
  if (!ok) {
    if (current.status === 'pass') current.status = 'soft-fail';
    current.notes.push(`✗ ${msg}`);
  }
  return ok;
}

/** Flow check: the player is blocked here, so the run stops. */
export function hard(ok: boolean, msg: string): asserts ok {
  if (!ok) throw new Error(`[golden ${current.n}. ${current.step}] ${msg}`);
}

/** Record a finding under another step's row (e.g. avatar colours, measured later). */
export function under<T>(n: number, body: () => T): T {
  const was = current;
  current = ROWS[n - 1];
  try { return body(); } finally { current = was; }
}

/** Run GOAL step n; a thrown error marks it FAIL (and stops the run). */
export async function step(n: number, body: () => Promise<void>): Promise<void> {
  current = ROWS[n - 1];
  current.status = 'pass';
  try {
    await test.step(`${n}. ${current.step}`, body);
  } catch (e) {
    current.status = 'FAIL';
    const msg = String((e as Error)?.message ?? e).replace(/\u001b\[[0-9;]*m/g, '').split('\n').filter(Boolean);
    current.notes.push(`✗✗ ${msg.slice(0, 2).join(' — ').replace(/\[golden [^\]]*\]\s*/, '')}`);
    throw e;
  }
}

/** The test ran out of time inside the current step (called from afterEach). */
export function markTimedOut(): void {
  if (current.status === 'pass' || current.status === 'soft-fail') {
    current.status = 'FAIL';
    current.notes.push('✗✗ the test timed out inside this step');
  }
}

export function renderTable(shotDir: string): string {
  const w = Math.max(...ROWS.map((r) => r.step.length)) + 4;
  const lines = [
    '',
    'GOLDEN PATH (GOAL.md 1-8) — real keyboard + real mouse, no winStep',
    `${'step'.padEnd(w)} | ${'result'.padEnd(11)} | note`,
    `${'-'.repeat(w)}-+-${'-'.repeat(11)}-+-${'-'.repeat(60)}`,
  ];
  for (const r of ROWS) {
    const notes = r.notes.length ? r.notes : [''];
    notes.forEach((nt, i) => lines.push(`${(i ? '' : `${r.n}. ${r.step}`).padEnd(w)} | ${(i ? '' : r.status).padEnd(11)} | ${nt}`));
  }
  const firstBroken = ROWS.find((r) => r.status !== 'pass');
  const blocked = ROWS.find((r) => r.status === 'FAIL');
  const verdict = !firstBroken ? 'ALL GREEN: the golden path plays start to finish'
    : `first broken step: ${firstBroken.n}${blocked ? ` · the player is BLOCKED at step ${blocked.n}` : ' · nothing blocks the player'}`;
  lines.push('', verdict, '(✗ = quality failure, the run went on · ✗✗ = blocked, the run stopped there)', `screenshots: ${shotDir}`, '');
  return lines.join('\n');
}

// ------------------------------------------------------------ page helpers ----
export type P2 = { x: number; z: number };
export type Cam = { x: number; y: number; z: number; yaw: number; viewClear: boolean; fov: number;
  avatarScreen: { x: number; y: number; onScreen: boolean; heightFrac: number; visible: boolean } };
export type Snap = { p: P2 | null; c: Cam | null; g: { grounded: boolean; clearance: number } | null; near: string | null;
  jeepNear: boolean; screen: string; view: string | null; t: number };
export type Hint = { id: string; x: number; y: number; onScreen: boolean; firstHit: boolean; aboveGround: boolean;
  firstHitBy: string | null; bottomGap: number | null; reachesCanvas: boolean; blocker: string | null };
export type Seat = { id: string; x: number; y: number; z: number; gap: number; sig: string };
export type Vehicle = { placed: boolean; near: boolean; inVehicle: boolean; x: number; z: number; y: number;
  grounded: boolean; clearance: number; speed: number; fov: number; roll: number };

/** Evaluate `expr` against the dev hook (`r` = window.__ranger). Read-only. */
export function R<T>(page: Page, expr: string): Promise<T> {
  return page.evaluate(`(() => { const r = window.__ranger; return r ? (${expr}) : null; })()`) as Promise<T>;
}

export const snap = (page: Page): Promise<Snap> => R<Snap>(page,
  '({ p: r.pos(), c: r.cam(), g: r.grounded(), near: r.nearId(), jeepNear: !!r.vehicle()?.near, screen: r.screen, view: r.missionView, t: performance.now() })');

export const sleep = (page: Page, ms: number): Promise<void> => page.waitForTimeout(ms);
export const r2 = (n: number): number => Math.round(n * 100) / 100;
export const deg = (rad: number): number => Math.round((rad * 180) / Math.PI);
export function wrap(a: number): number { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }

let shotDir = '';
let shotN = 0;
export function setShotDir(dir: string): void { shotDir = dir; shotN = 0; }
/** Screenshot into test-results/golden/NN-<name>.png; returns the file name. */
export async function shot(page: Page, name: string): Promise<string> {
  shotN += 1;
  const file = `${String(shotN).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: path.join(shotDir, file) });
  return file;
}

/** What the save (localStorage `alvah-ef-v1`) holds that the golden path cares about. */
export async function save(page: Page): Promise<{ voltooid: Record<string, boolean>; trials: Record<string, number> } | null> {
  return page.evaluate(() => {
    try {
      const r = JSON.parse(localStorage.getItem('alvah-ef-v1') ?? '{}').ranger;
      if (!r) return null;
      const trials: Record<string, number> = {};
      for (const [k, v] of Object.entries(r.skill ?? {})) trials[k] = (v as { trials: number }).trials;
      return { voltooid: r.voltooid ?? {}, trials };
    } catch { return null; }
  });
}

export const uiText = (page: Page): Promise<string> => page.evaluate(() => document.getElementById('ui')?.innerText ?? '');

export async function visibleButtons(page: Page): Promise<string> {
  const t = (await page.getByRole('button').filter({ visible: true }).allInnerTexts()).map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean);
  return t.join(' | ') || 'none';
}

/** Budget sample: draw calls + triangles of the last frame (soft, with the numbers). */
export async function budget(page: Page, where: string): Promise<void> {
  const calls = await R<number | null>(page, 'r.drawCalls()');
  const tris = await R<number | null>(page, 'r.tris()');
  soft(calls !== null && calls < MAX_DRAW_CALLS, `draw calls ${where}: ${calls} (budget < ${MAX_DRAW_CALLS})`);
  soft(tris !== null && tris < MAX_TRIS, `triangles ${where}: ${tris?.toLocaleString('en')} (budget < ${MAX_TRIS.toLocaleString('en')})`);
}

/** Is the centre of this element free for a mouse, or does another element cover it? */
export async function uncovered(loc: Locator): Promise<string | null> {
  return loc.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    if (!top || top === el || el.contains(top)) return null;
    const cls = typeof top.className === 'string' && top.className ? `.${top.className.trim().split(/\s+/).join('.')}` : '';
    return `${top.tagName.toLowerCase()}${cls} "${(top as HTMLElement).innerText?.trim().slice(0, 30) ?? ''}"`;
  });
}

/** Click a visible button like a player: the real mouse, at its centre. */
export async function clickButton(page: Page, name: RegExp | string, what: string, timeout = 10_000): Promise<void> {
  const btn = page.getByRole('button', { name, exact: typeof name === 'string' }).filter({ visible: true }).first();
  const shown = await btn.waitFor({ state: 'visible', timeout }).then(() => true, () => false);
  if (!shown) hard(false, `${what}: no visible button ${String(name)} (visible buttons: ${await visibleButtons(page)})`);
  const cover = await uncovered(btn);
  soft(cover === null, `${what}: the "${String(name)}" button is covered by ${cover}`);
  await btn.click({ timeout: 5_000 });
}

// ------------------------------------------------------------------ walking ----
export type WalkStats = { res: 'arrived' | 'until' | 'stuck' | 'timeout'; ms: number; samples: number;
  worstClearance: number; notGrounded: number; viewBlocked: number; camAhead: number; maxYawRate: number; end: P2 };

/**
 * Walk like a player holding the arrow keys: the camera's view is "forward" (camera →
 * ranger), turn toward the goal, walk when facing it, side-step when blocked. Every
 * sample also records: feet on the rendered ground, a tree blocking the view, the
 * camera swinging round in front of him, and how fast the camera turns.
 */
export async function walkTo(page: Page, goal: P2, opts: { stopDist?: number; until?: (s: Snap) => boolean; timeout?: number } = {}): Promise<WalkStats> {
  const { stopDist = 1.2, until, timeout = 90_000 } = opts;
  const held = new Set<string>();
  const setKeys = async (want: Set<string>): Promise<void> => {
    for (const k of [...held]) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); }
    for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
  };
  const st: WalkStats = { res: 'timeout', ms: 0, samples: 0, worstClearance: 0, notGrounded: 0, viewBlocked: 0, camAhead: 0, maxYawRate: 0, end: { x: 0, z: 0 } };
  const t0 = Date.now();
  let best = Infinity; let bestAt = Date.now(); let prev: Snap | null = null; let detour = 0;
  try {
    while (Date.now() - t0 < timeout) {
      const s = await snap(page);
      if (!s.p || !s.c) { await sleep(page, 150); continue; }
      st.end = s.p;
      if (until?.(s)) { st.res = 'until'; break; }
      const dx = goal.x - s.p.x; const dz = goal.z - s.p.z; const d = Math.hypot(dx, dz);
      if (d < stopDist) { st.res = 'arrived'; break; }
      st.samples += 1;
      if (s.g) {
        if (Math.abs(s.g.clearance) > Math.abs(st.worstClearance)) st.worstClearance = s.g.clearance;
        if (!s.g.grounded) st.notGrounded += 1;
      }
      if (!s.c.viewClear) st.viewBlocked += 1;
      if (prev?.p && prev.c) {
        const dt = (s.t - prev.t) / 1000;
        if (dt > 0) st.maxYawRate = Math.max(st.maxYawRate, Math.abs(wrap(s.c.yaw - prev.c.yaw)) / dt);
        const mx = s.p.x - prev.p.x; const mz = s.p.z - prev.p.z;
        if (Math.hypot(mx, mz) > 0.12) { // walking, yet the camera stands ahead of him (sees his face)?
          const cx = s.c.x - s.p.x; const cz = s.c.z - s.p.z;
          if ((cx * mx + cz * mz) / (Math.hypot(cx, cz) * Math.hypot(mx, mz)) > 0.5) st.camAhead += 1;
        }
      }
      prev = s;
      if (d < best - 0.3) { best = d; bestAt = Date.now(); detour = 0; }
      if (Date.now() - bestAt > 4_000) { // blocked (a tree, the cabin): side-step like a child would
        if (++detour > 4) { st.res = 'stuck'; break; }
        await setKeys(new Set([detour % 2 ? 'ArrowRight' : 'ArrowLeft', 'ArrowUp']));
        await sleep(page, 900);
        bestAt = Date.now();
        continue;
      }
      let fx = s.p.x - s.c.x; let fz = s.p.z - s.c.z; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
      const ang = (Math.atan2((dx * -fz + dz * fx) / d, (dx * fx + dz * fz) / d) * 180) / Math.PI;
      const want = new Set<string>();
      if (Math.abs(ang) < 20) want.add('ArrowUp');
      else if (Math.abs(ang) < 70) { want.add('ArrowUp'); want.add(ang > 0 ? 'ArrowRight' : 'ArrowLeft'); }
      else want.add(ang > 0 ? 'ArrowRight' : 'ArrowLeft');
      await setKeys(want);
      await sleep(page, 120);
    }
  } finally {
    await setKeys(new Set());
  }
  st.ms = Date.now() - t0;
  return st;
}

/** Turn a walk's samples into notes + soft checks (GOAL 3: ground, calm camera). */
export function walkQuality(st: WalkStats, where: string): void {
  note(`${where}: ${st.res} in ${(st.ms / 1000).toFixed(1)} s (${st.samples} samples, worst foot clearance ${r2(st.worstClearance)} m)`);
  soft(st.notGrounded === 0 && Math.abs(st.worstClearance) <= SEAT_TOLERANCE,
    `${where}: feet off the rendered ground (worst clearance ${r2(st.worstClearance)} m, ${st.notGrounded} samples not grounded)`);
  soft(st.viewBlocked === 0, `${where}: the view of the ranger was blocked (cam().viewClear=false) in ${st.viewBlocked}/${st.samples} samples`);
  soft(st.camAhead === 0, `${where}: the camera swung in front of the ranger (faces him) in ${st.camAhead}/${st.samples} samples`);
  soft(deg(st.maxYawRate) <= 150, `${where}: the camera turned ${deg(st.maxYawRate)}°/s at its fastest (calm ≤ 150°/s)`);
}

/** Hold one key, then let go: camera yaw travel while held and in the second after, and the walk. */
export async function holdKey(page: Page, key: string, ms: number): Promise<{ during: number; after: number; moved: number; dir: number | null; onScreen: boolean }> {
  const s0 = await snap(page);
  const yaws: { yaw: number; after: boolean }[] = [];
  let onScreen = true;
  let last = s0;
  await page.keyboard.down(key);
  const t0 = Date.now();
  try {
    while (Date.now() - t0 < ms) {
      last = await snap(page);
      if (last.c) { yaws.push({ yaw: last.c.yaw, after: false }); onScreen &&= last.c.avatarScreen.onScreen; }
      await sleep(page, 60);
    }
  } finally {
    await page.keyboard.up(key);
  }
  const held = last;
  const t1 = Date.now();
  while (Date.now() - t1 < 1_000) {
    const s = await snap(page);
    if (s.c) { yaws.push({ yaw: s.c.yaw, after: true }); onScreen &&= s.c.avatarScreen.onScreen; }
    await sleep(page, 80);
  }
  let during = 0; let after = 0;
  for (let i = 1; i < yaws.length; i++) {
    const d = Math.abs(wrap(yaws[i].yaw - yaws[i - 1].yaw));
    if (yaws[i].after && yaws[i - 1].after) after += d; else during += d;
  }
  const moved = s0.p && held.p ? Math.hypot(held.p.x - s0.p.x, held.p.z - s0.p.z) : 0;
  let dir: number | null = null;
  if (s0.p && held.p && s0.c && moved > 0.3) { // walk direction vs the camera's forward at the start
    const fx = s0.p.x - s0.c.x; const fz = s0.p.z - s0.c.z;
    const mx = held.p.x - s0.p.x; const mz = held.p.z - s0.p.z;
    dir = deg(Math.atan2(fx * mz - fz * mx, fx * mx + fz * mz));
  }
  return { during: deg(during), after: deg(after), moved: r2(moved), dir, onScreen };
}

// ---------------------------------------------------------- avatar colours ----
/**
 * Which option's colour does the RENDERED ranger show? Screenshots two strips of the
 * ranger seen from the follow camera (jacket = mid-torso, hair = top of the head),
 * decodes them in the page and (jacket) lets every tinted pixel vote for the option
 * nearest in chroma direction (a*b*), so golden-hour light and shading do not decide
 * it; (hair) takes the strip's mean Lab and the nearest option. `options` are
 * "id=#rrggbb" strings from core/avatar.ts.
 */
export async function renderedLook(page: Page, options: { jacket: string[]; hair: string[] }): Promise<{ jacket: string; jacketShare: number; hair: string } | null> {
  const c = await R<Cam | null>(page, 'r.cam()');
  if (!c || !c.avatarScreen.onScreen) return null;
  const vp = page.viewportSize()!;
  const cx = ((c.avatarScreen.x + 1) / 2) * vp.width;
  const cy = ((1 - c.avatarScreen.y) / 2) * vp.height;
  const h = c.avatarScreen.heightFrac * vp.height;
  const clip = (y0: number, y1: number, halfW: number) => ({
    x: Math.max(0, cx - halfW * h), y: Math.max(0, cy + y0 * h), width: Math.max(2, 2 * halfW * h), height: Math.max(2, (y1 - y0) * h),
  });
  const jacketPng = (await page.screenshot({ clip: clip(-0.14, 0.1, 0.1) })).toString('base64');
  const hairPng = (await page.screenshot({ clip: clip(-0.5, -0.32, 0.09) })).toString('base64');
  return page.evaluate(async ({ jacketPng, hairPng, jacket, hair }) => {
    const lab = (r: number, g: number, b: number): [number, number, number] => {
      const f = (u: number) => { u /= 255; return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4; };
      const [R, G, B] = [f(r), f(g), f(b)];
      const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
      const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
      const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
      const t = (v: number) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
      return [116 * t(Y) - 16, 500 * (t(X) - t(Y)), 200 * (t(Y) - t(Z))];
    };
    const hex = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)) as [number, number, number];
    const pixels = async (b64: string) => {
      const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
      const cv = new OffscreenCanvas(img.width, img.height); const g = cv.getContext('2d')!;
      g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height).data;
    };
    const opts = (list: string[]) => list.map((s) => { const [id, col] = s.split('='); return { id, lab: lab(...hex(col)) }; });
    const jo = opts(jacket); const votes = new Map<string, number>(); let n = 0;
    const jp = await pixels(jacketPng);
    for (let i = 0; i < jp.length; i += 4) {
      const [L, a, b] = lab(jp[i], jp[i + 1], jp[i + 2]);
      if (L < 8 || Math.hypot(a, b) < 6) continue; // too dark / grey to carry a colour
      const ang = Math.atan2(b, a); let best = ''; let bd = Infinity;
      for (const o of jo) { let d = Math.abs(ang - Math.atan2(o.lab[2], o.lab[1])); if (d > Math.PI) d = 2 * Math.PI - d; if (d < bd) { bd = d; best = o.id; } }
      votes.set(best, (votes.get(best) ?? 0) + 1); n += 1;
    }
    let jWin = 'none'; let jCount = 0;
    for (const [k, v] of votes) if (v > jCount) { jWin = k; jCount = v; }
    const hp = await pixels(hairPng); const m = [0, 0, 0]; let hn = 0;
    for (let i = 0; i < hp.length; i += 4) { const l = lab(hp[i], hp[i + 1], hp[i + 2]); m[0] += l[0]; m[1] += l[1]; m[2] += l[2]; hn += 1; }
    const mean = m.map((v) => v / Math.max(1, hn));
    let hWin = 'none'; let hd = Infinity;
    for (const o of opts(hair)) { const d = Math.hypot(mean[0] - o.lab[0], mean[1] - o.lab[1], mean[2] - o.lab[2]); if (d < hd) { hd = d; hWin = o.id; } }
    return { jacket: jWin, jacketShare: n ? Math.round((100 * jCount) / n) : 0, hair: hWin };
  }, { jacketPng, hairPng, jacket: options.jacket, hair: options.hair });
}
