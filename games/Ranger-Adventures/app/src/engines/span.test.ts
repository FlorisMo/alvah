/**
 * span.test.ts — the span core's rules (run 7 `adaptive`, design §5.2), the one core under
 * Echokracht (simon) and Geheugenkracht (corsi):
 *   node --experimental-strip-types --test src/engines/span.test.ts
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { SpanRun, type SpanResult } from './span.ts';
import { simonNext } from './simon.ts';
import { corsiNext, PRINT_SPOTS } from './corsi.ts';
import { newPlay } from '../core/play.ts';

/** A supplier that numbers its items: round sequences are [len·10 + 0, len·10 + 1, …] with
 *  an appended item when the round grew (so a test can see which kind of round came). */
function counting(): (len: number, prev: readonly number[] | null) => number[] {
  let fresh = 0;
  return (len, prev) => {
    if (prev && len === prev.length + 1) return [...prev, 900 + len];
    fresh += 1;
    return Array.from({ length: len }, (_, i) => fresh * 100 + i);
  };
}

/** Echo the whole current sequence right. */
function echo(run: SpanRun<number>): SpanResult {
  let r: SpanResult = 'advance';
  for (const id of [...run.sequence]) r = run.tap(id);
  return r;
}

test('a first echo game grows 2 → 3 → 4 when he succeeds, and ends on his echo', () => {
  const run = new SpanRun({ start: 2, max: 7, rounds: 3 }, counting());
  assert.equal(run.begin().length, 2);
  assert.equal(echo(run), 'next');
  assert.equal(run.grew, true);
  assert.equal(run.sequence.length, 3);
  assert.equal(run.sequence[2], 903, 'grew: the same calls plus one');
  assert.equal(echo(run), 'next');
  assert.equal(run.sequence.length, 4);
  assert.equal(echo(run), 'complete');
  assert.equal(run.finished, true);
  assert.deepEqual(run.summary(), { trials: 3, correct: 3, span: 4, start: 2, rounds: 3, eased: 0, firstClean: true });
});

test('a first wrong tap replays the SAME sequence; the rescued round keeps its length', () => {
  const run = new SpanRun({ start: 3, max: 7, rounds: 3 }, counting());
  const first = [...run.begin()];
  assert.equal(run.tap(first[0]), 'advance');
  assert.equal(run.tap(-1), 'replay');
  assert.equal(run.echoIndex, 0, 'the echo starts again from the first');
  assert.deepEqual([...run.sequence], first, 'the same sequence');
  assert.equal(echo(run), 'next');
  assert.equal(run.grew, false);
  assert.equal(run.sequence.length, 3, 'a rescued round: a fresh one as long');
  assert.notEqual(run.sequence[0], first[0], 'a fresh sequence');
});

test('a second wrong tap in a round eases silently: a fresh sequence one shorter, never under 2', () => {
  const run = new SpanRun({ start: 3, max: 7, rounds: 2 }, counting());
  run.begin();
  assert.equal(run.tap(-1), 'replay');
  assert.equal(run.tap(-1), 'ease');
  assert.equal(run.sequence.length, 2);
  assert.equal(run.tap(-1), 'replay', 'the count starts again on the easier one');
  assert.equal(run.tap(-1), 'ease');
  assert.equal(run.sequence.length, 2, 'never under two');
  assert.equal(echo(run), 'next');
  assert.equal(echo(run), 'complete');
  const s = run.summary();
  assert.equal(s.eased, 2);
  assert.equal(s.firstClean, false);
  assert.equal(s.correct, 1);
  assert.equal(s.span, 2);
});

test('a clean round at max completes at once; rounds cap the beat', () => {
  const run = new SpanRun({ start: 4, max: 5, rounds: 4 }, counting());
  run.begin();
  assert.equal(echo(run), 'next');
  assert.equal(run.sequence.length, 5);
  assert.equal(echo(run), 'complete', 'clean at max');
  assert.equal(run.summary().rounds, 2);
  const short = new SpanRun({ start: 2, max: 7, rounds: 1 }, counting());
  short.begin();
  assert.equal(echo(short), 'complete');
});

test('the knobs are sane: start within [2, max], at least one round', () => {
  const run = new SpanRun({ start: 9, max: 6, rounds: 0 }, counting());
  assert.equal(run.start, 6);
  assert.equal(run.rounds, 1);
  assert.equal(new SpanRun({ start: 1, max: 1, rounds: 2 }, counting()).start, 2);
});

test('a finished run answers complete and changes nothing', () => {
  const run = new SpanRun({ start: 2, max: 7, rounds: 1 }, counting());
  run.begin();
  echo(run);
  const s = run.summary();
  assert.equal(run.tap(5), 'complete');
  assert.deepEqual(run.summary(), s);
});

test('simon: a grown round appends one caller; short echoes never repeat a caller; never three in a row', () => {
  const dieren = ['das', 'wildzwijn', 'ree', 'nachtzwaluw'];
  for (let seed = 1; seed <= 200; seed++) {
    const next = simonNext(dieren, newPlay('t', seed, 1).fork('simon').rng);
    const a = next(2, null);
    assert.notEqual(a[0], a[1], `seed ${seed}: two of the same in a 2-call echo`);
    const b = next(3, a);
    assert.deepEqual(b.slice(0, 2), a, 'grown: the same calls plus one');
    assert.notEqual(b[2], b[1]);
    let s = b;
    for (let len = 4; len <= 7; len++) {
      s = next(len, s);
      for (let i = 2; i < s.length; i++) assert.ok(!(s[i] === s[i - 1] && s[i] === s[i - 2]), `seed ${seed}: three in a row ${s}`);
    }
    const fresh = next(3, b);
    assert.notDeepEqual(fresh, b, 'a fresh round of the same length is a new sequence');
  }
});

test('corsi: every route has no spot twice, and a new round is a new route', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const next = corsiNext(PRINT_SPOTS, newPlay('t', seed, 1).fork('corsi').rng);
    const a = next(4, null);
    assert.equal(new Set(a).size, 4);
    assert.ok(a.every((id) => id >= 0 && id < 7));
    const b = next(4, a);
    assert.notDeepEqual(b, a);
    assert.equal(new Set(next(6, b)).size, 6);
  }
});
