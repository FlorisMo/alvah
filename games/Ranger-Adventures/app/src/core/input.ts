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

/**
 * The interact / confirm keys (W1.4): `Space` or `Enter` fire the current
 * proximity action — the "Speel mee" affordance the ranger is standing at. The
 * laptop counterpart of tapping the button; `NumpadEnter` is folded in for full
 * keyboards. Pure predicate so `attach-input.ts` (and its unit test) share it.
 */
export function isInteractKey(code: string): boolean {
  return code === 'Space' || code === 'Enter' || code === 'NumpadEnter';
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

/* -------------------------------------------------------- virtual joystick -- */

/** How the on-screen joystick's visibility is decided (W1.3 Instellingen). */
export type JoystickPref = 'auto' | 'aan' | 'uit';

/**
 * Turn a thumb drag (pixels from the stick centre) into the screen-space
 * `StickVector` `screenVector` expects: `x` right (+), `y` forward (+). The drag
 * is clamped to the stick `radius` so a shove past the ring saturates at full
 * speed (never faster), then divided by the radius → magnitude in [0, 1]. Screen
 * "up" is `dy < 0`, which must read as forward, so the y axis is flipped. Pure;
 * the DOM plumbing lives in `ui/Joystick.ts`.
 */
export function joystickVector(dx: number, dy: number, radius: number): StickVector {
  if (!(radius > 0)) return { x: 0, y: 0 };
  const clamped = clampMagnitude(dx, dy, radius);
  return { x: clamped.x / radius, y: -clamped.y / radius };
}

/**
 * Decide whether the joystick shows. `aan`/`uit` are the explicit Instellingen
 * overrides; `auto` (default) follows the pointer — visible on a coarse pointer
 * (touch, the iPad primary device), hidden on a fine pointer (laptop, where the
 * keyboard drives). Pure so the default logic tests without a DOM.
 */
export function joystickVisible(pref: JoystickPref, coarsePointer: boolean): boolean {
  return pref === 'aan' ? true : pref === 'uit' ? false : coarsePointer;
}

/* ------------------------------------------------------------- steering -- */
/*
 * How the ranger is steered on foot (wave 2, laptop first). Headings are world
 * yaws in the ranger's convention: heading θ walks along (sin θ, cos θ) in (x, z),
 * and a camera BEARING β sits the lens behind that heading, looking along
 * (sin β, cos β). So "the ranger faces into the screen" is heading == bearing.
 *
 * - Keys (follow camera on) are TANK controls: Up walks forward, Down backs up
 *   (the camera never swings round), Left/Right turn him at a calm eased rate and
 *   the camera stays behind his heading. Nothing is camera-relative while a key is
 *   held, so there is no feedback loop between the input and the follow camera.
 * - The touch stick points where to go ON SCREEN, in the frame latched at touch-
 *   down (the camera may ease behind him during the hold without bending the walk).
 *   A stick pulled straight down backs up, like the Down key.
 * - With the follow camera off (setting or reduced motion) everything is
 *   screen-relative against the fixed bearing.
 */

/** Tank-turn top rate on a held Left/Right (rad/s): a calm ~90°/s. */
export const TURN_RATE = (90 * Math.PI) / 180;
/** Smooth-time of the turn's start (s): no jolt when a key goes down. */
export const TURN_ACCEL_TAU = 0.12;
/** Smooth-time of the turn's stop (s): short, so the view settles right after release. */
export const TURN_DECEL_TAU = 0.05;
/** Backing up walks at this share of the walking speed. */
export const BACK_SPEED = 0.6;
/** How fast the ranger's BODY swings round to a new heading (rad/s). Only the
 *  ranger turns in a pivot, never the camera, so it can be brisk. */
export const PIVOT_RATE = (420 * Math.PI) / 180;
/** Keys: when a walk starts and the view looks further than this off his heading
 *  (after a mouse drag, a tap-walk, stepping out of the jeep), he first turns to
 *  face into the screen, so Up always means "into the screen". */
export const ALIGN_GAP = (20 * Math.PI) / 180;
/** Stick: within this angle of straight down the stick backs him up (no turn). */
export const BACKPEDAL_CONE = (35 * Math.PI) / 180;
/** Stick: within this angle of straight up a wobbly thumb reads as straight up. */
export const STICK_SNAP = (10 * Math.PI) / 180;

/** Normalize an angle to (−π, π]. */
export function wrapPi(a: number): number {
  const twoPi = Math.PI * 2;
  const r = ((a % twoPi) + twoPi) % twoPi;
  return r > Math.PI ? r - twoPi : r;
}

/** The held keys as tank axes: `turn` right (+) / left (−), `fwd` up (+) / down (−). */
export function tankAxes(held: ReadonlySet<MoveKey>): { turn: number; fwd: number } {
  return {
    turn: (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0),
    fwd: (held.has('up') ? 1 : 0) - (held.has('down') ? 1 : 0),
  };
}

/**
 * One frame of the eased tank-turn velocity (rad/s, + = heading increases = a turn
 * to the LEFT). `input` in [−1, 1] is the wanted share of TURN_RATE. Speeding up
 * eases in over TURN_ACCEL_TAU; slowing, stopping or reversing eases out over the
 * shorter TURN_DECEL_TAU, so a released key stops the turn within a few degrees.
 * Frame-rate independent (exp damping); dt ≤ 0 is a no-op.
 */
export function turnStep(vel: number, input: number, dt: number): number {
  if (!(dt > 0)) return vel;
  const target = Math.max(-1, Math.min(1, input)) * TURN_RATE;
  const speeding = target !== 0 && (vel === 0 || Math.sign(vel) === Math.sign(target)) &&
    Math.abs(target) >= Math.abs(vel);
  const tau = speeding ? TURN_ACCEL_TAU : TURN_DECEL_TAU;
  const v = vel + (target - vel) * (1 - Math.exp(-dt / tau));
  return target === 0 && Math.abs(v) < 1e-3 ? 0 : v;
}

/** Step angle `cur` toward `target` along the short way by at most `maxStep` rad. */
export function approachAngle(cur: number, target: number, maxStep: number): number {
  const d = wrapPi(target - cur);
  if (Math.abs(d) <= maxStep) return wrapPi(target);
  return wrapPi(cur + Math.sign(d) * maxStep);
}

/** True when the stick is pulled (nearly) straight down: back up, don't turn. */
export function stickBackpedal(stick: StickVector): boolean {
  return stick.y < 0 && Math.abs(Math.atan2(stick.x, -stick.y)) <= BACKPEDAL_CONE;
}

/**
 * The world heading a stick direction means, on the screen whose camera bearing
 * was `frameBearing` when the thumb touched down: straight up = into the screen
 * (the bearing itself), right = a quarter turn to the right. A thumb within
 * STICK_SNAP of straight up reads as straight up.
 */
export function stickHeading(stick: StickVector, frameBearing: number): number {
  let a = Math.atan2(stick.x, stick.y); // 0 = up, +π/2 = right
  if (Math.abs(a) < STICK_SNAP) a = 0;
  return wrapPi(frameBearing - a);
}
