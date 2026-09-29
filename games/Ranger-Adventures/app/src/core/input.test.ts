/**
 * input.test.ts — seeded unit test for the pure movement-input core (W1.1).
 * Run: `node --experimental-strip-types src/core/input.test.ts`
 *
 * Pins the four things W1.1's acceptance names: key mapping (arrows + WASD),
 * screen-vector math (cancel + diagonal normalization + joystick deadzone),
 * the camera-relative world transform, and wrap-around (yaw ± 2π identical).
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  keyToMove,
  isInteractKey,
  screenVector,
  toWorld,
  resolveInput,
  joystickVector,
  joystickVisible,
  JOYSTICK_DEADZONE,
  tankAxes,
  turnStep,
  approachAngle,
  stickBackpedal,
  stickHeading,
  wrapPi,
  TURN_RATE,
  TURN_DECEL_TAU,
  isRunKey,
  rampSpeed,
  stickWalkShare,
  stickRun,
  WALK_SPEED,
  RUN_SPEED,
  SPEED_OMEGA,
  STICK_WALK_FULL,
  STICK_RUN_ON,
  STICK_RUN_OFF,
  type MoveKey,
} from './input.ts';

const EPS = 1e-9;
const near = (a: number, b: number, msg?: string) =>
  assert.ok(Math.abs(a - b) < 1e-9, `${msg ?? ''} expected ${b}, got ${a}`);
const held = (...keys: MoveKey[]): ReadonlySet<MoveKey> => new Set(keys);
const mag = (v: { x: number; z: number }) => Math.hypot(v.x, v.z);

/* ---- keyToMove: arrows + WASD → four directions, everything else null ---- */

test('arrows and physical WASD map to the same four directions', () => {
  assert.equal(keyToMove('ArrowUp'), 'up');
  assert.equal(keyToMove('KeyW'), 'up');
  assert.equal(keyToMove('ArrowDown'), 'down');
  assert.equal(keyToMove('KeyS'), 'down');
  assert.equal(keyToMove('ArrowLeft'), 'left');
  assert.equal(keyToMove('KeyA'), 'left');
  assert.equal(keyToMove('ArrowRight'), 'right');
  assert.equal(keyToMove('KeyD'), 'right');
});

test('non-movement keys map to null (no accidental capture)', () => {
  assert.equal(keyToMove('Space'), null);
  assert.equal(keyToMove('Enter'), null);
  assert.equal(keyToMove('KeyQ'), null);
  assert.equal(keyToMove(''), null);
});

/* ---- isInteractKey: Space/Enter fire the proximity action (W1.4) ---- */

test('Space and Enter are interact keys; movement keys are not', () => {
  assert.equal(isInteractKey('Space'), true);
  assert.equal(isInteractKey('Enter'), true);
  assert.equal(isInteractKey('NumpadEnter'), true);
  // movement + arbitrary keys must never trigger the interact action
  assert.equal(isInteractKey('ArrowUp'), false);
  assert.equal(isInteractKey('KeyW'), false);
  assert.equal(isInteractKey('KeyE'), false);
  assert.equal(isInteractKey(''), false);
});

test('interact keys and movement keys are disjoint', () => {
  for (const code of ['Space', 'Enter', 'NumpadEnter']) {
    assert.equal(keyToMove(code), null, `${code} must not also be a movement key`);
  }
});

/* ---- screenVector: axis math, cancellation, normalization, deadzone ---- */

test('a single key gives a unit cardinal in screen space', () => {
  assert.deepEqual(screenVector(held('up'), null), { x: 0, y: 1 });
  assert.deepEqual(screenVector(held('down'), null), { x: 0, y: -1 });
  assert.deepEqual(screenVector(held('right'), null), { x: 1, y: 0 });
  assert.deepEqual(screenVector(held('left'), null), { x: -1, y: 0 });
});

test('opposing keys cancel to zero', () => {
  assert.deepEqual(screenVector(held('up', 'down'), null), { x: 0, y: 0 });
  assert.deepEqual(screenVector(held('left', 'right'), null), { x: 0, y: 0 });
  assert.deepEqual(screenVector(held('up', 'down', 'left', 'right'), null), { x: 0, y: 0 });
});

test('a diagonal is normalized — no faster than a cardinal', () => {
  const v = screenVector(held('up', 'right'), null);
  near(Math.hypot(v.x, v.y), 1, 'diagonal magnitude');
  near(v.x, Math.SQRT1_2, 'diagonal x');
  near(v.y, Math.SQRT1_2, 'diagonal y');
});

test('joystick below the deadzone is ignored; above it, it drives', () => {
  const tiny = JOYSTICK_DEADZONE / 2;
  assert.deepEqual(screenVector(held(), { x: tiny, y: 0 }), { x: 0, y: 0 });
  const v = screenVector(held(), { x: 0.5, y: 0 });
  near(v.x, 0.5, 'joystick passes through');
  near(v.y, 0, 'joystick y');
});

test('keys + joystick together never exceed full speed', () => {
  const v = screenVector(held('up', 'right'), { x: 1, y: 1 });
  near(Math.hypot(v.x, v.y), 1, 'clamped to unit magnitude');
});

/* ---- toWorld: the camera-relative transform ---- */

test('at camera yaw 0, forward → −z and right → +x (matches the default cam)', () => {
  const fwd = toWorld({ x: 0, y: 1 }, 0);
  near(fwd.x, 0, 'fwd x');
  near(fwd.z, -1, 'fwd z');
  const rgt = toWorld({ x: 1, y: 0 }, 0);
  near(rgt.x, 1, 'right x');
  near(rgt.z, 0, 'right z');
  const back = toWorld({ x: 0, y: -1 }, 0);
  near(back.z, 1, 'back → +z');
  const left = toWorld({ x: -1, y: 0 }, 0);
  near(left.x, -1, 'left → −x');
});

test('a rotated camera (yaw π/2) rotates the world move with it', () => {
  // camera turned 90° CCW about +y: screen-forward now points to world −x.
  const fwd = toWorld({ x: 0, y: 1 }, Math.PI / 2);
  near(fwd.x, -1, 'fwd → −x');
  near(fwd.z, 0, 'fwd z');
  // screen-right now points to world −z.
  const rgt = toWorld({ x: 1, y: 0 }, Math.PI / 2);
  near(rgt.x, 0, 'right x');
  near(rgt.z, -1, 'right → −z');
});

test('the transform preserves magnitude (rotation, not scaling)', () => {
  for (const yaw of [0, 0.3, 1.1, -2.7, Math.PI]) {
    const v = toWorld({ x: Math.SQRT1_2, y: Math.SQRT1_2 }, yaw);
    near(mag(v), 1, `magnitude at yaw ${yaw}`);
  }
});

test('wrap-around: yaw and yaw ± 2π give the identical move', () => {
  const s = { x: 0.4, y: 0.9 };
  for (const yaw of [0, 0.7, -1.9, 2.5]) {
    const base = toWorld(s, yaw);
    const plus = toWorld(s, yaw + 2 * Math.PI);
    const minus = toWorld(s, yaw - 2 * Math.PI);
    assert.ok(Math.abs(base.x - plus.x) < EPS && Math.abs(base.z - plus.z) < EPS, `+2π at ${yaw}`);
    assert.ok(Math.abs(base.x - minus.x) < EPS && Math.abs(base.z - minus.z) < EPS, `−2π at ${yaw}`);
  }
});

/* ---- resolveInput: end-to-end + purity ---- */

test('resolveInput composes screenVector then toWorld', () => {
  const keys = held('up');
  const out = resolveInput(keys, null, 0);
  near(out.x, 0, 'x');
  near(out.z, -1, 'z');
  // no intent → zero vector (±0 is fine — a resting stick must not creep)
  const idle = resolveInput(held(), null, 1.23);
  near(idle.x, 0, 'idle x');
  near(idle.z, 0, 'idle z');
});

test('resolveInput never mutates its inputs (pure)', () => {
  const keys = held('up', 'right');
  const joystick = { x: 0.3, y: 0.2 };
  const before = { size: keys.size, jx: joystick.x, jy: joystick.y };
  resolveInput(keys, joystick, 0.9);
  assert.equal(keys.size, before.size);
  assert.equal(joystick.x, before.jx);
  assert.equal(joystick.y, before.jy);
});

/* ---- joystickVector: drag pixels → clamped screen-space intent ---- */

test('joystickVector maps a straight-up drag to full forward', () => {
  // screen-up is dy < 0; forward is +y. A drag to the ring edge saturates at 1.
  const v = joystickVector(0, -40, 40);
  near(v.x, 0, 'x');
  near(v.y, 1, 'y forward');
});

test('joystickVector clamps a shove past the ring to unit magnitude', () => {
  const v = joystickVector(120, 0, 40);           // 3× the radius, straight right
  near(Math.hypot(v.x, v.y), 1, 'saturated magnitude');
  near(v.x, 1, 'x right');
  near(v.y, 0, 'y');
});

test('joystickVector keeps partial drags proportional (no snapping)', () => {
  const v = joystickVector(20, 0, 40);            // half a radius right
  near(v.x, 0.5, 'half deflection');
  near(v.y, 0, 'y');
});

test('joystickVector is safe at the centre and with a zero radius', () => {
  const c = joystickVector(0, 0, 40);
  near(c.x, 0, 'centre x'); near(c.y, 0, 'centre y');
  const z = joystickVector(10, 10, 0);            // degenerate radius → no intent
  near(z.x, 0, 'zero-radius x'); near(z.y, 0, 'zero-radius y');
});

test('joystickVector feeds screenVector: a rested-ish thumb stays under the deadzone', () => {
  const tiny = joystickVector(2, 0, 40);          // magnitude 0.05 < JOYSTICK_DEADZONE
  assert.ok(Math.hypot(tiny.x, tiny.y) < JOYSTICK_DEADZONE, 'tiny drag below deadzone');
  const out = screenVector(new Set<MoveKey>(), tiny);
  near(out.x, 0, 'deadzone drops x'); near(out.y, 0, 'deadzone drops y');
});

/* ---- joystickVisible: auto follows the pointer, aan/uit override ---- */

test('joystickVisible: auto follows the coarse-pointer flag', () => {
  assert.equal(joystickVisible('auto', true), true, 'touch → shown');
  assert.equal(joystickVisible('auto', false), false, 'laptop → hidden');
});

test('joystickVisible: aan/uit override the pointer either way', () => {
  assert.equal(joystickVisible('aan', false), true, 'aan on a fine pointer');
  assert.equal(joystickVisible('uit', true), false, 'uit on a coarse pointer');
});

/* ---- steering (wave 2): tank keys, eased turn, latched stick ---- */

test('tankAxes: Left/Right turn, Up/Down walk; opposing keys cancel', () => {
  assert.deepEqual(tankAxes(held('up')), { turn: 0, fwd: 1 });
  assert.deepEqual(tankAxes(held('down', 'left')), { turn: -1, fwd: -1 });
  assert.deepEqual(tankAxes(held('left', 'right')), { turn: 0, fwd: 0 });
  // a diagonal is NOT normalised: Up+Right walks full speed while turning full rate
  assert.deepEqual(tankAxes(held('up', 'right')), { turn: 1, fwd: 1 });
});

test('turnStep eases up to TURN_RATE and never past it', () => {
  let v = 0;
  let maxV = 0;
  for (let i = 0; i < 120; i++) { v = turnStep(v, 1, 1 / 60); maxV = Math.max(maxV, v); }
  assert.ok(maxV <= TURN_RATE + 1e-9, `never faster than TURN_RATE (${maxV})`);
  assert.ok(v > TURN_RATE * 0.99, 'reaches the calm top rate');
  // the first frame is a gentle start, not a jump to full rate
  assert.ok(turnStep(0, 1, 1 / 60) < TURN_RATE * 0.2, 'eases in');
});

test('turnStep: after release the turn stops within a few degrees', () => {
  let v = TURN_RATE;
  let travel = 0;
  for (let i = 0; i < 120; i++) { v = turnStep(v, 0, 1 / 60); travel += Math.abs(v) / 60; }
  assert.equal(v, 0, 'comes to a full stop');
  const deg = (travel * 180) / Math.PI;
  assert.ok(deg < 8, `overshoot after release is ${deg.toFixed(1)}° (want < 8°)`);
  assert.ok(deg < ((TURN_RATE * TURN_DECEL_TAU) * 180) / Math.PI + 1, 'bounded by rate × decel tau');
});

test('turnStep is frame-rate independent while easing', () => {
  let a = 0; for (let i = 0; i < 30; i++) a = turnStep(a, 1, 1 / 60);
  let b = 0; for (let i = 0; i < 60; i++) b = turnStep(b, 1, 1 / 120);
  assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);
  assert.equal(turnStep(0.5, 1, 0), 0.5, 'a paused frame is a no-op');
});

test('approachAngle takes the short way and never overshoots', () => {
  near(approachAngle(0, 0.5, 0.1), 0.1);
  near(approachAngle(0, 0.05, 0.1), 0.05);
  // across ±π: from 3.0 toward −3.0 is +0.28 the short way
  const a = approachAngle(3.0, -3.0, 0.1);
  near(wrapPi(a - 3.0), 0.1, 'steps forward across π');
});

test('stickHeading: up = into the screen, right = a quarter turn right', () => {
  const bearing = Math.PI; // the spawn view: looking down −z
  near(stickHeading({ x: 0, y: 1 }, bearing), Math.PI, 'up');
  // heading π/2 walks +x = screen right at bearing π
  near(stickHeading({ x: 1, y: 0 }, bearing), Math.PI / 2, 'right');
  near(Math.sin(stickHeading({ x: -1, y: 0 }, bearing)), -1, 'left walks −x');
  // a thumb 6° off straight up still walks straight
  near(stickHeading({ x: Math.sin(0.1), y: Math.cos(0.1) }, bearing), Math.PI, 'snap');
});

test('stickBackpedal only for a stick pulled (nearly) straight down', () => {
  assert.equal(stickBackpedal({ x: 0, y: -1 }), true);
  assert.equal(stickBackpedal({ x: 0.3, y: -0.9 }), true);
  assert.equal(stickBackpedal({ x: 1, y: -0.2 }), false, 'sideways is a walk that way');
  assert.equal(stickBackpedal({ x: 0, y: 1 }), false);
});

/* ---- run 6: walk and run ---- */

test('either Shift is the run key; it never moves him (no direction)', () => {
  assert.equal(isRunKey('ShiftLeft'), true);
  assert.equal(isRunKey('ShiftRight'), true);
  assert.equal(isRunKey('KeyR'), false);
  assert.equal(keyToMove('ShiftLeft'), null);
  assert.equal(isInteractKey('ShiftLeft'), false);
});

test('the speeds: a brisk walk and a real run, both inside the design bands', () => {
  assert.ok(WALK_SPEED >= 2.1 && WALK_SPEED <= 2.5, `walk ${WALK_SPEED}`);
  assert.ok(RUN_SPEED >= 3.8 && RUN_SPEED <= 4.6, `run ${RUN_SPEED}`);
});

test('rampSpeed eases in ~0.3 s: no kick, no overshoot, lands exactly on 0, frame-rate independent', () => {
  let s = { v: WALK_SPEED, a: 0 };
  const dt = 1 / 60;
  let t = 0, maxJump = 0;
  const first = rampSpeed(s, RUN_SPEED, dt);
  assert.ok(first.v - s.v < 0.08, `a gentle start (${(first.v - s.v).toFixed(3)} m/s in the first frame)`);
  while (s.v < WALK_SPEED + 0.95 * (RUN_SPEED - WALK_SPEED)) {
    const n = rampSpeed(s, RUN_SPEED, dt);
    maxJump = Math.max(maxJump, n.v - s.v);
    s = n; t += dt;
  }
  assert.ok(t > 0.25 && t < 0.4, `walk → run in ${t.toFixed(2)} s`);
  assert.ok(maxJump < 0.2, `never a pop (largest frame step ${maxJump.toFixed(3)} m/s)`);
  for (let i = 0; i < 120; i++) { s = rampSpeed(s, RUN_SPEED, dt); assert.ok(s.v <= RUN_SPEED + 1e-9, 'no overshoot'); }
  for (let i = 0; i < 120; i++) { s = rampSpeed(s, 0, dt); assert.ok(s.v >= -1e-9, 'a stop never swings back'); }
  assert.deepEqual(s, { v: 0, a: 0 }, 'a stop lands on 0');
  const at = (fps: number): number => { let x = { v: 0, a: 0 }; for (let i = 0; i < fps / 10; i++) x = rampSpeed(x, WALK_SPEED, 1 / fps); return x.v; };
  assert.ok(Math.abs(at(30) - at(120)) < 1e-6, 'the same speed at 30 and 120 fps');
  assert.deepEqual(rampSpeed({ v: 1.5, a: 2 }, 3, 0), { v: 1.5, a: 2 }, 'dt 0 is a no-op');
  assert.ok(SPEED_OMEGA > 10 && SPEED_OMEGA < 20);
});

test('the stick: a partial push walks slower, full walk from ~80 %, never negative', () => {
  assert.equal(stickWalkShare(0), 0);
  assert.ok(Math.abs(stickWalkShare(0.6) - 0.6 / STICK_WALK_FULL) < 1e-9);
  assert.equal(stickWalkShare(STICK_WALK_FULL), 1);
  assert.equal(stickWalkShare(1), 1);
  assert.equal(stickWalkShare(-0.3), 0);
});

test('the stick runs at its rim, with hysteresis (no flicker on the rim)', () => {
  assert.equal(stickRun(0.6, false), false);
  assert.equal(stickRun(0.9, false), false, 'not yet at the rim');
  assert.equal(stickRun(STICK_RUN_ON, false), true, 'the rim runs');
  assert.equal(stickRun(0.9, true), true, 'a thumb easing off a little keeps running');
  assert.equal(stickRun(STICK_RUN_OFF - 0.01, true), false, 'well back from the rim walks');
  assert.ok(STICK_RUN_OFF < STICK_RUN_ON && STICK_WALK_FULL < STICK_RUN_OFF);
});
