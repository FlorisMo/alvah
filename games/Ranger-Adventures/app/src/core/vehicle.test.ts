import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  driveStep, driveCaps, JEEP_CAPS, JEEP_CAPS_REDUCED,
  rampSpeed, comfortSteer, JEEP_RAMP_TIME, STEER_AUTHORITY_MAX,
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
  assert.ok(near(comfortSteer(1, JEEP_CAPS.maxSpeed / 4, JEEP_CAPS), 0.25), 'a quarter of the speed → a quarter of the authority');
  assert.ok(near(comfortSteer(1, JEEP_CAPS.maxSpeed / 2, JEEP_CAPS), STEER_AUTHORITY_MAX), 'from half speed on the authority is capped…');
  assert.ok(near(comfortSteer(1, JEEP_CAPS.maxSpeed, JEEP_CAPS), STEER_AUTHORITY_MAX), '…so full speed and full steer turn no faster');
  assert.ok(near(comfortSteer(5, JEEP_CAPS.maxSpeed, JEEP_CAPS), STEER_AUTHORITY_MAX), 'saturated steer past ±1 still clamps to the cap');
});

test('F-32 comfort composition: no-throttle steer never pivots; full gas + full steer turns at the calm 0.6 rad/s', () => {
  // (1) The pipeline with no throttle: speed 0 → comfortSteer 0 → driveStep leaves the
  //     heading put. A held turn key on a standing jeep does nothing.
  const es0 = comfortSteer(1, 0, JEEP_CAPS);
  const still = driveStep(0.5, { throttle: 0, steer: es0 }, 1, JEEP_CAPS);
  assert.ok(near(still.heading, 0.5), 'no speed ⇒ a held turn key cannot rotate the jeep (no doughnut)');
  // (2) The MAX turn rate a player can reach, now that the keys keep full gas while
  //     steering (run 6): full throttle AND full steer turn at turnRate/2 = 0.6 rad/s,
  //     a calm ~10 m circle at 6 m/s, inside the F-32 band [0.6, 0.9]; reduced motion 0.3.
  const dt = 1 / 60;
  for (const [caps, want] of [[JEEP_CAPS, 0.6], [JEEP_CAPS_REDUCED, 0.3]] as const) {
    const s = driveStep(0, { throttle: 1, steer: comfortSteer(1, caps.maxSpeed, caps) }, dt, caps);
    const rate = Math.abs(s.heading) / dt;
    assert.ok(near(rate, want, 1e-6), `full gas + full steer turns at ${rate.toFixed(3)} rad/s (want ${want})`);
  }
});

// ── wave 2: the jeep feels like a real, calm vehicle ─────────────────────────

import {
  driveIntent, STEER_CREEP, REVERSE_FRACTION, vehicleDt, MAX_VEHICLE_DT,
  JEEP_BODY, resolveBody, bodyOverlap, freeDistance, contactSpeedCap, CONTACT_CREEP, wheelContact,
  jeepStep, type JeepState, type JeepWorld, type Solid, type YieldAnimal,
} from './vehicle.ts';

/** A jeep at rest (or rolling at `speed`) at (x, z) facing `heading`. */
const jeep = (x = 0, z = 0, heading = 0, speed = 0): JeepState => ({ x, z, heading, speed, contact: false, braked: false });
/** What the jeep meets: open ground inside the 75 m rim unless told otherwise. */
function world(o: { solids?: Solid[]; zones?: Solid[]; animals?: YieldAnimal[]; limits?: JeepWorld['limits'] } = {}): JeepWorld {
  const solids = o.solids ?? [], zones = o.zones ?? [];
  return { solids, zones, walls: [...solids, ...zones], animals: o.animals ?? [], limits: o.limits ?? { bound: 75 } };
}

const KEY = (fwd: number, turn = 0) => ({ fwd, turn });

test('driveIntent: Up = gas, Down = reverse (slower), nothing = nothing — keys and stick alike', () => {
  assert.deepEqual(driveIntent(null, null), { throttle: 0, steer: 0 });
  assert.deepEqual(driveIntent(null, { x: 0, y: 0 }), { throttle: 0, steer: 0 });
  for (const up of [driveIntent(KEY(1), null), driveIntent(null, { x: 0, y: 1 })]) {
    assert.ok(near(up.throttle, 1) && near(up.steer, 0), 'Up alone is full gas, straight');
  }
  for (const down of [driveIntent(KEY(-1), null), driveIntent(null, { x: 0, y: -1 })]) {
    assert.ok(near(down.throttle, -REVERSE_FRACTION) && near(down.steer, 0), 'Down alone backs up, calmer than forward');
  }
  assert.deepEqual(driveIntent(KEY(1), { x: 0, y: -1 }), driveIntent(KEY(1), null), 'held keys win over the stick');
});

test('driveIntent: the keys are tank axes — Up + Right is full gas AND full steer (run 6: it was 0.71 of each)', () => {
  const ur = driveIntent(KEY(1, 1), null);
  assert.ok(near(ur.throttle, 1) && near(ur.steer, 1), `Up+Right: gas ${ur.throttle}, steer ${ur.steer}`);
  const ul = driveIntent(KEY(1, -1), null);
  assert.ok(near(ul.throttle, 1) && near(ul.steer, -1), 'Up+Left: full gas, full left');
  const dr = driveIntent(KEY(-1, 1), null);
  assert.ok(near(dr.throttle, -REVERSE_FRACTION) && near(dr.steer, 1), 'Down+Right: reverse while steering');
});

test('driveIntent: the stick pushed up and a bit sideways keeps full gas at its rim', () => {
  const a = (deg: number) => ({ x: Math.sin((deg * Math.PI) / 180), y: Math.cos((deg * Math.PI) / 180) });
  assert.ok(near(driveIntent(null, a(45)).throttle, 1), 'a 45° push at the rim: full gas');
  assert.ok(near(driveIntent(null, a(-45)).steer, -Math.SQRT1_2, 1e-9), 'and steers the way it points');
  assert.ok(driveIntent(null, a(70)).throttle < 1 && driveIntent(null, a(70)).throttle > STEER_CREEP, 'further round: less gas');
  const half = { x: a(30).x / 2, y: a(30).y / 2 };
  assert.ok(near(driveIntent(null, half).throttle, 0.5), 'half way out: half the gas');
});

test('driveIntent: pushed only sideways the jeep creeps forward AND turns (audit veh-05)', () => {
  for (const x of [1, -1]) {
    for (const want of [driveIntent(null, { x, y: 0 }), driveIntent(KEY(0, x), null)]) {
      assert.ok(near(want.throttle, STEER_CREEP), 'a sideways push still rolls forward');
      assert.ok(near(want.steer, x), 'full steer toward the push');
      // the whole frame from rest: it moves AND its heading changes
      const j = jeep();
      let dist = 0;
      for (let i = 0; i < 120; i++) { const f = jeepStep(j, want, 1 / 60, JEEP_CAPS, world()); dist += Math.hypot(f.x - j.x, f.z - j.z); Object.assign(j, f); }
      assert.ok(dist > 2, `2 s of a sideways push drives on (${dist.toFixed(2)} m)`);
      assert.ok(x > 0 ? j.heading < -0.1 : j.heading > 0.1, 'and turns toward the push (right lowers the yaw)');
    }
  }
});

test('driveIntent: the stick\'s down-diagonal reverses while steering, never faster than its cap', () => {
  const c = Math.SQRT1_2;
  const dr = driveIntent(null, { x: c, y: -c });
  assert.ok(dr.throttle < 0 && dr.steer > 0.6, 'down-right: reverse + right');
  assert.ok(Math.abs(dr.throttle) <= REVERSE_FRACTION + 1e-9, 'reverse never faster than its cap');
});

test('comfortSteer: reversing swings the nose the other way (a real car), floor keeps authority', () => {
  assert.ok(comfortSteer(1, -JEEP_CAPS.maxSpeed / 2, JEEP_CAPS) < 0, 'reverse + right → the nose goes left');
  assert.ok(near(comfortSteer(1, 0, JEEP_CAPS, 0.4), 0.4), 'pressed against a trunk it can still turn away');
  assert.ok(near(comfortSteer(1, JEEP_CAPS.maxSpeed, JEEP_CAPS, 0.4), STEER_AUTHORITY_MAX), 'the floor never lowers real authority');
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
  assert.ok(near(contactSpeedCap(0.1, decel), 0), 'met squarely: at the trunk it stands (no last creep into the bark)');
  assert.ok(near(contactSpeedCap(0, decel, 0.5), CONTACT_CREEP / 0.25), 'met at a slant: it may brush on at the creep of its run into it');
  assert.ok(contactSpeedCap(1, decel) < contactSpeedCap(2, decel), 'the closer, the slower (a smooth stop)');
  assert.ok(contactSpeedCap(0, decel, 0.3) > JEEP_CAPS.maxSpeed, 'a trunk it only brushes: no brake at all');
});

test('wheelContact: flat ground → level; a slope → the matching pitch and roll', () => {
  const flat = wheelContact(3, 4, 0.7, () => 2);
  assert.ok(near(flat.y, 2) && near(flat.pitch, 0) && near(flat.roll, 0));
  const up = wheelContact(0, 0, 0, (_x, z) => z * 0.1); // rises along +z = the nose at heading 0
  assert.ok(up.pitch > 0 && near(Math.tan(up.pitch), 0.1, 1e-9), 'nose-up pitch on an uphill');
  const side = wheelContact(0, 0, 0, (x) => x * 0.1); // left of forward at heading 0 is +x
  assert.ok(side.roll > 0 && near(Math.tan(side.roll), 0.1, 1e-9), 'left side up on a side slope');
});

import { keepOutSteer, guidedSteer, KEEP_OUT_LOOK_S } from './vehicle.ts';

test('keepOutSteer: only a zone IN the path, ahead and within reach, bends the jeep', () => {
  const zone = { x: 0, z: 12, r: 5.2 };
  assert.equal(keepOutSteer(0, 0, Math.PI, 6, [zone], JEEP_BODY), 0, 'driving away from it: no bend');
  assert.equal(keepOutSteer(8, 0, 0, 6, [zone], JEEP_BODY), 0, 'a path that clears it: no bend');
  assert.equal(keepOutSteer(0, -20, 0, 6, [zone], JEEP_BODY), 0, `further than ${KEEP_OUT_LOOK_S * 6} m ahead at 6 m/s: no bend yet`);
  // left of forward at heading 0 is +x: a zone whose centre lies to the left → steer right (+)
  const far = keepOutSteer(-2, -6, 0, 6, [zone], JEEP_BODY), close = keepOutSteer(-2, 3, 0, 6, [zone], JEEP_BODY);
  assert.ok(far > 0 && close > far, `it bends right, more as it nears (${far.toFixed(2)} → ${close.toFixed(2)})`);
  assert.ok(keepOutSteer(2, 3, 0, 6, [zone], JEEP_BODY) < 0, 'a zone to the right → steer left');
  assert.ok(near(keepOutSteer(0, 4, 0, 6, [zone], JEEP_BODY), 1), 'about to touch: a full turn');
  assert.ok(keepOutSteer(0, 4, 0, 6, [zone], JEEP_BODY, -1) < 0, 'met dead centre it goes the way the player steers');
});

test('guidedSteer: the bend adds to a steer the same way and outweighs one into the zone', () => {
  assert.equal(guidedSteer(0.4, 0), 0.4, 'no bend: the player steers');
  assert.equal(guidedSteer(1, 0.5), 1, 'the same way: the stronger one');
  assert.equal(guidedSteer(0, 0.5), 0.5);
  assert.ok(near(guidedSteer(-1, 0.5), 0), 'into the zone at half bend: they cancel');
  assert.equal(guidedSteer(-1, 1), 1, 'into the zone at a full bend: the zone wins');
});

/** Seconds of the jeep's own frame (`jeepStep`) with the keys a child holds while
 *  steering at `target`: Up, plus Left/Right while it points more than 0.12 rad off. */
function driveAt(target: { x: number; z: number }, zones: { x: number; z: number; r: number }[], seconds: number, x0 = 0) {
  const dt = 1 / 60;
  const j = jeep(x0);
  let worst = 0, slowest = Infinity, far = 0, touched = 0;
  for (let t = 0; t < seconds; t += dt) {
    const e = Math.atan2(Math.sin(Math.atan2(target.x - j.x, target.z - j.z) - j.heading), Math.cos(Math.atan2(target.x - j.x, target.z - j.z) - j.heading));
    const f = jeepStep(j, driveIntent(KEY(1, e > 0.12 ? -1 : e < -0.12 ? 1 : 0), null), dt, JEEP_CAPS, world({ zones }));
    Object.assign(j, f);
    worst = Math.max(worst, bodyOverlap(j.x, j.z, j.heading, JEEP_BODY, zones));
    if (f.contact) touched++;
    if (t > 1.5) slowest = Math.min(slowest, f.moved);
    far = Math.max(far, j.z);
  }
  return { x: j.x, z: j.z, worst, slowest, far, touched };
}

test('keep-out zone: steered straight at a ree behind it, the jeep glides round — never stuck, never inside (verifier V2)', () => {
  for (const off of [0, 0.3, 2, 5]) {
    const r = driveAt({ x: off * 0.3, z: 60 }, [{ x: off, z: 22, r: 5.2 }], 12);
    assert.ok(r.worst < 0.05, `offset ${off}: the body never sinks into the zone (${r.worst.toFixed(3)} m)`);
    assert.equal(r.touched, 0, `offset ${off}: the bend keeps the body off the zone: it never even touches it`);
    assert.ok(r.slowest > 5.9, `offset ${off}: it keeps its speed (slowest ${r.slowest.toFixed(2)} m/s: an invisible zone never slows it)`);
    assert.ok(r.far > 40, `offset ${off}: it got round to the far side (z ${r.far.toFixed(1)})`);
  }
});

test('keep-out zones: two markers close together block as one patch — the jeep goes round the pair, never pinned in the notch between them', () => {
  for (const gap of [9, 12]) {
    for (const off of [0, 0.5, 2]) {
      const zones = [{ x: -gap / 2, z: 22, r: 5.2 }, { x: gap / 2, z: 22, r: 5.2 }];
      const r = driveAt({ x: off, z: 60 }, zones, 12, off);
      assert.ok(r.worst < 0.05, `gap ${gap}, offset ${off}: the body never sinks into a zone (${r.worst.toFixed(3)} m)`);
      assert.equal(r.touched, 0, `gap ${gap}, offset ${off}: it never touches a zone`);
      assert.ok(r.slowest > 5.9, `gap ${gap}, offset ${off}: it keeps its speed (slowest ${r.slowest.toFixed(2)} m/s)`);
      assert.ok(r.far > 40, `gap ${gap}, offset ${off}: it got round the pair (z ${r.far.toFixed(1)})`);
    }
  }
});

test('keep-out zone: a jeep that only grazes a zone gets a nudge, not a lock — the sideways push of a child still turns it (audit veh-05)', () => {
  // the stick pushed right beside the stuifzand zone, as from the jeep's home: it creeps and turns right
  const zones = [{ x: 15.6, z: 15.6, r: 5.2 }];
  const dt = 1 / 60;
  const j = jeep(14, 0, Math.atan2(18, 18.4));
  for (const want of [driveIntent(null, { x: 1, y: 0 }), driveIntent(KEY(0, 1), null)]) {
    Object.assign(j, jeep(14, 0, Math.atan2(18, 18.4)));
    for (let t = 0; t < 3; t += dt) Object.assign(j, jeepStep(j, want, dt, JEEP_CAPS, world({ zones })));
    const turned = Math.atan2(Math.sin(j.heading - Math.atan2(18, 18.4)), Math.cos(j.heading - Math.atan2(18, 18.4)));
    assert.ok(turned < -0.4, `it turned right as pushed (${turned.toFixed(2)} rad)`);
  }
});

// ── wave 4: the shore of the ven is a wall the jeep slides along, never a trap ─

/** A round lake ahead of the jeep (it starts at the origin facing +z). */
const LAKE = { x: 0, z: 20, r: 12 };
const LAKE_LIMITS = { bound: 75, blocked: (x: number, z: number) => Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r };
const bodyWet = (x: number, z: number, h: number): boolean => {
  const fx = Math.sin(h), fz = Math.cos(h);
  return [1.9, 1, 0, -1, -1.9].some((a) => LAKE_LIMITS.blocked(x + fx * a, z + fz * a));
};

/** Seconds of the jeep's own frame (`jeepStep`) with keys held (tank axes) by the lake;
 *  returns how many frames its body was wet (never, we hope). */
function holdKeys(j: JeepState, keys: { fwd: number; turn: number }, seconds: number) {
  const dt = 1 / 60;
  let wetFrames = 0;
  for (let t = 0; t < seconds; t += dt) {
    Object.assign(j, jeepStep(j, driveIntent(keys, null), dt, JEEP_CAPS, world({ limits: LAKE_LIMITS })));
    if (bodyWet(j.x, j.z, j.heading)) wetFrames++;
  }
  return wetFrames;
}

test('at the shore, Up+Left (and every other turn key) swings the jeep free — only reverse used to (parent B5, breaker B2)', () => {
  for (const [name, keys] of [['Up+Left', KEY(1, -1)], ['Up+Right', KEY(1, 1)], ['Left', KEY(0, -1)], ['Right', KEY(0, 1)]] as const) {
    const s = jeep();
    holdKeys(s, KEY(1), 4);                                  // straight into the water until it stops
    assert.ok(s.contact && s.z > 5 && s.z < 7, `${name}: pinned nose-first at the shore (z ${s.z.toFixed(2)})`);
    const h0 = s.heading, x0 = s.x, z0 = s.z;
    const wet = holdKeys(s, keys, 3);
    const turned = Math.atan2(Math.sin(s.heading - h0), Math.cos(s.heading - h0));
    assert.ok(Math.abs(turned) > 0.5, `${name}: the heading changes (${turned.toFixed(2)} rad in 3 s)`);
    assert.ok(keys.turn < 0 ? turned > 0 : turned < 0, `${name}: toward the key (left raises the yaw)`);
    assert.ok(Math.hypot(s.x - x0, s.z - z0) > 0.8, `${name}: and it drives on (${Math.hypot(s.x - x0, s.z - z0).toFixed(2)} m)`);
    assert.equal(wet, 0, `${name}: the body never enters the water`);
  }
});

test('met at a slant, the shore slides the jeep along it instead of stopping it dead', () => {
  // aimed 0.5 rad off the lake's centre: it meets the bank at a slant and keeps pushing
  const s = jeep(0, 0, 0.5);
  let wet = 0, hit: { x: number; z: number } | null = null;
  for (let k = 0; k < 60 && !hit; k++) { wet += holdKeys(s, KEY(1), 0.1); if (s.contact) hit = { x: s.x, z: s.z }; }
  assert.ok(hit, 'it reached the bank');
  wet += holdKeys(s, KEY(1), 4);
  assert.equal(wet, 0, 'the body never enters the water');
  const slid = Math.hypot(s.x - hit!.x, s.z - hit!.z);
  assert.ok(slid > 2, `pushed on, it slid along the bank (${slid.toFixed(2)} m in 4 s), like along a trunk`);
  assert.ok(Math.hypot(s.x - LAKE.x, s.z - LAKE.z) > LAKE.r, 'its centre stays on the dry side');
});

test('pushed back off the water, the body never ends up past the rim', () => {
  // at the very rim, facing in, its nose a hair from a strip of water: a step in wets the
  // nose, and the push back out (with its centimetre of room) would land past the rim
  const lim = 75 - 1.9; // the bound less the body's reach
  const strip = { bound: 75, blocked: (_x: number, z: number) => z < lim - 1.905 && z > lim - 6 };
  const r = resolveBody(0, lim, Math.PI, 0, lim - 0.1, Math.PI, JEEP_BODY, [], strip);
  assert.ok(r.contact, 'the water stopped it');
  assert.ok(Math.hypot(r.x, r.z) <= lim + 1e-6, `inside the rim (${(Math.hypot(r.x, r.z) - lim).toFixed(4)} m past it)`);
});

// ── run 6: a jeep that holds its speed and is never shoved ──────────────────────

import { yieldBrake, yieldSpeed, rimFree, rimSteer, pathCurvature, YIELD_GAP, YIELD_HARD_GAP, YIELD_HARD_DECEL, RIM_GAP } from './vehicle.ts';

/** Run the jeep's frame for `seconds` with `keys` held; `each` sees every frame. */
function hold(j: JeepState, keys: { fwd: number; turn: number }, seconds: number, w: JeepWorld, each?: (f: ReturnType<typeof jeepStep>, t: number, yaw: number) => void): JeepState {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    const f = jeepStep(j, driveIntent(keys, null), dt, JEEP_CAPS, w);
    const yaw = Math.atan2(Math.sin(f.heading - j.heading), Math.cos(f.heading - j.heading)) / dt;
    Object.assign(j, f);
    each?.(f, t, yaw);
  }
  return j;
}
/** The gap (m) between the jeep's body and an animal's footprint (< 0 = touching). */
const bodyGapTo = (j: JeepState, a: { x: number; z: number; r: number }): number =>
  Math.min(...JEEP_BODY.map((b) => Math.hypot(j.x + Math.sin(j.heading) * b.along - a.x, j.z + Math.cos(j.heading) * b.along - a.z) - b.r - a.r));

test('full gas is full speed: W reaches 6 m/s in ~1 s and holds it; W+D keeps it, turning at the calm 0.6 rad/s', () => {
  let at11 = 0, low = Infinity;
  hold(jeep(), KEY(1), 4, world(), (f, t) => { if (Math.abs(t - 1.1) < 1 / 120) at11 = f.moved; if (t > 1.1) low = Math.min(low, f.moved); });
  assert.ok(at11 > 5.9 && low > 5.99, `W: ${at11.toFixed(2)} m/s at 1.1 s, never below ${low.toFixed(2)} after`);
  let slow = Infinity, peak = 0, braked = false;
  hold(jeep(0, 0, 0, 6), KEY(1, 1), 6, world(), (f, _t, yaw) => { slow = Math.min(slow, f.moved); peak = Math.max(peak, Math.abs(yaw)); if (f.brake) braked = true; });
  assert.ok(!braked, 'nothing in the way: no brake ever acts');
  assert.ok(slow > 5.99, `W+D keeps full speed through the turn (slowest ${slow.toFixed(2)} m/s)`);
  assert.ok(peak <= 0.6 + 1e-6 && peak > 0.59, `and turns at the calm ${peak.toFixed(3)} rad/s (a ~10 m circle)`);
});

test('an animal never pushes the jeep: one pressed into its side moves nothing, and it drives on past', () => {
  const side = { id: 'animal-ree-roedeer', x: 1.2, z: 0, r: 0.56 };                 // half inside its left flank
  const parked = hold(jeep(), KEY(0), 1, world({ animals: [side] }));
  assert.ok(parked.x === 0 && parked.z === 0 && parked.heading === 0, 'standing, the animal leaning on it moves it not a millimetre');
  let drift = 0;
  const j = hold(jeep(), KEY(1), 2, world({ animals: [side] }), (f) => { drift = Math.max(drift, Math.abs(f.x)); });
  assert.ok(drift < 1e-9 && j.z > 5, `driving on it goes straight ahead (sideways ${drift} m), never shoved`);
});

test('give way: a grazing animal in the path — a smooth stop a metre short, never a touch (yieldFor names it)', () => {
  const ree = { id: 'animal-ree-roedeer', x: 0.4, z: 25, r: 0.56 };
  let minGap = Infinity, decel = 0, prev = 0, named = false;
  const j = hold(jeep(), KEY(1), 10, world({ animals: [ree] }), (f) => {
    minGap = Math.min(minGap, bodyGapTo(f, ree)); decel = Math.max(decel, (prev - f.speed) * 60); prev = f.speed;
    if (f.yieldFor === ree.id && f.brake === 'animal') named = true;
  });
  assert.ok(j.speed === 0 && j.braked, 'it stands, held, while the gas is still on');
  assert.ok(minGap >= YIELD_GAP - 0.05 && minGap < YIELD_GAP + 0.3, `it stopped ${minGap.toFixed(2)} m short of the animal`);
  assert.ok(decel < 5.5, `a gentle stop (at most ${decel.toFixed(1)} m/s²)`);
  assert.ok(named, 'the dev hook names the animal it waits for');
  // the animal walks off: the jeep sets off again by itself
  hold(j, KEY(1), 3, world({ animals: [{ ...ree, x: 6 }] }));
  assert.ok(j.speed > 5.9, 'the path clear, it ramps back to full speed');
});

test('give way: an animal beside the track, or behind the jeep, changes nothing', () => {
  for (const a of [{ x: 2.6, z: 20 }, { x: -2.6, z: 20 }, { x: 0, z: -4 }]) {
    let slow = Infinity, named = false;
    hold(jeep(), KEY(1), 5, world({ animals: [{ id: 'fox', r: 0.54, ...a }] }), (f, t) => { if (t > 1.05) slow = Math.min(slow, f.moved); if (f.yieldFor) named = true; });
    assert.ok(slow > 5.99 && !named, `an animal at (${a.x}, ${a.z}): full speed (slowest ${slow.toFixed(2)})`);
  }
});

test('give way: an animal that cannot get away holds the jeep still — never touched; a turn key swings it round', () => {
  const boar = { id: 'boar', x: 0, z: 20, r: 0.74 };
  let minGap = Infinity;
  const j = hold(jeep(), KEY(1), 12, world({ animals: [boar] }), (f) => { minGap = Math.min(minGap, bodyGapTo(f, boar)); });
  assert.ok(j.speed === 0 && minGap >= YIELD_GAP - 0.05, `held ${minGap.toFixed(2)} m short for as long as the gas is on`);
  const z0 = j.z;
  hold(j, KEY(1, 1), 6, world({ animals: [boar] }), (f) => { minGap = Math.min(minGap, bodyGapTo(f, boar)); });
  assert.ok(minGap > 0.3, `Up+Right swings it round the boar (closest ${minGap.toFixed(2)} m, never a touch)`);
  assert.ok(Math.hypot(j.x, j.z - z0) > 8 && j.speed > 5, 'and away at speed');
});

test('give way: backing up toward an animal behind stops short of it too; driving away from it does not', () => {
  const fox = { id: 'fox', x: 0.3, z: -12, r: 0.54 };
  let minGap = Infinity;
  const j = hold(jeep(), KEY(-1), 12, world({ animals: [fox] }), (f) => { minGap = Math.min(minGap, bodyGapTo(f, fox)); });
  assert.ok(j.speed === 0 && minGap >= YIELD_GAP - 0.05, `reversing, it stops ${minGap.toFixed(2)} m short`);
  assert.equal(yieldBrake(0, 0, 0, 1, 0, JEEP_BODY, [fox]).id, null, 'forward, the animal behind is not in its path');
});

test('give way: the brake looks along the arc the jeep turns on, not the straight line', () => {
  // turning right at 6 m/s: an animal 60° round its ~10 m circle is in its path…
  const k = pathCurvature(1, 6, 1, JEEP_CAPS);
  assert.ok(Math.abs(k + 0.1) < 1e-9, `a right turn at full speed curves 0.1 /m to the right (${k})`);
  const onArc = { id: 'ree', x: -10 + 10 * Math.cos(Math.PI / 3), z: 10 * Math.sin(Math.PI / 3) - 1.9 * 0, r: 0.56 };
  assert.equal(yieldBrake(0, 0, 0, 1, k, JEEP_BODY, [onArc]).id, 'ree', 'the animal on the arc it drives');
  assert.equal(yieldBrake(0, 0, 0, 1, 0, JEEP_BODY, [onArc]).id, null, 'which the straight line would miss');
  // …and one straight ahead is not, while it turns away from it
  const ahead = { id: 'ree', x: 0, z: 14, r: 0.56 };
  assert.equal(yieldBrake(0, 0, 0, 1, pathCurvature(-1, 6, 1, JEEP_CAPS), JEEP_BODY, [ahead]).id, null, 'turning left, away from it: no brake');
  let minGap = Infinity;
  hold(jeep(0, 0, 0, 6), KEY(1, 1), 5, world({ animals: [onArc] }), (f) => { minGap = Math.min(minGap, bodyGapTo(f, onArc)); });
  assert.ok(minGap > 0.3, `turning into it, the jeep never touches it (closest ${minGap.toFixed(2)} m)`);
});

test('give way: an animal stepping into the path close ahead — a firm but smooth brake, still short of it', () => {
  const dt = 1 / 60;
  const j = jeep(0, 0, 0, 6);
  let minGap = Infinity, decel = 0;
  const ree = { id: 'ree', x: 0, z: 1.9 + 3 + 0.56, r: 0.56 };             // 3 m from the bumper
  for (let t = 0; t < 4; t += dt) {
    const f = jeepStep(j, driveIntent(KEY(1), null), dt, JEEP_CAPS, world({ animals: [ree] }));
    decel = Math.max(decel, (j.speed - f.speed) / dt);
    Object.assign(j, f);
    minGap = Math.min(minGap, bodyGapTo(j, ree));
  }
  assert.ok(decel <= YIELD_HARD_DECEL + 1e-6, `never more than ${YIELD_HARD_DECEL} m/s² (${decel.toFixed(2)}): no one-frame drop`);
  assert.ok(minGap >= YIELD_HARD_GAP - 0.02, `and it stops ${minGap.toFixed(2)} m short`);
  assert.ok(yieldSpeed(30) > 6 && yieldSpeed(YIELD_GAP) === 0, 'far off no brake; at the gap a stop');
});

test('the forest edge: met at a slant the jeep curves along the tree line at speed, never onto it', () => {
  const lim = 75 - 1.9;
  for (const deg of [10, 30, 45]) {
    const th = (deg * Math.PI) / 180;              // out of line with the edge, starting 40 m from the centre
    const j = jeep(0, 40, Math.atan2(Math.cos(th), Math.sin(th)), 6);
    let closest = Infinity, slow = Infinity;
    hold(j, KEY(1), 14, world(), (f) => { closest = Math.min(closest, lim - Math.hypot(f.x, f.z)); slow = Math.min(slow, f.moved); });
    assert.ok(closest > 0.5, `${deg}°: it stays ${closest.toFixed(2)} m inside the edge`);
    assert.ok(slow > (deg < 40 ? 5.99 : 5), `${deg}°: and keeps its speed (slowest ${slow.toFixed(2)} m/s)`);
    assert.ok(j.moved > 5.99, `${deg}°: rolling along the tree line at full speed at the end`);
  }
});

test('the forest edge: driven at it head-on the jeep stops cleanly short of it — no grind — and a turn key takes it away', () => {
  const lim = 75 - 1.9;
  const j = jeep(0, 40, 0, 6);
  let crawl = 0, edge = false;
  hold(j, KEY(1), 10, world(), (f) => { if (f.moved > 0.01 && f.moved < 0.5) crawl++; if (f.brake === 'edge') edge = true; });
  assert.ok(edge, 'the dev hook says the forest edge braked it');
  assert.ok(j.speed === 0 && Math.abs(lim - j.z - RIM_GAP) < 0.05, `stopped ${(lim - j.z).toFixed(2)} m short of the edge`);
  assert.ok(crawl <= 12, `the last of the stop only (${crawl} frames under 0.5 m/s), never a crawl along it`);
  const z0 = j.z;
  hold(j, KEY(1), 2, world());
  assert.equal(j.z, z0, 'more gas straight on does nothing: it stands');
  let tooSlow = 0, closest = Infinity;
  hold(j, KEY(1, -1), 6, world(), (f, t) => { if (t > 2.5 && f.moved < 1) tooSlow++; closest = Math.min(closest, lim - Math.hypot(f.x, f.z)); });
  assert.ok(Math.hypot(j.x, j.z - z0) > 8, 'Up+Left turns it and drives it off along the edge');
  assert.ok(tooSlow === 0 && closest >= 0, `no crawl once it sets off (${tooSlow} slow frames), never past the edge`);
});

test('rimFree / rimSteer: the chord to the edge, and a bend only when heading out near it', () => {
  assert.ok(Math.abs(rimFree(0, 60, 0, 1, 73) - 13) < 1e-9, 'straight out: the distance to the edge');
  assert.equal(rimFree(0, 60, Math.PI, 1, 73), 73 + 60, 'straight in: across the whole world');
  assert.equal(rimFree(0, 73.5, 0, 1, 73), 0, 'on the edge heading out: nothing left');
  assert.equal(rimSteer(0, 50, 0.3, 73), 0, 'far from the edge: no bend');
  assert.equal(rimSteer(0, 70, Math.PI, 73), 0, 'heading in: no bend');
  assert.ok(rimSteer(0, 68, 0.6, 73) < 0, 'heading out and off to the left of straight out: it bends further left, along the edge');
  assert.ok(rimSteer(0, 68, -0.6, 73) > 0, 'and the other way round');
  assert.equal(rimSteer(0, 68, 0.05, 73), 0, 'nearly head-on: no bend, it stops instead');
});

test('a trunk it only clips: the jeep brushes past keeping most of its speed; one dead ahead still stops it softly', () => {
  for (const [lat, keep] of [[1.45, 5.5], [1.3, 2.2]] as const) {         // the nose circle + trunk reach 1.5 m
    const tree = { x: lat, z: 20, r: 0.6 };
    let slow = Infinity, worst = 0;
    const j = hold(jeep(0, 0, 0, 6), KEY(1), 6, world({ solids: [tree] }), (f) => { slow = Math.min(slow, f.moved); worst = Math.max(worst, bodyOverlap(f.x, f.z, f.heading, JEEP_BODY, [tree])); });
    assert.ok(slow > keep, `a trunk ${lat} m off its line: it slows no lower than ${slow.toFixed(2)} m/s (run 6: a 0.8 m/s crawl)`);
    assert.ok(j.z > 30 && j.moved > 5.9 && worst < 1e-6, `and slides past, never into it, back at full speed (z ${j.z.toFixed(1)})`);
  }
  const tree = { x: 0, z: 20, r: 0.6 };
  let solid = false;
  const j = hold(jeep(0, 0, 0, 6), KEY(1), 6, world({ solids: [tree] }), (f) => { if (f.brake === 'solid') solid = true; });
  assert.ok(j.moved < 0.05 && j.z < 20 - 0.6 - 1.9 + 0.05, `dead ahead it rests at the trunk (z ${j.z.toFixed(2)})`);
  assert.ok(solid, 'the dev hook says a solid braked it');
});

test('jeepStep: a zero frame changes nothing', () => {
  const j = jeep(3, 4, 1, 5);
  const f = jeepStep(j, driveIntent(KEY(1, 1), null), 0, JEEP_CAPS, world());
  assert.ok(f.x === 3 && f.z === 4 && f.heading === 1 && f.speed === 5 && f.moved === 0);
});
