/**
 * route-math.ts — where the ranger stops when he walks after the animal on the route
 * (adventure/beats/route.ts), pure. Run 7 (`adaptive`): a route now plays rounds, so he
 * walks into the field more often, and the old stop (1.25 m short of the spot, on his side)
 * could put him between the lens and another spot: a spot he must SEE in the next show, or
 * click next, hidden behind him (golden: "6" behind the ranger). He now stops beside the
 * spot where his body covers no spot from the lens, the shortest walk first; when no such
 * place exists he stays where he stands (which was chosen the same way, or is the stand).
 * No THREE, no DOM.
 */

export interface P3 { x: number; y: number; z: number }
export interface GroundSpot { x: number; y: number; z: number }

/** His body for the covering test: feet to the top of his hat (m), and its radius (m). */
export const RANGER_H = 1.35;
export const RANGER_R = 0.45;
/** How far from the spot he stops (as before), and how far from any spot's middle. */
export const STOP_REACH = 1.25;
export const STOP_CLEAR = 0.9;

/** The shortest distance between the segments a0–a1 and b0–b1 (3D). */
export function segSegDist(a0: P3, a1: P3, b0: P3, b1: P3): number {
  const d1 = { x: a1.x - a0.x, y: a1.y - a0.y, z: a1.z - a0.z };
  const d2 = { x: b1.x - b0.x, y: b1.y - b0.y, z: b1.z - b0.z };
  const r = { x: a0.x - b0.x, y: a0.y - b0.y, z: a0.z - b0.z };
  const dot = (u: P3, v: P3): number => u.x * v.x + u.y * v.y + u.z * v.z;
  const a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
  let s: number, t: number;
  if (a <= 1e-12 && e <= 1e-12) { s = 0; t = 0; }
  else if (a <= 1e-12) { s = 0; t = clamp01(f / e); }
  else {
    const c = dot(d1, r);
    if (e <= 1e-12) { t = 0; s = clamp01(-c / a); }
    else {
      const b = dot(d1, d2), den = a * e - b * b;
      s = den > 1e-12 ? clamp01((b * f - c * e) / den) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp01(-c / a); }
      else if (t > 1) { t = 1; s = clamp01((b - c) / a); }
    }
  }
  const p = { x: a0.x + d1.x * s, y: a0.y + d1.y * s, z: a0.z + d1.z * s };
  const q = { x: b0.x + d2.x * t, y: b0.y + d2.y * t, z: b0.z + d2.z * t };
  return Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
}

/** Does a ranger standing at (x, z) hide any of `spots` from the lens at `eye`? */
export function coversASpot(at: { x: number; z: number }, groundY: number, spots: readonly GroundSpot[], eye: P3): boolean {
  const feet = { x: at.x, y: groundY, z: at.z };
  const head = { x: at.x, y: groundY + RANGER_H, z: at.z };
  return spots.some((q) => segSegDist(eye, { x: q.x, y: q.y + 0.05, z: q.z }, feet, head) < RANGER_R);
}

/**
 * Where he stops walking after the animal to `spot` (from `from`): `STOP_REACH` from it, at
 * least `STOP_CLEAR` from every spot's middle (never on a patch), and hiding none of the
 * spots from the lens. Of the places round the spot the one nearest to him wins (his old
 * stop, straight on his side, when that is clear). Null: no such place (he stays put).
 */
export function routeStop(o: { spot: { x: number; z: number }; from: { x: number; z: number }; spots: readonly GroundSpot[]; eye: P3; groundY: (x: number, z: number) => number }): { x: number; z: number } | null {
  const toward = Math.atan2(o.from.z - o.spot.z, o.from.x - o.spot.x);
  const places = Array.from({ length: 16 }, (_, i) => {
    const a = toward + (i * Math.PI) / 8;
    return { x: o.spot.x + Math.cos(a) * STOP_REACH, z: o.spot.z + Math.sin(a) * STOP_REACH };
  }).sort((p, q) => Math.hypot(p.x - o.from.x, p.z - o.from.z) - Math.hypot(q.x - o.from.x, q.z - o.from.z));
  for (const p of places) {
    if (o.spots.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < STOP_CLEAR)) continue;
    if (coversASpot(p, o.groundY(p.x, p.z), o.spots, o.eye)) continue;
    return p;
  }
  return null;
}
