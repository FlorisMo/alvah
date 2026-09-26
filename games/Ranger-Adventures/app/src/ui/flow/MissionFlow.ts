/**
 * MissionFlow.ts — one mission, start to finish, in the live world:
 *   marker (or missiebord) → briefing (veldnotitie) → each step in place (3D, or
 *   the 2D floor) → the raaf tells a fact between steps → reward → (clue on the
 *   wildcamera) → back on patrol.
 * A mission is never a one-way door: a Pauze chip stays up with "Stop de missie".
 * Never a game-over: the reward always celebrates; difficulty flexes silently.
 */

import type { Mission, Step, Clue } from '../../content/types';
import type { BeatSummary, Engine } from '../../core/skill';
import { store } from '../../core/state';
import { Content } from '../../content/registry';
import { narrator } from '../../core/narrator';
import { Sound } from '../../core/sound';
import { prefersReducedMotion } from '../../core/reduced-motion';
import { capturedClue } from '../../core/patrol';
import { setScreen, setMissionView } from '../../core/devhook';
import { resolveViewMode, variantFor } from '../../render3d/play/ViewMode';
import { REGISTRY_3D } from '../../render3d/play/registry';
import { clearActivityWin, beginActivityScope, abortActivityScope } from '../../render3d/play/kit';
import { playZoeken } from '../../render2d/ZoekenView';
import { playRoute } from '../../render2d/RouteView';
import { playSimon } from '../../render2d/SimonView';
import { playDanger } from '../../render2d/DangerView';
import { playWissel } from '../../render2d/WisselView';
import { mountReadAloud } from '../ReadAloud';
import { session, esc, naam, card, clearOverlays } from './session';
import { resumePatrol, leaveWorld, startExplore, notePatrolCompletion } from './WorldSession';
import { showCaseBoard, badgeHtml, CLUE_GLYPH } from '../hub/Hub';

type PlayFn = (host: HTMLElement, step: Step) => Promise<BeatSummary>;
const ENGINE_VIEWS: Partial<Record<string, PlayFn>> = {
  zoeken: playZoeken, corsi: playRoute, simon: playSimon, dagnacht: playDanger, wisselen: playWissel,
};

/** WebGL support, probed once — a gate for the in-place 3D view (else the 2D floor). */
const WEBGL_OK: boolean = (() => {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
})();

// F-26: the in-world mission gets a persistent Pauze with a calm "Stop de missie".
// `missionStop` resolves the run loop's stop race (set for the mission's duration);
// `stopRequested` latches so a stop is idempotent and every await in `runMission`
// bails after it. `missionPauseEl` is the chip — deliberately NOT a `.ra-overlay`,
// so it survives the engine's own prompt swaps between steps.
let missionStop: (() => void) | null = null;
let stopRequested = false;
let missionPauseEl: HTMLElement | null = null;

/* ------------------------------------------------------------ briefing ---- */
/** The mission entry card: a diegetic *veldnotitie* (field note), so launching a
 *  mission never feels like leaving the world. */
export function showBriefing(mission: Mission): void {
  const jargon = store.get().settings.jargon;
  const lines = (jargon && mission.briefing.knap?.length ? mission.briefing.knap : mission.briefing.simpel) ?? [];

  const el = card(
    `<div class="briefing veldnotitie boot-card-ish">` +
    `<p class="boot-kicker">Veldnotitie · ${esc(mission.landschap)}</p>` +
    `<h1 class="boot-title">${esc(mission.titel)}</h1>` +
    `<div class="briefing-lines">${lines.map((_, i) => `<p class="briefing-line" data-line="${i}"></p>`).join('')}</div>` +
    `<div class="ra-row">` +
    `<button class="ra-speak" type="button" aria-label="Lees voor">🔊</button>` +
    `<button class="btn-start" type="button">Ga op pad</button>` +
    `</div>` +
    `<button class="ra-text-btn briefing-back" type="button" data-key="back">Nog even rondkijken</button>` +
    `</div>`,
  );
  const lineEls = Array.from(el.querySelectorAll<HTMLElement>('.briefing-line'));
  const ra = mountReadAloud({
    lead: `Ranger ${naam()}. ${mission.titel}.`,
    segments: lines.map((l, i) => ({ el: lineEls[i], text: l })),
    speakBtn: el.querySelector('.ra-speak'),
    autoStart: store.get().settings.voorlezen,
  });
  el.querySelector('.briefing-back')?.addEventListener('click', () => { ra.stop(); resumePatrol(); });
  el.querySelector('.btn-start')?.addEventListener('click', () => { ra.stop(); void runMission(mission); });
}

/* ---------------------------------------------------------- play loop ---- */
async function runMission(mission: Mission): Promise<void> {
  const played: Engine[] = [];
  let skipped: string | null = null;
  setScreen('mission');
  // ONE stop promise for the whole mission — every await below races it, so a stop
  // from any point (a running step OR a between-steps fact) bails at the next
  // checkpoint. `stopMission()` owns the world teardown + return.
  stopRequested = false;
  missionStop = null;
  const stopped = new Promise<'STOP'>((res) => { missionStop = () => res('STOP'); });
  const raceStop = <T>(p: Promise<T>): Promise<T | 'STOP'> => Promise.race([p, stopped]);
  mountMissionPause();
  for (let i = 0; i < mission.stappen.length; i++) {
    const step = mission.stappen[i];
    const play = ENGINE_VIEWS[step.ef];
    if (!play) { skipped = step.ef; break; }
    clearOverlays();
    const world = session.world;
    // The ONE branch (§1f): play the step in-place when the world is live AND a
    // parity-green 3D variant ships for this engine; otherwise the 2D floor.
    const mode = resolveViewMode({
      engine: step.ef as Engine,
      sceneLive: !!world,
      webglCapable: WEBGL_OK,
      reducedMotion: prefersReducedMotion(),
      force2d: store.get().settings.force2d, // Tweaks "altijd 2D" → always the 2D floor
      registry: REGISTRY_3D,
    });
    setMissionView(mode);
    beginActivityScope(); // F-26: fresh abort scope — pick3d + the engine loop bind to it
    let result: BeatSummary | 'STOP';
    if (mode === '3d' && world) {
      const variant = variantFor(REGISTRY_3D, step.ef as Engine)!;
      world.beginActivity();
      try {
        result = await raceStop(variant.play(world.ctx(session.host), step));
      } finally {
        // On a stop, stopMission() has already disposed this world — never touch it.
        if (!stopRequested) { clearActivityWin(); world.endActivity(); }
      }
    } else {
      result = await raceStop(play(session.host, step));
    }
    if (result === 'STOP' || stopRequested) return;
    store.logSession(step.ef as Engine, result);
    played.push(step.ef as Engine);
    if (step.skin.feit) {
      // W6.3b: playing in the world pins the fact as a collectible veldnotitie.
      store.collectVeldnotitie(Content.veldnotitieId(mission.id, i));
      const fact = await raceStop(showFact(step, i + 1, mission.stappen.length));
      if (fact === 'STOP' || stopRequested) return;
    }
  }
  unmountMissionPause();
  missionStop = null;
  // The case-board data gate keys off voltooid, so snapshot the found-set BEFORE
  // marking this mission done: the clue beat fires only when this completion makes
  // the hook NEWLY appear on the board.
  const areaId = Content.activeArea().id;
  const before = Content.cluesFound(areaId, store.get().voltooid);
  store.markMissionDone(mission.id);
  notePatrolCompletion();
  const clueId = capturedClue(mission, true, before);
  showReward(mission, played, skipped, clueId);
}

/* ------------------------------------------------ in-mission pause (F-26) ---- */
/** A persistent Pauze chip for the whole in-world mission. NOT a `.ra-overlay`, so
 *  the engine's own prompt swaps never remove it; `unmountMissionPause` clears it. */
function mountMissionPause(): void {
  unmountMissionPause();
  const el = document.createElement('button');
  el.className = 'ra-pill mission-pause';
  el.type = 'button';
  el.dataset.key = 'pause';
  el.textContent = '⏸ Pauze';
  el.addEventListener('click', showMissionPause);
  session.host.appendChild(el);
  missionPauseEl = el;
}

export function unmountMissionPause(): void {
  missionPauseEl?.remove();
  missionPauseEl = null;
  session.host.querySelector('.mission-pause-menu')?.remove();
}

/** The calm pause card over a running mission. Its own container (not `card()`):
 *  it blocks the canvas so a tap never leaks to the engine, and it leaves the
 *  engine's live prompt intact for a seamless "Ga verder". */
function showMissionPause(): void {
  narrator.stop();
  session.host.querySelector('.mission-pause-menu')?.remove();
  const el = document.createElement('div');
  el.className = 'mission-pause-menu';
  el.innerHTML =
    `<div class="reward boot-card-ish">` +
    `<p class="boot-kicker">Pauze</p>` +
    `<h1 class="boot-title">Wat wil je doen?</h1>` +
    `<div class="lodge-links">` +
    `<button class="ra-chip mp-stop" type="button"><span class="ra-chip-ic" aria-hidden="true">🚩</span>` +
    `<span class="ra-chip-tx">Stop de missie</span></button>` +
    `</div>` +
    `<button class="btn-start mp-resume" type="button" data-key="back">Ga verder</button>` +
    `</div>`;
  session.host.appendChild(el);
  el.querySelector('.mp-resume')?.addEventListener('click', () => el.remove());
  el.querySelector('.mp-stop')?.addEventListener('click', stopMission);
}

/** "Stop de missie": abort the running step cleanly, drop the mission world and
 *  rebuild the open plek. Never punitive — progress is already persisted.
 *  Idempotent via `stopRequested`, which also bails the `runMission` loop. */
function stopMission(): void {
  if (stopRequested) return;
  stopRequested = true;
  narrator.stop();
  abortActivityScope();
  unmountMissionPause();
  missionStop?.();
  leaveWorld();
  startExplore();
}

/* ------------------------------------------------------------- fact ---- */
/** The companion raaf's spoken name: the rescued-and-named raaf, else "de raaf". */
function raafNaam(): string {
  return store.get().companion.naam?.trim() || 'de raaf';
}

/** W6.3a: the "Wist je dat" beat, delivered diegetically — the raaf tells you the
 *  fact on location. */
function showFact(step: Step, n: number, total: number): Promise<void> {
  return new Promise((resolve) => {
    const feit = String(step.skin.feit ?? '');
    const raaf = raafNaam();
    const el = card(
      `<div class="fact boot-card-ish fact--raaf">` +
      `<span class="fact-raaf" aria-hidden="true">🐦‍⬛</span>` +
      `<p class="boot-kicker">${esc(raaf)} vertelt · ${n}/${total}</p>` +
      `<p class="fact-text"></p>` +
      `<div class="ra-row">` +
      `<button class="ra-speak" type="button" aria-label="Lees voor">🔊</button>` +
      `<button class="btn-start" type="button">Verder</button>` +
      `</div></div>`,
    );
    const ra = mountReadAloud({
      textEl: el.querySelector('.fact-text')!,
      text: feit,
      speakBtn: el.querySelector('.ra-speak'),
      autoStart: store.get().settings.voorlezen,
    });
    el.querySelector('.btn-start')?.addEventListener('click', () => { ra.stop(); resolve(); });
  });
}

/* ------------------------------------------------------------- reward ---- */
function showReward(mission: Mission, played: Engine[], skipped: string | null, clueId: string | null): void {
  const badges = Array.from(new Set(played)).map(badgeHtml).join('');
  const knap = mission.beloning.vaktermBadge
    ? `<p class="reward-knap">Knap woord: <b>${esc(mission.beloning.vaktermBadge.naam.replace(/^Knap woord:\s*/i, ''))}</b></p>`
    : '';
  const note = skipped
    ? `<p class="boot-sub reward-note">De stap “${esc(skipped)}” komt eraan.</p>`
    : '';
  const reunion = mission.reunion?.tekst ? `<p class="boot-sub">${esc(mission.reunion.tekst)}</p>` : '';

  // a verhaalHaak mission pins a clue → the "vastgelegd op de wildcamera → prikbord"
  // beat sits between the reward and patrol.
  const clue = clueId
    ? Content.clues(Content.activeArea().id).find((c) => c.id === clueId) ?? null
    : null;

  const lof = `Knap gedaan, ${naam()}!`;
  const backLabel = clue ? 'Bekijk de wildcamera' : 'Verder op patrouille';
  const el = card(
    `<div class="reward boot-card-ish">` +
    `<p class="boot-kicker">Missie klaar · ${esc(mission.titel)}</p>` +
    `<h1 class="boot-title reward-lof"></h1>` +
    reunion +
    `<div class="badge-row">${badges}</div>` +
    knap +
    note +
    `<button class="btn-start" type="button">${backLabel}</button>` +
    `</div>`,
  );
  if (store.get().settings.geluid) Sound.found();
  const ra = mountReadAloud({
    textEl: el.querySelector('.reward-lof')!,
    text: lof,
    autoStart: store.get().settings.voorlezen,
  });
  el.querySelector('.btn-start')?.addEventListener('click', () => {
    ra.stop();
    if (clue) showWildcamCapture(clue);
    else resumePatrol();
  });
}

/* ------------------------------------------------- wildcamera → prikbord ---- */
/** The diegetic clue beat: a verhaalHaak mission completed on patrol is "vastgelegd
 *  op de wildcamera" — a calm snapshot card showing the new aanwijzing now on the
 *  prikbord. Two ways on: peek at the board, or walk straight on. */
function showWildcamCapture(clue: Clue): void {
  narrator.stop();
  const line = 'Vastgelegd op de wildcamera.';
  const glyph = CLUE_GLYPH[clue.soort] ?? '📌';
  const el = card(
    `<div class="wildcam boot-card-ish">` +
    `<p class="boot-kicker">📷 ${line}</p>` +
    `<h1 class="boot-title">Een nieuwe aanwijzing</h1>` +
    `<div class="cb-clue found wildcam-shot">` +
    `<span class="cb-photo">${glyph}</span>` +
    `<span class="cb-clue-title"></span>` +
    `<span class="cb-clue-text"></span>` +
    `</div>` +
    `<p class="boot-sub">Hij hangt nu op het prikbord.</p>` +
    `<div class="ra-row">` +
    `<button class="ra-speak" type="button" aria-label="Lees voor">🔊</button>` +
    `<button class="btn-start wc-board" type="button">Bekijk het prikbord</button>` +
    `</div>` +
    `<button class="ra-text-btn wc-patrol" type="button" data-key="back">Verder op patrouille</button>` +
    `</div>`,
  );
  const ra = mountReadAloud({
    lead: line,
    segments: [
      { el: el.querySelector('.cb-clue-title')!, text: clue.titel },
      { el: el.querySelector('.cb-clue-text')!, text: clue.tekst },
    ],
    speakBtn: el.querySelector('.ra-speak'),
    autoStart: store.get().settings.voorlezen,
  });
  el.querySelector('.wc-board')?.addEventListener('click', () => { ra.stop(); showCaseBoard(); });
  el.querySelector('.wc-patrol')?.addEventListener('click', () => { ra.stop(); resumePatrol(); });
}
