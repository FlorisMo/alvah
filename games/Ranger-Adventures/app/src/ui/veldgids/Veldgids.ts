/**
 * Veldgids.ts — his field guide (run 7, design `state/foundation/design.md` §7.1): what he
 * saw and heard, one page per place, in the order the story meets the places, and
 * "Overal" (the open world) last. Opened from Pauze (a tile) and in the hut (a chip).
 *
 * A thing he found shows its real model as a small picture (ui/veldgids/portrait.ts), its
 * name, a soft gold rim when it is a rare one, and a small "nieuw" tag until he has seen it
 * here once. A thing still out there is the same picture as a grey shape with one hint line
 * ("Wie tikt er op een boom?") and a speaker: a pointer resting on a tile, a key's focus or
 * a tap says its words. A row of dots is a picture of how much of the page he found (never
 * "3/7"). No currency, no counter, no timer: just what is still out there.
 *
 * Keys: ◀ ▶ (and the arrow keys) turn the page, round and round (never a dead end); Enter
 * and Esc go back. Big targets (the arrows 64 px, a tile ~190 px). It reads itself aloud
 * as it opens ("Je veldgids. Bij de modderpoel."), and the page's place as it turns.
 */

import './veldgids.css';
import { store } from '../../core/state';
import { narrator } from '../../core/narrator';
import { Content } from '../../content/registry';
import { ONTDEKKINGEN, naamVan, type OntdekSoort } from '../../content/ontdekkingen';
import { VELDGIDS } from '../../content/copy';
import { card, kicker, esc } from '../flow/session';
import { icon, type IconName } from '../icons';
import { mountReadAloud, speakButtonHtml, type ReadAloudHandle } from '../ReadAloud';
import { prefersReducedMotion } from '../../core/reduced-motion';
import { storyOrder } from '../flow/WorldSession';
import { gidsPages, openingPage, turnPage, anyNieuw, type GidsEntry, type GidsPage } from './gids-math';
import { portrait, portraitNow } from './portrait';

/** The drawn picture of a row without a model (and while its picture is being made). */
const SOORT_ICON: Record<OntdekSoort, IconName> = { dier: 'paw', zeldzaam: 'paw', spoor: 'footprints', vondst: 'leaf', foto: 'photo' };

/** The page he looked at last on this page load (the gids opens there again). */
let lastHome: string | null = null;

/** Tiles to a row on a page of eight finds or fewer (two rows fit under the title at
 *  1280×800; a page with more lays them closer: `.vg-many`). */
const VG_ROW_MAX = 4;

/** How long a pointer rests on a tile before it is read (as the menus: no chatter). */
const DWELL_MS = 450;

/** The place a page is about, in words ("Bij de modderpoel"); a new home without its own
 *  line shows its mission's title. */
export function pageTitle(home: string): string {
  return VELDGIDS.plek[home] ?? Content.activeArea().missies.find((m) => m.id === home)?.titel ?? home;
}

/** The Pauze tile's and the hut chip's small tag when something in the gids is new (else
 *  nothing; never a count). Hidden from speech: the words beside it are the name. */
export function gidsTag(): string {
  return anyNieuw(ONTDEKKINGEN, store.get().ontdekt) ? `<span class="vg-tile-new" aria-hidden="true">${esc(VELDGIDS.nieuw)}</span>` : '';
}

/** A name as a line on its own: a capital first ("De big"). */
function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The words a tile says: its name when found, else its hint. */
function tileWords(e: GidsEntry): string {
  return e.found ? capital(naamVan(e.o, store.get().settings.jargon)) : e.o.hint;
}

/**
 * Open the veldgids over the live world. `back` is where its way back goes (Pauze, the
 * hut). The page: the first with something new on it, else the one he looked at last.
 */
export function showVeldgids(back: () => void): void {
  narrator.stop();
  const order = storyOrder(Content.activeArea().missies).map((m) => m.id);
  const pages = gidsPages(ONTDEKKINGEN, store.get().ontdekt, order);
  if (!pages.length) { back(); return; }
  // what is new as the gids opens keeps its tag for this whole look (turning back to a
  // page still shows it); next time it is gone
  const nieuwNu = new Set(pages.flatMap((p) => p.entries.filter((e) => e.nieuw).map((e) => e.o.id)));
  let at = openingPage(pages, lastHome);

  const el = card(
    `<div class="card veldgids">` +
    kicker('veldgids', VELDGIDS.kicker) +
    `<div class="vg-head">` +
    `<button class="ra-chip vg-nav vg-prev" type="button" aria-label="${esc(VELDGIDS.vorige)}">${icon('back')}</button>` +
    `<h1 class="boot-title vg-title"></h1>` +
    `<button class="ra-chip vg-nav vg-next" type="button" aria-label="${esc(VELDGIDS.volgende)}">${icon('forward')}</button>` +
    `</div>` +
    `<div class="vg-dots" aria-hidden="true"></div>` +
    `<div class="card-body"><div class="vg-grid"></div></div>` +
    `<div class="card-foot"><div class="ra-row">${speakButtonHtml('ra-speak vg-say-page')}` +
    `<button class="btn-start vg-back" type="button" data-key="back">${esc(VELDGIDS.terug)}</button></div></div>` +
    `</div>`,
  );
  const titleEl = el.querySelector<HTMLElement>('.vg-title')!;
  const dotsEl = el.querySelector<HTMLElement>('.vg-dots')!;
  const grid = el.querySelector<HTMLElement>('.vg-grid')!;
  const voor = (): boolean => store.get().settings.voorlezen;
  let reading: ReadAloudHandle | null = null;
  let hoverTimer = 0;

  /** The page's words: its place (after "Je veldgids." as the gids opens), and what the
   *  grey shapes are when nothing there is found yet. */
  const readPage = (page: GidsPage, opening: boolean, start: boolean): void => {
    reading?.stop();
    reading = mountReadAloud({
      lead: opening ? VELDGIDS.zegOpen : undefined,
      segments: [{ el: titleEl, text: pageTitle(page.home), sentence: true }],
      trail: page.found ? undefined : VELDGIDS.zegLeeg,
      autoStart: start,
    });
  };

  const show = (i: number, opening: boolean): void => {
    at = i;
    const page = pages[i];
    lastHome = page.home;
    readPage(page, opening, voor());
    dotsEl.innerHTML = page.entries
      .map((e) => `<span class="vg-dot${e.found ? ' on' : ''}${e.rare ? ' rare' : ''}"></span>`)
      .join('');
    grid.innerHTML = page.entries.map((e) => tileHtml(e, nieuwNu.has(e.o.id))).join('');
    // (a page with more than eight finds lays them five or six to a row: two rows, all in
    // view at 1280×800 — veldgids.css .vg-many; a page of eight or fewer stays as it was)
    const many = page.entries.length > VG_ROW_MAX * 2;
    grid.classList.toggle('vg-many', many);
    if (many) grid.style.setProperty('--vg-cols', String(Math.min(6, Math.ceil(page.entries.length / 2))));
    else grid.style.removeProperty('--vg-cols');
    if (!opening && !prefersReducedMotion()) {
      grid.classList.remove('vg-turn');
      void grid.offsetWidth; // (restart the soft fade-in)
      grid.classList.add('vg-turn');
    }
    grid.querySelectorAll<HTMLButtonElement>('.vg-entry').forEach((b, k) => wireTile(b, page.entries[k]));
    // he has seen what is on this page: next time its "nieuw" is gone
    store.markGezien(page.entries.filter((e) => e.found).map((e) => e.o.id));
  };

  /** A tile says its words when a pointer rests on it, a key focuses it, or it is tapped. */
  const wireTile = (b: HTMLButtonElement, e: GidsEntry): void => {
    const say = (): void => { reading?.stop(); narrator.speak(tileWords(e)); };
    b.addEventListener('click', say);
    b.addEventListener('mouseenter', () => {
      window.clearTimeout(hoverTimer);
      if (!voor()) return;
      hoverTimer = window.setTimeout(() => { if (b.isConnected && b.matches(':hover')) say(); }, DWELL_MS);
    });
    b.addEventListener('mouseleave', () => window.clearTimeout(hoverTimer));
    b.addEventListener('focus', () => { if (voor() && b.matches(':focus-visible')) say(); });
    // its picture: the real model, made once (a grey shape until he found it)
    const model = e.o.model;
    if (!model) return;
    void portrait(model).then((pic) => {
      if (!pic || !b.isConnected) return;
      const box = b.querySelector<HTMLElement>('.vg-pic');
      if (box) box.innerHTML = imgHtml(e.found ? pic.found : pic.shadow);
    });
  };

  const turn = (step: number): void => {
    window.clearTimeout(hoverTimer);
    show(turnPage(at, step, pages.length), false);
  };
  el.querySelector('.vg-prev')?.addEventListener('click', () => turn(-1));
  el.querySelector('.vg-next')?.addEventListener('click', () => turn(1));
  el.querySelector('.vg-say-page')?.addEventListener('click', (ev) => { ev.stopPropagation(); reading?.speak(); });
  const close = (): void => {
    window.clearTimeout(hoverTimer);
    window.removeEventListener('keydown', onKey, true);
    reading?.stop();
    narrator.stop();
    back();
  };
  el.querySelector('.vg-back')?.addEventListener('click', close);

  // the arrow keys turn the page (and never reach the world behind the card)
  function onKey(e: KeyboardEvent): void {
    if (!el.isConnected || !el.classList.contains('ra-overlay')) { window.removeEventListener('keydown', onKey, true); return; }
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.code !== 'ArrowLeft' && e.code !== 'ArrowRight') return;
    e.preventDefault();
    e.stopPropagation();
    if (e.repeat) return;
    turn(e.code === 'ArrowLeft' ? -1 : 1);
  }
  window.addEventListener('keydown', onKey, true);

  // only a single page: no arrows to turn
  if (pages.length < 2) el.querySelectorAll<HTMLElement>('.vg-nav').forEach((b) => { b.hidden = true; });
  show(at, true);
}

/** One tile: its picture (the drawn icon until the real one is made), the "nieuw" tag,
 *  its name or its hint (with a speaker: it can be heard). A button: tapped it speaks. */
function tileHtml(e: GidsEntry, nieuw: boolean): string {
  const cls = ['vg-entry', e.found ? 'is-found' : 'is-missing', e.rare ? 'is-rare' : '', e.foto ? 'is-foto' : '', nieuw && e.found ? 'is-new' : '']
    .filter(Boolean).join(' ');
  const words = tileWords(e);
  const ready = e.o.model ? portraitNow(e.o.model) : null;
  const pic = ready ? imgHtml(e.found ? ready.found : ready.shadow) : `<span class="vg-ic">${icon(e.o.icon ?? SOORT_ICON[e.o.soort])}</span>`;
  return (
    `<button type="button" class="${cls}" data-id="${esc(e.o.id)}" aria-label="${esc(words)}">` +
    `<span class="vg-pic">${pic}</span>` +
    (nieuw && e.found ? `<span class="vg-new">${esc(VELDGIDS.nieuw)}</span>` : '') +
    (e.found
      ? `<span class="vg-name">${esc(words)}</span>`
      : `<span class="vg-hint">${esc(words)}</span><span class="vg-hear">${icon('speaker')}</span>`) +
    `</button>`
  );
}

function imgHtml(src: string): string {
  return `<img class="vg-img" alt="" draggable="false" src="${src}">`;
}
