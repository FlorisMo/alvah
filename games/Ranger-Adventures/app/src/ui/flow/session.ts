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

export const session: { host: HTMLElement; stage: Stage; world: World | null } = {
  host: null as unknown as HTMLElement,
  stage: null as unknown as Stage,
  world: null,
};

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
export const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

/** The ranger's name (falls back to "Alvah") — threaded into briefing/fact/reward + voice. */
export const naam = (): string => rangerNaam(store.get().avatar);

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
