/**
 * ExploreHud.ts — the HUD over the live free-roam world: the Pauze pill, the
 * wayfinding chip, the proximity prompts (mission marker, missiebord, bird bench,
 * jeep, helicopter), the sequenced onboarding hints, the laptop help chip and the
 * on-screen joystick. It only overlays the world; the world stays live beneath it
 * and taps fall through to the canvas (tap-to-walk).
 */

import { store } from '../../core/state';
import { Content } from '../../content/registry';
import { narrator } from '../../core/narrator';
import { joystickVisible } from '../../core/input';
import { onboardHint, ONBOARD_TAP, ONBOARD_BOUNDARY } from '../../core/onboarding';
import { provideHint } from '../../core/devhook';
import { ROEP_COPY } from '../../engines/roep';
import type { WayCue } from '../../render3d/Wayfinding';
import { Joystick } from '../Joystick';
import { session, esc, plainCard } from '../flow/session';
import { showBriefing } from '../flow/MissionFlow';
import { playRoepAtSitSpot } from '../flow/WorldSession';
import { showPauseHub, showMissionBoard } from '../hub/Hub';

// the on-screen joystick (W1.3) lives inside the explore HUD; re-created each
// time the HUD renders, disposed here so its listeners never outlive the world.
let joystick: Joystick | null = null;
// rAF handle for the onboarding-hint movement watcher (dismiss-on-first-step).
let onboardRaf = 0;

// RUN-3 P3.3 · the ONE sequenced onboarding-hint system (F-06 + F-15 + F-11 + F-13).
// At the first world entry exactly ONE hint is on screen — the control line — and
// both the wayfinding tracker and the "tik op een dier" tip wait until it seals on
// the first step. `active` is the single hint currently visible; mirrored on the dev
// hook (`provideHint`). `helpChip` tracks the laptop "?" re-show chip (F-15).
const hintState: { active: 'walk' | 'tap' | 'boundary' | null; helpChip: boolean } = {
  active: null,
  helpChip: false,
};
// timeout handle for the single transient tip; one at a time.
let tipTimer = 0;
function hintSnapshot(): { active: 'walk' | 'tap' | 'boundary' | null; walkSeen: boolean; tapSeen: boolean; helpChip: boolean } {
  const s = store.get().settings;
  return { active: hintState.active, walkSeen: s.wereldHintGezien, tapSeen: s.tikHintGezien, helpChip: hintState.helpChip };
}

/** Stop every HUD loop/timer and drop the joystick (the world is going away). */
export function disposeExploreHud(): void {
  if (onboardRaf) { cancelAnimationFrame(onboardRaf); onboardRaf = 0; }
  if (tipTimer) { clearTimeout(tipTimer); tipTimer = 0; }
  hintState.active = null; hintState.helpChip = false;
  if (joystick) { joystick.dispose(); joystick = null; }
}

export function showExploreHud(activeTitel: string | null): void {
  const world = session.world;
  // F-06 sequencing: hold the wayfinding tracker back while the entry control hint
  // is still on screen (the first-ever entry, before the first step).
  const trackerGated = !!world && !store.get().settings.wereldHintGezien;
  const veld = activeTitel
    ? `<div class="explore-wayfind" role="status" aria-live="polite"${trackerGated ? ' hidden' : ''}>` +
      `<span class="wf-glyph" aria-hidden="true">·</span>` +
      `<span class="wf-text"><b class="wf-doel">${esc(activeTitel)}</b><span class="wf-cue">zoek het spoor…</span></span>` +
      `</div>`
    : '';
  const el = plainCard(
    `<div class="explore-hud">` +
    `<button class="ra-pill explore-pause" type="button" data-key="pause">⏸ Pauze</button>` +
    veld +
    `<div class="explore-prompt" hidden></div>` +
    `<div class="explore-hub-prompt" hidden></div>` +
    `<div class="explore-sit-prompt" hidden></div>` +
    `<div class="explore-vehicle-prompt" hidden></div>` +
    `<div class="explore-heli-prompt" hidden></div>` +
    // W5.3b: the cockpit frame overlay shown while flying (pointer-events:none).
    `<div class="explore-heli-cockpit" hidden aria-hidden="true"><div class="explore-heli-vignette"></div></div>` +
    `</div>`,
  );
  // The HUD overlays the LIVE world: its wrapper must let taps fall through to the
  // canvas for tap-to-walk (W0.4); `.explore-overlay` reclaims transparency.
  el.classList.add('explore-overlay');
  el.querySelector('.explore-pause')?.addEventListener('click', () => showPauseHub());
  const hud = el.querySelector<HTMLElement>('.explore-hud');
  mountJoystick(hud);
  mountOnboardHint(hud);
  mountHelpChip(hud); // F-15: laptop "?" chip re-shows the control hint on demand
  provideHint(hintSnapshot);
  // The World only re-fires its onNear callbacks on a proximity CHANGE, so a fresh
  // HUD re-surfaces whatever the ranger is already standing at.
  onApproach(world?.nearMission() ?? null);
  if (world?.boardState()?.near) onBoardApproach(true);
  if (world?.sitSpotState()?.near) onSitSpotApproach(true);
  renderVehiclePrompt();
  heliPromptKey = '';
  renderHeliPrompt();
  setHeliCockpit(world?.heliState()?.inHeli ?? false);
}

/* ------------------------------------------------ one prompt at a time ---- */
/** The proximity prompts share ONE place on screen (bottom centre), so only the
 *  most important one shows: never two buttons on top of each other, and Space /
 *  Enter always does what the one visible button says. On foot: a mission first,
 *  then the jeep, the helicopter, the missiebord, the bird bench. In a vehicle,
 *  only getting out (or landing) — markers are not offered from a seat. */
const FOOT_ORDER = ['.explore-prompt', '.explore-vehicle-prompt', '.explore-heli-prompt', '.explore-hub-prompt', '.explore-sit-prompt'];
const RIDING_ORDER = ['.explore-vehicle-prompt', '.explore-heli-prompt'];

function arbitratePrompts(): void {
  const w = session.world;
  const riding = !!(w?.vehicleState()?.inVehicle || w?.heliState()?.inHeli);
  const order = riding ? RIDING_ORDER : FOOT_ORDER;
  let shown = false;
  for (const sel of FOOT_ORDER) {
    const slot = session.host.querySelector<HTMLElement>(sel);
    if (!slot) continue;
    const show = !shown && order.includes(sel) && slot.childElementCount > 0;
    slot.hidden = !show;
    if (show) shown = true;
  }
}

/* ----------------------------------------------------------- vehicles ---- */
/** W5.1: the jeep affordance — "Stap in de jeep" beside the parked jeep, "Stap uit"
 *  while driving. Reads the live `vehicleState()` so a HUD re-render restores it. */
export function renderVehiclePrompt(): void {
  const prompt = session.host.querySelector<HTMLDivElement>('.explore-vehicle-prompt');
  if (!prompt) return;
  const v = session.world?.vehicleState() ?? null;
  if (!v || (!v.near && !v.inVehicle)) prompt.innerHTML = '';
  else if (v.inVehicle) {
    prompt.innerHTML = `<button class="btn-start explore-vehicle-exit" type="button">🚙 Stap uit</button>`;
    prompt.querySelector('.explore-vehicle-exit')?.addEventListener('click', () => session.world?.exitVehicle());
  } else {
    prompt.innerHTML = `<button class="btn-start explore-vehicle-enter" type="button">🚙 Stap in de jeep</button>`;
    prompt.querySelector('.explore-vehicle-enter')?.addEventListener('click', () => session.world?.enterVehicle());
  }
  arbitratePrompts();
}

/** W5.3b: the helicopter affordance — "Stap in de helikopter" beside a parked heli,
 *  a calm "aan de grond" note when it is withheld, "Land hier" over a pad, and a
 *  "vlieg naar een helipad" hint while flying off a pad. */
let heliPromptKey = '';
export function renderHeliPrompt(): void {
  const prompt = session.host.querySelector<HTMLDivElement>('.explore-heli-prompt');
  if (!prompt) return;
  const h = session.world?.heliState() ?? null;
  // Debounce: this runs every flight frame (via setHeliVignette); only rebuild the
  // DOM when the affordance actually changes.
  const key = !h ? 'none'
    : h.inHeli ? (h.onPad ? 'land' : 'flyhint')
    : h.near ? (h.available ? 'enter' : h.optIn ? 'reduced' : 'off')
    : 'none';
  if (key === heliPromptKey) return;
  heliPromptKey = key;
  if (!h || (!h.near && !h.inHeli)) prompt.innerHTML = '';
  else if (h.inHeli) {
    if (h.onPad) {
      prompt.innerHTML = `<button class="btn-start explore-heli-land" type="button">🚁 Land hier</button>`;
      prompt.querySelector('.explore-heli-land')?.addEventListener('click', () => session.world?.landHeli());
    } else {
      prompt.innerHTML = `<p class="explore-heli-hint">Vlieg naar een helipad om te landen.</p>`;
    }
  } else if (h.available) {
    prompt.innerHTML = `<button class="btn-start explore-heli-enter" type="button">🚁 Stap in de helikopter</button>`;
    prompt.querySelector('.explore-heli-enter')?.addEventListener('click', () => session.world?.enterHeli());
  } else {
    // near, but withheld. optIn true → reduced-motion; optIn false → toggle is UIT.
    const msg = h.optIn
      ? 'De helikopter blijft nu aan de grond.'
      : 'Zet de helikopter aan bij Instellingen.';
    prompt.innerHTML = `<p class="explore-heli-hint">${msg}</p>`;
  }
  arbitratePrompts();
}

/** W5.3b: show/hide the cockpit frame overlay on lift-off/touchdown. */
export function setHeliCockpit(inHeli: boolean): void {
  const frame = session.host.querySelector<HTMLDivElement>('.explore-heli-cockpit');
  if (frame) frame.hidden = !inHeli;
}

/** W5.3b: drive the motion-vignette opacity each flight frame (0 at hover). */
export function setHeliVignette(v: number): void {
  const vig = session.host.querySelector<HTMLDivElement>('.explore-heli-vignette');
  if (vig) vig.style.opacity = String(v);
  renderHeliPrompt(); // onPad may have flipped → swap "Land hier" ⇄ hint
}

/* ------------------------------------------------------------ hints ---- */
/** The first-world-entry CONTROL hint — step 1 of the P3.3 sequence (F-06). Shows
 *  ONCE (`wereldHintGezien`), device-aware, and dismisses itself on the ranger's
 *  first step; sealing surfaces the tracker and the one-off "tik op een dier" tip. */
function mountOnboardHint(hud: HTMLElement | null): void {
  if (onboardRaf) { cancelAnimationFrame(onboardRaf); onboardRaf = 0; }
  const world = session.world;
  if (!hud || !world || store.get().settings.wereldHintGezien) return;
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const stick = joystickVisible(store.get().settings.joystick, coarse);
  const text = onboardHint(stick);
  const el = document.createElement('div');
  el.className = 'explore-onboard';
  el.setAttribute('role', 'status');
  el.innerHTML =
    `<span class="ob-icon" aria-hidden="true">${stick ? '🕹️' : '⌨️'}</span>` +
    `<span class="ob-text">${esc(text)}</span>`;
  hud.appendChild(el);
  hintState.active = 'walk';
  if (store.get().settings.voorlezen) narrator.speak(text);

  const start = world.pos();
  const seal = (): void => {
    if (onboardRaf) { cancelAnimationFrame(onboardRaf); onboardRaf = 0; }
    el.remove();
    hintState.active = null;
    if (!store.get().settings.wereldHintGezien) store.setSetting({ wereldHintGezien: true });
    revealTracker();
    if (!store.get().settings.tikHintGezien) {
      store.setSetting({ tikHintGezien: true });
      showTip('tap', ONBOARD_TAP);
    }
  };
  const watch = (): void => {
    onboardRaf = 0;
    const w = session.world;
    if (!w || !el.isConnected) return; // world gone or HUD re-rendered → stop
    const p = w.pos();
    if (start && p && Math.hypot(p.x - start.x, p.z - start.z) >= 0.6) { seal(); return; }
    onboardRaf = requestAnimationFrame(watch);
  };
  onboardRaf = requestAnimationFrame(watch);
}

/** F-06: surface the wayfinding tracker once the entry control hint has sealed. */
function revealTracker(): void {
  const strip = session.host.querySelector<HTMLDivElement>('.explore-wayfind');
  if (strip) strip.hidden = false;
}

/** RUN-3 P3.3 · the ONE transient-tip channel (tap tip · boundary cue · help
 *  re-show). A short hint that fades on its own after `ms`; only one on screen. */
function showTip(id: 'walk' | 'tap' | 'boundary', text: string, ms = 5200): void {
  const hud = session.host.querySelector<HTMLElement>('.explore-hud');
  if (!hud) return;
  session.host.querySelectorAll('.explore-tip').forEach((n) => n.remove());
  if (tipTimer) { clearTimeout(tipTimer); tipTimer = 0; }
  const el = document.createElement('p');
  el.className = 'explore-tip';
  el.setAttribute('role', 'status');
  el.textContent = text;
  hud.appendChild(el);
  hintState.active = id;
  if (store.get().settings.voorlezen) narrator.speak(text);
  tipTimer = window.setTimeout(() => {
    el.remove();
    tipTimer = 0;
    if (hintState.active === id) hintState.active = null;
  }, ms);
}

/** F-11: the calm world-boundary cue, through the same one-tip channel. */
export function showBoundaryHint(): void {
  showTip('boundary', ONBOARD_BOUNDARY);
}

/** F-15: a small persistent LAPTOP help chip ("?") that re-shows the control hint
 *  on demand. Skipped on a coarse pointer, where the joystick is self-evident. */
function mountHelpChip(hud: HTMLElement | null): void {
  hintState.helpChip = false;
  if (!hud || !session.world) return;
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const stick = joystickVisible(store.get().settings.joystick, coarse);
  if (stick) return;
  const btn = document.createElement('button');
  btn.className = 'ra-pill explore-help';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Toon de besturing');
  btn.textContent = '?';
  hud.appendChild(btn);
  hintState.helpChip = true;
  btn.addEventListener('click', () => showTip('walk', onboardHint(false)));
}

/** Build + wire the virtual joystick (W1.3) into the freshly-rendered HUD; the old
 *  instance is disposed first — no listeners on detached nodes, no double stick. */
function mountJoystick(hud: HTMLElement | null): void {
  if (joystick) { joystick.dispose(); joystick = null; }
  const world = session.world;
  if (!hud || !world) return;
  const js = new Joystick();
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  js.setVisible(joystickVisible(store.get().settings.joystick, coarse));
  hud.appendChild(js.el);
  world.setJoystick(() => js.vector());
  joystick = js;
}

/* ------------------------------------------------------- wayfinding ---- */
/** Render the calm wayfinding cue (dual-channel: glyph + words + colour). */
export function onWayfind(cue: WayCue | null): void {
  const strip = session.host.querySelector<HTMLDivElement>('.explore-wayfind');
  if (!strip) return;
  if (!cue) { strip.hidden = true; return; }
  // F-06: keep the text fresh, but stay hidden while the entry control hint owns
  // the screen — the seal (revealTracker) surfaces it on the first step.
  if (store.get().settings.wereldHintGezien) strip.hidden = false;
  const glyph = strip.querySelector<HTMLSpanElement>('.wf-glyph');
  const cueEl = strip.querySelector<HTMLSpanElement>('.wf-cue');
  if (glyph) glyph.textContent = cue.glyph;
  if (cueEl) cueEl.textContent = cue.arrived ? 'je bent er' : `${cue.richting} · ${cue.afstand}`;
  strip.classList.toggle('wf-arrived', cue.arrived);
}

/* ------------------------------------------------- proximity prompts ---- */
let approachId: string | null = null;
export function onApproach(missionId: string | null): void {
  approachId = missionId;
  const prompt = session.host.querySelector<HTMLDivElement>('.explore-prompt');
  if (!prompt) return;
  const m = missionId ? Content.activeArea().missies.find((mm) => mm.id === missionId) : null;
  if (!m) prompt.innerHTML = '';
  else {
    prompt.innerHTML = `<button class="btn-start explore-play" type="button">Speel mee: ${esc(m.titel)}</button>`;
    prompt.querySelector('.explore-play')?.addEventListener('click', () => {
      if (approachId !== m.id) return;
      showBriefing(m);
    });
  }
  arbitratePrompts();
}

/** The Space/Enter interact key (W1.4) — the laptop twin of the "Speel mee" tap.
 *  Guarded: the affordance must be on screen and the proximity id must match. */
export function onInteract(missionId: string): void {
  const prompt = session.host.querySelector<HTMLDivElement>('.explore-prompt');
  if (!prompt || prompt.hidden) return;
  if (approachId !== missionId) return;
  const m = Content.activeArea().missies.find((mm) => mm.id === missionId);
  if (!m) return;
  showBriefing(m);
}

/** The spawn missiebord proximity affordance (W2.2). */
export function onBoardApproach(near: boolean): void {
  const prompt = session.host.querySelector<HTMLDivElement>('.explore-hub-prompt');
  if (!prompt) return;
  if (!near) prompt.innerHTML = '';
  else {
    prompt.innerHTML = `<button class="btn-start explore-board-open" type="button">Bekijk het missiebord</button>`;
    prompt.querySelector('.explore-board-open')?.addEventListener('click', tryOpenBoard);
  }
  arbitratePrompts();
}

/** Guarded entry to the mission board (button tap OR the interact key). */
export function tryOpenBoard(): void {
  const prompt = session.host.querySelector<HTMLDivElement>('.explore-hub-prompt');
  if (!prompt || prompt.hidden) return;
  showMissionBoard();
}

/** The "Ken je roep" sit-spot affordance (W6.4b2). */
export function onSitSpotApproach(near: boolean): void {
  const prompt = session.host.querySelector<HTMLDivElement>('.explore-sit-prompt');
  if (!prompt) return;
  if (!near) prompt.innerHTML = '';
  else {
    prompt.innerHTML = `<button class="btn-start explore-sit-play" type="button">${esc(ROEP_COPY.zit)}</button>`;
    prompt.querySelector('.explore-sit-play')?.addEventListener('click', tryPlayRoep);
  }
  arbitratePrompts();
}

/** Guarded entry to the roep slice (button tap OR the interact key). */
export function tryPlayRoep(): void {
  const prompt = session.host.querySelector<HTMLDivElement>('.explore-sit-prompt');
  if (!prompt || prompt.hidden) return;
  void playRoepAtSitSpot();
}
