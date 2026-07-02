import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FpsProbe, nextTier, QUALITY_TIERS,
  STEP_DOWN_FPS, STEP_UP_FPS, PROBE_WINDOW_SEC,
} from './quality.ts';

test('tiers: laag is a genuine step-down on both knobs', () => {
  assert.ok(QUALITY_TIERS.laag.pixelRatioCap < QUALITY_TIERS.hoog.pixelRatioCap);
  assert.ok(QUALITY_TIERS.laag.vegetationScale < QUALITY_TIERS.hoog.vegetationScale);
  assert.ok(QUALITY_TIERS.laag.vegetationScale > 0, 'never zero vegetation');
  assert.equal(QUALITY_TIERS.hoog.vegetationScale, 1);
});

test('nextTier: steps DOWN only below the low mark', () => {
  assert.equal(nextTier('hoog', STEP_DOWN_FPS - 5), 'laag');
  assert.equal(nextTier('hoog', STEP_DOWN_FPS - 0.1), 'laag');
  assert.equal(nextTier('hoog', STEP_DOWN_FPS + 0.1), 'hoog', 'at the mark it holds');
  assert.equal(nextTier('hoog', 60), 'hoog');
});

test('nextTier: steps UP only above the high mark', () => {
  assert.equal(nextTier('laag', STEP_UP_FPS + 5), 'hoog');
  assert.equal(nextTier('laag', STEP_UP_FPS + 0.1), 'hoog');
  assert.equal(nextTier('laag', STEP_UP_FPS - 0.1), 'laag', 'at the mark it holds');
  assert.equal(nextTier('laag', 20), 'laag');
});

test('nextTier: HYSTERESIS dead zone keeps the tier stable', () => {
  // Anything between the two marks must never move the tier, either direction.
  const mid = (STEP_DOWN_FPS + STEP_UP_FPS) / 2;
  assert.ok(STEP_DOWN_FPS < STEP_UP_FPS, 'band exists');
  assert.equal(nextTier('hoog', mid), 'hoog');
  assert.equal(nextTier('laag', mid), 'laag');
  assert.equal(nextTier('hoog', STEP_UP_FPS), 'hoog');
  assert.equal(nextTier('laag', STEP_DOWN_FPS), 'laag');
});

test('nextTier: tiers are floors/ceilings — laag never goes lower, hoog never higher', () => {
  assert.equal(nextTier('laag', 1), 'laag');
  assert.equal(nextTier('hoog', 240), 'hoog');
});

test('FpsProbe: emits nothing until a full window, then the average fps', () => {
  const p = new FpsProbe(PROBE_WINDOW_SEC);
  const dt = 1 / 60;
  let out: number | null = null;
  // ~5 s at 60 fps ≈ 300 frames; the window closes on the frame that crosses 5 s
  // (float accumulation of 1/60 lands a hair under 5.0 at frame 300, so allow a
  // few more).
  for (let i = 0; i < 320; i++) {
    const r = p.sample(dt);
    if (r !== null) { out = r; break; }
  }
  assert.ok(out !== null, 'a window closed');
  assert.ok(Math.abs((out as number) - 60) < 1, 'measured ~60 fps');
});

test('FpsProbe: a slow device measures a low fps (drives the step-down)', () => {
  const p = new FpsProbe(PROBE_WINDOW_SEC);
  const dt = 1 / 25; // ~25 fps
  let out: number | null = null;
  for (let i = 0; i < 200; i++) {
    const r = p.sample(dt);
    if (r !== null) { out = r; break; }
  }
  assert.ok(out !== null);
  assert.ok((out as number) < STEP_DOWN_FPS, 'below the step-down mark');
  assert.equal(nextTier('hoog', out as number), 'laag');
});

test('FpsProbe: ignores stall/tab-switch spikes so one bad frame cannot poison a window', () => {
  const p = new FpsProbe(1);
  assert.equal(p.sample(5), null, 'a 5 s stall frame is dropped, window not advanced');
  assert.equal(p.sample(-1), null, 'a bad negative dt is dropped');
  // now feed a clean second of 60 fps → one window, ~60 fps despite the spikes
  let out: number | null = null;
  for (let i = 0; i < 61; i++) {
    const r = p.sample(1 / 60);
    if (r !== null) { out = r; break; }
  }
  assert.ok(out !== null && Math.abs(out - 60) < 2);
});

test('FpsProbe: resets between windows (a second window measures independently)', () => {
  const p = new FpsProbe(1);
  const drain = (dt: number): number => {
    for (let i = 0; i < 1000; i++) {
      const r = p.sample(dt);
      if (r !== null) return r;
    }
    throw new Error('window never closed');
  };
  const first = drain(1 / 60);
  const second = drain(1 / 30);
  assert.ok(Math.abs(first - 60) < 2);
  assert.ok(Math.abs(second - 30) < 2, 'the fast first window did not bleed into the slow second');
});
