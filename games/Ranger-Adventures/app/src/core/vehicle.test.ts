import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  driveStep, driveCaps, calmSpeed, JEEP_CAPS, JEEP_CAPS_REDUCED,
  ANIMAL_SLOW_SPEED, ANIMAL_SLOW_RADIUS,
  rampSpeed, comfortSteer, JEEP_RAMP_TIME,
} from './vehicle.ts';

const near = (a: number, b: number, eps = 1e-9): boolean => Math.abs(a - b) < eps;

test('driveCaps: reduced-motion halves speed AND turn-rate (comfort clause)', () => {
  assert.deepEqual(driveCaps(false), JEEP_CAPS);
  assert.deepEqual(driveCaps(true), JEEP_CAPS_REDUCED);
  assert.ok(near(JEEP_CAPS_REDUCED.maxSpeed, JEEP_CAPS.maxSpeed / 2));
  assert.ok(near(JEEP_CAPS_REDUCED.turnRate, JEEP_CAPS.turnRate / 2));
  // the §5 W5.1 numbers
  assert.ok(near(JEEP_CAPS.maxSpeed, 6) && near(JEEP_CAPS.turnRate, 1.2));
  assert.ok(near(JEEP_CAPS_REDUCED.maxSpeed, 3) && near(JEEP_CAPS_REDUCED.turnRate, 0.6));
});

test('driveStep: forward at heading 0 drives +z (into (sin,cos) forward), no turn', () => {
  const s = driveStep(0, { throttle: 1, steer: 0 }, 0.5, JEEP_CAPS);
  assert.ok(near(s.heading, 0), 'heading unchanged with no steer');
  assert.ok(near(s.speed, 6), 'speed = throttle · maxSpeed');
  assert.ok(near(s.dz, 3), 'dz = speed · dt = 6 · 0.5');
  assert.ok(near(s.dx, 0), 'no lateral drift straight ahead');
});

test('driveStep: reverse throttle drives backward', () => {
  const s = driveStep(0, { throttle: -1, steer: 0 }, 1, JEEP_CAPS);
  assert.ok(s.speed < 0 && near(s.speed, -6));
  assert.ok(s.dz < 0, 'reverse moves along −forward');
});

test('driveStep: right-steer (+) decreases yaw, left-steer (−) increases it', () => {
  const right = driveStep(0, { throttle: 0, steer: 1 }, 1, JEEP_CAPS);
  assert.ok(right.heading < 0, 'press right → yaw decreases (nose swings to driver-right)');
  const left = driveStep(0, { throttle: 0, steer: -1 }, 1, JEEP_CAPS);
  assert.ok(left.heading > 0, 'press left → yaw increases');
});

test('driveStep: the yaw change is rate-clamped to turnRate · dt', () => {
  const dt = 1 / 60;
  for (const caps of [JEEP_CAPS, JEEP_CAPS_REDUCED]) {
    // steer saturated past ±1 still only turns at the cap (clampUnit)
    const s = driveStep(0.7, { throttle: 1, steer: 5 }, dt, caps);
    const delta = Math.abs(s.heading - 0.7);
    assert.ok(delta <= caps.turnRate * dt + 1e-9, `|Δyaw| ≤ turnRate·dt for ${caps.turnRate}`);
    assert.ok(near(delta, caps.turnRate * dt), 'full steer turns at exactly the cap');
  }
});

test('driveStep: throttle is clamped so speed never exceeds maxSpeed', () => {
  const s = driveStep(0, { throttle: 9, steer: 0 }, 1, JEEP_CAPS);
  assert.ok(near(s.speed, JEEP_CAPS.maxSpeed), 'saturated throttle caps at maxSpeed');
  assert.ok(Math.abs(s.speed) <= JEEP_CAPS.maxSpeed + 1e-9);
});

test('driveStep: straight-line driving is frame-rate independent', () => {
  // one big step vs many small steps, steer 0 → identical displacement.
  const oneBig = driveStep(1.3, { throttle: 1, steer: 0 }, 1, JEEP_CAPS);
  let x = 0, z = 0, h = 1.3;
  const N = 120;
  for (let i = 0; i < N; i++) {
    const s = driveStep(h, { throttle: 1, steer: 0 }, 1 / N, JEEP_CAPS);
    h = s.heading; x += s.dx; z += s.dz;
  }
  assert.ok(near(x, oneBig.dx, 1e-9) && near(z, oneBig.dz, 1e-9),
    'summed sub-steps equal the single step (30/60/120 fps parity)');
});

test('calmSpeed: caps to the crawl within the slow radius, untouched beyond it (W5.2)', () => {
  // full-speed jeep close to an animal → held to the 2 m/s crawl
  assert.ok(near(calmSpeed(6, ANIMAL_SLOW_RADIUS - 0.1), ANIMAL_SLOW_SPEED), 'inside radius caps to crawl');
  assert.ok(near(calmSpeed(6, ANIMAL_SLOW_RADIUS), ANIMAL_SLOW_SPEED), 'exactly at the radius still slows');
  // far away → the drive is untouched
  assert.ok(near(calmSpeed(6, ANIMAL_SLOW_RADIUS + 0.1), 6), 'beyond the radius is untouched');
  assert.ok(near(calmSpeed(6, Infinity), 6), 'no animal in range → full speed');
});

test('calmSpeed: preserves sign (reverse still reverses) and never speeds up', () => {
  assert.ok(near(calmSpeed(-6, 2), -ANIMAL_SLOW_SPEED), 'reverse near an animal crawls backward');
  // already gentle → passes straight through, even close
  assert.ok(near(calmSpeed(1.5, 0), 1.5), 'a speed under the crawl is not raised to the crawl');
  assert.ok(near(calmSpeed(-1, 0), -1), 'gentle reverse untouched');
});

test('driveStep: is pure — heading arg is never mutated, output wraps to (−π, π]', () => {
  const start = Math.PI - 0.05;
  const s = driveStep(start, { throttle: 0, steer: -1 }, 1, JEEP_CAPS); // left-steer pushes past π
  assert.ok(s.heading <= Math.PI + 1e-12 && s.heading > -Math.PI - 1e-12, 'wrapped into range');
  assert.ok(s.heading < 0, 'crossing +π wraps to the negative side, not a runaway value');
});

// ── F-32 comfort shapers (jeep only; the World applies these BEFORE driveStep so
//    the shared core + the heli + the frozen caps stay untouched) ───────────────

test('rampSpeed: builds from rest over ~1 s instead of snapping to the cap on frame one', () => {
  const dt = 1 / 60;
  const first = rampSpeed(0, 1, dt, JEEP_CAPS);
  const accel = JEEP_CAPS.maxSpeed / JEEP_RAMP_TIME;
  assert.ok(near(first, accel * dt), 'the first step advances by accel·dt, not to maxSpeed');
  assert.ok(first < JEEP_CAPS.maxSpeed, 'nowhere near top speed on frame one (the audit saw instant √18)');
  // integrate a full JEEP_RAMP_TIME at floored throttle → exactly the top speed.
  let sp = 0;
  for (let i = 0; i < Math.round(JEEP_RAMP_TIME / dt); i++) sp = rampSpeed(sp, 1, dt, JEEP_CAPS);
  assert.ok(near(sp, JEEP_CAPS.maxSpeed), 'from rest, ~JEEP_RAMP_TIME s at full throttle reaches the cap');
});

test('rampSpeed: symmetric — lifting off and reversing ease at the same bounded rate', () => {
  const dt = 1 / 60;
  const rate = JEEP_CAPS.maxSpeed / JEEP_RAMP_TIME * dt;
  const brake = rampSpeed(JEEP_CAPS.maxSpeed, 0, dt, JEEP_CAPS);
  assert.ok(brake < JEEP_CAPS.maxSpeed && brake > 0, 'lift-off eases down, not an instant stop');
  assert.ok(near(brake, JEEP_CAPS.maxSpeed - rate), 'brakes at the ramp rate');
  const rev = rampSpeed(0, -1, dt, JEEP_CAPS);
  assert.ok(near(rev, -rate), 'reverse builds negative speed at the same rate');
});

test('rampSpeed: saturates AT the target, never overshoots — and reduced caps reach ~3 m/s', () => {
  assert.ok(near(rampSpeed(0, 1, 10, JEEP_CAPS), JEEP_CAPS.maxSpeed), 'a huge step lands on the cap, never past it');
  assert.ok(near(rampSpeed(0, 9, 10, JEEP_CAPS), JEEP_CAPS.maxSpeed), 'a saturated throttle still tops out at the cap');
  let sp = 0;
  const dt = 1 / 60;
  for (let i = 0; i < Math.round(JEEP_RAMP_TIME / dt); i++) sp = rampSpeed(sp, 1, dt, JEEP_CAPS_REDUCED);
  assert.ok(near(sp, JEEP_CAPS_REDUCED.maxSpeed), 'reduced-motion reaches its lower top in the same ramp time');
});

test('comfortSteer: speed-scaled — a stopped jeep cannot pivot in place (kills the spin-top)', () => {
  assert.ok(near(comfortSteer(1, 0, JEEP_CAPS), 0), 'stopped → full steer yields ZERO turn authority');
  assert.ok(near(comfortSteer(-1, 0, JEEP_CAPS), 0), 'stopped → either direction is zeroed');
  assert.ok(near(comfortSteer(1, JEEP_CAPS.maxSpeed, JEEP_CAPS), 1), 'at top speed the steer passes through in full');
  assert.ok(near(comfortSteer(1, JEEP_CAPS.maxSpeed / 2, JEEP_CAPS), 0.5), 'half speed → half the steer authority');
  assert.ok(near(comfortSteer(5, JEEP_CAPS.maxSpeed, JEEP_CAPS), 1), 'saturated steer past ±1 still clamps to the cap');
});

test('F-32 comfort composition: no-throttle steer never pivots; the reachable turn rate sits in [0.6, 0.9]', () => {
  // (1) The World's pipeline with no throttle: speed 0 → comfortSteer 0 → driveStep
  //     leaves the heading put. A held turn key on a standing jeep does nothing.
  const es0 = comfortSteer(1, 0, JEEP_CAPS);
  const still = driveStep(0.5, { throttle: 0, steer: es0 }, 1, JEEP_CAPS);
  assert.ok(near(still.heading, 0.5), 'no speed ⇒ a held turn key cannot rotate the jeep (no doughnut)');
  // (2) The MAX turn rate a player can reach: the shared unit-magnitude stick caps
  //     |steer|·|throttle| at ½ (steer = throttle = 1/√2), so the yaw rate peaks at
  //     turnRate/2 = 0.6 rad/s — comfortable, and inside the F-32 band [0.6, 0.9].
  const dt = 1 / 60;
  const c = Math.SQRT1_2; // 1/√2
  const speed = c * JEEP_CAPS.maxSpeed; // steady-state speed for that throttle
  const es = comfortSteer(c, speed, JEEP_CAPS);
  const s = driveStep(0, { throttle: c, steer: es }, dt, JEEP_CAPS);
  const rate = Math.abs(s.heading) / dt;
  assert.ok(rate >= 0.6 - 1e-6 && rate <= 0.9, `reachable turn rate ${rate.toFixed(3)} rad/s in the F-32 band [0.6, 0.9]`);
});

// ── wave 2: the jeep feels like a real, calm vehicle ─────────────────────────

import {
  driveIntent, STEER_CREEP, REVERSE_FRACTION, vehicleDt, MAX_VEHICLE_DT,
  JEEP_BODY, resolveBody, bodyOverlap, freeDistance, contactSpeedCap, CONTACT_CREEP, wheelContact,
} from './vehicle.ts';

test('driveIntent: Up = gas, Down = reverse (slower), nothing = nothing', () => {
  assert.deepEqual(driveIntent({ x: 0, y: 0 }), { throttle: 0, steer: 0 });
  const up = driveIntent({ x: 0, y: 1 });
  assert.ok(near(up.throttle, 1) && near(up.steer, 0), 'Up alone is full gas, straight');
  const down = driveIntent({ x: 0, y: -1 });
  assert.ok(near(down.throttle, -REVERSE_FRACTION) && near(down.steer, 0), 'Down alone backs up, calmer than forward');
});

test('driveIntent: pushed only sideways the jeep creeps forward AND turns (audit veh-05)', () => {
  for (const x of [1, -1]) {
    const s = driveIntent({ x, y: 0 });
    assert.ok(near(s.throttle, STEER_CREEP), 'a sideways push still rolls forward');
    assert.ok(near(s.steer, x), 'full steer toward the push');
    // the whole pipeline from rest: it moves AND its heading changes
    const caps = JEEP_CAPS;
    let speed = 0, h = 0, dist = 0;
    for (let i = 0; i < 120; i++) {
      speed = rampSpeed(speed, s.throttle, 1 / 60, caps);
      const st = driveStep(h, { throttle: speed / caps.maxSpeed, steer: comfortSteer(s.steer, speed, caps) }, 1 / 60, caps);
      h = st.heading; dist += Math.hypot(st.dx, st.dz);
    }
    assert.ok(dist > 2, `2 s of a sideways push drives on (${dist.toFixed(2)} m)`);
    assert.ok(x > 0 ? h < -0.1 : h > 0.1, 'and turns toward the push (right lowers the yaw)');
  }
});

test('driveIntent: a diagonal gives gas and steer; down-diagonal reverses while steering', () => {
  const c = Math.SQRT1_2;
  const ur = driveIntent({ x: c, y: c });
  assert.ok(ur.throttle > 0.6 && ur.steer > 0.6, 'up-right: gas + right');
  const dr = driveIntent({ x: c, y: -c });
  assert.ok(dr.throttle < 0 && dr.steer > 0.6, 'down-right: reverse + right');
  assert.ok(Math.abs(dr.throttle) <= REVERSE_FRACTION + 1e-9, 'reverse never faster than its cap');
});

test('comfortSteer: reversing swings the nose the other way (a real car), floor keeps authority', () => {
  assert.ok(comfortSteer(1, -JEEP_CAPS.maxSpeed / 2, JEEP_CAPS) < 0, 'reverse + right → the nose goes left');
  assert.ok(near(comfortSteer(1, 0, JEEP_CAPS, 0.4), 0.4), 'pressed against a trunk it can still turn away');
  assert.ok(near(comfortSteer(1, JEEP_CAPS.maxSpeed, JEEP_CAPS, 0.4), 1), 'the floor never lowers real authority');
});

test('vehicleDt: a stall never teleports a vehicle', () => {
  assert.equal(vehicleDt(8.2), MAX_VEHICLE_DT, 'an 8 s frame integrates as 0.1 s');
  assert.equal(vehicleDt(1 / 60), 1 / 60, 'a normal frame passes through');
  assert.equal(vehicleDt(-1), 0);
  assert.equal(vehicleDt(Number.NaN), 0);
});

const OPEN = { bound: 75 };

test('resolveBody: open ground → the wanted pose, no contact', () => {
  const r = resolveBody(0, 0, 0, 0, 0.1, 0.02, JEEP_BODY, [{ x: 10, z: 10, r: 0.6 }], OPEN);
  assert.ok(near(r.x, 0) && near(r.z, 0.1) && near(r.heading, 0.02) && !r.contact);
});

test('resolveBody: the BODY (not the centre) stops at a trunk ahead — never inside it', () => {
  const tree = { x: 0, z: 3, r: 0.6 };
  // drive straight at the trunk in small steps, as the World does each frame
  let x = 0, z = 0, contact = false;
  for (let i = 0; i < 200; i++) {
    const r = resolveBody(x, z, 0, x, z + 0.05, 0, JEEP_BODY, [tree], OPEN);
    x = r.x; z = r.z; contact ||= r.contact;
    assert.ok(bodyOverlap(x, z, 0, JEEP_BODY, [tree]) < 1e-6, 'no step ends inside the trunk');
  }
  assert.ok(contact, 'it touched the trunk');
  assert.ok(z < tree.z - tree.r - JEEP_BODY[0].along - JEEP_BODY[0].r + 0.2, `the nose stops at the trunk (centre z ${z.toFixed(2)})`);
});

test('resolveBody: an off-centre trunk makes the jeep SLIDE past, not stop dead', () => {
  const tree = { x: 0.6, z: 3, r: 0.6 };
  let x = 0, z = 0;
  for (let i = 0; i < 200; i++) {
    const r = resolveBody(x, z, 0, x, z + 0.05, 0, JEEP_BODY, [tree], OPEN);
    x = r.x; z = r.z;
  }
  assert.ok(z > tree.z + 1, `it slid past the trunk (z ${z.toFixed(2)})`);
  assert.ok(x < -0.3, 'by sliding to the free side');
});

test('resolveBody: wedged between two trunks it keeps the old pose (never deeper)', () => {
  const solids = [{ x: -1.3, z: 0, r: 0.6 }, { x: 1.3, z: 0, r: 0.6 }];
  const r = resolveBody(0, -3, 0, 0, -2.9, 0, JEEP_BODY, solids, OPEN);
  assert.ok(bodyOverlap(r.x, r.z, r.heading, JEEP_BODY, solids) <= bodyOverlap(0, -2.9, 0, JEEP_BODY, solids));
});

test('resolveBody: the whole body stays inside the world rim, and out of the water', () => {
  const r = resolveBody(0, 72, 0, 0, 80, 0, JEEP_BODY, [], OPEN);
  assert.ok(Math.hypot(r.x, r.z) + 1.9 <= 75 + 1e-6, 'the nose stays inside the rim');
  const wet = { bound: 75, blocked: (x: number, z: number) => z > 5 };
  const w = resolveBody(0, 2.5, 0, 0, 3.5, 0, JEEP_BODY, [], wet);
  assert.ok(w.z + 1.9 <= 5 + 1e-6 && w.z > 2.5 && w.contact, `stops at the shore with its nose dry (z ${w.z.toFixed(2)})`);
});

test('freeDistance + contactSpeedCap: the jeep brakes softly toward a trunk ahead', () => {
  const tree = { x: 0, z: 10, r: 0.6 };
  const d = freeDistance(0, 0, 0, 1, JEEP_BODY, [tree], 30);
  assert.ok(near(d, 10 - 0.6 - 1.0 - 0.9, 1e-6), `free run to the trunk (${d.toFixed(2)} m)`);
  assert.equal(freeDistance(0, 0, 0, -1, JEEP_BODY, [tree], 30), 30, 'reversing away: nothing behind');
  assert.equal(freeDistance(0, 0, Math.PI / 2, 1, JEEP_BODY, [tree], 30), 30, 'heading past it: clear');
  const decel = JEEP_CAPS.maxSpeed / JEEP_RAMP_TIME;
  assert.ok(contactSpeedCap(20, decel) >= JEEP_CAPS.maxSpeed, 'far away the cap does not bind');
  assert.ok(near(contactSpeedCap(0, decel), CONTACT_CREEP), 'at the trunk only the creep is left');
  assert.ok(contactSpeedCap(1, decel) < contactSpeedCap(2, decel), 'the closer, the slower (a smooth stop)');
});

test('wheelContact: flat ground → level; a slope → the matching pitch and roll', () => {
  const flat = wheelContact(3, 4, 0.7, () => 2);
  assert.ok(near(flat.y, 2) && near(flat.pitch, 0) && near(flat.roll, 0));
  const up = wheelContact(0, 0, 0, (_x, z) => z * 0.1); // rises along +z = the nose at heading 0
  assert.ok(up.pitch > 0 && near(Math.tan(up.pitch), 0.1, 1e-9), 'nose-up pitch on an uphill');
  const side = wheelContact(0, 0, 0, (x) => x * 0.1); // left of forward at heading 0 is +x
  assert.ok(side.roll > 0 && near(Math.tan(side.roll), 0.1, 1e-9), 'left side up on a side slope');
});
