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
 *
 * A fitted window sits on its edge (each stem given back as far as the share allows), so a
 * lens a few centimetres off the planned one can see a back point more or less. The search
 * checks the share again for the lens it really stands at (he stops up to ~0.15 m from his
 * planned spot; another screen frames otherwise) and, off the level's band, fits the stand
 * again from its built stems for that lens (`refitWindow`): the share he searches with is
 * always the level's.
 */

import { blocks, openWindow, visibleShare, type Stem, type V3 } from '../cover-math.ts';

/** The share is fitted into [min, min + FIT_BAND] (a share moves in steps of 1/15). */
export const FIT_BAND = 0.07;
/** A tussock grows at most this much taller (its looks: a little taller and fuller). */
export const GROW_MAX = 1.4;

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
 * Close the window: grow tussocks near the calf (`near` m of `at`), at most 40 %, until at
 * most `max` shows, never under `min`. Each round every tussock is tried at the least
 * growth that hides one more of the points still seen (a tussock may hide two or three at
 * once there); of those that keep at least `min`, the one that lands in [min, max] is grown
 * (the least growth first), else the one that hides most. Returns the stems it grew.
 */
export function closeWindow(stems: Stem[], built: readonly Built[], eye: V3, pts: readonly V3[], max: number, min: number, at: V3, near = 2.5,
  keep: ReadonlySet<number> = new Set()): number[] {
  const grown = new Map<number, number>();
  const k = (i: number): number => grown.get(i) ?? 1;
  const share = (): number => visibleShare(pts, eye, stems);
  for (let guard = 0; guard < 40 && share() > max + 1e-9; guard++) {
    // (a tussock grown hides what it hid and more: only the points still seen are tried)
    const seen = pts.filter((p) => !stems.some((s) => blocks(s, eye, p)));
    let best = -1, bestK = 1, bestShare = Infinity, bestIn = false;
    stems.forEach((s, i) => {
      const b = built[i];
      if (!b || keep.has(i) || s.kind !== 'tussock' || k(i) >= GROW_MAX - 1e-9 || Math.hypot(s.x - at.x, s.z - at.z) > near) return;
      const was = { h: s.h, lx: s.lx, lz: s.lz, r: s.r, h0: s.h0 };
      const back = (): void => { Object.assign(s, was); if (was.h0 === undefined) delete s.h0; };
      const hides = (): number => seen.filter((p) => blocks(s, eye, p)).length;
      sizeAt(s, b, GROW_MAX);
      if (!hides()) { back(); return; } // (grown all the way it hides nothing more)
      let lo = k(i), hi = GROW_MAX;
      for (let n = 0; n < 9; n++) {
        const mid = (lo + hi) / 2;
        sizeAt(s, b, mid);
        if (hides()) hi = mid; else lo = mid;
      }
      sizeAt(s, b, hi);
      const sh = (seen.length - hides()) / pts.length;
      back();
      if (sh < min - 1e-9) return; // (it hides too much at once)
      const inBand = sh <= max + 1e-9;
      const better = best < 0 || (inBand && !bestIn) || (inBand === bestIn && (inBand ? hi - k(i) < bestK - k(best) : sh < bestShare - 1e-9));
      if (better) { best = i; bestK = hi; bestShare = sh; bestIn = inBand; }
    });
    if (best < 0) break;
    sizeAt(stems[best], built[best], bestK);
    grown.set(best, bestK);
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

/**
 * The search's check for the lens it really stands at (run 7, ree-growth r2): the share in
 * the level's band [min, min + FIT_BAND] stays as laid; off it, the stand is fitted again
 * from its built stems for this lens (the same `fitWindow`). Returns the stems now drawn
 * otherwise than before (they grow to it calmly while the lens moves in); a stem changed
 * by either fit keeps its built height as `h0`, so it is drawn as wide as it is tall.
 */
export function refitWindow(stems: Stem[], built: readonly Built[], eye: V3, pts: readonly V3[], min: number, at: V3): number[] {
  const share = visibleShare(pts, eye, stems);
  if (share >= min - 1e-9 && share <= min + FIT_BAND + 1e-9) return [];
  const before = stems.map((s) => s.h);
  stems.forEach((s, i) => {
    const b = built[i];
    if (!b) return;
    s.h = b.h; s.lx = b.lx; s.lz = b.lz; s.r = b.r;
    delete s.h0;
  });
  fitWindow(stems, built, eye, pts, min, at);
  const changed: number[] = [];
  stems.forEach((s, i) => {
    const b = built[i];
    if (!b) return;
    if (Math.abs(s.h - before[i]) > 1e-6) changed.push(i);
    if (s.h0 === undefined && (Math.abs(s.h - b.h) > 1e-6 || Math.abs(before[i] - b.h) > 1e-6)) s.h0 = b.h;
  });
  return changed;
}
