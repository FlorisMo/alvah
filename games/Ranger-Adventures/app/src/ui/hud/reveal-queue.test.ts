/**
 * reveal-queue.test.ts — run 7: a new discovery's reveal waits for a quiet moment, shows
 * one at a time, and never stays over a held beat.
 * Run: `node --experimental-strip-types --test src/ui/hud/reveal-queue.test.ts`
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { RevealQueue, type RevealStep } from './reveal-queue.ts';

type Item = { id: string };

function rig(opts: { showMs?: number; settleMs?: number; gapMs?: number; minMs?: number } = {}) {
  let t = 0;
  let calm = true;
  let talking = false;
  const q = new RevealQueue<Item>({ now: () => t, quiet: () => calm, holding: () => talking, showMs: 4000, settleMs: 500, gapMs: 1000, ...opts });
  const log: string[] = [];
  /** run the clock to `until` ms in 100 ms frames, writing down every show / hide */
  const run = (until: number): void => {
    for (; t <= until; t += 100) {
      const s: RevealStep<Item> = q.tick();
      if (s) log.push(`${t} ${s.kind} ${s.item.id}`);
    }
  };
  return { q, log, run, setCalm: (c: boolean) => { calm = c; }, setTalking: (v: boolean) => { talking = v; }, now: () => t };
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
  const r = rig({ minMs: 0 });
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

test('cut short before it could be read, it comes back first at the next quiet moment (twice at most)', () => {
  const r = rig({ minMs: 1500 });
  r.q.push({ id: 'a' });
  r.q.push({ id: 'b' });
  r.run(1000);           // a shows at 500
  r.setCalm(false);      // a lesson begins 500 ms later
  r.run(1500);
  r.setCalm(true);
  r.run(7000);
  assert.deepEqual(r.log, ['500 show a', '1100 hide a', '2100 show a', '6100 hide a'], 'a comes back before b');
  r.run(8000);
  assert.deepEqual(r.log.slice(4), ['7100 show b']);
  // cut short again and again: it gives up after two returns
  const s = rig({ minMs: 1500 });
  s.q.push({ id: 'x' });
  for (let k = 0; k < 4; k++) { s.setCalm(true); s.run(s.now() + 1000); s.setCalm(false); s.run(s.now() + 300); }
  assert.equal(s.log.filter((l) => l.endsWith('show x')).length, 3, 'shown, then back twice');
});

test('its own voice still speaking keeps it up (to twice its time)', () => {
  const r = rig();
  r.q.push({ id: 'a' });
  r.setTalking(true);
  r.run(6000);
  assert.deepEqual(r.log, ['500 show a'], 'still saying its words at 5.5 s');
  r.setTalking(false);
  r.run(7000);
  assert.deepEqual(r.log, ['500 show a', '6100 hide a']);
  const long = rig();
  long.q.push({ id: 'b' });
  long.setTalking(true);
  long.run(10_000);
  assert.deepEqual(long.log, ['500 show b', '8500 hide b'], 'never longer than twice its time');
});
