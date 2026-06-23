/**
 * Tweaks.ts — the settings/preferences panel (BUILD-PLAN §3, Phase 6). A DOM
 * overlay over the 3D stage, reachable from the lodge. Exposes EVERY `Settings`
 * field and wires each to `store.setSetting` + its live side-effect, so a change
 * takes effect immediately with no restart:
 *   - reducedMotion → setReducedMotionOverride (manual wins; off = defer to OS)
 *   - leesFont/readSize/leading/accent → applyReadingPrefs (re-flows :root vars)
 *   - geluid/ambient → applyAmbient (start/stop/re-gain the ambience bed)
 *   - jargon/gevolgErnst/autoMoeilijk/voorlezen/force2d → plain setSetting
 *
 * Accessibility: ≥56px controls, dual-channel feedback (colour + state word +
 * knob position + a soft select sound), read-aloud-friendly labels, reduced-
 * motion-safe (the `.rm` body class calms transitions; nothing here animates
 * essential meaning). The maths is pure in core/reading-prefs.ts; this is view.
 */

import './tweaks.css';
import { store, type Settings } from '../core/state';
import { Sound } from '../core/sound';
import { narrator } from '../core/narrator';
import { setReducedMotionOverride } from '../core/reduced-motion';
import { applyReadingPrefs, READ_SIZE, LEADING } from '../core/reading-prefs';
import { applyAmbient } from '../core/calls';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

let host: HTMLElement;
let onBack: () => void;

/** Each on/off Tweak: a label, a one-line hint, and an optional side-effect. */
interface ToggleDef {
  key: keyof Settings;
  label: string;
  hint: string;
  effect?: (on: boolean) => void;
}
const TOGGLES: ToggleDef[] = [
  { key: 'geluid', label: 'Geluid', hint: 'Tonen en dierengeluiden', effect: () => applyAmbient() },
  { key: 'voorlezen', label: 'Voorlezen', hint: 'De ranger leest de tekst voor' },
  {
    key: 'reducedMotion', label: 'Rustige beweging', hint: 'De camera springt zacht, niet zwierend',
    effect: (on) => setReducedMotionOverride(on ? true : null),
  },
  {
    key: 'leesFont', label: 'Leesletter', hint: 'Extra duidelijke letters',
    effect: () => applyReadingPrefs(store.get().settings),
  },
  { key: 'jargon', label: 'Knappe woorden', hint: 'Echte natuurwoorden zoals frisling en ven' },
  { key: 'autoMoeilijk', label: 'Vanzelf passend', hint: 'Het spel groeit met jou mee' },
  { key: 'force2d', label: 'Platte weergave', hint: 'Speel altijd op de rustige platte vlakte' },
];

// consequence severity (§3: default MILD; Floris can dial up) — three calm steps
const ERNST: { id: Settings['gevolgErnst']; label: string }[] = [
  { id: 'assist', label: 'Heel rustig' },
  { id: 'mild', label: 'Rustig' },
  { id: 'stevig', label: 'Spannender' },
];

// a small calm accent palette (the gold default + heath/forest/water/warm)
const ACCENTEN = ['#f5c23b', '#9a6aa8', '#5d7340', '#4a6b78', '#d9b89a'];

export function showTweaks(ui: HTMLElement, back: () => void): void {
  host = ui;
  onBack = back;
  render();
}

function clearOverlays(): void {
  host.querySelectorAll('.ra-overlay').forEach((n) => n.remove());
}

function select(): void {
  if (store.get().settings.geluid) Sound.select();
}

function toggleHtml(d: ToggleDef): string {
  const on = store.get().settings[d.key] as boolean;
  return (
    `<button class="tw-toggle${on ? ' on' : ''}" type="button" role="switch" aria-checked="${on}" ` +
    `data-key="${d.key}" aria-label="${esc(d.label)}">` +
    `<span class="tw-toggle-text"><span class="tw-toggle-label">${esc(d.label)}</span>` +
    `<span class="tw-toggle-hint">${esc(d.hint)}</span></span>` +
    `<span class="tw-switch" aria-hidden="true"><span class="tw-knob"></span>` +
    `<span class="tw-state">${on ? 'aan' : 'uit'}</span></span>` +
    `</button>`
  );
}

function sliderHtml(key: 'readSize' | 'leading' | 'ambient', label: string,
                    min: number, max: number, step: number, val: number, fmt: (n: number) => string): string {
  return (
    `<div class="tw-slider">` +
    `<label class="tw-slider-top" for="tw-${key}"><span>${esc(label)}</span>` +
    `<span class="tw-val" data-val="${key}">${esc(fmt(val))}</span></label>` +
    `<input id="tw-${key}" class="tw-range" type="range" data-key="${key}" ` +
    `min="${min}" max="${max}" step="${step}" value="${val}">` +
    `</div>`
  );
}

function segHtml(): string {
  const cur = store.get().settings.gevolgErnst;
  const btns = ERNST.map(
    (o) => `<button class="tw-seg-opt${o.id === cur ? ' sel' : ''}" type="button" role="radio" ` +
      `aria-checked="${o.id === cur}" data-ernst="${o.id}">${esc(o.label)}</button>`,
  ).join('');
  return (
    `<div class="tw-field"><span class="tw-field-label">Hoe spannend</span>` +
    `<div class="tw-seg" role="radiogroup" aria-label="Hoe spannend">${btns}</div></div>`
  );
}

function accentHtml(): string {
  const cur = store.get().settings.accent;
  const sw = ACCENTEN.map(
    (c) => `<button class="tw-acc${c === cur ? ' sel' : ''}" type="button" role="radio" ` +
      `aria-checked="${c === cur}" data-acc="${esc(c)}" style="background:${esc(c)}" ` +
      `aria-label="Accentkleur"><span class="tw-acc-tick" aria-hidden="true">✓</span></button>`,
  ).join('');
  return (
    `<div class="tw-field"><span class="tw-field-label">Accentkleur</span>` +
    `<div class="tw-accents" role="radiogroup" aria-label="Accentkleur">${sw}</div></div>`
  );
}

function render(): void {
  narrator.stop();
  clearOverlays();
  const s = store.get().settings;

  const el = document.createElement('div');
  el.className = 'ra-overlay';
  el.innerHTML =
    `<div class="tweaks boot-card-ish">` +
    `<p class="boot-kicker">Instellingen</p>` +
    `<h1 class="boot-title">Maak het van jou</h1>` +
    `<div class="tw-list">` +
    TOGGLES.map(toggleHtml).join('') +
    sliderHtml('readSize', 'Tekstgrootte', READ_SIZE.min, READ_SIZE.max, READ_SIZE.step, s.readSize,
      (n) => `${Math.round(n)}px`) +
    sliderHtml('leading', 'Regelafstand', LEADING.min, LEADING.max, LEADING.step, s.leading,
      (n) => n.toFixed(1)) +
    sliderHtml('ambient', 'Omgevingsgeluid', 0, 1, 0.05, s.ambient,
      (n) => `${Math.round(n * 100)}%`) +
    segHtml() +
    accentHtml() +
    `</div>` +
    `<div class="ra-row">` +
    `<button class="btn-start tw-back" type="button">Klaar</button>` +
    `</div>` +
    `</div>`;
  host.appendChild(el);

  // ---- toggles ----
  el.querySelectorAll<HTMLButtonElement>('.tw-toggle').forEach((b) => {
    b.addEventListener('click', () => {
      const key = b.dataset.key as keyof Settings;
      const next = !(store.get().settings[key] as boolean);
      store.setSetting({ [key]: next } as Partial<Settings>);
      b.classList.toggle('on', next);
      b.setAttribute('aria-checked', String(next));
      const state = b.querySelector('.tw-state');
      if (state) state.textContent = next ? 'aan' : 'uit';
      TOGGLES.find((d) => d.key === key)?.effect?.(next);
      select();
    });
  });

  // ---- sliders ----
  el.querySelectorAll<HTMLInputElement>('.tw-range').forEach((r) => {
    const key = r.dataset.key as 'readSize' | 'leading' | 'ambient';
    const valEl = el.querySelector<HTMLElement>(`.tw-val[data-val="${key}"]`);
    const fmt = (n: number): string =>
      key === 'readSize' ? `${Math.round(n)}px` : key === 'leading' ? n.toFixed(1) : `${Math.round(n * 100)}%`;
    r.addEventListener('input', () => {
      const n = Number(r.value);
      if (valEl) valEl.textContent = fmt(n);          // live label (no persist on every tick)
      store.setSetting({ [key]: n } as Partial<Settings>);
      if (key === 'ambient') applyAmbient();
      else applyReadingPrefs(store.get().settings);
    });
    r.addEventListener('change', () => select());     // one soft confirm on release
  });

  // ---- gevolgErnst segmented ----
  el.querySelectorAll<HTMLButtonElement>('.tw-seg-opt').forEach((b) => {
    b.addEventListener('click', () => {
      const ernst = b.dataset.ernst as Settings['gevolgErnst'];
      store.setSetting({ gevolgErnst: ernst });
      el.querySelectorAll('.tw-seg-opt').forEach((o) => {
        const sel = o === b;
        o.classList.toggle('sel', sel);
        o.setAttribute('aria-checked', String(sel));
      });
      select();
    });
  });

  // ---- accent swatches ----
  el.querySelectorAll<HTMLButtonElement>('.tw-acc').forEach((b) => {
    b.addEventListener('click', () => {
      const acc = b.dataset.acc!;
      store.setSetting({ accent: acc });
      applyReadingPrefs(store.get().settings);
      el.querySelectorAll('.tw-acc').forEach((o) => {
        const sel = o === b;
        o.classList.toggle('sel', sel);
        o.setAttribute('aria-checked', String(sel));
      });
      select();
    });
  });

  el.querySelector('.tw-back')?.addEventListener('click', () => {
    clearOverlays();
    onBack();
  });
}
