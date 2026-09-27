/**
 * audiofade.test.ts — seeded unit test for the equal-power crossfade curves.
 * Run: `node --experimental-strip-types src/core/audiofade.test.ts`
 *
 * Covers: endpoints (in starts ~0 ends at gain; out starts at gain ends ~0);
 * monotonic in the intended direction; equal-power invariant (out² + in² is
 * constant across the whole window → no loudness dip mid-crossfade); a
 * degenerate step count still yields a usable 2-sample curve.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { fadeInCurve, fadeOutCurve } from './audiofade.ts';

test('fade-in rises from ~0 to the target gain', () => {
  const c = fadeInCurve(0.22, 32);
  assert.equal(c.length, 32);
  assert.ok(c[0] < 1e-6, 'starts at ~0');
  assert.ok(Math.abs(c[c.length - 1] - 0.22) < 1e-6, 'ends at gain');
});

test('fade-out falls from the gain to ~0', () => {
  const c = fadeOutCurve(0.22, 32);
  assert.ok(Math.abs(c[0] - 0.22) < 1e-6, 'starts at gain');
  assert.ok(c[c.length - 1] < 1e-6, 'ends at ~0');
});

test('both curves are monotonic in their intended direction', () => {
  const inC = fadeInCurve(0.3, 40);
  const outC = fadeOutCurve(0.3, 40);
  for (let i = 1; i < inC.length; i++) {
    assert.ok(inC[i] >= inC[i - 1] - 1e-9, 'fade-in never dips');
    assert.ok(outC[i] <= outC[i - 1] + 1e-9, 'fade-out never rises');
  }
});

test('equal-power: out² + in² is constant across the window (no mid dip)', () => {
  const g = 0.25;
  const inC = fadeInCurve(g, 33);
  const outC = fadeOutCurve(g, 33);
  const target = g * g; // cos²+sin² = 1, scaled by g²
  for (let i = 0; i < inC.length; i++) {
    const power = inC[i] * inC[i] + outC[i] * outC[i];
    assert.ok(Math.abs(power - target) < 1e-6, `constant power at ${i}`);
  }
});

test('a degenerate step count still yields a 2-sample curve', () => {
  assert.equal(fadeInCurve(0.2, 1).length, 2);
  assert.equal(fadeOutCurve(0.2, 0).length, 2);
});

/* ---- call snippets (child:B1: a call is one short, calm, levelled snippet) ---- */

import { callWindow, callGain, loudnessFrames, CALL_TARGET_DB } from './audiofade.ts';

const SR = 8000;
/** `secs` of quiet hiss with a tone burst of `amp` from `from` to `to` (s). */
function clip(secs: number, bursts: { from: number; to: number; amp: number }[]): Float32Array {
  const s = new Float32Array(Math.round(secs * SR));
  let seed = 7;
  for (let i = 0; i < s.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    s[i] = ((seed / 0x7fffffff) * 2 - 1) * 0.002; // −54 dB hiss
    const t = i / SR;
    for (const b of bursts) if (t >= b.from && t < b.to) s[i] += Math.sin(i * 0.3) * b.amp;
  }
  return s;
}

test('a long field recording plays one short snippet: the call, not the wind before it', () => {
  // 14 s: a faint rustle at 2 s, the real call (loud) from 9.0 to 10.2 s
  const s = clip(14, [{ from: 2, to: 2.3, amp: 0.05 }, { from: 9, to: 10.2, amp: 0.6 }]);
  const w = callWindow(s, SR, 1.6);
  assert.ok(w.dur <= 1.6 + 1e-9, `snippet ${w.dur} s is short`);
  assert.ok(w.offset > 8.4 && w.offset <= 9.0, `starts just before the call (${w.offset})`);
  assert.ok(w.offset + w.dur >= 10.2 - 0.25, 'the call itself fits in the snippet');
});

test('the snippet never starts in the middle of a sound', () => {
  // one call from 4.0 s; its loudest 1.6 s starts at 4.3 s — the snippet walks back to
  // the call's onset (plus one quiet frame), so it never begins mid-sound
  const s = clip(8, [{ from: 4, to: 7, amp: 0.2 }, { from: 4.3, to: 5.9, amp: 0.4 }]);
  const w = callWindow(s, SR, 1.6);
  assert.ok(w.offset >= 3.9 && w.offset <= 4.0, `starts at the onset (${w.offset})`);
  const f = loudnessFrames(s, SR);
  assert.ok(f[Math.floor(w.offset / 0.05)] < 0.01, 'the first frame is quiet');
});

test('a short clip plays whole', () => {
  const s = clip(0.8, [{ from: 0.05, to: 0.7, amp: 0.5 }]);
  const w = callWindow(s, SR, 1.6);
  assert.equal(w.offset, 0);
  assert.ok(Math.abs(w.dur - 0.8) < 1e-9);
});

test('every snippet is levelled to the same calm loudness, never clipping', () => {
  const loud = callWindow(clip(2, [{ from: 0.2, to: 1, amp: 0.9 }]), SR, 1.6);
  const soft = callWindow(clip(2, [{ from: 0.2, to: 1, amp: 0.05 }]), SR, 1.6);
  const target = 10 ** (CALL_TARGET_DB / 20);
  assert.ok(Math.abs(loud.loud * callGain(loud) - target) < 0.01, 'a loud clip is brought down to −18 dBFS');
  assert.ok(callGain(soft) <= 3, 'a faint clip is boosted at most 3×');
  assert.ok(loud.peak * callGain(loud) <= 0.8 + 1e-9, 'no peak above the ceiling');
  assert.equal(callGain({ loud: 0, peak: 0 }), 0, 'silence stays silent');
});
