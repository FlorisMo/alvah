/**
 * actors.test.ts — the pure parts of the adventures' animals (actors-math.ts): they
 * turn before they walk (never strafe), settle into their spot, follow at their gap
 * without cutting in front of the ranger, trot calmly, and a frightened one hides
 * away from what frightened it. Run: `npm test`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  wrap, turnToward, stepToward, followSpot, followSpeed, isRunning, trot, strideOf, rootDip, nearestAway, bodyLength,
} from './actors-math.ts';
import { SIZE } from '../AnimalScale.ts';

test('turning is rate-limited and takes the short way', () => {
  assert.ok(Math.abs(turnToward(0, Math.PI / 2, 0.1) - 0.1) < 1e-9);
  assert.ok(Math.abs(turnToward(3.0, -3.0, 1) - wrap(3.0 + (2 * Math.PI - 6.0))) < 1e-9, 'across ±π the short way');
  assert.equal(turnToward(0.2, 0.25, 1), 0.25);
});

test('it walks the way it faces: a goal behind it is turned to first, never strafed to', () => {
  const p = { x: 0, z: 0, yaw: 0 }; // facing +z
  const s = stepToward(p, 0, -5, 1 / 30, { speed: 1, turnRate: 3 }); // the goal right behind
  assert.ok(Math.hypot(s.pose.x, s.pose.z) < 1e-3, 'it turns on the spot first');
  let q = p;
  for (let i = 0; i < 90; i++) q = stepToward(q, 0, -5, 1 / 30, { speed: 1, turnRate: 3 }).pose;
  assert.ok(q.z < -0.5, 'then it walks there');
});

test('it settles into its spot (slower close in) and never overshoots', () => {
  let p = { x: 0, z: 0, yaw: 0 };
  const speeds: number[] = [];
  for (let i = 0; i < 300; i++) {
    const s = stepToward(p, 0, 2, 1 / 30, { speed: 1.2, turnRate: 4, ease: 0.6 });
    p = s.pose;
    speeds.push(s.speed);
    assert.ok(p.z <= 2 + 1e-9, 'never past its spot');
  }
  assert.ok(Math.abs(p.z - 2) < 1e-3);
  assert.ok(Math.max(...speeds) <= 1.2 + 1e-9);
  const near = speeds.filter((_, i) => i > 0 && speeds[i] > 0).slice(-3);
  assert.ok(near.every((v) => v < 1.2), 'slower as it arrives');
});

test('a follower keeps its gap on its own side of the leader, and stands inside it', () => {
  const s = followSpot({ x: 0, z: -5 }, { x: 0, z: 0 }, 2);
  assert.ok(Math.abs(s.x) < 1e-9 && Math.abs(s.z + 2) < 1e-9, 'the spot is between them, 2 m from the leader');
  assert.equal(followSpeed(2.2, 2, 1.8, 2.6), 0, 'within the gap (+ slack) it stands');
  assert.ok(followSpeed(4, 2, 1.8, 2.6) > 1.8, 'behind, it catches up');
  assert.ok(followSpeed(40, 2, 1.8, 2.6) <= 2.6, 'never faster than its trot');
});

test('running: the run gait, or clearly faster than any walk', () => {
  assert.equal(isRunning({ speed: 2.2 }), false, 'a brisk walk is not a run');
  assert.equal(isRunning({ speed: 1.8, running: true }), true);
  assert.equal(isRunning({ speed: 4.2 }), true);
});

test('the trot is calm: small bob and roll, nothing standing still', () => {
  for (const h of [0.3, 0.62, 0.85]) {
    for (let ph = 0; ph < 7; ph += 0.3) {
      const g = trot(ph, 2, h);
      assert.ok(g.dy >= 0 && g.dy <= 0.06, 'a small bob, never into the ground');
      assert.ok(Math.abs(g.roll) <= 0.12 && Math.abs(g.pitch) <= 0.04);
    }
    assert.deepEqual(trot(1, 0, h), { dy: 0, roll: 0, pitch: 0 });
    assert.ok(strideOf(h) >= 0.3);
  }
  for (let t = 0; t < 20; t += 0.37) { const d = rootDip(t, 1); assert.ok(d >= 0 && d <= 1); }
});

test('a frightened animal hides in the nearest cover that is not beside what frightened it', () => {
  const spots = [{ x: 1, z: 0 }, { x: 3, z: 0 }, { x: -2, z: 0 }];
  assert.deepEqual(nearestAway(0, 0, spots), { x: 1, z: 0 });
  assert.deepEqual(nearestAway(0, 0, spots, { x: 1.2, z: 0, d: 1 }), { x: -2, z: 0 }, 'never next to the ranger');
  assert.equal(nearestAway(0, 0, [], undefined), null);
});

test('an animal is as long as the scale table says for its height (a roe about as long as it is tall)', () => {
  assert.ok(Math.abs(bodyLength(SIZE.ree, SIZE.ree.h) - SIZE.ree.len) < 1e-9);
  assert.ok(Math.abs(bodyLength(SIZE.reekalf, SIZE.reekalf.h) - SIZE.reekalf.len) < 1e-9);
  assert.ok(bodyLength(SIZE.ree, 1.1) < 1.2, 'a roe is not a pig\'s 1.7 × its height long');
  // the boars keep the proportion they always had (≈ 1.7 × their height)
  for (const b of [SIZE.wildzwijn, SIZE.overloper, SIZE.frisling]) assert.ok(Math.abs(bodyLength(b, b.h) / b.h - 1.7) < 0.05);
  assert.equal(bodyLength(undefined, 1), 1.7);
  // a smaller one of its kind is shorter in the same proportion
  assert.ok(Math.abs(bodyLength(SIZE.ree, 0.55) - SIZE.ree.len / 2) < 1e-9);
});
