/**
 * BootVeil.ts — the warm paper veil a player sees while the world loads behind it: the
 * game's name and a row of five footprints that fill in, calmly. Nothing of the world
 * shows until it is ready (world/Models counts every model it asked for), so a stand-in
 * prop is never seen. `lift()` dissolves it onto the finished clearing (a cut under
 * reduced motion: the CSS transition is off then). It carries no words but the name:
 * a browser lets the page speak only after the first tap.
 */

import { TITLE } from '../content/screens';

/** One print of a small boot in the sand (24 × 36 viewBox), drawn, not an emoji. */
const PRINT =
  `<svg viewBox="0 0 24 36" aria-hidden="true" focusable="false">` +
  `<path d="M12 2c4.6 0 7 3.6 7 8.2 0 3.6-1.3 6.2-2.4 8.4-.7 1.4-1.1 2.6-4.6 2.6s-4.1-1.2-4.8-2.6C6.1 16.4 5 13.8 5 10.2 5 5.6 7.4 2 12 2Z"/>` +
  `<path d="M12 23.4c3.2 0 5 1.8 5 4.9S15 34 12 34s-5-2.6-5-5.7 1.8-4.9 5-4.9Z"/>` +
  `</svg>`;

export interface BootVeil { lift: () => void }

export function mountBootVeil(ui: HTMLElement): BootVeil {
  const el = document.createElement('div');
  el.className = 'boot-veil';
  el.setAttribute('role', 'status');
  el.innerHTML =
    `<div class="boot-veil-inner">` +
    `<p class="boot-veil-name">${TITLE.naam}</p>` +
    `<div class="boot-veil-prints" aria-hidden="true">` +
    Array.from({ length: 5 }, (_, i) => `<span class="boot-veil-print" style="--i:${i}">${PRINT}</span>`).join('') +
    `</div></div>`;
  ui.appendChild(el);
  // the name waits for its own letter (the serif), so it never swaps font in front of him
  const shown = (): void => el.classList.add('boot-veil--named');
  void document.fonts?.load('700 48px Fraunces').then(shown, shown);
  window.setTimeout(shown, 600);
  let lifted = false;
  return {
    lift(): void {
      if (lifted) return;
      lifted = true;
      el.classList.add('boot-veil--lifting');
      const gone = (): void => el.remove();
      el.addEventListener('transitionend', (e) => { if (e.target === el) gone(); });
      window.setTimeout(gone, 900); // reduced motion (no transition) or a missed event
    },
  };
}
