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
  shouldGo, robinHop, robinSpot, pxAt, tryNow, OFF_PATH_M, CONE, CONE_WIDE, ALL_ROUND, SHY_M, SEEN_PX, HEARD_M,
  FRESH_WAIT_S, AGAIN_WAIT_S, RETRY_S, ROBIN_SIDE, ROBIN_ALONG, ROBIN_SHY_M, ROBIN_HOP_M, ROBIN_FLUTTER_M,
  type Choice, type SurpriseId,
} from './surprises-math.ts';
import { newPlay } from '../../core/play.ts';
import { ontdekking } from '../../content/ontdekkingen.ts';
import { sizeRow } from '../AnimalScale.ts';

const fork = (seed: number, label = 'x') => newPlay('wereld', seed, 0).fork(label);
const choice = (o: Partial<Choice> = {}): Choice => ({ mood: 'gouden-uur', found: {}, sinceRare: 0, last: null, onFoot: true, reduced: false, ...o });

test('every surprise has its row in the table (a picture, a hint), and the table says which are rare', () => {
  for (const s of SURPRISES) {
    const row = ontdekking(`wereld.${s.id}`);
    assert.ok(row, `wereld.${s.id} in content/ontdekkingen.ts`);
    assert.equal(s.rare, row!.soort === 'zeldzaam', s.id);
    // (the robin comes beside him; the rest 5-30 m off)
    if (s.plek !== 'mee') assert.ok(s.dist[0] >= 5 && s.dist[1] <= 30, `${s.id}: staged 5-30 m off`);
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

test('a return visit meets something new: one he has not met (and that fits) beats one he knows, and the wait for it is capped', () => {
  // a practised save: the buzzard, the wren and the robin found; overcast (the cuckoo is a
  // morning and golden-hour bird): only the woodpecker is new
  const found = { 'wereld.buizerd': {}, 'wereld.winterkoning': {}, 'wereld.roodborst': {} };
  for (let seed = 1; seed <= 30; seed++) {
    const order = surpriseOrder(choice({ mood: 'bewolkt', found }), fork(seed));
    assert.equal(order[0].id, 'specht', 'the new one first in the order');
    // it has no place where he is yet: the director waits for it, it does not take a known one
    for (const waited of [0, RETRY_S, 30, FRESH_WAIT_S - 1]) {
      assert.deepEqual(tryNow(order, { found, shown: [], waited }).map((s) => s.id), ['specht'], `still waiting at ${waited} s`);
    }
    // capped: past FRESH_WAIT_S a known one may come (a walk never goes empty for long)
    const after = tryNow(order, { found, shown: [], waited: FRESH_WAIT_S }).map((s) => s.id);
    assert.equal(after[0], 'specht', 'the new one is still tried first');
    assert.ok(after.includes('buizerd') && after.includes('winterkoning'), 'then the known ones');
  }
  assert.ok(FRESH_WAIT_S <= 60, 'at most about a minute beyond the normal gap');
  // in the golden hour the cuckoo is new too: both are waited for, in a seeded order
  const golden = surpriseOrder(choice({ mood: 'gouden-uur', found }), fork(4));
  assert.deepEqual(tryNow(golden, { found, shown: [], waited: 10 }).map((s) => s.id).sort(), ['koekoek', 'specht']);
  // a rare one he has not met is new as well (the stag in the mist, by the pity rule)
  const mist = surpriseOrder(choice({ mood: 'ochtendnevel', found, sinceRare: 9 }), fork(5));
  assert.equal(tryNow(mist, { found, shown: [], waited: 0 })[0].id, 'edelhert');
  // everything met: the visit's own variety (ones not out there yet first, for AGAIN_WAIT_S)
  const all = { ...found, 'wereld.specht': {}, 'wereld.koekoek': {} };
  const known = surpriseOrder(choice({ mood: 'bewolkt', found: all, shown: ['buizerd'] }), fork(6));
  assert.ok(!tryNow(known, { found: all, shown: ['buizerd'], waited: 0 }).some((s) => s.id === 'buizerd'));
  assert.ok(tryNow(known, { found: all, shown: ['buizerd'], waited: AGAIN_WAIT_S }).some((s) => s.id === 'buizerd'));
  // the new one he missed (out there already this visit) is no longer waited for
  assert.ok(tryNow(order0(found), { found, shown: ['specht'], waited: 0 }).every((s) => s.id !== 'specht'));
});
const order0 = (found: Record<string, unknown>) => surpriseOrder(choice({ mood: 'bewolkt', found, shown: ['specht'] }), fork(1));

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
  // all round within hearing: the picture first, then its edge, then behind him
  const round = [...trees, { x: -3, z: -16 }, { x: 15, z: -6 }];
  const all = treeChoices(v, round, [12, 24], fork(2), ALL_ROUND).map((t) => `${t.x},${t.z}`);
  assert.deepEqual(all.slice(0, 2).sort(), ['-6,20', '5,15']);
  assert.equal(all[2], '14,12');
  assert.deepEqual(all.slice(3).sort(), ['-3,-16', '15,-6']);
  assert.ok(!all.includes('0,15'), 'never dead ahead on his line');
  // the tree birds sit within hearing, so their call is a meeting wherever they are
  for (const s of SURPRISES.filter((x) => x.plek === 'stam' || x.plek === 'kroon' || x.plek === 'voet')) assert.ok(s.dist[1] <= HEARD_M - 2, s.id);
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

test('the robin hops along beside him, big enough to see, never under his feet', () => {
  const robin = SURPRISES.find((x) => x.id === 'roodborst')!;
  assert.equal(robin.seenOnly, true, 'met by seeing it: its song alone is no meeting');
  assert.ok(SURPRISES.filter((x) => x.seenOnly).length === 1, 'the other birds may be heard');
  // its spot: beside his line, about level with him
  for (const yaw of [0, 1, -2.5, Math.PI]) {
    for (const side of [-1, 1]) {
      for (const lat of ROBIN_SIDE) {
        for (const along of ROBIN_ALONG) {
          const me = { x: 3, z: -7 };
          const p = robinSpot(me, yaw, side, lat, along);
          const v = { x: me.x, z: me.z, yaw };
          const b = bearing(v, p.x, p.z);
          const d = Math.hypot(p.x - me.x, p.z - me.z);
          // (bearing is + toward the picture's left: side +1 is the right)
          assert.ok(Math.abs(d * Math.sin(b) + side * lat) < 1e-9, 'beside his line, on its own side');
          assert.ok(Math.abs(d * Math.cos(b) - along) < 1e-9, 'level with him');
          assert.ok(d > ROBIN_SHY_M + 0.4, 'never under his feet');
        }
      }
    }
  }
  // big enough from the walk lens (4.6 m behind him, 2.4 m up, FOV 55°, 800 px high):
  // the far corner of its spot is still ≥ SEEN_PX
  const row = sizeRow(robin.model)!;
  const size = Math.max(row.h, row.len ?? 0);
  const far = Math.hypot(ROBIN_SIDE[1], 4.6 + ROBIN_ALONG[1], 2.4);
  assert.ok(pxAt(size, far, 55, 800) >= SEEN_PX, `${Math.round(pxAt(size, far, 55, 800))} px at ${far.toFixed(1)} m`);
  assert.ok(row.readable, 'shown bigger than life on purpose, and the table says why');
  // its hops: toward its spot, a flutter when it fell behind, never nearer him than ROBIN_SHY_M
  const me = { x: 0, z: 0 };
  assert.equal(robinHop({ x: 2.3, z: 0.1 }, { x: 2.3, z: 0 }, me), null, 'at its spot: it stays');
  const h = robinHop({ x: 2.3, z: -1 }, { x: 2.3, z: 0 }, me)!;
  assert.ok(Math.abs(h.z - (-1 + ROBIN_HOP_M)) < 1e-9 && !h.flutter, 'a hop');
  const fl = robinHop({ x: 2.3, z: -5 }, { x: 2.3, z: 0 }, me)!;
  assert.ok(fl.flutter && Math.abs(fl.z - (-5 + ROBIN_FLUTTER_M)) < 1e-9, 'a flutter to catch up');
  // to its spot from anywhere, round him (never over his feet), never nearer him than ROBIN_SHY_M
  for (const [from, spot] of [[{ x: -2.3, z: -6 }, { x: -2.3, z: 0 }], [{ x: -2.4, z: 0.3 }, { x: 2.3, z: 0 }], [{ x: 0.2, z: 3 }, { x: 0.1, z: -2.4 }]] as const) {
    let at: { x: number; z: number } = from;
    for (let i = 0; i < 60; i++) {
      const n = robinHop(at, spot, me);
      if (!n) break;
      assert.ok(Math.hypot(n.x, n.z) >= ROBIN_SHY_M, 'never nearer him than ROBIN_SHY_M');
      assert.ok(Math.hypot(n.x - at.x, n.z - at.z) <= ROBIN_FLUTTER_M + 1e-9, 'one hop or flutter at a time');
      at = n;
    }
    assert.ok(Math.hypot(at.x - spot.x, at.z - spot.z) < 0.5, `it got to its spot from ${JSON.stringify(from)}`);
  }
  assert.ok(SHY_M.roodborst < ROBIN_SHY_M && ROBIN_SHY_M < ROBIN_SIDE[0], 'it does not leave from its own spot: it hops aside, and flies off only when he walks right onto it');
});
