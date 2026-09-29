/**
 * A call placed in the world (Sound.callAt's maths, `placeCall`): panned by its bearing
 * from where the lens looks, softer with distance, silent far away. Run: `npm test`.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { placeCall } from './audiofade.ts';

test('a squeak you can place: left/right by its bearing, louder when near', () => {
  const L = { x: 0, z: 0, yaw: 0 }; // looking along +z; screen-right is −x
  assert.ok(Math.abs(placeCall(0, 5, L).pan) < 1e-9, 'straight ahead: centred');
  assert.ok(placeCall(-5, 0, L).pan > 0.7, 'to the right');
  assert.ok(placeCall(5, 0, L).pan < -0.7, 'to the left');
  assert.ok(Math.abs(placeCall(5, 0, L).pan) <= 0.8, 'never hard in one ear');
  assert.equal(placeCall(0, 2, L).gain, 1);
  const g15 = placeCall(0, 15, L).gain;
  assert.ok(g15 > 0.15 && g15 < 0.35, `soft at 15 m (${g15.toFixed(2)})`);
  assert.equal(placeCall(0, 26, L).gain, 0, 'silent past 25 m');
  let prev = 2;
  for (let d = 1; d < 26; d += 1) { const g = placeCall(0, d, L).gain; assert.ok(g <= prev + 1e-12); prev = g; }
});
