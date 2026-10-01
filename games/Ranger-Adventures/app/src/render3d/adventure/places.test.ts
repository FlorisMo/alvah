/**
 * places.test.ts — the frame geometry every places table is written with (run 7 adds
 * `offCentre`, the "never dead centre of the picture" pin for a hiding place).
 * Run: `node --experimental-strip-types --test src/render3d/adventure/places.test.ts`
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { atLocal, toLocal, offCentre } from './places.ts';

test('toLocal undoes atLocal', () => {
  const f = { x: 12, z: -7, heading: 0.83 };
  for (const [u, v] of [[0, 0], [2, -3], [-4.5, 1.25]]) {
    const back = toLocal(f, atLocal(f, u, v));
    assert.ok(Math.abs(back.u - u) < 1e-9 && Math.abs(back.v - v) < 1e-9);
  }
});

test('offCentre: 0 in the middle, 1 at the edge, measured in the frame\'s own axes', () => {
  const frame = { at: { x: 30, z: 40 }, heading: 1.1, halfW: 4, halfD: 2.5 };
  const f = { x: frame.at.x, z: frame.at.z, heading: frame.heading };
  assert.equal(offCentre(frame, frame.at), 0);
  assert.ok(Math.abs(offCentre(frame, atLocal(f, 4, 0)) - 1) < 1e-9, 'the right edge');
  assert.ok(Math.abs(offCentre(frame, atLocal(f, -1, 0)) - 0.25) < 1e-9, 'a quarter to the left');
  assert.ok(Math.abs(offCentre(frame, atLocal(f, 0, -2.5)) - 1) < 1e-9, 'the near edge');
  assert.ok(Math.abs(offCentre(frame, atLocal(f, 1, 1.25)) - 0.5) < 1e-9, 'the larger of the two shares');
  assert.ok(offCentre(frame, atLocal(f, 6, 0)) > 1, 'outside the picture');
  // a spot 1 m off in world x is not "1 m across" when the frame is turned: the frame's axes count
  const turned = { at: { x: 0, z: 0 }, heading: Math.PI / 2, halfW: 2, halfD: 4 };
  assert.ok(Math.abs(offCentre(turned, { x: 2, z: 0 }) - 0.5) < 1e-9, 'along the heading: depth');
});
