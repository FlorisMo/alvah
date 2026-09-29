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
import { HUD, HUB, HUT, TAG, vul } from '../../content/copy';
import { provideHint, type HintState } from '../../core/devhook';
import { ROEP_COPY } from '../../engines/roep';
import type { WayCue } from '../../render3d/Wayfinding';
import { Joystick } from '../Joystick';
import { coarsePointer } from './device';
import { session, esc, plainCard } from '../flow/session';
import { icon } from '../icons';
import { showBriefing, goToMission } from '../flow/MissionFlow';
import { playRoepAtSitSpot, nextMissionId, activeExploreTitel } from '../flow/WorldSession';
import { showPauseHub, showMissionBoard, showControls } from '../hub/Hub';
import { showCabin } from '../Companion';
import { startGuide, stopGuide, mountGuide, chipHeld, guideSnapshot, porchOpen } from './Lessons';
import { speaking } from './Speaker';

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
      `<span class="wf-glyph" aria-hidden="true">${icon('arrow')}</span>` +
      `<span class="wf-text"><b class="wf-doel">${esc(activeTitel)}</b><span class="wf-cue">${esc(HUD.chipZoek)}</span></span>` +
      `</div>`
    : '';
  // every mission done: no way to point any more — the chip says the season is done
  const allDone = !activeTitel && Content.activeArea().missies.every((m) => store.get().voltooid[m.id]);
  const klaar = allDone
    ? `<div class="explore-klaar" role="status">` +
      `<span class="wf-glyph" aria-hidden="true">${icon('check')}</span>` +
      `<span class="wf-text"><b class="wf-doel">${esc(HUD.allesKlaar)}</b><span class="wf-cue">${esc(HUD.allesKlaarCue)}</span></span>` +
      `</div>`
    : '';
  const el = plainCard(
    `<div class="explore-hud">` +
    `<button class="ra-pill explore-pause" type="button" data-key="pause">${icon('pause')}<span>${esc(HUD.pauze)}</span></button>` +
    veld + klaar +
    `<div class="explore-prompt" hidden></div>` +
    `<div class="explore-hub-prompt" hidden></div>` +
    `<div class="explore-porch-prompt" hidden></div>` +
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
  // the hut's porch ring, once Bram has told about the raaf (or the raaf lives there)
  world?.showPorch(porchOpen(), porchTag());
  el.querySelector('.explore-pause')?.addEventListener('click', () => showPauseHub());
  const hud = el.querySelector<HTMLElement>('.explore-hud');
  mountJoystick(hud);
  mountGuide(hud);    // run 6: Bram's strip or the lesson on screen, put back where it was
  mountHelpChip(hud); // the "?" chip opens "Zo speel je"
  provideHint(hintSnapshot);
  // The World only re-fires its onNear callbacks on a proximity CHANGE, so a fresh
  // HUD re-surfaces whatever the ranger is already standing at.
  redrawing = true;
  onApproach(world?.nearMission() ?? null);
  if (world?.boardState()?.near) onBoardApproach(true);
  if (world?.porchState()?.near) onPorchApproach(true);
  if (world?.sitSpotState()?.near) onSitSpotApproach(true);
  renderVehiclePrompt();
  heliPromptKey = '';
  renderHeliPrompt();
  redrawing = false;
  arbitratePrompts();
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
const FOOT_ORDER = ['.explore-prompt', '.explore-hub-prompt', '.explore-porch-prompt', '.explore-sit-prompt', '.explore-vehicle-prompt', '.explore-heli-prompt'];
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
  // the prompt that shows says its words (the first time it comes up here); while the HUD
  // is drawn afresh (after a menu) the slots fill one by one: that is no new prompt
  const shown = show ? session.host.querySelector<HTMLElement>(`${show} button`) : null;
  if (shown) sayPrompt(shown);
  else if (!redrawing) promptSaid = '';
  // the teaching strip (Bram, a lesson) sits just above the one prompt on screen
  session.host.querySelector<HTMLElement>('.explore-hud')?.style.setProperty('--prompt-h', `${shownH ? shownH + 14 : 0}px`);
}

/** A small [Enter] key cap on a world prompt's button, on a laptop only (a tablet has no
 *  keys): the key that presses it, shown where the eye already is. Never part of the
 *  button's name (aria-hidden). */
function enterCap(): string {
  return coarsePointer() ? '' : ' <span class="kcap kcap-in" aria-hidden="true">Enter</span>';
}

/** Every new line is read aloud: a prompt says its words as it comes up (the button's
 *  name, without the key cap). Not again while it stays up, nor when he steps out of the
 *  ring and straight back in (a short rest per prompt); never over Bram, whose line it
 *  waits for. The helicopter's prompts say their own line (renderHeliPrompt). */
let promptSaid = '';
let redrawing = false;
const promptSaidAt = new Map<string, number>();
const PROMPT_REST_MS = 12_000;
function sayPrompt(btn: HTMLElement): void {
  // the helicopter says its own lines; getting out of the jeep is in the drive line
  if (btn.closest('.explore-heli-prompt') || btn.classList.contains('explore-vehicle-exit')) return;
  const words = (btn.getAttribute('aria-label') ?? buttonWords(btn)).trim();
  if (!words || words === promptSaid) return;
  promptSaid = words;
  const now = performance.now();
  if (now - (promptSaidAt.get(words) ?? -Infinity) < PROMPT_REST_MS) return;
  promptSaidAt.set(words, now);
  if (!store.get().settings.voorlezen) return;
  const line = `${words}.`;
  if (speaking()) narrator.queue(line); else narrator.speak(line);
}
/** A button's words: its text without the pictures and key caps beside it. */
function buttonWords(btn: HTMLElement): string {
  const copy = btn.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
  return (copy.textContent ?? '').replace(/\s+/g, ' ');
}

/* ----------------------------------------------------------- vehicles ---- */
/** How to drive / fly and how to get out: a short line (≤ 7 words) shown with the
 *  vehicle's own button, device-aware like the walk hint. On a laptop the keys are drawn
 *  as key caps (the words say what they do). */
const cap = (k: string): string => `<span class="kcap kcap-sm" aria-hidden="true">${k}</span>`;
const DRIVE_KEYS_HTML = `${cap('↑')} ${HUD.rijden.gas} · ${cap('↓')} ${HUD.rijden.rem} · ${cap('←')}${cap('→')} ${HUD.rijden.sturen}`;

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
    const lines = stickShown() ? [esc(HUD.rijden.stick)] : [DRIVE_KEYS_HTML, esc(HUD.rijden.uit)];
    prompt.innerHTML =
      `<p class="explore-heli-hint explore-drive-hint">${lines.join('<br>')}</p>` +
      `<button class="btn-start explore-vehicle-exit" type="button">${icon('jeep')}${esc(HUD.uit)}${enterCap()}</button>`;
    prompt.querySelector('.explore-vehicle-exit')?.addEventListener('click', () => session.world?.exitVehicle());
  } else {
    prompt.innerHTML = `<button class="btn-start explore-vehicle-enter" type="button">${icon('jeep')}${esc(HUD.jeepIn)}${enterCap()}</button>`;
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
  const padM = cue ? Math.max(5, Math.round(cue.distance / 5) * 5) : 0;
  const where = cue ? `${cue.glyph} ${vul(HUD.helipad, { richting: cue.richting, m: padM })}` : '';
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
  const button = (cls: string, label: string): string => `<button class="btn-start ${cls}" type="button">${icon('helicopter')}${esc(label)}${enterCap()}</button>`;
  let say = ''; // what is read aloud as this line appears (verifier V3: the heli lines were never spoken)
  if (key === 'none') prompt.innerHTML = '';
  else if (key === 'ground') {
    say = stickShown() ? HUD.vliegen.stick : HUD.vliegen.keys;
    prompt.innerHTML = hint(say) + button('explore-heli-exit', HUD.uit);
  } else if (key === 'landing') {
    say = HUD.landt;
    prompt.innerHTML = hint(say);
  } else if (key === 'land') {
    say = HUD.zegLandHier;
    prompt.innerHTML = button('explore-heli-land', HUD.landHier);
  } else if (key === 'fly') {
    // spoken without the arrow glyph: "Helipad achter je, 35 meter." (the chip's words
    // keep changing in flight; only its first reading is spoken, not every 5 m)
    say = cue ? vul(HUD.zegHelipad, { richting: cue.richting, m: padM }) : '';
    prompt.innerHTML = hint(where, ' explore-heli-where') + button('explore-heli-land', HUD.landPad);
  } else if (key === 'enter') {
    say = `${HUD.heliIn}.`;
    prompt.innerHTML = button('explore-heli-enter', HUD.heliIn);
  } else {
    // near, but withheld: reduced-motion (toggle on) or the toggle is UIT
    say = key === 'reduced' ? HUD.heliRust : HUD.heliUit;
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
  const line = stickShown() ? HUD.rijden.stick : `${HUD.rijden.keys} ${HUD.rijden.uit}`;
  // Bram talking: after his line, never over it (his strip waits for the voice)
  if (speaking()) narrator.queue(line); else narrator.speak(line);
}

/** F-11: the calm world-boundary cue, through the same one-tip channel. */
export function showBoundaryHint(): void {
  showTip('boundary', HUD.rand);
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
    const g = cue.arrived ? 'target' : 'arrow';
    if (glyph.dataset.ic !== g) { glyph.dataset.ic = g; glyph.innerHTML = icon(g); }
    if (!cue.arrived) arrowTurn += Math.atan2(Math.sin(cue.angle - arrowTurn), Math.cos(cue.angle - arrowTurn));
    glyph.style.transform = cue.arrived ? '' : `rotate(${arrowTurn.toFixed(3)}rad)`;
  }
  const words = cue.arrived ? HUD.chipEr : `${cue.richting} · ${cue.afstand}`;
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
    prompt.innerHTML = `<button class="btn-start explore-play" type="button">${esc(vul(HUD.speelMee, { titel: m.titel }))}${enterCap()}</button>`;
  } else {
    // a finished mission: the big button leads ON to the next one (child B6); playing
    // this one again is a quiet second choice, never what Space or Enter does
    const next = area.missies.find((mm) => mm.id === nextMissionId()) ?? null;
    prompt.innerHTML =
      (next ? `<button class="btn-start explore-next" type="button">${esc(vul(HUD.volgende, { titel: next.titel }))}${enterCap()}</button>` : '') +
      // two short lines: "Speel nog eens:" over the title (a long title stays ≤ 7 words a line)
      `<button class="ra-chip explore-play explore-replay" type="button"><span class="rp-lead">${esc(HUD.nogEens)}</span> <span class="rp-titel">${esc(m.titel)}</span></button>`;
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
    prompt.innerHTML = `<button class="btn-start explore-board-open" type="button">${esc(HUD.missiebord)}${enterCap()}</button>`;
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

/** The hut's porch (run 6, FLOW P4): once Bram has told about the young raaf, a ring on
 *  the porch; standing in it, "Kijk in de hut" opens the hut (the raaf, the opvang). */
export function onPorchApproach(near: boolean): void {
  const prompt = session.host.querySelector<HTMLDivElement>('.explore-porch-prompt');
  if (!prompt) return;
  if (!near) prompt.innerHTML = '';
  else {
    prompt.innerHTML = `<button class="btn-start explore-porch-open" type="button">${icon('raven')}${esc(HUD.hut)}${enterCap()}</button>`;
    prompt.querySelector('.explore-porch-open')?.addEventListener('click', tryOpenPorch);
  }
  arbitratePrompts();
}

/** Guarded entry to the hut (button tap OR the interact key): the same hut Pauze opens. */
export function tryOpenPorch(): void {
  const prompt = session.host.querySelector<HTMLDivElement>('.explore-porch-prompt');
  if (!prompt || prompt.hidden || !prompt.childElementCount) return;
  // its way back leads out onto the clearing
  showCabin(() => showExploreHud(activeExploreTitel()), HUB.terug);
}

/** The porch tag: the raaf's name once it lives there, before that who waits inside. */
function porchTag(): string {
  const c = store.get().companion;
  return c.rescued ? (c.naam?.trim() || HUT.jeRaaf) : TAG.hut;
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
