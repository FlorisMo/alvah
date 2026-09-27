/**
 * session.ts — the ONE shared state of a play session and the card helpers every
 * flow screen uses. The flow modules (WorldSession, MissionFlow, ExploreHud, Hub)
 * read and write `session` instead of each keeping its own copy of host/stage/world.
 *
 * `host` is the `#ui` layer, `stage` the shared renderer, `world` the live 3D world
 * (null on the title screen). Every screen is a DOM overlay over the 3D stage.
 */

import type { Stage } from '../../render3d/Stage';
import type { World } from '../../render3d/World';
import { store } from '../../core/state';
import { rangerNaam } from '../../core/avatar';
import { prefersReducedMotion } from '../../core/reduced-motion';

export const session: { host: HTMLElement; stage: Stage; world: World | null } = {
  host: null as unknown as HTMLElement,
  stage: null as unknown as Stage,
  world: null,
};

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
export const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

/** The ranger's name (falls back to "Alvah") — threaded into briefing/fact/reward + voice. */
export const naam = (): string => rangerNaam(store.get().avatar);

/** A menu card is over the live world: any `.ra-overlay` but the see-through explore HUD
 *  and the reunion line (both `.explore-overlay`). Pauze, the missiebord, a briefing, the
 *  sporenboek, the raaf hut, Instellingen, the reward cards: the world reads this each
 *  frame and holds the ranger (and a jeep or helicopter) still while one is up, so held
 *  arrow keys never walk him away behind a card. Derived from the DOM, so every way back
 *  releases it without anyone having to remember to. */
export function menuOpen(): boolean {
  return !!session.host?.querySelector('.ra-overlay:not(.explore-overlay), .ra-fade');
}

/**
 * A calm cut to somewhere else in the world: the screen fades to the warm paper colour,
 * `move` runs while it is covered, `then` opens what comes next, and the colour fades
 * away again (a plain cut under reduced motion: `.rm *` has no transitions). Never a
 * camera glide across the map, so nothing moves in front of a motion-sensitive player.
 */
export function fadeCut(move: () => void, then: () => void): void {
  const ms = prefersReducedMotion() ? 0 : FADE_MS;
  session.host.querySelector('.ra-fade')?.remove();
  const veil = document.createElement('div');
  veil.className = 'ra-fade';
  veil.setAttribute('aria-hidden', 'true');
  session.host.appendChild(veil);
  requestAnimationFrame(() => veil.classList.add('on'));
  window.setTimeout(() => {
    move();
    // two frames so the world draws the new place under the veil before it lifts
    requestAnimationFrame(() => requestAnimationFrame(() => {
      then();
      session.host.appendChild(veil); // keep it on top of the card `then` opened
      veil.classList.remove('on');
      window.setTimeout(() => veil.remove(), ms + 40);
    }));
  }, ms + 40);
}

/** How long (ms) a fadeCut takes each way. */
const FADE_MS = 380;

export function clearOverlays(): void {
  session.host.querySelectorAll('.ra-overlay').forEach((n) => n.remove());
}

/** Swap the current overlay for a new card. Every over-world modal card gets the ONE
 *  shared static scrim behind it (`.ra-scrim::before`, F-29) unless it opts out. */
export function card(html: string, opts: { scrim?: boolean } = {}): HTMLDivElement {
  clearOverlays();
  const el = document.createElement('div');
  el.className = 'ra-overlay';
  if (opts.scrim !== false) el.classList.add('ra-scrim');
  el.innerHTML = html;
  session.host.appendChild(el);
  return el;
}

/** A `card()` with NO modal scrim: the title hero, the live explore HUD, and the
 *  full-screen mission board (which paints the shared --modal-scrim itself). */
export function plainCard(html: string): HTMLDivElement {
  return card(html, { scrim: false });
}
