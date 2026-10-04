/**
 * squirrel.test.ts — the pure maths of the lively squirrel (squirrel-math.ts): it runs up
 * the bark (never floating off it, never sunk in), head up going up and head down coming
 * down; it dashes in short readable bursts with stops between, never faster than a child
 * can follow, and never straight at the camera or over the ranger's feet; it leaps on a
 * low arc; and a whole plan never jumps (every piece starts where the last one ended).
 * Run: `npm test`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SQ, ANTIC_KINDS, anticPlan, barkRadius, climbPlan, dashDirectPlan, dashPath, dashPlan, dismountPlan, flick, leapPlan, lineClear, mountPlan, runPlan,
  patPlan, planTime, poseAt, settlePlan, sqStream, tailAt, topSpeeds, trunkOutline, trunkPose, trunkUpright, type Segment, type SqPose, type Trunk,
} from './squirrel-math.ts';

const pine: Trunk = { x: 3, z: -2, H: 13, species: 'prop-pine-scots' };
const oak: Trunk = { x: -4, z: 5, H: 11, species: 'prop-oak-tree' };
const sitting = (x: number, z: number, yaw = 0): SqPose => ({ x, z, alt: 0, yaw, pitch: 0, roll: 0, act: 'sit' });

/** Walk a plan in small time steps: the largest jump (m) between two samples. */
function worstJump(plan: readonly Segment[], dt = 1 / 120): number {
  let prev = poseAt(plan, 0), worst = 0;
  for (let t = dt; t <= planTime(plan) + 1e-9; t += dt) {
    const p = poseAt(plan, t);
    worst = Math.max(worst, Math.hypot(p.x - prev.x, p.z - prev.z, p.alt - prev.alt));
    prev = p;
  }
  return worst;
}

test('the bark: a positive radius from the measured profile, thinning up a pine', () => {
  for (const t of [pine, oak]) for (let h = 0; h < 4; h += 0.25) assert.ok(barkRadius(t, h) > 0.1, `${t.species} at ${h} m`);
  assert.ok(barkRadius(pine, 0) > barkRadius(pine, 1.5), 'the root flare is wider than the trunk');
  assert.ok(barkRadius(oak, 1) > barkRadius(pine, 1), 'an old oak is thicker than a pine');
});

test('a trunk run stays on the bark: belly to it, head up going up and head down coming down', () => {
  const up = climbPlan(pine, { ang: 0.3, h: 0.25 }, { ang: 2.1, h: 1.8 });
  const down = climbPlan(pine, { ang: 2.1, h: 1.8 }, { ang: -0.4, h: 0.25 });
  for (const [plan, headUp] of [[up, true], [down, false]] as const) {
    let lastH = headUp ? -1 : 9;
    for (let u = 0; u <= 1.0001; u += 0.05) {
      const p = poseAt(plan, u * planTime(plan));
      const d = Math.hypot(p.x - pine.x, p.z - pine.z);
      assert.ok(Math.abs(d - (barkRadius(pine, p.alt) + SQ.clear)) < 1e-9, `on the bark at ${p.alt.toFixed(2)} m`);
      // facing the trunk (its belly to the bark)
      const toAxis = Math.atan2(pine.x - p.x, pine.z - p.z);
      assert.ok(Math.abs(Math.atan2(Math.sin(p.yaw - toAxis), Math.cos(p.yaw - toAxis))) < 1e-9, 'facing the trunk');
      assert.equal(p.roll, headUp ? 0 : Math.PI, headUp ? 'head up' : 'head down');
      assert.ok(headUp ? p.alt >= lastH - 1e-9 : p.alt <= lastH + 1e-9, 'steadily up (or down)');
      lastH = p.alt;
    }
    assert.ok(topSpeeds(plan).climb <= SQ.climb + 1e-9, 'a readable climb');
  }
  const cling = trunkPose(pine, { ang: 1, h: 1.2 }, true);
  assert.equal(cling.act, 'cling');
});

test('dash-stop-dash: short bursts it stops between, never faster than a child can follow', () => {
  const rnd = sqStream(3);
  const plan = dashPlan(sitting(0, 0), 5.5, 1.5, rnd);
  const end = poseAt(plan, planTime(plan));
  assert.ok(Math.hypot(end.x - 5.5, end.z - 1.5) < 1e-6, 'it gets there');
  const runs = plan.filter((g) => g.act === 'run');
  assert.ok(runs.length >= 3, `a 5.7 m dash is several bursts (${runs.length})`);
  for (const g of runs) {
    assert.ok(g.len <= SQ.burst[1] + 0.31, `a short burst (${g.len.toFixed(2)} m)`);
    assert.ok(g.dur >= SQ.minBurst, 'never a flicker');
  }
  assert.ok(plan.some((g) => g.act === 'sit' && g.dur >= SQ.stop[0]), 'it stops to look between bursts');
  const v = topSpeeds(plan);
  assert.ok(v.run <= SQ.run + 1e-9, `≤ ${SQ.run} m/s (${v.run.toFixed(2)})`);
  // the body tips forward as it runs, and sits up again at a stop
  const mid = runs[1].at(0.5);
  assert.ok(mid.pitch > 0.6, 'running: the body tipped forward');
  assert.ok(Math.abs(poseAt(plan, planTime(plan)).pitch) < 0.2, 'stopped: sitting up');
});

test('it never runs at the camera: a dash that would come nearer the lens goes round', () => {
  const lens = { x: 0, z: -6 };
  // from one side of the lens's view to the other, the straight line passing close in front of it
  const from = { x: -3, z: 0 }, to = { x: 3, z: 0 };
  const pts = dashPath(from, to.x, to.z, { x: 0, z: -2.2 });
  assert.ok(pts.length >= 3, 'it goes round');
  const plan = dashPlan(sitting(from.x, from.z), to.x, to.z, sqStream(5), { x: 0, z: -2.2 });
  const floor = Math.min(Math.hypot(from.x, from.z + 2.2), Math.hypot(to.x, to.z + 2.2));
  for (let t = 0; t <= planTime(plan); t += 0.02) {
    const p = poseAt(plan, t);
    assert.ok(Math.hypot(p.x, p.z + 2.2) >= floor - 0.2, 'never nearer the lens than where it starts or ends');
  }
  // a dash straight away from the lens needs no corner
  assert.equal(dashPath({ x: 0, z: 0 }, 0, 5, lens).length, 2);
});

test('it never runs over the ranger\'s feet: a dash past him goes round him', () => {
  const me = { x: 1, z: 0.1, r: 1.6 };
  const pts = dashPath({ x: -4, z: 0 }, 5, 0, undefined, me);
  assert.equal(pts.length, 3);
  const plan = dashPlan(sitting(-4, 0), 5, 0, sqStream(8), undefined, me);
  for (let t = 0; t <= planTime(plan); t += 0.02) {
    const p = poseAt(plan, t);
    assert.ok(Math.hypot(p.x - me.x, p.z - me.z) >= me.r - 0.35, `keeps its distance (${Math.hypot(p.x - me.x, p.z - me.z).toFixed(2)} m)`);
  }
  // running to where he stands (the script asks it to come close) is not bent
  assert.equal(dashPath({ x: -4, z: 0 }, 1.5, 0.1, undefined, me).length, 2);
});

test('a run home (ek-day): along its dash\'s corners in one go — no stops to look, never faster than its full run, still round the lens', () => {
  const lens = { x: 0, z: -2.2 };
  const from = { x: -3, z: 0 }, to = { x: 3, z: 0 };
  const plan = runPlan(sitting(from.x, from.z), to.x, to.z, lens);
  const end = poseAt(plan, planTime(plan));
  assert.ok(Math.hypot(end.x - to.x, end.z - to.z) < 1e-6, 'it gets there');
  // (a turn to the next leg may take its moment; a stop where it only sits is ≤ 0.1 s)
  for (const g of plan) if (g.act === 'sit' && Math.abs(g.at(0).yaw - g.at(1).yaw) < 1e-6) assert.ok(g.dur <= 0.1, `no stop to look (${g.dur.toFixed(2)} s)`);
  assert.ok(topSpeeds(plan).run <= SQ.run + 1e-9, 'never faster than its full run');
  const floor = Math.min(Math.hypot(from.x, from.z + 2.2), Math.hypot(to.x, to.z + 2.2));
  for (let t = 0; t <= planTime(plan); t += 0.02) assert.ok(Math.hypot(poseAt(plan, t).x, poseAt(plan, t).z + 2.2) >= floor - 0.2, 'never nearer the lens');
  // (far quicker than its dash with stops)
  assert.ok(planTime(plan) < planTime(dashPlan(sitting(from.x, from.z), to.x, to.z, sqStream(5), lens)) * 0.75);
  assert.ok(worstJump(plan) < 0.06, 'every frame follows on from the last');
});

test('a leap is a low arc from branch to bark: above both ends, never a flicker', () => {
  const a: SqPose = { x: 0, z: 0, alt: 1.8, yaw: 0, pitch: 0, roll: 0, act: 'sit' };
  const b = trunkPose(pine, { ang: Math.PI, h: 1.3 }, true, 'climb');
  const plan = leapPlan(a, b);
  const d = Math.hypot(b.x - a.x, b.z - a.z);
  const g = plan[0];
  assert.ok(g.dur >= 0.4, 'long enough to follow with the eye');
  assert.ok(d / g.dur <= SQ.leap + 1e-9, `≤ ${SQ.leap} m/s across the ground`);
  const start = g.at(0), end = g.at(1), top = g.at(0.5);
  assert.ok(Math.hypot(start.x - a.x, start.z - a.z, start.alt - a.alt) < 1e-9);
  assert.ok(Math.hypot(end.x - b.x, end.z - b.z, end.alt - b.alt) < 1e-9);
  assert.ok(top.alt > Math.max(a.alt, b.alt), 'it arcs up');
  assert.ok(top.alt < Math.max(a.alt, b.alt) + 1, 'a LOW arc');
});

test('a whole run up a tree, along a branch and down again never jumps', () => {
  const start = sitting(pine.x + 2, pine.z + 0.5, -1.2);
  const plan: Segment[] = [];
  const add = (p: Segment[]): SqPose => { plan.push(...p); return poseAt(plan, planTime(plan)); };
  let p = add(dashPlan(start, pine.x + barkRadius(pine, 0) + 0.3, pine.z, sqStream(2)));
  p = add(mountPlan(p, pine, { ang: Math.PI / 2, h: 0.22 }));
  p = add(climbPlan(pine, { ang: Math.PI / 2, h: 0.22 }, { ang: 2.4, h: 1.7 }));
  p = add(climbPlan(pine, { ang: 2.4, h: 1.7 }, { ang: 0.2, h: 0.25 }));
  add(dismountPlan(pine, { ang: 0.2, h: 0.25 }));
  assert.ok(worstJump(plan) < 0.06, `every frame follows on from the last (${worstJump(plan).toFixed(3)} m at worst)`);
  void p;
});

test('the show\'s dash is one quick burst straight there', () => {
  const plan = dashDirectPlan(sitting(0, 0, 0), 1.2, 0.4);
  const runs = plan.filter((g) => g.act === 'run');
  assert.equal(runs.length, 1);
  assert.ok(runs[0].len / runs[0].dur <= SQ.run + 1e-9);
  const end = poseAt(plan, planTime(plan));
  assert.ok(Math.hypot(end.x - 1.2, end.z - 0.4) < 1e-9 && end.act === 'sit');
});

test('a tail flick: a quick lift and a softer fall, then still', () => {
  assert.equal(flick(-0.1), 0);
  assert.equal(flick(0.5), 0);
  let top = 0, at = 0;
  for (let s = 0; s < 0.42; s += 0.01) { const f = flick(s); if (f > top) { top = f; at = s; } assert.ok(f >= 0 && f <= 1); }
  assert.ok(top > 0.95 && at < 0.2, 'up fast, down slower');
});

test('sight: a trunk hides a squirrel behind it, even one whose body sticks out past the bark', () => {
  const t: Trunk = { x: 0, z: 0, H: 14, species: 'prop-pine-scots' };
  const up = [trunkUpright(t, 0)];
  const r = barkRadius(t, 1.2);
  const eye = { x: 7, y: 2.4, z: 0 };
  const round = (deg: number, out = r + 0.2) => ({ x: Math.cos((deg * Math.PI) / 180) * out, y: 1.2, z: Math.sin((deg * Math.PI) / 180) * out });
  assert.equal(lineClear(eye, round(0), up, 0.12), true, 'on the near side: seen');
  assert.equal(lineClear(eye, round(60), up, 0.12), true, 'round the side: seen');
  assert.equal(lineClear(eye, round(180), up, 0.12), false, 'straight behind: hidden');
  // (2026-09-30, played: 133° round, its middle 0.59 m out, the line to it grazed the bark
  // 0.41 m from the axis — past the median bark — yet nothing of it showed on the screen:
  // the ridged outline reaches further out, and hides it)
  assert.equal(lineClear(eye, round(133, 0.59), up), false, 'just past the bark\'s edge, behind its ridges: hidden');
  // (…while on the near side, clinging among the ridges, it is in view)
  assert.equal(lineClear(eye, round(20, r + 0.08), up), true, 'on the near side, among the ridges: seen');
  assert.equal(lineClear(eye, round(160, r + 0.08), up), false, 'on the far side, among the ridges: hidden');
  // (2026-10-01, played: sitting at the trunk's edge a metre up, its middle 0.5 m out, it
  // was in plain view — the outline there is the bark's at that height, not the root
  // flare's: the line passing 0.5 m from the axis is clear)
  const side = round(100, 0.5); // (a little past the side: the line passes 0.49 m from the axis)
  side.y = 1.05;
  assert.ok(trunkOutline(t, 1.05) < 0.45 && trunkOutline(t, 0.1) > 0.7, 'the outline follows the trunk up: a root flare, then the bark');
  assert.equal(lineClear(eye, side, up), true, 'at the trunk\'s edge, past its outline: seen');
  // over the top of a short upright (the boy's head) it is seen
  const body = [{ x: 3, z: 0, y0: 0, y1: 1.45, r: () => 0.22 }];
  assert.equal(lineClear(eye, { x: 0, y: 1.3, z: 0 }, body, 0.12), true, 'over his head');
  assert.equal(lineClear(eye, { x: 0, y: 0.15, z: 0 }, body, 0.12), false, 'on the ground behind him: his body hides it');
});

/* ------------------------------------------------- run 7 (ek-day): its day ---- */

test('its antics: each one where it sits, 1.5-3 s, calm, its tail at rest after, back up facing him', () => {
  const wrapA = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
  // on a stub (1.1 m up), facing him; and on the ground (the den's foot, its stump's top)
  for (const seat of [{ ...sitting(2, -1, 0.4), alt: 1.1 }, sitting(-3, 4, 2.5), { ...sitting(0, 0, -1.2), alt: 0.6 }]) {
    for (const face of [seat.yaw, seat.yaw + 0.6, seat.yaw - 1.1]) {
      for (const kind of ANTIC_KINDS) {
        const plan = anticPlan(kind, seat, face, { along: seat.yaw + 2 });
        const T = planTime(plan);
        assert.ok(T >= 1.5 && T <= 3.0, `${kind}: ${T.toFixed(2)} s`);
        assert.ok(worstJump(plan) < 0.02, `${kind}: no jump (${worstJump(plan).toFixed(3)} m)`);
        let maxTurn = 0, prev = poseAt(plan, 0);
        for (let t = 0; t <= T + 1e-9; t += 1 / 60) {
          const p = poseAt(plan, t);
          // it never leaves its seat (so never a step toward the lens or anyone): lying down
          // along its branch its feet shift a hand's width out along the stub, no more
          assert.ok(Math.hypot(p.x - seat.x, p.z - seat.z) < (kind === 'zonnen' ? 0.13 : 1e-9), `${kind}: on its seat`);
          assert.ok(p.alt >= seat.alt - 0.05 && p.alt <= seat.alt + 0.03, `${kind}: at its seat's height (${(p.alt - seat.alt).toFixed(3)})`);
          assert.equal(p.roll, seat.roll, `${kind}: never rolled over`);
          assert.ok(p.pitch > -0.3 && p.pitch < 1.6, `${kind}: pitch ${p.pitch.toFixed(2)}`);
          const tail = tailAt(plan, t);
          assert.ok(tail >= -1.0 && tail <= 1.0, `${kind}: its tail held at ${tail.toFixed(2)}`);
          maxTurn = Math.max(maxTurn, Math.abs(wrapA(p.yaw - prev.yaw)) * 60);
          prev = p;
        }
        // a calm turn: never a snap round (≤ 9 rad/s, a squirrel's quick look)
        assert.ok(maxTurn <= 9, `${kind}: turns at most ${maxTurn.toFixed(1)} rad/s`);
        const end = poseAt(plan, T);
        assert.ok(Math.abs(wrapA(end.yaw - face)) < 1e-6 && Math.abs(end.pitch) < 1e-6 && Math.abs(end.alt - seat.alt) < 1e-6, `${kind}: sitting up facing him again`);
        assert.ok(Math.hypot(end.x - seat.x, end.z - seat.z) < 1e-6, `${kind}: back on its seat`);
        assert.ok(Math.abs(tailAt(plan, T)) < 1e-6, `${kind}: its tail at rest at the end`);
        assert.ok(topSpeeds(plan).run === 0 && topSpeeds(plan).leap === 0, `${kind}: it goes nowhere`);
      }
    }
  }
  // what tells them apart in a 40 px squirrel: grooming bends it to its tail, sunning lays it
  // flat, nibbling holds a cone (act 'eat'), scolding jolts it, looking turns it round
  const seat = { ...sitting(0, 0, 0), alt: 1.1 };
  const most = (kind: (typeof ANTIC_KINDS)[number], f: (p: SqPose, t: number) => number): number => {
    const plan = anticPlan(kind, seat, 0, { along: 1.5 });
    let m = -Infinity;
    for (let t = 0; t <= planTime(plan); t += 0.02) m = Math.max(m, f(poseAt(plan, t), t));
    return m;
  };
  assert.ok(most('zonnen', (p) => p.pitch) > 1.2, 'in the sun it lies flat');
  assert.ok(most('poetsen', (p) => p.pitch) > 0.45 && most('poetsen', (_p, t) => tailAt(anticPlan('poetsen', seat, 0), t)) > 0.8, 'grooming: bent to its curled tail');
  assert.ok(most('knabbelen', (p) => (p.act === 'eat' ? 1 : 0)) === 1, 'nibbling: a cone in its paws');
  assert.ok(most('kijken', (p) => Math.abs(p.yaw)) > 0.6, 'looking round');
  assert.ok(most('mopperen', (p) => p.alt - seat.alt) > 0.012, 'scolding: it stamps');
});

test('cut short, it sits up calmly; it pats an acorn down where it sits', () => {
  const lying = { ...sitting(1, 1, 0.3), alt: 1.07, pitch: 1.3 };
  const up = settlePlan(lying, -0.5, 0.3, -0.35, 1.1);
  const end = poseAt(up, planTime(up));
  assert.ok(Math.abs(end.pitch) < 1e-9 && Math.abs(end.alt - 1.1) < 1e-9 && Math.abs(end.yaw + 0.5) < 1e-9);
  assert.ok(Math.abs(tailAt(up, 0) + 0.35) < 1e-9 && Math.abs(tailAt(up, planTime(up))) < 1e-9, 'its tail eased back');
  const pat = patPlan(sitting(2, 3, 1), 2);
  assert.ok(planTime(pat) >= 1.0 && planTime(pat) <= 2.0, `the pats take ${planTime(pat).toFixed(2)} s`);
  for (let t = 0; t <= planTime(pat); t += 0.02) {
    const p = poseAt(pat, t);
    assert.ok(Math.hypot(p.x - 2, p.z - 3) < 1e-9 && p.alt === 0, 'on the spot, on the ground');
  }
  assert.ok(worstJump(pat) < 0.02);
  assert.equal(poseAt(pat, planTime(pat)).act, 'sit');
});
