/**
 * wordclock.test.ts — seeded unit test for the pure karaoke word-clock.
 * Run: `node --test --experimental-strip-types src/core/wordclock.test.ts`
 *
 * Pins the invariants the synced read-aloud highlight relies on: spans are
 * contiguous + monotonic + cover [0,totalMs], punctuation and length lengthen a
 * word's span, rate scales the whole clock inversely, a measured totalMs scales
 * it exactly, empty text is a no-op, the active-word lookup respects span
 * boundaries, and the whole thing is deterministic + pure.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWordClock, activeWordAt } from './wordclock.ts';

const SENT = 'De ranger loopt rustig over de hei.';

test('one span per spoken word; display tokens preserved', () => {
  const c = buildWordClock(SENT);
  assert.equal(c.words.length, 7);
  assert.deepEqual(c.words.map((w) => w.text), ['De', 'ranger', 'loopt', 'rustig', 'over', 'de', 'hei.']);
  c.words.forEach((w, i) => assert.equal(w.index, i));
});

test('spans are contiguous, monotonic, and cover [0, totalMs]', () => {
  const c = buildWordClock(SENT);
  assert.equal(c.words[0].startMs, 0, 'first starts at 0');
  for (let i = 0; i < c.words.length; i++) {
    assert.ok(c.words[i].endMs > c.words[i].startMs, `word ${i} has positive duration`);
    if (i > 0) assert.equal(c.words[i].startMs, c.words[i - 1].endMs, `word ${i} starts where ${i - 1} ends`);
  }
  assert.ok(Math.abs(c.words[c.words.length - 1].endMs - c.totalMs) < 1e-9, 'last ends at totalMs');
});

test('a sentence-ending word gets a longer span than the same word bare', () => {
  const bare = buildWordClock('hei');
  const dot = buildWordClock('hei.');
  const span = (c: ReturnType<typeof buildWordClock>) => c.words[0].endMs - c.words[0].startMs;
  // both single-word clocks fill their own totalMs, so compare the raw model total
  assert.ok(span(dot) > span(bare), 'trailing . adds a sentence pause');
});

test('a longer word gets a longer span (per-char weight)', () => {
  const c = buildWordClock('ik nachtzwaluwroepje');
  const a = c.words[0].endMs - c.words[0].startMs;
  const b = c.words[1].endMs - c.words[1].startMs;
  assert.ok(b > a, 'the long word occupies more of the clock');
});

test('rate scales the clock inversely (slower rate → longer)', () => {
  const fast = buildWordClock(SENT, { rate: 1.5 });
  const slow = buildWordClock(SENT, { rate: 0.5 });
  assert.ok(slow.totalMs > fast.totalMs, 'slower speech runs longer');
  // proportional spans are unchanged: ratio of first-word fraction is identical
  const frac = (c: ReturnType<typeof buildWordClock>) => c.words[0].endMs / c.totalMs;
  assert.ok(Math.abs(frac(fast) - frac(slow)) < 1e-9, 'shape is rate-independent');
});

test('a measured totalMs scales the whole clock exactly', () => {
  const c = buildWordClock(SENT, { totalMs: 4000 });
  assert.equal(c.totalMs, 4000);
  assert.ok(Math.abs(c.words[c.words.length - 1].endMs - 4000) < 1e-9, 'last span ends on the measured total');
  assert.equal(c.words[0].startMs, 0);
});

test('empty / whitespace text is a no-op clock', () => {
  for (const t of ['', '   ', '\n\t']) {
    const c = buildWordClock(t);
    assert.equal(c.words.length, 0);
    assert.equal(c.totalMs, 0);
    assert.equal(activeWordAt(c, 0), -1, 'nothing to highlight');
  }
});

test('activeWordAt respects [start,end) boundaries and the ends', () => {
  const c = buildWordClock(SENT);
  assert.equal(activeWordAt(c, -1), -1, 'before start → none');
  assert.equal(activeWordAt(c, 0), 0, 'at 0 → first word');
  // mid-span of each word resolves to that word
  for (const w of c.words) {
    const mid = (w.startMs + w.endMs) / 2;
    assert.equal(activeWordAt(c, mid), w.index);
  }
  // a boundary belongs to the next word, never both
  assert.equal(activeWordAt(c, c.words[0].endMs), 1, 'boundary → next word');
  assert.equal(activeWordAt(c, c.totalMs), -1, 'at/after totalMs → finished');
  assert.equal(activeWordAt(c, c.totalMs + 500), -1, 'after the end → finished');
});

test('deterministic + pure — repeated builds match, input untouched', () => {
  const a = buildWordClock(SENT, { rate: 0.96 });
  const b = buildWordClock(SENT, { rate: 0.96 });
  assert.deepEqual(a, b);
  assert.equal(SENT, 'De ranger loopt rustig over de hei.');
});
