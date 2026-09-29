/**
 * ExploreHud.ts — the HUD over the live free-roam world: the Pauze pill, the
 * wayfinding chip, the proximity prompts (mission marker, missiebord, bird bench,
 * jeep, helicopter), the teaching slot (Bram's speaker strip or one lesson, run 6:
 * ui/hud/Lessons.ts), the "?" chip (the "Zo speel je" card) and the on-screen joystick.
 * It only overlays the world; the world stays live beneath it and taps fall through to
 * the canvas (tap-to-walk).
 */

import { store } from '../../core/state';
import { Content } from '../../content/registry';
import { narrator } from '../../core/narrator';
import { joystickVisible } from '../../core/input';
import { ONBOARD_BOUNDARY, ONBOARD_DRIVE } from '../../core/onboarding';
import { provideHint, type HintState } from '../../core/devhook';
import { ROEP_COPY } from '../../engines/roep';
import type { WayCue } from '../../render3d/Wayfinding';
import { Joystick } from '../Joystick';
import { coarsePointer } from './device';
import { session, esc, plainCard } from '../flow/session';
import { showBriefing, goToMission } from '../flow/MissionFlow';
import { playRoepAtSitSpot, nextMissionId } from '../flow/WorldSession';
import { showPauseHub, showMissionBoard, showControls } from '../hub/Hub';
import { startGuide, stopGuide, mountGuide, chipHeld, guideSnapshot } from './Lessons';

// the on-screen joystick (W1.3) lives inside the explore HUD; re-created each
// time the HUD renders, disposed here so its listeners never outlive the world.
let joystick: Joystick | null = null;

// The one transient tip (the calm world-rim cue); the lessons and Bram's lines live in
// the teaching slot (ui/hud/Lessons.ts). `helpChip`: the "?" chip is mounted.
const tipState: { active: 'boundary' | null; helpChip: boolean } = { active: null, helpChip: false };
// timeout handle for the single transient tip; one at a time.
let tipTimer = 0;
function hintSnapshot(): HintState {
  return { ...guideSnapshot(), tip: tipState.active, helpChip: tipState.helpChip };
}

/** Play begins (WorldSession.enterPlay): the first minute starts (Bram, the lessons). */
export function beginGuide(returning: boolean): void {
  startGuide({ returning });
}

/** Stop every HUD loop/timer and drop the joystick (the world is going away). */
export function disposeExploreHud(): void {
  if (tipTimer) { clearTimeout(tipTimer); tipTimer = 0; }
  tipState.active = null; tipState.helpChip = false;
  stopGuide();
  if (joystick) { joystick.dispose(); joystick = null; }
}

export function showExploreHud(activeTitel: string | null): void {
  const world = session.world;
  // run 6: the chip waits for Bram's hook (a new boswachter has not been told yet)
  const held = !!world && chipHeld();
  const veld = activeTitel
    ? `<div class="explore-wayfind" role="status" aria-live="polite"${held ? ' hidden' : ''}>` +
      `<span class="wf-glyph" aria-hidden="true">·</span>` +
      `<span class="wf-text"><b class="wf-doel">${esc(activeTitel)}</b><span class="wf-cue">zoek het spoor…</span></span>` +
      `</div>`
    : '';
  // every mission done: no way to point any more — the chip says the season is done
  const allDone = !activeTitel && Content.activeArea().missies.every((m) => store.get().voltooid[m.id]);
  const klaar = allDone
    ? `<div class="explore-klaar" role="status">` +
      `<span class="wf-glyph" aria-hidden="true">✓</span>` +
      `<span class="wf-text"><b class="wf-doel">Alle missies klaar</b><span class="wf-cue">loop rustig rond</span></span>` +
      `</div>`
    : '';
  const el = plainCard(
    `<div class="explore-hud">` +
    `<button class="ra-pill explore-pause" type="button" data-key="pause">⏸ Pauze</button>` +
    veld + klaar +
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
  // a fresh chip gets its cue at once, from where the ranger stands, instead of
  // "zoek het spoor…" until he has walked a step (parent B12)
  world?.setActiveMission(nextMissionId());
  el.querySelector('.explore-pause')?.addEventListener('click', () => showPauseHub());
  const hud = el.querySelector<HTMLElement>('.explore-hud');
  mountJoystick(hud);
  mountGuide(hud);    // run 6: Bram's strip or the lesson on screen, put back where it was
  mountHelpChip(hud); // the "?" chip opens "Zo speel je"
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
/** The proximity prompts share ONE place on screen (bottom centre), so only one shows:
 *  never two buttons on top of each other, and Space / Enter always does what the one
 *  visible button says. On foot the places with a ring on the ground come first — a
 *  mission marker, the missiebord, the bird bench (their rings never overlap) — and a
 *  parked jeep or helicopter only when he stands in none of them: standing in the
 *  missiebord's ring he gets "Bekijk het missiebord" even with the jeep parked beside it
 *  (breaker B4, parent B8). In a vehicle, only getting out (or landing). */
const FOOT_ORDER = ['.explore-prompt', '.explore-hub-prompt', '.explore-sit-prompt', '.explore-vehicle-prompt', '.explore-heli-prompt'];
const RIDING_ORDER = ['.explore-vehicle-prompt', '.explore-heli-prompt'];

function arbitratePrompts(): void {
  const w = session.world;
  const riding = !!(w?.vehicleState()?.inVehicle || w?.heliState()?.inHeli);
  const order = riding ? RIDING_ORDER : FOOT_ORDER;
  const show = order.find((sel) => (session.host.querySelector<HTMLElement>(sel)?.childElementCount ?? 0) > 0) ?? null;
  let shownH = 0;
  for (const sel of FOOT_ORDER) {
    const slot = session.host.querySelector<HTMLElement>(sel);
    if (slot) { slot.hidden = sel !== show; if (!slot.hidden) shownH = slot.offsetHeight; }
  }
  // the teaching strip (Bram, a lesson) sits just above the one prompt on screen
  session.host.querySelector<HTMLElement>('.explore-hud')?.style.setProperty('--prompt-h', `${shownH ? shownH + 14 : 0}px`);
}

/** A small [Enter] key cap on a world prompt's button, on a laptop only (a tablet has no
 *  keys): the key that presses it, shown where the eye already is. Never part of the
 *  button's name (aria-hidden). */
function enterCap(): string {
  return coarsePointer() ? '' : ' <span class="kcap kcap-in" aria-hidden="true">Enter</span>';
}

/* ----------------------------------------------------------- vehicles ---- */
/** How to drive / fly and how to get out: a short line (≤ 7 words, dyslexia-friendly
 *  arrows) shown with the vehicle's own button, device-aware like the walk hint. */
const DRIVE_KEYS = '⬆ gas · ⬇ rem · ⬅ ➡ sturen';
const DRIVE_OUT_KEYS = 'Stap uit met de spatiebalk.';
const FLY_KEYS = 'Vlieg met de pijltjes.';
const LANDING = 'De helikopter landt.';

function stickShown(): boolean {
  return joystickVisible(store.get().settings.joystick, coarsePointer());
}

/** W5.1: the jeep affordance — "Stap in de jeep" beside the parked jeep; while
 *  driving the controls line and "Stap uit". Reads the live `vehicleState()`. */
export function renderVehiclePrompt(): void {
  const prompt = session.host.querySelector<HTMLDivElement>('.explore-vehicle-prompt');
  if (!prompt) return;
  const v = session.world?.vehicleState() ?? null;
  if (!v || (!v.near && !v.inVehicle)) prompt.innerHTML = '';
  else if (v.inVehicle) {
    const lines = stickShown() ? [ONBOARD_DRIVE.stick] : [DRIVE_KEYS, DRIVE_OUT_KEYS];
    prompt.innerHTML =
      `<p class="explore-heli-hint explore-drive-hint">${lines.map(esc).join('<br>')}</p>` +
      `<button class="btn-start explore-vehicle-exit" type="button">🚙 Stap uit</button>`;
    prompt.querySelector('.explore-vehicle-exit')?.addEventListener('click', () => session.world?.exitVehicle());
  } else {
    prompt.innerHTML = `<button class="btn-start explore-vehicle-enter" type="button">🚙 Stap in de jeep${enterCap()}</button>`;
    prompt.querySelector('.explore-vehicle-enter')?.addEventListener('click', () => session.world?.enterVehicle());
  }
  arbitratePrompts();
}

/** W5.3b: the helicopter affordance. Beside it: "Stap in de helikopter" (or why it
 *  stays on the ground). Inside, on the ground: how to fly + "Stap uit". In the air:
 *  over a pad "Land hier"; elsewhere where the nearest pad is + "Land op de helipad"
 *  (the autopilot always brings it down); landing: a calm line. */
let heliPromptKey = '';
let heliSpokenKey = '';
export function renderHeliPrompt(): void {
  const prompt = session.host.querySelector<HTMLDivElement>('.explore-heli-prompt');
  if (!prompt) return;
  const h = session.world?.heliState() ?? null;
  const cue = h?.padCue ?? null;
  const where = cue ? `${cue.glyph} Helipad ${cue.richting} · ${Math.max(5, Math.round(cue.distance / 5) * 5)} m` : '';
  // Debounce: this runs every frame inside the heli (via setHeliVignette); rebuild the DOM
  // only when the affordance changes. While flying only the pad line's words change —
  // they are updated in place, so the "Land" button under a moving finger stays put.
  const key = !h ? 'none'
    : h.inHeli ? (!h.airborne ? 'ground' : h.landing ? 'landing' : h.onPad ? 'land' : 'fly')
    : h.near ? (h.available ? 'enter' : h.optIn ? 'reduced' : 'off')
    : 'none';
  if (key === heliPromptKey) {
    if (key === 'fly') {
      const line = prompt.querySelector<HTMLElement>('.explore-heli-where');
      if (line && line.textContent !== where) line.textContent = where;
    }
    return;
  }
  heliPromptKey = key;
  const hint = (text: string, cls = ''): string => `<p class="explore-heli-hint${cls}">${esc(text)}</p>`;
  const button = (cls: string, label: string): string => `<button class="btn-start ${cls}" type="button">${label}</button>`;
  let say = ''; // what is read aloud as this line appears (verifier V3: the heli lines were never spoken)
  if (key === 'none') prompt.innerHTML = '';
  else if (key === 'ground') {
    say = stickShown() ? 'Sleep de stick om te vliegen.' : FLY_KEYS;
    prompt.innerHTML = hint(say) + button('explore-heli-exit', '🚁 Stap uit');
  } else if (key === 'landing') {
    say = LANDING;
    prompt.innerHTML = hint(say);
  } else if (key === 'land') {
    say = 'Land hier.';
    prompt.innerHTML = button('explore-heli-land', '🚁 Land hier');
  } else if (key === 'fly') {
    // spoken without the arrow glyph: "Helipad achter je, 35 meter." (the chip's words
    // keep changing in flight; only its first reading is spoken, not every 5 m)
    say = cue ? `Helipad ${cue.richting}, ${Math.max(5, Math.round(cue.distance / 5) * 5)} meter.` : '';
    prompt.innerHTML = hint(where, ' explore-heli-where') + button('explore-heli-land', '🚁 Land op de helipad');
  } else if (key === 'enter') {
    prompt.innerHTML = button('explore-heli-enter', '🚁 Stap in de helikopter');
  } else {
    // near, but withheld: reduced-motion (toggle on) or the toggle is UIT
    say = key === 'reduced' ? 'De helikopter blijft nu aan de grond.' : 'Zet de helikopter aan bij Instellingen.';
    prompt.innerHTML = hint(say);
  }
  // spoken once per state: a HUD re-render (after Pauze) resets heliPromptKey, not this.
  // Just landed: "De helikopter landt." was the line; the fly line is not repeated.
  if (key !== heliSpokenKey) {
    const landed = heliSpokenKey === 'landing' && key === 'ground';
    heliSpokenKey = key;
    if (say && !landed && store.get().settings.voorlezen) narrator.speak(say);
  }
  prompt.querySelector('.explore-heli-enter')?.addEventListener('click', () => session.world?.enterHeli());
  prompt.querySelector('.explore-heli-land')?.addEventListener('click', () => session.world?.landHeli());
  prompt.querySelector('.explore-heli-exit')?.addEventListener('click', () => session.world?.exitHeli());
  arbitratePrompts();
}

/** W5.3b: show/hide the cockpit frame overlay while in the helicopter. */
export function setHeliCockpit(inHeli: boolean): void {
  const frame = session.host.querySelector<HTMLDivElement>('.explore-heli-cockpit');
  if (frame) frame.hidden = !inHeli;
}

/** W5.3b: drive the motion-vignette opacity each frame inside (0 at hover / on the
 *  ground), and keep the prompt in step with the flight (pad reached, landed). */
export function setHeliVignette(v: number): void {
  const vig = session.host.querySelector<HTMLDivElement>('.explore-heli-vignette');
  if (vig) vig.style.opacity = String(v);
  renderHeliPrompt();
}

/* ------------------------------------------------------------ hints ---- */
/** The ONE transient-tip channel (the boundary cue). A short hint that fades on its own
 *  after `ms`; only one on screen. */
function showTip(id: 'boundary', text: string, ms = 5200): void {
  const hud = session.host.querySelector<HTMLElement>('.explore-hud');
  if (!hud) return;
  session.host.querySelectorAll('.explore-tip').forEach((n) => n.remove());
  if (tipTimer) { clearTimeout(tipTimer); tipTimer = 0; }
  const el = document.createElement('p');
  el.className = 'explore-tip';
  el.setAttribute('role', 'status');
  el.textContent = text;
  hud.appendChild(el);
  tipState.active = id;
  if (store.get().settings.voorlezen) narrator.speak(text);
  tipTimer = window.setTimeout(() => {
    el.remove();
    tipTimer = 0;
    if (tipState.active === id) tipState.active = null;
  }, ms);
}

/** How to drive: the line itself stays with the "Stap uit" button while driving
 *  (renderVehiclePrompt); the first time this session it is also read aloud. */
let driveHintSpoken = false;
export function showDriveHint(): void {
  if (driveHintSpoken) return;
  driveHintSpoken = true;
  if (!store.get().settings.voorlezen) return;
  narrator.speak(stickShown() ? ONBOARD_DRIVE.stick : `${ONBOARD_DRIVE.keys} ${DRIVE_OUT_KEYS}`);
}

/** F-11: the calm world-boundary cue, through the same one-tip channel. */
export function showBoundaryHint(): void {
  showTip('boundary', ONBOARD_BOUNDARY);
}

/** The "?" chip, bottom right: it opens the small "Zo speel je" card (key caps on a
 *  laptop, the stick on a tablet). */
function mountHelpChip(hud: HTMLElement | null): void {
  tipState.helpChip = false;
  if (!hud || !session.world) return;
  const btn = document.createElement('button');
  btn.className = 'ra-pill explore-help';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Zo speel je');
  btn.textContent = '?';
  hud.appendChild(btn);
  tipState.helpChip = true;
  btn.addEventListener('click', () => showControls());
}

/** Build + wire the virtual joystick (W1.3) into the freshly-rendered HUD; the old
 *  instance is disposed first — no listeners on detached nodes, no double stick. */
function mountJoystick(hud: HTMLElement | null): void {
  if (joystick) { joystick.dispose(); joystick = null; }
  const world = session.world;
  if (!hud || !world) return;
  const js = new Joystick();
  const coarse = coarsePointer();
  js.setVisible(joystickVisible(store.get().settings.joystick, coarse));
  hud.appendChild(js.el);
  world.setJoystick(() => js.vector(), (running) => js.setRunning(running));
  joystick = js;
}

/* ------------------------------------------------------- wayfinding ---- */
/** The chip arrow's turn so far (rad, never wrapped): each new bearing is reached the
 *  short way round, so passing "achter je" never spins the arrow a whole turn. */
let arrowTurn = 0;

/** Render the calm wayfinding cue (dual-channel: an arrow + words + colour). The arrow
 *  turns with the true bearing, so it is exact while he steers; the words hold steady
 *  (render3d/Wayfinding SteadyCue) and never flicker for a dyslexic reader (child B10). */
export function onWayfind(cue: WayCue | null): void {
  const strip = session.host.querySelector<HTMLDivElement>('.explore-wayfind');
  if (!strip) return;
  if (!cue) { strip.hidden = true; return; }
  // run 6: keep the words fresh, but stay hidden until Bram's hook points at it
  if (!chipHeld()) strip.hidden = false;
  const glyph = strip.querySelector<HTMLSpanElement>('.wf-glyph');
  const cueEl = strip.querySelector<HTMLSpanElement>('.wf-cue');
  if (glyph) {
    const g = cue.arrived ? '◎' : '↑';
    if (glyph.textContent !== g) glyph.textContent = g;
    if (!cue.arrived) arrowTurn += Math.atan2(Math.sin(cue.angle - arrowTurn), Math.cos(cue.angle - arrowTurn));
    glyph.style.transform = cue.arrived ? '' : `rotate(${arrowTurn.toFixed(3)}rad)`;
  }
  const words = cue.arrived ? 'je bent er' : `${cue.richting} · ${cue.afstand}`;
  if (cueEl && cueEl.textContent !== words) cueEl.textContent = words;
  strip.classList.toggle('wf-arrived', cue.arrived);
}

/* ------------------------------------------------- proximity prompts ---- */
let approachId: string | null = null;
export function onApproach(missionId: string | null): void {
  approachId = missionId;
  const prompt = session.host.querySelector<HTMLDivElement>('.explore-prompt');
  if (!prompt) return;
  const area = Content.activeArea();
  const m = missionId ? area.missies.find((mm) => mm.id === missionId) : null;
  if (!m) prompt.innerHTML = '';
  else if (!store.get().voltooid[m.id]) {
    prompt.innerHTML = `<button class="btn-start explore-play" type="button">Speel mee: ${esc(m.titel)}${enterCap()}</button>`;
  } else {
    // a finished mission: the big button leads ON to the next one (child B6); playing
    // this one again is a quiet second choice, never what Space or Enter does
    const next = area.missies.find((mm) => mm.id === nextMissionId()) ?? null;
    prompt.innerHTML =
      (next ? `<button class="btn-start explore-next" type="button">Volgende: ${esc(next.titel)}${enterCap()}</button>` : '') +
      `<button class="ra-text-btn explore-play explore-replay" type="button">Speel nog eens: ${esc(m.titel)}</button>`;
    prompt.querySelector('.explore-next')?.addEventListener('click', () => { if (next) goToMission(next); });
  }
  prompt.querySelector('.explore-play')?.addEventListener('click', () => {
    if (m && approachId === m.id) showBriefing(m);
  });
  arbitratePrompts();
}

/** The Space/Enter interact key (W1.4) — the laptop twin of the "Speel mee" tap.
 *  Guarded: the affordance must be on screen and the proximity id must match. */
export function onInteract(missionId: string): void {
  const prompt = session.host.querySelector<HTMLDivElement>('.explore-prompt');
  if (!prompt || prompt.hidden) return;
  if (approachId !== missionId) return;
  const m = Content.activeArea().missies.find((mm) => mm.id === missionId);
  if (!m || store.get().voltooid[m.id]) return; // a replay is a click, never the interact key
  showBriefing(m);
}

/** The spawn missiebord proximity affordance (W2.2). */
export function onBoardApproach(near: boolean): void {
  const prompt = session.host.querySelector<HTMLDivElement>('.explore-hub-prompt');
  if (!prompt) return;
  if (!near) prompt.innerHTML = '';
  else {
    prompt.innerHTML = `<button class="btn-start explore-board-open" type="button">Bekijk het missiebord${enterCap()}</button>`;
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
    prompt.innerHTML = `<button class="btn-start explore-sit-play" type="button">${esc(ROEP_COPY.zit)}${enterCap()}</button>`;
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
