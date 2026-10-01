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
import { card, clearOverlays, kicker } from './flow/session';
import { icon } from './icons';
import { readScreenAloud } from './ReadAloud';
import { INSTELLINGEN as T, GROEI_PANEEL as G, vul } from '../content/copy';
import { growthSummary, type GrowthRow } from '../core/growth';
import { SKILL_META } from '../core/skill';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

let onBack: () => void;

/** Each on/off Tweak: a label, a one-line hint, and an optional side-effect. */
interface ToggleDef {
  key: keyof Settings;
  label: string;
  hint: string;
  effect?: (on: boolean) => void;
}
const TOGGLES: ToggleDef[] = [
  { key: 'geluid', ...T.geluid, effect: () => applyAmbient() },
  { key: 'voorlezen', ...T.voorlezen },
  { key: 'reducedMotion', ...T.rustig, effect: (on) => setReducedMotionOverride(on ? true : null) },
  { key: 'cameraDraaitMee', ...T.draaitMee },
  // W5.3 opt-in helicopter (default UIT; withheld under "Rustige beweging"). No
  // `effect`: World reads the toggle live each frame via `heliOptInSource`
  // (Missions.setHeli), so flipping it here makes the aircraft enterable with no
  // restart — the P1.5c "enable in Instellingen AND enter" path.
  { key: 'helikopter', ...T.helikopter },
  { key: 'leesFont', ...T.leesletter, effect: () => applyReadingPrefs(store.get().settings) },
  { key: 'jargon', ...T.knap },
  { key: 'autoMoeilijk', ...T.passend },
  { key: 'force2d', ...T.plat },
];

// consequence severity (§3: default MILD; Floris can dial up) — three calm steps
const ERNST: { id: Settings['gevolgErnst']; label: string }[] = [
  { id: 'assist', label: T.ernst.assist },
  { id: 'mild', label: T.ernst.mild },
  { id: 'stevig', label: T.ernst.stevig },
];

// on-screen joystick (W1.3): default follows the pointer (touch → aan, laptop → uit)
const JOYSTICK: { id: Settings['joystick']; label: string }[] = [
  { id: 'auto', label: T.stickKeus.auto },
  { id: 'aan', label: T.stickKeus.aan },
  { id: 'uit', label: T.stickKeus.uit },
];

// a small calm accent palette (the gold default + heath/forest/water/warm)
const ACCENTEN = ['#f5c23b', '#9a6aa8', '#5d7340', '#4a6b78', '#d9b89a'];

export function showTweaks(back: () => void): void {
  onBack = back;
  render();
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
    `<span class="tw-state">${on ? T.aan : T.uit}</span></span>` +
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
    `<div class="tw-field"><span class="tw-field-label">${esc(T.spannend)}</span>` +
    `<div class="tw-seg" role="radiogroup" aria-label="${esc(T.spannend)}">${btns}</div></div>`
  );
}

function joystickHtml(): string {
  const cur = store.get().settings.joystick;
  const btns = JOYSTICK.map(
    (o) => `<button class="tw-seg-opt${o.id === cur ? ' sel' : ''}" type="button" role="radio" ` +
      `aria-checked="${o.id === cur}" data-joy="${o.id}">${esc(o.label)}</button>`,
  ).join('');
  return (
    `<div class="tw-field"><span class="tw-field-label">${esc(T.stick)}</span>` +
    `<div class="tw-seg" role="radiogroup" aria-label="${esc(T.stick)}">${btns}</div></div>`
  );
}

function accentHtml(): string {
  const cur = store.get().settings.accent;
  const sw = ACCENTEN.map(
    (c) => `<button class="tw-acc${c === cur ? ' sel' : ''}" type="button" role="radio" ` +
      `aria-checked="${c === cur}" data-acc="${esc(c)}" style="background:${esc(c)}" ` +
      `aria-label="${esc(T.kleur)}"><span class="tw-acc-tick">${icon('check')}</span></button>`,
  ).join('');
  return (
    `<div class="tw-field"><span class="tw-field-label">${esc(T.kleur)}</span>` +
    `<div class="tw-accents" role="radiogroup" aria-label="${esc(T.kleur)}">${sw}</div></div>`
  );
}

/** Run 7 (design §5.9): the grown-ups' "Groei" panel, collapsed at the bottom: per
 *  breinkracht the level now, the best, the beats this week and what he played at his best
 *  (core/growth.ts). Plain text; never shown to the child anywhere else. */
function groeiHtml(): string {
  const s = store.get();
  const rows = growthSummary(s.geschiedenis, s.skill, Date.now());
  const num = (v: number): string => v.toFixed(1).replace('.', ',');
  const maat = (r: GrowthRow): string =>
    r.span != null ? String(r.span)
      : r.findS != null ? vul(G.seconden, { s: num(r.findS) })
        : r.holdS != null ? vul(G.seconden, { s: num(r.holdS) })
          : '·';
  const body = rows.some((r) => r.beats > 0)
    ? `<table class="tw-groei-tabel"><thead><tr><th>${esc(G.kracht)}</th><th>${esc(G.nu)}</th><th>${esc(G.best)}</th><th>${esc(G.week)}</th><th>${esc(G.maat)}</th></tr></thead><tbody>` +
      rows.map((r) => `<tr data-engine="${r.engine}"><td>${esc(SKILL_META[r.engine].naam)}</td><td>${num(r.level)}</td><td>${num(r.best)}</td><td>${r.week}</td><td>${esc(maat(r))}</td></tr>`).join('') +
      `</tbody></table>`
    : `<p class="tw-groei-leeg">${esc(G.nogNiet)}</p>`;
  return `<details class="tw-groei"><summary>${esc(G.titel)}</summary><p class="tw-groei-uitleg">${esc(G.uitleg)}</p>${body}</details>`;
}

function render(): void {
  narrator.stop();
  const s = store.get().settings;

  // "Klaar" sits in the pinned footer: never below the fold at 1280×800 (breaker B3)
  const el = card(
    `<div class="card card--narrow tweaks">` +
    kicker('gear', T.kicker) +
    `<h1 class="boot-title">${esc(T.titel)}</h1>` +
    `<div class="card-body">` +
    `<div class="tw-list">` +
    TOGGLES.map(toggleHtml).join('') +
    sliderHtml('readSize', T.tekst, READ_SIZE.min, READ_SIZE.max, READ_SIZE.step, s.readSize,
      (n) => `${Math.round(n)}px`) +
    sliderHtml('leading', T.regels, LEADING.min, LEADING.max, LEADING.step, s.leading,
      (n) => n.toFixed(1)) +
    sliderHtml('ambient', T.bos, 0, 1, 0.05, s.ambient,
      (n) => `${Math.round(n * 100)}%`) +
    segHtml() +
    joystickHtml() +
    accentHtml() +
    groeiHtml() +
    `</div>` +
    `</div>` +
    `<div class="card-foot"><div class="ra-row">` +
    `<button class="btn-start tw-back" type="button" data-key="back">${esc(T.klaar)}</button>` +
    `</div></div>` +
    `</div>`,
  );

  // ---- toggles ----
  el.querySelectorAll<HTMLButtonElement>('.tw-toggle').forEach((b) => {
    b.addEventListener('click', () => {
      const key = b.dataset.key as keyof Settings;
      const next = !(store.get().settings[key] as boolean);
      store.setSetting({ [key]: next } as Partial<Settings>);
      b.classList.toggle('on', next);
      b.setAttribute('aria-checked', String(next));
      const state = b.querySelector('.tw-state');
      if (state) state.textContent = next ? T.aan : T.uit;
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

  // ---- gevolgErnst segmented (scoped to [data-ernst]: the joystick group
  //      shares the .tw-seg-opt look but must not cross-fire) ----
  el.querySelectorAll<HTMLButtonElement>('[data-ernst]').forEach((b) => {
    b.addEventListener('click', () => {
      const ernst = b.dataset.ernst as Settings['gevolgErnst'];
      store.setSetting({ gevolgErnst: ernst });
      el.querySelectorAll('[data-ernst]').forEach((o) => {
        const sel = o === b;
        o.classList.toggle('sel', sel);
        o.setAttribute('aria-checked', String(sel));
      });
      select();
    });
  });

  // ---- joystick visibility segmented ----
  el.querySelectorAll<HTMLButtonElement>('[data-joy]').forEach((b) => {
    b.addEventListener('click', () => {
      const joy = b.dataset.joy as Settings['joystick'];
      store.setSetting({ joystick: joy });
      el.querySelectorAll('[data-joy]').forEach((o) => {
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

  // what the screen is, and each switch says what it does on hover or focus (child:B12)
  const voor = s.voorlezen;
  const ra = readScreenAloud(el, {
    text: T.zeg, anchor: '.tw-back', autoStart: voor, items: '.tw-toggle', hover: voor,
    itemText: (b) => {
      const d = TOGGLES.find((t) => t.key === b.dataset.key);
      return d ? `${d.label}. ${d.hint}.` : '';
    },
  });

  el.querySelector('.tw-back')?.addEventListener('click', () => {
    ra.stop();
    clearOverlays();
    onBack();
  });
}
