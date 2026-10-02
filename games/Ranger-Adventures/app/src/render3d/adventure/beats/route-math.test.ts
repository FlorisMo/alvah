/**
 * route-math.test.ts — where the ranger stops on the route (run 7 `adaptive`): beside the
 * spot, never on a patch, never between the lens and a spot. Checked on the frisling's own
 * rooting field from lenses behind its stand, against an INDEPENDENT sampled test (points
 * along every lens → spot ray kept clear of his body), not the helper's own geometry.
 *   node --experimental-strip-types --test src/render3d/adventure/beats/route-math.test.ts
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { routeStop, segSegDist, STOP_CLEAR, STOP_REACH, RANGER_H, RANGER_R, type P3 } from './route-math.ts';
import { fieldSpots, FRISLING_PLACES } from '../missions/frisling.places.ts';

const flat = (): number => 0;
const SPOTS = fieldSpots().map((s) => ({ ...s, y: 0 }));
const STAND = FRISLING_PLACES.fieldApproach;
const CENTRE = FRISLING_PLACES.field;

/** Lenses behind the stand (as the framing puts it: back from the field, up, looking in). */
function lenses(): P3[] {
  const dx = STAND.x - CENTRE.x, dz = STAND.z - CENTRE.z, d = Math.hypot(dx, dz);
  const out: P3[] = [];
  for (const back of [3, 4.5, 6]) for (const up of [3, 4, 5.5]) for (const side of [-1, 0, 1]) {
    out.push({ x: STAND.x + (dx / d) * back - (dz / d) * side, y: up, z: STAND.z + (dz / d) * back + (dx / d) * side });
  }
  return out;
}

/** Independent: sample the lens → spot ray; any sample inside his body (a cylinder) hides it. */
function hidden(at: { x: number; z: number }, eye: P3): string[] {
  const out: string[] = [];
  for (const q of SPOTS) {
    for (let i = 0; i <= 400; i++) {
      const t = i / 400;
      const p = { x: eye.x + (q.x - eye.x) * t, y: eye.y + (q.y + 0.05 - eye.y) * t, z: eye.z + (q.z - eye.z) * t };
      if (p.y >= 0 && p.y <= RANGER_H && Math.hypot(p.x - at.x, p.z - at.z) < RANGER_R - 0.01) { out.push(String(q.id)); break; }
    }
  }
  return out;
}

test('segSegDist agrees with a brute-force sampling', () => {
  const r = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647) * 10 - 5; })();
  for (let n = 0; n < 200; n++) {
    const a0 = { x: r(), y: r(), z: r() }, a1 = { x: r(), y: r(), z: r() }, b0 = { x: r(), y: r(), z: r() }, b1 = { x: r(), y: r(), z: r() };
    let best = Infinity;
    for (let i = 0; i <= 120; i++) for (let j = 0; j <= 120; j++) {
      const s = i / 120, t = j / 120;
      best = Math.min(best, Math.hypot(a0.x + (a1.x - a0.x) * s - b0.x - (b1.x - b0.x) * t, a0.y + (a1.y - a0.y) * s - b0.y - (b1.y - b0.y) * t, a0.z + (a1.z - a0.z) * s - b0.z - (b1.z - b0.z) * t));
    }
    assert.ok(segSegDist(a0, a1, b0, b1) <= best + 1e-9 && best - segSegDist(a0, a1, b0, b1) < 0.15, `pair ${n}`);
  }
});

test('on the frisling\'s field: he stops beside every spot, on no patch, hiding no spot from the lens', () => {
  for (const eye of lenses()) {
    for (const s of SPOTS) {
      // from the stand, and from beside every other spot he may have walked to before
      for (const from of [STAND, ...SPOTS.filter((q) => q.id !== s.id).map((q) => ({ x: q.x + 0.9, z: q.z + 0.9 }))]) {
        const stop = routeStop({ spot: s, from, spots: SPOTS, eye, groundY: flat });
        if (!stop) continue; // (he stays where he stands)
        assert.ok(Math.abs(Math.hypot(stop.x - s.x, stop.z - s.z) - STOP_REACH) < 1e-9, 'beside the spot');
        for (const q of SPOTS) assert.ok(Math.hypot(q.x - stop.x, q.z - stop.z) >= STOP_CLEAR, `spot ${s.id}: he would stand on patch ${q.id}`);
        assert.deepEqual(hidden(stop, eye), [], `spot ${s.id}: from ${JSON.stringify(eye)} he hides spots`);
      }
    }
  }
});

test('he nearly always finds such a place, and keeps the old stop when it was clear', () => {
  const eye = lenses()[4]; // (4.5 m back, 4 m up, straight behind the stand)
  let found = 0;
  for (const s of SPOTS) if (routeStop({ spot: s, from: STAND, spots: SPOTS, eye, groundY: flat })) found += 1;
  assert.ok(found >= 6, `a stop beside ${found} of 7 spots`);
  // a lone spot straight ahead of a lens: the old stop (on his side) is clear, and it wins
  const lone = [{ x: 0, y: 0, z: 0 }];
  const stop = routeStop({ spot: { x: 0, z: 0 }, from: { x: 0, z: 4 }, spots: lone, eye: { x: 3, y: 4, z: 6 }, groundY: flat })!;
  assert.ok(Math.abs(stop.x) < 1e-9 && Math.abs(stop.z - STOP_REACH) < 1e-9, JSON.stringify(stop));
});
