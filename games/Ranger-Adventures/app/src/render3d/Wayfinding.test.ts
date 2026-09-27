/**
 * Wayfinding.test.ts — seeded unit test for the pure direction/distance cue
 * (BUILD-PLAN §4 box 38d, §9e). Run:
 *   node --experimental-strip-types src/render3d/Wayfinding.test.ts
 *
 * Pins: bearing sign is relative-to-facing (right +, left −, ahead 0, behind ±π);
 * the cue buckets + glyphs are correct and always dual-channel (a glyph AND words);
 * "arrived" fires inside the play radius; and the whole thing is deterministic.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ARRIVE_RADIUS, bearing, cue, distanceTo, wayfind, SteadyCue, CUE_HOLD_MS, CUE_HYSTERESIS, type WayCue,
} from './Wayfinding.ts';

const NEAR = 1e-9;

test('distanceTo is the ground (XZ) distance', () => {
  assert.ok(Math.abs(distanceTo(0, 0, 3, 4) - 5) < NEAR);
});

test('bearing is relative to facing: ahead 0, right +, left −, behind ±π', () => {
  // facing +z (facingY = 0): forward = (0,1). Looking along +z with y up, the
  // right hand points to −x (a three.js camera looking down −z has +x on its right).
  assert.ok(Math.abs(bearing(0, 0, 0, 0, 10)) < NEAR, 'target ahead → 0');
  assert.ok(bearing(0, 0, 0, -10, 0) > 0, 'target on the right (−x) → positive');
  assert.ok(bearing(0, 0, 0, 10, 0) < 0, 'target on the left (+x) → negative');
  // facing −z (the spawn view): +x is on the right, as on screen
  assert.ok(bearing(0, 0, Math.PI, 10, 0) > 0, 'facing −z: +x is right');
  assert.ok(bearing(0, 0, Math.PI, -15.6, -15.6) < 0, 'facing −z: the frisling marker is ahead-left');
  assert.ok(Math.abs(Math.abs(bearing(0, 0, 0, 0, -10)) - Math.PI) < NEAR, 'behind → ±π');
});

test('bearing follows the ranger as they turn', () => {
  // target due +x; ranger now faces +x (facingY = π/2) → it should read "ahead"
  assert.ok(Math.abs(bearing(0, 0, Math.PI / 2, 10, 0)) < 1e-6, 'turned to face it → ahead');
});

test('cue buckets the bearing into the right glyph + phrase', () => {
  assert.deepEqual(pick(cue(0, 40)), { glyph: '↑', richting: 'recht vooruit' });
  assert.deepEqual(pick(cue(1.0, 40)), { glyph: '↗', richting: 'naar rechts' });
  assert.deepEqual(pick(cue(2.0, 40)), { glyph: '→', richting: 'naar rechts' });
  assert.deepEqual(pick(cue(-1.0, 40)), { glyph: '↖', richting: 'naar links' });
  assert.deepEqual(pick(cue(-2.0, 40)), { glyph: '←', richting: 'naar links' });
  assert.deepEqual(pick(cue(Math.PI, 40)), { glyph: '↓', richting: 'achter je' });
});

test('every cue is dual-channel — a non-empty glyph AND words', () => {
  for (const a of [0, 0.8, 1.6, 2.6, -0.8, -1.6, Math.PI]) {
    const c = cue(a, 30);
    assert.ok(c.glyph.length > 0, 'has a shape channel');
    assert.ok(c.richting.length > 0 && c.afstand.length > 0, 'has a text channel');
  }
});

test('arrived fires only inside the play radius', () => {
  assert.equal(cue(0, ARRIVE_RADIUS - 0.1).arrived, true);
  assert.equal(cue(0, ARRIVE_RADIUS + 0.1).arrived, false);
  const here = cue(2.0, 1.0); // angle irrelevant once arrived
  assert.equal(here.glyph, '◎');
  assert.equal(here.afstand, 'je bent er');
});

test('distance renders as rounded metres when travelling', () => {
  assert.equal(cue(0, 39.6).afstand, '40 m');
});

test('wayfind composes pose → cue deterministically', () => {
  const a = wayfind(0, 0, 0, 10, 10);
  const b = wayfind(0, 0, 0, 10, 10);
  assert.deepEqual(a, b);
  assert.equal(a.arrived, false);
});

test('steady cue: a bearing wobbling round a bucket edge never flickers the words (child B10)', () => {
  const s = new SteadyCue();
  // walking toward a marker ~34° off to the left: the bearing wobbles ±6° round the 0.6 rad edge
  const seen = new Set<string>();
  for (let t = 0; t < 10_000; t += 100) {
    const a = -0.6 + 0.1 * Math.sin(t / 130);
    seen.add(s.update(a, 30, t).richting);
  }
  assert.equal(seen.size, 1, `the words changed: ${[...seen].join(' / ')}`);
});

test('steady cue: words change once the bearing is well past the edge, then hold', () => {
  const s = new SteadyCue();
  assert.equal(s.update(0, 30, 0).richting, 'recht vooruit');
  // just past the edge: still ahead (hysteresis)
  assert.equal(s.update(0.6 + CUE_HYSTERESIS * 0.5, 30, 2000).richting, 'recht vooruit');
  // clearly right now, and it has been ahead for long: the words change at once
  assert.equal(s.update(1.0, 30, 2100).richting, 'naar rechts');
  // swinging straight back: held for CUE_HOLD_MS, then allowed
  assert.equal(s.update(0, 30, 2100 + CUE_HOLD_MS - 100).richting, 'naar rechts');
  assert.equal(s.update(0, 30, 2100 + CUE_HOLD_MS + 1).richting, 'recht vooruit');
});

test('steady cue: arriving is never held back, and the true angle travels with the cue', () => {
  const s = new SteadyCue();
  s.update(1.0, 30, 0);
  const here = s.update(-1.0, 1.0, 10);
  assert.equal(here.arrived, true);
  assert.equal(here.richting, 'je bent er');
  assert.equal(s.update(0.3, 30, 20).angle, 0.3); // the chip turns its arrow by this
});

function pick(c: WayCue): { glyph: string; richting: string } {
  return { glyph: c.glyph, richting: c.richting };
}
