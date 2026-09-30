import type { Page } from '@playwright/test';

/**
 * drive-lib.ts — driving the jeep like a player lining up on something (run 6, FEEL).
 *
 * The roaming animals graze between junipers, boulders and the parked helicopter, so a
 * straight run at one from wherever the jeep happens to be often meets a bush first. These
 * helpers find a run-up with nothing in the way (`stagingPoint`: a spot some 30 m out from
 * which the straight line through the target and on past it is clear), drive there with the
 * real keys (`driveTo`: W plus A/D toward a goal, off the gas for a sharp turn, like a
 * child), and wait for the jeep to stand. Every read is the dev hook's; nothing is moved.
 */

export type P2 = { x: number; z: number };

/** Evaluate `expr` against the dev hook (`r` = window.__ranger). Read-only. */
export function hookR<T>(page: Page, expr: string): Promise<T> {
  return page.evaluate(`(() => { const r = window.__ranger; return r ? (${expr}) : null; })()`) as Promise<T>;
}

const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/** The segment a→b stays `room` m clear of every solid (trunks, bushes, rocks, buildings,
 *  people, the parked vehicles), 1.2 m clear of every marker's keep-out ground and helipad,
 *  and inside the world. */
export function lineClear(page: Page, a: P2, b: P2, room: number): Promise<boolean> {
  return page.evaluate(({ a, b, room }) => {
    type O = { x: number; z: number; r: number; box?: { hx: number; hz: number } };
    const r = (window as unknown as { __ranger: { obstacles(): O[]; markers(): P2[]; heli(): { pads: P2[] } | null } }).__ranger;
    const gap = (cx: number, cz: number, rr: number): number => {
      const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
      const k = Math.max(0, Math.min(1, ((cx - a.x) * dx + (cz - a.z) * dz) / L2));
      return Math.hypot(cx - (a.x + dx * k), cz - (a.z + dz * k)) - rr;
    };
    for (const o of r.obstacles()) if (gap(o.x, o.z, o.box ? Math.hypot(o.box.hx, o.box.hz) : o.r) < room) return false;
    for (const m of r.markers()) if (gap(m.x, m.z, 5.2) < 1.2) return false;
    for (const p of r.heli()?.pads ?? []) if (gap(p.x, p.z, 3.2) < 1.2) return false;
    return Math.hypot(a.x, a.z) < 64 && Math.hypot(b.x, b.z) < 64;
  }, { a, b, room });
}

/**
 * A staging spot `back` m out from `at` from which a straight run through `at` and `beyond`
 * m on is clear (`lineClear` with `room`), nearest to `from`; null when none. With `stops`,
 * the run must be clear through at least `need` of those points instead (the grazing stops
 * of a roaming animal), and the result says which.
 */
export async function stagingPoint(
  page: Page, at: P2, from: P2, opts: { back?: number; beyond?: number; room?: number; stops?: P2[]; need?: number } = {},
): Promise<{ A: P2; through: number[] } | null> {
  const back = opts.back ?? 34, beyond = opts.beyond ?? 10, room = opts.room ?? 1.6;
  const stops = opts.stops ?? [at];
  const need = opts.need ?? 1;
  let best: { A: P2; through: number[]; cost: number } | null = null;
  for (let i = 0; i < 36; i++) {
    const ang = (i / 36) * Math.PI * 2;
    const A = { x: at.x + Math.sin(ang) * back, z: at.z + Math.cos(ang) * back };
    if (Math.hypot(A.x, A.z) > 62) continue;
    const through: number[] = [];
    for (let s = 0; s < stops.length; s++) {
      const dx = stops[s].x - A.x, dz = stops[s].z - A.z, l = Math.hypot(dx, dz) || 1;
      if (await lineClear(page, A, { x: stops[s].x + (dx / l) * beyond, z: stops[s].z + (dz / l) * beyond }, room)) through.push(s);
    }
    if (through.length < need) continue;
    const cost = Math.hypot(A.x - from.x, A.z - from.z) + ((await lineClear(page, from, A, 1.2)) ? 0 : 25) - through.length * 5;
    if (!best || cost < best.cost) best = { A, through, cost };
  }
  return best ? { A: best.A, through: best.through } : null;
}

/** Drive the jeep with W + A/D toward `goal` until within `within` m (off the gas for a sharp
 *  turn, and for the last `coast` m), then let go of every key. */
export async function driveTo(page: Page, goal: P2, within: number, timeout = 60_000, coast = 0): Promise<void> {
  const held = new Set<string>();
  const set = async (k: string, on: boolean): Promise<void> => {
    if (on && !held.has(k)) { await page.keyboard.down(k); held.add(k); } else if (!on && held.has(k)) { await page.keyboard.up(k); held.delete(k); }
  };
  const t0 = Date.now();
  try {
    while (Date.now() - t0 < timeout) {
      const v = await hookR<{ x: number; z: number; heading: number; speed: number }>(page, 'r.vehicle()');
      const d = Math.hypot(goal.x - v.x, goal.z - v.z);
      if (d < within) break;
      const e = wrap(Math.atan2(goal.x - v.x, goal.z - v.z) - v.heading);
      await set('KeyW', (d > coast || Math.abs(v.speed) < 1) && !(Math.abs(e) > 0.6 && v.speed > 2.5));
      await set('KeyA', e > 0.08);
      await set('KeyD', e < -0.08);
      await page.waitForTimeout(60);
    }
  } finally {
    for (const k of [...held]) await page.keyboard.up(k);
  }
}

/** Wait until the jeep stands (≤ 10 s). */
export async function jeepRests(page: Page): Promise<void> {
  for (let i = 0; i < 100; i++) {
    const v = await hookR<{ speed: number }>(page, 'r.vehicle()');
    if (Math.abs(v.speed) < 0.05) return;
    await page.waitForTimeout(100);
  }
}
