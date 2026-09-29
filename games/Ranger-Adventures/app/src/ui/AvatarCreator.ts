/**
 * AvatarCreator.ts — "maak je ranger". Shown once, on the first Begin (gated by
 * `avatarGemaakt`). The preview IS the 3D ranger in the world: the camera has glided
 * down to him (World.present('maker'), world/Presenter.ts) and he has turned round to
 * face you; every swatch repaints him at once (RangerLook listens to the store). This
 * screen is only the panel beside him: on the right on a laptop or an iPad on its side,
 * a sheet along the bottom on a narrow screen. It tells the world where the free part
 * of the screen is, so he always stands in it, full body.
 *
 * Rows: the greeting, the name (a field + name chips), four compact rows of swatches
 * (Huid, Haar, Ranger-jas, Ogen: the label left, four swatches right), then 🔊 and
 * "Dit is mijn ranger". Nothing scrolls at 1280×800 or 1080×810.
 * Keyboard: Tab between the rows, ←/→ within a row and ↑/↓ between rows (roving focus),
 * Enter or Space picks the focused swatch, Enter anywhere else is "Dit is mijn ranger";
 * Space in the name field types a space. ≥56 px targets, dual-channel choices (colour +
 * word + a ✓ ring), and each swatch says its own label when focused or rested on.
 * Pure model + persistence live in core/avatar.ts + core/state.ts; this is view-only.
 */

import './avatar.css';
import { store } from '../core/state';
import { narrator } from '../core/narrator';
import { Sound } from '../core/sound';
import {
  AVATAR_KENMERKEN, KENMERK_LABEL, NAAM_SUGGESTIES, MAX_NAAM, rangerNaam,
  type Avatar, type AvatarKenmerk,
} from '../core/avatar';
import { setScreen } from '../core/devhook';
import { readScreenAloud, endHoverRead } from './ReadAloud';
import { SAY, MAKER } from '../content/screens';
import { metNaam } from '../content/mentor';
import { ALGEMEEN } from '../content/copy';
import type { World, Focus } from '../render3d/World';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

const KENMERKEN = Object.keys(AVATAR_KENMERKEN) as AvatarKenmerk[];

function groupHtml(kenmerk: AvatarKenmerk, av: Avatar): string {
  const label = KENMERK_LABEL[kenmerk];
  const swatches = AVATAR_KENMERKEN[kenmerk]
    .map((o) => {
      const sel = av[kenmerk] === o.id;
      return (
        `<button class="av-swatch${sel ? ' sel' : ''}" type="button" role="radio" aria-checked="${sel}" ` +
        `tabindex="${sel ? 0 : -1}" data-kenmerk="${kenmerk}" data-id="${esc(o.id)}" aria-label="${esc(label)}: ${esc(o.label)}">` +
        `<span class="av-chip" style="background:${o.kleur}"><span class="av-tick" aria-hidden="true">✓</span></span>` +
        `<span class="av-swatch-label" aria-hidden="true">${esc(o.label)}</span>` +
        `</button>`
      );
    })
    .join('');
  return (
    `<div class="av-group">` +
    `<span class="av-legend" id="av-leg-${kenmerk}">${esc(label)}</span>` +
    `<div class="av-swatches" role="radiogroup" aria-labelledby="av-leg-${kenmerk}">${swatches}</div>` +
    `</div>`
  );
}

/** Where the panel leaves the screen free (fractions of the canvas), for the ranger. */
function freeFocus(panel: HTMLElement): Focus {
  const W = window.innerWidth || 1, H = window.innerHeight || 1;
  // its laid-out box (offset*: without the slide-in transform, so the aim never moves
  // while the panel eases in); the overlay it sits in fills the screen
  const left = panel.offsetLeft, top0 = panel.offsetTop;
  if (panel.offsetWidth < 1) return { x: 0.5, y: 0.5, h: 1 };
  if (left > W * 0.3) return { x: Math.max(0.2, left / 2 / W), y: 0.5, h: 1, w: left / W }; // a panel on the right
  const top = Math.max(0.3 * H, top0);                                          // a sheet along the bottom
  return { x: 0.5, y: top / 2 / H, h: top / H };
}

export function showAvatarCreator(ui: HTMLElement, world: World, done: () => void): void {
  setScreen('avatar');
  narrator.stop();
  ui.querySelectorAll('.ra-overlay').forEach((n) => n.remove());
  const av = store.get().avatar;
  const chips = NAAM_SUGGESTIES.map(
    (n) => `<button class="av-naam-chip" type="button" data-naam="${esc(n)}">${esc(n)}</button>`,
  ).join('');

  const el = document.createElement('div');
  el.className = 'ra-overlay av-overlay';
  el.innerHTML =
    `<section class="avatar-creator" aria-labelledby="av-titel">` +
    `<header class="av-head">` +
    `<h1 class="av-titel" id="av-titel">${esc(MAKER.titel)}</h1>` +
    `<p class="av-greet" aria-live="polite"></p>` +
    `</header>` +
    `<div class="av-naam">` +
    `<label class="av-naam-veld"><span class="av-naam-cap">${esc(MAKER.naam)}</span>` +
    `<input class="av-naam-input" type="text" inputmode="text" maxlength="${MAX_NAAM}" ` +
    `autocomplete="off" spellcheck="false" value="${esc(av.naam)}" aria-label="${esc(ALGEMEEN.jeNaam)}"/></label>` +
    `<div class="av-naam-chips">${chips}</div>` +
    `</div>` +
    `<div class="av-groups">${KENMERKEN.map((k) => groupHtml(k, av)).join('')}</div>` +
    `<footer class="ra-row av-foot"><button class="btn-start av-klaar" type="button">${esc(MAKER.klaar)}</button></footer>` +
    `</section>`;
  ui.appendChild(el);

  const panel = el.querySelector<HTMLElement>('.avatar-creator')!;
  const input = el.querySelector<HTMLInputElement>('.av-naam-input')!;
  const greet = el.querySelector<HTMLParagraphElement>('.av-greet')!;
  const paintGreet = (): void => { greet.textContent = MAKER.groet(rangerNaam(store.get().avatar)); };
  paintGreet();

  // the ranger stands in the free part of the screen (read every frame: the screen can turn)
  world.setFocus(() => freeFocus(panel));
  world.present('maker');

  // the name: typing is live (the greeting follows), a chip fills it in
  input.addEventListener('input', () => { store.setAvatar({ naam: input.value }); paintGreet(); });
  el.querySelectorAll<HTMLButtonElement>('.av-naam-chip').forEach((b) => {
    b.addEventListener('click', () => {
      Sound.select();
      const naam = b.dataset.naam ?? '';
      input.value = naam;
      store.setAvatar({ naam });
      paintGreet();
      // the new greeting, said: "Hoi, ranger Bo!", whole (the chip's own label is not
      // said over it, also not after a tap: endHoverRead)
      endHoverRead();
      if (store.get().settings.voorlezen) narrator.speak(greet.textContent ?? '');
    });
  });

  // a swatch: the ranger repaints at once (RangerLook listens to the store)
  const pick = (b: HTMLButtonElement): void => {
    Sound.select();
    const kenmerk = b.dataset.kenmerk as AvatarKenmerk;
    store.setAvatar({ [kenmerk]: b.dataset.id ?? '' } as Partial<Avatar>);
    b.closest('.av-swatches')?.querySelectorAll<HTMLButtonElement>('.av-swatch').forEach((x) => {
      const on = x === b;
      x.classList.toggle('sel', on);
      x.setAttribute('aria-checked', String(on));
      x.tabIndex = on ? 0 : -1;
    });
  };
  const rows = Array.from(el.querySelectorAll<HTMLElement>('.av-swatches'))
    .map((g) => Array.from(g.querySelectorAll<HTMLButtonElement>('.av-swatch')));
  rows.flat().forEach((b) => b.addEventListener('click', () => pick(b)));

  // roving focus: ←/→ within a row, ↑/↓ to the same place in the row above / below
  panel.addEventListener('keydown', (e) => {
    const at = document.activeElement as HTMLButtonElement | null;
    const r = rows.findIndex((row) => row.includes(at as HTMLButtonElement));
    if (r < 0) return;
    const c = rows[r].indexOf(at!);
    let to: HTMLButtonElement | null = null;
    if (e.key === 'ArrowLeft') to = rows[r][Math.max(0, c - 1)];
    else if (e.key === 'ArrowRight') to = rows[r][Math.min(rows[r].length - 1, c + 1)];
    else if (e.key === 'ArrowUp' && r > 0) to = rows[r - 1][Math.min(c, rows[r - 1].length - 1)];
    else if (e.key === 'ArrowDown') to = r < rows.length - 1 ? rows[r + 1][Math.min(c, rows[r + 1].length - 1)] : el.querySelector('.av-klaar');
    else return;
    e.preventDefault();
    e.stopPropagation(); // the arrows move the focus here, not the ranger
    to?.focus();
  });

  // child:B12: said once, 🔊 beside the button says it again; a swatch or name chip
  // says its own label ("Haar: Rood") when the mouse rests on it or it is focused
  const voor = store.get().settings.voorlezen;
  const ra = readScreenAloud(el, {
    text: () => metNaam(SAY.maker, rangerNaam(store.get().avatar)), anchor: '.av-klaar', autoStart: voor,
    items: '.av-swatch, .av-naam-chip', hover: voor,
  });

  el.querySelector('.av-klaar')?.addEventListener('click', () => {
    Sound.found();
    ra.stop();
    store.markAvatarGemaakt();
    world.setFocus(null);
    el.className = 'av-overlay--leaving'; // not a menu any more: he can walk at once
    el.querySelectorAll('button, input').forEach((b) => { (b as HTMLButtonElement).disabled = true; });
    const reduced = document.body.classList.contains('rm');
    window.setTimeout(() => el.remove(), reduced ? 0 : 300);
    done();
  }, { once: true });
}
