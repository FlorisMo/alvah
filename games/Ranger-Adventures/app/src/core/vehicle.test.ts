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
  JEEP_BODY, resolveBody, bodyOverlap, freeDistance, contactSpeedCap, BRUSH_LOSS, wheelContact,
  jeepStep, type JeepState, type JeepWorld, type Solid, type YieldAnimal,
} from './vehicle.ts';

/** A jeep at rest (or rolling at `speed`) at (x, z) facing `heading`. */
const jeep = (x = 0, z = 0, heading = 0, speed = 0): JeepState => ({ x, z, heading, speed, contact: false, braked: false });
/** What the jeep meets: open ground inside the 75 m rim unless told otherwise. */
function world(o: { solids?: Solid[]; zones?: Solid[]; animals?: YieldAnimal[]; limits?: JeepWorld['limits'] } = {}): JeepWorld {
  const solids = o.solids ?? [], zones = (o.zones ?? []).map((z) => ({ ...z, soft: true }));   // as the World pools them
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
  assert.ok(near(d, 10 - 0.6 - 1.0 - 0.9, 0.005), `free run to the trunk (${d.toFixed(3)} m, found to 5 mm)`);
  assert.equal(freeDistance(0, 0, 0, -1, JEEP_BODY, [tree], 30), 30, 'reversing away: nothing behind');
  assert.equal(freeDistance(0, 0, Math.PI / 2, 1, JEEP_BODY, [tree], 30), 30, 'heading past it: clear');
  const decel = JEEP_CAPS.maxSpeed / JEEP_RAMP_TIME;
  assert.ok(contactSpeedCap(20, decel) >= JEEP_CAPS.maxSpeed, 'far away the cap does not bind');
  assert.ok(near(contactSpeedCap(0.1, decel), 0), 'met squarely: at the trunk it stands (no last creep into the bark)');
  assert.ok(near(contactSpeedCap(0, decel, 0.5), BRUSH_LOSS / 0.25), 'met at a slant: it brushes on only as fast as the push-out takes little off its step');
  assert.ok(contactSpeedCap(1, decel) < contactSpeedCap(2, decel), 'the closer, the slower (a smooth stop)');
  assert.ok(contactSpeedCap(0, decel, 0.15) > JEEP_CAPS.maxSpeed, 'a trunk it only glances: no brake at all');
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
function driveAt(target: { x: number; z: number }, zones: { x: number; z: number; r: number }[], seconds: number, x0 = 0, caps = JEEP_CAPS) {
  const dt = 1 / 60;
  const j = jeep(x0);
  let worst = 0, slowest = Infinity, far = 0, touched = 0;
  for (let t = 0; t < seconds; t += dt) {
    const e = Math.atan2(Math.sin(Math.atan2(target.x - j.x, target.z - j.z) - j.heading), Math.cos(Math.atan2(target.x - j.x, target.z - j.z) - j.heading));
    const f = jeepStep(j, driveIntent(KEY(1, e > 0.12 ? -1 : e < -0.12 ? 1 : 0), null), dt, caps, world({ zones }));
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

test('keep-out zone under reduced motion: half the speed, half the turn rate — it still bends round without touching it', () => {
  for (const off of [0, 0.3, 2]) {
    const r = driveAt({ x: off * 0.3, z: 60 }, [{ x: off, z: 22, r: 5.2 }], 24, 0, JEEP_CAPS_REDUCED);
    assert.equal(r.touched, 0, `offset ${off}: never touches the zone`);
    assert.ok(r.slowest > JEEP_CAPS_REDUCED.maxSpeed - 0.05 && r.far > 40, `offset ${off}: at its full (reduced) speed round it (slowest ${r.slowest.toFixed(2)})`);
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

test('driven straight at the lake it stops smoothly short of the water — never wet, never touching — and every turn key swings it away (run 6 review P2)', () => {
  for (const [name, keys] of [['Up+Left', KEY(1, -1)], ['Up+Right', KEY(1, 1)], ['Left', KEY(0, -1)], ['Right', KEY(0, 1)]] as const) {
    const s = jeep();
    let touched = 0, decel = 0, prev = 0, water = false;
    const dt = 1 / 60;
    for (let t = 0; t < 6; t += dt) {
      const f = jeepStep(s, driveIntent(KEY(1), null), dt, JEEP_CAPS, world({ limits: LAKE_LIMITS }));
      if (f.contact) touched++;
      if (f.brake === 'water') water = true;
      if (prev > 1.5) decel = Math.max(decel, (prev - f.speed) / dt);
      prev = f.speed;
      Object.assign(s, f);
    }
    const shore = LAKE.z - LAKE.r;                                 // the water's near edge on its line
    assert.ok(s.speed === 0 && touched === 0, `${name}: it stands without ever touching the shore (${touched} contact frames)`);
    assert.ok(water, `${name}: the dev hook says the water braked it`);
    assert.ok(shore - (s.z + 1.9) >= WATER_GAP - 0.1 && shore - (s.z + 1.9) < WATER_GAP + 0.5, `${name}: its bumper stops ${(shore - s.z - 1.9).toFixed(2)} m short of the water`);
    assert.ok(decel <= 6, `${name}: a smooth stop (at most ${decel.toFixed(1)} m/s²), never a one-frame drop`);
    const h0 = s.heading, x0 = s.x, z0 = s.z;
    const wet = holdKeys(s, keys, 4);
    const turned = Math.atan2(Math.sin(s.heading - h0), Math.cos(s.heading - h0));
    assert.ok(Math.abs(turned) > 0.5, `${name}: the heading changes (${turned.toFixed(2)} rad in 4 s)`);
    assert.ok(keys.turn < 0 ? turned > 0 : turned < 0, `${name}: toward the key (left raises the yaw)`);
    assert.ok(Math.hypot(s.x - x0, s.z - z0) > 0.8, `${name}: and it drives off (${Math.hypot(s.x - x0, s.z - z0).toFixed(2)} m)`);
    assert.equal(wet, 0, `${name}: the body never enters the water`);
  }
});

test('met at a slant, the lake bends the jeep along its shore at speed — never wet, never touching, never braked hard (run 6 review P2)', () => {
  for (const aim of [0.4, 0.55, 0.7, -0.55]) {
    const s = jeep(0, -10, aim);
    let touched = 0, wet = 0, slow = Infinity, decel = 0, prev = 0;
    const dt = 1 / 60;
    for (let t = 0; t < 8; t += dt) {
      const f = jeepStep(s, driveIntent(KEY(1), null), dt, JEEP_CAPS, world({ limits: LAKE_LIMITS }));
      if (f.contact) touched++;
      if (bodyWet(f.x, f.z, f.heading)) wet++;
      if (t > 1.2) slow = Math.min(slow, f.moved);
      if (prev > 1.5) decel = Math.max(decel, (prev - f.speed) / dt);
      prev = f.speed;
      Object.assign(s, f);
    }
    assert.equal(wet + touched, 0, `aimed ${aim} rad off its centre: never wet (${wet}), never touching (${touched})`);
    assert.ok(slow >= 5, `aimed ${aim}: it curves along the shore at ${slow.toFixed(2)} m/s or more`);
    assert.ok(decel <= 12, `aimed ${aim}: no crash frame (${decel.toFixed(1)} m/s²)`);
  }
});

test('a key held toward the lake at full speed rolls the jeep along its bank instead — no crash frame, never wet (run 6 review P2: 6.0 → 1.98 m/s in two frames)', () => {
  // running past the lake 1.5 m off its shore, then the child turns in at it
  for (const turn of [-1, 1]) {
    const x0 = turn < 0 ? -(LAKE.r + 1.9 + 1.5) : LAKE.r + 1.9 + 1.5;
    const s = jeep(x0, 5, 0, 6);
    let wet = 0, touched = 0, decel = 0, prev = 6, slow = Infinity;
    const dt = 1 / 60;
    for (let t = 0; t < 4; t += dt) {
      const f = jeepStep(s, driveIntent(KEY(1, -turn), null), dt, JEEP_CAPS, world({ limits: LAKE_LIMITS }));
      if (f.contact) touched++;
      if (bodyWet(f.x, f.z, f.heading)) wet++;
      decel = Math.max(decel, (prev - f.speed) / dt);
      slow = Math.min(slow, f.moved);
      prev = f.speed;
      Object.assign(s, f);
    }
    assert.equal(wet + touched, 0, `turning in from the ${turn < 0 ? 'left' : 'right'}: never wet, never touching`);
    assert.ok(decel <= 12, `no crash frame (${decel.toFixed(1)} m/s²)`);
    assert.ok(slow > 4, `it rolls on along the bank (slowest ${slow.toFixed(2)} m/s)`);
  }
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

import { yieldBrake, yieldSpeed, rimFree, rimSteer, pathCurvature, clipSteer, YIELD_GAP, YIELD_HARD_GAP, FIRM_DECEL, RIM_GAP } from './vehicle.ts';

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

test('give way: an animal stepping into the path close ahead — a steady firm brake, never a one-frame drop, still short of it (run 6 review: 6.00 → 4.81 in 16 ms)', () => {
  const dt = 1 / 60;
  for (const ahead of [3, 2.25, 1.6]) {                                    // metres from the bumper
    const j = jeep(0, 0, 0, 6);
    let minGap = Infinity, decel = 0, first = 0;
    const ree = { id: 'ree', x: 0, z: 1.9 + ahead + 0.56, r: 0.56 };
    // the steady brake that still stops it YIELD_HARD_GAP short: no gentler brake could
    const need = (6 * 6) / (2 * (ahead - YIELD_HARD_GAP));
    for (let t = 0; t < 4; t += dt) {
      const f = jeepStep(j, driveIntent(KEY(1), null), dt, JEEP_CAPS, world({ animals: [ree] }));
      const d = (j.speed - f.speed) / dt;
      if (t === 0) first = j.speed - f.speed;
      decel = Math.max(decel, d);
      Object.assign(j, f);
      minGap = Math.min(minGap, bodyGapTo(j, ree));
    }
    assert.ok(decel <= Math.max(FIRM_DECEL, need) * 1.05, `${ahead} m ahead: at most ${Math.max(FIRM_DECEL, need).toFixed(1)} m/s², the steady brake it needs (${decel.toFixed(2)})`);
    assert.ok(first <= Math.max(FIRM_DECEL, need) * 1.05 * dt, `${ahead} m ahead: the first frame takes only ${first.toFixed(2)} m/s off`);
    assert.ok(minGap >= YIELD_HARD_GAP - 0.03, `${ahead} m ahead: it stops ${minGap.toFixed(2)} m short, never touching`);
  }
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

test('a trunk it would only clip: the jeep eases round it at full speed, never touching; one dead ahead still stops it softly', () => {
  for (const lat of [1.0, 1.3, 1.45, -1.3]) {                              // the nose circle + trunk reach 1.5 m
    const tree = { x: lat, z: 20, r: 0.6 };
    let slow = Infinity, touched = 0;
    const j = hold(jeep(0, 0, 0, 6), KEY(1), 6, world({ solids: [tree] }), (f) => { slow = Math.min(slow, f.moved); if (f.contact) touched++; });
    assert.equal(touched, 0, `a trunk ${lat} m off its line: it moves over and never touches it (run 6: its corner scraped along it)`);
    assert.ok(slow > 5.99 && j.z > 30, `and keeps its full speed past it (slowest ${slow.toFixed(2)} m/s)`);
    assert.ok(Math.sign(j.x) === -Math.sign(lat) && Math.abs(j.x) < 3, `it moved over a little, away from it (x ${j.x.toFixed(2)})`);
  }
  const tree = { x: 0, z: 20, r: 0.6 };
  let solid = false;
  const j = hold(jeep(0, 0, 0, 6), KEY(1), 6, world({ solids: [tree] }), (f) => { if (f.brake === 'solid') solid = true; });
  assert.ok(j.moved < 0.05 && j.z < 20 - 0.6 - 1.9 + 0.05, `dead ahead it rests at the trunk (z ${j.z.toFixed(2)})`);
  assert.ok(solid, 'the dev hook says a solid braked it');
  // brushed without the bend (a trunk that steps into its line close by), it slides past keeping most of its speed
  assert.ok(contactSpeedCap(0.5, JEEP_CAPS.maxSpeed, 0.15) > JEEP_CAPS.maxSpeed, 'a glance costs no braking');
});

test('clipSteer: only a solid it would clip, ahead and near, bends it; the way away from it', () => {
  const at = (x: number, z: number) => clipSteer(0, 0, 0, 6, [{ x, z, r: 0.6 }], JEEP_BODY, JEEP_CAPS);
  assert.ok(at(1.2, 8) > 0 && at(-1.2, 8) < 0, 'on its left it bends right, on its right it bends left');
  assert.equal(at(0.2, 8), 0, 'met squarely: no bend (it stops softly instead)');
  assert.equal(at(2.5, 8), 0, 'passing well clear: no bend');
  assert.equal(at(1.2, -3), 0, 'behind it: no bend');
  assert.equal(at(1.2, 30), 0, 'far ahead: not yet');
  assert.ok(at(1.2, 5) > at(1.2, 10), 'the nearer, the firmer');
});

test('jeepStep: a zero frame changes nothing', () => {
  const j = jeep(3, 4, 1, 5);
  const f = jeepStep(j, driveIntent(KEY(1, 1), null), 0, JEEP_CAPS, world());
  assert.ok(f.x === 3 && f.z === 4 && f.heading === 1 && f.speed === 5 && f.moved === 0);
});

// ── run 6, review round 2: a turn key always frees it; the ven and the landmarks are no wall to crash into ──

import {
  combineBends, bendGain, WATER_GAP, CONTACT_STEER, solidBrake, deadEndCap, TRAP_ROOM,
  brakeCap, bodyDepth, type SolidBox,
} from './vehicle.ts';

/** A building's real footprint (as `boxObstacle` makes it: its circle is only the outer bound). */
const building = (x: number, z: number, hx: number, hz: number, rot: number): Solid => ({ x, z, r: Math.hypot(hx, hz) + 0.3, box: { hx, hz, rot, pad: 0.3 } as SolidBox });
/** The game's landmarks as the dev hook's obstacles() reads them. */
const ECODUCT = building(-70, 6, 7.74, 7.8, 1.6563016204731014);
const TOWER = building(37, -37, 2.772, 2.898, -Math.PI / 4);
const HIDE = building(26, -11, 1.725, 1.596, -1.1705556697609225);

/** Hold `keys` from a standing pose for up to `secs`: when it first rolls at 1 m/s (freed),
 *  and every standing frame's yaw (it must turn toward the key: left raises the yaw). */
function free(j: JeepState, keys: { fwd: number; turn: number }, w: JeepWorld, secs = 6) {
  const dt = 1 / 60;
  let freed = Infinity, still = 0, wrongWay = 0, flips = 0, prev = 0;
  for (let t = 0; t < secs && freed === Infinity; t += dt) {
    const f = jeepStep(j, driveIntent(keys, null), dt, JEEP_CAPS, w);
    const yaw = Math.atan2(Math.sin(f.heading - j.heading), Math.cos(f.heading - j.heading)) / dt;
    if (Math.abs(f.speed) < 0.05) { if (-keys.turn * yaw < 0.5) still++; }
    if (yaw * keys.turn > 1e-9) wrongWay++;
    if (prev * yaw < 0) flips++;
    prev = yaw;
    Object.assign(j, f);
    if (f.speed >= 1) freed = t + dt;
  }
  return { freed, still, wrongWay, flips };
}

test('combineBends: two bends that disagree meet in the middle, two that agree never add up past the strongest — never a swap of sides frame to frame', () => {
  assert.equal(combineBends(0.7, 0.4), 0.7, 'the same way: the strongest');
  assert.equal(combineBends(-0.7, -0.9), -0.9);
  assert.ok(near(combineBends(-0.77, 1), 0.23), 'the forest edge one way, a trunk the other: they meet in the middle');
  // continuous: sliding one bend through zero never jumps the result
  let prev = combineBends(-0.77, 0.5), jump = 0;
  for (let b = 0.5; b >= -0.5; b -= 0.01) { const c = combineBends(-0.77, b); jump = Math.max(jump, Math.abs(c - prev)); prev = c; }
  assert.ok(jump < 0.011, `no jump anywhere (largest step ${jump.toFixed(3)})`);
  assert.equal(bendGain(0, JEEP_CAPS), 0, 'standing: no bend acts');
  assert.equal(bendGain(0.9, JEEP_CAPS), 0, 'creeping under 1 m/s: none either');
  assert.ok(near(bendGain(1.5, JEEP_CAPS), 0.5) && bendGain(2, JEEP_CAPS) === 1, 'fading in to full at 2 m/s');
  assert.equal(CONTACT_STEER, STEER_AUTHORITY_MAX, 'a held jeep pivots at the same calm 0.6 rad/s it turns at full speed');
});

test('the review\'s lock by the ecoduct (seed 7, 27 s): from that exact pose W+A and W+D each free it within 3 s, turning the key\'s way every frame', () => {
  // the ecoduct's real footprint, and the forest edge 0.45 m ahead of its centre's limit
  for (const keys of [KEY(1, -1), KEY(1, 1)]) {
    const j = { ...jeep(-72.359, -6.535, -1.1981), braked: true };
    const r = free(j, keys, world({ solids: [ECODUCT] }), 4);
    assert.ok(r.freed <= 3, `${keys.turn < 0 ? 'W+A' : 'W+D'}: freed after ${r.freed.toFixed(2)} s`);
    assert.equal(r.still + r.wrongWay + r.flips, 0, `and it turned the key's way every frame (${r.still} standing still, ${r.wrongWay} the wrong way, ${r.flips} flips)`);
  }
  // the lead's repro, the ecoduct as its old 11.3 m circle: never locked either
  for (const keys of [KEY(1, -1), KEY(1, 1)]) {
    const j = { ...jeep(-72.359, -6.535, -1.1981), braked: true };
    const r = free(j, keys, world({ solids: [{ x: -70, z: 6, r: 11.3 }] }), 6);
    assert.ok(r.freed <= 4, `as a circle, ${keys.turn < 0 ? 'W+A' : 'W+D'}: freed after ${r.freed.toFixed(2)} s`);
    assert.equal(r.still + r.flips, 0, `never a standing frame without its turn, never a flip`);
  }
});

test('held for a ree with a juniper beside it (review trace k2), D keeps pivoting — the clip bend never cancels the key', () => {
  const zones = [[-15.56, -15.56], [15.56, -15.56], [24.5, -19], [8.27, 20.39]].map(([x, z]) => ({ x, z, r: 5.2 }));
  zones.push({ x: 32, z: 18, r: 3.2 });
  const h = 0.359;
  const ree = { id: 'ree', x: 26.34 + Math.sin(h) * 3.4, z: 16.97 + Math.cos(h) * 3.4, r: 0.56 };   // it waits in the path
  const w = world({ solids: [{ x: 24, z: 20, r: 1 }, { x: 30, z: 26, r: 1 }, { x: 16, z: 30, r: 1 }], zones, animals: [ree] });
  const j = { ...jeep(26.34, 16.97, h), braked: true };
  const dt = 1 / 60;
  let stalled = 0, held = 0, rolled = false;
  for (let t = 0; t < 3; t += dt) {
    const f = jeepStep(j, driveIntent(KEY(1, 1), null), dt, JEEP_CAPS, w);
    const yaw = Math.atan2(Math.sin(f.heading - j.heading), Math.cos(f.heading - j.heading)) / dt;
    if (Math.abs(f.speed) < 0.05) { held++; if (yaw > -0.5) stalled++; } // W+D: the yaw falls at the calm pivot
    Object.assign(j, f);
    if (f.speed > 1) { rolled = true; break; }
  }
  assert.ok(held > 30, `held for the ree for ${held} frames`);
  assert.equal(stalled, 0, `every held frame it pivoted right (${stalled} frames it did not)`);
  assert.ok(rolled, 'until it had swung clear of the ree and rolled off');
});

test('a sweep of standing starts — along the forest edge by the ecoduct, beside the watchtower and the bird-hide, 8 headings each: every turn key frees it', () => {
  const lim = 75 - 1.9;
  const solids = [ECODUCT, TOWER, HIDE];
  const spots: { x: number; z: number }[] = [];
  for (const a of [-1.8, -1.7, -1.62, -1.35, -1.25]) spots.push({ x: Math.sin(a) * (lim - 0.5), z: Math.cos(a) * (lim - 0.5) });
  for (const b of [TOWER, HIDE]) for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; spots.push({ x: b.x + Math.sin(a) * (b.r + 0.2), z: b.z + Math.cos(a) * (b.r + 0.2) }); }
  let n = 0, quickest = 0, slowest = 0, still = 0, flips = 0;
  for (const sp of spots) for (let k = 0; k < 8; k++) {
    const h = -Math.PI + (k / 8) * Math.PI * 2;
    if (bodyDepth(sp.x, sp.z, h, JEEP_BODY, solids) > 0 || Math.hypot(sp.x, sp.z) > lim + 1e-9) continue;
    const t: number[] = [];
    for (const keys of [KEY(1, -1), KEY(1, 1)]) {
      const r = free({ ...jeep(sp.x, sp.z, h), braked: true }, keys, world({ solids }), 8);
      t.push(r.freed); still += r.still; flips += r.flips; n++;
    }
    quickest = Math.max(quickest, Math.min(...t)); slowest = Math.max(slowest, ...t);
  }
  assert.ok(n >= 80, `${n} starts`);
  assert.equal(still + flips, 0, `every standing frame a held key turned it its way (${still} did not, ${flips} flips)`);
  assert.ok(quickest <= 3, `from every start one of the keys frees it within 3 s (worst ${quickest.toFixed(2)} s)`);
  // the other key has to swing it the long way round at the calm 0.6 rad/s pivot (up to 180°)
  assert.ok(slowest <= 6, `and either key within 6 s (worst ${slowest.toFixed(2)} s, the long way round)`);
});

test('a building is its real footprint: head-on the jeep stops at the ecoduct\'s wall, not 3.5 m out at its circle', () => {
  // along the ecoduct's own x axis toward its middle, from 20 m out
  const c = Math.cos(ECODUCT.box!.rot), sn = Math.sin(ECODUCT.box!.rot);
  const out = { x: c, z: -sn };                                  // its local +x in the world
  const j = jeep(ECODUCT.x + out.x * 20, ECODUCT.z + out.z * 20, Math.atan2(-out.x, -out.z));
  hold(j, KEY(1), 8, world({ solids: [ECODUCT] }));
  const wall = ECODUCT.box!.hx + ECODUCT.box!.pad;               // its wall (with the pad) from its middle
  const bumper = Math.hypot(j.x - ECODUCT.x, j.z - ECODUCT.z) - 1.9;
  // (a wall as wide as the ecoduct is a dead end: it stops with room to swing round)
  assert.ok(j.speed === 0 && bumper - wall >= 0.05 && bumper - wall < 1.5, `it stands ${(bumper - wall).toFixed(2)} m from the wall (the circle stood ${(ECODUCT.r - wall).toFixed(1)} m out)`);
});

// ── run 6, review round 3: a wall met at a slant is driven along, never crawled along ──

/** Hold `keysAt(frame)` for `secs` under `caps`: the longest run of frames in contact at a
 *  crawl (0.02-1 m/s), the frames at rest pressed against something, and the slowest it rolled
 *  while `beside(f)` after its first second (the forest edge's own stop left out). */
function crawlRun(
  j: JeepState, w: JeepWorld, secs: number, keysAt: (i: number) => { fwd: number; turn: number },
  caps = JEEP_CAPS, beside: (f: JeepState) => boolean = () => false,
) {
  let run = 0, crawl = 0, restContact = 0, slowBeside = Infinity;
  for (let i = 0; i < 60 * secs; i++) {
    const f = jeepStep(j, driveIntent(keysAt(i), null), 1 / 60, caps, w);
    if (f.contact && Math.abs(f.moved) > 0.02 && Math.abs(f.moved) < 1) crawl = Math.max(crawl, ++run); else run = 0;
    if (f.contact && Math.abs(f.moved) < 0.02) restContact++;
    if (i >= 60 && f.brake !== 'edge' && beside(f)) slowBeside = Math.min(slowBeside, f.moved);
    Object.assign(j, f);
  }
  return { crawl: crawl / 60, restContact, slowBeside };
}

test('a building\'s long wall met at a slant (the ecoduct, 30°, 45° and 60° off its line, W alone): it rolls along it at 3 m/s or more, or comes to rest clear of it — never a crawl along it (run 6 review round 3: 0.23 m/s for 12 s)', () => {
  const b = ECODUCT.box!, c = Math.cos(b.rot), sn = Math.sin(b.rot);
  const toW = (lx: number, lz: number) => ({ x: ECODUCT.x + lx * c + lz * sn, z: ECODUCT.z - lx * sn + lz * c });
  const dirW = (lx: number, lz: number) => ({ x: lx * c + lz * sn, z: -lx * sn + lz * c });
  const gapTo = (p: JeepState): number => {
    const dx = p.x - ECODUCT.x, dz = p.z - ECODUCT.z, lx = dx * c - dz * sn, lz = dx * sn + dz * c;
    const qx = Math.abs(lx) - b.hx, qz = Math.abs(lz) - b.hz;
    return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - b.pad;
  };
  const w = world({ solids: [ECODUCT] });
  // its long walls run west–east (its local z), from the forest edge (west) to its open end (east)
  for (const caps of [JEEP_CAPS, JEEP_CAPS_REDUCED]) for (const wall of [1, -1]) for (const deg of [30, 45, 60]) for (const east of [1, -1]) for (const v0 of [caps.maxSpeed, 0]) {
    const th = (deg * Math.PI) / 180, dl = [-wall * Math.sin(th), east * Math.cos(th)];
    const back = v0 ? (east > 0 ? 6 : 10) : 4;                           // run-in (m) along its path
    const P = toW(wall * (b.hx + b.pad) - dl[0] * back, (east > 0 ? 7 : 5) - dl[1] * back), D = dirW(dl[0], dl[1]);
    const j = jeep(P.x, P.z, Math.atan2(D.x, D.z), v0);
    const r = crawlRun(j, w, 8, () => KEY(1), caps, (f) => gapTo(f) < 2.5);
    const what = `${caps === JEEP_CAPS ? '' : 'reduced motion, '}${wall > 0 ? 'south' : 'north'} wall at ${deg}° heading ${east > 0 ? 'east' : 'west'} from ${v0} m/s`;
    assert.ok(r.crawl <= 0.5, `${what}: never a crawl along it (longest ${r.crawl.toFixed(2)} s)`);
    assert.equal(r.restContact, 0, `${what}: never at rest pressed against it`);
    if (east > 0) assert.equal(j.speed, caps.maxSpeed, `${what}: it rolled on past its end at full speed (${j.speed.toFixed(2)} m/s)`);
    else assert.ok(j.speed === 0 && Math.hypot(j.x, j.z) > 72 && bodyDepth(j.x, j.z, j.heading, JEEP_BODY, w.walls) === 0,
      `${what}: it rolled along it to the forest edge and rests there, clear of the wall (r ${Math.hypot(j.x, j.z).toFixed(1)})`);
    if (v0 > 0 && caps === JEEP_CAPS) assert.ok(r.slowBeside >= 3, `${what}: beside it, never below 3 m/s (slowest ${r.slowBeside.toFixed(2)})`);
  }
  // the review's line (rv-eco): at the north wall from the east-north-east at full speed, W alone
  const j = jeep(-58.4, 19.1, -2.013, 6);
  let contact = 0, low = Infinity;
  hold(j, KEY(1), 8, w, (f) => { if (f.contact) contact++; if (f.brake !== 'edge') low = Math.min(low, f.moved); });
  assert.equal(contact, 0, 'the review\'s line: it bends along the wall without touching it');
  assert.ok(low > 5.9 && j.speed === 0 && Math.hypot(j.x, j.z) > 72, `and holds its speed (slowest ${low.toFixed(2)} m/s) until the forest edge stops it in the corner`);
});

test('the bird-hide\'s corner (review seed 11: a short A tap, then W alone, crawled 3.8 s along it): it swings round the corner and drives on', () => {
  const w = world({ solids: [HIDE], zones: [{ x: 24.5, z: -19, r: 5.2 }] });   // the hide, and the ven marker's zone beside it
  for (const tap of [0, 6, 12, 18, 24, 36]) {
    const j = jeep(29.907, -13.107, -0.559, 3);
    const r = crawlRun(j, w, 6, (i) => (i < tap ? KEY(1, -1) : KEY(1)));
    assert.ok(r.crawl <= 0.5 && r.restContact === 0, `A for ${tap} frames: no crawl along it (longest ${r.crawl.toFixed(2)} s)`);
    assert.equal(j.speed, 6, `A for ${tap} frames: it drove on at full speed (${j.speed.toFixed(2)} m/s)`);
  }
});

test('a trunk touched at a slant by a slow jeep: it turns along it and drives on — never a crawl round the bark', () => {
  // standing or creeping with its nose beside a trunk, 20°–60° off the line to its middle
  for (const deg of [20, 35, 50, 60]) for (const side of [1, -1]) for (const v0 of [0, 0.8]) {
    const th = (deg * Math.PI) / 180, tree = { x: 0, z: 0, r: 0.6 };
    const d = 0.6 + 0.9 + 0.05;                                         // its nose circle just clear of the bark
    const nose = { x: -Math.sin(side * th) * d, z: -Math.cos(side * th) * d };   // heading +z, the trunk ahead of the nose at `deg`
    const j = jeep(nose.x, nose.z - 1, 0, v0);
    const r = crawlRun(j, world({ solids: [tree] }), 4, () => KEY(1));
    assert.ok(r.crawl <= 0.5 && r.restContact === 0, `${deg}° ${side > 0 ? 'left' : 'right'} from ${v0} m/s: no crawl round it (longest ${r.crawl.toFixed(2)} s, ${r.restContact} frames at rest against it)`);
    assert.ok(j.speed === 6 && j.z > 4, `${deg}° ${side > 0 ? 'left' : 'right'} from ${v0} m/s: it drove on past it (${j.speed.toFixed(2)} m/s)`);
  }
  // a trunk beside its middle, a keep-out zone ahead (the squeeze by the wildcamera marker): held
  // there, W alone never swings its tail round onto the trunk — it stands clear
  const tree = { x: 16.906847500739847, z: -7.869907807436085, r: 0.774 }, zone = { x: 15.556349186104047, z: -15.556349186104043, r: 5.2 };
  const j = { ...jeep(18.127242198412485, -9.087615810979013, -2.2674510227038738), braked: true };   // where a scout's drive left it
  const r = crawlRun(j, world({ solids: [tree], zones: [zone] }), 3, () => KEY(1));
  assert.equal(r.restContact, 0, `held beside a trunk: never swung onto it (${r.restContact} frames at rest against it)`);
});

test('turning at full speed toward a trunk the straight look misses: it eases round or slows smoothly — never a one-frame drop (review P3)', () => {
  // a right turn at 6 m/s (a ~10 m circle round (-10, 0)): trunks on and beside its arc
  for (const phi of [0.5, 0.7, 0.9]) for (const off of [0, 0.8, -0.8]) {
    const R = 10 + off;
    const tree = { x: -10 + R * Math.cos(phi), z: R * Math.sin(phi), r: 0.6 };
    const j = jeep(0, 0, 0, 6);
    let decel = 0, prev = 6, scrape = 0;
    hold(j, KEY(1, 1), 3, world({ solids: [tree] }), (f) => {
      if (prev > 1.5) decel = Math.max(decel, (prev - f.speed) * 60);
      prev = f.speed;
      if (f.contact) scrape++;
    });
    assert.ok(decel <= 12, `a trunk ${off} m off the arc at ${phi} rad: at most ${decel.toFixed(1)} m/s², never a crash frame`);
    assert.ok(scrape <= 32, `and at most a brief slow slide round it (${scrape} contact frames)`);
  }
});

test('a gap narrower than the jeep (a trunk beside a keep-out zone): it stops short of the squeeze, never wedges in, and a turn key takes it out', () => {
  // the tree beside the wildcamera marker's zone (the review's seed 7 wedge): 1.7 m between them
  const zone = { x: 15.56, z: -15.56, r: 5.2 }, tree = { x: 16.91, z: -7.87, r: 0.77 };
  const w = world({ solids: [tree], zones: [zone] });
  for (const y of [-9.2, -9.5]) {
    const j = jeep(8, y, Math.PI / 2 + 0.05, 0);                  // heading east along the gap
    let decel = 0, prev = 0, touchedFast = 0;
    hold(j, KEY(1), 5, w, (f) => { if (prev > 1.5) decel = Math.max(decel, (prev - f.speed) * 60); if (f.contact && prev > 1.5) touchedFast++; prev = f.speed; });
    assert.ok(j.speed === 0, `from z ${y}: it stands before the squeeze`);
    assert.ok(bodyDepth(j.x, j.z, j.heading, JEEP_BODY, w.walls) < 0.02, `from z ${y}: not wedged in (${bodyDepth(j.x, j.z, j.heading, JEEP_BODY, w.walls).toFixed(3)} m deep)`);
    assert.equal(touchedFast, 0, `from z ${y}: it touches a side only at a crawl, if at all`);
    assert.ok(decel <= 12, `from z ${y}: a smooth stop (${decel.toFixed(1)} m/s²)`);
    for (const keys of [KEY(1, -1), KEY(1, 1)]) {
      const r = free({ ...j }, keys, w, 8);
      assert.ok(r.freed <= 6 && r.still === 0, `from z ${y}, ${keys.turn < 0 ? 'W+A' : 'W+D'} turns it and takes it away (${r.freed.toFixed(2)} s)`);
    }
  }
});

test('a dead end (a pocket between the water, a keep-out zone and a building, like the one by the bird-hide): it stops with room to swing round, and swings out', () => {
  // walls on three sides: a box ahead and two trunks a little wider than the jeep on either side
  const back = building(0, 30, 6, 0.5, 0);
  const w = world({ solids: [back, { x: -2.6, z: 24, r: 0.8 }, { x: 2.6, z: 24, r: 0.8 }, { x: -2.8, z: 20, r: 0.8 }, { x: 2.8, z: 20, r: 0.8 }] });
  const j = jeep(0, 0, 0, 0);
  hold(j, KEY(1), 10, w);
  const room = 30 - 0.5 - 0.3 - (j.z + 1.9);
  assert.ok(j.speed === 0 && room >= 0.8, `it stopped with ${room.toFixed(2)} m before the back wall, between the trunks' mouth and the wall`);
  assert.ok(deadEndCap(j.x, j.z, j.heading, 0, JEEP_CAPS, JEEP_BODY, w.walls, 73.1, undefined) < 2, 'held by the dead end');
  const r = free({ ...j }, KEY(1, 1), w, 10);
  assert.ok(r.freed < 10 && r.still === 0, `W+D swings it round and out (${r.freed.toFixed(2)} s, never standing still)`);
});

test('brakeCap: the gentle stop, a steady firmer one when something appears close, and never a one-frame drop unless about to touch', () => {
  assert.ok(near(brakeCap(10.5, 0.5, 3), Math.sqrt(60)), 'the gentle stop at 3 m/s²');
  const dt = 1 / 60;
  const steady = brakeCap(3, 1, 3, 6, dt, 0.8);                  // 6 m/s, 3 m ahead: 36 / (2·2) = 9 > 8 → the hard stop at 0.8
  assert.ok(near(6 - steady, (36 / (2 * 2.2)) * dt, 1e-9), `it brakes at the steady ${((6 - steady) / dt).toFixed(1)} m/s² that stops it 0.8 m short`);
  assert.ok(brakeCap(2, 1, 3, 2, dt, 0.8) === Math.sqrt(6), 'slower than the gentle stop: that is its cap');
  assert.equal(brakeCap(0.05, 0.5, 3, 4, dt, 0.1), 0, 'about to touch: it stops');
  const s = solidBrake(0, 0, 0, 1, 0, JEEP_BODY, [{ x: 0, z: 5, r: 0.6 }], 6, 6);
  assert.ok(s.cap < 6 && near(s.free, 5 - 0.6 - 1.9, 0.01), `a trunk dead ahead: the brake sees it ${s.free.toFixed(2)} m off`);
});
