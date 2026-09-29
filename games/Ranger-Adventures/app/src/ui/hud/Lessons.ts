/**
 * Lessons.ts — the first minute, run every frame (run 6, FLOW lane P2): Bram's beats and
 * the lessons, one thing at a time, in the order core/lessons.ts decides.
 *
 * A new boswachter arrives: Bram greets him from beside the missiebord; then a lesson
 * strip teaches walking (the arrow key caps; the stick on a tablet) and running (the
 * Shift cap; the stick pushed far), each gone once he has done it; then Bram tells the
 * hook and only then does the chip top-left show the way to the first mission, whose
 * ring and tag glow. Standing still a while brings the look lesson once. Later, once
 * each: the missiebord beat after the first finished mission, the raaf beat once two
 * missions are done (the hut's porch gets its ring: "Kijk in de hut"), the jeep beat when
 * the next mission is far away on foot (never once he has driven it himself). A
 * returning player hears "Welkom terug" once a session.
 *
 * Nothing here takes the keys (the strips are part of the see-through explore HUD). The
 * state lives here, outside the DOM: the HUD is drawn afresh after every menu and the
 * strips are put back where they were (`mountGuide`), never restarted. What is learned
 * is saved (settings.geleerd), so a reload never repeats it.
 */

import './hud.css';
import { store } from '../../core/state';
import { Content } from '../../content/registry';
import { joystickVisible } from '../../core/input';
import { prefersReducedMotion } from '../../core/reduced-motion';
import {
  nextStep, hookPending, learnedByDoing, lessonDone, lessonTimedOut, cutByRide, raafDue,
  JEEP_BEAT, type LessonId, type StepId, type Progress, type GuideState,
} from '../../core/lessons';
import { BRAM, LES, metNaam } from '../../content/mentor';
import { mountReadAloud } from '../ReadAloud';
import { session, naam, menuOpen } from '../flow/session';
import { coarsePointer } from './device';
import { say, cancelSpeaker, mountSpeaker, speaking, speakerLine } from './Speaker';

/* ------------------------------------------------------------ the state ---- */
// this session (a page load): what has happened, what was said
const progress: Progress = { walkedM: 0, runS: 0, lookPx: 0 };
let lookBase = -1;          // the world's drag total when the guide first ran
let stillS = 0;
let returning = false;
let welkomSaid = false;
let rennenShown = false;
let kijkenShown = false;
let missiebordArmed = false;
let started = false;
let sessionStarted = false; // play began once this page load (a trip to the title and back is the same visit)
let startAt = 0;            // the first step waits for the glide into play (ms)
let gapUntil = 0;           // a breath between two steps (ms)
let quietSince = 0;         // when the next step first waited for the voice to be quiet (ms)
let raf = 0;
let lastT = 0;
// the step on screen now: a lesson (with how long it has shown and how far he walked
// since), or one of Bram's beats (with the line to go on from if it was cut off)
let current:
  | { kind: 'lesson'; id: LessonId; shownS: number; walkedM: number; doneAt: number }
  | { kind: 'beat'; id: Exclude<StepId, LessonId>; from: number; saying: boolean }
  | null = null;
let chipShown = false;      // the chip has been revealed this session
let porchShown = false;     // Bram pointed at the hut this session (before it is saved as told)
// the teaching slot in the HUD (bottom centre, above the prompt) and the lesson strip in it
let slot: HTMLElement | null = null;
let lessonEl: HTMLElement | null = null;

/* ---------------------------------------------------------- start, stop ---- */
/**
 * Play began (WorldSession.enterPlay): the first minute starts after the glide into
 * play has settled. `returning`: he came in from the title with a ranger already made.
 * Only the first entry of a page load decides that: back from the title (Pauze → Naar het
 * hoofdmenu → Begin) he is not welcomed back, and a greeting cut off by it carries on.
 */
export function startGuide(opts: { returning: boolean }): void {
  if (!sessionStarted) { returning = opts.returning; sessionStarted = true; }
  startAt = performance.now() + (prefersReducedMotion() ? 300 : 1300);
  started = true;
  session.world?.revealNext(!chipHeld());
  if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(tick); }
}

/** Back to the title: stop what is said and shown (progress this session stays). */
export function stopGuide(): void {
  started = false;
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
  cancelSpeaker();
  if (current?.kind === 'beat') current.saying = false;
  removeLesson();
  slot = null;
}

/** Back from a finished mission (WorldSession.resumePatrol): Bram's missiebord beat is due
 *  after the first one. */
export function armMissiebordBeat(): void {
  if (!store.get().settings.geleerd.missiebord) missiebordArmed = true;
}

/** The chip waits for Bram's hook (a new boswachter has not been told where to go yet). */
export function chipHeld(): boolean {
  if (chipShown) return false;
  return hookPending({ geleerd: store.get().settings.geleerd, hookRelevant: hookRelevant() });
}

/** The hut's porch ring shows: Bram has told about the young raaf, or it lives there. */
export function porchOpen(): boolean {
  const s = store.get();
  return porchShown || !!s.settings.geleerd.raaf || s.companion.rescued;
}

/** Put the strips back into a freshly drawn HUD (after a menu): the lesson on screen
 *  carries on where it was, a cut-off line of Bram's is picked up by the next frame. */
export function mountGuide(hud: HTMLElement | null): void {
  slot = null;
  if (!hud) return;
  slot = document.createElement('div');
  slot.className = 'explore-teach';
  hud.appendChild(slot);
  mountSpeaker(slot);
  if (lessonEl && current?.kind === 'lesson') slot.appendChild(lessonEl);
}

/** The dev hook's read: the step on screen, what is learned, whether the chip shows. */
export function guideSnapshot(): {
  active: StepId | null; speaking: boolean; line: string | null; learned: string[];
  chip: boolean; progress: Progress; returning: boolean;
  bram: ReturnType<NonNullable<typeof session.world>['wardenState']>;
} {
  const g = store.get().settings.geleerd;
  return {
    active: current?.id ?? null,
    speaking: speaking(),
    line: speakerLine(),
    learned: Object.keys(g).filter((k) => g[k as keyof typeof g]),
    chip: !chipHeld(),
    progress: { ...progress },
    returning,
    bram: session.world?.wardenState() ?? null,
  };
}

/* ------------------------------------------------------------ each frame ---- */
function tick(now: number): void {
  raf = requestAnimationFrame(tick);
  const dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000));
  lastT = now;
  const world = session.world;
  const hud = session.host?.querySelector('.explore-hud');
  if (!started || !world || !hud) { stillS = 0; return; }
  const free = !menuOpen();
  const onFoot = !world.vehicleState()?.inVehicle && !world.heliState()?.inHeli;

  // what he does counts, also before a lesson shows
  if (lookBase < 0) lookBase = world.lookedPx();
  progress.lookPx = world.lookedPx() - lookBase;
  if (free && onFoot) {
    const m = world.rangerMotion();
    progress.walkedM += m.speed * dt;
    if (m.running) progress.runS += dt; // his run gait (Shift, or the stick at its rim)
    // standing still counts only with nothing on screen to read (listening to Bram is not idling)
    stillS = m.speed < 0.05 && !current && now >= gapUntil ? stillS + dt : 0;
    if (current?.kind === 'lesson') { current.walkedM += m.speed * dt; current.shownS += dt; }
  } else stillS = 0;
  const g = store.get().settings.geleerd;
  for (const id of learnedByDoing(g, progress)) store.learn(id);
  // he found the jeep and drove it himself: Bram never has to suggest it
  if (!g.jeep && world.vehicleState()?.inVehicle) store.learn('jeep');

  if (lessonEl) lessonEl.hidden = !onFoot; // the drive / flight lines own the bottom then (a ✓ fading out)
  if (!free || now < startAt) return;

  // the step on screen
  if (current?.kind === 'lesson') {
    const c = current;
    if (!onFoot && !c.doneAt) {
      // he got into the jeep or the heli: the lesson ends unlearned (it comes back on
      // foot) and the queue goes on, so the hook and the chip come while he drives
      ({ rennenShown, kijkenShown } = cutByRide(c.id, { rennenShown, kijkenShown }));
      finishStep(now);
    } else if (c.doneAt) {
      if (now - c.doneAt > 700) finishStep(now);
    } else if (lessonDone(c.id, progress)) {
      store.learn(c.id);
      c.doneAt = now;
      lessonEl?.classList.add('ls-done'); // a short ✓ before it goes
    } else if (lessonTimedOut(c.id, c.shownS, c.walkedM)) finishStep(now);
    return;
  }
  if (current?.kind === 'beat') {
    if (!current.saying) sayBeat(current);
    return;
  }
  if (now < gapUntil) return;
  const step = nextStep(guideState(onFoot));
  if (!step) { quietSince = 0; return; }
  // never over another voice (a prompt saying its words, a screen read aloud): the next
  // step waits for it to finish, a few seconds at most
  if (voiceBusy()) {
    if (!quietSince) quietSince = now;
    if (now - quietSince < QUIET_WAIT_MS) return;
  }
  quietSince = 0;
  startStep(step);
}

/** The next step waits at most this long for another voice to finish (ms): a prompt says
 *  its words in about two seconds; the teaching never waits much longer than that. */
const QUIET_WAIT_MS = 2500;
function voiceBusy(): boolean {
  const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
  return !!synth && store.get().settings.voorlezen && (synth.speaking || synth.pending);
}

/** Where the guide stands, for the pure rules (core/lessons.nextStep). */
function guideState(onFoot: boolean): GuideState {
  return {
    geleerd: store.get().settings.geleerd,
    returning, welkomSaid, rennenShown, kijkenShown,
    hookRelevant: hookRelevant(),
    missiebordArmed,
    raafDue: raafDue(store.get().voltooid, store.get().companion.rescued),
    onFoot,
    jeepFar: onFoot && jeepFar(),
    stillS,
    prompting: !!session.host.querySelector('.explore-prompt:not([hidden]) button, .explore-hub-prompt:not([hidden]) button, .explore-sit-prompt:not([hidden]) button, .explore-vehicle-prompt:not([hidden]) button, .explore-heli-prompt:not([hidden]) button'),
    progress,
  };
}

/** The next mission is the first one and it is not done: Bram's hook is about it. */
function hookRelevant(): boolean {
  const first = Content.activeArea().missies[0];
  if (!first || store.get().voltooid[first.id]) return false;
  const next = Content.activeArea().missies.find((m) => !store.get().voltooid[m.id]);
  return next?.id === first.id;
}

/** On foot, the next mission more than 30 m off, the parked jeep within 40 m. */
function jeepFar(): boolean {
  const world = session.world;
  const v = world?.vehicleState();
  if (!world || !v?.placed || v.inVehicle) return false;
  const p = world.pos();
  const next = Content.activeArea().missies.find((m) => !store.get().voltooid[m.id]);
  const mk = next ? world.markerPositions().find((m) => m.missionId === next.id) : null;
  if (!mk) return false;
  return Math.hypot(mk.x - p.x, mk.z - p.z) > JEEP_BEAT.missionM && Math.hypot(v.x - p.x, v.z - p.z) <= JEEP_BEAT.jeepM;
}

/* ----------------------------------------------------------- the steps ---- */
function startStep(id: StepId): void {
  if (id === 'lopen' || id === 'rennen' || id === 'kijken') {
    if (id === 'rennen') rennenShown = true;
    if (id === 'kijken') kijkenShown = true;
    current = { kind: 'lesson', id, shownS: 0, walkedM: 0, doneAt: 0 };
    showLesson(id);
    return;
  }
  current = { kind: 'beat', id, from: 0, saying: false };
  sayBeat(current);
}

function finishStep(now: number): void {
  current = null;
  removeLesson();
  gapUntil = now + 900;
}

/** Bram's lines for a beat, with the ranger's name. */
function linesOf(id: Exclude<StepId, LessonId>): string[] {
  const n = naam();
  const g = store.get().settings.geleerd;
  switch (id) {
    case 'welkom': return [...BRAM.welkomTerug, ...(g.bram ? [] : [BRAM.kennismaken])].map((l) => metNaam(l, n));
    case 'bram': return BRAM.intro.map((l) => metNaam(l, n));
    case 'haak': return [...(store.get().settings.jargon ? BRAM.haak.knap : BRAM.haak.simpel)];
    case 'missiebord': return BRAM.missiebord.map((l) => metNaam(l, n));
    case 'raaf': return [...BRAM.raaf];
    case 'jeep': return [...BRAM.jeep];
  }
}

/** Say a beat (or its rest, after it was cut off by a menu). */
function sayBeat(c: { kind: 'beat'; id: Exclude<StepId, LessonId>; from: number; saying: boolean }): void {
  // a beat cut off by a menu or a mission is moot when it is picked up again if what it
  // was about is past: the jeep once he sits in it, the hook once the first mission is done
  const moot = (c.id === 'jeep' && !!session.world?.vehicleState()?.inVehicle) || (c.id === 'haak' && !hookRelevant())
    || (c.id === 'raaf' && store.get().companion.rescued);
  if (moot) { store.learn(c.id as 'jeep' | 'haak' | 'raaf'); finishStep(performance.now()); return; }
  const lines = linesOf(c.id);
  c.saying = true;
  void say(lines.slice(c.from), {
    onLine: (i) => {
      const at = c.from + i;
      // the chip appears as Bram points at it, the frisling's ring and tag glow
      if (c.id === 'haak' && at === lines.length - 1) revealChip();
      if (c.id === 'missiebord' && at === lines.length - 1) session.world?.glowBoard(8);
      if (c.id === 'jeep' && at === lines.length - 1) session.world?.glowJeep(true);
      // "Bij de hut zit een jonge raaf.": the hut's porch gets its ring and tag, glowing
      if (c.id === 'raaf' && at === 0) revealPorch();
    },
  }).then((r) => {
    if (current !== c) return;
    c.saying = false;
    if (!r.done) { c.from += r.spoken; return; } // cut off: carry on from there when free
    if (c.id === 'welkom') { welkomSaid = true; store.learn('bram'); }
    else if (c.id === 'haak') { store.learn('haak'); revealChip(); }
    else store.learn(c.id);
    if (c.id === 'missiebord') missiebordArmed = false;
    finishStep(performance.now());
  });
}

/** The chip appears (it points at the first mission), whose ring and tag glow a while. */
function revealChip(): void {
  if (chipShown) return;
  chipShown = true;
  const strip = session.host.querySelector<HTMLElement>('.explore-wayfind');
  if (strip) { strip.hidden = false; strip.classList.add('wf-reveal'); }
  session.world?.revealNext(true, 6);
}

/** The hut's porch ring and its tag appear, and glow a while (Bram points at the hut). */
function revealPorch(): void {
  porchShown = true;
  session.world?.showPorch(true);
  session.world?.glowPorch(10);
}

/* --------------------------------------------------------- the lesson strip ---- */
const ARROWS =
  '<span class="kcap-cluster" aria-hidden="true">' +
  '<span class="kcap kcap-up">↑</span><span class="kcap">←</span><span class="kcap">↓</span><span class="kcap">→</span></span>';
const SHIFT_UP =
  '<span class="kcap-combo" aria-hidden="true"><span class="kcap kcap-wide">⇧ Shift</span><span class="kcap-plus">+</span><span class="kcap">↑</span></span>';
/** A drawn stick (thumb in the ring); `far`: pushed to the rim. */
function stickIcon(far: boolean): string {
  const cx = far ? 30 : 24, cy = far ? 12 : 18;
  return '<svg class="ls-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">' +
    '<circle cx="24" cy="24" r="19" fill="rgba(20,16,12,.18)" stroke="currentColor" stroke-width="2.4"/>' +
    `<circle cx="${cx}" cy="${cy}" r="9" fill="#fdfcf8" stroke="currentColor" stroke-width="2.4"/>` +
    (far ? '<path d="M33 7l6-1-1 6" fill="none" stroke="#e0a91f" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' : '') +
    '</svg>';
}
const MOUSE_DRAG =
  '<svg class="ls-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">' +
  '<rect x="16" y="11" width="16" height="26" rx="8" fill="#fdfcf8" stroke="currentColor" stroke-width="2.4"/>' +
  '<path d="M24 11v8" stroke="currentColor" stroke-width="2.4"/>' +
  '<path d="M9 24l-5 0M9 24l-2.5-3M9 24l-2.5 3" transform="translate(-1 0)" stroke="#e0a91f" stroke-width="2.4" stroke-linecap="round"/>' +
  '<path d="M4 24l5-4M4 24l5 4" stroke="#e0a91f" stroke-width="2.4" stroke-linecap="round" fill="none"/>' +
  '<path d="M44 24l-5-4M44 24l-5 4" stroke="#e0a91f" stroke-width="2.4" stroke-linecap="round" fill="none"/>' +
  '</svg>';
const SWIPE =
  '<svg class="ls-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">' +
  '<path d="M20 40V20a3 3 0 0 1 6 0v10l8 2a3 3 0 0 1 2 3l-1 5" fill="#fdfcf8" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>' +
  '<path d="M6 12h30M6 12l4-4M6 12l4 4M36 12l-4-4M36 12l-4 4" fill="none" stroke="#e0a91f" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
  '</svg>';

function stickShown(): boolean {
  return joystickVisible(store.get().settings.joystick, coarsePointer());
}

function showLesson(id: LessonId): void {
  removeLesson();
  const stick = stickShown();
  const touch = coarsePointer();
  const text = id === 'lopen' ? (stick ? LES.lopen.stick : LES.lopen.keys)
    : id === 'rennen' ? (stick ? LES.rennen.stick : LES.rennen.keys)
    : (touch ? LES.kijken.stick : LES.kijken.keys);
  const icon = id === 'lopen' ? (stick ? stickIcon(false) : ARROWS)
    : id === 'rennen' ? (stick ? stickIcon(true) : SHIFT_UP)
    : (touch ? SWIPE : MOUSE_DRAG);
  const el = document.createElement('div');
  el.className = `lesson-strip ls-${id}`;
  el.setAttribute('role', 'status');
  el.dataset.lesson = id;
  el.innerHTML = `<span class="ls-keys">${icon}</span><span class="ls-text"></span><span class="ls-check" aria-hidden="true">✓</span>`;
  lessonEl = el;
  slot?.appendChild(el);
  mountReadAloud({ textEl: el.querySelector<HTMLElement>('.ls-text')!, text, autoStart: store.get().settings.voorlezen });
}

function removeLesson(): void {
  const el = lessonEl;
  lessonEl = null;
  if (!el) return;
  if (!el.isConnected || prefersReducedMotion()) { el.remove(); return; }
  el.classList.add('ls-leaving');
  window.setTimeout(() => el.remove(), 180);
}
