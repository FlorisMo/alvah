/**
 * ree.window.ts — how much of the calf's back the search's lens sees between the stems,
 * fitted to the level (run 7, ree-growth; pure, THREE-free: ree.window.test.ts).
 *
 * The level's `glimpse` (`k.knobs('zoeken')`, the same knob the 2D floor turns into its grass
 * haze) is the share of the calf's back a child should see: ~0.4 on a fresh save, ~0.23 at
 * level 4-5, 0.16 at the top. The stand is built once; how much of a spot shows from a
 * layout's lens differs from spot to spot. So a play fits the stand to the level under the
 * briefing card: where the built grass shows too little, the stems over the calf's back are
 * made smaller (`openWindow`, then each given back as far as the share allows); where it
 * shows too much, the tussocks between the lens and the calf grow a little taller and fuller
 * (at most 40 %) until it shows about the level's share. Every spot of every layout then
 * reads as hard as the level says (decision 1), and the knob is honoured both ways.
 */

import { blocks, openWindow, visibleShare, type Stem, type V3 } from '../cover-math.ts';

/** The share is fitted into [min, min + FIT_BAND] (a share moves in steps of 1/15). */
export const FIT_BAND = 0.07;
/** A tussock grows at most this much taller (its looks: a little taller and fuller). */
export const GROW_MAX = 1.4;
/** …a step at a time. */
const GROW_STEP = 1.1;

/** A stem's built size (as the stand was made). */
export interface Built { h: number; lx: number; lz: number; r: number }

/** Size a stem at `k` × its built height (k ≥ 1: taller, its leaves a little wider; the
 *  renderer reads h / h0 for its width). */
function sizeAt(s: Stem, b: Built, k: number): void {
  s.h = b.h * k; s.lx = b.lx * k; s.lz = b.lz * k;
  s.r = b.r * (1 + (Math.sqrt(k) - 1) * 0.5); // (the maths' leaves grow less than drawn: never over-hidden)
  if (k > 1) s.h0 = b.h; else delete s.h0;
}

/**
 * Close the window: grow the tussocks that would hide most of what shows, one step at a
 * time, until at most `max` shows; never under `min` (the last step is eased back so the
 * share stays at least `min`). Only tussocks near the calf (`near` m of `at`) grow. Returns
 * the stems it grew.
 */
export function closeWindow(stems: Stem[], built: readonly Built[], eye: V3, pts: readonly V3[], max: number, min: number, at: V3, near = 2.5,
  keep: ReadonlySet<number> = new Set()): number[] {
  const grown = new Map<number, number>();
  const k = (i: number): number => grown.get(i) ?? 1;
  for (let guard = 0; guard < 60 && visibleShare(pts, eye, stems) > max; guard++) {
    const seen = pts.filter((p) => !stems.some((s) => blocks(s, eye, p)));
    let best = -1, gain = 0;
    stems.forEach((s, i) => {
      const b = built[i];
      if (!b || keep.has(i) || s.kind !== 'tussock' || k(i) >= GROW_MAX - 1e-9 || Math.hypot(s.x - at.x, s.z - at.z) > near) return;
      const was = { h: s.h, lx: s.lx, lz: s.lz, r: s.r, h0: s.h0 };
      sizeAt(s, b, Math.min(GROW_MAX, k(i) * GROW_STEP));
      const g = seen.filter((p) => blocks(s, eye, p)).length;
      Object.assign(s, was); if (was.h0 === undefined) delete s.h0;
      if (g > gain) { gain = g; best = i; }
    });
    if (best < 0) {
      // (no single step hides a point: grow the tussock nearest the line to the calf's back)
      break;
    }
    const k0 = k(best), k1 = Math.min(GROW_MAX, k0 * GROW_STEP);
    sizeAt(stems[best], built[best], k1);
    grown.set(best, k1);
    if (visibleShare(pts, eye, stems) < min) {
      // too far: ease that step back as far as the share stays at least `min`
      let lo = k0, hi = k1;
      for (let n = 0; n < 7; n++) {
        const mid = (lo + hi) / 2;
        sizeAt(stems[best], built[best], mid);
        if (visibleShare(pts, eye, stems) >= min) lo = mid; else hi = mid;
      }
      sizeAt(stems[best], built[best], lo);
      grown.set(best, lo);
      break;
    }
  }
  return [...grown.keys()].filter((i) => k(i) > 1 + 1e-6);
}

/**
 * Fit the window to the level's share `min` (from the stems as built): too little shows —
 * `openWindow`'s coarse steps, then each stem it lowered given back as far as the share
 * stays at least `min`; too much shows — `closeWindow`. Returns the stems it changed.
 */
export function fitWindow(stems: Stem[], built: readonly Built[], eye: V3, pts: readonly V3[], min: number, at: V3): number[] {
  if (visibleShare(pts, eye, stems) > min + FIT_BAND) return closeWindow(stems, built, eye, pts, min + FIT_BAND, min, at);
  const changed = openWindow(stems, eye, pts, min);
  for (const i of [...changed].reverse()) {
    const s = stems[i], b = built[i];
    if (!b) continue;
    const low = { h: s.h, lx: s.lx, lz: s.lz, r: s.r };
    const set = (t: number): void => {
      s.h = low.h + (b.h - low.h) * t; s.lx = low.lx + (b.lx - low.lx) * t;
      s.lz = low.lz + (b.lz - low.lz) * t; s.r = low.r + (b.r - low.r) * t;
    };
    set(1);
    if (visibleShare(pts, eye, stems) >= min) continue; // (it was not needed at all)
    let lo = 0, hi = 1;
    for (let n = 0; n < 7; n++) {
      const mid = (lo + hi) / 2;
      set(mid);
      if (visibleShare(pts, eye, stems) >= min) lo = mid; else hi = mid;
    }
    set(lo);
  }
  const opened = changed.filter((i) => stems[i].h < (built[i]?.h ?? Infinity) - 1e-6);
  // (a stem that hid several points at once leaves the window too wide: the tussocks
  // round it close it a little, the opened ones kept as they are)
  if (visibleShare(pts, eye, stems) > min + FIT_BAND) return [...opened, ...closeWindow(stems, built, eye, pts, min + FIT_BAND, min, at, 2.5, new Set(opened))];
  return opened;
}
