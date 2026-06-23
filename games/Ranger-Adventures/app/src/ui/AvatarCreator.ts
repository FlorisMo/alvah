/**
 * AvatarCreator.ts — "maak je ranger" screen (BUILD-PLAN §3, Phase 3 meta).
 * A DOM overlay over the 3D stage. Shown once on first boot (gated by
 * `avatarGemaakt`) and re-openable from the lodge. Picks a name + four cosmetic
 * kenmerken (huid/haar/outfit/iris); a live SVG preview tints from the choices,
 * the same tints the 3D ranger material uses later.
 *
 * Never-scary, joyful, game-first. Accessibility throughout: ≥56px swatches,
 * dual-channel selection (colour + label + a ✓ ring), read-aloud of the greeting.
 * Pure model + persistence live in core/avatar.ts + core/state.ts; this is view-only.
 */

import './avatar.css';
import { store } from '../core/state';
import { narrator } from '../core/narrator';
import { Sound } from '../core/sound';
import {
  AVATAR_KENMERKEN, KENMERK_LABEL, NAAM_SUGGESTIES, MAX_NAAM, rangerNaam, kleurVan,
  type Avatar, type AvatarKenmerk,
} from '../core/avatar';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

let host: HTMLElement;
let onDone: () => void;

export function showAvatarCreator(ui: HTMLElement, done: () => void): void {
  host = ui;
  onDone = done;
  render();
}

function clearOverlays(): void {
  host.querySelectorAll('.ra-overlay').forEach((n) => n.remove());
}

/** A small SVG ranger that tints from the chosen kenmerken (preview = the 3D tints). */
function rangerSvg(av: Avatar): string {
  const huid = kleurVan('huid', av.huid);
  const haar = kleurVan('haar', av.haar);
  const jas = kleurVan('outfit', av.outfit);
  const iris = kleurVan('iris', av.iris);
  return (
    `<svg class="av-art" viewBox="0 0 120 130" role="img" aria-label="Jouw ranger">` +
    // jacket / shoulders
    `<path d="M18 130 Q22 92 60 88 Q98 92 102 130 Z" fill="${jas}"/>` +
    `<path d="M60 88 L52 130 M60 88 L68 130" stroke="rgba(0,0,0,.14)" stroke-width="2" fill="none"/>` +
    // neck
    `<rect x="52" y="74" width="16" height="14" rx="6" fill="${huid}"/>` +
    // head
    `<circle cx="60" cy="52" r="30" fill="${huid}"/>` +
    // hair cap
    `<path d="M30 50 Q32 20 60 20 Q88 20 90 50 Q78 36 60 36 Q42 36 30 50 Z" fill="${haar}"/>` +
    // ranger hat brim (reads as boswachter)
    `<ellipse cx="60" cy="26" rx="40" ry="8" fill="${jas}"/>` +
    `<path d="M44 26 Q44 8 60 8 Q76 8 76 26 Z" fill="${jas}"/>` +
    `<rect x="44" y="22" width="32" height="5" rx="2.5" fill="rgba(0,0,0,.18)"/>` +
    // eyes (white sclera + iris)
    `<circle cx="49" cy="54" r="6" fill="#fff"/><circle cx="71" cy="54" r="6" fill="#fff"/>` +
    `<circle cx="49" cy="54" r="3.4" fill="${iris}"/><circle cx="71" cy="54" r="3.4" fill="${iris}"/>` +
    `<circle cx="50" cy="53" r="1.1" fill="#fff"/><circle cx="72" cy="53" r="1.1" fill="#fff"/>` +
    // calm smile
    `<path d="M50 66 Q60 73 70 66" stroke="rgba(0,0,0,.4)" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
    `</svg>`
  );
}

function speak(text: string): void {
  if (store.get().settings.voorlezen) narrator.speak(text);
}

function groupHtml(kenmerk: AvatarKenmerk, av: Avatar): string {
  const opties = AVATAR_KENMERKEN[kenmerk];
  const swatches = opties
    .map((o) => {
      const sel = av[kenmerk] === o.id;
      return (
        `<button class="av-swatch${sel ? ' sel' : ''}" type="button" role="radio" aria-checked="${sel}" ` +
        `data-kenmerk="${kenmerk}" data-id="${esc(o.id)}" aria-label="${esc(KENMERK_LABEL[kenmerk])}: ${esc(o.label)}">` +
        `<span class="av-chip" style="background:${o.kleur}"><span class="av-tick" aria-hidden="true">✓</span></span>` +
        `<span class="av-swatch-label">${esc(o.label)}</span>` +
        `</button>`
      );
    })
    .join('');
  return (
    `<fieldset class="av-group">` +
    `<legend class="av-legend">${esc(KENMERK_LABEL[kenmerk])}</legend>` +
    `<div class="av-swatches" role="radiogroup" aria-label="${esc(KENMERK_LABEL[kenmerk])}">${swatches}</div>` +
    `</fieldset>`
  );
}

function render(): void {
  narrator.stop();
  clearOverlays();
  const av = store.get().avatar;
  const suggesties = NAAM_SUGGESTIES.map(
    (n) => `<button class="av-naam-chip" type="button" data-naam="${esc(n)}">${esc(n)}</button>`,
  ).join('');

  const el = document.createElement('div');
  el.className = 'ra-overlay';
  el.innerHTML =
    `<div class="avatar-creator boot-card-ish">` +
    `<p class="boot-kicker">Word boswachter</p>` +
    `<h1 class="boot-title">Maak je ranger</h1>` +
    `<div class="av-preview"><div class="av-art-wrap">${rangerSvg(av)}</div><p class="av-greet"></p></div>` +
    `<label class="av-naam-veld"><span class="av-naam-cap">Je naam</span>` +
    `<input class="av-naam-input" type="text" inputmode="text" maxlength="${MAX_NAAM}" ` +
    `autocomplete="off" spellcheck="false" value="${esc(av.naam)}" aria-label="Je rangernaam"/></label>` +
    `<div class="av-naam-chips">${suggesties}</div>` +
    `<div class="av-groups">` +
    (Object.keys(AVATAR_KENMERKEN) as AvatarKenmerk[]).map((k) => groupHtml(k, av)).join('') +
    `</div>` +
    `<div class="ra-row"><button class="btn-start av-klaar" type="button">Dit is mijn ranger</button></div>` +
    `</div>`;
  host.appendChild(el);

  const input = el.querySelector<HTMLInputElement>('.av-naam-input')!;
  const artWrap = el.querySelector<HTMLDivElement>('.av-art-wrap')!;
  const greet = el.querySelector<HTMLParagraphElement>('.av-greet')!;

  // greet node is stable across repaints; only the SVG swaps on a kenmerk change
  const paintGreet = (): void => {
    greet.textContent = `Hoi, ranger ${rangerNaam(store.get().avatar)}!`;
  };
  const repaintArt = (): void => {
    artWrap.innerHTML = rangerSvg(store.get().avatar);
  };
  paintGreet();

  // name typing → live (no full re-render, keeps focus)
  input.addEventListener('input', () => {
    store.setAvatar({ naam: input.value });
    paintGreet();
  });

  // name suggestion chips
  el.querySelectorAll<HTMLButtonElement>('.av-naam-chip').forEach((b) => {
    b.addEventListener('click', () => {
      Sound.unlock(); Sound.select();
      const naam = b.dataset.naam ?? '';
      input.value = naam;
      store.setAvatar({ naam });
      paintGreet();
    });
  });

  // kenmerk swatches → live tint + selection state
  el.querySelectorAll<HTMLButtonElement>('.av-swatch').forEach((b) => {
    b.addEventListener('click', () => {
      Sound.unlock(); Sound.select();
      const kenmerk = b.dataset.kenmerk as AvatarKenmerk;
      const id = b.dataset.id ?? '';
      store.setAvatar({ [kenmerk]: id } as Partial<Avatar>);
      // update selection state within this group only
      b.closest('.av-swatches')?.querySelectorAll('.av-swatch').forEach((x) => {
        const on = x === b;
        x.classList.toggle('sel', on);
        x.setAttribute('aria-checked', String(on));
      });
      repaintArt();
    });
  });

  speak('Maak je eigen ranger. Kies een naam en hoe je eruitziet.');

  el.querySelector('.av-klaar')?.addEventListener('click', () => {
    Sound.unlock(); Sound.found();
    store.markAvatarGemaakt();
    const naam = rangerNaam(store.get().avatar);
    narrator.stop();
    speak(`Klaar, ranger ${naam}. Op naar de hut.`);
    onDone();
  });
}
