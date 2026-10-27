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
import { icon, type IconName } from '../icons';

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
 *  and the reunion line (both `.explore-overlay`). Pauze (in a mission too), the missiebord, a briefing, the
 *  sporenboek, the raaf hut, Instellingen, the reward cards: the world reads this each
 *  frame and holds the ranger (and a jeep or helicopter) still while one is up, so held
 *  arrow keys never walk him away behind a card. Derived from the DOM, so every way back
 *  releases it without anyone having to remember to. */
export function menuOpen(): boolean {
  // (run 6: the in-mission pause card too — an adventure's walk beats leave the world
  // free, and the pause must still hold the ranger)
  return !!session.host?.querySelector('.ra-overlay:not(.explore-overlay), .ra-fade, .mission-pause-menu');
}

/**
 * A calm cut to somewhere else in the world: a short warm dip (a soft golden vignette
 * over the picture, never one flat colour), `move` runs while it is deepest, `then` opens
 * what comes next, and the dip lifts. About half a second in all. Never a camera glide
 * across the map, so nothing moves in front of a motion-sensitive player. Under reduced
 * motion it is a plain cut: the move and what comes next in the same frame, no dip.
 */
export function fadeCut(move: () => void, then: () => void): void {
  session.host.querySelector('.ra-fade')?.remove();
  if (prefersReducedMotion()) { move(); then(); return; }
  const veil = document.createElement('div');
  veil.className = 'ra-fade';
  veil.setAttribute('aria-hidden', 'true');
  session.host.appendChild(veil);
  requestAnimationFrame(() => veil.classList.add('on'));
  window.setTimeout(() => {
    // what was on screen goes while the dip hides it: no card fades out over the new place
    session.host.querySelectorAll('.ra-overlay, .ra-leaving').forEach((n) => n.remove());
    move();
    // two frames so the world draws the new place under the dip before it lifts
    requestAnimationFrame(() => requestAnimationFrame(() => {
      then();
      session.host.appendChild(veil); // keep it on top of the card `then` opened
      // lifting: it only fades now, and the card under it takes clicks and keys at once
      // (a keyboard player's Enter on "Ga op pad" was swallowed by the fading veil)
      veil.classList.remove('on');
      veil.classList.add('lifting');
      window.setTimeout(() => veil.remove(), FADE_OUT_MS + 40);
    }));
  }, FADE_IN_MS + 20);
}

/**
 * Run 7 (feel): the same warm dip for a cut INSIDE the world (World.ride: climbing into the
 * jeep from its front would swing the view ~170° round it). `move` runs while it is deepest,
 * `then` once the world has drawn the new view under it, and the dip lifts. Unlike fadeCut
 * it is no menu (`menuOpen` stays false: a line Benjamin is reading goes on, the world holds the
 * ranger itself) and it takes nothing off the screen. Under reduced motion a plain cut.
 */
export function dipCut(move: () => void, then: () => void): void {
  session.host.querySelector('.ra-dip')?.remove();
  if (prefersReducedMotion()) { move(); then(); return; }
  const veil = document.createElement('div');
  veil.className = 'ra-dip';
  veil.setAttribute('aria-hidden', 'true');
  session.host.appendChild(veil);
  requestAnimationFrame(() => veil.classList.add('on'));
  window.setTimeout(() => {
    move();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      then();
      veil.classList.remove('on');
      veil.classList.add('lifting');
      window.setTimeout(() => veil.remove(), FADE_OUT_MS + 40);
    }));
  }, FADE_IN_MS + 20);
}

/** How long (ms) the dip takes to deepen and to lift (base.css .ra-fade). */
const FADE_IN_MS = 220;
const FADE_OUT_MS = 280;

/** Take every card and overlay away. A card over the world eases out (140 ms) while
 *  what comes next is already there: it stops being a menu (`menuOpen`) and a click
 *  target at once (`inert`), so nothing waits for its fade. Under reduced motion, and
 *  for anything that is not a card (the HUD, a game's own prompt), it is gone at once. */
export function clearOverlays(): void {
  session.host.querySelectorAll<HTMLElement>('.ra-overlay').forEach(leave);
}

/** Ease one card (or a card's own layer) away, or remove it at once. */
export function leave(el: HTMLElement): void {
  if (prefersReducedMotion() || el.parentElement !== session.host || !el.querySelector('.card, .mission-board, .reunion-cap')) { el.remove(); return; }
  el.classList.remove('ra-overlay');
  el.classList.add('ra-leaving');
  el.setAttribute('inert', '');
  el.setAttribute('aria-hidden', 'true');
  window.setTimeout(() => el.remove(), LEAVE_MS);
}
const LEAVE_MS = 160; // the card's 140 ms fade (tokens --dur-card-out), and a frame

/** Swap the current overlay for a new card. Every over-world modal card gets the ONE
 *  shared scrim behind it (`.ra-scrim::before`, F-29) unless it opts out. The dim fades
 *  in with the first card and stays put from one card to the next (never a flicker). */
export function card(html: string, opts: { scrim?: boolean } = {}): HTMLDivElement {
  const dimmed = !!session.host.querySelector(':scope > .ra-overlay.ra-scrim');
  clearOverlays();
  const el = document.createElement('div');
  el.className = 'ra-overlay';
  if (opts.scrim !== false) {
    el.classList.add('ra-scrim');
    if (dimmed) {
      el.classList.add('ra-scrim--held');
      // the card going away leaves its dim to this one (two would darken the world), and
      // goes quickly, before this one comes (missions.css: the swap)
      session.host.querySelectorAll(':scope > .ra-leaving.ra-scrim').forEach((n) => {
        n.classList.remove('ra-scrim');
        n.classList.add('ra-leaving--swap');
      });
    }
  }
  el.innerHTML = html;
  session.host.appendChild(el);
  return el;
}

/** A `card()` with NO modal scrim: the title hero, the live explore HUD, and the
 *  full-screen mission board (which paints the shared --modal-scrim itself). */
export function plainCard(html: string): HTMLDivElement {
  return card(html, { scrim: false });
}

/** A card's kicker: its drawn icon and its words. */
export function kicker(ic: IconName | null, words: string): string {
  return `<p class="boot-kicker">${ic ? icon(ic) : ''}<span>${esc(words)}</span></p>`;
}
