/**
 * frisling.window.ts — how much of the lost piglet the search's lens sees between the stems,
 * fitted to the level BOTH ways (run 7 fix, fair variety; pure, THREE-free; pinned in
 * frisling.places.test.ts).
 *
 * The level's `glimpse` (`k.knobs('zoeken')`, the 2D floor's haze) is the share of his back a
 * child should see. Where he lies differs from play to play (a way, a nook, how he lies), and
 * none of that may make the search easier or harder (run decision 1). So under the briefing
 * card the stand is fitted for this play's nook: the stems over his back are made smaller
 * (`openWindow`, each then given back as far as the share allows) where the stand shows too
 * little, and the tussocks round him grow a little (ree.window `closeWindow`, at most 40 %)
 * where it shows too much, until his back shows the share wanted, measured on a fine grid
 * (`BACK_GRID`: a share moves in 1/65ths, never in fifteenths).
 *
 * The share wanted is the knob, a little less in a nook near the lens and a little more in a
 * far one (`shareFor`, at most ±10 %): what a child sees is how big his stripes are in the
 * picture, and a nook a metre nearer shows him a third bigger. So every nook and every way
 * he lies shows about as much of him at one level (pinned: the visible area in the picture
 * within a narrow band of each band's median, falling band by band).
 */

import { backPoints, blocks, openWindow, visibleShare, type Stem, type V3 } from '../cover-math.ts';
import { closeWindow, type Built } from './ree.window.ts';
import { SIZE } from '../../AnimalScale.ts';
import { lyingHeight, LEG_SHARE } from '../../play/pose.ts';

/** The fine grid the share is measured on: 17 points along his back, 5 across it (a share
 *  moves in 1/85ths). */
export const BACK_GRID = { along: 17, across: 5 } as const;
/** His back's height lying flat (m). */
export const PIGLET_TOP = lyingHeight(SIZE.frisling.h, LEG_SHARE.frisling);

/** His back's points, lying at `at` (its `yaw` the way his head points) on ground `y`. */
export function pigletBack(at: { x: number; z: number; yaw: number }, y: number): V3[] {
  return backPoints(at.x, y, at.z, at.yaw, SIZE.frisling.len, PIGLET_TOP, BACK_GRID);
}

/** The way a lens looks (a unit vector) from its heading and its pitch down (degrees). */
export function lensAxis(heading: number, pitchDeg: number): V3 {
  const p = (pitchDeg * Math.PI) / 180;
  return { x: Math.sin(heading) * Math.cos(p), y: -Math.sin(p), z: Math.cos(heading) * Math.cos(p) };
}

/**
 * How big he looks in the picture of a lens at `eye` looking along `axis` (a pure stand-in
 * for his size on screen; px² over the focal length squared): per back point, how squarely
 * his flank faces the eye over its distance squared, stretched as a pinhole lens stretches
 * what lies off its middle (1 / cos³ of the angle off the axis), averaged.
 */
export function looksSize(pts: readonly V3[], yaw: number, eye: V3, axis: V3): number {
  if (!pts.length) return 0;
  const nx = Math.cos(yaw), nz = -Math.sin(yaw); // (his flank's normal, either side)
  let sum = 0;
  for (const p of pts) {
    const dx = eye.x - p.x, dy = eye.y - p.y, dz = eye.z - p.z;
    const d = Math.hypot(dx, dy, dz);
    const c = Math.max(0.2, -(dx * axis.x + dy * axis.y + dz * axis.z) / d);
    sum += Math.abs(nx * dx + nz * dz) / (d * d * d * c * c * c);
  }
  return sum / pts.length;
}

/** His looks in the middle nook of all (the median over every way × nook × pose from the
 *  planned lens; pinned by frisling.places.test.ts). */
export const LOOKS_REF = 0.0262;
/** How far the share may move off the knob to even out near and far (±). */
export const LOOKS_GIVE = 0.11;
/** How far from the share wanted a fit may land (±): just over half a 1/85 step. */
export const FIT_TOL = 0.006;

/** The share of his back to show for the level's `glimpse`, seen from `eye` along `axis`. */
export function shareFor(glimpse: number, pts: readonly V3[], yaw: number, eye: V3, axis: V3): number {
  const k = LOOKS_REF / Math.max(1e-9, looksSize(pts, yaw, eye, axis));
  return glimpse * Math.min(1 + LOOKS_GIVE, Math.max(1 - LOOKS_GIVE, k));
}

/** The stems that can stand between `eye` and him at `at` (their roots within 1.6 m of the
 *  line of sight, short of him): the fit only ever touches these. */
function corridor(stems: readonly Stem[], eye: V3, at: V3): number[] {
  const ax = at.x - eye.x, az = at.z - eye.z, l2 = ax * ax + az * az || 1;
  const out: number[] = [];
  stems.forEach((s, i) => {
    const t = Math.max(0, Math.min(1.08, ((s.x - eye.x) * ax + (s.z - eye.z) * az) / l2));
    if (Math.hypot(eye.x + ax * t - s.x, eye.z + az * t - s.z) < 1.6) out.push(i);
  });
  return out;
}

/** The 3 × 5 points of the fine grid that make the coarse one (cover-math's own grid: every
 *  fourth point along, every second across), for a quick first window. */
function coarseOf(pts: readonly V3[]): V3[] {
  const { along, across } = BACK_GRID;
  if (pts.length !== along * across) return [...pts];
  return pts.filter((_, k) => Math.floor(k / across) % ((along - 1) / 4) === 0 && (k % across) % ((across - 1) / 2) === 0);
}

/**
 * Fit the stems (as built) so `want` ± `FIT_TOL` of `pts` shows from `eye`: too little — a
 * window opened over his back (`openWindow`, first on the coarse grid, then on the fine one
 * only if still short), each stem it lowered then given back as far as the share stays in;
 * too much — `closeWindow` (the tussocks round him grow, at most 40 %). Only the stems in the
 * lens's line to him are touched. Edits `stems` in place; returns the indices it changed.
 */
export function fitGlimpse(stems: Stem[], built: readonly Built[], eye: V3, pts: readonly V3[], want: number, at: V3): number[] {
  const ids = corridor(stems, eye, at);
  const S = ids.map((i) => stems[i]);
  const B = ids.map((i) => built[i]);
  const lo = want - FIT_TOL, hi = want + FIT_TOL;
  if (visibleShare(pts, eye, S) > hi) return closeWindow(S, B, eye, pts, hi, lo, at).map((j) => ids[j]);
  // (a little past the share on the coarse grid, then on the fine one while still short: the
  // give-back below takes it back to the share, a stem at a time)
  const changed = new Set(openWindow(S, eye, coarseOf(pts), Math.min(1, lo + 0.04)));
  if (visibleShare(pts, eye, S) < lo) for (const j of openWindow(S, eye, pts, lo)) changed.add(j);
  // each stem lowered given back as far as the share stays in (the newest first): what each
  // stem hides is known once, so a try costs one stem against the points nobody else hides
  const blk = S.map((st) => pts.map((p) => blocks(st, eye, p)));
  const count = pts.map((_, p) => blk.reduce((n, row) => n + (row[p] ? 1 : 0), 0));
  const seenWith = (j: number): number => {
    let n = 0;
    pts.forEach((p, k) => { if (count[k] - (blk[j][k] ? 1 : 0) === 0 && !blocks(S[j], eye, p)) n += 1; });
    return n / pts.length;
  };
  const commit = (j: number): void => {
    pts.forEach((p, k) => {
      const now = blocks(S[j], eye, p);
      if (now !== blk[j][k]) { count[k] += now ? 1 : -1; blk[j][k] = now; }
    });
  };
  const order = [...changed].reverse();
  for (const j of order) {
    const s = S[j], b = B[j];
    const low = { h: s.h, lx: s.lx, lz: s.lz, r: s.r };
    const set = (t: number): void => {
      s.h = low.h + (b.h - low.h) * t; s.lx = low.lx + (b.lx - low.lx) * t;
      s.lz = low.lz + (b.lz - low.lz) * t; s.r = low.r + (b.r - low.r) * t;
    };
    set(1);
    if (seenWith(j) < lo) {
      let a = 0, c = 1;
      for (let n = 0; n < 8; n++) {
        const m = (a + c) / 2;
        set(m);
        if (seenWith(j) >= lo) a = m; else c = m;
      }
      set(a);
    }
    commit(j);
  }
  const opened = order.filter((j) => S[j].h < B[j].h - 1e-6);
  for (const j of order) if (!opened.includes(j)) delete S[j].h0; // (given back whole)
  const grown = visibleShare(pts, eye, S) > hi ? closeWindow(S, B, eye, pts, hi, lo, at, 2.5, new Set(opened)) : [];
  return [...opened, ...grown].map((j) => ids[j]);
}

/**
 * The search's check for the lens it really stands at (another screen frames otherwise):
 * the share still in the band stays as laid; off it, the stand is fitted again from its built
 * stems for this lens. Returns the stems now drawn otherwise than before; a stem changed by
 * either fit keeps its built height as `h0`, so it is drawn as wide as it is tall.
 */
export function refitGlimpse(stems: Stem[], built: readonly Built[], eye: V3, pts: readonly V3[], want: number, at: V3): number[] {
  const share = visibleShare(pts, eye, stems);
  if (share >= want - FIT_TOL - 1e-9 && share <= want + FIT_TOL + 1e-9) return [];
  const before = stems.map((s) => s.h);
  stems.forEach((s, i) => {
    const b = built[i];
    if (!b) return;
    s.h = b.h; s.lx = b.lx; s.lz = b.lz; s.r = b.r;
    delete s.h0;
  });
  fitGlimpse(stems, built, eye, pts, want, at);
  const changed: number[] = [];
  stems.forEach((s, i) => {
    const b = built[i];
    if (!b) return;
    if (Math.abs(s.h - before[i]) > 1e-6) changed.push(i);
    if (s.h0 === undefined && (Math.abs(s.h - b.h) > 1e-6 || Math.abs(before[i] - b.h) > 1e-6)) s.h0 = b.h;
  });
  return changed;
}
