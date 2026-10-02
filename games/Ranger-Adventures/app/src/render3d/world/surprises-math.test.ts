/**
 * surprises-math.test.ts — run 7 (veldgids): the open world's small surprises: which comes,
 * when, where it may stand, when he met it, when it goes.
 * Run: `node --experimental-strip-types --test src/render3d/world/surprises-math.test.ts`
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SURPRISES, surpriseOrder, fits, nextAfter, firstAt, APART_S, REST_S, EXTRA_S, FIRST_AFTER, RARE_PITY_W,
  inCone, bearing, groundSpots, treeChoices, awayFrom, acrossFrom, SeenMeter, groundHides,
  shouldGo, robinHop, OFF_PATH_M, CONE, CONE_WIDE, SHY_M, type Choice, type SurpriseId,
} from './surprises-math.ts';
import { newPlay } from '../../core/play.ts';
import { ontdekking } from '../../content/ontdekkingen.ts';

const fork = (seed: number, label = 'x') => newPlay('wereld', seed, 0).fork(label);
const choice = (o: Partial<Choice> = {}): Choice => ({ mood: 'gouden-uur', found: {}, sinceRare: 0, last: null, onFoot: true, reduced: false, ...o });

test('every surprise has its row in the table (a picture, a hint), and the table says which are rare', () => {
  for (const s of SURPRISES) {
    const row = ontdekking(`wereld.${s.id}`);
    assert.ok(row, `wereld.${s.id} in content/ontdekkingen.ts`);
    assert.equal(s.rare, row!.soort === 'zeldzaam', s.id);
    assert.ok(s.dist[0] >= 5 && s.dist[1] <= 30, `${s.id}: staged 5-30 m off`);
    assert.ok(SHY_M[s.id] < s.dist[0], `${s.id}: never staged where it would leave at once`);
    assert.ok(s.stayS <= 60, `${s.id}: stays at most a minute`);
  }
  assert.deepEqual(SURPRISES.filter((s) => s.rare).map((s) => s.id).sort(), ['das', 'edelhert']);
  // never scary: no wolf, no adder among them
  assert.ok(!SURPRISES.some((s) => /wolf|adder/.test(s.id + (s.model ?? ''))));
});

test('the clock: the first a little into the walk, then at least 45 s apart and a rest after one went', () => {
  for (let seed = 1; seed < 40; seed++) {
    const f = firstAt(fork(seed));
    assert.ok(f >= FIRST_AFTER[0] && f <= FIRST_AFTER[1]);
    const n = nextAfter(100, 130, fork(seed));
    assert.ok(n >= 100 + APART_S && n >= 130 + REST_S && n <= Math.max(100 + APART_S, 130 + REST_S) + EXTRA_S);
  }
  assert.equal(nextAfter(0, 10, fork(3)) >= APART_S, true, 'a short one still waits 45 s from its start');
});

test('which one: the ones he has not met first, never the same twice in a row, seeded', () => {
  const a = surpriseOrder(choice(), fork(1));
  const b = surpriseOrder(choice(), fork(1));
  assert.deepEqual(a.map((s) => s.id), b.map((s) => s.id), 'the same seed, the same order');
  const firsts = new Set<SurpriseId>();
  for (let seed = 1; seed <= 30; seed++) firsts.add(surpriseOrder(choice(), fork(seed))[0].id);
  assert.ok(firsts.size >= 4, `different visits begin differently (${[...firsts]})`);
  const met = choice({ found: { 'wereld.buizerd': {}, 'wereld.specht': {} }, last: 'koekoek' });
  for (let seed = 1; seed <= 30; seed++) {
    const ids = surpriseOrder(met, fork(seed)).map((s) => s.id);
    assert.ok(!ids.includes('koekoek'), 'not the last one again');
    assert.ok(ids.indexOf('winterkoning') < ids.indexOf('buizerd') && ids.indexOf('roodborst') < ids.indexOf('specht'), 'new ones before the ones he met');
  }
});

test('a visit shows new things first: the ones out there already come last', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const ids = surpriseOrder(choice({ shown: ['roodborst', 'buizerd'] }), fork(seed)).map((s) => s.id);
    assert.deepEqual(ids.slice(-2).sort(), ['buizerd', 'roodborst']);
  }
});

test('rare ones: only in their own light, by a seeded chance or surely after three without one', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const ids = surpriseOrder(choice({ mood: 'gouden-uur', sinceRare: 9 }), fork(seed)).map((s) => s.id);
    assert.ok(!ids.includes('edelhert') && !ids.includes('das'), 'no rare one in the golden hour');
  }
  for (let seed = 1; seed <= 40; seed++) {
    const first = surpriseOrder(choice({ mood: 'schemer', sinceRare: RARE_PITY_W }), fork(seed))[0];
    assert.ok(first.rare, 'the pity rule: dusk after three, a rare one comes');
  }
  let lucky = 0;
  for (let seed = 1; seed <= 200; seed++) if (surpriseOrder(choice({ mood: 'ochtendnevel' }), fork(seed))[0].rare) lucky += 1;
  assert.ok(lucky > 20 && lucky < 90, `now and then by luck (${lucky}/200)`);
  for (let seed = 1; seed <= 40; seed++) {
    const ids = surpriseOrder(choice({ mood: 'ochtendnevel', sinceRare: 5 }), fork(seed)).map((s) => s.id);
    assert.ok(!ids.includes('das'), 'the badger only at dusk');
    assert.equal(ids[0], 'edelhert', 'the stag in the mist');
  }
});

test('fits: on foot for the robin, still ones only under reduced motion', () => {
  const robin = SURPRISES.find((s) => s.id === 'roodborst')!;
  const buzzard = SURPRISES.find((s) => s.id === 'buizerd')!;
  const specht = SURPRISES.find((s) => s.id === 'specht')!;
  assert.equal(fits(robin, { mood: 'zonnig', onFoot: false, reduced: false }), false, 'never follows a jeep');
  assert.equal(fits(buzzard, { mood: 'zonnig', onFoot: true, reduced: true }), false);
  assert.equal(fits(specht, { mood: 'zonnig', onFoot: true, reduced: true }), true);
});

test('where: inside the picture, off its centre, never on the line he walks along', () => {
  const v = { x: 0, z: 0, yaw: 0 }; // looking along +z
  assert.ok(Math.abs(bearing(v, 10, 10) - Math.PI / 4) < 1e-9);
  assert.equal(inCone(v, 0, 20), false, 'dead ahead: on his line');
  assert.equal(inCone(v, 1, 20), false, 'too near his line');
  assert.equal(inCone(v, 6, 20), true);
  assert.equal(inCone(v, 20, 5), false, 'outside the picture');
  assert.equal(inCone(v, 4, -20), false, 'behind him');
  for (let seed = 1; seed <= 20; seed++) {
    const spots = groundSpots(v, [12, 30], fork(seed));
    assert.ok(spots.length >= 10, 'plenty of candidates');
    for (const p of spots) {
      const d = Math.hypot(p.x, p.z);
      assert.ok(d >= 12 - 1e-9 && d <= 30 + 1e-9);
      assert.ok(Math.abs(bearing(v, p.x, p.z)) <= CONE + 1e-9);
      assert.ok(Math.abs(p.x) >= OFF_PATH_M - 1e-9, 'beside his line');
    }
  }
  const trees = [{ x: 5, z: 15 }, { x: 0, z: 15 }, { x: 40, z: 0 }, { x: -6, z: 20 }, { x: 2, z: 50 }, { x: 14, z: 12 }];
  const picked = treeChoices(v, trees, [12, 24], fork(2));
  assert.deepEqual(picked.map((t) => `${t.x},${t.z}`).sort(), ['-6,20', '5,15']);
  // a bird met by its call may sit wider (to the picture's edge and past it); in the picture first
  const wide = treeChoices(v, trees, [12, 24], fork(2), CONE_WIDE).map((t) => `${t.x},${t.z}`);
  assert.deepEqual(wide.slice(0, 2).sort(), ['-6,20', '5,15']);
  assert.deepEqual(wide.slice(2), ['14,12']);
});

test('it goes away from him, never toward the lens', () => {
  const me = { x: 0, z: 0 };
  for (const side of [-1, 1]) {
    for (const at of [{ x: 10, z: 20 }, { x: -12, z: 25 }, { x: 3, z: 14 }]) {
      const fromMe = { x: at.x / Math.hypot(at.x, at.z), z: at.z / Math.hypot(at.x, at.z) };
      const away = awayFrom(me, at, side);
      assert.ok(away.x * fromMe.x + away.z * fromMe.z >= Math.cos(Math.PI / 4) - 1e-9, 'away');
      const across = acrossFrom(me, at, side);
      assert.ok(across.x * fromMe.x + across.z * fromMe.z > 0.05, 'across and a touch away: never toward him');
    }
  }
});

test('seen: big enough, near enough, a second on end; a glance does not count', () => {
  const m = new SeenMeter();
  for (let i = 0; i < 9; i++) m.step(0.1, true, 50, 20);
  assert.equal(m.seen, false);
  m.step(0.1, false, 50, 20); // it went behind a tree
  for (let i = 0; i < 9; i++) m.step(0.1, true, 50, 20);
  assert.equal(m.seen, false, 'not on end');
  m.step(0.1, true, 50, 20);
  m.step(0.1, true, 50, 20);
  assert.equal(m.seen, true);
  const small = new SeenMeter();
  for (let i = 0; i < 30; i++) small.step(0.1, true, 30, 10);
  assert.equal(small.seen, false, 'too small in the picture');
  const far = new SeenMeter();
  for (let i = 0; i < 30; i++) far.step(0.1, true, 60, 40);
  assert.equal(far.seen, false, 'too far from him');
});

test('the ground can hide it', () => {
  const flat = () => 0;
  const hill = (x: number) => (x > 4 && x < 6 ? 3 : 0);
  assert.equal(groundHides({ x: 0, y: 2, z: 0 }, { x: 10, y: 1, z: 0 }, flat), false);
  assert.equal(groundHides({ x: 0, y: 2, z: 0 }, { x: 10, y: 1, z: 0 }, hill), true);
});

test('it goes: after its time, when he is far off, or when he comes too near', () => {
  const deer = SURPRISES.find((s) => s.id === 'edelhert')!;
  assert.equal(shouldGo(deer, 5, 25), false);
  assert.equal(shouldGo(deer, 31, 25), true);
  assert.equal(shouldGo(deer, 5, 50), true);
  assert.equal(shouldGo(deer, 5, 10), true, 'a stag keeps his distance');
  const buzzard = SURPRISES.find((s) => s.id === 'buizerd')!;
  assert.equal(shouldGo(buzzard, 5, 1), false, 'the buzzard is overhead');
});

test('the robin hops after him, never nearer than three metres', () => {
  assert.equal(robinHop({ x: 0, z: 0 }, { x: 0, z: 5 }), null, 'near enough: it stays');
  const h = robinHop({ x: 0, z: 0 }, { x: 0, z: 8 })!;
  assert.ok(Math.abs(h.z - 0.7) < 1e-9 && h.x === 0);
  let at = { x: 0, z: 0 };
  for (let i = 0; i < 40; i++) at = robinHop(at, { x: 0, z: 10 }) ?? at;
  assert.ok(10 - at.z >= 3.4 - 1e-9, 'stops short of him');
});
