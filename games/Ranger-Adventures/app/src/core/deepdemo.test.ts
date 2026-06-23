/**
 * deepdemo.test.ts — seeded unit test for the pure Deep Demo guided-tour script
 * (BUILD-PLAN §5 / Capstone 132a-i).
 * Run: `node --experimental-strip-types --test src/core/deepdemo.test.ts`
 *
 * Pins the §132 checklist as data: every capability is present, the engine beats
 * cover all 5 EF in EF_ENGINES order, boot opens and arc→companion→badges close,
 * the cursor clamps at both ends, and every narrated line is inside the M3/E3
 * tone norm (so the tour copy can't drift past the reading gate).
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deepDemoScript, engineBeats, beatAt, nextBeat, prevBeat, isLastBeat,
  type DeepDemoKind,
} from './deepdemo.ts';
import { EF_ENGINES } from './skill.ts';
import { lintText } from './readlevel.ts';

test('deterministic + pure — repeated calls match', () => {
  assert.deepEqual(deepDemoScript(), deepDemoScript());
});

test('all §132 checklist kinds are present', () => {
  const kinds = new Set(deepDemoScript().map((b) => b.kind));
  const required: DeepDemoKind[] = [
    'boot', 'avatar', 'freeroam', 'cast', 'engine', 'arc', 'companion', 'badges',
  ];
  for (const k of required) assert.ok(kinds.has(k), `missing beat kind: ${k}`);
});

test('engine beats cover all 5 EF in EF_ENGINES order', () => {
  const engines = engineBeats(deepDemoScript()).map((b) => b.engine);
  assert.deepEqual(engines, [...EF_ENGINES]);
});

test('boot is first; arc → companion → badges close the tour', () => {
  const script = deepDemoScript();
  assert.equal(script[0]?.kind, 'boot');
  const tailKinds = script.slice(-3).map((b) => b.kind);
  assert.deepEqual(tailKinds, ['arc', 'companion', 'badges']);
});

test('beat ids are unique', () => {
  const ids = deepDemoScript().map((b) => b.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('non-engine beats carry no engine; every engine beat does', () => {
  for (const b of deepDemoScript()) {
    if (b.kind === 'engine') assert.ok(b.engine, `engine beat ${b.id} has no engine`);
    else assert.equal(b.engine, undefined, `non-engine beat ${b.id} leaked an engine`);
  }
});

test('cursor clamps at both bounds', () => {
  const script = deepDemoScript();
  const last = script.length - 1;
  // forward never overruns the end
  assert.equal(nextBeat(script, last), last);
  assert.equal(nextBeat(script, last + 5), last);
  // backward never goes negative
  assert.equal(prevBeat(0), 0);
  assert.equal(prevBeat(-5), 0);
  // walking forward then back lands one before the end
  assert.equal(prevBeat(nextBeat(script, last)), last - 1);
  // empty-script guard
  assert.equal(nextBeat([], 0), 0);
});

test('beatAt + isLastBeat agree with the bounds', () => {
  const script = deepDemoScript();
  const last = script.length - 1;
  assert.equal(beatAt(script, 0)?.kind, 'boot');
  assert.equal(beatAt(script, last)?.kind, 'badges');
  assert.equal(beatAt(script, last + 1), null);
  assert.ok(isLastBeat(script, last));
  assert.ok(!isLastBeat(script, 0));
  assert.ok(!isLastBeat([], 0));
});

test('every toelichting passes the M3/E3 readlevel lint', () => {
  for (const b of deepDemoScript()) {
    const issues = lintText(b.toelichting);
    assert.equal(
      issues.length, 0,
      `over-length narration in "${b.id}": ${JSON.stringify(issues)}`,
    );
  }
});
