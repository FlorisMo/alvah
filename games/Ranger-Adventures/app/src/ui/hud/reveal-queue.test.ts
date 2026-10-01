/**
 * reveal-queue.test.ts — run 7: a new discovery's reveal waits for a quiet moment, shows
 * one at a time, and never stays over a held beat.
 * Run: `node --experimental-strip-types --test src/ui/hud/reveal-queue.test.ts`
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { RevealQueue, type RevealStep } from './reveal-queue.ts';

type Item = { id: string };

function rig(opts: { showMs?: number; settleMs?: number; gapMs?: number } = {}) {
  let t = 0;
  let calm = true;
  const q = new RevealQueue<Item>({ now: () => t, quiet: () => calm, showMs: 4000, settleMs: 500, gapMs: 1000, ...opts });
  const log: string[] = [];
  /** run the clock to `until` ms in 100 ms frames, writing down every show / hide */
  const run = (until: number): void => {
    for (; t <= until; t += 100) {
      const s: RevealStep<Item> = q.tick();
      if (s) log.push(`${t} ${s.kind} ${s.item.id}`);
    }
  };
  return { q, log, run, setCalm: (c: boolean) => { calm = c; }, now: () => t };
}

test('one at a time, in order, each ~4 s, with a rest between', () => {
  const r = rig();
  r.q.push({ id: 'a' });
  r.q.push({ id: 'b' });
  r.q.push({ id: 'a' }); // (already waiting: not twice)
  r.run(12_000);
  assert.deepEqual(r.log, ['500 show a', '4500 hide a', '5500 show b', '9500 hide b']);
  assert.equal(r.q.current, null);
  assert.equal(r.q.waiting, 0);
});

test('it waits for a quiet moment that lasts (not a breath between two lines)', () => {
  const r = rig();
  r.setCalm(false);
  r.q.push({ id: 'a' });
  r.run(2000);
  assert.deepEqual(r.log, [], 'not while a card is up or someone speaks');
  r.setCalm(true);
  r.run(2300);           // quiet for 300 ms
  r.setCalm(false);
  r.run(2600);           // a new line
  r.setCalm(true);
  r.run(4000);
  assert.deepEqual(r.log, ['3200 show a'], 'shown once the quiet lasted 500 ms');
});

test('a held beat or a card that begins while it shows takes it away at once', () => {
  const r = rig();
  r.q.push({ id: 'a' });
  r.q.push({ id: 'b' });
  r.run(1500);
  r.setCalm(false);
  r.run(2000);
  assert.deepEqual(r.log, ['500 show a', '1600 hide a']);
  r.setCalm(true);
  r.run(4000);
  assert.deepEqual(r.log.slice(2), ['2600 show b'], 'the next after a quiet half second and the rest');
});

test('clear forgets what waits', () => {
  const r = rig();
  r.setCalm(false);
  r.q.push({ id: 'a' });
  r.q.clear();
  r.setCalm(true);
  r.run(3000);
  assert.deepEqual(r.log, []);
});
