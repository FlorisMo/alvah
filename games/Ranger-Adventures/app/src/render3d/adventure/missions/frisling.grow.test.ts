/**
 * frisling.grow.test.ts — the frisling turns FOUNDATION's knobs into the same exercises,
 * visibly harder at every band and never a different exercise (frisling.grow.ts). Run:
 * `npm test`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { knobsFor } from '../../../core/skill.ts';
import { headingTo, toLocal, dist } from '../places.ts';
import { CRISP_GAP, followLook, pullOf, stepAcross } from './frisling.grow.ts';

const BANDS = [1, 2, 3, 4, 5, 6];

test('the follow: a first play is run 6\'s clear trail; every band is at least as hard as the one below', () => {
  const looks = BANDS.map((b) => followLook(knobsFor('zoeken', b)));
  assert.equal(looks[0].gap, CRISP_GAP, 'band 1: the prints as close as run 6\'s');
  assert.ok(looks[0].opacity >= 0.85, `band 1: dark prints (${looks[0].opacity})`);
  assert.ok(looks[0].squeakEvery[1] <= 5, `band 1: he hears the piglet often (${looks[0].squeakEvery})`);
  for (let i = 1; i < looks.length; i++) {
    assert.ok(looks[i].gap >= looks[i - 1].gap, `band ${i + 1}: prints never closer than band ${i}`);
    assert.ok(looks[i].opacity <= looks[i - 1].opacity, `band ${i + 1}: prints never darker than band ${i}`);
    assert.ok(looks[i].squeakEvery[0] >= looks[i - 1].squeakEvery[0], `band ${i + 1}: never squeaking more often than band ${i}`);
  }
  // a practised child (band 4-5) follows a visibly sparser, fainter trail and hears less
  const p = looks[4];
  assert.ok(p.gap >= looks[0].gap + 0.35, `band 5: prints further apart (${p.gap} m vs ${looks[0].gap} m)`);
  assert.ok(p.opacity <= looks[0].opacity - 0.25, `band 5: fainter prints (${p.opacity} vs ${looks[0].opacity})`);
  assert.ok(p.squeakEvery[0] >= looks[0].squeakEvery[0] + 2, `band 5: fewer squeaks (${p.squeakEvery} vs ${looks[0].squeakEvery})`);
  // and still a trail a child can follow at the top: a print every ≤ 1.6 m, never faint as air
  const top = looks[5];
  assert.ok(top.gap <= 1.6 && top.opacity >= 0.4 && top.squeakEvery[1] <= 9, JSON.stringify(top));
});

test('the temptations of a hold: one sound on a first play, then each one pulls harder, the half step last', () => {
  const pulls = (b: number) => Array.from({ length: knobsFor('dagnacht', b).tempts }, (_, i) => pullOf(i));
  assert.deepEqual(pulls(1), [0], 'band 1: one squeak');
  assert.deepEqual(pulls(4), [0, 1], 'band 4: a squeak, then a look');
  assert.deepEqual(pulls(5), [0, 1, 2], 'band 5: a squeak, a look, a half step');
  for (const b of BANDS) {
    const p = pulls(b);
    for (let i = 1; i < p.length; i++) assert.ok(p[i] > p[i - 1], `band ${b}: each temptation stronger than the last (${p})`);
  }
});

test('a half step closer goes across the lens\'s picture, never at the lens, never past him', () => {
  for (let h = 0; h < Math.PI * 2; h += 0.37) {
    for (const to of [{ x: 2, z: 0.5 }, { x: -1, z: 3 }, { x: 0.05, z: -2 }, { x: 0, z: 0 }]) {
      const from = { x: 0.3, z: -0.2 };
      const s = stepAcross(from, to, h, 0.25);
      const f = { x: from.x, z: from.z, heading: h };
      const d = toLocal(f, s);
      assert.ok(Math.abs(d.v) < 1e-9, `no step along the lens (${d.v})`);
      assert.ok(Math.abs(d.u) <= 0.25 + 1e-9, 'a half step at most');
      const across = toLocal(f, to).u;
      if (Math.abs(across) > 1e-6) {
        assert.ok(Math.sign(d.u) === Math.sign(across) && Math.abs(d.u) <= Math.abs(across) + 1e-9, 'toward him, never past him');
        assert.ok(dist(s, to) <= dist(from, to) + 1e-9, 'nearer him');
      }
    }
  }
  // (the lens looking straight at the two of them: still a step across — to the picture's
  // right, which for a lens looking along +z is −x — never at it)
  const s = stepAcross({ x: 0, z: 0 }, { x: 0, z: 3 }, headingTo({ x: 0, z: -4 }, { x: 0, z: 0 }), 0.2);
  assert.ok(Math.abs(s.z) < 1e-9 && Math.abs(s.x + 0.2) < 1e-9, JSON.stringify(s));
});
