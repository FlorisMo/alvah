/**
 * WorldSession.ts — the one world's life cycle. It is built ONCE, at boot, behind the
 * veil (`bootWorld`), and shown as the title (world/Presenter.ts: the title and the
 * ranger maker are shots of the real spawn clearing). Begin glides into the maker (a
 * first-time player) or straight into play (`enterPlay`); Pauze → "Naar het hoofdmenu"
 * glides back up to the title (`returnToTitle`). The world is never torn down.
 * Also here: coming back from a mission or a menu (`resumePatrol`) and the two
 * in-world beats that are not missions: the calm world-EF micro-beat between missions
 * and "Ken je roep" at the bird bench.
 */

import { MOODS } from '../../render3d/Moods';
import type { Engine } from '../../core/skill';
import { SKILL_META } from '../../core/skill';
import { store } from '../../core/state';
import { Content } from '../../content/registry';
import { narrator } from '../../core/narrator';
import { Sound } from '../../core/sound';
import { loadGameAudio, setAmbientScene } from '../../core/calls';
import { SAY, TITLE } from '../../content/screens';
import { MISSIE, ONDERWEG } from '../../content/copy';
import type { Biome } from '../../render3d/Biomes';
import type { Stage } from '../../render3d/Stage';
import { World, type WorldMarker } from '../../render3d/World';
import { playRoep3d } from '../../render3d/engines/roep3d';
import { playRoep } from '../../render2d/RoepView';
import { prefersReducedMotion } from '../../core/reduced-motion';
import { clearActivityWin, clearPlayHint, beginActivityScope, abortActivityScope } from '../../render3d/play/kit';
import { modelFor, heightFor } from '../../render3d/play/spawn';
import { SIZE } from '../../render3d/AnimalScale';
import { heroOf } from '../../render3d/world/Progress';
import { adventureFor, allAdventures } from '../../render3d/adventure/registry';
import { nextPatrolTarget, storyOrderOf } from '../../core/patrol';
import { sessionSeed } from '../../core/play';
import { isMood, parseMoodParam, sessionMood, type MoodId } from '../../render3d/Moods';
import { Vector3 } from 'three';
import {
  pickWorldBeat, optionCorrect, coarseHeading, withAnimal, beatReady, WORLDBEAT_ANIMAL_M, type WorldBeat,
} from '../../core/worldbeat';
import { setScreen, setMissionView, provideTitleReady } from '../../core/devhook';
import { mountReadAloud, readScreenAloud, sentenceSegments } from '../ReadAloud';
import { showAvatarCreator } from '../AvatarCreator';
import { mountMissionPause, unmountMissionPause } from './MissionFlow';
import { session, esc, card, plainCard, clearOverlays, menuOpen, fadeCut, dipCut, kicker } from './session';
import { icon } from '../icons';
import { coarsePointer } from '../hud/device';
import { wireWorldDevhook } from '../dev/wireDevhook';
import {
  showExploreHud, disposeExploreHud, onApproach, onWayfind, onInteract, onBoardApproach,
  tryOpenBoard, onPorchApproach, tryOpenPorch, onSitSpotApproach, tryPlayRoep, renderVehiclePrompt, renderHeliPrompt,
  setHeliCockpit, setHeliVignette, showBoundaryHint, showDriveHint, setDriveStall, beginGuide,
} from '../hud/ExploreHud';
import { armMissiebordBeat, guideSnapshot } from '../hud/Lessons';
import { revealDiscovery } from '../hud/Reveal';
import { ontdekking } from '../../content/ontdekkingen';

// Light world-EF seasoning: count in-world mission completions this session so the
// pure `pickWorldBeat` cadence (every Nth return) stays rare. `lastBeatTick` dedups
// the one beat per completion across the several `resumePatrol` hops in a cycle.
let patrolTick = 0;
let lastBeatTick = -1;

/** A mission was completed in the world: advance the world-EF beat cadence. */
export function notePatrolCompletion(): void {
  patrolTick++;
}

/**
 * Felt progress — the ONE completion event the world listens to. When a mission is
 * finished the flow tells the world `onMissionComplete(id, { fresh: true })` (play
 * the reunion at the marker now); when a world is built, it hears the same for
 * every mission already done with `fresh: false` (show the finished state, no beat),
 * so progress survives a reload. Optional: a world without the method ignores it.
 */
export function tellWorldMissionDone(missionId: string, fresh: boolean): Promise<void> {
  return session.world?.onMissionComplete(missionId, { fresh }) ?? Promise.resolve();
}

/* ---------------------------------------------------- the world holds still ---- */
// A mission (or the bird bench) freezes the live world for as long as it runs — not
// per step: between two steps and on the reward the ranger stays put, no marker tag
// or proximity prompt comes back, and the camera stays where the game left it.
let held = false;

/** Freeze the world for a mission (idempotent). */
export function holdWorld(): void {
  if (held || !session.world) return;
  held = true;
  session.world.beginActivity();
}

/** Let the world go again: free roam, the tags, the prompts (idempotent). */
export function releaseWorld(): void {
  if (!held) return;
  held = false;
  session.world?.endActivity();
}

/** WebGL support, probed once (the in-place 3D view needs it). */
let webgl: boolean | null = null;
function webglOk(): boolean {
  if (webgl === null) {
    try {
      const c = document.createElement('canvas');
      webgl = !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch { webgl = false; }
  }
  return webgl;
}

/** The story order (run 6, decision 4): the missions played as adventures with his own
 *  body come first — the ones Alvah meets first — then the others in the area's order.
 *  Run 7: the adventures in the REGISTRY's order (the order the game meets them: after
 *  the wildcamera the squirrel, then the frogs in the ven), `core/patrol.storyOrderOf`.
 *  The missiebord lists them so; the world's markers keep the area's layout. */
export function storyOrder<T extends { id: string }>(missies: readonly T[]): T[] {
  return storyOrderOf(missies, allAdventures().map((a) => a.id));
}

/** The mission the game recommends next: the first unfinished one in story order.
 *  The wayfinding chip points at it and the missiebord marks it. Null when all done. */
export function nextMissionId(): string | null {
  return nextPatrolTarget(storyOrder(Content.activeArea().missies), store.get().voltooid);
}

/** The title the wayfinding chip shows (the recommended mission), or null. */
export function activeExploreTitel(): string | null {
  const id = nextMissionId();
  return Content.activeArea().missies.find((m) => m.id === id)?.titel ?? null;
}

/* -------------------------------------------------------- the one world ---- */
// the season tints the ambience bed; taken from the story's current chapter at boot
let seizoen: string | undefined;

/**
 * Boot (main.ts): build the world behind the veil and show it as the title. The veil
 * lifts once the world is ready (every model it asked for has arrived, or a cap), so the
 * first thing a player sees is the finished clearing, never a stand-in.
 */
export function bootWorld(ui: HTMLElement, st: Stage, veil: { lift: () => void }): void {
  session.host = ui;
  session.stage = st;
  const world = buildWorld();
  world.present('title');
  setScreen('title');
  setMissionView(null);
  let titleUp = false;
  provideTitleReady(() => titleUp && world.ready());
  // the AudioContext is slow to make (up to ~2 s under load): make it now, behind the
  // veil, so the Begin tap only resumes it and the glide starts at once
  const idle = (window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) idle(() => Sound.prepare(), { timeout: 1500 });
  else window.setTimeout(() => Sound.prepare(), 300);
  const wait = (): void => {
    if (!world.ready()) { requestAnimationFrame(wait); return; }
    showTitleCard({ afterVeil: true });
    veil.lift();
    titleUp = true;
  };
  wait();
}

/**
 * Run 7 (moods): the light this visit stands in, drawn once per page load before the world
 * (and so the title) is built: the golden hour on a save's first visit, then one of the five
 * from the session's seed, never the last visit's; `?mood=<id>` forces it (dev, tests). The
 * save remembers it (`sfeer`), so the next visit draws another.
 */
function visitMood(): MoodId {
  const { sfeer } = store.get();
  const mood = sessionMood({
    sessions: sfeer.sessies, last: sfeer.laatste, seed: sessionSeed(),
    forced: typeof location !== 'undefined' ? parseMoodParam(location.search) : null,
  });
  store.noteSession(mood);
  return mood;
}

/** The world, built once: the markers, the callbacks the HUD listens on, the finished
 *  missions' lasting tableaus, handed to the Stage. */
function buildWorld(): World {
  const area = Content.activeArea();
  const markers: WorldMarker[] = area.missies.map((m) => {
    const ef = m.stappen[0]?.ef as Engine | undefined;
    // the animal the mission is about stands at its marker, at its real size: the
    // frisling (not a grown boar), the reekalf, the frog in the reeds — unless the mission
    // is an adventure whose story's animal is elsewhere (run 6: the ring stays empty)
    const hero = heroOf(m.id, m.dier);
    const look = adventureFor(m.id)?.home.marker;
    const BIOMES = ['heide', 'bos', 'stuifzand', 'ven'] as const;
    const biome = (BIOMES as readonly string[]).includes(m.landschap)
      ? (m.landschap as typeof BIOMES[number]) : undefined;
    return {
      missionId: m.id,
      titel: m.titel,
      modelId: hero && look?.look !== 'none' ? modelFor(hero) : null,
      height: heightFor(hero),
      len: (SIZE as Record<string, { len?: number }>)[hero]?.len,
      color: (ef && SKILL_META[ef]?.kleur) || '#f5c23b',
      biome,
      at: look?.at,
      look: look?.look,
    };
  });
  // run 6: the adventures' homes (a wallow and its family, a stand of bracken ...) are
  // built with the world, before or after their mission
  const homes = allAdventures().map((a) => {
    const m = area.missies.find((x) => x.id === a.id);
    if (m) a.bind?.(m);
    return { spec: a.home, build: a.dressing, clearings: a.clearings, treeClearings: a.treeClearings, trees: a.trees, actor: a.actor };
  });

  // the active mission the wayfinding cue points to = the recommended next one
  const done = store.get().voltooid;
  seizoen = Content.currentChapter(area.id, done)?.seizoen;
  const onBiome = (b: Biome) => setAmbientScene(b, seizoen);

  const { stage } = session;
  const world = new World(
    stage.renderer.domElement as HTMLCanvasElement, markers, onApproach, onWayfind, nextMissionId(),
    onBiome, onInteract, { homes, mood: visitMood() },
  );
  session.world = world;
  // W4.5: hand the world the shared renderer so it can turn on the hero shadow map.
  world.setRenderer(stage.renderer);
  // W1.5: the rotating follow-cam reads the "Camera draait mee" setting live each frame.
  world.setCameraFollow(() => store.get().settings.cameraDraaitMee);
  // a menu card over the world (Pauze, the missiebord, a briefing ...) holds him still
  world.setMenuGate(menuOpen);
  // run 7 (feel): a climb into the jeep that would swing the view round it dips instead
  world.setDip(dipCut);
  // W2.2: the spawn case-board is the mission hub — walking up to it opens the
  // mission board overlay in-place.
  world.setBoard({ onNear: onBoardApproach, onOpen: tryOpenBoard });
  // run 6: the hut's porch ring (once Bram has told about the young raaf) opens the hut
  world.setPorch({ onNear: onPorchApproach, onOpen: tryOpenPorch });
  // F-11: the calm world-rim cue ("Hier stopt het bos") through the one hint channel.
  world.setBoundaryHint(showBoundaryHint);
  // W6.4b2: the "Ken je roep" sit-spot by the vogelkijkhut.
  world.setSitSpot({ onNear: onSitSpotApproach, onActivate: tryPlayRoep });
  // W5.1: the drivable jeep — "Stap in" near it, "Stap uit" while driving.
  world.setVehicle({
    onNear: () => renderVehiclePrompt(),
    onChange: (inVehicle) => { renderVehiclePrompt(); if (inVehicle) showDriveHint(); },
    onStall: (why) => setDriveStall(why), // run 6 polish: held back with the gas on, says why
  });
  // W5.3b: the opt-in helicopter; the optIn source is read live (Instellingen toggle).
  world.setHeli({
    onNear: () => renderHeliPrompt(),
    onChange: (inHeli) => { renderHeliPrompt(); setHeliCockpit(inHeli); },
    onFrame: (v) => setHeliVignette(v),
    optIn: () => store.get().settings.helikopter,
  });
  stage.enterWorld(world);
  wireSurprises(world);
  for (const m of area.missies) if (done[m.id]) void tellWorldMissionDone(m.id, false);
  if (store.get().arc.gemeld) world.setSeasonResolved(true);
  wireWorldDevhook(world);
  return world;
}

/**
 * Run 7 (veldgids): the open world's small surprises (render3d/world/Surprises.ts). Free
 * roam as the game sees it: he is in the world with its HUD up, the first minute's lesson
 * slot is idle and no briefing waits (a mission is the world's own check). What he meets
 * (seen or heard) goes into his veldgids at once (`wereld.<id>`); a new one gets its reveal
 * at the next quiet moment; each one met moves the open world's rare counter.
 */
function wireSurprises(world: World): void {
  // run 7: a home's own things he sees in free roam (the squirrel's oak seedling on a later
  // visit) reach his veldgids the same way: recorded at once, a new one's reveal waits
  world.residents.setDiscover((id) => {
    const row = ontdekking(id);
    if (!row || !store.discover(id)) return false;
    revealDiscovery(row);
    return true;
  });
  world.setSurprises({
    free: () => !!session.host.querySelector('.explore-hud') && !session.host.querySelector('.ra-overlay .briefing')
      && guideSnapshot().active === null,
    met: (id, how) => {
      const row = ontdekking(`wereld.${id}`);
      if (row && store.discover(row.id)) revealDiscovery(row, { heard: how === 'heard' });
    },
    done: (id, met) => {
      if (met) store.rareEnd('wereld', ontdekking(`wereld.${id}`)?.soort === 'zeldzaam');
    },
    found: () => store.get().ontdekt,
    sinceRare: () => store.get().zeldzaam.wereld ?? 0,
    mood: () => world.mood().now,
    sound: () => store.get().settings.geluid,
  });
}

/**
 * The title block over the sky of the real clearing: the name, one line of story, 🔊
 * and Begin (a click or Enter). Begin unlocks the sound inside the gesture (iOS), then
 * glides down to the ranger: into the maker the first time, straight into play after.
 */
function showTitleCard(opts: { after?: number; afterVeil?: boolean } = {}): void {
  const el = plainCard(
    `<div class="title-block">` +
    `<h1 class="title-mark">${esc(TITLE.naam)}</h1>` +
    `<p class="title-sub">${esc(TITLE.sub)}</p>` +
    `<div class="ra-row title-row"><button class="btn-start title-begin" type="button">${esc(TITLE.begin)}</button></div>` +
    `</div>`,
  );
  el.classList.add('title-overlay');
  if (opts.afterVeil) el.classList.add('title-overlay--after-veil'); // the veil's name stays
  // back from Pauze the camera is still rising to the title: the words wait for the sky
  if (opts.after) {
    el.querySelectorAll<HTMLElement>('.title-block > *').forEach((w, i) => w.style.setProperty('animation-delay', `${(opts.after ?? 0) + i * 160}ms`));
  }
  const ra = readScreenAloud(el, { text: SAY.title, autoStart: store.get().settings.voorlezen }); // child:B12
  el.querySelector('.title-begin')?.addEventListener('click', () => {
    // iOS: the AudioContext (made behind the veil) must be resumed inside the tap, before
    // anything awaits
    Sound.unlock();
    void loadGameAudio();
    ra.stop();
    el.className = 'title-overlay title-overlay--leaving'; // not a menu any more: the glide starts at once
    el.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    window.setTimeout(() => el.remove(), prefersReducedMotion() ? 0 : 320);
    if (store.get().avatarGemaakt) enterPlay(true);
    else showAvatarCreator(session.host, session.world!, () => enterPlay(false));
  }, { once: true });
}

/** From the title or the maker into play: the follow camera takes the lens over from the
 *  shot in one move, the ranger turns to the forest, the HUD and the sound come in. The
 *  player can walk at once. Then the first minute: Bram greets a new boswachter (or
 *  welcomes a `returning` one back) and the lessons follow (ui/hud/Lessons.ts). */
export function enterPlay(returning: boolean): void {
  const world = session.world;
  if (!world) return;
  world.present(null);
  setAmbientScene('heide', seizoen);
  setScreen('world');
  setMissionView(null);
  showExploreHud(activeExploreTitel());
  // the HUD comes in as the glide settles, not over the moving picture; then the class
  // goes, or every prompt that appears later (a slot shown again restarts its animation)
  // would wait a second and fade in behind the ring he already stands in
  const hud = session.host.querySelector('.explore-hud');
  hud?.classList.add('explore-hud--arriving');
  window.setTimeout(() => hud?.classList.remove('explore-hud--arriving'), 1_700);
  beginGuide(returning);
  devFade(world);
}

let devFaded = false;
/** Dev only (`?dev=1&fade=<id>`): a few seconds into play the world crossfades into that
 *  mood, once — how e2e/moods.spec watches a crossfade while no home asks for one. */
function devFade(world: World): void {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  const to = q?.has('dev') ? q.get('fade') : null;
  if (devFaded || !isMood(to)) return;
  devFaded = true;
  window.setTimeout(() => world.setMood(to), 3_000);
}

/**
 * Pauze → "Naar het hoofdmenu": a soft fade, the ranger back on the spawn clearing (out
 * of any vehicle), the camera rising from behind him to the title, the title block back.
 * The same world, never rebuilt; Begin glides back in.
 */
export function returnToTitle(): void {
  const world = session.world;
  if (!world) return;
  narrator.stop();
  held = false;
  disarmBeat();
  fadeCut(() => {
    clearOverlays();
    disposeExploreHud();
    world.resetToSpawn();
    world.present('title', false);
    setScreen('title');
    setMissionView(null);
  }, () => showTitleCard({ after: prefersReducedMotion() ? 0 : 900 }));
}

/** Resume free-roam after an in-world mission or menu: keep the world loaded,
 *  re-point the wayfinding cue at the next thing to do and restore the explore HUD. */
export function resumePatrol(): void {
  const world = session.world;
  if (!world) return;
  releaseWorld();
  setScreen('world');
  setMissionView(null);
  const area = Content.activeArea();
  const next = nextMissionId();
  world.setActiveMission(next);
  const titel = area.missies.find((m) => m.id === next)?.titel ?? null;
  // Light world-EF seasoning (BUILD-PLAN §8b): once per completed patrol cycle, on the
  // rare cadence, a calm skippable micro-beat — armed here, shown only once he has
  // walked on (never stacked on the reward cards: child B14).
  if (patrolTick !== lastBeatTick && pickWorldBeat({ patrolTick, heading: 'rechtdoor' })) {
    lastBeatTick = patrolTick;
    armBeat(patrolTick);
  }
  showExploreHud(titel);
  // back from a finished mission: Bram points at the missiebord (once, after the first)
  if (patrolTick > 0) armMissiebordBeat();
}

/* ------------------------------------------------ the armed world-EF beat ---- */
// The beat waits for a free-roam walk of WORLDBEAT_WALK_M (on foot, no menu, no mission),
// and the impulse beat for a roaming animal close by and in view: it names THAT animal.
let beatTick: number | null = null;
let beatWalked = 0;
let beatLast: { x: number; z: number } | null = null;
let beatRaf = 0;

function armBeat(tick: number): void {
  beatTick = tick;
  beatWalked = 0;
  beatLast = null;
  if (!beatRaf) beatRaf = requestAnimationFrame(watchBeat);
}

function disarmBeat(): void {
  beatTick = null;
  if (beatRaf) { cancelAnimationFrame(beatRaf); beatRaf = 0; }
}

/** A roaming ground animal CLEARLY in view (run 7, words-ree: near, in the middle band of
 *  the picture, in this mood's clear air): its name ("vos", "wild zwijn"), or null. */
function animalInView(world: World): string | null {
  const p = world.pos();
  if (!p) return null;
  const cam = world.camera;
  // (well inside the mood's clear air: half the distance its fog begins at, ≥ 22 m in
  // every mood, so never a shape in the mist)
  const clear = MOODS[world.mood().now].fogNear * 0.5;
  for (const a of world.ambientState()) {
    // close enough to SEE: a roe deer ~12 m off, a squirrel only a few metres (about 36 px
    // tall on a 1280×800 screen at the fixed 55° lens: h × 21 m)
    const reach = Math.min(WORLDBEAT_ANIMAL_M, a.h * 21, clear);
    if (a.id.startsWith('bird-') || Math.hypot(a.x - p.x, a.z - p.z) > reach) continue;
    const v = new Vector3(a.x, cam.position.y - 2, a.z).project(cam);
    // in the middle band of the picture (never at its edges or up at its top), and above
    // the low beat card that will name it
    if (v.z < 1 && Math.abs(v.x) < 0.6 && v.y > -0.3 && v.y < 0.5) {
      const id = a.id.split('-')[1]; // animal-vos-fox → vos
      return id ? Content.animal(id)?.naam ?? id : null; // wildzwijn → "wild zwijn"
    }
  }
  return null;
}

function watchBeat(): void {
  beatRaf = 0;
  const world = session.world;
  if (!world || beatTick === null) return;
  const onFoot = !world.vehicleState()?.inVehicle && !world.heliState()?.inHeli;
  const free = onFoot && !held && !menuOpen() && !!session.host.querySelector('.explore-hud');
  const p = world.pos();
  if (free && p) {
    if (beatLast) beatWalked += Math.hypot(p.x - beatLast.x, p.z - beatLast.z);
    beatLast = p;
    // decided now, from where he stands: the way to the next mission, the animal in view
    const beat = pickWorldBeat({ patrolTick: beatTick, heading: coarseHeading(world.headingTo(nextMissionId())) });
    const animal = beat?.kind === 'blijf-op-pad' ? animalInView(world) : null;
    if (beat && beatReady(beat, beatWalked, !!animal)) {
      beatTick = null;
      showWorldBeat(animal ? withAnimal(beat, animal) : beat, () => showExploreHud(activeExploreTitel()));
      return;
    }
  } else beatLast = null; // riding, a menu, a mission: those metres do not count
  beatRaf = requestAnimationFrame(watchBeat);
}

/* --------------------------------------------------- world-EF micro-beat ---- */
/** The key that picks option `i` of `n` on a keyboard: the direction beat's own arrows
 *  (←, ↑, →), else left and right for a pair. */
function optionKey(beat: WorldBeat, i: number): string | null {
  const o = beat.options[i];
  if (o.key) return o.key;
  if (beat.options.length === 2) return i === 0 ? 'ArrowLeft' : 'ArrowRight';
  return null;
}
const KEY_CAP: Record<string, string> = { ArrowLeft: '←', ArrowUp: '↑', ArrowRight: '→' };

/** A calm, skippable open-world EF beat between missions (impulse-resist or
 *  wayfinding-recall). Never-scary, never game-over: a wrong tap gives a soft
 *  "probeer nog eens" and re-presents the SAME beat; "Even verder" always lets
 *  the child walk on. Dual-channel (colour + a drawn icon + words + read-aloud), ≥56px.
 *  Keyboard: the arrow keys light up an option (on the direction beat ← ↑ → pick
 *  "Naar links", "Rechtdoor", "Naar rechts"; a pair takes ← and →), Enter chooses it
 *  (Enter with nothing lit lights the first), Esc walks on. */
function showWorldBeat(beat: WorldBeat, done: () => void): void {
  narrator.stop();
  const low = beat.kind === 'blijf-op-pad';
  const caps = !coarsePointer(); // key caps on a laptop; a tablet has no arrow keys
  const opts = beat.options
    .map((o, i) => {
      const k = optionKey(beat, i);
      return (
        `<button class="wb-opt" type="button" data-i="${i}">` +
        `<span class="wb-glyph" style="--turn:${o.turn ?? 0}deg">${icon(o.icon)}</span>` +
        `<span class="wb-label">${esc(o.label)}</span>` +
        (caps && k ? `<span class="kcap kcap-in wb-cap" aria-hidden="true">${KEY_CAP[k]}</span>` : '') +
        `</button>`
      );
    })
    .join('');
  // low on the screen and without a scrim: the animal the impulse beat names is in view
  const el = card(
    `<div class="card worldbeat${low ? ' wb-low' : ''}">` +
    kicker(low ? 'leaf' : 'compass', ONDERWEG.kicker) +
    `<p class="wb-prompt"></p>` +
    `<div class="wb-opts" role="group">${opts}</div>` +
    `<p class="wb-feedback" role="status" aria-live="polite" hidden></p>` +
    `<button class="ra-chip wb-skip" type="button" data-key="back">${esc(ONDERWEG.verder)}</button>` +
    `</div>`,
    { scrim: !low },
  );
  const ra = mountReadAloud({
    segments: sentenceSegments(el.querySelector<HTMLElement>('.wb-prompt')!, beat.prompt), // one sentence a line
    autoStart: store.get().settings.voorlezen,
  });
  const fb = el.querySelector<HTMLParagraphElement>('.wb-feedback');
  const btns = Array.from(el.querySelectorAll<HTMLButtonElement>('.wb-opt'));
  const finish = (): void => { ra.stop(); window.removeEventListener('keydown', onKey, true); done(); };
  btns.forEach((btn) => {
    btn.addEventListener('click', () => {
      ra.stop();
      const i = Number(btn.dataset.i);
      if (optionCorrect(beat, i)) {
        btn.classList.add('wb-goed');
        if (store.get().settings.geluid) Sound.found();
        const goed = beat.kind === 'blijf-op-pad' ? ONDERWEG.goedRustig : ONDERWEG.goedOnthouden;
        if (fb) { fb.hidden = false; fb.textContent = goed; fb.className = 'wb-feedback wb-fb-goed'; }
        if (store.get().settings.voorlezen) narrator.speak(goed);
        btns.forEach((b) => (b.disabled = true));
        window.setTimeout(finish, 900);
      } else {
        btn.classList.add('wb-bijna');
        if (store.get().settings.geluid) Sound.tryAgain();
        // what is shown is what is said
        if (fb) { fb.hidden = false; fb.textContent = ONDERWEG.bijna; fb.className = 'wb-feedback wb-fb-bijna'; }
        if (store.get().settings.voorlezen) narrator.speak(ONDERWEG.bijna);
        window.setTimeout(() => btn.classList.remove('wb-bijna'), 500);
      }
    });
  });
  el.querySelector('.wb-skip')?.addEventListener('click', finish);

  // the keyboard: a visible focus the arrow keys move, Enter chooses (ui/keys.ts presses
  // a focused button itself; this lights one up and catches an Enter with none lit)
  const light = (i: number): void => {
    btns.forEach((b, k) => b.classList.toggle('is-focus', k === i));
    btns[i]?.focus();
  };
  function onKey(e: KeyboardEvent): void {
    if (!el.classList.contains('ra-overlay')) { window.removeEventListener('keydown', onKey, true); return; } // the card went
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const at = btns.findIndex((b) => b === document.activeElement);
    if (e.code in KEY_CAP || e.code === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return; // an arrow still held from walking never picks
      const direct = btns.findIndex((_, i) => optionKey(beat, i) === e.code);
      const back = e.code === 'ArrowLeft' || e.code === 'ArrowUp';
      light(direct >= 0 ? direct : at < 0 ? 0 : Math.max(0, Math.min(btns.length - 1, at + (back ? -1 : 1))));
      return;
    }
    if ((e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') && !e.defaultPrevented) {
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return;
      if (at >= 0) btns[at].click();
      else light(0);
    }
  }
  window.addEventListener('keydown', onKey, true);
}

/**
 * Play "Ken je roep" (roep3d) in-place at the sit-spot (W6.4b2): freeze the world,
 * play the beat into the live `WorldCtx`, then resume free-roam in-place. The world
 * is never torn down; reduced-motion is honoured inside `playRoep3d`.
 */
export async function playRoepAtSitSpot(): Promise<void> {
  const world = session.world;
  if (!world) return;
  Sound.unlock();
  void loadGameAudio();
  clearOverlays();
  // the 2D floor when the player asked for it (Tweaks "altijd 2D"), under reduced
  // motion, or without WebGL — the same rule the missions' steps follow
  const flat = store.get().settings.force2d || prefersReducedMotion() || !webglOk();
  setMissionView(flat ? '2d' : '3d');
  holdWorld();
  const host = document.createElement('div');
  host.className = 'mission-step';
  session.host.appendChild(host);
  // the bench is never a one-way door (breaker B5): the mission's Pauze chip, with a
  // calm "Stop met luisteren" that aborts the game's scope, and Esc opens it
  beginActivityScope();
  let stop: () => void = () => {};
  const stopped = new Promise<'STOP'>((res) => { stop = () => res('STOP'); });
  mountMissionPause(() => { narrator.stop(); abortActivityScope(); unmountMissionPause(); stop(); }, MISSIE.stopLuisteren);
  try {
    await Promise.race([flat ? playRoep(host) : playRoep3d(world.ctx(host)), stopped]);
  } finally {
    unmountMissionPause();
    clearActivityWin();
    clearPlayHint();
    host.remove();
    releaseWorld();
    setMissionView(null);
  }
  // the ranger is still at the bench → the HUD re-surfaces the sit-spot affordance
  showExploreHud(activeExploreTitel());
}
