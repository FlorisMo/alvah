/**
 * keys.ts — ONE keyboard layer for every screen (laptop first).
 *
 *   Enter / Space  press the primary button on screen: Begin, Dit is mijn ranger,
 *                  Speel mee, Ga op pad, Verder, Stap in de jeep ... (a `.btn-start`,
 *                  or an element marked `data-key="primary"`).
 *   Esc            press the screen's way back (`data-key="back"`), or open Pauze
 *                  in the world / during a mission (`data-key="pause"`).
 *
 * Only a button the player can actually see counts: on screen, enabled, and not
 * covered by another layer. A button focused with Tab keeps the key (keyboard users).
 * The layer listens in the capture phase and stops a key it handled, so one key
 * press is always one action (the world's own Space/Enter handler never also fires).
 * Space inside a text field still types a space.
 */

const PRIMARY = '[data-key="primary"], .btn-start';
const BACK = '[data-key="back"]';
const PAUSE = '[data-key="pause"]';

let root: HTMLElement | null = null;

export function installKeys(ui: HTMLElement): void {
  if (root) return;
  root = ui;
  window.addEventListener('keydown', onKey, { capture: true });
}

/** Rendered, enabled, and (when its centre is in the viewport) not covered. */
function usable(el: HTMLElement, mustBeOnScreen: boolean): boolean {
  if ((el as HTMLButtonElement).disabled) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return false;
  const style = getComputedStyle(el);
  if (style.visibility === 'hidden' || style.pointerEvents === 'none') return false;
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const inView = x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight;
  if (!inView) return !mustBeOnScreen;
  const hit = document.elementFromPoint(x, y);
  return !!hit && (hit === el || el.contains(hit));
}

/** The last usable match in document order (later layers sit on top). */
function find(selector: string, mustBeOnScreen: boolean): HTMLElement | null {
  if (!root) return null;
  const all = Array.from(root.querySelectorAll<HTMLElement>(selector));
  for (let i = all.length - 1; i >= 0; i--) if (usable(all[i], mustBeOnScreen)) return all[i];
  return null;
}

function isTextField(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return true;
  if (!(t instanceof HTMLInputElement)) return false;
  return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset'].includes(t.type);
}

function handled(e: KeyboardEvent): void {
  e.preventDefault();
  e.stopPropagation();
}

function onKey(e: KeyboardEvent): void {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const confirm = e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space';
  if (confirm) {
    if (e.code === 'Space' && isTextField(e.target)) { e.stopPropagation(); return; } // type the space
    // a button focused by keyboard (Tab) keeps its own key
    const focused = document.activeElement;
    const target = focused instanceof HTMLElement && root?.contains(focused)
      && focused.matches('button:focus-visible') && usable(focused, false)
      ? focused
      : find(PRIMARY, true);
    if (!target) return; // nothing to press: the world may still use the key
    handled(e);
    if (!e.repeat) target.click();
    return;
  }
  if (e.code === 'Escape') {
    const target = find(BACK, false) ?? find(PAUSE, true);
    if (!target) return;
    handled(e);
    if (!e.repeat) target.click();
  }
}
