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
  screenVector,
  toWorld,
  resolveInput,
  JOYSTICK_DEADZONE,
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
