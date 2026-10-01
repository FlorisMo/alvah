/**
 * growth.test.ts — the grown-ups' growth summary (run 7 `adaptive`, design §5.9):
 *   node --experimental-strip-types --test src/core/growth.test.ts
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { growthSummary } from './growth.ts';
import { blankSkillSet } from './skill.ts';
import type { BeatLog } from './state.ts';

const DAY = 24 * 3600 * 1000;
const NOW = 100 * DAY;
const beat = (e: BeatLog['e'], daysAgo: number, o: Partial<BeatLog> = {}): BeatLog =>
  ({ t: NOW - daysAgo * DAY, e, m: 'x', w: 'world', lv: 1, n: 1, c: 1, sd: 1, ...o });

test('per breinkracht: the level now, the best, the beats this week and ever', () => {
  const skill = blankSkillSet();
  skill.simon = { ...skill.simon, level: 3.336, best: 3.5, beats: 4 };
  const rows = growthSummary([beat('simon', 1), beat('simon', 3), beat('simon', 9), beat('corsi', 2)], skill, NOW);
  assert.deepEqual(rows.map((r) => r.engine), ['zoeken', 'corsi', 'simon', 'dagnacht', 'wisselen']);
  const simon = rows.find((r) => r.engine === 'simon')!;
  assert.deepEqual([simon.level, simon.best, simon.week, simon.beats], [3.34, 3.5, 2, 4]);
  assert.equal(rows.find((r) => r.engine === 'zoeken')!.week, 0);
});

test('what he played at his best: the longest clean echo, the median find over the last ten, the longest hold', () => {
  const h: BeatLog[] = [
    beat('simon', 5, { sp: 4, st: 2 }), beat('simon', 1, { sp: 5, st: 3 }), beat('simon', 0, { sp: 0, st: 3 }),
    ...[30, 12, 8, 6, 5, 4, 4, 3, 3, 2, 2].map((s, i) => beat('zoeken', 11 - i, { s, ms: 0 })),
    beat('dagnacht', 2, { h: 3 }), beat('dagnacht', 1, { h: 4.5 }),
  ];
  const rows = growthSummary(h, blankSkillSet(), NOW);
  assert.equal(rows.find((r) => r.engine === 'simon')!.span, 5);
  assert.equal(rows.find((r) => r.engine === 'zoeken')!.findS, 4, 'the median of the last ten (the 30 s one is older)');
  assert.equal(rows.find((r) => r.engine === 'dagnacht')!.holdS, 4.5);
  assert.equal(rows.find((r) => r.engine === 'corsi')!.span, undefined, 'never played: nothing to say');
});

test('an empty history: every row at level 1, nothing played', () => {
  for (const r of growthSummary([], blankSkillSet(), NOW)) assert.deepEqual([r.level, r.best, r.week, r.beats], [1, 1, 0, 0]);
});
