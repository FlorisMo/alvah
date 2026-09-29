/**
 * MissionFlow.ts — one mission, start to finish, in the live world:
 *   marker (or missiebord) → briefing (veldnotitie) → each step in place (3D, or
 *   the 2D floor) → the raaf tells a fact between steps → reward → (clue on the
 *   wildcamera) → back on patrol.
 * A mission is never a one-way door: a Pauze chip stays up with "Stop de missie".
 * Never a game-over: the reward always celebrates; difficulty flexes silently.
 */

import { Group, Vector3, type Scene } from 'three';
import type { Mission, Step, Clue } from '../../content/types';
import type { BeatSummary, Engine } from '../../core/skill';
import { store } from '../../core/state';
import { Content } from '../../content/registry';
import { narrator } from '../../core/narrator';
import { Sound } from '../../core/sound';
import { prefersReducedMotion } from '../../core/reduced-motion';
import { zinnen } from '../../core/readlevel';
import { capturedClue } from '../../core/patrol';
import { setScreen, setMissionView } from '../../core/devhook';
import { resolveViewMode, variantFor } from '../../render3d/play/ViewMode';
import { REGISTRY_3D } from '../../render3d/play/registry';
import { clearActivityWin, clearPlayHint, beginActivityScope, abortActivityScope } from '../../render3d/play/kit';
import { playZoeken } from '../../render2d/ZoekenView';
import { playRoute } from '../../render2d/RouteView';
import { playSimon } from '../../render2d/SimonView';
import { playDanger } from '../../render2d/DangerView';
import { playWissel } from '../../render2d/WisselView';
import { mountReadAloud, readScreenAloud, speakButtonBeside, speakButtonHtml, sentenceSegments } from '../ReadAloud';
import { SAY } from '../../content/screens';
import { MENTOR_NAAM } from '../../content/mentor';
import { MISSIE, HUT, vul } from '../../content/copy';
import { deviceText } from '../hud/device';
import { BRAM_PORTRAIT } from '../hud/Speaker';
import { missionIcon } from '../MissionIcon';
import { icon, CLUE_ICON } from '../icons';
import { session, esc, naam, card, clearOverlays, fadeCut, kicker, leave } from './session';
import {
  resumePatrol, notePatrolCompletion, activeExploreTitel, tellWorldMissionDone, holdWorld, releaseWorld,
} from './WorldSession';
import { showExploreHud } from '../hud/ExploreHud';
import { showCaseBoard, showOntknoping, badgeHtml } from '../hub/Hub';

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

/** The step as a view gets it: its instruction words in this device's terms
 *  ("Tik op de dieren" on touch, "Klik op de dieren" with a mouse), and without
 *  its "wist je dat" fact — the raaf tells the fact right after the step, so the
 *  game's own found-card never says it first (the raaf used to repeat it). */
function stepForView(step: Step): Step {
  const { feit: _feit, feitDier: _feitDier, ...skin } = step.skin;
  const copy = skin.copy
    ? Object.fromEntries(Object.entries(skin.copy).map(([k, v]) => [k, typeof v === 'string' ? deviceText(v) : v]))
    : undefined;
  return { ...step, skin: copy ? { ...skin, copy } : skin };
}

/* ------------------------------------------------------- to the marker ---- */
/**
 * Start a mission picked away from its marker (on the missiebord, or "Volgende" at a
 * finished one): the ranger is brought to its marker first, under a calm fade (a plain
 * cut under reduced motion), and its briefing opens there. So the mission plays where
 * it belongs — the frog by the ven, not on the dry heath by the cabin (parent B6) —
 * and its family comes home where he stands. Already at the marker: just the briefing.
 */
export function goToMission(mission: Mission): void {
  const world = session.world;
  if (!world || world.nearMission() === mission.id) { showBriefing(mission); return; }
  narrator.stop();
  fadeCut(() => { clearOverlays(); world.bringRangerTo(mission.id); }, () => showBriefing(mission));
}

/* ------------------------------------------------------------ briefing ---- */
/** The landscape as a word on a card: "heide" → "Heide". */
function landschapNaam(l: string): string {
  return l ? l[0].toUpperCase() + l.slice(1) : l;
}

/** The mission entry card: a diegetic *veldnotitie* (field note), so launching a
 *  mission never feels like leaving the world. */
export function showBriefing(mission: Mission): void {
  const jargon = store.get().settings.jargon;
  const lines = (jargon && mission.briefing.knap?.length ? mission.briefing.knap : mission.briefing.simpel) ?? [];
  const shown = lines.flatMap(zinnen); // one sentence a line: every line on the page ≤ 7 words

  // Bram's field note: his portrait and name, the mission's picture and title, the lines
  // written as they are read. "Ga op pad" and "Nog even rondkijken" sit in the pinned
  // footer: at 800×600 the way back used to fall below the card (breaker note)
  const el = card(
    `<div class="card briefing veldnotitie">` +
    `<div class="vn-head"><span class="vn-bram">${BRAM_PORTRAIT}</span>` +
    kicker(null, vul(MISSIE.veldnotitie, { bram: MENTOR_NAAM, landschap: landschapNaam(mission.landschap) })) + `</div>` +
    `<div class="vn-title">${missionIcon(mission, 'mc-icon--big')}<h1 class="boot-title">${esc(mission.titel)}</h1></div>` +
    `<div class="card-body">` +
    `<div class="briefing-lines">${shown.map((_, i) => `<p class="briefing-line" data-line="${i}"></p>`).join('')}</div>` +
    `</div>` +
    `<div class="card-foot">` +
    `<div class="ra-row">${speakButtonHtml()}<button class="btn-start" type="button">${esc(MISSIE.gaOpPad)}</button></div>` +
    `<button class="ra-chip briefing-back" type="button" data-key="back">${esc(MISSIE.rondkijken)}</button>` +
    `</div>` +
    `</div>`,
  );
  const lineEls = Array.from(el.querySelectorAll<HTMLElement>('.briefing-line'));
  // the title lights up as it is read, then each line is written as the voice reaches it
  // (the first is there at once: the page is never empty)
  const ra = mountReadAloud({
    lead: vul(MISSIE.zegAan, { naam: naam() }),
    segments: [
      { el: el.querySelector<HTMLElement>('.vn-title .boot-title')!, text: mission.titel, sentence: true },
      ...shown.map((l, i) => ({ el: lineEls[i], text: l, reveal: i > 0 })),
    ],
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
  // checkpoint, and `abandonMission` puts the ranger back on patrol right there.
  stopRequested = false;
  missionStop = null;
  const stopped = new Promise<'STOP'>((res) => { missionStop = () => res('STOP'); });
  const raceStop = <T>(p: Promise<T>): Promise<T | 'STOP'> => Promise.race([p, stopped]);
  mountMissionPause();
  // the raaf counts its facts (1/3, 2/3, 3/3), not the steps
  const facts = mission.stappen.filter((st) => st.skin.feit).length;
  let factN = 0;
  // The world holds still for the WHOLE mission (2D floor included): the ranger stays
  // at the marker, the step owns the camera, and between two steps no marker tag or
  // proximity prompt comes back near the lens. It lets go when the ranger walks on
  // (resumePatrol) or the mission is stopped.
  holdWorld();
  // the follow camera's pose before the first game: the last game glides back to it
  const cam = session.world?.camera;
  const home = cam ? { pos: cam.position.clone(), look: cam.position.clone().add(cam.getWorldDirection(new Vector3())) } : null;
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
    // The step gets its OWN two containers, and the flow takes both away when the
    // step ends — finished or stopped. Everything the step shows goes into `stepHost`
    // (its cards, a 2D panel) and everything it stages into `stepStage` (a group in
    // the world scene). So "Stop de missie" removes exactly the step and nothing of
    // the world (trees that finish loading mid-step stay), and a timer the stopped
    // step still had running writes into a container that is no longer on screen:
    // it can never put a card back or take the explore HUD away.
    const stepHost = document.createElement('div');
    stepHost.className = 'mission-step';
    session.host.appendChild(stepHost);
    const stepStage = new Group();
    stepStage.name = 'mission-step';
    let result: BeatSummary | 'STOP';
    try {
      if (mode === '3d' && world) {
        const variant = variantFor(REGISTRY_3D, step.ef as Engine)!;
        const ctx = world.ctx(stepHost);
        (ctx.scene as Scene).add(stepStage);
        // between two games the lens stays on the play view (one calm move to the next)
        const keepView = i < mission.stappen.length - 1;
        result = await raceStop(variant.play({ ...ctx, scene: stepStage, keepView, home }, stepForView(step)));
      } else {
        result = await raceStop(play(stepHost, stepForView(step)));
      }
    } finally {
      clearActivityWin(); // W2.3: no win closure outlives its step
      clearPlayHint();
      stepStage.removeFromParent();
      stepHost.remove();
    }
    if (result === 'STOP' || stopRequested) { abandonMission(); return; }
    store.logSession(step.ef as Engine, result);
    played.push(step.ef as Engine);
    if (step.skin.feit) {
      // W6.3b: playing in the world pins the fact as a collectible veldnotitie.
      store.collectVeldnotitie(Content.veldnotitieId(mission.id, i));
      const fact = await raceStop(showFact(step, ++factN, facts));
      if (fact === 'STOP' || stopRequested) { abandonMission(); return; }
    }
  }
  unmountMissionPause();
  missionStop = null;
  // no mini-game view is live any more: the reunion, reward, clue and sporenboek are
  // cards over the (still held) world, so the dev hook no longer says '3d' (breaker note)
  setMissionView(null);
  // The case-board data gate keys off voltooid, so snapshot the found-set BEFORE
  // marking this mission done: the clue beat fires only when this completion makes
  // the hook NEWLY appear on the board.
  const area = Content.activeArea();
  const before = Content.cluesFound(area.id, store.get().voltooid);
  const seasonBefore = seasonDone();
  const knap = mission.beloning.vaktermBadge;
  store.markMissionDone(mission.id, knap ? { id: knap.id, naam: knap.naam.replace(/^Knap woord:\s*/i, '') } : undefined);
  notePatrolCompletion();
  const clueId = capturedClue(mission, true, before);
  // this completion finishes the season: the finale follows the reward (and the clue)
  const finale = !seasonBefore && seasonDone();
  await showReunion(mission); // the world shows it: the family comes back at the marker
  showReward(mission, played, skipped, clueId, finale ? showSeasonFinale : resumePatrol);
}

/** Every mission of the area is done. */
function seasonDone(): boolean {
  const done = store.get().voltooid;
  return Content.activeArea().missies.every((m) => done[m.id]);
}

/* ------------------------------------------------------------ reunion ---- */
/**
 * Felt progress, the moment itself: the mission's ending plays IN the world at its
 * marker (the sow and the piglets come to the frisling, the roe's mother comes back,
 * the fox cub trots out of the den — world/Progress.ts) while one calm line says what
 * happened, read aloud. The camera stays where it is; under reduced motion the family
 * simply stands there. Then the reward card. Never longer than a few seconds.
 */
function showReunion(mission: Mission): Promise<void> {
  narrator.stop();
  const tekst = mission.reunion?.tekst ?? '';
  const el = card(
    `<div class="reunion-cap" role="status">` +
    kicker('check', vul(MISSIE.klaar, { titel: mission.titel })) +
    (tekst ? `<p class="reunion-text"></p>` : '') +
    `</div>`,
    { scrim: false },
  );
  el.classList.add('explore-overlay'); // the world shows through; nothing to click here
  const textEl = el.querySelector<HTMLElement>('.reunion-text');
  const ra = textEl ? mountReadAloud({ segments: sentenceSegments(textEl, tekst), autoStart: store.get().settings.voorlezen }) : null;
  const inWorld = tellWorldMissionDone(mission.id, true);
  const read = new Promise<void>((r) => window.setTimeout(r, REUNION_MIN_MS));
  const cap = new Promise<void>((r) => window.setTimeout(r, REUNION_MAX_MS)); // a slow model load never holds the reward
  return Promise.race([Promise.all([inWorld, read]).then(() => {}), cap]).then(() => { ra?.stop(); });
}

/** The reunion line stays up at least this long (reading time), at most that long. */
const REUNION_MIN_MS = 3200;
const REUNION_MAX_MS = 7000;

/* -------------------------------------------------------- season finale ---- */
/**
 * The season ends (VISION §4a: Kraamtijd → Zomer → Bronst → Herstel): the last
 * mission is done. If the poacher was not reported yet, the sporenboek's ontknoping
 * plays first (the photos beside the tracks, the report to the BOA); then one calm
 * finale card, and the ranger walks on in a free, quiet world where every marker
 * reads "klaar" and every family is home.
 */
export function showSeasonFinale(): void {
  if (!store.get().arc.gemeld) { showOntknoping(0, showSeasonFinale); return; }
  narrator.stop();
  const vb = Content.verhaalboog(Content.activeArea().id);
  const regels = vb?.finale?.regels ?? [];
  const el = card(
    `<div class="card finale">` +
    kicker('leaf', vb?.finale?.kicker ?? MISSIE.seizoenKlaar) +
    `<h1 class="boot-title">${esc(vb?.finale?.titel ?? MISSIE.veilig)}</h1>` +
    `<div class="card-body"><div class="briefing-lines">${regels.map((_, i) => `<p class="briefing-line" data-line="${i}"></p>`).join('')}</div></div>` +
    `<div class="card-foot"><div class="ra-row">${speakButtonHtml()}<button class="btn-start" type="button">${esc(MISSIE.verderPatrouille)}</button></div></div>` +
    `</div>`,
  );
  if (store.get().settings.geluid) Sound.found();
  const lineEls = Array.from(el.querySelectorAll<HTMLElement>('.briefing-line'));
  // the title lights up as it is read, the lines come as the voice reaches them
  const ra = mountReadAloud({
    segments: [
      { el: el.querySelector<HTMLElement>('.finale .boot-title')!, text: vb?.finale?.titel ?? MISSIE.veilig, sentence: true },
      ...regels.map((l, i) => ({ el: lineEls[i], text: l, reveal: i > 0 })),
    ],
    speakBtn: el.querySelector('.ra-speak'),
    autoStart: store.get().settings.voorlezen,
  });
  el.querySelector('.btn-start')?.addEventListener('click', () => { ra.stop(); resumePatrol(); });
}

/* ------------------------------------------------ in-mission pause (F-26) ---- */
/** What the pause card's stop does, and what it says (the mission's, or the bench's). */
let pauseStop: () => void = () => stopMission();
let pauseStopLabel: string = MISSIE.stop;

/** A persistent Pauze chip for the whole in-world mission. NOT a `.ra-overlay`, so
 *  the engine's own prompt swaps never remove it; `unmountMissionPause` clears it.
 *  The bird bench mounts the same chip with its own stop (breaker B5). */
export function mountMissionPause(stop: () => void = stopMission, stopLabel: string = MISSIE.stop): void {
  unmountMissionPause();
  pauseStop = stop;
  pauseStopLabel = stopLabel;
  const el = document.createElement('button');
  el.className = 'ra-pill mission-pause';
  el.type = 'button';
  el.dataset.key = 'pause';
  el.innerHTML = `${icon('pause')}<span>${esc(MISSIE.pauze)}</span>`;
  el.addEventListener('click', showMissionPause);
  session.host.appendChild(el);
  missionPauseEl = el;
}

export function unmountMissionPause(): void {
  missionPauseEl?.remove();
  missionPauseEl = null;
  closeMissionPauseCard();
}

/** The pause card eases out (it stops holding the ranger and the mission at once). */
function closeMissionPauseCard(): void {
  const menu = session.host.querySelector<HTMLElement>('.mission-pause-menu');
  if (!menu) return;
  menu.classList.remove('mission-pause-menu');
  leave(menu);
}

/** The calm pause card over a running mission. Its own container (not `card()`):
 *  it blocks the canvas so a tap never leaks to the engine, and it leaves the
 *  engine's live prompt intact for a seamless "Ga verder". */
function showMissionPause(): void {
  narrator.stop();
  session.host.querySelector('.mission-pause-menu')?.remove();
  const el = document.createElement('div');
  el.className = 'mission-pause-menu ra-scrim';
  el.innerHTML =
    `<div class="card card--narrow pause-card">` +
    kicker('pause', MISSIE.pauze) +
    `<h1 class="boot-title">${esc(MISSIE.pauzeVraag)}</h1>` +
    `<div class="card-foot">` +
    `<div class="ra-row"><button class="btn-start mp-resume" type="button" data-key="back">${esc(MISSIE.gaVerder)}</button></div>` +
    `<button class="ra-chip mp-stop" type="button"><span class="ra-chip-ic">${icon('flag')}</span>` +
    `<span class="ra-chip-tx">${esc(pauseStopLabel)}</span></button>` +
    `</div>` +
    `</div>`;
  session.host.appendChild(el);
  const voor = store.get().settings.voorlezen; // child:B12
  readScreenAloud(el, { text: SAY.missiePauze, anchor: '.mp-resume', autoStart: voor, items: '.ra-chip', hover: voor });
  el.querySelector('.mp-resume')?.addEventListener('click', closeMissionPauseCard);
  el.querySelector('.mp-stop')?.addEventListener('click', () => pauseStop());
}

/** "Stop de missie": abort the running step (its pick listener and frame loop
 *  stop) and let `runMission` take the step away. Never punitive — progress is
 *  already persisted. Idempotent via `stopRequested`. */
function stopMission(): void {
  if (stopRequested) return;
  stopRequested = true;
  narrator.stop();
  abortActivityScope();
  unmountMissionPause();
  missionStop?.(); // resolve the step/fact race so runMission returns
}

/** Back to patrol right where the ranger stood. The stopped step is already gone
 *  (its own containers were taken away when it ended); this removes the raaf's fact
 *  card if the stop came there, keeps the world, the ranger and the jeep exactly as
 *  they were, and shows the HUD again. */
function abandonMission(): void {
  missionStop = null;
  clearOverlays();
  releaseWorld();
  setScreen('world');
  setMissionView(null);
  showExploreHud(activeExploreTitel());
}

/* ------------------------------------------------------------- fact ---- */
/** The rescued raaf's name ("Kroa"), or null while no raaf has been rescued yet. */
function raafNaam(): string | null {
  const c = store.get().companion;
  return c.rescued ? c.naam?.trim() || HUT.jeRaaf : null;
}

/** W6.3a: the "Wist je dat" beat between two steps. Once the raaf is rescued (and named)
 *  it is the raaf who tells it ("Kroa vertelt · 1/3"); before that nobody pretends to:
 *  "Wist je dat? · 1/3" (a raaf you never met cannot talk to you). */
function showFact(step: Step, n: number, total: number): Promise<void> {
  return new Promise((resolve) => {
    const feit = String(step.skin.feit ?? '');
    const raaf = raafNaam();
    const el = card(
      `<div class="card card--narrow fact${raaf ? ' fact--raaf' : ''}">` +
      `<span class="fact-mark">${icon(raaf ? 'raven' : 'bulb')}</span>` +
      kicker(null, raaf ? vul(MISSIE.feitRaaf, { raaf, n, m: total }) : vul(MISSIE.feit, { n, m: total })) +
      `<p class="fact-text"></p>` +
      `<div class="card-foot"><div class="ra-row">${speakButtonHtml()}<button class="btn-start" type="button">${esc(MISSIE.verder)}</button></div></div>` +
      `</div>`,
    );
    const ra = mountReadAloud({
      segments: sentenceSegments(el.querySelector<HTMLElement>('.fact-text')!, feit),
      speakBtn: el.querySelector('.ra-speak'),
      autoStart: store.get().settings.voorlezen,
    });
    el.querySelector('.btn-start')?.addEventListener('click', () => { ra.stop(); resolve(); });
  });
}

/* ------------------------------------------------------------- reward ---- */
function showReward(mission: Mission, played: Engine[], skipped: string | null, clueId: string | null, then: () => void): void {
  // the breinkrachten this mission trained ease in one after the other
  const badges = Array.from(new Set(played)).map((e, i) => badgeHtml(e, i)).join('');
  const knapNaam = mission.beloning.vaktermBadge?.naam.replace(/^Knap woord:\s*/i, '') ?? '';
  const knap = knapNaam
    ? `<p class="reward-knap"><span class="rk-label">${esc(MISSIE.knapWoord)}</span><b class="rk-word">${esc(knapNaam)}</b></p>`
    : '';
  const note = skipped
    ? `<p class="boot-sub reward-note">${esc(vul(MISSIE.stapKomt, { stap: skipped }))}</p>`
    : '';

  // a verhaalHaak mission pins a clue → the "vastgelegd op de wildcamera → prikbord"
  // beat sits between the reward and patrol.
  const clue = clueId
    ? Content.clues(Content.activeArea().id).find((c) => c.id === clueId) ?? null
    : null;

  const lof = vul(MISSIE.lof, { naam: naam() });
  const backLabel = clue ? MISSIE.kijkWatJeVond : then === resumePatrol ? MISSIE.verderPatrouille : MISSIE.verder; // child:B15
  const el = card(
    `<div class="card reward">` +
    `<div class="rw-pic">${missionIcon(mission, 'mc-icon--big')}<span class="rw-check">${icon('check')}</span></div>` +
    kicker(null, vul(MISSIE.klaar, { titel: mission.titel })) +
    `<h1 class="boot-title reward-lof"></h1>` +
    `<div class="badge-row">${badges}</div>` +
    knap +
    note +
    `<div class="card-foot"><div class="ra-row"><button class="btn-start" type="button">${backLabel}</button></div></div>` +
    `</div>`,
  );
  if (store.get().settings.geluid) Sound.found();
  // "Missie klaar!" first: what happened, then the praise, then the knap woord
  const ra = mountReadAloud({
    lead: MISSIE.zegKlaar,
    textEl: el.querySelector('.reward-lof')!,
    text: lof,
    trail: knapNaam ? vul(MISSIE.zegKnapWoord, { woord: knapNaam }) : '',
    speakBtn: speakButtonBeside(el.querySelector('.btn-start')), // 🔊 to hear it again (child:B12)
    autoStart: store.get().settings.voorlezen,
  });
  el.querySelector('.btn-start')?.addEventListener('click', () => {
    ra.stop();
    if (clue) showWildcamCapture(clue, then);
    else then();
  });
}

/* ------------------------------------------------- wildcamera → prikbord ---- */
/** The diegetic clue beat: a verhaalHaak mission completed on patrol is "vastgelegd
 *  op de wildcamera" — a calm snapshot card showing the new aanwijzing, now in the
 *  sporenboek. The first one also says where that book is (Pauze), so the sporenboek is
 *  introduced when it first has something in it. Every line on the card is read aloud.
 *  Two ways on: peek at the book, or walk straight on. */
function showWildcamCapture(clue: Clue, then: () => void): void {
  narrator.stop();
  const line = clue.soort === 'camera' ? MISSIE.clueCamera : MISSIE.clueFoto; // child:B15: no wildcamera before you met one
  const first = Content.cluesFound(Content.activeArea().id, store.get().voltooid).size <= 1;
  const el = card(
    `<div class="card wildcam">` +
    kicker(clue.soort === 'camera' ? 'camera' : 'photo', line) +
    `<h1 class="boot-title">${esc(MISSIE.clueTitel)}</h1>` +
    `<div class="card-body">` +
    `<figure class="clue-photo"><span class="clue-tape" aria-hidden="true"></span>` +
    `<span class="clue-pic">${icon(CLUE_ICON[clue.soort] ?? 'photo')}</span>` +
    `<figcaption><span class="cb-clue-title"></span><span class="cb-clue-text"></span></figcaption></figure>` +
    `<p class="clue-where">${icon('book')}<span class="cw-lines"><span class="cw-boek"></span>` +
    (first ? `<span class="cw-waar"></span>` : '') + `</span></p>` +
    `</div>` +
    // Enter walks on (child B7): "Verder" is the primary, the sporenboek a quiet side step
    `<div class="card-foot">` +
    `<div class="ra-row">${speakButtonHtml()}` +
    `<button class="btn-start wc-patrol" type="button" data-key="back">${esc(then === resumePatrol ? MISSIE.verderPatrouille : MISSIE.verder)}</button></div>` +
    `<button class="ra-chip wc-board" type="button"><span class="ra-chip-ic">${icon('book')}</span><span class="ra-chip-tx">${esc(MISSIE.bekijkBoek)}</span></button>` +
    `</div>` +
    `</div>`,
  );
  const waar = el.querySelector<HTMLElement>('.cw-waar');
  const ra = mountReadAloud({
    lead: line,
    segments: [
      { el: el.querySelector<HTMLElement>('.wildcam .boot-title')!, text: MISSIE.clueTitel, sentence: true },
      { el: el.querySelector('.cb-clue-title')!, text: clue.titel, sentence: true },
      ...sentenceSegments(el.querySelector<HTMLElement>('.cb-clue-text')!, clue.tekst),
      { el: el.querySelector<HTMLElement>('.cw-boek')!, text: MISSIE.clueBoek },
      ...(waar ? [{ el: waar, text: MISSIE.clueWaar }] : []),
    ],
    speakBtn: el.querySelector('.ra-speak'),
    autoStart: store.get().settings.voorlezen,
  });
  el.querySelector('.wc-board')?.addEventListener('click', () => { ra.stop(); showCaseBoard(then); });
  el.querySelector('.wc-patrol')?.addEventListener('click', () => { ra.stop(); then(); });
}
