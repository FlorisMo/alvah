/**
 * device.ts — which pointer the player uses, for device-aware words. A coarse
 * pointer (finger on an iPad) reads "Tik ..."; a mouse or trackpad reads "Klik ...".
 * The rule itself is pure (`forPointer`, core/onboarding.ts); this only asks the
 * browser. Evaluated per call, so plugging in a mouse changes the next hint.
 */

import { forPointer } from '../../core/onboarding';

/** True on a touch device (the same test the joystick's `auto` setting uses). */
export function coarsePointer(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

/** A hint line in the words of this device: "Tik ..." on touch, "Klik ..." with a mouse. */
export function deviceText(text: string): string {
  return forPointer(text, !coarsePointer());
}
