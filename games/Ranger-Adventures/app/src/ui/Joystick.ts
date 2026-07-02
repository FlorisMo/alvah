/**
 * Joystick.ts — the on-screen virtual joystick (WORLD-PLAN §3.2 / W1.3), the
 * iPad-primary walking control. It is the DOM half of the pure `input.ts` core:
 * a thumb the player drags, whose offset becomes the same screen-space
 * `StickVector` the keyboard produces, so both feed one `resolveInput` at the
 * `World.update` call site (no second movement code path).
 *
 * One draggable ring, bottom-left, thumb ≥ 56 px (the frozen tap-target floor).
 * Pointer events only (works for touch, pen and mouse alike); `setPointerCapture`
 * keeps the drag glued to this element even when the finger slides past the ring,
 * so there are NO window-level listeners to leak. `touch-action: none` stops the
 * browser stealing the gesture for scroll/zoom. While the thumb rests, `vector()`
 * returns null so a joystick on screen never overrides the keyboard.
 *
 * Visibility (auto = coarse pointer, or the Instellingen override) is decided by
 * `joystickVisible` in the pure core and applied by the caller via `setVisible`.
 */

import { joystickVector, type StickVector } from '../core/input';

export class Joystick {
  /** The root element — the caller mounts this into the explore HUD. */
  readonly el: HTMLDivElement;
  private readonly thumb: HTMLDivElement;
  private current: StickVector | null = null;
  private activePointer: number | null = null;
  private cx = 0;
  private cy = 0;
  private radius = 1;

  constructor() {
    const base = document.createElement('div');
    base.className = 'rj-base';
    base.setAttribute('aria-label', 'Loopstick: sleep om te lopen');
    base.style.touchAction = 'none';
    const thumb = document.createElement('div');
    thumb.className = 'rj-thumb';
    thumb.setAttribute('aria-hidden', 'true');
    base.appendChild(thumb);
    this.el = base;
    this.thumb = thumb;

    base.addEventListener('pointerdown', this.onDown);
    base.addEventListener('pointermove', this.onMove);
    base.addEventListener('pointerup', this.onUp);
    base.addEventListener('pointercancel', this.onUp);
  }

  /** The live screen-space intent, or null while the thumb rests (keyboard wins). */
  vector(): StickVector | null {
    return this.current;
  }

  /** Show/hide the joystick (driven by the settings + coarse-pointer decision). */
  setVisible(visible: boolean): void {
    this.el.hidden = !visible;
  }

  /** Remove listeners + the element (called when the world tears down). */
  dispose(): void {
    this.el.removeEventListener('pointerdown', this.onDown);
    this.el.removeEventListener('pointermove', this.onMove);
    this.el.removeEventListener('pointerup', this.onUp);
    this.el.removeEventListener('pointercancel', this.onUp);
    this.el.remove();
  }

  private onDown = (e: PointerEvent): void => {
    if (this.activePointer !== null) return; // one thumb at a time
    const rect = this.el.getBoundingClientRect();
    this.cx = rect.left + rect.width / 2;
    this.cy = rect.top + rect.height / 2;
    this.radius = rect.width / 2; // travel to the ring edge = full speed
    this.activePointer = e.pointerId;
    this.el.setPointerCapture(e.pointerId);
    this.el.classList.add('rj-active');
    this.drag(e);
    e.preventDefault();
  };

  private onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.activePointer) return;
    this.drag(e);
    e.preventDefault();
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.activePointer) return;
    this.activePointer = null;
    this.current = null;
    this.thumb.style.transform = '';
    this.el.classList.remove('rj-active');
    if (this.el.hasPointerCapture(e.pointerId)) this.el.releasePointerCapture(e.pointerId);
  };

  /** Common drag body: offset from centre → thumb position + `vector()` value. */
  private drag(e: PointerEvent): void {
    const dx = e.clientX - this.cx;
    const dy = e.clientY - this.cy;
    this.current = joystickVector(dx, dy, this.radius);
    // move the thumb, clamped to the ring, mirroring the clamped vector
    const tx = this.current.x * this.radius;
    const ty = -this.current.y * this.radius; // vector y is forward (+up); screen y is down
    this.thumb.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px)`;
  }
}
