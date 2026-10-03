/**
 * wildcamera.cubs.test.ts — the fox's two cubs on a rare night of "De wildcamera" (run 7,
 * wc-album): they keep behind their mother on her own way, bound a little, weave a hand's
 * width, and each tumbles over once; under reduced motion they only walk. Run: `npm test`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { cubPose, lineOf, pointAt, progressOf, TUMBLE_M } from './wildcamera.cubs.ts';
import { CUB_LAG, familyPath } from './wildcamera.places.ts';

const line = lineOf(familyPath('left'));
const L = line.cum[line.cum.length - 1];

test('the line: a point along it, and how far along a point on it is', () => {
  for (const s of [0, 1.5, L / 2, L - 0.3]) {
    const p = pointAt(line, s);
    assert.ok(Math.abs(progressOf(line, p) - s) < 1e-6, `${s.toFixed(2)} m along`);
  }
  // before its start: back along its first leg (out of the picture, behind her)
  const before = pointAt(line, -1), start = line.pts[0];
  assert.ok(Math.abs(Math.hypot(before.x - start.x, before.z - start.z) - 1) < 1e-6);
});

test('the cubs keep behind her on her way, the first nearer, never ahead, never far off her line', () => {
  for (let s = 0; s <= L; s += 0.25) {
    for (const k of [0, 1] as const) {
      const p = cubPose(line, s, k, s * 0.5, true, Infinity, false);
      const along = progressOf(line, p);
      // (where her line turns a weave may read a little off the nearest point)
      assert.ok(Math.abs(along - Math.max(0, s - CUB_LAG[k])) < 0.25 || s - CUB_LAG[k] < 0, `cub ${k} at ${along.toFixed(2)} for her ${s.toFixed(2)}`);
      const on = pointAt(line, s - CUB_LAG[k]);
      assert.ok(Math.hypot(p.x - on.x, p.z - on.z) <= 0.15, `cub ${k} weaves ${Math.hypot(p.x - on.x, p.z - on.z).toFixed(2)} m off her line`);
      assert.ok(p.lift >= 0 && p.lift <= 0.06, 'a small hop');
      assert.equal(p.roll, 0);
    }
  }
});

test('each cub tumbles once where its draw says: one whole roll over a short stretch, a step back', () => {
  const at = 6;
  let rolled = 0;
  for (let s = 0; s <= L; s += 0.05) {
    const p = cubPose(line, s, 0, s, true, at, false);
    const into = s - CUB_LAG[0] - at;
    if (into > 0 && into < TUMBLE_M) {
      rolled = Math.max(rolled, p.roll);
      assert.equal(p.lift, 0, 'no hop while it rolls');
      assert.ok(p.behind >= 0 && p.behind <= 0.23, 'it drops back a little');
    } else assert.equal(p.roll, 0);
  }
  assert.ok(rolled > Math.PI * 1.9 && rolled <= Math.PI * 2, `a whole roll (${rolled.toFixed(2)} rad)`);
});

test('under reduced motion they only walk behind her: no hop, no tip, no weave, no tumble', () => {
  for (let s = 0; s <= L; s += 0.3) {
    for (const k of [0, 1] as const) {
      const p = cubPose(line, s, k, s, true, 3, true);
      assert.equal(p.lift, 0);
      assert.equal(p.tip, 0);
      assert.equal(p.roll, 0);
      const on = pointAt(line, s - CUB_LAG[k]);
      assert.ok(Math.hypot(p.x - on.x, p.z - on.z) < 1e-9, 'on her line');
    }
  }
});
