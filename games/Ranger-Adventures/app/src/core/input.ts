/**
 * input.ts — the pure movement-input core (WORLD-PLAN §3.2 / W1.1).
 *
 * One job: turn the raw player intent (which movement keys are held + the
 * virtual-joystick vector) plus the current camera yaw into ONE normalized
 * ground-plane move vector `{x, z}` in WORLD space, ready for the velocity
 * branch of `World.update` to feed straight into `resolveMove`. It is the
 * single place the "camera-relative" rule lives, so both keyboard and joystick
 * agree and the follow-cam (W1.5) can rotate without the controls drifting.
 *
 * THREE-free, DOM-free, deterministic — the DOM listeners (keydown/keyup,
 * pointer drag) live in a thin `attachInput` layer added in W1.2/W1.3; this
 * module stays in the pure-core unit-test spine.
 *
 * Coordinate conventions (verified against the live code, not assumed):
 * - Facing: `World` sets `ranger.rotation.y = atan2(moveX, moveZ)`
 *   (World.ts) and `Wayfinding.bearing` uses forward `(sin y, cos y)` — so a
 *   heading yaw θ points along `(sin θ, cos θ)` in `(x, z)`.
 * - Camera: default offset `(0, 3.4, 6.2)` sits behind the ranger on +z and
 *   `lookAt`s him, i.e. it looks down −z. So at camera yaw 0 the screen
 *   "forward / into the screen" is world −z and screen-right is world +x.
 *   A camera yaw θ (`camera.rotation.y`, W1.5) rotates that basis about +y:
 *     ground-forward = (−sin θ, −cos θ),  right = (cos θ, −sin θ).
 *   Because the transform is pure sin/cos it is naturally periodic — a yaw and
 *   yaw ± 2π give the identical move (the wrap-around the tests pin).
 *
 * The returned vector has magnitude in [0, 1] (0 = no intent). `World.update`
 * multiplies it by speed·dt to get the per-frame want-delta, so a diagonal must
 * never travel faster than a straight line — hence the magnitude clamp.
 */

/** A held movement direction, decoupled from the physical key that produced it. */
export type MoveKey = 'up' | 'down' | 'left' | 'right';

/** Screen-space intent: `x` = right (+) / left (−), `y` = forward (+) / back (−). */
export interface StickVector {
  x: number;
  y: number;
}

/** A ground-plane move vector in WORLD meters-space, magnitude ≤ 1. */
export interface WorldMove {
  x: number;
  z: number;
}

/**
 * Below this magnitude the joystick reads as "not touched" — a resting thumb or
 * a pixel of jitter must not creep the ranger. Keyboard axes are exact 0/±1 so
 * they skip the deadzone entirely.
 */
export const JOYSTICK_DEADZONE = 0.12;

/**
 * Map a `KeyboardEvent.code` to a movement direction, or null for any other
 * key. Both the arrow cluster and the physical WASD block drive the same four
 * directions (§3.2: "ArrowUp/Down/Left/Right + WASD"). `code` is layout-
 * position based, so WASD stays under the same fingers regardless of locale.
 */
export function keyToMove(code: string): MoveKey | null {
  switch (code) {
    case 'ArrowUp':
    case 'KeyW':
      return 'up';
    case 'ArrowDown':
    case 'KeyS':
      return 'down';
    case 'ArrowLeft':
    case 'KeyA':
      return 'left';
    case 'ArrowRight':
    case 'KeyD':
      return 'right';
    default:
      return null;
  }
}

/** Clamp a 2-vector to a maximum magnitude, preserving direction. */
function clampMagnitude(x: number, y: number, max: number): StickVector {
  const m = Math.hypot(x, y);
  if (m <= max || m === 0) return { x, y };
  return { x: (x / m) * max, y: (y / m) * max };
}

/**
 * Fuse the held keys and the joystick into ONE screen-space intent vector,
 * clamped to unit magnitude. Opposing keys cancel (up+down → 0); a diagonal
 * (up+right) is normalized so it is no faster than a cardinal; the joystick is
 * added past its deadzone and the whole thing re-clamped so pressing keys AND
 * shoving the stick can never exceed full speed.
 */
export function screenVector(
  held: ReadonlySet<MoveKey>,
  joystick: StickVector | null,
): StickVector {
  let sx = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
  let sy = (held.has('up') ? 1 : 0) - (held.has('down') ? 1 : 0);
  if (joystick && Math.hypot(joystick.x, joystick.y) >= JOYSTICK_DEADZONE) {
    sx += joystick.x;
    sy += joystick.y;
  }
  return clampMagnitude(sx, sy, 1);
}

/**
 * Rotate a screen-space intent into a world-space ground move using the camera
 * yaw. Rotation preserves length, so `|result| === |screen|` and the [0,1]
 * bound carries through. Periodic in `cameraYaw` (sin/cos) → wrap-around safe.
 */
export function toWorld(screen: StickVector, cameraYaw: number): WorldMove {
  const s = Math.sin(cameraYaw);
  const c = Math.cos(cameraYaw);
  // right·(cos, −sin) + forward·(−sin, −cos), components (x, z).
  return {
    x: screen.x * c + screen.y * -s,
    z: screen.x * -s + screen.y * -c,
  };
}

/**
 * The whole pipeline: held keys + joystick + camera yaw → normalized world move.
 * `held` and `joystick` are read-only — this never mutates its inputs.
 */
export function resolveInput(
  held: ReadonlySet<MoveKey>,
  joystick: StickVector | null,
  cameraYaw: number,
): WorldMove {
  return toWorld(screenVector(held, joystick), cameraYaw);
}
