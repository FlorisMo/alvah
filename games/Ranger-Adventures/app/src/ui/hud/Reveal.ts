/**
 * Reveal.ts — "Nieuw in je veldgids!": the calm moment a NEW discovery gets (run 7, design
 * `state/foundation/design.md` §4.4; the `veldgids` package polishes it, §7.3).
 *
 * A small paper card under the top chips (the Pauze pill and the chip under it): the
 * thing's picture, "Nieuw in je veldgids!" and its name, read aloud once, a 🔊 to hear it
 * again; ~4 s, then it goes. One at a time, at a QUIET moment only (core: reveal-queue.ts):
 * the world is played (the explore or adventure HUD is up), no card or menu, nobody
 * speaking (the narrator, Bram), the first minute's teaching slot idle, and inside a
 * mission only while the mission says its beat is calm (`setRevealGate`: a walk, a look,
 * the reunion). It never takes a click (only its 🔊 does) and it is never a `.ra-overlay`,
 * so it is never a menu and never in the way. Under reduced motion it simply appears and
 * goes. A discovery is recorded at once (store.discover); only its reveal waits here.
 */

import './hud.css';
import { store } from '../../core/state';
import { narrator } from '../../core/narrator';
import { naamVan, type Ontdekking, type OntdekSoort } from '../../content/ontdekkingen';
import { REVEAL, ALGEMEEN } from '../../content/copy';
import { session, esc, menuOpen } from '../flow/session';
import { speaking } from './Speaker';
import { guideSnapshot } from './Lessons';
import { icon, type IconName } from '../icons';
import { prefersReducedMotion } from '../../core/reduced-motion';
import { RevealQueue } from './reveal-queue';
import { Sound } from '../../core/sound';
import { portrait, portraitNow } from '../veldgids/portrait';
import { revealSaysWhere } from '../veldgids/gids-math';

/** The picture when a row has no drawn icon (the `veldgids` package renders the model). */
const SOORT_ICON: Record<OntdekSoort, IconName> = { dier: 'paw', zeldzaam: 'paw', spoor: 'footprints', vondst: 'leaf', foto: 'photo' };

let missionGate: (() => boolean) | null = null;
let el: HTMLElement | null = null;
let raf = 0;

/** The narrator is saying something (before a reveal shows: never over a line). */
function voiceBusy(): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  return window.speechSynthesis.speaking || window.speechSynthesis.pending;
}

/** May a reveal show (or stay) now? */
function quietNow(): boolean {
  if (!session.world || !session.host) return false;
  if (!session.host.querySelector('.explore-hud, .adventure-hud')) return false; // (the title, the maker)
  if (menuOpen() || speaking()) return false;
  if (missionGate && !missionGate()) return false;
  if (guideSnapshot().active !== null) return false;
  return queue.current ? true : !voiceBusy(); // (its own voice keeps it up)
}

/** The reveal on screen is still saying its words (it stays until it has: §7.3). */
let saying = false;

const queue = new RevealQueue<Ontdekking>({ now: () => performance.now(), quiet: quietNow, holding: () => saying && voiceBusy() });

/** A NEW discovery: its reveal waits for a quiet moment, then shows once. Its picture is
 *  made now (the real model, ui/veldgids/portrait.ts), so it is ready when the moment comes. */
export function revealDiscovery(o: Ontdekking): void {
  if (o.model) void portrait(o.model);
  queue.push(o);
  if (!raf) raf = requestAnimationFrame(tick);
}

/**
 * The running mission says when its beat is calm enough for a reveal (an adventure: a
 * walk, a look, the reunion; a classic mission: never). null: no mission runs.
 */
export function setRevealGate(fn: (() => boolean) | null): void {
  missionGate = fn;
}

function tick(): void {
  raf = 0;
  const step = queue.tick();
  if (step?.kind === 'show') show(step.item);
  else if (step?.kind === 'hide') hide();
  if (queue.current || queue.waiting) raf = requestAnimationFrame(tick);
}

/** Its name as a line on the card: a capital first ("De big"). */
function nameLine(o: Ontdekking): string {
  const n = naamVan(o, store.get().settings.jargon);
  return n.charAt(0).toUpperCase() + n.slice(1);
}

function show(o: Ontdekking): void {
  hide(true);
  const name = nameLine(o);
  // the first reveals say where the veldgids is, until he has gone to look (§7.1)
  const where = revealSaysWhere(store.get().ontdekt);
  const line = `${REVEAL.nieuw} ${name}.${where ? ` ${REVEAL.waar}` : ''}`;
  const pic = o.model ? portraitNow(o.model) : null;
  const card = document.createElement('div');
  card.className = `reveal${o.soort === 'zeldzaam' ? ' reveal--rare' : ''}${pic ? ' reveal--pic' : ''}`;
  card.setAttribute('role', 'status');
  card.dataset.id = o.id;
  card.innerHTML =
    `<span class="rv-pic" aria-hidden="true">${pic ? picHtml(pic.found) : icon(o.icon ?? SOORT_ICON[o.soort])}</span>` +
    `<span class="rv-text"><span class="rv-kicker">${esc(REVEAL.nieuw)}</span><b class="rv-name">${esc(name)}</b>` +
    (where ? `<span class="rv-where">${esc(REVEAL.waar)}</span>` : '') + `</span>` +
    `<button class="ra-speak rv-speak" type="button" aria-label="${esc(ALGEMEEN.leesVoor)}">${icon('speaker')}</button>`;
  card.querySelector('.rv-speak')?.addEventListener('click', () => narrator.speak(line));
  session.host.appendChild(card);
  el = card;
  store.markRevealed(o.id);
  // its picture, if it was not made yet: in as soon as it is (the card stays the same size)
  if (!pic && o.model) {
    void portrait(o.model).then((p) => {
      if (!p || el !== card) return;
      card.classList.add('reveal--pic');
      const box = card.querySelector('.rv-pic');
      if (box) box.innerHTML = picHtml(p.found);
    });
  }
  if (prefersReducedMotion()) card.classList.add('rv-in');
  else requestAnimationFrame(() => card.classList.add('rv-in'));
  if (store.get().settings.geluid) Sound.reveal();
  saying = store.get().settings.voorlezen;
  // (after the chime's first note: the voice never starts on top of it)
  if (saying) window.setTimeout(() => { if (el === card) narrator.speak(line); }, 280);
}

function picHtml(src: string): string {
  return `<img class="rv-img" alt="" draggable="false" src="${src}">`;
}

/** It goes (a soft fade; at once under reduced motion). Never stops the voice: a line said
 *  over it by what came next must not be cut off. */
function hide(now = false): void {
  const card = el;
  el = null;
  saying = false;
  if (!card) return;
  if (now || prefersReducedMotion()) { card.remove(); return; }
  card.classList.remove('rv-in');
  card.classList.add('rv-out');
  window.setTimeout(() => card.remove(), 520);
}
