/**
 * adventure/places.ts — the pure geometry every adventure's places table is written
 * with (THREE-free, unit-tested): local frames laid on the ground, headings, and the
 * uniform scaling of a 2D trial layout onto a real patch of ground.
 *
 * Conventions (the World's): a heading `h` looks along fwd = (sin h, cos h); a frame's
 * `v` runs along its heading (depth, away from whoever looks), `u` across it to the
 * right as seen along the heading: right = (−fz, fx), the same `right` the play Stage
 * uses (for a lens looking down −z, screen-right is +x).
 */

import type { Place, Spot } from './types.ts';

/** A frame on the ground: an origin and the heading its `v` axis runs along. */
export interface Frame { x: number; z: number; heading: number }

/** The heading (rad) from `a` toward `b`. */
export function headingTo(a: Spot, b: Spot): number {
  return Math.atan2(b.x - a.x, b.z - a.z);
}

/** Distance (m) on the ground between two spots. */
export function dist(a: Spot, b: Spot): number {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

/** The unit direction of a heading. */
export function dirOf(heading: number): Spot {
  return { x: Math.sin(heading), z: Math.cos(heading) };
}

/** World x/z of frame-local (u across, v along). */
export function atLocal(f: Frame, u: number, v: number): Spot {
  const fx = Math.sin(f.heading), fz = Math.cos(f.heading);
  return { x: f.x + -fz * u + fx * v, z: f.z + fx * u + fz * v };
}

/** Frame-local (u, v) of a world spot (the inverse of `atLocal`). */
export function toLocal(f: Frame, p: Spot): { u: number; v: number } {
  const fx = Math.sin(f.heading), fz = Math.cos(f.heading);
  const dx = p.x - f.x, dz = p.z - f.z;
  return { u: -fz * dx + fx * dz, v: fx * dx + fz * dz };
}

/** The spot `d` m from `from` toward `to`. */
export function toward(from: Spot, to: Spot, d: number): Spot {
  const l = dist(from, to) || 1;
  return { x: from.x + ((to.x - from.x) / l) * d, z: from.z + ((to.z - from.z) / l) * d };
}

/** A place standing `back` m out from `centre` toward `from`, looking at `centre`:
 *  where the ranger arrives to face a stand, a field or a wallow. */
export function approachOf(centre: Spot, from: Spot, back: number, r = 1.2): Place {
  const p = toward(centre, from, back);
  return { x: p.x, z: p.z, r, heading: headingTo(p, centre) };
}

/**
 * A 2D trial coordinate (0..100 across, 0..100 down the screen, as the 2D floor lays
 * it out) on a patch of ground, UNIFORMLY scaled (`s` metres per percent, the same both
 * ways, so the layout's shape is the one the 2D twin shows): `u` across (right +), `v`
 * in depth away from the viewer (+). The 2D field's top row lands at the back.
 */
export function uniformLocal(x: number, y: number, s: number): { u: number; v: number } {
  return { u: (x - 50) * s, v: (50 - y) * s };
}

/** Distance (m) from a spot to a segment. */
export function segDist(p: Spot, a: Spot, b: Spot): number {
  const dx = b.x - a.x, dz = b.z - a.z;
  const l2 = dx * dx + dz * dz;
  const t = l2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2));
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
}

/** A small deterministic random stream (the same layout every load). */
export function stream(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
